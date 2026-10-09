// Node test for Chapter 2's two films and the chapter-story hook (no browser).
//   node scripts/test-cutscenes-ch2.mjs
// Covers: the shot lists (20-35 s each, every caption a Level 4 / Level 1 pair,
// short Level 1 words); playOpening / playEnding run every shot in order with
// the camera and caption moving, leave the scene and the city as they found
// them, and survive a skip (run returns at once); chapterStory plays the film
// before the title card the first time, skips it for a returning child, and
// a key ends the film at once.

import assert from 'node:assert/strict';
import * as THREE from 'three';

// --- stand-ins for the browser (the film builds canvases, DOM nodes, listeners) ---
const removed = [];
const captionLog = [];
const listeners = [];
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set() { return true; },
});
function fakeEl(tag = 'div') {
  const el = {
    tagName: tag,
    style: {},
    dataset: {},
    className: '',
    children: [],
    classes: new Set(),
    classList: {
      add: (c) => el.classes.add(c),
      remove: (c) => el.classes.delete(c),
      contains: (c) => el.classes.has(c),
    },
    append(...n) { el.children.push(...n); },
    appendChild(n) { el.children.push(n); return n; },
    remove() { removed.push(el); },
    setAttribute() {},
    focus() {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => ctx2d,
  };
  // Every caption's text lands in captionLog, in order.
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get: () => text,
    set: (v) => { text = v; if (tag === 'div' && v) captionLog.push(v); },
  });
  return el;
}
globalThis.document = { createElement: fakeEl, body: fakeEl('body'), head: fakeEl('head') };
globalThis.addEventListener = (type, fn, cap) => { listeners.push({ type, fn, cap }); };
globalThis.removeEventListener = (type, fn) => {
  const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
  if (i >= 0) listeners.splice(i, 1);
};
// The confetti (a timer after the card) asks for a frame and the window size.
globalThis.requestAnimationFrame = () => 0;
globalThis.innerWidth = 800;
globalThis.innerHeight = 600;
const pressKey = () => {
  for (const l of [...listeners]) if (l.type === 'keydown') l.fn({ type: 'keydown', key: 'a', stopPropagation() {}, preventDefault() {} });
};

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const later = () => new Promise((r) => setImmediate(r));

const { OPENING, ENDING, playOpening, playEnding } = await import('../src/city/cutscenes.js');
const { createChapterStory } = await import('../src/game/chapterStory.js');

// ---------------------------------------------------------------------------
console.log('shot lists');
for (const [name, list] of [['opening', OPENING], ['ending', ENDING]]) {
  ok(`${name}: 20-35 s in all (a film, not a clip)`, () => {
    const total = list.reduce((s, sh) => s + sh.secs, 0);
    assert.ok(total >= 20 && total <= 35, `${name} is ${total} s`);
  });
  ok(`${name}: ids are unique and every shot has secs > 0`, () => {
    assert.equal(new Set(list.map((sh) => sh.id)).size, list.length);
    for (const sh of list) assert.ok(sh.secs > 0, sh.id);
  });
  ok(`${name}: every caption is a Level 4 / Level 1 pair (or none)`, () => {
    for (const sh of list) {
      if (sh.cap == null) continue;
      assert.equal(sh.cap.length, 2, sh.id);
      assert.ok(sh.cap[0].length > 10 && sh.cap[1].length > 5, `${sh.id} caption too short`);
    }
  });
  ok(`${name}: Level 1 captions use short words (<= 12 words)`, () => {
    for (const sh of list) {
      if (sh.cap == null) continue;
      assert.ok(sh.cap[1].split(/\s+/).length <= 12, `${sh.id}: "${sh.cap[1]}"`);
    }
  });
}
ok('opening: she arrives last, the ending finishes outside the workshop', () => {
  assert.equal(OPENING.at(-1).id, 'arrive');
  assert.equal(ENDING.at(-1).id, 'out');
});

