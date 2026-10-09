// The step engine's cards and jumps (the fix round after the integrity check):
//
//   node scripts/test-engine-cards.mjs
//
// 1. A question asked before a jump is never asked after it, and its answer
//    (the after() toast, the reward) is not counted.
// 2. A question waiting for hands-off flying (untilQuiet) gives up on a jump.
// 3. The public ask() with a calm wait gives up on a jump too.
// 4. A jump takes the Ready button down (its button, Enter listener, interval),
//    and the old step does not carry on afterwards.
// 5. The jump puts the cards away (the HUD host card, the Retry card).
// 6. Enter on a card with the keyboard (the Retry card) does not press Ready;
//    T, F and P are ignored while any card is up.
// 7. The Retry card unpauses only when no other card is still up.
// 8. A dialogue whose card was replaced does not close the new card.
// 9. showEnd waits its turn like the other blocking cards.
// 10. A step that throws is logged and the chain goes on.
//
// Runs the real Chapter 4 chain (missions.js, acts/act1.js) headless, with a
// stub DOM and a stub hud. The card modules (retry, overlays, toggles) run as
// they are; their cards are plain stub elements.
import assert from 'node:assert/strict';

// --- DOM and storage stubs ----------------------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

/** Global key listeners (window.addEventListener('keydown') in the modules). */
const keyListeners = [];
globalThis.addEventListener = (type, fn) => { keyListeners.push({ type, fn }); };
globalThis.removeEventListener = (type, fn) => {
  const i = keyListeners.findIndex((l) => l.type === type && l.fn === fn);
  if (i >= 0) keyListeners.splice(i, 1);
};
globalThis.window = globalThis;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = () => {};
globalThis.location = { reload() {}, search: '', href: 'http://x/' };

/** A stub element: enough for the card code (children, classes, listeners). */
function node(tag = 'div') {
  const n = {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', hidden: false,
    style: {}, dataset: {}, children: [], parent: null, isConnected: false, listeners: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { const want = on === undefined ? !this._s.has(c) : !!on; if (want) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); c.parent = this; c.isConnected = true; return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    insertBefore(c) { return this.appendChild(c); },
    replaceChildren() { this.children = []; },
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this);
      this.parent = null; this.isConnected = false;
    },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); },
    setAttribute() {}, getAttribute() { return null; }, focus() {}, blur() {},
    click() { for (const f of this.listeners.click || []) f({ type: 'click' }); },
    querySelector() { return node(); }, querySelectorAll() { return []; },
  };
  return n;
}
const body = node('body');
globalThis.document = {
  documentElement: { dataset: {} }, // no chapter: Chapter 4
  body,
  head: node('head'),
  createElement: (tag) => node(tag),
  // Only body-level cards are looked up (retry card, play layers, the host).
  querySelector: (sel) => body.children.find((n) => matchesSel(n, sel)) || null,
  addEventListener() {},
};
/** The few selector forms the card code uses: `.cls`, `.cls:not([hidden])`. */
function matchesSel(n, sel) {
  return sel.split(',').some((part) => {
    const m = /^\s*\.([\w-]+)(:not\(\[hidden\]\))?\s*$/.exec(part);
    if (!m) return false;
    if (!String(n.className).split(/\s+/).includes(m[1])) return false;
    return !(m[2] && n.hidden);
  });
}
/** A card on the page: `kind` is the class it is given. */
function card(kind, { hidden = false } = {}) {
  const c = node('div');
  c.className = kind;
  c.hidden = hidden;
  body.appendChild(c);
  return c;
}
function dropCards(kind) {
  for (const c of body.children.filter((n) => String(n.className).includes(kind))) c.remove();
}
/** A key press: every keydown listener sees it (capture or not). */
function press(code, extra = {}) {
  const ev = {
    type: 'keydown', code, key: extra.key ?? code, repeat: false, ctrlKey: false, metaKey: false, altKey: false,
    target: null, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra,
  };
  for (const l of [...keyListeners]) if (l.type === 'keydown') l.fn(ev);
}

