// Chapter 6, Part E: the three ready-made routes back in through the solar
// system, and the sums for a plan (no drawing, so node can test it).
//
// The planets are lined up nearly in a row (about once every 175 years;
// Voyager 2 used it in 1977). She picks one of three routes, then sets how
// close each flyby passes: closer gives a bigger speed boost but needs more
// fuel to steer exactly. The last stop is always the Sun dive: the rock
// shield lets the ship skim the Sun and fire the drive at the closest point,
// where each bit of push counts most.
//
// Numbers are whole km/s and whole tonnes, so a 5th grader can add them
// (the Part E maths questions do). Real flybys give a few km/s (Jupiter up
// to about 10-13); the Sun-dive boost is the drive's, not gravity's alone.

/** How close she can set each flyby: 1 = far and gentle ... 4 = skimming. */
export const CLOSE_LEVELS = 4;
export const CLOSE_NAMES = Object.freeze([
  ['far', 'far'], ['medium', 'medium'], ['close', 'close'], ['skimming', 'very close'],
]);

/** Fuel she has for steering on the whole trip (tonnes). */
export const FUEL_BUDGET = 40;
/** The speed the route must reach before the drive goes on (km/s). */
export const GOAL_BOOST = 50;
/** Her speed at the edge before the first flyby (km/s), for the running total. */
export const START_SPEED = 5;

/**
 * Each stop: the speed boost (km/s) and the steering fuel (t) at closeness
 * 1..4. `danger` (Level 4 / Level 1 text) is why the closest setting is
 * risky; the plan still allows it, the flight's timing bar is just narrower.
 */
export const STOPS = Object.freeze({
  neptune: { name: ['Neptune', 'Neptune'], color: '#5b7cff', boost: [1, 2, 3, 4], fuel: [0, 2, 4, 8], danger: null },
  uranus: { name: ['Uranus', 'Uranus'], color: '#9fe3e8', boost: [1, 2, 3, 4], fuel: [0, 2, 4, 8], danger: null },
  saturn: {
    name: ['Saturn', 'Saturn'], color: '#e8c98a', boost: [2, 4, 6, 8], fuel: [0, 3, 6, 12],
    danger: ['Skimming Saturn passes inside the rings: dodge the ice!', 'Very close to Saturn means flying past the rings!'],
  },
  jupiter: {
    name: ['Jupiter', 'Jupiter'], color: '#e0a878', boost: [3, 6, 9, 12], fuel: [0, 4, 8, 16],
    danger: ['Skimming Jupiter means strong radiation: the rock shield takes it.', 'Very close to Jupiter has lots of bad rays!'],
  },
  earth: { name: ['Earth', 'Earth'], color: '#4f9fe8', boost: [1, 2, 3, 4], fuel: [0, 2, 4, 8], danger: null },
  sun: {
    name: ['the Sun', 'the Sun'], color: '#ffd27a', boost: [10, 20, 30, 40], fuel: [0, 5, 10, 20],
    danger: ['Skimming the Sun: only a rock shield could take that heat.', 'Very close to the Sun is very hot! The rock keeps us safe.'],
  },
});

/** The three ready-made routes (the plan doc's examples), outermost first. */
export const ROUTES = Object.freeze([
  { id: 'nj', title: ['Neptune, Jupiter, Sun', 'Neptune, Jupiter, Sun'], stops: ['neptune', 'jupiter', 'sun'] },
  { id: 'usj', title: ['Uranus, Saturn, Jupiter, Sun', 'Uranus, Saturn, Jupiter, Sun'], stops: ['uranus', 'saturn', 'jupiter', 'sun'] },
  { id: 'se', title: ['Saturn, Earth, Sun', 'Saturn, Earth, Sun'], stops: ['saturn', 'earth', 'sun'] },
]);

export const routeById = (id) => ROUTES.find((r) => r.id === id) || null;

