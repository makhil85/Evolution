// Chapter 3's own cutscenes (src/game/cutscenes.js): the shot lists, the
// captions, the orbit camera, and the seen / short rules.
//
//   node scripts/test-cutscenes-ch3.mjs
//
// The opening runs 20-35 s; the arrival in orbit runs 20-35 s too, and its
// camera never goes inside Earth or the Moon. Every caption has both Levels,
// and the Level 1 line is never longer than the Level 4 one. A returning child
// (the seen key is set) gets the short path: story.intro for the opening, and
// no orbit at all for the arrival. Drawing needs a browser, so this checks
// the data and the maths only.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  OPENING_SHOTS, ARRIVAL_SHOTS, totalSeconds, captionText, locate, arrivalCamera,
  createOpening, createArrival,
} from '../src/game/cutscenes.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A minimal localStorage, so the seen checks can run in node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

console.log('shot lists');
ok('the opening runs 20-35 seconds', () => {
  const s = totalSeconds(OPENING_SHOTS);
  assert.ok(s >= 20 && s <= 35, `opening is ${s} s`);
});
ok('the arrival in orbit runs 20-35 seconds', () => {
  const s = totalSeconds(ARRIVAL_SHOTS);
  assert.ok(s >= 20 && s <= 35, `arrival is ${s} s`);
});
ok('every shot has a positive duration and a known id', () => {
  const ids = new Set(['cards', 'reveal', 'road', 'pad', 'her', 'stage', 'earth', 'moon']);
  for (const sh of [...OPENING_SHOTS, ...ARRIVAL_SHOTS]) {
    assert.ok(sh.dur > 0, `${sh.id} has no duration`);
    assert.ok(ids.has(sh.id), `unknown shot ${sh.id}`);
  }
});
ok('the opening starts with the jump in time and ends on her', () => {
  assert.equal(OPENING_SHOTS[0].id, 'cards');
  assert.equal(OPENING_SHOTS[OPENING_SHOTS.length - 1].id, 'her');
  assert.match(OPENING_SHOTS[0].caption[0], /Years later/);
});
ok('every caption has both Levels, and Level 1 is never longer than Level 4', () => {
  for (const sh of [...OPENING_SHOTS, ...ARRIVAL_SHOTS]) {
    if (!sh.caption) continue;
    const [l4, l1] = sh.caption;
    assert.ok(typeof l4 === 'string' && l4.length > 0, `${sh.id}: no Level 4 line`);
    assert.ok(typeof l1 === 'string' && l1.length > 0, `${sh.id}: no Level 1 line`);
    assert.ok(l1.length <= l4.length, `${sh.id}: Level 1 line is longer`);
  }
});
ok('captionText picks the Level', () => {
  const pair = ['Long words here.', 'Short words.'];
  assert.equal(captionText(pair, 4), 'Long words here.');
  assert.equal(captionText(pair, 1), 'Short words.');
  assert.equal(captionText(null, 1), null);
});

console.log('timeline');
ok('locate finds the shot and the progress through it', () => {
  const a = locate(OPENING_SHOTS, 0);
  assert.equal(a.index, 0); assert.ok(a.ok); assert.equal(a.u, 0);
  const b = locate(OPENING_SHOTS, OPENING_SHOTS[0].dur + 1);
  assert.equal(b.index, 1);
  assert.ok(Math.abs(b.u - 1 / OPENING_SHOTS[1].dur) < 1e-9);
});
ok('locate past the end reports not ok', () => {
  const end = locate(ARRIVAL_SHOTS, totalSeconds(ARRIVAL_SHOTS) + 0.5);
  assert.equal(end.ok, false);
});

console.log('orbit camera');
const EARTH = new THREE.Vector3(0, -180, 0);
const MOON = new THREE.Vector3(-30, 70, -300);
ok('the camera stays above Earth at every point of every arrival shot', () => {
  for (const sh of ARRIVAL_SHOTS) {
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const { p } = arrivalCamera(sh.id, u);
      const d = new THREE.Vector3(...p).distanceTo(EARTH);
      assert.ok(d > 180 + 10, `${sh.id} u=${u}: ${d.toFixed(1)} is inside Earth`);
    }
  }
});
ok('the camera never sits inside the Moon, and the Moon is ahead at the end', () => {
  for (const sh of ARRIVAL_SHOTS) {
    for (const u of [0, 1]) {
      const { p } = arrivalCamera(sh.id, u);
      assert.ok(new THREE.Vector3(...p).distanceTo(MOON) > 46 + 10);
    }
  }
  const { p, l } = arrivalCamera('moon', 1);
  const toMoon = new THREE.Vector3(...l).sub(new THREE.Vector3(...p)).normalize();
  assert.ok(toMoon.z < -0.8, 'the camera is not looking ahead toward the Moon');
});

console.log('seen and short paths');
ok('a new Level has not seen the opening, and the seen key is the one chapterStory.js uses', () => {
  const fakeCamera = new THREE.PerspectiveCamera();
  const opening = createOpening({
    camera: fakeCamera, scene: new THREE.Scene(), sun: new THREE.DirectionalLight(), ground: () => 0,
    chasePose: () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), getAvatar: () => null,
    chapter: 3, level: 4, title: 'Ready for Lift-off', line: 'x',
  });
  assert.equal(opening.seen(), false);
  store.set('rocket_village_seen_ch3_L4', '1');
  assert.equal(opening.seen(), true);
  assert.equal(opening.active, false);
  store.delete('rocket_village_seen_ch3_L4');
});
ok('the arrival is seen per Level and separate from the opening', () => {
  const arrival = createArrival({ renderer: null, rocket: { stages: new Map() }, level: 1 });
  assert.equal(arrival.seen(), false);
  store.set('rocket_village_seen_ch3_L1_orbit', '1');
  assert.equal(arrival.seen(), true);
  store.delete('rocket_village_seen_ch3_L1_orbit');
});
ok('with no storage at all, both count as seen (the short path, as in chapterStory.js)', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = undefined;
  const arrival = createArrival({ renderer: null, rocket: { stages: new Map() }, level: 4 });
  assert.equal(arrival.seen(), true);
  globalThis.localStorage = saved;
});
ok('the scenes expose the calls gameScene.js makes (play, update, render, stop)', () => {
  const arrival = createArrival({ renderer: null, rocket: { stages: new Map() }, level: 4 });
  for (const f of ['play', 'render', 'stop', 'seen']) assert.equal(typeof arrival[f], 'function', f);
  assert.equal(arrival.render(0.016), false, 'nothing to draw before play()');
  arrival.stop();
});

console.log(`\n${passed} cutscene checks passed`);
