// Rocket flight simulation — the educational payload of the level.
//
// The lesson is the physics, not a cutscene: fuel is mass, and mass is the
// thing you are fighting. A rocket that carries more fuel has more delta-v but
// a worse thrust-to-weight ratio, so it crawls off the pad and pays for every
// slow second in gravity loss. A rocket that carries less leaps away and then
// runs dry. Somewhere between the two is a build that reaches ORBIT_ALTITUDE_M,
// and the child finds it by building, launching, and watching the readout.
//
// Deliberately headless: no THREE, no DOM, no rendering, no randomness. The
// only import is contracts.js for the shared orbit target, so the number the
// HUD shows and the number the sim tests against can never drift apart. Every
// constant below was tuned by running sweep() under node — see TUNING.
import { ORBIT_ALTITUDE_M } from './contracts.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Standard gravity at sea level, m/s^2. */
export const G0 = 9.81;

/** Mean Earth radius, m. Used to taper gravity with altitude. */
export const EARTH_RADIUS_M = 6.371e6;

/** Sea-level air density, kg/m^3. */
export const SEA_LEVEL_DENSITY = 1.225;

/**
 * Exponential atmosphere scale height, m. The real atmosphere is layered, but
 * a single 8.5 km exponential is within a few percent through the region where
 * drag actually matters (0-40 km) and is worth far more to a child than an
 * eight-branch lookup table: "air gets thinner as you go up, fast".
 */
export const SCALE_HEIGHT_M = 8500;

/**
 * Air density at an altitude.
 * @param {number} altitudeM
 * @returns {number} kg/m^3
 */
export function airDensity(altitudeM) {
  return SEA_LEVEL_DENSITY * Math.exp(-Math.max(0, altitudeM) / SCALE_HEIGHT_M);
}

/**
 * Gravity at an altitude.
 *
 * Tapered by inverse square rather than held constant. It costs one line, and
 * it matters here: at ORBIT_ALTITUDE_M gravity is 3% weaker than on the pad, so
 * a constant 9.81 quietly overstates the cost of the last stretch of the climb
 * — exactly the stretch the whole game is balanced around. Holding it constant
 * would have moved the sweet spot by about 200 kg of fuel.
 *
 * @param {number} altitudeM
 * @returns {number} m/s^2
 */
export function gravityAt(altitudeM) {
  const ratio = EARTH_RADIUS_M / (EARTH_RADIUS_M + Math.max(0, altitudeM));
  return G0 * ratio * ratio;
}

// ---------------------------------------------------------------------------
// Tuned vehicle constants
// ---------------------------------------------------------------------------

/** Hull, engine, guidance and payload: the parts that are always fitted. */
export const BASE_DRY_MASS_KG = 800;

/** Propellant in one fuel stage. */
export const FUEL_PER_TANK_KG = 1000;

/**
 * The empty tank itself. This constant is why the game has a lesson at all.
 *
 * With weightless tanks, more fuel is always better right up to the moment the
 * rocket cannot lift, so the "puzzle" is just "fill it to the brim" — the first
 * sweep of this sim confirmed it: apogee climbed 15 km -> 1,250 km with no
 * turnover anywhere. Real tanks weigh something, so each one the child bolts on
 * buys a fixed 1,000 kg of fuel while permanently carrying 200 kg of structure.
 * Past a point the extra structure costs more than the extra fuel earns, and the
 * curve turns over. That turnover is the trade-off the child has to find.
 */
export const TANK_DRY_MASS_KG = 200;

/** The build screen offers this many stages. */
export const MAX_FUEL_TANKS = 8;

