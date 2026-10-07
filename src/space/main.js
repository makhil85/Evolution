// Chapter 4 - Voyage to Europa. The loop that joins the parts.
//
//   physics.js   heliocentric float64 ship + bodies on rails (the truth)
//   planets.js / sky.js / belt.js / dust.js   what she sees
//   ship.js      her ship and her
//   hud/         every instrument, card and modal
//   missions.js  the story: acts, beats, questions, gates
//
// Each frame: sample input -> fixed-step physics (warp = more steps, never
// bigger ones) -> move the FLOATING ORIGIN to the ship -> hand every visual
// module heliocentric positions plus that origin -> camera -> render.
//
// The simulation stops while any modal is open (question, map, pause). A
// 9-year-old reading a question must never come back to a crashed ship.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { BODIES, SHIP, SOLAR, RENDER, WARP_LEVELS, WARP_SAFE_RADII, PHYSICS_DT, EVENTS, FLIGHT_MODE_KEY, flightModesFor } from './contracts.js';
import { allStates, bodyState } from './orbits.js';
import {
  createShipState, stepWorld, createRewind, gravityInfo, orbitElements, solarPower, realAU,
} from './physics.js';
import { predict, coastRel } from './predictor.js';
import { createBodies } from './planets.js';
import { createSky } from './sky.js';
import { createBelt } from './belt.js';
import { createBeltFx } from './beltFx.js';
import { createDust } from './dust.js';
import { createShip } from './ship.js';
import { createHud } from './hud/hud.js';
import { createControls } from './controls.js';
import { createTouchPad } from './hud/touch.js';
import { createFlightCamera } from './camera.js';
import { createTrajectoryView } from './trajectoryView.js';
import { createMissions } from './missions.js';
import { createCatchZone } from './catchZone.js';
import { planTransfer, planTransferSteps, planIsGood } from './transferPlanner.js';
import { guardContext } from '../game/contextGuard.js';
import { createFrameMonitor } from '../game/frameMonitor.js';
import { createAutopilot } from './autopilot.js';
import { createRetry } from './retry.js';
import { createAimToggle } from './aimToggle.js';
import { createFreezeButton } from './freeze.js';
import { createAimDial } from './hud/aimDial.js';
import { playIntro } from './cinematics.js';
import { addJumpPanel } from '../play/grownUp.js';
import { IS_CH5, IS_CH6, OUTER } from './chapter.js';
import { CH5_START, CH5_UPGRADES } from './ch5/start.js';
import { CH6_START } from './ch6/start.js';
import { setMoonPulls } from './gravity.js';
import { playCh5Opening } from './ch5/opening.js';
import { t, IS_LEVEL1, LEVEL } from './level.js';

// --- bus -----------------------------------------------------------------------

function createBus() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => handlers.get(name)?.delete(fn);
    },
    off(name, fn) { handlers.get(name)?.delete(fn); },
    emit(name, payload) {
      const set = handlers.get(name);
      if (set) for (const fn of [...set]) fn(payload);
    },
  };
}

// --- renderer ------------------------------------------------------------------

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  antialias: false, // MSAA lives on the composer's target instead
  logarithmicDepthBuffer: RENDER.logarithmicDepthBuffer,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(RENDER.fov, 1, RENDER.near, RENDER.far);

const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function fit() {
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || window.innerHeight;
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (activeScene?.camera) {
    activeScene.camera.aspect = w / h;
    activeScene.camera.updateProjectionMatrix();
  }
}
/** A mini-scene that has taken over the screen (cabin, Moon walk, Europa). */
let activeScene = null;
new ResizeObserver(fit).observe(stage);
fit();

// --- world --------------------------------------------------------------------

const bus = createBus();
const bodies = createBodies({ scene, renderer, camera });
const sky = createSky({ scene, renderer });
const belt = createBelt({ scene, renderer });
// Chapter 5 starts out past Jupiter and never goes back: the asteroid belt
// (a bright band across the sky out there) only got in the way (lead, 2026-10-06).
if (IS_CH5) belt.group.visible = false;
// Chapter 5: the Kuiper belt past Neptune (points; it rides the floating origin too).
// No Kuiper-belt ring in flight (lead 2026-10-07): at the edge it sat on the
// horizon the whole time, burning and coasting, and only distracted. The
// edge cutscene (ch5/edge.js) still shows the Kuiper belt and Oort cloud.
// Chapter 6's slingshots: the Sun and one planet only (lead, 2026-10-05).
if (IS_CH6) setMoonPulls(false);
const dust = createDust({ scene });
const trajectory = createTrajectoryView({ scene });
// The PLANNED path (Easy/Medium, transfer steps): where the coming burn will
// take her, a fainter gold line from the burn point on. It holds still while
// she waits and while she burns, and her live cyan line swings onto it as
// the burn goes in (lead, 2026-10-04: "when fired, it's difficult to track
// the orbits").
const plannedView = createTrajectoryView({ scene, color: 0xffd27a, size: 4, opacity: 0.6 });
plannedView.setVisible(false);

const shipView = createShip();
shipView.group.scale.setScalar(SHIP.flightScale);
scene.add(shipView.group);

// No extra lights here: planets.js puts a PointLight at the Sun (decay 0) plus
// the SPACE_LIGHT ambient, and that pair lights EVERYTHING - bodies, ship,
// rocks. A second "sun" doubled the light on the ship and blew it out to white.

// A flat orange arrow on the orbital plane at the ship, shown only when the
// camera is pulled far out (top view, whole-planet zoom).
const shipBeacon = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1); shape.lineTo(0.62, 0.7); shape.lineTo(0, 0.35); shape.lineTo(-0.62, 0.7); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); // lie on the plane, tip toward -Z like the ship's nose
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7847).multiplyScalar(1.6), side: THREE.DoubleSide, depthTest: false, transparent: true });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 20;
  m.visible = false;
  return m;
})();
scene.add(shipBeacon);

const hud = createHud({ mount: document.getElementById('hud-root'), bus });
const controls = createControls({ bus, element: renderer.domElement });
// On-screen buttons on touch screens (hud/touch.js): they press the same keys.
const touch = createTouchPad(hud.root, { controls, bus, warpIndex: () => game.warpIndex, warpLevels: WARP_LEVELS });
if (touch.enabled) {
  const hint = hud.minimap.el.querySelector('.sp-minimap__hint');
  if (hint) hint.textContent = t('Tap for the big map', 'Tap for the big map');
}
const flightCam = createFlightCamera({ camera, baseFov: RENDER.fov });
/** The wide escape view (see the camera update in tick): on, and the mode to go back to. */
const escapeView = { on: false, mode: null };

// --- the ship's starting orbit -------------------------------------------------

/** A circular orbit around `bodyId` at `radius`, going the same way as its moons. */
function circularOrbitState(bodyId, radius, phaseAngle, t = 0) {
  const b = BODIES[bodyId];
  const s = bodyState(bodyId, t);
  const v = Math.sqrt(b.gm / radius);
  const c = Math.cos(phaseAngle);
  const sn = Math.sin(phaseAngle);
  return {
    x: s.x + radius * c,
    z: s.z + radius * sn,
    vx: s.vx - v * sn,
    vz: s.vz + v * c,
    // Heading prograde: along the velocity relative to the body.
    angle: Math.atan2(c, -sn),
    t,
  };
}

// She starts on the DAY side, just past the terminator, so the opening shot is
// the lit Earth under her with the night side's city lights rolling up ahead.
// (Earth sits at +X of the Sun at t=0, so the day side faces angle PI.)
// Chapter 5 starts where Chapter 4 ended: in orbit round Jupiter.
const ship = createShipState(IS_CH6
  ? circularOrbitState(CH6_START.body, CH6_START.radius, CH6_START.phase)
  : IS_CH5
  ? circularOrbitState(CH5_START.body, CH5_START.radius, CH5_START.phase)
  : circularOrbitState('earth', BODIES.earth.radius * 1.6, Math.PI + 0.9));
const rewind = createRewind(30);

// --- game state shared with missions.js ------------------------------------------

/**
 * The launcher's question Level (1 or 4) also picks the flying-mode table:
 * Level 1's modes are each one notch gentler (contracts FLIGHT_MODES_L1).
 */
const MODES = flightModesFor(LEVEL);

const game = {
  bus, hud, ship, shipView, controls, flightCam, belt, bodies, scene,
  /** Heliocentric {x, z} every few sim-seconds: the ending draws this route. */
  route: [],
  /** A cinematic overriding the camera this frame (cinematics.js), or null.
   *  `calm: true` turns off the speed dust and warp streaks while it plays. */
  cinematic: null,
  /** The flying mode (contracts FLIGHT_MODES / FLIGHT_MODES_L1): how much the game helps. */
  mode: MODES.medium,
  /** Which way the current step wants her pointed: 'prograde' | 'retrograde' | 'target' | null. */
  aimHint: null,
  warpIndex: 0,
  fuelCapacity: SHIP.fuelMass,
  solarMultiplier: 1,
  resources: { ice: 0, metal: 0, silicon: 0 },
  samples: [],
  target: 'moon',
  paused: false,
  /** Last predictor result, for missions that care where she is heading. */
  prediction: null,
  states: {},
};
window.__space = game; // debug handle, like Chapter 3's
game.camera = camera; // debug: tests read the flight camera
// Rock break-apart, pieces flying in, the upgrade build effect (PLAN item 11).
game.beltFx = createBeltFx(game);

const missions = createMissions(game);
const catchZone = createCatchZone(game, scene);
game.catchZone = catchZone;
// Unlock mode only: the grown-up "Jump" panel (any step of this chapter).
addJumpPanel({ title: 'Jump to a step', parts: missions.parts(), onJump: (id) => missions.jumpTo(id) });
game.missions = missions; // debug: window.__space.missions.jump('a1_raise')
// Two wrong tries on a question: back to the start of the current act.
hud.onOutOfTries = () => missions.restartAct();
// Autopilot (button or P): flies to the next stop; she answers the questions.
game.autopilot = createAutopilot(game, { controls, hud });
game.retry = createRetry(game); // Esc / button: back to just after the last question
const aimToggle = createAimToggle(game); // T / button: auto-turn on or off
const freeze = createFreezeButton(game); // F / button: freeze everything, then carry on

// --- resume ----------------------------------------------------------------------
// A reload puts her back exactly where she was: the ship (and the sim clock, so
// the planets match), her resources, samples, upgrades and route. Upgrades are
// re-applied through the same helper that built them, so their effects come
// back too (solar wings out, radiation shield, bigger tank).
function restoreFromSave(saved) {
  if (!saved || !saved.ship || !(saved.stepIndex > 0)) return false;
  Object.assign(ship, saved.ship, { angVel: 0, _accum: 0 });
  if (saved.resources) Object.assign(game.resources, saved.resources);
  if (Array.isArray(saved.samples)) game.samples.push(...new Set(saved.samples)); // de-duplicate old saves
  if (Array.isArray(saved.route)) game.route.push(...saved.route);
  if (saved.stats) game.stats = saved.stats;
  applyOwnedUpgrades(saved.upgrades);
  return true;
}
/** Re-apply built upgrades (a save's, or Chapter 5's starting kit) through
 *  the same effects that built them; past the opening, wings are folded. */
function applyOwnedUpgrades(list) {
  game.upgradesOwned = new Set(list || []);
  if (game.upgradesOwned.has('bigSolarWings')) {
    shipView.setSolarWings(1, true);
    game.solarMultiplier = SOLAR.bigWingsMultiplier;
  }
  if (game.upgradesOwned.has('strongerClaw')) game.strongClaw = true;
  if (game.upgradesOwned.has('radiationShield')) game.radiationShield = true;
  // Past the opening, the wings are always folded; landed means legs down.
  shipView.setWingsFolded(true, true);
  if (ship.landedOn) shipView.setLegs(true, true);
}
const resumed = restoreFromSave(missions.saved);
// A fresh Chapter 5: the ship she finished Chapter 4 with.
if (OUTER && !resumed) applyOwnedUpgrades(CH5_UPGRADES);

// --- events ---------------------------------------------------------------------

let modalOpen = false;
bus.on('ui-modal', (open) => { modalOpen = !!open; });
// One past the top level is the autopilot's cruise warp (AUTOPILOT_WARP,
// physics.js decides where it applies); keys and buttons stop at the top.
bus.on('warp-request', (i) => { game.warpIndex = Math.max(0, Math.min(WARP_LEVELS.length - 1, i)); game.warpBoost = i >= WARP_LEVELS.length; });
bus.on('camera-cycle', () => {
  const m = flightCam.cycle();
  hud.toast(m === 'chase' ? 'Camera: behind the ship' : m === 'orbit' ? 'Camera: free look (drag to spin)' : 'Camera: top view: best for reading your path', { ms: 2200 });
});
bus.on('rewind', () => {
  // Nothing to rescue on the ground or on foot: R on the Moon walk used to
  // rewind the parked ship 10 s back into the air, so after the walk she was
  // falling again and the crash warning came back.
  if (ship.landedOn || activeScene) return;
  if (rewind.rewind(ship, 10)) {
    game.warpIndex = 0;
    hud.toast(t('Rewound 10 seconds. Try that bit again!', 'Rewound! Try again.'), { kind: 'info', ms: 2600 });
    predictorClock = 0;
  }
});

