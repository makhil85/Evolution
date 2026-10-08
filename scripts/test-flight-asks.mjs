// The step engine's question rules (missions.js, acts/util.js, acts/act3.js),
// run headless through Vite's loader with a stub game:
//   - the ready button ("Ready for the next adventure?") shows before a step
//     that leaves a stable orbit (a transfer to another body, or an escape), and
//     not from the Sun, nor when the step after an orbit stays in its system;
//   - questions wait until she has let go of the controls (QUIET_S), including
//     the belt's own beats (acts/util.js askBeat);
//   - questions never overlap: one card at a time, all asked, none lost;
//   - two calm pauses at once both finish (a Ceres visit during a step's pause);
//   - a Ceres flyby counts from a3_power's check too (any order).
//
//   node scripts/test-flight-asks.mjs

// --- DOM and storage stubs (the step engine only touches these) -------------
const docListeners = {};
const bodyChildren = [];
// A canvas stand-in for the satellite's texture (every call a no-op).
const ctxStub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: [] })), set: (t, k, v) => { t[k] = v; return true; } });
const makeEl = (tag = 'div') => {
  const listeners = {};
  return {
    tagName: tag.toUpperCase(), style: {}, className: '', textContent: '', title: '', type: '', children: [],
    getContext: () => ctxStub, width: 0, height: 0,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    fire(type) { (listeners[type] || []).forEach((fn) => fn({ type })); },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, blur() {}, remove() { this.removed = true; }, classList: { add() {}, remove() {}, toggle() {} },
  };
};
globalThis.document = {
  documentElement: { dataset: { chapter: '4' } },
  createElement: (tag) => makeEl(tag),
  body: { appendChild: (el) => { bodyChildren.push(el); return el; } },
  querySelector: () => null,
  addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
};
globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { search: '', href: 'http://x/' }, devicePixelRatio: 1 };
globalThis.location = { search: '', href: 'http://x/', reload() {} };
// The window's keys (readyToLeave listens for Enter on the window).
const keyHandlers = [];
globalThis.addEventListener = (type, fn) => { if (type === 'keydown') keyHandlers.push(fn); };
globalThis.removeEventListener = (type, fn) => { const i = keyHandlers.indexOf(fn); if (i >= 0) keyHandlers.splice(i, 1); };
const pressKey = (code) => keyHandlers.slice().forEach((fn) => fn({ code, repeat: false }));
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createServer } = await import('vite');
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { BODIES } = await vite.ssrLoadModule('/src/space/contracts.js');
const { bodyState } = await vite.ssrLoadModule('/src/space/orbits.js');
const { createMissions } = await vite.ssrLoadModule('/src/space/missions.js');
const { askBeat } = await vite.ssrLoadModule('/src/space/acts/util.js');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const tick = (missions, sec, steer = false, game) => {
  // Advance in 0.1 s slices, as the frame loop does (kidSteering is set by main.js).
  for (let i = 0; i < Math.round(sec / 0.1); i++) { game.kidSteering = steer; missions.tickCalm(0.1, false); }
};
// The stub question takes 5 ms on screen, so a flush waits a little longer than that.
const flush = () => new Promise((r) => setTimeout(r, 25));

/** A stub game: hud records cards and asked questions; the ship sits where the test puts it. */
function makeGame({ soi = 'mars', orbit = true, t = 0 } = {}) {
  const asked = [];
  let active = 0; let maxActive = 0;
  const cards = [];
  const hud = {
    setMission: (m) => cards.push(m),
    announce() {}, toast() {}, showFact: async () => {}, showDialogue: async () => {},
    openUpgrades: async () => null, isModalOpen: () => false,
    askQuestion: async (q) => {
      active++; maxActive = Math.max(maxActive, active);
      asked.push(q.beat || q.id || q.title);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { correct: true };
    },
  };
  const bus = { on: () => () => {}, emit() {}, off() {} };
  const b = BODIES[soi];
  const ship = { x: 0, z: 0, vx: 0, vz: 0, angle: 0, soi, landedOn: null, t, fuel: 100, cargo: 0, _landAngle: 0, _landDist: 0 };
  if (soi !== 'sun' && orbit) {
    const st = bodyState(soi, t, {});
    const r = b.radius * 2.5; const v = Math.sqrt(b.gm / r);
    Object.assign(ship, { x: st.x + r, z: st.z, vx: st.vx, vz: st.vz + v });
  } else if (soi === 'sun') {
    Object.assign(ship, { x: 2e4, z: 0, vx: 0, vz: 1 });
  }
  const game = {
    hud, bus, ship, states: {}, resources: { ice: 0, metal: 0, silicon: 0 }, samples: [],
    mode: { captureScale: 1, autoAim: false, rockMarkers: 'all', showGhost: false, warpSafeScale: 1, pathScale: 1 },
    kidSteering: false, autopilot: { on: false }, target: null, prediction: null, upgradesOwned: new Set(),
    customTargets: {}, activeScene: null, cinematic: null,
    belt: { isInBelt: () => false, nearRocks: [], highlight() {}, mine() { return {}; }, tally() {} },
    shipView: { setClaw() {}, setSolarWings() {}, setLegs() {} }, beltFx: null,
    getMiningTally: () => null,
  };
  return { game, asked, cards, getMax: () => maxActive };
}

/** The ready button, if it is up (readyToLeave appends it to document.body). */
const readyButtons = () => bodyChildren.filter((el) => el.className === 'sp-ready' && !el.removed);

