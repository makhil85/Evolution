// Chapter 4 physics - the ship: gravity, thrust, RCS, patched-conic SOI
// hand-off, collisions/landing, slingshots, rewind, and the HUD helpers
// (solar power, gravity meter, orbit elements).
//
// WHY RELATIVE-TO-DOMINANT-BODY (the SOI hand-off design). ship.x/z/vx/vz are
// stored heliocentric (every other module reads them that way), but each step
// is INTEGRATED relative to the current dominant body, not in raw heliocentric
// coordinates. Here is why that matters, found the hard way while writing
// this module's first energy-conservation test:
//
// A naive version integrates the ship's heliocentric velocity using only the
// dominant body's pull (patched conics: ignore the Sun while inside a
// planet's SOI). That looks safe - never transforming frames, always reading
// real analytic positions - but it silently drops a real force: the dominant
// body ITSELF is accelerating toward ITS parent (Earth toward the Sun, at
// about 0.16 u/s^2 here), while the ship next to it only ever feels Earth's
// ~11 u/s^2. Relative to Earth, that missing 0.16 u/s^2 acts like a small
// constant push, and because Earth's direction-to-Sun barely rotates over one
// fast low-orbit period, the push doesn't average out step to step - it pumps
// the orbit's energy every revolution. A "circular" low Earth orbit measured
// this way roughly DOUBLED in radius within 10 orbits in testing. Patched
// conics is only ever an approximation, but that is a modelling bug, not the
// approximation's real (much smaller, genuinely periodic) error.
//
// The fix used here: each step, convert the ship to a position/velocity
// RELATIVE to the dominant body using that body's EXACT analytic state
// (orbits.bodyState - never itself integrated, so this conversion is lossless
// every single step, not just at an SOI crossing). Integrate that relative
// state through pure two-body gravity (+ thrust, which is frame-independent)
// with symplectic Euler - this is a clean Kepler problem with no missing
// terms, and conserves energy to float64 precision over hundreds of orbits
// (see scripts/test-space-physics.mjs). Then reconstruct ship.x/z/vx/vz by
// adding the SAME body's exact analytic state at the new time. Position and
// velocity are therefore always expressed correctly in the single shared
// heliocentric frame (dominantBody(), collisions, rendering, everything else
// in this codebase can keep reading ship.x/z/vx/vz exactly as before) while
// the physics never has an unaccounted-for acceleration term.
//
// WHICH PULLS (2026-10-05, gravity.js): the dominant body only picks the
// frame. Inside a planet's zone the planet AND all its moving moons pull
// together, so the Moon tugs her the whole way out from Earth instead of
// switching on at its small zone edge; out between the planets it is the
// Sun alone. The same accelRel() drives the dotted path (predictor.js).
//
// Pure JS, float64, no three.js import - must run under plain `node`.

import { BODIES, SHIP, SOLAR, WARP_LEVELS, AUTOPILOT_WARP, CRUISE_WARP, WARP_SAFE_RADII, RADIATION, PHYSICS_DT, EVENTS } from './contracts.js';
import { allStates, bodyState, dominantBody } from './orbits.js';
import { keplerPropagate } from './predictor.js';
import { accelRel } from './gravity.js';

const _gAcc = { ax: 0, az: 0 };

/** Fastest she can spin, rad/s (flight assist; see stepShip). */
const MAX_SPIN = 1.8;
/** Side thrusters' push, as a fraction of the main engine (Z / X). */
const SIDE_THRUST = 0.1;

/** Shift ("precision") thrust: gentler control, same fuel economy per unit of accel. */
const PRECISION_SCALE = 0.3;

/** Minimum heliocentric-of-parent speed gain/loss (u/s) worth calling a slingshot. */
const SLINGSHOT_MIN_GAIN = 0.05;

/**
 * Piecewise-linear map from compressed heliocentric game distance (u) to a
 * REAL distance from the Sun in AU. The game compresses distances a lot less
 * than it compresses the 1/r^2 falloff the story teaches (Jupiter at 1/27 of
 * Earth's sunlight, not the 1/9 that raw game units would give), so solar
 * power is computed against this real scale while gravity stays in raw game
 * units (that's the flight model - see SHIP/BODIES gm). Anchors are the
 * bodies' actual orbit radii (u) mapped to their real semi-major axes (AU);
 * distances past Neptune extrapolate with the last segment's slope.
 */
