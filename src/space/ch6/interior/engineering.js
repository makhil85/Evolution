// Chapter 6 interior, deck 3: engineering and cargo (Star Trek TNG style: curved
// walls, LCARS screens, light coves, a fusion core you can see into). Deck-local
// metres, floor y = 0, the lift at the origin, she steps out to +Z.
//
//   z 0..5    a corridor (3.2 wide) from the lift; the ENGINEERING sign over the hall door
//   z 5..23   MAIN ENGINEERING, 16 wide, 7 tall, curved corners at the lift end.
//             The fusion core at (0, 14): a glass column, a plasma core and light rings
//             that climb it, a ring railing; a ring gallery on the upper level (seen
//             from below, not walkable); the core console (station 'energy'); a master
//             systems table; wall consoles and pipes.
//   z 23..37  CARGO BAY, 14 wide, 5 tall: stacked crates, a loader, racks, a packing
//             console (station 'pack') and a big sealed outer door with warning stripes.
// Echo (signal) stands by the core console, Bolt (builder) by the crates.
// The coolant tank in the hall's near corner is the quest 'coolant' (Bolt leads it).
import * as THREE from 'three';
import { toonRamp } from '../../../game/toonPipeline.js';
import { PALETTE } from './kit.js';

const CORE = { x: 0, z: 14 };
const HALL_H = 7;
const CARGO_H = 5;
const faceTo = (x, z, px, pz) => Math.atan2(px - x, pz - z); // the yaw that turns (x, z) to (px, pz)

