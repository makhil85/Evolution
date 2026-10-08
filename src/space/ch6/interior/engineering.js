// Chapter 6 interior, deck 3: engineering and cargo (Star Trek TNG style: panelled
// walls, LCARS screens, light coves, a fusion core you can see into). Built from the
// sci-fi kit like the bridge: 4 m wall panels, each with its cornice on top and its
// floor trim, kit platforms and rails, Column_Pipes for the gallery; the fusion core,
// its climbing light rings and the coolant tank are our own. Without the kit (models
// failed to load) the same layout is drawn in plain code. Deck-local metres, floor
// y = 0, the lift at the origin, she steps out to +Z.
//
//   z 0..5    a corridor (2.95 wide between its walls) from the lift; the ENGINEERING sign over the hall door
//   z 5..23   MAIN ENGINEERING, 16 wide, 7 tall, chamfered corners at the lift end.
//             The fusion core at (0, 14): a glass column, a plasma core and light rings
//             that climb it, a ring railing on a kit dais; a ring gallery on the upper
//             level (seen from below, not walkable) with kit rails; the core console
//             (station 'energy'); a master systems table; wall consoles and pipes.
//   z 23..37  CARGO BAY, 14 wide, 5 tall: stacked crates, a loader, racks, a packing
//             console (station 'pack') and a big sealed outer door with warning stripes.
// Echo (signal) stands by the core console, Bolt (builder) by the crates.
// The coolant tank in the hall's near corner is the quest 'coolant' (Bolt leads it).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

// The kit pieces this deck uses (models.js names; loaded before the deck is built).
// Inlays and plates lie 2-9 mm above the floor: this offset makes them win the depth test there (no flicker).
const FLUSH = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
export const MODELS = [
  'walls/WallAstra_Straight', 'walls/BottomMetal_Straight', 'walls/TopPlastic_Straight',
  'columns/Column_Pipes',
  'platforms/Platform_Round1', 'platforms/Platform_Squares', 'platforms/Door_Frame_Square',
  'props/Prop_Rail_Round_Big', 'props/Prop_Computer', 'props/Prop_PipeHolder',
  'props/Prop_Light_Small', 'props/Prop_Light_Wide', 'props/Prop_Vent_Small',
  'props/Prop_Crate3', 'props/Prop_Crate4', 'props/Prop_Chest', 'props/Prop_Barrel_Large',
];

const CORE = { x: 0, z: 14 };
const HALL_H = 7;
const CARGO_H = 5;
const CORR_H = 3.2;
const CAP_H = 2.02;        // the kit's cornice (TopPlastic) is 2.02 m tall, from 3.00 m up
const BAND_SY = 2 / 3.02;  // a kit wall (3.02 m) squashed to a 2 m band
const SKIRT = 2.4;         // the kit's *_Dark skirts read black: lifted to grey
const PANEL = ['walls/WallAstra_Straight', 'walls/BottomMetal_Straight'];
const BARE = ['walls/WallAstra_Straight'];
const LIGHT = 'props/Prop_Light_Small';
const VENT = 'props/Prop_Vent_Small';
// A light or a vent lies flat in its own frame; this turns it so it stands on a wall (its thin side faces the room).
const FLAT_TO_WALL = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
const faceTo = (x, z, px, pz) => Math.atan2(px - x, pz - z); // the yaw that turns (x, z) to (px, pz)
const scaleM = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
// The wall lines (see standOn): t runs along each. The room face sits at F; the kit's pieces stand outward of it.
const LINE = {
  corrL: { C: [0, 0], a: -Math.PI / 2, F: 1.475, side: -1 },   // t = z
  corrR: { C: [0, 0], a: Math.PI / 2, F: 1.475, side: -1 },    // t = -z
  nearHall: { C: [0, 0], a: 0, F: 5.125, side: 1 },            // t = x, the hall's near wall (room beyond it)
  hallL: { C: [0, 0], a: -Math.PI / 2, F: 7.875, side: -1 },   // t = z
  hallR: { C: [0, 0], a: Math.PI / 2, F: 7.875, side: -1 },    // t = -z
  hallFar: { C: [0, 0], a: 0, F: 22.875, side: -1 },           // t = x
  chamR: { C: [5, 8], a: (3 * Math.PI) / 4, F: 2.04, side: -1 },   // the hall's right corner, a chamfer on a 4.1 m chord
  chamL: { C: [-5, 8], a: -(3 * Math.PI) / 4, F: 2.04, side: -1 }, // the hall's left corner
  cargoL: { C: [0, 0], a: -Math.PI / 2, F: 6.875, side: -1 },  // t = z
  cargoR: { C: [0, 0], a: Math.PI / 2, F: 6.875, side: -1 },   // t = -z
  cargoFar: { C: [0, 0], a: 0, F: 36.875, side: -1 },          // t = x
};
/** The cornice (TopPlastic) squashed to hc metres, its foot at 3 m (k: its length, as the panel's). */
const capPre = (k, hc = CAP_H) => new THREE.Matrix4().makeTranslation(0, 3, 0).multiply(scaleM(1, hc / CAP_H, k)).multiply(new THREE.Matrix4().makeTranslation(0, -3, 0));
/** The walk solid of a wall line from t0 to t1: 0.3 m thick, on the outside of its room face. */
function wallSolid({ C, a, F, side }, t0, t1) {
  const N = [Math.sin(a), Math.cos(a)]; const T = [Math.cos(a), -Math.sin(a)];
  const off = F - side * 0.15; const tm = (t0 + t1) / 2;
  return { rect: [C[0] + off * N[0] + tm * T[0], C[1] + off * N[1] + tm * T[1], t1 - t0, 0.3], rot: a };
}

