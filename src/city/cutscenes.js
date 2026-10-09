// Chapter 2 "Forces and Machines": its two films (lead 2026-10-09).
//
// OPENING (the first time at a Level, then the title card): the road in from
// the Science Village, the broken bridge over the moat with a cart stuck at its
// edge, a water wheel turning gears, Newton's apple falling in the quiet
// garden, and a last look at her at the crossroads. The title card follows
// (src/game/chapterStory.js, which plays the film through `scene`).
//
// ENDING (when the Engineering Workshop is built): the workshop opens, a cart
// crosses the bridge, whose truss sides glow green -> red under the load (the
// look of lesson 2A), a cut inside the workshop where a rocket blueprint unrolls
// (Chapter 3), a cut back outside, then the "Chapter complete" card.
//
// Everything is built here from the chapter's own Mesher primitives and gears
// and removed when the film ends. Captions are [Level 4, Level 1] pairs. Reduced
// motion holds each shot still at its middle. No sound (parked).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Mesher, makeGear, LIT, GLOW } from './worldKit.js';
import { toonRamp, outlineMaterial } from '../game/toonPipeline.js';
import { t as pick } from '../space/level.js';
import { tileToWorld, TILE } from './contracts.js';

/** The shot lists. `secs` is the shot's length; `cap` the caption pair (or null). */
export const OPENING = [
  { id: 'road', secs: 5, cap: ['The road from the Science Village runs into the city.', 'The road runs into the city.'] },
  { id: 'bridge', secs: 6, cap: ['The bridge over the river is broken. A cart is stuck at the edge.', 'The bridge is broken. The cart is stuck!'] },
  { id: 'wheel', secs: 5, cap: ['Water turns a big wheel, and gears turn the machines.', 'Water turns the wheel. Gears turn!'] },
  { id: 'apple', secs: 6, cap: ['An apple falls straight down. Newton asked why: Earth pulls it. A pull is a force.', 'The apple falls down. Earth pulls it!'] },
  { id: 'arrive', secs: 4, cap: ['She reaches the crossroads. Pushes and pulls make things move.', 'She is here. Pushes and pulls make things move!'] },
];

export const ENDING = [
  { id: 'open', secs: 5, cap: ['The Engineering Workshop is open for business!', 'The workshop is open!'] },
  { id: 'truss', secs: 8, cap: ['A cart rolls over the truss. Its beams glow red as they take the load.', 'The cart rolls over. The red beams work hard!'] },
  { id: 'plan', secs: 6, cap: ['Inside, a rocket blueprint unrolls. Next: build a rocket!', 'A rocket plan! Next: a rocket!'] },
  { id: 'out', secs: 3, cap: null },
];

// --- the places (world units; the same maths as worldSites.P) -----------------
/** Old tile (cx, cy) with fractions allowed, to world x/z (worldSites.P). */
const P = (cx, cy) => ({ x: (cx - 17) * TILE, z: (cy - 15) * TILE });
const START = tileToWorld(5, 17);          // where she stands
const BRIDGE = P(27.5, 17.5);              // the bridge's centre (runs east-west)
const BRIDGE_LEN = 8;
const BRIDGE_HALF_W = 1.75;
const DECK_Y = 0.17;                       // the planks' top
const WORKSHOP = P(30.9, 17.0);            // the workshop's centre (worldSites.workshop)
const WHEEL = { x: 34.5, y: 2.4, z: -5 }; // the water wheel, in the north arm of the moat
const ROOM = { x: 60, z: 0 };              // the workshop's inside: a set off the map

const REST = new THREE.Color(0x2fa84f);    // the truss at rest (lesson 2A: green)
const PULL = new THREE.Color(0xd62828);    // under the load (lesson 2A: red)
const _tmp = new THREE.Color();
const _l = new THREE.Vector3();
const SHARED = new Set([LIT, GLOW, outlineMaterial]); // never disposed: the whole city uses them

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (k) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** A camera move: eye a -> b, looking from la -> lb. */
const cam = (a, b, la, lb) => ({ a: V(a), b: V(b), la: V(la), lb: V(lb) });
function aim(camera, c, k) {
  camera.position.lerpVectors(c.a, c.b, k);
  camera.lookAt(_l.lerpVectors(c.la, c.lb, k));
}

