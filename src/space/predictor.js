// Chapter 4 physics - the predicted path.
//
// ACCURACY MATTERS HERE MORE THAN ANYWHERE ELSE IN THE GAME. The dotted line
// is her main navigation tool - if it's meaningfully wrong (a few units off
// aiming at a body 10-16u across), the game teaches her that physics is
// random rather than something she can learn to read. An early version of
// this module stepped stepShip() forward with a coarse (even adaptively
// coarse) fixed-size dt, the same integrator real flight uses. That was fast
// but NOT accurate enough: semi-implicit Euler's per-step error compounds
// over an eccentric transfer arc, and a coarse step measurably shortens how
// far the ship actually swings out before falling back (a real transfer to
// the Moon's orbit came back down ~30% early in testing). Patched conics
// means the ship is on a perfect two-body (Kepler) orbit within any one SOI -
// which has an EXACT closed-form solution - so instead of stepping through
// each SOI segment, this module SOLVES for the ship's state at any future
// time directly (keplerPropagate, the standard universal-variable Kepler
// solver - the same algorithm real mission planning software uses), and only
// steps between exact solves to find where one SOI segment ends and the next
// begins. That is both more accurate (no integration error at all within a
// segment, only float64 rounding and a tight Newton-Raphson tolerance) and
// much cheaper (each solve is O(1) - a handful of iterations - instead of
// hundreds of small stepShip() calls).
//
// SEGMENTS. The ship's relative-to-dominant-body state (rx,rz,rvx,rvz) is
// exact and constant in FORM for as long as the same body dominates - only
// time (dt since the segment started) changes. A coarse scan (SCAN_POINTS
// samples across the horizon, cheap since each is O(1)) checks whether the
// dominant body implied by a solved position still matches the segment's
// body; when it doesn't, a bisection search (still just more O(1) solves)
// finds the crossing time to high precision, and a new segment starts there
// with the SAME analytic machinery relative to the new body. Collisions with
// a body's surface are found the same way. This mirrors patched conics
// exactly - it just solves each conic instead of numerically walking it.
//
// closest-approach-to-target gets one extra refinement pass (a golden-section
// search within the bracket the coarse scan found) since the coordinator's
// "agree within 1u" bar is tighter than the coarse scan's spacing alone
// would guarantee.
//
// No three.js import - must run under plain `node`.

import { BODIES, SHIP } from './contracts.js';
import { bodyState, allStates, dominantBody } from './orbits.js';

const SUN_ZERO = Object.freeze({ x: 0, z: 0, vx: 0, vz: 0 });

/** Number of exact Kepler solves across the whole horizon - the "scan" that
 * finds SOI crossings/collisions and tracks periapsis/apoapsis/closest
 * approach. Each solve is O(1) (a handful of Newton-Raphson iterations), so
 * this is cheap even at a few hundred to a thousand points - see the timing
 * numbers in scripts/test-space-physics.mjs. */
const SCAN_POINTS = 150;

/** Bisection iterations to pin down an SOI-crossing/collision time. 30 steps
 * of bisection is ~1e-9 of the bracket width - massive overkill for 1u
 * precision, and still cheap since each step is one O(1) Kepler solve. */
const CROSSING_BISECTION_STEPS = 30;

/** Golden-section refinement passes for the closest-approach-to-target query. */
const CLOSEST_REFINE_STEPS = 40;

function stumpffC(z) {
  if (z > 1e-6) {
    const sz = Math.sqrt(z);
    return (1 - Math.cos(sz)) / z;
  }
  if (z < -1e-6) {
    const sz = Math.sqrt(-z);
    return (1 - Math.cosh(sz)) / z;
  }
  return 0.5 - z / 24 + (z * z) / 720;
}

function stumpffS(z) {
  if (z > 1e-6) {
    const sz = Math.sqrt(z);
    return (sz - Math.sin(sz)) / (sz * sz * sz);
  }
  if (z < -1e-6) {
    const sz = Math.sqrt(-z);
    return (Math.sinh(sz) - sz) / (sz * sz * sz);
  }
  return 1 / 6 - z / 120 + (z * z) / 5040;
}

/**
 * Exact two-body (Kepler) propagation: given a position/velocity relative to
 * a body of gravitational parameter `mu`, return the relative position and
 * velocity `dt` seconds later. Works for elliptical, parabolic and
 * hyperbolic orbits alike (the universal-variable formulation - no thrust
 * term, since the predicted path always coasts). This is EXACT (to Newton-
 * Raphson tolerance + float64 rounding), not an integration - the whole
 * reason the predictor can be both more accurate and far cheaper than
 * stepping stepShip() through many small increments.
 */