const { createServer } = await import('vite');
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { createMissions } = await vite.ssrLoadModule('/src/space/missions.js');
const { inModalTurn, resetModalTurns, anyCardOpen } = await vite.ssrLoadModule('/src/space/hud/modalQueue.js');
const { QUIET_S, BODIES } = await vite.ssrLoadModule('/src/space/contracts.js');
const { bodyState } = await vite.ssrLoadModule('/src/space/orbits.js');
const { createRetry } = await vite.ssrLoadModule('/src/space/retry.js');
const { createOverlays } = await vite.ssrLoadModule('/src/space/hud/overlays.js');
const { Hud } = await vite.ssrLoadModule('/src/space/hud/hud.js');
const { createFreezeButton } = await vite.ssrLoadModule('/src/space/freeze.js');
const { createAimToggle } = await vite.ssrLoadModule('/src/space/aimToggle.js');
const { createAutopilot } = await vite.ssrLoadModule('/src/space/autopilot.js');

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, `${name}\n       ${e.message}`]); }
};

// The console: the step engine logs a throw it survives; the walks need a browser.
const realError = console.error;
const logged = [];
console.error = (...a) => { logged.push(a.map(String).join(' ')); };

/**
 * A stub game and hud. Questions go through the real card queue (modalQueue.js),
 * as hud.js does. `hold` leaves every question unanswered until the test answers.
 */
function makeGame({ hold = false } = {}) {
  store.clear(); // each test starts with no save (missions.js resumes from the save it finds)
  const st = { hold, pending: [], asked: [], toasts: [], shown: [], closes: 0, events: [], throwOnce: false };
  const hud = {
    root: null,
    setMission() { if (st.throwOnce) { st.throwOnce = false; throw new Error('stub card failed'); } },
    setMarkers() {}, announce() {},
    toast(m) { st.toasts.push(String(m)); },
    isModalOpen: () => false,
    askQuestion: (q) => inModalTurn(() => {
      st.asked.push(q.beat || q.id);
      if (!st.hold) return { correct: true, attempts: 1 };
      return new Promise((r) => st.pending.push(r));
    }),
    showDialogue: async (lines) => { st.shown.push(lines); },
    showFact: async () => {},
    openUpgrades: async () => null,
    closeCards() { st.closes += 1; },
    map: { isOpen: () => false },
  };
  // The ship in a low circular orbit round Earth: a closed orbit to leave from.
  const e = BODIES.earth;
  const s = bodyState('earth', 0);
  const r = e.radius * 2.2;
  const v = Math.sqrt(e.gm / r);
  const game = {
    hud, st,
    bus: { on() {}, off() {}, emit(name) { st.events.push(name); } },
    scene: { add() {}, remove() {} },
    ship: { x: s.x + r, z: s.z, vx: s.vx, vz: s.vz + v, angle: 0, angVel: 0, soi: 'earth', landedOn: null, t: 0, fuel: 1, cargo: 0 },
    shipView: { setWingsFolded() {}, setThrottle() {}, setLegs() {}, setSolarWings() {}, setClaw() {}, group: { add() {}, remove() {}, visible: true } },
    controls: { setEnabled() {}, isDown: () => false, press() {} },
    resources: {}, stats: {}, samples: [], states: {}, route: [],
    mode: { id: 'medium', captureScale: 1, autoAim: false, rockMarkers: 'all', showGhost: false, warpSafeScale: 1, pathScale: 1 },
    kidSteering: false, autopilot: { on: false }, target: 'moon', prediction: null,
    upgradesOwned: new Set(), customTargets: {}, activeScene: null, cinematic: null,
  };
  return game;
}