const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });

/** A plain box in the toon style (a set piece), centre at (x, y, z). */
function prop(w, h, d, x, y, z, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  mesh.position.set(x, y, z);
  return mesh;
}

/** Dispose what a film built, but never the materials the whole city shares. */
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (SHARED.has(m)) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
}

/** The caption band above the bottom cinema bar (Level 4 or Level 1 wording). */
function caption() {
  const el = document.createElement('div');
  el.style.cssText = "position:fixed;left:50%;bottom:calc(11vh + 16px);transform:translateX(-50%);z-index:9002;"
    + "width:min(90vw,820px);text-align:center;color:#fff;font:600 clamp(16px,2.4vw,22px)/1.35 'Segoe UI','Trebuchet MS',system-ui,Arial,sans-serif;"
    + 'text-shadow:0 2px 12px rgba(0,0,0,.75);pointer-events:none;opacity:0;transition:opacity .4s;';
  document.body.appendChild(el);
  let last = null;
  return {
    say(cap) {
      const text = cap ? pick(cap[0], cap[1]) : '';
      if (text === last) return;
      last = text;
      el.textContent = text;
      el.style.opacity = text ? '1' : '0';
    },
    remove() { el.remove(); },
  };
}

/**
 * Play the shots in order: each one shows its caption and runs its frame
 * (t seconds in, k = 0..1). `run` is the chapter's timed-move helper.
 */
async function playShots(run, list, frames, cap) {
  for (const sh of list) {
    cap.say(sh.cap);
    await run(sh.secs, frames[sh.id]);
  }
  cap.say(null);
}

// --- props --------------------------------------------------------------------

/** A wooden cart with two crates, rolling on four toothed wheels (axis z). */
function makeCart() {
  const group = new THREE.Group();
  const m = new Mesher();
  const WOOD = 0xb07a45, PLANK = 0xd09a58, CRATE = 0xe0a24a;
  m.box(1.9, 0.14, 1.2, 0, 0.42, 0, WOOD);
  m.box(1.9, 0.3, 0.1, 0, 0.56, 0.55, PLANK);
  m.box(1.9, 0.3, 0.1, 0, 0.56, -0.55, PLANK);
  m.box(0.1, 0.3, 1.2, -0.95, 0.56, 0, PLANK);
  m.box(0.1, 0.3, 1.2, 0.95, 0.56, 0, PLANK);
  m.box(0.7, 0.55, 0.7, -0.35, 0.56, 0, CRATE);
  m.box(0.6, 0.45, 0.6, 0.4, 0.56, 0.05, CRATE);
  group.add(m.build());
  const wheels = [];
  for (const x of [-0.7, 0.7]) {
    for (const z of [-0.68, 0.68]) {
      const w = makeGear({ r: 0.36, t: 0.16, teeth: 8, color: 0x495057, hub: 0xced4da });
      w.position.set(x, 0.36, z);
      group.add(w);
      wheels.push(w);
    }
  }
  group.userData.wheels = wheels;
  return group;
}

/** Roll a cart `dist` units along +x (the wheels turn with the ground). */
function rollCart(cart, dist) {
  for (const w of cart.userData.wheels) w.rotation.z = -dist / 0.36;
}

/**
 * The water wheel in the moat's north arm: paddles and spokes on one axle
 * (along z) with a big gear on the axle; a smaller gear meshes with it.
 */
function makeWaterWheel() {
  const group = new THREE.Group();
  group.position.set(WHEEL.x, WHEEL.y, WHEEL.z);
  const m = new Mesher();
  const R = 2.0, WOOD = 0x9c6b3c, DARK = 0x6c4a2a;
  m.cyl(0.24, 0.24, 1.9, 0, 0, -0.95, 0x6c757d, { rx: Math.PI / 2, seg: 10 });   // axle
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    // rz turns a part about its base: a spoke from the axle, and a paddle at the rim.
    m.box(0.26, R - 0.2, 0.28, 0, 0, 0, DARK, { rz: a - Math.PI / 2, outline: false });
    m.box(0.9, 0.55, 0.5, (R - 0.4) * Math.cos(a), (R - 0.4) * Math.sin(a), 0, WOOD, { rz: a - Math.PI / 2 });
  }
  m.cyl(0.38, 0.38, 0.5, 0, 0, -0.25, 0x6c757d, { rx: Math.PI / 2, seg: 12 });    // hub
  group.add(m.build());
  const gear = makeGear({ r: 0.95, t: 0.22, teeth: 12, color: 0xffc233 });
  gear.position.set(0, 0, 1.15);
  group.add(gear);
  const gear2 = makeGear({ r: 0.5, t: 0.22, teeth: 8, color: 0xced4da });
  gear2.position.set(WHEEL.x + 1.42, WHEEL.y, WHEEL.z + 1.15);
  return { group, gear2 };
}

