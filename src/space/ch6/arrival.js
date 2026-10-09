// Chapter 6's arrival in the asteroid belt (~28 s, skippable, the first time
// only per Level). Chapter 6 opens back in the belt (start.js), and the first
// step used to go straight into dialogue. Now the shot comes first: her small
// ship flies in among a few belt rocks, the Sun small and bright far away and
// Ceres in the distance. The camera finds Rock B (the engine step's rock,
// buildRockShip from ch5/ending.js, the same look as opening.js's showRockB),
// and a caption sets up the chapter: everything a starship needs is here.
// Then the first dialogue (partBuild.js) carries on.
//
// Scene. The flight scene's floating origin is her ship, so the Sun and the
// bodies stay where they are (the Sun is the real one, about 2 degrees across
// from here). Everything we add is laid out in one frame from her heading:
// forward (f), up (u) and right (r), in scene units. Her ship ends at the
// origin heading forward, so the hand-back to the chase view is one blend, not
// a cut, and Rock B sits off to her right, clear of the chase camera. The far
// belt (6000 instanced rocks and the near ones) is hidden for the shot, as
// there is no clutter in this scene; it is put back afterwards.
//
// Same cutscene contract as Chapter 6's opening (opening.js) and drive-on
// (driveOn.js): flight paused, controls off, body.in-cinematic, game.cinematic
// with calm, everything added is disposed, skip after 1.5 s. Reduced motion
// gets a slower camera and no flying in (she is already at the origin).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { buildRockShip } from '../ch5/ending.js';
import { ROCK_B_R } from './opening.js';
import { BELT } from '../contracts.js';
import { t as lvl, LEVEL } from '../level.js';

export const ARRIVAL_DURATION = 28;
const SKIP_AFTER_MS = 1500;
// ROCK_B_R (Rock B's radius in scene units, smaller than Ceres' 7) is shared with the flight scene.
const ROCK_B_AT = [6, 0, -22]; // (f, u, r): off to her right, ahead of the nose
const CERES_R = 7; // Ceres's radius in scene units (contracts.js)
const UP = new THREE.Vector3(0, 1, 0);

// The small belt rocks, in (f, u, r): few and readable, each smaller than Rock B.
const ROCKS = [
  { at: [-34, 6, -18], r: 2.4, kind: 'stony' },
  { at: [-52, -8, 26], r: 3.1, kind: 'metal' },
  { at: [-18, -4, 40], r: 1.2, kind: 'icy' },
  { at: [22, 9, 34], r: 1.6, kind: 'stony' },
  { at: [36, -6, -34], r: 2.8, kind: 'icy' },
  { at: [-70, 14, -10], r: 1.0, kind: 'metal' },
];
// Her ship's flight in, (f, u, r), ending at the origin (her chase position).
const SHIP_PATH = [[-44, 10, 46], [-26, 5, 18], [-10, 2, 4], [0, 0, 0]];
const SHIP_FLY_UNTIL = 19.5; // she has arrived by then, and holds still after
const SHIP_START = 0.5; // she waits half a second, then goes
// Ceres: in the distance, near the Sun's direction (set in playCh6Arrival from the Sun's bearing).
const CERES_DIST = 800;

// The camera, in (f, u, r): position and look, at each time. Catmull-Rom between.
// At 14 s Rock B is about a third of the frame and her ship (at the origin) is in the
// same shot; at 19 s both still are. The stage shrinks away over the hand-back, so
// nothing pops out of the frame when the chase view takes over.
const CAM_POS = [[0, [-64, 24, 70]], [7, [-30, 16, 36]], [14, [-14, 12, -40]], [19, [-22, 12, -6]], [ARRIVAL_DURATION, [-7, 3, 1]]];
const CAM_LOOK = [[0, [-14, 0, 14]], [7, [-4, 0, 6]], [14, ROCK_B_AT], [19, [2, 0, -8]], [ARRIVAL_DURATION, [0, 0, 0]]];

