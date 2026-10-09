// Chapter 1's opening and ending, told with the village's own 3-D world (Lead
// 2026-10-09: "add entrance and exit animation scenes ... keep the scene
// relevant to the chapters").
//
// OPENING (26 s, the first visit, before the title card):
//   0-6    dawn: the camera far out over the sea to the north-west; a sailing
//          ship heads away over the water.
//   6-12   the camera dives to the north shore. The sea is a big curved sphere,
//          so the ship's hull sinks out of sight before its mast (a hint of
//          Lesson 1A: the Earth is round).
//   12-18  the sun rises over the sea; her stick's shadow shortens as it climbs
//          (a hint of Lesson 1B).
//   18-22  the camera comes down the north road past the village gate.
//   22-26  the camera settles behind her; the villagers wave, she waves.
//
// ENDING (25 s, the first completion, before the "Chapter complete" card):
//   0-6    the Science Center is finished; the camera circles it as dusk falls.
//   6-12   the dome opens and the telescope swings up to the Moon; the first
//          stars come out.
//   12-18  the villagers walk in from their homes and gather in front of her.
//   18-25  the camera looks west down the road, over the bridge, to the far
//          city (Chapter 2, Forces and Machines: bridges and gears).
//
// Both return a scene for chapterStory (src/game/chapterStory.js):
// { duration, step(t, say), dispose() }. Captions are [Level 4, Level 1] pairs
// and are shown through say(). The village's townsfolk and name labels are
// hidden while a scene plays. dispose() restores everything it touched and
// removes everything it added. Reduced motion (prefers-reduced-motion) cuts
// between stills every 6 s instead of moving. Every move is a function of t,
// so the frame rate does not change it, and nothing allocates per frame.
import * as THREE from 'three';
import { Mesher, makeGear, makeLabel, makeRng, LIT, GLOW } from '../city/worldKit.js';
import { toonRamp, outlineMaterial } from '../game/toonPipeline.js';
import { tileToWorld, LEVEL } from './contracts.js';
import { NPCS } from './layout.js';
import { CENTER } from './worldCenter.js';

// The sea: a sphere, so the horizon curves like the Earth's (and the ship sinks).
const SEA_R = 900;
const SEA_Y = -SEA_R - 0.4;               // its top sits just under the village ground (y = 0)
const seaY = (x, z) => SEA_Y + Math.sqrt(Math.max(0, SEA_R * SEA_R - x * x - z * z));

const DAWN_SKY = new THREE.Color(0xf3b9a0);
const DUSK_SKY = new THREE.Color(0xf0a77a);
const NIGHT_SKY = new THREE.Color(0x1a2347);
const DAWN_SUN = new THREE.Color(0xffb27a);
const DUSK_SUN = new THREE.Color(0xff9a5a);
const WHITE = new THREE.Color(0xffffff);

// Materials the village shares (Mesher's); never disposed here.
const SHARED = new Set([LIT, GLOW, outlineMaterial]);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
const lerp = (a, b, k) => a + (b - a) * k;

/** Level 4 or Level 1 text for a [L4, L1] caption pair. */
const pick = (cap) => (cap ? (LEVEL === 1 ? cap[1] : cap[0]) : null);

/** The caption in force at time t: the last [t0, [L4, L1]] that has started. */
function captionAt(list, t) {
  let cap = null;
  for (const [t0, c] of list) if (t >= t0) cap = c;
  return pick(cap);
}

/**
 * Camera keys [t, px, py, pz, lx, ly, lz]: eased from one key to the next
 * into `pos` and `look`. The caller keeps t inside the keys' range.
 */
function track(keys, t, pos, look) {
  let i = 1;
  while (i < keys.length - 1 && t > keys[i][0]) i += 1;
  const a = keys[i - 1], b = keys[i];
  const k = smooth((t - a[0]) / (b[0] - a[0]));
  pos.set(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k));
  look.set(lerp(a[4], b[4], k), lerp(a[5], b[5], k), lerp(a[6], b[6], k));
}

