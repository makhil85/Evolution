// Chapter 4 - the shared contract.
//
// Every module in src/space/ builds against THIS file and nothing else of each
// other's, so five parts can be written in parallel without drifting apart.
// Change a value here and it changes everywhere; never copy a number out of it.
//
// UNITS. One game unit ("u") has no real-world length - the solar system is
// compressed (see CHAPTER4_PLAN.md section 4). Time is in seconds of SIMULATION
// time (time warp multiplies it). GM is the gravitational parameter in u^3/s^2:
// the pull at distance r is GM / r^2, circular orbit speed is sqrt(GM / r).
//
// PLANE. Physics is 2-D in the world X/Z plane (y = 0 is the orbital plane).
// Rendering is full 3-D: bodies have radius and tilt, the camera can go anywhere.
//
// ORIGIN. Physics works in heliocentric float64 coordinates (Sun at 0,0).
// The SCENE uses a floating origin: every frame the renderer subtracts the
// ship's heliocentric position, so the ship sits near (0,0,0) and float32 on the
// GPU never sees a number like 20 000. Use toScene() for that, always.

import { IS_CH5 } from './chapter.js';

export const TEXTURE_BASE = `${import.meta.env?.BASE_URL ?? './'}space/textures/`;

/** Physics step. Fixed; time warp runs more steps, never bigger ones. */
export const PHYSICS_DT = 1 / 120;

/** Allowed time-warp multipliers (keys 1-4). Warp > 1 is refused near bodies. */
export const WARP_LEVELS = [1, 4, 16, 64];
/** The autopilot's cruise warp, out between the planets only (physics.js stepWorld). */
export const AUTOPILOT_WARP = 256;
/**
 * Chapter 5's cruise warp: out between the outer planets the coasts are
 * 10,000-35,000 s long, so at the top warp, in the Sun's pull, engine off and
 * path clear, time runs x1024 (for her as well as the autopilot). The coast
 * there is pure Sun gravity, so physics.js jumps it exactly (Kepler), not in
 * more steps.
 */
export const CRUISE_WARP = 1024;

/**
 * Warp is refused while the ship is within this many radii of any body
 * (or inside Jupiter's radiation zone). The HUD says why.
 */
export const WARP_SAFE_RADII = 12;

/**
 * The bodies. Order matters only for rendering (parents before children).
 *
 *   parent     - body it orbits (null = the Sun, which does not move)
 *   orbit      - circular orbit radius around the parent, u
 *   period     - orbital period, s (derived from GM of the parent; kept here so
 *                nobody re-derives it differently). Negative never happens.
 *   phase      - starting angle, radians, at t = 0
 *   radius     - visual AND collision radius, u
 *   gm         - gravitational parameter, u^3/s^2
 *   soi        - sphere of influence radius, u (patched conics hand-off)
 *   spin       - self-rotation period, s (visual only)
 *   tilt       - axial tilt, radians (visual only)
 *   tex        - texture file names under TEXTURE_BASE
 *   atmo       - atmosphere rim colour, or null
 *   landable   - true where she can land and step out
 *   role       - what the body is FOR in the story (see CHAPTER4_PLAN.md)
 */
const SUN_GM = 5.9e6;

function orbitalPeriod(parentGm, r) {
  return 2 * Math.PI * Math.sqrt((r * r * r) / parentGm);
}

function soiRadius(orbit, gm, parentGm) {
  // Laplace sphere of influence: a * (m / M)^(2/5).
  return orbit * Math.pow(gm / parentGm, 0.4);
}

