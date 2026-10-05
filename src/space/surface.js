// Chapter 4 - the two surface scenes: the Moon (a rehearsal) and Europa (the
// finale). She lands, climbs down the ladder, and walks around in low gravity.
//
//   import { createSurfaceScene } from './surface.js';
//   const result = await game.runScene(createSurfaceScene(game, {
//     body: 'moon' | 'europa',
//     onBeat: async (beat) => { ... ask the question for this beat ... },
//   }));
//   // result = { samples: ['Moon rock'] } or { samples: ['Europa ocean water'] }
//
// The returned object is main.js's runScene contract:
//   { scene, camera, start(): Promise<result>, tick(dt, input, mouse, modalOpen), dispose() }
//
// Beats it triggers (await onBeat(name) at the right moment):
//   Moon:   moonWalk (after her first big jump), moonSample (after picking up
//           the glowing rock), moonFootprints (at the old footprints)
//   Europa: europaWalk (on the way to the crack), drillResult (after the drill
//           breaks through to water)
//
// Controls (like Chapter 3): W/S forward/back and A/D sideways, relative to
// the camera; Shift runs (long low-gravity bounds); Space jumps; E uses
// things (hold E to drill); drag the mouse to look around, wheel to zoom.
//
// Helpers follow game.mode (contracts FLIGHT_MODES): Easy draws a glowing
// trail to the next goal, Medium a beacon over it, Hard a beacon only within
// 15 m. Interaction radii scale by mode.captureScale.
//
// Everything is timed on the SCENE clock (tick's dt), never setTimeout, so a
// lab (or a test) can drive it frame by frame in a hidden tab.
import * as THREE from 'three';
import { RENDER, FLIGHT_MODES } from './contracts.js';
import { createShip, GROUND_Y } from './ship.js';
import { createSky } from './sky.js';
import { LAYOUT, skyDir } from './surface/layout.js';
import { createTerrain } from './surface/terrain.js';
import { createSkyBodies } from './surface/skyBodies.js';
import { createWalker } from './surface/walker.js';
import { createParticles, createFootprints, createBeacon, createGuideTrail } from './surface/fx.js';
import { createSampleRock, createOldStation, createDrillRig, createDrillHole } from './surface/props.js';
import { createOverlay } from './surface/overlay.js';
import { rng, clamp, lerp, smoothstep } from './surface/noise.js';
import { t } from './level.js';

const TAU = Math.PI * 2;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** For turning on the spot: a sine ease, half the cubic's top spin speed. */
const easeTurn = (t) => (1 - Math.cos(Math.PI * t)) / 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * @param {object} game  the Chapter 4 game object (hud, controls, renderer, mode, bodies)
 * @param {{ body?: 'moon'|'europa', onBeat?: (beat: string) => Promise<any> }} [opts]
 */