function prefersReduced() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Hide, while a scene plays, the village's walking folk, the walk-to arrow,
 * name labels, the endless grass beyond the map (groundOuter would cover the sea) and the
 * scenery (its forest belt stands on that grass, so it would float on the sea;
 * the flowers and bushes go too). Returns the restore.
 */
function hideVillage(scene, world, markers) {
  const hidden = [
    scene.getObjectByName('townsfolk'), scene.getObjectByName('navArrow'),
    world.root?.getObjectByName('groundOuter'), world.root?.getObjectByName('scenery'),
    world.root?.getObjectByName('pickups'),
  ].filter(Boolean);
  const was = hidden.map((o) => o.visible);
  for (const o of hidden) o.visible = false;
  world.setLabelsVisible?.(false);
  markers?.(true);   // pickup glows, station beacons and the highlight ring (main.js filmMarkers)
  return () => {
    markers?.(false);
    hidden.forEach((o, i) => { o.visible = was[i]; });
    world.setLabelsVisible?.(true);
  };
}

/** Free a built group's own geometry and materials (the shared village ones stay). */
function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || SHARED.has(m)) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
}

// --- props ------------------------------------------------------------------------

/** The sea, a big toon sphere under the village. */
function buildSea() {
  const sea = new THREE.Mesh(
    new THREE.SphereGeometry(SEA_R, 96, 48),
    new THREE.MeshToonMaterial({ color: 0x3f9fd6, gradientMap: toonRamp }),
  );
  sea.position.y = SEA_Y;
  return sea;
}

/** A glowing disc (sun or moon) with a soft halo. */
function buildDisc(r, color, haloR, haloOpacity) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 1 }));
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(haloR, 20, 12),
    new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: haloOpacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.renderOrder = 2;
  g.add(disc, halo);
  return g;
}

/** A small sailing ship, bow along +Z, its waterline at y = 0. */
function buildShip() {
  const m = new Mesher({ outlineT: 0.05 });
  m.box(2.8, 1.6, 7.2, 0, -0.5, 0, 0x8a5a34);          // hull
  m.box(2.9, 0.22, 7.3, 0, 0.5, 0, 0xf1ebe0, { outline: false });   // cream rail
  m.box(2.2, 0.9, 2.2, 0, 1.1, -1.6, 0xb07a4a);        // aft cabin
  m.cyl(0.13, 0.16, 8.6, 0, 1.2, 0.6, 0x6b4a2b, { seg: 8 });        // mast
  const g = new THREE.Group();
  g.add(m.build());
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(3.2, 0);
  shape.lineTo(0, 6.6);
  shape.closePath();
  const sail = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshToonMaterial({ color: 0xfff8e7, gradientMap: toonRamp, side: THREE.DoubleSide }),
  );
  sail.position.set(0, 1.4, 0.6);
  sail.rotation.y = Math.PI / 2;                       // a fore-and-aft sail: seen from the side
  g.add(sail);
  return g;
}

/** A villager in the village's colours (layout.js NPCS): legs and body, arms on shoulder pivots. */
function buildPerson(npc) {
  const body = new Mesher({ outlineT: 0.035 });
  body.box(0.18, 0.62, 0.2, -0.1, 0, 0, 0x3a3f58);
  body.box(0.18, 0.62, 0.2, 0.1, 0, 0, 0x3a3f58);
  body.box(0.5, 0.62, 0.3, 0, 0.62, 0, npc.shirt);
  body.sph(0.2, 0, 1.36, 0, npc.skin, { seg: 10, segV: 6, outline: false });
  body.sph(0.215, 0, 1.38, -0.01, npc.hair, { seg: 10, segV: 5, thetaLen: 1.45, outline: false });
  const g = new THREE.Group();
  g.add(body.build());
  const arm = (side) => {
    const a = new Mesher({ outlineT: 0.03 });
    a.box(0.16, 0.66, 0.18, 0, -0.66, 0, npc.shirt);
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 1.12, 0);
    pivot.add(a.build());
    g.add(pivot);
    return pivot;
  };
  return { g, armL: arm(-1), armR: arm(1) };
}

