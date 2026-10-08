// Chapter 6 interior, Deck 2: LIFE SUPPORT (the air, the water and the farm).
// Layout in deck metres. The ship's ring is a curved corridor on a circle of
// centre (0, 40): its outer wall (r 40) runs through the lift, its inner wall
// (r 36.8) has the doors. The corridor runs ±0.95 rad round the ring, with
// LCARS panels on the inner wall and star windows in the outer one. Two rooms
// sit inside the ring on the inner wall, so every wall and prop follows the curve:
//   LAB (+x, 13 m wide at the door, 11 m deep): three algae tanks in a row at
//     the back, the ice splitter, the water loop (three filter columns: grit,
//     algae, and UV in violet), a work table with screens.
//   HYDROPONICS (-x, 18 m wide, 16 m deep, 5 m tall): four rows of grow racks
//     under pink-violet grow strips, a walkway with a water channel, fruit
//     trees in pots, and the planning console at the far end. In the walkway,
//     between a rack and the water channel, the strawberry bed (quest 'pollen').
// A room is a frame(a): local x runs along the wall and local z points out of
// the ring, so frame.at(x, z) gives deck metres and a prop's yaw is a + ry.
//
// The walls are the sci-fi kit (lead 2026-10-08, the bridge's method): 4 m
// panels on flat facets, each with its cornice (TopPlastic, squashed to the
// corridor's 3.6 m ceiling where it is low) and floor trim (BottomMetal), one
// shared origin per wall so the trims line up. The ring's inner wall is two
// panels thick (2.4 m: the corridor's face and the room's face), so a door
// is cut through both. The rooms' own pieces (the greenhouse's windows, the
// racks' columns and shelves, the grow lights) come from the kit too; the
// tanks, the screens, the plants and the consoles are ours. Without the kit
// the walls are plain code (kit.wallArc / kit.wall) and the props are boxes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

// The kit pieces this deck uses (models.js names; loaded before the deck is built).
// Inlays and plates lie 2-9 mm above the floor: this offset makes them win the depth test there (no flicker).
const FLUSH = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
export const MODELS = [
  'walls/WallAstra_Straight', 'walls/WallAstra_Straight_Window', 'walls/WallWindow_Straight',
  'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight',
  'columns/Column_Round',
  'platforms/Platform_Metal', 'platforms/Platform_Metal2', 'platforms/Door_Frame_Square',
  'props/Prop_Light_Small', 'props/Prop_Light_Wide', 'props/Prop_Vent_Small', 'props/Prop_Vent_Wide',
  'props/Prop_Computer', 'props/Prop_AccessPoint', 'props/Prop_Crate4', 'props/Prop_Barrel_Large', 'props/Prop_Cable_1',
  'props/Prop_ItemHolder', 'decals/Decal_Line_Straight',
];

const CZ = 40;          // the ring's centre (z), on x = 0
const R_OUT = 40;       // the corridor's outer wall (the lift is on it)
const R_IN = 36.8;      // the corridor's inner wall: the rooms' outer walls
const CORR = 0.95;      // the corridor runs from the lift to ±CORR rad
const LIFT_GAP = 0.031; // the lift's opening in the outer wall (±1.24 m, its frame)
const CEIL = 3.6;       // the corridor's and the lab's ceiling: a 3 m panel and a 0.6 m cornice
const WALL_T = 2.4;     // the inner wall, from the corridor's face to the room's face (two 1.2 m panels)
const LAB = { a: Math.PI - 0.57, th: 0.36, r0: 25.5, door: 0.8 };        // door: half the opening (m)
const HYD = { a: Math.PI + 0.55, th: 0.5, r0: 20.8, h: 5, door: 0.8 };   // the bay is 5 m tall
const STAR = [Math.PI - 0.5, Math.PI + 0.5];                             // the star windows' angles
const PLATE = 0xc4cad4; // the kit's floor plates carry loud red and yellow edge stripes: a light cool grey keeps them quiet
const VENT = 0x8a93a3;  // the kit's vent grilles are black: a grey tint (a black takes the tint as its colour)

/** Deck metres on the ring at angle a (atan2(x, z - 40)) and radius r. */
const pol = (a, r) => [r * Math.sin(a), CZ + r * Math.cos(a)];

/** A frame on the ring at angle a: at(x, z) turns local metres into deck metres. */
function frame(a, r = R_IN) {
  const c = Math.cos(a); const s = Math.sin(a); const [ox, oz] = pol(a, r);
  return { a, at: (x, z = 0) => [ox + x * c + z * s, oz - x * s + z * c] };
}

/** Where she stands (local x, z) to face a prop at local (px, pz). */
function spotIn(f, x, z, px, pz) {
  const [X, Z] = f.at(x, z);
  return { x: X, z: Z, face: f.a + Math.atan2(px - x, pz - z) };
}

// A console's side profile, as (z, y) in metres from its middle and its floor: the plinth, the sloped front.
const CONSOLE = [[-0.4, 0.05], [0.38, 0.05], [0.4, 0.36], [0.18, 0.8], [-0.4, 0.8]];
/** A side profile (z, y) extruded across x (w wide, centred), with a bevel: the console's body. */
function profileGeo(w, prof, bevel = 0.02) {
  const sh = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  // The extrusion (depth) becomes x, the shape's x becomes z (the front), its y stays up.
  return g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, w / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
}

