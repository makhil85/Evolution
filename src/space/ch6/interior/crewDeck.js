// Chapter 6 interior: Deck 4, the crew deck (TNG style, cosy and future-looking).
// From the lift a 3.4 m corridor runs 38 m to the lounge. Its walls stand 2.6 m,
// then lean in under a light cove to the 3.6 m ceiling (the TNG look), with a
// carpet and lit edge strips. Five cabin doors line it: ZARA's on the left (the
// hero's cabin, always open: a bed, a desk with a screen, a round window with
// stars, a shelf with a rocket) and four shut ones (MIRA, THEO, BOLT, ECHO).
// At the end the lounge (16 x 11 m, like Ten Forward) has a window that bows out
// across its far wall, round tables, a bar with a glowing food replicator and
// warm light. No stations here: the crew are on the other decks.
import * as THREE from 'three';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

const CH = 3.6;                 // ceiling
const LOW = 2.6;                // lower wall: the door frames' top
const CW = 1.7;                 // corridor half-width (inside faces)
const WX = CW + 0.125;          // corridor wall centre (0.25 m thick)
const CL = 38;                  // corridor length: lift to lounge
const LX = 8.125;               // lounge side wall centre (inside face 8.0)
const LAPEX = CL + 12;           // lounge far wall at its middle (inside face)
const SAG = 1.2;                // the window's ends sit this far back from its middle
const RIN = (64 + SAG * SAG) / (2 * SAG); // the window's radius (an arc through x = ±8)
const ZW = Math.asin(8 / RIN);  // half the window's angle
const ZC = LAPEX - RIN;         // the window's circle centre
const LZE = LAPEX - SAG;        // where the window meets the side walls
const TEAL = new THREE.Color(PALETTE.teal);