// --- 1: the question asked before a jump is dropped; its answer is not counted ---
console.log('engine cards and jumps');
await check('1. a question asked before a jump: its late answer gives no after() toast and no next ask', async () => {
  const game = makeGame({ hold: true });
  const m = createMissions(game);
  m.start();
  await flush(2800);                    // a1_arrive: dialogue, then its 2.6 s wait
  m.tickCalm(QUIET_S + 1, false);       // hands-off time has passed
  m.update(0.016, {}, false);           // a1_arrive has no check: its question is asked now
  await flush(10);
  assert.deepEqual(game.st.asked, ['wingsFolded'], `asked before the jump: ${game.st.asked}`);
  const before = game.st.toasts.length;
  m.jump('a1_orbit');                   // abandoned while its question is open
  await flush(10);
  game.st.pending[0]({ correct: true, attempts: 1 }); // the old answer arrives late
  await flush(20);
  assert.equal(game.st.toasts.length, before, `toasts after the old answer: ${game.st.toasts.slice(before)}`);
  assert.deepEqual(game.st.asked, ['wingsFolded'], 'nothing asked after the jump');
  assert.equal(m.step.id, 'a1_orbit', `step is ${m.step.id}`);
});

// --- 2: a question waiting for quiet gives up on a jump -------------------------
await check('2. a question waiting for hands-off flying is never asked after a jump', async () => {
  const game = makeGame({ hold: false });
  const m = createMissions(game);
  m.jump('a1_float');                   // its enter (the zero-g scene) fails here: logged, the step goes on
  await flush(20);
  m.update(0.016, {}, false);           // a1_float has no check: its question waits for quiet
  await flush(10);
  assert.deepEqual(game.st.asked, [], 'waiting for quiet, nothing asked yet');
  m.jump('a1_orbit');                   // the wait is given up
  await flush(10);
  m.tickCalm(QUIET_S + 1, false);       // quiet arrives later on the new step
  await flush(20);
  assert.deepEqual(game.st.asked, [], `the abandoned question was asked: ${game.st.asked}`);
  assert.equal(m.step.id, 'a1_orbit', `step is ${m.step.id}`);
});

// --- 3: the public ask() with a calm wait gives up on a jump --------------------
await check('3. ask(beat, {calm}) in its calm wait: a jump drops it', async () => {
  const game = makeGame({ hold: false });
  const m = createMissions(game);
  m.jump('a1_float');
  await flush(20);
  m.ask('firstOrbit', { calm: 5 });
  await flush(5);
  m.jump('a1_orbit');
  await flush(10);
  m.tickCalm(QUIET_S + 6, false);       // the calm wait ends, and quiet has come too
  await flush(20);
  assert.deepEqual(game.st.asked, [], `asked after the jump: ${game.st.asked}`);
});

// --- 4: a jump takes the Ready button down; the old step does not carry on -----
await check('4. a jump while Ready waits: its button, Enter listener and wait go; the old step stops', async () => {
  const game = makeGame();
  const m = createMissions(game);
  m.jump('a1_raise');                   // in orbit, and the next step leaves it: Ready waits
  await flush(20);
  const readyUp = () => body.children.some((n) => String(n.className).includes('sp-ready'));
  assert.ok(readyUp(), 'the Ready button is up');
  const keys = () => keyListeners.filter((l) => l.type === 'keydown').length;
  const before = keys();
  m.jump('a1_float');                   // the Ready button is abandoned
  await flush(30);
  assert.ok(!readyUp(), 'the Ready button is gone');
  assert.equal(keys(), before - 1, 'its Enter listener is gone (no other key listener came or went)');
  assert.equal(m.step.id, 'a1_float', `step is ${m.step.id}`);
  assert.equal(game.transferTarget, null, 'the old step (a1_raise, transfer to the Moon) did not set its target after the jump');
});

// --- 5: the jump puts the cards away --------------------------------------------
await check('5. a jump closes the HUD card host and tells the Retry card to go', async () => {
  const game = makeGame();
  const m = createMissions(game);
  const closesBefore = game.st.closes;
  m.jump('a1_float');
  await flush(10);
  assert.equal(game.st.closes, closesBefore + 1, 'hud.closeCards called once');
  assert.ok(game.st.events.includes('cards-reset'), 'the bus says cards-reset');
});

