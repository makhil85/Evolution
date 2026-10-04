// Lab (temporary): the main.js re-plan schedule on a real (stepped) coast,
// with the old or the new planner. node scripts/_lab_sched_sim.mjs [old]
import { BODIES, PHYSICS_DT } from '../src/space/contracts.js';
import { bodyState } from '../src/space/orbits.js';
import { createShipState, stepShip } from '../src/space/physics.js';
const mod = process.argv[2] === 'old' ? './_lab_old_planner.mjs' : '../src/space/transferPlanner.js';
const { planTransfer, planIsGood } = await import(mod);

function around(body, rMul, t, phase = 0) {
  const b = BODIES[body]; const s = bodyState(body, t, {}); const r = b.radius * rMul; const v = Math.sqrt(b.gm / r);
  return createShipState({ t, x: s.x + r * Math.cos(phase), z: s.z + r * Math.sin(phase), vx: s.vx - v * Math.sin(phase), vz: s.vz + v * Math.cos(phase), soi: body });
}
function escaped(t, vinf, ang) {
  const e = bodyState('earth', t, {}); const ev = Math.hypot(e.vx, e.vz);
  const ex = e.vx / ev, ez = e.vz / ev; const c = Math.cos(ang), s = Math.sin(ang);
  const dx = ex * c - ez * s, dz = ex * s + ez * c;
  return createShipState({ t, x: e.x + dx * 520, z: e.z + dz * 520, vx: e.vx + dx * vinf, vz: e.vz + dz * vinf, soi: 'sun' });
}
function helio(r, t, ecc = 0, ph = 0) {
  const mu = BODIES.sun.gm; const v = Math.sqrt(mu / r) * (1 + ecc);
  return createShipState({ t, x: r * Math.cos(ph), z: r * Math.sin(ph), vx: -v * Math.sin(ph), vz: v * Math.cos(ph), soi: 'sun' });
}
const BELT = { parent: 'sun', ring: 12200, orbit: 12200, soi: 600, name: 'belt' };
const cases = [
  ['a1_raise moon', 'moon', around('earth', 1.6, 50)],
  ['a1_raise moon ph2', 'moon', around('earth', 1.6, 50, 2)],
  ['a2_coast mars v1.5', 'mars', escaped(300, 1.5, 0)],
  ['a2_coast mars v2.5', 'mars', escaped(300, 2.5, 0.3)],
  ['a2_coast mars v1.0', 'mars', escaped(300, 1.0, -0.4)],
  ['mars->belt', BELT, helio(9100, 2000, 0.02, 1)],
  ['belt->jupiter', 'jupiter', helio(12300, 4000, 0.01, 2)],
];
for (const [name, target, ship] of cases) {
  let plan = null; let full = 0; let changes = 0; let maxJump = 0; const log = [];
  let simSince = Infinity; let real = 0; let lastReal = -1e9;
  const t0 = ship.t;
  while (ship.t - t0 < 9000) {
    const tau = plan ? plan.at - ship.t : Infinity;
    if (plan && tau < 1) break;
    const warp = tau > 120 ? 64 : tau > 30 ? 16 : tau > 5 ? 4 : 1;
    const due = !plan || (tau < 20 ? simSince > 0.2 : (real - lastReal > (tau > 120 ? 4 : 2) || simSince > Math.max(30, tau / 4)));
    if (due) {
      let p = null;
      if (plan && planIsGood(plan.p, target) && tau > 0) {
        p = planTransfer(ship, target, { around: { tau, dv: plan.p.dv } });
        if (!(p && planIsGood(p, target))) p = null;
      }
      if (!p) { p = planTransfer(ship, target); full++; }
      if (p) {
        const at = ship.t + p.tau;
        if (plan) {
          const j = Math.abs(at - plan.at);
          if (j > 2) { changes++; maxJump = Math.max(maxJump, j); if (log.length < 8) log.push(`t${ship.t.toFixed(0)}: ${plan.at.toFixed(0)}->${at.toFixed(0)}`); }
        }
        plan = { at, p };
      }
      simSince = 0; lastReal = real;
    }
    // one real frame at this warp
    const steps = Math.round(warp / 60 / PHYSICS_DT);
    for (let k = 0; k < steps; k++) stepShip(ship, {}, PHYSICS_DT);
    simSince += steps * PHYSICS_DT; real += 1 / 60;
  }
  console.log(`${name.padEnd(20)} window at ${plan ? plan.at.toFixed(0) : '-'} (wait ${(plan ? plan.at - t0 : 0).toFixed(0)} s, dv ${plan?.p.dv.toFixed(2)}, peri ${plan?.p.peri.toFixed(0)}) changes ${changes} maxJump ${maxJump.toFixed(0)} full ${full} real ${real.toFixed(0)}s  ${log.join(' ')}`);
}