/**
 * Pose a villager: `wave` 0..1 raises her right arm, `walk` 0..1 swings the
 * arms and bobs her, `ph` is the walk phase. No allocation.
 */
function poseFigure(p, wave, walk, ph) {
  const swing = Math.sin(ph) * 0.55 * walk;
  p.armL.rotation.x = swing;
  p.armR.rotation.x = -swing * (1 - wave);
  p.armR.rotation.z = wave * (2.4 + 0.35 * Math.sin(ph * 1.6));
  p.g.position.y = Math.abs(Math.sin(ph)) * 0.05 * walk;
}

/** The village stick and its shadow (the shadow is a flat quad, length set each frame). */
const STICK_H = 1.8;
const STICK_AT = { x: -11.25, z: -26.25 };
function buildStick() {
  const m = new Mesher({ outlineT: 0.04 });
  m.cyl(0.07, 0.07, STICK_H, 0, 0, 0, 0x8a5a34, { seg: 6 });
  m.sph(0.14, 0, STICK_H, 0, 0xffd43b, { seg: 6, segV: 4, glow: true, outline: false });
  const g = new THREE.Group();
  g.position.set(STICK_AT.x, 0, STICK_AT.z);
  g.add(m.build());
  const shadow = new THREE.Mesh(
    (() => { const p = new THREE.PlaneGeometry(0.42, 1); p.rotateX(-Math.PI / 2); p.translate(0, 0, 0.5); return p; })(),
    new THREE.MeshBasicMaterial({ color: 0x1d2433, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.position.set(STICK_AT.x, 0.03, STICK_AT.z);
  return { group: g, shadow };
}

/** The village gate: two posts and a beam over the north road, with a sign. */
function buildGate() {
  const m = new Mesher({ outlineT: 0.05 });
  m.box(0.5, 3.4, 0.5, -21.2, 0, -23.75, 0x8a5a34);
  m.box(0.5, 3.4, 0.5, -16.3, 0, -23.75, 0x8a5a34);
  m.box(5.6, 0.6, 0.6, -18.75, 3.1, -23.75, 0x6b4a2b);
  const g = new THREE.Group();
  g.add(m.build());
  const sign = makeLabel('Science Village', { icon: '🔬', height: 0.75, accent: '#ffd43b' });
  sign.position.set(-18.75, 4.5, -23.75);
  g.add(sign);
  return g;
}

/** Stars: a fixed random sky of points in the upper half, fading in. */
function buildStars() {
  const rng = makeRng(77);
  const n = 90;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = rng() * 2 - 1, y = 0.2 + rng() * 0.8, z = rng() * 2 - 1;
    const l = Math.hypot(x, y, z);
    pos[i * 3] = (x / l) * 320; pos[i * 3 + 1] = (y / l) * 320; pos[i * 3 + 2] = (z / l) * 320;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff7d6, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
}

/** The far city across the bridge (the Chapter 2 teaser): a causeway on pillars, towers out of the sea, a clock gear. */
function buildBridgeAndCity() {
  const g = new THREE.Group();
  const z = 11.25;                                     // the village's west road
  const deckY = 1.2;
  const m = new Mesher({ outlineT: 0.06 });
  m.box(80, 0.5, 2.6, -80, deckY - 0.5, z, 0xc4a066);            // deck, x -120..-40
  m.box(80, 0.6, 0.25, -80, deckY + 0.5, z - 1.3, 0xf1ebe0);      // rails
  m.box(80, 0.6, 0.25, -80, deckY + 0.5, z + 1.3, 0xf1ebe0);
  for (let x = -46; x > -118; x -= 9) m.box(0.9, deckY - seaY(x, z), 0.9, x, seaY(x, z), z, 0x9a8a72);
  const towers = [[-128, -6, 7, 30, 0x8ecae6], [-136, 14, 8, 24, 0xb197fc], [-146, -12, 9, 38, 0x9bd5b1], [-154, 10, 8, 28, 0xffd6a5]];
  for (const [x, zz, w, h, c] of towers) {
    const y = seaY(x, zz);
    m.box(w, h, w, x, y, zz, c);
    m.pyramid(w + 0.8, w + 0.8, 3.2, x, y + h, zz, 0x5c677d);
    for (let k = 0; k < 3; k++) m.box(0.3, 0.9, 0.7, x + w / 2 + 0.02, y + 4 + k * 5, zz, 0xffe066, { glow: true, outline: false });
  }
  // the clock tower and its gear, facing the road
  const cy = seaY(-140, z);
  m.box(8, 46, 8, -140, cy, z, 0xdee2e6);
  g.add(m.build());
  const gear = makeGear({ r: 2.4, t: 0.5, teeth: 12, color: 0xffc233, hub: 0x6c757d });
  const face = new THREE.Group();
  face.position.set(-140 + 4.15, cy + 38, z);
  face.rotation.y = Math.PI / 2;
  face.add(gear);
  g.add(face);
  return { group: g, gear };
}

// The shore: a sand bank that slopes from the village's edge down into the curved
// sea, so no hard rim shows against the horizon (lead, films fix round).
const MAP_HALF = 40;     // half the village map (MAP_W * TILE / 2)
const BEACH = 12;        // the bank runs this far out from the edge, down to the sea
const SHORE_N = 52;      // the shore grid's half size (MAP_HALF + BEACH)
const outsideMap = (x, z) => Math.max(Math.abs(x) - MAP_HALF, Math.abs(z) - MAP_HALF, 0);

function buildShore() {
  const side = SHORE_N * 2 + 1;
  const pos = new Float32Array(side * side * 3);
  const col = new Float32Array(side * side * 3);
  const cGrass = new THREE.Color(0x6db85a), cSand = new THREE.Color(0xd9c48f), cSea = new THREE.Color(0x3f9fd6);
  const c = new THREE.Color();
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = i - SHORE_N, z = j - SHORE_N;
      const d = outsideMap(x, z);
      const k = smooth(d / BEACH);
      const p = (j * side + i) * 3;
      pos[p] = x; pos[p + 1] = k * (seaY(x, z) + 0.04); pos[p + 2] = z;
      if (d < 1.5) c.copy(cGrass).lerp(cSand, d / 1.5);
      else c.copy(cSand).lerp(cSea, (d - 1.5) / (BEACH - 1.5));
      col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
    }
  }
  const index = [];
  for (let j = 0; j < side - 1; j++) {
    for (let i = 0; i < side - 1; i++) {
      const d = outsideMap(i - SHORE_N + 0.5, j - SHORE_N + 0.5);
      if (d <= 0 || d >= BEACH) continue;
      const a = j * side + i, b = a + 1, cc = a + side, dd = cc + 1;
      index.push(a, cc, b, b, cc, dd);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp }));
}