// --- 6: keys wait while any card has the keyboard -------------------------------
await check('6a. Enter on Ready does not press Ready while the Retry card is up; it does once it is gone', async () => {
  const game = makeGame();
  const m = createMissions(game);
  m.jump('a1_raise');
  await flush(20);
  const readyUp = () => body.children.some((n) => String(n.className).includes('sp-ready'));
  const retry = card('sp-retry-card');
  press('Enter');
  await flush(10);
  assert.ok(readyUp(), 'Enter on the Retry card "No" did not press Ready');
  retry.remove();
  press('Enter');
  await flush(30);
  assert.ok(!readyUp(), 'with no card up, Enter presses Ready');
  assert.equal(m.step.id, 'a1_raise', `step is ${m.step.id}`);
});

await check('6b. anyCardOpen sees the host card, the Retry card and a play-mode card, not a hidden host', async () => {
  dropCards('');
  assert.equal(anyCardOpen(), false, 'nothing up');
  const host = card('sp-modal', { hidden: true });
  assert.equal(anyCardOpen(), false, 'a hidden host card is not open');
  host.hidden = false;
  assert.equal(anyCardOpen(), true, 'an open host card');
  host.remove();
  card('sp-retry-card');
  assert.equal(anyCardOpen(), true, 'the Retry card');
  dropCards('sp-retry-card');
  card('pl-back');
  assert.equal(anyCardOpen(), true, 'a play-mode card');
  dropCards('pl-back');
});

await check('6c. T, F and P do nothing while a card is up; they work again after', async () => {
  const game = makeGame();
  game.hud.toast = () => {};
  createFreezeButton(game);
  createAimToggle(game);
  const autopilot = createAutopilot(game, { controls: game.controls, hud: game.hud });
  const retry = card('sp-retry-card');
  press('KeyF'); press('KeyT'); press('KeyP');
  assert.equal(game.frozen, false, 'F ignored under the Retry card');
  assert.equal(game.manualAim, false, 'T ignored under the Retry card');
  assert.equal(autopilot.on, false, 'P ignored under the Retry card');
  retry.remove();
  press('KeyF'); press('KeyT');
  assert.equal(game.frozen, true, 'F works with no card');
  assert.equal(game.manualAim, true, 'T works with no card');
  press('KeyP');
  assert.equal(autopilot.on, true, 'P works with no card');
});

// --- 7: Retry closes without unpausing under another card -----------------------
await check('7. the Retry card does not emit ui-modal false while another card is up', async () => {
  const emitted = [];
  const handlers = {};
  const bus = {
    on(n, f) { (handlers[n] ||= []).push(f); },
    emit(n, v) { emitted.push([n, v]); for (const f of handlers[n] || []) f(v); },
  };
  const game = { hud: { root: null, map: { isOpen: () => false } }, bus, missions: { retryFromCheckpoint() {} } };
  createRetry(game);
  bus.emit('retry-request');            // the Retry card opens
  const host = card('sp-modal');        // a question is up under it
  emitted.length = 0;
  bus.emit('cards-reset');              // the Retry card is put away
  assert.deepEqual(emitted.filter(([n]) => n === 'ui-modal'), [], `emitted: ${JSON.stringify(emitted)}`);
  host.remove();
  bus.emit('retry-request');
  emitted.length = 0;
  bus.emit('cards-reset');
  assert.deepEqual(emitted.filter(([n]) => n === 'ui-modal'), [['ui-modal', false]], 'alone, it unpauses');
});

