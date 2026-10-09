// Chapter 1's opening and ending (src/science/cutscenes.js), without a browser.
//
//   node scripts/test-cutscenes-ch1.mjs
//
// The shot list: the opening is 29 s and the ending 29.8 s, and with the title
// card's hold each stays inside the 20-35 s band. Every caption is a
// [Level 4, Level 1] pair of text, in time order, inside its scene, and stays up
// for its reading time (readMs) before the next one starts. Each scene
// steps over its whole length with finite camera poses, full and reduced
// motion. Dispose puts the scene back as it was (nothing added left behind, the
// village's folk and labels shown again) and can be called twice.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';
import { readMs } from '../src/play/readTime.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// makeLabel (the village's signs) paints on a canvas: a no-op 2-D context is enough here.
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'measureText' ? () => ({ width: 120 }) : k in t ? t[k] : (t[k] = () => {})),
  set: (t, k, v) => { t[k] = v; return true; },
});
// A small DOM for chapterStory.js's films: elements keep their classes and text, so the
// test can read what is on screen (the caption, the title card).
class FakeEl {
  constructor(tag) {
    this.tagName = tag; this.className = ''; this.textContent = ''; this.children = []; this.parent = null;
    this.isConnected = false; this.width = 0; this.height = 0; this.dataset = {}; this.style = {};
    const on = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => on.add(x)),
      remove: (...c) => c.forEach((x) => on.delete(x)),
      toggle: (c, force) => { const want = force === undefined ? !on.has(c) : !!force; if (want) on.add(c); else on.delete(c); return want; },
      contains: (c) => on.has(c),
    };
  }
  appendChild(c) { c.parent = this; c.isConnected = true; this.children.push(c); return c; }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; this.isConnected = false; }
  setAttribute() {}
  addEventListener() {}
  focus() {}
  getContext() { return ctx2d; }
}
globalThis.document = { createElement: (tag) => new FakeEl(tag), head: new FakeEl('head'), body: new FakeEl('body') };

