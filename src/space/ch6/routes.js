// Chapter 6, Part E: how to leave the Sun's family as fast as possible, from
// the asteroid belt (no drawing, so node can test it).
//
// Lead 2026-10-07: the rock ship is built in the asteroid belt. The question
// is real: with 10 t of fuel (or 100 t), which path leaves the solar system
// fastest? The score is her speed once she is far from the Sun.
//
// Five ready-made routes, each burning ALL the fuel once:
//   straight  burn it all now, straight out (the baseline)
//   js        Jupiter and Saturn flybys
//   jsu       Jupiter, Saturn, Uranus
//   jsun      Jupiter, Saturn, Uranus, Neptune (Voyager's "grand tour")
//   sun       Jupiter throws her inward, then a Sun dive: the burn at the
//             closest point to the Sun
// and for each flyby how close she passes (closer = the path bends more =
// more energy stolen; the Sun's closest setting needs the rock shield).
//
// The sums are a real two-body ("patched conic") model, with the planets
// lined up for her: the Sun's pull keeps her energy and spin as she coasts
// between planets; each flyby turns her speed relative to the planet by the
// angle the planet's gravity can bend it, towards the way the planet moves.
// The engine: a 1,000 t rock ship and a fusion drive (exhaust 300 km/s), so
// 10 t of fuel gives 3 km/s and 100 t gives 29 km/s. The kid sees whole
// km/s; the lessons quote these numbers.

const MU_SUN = 1.327e11; // km^3/s^2
const AU = 1.496e8; // km
const SUN_R = 696000; // km
/** Where she starts: the asteroid belt. */
export const START_AU = 2.8;

/** The ship: dry mass (t) and the drive's exhaust speed (km/s). */
export const SHIP = Object.freeze({ dry: 1000, exhaust: 300 });
/** The two fuel loads she plans for. */
export const FUELS = Object.freeze([10, 100]);
/** Speed the engine adds (km/s) for `fuel` tonnes: the rocket equation. */
export const engineKms = (fuel) => SHIP.exhaust * Math.log((SHIP.dry + fuel) / SHIP.dry);

/** How close she can set each flyby: 1 = far and gentle ... 4 = skimming. */
export const CLOSE_LEVELS = 4;
export const CLOSE_NAMES = Object.freeze([
  ['far', 'far'], ['medium', 'medium'], ['close', 'close'], ['skimming', 'very close'],
]);
/** Closest pass, in the planet's own radius, for each level. */
const PLANET_PASS = [6, 3, 1.6, 1.1];
/** Closest pass to the Sun, in Sun radii ("Sun-widths" to a child is close enough). */
export const SUN_PASS = Object.freeze([60, 30, 10, 4]);

export const STOPS = Object.freeze({
  jupiter: { name: ['Jupiter', 'Jupiter'], color: '#e0a878', au: 5.2, mu: 1.267e8, r: 71492, danger: ['Skimming Jupiter means strong radiation: the rock shield takes it.', 'Very close to Jupiter has lots of bad rays!'] },
  saturn: { name: ['Saturn', 'Saturn'], color: '#e8c98a', au: 9.54, mu: 3.793e7, r: 60268, danger: ['Skimming Saturn passes inside the rings: dodge the ice!', 'Very close to Saturn means flying past the rings!'] },
  uranus: { name: ['Uranus', 'Uranus'], color: '#9fe3e8', au: 19.2, mu: 5.794e6, r: 25559, danger: null },
  neptune: { name: ['Neptune', 'Neptune'], color: '#5b7cff', au: 30.1, mu: 6.837e6, r: 24764, danger: null },
  sun: { name: ['the Sun', 'the Sun'], color: '#ffd27a', au: 0, danger: ['4 Sun-widths from the Sun: only our thick rock shield could take that heat.', 'Very close to the Sun is very hot! The rock keeps us safe.'] },
});

/** The five routes. `fall` = Jupiter throws her inward (no closeness choice there). */
export const ROUTES = Object.freeze([
  { id: 'straight', title: ['Straight out: burn it all now', 'Straight out'], stops: [] },
  { id: 'js', title: ['Jupiter, Saturn', 'Jupiter, Saturn'], stops: ['jupiter', 'saturn'] },
  { id: 'jsu', title: ['Jupiter, Saturn, Uranus', 'Jupiter, Saturn, Uranus'], stops: ['jupiter', 'saturn', 'uranus'] },
  { id: 'jsun', title: ['Jupiter, Saturn, Uranus, Neptune', 'All four big planets'], stops: ['jupiter', 'saturn', 'uranus', 'neptune'] },
  { id: 'sun', title: ['Jupiter, then a Sun dive', 'Jupiter, then the Sun'], stops: ['sun'], fall: true },
]);

export const routeById = (id) => ROUTES.find((r) => r.id === id) || null;

