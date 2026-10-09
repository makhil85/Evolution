// Chapter 7 and aboard: the starship is her craft, and the board film before the walks.
//
//   node scripts/test-ch7-board.mjs
//
// Aboard (game.aboardStarship): every Chapter 7 step sets it as it enters, and missions.js sets
// it from the step's own `aboard` before the enter (so a reload or a Jump gets it before the first
// frame). Chapter 6: aboard from the dock (Part A's first step) on, not before. The slingshot card's
// craft is the starship after the dock (ch6/slingshot.js shipDart).
// The board film: its length and its skip (after 1 s, a hand-over from where the camera is), the
// once-per-part rule, the last frame on the window, the hand-over snapshot that fades out over
// the walk (no black), and that everything is put back. The film runs against a stub game with a
// small stand-in for the DOM and the window, driven frame by frame the way main.js drives it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// A stand-in DOM: what cinematics.js's overlay and the film's picture touch. Everything the
// film appends to the body is tracked, so the dispose check can see what is left on the page.
const bodyNodes = new Set();
const bodyClasses = new Set();
const keyListeners = new Set();
function fakeNode(tag) {
  const node = {
    tag,
    className: '',
    textContent: '',
    innerHTML: '',
    src: '',
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(c) { return c; },
    querySelector() { return fakeNode('div'); },
    remove() { bodyNodes.delete(node); },
  };
  return node;
}
// The overlay root is the node with className 'cine'; it joins the body's nodes when appended.
const realCreate = (tag) => {
  const n = fakeNode(tag);
  let cls = '';
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = v; } });
  return n;
};
globalThis.document = {
  createElement: realCreate,
  head: { appendChild() {} },
  body: {
    classList: { add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c), toggle() {} },
    appendChild(n) { bodyNodes.add(n); return n; },
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
  const { shipDart } = await vite.ssrLoadModule('/src/space/ch6/slingshot.js');

  // The enter wrappers set the aboard flag before anything else, so each check reads it
  // straight after the call, without waiting for the step's own enter (a timed cutscene).
  // The stub has no scene, so showStarship stops the enter there.
  const enterFlag = (game, st) => { game.aboardStarship = false; st.enter(game).catch(() => {}); return game.aboardStarship; };
  const stubGame = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {}, aboardStarship: false };
  const steps = ch7Steps(stubGame);

  console.log('aboard the starship');
  ok('every Chapter 7 step makes her aboard: her small rocket is not drawn as it enters', () => {
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
  ok('the flag is set from each step before its enter, so a reload or a Jump gets it before the first frame', () => {
    // missions.js: the step's own flag goes in beside the per-step fields, before `await step.enter`.
    const src = readFileSync(new URL('../src/space/missions.js', import.meta.url), 'utf8');
    const line = src.indexOf('game.aboardStarship = step.aboard');
    const enter = src.indexOf('await step.enter?.(game)', line);
    assert.ok(line > 0, 'missions.js sets game.aboardStarship from step.aboard');
    assert.ok(enter > line, 'the flag is set before the step enter runs');
    for (const st of [...steps, ...ch6]) assert.equal(typeof st.aboard, 'boolean', `${st.id} has an aboard value`);
    assert.equal(ch6[dock].aboard, true, 'the dock step is aboard');
    assert.equal(ch6[dock - 1].aboard, false, 'the step before the dock is not');
  });
  ok('the walk hook is set, so a walk from the flight view can play its film', () => {
    assert.equal(typeof stubGame.beforeWalk, 'function');
  });

  console.log('the slingshot craft');
  ok('after the dock the slingshot card draws the starship, not the grey rock', () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(String(k)); return undefined; }),
      set: (t, k, v) => { calls.push(`${String(k)}=${v}`); t[k] = v; return true; },
    });
    shipDart(ctx, 0, 0, 0, true, 0);
    assert.ok(calls.includes('fillStyle=#f4f1ea'), 'the cream hull');
    assert.ok(calls.includes('strokeStyle=#ff9a3c'), 'the orange ring');
    assert.ok(calls.includes('fillRect'), 'the spine and the cap');
    assert.ok(!calls.some((c) => c.includes('#a9a39a')), 'no rock grey');
  });

  console.log('board film');
  ok('the film lasts about 6-8 s', () => {
    assert.ok(film.FILM_S >= 6 && film.FILM_S <= 8, `FILM_S is ${film.FILM_S}`);
  });
  ok('skippable after 1 s, as the other films', () => {
    assert.equal(film.SKIP_AFTER_MS, 1000);
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
  const filmGame = () => {
    const g = {
      scene: new THREE.Scene(), paused: false, warpIndex: 1,
      controls: { enabled: null, setEnabled(v) { this.enabled = v; } },
      missions: { step: { act: 2 } },
      snapshots: 0,
      frameSnapshot() { g.snapshots++; return 'data:image/png;base64,QUJD'; },
    };
    return g;
  };
  // Drives the film the way main.js does: one frame per dt, until the clock is past `until`
  // (or the film has handed over).
  const drive = (game, cam, until, dt = 1 / 30) => {
    while (game.cinematic && game.cinematic.t < until) game.cinematic.apply(dt, cam);
  };
  const windowOf = (star) => {
    const ring = star.getObjectByName('habitat-ring');
    return ring.localToWorld(new THREE.Vector3(62.12 * Math.cos(Math.PI / 3), 62.12 * Math.sin(Math.PI / 3), 0));
  };

  await okAsync('the last frame is on the window: the camera is about 3 m off the glass, looking into it', async () => {
    const game = filmGame();
    const p = film.playBoardFilm(game);
    const cam = THREE_CAM();
    drive(game, cam, film.FILM_S + 0.01);
    assert.equal(game.snapshots, 1, 'the hand-over took one picture');
    const star = game._starship.ship.group;
    const k = star.scale.x;
    const win = windowOf(star);
    const off = cam.position.distanceTo(win) / k;
    assert.ok(off > 2.5 && off < 3.5, `camera ${off.toFixed(2)} m from the glass`);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const toWin = win.clone().sub(cam.position).normalize();
    assert.ok(fwd.dot(toWin) > 0.999, `camera looks ${fwd.dot(toWin).toFixed(4)} along the window`);
    await p;
    await wait(1600); // the picture's own timers run out before the next test
  });

  await okAsync('the hand-over has no black: the picture fades out over the walk, and everything is put back', async () => {
    const game = filmGame();
    const p = film.playBoardFilm(game);
    const cam = THREE_CAM();
    assert.equal(game.paused, true, 'flight is paused under the film');
    assert.equal(game.warpIndex, 0);
    drive(game, cam, film.FILM_S + 0.01);
    const img = [...bodyNodes].find((n) => n.tag === 'img');
    assert.ok(img, 'the picture of the last frame is on the page');
    assert.equal(img.src, 'data:image/png;base64,QUJD');
    assert.ok(String(img.style.transition).includes('opacity'), 'it fades by opacity');
    assert.equal(img.style.opacity, undefined, 'it starts fully shown');
    assert.equal([...bodyNodes].filter((n) => n.className === 'cine').length, 0, 'the film overlay is gone at the hand-over');
    await p;
    assert.equal(game.cinematic, null, 'the cinematic is cleared');
    assert.equal(game.paused, false, 'pause is put back');
    assert.equal(game.controls.enabled, true, 'her controls are back');
    assert.equal(bodyClasses.has('in-cinematic'), false, 'the HUD comes back');
    await wait(200);
    assert.equal(img.style.opacity, '0', 'the picture starts to fade as the walk draws');
    // The ring turns again at showStarship's spin after the film.
    const ring = game._starship.ship.group.getObjectByName('habitat-ring');
    const z0 = ring.rotation.z;
    game._starship.ship.update(1, 1);
    assert.ok(Math.abs(ring.rotation.z - z0 - 0.12) < 1e-9, 'the ring spins at 0.12 rad/s again');
    await wait(1600); // the picture is taken off the page when its fade is done
    assert.equal(bodyNodes.size, 0, 'nothing is left on the page');
    assert.equal(keyListeners.size, 0, 'the skip listener is removed');
  });

  await okAsync('a key before 1 s does not skip; after 1 s it hands over from where the camera is, with no jump', async () => {
    const game = filmGame();
    const p = film.playBoardFilm(game);
    const cam = THREE_CAM();
    const press = () => { for (const fn of [...keyListeners]) fn({ code: 'Space', preventDefault() {} }); };
    press();
    await Promise.resolve();
    assert.equal(game.cinematic.t, 0, 'too early to skip');
    drive(game, cam, 1.2);
    const before = cam.position.clone();
    await wait(1050); // the skip arms after 1 s
    press();
    await Promise.resolve();
    // The next frame hands over at this clock, not at the end of the film (no jump in time).
    game.cinematic.apply(1 / 30, cam);
    assert.ok(game.cinematic === null || game.cinematic.t < 1.6, `handed over at ${game.cinematic?.t}`);
    assert.equal(game.snapshots, 1, 'the hand-over took its picture');
    assert.ok(cam.position.distanceTo(before) < 0.05, `camera moved ${cam.position.distanceTo(before).toFixed(3)} on the skip`);
    await p;
    await wait(1600);
    assert.equal(keyListeners.size, 0);
    assert.equal(bodyNodes.size, 0);
  });
} finally {
  await vite.close();
  delete globalThis.document;
  delete globalThis.window;
}
console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
