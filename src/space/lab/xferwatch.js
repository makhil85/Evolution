// Dev-only: how steady is the transfer guidance? Flies the autopilot at a
// real screen's pace (one 1/60 s frame per step, like realpace.js) and
// counts how often what she SEES changes: the planned burn window (its
// absolute sim time and size), the banner countdown, the closest approach
// on the dotted line, and how far the drawn line itself moves between two
// predictions (compared at the same sim times).
//
//   const W = await import('/src/space/lab/xferwatch.js');
//   W.start();            // from wherever the save is (W.start({ manual: true }) just watches)
//   W.report()            // per step: counts and worst jumps; W.stop()
import { clear, sleep } from './playtest.js';
import { anchorPath } from '../pathFrames.js';

const g = () => window.__space;
let run = null;

const cueRaw = () => {
  const el = document.getElementById('burnCue');
  if (!el) return '';
  return el.dataset.raw ?? (getComputedStyle(el).display !== 'none' ? el.textContent : ''); // raw even while hidden
};

/** Where the polyline (points/times) is at sim time t, or null outside it. */
function pathAt(pred, t) {
  const T = pred.times; const P = pred.points;
  if (!T || T.length < 2 || t < T[0] || t > T[T.length - 1]) return null;
  let lo = 0; let hi = T.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
  const f = (t - T[lo]) / Math.max(1e-9, T[hi] - T[lo]);
  return [P[2 * lo] + (P[2 * hi] - P[2 * lo]) * f, P[2 * lo + 1] + (P[2 * hi + 1] - P[2 * lo + 1]) * f];
}

/** The dots as DRAWN, seen from the body she is at (what the chase camera shows): [times, xz]. */
function drawnLine(pred, states, home) {
  const n = pred.times.length; const rel = new Float64Array(n * 2); const fr = new Array(n);
  anchorPath(pred, n, rel, fr);
  const h = home === 'sun' ? { x: 0, z: 0 } : states[home];
  const pts = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const b = fr[i] === 'sun' ? { x: 0, z: 0 } : states[fr[i]];
    pts[2 * i] = rel[2 * i] + b.x - h.x; pts[2 * i + 1] = rel[2 * i + 1] + b.z - h.z;
  }
  return { times: pred.times, points: pts, home };
}

/** Worst distance between two lines over their shared times. */
function lineShift(a, b) {
  const t0 = Math.max(a.times[0], b.times[0]);
  const t1 = Math.min(a.times[a.times.length - 1], b.times[b.times.length - 1]);
  if (!(t1 > t0)) return 0;
  let w = 0;
  for (let k = 0; k <= 40; k++) {
    const t = t0 + ((t1 - t0) * k) / 40;
    const p = pathAt(a, t); const q = pathAt(b, t);
    if (p && q) w = Math.max(w, Math.hypot(p[0] - q[0], p[1] - q[1]));
  }
  return w;
}

function bucket(r, step) {
  if (!r.by[step]) {
    r.by[step] = {
      frames: 0, burnFrames: 0, plans: 0, planJumps: 0, planJumpMax: 0, dvJumps: 0, dvJumpMax: 0,
      cdJumps: 0, cdJumpMax: 0, cueChanges: 0, preds: 0, closeJumps: 0, closeJumpMax: 0,
      closeTJumpMax: 0, soiSeqChanges: 0, impactFlips: 0, lineShiftMax: 0, lineShiftBurnMax: 0, lineShiftCoastMax: 0,
      lineShiftCoastN: 0, shiftBig: 0, drawnShiftMax: 0, samples: [],
    };
  }
  return r.by[step];
}