/**
 * Towed back (every flying mode): heading for a moon and she has left its
 * planet's pull altogether (Hard playtest: a Moon flyby flung her into orbit
 * round the Sun, where no step can finish and no cue applies). After a
 * moment, Mission Control puts her back in a safe orbit around the planet.
 */
/** Forget every burn plan (Chapter 5's line-up has just moved a planet). */
game.replan = () => { burnPlan = null; transferPlan = null; planJob = null; coastPhase = null; predictorClock = 0; };

let lostSince = null;
function checkLost() {
  const goal = BODIES[game.transferTarget] || BODIES[game.captureTarget];
  const home = goal && goal.parent !== 'sun' ? goal.parent : null;
  if (!home || ship.soi !== 'sun' || ship.landedOn || game.cinematic) { lostSince = null; return; }
  if (lostSince === null) { lostSince = ship.t; return; }
  if (ship.t - lostSince < 15) return;
  lostSince = null;
  const hb = BODIES[home];
  const hs = bodyState(home, ship.t);
  const radius = home === 'jupiter' ? hb.radius * 20 : hb.radius * 1.6;
  const phase = Math.atan2(ship.z - hs.z, ship.x - hs.x);
  Object.assign(ship, circularOrbitState(home, radius, phase, ship.t), { landedOn: null, soi: home, angVel: 0, _accum: 0 });
  game.warpIndex = 0;
  burnPlan = null; transferPlan = null; planJob = null; coastPhase = null;
  hud.toast(IS_LEVEL1 ? 'Oops, you flew too far! Mission Control pulled you back. Try again!' : `You flew right out of ${home === 'earth' ? 'Earth' : hb.name}’s pull! Mission Control towed you back into orbit. Try again for ${game.transferTarget === 'moon' || game.captureTarget === 'moon' ? 'the Moon' : goal.name}.`, { kind: 'warn', ms: 5200 });
}

let lastCrashAt = -Infinity;
function handlePhysicsEvents(events) {
  for (const e of events) {
    if (e.type === EVENTS.CRASH) {
      // Never a game over: rewind, and say what happened in one line.
      const b = BODIES[e.body];
      const again = ship.t - lastCrashAt < 12;
      lastCrashAt = ship.t;
      const ok = rewind.rewind(ship, 8);
      game.warpIndex = 0;
      flightCam.shake(0.6);
      // Playtest: a rewind point can itself be inside the body (or crash
      // straight away), which looped crash -> rewind -> crash forever. Then
      // rescue her into a safe circular orbit instead.
      const s = b && bodyState(e.body, ship.t);
      const inside = s && Math.hypot(ship.x - s.x, ship.z - s.z) < b.radius + SHIP.collisionRadius + 0.3;
      // A body she isn't visiting (Easy playtest: Callisto, on the way to
      // Europa): orbiting IT would strand her, so the safe orbit is round the
      // planet she was flying round instead, clear of its moons.
      const visiting = [game.landTarget, game.captureTarget, game.transferTarget, game.target].includes(e.body);
      const home = !visiting && b && b.parent && b.parent !== 'sun' ? b.parent : null;
      if (b && home && (!ok || again || inside)) {
        const hb = BODIES[home];
        const hs = bodyState(home, ship.t);
        const radius = home === 'jupiter' ? hb.radius * 20 : hb.radius * 1.6;
        const phase = Math.atan2(ship.z - hs.z, ship.x - hs.x);
        Object.assign(ship, circularOrbitState(home, radius, phase, ship.t), { landedOn: null, soi: home, angVel: 0, _accum: 0 });
        burnPlan = null; transferPlan = null; planJob = null; coastPhase = null;
        hud.toast(t(`You flew into ${b.name}! Mission Control towed you back into a safe orbit around ${hb.name}.`, `Bump! You flew into ${b.name}. Mission Control pulled you back.`), { kind: 'warn', ms: 4800 });
      } else if (b && (!ok || again || inside)) {
        const phase = Math.atan2(ship.z - s.z, ship.x - s.x);
        Object.assign(ship, circularOrbitState(e.body, b.radius * 2.5, phase, ship.t), { landedOn: null, soi: e.body, angVel: 0, _accum: 0 });
        hud.toast(t(`Mission Control pulled you back up into a safe orbit around ${b.name}. Try again, and slow down before the surface!`, 'Crash! Mission Control pulled you back up. Try again, and go slower!'), { kind: 'warn', ms: 4800 });
      } else {
        hud.toast(t(`Too fast into ${b?.name || 'that'}! Rewound 8 seconds. Slow down before you touch the surface.`, 'Too fast! Rewound a little. Go slower this time.'), { kind: 'warn', ms: 4200 });
      }
    } else if (e.type === EVENTS.SLINGSHOT) {
      flightCam.kick(10);
      flightCam.shake(0.25);
    }
    bus.emit(e.type, e);
  }
}

// --- helpers ------------------------------------------------------------------------

const _origin = { x: 0, z: 0 };
const _sunDir = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _proj = new THREE.Vector3();

/** three.js yaw that points the ship's -Z nose along physics heading `angle`. */
function yawFor(angle) {
  return Math.atan2(-Math.cos(angle), -Math.sin(angle));
}

function relativeSpeed(states) {
  if (ship.soi === 'sun') return { speed: Math.hypot(ship.vx, ship.vz), vx: ship.vx, vz: ship.vz };
  const s = states[ship.soi];
  const vx = ship.vx - s.vx;
  const vz = ship.vz - s.vz;
  return { speed: Math.hypot(vx, vz), vx, vz };
}

function buildMarkers(states) {
  const out = [];
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  const ids = missions.markerIds ? missions.markerIds() : [game.target];
  // The next goal gets the big pulsing box and "Next:" (lead 2026-10-07).
  const goalId = ids.includes(game.target) ? game.target : ids[0];
  for (const id of ids) {
    if (!id || !states[id]) continue;
    const s = states[id];
    // In camera space (lead, 2026-10-06: "the cross is not always at the
    // right place"). The projected depth was the behind-test, and for far
    // bodies it rounds past 1 (the Chapter 5 edge labels hit the same), so a
    // planet in front was treated as behind and mirrored. Camera space has
    // no such rounding: in front is z < 0. Behind her, the edge arrow points
    // the true way round (left is left), straight down when dead behind.
    _proj.set(s.x - _origin.x, 0, s.z - _origin.z).applyMatrix4(camera.matrixWorldInverse);
    const behind = _proj.z >= -1e-6;
    let sx; let sy; let onScreen = false;
    if (!behind) {
      _proj.applyMatrix4(camera.projectionMatrix);
      onScreen = Math.abs(_proj.x) <= 1 && Math.abs(_proj.y) <= 1;
      sx = (_proj.x * 0.5 + 0.5) * w;
      sy = (-_proj.y * 0.5 + 0.5) * h;
    } else {
      const len = Math.hypot(_proj.x, _proj.y);
      const dx = len > 1e-9 ? _proj.x / len : 0; const dy = len > 1e-9 ? -_proj.y / len : 1;
      sx = w / 2 + dx * w * 4; sy = h / 2 + dy * h * 4;
    }
    const dist = Math.hypot(s.x - ship.x, s.z - ship.z) - BODIES[id].radius;
    // markers.js appends "· <distance> u" itself; the label is just the name.
    const goal = id === goalId;
    out.push({ id, label: goal ? `Next: ${BODIES[id].name}` : BODIES[id].name, screenX: sx, screenY: sy, onScreen, distance: Math.max(0, dist), kind: goal ? 'goal' : 'target' });
  }
  // Two sources of non-body markers: whatever the current step set on
  // missions.extraMarkers (Act 1's satellite), and the mining controller's
  // rock markers (Act 3, which follow the flying mode's rockMarkers rule).
  const extra = [
    ...(missions.extraMarkers ? missions.extraMarkers(camera, _origin, w, h) : []),
    ...(game.getMiningMarkers ? game.getMiningMarkers(camera, _origin, w, h) : []),
  ];
  hud.setMarkers(out.concat(extra));
}

/** Heading (physics angle) the current step wants, or null. */
function aimHeading(states) {
  // The autopilot tidying her orbit (autopilot.js orbitFix) points her itself.
  if (game.aimOverride != null) return game.aimOverride;
  const hint = game.aimHint;
  if (!hint) return null;
  const rel = ship.soi === 'sun' || !states[ship.soi] ? { vx: ship.vx, vz: ship.vz } : { vx: ship.vx - states[ship.soi].vx, vz: ship.vz - states[ship.soi].vz };
  if (hint === 'prograde') return Math.atan2(rel.vz, rel.vx);
  if (hint === 'retrograde') return Math.atan2(-rel.vz, -rel.vx);
  if (hint === 'with-body' && ship.soi !== 'sun' && states[ship.soi]
      && Math.hypot(ship.x - states[ship.soi].x, ship.z - states[ship.soi].z) - BODIES[ship.soi].radius < 3) {
    // Too close to the ground to fly sideways: climb straight up first.
    return Math.atan2(ship.z - states[ship.soi].z, ship.x - states[ship.soi].x);
  }
  if (hint === 'with-body' && ship.soi !== 'sun' && states[ship.soi]) {
    // The way the body she's near is travelling (round its own parent). Leaving
    // the Moon this way is the slingshot; leaving Earth this way sends her
    // outward toward Mars. The same hint does both as her SOI changes.
    const b = BODIES[ship.soi];
    const p = b.parent === 'sun' ? { vx: 0, vz: 0 } : states[b.parent];
    const bx = states[ship.soi].vx - p.vx;
    const bz = states[ship.soi].vz - p.vz;
    // Final-check playtest (Level 4 Easy): in a circular orbit round Earth,
    // for half of every lap she moves AGAINST Earth's own direction. Burning
    // "with Earth" there cancels her orbital speed and drops her into it; the
    // crash rescue put her back in the same orbit and it happened again,
    // forever. When the body's direction opposes her motion, point along her
    // path instead: a prograde burn escapes too.
    if (rel.vx * bx + rel.vz * bz < 0) return Math.atan2(rel.vz, rel.vx);
    return Math.atan2(bz, bx);
  }
  if (hint === 'up' && ship.soi !== 'sun' && states[ship.soi]) {
    // Straight away from the ground: for lifting off.
    return Math.atan2(ship.z - states[ship.soi].z, ship.x - states[ship.soi].x);
  }
  if (hint === 'target' && states[game.target]) {
    return Math.atan2(states[game.target].z - ship.z, states[game.target].x - ship.x);
  }
  return typeof hint === 'number' ? hint : null;
}

// The aim arrow: a green chevron on the orbital plane just ahead of the ship
// (green like the aim dials' "point here" mark: it was cyan, and the dial's
// motion arrow was blue - a child pointed against the wrong one),
// pointing where the step wants her to point (Easy and Medium).
const aimArrow = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1); shape.lineTo(0.7, 0.35); shape.lineTo(0.25, 0.35); shape.lineTo(0.25, 1);
  shape.lineTo(-0.25, 1); shape.lineTo(-0.25, 0.35); shape.lineTo(-0.7, 0.35); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  // +90 degrees puts the tip (shape y = -1) on -Z, the way yawFor turns a
  // nose: -90 left it on +Z, so the chevron pointed back at the ship.
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fe86b).multiplyScalar(1.8), transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 21;
  m.visible = false;
  return m;
})();
scene.add(aimArrow);

function applyMode(id, { fresh = false } = {}) {
  const mode = MODES[id] || MODES.medium;
  game.mode = mode;
  // The Bigger Tank upgrade adds 6 t before the mode's scale, so switching
  // modes never takes a built upgrade away.
  const tank = SHIP.fuelMass + (game.upgradesOwned?.has('biggerTank') ? 6 : 0);
  game.fuelCapacity = tank * mode.fuelScale;
  ship.fuel = fresh ? game.fuelCapacity : Math.min(ship.fuel, game.fuelCapacity);
  ship.safeLandingSpeed = SHIP.safeLandingSpeed * mode.landingScale;
  ship.burnScale = mode.burnScale ?? 1;
  try { localStorage.setItem(FLIGHT_MODE_KEY, mode.id); } catch { /* private mode */ }
  bus.emit('flight-mode', mode);
  predictorClock = 0;
}

function savedModeId() {
  try { return localStorage.getItem(FLIGHT_MODE_KEY); } catch { return null; }
}

bus.on('flight-mode-menu', async (done) => {
  const id = await hud.chooseFlightMode({ modes: MODES, current: game.mode.id });
  if (id && id !== game.mode.id) {
    applyMode(id);
    hud.toast(`Flying mode: ${game.mode.label} (${game.mode.rank})`, { kind: 'good', ms: 2600 });
  }
  done?.();
});