/** A fresh plan: every flyby at "medium". */
export function newPlan(routeId, fuel = FUELS[0]) {
  const r = routeById(routeId);
  if (!r) throw new Error(`no route ${routeId}`);
  return { route: r.id, fuel, close: r.stops.map(() => 2) };
}

// --- the physics -------------------------------------------------------------------------

const energy = (s) => (s.vr * s.vr + s.vt * s.vt) / 2 - MU_SUN / s.r;
/**
 * Speed (km/s) she keeps once far from the Sun. Negative = the Sun still
 * holds her, by how much speed she is short (so a flyby that doesn't free
 * her yet still shows what it added).
 */
const farSpeed = (s) => { const e = energy(s); return Math.sign(e) * Math.sqrt(2 * Math.abs(e)); };

/** Coast out to radius r2 (energy and spin kept). Null if she can't reach it. */
function coastTo(s, r2) {
  const e = energy(s); const h = s.r * s.vt;
  const vt = h / r2;
  const vr2 = 2 * (e + MU_SUN / r2) - vt * vt;
  return vr2 < 0 ? null : { r: r2, vr: Math.sqrt(vr2), vt };
}

/** A flyby of `stop` at closeness `close`; `k` (0..1) scales the bend (timing). */
function flyby(s, stop, close, k = 1) {
  const V = Math.sqrt(MU_SUN / (stop.au * AU)); // the planet's speed round the Sun
  const rx = s.vr; const ry = s.vt - V; // her velocity seen from the planet
  const vrel = Math.hypot(rx, ry);
  const rp = stop.r * PLANET_PASS[close - 1];
  const bend = 2 * Math.asin(1 / (1 + (rp * vrel * vrel) / stop.mu)) * k;
  // Turn towards the planet's own direction of travel, as far as it can bend.
  const a0 = Math.atan2(ry, rx);
  let diff = Math.atan2(Math.sin(Math.PI / 2 - a0), Math.cos(Math.PI / 2 - a0));
  diff = Math.sign(diff) * Math.min(Math.abs(diff), bend);
  return { r: s.r, vr: vrel * Math.cos(a0 + diff), vt: vrel * Math.sin(a0 + diff) + V };
}

/**
 * Fly a plan. `ks[i]` (0..1, default 1) is how well each stop went (the
 * flight card's timing). Returns each event's speed-far-away after it.
 * @param {{route:string, fuel:number, close:number[]}} plan
 */
export function simulate(plan, ks = []) {
  const r = routeById(plan.route);
  const dv = engineKms(plan.fuel);
  const r0 = START_AU * AU;
  const v0 = Math.sqrt(MU_SUN / r0); // her circular orbit in the belt
  const steps = [];
  if (r.fall) {
    // Jupiter throws her into a fall towards the Sun (a free Jupiter flyby
    // turned backwards); at the closest point she fires the whole tank.
    const close = Math.max(1, Math.min(CLOSE_LEVELS, Math.round(plan.close[0] ?? 2)));
    const rp = SUN_PASS[close - 1] * SUN_R;
    const ra = STOPS.jupiter.au * AU;
    const vp = Math.sqrt((2 * MU_SUN * ra) / (rp * (rp + ra)));
    const k = ks[0] ?? 1;
    // A late or early press fires a bit away from the closest point: worth
    // less (the miss case fires out at Jupiter instead).
    const signed = (e) => Math.sign(e) * Math.sqrt(2 * Math.abs(e));
    const ideal = signed((vp + dv) ** 2 / 2 - MU_SUN / rp);
    const miss = signed((Math.sqrt((2 * MU_SUN * rp) / (ra * (rp + ra))) + dv) ** 2 / 2 - MU_SUN / ra);
    const out = miss + (ideal - miss) * k;
    // Before the burn, falling in from Jupiter: held by the Sun.
    steps.push({ id: 'jupiter', close: null, speed: signed(-MU_SUN / (rp + ra)), fall: true });
    steps.push({ id: 'sun', close, speed: out, risky: close === CLOSE_LEVELS, passKm: rp, speedThere: vp });
    return { steps, speed: out, dv };
  }
  let s = { r: r0, vr: 0, vt: v0 + dv };
  steps.push({ id: 'burn', close: null, speed: farSpeed(s) });
  for (let i = 0; i < r.stops.length; i++) {
    const stop = STOPS[r.stops[i]];
    const next = coastTo(s, stop.au * AU);
    if (!next) { steps.push({ id: r.stops[i], close: plan.close[i], speed: farSpeed(s), missed: true }); break; }
    const close = Math.max(1, Math.min(CLOSE_LEVELS, Math.round(plan.close[i] ?? 2)));
    s = flyby(next, stop, close, ks[i] ?? 1);
    steps.push({ id: r.stops[i], close, speed: farSpeed(s), risky: close === CLOSE_LEVELS && !!stop.danger });
  }
  return { steps, speed: farSpeed(s), dv };
}