// --- 8: a replaced dialogue does not close the new card --------------------------
await check('8. a dialogue whose card was replaced: its Enter does not close the new card', async () => {
  const root = node('div');
  const backdrop = {
    listeners: new Set(),
    addEventListener(_t, f) { this.listeners.add(f); },
    removeEventListener(_t, f) { this.listeners.delete(f); },
  };
  let closes = 0;
  const host = {
    backdrop,
    open(build) {
      for (const c of root.children) c.isConnected = false; // the old card's contents go
      root.children = [];
      build(root);
      return root;
    },
    close() { closes += 1; for (const c of root.children) c.isConnected = false; root.children = []; },
    isOpen: () => true,
  };
  const o = createOverlays(host);
  const keyEv = { key: 'Enter', code: 'Enter', preventDefault() {}, stopPropagation() {} };
  const p1 = o.showDialogue([{ who: 'girl', text: 'one' }, { who: 'Mission Control', text: 'two' }]);
  host.open((r) => { r.appendChild(node('div')); }); // a jump puts another card up
  assert.equal(backdrop.listeners.size, 1, 'the old dialogue still listens');
  for (const f of [...backdrop.listeners]) f(keyEv); // Enter on the new card
  assert.equal(closes, 0, 'the new card was not closed');
  assert.equal(backdrop.listeners.size, 0, 'the old dialogue listener is gone');
  // A dialogue of its own still works: Enter goes on and closes it.
  let settled = false;
  const p2 = o.showDialogue([{ who: 'girl', text: 'only line' }]).then(() => { settled = true; });
  for (const f of [...backdrop.listeners]) f(keyEv);
  await p2;
  assert.equal(settled, true, 'the new dialogue resolves');
  assert.equal(closes, 1, 'its own card closes once');
  void p1;
});

// --- 9: showEnd waits its turn; closeCards puts the map away too -----------------
await check('9. showEnd waits behind a card that is up (routed through the queue)', async () => {
  let ran = 0;
  const fakeHud = { _overlays: { showEnd: async () => { ran += 1; return 'again'; } } };
  let release = () => {};
  inModalTurn(() => new Promise((r) => { release = r; })); // a card is up
  Hud.prototype.showEnd.call(fakeHud, { title: 'x' });
  await flush(20);
  assert.equal(ran, 0, 'the end card waits');
  release();
  await flush(20);
  assert.equal(ran, 1, 'the end card runs after the card');
});

await check('9b. hud.closeCards closes the host card and the map', async () => {
  let hostClosed = 0;
  let mapClosed = 0;
  Hud.prototype.closeCards.call({ _modalHost: { close() { hostClosed += 1; } }, map: { isOpen: () => true, close() { mapClosed += 1; } } });
  assert.equal(hostClosed, 1);
  assert.equal(mapClosed, 1);
});

await check('9c. a turn asked before a queue reset never runs, even when the turn ahead settles later', async () => {
  let release = () => {};
  inModalTurn(() => new Promise((r) => { release = r; }));
  let ranOld = false;
  inModalTurn(() => { ranOld = true; });
  resetModalTurns();
  let ranNew = false;
  inModalTurn(() => { ranNew = true; });
  release('x');
  await flush(20);
  assert.equal(ranOld, false, 'the old turn stayed dropped');
  assert.equal(ranNew, true, 'a turn asked after the reset runs at once');
});

// --- 10: a throw in a step is logged and the chain goes on -----------------------
await check('10. a throw while a step starts is logged, and the next step still comes', async () => {
  const game = makeGame();
  game.st.throwOnce = true;              // the first card the step shows fails
  const m = createMissions(game);
  logged.length = 0;
  m.start();
  await flush(20);
  assert.ok(logged.some((l) => l.includes('mission enter') && l.includes('stub card failed')), 'the throw is logged');
  m.tickCalm(QUIET_S + 1, false);
  m.update(0.016, {}, false);            // the chain is not dead: a1_arrive completes
  await flush(60);
  assert.equal(m.step.id, 'a1_float', `step is ${m.step.id}`);
});

console.error = realError;
for (const [ok, name] of results) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed} passed${failed ? `, ${failed} FAILED` : ''}`);
await vite.close();
process.exit(failed ? 1 : 0);