const AU_ANCHORS = [
  [0, 0],
  [6000, 1.0],     // Earth
  [9000, 1.52],    // Mars
  [11000, 2.2],    // belt inner
  [13500, 3.3],    // belt outer
  [20000, 5.2],    // Jupiter
  [32000, 9.5],    // Saturn
  [42000, 19.2],   // Uranus
  [50000, 30.1],   // Neptune
];

/** Real AU for a heliocentric game distance (u). See AU_ANCHORS above. */
export function realAU(distance) {
  const d = Math.max(0, distance);
  if (d <= AU_ANCHORS[0][0]) return 0;
  for (let i = 1; i < AU_ANCHORS.length; i++) {
    const [d0, a0] = AU_ANCHORS[i - 1];
    const [d1, a1] = AU_ANCHORS[i];
    if (d <= d1) {
      const frac = (d - d0) / (d1 - d0);
      return a0 + frac * (a1 - a0);
    }
  }
  const [d0, a0] = AU_ANCHORS[AU_ANCHORS.length - 2];
  const [d1, a1] = AU_ANCHORS[AU_ANCHORS.length - 1];
  const slope = (a1 - a0) / (d1 - d0);
  return a1 + slope * (d - d1);
}

/**
 * Solar power available at heliocentric (x, z), in the same units as
 * SOLAR.panelPowerAtEarth. Uses REAL AU (realAU, above) so the inverse-square
 * lesson pays off at the real ratios the questions teach (Jupiter = 1/27),
 * not the compressed-geometry ratio. `multiplier` is the panel upgrade
 * (SOLAR.bigWingsMultiplier) or 1 for base panels. realAU is clamped to a
 * floor of 0.3 so a ship parked right on top of the Sun doesn't divide by ~0.
 */
