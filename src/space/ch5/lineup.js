// Chapter 5's planet line-up: the next planet is always waiting for her.
//
// Out past Jupiter the planets come round very slowly (Saturn and Uranus line
// up again only every ~44,000 s), so a fixed starting line-up only works if
// she leaves each planet exactly on time, and a child never does. So just
// before each long leg, while that planet is still a dot far away (and a
// Mission Control line is on screen), its starting angle is set so that a
// burn along her path in a minute or two takes her right past it. The rails
// stay exact rails; only where that planet started is chosen for her.
//
// Pure maths (no three.js): scripts/test-ch5-flight.mjs flies it in node.
import { BODIES } from '../contracts.js';
import { keplerPropagate } from '../predictor.js';
import { planTransfer, planIsGood } from '../transferPlanner.js';

const MU = BODIES.sun.gm;

/**
 * A burn `lead` s from now, along her path, just big enough for her new orbit
 * to cross radius r2: when and where (angle round the Sun) she crosses it.
 */
function crossingFor(ship, r2, lead) {
  const s = keplerPropagate(ship.x, ship.z, ship.vx, ship.vz, MU, lead);
  const r1 = Math.hypot(s.x, s.z);
  const far = (k) => {
    const vx = s.vx * k; const vz = s.vz * k;
    const en = (vx * vx + vz * vz) / 2 - MU / r1;
    if (en >= 0) return Infinity;
    const a = -MU / (2 * en);
    const h = s.x * vz - s.z * vx;
    return a * (1 + Math.sqrt(Math.max(0, 1 - (h * h) / (MU * a))));
  };
  // Far point 3% past the target's orbit: it crosses, not just touches.
  let lo = 0.3; let hi = 3;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (far(m) < r2 * 1.03) lo = m; else hi = m; }
  const vx = s.vx * hi; const vz = s.vz * hi;
  const rAt = (t) => { const q = keplerPropagate(s.x, s.z, vx, vz, MU, t); return Math.hypot(q.x, q.z); };
  let a = 0; let b = 0;
  for (let t = 50; t < 400000; t += 50) { if (rAt(t) >= r2) { b = t; break; } a = t; }
  if (!b) return null;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (rAt(m) >= r2) b = m; else a = m; }
  const q = keplerPropagate(s.x, s.z, vx, vz, MU, b);
  return { tAt: ship.t + lead + b, angle: Math.atan2(q.z, q.x) };
}

/**
 * Set planet `id`'s starting angle (BODIES[id].phase) so a good window to it
 * opens soon. She must be in the Sun's pull, inside that planet's orbit.
 * Returns the plan the line-up gives (null: left as it was).
 */
export function lineUp(ship, id) {
  const b = BODIES[id];
  if (!b || b.parent !== 'sun' || ship.soi !== 'sun') return null;
  const omega = (2 * Math.PI) / b.period;
  const keep = b.phase;
  // The first line-up that opens a window soon; failing that, the soonest
  // good one found (a long wait beats no line-up: she can time-warp it).
  let best = null;
  for (const lead of [90, 40, 200, 400, 15, 700, 1200]) {
    const c = crossingFor(ship, b.orbit, lead);
    if (!c) continue;
    // The planet a little ahead of or behind the crossing, so she passes
    // beside it (in its gravity zone), not through it.
    for (const side of [0.35, -0.35, 0.2, -0.2, 0.5, -0.5, 0.12, -0.12, 0.7, -0.7]) {
      const phase = c.angle + (side * b.soi) / b.orbit - omega * c.tAt;
      b.phase = phase;
      const p = planTransfer(ship, id);
      // Clear of the planet (and Saturn's rings, out to ~2.3 radii).
      if (!p || !planIsGood(p, id) || p.peri <= b.radius * 3) continue;
      if (p.tau < lead * 3 + 120) return p;
      if (!best || p.tau < best.p.tau) best = { p, phase };
    }
  }
  if (best) { b.phase = best.phase; return best.p; }
  b.phase = keep;
  return null;
}

const LINED = ['saturn', 'uranus', 'neptune', 'pluto'].filter((id) => BODIES[id]);
/** Planets already lined up this chapter: never moved again (a reload
 *  mid-trip re-enters the step, and moving it then would undo her burn). */
const done = new Set();

/** lineUp, once per planet per chapter. True when it moved the planet. */
export function lineUpOnce(ship, id) {
  if (done.has(id)) return false;
  const p = lineUp(ship, id);
  if (p) done.add(id);
  return !!p;
}

/** The line-up as it is now, for the save (a reload must keep it). */
export function phasesNow() {
  return { ...Object.fromEntries(LINED.map((id) => [id, BODIES[id].phase])), lined: [...done] };
}
/** Put a saved line-up back. */
export function restorePhases(saved) {
  for (const id of LINED) if (Number.isFinite(saved?.[id])) BODIES[id].phase = saved[id];
  for (const id of saved?.lined || []) done.add(id);
}