const RAW = [
  { id: 'sun', name: 'Sun', parent: null, orbit: 0, phase: 0, radius: 400, gm: SUN_GM, spin: 600, tilt: 0.12,
    tex: { map: '2k_sun.jpg' }, atmo: null, landable: false, role: 'light, heat, and the inverse-square lesson' },

  { id: 'earth', name: 'Earth', parent: 'sun', orbit: 6000, phase: 0.0, radius: 24, gm: 12000, spin: 240, tilt: 0.41,
    tex: { map: '2k_earth_daymap.jpg', night: '2k_earth_nightmap.jpg', clouds: '2k_earth_clouds.jpg' },
    atmo: 0x4aa3ff, landable: false, role: 'start: wings fold, zero-g, first orbit, the satellite' },

  { id: 'moon', name: 'Moon', parent: 'earth', orbit: 380, phase: 1.2, radius: 10, gm: 200, spin: null, tilt: 0.03,
    tex: { map: '2k_moon.jpg' }, atmo: null, landable: true, role: 'first landing, low-g walk, first slingshot' },

  { id: 'mars', name: 'Mars', parent: 'sun', orbit: 9000, phase: 0.9, radius: 13, gm: 900, spin: 250, tilt: 0.44,
    tex: { map: '2k_mars.jpg' }, atmo: 0xe0916a, landable: false, role: 'scan flyby' },

  { id: 'ceres', name: 'Ceres', parent: 'sun', orbit: 12200, phase: 1.5, radius: 7, gm: 90, spin: 180, tilt: 0.07,
    tex: { map: '2k_ceres_fictional.jpg' }, atmo: null, landable: false, role: 'dwarf planet in the belt' },

  { id: 'jupiter', name: 'Jupiter', parent: 'sun', orbit: 20000, phase: 2.0, radius: 110, gm: 200000, spin: 200, tilt: 0.05,
    tex: { map: '2k_jupiter.jpg' }, atmo: 0xd9b48a, landable: false, role: 'why Jupiter matters; the big slingshot' },

  { id: 'io', name: 'Io', parent: 'jupiter', orbit: 450, phase: 0.3, radius: 9, gm: 300, spin: null, tilt: 0,
    tex: {}, atmo: null, landable: false, role: 'volcano moon (procedural)' },

  { id: 'europa', name: 'Europa', parent: 'jupiter', orbit: 700, phase: 2.6, radius: 10, gm: 200, spin: null, tilt: 0,
    tex: {}, atmo: null, landable: true, role: 'THE GOAL: land, step out, drill, habitability check' },

  { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', orbit: 1100, phase: 4.1, radius: 13, gm: 500, spin: null, tilt: 0,
    tex: {}, atmo: null, landable: false, role: 'biggest moon in the solar system (procedural)' },

  { id: 'callisto', name: 'Callisto', parent: 'jupiter', orbit: 1700, phase: 5.3, radius: 12, gm: 400, spin: null, tilt: 0,
    tex: {}, atmo: null, landable: false, role: 'most cratered (procedural)' },

  { id: 'saturn', name: 'Saturn', parent: 'sun', orbit: 32000, phase: 2.9, radius: 90, gm: 90000, spin: 210, tilt: 0.47,
    tex: { map: '2k_saturn.jpg', ring: '2k_saturn_ring_alpha.png' }, atmo: 0xe8d3a0, landable: false, role: 'optional, spectacular' },

  { id: 'uranus', name: 'Uranus', parent: 'sun', orbit: 42000, phase: 3.6, radius: 45, gm: 20000, spin: 300, tilt: 1.71,
    tex: { map: '2k_uranus.jpg' }, atmo: 0x9fe3e8, landable: false, role: 'optional' },

  { id: 'neptune', name: 'Neptune', parent: 'sun', orbit: 50000, phase: 4.4, radius: 44, gm: 22000, spin: 280, tilt: 0.49,
    tex: { map: '2k_neptune.jpg' }, atmo: 0x5b7cff, landable: false, role: 'optional' },

  // Chapter 5 only: out in the Kuiper belt (39 AU, with Neptune at 30).
  ...(IS_CH5 ? [{ id: 'pluto', name: 'Pluto', parent: 'sun', orbit: 65000, phase: 4.6, radius: 8, gm: 150, spin: null, tilt: 0,
    tex: { map: '2k_ceres_fictional.jpg' }, atmo: null, landable: false, role: 'Chapter 5 fly-past (dwarf planet)' }] : []),
];

/**
 * Chapter 5's starting line-up (where each planet is at t = 0): Saturn,
 * Uranus and Neptune near one line out from the Sun. As she sets off for each,
 * ch5/lineup.js moves it on its rail so its window opens soon (and the save
 * keeps where it put it). scripts/test-ch5-flight.mjs flies the legs.
 */
