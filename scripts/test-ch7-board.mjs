// Chapter 7: aboard the starship (her small rocket is never drawn), and the board
// film before the walks.
//
//   node scripts/test-ch7-board.mjs
//
// Every Chapter 7 step makes her aboard as it starts (game.aboardStarship, set by the
// step wrapper in ch7/steps.js: also after a reload into one). Chapter 6: aboard from
// the dock (Part A's first step) on, not before (ch6/steps.js). The board film's length and its skip
// (after 1 s, straight to the fade), the once-per-part rule (the first walk of
// each act), and that the film puts everything back when it ends: the flight
// state, the starship's ring spin, the skip listener and the overlay. The film
// runs here against a stub game with a small stand-in for the DOM and the window,
// driven frame by frame the way main.js drives it.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
async function okAsync(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A stand-in DOM: just what cinematics.js's overlay and the film touch. Overlay roots
// are tracked, so the dispose check can see whether one is left on the page.
const openRoots = new Set();
const bodyClasses = new Set();
const keyListeners = new Set();
function fakeNode(tag) {
  const node = {
    tag,
    className: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(c) { return c; },
    querySelector() { return fakeNode('div'); },
    remove() { openRoots.delete(node); },
  };
  return node;
}
// The overlay root is the only node with className 'cine'.
const realCreate = (tag) => {
  const n = fakeNode(tag);
  let cls = '';
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = v; if (v === 'cine') openRoots.add(n); } });
  return n;
};
globalThis.document = {
  createElement: realCreate,
  head: { appendChild() {} },
  body: {
    classList: { add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c), toggle() {} },
    appendChild(n) { return n; },
  },
};
globalThis.window = {
  addEventListener(type, fn) { if (type === 'keydown') keyListeners.add(fn); },
  removeEventListener(type, fn) { if (type === 'keydown') keyListeners.delete(fn); },
};
globalThis.requestAnimationFrame ??= () => 0;
globalThis.cancelAnimationFrame ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { ch7Steps } = await vite.ssrLoadModule('/src/space/ch7/steps.js');
  const film = await vite.ssrLoadModule('/src/space/ch7/boardFilm.js');
  const { readMs } = await vite.ssrLoadModule('/src/play/readTime.js');

  // The enter wrappers set the aboard flag before anything else, so each check reads it
  // straight after the call, without waiting for the step's own enter (a timed cutscene).
  // The stub has no scene, so showStarship stops the enter there.
  const enterFlag = (game, st) => { game.aboardStarship = false; st.enter(game).catch(() => {}); return game.aboardStarship; };
  const stubGame = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {}, aboardStarship: false };
  const steps = ch7Steps(stubGame);

  console.log('aboard the starship');
  ok('every Chapter 7 step makes her aboard: her small rocket is hidden as it enters', () => {
    assert.ok(steps.length >= 10, 'the chain has its steps');
    for (const st of steps) assert.equal(enterFlag(stubGame, st), true, `${st.id} did not set aboardStarship`);
  });
  const ch6Game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {}, ship: { x: 60000, z: 0, angle: 0 }, aboardStarship: false };
  const ch6 = (await vite.ssrLoadModule('/src/space/ch6/steps.js')).ch6Steps(ch6Game);
  const dock = ch6.findIndex((s) => s.id === 'c6_meet_crew');
  ok('Chapter 6: her rocket flies until the dock (Part A), and is gone from the dock step on', () => {
    assert.ok(dock > 0, 'the dock step is found');
    for (let i = 0; i < ch6.length; i++) {
      const aboard = enterFlag(ch6Game, ch6[i]);
      assert.equal(aboard, i >= dock, `${ch6[i].id} (step ${i}, the dock is step ${dock}): aboard ${aboard}`);
    }
  });
  ok('the walk hook is set, so a walk from the flight view can play its film', () => {
    assert.equal(typeof stubGame.beforeWalk, 'function');
  });

  console.log('board film');
  ok('the film lasts about 6-8 s', () => {
    assert.ok(film.FILM_S >= 6 && film.FILM_S <= 8, `FILM_S is ${film.FILM_S}`);
  });
  ok('skippable after 1 s, as the other films', () => {
    assert.equal(film.SKIP_AFTER_MS, 1000);
  });
  ok('a skip goes straight to the fade, and never back in time', () => {
    const fadeAt = film.skipClock(0);
    assert.ok(fadeAt > 0 && fadeAt < film.FILM_S, `skip goes to ${fadeAt}`);
    assert.equal(film.skipClock(film.FILM_S), film.FILM_S);
    assert.equal(film.skipClock(fadeAt + 0.5), fadeAt + 0.5);
  });
  ok('the caption stays up readMs (at least 5 s, at most 10 s)', () => {
    const ms = readMs('Chapter 7 Aboard the starship');
    assert.ok(ms >= 5000 && ms <= 10000, `${ms} ms`);
  });
  ok('once per part: the first walk of each act gets the film, the rest do not', () => {
    const state = {};
    assert.equal(film.filmDue(state, 1), true, 'Part A');
    assert.equal(film.filmDue(state, 1), false, 'a second walk in Part A');
    assert.equal(film.filmDue(state, 2), true, 'Part B');
    assert.equal(film.filmDue(state, 2), false, 'a second walk in Part B');
    assert.equal(film.filmDue(state, 3), true, 'Part C');
    assert.equal(film.filmDue(state, undefined), false, 'no step: no film');
    assert.equal(film.filmDue(state, null), false, 'no step: no film');
  });

  // Film runs: a stub game with a real starship (the film builds nothing else).
  const THREE_CAM = () => new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 400000);
  const filmGame = () => ({
    scene: new THREE.Scene(), paused: false, warpIndex: 1,
    controls: { enabled: null, setEnabled(v) { this.enabled = v; } },
    missions: { step: { act: 2 } },
  });
  // Drives the film the way main.js does: one frame per dt, until the clock is past `until`.
  const drive = (game, cam, until, dt = 1 / 30) => {
    while (game.cinematic && game.cinematic.t < until) game.cinematic.apply(dt, cam);
  };

  await okAsync('the film runs its full length, holds the walk on black, and puts everything back', async () => {
    const game = filmGame();
    const p = film.playBoardFilm(game);
    assert.ok(game.cinematic, 'the film is the cinematic while it plays');
    assert.equal(game.paused, true, 'flight is paused under the film');
    assert.equal(game.warpIndex, 0);
    const cam = THREE_CAM();
    drive(game, cam, film.FILM_S);
    assert.ok(Math.abs(game.cinematic.t - film.FILM_S) < 1 / 30 + 1e-6, `film clock ${game.cinematic.t}`);
    // The shot ends a few metres off the ring's rim (the window is at 62 m from the hub),
    // looking at the window: the starship's scale turns metres into scene units.
    const star = game._starship.ship.group;
    const ring = star.getObjectByName('habitat-ring');
    const k = star.scale.x;
    const d = cam.position.distanceTo(star.position);
    assert.ok(d > 62 * k && d < 72 * k, `camera ${(d / k).toFixed(1)} m from the hub`);
    const win = ring.localToWorld(new THREE.Vector3(62.12 * Math.cos(Math.PI / 3), 62.12 * Math.sin(Math.PI / 3), 0));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const toWin = win.clone().sub(cam.position).normalize();
    assert.ok(fwd.dot(toWin) > 0.999, `camera looks ${fwd.dot(toWin).toFixed(4)} along the window`);
    await p;
    assert.equal(game.cinematic, null, 'the cinematic is cleared');
    assert.equal(game.paused, false, 'pause is put back');
    assert.equal(game.controls.enabled, true, 'her controls are back');
    assert.equal(bodyClasses.has('in-cinematic'), false, 'the HUD comes back');
    // The ring turns again at showStarship's spin after the film.
    const z0 = ring.rotation.z;
    game._starship.ship.update(1, 1);
    assert.ok(Math.abs(ring.rotation.z - z0 - 0.12) < 1e-9, 'the ring spins at 0.12 rad/s again');
    await wait(1900); // the reveal takes the overlay away after its fade
    assert.equal(openRoots.size, 0, 'the overlay is removed');
    assert.equal(keyListeners.size, 0, 'the skip listener is removed');
  });

  await okAsync('a key before 1 s does not skip; after 1 s it goes straight to the fade', async () => {
    const game = filmGame();
    const p = film.playBoardFilm(game);
    const cam = THREE_CAM();
    const press = () => { for (const fn of [...keyListeners]) fn({ code: 'Space', preventDefault() {} }); };
    press();
    await Promise.resolve();
    assert.equal(game.cinematic.t, 0, 'too early to skip');
    drive(game, cam, 1.2);
    await wait(1050); // the skip arms after 1 s
    press();
    await Promise.resolve();
    assert.ok(game.cinematic.t >= 6, `skipped to ${game.cinematic.t}`);
    drive(game, cam, film.FILM_S + 0.01);
    await p;
    await wait(1900);
    assert.equal(keyListeners.size, 0);
    assert.equal(openRoots.size, 0);
  });
} finally {
  await vite.close();
  delete globalThis.document;
  delete globalThis.window;
}
console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
