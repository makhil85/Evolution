// Chapter 7's voyage maths: pure functions, no drawing, so node can test them
// (scripts/test-ch7-voyage.mjs). The cutscenes (opening.js, cruise.js), the
// star map (starMap.js) and the questions (questions.partA.js, questions.partE.js)
// all read their numbers from here.
//
// The model is special relativity for a ship at a steady 1 g (the story's
// fusion drive, which is pretend: no drive we can build today could do this).
// The units are years and light-years, so c = 1 light-year per year, and the
// ship's acceleration sets one constant: c/g in years, about 0.97 years.
//   rapidity  phi = atanh(v)                    (v as a fraction of light speed)
//   ship time   = (c/g) * phi                   (the clocks on board)
//   Earth time  = (c/g) * sinh(phi)             (the clocks on Earth)
//   distance    = (c/g) * (cosh(phi) - 1)       (light-years, from rest)
// Lead 2026-10-08: the drive goes to full power and keeps pushing to about 90%
// of light speed. No sleep pods, and no relativity lesson: the clocks are only
// a story (Level 4: "very fast clocks tick slower"; Level 1 says the same
// in short words). Starting speeds other than rest are allowed (tripPlan).

/** Tau Ceti, a Sun-like star: light takes this many years to get there. */
export const TAU_CETI_LY = 11.9;

/**
 * The Sun's nearest neighbours (the plan's distances, in light-years) and where
 * they are in the sky (right ascension and declination, degrees, J2000). Tau Ceti
 * is the target. Names are [Level 4, Level 1] (the same here). starMap.js draws them.
 */
export const NEIGHBOURS = Object.freeze([
  { id: 'alpha', name: ['Alpha Centauri', 'Alpha Centauri'], ly: 4.4, ra: 219.9, dec: -60.8 },
  { id: 'barnard', name: ['Barnard’s Star', 'Barnard’s Star'], ly: 6.0, ra: 269.5, dec: 4.7 },
  { id: 'sirius', name: ['Sirius', 'Sirius'], ly: 8.6, ra: 101.3, dec: -16.7 },
  { id: 'eps', name: ['Epsilon Eridani', 'Epsilon Eridani'], ly: 10.5, ra: 53.2, dec: -9.5 },
  { id: 'tau', name: ['Tau Ceti', 'Tau Ceti'], ly: TAU_CETI_LY, ra: 26.0, dec: -15.9, target: true },
]);
/** One g in the story, in m/s^2 (9.8, "about 10" to a child). */
export const G_MS2 = 9.8;
/** The speed of light, m/s. */
export const C_MS = 299792458;
/** A Julian year, in seconds. */
export const YEAR_S = 365.25 * 86400;
/** c/g in years: the one constant of the 1 g model (about 0.97). */
export const C_OVER_G_YEARS = (C_MS / G_MS2) / YEAR_S;
/** Where the full push stops: about 90% of light speed. */
export const TOP_SPEED = 0.9;
/** Where Chapter 6's cruise ends (10%). */
export const CRUISE_START = 0.1;
/** The speed the opening's dial climbs to, as a fraction of light speed (past 10%). */
export const OPENING_TO = 0.2;
/** The story's rounding of 1 g: the speed goes up by about this much every second (m/s). */
export const STORY_ACCEL = 10;

export const gamma = (v) => 1 / Math.sqrt(1 - v * v);
/** Rapidity: the speed in the story that adds up in a straight line (it has no upper limit). */
export const rapidity = (v) => Math.atanh(v);

/** Years on the ship's clocks to reach speed v from rest, at 1 g. */
export const shipYears = (v) => C_OVER_G_YEARS * rapidity(v);
/** Years on Earth's clocks for the same push. */
export const earthYears = (v) => C_OVER_G_YEARS * Math.sinh(rapidity(v));
/** Light-years covered from rest to speed v, at 1 g. */
export const lightYearsTo = (v) => C_OVER_G_YEARS * (Math.cosh(rapidity(v)) - 1);

