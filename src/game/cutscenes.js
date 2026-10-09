// Chapter 3's own cutscenes ("Ready for Lift-off"), in place of the generic
// village sweep in chapterStory.js for the two ends of this chapter.
//
// OPENING (createOpening): the jump in time. "Years later..." over two small
// pictures of Chapter 1's village and Chapter 2's city, then the modern town
// at sunrise, a sweep down the main road past mission control to the launch
// complex and its empty tower, and a settle onto her with the title card.
// Every camera position comes from rocketVillageLayout.js (ROCKET_VILLAGE), not
// from a mesh, so the shots still frame the town whatever its buildings look like.
//
// ARRIVAL (createArrival): after a launch that reached orbit. The rocket's
// stages in space (copies of the real meshes, in their own small scene), Earth's
// curved horizon with the town's coast in daylight, then the Moon ahead, which
// is where Chapter 4 ("Voyage to Europa") starts. It holds on the Moon while the
// "Chapter complete" card from chapterStory.js is up.
//
// Both follow chapterStory's rules: the full version plays the first time a
// chapter is opened (or flown) at a Level; a returning child gets the title
// card only (the opening) or goes straight to the card (the arrival). Any key
// or click skips after about a second. Reduced motion gets stills (a hard cut
// between poses, no slides). Captions are [Level 4, Level 1] pairs. No sound.
//
// Lead 2026-10-09: "add entrance and exit animation scenes ... keep the scene
// relevant to the chapters". The arrival is the one-line bridge to Chapter 4.
//
// gameScene.js drives it: `opening.update(dt)` and `arrival.render(dt)` run
// from its tick while a scene owns the frame (both return true then).
import * as THREE from 'three';
import { toonRamp } from './toonPipeline.js';
import { ROCKET_VILLAGE } from './rocketVillageLayout.js';
import { SEEN_PREFIX } from '../launcher/profile.js';

// ---------------------------------------------------------------------------
// Shot lists. Durations are seconds of game time. The opening runs about 25 s
// and the arrival 21 s (plus the hold behind the card). Captions are
// [Level 4, Level 1]; Level 1 uses shorter words.
// ---------------------------------------------------------------------------

/** The opening, in order. `id` picks the camera move in openingPose(). */
export const OPENING_SHOTS = [
  { id: 'cards', dur: 4.6, caption: ['Years later...', 'Years later...'] },
  { id: 'reveal', dur: 5.2, caption: ['Years later, the same town builds rockets.', 'The town builds rockets now.'] },
  { id: 'road', dur: 7, caption: ['Down the main road, past mission control.', 'Down the road, past mission control.'] },
  { id: 'pad', dur: 4, caption: ['The launch tower stands empty, waiting for a rocket.', 'The tower is waiting for a rocket.'] },
  { id: 'her', dur: 4.4, caption: null },
];

/** The arrival in orbit, in order. */
export const ARRIVAL_SHOTS = [
  { id: 'stage', dur: 6.5, caption: ['In orbit at last: the rocket is in space.', 'The rocket is in space!'] },
  { id: 'earth', dur: 7, caption: ["Earth curves below. Our town's coast is in daylight.", 'Our home, down there in the sun.'] },
  { id: 'moon', dur: 7.5, caption: ["Ahead: the Moon, then Europa, Jupiter's icy moon.", 'Ahead: the Moon!'] },
];

/** Seconds in a shot list. */
export function totalSeconds(shots) {
  return shots.reduce((sum, s) => sum + s.dur, 0);
}

/** A caption pair for this Level: pair[0] for Level 4, pair[1] for Level 1. */
export function captionText(pair, level) {
  if (!pair) return null;
  return level === 1 ? pair[1] : pair[0];
}

const _where = { index: 0, u: 0, ok: false };
/**
 * Which shot is playing at time t. Writes into `out` (no allocation per frame)
 * and returns it: out.index, out.u (0..1 through that shot), out.ok (false past the end).
 */