/**
 * The village engine. One fixed engine for the whole game — the child changes
 * the rocket, never the motor, so every flight is a fair comparison.
 *
 * TUNING — every number below came out of sweep() under node, not out of the
 * air. Exhaust velocity is 80000/38 = 2,105 m/s (Isp ~215 s), which is a
 * modest but real pressure-fed engine, so the rocket-equation sums stay honest
 * for anyone who checks them later. Thrust of 80 kN means the stack stops
 * clearing the pad above ~8,150 kg, which lands the "too heavy to fly" wall at
 * seven tanks — inside the range the build screen offers, where the child can
 * actually hit it. The resulting apogee curve, in km by tank count:
 *
 *   1:16  2:51  3:98  |  4:126  5:130  6:116  |  7:93  8:76
 *
 * Three tanks misses by 2 km, which is the near-miss that makes a child try
 * again. Four to six reach orbit. Seven and eight sit on the pad for 28 s and
 * 59 s burning fuel before they can even lift, and never recover.
 */
export const ENGINE = Object.freeze({
  thrustN: 80_000,
  burnRateKgPerSec: 38,
});

/** Nose cone options, and what each does to drag. */
export const NOSE_CONES = Object.freeze({
  blunt: { dragCoefficient: 0.85, label: 'Flat top' },
  rounded: { dragCoefficient: 0.55, label: 'Rounded nose' },
  pointed: { dragCoefficient: 0.42, label: 'Pointed nose' },
});

/** Frontal area, m^2 — a 1.4 m rocket. Constant across builds. */
export const CROSS_SECTION_M2 = 1.5;

/**
 * Turn what the child built into a FlightConfig.
 *
 * Fitting a tank adds its propellant AND its empty mass, which is the single
 * most important line in this file: it is what makes over-fuelling cost
 * something.
 *
 * @param {object} [build]
 * @param {number} [build.fuelTanks]  fuel stages fitted, 0..MAX_FUEL_TANKS
 * @param {'blunt'|'rounded'|'pointed'} [build.noseCone]
 * @returns {object} FlightConfig
 */
export function flightConfigFromBuild({ fuelTanks = 5, noseCone = 'pointed' } = {}) {
  const tanks = Math.max(0, Math.min(MAX_FUEL_TANKS, Math.round(fuelTanks)));
  const cone = NOSE_CONES[noseCone] || NOSE_CONES.pointed;
  return {
    dryMassKg: BASE_DRY_MASS_KG + tanks * TANK_DRY_MASS_KG,
    fuelMassKg: tanks * FUEL_PER_TANK_KG,
    thrustN: ENGINE.thrustN,
    burnRateKgPerSec: ENGINE.burnRateKgPerSec,
    dragCoefficient: cone.dragCoefficient,
    crossSectionM2: CROSS_SECTION_M2,
  };
}

/** The build that works: five tanks and a pointed nose. Apogee 130 km. */
export const DEFAULT_FLIGHT = Object.freeze(flightConfigFromBuild());

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/**
 * Internal integration step, s. The sim runs on this regardless of what the
 * caller passes to step(), so a launch replays identically on any frame rate
 * and a headless sweep matches what the player saw.
 */
export const SIM_DT = 0.02;

/** Vertical, one dimensional. See the note on reachedOrbit(). */
function derivative(state, config) {
  const burning = state.fuelKg > 0;
  const massKg = config.dryMassKg + state.fuelKg;
  const thrust = burning ? config.thrustN : 0;
  const g = gravityAt(state.altitudeM);
  const v = state.velocityMs;
  const drag = 0.5 * airDensity(state.altitudeM) * v * v
    * config.dragCoefficient * config.crossSectionM2;
  // Drag always opposes motion, so it slows the climb and then slows the fall.
  const dragSigned = v >= 0 ? -drag : drag;
  return { accel: (thrust + dragSigned) / massKg - g, massKg, burning };
}

/**
 * Create a flight simulation. Matches the FlightSim contract.
 * @param {object} [config] FlightConfig; may also be supplied to ignite()
 * @returns {object} FlightSim
 */
