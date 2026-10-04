// Lab harness for the Chapter 4 HUD — `space-lab/hud.html?view=<name>`.
//
// Renders the real hud.js over a static background at 1600x900 with
// realistic sample data, one view per named scenario, so the HUD can be
// screenshotted and judged without the rest of the game (physics, ship
// rendering, missions) existing yet. Nothing here is imported BY the game —
// this file only imports FROM it (contracts.js, the hud/ module), same
// direction every other lab in this project points.

import { createHud } from '../hud/hud.js';
import { BODIES, BODY_ORDER, UPGRADES } from '../contracts.js';

const VIEWS = ['flight', 'cargo', 'jupiter', 'landing', 'question', 'fact', 'dialogue', 'upgrades', 'map', 'controls', 'end'];

const params = new URLSearchParams(location.search);
const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'flight';
const showChrome = params.get('chrome') === '1';

// --- background --------------------------------------------------------

const bg = document.getElementById('bg');
bg.style.backgroundImage = "url('/docs/progress/space_style_real.png')";

// --- lab chrome (view picker) -------------------------------------------

const bar = document.getElementById('labBar');
if (showChrome) {
  for (const v of VIEWS) {
    const a = document.createElement('a');
    a.textContent = v;
    a.href = `?view=${v}`;
    if (v === view) a.classList.add('is-active');
    bar.appendChild(a);
  }
} else {
  bar.remove();
}

// --- a minimal bus, logging to the console so modal pause/resume is visible ---

const listeners = {};
const bus = {
  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); },
  emit(evt, payload) {
    (listeners[evt] || []).forEach((fn) => fn(payload));
    // eslint-disable-next-line no-console
    console.log('[hud-lab bus]', evt, payload);
  },
};

const hud = createHud({ mount: document.getElementById('hud-root'), bus });
window.__hud = hud; // convenient for poking at from the browser console

// --- shared sample fixtures ----------------------------------------------

/** Position every body at t=0 using its own orbit radius + phase (a static, illustrative layout — not a physics sim). */
function sampleBodyPositions() {
  const pos = {};
  for (const id of BODY_ORDER) {
    const b = BODIES[id];
    const parent = b.parent ? pos[b.parent] : { x: 0, z: 0 };
    const cx = parent ? parent.x : 0;
    const cz = parent ? parent.z : 0;
    pos[id] = { x: cx + b.orbit * Math.cos(b.phase), z: cz + b.orbit * Math.sin(b.phase) };
  }
  return pos;
}

function sampleMission(view2) {
  const missions = {
    flight: { act: 'Act 1 — Earth Orbit', title: 'First Orbit', objective: 'Circularise your orbit, then find the satellite', steps: [
      { text: 'Fold the wings for space', done: true },
      { text: 'Ride out to a stable orbit', done: true },
      { text: 'Find the satellite with the dead panel', done: false },
    ] },
    cargo: { act: 'Act 3 — The Asteroid Belt', title: 'Mining Run', objective: 'Collect one of each asteroid type before heading to Ceres', steps: [
      { text: 'Mine a stony asteroid (silicon)', done: true },
      { text: 'Mine a metal asteroid', done: true },
      { text: 'Mine an icy asteroid', done: false },
      { text: 'Fly to Ceres', done: false },
    ] },
    jupiter: { act: 'Act 4 — Jupiter', title: 'The Big Slingshot', objective: 'Thread the radiation belt and line up the Europa transfer', steps: [
      { text: 'Build the Radiation Shield', done: true },
      { text: 'Enter the gravity-assist corridor', done: false },
      { text: 'Exit toward Europa', done: false },
    ] },
    landing: { act: 'Act 2 — The Moon', title: 'First Landing', objective: 'Touch down gently near the crater rim', steps: [
      { text: 'Match the Moon’s orbit', done: true },
      { text: 'Descend below safe speed', done: false },
      { text: 'Step out and collect a sample', done: false },
    ] },
  };
  return missions[view2] || missions.flight;
}

// --- per-view setup ---------------------------------------------------