// Captions, [Level 4, Level 1]: each on screen for its window (seconds). A window is
// the reading time of its longer (Level 4) text (5-10 s, readMs) plus the fade in.
export const ARRIVAL_CAPTIONS = [
  { from: 3.5, to: 11, text: ['The Sun is small and far away. Ceres, a dwarf planet, is out here too.', 'The Sun is far away. Ceres is out here too.'] },
  { from: 11.2, to: 20.7, text: ['Everything we need for a starship is here: ice for water and fuel, metal for the ship, rock for a shield.', 'Here we have all we need for a ship. Ice for water and fuel. Metal for the ship. Rock for a shield.'] },
];
export const ARRIVAL_TITLE = { eyebrow: ['Chapter 6 · The Long Trip', 'Chapter 6 · The Long Trip'], title: ['Back in the belt', 'Back in the belt'], sub: ['Rock, ice and metal all around', 'Rock, ice and metal!'] };

// The first-time flag, per Level (the same prefix as the chapters' seen flags, launcher/profile.js).
export const arrivalSeenKey = (level = LEVEL) => `rocket_village_seen_ch6_arrival_L${level}`;

/** True if this Level has seen the arrival (a reload into the first step does not replay it). */
export function arrivalSeen() {
  try { return localStorage.getItem(arrivalSeenKey()) === '1'; } catch { return true; }
}
function markArrivalSeen() {
  try { localStorage.setItem(arrivalSeenKey(), '1'); } catch { /* private mode */ }
}

// A caption box (lower third, above the letterbox bar), styled like cinematics.js.
const CAPTION_CSS = `
.c6a-cap { position: fixed; left: 50%; bottom: 14vh; transform: translateX(-50%); width: min(80vw, 880px); z-index: 41;
  text-align: center; color: #fff7ea; font: 600 clamp(16px, 1.8vw, 25px)/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  text-shadow: 0 2px 16px rgba(0,0,0,.8); opacity: 0; transition: opacity 700ms ease; pointer-events: none; }
.c6a-cap.is-on { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .c6a-cap { transition: none; } }
`;

/**
 * A lumpy stone of the given radius (scene units), smooth-shaded like Rock B. `glow` lifts
 * its dark side a little: Ceres sits with the Sun behind it from where we look, so without it
 * it is a black disc.
 */
function makeRock(radius, seed, colour, squash = 0.8, glow = 0x000000) {
  const ico = new THREE.IcosahedronGeometry(1, 4);
  ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
  const geo = mergeVertices(ico);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.16 * Math.sin(v.x * 4.1 + seed) + 0.1 * Math.sin(v.y * 6.3 - seed * 1.7) + 0.06 * Math.sin(v.z * 9.7 + v.x * 3 + seed * 0.3);
    v.multiplyScalar(radius * n);
    v.y *= squash;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 1, metalness: 0, emissive: glow }));
}

/** Points on a polyline at parameter u (0..1), by length. */
function pathAt(points, u, out) {
  const segs = points.length - 1;
  const d = Math.min(1, Math.max(0, u)) * segs;
  const i = Math.min(segs - 1, Math.floor(d));
  return out.lerpVectors(points[i], points[i + 1], d - i);
}

/** A smooth curve through keyed [t, [f, u, r]] values, into out (a world-space Vector3 in the frame). */
function keyed(keys, tt, toWorld, out) {
  let i = 0;
  while (i < keys.length - 2 && tt > keys[i + 1][0]) i++;
  const [t1, v1] = keys[i]; const [t2, v2] = keys[i + 1];
  const v0 = keys[Math.max(0, i - 1)][1]; const v3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const u = Math.min(1, Math.max(0, (tt - t1) / (t2 - t1)));
  const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
  return toWorld(out.set(c(v0[0], v1[0], v2[0], v3[0]), c(v0[1], v1[1], v2[1], v3[1]), c(v0[2], v1[2], v2[2], v3[2])));
}