// ---------------------------------------------------------------------------
// A stub `run`: records each shot and steps it at 0, the middle and the end.
function stubRun(log) {
  return (secs, step) => {
    log.push({ secs, caption: captionLog.at(-1) ?? null });
    step(0, 0);
    step(secs / 2, 0.5);
    step(secs, 1);
    return Promise.resolve();
  };
}
const stubCtx = () => ({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(52, 1.6, 0.1, 400),
  newtonAt: { x: -30, z: 4 },
  chasePose: () => ({ pos: new THREE.Vector3(-28.75, 3.6, 13.45), look: new THREE.Vector3(-28.75, 1.1, 6.25) }),
  root: new THREE.Group(),
});

console.log('the films');
await (async () => {
  const log = [];
  const ctx = stubCtx();
  captionLog.length = 0;
  await playOpening({ run: stubRun(log), ...ctx, camera: ctx.camera });
  ok('opening: every shot runs once, in order, with its own length', () => {
    assert.deepEqual(log.map((l) => l.secs), OPENING.map((sh) => sh.secs));
  });
  ok('opening: each shot shows its Level 4 caption (or none for a bare shot)', () => {
    OPENING.forEach((sh, i) => {
      if (sh.cap) assert.equal(log[i].caption, sh.cap[0], sh.id);
    });
  });
  ok('opening: the scene is cleared when the film ends', () => {
    assert.equal(ctx.scene.children.length, 0);
  });
  ok('opening: the camera ends on the chase pose (the card then holds there)', () => {
    const p = ctx.camera.position;
    assert.ok(Math.hypot(p.x + 28.75, p.y - 3.6, p.z - 13.45) < 0.05, `at ${p.x},${p.y},${p.z}`);
  });
})();

await (async () => {
  const ctx = stubCtx();
  const seen = [];
  // After each shot: is the city on screen? (the workshop cut hides it)
  const run = async (secs, step) => {
    await stubRun([])(secs, step);
    seen.push(ctx.root.visible);
  };
  await playEnding({ run, ...ctx });
  ok('ending: every shot runs once, in order', () => {
    assert.equal(seen.length, ENDING.length);
  });
  ok('ending: the city is hidden only during the workshop cut', () => {
    assert.deepEqual(seen, ENDING.map((sh) => sh.id !== 'plan'));
  });
  ok('ending: the city is shown again when the film ends', () => {
    assert.equal(ctx.root.visible, true);
    assert.equal(ctx.scene.children.length, 0);
  });
  ok('ending: a skipped film (run returns at once) still cleans up', async () => {
    const c2 = stubCtx();
    await playEnding({ run: () => Promise.resolve(), ...c2 });
    assert.equal(c2.scene.children.length, 0);
    assert.equal(c2.root.visible, true);
    await playOpening({ run: () => Promise.resolve(), ...c2 });
    assert.equal(c2.scene.children.length, 0);
  });
})();

// Reduced motion: the same shots, held still. It must not throw or hang.
await (async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const ctx = stubCtx();
  const log = [];
  await playOpening({ run: stubRun(log), ...ctx });
  ok('reduced motion: the films hold still and still run every shot', () => {
    assert.equal(log.length, OPENING.length);
  });
  delete globalThis.matchMedia;
})();

// ---------------------------------------------------------------------------
console.log('the chapter hook');
/** Drive the story as the chapter's tick does, until its promise settles. */
async function drive(story, promise, frames = 4000) {
  let settled = false;
  promise.then(() => { settled = true; });
  for (let i = 0; i < frames && !settled; i++) {
    story.update(1 / 30);
    await later();
  }
  return settled;
}
const hookCamera = () => new THREE.PerspectiveCamera(52, 1.6, 0.1, 400);
const hookStory = (camera) => createChapterStory({
  camera,
  chasePose: () => ({ pos: new THREE.Vector3(0, 3.6, 7.2), look: new THREE.Vector3(0, 1.1, 0) }),
  getAvatar: () => null,
  getPlayerPos: () => new THREE.Vector3(),
  chapter: 2,
  level: 4,
});