export function buildDeck(kit) {
  const group = new THREE.Group();
  const mine = [];
  const own = (x) => { mine.push(x); return kit.own(x); };
  const { mats } = kit;
  const M = kit.models; // null when the kit did not load: the same layout in code
  const b = kit.batch();
  const toon = (color) => own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  const crateMat = toon(0xb8895a);
  const goldMat = toon(PALETTE.gold);
  const cardMat = toon(0xd9c3a0);
  const blueMat = toon(PALETTE.blue);
  const solids = [];
  const screens = []; // flicker in update()

  // --- the kit's pieces ------------------------------------------------------------------
  const skins = new Map();
  /** A kit material as this deck wants it: the black parts grey, the dark skirts lifted, a tint on decals. */
  const skinOf = (mat, tint = null) => {
    if (mat.name === 'M_Black') return mats.panel;
    const lift = mat.name?.endsWith('_Dark') ? SKIRT : 1;
    if (lift === 1 && !tint) return mat;
    const key = `${mat.uuid}|${tint}`;
    if (!skins.has(key)) {
      const m = mat.clone();
      if (lift !== 1) m.color.multiplyScalar(lift);
      if (tint) m.color.multiply(new THREE.Color(tint));
      skins.set(key, kit.own(tint ? Object.assign(m, FLUSH) : m));
    }
    return skins.get(key);
  };
  /** The parts of a kit piece as cloned geometry (`pre` turns or scales them first; the kit's own copies are not touched). */
  const partsOf = (name, { s = 1, pre = null, tint = null } = {}) => M.object(name).children.map((m) => {
    const g = m.geometry.clone();
    if (pre) g.applyMatrix4(pre);
    if (s !== 1) g.scale(s, s, s);
    return { g, mat: skinOf(m.material, tint) };
  });
  const boundsOf = (list) => {
    const box = new THREE.Box3();
    for (const { g } of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
    return box;
  };
  /** A free piece: its middle (x, z) on the floor at (x, z), its foot at y, turned ry. */
  const putPiece = (batch, name, x, y, z, ry = 0, { s = 1, pre = null, centre = true, tint = null } = {}) => {
    if (!M) return;
    const list = partsOf(name, { s, pre, tint });
    if (centre) {
      const box = boundsOf(list);
      for (const { g } of list) g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    }
    for (const { g, mat } of list) batch.add(g, mat, x, y, z, ry);
  };
  /**
   * Stand kit pieces on a wall line: the line is at distance F from C along the angle a (its points are
   * C + F (sin a, cos a)), and the room is on the side `side` of it (-1: towards C, +1: away from it).
   * The pieces' room face (their largest x) lands on the line and their middle on the point t along
   * it. The pieces of one wall share one origin: `ref` (default the first name) sets it, so a cornice
   * or a floor trim lines up with the panel it belongs to. `refPre` is the ref's own transform.
   */
  const standOn = (batch, names, { C = [0, 0], a, F, side, t = 0, y = 0, s = 1, pre = null, refPre = pre, ref = names[0] }) => {
    if (!M) return;
    const th = a - (side * Math.PI) / 2; // the piece's own x points into the room, its z along the wall
    const N = [Math.sin(a), Math.cos(a)]; const T = [Math.cos(a), -Math.sin(a)];
    const x = C[0] + F * N[0] + t * T[0]; const z = C[1] + F * N[1] + t * T[1];
    const box = boundsOf(partsOf(ref, { s, pre: refPre }));
    const sh = [-box.max.x, -box.min.y, -(box.min.z + box.max.z) / 2];
    for (const name of names) {
      for (const { g, mat } of partsOf(name, { s, pre })) { g.translate(sh[0], sh[1], sh[2]); batch.add(g, mat, x, y, z, th); }
    }
  };
  /**
   * A wall along a line, t from `from` to `to`: kit panels of about 4 m, each stretched a little to fit.
   * `trim` adds the floor trim, `cap` the cornice on top (true: the kit's 2 m; a number: that height),
   * `sy` squashes the panels (a band), `y` lifts them.
   */
  const wallRun = (batch, line, from, to, { trim = true, cap = 0, sy = 1, y = 0 } = {}) => {
    if (!M) return;
    const n = Math.max(1, Math.round((to - from) / 4)); const L = (to - from) / n; const k = L / 4;
    for (let i = 0; i < n; i++) {
      const t = from + (i + 0.5) * L;
      const pre = scaleM(1, sy, k);
      standOn(batch, trim ? PANEL : BARE, { ...line, t, y, pre });
      if (cap) standOn(batch, ['walls/TopPlastic_Straight'], { ...line, t, y, pre: capPre(k, cap === true ? CAP_H : cap), refPre: pre, ref: BARE[0] });
    }
  };
  /** A wall light or a vent on a line, at t and height y, its face a little proud of the wall. */
  const onWall = (batch, name, line, t, y) => standOn(batch, [name], { ...line, F: line.F + line.side * 0.1, t, y, pre: FLAT_TO_WALL });

  // --- floors and ceilings ---------------------------------------------------------------
  const corridor = { rect: [0, 2.5, 3.2, 5] };
  // The hall: a rounded near end (discs at its corners) and a square far end.
  const hall = [{ rect: [0, 15.5, 16, 15] }, { rect: [0, 6.5, 10, 3] }, { disc: [5, 8, 3] }, { disc: [-5, 8, 3] }];
  const cargo = { rect: [0, 30, 14, 14] };
  for (const s of [corridor, ...hall, cargo]) kit.floor(b, s, { mat: mats.deck });
  kit.ceiling(b, corridor, CORR_H);
  for (const s of hall) kit.ceiling(b, s, HALL_H);
  kit.ceiling(b, cargo, CARGO_H);
  // Ceiling seams (the kit has no ceiling cap): every 4 m across the hall and the bay.
  for (const z of [11.5, 15.5, 19.5]) b.box(16, 0.08, 0.1, mats.trim, 0, HALL_H - 0.04, z);
  for (const x of [-4, 4]) b.box(0.1, 0.08, 15, mats.trim, x, HALL_H - 0.04, 15.5);
  for (const z of [27, 31, 35]) b.box(14, 0.08, 0.1, mats.trim, 0, CARGO_H - 0.04, z);
  for (const x of [-3.5, 3.5]) b.box(0.1, 0.08, 14, mats.trim, x, CARGO_H - 0.04, 30);

  // --- walls -----------------------------------------------------------------------------
  // The wall runs (line, from, to). Each run that meets another wall at a joint goes 0.15 m past it, so no corner has a gap
  // (the doors are left open: their runs stop at the door).
  const J = 0.15;
  const CORR_RUNS = [[LINE.corrL, 0, 5 + J], [LINE.corrR, -5 - J, 0]];
  const HALL_RUNS = [[LINE.nearHall, -5 - J, -1.3], [LINE.nearHall, 1.3, 5 + J], [LINE.hallL, 8 - J, 23], [LINE.hallR, -23, -8 + J],
    [LINE.hallFar, -8 - J, -1.8], [LINE.hallFar, 1.8, 8 + J], [LINE.chamL, -2.035 - J, 2.035 + J], [LINE.chamR, -2.035 - J, 2.035 + J]];
  const CARGO_RUNS = [[LINE.cargoL, 23 - J, 37], [LINE.cargoR, -37, -23 + J], [LINE.cargoFar, -6.875 - J, 6.875 + J]];
  if (M) {
    // The corridor: 5 m a side, 3.2 m high, its cornice squashed to fit.
    for (const [line, t0, t1] of CORR_RUNS) wallRun(b, line, t0, t1, { cap: 0.2 });
    // The hall: its near wall either side of the corridor door, the sides, the chamfers, the far wall either side of the cargo door.
    for (const [line, from, to] of HALL_RUNS) {
      wallRun(b, line, from, to, { cap: true });
      // The upper band, 5 m to 7 m: the same panels squashed, with no trim.
      wallRun(b, line, from, to, { trim: false, sy: BAND_SY, y: 5 });
    }
    // The cargo bay: 5 m high, with a cornice and a trim all round.
    for (const [line, t0, t1] of CARGO_RUNS) wallRun(b, line, t0, t1, { cap: true });
  } else {
    kit.wall(b, -1.6, 0, -1.6, 5, { h: CORR_H }); kit.wall(b, 1.6, 0, 1.6, 5, { h: CORR_H });
    kit.wall(b, -5, 5, -1.3, 5, { h: HALL_H }); kit.wall(b, 1.3, 5, 5, 5, { h: HALL_H });
    b.box(2.6, HALL_H - 2.5, 0.25, mats.wall, 0, (2.5 + HALL_H) / 2, 5);
    kit.wall(b, -8, 8, -8, 23, { h: HALL_H }); kit.wall(b, 8, 8, 8, 23, { h: HALL_H });
    kit.wallArc(b, 5, 8, 3, Math.PI / 2, Math.PI, { h: HALL_H });
    kit.wallArc(b, -5, 8, 3, Math.PI, Math.PI * 1.5, { h: HALL_H });
    kit.wall(b, -8, 23, -1.8, 23, { h: HALL_H }); kit.wall(b, 1.8, 23, 8, 23, { h: HALL_H });
    b.box(3.6, HALL_H - 3.6, 0.25, mats.wall, 0, (3.6 + HALL_H) / 2, 23);
    kit.wall(b, -7, 23, -7, 37, { h: CARGO_H }); kit.wall(b, 7, 23, 7, 37, { h: CARGO_H });
    kit.wall(b, -7, 37, 7, 37, { h: CARGO_H });
  }
  // The walls are solids (on the outside of their room faces; the lintels are over the doors, so they block nothing).
  for (const [line, t0, t1] of [...CORR_RUNS, ...HALL_RUNS, ...CARGO_RUNS]) solids.push(wallSolid(line, t0, t1));

  // The corridor's doorframe and the hall's door (kit.door draws the sliding leaves in it). The lintels over the
  // doors are plain panels with a trim (the kit's dark skirt stretched over them reads as a black block).
  putPiece(b, 'platforms/Door_Frame_Square', 0, 0, 5, 0, { s: 0.5 });
  b.box(2.6, HALL_H - 2.5, 0.3, mats.wall, 0, (2.5 + HALL_H) / 2, 5.0);
  b.box(2.7, 0.12, 0.34, mats.trim, 0, 2.5, 5.0);
  b.box(3.7, HALL_H - 3.6, 0.3, mats.wall, 0, (3.6 + HALL_H) / 2, 23.0);
  b.box(3.8, 0.12, 0.34, mats.trim, 0, 3.6, 23.0);

  // Pipes and conduits: the plumbing the hall is built round.
  for (const x of [-7.62, 7.62]) b.cyl(0.22, 0.22, 15, mats.metal, x, 6.1, 15.5, { rx: Math.PI / 2 });
  for (const z of [9.0, 21.5]) b.cyl(0.18, 0.18, 15.6, mats.metal, 0, 6.4, z, { rz: Math.PI / 2 });
  for (const x of [-6.62, 6.62]) b.cyl(0.2, 0.2, 14, mats.metal, x, 4.2, 30, { rx: Math.PI / 2 });

  // --- main engineering: the fusion core ------------------------------------------------
  const { x: cx, z: cz } = CORE;
  // A kit dais (6 m, its top at 0.14 m) under the core, with a floor plate on the hall's floor by the cargo door.
  putPiece(b, 'platforms/Platform_Round1', cx, 0, cz);
  putPiece(b, 'platforms/Platform_Squares', 0, 0.004, 20.5, 0, { tint: 0xffffff }); // white tint: a copy with FLUSH
  const inlayBlue = own(Object.assign(mats.accentBlue.clone(), FLUSH));
  b.add(new THREE.RingGeometry(6.4, 6.5, 64).rotateX(-Math.PI / 2), inlayBlue, cx, 0.006, cz); // a thin inlay round the dais
  b.cyl(2.1, 2.2, 0.35, mats.metal, cx, 0.175, cz); // plinth
  b.add(new THREE.RingGeometry(2.6, 2.8, 64).rotateX(-Math.PI / 2), inlayBlue, cx, M ? 0.15 : 0.01, cz); // floor ring
  b.cyl(0.9, 0.9, 6.55, mats.glass, cx, 3.625, cz, { seg: 32 }); // the glass column, 0.35 to 6.9
  for (const y of [0.35, 6.9]) b.add(new THREE.TorusGeometry(0.9, 0.05, 8, 40).rotateX(Math.PI / 2), mats.metal, cx, y, cz);
  // The railing round the core (its footprint is solid, below): four kit quarter rails, 2.3 m out, 1 m high.
  for (let q = 0; q < 4; q++) putPiece(b, 'props/Prop_Rail_Round_Big', cx, 0, cz, (q * Math.PI) / 2, { pre: scaleM(2.3 / 4, 1.16, 2.3 / 4), centre: false });
  if (!M) {
    b.add(new THREE.TorusGeometry(2.3, 0.05, 6, 56).rotateX(Math.PI / 2), mats.trim, cx, 1.0, cz);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      b.cyl(0.04, 0.04, 1.0, mats.trim, cx + Math.sin(a) * 2.3, 0.5, cz + Math.cos(a) * 2.3);
    }
  }
  solids.push({ disc: [cx, cz, 2.4] });

  // The plasma and its light rings are animated, so they are their own meshes.
  const plasma = kit.glow(0x5fe8ff, 1.7); // the core only: the one thing that blooms
  const plasmaBase = new THREE.Color(0x5fe8ff);
  const plasmaCore = new THREE.Mesh(own(new THREE.CylinderGeometry(0.42, 0.42, 5.9, 24)), plasma);
  plasmaCore.position.set(cx, 3.65, cz);
  group.add(plasmaCore);
  // Light rings climb the column. Basic material below bloom range, so they read as lit, not glowing.
  // The six rings are one instanced mesh (one draw call); their matrices are set by setRings().
  const ringMat = own(new THREE.MeshBasicMaterial({ color: 0x8ff4ff }));
  const ringGeo = own(new THREE.TorusGeometry(0.93, 0.035, 8, 40).rotateX(Math.PI / 2));
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, 6);
  rings.frustumCulled = false;
  group.add(rings);
  const ringM = new THREE.Matrix4(); const ringP = new THREE.Vector3(); const ringS = new THREE.Vector3(); const ringQ = new THREE.Quaternion();
  /** Each ring climbs the column (0.6 m to 6.6 m) and is hidden (scale 0) at the very top and bottom of its climb. */
  const setRings = (t) => {
    for (let i = 0; i < 6; i++) {
      const u = (t * 0.3 + i / 6) % 1;
      const k = u > 0.04 && u < 0.96 ? 1 + 0.05 * Math.sin(Math.PI * u) : 0; // radius 0.93..0.98: just outside the glass (0.9)
      ringP.set(cx, 0.6 + u * 6.0, cz); ringS.setScalar(k);
      rings.setMatrixAt(i, ringM.compose(ringP, ringQ, ringS));
    }
    rings.instanceMatrix.needsUpdate = true;
  };
  setRings(0);
  b.add(new THREE.RingGeometry(0.95, 1.1, 40).rotateX(-Math.PI / 2), ringMat, cx, 0.36, cz); // a ring on the plinth

  // The upper level: a ring walkway and railing, seen from below (decoration, not walkable).
  const GY = 4.0;
  // The underside is light (it is lit from below only) with a cool light band round it.
  // The underside: eight 45-degree wedges, alternating panel and trim, and a trim rim at its outer edge.
  for (let i = 0; i < 8; i++) {
    b.add(new THREE.RingGeometry(4.0, 5.4, 8, 1, (i * Math.PI) / 4, Math.PI / 4).rotateX(Math.PI / 2), i % 2 ? mats.trim : mats.panel, cx, GY - 0.12, cz);
  }
  b.add(new THREE.TorusGeometry(5.4, 0.05, 6, 64).rotateX(Math.PI / 2), mats.trim, cx, GY - 0.12, cz);
  b.add(new THREE.RingGeometry(4.45, 4.57, 64).rotateX(Math.PI / 2), mats.coveCool, cx, GY - 0.14, cz);
  // Kit rails round the walkway, at its inner and outer edges (each a ring of four quarters, 1 m high).
  for (const r of [4.0, 5.4]) {
    for (let q = 0; q < 4; q++) putPiece(b, 'props/Prop_Rail_Round_Big', cx, GY, cz, (q * Math.PI) / 2, { pre: scaleM(r / 4, 1.16, r / 4), centre: false });
    if (!M) {
      b.add(new THREE.TorusGeometry(r, 0.05, 6, 64).rotateX(Math.PI / 2), mats.trim, cx, GY + 1.0, cz);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        b.cyl(0.04, 0.04, 1.0, mats.trim, cx + Math.sin(a) * r, GY + 0.5, cz + Math.cos(a) * r);
      }
    }
  }
  // Four pillars hold the gallery up (solid): Column_Pipes, squashed to the gap under the gallery.
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = cx + dx * 3.3; const pz = cz + dz * 3.3;
    if (M) putPiece(b, 'columns/Column_Pipes', px, 0, pz, 0, { pre: scaleM(0.7, (GY - 0.12) / 5, 0.7) });
    else b.cyl(0.3, 0.3, GY - 0.12, mats.trim, px, (GY - 0.12) / 2, pz);
    solids.push({ disc: [px, pz, 0.45] });
  }

  // The master systems table: a flat top with the ship's schematic on it.
  const T = { x: -4.6, z: 19.2, w: 3.0, d: 1.8 };
  b.box(T.w, 0.9, T.d, mats.panel, T.x, 0.45, T.z);
  b.box(T.w + 0.1, 0.06, T.d + 0.1, mats.trim, T.x, 0.93, T.z);
  solids.push({ rect: [T.x, T.z, T.w + 0.1, T.d + 0.1] });
  const table = kit.screen(2.6, 1.4, { kind: 'map', seed: 31 });
  table.position.set(T.x, 0.97, T.z); table.rotation.x = -Math.PI / 2;
  group.add(table); screens.push(table);

  // The core console (station 'energy'): its front faces the lift side, where she stands.
  const energy = kit.console(cx, 10.6, Math.PI, { w: 2.4, screen: { title: 'POWER', seed: 21 } });
  group.add(energy.group); solids.push(energy.solid); screens.push(energy.screen);
  // The lamp rides a short post at the desk's end, beside the screen.
  b.cyl(0.04, 0.04, 0.19, mats.trim, cx - 1.17, 0.955, 10.6);
  const energyLamp = kit.lamp(); energyLamp.position.set(cx - 1.17, 1.12, 10.6); group.add(energyLamp);

  for (const [x, ry, title] of [[-7.85, Math.PI / 2, 'SHIELD'], [7.85, -Math.PI / 2, 'SENSORS']]) {
    const p = kit.screen(1.5, 0.9, { title, kind: 'panel', seed: Math.round(x * 17) });
    p.position.set(x, 2.1, 16.6); p.rotation.y = ry; group.add(p); screens.push(p);
  }
  // Wall consoles, kit computers against the walls (their screens are the kit's): three a side, and pipe racks
  // under the sensor panels. Each is a solid of its footprint.
  for (const [side, ry] of [[-1, Math.PI / 2], [1, -Math.PI / 2]]) {
    for (const z of [9.6, 12.5, 20.6]) {
      putPiece(b, 'props/Prop_Computer', side * 7.6, 0, z, ry); // its 0.56 m depth against the wall
      solids.push({ rect: [side * 7.6, z, 0.74, 0.56], rot: ry });
    }
    putPiece(b, 'props/Prop_PipeHolder', side * 7.3, 0, 16.6, ry); // 1.16 m deep, against the wall
    solids.push({ rect: [side * 7.3, 16.6, 4.12, 1.16], rot: ry });
  }
  if (M) {
    for (const [line, t] of [[LINE.hallL, 10.0], [LINE.hallL, 19.0], [LINE.hallR, -10.0], [LINE.hallR, -19.0]]) onWall(b, LIGHT, line, t, 2.4);
    for (const [line, t] of [[LINE.hallL, 22.3], [LINE.hallR, -22.3]]) onWall(b, VENT, line, t, 0.4);
  }
  // Two barrels a side in the hall's far corners, as engine-room clutter (the kit's barrels, no new materials).
  for (const [x, z] of [[-6.4, 21.6], [-5.7, 22.2], [6.4, 21.6], [5.7, 22.2]]) {
    putPiece(b, 'props/Prop_Barrel_Large', x, 0, z, 0.4);
    solids.push({ rect: [x, z, 0.55, 0.55], rot: 0 });
  }

  // Quest: coolant (the tank, its screen and lamp; the quest's spots are below). A coolant tank: a round tank with a
  // domed top, two light bands, a valve, a teal glow on its floor ring, and two pipes running to the wall (no pedestal).
  const TANK = { x: -4.2, z: 6.2 };
  b.add(new THREE.LatheGeometry([[0, 0], [0.56, 0], [0.56, 0.12], [0.5, 0.16], [0.5, 1.5], [0.42, 1.66], [0.2, 1.74], [0.1, 1.8], [0, 1.82]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 24), mats.metal, TANK.x, 0, TANK.z);
  for (const y of [0.5, 1.1]) b.add(new THREE.TorusGeometry(0.52, 0.035, 8, 32).rotateX(Math.PI / 2), mats.wall, TANK.x, y, TANK.z);
  b.cyl(0.08, 0.08, 0.2, mats.trim, TANK.x, 1.9, TANK.z, { seg: 12 }); // the valve on top
  // Two pipes from the tank's west side, ending 1.8 m short of the chamfer wall (at x -6.0).
  const pipeLen = (TANK.x - 0.5) - (-6.0); const pipeX = ((TANK.x - 0.5) + (-6.0)) / 2;
  for (const y of [0.6, 1.25]) b.cyl(0.06, 0.06, pipeLen, mats.trim, pipeX, y, TANK.z, { rz: Math.PI / 2, seg: 12 });
  b.add(new THREE.RingGeometry(0.62, 0.8, 40).rotateX(-Math.PI / 2), kit.glow(PALETTE.teal, 1.2), TANK.x, 0.01, TANK.z); // the teal glow on the floor
  solids.push({ disc: [TANK.x, TANK.z, 0.56] });
  const tankScreen = kit.screen(0.8, 0.5, { title: 'COOLANT', seed: 33, accent: PALETTE.teal });
  tankScreen.position.set(TANK.x + 0.51, 1.1, TANK.z); tankScreen.rotation.y = Math.PI / 2; group.add(tankScreen); screens.push(tankScreen);
  // The lamp: a bigger gold glow on top of the valve (the station's lamp, the shell recolours its material).
  const coolLamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 16, 10)), kit.glow(PALETTE.gold, 1.6));
  coolLamp.position.set(TANK.x, 2.1, TANK.z); group.add(coolLamp);
  // End of quest: coolant

  // --- cargo bay -------------------------------------------------------------------------
  // Crates, chests and barrels: each footprint is solid, and a stacked one sits on the one below.
  const stock = [
    ['props/Prop_Crate4', 3.6, 0, 31.0, 0.2, 1.12, 1.12], ['props/Prop_Crate4', 5.5, 0, 31.2, -0.1, 1.12, 1.12],
    ['props/Prop_Crate3', 5.45, 1.12, 31.15, 0.1, 1.0, 1.0], ['props/Prop_Crate4', 3.8, 0, 33.8, 0, 1.12, 1.12],
    ['props/Prop_Crate3', 4.95, 0, 33.8, 0.2, 1.0, 1.0], ['props/Prop_Chest', 2.5, 0, 34.6, 0, 1.5, 0.75],
    ['props/Prop_Crate4', 6.0, 0, 35.3, 0.3, 1.12, 1.12], ['props/Prop_Barrel_Large', 1.2, 0, 31.4, 0, 0.55, 0.55],
    ['props/Prop_Barrel_Large', 1.3, 0, 32.5, 0, 0.55, 0.55],
  ];
  for (const [name, x, y, z, ry, w, d] of stock) {
    putPiece(b, name, x, y, z, ry);
    if (y === 0) solids.push({ rect: [x, z, w, d], rot: ry });
  }
  // A cargo floodlight on each side wall, and floor plates: under the middle of the bay, and three by the loader and the racks.
  if (M) for (const line of [LINE.cargoL, LINE.cargoR]) onWall(b, 'props/Prop_Light_Wide', line, line === LINE.cargoL ? 35.2 : -35.2, 2.4);
  putPiece(b, 'platforms/Platform_Squares', 0, 0.004, 27.6);
  putPiece(b, 'platforms/Platform_Squares', -4.2, 0.004, 30.5);
  putPiece(b, 'platforms/Platform_Squares', 4.2, 0.004, 29.6);

  // A forklift by the outer door, built from rounded parts (its front is +z): a gold body, an overhead guard, a seat and a
  // steering wheel, a mast of two uprights with a carriage, two tapered forks, black tyres with metal hubs (the front pair smaller).
  const L = { x: -4.6, z: 34.6 };
  b.add(new RoundedBoxGeometry(2.2, 0.8, 2.8, 2, 0.12), goldMat, L.x, 0.6, L.z - 0.2); // body
  for (const dx of [-0.95, 0.95]) for (const dz of [-1.5, 0.2]) b.cyl(0.05, 0.05, 1.8, mats.trim, L.x + dx, 1.9, L.z + dz); // guard posts
  b.add(new RoundedBoxGeometry(2.0, 0.1, 1.9, 2, 0.04), goldMat, L.x, 2.8, L.z - 0.65); // roof
  b.add(new RoundedBoxGeometry(0.55, 0.12, 0.55, 2, 0.04), mats.panel, L.x, 1.1, L.z - 0.9); // seat
  b.add(new RoundedBoxGeometry(0.55, 0.5, 0.1, 2, 0.03), mats.panel, L.x, 1.4, L.z - 1.2); // seat back
  b.add(new THREE.TorusGeometry(0.18, 0.02, 6, 20).rotateX(-Math.PI / 3), mats.black, L.x, 1.5, L.z - 0.55); // steering wheel
  for (const dx of [-0.5, 0.5]) b.add(new RoundedBoxGeometry(0.14, 2.3, 0.14, 2, 0.03), mats.metal, L.x + dx, 1.45, L.z + 1.35); // mast uprights
  b.add(new RoundedBoxGeometry(1.2, 0.8, 0.12, 2, 0.03), mats.metal, L.x, 1.5, L.z + 1.42); // carriage plate
  for (const dx of [-0.5, 0.5]) {
    const fork = new THREE.BoxGeometry(0.12, 0.1, 1.3); // tapered: its tip is half as deep
    const p = fork.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setY(i, p.getY(i) * 0.5);
    b.add(fork, mats.metal, L.x + dx, 0.25, L.z + 2.1);
  }
  for (const [dx, dz, r, w] of [[-1.15, -1.0, 0.35, 0.3], [1.15, -1.0, 0.35, 0.3], [-1.1, 0.95, 0.25, 0.22], [1.1, 0.95, 0.25, 0.22]]) {
    b.cyl(r, r, w, mats.black, L.x + dx, r, L.z + dz, { rz: Math.PI / 2, seg: 16 }); // tyre
    b.cyl(r * 0.4, r * 0.4, w + 0.02, mats.metal, L.x + dx, r, L.z + dz, { rz: Math.PI / 2, seg: 12 }); // hub
  }
  solids.push({ rect: [L.x, L.z, 2.4, 3.0] }, { rect: [L.x, L.z + 1.85, 1.4, 0.8] });

  // Shelving racks with supplies: along the left wall, and by the cargo door on the right. The boxes are rounded and
  // of four sizes, with a trim label band; the lower shelf has a small crate at its end.
  const BOX_SIZES = [[0.46, 0.3, 0.4], [0.56, 0.4, 0.44], [0.38, 0.26, 0.36], [0.5, 0.34, 0.48]]; // [depth, height, width along the shelf]
  const rack = (x, z, len) => {
    for (const dz of [-len / 2, len / 2]) for (const dx of [-0.4, 0.4]) b.box(0.06, 2.4, 0.06, mats.panel, x + dx, 1.2, z + dz);
    [0.5, 1.2, 1.9].forEach((y, row) => {
      b.box(0.9, 0.06, len, mats.trim, x, y, z);
      const end = len / 2 - (row === 0 ? 0.9 : 0.2); // the lower shelf keeps its end for the crate
      let i = 0;
      for (let s = -len / 2 + 0.2; s < end; i++) {
        const [dep, h, w] = BOX_SIZES[(i + row) % BOX_SIZES.length];
        if (s + w > end) break;
        const mat = [cardMat, crateMat, blueMat][(i + row) % 3]; const off = i % 2 ? 0.08 : -0.06;
        b.add(new RoundedBoxGeometry(dep, h, w, 2, 0.03), mat, x + off, y + 0.03 + h / 2, z + s + w / 2);
        b.box(0.02, h * 0.25, w * 0.6, mats.trim, x + off + dep / 2 + 0.01, y + 0.03 + h * 0.7, z + s + w / 2); // the label band
        s += w + 0.08;
      }
    });
    putPiece(b, 'props/Prop_Crate3', x, 0.53, z + len / 2 - 0.5, 0, { s: 0.4 });
    solids.push({ rect: [x, z, 0.9, len] });
  };
  rack(-6.1, 29.5, 7.0);
  rack(6.1, 25.9, 3.4);

  // The packing desk (station 'pack'): three kit computers in a row along its 2.2 m front (its front faces the spot, at
  // -x); the lamp on a short post at the desk's end, as the core's.
  for (const z of [32.5, 33.2, 33.9]) putPiece(b, 'props/Prop_Computer', 0, 0, z, -Math.PI / 2);
  solids.push({ rect: [0, 33.2, 2.2, 0.85], rot: -Math.PI / 2 });
  b.cyl(0.04, 0.04, 0.19, mats.trim, 0, 0.955, 34.28);
  const packLamp = kit.lamp(); packLamp.position.set(0, 1.12, 34.28); group.add(packLamp);

  // The big outer door at the far end: a kit frame round a sealed hatch with warning stripes.
  const stripes = document.createElement('canvas'); stripes.width = 512; stripes.height = 512;
  const sg = stripes.getContext('2d');
  sg.fillStyle = '#1d2028'; sg.fillRect(0, 0, 512, 512);
  sg.fillStyle = '#ffc65a';
  for (let k = -512; k < 512; k += 128) { sg.beginPath(); sg.moveTo(k, 512); sg.lineTo(k + 64, 512); sg.lineTo(k + 576, 0); sg.lineTo(k + 512, 0); sg.closePath(); sg.fill(); }
  const stripeTex = own(new THREE.CanvasTexture(stripes)); stripeTex.colorSpace = THREE.SRGBColorSpace;
  const hatch = new THREE.Mesh(own(new THREE.PlaneGeometry(3.8, 3.6)), own(new THREE.MeshToonMaterial({ map: stripeTex, gradientMap: toonRamp })));
  hatch.position.set(0, 1.8, 36.6); hatch.rotation.y = Math.PI; group.add(hatch);
  putPiece(b, 'platforms/Door_Frame_Square', 0, 0, 36.6, 0, { s: 0.9 });
  if (!M) {
    b.box(4.5, 0.2, 0.12, mats.trim, 0, 3.7, 36.9);
    for (const x of [-2.1, 2.1]) b.box(0.2, 3.8, 0.12, mats.trim, x, 1.9, 36.9);
  }
  const sealed = kit.sign('Outer door sealed', { w: 3.0, h: 0.36, color: PALETTE.gold });
  sealed.position.set(0, 4.72, 36.3); sealed.rotation.y = Math.PI; group.add(sealed);

  // Floor marking: a gold band across the bay in front of the outer door (one strip in the forklift's gold, no extra draw call).
  b.box(12, 0.01, 0.22, goldMat, 0, 0.006, 35.6);

  // Signs: ENGINEERING over the corridor door, CARGO BAY over the cargo door.
  const engSign = kit.sign('Engineering', { w: 2.4, h: 0.36 });
  engSign.position.set(0, 2.95, 3.8); engSign.rotation.y = Math.PI; group.add(engSign);
  const cargoSign = kit.sign('Cargo bay', { w: 1.8, h: 0.36 });
  cargoSign.position.set(0, 3.9, 22.8); cargoSign.rotation.y = Math.PI; group.add(cargoSign);

  // Doors: the corridor door into the hall, the wide door into the cargo bay (its frame from the kit).
  putPiece(b, 'platforms/Door_Frame_Square', 0, 0, 23, 0, { s: 0.72 });
  const hallDoor = kit.door(0, 5, 0, { w: 2.2, h: 2.4 });
  const cargoDoor = kit.door(0, 23, 0, { w: 3.2, h: 3.0 });
  group.add(hallDoor.group, cargoDoor.group);

  // The corridor's wall light, on the right.
  if (M) onWall(b, LIGHT, LINE.corrR, -2.5, 2.4);

  // The hall's two weak point lights (the deck's allowance): by the coolant tank, beside the corridor door (it lights the
  // quest's corner, and sits well off the core, so the core view stays under the brightness ceiling), and in the cargo bay.
  const coreLight = new THREE.PointLight(0xfff1e0, 2.0, 0, 1); coreLight.position.set(-3.2, 5.6, 7.2); group.add(coreLight);
  const cargoLight = new THREE.PointLight(0xfff1e0, 1.0, 0, 1); cargoLight.position.set(0, 3.8, 30); group.add(cargoLight);

  b.flush(group);

  // --- what she uses ---------------------------------------------------------------------
  const stations = {
    energy: { x: cx, z: 9.4, face: 0, lamp: energyLamp },
    pack: { x: -1.2, z: 33.2, face: Math.PI / 2, lamp: packLamp },
    // Quest: coolant (she stands here; Bolt stands by the tank, see crewSpots)
    coolant: { x: -2.2, z: 6.6, face: faceTo(-2.2, 6.6, TANK.x, TANK.z), lamp: coolLamp, y: 2.2 },
  };
  const crewSpots = {
    signal: { x: 2.0, z: 9.6, face: faceTo(2.0, 9.6, cx, 10.6) },
    builder: { x: 1.9, z: 29.6, face: faceTo(1.9, 29.6, 4.0, 32.5) },
    coolant: { x: -3.0, z: 7.7, face: faceTo(-3.0, 7.7, -2.2, 6.6) }, // Bolt, in the quest
  };
  const views = [
    { name: 'engineering', pos: [-3.4, 3.0, 6.4], look: [0.6, 2.6, 16.5] },
    { name: 'core', pos: [-2.4, 1.3, 11.6], look: [0, 3.6, 14] },
    { name: 'corridor', pos: [0, 1.7, 0.6], look: [0, 1.9, 6.0] },
    { name: 'cargo', pos: [-5.2, 2.4, 24.6], look: [1.5, 1.6, 35.5] },
    { name: 'outer', pos: [-1.0, 1.7, 30.0], look: [0, 2.0, 37.0] },
    { name: 'coolant', pos: [1.2, 1.7, 6.6], look: [TANK.x, 1.0, TANK.z] }, // Quest: coolant, in the hall by the tank
  ];

  const floors = [corridor, ...hall, cargo];
  return {
    group,
    floors,
    solids,
    ceiling: HALL_H,
    stations,
    crewSpots,
    views,
    update(dt, t, ctx) {
      hallDoor.update(dt, ctx.herX, ctx.herZ);
      cargoDoor.update(dt, ctx.herX, ctx.herZ);
      // The core breathes, and its light rings climb the column and fade at the ends.
      plasma.color.copy(plasmaBase).multiplyScalar(1.6 + 0.2 * Math.sin(t * 2.4));
      const s = 1 + 0.05 * Math.sin(t * 2.4); plasmaCore.scale.set(s, 1, s);
      setRings(t);
      // The screens flicker gently, each out of step with the next.
      for (let i = 0; i < screens.length; i++) screens[i].material.color.setScalar(1.12 + 0.04 * Math.sin(t * 6 + i * 1.7));
    },
    dispose() { for (const x of mine) x.dispose?.(); },
  };
}