export function createSurfaceScene(game, { body = 'moon', onBeat = null } = {}) {
  const L = LAYOUT[body];
  if (!L) throw new Error(`surface: unknown body "${body}"`);
  const renderer = game.renderer;
  const hud = game.hud || null;
  const mode = game.mode || FLIGHT_MODES.medium;
  const capture = mode.captureScale ?? 1;
  const isMoon = body === 'moon';

  // ---------------------------------------------------------------------------
  // scene, camera, light
  // ---------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.name = `surface-${body}`;
  scene.background = new THREE.Color(0x000000);
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const camera = new THREE.PerspectiveCamera(RENDER.fov, size.x / Math.max(1, size.y), 0.05, 60000);

  const prevShadow = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const sunDir = skyDir(L.sun.az, L.sun.el);
  const sun = new THREE.DirectionalLight(L.sun.color, L.sun.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 2;
  const SHADOW_BOX = { near: 26, far: 55 };
  let shadowHalf = SHADOW_BOX.near;
  const setShadowBox = (h) => {
    const c = sun.shadow.camera;
    c.left = -h; c.right = h; c.top = h; c.bottom = -h;
    c.near = 1; c.far = 260;
    c.updateProjectionMatrix();
  };
  setShadowBox(shadowHalf);
  scene.add(sun, sun.target);
  // Fill: light bouncing off the bright ground from below, black sky above.
  const hemi = new THREE.HemisphereLight(L.fill.sky, L.fill.ground, L.fill.intensity);
  scene.add(hemi);
  if (!isMoon) {
    // Jupiter-shine: a faint warm light from the giant in the sky.
    const jl = new THREE.DirectionalLight(0xffdcb0, 0.28);
    jl.position.copy(skyDir(L.jupiter.az, L.jupiter.el)).multiplyScalar(100);
    scene.add(jl);
  }

  // ---------------------------------------------------------------------------
  // world
  // ---------------------------------------------------------------------------
  const terrain = createTerrain({ body, renderer });
  scene.add(terrain.group);

  const sky = createSky({ scene });
  let skyU = null;
  sky.group.traverse((o) => { if (!skyU && o.material?.uniforms?.uHazeStrength) skyU = o.material.uniforms; });
  const skyBodies = createSkyBodies({ body, sunDir, game, renderer });
  scene.add(skyBodies.group);

  // Her ship, landed: legs down, wings folded, hatch shut until the intro.
  const ship = createShip({});
  ship.setWingsFolded(true, true);
  ship.setLegs(true, true);
  ship.setHatch(false, true);
  if (!isMoon) ship.setSolarWingsInstalled(true);
  ship.fx.setNavLights(false); // parked: no blinking glow at the tips
  ship.group.rotation.y = L.ship.yaw;
  ship.group.position.set(L.ship.x, terrain.heightAt(L.ship.x, L.ship.z) - GROUND_Y + 0.02, L.ship.z);
  ship.setSunDirection(sunDir);
  ship.releaseGirl();
  ship.girl.group.visible = false;       // she is out here now
  ship.group.traverse((o) => {
    if (!(o.isMesh || o.isBatchedMesh || o.isInstancedMesh)) return;
    const outline = /outline/i.test(o.name) || o.material?.side === THREE.BackSide;
    if (!outline && !o.material?.transparent && o.name !== 'cockpitScreens') o.castShadow = true;
  });
  scene.add(ship.group);
  ship.update(0);
  ship.group.updateMatrixWorld(true);

  // Hatch geometry, in the world.
  const shipM = ship.group.matrixWorld;
  const ex = ship.getHatchExit();
  const outW = ex.direction.clone().transformDirection(shipM).setY(0).normalize();
  const lipW = ex.top.clone().applyMatrix4(shipM);
  const exitW = ex.position.clone().applyMatrix4(shipM);
  const ladderFootW = exitW.clone().addScaledVector(outW, -0.35);
  ladderFootW.y = terrain.heightAt(ladderFootW.x, ladderFootW.z);
  exitW.y = terrain.heightAt(exitW.x, exitW.z);
  const faceShip = Math.atan2(-outW.x, -outW.z);
  const faceOut = Math.atan2(outW.x, outW.z);
  const standAtLadder = ladderFootW.clone().addScaledVector(outW, 0.32);
  // On the ladder she stands just outboard of the rungs, hands on the rails.
  // (0.07 out: at 0.15 she floated in front of the rails - critic shots.)
  const climbTop = lipW.clone().addScaledVector(outW, 0.07);
  const shipAxis = {
    a: new THREE.Vector3(0, 0, -3.6).applyMatrix4(shipM),
    b: new THREE.Vector3(0, 0, 3.2).applyMatrix4(shipM),
  };

  // Her.
  const walker = createWalker({ gravity: L.gravity });
  scene.add(walker.root);
  walker.helmetMat.uniforms.uGround.value.set(isMoon ? 0x6f6c68 : 0xc9ccd0).convertSRGBToLinear().multiplyScalar(isMoon ? 1.6 : 1.3);

  // Effects.
  const dust = createParticles({ max: 700, gravity: L.gravity, soft: 0.35, ground: (x, z) => terrain.heightAt(x, z) });
  const glitter = createParticles({ max: 900, gravity: L.gravity, additive: true, soft: 0.6, ground: (x, z) => terrain.heightAt(x, z) });
  const vapour = createParticles({ max: 260, gravity: L.gravity * 0.12, soft: 1, drag: 0.9 });
  scene.add(dust.points, glitter.points, vapour.points);
  const prints = createFootprints({ terrain, tint: isMoon ? 0xa39f98 : 0xd2dbe4 });
  scene.add(prints.mesh);
  const beacon = createBeacon({ color: isMoon ? 0x7ff0ff : 0x8fe8ff, height: 8 });
  beacon.setShown(false);
  scene.add(beacon.group);
  const trail = createGuideTrail({ terrain, color: 0x7ff6ff });
  scene.add(trail.mesh);

  const overlay = createOverlay({ mount: document.body });

  // Props per body.
  const colliders = [...terrain.colliders];
  let sample = null;
  let station = null;
  let rig = null;
  let hole = null;
  if (isMoon) {
    sample = createSampleRock();
    sample.group.position.set(L.sample.x, terrain.heightAt(L.sample.x, L.sample.z) + 0.07, L.sample.z);
    scene.add(sample.group);
    station = createOldStation({ terrain, at: L.station, lander: L.lander });
    scene.add(station.group);
    colliders.push(...station.colliders);
    // The old footprints: a grown-up's bigger boots, looping from the lander
    // to the instruments and back, with a detour to the crater rim.
    const r = rng(9);
    const path = [
      [L.lander.x + 1.2, L.lander.z + 1.0], [-11.5, -28.2], [L.station.x + 0.9, L.station.z + 0.6],
      [-15.5, -27], [-13, -24.2], [L.oldPrints.x + 0.4, L.oldPrints.z + 1.2], [-6.5, -27.5], [-4.4, -31.5],
      [-7, -33.5], [L.lander.x + 1.3, L.lander.z + 1.4],
    ];
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const len = curve.getLength();
    const n = Math.floor(len / 0.42);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const h = Math.atan2(t.x, t.z);
      const side = i % 2 ? 1 : -1;
      const px = p.x + Math.cos(h) * side * 0.13 + (r() - 0.5) * 0.04;
      const pz = p.z - Math.sin(h) * side * 0.13 + (r() - 0.5) * 0.04;
      prints.add(px, pz, h + (r() - 0.5) * 0.15, side, 1.28);
    }
  } else {
    rig = createDrillRig();
    const dy = terrain.heightAt(L.drill.x, L.drill.z);
    rig.group.position.set(L.drill.x, dy, L.drill.z);
    scene.add(rig.group);
    hole = createDrillHole();
    hole.mesh.position.set(L.drill.x, dy + 0.01, L.drill.z);
    scene.add(hole.mesh);
  }

  // ---------------------------------------------------------------------------
  // input
  // ---------------------------------------------------------------------------
  const debugKeys = new Set();
  const debugInput = { active: false, thrust: 0, turn: 0 };
  const isDown = (code) => debugKeys.has(code) || !!game.controls?.isDown?.(code);
  let prevE = false;
  let prevSpace = false;

  // ---------------------------------------------------------------------------
  // camera
  // ---------------------------------------------------------------------------
  const cam = {
    yaw: faceOut, pitch: 0.13, dist: 4.6,
    target: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    idle: 0,
    shake: 0,
  };
  // A cutscene shot: fn(t) -> { pos, look }, blended in over `blend` seconds.
  let shot = null;
  let shotW = 0;
  let shotWT = 0;
  const _cp = new THREE.Vector3();
  const _cl = new THREE.Vector3();

  function setShot(fn, blend = 0.9) { shot = { fn, t: 0 }; shotWT = 1; shotW = blend <= 0 ? 1 : shotW; shotBlend = blend; }
  let shotBlend = 0.9;
  function clearShot(blend = 1.0) { shotWT = 0; shotBlend = blend; }

  const _seg = new THREE.Vector3();
  function followCamera(dt, mouse, inputMove) {
    if (mouse) {
      cam.yaw -= mouse.dx * 0.0055;
      cam.pitch = clamp(cam.pitch + mouse.dy * 0.0042, -0.12, 1.05);
      if (mouse.wheel) cam.dist = clamp(cam.dist * Math.exp(mouse.wheel * 0.0012), 2.3, 11);
      if (mouse.dragging || mouse.dx || mouse.dy) cam.idle = 0;
    }
    cam.idle += dt;
    // Gentle auto-follow when she runs forward and the child is not steering the view.
    if (inputMove && inputMove.thrust > 0.5 && Math.abs(inputMove.turn) < 0.3 && cam.idle > 1.2) {
      cam.yaw += angDiff(walker.heading, cam.yaw) * Math.min(1, dt * 0.7);
    }
    const p = walker.pos;
    const ground = terrain.heightAt(p.x, p.z);
    const lift = p.y - ground;
    const ty = ground + 1.05 + lift * 0.55;
    cam.target.x += (p.x - cam.target.x) * Math.min(1, dt * 9);
    cam.target.z += (p.z - cam.target.z) * Math.min(1, dt * 9);
    cam.target.y += (ty - cam.target.y) * Math.min(1, dt * 4);
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    let dist = cam.dist;
    // Pull in rather than end up inside the ship: in small steps, and eased
    // (20% steps made the camera jump as she walked past the hull).
    for (let k = 0; k < 30; k++) {
      _seg.set(cam.target.x - fx * dist * Math.cos(cam.pitch), 0, cam.target.z - fz * dist * Math.cos(cam.pitch));
      if (distToShipAxis(_seg.x, _seg.z) > 1.5) break;
      dist *= 0.95;
    }
    if (cam.useDist === undefined) cam.useDist = dist;
    cam.useDist += (dist - cam.useDist) * Math.min(1, dt * (dist < cam.useDist ? 8 : 2.5));
    dist = cam.useDist;
    _cp.set(
      cam.target.x - fx * dist * Math.cos(cam.pitch),
      cam.target.y + 0.25 + dist * Math.sin(cam.pitch),
      cam.target.z - fz * dist * Math.cos(cam.pitch),
    );
    const gy = terrain.heightAt(_cp.x, _cp.z) + 0.45;
    if (_cp.y < gy) _cp.y = gy;
    // Look a little above her head so the horizon and the sky stay in frame.
    _cl.set(cam.target.x, cam.target.y + 0.55, cam.target.z);
    return { pos: _cp, look: _cl };
  }

  const _sp = new THREE.Vector3();
  const _sl = new THREE.Vector3();
  const _rigP = new THREE.Vector3();
  const _rigQ = new THREE.Vector3();
  let rigFade = 1;
  function updateCamera(dt, mouse, inputMove) {
    const f = followCamera(dt, mouse, inputMove);
    shotW += (shotWT - shotW) * Math.min(1, dt / Math.max(0.05, shotBlend) * 2.2);
    if (shotWT === 0 && shotW < 0.002) { shotW = 0; shot = null; }
    if (shot) {
      shot.t += dt;
      const s = shot.fn(shot.t);
      const k = easeInOut(clamp(shotW, 0, 1));
      _sp.copy(f.pos).lerp(s.pos, k);
      _sl.copy(f.look).lerp(s.look, k);
      if (s.fov) camera.fov = lerp(RENDER.fov, s.fov, k);
    } else {
      _sp.copy(f.pos);
      _sl.copy(f.look);
      camera.fov += (RENDER.fov - camera.fov) * Math.min(1, dt * 3);
    }
    cam.shake = Math.max(0, cam.shake - dt * 1.5);
    if (cam.shake > 0) {
      const t = clock * 40;
      _sp.x += Math.sin(t * 1.3) * 0.012 * cam.shake;
      _sp.y += Math.sin(t * 1.7 + 1) * 0.012 * cam.shake;
    }
    camera.position.copy(_sp);
    camera.lookAt(_sl);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function distToShipAxis(x, z) {
    const ax = shipAxis.a.x, az = shipAxis.a.z, bx = shipAxis.b.x, bz = shipAxis.b.z;
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  }

  // ---------------------------------------------------------------------------
  // collisions
  // ---------------------------------------------------------------------------
  const BODY_R = 0.24;
  let lastBoundsToast = -99;
  function collide(p, v) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const lim = c.r + BODY_R;
      if (Math.abs(dx) > lim || Math.abs(dz) > lim) continue;
      const d = Math.hypot(dx, dz);
      if (d < lim && d > 1e-5) {
        const nx = dx / d, nz = dz / d;
        p.x = c.x + nx * lim;
        p.z = c.z + nz * lim;
        const vn = v.x * nx + v.y * nz;
        if (vn < 0) { v.x -= vn * nx; v.y -= vn * nz; }
      }
    }
    // The ship's hull (a capsule; she can't fit under the belly).
    {
      const ax = shipAxis.a.x, az = shipAxis.a.z, bx = shipAxis.b.x, bz = shipAxis.b.z;
      const dx = bx - ax, dz = bz - az;
      const t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      const cx = ax + dx * t, cz = az + dz * t;
      const ox = p.x - cx, oz = p.z - cz;
      const d = Math.hypot(ox, oz);
      const lim = 1.25 + BODY_R;
      if (d < lim && d > 1e-5) {
        const nx = ox / d, nz = oz / d;
        p.x = cx + nx * lim;
        p.z = cz + nz * lim;
        const vn = v.x * nx + v.y * nz;
        if (vn < 0) { v.x -= vn * nx; v.y -= vn * nz; }
      }
    }
    // Stay near the ship: a soft wall, and a friendly word.
    const r = Math.hypot(p.x, p.z);
    if (r > L.bounds) {
      p.x *= L.bounds / r;
      p.z *= L.bounds / r;
      v.x *= 0.5; v.y *= 0.5;
      if (clock - lastBoundsToast > 8) {
        lastBoundsToast = clock;
        hud?.toast?.('That’s far enough from the ship. Head back toward your goal!', { kind: 'info', ms: 3200 });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // story plumbing: scene-clock waits
  // ---------------------------------------------------------------------------
  let clock = 0;
  const waiters = [];
  const wait = (sec) => new Promise((res) => waiters.push({ at: clock + sec, res }));
  const until = (pred) => new Promise((res) => waiters.push({ pred, res }));
  function runWaiters() {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if ((w.pred && w.pred()) || (!w.pred && clock >= w.at)) {
        waiters.splice(i, 1);
        w.res();
      }
    }
  }

  let busy = false;          // a beat/dialogue is running: she stands still
  let control = false;       // the child is steering her

  // Fun moves on the surface (the villages' H/J are the mission card and the
  // help here, so out on the Moon and Europa it is K, I and B). Walking or a
  // jump ends them; they wait while a beat, question or card is up.
  const FUN_KEYS = { KeyK: ['dance', 2], KeyI: ['splits', 1], KeyB: ['backWalkover', 1] };
  let funHint = 0;
  const onFunKey = (e) => {
    const m = FUN_KEYS[e.code];
    if (!m || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!control || busy || modal || !walker.onGround || scripted) return;
    walker.playOneShot(m[0], { loops: m[1], soft: true });
  };
  addEventListener('keydown', onFunKey);
  let disposed = false;
  let modal = false;
  async function beat(name) {
    if (!onBeat) return null;
    busy = true;
    try { return await onBeat(name); } catch (e) { console.error('surface beat', name, e); return null; } finally { busy = false; }
  }
  async function say(lines) {
    if (!hud?.showDialogue || skipTalk) return;
    busy = true;
    try { await hud.showDialogue(lines); } catch (e) { console.error(e); } finally { busy = false; }
  }
  let skipTalk = false;

  const STEPS = isMoon
    ? ['Take a big jump', 'Collect a rock sample', 'Find the old footprints', 'Back to the ship']
    : ['Walk to the crack', 'Drill through the ice', 'Could life live here?'];
  const ACT = isMoon ? 'Act 2: The Moon' : 'Finale: Europa';
  function mission(i, objective) {
    hud?.setMission?.({
      act: ACT,
      title: STEPS[Math.min(i, STEPS.length - 1)],
      objective,
      steps: STEPS.map((text, k) => ({ text, done: k < i })),
    });
  }

  // Current goal, for helpers: { x, z, label } or null.
  let goal = null;
  let goalBeaconOffset = 0;

  // ---------------------------------------------------------------------------
  // scripted motion helpers (cutscenes)
  // ---------------------------------------------------------------------------
  let scripted = null;   // fn(dt) run each frame instead of player control
  function runScripted(fn) {
    return new Promise((res) => { scripted = { fn, res, t: 0 }; });
  }

  /** Auto-walk to a point (used when she must line up with something). */
  function walkTo(x, z, { run = false, tol = 0.15 } = {}) {
    let arrived = false;
    return runScripted((dt, s) => {
      const dx = x - walker.pos.x, dz = z - walker.pos.z;
      const d = Math.hypot(dx, dz);
      const dir = new THREE.Vector2(dx, dz);
      if (arrived || d < tol || s.t > 8) {
        arrived = true;
        // Settle: bleed off the last of the speed without sliding past.
        walker.vel.multiplyScalar(Math.exp(-dt * 10));
        walker.move(dt, { dir: new THREE.Vector2(0, 0), run: false, jump: false, terrain, collide: () => {} });
        return Math.hypot(walker.vel.x, walker.vel.y) < 0.12;
      }
      dir.multiplyScalar(clamp(d / 0.45, 0.4, 1) / Math.max(d, 1e-4));
      walker.move(dt, { dir, run, jump: false, terrain, collide });
      return false;
    });
  }
  function turnTo(h, dur = 0.5) {
    const h0 = walker.heading;
    const d = angDiff(h, h0);
    return runScripted((dt, s) => {
      const k = easeTurn(clamp(s.t / dur, 0, 1));
      walker.heading = h0 + d * k;
      walker.pos.y = terrain.heightAt(walker.pos.x, walker.pos.z);
      return s.t >= dur;
    });
  }

  // --- the ladder ------------------------------------------------------------------
  // Lead (Oct 2): "getting off the ship is not very smooth". Every move here
  // now starts and ends at rest and overlaps the next: no position snaps
  // between the door and the ladder, a whole number of rungs (the old 4.5
  // ended the climb at full speed and stopped dead), slower turns, a real
  // walking step off the ladder, and a long camera hand-back.
  const RUNGS = 5;
  // Up on the door or the ladder: between two scripted moves (a frame, or a
  // pause) the idle step must not stand her on the ground below - it dropped
  // her there for a frame at every hand-over, and for the whole pause on the
  // platform.
  let perched = false;
  /** Rung by rung: speed pulses with the hand-over-hand rhythm, at rest at both ends. */
  const rungEase = (k) => {
    const phase = k * RUNGS;
    return { phase, e: (phase - Math.sin(phase * TAU) / TAU) / RUNGS };
  };
  /**
   * A couple of slow walking steps from where she stands to `goal` (real
   * strides and footprints), her heading eased from h0 to h1 meanwhile
   * (walker.move alone would spin her round in a few frames).
   */
  function stepTo(goal, h0, h1, dur) {
    const dh = angDiff(h1, h0);
    const dir = new THREE.Vector2();
    const noCollide = () => {};
    return runScripted((dt, s) => {
      const k = clamp(s.t / dur, 0, 1);
      const dx = goal.x - walker.pos.x, dz = goal.z - walker.pos.z;
      const d = Math.hypot(dx, dz);
      // Slow to a stop over the last half step instead of overshooting.
      if (d > 0.04 && k < 1) dir.set(dx, dz).multiplyScalar(clamp(d / 0.5, 0.25, 0.55) / d);
      else dir.set(0, 0);
      walker.move(dt, { dir, run: false, jump: false, terrain, collide: noCollide });
      walker.heading = h0 + dh * easeTurn(k);
      return k >= 1 && Math.hypot(walker.vel.x, walker.vel.y) < 0.1;
    });
  }

  async function climbDown() {
    ship.setHatch(true);
    // Establishing shot while the hatch opens: low, from the front quarter,
    // the ship on the left and the sky (Earth / Jupiter) filling the right.
    // It drifts slowly in for the whole climb-down, then hands over.
    const side = outW.clone();
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(shipM);
    const camA = lipW.clone().addScaledVector(side, 6.2).addScaledVector(fwd, 5.4);
    camA.y = terrain.heightAt(camA.x, camA.z) + 1.25;
    const camB = lipW.clone().addScaledVector(side, 3.4).addScaledVector(fwd, 2.3);
    camB.y = terrain.heightAt(camB.x, camB.z) + 1.5;
    const lookA = new THREE.Vector3(0, 0, 0).applyMatrix4(shipM).addScaledVector(fwd, -0.5);
    lookA.y += 1.2;
    // The look follows her smoothly (not her every bob on the rungs).
    const look = lookA.clone();
    let lookT = 0;
    setShot((tt) => {
      const k = easeInOut(clamp(tt / 11.5, 0, 1));
      const dt = Math.max(0, tt - lookT); lookT = tt;
      const want = lookA.clone().lerp(walker.pos.clone().setY(walker.pos.y + 0.9), smoothstep(2.5, 5.5, tt) * 0.85);
      look.lerp(want, Math.min(1, dt * 4));
      return { pos: camA.clone().lerp(camB, k), look };
    }, 0);
    // She waits inside while the door swings down.
    const inside = lipW.clone().addScaledVector(outW, -0.75);
    inside.y = lipW.y + 0.02;
    walker.place(inside.x, inside.y, inside.z, faceOut);
    walker.root.visible = false;
    perched = true;
    await wait(2.3);
    walker.root.visible = true;
    // Out onto the door platform, ducking under the frame.
    const plat = lipW.clone().addScaledVector(outW, -0.12);
    plat.y = lipW.y + 0.02;
    // A light duck under the frame (the full 0.7 crouch read as sitting).
    walker.overlay.crouch = 0.4;
    await runScripted((dt, s) => {
      const k = easeInOut(clamp(s.t / 1.3, 0, 1));
      walker.pos.lerpVectors(inside, plat, k);
      if (k > 0.5) walker.overlay.crouch = 0; // stand up as she clears the frame
      return s.t >= 1.3;
    });
    // Turn round to face the ship while easing out onto the top of the
    // ladder, hands reaching for the rails (one move, no snap between them).
    const from = climbTop.clone();
    from.y = lipW.y - 0.05;
    const dh = angDiff(faceShip, faceOut);
    await runScripted((dt, s) => {
      const k = clamp(s.t / 2.0, 0, 1); // half a turn in 2 s: under 2.5 rad/s
      walker.heading = faceOut + dh * easeTurn(k);
      walker.pos.lerpVectors(plat, from, easeInOut(smoothstep(0.25, 1, k)));
      if (k > 0.45) walker.overlay.climb = 1;
      return k >= 1;
    });
    const to = ladderFootW.clone().addScaledVector(outW, 0.1);
    to.y = ladderFootW.y;
    const CLIMB = 3.6;
    await runScripted((dt, s) => {
      const k = clamp(s.t / CLIMB, 0, 1);
      const { phase, e } = rungEase(k);
      walker.setClimbPhase(phase);
      walker.pos.lerpVectors(from, to, e);
      // Hands come off the rails over the last rung, as her boots find the ground.
      if (k > 0.86) walker.overlay.climb = 0;
      return s.t >= CLIMB;
    });
    walker.overlay.climb = 0;
    perched = false;
    // Hand the camera back while she steps off, so the two moves overlap.
    // The follow camera starts from where the shot camera already is (same
    // side, same distance): handing over to a fixed "behind her" view swung
    // it round the hull at 9 u/s.
    const hx = walker.pos.x - camera.position.x, hz = walker.pos.z - camera.position.z;
    cam.yaw = Math.atan2(hx, hz);
    cam.pitch = 0.18;
    cam.dist = clamp(Math.hypot(hx, hz) / Math.cos(cam.pitch), 3.2, 6);
    cam.useDist = cam.dist;
    cam.idle = 0;
    cam.target.copy(walker.pos).setY(walker.pos.y + 1.05);
    clearShot(2.2);
    // Two slow steps away from the ladder, turning round as she goes.
    const off = to.clone().addScaledVector(outW, 0.75);
    await stepTo(off, faceShip, faceOut, 2.0);
    // First step on the ground: little puffs under her boots.
    puff(walker.pos.x, walker.pos.y, walker.pos.z, 10, 0.6);
  }

  async function climbUp() {
    await walkTo(standAtLadder.x, standAtLadder.z);
    await turnTo(faceShip, 0.9);
    const from = walker.pos.clone();
    const to = climbTop.clone();
    to.y = lipW.y - 0.05;
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(shipM);
    const cp = lipW.clone().addScaledVector(outW, 4.6).addScaledVector(fwd, 2.6);
    cp.y = terrain.heightAt(cp.x, cp.z) + 1.9;
    const look = walker.pos.clone().setY(walker.pos.y + 0.8);
    let lookT = 0;
    setShot((tt) => {
      const dt = Math.max(0, tt - lookT); lookT = tt;
      look.lerp(walker.pos.clone().setY(walker.pos.y + 0.8), Math.min(1, dt * 4));
      return { pos: cp, look };
    }, 1.4);
    walker.overlay.climb = 1;
    perched = true;
    await wait(0.35); // hands on the rails before the first rung
    const CLIMB = 3.6;
    await runScripted((dt, s) => {
      const k = clamp(s.t / CLIMB, 0, 1);
      const { phase, e } = rungEase(k);
      walker.setClimbPhase(-phase);
      walker.pos.lerpVectors(from, to, e);
      return s.t >= CLIMB;
    });
    // Over the top onto the door platform, then duck inside: one smooth move.
    const plat = lipW.clone().addScaledVector(outW, -0.12);
    plat.y = lipW.y + 0.02;
    const inside = lipW.clone().addScaledVector(outW, -0.75);
    inside.y = lipW.y + 0.02;
    await runScripted((dt, s) => {
      const k = clamp(s.t / 0.8, 0, 1);
      walker.pos.lerpVectors(to, plat, easeInOut(k));
      if (k > 0.5) walker.overlay.climb = 0;
      return k >= 1;
    });
    walker.overlay.climb = 0;
    walker.overlay.crouch = 0.4;
    await runScripted((dt, s) => {
      const k = easeInOut(clamp(s.t / 1.1, 0, 1));
      walker.pos.lerpVectors(plat, inside, k);
      return s.t >= 1.1;
    });
    walker.root.visible = false;
    walker.overlay.crouch = 0;
    ship.setHatch(false);
    await wait(2.6);
    perched = false;
  }

  // ---------------------------------------------------------------------------
  // effects helpers
  // ---------------------------------------------------------------------------
  const R = rng(77);
  const dustCol = isMoon ? [0.2, 0.195, 0.19, 0.85] : [0.62, 0.66, 0.7, 0.75];
  function puff(x, y, z, n, strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const sp = (0.35 + R() * 1.1) * strength;
      const up = (0.4 + R() * 1.0) * strength;
      dust.emit({ x: x + Math.cos(a) * 0.08, y: y + 0.02, z: z + Math.sin(a) * 0.08 },
        { x: Math.cos(a) * sp, y: up, z: Math.sin(a) * sp }, dustCol, 0.035 + R() * 0.05, 1.4 + R() * 1.2, 0.02);
      if (!isMoon && R() < 0.5) {
        glitter.emit({ x, y: y + 0.03, z }, { x: Math.cos(a) * sp * 0.8, y: up * 1.1, z: Math.sin(a) * sp * 0.8 },
          [1.6, 1.8, 2.1, 1], 0.012 + R() * 0.012, 1.0 + R() * 1.2, 0, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // the stories
  // ---------------------------------------------------------------------------
  const flags = { bigJump: false, pickedUp: false };
  let samples = [];
  let finishResolve;
  const finished = new Promise((res) => { finishResolve = res; });
  let started = false;
  let promptState = null;   // { at: Vector3, text, progress }

  async function storyMoon() {
    mission(0, 'Climbing down to the Moon…');
    if (!skipIntro) await climbDown();
    else placeAtLadder();
    control = true;
    await say([
      { who: 'girl', text: t('I’m standing on the Moon! Everything is grey, and the sky is black even in the daytime.', 'I’m on the Moon! It is all grey. The sky is black, even in the day.') },
      { who: 'Mission Control', text: t('The Moon pulls on you six times more weakly than Earth does. Try a big jump: press Space!', 'The Moon pulls on you much less than Earth. Try a big jump: press Space!') },
    ]);
    mission(0, t('Press Space to take a big jump. (W A S D to walk, Shift to bound, drag to look around.)', 'Press Space to jump high! (W A S D to walk.)'));
    await until(() => flags.bigJump);
    await wait(0.8);
    await beat('moonWalk');

    mission(1, 'Walk to the glowing rock and press E to pick it up.');
    goal = { x: L.sample.x, z: L.sample.z };
    const near = () => Math.hypot(walker.pos.x - L.sample.x, walker.pos.z - L.sample.z) < 1.5 * capture;
    await until(() => {
      const ok = near() && walker.onGround && !busy;
      promptState = ok ? { at: sample.group.position, text: 'Pick up the rock' } : null;
      return ok && pressedE;
    });
    promptState = null;
    goal = null;
    await pickUpSample();
    samples.push('Moon rock');
    await beat('moonSample');

    mission(2, 'Find the old footprints near the crater.');
    goal = { x: L.oldPrints.x, z: L.oldPrints.z };
    await until(() => Math.hypot(walker.pos.x - L.oldPrints.x, walker.pos.z - L.oldPrints.z) < 4.2 * capture && walker.onGround);
    goal = null;
    control = false;
    const pc = new THREE.Vector3(L.oldPrints.x, terrain.heightAt(L.oldPrints.x, L.oldPrints.z), L.oldPrints.z);
    const cpos = walker.pos.clone().lerp(pc, 0.35);
    const toP = new THREE.Vector3().subVectors(pc, walker.pos).setY(0).normalize();
    cpos.addScaledVector(toP, -2.2).add(new THREE.Vector3(toP.z, 0, -toP.x).multiplyScalar(1.6));
    cpos.y = terrain.heightAt(cpos.x, cpos.z) + 2.3;
    await turnTo(Math.atan2(toP.x, toP.z), 0.5);
    setShot(() => ({ pos: cpos, look: pc.clone().lerp(walker.pos, 0.3).setY(pc.y + 0.25) }), 1.0);
    say([{ who: 'girl', text: 'Footprints! Big ones, from a grown-up astronaut. They look like they were made yesterday.' }]);
    await wait(2.2);
    await until(() => !busy);
    await beat('moonFootprints');
    clearShot(1.0);
    control = true;

    mission(3, 'Walk back to the ladder and press E to climb aboard.');
    goal = { x: standAtLadder.x, z: standAtLadder.z };
    await until(() => {
      const ok = Math.hypot(walker.pos.x - standAtLadder.x, walker.pos.z - standAtLadder.z) < 1.7 * capture && walker.onGround && !busy;
      promptState = ok ? { at: lipW.clone().setY(ladderFootW.y + 1.2), text: 'Climb aboard' } : null;
      return ok && pressedE;
    });
    promptState = null;
    goal = null;
    control = false;
    await climbUp();
    mission(4, 'Back aboard. Next stop: Mars!');
    finishResolve({ samples: [...samples] });
  }

  async function pickUpSample() {
    control = false;
    const s = L.sample;
    const toR = Math.atan2(s.x - walker.pos.x, s.z - walker.pos.z);
    // Stand just short of it, facing it.
    const stand = new THREE.Vector3(s.x - Math.sin(toR) * 0.34, 0, s.z - Math.cos(toR) * 0.34);
    await walkTo(stand.x, stand.z, { tol: 0.12 });
    const p0 = walker.pos.clone();
    const h0 = walker.heading;
    const h1 = Math.atan2(s.x - stand.x, s.z - stand.z);
    await runScripted((dt, st) => {
      const k = easeInOut(clamp(st.t / 0.35, 0, 1));
      walker.pos.x = lerp(p0.x, stand.x, k);
      walker.pos.z = lerp(p0.z, stand.z, k);
      walker.pos.y = terrain.heightAt(walker.pos.x, walker.pos.z);
      walker.heading = h0 + angDiff(h1, h0) * k;
      return k >= 1;
    });
    // A close, side-on camera for the moment, on her sunlit side.
    const f = new THREE.Vector3(Math.sin(walker.heading), 0, Math.cos(walker.heading));
    const left = new THREE.Vector3(f.z, 0, -f.x);
    if (left.dot(sunDir) < 0) left.negate();
    const cpos = walker.pos.clone().addScaledVector(f, 0.7).addScaledVector(left, 2.1);
    cpos.y = terrain.heightAt(cpos.x, cpos.z) + 0.95;
    // A cut, not a blend: a straight-line blend from the follow camera to a
    // side-on close-up sweeps through her helmet.
    setShot(() => ({ pos: cpos, look: walker.pos.clone().addScaledVector(f, 0.3).setY(walker.pos.y + 0.5) }), 0);
    walker.overlay.crouch = 0.85;
    walker.overlay.reach = 1;
    await wait(0.75);
    // Into her hand.
    walker.hand.attach(sample.group);
    sample.group.position.set(0, -0.08, 0.03);
    walker.overlay.reach = 0;
    walker.overlay.crouch = 0;
    await wait(0.7);
    // Up to have a look (the crystals glint), then over the shoulder into the pack.
    walker.overlay.lookUp = 0;
    await wait(0.5);
    scene.attach(sample.group);
    const a = sample.group.position.clone();
    const startScale = sample.group.scale.x;
    await runScripted((dt, st) => {
      const k = clamp(st.t / 0.75, 0, 1);
      const b = new THREE.Vector3();
      walker.packSlot.getWorldPosition(b);
      const p = a.clone().lerp(b, easeInOut(k));
      p.y += Math.sin(k * Math.PI) * 0.45;
      sample.group.position.copy(p);
      sample.group.scale.setScalar(startScale * (1 - 0.8 * k));
      sample.group.rotation.x += dt * 6;
      if (k >= 1) {
        for (let i = 0; i < 30; i++) {
          const d = new THREE.Vector3().randomDirection().multiplyScalar(0.4 + R() * 0.8);
          glitter.emit(b, d, [0.8, 1.9, 2.4, 1], 0.012 + R() * 0.01, 0.6 + R() * 0.5);
        }
      }
      return k >= 1;
    });
    sample.group.visible = false;
    hud?.toast?.('Moon rock sample stowed in your backpack!', { kind: 'good', ms: 3200 });
    clearShot(0.05);
    control = true;
  }

  // --- Europa ------------------------------------------------------------------------
  const drill = { progress: 0, drilling: false, done: false, atRig: false };

  async function storyEuropa() {
    mission(0, 'Climbing down onto Europa…');
    if (!skipIntro) await climbDown();
    else placeAtLadder();
    // "Look at JUPITER": first turn the camera out past her to the giant
    // (from the ladder it faced the ship, and Jupiter was off screen for that
    // line - play-test). Low, so the dialogue card sits under Jupiter, not on
    // it; afterwards the follow camera keeps facing that way (the crack too).
    const jdir = skyDir(L.jupiter.az, 0);
    const jpos = walker.pos.clone().addScaledVector(jdir, -3.4).addScaledVector(outW, 1.4);
    jpos.y = terrain.heightAt(jpos.x, jpos.z) + 1.0;
    const jlook = jpos.clone().addScaledVector(skyDir(L.jupiter.az, 4), 10);
    setShot(() => ({ pos: jpos, look: jlook }), 1.3);
    await wait(1.6);
    await say([
      { who: 'girl', text: 'Europa! The ice goes on forever… and look at JUPITER. It fills half the sky!' },
      { who: 'Mission Control', text: t('You made it, explorer. See the glowing crack in the ice? Walk over to it. That’s where we’ll drill.', 'You made it! See the glowing crack in the ice? Walk to it. We will drill there.') },
    ]);
    cam.yaw = Math.atan2(jdir.x, jdir.z);
    clearShot(1.3);
    control = true;
    mission(0, 'Walk to the glowing crack in the ice.');
    goal = { x: L.drill.x, z: L.drill.z };
    const start = walker.pos.clone();
    await until(() => (walker.pos.distanceTo(start) > 7 || Math.hypot(walker.pos.x - L.drill.x, walker.pos.z - L.drill.z) < 9) && walker.onGround);
    await wait(0.3);
    await beat('europaWalk');

    mission(1, 'At the crack, hold E to drill through the ice.');
    await until(() => {
      const d = Math.hypot(walker.pos.x - L.drill.x, walker.pos.z - L.drill.z);
      const ok = d < 2.1 * capture && walker.onGround && !busy;
      promptState = ok ? { at: new THREE.Vector3(L.drill.x, terrain.heightAt(L.drill.x, L.drill.z) + 0.6, L.drill.z), text: 'Hold E to drill' } : null;
      return ok && isDown('KeyE');
    });
    goal = null;
    await startDrilling();
    await until(() => drill.done);
    await breakthrough();
    await beat('drillResult');
    await finale();
    finishResolve({ samples: ['Europa ocean water'] });
  }

  async function startDrilling() {
    control = false;
    const D = L.drill;
    // Where she stands: back from the rig along her approach.
    const away = Math.atan2(walker.pos.x - D.x, walker.pos.z - D.z);
    const stand = new THREE.Vector3(D.x + Math.sin(away) * 0.62, 0, D.z + Math.cos(away) * 0.62);
    rig.open();
    hole.setOpen(0.2);
    await walkTo(stand.x, stand.z, { tol: 0.1 });
    await turnTo(Math.atan2(D.x - walker.pos.x, D.z - walker.pos.z), 0.35);
    drill.atRig = true;
    walker.overlay.drill = 1;
    // Look past her and the rig toward Jupiter: the camera stands on the far
    // side from the giant, a little to her side, so she, the drill and
    // Jupiter share the frame.
    const jd = skyDir(L.jupiter.az, 0);
    const perp = new THREE.Vector3(-jd.z, 0, jd.x);
    if (perp.dot(new THREE.Vector3(walker.pos.x - D.x, 0, walker.pos.z - D.z)) < 0) perp.negate();
    const cpos = new THREE.Vector3(D.x, 0, D.z).addScaledVector(jd, -4.1).addScaledVector(perp, 2.2);
    cpos.y = terrain.heightAt(cpos.x, cpos.z) + 1.35;
    const look = new THREE.Vector3(D.x, terrain.heightAt(D.x, D.z) + 1.9, D.z).addScaledVector(perp, 0.3);
    setShot(() => ({ pos: cpos, look }), 0);
  }

  async function breakthrough() {
    promptState = null;
    drill.atRig = false;
    walker.overlay.drill = 0;
    hole.setOpen(1);
    hole.setWater(1);
    cam.shake = 1.2;
    // Step back to watch.
    const D = L.drill;
    const away = Math.atan2(walker.pos.x - D.x, walker.pos.z - D.z);
    const back = new THREE.Vector3(walker.pos.x + Math.sin(away) * 1.0, 0, walker.pos.z + Math.cos(away) * 1.0);
    plumeT = 0;
    const f = new THREE.Vector3(Math.sin(away), 0, Math.cos(away));
    const rgt = new THREE.Vector3(f.z, 0, -f.x);
    const hy = terrain.heightAt(D.x, D.z);
    // Looking toward Jupiter so the plume rises in front of it (and the
    // giant sits near the middle of the frame, not stretched at an edge).
    const jd = skyDir(L.jupiter.az, 0);
    const perp = new THREE.Vector3(-jd.z, 0, jd.x);
    if (perp.dot(f) < 0) perp.negate();
    const cpos = new THREE.Vector3(D.x, 0, D.z).addScaledVector(jd, -6.2).addScaledVector(perp, 1.6);
    cpos.y = terrain.heightAt(cpos.x, cpos.z) + 1.1;
    const lookBase = new THREE.Vector3(D.x, hy, D.z).addScaledVector(jd, 4).addScaledVector(perp, -0.8);
    setShot((t) => ({
      pos: cpos.clone().addScaledVector(jd, -t * 0.1),
      look: lookBase.clone().setY(hy + 2.3 + Math.min(0.9, t * 0.25)),
    }), 0);
    void rgt;
    await walkTo(back.x, back.z);
    await turnTo(Math.atan2(D.x - walker.pos.x, D.z - walker.pos.z), 0.4);
    walker.overlay.lookUp = 0.6;
    say([{ who: 'girl', text: 'WATER! Liquid water, from under the ice! It’s boiling and freezing at the same time!' }]);
    await wait(3.2);
    await until(() => !busy);
    walker.overlay.lookUp = 0;
  }

  let plumeT = -1;

  async function finale() {
    mission(2, t('Habitability check: could life live on Europa?', 'Could anything live on Europa?'));
    // Frame her, the plume and Jupiter.
    const D = L.drill;
    overlay.startChecklist([
      { text: 'Liquid water', sub: t('Salty ocean under the ice', 'Salty water under the ice') },
      { text: 'Energy', sub: t('Jupiter’s squeezing keeps it warm', 'Jupiter squeezes it warm') },
      { text: t('The right chemicals', 'The right food'), sub: t('Salts and minerals from the rocky floor', 'Salt and bits of rock from the floor') },
    ], t('Europa could be habitable!', 'Life could live on Europa!'));
    const len = overlay.checklistLength(3);
    await wait(len - 1.0);
    walker.playOneShot('cheer', { loops: 5 });
    cam.shake = 0.3;
    // Pull back and up: her, the ship and Jupiter together.
    const p0 = camera.position.clone();
    const l0 = new THREE.Vector3();
    camera.getWorldDirection(l0);
    l0.multiplyScalar(5).add(camera.position);
    // End frame: behind and to the right of the ship, looking out past it -
    // the ship big on the left, her small in the middle at the crack, Jupiter
    // filling the sky above her. (The ship, the drill spot and Jupiter all
    // lie roughly along -Z, which is what makes this frame possible.)
    const p1 = new THREE.Vector3(7.5, 0, 9);
    p1.y = terrain.heightAt(p1.x, p1.z) + 3.0;
    const l1 = p1.clone().addScaledVector(skyDir(-24, 11), 30);
    setShot((t) => {
      const k = easeInOut(clamp(t / 7, 0, 1));
      // Rise as it goes, so the path clears the ship.
      const p = p0.clone().lerp(p1, k);
      p.y += Math.sin(k * Math.PI) * 2.5;
      return { pos: p, look: l0.clone().lerp(l1, k), fov: lerp(RENDER.fov, 60, k) };
    }, 0);
    shadowHalf = SHADOW_BOX.far;
    await wait(8.5);
  }

  function placeAtLadder() {
    ship.setHatch(true, true);
    const p = standAtLadder.clone().addScaledVector(outW, 0.4);
    walker.place(p.x, terrain.heightAt(p.x, p.z), p.z, faceOut);
    cam.yaw = faceOut + 0.5;
    cam.target.copy(walker.pos).setY(walker.pos.y + 1.05);
  }

  // ---------------------------------------------------------------------------
  // per-frame
  // ---------------------------------------------------------------------------
  let pressedE = false;
  const _move = new THREE.Vector2();
  const _pw = new THREE.Vector3();
  const _proj = new THREE.Vector3();
  let skipIntro = false;

  function tick(dt, input, mouse, modalOpen = false) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    modal = !!modalOpen;
    const eDown = !modal && isDown('KeyE');
    pressedE = eDown && !prevE;
    prevE = eDown;
    const inp = debugInput.active ? debugInput : input || { thrust: 0, turn: 0, precision: false, steady: false };
    const spaceDown = !modal && (isDown('Space') || !!inp.steady || debugKeys.has('Jump'));
    const jumpPressed = spaceDown && !prevSpace;
    prevSpace = spaceDown;

    // --- her ---
    let speed = 0;
    if (scripted) {
      scripted.t += dt;
      const done = scripted.fn(dt, scripted);
      speed = Math.hypot(walker.vel.x, walker.vel.y);
      if (done) { const r = scripted.res; scripted = null; r(); }
    } else if (control && !busy && !modal) {
      const f = { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
      const rt = { x: -f.z, z: f.x };
      const th = inp.thrust || 0;
      const tu = inp.turn || 0;
      _move.set(f.x * th + rt.x * tu, f.z * th + rt.z * tu);
      if (_move.lengthSq() > 1) _move.normalize();
      const run = !!inp.precision || isDown('ShiftLeft') || isDown('ShiftRight') || debugKeys.has('Run');
      speed = walker.move(dt, { dir: _move, run, jump: jumpPressed, terrain, collide });
    } else if (!perched) {
      _move.set(0, 0);
      speed = walker.move(dt, { dir: _move, run: false, jump: false, terrain, collide });
    }
    // Drilling (Europa), while she's at the rig.
    if (drill.atRig && !drill.done) {
      drill.drilling = !modal && isDown('KeyE');
      if (drill.drilling) {
        drill.progress = Math.min(1, drill.progress + dt / 6.5);
        cam.shake = Math.max(cam.shake, 0.35);
        const hy = terrain.heightAt(L.drill.x, L.drill.z);
        // Ice cuttings: a low fountain round the bit that piles up by the hole.
        const n = Math.round(dt * 70 + R());
        for (let i = 0; i < n; i++) {
          const a = R() * TAU;
          const sp = 0.25 + R() * 0.7;
          const col = R() < 0.7 ? [0.8, 0.86, 0.92, 0.95] : [0.55, 0.4, 0.3, 0.9];
          dust.emit({ x: L.drill.x + Math.cos(a) * 0.05, y: hy + 0.04, z: L.drill.z + Math.sin(a) * 0.05 },
            { x: Math.cos(a) * sp, y: 0.5 + R() * 1.1, z: Math.sin(a) * sp }, col, 0.012 + R() * 0.016, 1.4 + R(), 0);
          if (R() < 0.3) glitter.emit({ x: L.drill.x, y: hy + 0.05, z: L.drill.z }, { x: Math.cos(a) * sp * 0.6, y: 0.7 + R() * 1.2, z: Math.sin(a) * sp * 0.6 }, [1.8, 2, 2.3, 1], 0.008, 1.2, 0, 1);
        }
        if (drill.progress >= 1) {
          drill.done = true;
          drill.drilling = false;
        }
      }
      walker.setDrillShake(drill.drilling ? 1 : 0);
      promptState = drill.done ? null : {
        at: new THREE.Vector3(L.drill.x, terrain.heightAt(L.drill.x, L.drill.z) + 1.9, L.drill.z),
        text: drill.drilling ? 'Drilling… keep holding E' : 'Hold E to drill',
        progress: drill.progress,
      };
    }
    // Events from her motion: footprints, dust, jumps.
    for (const e of walker.events.splice(0)) {
      if (e.type === 'step') {
        prints.add(e.x, e.z, e.heading, e.side);
        puff(e.x, e.y, e.z, e.big ? 7 : 3, e.big ? 0.8 : 0.45);
      } else if (e.type === 'takeoff') {
        puff(e.x, e.y, e.z, 12, 0.7);
      } else if (e.type === 'land') {
        const c = Math.cos(e.heading), s = Math.sin(e.heading);
        prints.add(e.x + c * 0.1, e.z - s * 0.1, e.heading, 1);
        prints.add(e.x - c * 0.1, e.z + s * 0.1, e.heading, -1);
        puff(e.x, e.y, e.z, e.height > 0.8 ? 34 : 14, e.height > 0.8 ? 1.2 : 0.7);
        if (e.height > 1.0 && control) {
          flags.bigJump = true;
          hud?.toast?.(`Wow! ${e.height.toFixed(1)} metres high, and ${e.airTime.toFixed(1)} seconds in the air!`, { kind: 'good', ms: 3200 });
        }
      }
    }
    walker.sync();
    walker.animate(dt, speed);
    if (control && funHint >= 0 && !busy && !modal) {
      funHint += dt;
      if (funHint > 8) {
        funHint = -1;
        hud?.toast?.(`Fun moves on ${isMoon ? 'the Moon' : 'Europa'}: try K, I and B!`, { kind: 'info', ms: 4000 });
      }
    }

    // --- props ---
    ship.update(dt);
    sample?.update(dt);
    if (rig) {
      rig.update(dt, { drilling: drill.drilling, progress: drill.progress, done: drill.done });
      hole.update(dt);
    }
    if (plumeT >= 0) updatePlume(dt);

    // --- helpers: beacon / trail by mode ---
    let showBeacon = false;
    if (goal && control && !busy) {
      const d = Math.hypot(walker.pos.x - goal.x, walker.pos.z - goal.z);
      showBeacon = mode.id === 'hard' ? d < 15 : true;
      beacon.group.position.set(goal.x, terrain.heightAt(goal.x, goal.z) + goalBeaconOffset, goal.z);
      if (d < 1.2) showBeacon = false;
    } else if (!isMoon && !drill.done && control === false && drill.atRig) {
      showBeacon = false;
    }
    beacon.setShown(showBeacon);
    beacon.update(dt);
    trail.update(dt, walker.pos, goal, mode.id === 'easy' && !!goal && control && !busy);

    // --- camera, sky, terrain uniforms ---
    updateCamera(dt, modal ? null : mouse, control && !busy ? inp : null);
    // The drill rig hid her when it stood between her and the camera
    // (play-test): it goes see-through while it does.
    if (rig?.group.visible) {
      const rx = L.drill.x, rz = L.drill.z, ry = terrain.heightAt(rx, rz) + rig.headY * 0.7;
      _rigP.set(walker.pos.x, walker.pos.y + 0.9, walker.pos.z).sub(camera.position);
      const len = _rigP.length();
      _rigQ.set(rx, ry, rz).sub(camera.position);
      const along = _rigQ.dot(_rigP) / Math.max(1e-6, len);
      const off = Math.sqrt(Math.max(0, _rigQ.lengthSq() - along * along));
      const blocks = along > 0.3 && along < len - 0.15 && off < 0.75;
      rigFade += ((blocks ? 0.28 : 1) - rigFade) * Math.min(1, dt * 6);
      rig.setFade(rigFade);
    }
    const focus = walker.pos;
    const snap = (shadowHalf * 2) / sun.shadow.mapSize.x;
    const cx = Math.round(focus.x / snap) * snap;
    const cz = Math.round(focus.z / snap) * snap;
    sun.target.position.set(cx, terrain.heightAt(cx, cz), cz);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 120);
    if (sun.shadow.camera.right !== shadowHalf) setShadowBox(shadowHalf);
    terrain.update(dt, camera, sunDir);
    sky.update({ camera, sunDirection: sunDir });
    // Seen from the ground of an airless world in daylight the sky is black:
    // keep the stars, drop the flight sky's warm haze and dim the Milky Way.
    if (skyU) {
      skyU.uHazeStrength.value = 0;
      skyU.uZodiacalStrength.value = 0;
      skyU.uMilkyWayStrength.value = 0.07;
    }
    skyBodies.update(dt, camera);
    walker.helmetMat.uniforms.uSunDir.value.copy(sunDir);
    const vh = renderer.domElement.clientHeight || size.y || 900;
    dust.update(dt, camera, vh);
    glitter.update(dt, camera, vh);
    vapour.update(dt, camera, vh);

    // --- overlay ---
    const cw = renderer.domElement.clientWidth || size.x;
    const ch = renderer.domElement.clientHeight || size.y;
    overlay.resize(cw, ch, Math.min(2, window.devicePixelRatio || 1));
    if (promptState && !modal) {
      _pw.copy(promptState.at);
      _pw.y += 0.35;
      _proj.copy(_pw).project(camera);
      if (_proj.z < 1) {
        overlay.showPrompt((_proj.x * 0.5 + 0.5) * cw, (-_proj.y * 0.5 + 0.5) * ch, promptState.text, { progress: promptState.progress ?? -1 });
      } else overlay.hidePrompt();
    } else overlay.hidePrompt();
    overlay.draw(dt);

    runWaiters();
  }

  function updatePlume(dt) {
    plumeT += dt;
    const D = L.drill;
    const hy = terrain.heightAt(D.x, D.z);
    const rate = plumeT < 0.4 ? plumeT / 0.4 : plumeT < 5 ? 1 : Math.max(0, 1 - (plumeT - 5) / 4) * 0.55 + 0.1;
    // Droplets flung up that freeze into glittering grains.
    const nDrop = Math.round(rate * 110 * dt + R());
    for (let i = 0; i < nDrop; i++) {
      const a = R() * TAU;
      const sp = R() * 0.55;
      const v = 3.2 + R() * 3.4 * rate;
      glitter.emit({ x: D.x + Math.cos(a) * 0.06, y: hy + 0.05, z: D.z + Math.sin(a) * 0.06 },
        { x: Math.cos(a) * sp, y: v, z: Math.sin(a) * sp },
        R() < 0.5 ? [0.7, 1.4, 2.4, 1] : [1.6, 1.9, 2.3, 1], 0.014 + R() * 0.022, 2.6 + R() * 1.6, 0, 1);
    }
    // Vapour: boiling off in the vacuum, spreading and fading.
    const nVap = Math.round(rate * 20 * dt + R() * 0.8);
    for (let i = 0; i < nVap; i++) {
      const a = R() * TAU;
      const sp = 0.25 + R() * 0.8;
      vapour.emit({ x: D.x, y: hy + 0.15, z: D.z }, { x: Math.cos(a) * sp, y: 1.4 + R() * 2.4, z: Math.sin(a) * sp },
        [0.72, 0.82, 0.92, 0.085 + R() * 0.05], 0.12 + R() * 0.12, 1.8 + R() * 1.4, 0.55);
    }
    // A bright, narrow jet right at the hole.
    const nJet = Math.round(rate * 60 * dt + R());
    for (let i = 0; i < nJet; i++) {
      const a = R() * TAU;
      glitter.emit({ x: D.x, y: hy + 0.05, z: D.z }, { x: Math.cos(a) * 0.12, y: 1.5 + R() * 2.5 * rate, z: Math.sin(a) * 0.12 },
        [0.9, 1.6, 2.6, 0.9], 0.025 + R() * 0.02, 0.6 + R() * 0.5, 0, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // contract
  // ---------------------------------------------------------------------------
  function start() {
    if (!started) {
      started = true;
      const run = isMoon ? storyMoon : storyEuropa;
      run().catch((e) => {
        console.error('surface story', e);
        finishResolve({ samples: [...samples], error: String(e?.message || e) });
      });
    }
    return finished;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeEventListener('keydown', onFunKey);
    renderer.shadowMap.enabled = prevShadow.enabled;
    renderer.shadowMap.type = prevShadow.type;
    overlay.dispose();
    terrain.dispose();
    sky.dispose();
    skyBodies.dispose();
    ship.dispose();
    walker.dispose();
    dust.dispose(); glitter.dispose(); vapour.dispose();
    prints.dispose();
    beacon.dispose();
    trail.dispose();
    sample?.dispose();
    station?.dispose();
    rig?.dispose();
    hole?.dispose();
    sun.shadow.map?.dispose();
  }

  // Resolve the first camera before anything renders.
  placeAtLadder();
  ship.setHatch(false, true);
  updateCamera(0, null, null);

  // Debug / lab handle. Not used by the game.
  const debug = {
    get clock() { return clock; },
    walker, terrain, ship, cam, overlay, drill, flags, L, beacon,
    /** Where she stands to climb aboard (the lab walks her there). */
    get ladder() { return { x: standAtLadder.x, z: standAtLadder.z }; },
    /** Skip the climb-down and dialogue: she starts at the ladder with control. */
    skipIntro() { skipIntro = true; skipTalk = true; },
    quiet() { skipTalk = true; },
    /** End the walk now (lab: back to flight without playing it through). */
    finish() { finishResolve({ samples: [...samples] }); },
    place(x, z, heading) {
      walker.place(x, terrain.heightAt(x, z), z, heading ?? walker.heading);
      cam.target.copy(walker.pos).setY(walker.pos.y + 1.05);
    },
    setInput(o) { debugInput.active = true; Object.assign(debugInput, { thrust: 0, turn: 0, precision: false, steady: false }, o); },
    clearInput() { debugInput.active = false; },
    key(code, down) { if (down) debugKeys.add(code); else debugKeys.delete(code); },
    setCam(o) { Object.assign(cam, o); },
    shot(fn, blend = 0) { setShot(fn, blend); },
    clearShot,
    ready: Promise.all([terrain.ready, sky.ready, skyBodies.ready]),
  };

  return { scene, camera, start, tick, dispose, ready: debug.ready, debug };
}