export function keplerPropagate(rx, rz, vx, vz, mu, dt) {
  if (dt === 0) return { x: rx, z: rz, vx, vz };
  const r0 = Math.hypot(rx, rz);
  const v0sq = vx * vx + vz * vz;
  const vr0 = (rx * vx + rz * vz) / r0;
  const alpha = 2 / r0 - v0sq / mu;
  const sqrtMu = Math.sqrt(mu);

  // Initial guess for Newton-Raphson. The textbook log-based hyperbolic guess
  // (Curtis 3.3) is faster when it applies, but produces NaN for a chunk of
  // the inbound (vr0 < 0) hyperbolic parameter space this game actually hits
  // (a fast Moon flyby is hyperbolic relative to the Moon) - verified by
  // direct testing, not assumed. This simpler guess converges in more
  // iterations but never produces a domain error, which matters far more
  // than iteration count for a "the dotted line must be right" module.
  let chi = Math.abs(alpha) > 1e-10 ? sqrtMu * alpha * dt : (sqrtMu * dt) / r0;

  let ratio = 1;
  let iter = 0;
  let z = 0;
  let C = 0;
  let S = 0;
  while (Math.abs(ratio) > 1e-11 && iter < 100) {
    z = alpha * chi * chi;
    C = stumpffC(z);
    S = stumpffS(z);
    const rOfChi = (r0 * vr0 / sqrtMu) * chi * (1 - z * S) + (1 - alpha * r0) * chi * chi * C + r0;
    const F = (r0 * vr0 / sqrtMu) * chi * chi * C + (1 - alpha * r0) * chi * chi * chi * S + r0 * chi - sqrtMu * dt;
    ratio = F / rOfChi;
    chi -= ratio;
    iter++;
  }

  z = alpha * chi * chi;
  C = stumpffC(z);
  S = stumpffS(z);

  const f = 1 - (chi * chi / r0) * C;
  const g = dt - (chi * chi * chi / sqrtMu) * S;
  const xNew = f * rx + g * vx;
  const zNew = f * rz + g * vz;
  const rNewMag = Math.hypot(xNew, zNew);
  const fdot = (sqrtMu / (rNewMag * r0)) * (alpha * chi * chi * chi * S - chi);
  const gdot = 1 - (chi * chi / rNewMag) * C;

  return { x: xNew, z: zNew, vx: fdot * rx + gdot * vx, vz: fdot * rz + gdot * vz };
}

function gmOf(bodyId) {
  return bodyId === 'sun' ? BODIES.sun.gm : BODIES[bodyId].gm;
}

function bodyStateOf(bodyId, t, scratch) {
  return bodyId === 'sun' ? SUN_ZERO : bodyState(bodyId, t, scratch);
}

const _bodyScratch = { x: 0, z: 0, vx: 0, vz: 0 };
const _targetScratch = { x: 0, z: 0, vx: 0, vz: 0 };
const _allStatesScratch = {};

/**
 * Predict the ship's coasting path for `seconds` of sim time.
 * opts: { seconds=300, maxPoints=300, target?: bodyId }.
 *
 * Returns { points: Float64Array [x0,z0,x1,z1,...] (heliocentric),
 *   times: Float64Array (sim time of each point, same length as points/2),
 *   frames: [{body, from, to}] sample-index runs of the dominant body,
 *   periapsis: {x,z,dist,body}|null, apoapsis: {x,z,dist,body}|null (of the
 *     CURRENT orbit only - up to the first SOI change; apoapsis is null if
 *     the path is still climbing/unbound within the horizon),
 *   closest: {body,dist,t,x,z,bodyX,bodyZ}|null (nearest approach to
 *     opts.target across the whole horizon, refined to sub-unit precision,
 *     or null if no target given),
 *   impact: {body,t,x,z}|null (first collision with any body, landable or
 *     not - prediction stops there), soiChanges: [{t,from,to}] }.
 */