export function createFlightSim(config = DEFAULT_FLIGHT) {
  let cfg = { ...config };
  let t = 0;
  let altitudeM = 0;
  let velocityMs = 0;
  let fuelKg = cfg.fuelMassKg;
  let accelMs2 = 0;
  let burning = false;
  let apogeeFlag = false;
  let apogeeM = 0;
  let liftoffT = null;
  let burnoutT = null;
  let landed = false;
  let carry = 0;

  function makeSample() {
    return {
      t,
      altitudeM,
      velocityMs,
      massKg: cfg.dryMassKg + fuelKg,
      accelMs2,
      burning,
      apogee: apogeeFlag,
    };
  }

  function integrate(dt) {
    if (landed) return;
    const before = velocityMs;
    const d = derivative({ altitudeM, velocityMs, fuelKg }, cfg);
    burning = d.burning;
    accelMs2 = d.accel;

    // On the pad with thrust below weight the rocket does not sink into the
    // concrete: it sits there burning fuel it will never get back. That is the
    // over-fuelled failure the child has to see, so it is modelled, not hidden.
    if (altitudeM <= 0 && d.accel <= 0 && velocityMs <= 0) {
      velocityMs = 0;
      altitudeM = 0;
      accelMs2 = 0;
    } else {
      velocityMs += d.accel * dt;
      altitudeM += velocityMs * dt;
      if (liftoffT === null && altitudeM > 0) liftoffT = t;
    }

    if (burning) {
      fuelKg = Math.max(0, fuelKg - cfg.burnRateKgPerSec * dt);
      if (fuelKg === 0 && burnoutT === null) burnoutT = t;
    }

    if (altitudeM > apogeeM) apogeeM = altitudeM;
    apogeeFlag = before > 0 && velocityMs <= 0;
    if (altitudeM < 0) {
      altitudeM = 0;
      velocityMs = 0;
      landed = true;
    }
    t += dt;
  }

  return {
    /**
     * Reset to the pad and (optionally) adopt a new build.
     * @param {object} [next] FlightConfig
     */
    ignite(next) {
      if (next) cfg = { ...next };
      t = 0;
      altitudeM = 0;
      velocityMs = 0;
      fuelKg = cfg.fuelMassKg;
      accelMs2 = 0;
      burning = cfg.fuelMassKg > 0;
      apogeeFlag = false;
      apogeeM = 0;
      liftoffT = null;
      burnoutT = null;
      landed = false;
      carry = 0;
    },

    /**
     * Advance by a wall-clock delta, consumed in fixed SIM_DT slices.
     * @param {number} dt seconds
     * @returns {object} FlightSample
     */
    step(dt) {
      carry += Math.max(0, Math.min(dt, 1));
      while (carry >= SIM_DT) {
        integrate(SIM_DT);
        carry -= SIM_DT;
      }
      return makeSample();
    },

    /** @returns {object} FlightSample */
    sample: makeSample,

    /**
     * True once the climb has passed the target altitude.
     *
     * This sim is vertical only, so "orbit" here is the Karman-line sense the
     * game means: got high enough. A real orbit also needs ~7.8 km/s sideways,
     * which is a lesson for a later level, not this one.
     * @returns {boolean}
     */
    reachedOrbit() {
      return apogeeM >= ORBIT_ALTITUDE_M;
    },

    /** Extra telemetry the HUD readout and the sweep both want. */
    stats() {
      return {
        t,
        apogeeM,
        liftoffT,
        burnoutT,
        fuelKg,
        landed,
        thrustToWeight: cfg.thrustN / ((cfg.dryMassKg + cfg.fuelMassKg) * G0),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Analysis — used for tuning, and by the HUD to explain the result
// ---------------------------------------------------------------------------

/**
 * Fly a config to apogee (or to a 30 minute cutoff) and summarise it.
 * @param {object} config FlightConfig
 * @param {object} [opts]
 * @param {number} [opts.maxSeconds]
 * @returns {object} summary
 */
export function simulate(config, { maxSeconds = 1800 } = {}) {
  const sim = createFlightSim(config);
  sim.ignite(config);
  let maxVelocity = 0;
  let altitudeAt10s = 0;
  let burnoutAltitude = 0;
  let burnoutVelocity = 0;
  let seenBurnout = false;

  const steps = Math.ceil(maxSeconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const s = sim.step(SIM_DT);
    if (s.velocityMs > maxVelocity) maxVelocity = s.velocityMs;
    if (!seenBurnout && !s.burning) {
      seenBurnout = true;
      burnoutAltitude = s.altitudeM;
      burnoutVelocity = s.velocityMs;
    }
    if (s.t >= 10 && altitudeAt10s === 0) altitudeAt10s = s.altitudeM;
    if (s.apogee) break;
    // A rocket with no tanks fitted never moves; don't spin 90,000 steps on it.
    if (!s.burning && s.altitudeM <= 0 && s.t > 1) break;
  }

  const st = sim.stats();
  return {
    fuelMassKg: config.fuelMassKg,
    liftoffMassKg: config.dryMassKg + config.fuelMassKg,
    thrustToWeight: st.thrustToWeight,
    liftoffT: st.liftoffT,
    altitudeAt10s,
    burnoutT: st.burnoutT,
    burnoutAltitudeM: burnoutAltitude,
    burnoutVelocityMs: burnoutVelocity,
    maxVelocityMs: maxVelocity,
    apogeeM: st.apogeeM,
    apogeeT: st.t,
    reachedOrbit: st.apogeeM >= ORBIT_ALTITUDE_M,
    verdict: verdictFor(st.apogeeM, st.thrustToWeight, st.liftoffT),
  };
}

/**
 * Classify a flight in the terms the game talks in.
 * @param {number} apogeeM
 * @param {number} twr thrust-to-weight at liftoff
 * @param {number|null} liftoffT seconds spent sitting on the pad before moving
 * @returns {'too-heavy'|'sluggish'|'short'|'orbit'}
 */
export function verdictFor(apogeeM, twr, liftoffT) {
  // Order matters: a rocket that could not lift its own weight is a different
  // mistake from one that flew fine and ran out of fuel, even when both end up
  // at the same altitude. The child needs to be told which one happened.
  if (twr < 1) return 'too-heavy';
  if (apogeeM >= ORBIT_ALTITUDE_M) return 'orbit';
  if (twr < 1.1 || (liftoffT ?? 0) > 0.5) return 'sluggish';
  return 'short';
}

/** One line per verdict, in the words the HUD should use. */
export const FLIGHT_ADVICE = Object.freeze({
  'too-heavy': 'Too much fuel! The rocket was heavier than its engine could push, so it sat on the pad burning fuel it never got to use.',
  sluggish: 'So heavy it barely left the pad. All that fuel is weight the engine has to lift too — try taking a tank off.',
  short: 'A clean launch, but it ran out of fuel too early. Try adding a fuel tank.',
  orbit: 'Orbit! Enough fuel to keep pushing, light enough to get moving fast.',
});

/**
 * Fly every tank count the build screen offers. This is the tuning harness:
 * the constants above came out of running it, and re-running it is how anyone
 * checks that the trade-off still has a findable sweet spot.
 *
 * @param {number[]} [tankCounts] defaults to 1..MAX_FUEL_TANKS
 * @param {object} [build] other build options, e.g. { noseCone: 'blunt' }
 * @returns {Array<object>} one summary per build, with `fuelTanks` attached
 */
export function sweep(tankCounts, build = {}) {
  const counts = tankCounts
    ?? Array.from({ length: MAX_FUEL_TANKS }, (_, i) => i + 1);
  return counts.map((fuelTanks) => ({
    fuelTanks,
    ...simulate(flightConfigFromBuild({ ...build, fuelTanks })),
  }));
}

/**
 * The best build in a sweep: highest apogee, tie-broken toward the lighter
 * rocket, because the lighter one is the better engineering answer.
 * @param {Array<object>} results from sweep()
 * @returns {object}
 */
export function bestOf(results) {
  return results.reduce((best, r) => (r.apogeeM > best.apogeeM + 1 ? r : best), results[0]);
}

export default {
  createFlightSim, simulate, sweep, bestOf, verdictFor,
  airDensity, gravityAt, flightConfigFromBuild,
  DEFAULT_FLIGHT, ENGINE, FUEL_PER_TANK_KG, TANK_DRY_MASS_KG,
  BASE_DRY_MASS_KG, MAX_FUEL_TANKS, NOSE_CONES, FLIGHT_ADVICE, SIM_DT,
};
