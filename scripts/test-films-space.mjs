// Chapters 4-7's space films: every caption, title card and label stays on screen
// for its reading time (readMs: 5-10 s, plus the fade), at both Levels. The Chapter 7
// opening waits at the star map until Continue is clicked; a grown-up's Skip still ends it.
//
//   node scripts/test-films-space.mjs
//
// Each Level runs in its own child process: level.js reads the launcher's profile
// once, when it loads. A child plays each film through its whole timeline against a
// fake game and a stub DOM. The stub keeps the text and the on-screen state of every
// card, caption and label, and a fake clock (60 frames a second; timers fire on it)
// times how long each one is up. The on-screen time is measured from what the film
// shows, not copied from the film's own timings.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LEVEL = process.env.RV_FILMS_LEVEL;

if (!LEVEL) {
  let failed = 0;
  for (const level of ['4', '1']) {
    console.log(`Level ${level}${level === '1' ? ' (Level 1: 6-7 year olds)' : ' (Level 4: 9-10 year olds)'}`);
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, RV_FILMS_LEVEL: level } });
    } catch { failed += 1; }
  }
  process.exit(failed ? 1 : 0);
}

await main();

async function main() {
  const level1 = LEVEL === '1';
  let passed = 0;
  const ok = (name) => { passed += 1; console.log(`  ok  ${name}`); };

  // --- stand-ins for the browser -------------------------------------------------------
  const store = new Map([['rocket_village_profile', JSON.stringify({ difficulty: level1 ? 1 : 4 })]]);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const ctx2d = new Proxy({}, {
    get(_, k) {
      if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return () => {};
    },
    set() { return true; },
  });
  // Every element the films make, in order: the test reads their text and their on-screen state.
  const created = [];
  // A style object that reads cssText the way the browser does (so display:none and opacity:0 start hidden).
  const makeStyle = () => {
    const style = {};
    Object.defineProperty(style, 'cssText', {
      set(v) { for (const decl of String(v).split(';')) { const i = decl.indexOf(':'); if (i > 0) style[decl.slice(0, i).trim()] = decl.slice(i + 1).trim(); } },
      enumerable: false,
    });
    return style;
  };
  const makeEl = (tag = 'div') => {
    const classes = new Set();
    const el = {
      tagName: tag, className: '', textContent: '', innerHTML: '', style: makeStyle(), children: [], _q: new Map(), _listeners: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c, on) => { if (on === undefined ? !classes.has(c) : on) classes.add(c); else classes.delete(c); return classes.has(c); },
        contains: (c) => classes.has(c),
      },
      appendChild(c) { this.children.push(c); return c; },
      append(...cs) { this.children.push(...cs); },
      remove() { this.removed = true; },
      setAttribute() {},
      addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
      querySelector(sel) { if (!this._q.has(sel)) this._q.set(sel, makeEl()); return this._q.get(sel); },
      getContext: () => ctx2d,
    };
    created.push(el);
    return el;
  };
  const handlers = [];
  globalThis.document = { createElement: (tag) => makeEl(tag), head: makeEl('head'), body: makeEl('body') };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (type, fn) => handlers.push({ type, fn }),
    removeEventListener: (type, fn) => { const i = handlers.findIndex((h) => h.type === type && h.fn === fn); if (i >= 0) handlers.splice(i, 1); },
  };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  delete globalThis.matchMedia;
  globalThis.requestAnimationFrame = () => 0;

  const realTimeout = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const THREE = await vite.ssrLoadModule('three');
    const { readMs } = await vite.ssrLoadModule('/src/play/readTime.js');
    const CIN = await vite.ssrLoadModule('/src/space/cinematics.js');
    const CH5O = await vite.ssrLoadModule('/src/space/ch5/opening.js');
    const CH5E = await vite.ssrLoadModule('/src/space/ch5/ending.js');
    const CH5EDGE = await vite.ssrLoadModule('/src/space/ch5/edge.js');
    const CH5POLE = await vite.ssrLoadModule('/src/space/ch5/saturnPole.js');
    const CH6O = await vite.ssrLoadModule('/src/space/ch6/opening.js');
    const CH6A = await vite.ssrLoadModule('/src/space/ch6/arrival.js');
    const CH6D = await vite.ssrLoadModule('/src/space/ch6/driveOn.js');
    const CH7O = await vite.ssrLoadModule('/src/space/ch7/opening.js');
    const CH7C = await vite.ssrLoadModule('/src/space/ch7/cruise.js');
    const STAR = await vite.ssrLoadModule('/src/space/ch7/starMap.js');

    // --- the fake clock: timers fire on the frame clock --------------------------------------
    const DT = 1 / 60;
    let clock = 0;
    const timers = new Map();
    let timerId = 1;
    globalThis.setTimeout = (fn, ms = 0) => { const id = timerId++; timers.set(id, { at: clock + ms / 1000, fn }); return id; };
    globalThis.clearTimeout = (id) => { timers.delete(id); };
    const fireTimers = () => {
      for (const [id, tm] of [...timers]) if (tm.at <= clock + 1e-9) { timers.delete(id); tm.fn(); }
    };

    // --- what is on screen -----------------------------------------------------------------
    // Cards (the title's eyebrow, name and sub), captions, the edge labels: text runs.
    // The speed dial, the ship clock and the plan strip: meters (their words stay up).
    // The Continue button: the star map's wait.
    const snapshot = (el) => {
      switch (el.className) {
        case 'cine': {
          const title = el._q.get('.cine__title');
          if (!title) return null;
          const label = [el._q.get('.cine__eyebrow')?.textContent, el._q.get('.cine__name')?.children.map((c) => c.textContent).join(''), el._q.get('.cine__sub')?.textContent]
            .filter(Boolean).join(' ');
          return { on: title.classList.contains('is-shown'), label };
        }
        case 'c7-caption': return { on: el.style.opacity === '1', label: el.textContent };
        case 'c7-star-label': return { on: el.style.opacity === '1', label: `${el.children[0].textContent} ${el.children[1].textContent}` };
        case 'c6a-cap': return { on: el.classList.contains('is-on'), label: el.textContent };
        case 'c5-edge-label': return { on: Number(el.style.opacity) === 1, label: el.textContent };
        case 'c7-dial': return { on: el.style.opacity === '1', label: el.children[1].textContent, meter: true };
        case 'c6-dial': return { on: el.style.opacity === '1', label: 'km/s', meter: true };
        case 'c7-clock': return { on: el.style.opacity === '1', label: el.children[0].textContent, meter: true };
        case 'c7-plan': return { on: el.style.opacity === '1', label: el.children.map((c) => c.textContent).join(' '), meter: true };
        default: return null;
      }
    };

    const makeGame = () => {
      const scene = new THREE.Scene();
      const group = new THREE.Group();
      scene.add(group);
      const body = new THREE.Group();
      group.add(body);
      const shipView = {
        group, body, throttle: 0,
        setThrottle(v) { this.throttle = v; },
        girlWave() {},
        setLegs() {},
        setWingsFolded() {},
        releaseGirl() { return { group: new THREE.Group(), byName: {} }; },
        seatGirl() {},
      };
      const r = 11800;
      const toasts = [];
      return {
        game: {
          scene, shipView, controls: { enabled: true, setEnabled(b) { this.enabled = b; } },
          ship: { x: r * Math.cos(0.4), z: r * Math.sin(0.4), angle: 0.7, t: 0, vx: 0, vz: 0 },
          paused: false, warpIndex: 2, cinematic: null, belt: { group: new THREE.Group() },
          route: [{ x: r * Math.cos(0.1), z: r * Math.sin(0.1) }, { x: r * Math.cos(0.3), z: r * Math.sin(0.3) }, { x: r * Math.cos(0.4), z: r * Math.sin(0.4) }],
          hud: { toast: (text, opts) => toasts.push({ text, ms: opts?.ms }) },
          flightCam: { shake() {} },
        },
        toasts,
      };
    };
    const STATES = { earth: { x: 0, z: 0 }, jupiter: { x: 9000, z: -9000 }, saturn: { x: 0, z: 0 }, sun: { x: 0, z: 0 } };

    // Plays one film from start to end on the fake clock. Returns its text runs,
    // meter runs, toasts and, for a film with a Continue button, when it showed and was answered.
    const playFilm = async (play, { answer = 'click' } = {}) => {
      const { game, toasts } = makeGame();
      const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 400000);
      const base = created.length;
      const start = clock;
      const finished = play(game);
      let settled = false;
      finished.then(() => { settled = true; });
      const open = new Map();
      const runs = [];
      const sampleNow = () => {
        for (const el of created.slice(base)) {
          const s = snapshot(el);
          if (!s) continue;
          let r = open.get(el);
          if (r && (!s.on || r.label !== s.label)) { r.end = clock; runs.push(r); open.delete(el); r = null; }
          if (s.on && !r) { r = { label: s.label, meter: !!s.meter, start: clock, end: null }; open.set(el, r); }
        }
      };
      const cont = { shownAt: null, answeredAt: null };
      const contEl = () => created.slice(base).find((el) => el.className === 'c7-continue');
      let contSince = null;
      let frames = 0;
      while (game.cinematic && frames < 60 * 150) {
        game.cinematic.apply(DT, camera, STATES);
        camera.updateMatrixWorld(); // what the render does after each frame: the next frame projects with it
        clock += DT;
        frames += 1;
        fireTimers();
        sampleNow();
        await null; // let the film's own promise callbacks (skip, finish) run
        const b = contEl();
        if (b && b.style.display !== 'none') {
          contSince ??= clock;
          cont.shownAt ??= clock;
          if (cont.answeredAt === null && clock - contSince >= 4) {
            if (answer === 'click') { cont.answeredAt = clock; for (const fn of b._listeners.click || []) fn({ stopPropagation() {} }); }
            else { cont.answeredAt = clock; for (const h of handlers.filter((x) => x.type === 'keydown')) h.fn({ code: 'Space', preventDefault() {} }); }
          }
        }
      }
      for (const r of open.values()) { r.end = clock; runs.push(r); }
      assert.ok(!game.cinematic, 'the film ended');
      assert.ok(frames < 60 * 150, 'the film ended within 150 s');
      await finished;
      assert.ok(settled, 'the film promise resolved');
      return { runs, toasts, cont, start, end: clock, frames, camera };
    };

    // A card, caption or label must stay up its reading time plus the fade in (cardSeconds).
    const reading = (text) => readMs(text) / 1000 + CIN.CARD_FADE_S;
    // Each text run must stay up at least its reading time plus the fade.
    const checkRuns = (name, runs, texts) => {
      const text = runs.filter((r) => !r.meter);
      assert.equal(text.length, texts, `${name}: ${text.length} text runs on screen, expected ${texts}: ${text.map((r) => `"${r.label}"`).join(', ')}`);
      for (const r of text) {
        assert.ok(r.label.length > 0, `${name}: a card with no words`);
        const need = reading(r.label);
        const dur = r.end - r.start;
        assert.ok(dur + 1e-6 >= need, `${name}: "${r.label}" is up ${dur.toFixed(2)} s, its reading time is ${need.toFixed(2)} s`);
      }
      for (const r of runs.filter((x) => x.meter)) {
        const need = reading(r.label);
        const dur = r.end - r.start;
        assert.ok(dur + 1e-6 >= need, `${name}: meter "${r.label}" is up ${dur.toFixed(2)} s, needs ${need.toFixed(2)} s`);
      }
      return text;
    };

    // --- the films ---------------------------------------------------------------------------
    const FILMS = [
      { id: 'Chapter 4 opening (title card)', play: (g) => CIN.playIntro(g), texts: 1 },
      { id: 'Chapter 4 ending (Mission complete)', play: (g) => CIN.playOutro(g), texts: 1 },
      { id: 'Zero gravity (Act 1)', play: (g) => CIN.playZeroG(g), texts: 1 },
      { id: 'Chapter 5 opening', play: (g) => CH5O.playCh5Opening(g), texts: 1 },
      { id: 'Chapter 5 ending (Drilling Rock B, test fire)', play: (g) => CH5E.playCh5Ending(g), texts: 2 },
      { id: 'Chapter 5 edge (labels)', play: (g) => CH5EDGE.playEdgePullBack(g), texts: 6 },
      { id: 'Chapter 5 Saturn pole', play: (g) => CH5POLE.playPolePass(g), texts: 1 },
      { id: 'Chapter 6 opening', play: (g) => CH6O.playCh6Opening(g), texts: 1 },
      { id: 'Chapter 6 arrival (captions)', play: (g) => CH6A.playCh6Arrival(g), texts: 3 },
      { id: 'Chapter 6 drive on (next card)', play: (g) => CH6D.playDriveOn(g), texts: 2 },
      { id: 'Chapter 7 cruise (captions, dial, clock, plan)', play: (g) => CH7C.playCh7Cruise(g), texts: 4 },
    ];
    // Chapter 7's opening has its own checks below (the Continue wait), so it is not in the table.

    console.log('films: every card, caption and label holds for its reading time');
    for (const f of FILMS) {
      const r = await playFilm(f.play);
      const text = checkRuns(f.id, r.runs, f.texts);
      const shortest = Math.min(...text.map((x) => (x.end - x.start) - reading(x.label)));
      ok(`${f.id}: ${text.length} text(s) on screen, each for at least its reading time (least spare ${shortest.toFixed(2)} s)`);
      for (const t of r.toasts) {
        assert.ok(t.ms >= readMs(t.text), `${f.id}: toast "${t.text}" ${t.ms} ms, needs ${readMs(t.text)} ms`);
      }
    }

    console.log('Chapter 7 holodeck: its two captions');
    {
      // The holodeck (Part D) has no film clock of its own here: it is driven like the lens test drives it.
      const H = await vite.ssrLoadModule('/src/space/ch7/holodeck.js');
      const base = created.length;
      const holo = H.buildHolodeckScene({});
      holo.start();
      const title = created.slice(base).find((el) => el.className === 'holo-caption').querySelector('.holo-title');
      const changes = [];
      let last = null;
      let now = 0;
      for (let i = 0; i < 60 * 60 && holo.debug.phase() !== 'done'; i++) {
        holo.tick(DT, { turn: 0, thrust: 0 }, { dx: 0, dy: 0, wheel: 0, dragging: false }, false);
        now = (i + 1) * DT;
        if (title.textContent !== last) { last = title.textContent; changes.push({ text: last, at: now }); }
      }
      holo.dispose?.();
      assert.equal(changes.length, 2, `the holodeck shows ${changes.length} captions, expected 2`);
      assert.equal(changes[0].text, H.CAPTIONS.load);
      assert.equal(changes[1].text, H.CAPTIONS.quasar);
      const loadS = changes[1].at - changes[0].at;
      const quasarS = now - changes[1].at;
      assert.ok(loadS + 1e-6 >= reading(H.CAPTIONS.load), `loading words up ${loadS.toFixed(2)} s, needs ${reading(H.CAPTIONS.load).toFixed(2)} s`);
      assert.ok(quasarS + 1e-6 >= reading(H.CAPTIONS.quasar), `quasar words up ${quasarS.toFixed(2)} s, needs ${reading(H.CAPTIONS.quasar).toFixed(2)} s`);
      ok(`holodeck: loading words up ${loadS.toFixed(1)} s, quasar words up ${quasarS.toFixed(1)} s (each at least its reading time)`);
    }

    console.log('Chapter 7 opening: the star map waits for Continue');
    {
      const caption = STAR.STAR_MAP_CAPTION;
      const r = await playFilm((g) => CH7O.playCh7Opening(g), { answer: 'click' });
      // The title, the caption and the five star labels (each up from its reveal to the end).
      const text = checkRuns('Chapter 7 opening', r.runs, 7);
      const cap = text.find((x) => x.label === caption);
      assert.ok(cap, 'the star map caption is on screen');
      const capAt = cap.start - r.start;
      assert.ok(capAt > 23.9 && capAt < 24.1, `the caption comes at 24 s (it came at ${capAt.toFixed(2)} s)`);
      assert.ok(r.cont.shownAt !== null, 'a Continue button is shown after the caption');
      const readFor = readMs(caption) / 1000 + CIN.CARD_FADE_S;
      assert.ok(r.cont.shownAt - cap.start + 1e-6 >= readFor, `Continue waits until the caption has had ${readFor.toFixed(1)} s (it appeared after ${(r.cont.shownAt - cap.start).toFixed(2)} s)`);
      assert.ok(r.cont.answeredAt !== null, 'the film waited for the click');
      // The star labels follow their stars: the camera is still at the hold, so each label sits
      // where its star projects (within a pixel), or is hidden when the star is behind the camera.
      r.camera.updateMatrixWorld();
      const starLabels = created.filter((el) => el.className === 'c7-star-label').slice(-STAR.NEIGHBOURS.length);
      assert.equal(starLabels.length, STAR.NEIGHBOURS.length, 'a label for each star');
      starLabels.forEach((el, i) => {
        const v = new THREE.Vector3(...STAR.starPlace(STAR.NEIGHBOURS[i])).project(r.camera);
        if (v.z > 1) { assert.equal(el.style.display, 'none', `${STAR.NEIGHBOURS[i].name[0]} hidden behind the camera`); return; }
        const m = /translate\((-?\d+)px, (-?\d+)px\)/.exec(el.style.transform || '');
        assert.ok(m, `${STAR.NEIGHBOURS[i].name[0]} has a position`);
        const ex = Math.round((v.x * 0.5 + 0.5) * innerWidth + 14); const ey = Math.round((-v.y * 0.5 + 0.5) * innerHeight - 30);
        assert.ok(Math.abs(Number(m[1]) - ex) <= 1 && Math.abs(Number(m[2]) - ey) <= 1, `${STAR.NEIGHBOURS[i].name[0]} label at (${m[1]}, ${m[2]}), its star is at (${ex}, ${ey})`);
      });
      ok(`the five star-map labels sit on their stars at the hold (within 1 px)`);
      assert.ok(r.end - r.cont.answeredAt <= 3, `the film ends within 3 s of Continue (${(r.end - r.cont.answeredAt).toFixed(2)} s)`);
      assert.ok(cap.end + 1e-6 >= r.cont.answeredAt, 'the caption stays up until Continue');
      ok(`caption at ${capAt.toFixed(1)} s, up ${(cap.end - cap.start).toFixed(1)} s (its reading time is ${readFor.toFixed(1)} s), then Continue; the film ends ${(r.end - r.cont.answeredAt).toFixed(1)} s after it`);
    }
    {
      const r = await playFilm((g) => CH7O.playCh7Opening(g), { answer: 'skip' });
      assert.ok(r.cont.answeredAt !== null, 'the grown-up skip key was pressed at the star map');
      assert.ok(r.end - r.cont.answeredAt <= 3, `the grown-up Skip ends the film within 3 s (${(r.end - r.cont.answeredAt).toFixed(2)} s)`);
      ok('the grown-up Skip still ends the Chapter 7 opening at the star map');
    }

    console.log(`  ${passed} passed`);
  } finally {
    globalThis.setTimeout = realTimeout;
    globalThis.clearTimeout = realClear;
    await vite.close();
  }
}