export function locate(shots, t, out = _where) {
  let start = 0;
  for (let i = 0; i < shots.length; i++) {
    const dur = shots[i].dur;
    if (t < start + dur) {
      out.index = i;
      out.u = Math.max(0, (t - start) / dur);
      out.ok = true;
      return out;
    }
    start += dur;
  }
  out.index = shots.length - 1;
  out.u = 1;
  out.ok = false;
  return out;
}

// ---------------------------------------------------------------------------
// Maths (scratch arrays, so a frame allocates nothing)
// ---------------------------------------------------------------------------

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
const lerp3 = (out, a, b, k) => {
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
  return out;
};
/** Quadratic Bezier from a to b with control c. */
const bez3 = (out, a, c, b, k) => {
  const m = 1 - k;
  for (let i = 0; i < 3; i++) out[i] = m * m * a[i] + 2 * m * k * c[i] + k * k * b[i];
  return out;
};

function reducedMotion() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Seen before? No storage (a private window) counts as seen: the short path, as in chapterStory.js. */
function storageGet(key) {
  try { return globalThis.localStorage.getItem(key) === '1'; } catch { return true; }
}
function storageSet(key) {
  try { globalThis.localStorage?.setItem(key, '1'); } catch { /* private mode: it just replays */ }
}

// ---------------------------------------------------------------------------
// DOM: captions, cinema bars, skip hint, the picture cards (chapterStory.js
// injects the .cs-bars / .cs-title / .cs-skip styles when it is created)
// ---------------------------------------------------------------------------

let cssDone = false;
function injectCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.cs3-dark { position: fixed; inset: 0; background: #05070d; z-index: 8990; pointer-events: none; opacity: 1; }
.cs3-cap { position: fixed; left: 50%; bottom: calc(11vh + 18px); transform: translate(-50%, 8px); z-index: 9001;
  width: min(92vw, 760px); text-align: center; color: #fff; pointer-events: none; opacity: 0;
  font: 600 clamp(17px, 2.4vw, 24px)/1.35 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  text-shadow: 0 2px 14px rgba(0, 0, 0, .75); transition: opacity .6s, transform .6s; }
.cs3-cap.is-on { opacity: 1; transform: translate(-50%, 0); }
.cs3-card { position: fixed; left: 50%; top: 46%; width: min(72vw, 360px); z-index: 9000; border-radius: 18px;
  overflow: hidden; background: #fffdf7; color: #1d2433; box-shadow: 0 18px 50px rgba(0, 0, 0, .5); pointer-events: none; opacity: 0; }
.cs3-card svg { display: block; width: 100%; height: auto; }
.cs3-card__name { font: 700 clamp(14px, 2vw, 17px)/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif; padding: 12px 14px; text-align: center; }
@media (prefers-reduced-motion: reduce) { .cs3-cap { transition: none; } }`;
  document.head.appendChild(s);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A caption line. set(text) swaps it; set(null) hides it. */
function makeCaption() {
  const node = el('div', 'cs3-cap');
  let shown = null;
  return {
    node,
    set(text) {
      if (text === shown) return;
      shown = text;
      node.textContent = text || '';
      node.classList.toggle('is-on', !!text);
    },
  };
}

/** Hide the game's HUD and stop walking, as chapterStory's begin() does. */
function cinematicOn() {
  const body = document.body;
  const h = { prev: body.dataset.playModal, bars: el('div', 'cs-bars') };
  body.dataset.playModal = '1';
  body.classList.add('cs-cinematic');
  body.appendChild(h.bars);
  setTimeout(() => h.bars.classList.add('is-on'), 30);
  return h;
}
function cinematicOff(h) {
  const body = document.body;
  if (h.prev === undefined) delete body.dataset.playModal;
  else body.dataset.playModal = h.prev;
  body.classList.remove('cs-cinematic');
  h.bars.classList.remove('is-on');
  setTimeout(() => h.bars.remove(), 900);
}

/** Any key or click skips, but only after about a second (as in chapterStory). */
function skipListener(onSkip) {
  const fn = (e) => {
    e.stopPropagation();
    if (e.type === 'keydown') e.preventDefault();
    onSkip();
  };
  addEventListener('keydown', fn, true);
  addEventListener('pointerdown', fn, true);
  return () => {
    removeEventListener('keydown', fn, true);
    removeEventListener('pointerdown', fn, true);
  };
}

// The two pictures of the past. Simple painted flat art, not a screenshot.
const HOUSE = (x, y, roof) => `<rect x="${x - 22}" y="${y}" width="44" height="36" fill="#f6dcae" stroke="#1b2330" stroke-width="3"/>`
  + `<polygon points="${x - 31},${y + 2} ${x},${y - 30} ${x + 31},${y + 2}" fill="${roof}" stroke="#1b2330" stroke-width="3" stroke-linejoin="round"/>`
  + `<rect x="${x - 6}" y="${y + 16}" width="12" height="20" fill="#7a4f2e"/>`;
const VILLAGE_SVG = '<svg viewBox="0 0 300 190" aria-hidden="true"><rect width="300" height="190" fill="#bfe7ff"/>'
  + '<circle cx="246" cy="42" r="18" fill="#ffd36b"/><rect y="128" width="300" height="62" fill="#8cd16e"/>'
  + HOUSE(60, 96, '#d9674f') + HOUSE(140, 84, '#e0a24a') + HOUSE(220, 100, '#c9503f')
  + '<ellipse cx="108" cy="122" rx="6" ry="4" fill="#fff" opacity=".6"/></svg>';
const CITY_SVG = (() => {
  const blocks = [[28, 62, 52, 128, '#7d8fa8'], [88, 30, 56, 160, '#5f7394'], [152, 72, 46, 118, '#9aaec8'], [206, 44, 66, 146, '#6d84a6']];
  let s = '<svg viewBox="0 0 300 190" aria-hidden="true"><rect width="300" height="190" fill="#dfe9f5"/><rect y="168" width="300" height="22" fill="#9aa9b8"/>';
  for (const [x, y, w, h, c] of blocks) {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="#1b2330" stroke-width="3"/>`;
    for (let wy = y + 10; wy < y + h - 14; wy += 16) {
      for (let wx = x + 8; wx < x + w - 10; wx += 13) s += `<rect x="${wx}" y="${wy}" width="7" height="8" fill="#ffe9a8"/>`;
    }
  }
  return s + '</svg>';
})();