export function solarPower(x, z, multiplier = 1) {
  const dist = Math.hypot(x, z);
  const au = Math.max(0.3, realAU(dist));
  return (SOLAR.panelPowerAtEarth / (au * au)) * multiplier;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function shipMass(ship) {
  return SHIP.dryMass + ship.fuel + ship.cargo;
}

/** The Sun never moves - a fixed zero state, reused wherever domId is 'sun'. */
const _sunState = Object.freeze({ x: 0, z: 0, vx: 0, vz: 0 });

/**
 * Create a fresh ship. Heliocentric x/z/vx/vz; angle is heading in the plane,
 * 0 = +X, increasing counter-clockwise (identical convention to orbits.js -
 * see its header). angVel is rad/s. `soi` is the dominant body id and is
 * computed from position at t if not supplied. landedOn is a body id or null.
 */
export function createShipState(opts = {}) {
  const x = opts.x ?? 0;
  const z = opts.z ?? 0;
  const t = opts.t ?? 0;
  return {
    x, z,
    vx: opts.vx ?? 0,
    vz: opts.vz ?? 0,
    angle: opts.angle ?? 0,
    angVel: opts.angVel ?? 0,
    fuel: opts.fuel ?? SHIP.fuelMass,
    cargo: opts.cargo ?? 0,
    soi: opts.soi ?? dominantBody(x, z, t),
    landedOn: opts.landedOn ?? null,
    t,
    // internal, used only while landedOn is set (tidal-lock surface offset)
    _landAngle: opts._landAngle ?? 0,
    _landDist: opts._landDist ?? 0,
    // internal, slingshot bookkeeping keyed by body id
    _slingshot: opts._slingshot ? { ...opts._slingshot } : {},
  };
}

/** Deep-enough copy for the rewind buffer / determinism tests. */
function cloneShip(ship) {
  return { ...ship, _slingshot: { ...ship._slingshot } };
}

/** Fraction of a full tank the "never stranded" emergency top-up gives. */
const EMERGENCY_TOPUP_FRACTION = 0.15;

/**
 * Add fuel (a tanker docking, melted ice, an Europa refill) up to `capacity`
 * (SHIP.fuelMass by default - pass a bigger number once the Bigger Tank
 * upgrade is bought, since that upgrade raises capacity, not this constant).
 * Returns the ship's new fuel amount.
 */
export function refuel(ship, tonnes, capacity = SHIP.fuelMass) {
  ship.fuel = Math.min(capacity, ship.fuel + Math.max(0, tonnes));
  return ship.fuel;
}

/**
 * The "never stranded" rule: missions.js calls this when the ship is out of
 * fuel AND not coasting toward anything useful (that judgement - is she on a
 * path to the goal? - needs mission/trajectory context this module doesn't
 * have, so it lives in missions.js; this is just the mechanical top-up).
 * Gives a small amount (15% of a tank) - enough for a correction burn or two,
 * not a free ride - and only when the tank is actually empty, so it can't be
 * used as a convenience top-off. Returns the amount given (0 if fuel > 0).
 */
export function emergencyTopUp(ship, capacity = SHIP.fuelMass) {
  if (ship.fuel > 0) return 0;
  const given = Math.min(capacity, capacity * EMERGENCY_TOPUP_FRACTION);
  ship.fuel += given;
  return given;
}

const _statesA = {}; // scratch for HUD helpers (gravityInfo/orbitElements/etc.)
const _statesB = {}; // states at the end of a step (SOI/collision check)
const _startScratch = { x: 0, z: 0, vx: 0, vz: 0 }; // single-body state at a step's start

function updateLandedPosition(ship) {
  const b = BODIES[ship.landedOn];
  const s = bodyState(ship.landedOn, ship.t, _statesB[ship.landedOn] || (_statesB[ship.landedOn] = {}));
  const omega = b.period !== Infinity ? (2 * Math.PI) / b.period : 0;
  const theta = b.phase + omega * ship.t;
  const ang = ship._landAngle + theta;
  const c = Math.cos(ang);
  const si = Math.sin(ang);
  ship.x = s.x + ship._landDist * c;
  ship.z = s.z + ship._landDist * si;
  ship.vx = s.vx - ship._landDist * omega * si;
  ship.vz = s.vz + ship._landDist * omega * c;
  // A landed ship stands UPRIGHT, nose pointing straight away from the ground
  // (and turning with the body). Lead playtest: it used to keep its landing
  // heading, lying sideways along the ground, and couldn't rotate while
  // landed, so W pushed her into the surface and liftoff never happened.
  ship.angle = ang;
  ship.angVel = 0;
}

function land(ship, bodyId, states) {
  const b = BODIES[bodyId];
  const s = states[bodyId];
  const omega = b.period !== Infinity ? (2 * Math.PI) / b.period : 0;
  const theta = b.phase + omega * ship.t;
  const dx = ship.x - s.x;
  const dz = ship.z - s.z;
  ship._landDist = Math.hypot(dx, dz);
  ship._landAngle = Math.atan2(dz, dx) - theta;
  ship.landedOn = bodyId;
  ship.soi = bodyId;
  updateLandedPosition(ship);
}

/**
 * Advance the ship by exactly dt seconds (use PHYSICS_DT; stepWorld
 * sub-steps under warp). input = {thrust:-1..1, turn:-1..1, precision, steady}.
 * Returns an array of events (EVENTS.* shapes) - the caller owns the bus.
 * `clearOfZones` (stepWorld's promise that she is in the Sun's pull and
 * can't reach any planet's gravity zone this step) skips the zone search,
 * the costly part under time warp; the result is identical.
 */
export function stepShip(ship, input = {}, dt = PHYSICS_DT, clearOfZones = false) {
  const events = [];
  const thrustIn = clamp(input.thrust || 0, -1, 1);
  const turnIn = clamp(input.turn || 0, -1, 1);
  const strafeIn = clamp(input.strafe || 0, -1, 1);

  if (ship.landedOn) {
    const canLift = ship.fuel > 0 && thrustIn > 0;
    if (!canLift) {
      ship.t += dt;
      updateLandedPosition(ship);
      return events;
    }
    // Liftoff: unstick this same tick and fall through to normal flight.
    ship.landedOn = null;
  }

  // Only ONE body's state is needed to source gravity at the step's start -
  // a single bodyState() call, not a full allStates() scan over all 13
  // bodies (allStates is only needed at the END, to search for a NEW
  // dominant body). This roughly halves stepShip's cost, which matters a lot
  // to the predictor's thousands-of-steps-per-call budget.
  const domStart = ship.soi;
  const sStart = domStart === 'sun' ? _sunState : bodyState(domStart, ship.t, _startScratch);

  // Ship state RELATIVE to the dominant body (see the header comment for why).
  let rx = ship.x - sStart.x;
  let rz = ship.z - sStart.z;
  let rvx = ship.vx - sStart.vx;
  let rvz = ship.vz - sStart.vz;

  // Every pull she feels here (gravity.js): the Sun alone out between the
  // planets; inside a planet's zone the planet AND its moons, all moving.
  accelRel(domStart, rx, rz, ship.t, _gAcc);
  const gax = _gAcc.ax;
  const gaz = _gAcc.az;

  const mass = shipMass(ship);
  const scale = input.precision ? PRECISION_SCALE : 1;
  const canThrust = ship.fuel > 0;
  const thrustAccelMag = canThrust ? (thrustIn * scale * SHIP.thrust) / mass : 0;
  const dirx = Math.cos(ship.angle);
  const dirz = Math.sin(ship.angle);

  // Thrust is frame-independent, so it applies the same to the relative
  // velocity as it would heliocentric.
  // Side thrusters (Z / X): a gentle push square to her nose, for lining up
  // on an asteroid without turning the whole ship. +1 = to her right (turn
  // +1 raises the heading angle, so her right is heading + 90 degrees).
  const strafeAccel = canThrust ? (strafeIn * SIDE_THRUST * scale * SHIP.thrust) / mass : 0;
  const ax = gax + thrustAccelMag * dirx - strafeAccel * dirz;
  const az = gaz + thrustAccelMag * dirz + strafeAccel * dirx;

  // Semi-implicit (symplectic) Euler on the RELATIVE state: update velocity
  // from the force at the step's start position, then advance position with
  // the NEW velocity. This is a clean two-body (+thrust) problem - no missing
  // acceleration term - so it conserves energy over many orbits.
  rvx += ax * dt;
  rvz += az * dt;
  rx += rvx * dt;
  rz += rvz * dt;

  if (canThrust && (thrustIn !== 0 || strafeIn !== 0)) {
    const burn = (Math.abs(thrustIn) + Math.abs(strafeIn) * SIDE_THRUST) * scale * SHIP.fuelBurn * (ship.burnScale ?? 1) * dt;
    ship.fuel = Math.max(0, ship.fuel - burn);
  }

  // RCS: steady (space) damps spin to zero; otherwise A/D applies torque.
  if (input.steady) {
    const damp = SHIP.rcsTorque * dt;
    if (Math.abs(ship.angVel) <= damp) ship.angVel = 0;
    else ship.angVel -= Math.sign(ship.angVel) * damp;
  } else if (turnIn !== 0) {
    ship.angVel += turnIn * SHIP.rcsTorque * dt;
  } else {
    // Flight assist (lead playtest): with no limit and no damping, holding a
    // turn key spun her up to 38 rad/s and she stayed tumbling. A released
    // key now eases the spin away on its own; Space still stops it fast.
    ship.angVel *= Math.exp(-1.6 * dt);
    if (Math.abs(ship.angVel) < 1e-3) ship.angVel = 0;
  }
  // ...and spin never exceeds about a third of a turn per second.
  if (ship.angVel > MAX_SPIN) ship.angVel = MAX_SPIN;
  else if (ship.angVel < -MAX_SPIN) ship.angVel = -MAX_SPIN;
  ship.angle += ship.angVel * dt;

  ship.t += dt;

  // Reconstruct heliocentric position/velocity using the dominant body's
  // EXACT analytic state at the NEW time - this conversion is lossless (the
  // body's rail is never itself integrated), so ship.x/z/vx/vz stay correct
  // heliocentric coordinates for everything else in the codebase to read.
  if (clearOfZones && domStart === 'sun') {
    ship.x = rx; ship.z = rz; ship.vx = rvx; ship.vz = rvz;
    return events;
  }
  const statesEnd = allStates(ship.t, _statesB);
  const sEnd = domStart === 'sun' ? _sunState : statesEnd[domStart];
  ship.x = rx + sEnd.x;
  ship.z = rz + sEnd.z;
  ship.vx = rvx + sEnd.vx;
  ship.vz = rvz + sEnd.vz;

  const domEnd = dominantBody(ship.x, ship.z, ship.t, statesEnd);

  if (domEnd !== domStart) {
    events.push({ type: EVENTS.SOI_CHANGE, from: domStart, to: domEnd });
    handleSlingshotEntry(ship, domEnd, statesEnd);
    handleSlingshotExit(ship, domStart, statesEnd, events);
  }
  ship.soi = domEnd;

  if (domEnd !== 'sun') {
    const b = BODIES[domEnd];
    const s = statesEnd[domEnd];
    const dx = ship.x - s.x;
    const dz = ship.z - s.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= b.radius + SHIP.collisionRadius) {
      const relSpeed = Math.hypot(ship.vx - s.vx, ship.vz - s.vz);
      // ship.safeLandingSpeed is set by the flying mode (Easy is gentler).
      if (b.landable && relSpeed <= (ship.safeLandingSpeed ?? SHIP.safeLandingSpeed)) {
        land(ship, domEnd, statesEnd);
        events.push({ type: EVENTS.LANDED, body: domEnd, speed: relSpeed });
      } else {
        events.push({ type: EVENTS.CRASH, body: domEnd, speed: relSpeed });
      }
    }
  }

  return events;
}

