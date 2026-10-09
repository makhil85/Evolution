// Chapter 6 interior: Deck 4, the crew deck (TNG style, cosy and future-looking).
// From the lift a 3.4 m corridor runs 38 m to the lounge. Its walls are the kit's
// panelled walls (4 m panels, each with a cornice up to the 3.6 m ceiling and a
// floor trim), with a door frame round every cabin door and a wall light between
// them. Five cabin doors line it: ZARA's on the left (the hero's cabin, always
// open: a bed with a headboard, a desk with a screen and a chair, a round window
// with stars, a shelf with a rocket) and four shut ones (MIRA, THEO, BOLT, ECHO).
// At the end the lounge (16 x 11 m, like Ten Forward) has a window that bows out
// across its far wall, framed by kit columns; round tables with chairs, a bar
// with a glowing food replicator, a raised booth by the window, plants in pots and
// warm light. Off the corridor's right side, through a door at z 29, is the
// sick bay (6 x 6 m): the quest 'medbay' (quests.js) is played there.
// The kit's walls are 1.21 m deep, so a room's walls and doorways are that thick
// (the solids follow the drawn faces). Without the kit (models failed to load)
// the same rooms are drawn in plain code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

// The kit pieces this deck uses (models.js names; loaded before the deck is built).
export const MODELS = [
  'walls/WallAstra_Straight', 'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight',
  'columns/Column_Round', 'platforms/Platform_Metal', 'platforms/Door_Frame_Square',
  'props/Prop_Light_Small', 'props/Prop_Rail_4', 'decals/Decal_Logo',
];

const CH = 3.6;                 // ceiling
const CW = 1.7;                 // corridor half-width: the walls' room faces
const WD = 1.21;                // a kit wall's depth, from its room face to its back
const OUT = CW + WD;            // 2.91: the corridor walls' outer faces
const UNIT = 4;                 // a kit wall panel is 4 m long
const CL = 38;                  // corridor length: lift to lounge
const DH = 2.36;                // a door's opening (the frame squashed to the ceiling)
const FRAME_X = 2.43;           // a Door_Frame_Square is 4.85 m wide (its opening 3.22 m, from -1.61 to 1.61)
const FRAME_OPEN = 3.22;
const FRAME_SY = 0.72;          // ... and 5 m high: squashed so its top meets the ceiling and its opening is DH
const CAB_X = -7.6;             // ZARA's cabin: back wall's room face
const CAB_Z0 = 4.5; const CAB_Z1 = 9.5;
const MED = { x1: 7.7, z0: 26, z1: 32 }; // the sick bay: back wall's room face and its z range (its door is in the corridor's right wall)
const LX = 8.0;                 // lounge side walls' room faces
const LAPEX = CL + 12;          // lounge far wall at its middle (inside face)
const SAG = 1.2;                // the window's ends sit this far back from its middle
const RIN = (64 + SAG * SAG) / (2 * SAG); // the window's radius (an arc through x = ±8)
const ZW = Math.asin(8 / RIN);  // half the window's angle
const ZC = LAPEX - RIN;         // the window's circle centre
const LZE = LAPEX - SAG;        // where the window meets the side walls
const TEAL = new THREE.Color(PALETTE.teal);

// A kit piece's wall-mount matrix: lays a flat light on a wall (its thin side along x, its length along z).
const FLAT_TO_WALL = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
// The kit's wall cap (3 m to 5 m above the floor) squashed to 0.6 m, for the 3.6 m ceiling.
const CAP = new THREE.Matrix4().makeTranslation(0, 3, 0).multiply(new THREE.Matrix4().makeScale(1, 0.3, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -3, 0));