/**
 * The dial's speed at fraction k (0..1) of a push from `from` to `to`. It moves in
 * rapidity, so the climb is steady for a steady 1 g.
 */
export function dialSpeed(from, to, k) {
  const kk = Math.min(1, Math.max(0, k));
  return Math.tanh(rapidity(from) + (rapidity(to) - rapidity(from)) * kk);
}

/**
 * The whole trip to Tau Ceti: speed up at 1 g to TOP_SPEED, coast, flip, and brake
 * at 1 g to rest at the star. `from` is the starting speed (0 = a standstill, the
 * plan's numbers; CRUISE_START or OPENING_TO = the chapter's own start).
 * The brake is the mirror of a push from rest. Times are in years, distances in light-years.
 */
export function tripPlan(from = 0, v = TOP_SPEED) {
  const phi = rapidity(v); const phi0 = rapidity(from);
  const accelShip = C_OVER_G_YEARS * (phi - phi0);
  const accelEarth = C_OVER_G_YEARS * (Math.sinh(phi) - Math.sinh(phi0));
  const accelLy = C_OVER_G_YEARS * (Math.cosh(phi) - Math.cosh(phi0));
  const brakeShip = shipYears(v);
  const brakeEarth = earthYears(v);
  const brakeLy = lightYearsTo(v);
  const coastLy = TAU_CETI_LY - accelLy - brakeLy;
  const coastEarth = coastLy / v;
  const coastShip = coastEarth / gamma(v);
  return {
    top: v,
    accelLy, coastLy, brakeLy,
    accelShip, coastShip, brakeShip,
    accelEarth, coastEarth, brakeEarth,
    shipYears: accelShip + coastShip + brakeShip,
    earthYears: accelEarth + coastEarth + brakeEarth,
  };
}

/** Years for light to get there, at a fraction of light speed (0.1 = 10%). */
export const yearsAtFraction = (ly, fraction) => ly / fraction;

/** Speed after `seconds` at full push (1 g), in m/s (not relativistic at these speeds). */
export const metresPerSecondAt = (seconds) => G_MS2 * seconds;

/** Percent of light speed, one decimal, for the dial. */
export const percentOf = (v) => Math.round(v * 1000) / 10;

/** The ship clock as words, in whole months: "1 year 3 months" (Level 1: "1 year, 3 months"). */
export function clockWords(years, { l1 = false } = {}) {
  const whole = Math.floor(years);
  const months = Math.round((years - whole) * 12);
  const y = whole === 1 ? 'year' : 'years';
  const m = months === 1 ? 'month' : 'months';
  return l1 ? `${whole} ${y}, ${months} ${m}` : `${whole} ${y} ${months} ${m}`;
}

// --- the questions' numbers, derived here (scripts/test-ch7-voyage.mjs checks them) -----

/** Part A: the trip to Tau Ceti at a tenth of light speed (119 years, the Chapter 6 cruise). */
export const TAU_YEARS_AT_TENTH = Math.round(yearsAtFraction(TAU_CETI_LY, 0.1));
/** Level 1: light takes about 12 years; ten times slower is 120. */
export const TAU_LEVEL1_LY = Math.round(TAU_CETI_LY);
export const TAU_LEVEL1_YEARS = TAU_LEVEL1_LY * 10;

/** Part E: after one minute at full push, about 600 m/s (the exact 9.8 x 60 = 588). */
export const MINUTE_SPEED_STORY = STORY_ACCEL * 60;
export const MINUTE_SPEED_EXACT = Math.round(metresPerSecondAt(60));
/** Level 1: after 5 seconds, 50 m/s (the story's 10 a second). */
export const FIVE_SECOND_SPEED = STORY_ACCEL * 5;

/** Part E: the clocks, rounded for the story (about 7 years for us, 14 on Earth). */
export const TRIP = tripPlan(0);
export const SHIP_YEARS_STORY = Math.round(TRIP.shipYears);
export const EARTH_YEARS_STORY = Math.round(TRIP.earthYears);
export const CLOCK_GAP_STORY = EARTH_YEARS_STORY - SHIP_YEARS_STORY;
