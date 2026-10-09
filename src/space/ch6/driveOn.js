// Chapter 6's ending (step 18, ~24 s, skippable): the Sun dive and the drive
// lighting. The starship swings in close past a huge Sun, fires the fusion
// drive at the closest point (lesson 6B: deep in the Sun's pull each bit of
// push counts most), and streaks out towards the stars. A speed dial counts
// up and then switches from km/s to percent of light (lesson 6C). The screen
// fades to "10% of light speed"; lesson 6C and the end card follow (partE.js).
//
// Same contract as Chapter 5's ending (src/space/ch5/ending.js): flight is
// paused, the scene builds its own objects and lights and removes them
// after, `game.cinematic` drives the camera with `calm: true`.
//
// The ship is ch6/starship.js, scaled to FLIGHT_LENGTH (about 13x her ship).
// Its nose (-Z) follows the path by slerp, the ring spins, the running lights
// blink. Near the Sun the magnetic field glows up (0.3 -> 0.8); at the closest
// point the drive lights ring by ring, the camera shakes once, and the plume
// comes on full. After the burn the field brightens ahead of the cap and
// short star streaks (our own lines, cleaned up after) stretch towards the
// way she is going.
//
// The scene is ship-centred and the real Sun can be very far away, so this
// builds its own close-up Sun out along the real Sun's direction, where it
// covers the real one.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease, cardSeconds } from '../cinematics.js';
import { createStarship, FLIGHT_LENGTH } from './starship.js';
import { t as lvl } from '../level.js';
import { CRUISE_PERCENT, LIGHT_KMS } from './routes.js';

// The next card ("Next: how fast is light, anyway?") comes at NEXT_AT and stays
// up for its reading time; the film runs until it has been read.
const NEXT_AT = 20;
const NEXT_TEXT = [lvl('Fusion drive on', 'Engine on!'), `${CRUISE_PERCENT}% of light speed`, lvl('Next: how fast is light, anyway?', 'How fast is light?')];
const DURATION = Math.max(24, NEXT_AT + cardSeconds(...NEXT_TEXT) + 0.5);
const SUN_R = 300; // the close-up Sun's radius, scene units
const RP = 420; // the closest pass, from the Sun's centre
const E = 1.25; // how open the swing is (a hyperbola)
const T_CLOSE = 8; // seconds in: the closest point, the drive fires
const T_LIGHT = 1.5; // the drive lights ring by ring over this, then full
const T_RAMP = 6; // after the closest point the swing's rate ramps up over this
const NU0 = 1.6; // the swing starts this far (radians) before the closest point
const NU_MAX = Math.acos(-1 / E) * 0.86; // where the swing stops and she flies straight
const ACCEL = 40; // the straight exit speeds up (scene units per s^2)
const STAR_R = 4000; // the star streaks' sphere, round her
const N_STARS = 140;
const UP = new THREE.Vector3(0, 1, 0);

