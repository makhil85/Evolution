// When should she burn, and how hard, to reach a moving target?
//
// The burn-window cue used to assume she starts from a CIRCULAR orbit (the
// textbook Hohmann phase angle). Playtest broke that: after the Moon slingshot
// she's on a stretched orbit round the Sun that already reaches Mars's orbit,
// and the formula sent her to a Mars that wasn't there (a 4,579 u miss).
//
// So this plans against the orbit she is ACTUALLY on. For each candidate burn
// time tau over the coming window it:
//   1. propagates her real orbit to tau (exact Kepler, same as the predictor),
//   2. picks the along-track speed change that makes her orbit reach the
//      target's orbit radius (vis-viva: a = (r1 + r2) / 2),
//   3. propagates that new orbit round to the target's orbit and measures how
//      close the target really is at that time,
// and keeps the tau with the smallest miss. Everything is in the frame of the
// target's parent (the Sun for Mars and Jupiter, Earth for the Moon, Jupiter
// for Europa), so it works for every transfer in the chapter.
//
// Pure math, no three.js: cheap enough (a few thousand Kepler solves) to rerun
// every second or two.
import { BODIES } from './contracts.js';
import { bodyState, bodyStateRel } from './orbits.js';
import { keplerPropagate } from './predictor.js';
import { IS_CH5 } from './chapter.js';

/** Longest wait searched for a window. Chapter 5's outer planets come round
 *  far more slowly (Saturn-Uranus repeat every ~44,000 s), and its x1024
 *  cruise makes even a long wait short at the keyboard. */
const WAIT_CAP = IS_CH5 ? 60000 : 9000;

const _p = { x: 0, z: 0, vx: 0, vz: 0 };
const _o = { x: 0, z: 0, vx: 0, vz: 0 };
const _t = { x: 0, z: 0, vx: 0, vz: 0 };

/**
 * @param {object} ship   physics ship state (heliocentric)
 * @param {string} target body id; the ship must be in its parent's SOI
 * @returns {null | { tau: number, dv: number, miss: number, arrive: number }}
 *   tau    seconds from now until the best burn
 *   dv     along-track speed change for that burn (+ = along her path, - = against)
 *   miss   predicted closest distance to the target's centre, u
 *   arrive seconds from the burn until that closest approach
 */
/** True when a plan arrives in the safe band (exported for the cue). */
/**
 * A target is a body id, or a spec for something that isn't a body (Act 1's
 * satellite): { parent, orbit, period, radius, soi, stateRelAt(t, out) },
 * where soi is "close enough to count as arrived" and stateRelAt gives its
 * position relative to its parent. Or a RING ({ parent, ring, orbit, soi }):
 * reach that distance from the parent anywhere round (the asteroid belt).
 */
function resolve(target) {
  if (target && typeof target === 'object') return target;
  const b = BODIES[target];
  if (!b) return null;
  return {
    parent: b.parent, orbit: b.orbit, period: b.period, radius: b.radius, soi: b.soi, gm: b.gm,
    stateRelAt: (t, out) => bodyStateRel(target, t, out),
  };
}

/**
 * The safe arrival band [lo, hi] for a target (closest distance to its
 * centre). Upper edge 0.6 of the gravity zone, down from 0.8: capture needs
 * her far point inside 0.7, so an arrival at 0.75 could never be captured.
 * Lower edge 1.8 radii, up from 1.5: braking a little late at Europa from
 * 1.5 radii dropped her path into the ground.
 */
function arrivalBand(tb) {
  if (tb.ring) return { lo: 0, hi: tb.soi }; // a ring: within soi of its middle
  const lo = tb.radius * 1.8;
  return { lo, hi: Math.max(lo * 1.4, tb.soi * 0.6) };
}

/**
 * Jupiter must be reached going round it the same way as its moons.
 * Medium playtest: she arrived on the other side, captured into a backwards
 * orbit, and met Europa head-on at 29 u/s (no fuel can stop that).
 */
function needsPrograde(target) { return target === 'jupiter'; }

/** Bodies she goes into orbit round (the rest are flybys or custom targets). */
const CAPTURED = new Set(['moon', 'jupiter', 'europa', 'saturn', 'uranus', 'neptune']);