await (async () => {
  localStorage.clear?.();
  store.clear();
  const order = [];
  const camera = hookCamera();
  const story = hookStory(camera);
  const scene = async (run) => {
    order.push('film');
    await run(1.5, () => { order.push('step'); });
    order.push('film-end');
  };
  const done = await drive(story, story.intro({ eyebrow: 'Chapter 2', title: 'Forces and Machines', line: 'x', scene }));
  ok('first time: the film plays before the card, then the intro ends', () => {
    assert.ok(done, 'intro never finished');
    assert.equal(order[0], 'film');
    assert.equal(order.at(-1), 'film-end');
    assert.ok(order.includes('step'));
  });
  ok('first time: the Level is remembered as seen', () => {
    assert.equal(story.seen(), true);
  });
  // A returning child: the film is not played again (the card only).
  const order2 = [];
  const story2 = hookStory(hookCamera());
  const done2 = await drive(story2, story2.intro({
    eyebrow: 'Chapter 2', title: 'Forces and Machines', line: 'x',
    scene: async () => { order2.push('film'); },
  }));
  ok('returning: the film is skipped and the title card is short', () => {
    assert.ok(done2);
    assert.deepEqual(order2, []);
  });
})();

await (async () => {
  // A returning child: a scene OBJECT (Chapter 1's style builds its set when made)
  // is taken down at once, never played (it hid the village's scenery before).
  store.clear();
  const story = hookStory(hookCamera());
  const first = story.intro({ eyebrow: 'Chapter 1', title: 'x', line: 'x' });
  for (let i = 0; i < 400; i++) story.update(1 / 30);
  await first;
  let disposed = 0; let stepped = 0;
  const obj = { duration: 20, step() { stepped += 1; }, dispose() { disposed += 1; } };
  const again = story.intro({ eyebrow: 'Chapter 1', title: 'x', line: 'x', scene: obj });
  for (let i = 0; i < 200; i++) story.update(1 / 30);
  await again;
  ok('returning: a scene object is disposed at once and never stepped', () => {
    assert.equal(disposed, 1);
    assert.equal(stepped, 0);
  });
})();

await (async () => {
  // A key during the film ends the film and the intro at once.
  store.clear();
  const order = [];
  const story = hookStory(hookCamera());
  const scene = async (run) => {
    order.push('film');
    await run(30, () => { order.push('step'); });   // would take 30 s
    order.push('film-end');
  };
  const p = story.intro({ eyebrow: 'Chapter 2', title: 'Forces and Machines', line: 'x', scene });
  story.update(1 / 30);
  let settled = false;
  p.then(() => { settled = true; });
  pressKey();                                   // too early: skips arm after 1 s
  await later();
  ok('a key in the first second does not skip', () => assert.ok(!settled));
  await new Promise((r) => setTimeout(r, 1050));
  pressKey();
  await later();
  await later();
  ok('a key skips the film: the intro resolves, the film ends at once', () => {
    assert.ok(settled, 'intro still waiting after a key');
    assert.equal(order[0], 'film');
    assert.equal(order.at(-1), 'film-end');
    assert.equal(story.active, false);
  });
})();

await (async () => {
  // The ending: a film, then the complete card; a key during the film ends only the film.
  store.clear();
  const order = [];
  const story = hookStory(hookCamera());
  const p = story.outro({
    title: 'The Engineering Workshop is built!', line: 'x', focus: new THREE.Vector3(0, 0, 0),
    scene: async (run) => {
      order.push('film');
      await run(30, () => {});
      order.push('film-end');
    },
  });
  story.update(1 / 30);
  await new Promise((r) => setTimeout(r, 1050)); // skips arm after 1 s
  pressKey();
  await later();
  ok('ending: a key ends the film, and the complete card is still on its way', () => {
    assert.equal(order.at(-1), 'film-end');
    assert.ok(p instanceof Promise);
  });
})();

await (async () => {
  // One chapter story: the opening film ends, and the ending film still plays in full.
  store.clear();
  const order = [];
  const story = hookStory(hookCamera());
  const film = (name) => async (run) => { order.push(name); await run(1, () => {}); order.push(`${name}-end`); };
  await drive(story, story.intro({ eyebrow: 'Chapter 2', title: 'Forces and Machines', line: 'x', scene: film('open') }));
  const p = story.outro({ title: 'The Engineering Workshop is built!', line: 'x', focus: null, scene: film('end') });
  await drive(story, p, 300);   // the card waits for a button; the film is what we check
  ok('the opening film, then the ending film, both play on one chapter story', () => {
    assert.deepEqual(order, ['open', 'open-end', 'end', 'end-end']);
  });
})();

console.log(`\n${passed} checks passed (cutscenes-ch2)`);
