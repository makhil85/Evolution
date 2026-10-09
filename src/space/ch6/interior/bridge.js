// Chapter 6 interior: Deck 1, the bridge (Star Trek TNG style, lead 2026-10-08).
// From the lift a short corridor (7.4 m, 3.65 m wide, bending gently) ends at a
// sliding door in the bridge's back wall. The bridge is a round room, 18 m across,
// built from the sci-fi kit: 4 m white panels on flat facets (each with its cornice
// and floor trim), so the wall reads as a ring of panels, 5 m high under a domed
// ceiling (the light rings are ours). Its front is the viewscreen (9.5 m wide,
// framed by two pilasters); the helm and ops consoles stand in front of the
// captain's chair in the centre, with their operators' chairs between. A curved
// rail behind the chairs marks the raised back half-ring: the floor stays flat,
// the rail and a lit step strip show the level, and the rail is open at the two
// sides (she walks round it). The shield console sits on the rail. Two science
// bays open off the sides. Without the kit (models failed to load) the same layout
// is drawn in plain code.
//
// The bridge is built in its own frame (metres from its centre, +z to the
// viewscreen, turned by the corridor's bend) and converted to deck metres for the
// walk map. The static parts go in one batch; the screens and the star window
// are their own meshes so they can move.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './kit.js';
import { toonRamp } from '../../../game/toonPipeline.js';
import { roofAt } from './walkmap.js';

// The kit pieces this deck uses (models.js names; loaded before the deck is built).
// Inlays, decals and plates lie a few mm to 15 cm above the floor: this offset makes them win the depth test there (no flicker).
const FLUSH = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
export const MODELS = [
  'walls/WallAstra_Straight', 'walls/WallBand_Straight', 'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight',
  'columns/Column_Round',
  'platforms/Platform_Metal_Curve', 'decals/Decal_1', 'decals/Decal_Logo',
  'props/Prop_Light_Small', 'props/Prop_Vent_Small', 'props/Prop_Vent_Wide', 'props/Prop_Rail_Round_Big',
  'props/Prop_Crate4', 'props/Prop_Barrel_Large', 'props/Prop_Cable_1',
  'platforms/Door_Frame_Square',
];

const R = 9;                  // the round wall's corners reach 9 m from the centre (18 m across)
const A = 8.75;               // its flat faces: the room's edge (each 4 m panel is a chord of the circle)
const RIM = 5;                // the wall top: a 3 m panel and a 2 m cornice (Top*)
const APEX = 6.4;             // the dome's top
const RF = 8.7;               // the raised half-ring's outer edge, where the wall's solid begins
const RR = 4.6;               // the tactical rail, behind the chairs
const BAY_W = 2.6;            // science bays: half-width, and their far wall at BAY_X
const BAY_X = 15;
const GAP_BAY = Math.asin(BAY_W / R);
const GAP_DOOR = Math.asin(1.7 / R);
// The dome: a shallow sphere cap from the rim (RIM) up to the apex; its radius, and the roof at r from the hub.
const DOME_RS = (R * R + (APEX - RIM) ** 2) / (2 * (APEX - RIM));
const domeAt = (r) => APEX - DOME_RS + Math.sqrt(Math.max(0, DOME_RS * DOME_RS - r * r));
const FACET = 2 * Math.atan(2 / A); // the angle one 4 m panel spans on the wall
const CORR = 40;              // the corridor bends on a circle of this radius
const A_LIFT = -Math.PI / 2;  // the lift's line (z = 0) ...
const A_END = A_LIFT + 0.185; // ... and the bridge door, 7.4 m on
const YAW = A_END - A_LIFT;   // the bridge faces the way the corridor ends
const SN = Math.sin(YAW); const CS = Math.cos(YAW);
const DOOR = [CORR + CORR * Math.sin(A_END), CORR * Math.cos(A_END)];
const HUB = [DOOR[0] + R * SN, DOOR[1] + R * CS]; // the bridge's centre, in deck metres
const AS = Math.PI + 0.85;                        // the shield console, on the rail (back, left)
const SHIELD_AT = [4.0 * Math.sin(AS), 4.0 * Math.cos(AS)];
const AD = Math.PI - 0.85;                        // the dish console (quest 'message'), on the rail, back right
const DISH_AT = [4.0 * Math.sin(AD), 4.0 * Math.cos(AD)];
// A light or a vent lies flat in its own frame; this turns it so it stands on a wall (its thin side faces the room).
const FLAT_TO_WALL = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
// The kit's wall cap (3 m to 5 m above the floor) squashed to 0.6 m, for the corridor's 3.6 m ceiling.
const CAP = new THREE.Matrix4().makeTranslation(0, 3, 0).multiply(new THREE.Matrix4().makeScale(1, 0.3, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -3, 0));
// A console's tilt: its LCARS slope (about 63 degrees from flat) faces up and forward.
const SLOPE = -Math.atan(0.5);
/** A point on the corridor's bend (a = angle on the circle of radius CORR). */
const corrPoint = (a) => [CORR + CORR * Math.sin(a), CORR * Math.cos(a)];
const angDiff = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q)));

