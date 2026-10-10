// Chapter 1's opening and ending, told with the village's own 3-D world (Lead
// 2026-10-09: "add entrance and exit animation scenes ... keep the scene
// relevant to the chapters").
//
// OPENING (29 s, the first visit, before the title card):
//   0-6    dawn: the camera far out over the sea to the north-west; a sailing
//          ship heads away over the water.
//   6-13   the camera dives to the north shore. The sea is a big curved sphere,
//          so the ship's hull sinks out of sight before its mast (a hint of
//          Lesson 1A: the Earth is round).
//   13-19  the sun rises over the sea; her stick's shadow shortens as it climbs
//          (a hint of Lesson 1B).
//   19-24  the camera comes down the north road past the village gate.
//   24-29  the camera settles behind her; the villagers wave, she waves.
//
// ENDING (29.8 s, the first completion, before the "Chapter complete" card):
//   0-6    the Science Center is finished; the camera circles it as dusk falls.
//   6-12.6 the dome opens and the telescope swings up to the Moon; the first
//          stars come out.
//   12.6-18.6 the villagers walk in from their homes and gather in front of her.
//   18.6-29.8 the camera looks west down the road, over the bridge, to the far
//          city (Chapter 2, Forces and Machines: bridges and gears).
//   Level 1 only: at 17.6 (after the villagers gather) the film holds for a
//          piñata she hits with a stick: ten hits (Space, Enter or a tap), then
//          it bursts into candy and the road west goes on.
//
// Captions are timed so each one has its reading time (readMs, src/play/readTime.js)
// before the next starts; chapterStory.js holds the film if a gap is too short.
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
export const OPENING_LENGTH = 29;
const OPEN_LEN = OPENING_LENGTH;
/** The ship is drawn 2.4x: the hull has to stay readable at the camera's distance (the hull-first beat). */
const SHIP_SCALE = 2.4;
/** The opening's captions: [start time, [Level 4, Level 1]]. */
export const CAPS_OPEN = [
  [0, ['Dawn over Science Village. A ship sails out to sea.', 'Morning. A boat sails away.']],
  [6, ['Watch the ship. Its hull sinks out of sight first. The sea is curved, like the Earth!', 'Its bottom goes away first. The Earth is round!']],
  [13.2, ['The sun rises. Her stick\'s shadow gets shorter as the sun climbs.', 'The sun is up. The shadow gets short.']],
  [18.7, ['The village gate. The villagers are up and waiting.', 'The gate. Hello, everyone!']],
  [23.8, ['Our scientist is here! Let\'s help the village.', 'Hello! Let\'s help the village.']],
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

// --- Level 1's piñata (the ending holds here until she has hit it ten times) --------

const UP = new THREE.Vector3(0, 1, 0);
const PINATA_R = 0.34;
const HITS_TO_BREAK = 10;
const SWING_LEAD = 0.31;     // the chop clip's strike comes 0.31 s into the swing (clips.js chopPose)
const SWING_LEN = 0.4;       // a swing takes this long; a press during one queues one more
const BREAK_HOLD = 2.4;      // the burst and fade after the last hit, then the film carries on
const BITS = 90;             // candies (60) and confetti (30); 30 on reduced motion
const GRAVITY = 9.8;
const CANDY_COLORS = [0xff6b9a, 0x4dd0e1, 0xffd43b, 0x9be564, 0xb388ff];
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _b = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/** The beat's words and key picture and the grown-up Skip: DOM, shown only during the beat. */
function beatUi(onSkip) {
  const css = document.createElement('style');
  css.textContent = `
@keyframes pn-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.pn-count { position: fixed; left: 50%; top: 9vh; transform: translateX(-50%); z-index: 9001; pointer-events: none;
  font: 800 clamp(30px, 5vw, 48px)/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif; color: #fff; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
.pn-key { position: fixed; right: 6vw; top: 40vh; z-index: 9001; pointer-events: none; padding: 10px 18px; border-radius: 12px;
  background: #fffdf7; color: #1d2433; font: 800 18px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif;
  box-shadow: 0 6px 0 #b9b2a0, 0 10px 24px rgba(0,0,0,.35); animation: pn-pulse 1s ease-in-out infinite; }
.pn-skip { position: fixed; right: 18px; bottom: calc(11vh + 12px); z-index: 9001; padding: 6px 12px; border: 0; border-radius: 10px;
  background: rgba(5,7,13,.55); color: #c9d2e8; font: 600 13px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif; cursor: pointer; }`;
  document.head.appendChild(css);
  const count = document.createElement('div');
  count.className = 'pn-count';
  const key = document.createElement('div');
  key.className = 'pn-key';
  key.textContent = 'Space';
  const skip = document.createElement('button');
  skip.className = 'pn-skip';
  skip.textContent = 'Skip';
  skip.addEventListener('click', onSkip);
  const nodes = [count, key, skip];
  document.body.append(...nodes);
  return {
    count(n) { count.textContent = `${n} / ${HITS_TO_BREAK}`; },
    show(on) { for (const n of nodes) n.style.display = on ? '' : 'none'; },
    waiting(on) { key.style.display = on ? '' : 'none'; skip.style.display = on ? '' : 'none'; },
    remove() { for (const n of nodes) n.remove(); css.remove(); },
  };
}

/**
 * The piñata: a spiky toon star-ball on a rope from a branch on a post, just in
 * front of her, with a stick in her right hand. The film holds here (tick(dt)
 * advances the beat's clock) until she has hit it ten times: a press (Space,
 * Enter or a tap on the canvas) swings the stick, and the strike a moment in
 * is a hit. Each hit wobbles it and throws a few candies; the tenth breaks it
 * into three pieces and throws the rest. `hero` is her feet and `fwd` her
 * facing (x, z). Nothing allocates per frame. Reduced motion: no sway.
 */
function buildPinata({ hero, fwd, avatar, reduced }) {
  const group = new THREE.Group();
  group.visible = false;
  const gY = hero.y;
  const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  const at = (f, s, h) => new THREE.Vector3(hero.x + fwd.x * f + side.x * s, gY + h, hero.z + fwd.z * f + side.z * s);
  const vel = (f, s, up) => new THREE.Vector3(fwd.x * f + side.x * s, up, fwd.z * f + side.z * s);
  const A = at(1.0, 0, 1.71);   // the rope's top, on the branch (the piñata's centre hangs 0.76 below, at her stick-tip height)

  // The post and the branch (still).
  const wood = new Mesher({ outlineT: 0.03 });
  const foot = at(2.1, -0.9, 0), top = at(2.1, -0.9, 2.1);
  wood.cyl(0.075, 0.075, 2.1, foot.x, foot.y, foot.z, 0x8a5a34, { seg: 8 });
  wood.tube(top.x, top.y, top.z, A.x, A.y, A.z, 0.05, 0x8a5a34, { seg: 6 });
  group.add(wood.build());

  // The rope and the piñata hang from A. The yaw turns local +z to her facing,
  // and the sway swings the piñata in that plane, so the stick meets it head on.
  const yaw = new THREE.Group();
  yaw.position.copy(A);
  yaw.rotation.y = Math.atan2(fwd.x, fwd.z);
  const pend = new THREE.Group();
  yaw.add(pend);
  group.add(yaw);
  const rope = new Mesher();
  rope.tube(0, 0, 0, 0, -0.42, 0, 0.018, 0xd9b87a, { seg: 5 });
  pend.add(rope.build());
  const body = new THREE.Group();
  body.position.y = -0.76;
  body.name = 'pinataBody';
  pend.add(body);

  // Three pieces: the top half with three spikes, the bottom half with one, and two loose spikes.
  const pink = new THREE.MeshToonMaterial({ color: 0xff7eb6, gradientMap: toonRamp, transparent: true });
  const spikeMats = [0xffd43b, 0x4dd0e1, 0x9be564].map((c) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp, transparent: true }));
  const cone = new THREE.ConeGeometry(0.11, 0.26, 8);
  const spike = (x, y, z, mat) => {
    const dir = new THREE.Vector3(x, y, z);
    const m = new THREE.Mesh(cone, mat);
    m.position.copy(dir).multiplyScalar(PINATA_R + 0.08);
    m.quaternion.setFromUnitVectors(UP, dir);
    return m;
  };
  const half = (thetaStart) => new THREE.Mesh(new THREE.SphereGeometry(PINATA_R, 16, 10, 0, Math.PI * 2, thetaStart, Math.PI / 2), pink);
  const topPiece = new THREE.Group();
  topPiece.add(half(0), spike(0, 1, 0, spikeMats[0]), spike(1, 0, 0, spikeMats[1]), spike(-1, 0, 0, spikeMats[2]));
  const bottomPiece = new THREE.Group();
  bottomPiece.add(half(Math.PI / 2), spike(0, -1, 0, spikeMats[0]));
  const sidePiece = new THREE.Group();
  sidePiece.add(spike(0, 0, 1, spikeMats[1]), spike(0, 0, -1, spikeMats[2]));
  body.add(topPiece, bottomPiece, sidePiece);
  const pieces = [
    { obj: topPiece, v: vel(0.9, 0.5, 1.6), axis: new THREE.Vector3(0.3, 1, 0.2).normalize(), w: 6 },
    { obj: bottomPiece, v: vel(0.5, -0.6, 0.9), axis: new THREE.Vector3(1, 0.2, 0.4).normalize(), w: -7 },
    { obj: sidePiece, v: vel(0.2, 1.2, 2.1), axis: new THREE.Vector3(0, 0, 1), w: 9 },
  ].map((p) => ({ ...p, p0: new THREE.Vector3(), q0: new THREE.Quaternion() }));

  // The candies and confetti: one instanced mesh. Each bit has a throw speed, a spin and a colour,
  // and is thrown (t0 = the beat's clock when it was thrown, from where) by a hit or by the break.
  const rng = makeRng(91);
  const count = reduced ? 30 : BITS;
  const bitMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp, transparent: true });
  const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bitMat, BITS);
  bits.count = count;
  bits.frustumCulled = false;
  const scl = new Float32Array(BITS * 3);
  const launch = new Float32Array(BITS * 3);
  const base = new Float32Array(BITS * 4);
  const spin = new Float32Array(BITS);
  const t0 = new Float32Array(BITS).fill(-1);
  const from = new Float32Array(BITS * 3);
  const col = new THREE.Color();
  for (let i = 0; i < BITS; i++) {
    const confetti = i >= 60;   // the last 30 are flat confetti, the rest little sweets
    const k = 0.8 + 0.4 * rng();
    _s.set(confetti ? 0.11 * k : 0.07 * k, confetti ? 0.012 : 0.07 * (0.8 + 0.4 * rng()), confetti ? 0.06 * (0.8 + 0.4 * rng()) : 0.07 * (0.8 + 0.4 * rng()));
    _s.toArray(scl, i * 3);
    const ang = rng() * Math.PI * 2;
    const hs = confetti ? 0.4 + 0.5 * rng() : 0.6 + 1.6 * rng();
    const up = confetti ? 0.9 + 0.6 * rng() : 2.2 + 2.0 * rng();
    launch.set([Math.cos(ang) * hs, up, Math.sin(ang) * hs], i * 3);
    _q.setFromEuler(new THREE.Euler(rng() * 6, rng() * 6, rng() * 6)).toArray(base, i * 4);
    spin[i] = (rng() - 0.5) * 16;
    bits.setColorAt(i, col.setHex(CANDY_COLORS[i % CANDY_COLORS.length]));
    bits.setMatrixAt(i, _m.compose(_p.set(0, 0, 0), _q.identity(), _s.set(0, 0, 0)));   // hidden until thrown
  }
  group.add(bits);
  const fadeMats = [pink, bitMat, ...spikeMats];

  // Her stick, in her right hand (the rig's handR bone; a fixed spot if the avatar has none).
  const stickMesh = new Mesher({ outlineT: 0.02 });
  stickMesh.cyl(0.035, 0.035, 0.75, 0, -0.75, 0, 0x8a5a34, { seg: 6 });
  stickMesh.box(0.09, 0.14, 0.03, 0, -0.62, 0, 0xff6b9a, { outline: false });   // a ribbon
  const stick = stickMesh.build();
  stick.name = 'pinataStick';
  stick.visible = false;
  const hand = avatar?.group?.getObjectByName('handR');
  if (hand) hand.add(stick);
  else if (avatar?.group) { stick.position.set(0.3, 1.0, 0.1); avatar.group.add(stick); }

  const ui = beatUi(() => skipBeat());
  let clock = 0, started = false, hits = 0, broke = false, breakAt = 0;
  let swing = -1, impacted = false, queued = false, wobbleAt = -10;
  const origin = new THREE.Vector3();
  let cursor = 0;

  const throwAt = (i, world) => { t0[i] = clock; from.set([world.x, world.y, world.z], i * 3); };
  function startSwing() {
    swing = 0;
    impacted = false;
    avatar?.play?.('chop', { fade: 0.1 });
  }
  function breakNow() {
    broke = true;
    breakAt = clock;
    body.getWorldPosition(origin);
    for (const p of pieces) { group.attach(p.obj); p.p0.copy(p.obj.position); p.q0.copy(p.obj.quaternion); }
    for (let i = 0; i < count; i++) throwAt(i, origin);
    swing = -1;
    queued = false;
    ui.count(HITS_TO_BREAK);
    ui.waiting(false);
  }
  function hit() {
    hits += 1;
    wobbleAt = clock;
    ui.count(hits);
    if (hits >= HITS_TO_BREAK) { breakNow(); return; }
    body.getWorldPosition(origin);
    for (let k = 0; k < 4; k++) { throwAt(cursor % count, origin); cursor += 1; }
  }
  function skipBeat() { if (!broke) breakNow(); }

  /** A press: a swing, or one queued behind the swing in progress. */
  function press() {
    if (!started || broke) return;
    if (swing < 0) startSwing();
    else queued = true;
  }
  // Keys count on key-up: a modal's key capture can swallow a key-down (the first Space was lost).
  const onKey = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } };
  const onPointer = (e) => { if (e.target?.tagName === 'CANVAS') press(); };
  globalThis.addEventListener?.('keyup', onKey);
  globalThis.addEventListener?.('pointerdown', onPointer);

  const pieceFade = (tau) => { const f = 1 - smooth((tau - 1.0) / 1.2); for (const m of fadeMats) m.opacity = f; };

  /** Advance the beat's clock by dt (the film holds meanwhile). */
  function tick(dt) {
    started = true;
    clock += dt;
    if (swing >= 0) {
      swing += dt;
      if (!impacted && swing >= SWING_LEAD) { impacted = true; hit(); }
      if (swing >= SWING_LEN && swing >= 0) {
        swing = -1;
        if (queued && !broke) { queued = false; startSwing(); }
      }
    }
    if (!broke) {
      const d = clock - wobbleAt;
      pend.rotation.x = (reduced ? 0 : 0.06 * Math.sin(1.6 * clock)) + (d > 0 ? 0.2 * Math.sin(15 * d) * Math.exp(-5 * d) : 0);
    } else {
      const tau = clock - breakAt;
      for (const p of pieces) {
        const ta = Math.min(tau, 0.6);
        p.obj.position.set(p.p0.x + p.v.x * ta, Math.max(gY + 0.14, p.p0.y + p.v.y * tau - 0.5 * GRAVITY * tau * tau), p.p0.z + p.v.z * ta);
        p.obj.quaternion.copy(p.q0).multiply(_q.setFromAxisAngle(p.axis, p.w * ta));
      }
      pieceFade(tau);
    }
    for (let i = 0; i < count; i++) {
      if (t0[i] < 0) continue;
      const k = i * 3;
      const tau = clock - t0[i];
      const ca = Math.min(tau, 1.1);
      _p.set(from[k] + launch[k] * ca, Math.max(gY + 0.05, from[k + 1] + launch[k + 1] * tau - 0.5 * GRAVITY * tau * tau), from[k + 2] + launch[k + 2] * ca);
      _b.fromArray(base, i * 4);
      _q.setFromAxisAngle(UP, spin[i] * Math.min(tau, 0.6)).multiply(_b);
      _s.fromArray(scl, k);
      bits.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    bits.instanceMatrix.needsUpdate = true;
    if (broke && clock - breakAt > BREAK_HOLD) ui.show(false);
  }

  return {
    group,
    stick,
    camera: { pos: at(0.6, 4.2, 2.1), look: at(0.5, 0, 1.0) },   // from her side, both in shot
    tick,
    press,
    skip: skipBeat,
    clock: () => clock,
    broke: () => broke,
    done: () => broke && clock - breakAt > BREAK_HOLD,
    /** Show the beat's pieces (the piñata, stick, counter and key) only while it is on. */
    setVisible(on) {
      group.visible = on;
      stick.visible = on;
      ui.show(on);
      ui.waiting(on && !broke);
    },
    dispose() {
      globalThis.removeEventListener?.('keyup', onKey);
      globalThis.removeEventListener?.('pointerdown', onPointer);
      ui.remove();
      stick.removeFromParent();
      disposeTree(stick);
      disposeTree(group);
      bits.dispose();
    },
  };
}