/** Newton's apple: one red sphere that falls from the branch (the tree's own apples stay). */
function makeApple() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), toon(0xe0352b));
}

/**
 * The truss sides of the bridge (a Pratt truss, two sides): one merged mesh
 * with a colour per vertex. paint(x) reddens the members near the cart, the
 * way lesson 2A's truss does (green at rest, red where the load pulls).
 */
function buildTruss() {
  const x0 = BRIDGE.x - BRIDGE_LEN / 2;
  const yb = 0.25, yt = 1.55;
  const bot = [0, 1, 2, 3, 4].map((i) => [x0 + i * 2, yb]);
  const top = [0, 1, 2, 3, 4].map((i) => [x0 + i * 2, yt]);
  const members = [];
  for (const side of [-1, 1]) {
    const z = BRIDGE.z + side * BRIDGE_HALF_W;
    const add = (a, b) => members.push({ a, b, z });
    for (let i = 0; i < 4; i++) add(bot[i], bot[i + 1]);      // bottom chord
    for (let i = 0; i < 4; i++) add(top[i], top[i + 1]);      // top chord
    for (let i = 0; i < 5; i++) add(bot[i], top[i]);          // verticals
    add(top[0], bot[1]); add(top[1], bot[2]);                 // diagonals lean to the middle
    add(bot[2], top[3]); add(bot[3], top[4]);
  }
  const geos = members.map(({ a, b, z }) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = new THREE.BoxGeometry(len, 0.16, 0.16);
    g.rotateZ(Math.atan2(b[1] - a[1], b[0] - a[0]));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
    return g;
  });
  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp }));
  const perMember = geos[0].attributes.position.count;   // 24 vertices per box
  const mids = members.map((m) => (m.a[0] + m.b[0]) / 2);
  const onBridge = (cx) => (cx > x0 - 0.5 && cx < x0 + BRIDGE_LEN + 0.5 ? 1 : 0);
  return {
    mesh,
    /** The cart at x: each member's colour follows its nearness to the load. */
    paint(cx) {
      const on = onBridge(cx);
      const attr = geo.attributes.color;
      members.forEach((_, mi) => {
        const s = on * Math.exp(-(((mids[mi] - cx) / 2.4) ** 2));
        _tmp.copy(REST).lerp(PULL, s);
        for (let v = mi * perMember; v < (mi + 1) * perMember; v++) attr.setXYZ(v, _tmp.r, _tmp.g, _tmp.b);
      });
      attr.needsUpdate = true;
    },
  };
}