/** Bridge metres -> deck metres. */
const toDeck = (x, z) => [HUB[0] + x * CS + z * SN, HUB[1] - x * SN + z * CS];
/** A walk-map shape written in bridge metres, in deck metres. */
function shapeToDeck(s) {
  if (s.rect) { const [x, z] = toDeck(s.rect[0], s.rect[1]); return { rect: [x, z, s.rect[2], s.rect[3]], rot: YAW + (s.rot || 0) }; }
  if (s.disc) { const [x, z] = toDeck(s.disc[0], s.disc[1]); return { disc: [x, z, s.disc[2]] }; }
  const [x, z] = toDeck(s.ring[0], s.ring[1]);
  return { ring: [x, z, s.ring[2], s.ring[3]], from: s.from == null ? undefined : s.from + YAW, to: s.to == null ? undefined : s.to + YAW };
}
/** Turn a geometry's faces round so they show from the other side (for things seen from inside). */
function inward(g) {
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
/** The box round a list of { g } geometries. */
function boundsOf(list) {
  const box = new THREE.Box3();
  for (const { g } of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
  return box;
}

// A console's side profile, as (z, y) in metres from its middle and its floor: the plinth, the LCARS slope on the front.
const CONSOLE = [[-0.4, 0.05], [0.38, 0.05], [0.4, 0.36], [0.18, 0.8], [-0.4, 0.8]];
/** A side profile (z, y) extruded across x (w wide, centred), with a bevel: the console's body. */
function profileGeo(w, prof, bevel = 0.02) {
  const sh = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  // The extrusion (depth) becomes x, the shape's x becomes z (the front), its y stays up.
  return g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, w / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
}

export function buildDeck(kit) {
  const { mats } = kit;
  const M = kit.models; // null when the kit did not load: the same layout in code
  const group = new THREE.Group();
  const floors = []; const solids = []; const roofs = [];
  const toon = (color, extra = {}) => kit.own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra }));
  const wood = toon(0xb07a4a);
  const glowBlue = kit.glow(PALETTE.blue, 1.3);
  const glowCool = kit.glow(0xcfe6ff, 1.8);
  const teal = toon(PALETTE.teal);
  const inlay = toon(0x6f5f8c, FLUSH);
  // Ceilings are seen from below, where the cool sky light never reaches; this lighter stuff reads better.
  const ceilMat = toon(0xd9d2c6, { emissive: 0x3a3630 });
  // The dome: cooler and brighter than the warm ceilings, so it reads as a dome.
  const domeMat = toon(0xb9c4d6, { emissive: 0x161c28 });

  /** A flat band of arc (faces up), centred on (x, z) at height y. */
  const band = (b, r0, r1, a0, a1, mat, { x = 0, y = 0, z = 0, down = false } = {}) => {
    const g = new THREE.RingGeometry(r0, r1, Math.max(8, Math.round(((a1 - a0) * r1) / 0.4)), 1, a0 - Math.PI / 2, a1 - a0);
    g.rotateX(-Math.PI / 2);
    b.add(down ? inward(g) : g, mat, x, y, z);
  };
  /** A curved wall band (an open cylinder arc); `inside` turns it to face the centre. */
  const arcWall = (b, r, h, a0, a1, mat, { y = h / 2, inside = false } = {}) => {
    const g = new THREE.CylinderGeometry(r, r, h, Math.max(6, Math.round(((a1 - a0) * r) / 0.5)), 1, true, a0, a1 - a0);
    b.add(inside ? inward(g) : g, mat, 0, y, 0);
  };

  // --- kit pieces ----------------------------------------------------------------------------
  /** The parts of a kit piece as cloned geometry (turned by `pre`, scaled by s); the kit's own copies are not touched. */
  const partsOf = (name, { s = 1, pre = null } = {}) => M.object(name).children.map((m) => {
    const g = m.geometry.clone();
    if (pre) g.applyMatrix4(pre);
    if (s !== 1) g.scale(s, s, s);
    return { g, mat: m.material };
  });
  /** A kit piece's material in a tint (a copy, shared by its parts): the kit's decals and trims are bright, a deck wants them quieter. */
  const tints = new Map();
  const tinted = (mat, c) => {
    if (!c) return mat;
    const key = `${mat.uuid}|${c}`;
    if (!tints.has(key)) { const m = mat.clone(); m.color.multiply(new THREE.Color(c)); tints.set(key, kit.own(Object.assign(m, FLUSH))); }
    return tints.get(key);
  };
  /** A free piece, its middle (x, z) on the floor at (x, z) with its foot at y, turned ry. Without the kit, a proxy box [w, h, d, mat]. */
  const putPiece = (b, name, x, y, z, ry = 0, { s = 1, centre = true, proxy = null, tint = null } = {}) => {
    if (!M) { if (proxy) b.box(proxy[0], proxy[1], proxy[2], proxy[3], x, y + proxy[1] / 2, z, ry); return; }
    const list = partsOf(name, { s });
    if (centre) {
      const box = boundsOf(list);
      for (const { g } of list) g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    }
    for (const { g, mat } of list) b.add(g, tinted(mat, tint), x, y, z, ry);
  };
  /**
   * Stand kit pieces on a wall line: the line is at distance F from C along the angle a (its points are
   * C + F (sin a, cos a)), and the room is on the side `side` of it (-1: towards C, +1: away from it).
   * The pieces' room face (their largest x) lands on the line and their middle on the point t along
   * it. The pieces of one wall share one origin: `ref` (default the first name) sets it, so a
   * cornice or a floor trim lines up with the panel it belongs to. `refPre` is the ref's own
   * transform (default `pre`; null when the ref is not changed, e.g. a squashed cap).
   */
  const standOn = (b, names, { C = [0, 0], a, F, side, t = 0, y = 0, s = 1, pre = null, refPre = pre, ref = names[0] }) => {
    if (!M) return;
    const th = a - (side * Math.PI) / 2; // the piece's own x points into the room, its z along the wall
    const N = [Math.sin(a), Math.cos(a)]; const T = [Math.cos(a), -Math.sin(a)];
    const x = C[0] + F * N[0] + t * T[0]; const z = C[1] + F * N[1] + t * T[1];
    const box = boundsOf(partsOf(ref, { s, pre: refPre }));
    const sh = [-box.max.x, -box.min.y, -(box.min.z + box.max.z) / 2];
    for (const name of names) {
      for (const { g, mat } of partsOf(name, { s, pre })) { g.translate(sh[0], sh[1], sh[2]); b.add(g, mat, x, y, z, th); }
    }
  };
  const WALL = ['walls/WallAstra_Straight', 'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight'];
  const BANDED = ['walls/WallBand_Straight', 'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight'];
  const LIGHT = 'props/Prop_Light_Small';
  const VENT = 'props/Prop_Vent_Small';

  // --- the corridor: from the lift door to the bridge's door, bending gently ---------------
  const cb = kit.batch();
  const corr = { ring: [CORR, 0, 38.3, 41.95], from: A_LIFT, to: A_END };
  floors.push(kit.floor(cb, corr));
  roofs.push({ shape: corr, h: 3.6 }, { shape: shapeToDeck({ disc: [0, 0, R] }), h: (x, z) => domeAt(Math.hypot(x - HUB[0], z - HUB[1])) });
  band(cb, 38.3, 41.95, A_LIFT, A_END, ceilMat, { x: CORR, y: 3.6, down: true });
  if (M) {
    // Two 4 m panels a side (the arc is 7.4 m), each with a cornice on top (the kit's cap, squashed to fit
    // the 3.6 m corridor), a wall light on each, a vent in the ceiling.
    for (const s of [1.85, 5.55]) {
      const a = A_LIFT + s / CORR;
      standOn(cb, ['walls/WallAstra_Straight', 'walls/BottomMetal_Straight'], { C: [CORR, 0], a, F: 38.3, side: 1 });
      standOn(cb, ['walls/WallAstra_Straight', 'walls/BottomMetal_Straight'], { C: [CORR, 0], a, F: 41.95, side: -1 });
      standOn(cb, ['walls/TopPlastic_Straight'], { C: [CORR, 0], a, F: 38.3, side: 1, pre: CAP, refPre: null, ref: 'walls/WallAstra_Straight' });
      standOn(cb, ['walls/TopPlastic_Straight'], { C: [CORR, 0], a, F: 41.95, side: -1, pre: CAP, refPre: null, ref: 'walls/WallAstra_Straight' });
      standOn(cb, [LIGHT], { C: [CORR, 0], a, F: 38.4, side: 1, y: 2.45, pre: FLAT_TO_WALL });
      standOn(cb, [LIGHT], { C: [CORR, 0], a, F: 41.85, side: -1, y: 2.45, pre: FLAT_TO_WALL });
    }
    const v = corrPoint(A_LIFT + 3.7 / CORR);
    putPiece(cb, 'props/Prop_Vent_Wide', v[0], 3.55, v[1], A_LIFT + 3.7 / CORR, { proxy: [1.9, 0.06, 0.3, mats.trim] });
  } else {
    kit.wallArc(cb, CORR, 0, 38.3, A_LIFT, A_END, { h: 3.6 });
    kit.wallArc(cb, CORR, 0, 41.95, A_LIFT, A_END, { h: 3.6 });
  }
  cb.flush(group);
  // The corridor's walls are solids (the room-side faces are at 38.3 and 41.95).
  solids.push(shapeToDeck({ ring: [CORR, 0, 38.0, 38.35], from: A_LIFT, to: A_END }));
  solids.push(shapeToDeck({ ring: [CORR, 0, 41.65, 42.0], from: A_LIFT, to: A_END }));

  // LCARS tags on both corridor walls (the bend's inside and outside), so the walk is not bare.
  const tagIn = kit.screen(1.4, 0.7, { title: 'DECK 1', accent: PALETTE.lilac, seed: 61 });
  tagIn.position.set(CORR + 38.36 * Math.sin(A_LIFT + 0.06), 1.7, 38.36 * Math.cos(A_LIFT + 0.06));
  tagIn.rotation.y = A_LIFT + 0.06; group.add(tagIn);
  const tagOut = kit.screen(1.4, 0.7, { title: 'SHIELD', kind: 'map', accent: PALETTE.teal, seed: 62 });
  tagOut.position.set(CORR + 41.9 * Math.sin(A_LIFT + 0.14), 1.7, 41.9 * Math.cos(A_LIFT + 0.14));
  tagOut.rotation.y = A_LIFT + 0.14 + Math.PI; group.add(tagOut);

  // The door: a frame from the kit, the sliding leaves from kit.door (in the frame's opening).
  const dfb = kit.batch();
  putPiece(dfb, 'platforms/Door_Frame_Square', DOOR[0], 0, DOOR[1], YAW, { s: 0.62, proxy: [3.0, 3.1, 0.3, mats.trim] });
  dfb.flush(group);
  const door = kit.door(DOOR[0], DOOR[1], YAW, { w: 2.6, h: 2.5 });
  group.add(door.group);
  // The name over the door, seen from the corridor.
  const sign = kit.sign('Bridge', { w: 2.2, h: 0.46, color: PALETTE.gold });
  sign.position.set(DOOR[0] - 0.2 * SN, 2.78, DOOR[1] - 0.2 * CS); sign.rotation.y = YAW + Math.PI; group.add(sign); // in front of the frame, on the corridor's side

  // --- the bridge: local frame, one batch, flushed into a group turned to the corridor -----
  const bb = kit.batch();
  const bridge = new THREE.Group();
  bridge.position.set(HUB[0], 0, HUB[1]); bridge.rotation.y = YAW;
  group.add(bridge);

  // The floor runs to the outer wall, so it meets the corridor at the entrance gap.
  floors.push(shapeToDeck(kit.floor(bb, { disc: [0, 0, R] })));
  // A grey metal dais under the captain: four of the kit's quarter plates (4 m radius). Each plate's centre is
  // its (2, 2) corner, so each is turned and set to put that corner on the origin.
  if (M) {
    for (let q = 0; q < 4; q++) {
      const ry = (q * Math.PI) / 2;
      const c = [2 * (Math.cos(ry) + Math.sin(ry)), 2 * (Math.cos(ry) - Math.sin(ry))];
      for (const { g, mat } of partsOf('platforms/Platform_Metal_Curve')) bb.add(g, tinted(mat, 0xffffff), -c[0], 0.004, -c[1], ry); // white: a copy with FLUSH
    }
  }

  // The raised back half-ring: a 12 cm step (riser and lit edge), a different floor, the rail.
  const BACK = [Math.PI / 2 + GAP_BAY, 1.5 * Math.PI - GAP_BAY];
  band(bb, RR + 0.2, RF, BACK[0], BACK[1], mats.deck, { y: 0.12 });
  arcWall(bb, RR + 0.2, 0.12, BACK[0], BACK[1], mats.wallDark, { inside: true });
  band(bb, RR + 0.2, RR + 0.38, BACK[0], BACK[1], glowBlue, { y: 0.125 });
  // Rings inlaid in the floor: one round the middle (on the dais), one across the front.
  band(bb, 3.0, 3.1, 0, Math.PI * 2, inlay, { y: 0.009 });
  band(bb, 6.4, 6.5, -1.3, 1.3, inlay, { y: 0.003 });
  // Decals on the floor, used sparingly: the deck's number on the step by the door, a logo on the dais in front of the captain.
  if (M) {
    putPiece(bb, 'decals/Decal_1', 0, 0.124, -6.6, 0, { tint: PALETTE.peach });
    putPiece(bb, 'decals/Decal_Logo', 0, 0.009, 2.5, 0, { s: 0.8, tint: 0x9c8552 }); // a muted gold: the kit's is loud
  }
  // The rail: a closed half-ring of quarter arcs (the kit's round rail, 4 m radius, scaled to RR), open at the two sides.
  if (M) {
    putPiece(bb, 'props/Prop_Rail_Round_Big', 0, 0.12, 0, 0, { s: RR / 4, centre: false });
    putPiece(bb, 'props/Prop_Rail_Round_Big', 0, 0.12, 0, Math.PI / 2, { s: RR / 4, centre: false });
  } else {
    const RAIL = [[Math.PI / 2 + 0.25, Math.PI - 0.25], [Math.PI + 0.25, 1.5 * Math.PI - 0.25]];
    for (const [a0, a1] of RAIL) {
      arcWall(bb, RR + 0.2, 0.95, a0, a1, wood);
      arcWall(bb, RR - 0.2, 0.95, a0, a1, wood, { inside: true });
      band(bb, RR - 0.2, RR + 0.2, a0, a1, wood, { y: 0.95 });
    }
  }
  solids.push(shapeToDeck({ ring: [0, 0, RR - 0.2, RR + 0.2], from: Math.PI / 2, to: 1.5 * Math.PI }));

  // --- the round wall ----------------------------------------------------------------------------
  // Three runs of the wall (the front, and the two back halves), open at the door and the two bays.
  const runs = [[-Math.PI / 2 + GAP_BAY, Math.PI / 2 - GAP_BAY], [Math.PI / 2 + GAP_BAY, Math.PI - GAP_DOOR], [Math.PI + GAP_DOOR, 1.5 * Math.PI - GAP_BAY]];
  for (const [a0, a1] of runs) solids.push(shapeToDeck({ ring: [0, 0, R - 0.3, R + 0.05], from: a0, to: a1 }));
  if (!M) for (const [a0, a1] of runs) kit.wallArc(bb, 0, 0, R, a0, a1, { h: RIM });
  // The facets: each run cut into panels of at most one kit panel's width, so none is wider than 4 m.
  const facets = [];
  for (const [a0, a1] of runs) {
    const n = Math.max(1, Math.ceil((a1 - a0) / FACET));
    for (let k = 0; k < n; k++) facets.push(a0 + ((k + 0.5) * (a1 - a0)) / n);
  }
  // The LCARS screens sit in the wall at eye height, each on the facet nearest its angle.
  const screens = [];
  const panelSpots = [
    { title: 'NAV', a: 1.15, frame: mats.accentBlue, opts: { kind: 'map', accent: PALETTE.blue, seed: 3 } },
    { title: 'SYSTEMS', a: -1.15, frame: teal, opts: { seed: 5, accent: PALETTE.teal } },
    { title: 'COMMS', a: Math.PI - 0.45, frame: mats.accentLilac, opts: { seed: 7, accent: PALETTE.lilac } },
    { title: 'SHIELD', a: Math.PI + 0.45, frame: mats.accentOrange, opts: { seed: 9, accent: PALETTE.gold } },
    { title: 'SCIENCE', a: Math.PI + 1.0, frame: mats.accentBlue, opts: { seed: 11, accent: PALETTE.peach } },
  ];
  const panelAt = new Map();
  for (const p of panelSpots) {
    let best = 0;
    facets.forEach((fa, i) => { if (angDiff(fa, p.a) < angDiff(facets[best], p.a)) best = i; });
    panelAt.set(best, p);
  }
  /** One LCARS panel set in a facet: a coloured frame and the screen just in front of it. */
  const panelOn = (a, { title, frame, opts }) => {
    const p = kit.screen(1.8, 1.0, { title, ...opts });
    p.position.set((A - 0.1) * Math.sin(a), 1.9, (A - 0.1) * Math.cos(a));
    p.rotation.y = a + Math.PI;
    bridge.add(p); screens.push(p);
    bb.add(new THREE.BoxGeometry(1.92, 1.12, 0.06), frame, (A - 0.03) * Math.sin(a), 1.9, (A - 0.03) * Math.cos(a), a + Math.PI);
  };
  facets.forEach((a, i) => {
    if (!M) return;
    const pn = panelAt.get(i);
    if (pn) {
      standOn(bb, WALL, { a, F: A, side: -1 });
      panelOn(a, pn);
    } else if (i % 4 === 2) {
      standOn(bb, BANDED, { a, F: A, side: -1, ref: 'walls/WallAstra_Straight' });
    } else {
      standOn(bb, WALL, { a, F: A, side: -1 });
    }
    // Wall lights above the screens: two a panel (the band panels are recessed, so they take none).
    if (i % 4 !== 2) for (const t of [-1.0, 1.0]) standOn(bb, [LIGHT], { a, F: A - 0.1, side: -1, t, y: 2.5, pre: FLAT_TO_WALL });
    // A vent low on every third plain panel.
    if (!pn && i % 3 === 1) standOn(bb, [VENT], { a, F: A - 0.08, side: -1, y: 0.4, pre: FLAT_TO_WALL });
  });
  // A soft light cove at the foot of the cornice, all the way round.
  bb.add(new THREE.TorusGeometry(A - 0.03, 0.05, 6, 96).rotateX(Math.PI / 2), glowCool, 0, 3.02, 0);
  // The viewscreen: a framed, curved window on the front wall, between two pilasters.
  arcWall(bb, 8.6, 2.95, -0.66, 0.66, mats.trim, { y: 2.025, inside: true });
  // Round pilasters (the kit's column, 5 m high): half of each stands out from the wall.
  for (const s of [-1, 1]) standOn(bb, ['columns/Column_Round'], { a: s * 0.74, F: A - 0.5, side: -1 });
  const sw = kit.starWindow(9.5, 2.35, { speed: 0.003 });
  const scr = new THREE.Mesh(kit.own(inward(new THREE.CylinderGeometry(8.45, 8.45, 2.35, 48, 1, true, -0.6, 1.2))), kit.own(new THREE.MeshBasicMaterial({ map: sw.mesh.material.map })));
  scr.position.set(0, 2.025, 0); bridge.add(scr);

  // The chairs are built here (the kit's were boxy): a star-based pedestal, a seat, a tall curved back with a gold
  // cap, and armrests with a glowing panel each. They face +z, the viewscreen. The captain's is the hero; the
  // others are the same at 0.8 scale.
  const upholstery = toon(0xa8482c); // warm burnt orange
  const frameDark = toon(0x3e434e);
  const gold = toon(PALETTE.gold);
  /** A curved slab for a chair's back: a plan annulus (radii r0..r1) round the seat, from -z to +-half, h high. */
  const sector = (r0, r1, half, h) => {
    const sh = new THREE.Shape(); const N = 14;
    for (let i = 0; i <= N; i++) { const p = -half + (2 * half * i) / N; const v = [r1 * Math.sin(p), r1 * Math.cos(p)]; if (i) sh.lineTo(...v); else sh.moveTo(...v); }
    for (let i = N; i >= 0; i--) { const p = -half + (2 * half * i) / N; sh.lineTo(r0 * Math.sin(p), r0 * Math.cos(p)); }
    // The shape's y is minus the plan's z: turned flat, its extrusion goes up.
    return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 1 }).rotateX(-Math.PI / 2);
  };
  const chair = (x, z, { k = 1, arms = true } = {}) => {
    const at = (geo, mat, dx, dy, dz) => { bb.add(geo.translate(dx, dy, dz).scale(k, k, k), mat, x, 0, z); };
    at(new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.33, 0.03], [0.3, 0.05], [0.07, 0.11], [0.06, 0.4], [0.12, 0.46], [0, 0.49]].map(([r, y]) => new THREE.Vector2(r, y)), 18), frameDark, 0, 0, 0);
    at(new THREE.TorusGeometry(0.31, 0.012, 6, 36).rotateX(Math.PI / 2), gold, 0, 0.05, 0);
    at(new RoundedBoxGeometry(0.66, 0.12, 0.62, 2, 0.05), upholstery, 0, 0.55, 0);
    at(new THREE.BoxGeometry(0.66, 0.025, 0.025), gold, 0, 0.5, 0.32);
    at(sector(0.36, 0.46, 0.8, 0.9), upholstery, 0, 0.6, 0);
    at(sector(0.355, 0.465, 0.82, 0.04), gold, 0, 1.49, 0);
    if (arms) {
      for (const sd of [-1, 1]) {
        at(new RoundedBoxGeometry(0.09, 0.1, 0.44, 2, 0.03), frameDark, sd * 0.38, 0.68, 0.02);
        at(new RoundedBoxGeometry(0.08, 0.14, 0.3, 2, 0.03), frameDark, sd * 0.36, 0.56, 0);
        at(new THREE.BoxGeometry(0.05, 0.012, 0.3), glowBlue, sd * 0.38, 0.733, 0.02);
      }
    }
    solids.push(shapeToDeck({ rect: [x, z, 0.8, 0.8] }));
  };
  chair(0, -0.2);
  band(bb, 1.5, 1.62, 0, Math.PI * 2, glowBlue, { y: 0.009, z: -0.2 }); // the ring round her chair

  // A console (TNG style): a bevelled plinth with a sloped front, its LCARS screen set into the slope, a lit
  // edge along the top and the foot. `ry` turns its front (+z) to where she should stand. Its solid is 1.5 x 0.85.
  const consoleMat = toon(0x8e96a4);
  const desk = (x, z, ry, scr) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const at = (geo, mat, dx, dy, dz) => bb.add(geo.translate(dx, dy, dz), mat, x, 0, z, ry);
    at(profileGeo(1.5, CONSOLE), consoleMat, 0, 0, 0);
    at(new RoundedBoxGeometry(1.6, 0.07, 0.94, 2, 0.03), mats.panel, 0, 0.035, 0);
    at(new THREE.BoxGeometry(1.46, 0.02, 0.04), glowBlue, 0, 0.805, 0.18);
    at(new THREE.BoxGeometry(1.46, 0.03, 0.03), glowBlue, 0, 0.37, 0.41);
    // The bevel stands the slope 2 cm proud of the profile, so the screen sits 3.5 cm out from the profile's slope.
    at(new THREE.BoxGeometry(1.28, 0.48, 0.01).rotateX(SLOPE), mats.black, 0, 0.589, 0.308);
    const s = kit.screen(1.2, 0.42, { seed: Math.round(x * 13 + z * 7), ...scr });
    s.position.set(0, 0.596, 0.321); s.rotation.x = SLOPE;
    g.add(s);
    bridge.add(g);
    solids.push(shapeToDeck({ rect: [x, z, 1.5, 0.85], rot: ry }));
    return g;
  };
  // The bridge's two science bays: a room each, walled with panels, a console inside.
  for (const k of [1, -1]) {
    const x0 = k * A; const xf = k * BAY_X;
    const len = Math.abs(xf - x0);
    if (M) {
      for (const zs of [1, -1]) for (const xc of [k * 10.5, k * 14.5]) standOn(bb, WALL, { a: zs > 0 ? 0 : Math.PI, F: BAY_W, side: -1, t: zs > 0 ? xc : -xc });
      for (const zc of [-1.3, 1.3]) standOn(bb, WALL, { a: (k * Math.PI) / 2, F: BAY_X, side: -1, t: -k * zc });
      standOn(bb, [LIGHT], { a: 0, F: BAY_W - 0.1, side: -1, t: k * 11.4, y: 2.5, pre: FLAT_TO_WALL });
      standOn(bb, [LIGHT], { a: Math.PI, F: BAY_W - 0.1, side: -1, t: -k * 11.4, y: 2.5, pre: FLAT_TO_WALL });
    } else {
      kit.wall(bb, x0, BAY_W, xf, BAY_W, { h: RIM });
      kit.wall(bb, x0, -BAY_W, xf, -BAY_W, { h: RIM });
      kit.wall(bb, xf, -BAY_W, xf, BAY_W, { h: RIM });
    }
    solids.push(shapeToDeck({ rect: [(x0 + xf) / 2, BAY_W, len + 0.25, 0.35], rot: 0 }));
    solids.push(shapeToDeck({ rect: [(x0 + xf) / 2, -BAY_W, len + 0.25, 0.35], rot: 0 }));
    solids.push(shapeToDeck({ rect: [xf, 0, 0.35, 2 * BAY_W + 0.25], rot: 0 }));
    const bay = { rect: [(x0 + xf) / 2, 0, len, 2 * BAY_W] };
    floors.push(shapeToDeck(kit.floor(bb, bay)));
    roofs.push({ shape: shapeToDeck(bay), h: RIM });
    bb.add(new THREE.PlaneGeometry(len, 2 * BAY_W).rotateX(Math.PI / 2), ceilMat, (x0 + xf) / 2, RIM, 0);
    for (const zz of [-1.2, 1.2]) bb.box(len * 0.8, 0.03, 0.16, mats.coveCool, (x0 + xf) / 2, RIM - 0.02, zz);
    // Stores on the floor by the entrance.
    putPiece(bb, 'props/Prop_Crate4', k * 10.1, 0, -1.5, 0.3, { proxy: [1.12, 1.12, 1.12, mats.panel] });
    putPiece(bb, 'props/Prop_Barrel_Large', k * 10.5, 0, 1.6, 0, { proxy: [0.5, 1.1, 0.5, mats.metal] });
    putPiece(bb, 'props/Prop_Cable_1', k * 11.8, 0, 1.0, 0.5); // a cable bundle across the floor, to the console
    solids.push(shapeToDeck({ rect: [k * 10.1, -1.5, 1.2, 1.2], rot: 0 }));
    solids.push(shapeToDeck({ rect: [k * 10.5, 1.6, 0.6, 0.6], rot: 0 }));
    const cx = k * (BAY_X - 1.6); const ry = -k * Math.PI / 2;
    desk(cx, 0, ry, { title: 'SCIENCE', accent: PALETTE.teal, seed: k > 0 ? 31 : 32 });
  }

  for (const s of [-1, 1]) {
    chair(s * 2.1, -0.7, { k: 0.8 });
    chair(s * 1.9, 3.0, { k: 0.8, arms: false }); // the helm and ops operators, facing the screen
    desk(s * 1.9, 4.6, Math.PI, { title: s < 0 ? 'NAV' : 'SYSTEMS', accent: s < 0 ? PALETTE.blue : PALETTE.peach, seed: 41 + s });
  }

  // The shield console, built into the rail (its panel faces the centre). Its lamp sits on the top.
  const shGroup = desk(SHIELD_AT[0], SHIELD_AT[1], AS + Math.PI, { title: 'SHIELD', accent: PALETTE.lilac, seed: 21 });
  const lamp = kit.lamp(PALETTE.gold); lamp.position.set(-0.55, 0.85, -0.1); shGroup.add(lamp);

  // Quest: message (the dish on its console, a mirror of the shield console; the quest's spots are below)
  const dishConsole = desk(DISH_AT[0], DISH_AT[1], AD + Math.PI, { title: 'DISH', accent: PALETTE.teal, seed: 23 });
  const dishPost = new THREE.Mesh(kit.own(new THREE.CylinderGeometry(0.05, 0.05, 0.66, 10)), kit.mats.metal); dishPost.position.set(0.55, 1.12, -0.1);
  // The dish: a white bowl (radius 0.4) with a teal rim, its head tilted so the bowl opens up and towards her.
  const dishHead = new THREE.Group(); dishHead.position.set(0.55, 1.45, -0.1); dishHead.rotation.x = -2.2;
  const dishBowl = new THREE.Mesh(kit.own(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xf4f8fb, { side: THREE.DoubleSide }));
  const dishRim = new THREE.Mesh(kit.own(new THREE.TorusGeometry(0.4, 0.03, 8, 40).rotateX(Math.PI / 2)), teal);
  dishHead.add(dishBowl, dishRim);
  const dishLamp = kit.lamp(PALETTE.teal); dishLamp.position.set(-0.55, 0.85, -0.1);
  const dishSign = kit.sign('COMMS', { w: 0.5, h: 0.14, color: PALETTE.teal }); dishSign.position.set(-0.5, 0.45, 0.45);
  dishConsole.add(dishPost, dishHead, dishLamp, dishSign);

  // The dome: a shallow sphere cap from the rim up to the apex, with two light rings.
  const RS = DOME_RS;
  const dome = new THREE.SphereGeometry(RS, 48, 6, 0, Math.PI * 2, 0, Math.asin(R / RS));
  bb.add(inward(dome), domeMat, 0, APEX - RS, 0);
  const domeY = (r) => APEX - RS + Math.sqrt(RS * RS - r * r);
  bb.add(new THREE.TorusGeometry(8.6, 0.06, 6, 72).rotateX(Math.PI / 2), glowCool, 0, domeY(8.6), 0);
  bb.add(new THREE.TorusGeometry(5.0, 0.05, 6, 56).rotateX(Math.PI / 2), glowCool, 0, domeY(5.0), 0);

  // The rail's solids are the arc's shape; the bays' and walls' are above.
  bb.flush(bridge);
  // The two lights the deck may use: over the captain (the dome's light) and in the corridor.
  const hubLight = new THREE.PointLight(0xfff1e0, 1.8, 0, 1); hubLight.position.set(0, 3.0, 0); bridge.add(hubLight);
  const corrLight = new THREE.PointLight(0xfff1e0, 1, 0, 1); corrLight.position.set(...corrPoint(A_LIFT + 0.14), 2.8); group.add(corrLight);

  // --- where she stands, and who stands beside her ---------------------------------------
  const faceAt = (p, q) => Math.atan2(q[0] - p[0], q[1] - p[1]);
  const shieldSpot = toDeck(3.0 * Math.sin(AS), 3.0 * Math.cos(AS));
  const shieldProp = toDeck(SHIELD_AT[0], SHIELD_AT[1]);
  const doctorSpot = toDeck(3.0 * Math.sin(AS - 0.45), 3.0 * Math.cos(AS - 0.45));
  // Quest: message. She stands at the rail's inside; Echo stands beside her, facing the dish.
  const dishSpot = toDeck(3.0 * Math.sin(AD), 3.0 * Math.cos(AD));
  const dishProp = toDeck(DISH_AT[0], DISH_AT[1]);
  const echoSpot = toDeck(3.0 * Math.sin(AD + 0.45), 3.0 * Math.cos(AD + 0.45));

  // --- the views for screenshots (deck metres) ---------------------------------------------
  const e = corrPoint(A_END - 0.14);
  const [ex, ez] = toDeck(0, 2.6);
  const at = (x, y, z) => { const [dx, dz] = toDeck(x, z); return [dx, y, dz]; };
  const views = [
    { name: 'entrance', pos: [e[0], 1.6, e[1]], look: [ex, 1.4, ez] },
    { name: 'screen', pos: at(0, 2.3, -2.4), look: at(0, 1.7, 9) },
    { name: 'back', pos: at(0, 1.6, 7.6), look: at(0, 1.1, -7) },
    { name: 'shield', pos: at(-0.9, 1.9, -3.4), look: at(SHIELD_AT[0], 1.0, SHIELD_AT[1]) }, // from the side: the beacon stands on the spot
    { name: 'bay', pos: at(3.1, 1.6, -4.7), look: at(14, 1.4, 0.5) }, // off the dish (it stands 1.2 m from the old spot)
    { name: 'ring', pos: at(6.0, 2.3, -5.6), look: at(-3, 1.0, 3) },
    { name: 'walk', pos: at(-1.0, 1.6, -5.8), look: at(0.5, 1.4, 9) }, // her eye level, on the way in
    { name: 'dish', pos: at(1.2, 1.6, -1.0), look: at(DISH_AT[0], 1.1, DISH_AT[1]) },
  ];

  return {
    group,
    floors,
    solids,
    ceiling: APEX, ceilingAt: (x, z) => roofAt(roofs, x, z, APEX),
    stations: {
      shield: { x: shieldSpot[0], z: shieldSpot[1], face: faceAt(shieldSpot, shieldProp), lamp, y: 2.2 },
      // Quest: message
      message: { x: dishSpot[0], z: dishSpot[1], face: faceAt(dishSpot, dishProp), lamp: dishLamp, y: 2.2 },
    },
    crewSpots: {
      doctor: { x: doctorSpot[0], z: doctorSpot[1], face: faceAt(doctorSpot, shieldProp) },
      message: { x: echoSpot[0], z: echoSpot[1], face: faceAt(echoSpot, dishProp) }, // Echo, in the quest
    },
    views,
    update(dt, t, ctx) {
      door.update(dt, ctx.herX, ctx.herZ);
      sw.update(t);
      for (let i = 0; i < screens.length; i++) screens[i].material.color.setScalar(1.05 + 0.1 * Math.sin(t * 1.4 + i * 1.3));
    },
    // The kit owns every geometry and material made here.
    dispose() {},
  };
}
