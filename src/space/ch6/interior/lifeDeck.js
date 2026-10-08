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
//     trees in pots, and the planning console at the far end.
// A room is a frame(a): local x runs along the wall and local z points out of
// the ring, so frame.at(x, z) gives deck metres and a prop's yaw is a + ry.
import * as THREE from 'three';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

const CZ = 40;          // the ring's centre (z), on x = 0
const R_OUT = 40;       // the corridor's outer wall (the lift is on it)
const R_IN = 36.8;      // the corridor's inner wall: the rooms' outer walls
const CORR = 0.95;      // the corridor runs from the lift to ±CORR rad
const LIFT_GAP = 0.031; // the lift's opening in the outer wall (±1.24 m, its frame)
const DOOR_GAP = 0.03;  // a door's opening in a wall (±1.1 m, to the frame's outer edge)
const LAB = { a: Math.PI - 0.57, th: 0.36, r0: 25.5 };      // angle, width (rad), inner radius
const HYD = { a: Math.PI + 0.55, th: 0.5, r0: 20.8, h: 5 }; // the bay is 5 m tall

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

export function buildDeck(kit) {
  const group = new THREE.Group();
  const b = kit.batch();
  const solids = []; const floors = []; const doors = []; const wins = []; const bubbles = [];
  const toon = (color) => kit.own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  const M = {
    leafA: toon(0x5fbf6a), leafB: toon(0x3f9e5a), leafC: toon(0x9ad17a), bark: toon(0x8a6a4a),
    // The algae and the bubbles are see-through (no depth write), so the bubbles show inside the tanks.
    algae: kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2ee86a).multiplyScalar(1.3), transparent: true, opacity: 0.8, depthWrite: false })),
    bubble: kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe6fff0).multiplyScalar(1.6), transparent: true, depthWrite: false })),
    uv: kit.glow(0xa878ff, 1.8),
    grow: kit.glow(0xff7ad9, 1.5), water: kit.glow(0x6fe0d0, 0.9),
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

  // Walls are solids too (walkmap.js); a run is cut where a door or the lift is.
  const ringRun = (r, a0, a1, h, doorAt = []) => {
    let from = a0;
    for (const d of doorAt) { solids.push(kit.wallArc(b, 0, CZ, r, from, d - DOOR_GAP, { h })); from = d + DOOR_GAP; }
    solids.push(kit.wallArc(b, 0, CZ, r, from, a1, { h }));
  };
  const radialWall = (a, r0, r1, h) => { const [x0, z0] = pol(a, r0); const [x1, z1] = pol(a, r1); solids.push(kit.wall(b, x0, z0, x1, z1, { h })); };
  /** The wall above an opening (a lintel), from y0 to y1: both faces, like kit.wallArc. */
  const lintel = (r, a0, a1, y0, y1, t = 0.25) => {
    const hh = y1 - y0; const seg = Math.max(2, Math.round(((a1 - a0) * r) / 1.2));
    const outer = new THREE.CylinderGeometry(r, r, hh, seg, 1, true, a0, a1 - a0).translate(0, y0 + hh / 2, 0);
    const inn = new THREE.CylinderGeometry(r - t, r - t, hh, seg, 1, true, a0, a1 - a0).translate(0, y0 + hh / 2, 0);
    const idx = inn.index.array; for (let i = 0; i < idx.length; i += 3) { const tmp = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = tmp; }
    const nrm = inn.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), nrm.getY(i), -nrm.getZ(i));
    b.add(outer, kit.mats.wall, 0, 0, CZ); b.add(inn, kit.mats.wall, 0, 0, CZ);
  };

  const labA0 = LAB.a - LAB.th / 2; const labA1 = LAB.a + LAB.th / 2;
  const hydA0 = HYD.a - HYD.th / 2; const hydA1 = HYD.a + HYD.th / 2;
  const corr = { ring: [0, CZ, R_IN, R_OUT], from: Math.PI - CORR, to: Math.PI + CORR };
  const labShape = { ring: [0, CZ, LAB.r0, R_IN], from: labA0, to: labA1 };
  const hydShape = { ring: [0, CZ, HYD.r0, R_IN], from: hydA0, to: hydA1 };
  const lab = frame(LAB.a); const hyd = frame(HYD.a);

  // The ring: outer wall (gap at the lift), inner wall (gaps at the two doors).
  ringRun(R_OUT, Math.PI - CORR, Math.PI - LIFT_GAP, 3.2);
  ringRun(R_OUT, Math.PI + LIFT_GAP, Math.PI + CORR, 3.2);
  ringRun(R_IN, Math.PI - CORR, labA0, 3.2);
  ringRun(R_IN, labA0, labA1, 3.2, [LAB.a]);
  ringRun(R_IN, labA1, hydA0, 3.2);
  ringRun(R_IN, hydA0, hydA1, HYD.h, [HYD.a]);
  ringRun(R_IN, hydA1, Math.PI + CORR, 3.2);
  radialWall(Math.PI - CORR, R_IN, R_OUT, 3.2); radialWall(Math.PI + CORR, R_IN, R_OUT, 3.2);
  // Lintels over the openings: the lift, the lab door (frame top 2.6), the bay door (3.2).
  lintel(R_OUT, Math.PI - LIFT_GAP, Math.PI + LIFT_GAP, 2.7, 3.2);
  lintel(R_IN, LAB.a - DOOR_GAP, LAB.a + DOOR_GAP, 2.6, 3.2);
  lintel(R_IN, HYD.a - DOOR_GAP, HYD.a + DOOR_GAP, 3.2, HYD.h);
  // The two rooms: side walls and inner ends.
  radialWall(labA0, LAB.r0, R_IN, 3.2); radialWall(labA1, LAB.r0, R_IN, 3.2); ringRun(LAB.r0, labA0, labA1, 3.2);
  radialWall(hydA0, HYD.r0, R_IN, HYD.h); radialWall(hydA1, HYD.r0, R_IN, HYD.h); ringRun(HYD.r0, hydA0, hydA1, HYD.h);

  floors.push(corr, labShape, hydShape);
  kit.floor(b, corr); kit.floor(b, labShape, { mat: kit.mats.deck }); kit.floor(b, hydShape, { mat: kit.mats.deck });
  kit.ceiling(b, corr, 3.2); kit.ceiling(b, labShape, 3.2); kit.ceiling(b, hydShape, HYD.h);

  // Light bands in the ceilings, and a lilac inlay down the corridor floor.
  band(37.2, 37.45, corr.from + 0.06, corr.to - 0.06, 3.17, kit.mats.coveCool, true);
  band(39.05, 39.3, corr.from + 0.06, corr.to - 0.06, 3.17, kit.mats.coveCool, true);
  band(38.3, 38.55, corr.from + 0.06, corr.to - 0.06, 0.012, kit.mats.accentLilac);
  band(27.4, 27.7, labA0 + 0.03, labA1 - 0.03, 3.17, kit.mats.coveCool, true);
  band(33.0, 33.3, labA0 + 0.03, labA1 - 0.03, 3.17, kit.mats.coveCool, true);
  band(22.2, 22.5, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);
  band(28.4, 28.7, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);
  band(34.4, 34.7, hydA0 + 0.04, hydA1 - 0.04, HYD.h - 0.02, M.grow, true);

  // LCARS panels on the corridor's inner wall (facing the corridor).
  const onWall = (obj, a, r, y) => { const [X, Z] = pol(a, r); obj.position.set(X, y, Z); obj.rotation.y = a; group.add(obj); };
  onWall(kit.screen(1.6, 0.9, { title: 'AIR', seed: 4, kind: 'map' }), Math.PI - 0.86, R_IN + 0.14, 1.6);
  onWall(kit.screen(1.4, 0.8, { title: 'LIFE', seed: 9, accent: PALETTE.teal }), Math.PI - 0.21, R_IN + 0.14, 1.6);
  onWall(kit.screen(1.4, 0.8, { title: 'FARM', seed: 12, accent: PALETTE.lilac }), Math.PI + 0.14, R_IN + 0.14, 1.6);
  onWall(kit.screen(1.6, 0.9, { title: 'DECK 2', seed: 7 }), Math.PI + 0.87, R_IN + 0.14, 1.6);

  // Star windows in the outer wall, framed in trim (they look out past the ring).
  for (const a of [Math.PI - 0.5, Math.PI + 0.5]) {
    const f = frame(a, R_OUT - 0.25); // the outer wall's inner face
    const win = kit.starWindow(3.0, 1.6, { seed: a < Math.PI ? 3 : 5 });
    place(win.mesh, f, 0, 1.7, -0.02, Math.PI);
    wins.push(win);
    boxIn(f, 3.3, 0.1, 0.1, kit.mats.trim, 0, 2.55, -0.05);
    boxIn(f, 3.3, 0.1, 0.1, kit.mats.trim, 0, 0.85, -0.05);
    boxIn(f, 0.1, 1.7, 0.1, kit.mats.trim, -1.6, 1.7, -0.05);
    boxIn(f, 0.1, 1.7, 0.1, kit.mats.trim, 1.6, 1.7, -0.05);
  }

  // The doors into the rooms, and their signs.
  const [lx, lz] = pol(LAB.a, R_IN);
  const labDoor = kit.door(lx, lz, LAB.a, { w: 1.8, h: 2.4 });
  group.add(labDoor.group); doors.push(labDoor);
  const [hx, hz] = pol(HYD.a, R_IN);
  const hydDoor = kit.door(hx, hz, HYD.a, { w: 1.8, h: 3.0 });
  group.add(hydDoor.group); doors.push(hydDoor);
  place(kit.sign('LAB', { w: 1.2, h: 0.3, color: PALETTE.peach }), lab, 0, 2.85, 0.24);
  place(kit.sign('HYDROPONICS', { w: 2.8, h: 0.4, color: PALETTE.teal }), hyd, 0, 3.55, 0.24);

  // ---- LAB: the air. Three algae tanks with bubbles, the ice splitter, the water loop, a work table.
  const tankZ = -9.4;
  const tanks = [-1.8, 0, 1.8].map((x) => { const [X, Z] = lab.at(x, tankZ); return { x: X, z: Z }; });
  for (const t of tanks) {
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 24), kit.mats.panel, t.x, 0.125, t.z);
    b.add(new THREE.CylinderGeometry(0.72, 0.72, 2.5, 24), kit.mats.glass, t.x, 1.5, t.z);
    b.add(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 20), M.algae, t.x, 1.3, t.z);
    b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24), kit.mats.trim, t.x, 2.76, t.z);
    solids.push({ disc: [t.x, t.z, 0.85] });
  }
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
  const pipe = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8); pipe.rotateZ(Math.PI / 2);
  addIn(lab, pipe, kit.mats.metal, -2.76, 1.2, -9.4);
  place(kit.screen(0.9, 0.5, { title: 'ICE', seed: 15, accent: PALETTE.teal }), lab, -3.7, 1.35, -8.47);
  solids.push(rectIn(lab, 1.4, 1.0, -3.7, -9.0));

  // The water loop: three filter columns in a row (grit, algae, UV), labelled, with a pipe along their feet.
  const cols = [{ z: -2.6, name: 'GRIT' }, { z: -4.6, name: 'ALGAE' }, { z: -6.6, name: 'UV', uv: true }];
  for (const c of cols) {
    addIn(lab, new THREE.CylinderGeometry(0.42, 0.42, 2.3, 20), c.uv ? kit.mats.glass : kit.mats.metal, -4, 1.15, c.z);
    addIn(lab, new THREE.CylinderGeometry(0.55, 0.55, 0.2, 20), kit.mats.trim, -4, 0.1, c.z);
    addIn(lab, new THREE.CylinderGeometry(0.5, 0.5, 0.15, 20), kit.mats.trim, -4, 2.37, c.z);
    if (c.uv) addIn(lab, new THREE.CylinderGeometry(0.28, 0.28, 2.0, 16), M.uv, -4, 1.15, c.z);
    place(kit.sign(c.name, { w: 0.5, h: 0.2, color: c.uv ? PALETTE.lilac : PALETTE.peach }), lab, -3.58, 1.75, c.z, Math.PI / 2);
    solids.push(discIn(lab, 0.55, -4, c.z));
  }
  const loop = new THREE.CylinderGeometry(0.07, 0.07, 4.0, 8); loop.rotateX(Math.PI / 2);
  addIn(lab, loop, kit.mats.metal, -4, 0.5, -4.6);

  // A work table with screens, facing the door.
  const [wx, wz] = lab.at(3.0, -3.4);
  const desk = kit.console(wx, wz, LAB.a, { w: 1.5, screen: { title: 'WATER', seed: 6 } });
  group.add(desk.group); solids.push(desk.solid);
  // A map screen on the lab's inner end.
  place(kit.screen(2.0, 1.1, { title: 'O2', seed: 8, kind: 'map' }), lab, 0, 1.9, -11.27);

  // ---- HYDROPONICS: grow racks under pink grow strips, a walkway with a water channel, fruit trees, the console.
  const RACK_Z = -7.4; const RACK_LEN = 12; // the rows run from z -1.4 to -13.4
  const plantGeo = new THREE.SphereGeometry(0.26, 6, 4).scale(1, 0.8, 1); // a lettuce head
  for (const x of [-4.45, -2.55, 2.55, 4.45]) {
    const [rx, rz] = hyd.at(x, RACK_Z);
    solids.push({ rect: [rx, rz, 1.1, RACK_LEN], rot: hyd.a });
    for (const y of [0.55, 1.55, 2.55]) {
      boxIn(hyd, 1.1, 0.08, RACK_LEN, kit.mats.panel, x, y, RACK_Z);   // shelf
      boxIn(hyd, 0.5, 0.03, RACK_LEN, M.grow, x, y - 0.07, RACK_Z);    // grow strip under it
      for (let k = 0; k < 20; k++) {
        for (const dx of [-0.28, 0.28]) {
          const [px, pz] = hyd.at(x + dx, -1.8 - k * 0.6);
          const leaf = [M.leafA, M.leafB, M.leafC][(k + (dx > 0 ? 1 : 0) + Math.round(y * 10)) % 3];
          b.add(plantGeo, leaf, px, y + 0.14, pz);
        }
      }
    }
    for (const z of [-1.4, -13.4]) for (const dx of [-0.5, 0.5]) boxIn(hyd, 0.08, 3.0, 0.08, kit.mats.trim, x + dx, 1.5, z);
  }
  // The water channel down the walkway (she can walk over it), with stone edges.
  boxIn(hyd, 0.7, 0.02, 11.6, M.water, 0, 0.01, -7.4);
  for (const x of [-0.42, 0.42]) boxIn(hyd, 0.08, 0.1, 11.6, kit.mats.trim, x, 0.05, -7.4);
  // Fruit trees in pots, in the side aisles.
  for (const [x, z] of [[-6.3, -3.2], [6.3, -3.2], [-6.3, -8.4], [6.3, -8.4]]) {
    addIn(hyd, new THREE.CylinderGeometry(0.5, 0.45, 0.7, 20), kit.mats.wallDark, x, 0.35, z);
    addIn(hyd, new THREE.CylinderGeometry(0.1, 0.14, 1.4, 8), M.bark, x, 1.4, z);
    addIn(hyd, new THREE.SphereGeometry(0.95, 10, 7), M.leafB, x, 2.6, z);
    addIn(hyd, new THREE.SphereGeometry(0.6, 8, 6), M.leafC, x + 0.45, 3.1, z - 0.3);
    for (const [fx, fy, fz] of [[0.75, 2.35, 0.45], [-0.55, 2.0, 0.7], [0.1, 2.9, -0.9]]) addIn(hyd, new THREE.SphereGeometry(0.13, 6, 5), kit.mats.accentOrange, x + fx, fy, z + fz);
    solids.push(discIn(hyd, 0.5, x, z));
  }
  // The planning console at the far end, with a map screen on the wall behind it.
  const [fx, fz] = hyd.at(0, -15.0);
  const plan = kit.console(fx, fz, HYD.a, { w: 2.2, screen: { title: 'FARM', seed: 12, accent: PALETTE.teal } });
  group.add(plan.group); solids.push(plan.solid);
  place(kit.screen(2.4, 1.2, { title: 'PLAN', seed: 13, kind: 'map', accent: PALETTE.teal }), hyd, 0, 2.3, -15.96);

  // The stations and the crewmate. Lamps sit on their props.
  const stations = {
    oxygen: { ...spotIn(lab, 0, -7.2, 0, tankZ), lamp: lampIn(lab, 0, tankZ, 3.0) },
    water: { ...spotIn(lab, -2.3, -4.6, -4.0, -4.6), lamp: lampIn(lab, -4.0, -4.6, 2.65) },
    food: { ...spotIn(hyd, 0, -13.2, 0, -15.0), lamp: lampIn(hyd, 0, -15.0, 1.5) },
  };
  const crewSpots = { biologist: spotIn(lab, 2.0, -7.2, 1.8, tankZ) };

  // Set points for screenshots: the corridor, the lab, its tanks, the bay.
  const up = ([x, z], y) => [x, y, z]; // (x, z) plus a height, as [x, y, z]
  const views = [
    { name: 'corridor', pos: up(pol(Math.PI - 0.12, 38.2), 1.6), look: up(pol(Math.PI - 0.7, 38.2), 1.4) },
    { name: 'lab', pos: up(lab.at(0.4, -0.6), 1.7), look: up(lab.at(0, -9.5), 1.3) },
    { name: 'tanks', pos: up(lab.at(0.5, -5.6), 1.5), look: up(lab.at(0, -9.4), 1.3) },
    { name: 'farm', pos: up(hyd.at(0.3, -1.2), 2.2), look: up(hyd.at(0, -15), 1.3) },
    { name: 'farmback', pos: up(hyd.at(0.2, -13.2), 1.6), look: up(hyd.at(0, -1), 1.4) },
  ];

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
      bubbles.forEach((u, i) => {
        const k = (t * u.speed + u.phase) % 1;
        _p.set(u.x + Math.sin(t * 1.7 + u.phase * 9) * 0.12, 0.25 + k * 2.2, u.z);
        _s.setScalar(0.6 + 0.4 * Math.sin(k * Math.PI));
        bubMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      bubMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {},
  };
}
