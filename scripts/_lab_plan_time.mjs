import { BODIES } from '../src/space/contracts.js';
import { bodyState } from '../src/space/orbits.js';
import { planTransferSteps } from '../src/space/transferPlanner.js';
function shipAround(body, rMul, t, phase = 0) {
  const b = BODIES[body]; const s = bodyState(body, t, {}); const r = b.radius * rMul; const v = Math.sqrt(b.gm / r);
  return { t, x: s.x + r * Math.cos(phase), z: s.z + r * Math.sin(phase), vx: s.vx - v * Math.sin(phase), vz: s.vz + v * Math.cos(phase), soi: body };
}
const e = bodyState('earth', 300, {});
const cases = [
  ['mars', { t: 300, x: e.x + 520, z: e.z, vx: e.vx * 1.05, vz: e.vz * 1.05, soi: 'sun' }],
  ['moon', shipAround('earth', 1.6, 50)],
  ['europa', shipAround('jupiter', 8, 50)],
  ['jupiter', (() => { const s = { t: 100, x: 12200, z: 0, vx: 0, vz: Math.sqrt(BODIES.sun.gm / 12200), soi: 'sun' }; return s; })()],
  ['belt', { t: 100, x: 9000, z: 0, vx: 0, vz: Math.sqrt(BODIES.sun.gm / 9000), soi: 'sun' }],
];
const target = (id) => (id === 'belt' ? { parent: 'sun', ring: 12200, orbit: 12200, soi: 600 } : id);
for (const [id, ship] of cases) {
  const it = planTransferSteps(ship, target(id));
  let r; let n = 0; let worst = 0; const t0 = performance.now();
  for (;;) { const a = performance.now(); r = it.next(); worst = Math.max(worst, performance.now() - a); n++; if (r.done) break; }
  const p = r.value;
  console.log(id, 'total ms', (performance.now() - t0).toFixed(0), 'slices', n, 'worst slice', worst.toFixed(1), p ? `tau ${p.tau.toFixed(0)} dv ${p.dv.toFixed(3)} peri ${p.peri.toFixed(0)}` : null);
}