// The camera, as offsets from her in her own frame: out (away from the Sun),
// forward (her heading) and up. It starts beside her, swings round to frame the
// Sun and her at the closest point, then sits behind her as she leaves, so the
// Sun shrinks away behind. The look point is her own, nudged as the shot turns.
// Close enough that she fills a good part of the frame (about 25-35% of its
// height) through the pass and the burn, then the camera pulls back to about
// 12-15% as she streaks away. The shots move round her: front-3/4 coming in,
// side-on at the burn, rear-3/4 leaving with the plume towards the camera.
const CAM_KEYS = [
  [0, [35, 45, 25]],
  [4, [40, 40, 25]],
  [T_CLOSE, [30, 5, 40]],
  [11, [40, -20, 30]],
  [14, [25, -45, 35]],
  [16, [30, -70, 40]],
  [DURATION, [25, -110, 45]],
];
const LOOK_KEYS = [
  [0, [0, 0, 0]],
  [T_CLOSE, [0, 0, 0]],
  [16, [0, 8, 0]],
  [DURATION, [0, 15, 0]],
];

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
  const ball = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa84a) }));
  g.add(ball);
  // A soft glow round it: a camera-facing sprite with a radial fade. Kept to
  // about 2.4 radii, so the halo does not fill the frame and the ship still reads.
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(64, 64, 40, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,120,0.75)'); grad.addColorStop(0.5, 'rgba(255,160,70,0.28)'); grad.addColorStop(1, 'rgba(255,140,40,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(SUN_R * 2.0);
  g.add(glow);
  const light = new THREE.PointLight(0xfff1dc, 2.2, 0, 0);
  g.add(light);
  return {
    group: g,
    light,
    dispose() {
      g.traverse((o) => { o.material?.map?.dispose?.(); o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
  };
}

/**
 * Star streaks: short lines on a sphere round her, each drawn from its star
 * towards the way she is going (the sky bunches up ahead and stretches
 * behind). Length and brightness are set each frame by update().
 */
function buildStreaks() {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const dirs = []; const tint = [];
  for (let i = 0; i < N_STARS; i++) {
    const z = 2 * rnd() - 1; const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - z * z);
    dirs.push(new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)));
    tint.push(0.35 + 0.65 * rnd());
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N_STARS * 6);
  const col = new Float32Array(N_STARS * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  const tang = new THREE.Vector3(); const tail = new THREE.Vector3();
  return {
    lines,
    /** heading: her unit direction of travel; len: streak length in radians; k: 0..1 brightness. */
    update(heading, len, k) {
      lines.visible = k > 0.01;
      if (!lines.visible) return;
      for (let i = 0; i < N_STARS; i++) {
        const d = dirs[i];
        tang.copy(heading).addScaledVector(d, -heading.dot(d)); // the part that points at the apex
        tail.copy(d).addScaledVector(tang, len).normalize();
        const i6 = i * 6;
        pos.set([d.x * STAR_R, d.y * STAR_R, d.z * STAR_R, tail.x * STAR_R, tail.y * STAR_R, tail.z * STAR_R], i6);
        const c = k * tint[i];
        col.set([c * 0.9, c * 0.95, c, 0, 0, 0], i6); // the tail fades to nothing
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    setCentre(p) { lines.position.copy(p); },
    dispose() { lines.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

/** Catmull-Rom through four values, for u in 0..1 between the middle two. */
const catmull = (p0, p1, p2, p3, u) => {
  const u2 = u * u; const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
};

/** A smooth curve through keyed vectors at keyed times, written into out. */
function keyed(keys, tt, out) {
  let i = 0;
  while (i < keys.length - 2 && tt > keys[i + 1][0]) i++;
  const [t1, v1] = keys[i]; const [t2, v2] = keys[i + 1];
  const v0 = keys[Math.max(0, i - 1)][1]; const v3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const u = Math.min(1, Math.max(0, (tt - t1) / (t2 - t1)));
  return out.set(catmull(v0[0], v1[0], v2[0], v3[0], u), catmull(v0[1], v1[1], v2[1], v3[1], u), catmull(v0[2], v1[2], v2[2], v3[2], u));
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

  // Her ship is inside the starship now: hide it.
  const shipQuat = shipView.group.quaternion.clone();
  shipView.group.visible = false;
  const ship = createStarship({ detail: 'near' });
  ship.group.scale.setScalar(FLIGHT_LENGTH / ship.dims.length);
  ship.setRingSpin(0.5);
  ship.setField(0.3);
  ship.setDrive(0);
  scene.add(ship.group);

  // The close-up Sun, out along the real Sun's direction.
  const S = new THREE.Vector3(-(game.ship?.x ?? 1), 0, -(game.ship?.z ?? 0));
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x); // across
  const C = S.clone().multiplyScalar(RP * 2.2); // the Sun's centre
  const sun = buildSun();
  sun.group.position.copy(C);
  scene.add(sun.group);

  // Light: a warm key from the Sun's side (so the cap's sunward edge lights
  // up as she nears), a soft fill, and the Sun's own lamp.
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.35);
  const KEY_COOL = new THREE.Color(0xffe2c4); const KEY_HOT = new THREE.Color(0xff7a2e);
  const key = new THREE.DirectionalLight(KEY_COOL, 0.6);
  const keyTarget = new THREE.Object3D();
  key.target = keyTarget;
  scene.add(fill, key, keyTarget);

  const streaks = buildStreaks();
  scene.add(streaks.lines);

  // The warm glow on the cap's sunward rim: a small additive sprite, off by default.
  const capCv = document.createElement('canvas'); capCv.width = capCv.height = 64;
  const capCx = capCv.getContext('2d');
  const capGrad = capCx.createRadialGradient(32, 32, 0, 32, 32, 32);
  capGrad.addColorStop(0, 'rgba(255,190,110,1)'); capGrad.addColorStop(0.4, 'rgba(255,140,60,0.4)'); capGrad.addColorStop(1, 'rgba(255,120,40,0)');
  capCx.fillStyle = capGrad; capCx.fillRect(0, 0, 64, 64);
  const capGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(capCv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  capGlow.scale.setScalar(5);
  scene.add(capGlow);

  /** The swing round the Sun at angle nu (0 = the closest point). */
  const r = (nu) => (RP * (1 + E)) / (1 + E * Math.cos(nu));
  const at = (nu, out = new THREE.Vector3()) => {
    // nu < 0 on the way in (her side of the Sun), nu > 0 on the way out.
    const rr = r(nu);
    return out.copy(C).addScaledVector(S, -rr * Math.cos(nu)).addScaledVector(P, rr * Math.sin(nu));
  };
  // The swing's angle: before the drive it eases into the closest point (rate
  // 0 there); after it the rate ramps up from 0, so the motion never jumps.
  const nuAt = (tt) => {
    if (tt <= T_CLOSE) { const k = tt / T_CLOSE; return -NU0 * (1 - k) ** 1.6; }
    const tau = Math.min(tt - T_CLOSE, T_RAMP);
    return (NU_MAX * tau * tau) / (T_RAMP * T_RAMP);
  };
  // Once the swing has opened to NU_MAX she flies straight on along the tangent,
  // at the speed she had there and speeding up.
  const vT = at(NU_MAX + 1e-3).sub(at(NU_MAX)).divideScalar(1e-3);
  const exitDir = vT.clone().normalize();
  const V0 = vT.length() * ((2 * NU_MAX) / T_RAMP); // her speed when the swing ends
  const T_END = T_CLOSE + T_RAMP;
  const posAt = (tt, out = new THREE.Vector3()) => {
    if (tt <= T_END) return at(nuAt(tt), out);
    const s = tt - T_END;
    return at(NU_MAX, out).addScaledVector(exitDir, V0 * s + 0.5 * ACCEL * s * s);
  };

  let t = 0;
  let finish;
  const done = new Promise((r2) => { finish = r2; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 3); });
  setTimeout(() => overlay.bars(true), 100);

  const pos = new THREE.Vector3(); const fwd = new THREE.Vector3(); const ahead = new THREE.Vector3();
  const out = new THREE.Vector3(); const camPos = new THREE.Vector3(); const look = new THREE.Vector3();
  const offs = new THREE.Vector3();
  const mat4 = new THREE.Matrix4(); const qTarget = new THREE.Quaternion();
  const ORIGIN = new THREE.Vector3();
  let aimed = false; // the first frame sets her attitude outright, then it eases

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    get t() { return t; }, // tests: seconds into the scene
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      shipView.group.visible = false; // she is inside the starship (the flight loop would show her ship)

      // Her place, her heading (the path's own direction) and the Sun's side.
      posAt(t, pos);
      posAt(t + 0.05, ahead);
      fwd.copy(ahead).sub(pos).normalize();
      out.copy(pos).sub(C).normalize();

      // The ship: on the path, nose along the heading. The attitude eases
      // towards its target (a slerp), so it never snaps.
      ship.group.position.copy(pos);
      mat4.lookAt(ORIGIN, fwd, UP); // -Z (the cap) along the heading
      qTarget.setFromRotationMatrix(mat4);
      if (!aimed) { ship.group.quaternion.copy(qTarget); aimed = true; }
      else ship.group.quaternion.slerp(qTarget, 1 - Math.exp(-dt * 5));

      // The drive: lights ring by ring over T_LIGHT from the closest point, then full.
      const drive = ease((t - T_CLOSE) / T_LIGHT);
      // The field glows up as she nears the Sun, then brightens ahead of the cap at speed.
      const field = t < T_CLOSE ? 0.3 + 0.5 * ease(t / T_CLOSE) : 0.8 + 0.2 * ease((t - T_CLOSE) / 10);
      // Star streaks: from a few seconds after the burn, as she picks up speed.
      const burn = ease((t - T_CLOSE - 1) / 6);
      ship.setDrive(drive);
      ship.setField(field);
      ship.update(dt, t);
      streaks.setCentre(pos);
      // The streaks lengthen a little more once she is well clear of the Sun.
      streaks.update(fwd, (0.07 + 0.06 * ease((t - 16) / 6)) * burn, 0.6 * burn);
      // A soft warm glow on the cap's sunward rim: the rim sits about 5.2 units
      // ahead of her centre (the cap is her front), and it glows near the closest point.
      capGlow.position.copy(pos).addScaledVector(fwd, 5.2).addScaledVector(out, -2.6);
      capGlow.material.opacity = 0.85 * ease(Math.max(0, 1 - Math.abs(t - T_CLOSE) / 6));

      // The key: warm, from the Sun's side, strongest at the closest point. The
      // lights are kept low so the white hull stays under the bloom threshold
      // (it should not glow like a lamp).
      const near = ease(Math.max(0, 1 - Math.abs(t - T_CLOSE) / 9));
      key.intensity = 0.3 + 0.5 * near;
      key.color.copy(KEY_COOL).lerp(KEY_HOT, near); // her sunward side glows hotter as she nears the Sun
      key.position.copy(pos).addScaledVector(out, 400).addScaledVector(UP, 120);
      keyTarget.position.copy(pos);
      keyTarget.updateMatrixWorld();
      sun.light.intensity = 0.5 + 0.2 * drive;

      // Camera: one eased path. The closest point gets one short shake as the drive lights.
      keyed(CAM_KEYS, t, offs);
      camPos.copy(pos).addScaledVector(out, offs.x).addScaledVector(fwd, offs.y).addScaledVector(UP, offs.z);
      keyed(LOOK_KEYS, t, offs);
      look.copy(pos).addScaledVector(out, offs.x).addScaledVector(fwd, offs.y).addScaledVector(UP, offs.z);
      const sh = t > T_CLOSE && t < T_CLOSE + 1.2 ? (1 - (t - T_CLOSE) / 1.2) * 1.4 : 0;
      if (sh > 0) {
        const jx = Math.sin(t * 61) * 0.6 + Math.sin(t * 37 + 1) * 0.4;
        const jy = Math.sin(t * 53 + 2) * 0.6 + Math.sin(t * 29) * 0.4;
        camPos.addScaledVector(out, jx * sh).addScaledVector(UP, jy * sh);
      }
      blendCamera(camera, camPos, look, ease(t / 1.5));

      // The dial: km/s from her slingshot speed, then the drive's push; at
      // a few % it switches to percent of light and climbs to the cruise.
      if (t > 3 && t < 19) dial.show(true); // (it fades out at 19, see below)
      if (t < T_CLOSE) dial.kms(speedKms + (t / T_CLOSE) * speedKms * 0.4);
      else {
        const k = ease((t - T_CLOSE) / 9);
        const kms = speedKms * 1.4 + k * (LIGHT_KMS * CRUISE_PERCENT / 100 - speedKms * 1.4);
        if (kms < 3000) dial.kms(kms); else dial.pct((kms / LIGHT_KMS) * 100);
      }
      if (t > 1 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 1 + overlay.readS && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t > 19 && !overlay._c) { overlay._c = true; overlay.darken(); dial.show(false); }
      if (t > NEXT_AT && !next) {
        next = buildOverlay({ eyebrow: NEXT_TEXT[0], title: NEXT_TEXT[1], sub: NEXT_TEXT[2], startBlack: true });
        next.showTitle();
      }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    scene.remove(ship.group, sun.group, fill, key, keyTarget, capGlow);
    ship.dispose(); sun.dispose(); streaks.dispose();
    capGlow.material.map.dispose(); capGlow.material.dispose();
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