export function predict(ship, opts = {}) {
  const seconds = opts.seconds ?? 300;
  const maxPoints = Math.max(2, opts.maxPoints ?? 300);
  const target = opts.target || null;

  if (ship.landedOn) {
    // Landed physics keeps her stuck to the body - nothing to predict.
    return {
      points: Float64Array.from([ship.x, ship.z]),
      times: Float64Array.from([ship.t]),
      frames: [{ body: ship.soi, from: 0, to: 0 }],
      periapsis: null,
      apoapsis: null,
      closest: null,
      impact: null,
      soiChanges: [],
    };
  }

  const t0 = ship.t;

  // --- Segment state: the ship's position/velocity relative to whichever
  // body currently dominates, valid (exactly, via keplerPropagate) for as
  // long as that body keeps dominating.
  let segStartT = t0;
  let segDomId = ship.soi;
  let segMu = gmOf(segDomId);
  {
    const b0 = bodyStateOf(segDomId, segStartT, _bodyScratch);
    var relX = ship.x - b0.x;
    var relZ = ship.z - b0.z;
    var relVX = ship.vx - b0.vx;
    var relVZ = ship.vz - b0.vz;
  }

  function evalAt(t) {
    const dt = t - segStartT;
    const rel = keplerPropagate(relX, relZ, relVX, relVZ, segMu, dt);
    const b = bodyStateOf(segDomId, t, _bodyScratch);
    return {
      x: rel.x + b.x, z: rel.z + b.z,
      vx: rel.vx + b.vx, vz: rel.vz + b.vz,
      relDist: Math.hypot(rel.x, rel.z),
    };
  }

  // Segments that ENTER the target's gravity zone (for the closest pass).
  const targetSegs = [];
  function startSegment(t, heliX, heliZ, heliVX, heliVZ, newDomId) {
    segStartT = t;
    segDomId = newDomId;
    segMu = gmOf(newDomId);
    const b = bodyStateOf(newDomId, t, _bodyScratch);
    relX = heliX - b.x;
    relZ = heliZ - b.z;
    relVX = heliVX - b.vx;
    relVZ = heliVZ - b.vz;
    if (target && newDomId === target) targetSegs.push({ t, relX, relZ, relVX, relVZ });
  }

  const points = [];
  const times = [];
  const sampleSoi = [];
  const soiChanges = [];
  let impact = null;

  // Periapsis/apoapsis of the CURRENT orbit only (the first segment).
  const firstBody = segDomId;
  let firstSegmentOpen = true;
  let minD = Infinity;
  let minPoint = null;
  let peakD = -Infinity;
  let peakPoint = null;
  let peakConfirmed = false;
  let rising = true;
  let prevSegD = null;

  // Closest approach to the caller-supplied target.
  let closestCoarse = null; // {t, dist, segDomId, segStartT, relX,relZ,relVX,relVZ} snapshot for refinement

  function distToTarget(t, s) {
    const ts = bodyState(target, t, _targetScratch);
    return { dist: Math.hypot(s.x - ts.x, s.z - ts.z), ts };
  }

  // Samples (the dots) and scan points sit on FIXED sim times - multiples of
  // their spacing - not "now + i spacings". Between two refreshes on a coast
  // the same dots then land on the same spots (only the far end grows), and
  // the scan meets SOI edges at the same moments. With spacings counted from
  // "now", every refresh (5 a second) slid all the dots along the line by
  // 0.2 s of flight - at x64 warp more than a whole dot gap - so a steady
  // orbit looked like it was crawling and flickering (2026-10-04).
  const sampleInterval = seconds / maxPoints;
  let nextSampleT = (Math.floor(t0 / sampleInterval) + 1) * sampleInterval;

  function recordSample(t, s) {
    points.push(s.x, s.z);
    times.push(t);
    sampleSoi.push(segDomId);
  }

  const scanDt = seconds / SCAN_POINTS;
  let prevT = t0;
  let prevS = evalAt(t0);

  // t=0 bookkeeping
  recordSample(t0, prevS);
  if (target) {
    const { dist } = distToTarget(t0, prevS);
    closestCoarse = { t: t0, dist, segDomId, segStartT, relX, relZ, relVX, relVZ };
  }

  const tEnd = t0 + seconds;
  for (let k = Math.floor(t0 / scanDt) + 1; !impact; k++) {
    const t = Math.min(tEnd, k * scanDt);
    const s = evalAt(t);

    // --- Collision check against the CURRENT segment's body (surface).
    const b = BODIES[segDomId];
    if (b) {
      const distToBody = s.relDist;
      const surfaceR = b.radius + SHIP.collisionRadius;
      if (distToBody <= surfaceR) {
        // Bisect between prevT (outside) and t (inside) to find the crossing.
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < CROSSING_BISECTION_STEPS; k++) {
          const mid = (lo + hi) / 2;
          const sm = evalAt(mid);
          if (sm.relDist > surfaceR) lo = mid; else hi = mid;
        }
        const sHit = evalAt(hi);
        impact = { body: segDomId, t: hi, x: sHit.x, z: sHit.z };
        recordSample(hi, sHit);
        break;
      }
    }

    // --- SOI-change check: does the dominant body at this heliocentric
    // position still match the segment's body?
    const states = allStates(t, _allStatesScratch);
    const domNow = dominantBody(s.x, s.z, t, states);
    if (domNow !== segDomId) {
      // Bisect between prevT (still segDomId) and t (now domNow) to find
      // the exact crossing instant, then start a fresh segment there.
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < CROSSING_BISECTION_STEPS; k++) {
        const mid = (lo + hi) / 2;
        const sm = evalAt(mid);
        const domMid = dominantBody(sm.x, sm.z, mid, allStates(mid, _allStatesScratch));
        if (domMid === segDomId) lo = mid; else hi = mid;
      }
      const sCross = evalAt(hi);
      const fromId = segDomId;
      soiChanges.push({ t: hi, from: fromId, to: domNow });
      if (firstSegmentOpen && fromId === firstBody) firstSegmentOpen = false;
      startSegment(hi, sCross.x, sCross.z, sCross.vx, sCross.vz, domNow);
      // Re-evaluate this scan point under the NEW segment for the rest of
      // this iteration's bookkeeping (periapsis tracking, sampling, target).
    }

    const sFinal = evalAt(t);

    // Periapsis/apoapsis of the first segment (only while still open).
    if (firstSegmentOpen && segDomId === firstBody) {
      const d = sFinal.relDist;
      if (d < minD) { minD = d; minPoint = { x: sFinal.x, z: sFinal.z }; }
      if (!peakConfirmed && prevSegD != null) {
        if (rising && d < prevSegD) { peakD = prevSegD; peakConfirmed = true; }
        rising = d >= prevSegD;
      }
      if (!peakConfirmed) peakPoint = { x: sFinal.x, z: sFinal.z };
      prevSegD = d;
    } else if (firstSegmentOpen) {
      firstSegmentOpen = false;
    }

    // Closest approach to target (coarse pass - refined after the loop).
    // Only up to her first pass through the target's zone: that pass is the
    // one she brakes at, and a closer second pass a lap later (or a crash
    // on it) used to win, so "closest" swapped between the two passes
    // from one refresh to the next (2026-10-05 lab, Jupiter to Europa).
    if (target && !soiChanges.some((c) => c.from === target)) {
      const { dist } = distToTarget(t, sFinal);
      if (!closestCoarse || dist < closestCoarse.dist) {
        closestCoarse = { t, dist, segDomId, segStartT, relX, relZ, relVX, relVZ };
      }
    }

    // Render sampling at a coarser, even cadence.
    while (nextSampleT <= t + 1e-9 && points.length / 2 < maxPoints + 1) {
      // Sample exactly at nextSampleT using the current segment (valid
      // since we've just resolved any crossing up to t).
      recordSample(nextSampleT, evalAt(nextSampleT));
      nextSampleT += sampleInterval;
    }

    prevT = t;
    if (t >= tEnd) break;
  }

  // Compact run-length list of the dominant body per sample-index range.
  const frames = [];
  for (let i = 0; i < sampleSoi.length; i++) {
    const last = frames[frames.length - 1];
    if (last && last.body === sampleSoi[i]) last.to = i;
    else frames.push({ body: sampleSoi[i], from: i, to: i });
  }

  const periapsis = minPoint ? { x: minPoint.x, z: minPoint.z, dist: minD, body: firstBody } : null;
  const apoapsis = peakConfirmed && peakPoint ? { x: peakPoint.x, z: peakPoint.z, dist: peakD, body: firstBody } : null;

  // Refine the closest-approach-to-target with a golden-section search
  // inside the segment the coarse minimum was found in, since the "agree
  // within 1u" bar is tighter than SCAN_POINTS spacing alone guarantees.
  let closest = null;
  // Where a segment ends: the next zone change after it starts (or the end).
  const segEnd = (ts) => {
    const ch = soiChanges.find((c) => c.t > ts + 1e-9);
    return ch ? ch.t : impact ? impact.t : t0 + seconds;
  };
  // The bracket stays inside the coarse minimum's own segment: its conic is
  // only her path there. A pass just inside the target's zone often had its
  // coarse minimum on the last scan point BEFORE the entry, and the old
  // bracket ran on past the entry on the outer conic, which ignores the
  // target's pull: "closest" swapped between the real 22 u pass and a
  // straight-line 1-11 u one from one refresh to the next, and the cue
  // between "on course" and a correction (2026-10-05 lab, Jupiter to Europa).
  // A pass inside the target's zone is searched on the target's own conic
  // as well (below), and the closer of the two kept.
  if (target && targetSegs.length && closestCoarse && closestCoarse.segDomId !== target) {
    const g = targetSegs[0];
    const e = segEnd(g.t);
    const muT = gmOf(target);
    const dAt = (t) => { const q = keplerPropagate(g.relX, g.relZ, g.relVX, g.relVZ, muT, t - g.t); return Math.hypot(q.x, q.z); };
    // Golden section over [entry, exit]: one pass in, one out (unimodal).
    const gr0 = (Math.sqrt(5) - 1) / 2;
    let a = g.t; let bb = e;
    let c = bb - gr0 * (bb - a); let d = a + gr0 * (bb - a);
    let fc = dAt(c); let fd = dAt(d);
    for (let k = 0; k < CLOSEST_REFINE_STEPS; k++) {
      if (fc < fd) { bb = d; d = c; fd = fc; c = bb - gr0 * (bb - a); fc = dAt(c); }
      else { a = c; c = d; fc = fd; d = a + gr0 * (bb - a); fd = dAt(d); }
    }
    const tm = fc < fd ? c : d;
    // Hand the refine below the target segment when its pass is the closer.
    if (Math.min(fc, fd) < closestCoarse.dist) closestCoarse = { t: tm, dist: Math.min(fc, fd), segDomId: target, segStartT: g.t, relX: g.relX, relZ: g.relZ, relVX: g.relVX, relVZ: g.relVZ };
  }
  if (target && closestCoarse) {
    const half = scanDt; // bracket half-width around the coarse minimum
    let lo = Math.max(t0, closestCoarse.t - half, closestCoarse.segStartT);
    let hi = Math.min(t0 + seconds, closestCoarse.t + half, segEnd(closestCoarse.segStartT));
    const segT0 = closestCoarse.segStartT;
    const segRx = closestCoarse.relX;
    const segRz = closestCoarse.relZ;
    const segRvx = closestCoarse.relVX;
    const segRvz = closestCoarse.relVZ;
    const segBody = closestCoarse.segDomId;
    const mu = gmOf(segBody);
    const distAt = (t) => {
      const rel = keplerPropagate(segRx, segRz, segRvx, segRvz, mu, t - segT0);
      const b = bodyStateOf(segBody, t, _bodyScratch);
      const hx = rel.x + b.x;
      const hz = rel.z + b.z;
      const ts = bodyState(target, t, _targetScratch);
      return { dist: Math.hypot(hx - ts.x, hz - ts.z), hx, hz, ts, rel, b };
    };
    const gr = (Math.sqrt(5) - 1) / 2;
    let a = lo;
    let bnd = hi;
    let c = bnd - gr * (bnd - a);
    let d = a + gr * (bnd - a);
    let fc = distAt(c).dist;
    let fd = distAt(d).dist;
    for (let k = 0; k < CLOSEST_REFINE_STEPS; k++) {
      if (fc < fd) { bnd = d; d = c; fd = fc; c = bnd - gr * (bnd - a); fc = distAt(c).dist; }
      else { a = c; c = d; fc = fd; d = a + gr * (bnd - a); fd = distAt(d).dist; }
    }
    const bestT = fc < fd ? c : d;
    const best = distAt(bestT);
    // retro: she'd swing round the target clockwise, against its moons.
    const dvx = best.rel.vx + best.b.vx - best.ts.vx;
    const dvz = best.rel.vz + best.b.vz - best.ts.vz;
    const retro = (best.hx - best.ts.x) * dvz - (best.hz - best.ts.z) * dvx < 0;
    // atEnd: the line just stops nearest there (the real pass is beyond the
    // horizon), so it isn't a closest approach to mark - a ghost drawn there
    // slid along with the end of the line.
    closest = { body: target, dist: best.dist, t: bestT, x: best.hx, z: best.hz, bodyX: best.ts.x, bodyZ: best.ts.z, retro, atEnd: !impact && bestT > t0 + seconds - scanDt };
  }

  return {
    points: Float64Array.from(points),
    times: Float64Array.from(times),
    frames,
    periapsis,
    apoapsis,
    closest,
    impact,
    soiChanges,
  };
}