function makeCard(svg, name) {
  const card = el('div', 'cs3-card');
  card.innerHTML = svg;
  card.append(el('div', 'cs3-card__name', name));
  return card;
}

// ---------------------------------------------------------------------------
// The opening
// ---------------------------------------------------------------------------

// Every opening camera stays inside the map (x -34..34, z -52..62; village.js
// BOUNDS), so the edge of the world never shows. The road runs at roof height.
const REVEAL_A = [22, 26, 60];   // high over her side of the town, at the south edge
const REVEAL_B = [0, 11, 58];    // the same town, low, from the south end of the main road
const TOWN_LOOK = [0, 4, -14];   // the middle of the town, low, so the far edge is fogged
const ROAD_CTRL = [0, 10, 28];   // the sweep runs at roof height along the road
const ROAD_END = [3, 8, -6];     // on the road by the hub, level with the houses
const PAD_END = [8, 14, -14];    // back from the launch tower, so the whole tower fits with sky above
const TOWER_UP = 7;              // the look point: the middle of the launch tower

/**
 * Camera pose for one opening shot at progress u (0..1). Writes _P (position)
 * and _L (look). `pts.pad` is the launch tower's look point and `her` her chase
 * pose ({ p, l } arrays) for the last shot.
 */
const _P = [0, 0, 0];
const _L = [0, 0, 0];
const HER_CTRL = [5, 18, 16];    // the last move comes down to her at roof height, not from above
function openingPose(id, u, pts, her) {
  const k = smooth(u);
  switch (id) {
    case 'cards':
      lerp3(_P, REVEAL_A, REVEAL_A, 0);
      lerp3(_L, TOWN_LOOK, TOWN_LOOK, 0);
      break;
    case 'reveal':
      lerp3(_P, REVEAL_A, REVEAL_B, k);
      lerp3(_L, TOWN_LOOK, TOWN_LOOK, 0);
      break;
    case 'road':
      bez3(_P, REVEAL_B, ROAD_CTRL, ROAD_END, k);
      lerp3(_L, TOWN_LOOK, pts.pad, k);
      break;
    case 'pad':
      lerp3(_P, ROAD_END, PAD_END, k);
      lerp3(_L, pts.pad, pts.pad, 0);
      break;
    default: // 'her': round to her chase pose, looking at her
      bez3(_P, PAD_END, HER_CTRL, her.p, k);
      lerp3(_L, pts.pad, her.l, k);
  }
}

