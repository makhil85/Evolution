// Chapter 6's arrival cutscene (src/space/ch6/arrival.js): the shot list, the
// captions at both Levels, the first-time flag, and the whole scene run against
// a fake game (no WebGL, no DOM: a stub that keeps the classes and the children).
//
//   node scripts/test-cutscenes-ch6.mjs
//
// Checks: the scene is 20-35 s; its captions sit inside it, do not overlap, and
// have both a Level 4 and a Level 1 text; the flag is per Level; the scene runs to
// its end with the camera and her ship finite; her ship ends at the origin (the
// chase view's start); flight is paused, controls are off during it and back on
// after, the far belt is hidden during it and put back; everything it adds is
// removed from the scene; and the skip (armed after 1.5 s) ends it early.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const okAsync = async (name, fn) => { await fn(); passed += 1; console.log(`  ok  ${name}`); };

// --- stand-ins for the browser: a 2-D canvas that draws nothing, DOM elements that keep classes and children.
const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
  set() { return true; },
});
const makeEl = (tag = 'div') => {
  const set = new Set();
  return {
    tagName: tag, className: '', textContent: '', innerHTML: '', style: {}, children: [],
    classList: { add: (c) => set.add(c), remove: (c) => set.delete(c), toggle: (c, on) => (on ? set.add(c) : set.delete(c)), contains: (c) => set.has(c) },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    setAttribute() {},
    querySelector() { return makeEl(); },
    getContext: () => ctx2d,
  };
};
const handlers = [];
globalThis.document = { createElement: (tag) => makeEl(tag), head: makeEl('head'), body: makeEl('body') };
globalThis.window = {
  addEventListener: (type, fn) => handlers.push({ type, fn }),
  removeEventListener: (type, fn) => { const i = handlers.findIndex((h) => h.type === type && h.fn === fn); if (i >= 0) handlers.splice(i, 1); },
};
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
// Reduced motion is off unless a test says otherwise.
delete globalThis.matchMedia;

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const THREE = await vite.ssrLoadModule('three');
  const arrival = await vite.ssrLoadModule('/src/space/ch6/arrival.js');
  const { ARRIVAL_DURATION, ARRIVAL_CAPTIONS, ARRIVAL_TITLE, arrivalSeenKey, arrivalSeen, playCh6Arrival } = arrival;

  console.log('shot list');
  ok('the scene is 20-35 s', () => {
    assert.ok(ARRIVAL_DURATION >= 20 && ARRIVAL_DURATION <= 35, `${ARRIVAL_DURATION} s`);
  });
  ok('captions sit inside the scene and do not overlap', () => {
    let last = 0;
    for (const c of ARRIVAL_CAPTIONS) {
      assert.ok(c.from >= 0 && c.to <= ARRIVAL_DURATION && c.from < c.to, `window ${c.from}-${c.to}`);
      assert.ok(c.from >= last, `caption at ${c.from} overlaps the one before`);
      last = c.to;
    }
  });
  ok('every caption has both a Level 4 and a Level 1 text (short words for Level 1)', () => {
    assert.ok(ARRIVAL_CAPTIONS.length >= 2);
    for (const c of ARRIVAL_CAPTIONS) {
      const [l4, l1] = c.text;
      assert.ok(typeof l4 === 'string' && l4.length > 0, 'Level 4 text');
      assert.ok(typeof l1 === 'string' && l1.length > 0, 'Level 1 text');
      assert.ok(l1.length < l4.length, `Level 1 is not shorter: "${l1}"`);
    }
  });
  ok('the chapter caption is the lead\'s sentence (Level 4)', () => {
    assert.equal(ARRIVAL_CAPTIONS[1].text[0], 'Everything we need for a starship is here: ice for water and fuel, metal for the ship, rock for a shield.');
  });
  ok('the title card has both Levels', () => {
    for (const k of ['eyebrow', 'title', 'sub']) assert.ok(ARRIVAL_TITLE[k][0] && ARRIVAL_TITLE[k][1], k);
  });

  console.log('first time only');
  ok('the flag is per Level and starts unseen', () => {
    assert.equal(arrivalSeenKey(4), 'rocket_village_seen_ch6_arrival_L4');
    assert.equal(arrivalSeenKey(1), 'rocket_village_seen_ch6_arrival_L1');
    assert.equal(arrivalSeen(), false);
  });

  // A fake game: her ship, a far belt, the controls and the flags the scene touches.
  const makeGame = () => {
    const scene = new THREE.Scene();
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);
    const belt = { group: new THREE.Group() };
    scene.add(belt.group);
    const shipView = { group: shipGroup, throttle: 0, waved: 0, setThrottle(v) { this.throttle = v; }, girlWave() { this.waved += 1; } };
    const controls = { enabled: true, setEnabled(b) { this.enabled = b; } };
    const r = 11800; const phase = 0.4;
    const game = { scene, shipView, controls, belt, paused: false, warpIndex: 2, cinematic: null, ship: { x: r * Math.cos(phase), z: r * Math.sin(phase), angle: 0.7 } };
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 400000);
    return { game, scene, shipGroup, belt, shipView, controls, camera };
  };
  const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

  console.log('the scene');
  await okAsync('it runs to its end and puts everything back', async () => {
    const { game, scene, shipGroup, belt, shipView, controls, camera } = makeGame();
    const sceneKids = scene.children.length;
    const p = playCh6Arrival(game);
    assert.equal(game.paused, true, 'flight paused');
    assert.equal(controls.enabled, false, 'controls off');
    assert.equal(game.warpIndex, 0, 'time warp off');
    assert.equal(belt.group.visible, false, 'the far belt is hidden from the start of the scene');
    assert.ok(game.cinematic && game.cinematic.calm, 'a calm cinematic is set');
    const dt = 1 / 60;
    let frames = 0; let beltHidden = false; let shipAtEnd = null; let midShip = null;
    while (game.cinematic && frames < 60 * 45) {
      game.cinematic.apply(dt, camera, {});
      frames += 1;
      const t = game.cinematic ? game.cinematic.t : ARRIVAL_DURATION;
      if (!beltHidden && game.cinematic) beltHidden = belt.group.visible === false;
      assert.ok(finite(camera.position), `camera finite at frame ${frames}`);
      assert.ok(Number.isFinite(camera.quaternion.x) && Number.isFinite(camera.quaternion.w), 'camera rotation finite');
      assert.ok(finite(shipGroup.position), 'her ship finite');
      if (Math.abs(t - 10) < dt / 2) midShip = shipGroup.position.clone();
      if (Math.abs(t - 25) < dt / 2) shipAtEnd = shipGroup.position.clone();
    }
    assert.ok(frames >= 60 * 27 && frames <= 60 * 29, `${frames} frames at 60 fps`);
    assert.ok(beltHidden, 'the far belt was hidden during the scene');
    assert.ok(midShip && midShip.length() > 1, 'her ship is out on its path at 10 s');
    assert.ok(shipAtEnd && shipAtEnd.length() < 1e-6, `her ship has arrived at the origin: ${shipAtEnd?.length()}`);
    assert.ok(shipView.waved >= 1, 'the girl waves at the rock');
    await p;
    assert.equal(game.cinematic, null, 'cinematic cleared');
    assert.equal(game.paused, false, 'flight resumes');
    assert.equal(controls.enabled, true, 'controls back');
    assert.equal(belt.group.visible, true, 'belt put back');
    assert.equal(scene.children.length, sceneKids + 0, `scene children after: ${scene.children.length} (before ${sceneKids})`);
    assert.ok(shipGroup.position.length() < 1e-9, 'her ship back at the origin');
    assert.equal(arrivalSeen(), true, 'the first-time flag is set');
  });

  await okAsync('a second visit to the same Level does not need the scene (the flag is set)', async () => {
    assert.equal(arrivalSeen(), true);
  });

  await okAsync('the skip (Space, after 1.5 s) ends it early, and an early press does nothing', async () => {
    store.clear();
    const { game, camera, controls } = makeGame();
    const p = playCh6Arrival(game);
    const dt = 1 / 60;
    const press = () => {
      for (const h of handlers.filter((x) => x.type === 'keydown')) h.fn({ code: 'Space', preventDefault() {} });
    };
    for (let i = 0; i < 60; i++) game.cinematic.apply(dt, camera, {});
    press(); // at 1.0 s: not armed yet
    assert.ok(game.cinematic, 'an early press does not skip');
    await new Promise((r) => setTimeout(r, 1600)); // the skip arms after 1.5 s of real time
    press();
    await Promise.resolve(); // the skip promise's then() runs
    let frames = 0;
    while (game.cinematic && frames < 60 * 10) { game.cinematic.apply(dt, camera, {}); frames += 1; }
    await p;
    assert.equal(game.cinematic, null, 'skipped to the end');
    assert.ok(frames < 60 * 4, `the skip took ${frames} frames (the hand-back only)`);
    assert.equal(controls.enabled, true, 'controls back after a skip');
    assert.equal(handlers.filter((x) => x.type === 'keydown').length, 0, 'the key listener is removed');
  });

  await okAsync('reduced motion: the scene still runs, the ship is already at the origin', async () => {
    store.clear();
    globalThis.matchMedia = () => ({ matches: true });
    try {
      const { game, shipGroup, camera } = makeGame();
      const p = playCh6Arrival(game);
      const dt = 1 / 60;
      for (let i = 0; i < 60; i++) game.cinematic.apply(dt, camera, {});
      assert.ok(shipGroup.position.length() < 1e-9, 'she is already at the origin');
      let frames = 60;
      while (game.cinematic && frames < 60 * 40) { game.cinematic.apply(dt, camera, {}); frames += 1; }
      await p;
      assert.ok(frames >= 60 * 27 && frames <= 60 * 29, `${frames} frames`);
    } finally {
      delete globalThis.matchMedia;
    }
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