// --- burn-window cue (Easy and Medium) ---------------------------------------------
//
// A transfer from a circular orbit to a moving target only works if the burn
// starts when the target is the right angle ahead: it must arrive where she
// arrives. That timing is the hard, invisible part of the whole skill, so on
// Easy and Medium a banner counts down to the window ("Burn window in 12 s"),
// says "Hold Space now!" when she's in it, and "Let go of Space!" once her orbit
// reaches the target's. Hohmann-transfer timing, computed from the rails.

const burnCue = document.createElement('div');
burnCue.id = 'burnCue';
Object.assign(burnCue.style, {
  // Bottom centre, not the top (lead: the countdown showed at the top AND in
  // the bottom panel; keep the top of the screen clear). Hidden while a
  // bottom panel (transfer, aim dial, landing gauge) is up: its own line says
  // the same thing.
  position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)', zIndex: '12', maxWidth: 'min(640px, 60vw)', textAlign: 'center',
  padding: '9px 18px', borderRadius: '14px', font: '800 17px system-ui, -apple-system, "Segoe UI", sans-serif',
  letterSpacing: '.01em', pointerEvents: 'none', display: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
  transition: 'background 200ms ease, color 200ms ease',
});
document.body.appendChild(burnCue);
// Medium's slow motion: a small chip under the banner (appended to the banner
// text it wrapped every burn line onto two lines).
const slowChip = document.createElement('div');
slowChip.textContent = '🐢 slow motion';
Object.assign(slowChip.style, {
  position: 'fixed', left: '50%', bottom: '232px', transform: 'translateX(-50%)', zIndex: '12',
  padding: '3px 12px', borderRadius: '999px', font: '700 13px system-ui, -apple-system, "Segoe UI", sans-serif',
  background: 'rgba(26,22,18,.8)', color: '#bfe9ff', pointerEvents: 'none', display: 'none',
});
document.body.appendChild(slowChip);

/** A bottom-centre panel (transfer / aim dial / landing gauge) is showing.
 *  Re-measured at most 4 times a second: reading the layout every frame cost
 *  ~0.7 ms (flight agent's frame profile). */
let _panelUp = false;
let _panelUpAt = -Infinity;
function bottomPanelUp() {
  const now = performance.now();
  if (now - _panelUpAt < 250) return _panelUp;
  _panelUpAt = now;
  _panelUp = measurePanelUp();
  return _panelUp;
}
function measurePanelUp() {
  for (const sel of ['.sp-xfer', '.sp-aim', '.sp-landing']) {
    const e = document.querySelector(sel);
    if (!e || !e.getClientRects().length) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) return true;
  }
  return false;
}

/**
 * While the autopilot flies, the banner NARRATES instead of giving orders
 * ("Tap Space" to a child whose ship flies itself was confusing). The original
 * order stays in data-raw: the autopilot steers by it.
 */
function narrate(kind, text) {
  if (kind === 'burn') return /lift off/i.test(text) ? 'Autopilot: lifting off! 🚀' : 'Autopilot: firing the engine! 🚀';
  if (kind === 'stop') {
    if (/Let go|Ease off/i.test(text)) return 'Autopilot: engine off. Coasting.';
    if (/Too fast|brake/i.test(text)) return 'Autopilot: landing gently...';
    if (/hits/i.test(text)) return 'Autopilot: steering away from a crash.';
    return 'Autopilot: fixing the path.';
  }
  // Landing and capture lines: one calm sentence each (they used to swap
  // every second and kept the child's orders and live speed numbers).
  if (/Falling gently|Falling slowly|Getting fast|keep the speed|Time to land/i.test(text)) return 'Autopilot: landing gently...';
  if (/lowest point/i.test(text)) return 'Autopilot: coasting to the lowest point, then it will brake.';
  const kept = text.split(/(?<=[.!])\s+/).filter((s) => !/\bW\b|[Kk]eys 1|time warp|time go fast|Get ready to point|Get ready to face|green arrow|green mark|Point |A \/ D/.test(s)).join(' ');
  return `Autopilot: ${kept || text}`;
}

/**
 * Medium: the burn moments run in slow motion (lead: precise W timing is hard
 * for children) - the last 3 s before a burn window, the burn, and "let go".
 * Set here, read by the physics step; it lapses by itself 0.2 s after the
 * banner stops asking for it.
 */
const SLOW_MO = 0.4;
/**
 * How fast "x1" runs: 0.75 sim seconds per real second (lead, 2026-10-05:
 * "1x speed has to become 0.5 or 0.75x - the earlier pace was good, right now
 * everything is going too fast"). Every time-warp level multiplies THIS, so
 * x4 is still four times normal flight; it just gives a child a little longer
 * to read the banner, turn, and let go of Space. Fuel and gravity are per sim
 * second, so nothing about the flying gets easier or harder - only calmer.
 */
const FLIGHT_PACE = 0.75;
function slowMoNow() {
  return game.mode?.id === 'medium' && !game.autopilot?.on && performance.now() < (game.slowUntil || 0);
}

function setCue(kind, text) {
  burnCue.dataset.raw = kind ? text : '';
  // Focus mode (hud.setFocus): while she has to ACT - burn, let go, turn to
  // point, land, lift off - the side panels drop everything but the
  // essentials. Lapses 0.3 s after the banner stops asking.
  if (kind && (kind === 'burn' || kind === 'stop'
    || /window in ([0-9]|1[0-9]) s|Turn to point|Falling gently|Falling slowly|Getting fast|Too fast|Time to land|lift off/i.test(text))) game.focusUntil = performance.now() + 2000;
  if (kind && (kind === 'burn' || kind === 'stop' || kind === 'wait')
    && /BURN NOW|Let go of Space|window in [1-3] s\./.test(text)) game.slowUntil = performance.now() + 200;
  if (game.autopilot?.on && kind) text = narrate(kind, text);
  slowChip.style.display = kind && !game.autopilot?.on && slowMoNow() ? 'block' : 'none';
  if (!kind) { burnCue.style.display = 'none'; return; }
  const look = {
    wait: ['rgba(26,22,18,.86)', '#ffe9c7'],
    burn: ['#56c271', '#0d2412'],
    stop: ['#ff9f43', '#2a1405'],
    good: ['rgba(26,22,18,.86)', '#9fe6a8'],
  }[kind];
  // A DIFFERENT message may replace the shown one at most every 0.7 s (the
  // capture and landing lines flipped every frame or two: "BURN NOW" /
  // "Your path hits", "Too fast" / "Getting fast"). The same message with new
  // numbers (a countdown, a speed) updates at once. data-raw above is never
  // held back: the autopilot steers by it.
  const now = performance.now();
  const cat = `${kind}|${text.replace(/[\d.]+/g, '#')}`;
  const wasHidden = burnCue.style.display === 'none';
  if (!wasHidden && burnCue.dataset.cat !== cat && now - (Number(burnCue.dataset.shownAt) || 0) < 700) return;
  if (burnCue.dataset.cat !== cat) { burnCue.dataset.cat = cat; burnCue.dataset.shownAt = String(now); }
  burnCue.style.display = bottomPanelUp() ? 'none' : 'block';
  burnCue.style.background = look[0];
  burnCue.style.color = look[1];
  if (burnCue.textContent !== text) burnCue.textContent = text;
}

/**
 * Capture cue (Easy and Medium): arriving at a moon, she needs to (1) make sure
 * her path doesn't hit it, (2) coast to her lowest point, (3) brake there.
 * Returns true when it drew something.
 */
let captureBurnSticky = false;
let swingInSticky = false;

/**
 * Seconds until she reaches her lowest point round a body (Kepler's
 * equation, closed or escape-speed orbit); 0 once she's past it.
 */
function timeToPeriapsis(rx, rz, vx, vz, mu) {
  const r = Math.hypot(rx, rz);
  const v2 = vx * vx + vz * vz;
  const rv = rx * vx + rz * vz;
  const ex = ((v2 - mu / r) * rx - rv * vx) / mu;
  const ez = ((v2 - mu / r) * rz - rv * vz) / mu;
  const e = Math.hypot(ex, ez);
  const energy = v2 / 2 - mu / r;
  if (rv >= 0 || e < 1e-6 || Math.abs(energy) < 1e-9) return 0;
  const a = -mu / (2 * energy);
  if (e < 1) {
    const E = -Math.acos(Math.max(-1, Math.min(1, (1 - r / a) / e)));
    return -(E - e * Math.sin(E)) / Math.sqrt(mu / (a * a * a));
  }
  const F = -Math.acosh(Math.max(1, (1 - r / a) / e));
  return -(e * Math.sinh(F) - F) / Math.sqrt(mu / Math.abs(a * a * a));
}
function updateCaptureCue(thrust) {
  const target = game.captureTarget;
  const tb = target && BODIES[target];
  if (!tb || ship.soi !== target || ship.landedOn || game.cinematic) return false;
  const oe = orbitElements(ship);
  const R = tb.radius;
  const s = game.states[target];
  const rx = ship.x - s.x; const rz = ship.z - s.z;
  const vx = ship.vx - s.vx; const vz = ship.vz - s.vz;
  const r = Math.hypot(rx, rz);
  const vr = (rx * vx + rz * vz) / r;
  const help = cuesOn();

  const theName = target === 'moon' ? 'the Moon' : tb.name;
  if (oe.bound && oe.periapsis > R * 1.08 && oe.apoapsis < tb.soi * 0.7) {
    game.aimHint = 'retrograde';
    if (help) setCue(thrust > 0 ? 'stop' : 'good', thrust > 0 ? 'Let go of Space! You’re in orbit.' : `In orbit around ${theName}!`);
    return help;
  }
  // A real crash course only (1.1 R, just above the "in orbit" floor of
  // 1.08 R): at 1.3 R she was told to swing wider from a pass 3 u above
  // Europa, mid-brake, and the two cues fought until she flew off.
  if (oe.periapsis < R * 1.1) {
    // Already slow enough to come down on a body she may land on (lead: she
    // braked hard at the Moon and was told to "swing wider" all the way down):
    // that's a landing, not a crash, so the landing cue talks her down
    // (isCaptured counts a touchdown as the catch).
    const vImpact = Math.sqrt(Math.max(0, 2 * (oe.energy + tb.gm / R)));
    // (Well under orbit speed at the ground: clearly coming down, not a fly-by.)
    if (help && tb.landable && vImpact < Math.min(ship.safeLandingSpeed * 2.5, 0.8 * Math.sqrt(tb.gm / R))) return updateLandingCue(thrust, target);
    // Crash course: burn along the TANGENT (sideways, in her direction of
    // travel) to raise the lowest point. The arrow shows it; Easy's Space aims it.
    const h = rx * vz - rz * vx;
    const sg = h >= 0 ? 1 : -1;
    game.aimHint = Math.atan2((rx / r) * sg, (-rz / r) * sg);
    if (help) setCue('stop', t(`Your path hits ${theName}! Point along the arrow and tap Space to swing wider.`, `Watch out, you’ll hit ${theName}! Follow the arrow and tap Space.`));
    return help;
  }
  game.aimHint = 'retrograde';
  if (!help) return false;
  // Passing too far out to stay: braking at a lowest point beyond ~0.7 of
  // the gravity zone can't make an orbit that counts (Medium playtest: five
  // laps round Jupiter, 5,500 s). Far out, a small backwards burn swings the
  // path in a long way, so do that first, on the way in.
  if (vr < 0 && oe.periapsis > tb.soi * 0.55) swingInSticky = true;
  if (swingInSticky && (vr >= 0 || oe.periapsis < tb.soi * 0.4)) swingInSticky = false;
  if (swingInSticky) {
    setCue('burn', t(`You’ll pass too far from ${theName} to stay. Point backwards (against your motion) and hold Space to swing in closer.`, 'Too far away! Face the way you came and hold Space to come closer.'));
    aimHelp = { phase: 'burn', line: aimLine(t('Nose on the green mark, opposite your motion, and hold Space: a small push now swings your path in closer.', 'Face the way you came, then hold Space.')) };
    return true;
  }
  // Once past the lowest point on a still-too-big loop, keep braking: any
  // backwards burn shrinks the far side.
  // Sticky: once "BURN NOW" shows it stays until she's clearly past her
  // lowest point (braking shifts the numbers, which made it flicker).
  // Centred on her lowest point: on when the time to get there is half the
  // burn she needs (a burn mostly BEFORE it drags the lowest point into the
  // ground: Easy playtest at Europa, with gentle thrusters the burn is ~3 s),
  // or once she's past it; off only when clearly early. (Not an inward-speed
  // threshold: that flickered on slow Moon arrivals.)
  const mass = SHIP.dryMass + ship.fuel + ship.cargo;
  const accelCap = (SHIP.thrust * (tb.gm <= 500 ? 0.3 : 1)) / mass;
  const vPeri = Math.sqrt(Math.max(0, 2 * (oe.energy + tb.gm / oe.periapsis)));
  const burnT = Math.max(0, vPeri - Math.sqrt(tb.gm / oe.periapsis)) / accelCap;
  const tPeri = timeToPeriapsis(rx, rz, vx, vz, tb.gm);
  if (tPeri <= burnT / 2 + 0.4) captureBurnSticky = true;
  else if (tPeri > burnT / 2 + 3) captureBurnSticky = false;
  // Let go a little BEFORE orbit speed: playtest at Europa, the speeds that
  // count as "in orbit" were under 1 u/s apart, so by the time "in orbit"
  // showed she had already braked past it into a crash course, and the cue
  // flipped between "brake" and "swing wider" until 2.6 t of fuel was gone.
  const orbitSpeed = Math.sqrt(tb.gm / r);
  // (Only where a circle would count: further out than ~0.65 of the zone even
  // a perfect circle is too wide, and "let go" / "burn" alternated per frame.)
  if (captureBurnSticky && thrust > 0 && oe.bound && r < tb.soi * 0.65 && Math.hypot(vx, vz) < orbitSpeed * 1.08) {
    setCue('stop', t('Let go of Space! You’re nearly in orbit.', 'Let go of Space! Almost there!'));
  } else if (captureBurnSticky) {
    setCue('burn', t('BURN NOW! Point backwards (opposite to the way you’re moving) and hold Space to slow down', 'BURN NOW! Face the way you came and hold Space to slow down'));
    aimHelp = { phase: 'burn', line: aimLine(t('Nose on the green mark, opposite your motion, and hold Space. The engine pushes against your speed and slows you down.', 'Face the way you came: nose on the green mark. Hold Space to slow down.')) };
  } else {
    // The coast before the burn: say now what's coming, so she can turn
    // round in good time (lead: "backwards" alone wasn't clear).
    const inS = Math.max(1, Math.round(tPeri - burnT / 2));
    setCue('wait', t(`Coast to your lowest point, then brake. ${Math.round(r - R)} u above ${theName}`, 'Coast. Wait for your lowest point, then slow down.'));
    aimHelp = {
      phase: 'ready', inS,
      line: aimLine(inS > 10
        ? t(`Get ready: at your lowest point (in about ${inS} s) you’ll turn to face backwards, opposite to your motion, and burn.${inS > 100 ? ' Time warp (1-4) is fine until then.' : ''}`, `Get ready! Soon you face the way you came, then hold Space.${inS > 100 ? ' Keys 1 to 4 make time go fast.' : ''}`)
        : t(`Turn now: at your lowest point (in ${inS} s) you burn facing backwards, opposite to your motion.`, 'Face the way you came now. Soon you hold Space.')),
    };
  }
  return true;
}

