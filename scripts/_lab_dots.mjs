// Lab (temporary): how far do the drawn dots move between two refreshes on a
// plain coast (old: dots at now + i*gap; new: dots at fixed times)?
import { BODIES } from '../src/space/contracts.js';
import { keplerPropagate } from '../src/space/predictor.js';
const mods = { old: await import('./_lab_old_predictor.mjs'), new: await import('../src/space/predictor.js') };
const mu = BODIES.sun.gm; const r = 7000; const v = Math.sqrt(mu / r) * 1.08;
for (const warp of [1, 16, 64]) {
  const row = [];
  for (const k of ['old', 'new']) {
    let ship = { t: 1000, x: r, z: 0, vx: 0, vz: v, soi: 'sun' };
    let prev = null; let worst = 0;
    for (let i = 0; i < 30; i++) {
      const p = mods[k].predict(ship, { seconds: 3200, maxPoints: 320 });
      if (prev) { // nearest-dot distance, dot by dot, over the shared part
        for (let a = 2; a < prev.points.length / 2 - 40; a += 7) {
          let best = Infinity;
          for (let b = 0; b < p.points.length / 2; b++) best = Math.min(best, Math.hypot(prev.points[2 * a] - p.points[2 * b], prev.points[2 * a + 1] - p.points[2 * b + 1]));
          worst = Math.max(worst, best);
        }
      }
      prev = p;
      const dt = 0.2 * warp; const q = keplerPropagate(ship.x, ship.z, ship.vx, ship.vz, mu, dt);
      ship = { ...ship, t: ship.t + dt, x: q.x, z: q.z, vx: q.vx, vz: q.vz };
    }
    row.push(`${k}: dots move up to ${worst.toFixed(1)} u per refresh`);
  }
  console.log(`warp x${warp}: ${row.join(' | ')}  (dot gap ~${(v * 10).toFixed(0)} u)`);
}