// --- the opening --------------------------------------------------------------------

/** Seconds: the opening's scene (the title card adds its own hold, see chapterStory.js). */
export const OPENING_LENGTH = 26;
const OPEN_LEN = OPENING_LENGTH;
/** The ship is drawn 2.4x: the hull has to stay readable at the camera's distance (the hull-first beat). */
const SHIP_SCALE = 2.4;
/** The opening's captions: [start time, [Level 4, Level 1]]. */
export const CAPS_OPEN = [
  [0, ['Dawn over Science Village. A ship sails out to sea.', 'Morning. A boat sails away.']],
  [6, ['Watch the ship. Its hull sinks out of sight first. The sea is curved, like the Earth!', 'Its bottom goes away first. The Earth is round!']],
  [13, ['The sun rises. Her stick\'s shadow gets shorter as the sun climbs.', 'The sun is up. The shadow gets short.']],
  [18, ['The village gate. The villagers are up and waiting.', 'The gate. Hello, everyone!']],
  [22, ['Our scientist is here! Let\'s help the village.', 'Hello! Let\'s help the village.']],
];
// The villagers along the north road, on the way down from the gate (x, z, facing).
const OPEN_FOLK = [
  [0, -24.4, -10, Math.PI / 2], [1, -12.6, -12, -Math.PI / 2], [2, -24.4, 2, Math.PI / 2],
  [3, -12.6, -2, -Math.PI / 2], [4, -12.6, 8, -Math.PI / 2],
];