/**
 * The fastest she can safely be falling at this height: the speed from which
 * her engine can still stop her just above the ground (v^2 = 2 a h, with a =
 * engine minus local gravity), at 70% for margin, never below a gentle floor.
 * Braking only above this is efficient; braking earlier is hovering, which
 * burned three times the fuel in playtest.
 */
function landingSpeedLimit(tb, alt) {
  const r = tb.radius + Math.max(0, alt);
  const gLocal = tb.gm / (r * r);
  const accel = SHIP.thrust / (SHIP.dryMass + ship.fuel + ship.cargo);
  const net = Math.max(0.2, accel - gLocal);
  return Math.max(ship.safeLandingSpeed * 0.75, Math.sqrt(2 * net * Math.max(0, alt - 0.5)) * 0.7);
}

/**
 * Landing cue (Easy and Medium). An orbit that misses the ground never lands
 * on its own, and nothing else tells a child how to START coming down, so:
 * brake to drop the lowest point into the ground, then keep the fall in the
 * green (a speed limit that shrinks as the ground gets close).
 */
let tooFastSticky = false;
let headsUpSticky = false;
function updateLandingCue(thrust, target = game.landTarget) {
  const tb = target && BODIES[target];
  if (!tb || !cuesOn() || ship.soi !== target || ship.landedOn || game.cinematic) { tooFastSticky = false; headsUpSticky = false; return false; }
  const oe = orbitElements(ship);
  const s = game.states[target];
  const vx = ship.vx - s.vx; const vz = ship.vz - s.vz;
  const speed = Math.hypot(vx, vz);
  const alt = Math.hypot(ship.x - s.x, ship.z - s.z) - tb.radius;
  // Aim: against her motion, plus a steady lean upward. Moving fast that's
  // simply "backwards"; nearly stopped it becomes "straight up". (Hard
  // playtest: pure backwards swung wildly at low speed, any sideways drift
  // flipped it, so she couldn't line up to brake and touched down too fast.)
  {
    const rr = alt + tb.radius;
    const ux = (ship.x - s.x) / rr; const uz = (ship.z - s.z) / rr;
    const lean = oe.periapsis > tb.radius ? 0 : 1; // not while braking out of orbit
    game.aimHint = Math.atan2(-vz + uz * lean, -vx + ux * lean);
    const retro = Math.atan2(-vz, -vx);
    var aimUp = Math.abs(Math.atan2(Math.sin(game.aimHint - retro), Math.cos(game.aimHint - retro))) > 0.35; // eslint-disable-line no-var
  }
  // Medium/Hard playtest: without auto-aim she has to TURN before she can
  // brake (up to ~2 s for a half turn), and the limit assumed an instant
  // burn: "Too fast!" came 1.7 u up, still facing sideways, and she crashed
  // every time. So on manual modes the limit leaves room for the turn, and
  // while she falls she is told to keep the nose on the arrow.
  const manual = !game.mode.autoAim && !landSteerOn();
  const want = aimHeading(game.states);
  const err = want === null ? 0 : Math.abs(Math.atan2(Math.sin(want - ship.angle), Math.cos(want - ship.angle)));
  // Room to turn only while she isn't lined up yet: once she's pointing the
  // right way the full margin just made her hover down (1.8 t at Europa).
  const room = manual ? (err > 0.35 ? 1.5 : 0.3) : 0;
  const limit = landingSpeedLimit(tb, alt - speed * room);
  // Calmer "Too fast!" (lead: it flipped on and off every frame): bands, not
  // one line. From 85% of the limit she gets an early heads-up ("Getting
  // fast"); past the limit "Too fast!" stays until she's back under 70%, and
  // then the heads-up stays until she's down at 60% - so a brake-and-fall
  // rhythm swaps two banners, not three.
  const falling = oe.periapsis <= tb.radius;
  if (!falling) { tooFastSticky = false; headsUpSticky = false; }
  else {
    if (speed > limit) tooFastSticky = true;
    else if (speed < limit * 0.7) tooFastSticky = false;
    if (speed > limit * 0.85) headsUpSticky = true;
    else if (speed < limit * 0.6) headsUpSticky = false;
  }
  landingHelp = { limit, tooFast: tooFastSticky, headsUp: headsUpSticky };
  // Easy and Medium: the ship keeps itself pointed backwards for the whole
  // landing and she only presses W (lead: re-aiming every second while
  // braking was too much for a child). See landSteer in tick().
  game.landingAt = performance.now();
  const auto = landSteerOn();
  if (!falling) {
    setCue('burn', auto
      ? t(`Brake to start your descent: hold Space (the ship points itself backwards). ${Math.round(alt)} u up`, `Time to land! Hold Space. The ship turns by itself. ${Math.round(alt)} u up`)
      : t(`Brake to start your descent: point backwards (against your motion) and hold Space. ${Math.round(alt)} u up`, `Time to land! Face the way you came and hold Space. ${Math.round(alt)} u up`));
    aimHelp = { up: aimUp, phase: 'burn', line: aimLine(t('Nose on the green mark, opposite your motion, and hold Space: slowing down drops your path onto the ground.', 'Face the way you came and hold Space to start coming down.')) };
  } else if (tooFastSticky) {
    setCue('stop', t(`Too fast! Hold Space to brake. Speed ${speed.toFixed(1)}`, 'Too fast! Hold Space to slow down.'));
    aimHelp = { up: aimUp, phase: 'brake', line: aimLine(t('Hold Space with the nose on the green mark until the speed is back in the green.', 'Hold Space until the speed is green again.')) };
  } else if (thrust > 0 && speed < ship.safeLandingSpeed * 0.45 && !(game.mode.id === 'easy' || game.mode.id === 'medium')) {
    setCue('stop', t('Ease off Space! Let the ship drift down.', 'Let go of Space! Float down slowly.'));
  } else if (headsUpSticky) {
    setCue('wait', auto
      ? t(`Getting fast: get ready to hold Space. Speed ${speed.toFixed(1)}`, 'Getting fast! Get ready to hold Space.')
      : t(`Getting fast: nose on the green arrow, ready to brake. Speed ${speed.toFixed(1)}`, 'Getting fast! Get ready to slow down.'));
    aimHelp = { up: aimUp, phase: 'land', line: aimLine(t('Speeding up. Get the nose on the green mark now, and brake with Space if it says Too fast.', 'Nose on the green mark. Get ready to hold Space.')) };
  } else if (manual && err > 0.35) {
    setCue('good', auto
      ? t(`Falling gently... the ship keeps itself pointed. Hold Space when it says Too fast. ${Math.round(alt)} u up`, 'Falling gently. Hold Space when it says Too fast.')
      : t(`Turn to point along the green arrow (← / →), ready to brake. ${Math.round(alt)} u up`, 'Turn to point along the green arrow (← / →).'));
    aimHelp = { up: aimUp, phase: 'land', line: t('Turn now so you’re ready to brake when you need to.', 'Turn now, ready to slow down.') };
  } else {
    setCue('good', t(`Falling gently... keep the speed in the green. ${Math.round(alt)} u up`, `Good! Falling slowly. Just keep the speed in the green. ${Math.round(alt)} u up`));
  }
  return true;
}

/**
 * Escape cue (Easy and Medium), for steps with `escape: true`: burn only until
 * her path leaves the body she's near, then coast. Without it, a child (and
 * the playtest driver) burned all the way to the edge of Earth's pull and
 * spent the whole tank.
 */
function updateEscapeCue(thrust) {
  if (!game.escapeStep || !cuesOn() || game.cinematic || ship.soi === 'sun') return false;
  if (ship.landedOn) { setCue('burn', 'Hold Space to lift off!'); return true; }
  const oe = orbitElements(ship);
  const body = BODIES[ship.soi]?.name || 'planet';
  const name = body === 'Moon' ? 'the Moon' : body; // "the Moon", but "Jupiter"
  // Escaping for real: unbound AND the dotted path doesn't crash back into
  // it. (Playtest: straight up off the Moon she was "escaping", but with
  // almost no speed left over she kept pace with it and fell back 60 s later.)
  const pred = game.prediction;
  const here = ship.soi;
  // Only a fall back INTO it counts: a harmless second pass by it doesn't,
  // and waiting for that to vanish too overshot Mars (another 0.5 t).
  const returns = pred?.impact?.body === here;
  if (!oe.bound && !returns) {
    setCue(thrust > 0 ? 'stop' : 'good', thrust > 0 ? `Let go of Space! You’re escaping ${name}’s pull.` : `Escaping ${name}’s pull. Coast!`);
  } else {
    setCue('burn', t(`Follow the arrow and hold Space to break free of ${name}’s pull`, `Follow the arrow and hold Space to fly away from ${name}`));
  }
  return true;
}

/**
 * Whether the guidance banner runs: Easy and Medium, or a test forcing it on
 * (game.debugCues) to prove Hard is FINISHABLE without showing a player hints.
 */
function cuesOn() {
  return game.mode.aimArrow || !!game.debugCues;
}

/** The last transfer plan: { at (ms), simT, target, p }. */
let transferPlan = null;

/** Easy and Medium: is the landing guidance up (the ship steers itself)? */
function landSteerOn() {
  return (game.mode?.id === 'easy' || game.mode?.id === 'medium') && !game.manualAim && !ship.landedOn && !game.cinematic
    && performance.now() - (game.landingAt || 0) < 300;
}

/** Seconds of waiting ahead: to the next burn window, or to the closest approach. */
function waitAhead() {
  let w = 0;
  const p = transferPlan && transferPlan.target === game.target ? transferPlan.p : null;
  if (p && Number.isFinite(p.tau)) w = Math.max(w, p.tau - (ship.t - transferPlan.simT));
  const c = game.prediction?.closest;
  if (c && Number.isFinite(c.t)) w = Math.max(w, c.t - ship.t);
  return w;
}
/**
 * A full planner search in progress, run a slice per frame: { target, simT,
 * it } (it = planTransferSteps generator). When it finishes it becomes
 * transferPlan, dated from when it STARTED (its tau counts from then).
 */
