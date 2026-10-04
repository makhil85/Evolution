// The opening and the ending: the two moments a child remembers.
//
// OPENING (~10 s). Letterbox bars slide in. The camera starts wide, with Earth
// filling the frame behind her ship and the Chapter 3 rocket's booster still
// attached. The booster separates and tumbles away, her engine lights, and the
// camera swoops down into the chase view as the title reveals. The bars
// retract and the HUD fades in: she's flying.
//
// ENDING (~13 s). After the Europa checklist, the camera pulls back from her
// ship on Europa, past Jupiter, out until the whole inner solar system fits,
// while the route she ACTUALLY flew (recorded by main.js) draws itself as a
// glowing line from Earth to Europa. Then "Mission complete!" with her name.
//
// How it drives the camera. main.js always runs the normal flight camera
// first; a cinematic then OVERRIDES the camera for the frame, blending from
// its own shot into the flight camera's pose at the end. So the hand-off to
// gameplay is one continuous move, never a cut.
//
// Everything is skippable (Space, Enter, Esc or a click) after 1.5 s.
import * as THREE from 'three';
import { SHIP, INK, SHIP_PALETTE } from './contracts.js';
import { toonRamp } from '../game/toonPipeline.js';
import { heroName } from './hud/hud.js';

const UP = new THREE.Vector3(0, 1, 0);

// --- overlay: letterbox bars, title, skip hint ------------------------------------

const CSS = `
.cine { position: fixed; inset: 0; pointer-events: none; z-index: 40; }
.cine__bar { position: absolute; left: 0; right: 0; height: 11vh; background: #000;
  transition: transform 900ms cubic-bezier(.2,.8,.2,1); }
.cine__bar--top { top: 0; transform: translateY(-100%); }
.cine__bar--bottom { bottom: 0; transform: translateY(100%); }
.cine.is-on .cine__bar { transform: translateY(0); }
.cine__fade { position: absolute; inset: 0; background: #000; opacity: 1; transition: opacity 1400ms ease; }
.cine.is-lit .cine__fade { opacity: 0; }
.cine__title { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
  text-align: center; color: #fff7ea; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  text-shadow: 0 2px 24px rgba(0,0,0,.65); opacity: 0; transition: opacity 900ms ease; }
.cine__title.is-shown { opacity: 1; }
.cine__eyebrow { font-size: clamp(14px, 1.3vw, 20px); letter-spacing: .38em; text-transform: uppercase;
  color: #ffb347; margin-bottom: 12px; }
.cine__name { font-size: clamp(38px, 5.4vw, 86px); font-weight: 800; letter-spacing: .02em; line-height: 1.05; }
.cine__name span { display: inline-block; opacity: 0; transform: translateY(18px) scale(.96);
  transition: opacity 500ms ease, transform 700ms cubic-bezier(.2,.9,.25,1.2); }
.cine__name span.is-in { opacity: 1; transform: none; }
.cine__sub { margin-top: 14px; font-size: clamp(15px, 1.4vw, 22px); color: #e9e1d2; opacity: .9; }
.cine__skip { position: absolute; right: 22px; bottom: calc(11vh + 14px); color: rgba(255,247,234,.7);
  font: 600 14px system-ui, sans-serif; letter-spacing: .06em; opacity: 0; transition: opacity 600ms ease; }
.cine__skip.is-shown { opacity: 1; }
body.in-cinematic .sp-hud > *:not(.sp-modal-host):not([class*="modal"]) { opacity: 0; transition: opacity 600ms ease; }
body:not(.in-cinematic) .sp-hud > * { transition: opacity 900ms ease; }
@media (prefers-reduced-motion: reduce) {
  .cine__bar, .cine__fade, .cine__title, .cine__name span { transition: none; }
}
`;

let cssInjected = false;
function injectCss() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