// --- the ending ---------------------------------------------------------------------

/** Seconds: the ending's scene (the "Chapter complete" card follows it). Level 1 holds at BEAT_AT for the piñata. */
export const ENDING_LENGTH = 29.8;
const END_LEN = ENDING_LENGTH;
const BEAT_AT = 17.6;   // Level 1: the piñata holds the film here (the villagers have gathered and their caption has had its time)
/** The ending's captions: [start time, [Level 4, Level 1]]. */
export const CAPS_END = [
  [0, ['The Science Center is finished! Dusk falls over the village.', 'The Science Center is done! The sun goes down.']],
  [6, ['The dome opens. The telescope turns to the Moon, and the first stars come out.', 'The roof opens. The telescope looks at the Moon. Stars!']],
  [12.6, ['The villagers come to thank her.', 'The people say thank you!']],
  [18.6, ['Cheers, scientist! The road goes west, over the bridge, to a great city.', 'Hooray! The road goes to a big city.']],
  [24.6, ['Next: Chapter 2, Forces and Machines: bridges and gears!', 'Next: bridges and gears!']],
];
const PINATA_CAP = 'Hit the piñata!';
const PINATA_DONE_CAP = 'Hooray! You did it!';
/** Level 1 after the piñata breaks: its own caption first, then the film's captions from BEAT_AT on. */
const CAPS_AFTER = [[BEAT_AT, [PINATA_DONE_CAP, PINATA_DONE_CAP]], ...CAPS_END.filter(([t0]) => t0 >= BEAT_AT)];
/** The test hook's handle on the playing piñata (Level 1 only). */
let activeBeat = null;
/** Level 1's test hook: one press (a swing), as if she had pressed Space. */
export function pinataHit() { activeBeat?.press(); }
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
  // Level 1's beat: she faces the way her player does (the avatar sits under it).
  const heading = getAvatar()?.group?.parent?.rotation?.y ?? 0;
  const pinata = LEVEL === 1 ? buildPinata({ hero, fwd: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)), avatar: getAvatar(), reduced }) : null;
  if (pinata) root.add(pinata.group);
  activeBeat = pinata;
  let lastT = 0;   // the film's time at the last step
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
    // Level 1: the film holds at BEAT_AT while the piñata is played (the film clock waits for her).
    holding(dt) {
      if (!pinata || lastT < BEAT_AT || pinata.done()) return false;
      pinata.tick(dt);
      return !pinata.done();
    },
    // While the piñata is up, her presses (Space, Enter, a tap) are hers, not a skip.
    takesInput(e) {
      return !!pinata && lastT >= BEAT_AT && !pinata.done() && (e.type === 'pointerdown' || e.code === 'Space' || e.key === 'Enter');
    },
    step(t, say) {
      lastT = t;
      // Reduced motion: stills every 6 s.
      const tq = reduced ? Math.floor(t / 6) * 6 : t;
      track(KEYS, tq, pos, look);
      // The piñata's camera: eases in as she gets ready, and out after the break.
      if (pinata && t >= BEAT_AT) {
        const w = pinata.broke() ? (reduced ? (t < BEAT_AT + 1 ? 1 : 0) : 1 - smooth((t - BEAT_AT) / 1)) : (reduced ? 1 : smooth(Math.min(pinata.clock(), 1)));
        pos.lerp(pinata.camera.pos, w);
        look.lerp(pinata.camera.look, w);
      }
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

      if (pinata) pinata.setVisible(t >= BEAT_AT && !pinata.done());
      // Level 1 after the piñata's start: "Hit the piñata!", then "Hooray!" once it has broken.
      say(!pinata || t < BEAT_AT ? captionAt(CAPS_END, t) : pinata.broke() ? captionAt(CAPS_AFTER, t) : PINATA_CAP);
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
      pinata?.dispose();
      if (activeBeat === pinata) activeBeat = null;
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
