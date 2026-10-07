// Chapter 6, Part B: inside the rock ship (the lead chose a walkable 3-D
// habitat, 2026-10-05). A round hall carved out of Rock B, about 26 m
// across: the fusion drive's power core glows in the middle with cables
// running out to six stations round the wall, one for each part of the
// living half (shield, air, water, farm, power, store), bunks for the crew
// in between. The rock spins slowly, so the floor has gravity.
//
// She walks like in the villages - the spin gives near-Earth weight, so no
// Moon lope (surface/walker.js gait 'earth'; W/S A/D relative to the
// camera, Shift runs, Space jumps, drag to look). The crewmate who leads a
// station stands at it. The next station has a beacon; at a station "E"
// opens it (onStation(id) - the step opens the card and asks its question),
// and a finished station turns green.
//
// main.js's runScene contract: { scene, camera, start(), tick(), dispose() }.
// start() resolves { done: [ids] } once every station in `order` is done.
// Test hook: scene.debug = { walker, place(x, z), goTo(id), stations, done }.
import * as THREE from 'three';
import { createWalker } from '../surface/walker.js';
import { createOverlay } from '../surface/overlay.js';
import { toonRamp } from '../../game/toonPipeline.js';
import { t } from '../level.js';
import { STATIONS } from './stationsLogic.js';
import { CREW_INFO } from './crewInfo.js';
import { buildCrew } from './crew.js';

const TAU = Math.PI * 2;
const HALL = 13; // hall radius, m
const ST_R = 9.4; // stations' ring radius
const REACH = 2.3; // how close to press E
const BODY_R = 0.3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const toon = (color, emissive = 0x000000, ei = 0) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
  if (ei) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
  return m;
};
const glowMat = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

/** Where station k stands (its prop) and where she stands to use it. */
function stationSpot(k) {
  const a = (k / STATIONS.length) * TAU + Math.PI / 6;
  const px = Math.sin(a) * ST_R; const pz = Math.cos(a) * ST_R;
  const ux = Math.sin(a) * (ST_R - 2.4); const uz = Math.cos(a) * (ST_R - 2.4);
  return { a, px, pz, ux, uz };
}

/** The rock: walls and dome seen from inside, lumpy, grey-brown with ice. */
function buildRock(mats) {
  const g = new THREE.Group();
  const wall = new THREE.CylinderGeometry(HALL + 0.6, HALL + 0.6, 10, 96, 10, true);
  const p = wall.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const k = 1 + 0.035 * Math.sin(a * 7 + y * 0.8) + 0.025 * Math.sin(a * 17 - y * 1.7) + 0.02 * Math.sin(y * 3.1 + a * 3);
    p.setXYZ(i, x * k, y, z * k);
  }
  wall.computeVertexNormals();
  const w = new THREE.Mesh(wall, mats.rockWall); w.position.y = 5; g.add(w);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(HALL + 0.6, 64, 24, 0, TAU, 0, Math.PI / 2), mats.rockWall);
  dome.scale.y = 0.45; dome.position.y = 10; g.add(dome);
  // The floor: metal deck plates (a canvas grid) over the rock.
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#3d4552'; c.fillRect(0, 0, 512, 512);
  c.strokeStyle = 'rgba(15,20,28,0.8)'; c.lineWidth = 4;
  for (let i = 0; i <= 512; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 64; i++) c.fillRect((i % 8) * 64 + 6, Math.floor(i / 8) * 64 + 6, 52, 52);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6); tex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL + 0.6, 96), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonRamp }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  return { group: g, tex };
}

/** The power core: a glowing column with rings, and cables out to each station. */
function buildCore(mats) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9, 32), mats.metal); col.position.y = 4.5; g.add(col);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 8.6, 24), mats.coreGlow); glow.position.y = 4.5; g.add(glow);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 10, 40), mats.coreRing);
    r.rotation.x = Math.PI / 2; r.position.y = 1.4 + i * 2; g.add(r); rings.push(r);
  }
  for (let k = 0; k < STATIONS.length; k++) {
    const s = stationSpot(k);
    const len = ST_R - 1.6;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), mats.cable);
    cable.rotation.z = Math.PI / 2; cable.rotation.y = -s.a + Math.PI / 2;
    cable.position.set(Math.sin(s.a) * (len / 2 + 1), 0.06, Math.cos(s.a) * (len / 2 + 1));
    g.add(cable);
  }
  return { group: g, rings, glow };
}

