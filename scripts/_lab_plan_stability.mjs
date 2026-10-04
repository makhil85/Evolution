// Lab (temporary): does the planner give the same window (absolute time, dv)
// when re-run from later points of the same coast?
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
function coast(ship, dt) {
  const q = keplerPropagate(ship.x, ship.z, ship.vx, ship.vz, sunMu, dt);
  return { ...ship, t: ship.t + dt, x: q.x, z: q.z, vx: q.vx, vz: q.vz };
}
const target = process.argv[2] || 'mars';
for (const [vinf, ang] of [[1.5, 0], [2.5, 0.3], [1.0, -0.4], [3, 0.8]]) {
  let ship = shipAt(300, vinf, ang);
  const rows = [];
  let prev = null;
  for (let k = 0; k < 40; k++) {
    const p = planTransfer(ship, target);
    const tr = prev ? planTransfer(ship, target, { around: { tau: prev.at - ship.t, dv: prev.dv } }) : null;
    const pr = predict(ship, { seconds: 3200, maxPoints: 320, target });
    const seq = pr.soiChanges.map((c) => c.to).join('>');
    rows.push(`${ship.t.toFixed(0)} full at ${p ? (ship.t + p.tau).toFixed(0) : '-'} dv ${p?.dv.toFixed(3)} peri ${p ? (p.peri).toFixed(0) : '-'} good ${planIsGood(p, target)} blk ${p?.blocked}` +
      (tr ? ` | track at ${(ship.t + tr.tau).toFixed(0)} dv ${tr.dv.toFixed(3)} good ${planIsGood(tr, target)}` : '') + ` | pred ${seq}`);
    if (p && planIsGood(p, target)) prev = { at: ship.t + p.tau, dv: p.dv };
    ship = coast(ship, 25);
  }
  console.log(`--- vinf ${vinf} ang ${ang}`);
  console.log(rows.join('\n'));
}