let planJob = null;
const PLAN_SLICE_MS = 4;
function runPlanJob() {
  const t0 = performance.now();
  let r;
  // Stop BEFORE a piece that wouldn't fit the slice (the last piece's time as
  // the guess): checking only after each piece let a 3-5 ms piece run the
  // slice to 10-12 ms (2026-10-05 lab).
  let t1 = t0; let piece = 0;
  do { r = planJob.it.next(); const t2 = performance.now(); piece = t2 - t1; t1 = t2; } while (!r.done && t1 - t0 + piece < PLAN_SLICE_MS);
  if (!r.done) return;
  transferPlan = { at: performance.now(), simT: planJob.simT, target: planJob.target, p: r.value };
  planLog('full', { started: +planJob.simT.toFixed(1), at: r.value ? +(planJob.simT + r.value.tau).toFixed(1) : null, dv: r.value?.dv, peri: r.value?.peri });
  planJob = null;
}
/** Debug: why the plan changed, last 40 (window.__space.planLog). */
game.planLog = [];
function planLog(what, o = {}) {
  game.planLog.push({ t: +ship.t.toFixed(1), what, ...o });
  if (game.planLog.length > 40) game.planLog.shift();
}
/** A timed burn in progress: { target, dvTarget, along, delivered, startT, maxT }. */
let burnPlan = null;
/** After a main burn: coast to { untilR } from the parent before corrections. */
let coastPhase = null;
let coastCheck = null; // { target, t, p } exact no-burn arrival, refreshed every 2 s
let onCourseTarget = null; // last target the cue called "on course" (hysteresis)
/**
 * What the transfer help is flying her to: the step's transfer target, or -
 * when she missed a moon on a capture step (flew past it and fell back round
 * its planet, on an orbit that no longer reaches it) - that moon. No step
 * asks for a transfer then, so the banner froze on the old "BURN NOW" with
 * nothing to follow; now she's guided back out exactly like a transfer step.
 */
function activeTransferTarget() {
  if (game.transferTarget) return game.transferTarget;
  const cap = game.captureTarget && BODIES[game.captureTarget];
  const missed = cap && cap.parent !== 'sun' && ship.soi === cap.parent &&
    !(game.prediction?.soiChanges || []).some((ch) => ch.to === game.captureTarget);
  return missed ? game.captureTarget : null;
}

/** Her distance from the transfer target's parent body (the Sun: 0,0). */
function burnPlanParentDist() {
  const t = activeTransferTarget();
  const par = t && (BODIES[t] || game.customTargets?.[t])?.parent;
  const ps = par && par !== 'sun' ? game.states[par] : { x: 0, z: 0 };
  return Math.hypot(ship.x - ps.x, ship.z - ps.z);
}

/**
 * Crash warning, on EVERY step (not just the ones with a cue): if her dotted
 * path ends inside the body she's near and she isn't meant to be landing on
 * it, say so and aim her sideways along her travel (which lifts the lowest
 * point). Playtest: a correction burn put her on course through Jupiter's
 * middle during a step that had no cue at all.
 */
let impactAimActive = false;
function updateImpactCue() {
  const imp = game.prediction?.impact;
  // Not during liftoff/escape steps: straight after liftoff the path always
  // curves back into the ground, and swapping her 'up' aim for a sideways one
  // left her skimming the surface burning fuel (playtest). The escape cue
  // handles those steps.
  // Nor when she reaches the moon she's flying to first: a path to the Moon
  // that would fall back to Earth AFTER it is the normal way there (she
  // brakes at the Moon), not a crash course to fix with a sideways burn.
  const goal = game.captureTarget || game.transferTarget || game.target;
  const reachesGoalFirst = !!imp && !!goal && (game.prediction?.soiChanges || []).some((c) => c.to === goal && c.t < imp.t);
  if (!imp || reachesGoalFirst || ship.landedOn || game.cinematic || game.escapeStep || imp.body !== ship.soi || game.landTarget === imp.body) {
    // Hand the arrow back to the step once the danger has passed.
    if (impactAimActive) { game.aimHint = game.missions?.step?.aim || null; impactAimActive = false; }
    return false;
  }
  impactAimActive = true;
  const s = game.states[imp.body];
  const rx = ship.x - s.x; const rz = ship.z - s.z;
  const vx = ship.vx - s.vx; const vz = ship.vz - s.vz;
  const r = Math.hypot(rx, rz);
  const sg = (rx * vz - rz * vx) >= 0 ? 1 : -1;
  game.aimHint = Math.atan2((rx / r) * sg, (-rz / r) * sg);
  const name = imp.body === 'moon' ? 'the Moon' : BODIES[imp.body]?.name || 'the planet';
  setCue('stop', t(`Your path hits ${name}! Point along the arrow and tap Space to swing wider.`, `Watch out, you’ll hit ${name}! Follow the arrow and tap Space.`));
  return true;
}

/**
 * What the orbit-transfer panel (hud/transferPanel.js) shows this frame, or
 * null. Set by updateBurnCue on transfer steps in EVERY mode: on Hard the
 * banner stays hidden (no hints) but the panel's numbers still show.
 */
let xfer = null;
/**
 * What the "point backwards" aim panel (hud/aimDial.js) shows this frame, or
 * null: set by the capture and landing cues on every slow-down burn (and the
 * coast before one). landingHelp = { limit, tooFast } for the landing gauge.
 */
let aimHelp = null;
let landingHelp = null;
const aimDial = createAimDial(hud.root);
/** The panel's one line: while the autopilot flies, it narrates instead. */
function aimLine(text) {
  return game.autopilot?.on ? t('Autopilot: pointing backwards, against your motion, to slow down.', 'Autopilot: facing the way you came, to slow down.') : text;
}
/** "Point backwards" spelled out (lead: at the Moon, or away from it?). */
const RETRO = () => t('Point backwards (against your motion)', 'Face the way you came');

/**
 * The planned path (see plannedView): the plan's burn applied at its moment,
 * then coasted on, drawn from the burn point. Worked out again only when the
 * plan itself changes (a new window or a different push), and frozen from
 * the moment the window opens until the burn is over. Easy and Medium only
 * (Hard shows no hints); hidden once the burn is done - her live line is
 * then the path.
 */
let planned = null; // { target, at, dv, frozen }
function updatePlannedPath() {
  const phase = xfer?.phase;
  const target = activeTransferTarget();
  const p = transferPlan && transferPlan.target === target ? transferPlan.p : null;
  const live = cuesOn() && !ship.landedOn && !game.cinematic && ['wait', 'point', 'burn'].includes(phase);
  if (!live) { if (planned) { planned = null; plannedView.setVisible(false); } return; }
  if (phase === 'burn' && planned) { planned.frozen = true; plannedView.setVisible(true); return; }
  if (!p || !planIsGood(p, BODIES[target] ? target : game.customTargets?.[target]) || planned?.frozen) {
    if (planned?.frozen && phase !== 'burn') planned = null;
    if (!planned) plannedView.setVisible(false);
    return;
  }
  const at = transferPlan.simT + p.tau;
  // Only a real change of plan redraws it: the last-moment re-checks in the
  // window move it by a fraction of a second and a sliver of push.
  const same = planned && planned.target === target && Math.abs(planned.at - at) < 1.5 && Math.abs(planned.dv - p.dv) <= 0.03 * Math.abs(planned.dv) + 0.01;
  if (!same) {
    const par = ship.soi;
    const ps = par === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : bodyState(par, ship.t, {});
    const q = coastRel(par, ship.x - ps.x, ship.z - ps.z, ship.vx - ps.vx, ship.vz - ps.vz, ship.t, Math.max(0, at - ship.t));
    const v = Math.hypot(q.vx, q.vz) || 1;
    const k = (v + p.dv) / v;
    const pa = par === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : bodyState(par, Math.max(ship.t, at), {});
    const start = { t: Math.max(ship.t, at), x: q.x + pa.x, z: q.z + pa.z, vx: q.vx * k + pa.vx, vz: q.vz * k + pa.vz, soi: par };
    const horizon = Math.max((p.arrive || 0) * 1.15 + 60, par === 'sun' ? 3200 : 400) * Math.max(1, game.mode.pathScale);
    plannedView.setPrediction(predict(start, { seconds: Math.min(horizon, 6000), maxPoints: 320 }));
    planned = { target, at, dv: p.dv, frozen: false };
  }
  plannedView.setVisible(true);
}

