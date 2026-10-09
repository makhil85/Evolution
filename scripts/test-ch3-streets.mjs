// Node test for Chapter 3's streets, town props and river look.
//   node scripts/test-ch3-streets.mjs
// Covers: the walk map and the ground heights are exactly the ones the layout
// gave (fingerprints), the kit's colliders are unchanged and only the four
// masts are added, the paving never lies on the water, the bridge deck, a
// building or a station, the new masts and solar farm are off every path and
// clear of the quest spots, and the turbine and hydro wheel register their
// per-frame animators.
//
// village.js and decoration.js cannot load bare in node (audio.js touches
// window, GLTFLoader needs fetch), so this loads them through Vite and stubs
// the browser globals; model loads fail soft (they warn and draw nothing), and
// the geometry and colliders under test do not depend on the models.

import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

globalThis.window = Object.assign(globalThis, { addEventListener() {}, removeEventListener() {} });
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); }
}
const sha = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12);

try {
  const { Village, BOUNDS, RIVER, streetGeometry } = await server.ssrLoadModule('/src/game/village.js');
  const { decorateVillage } = await server.ssrLoadModule('/src/game/decoration.js');
  const { ROCKET_VILLAGE, VILLAGE_PATHS } = await server.ssrLoadModule('/src/game/rocketVillageLayout.js');
  const { stationPositions } = await server.ssrLoadModule('/src/game/stations.js');
  const { HOMES } = await server.ssrLoadModule('/src/game/homesLayout.js');

  const v = new Village();
  v.paint();

  // ---- the walk map and ground: the layout's, unchanged ---------------------
  const walk = [];
  for (let z = BOUNDS.minZ - 1; z <= BOUNDS.maxZ + 1; z++) {
    let row = '';
    for (let x = BOUNDS.minX - 1; x <= BOUNDS.maxX + 1; x++) row += v.isWalkable(x, z) ? '1' : '0';
    walk.push(row);
  }
  // The fingerprints were taken from the layout BEFORE the Chapter 3 streets
  // pass (a walk map of 117 rows and the 148 colliders of decoration.js).
  ok(sha(walk) === '62086a135478', `walk map fingerprint (${sha(walk)})`);
  const heights = [];
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 0.5) {
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 0.5) heights.push(+v.heightAt(x, z).toFixed(5));
  }
  ok(heights.length === 31373 && Math.abs(heights.reduce((a, b) => a + b, 0) + 208.388) < 0.01, 'ground heights match the layout');
  ok(!v.isWalkable(0, 3) && !v.isWalkable(10, RIVER.centreAt(10)), 'the river is still the golden lock (bridge lane shut)');
  ok(v.isWalkable(0, 25) && v.isWalkable(0, 40), 'the plaza and the north road are walkable');

  // ---- decoration: colliders and placements --------------------------------
  const origWarn = console.warn;
  console.warn = () => {};
  const parent = new THREE.Group();
  v.animators = [];
  const dressing = await decorateVillage(v, parent);
  console.warn = origWarn;

  // The kit's 148 colliders come first, in the same order, with the same numbers.
  // Rounded the same way as the pre-change snapshot, so the fingerprint compares.
  const kit = dressing.solids.slice(0, 148).map((s) => (s.radius !== undefined
    ? { x: +s.x.toFixed(4), z: +s.z.toFixed(4), r: +s.radius.toFixed(4) }
    : { x: +s.x.toFixed(4), z: +s.z.toFixed(4), hx: +s.halfX.toFixed(4), hz: +s.halfZ.toFixed(4), rot: +s.rotation.toFixed(4) }));
  ok(dressing.solids.length === 148 + 4, `colliders: the kit's 148 plus four masts (got ${dressing.solids.length})`);
  ok(sha(kit) === '208e2984b6ab', `kit colliders unchanged (${sha(kit)})`);
  const masts = dressing.solids.slice(148);
  ok(masts.every((m) => m.radius === 0.3), 'the masts have a 0.3 collider');

  // The masts, and the solar farm, stand clear of every path, building, quest
  // station and home. The farm is six panels at x 12-16, z -8 to -6.
  const segDist = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  };
  const onRoad = (x, z, clear) => VILLAGE_PATHS.some((p) => {
    for (let n = 0; n < p.points.length - 1; n++) {
      const [ax, az] = p.points[n], [bx, bz] = p.points[n + 1];
      if (segDist(x, z, ax, az, bx, bz) < p.width / 2 + clear) return true;
    }
    return false;
  });
  const stations = Object.values(stationPositions());
  const spots = [...masts.map((m) => [m.x, m.z]), [12, -8], [14, -8], [16, -8], [12, -6], [14, -6], [16, -6]];
  for (const [x, z] of spots) {
    ok(!onRoad(x, z, 2), `(${x}, ${z}) is off the roads`);
    ok(!ROCKET_VILLAGE.buildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 2), `(${x}, ${z}) is off the buildings`);
    ok(!stations.some((s) => Math.hypot(x - s.x, z - s.z) < 5), `(${x}, ${z}) is clear of the quest stations`);
    ok(!HOMES.some((h) => Math.hypot(x - h.x, z - h.z) < 6), `(${x}, ${z}) is clear of the homes`);
    ok(v.isWalkable(x, z), `(${x}, ${z}) is dry land`);
  }

  // ---- the turbine, the hydro wheel and the antenna's blinking tip move through village.animators ------
  ok(v.animators.length === 3, `turbine, hydro wheel and antenna tip register animators (got ${v.animators.length})`);
  let threw = false;
  try { v.update(12.5); } catch { threw = true; }
  ok(!threw, 'village.update runs the animators');

  // ---- the streets: flat, on the ground, and off the water and the bridge --
  const geo = streetGeometry(v);
  const p = geo.attributes.position.array;
  const triangles = p.length / 9;
  ok(triangles > 2000 && triangles < 60000, `street mesh size is sane (${triangles} triangles)`);
  let finite = true, level = true, offRiver = true, offBuildings = true;
  for (let t = 0; t < triangles; t++) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const x = p[t * 9 + k * 3], y = p[t * 9 + k * 3 + 1], z = p[t * 9 + k * 3 + 2];
      if (!Number.isFinite(x + y + z)) finite = false;
      // Every vertex sits on the ground, within the largest lift (0.06).
      if (Math.abs(y - v.heightAt(x, z)) > 0.07) level = false;
      cx += x / 3; cz += z / 3;
    }
    // The paving stops short of the water: no triangle centre inside the river corridor.
    if (Math.abs(RIVER.offsetAt(cx, cz)) < RIVER.widthAt(cx) + 2.6) offRiver = false;
    if (ROCKET_VILLAGE.buildings.some((b) => Math.hypot(cx - b.x, cz - b.z) < 2.2)) offBuildings = false;
  }
  ok(finite, 'street vertices are finite');
  ok(level, 'street vertices follow the ground (no floating or sunk paving)');
  ok(offRiver, 'no paving over the river or the bridge approach');
  ok(offBuildings, 'no paving inside a building');

  // A main-road lane line exists somewhere on the north road (the mesh is not empty there).
  const north = [];
  for (let t = 0; t < triangles; t++) {
    const cz = (p[t * 9 + 2] + p[t * 9 + 5] + p[t * 9 + 8]) / 3;
    const cx = (p[t * 9] + p[t * 9 + 3] + p[t * 9 + 6]) / 3;
    if (Math.abs(cx) < 0.5 && cz > 35 && cz < 45) north.push(t);
  }
  ok(north.length > 10, 'the north road is paved');

  // ---- perf: the scatter is baked into merged cells -------------------------
  // The town's trees, rocks and the mountain range go through bakeInstances:
  // one static mesh per cell and material kind, not one draw per prototype.
  // These checks run on boxes (the models cannot load here): the merge keeps
  // every triangle, each cell's bounding sphere holds every instance in it (so
  // culling never drops a visible one), and the draws are the cells in use.
  const { bakeInstances, gridCellOf, sectorCellOf } = await server.ssrLoadModule('/src/game/board.js');
  const { mountainRingLayout } = await server.ssrLoadModule('/src/game/mountains.js');
  const cellOf = gridCellOf(BOUNDS, 4, 6);
  const tinted = { geometry: new THREE.BoxGeometry(1.2, 2.4, 1.2), material: new THREE.MeshBasicMaterial(), triangles: 12, tint: 0x4e9e46 };
  const textured = { geometry: new THREE.BoxGeometry(0.8, 1.6, 0.8), material: new THREE.MeshBasicMaterial({ map: new THREE.Texture() }), triangles: 12 };
  const scatter = [];
  for (let k = 0; k < 60; k++) {
    scatter.push({ x: -31 + (k % 10) * 6.4, z: -49 + Math.floor(k / 10) * 9.3, rotY: k * 0.7, scale: 0.8 + (k % 3) * 0.2 });
  }
  const baked = bakeInstances(new THREE.Group(), [{ parts: [tinted, textured], placements: scatter }], { cellOf });
  const tris = baked.reduce((s, m) => s + m.geometry.index.count / 3, 0);
  ok(tris === scatter.length * 24, `the merge keeps every triangle (${tris} of ${scatter.length * 24})`);
  const cellsUsed = new Set(scatter.map((p) => cellOf(p))).size;
  ok(baked.length <= cellsUsed * 2 && baked.length < scatter.length * 2, `one draw per cell and kind (${baked.length} draws, ${cellsUsed} cells)`);
  let covered = true;
  for (const mesh of baked) {
    const sph = mesh.geometry.boundingSphere;
    // The tinted box is 1.2 x 2.4 x 1.2, the textured one 0.8 x 1.6 x 0.8.
    const half = mesh.material.map ? new THREE.Vector3(0.4, 0.8, 0.4) : new THREE.Vector3(0.6, 1.2, 0.6);
    for (const p of scatter) {
      if (cellOf(p) !== mesh.userData.cell) continue;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY), new THREE.Vector3(p.scale, p.scale, p.scale));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const c = new THREE.Vector3(sx * half.x, sy * half.y, sz * half.z).applyMatrix4(m);
        if (c.distanceTo(sph.center) > sph.radius + 1e-6) covered = false;
      }
    }
  }
  ok(covered, 'every cell sphere holds every instance in it (culling cannot drop a visible one)');

  // The mountain range: twelve arcs at most (mountains.js MOUNTAIN_ARCS), every cliff piece in exactly one.
  const { byPiece } = mountainRingLayout(BOUNDS);
  const arcs = new Set();
  let pieces = 0;
  for (const list of Object.values(byPiece)) {
    for (const p of list) { arcs.add(sectorCellOf((BOUNDS.minX + BOUNDS.maxX) / 2, (BOUNDS.minZ + BOUNDS.maxZ) / 2, 12)(p)); pieces++; }
  }
  ok(arcs.size === 12 && pieces > 500, `the range is baked into twelve arcs (${arcs.size} arcs, ${pieces} pieces)`);
} finally {
  await server.close();
}

console.log(`test-ch3-streets: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