function handleSlingshotEntry(ship, enteredId, states) {
  if (enteredId === 'sun') return;
  const parentId = BODIES[enteredId].parent;
  const speed = speedRelativeToParent(ship, parentId, states);
  ship._slingshot[enteredId] = { parentId, speed };
}

function handleSlingshotExit(ship, exitedId, states, events) {
  if (exitedId === 'sun') return;
  const record = ship._slingshot[exitedId];
  if (!record) return;
  const speedOut = speedRelativeToParent(ship, record.parentId, states);
  const gain = speedOut - record.speed;
  if (Math.abs(gain) >= SLINGSHOT_MIN_GAIN) {
    events.push({
      type: EVENTS.SLINGSHOT,
      body: exitedId,
      speedIn: record.speed,
      speedOut,
      fuelSaved: gain > 0 ? fuelForDeltaV(ship, gain) : 0,
    });
  }
  delete ship._slingshot[exitedId];
}

function speedRelativeToParent(ship, parentId, states) {
  if (parentId === 'sun' || !parentId) return Math.hypot(ship.vx, ship.vz);
  const s = states[parentId];
  return Math.hypot(ship.vx - s.vx, ship.vz - s.vz);
}

/** Rocket-equation fuel a burn of this size would cost at the ship's current mass. */
function fuelForDeltaV(ship, deltaV) {
  const m0 = shipMass(ship);
  const exhaustV = SHIP.thrust / SHIP.fuelBurn; // thrust = ve * massFlowRate
  const m1 = m0 * Math.exp(-deltaV / exhaustV);
  return Math.max(0, m0 - m1);
}