function buildOverlay({ eyebrow, title, sub, startBlack }) {
  injectCss();
  const root = document.createElement('div');
  root.className = 'cine';
  root.innerHTML = `
    <div class="cine__fade"></div>
    <div class="cine__bar cine__bar--top"></div>
    <div class="cine__bar cine__bar--bottom"></div>
    <div class="cine__title">
      <div class="cine__eyebrow"></div>
      <div class="cine__name"></div>
      <div class="cine__sub"></div>
    </div>
    <div class="cine__skip">Space to skip</div>`;
  root.querySelector('.cine__eyebrow').textContent = eyebrow;
  root.querySelector('.cine__sub').textContent = sub || '';
  const name = root.querySelector('.cine__name');
  // One span per letter so the title can reveal like a wave.
  for (const ch of title) {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? ' ' : ch;
    name.appendChild(s);
  }
  if (!startBlack) root.classList.add('is-lit');
  document.body.appendChild(root);
  return {
    root,
    bars(on) { root.classList.toggle('is-on', on); },
    light() { root.classList.add('is-lit'); },
    darken() { root.classList.remove('is-lit'); },
    showTitle() {
      root.querySelector('.cine__title').classList.add('is-shown');
      [...name.children].forEach((s, i) => setTimeout(() => s.classList.add('is-in'), 60 * i));
    },
    hideTitle() { root.querySelector('.cine__title').classList.remove('is-shown'); },
    showSkip(v) { root.querySelector('.cine__skip').classList.toggle('is-shown', v); },
    remove() { root.remove(); },
  };
}

// --- helpers ---------------------------------------------------------------------

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Blend the camera from its current (flight) pose toward a cinematic pose. */
function blendCamera(camera, pos, look, w) {
  // camera already holds the flight camera's pose for this frame.
  const flightPos = camera.position.clone();
  const flightLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(pos.distanceTo(look)).add(flightPos);
  camera.position.lerpVectors(pos, flightPos, 1 - w);
  const l = new THREE.Vector3().lerpVectors(look, flightLook, 1 - w);
  camera.up.copy(UP);
  camera.lookAt(l);
}

function waitForSkip(armAfterMs, onArm) {
  let armed = false;
  let resolveSkip;
  const promise = new Promise((r) => { resolveSkip = r; });
  const t = setTimeout(() => { armed = true; onArm?.(); }, armAfterMs);
  const onKey = (e) => {
    if (!armed) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); resolveSkip(); }
  };
  const onClick = () => { if (armed) resolveSkip(); };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onClick, true);
  return {
    promise,
    dispose() {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onClick, true);
    },
  };
}

// --- the Chapter 3 booster that separates in the opening --------------------------

function buildBooster() {
  const g = new THREE.Group();
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp });
  const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const add = (geo, mat, y = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    const o = new THREE.Mesh(geo, ink);
    o.scale.setScalar(1.04);
    m.add(o);
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(1.25, 1.35, 7, 28), toon(SHIP_PALETTE.hull), 0);
  add(new THREE.CylinderGeometry(1.37, 1.37, 0.7, 28), toon(SHIP_PALETTE.accent), 1.9);
  add(new THREE.CylinderGeometry(1.37, 1.37, 0.5, 28), toon(SHIP_PALETTE.accent), -2.4);
  add(new THREE.CylinderGeometry(0.8, 1.2, 1.4, 24, 1, true), toon(SHIP_PALETTE.dark), -4.2);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.lineTo(1.3, -1.2); fin.lineTo(1.3, -2.6); fin.lineTo(0, -1.8);
    const geo = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false });
    geo.translate(1.2, -1.2, -0.07);
    const m = add(geo, toon(SHIP_PALETTE.accent), 0);
    m.rotation.y = (i * Math.PI) / 2;
  }
  // Lying along the ship's axis, nozzle aft (+Z), in the ship's local frame.
  g.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

function puffCloud(scene) {
  const n = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = [];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: new THREE.Color(0xfff0dd).multiplyScalar(1.6), size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    burst(at, spread) {
      for (let i = 0; i < n; i++) {
        pos.set([at.x, at.y, at.z], i * 3);
        vel[i] = new THREE.Vector3().randomDirection().multiplyScalar(spread * (0.4 + Math.random()));
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1;
    },
    update(dt) {
      if (mat.opacity <= 0) return;
      for (let i = 0; i < n; i++) {
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, mat.opacity - dt * 0.8);
    },
    dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); },
  };
}

// --- OPENING ----------------------------------------------------------------------

