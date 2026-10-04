// Dev-only: trace the banner frame by frame while the autopilot flies a step.
//   const T = await import('/src/space/lab/landtrace.js');
//   await T.trace('a2_land', { orbit: ['moon', 2], secs: 120 })
import { BODIES } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { clear, sleep } from './playtest.js';

const g = () => window.__space;

export function putOrbit(body, rMul, phase = 0) {
  const G = g();
  const b = BODIES[body];
  const s = bodyState(body, G.ship.t, {});
  const r = b.radius * rMul;
  const v = Math.sqrt(b.gm / r);
  Object.assign(G.ship, { x: s.x + r * Math.cos(phase), z: s.z + r * Math.sin(phase), vx: s.vx - v * Math.sin(phase), vz: s.vz + v * Math.cos(phase), soi: body, landedOn: null, angVel: 0, _accum: 0 });
}

/** Flies with the autopilot at real pace; logs each banner change (raw order, step, L = landed, S = scene). */
export async function trace(stepId, { orbit, secs = 120, until, manual } = {}) {
  const G = g();
  if (stepId) { G.missions.jump(stepId); await sleep(50); try { await clear(6); } catch { /* none */ } }
  if (orbit) putOrbit(...orbit);
  const log = []; let last = ''; let frames = 0; let maxTouch = 0;
  const frame = () => {
    G.debugRun(1 / 60, 1 / 60); frames++;
    const el = document.getElementById('burnCue');
    const vis = getComputedStyle(el).display !== 'none';
    const k = `${(vis ? el.dataset.raw : '(hidden)').replace(/\d+(\.\d+)?/g, '#')} |${G.missions.step.id}${G.ship.landedOn ? ' L' : ''}${G.activeScene ? ' S' : ''}`;
    if (k !== last) { last = k; log.push(`${(frames / 60).toFixed(1)} ${k}`); }
  };
  const onLand = (e) => { maxTouch = e.speed; };
  G.bus.on?.('landed', onLand);
  if (manual) {
    while (frames < secs * 60) { frame(); manual(G); if (frames % 30 === 0) await sleep(0); if (until?.()) break; }
  } else {
    G.autopilot.useFrame(() => { frame(); return sleep(0); }); // (timers crawl in a hidden tab)
    G.autopilot.set(true);
    const t0 = performance.now();
    while (frames < secs * 60 && performance.now() - t0 < 150000) {
      await sleep(100);
      if (document.querySelector('.sp-modal button')) { try { await clear(4); } catch { /* closed */ } }
      if (until?.()) break;
    }
    G.autopilot.set(false);
  }
  return { touch: maxTouch, fuel: G.ship.fuel, log: log.slice(-60) };
}

/**
 * Starts the Moon walk and records the climb-down frame by frame (1/60 s):
 * her position, the camera position and look. Returns the worst per-frame
 * jumps in speed (a snap shows as a spike). shots: [seconds] to save frames.
 */
export async function climbProbe({ step = 'a2_surface', secs = 13, shots = [], name = 'climb' } = {}) {
  const G = g();
  const prev = G.activeScene;
  G.missions.jump(step);
  for (let i = 0; i < 100 && (!G.activeScene || G.activeScene === prev); i++) await sleep(50);
  const S = G.activeScene;
  await S.ready;
  const d = S.debug;
  const cam = S.camera;
  const rows = [];
  const S2 = shots.length ? await import('./fullshot.js') : null;
  let next = 0;
  for (let f = 0; f < secs * 60; f++) {
    G.debugRun(1 / 60, 1 / 60);
    const p = d.walker.pos;
    const dir = cam.getWorldDirection(cam.position.clone());
    rows.push([p.x, p.y, p.z, cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, d.walker.heading, d.clock]);
    // (A shot renders one extra frame: skip measuring across it.)
    if (S2 && next < shots.length && f / 60 >= shots[next]) { await S2.fullShot(`${name}-${shots[next]}`); next++; rows.push(null); }
    await sleep(0); // let the scene's scripted steps (promises) move on every frame
    if (document.querySelector('.sp-modal button')) break;
  }
  // Worst change in velocity between frames (u/s per frame), and where.
  const worst = (i0) => {
    let w = 0; let at = 0;
    for (let k = 2; k < rows.length; k++) {
      if (!rows[k] || !rows[k - 1] || !rows[k - 2]) continue;
      let a = 0;
      for (let j = i0; j < i0 + 3; j++) a += ((rows[k][j] - rows[k - 1][j]) - (rows[k - 1][j] - rows[k - 2][j])) ** 2;
      a = Math.sqrt(a) * 3600; // u/s^2
      if (a > w) { w = a; at = rows[k][10]; }
    }
    return { accel: +w.toFixed(1), at: +at.toFixed(2) };
  };
  const spin = () => { let w = 0; let at = 0; for (let k = 2; k < rows.length; k++) { if (!rows[k] || !rows[k - 1]) continue; const r = Math.abs(Math.atan2(Math.sin(rows[k][9] - rows[k - 1][9]), Math.cos(rows[k][9] - rows[k - 1][9]))) * 60; if (r > w) { w = r; at = rows[k][10]; } } return { radPerS: +w.toFixed(2), at: +at.toFixed(2) }; };
  window.__rows = rows;
  return { frames: rows.length, girl: worst(0), cam: worst(3), look: worst(6), turn: spin() };
}