/** One station's prop, built at the origin facing +Z (towards the hall's middle once placed). */
function buildStationProp(id, mats) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const live = [];
  if (id === 'shield') {
    // A cut-away of the shield wall: layers of rock, thin spots glowing red, a scanner screen.
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(2.6, 2.6, 0.18), i % 2 ? mats.rockDark : mats.rock, 0, 1.5, -0.4 - i * 0.2);
    const scr = add(new THREE.PlaneGeometry(1.4, 0.9), glowMat(0xff6b6b, 1.2), 0, 1.6, 0.2);
    live.push((tt) => { scr.material.color.setRGB(1.6 + 0.4 * Math.sin(tt * 3), 0.5, 0.5); });
  } else if (id === 'oxygen') {
    // Three tall algae tanks under lamps, bubbling, and the ice splitter.
    for (let i = -1; i <= 1; i++) {
      add(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 20, 1, true), mats.glass, i * 1.0, 1.4, 0);
      const algae = add(new THREE.CylinderGeometry(0.38, 0.38, 2.3, 20), glowMat(0x4fd16a, 0.9), i * 1.0, 1.3, 0);
      add(new THREE.BoxGeometry(0.7, 0.1, 0.7), glowMat(0xfff2c0, 1.6), i * 1.0, 2.9, 0);
      live.push((tt) => { algae.material.color.setRGB(0.25, 0.75 + 0.15 * Math.sin(tt * 2 + i), 0.35); });
    }
    add(new THREE.BoxGeometry(1.0, 0.9, 0.8), mats.metal, 1.9, 0.45, 0.3);
    add(new THREE.BoxGeometry(0.5, 0.35, 0.05), glowMat(0x9fe8ff, 1.4), 1.9, 0.6, 0.72);
  } else if (id === 'water') {
    // Two round tanks, a run of pipes, three filter drums.
    add(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 24), mats.blueTank, -1.4, 1.1, -0.3);
    add(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 24), mats.blueTank, 1.4, 1.1, -0.3);
    const pipe = add(new THREE.CylinderGeometry(0.1, 0.1, 2.8, 10), mats.metal, 0, 2.0, -0.3); pipe.rotation.z = Math.PI / 2;
    for (let i = -1; i <= 1; i++) {
      const d = add(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 16), [mats.grit, glowMat(0x4fd16a, 0.7), glowMat(0xb58cff, 1.4)][i + 1], i * 0.7, 0.9, 0.4);
      live.push((tt) => { d.rotation.y = tt * 0.5; });
    }
  } else if (id === 'food') {
    // Two farm beds of green plants under long lamps.
    for (let r = 0; r < 2; r++) {
      add(new THREE.BoxGeometry(3.0, 0.5, 0.9), mats.soil, 0, 0.25, -0.6 + r * 1.2);
      for (let i = 0; i < 7; i++) {
        const plant = add(new THREE.ConeGeometry(0.16, 0.5, 8), mats.leaf, -1.3 + i * 0.43, 0.75, -0.6 + r * 1.2);
        live.push((tt) => { plant.rotation.z = Math.sin(tt * 1.3 + i + r) * 0.08; });
      }
      add(new THREE.BoxGeometry(3.0, 0.08, 0.3), glowMat(0xff9fe0, 1.6), 0, 2.2, -0.6 + r * 1.2);
    }
  } else if (id === 'energy') {
    // The power console: a desk of glowing bars, one per system.
    add(new THREE.BoxGeometry(2.4, 1.0, 0.9), mats.metal, 0, 0.5, 0);
    add(new THREE.BoxGeometry(2.4, 1.2, 0.1), mats.metal, 0, 1.6, -0.4);
    const cols = [0x7fd3ff, 0x9fe8a8, 0xffd27a, 0xff8a8a];
    cols.forEach((c, i) => {
      const b = add(new THREE.BoxGeometry(0.3, 0.8, 0.04), glowMat(c, 1.5), -0.75 + i * 0.5, 1.6, -0.33);
      live.push((tt) => { b.scale.y = 0.6 + 0.4 * Math.abs(Math.sin(tt * 0.9 + i)); });
    });
  } else if (id === 'pack') {
    // The store: stacked crates and a shelf.
    const crate = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    [[-1, 0.4, 0], [0, 0.4, -0.2], [1, 0.4, 0], [-0.5, 1.2, -0.1], [0.5, 1.2, 0]].forEach(([x, y, z], i) => add(crate, i % 2 ? mats.crateB : mats.crateA, x, y, z));
    add(new THREE.BoxGeometry(2.6, 0.08, 0.6), mats.metal, 0, 2.2, -0.4);
  }
  // A status light on top: amber until done, then green.
  const lamp = add(new THREE.SphereGeometry(0.16, 14, 10), glowMat(0xffd27a, 1.8), 0, 3.3, 0);
  return { group: g, lamp, update(tt) { for (const f of live) f(tt); } };
}

