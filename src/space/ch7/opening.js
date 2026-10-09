// Chapter 7's opening (about 36 s, skippable after 1.5 s): the drive goes to full
// power and the ship leaves the Sun behind for Tau Ceti.
//
// Lead 2026-10-08: "the ship's high speed has increased and the ship is leaving
// the solar system, then the next target: Tau Ceti, the star system for future
// exploration of alien species". Two parts:
//   1. Flight (0-16.5 s): the starship (ch6/starship.js) fires its fusion drive
//      at full power, plume on, and the camera watches from in front of her,
//      looking back. The Sun is behind the ship, a bright ball with a glow, and
//      it shrinks to a bright star as she pulls away. The speed dial climbs
//      from 10% of light speed past 20%, in a steady rapidity climb (voyage.js).
//   2. The star map (18 s on, after a fade): the camera pulls back from the Sun
//      to the five neighbours (starMap.js), Tau Ceti ringed as the target, and a
//      caption: a Sun-like star that may have planets, where one day we might
//      look for life. Nobody knows yet. The caption is long, so it stays up for
//      its reading time and then the film waits for a click on Continue (lead
//      2026-10-09: kids need time to read; a grown-up's Skip still skips).
//
// Same cutscene contract as Chapter 6's (ch6/opening.js and ch6/driveOn.js):
// flight paused, own objects and lights, `game.cinematic` with calm, the camera
// blended in from her flight camera and out again at the end. Few particles, on
// purpose: the calm is the point. The drive is pretend (no drive we can build
// today could do this). The flight ship is put back beside her at the end.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease, CARD_FADE_S } from '../cinematics.js';
import { createStarship, FLIGHT_LENGTH } from '../ch6/starship.js';
import { showStarship } from '../ch6/opening.js';
import { readMs } from '../../play/readTime.js';
import { t as lvl } from '../level.js';
import { CRUISE_START, OPENING_TO, dialSpeed, percentOf } from './voyage.js';
import { buildStarMap3D, STAR_MAP_CAPTION } from './starMap.js';

const T_CUT = 16.5; // the Sun has shrunk to a star: the picture fades
const T_SWITCH = 17.9; // the screen is black: the flight scene goes, the map comes
const T_MAP = 18; // the map fades in
const CAPTION_AT = 24; // all five stars are in (the reveal ends at 24 s): the caption comes
// The caption fades in over CARD_FADE_S, then stays up for its reading time (readMs; this one
// is long, so 10 s). Then the film waits at the star map for her Continue. After Continue, a 2 s fade to the end.
const T_HOLD = CAPTION_AT + readMs(STAR_MAP_CAPTION) / 1000 + CARD_FADE_S;
const DURATION = T_HOLD + 2;
const SUN_R = 260; // the Sun's radius at the start, scene units
const SUN_D0 = 2000; // how far behind she starts (the Sun shrinks as this grows)
const SUN_GROW = 14; // the Sun is 15 times further by the cut: a bright star
const GLOW = 420; // the Sun's glow sprite, scene units (constant: it reads as a star far away)

// The camera, in the flight scene (ship at the origin, flying towards -Z, the Sun at +Z):
// in front of her and to one side, looking back at her and the Sun behind her, so the
// plume shows as a flame behind the ship. It pulls back a little as she goes.
// Lead review 2026-10-09: the hull hid the plume from in front (at 3 s the
// plume was behind the cap), so the camera is to one side, so the flame shows.
const CAM_A = [[70, 10, -40], [110, 30, -60]];
const LOOK_A = [0, 0, 60];

// The star map: the camera's target and its offset direction (from above the plane).
const MAP_TARGET = new THREE.Vector3(4.3, 0, -2.3);
const MAP_DIR = new THREE.Vector3(-0.3, 0.85, 0.45).normalize();
const MAP_NEAR = 9; // ly from the target at the start (the Sun and the near stars)
const MAP_FAR = 32; // ly at the end (all five, with room round them)

/** The speed dial: a small fixed box, percent of light speed (the same look as Chapter 6's). */
export function buildDial() {
  const box = document.createElement('div');
  box.className = 'c7-dial';
  box.style.cssText = 'position:fixed;right:28px;bottom:120px;z-index:60;min-width:190px;padding:12px 16px;border-radius:16px;'
    + 'background:rgba(10,16,32,.78);border:2px solid #9fe8a8;color:#fff;font:800 15px system-ui,sans-serif;text-align:center;'
    + 'transition:opacity .6s;opacity:0;pointer-events:none';
  const big = document.createElement('div');
  big.style.cssText = 'font-size:30px;line-height:1.1';
  const unit = document.createElement('div');
  unit.style.cssText = 'font-size:13px;color:#cfe8ff';
  unit.textContent = lvl('of light speed', 'of light speed');
  box.append(big, unit);
  document.body.appendChild(box);
  return {
    show(v) { box.style.opacity = v ? '1' : '0'; },
    /** Speed as a fraction of light speed (0.1 = 10%). */
    set(v) { big.textContent = `${percentOf(v).toFixed(1)}%`; },
    remove() { box.remove(); },
  };
}