/**
 * The opening scene (see the header). `ctx`: { scene, camera, world, sun,
 * getAvatar(), chasePose() } and optionally `reduced` (tests).
 */
export function playOpening(ctx) {
  const { scene, camera, world, sun, getAvatar, chasePose } = ctx;
  const reduced = ctx.reduced ?? prefersReduced();
  const home = chasePose();
  // The hull beat (6-13 s): the camera holds low on the shore, close to the ship
  // (2.4x size, so the hull is big enough at ~130 units), until the hull has
  // dipped out of sight and the mast still shows.
  const KEYS = [
    [0, -110, 45, -135, 20, 2, -40],
    [5, -62, 20, -110, 60, 1, -70],
    [8, -34, 4, -76, 84, 0.8, -78],
    [13, -20, 2.2, -62, 118, 0.6, -82],
    [18, -10, 10, -40, -16, 0, -6],
    [22, -6.5, 4.8, -18, -21, 1.6, 6],
    [OPEN_LEN, home.pos.x, home.pos.y, home.pos.z, home.look.x, home.look.y, home.look.z],
  ];

  const root = new THREE.Group();
  root.name = 'cutscene:opening';
  const sea = buildSea();
  const ship = buildShip();
  ship.scale.setScalar(SHIP_SCALE);
  const shore = buildShore();
  const sunDisc = buildDisc(9, 0xffd27a, 15, 0.14);
  const stick = buildStick();
  const gate = buildGate();
  const folk = OPEN_FOLK.map(([i, x, z, face]) => {
    const p = buildPerson(NPCS[i]);
    p.g.position.set(x, 0, z);
    p.g.rotation.y = face;
    root.add(p.g);
    return p;
  });
  root.add(sea, shore, ship, sunDisc, stick.group, stick.shadow, gate);
  scene.add(root);

  const restoreVillage = hideVillage(scene, world, ctx.markers);
  const sunI0 = sun.intensity;
  const sunC0 = sun.color.clone();
  const bg0 = (scene.background || new THREE.Color(0x8ed0f5)).clone();
  const fog0 = (scene.fog ? scene.fog.color : new THREE.Color(0x8ed0f5)).clone();
  const fogNF0 = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let waved = false;
  let done = false;

  return {
    duration: OPEN_LEN,
    step(t, say) {
      const tq = reduced ? Math.floor(t / 6) * 6 : t;
      track(KEYS, tq, pos, look);
      camera.position.copy(pos);
      camera.lookAt(look);

      // The ship sails away to the north-east, over the curve of the sea.
      const sx = 56 + 4.6 * tq, sz = -64 - 1.4 * tq;
      ship.position.set(sx, seaY(sx, sz), sz);
      ship.rotation.y = Math.atan2(4.6, -1.4);

      // Haze: the village is far off at the start, so the fog starts thin and thickens to the usual.
      if (fogNF0 && scene.fog) {
        const kf = smooth(tq / 12);
        scene.fog.near = lerp(160, fogNF0.near, kf);
        scene.fog.far = lerp(900, fogNF0.far, kf);
      }

      // Dawn: the sun rises low in the east (its light and shadow warm up with it).
      const u = tq / OPEN_LEN;
      const sunY = -6 + 150 * smooth(u);
      sunDisc.position.set(260, sunY, -40);
      const k = smooth(tq / 18);
      scene.background?.lerpColors(DAWN_SKY, bg0, k);
      scene.fog?.color.lerpColors(DAWN_SKY, fog0, k);
      sun.color.lerpColors(DAWN_SUN, sunC0, k);
      sun.intensity = lerp(0.6, sunI0, k);

      // Her stick's shadow points away from the sun and shortens as it climbs.
      const elev = Math.atan2(sunY, Math.hypot(260, 40));
      const len = Math.min(14, STICK_H / Math.max(0.05, Math.tan(elev)));
      stick.shadow.rotation.y = Math.atan2(-260, 40);
      stick.shadow.scale.z = len;

      // The villagers wave as the camera comes down the road; she waves last.
      const wave = smooth((tq - 19) / 1) * (1 - smooth((tq - 25) / 1));
      for (const p of folk) poseFigure(p, wave, 0, tq * 7);
      if (!waved && tq >= 21) { waved = true; getAvatar()?.play?.('wave', { hold: 2 }); }

      say(captionAt(CAPS_OPEN, t));
    },
    dispose() {
      if (done) return;
      done = true;
      scene.remove(root);
      for (const g of [sea, shore, ship, sunDisc, stick.group, stick.shadow, gate]) disposeTree(g);
      for (const p of folk) disposeTree(p.g);
      restoreVillage();
      sun.intensity = sunI0;
      sun.color.copy(sunC0);
      scene.background?.copy(bg0);
      scene.fog?.color.copy(fog0);
      if (fogNF0 && scene.fog) { scene.fog.near = fogNF0.near; scene.fog.far = fogNF0.far; }
    },
  };
}