/**
 * The sums for a plan, in whole km/s: each stop's speed-far-away after it
 * and what it added; the final speed; can she leave at all.
 */
export function planTotals(plan) {
  const sim = simulate(plan);
  // Energy (per kg, in (km/s)^2 / 2: "energy points") is what the lesson
  // talks about: the far-away speed is not additive, energy is.
  const pts = (v) => Math.round((Math.sign(v) * v * v) / 2);
  let prev = null; let prevE = null;
  const legs = sim.steps.map((st) => {
    const speed = Math.round(st.speed);
    const e = pts(st.speed);
    const gain = prev === null ? speed : speed - prev;
    const energyGain = prevE === null ? e : e - prevE;
    prev = speed; prevE = e;
    return { ...st, speed, gain, energy: e, energyGain };
  });
  const speed = Math.round(sim.speed);
  return { legs, speed, escapes: speed > 0, risky: legs.some((l) => l.risky), years: yearsTo(speed), engine: Math.round(sim.dv) };
}

/** The words for a speed-far-away score: leaving at N km/s, or held by the Sun. */
export function speedWords(v) {
  return v > 0 ? [`leaving at ${v} km/s`, `${v} km/s`] : [`the Sun still holds us (${-v} km/s short)`, 'the Sun still holds us'];
}

/** The best closeness settings for a route at this fuel (most speed). */
export function bestPlan(routeId, fuel = FUELS[0]) {
  const r = routeById(routeId);
  let best = null;
  const n = r.stops.length;
  const close = new Array(n).fill(1);
  const visit = (i) => {
    if (i === n) {
      const p = { route: routeId, fuel, close: [...close] };
      const v = simulate(p).speed;
      if (!best || v > best.v + 1e-9) best = { plan: p, v };
      return;
    }
    for (let c = 1; c <= CLOSE_LEVELS; c++) { close[i] = c; visit(i + 1); }
  };
  visit(0);
  return best.plan;
}

/** The fastest route of all at this fuel. */
export function fastestRoute(fuel) {
  let best = null;
  for (const r of ROUTES) {
    const p = bestPlan(r.id, fuel);
    const v = simulate(p).speed;
    if (!best || v > best.v) best = { plan: p, v };
  }
  return best.plan;
}

// --- the flight: timing at each stop ------------------------------------------------------

/**
 * How much of a flyby a timing press keeps. `err` is how far off the press
 * was, as a fraction of the timing window's half-width (0 = perfect, 1 = the
 * window's edge). Inside the window at least 70%; a miss keeps half.
 */
export function keptFraction(err) {
  const e = Math.abs(err);
  if (e <= 0.25) return 1;
  if (e <= 1) return 1 - 0.4 * (e - 0.25);
  return 0.5;
}

/** Timing window half-width in seconds of slowed-down time, by closeness. */
export const windowFor = (close) => [0.9, 0.7, 0.5, 0.35][Math.max(1, Math.min(CLOSE_LEVELS, close)) - 1];

/**
 * The flight's result: the plan flown with her timing presses (`errs`, one
 * per stop; null = no press, a miss).
 */
export function flightResult(plan, errs) {
  const r = routeById(plan.route);
  const ks = r.stops.map((_, i) => keptFraction(errs[i] == null ? 2 : errs[i]));
  const ideal = planTotals(plan);
  const sim = simulate(plan, ks);
  let prev = null;
  const legs = sim.steps.filter((st) => st.id !== 'burn' && !st.fall).map((st, i) => {
    const speed = Math.round(st.speed);
    const before = prev ?? Math.round(sim.steps[0].fall ? 0 : sim.steps[0].speed);
    prev = speed;
    return { id: st.id, close: st.close, err: errs[i] == null ? 2 : errs[i], kept: speed - before, speed, plannedSpeed: ideal.legs.find((l) => l.id === st.id)?.speed };
  });
  return { legs, speed: Math.round(sim.speed), planned: ideal.speed };
}

// --- after the drive goes on --------------------------------------------------------------

export const LIGHT_KMS = 300000;
/** The fusion drive's cruise: 10% of light speed (the plan's lesson 6C number). */
export const CRUISE_PERCENT = 10;
/** % of light speed for a speed in km/s (one decimal place). */
export const percentOfLight = (kms) => Math.round((kms / LIGHT_KMS) * 1000) / 10;
/** Years to go `ly` light years at `pct` % of light speed. */
export const yearsAt = (ly, pct) => ly / (pct / 100);
/** The nearest star, light years. */
export const NEAREST_STAR_LY = 4.2;
/** Years to the nearest star at `kms` (Infinity if she can't leave). */
export function yearsTo(kms) {
  if (!(kms > 0)) return Infinity;
  return Math.round((NEAREST_STAR_LY * 9.461e12) / kms / 3.156e7);
}