const TITLE_HOLD = 4.2; // the title card's hold after an opening (src/game/chapterStory.js intro)

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const C = await vite.ssrLoadModule('/src/science/cutscenes.js');

  /** A scene context with the village's pieces it touches, and a fake avatar that records its plays. */
  function fakeCtx(reduced) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ed0f5);
    scene.fog = new THREE.Fog(0x8ed0f5, 70, 230);
    const folk = new THREE.Group();
    folk.name = 'townsfolk';
    scene.add(folk);
    const worldRoot = new THREE.Group();
    for (const n of ['scienceCenter4', 'scienceCenter5']) { const g = new THREE.Group(); g.name = n; worldRoot.add(g); }
    scene.add(worldRoot);
    const world = { root: worldRoot, setLabelsVisible() {} };
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 400);
    const plays = [];
    const avatar = { play: (name) => plays.push(name) };
    const chase = { pos: new THREE.Vector3(-21.25, 3.6, 18.5), look: new THREE.Vector3(-21.25, 1.1, 11.25) };
    const ctx = {
      scene, camera, world, sun, reduced,
      getAvatar: () => avatar,
      getPlayerPos: () => new THREE.Vector3(3.75, 0, 26.25),
      chasePose: () => ({ pos: chase.pos.clone(), look: chase.look.clone() }),
    };
    return { ctx, scene, folk, worldRoot, sun, camera, plays };
  }

  /** Run a scene start to end at 30 steps a second; returns the captions it showed. */
  function run(scene, camera, ctxParts) {
    const shown = [];
    let last = null;
    const say = (text) => { if (text !== last) { last = text; shown.push(text); } };
    for (let t = 0; t <= scene.duration + 1e-9; t += 1 / 30) {
      scene.step(t, say);
      for (const v of [camera.position.x, camera.position.y, camera.position.z]) assert.ok(Number.isFinite(v), `camera finite at ${t.toFixed(2)} s`);
      for (const v of [camera.position.x, camera.position.y, camera.position.z]) assert.ok(Math.abs(v) < 1000, 'camera on the map');
    }
    ctxParts?.();
    return shown.filter((x) => x !== null);
  }

  console.log('shot list');
  ok('opening is 29 s; with the title hold it is in the 20-35 s band', () => {
    assert.equal(C.OPENING_LENGTH, 29);
    assert.ok(C.OPENING_LENGTH + TITLE_HOLD >= 20 && C.OPENING_LENGTH + TITLE_HOLD <= 35);
  });
  ok('ending is 29.8 s, in the 20-35 s band', () => {
    assert.equal(C.ENDING_LENGTH, 29.8);
    assert.ok(C.ENDING_LENGTH >= 20 && C.ENDING_LENGTH <= 35);
  });

  console.log('captions');
  for (const [name, list, len] of [['opening', C.CAPS_OPEN, C.OPENING_LENGTH], ['ending', C.CAPS_END, C.ENDING_LENGTH]]) {
    ok(`${name}: every caption is a [Level 4, Level 1] pair of text, in order, inside the scene`, () => {
      assert.ok(list.length >= 4, 'several captions');
      let prev = -1;
      for (const [t0, pair] of list) {
        assert.ok(t0 > prev && t0 >= 0 && t0 < len, `start ${t0} in order and inside ${len} s`);
        prev = t0;
        assert.equal(Array.isArray(pair) && pair.length, 2, 'a pair');
        for (const s of pair) assert.ok(typeof s === 'string' && s.trim().length > 0, 'text');
        // Level 1 is the short version of the same line.
        assert.ok(pair[1].length <= pair[0].length, `Level 1 is no longer than Level 4 at ${t0} s`);
      }
    });
  }

  ok('every caption stays up for its reading time before the next one (both Levels), and the last one to the end', () => {
    for (const [list, len] of [[C.CAPS_OPEN, C.OPENING_LENGTH], [C.CAPS_END, C.ENDING_LENGTH]]) {
      list.forEach(([t0, pair], i) => {
        const end = i + 1 < list.length ? list[i + 1][0] : len;
        for (const text of pair) {
          assert.ok(end - t0 >= readMs(text) / 1000 - 1e-9, `"${text.slice(0, 40)}" at ${t0} s is up ${(end - t0).toFixed(2)} s, needs ${(readMs(text) / 1000).toFixed(2)} s`);
        }
      });
    }
  });

  console.log('scenes');
  for (const reduced of [false, true]) {
    const tag = reduced ? 'reduced motion' : 'full motion';
    for (const [name, make, list] of [['opening', C.playOpening, C.CAPS_OPEN], ['ending', C.playEnding, C.CAPS_END]]) {
      ok(`${name} (${tag}): steps over its whole length, shows its captions in order, disposes clean`, () => {
        const f = fakeCtx(reduced);
        const before = f.scene.children.length;
        const folkWas = f.folk.visible;
        const bg = f.scene.background.clone();
        const scene = make(f.ctx);
        assert.equal(typeof scene.duration, 'number');
        assert.equal(scene.duration, name === 'opening' ? C.OPENING_LENGTH : C.ENDING_LENGTH);
        assert.equal(f.folk.visible, false, 'the village folk are hidden while it plays');
        assert.ok(f.scene.children.length > before, 'it adds its own objects');
        const shown = run(scene, f.camera);
        assert.ok(shown.length >= 4, 'several captions shown');
        const allowed = new Set(list.flatMap((c) => c[1]));
        for (const s of shown) assert.ok(allowed.has(s), `caption "${s}" is in the list`);
        scene.dispose();
        scene.dispose(); // twice is fine
        assert.equal(f.scene.children.length, before, 'nothing added is left behind');
        assert.equal(f.folk.visible, folkWas, 'folk shown again');
        assert.ok(f.scene.background.equals(bg), 'sky restored');
        assert.equal(f.scene.fog.color.getHex(), 0x8ed0f5, 'fog restored');
      });
    }
  }

  ok('ending: the village\'s own dome and telescope are hidden while it plays and shown again after', () => {
    const f = fakeCtx(false);
    const scene = C.playEnding(f.ctx);
    const pieces = ['scienceCenter4', 'scienceCenter5'].map((n) => f.worldRoot.getObjectByName(n));
    scene.step(3, () => {});
    assert.ok(pieces.every((p) => p.visible === false), 'hidden during the scene');
    scene.dispose();
    assert.ok(pieces.every((p) => p.visible === true), 'shown again');
  });

  ok('the opening waves the hero once, the ending cheers her once', () => {
    const f = fakeCtx(false);
    const s = C.playOpening(f.ctx);
    run(s, f.camera);
    s.dispose();
    assert.deepEqual(f.plays, ['wave']);
    const g = fakeCtx(false);
    const e = C.playEnding(g.ctx);
    run(e, g.camera);
    e.dispose();
    assert.deepEqual(g.plays, ['cheer']);
  });

  // --- captions in a film wait to be read (chapterStory.js, lead 2026-10-09) ---
  console.log('film captions');
  const story = await vite.ssrLoadModule('/src/game/chapterStory.js');
  const handlers = {};
  globalThis.addEventListener = (type, fn) => { (handlers[type] ||= []).push(fn); };
  globalThis.removeEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };  // never seen: the full film
  const DT = 1 / 30;
  // A frame yields to real timers too: the title card comes on after a 30 ms timer.
  const frame = () => new Promise((r) => setTimeout(r, 1));
  const shownCaption = () => document.body.children.find((n) => n.className === 'cs-caption' && n.classList.contains('is-on'))?.textContent ?? null;
  const titleOn = () => document.body.children.some((n) => n.className === 'cs-title' && n.classList.contains('is-on'));

  /** Play an intro with a film by hand: `frames` per call, `onFrame(clock)` after each. */
  function startFilm(scene) {
    const cs = story.createChapterStory({
      camera: new THREE.PerspectiveCamera(), chasePose: () => ({ pos: new THREE.Vector3(0, 5, 20), look: new THREE.Vector3(0, 1, 0) }),
      getAvatar: () => null, getPlayerPos: () => new THREE.Vector3(0, 0, 20), chapter: 1, level: 4,
    });
    let clock = 0;
    let done = false;
    const p = cs.intro({ eyebrow: 'Chapter 1', title: 'Test', line: 'A line.', scene }).then(() => { done = true; });
    const step = async (onFrame) => {
      clock += DT;
      const held = cs.update(DT);   // true: the story owns the camera this frame
      await frame();
      onFrame?.(clock, held);
    };
    return { cs, p, step, clock: () => clock, isDone: () => done };
  }

  await (async () => {
    // A caption asked for early waits: the film clock holds until the one on screen has had its 5 s.
    const calls = [];
    const shots = [];
    let fl = null;
    const scene = {
      duration: 9,
      step(t, say) { calls.push([fl.clock(), t]); say(t < 2 ? 'Dawn over the sea.' : 'The sun rises over the sea, slowly, for her.'); },
      dispose() {},
    };
    fl = startFilm(scene);
    for (let i = 0; i < 30 * 30 && !fl.isDone(); i++) await fl.step((c) => shots.push([c, shownCaption()]));
    const firstLate = calls.find(([, t]) => t >= 2);
    assert.ok(firstLate, 'the film reached its second caption');
    // The film asks for it at 2 s, and its clock holds (no step runs) until the first has had 5 s.
    const during = calls.filter(([c]) => c > firstLate[0] + DT && c < 4.95);
    assert.equal(during.length, 0, `the film ran ${during.length} steps while the first caption was still read`);
    const first = shots.find(([, text]) => text === 'Dawn over the sea.');
    const second = shots.find(([, text]) => text === 'The sun rises over the sea, slowly, for her.');
    assert.ok(first && second, 'both captions were on screen');
    assert.ok(second[0] - first[0] >= 4.95, `the first caption stayed ${(second[0] - first[0]).toFixed(2)} s`);
    assert.ok(fl.isDone(), 'the film ended');
    passed += 1;
    console.log('  ok  an early caption waits: the first stays readMs, and the film clock holds');
  })();

  await (async () => {
    // The film's last caption keeps its time before the title card comes on.
    let fl = null;
    let filmEnd = null;
    const scene = {
      duration: 6,
      step(t, say) { say(t < 3 ? 'Dawn over the sea.' : 'The last words, read for five seconds.'); },
      dispose() { filmEnd = fl.clock(); },
    };
    const seen = [];
    fl = startFilm(scene);
    for (let i = 0; i < 30 * 30 && !fl.isDone(); i++) await fl.step((c, held) => seen.push([c, shownCaption(), titleOn(), held]));
    const card = seen.find(([, , title]) => title);
    assert.ok(card, 'the title card came on');
    assert.ok(card[0] >= 9.95, `the title card came on at ${card[0].toFixed(2)} s, before the last caption had its 5 s`);
    assert.equal(card[1], null, 'no caption is up under the title card');
    // Once the film is over, its last picture holds (the story keeps the camera) while the caption is read.
    const holding = seen.filter(([c, text]) => c >= filmEnd && text !== null);
    assert.ok(holding.length > 30, 'the last caption is up after the film ended');
    assert.ok(holding.every(([, , , held]) => held), 'the camera is held while the last caption is read');
    passed += 1;
    console.log('  ok  the last caption of a film keeps its reading time before the title card');
  })();

  await (async () => {
    // A function scene (Chapter 2's style) captions through run.say: its short shot still gives the line 5 s.
    const shots = [];
    const scene = async (run) => {
      run.say('Dawn over the sea.');
      await run(1, () => {});
      run.say('The second line is up next.');
      await run(1, () => {});
    };
    const fl = startFilm(scene);
    for (let i = 0; i < 30 * 30 && !fl.isDone(); i++) await fl.step((c) => shots.push([c, shownCaption()]));
    const a = shots.find(([, text]) => text === 'Dawn over the sea.');
    const b = shots.find(([, text]) => text === 'The second line is up next.');
    assert.ok(a && b, 'both lines were on screen');
    assert.ok(b[0] - a[0] >= 4.95, `the first line stayed ${(b[0] - a[0]).toFixed(2)} s`);
    assert.ok(fl.isDone(), 'the film ended');
    passed += 1;
    console.log('  ok  run.say (a function scene) holds its caption the same way');
  })();

  await (async () => {
    // Skip still works at any time: a key during a caption ends the film and clears the caption at once.
    let fl = null;
    const scene = { duration: 30, step(t, say) { say('Dawn over the sea.'); }, dispose() {} };
    fl = startFilm(scene);
    for (let i = 0; i < 30; i++) await fl.step();
    assert.equal(shownCaption(), 'Dawn over the sea.', 'the caption is up before the skip');
    await new Promise((r) => setTimeout(r, 1100));   // skips arm after a second
    for (const fn of handlers.keydown || []) fn({ type: 'keydown', key: ' ', preventDefault() {}, stopPropagation() {} });
    await frame(); await frame();
    assert.ok(fl.isDone(), 'the skip ended the film');
    assert.equal(shownCaption(), null, 'the caption is cleared at once');
    passed += 1;
    console.log('  ok  Skip ends a film at any time and clears its caption at once');
  })();

  console.log(`\n${passed} checks passed`);
} finally {
  await vite.close();
}