/**
 * @param {object} game main.js's game object (needs scene, shipView, states, ship, controls)
 * @returns {Promise<void>} resolves when she has control
 */
export function playIntro(game) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({
    eyebrow: 'Chapter 4',
    title: 'Voyage to Europa',
    sub: `${heroName()}'s journey to Jupiter's icy moon`,
    startBlack: true,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);

  const booster = buildBooster();
  booster.scale.setScalar(SHIP.flightScale);
  // Directly behind the ship's tail, in scene space; follows the ship until it separates.
  scene.add(booster);
  const puffs = puffCloud(scene);

  const DURATION = 10.5;
  let t = 0;
  let separated = false;
  let boosterVel = new THREE.Vector3();
  let boosterSpin = new THREE.Vector3();
  const tailLocal = new THREE.Vector3(0, 0, 3.45 + 3.9); // ship tail + half the booster, model units
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 1.2); });

  setTimeout(() => overlay.light(), 150);
  setTimeout(() => overlay.bars(true), 250);

  game.cinematic = {
    apply(dt, camera, states) {
      t += dt;
      const shipGroup = shipView.group;
      const earth = states.earth;
      const toEarth = tmp.set(earth.x - game.ship.x, 0, earth.z - game.ship.z).normalize();

      // Booster: attached until 3.6 s, then pushed away and tumbling.
      if (!separated) {
        booster.position.copy(tailLocal).multiplyScalar(SHIP.flightScale).applyAxisAngle(UP, shipGroup.rotation.y);
        booster.rotation.set(0, shipGroup.rotation.y, 0);
        shipView.setThrottle(0);
        if (t > 3.6) {
          separated = true;
          const back = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, shipGroup.rotation.y);
          boosterVel = back.multiplyScalar(0.55).add(new THREE.Vector3(0, -0.12, 0));
          boosterSpin.set(0.6, 0.25, 0.9);
          puffs.burst(booster.position.clone().addScaledVector(back, -0.1), 0.9);
          game.flightCam.shake(0.3);
          game.hud.toast?.('Booster separation!', { kind: 'good', ms: 2200 });
        }
      } else {
        booster.position.addScaledVector(boosterVel, dt);
        booster.rotation.x += boosterSpin.x * dt;
        booster.rotation.z += boosterSpin.z * dt;
        if (t > 4.4 && t < 9.6) shipView.setThrottle(Math.min(1, (t - 4.4) * 1.5) * (t < 8 ? 0.8 : 0.3));
      }
      puffs.update(dt);

      // Camera. Shot A (0-4.5 s): wide and low, Earth filling the frame behind
      // the ship, slowly drifting. Shot B (4.5-10.5 s): swoop into the chase.
      const side = new THREE.Vector3().crossVectors(UP, toEarth).normalize();
      const aT = Math.min(1, t / 4.5);
      camPos.copy(toEarth).multiplyScalar(-7.5 + aT * 1.5)
        .addScaledVector(side, 2.2 - aT * 1.2)
        .addScaledVector(UP, 1.1 + aT * 0.4);
      camLook.copy(toEarth).multiplyScalar(4);
      const w = 1 - ease((t - 4.5) / 5.5);
      blendCamera(camera, camPos, camLook, w);

      if (t > 1.2 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 7.4 && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t > 8.6 && !overlay._unbarred) { overlay._unbarred = true; overlay.bars(false); document.body.classList.remove('in-cinematic'); }
      if (t >= DURATION) {
        game.cinematic = null;
        finish();
      }
    },
  };

  return done.finally(() => {
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    game.controls.setEnabled(true);
    shipView.setThrottle(0);
    // The booster keeps tumbling away for a few seconds, then goes.
    setTimeout(() => { scene.remove(booster); puffs.dispose(); }, 6000);
    const drift = () => {
      if (!booster.parent) return;
      booster.position.addScaledVector(boosterVel, 1 / 60);
      booster.rotation.x += boosterSpin.x / 60;
      requestAnimationFrame(drift);
    };
    drift();
  });
}

// --- ENDING -----------------------------------------------------------------------

/**
 * @param {object} game needs scene, route (array of heliocentric {x,z}), ship, states
 * @returns {Promise<void>} resolves when the title has been shown (then show the end card)
 */