/** slack widens the band (0.15 = 15% each way), for "still on course". */
export function planIsGood(p, target, slack = 0) {
  const tb = resolve(target);
  if (!p || !tb) return false;
  if (needsPrograde(target) && p.retro) return false;
  if (p.blocked) return false;
  const { lo, hi } = arrivalBand(tb);
  const d = p.peri ?? p.miss;
  return d >= lo * (1 - slack) && d <= hi * (1 + slack);
}

export function planTransfer(ship, target, opts = {}) {
  const it = planTransferSteps(ship, target, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/**
 * The same search, as a generator that pauses (yields) between rows of the
 * full grid search, so the game can spread one plan over several frames
 * (a full plan is 30-50 ms on a fast PC, 100+ ms on a school laptop: a
 * visible freeze every few seconds while she waited for a window). The
 * finished plan is the generator's return value. The ship is copied at the
 * start, so the answer is for that moment (its `tau` counts from then).
 */
export function* planTransferSteps(shipNow, target, { quick = false, dvHint = 0, around = null, coastOnly = false, minLead = 8, clock = null, maxTau = 2 } = {}) {
  const ship = { ...shipNow };
  const tb = resolve(target);
  if (!tb || ship.soi !== tb.parent) return null;
  const mu = BODIES[tb.parent].gm;
  const parentAt = (t) => (tb.parent === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : bodyState(tb.parent, t, _p));

  const p0 = parentAt(ship.t);
  const rx = ship.x - p0.x; const rz = ship.z - p0.z;
  const vx = ship.vx - p0.vx; const vz = ship.vz - p0.vz;

  // Search one synodic period (how long until the geometry repeats), capped.
  const r0 = Math.hypot(rx, rz);
  // Her MEAN angular speed (a whole lap's average), not this moment's: on a
  // stretched orbit the momentary one changes all the way round, and with it
  // the search span and grid, so two searches a minute apart on the same
  // coast looked at different windows (2026-10-04, "the plan keeps changing").
  const en0 = (vx * vx + vz * vz) / 2 - mu / r0;
  const omegaS = en0 < 0 ? Math.sqrt((-2 * en0) ** 3) / mu : Math.abs((rx * vz - rz * vx) / (r0 * r0));
  const omegaT = (2 * Math.PI) / tb.period;
  const synodic = (2 * Math.PI) / Math.max(1e-6, Math.abs(omegaS - omegaT));
  // Cap raised from 3200 s after playtest: from the belt, Ceres or Jupiter can
  // be on the wrong side for 6000+ s, and a capped search found nothing.
  // A ring (the asteroid belt) is everywhere at once: no waiting for it to
  // come round, just for the right point on her own orbit (one lap).
  const tMax = tb.ring
    ? Math.min(WAIT_CAP, (2 * Math.PI) / Math.max(1e-6, omegaS))
    : Math.min(WAIT_CAP, synodic * 1.05);
  const r2 = tb.orbit;
  // The target's siblings (Jupiter's other moons; the other planets): a path
  // through one's gravity zone isn't the path this model predicts (Easy
  // playtest: the way to Europa crossed Callisto and hit it at 10 u/s).
  // That includes the planet she has only just left: she is outside its zone
  // already, so a path back into it really is a detour. (It used to be left
  // out while she was near it, and the plan changed as soon as she drifted
  // 1.5 zones away and it counted again: the window chosen just after leaving
  // Earth swung back past Earth, and the dotted line bent round it.)
  const siblings = Object.keys(BODIES).filter((id) => id !== target && id !== ship.soi && BODIES[id].parent === tb.parent);

  // The coast up to the burn must stay clear of those zones too: inside one
  // the real path bends, and a burn planned for after it no longer works
  // (2026-10-05 play-test, Medium a2_coast: her path dipped back into Earth's
  // zone before a window 99 s away, and the plan jumped 778 s when she came
  // out). The first time her current coast enters a sibling's zone, within
  // `upTo` s; burns are only planned before it. Only siblings whose orbit her
  // own distance range reaches are checked, stepping by how soon she could
  // possibly reach the nearest zone (her top speed plus its), so a far
  // planet costs a few steps and a near one is never stepped over.
  function clearUntil(upTo) {
    const h = rx * vz - rz * vx;
    const ecc = Math.sqrt(Math.max(0, 1 + (2 * en0 * h * h) / (mu * mu)));
    const pr = (h * h) / mu / (1 + ecc);
    const ap = en0 < 0 ? (h * h) / mu / (1 - ecc) : Infinity;
    const near = siblings.filter((id) => BODIES[id].orbit + BODIES[id].soi > pr && BODIES[id].orbit - BODIES[id].soi < ap);
    if (!near.length) return Infinity;
    const vmax = Math.sqrt(Math.max(0, 2 * (en0 + mu / pr))); // her top speed (at her low point)
    const vRel = vmax + Math.max(...near.map((id) => (2 * Math.PI * BODIES[id].orbit) / BODIES[id].period));
    for (let tt = 0; tt <= upTo;) {
      const q = keplerPropagate(rx, rz, vx, vz, mu, tt);
      let gap = Infinity;
      for (const id of near) {
        const o = bodyStateRel(id, ship.t + tt, _o);
        gap = Math.min(gap, Math.hypot(q.x - o.x, q.z - o.z) - BODIES[id].soi);
      }
      if (gap < 0) return tt;
      tt += Math.max(0.25, (0.9 * gap) / vRel);
    }
    return Infinity;
  }

  // How far a burn of `dv` at `tau` misses, and when. Arrival can be anywhere
  // round the new orbit (a burn off her orbit's high/low point doesn't arrive
  // half an orbit later), so the new orbit is sampled across most of a lap.
  function evaluate(tau, dv, fine = false, N = fine ? 20 : 12) {
    const s = keplerPropagate(rx, rz, vx, vz, mu, tau);
    const v1 = Math.hypot(s.vx, s.vz);
    if (!(v1 > 1e-9)) return null;
    const k = (v1 + dv) / v1;
    const nvx = s.vx * k; const nvz = s.vz * k;
    const r1 = Math.hypot(s.x, s.z);
    const energy = (nvx * nvx + nvz * nvz) / 2 - mu / r1;
    // Unbound: sample out to where a straight run at this speed would reach r2.
    const a = energy < 0 ? -mu / (2 * energy) : (r1 + r2) / 2;
    const period = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
    if (tb.ring) {
      // How close does her new path come to the ring's middle radius?
      const Nr = fine ? 60 : 24;
      const dTr = (period * 0.9) / Nr;
      let best = Infinity; let arr = 0;
      for (let j = 1; j <= Nr; j++) {
        const q = keplerPropagate(s.x, s.z, nvx, nvz, mu, dTr * j);
        const d = Math.abs(Math.hypot(q.x, q.z) - tb.ring);
        if (d < best) { best = d; arr = dTr * j; }
      }
      return { tau, dv, miss: best, peri: best, arrive: arr, retro: false, blocked: false, capDv: 0 };
    }
    let miss = Infinity;
    let arrive = 0;
    const dT = (period * 0.9) / N;
    const at = (tt) => {
      const q = keplerPropagate(s.x, s.z, nvx, nvz, mu, tt);
      const tg = tb.stateRelAt(ship.t + tau + tt, _t);
      return Math.hypot(q.x - tg.x, q.z - tg.z);
    };
    for (let j = 1; j <= N; j++) {
      const d = at(dT * j);
      if (d < miss) { miss = d; arrive = dT * j; }
    }
    // A closer look around the best sample: a small target (the satellite,
    // Europa) can slip between coarse samples and a real hit look like a miss.
    const c0 = arrive;
    for (let k = -4; k <= 4; k++) {
      const tt = c0 + (k / 4) * dT;
      if (tt <= 0) continue;
      const d = at(tt);
      if (d < miss) { miss = d; arrive = tt; }
    }
    // FINE: the true closest moment, by golden-section search. The samples
    // above are ~9 s apart round Jupiter, 45 u of travel at Europa's arrival
    // speed: "25 u out" could really be a hit (Easy playtest). Only for plans
    // that decide something (final pick, re-plans, the coast check).
    if (fine) {
      const gr = (Math.sqrt(5) - 1) / 2;
      let a = Math.max(1e-3, arrive - dT / 4);
      let b = arrive + dT / 4;
      let c = b - gr * (b - a); let d = a + gr * (b - a);
      let fc = at(c); let fd = at(d);
      for (let k = 0; k < 16; k++) { // 0.618^16: ~1e-4 of the bracket
        if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = at(c); }
        else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = at(d); }
      }
      const tt = fc < fd ? c : d;
      const dd = Math.min(fc, fd);
      if (dd < miss) { miss = dd; arrive = tt; }
    }
    // Which way round the target she'd swing (all bodies and moons here go
    // counter-clockwise, angular momentum > 0).
    const q = keplerPropagate(s.x, s.z, nvx, nvz, mu, arrive);
    const tg = tb.stateRelAt(ship.t + tau + arrive, _t);
    const dx = q.x - tg.x; const dz = q.z - tg.z;
    const rvx = q.vx - tg.vx; const rvz = q.vz - tg.vz;
    const retro = dx * rvz - dz * rvx < 0;
    // `miss` ignores the target's own pull, which bends her inward as she
    // passes: her real lowest point is lower. For a pass at distance b and
    // speed v: peri = (mu/v^2) * (sqrt(1 + (b v^2 / mu)^2) - 1). (Playtest:
    // at Europa's slow approach speeds a path "25 u out" hit the ground.)
    // FINE only: does the way there pass through a sibling's gravity zone?
    let blocked = false;
    if (fine && siblings.length) {
      const steps = Math.max(8, Math.ceil(arrive / dT) * 3);
      for (let j = 1; j <= steps && !blocked; j++) {
        const tt = (arrive * j) / steps;
        const p = keplerPropagate(s.x, s.z, nvx, nvz, mu, tt);
        for (const id of siblings) {
          const o = bodyStateRel(id, ship.t + tau + tt, _o);
          if (Math.hypot(p.x - o.x, p.z - o.z) < BODIES[id].soi) { blocked = true; break; }
        }
      }
    }
    const gmT = tb.gm || 0;
    const v2 = rvx * rvx + rvz * rvz;
    // Only inside its gravity zone: outside it the target doesn't pull at all
    // in this game's physics, so a slow pass 350 u out stays 350 u out.
    const peri = gmT > 0 && v2 > 1e-9 && miss < tb.soi ? (gmT / v2) * (Math.sqrt(1 + ((miss * v2) / gmT) ** 2) - 1) : miss;
    // What stopping there will cost: from her speed at the lowest point down
    // to orbit speed at that height.
    const capDv = gmT > 0 && peri > 0 ? Math.max(0, Math.sqrt(v2 + (2 * gmT) / peri) - Math.sqrt(gmT / peri)) : 0;
    return { tau, dv, miss, peri, arrive, retro, blocked, capDv };
  }

  // Score: any plan that arrives well inside the target's gravity zone is
  // good enough, so among those prefer the SMALLEST burn (fuel is the
  // resource she manages), a little sooner rather than later. Plans that miss
  // rank behind every plan that hits, ordered by how close they get.
  // "Good" = a SAFE pass: inside the target's gravity zone, but at least two
  // radii from its centre (playtest: the cheapest plan to Jupiter went
  // through its middle, a crash course). Moons are small enough that this
  // still leaves a wide band.
  // Band widened after playtest: for Europa (radius 10, gravity zone 44 u)
  // the old [2 R, 0.5 SOI] band was 20-30 u wide, the coarse grid rarely
  // landed in it, and the cue flip-flopped between "window" and "looking".
  const { lo, hi } = arrivalBand(tb);
  const off = (m) => (m < lo ? lo - m : m > hi ? m - hi : 0);
  const wrongWay = needsPrograde(target) ? (e) => (e.retro ? 500 : 0) : () => 0;
  // Where she has to stop (not a flyby), the burn to stop there counts too:
  // the cheapest departure to Europa arrived at 8.5 u/s and needed a 5 u/s
  // capture burn (Easy playtest).
  const stops = CAPTURED.has(target);
  const vis = Math.sqrt(mu / r0); // scale the speed changes to this orbit
  // Keep away from the band's edges. The cheapest burn always sat right ON an
  // edge (less push until the pass just touches the limit), so the smallest
  // drift - the burn smeared over seconds, her own taps - tipped the plan
  // out of the band, and a fresh search picked a different window
  // (2026-10-04: Mars plans at 152-173 u against a 160 u edge). A plan in the
  // middle 40% costs nothing extra; nearer an edge costs up to 2% of orbit
  // speed (a fraction of a u/s), so a slightly bigger burn with room to spare wins.
  const mid = tb.ring ? 0 : Math.sqrt(lo * hi);
  const edgeX = (d) => (tb.ring ? d / hi : Math.log(d / mid) / Math.log(hi / mid));
  const edgePen = (d) => { const x = Math.max(0, Math.abs(edgeX(Math.max(1e-6, d))) - 0.4) / 0.6; return 0.02 * vis * x * x; };
  const score = (e) => (off(e.peri) === 0
    ? wrongWay(e) + (e.blocked ? 700 : 0) + Math.abs(e.dv) + (stops ? e.capDv : 0) + edgePen(e.peri) + e.tau * 0.0004
    : 1e3 + off(e.peri));

  // Rank candidates with the quick evaluation, then check the best few
  // precisely (true closest pass, sibling moons). Checking every candidate
  // precisely took 130+ ms a plan, a visible hitch every 2 s.
  const isGood = (e) => off(e.peri) === 0 && !e.blocked && !(needsPrograde(target) && e.retro);
  function pickFine(cands, k) {
    cands.sort((x, y) => score(x) - score(y));
    let pick = null;
    for (const c of cands.slice(0, k)) {
      const f = evaluate(c.tau, c.dv, true);
      if (f && (!pick || score(f) < score(pick))) pick = f;
      if (pick && isGood(pick)) break;
    }
    return pick;
  }
  // The same, pausing after each precise check (for the full search's slices).
  function* pickFineSteps(cands, k) {
    cands.sort((x, y) => score(x) - score(y));
    let pick = null;
    for (const c of cands.slice(0, k)) {
      const f = evaluate(c.tau, c.dv, true);
      if (f && (!pick || score(f) < score(pick))) pick = f;
      if (pick && isGood(pick)) break;
      yield;
    }
    return pick;
  }

  // Coarse-to-fine over an ni x nj grid of (when, how hard): every second
  // point first, then the neighbours of the best few. About a third of the
  // evaluations of the full grid for the same pick (item 9: the tracking
  // check cost 15-30 ms, several times a second).
  function gridCands(ni, nj, at) {
    const seen = new Map();
    const get = (i, j) => {
      const key = i * 1000 + j;
      if (!seen.has(key)) seen.set(key, at(i, j));
      return seen.get(key);
    };
    const coarse = [];
    for (let i = 0; i < ni; i += 2) {
      for (let j = 0; j < nj; j += 2) {
        const e = get(i, j);
        if (e) coarse.push({ e, i, j });
      }
    }
    coarse.sort((x, y) => score(x.e) - score(y.e));
    for (const c of coarse.slice(0, 6)) {
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const i = c.i + di; const j = c.j + dj;
          if (i >= 0 && j >= 0 && i < ni && j < nj) get(i, j);
        }
      }
    }
    return [...seen.values()].filter(Boolean);
  }

  // COAST mode: where does the path she's on RIGHT NOW arrive (no burn)?
  // Exact Kepler, so it sees arrivals past the dotted line's end.
  // 80 samples, not 20: on a long orbit 20 are ~90 s apart and the "closest"
  // pass jumped between two near-passes, flipping the cue.
  if (coastOnly) return evaluate(0, 0, true, 80);

  // QUICK mode, used while she's burning: the window is NOW, so only the
  // remaining speed change is searched (a few ms, not the ~50 ms full search;
  // re-running the full search several times a second froze the game).
  if (quick) {
    // A real burn is smeared over seconds, not an instant kick, so the rest of
    // it may fit best a moment from now: look up to 2 s ahead too.
    // The full fine grid on purpose: this decides when the engine cuts off,
    // and it only runs for the few seconds of a burn.
    // Never LATER than the window it is re-checking (maxTau, from main.js):
    // each re-check picked "a moment from now" again, the window slid ahead
    // of her, and a Jupiter burn started 12 s late after 44 re-checks of
    // 10+ ms each (2026-10-05 lab).
    const top = Math.min(2, Math.max(0, maxTau));
    // The planned burn itself first: still good, it stays exactly as shown.
    const same = evaluate(top, dvHint, true);
    if (same && isGood(same)) return same;
    const taus = [];
    for (let a2 = 0; a2 * 0.25 < top - 1e-6; a2++) taus.push(a2 * 0.25);
    taus.push(top); // the window itself
    const cands = [];
    for (const tq of taus) {
      for (let b = -12; b <= 12; b++) {
        const e = evaluate(tq, dvHint + (b / 12) * 0.08 * vis);
        if (e) cands.push(e);
      }
    }
    return pickFine(cands, 6);
  }

  // TRACKING mode: a good plan already exists. First the SAME burn (same
  // moment, same push) is checked again: on a coast it still works, and then
  // the window doesn't move at all, so the countdown runs down second by
  // second. (It used to re-pick the cheapest burn nearby every time, and the
  // window slid by up to 6% of the wait per check, mostly earlier: "window in
  // 400 s" became 370 s two seconds later.) Only when that burn no longer
  // arrives safely is the neighbourhood searched, for the nearest fix.
  if (around) {
    const spanT = Math.max(3, Math.abs(around.tau) * 0.06);
    const tClear = clearUntil(around.tau + spanT);
    const same = around.tau < tClear ? evaluate(around.tau, around.dv, true) : null;
    if (same && isGood(same)) return same;
    const cands = gridCands(13, 13, (a2, b2) => {
      const tau = Math.max(0, around.tau + ((a2 - 6) / 6) * spanT);
      return tau < tClear ? evaluate(tau, around.dv + ((b2 - 6) / 6) * 0.04 * vis) : null;
    });
    return pickFine(cands, 6);
  }

  // FULL search: a coarse grid over when and how hard, then a closer look at
  // the best few distinct windows. The grid sits on FIXED sim times (multiples
  // of its step, not "now + i steps") and fixed push sizes, so a search run a
  // minute later on the same coast tries the same burns and picks the same
  // window: the old grid slid with "now", sampled a different set of narrow
  // windows each time, and two searches a minute apart picked windows
  // thousands of seconds apart (2026-10-04 lab: 2705, 1787, 453, 4004... s).
  // Nothing sooner than `minLead` s: she needs time to turn before a burn.
  // The grid always spans the textbook (Hohmann) change for her current
  // height: from a wide Jupiter orbit down to Europa it's about -30%, outside
  // the old fixed -15%..+25% grid, and the cue said "looking" forever.
  const pow2 = (x) => 2 ** Math.round(Math.log2(x));
  const dvH = (Math.sqrt((2 * r2) / (r0 + r2)) - 1);
  const dLo = Math.min(-0.15, dvH - 0.12) * vis;
  const dHi = Math.max(0.25, dvH + 0.12) * vis;
  const dStep = pow2(0.03 * vis);
  const dvs = [];
  for (let j = Math.ceil(dLo / dStep); j <= Math.floor(dHi / dStep); j++) dvs.push(j * dStep);
  const dTau = pow2(tMax / 90);
  const tClear = clearUntil(tMax);
  const all = [];
  for (let i = Math.ceil((ship.t + minLead) / dTau); i * dTau <= ship.t + Math.min(tMax, tClear); i++) {
    const tau = i * dTau - ship.t;
    for (const dv of dvs) {
      const e = evaluate(tau, dv);
      if (e) all.push(e);
    }
    yield;
  }
  all.sort((x, y) => score(x) - score(y));
  // The lead counts from NOW, not from the search's start: spread over frames
  // under time warp a search takes 20+ s of sim time, and its window could be
  // 2 s away (or gone) by the time it was shown - she couldn't turn in time,
  // the window was missed, the next search did the same, and each pick cost
  // a little more (2026-10-05 lab, Medium a3_depart: five misses in a row,
  // then a window 4,400 s later). `clock` gives the live sim time.
  const lead = () => minLead + (clock ? Math.max(0, clock() - ship.t) : 0);
  // Refine the best three windows that are clearly apart (a lap or a synodic
  // period apart, not two grid cells of the same window), keep the best.
  const seeds = [];
  for (const e of all) {
    if (seeds.length >= 3) break;
    if (e.tau < lead()) continue;
    if (seeds.every((s) => Math.abs(s.tau - e.tau) > dTau * 2.5)) seeds.push(e);
  }
  let best = null;
  for (const seed of seeds) {
    const cands = [seed];
    for (let a = -4; a <= 4; a++) {
      const lead0 = lead();
      for (let b = -5; b <= 5; b++) {
        const tau = seed.tau + (a * dTau) / 4;
        if (tau < lead0 || tau >= tClear) continue;
        const e = evaluate(tau, seed.dv + (b * dStep) / 5);
        if (e) cands.push(e);
      }
      yield; // a row at a time: the whole block was a 3-5 ms slice
    }
    const f = (yield* pickFineSteps(cands.filter((c) => c.tau >= lead()), 8)) || seed;
    if (f.tau >= lead() && (!best || score(f) < score(best))) best = f;
  }
  return best;
}