/** Moon then Europa landing from a 2-radius orbit with the autopilot: touchdown speed, fuel, banner changes. */
export async function landBoth() {
  const G = g();
  const out = { mode: G.mode.id, safe: G.ship.safeLandingSpeed };
  for (const [step, body] of [['a2_land', 'moon'], ['a5_land', 'europa']]) {
    // Jump first, then end any walk still running (ending it first would
    // carry the story on to the next step, or the finale).
    const old = G.activeScene;
    G.missions.jump(step);
    old?.debug?.finish?.();
    await sleep(300);
    try { await clear(6); } catch { /* none */ }
    G.ship.fuel = 5.5;
    const r = await trace(null, { orbit: [body, 2], secs: 60, until: () => G.ship.landedOn });
    out[step] = { touch: +r.touch.toFixed(2), fuelUsed: +(5.5 - r.fuel).toFixed(2), changes: r.log.length, tail: r.log.slice(-4) };
    // Let the walk that the touchdown starts come up before the next jump.
    for (let i = 0; i < 80 && !G.activeScene; i++) await sleep(50);
  }
  window.__res = out;
  return out;
}

/** On a fly-by inward toward `body`: r0 from it, lowest point rp, speed far out vinf. */
export function putApproach(body, rpMul = 2, vinf = 1, r0Mul = 6, phase = 0) {
  const G = g();
  const b = BODIES[body];
  const s = bodyState(body, G.ship.t, {});
  const r0 = b.radius * r0Mul; const rp = b.radius * rpMul;
  const v0 = Math.sqrt(vinf * vinf + 2 * b.gm / r0);
  const vp = Math.sqrt(vinf * vinf + 2 * b.gm / rp);
  const vt = (rp * vp) / r0; const vr = -Math.sqrt(Math.max(0, v0 * v0 - vt * vt));
  const ux = Math.cos(phase); const uz = Math.sin(phase);
  Object.assign(G.ship, {
    x: s.x + r0 * ux, z: s.z + r0 * uz,
    vx: s.vx + vr * ux - vt * uz, vz: s.vz + vr * uz + vt * ux,
    soi: body, landedOn: null, angVel: 0, _accum: 0,
  });
}

/** Steps the game (no autopilot) until test() or secs, then saves a full shot. */
export async function shootWhen(name, test, { secs = 120, fly, chunk = 1 / 60 } = {}) {
  const G = g();
  const S = await import('./fullshot.js');
  for (let f = 0; f < secs / chunk; f++) {
    G.debugRun(chunk, 1 / 60);
    fly?.(G);
    if (f % 30 === 0) await sleep(0);
    if (test(G)) break;
  }
  await S.fullShot(name);
  const el = document.getElementById('burnCue');
  return { cue: el.textContent, aim: document.querySelector('.sp-aim')?.innerText, landing: document.querySelector('.sp-landing:not([hidden])')?.innerText };
}

/**
 * Real-pace autopilot run (one 1/60 s frame per autopilot frame, like
 * realpace.js) from a Moon fly-by on the capture step through the landing to
 * the start of the walk. Result in window.__res.
 */
