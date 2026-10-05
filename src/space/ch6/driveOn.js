// Chapter 6's ending (step 18, ~24 s, skippable): the Sun dive and the drive
// lighting. The rock ship swings in close past a huge Sun, fires the fusion
// drive at the closest point (lesson 6B: deep in the Sun's pull each bit of
// push counts most), and streaks out towards the stars. A speed dial counts
// up and then switches from km/s to percent of light (lesson 6C). The screen
// fades to "10% of light speed"; lesson 6C and the end card follow (partE.js).
//
// Same contract as Chapter 5's ending (src/space/ch5/ending.js): flight is
// paused, the scene builds its own objects and lights and removes them
// after, `game.cinematic` drives the camera with `calm: true`.
//
// The scene is ship-centred and the real Sun can be very far away, so this
// builds its own close-up Sun out along the real Sun's direction, where it
// covers the real one.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { buildRockShip } from '../ch5/ending.js';
import { t as lvl } from '../level.js';
import { CRUISE_PERCENT, LIGHT_KMS } from './routes.js';

const DURATION = 24;
const SUN_R = 300; // the close-up Sun's radius, scene units
const RP = 420; // the closest pass, from the Sun's centre
const E = 1.25; // how open the swing is (a hyperbola)
const T_CLOSE = 8; // seconds in: the closest point, the drive fires

/** The speed dial: a small fixed box, km/s first, then % of light. */
function buildDial() {
  const box = document.createElement('div');
  box.className = 'c6-dial';
  box.style.cssText = 'position:fixed;right:28px;bottom:120px;z-index:60;min-width:170px;padding:12px 16px;border-radius:16px;'
    + 'background:rgba(10,16,32,.78);border:2px solid #7fd3ff;color:#fff;font:800 15px system-ui,sans-serif;text-align:center;'
    + 'transition:opacity .6s;opacity:0;pointer-events:none';
  const big = document.createElement('div');
  big.style.cssText = 'font-size:30px;line-height:1.1';
  const unit = document.createElement('div');
  unit.style.cssText = 'font-size:13px;color:#cfe8ff';
  box.append(big, unit);
  document.body.appendChild(box);
  return {
    show(v) { box.style.opacity = v ? '1' : '0'; },
    kms(v) { big.textContent = Math.round(v).toLocaleString('en-US'); unit.textContent = 'km/s'; box.style.borderColor = '#7fd3ff'; },
    pct(v) { big.textContent = `${v.toFixed(v < 10 ? 1 : 0)}%`; unit.textContent = lvl('of light speed', 'of light speed'); box.style.borderColor = '#9fe8a8'; },
    remove() { box.remove(); },
  };
}

/** A glowing close-up Sun: a bright ball, a soft halo, and its own light. */
function buildSun() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc25a) }));
  g.add(ball);
  // A soft glow round it: a camera-facing sprite with a radial fade.
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(64, 64, 20, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,220,140,0.9)'); grad.addColorStop(0.45, 'rgba(255,170,60,0.35)'); grad.addColorStop(1, 'rgba(255,140,40,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(SUN_R * 3.4);
  g.add(glow);
  const light = new THREE.PointLight(0xfff1dc, 3, 0, 0);
  g.add(light);
  return { group: g, dispose() { g.traverse((o) => { o.material?.map?.dispose?.(); o.geometry?.dispose?.(); o.material?.dispose?.(); }); } };
}

/**
 * @param {object} game the space game (scene, ship, shipView, controls)
 * @param {{speedKms?:number}} [opts] her speed after the slingshots (for the dial)
 * @returns {Promise<void>}
 */