export function buildDeck(kit) {
  const group = new THREE.Group();
  const b = kit.batch();
  const solids = []; const floors = []; const doors = []; const wins = []; const bubbles = [];
  const KM = kit.models; // the kit's pieces; null when they did not load (plain code walls)
  const toon = (color) => kit.own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  const M = {
    leafA: toon(0x5fbf6a), leafB: toon(0x3f9e5a), leafC: toon(0x9ad17a), bark: toon(0x8a6a4a),
    // The algae and the bubbles are see-through (no depth write), so the bubbles show inside the tanks.
    algae: kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2ee86a).multiplyScalar(1.3), transparent: true, opacity: 0.8, depthWrite: false })),
    bubble: kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe6fff0).multiplyScalar(1.6), transparent: true, depthWrite: false })),
    uv: kit.glow(0xa878ff, 1.8),
    grow: kit.glow(0xff7ad9, 1.5), water: kit.glow(0x6fe0d0, 0.9),
    lab: toon(0xd8dde4), labDark: toon(0x6d7585), teal: toon(PALETTE.teal),
    floor: toon(0x8c919c), // the lab's and the bay's floors (lighter than the kit's deck grey)
  };
  const algaeBase = M.algae.color.clone(); const growBase = M.grow.color.clone();

  // Props in a room's frame (local x, z, and a local yaw).
  const boxIn = (f, w, h, d, mat, x, y, z, ry = 0) => { const [X, Z] = f.at(x, z); b.box(w, h, d, mat, X, y, Z, f.a + ry); };
  const addIn = (f, geo, mat, x, y, z, ry = 0) => { const [X, Z] = f.at(x, z); b.add(geo, mat, X, y, Z, f.a + ry); };
  const place = (obj, f, x, y, z, ry = 0) => { const [X, Z] = f.at(x, z); obj.position.set(X, y, Z); obj.rotation.y = f.a + ry; group.add(obj); return obj; };
  const rectIn = (f, w, d, x, z) => { const [X, Z] = f.at(x, z); return { rect: [X, Z, w, d], rot: f.a }; };
  const discIn = (f, r, x, z) => { const [X, Z] = f.at(x, z); return { disc: [X, Z, r] }; };
  const lampIn = (f, x, z, y) => place(kit.lamp(), f, x, y, z);
  /** A thin band on the ring's own circle: a light strip in a ceiling, or a floor inlay. */
  const band = (r0, r1, a0, a1, y, mat, down = false) => {
    const seg = Math.max(4, Math.round(((a1 - a0) * r1) / 1.2));
    const g = new THREE.RingGeometry(r0, r1, seg, 1, down ? Math.PI / 2 - a1 : a0 - Math.PI / 2, a1 - a0);
    g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
    b.add(g, mat, 0, y, CZ);
  };

  // ---- the kit: pieces by name, placed in the batch (no-ops without the kit) -------------------
  /** The parts of a kit piece as cloned geometry, with `pre` applied (the kit's own copies are not touched). */
  const partsOf = (name, pre = null) => KM.object(name).children.map((m) => {
    const g = m.geometry.clone();
    if (pre) g.applyMatrix4(pre);
    return { g, mat: m.material };
  });
  /** A kit piece's material in a tint (a copy, shared by its parts): the kit's decals are loud, a deck wants them quieter. */
  const tints = new Map();
  const tinted = (mat, c) => {
    if (!c) return mat;
    const key = `${mat.uuid}|${c}`;
    if (!tints.has(key)) {
      const m = mat.clone();
      if (mat.name === 'M_Black') m.color.set(c); else m.color.multiply(new THREE.Color(c)); // a multiply cannot lighten a black
      tints.set(key, kit.own(Object.assign(m, FLUSH)));
    }
    return tints.get(key);
  };
  /** The kit's dark trim (a material named *_Dark) reads as black on a deck: a copy, lifted (cloned once). */
  const lifts = new Map();
  const lifted = (mat) => {
    if (!mat.name?.endsWith('_Dark')) return mat;
    if (!lifts.has(mat.uuid)) { const m = mat.clone(); m.color.multiplyScalar(2.4); lifts.set(mat.uuid, kit.own(m)); }
    return lifts.get(mat.uuid);
  };
  const boundsOf = (list) => {
    const box = new THREE.Box3();
    for (const { g } of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
    return box;
  };
  const scaleM = (sx, sy = sx, sz = sx) => new THREE.Matrix4().makeScale(sx, sy, sz);
  // The wall's cornice (TopPlastic, 3 m to 5 m up) squashed to the 3.6 m ceiling: 3 m to 3.6 m.
  const SQUASH = new THREE.Matrix4().makeTranslation(0, 3, 0).multiply(scaleM(1, 0.3, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -3, 0));
  // A light or a vent lies flat in its own frame; this turns it so it stands on a wall (its thin side faces the room).
  const FLAT_TO_WALL = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  const PANEL = 'walls/WallAstra_Straight';
  const CAP = 'walls/TopPlastic_Straight';
  const WALL = [PANEL, CAP, 'walls/BottomMetal_Straight'];                  // a panel with its cornice and floor trim
  const WINDOW = ['walls/WallAstra_Straight_Window', CAP, 'walls/BottomMetal_Straight']; // the same, with a recessed star window
  const SIDE = ['walls/WallWindow_Straight', CAP, 'walls/BottomMetal_Straight']; // the greenhouse's side: windows in panels
  /**
   * Kit panels standing on a wall line: the room face (the piece's largest x) on P, facing n (a unit vector
   * into the room), the feet on y. All of a wall's pieces share the panel's origin (PANEL's room face), so a
   * cornice or a trim lines up with the panel it belongs to, and a recessed window sits behind the face.
   * `sz` stretches the 4 m panel along the wall, `sy` its height; `squashed` lowers the cornices to 3.6 m.
   */
  const kitWall = (names, P, n, { sz = 1, sy = 1, y = 0, squashed = false, tint = null, skipDark = false } = {}) => {
    if (!KM) return;
    const th = Math.atan2(-n[1], n[0]);
    const base = scaleM(1, sy, sz);
    const box = boundsOf(partsOf(PANEL, base));
    const sh = [-box.max.x, -box.min.y, -(box.min.z + box.max.z) / 2];
    for (const name of names) {
      const pre = squashed && name === CAP ? SQUASH.clone().multiply(base) : base;
      for (const { g, mat } of partsOf(name, pre)) {
        if (skipDark && mat.name?.endsWith('_Dark')) continue; // a lintel's dark skirt: a black band over the door
        g.translate(sh[0], sh[1], sh[2]);
        b.add(g, tinted(lifted(mat), tint), P[0], y, P[1], th);
      }
    }
  };
  /**
   * A prop or a light on a wall: its face (`mode` 'max': the largest x, a light; 'min': the smallest x, a box
   * stood against the wall) on P, pushed `off` into the room, `t` along the wall, feet at y. `pre` turns it.
   */
  const kitFace = (names, P, n, { y = 0, t = 0, off = 0, mode = 'max', pre = null, tint = null } = {}) => {
    if (!KM) return;
    const th = Math.atan2(-n[1], n[0]);
    const cx = P[0] + n[0] * off - n[1] * t; const cz = P[1] + n[1] * off + n[0] * t;
    for (const name of names) {
      const list = partsOf(name, pre);
      const box = boundsOf(list);
      const sx = mode === 'min' ? -box.min.x : -box.max.x;
      for (const { g, mat } of list) { g.translate(sx, -box.min.y, -(box.min.z + box.max.z) / 2); b.add(g, tinted(mat, tint), cx, y, cz, th); }
    }
  };
  /** A free kit piece, centred on (x, z) with its feet at y, turned ry; sc stretches it. */
  const kitAt = (name, x, y, z, ry = 0, { sc = [1, 1, 1], tint = null } = {}) => {
    if (!KM) return;
    const list = partsOf(name, scaleM(sc[0], sc[1], sc[2]));
    const box = boundsOf(list);
    for (const { g } of list) g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    for (const { g, mat } of list) b.add(g, tinted(mat, tint), x, y, z, ry);
  };
  /** kitAt in a room's frame. */
  const kitIn = (f, name, x, y, z, ry = 0, opts) => { const [X, Z] = f.at(x, z); kitAt(name, X, y, Z, f.a + ry, opts); };
  const runs = (a0, a1, gaps) => {
    const out = []; let from = a0;
    for (const [g0, g1] of gaps) { out.push([from, g0]); from = g1; }
    out.push([from, a1]);
    return out;
  };
  /**
   * A wall on the arc of radius r (centre (0, CZ)) from a0 to a1, cut at the gaps ([from, to] pairs, sorted).
   * `out`: the room lies outside the arc. Panels are 4 m (each run's last one stretches to fit), and the
   * facets nearest `picks` use `pickNames` (a star window). Returns the facets (angle, face point, normal, length).
   */
  const arcWall = (names, r, a0, a1, { out = false, gaps = [], picks = [], pickNames = names, squashed = false, sy = 1, y = 0, h = CEIL } = {}) => {
    if (!KM) { for (const [s0, s1] of runs(a0, a1, gaps)) kit.wallArc(b, 0, CZ, r, s0, s1, { h }); }
    const facets = [];
    for (const [s0, s1] of runs(a0, a1, gaps)) {
      const len = (s1 - s0) * r; const k = Math.max(1, Math.ceil(len / 4)); const L = len / k;
      for (let i = 0; i < k; i++) facets.push({ a: s0 + ((i + 0.5) * (s1 - s0)) / k, L, pick: false });
    }
    for (const p of picks) {
      let best = facets[0];
      for (const f of facets) if (Math.abs(f.a - p) < Math.abs(best.a - p)) best = f;
      best.pick = true;
    }
    const sg = out ? 1 : -1;
    for (const f of facets) {
      const N = [Math.sin(f.a), Math.cos(f.a)];
      f.n = [sg * N[0], sg * N[1]]; f.P = [r * N[0], CZ + r * N[1]];
      if (KM) kitWall(f.pick ? pickNames : names, f.P, f.n, { sz: f.L / 4, sy, y, squashed });
    }
    return facets;
  };
  /** A wall on the radial line at angle a, from radius s0 to s1 (a solid too); the room lies on the side `dir` (+1: the way the angle grows). */
  const radialWall = (names, a, s0, s1, dir, { squashed = false, sy = 1, h = CEIL } = {}) => {
    const k = Math.max(1, Math.ceil((s1 - s0) / 4)); const L = (s1 - s0) / k;
    const n = [Math.cos(a) * dir, -Math.sin(a) * dir]; // into the room: the angle's own tangent, turned by dir
    const facets = [];
    if (!KM) kit.wall(b, s0 * Math.sin(a), CZ + s0 * Math.cos(a), s1 * Math.sin(a), CZ + s1 * Math.cos(a), { h });
    for (let i = 0; i < k; i++) {
      const s = s0 + ((i + 0.5) * (s1 - s0)) / k;
      const P = [s * Math.sin(a), CZ + s * Math.cos(a)];
      kitWall(names, P, n, { sz: L / 4, sy, squashed });
      facets.push({ P, n });
    }
    // The solid: the wall's 1.2 m body, behind its face (away from the room).
    const m = (s0 + s1) / 2;
    solids.push({ rect: [m * Math.sin(a) - n[0] * 0.6, CZ + m * Math.cos(a) - n[1] * 0.6, 1.2, s1 - s0], rot: a });
    return facets;
  };
  /** The wall above an opening, from y0 up to y1, across half-width hw (the kit panel, stretched). */
  const lintel = (a, r, out, hw, y0, y1) => {
    if (!KM) return;
    const N = [Math.sin(a), Math.cos(a)]; const sg = out ? 1 : -1;
    kitWall([PANEL], [r * N[0], CZ + r * N[1]], [sg * N[0], sg * N[1]], { sz: (2 * hw) / 4, sy: (y1 - y0) / 3.02, y: y0, skipDark: true });
  };

  // ---- the ring ----------------------------------------------------------------------------------
  const labA0 = LAB.a - LAB.th / 2; const labA1 = LAB.a + LAB.th / 2;
  const hydA0 = HYD.a - HYD.th / 2; const hydA1 = HYD.a + HYD.th / 2;
  const CA0 = Math.PI - CORR; const CA1 = Math.PI + CORR;
  const LAB_GAP = [LAB.a - LAB.door / R_IN, LAB.a + LAB.door / R_IN];
  const HYD_GAP = [HYD.a - HYD.door / R_IN, HYD.a + HYD.door / R_IN];
  const LIFT = [Math.PI - LIFT_GAP, Math.PI + LIFT_GAP];
  const corr = { ring: [0, CZ, R_IN, R_OUT], from: CA0, to: CA1 };
  const labShape = { ring: [0, CZ, LAB.r0, R_IN], from: labA0, to: labA1 };
  const hydShape = { ring: [0, CZ, HYD.r0, R_IN], from: hydA0, to: hydA1 };
  const lab = frame(LAB.a); const hyd = frame(HYD.a);

  // The corridor's outer wall: the corridor is inside it (the lift gap, and the star windows).
  const outerFacets = arcWall(WALL, R_OUT, CA0, CA1, { out: false, gaps: [LIFT], picks: STAR, pickNames: WINDOW, squashed: true, h: CEIL });
  // The corridor's inner wall: the corridor is outside it; the two rooms' doors are cut through it.
  const innerFacets = arcWall(WALL, R_IN, CA0, CA1, { out: true, gaps: [LAB_GAP, HYD_GAP], squashed: true, h: CEIL });
  // The rooms' inner faces: the lab's (3.6 m) and the bay's (5 m), 2.4 m in from the corridor's face.
  arcWall(WALL, R_IN - WALL_T, labA0, labA1, { out: false, gaps: [LAB_GAP], squashed: true, h: CEIL });
  arcWall(WALL, R_IN - WALL_T, hydA0, hydA1, { out: false, gaps: [HYD_GAP], h: HYD.h });
  // The rooms' back walls (the room is outside them).
  const labBack = arcWall(WALL, LAB.r0, labA0, labA1, { out: true, squashed: true, h: CEIL });
  arcWall(WALL, HYD.r0, hydA0, hydA1, { out: true, h: HYD.h });
  // The corridor's ends (the room is along the corridor), and the rooms' sides (the greenhouse's are windows).
  radialWall(WALL, CA0, R_IN, R_OUT, +1, { squashed: true });
  radialWall(WALL, CA1, R_IN, R_OUT, -1, { squashed: true });
  const labSides = [...radialWall(WALL, labA0, LAB.r0, R_IN, +1, { squashed: true }), ...radialWall(WALL, labA1, LAB.r0, R_IN, -1, { squashed: true })];
  radialWall(SIDE, hydA0, HYD.r0, R_IN, +1, { h: HYD.h });
  radialWall(SIDE, hydA1, HYD.r0, R_IN, -1, { h: HYD.h });
  // The lift's wall above its door, and the two rooms' lintels (the frames' tops).
  lintel(Math.PI, R_OUT, false, R_OUT * LIFT_GAP, 2.5, CEIL);
  lintel(LAB.a, R_IN, true, LAB.door, 2.45, CEIL); lintel(LAB.a, R_IN - WALL_T, false, LAB.door, 2.45, CEIL);
  lintel(HYD.a, R_IN, true, HYD.door, 2.45, HYD.h); lintel(HYD.a, R_IN - WALL_T, false, HYD.door, 2.45, HYD.h);

  // Walls are solids too (walkmap.js): the outer wall (a gap at the lift), the inner wall (gaps at the two doors),
  // and each room's back wall.
  const ringSolid = (r0, r1, a0, a1) => solids.push({ ring: [0, CZ, r0, r1], from: a0, to: a1 });
  for (const [s0, s1] of runs(CA0, CA1, [LIFT])) ringSolid(R_OUT - 0.25, R_OUT + 0.05, s0, s1);
  for (const [s0, s1] of runs(CA0, CA1, [LAB_GAP, HYD_GAP])) ringSolid(R_IN - WALL_T, R_IN + 0.05, s0, s1);
  ringSolid(LAB.r0 - 1.2, LAB.r0 + 0.05, labA0, labA1);
  ringSolid(HYD.r0 - 1.2, HYD.r0 + 0.05, hydA0, hydA1);

  floors.push(corr, labShape, hydShape);
  kit.floor(b, corr); kit.floor(b, labShape, { mat: M.floor }); kit.floor(b, hydShape, { mat: M.floor });
  kit.ceiling(b, corr, CEIL); kit.ceiling(b, labShape, CEIL); kit.ceiling(b, hydShape, HYD.h);
  // Code seams across the ceilings, about every 2 m (thin trims between the light bands).
  const seams = (r0, r1, a0, a1, y) => {
    const rm = (r0 + r1) / 2; const n = Math.max(1, Math.round(((a1 - a0) * rm) / 2));
    for (let k = 1; k < n; k++) { const a = a0 + ((a1 - a0) * k) / n; band(r0, r1, a - 0.025 / rm, a + 0.025 / rm, y, kit.mats.trim, true); }
  };
  seams(R_IN, R_OUT, CA0, CA1, CEIL - 0.012); seams(LAB.r0, R_IN, labA0, labA1, CEIL - 0.012); seams(HYD.r0, R_IN, hydA0, hydA1, HYD.h - 0.012);

  // Light bands in the ceilings, and a lilac inlay down the corridor floor.
  band(37.2, 37.45, CA0 + 0.06, CA1 - 0.06, CEIL - 0.03, kit.mats.coveCool, true);
  band(39.05, 39.3, CA0 + 0.06, CA1 - 0.06, CEIL - 0.03, kit.mats.coveCool, true);
  band(38.3, 38.55, CA0 + 0.06, CA1 - 0.06, 0.012, kit.mats.accentLilac);
  band(27.4, 27.7, labA0 + 0.03, labA1 - 0.03, CEIL - 0.03, kit.mats.coveCool, true);
  band(33.0, 33.3, labA0 + 0.03, labA1 - 0.03, CEIL - 0.03, kit.mats.coveCool, true);
  band(22.2, 22.5, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);
  band(28.4, 28.7, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);
  band(34.4, 34.7, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);

  // Wall lights on the corridor's walls (one a facet, above the LCARS panels) and the lab's back wall.
  // Every other facet: a light on the even ones, a vent (low, on the wall) on the odd ones.
  const lightOn = (f) => kitFace(['props/Prop_Light_Small'], f.P, f.n, { y: 2.5, off: 0.1, pre: FLAT_TO_WALL });
  const ventOn = (f) => kitFace(['props/Prop_Vent_Small'], f.P, f.n, { y: 0.3, off: 0.02, pre: FLAT_TO_WALL, tint: VENT });
  const alt = (list) => list.forEach((f, i) => (i % 2 === 0 ? lightOn(f) : ventOn(f)));
  innerFacets.forEach((f, i) => { if (i % 2 === 0) lightOn(f); });
  alt(outerFacets.filter((f) => !f.pick));
  alt(labBack); alt(labSides);


  // LCARS panels on the corridor's inner wall (facing the corridor).
  const onWall = (obj, a, r, y) => { const [X, Z] = pol(a, r); obj.position.set(X, y, Z); obj.rotation.y = a; group.add(obj); };
  onWall(kit.screen(1.6, 0.9, { title: 'AIR', seed: 4, kind: 'map' }), Math.PI - 0.86, R_IN + 0.04, 1.6);
  onWall(kit.screen(1.4, 0.8, { title: 'LIFE', seed: 9, accent: PALETTE.teal }), Math.PI - 0.21, R_IN + 0.04, 1.6);
  onWall(kit.screen(1.4, 0.8, { title: 'FARM', seed: 12, accent: PALETTE.lilac }), Math.PI + 0.14, R_IN + 0.04, 1.6);
  onWall(kit.screen(1.6, 0.9, { title: 'DECK 2', seed: 7 }), Math.PI + 0.87, R_IN + 0.04, 1.6);

  // Star windows in the outer wall: the kit's recessed window, with the star field in front of its glass.
  for (const f of outerFacets) {
    if (!f.pick) continue;
    const win = kit.starWindow(3.2, 1.48, { seed: f.a < Math.PI ? 3 : 5 });
    place(win.mesh, frame(f.a, R_OUT + 0.6), 0, 1.83, 0, Math.PI);
    wins.push(win);
  }

  // The doors into the rooms (the kit's frames, set in the wall's corridor face), and their signs.
  const labFrame = pol(LAB.a, R_IN - 0.18); const hydFrame = pol(HYD.a, R_IN - 0.18);
  kitAt('platforms/Door_Frame_Square', labFrame[0], 0, labFrame[1], LAB.a, { sc: [0.7, 0.7, 0.7] });
  kitAt('platforms/Door_Frame_Square', hydFrame[0], 0, hydFrame[1], HYD.a, { sc: [0.7, 0.7, 0.7] }); // its top (3.5 m) fits under the corridor's ceiling
  const labDoor = kit.door(labFrame[0], labFrame[1], LAB.a, { w: 1.6, h: 2.3 });
  group.add(labDoor.group); doors.push(labDoor);
  const hydDoor = kit.door(hydFrame[0], hydFrame[1], HYD.a, { w: 1.6, h: 2.3 });
  group.add(hydDoor.group); doors.push(hydDoor);
  place(kit.sign('LAB', { w: 1.2, h: 0.3, color: PALETTE.peach }), lab, 0, 2.85, 0.24);
  place(kit.sign('HYDROPONICS', { w: 2.4, h: 0.34, color: PALETTE.teal }), hyd, 0, 3.1, 0.24);

  /**
   * A desk built in code (TNG style, as the bridge's): a bevelled plinth with a sloped front, its screen set into
   * the slope and a lit edge along the top. `ry` turns its front (+z) to where she should stand. Its solid is 1.5 x 0.85.
   */
  const SLOPE = -Math.atan(0.5);
  const deskAt = (f, x, z, { color = M.lab, screen = {} } = {}) => {
    const g = new THREE.Group(); const [X, Z] = f.at(x, z); const ry = f.a;
    g.position.set(X, 0, Z); g.rotation.y = ry;
    const at = (geo, mat, dx, dy, dz) => b.add(geo.translate(dx, dy, dz), mat, X, 0, Z, ry);
    at(profileGeo(1.5, CONSOLE), color, 0, 0, 0);
    at(new RoundedBoxGeometry(1.6, 0.07, 0.94, 2, 0.03), M.labDark, 0, 0.035, 0);
    at(new THREE.BoxGeometry(1.46, 0.02, 0.04), M.teal, 0, 0.805, 0.18);
    at(new THREE.BoxGeometry(1.46, 0.03, 0.03), M.teal, 0, 0.37, 0.41);
    at(new THREE.BoxGeometry(1.28, 0.48, 0.01).rotateX(SLOPE), kit.mats.black, 0, 0.589, 0.308);
    const s = kit.screen(1.2, 0.42, { seed: Math.round(X * 13 + Z * 7), ...screen });
    s.position.set(0, 0.596, 0.321); s.rotation.x = SLOPE;
    g.add(s); group.add(g);
    solids.push(rectIn(f, 1.5, 0.85, x, z));
    return g;
  };

  // ---- LAB: the air. Three algae tanks with bubbles, the ice splitter, the water loop, a work table.
  const tankZ = -9.4;
  const tanks = [-1.8, 0, 1.8].map((x) => { const [X, Z] = lab.at(x, tankZ); return { x: X, z: Z }; });
  for (const t of tanks) {
    // Each tank stands on a kit plate (2 m square, a quarter of the kit's 4 m tile).
    kitAt('platforms/Platform_Metal2', t.x, 0.01, t.z, lab.a, { sc: [0.5, 1, 0.5], tint: PLATE });
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 24), kit.mats.panel, t.x, 0.125 + 0.01, t.z);
    b.add(new THREE.CylinderGeometry(0.72, 0.72, 2.5, 24), kit.mats.glass, t.x, 1.5, t.z);
    b.add(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 20), M.algae, t.x, 1.3, t.z);
    b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24), kit.mats.trim, t.x, 2.76, t.z);
    solids.push({ disc: [t.x, t.z, 0.85] });
  }
  // A manifold along the tanks' front, with a riser to each (the pipe from the splitter).
  addIn(lab, new THREE.CylinderGeometry(0.07, 0.07, 3.8, 8).rotateZ(Math.PI / 2), kit.mats.metal, 0, 0.3, -8.25);
  for (const x of [-1.8, 0, 1.8]) addIn(lab, new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), kit.mats.metal, x, 0.15, -8.25);
  // Bubbles: one instanced mesh (one draw call), moved in update().
  const bubMesh = new THREE.InstancedMesh(kit.own(new THREE.SphereGeometry(0.035, 6, 4)), M.bubble, tanks.length * 9);
  bubMesh.frustumCulled = false; bubMesh.renderOrder = 2;
  group.add(bubMesh);
  tanks.forEach((t, ti) => {
    for (let k = 0; k < 9; k++) bubbles.push({ x: t.x, z: t.z, phase: (k * 0.37 + ti * 0.21) % 1, speed: 0.12 + 0.05 * ((k * 7 + ti) % 3) });
  });

  // The ice splitter, with a pipe to the first tank.
  boxIn(lab, 1.4, 1.9, 1.0, kit.mats.panel, -3.7, 0.95, -9.0);
  boxIn(lab, 1.5, 0.12, 1.1, kit.mats.trim, -3.7, 1.96, -9.0);
  addIn(lab, new THREE.CylinderGeometry(0.5, 0.5, 0.7, 20), kit.mats.glass, -3.7, 2.3, -9.0);
  const pipe = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8); pipe.rotateZ(Math.PI / 2);
  addIn(lab, pipe, kit.mats.metal, -2.85, 1.2, -9.4);
  // A riser from the hopper and a pipe run under the ceiling towards the water loop.
  addIn(lab, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), kit.mats.metal, -3.7, 2.85, -9.0);
  const run = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8); run.rotateX(Math.PI / 2);
  addIn(lab, run, kit.mats.metal, -3.7, 3.0, -7.8);
  place(kit.screen(0.9, 0.5, { title: 'ICE', seed: 15, accent: PALETTE.teal }), lab, -3.7, 1.35, -8.47);
  solids.push(rectIn(lab, 1.4, 1.0, -3.7, -9.0));

  // The water loop: three filter columns in a row (grit, algae, UV), labelled, with a pipe along their feet.
  const cols = [{ z: -2.6, name: 'GRIT' }, { z: -4.6, name: 'ALGAE' }, { z: -6.6, name: 'UV', uv: true }];
  kitIn(lab, 'platforms/Platform_Metal', -4, 0.01, -4.6, 0, { tint: PLATE }); // the loop's plate (4 m)
  for (const c of cols) {
    if (c.uv) {
      addIn(lab, new THREE.CylinderGeometry(0.42, 0.42, 2.3, 20), kit.mats.glass, -4, 1.15, c.z);
      addIn(lab, new THREE.CylinderGeometry(0.28, 0.28, 2.0, 16), M.uv, -4, 1.15, c.z);
    } else {
      // The kit's round column, squashed to a 0.84 m tank 2.3 m tall.
      kitIn(lab, 'columns/Column_Round', -4, 0, c.z, 0, { sc: [0.84, 0.46, 0.84] });
    }
    addIn(lab, new THREE.CylinderGeometry(0.55, 0.55, 0.2, 20), kit.mats.trim, -4, 0.1, c.z);
    addIn(lab, new THREE.CylinderGeometry(0.5, 0.5, 0.15, 20), kit.mats.trim, -4, 2.37, c.z);
    place(kit.sign(c.name, { w: 0.5, h: 0.2, color: c.uv ? PALETTE.lilac : PALETTE.peach }), lab, -3.58, 1.75, c.z, Math.PI / 2);
    solids.push(discIn(lab, 0.55, -4, c.z));
  }
  const loop = new THREE.CylinderGeometry(0.07, 0.07, 4.0, 8); loop.rotateX(Math.PI / 2);
  addIn(lab, loop, kit.mats.metal, -4, 0.5, -4.6);
  // Kit props: a computer and an access point on the lab's walls, crates and barrels by the tanks.
  kitIn(lab, 'props/Prop_Computer', -5.0, 0, -1.6, Math.PI / 2);
  kitIn(lab, 'props/Prop_Crate4', 3.9, 0, -9.7, 0.2);
  kitIn(lab, 'props/Prop_Crate4', 4.0, 0, -8.2, -0.3);
  kitIn(lab, 'props/Prop_Barrel_Large', -5.0, 0, -6.6, 0);
  kitIn(lab, 'props/Prop_ItemHolder', 2.2, 0, -1.8, 0.3);
  // Two cables on the floor, as code tubes (the kit's cable is 2.6k triangles).
  addIn(lab, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).rotateZ(Math.PI / 2), M.labDark, 1.2, 0.03, -2.4, 0.6);
  addIn(lab, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6).rotateZ(Math.PI / 2), M.labDark, 1.25, 0.03, -2.2, 0.6);
  kitFace(['props/Prop_AccessPoint'], pol(LAB.a - 0.12, LAB.r0), [Math.sin(LAB.a - 0.12), Math.cos(LAB.a - 0.12)], { y: 1.1, mode: 'min' });
  // A work table with screens, facing the door: our code-built console, on a plate.
  kitIn(lab, 'platforms/Platform_Metal2', 3.0, 0.01, -3.4, 0, { sc: [0.5, 1, 0.5], tint: PLATE });
  deskAt(lab, 3.0, -3.4, { screen: { title: 'WATER', seed: 6 } });
  // A map screen on the lab's back wall, beside the tanks (its face on the wall's inner face).
  onWall(kit.screen(1.2, 0.9, { title: 'O2', seed: 8, kind: 'map' }), LAB.a + 0.15, LAB.r0 + 0.04, 1.9);

  // ---- HYDROPONICS: grow racks under pink grow strips, a walkway with a water channel, fruit trees, the console.
  const RACK_Z = -7.4; const RACK_LEN = 12; // the rows run from z -1.4 to -13.4
  const plantGeo = kit.own(new THREE.SphereGeometry(0.26, 6, 4).scale(1, 0.8, 1)); // a lettuce head
  const cabbageGeo = kit.own(new THREE.SphereGeometry(0.24, 6, 4).scale(1, 0.5, 1)); // a flat cabbage (the second shape)
  const postGeo = kit.own(new THREE.CylinderGeometry(0.06, 0.06, 3, 6)); // a rack's post: 6 sides, 0.12 m thick, 3 m up
  // The walkway's plates (4 m tiles, 4 m wide, the racks' aisle) under the water channel.
  for (const z of [-3.4, -7.4, -11.4]) kitIn(hyd, 'platforms/Platform_Metal2', 0, 0.01, z, 0, { tint: PLATE });
  // Teal guide lines along the walkway's edges (the kit's line decal, tinted).
  for (const x of [-1.6, 1.6]) for (const z of [-3.4, -7.4, -11.4]) kitIn(hyd, 'decals/Decal_Line_Straight', x, 0.016, z, 0, { tint: PALETTE.teal });
  const RACKS = [-4.45, -2.55, 2.55, 4.45];
  for (const x of RACKS) {
    const [rx, rz] = hyd.at(x, RACK_Z);
    solids.push({ rect: [rx, rz, 1.1, RACK_LEN], rot: hyd.a });
    // The frame: a post at each corner (3 m up), and the shelves (the kit's plates, 1.1 m wide).
    for (const dx of [-0.5, 0.5]) for (const z of [-1.4, -13.4]) addIn(hyd, postGeo, kit.mats.metal, x + dx, 1.5, z);
    for (const y of [0.55, 1.55, 2.55]) {
      for (const z of [-3.4, -7.4, -11.4]) kitIn(hyd, 'platforms/Platform_Metal', x, y, z, 0, { sc: [0.275, 1, 1] });
      boxIn(hyd, 0.5, 0.03, RACK_LEN, M.grow, x, y - 0.07, RACK_Z);    // grow strip under it
      for (const z of [-3.4, -7.4, -11.4]) kitIn(hyd, 'props/Prop_Light_Wide', x, y - 0.25, z, Math.PI / 2); // the kit's fixtures
      // Plants every 0.9 m, in two shapes (a lettuce head, a flat cabbage), so the rows read at walk level.
      for (let k = 0; k < 13; k++) {
        for (const dx of [-0.28, 0.28]) {
          const [px, pz] = hyd.at(x + dx, -1.8 - k * 0.9);
          const leaf = [M.leafA, M.leafB, M.leafC][(k + (dx > 0 ? 1 : 0) + Math.round(y * 10)) % 3];
          b.add((k + (dx > 0 ? 1 : 0)) % 2 ? cabbageGeo : plantGeo, leaf, px, y + 0.14, pz);
        }
      }
    }
  }
  // The water channel down the walkway (she can walk over it), with stone edges.
  boxIn(hyd, 0.7, 0.02, 11.6, M.water, 0, 0.012, -7.4);
  for (const x of [-0.42, 0.42]) boxIn(hyd, 0.08, 0.1, 11.6, kit.mats.trim, x, 0.05, -7.4);
  // Fruit trees in pots, in the side aisles.
  for (const [x, z] of [[-6.3, -3.2], [6.3, -3.2], [-6.1, -8.4], [6.1, -8.4]]) {
    addIn(hyd, new THREE.CylinderGeometry(0.5, 0.45, 0.7, 20), kit.mats.wallDark, x, 0.35, z);
    addIn(hyd, new THREE.CylinderGeometry(0.1, 0.14, 1.4, 8), M.bark, x, 1.4, z);
    addIn(hyd, new THREE.SphereGeometry(0.95, 10, 7), M.leafB, x, 2.6, z);
    addIn(hyd, new THREE.SphereGeometry(0.6, 8, 6), M.leafC, x - 0.3 * Math.sign(x), 3.1, z - 0.3); // leans in, away from the wall
    for (const [fx, fy, fz] of [[0.75, 2.35, 0.45], [-0.55, 2.0, 0.7], [0.1, 2.9, -0.9]]) addIn(hyd, new THREE.SphereGeometry(0.13, 6, 5), kit.mats.accentOrange, x + fx, fy, z + fz);
    solids.push(discIn(hyd, 0.5, x, z));
  }
  // Air: a fan on the floor at the far aisle, a vent in the ceiling over the walkway.
  kitIn(hyd, 'props/Prop_Vent_Small', 0, HYD.h - 0.25, -4.0, 0, { tint: VENT });
  kitIn(hyd, 'props/Prop_Vent_Small', 0, HYD.h - 0.25, -10.8, 0, { tint: VENT });
  // The planning console at the far end, with a map screen on the wall behind it.
  deskAt(hyd, 0, -15.0, { screen: { title: 'FARM', seed: 12, accent: PALETTE.teal } });
  place(kit.screen(2.4, 1.2, { title: 'PLAN', seed: 13, kind: 'map', accent: PALETTE.teal }), hyd, 0, 2.3, -15.96);

  // Quest: pollen (the strawberry bed by the walkway; Mira stands by it, see crewSpots)
  const BED = { x: -1.2, z: -5.0 };
  const bloom = toon(0xffd6e0);
  boxIn(hyd, 1.2, 0.8, 1.8, kit.mats.trim, BED.x, 0.4, BED.z); // the planter
  boxIn(hyd, 1.0, 0.04, 1.6, M.leafA, BED.x, 0.82, BED.z);     // soil with leaves
  for (const [dx, dz] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0], [0.3, 0], [-0.3, 0.6], [0.3, 0.6]]) {
    addIn(hyd, new THREE.SphereGeometry(0.12, 8, 6), bloom, BED.x + dx, 0.98, BED.z + dz);
  }
  solids.push(rectIn(hyd, 1.2, 1.8, BED.x, BED.z));
  const bedLamp = lampIn(hyd, BED.x, BED.z, 1.3);
  // End of quest: pollen

  // The stations and the crewmate. Lamps sit on their props.
  const stations = {
    oxygen: { ...spotIn(lab, 0, -7.2, 0, tankZ), lamp: lampIn(lab, 0, tankZ, 3.0) },
    water: { ...spotIn(lab, -2.3, -4.6, -4.0, -4.6), lamp: lampIn(lab, -4.0, -4.6, 2.54) },
    food: { ...spotIn(hyd, 0, -13.2, 0, -15.0), lamp: lampIn(hyd, 0, -15.2, 0.92) },
    // Quest: pollen (she stands here; Mira stands by the bed, see crewSpots)
    pollen: { ...spotIn(hyd, 0.5, BED.z, BED.x, BED.z), lamp: bedLamp, y: 2.2 },
  };
  const crewSpots = {
    biologist: spotIn(lab, 2.0, -7.2, 1.8, tankZ),
    pollen: spotIn(hyd, 1.5, BED.z, BED.x, BED.z), // Mira, in the quest
  };

  // Set points for screenshots: the corridor, the lab, its tanks, the bay.
  const up = ([x, z], y) => [x, y, z]; // (x, z) plus a height, as [x, y, z]
  const views = [
    { name: 'corridor', pos: up(pol(Math.PI - 0.12, 38.2), 1.6), look: up(pol(Math.PI - 0.7, 38.2), 1.4) },
    { name: 'lab', pos: up(lab.at(0, -2.2), 1.7), look: up(lab.at(0, -9.5), 1.3) },
    { name: 'tanks', pos: up(lab.at(0.5, -5.6), 1.5), look: up(lab.at(0, -9.4), 1.3) },
    { name: 'farm', pos: up(hyd.at(0.3, -2.6), 2.2), look: up(hyd.at(0, -15), 1.3) }, // 1.4 m in from the door (the lab view had a dark slab top left, by the door)
    { name: 'farmback', pos: up(hyd.at(0.2, -13.2), 1.6), look: up(hyd.at(0, -1), 1.4) },
    // From the corridor, looking into each room through its door.
    { name: 'bayDoor', pos: up(pol(HYD.a, 38.4), 1.9), look: up(pol(HYD.a, 36.8), 2.7) },
    { name: 'labDoor', pos: up(pol(LAB.a, 39.45), 1.6), look: up(pol(LAB.a, 25), 1.4) },
    { name: 'bed', pos: up(hyd.at(-0.2, -2.6), 1.7), look: up(hyd.at(BED.x, BED.z), 0.9) },
  ];

  // Two warm point lights, the deck's allowance (the rest is the emissive strips): the farm walkway, and the tanks.
  for (const [f, x, y, z] of [[hyd, 0, 4.2, -7.4], [lab, 0, 3.2, -7]]) {
    const [X, Z] = f.at(x, z); const pl = new THREE.PointLight(0xfff1e0, 2.5, 0, 1); pl.position.set(X, y, Z); group.add(pl);
  }

  b.flush(group); // every static part above, one mesh per material

  const _m = new THREE.Matrix4(); const _p = new THREE.Vector3(); const _q = new THREE.Quaternion(); const _s = new THREE.Vector3();
  return {
    group, floors, solids, ceiling: 3.2, stations, crewSpots, views,
    update(dt, t, ctx) {
      for (const d of doors) d.update(dt, ctx.herX, ctx.herZ);
      for (const w of wins) w.update(t);
      // The grow lights and the algae breathe softly.
      M.grow.color.copy(growBase).multiplyScalar(0.88 + 0.12 * Math.sin(t * 1.3));
      M.algae.color.copy(algaeBase).multiplyScalar(0.92 + 0.08 * Math.sin(t * 2.1));
      // Bubbles rise in the tanks, shrinking at the top, and start again at the bottom.
      for (let i = 0; i < bubbles.length; i++) {
        const u = bubbles[i];
        const k = (t * u.speed + u.phase) % 1;
        _p.set(u.x + Math.sin(t * 1.7 + u.phase * 9) * 0.12, 0.25 + k * 2.2, u.z);
        _s.setScalar(0.6 + 0.4 * Math.sin(k * Math.PI));
        bubMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      bubMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { bubMesh.dispose(); }, // the bubble geometry and materials are kit-owned
  };
}
