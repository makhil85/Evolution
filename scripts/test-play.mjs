// Node test for the shared play-mode logic (no browser).
//   node scripts/test-play.mjs
// Covers: the mode table, the miner's counting, the treasure-hunt engine
// (order, decoys, persistence, found, reset), and that the DOM-touching modules
// import and no-op safely in node.

import { PLAY_MODES, PLAY_MODE_KEY, describeMode, savedPlayModeId, loadPlayMode, savePlayMode, choosePlayMode } from '../src/play/modes.js';
import { createMiner } from '../src/play/mining.js';
import { createHunt, createKeyBlockMesh } from '../src/play/hunt.js';
import { lockPlayInput, unlockPlayInput, isPlayModalOpen } from '../src/play/ui.js';
import { createNavArrow } from '../src/play/navArrow.js';
import { createHeldKeys, REPEAT_QUIET_MS } from '../src/game/heldKeys.js';

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

console.log(`test-play: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
