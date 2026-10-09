// The step engine's debug jump with a card still up (lead 2026-10-09: after
// missions.jump('c7_star_map') nothing happened for 28 s). The card queue
// (hud/modalQueue.js) is one line: a turn waits for every earlier turn to settle.
// An unanswered card (the flight-mode picker at boot, a question) therefore held
// the new step's dialogue for good. jump() now abandons that queue
// (resetModalTurns) and the old step's flow (a generation counter in missions.js).
//
//   node scripts/test-ch7-jump.mjs
//
// Runs the real Chapter 7 step chain (missions.js, ch7/steps.js) headless, with a
// stub hud whose cards go through the real queue, as hud.js does.
import assert from 'node:assert/strict';

// --- DOM and storage stubs: the step engine touches these only --------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const el = () => ({ style: {}, className: '', classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {}, remove() {}, setAttribute() {} });
globalThis.document = {
  documentElement: { dataset: { chapter: '7' } }, // read at import: Chapter 7's chain
  createElement: el,
  body: { appendChild() {}, classList: { add() {}, remove() {} }, dataset: {} },
  head: { appendChild() {} },
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {},
};
globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { search: '', href: 'http://x/' }, devicePixelRatio: 1, innerWidth: 800, innerHeight: 450 };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { createServer } = await import('vite');
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { createMissions } = await vite.ssrLoadModule('/src/space/missions.js');
const { inModalTurn } = await vite.ssrLoadModule('/src/space/hud/modalQueue.js');

const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, fn) => { try { fn(); results.push([true, name]); } catch (e) { results.push([false, `${name}\n       ${e.message}`]); } };

/** A stub game and hud: dialogue and questions go through the real card queue. */
function makeGame() {
  const shown = [];
  const hud = {
    setMission() {}, announce() {}, toast() {},
    showFact: async () => {}, openUpgrades: async () => null, isModalOpen: () => false,
    // A question she never answers: its turn holds the queue.
    askQuestion: () => inModalTurn(() => new Promise(() => {})),
    showDialogue: (lines) => inModalTurn(async () => { shown.push(lines); await flush(5); }),
    showEnd: async () => {},
  };
  const game = {
    hud, bus: { on: () => () => {}, emit() {}, off() {} },
    scene: { add() {}, remove() {} },
    ship: { x: 9e4, z: 0, vx: 0, vz: 1, angle: 0, soi: 'sun', landedOn: null, t: 0 },
    states: {}, resources: {}, stats: {}, controls: { setEnabled() {} },
    mode: { captureScale: 1, autoAim: false, rockMarkers: 'all', showGhost: false, warpSafeScale: 1, pathScale: 1 },
    kidSteering: false, autopilot: { on: false }, target: null, prediction: null, upgradesOwned: new Set(),
    customTargets: {}, activeScene: null, cinematic: null, samples: [],
    shipView: { group: { add() {}, remove() {}, visible: true }, setClaw() {}, setSolarWings() {}, setLegs() {} },
    belt: { isInBelt: () => false, nearRocks: [], highlight() {}, mine() { return {}; }, tally() {} },
    getMiningTally: () => null, beltFx: null, bodies: { root: { add() {}, remove() {} } },
  };
  return { game, hud, shown };
}

console.log('chapter 7 jump with a card up');
// The step's walk after its dialogue needs a browser (3-D models, a canvas): those
// errors are expected here and are counted, not printed.
const realError = console.error;
let walkErrors = 0;
console.error = () => { walkErrors++; };
{
  const { game, hud, shown } = makeGame();
  const missions = createMissions(game);
  game.missions = missions;
  // The mechanism: a card that never settles holds every card asked after it.
  hud.askQuestion({ beat: 'stuck' });
  await flush();
  // The jump to the bridge star map, with that card still up.
  missions.jump('c7_star_map');
  await flush(80);
  check('jump moves to c7_star_map while an unanswered card is up', () => {
    assert.equal(missions.step?.id, 'c7_star_map', `step is ${missions.step?.id}`);
  });
  check("the new step's dialogue shows after the jump (not queued behind the stuck card)", () => {
    assert.equal(shown.length, 1, `dialogues shown: ${shown.length}`);
    assert.ok(shown[0].length > 0, 'the dialogue has lines');
  });
}
{
  // The rule itself is unchanged: a turn asked without a jump still waits for the one before it.
  const { hud } = makeGame();
  hud.askQuestion({ beat: 'stuck2' });
  let ran = false;
  inModalTurn(() => { ran = true; });
  await flush(30);
  check('without a jump, a turn still waits behind an unanswered card (the rule is kept)', () => {
    assert.equal(ran, false);
  });
}

console.error = realError;
for (const [ok, name] of results) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
console.log(`  (${walkErrors} expected errors from the walk, which needs a browser)`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed} passed${failed ? `, ${failed} FAILED` : ''}`);
await vite.close();
process.exit(failed ? 1 : 0);