const _nearScratch = {};

function nearestBodyWithin(ship, radiiFactor, safeBody = null, pathClear = false, target = null) {
  const states = allStates(ship.t, _nearScratch);
  for (const id of Object.keys(BODIES)) {
    const b = BODIES[id];
    if (id === 'sun') continue;
    const s = states[id];
    const dist = Math.hypot(ship.x - s.x, ship.z - s.z);
    // Capped at 400 u (lead playtest): for Jupiter, 12 radii = 1,320 u covered
    // Europa's whole orbit, so every wait out there ran in real time.
    // On a safe orbit round this body (the caller checked: well clear of the
    // ground, no crash ahead) only its last 3 radii are no-warp: on Hard the
    // zone round Earth covered her whole Moon-transfer orbit, and a 440 s
    // wait for the burn window ran in real time.
    // The body whose pull she is in (the one she is leaving) also shrinks to
    // 3 radii while her dotted path shows no crash (lead playtest, Level 4):
    // Earth's 12-radii zone covered most of the Earth-Moon trip, so on
    // Medium and Hard keys 2-4 did nothing at all. Every OTHER body keeps its
    // full zone - the one she is flying TO (that is what drops her out of
    // warp in time for the capture burn; without it the autopilot sailed
    // past the Moon at x16) and any moon on the way (at 3 radii, Hard ran
    // into Europa at x64 crossing Jupiter's system).
    const small = id === safeBody || (pathClear && id === ship.soi && id !== target);
    const factor = small ? Math.min(3, radiiFactor) : radiiFactor;
    if (dist <= Math.min(b.radius * factor, 400)) return id;
  }
  const jup = BODIES.jupiter;
  const js = states.jupiter;
  const distJup = Math.hypot(ship.x - js.x, ship.z - js.z);
  if (RADIATION.body === 'jupiter' && distJup >= RADIATION.inner && distJup <= RADIATION.outer) {
    return 'jupiter-radiation';
  }
  return null;
}

