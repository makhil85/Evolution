// Lab (temporary): how torn / how jumpy is the DRAWN dotted line leaving the
// Moon and Earth? old = every dot hangs off its own frame body (and dots at
// now-relative times); new = pathFrames.js + fixed-time dots.
import { BODIES, PHYSICS_DT } from '../src/space/contracts.js';
import { bodyState, allStates } from '../src/space/orbits.js';
import { createShipState, stepShip } from '../src/space/physics.js';
import { predict } from '../src/space/predictor.js';
import { anchorPath } from '../src/space/pathFrames.js';

function oldAnchor(pred, n, rel, frameOf) {
  let run = 0;
  for (let i = 0; i < n; i++) {
    while (run < pred.frames.length - 1 && i > pred.frames[run].to) run++;
    const body = pred.frames[run]?.body || 'sun';
    frameOf[i] = body;
    const b = body === 'sun' ? { x: 0, z: 0 } : bodyState(body, pred.times[i], {});
    rel[i * 2] = pred.points[i * 2] - b.x; rel[i * 2 + 1] = pred.points[i * 2 + 1] - b.z;
  }
}
function drawn(pred, anchor, now, home) {
  const n = pred.times.length; const rel = new Float64Array(n * 2); const fr = new Array(n);
  anchor(pred, n, rel, fr);
  const st = allStates(now, {}); const h = home === 'sun' ? { x: 0, z: 0 } : st[home];
  const out = [];
  for (let i = 0; i < n; i++) { const b = fr[i] === 'sun' ? { x: 0, z: 0 } : st[fr[i]]; out.push([rel[2 * i] + b.x - h.x, rel[2 * i + 1] + b.z - h.z]); }
  return out;
}
// A ship leaving the Moon fast enough to fall out of Earth's pull too.
const moon = bodyState('moon', 500, {});
const m = BODIES.moon; const r = m.radius * 1.6;
const vm = Math.hypot(moon.vx - bodyState('earth', 500, {}).vx, moon.vz - bodyState('earth', 500, {}).vz);
for (const [label, extra] of [['moon escape A', 5.6], ['moon escape B', 7], ['moon escape C', 9.5]]) {
  const mv = { x: moon.vx, z: moon.vz }; const mvn = Math.hypot(mv.x, mv.z);
  const ux = mv.x / mvn, uz = mv.z / mvn; // along the Moon's motion
  const ship = createShipState({ t: 500, x: moon.x - uz * r, z: moon.z + ux * r, vx: moon.vx + ux * extra, vz: moon.vz + uz * extra, soi: 'moon' });
  for (const kind of ['old', 'new']) {
    let prevD = null; let maxGap = 0; let maxShift = 0; let prevPred = null; let seqs = new Set();
    const s = { ...ship, _slingshot: {} };
    for (let k = 0; k < 60; k++) {
      const home = s.soi;
      const horizon = home === 'sun' ? 3200 : 260;
      const pred = predict(s, { seconds: horizon, maxPoints: 320 });
      if (kind === 'old') { // dots at now-relative times: emulate by shifting sample grid
        // (old predictor not kept; only the anchoring differs here)
      }
      seqs.add(pred.soiChanges.map((c) => c.to).join('>'));
      const d = drawn(pred, kind === 'old' ? oldAnchor : anchorPath, s.t, home);
      // tear: biggest jump between neighbouring dots vs the median gap
      const gaps = d.slice(1).map((p, i) => Math.hypot(p[0] - d[i][0], p[1] - d[i][1])).sort((a, b) => a - b);
      const med = gaps[Math.floor(gaps.length / 2)] || 1;
      maxGap = Math.max(maxGap, gaps[gaps.length - 1] / med);
      // shift: the drawn line 0.2 s x16 warp later, at the same sim times
      if (prevPred && prevPred.home === home) {
        const dPrev = prevPred.d;
        const tA = prevPred.pred.times; const tB = pred.times;
        let w = 0;
        for (let i = 0, j = 0; i < tA.length; i++) {
          while (j < tB.length - 1 && tB[j] < tA[i] - 1e-6) j++;
          if (Math.abs(tB[j] - tA[i]) < 1e-6) w = Math.max(w, Math.hypot(dPrev[i][0] - d[j][0], dPrev[i][1] - d[j][1]));
        }
        maxShift = Math.max(maxShift, w);
      }
      prevPred = { pred, home, d };
      const steps = Math.round(3.2 / PHYSICS_DT); // 0.2 s at x16
      for (let q = 0; q < steps; q++) stepShip(s, {}, PHYSICS_DT);
    }
    console.log(`${label} [${kind}] worst tear ${maxGap.toFixed(0)}x the dot gap, worst shift between refreshes ${maxShift.toFixed(1)} u, paths: ${[...seqs].join(' | ')}`);
  }
}