export function buildDeck(kit) {
  const group = new THREE.Group();
  const mine = [];
  const own = (x) => { mine.push(x); return kit.own(x); };
  const { mats } = kit;
  const b = kit.batch();
  const toon = (color) => own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  const crateMat = toon(0xb8895a);
  const goldMat = toon(PALETTE.gold);
  const cardMat = toon(0xd9c3a0);
  const blueMat = toon(PALETTE.blue);
  const solids = [];
  const screens = []; // flicker in update()

  // --- floors and ceilings ---------------------------------------------------------------
  const corridor = { rect: [0, 2.5, 3.2, 5] };
  // The hall: a rounded near end (discs at its corners) and a square far end.
  const hall = [{ rect: [0, 15.5, 16, 15] }, { rect: [0, 6.5, 10, 3] }, { disc: [5, 8, 3] }, { disc: [-5, 8, 3] }];
  const cargo = { rect: [0, 30, 14, 14] };
  for (const s of [corridor, ...hall, cargo]) kit.floor(b, s, { mat: mats.deck });
  kit.ceiling(b, corridor, 3.2);
  for (const s of hall) kit.ceiling(b, s, HALL_H);
  kit.ceiling(b, cargo, CARGO_H);

  // --- walls -----------------------------------------------------------------------------
  // The corridor: its side walls run from the lift to the hall door.
  solids.push(kit.wall(b, -1.6, 0, -1.6, 5, { h: 3.2 }), kit.wall(b, 1.6, 0, 1.6, 5, { h: 3.2 }));
  // The hall's near wall with the corridor door (2.2 wide) and a lintel over it.
  solids.push(kit.wall(b, -5, 5, -1.3, 5, { h: HALL_H }), kit.wall(b, 1.3, 5, 5, 5, { h: HALL_H }));
  b.box(2.6, HALL_H - 2.6, 0.25, mats.wall, 0, (2.6 + HALL_H) / 2, 5);
  // The hall's sides and the curved corners that join them to the near wall.
  solids.push(kit.wall(b, -8, 8, -8, 23, { h: HALL_H }), kit.wall(b, 8, 8, 8, 23, { h: HALL_H }));
  solids.push(kit.wallArc(b, 5, 8, 3, Math.PI / 2, Math.PI, { h: HALL_H }));
  solids.push(kit.wallArc(b, -5, 8, 3, Math.PI, Math.PI * 1.5, { h: HALL_H }));
  // The far wall with the wide cargo door (3.2 wide, 3.0 tall) and its lintel.
  solids.push(kit.wall(b, -8, 23, -1.8, 23, { h: HALL_H }), kit.wall(b, 1.8, 23, 8, 23, { h: HALL_H }));
  b.box(3.6, HALL_H - 3.2, 0.25, mats.wall, 0, (3.2 + HALL_H) / 2, 23);
  // The cargo bay's walls.
  solids.push(kit.wall(b, -7, 23, -7, 37, { h: CARGO_H }), kit.wall(b, 7, 23, 7, 37, { h: CARGO_H }));
  solids.push(kit.wall(b, -7, 37, 7, 37, { h: CARGO_H }));

  // Pipes and conduits: the plumbing the hall is built round.
  for (const x of [-7.62, 7.62]) b.cyl(0.22, 0.22, 15, mats.metal, x, 6.1, 15.5, { rx: Math.PI / 2 });
  for (const z of [9.0, 21.5]) b.cyl(0.18, 0.18, 15.6, mats.metal, 0, 6.4, z, { rz: Math.PI / 2 });
  for (const x of [-6.62, 6.62]) b.cyl(0.2, 0.2, 14, mats.metal, x, 4.2, 30, { rx: Math.PI / 2 });

  // --- main engineering: the fusion core ------------------------------------------------
  const { x: cx, z: cz } = CORE;
  b.cyl(2.1, 2.2, 0.35, mats.metal, cx, 0.175, cz); // plinth
  b.add(new THREE.RingGeometry(2.6, 2.8, 64).rotateX(-Math.PI / 2), mats.accentBlue, cx, 0.01, cz); // floor ring
  b.cyl(0.9, 0.9, 6.55, mats.glass, cx, 3.625, cz, { seg: 32 }); // the glass column, 0.35 to 6.9
  for (const y of [0.35, 6.9]) b.add(new THREE.TorusGeometry(0.9, 0.05, 8, 40).rotateX(Math.PI / 2), mats.metal, cx, y, cz);
  // The railing round the core (its footprint is solid, below).
  b.add(new THREE.TorusGeometry(2.3, 0.05, 6, 56).rotateX(Math.PI / 2), mats.trim, cx, 1.0, cz);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    b.cyl(0.04, 0.04, 1.0, mats.trim, cx + Math.sin(a) * 2.3, 0.5, cz + Math.cos(a) * 2.3);
  }
  solids.push({ disc: [cx, cz, 2.4] });

  // The plasma and its light rings are animated, so they are their own meshes.
  const plasma = kit.glow(0x5fe8ff, 1.7); // the core only: the one thing that blooms
  const plasmaBase = new THREE.Color(0x5fe8ff);
  const plasmaCore = new THREE.Mesh(own(new THREE.CylinderGeometry(0.42, 0.42, 5.9, 24)), plasma);
  plasmaCore.position.set(cx, 3.65, cz);
  group.add(plasmaCore);
  // Light rings climb the column. Basic material below bloom range, so they read as lit, not glowing.
  const ringMat = own(new THREE.MeshBasicMaterial({ color: 0x8ff4ff }));
  const ringGeo = own(new THREE.TorusGeometry(0.93, 0.035, 8, 40).rotateX(Math.PI / 2));
  const rings = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(ringGeo, ringMat); m.position.set(cx, 1, cz); group.add(m); return m;
  });
  b.add(new THREE.RingGeometry(0.95, 1.1, 40).rotateX(-Math.PI / 2), ringMat, cx, 0.36, cz); // a ring on the plinth

  // The upper level: a ring walkway and railing, seen from below (decoration, not walkable).
  const GY = 4.0;
  // The underside is light (it is lit from below only) with a cool light band round it.
  b.add(new THREE.RingGeometry(4.0, 5.4, 64).rotateX(Math.PI / 2), mats.wall, cx, GY - 0.12, cz); // underside, facing down
  b.add(new THREE.RingGeometry(4.45, 4.57, 64).rotateX(Math.PI / 2), mats.coveCool, cx, GY - 0.14, cz);
  for (const r of [4.0, 5.4]) {
    b.add(new THREE.TorusGeometry(r, 0.05, 6, 64).rotateX(Math.PI / 2), mats.trim, cx, GY + 1.0, cz);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      b.cyl(0.04, 0.04, 1.0, mats.trim, cx + Math.sin(a) * r, GY + 0.5, cz + Math.cos(a) * r);
    }
  }
  // Four pillars hold the gallery up (solid).
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = cx + dx * 3.3; const pz = cz + dz * 3.3;
    b.cyl(0.3, 0.3, GY - 0.12, mats.trim, px, (GY - 0.12) / 2, pz);
    solids.push({ disc: [px, pz, 0.35] });
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

  // Wall consoles and wall panels at eye level, on both sides of the hall.
  for (const [x, z, ry, title] of [[-7.4, 12.5, Math.PI / 2, 'HULL'], [-7.4, 20.6, Math.PI / 2, 'WARP'], [7.4, 12.5, -Math.PI / 2, 'LIFE'], [7.4, 20.6, -Math.PI / 2, 'COMMS']]) {
    const c = kit.console(x, z, ry, { w: 1.4, screen: { title } });
    group.add(c.group); solids.push(c.solid); screens.push(c.screen);
  }
  for (const [x, ry, title] of [[-7.85, Math.PI / 2, 'SHIELD'], [7.85, -Math.PI / 2, 'SENSORS']]) {
    const p = kit.screen(1.5, 0.9, { title, kind: 'panel', seed: Math.round(x * 17) });
    p.position.set(x, 2.1, 16.6); p.rotation.y = ry; group.add(p); screens.push(p);
  }

  // Quest: coolant (the tank, its screen and lamp; the quest's spots are below)
  const TANK = { x: -4.2, z: 6.2 };
  b.cyl(0.5, 0.5, 1.6, mats.metal, TANK.x, 0.8, TANK.z, { seg: 20 });
  b.cyl(0.56, 0.56, 0.12, mats.trim, TANK.x, 1.62, TANK.z, { seg: 20 });
  b.cyl(0.56, 0.56, 0.12, mats.trim, TANK.x, 0.06, TANK.z, { seg: 20 });
  solids.push({ disc: [TANK.x, TANK.z, 0.56] });
  const tankScreen = kit.screen(0.8, 0.5, { title: 'COOLANT', seed: 33, accent: PALETTE.teal });
  tankScreen.position.set(TANK.x + 0.51, 1.1, TANK.z); tankScreen.rotation.y = Math.PI / 2; group.add(tankScreen); screens.push(tankScreen);
  const coolLamp = kit.lamp(PALETTE.gold); coolLamp.position.set(TANK.x, 1.9, TANK.z); group.add(coolLamp);
  // End of quest: coolant

  // --- cargo bay -------------------------------------------------------------------------
  // Crates; each footprint is solid, and the stacked one sits on the one below.
  const crates = [
    [3.6, 31.0, 1.6, 1.2, 1.3, 0], [5.5, 31.2, 1.8, 1.3, 1.1, 0], [5.4, 31.1, 1.2, 1.1, 0.9, 1.1],
    [4.2, 33.8, 2.2, 1.6, 1.5, 0], [2.5, 34.6, 1.1, 1.1, 1.0, 0], [6.0, 35.3, 1.4, 1.2, 1.2, 0],
  ];
  for (const [x, z, w, d, h, y] of crates) {
    b.box(w, h, d, crateMat, x, y + h / 2, z);
    b.box(w + 0.04, 0.12, d + 0.04, goldMat, x, y + h * 0.6, z); // a band round each crate
    solids.push({ rect: [x, z, w, d] });
  }

  // A cargo loader by the outer door: body, cab, a mast with forks, four wheels.
  // Set well off the pack spot (1.4 m further than before), clear of the rack at z 26..33.
  const L = { x: -4.6, z: 34.6 };
  b.box(2.4, 0.9, 3.0, goldMat, L.x, 0.75, L.z);
  b.box(1.8, 0.9, 1.0, goldMat, L.x, 1.65, L.z - 0.7);
  for (const dx of [-0.8, 0.8]) b.box(0.12, 2.4, 0.12, mats.metal, L.x + dx, 1.5, L.z + 1.45);
  for (const dx of [-0.6, 0.6]) b.box(0.12, 0.1, 0.7, mats.metal, L.x + dx, 0.25, L.z + 1.85);
  for (const dx of [-1.1, 1.1]) for (const dz of [-1.0, 1.0]) b.cyl(0.35, 0.35, 0.28, mats.black, L.x + dx, 0.35, L.z + dz, { rz: Math.PI / 2 });
  solids.push({ rect: [L.x, L.z, 2.4, 3.0] }, { rect: [L.x, L.z + 1.85, 1.4, 0.8] });

  // Shelving racks with supplies: along the left wall, and by the cargo door on the right.
  const rack = (x, z, len) => {
    for (const dz of [-len / 2, len / 2]) for (const dx of [-0.4, 0.4]) b.box(0.06, 2.4, 0.06, mats.panel, x + dx, 1.2, z + dz);
    for (const y of [0.5, 1.2, 1.9]) {
      b.box(0.9, 0.06, len, mats.trim, x, y, z);
      [cardMat, crateMat, blueMat].forEach((m, k) => {
        for (let s = -len / 2 + 0.4 + k * 0.25; s < len / 2 - 0.3; s += 0.9) b.box(0.5, 0.34, 0.5, m, x + (k % 2 ? 0.06 : -0.06), y + 0.2, z + s);
      });
    }
    solids.push({ rect: [x, z, 0.9, len] });
  };
  rack(-6.1, 29.5, 7.0);
  rack(6.1, 25.6, 3.4);

  // The packing console (station 'pack'): its front faces the crates' side, the spot is on the other.
  const pack = kit.console(0, 33.2, -Math.PI / 2, { w: 2.2, screen: { title: 'PACK', seed: 51 } });
  group.add(pack.group); solids.push(pack.solid); screens.push(pack.screen);
  // Same as the core console: the lamp on a short post at the desk's end (the pack desk turns, so its end is at z + 1.08).
  b.cyl(0.04, 0.04, 0.19, mats.trim, 0, 0.955, 34.28);
  const packLamp = kit.lamp(); packLamp.position.set(0, 1.12, 34.28); group.add(packLamp);

  // The big outer door at the far end: a sealed hatch with warning stripes.
  const stripes = document.createElement('canvas'); stripes.width = 512; stripes.height = 512;
  const sg = stripes.getContext('2d');
  sg.fillStyle = '#1d2028'; sg.fillRect(0, 0, 512, 512);
  sg.fillStyle = '#ffc65a';
  for (let k = -512; k < 512; k += 128) { sg.beginPath(); sg.moveTo(k, 512); sg.lineTo(k + 64, 512); sg.lineTo(k + 576, 0); sg.lineTo(k + 512, 0); sg.closePath(); sg.fill(); }
  const stripeTex = own(new THREE.CanvasTexture(stripes)); stripeTex.colorSpace = THREE.SRGBColorSpace;
  const hatch = new THREE.Mesh(own(new THREE.PlaneGeometry(4.0, 3.6)), own(new THREE.MeshToonMaterial({ map: stripeTex, gradientMap: toonRamp })));
  hatch.position.set(0, 1.8, 36.87); hatch.rotation.y = Math.PI; group.add(hatch);
  b.box(4.5, 0.2, 0.12, mats.trim, 0, 3.7, 36.9);
  for (const x of [-2.1, 2.1]) b.box(0.2, 3.8, 0.12, mats.trim, x, 1.9, 36.9);
  const sealed = kit.sign('Outer door sealed', { w: 3.0, h: 0.36, color: PALETTE.gold });
  sealed.position.set(0, 4.25, 36.85); sealed.rotation.y = Math.PI; group.add(sealed);

  // Floor markings: a lane down each side, and a band in front of the outer door.
  for (const x of [-6.3, 6.3]) b.box(0.12, 0.02, 12, goldMat, x, 0.01, 30);
  b.box(12.6, 0.02, 0.12, goldMat, 0, 0.01, 36.5);

  // Signs: ENGINEERING over the corridor door, CARGO BAY over the cargo door.
  const engSign = kit.sign('Engineering', { w: 2.4, h: 0.36 });
  engSign.position.set(0, 2.95, 4.86); engSign.rotation.y = Math.PI; group.add(engSign);
  const cargoSign = kit.sign('Cargo bay', { w: 1.8, h: 0.36 });
  cargoSign.position.set(0, 3.7, 22.86); cargoSign.rotation.y = Math.PI; group.add(cargoSign);

  // Doors: the corridor door into the hall, the wide door into the cargo bay.
  const hallDoor = kit.door(0, 5, 0, { w: 2.2, h: 2.4 });
  const cargoDoor = kit.door(0, 23, 0, { w: 3.2, h: 3.0 });
  group.add(hallDoor.group, cargoDoor.group);

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
      // A ring is hidden at the very top and bottom of its climb (no fade on a shared material).
      for (let i = 0; i < rings.length; i++) {
        const m = rings[i];
        const u = (t * 0.3 + i / rings.length) % 1;
        m.position.y = 0.6 + u * 6.0;
        m.scale.setScalar(1 + 0.05 * Math.sin(Math.PI * u)); // radius 0.93..0.98: just outside the glass (0.9)
        m.visible = u > 0.04 && u < 0.96;
      }
      // The screens flicker gently, each out of step with the next.
      for (let i = 0; i < screens.length; i++) screens[i].material.color.setScalar(1.12 + 0.04 * Math.sin(t * 6 + i * 1.7));
    },
    dispose() { for (const x of mine) x.dispose?.(); },
  };
}