const PLANETS = Object.keys(BODIES).filter((id) => BODIES[id].parent === 'sun');
const PLANET_SPEED_MAX = Math.max(...PLANETS.map((id) => (2 * Math.PI * BODIES[id].orbit) / BODIES[id].period));

/** Most physics steps one frame may run: x256 at 60 fps is 512 (~2 ms). */
const MAX_STEPS_PER_CALL = 1200;

/**
 * Run fixed PHYSICS_DT steps to cover realDt*warp of simulation time
 * (accumulator pattern - warp runs MORE steps, never bigger ones). Refuses
 * warp > 1 within WARP_SAFE_RADII body-radii of any body, or inside Jupiter's
 * radiation zone. Returns {steps, warpAllowed, reason, events}.
 */
export function stepWorld(ship, input, realDt, warp, { warpSafeRadii = WARP_SAFE_RADII, safeBody = null, pathClear = false, target = null, autopilot = false, boost = false, cruise = false } = {}) {
  const requested = WARP_LEVELS.includes(warp) ? warp : 1;
  let blocker = requested > 1 ? nearestBodyWithin(ship, warpSafeRadii, safeBody, pathClear, target) : null;
  // The autopilot reacts every frame, and warp never makes the physics less
  // exact (more steps, not bigger ones), so the no-warp zones - which exist
  // for a child's reaction time - only slow it down: x16 in the wide zones,
  // x4 within 3 radii, while the predicted path hits nothing. Without this,
  // Jupiter's moon zones made the autopilot coast in real time for minutes.
  let cap = Infinity;
  if (blocker && autopilot && pathClear) {
    cap = nearestBodyWithin(ship, Math.min(3, warpSafeRadii), safeBody, pathClear, target) ? 4 : 16;
    blocker = null;
  }
  const warpAllowed = !blocker;
  let effectiveWarp = warpAllowed ? Math.min(requested, cap) : 1;
  // The autopilot's cruise warp (AUTOPILOT_WARP): only out between the
  // planets (in the Sun's pull, so outside every planet's gravity zone and
  // its no-warp zone), path clear, engine off, at the top warp. The long
  // coasts on Easy (where the autopilot flies) took a minute or more at x64
  // with nothing for her to do. Still more steps, never bigger ones.
  if (boost && autopilot && pathClear && warpAllowed && cap === Infinity && requested === WARP_LEVELS[WARP_LEVELS.length - 1]
    && ship.soi === 'sun' && !ship.landedOn && !(input.thrust > 0)) effectiveWarp = AUTOPILOT_WARP;
  // Chapter 5's cruise (CRUISE_WARP): the same place, for her too.
  const cruising = cruise && pathClear && warpAllowed && cap === Infinity && requested === WARP_LEVELS[WARP_LEVELS.length - 1]
    && ship.soi === 'sun' && !ship.landedOn && !input.thrust && !input.strafe;
  if (cruising) effectiveWarp = CRUISE_WARP;
  const reason = blocker
    ? (blocker === 'jupiter-radiation'
      ? 'inside Jupiter\'s radiation zone'
      : `too close to ${BODIES[blocker]?.name || blocker} for warp`)
    : null;

  ship._accum = (ship._accum || 0) + realDt * effectiveWarp;
  const events = [];
  let steps = 0;
  // Burn computer: with input.burnBudget = { remaining, aim } the engine
  // cuts itself off once `remaining` u/s has been delivered along `aim`
  // (radians, or null for "wherever she points"), trimming the last step to
  // the exact amount. Playtest: a correction of 0.1 u/s is 0.03 s at full
  // thrust, far too short for a child's tap, and every one overshot.
  const budget = input.burnBudget;
  let dvUsed = 0;
  let stepInput = input;
  // In the Sun's pull, how many steps until she could possibly reach a
  // planet's gravity zone (her speed, plus the fastest planet's, plus what
  // the engine and the Sun's pull could add over this whole call)? Until
  // then each step skips the zone search (see stepShip): about 2/3 of a
  // step's cost, and under the autopilot's x256 there are 512 a frame.
  let clearSteps = 0;
  if (ship.soi === 'sun' && !ship.landedOn) {
    const dur = ship._accum;
    const r = Math.hypot(ship.x, ship.z) || 1;
    const states = allStates(ship.t, _nearScratch);
    let gap = Infinity;
    for (const id of PLANETS) gap = Math.min(gap, Math.hypot(ship.x - states[id].x, ship.z - states[id].z) - BODIES[id].soi);
    const aMax = (SHIP.thrust * (1 + SIDE_THRUST)) / SHIP.dryMass + BODIES.sun.gm / (r * r);
    const vBound = Math.hypot(ship.vx, ship.vz) + aMax * dur + PLANET_SPEED_MAX;
    if (gap > 0) clearSteps = Math.floor((0.8 * gap) / (vBound * PHYSICS_DT));
  }
  // Cruising: the part of this call that can't reach any planet's zone is
  // a pure Sun-gravity coast, jumped in one exact Kepler step (the same
  // formula the predictor draws her path with). The rest is stepped as usual.
  if (cruising && clearSteps > 2) {
    const n = Math.min(clearSteps - 1, Math.floor(ship._accum / PHYSICS_DT));
    if (n > 0) {
      const q = keplerPropagate(ship.x, ship.z, ship.vx, ship.vz, BODIES.sun.gm, n * PHYSICS_DT);
      ship.x = q.x; ship.z = q.z; ship.vx = q.vx; ship.vz = q.vz;
      ship.t += n * PHYSICS_DT;
      ship._accum -= n * PHYSICS_DT;
      clearSteps -= n;
      if (input.steady) ship.angVel = 0;
      else ship.angVel *= Math.exp(-1.6 * n * PHYSICS_DT);
      ship.angle += ship.angVel * PHYSICS_DT;
    }
  }
  while (ship._accum >= PHYSICS_DT && steps < MAX_STEPS_PER_CALL) {
    if (budget && input.thrust > 0) {
      const scale = input.precision ? PRECISION_SCALE : 1;
      const a = (input.thrust * scale * SHIP.thrust) / shipMass(ship);
      const along = budget.aim === null || budget.aim === undefined ? 1 : Math.max(0, Math.cos(ship.angle - budget.aim));
      const stepDv = a * PHYSICS_DT * along;
      const left = budget.remaining - dvUsed;
      const k = left <= 0 ? 0 : stepDv > left ? left / stepDv : 1;
      stepInput = k === 1 ? input : { ...input, thrust: input.thrust * k };
      dvUsed += stepDv * k;
    }
    const e = stepShip(ship, stepInput, PHYSICS_DT, steps < clearSteps);
    if (e.length) events.push(...e);
    ship._accum -= PHYSICS_DT;
    steps++;
  }
  // A frame that hit the cap drops the rest (the game runs a little slower
  // for a moment) instead of carrying it on: carried over, a slow device
  // at high warp would owe more steps every frame and grind to a halt.
  if (steps >= MAX_STEPS_PER_CALL) ship._accum = Math.min(ship._accum, PHYSICS_DT);
  return { steps, warpAllowed, reason, events, dvUsed, warp: effectiveWarp };
}