export const CH5_PHASES = Object.freeze({ saturn: 3.089, uranus: 3.403, neptune: 3.944 });

export const BODIES = (() => {
  const byId = {};
  for (const b of RAW) {
    const parent = b.parent ? byId[b.parent] : null;
    const body = {
      ...b,
      ...(IS_CH5 && CH5_PHASES[b.id] !== undefined ? { phase: CH5_PHASES[b.id] } : {}),
      period: parent ? orbitalPeriod(parent.gm, b.orbit) : Infinity,
      soi: parent ? soiRadius(b.orbit, b.gm, parent.gm) : Infinity,
    };
    byId[b.id] = body;
  }
  return Object.freeze(byId);
})();

/** Bodies in render/update order - parents always before their children. */
export const BODY_ORDER = RAW.map((b) => b.id);

/** The asteroid belt, between Mars and Jupiter. */
export const BELT = Object.freeze({
  inner: 11000,
  outer: 13500,
  thickness: 180,       // visual half-height above/below the plane
  visualCount: 6000,    // instanced far rocks (not collidable)
  nearCount: 60,        // real, minable rocks around the ship at any time
  kinds: {
    stony: { color: 0x9c8f80, gives: 'silicon', sample: 'Stony (S-type) asteroid' },
    metal: { color: 0x8c8f99, gives: 'metal', sample: 'Metal (M-type) asteroid' },
    icy: { color: 0xcfe3ee, gives: 'ice', sample: 'Icy asteroid' },
  },
});

/** Jupiter's radiation belt: a hazard ring. Needs the Radiation Shield upgrade. */
export const RADIATION = Object.freeze({ body: 'jupiter', inner: 160, outer: 520 });

/**
 * The ship. Masses in tonnes, thrust in u*t/s^2 (so accel = thrust / mass).
 *
 * TWO SCALES. The model is built at "surface" scale - 1 unit ~ 1 metre, the
 * girl 1.3 tall, the ship about modelLength long - because that is the scale
 * she climbs out at on the Moon and Europa. In flight the whole ship group is
 * scaled by flightScale so it is a sensible size next to compressed planets
 * (a Moon of radius 10 u). Physics only ever sees collisionRadius, in u.
 */
export const SHIP = Object.freeze({
  modelLength: 8,
  /** The pilot is drawn 1.4x life size so she reads from the chase camera. The
   *  surface scenes build their own girl at true size instead of reusing her. */
  pilotScale: 1.4,
  flightLength: 1.2,
  get flightScale() { return this.flightLength / this.modelLength; },
  dryMass: 10,
  fuelMass: 6,          // full tank (Bigger Tank upgrade raises it)
  // Tuned (see scripts/test-space-physics.mjs's "Tuning report") so a full
  // tank's rocket-equation delta-v budget (~37.6 u/s, exhaust velocity
  // thrust/fuelBurn = 80 u/s) comfortably covers a full Earth -> Moon ->
  // land -> liftoff -> Mars run WITH mistakes (>=1.5x that stretch's cost),
  // while belt -> Jupiter -> Europa still needs the ice refuel or the
  // Jupiter slingshot to close - fuel must matter without ever stranding a
  // 9-year-old who is still learning to steer. thrust alone sets how SNAPPY
  // that budget feels to spend: full ship accelerates at 20/16 = 1.25 u/s^2
  // (a 2s burn is ~2.5 u/s, a clearly felt path change), and a full tank
  // empties in ~24s of continuous full thrust - long enough to recover from
  // a clumsy burn, not a bottomless tank. refuel()/emergencyTopUp() in
  // physics.js are how Mission Control tankers, Moon/asteroid/Europa ice and
  // the "never stranded" rule put fuel back in.
  // Lead playtest: at 20 a low-Earth transfer burn took ~8 s, over half of a
  // 13.6 s orbit, so the burn smeared round the planet and missed the Moon.
  // 50 made it a ~2 s kick; 70 (with Moon/Europa gm 200) also gives a
  // lander-like thrust-to-weight of ~2 on their surfaces - at 50 and gm 260
  // it was 1.2, and leaving the Moon cost over half an Easy tank. Exhaust velocity (thrust / fuelBurn) stays 80 u/s,
  // so fuel per unit of speed change is unchanged.
  thrust: 70,
  rcsTorque: 2.4,       // rad/s^2 rotation from A/D
  // Lead request after the Easy/Medium/Hard playthroughs: every leg should
  // take LESS than half a tank, generously. The worst measured legs were
  // ~3.5 t of Medium's 6 t (Jupiter -> Europa -> landing) and ~3.4 t of
  // Hard's 4.8 t (Earth -> Moon -> landing with corrections). Exhaust
  // velocity 80 -> 240 u/s (a 3x more efficient engine) puts those at
  // ~1.2 t, 4-5x margin, without changing the tank's MASS: the ship still
  // accelerates and handles exactly as tuned above.
  fuelBurn: 0.29,       // tonnes per second at full thrust (thrust / ~240)
  cargoMax: 8,          // tonnes of ore
  collisionRadius: 0.45,
  /** Touching a landable body slower than this (u/s, relative) is a landing; faster is a crash. */
  safeLandingSpeed: 1.2,
});