function setupFlight() {
  hud.setMission(sampleMission('flight'));
  hud.update({
    speed: 7.42, speedRelativeTo: 'earth', altitude: 62,
    fuel: 5.1, fuelMax: 6, cargo: 0.6, cargoMax: 8,
    power: 100, powerNeeded: 20,
    gravity: { body: 'earth', accel: 1.9, distance: 48 },
    solar: { power: 100, distanceFromSun: 6000, fractionOfEarth: 1.0 },
    warp: 1, warpAllowed: false, warpReason: 'Too close to Earth to warp safely.',
    soiBody: 'earth', throttle: 0.4, landedOn: null,
    resources: { ice: 0, metal: 0, silicon: 0 },
    samples: [],
    orbit: { periapsis: 44, apoapsis: 210, bound: true, body: 'earth' },
  });
  hud.setMarkers([
    { id: 'moon', label: 'Moon', screenX: 1240, screenY: 210, onScreen: true, distance: 4180, kind: 'target' },
    { id: 'satellite', label: 'Dead Satellite', screenX: 1900, screenY: 140, onScreen: false, distance: 860, kind: 'resource' },
  ]);
  hud.toast('Wings folded. RCS thrusters online.', { kind: 'good' });
  setTimeout(() => hud.toast('Orbit looking good — try raising it toward the Moon.', { kind: 'info' }), 300);
}

function setupCargo() {
  hud.setMission(sampleMission('cargo'));
  hud.update({
    speed: 3.1, speedRelativeTo: 'sun', altitude: NaN,
    fuel: 2.4, fuelMax: 6, cargo: 6.5, cargoMax: 8,
    power: 34, powerNeeded: 20,
    gravity: { body: 'sun', accel: 0.09, distance: 12400 },
    solar: { power: 34, distanceFromSun: 12400, fractionOfEarth: 0.234 },
    warp: 4, warpAllowed: true, warpReason: null,
    soiBody: null, throttle: 0.15, landedOn: null,
    resources: { ice: 3, metal: 4, silicon: 2 },
    samples: ['Stony (S-type) asteroid', 'Metal (M-type) asteroid'],
    orbit: { periapsis: 11200, apoapsis: 13600, bound: true, body: 'sun' },
  });
  hud.setMarkers([
    { id: 'ceres', label: 'Ceres', screenX: 420, screenY: 640, onScreen: true, distance: 2100, kind: 'target' },
    { id: 'icyRock', label: 'Icy Asteroid', screenX: 260, screenY: 40, onScreen: false, distance: 340, kind: 'resource' },
    { id: 'metalRock', label: 'Metal Asteroid', screenX: 1500, screenY: 820, onScreen: false, distance: 210, kind: 'resource' },
  ]);
  hud.toast('Cargo hold filling up — handling is getting heavier.', { kind: 'warn' });
}

function setupJupiter() {
  hud.setMission(sampleMission('jupiter'));
  hud.update({
    speed: 24.8, speedRelativeTo: 'jupiter', altitude: 340,
    fuel: 3.8, fuelMax: 6, cargo: 1.2, cargoMax: 8,
    power: 14, powerNeeded: 20,
    gravity: { body: 'jupiter', accel: 1.7, distance: 300 },
    solar: { power: 14, distanceFromSun: 20000, fractionOfEarth: 0.037 },
    warp: 1, warpAllowed: false, warpReason: "Inside Jupiter's radiation zone — warp refused.",
    soiBody: 'jupiter', throttle: 0.9, landedOn: null,
    resources: { ice: 5, metal: 6, silicon: 4 },
    samples: ['Stony (S-type) asteroid', 'Metal (M-type) asteroid', 'Icy asteroid', 'Ceres salt sample'],
    orbit: { periapsis: 250, apoapsis: Infinity, bound: false, body: 'jupiter' },
  });
  hud.setMarkers([
    { id: 'europa', label: 'Europa', screenX: 980, screenY: 470, onScreen: true, distance: 700, kind: 'target' },
    { id: 'io', label: 'Io (hazard)', screenX: 1440, screenY: 110, onScreen: false, distance: 900, kind: 'hazard' },
  ]);
  hud.toast('Radiation Shield holding — keep moving.', { kind: 'warn' });
}

function setupLanding() {
  hud.setMission(sampleMission('landing'));
  hud.update({
    speed: 1.35, speedRelativeTo: 'moon', altitude: 6.4,
    fuel: 4.6, fuelMax: 6, cargo: 0, cargoMax: 8,
    power: 70, powerNeeded: 20,
    gravity: { body: 'moon', accel: 0.9, distance: 11.2 },
    solar: { power: 70, distanceFromSun: 6100, fractionOfEarth: 0.97 },
    warp: 1, warpAllowed: false, warpReason: 'Too close to the Moon to warp safely.',
    soiBody: 'moon', throttle: 0.2, landedOn: null,
    resources: { ice: 0, metal: 0, silicon: 0 },
    samples: [],
    orbit: { periapsis: 8, apoapsis: 16, bound: true, body: 'moon' },
  });
  hud.toast('Easy on the throttle — you are coming in a little hot.', { kind: 'warn' });
}