/** A rolling snapshot buffer for the "R" rescue key. */
export function createRewind(seconds) {
  const snapshots = [];
  return {
    push(ship) {
      snapshots.push(cloneShip(ship));
      const cutoff = ship.t - seconds - 1;
      while (snapshots.length && snapshots[0].t < cutoff) snapshots.shift();
    },
    rewind(ship, secondsAgo) {
      const targetT = ship.t - secondsAgo;
      let chosen = null;
      for (const s of snapshots) {
        if (s.t <= targetT) chosen = s;
        else break;
      }
      if (!chosen) chosen = snapshots[0] || null;
      if (!chosen) return false;
      Object.assign(ship, cloneShip(chosen));
      return true;
    },
  };
}

/** {body, accel, distance} for the dominant body pulling on the ship right now. */
export function gravityInfo(ship) {
  const states = allStates(ship.t, _statesA);
  const domId = ship.soi;
  const gm = domId === 'sun' ? BODIES.sun.gm : BODIES[domId].gm;
  const s = domId === 'sun' ? { x: 0, z: 0 } : states[domId];
  const dx = s.x - ship.x;
  const dz = s.z - ship.z;
  const distance = Math.hypot(dx, dz);
  const accel = gm / (distance * distance || 1e-9);
  return { body: domId, accel, distance };
}