export function playOutro(game) {
  const { scene } = game;
  const overlay = buildOverlay({
    eyebrow: 'Mission complete',
    title: `${heroName()} reached Europa!`,
    sub: 'Could life be hiding under the ice? You went and found out.',
    startBlack: false,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;

  // The route she flew, as a glowing line that draws itself.
  const route = (game.route && game.route.length > 1) ? game.route : [{ x: game.ship.x, z: game.ship.z }];
  const n = route.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const c0 = new THREE.Color(0x7ff3ff).multiplyScalar(2.2);
  const c1 = new THREE.Color(0xffb347).multiplyScalar(2.6);
  for (let i = 0; i < n; i++) {
    const c = c0.clone().lerp(c1, i / Math.max(1, n - 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false }));
  line.frustumCulled = false;
  line.renderOrder = 30;
  scene.add(line);

  const DURATION = 13;
  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 1.5); });
  setTimeout(() => overlay.bars(true), 100);

  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const jup = new THREE.Vector3();

  game.cinematic = {
    apply(dt, camera, states) {
      t += dt;
      const ox = game.ship.x;
      const oz = game.ship.z;
      for (let i = 0; i < n; i++) positions.set([route[i].x - ox, 0, route[i].z - oz], i * 3);
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, Math.max(2, Math.floor(n * easeOut((t - 3) / 6))));

      // Pull back along a curve: close on the ship -> Jupiter system -> the
      // whole inner solar system, looking down on the Sun-plane.
      jup.set(states.jupiter.x - ox, 0, states.jupiter.z - oz);
      const sun = new THREE.Vector3(-ox, 0, -oz);
      const k = easeOut(t / 10);
      const dist = THREE.MathUtils.lerp(4, 52000, Math.pow(k, 2.6));
      const center = new THREE.Vector3().lerpVectors(new THREE.Vector3(), jup, Math.min(1, k * 1.6)).lerp(sun.clone().multiplyScalar(0.45), Math.max(0, k - 0.45) / 0.55);
      const dir = new THREE.Vector3(0.35, 0.9, 0.55).normalize();
      camPos.copy(center).addScaledVector(dir, dist);
      look.copy(center);
      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(look);

      if (t > 7.5 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    scene.remove(line);
    geo.dispose();
  });
}

// --- ZERO-G (Act 1) ----------------------------------------------------------------

/**
 * The zero-g moment, staged in her REAL cockpit rather than a separate set:
 * the camera slides in close to the canopy, with Earth behind her. She lifts
 * out of her seat, arms drifting up, and a pencil, a notebook and a wobbling
 * water drop float round her inside the glass. About 11 s; skippable.
 *
 * Physics is paused so the shot holds still; nothing about her orbit changes.
 * @returns {Promise<void>}
 */