/**
 * Solar power falls off as 1/d^2 from the Sun. At Earth's orbit the base
 * panels give exactly SOLAR.panelPowerAtEarth; Big Solar Wings multiply it.
 */
export const SOLAR = Object.freeze({
  referenceDistance: 6000,  // Earth's orbit = "1 AU" in game
  panelPowerAtEarth: 100,
  bigWingsMultiplier: 12,
  // Base panels give ~21 at the belt's inner edge and ~9 at its outer edge
  // (physics realAU), so 8 lets her mine anywhere in the belt; at Jupiter they
  // give ~3.7, which is exactly why Big Solar Wings (x12 -> ~44) are needed.
  powerNeededForClaw: 8,
});

/** Resources and samples. The HUD shows these labels. */
export const RESOURCES = Object.freeze({
  fuel: { label: 'Fuel', unit: 't' },
  ice: { label: 'Ice', unit: 't' },
  metal: { label: 'Metal', unit: 't' },
  silicon: { label: 'Silicon', unit: 't' },
});

export const UPGRADES = Object.freeze({
  bigSolarWings: { label: 'Big Solar Wings', cost: { silicon: 4, metal: 2 }, required: 'before Jupiter' },
  biggerTank: { label: 'Bigger Tank', cost: { metal: 3 }, required: null },
  strongerClaw: { label: 'Stronger Claw', cost: { metal: 2, silicon: 1 }, required: null },
  radiationShield: { label: 'Radiation Shield', cost: { metal: 4, ice: 2 }, required: 'before Europa' },
});

/** Ink outline colour and the palette of everything cel-shaded (ship, girl, pickups). */
export const INK = 0x10141f;
export const SHIP_PALETTE = Object.freeze({
  hull: 0xf3efe6,
  accent: 0xff7847,
  dark: 0x323a4c,
  glass: 0xbfe9ff,
  solar: 0x1d3a8a,
  plume: 0x9fe8ff,
});

/**
 * Space background: NOT blue, NOT pitch black. A near-black ground, a faint
 * warm haze toward the Sun, bright stars, and an ambient fill that keeps night
 * sides dark grey rather than a hole in the screen.
 */
export const SPACE_LIGHT = Object.freeze({
  background: 0x030306,
  sunHaze: 0x2a1c10,        // tint at the Sun's side of the sky
  ambient: 0x2b2a30,
  ambientIntensity: 0.55,
  sunColor: 0xfff2de,
  sunIntensity: 3.2,
});

/** Save keys, per difficulty, matching the launcher convention (src/launcher/profile.js CHAPTERS). */
export const STORE_KEYS_CH4 = Object.freeze({ 1: 'level4_voyage_europa_v1_L1', 4: 'level4_voyage_europa_v1' });
export const STORE_KEYS_CH5 = Object.freeze({ 1: 'level5_rings_to_a_star_v1_L1', 4: 'level5_rings_to_a_star_v1' });
/** This page's save keys: Chapter 5 runs on the same engine (chapter.js). */
export const STORE_KEYS = IS_CH5 ? STORE_KEYS_CH5 : STORE_KEYS_CH4;