/**
 * Orbital elements of the ship relative to its dominant body: periapsis and
 * apoapsis DISTANCE from that body (apoapsis is null when unbound),
 * eccentricity, and whether the orbit is bound. 2D specific angular momentum
 * h = rx*vz - rz*vx; semi-latus rectum p = h^2/mu.
 */
export function orbitElements(ship) {
  const states = allStates(ship.t, _statesA);
  const domId = ship.soi;
  const mu = domId === 'sun' ? BODIES.sun.gm : BODIES[domId].gm;
  const s = domId === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : states[domId];
  const rx = ship.x - s.x;
  const rz = ship.z - s.z;
  const vx = ship.vx - s.vx;
  const vz = ship.vz - s.vz;
  const r = Math.hypot(rx, rz);
  const v2 = vx * vx + vz * vz;
  const energy = v2 / 2 - mu / r;
  const h = rx * vz - rz * vx;
  const p = (h * h) / mu;
  const exVec = ((v2 - mu / r) * rx - (rx * vx + rz * vz) * vx) / mu;
  const ezVec = ((v2 - mu / r) * rz - (rx * vx + rz * vz) * vz) / mu;
  const ecc = Math.hypot(exVec, ezVec);
  const bound = energy < 0;
  const periapsis = p / (1 + ecc);
  const apoapsis = ecc < 1 ? p / (1 - ecc) : null;
  return { body: domId, periapsis, apoapsis, eccentricity: ecc, bound, energy };
}

/**
 * Signed delta-v (u/s) for a tangential burn that would circularise the
 * ship's orbit AT ITS CURRENT RADIUS around the dominant body: positive means
 * burn prograde, negative means retrograde. This is the "Circularise" helper
 * button's number; the actual best time to fire it is apoapsis/periapsis, but
 * the formula holds at any point on the orbit.
 */
export function circulariseDeltaV(ship) {
  const states = allStates(ship.t, _statesA);
  const domId = ship.soi;
  const mu = domId === 'sun' ? BODIES.sun.gm : BODIES[domId].gm;
  const s = domId === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : states[domId];
  const rx = ship.x - s.x;
  const rz = ship.z - s.z;
  const vx = ship.vx - s.vx;
  const vz = ship.vz - s.vz;
  const r = Math.hypot(rx, rz);
  const h = rx * vz - rz * vx;
  const tangentialSpeed = Math.abs(h) / r;
  const circularSpeed = Math.sqrt(mu / r);
  return circularSpeed - tangentialSpeed;
}