export function playZeroG(game) {
  const { shipView } = game;
  const overlay = buildOverlay({ eyebrow: 'Zero gravity', title: 'Everything floats!', sub: '', startBlack: false });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  shipView.setThrottle(0);

  const girl = shipView.releaseGirl();
  const g0 = girl.group.position.clone();
  const r0 = girl.group.rotation.clone();
  const bones = girl.byName;
  const rest = {};
  for (const n of ['armL', 'armR', 'forearmL', 'forearmR', 'thighL', 'thighR', 'shinL', 'shinR', 'head', 'spine']) {
    if (bones[n]) rest[n] = bones[n].rotation.clone();
  }

  // Props, in the ship body's own (model) space around the canopy.
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp });
  const props = new THREE.Group();
  const pencil = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), toon(0xffc93c));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), toon(0xe8c9a0));
  tip.position.y = 0.195;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.04, 8), toon(0xff8fb1));
  eraser.position.y = -0.19;
  pencil.add(shaft, tip, eraser);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), toon(0x4f7cff));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.032, 0.28), toon(0xfff7ea));
  pages.position.x = 0.012;
  book.add(pages);
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.75, roughness: 0.05, clearcoat: 1 }),
  );
  props.add(pencil, book, drop);
  shipView.body.add(props);

  const CANOPY_C = new THREE.Vector3(0, 1.05, -0.8);
  const DURATION = 11;
  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 0.8); });
  setTimeout(() => overlay.bars(true), 60);

  const eLocal = new THREE.Vector3();
  const camLocal = new THREE.Vector3();
  const lookLocal = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();

  game.cinematic = {
    apply(dt, camera, states) {
      t += dt;
      const k = ease(Math.min(1, t / 2.2));          // float-up ramp
      const out = t > DURATION - 1.6 ? ease((DURATION - t) / 1.6) : 1; // settle back

      // Her: up out of the seat, a slow bob and roll, arms and legs drifting.
      const f = k * out;
      girl.group.position.set(g0.x + Math.sin(t * 0.7) * 0.03 * f, g0.y + (0.22 + Math.sin(t * 1.1) * 0.05) * f, g0.z);
      girl.group.rotation.set(r0.x + Math.sin(t * 0.5) * 0.12 * f, r0.y + Math.sin(t * 0.35) * 0.25 * f, r0.z + Math.sin(t * 0.6) * 0.1 * f);
      const set = (n, x, y, z) => { if (bones[n] && rest[n]) bones[n].rotation.set(rest[n].x + x * f, rest[n].y + y * f, rest[n].z + z * f); };
      set('armL', 0, 0, 1.15 + Math.sin(t * 1.3) * 0.2);
      set('armR', 0, 0, -1.15 - Math.sin(t * 1.2 + 1) * 0.2);
      set('forearmL', -0.4, 0, 0.2);
      set('forearmR', -0.4, 0, -0.2);
      set('thighL', 0.25 * Math.sin(t * 0.9), 0, 0.1);
      set('thighR', -0.25 * Math.sin(t * 0.9), 0, -0.1);
      set('head', 0.15 * Math.sin(t * 0.8), 0.3 * Math.sin(t * 0.45), 0);

      // Props drift in slow loops inside the glass, tumbling.
      pencil.position.set(0.42 + Math.sin(t * 0.6) * 0.08, 1.15 + Math.sin(t * 0.9) * 0.08, -1.05);
      pencil.rotation.set(t * 0.9, t * 0.4, t * 0.7);
      book.position.set(-0.45, 0.98 + Math.sin(t * 0.7 + 1) * 0.07, -1.1 + Math.sin(t * 0.5) * 0.06);
      book.rotation.set(Math.sin(t * 0.4) * 0.6, t * 0.3, 0.4);
      drop.position.set(0.25 + Math.sin(t * 0.8 + 2) * 0.1, 1.35 + Math.sin(t * 1.0) * 0.05, -1.35);
      const w = Math.sin(t * 5.5) * 0.14;
      drop.scale.set(1 + w, 1 - w, 1 + w * 0.5);

      // Camera: in front of the canopy on the side AWAY from Earth, so she is
      // framed against the planet. Everything in ship-body space, then to world.
      const earth = states.earth;
      eLocal.set(earth.x - game.ship.x, 0, earth.z - game.ship.z);
      shipView.body.worldToLocal(eLocal.add(shipView.body.getWorldPosition(new THREE.Vector3())));
      eLocal.sub(CANOPY_C).setY(0).normalize();
      // Keep the camera in front of her face (-Z half) whatever side Earth is on.
      if (eLocal.z < 0.2) eLocal.z = 0.2;
      eLocal.normalize();
      const dolly = 3.1 - ease(t / DURATION) * 0.6;
      camLocal.copy(CANOPY_C).addScaledVector(eLocal, -dolly).add(new THREE.Vector3(0, 0.55, 0));
      if (camLocal.z > -1.2) camLocal.z = -1.2 - (camLocal.z + 1.2) * 0.2; // stay ahead of the nose-side glass
      lookLocal.copy(CANOPY_C);
      pos.copy(camLocal); shipView.body.localToWorld(pos);
      look.copy(lookLocal); shipView.body.localToWorld(look);
      const inW = ease(Math.min(1, t / 1.4)) * (t > DURATION - 1.2 ? ease((DURATION - t) / 1.2) : 1);
      blendCamera(camera, pos, look, inW);

      if (t > 2.4 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 7.2 && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    for (const n of Object.keys(rest)) bones[n].rotation.copy(rest[n]);
    shipView.body.remove(props);
    shipView.seatGirl();
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