export function buildDeck(kit) {
  const { mats } = kit;
  const group = new THREE.Group();
  const b = kit.batch();
  const floors = []; const solids = []; const doors = []; // doors: { door, force } (force: 0 shut, 1 open, null by her)

  // --- the corridor: lift to lounge ------------------------------------------------
  const corridor = { rect: [0, CL / 2, 2 * CW, CL] };
  kit.floor(b, corridor); floors.push(corridor);
  kit.ceiling(b, { rect: [0, CL / 2, 2.4, CL] }, CH); // narrower at the top, where the slopes meet it
  for (const s of [-1, 1]) {
    b.box(0.12, 0.02, CL, mats.cove, s * (CW - 0.15), 0.01, CL / 2); // lit carpet edge
    // The upper wall leans in from the lower wall's top to the ceiling.
    const slope = Math.hypot(0.5, CH - LOW); const tilt = Math.atan2(0.5, CH - LOW);
    b.add(new THREE.BoxGeometry(0.12, slope, CL), mats.wall, s * (CW - 0.25), (LOW + CH) / 2, CL / 2, 0, 0, s * tilt);
    b.box(0.06, 0.06, CL, mats.cove, s * CW, LOW, CL / 2); // light cove where the slope starts
  }
  // Lower walls. ZARA's door is a gap (she walks through it); the others are solid behind their doors.
  // A mid-tone (not the bright wall colour) so the start view is not over-lit.
  const lowerMat = kit.own(new THREE.MeshToonMaterial({ color: 0xb9b3aa, gradientMap: toonRamp }));
  const lowerB = { box: (w, h, d, m, ...r) => b.box(w, h, d, m === mats.wall ? lowerMat : m, ...r) };
  solids.push(
    kit.wall(lowerB, -WX, 0, -WX, 6.1, { h: LOW }), kit.wall(lowerB, -WX, 7.9, -WX, CL, { h: LOW }), kit.wall(lowerB, WX, 0, WX, CL, { h: LOW }),
    kit.wall(lowerB, -WX, 0, -1.2, 0, { h: LOW }), kit.wall(lowerB, 1.2, 0, WX, 0, { h: LOW }), // beside the lift door
  );
  // Lintels over the lift and the lounge doorways.
  b.box(2 * WX, CH - LOW, 0.25, mats.wall, 0, (LOW + CH) / 2, 0);
  b.box(2 * WX, CH - LOW, 0.25, mats.wall, 0, (LOW + CH) / 2, CL);

  // The five cabins: the wall side (-1 left, 1 right) and the door's z.
  const CABINS = [
    { name: 'ZARA', side: -1, z: 7.0, color: PALETTE.orange, force: 1 },
    { name: 'MIRA', side: 1, z: 10.5 },
    { name: 'THEO', side: -1, z: 14.0 },
    { name: 'BOLT', side: -1, z: 21.0 },
    { name: 'ECHO', side: 1, z: 17.5 },
  ];
  for (const c of CABINS) {
    const s = c.side;
    const door = kit.door(s * CW, c.z, s < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 1.8, h: 2.4 });
    group.add(door.group);
    doors.push({ door, force: c.force ?? 0 });
    const plate = kit.sign(c.name, { w: 1.0, h: 0.25, color: c.color || PALETTE.peach });
    plate.position.set(s * (CW - 0.01), 1.6, c.z + 2.2); // clear of the door post, so the whole name shows
    plate.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(plate);
  }

  // --- ZARA's cabin: 5 x 5 m off the corridor's left side ---------------------------
  const X0 = -CW; const X1 = -6.7; const Z0 = 4.5; const Z1 = 9.5; const BX = X1 - 0.125; // back wall centre
  const cabin = { rect: [(X0 + X1) / 2, (Z0 + Z1) / 2, X0 - X1, Z1 - Z0] };
  kit.floor(b, cabin); floors.push(cabin);
  kit.ceiling(b, cabin, CH);
  solids.push(kit.wall(b, BX, Z0, BX, Z1, { h: CH }), kit.wall(b, -WX, Z0, BX, Z0, { h: CH }), kit.wall(b, -WX, Z1, BX, Z1, { h: CH }));
  // Bed against the back wall: frame, mattress, blanket, pillow, headboard.
  b.box(0.12, 1.0, 1.3, mats.panel, -6.64, 0.5, 7.0);
  b.box(2.1, 0.36, 1.2, mats.panel, -5.65, 0.18, 7.0);
  b.box(2.0, 0.16, 1.1, mats.wall, -5.6, 0.44, 7.0);
  b.box(1.5, 0.1, 1.14, mats.accentBlue, -5.1, 0.57, 7.0);
  b.box(0.4, 0.12, 0.9, mats.wall, -6.25, 0.58, 7.0);
  solids.push({ rect: [-5.65, 7.0, 2.1, 1.2] });
  b.box(2.2, 0.012, 1.6, mats.accentLilac, -3.0, 0.006, 7.0); // a rug
  // A shelf on the near side wall with a small rocket on it.
  b.box(0.9, 0.05, 0.4, mats.trim, -5.6, 1.6, 4.85);
  b.cyl(0.06, 0.06, 0.38, mats.metal, -5.6, 1.815, 4.85, { seg: 12 });
  b.add(new THREE.ConeGeometry(0.06, 0.16, 12), mats.accentOrange, -5.6, 2.085, 4.85);
  for (const s of [-1, 1]) b.box(0.02, 0.1, 0.12, mats.accentOrange, -5.6 + s * 0.08, 1.68, 4.85);
  solids.push({ rect: [-5.6, 4.85, 0.9, 0.4] });
  // The round window with stars, and its rim (on the near wall, looking into the room).
  const round = kit.starWindow(1.6, 1.6, { speed: 0.01, seed: 9 });
  round.mesh.geometry = kit.own(new THREE.CircleGeometry(0.7, 40));
  round.mesh.position.set(-4.33, 2.0, 4.64); // between the wall's panel seams
  group.add(round.mesh);
  b.add(new THREE.TorusGeometry(0.7, 0.07, 8, 40), mats.trim, -4.33, 2.0, 4.64);
  // LCARS panels along the corridor walls, at eye level.
  for (const [s, z, kind, title] of [[-1, 3.0, 'map', ''], [1, 25.0, 'panel', 'DECK 4'], [-1, 29.5, 'panel', 'LOUNGE']]) {
    const scr = kit.screen(1.2, 0.72, { title, kind, accent: PALETTE.blue, seed: Math.round(z * 3) });
    scr.position.set(s * (CW - 0.08), 1.7, z); // clear of the wall's panel seams
    scr.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(scr);
  }
  // The desk with a screen, against the far side wall.
  const desk = kit.console(-3.5, 9.0, Math.PI, { w: 1.4, screen: { title: 'ZARA', accent: PALETTE.orange, seed: 4 } });
  group.add(desk.group); solids.push(desk.solid);

  // --- the lounge (like Ten Forward): its far wall is a window that bows out ------
  const lounge = { rect: [0, (CL + LZE) / 2, 16, LZE - CL] };
  const bow = { ring: [0, ZC, RIN - 1.2, RIN], from: -ZW, to: ZW }; // inner edge at the rectangle's far side, outer at the sill
  kit.floor(b, lounge); kit.floor(b, bow); floors.push(lounge, bow);
  kit.ceiling(b, lounge, CH); kit.ceiling(b, bow, CH, { light: false });
  solids.push(kit.wall(b, -LX, CL, -LX, LZE, { h: CH }), kit.wall(b, LX, CL, LX, LZE, { h: CH }));
  solids.push(kit.wall(b, -LX, CL, -WX, CL, { h: CH }), kit.wall(b, WX, CL, LX, CL, { h: CH }));
  // A light inlay round the centre table.
  b.add(new THREE.TorusGeometry(4.0, 0.06, 6, 64).rotateX(Math.PI / 2), mats.coveCool, 0, 0.02, CL + 5.4);
  // The window: a low sill, mullions, and the glass (stars drifting, the ring turning).
  solids.push(kit.wallArc(b, 0, ZC, RIN + 0.25, -ZW, ZW, { h: 0.9, cove: false }));
  for (const a of [-0.2, -0.1, 0, 0.1, 0.2]) b.box(0.12, 2.7, 0.12, mats.trim, (RIN - 0.04) * Math.sin(a), 2.25, ZC + (RIN - 0.04) * Math.cos(a), a);
  const glass = kit.starWindow(2 * RIN * ZW, 2.7, { speed: 0.01, seed: 5 });
  glass.mesh.geometry = kit.own(new THREE.CylinderGeometry(RIN - 0.02, RIN - 0.02, 2.7, 40, 1, true, -ZW, 2 * ZW));
  glass.mesh.material.side = THREE.DoubleSide; // seen from inside, the concave side
  glass.mesh.position.set(0, 2.25, ZC);
  group.add(glass.mesh);
  // The lounge door (opens as she comes).
  const lDoor = kit.door(0, CL, 0, { w: 3.2, h: 2.4 });
  // The leaves are dark in the kit; a lighter leaf reads as a door, not a slab.
  const leafMat = kit.own(new THREE.MeshToonMaterial({ color: 0xb4ada4, gradientMap: toonRamp }));
  lDoor.group.traverse((o) => { if (o.isMesh && o.material === mats.wallDark) o.material = leafMat; });
  group.add(lDoor.group); doors.push({ door: lDoor, force: null });
  const loungeSign = kit.sign('Lounge', { w: 1.6, h: 0.32, color: PALETTE.peach });
  loungeSign.position.set(0, 3.0, CL - 0.14); loungeSign.rotation.y = Math.PI;
  group.add(loungeSign);

  // Round tables with three chairs each (merged; the table and each seat are solid).
  function table(x, z, turn = 0) {
    b.cyl(0.6, 0.6, 0.05, mats.metal, x, 0.75, z, { seg: 20 });
    b.cyl(0.08, 0.08, 0.72, mats.trim, x, 0.38, z, { seg: 8 });
    b.cyl(0.36, 0.36, 0.04, mats.trim, x, 0.02, z, { seg: 16 });
    solids.push({ disc: [x, z, 0.6] });
    for (let k = 0; k < 3; k++) {
      const a = turn + (k * Math.PI * 2) / 3; const sx = Math.sin(a); const sz = Math.cos(a);
      const cx = x + 0.85 * sx; const cz = z + 0.85 * sz;
      b.cyl(0.22, 0.22, 0.07, mats.panel, cx, 0.45, cz, { seg: 14 });
      b.cyl(0.03, 0.03, 0.42, mats.trim, cx, 0.21, cz, { seg: 6 });
      b.box(0.42, 0.5, 0.07, mats.panel, x + 1.11 * sx, 0.72, z + 1.11 * sz, a); // backrest, outboard
      solids.push({ disc: [cx, cz, 0.3] });
    }
  }
  table(-4.6, CL + 3.2); table(-4.6, CL + 8.0); table(0, CL + 5.4, 0.4); table(3.6, CL + 2.2, 0.2); table(3.4, CL + 8.6);

  // The bar along the starboard side, with a glowing food replicator on its lounge face.
  b.box(1.0, 1.05, 5.0, mats.panel, 6.6, 0.525, CL + 5.0);
  b.box(1.14, 0.07, 5.14, mats.metal, 6.6, 1.085, CL + 5.0);
  b.box(0.03, 0.92, 1.38, mats.trim, 6.09, 0.95, CL + 5.0);
  solids.push({ rect: [6.6, CL + 5.0, 1.0, 5.0] });
  for (const z of [CL + 3.2, CL + 5.0, CL + 6.8]) {
    b.cyl(0.22, 0.22, 0.08, mats.panel, 5.3, 0.78, z, { seg: 14 });
    b.cyl(0.04, 0.04, 0.72, mats.metal, 5.3, 0.38, z, { seg: 6 });
    b.cyl(0.2, 0.2, 0.04, mats.trim, 5.3, 0.02, z, { seg: 14 });
    solids.push({ disc: [5.3, z, 0.25] });
  }
  const hatch = new THREE.Mesh(kit.own(new THREE.PlaneGeometry(1.3, 0.8)), kit.glow(PALETTE.teal, 1.1));
  hatch.position.set(6.06, 0.95, CL + 5.0); hatch.rotation.y = -Math.PI / 2;
  group.add(hatch);
  const menu = kit.screen(1.5, 0.9, { title: 'MENU', accent: PALETTE.lilac, seed: 21 });
  menu.position.set(7.97, 1.9, CL + 5.0); menu.rotation.y = -Math.PI / 2;
  group.add(menu);

  // Potted plants (solid pots).
  const leaves = kit.own(new THREE.MeshToonMaterial({ color: 0x6fb37a, gradientMap: toonRamp }));
  for (const [x, z] of [[-7.1, CL + 1.2], [-7.1, CL + 9.4], [7.3, CL + 0.9], [-3.0, CL + 10.1]]) {
    b.cyl(0.26, 0.2, 0.5, mats.trim, x, 0.25, z, { seg: 14 });
    b.add(new THREE.IcosahedronGeometry(0.5, 1), leaves, x, 1.05, z);
    solids.push({ disc: [x, z, 0.3] });
  }

  // Static parts go in now (a few draw calls).
  b.flush(group);

  // Warm light in the lounge (one soft point light; the coves and screens do the rest).
  const warm = new THREE.PointLight(0xffd9a8, 8, 24, 1.4);
  warm.position.set(0, 2.9, CL + 5.4);
  group.add(warm);

  const views = [
    { name: 'corridor', pos: [0, 1.6, 2.5], look: [0, 1.6, 30] },
    { name: 'cabin', pos: [-2.0, 1.5, 7.0], look: [-6.0, 1.3, 7.0] },
    { name: 'cabin-desk', pos: [-5.6, 1.4, 8.6], look: [-3.6, 1.9, 4.6] },
    { name: 'doors', pos: [-0.8, 1.6, 16.0], look: [1.8, 1.4, 14.0] },
    { name: 'screens', pos: [-0.4, 1.6, 21.0], look: [1.7, 1.6, 25.0] },
    { name: 'lounge', pos: [0, 1.6, CL - 2.4], look: [0, 1.7, LAPEX] },
    { name: 'lounge-bar', pos: [1.6, 1.6, CL + 2.5], look: [7.5, 1.3, CL + 6.0] },
    { name: 'window', pos: [-1.5, 1.5, CL + 2.0], look: [1.0, 1.9, LAPEX] },
  ];

  return {
    group, floors, solids, ceiling: CH, stations: {}, crewSpots: {}, views,
    update(dt, t, ctx) {
      glass.update(t); round.update(t);
      hatch.material.color.copy(TEAL).multiplyScalar(1.05 + 0.1 * Math.sin(t * 2.2)); // the replicator breathes (kept under white)
      for (const d of doors) d.door.update(dt, ctx.herX, ctx.herZ, d.force);
    },
    // Everything here was made by the kit, which frees it in kit.dispose().
    dispose() { lowerMat.dispose(); },
  };
}