// --- 1. the ready button before departures ---------------------------------
{
  // Mars orbit, then the transfer out to the belt: she is in a stable orbit and the next step leaves.
  const { game } = makeGame({ soi: 'mars' });
  const missions = createMissions(game);
  game.missions = missions;
  missions.jump('a3_power');
  await flush();
  check('ready button shows in a stable Mars orbit before the belt transfer (a3_power)', readyButtons().length === 1, `buttons ${readyButtons().length}`);
  if (readyButtons()[0]) {
    readyButtons()[0].fire('click');
    await flush();
    check('clicking Ready sends her on: the button is removed', readyButtons().length === 0);
    check('clicking Ready shows the next step (a3_power)', missions.step?.id === 'a3_power');
  }
  // Enter goes on too (the same button, from the keyboard).
  missions.jump('a3_power');
  await flush();
  pressKey('Enter');
  await flush();
  check('Enter sends her on from the ready button', readyButtons().length === 0 && missions.step?.id === 'a3_power');
}
{
  // Out in the Sun's space: no ready button, whatever the step.
  const { game } = makeGame({ soi: 'sun' });
  const missions = createMissions(game);
  game.missions = missions;
  missions.jump('a3_power');
  await flush();
  check('no ready button when she is out in the Sun\'s space', readyButtons().length === 0, `buttons ${readyButtons().length}`);
}
{
  // Earth orbit (Chapter 4's first act): the transfer to the Moon leaves that orbit (a1_raise).
  const { game } = makeGame({ soi: 'earth' });
  const missions = createMissions(game);
  game.missions = missions;
  missions.jump('a1_raise');
  await flush();
  check('ready button in Earth orbit before the Moon transfer (a1_raise)', readyButtons().length === 1, `buttons ${readyButtons().length}`);
  readyButtons().forEach((b) => b.fire('click'));
  await flush();
}
{
  // Not a stable orbit (a fast flyby far off): no button, she is not in a closed loop.
  const { game } = makeGame({ soi: 'mars', orbit: false });
  const missions = createMissions(game);
  game.missions = missions;
  game.ship.vz *= 0; game.ship.vx = 0;
  game.ship.x = BODIES.mars.soi * 0.9 + bodyState('mars', 0, {}).x;
  game.ship.z = bodyState('mars', 0, {}).z;
  game.ship.vz = 500; // a fast pass: not bound
  missions.jump('a3_power');
  await flush();
  check('no ready button on an unbound pass (not a stable orbit)', readyButtons().length === 0, `buttons ${readyButtons().length}`);
}

// --- 2. the quiet gate ------------------------------------------------------
{
  const { game, asked } = makeGame({ soi: 'jupiter', orbit: false });
  game.ship.soi = 'sun'; // not the point here: the gate is about steering
  const missions = createMissions(game);
  game.missions = missions;
  game.kidSteering = true;
  let done = false;
  const p = askBeat(game, 'cargoHeavy').then(() => { done = true; });
  tick(missions, 20, true, game); // she is steering the whole time
  await flush();
  check('a belt question waits while she is steering', !done && asked.length === 0, `asked ${asked.length}`);
  tick(missions, 6, false, game); // hands off for 6 s: still inside the wait (QUIET_S 12)
  await flush();
  check('still waiting 6 s after she lets go', !done && asked.length === 0);
  tick(missions, 7, false, game); // 13 s hands off: asked
  await p; await flush();
  check('asked once she has let go for QUIET_S', done && asked.length === 1, `asked ${asked.join(',')}`);
}

// --- 3. questions never overlap ----------------------------------------------
{
  const { game, asked, getMax } = makeGame({ soi: 'sun', orbit: false });
  const missions = createMissions(game);
  game.missions = missions;
  // On foot (no quiet wait): three questions at once, from different callers.
  game.activeScene = {};
  const ps = [askBeat(game, 'cargoHeavy'), missions.ask('ceresScan'), askBeat(game, 'beltFact')];
  for (let i = 0; i < 50; i++) await flush();
  await Promise.all(ps);
  check('three questions at once are all asked, one at a time', asked.length === 3 && getMax() === 1,
    `asked ${asked.length}, most on screen at once ${getMax()}`);
}

// --- 4. two calm pauses at once both finish ----------------------------------
{
  const { game, asked } = makeGame({ soi: 'sun', orbit: false });
  const missions = createMissions(game);
  game.missions = missions;
  game.activeScene = {};
  let a = false; let b = false;
  missions.ask('ceresScan', { calm: 5 }).then(() => { a = true; });
  missions.ask('cargoHeavy', { calm: 2 }).then(() => { b = true; });
  tick(missions, 3, false, game);
  await flush();
  check('the shorter pause finishes first and asks its question', b && !a && asked.includes('cargoHeavy'), `b ${b} a ${a}`);
  tick(missions, 3, false, game);
  await flush();
  check('the longer pause also finishes (the first is never lost)', a && asked.includes('ceresScan'), `asked ${asked.join(',')}`);
}

// --- 5. a Ceres flyby counts from a3_power's check -----------------------------
{
  const { game, asked } = makeGame({ soi: 'sun', orbit: false });
  const missions = createMissions(game);
  game.missions = missions;
  game.states.ceres = { x: 0, z: 0 };
  game.ship.x = 0; game.ship.z = 0; // on top of Ceres
  missions.jump('a3_power');
  await flush();
  missions.update(0.1, game.states, false); // runs a3_power's check: the flyby counts now
  tick(missions, 14, false, game); // the Ceres question waits for hands-off flying (12 s), then comes
  await flush();
  check('Ceres visited on the way to the belt counts (asked the Ceres question)', asked.includes('ceresScan'), `asked ${asked.join(',')}`);
}

vite.close();
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} flight-ask checks passed`);
if (failed) process.exit(1);
