// Chapter 1's opening and ending (src/science/cutscenes.js), without a browser.
//
//   node scripts/test-cutscenes-ch1.mjs
//
// The shot list: the opening is 26 s and the ending 25 s, and with the title
// card's hold each stays inside the 20-35 s band. Every caption is a
// [Level 4, Level 1] pair of text, in time order, inside its scene. Each scene
// steps over its whole length with finite camera poses, full and reduced
// motion. Dispose puts the scene back as it was (nothing added left behind, the
// village's folk and labels shown again) and can be called twice.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// makeLabel (the village's signs) paints on a canvas: a no-op 2-D context is enough here.
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'measureText' ? () => ({ width: 120 }) : k in t ? t[k] : (t[k] = () => {})),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

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
  ok('opening is 26 s; with the title hold it is in the 20-35 s band', () => {
    assert.equal(C.OPENING_LENGTH, 26);
    assert.ok(C.OPENING_LENGTH + TITLE_HOLD >= 20 && C.OPENING_LENGTH + TITLE_HOLD <= 35);
  });
  ok('ending is 25 s, in the 20-35 s band', () => {
    assert.equal(C.ENDING_LENGTH, 25);
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

  console.log(`\n${passed} checks passed`);
} finally {
  await vite.close();
}