/** The Continue button, in the foot of the letterbox bar: the star map waits for it. */
export function buildContinue(onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'c7-continue';
  btn.style.cssText = 'position:fixed;left:50%;bottom:2.4vh;transform:translateX(-50%);z-index:50;cursor:pointer;'
    + 'padding:8px 24px;border-radius:999px;border:2px solid #9fe8a8;background:rgba(10,16,32,.85);color:#fff;'
    + 'font:800 clamp(15px,1.5vw,20px) system-ui,sans-serif;display:none';
  btn.textContent = lvl('Continue', 'Go on!');
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
  return {
    show(v) { btn.style.display = v ? '' : 'none'; },
    remove() { btn.remove(); },
  };
}

/** A caption along the bottom, above the letterbox bar; show(text) fades it in. */
export function buildCaption() {
  const box = document.createElement('div');
  box.className = 'c7-caption';
  box.style.cssText = 'position:fixed;left:50%;bottom:calc(11vh + 18px);transform:translateX(-50%);z-index:45;'
    + 'width:min(760px,88vw);text-align:center;color:#fff7ea;font:600 clamp(15px,1.5vw,20px)/1.4 system-ui,sans-serif;'
    + 'text-shadow:0 2px 14px rgba(0,0,0,.85);opacity:0;transition:opacity 1s ease;pointer-events:none';
  document.body.appendChild(box);
  return {
    show(text) { box.textContent = text; box.style.opacity = '1'; },
    hide() { box.style.opacity = '0'; },
    remove() { box.remove(); },
  };
}

/** The Sun as a ball with a soft glow and its own light (the same look as Chapter 6's close-up Sun). */
function buildSunBall() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 40, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa84a) }));
  g.add(ball);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)'); grad.addColorStop(0.25, 'rgba(255,200,120,0.7)'); grad.addColorStop(0.6, 'rgba(255,150,60,0.18)'); grad.addColorStop(1, 'rgba(255,140,40,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(GLOW);
  g.add(glow);
  const light = new THREE.PointLight(0xfff1dc, 2.2, 0, 0);
  g.add(light);
  return {
    group: g, light, ball, glow,
    /** Put the Sun at distance d behind her: its ball's apparent size falls as 1/d (its light as 1/d^2, so the glow sprite keeps a fixed size). */
    place(d) {
      g.position.set(0, 0, d);
      ball.scale.setScalar((SUN_D0) / d);
    },
    dispose() {
      g.traverse((o) => { o.material?.dispose?.(); o.geometry?.dispose?.(); });
      tex.dispose();
    },
  };
}