/** Events the modules emit on the shared bus (main.js creates it). */
export const EVENTS = Object.freeze({
  SOI_CHANGE: 'soi-change',       // { from, to }
  CRASH: 'crash',                 // { body }
  LANDED: 'landed',               // { body, speed }
  COLLECT: 'collect',             // { resource, amount } or { sample }
  QUESTION: 'question',           // { id }
  ANSWERED: 'answered',           // { id, correct }
  UPGRADE: 'upgrade',             // { id }
  MISSION: 'mission',             // { id, state }
  SLINGSHOT: 'slingshot',         // { body, speedIn, speedOut, fuelSaved }
});

/** Heliocentric (x, z) -> scene position relative to the floating origin. */
export function toScene(out, hx, hz, originX, originZ, y = 0) {
  return out.set(hx - originX, y, hz - originZ);
}

/**
 * Renderer settings every module can rely on. Scales run from a 0.2 u girl in
 * the cockpit to Neptune 50 000 u away, which a normal depth buffer cannot hold
 * without z-fighting, so the renderer uses a LOGARITHMIC depth buffer.
 *
 * Consequence for anyone writing a ShaderMaterial: include the log-depth chunks
 * or the object will sort wrongly against everything else:
 *   vertex:   #include <common> / <logdepthbuf_pars_vertex>   ...   #include <logdepthbuf_vertex>   (after gl_Position)
 *   fragment: #include <logdepthbuf_pars_fragment>             ...   #include <logdepthbuf_fragment>
 * Built-in materials (MeshStandard, MeshToon, Sprite, Points...) handle it themselves.
 */
export const RENDER = Object.freeze({
  logarithmicDepthBuffer: true,
  near: 0.02,
  far: 400000,
  fov: 55,
  toneMapping: 'ACESFilmic',
  exposure: 1.05,
  // Threshold is in LINEAR HDR, before tone mapping. A white toon surface in
  // full sunlight comes out at ~1.05, so a threshold under that makes the
  // girl's lab coat and the white hull glow like lamps. Anything that SHOULD
  // bloom (Sun, engine plume, nav lights, path dots, city lights) must output
  // well above it: >= 2 linear, e.g. color.multiplyScalar(3) with toneMapped
  // left on, or an emissiveIntensity of 3+.
  bloom: { strength: 0.7, radius: 0.5, threshold: 1.25 },
});

/**
 * Default chase camera, in FLIGHT units in the ship's own frame (rotated by
 * the ship's yaw): where the camera sits, and what it looks at. Tuned in the
 * ship lab so the girl in the canopy is readable. camera.js reads this.
 */
export const CHASE_CAMERA = Object.freeze({
  offset: Object.freeze([0.66, 0.61, 1.01]),
  lookAt: Object.freeze([0, 0.1, -0.05]),
});

/**
 * FLYING MODE: how much the GAME helps, chosen by the child (Esc menu, and on
 * the first start). Separate from the question Level (1 or 4), which only
 * changes the questions. Every system reads the current mode from
 * game.mode (main.js keeps it up to date); never hard-code one of these.
 *
 *   pathScale        predicted-path length multiplier
 *   showGhost        show "where the target will be" (ghost + map circle)
 *   autoAim          hold Space and the ship turns itself to game.aimHint
 *   aimArrow         draw the aim hint arrow at all
 *   fuelScale        tank capacity multiplier (and starting fuel)
 *   burnScale        fuel used per second of thrust (optional, default 1;
 *                    Level 1 Easy: 0.5 = twice the range from the same tank)
 *   landingScale     safe-landing-speed multiplier (bigger = gentler)
 *   captureScale     tolerance multiplier for "you're in orbit"/"you caught it" goals
 *   rockMarkers      'all' = every nearby rock marked with kind + distance,
 *                    'scanner' = rocks within scannerRange marked,
 *                    'pulse' = only a scanner pulse (E) reveals rocks briefly
 *   scannerRange     u, for 'scanner' and 'pulse'
 *   samplesPerKind   asteroid samples needed of each kind
 *   warpSafeScale    multiplier on WARP_SAFE_RADII (smaller = warp allowed closer)
 */