export function playDriveOn(game, { speedKms = 60 } = {}) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({ eyebrow: lvl('Chapter 6 · The Sun dive', 'The Sun dive'), title: lvl('Fusion drive on', 'Engine on!'), sub: lvl('Out past the Sun, to the stars', 'Off to the stars!'), startBlack: false });
  let next = null;
  const dial = buildDial();
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;

  // Her ship is inside the rock ship now: hide it.
  const shipQuat = shipView.group.quaternion.clone();
  shipView.group.visible = false;
  const rock = buildRockShip();
  rock.setRings(1);
  scene.add(rock.group);
  // The close-up Sun, out along the real Sun's direction.
  const S = new THREE.Vector3(-(game.ship?.x ?? 1), 0, -(game.ship?.z ?? 0));
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x); // across
  const up = new THREE.Vector3(0, 1, 0);
  const C = S.clone().multiplyScalar(RP * 2.2); // the Sun's centre
  const sun = buildSun();
  sun.group.position.copy(C);
  scene.add(sun.group);
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.35);
  scene.add(fill);

  /** The swing round the Sun at angle nu (0 = the closest point). */
  const at = (nu, out = new THREE.Vector3()) => {
    const r = (RP * (1 + E)) / (1 + E * Math.cos(nu));
    // nu < 0 on the way in (her side of the Sun), nu > 0 on the way out.
    return out.copy(C).addScaledVector(S, -r * Math.cos(nu)).addScaledVector(P, r * Math.sin(nu));
  };
  const NU_MAX = Math.acos(-1 / E) * 0.86;
  // Before the drive: nu from -1.6 to 0 by T_CLOSE (faster near the Sun).
  // After: the drive pushes; the swing opens and she leaves fast in a straight line.
  const nuAt = (tt) => {
    if (tt <= T_CLOSE) { const k = tt / T_CLOSE; return -1.6 * (1 - k) ** 1.6; }
    return Math.min(NU_MAX, (tt - T_CLOSE) * 0.55);
  };
  const exitDir = at(NU_MAX + 0.01).sub(at(NU_MAX)).normalize();
  let extra = 0; let extraV = 0;

  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 3); });
  setTimeout(() => overlay.bars(true), 100);

  const pos = new THREE.Vector3(); const ahead = new THREE.Vector3();
  const camPos = new THREE.Vector3(); const look = new THREE.Vector3();
  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    get t() { return t; }, // tests: seconds into the scene
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      shipView.group.visible = false; // she is inside the rock (the flight loop would show her ship)
      const nu = nuAt(t);
      at(nu, pos);
      if (nu >= NU_MAX) { extraV += dt * 60; extra += extraV * dt; pos.copy(at(NU_MAX)).addScaledVector(exitDir, extra); ahead.copy(pos).addScaledVector(exitDir, 10); } else at(nu + 0.01, ahead);
      rock.group.position.copy(pos);
      rock.group.lookAt(pos.clone().multiplyScalar(2).sub(ahead)); // nose (-Z) forward, drive behind
      // The drive: off until the closest point, then on for good.
      rock.setFlame(ease((t - T_CLOSE) / 0.8), t);
      const fwd = ahead.clone().sub(pos).normalize();
      const out = pos.clone().sub(C).normalize(); // away from the Sun
      // Side view from outside the swing (the rock in front, the Sun's edge
      // filling the back of the shot); after the burn the camera slides out
      // to ride alongside: the flame trails behind the rock and the Sun
      // shrinks behind that. One smooth move, no cut.
      const k = ease((t - T_CLOSE) / 4);
      camPos.copy(pos).addScaledVector(out, 170 + 40 * k).addScaledVector(up, 55 + 20 * k).addScaledVector(fwd, -60 + 110 * k);
      look.copy(pos).lerp(C, 0.12 * (1 - k));
      blendCamera(camera, camPos, look, ease(t / 1.5));
      // The dial: km/s from her slingshot speed, then the drive's push; at
      // a few % it switches to percent of light and climbs to the cruise.
      if (t > 3) dial.show(true);
      if (t < T_CLOSE) dial.kms(speedKms + (t / T_CLOSE) * speedKms * 0.4);
      else {
        const k = ease((t - T_CLOSE) / 9);
        const kms = speedKms * 1.4 + k * (LIGHT_KMS * CRUISE_PERCENT / 100 - speedKms * 1.4);
        if (kms < 3000) dial.kms(kms); else dial.pct((kms / LIGHT_KMS) * 100);
      }
      if (t > 1 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 4.5 && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t > 19 && !overlay._c) { overlay._c = true; overlay.darken(); dial.show(false); }
      if (t > 20 && !next) {
        next = buildOverlay({ eyebrow: lvl('Fusion drive on', 'Engine on!'), title: lvl(`${CRUISE_PERCENT}% of light speed`, `${CRUISE_PERCENT}% of light speed`), sub: lvl('Next: how fast is light, anyway?', 'How fast is light?'), startBlack: true });
        next.showTitle();
      }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    scene.remove(rock.group, sun.group, fill);
    rock.dispose(); sun.dispose();
    shipView.group.position.set(0, 0, 0);
    shipView.group.quaternion.copy(shipQuat);
    shipView.group.visible = true;
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => { overlay.remove(); next?.remove(); dial.remove(); }, 1500);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