/** Far stars for the flight: fixed, small and dim. */
function buildBackdrop() {
  const N = 200;
  const pos = new Float32Array(N * 3);
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const z = 2 * rnd() - 1; const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - z * z); const r = 3000 + rnd() * 1500;
    pos.set([r * s * Math.cos(a), r * z, r * s * Math.sin(a)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: new THREE.Color(0xdfe8ff).multiplyScalar(0.9), size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  return { pts, dispose() { geo.dispose(); mat.dispose(); } };
}

/**
 * The cutscene. Resolves when it ends (the flight scene is back).
 * Test hook while it runs: window.__ch7Opening.t (seconds in); removed at the end.
 * @param {object} game the space game (scene, shipView, controls, cinematic)
 * @returns {Promise<void>}
 */
export function playCh7Opening(game) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({
    eyebrow: lvl('Chapter 7 · Part A', 'Chapter 7'),
    title: lvl('Full power!', 'Full power!'),
    sub: lvl('Leaving the Sun behind, toward Tau Ceti', 'Bye bye, Sun!'),
    startBlack: true,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;
  game._starship?.remove(); // the cutscene's own ship; the flight one comes back at the end
  const shipQuat = shipView.group.quaternion.clone();
  shipView.group.visible = false;

  // Phase 1 objects: the starship, the Sun, the backdrop, the lights.
  const ship = createStarship({ detail: 'near' });
  ship.group.scale.setScalar(FLIGHT_LENGTH / ship.dims.length);
  ship.setRingSpin(0.3);
  ship.setField(0.6);
  ship.setLights(true);
  ship.setDrive(0);
  scene.add(ship.group);
  const sun = buildSunBall();
  scene.add(sun.group);
  const back = buildBackdrop();
  scene.add(back.pts);
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.5); // lifted: the first frames read dark (critic: mean 0.08-0.11)
  scene.add(fill);
  const dial = buildDial();
  const caption = buildCaption();
  let go = false; // she has read the caption and clicked Continue (or skipped): the film may end
  const cont = buildContinue(() => { go = true; cont.show(false); });

  // Phase 2 objects, built at the switch: the 3-D star map.
  let map = null;

  let t = 0;
  // Test hook while the cutscene runs (removed at the end): window.__ch7Opening.t, seconds in.
  const hook = { get t() { return t; } };
  window.__ch7Opening = hook;
  let switched = false;
  let darkened = false;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { go = true; cont.show(false); t = Math.max(t, DURATION - 2.5); });
  setTimeout(() => { overlay.light(); overlay.bars(true); }, 300);
  const camPos = new THREE.Vector3(); const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const switchToMap = () => {
    switched = true;
    scene.remove(ship.group, sun.group, back.pts, fill);
    ship.dispose(); sun.dispose(); back.dispose();
    dial.show(false);
    map = buildStarMap3D();
    scene.add(map.group);
    const sunFill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.3);
    scene.add(sunFill);
    map.sunFill = sunFill;
  };

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    get t() { return t; }, // tests: seconds into the scene
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      // The star map holds at the end of the caption's reading time until she clicks Continue.
      if (!go && t >= T_HOLD) { t = T_HOLD; dt = 0; cont.show(true); }
      t += dt;
      shipView.group.visible = false;

      if (t < T_SWITCH) {
        // Phase 1: the flight. The drive lights up over the first second and a half.
        if (t >= T_CUT && !darkened) { darkened = true; overlay.darken(); dial.show(false); caption.hide(); }
        const k = Math.min(1, t / T_CUT);
        ship.setDrive(ease(t / 1.5));
        ship.setField(0.6 + 0.2 * ease(t / 3));
        ship.update(dt, t);
        // The Sun recedes as she speeds up, and shrinks to a bright star.
        const s2 = k * k;
        sun.place(SUN_D0 * (1 + SUN_GROW * s2));
        sun.light.intensity = 2.2 * (1 - 0.6 * k);
        // The camera: in front of her, looking back; it draws back a little.
        camPos.set(...CAM_A[0]).lerp(tmp.set(...CAM_A[1]), ease(k));
        look.set(...LOOK_A);
        blendCamera(camera, camPos, look, ease(t / 1.5));
        // The dial: a steady climb in rapidity from 10% past 20%.
        dial.show(t > 0.4 && t < T_CUT + 0.5);
        dial.set(dialSpeed(CRUISE_START, OPENING_TO, k));
        if (t > 1.2 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
        if (t > 1.2 + overlay.readS && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      } else {
        // Phase 2: the star map, after the fade.
        if (!switched) switchToMap();
        if (t >= T_MAP && !overlay._lit) { overlay._lit = true; overlay.light(); }
        const m = Math.min(1, Math.max(0, (t - T_MAP) / (DURATION - T_MAP)));
        const dist = MAP_NEAR + (MAP_FAR - MAP_NEAR) * ease(m);
        camPos.copy(MAP_TARGET).addScaledVector(MAP_DIR, dist);
        blendCamera(camera, camPos, MAP_TARGET, t > DURATION - 2 ? 1 - ease((t - (DURATION - 2)) / 2) : 1);
        // The stars appear one at a time, Tau Ceti last; the caption comes once they are all there.
        const reveal = (t - 19.5) / 4.5;
        map.update(camera, reveal, t);
        if (t >= CAPTION_AT && !caption._on && !caption._done) { caption._on = true; caption._done = true; caption.show(STAR_MAP_CAPTION); }
        if (go && caption._on) { caption.hide(); caption._on = false; }
      }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    if (window.__ch7Opening === hook) delete window.__ch7Opening;
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    dial.remove();
    caption.remove();
    cont.remove();
    if (!switched) {
      scene.remove(ship.group, sun.group, back.pts, fill);
      ship.dispose(); sun.dispose(); back.dispose();
    } else {
      map.dispose();
      scene.remove(map.sunFill);
    }
    shipView.group.position.set(0, 0, 0);
    shipView.group.quaternion.copy(shipQuat);
    showStarship(game); // the starship is her craft from here on (main.js, aboardStarship)
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