async function setupQuestion() {
  hud.setMission(sampleMission('flight'));
  hud.update({
    speed: 0, speedRelativeTo: 'earth', altitude: 60, fuel: 5, fuelMax: 6, cargo: 0, cargoMax: 8,
    power: 100, powerNeeded: 20, gravity: { body: 'earth', accel: 1.9, distance: 48 },
    solar: { power: 100, distanceFromSun: 6000, fractionOfEarth: 1 }, warp: 1, warpAllowed: true,
    soiBody: 'earth', throttle: 0, landedOn: null, resources: {}, samples: [],
    orbit: { periapsis: 44, apoapsis: 210, bound: true, body: 'earth' },
  });
  await hud.askQuestion({
    id: 'lab_inverse_square',
    type: 'choice',
    title: 'Satellite Check',
    subject: 'Inverse-square law',
    difficulty: 'Tricky',
    prompt: 'A satellite is twice as far from the Sun as Earth is. Compared to Earth, how much sunlight does it receive?',
    visual: { rows: [
      { label: 'Distance', tiles: ['1×', '2×'], arrow: true },
      { label: 'Sunlight?', tiles: ['100%', '?'] },
    ] },
    choices: [
      { text: 'One quarter (¼) as much', correct: true },
      { text: 'One half (½) as much' },
      { text: 'The same amount' },
      { text: 'Twice as much' },
    ],
    hint: 'Light spreads out over a bigger sphere as it travels. Double the distance spreads it over 4× the area.',
    success: 'Correct! Light follows the inverse-square law: double the distance means one QUARTER the light — exactly why Jupiter needs such big solar wings.',
  });
}

function setupFact() {
  hud.setMission(sampleMission('jupiter'));
  hud.showFact({
    title: 'Jupiter, King of Planets',
    body: 'Jupiter is so big that every other planet in the solar system could fit inside it — more than twice over. Its gravity is so strong that it flings comets out of the solar system and keeps the asteroid belt from ever becoming a planet.',
  });
}

async function setupDialogue() {
  hud.setMission(sampleMission('jupiter'));
  await hud.showDialogue([
    { who: 'girl', text: 'That storm is bigger than Earth... I can see it from here!' },
    { who: 'Mission Control', text: 'That’s the Great Red Spot — a storm that has been raging for centuries.' },
    { who: 'girl', text: 'Okay. Radiation shield up. Let’s thread the needle.' },
  ]);
}

async function setupUpgrades() {
  hud.setMission(sampleMission('cargo'));
  await hud.openUpgrades({
    upgrades: UPGRADES,
    resources: { ice: 3, metal: 5, silicon: 4 },
  });
}

function setupMap() {
  hud.setMission(sampleMission('flight'));
  const bodies = sampleBodyPositions();
  const ship = { x: bodies.earth.x + 120, z: bodies.earth.z + 60 };
  const path = [];
  for (let i = 0; i <= 40; i += 1) {
    const t = i / 40;
    path.push(ship.x + (bodies.mars.x - ship.x) * t, ship.z + (bodies.mars.z - ship.z) * t + Math.sin(t * Math.PI) * 800);
  }
  hud.map.open();
  hud.map.update({
    time: 12345,
    bodies,
    ship,
    path: Float64Array.from(path),
    target: 'mars',
    ghost: { x: bodies.mars.x + 900, z: bodies.mars.z - 400 },
  });
}

function setupControls() {
  hud.setMission(sampleMission('flight'));
  hud.showControls();
}

function setupEnd() {
  hud.showEnd({
    name: 'Maya',
    route: ['Earth', 'Moon', 'Mars', 'Asteroid Belt', 'Jupiter', 'Europa'],
    samples: ['Moon rock', 'Stony asteroid', 'Metal asteroid', 'Icy asteroid', 'Ceres salt', 'Europa ice'],
    stats: { 'Time flown': '54 min', 'Fuel saved by slingshots': '620 u/s', 'Questions solved': '21 / 24' },
    credits: [],
  });
}

const setup = {
  flight: setupFlight,
  cargo: setupCargo,
  jupiter: setupJupiter,
  landing: setupLanding,
  question: setupQuestion,
  fact: setupFact,
  dialogue: setupDialogue,
  upgrades: setupUpgrades,
  map: setupMap,
  controls: setupControls,
  end: setupEnd,
}[view] || setupFlight;

setup();

window.__ready = true;