/** Bunks between the stations: crew quarters. */
function buildBunks(mats) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 6 + Math.PI / STATIONS.length * 3;
    const b = new THREE.Group();
    for (let lvl = 0; lvl < 2; lvl++) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.9), mats.bunk); bed.position.y = 0.5 + lvl * 1.2; b.add(bed);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), mats.pillow); pillow.position.set(-0.75, 0.7 + lvl * 1.2, 0); b.add(pillow);
    }
    b.position.set(Math.sin(a) * (HALL - 1.0), 0, Math.cos(a) * (HALL - 1.0));
    b.rotation.y = a + Math.PI / 2;
    g.add(b);
  }
  return g;
}

/**
 * @param {object} game
 * @param {{ order?: string[], done?: string[], onStation: (id:string) => Promise<any> }} opts
 */
export function createHabitatScene(game, { order = STATIONS.map((s) => s.id), done: doneAlready = [], onStation }) {
  const renderer = game.renderer;
  const hud = game.hud || null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog = new THREE.Fog(0x0b0d12, 18, 40);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);

  const mats = {
    rock: toon(0x8a8178), rockWall: Object.assign(toon(0x8f857b), { side: THREE.BackSide }), rockDark: toon(0x6f675f), metal: toon(0x9aa6b4), cable: toon(0x2b2f38),
    coreGlow: glowMat(0x7ff3ff, 1.6), coreRing: glowMat(0x9fe8ff, 1.2), glass: new THREE.MeshToonMaterial({ color: 0xcfefff, gradientMap: toonRamp, transparent: true, opacity: 0.35 }),
    blueTank: toon(0x4a86c0), grit: toon(0xb8a07a), soil: toon(0x5a4030), leaf: toon(0x4fb35c),
    crateA: toon(0xd8a35a), crateB: toon(0xb5874a), bunk: toon(0x6f86a8), pillow: toon(0xf2f2f2),
  };
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3028, 1.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.2); key.position.set(4, 12, 6); scene.add(key);
  const coreLight = new THREE.PointLight(0x7ff3ff, 30, 30, 1.6); coreLight.position.set(0, 3, 0); scene.add(coreLight);

  const rock = buildRock(mats); scene.add(rock.group);
  const core = buildCore(mats); scene.add(core.group);
  scene.add(buildBunks(mats));

  // Stations, each with its crewmate.
  const crew = buildCrew();
  const stations = STATIONS.map((info, k) => {
    const s = stationSpot(k);
    const prop = buildStationProp(info.id, mats);
    prop.group.position.set(s.px, 0, s.pz);
    prop.group.rotation.y = s.a + Math.PI; // face the middle
    scene.add(prop.group);
    return { ...info, ...s, prop, done: doneAlready.includes(info.id) };
  });
  // Each crewmate at their first station, a step to the side, facing the middle.
  const placed = new Set();
  for (const st of stations) {
    if (placed.has(st.lead)) continue;
    placed.add(st.lead);
    const c = crew[st.lead];
    const side = 1.3;
    c.root.position.set(st.ux + Math.cos(st.a) * side, 0, st.uz - Math.sin(st.a) * side);
    c.root.rotation.y = st.a + Math.PI;
    scene.add(c.root);
  }

  // A beacon over the next station.
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(beacon);

  // Her.
  const walker = createWalker({ gravity: 9.8 * 0.6, gait: 'earth' });
  // There is air in here: no helmet, collar ring or life-support pack.
  walker.helmet.visible = false;
  if (walker.pack) walker.pack.visible = false;
  walker.root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'TorusGeometry') o.visible = false; });
  scene.add(walker.root);
  walker.place(0, 0, -(HALL - 3.5), 0);
  const terrain = { heightAt: () => 0 };
  const colliders = [{ x: 0, z: 0, r: 1.45 }];
  for (const st of stations) colliders.push({ x: st.px, z: st.pz, r: 1.7 });
  for (const id of crew.ids) { const c = crew[id]; if (c.root.parent) colliders.push({ x: c.root.position.x, z: c.root.position.z, r: 0.45 }); }
  function collide(p, v) {
    for (const c of colliders) {
      const dx = p.x - c.x; const dz = p.z - c.z; const lim = c.r + BODY_R;
      const d = Math.hypot(dx, dz);
      if (d < lim && d > 1e-5) {
        const nx = dx / d; const nz = dz / d;
        p.x = c.x + nx * lim; p.z = c.z + nz * lim;
        const vn = v.x * nx + v.y * nz; if (vn < 0) { v.x -= vn * nx; v.y -= vn * nz; }
      }
    }
    const r = Math.hypot(p.x, p.z); const max = HALL - 0.8;
    if (r > max) { p.x *= max / r; p.z *= max / r; const nx = p.x / max; const nz = p.z / max; const vn = v.x * nx + v.y * nz; if (vn > 0) { v.x -= vn * nx; v.y -= vn * nz; } }
  }

  const overlay = createOverlay();
  const cam = { yaw: 0, pitch: 0.35, dist: 5.2 };
  const _move = new THREE.Vector2();
  const _v = new THREE.Vector3();
  let clock = 0; let busy = false; let disposed = false; let prevE = false;
  let finish;
  const finished = new Promise((r) => { finish = r; });
  const debugKeys = new Set();
  const isDown = (code) => debugKeys.has(code) || !!game.controls?.isDown?.(code);

  const nextStation = () => {
    for (const id of order) { const st = stations.find((s) => s.id === id); if (st && !st.done) return st; }
    return null;
  };
  function paintStations() {
    for (const st of stations) st.prop.lamp.material.color.copy(new THREE.Color(st.done ? 0x9fe8a8 : 0xffd27a).multiplyScalar(1.8));
    const n = nextStation();
    beacon.visible = !!n;
    if (n) beacon.position.set(n.ux, 3, n.uz);
  }

  async function use(st) {
    if (busy || st.done) return;
    busy = true;
    overlay.hidePrompt();
    crew.wave(st.lead);
    try { await onStation(st.id); st.done = true; } finally { busy = false; }
    paintStations();
    const n = nextStation();
    if (!n) { finishSoon = 1.2; } else hud?.toast?.(t(`Next: ${t(n.title[0], n.title[1])} with ${CREW_INFO[n.lead].name}.`, `Next: ${n.title[1]}!`), { kind: 'info', ms: 3200 });
  }
  let finishSoon = -1;

  function updateCamera(dt, mouse) {
    if (mouse) {
      cam.yaw -= (mouse.dx || 0) * 0.0055;
      cam.pitch = clamp(cam.pitch + (mouse.dy || 0) * 0.0042, -0.05, 1.0);
      if (mouse.wheel) cam.dist = clamp(cam.dist * Math.exp(mouse.wheel * 0.0012), 2.4, 9);
      // Easing the view round behind her when she walks and isn't dragging.
      if (!mouse.dragging && Math.hypot(walker.vel.x, walker.vel.y) > 0.4) cam.yaw += angDiff(walker.heading, cam.yaw) * Math.min(1, dt * 0.9);
    }
    const fx = Math.sin(cam.yaw); const fz = Math.cos(cam.yaw);
    const tx = walker.pos.x; const tz = walker.pos.z; const ty = walker.pos.y + 1.0;
    let dist = cam.dist;
    // Keep the camera inside the hall.
    for (let k = 0; k < 8; k++) {
      const cx = tx - fx * dist * Math.cos(cam.pitch); const cz = tz - fz * dist * Math.cos(cam.pitch);
      if (Math.hypot(cx, cz) < HALL - 0.6) break;
      dist *= 0.85;
    }
    camera.position.set(tx - fx * dist * Math.cos(cam.pitch), ty + 0.3 + dist * Math.sin(cam.pitch), tz - fz * dist * Math.cos(cam.pitch));
    camera.lookAt(tx, ty, tz);
  }

  function tick(dt, input, mouse, modalOpen = false) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    const modal = !!modalOpen || busy;
    const eDown = !modal && isDown('KeyE');
    const pressedE = eDown && !prevE; prevE = eDown;
    const inp = input || { thrust: 0, turn: 0 };
    let speed = 0;
    if (!modal) {
      const f = { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
      const rt = { x: -f.z, z: f.x };
      _move.set(f.x * (inp.thrust || 0) + rt.x * (inp.turn || 0), f.z * (inp.thrust || 0) + rt.z * (inp.turn || 0));
      if (_move.lengthSq() > 1) _move.normalize();
      const run = !!inp.precision || isDown('ShiftLeft') || isDown('ShiftRight');
      speed = walker.move(dt, { dir: _move, run, jump: !!inp.steady && !prevJump, terrain, collide });
      prevJump = !!inp.steady;
    } else {
      _move.set(0, 0);
      speed = walker.move(dt, { dir: _move, run: false, jump: false, terrain, collide });
    }
    walker.events.splice(0);
    walker.sync();
    walker.animate(dt, speed);
    crew.update(dt);
    for (const st of stations) st.prop.update(clock);
    core.rings.forEach((r, i) => { r.rotation.z = clock * (0.4 + i * 0.15) * (i % 2 ? -1 : 1); });
    beacon.material.opacity = 0.12 + 0.08 * Math.sin(clock * 3);
    updateCamera(dt, modal ? null : mouse);

    // The station she is at.
    let near = null;
    for (const st of stations) if (!st.done && Math.hypot(walker.pos.x - st.ux, walker.pos.z - st.uz) < REACH) near = st;
    const w = renderer.domElement.clientWidth || innerWidth; const h = renderer.domElement.clientHeight || innerHeight;
    overlay.resize(w, h, Math.min(2, devicePixelRatio || 1));
    if (near && !modal) {
      _v.set(near.px, 2.6, near.pz).project(camera);
      overlay.showPrompt((_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h, `${t(near.title[0], near.title[1])} · ${CREW_INFO[near.lead].name}`);
      if (pressedE) use(near);
    } else overlay.hidePrompt();
    overlay.draw(dt);
    if (finishSoon > 0) { finishSoon -= dt; if (finishSoon <= 0) finish({ done: stations.filter((s) => s.done).map((s) => s.id) }); }
  }
  let prevJump = false;

  paintStations();
  const debug = {
    walker,
    stations,
    get done() { return stations.filter((s) => s.done).map((s) => s.id); },
    place(x, z) { walker.place(x, 0, z); },
    /** Stand at a station's spot (the next one by default), facing it. */
    goTo(id) { const st = id ? stations.find((s) => s.id === id) : nextStation(); if (st) { walker.place(st.ux, 0, st.uz, st.a); cam.yaw = st.a; } return st?.id; },
    /** Press E (the station she is at). */
    pressE() { const st = stations.find((s) => !s.done && Math.hypot(walker.pos.x - s.ux, walker.pos.z - s.uz) < REACH); if (st) use(st); return st?.id; },
  };

  return {
    scene,
    camera,
    debug,
    start() {
      hud?.toast?.(t('Inside the rock ship! Walk with W A S D, drag to look, press E at a station.', 'Inside the rock ship! Walk with W A S D. Press E at a station.'), { kind: 'info', ms: 5200 });
      if (!nextStation()) finishSoon = 0.5;
      return finished;
    },
    tick,
    dispose() {
      disposed = true;
      overlay.canvas.remove();
      crew.dispose();
      walker.dispose?.();
      scene.traverse((o) => { if (o.isMesh) { o.geometry?.dispose?.(); } });
      for (const m of Object.values(mats)) m.dispose?.();
      rock.tex.dispose();
    },
  };
}