function updateBurnCue(states, thrust) {
  xfer = null;
  aimHelp = null;
  landingHelp = null;
  // Nothing to fly during the ending (game.paused) or a cinematic.
  if (game.paused || game.cinematic) { setCue(null); return; }
  if (updateImpactCue()) return;
  if (updateEscapeCue(thrust)) return;
  if (updateCaptureCue(thrust)) return;
  if (updateLandingCue(thrust)) return;
  const target = activeTransferTarget();
  // A body, or a custom target an act registered (Act 1's satellite).
  const tb = target && (BODIES[target] || game.customTargets?.[target]);
  const planTarget = BODIES[target] ? target : tb;
  const the = target === 'moon' ? 'the Moon' : tb?.name;
  if (!tb || ship.landedOn || game.cinematic || ship.soi !== tb.parent) { setCue(null); return; }
  // The banner only on Easy and Medium; the panel on every mode.
  const cue = (kind, text) => setCue(cuesOn() ? kind : null, text);
  const theName = target === 'moon' ? 'the Moon' : tb.name;
  const accelNow = SHIP.thrust / (SHIP.dryMass + ship.fuel + ship.cargo);
  const help = (phase, extra = {}) => {
    xfer = { phase, targetName: theName, auto: !!game.mode.autoAim, pilot: !!game.autopilot?.on, autoStop: cuesOn() && (game.mode.autoAim || !!game.autopilot?.on), accel: accelNow, ...extra };
  };
  // Already on a path that meets it SAFELY (not through the middle): coast.
  const c = game.prediction?.closest;
  // (Not the whole gravity zone: arriving beyond ~0.7 of it, braking at the
  // lowest point can't make an orbit that counts as captured.)
  // Also on course when the exact coast prediction arrives safely: from a
  // wide Jupiter orbit Europa is 700+ s away, past the dotted line's end, and
  // "not on course" sent her into a new correction after every coast
  // (Medium playtest: four burns, 0.8 t).
  // Every 2 s of sim; under time warp at most 4x a real second (at x64 it
  // ran every other frame, ~1 ms each, for an answer a coast never changes).
  if (!coastCheck || coastCheck.target !== target || (Math.abs(ship.t - coastCheck.t) > 2
    && (game.warpIndex === 0 || thrust > 0 || performance.now() - coastCheck.at > 250))) {
    const _tk = performance.now();
    coastCheck = { target, t: ship.t, at: performance.now(), p: planTransfer(ship, planTarget, { coastOnly: true }) };
    prof('plan-coast', _tk);
  }
  // ...but that model only knows the parent's pull: if the full prediction
  // passes through another body's gravity zone first (Medium playtest: the
  // path to Mars dipped back into Earth's), it isn't on course.
  const pred = game.prediction;
  // Only what happens BEFORE she arrives counts: a crash or another zone a
  // lap after the first pass at the target doesn't (she brakes at that pass),
  // and counting it flipped the cue "on course" / correction all the way in
  // (2026-10-05 lab, Jupiter to Europa).
  const chs = pred?.soiChanges || [];
  const tIn = chs.find((ch) => ch.to === target)?.t ?? Infinity;
  const tOut = chs.find((ch) => ch.from === target && ch.t > tIn)?.t ?? Infinity;
  const detour = (!!pred?.impact && pred.impact.t < tOut) || chs.some((ch) => ch.t < tIn && ch.to !== target && ch.to !== tb.parent && ch.to !== ship.soi);
  // Hysteresis: once on course, stay on course unless the arrival drifts
  // clearly out of the band (it flickered "on course" / "burn window in
  // 130 s" near the band's edge).
  const slack = onCourseTarget === target ? 0.15 : 0;
  const coastGood = !detour && planIsGood(coastCheck.p, planTarget, slack);
  // The dotted line's own closest pass counts too, but only a real one (not
  // where the line just ends), never on a detour or crash course, and with
  // the same give once on course. Without those it said "on course" and "not
  // on course" by turns all the way into Europa (2026-10-04 lab: 6 swaps in
  // the last 200 s, a correction burn between them).
  const lineGood = !detour && c && !c.atEnd && c.body === target && c.dist < tb.soi * 0.65 * (1 + slack)
    && c.dist > tb.radius * 1.4 * (1 - slack) && !(target === 'jupiter' && c.retro);
  const onCourse = coastGood || lineGood;
  onCourseTarget = onCourse ? target : null;
  if (onCourse) {
    if (burnPlan) burnPlan.latched = false; // Easy's booster stops here too
    // A burn that just got her on course: show its bar full, not "coast".
    if (thrust > 0 && burnPlan) help(burnPlan.delivered > burnPlan.dvTarget * 1.1 ? 'over' : 'full', { dvNeed: burnPlan.dvTarget, dvDone: burnPlan.delivered, along: burnPlan.along });
    else help('oncourse');
    cue(thrust > 0 ? 'stop' : 'good', thrust > 0 ? 'Let go of Space! You’re on your way.' : `On course for ${theName}. Coast!`);
    return;
  }

  // A burn in progress: deliver the speed change that was frozen when the
  // window opened, then stop. (Re-planning every moment of a burn made the
  // banner flip between "BURN NOW" and "window in 1 s": a low-orbit burn is
  // smeared over seconds, so each re-plan saw a slightly different window.)
  if (burnPlan && burnPlan.target !== target) burnPlan = null;
  if (burnPlan) {
    burnPlan.seenAt = ship.t; // the burn computer only acts while this cue is live
    const left = burnPlan.dvTarget - burnPlan.delivered;
    game.aimHint = burnPlan.along ? 'prograde' : 'retrograde';
    const bar = { dvNeed: burnPlan.dvTarget, dvDone: burnPlan.delivered, along: burnPlan.along };
    if (left <= 0.001) { // the burn computer delivers it exactly (Hard: she lets go)
      if (thrust > 0) {
        help(burnPlan.delivered > burnPlan.dvTarget * 1.1 ? 'over' : 'full', bar);
        cue('stop', 'Let go of Space! Coast and watch your dotted line.');
        return;
      }
      // Coast out to half-way before offering any correction: corrections
      // from a fast low orbit smear and miss too, and chaining them there sent
      // her out of Earth's pull in playtest. Mid-course, a small nudge is accurate.
      const pr = burnPlanParentDist();
      coastPhase = { target, untilR: (pr + tb.orbit) / 2, untilT: ship.t + 60 };
      burnPlan = null;
      transferPlan = null; planJob = null;
      planLog('burn done');
      help('coast');
      cue('good', `Coast and watch your dotted line reach ${the}.`);
      return;
    }
    if (ship.t - burnPlan.startT <= burnPlan.maxT) {
      help('burn', { ...bar, latched: !!burnPlan.latched });
      cue('burn', game.mode.autoAim
        ? t('BURN NOW! Tap Space to start the booster. It stops by itself.', 'BURN NOW! Tap Space. It stops by itself.')
        : `BURN NOW! ${burnPlan.along ? t('Point along your path', 'Point forward') : RETRO()} and hold Space`);
      return;
    }
    burnPlan = null; // window missed: find the next one
    transferPlan = null; planJob = null;
    planLog('window missed');
  }

  if (coastPhase && coastPhase.target !== target) coastPhase = null;
  if (coastPhase) {
    const r = burnPlanParentDist();
    const outward = tb.orbit > coastPhase.untilR;
    const reached = outward ? r >= coastPhase.untilR : r <= coastPhase.untilR;
    // Cap on the wait: a trip between planets takes thousands of seconds, a
    // trip to a moon one or two hundred. With 3000 s for a moon too, a
    // correction after a missed Moon coasted ~3000 s saying "watch your
    // dotted line reach the Moon" while it didn't (autopilot playtest).
    const coastCap = tb.parent === 'sun' ? 3000 : 400;
    if (!reached && ship.t < coastPhase.untilT + coastCap) {
      help('coast');
      cue('good', `Coast and watch your dotted line reach ${the}.`);
      return;
    }
    coastPhase = null;
  }

  // Plan against the orbit she's actually on (transferPlanner.js). It costs
  // ~40 ms, so it reruns every 2 s, or 4x a second while she's burning or the
  // window is close (the remaining burn shrinks as she burns).
  const now = performance.now();
  const lastTau = transferPlan && transferPlan.p ? transferPlan.p.tau - (ship.t - transferPlan.simT) : Infinity;
  // Replan on the SIM clock while burning or close to the window (the burn
  // is measured in sim seconds, and under warp or a slow frame real time
  // lags behind), otherwise every 2 s of real time.
  const simSince = transferPlan ? ship.t - transferPlan.simT : Infinity;
  const due = !transferPlan || (thrust > 0 || lastTau < 20 ? simSince > 0.2 : now - transferPlan.at > (lastTau > 120 ? 4000 : 2000) || simSince > Math.max(30, lastTau / 4));
  // A search for a coast she is no longer on is no use: she burned, was
  // towed, or the cue was off for a while (a3_depart waits for the shield)
  // and the half-done search picked a window for where she had been.
  if (planJob && (planJob.target !== target || !sameCoast(planJob.snap))) planJob = null;
  const prev = transferPlan && transferPlan.target === target ? transferPlan.p : null;
  // The window stays OPEN from just before it until the burn could have
  // finished, plus a grace period, whether or not the engine is firing yet:
  // on Easy the auto-aim holds the engine while it turns the ship, and the
  // window used to "pass" during that turn (playtest: a 0.4 s Moon burn).
  const inWindow = prev && planIsGood(prev, planTarget) && lastTau < 2
    && lastTau > -(Math.abs(prev.dv) / accelNow) - 3;
  if (inWindow && (due || planJob)) {
    // While burning in the window, a quick re-check of the remaining burn
    // (a few ms, so it runs straight away).
    planJob = null;
    const _tq = performance.now();
    transferPlan = { at: now, simT: ship.t, target, p: planTransfer(ship, planTarget, { quick: true, dvHint: prev.dv, maxTau: lastTau }) };
    if (!planIsGood(transferPlan.p, planTarget)) planLog('quick failed', { lastTau: +lastTau.toFixed(2), dv: prev.dv, got: transferPlan.p && { tau: transferPlan.p.tau, dv: transferPlan.p.dv, peri: transferPlan.p.peri, miss: transferPlan.p.miss, blocked: transferPlan.p.blocked } });
    prof('plan-quick', _tq);
  } else if (planJob) {
    // A full search already under way: another slice of it.
    const _tj = performance.now();
    runPlanJob();
    prof('plan-slice', _tj);
  } else if (!transferPlan || transferPlan.target !== target || due) {
    const p = prev && planIsGood(prev, planTarget) && lastTau > 0
      // Track the good plan we have (quick); only search afresh if it stops working.
      ? (() => { const _ta = performance.now(); const r = planTransfer(ship, planTarget, { around: { tau: lastTau, dv: prev.dv } }); prof('plan-around', _ta); return r; })()
      : null;
    if (p && planIsGood(p, planTarget)) transferPlan = { at: now, simT: ship.t, target, p };
    else {
      planLog('search', {
        target, had: prev ? { at: +(transferPlan.simT + prev.tau).toFixed(1), dv: prev.dv, good: planIsGood(prev, planTarget), lastTau: +lastTau.toFixed(1) } : null,
        tracked: p ? { at: +(ship.t + p.tau).toFixed(1), dv: p.dv, peri: p.peri, miss: p.miss, blocked: p.blocked, retro: p.retro } : null,
      });
      // The full search for the next window, spread over a few frames
      // (item 9: in one go it froze the picture for 50-150 ms every 2-4 s).
      planJob = { target, simT: ship.t, snap: { ...ship }, it: planTransferSteps(ship, planTarget, { clock: () => ship.t }) };
      runPlanJob();
    }
  }
  // Safety net: a flyby or an over-long burn can leave her escaping the Sun
  // altogether. Get her back on a closed orbit first, then plan.
  if (tb.parent === 'sun') {
    const oe = orbitElements(ship);
    // "Barely bound" counts too: an orbit reaching 400,000 u is no use, and
    // the planner's single burn can't fix it. Brake until the far point is
    // within reach of the target's orbit.
    if (!oe.bound || oe.apoapsis > Math.max(tb.orbit * 1.6, oe.periapsis * 1.05)) {
      game.aimHint = 'retrograde';
      help('fix', { along: false });
      cue('stop', !oe.bound
        ? t('You’re flying out of the solar system! Point backwards (against your motion) and hold Space.', 'Too far! Face the way you came and hold Space.')
        : t(`Your orbit swings way past ${the}. Point backwards (against your motion) and hold Space to bring it in.`, 'You’re going too far! Face the way you came and hold Space.'));
      return;
    }
  }
  const p = transferPlan && transferPlan.target === target ? transferPlan.p : null;
  if (!p) { help('search'); cue(null); return; }
  if ((p.miss > tb.soi * 2 || (p.peri ?? p.miss) < tb.radius) && thrust > 0) {
    // Mid-burn and the plan no longer works: stop rather than flash
    // "looking for a path" at a child whose thumb is on W.
    help('full');
    cue('stop', t('Let go of Space! Wait for the next burn window.', 'Let go of Space! Wait for the next green sign.'));
    return;
  }
  if (!(thrust > 0) && !planIsGood(p, planTarget)) {
    // No single burn in the search window gets there yet. Say so honestly
    // rather than showing the least-bad option as if it were a plan.
    help('search');
    cue('wait', t(`Looking for a path to ${the}... keep coasting (time warp is fine).`, `Looking for a way to ${the}... Coast and wait.`));
    return;
  }
  const tau = p.tau - (ship.t - transferPlan.simT);
  // The best plan needs no burn at all (she meets it a lap or two from now):
  // that's "on course", not a countdown to a burn of nothing. (Hard playtest:
  // "Burn window in 717 s" kept sliding while she coasted past the Moon.)
  if (Math.abs(p.dv) < 0.02) {
    help('oncourse');
    cue(thrust > 0 ? 'stop' : 'good', thrust > 0 ? 'Let go of Space! You’re on your way.' : `On course for ${theName}. Coast!`);
    return;
  }
  const burnTime = Math.abs(p.dv) / accelNow;
  const along = p.dv >= 0;
  game.aimHint = along ? 'prograde' : 'retrograde';

  // In the window: burn until the planned change is used up. The burn isn't
  // instant, so it starts half a burn early.
  if (tau <= burnTime * 0.5 + 0.3) {
    burnPlan = { target, dvTarget: Math.abs(p.dv), along, delivered: 0, startT: ship.t, maxT: burnTime * 2 + 6, seenAt: ship.t };
    help('burn', { dvNeed: burnPlan.dvTarget, dvDone: 0, along });
    cue('burn', game.mode.autoAim
      ? t('BURN NOW! Tap Space to start the booster. It stops by itself.', 'BURN NOW! Tap Space. It stops by itself.')
      : `BURN NOW! ${along ? t('Point along your path', 'Point forward') : RETRO()} and hold Space`);
    return;
  }
  // Close to the window: drop out of warp for her, so she can't fly past it.
  // (The autopilot paces the warp itself, slowing it step by step as the
  // window nears: dropping to 1x at 45 s left a real screen idling for most
  // of a minute before every burn.)
  if (tau < 45 && game.warpIndex > 0 && !game.autopilot?.on) {
    game.warpIndex = 0;
    // (No toast: the countdown is already on screen - lead: no repeated messages.)
  }
  const wait = Math.ceil(tau);
  help(tau < 20 ? 'point' : 'wait', { tau, dvNeed: Math.abs(p.dv), dvDone: 0, along });
  cue('wait', tau > 100
    ? t(`Burn window in ${wait} s. Use time warp (keys 1 to 4) to get there faster`, `Coast and wait ${wait} s for the green sign. Keys 1 to 4 make time go fast.`)
    : t(`Burn window in ${wait} s. Get ready to point ${along ? 'along your path' : 'backwards (against your motion)'}`, `Burn window in ${wait} s. Get ready to ${along ? 'point forward' : 'face the way you came'}`));
}

// --- loop ---------------------------------------------------------------------------

let predictorClock = 0;
let predSnap = null; // the ship when the last prediction was made (see sameCoast)
const _scA = {}; const _scB = {};
/** Is she still on the coast `s` (a ship snapshot) was on: no burn, no jump? */
function sameCoast(s) {
  if (!s || s.soi !== ship.soi || ship.landedOn) return false;
  const b0 = bodyState(s.soi, s.t, _scA); const b1 = bodyState(s.soi, ship.t, _scB);
  const q = coastRel(s.soi, s.x - b0.x, s.z - b0.z, s.vx - b0.vx, s.vz - b0.vz, s.t, ship.t - s.t);
  return Math.hypot(q.x - (ship.x - b1.x), q.z - (ship.z - b1.z)) < 0.5 + 1e-4 * Math.hypot(q.x, q.z);
}
let rewindClock = 0;
let saveClock = 0;
let last = performance.now();
let warpState = { warpAllowed: true, reason: null };

function frame(now) {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(realDt);
  requestAnimationFrame(frame);
}

/** One frame of everything. Split from frame() so tests can drive it by hand. */
/** Debug: worst time per part of the frame since the last reset (window.__space.prof). */
game.prof = {};
function prof(name, t0) {
  const d = performance.now() - t0;
  const e = game.prof[name] || (game.prof[name] = { max: 0, total: 0, n: 0 });
  if (d > e.max) { e.max = d; e.at = `${game.missions?.step?.id} t=${Math.round(ship.t)}`; }
  e.total += d; e.n++;
}