// --- the ending ---------------------------------------------------------------------

/** Seconds: the ending's scene (the "Chapter complete" card follows it). */
export const ENDING_LENGTH = 25;
const END_LEN = ENDING_LENGTH;
/** The ending's captions: [start time, [Level 4, Level 1]]. */
export const CAPS_END = [
  [0, ['The Science Center is finished! Dusk falls over the village.', 'The Science Center is done! The sun goes down.']],
  [6, ['The dome opens. The telescope turns to the Moon, and the first stars come out.', 'The roof opens. The telescope looks at the Moon. Stars!']],
  [12, ['The villagers come to thank her.', 'The people say thank you!']],
  [18, ['Cheers, scientist! The road goes west, over the bridge, to a great city.', 'Hooray! The road goes to a big city.']],
  [22, ['Next: Chapter 2, Forces and Machines: bridges and gears!', 'Next: bridges and gears!']],
];
const DOME_Y = CENTER.slabTop + 2.4 + 0.14 + 1.1 + 0.14;   // the Science Center's dome base (centre.js)
const MOON_AT = { x: CENTER.x - 20, y: 40, z: CENTER.z - 120 };
const SCOPE_BASE = { x: -0.5, y: DOME_Y + 1.62, z: 0.3 };  // telescope pivot, in the piece's frame

/**
 * The ending scene (see the header). `ctx`: { scene, camera, world, sun,
 * getAvatar(), getPlayerPos() } and optionally `reduced` (tests).
 */
