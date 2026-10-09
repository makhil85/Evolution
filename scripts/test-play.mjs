// Node test for the shared play-mode logic (no browser).
//   node scripts/test-play.mjs
// Covers: the mode table, the miner's counting, the treasure-hunt engine
// (order, decoys, persistence, found, reset), and that the DOM-touching modules
// import and no-op safely in node.

import { PLAY_MODES, PLAY_MODE_KEY, describeMode, savedPlayModeId, loadPlayMode, savePlayMode, choosePlayMode, createModeChip } from '../src/play/modes.js';
import { createMiner } from '../src/play/mining.js';
import { createHunt, createKeyBlockMesh } from '../src/play/hunt.js';
import { lockPlayInput, unlockPlayInput, isPlayModalOpen } from '../src/play/ui.js';
import { createNavArrow } from '../src/play/navArrow.js';
import { createHeldKeys, REPEAT_QUIET_MS } from '../src/game/heldKeys.js';
import { readMs, needsClick, READ_MIN_MS } from '../src/play/readTime.js';
import { IDLE_MS, noteInput, whenIdle } from '../src/play/readGate.js';
import { register } from 'node:module';

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); }
}
function eq(actual, expected, name) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`); }
}

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m,
  };
}

// ---------------------------------------------------------------------------
// The mode table
// ---------------------------------------------------------------------------
eq(Object.keys(PLAY_MODES), ['easy', 'medium', 'hard'], 'three modes in order');
for (const m of Object.values(PLAY_MODES)) {
  ok(typeof m.label === 'string' && m.label.length > 0, `${m.id}: label`);
  ok(m.blurb.length > 10 && m.blurbL1.length > 10, `${m.id}: both blurbs`);
  ok(m.blurbL1 !== m.blurb, `${m.id}: Level 1 blurb is different`);
  for (const flag of ['navArrow', 'targetBeacon', 'resourceGlow', 'treasureHunt']) {
    ok(typeof m[flag] === 'boolean', `${m.id}: ${flag} is a boolean`);
  }
  ok(Number.isInteger(m.mineHits) && m.mineHits >= 1, `${m.id}: mineHits is a positive integer`);
  ok(Object.isFrozen(m), `${m.id}: frozen`);
}
eq(Object.values(PLAY_MODES).map((m) => m.mineHits), [1, 3, 5], 'mineHits 1 / 3 / 5');
eq(Object.values(PLAY_MODES).filter((m) => m.treasureHunt).map((m) => m.id), ['hard'], 'only Hard has the treasure hunt');
eq(Object.values(PLAY_MODES).filter((m) => m.navArrow).map((m) => m.id), ['easy'], 'only Easy has the arrow');
eq(Object.values(PLAY_MODES).filter((m) => m.targetBeacon).map((m) => m.id), ['easy', 'medium'], 'Easy and Medium have the beacon');
eq(Object.values(PLAY_MODES).filter((m) => m.resourceGlow).map((m) => m.id), ['easy'], 'only Easy glows resources');
ok(Object.isFrozen(PLAY_MODES), 'table frozen');

// The chooser's "what changes" rows follow the table.
for (const m of Object.values(PLAY_MODES)) {
  const rows = describeMode(m);
  eq(rows.map((r) => r.key), ['arrow', 'marker', 'mining', 'hunt'], `${m.id}: what-changes rows`);
  eq(rows.find((r) => r.key === 'hunt').on, m.treasureHunt, `${m.id}: hunt row matches flag`);
  ok(rows.find((r) => r.key === 'mining').text.includes(String(m.mineHits)), `${m.id}: mining row names the presses`);
}
ok(describeMode(PLAY_MODES.easy).find((r) => r.key === 'mining').text.includes('1 time'), 'Easy says "1 time" (singular)');

// Saved choice: no localStorage in node -> Easy and null, and never throws.
eq(savedPlayModeId(), null, 'no saved mode without storage');
eq(loadPlayMode().id, 'easy', 'default mode is Easy');
savePlayMode('hard'); // must not throw
ok(PLAY_MODE_KEY === 'rocket_village_play_mode', 'storage key is the documented one');
{
  const store = memStore();
  globalThis.localStorage = store;
  eq(savedPlayModeId(), null, 'nothing saved yet');
  savePlayMode('medium');
  eq(savedPlayModeId(), 'medium', 'saved mode is read back');
  eq(loadPlayMode().mineHits, 3, 'loadPlayMode returns the saved mode');
  store.setItem(PLAY_MODE_KEY, 'bogus');
  eq(savedPlayModeId(), null, 'an unknown saved id is ignored');
  eq(loadPlayMode().id, 'easy', 'unknown id falls back to Easy');
  delete globalThis.localStorage;
}
// No DOM in node: the chooser resolves at once instead of throwing.
eq(await choosePlayMode({ level: 1, current: 'medium' }), 'medium', 'chooser resolves the current id without a DOM');

// ---------------------------------------------------------------------------
// The miner
// ---------------------------------------------------------------------------
{
  const mi = createMiner();
  eq(mi.hit('a', 1), { done: true, progress: 1, hits: 1 }, 'Easy: one press finishes');
  eq(mi.progressOf('a'), 0, 'Easy: nothing left over');

  let r = mi.hit('b', 3);
  eq(r, { done: false, progress: 1 / 3, hits: 1 }, 'Medium: first press');
  r = mi.hit('b', 3);
  eq(r, { done: false, progress: 2 / 3, hits: 2 }, 'Medium: second press');
  eq(mi.progressOf('b'), 2, 'progressOf counts presses');
  r = mi.hit('b', 3);
  eq(r, { done: true, progress: 1, hits: 3 }, 'Medium: third press finishes');
  eq(mi.progressOf('b'), 0, 'finished resource is cleared');
  eq(mi.hit('b', 3).hits, 1, 'a mined key starts again from 1');

  // Hard, and independent keys.
  for (let i = 1; i <= 4; i++) eq(mi.hit('c', 5).done, false, `Hard: press ${i} not done`);
  eq(mi.hit('d', 5).hits, 1, 'keys are independent');
  eq(mi.progressOf('c'), 4, 'c is still at 4 while d was mined');
  eq(mi.hit('c', 5), { done: true, progress: 1, hits: 5 }, 'Hard: fifth press finishes');
  eq(mi.progressOf('d'), 1, 'd kept its own count');

  // Reset and numeric keys.
  mi.hit(7, 3); mi.hit(7, 3);
  eq(mi.progressOf(7), 2, 'numeric keys work');
  mi.reset(7);
  eq(mi.progressOf(7), 0, 'reset clears progress');
  eq(mi.hit(7, 3).hits, 1, 'after reset it starts again');
  mi.reset('never-seen');
  ok(true, 'reset of an unknown key is harmless');

  // Odd need values.
  eq(mi.hit('z', 0).done, true, 'need 0 counts as 1');
  eq(mi.hit('y', -4).done, true, 'negative need counts as 1');
  eq(mi.hit('x', 2.9).hits, 1, 'fractional need is floored (2)');
  eq(mi.hit('x', 2.9).done, true, 'floored need 2 finishes on the second press');
  // The ring and the world position are optional and safe without a scene.
  eq(mi.hit('w', 3, { x: 1, y: 0, z: 2 }, { color: 0xff0000 }).hits, 1, 'worldPos and opts are accepted without a scene');
  mi.update(0.016);
  mi.dispose();
  ok(true, 'update and dispose are no-ops without a scene');
}

// ---------------------------------------------------------------------------
// The treasure hunt engine
// ---------------------------------------------------------------------------
const DATA = {
  title: 'The Hidden Golden Core',
  itemName: 'Golden Core',
  intro: 'A Golden Core is hidden in a home.',
  steps: [
    { id: 's1', at: { x: 0, z: 0 }, radius: 2, clue: 'Clue one', found: 'This is place one.' },
    { id: 's2', at: { x: 20, z: 0 }, clue: 'Clue two', found: 'This is place two.' },
    { id: 's3', at: { x: 20, z: 20 }, clue: 'Clue three', found: 'This is place three.' },
    { id: 'home', at: { x: 0, z: 20 }, radius: 1.5, clue: 'Clue home', found: 'The Core is here!' },
  ],
  decoys: [
    { at: { x: -20, z: 0 }, text: 'Not here...' },
    { at: { x: -20, z: 20 }, radius: 4, text: 'Nothing but dust.' },
  ],
};
const mkHunt = (storage, extra = {}) => {
  const log = { clues: [], found: 0 };
  const h = createHunt({
    data: DATA, storageKey: 'test_hunt', storage,
    onClue: (text, index, total) => log.clues.push({ text, index, total }),
    onFound: () => { log.found += 1; },
    ...extra,
  });
  return { h, log };
};

{
  const store = memStore();
  const { h, log } = mkHunt(store);
  eq(h.state, { step: 0, found: false, started: false }, 'fresh hunt state');
  ok(!h.isFound(), 'not found at the start');
  eq(h.current().id, 's1', 'current is the first step');
  eq(log.clues.length, 0, 'nothing shown before start');

  // Stepping before start still counts (she may walk there first) but only the current place.
  eq(h.tryHere({ x: 20, z: 0 }), null, 'a later step does nothing yet');
  eq(h.tryHere({ x: 0, z: 20 }), null, 'the home does nothing early');
  eq(h.state.step, 0, 'still at step 0');

  h.start();
  eq(log.clues.length, 1, 'start shows one clue');
  eq(log.clues[0], { text: 'A Golden Core is hidden in a home.\n\nClue one', index: 0, total: 4 }, 'start shows the intro and the first clue');
  ok(h.state.started, 'started flag set');
  h.start();
  eq(log.clues.length, 1, 'start is once only');

  h.showClue();
  eq(log.clues[1], { text: 'Clue one', index: 0, total: 4 }, 'showClue after start: the clue alone');

  // Radius: 2 at step 0.
  eq(h.tryHere({ x: 2.5, z: 0 }), null, 'just outside the radius does nothing');
  eq(h.state.step, 0, 'no progress outside the radius');
  const r1 = h.tryHere({ x: 1.5, z: 1.0 });
  eq(r1, { kind: 'step', text: 'This is place one.' }, 'step 1 reached');
  eq(h.state.step, 1, 'advanced to step 1');
  eq(log.clues[2], { text: 'This is place one.\n\nClue two', index: 1, total: 4 }, 'next clue shown with the found text');
  eq(h.current().id, 's2', 'current follows');
  eq(h.tryHere({ x: 0, z: 0 }), null, 'the old place does nothing now');

  // Decoys never advance.
  eq(h.tryHere({ x: -20, z: 0 }), { kind: 'decoy', text: 'Not here...' }, 'decoy 1');
  eq(h.tryHere({ x: -18, z: 21 }), { kind: 'decoy', text: 'Nothing but dust.' }, 'decoy 2 with its own radius');
  eq(h.state.step, 1, 'decoys do not advance');
  eq(h.tryHere({ x: 100, z: 100 }), null, 'empty ground is null');
  // Default radius is 3.
  eq(h.tryHere({ x: 22.9, z: 0 }).kind, 'step', 'default radius 3 counts');
  eq(h.state.step, 2, 'advanced to step 2');
  eq(log.found, 0, 'onFound not yet');

  // Persistence: a reload with the same storage keeps her place.
  {
    const { h: again } = mkHunt(store);
    eq(again.state, { step: 2, found: false, started: true }, 'reload keeps the step');
    eq(again.current().id, 's3', 'reload current step');
    // The step-3 clue does not repeat the intro.
    const log2 = [];
    const h2 = createHunt({ data: DATA, storageKey: 'test_hunt', storage: store, onClue: (t) => log2.push(t) });
    h2.start();
    eq(log2.length, 0, 'start on a started hunt shows nothing');
    h2.showClue();
    eq(log2, ['Clue three'], 'a reload re-reads the current clue only');
  }

  eq(h.tryHere({ x: 20, z: 20 }).kind, 'step', 'step 3 reached');
  eq(h.state.step, 3, 'now on the home');
  ok(!h.isFound(), 'not found before the home');
  eq(log.found, 0, 'onFound waits for the last step');
  const home = h.tryHere({ x: 0, z: 19 });
  eq(home, { kind: 'found', text: 'The Core is here!' }, 'found at the home');
  ok(h.isFound(), 'isFound');
  eq(log.found, 1, 'onFound called once');
  eq(h.current(), null, 'no current step once found');
  eq(h.tryHere({ x: 0, z: 20 }), null, 'nothing after found');
  eq(log.found, 1, 'onFound is not repeated');
  const before = log.clues.length;
  h.showClue();
  eq(log.clues.length, before, 'showClue does nothing once found');
  eq(JSON.parse(store.getItem('test_hunt')), { step: 4, found: true, started: true }, 'found state saved');

  // Reload after found stays found.
  const { h: done } = mkHunt(store);
  ok(done.isFound(), 'found survives a reload');
  eq(done.tryHere({ x: 0, z: 20 }), null, 'a found hunt ignores E');

  // Reset.
  h.reset();
  eq(h.state, { step: 0, found: false, started: false }, 'reset clears the state');
  eq(JSON.parse(store.getItem('test_hunt')), { step: 0, found: false, started: false }, 'reset is saved');
  eq(h.current().id, 's1', 'reset: back to the first step');
  eq(h.tryHere({ x: 0, z: 20 }), null, 'reset: the home does not count');
}

// Steps must be reached in order even if she stands on a later place first.
{
  const { h } = mkHunt(memStore());
  h.start();
  eq(h.tryHere({ x: 0, z: 20 }), null, 'the home first: nothing');
  h.tryHere({ x: 0, z: 0 }); h.tryHere({ x: 20, z: 0 }); h.tryHere({ x: 20, z: 20 });
  eq(h.tryHere({ x: 0, z: 20 }).kind, 'found', 'in order it works');
}

// Storage that throws, missing storage, and corrupt saves.
{
  const bad = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  const { h } = mkHunt(bad);
  eq(h.state.step, 0, 'a throwing storage falls back to a fresh hunt');
  eq(h.tryHere({ x: 0, z: 0 }).kind, 'step', 'a throwing storage does not break play');
  const junk = memStore();
  junk.setItem('test_hunt', '{not json');
  eq(mkHunt(junk).h.state.step, 0, 'a corrupt save falls back to a fresh hunt');
  const old = memStore();
  old.setItem('test_hunt', JSON.stringify({ step: 1 }));
  eq(mkHunt(old).h.state, { step: 1, found: false, started: false }, 'a save missing fields gets defaults');
  const { h: none } = mkHunt(undefined);
  eq(none.tryHere({ x: 0, z: 0 }).kind, 'step', 'no storage at all still works');
}

// Extra API: setActive / dispose / showFoundCard are safe in node.
{
  const { h } = mkHunt(memStore());
  h.setActive(false);
  h.showClue();
  h.showFoundCard();
  h.dispose();
  ok(true, 'setActive, showFoundCard and dispose are no-ops without a DOM');
  eq(typeof createKeyBlockMesh, 'function', 'createKeyBlockMesh is exported');
  eq(typeof createNavArrow, 'function', 'createNavArrow is exported');
}

// The key block is about 0.8 tall and sits on the ground.
{
  const g = createKeyBlockMesh();
  const box = { min: Infinity, max: -Infinity };
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      box.min = Math.min(box.min, b.min.y);
      box.max = Math.max(box.max, b.max.y);
    }
  });
  ok(Math.abs(box.min) < 0.001, 'key block stands on y = 0');
  ok(box.max > 0.7 && box.max < 0.9, `key block is about 0.8 tall (${box.max.toFixed(2)})`);
  ok(g.isGroup, 'key block is a THREE.Group');
}

// The input lock nests and is a no-op without a DOM.
lockPlayInput(); unlockPlayInput();
ok(!isPlayModalOpen(), 'input lock is a no-op in node');

// Held keys: a lost keyup costs a moment, not a walk across the map.
{
  const listeners = {};
  const prevAdd = globalThis.addEventListener; const prevRemove = globalThis.removeEventListener; const prevDoc = globalThis.document;
  globalThis.addEventListener = (t, f) => { listeners[t] = f; };
  globalThis.removeEventListener = () => {};
  globalThis.document = { hidden: false, addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: () => {} };
  let now = 0;
  const k = createHeldKeys({ now: () => now });
  k.add('ArrowUp');
  now = 5000;
  ok(k.has('ArrowUp'), 'held key without auto-repeat stays held (touch buttons, a fresh press)');
  for (let t = 5000; t <= 6000; t += 33) { now = t; k.add('ArrowUp', true); }
  ok(k.has('ArrowUp'), 'auto-repeating key is held');
  now += REPEAT_QUIET_MS + 50;
  ok(!k.has('ArrowUp'), 'repeats gone quiet: the key counts as released (lost keyup)');
  // Hold Up, tap Right: Up stops repeating but is still held.
  k.add('ArrowUp'); for (let i = 0; i < 5; i++) { now += 33; k.add('ArrowUp', true); }
  k.add('ArrowRight'); for (let i = 0; i < 5; i++) { now += 33; k.add('ArrowRight', true); }
  k.delete('ArrowRight'); now += 2000;
  ok(k.has('ArrowUp'), 'an older held key is not dropped when another key took the repeats');
  listeners.blur();
  ok(!k.has('ArrowUp') && k.size === 0, 'blur lets go of every key');
  k.add('KeyW'); globalThis.document.hidden = true; listeners.visibilitychange();
  ok(!k.has('KeyW'), 'a hidden tab lets go of every key');
  k.dispose();
  globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; globalThis.document = prevDoc;
}

// Normal holds keep walking; a short tap is let go on keyup.
{
  const prevAdd = globalThis.addEventListener; const prevRemove = globalThis.removeEventListener; const prevDoc = globalThis.document;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.document = { hidden: false, addEventListener: () => {}, removeEventListener: () => {} };
  let now = 0;
  const k = createHeldKeys({ now: () => now });
  const repeatFor = (code, ms) => { for (let t = 0; t < ms; t += 33) { now += 33; k.add(code, true); } };
  k.add('ArrowRight');
  repeatFor('ArrowRight', 3000);
  ok(k.has('ArrowRight'), 'one key held with repeats keeps walking for seconds');
  k.delete('ArrowRight');
  ok(!k.has('ArrowRight'), 'the held key is released on its keyup');
  k.add('KeyD'); now += 80;
  ok(k.has('KeyD'), 'a short tap is held until its keyup');
  k.delete('KeyD');
  ok(!k.has('KeyD') && k.size === 0, 'a short tap is released on keyup');
  // Two keys: Left held and repeating, then Up pressed and repeating too; both stay.
  k.add('ArrowLeft'); repeatFor('ArrowLeft', 1000);
  k.add('ArrowUp'); repeatFor('ArrowUp', 1000);
  ok(k.has('ArrowLeft') && k.has('ArrowUp'), 'two keys held with repeats both stay');
  k.delete('ArrowUp'); k.delete('ArrowLeft');
  ok(k.size === 0, 'both keys released on their keyups');
  // Held through a blur: clear() dropped it, then its repeats come back. It
  // walks again, and if its keyup is lost it still stops once the repeats go quiet.
  k.clear(); repeatFor('KeyW', 300);
  ok(k.has('KeyW'), 'a key still repeating after a blur walks again');
  now += 2000;
  ok(!k.has('KeyW'), 'and stops when its repeats go quiet (keyup lost)');
  k.dispose();
  globalThis.addEventListener = prevAdd; globalThis.removeEventListener = prevRemove; globalThis.document = prevDoc;
}

// ---------------------------------------------------------------------------
// The HUD's messages (src/game/hud.js), on a small fake DOM and a fake clock.
// Each message stays up readMs(text), or until she clicks it; a long one (needsClick)
// is an OK card that stays until she clicks it. Neither locks her walk (lead
// 2026-10-09). Messages wait in line; and the HUD builds no key legend at startup.
// ---------------------------------------------------------------------------
{
  const realPerf = globalThis.performance;
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const realAdd = globalThis.addEventListener, realRemove = globalThis.removeEventListener;
  const realDoc = globalThis.document, realWin = globalThis.window;
  const realStore = globalThis.localStorage, realRaf = globalThis.requestAnimationFrame, realLoc = globalThis.location;

  // hud.js imports its stylesheet: node gets an empty module for any .css file.
  register('data:text/javascript,' + encodeURIComponent("export async function load(url, context, nextLoad) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true }; return nextLoad(url, context); }"));

  // A fake clock: setTimeout queues, advance(ms) runs what is due in order.
  let clock = 0;
  const timers = new Map();
  let nextTimer = 1;
  globalThis.performance = { now: () => clock };
  globalThis.setTimeout = (fn, ms = 0) => { const id = nextTimer; nextTimer += 1; timers.set(id, { at: clock + Math.max(0, Number(ms) || 0), fn }); return id; };
  globalThis.clearTimeout = (id) => { timers.delete(id); };
  const advance = (ms) => {
    const end = clock + ms;
    for (;;) {
      let due = null;
      for (const [id, t] of timers) if (t.at <= end && (!due || t.at < due.t.at || (t.at === due.t.at && id < due.id))) due = { id, t };
      if (!due) break;
      clock = due.t.at;
      timers.delete(due.id);
      due.t.fn();
    }
    clock = end;
  };

  // Window listeners (keys), kept in a list so a test can press a key.
  const winListeners = [];
  globalThis.addEventListener = (type, fn) => { winListeners.push({ type, fn }); };
  globalThis.removeEventListener = (type, fn) => {
    const i = winListeners.findIndex((l) => l.type === type && l.fn === fn);
    if (i >= 0) winListeners.splice(i, 1);
  };
  const pressKey = (key, repeat = false) => {
    for (const l of [...winListeners]) {
      if (l.type === 'keydown') l.fn({ key, code: key === ' ' ? 'Space' : key, repeat, target: globalThis.document.body, preventDefault() {}, stopPropagation() {} });
    }
  };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
  globalThis.location = { search: '', origin: 'http://test' };
  globalThis.localStorage = memStore();
  globalThis.window = globalThis;

  // The few DOM calls the HUD makes: elements with classes, text, children,
  // listeners, and a class-or-tag querySelector.
  class FakeNode {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attrs = {};
      this.classes = new Set();
      this.style = {};
      this.dataset = {};
      this.listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.value = '';
      this.offsetWidth = 0;
      this._text = '';
      const node = this;
      this.classList = {
        add: (...c) => c.forEach((x) => node.classes.add(x)),
        remove: (...c) => c.forEach((x) => node.classes.delete(x)),
        toggle: (c, on) => { const want = on === undefined ? !node.classes.has(c) : !!on; if (want) node.classes.add(c); else node.classes.delete(c); return want; },
        contains: (c) => node.classes.has(c),
      };
    }
    get parentElement() { return this.parentNode; }
    get className() { return [...this.classes].join(' '); }
    set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(v) {
      for (const c of this.children) c.parentNode = null;
      this.children = [];
      this._text = String(v);
    }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    append(...cs) { for (const c of cs) this.appendChild(c); }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
    dispatch(type, ev = {}) { for (const fn of [...(this.listeners[type] || [])]) fn({ preventDefault() {}, stopPropagation() {}, ...ev }); }
    focus() {}
    select() {}
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (sel.startsWith('.') ? c.classes.has(sel.slice(1)) : c.tagName === sel.toUpperCase()) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  const body = new FakeNode('body');
  globalThis.document = { body, head: new FakeNode('head'), createElement: (t) => new FakeNode(t), getElementById: () => null, addEventListener() {}, removeEventListener() {} };

  const { Hud } = await import('../src/game/hud.js');

  // The two Level texts: Level 1 short and Level 4 longer, both under 10 s.
  const L1 = 'Walk closer to something to use it.';
  const L4 = 'Move closer to a resource, board, lab, locked room, or foundation.';
  // A message far too long to read in 10 s: it becomes the OK card.
  const LONG = 'The Golden Core is in one of the homes in this village. Read each clue carefully, walk to each place, and stand at its front door. When you are sure, press the button and check it. Searching a wrong home costs nothing at all, so take your time and try again.';
  const settle = () => advance(12000);   // every toast and gap is gone after this

  const hud = new Hud({ mount: body, title: 'Test chapter' });
  advance(600);   // the onboard cue's start delay

  // --- no controls legend at startup -------------------------------------
  const startText = hud.root.textContent;
  ok(!/WASD|Arrow|Shift|Space|handstand|\(M\)|Press /i.test(startText), 'no controls legend in the HUD at startup');
  ok(!/WASD|Arrow keys/.test(body.textContent), 'no WASD or arrow-key text anywhere on the page');

  // --- readMs: both Levels stay up for readMs(text) ------------------------
  for (const [label, text] of [['Level 1', L1], ['Level 4', L4]]) {
    settle();
    ok(readMs(text) >= 5000 && readMs(text) <= 10000, `${label}: readMs is 5-10 s`);
    ok(!needsClick(text), `${label}: a short line is a toast, not a card`);
    hud.toast(text, 'info');
    ok(hud._toasts.length === 1 && hud._toasts[0].message === text, `${label}: the toast is on screen`);
    advance(readMs(text) - 1);
    ok(hud._toasts.length === 1, `${label}: still up just before readMs (${readMs(text)} ms)`);
    advance(1);
    ok(hud._toasts.length === 0, `${label}: gone at readMs`);
  }

  // --- the goal line is a toast too ----------------------------------------
  settle();
  hud.setProgress(30, '30% — Walk to the Science Center');
  settle();
  hud.setProgress(40, '40% — Build the rocket');
  ok(hud._toasts.length === 1 && hud._toasts[0].message === 'Next goal: Build the rocket', 'the next goal shows as a toast');
  advance(readMs('Next goal: Build the rocket') - 1);
  ok(hud._toasts.length === 1, 'the goal line stays up its readMs');
  advance(1);
  ok(hud._toasts.length === 0, 'and then goes');

  // --- toasts queue, never overwrite each other early ------------------------
  settle();
  hud.toast('Alpha one.', 'info');
  hud.toast('Beta two.', 'info');
  hud.toast('Gamma three.', 'info');
  advance(1600);
  ok(hud._toasts.map((e) => e.message).join('|') === 'Alpha one.|Beta two.', 'two toasts on screen, the third waits in line');
  ok(hud._toastQueue.length === 1 && hud._toastQueue[0].message === 'Gamma three.', 'the third is queued');
  advance(readMs('Alpha one.') - 1600 - 1);
  ok(hud._toasts.some((e) => e.message === 'Alpha one.'), 'the first is not pushed off before its readMs');
  advance(2);
  ok(hud._toasts.map((e) => e.message).join('|') === 'Beta two.|Gamma three.', 'when the first goes, the next in line comes up');

  // --- a long message is an OK card that stays until she clicks it ---------------
  // It does not lock her walk (lead 2026-10-09): keys never close it. OK, or a click
  // on the card, works only once the wait is over: she has to read it first.
  const CARD = () => hud._readBackdrop.querySelector('.rv-modal__card');
  settle();
  ok(needsClick(LONG) && readMs(LONG) === 10000, 'a long line needs a click');
  hud.toast(LONG, 'info');
  ok(hud._read !== null && hud._read.message === LONG, 'a long message opens the read card');
  ok(!hud._readBackdrop.hidden && hud._readText.textContent === LONG, 'the card shows the whole text');
  ok(hud.isReadPaused(), 'the game clocks pause under the card');
  ok(body.dataset.playModal === undefined && !isPlayModalOpen(), 'the card does not lock her walk');
  ok(!body.classList.contains('rv-question-open'), 'the Clue button and the Help chip stay (no focus mode)');
  ok(hud._toasts.length === 0, 'the long message is not a toast');
  ok(hud._readOk.disabled === true, 'OK is dimmed until the wait is over');
  hud.toast('Waits behind the card.', 'info');
  advance(3000);
  ok(hud._toasts.length === 0, 'nothing comes up while the card is open');
  CARD().dispatch('click');
  ok(hud._read !== null, 'a click does nothing before the wait is over');
  advance(READ_MIN_MS - 3000);
  ok(hud._readOk.disabled === false, 'OK works once the wait is over');
  CARD().dispatch('click');
  ok(hud._read === null && hud._readBackdrop.hidden, 'a click on the card closes it');
  ok(!hud.isReadPaused(), 'the game clocks run again');
  advance(1600);
  ok(hud._toasts.length === 1 && hud._toasts[0].message === 'Waits behind the card.', 'the waiting message comes up after the card');

  // Keys leave the card up: she walks, jumps and presses E while it shows.
  settle();
  hud.toast(`${LONG} Keys do not close it.`, 'info');
  ok(hud._read !== null, 'a second long message opens the card');
  advance(READ_MIN_MS);
  pressKey('Enter');
  pressKey(' ');
  pressKey('ArrowUp', true);
  ok(hud._read !== null && body.dataset.playModal === undefined, 'Enter, Space and arrows leave the card up, and she is not locked');
  CARD().dispatch('click');
  ok(hud._read === null, 'a click closes it');
  settle();

  // A tap on a short message clears it (lead 2026-10-09: "until she clicks it").
  hud.toast(L4, 'info');
  ok(hud._toasts.length === 1, 'a message is on screen');
  hud._toasts[0].node.dispatch('click');
  ok(hud._toasts.length === 0, 'a click clears the message');
  settle();

  // A long message waits its turn behind a short one on screen (no overlap).
  hud.toast('A short one first.', 'good');
  advance(100);
  hud.toast(`${LONG} After the short one.`, 'info');
  ok(hud._read === null, 'the card waits while a toast is on screen');
  advance(readMs('A short one first.'));
  ok(hud._read !== null, 'and opens once the screen is clear');
  advance(READ_MIN_MS);
  CARD().dispatch('click');
  ok(hud._read === null, 'a click closes it once the wait is over');

  // --- pickup lines: merge while they wait, messages that matter go first ----------
  settle();
  hud.toast('Full screen one.', 'info');
  advance(1600);
  hud.toast('Full screen two.', 'info');   // both slots taken
  hud.toast('+1 wood', 'good');
  hud.toast('+1 wood', 'good');             // a second wood merges into the waiting line
  hud.toast('+2 stone', 'good');
  hud.toast('Guidance Crystal found! The rocket can launch now.', 'good');
  eq(hud._toastQueue.map((q) => q.message), ['+2 wood', '+2 stone', 'Guidance Crystal found! The rocket can launch now.'],
    'two wood pickups wait as one line, and the crystal waits in line');
  advance(readMs('Full screen one.') - 1600);   // the first toast leaves
  ok(hud._toasts.some((e) => e.message.startsWith('Guidance Crystal')), 'the crystal goes ahead of the pickup lines');
  ok(hud._toastQueue.map((q) => q.message).join('|') === '+2 wood|+2 stone', 'the pickup lines keep waiting behind it');
  settle();
  ok(hud._toastQueue.length === 0 && hud._toasts.length === 0, 'the pickup lines show in the end, nothing is stuck');

  // A message that is not a pickup is never dropped for age while it waits.
  hud.toast('Hold one.', 'info');
  advance(1600);
  hud.toast('Hold two.', 'info');
  hud.toast('Keep this one for later.', 'info');
  hud._toastQueue[0].at -= 60000;
  advance(1600);
  ok(hud._toastQueue.some((q) => q.message === 'Keep this one for later.'), 'an old non-pickup message is still waiting, not dropped');
  advance(READ_MIN_MS * 2);
  ok(hud._toasts.some((e) => e.message === 'Keep this one for later.') || hud._toastQueue.length === 0, 'and it comes up once there is room');
  settle();

  // A pickup line that waited 20 s is dropped (it is no longer about what she is doing).
  hud.toast('Hold three.', 'info');
  advance(1600);
  hud.toast('Hold four.', 'info');
  hud.toast('+1 iron', 'good');
  hud._toastQueue[0].at -= 60000;
  advance(READ_MIN_MS);
  ok(!hud._toasts.some((e) => e.message === '+1 iron') && !hud._toastQueue.some((q) => q.message === '+1 iron'), 'an old pickup line is dropped');
  settle();

  // --- the read gate (lead 2026-10-09): statuses at once, lines to read wait -------
  // Her input is a key press (pressKey). A short status shows while she steers and
  // never pauses. A line to read waits for IDLE_MS with no input, then it stays up for
  // readMs, and it lets go by itself. She walks the whole time (no lock).
  {
    settle();
    const GUIDE = 'Move closer to a resource, board, lab, locked room, or foundation.';
    const UNFOLD_MS = 3000; // the mission card opens again after this long with no input (hud.js)

    pressKey('ArrowUp', true); advance(100);
    hud.toast('+3 wood', 'good');
    ok(hud._toasts.some((e) => e.message === '+3 wood'), 'a short status shows at once while she steers');
    ok(!hud.isReadPaused(), 'a short status does not pause the game');
    settle();

    for (let i = 0; i < 6; i += 1) { pressKey('ArrowUp', true); advance(500); }   // 3 s of steering
    hud.toast(GUIDE, 'info');
    ok(hud._toasts.length === 0 && hud._toastQueue.length === 1, 'a line to read waits while she steers');
    ok(!hud.isReadPaused(), 'nothing is paused while the line waits');
    advance(1000);   // 1.5 s since her last key
    ok(hud._toasts.length === 0, 'it still waits: she has had no input for under 2 s');
    advance(IDLE_MS);
    ok(hud._toasts.length === 1 && hud._toasts[0].message === GUIDE, 'it shows once she has had 2 s with no input');
    ok(hud.isReadPaused() && !isPlayModalOpen() && body.dataset.playModal === undefined, 'the line is up and she is not locked');
    const shownAt = hud._toasts[0].shownAt;
    pressKey('ArrowUp'); advance(100);   // she presses keys during the pause
    ok(hud.isReadPaused() && hud._toasts.length === 1, 'pressing keys does not end the line');
    advance(readMs(GUIDE) - 1 - (clock - shownAt));
    ok(hud.isReadPaused() && hud._toasts.length === 1, 'the line stays up just before readMs');
    advance(1);
    ok(!hud.isReadPaused() && hud._toasts.length === 0, 'the line goes by itself after readMs, and the clocks run again');
    settle();

    // The next goal is a line to read even when it is short: it waits while she steers.
    pressKey('ArrowUp', true); advance(300);
    hud.setProgress(55, '55% — Go to the forge');
    ok(!hud._toasts.some((e) => e.message === 'Next goal: Go to the forge'), 'the next goal waits while she steers');
    advance(IDLE_MS + 300);
    ok(hud._toasts.some((e) => e.message === 'Next goal: Go to the forge'), 'the next goal shows once she stops');
    settle();

    // The mission card folds on her first input, and opens again only after 3 s with none.
    // Each state holds at least 1 s, so the card never flickers at the edge of a pause.
    const card = hud._missionCard;
    const folded = () => card.classList.contains('is-collapsed');
    advance(1000);
    ok(!folded(), 'the mission card is open while she stands still');
    pressKey('ArrowLeft', true); advance(300);
    ok(folded() && card.classList.contains('is-moving'), 'it folds to its title line on her first input');
    advance(UNFOLD_MS + 300);
    ok(!folded() && !card.classList.contains('is-moving'), 'it opens again after 3 s with no input');

    // Her own choice still rules: a card she folded stays folded, and a click shows it even while she walks.
    advance(1000);
    hud._missionToggle.dispatch('click');
    ok(folded() && globalThis.localStorage.getItem('rocket_village_mission_open') === '0', 'she can fold the card, and it is remembered');
    pressKey('ArrowLeft', true); advance(300); advance(UNFOLD_MS + 300);
    ok(folded(), 'a card she folded stays folded when she stops');
    pressKey('ArrowLeft', true); advance(300);
    hud._missionToggle.dispatch('click');
    ok(!folded(), 'a click shows the card while she walks');
    pressKey('ArrowLeft', true); advance(300);
    ok(!folded(), 'and it stays shown while she keeps walking');
    advance(UNFOLD_MS + 300);
    ok(!folded(), 'it stays open once she has stopped');
    advance(1000);
    pressKey('ArrowLeft', true); advance(300);
    ok(folded(), 'the next walk folds it again');
    advance(UNFOLD_MS + 300);
    pressKey('KeyM'); advance(50);
    ok(folded() && globalThis.localStorage.getItem('rocket_village_mission_open') === '0', 'M folds the card, and it is remembered');
    advance(1000);
    pressKey('KeyM'); advance(UNFOLD_MS + 300);
    ok(!folded() && globalThis.localStorage.getItem('rocket_village_mission_open') === '1', 'M opens it again');

    // A click is input too: the card it opens does not fold under that click.
    advance(1000);
    hud._missionToggle.dispatch('click');   // closes it
    advance(1000);
    noteInput();
    hud._missionToggle.dispatch('click'); advance(300);
    ok(!folded(), 'a click opens the card and it stays open under its own input');
    advance(UNFOLD_MS + 300);
    ok(!folded(), 'and it stays open once she is idle again');

    // Flicker: 21 s of taps with 2.5 s stops between bursts changes the card's state at most twice.
    settle();
    let flips = 0;
    let lastFolded = folded();
    for (let t = 0; t < 21000; t += 100) {
      if (t % 5000 < 3000 && t % 500 === 0) pressKey('ArrowUp', true);
      advance(100);
      if (folded() !== lastFolded) { flips += 1; lastFolded = folded(); }
    }
    ok(flips <= 2, `the mission card changes state at most twice in 21 s of on-and-off walking (${flips} changes)`);
    settle();

    // A status waits while a card that is not the HUD's own holds the play lock (a chooser, a lesson).
    lockPlayInput();
    hud.toast('+1 stone', 'good');
    ok(!hud._toasts.some((e) => e.message === '+1 stone'), 'a status waits behind a card that is not the HUD\'s own');
    unlockPlayInput();
    advance(1000);
    ok(hud._toasts.some((e) => e.message === '+1 stone'), 'and shows once that card closes');
    settle();

    // A line that waited 15 s needs only a 0.8 s stop; before that it never shows while she steers.
    pressKey('ArrowUp', true); advance(100);   // she is steering when the line comes
    hud.toast(GUIDE, 'info');
    hud.toast('+3 wood', 'good');
    ok(hud._toasts.some((e) => e.message === '+3 wood') && hud._toastQueue.some((q) => q.message === GUIDE), 'a status shows at once behind a long line that waits');
    for (let i = 0; i < 40; i += 1) { pressKey('ArrowUp', true); advance(400); }   // 16 s, a key every 400 ms
    ok(!hud._toasts.some((e) => e.message === GUIDE), 'a line still waits while she keeps steering (16 s)');
    advance(300);
    ok(!hud._toasts.some((e) => e.message === GUIDE), 'after 16 s it still needs a stop: 0.7 s is not enough');
    advance(700);
    ok(hud._toasts.some((e) => e.message === GUIDE), 'after 16 s a 1 s stop shows it');
    settle();

    // Back-to-back pauses: the next line waits 3 s of free play after a pause, and a quiet time from its end.
    const A = 'First line that needs a pause to read it.';
    const B = 'Second line that needs its own pause to read.';
    hud.toast(A, 'info');
    hud.toast(B, 'info');
    ok(hud.isReadPaused(), 'a reading pause is up while the first line shows');
    let aGone = -1;
    let bShown = -1;
    for (let i = 0; i < 400 && bShown < 0; i += 1) {
      advance(50);
      if (aGone < 0 && !hud._toasts.some((e) => e.message === A)) aGone = clock;
      if (bShown < 0 && hud._toasts.some((e) => e.message === B)) bShown = clock;
    }
    ok(aGone > 0 && bShown - aGone >= 2950 && bShown - aGone < 3700, `the next pause waits 3 s after the last ends (${bShown - aGone} ms)`);
    settle();
    ok(!hud.isReadPaused() && body.dataset.playModal === undefined, 'the game runs again between the pauses');

    // A line to read holds whenIdle too (a card does not open over it), and she is not locked.
    settle();
    let readDone = false;
    hud.toast(A, 'info');
    ok(hud._toasts.some((e) => e.message === A) && !isPlayModalOpen(), 'a line to read is up, and she is not locked');
    whenIdle(IDLE_MS).then(() => { readDone = true; });
    advance(readMs(A) - 500);
    await Promise.resolve(); await Promise.resolve();
    ok(!readDone, 'whenIdle waits while a line to read is up');
    advance(1000);
    await Promise.resolve(); await Promise.resolve();
    ok(readDone, 'whenIdle resolves once the line has gone');

    // whenIdle (readGate) also waits while a card or a reading pause holds the play lock.
    let idleDone = false;
    lockPlayInput();
    whenIdle(IDLE_MS).then(() => { idleDone = true; });
    advance(IDLE_MS + 500);
    await Promise.resolve(); await Promise.resolve();
    ok(!idleDone, 'whenIdle waits while a card holds the play lock');
    unlockPlayInput();
    advance(IDLE_MS + 500);
    await Promise.resolve(); await Promise.resolve();
    ok(idleDone, 'whenIdle resolves once the lock is gone and she is idle');
    settle();
  }

  // The Help chip does not open the chooser over a card.
  {
    const chip = createModeChip({ level: 4 });
    const before = body.children.length;
    body.dataset.playModal = '1';
    chip.el.dispatch('click');
    ok(body.children.length === before, 'the Help chip does nothing while a card is up');
    delete body.dataset.playModal;
  }

  // --- the HUD is torn down cleanly ----------------------------------------------
  hud.destroy();
  ok(body.dataset.playModal === undefined, 'destroy leaves no input lock behind');

  globalThis.performance = realPerf;
  globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear;
  globalThis.addEventListener = realAdd; globalThis.removeEventListener = realRemove;
  globalThis.document = realDoc; globalThis.window = realWin;
  globalThis.localStorage = realStore; globalThis.requestAnimationFrame = realRaf; globalThis.location = realLoc;
}

console.log(`test-play: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