function tick(realDt, render = true) {
  // F / the button: everything stops where it is until she says carry on.
  freeze.update();
  // Real seconds played, for the end card (saved with the stats).
  if (!game.paused && !game.frozen && realDt < 1) { game.stats = game.stats || {}; game.stats.played = (game.stats.played || 0) + realDt; }
  if (activeScene) {
    // Flight is frozen while a mini-scene runs: no physics, no warp, and the
    // solar system simply waits for her to climb back aboard.
    const input = controls.sample();
    const mouse = controls.takeMouse();
    activeScene.tick(realDt, input, modalOpen ? { dx: 0, dy: 0, wheel: 0, dragging: false } : mouse, modalOpen);
    missions.tickCalm(realDt, modalOpen || game.paused || game.frozen);
    touch.update({ onFoot: true, cinematic: false, autoAim: game.mode.autoAim });
    if (render) composer.render();
    return;
  }

  const input = controls.sample();
  const paused = modalOpen || game.paused || game.frozen;

  // Easy's booster during a transfer burn: one tap of Space starts it and it
  // runs until the planned push is done (the burn computer stops it); S
  // stops it early. Lead request: Easy should be start/stop only.
  const liveBurn = burnPlan && ship.t - (burnPlan.seenAt ?? -Infinity) < 0.5 ? burnPlan : null;
  // Space fires the main engine too (lead 2026-10-07), like W.
  const flyThrust = input.fire && input.thrust >= 0 ? 1 : input.thrust;
  let wantThrust = flyThrust;
  if (liveBurn && game.mode.autoAim && !paused) {
    if (flyThrust > 0) liveBurn.latched = true;
    if (flyThrust < 0 || liveBurn.dvTarget - liveBurn.delivered <= 0.001) {
      if (liveBurn.latched && flyThrust < 0) wantThrust = 0; // S = stop, not reverse
      liveBurn.latched = false;
    }
    if (liveBurn.latched) wantThrust = 1;
  }
  // Fuel gate: an empty tank means no main engine (RCS still turns her).
  let thrust = ship.fuel > 0 ? wantThrust : 0;
  // Just landed, still holding W from the braking: no hop back up. Lead: on
  // the Moon the walk was loading while W lifted her off again, so the
  // banner said her path hit the Moon over the whole walk. Liftoff is for
  // the liftoff step (escape); a step with nothing to fly keeps her parked.
  if (ship.landedOn && thrust > 0 && !game.escapeStep
    && (game.landTarget === ship.landedOn || (!game.transferTarget && !game.captureTarget && !game.landTarget))) thrust = 0;
  const physInput = { thrust, turn: input.turn, strafe: input.strafe, precision: input.precision, steady: input.steady };
  // Gentle thrusters while capturing at a small moon: full thrust there
  // changes her speed by 4 u/s every second, and the whole "in orbit" range
  // is under 1 u/s wide (playtest, Europa). Landing keeps full thrust (she
  // needs it to beat gravity).
  if (game.captureTarget && ship.soi === game.captureTarget && BODIES[game.captureTarget].gm <= 500) physInput.precision = true;
  const aimAngle = aimHeading(game.states);
  // Easy, on a transfer: the ship steers itself (no Space needed) until she
  // touches A or D herself.
  const xferSteer = !!xfer && ['wait', 'point', 'burn', 'fix'].includes(xfer.phase) && input.turn === 0;
  // Not under time warp (lead: "the ship rotates and it's disorienting"):
  // her path turns a full circle in a second or two at x16-x64, and keeping
  // the nose on it spun the ship - and the camera behind it - round and round.
  // She holds her attitude while warping; no burn can happen then anyway.
  const landSteer = landSteerOn() && input.turn === 0;
  aimToggle.update({ applies: !ship.landedOn && (game.mode.autoAim || (game.mode.id === 'medium' && performance.now() - (game.landingAt || 0) < 300)) });
  if ((game.mode.autoAim || landSteer) && !game.manualAim && game.warpIndex === 0 && (input.steady || xferSteer || landSteer) && aimAngle !== null && !ship.landedOn) {
    // Easy mode: hold Space and the ship turns itself to where the step wants
    // it pointed. A damped P-controller on the heading error; the physics'
    // own "steady" damping is switched off so the two don't fight.
    const err = Math.atan2(Math.sin(aimAngle - ship.angle), Math.cos(aimAngle - ship.angle));
    physInput.turn = Math.max(-1, Math.min(1, err * 3 - ship.angVel * 1.4));
    physInput.steady = false;
    // While it's still swinging round, hold the engine: firing sideways wasted
    // most of the fuel in playtest (a landing cost 3 t instead of ~1).
    if (Math.abs(err) > 0.45) physInput.thrust = 0;
  }
  // Easy and Medium landings: the engine only ever BRAKES. Holding W too long
  // used to stop her and then push her back up and forward, away from the
  // ground (lead: "we should not let the spacecraft go in the forward
  // direction"). It cuts out the moment the push would stop opposing her
  // motion (or she's all but stopped); gravity takes over and W works again
  // as soon as there is falling to brake.
  if (physInput.thrust > 0 && (game.mode.id === 'easy' || game.mode.id === 'medium') && !ship.landedOn
    && performance.now() - (game.landingAt || 0) < 300) {
    const b = game.states?.[ship.soi];
    if (b) {
      const vx = ship.vx - b.vx; const vz = ship.vz - b.vz;
      const along = vx * Math.cos(ship.angle) + vz * Math.sin(ship.angle);
      // ...and only down to a comfortable sink speed (60% of the safe limit):
      // braking all the way to a hover left a W-holding child floating for
      // minutes (play-test: 10 u up after 57 s, a quarter of the tank gone).
      const sinkFloor = landingHelp?.limit ? landingHelp.limit * 0.6 : 0.15;
      if (along >= 0 || Math.hypot(vx, vz) < sinkFloor) physInput.thrust = 0;
    }
  }

  // A cued transfer burn: the engine stops itself when the planned speed
  // change is done (see stepWorld's burn computer).
  // Only while the transfer cue is showing this burn: a finished plan left
  // behind when another cue took over cut the engine during the Moon capture.
  // On Hard (no cues) nothing stops the engine: the budget is endless and
  // only MEASURES the push, for the transfer panel's bar.
  if (burnPlan && physInput.thrust > 0 && ship.t - (burnPlan.seenAt ?? -Infinity) < 0.5) {
    // Only Easy and the autopilot get the automatic cut-off. Flying by hand
    // (Medium, Hard) her W always fires: once the planned change was done the
    // engine used to stay dead while the cue was up, so a burn of her own
    // "did nothing" (lead, 2026-10-06). The budget still measures the push.
    const autoStop = cuesOn() && (game.mode.autoAim || !!game.autopilot?.on);
    physInput.burnBudget = { remaining: autoStop ? burnPlan.dvTarget - burnPlan.delivered : Infinity, aim: aimAngle };
  }

  if (!paused) {
    // Safe to warp closer in: a bound orbit round the body she's circling,
    // lowest point over 1.4 radii (her starting orbit is 1.6), and no crash
    // on her dotted path.
    let safeBody = null;
    if (game.warpIndex > 0 && ship.soi !== 'sun' && !ship.landedOn && !game.prediction?.impact) {
      const oeW = orbitElements(ship);
      if (oeW.bound && oeW.periapsis > BODIES[ship.soi].radius * 1.4) safeBody = ship.soi;
    }
    const pathClear = !ship.landedOn && !!game.prediction && !game.prediction.impact;
    const _ts = performance.now();
    const paceDt = realDt * FLIGHT_PACE * (slowMoNow() ? SLOW_MO : 1);
    const res = stepWorld(ship, physInput, paceDt, WARP_LEVELS[game.warpIndex], { warpSafeRadii: WARP_SAFE_RADII * game.mode.warpSafeScale, safeBody, pathClear, target: game.target, autopilot: !!game.autopilot?.on, boost: !!game.warpBoost, cruise: OUTER });
    prof('step', _ts);
    if (burnPlan && physInput.burnBudget && res.dvUsed) burnPlan.delivered += res.dvUsed;
    game.firing = physInput.thrust > 0 && !ship.landedOn; // debug: lab/xferwatch.js
    warpState = res;
    if (!res.warpAllowed && game.warpIndex > 0) {
      game.warpIndex = 0;
      // Say why. The HUD's reason line clears on the very next frame (warp 1
      // is always allowed), so a refused key press used to look like a
      // broken key.
      if (ship.t - (game._warpRefusedAt ?? -Infinity) > 4 && !game.autopilot?.on) {
        game._warpRefusedAt = ship.t;
        const why = game.prediction?.impact
          ? t('Time warp is off: your dotted path hits something. Fix your path first.', 'No fast time now: your path crashes. Fix it first.')
          : t(`Time warp is off: ${res.reason}.`, `No fast time now: ${res.reason}.`);
        hud.toast(why, { kind: 'warn', ms: 3000 });
      }
    }
    handlePhysicsEvents(res.events);
    checkLost();
    rewindClock += realDt;
    saveClock += realDt;
    if (saveClock > 10) { saveClock = 0; missions.save(); }
    // Route for the ending: a point per 2 sim-seconds near bodies, sparser in cruise.
    const prevPt = game.route[game.route.length - 1];
    if (!prevPt || Math.hypot(ship.x - prevPt.x, ship.z - prevPt.z) > (ship.soi === 'sun' ? 60 : 4)) game.route.push({ x: ship.x, z: ship.z });
    if (rewindClock > 0.25) {
      // Never keep a snapshot from inside a body: rewinding to it would crash again.
      const sb = ship.soi !== 'sun' && !ship.landedOn ? BODIES[ship.soi] : null;
      const ss = sb && game.states[ship.soi];
      const embedded = ss && Math.hypot(ship.x - ss.x, ship.z - ss.z) < sb.radius + SHIP.collisionRadius;
      if (!embedded) rewind.push(ship);
      rewindClock = 0;
    }
  }

  const states = allStates(ship.t, game.states);
  // Easy / Medium: the blinking catch zone puts her straight on an orbit.
  catchZone.update(states, ship, realDt, paused);
  _origin.x = ship.x;
  _origin.z = ship.z;

  // Ship visuals.
  shipView.group.rotation.y = yawFor(ship.angle);
  shipView.setThrottle(paused ? 0 : physInput.thrust * (input.precision ? 0.35 : 1));
  shipView.setTurn(paused ? 0 : input.turn);
  shipView.setPrecision(input.precision);
  _sunDir.set(-ship.x, 0, -ship.z).normalize();
  shipView.setSunDirection(_sunDir);
  shipView.update(realDt);

  // Camera BEFORE the visuals: the lens flare, distance glows and atmosphere
  // rims all read the camera, so they must see this frame's position.
  const mouse = controls.takeMouse();
  // The chase camera stays straight behind her (lead, 2026-10-06). It used
  // to swing up to 55% of the way toward a nearby planet, so the view kept
  // turning by itself and left/right turns looked reversed.
  // Leaving Jupiter's or Saturn's system (lead, 2026-10-06): a top-down view
  // of roughly the whole system, so she sees her path climb out past the
  // moons. Back to the view she had once she is out (or the step changes).
  // A moon's zone on the way out still counts as the system (its planet).
  const sysOf = ship.soi !== 'sun' && BODIES[ship.soi] ? (BODIES[ship.soi].parent === 'sun' ? ship.soi : BODIES[ship.soi].parent) : null;
  // Leaving Earth and the Moon (lead 2026-10-07) too: wide enough to show
  // the next goal (Mars) as well, so she sees where she is heading.
  const wideEscape = !!game.escapeStep && (sysOf === 'jupiter' || sysOf === 'saturn' || sysOf === 'earth') && !ship.landedOn && !game.cinematic
    // Still climbing off the Moon: the normal view (the ground is right there).
    && !(ship.soi === 'moon' && Math.hypot(ship.x - states.moon.x, ship.z - states.moon.z) < BODIES.moon.radius * 3);
  if (wideEscape !== escapeView.on) {
    escapeView.on = wideEscape;
    if (wideEscape) {
      escapeView.mode = flightCam.mode;
      flightCam.setMode('top');
      const goal = game.target && game.target !== sysOf && states[game.target];
      const toGoal = goal ? Math.hypot(goal.x - ship.x, goal.z - ship.z) * 1.15 : 0;
      flightCam.setDistance(Math.min(19000, Math.max(BODIES[sysOf].soi * 1.5, toGoal)));
    } else { flightCam.setMode(escapeView.mode || 'chase'); flightCam.resetZoom(); }
  }
  // Time warp: the camera holds its direction (her path and the planet
  // beside her both sweep round once per orbit in a second or two). The
  // autopilot's turns are followed gently. Both ease back afterwards.
  flightCam.update({
    dt: realDt, yaw: shipView.group.rotation.y,
    hold: game.warpIndex > 0, follow: game.autopilot?.on ? 0.9 : 2.4,
    mouse: modalOpen ? { dx: 0, dy: 0, wheel: 0, dragging: false } : mouse,
  });
  // A cinematic (opening / ending) takes the camera over, blending from the
  // flight camera's pose it was just given.
  if (game.cinematic) game.cinematic.apply(realDt, camera, states);

  // Aim arrow (see aimHeading): placed ahead of the ship, flat on the plane.
  const aimA = game.mode.aimArrow && !ship.landedOn && !game.cinematic ? aimHeading(states) : null;
  aimArrow.visible = aimA !== null;
  if (aimA !== null) {
    const r0 = Math.max(0.9, flightCam.distance * 0.45);
    let r = r0;
    aimArrow.rotation.y = yawFor(aimA);
    // Close behind her (landings, the default chase) it sat at the screen
    // edge or right under the lens and filled a corner as a huge green wedge
    // (play-test): pull it in toward her until it is well inside the view,
    // and shrink it with its distance to the camera so it keeps one size.
    camera.updateMatrixWorld();
    for (let k = 0; k < 8; k++) {
      aimArrow.position.set(Math.cos(aimA) * r, 0, Math.sin(aimA) * r);
      _proj.copy(aimArrow.position).project(camera);
      if (_proj.z < 1 && Math.abs(_proj.x) < 0.7 && Math.abs(_proj.y) < 0.7) break;
      r *= 0.8;
    }
    const nearCam = Math.min(1, camera.position.distanceTo(aimArrow.position) / Math.max(1e-6, camera.position.length()));
    aimArrow.scale.setScalar(Math.max(0.12, flightCam.distance * 0.06) * nearCam * Math.sqrt(r / r0));
    aimArrow.material.opacity = 0.55 + 0.3 * Math.sin(performance.now() / 260);
  }

  // Zoomed out, the ship is sub-pixel: an orange arrow keeps her findable.
  shipBeacon.visible = flightCam.distance > 12;
  shipBeacon.scale.setScalar(flightCam.distance * 0.035);
  shipBeacon.rotation.y = shipView.group.rotation.y;

  // Predicted path, a few times a second (it is the expensive bit).
  predictorClock -= realDt;
  if (predictorClock <= 0 && !ship.landedOn) {
    // Around Jupiter heading for one of its moons the transfer can take
    // 700-1000 s: show all of it so she can see the line reach the moon.
    const toMoon = ship.soi === 'jupiter' && BODIES[activeTransferTarget()]?.parent === 'jupiter';
    const horizon = (ship.soi === 'sun' ? 3200 : ship.soi === 'jupiter' ? (toMoon ? 1300 : 700) : 260) * game.mode.pathScale;
    // Under time warp on a plain coast the line is the same orbit, only
    // further along: it is worked out again when she has used 1.5% of it,
    // or after a second (she moved 13-50 s of flight between the old 0.2 s
    // refreshes at x64-x256: 1-4 ms each, spikes of 20+), and at once if
    // anything changed her path (sameCoast: a burn, a rewind, a tow).
    const keep = game.warpIndex > 0 && !(physInput.thrust > 0) && predSnap && predSnap.target === game.target
      && predSnap.horizon === horizon && ship.t - predSnap.t < horizon * 0.015 && ship.t >= predSnap.t
      && performance.now() - predSnap.at < 1000 && sameCoast(predSnap);
    if (!keep) {
      const _tp = performance.now();
      game.prediction = predict(ship, { seconds: horizon, maxPoints: 320, target: game.target });
      prof('predict', _tp);
      trajectory.setPrediction(game.prediction);
      predSnap = { t: ship.t, x: ship.x, z: ship.z, vx: ship.vx, vz: ship.vz, soi: ship.soi, target: game.target, horizon, at: performance.now() };
    }
    // Twice as often while the engine fires, so the line swings smoothly
    // onto the planned one instead of in jumps.
    predictorClock = physInput.thrust > 0 ? 0.1 : 0.2;
  }
  trajectory.setVisible(!ship.landedOn && !game.cinematic?.hidePath);
  trajectory.update({ time: ship.t, origin: _origin, positions: states });

  const _tc = performance.now();
  updateBurnCue(states, physInput.thrust);
  prof('cue', _tc);
  updatePlannedPath();
  plannedView.update({ time: ship.t, origin: _origin, positions: states });
  if (xfer) {
    const want = aimHeading(states);
    xfer.err = want === null ? null : Math.atan2(Math.sin(want - ship.angle), Math.cos(want - ship.angle));
  }
  hud.transfer.update(paused || modalOpen ? null : xfer);
  if (aimHelp) {
    const want = aimHeading(states);
    const sv = ship.soi !== 'sun' && states[ship.soi];
    const mvx = ship.vx - (sv ? sv.vx : 0); const mvz = ship.vz - (sv ? sv.vz : 0);
    aimHelp.err = want === null ? null : Math.atan2(Math.sin(want - ship.angle), Math.cos(want - ship.angle));
    const m = Math.atan2(mvz, mvx);
    aimHelp.motion = want === null || Math.hypot(mvx, mvz) < 0.05 ? null : Math.atan2(Math.sin(want - m), Math.cos(want - m));
    aimHelp.auto = (!!game.mode.autoAim && !game.manualAim) || !!game.autopilot?.on || landSteerOn();
  }
  aimDial.update(paused || modalOpen || xfer ? null : aimHelp);
  const _tb = performance.now();
  bodies.update({ dt: realDt, time: ship.t, positions: states, origin: _origin, camera });
  sky.update({ camera, sunDirection: _sunDir });
  belt.update({ dt: realDt, time: ship.t, origin: _origin, ship: { x: ship.x, z: ship.z }, camera });
  game.beltFx.update(realDt);
  const rel = relativeSpeed(states);
  // Dust is a SENSE of speed, not a speedometer: at a low-orbit 18 u/s the raw
  // number streaked the whole screen. A gentle curve keeps slow flight calm
  // and still lets real speed (and warp) read as fast.
  // A `calm` cutscene's camera floats free of the ship: no speed dust or warp streaks.
  const calm = !!game.cinematic?.calm;
  if (calm) _vel.set(0, 0, 0); else _vel.set(rel.vx, 0, rel.vz).multiplyScalar(0.3);
  dust.update({ dt: realDt, camera, velocity: _vel, warp: calm ? 1 : WARP_LEVELS[game.warpIndex] });

  prof('scene', _tb);
  const _tm = performance.now();
  missions.update(realDt, states, paused);
  prof('missions', _tm);

  // HUD.
  const _th = performance.now();
  const g = gravityInfo(ship);
  const orbit = orbitElements(ship);
  const power = solarPower(ship.x, ship.z, game.solarMultiplier);
  const domRadius = ship.soi === 'sun' ? BODIES.sun.radius : BODIES[ship.soi].radius;
  hud.setFocus(!game.autopilot?.on && performance.now() < (game.focusUntil || 0));
  hud.update({
    speed: rel.speed,
    speedRelativeTo: ship.soi,
    altitude: Math.max(0, g.distance - domRadius),
    fuel: ship.fuel,
    fuelMax: game.fuelCapacity,
    cargo: ship.cargo,
    cargoMax: SHIP.cargoMax,
    power,
    powerNeeded: SOLAR.powerNeededForClaw,
    gravity: g,
    // "x% of the sunlight at Earth" is about the SUNLIGHT, so it ignores how
    // big her panels are; `power` above is what her panels actually make.
    solar: { power, distanceFromSun: realAU(Math.hypot(ship.x, ship.z)), fractionOfEarth: solarPower(ship.x, ship.z, 1) / SOLAR.panelPowerAtEarth },
    // Chapter 5's cruise runs faster than the top button says: show it.
    warp: OUTER && warpState.warp > WARP_LEVELS[game.warpIndex] ? warpState.warp : WARP_LEVELS[game.warpIndex],
    // The warp buttons only when there's a long wait ahead (lead: over 100 s);
    // keys 1-4 work any time.
    warpUseful: game.warpIndex > 0 || waitAhead() > 100,
    warpAllowed: warpState.warpAllowed,
    warpReason: warpState.reason,
    soiBody: ship.soi,
    throttle: physInput.thrust,
    landedOn: ship.landedOn,
    safeLandingSpeed: ship.safeLandingSpeed,
    landingLimit: landingHelp?.limit ?? null,
    landingTooFast: landingHelp?.tooFast ?? null,
    landingHeadsUp: landingHelp?.headsUp ?? null,
    // Only once her path comes down onto the ground: in orbit (a capture,
    // the release cinematic, "brake to start your descent") it read "too
    // fast" at orbit speed. On a capture step only if the landing cue has
    // taken over (she's coming straight down).
    landingGauge: !game.cinematic && orbit.periapsis < domRadius && (!game.captureTarget || !!landingHelp),
    resources: game.resources,
    samples: game.samples,
    // The belt's mined tally (acts/mining.js), null off the belt's steps.
    tally: game.getMiningTally?.() ?? null,
    orbit: { periapsis: orbit.periapsis, apoapsis: orbit.apoapsis, bound: orbit.bound, body: orbit.body },
  });
  hud.map.update({
    time: ship.t,
    bodies: states,
    ship: { x: ship.x, z: ship.z, angle: ship.angle },
    path: game.prediction?.points,
    target: game.target,
    ghost: game.mode.showGhost && game.prediction?.closest && !game.prediction.closest.atEnd ? { x: game.prediction.closest.bodyX, z: game.prediction.closest.bodyZ } : null,
  });
  touch.update({ onFoot: false, cinematic: !!game.cinematic, autoAim: game.mode.autoAim });
  hud.minimap.update({
    time: ship.t,
    bodies: states,
    ship: { x: ship.x, z: ship.z, angle: ship.angle },
    soi: ship.soi,
    path: ship.landedOn ? null : game.prediction?.points,
    times: ship.landedOn ? null : game.prediction?.times,
    target: game.transferTarget && BODIES[game.transferTarget] ? game.transferTarget : game.target,
    hidden: !!game.cinematic,
  });
  prof('hud', _th);
  const _tk = performance.now();
  buildMarkers(states);
  prof('markers', _tk);

  const _tr = performance.now();
  if (render) composer.render();
  prof('render', _tr);
}