/**
 * The opening's camera for one shot, as plain arrays (for tests). `ground(x, z)`
 * is the terrain height and `her` her chase pose ({ p, l }).
 */
export function openingCamera(id, u, ground, her) {
  const pad = ROCKET_VILLAGE.rocketPad;
  openingPose(id, u, { pad: [pad.x, ground(pad.x, pad.z) + TOWER_UP, pad.z] }, her);
  return { p: [..._P], l: [..._L] };
}

/**
 * Labels, station markers, the nav arrow and pickup glows (and every Sprite)
 * move to a layer the camera does not draw, for the length of a film. Layers,
 * not `visible`: nameSigns.js and friends set `visible` every frame, which would
 * undo a hide. Returns what restoreWorldMarks() needs.
 */
const HIDDEN_LAYER = 31;
const WORLD_MARK_NAMES = new Set(['nameSigns', 'stations', 'navArrow', 'keyBlock', 'glow']);
function hideWorldMarks(scene) {
  const saved = new Map();
  const hide = (o) => o.traverse((c) => {
    if (saved.has(c)) return;
    saved.set(c, c.layers.mask);
    c.layers.set(HIDDEN_LAYER);
  });
  scene.traverse((o) => { if (o.isSprite || WORLD_MARK_NAMES.has(o.name)) hide(o); });
  return saved;
}
function restoreWorldMarks(saved) {
  for (const [c, mask] of saved) c.layers.mask = mask;
  saved.clear();
}