export const FLIGHT_MODES = Object.freeze({
  easy: Object.freeze({
    id: 'easy', label: 'Easy', rank: 'Cadet',
    // The autopilot is OFF to start with (lead, 2026-10-05): on Easy the ship
    // still points itself the right way and lands itself, so the flying is
    // hers at her own pace, and the Autopilot button (P) is there the moment
    // she wants a leg flown for her.
    blurb: IS_CH5 ? 'The ship points itself the right way, so you just hold W when the banner says. A bigger tank, and the Autopilot button (P) flies a leg for you whenever you want.' : 'The ship points itself the right way and lands itself, so you just hold W when the banner says. A bigger tank, every rock marked, and the Autopilot button (P) flies a leg for you whenever you want.',
    pathScale: 2, showGhost: true, autoAim: true, aimArrow: true,
    // Landings: lead playtest (Oct 2): "hard to stay in the green" - a
    // touchdown up to 2.5x the base speed is safe (was 2x).
    fuelScale: 1.5, landingScale: 2.5, captureScale: 1.6,
    rockMarkers: 'all', scannerRange: 600, samplesPerKind: 1, warpSafeScale: 0.6,
  }),
  medium: Object.freeze({
    id: 'medium', label: 'Medium', rank: 'Pilot',
    blurb: 'You do the flying: an arrow shows which way to point, burns go into slow motion, and landings steer themselves (just hold W). Rocks show up on your scanner when you get close.',
    pathScale: 1, showGhost: true, autoAim: false, aimArrow: true,
    fuelScale: 1, landingScale: 1.35, captureScale: 1, // landings a bit gentler (was 1)
    rockMarkers: 'scanner', scannerRange: 260, samplesPerKind: 1, warpSafeScale: 1,
  }),
  hard: Object.freeze({
    id: 'hard', label: 'Hard', rank: 'Commander',
    blurb: 'A short dotted path, no aiming help, a smaller tank and very soft landings. Press E to pulse your scanner to find rocks.',
    pathScale: 0.5, showGhost: false, autoAim: false, aimArrow: false,
    fuelScale: 0.8, landingScale: 0.7, captureScale: 0.7,
    rockMarkers: 'pulse', scannerRange: 160, samplesPerKind: 2, warpSafeScale: 1.3,
  }),
});

/**
 * LEVEL 1 (1st grade) flying modes: everything one notch gentler (lead
 * request). Level 1's Easy is easier than Level 4's Easy with TWICE its fuel;
 * Level 1's Medium is Level 4's Easy; Level 1's Hard is Level 4's Medium.
 * Same ids, so saves and the Esc menu work unchanged; main.js picks the table
 * by the launcher's Level.
 */
export const FLIGHT_MODES_L1 = Object.freeze({
  easy: Object.freeze({
    id: 'easy', label: 'Easy', rank: 'Rookie',
    blurb: IS_CH5 ? 'The ship turns itself the right way. You just hold W when it says. A huge fuel tank, and an Autopilot button (P) that flies for you.' : 'The ship turns itself the right way and lands itself. You just hold W when it says. A huge fuel tank, every rock marked, and an Autopilot button (P) that flies for you.',
    pathScale: 3, showGhost: true, autoAim: true, aimArrow: true,
    // 2x Easy's fuel as RANGE, not tank mass: a tank twice as heavy would
    // make the ship sluggish and Moon landings much harder (fuel has mass).
    // Same tank as Easy; the engine burns half as much for the same push.
    fuelScale: 1.5, burnScale: 0.5, landingScale: 3.5, captureScale: 2.2,
    rockMarkers: 'all', scannerRange: 900, samplesPerKind: 1, warpSafeScale: 0.5,
  }),
  medium: Object.freeze({ ...FLIGHT_MODES.easy, id: 'medium', label: 'Medium', rank: 'Cadet' }),
  hard: Object.freeze({ ...FLIGHT_MODES.medium, id: 'hard', label: 'Hard', rank: 'Pilot' }),
});

/** The flying-mode table for a question Level (1 or 4). */
export function flightModesFor(level) {
  return level === 1 ? FLIGHT_MODES_L1 : FLIGHT_MODES;
}

/** localStorage key for the chosen flying mode (shared by both question Levels). */
export const FLIGHT_MODE_KEY = 'rocket_village_ch4_flight_mode';