function sample(r) {
  const G = g();
  const st = G.missions.step.id;
  const b = bucket(r, st);
  const ship = G.ship;
  // Burning, or within 1.5 s of sim after (a line drawn mid-burn vs the next).
  if (G.firing) r.lastFire = ship.t;
  const burning = ship.t - (r.lastFire ?? -1e9) < 1.5;
  b.frames++;
  if (burning) b.burnFrames++;
  // The plan: its window as an absolute sim time, and its size.
  const tp = G.debugTransfer().transferPlan;
  if (tp && tp.p && tp !== r.lastPlanObj) {
    r.lastPlanObj = tp;
    b.plans++;
    const at = tp.simT + tp.p.tau;
    if (r.lastPlan && r.lastPlan.target === tp.target) {
      const dj = Math.abs(at - r.lastPlan.at);
      const ddv = Math.abs(tp.p.dv - r.lastPlan.dv);
      if (dj > 2) { b.planJumps++; b.planJumpMax = Math.max(b.planJumpMax, dj); }
      if (ddv > 0.05 * Math.max(0.2, Math.abs(r.lastPlan.dv))) { b.dvJumps++; b.dvJumpMax = Math.max(b.dvJumpMax, ddv); }
      if ((dj > 2 || ddv > 0.05 * Math.abs(r.lastPlan.dv)) && b.samples.length < 30) {
        b.samples.push(`t${ship.t.toFixed(0)} plan at ${r.lastPlan.at.toFixed(0)}->${at.toFixed(0)} dv ${r.lastPlan.dv.toFixed(3)}->${tp.p.dv.toFixed(3)} peri ${(tp.p.peri ?? tp.p.miss).toFixed(0)}${burning ? ' BURN' : ''}`);
      }
    }
    r.lastPlan = { target: tp.target, at, dv: tp.p.dv };
  }
  // The banner countdown: the window it implies (now + n) should hold still.
  const raw = cueRaw();
  const key = raw.replace(/\d+(\.\d+)?/g, '#');
  if (key !== r.lastCueKey) { b.cueChanges++; r.lastCueKey = key; }
  const m = /window in (\d+) s|wait (\d+) s/.exec(raw);
  if (m) {
    const at = ship.t + Number(m[1] ?? m[2]);
    if (r.lastCd != null) {
      const dj = Math.abs(at - r.lastCd);
      if (dj > 2.5) { b.cdJumps++; b.cdJumpMax = Math.max(b.cdJumpMax, dj); if (b.samples.length < 30) b.samples.push(`t${ship.t.toFixed(0)} countdown window ${r.lastCd.toFixed(0)}->${at.toFixed(0)}`); }
    }
    r.lastCd = at;
  } else r.lastCd = null;
  // The dotted line.
  const pr = G.prediction;
  if (pr && pr !== r.lastPred) {
    b.preds++;
    const prev = r.lastPred;
    r.lastPred = pr;
    const soiSeq = (pr.soiChanges || []).map((c) => c.to).join('>') + (pr.impact ? `!${pr.impact.body}` : '');
    if (prev) {
      if (soiSeq !== r.lastSoiSeq) { b.soiSeqChanges++; if (b.samples.length < 30) b.samples.push(`t${ship.t.toFixed(0)} path ${r.lastSoiSeq || '-'} => ${soiSeq || '-'}${burning ? ' BURN' : ''}`); }
      if (!!pr.impact !== !!prev.impact) b.impactFlips++;
      const c = pr.closest; const pc = prev.closest;
      if (c && pc) {
        const dd = Math.abs(c.dist - pc.dist);
        const dt = Math.abs(c.t - pc.t);
        const big = dd > Math.max(5, 0.1 * pc.dist);
        if (big) { b.closeJumps++; b.closeJumpMax = Math.max(b.closeJumpMax, dd); }
        if (!burning) b.closeTJumpMax = Math.max(b.closeTJumpMax, dt);
      }
      const dr = drawnLine(pr, G.states, G.ship.soi);
      if (r.lastDrawn && r.lastDrawn.home === dr.home) b.drawnShiftMax = Math.max(b.drawnShiftMax || 0, burning ? 0 : lineShift(r.lastDrawn, dr));
      r.lastDrawn = dr;
      if (!pr.impact || !prev.impact) {
        const s = lineShift(prev, pr);
        b.lineShiftMax = Math.max(b.lineShiftMax, s);
        if (burning) b.lineShiftBurnMax = Math.max(b.lineShiftBurnMax, s);
        else { b.lineShiftCoastMax = Math.max(b.lineShiftCoastMax, s); b.lineShiftCoastN++; if (s > 3) b.shiftBig++; }
      }
    }
    r.lastSoiSeq = soiSeq;
    // Time series (W.series()): one row per new prediction.
    const c = pr.closest; const tp2 = G.debugTransfer().transferPlan;
    r.rows.push([st, +ship.t.toFixed(1), burning ? 'B' : '-', G.warpIndex, c ? +c.dist.toFixed(0) : null, c ? +(c.t - ship.t).toFixed(0) : null,
      soiSeq, prev ? +lineShift(prev, pr).toFixed(1) : 0, tp2?.p ? +(tp2.simT + tp2.p.tau).toFixed(0) : null, tp2?.p ? +tp2.p.dv.toFixed(3) : null,
      tp2?.p ? +(tp2.p.peri ?? tp2.p.miss).toFixed(0) : null, key.slice(0, 40)]);
    if (r.rows.length > 3000) r.rows.splice(0, 1000);
  }
}