/** A fresh plan for a route: every flyby at "medium". */
export function newPlan(routeId) {
  const r = routeById(routeId);
  if (!r) throw new Error(`no route ${routeId}`);
  return { route: r.id, close: r.stops.map(() => 2) };
}

/**
 * The sums for a plan: each stop's boost and fuel, the totals, and whether
 * it works (enough speed for the goal, inside the fuel budget).
 * @param {{route:string, close:number[]}} plan
 */
export function planTotals(plan) {
  const r = routeById(plan.route);
  const legs = r.stops.map((id, i) => {
    const c = Math.max(1, Math.min(CLOSE_LEVELS, Math.round(plan.close[i] ?? 2)));
    const s = STOPS[id];
    return { id, close: c, boost: s.boost[c - 1], fuel: s.fuel[c - 1], risky: c === CLOSE_LEVELS && !!s.danger };
  });
  const boost = legs.reduce((a, l) => a + l.boost, 0);
  const fuel = legs.reduce((a, l) => a + l.fuel, 0);
  return { legs, boost, fuel, enoughSpeed: boost >= GOAL_BOOST, inBudget: fuel <= FUEL_BUDGET, ok: boost >= GOAL_BOOST && fuel <= FUEL_BUDGET };
}

/** The best plan for a route (most boost inside the budget); for tests and autopilot. */
export function bestPlan(routeId) {
  const r = routeById(routeId);
  let best = null;
  const n = r.stops.length;
  const close = new Array(n).fill(1);
  const visit = (i) => {
    if (i === n) {
      const p = { route: routeId, close: [...close] };
      const tot = planTotals(p);
      if (tot.inBudget && (!best || tot.boost > best.tot.boost || (tot.boost === best.tot.boost && tot.fuel < best.tot.fuel))) best = { plan: p, tot };
      return;
    }
    for (let c = 1; c <= CLOSE_LEVELS; c++) { close[i] = c; visit(i + 1); }
  };
  visit(0);
  return best.plan;
}

// --- the flight: timing at each flyby ---------------------------------------------------

/**
 * How much of a flyby's boost a timing press keeps. `err` is how far off the
 * press was, as a fraction of the timing window's half-width (0 = perfect,
 * 1 = the window's edge). Inside the window she keeps at least 70%; a miss
 * keeps half. Closer flybys have narrower windows (see windowFor).
 */
export function keptFraction(err) {
  const e = Math.abs(err);
  if (e <= 0.25) return 1;
  if (e <= 1) return 1 - 0.4 * (e - 0.25);
  return 0.5;
}

/** Timing window half-width in seconds of slowed-down time, by closeness. */
export const windowFor = (close) => [0.9, 0.7, 0.5, 0.35][Math.max(1, Math.min(CLOSE_LEVELS, close)) - 1];

/** Boost actually kept on a leg (whole km/s, rounded). */
export const keptBoost = (leg, err) => Math.round(leg.boost * keptFraction(err));

// --- after the drive goes on --------------------------------------------------------------

export const LIGHT_KMS = 300000;
/** The fusion drive's cruise: 10% of light speed (the plan's lesson 6C number). */
export const CRUISE_PERCENT = 10;
/** % of light speed for a speed in km/s (one decimal place). */
export const percentOfLight = (kms) => Math.round((kms / LIGHT_KMS) * 1000) / 10;
/** Years to go `ly` light years at `pct` % of light speed. */
export const yearsAt = (ly, pct) => ly / (pct / 100);

/**
 * The flight's result: each leg's planned boost, the timing error of her
 * press (null = no press, a miss), the boost kept, and the running speed.
 * @param {{route:string, close:number[]}} plan
 * @param {(number|null)[]} errs one per stop
 */
export function flightResult(plan, errs) {
  const { legs } = planTotals(plan);
  let speed = START_SPEED;
  const out = legs.map((leg, i) => {
    const err = errs[i] == null ? 2 : errs[i];
    const kept = keptBoost(leg, err);
    speed += kept;
    return { ...leg, err, kept, speed };
  });
  return { legs: out, kept: speed - START_SPEED, speed };
}