/**
 * The arrival shot, then the first dialogue's cue. Resolves when she has control.
 * @param {object} game the space game (scene, ship, shipView, controls, belt, paused, cinematic)
 * @returns {Promise<void>}
 */
export function playCh6Arrival(game) {
  const { scene, shipView } = game;
  markArrivalSeen(); // before the shot: a reload during it does not replay it
  const overlay = buildOverlay({ ...titleFor(), startBlack: false });
  const style = document.createElement('style');
  style.textContent = CAPTION_CSS;
  document.head.appendChild(style);
  const cap = document.createElement('div');
  cap.className = 'c6a-cap';
  document.body.appendChild(cap);

  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timeScale = still ? 0.5 : 1; // reduced motion: the camera moves at half speed

  // The stage frame, from her heading (the nose; see opening.js for the same maths).
  const a = game.ship?.angle ?? 0;
  const F = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const R = new THREE.Vector3().crossVectors(F, UP);
  const stageAt = (p, out = new THREE.Vector3()) => out.copy(F).multiplyScalar(p[0]).addScaledVector(UP, p[1]).addScaledVector(R, p[2]);
  // The Sun's bearing from her: the scene's origin is her ship, so the Sun is at -ship.x, -ship.z.
  const S = new THREE.Vector3(-(game.ship?.x ?? 1), 0, -(game.ship?.z ?? 0));
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();

  // The stage: everything we add lives under one group, disposed after.
  const stage = new THREE.Group();
  stage.name = 'ch6-arrival';
  scene.add(stage);
  const disposables = [];
  const beltWas = game.belt?.group?.visible;
  if (game.belt?.group) game.belt.group.visible = false;

  // Rock B: the engine step's rock (its hangar door faces her), scaled to ROCK_B_R.
  const rockB = buildRockShip();
  const rockBPos = stageAt(ROCK_B_AT);
  rockB.group.scale.setScalar(ROCK_B_R / 36); // buildRockShip's rock is about 36 units across
  rockB.group.position.copy(rockBPos);
  rockB.group.lookAt(rockBPos.clone().multiplyScalar(2)); // -Z (the hangar) towards her
  rockB.setRings(0);
  stage.add(rockB.group);
  const shrinkers = [{ obj: rockB.group, base: rockB.group.scale.clone() }];
  disposables.push(() => rockB.dispose());

  // The small rocks, one colour per kind (BELT.kinds), and Ceres in the distance.
  const spin = [];
  ROCKS.forEach((r, i) => {
    const mesh = makeRock(r.r, i * 1.7 + 0.4, BELT.kinds[r.kind].color);
    mesh.position.copy(stageAt(r.at));
    stage.add(mesh);
    shrinkers.push({ obj: mesh, base: mesh.scale.clone() });
    spin.push({ mesh, rate: i % 2 ? 0.08 : -0.06 });
    disposables.push(() => { mesh.geometry.dispose(); mesh.material.dispose(); });
  });
  const ceres = makeRock(CERES_R, 2.6, 0xcfc7ba, 0.92, 0x3d372e);
  // Off to one side of the Sun's line, so the Sun lights its face towards us (a crescent, not a black disc).
  ceres.position.copy(S).multiplyScalar(CERES_DIST).addScaledVector(R, -380).addScaledVector(UP, 40);
  stage.add(ceres);
  shrinkers.push({ obj: ceres, base: ceres.scale.clone() });
  disposables.push(() => { ceres.geometry.dispose(); ceres.material.dispose(); });

  // Her ship: the same model she flies, moved through the stage; restored after.
  const shipGroup = shipView.group;
  const shipWas = shipGroup.position.clone();
  shipGroup.visible = true;
  const path = SHIP_PATH.map((p) => stageAt(p));
  const shipPos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const head = new THREE.Vector3();

  const overlayTimers = [];
  overlayTimers.push(setTimeout(() => overlay.bars(true), 250));

  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(SKIP_AFTER_MS, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, ARRIVAL_DURATION - 3); });

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const lookDir = new THREE.Vector3();
  const toWorld = (v) => stageAt([v.x, v.y, v.z], v);
  let cap0 = -1;
  let titled = false;
  let untitled = false;
  let waved = false;

  game.cinematic = {
    calm: true,
    hideMarkers: true,
    hidePath: true,
    get t() { return t; },
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;

      // Her ship: flies in along the path from SHIP_START, slowing at the end, with the
      // nose on her direction of travel and then forward. Still: she is simply there.
      const u = still ? 1 : ease((t - SHIP_START) / (SHIP_FLY_UNTIL - SHIP_START));
      pathAt(path, u, shipPos);
      shipGroup.position.copy(shipPos);
      pathAt(path, Math.min(1, u + 0.02), tan).sub(shipPos);
      head.copy(tan).normalize().lerp(F, ease(u));
      shipGroup.rotation.y = Math.atan2(-head.x, -head.z); // yawFor(): nose (-Z) along head
      shipView.setThrottle(!still && t < SHIP_FLY_UNTIL ? 0.35 : 0);
      if (!waved && t > 15 && !still) { waved = true; shipView.girlWave(1); }

      // The small rocks tumble a little (Rock B keeps its hangar towards her).
      if (!still) {
        for (const s of spin) s.mesh.rotation.y += dt * s.rate;
      }
      ceres.rotation.y += dt * 0.05;

      // Camera: one continuous move, eased in from her chase view at the start and
      // back to it at the end. The look starts on the Sun and turns to the rock.
      const tc = t * timeScale;
      keyed(CAM_POS, tc, toWorld, camPos);
      keyed(CAM_LOOK, tc, toWorld, camLook);
      const wSun = 0.85 * (1 - ease(t / 6)); // the Sun is in the first shot (near the middle), then the look turns to the rock
      lookDir.subVectors(camLook, camPos).normalize().lerp(S, wSun).normalize();
      camLook.copy(camPos).addScaledVector(lookDir, 100);
      const wIn = ease(t / 2);
      const wOut = 1 - ease((t - (ARRIVAL_DURATION - 3)) / 3);
      blendCamera(camera, camPos, camLook, Math.min(wIn, wOut));
      const gone = 1 - ease((t - (ARRIVAL_DURATION - 3.5)) / 3);
      if (gone < 1) for (const s of shrinkers) s.obj.scale.copy(s.base).multiplyScalar(Math.max(gone, 0.001));

      // Title and captions.
      if (t > 1.0 && !titled) { titled = true; overlay.showTitle(); }
      if (t > 1.0 + overlay.readS && !untitled) { untitled = true; overlay.hideTitle(); }
      const k = ARRIVAL_CAPTIONS.findIndex((c) => t >= c.from && t < c.to);
      if (k !== cap0) {
        cap0 = k;
        if (k < 0) cap.classList.remove('is-on');
        else { cap.textContent = lvl(...ARRIVAL_CAPTIONS[k].text); cap.classList.add('is-on'); }
      }

      if (t >= ARRIVAL_DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    skip.dispose();
    for (const id of overlayTimers) clearTimeout(id);
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    cap.remove();
    style.remove();
    scene.remove(stage);
    for (const d of disposables) d();
    shipGroup.position.copy(shipWas);
    shipView.setThrottle(0);
    if (game.belt?.group) game.belt.group.visible = beltWas;
    game.controls.setEnabled(true);
    game.paused = false;
  });
}

/** The title card's words for this Level. */
function titleFor() {
  return { eyebrow: lvl(...ARRIVAL_TITLE.eyebrow), title: lvl(...ARRIVAL_TITLE.title), sub: lvl(...ARRIVAL_TITLE.sub) };
}