/** Picture card: slides in from the right, out to the left (a plain fade when reduced). */
function placeCard(c, t, inAt, outAt, showAt, hideAt, reduced, W) {
  let x = 0;
  let op;
  if (reduced) op = t >= showAt && t < hideAt ? 1 : 0;
  else {
    op = t >= inAt && t < outAt + 0.7 ? 1 : 0;
    if (t < inAt + 0.8) x = (1 - smooth((t - inAt) / 0.8)) * W;
    else if (t > outAt) x = -smooth((t - outAt) / 0.7) * W;
  }
  c.style.opacity = String(op);
  c.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px)`;
}

/**
 * The opening. Drive it from the game loop: `if (opening.update(dt)) ...`.
 * `ground(x, z)` is the terrain height; `chasePose()` returns { pos, look }
 * (Vectors) for where the chase camera wants to be.
 */
export function createOpening({ camera, scene, sun, ground, chasePose, getAvatar, chapter = 3, level, title, line }) {
  injectCss();
  const seenKey = `${SEEN_PREFIX}ch${chapter}_L${level}`;
  let run = null;

  return {
    /** Has this Level already seen the full opening? (Then story.intro gives the title card only.) */
    seen() { return storageGet(seenKey); },
    get active() { return !!run; },

    /** Start the full opening. Resolves when it ends or is skipped. */
    play() {
      return new Promise((resolve) => { run = start(resolve); });
    },

    /** Advance one frame. Returns true when this scene owns the camera. */
    update(dt) {
      if (!run) return false;
      run.step(dt);
      return true;
    },
  };

  function start(resolve) {
    const reduced = reducedMotion();
    const h = cinematicOn();
    const dark = el('div', 'cs3-dark');
    const cap = makeCaption();
    const cards = [
      makeCard(VILLAGE_SVG, 'Chapter 1 · Science Village'),
      makeCard(CITY_SVG, 'Chapter 2 · Forces and Machines'),
    ];
    const titleEl = el('div', 'cs-title');
    titleEl.append(el('div', 'cs-title__eyebrow', `Chapter ${chapter}`), el('div', 'cs-title__name', title), el('div', 'cs-title__line', line));
    const skipHint = el('div', 'cs-skip', 'Press any key to skip');
    document.body.append(dark, cap.node, ...cards, titleEl, skipHint);
    setTimeout(() => skipHint.classList.add('is-on'), 30);

    // The sky goes from sunrise to day; the sun from low and warm to white.
    const day = scene.background && scene.background.isColor ? scene.background.clone() : null;
    const fogDay = scene.fog ? scene.fog.color.clone() : null;
    const sunDay = sun.color.clone();
    const sunDayI = sun.intensity;
    const DAWN = new THREE.Color(0xf4a58a);
    const SUN_DAWN = new THREE.Color(0xffc38a);
    // The launch tower's look point, from the layout.
    const pad = ROCKET_VILLAGE.rocketPad;
    const pts = { pad: [pad.x, ground(pad.x, pad.z) + TOWER_UP, pad.z] };
    const hidden = hideWorldMarks(scene);
    // The fog closes in for the film, so the map's edges fade into the sunrise haze
    // instead of showing as a cliff over the sky (the game's own fog is 70 to 230).
    const fogRange = scene.fog ? [scene.fog.near, scene.fog.far] : null;
    if (scene.fog) { scene.fog.near = 40; scene.fog.far = 150; }
    // A flat green plain under the map for the film: past the map's edge there is ground
    // that fades into the haze, not the sky showing under a floating island.
    const plain = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshToonMaterial({ color: 0x6fae55, gradientMap: toonRamp }),
    );
    plain.name = 'filmPlain';
    plain.rotation.x = -Math.PI / 2;
    plain.position.y = -1.5;
    scene.add(plain);

    const st = { t: 0, skip: false, shot: -1, wave: false, her: { p: [0, 0, 0], l: [0, 0, 0] } };
    const loc = { index: 0, u: 0, ok: false };
    const stopSkip = skipListener(() => { if (st.t >= 1) st.skip = true; });

    const finish = () => {
      stopSkip();
      // Her chase view, exactly where the game takes over.
      const hp = chasePose();
      camera.position.copy(hp.pos);
      camera.lookAt(hp.look);
      if (day) scene.background.copy(day);
      if (fogDay) scene.fog.color.copy(fogDay);
      sun.color.copy(sunDay);
      sun.intensity = sunDayI;
      dark.remove();
      cap.set(null);
      titleEl.classList.remove('is-on');
      setTimeout(() => { titleEl.remove(); skipHint.remove(); cards.forEach((c) => c.remove()); cap.node.remove(); }, 900);
      restoreWorldMarks(hidden);
      if (fogRange) { scene.fog.near = fogRange[0]; scene.fog.far = fogRange[1]; }
      scene.remove(plain);
      plain.geometry.dispose();
      plain.material.dispose();
      cinematicOff(h);
      storageSet(seenKey);
      run = null;
      resolve();
    };

    return {
      step(dt) {
        st.t += dt;
        if (st.skip) { finish(); return; }
        locate(OPENING_SHOTS, st.t, loc);
        if (!loc.ok) { finish(); return; }
        const shot = OPENING_SHOTS[loc.index];
        const u = reduced ? 1 : loc.u;
        if (loc.index !== st.shot) {
          st.shot = loc.index;
          cap.set(captionText(shot.caption, level));
          if (shot.id === 'her') {
            // Her chase pose at the moment the shot starts (she does not move in the cutscene).
            const hp = chasePose();
            st.her.p = [hp.pos.x, hp.pos.y, hp.pos.z];
            st.her.l = [hp.look.x, hp.look.y, hp.look.z];
          }
        }

        // The two pictures of the past (cards 0 and 1), then the sunrise.
        const W = innerWidth * 0.7;
        placeCard(cards[0], st.t, 0, 2.0, 0.3, 2.3, reduced, W);
        placeCard(cards[1], st.t, 2.4, 4.0, 2.5, 4.1, reduced, W);
        dark.style.opacity = String(reduced ? (st.t < 4.2 ? 1 : 0) : 1 - smooth((st.t - 4.0) / 1.2));

        // Sunrise to day over the reveal and the road.
        const k = reduced ? (st.t > 13 ? 1 : 0) : smooth((st.t - 4) / 9);
        if (day) scene.background.copy(DAWN).lerp(day, k);
        if (fogDay) scene.fog.color.copy(DAWN).lerp(fogDay, k);
        sun.color.copy(SUN_DAWN).lerp(sunDay, k);
        sun.intensity = sunDayI * (0.72 + 0.28 * k);

        openingPose(shot.id, u, pts, st.her);
        camera.position.set(_P[0], _P[1], _P[2]);
        camera.lookAt(_L[0], _L[1], _L[2]);

        // Her shot: the wave and the title card run on real time through the shot (also when reduced).
        if (shot.id === 'her') {
          const within = loc.u * shot.dur;
          if (!st.wave && within > shot.dur - 2.2) { st.wave = true; getAvatar()?.play?.('wave', { hold: 2 }); }
          if (within > 1.6 && within < shot.dur - 0.9) titleEl.classList.add('is-on');
          else titleEl.classList.remove('is-on');
        }
      },
    };
  }
}

// ---------------------------------------------------------------------------
// The arrival in orbit
// ---------------------------------------------------------------------------

const EARTH_R = 180;             // stylised: the rocket is large against it, so it reads
const EARTH_C = [0, -EARTH_R, 0]; // Earth's centre; its top (the coast) is at y = 0
const STAGE_H = 26;              // the rocket's height in the orbit scene
const STAGE_BASE = 32;           // its bottom sits this high above Earth's top (clear of the limb)
const MOON_AT = [-30, 70, -300];
const MOON_R = 46;
const SUN_DIR = [-160, 120, 90];

const ORBIT_SKY = 0x05070f;

/** Seeded, so the stars and craters look the same every time. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Earth as an equirectangular map. The coast is on the +Z meridian (u = 0.25),
 * which the Earth's pivot turns to the top, under the rocket.
 */
function earthTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, 512);
  sea.addColorStop(0, '#2b6fb8'); sea.addColorStop(0.5, '#3a8fd6'); sea.addColorStop(1, '#2b6fb8');
  g.fillStyle = sea;
  g.fillRect(0, 0, 1024, 512);
  const shape = (pts, fill) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  // The coastal continent: sand shore, then green land. Its east edge meets the sea at the town.
  const coast = [[40, 160], [150, 140], [200, 168], [232, 200], [246, 236], [240, 262], [258, 300], [232, 336], [190, 352], [140, 332], [96, 300], [58, 248]];
  shape(coast.map(([x, y]) => [x + (x > 150 ? 6 : 0), y]), '#eadca2');
  shape(coast, '#7cc16b');
  shape([[80, 210], [150, 200], [180, 240], [150, 282], [100, 270]], '#5fa957');
  // Ranges and a second land far from the town.
  shape([[600, 150], [700, 130], [760, 180], [730, 240], [650, 250], [600, 210]], '#8fcf72');
  shape([[820, 320], [900, 300], [930, 340], [880, 380], [830, 362]], '#8fcf72');
  // The town: a few pale buildings on the shore, by the bay.
  g.fillStyle = '#fff8e8';
  for (const [x, y] of [[226, 246], [234, 252], [222, 256], [236, 264], [228, 270]]) g.fillRect(x, y, 4, 4);
  // A few clouds, away from the coast so it stays clear.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, r] of [[470, 150, 26], [500, 146, 18], [700, 380, 22], [930, 180, 16]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The Moon: pale grey with darker craters. */
function moonTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ccd4';
  g.fillRect(0, 0, 512, 256);
  const r = rng(11);
  for (let i = 0; i < 70; i++) {
    const x = r() * 512, y = r() * 256, rad = 3 + r() * 16;
    g.fillStyle = '#a7acb7';
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d6d9e0';
    g.beginPath(); g.arc(x + rad * 0.2, y + rad * 0.25, rad * 0.8, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The orbit scene: Earth, the Moon, stars, and a copy of the rocket. Built on
 * the first play, so creating the arrival costs nothing. Its objects are listed
 * in `owned` and disposed on stop(); the rocket's own geometry and materials
 * are shared with the clone and are NOT disposed here.
 */
function buildOrbit(rocket, owned) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ORBIT_SKY);
  const cam = new THREE.PerspectiveCamera(52, 1, 0.5, 4000);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a2636, 0.9));
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.2);
  sun.position.set(...SUN_DIR);
  scene.add(sun);

  // Earth. The pivot turns the map so the coast (on the +Z meridian) faces up.
  const earthMap = earthTexture();
  const earthGeo = new THREE.SphereGeometry(EARTH_R, 128, 80);
  const earthMat = new THREE.MeshToonMaterial({ map: earthMap, gradientMap: toonRamp });
  owned.push(earthMap, earthGeo, earthMat);
  const pivot = new THREE.Group();
  pivot.rotation.x = -Math.PI / 2;
  pivot.position.set(...EARTH_C);
  pivot.add(new THREE.Mesh(earthGeo, earthMat));
  scene.add(pivot);

  // The air's glow: a slightly larger back-faced shell, so it shows only at the limb.
  const airGeo = new THREE.SphereGeometry(EARTH_R * 1.04, 128, 80);
  const airMat = new THREE.MeshBasicMaterial({
    color: 0x7fd0ff, transparent: true, opacity: 0.2, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  owned.push(airGeo, airMat);
  const air = new THREE.Mesh(airGeo, airMat);
  air.position.set(...EARTH_C);
  scene.add(air);

  // The Moon, ahead.
  const moonMap = moonTexture();
  const moonGeo = new THREE.SphereGeometry(MOON_R, 64, 48);
  const moonMat = new THREE.MeshToonMaterial({ map: moonMap, gradientMap: toonRamp });
  owned.push(moonMap, moonGeo, moonMat);
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(...MOON_AT);
  scene.add(moon);

  // Stars: one Points object, far off.
  const r = rng(7);
  const starPos = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const th = r() * Math.PI * 2;
    const y = r() * 2 - 1;
    const rad = Math.sqrt(1 - y * y) * 1500;
    starPos[i * 3] = Math.cos(th) * rad;
    starPos[i * 3 + 1] = y * 1500;
    starPos[i * 3 + 2] = Math.sin(th) * rad;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false });
  owned.push(starGeo, starMat);
  scene.add(new THREE.Points(starGeo, starMat));

  // The rocket in space: the flying stages (not the pad), copied and scaled to STAGE_H.
  // The clones share the rocket's geometry and materials, so they are not disposed here.
  const holder = new THREE.Group();
  for (const [id, stage] of rocket.stages) {
    if (id === 'foundation') continue; // the pad stays behind
    holder.add(stage.group.clone(true));
  }
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const s = size.y > 1e-6 ? STAGE_H / size.y : 1; // an empty rocket still gets an orbit, just no stages
  holder.scale.setScalar(s);
  holder.position.set(-mid.x * s, STAGE_BASE - box.min.y * s, -mid.z * s);
  scene.add(holder);

  return { scene, cam, sun };
}

const _ap = [0, 0, 0];
const _al = [0, 0, 0];
/** Camera pose for one arrival shot (writes _ap, _al). */
function arrivalPose(id, u) {
  const k = smooth(u);
  const S = [0, STAGE_BASE + STAGE_H / 2, 0];
  if (id === 'stage') {
    const a = 0.75 + (0.45 - 0.75) * k;
    _ap[0] = Math.sin(a) * 78; _ap[1] = S[1] + 10; _ap[2] = Math.cos(a) * 78;
    lerp3(_al, S, S, 0);
  } else if (id === 'earth') {
    lerp3(_ap, [Math.sin(0.45) * 78, S[1] + 10, Math.cos(0.45) * 78], [0, 84, 170], k);
    lerp3(_al, S, [0, -40, 0], k);
  } else {
    lerp3(_ap, [0, 84, 170], [0, S[1] + 6, 58], k);
    lerp3(_al, [0, -40, 0], MOON_AT, k);
  }
  return _ap;
}

/** The arrival's camera at progress u of one shot, as plain arrays (for tests and the game). */
export function arrivalCamera(id, u) {
  arrivalPose(id, u);
  return { p: [..._ap], l: [..._al] };
}

/**
 * The arrival in orbit. `play()` runs the shots and resolves when they end (the
 * cinema bars come down then, ready for the Chapter 3 card). `render(dt)` keeps
 * the orbit on screen after that, holding on the Moon, until `stop()`.
 * Drive it from the game loop: `if (!arrival.render(dt)) renderer.render(...)`.
 */
export function createArrival({ renderer, rocket, level, chapter = 3 }) {
  injectCss();
  const seenKey = `${SEEN_PREFIX}ch${chapter}_L${level}_orbit`;
  const owned = [];
  let orb = null;
  let playing = null; // { resolve, h, cap, stopSkip, t, shot, skip, reduced }
  let t = 0;
  const total = totalSeconds(ARRIVAL_SHOTS);
  const loc = { index: 0, u: 0, ok: false };

  return {
    seen() { return storageGet(seenKey); },
    get active() { return !!orb; },

    play() {
      return new Promise((resolve) => {
        if (!orb) orb = buildOrbit(rocket, owned);
        const reduced = reducedMotion();
        const h = cinematicOn();
        const cap = makeCaption();
        const skipHint = el('div', 'cs-skip', 'Press any key to skip');
        document.body.append(cap.node, skipHint);
        setTimeout(() => skipHint.classList.add('is-on'), 30);
        const st = { resolve, h, cap, skipHint, shot: -1, skip: false, reduced, stopSkip: null };
        st.stopSkip = skipListener(() => { if (t >= 1) st.skip = true; });
        playing = st;
        t = 0;
      });
    },

    /** Draw one frame of the orbit. Returns false if there is nothing to draw. */
    render(dt) {
      if (!orb) return false;
      const { scene, cam } = orb;
      const aspect = renderer.domElement.width / Math.max(1, renderer.domElement.height);
      if (cam.aspect !== aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
      t += dt;
      if (playing) {
        if (playing.skip) t = Math.max(t, total);
        locate(ARRIVAL_SHOTS, t, loc);
        if (loc.ok) {
          const shot = ARRIVAL_SHOTS[loc.index];
          if (loc.index !== playing.shot) {
            playing.shot = loc.index;
            playing.cap.set(captionText(shot.caption, level));
          }
          arrivalPose(shot.id, playing.reduced ? 1 : loc.u);
          cam.position.set(_ap[0], _ap[1], _ap[2]);
          cam.lookAt(_al[0], _al[1], _al[2]);
        } else {
          // Shots are done: let go of the screen (the Chapter card takes it next) and hold.
          const p = playing;
          playing = null;
          p.stopSkip();
          p.cap.node.remove();
          p.skipHint.remove();
          cinematicOff(p.h);
          storageSet(seenKey);
          p.resolve();
        }
      }
      if (!playing) {
        // The hold: a slow dolly behind the rocket, looking at the Moon.
        const hold = Math.max(0, t - total);
        cam.position.set(0, 36 + Math.sin(t * 0.2) * 0.6, 58 - hold * 0.35);
        cam.lookAt(MOON_AT[0], MOON_AT[1], MOON_AT[2]);
      }
      renderer.render(scene, cam);
      return true;
    },

    /** Free the orbit scene. The main game draws again after this. */
    stop() {
      if (playing) {
        playing.stopSkip();
        playing.cap.node.remove();
        playing.skipHint.remove();
        cinematicOff(playing.h);
        playing = null;
      }
      for (const o of owned.splice(0)) o.dispose();
      orb = null;
    },
  };
}
