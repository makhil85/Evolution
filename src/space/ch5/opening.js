// Chapter 5's opening (~15 s): she lifts off Europa, Jupiter filling the sky,
// and swings out round Jupiter to the orbit she leaves it from, while the
// title comes up. Skippable after 1.5 s (Space, Enter, Esc or a click).
//
// Flight is paused and the ship is moved along a scripted path (the Europa
// walk ended Chapter 4 on the ground); at the end she is put on a real
// circular orbit round Jupiter and the camera blends into the chase view.
import * as THREE from 'three';
import { BODIES } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { heroName } from '../hud/hud.js';
import { CH5_START } from './start.js';

const UP = new THREE.Vector3(0, 1, 0);
/** Sim seconds per real second while it plays (Jupiter's moons visibly move). */
const SIM_RATE = 8;
const T_LIFT = 4; // liftoff starts
const T_ARC = 7.5; // the swing out round Jupiter starts
const T_FREE = 13; // she is on her real orbit, flight runs again
const DURATION = 15.5;

/** Where the scripted ship is at scene time t (physics coordinates). */
function pathAt(t, t0) {
  const tau = t0 + t * SIM_RATE;
  const e = bodyState('europa', tau);
  const j = bodyState('jupiter', tau);
  // She stands where Jupiter sits on Europa's horizon: a quarter of the way
  // round from the point facing it (so a camera low on the ground behind her
  // sees her on the skyline with Jupiter rising beyond), then climbs.
  const nx = j.x - e.x; const nz = j.z - e.z; const nl = Math.hypot(nx, nz) || 1;
  const n = { x: nx / nl, z: nz / nl };
  const m = { x: -n.z, z: n.x };
  const ground = BODIES.europa.radius + 0.55;
  if (t < T_ARC) {
    const h = t < T_LIFT ? 0 : 30 * Math.pow((t - T_LIFT) / (T_ARC - T_LIFT), 2);
    return { x: e.x + m.x * (ground + h), z: e.z + m.z * (ground + h), tau, n, m, j };
  }
  // The swing out: from where the climb ended, round Jupiter (the way its
  // moons go) and out to her starting orbit.
  const end = pathAt(T_ARC - 1e-6, t0);
  const rx = end.x - end.j.x; const rz = end.z - end.j.z;
  const r0 = Math.hypot(rx, rz); const a0 = Math.atan2(rz, rx);
  const s = ease(Math.min(1, (t - T_ARC) / (T_FREE - T_ARC)));
  const r = r0 + (CH5_START.radius - r0) * s;
  const a = a0 + 1.7 * s;
  return { x: j.x + r * Math.cos(a), z: j.z + r * Math.sin(a), tau, n, m, j, r, a };
}

