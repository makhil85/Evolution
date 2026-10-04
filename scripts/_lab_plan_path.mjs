import { BODIES } from '../src/space/contracts.js';
import { bodyState } from '../src/space/orbits.js';
import { keplerPropagate, predict } from '../src/space/predictor.js';
import { planTransfer, planIsGood } from '../src/space/transferPlanner.js';
const sunMu = BODIES.sun.gm;
function shipAt(t0, vinf, ang, rOut = 520) {
  const e = bodyState('earth', t0, {});
  const ex = e.vx / Math.hypot(e.vx, e.vz), ez = e.vz / Math.hypot(e.vx, e.vz);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = ex * c - ez * s, dz = ex * s + ez * c;
  return { t: t0, x: e.x + dx * rOut, z: e.z + dz * rOut, vx: e.vx + dx * vinf, vz: e.vz + dz * vinf, soi: 'sun' };
}
const target = process.argv[2] || 'mars';
for (const [vinf, ang] of [[1.5, 0], [2.5, 0.3], [1.0, -0.4], [3, 0.8], [0.6, 0]]) {
  const ship = shipAt(300, vinf, ang);
  const p = planTransfer(ship, target);
  const q = keplerPropagate(ship.x, ship.z, ship.vx, ship.vz, sunMu, p.tau);
  const v = Math.hypot(q.vx, q.vz); const k = (v + p.dv) / v;
  const after = { t: ship.t + p.tau, x: q.x, z: q.z, vx: q.vx * k, vz: q.vz * k, soi: 'sun' };
  const pr = predict(after, { seconds: Math.max(3200, p.arrive + 200), maxPoints: 320, target });
  console.log(`vinf ${vinf} ang ${ang}: tau ${p.tau.toFixed(0)} dv ${p.dv.toFixed(2)} peri ${p.peri.toFixed(0)} arrive ${p.arrive.toFixed(0)} | pred after burn: ${pr.soiChanges.map((c) => `${c.to}@${(c.t - after.t).toFixed(0)}`).join(' ')} closest ${pr.closest.dist.toFixed(0)} impact ${pr.impact?.body}`);
}