/** Rows [step, t, B=burning, warp, closestDist, closestIn, soiSeq, lineShift, planAt, planDv, planPeri, cue] (filtered by step). */
export function series(stepId, every = 1) {
  return run.rows.filter((x, i) => (!stepId || x[0] === stepId) && i % every === 0).map((x) => x.join(' '));
}

export async function start({ manual = false, until } = {}) {
  stop();
  const r = { frames: 0, by: {}, stop: false, done: false, rows: [], steps: [], lastStep: '' };
  run = r;
  const G = g();
  // (Saves every 2 s: other sessions' edits reload the page mid-run.)
  const frame = () => { G.debugRun(1 / 60, 1 / 60); r.frames++; sample(r); if (r.frames % 120 === 0 && !G.activeScene) G.missions.save(); };
  if (manual) { r.frame = frame; return 'manual: call W.step(n)'; }
  G.autopilot.useFrame(() => { frame(); return new Promise((res) => setTimeout(res, 0)); });
  try { await clear(4); } catch { /* nothing open */ }
  G.autopilot.set(true);
  (async () => {
    while (!r.stop) {
      await sleep(100);
      try { if (document.querySelector('.sp-modal button')) await clear(4); } catch { /* closed */ }
      const st = G.missions.step.id;
      if (st !== r.lastStep) { r.steps.push(`${Math.round(r.frames / 60)}s ${st}`); r.lastStep = st; }
      if (until?.(G)) { r.done = true; G.autopilot.set(false); break; }
      if (!G.autopilot.on && !document.querySelector('.sp-modal button')) { r.steps.push('autopilot OFF'); break; }
    }
  })();
  return 'started';
}

/** Manual mode: n frames by hand (e.g. while a test presses keys). */
export function step(n = 60) { for (let i = 0; i < n; i++) run.frame(); }

export function report({ samples = false } = {}) {
  if (!run) return null;
  const out = { real: Math.round(run.frames / 60), step: g().missions.step.id, steps: run.steps.slice(-8), by: {} };
  for (const [k, b] of Object.entries(run.by)) {
    const mins = b.frames / 3600;
    const o = { ...b, realMin: +mins.toFixed(2) };
    for (const f of ['planJumpMax', 'dvJumpMax', 'cdJumpMax', 'closeJumpMax', 'closeTJumpMax', 'lineShiftMax', 'lineShiftBurnMax', 'lineShiftCoastMax', 'drawnShiftMax']) o[f] = +b[f].toFixed(2);
    if (!samples) delete o.samples;
    out.by[k] = o;
  }
  return out;
}

export function stop() {
  if (run) run.stop = true;
  g()?.autopilot?.set(false);
}