export async function moonRun() {
  const G = g();
  const old = G.activeScene;
  G.missions.jump('a2_capture');
  old?.debug?.finish?.();
  await sleep(300);
  try { await clear(6); } catch { /* none */ }
  G.ship.fuel = Math.min(G.fuelCapacity, 5.5);
  const f0 = G.ship.fuel;
  putApproach('moon', 2.2, 1, 6, 0.5);
  const steps = [];
  let last = '';
  const r = await trace(null, {
    secs: 600,
    until: () => {
      const st = G.missions.step.id;
      if (st !== last) { last = st; steps.push(`${st}`); }
      return st === 'a2_surface' && !!G.activeScene;
    },
  });
  window.__res = { mode: G.mode.id, safe: G.ship.safeLandingSpeed, steps, touch: +r.touch.toFixed(2), fuelUsed: +(f0 - r.fuel).toFixed(2), realS: r.log.length ? r.log[r.log.length - 1].split(' ')[0] : null, log: r.log.slice(-25) };
  return window.__res;
}

/** Climb-down in ship-local coordinates (x out-ish, z along the hull): her root and her body's box centre vs the ladder. */
export async function climbLocal(times = [3.5, 4.5, 6, 7.5, 9, 10]) {
  const G = g();
  const THREE = await import('three');
  const prev = G.activeScene;
  G.missions.jump('a2_surface');
  for (let i = 0; i < 100 && (!G.activeScene || G.activeScene === prev); i++) await sleep(50);
  const S = G.activeScene; await S.ready; const d = S.debug;
  const inv = new THREE.Matrix4().copy(d.ship.group.matrixWorld).invert();
  const ex = d.ship.getHatchExit();
  const loc = (v) => { const p = v.clone().applyMatrix4(inv); return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; };
  const out = { lipLocal: [+ex.top.x.toFixed(2), +ex.top.y.toFixed(2), +ex.top.z.toFixed(2)], exitLocal: [+ex.position.x.toFixed(2), +ex.position.y.toFixed(2), +ex.position.z.toFixed(2)], rows: [] };
  const box = new THREE.Box3(); const c = new THREE.Vector3();
  let k = 0;
  for (let f = 0; f < 12 * 60 && k < times.length; f++) {
    G.debugRun(1 / 60, 1 / 60);
    await sleep(0);
    if (d.clock >= times[k]) {
      d.walker.root.updateMatrixWorld(true);
      box.setFromObject(d.walker.root); box.getCenter(c);
      out.rows.push({ t: +d.clock.toFixed(2), root: loc(d.walker.pos), body: loc(c), heading: +d.walker.heading.toFixed(2) });
      k++;
    }
  }
  window.__res = out;
  return out;
}

/** Capture-step shots: early coast, the last 10 s of the coast, BURN NOW. Result in window.__res. */
export async function captureShots(step, body, rpMul, vinf, r0Mul, prefix) {
  const G = g();
  const old = G.activeScene;
  G.autopilot.set(false);
  G.missions.jump(step);
  old?.debug?.finish?.();
  await sleep(400);
  try { await clear(6); } catch { /* none */ }
  putApproach(body, rpMul, vinf, r0Mul, 0.5);
  const raw = () => document.getElementById('burnCue').dataset.raw || '';
  const offTxt = () => document.querySelector('.sp-aim__off')?.textContent || '';
  const out = {};
  out.early = await shootWhen(`${prefix}-early`, () => /Coast/.test(raw()) && /Turn in/.test(offTxt()), { secs: 3 });
  out.late = await shootWhen(`${prefix}-late`, () => /Coast/.test(raw()) && /off|Lined/.test(offTxt()), { secs: 900, chunk: 1 });
  out.burn = await shootWhen(`${prefix}-burn`, () => /BURN NOW/.test(raw()), { secs: 120 });
  window.__res = out;
  return out;
}

/** Landing shots: the de-orbit brake from a 2-radius orbit, then a slow fall from 8 u up, nose sideways. */
export async function landShots(prefix = 'fix-land') {
  const G = g();
  const old = G.activeScene;
  G.autopilot.set(false);
  G.missions.jump('a2_land');
  old?.debug?.finish?.();
  await sleep(400);
  try { await clear(6); } catch { /* none */ }
  putOrbit('moon', 2);
  const out = {};
  out.brake = await shootWhen(`${prefix}-brake`, () => true, { secs: 0.1 });
  out.brakeGauge = !!document.querySelector('.sp-landing:not([hidden])');
  const s = bodyState('moon', G.ship.t, {});
  Object.assign(G.ship, { x: s.x + 18, z: s.z, vx: s.vx - 0.9, vz: s.vz + 0.4, soi: 'moon', landedOn: null, angVel: 0, angle: Math.PI / 2 });
  out.fall = await shootWhen(`${prefix}-fall`, () => /Getting fast|Too fast/.test(document.getElementById('burnCue').dataset.raw || ''), { secs: 20 });
  window.__res = out;
  return out;
}
