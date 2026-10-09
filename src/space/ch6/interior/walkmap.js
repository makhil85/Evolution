// Chapter 6 interior: where she may walk on one deck, as a grid (no drawing,
// so node can test it). A deck lists its floor areas (rectangles, discs,
// rings) and its solids (props, walls standing on a floor); a cell is
// walkable when it is on a floor and off every solid. Her body is a disc, so
// a move is kept only when the cells under her edge are walkable too; when it
// isn't, she slides along whichever axis still works (like a wall in the
// villages) and the speed into the wall is dropped.
//
//   const map = createWalkMap({ floors, solids, cell: 0.2 });
//   map.walkable(x, z)          one point
//   map.fits(x, z, r)           a disc of radius r
//   map.collide(p, v)           walker.move's collide(pos, vel): p {x,z}, v {x,y}
//   map.reset(x, z)             after a teleport (the last good spot)
//   map.clearAt(q)              the chase camera: q = { x, z, r, y, m } (a caller's scratch object, so no
//                               numbers are boxed a frame): a disc of radius r at height y is over the floor and
//                               clear of every solid whose top (plus m) is below y
//
// Shapes (deck-local metres, +Z away from the lift):
//   { rect: [x, z, w, d], rot? }     centre, width (x), depth (z), turn (rad)
//   { disc: [x, z, r] }
//   { ring: [x, z, r0, r1], from?, to? }   annulus, optionally an arc (rad, atan2(x, z))
// A solid may give its height, h (m, the top): the walker still cannot pass it, but the chase camera may go
// over it when it is above the top (clearAt). No h means full height (a wall, a crew mate): the camera never
// goes over it.

const inShape = (s, x, z) => {
  if (s.rect) {
    const [cx, cz, w, d] = s.rect;
    let dx = x - cx; let dz = z - cz;
    if (s.rot) { const c = Math.cos(s.rot); const n = Math.sin(s.rot); [dx, dz] = [dx * c - dz * n, dx * n + dz * c]; }
    return Math.abs(dx) <= w / 2 && Math.abs(dz) <= d / 2;
  }
  if (s.disc) { const [cx, cz, r] = s.disc; return (x - cx) ** 2 + (z - cz) ** 2 <= r * r; }
  if (s.ring) {
    const [cx, cz, r0, r1] = s.ring;
    const d = Math.hypot(x - cx, z - cz);
    if (d < r0 || d > r1) return false;
    if (s.from == null) return true;
    const a = Math.atan2(x - cx, z - cz);
    const span = ((s.to - s.from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const off = ((a - s.from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return off <= span;
  }
  return false;
};

/**
 * The roof above a point: `roofs` is a list of { shape, h } (h a number, or a function of (x, z)
 * for a curved roof); the first shape the point is in gives it, else `dflt`. A deck's ceilingAt().
 */
export function roofAt(roofs, x, z, dflt) {
  for (const r of roofs) {
    if (inShape(r.shape, x, z)) return typeof r.h === 'function' ? r.h(x, z) : r.h;
  }
  return dflt;
}

/** The box round a shape (for the grid's extent). */
const bounds = (s) => {
  if (s.rect) { const [cx, cz, w, d] = s.rect; const h = s.rot ? Math.hypot(w, d) / 2 : 0; return [cx - (h || w / 2), cz - (h || d / 2), cx + (h || w / 2), cz + (h || d / 2)]; }
  if (s.disc) { const [cx, cz, r] = s.disc; return [cx - r, cz - r, cx + r, cz + r]; }
  if (s.ring) { const [cx, cz, , r1] = s.ring; return [cx - r1, cz - r1, cx + r1, cz + r1]; }
  return [0, 0, 0, 0];
};

export function createWalkMap({ floors = [], solids = [], cell = 0.2, bodyR = 0.3 } = {}) {
  let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity;
  for (const s of floors) { const b = bounds(s); x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
  if (!floors.length) { x0 = z0 = -1; x1 = z1 = 1; }
  x0 -= cell; z0 -= cell;
  const nx = Math.ceil((x1 - x0) / cell) + 2;
  const nz = Math.ceil((z1 - z0) / cell) + 2;
  const grid = new Uint8Array(nx * nz); // walkable: on a floor and off every solid
  const ground = new Uint8Array(nx * nz); // on a floor, solid or not (the camera's floor)
  const top = new Float32Array(nx * nz).fill(-1); // the highest solid top in a cell (Infinity for full height), -1 none
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell;
      const c = j * nx + i;
      if (!floors.some((s) => inShape(s, x, z))) continue;
      ground[c] = 1;
      let t = -1;
      for (const s of solids) if (inShape(s, x, z)) t = Math.max(t, s.h ?? Infinity);
      top[c] = t;
      if (t < 0) grid[c] = 1;
    }
  }
  const cellAt = (x, z) => {
    const i = Math.floor((x - x0) / cell); const j = Math.floor((z - z0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1;
  };
  const walkable = (x, z) => { const c = cellAt(x, z); return c >= 0 && grid[c] === 1; };
  // Her edge: the centre and eight points round it.
  const RING = Array.from({ length: 8 }, (_, k) => [Math.sin((k / 8) * Math.PI * 2), Math.cos((k / 8) * Math.PI * 2)]);
  const fits = (x, z, r = bodyR) => walkable(x, z) && RING.every(([sx, sz]) => walkable(x + sx * r, z + sz * r));
  // The chase camera's test (no allocation: it runs every frame). The centre and the eight points round it.
  const clearAt = (q) => {
    for (let k = -1; k < 8; k++) {
      const c = k < 0 ? cellAt(q.x, q.z) : cellAt(q.x + RING[k][0] * q.r, q.z + RING[k][1] * q.r);
      if (c < 0 || !ground[c] || top[c] + q.m >= q.y) return false;
    }
    return true;
  };

  const last = { x: 0, z: 0, ok: false };
  function collide(p, v) {
    if (!last.ok) { last.x = p.x; last.z = p.z; last.ok = fits(p.x, p.z); return; }
    if (fits(p.x, p.z)) { last.x = p.x; last.z = p.z; return; }
    if (fits(p.x, last.z)) { p.z = last.z; v.y = 0; last.x = p.x; return; }
    if (fits(last.x, p.z)) { p.x = last.x; v.x = 0; last.z = p.z; return; }
    p.x = last.x; p.z = last.z; v.x = 0; v.y = 0;
  }
  return {
    walkable, fits, clearAt, collide,
    reset(x, z) { last.x = x; last.z = z; last.ok = fits(x, z); },
    /** For tests and the lab: the share of the grid she can walk, and its floor area in m^2. */
    area() { let n = 0; for (const c of grid) n += c; return n * cell * cell; },
    extent: { x0, z0, x1: x0 + nx * cell, z1: z0 + nz * cell },
  };
}