/** @returns {Promise<void>} resolves when she has control. */
export function playCh5Opening(game) {
  const { scene, shipView, ship } = game;
  const overlay = buildOverlay({
    eyebrow: 'Chapter 5',
    title: 'Rings to a Star',
    sub: `${heroName()} leaves Europa for the outer planets`,
    startBlack: true,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  shipView.setLegs(true, true);
  shipView.setWingsFolded(true, true);

  const t0 = ship.t;
  let t = 0;
  let freed = false;

  // Her path, drawn as it is flown (fades away afterwards).
  const MAXP = 400;
  const trail = new Float32Array(MAXP * 3);
  const pts = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(trail, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(2), transparent: true, opacity: 0.9, depthTest: false });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 30;
  scene.add(line);

  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let wide = null; // the wide shot's pose when the blend back starts

  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, T_FREE); });
  setTimeout(() => overlay.light(), 150);
  setTimeout(() => overlay.bars(true), 250);

  function free(p) {
    // Onto a real circular orbit round Jupiter, where the scripted path ends.
    const j = bodyState('jupiter', p.tau);
    const rx = p.x - j.x; const rz = p.z - j.z; const r = Math.hypot(rx, rz);
    const c = rx / r; const s = rz / r; const v = Math.sqrt(BODIES.jupiter.gm / r);
    Object.assign(ship, {
      x: p.x, z: p.z, vx: j.vx - v * s, vz: j.vz + v * c, t: p.tau,
      angle: Math.atan2(c, -s), angVel: 0, _accum: 0, soi: 'jupiter', landedOn: null,
    });
    shipView.setLegs(false);
    game.paused = false;
    game.replan?.();
    freed = true;
  }

  game.cinematic = {
    hideMarkers: true,
    hidePath: true,
    apply(dt, camera) {
      const j = bodyState('jupiter', ship.t);
      const tc = t; // where the ship (and the scene's origin) is this frame
      const ox = ship.x; const oz = ship.z;
      if (tc < T_ARC) {
        // Low on Europa's ground just behind her, looking past her to
        // Jupiter on the skyline; it rises with her as she climbs.
        const p = pathAt(Math.min(tc, T_ARC - 1e-6), t0);
        const nn = new THREE.Vector3(p.n.x, 0, p.n.z);
        const mm = new THREE.Vector3(p.m.x, 0, p.m.z);
        const k = ease(tc / T_ARC);
        camPos.copy(nn).multiplyScalar(-4 - k * 3).addScaledVector(mm, 0.6 - k * 0.4).addScaledVector(UP, 0.3 + k * 0.8);
        // (Aimed a little high, so she sits below the title.)
        look.copy(nn).multiplyScalar(60).addScaledVector(mm, 4 + k * 10).addScaledVector(UP, 9);
        camera.position.copy(camPos);
        camera.up.copy(UP);
        camera.lookAt(look);
      } else if (tc < T_FREE) {
        // Pull back until Jupiter, its moons and her swing are all in view.
        const k = ease((tc - T_ARC) / (T_FREE - T_ARC));
        const dist = THREE.MathUtils.lerp(6, 5200, Math.pow(k, 1.8));
        const center = new THREE.Vector3(j.x - ship.x, 0, j.z - ship.z).multiplyScalar(Math.min(1, k * 1.4));
        camPos.copy(center).addScaledVector(new THREE.Vector3(0.25, 0.92, 0.3).normalize(), dist);
        look.copy(center);
        camera.position.copy(camPos);
        camera.up.copy(UP);
        camera.lookAt(look);
      } else {
        // Blend from the wide shot into the chase camera.
        if (!wide) wide = { pos: camPos.clone(), look: look.clone(), x: ship.x, z: ship.z };
        const off = new THREE.Vector3(wide.x - ship.x, 0, wide.z - ship.z);
        const w = 1 - ease((tc - T_FREE) / (DURATION - T_FREE));
        blendCamera(camera, wide.pos.clone().add(off), wide.look.clone().add(off), w);
      }

      // Then move her on for the NEXT frame. (This frame's scene was laid out
      // round where she was, so the camera above used that.) The first
      // frame's dt can be negative: rAF's timestamp predates boot.
      t += Math.max(0, Math.min(dt, 0.1));
      if (!freed) {
        const p = pathAt(Math.min(t, T_FREE), t0);
        const prev = pathAt(Math.max(0, Math.min(t, T_FREE) - 0.05), t0);
        // Heading: straight up off the ground, then along the swing.
        const hx = p.x - prev.x; const hz = p.z - prev.z;
        ship.angle = t < T_ARC || Math.hypot(hx, hz) < 1e-6 ? Math.atan2(p.m.z, p.m.x) : Math.atan2(hz, hx);
        Object.assign(ship, { x: p.x, z: p.z, vx: 0, vz: 0, t: p.tau, soi: t < T_ARC ? 'europa' : 'jupiter' });
        shipView.setThrottle(t > T_LIFT && t < T_FREE ? (t < T_ARC ? 1 : 0.5) : 0);
        if (t >= T_FREE) free(p);
        if (t > T_ARC - 0.3 && pts.length < MAXP && (!pts.length || Math.hypot(p.x - pts.at(-1).x, p.z - pts.at(-1).z) > 2)) pts.push({ x: p.x, z: p.z });
      }
      for (let i = 0; i < pts.length; i++) trail.set([pts[i].x - ox, 0, pts[i].z - oz], i * 3);
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, pts.length);

      if (t > 1.2 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 8.5 && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t > T_FREE + 0.5 && !overlay._unbarred) { overlay._unbarred = true; overlay.bars(false); document.body.classList.remove('in-cinematic'); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    if (!freed) free(pathAt(T_FREE, t0));
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    game.controls.setEnabled(true);
    shipView.setThrottle(0);
    // The trail fades out over a few seconds.
    const fade = () => {
      mat.opacity -= 1 / 180;
      if (mat.opacity > 0) requestAnimationFrame(fade);
      else { scene.remove(line); geo.dispose(); mat.dispose(); }
    };
    fade();
  });
}