export function buildDeck(kit) {
  const { mats } = kit;
  const M = kit.models ?? null; // the model kits (models.js); null: the same rooms in plain code
  const group = new THREE.Group();
  const b = kit.batch();
  const floors = []; const solids = []; const doors = []; // doors: { door, force } (force: 0 shut, 1 open, null by her)
  const own = kit.own;
  const toon = (color, extra = {}) => own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra }));
  const cushion = toon(0x7a6e9a);     // the chairs' seats and the bed's blanket
  const cream = toon(0xe8e2dc);       // the bed, the biobed, the cabinet
  const stripe = toon(0xb9915f);      // a door leaf's stripe
  const leaves = toon(0x6fb37a);
  const glowCool = kit.glow(0xcfe6ff, 1.3);

  // --- kit pieces ----------------------------------------------------------------------------
  // A kit's Dark skirt is a near-black texture (a black slab in the room): a flat mid grey instead. Its red stripe is muted.
  const fixed = new Map();
  const kitMat = (m) => {
    if (!/Dark|Decal_Red/.test(m.name)) return m;
    if (!fixed.has(m)) {
      const c = m.clone();
      if (m.name.includes('Dark')) { c.map = null; c.color.set(PALETTE.trim); } else c.color.multiplyScalar(0.7);
      fixed.set(m, own(c));
    }
    return fixed.get(m);
  };
  /** A kit piece's parts as cloned geometry, reshaped by `pre` first; the kit's own copies are not touched. */
  const partsOf = (name, pre = null) => M.object(name).children.map((m) => {
    const g = m.geometry.clone();
    if (pre) g.applyMatrix4(pre);
    return { g, mat: kitMat(m.material) };
  });
  const boundsOf = (list) => {
    const box = new THREE.Box3();
    for (const { g } of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
    return box;
  };
  /** A kit material in a tint (a copy, shared by its parts): the kit's decals and trims are bright; a deck wants them quieter. */
  const tints = new Map();
  const tinted = (mat, c) => {
    const key = `${mat.uuid}|${c}`;
    if (!tints.has(key)) { const m = mat.clone(); m.color.multiply(new THREE.Color(c)); tints.set(key, own(m)); }
    return tints.get(key);
  };
  /** A kit piece standing on the floor: its middle at (x, z), its foot at y, turned ry. */
  const piece = (name, x, y, z, ry = 0, { pre = null, tint = null } = {}) => {
    const list = partsOf(name, pre); const box = boundsOf(list);
    for (const { g, mat } of list) { g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); b.add(g, tint ? tinted(mat, tint) : mat, x, y, z, ry); }
  };
  /**
   * A straight run of kit wall from P0 to P1 (points [x, z]): its room face on the line, the room on the side nrm.
   * Whole 4 m panels, never stretched (a stretched panel's ends stand proud of the room face): the last one is slid
   * back to end flush with the run, so it overlaps its neighbour, and stands 1 cm proud of it. Every panel has its
   * cornice (TopPlastic, squashed to the ceiling, tinted warm) and floor trim (BottomMetal), all on one origin.
   */
  const wallRun = (P0, P1, nrm) => {
    const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
    const dx = (P1[0] - P0[0]) / L; const dz = (P1[1] - P0[1]) / L;
    if (!M) { // plain: one box, its room face on the line
      b.box(L, CH, WD, mats.wall, (P0[0] + P1[0]) / 2 - (nrm[0] * WD) / 2, CH / 2, (P0[1] + P1[1]) / 2 - (nrm[1] * WD) / 2, Math.atan2(-dz, dx));
      return;
    }
    const n = Math.max(1, Math.ceil(L / UNIT - 1e-6));
    const th = Math.atan2(-nrm[1], nrm[0]); // the piece's x (room side) turned onto nrm
    const sh = boundsOf(partsOf('walls/WallAstra_Straight')); // the wall's room face (largest x) and its middle
    const off = new THREE.Vector3(-sh.max.x, -sh.min.y, -(sh.min.z + sh.max.z) / 2);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? L / 2 : Math.min(i * UNIT + UNIT / 2, L - UNIT / 2);
      const proud = i === n - 1 && n > 1 ? 0.01 : 0; // the flush panel stands in front of the one it overlaps
      const x = P0[0] + dx * t + nrm[0] * proud; const z = P0[1] + dz * t + nrm[1] * proud;
      for (const [name, pre] of [['walls/WallAstra_Straight', null], ['walls/BottomMetal_Straight', null], ['walls/TopPlastic_Straight', CAP]]) {
        for (const { g, mat } of partsOf(name, pre)) {
          g.translate(off.x, off.y, off.z);
          b.add(g, name.includes('TopPlastic') ? tinted(mat, 0xe6cdb0) : mat, x, 0, z, th);
        }
      }
    }
    // Corner posts: a dark post at each run end, set back behind the panels' face. The kit's panels are open at their
    // ends (a corner shows their hollow inside); the post fills it as shadow, and hides where the panels lean back.
    for (const t of [0, L]) {
      const x = P0[0] + dx * t; const z = P0[1] + dz * t; const back = 0.15 + WD / 2;
      b.box(0.3, CH, WD, mats.wallDark, x - nrm[0] * back, CH / 2, z - nrm[1] * back, Math.atan2(-dz, dx));
    }
  };
  /** A wall light: a flat kit light on a wall, its middle at height y, a little into the room. */
  const wallLight = (x, z, nrm, y = 2.45) => {
    if (!M) return;
    const list = partsOf('props/Prop_Light_Small', FLAT_TO_WALL); const box = boundsOf(list);
    const th = Math.atan2(-nrm[1], nrm[0]);
    for (const { g, mat } of list) {
      g.translate(-box.max.x, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
      b.add(g, mat, x + nrm[0] * 0.2, y, z + nrm[1] * 0.2, th);
    }
  };
  /**
   * A door in a wall (its face at P, the room on the side nrm): the kit's door frame, squashed to the door's width,
   * flush with the room face, and the sliding leaves.
   */
  const doorway = (P, nrm, w, { force = null } = {}) => {
    const along = [-nrm[1], nrm[0]]; // along the wall
    const th = Math.atan2(-along[1], along[0]);
    if (M) {
      const sx = w / FRAME_OPEN;
      const C = [P[0] - nrm[0] * 0.24, P[1] - nrm[1] * 0.24]; // the frame's front is 1 cm out of the wall: no flicker
      piece('platforms/Door_Frame_Square', C[0], 0, C[1], th, { pre: new THREE.Matrix4().makeScale(sx, FRAME_SY, 1) });
    }
    const door = kit.door(P[0], P[1], th, { w, h: DH, frame: M ? 0.02 : 0.2 });
    // The leaves' orange stripes are loud as they come: a muted peach.
    door.group.traverse((o) => { if (o.isMesh && o.material === mats.accentOrange) o.material = stripe; });
    group.add(door.group);
    doors.push({ door, force });
  };

  // --- the corridor: lift to lounge --------------------------------------------------------------
  const corridor = { rect: [0, CL / 2, 2 * CW, CL] };
  // A lighter plum than the kit's carpet, so the start view is not dark.
  const corridorCarpet = own(new THREE.MeshToonMaterial({ color: 0x7d7196, gradientMap: toonRamp }));
  kit.floor(b, corridor, { mat: corridorCarpet }); floors.push(corridor);
  kit.ceiling(b, { rect: [0, CL / 2, 2 * CW, CL] }, CH);
  for (let z = 4; z < CL - 1; z += 4) b.box(2 * CW, 0.03, 0.05, mats.trim, 0, CH - 0.015, z); // the ceiling's panel seams
  for (const s of [-1, 1]) b.box(0.12, 0.02, CL, mats.cove, s * (CW - 0.15), 0.01, CL / 2); // lit carpet edge

  // The doors on the corridor's walls: ZARA's (left, z 7; the hero's), THEO's and BOLT's (left, shut), MIRA's and ECHO's
  // (right, shut), the sick bay's (right, z 29). Each frame is 2.7 m wide at 1.8 m doors, so the walls stop 0.9 m either
  // side of a door (the walk gap is the 1.8 m opening); the shut doors sit in a continuous wall.
  const ZARA = 7.0; const SICK = 29.0;
  // Left wall: the lift to ZARA's door, then on to the lounge.
  wallRun([-CW, 0], [-CW, ZARA - 0.9], [1, 0]);
  wallRun([-CW, ZARA + 0.9], [-CW, CL - 0.01], [1, 0]);
  // Right wall: the lift to the sick bay's door, then on to the lounge.
  wallRun([CW, 0], [CW, SICK - 0.9], [-1, 0]);
  wallRun([CW, SICK + 0.9], [CW, CL - 0.01], [-1, 0]);
  // The corridor walls are solids (their room faces are at ±1.7, their backs 1.21 m out); each door is a gap of 1.8 m in one of them.
  solids.push(
    { rect: [-(CW + OUT) / 2, 3.05, WD, 6.1] }, { rect: [-(CW + OUT) / 2, (7.9 + CL) / 2, WD, CL - 7.9] },
    { rect: [(CW + OUT) / 2, 14.05, WD, 28.1] }, { rect: [(CW + OUT) / 2, (29.9 + CL) / 2, WD, CL - 29.9] },
  );
  // The lift's flanking walls, beside the door (x from -1.7 to -1.2, and the mirror).
  for (const s of [-1, 1]) {
    b.box(0.5, CH, 0.25, mats.wall, s * (CW - 0.25), CH / 2, 0);
    solids.push({ rect: [s * 1.45, 0, 0.5, 0.35] });
  }
  // The lounge's lintel (the wall across the corridor's end, either side of the lounge door's frame).
  const LJ = (FRAME_X * 3.2) / FRAME_OPEN;
  wallRun([LJ, CL], [LX, CL], [0, 1]); wallRun([-LX, CL], [-LJ, CL], [0, 1]);
  solids.push({ rect: [(LJ + LX) / 2, CL - WD / 2 + 0.01, LX - LJ, WD] }, { rect: [-(LJ + LX) / 2, CL - WD / 2 + 0.01, LX - LJ, WD] });
  // Corridor wall lights (on the walls between the doors) and LCARS tags.
  for (const z of [11.0, 25.5, 33.0]) wallLight(-CW, z, [1, 0]);
  for (const z of [3.0, 13.5, 21.5, 33.0]) wallLight(CW, z, [-1, 0]);
  const LCARS = [[-1, 3.0, 'map', ''], [1, 25.0, 'panel', 'DECK 4'], [-1, 29.5, 'panel', 'LOUNGE']];
  for (const [s, z, kind, title] of LCARS) {
    const scr = kit.screen(1.2, 0.72, { title, kind, accent: PALETTE.blue, seed: Math.round(z * 3) });
    scr.position.set(s * (CW - 0.08), 1.7, z); // clear of the wall's panel seams
    scr.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(scr);
  }
  // The five cabins: the wall side (-1 left, 1 right), the door's z, and whether it stands open.
  const CABINS = [
    { name: 'ZARA', side: -1, z: ZARA, color: PALETTE.orange, force: 1 },
    { name: 'MIRA', side: 1, z: 10.5 },
    { name: 'THEO', side: -1, z: 14.0 },
    { name: 'BOLT', side: -1, z: 21.0 },
    { name: 'ECHO', side: 1, z: 17.5 },
  ];
  for (const c of CABINS) {
    const s = c.side;
    doorway([s * CW, c.z], [-s, 0], 1.8, { force: c.force ?? 0 });
    const plate = kit.sign(c.name, { w: 1.0, h: 0.25, color: c.color || PALETTE.peach });
    plate.position.set(s * (CW - 0.01), 1.6, c.z + 2.2); // clear of the door frame, so the whole name shows
    plate.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(plate);
  }

  // --- ZARA's cabin: 4.7 x 5 m off the corridor's left side ------------------------------------
  const cabinRect = { rect: [(CAB_X - CW) / 2, (CAB_Z0 + CAB_Z1) / 2, -CW - CAB_X, CAB_Z1 - CAB_Z0] }; // x from the back wall to the corridor's wall face
  kit.floor(b, cabinRect); floors.push(cabinRect);
  kit.ceiling(b, cabinRect, CH);
  const OUTC = -OUT;               // the cabin's walls reach the corridor's outer wall face
  wallRun([CAB_X, CAB_Z0], [CAB_X, CAB_Z1], [1, 0]); // the back wall
  wallRun([CAB_X, CAB_Z0], [OUTC, CAB_Z0], [0, 1]);  // the near side wall
  wallRun([OUTC, CAB_Z1], [CAB_X, CAB_Z1], [0, -1]); // the far side wall
  solids.push(
    { rect: [CAB_X - WD / 2, (CAB_Z0 + CAB_Z1) / 2, WD, CAB_Z1 - CAB_Z0 + 2 * WD] },
    { rect: [(CAB_X + OUTC) / 2, CAB_Z0 - WD / 2, OUTC - CAB_X, WD] },
    { rect: [(CAB_X + OUTC) / 2, CAB_Z1 + WD / 2, OUTC - CAB_X, WD] },
  );
  // The bed against the back wall: a frame, a headboard, a mattress, a blanket and a pillow (rounded boxes).
  const BED = 7.0;
  b.add(new RoundedBoxGeometry(2.2, 0.36, 1.3, 2, 0.06), mats.panel, -6.5, 0.18, BED);
  b.add(new RoundedBoxGeometry(0.16, 1.1, 1.5, 2, 0.05), mats.panel, -7.45, 0.55, BED);   // headboard
  b.add(new RoundedBoxGeometry(2.05, 0.16, 1.16, 2, 0.06), cream, -6.45, 0.44, BED);       // mattress
  b.add(new RoundedBoxGeometry(1.4, 0.1, 1.2, 2, 0.04), cushion, -5.8, 0.54, BED);         // blanket
  b.add(new RoundedBoxGeometry(0.42, 0.14, 0.8, 2, 0.06), cream, -7.1, 0.56, BED);         // pillow
  solids.push({ rect: [-6.5, BED, 2.2, 1.3], h: 1.15 }); // the headboard's top (the chase camera may pass over the bed)
  wallLight(CAB_X, BED, [1, 0], 2.3); // a reading light over the bed (at 2.9 it read as a block hanging from the ceiling)
  b.box(0.03, 0.14, 0.34, kit.glow(0xffd9a0, 1.3), CAB_X + 0.3, 2.3, BED); // its warm lit face (under the bloom threshold)
  // A rug by the bed (flat, lilac).
  b.add(new RoundedBoxGeometry(1.8, 0.02, 1.5, 2, 0.008), mats.accentLilac, -4.2, 0.01, BED);
  // A shelf on the near wall with a small rocket on it.
  b.box(0.9, 0.05, 0.4, mats.trim, -5.6, 1.6, 4.7);
  b.cyl(0.06, 0.06, 0.38, mats.metal, -5.6, 1.815, 4.7, { seg: 12 });
  b.add(new THREE.ConeGeometry(0.06, 0.16, 12), mats.accentOrange, -5.6, 2.085, 4.7);
  for (const s of [-1, 1]) b.box(0.02, 0.1, 0.12, mats.accentOrange, -5.6 + s * 0.08, 1.68, 4.7);
  solids.push({ rect: [-5.6, 4.7, 0.9, 0.4] });
  // The round window with stars, and its rim (in the near wall, looking into the room).
  const round = kit.starWindow(1.6, 1.6, { speed: 0.01, seed: 9 });
  round.mesh.geometry = own(new THREE.CircleGeometry(0.7, 40));
  round.mesh.position.set(-4.3, 2.0, CAB_Z0 + 0.03);
  group.add(round.mesh);
  b.add(new THREE.TorusGeometry(0.7, 0.07, 8, 40), mats.trim, -4.3, 2.0, CAB_Z0 + 0.02);
  // The desk with a screen, against the far wall; a chair in front of it (code-built, rounded).
  const DESK_X = -4.0; const DESK_Z = 9.05;
  b.add(new RoundedBoxGeometry(1.4, 0.05, 0.62, 2, 0.02), mats.panel, DESK_X, 0.75, DESK_Z);      // top
  for (const s of [-1, 1]) b.add(new RoundedBoxGeometry(0.05, 0.72, 0.6, 2, 0.02), mats.panel, DESK_X + s * 0.66, 0.37, DESK_Z); // sides
  b.add(new RoundedBoxGeometry(1.3, 0.06, 0.04, 2, 0.01), mats.accentOrange, DESK_X, 0.72, DESK_Z + 0.31); // an orange edge strip
  const deskScreen = kit.screen(0.9, 0.5, { title: 'ZARA', accent: PALETTE.orange, seed: 4 });
  deskScreen.position.set(DESK_X, 1.2, DESK_Z - 0.2); deskScreen.rotation.y = Math.PI; group.add(deskScreen);
  b.add(new RoundedBoxGeometry(0.1, 0.36, 0.05, 2, 0.02), mats.metal, DESK_X, 0.93, DESK_Z - 0.2);      // the screen's stand
  const CHX = DESK_X; const CHZ = 8.15;
  b.add(new RoundedBoxGeometry(0.5, 0.08, 0.5, 2, 0.03), cushion, CHX, 0.46, CHZ);                      // seat
  b.add(new RoundedBoxGeometry(0.5, 0.52, 0.07, 2, 0.03), cushion, CHX, 0.76, CHZ - 0.22);              // back
  b.cyl(0.035, 0.035, 0.4, mats.metal, CHX, 0.22, CHZ, { seg: 8 });                                      // post
  b.cyl(0.24, 0.24, 0.04, mats.metal, CHX, 0.02, CHZ, { seg: 16 });                                      // foot
  solids.push({ rect: [DESK_X, DESK_Z - 0.0, 1.4, 0.62], h: 1.0 }, { disc: [CHX, CHZ, 0.3], h: 1.05 }); // desk top ~0.9, chair back ~1.0

  // --- the sick bay: 6 x 6 m off the corridor's right side, through a door at z 29 --------------
  // Inside it runs x 2.91..7.7 (the corridor's right wall is 1.21 m thick: the door is a tunnel 1.2 m long), z 26..32.
  const MX = MED.x1 + WD / 2;   // the back wall's centre
  const medRect = { rect: [(CW + MED.x1) / 2, (MED.z0 + MED.z1) / 2, MED.x1 - CW, MED.z1 - MED.z0] };
  floors.push(medRect);
  kit.ceiling(b, medRect, CH);
  wallRun([OUT, MED.z0], [MED.x1, MED.z0], [0, 1]);
  wallRun([MED.x1, MED.z1], [OUT, MED.z1], [0, -1]);
  wallRun([MED.x1, MED.z0], [MED.x1, MED.z1], [-1, 0]);
  solids.push(
    { rect: [(OUT + MED.x1) / 2, MED.z0 - WD / 2, MED.x1 - OUT, WD] }, { rect: [(OUT + MED.x1) / 2, MED.z1 + WD / 2, MED.x1 - OUT, WD] },
    { rect: [MX, (MED.z0 + MED.z1) / 2, WD, MED.z1 - MED.z0 + 2 * WD] },
  );
  if (M) piece('platforms/Platform_Metal', (CW + MED.x1) / 2, 0, (MED.z0 + MED.z1) / 2, 0, { pre: new THREE.Matrix4().makeScale((MED.x1 - CW) / 4, 1, (MED.z1 - MED.z0) / 4) });
  else b.box(MED.x1 - CW, 0.02, MED.z1 - MED.z0, mats.trim, (CW + MED.x1) / 2, 0.01, (MED.z0 + MED.z1) / 2);
  doorway([CW, SICK], [-1, 0], 1.8, { force: null });
  const medPlate = kit.sign('Sick bay', { w: 1.2, h: 0.3, color: PALETTE.teal });
  medPlate.position.set(CW - 0.01, 1.6, 31.2); medPlate.rotation.y = -Math.PI / 2; group.add(medPlate);

  // Quest: medbay (the props and the lamp; the quest's spot is in 'stations' below)
  // The biobed, white with a blue mattress and a lit panel over it.
  b.add(new RoundedBoxGeometry(2.2, 0.62, 0.9, 2, 0.06), cream, 5.4, 0.31, 29);
  b.add(new RoundedBoxGeometry(2.1, 0.1, 0.8, 2, 0.04), mats.accentBlue, 5.4, 0.67, 29);
  b.add(new RoundedBoxGeometry(0.35, 0.1, 0.6, 2, 0.04), cream, 4.65, 0.77, 29);             // the pillow, at the head end
  b.box(1.6, 0.04, 0.9, glowCool, 5.4, 2.9, 29);
  solids.push({ rect: [5.4, 29, 2.2, 0.9], h: 0.85 }); // the biobed: its top is ~0.72
  // The scanner: a slim gantry over the biobed, two posts 1.6 m apart (either side of the bed) with a beam and a light under it.
  for (const z of [28.2, 29.8]) { b.cyl(0.07, 0.07, 2.5, mats.metal, 5.4, 1.25, z, { seg: 10 }); solids.push({ disc: [5.4, z, 0.15] }); }
  b.add(new RoundedBoxGeometry(0.3, 0.22, 1.9, 2, 0.06), mats.metal, 5.4, 2.6, 29);
  b.box(0.1, 0.04, 1.6, glowCool, 5.4, 2.47, 29);
  // The cabinet on the back wall, white, with a lit door.
  b.add(new RoundedBoxGeometry(0.5, 1.2, 1.4, 2, 0.05), cream, 7.45, 0.6, 27.3);
  b.box(0.02, 0.8, 1.1, glowCool, 7.19, 0.7, 27.3);
  solids.push({ rect: [7.45, 27.3, 0.5, 1.4], h: 1.25 }); // the cabinet: 1.2 m
  const medLamp = kit.lamp(PALETTE.teal); medLamp.position.set(7.45, 1.3, 27.3); group.add(medLamp);
  // The screen on the room's near wall.
  const medScreen = kit.screen(1.4, 0.8, { title: 'SICK BAY', accent: PALETTE.teal, seed: 77 });
  medScreen.position.set(4.9, 1.7, MED.z0 + 0.14); group.add(medScreen);
  // A red-and-white cross on the far wall, and a privacy curtain on a track by the cabinet.
  const crossCv = document.createElement('canvas'); crossCv.width = 128; crossCv.height = 128;
  const cg = crossCv.getContext('2d');
  cg.fillStyle = '#ffffff'; cg.fillRect(0, 0, 128, 128);
  cg.fillStyle = '#d23b3b'; cg.fillRect(48, 16, 32, 96); cg.fillRect(16, 48, 96, 32);
  const crossTex = own(new THREE.CanvasTexture(crossCv)); crossTex.colorSpace = THREE.SRGBColorSpace;
  const cross = new THREE.Mesh(own(new THREE.PlaneGeometry(0.6, 0.6)), own(new THREE.MeshBasicMaterial({ map: crossTex })));
  cross.position.set(4.7, 2.3, MED.z1 - 0.14); cross.rotation.y = Math.PI; group.add(cross);
  const curtainMat = toon(0xcfe9e6);
  b.box(0.05, 0.05, 3.6, mats.metal, 6.8, 2.5, 28.9);   // the track
  b.box(0.04, 2.3, 3.5, curtainMat, 6.8, 1.3, 28.9);    // the curtain, hung from it
  solids.push({ rect: [6.8, 28.9, 0.2, 3.6] });
  // End of quest: medbay

  // --- the cabin's far wall is the corridor's; the lounge: a window that bows out across its far wall ----
  const lounge = { rect: [0, (CL + LZE) / 2, 2 * LX, LZE - CL] };
  const bow = { ring: [0, ZC, RIN - 1.2, RIN], from: -ZW, to: ZW }; // inner edge at the rectangle's far side, outer at the sill
  kit.floor(b, lounge); kit.floor(b, bow); floors.push(lounge, bow);
  kit.ceiling(b, lounge, CH, { light: false }); kit.ceiling(b, bow, CH, { light: false });
  // The lounge ceiling is a darker slab (the kit's is a glare), with a seam every 2 m and a cool band over the window.
  const lowCeil = toon(0x8f8880);
  b.add(new THREE.PlaneGeometry(2 * LX, LZE - CL).rotateX(Math.PI / 2), lowCeil, 0, CH - 0.02, (CL + LZE) / 2);
  for (let z = CL + 2; z < LZE - 0.5; z += 2) b.box(2 * LX, 0.03, 0.05, mats.trim, 0, CH - 0.035, z);
  b.box(14, 0.05, 0.25, mats.coveCool, 0, 3.42, 48.2);
  if (M) piece('decals/Decal_Logo', 0, CH - 0.03, 45.9, 0, { pre: new THREE.Matrix4().makeRotationZ(Math.PI), tint: 0x9c8552 }); // a muted gold logo on the ceiling, the right way up
  // The lounge's side walls, the kit's panels (their room faces at x ±8).
  wallRun([-LX, CL], [-LX, LZE], [1, 0]);
  wallRun([LX, CL], [LX, LZE], [-1, 0]);
  solids.push({ rect: [-(LX + WD / 2), (CL + LZE) / 2, WD, LZE - CL] }, { rect: [LX + WD / 2, (CL + LZE) / 2, WD, LZE - CL] });
  // A light inlay round the centre table.
  b.add(new THREE.TorusGeometry(4.0, 0.06, 6, 64).rotateX(Math.PI / 2), mats.coveCool, 0, 0.02, CL + 5.4);
  // The lounge door (opens as she comes): a kit frame, its leaves lighter than the kit's dark ones.
  doorway([0, CL], [0, 1], 3.2, { force: null });
  // The lounge's door leaves are dark in the kit; a lighter leaf reads as a door, not a slab.
  const leafMat = toon(0xb4ada4);
  doors[doors.length - 1].door.group.traverse((o) => { if (o.isMesh && o.material === mats.wallDark) o.material = leafMat; });
  const loungeSign = kit.sign('Lounge', { w: 1.6, h: 0.32, color: PALETTE.peach });
  loungeSign.position.set(0, 2.9, CL - 0.14); loungeSign.rotation.y = Math.PI;
  group.add(loungeSign);
  // The window: a low sill, the kit's columns for mullions, and the glass (stars drifting, the ring turning).
  solids.push(kit.wallArc(b, 0, ZC, RIN + 0.25, -ZW, ZW, { h: 0.9, cove: false }));
  for (const a of [-0.2, -0.1, 0, 0.1, 0.2]) {
    const x = (RIN - 0.04) * Math.sin(a); const z = ZC + (RIN - 0.04) * Math.cos(a);
    if (M) piece('columns/Column_Round', x, 0, z, 0, { pre: new THREE.Matrix4().makeScale(0.22, 0.74, 0.22) }); // up to the ceiling, past the glass top (3.6 m)
    else b.box(0.12, 2.7, 0.12, mats.trim, x, 2.25, z, a);
  }
  const glass = kit.starWindow(2 * RIN * ZW, 2.7, { speed: 0.01, seed: 5 });
  glass.mesh.geometry = own(new THREE.CylinderGeometry(RIN - 0.02, RIN - 0.02, 2.7, 40, 1, true, -ZW, 2 * ZW));
  glass.mesh.material.side = THREE.DoubleSide; // seen from inside, the concave side
  glass.mesh.position.set(0, 2.25, ZC);
  group.add(glass.mesh);

  // Round tables with three chairs each (the table and each seat are solid). The pedestal is a turned lathe.
  // The chairs are the bridge's (a curved back, a gold ring, arms) at 0.85 scale, cushions in the deck's plum.
  const frameDark = toon(0x3e434e); const gold = toon(PALETTE.gold); const glowBlue = kit.glow(PALETTE.blue, 1.3);
  /** A curved slab for a chair's back: a plan annulus (radii r0..r1) round the seat, from -z to +-half, h high. */
  const sector = (r0, r1, half, h) => {
    const sh = new THREE.Shape(); const N = 14;
    for (let i = 0; i <= N; i++) { const p = -half + (2 * half * i) / N; const v = [r1 * Math.sin(p), r1 * Math.cos(p)]; if (i) sh.lineTo(...v); else sh.moveTo(...v); }
    for (let i = N; i >= 0; i--) { const p = -half + (2 * half * i) / N; sh.lineTo(r0 * Math.sin(p), r0 * Math.cos(p)); }
    return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 1 }).rotateX(-Math.PI / 2);
  };
  /** A chair at (x, z), its seat facing `facing` (about y; the seat's front is +z, its back behind). */
  const chair = (x, z, facing) => {
    const K = 0.85;
    const at = (geo, mat, dx, dy, dz) => { b.add(geo.translate(dx, dy, dz).scale(K, K, K).rotateY(facing), mat, x, 0, z); };
    at(new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.33, 0.03], [0.3, 0.05], [0.07, 0.11], [0.06, 0.4], [0.12, 0.46], [0, 0.49]].map(([r, y]) => new THREE.Vector2(r, y)), 18), frameDark, 0, 0, 0);
    at(new THREE.TorusGeometry(0.31, 0.012, 6, 36).rotateX(Math.PI / 2), gold, 0, 0.05, 0);
    at(new RoundedBoxGeometry(0.66, 0.12, 0.62, 2, 0.05), cushion, 0, 0.55, 0);
    at(new THREE.BoxGeometry(0.66, 0.025, 0.025), gold, 0, 0.5, 0.32);
    at(sector(0.36, 0.46, 0.8, 0.9), cushion, 0, 0.6, 0);
    at(sector(0.355, 0.465, 0.82, 0.04), gold, 0, 1.49, 0);
    for (const sd of [-1, 1]) {
      at(new RoundedBoxGeometry(0.09, 0.1, 0.44, 2, 0.03), frameDark, sd * 0.38, 0.68, 0.02);
      at(new RoundedBoxGeometry(0.08, 0.14, 0.3, 2, 0.03), frameDark, sd * 0.36, 0.56, 0);
      at(new THREE.BoxGeometry(0.05, 0.012, 0.3), glowBlue, sd * 0.38, 0.733, 0.02);
    }
    solids.push({ disc: [x, z, 0.36] });
  };
  function table(x, z, turn = 0) {
    b.cyl(0.6, 0.6, 0.05, mats.metal, x, 0.75, z, { seg: 20 });
    b.add(new THREE.LatheGeometry([[0.001, 0.0], [0.34, 0.0], [0.34, 0.03], [0.1, 0.1], [0.07, 0.2], [0.07, 0.68], [0.001, 0.72]].map(([r, y]) => new THREE.Vector2(r, y)), 16), mats.trim, x, 0, z);
    solids.push({ disc: [x, z, 0.6] });
    for (let k = 0; k < 3; k++) {
      const a = turn + (k * Math.PI * 2) / 3;
      chair(x + 0.85 * Math.sin(a), z + 0.85 * Math.cos(a), a + Math.PI);
    }
  }
  table(-4.6, CL + 3.2); table(-4.6, CL + 6.4); table(0, CL + 5.4, 0.4); table(3.6, CL + 2.2, 0.2); table(3.4, CL + 8.6);

  // The bar along the starboard side: a counter (rounded), a metal top, a glowing food replicator on its lounge face.
  b.add(new RoundedBoxGeometry(1.0, 1.05, 5.0, 2, 0.05), mats.panel, 6.6, 0.525, CL + 5.0);
  b.add(new RoundedBoxGeometry(1.12, 0.06, 5.12, 2, 0.02), mats.metal, 6.6, 1.085, CL + 5.0);
  b.box(0.03, 0.92, 1.38, mats.trim, 6.09, 0.95, CL + 5.0);
  solids.push({ rect: [6.6, CL + 5.0, 1.0, 5.0] });
  for (const z of [CL + 3.2, CL + 5.0, CL + 6.8]) {
    b.cyl(0.22, 0.22, 0.08, cushion, 5.3, 0.78, z, { seg: 14 });
    b.cyl(0.04, 0.04, 0.72, mats.metal, 5.3, 0.38, z, { seg: 6 });
    b.cyl(0.2, 0.2, 0.04, mats.trim, 5.3, 0.02, z, { seg: 14 });
    solids.push({ disc: [5.3, z, 0.25] });
  }
  const hatch = new THREE.Mesh(own(new THREE.PlaneGeometry(1.3, 0.8)), kit.glow(PALETTE.teal, 1.1));
  hatch.position.set(6.06, 0.95, CL + 5.0); hatch.rotation.y = -Math.PI / 2;
  group.add(hatch);
  const menu = kit.screen(1.5, 0.9, { title: 'MENU', accent: PALETTE.lilac, seed: 21 });
  menu.position.set(7.97, 1.9, CL + 5.0); menu.rotation.y = -Math.PI / 2;
  group.add(menu);

  // A raised booth by the window (a 0.15 m dais on the kit's plates, its inner edge railed with the kit's rail).
  const DAIS = { x0: -7.9, x1: -5.6, z0: 45.5, z1: 48.7 };
  const dw = DAIS.x1 - DAIS.x0; const dd = DAIS.z1 - DAIS.z0; const dcx = (DAIS.x0 + DAIS.x1) / 2; const dcz = (DAIS.z0 + DAIS.z1) / 2;
  b.add(new RoundedBoxGeometry(dw, 0.15, dd, 2, 0.03), mats.panel, dcx, 0.075, dcz);
  if (M) piece('platforms/Platform_Metal', dcx, 0.15, dcz, 0, { pre: new THREE.Matrix4().makeScale(dw / 4, 1, dd / 4) });
  else b.box(dw, 0.02, dd, mats.trim, dcx, 0.16, dcz);
  if (M) piece('props/Prop_Rail_4', DAIS.x1, 0.15, dcz, 0, { pre: new THREE.Matrix4().makeScale(1, 1, dd / 3.93) });
  else b.box(0.06, 0.86, dd, mats.metal, DAIS.x1, 0.58, dcz);
  solids.push({ rect: [DAIS.x1, dcz, 0.15, dd] });

  // Potted plants (solid pots: a turned lathe each, with a clump of leaves).
  for (const [x, z] of [[-7.1, CL + 1.2], [-7.1, CL + 6.0], [7.3, CL + 0.9], [-3.0, CL + 10.1]]) {
    b.add(new THREE.LatheGeometry([[0.001, 0.0], [0.26, 0.0], [0.3, 0.3], [0.24, 0.52], [0.001, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)), 14), mats.trim, x, 0, z);
    b.add(new THREE.IcosahedronGeometry(0.44, 1), leaves, x, 0.95, z);
    b.add(new THREE.IcosahedronGeometry(0.28, 1), leaves, x + 0.22, 1.3, z - 0.1);
    solids.push({ disc: [x, z, 0.3] });
  }

  // Wall lights in the lounge (flat kit lights on the side walls), and the warm coves.
  for (const z of [CL + 5.0]) { wallLight(-LX, z, [1, 0], 2.7); wallLight(LX, z, [-1, 0], 2.7); }

  // Static parts go in now (a few draw calls).
  b.flush(group);

  // Warm light in the lounge (one soft point light; the coves and screens do the rest).
  const warm = new THREE.PointLight(0xffd9a8, 4, 24, 1.4);
  warm.position.set(0, 2.3, CL + 5.4);
  group.add(warm);
  // A second, softer one over the window end, so the far corners are not dim.
  const warm2 = new THREE.PointLight(0xffe6c8, 2.5, 20, 1.4);
  warm2.position.set(2.5, 2.3, CL + 8.5);
  group.add(warm2);

  // Quest: medbay (Theo stands by the biobed; he is placed at the crew spot)
  const stations = { medbay: { x: 4.6, z: 30.7, face: Math.PI, lamp: medLamp, y: 2.2 } };
  const crewSpots = { medbay: { x: 5.6, z: 31.2, face: Math.PI } };

  const views = [
    { name: 'corridor', pos: [0, 1.6, 2.5], look: [0, 1.6, 30] },
    { name: 'cabin', pos: [-2.2, 1.5, 7.0], look: [-7.0, 1.3, 7.0] },
    { name: 'cabin-desk', pos: [-6.4, 1.5, 5.4], look: [-3.8, 1.2, 9.0] },
    { name: 'doors', pos: [-0.8, 1.6, 16.0], look: [1.8, 1.4, 14.0] },
    { name: 'screens', pos: [-0.4, 1.6, 21.0], look: [1.7, 1.6, 25.0] },
    { name: 'lounge', pos: [0, 1.6, CL + 1.5], look: [0, 1.7, LAPEX] },
    { name: 'lounge-bar', pos: [1.6, 1.6, CL + 2.5], look: [7.5, 1.3, CL + 6.0] },
    { name: 'window', pos: [-1.5, 1.5, CL + 2.0], look: [1.0, 1.9, LAPEX] },
    { name: 'booth', pos: [-3.2, 1.5, 42.6], look: [-7.2, 1.0, 47.2] },
    { name: 'sickbay', pos: [1.9, 1.6, 29.0], look: [6.4, 1.0, 29.3] }, // from the door, through the arch
    { name: 'biobed', pos: [6.9, 1.5, 31.2], look: [4.2, 0.9, 28.8] },
  ];

  return {
    group, floors, solids, ceiling: CH,
    stations, crewSpots, views,
    update(dt, t, ctx) {
      glass.update(t); round.update(t);
      hatch.material.color.copy(TEAL).multiplyScalar(1.05 + 0.1 * Math.sin(t * 2.2)); // the replicator breathes (kept under white)
      for (const d of doors) d.door.update(dt, ctx.herX, ctx.herZ, d.force);
    },
  };
}