/** The blueprint's picture: a rocket on squared paper. */
function blueprintTexture() {
  const c = document.createElement('canvas');
  c.width = 520; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#eaf4ff';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(40,90,160,0.16)';
  g.lineWidth = 2;
  for (let x = 0; x < c.width; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y < c.height; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = '#1d4f91';
  g.fillStyle = '#1d4f91';
  g.lineWidth = 4;
  g.font = 'bold 30px sans-serif';
  g.fillText('ROCKET PLAN', 24, 46);
  g.beginPath(); // body
  g.moveTo(230, 120); g.lineTo(230, 230); g.lineTo(290, 230); g.lineTo(290, 120); g.stroke();
  g.beginPath(); // nose
  g.moveTo(230, 120); g.lineTo(260, 52); g.lineTo(290, 120); g.stroke();
  g.beginPath(); // fins
  g.moveTo(230, 190); g.lineTo(200, 230); g.lineTo(230, 230); g.moveTo(290, 190); g.lineTo(320, 230); g.lineTo(290, 230); g.stroke();
  g.beginPath(); g.arc(260, 160, 14, 0, Math.PI * 2); g.stroke(); // window
  g.beginPath(); // flame
  g.moveTo(242, 230); g.lineTo(278, 230); g.lineTo(260, 272); g.closePath(); g.stroke();
  g.font = '20px sans-serif';
  g.fillText('Ready for lift-off!', 330, 270);
  return new THREE.CanvasTexture(c);
}

/** The inside of the workshop: a set off the map (a table, a plan unrolling on it). */
function buildRoom() {
  const group = new THREE.Group();
  group.position.set(ROOM.x, 0, ROOM.z);
  group.visible = false;
  group.add(
    prop(10, 0.3, 8, 0, -0.15, 0, 0xd9b98a),                 // floor
    prop(10, 4.5, 0.3, 0, 2.25, -4.15, 0xd0ebff),            // back wall
    prop(0.3, 4.5, 8, -5.15, 2.25, 0, 0xd0ebff),
    prop(0.3, 4.5, 8, 5.15, 2.25, 0, 0xd0ebff),
    prop(3.2, 0.18, 1.6, 0, 1.0, 0, 0x8c5a2b),              // table top
  );
  for (const [x, z] of [[-1.45, -0.65], [1.45, -0.65], [-1.45, 0.65], [1.45, 0.65]]) {
    group.add(prop(0.16, 0.9, 0.16, x, 0.45, z, 0x6b4423));
  }
  const tex = blueprintTexture();
  const paperMat = new THREE.MeshBasicMaterial({ map: tex });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), paperMat);
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(-1.3, 1.12, 0);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 12), toon(0xf1e3c0));
  roll.rotation.x = Math.PI / 2;
  roll.position.set(-1.3, 1.22, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c1 }));
  lamp.position.set(0, 3.0, 0);
  group.add(paper, roll, lamp);
  // The paper unrolls from its left roll: scale the sheet, slide the roll along it.
  const unroll = (k) => {
    const u = clamp01(k / 0.8);
    paper.scale.x = Math.max(u, 0.001);
    paper.position.x = -1.3 + (u * 2.6) / 2;
    roll.position.x = -1.3 + u * 2.6;
  };
  return { group, unroll };
}

// --- the films ----------------------------------------------------------------

/**
 * The opening film. `run(secs, step)` is the chapter's timed move; `root` is
 * the city's world (unused here: the opening shows it as it is).
 */
export async function playOpening({ run, scene, camera, newtonAt, chasePose, markers = () => {} }) {
  const still = reducedMotion();
  const stage = new THREE.Group();
  scene.add(stage);
  const cap = caption();
  const cart = makeCart();
  cart.position.set(20.6, 0, 6.25);     // stuck at the bridge's edge, nose down
  cart.rotation.z = -0.08;
  const wheel = makeWaterWheel();
  const apple = makeApple();
  apple.position.set(newtonAt.x + 0.9, 2.6, newtonAt.z + 0.5);
  stage.add(cart, wheel.group, wheel.gear2, apple);
  const here = chasePose();
  const views = {
    // A low, wide shot from the west edge, looking about 18 degrees down the road into the city.
    road: cam([-42.2, 5, 6.25], [-40, 4.6, 6.25], [-26.8, 0, 6.25], [-24.5, 0, 6.25]),
    // Side-on from the south-west: the moat gap, the bridge's empty span and the stuck cart.
    bridge: cam([12.5, 4.2, 14.5], [14.5, 4.6, 13.5], [21.5, 0.6, 6.25], [23, 0.8, 6.25]),
    // Low, from the north: the wheel and its gears fill the middle of the frame.
    wheel: cam([28.5, 1.8, -12.5], [29.5, 2.0, -12], [WHEEL.x, WHEEL.y + 0.2, WHEEL.z], [WHEEL.x, WHEEL.y + 0.2, WHEEL.z]),
    apple: cam([newtonAt.x + 4.2, 2.6, newtonAt.z + 4.6], [newtonAt.x + 2.4, 1.7, newtonAt.z + 3.2], [newtonAt.x, 1.6, newtonAt.z], [newtonAt.x, 1.6, newtonAt.z]),
    // From the north-east, over the grass: the Science Center stays out of the frame.
    arrive: cam([-19, 8, 0], [here.pos.x, here.pos.y, here.pos.z], [START.x - 1.5, 1.0, START.z], [here.look.x, here.look.y, here.look.z]),
  };
  const frames = {
    road: (t, k) => aim(camera, views.road, still ? 0.5 : ease(k)),
    bridge: (t, k) => aim(camera, views.bridge, still ? 0.5 : ease(k)),
    wheel: (t, k) => {
      aim(camera, views.wheel, still ? 0.5 : ease(k));
      const a = still ? 0.8 : t * 1.4;                       // the wheel turns; the gears mesh with it
      wheel.group.rotation.z = a;
      wheel.gear2.rotation.z = -a * (0.95 / 0.5);
    },
    apple: (t, k) => {
      aim(camera, views.apple, still ? 0.5 : ease(k));
      const fall = (still ? 6 : t) - 1.5;                    // the drop starts at 1.5 s
      apple.position.y = fall <= 0 ? 2.6 : Math.max(0.14, 2.6 - 4.9 * fall * fall);
    },
    arrive: (t, k) => aim(camera, views.arrive, still ? 1 : ease(k)),
  };
  markers(true);
  try {
    await playShots(run, OPENING, frames, cap);
  } finally {
    markers(false);
    cap.remove();
    scene.remove(stage);
    disposeTree(stage);
  }
}