/**
 * Debug/test hook: advance `seconds` of real time in `dt` steps without
 * requestAnimationFrame (which a hidden tab never fires), then render once.
 * `input` holds keys down for the whole run, e.g. { KeyW: true }.
 */
/**
 * Debug/test hook: render one real frame at w x h and save it through the dev
 * server's /__shot sink (docs/progress/<name>.png). toDataURL straight after
 * render reads the frame before the browser clears it, so this works in a
 * hidden tab where requestAnimationFrame never fires.
 */
game.debugShot = async (name, w = 1600, h = 900) => {
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  tick(1 / 60);
  const url = renderer.domElement.toDataURL('image/png');
  fit();
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url });
  return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
};

/**
 * Hand the screen to a mini-scene until it finishes. The scene object is
 *   { scene, camera, start(): Promise<any>, tick(dt, input, mouse, modalOpen), dispose?() }
 * start() resolves when the scene is over (she climbs back aboard, the cabin
 * interlude ends, the finale is done); its value is passed back to the caller.
 * The HUD's flight instruments are hidden meanwhile, but its modals, toasts,
 * dialogue and mission card keep working, so a scene can ask questions.
 */
game.runScene = async (sceneObj) => {
  activeScene = sceneObj;
  game.activeScene = sceneObj; // tests reach its debug handle through this
  renderPass.scene = sceneObj.scene;
  renderPass.camera = sceneObj.camera;
  fit();
  document.body.classList.add('in-scene');
  // The flight banner and aim panel don't update on foot: clear them, or the
  // last flight order stays up over the walk.
  setCue(null);
  aimDial.update(null);
  try {
    return await sceneObj.start();
  } finally {
    activeScene = null;
    game.activeScene = null;
    renderPass.scene = scene;
    renderPass.camera = camera;
    document.body.classList.remove('in-scene');
    sceneObj.dispose?.();
    last = performance.now();
    fit();
  }
};
game.renderer = renderer;
// Lost graphics (GPU reset): save and reload instead of a blank screen.
guardContext(renderer, { save: () => missions.save() });
// Real-screen frame check: ?fps or F9 shows it; window.__frames for scripts.
createFrameMonitor({ where: () => `${missions.step?.id || 'start'} x${WARP_LEVELS[game.warpIndex]}${game.cinematic ? ' scene' : ''}` });
/** Test hook: the heading (physics angle) the step's aim hint means right now, or null. */
game.aimAngle = () => aimHeading(game.states);
/** Debug: the transfer cue's internal state (plan, burn in progress, coast). */
game.debugTransfer = () => ({ transferPlan, burnPlan, coastPhase, coastCheck });

game.debugRun = (seconds, dt = 1 / 60) => {
  const n = Math.max(1, Math.round(seconds / dt));
  // Only the last step renders: tests run thousands of steps.
  for (let i = 0; i < n; i++) tick(dt, i === n - 1);
  return { t: ship.t, soi: ship.soi, fuel: ship.fuel, x: ship.x, z: ship.z };
};

// --- boot -------------------------------------------------------------------------

const boot = document.getElementById('boot');
Promise.all([bodies.ready, sky.ready, belt.ready])
  .then(() => {
    boot.classList.add('done');
    // The opening plays on a fresh start only; a returning child goes
    // straight back to where she was.
    const fresh = !missions.hasProgress?.();
    const saved = savedModeId();
    // First time in Chapter 4: ask how much help she wants, BEFORE the
    // opening, so the whole flight is in her chosen mode. Easy is suggested.
    const pickMode = saved && MODES[saved]
      ? Promise.resolve(saved)
      : hud.chooseFlightMode({ modes: MODES, current: 'easy', first: true }).then((id) => id || 'easy');
    pickMode
      .then((id) => applyMode(id, { fresh: fresh && !resumed }))
      .then(() => (fresh ? (IS_CH6 ? null : IS_CH5 ? playCh5Opening(game) : playIntro(game)) : null))
      .then(() => missions.start())
      // Dev only: resume a lab run after a dev-server reload (lab/labrun.js).
      .then(() => { try { const m = import.meta.env.DEV && localStorage.getItem('lab_autorun'); if (m) import(/* @vite-ignore */ `/src/space/lab/${m}.js`).then((x) => x.autorun?.()); } catch { /* no storage */ } });
    last = performance.now();
    requestAnimationFrame(frame);
  })
  .catch((err) => {
    console.error(err);
    boot.querySelector('p').textContent = `Something went wrong loading space: ${err?.message || err}`;
  });