export function playEnding(ctx) {
  const { scene, camera, world, sun, getAvatar, getPlayerPos } = ctx;
  const reduced = ctx.reduced ?? prefersReduced();
  const CX = CENTER.x, CZ = CENTER.z;
  const KEYS = [
    [0, CX - 16, 8, CZ - 6, CX, 4, CZ],
    [6, CX - 4, 12, CZ + 17, CX, 10, CZ - 4],
    [12, CX + 1.5, 11, CZ + 14, CX, 10.5, CZ - 3],
    [17, 1, 5, 12, 3.75, 1.8, 21],
    [22, 8, 4.4, 14.5, -130, 3, 11.25],
    [END_LEN, 8, 4.4, 14.5, -140, 3, 11.25],
  ];
  const hero = getPlayerPos().clone();

  const root = new THREE.Group();
  root.name = 'cutscene:ending';
  const sea = buildSea();
  const city = buildBridgeAndCity();
  const stars = buildStars();
  const moon = buildDisc(10, 0xfff4d6, 16, 0.22);
  moon.position.set(MOON_AT.x, MOON_AT.y, MOON_AT.z);
  const sunDisc = buildDisc(11, 0xffa45a, 18, 0.2);
  const shore = buildShore();
  root.add(sea, shore, city.group, stars, moon, sunDisc);
  scene.add(root);

  // The dome opens (two halves slide apart over a dark drum) and the telescope
  // swings up to the Moon. Built in the Science Center's frame (turned half a
  // turn, like its piece), then the village's own dome and scope are hidden.
  const wrap = new THREE.Group();
  wrap.position.set(CX, 0, CZ);
  wrap.rotation.y = Math.PI;
  const dome = new Mesher({ outlineT: 0.04 });
  dome.cyl(1.8, 1.9, 0.3, 0, DOME_Y, 0, 0xe9d5ff);
  const drumTop = new THREE.Mesh(new THREE.CircleGeometry(1.75, 24), new THREE.MeshBasicMaterial({ color: 0x2b1b52 }));
  drumTop.rotation.x = -Math.PI / 2;
  drumTop.position.y = DOME_Y + 0.31;
  wrap.add(dome.build(), drumTop);
  const shellMat = new THREE.MeshToonMaterial({ color: 0xffd43b, gradientMap: toonRamp, side: THREE.DoubleSide });
  const halves = [0, Math.PI].map((phi) => {
    const geo = new THREE.SphereGeometry(1.7, 24, 10, phi, Math.PI, 0, Math.PI / 2);
    const mesh = new THREE.Mesh(geo, shellMat);
    mesh.position.y = DOME_Y + 0.3;
    wrap.add(mesh);
    return mesh;
  });
  const scope = new THREE.Group();
  scope.position.set(SCOPE_BASE.x, SCOPE_BASE.y, SCOPE_BASE.z);
  const tube = new Mesher({ outlineT: 0.03 });
  tube.tube(0, 0, 0, 0, 0, 1.6, 0.11, 0xdee2e6, { seg: 10 });
  tube.tube(0, 0, 1.0, 0, 0, 1.25, 0.15, 0xffd43b, { seg: 10 });
  tube.sph(0.1, 0, 0, 1.65, 0x8ecae6, { seg: 8, segV: 6, glow: true, outline: false });
  tube.sph(0.14, 0, 0, -0.05, 0x868e96, { seg: 8, segV: 6, outline: false });
  scope.add(tube.build());
  wrap.add(scope);
  scene.add(wrap);

  // Where the scope points at the Moon (in the wrap's frame), and at rest.
  const qRest = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.7, 0.05, 0.7).normalize());
  const toMoon = new THREE.Vector3(MOON_AT.x - (CX + 0.5), MOON_AT.y - SCOPE_BASE.y, MOON_AT.z - (CZ - 0.3));
  // The wrap turns half a turn: its local x and z are flipped.
  toMoon.x = -toMoon.x; toMoon.z = -toMoon.z;
  const qMoon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), toMoon.normalize());
  const qNow = new THREE.Quaternion();

  // The villagers: from their homes to a little crescent in front of her.
  const folk = NPCS.map((npc, i) => {
    const p = buildPerson(npc);
    const home = tileToWorld(npc.tx, npc.ty);
    const a = (i - 2) * 0.42;
    const tx = hero.x + 5 * Math.sin(a), tz = hero.z - 5 * Math.cos(a);
    p.g.position.set(home.x, 0, home.z);
    root.add(p.g);
    return { p, hx: home.x, hz: home.z, tx, tz, walkHead: Math.atan2(tx - home.x, tz - home.z), faceHead: Math.atan2(hero.x - tx, hero.z - tz) };
  });

  const restoreVillage = hideVillage(scene, world, ctx.markers);
  const was = world.root ? [world.root.getObjectByName('scienceCenter4'), world.root.getObjectByName('scienceCenter5')] : [];
  const wasVisible = was.map((o) => o?.visible);
  for (const o of was) if (o) o.visible = false;
  const sunI0 = sun.intensity;
  const sunC0 = sun.color.clone();
  const bg0 = (scene.background || new THREE.Color(0x8ed0f5)).clone();
  const fog0 = (scene.fog ? scene.fog.color : new THREE.Color(0x8ed0f5)).clone();

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let cheered = false;
  let done = false;

  return {
    duration: END_LEN,
    step(t, say) {
      const tq = reduced ? Math.floor(t / 6) * 6 : t;
      track(KEYS, tq, pos, look);
      camera.position.copy(pos);
      camera.lookAt(look);

      // Dusk: the sun sets behind the city, the sky goes from day to dusk to night.
      const sunY = 120 * (1 - smooth(tq / 16)) - 20;
      sunDisc.position.set(-280, sunY, -40);
      sunDisc.visible = sunY > -30;
      sun.intensity = lerp(sunI0, sunI0 * 0.5, smooth(tq / 16));
      sun.color.lerpColors(sunC0, DUSK_SUN, smooth(tq / 10));
      if (scene.background) {
        scene.background.lerpColors(bg0, DUSK_SKY, smooth(tq / 10));
        scene.background.lerp(NIGHT_SKY, 0.45 * smooth((tq - 10) / 14));
        scene.fog?.color.copy(scene.background);
      }
      city.gear.rotation.z = tq * 0.5;

      // Stars and the Moon come out; the dome opens and the scope turns to the Moon.
      stars.material.opacity = smooth((tq - 7) / 6);
      moon.children[0].material.opacity = smooth((tq - 6) / 5);
      moon.children[1].material.opacity = 0.22 * smooth((tq - 6) / 5);
      const open = smooth((tq - 4.5) / 3.5);
      halves[0].position.z = open * 1.6;
      halves[1].position.z = -open * 1.6;
      qNow.slerpQuaternions(qRest, qMoon, smooth((tq - 6.5) / 4.5));
      scope.quaternion.copy(qNow);

      // The villagers walk in from their homes (12-17 s), then wave and face her.
      const walkK = smooth((tq - 11.5) / 0.6) * (1 - smooth((tq - 16.5) / 0.6));
      const wave = smooth((tq - 18) / 0.8) * (1 - smooth((tq - 21.5) / 0.8));
      for (const f of folk) {
        const k = smooth((tq - 12) / 5);
        f.p.g.position.x = lerp(f.hx, f.tx, k);
        f.p.g.position.z = lerp(f.hz, f.tz, k);
        f.p.g.rotation.y = lerp(f.faceHead, f.walkHead, walkK);
        poseFigure(f.p, wave, walkK, tq * 7);
      }
      if (!cheered && tq >= 18) { cheered = true; getAvatar()?.play?.('cheer', { hold: 4 }); }

      say(captionAt(CAPS_END, t));
    },
    dispose() {
      if (done) return;
      done = true;
      scene.remove(root, wrap);
      disposeTree(sea);
      disposeTree(shore);
      disposeTree(city.group);
      disposeTree(stars);
      disposeTree(moon);
      disposeTree(sunDisc);
      disposeTree(wrap);
      for (const f of folk) disposeTree(f.p.g);
      shellMat.dispose();
      restoreVillage();
      was.forEach((o, i) => { if (o) o.visible = wasVisible[i]; });
      sun.intensity = sunI0;
      sun.color.copy(sunC0);
      scene.background?.copy(bg0);
      scene.fog?.color.copy(fog0);
    },
  };
}
