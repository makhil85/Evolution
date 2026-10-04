// Lab only: quick set-ups for HUD/visual checks (minimap, markers, labels).
//   const V = await import('/src/space/lab/vislab.js');
//   await V.hover('moon', 5, -1.5); await V.shot('name')
import { BODIES } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { clear, sleep } from './playtest.js';

const g = () => window.__space;

/** Leaves any walk, jumps to a step and clears its cards. */
export async function at(stepId) {
  const G = g();
  G.autopilot?.set(false);
  G.activeScene?.debug?.finish?.();
  await sleep(300);
  try { await clear(6); } catch { /* none */ }
  G.missions.jump(stepId);
  await sleep(100);
  try { await clear(6); } catch { /* none */ }
}

/** Puts her `alt` u above `body` at `phase`, moving `vr` u/s radially (negative = falling) plus `vt` sideways. */
export function hover(body, alt, vr = -1.5, phase = 0.5, vt = 0) {
  const G = g();
  const b = BODIES[body];
  const s = bodyState(body, G.ship.t, {});
  const ux = Math.cos(phase); const uz = Math.sin(phase);
  const r = b.radius + alt;
  Object.assign(G.ship, { x: s.x + r * ux, z: s.z + r * uz, vx: s.vx + vr * ux - vt * uz, vz: s.vz + vr * uz + vt * ux, soi: body, landedOn: null, angVel: 0, _accum: 0 });
}

export async function run(sec, dt = 1 / 60) {
  for (let t = 0; t < sec; t += 0.25) { g().debugRun(Math.min(0.25, sec - t), dt); await sleep(0); }
}

export async function shot(name) {
  const S = await import('./fullshot.js');
  return S.fullShot(name);
}