/**
 * The ending film: the workshop opens, the cart crosses the truss bridge (its
 * beams glow red under the load), a cut inside the workshop (the rocket plan),
 * and a cut back out for the card. `root` is the city's world, hidden inside.
 */
export async function playEnding({ run, scene, camera, root, markers = () => {} }) {
  const still = reducedMotion();
  const stage = new THREE.Group();
  scene.add(stage);
  const cap = caption();
  const cart = makeCart();
  const truss = buildTruss();
  const room = buildRoom();
  stage.add(cart, truss.mesh);
  scene.add(room.group);
  const views = {
    open: cam([22.5, 8.0, 19], [40, 7.5, 12], [WORKSHOP.x, 2.2, WORKSHOP.z], [WORKSHOP.x, 2.2, WORKSHOP.z]),
    truss: cam([17, 3.1, 16.5], [33, 3.4, 16.5], [24, 0.9, BRIDGE.z], [30, 0.9, BRIDGE.z]),
    plan: cam([ROOM.x - 0.9, 2.5, 3.9], [ROOM.x + 0.5, 2.2, 2.6], [ROOM.x, 1.0, 0], [ROOM.x, 1.0, 0]),
    out: cam([22, 8.5, 20], [27, 7.5, 16], [WORKSHOP.x, 2.5, WORKSHOP.z], [WORKSHOP.x, 2.5, WORKSHOP.z]),
  };
  const setInside = (inside) => {
    root.visible = !inside;
    stage.visible = !inside;
    room.group.visible = inside;
  };
  const frames = {
    open: (t, k) => aim(camera, views.open, still ? 0.5 : ease(k)),
    truss: (t, k) => {
      const e = still ? 0.5 : ease(k);
      aim(camera, views.truss, e);
      // The cart rolls from the west bank, over the deck, to the workshop door.
      const x = 14.5 + (31.0 - 14.5) * e;
      cart.position.set(x, DECK_Y * clamp01((x - 21.5) / 0.75) * clamp01((31 - x) / 0.75), BRIDGE.z);
      rollCart(cart, x - 14.5);
      truss.paint(x);
    },
    plan: (t, k) => {
      setInside(true);
      aim(camera, views.plan, still ? 0.5 : ease(k));
      room.unroll(still ? 1 : k);
    },
    out: (t, k) => {
      setInside(false);
      aim(camera, views.out, still ? 0.5 : ease(k));
    },
  };
  markers(true);
  try {
    await playShots(run, ENDING, frames, cap);
  } finally {
    markers(false);
    cap.remove();
    root.visible = true;
    scene.remove(stage);
    scene.remove(room.group);
    disposeTree(stage);
    disposeTree(room.group);
  }
}
