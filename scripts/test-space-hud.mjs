// The flight HUD's controls (lead 2026-10-09, the Chapter 5 screenshot):
//
//   node scripts/test-space-hud.mjs
//
// 1. The on-screen pad (touch.js) shows only on a touch screen with no mouse or
//    trackpad: a laptop with a touch screen keeps no pad; ?touch=1 forces it.
// 2. The pad has no warp, camera or pause buttons and no key letters.
// 3. The left instrument column has the camera view button under the Fuel panel,
//    after the warp panel, and it names the view the camera is in.
// 4. Frozen is the pause: Space (or a steering key) while frozen carries on, and
//    not under a card; F still freezes and carries on.
// 5. Auto-turn is always shown in flight, next to Autopilot, with no key letter,
//    and it hides in a cut-scene or on foot; the view button names a walk's view.
//
// Stub DOM and stub window, the same style as test-engine-cards.mjs. Not in the
// browser: the flame itself is checked by frames (see the PR).
import assert from 'node:assert/strict';

// --- DOM, storage and window stubs --------------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const keyListeners = [];
globalThis.addEventListener = (type, fn) => { keyListeners.push({ type, fn }); };
globalThis.removeEventListener = (type, fn) => {
  const i = keyListeners.findIndex((l) => l.type === type && l.fn === fn);
  if (i >= 0) keyListeners.splice(i, 1);
};
globalThis.window = globalThis;
globalThis.location = { reload() {}, search: '', href: 'http://x/' };
// The pointer and touch facts each case sets (matchMedia and navigator read them).
const pointer = { fine: false, coarse: false, touchPoints: 0 };
globalThis.matchMedia = (q) => ({
  matches: (q.includes('any-pointer: fine') && pointer.fine) || (q.includes('any-pointer: coarse') && pointer.coarse),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, get: () => ({ maxTouchPoints: pointer.touchPoints }) });

/** A stub element: enough for the HUD code (children, classes, listeners, styles). */
function node(tag = 'div') {
  const n = {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', hidden: false, type: '', title: '',
    style: {}, dataset: {}, children: [], parent: null, listeners: {}, attrs: {}, nodeValue: null,
    classList: {
      _s: new Set(),
      add(...cs) { for (const c of cs) this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { const want = on === undefined ? !this._s.has(c) : !!on; if (want) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    append(...cs) { for (const c of cs) this.appendChild(c); },
    insertBefore(c, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parent = this; return c;
    },
    get firstChild() { return this.children[0] || null; },
    replaceChildren() { this.children = []; },
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this);
      this.parent = null;
    },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, blur() {}, click() { for (const f of this.listeners.click || []) f({ type: 'click' }); },
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
  return n;
}
const body = node('body');
globalThis.document = {
  documentElement: { dataset: {} },
  body,
  head: node('head'),
  createElement: (tag) => node(tag),
  createElementNS: (ns, tag) => node(tag),
  createTextNode: (s) => { const n = node('#text'); n.nodeValue = String(s); n.textContent = String(s); return n; },
  // Only body-level cards are looked up (the Retry card, play layers, the host).
  querySelector: (sel) => body.children.find((n) => matchesSel(n, sel)) || null,
  addEventListener() {},
};
/** The selector forms the card code uses: `.cls`, `.cls:not([hidden])`, comma lists. */
function matchesSel(n, sel) {
  return sel.split(',').some((part) => {
    const m = /^\s*\.([\w-]+)(:not\(\[hidden\]\))?\s*$/.exec(part);
    if (!m) return false;
    if (!String(n.className).split(/\s+/).includes(m[1])) return false;
    return !(m[2] && n.hidden);
  });
}
/** A card on the page: `kind` is the class it is given. */
function card(kind) {
  const c = node('div');
  c.className = kind;
  body.appendChild(c);
  return c;
}
/** A key press: every keydown listener sees it. */
function press(code, extra = {}) {
  const ev = {
    type: 'keydown', code, key: code, repeat: false, ctrlKey: false, metaKey: false, altKey: false,
    target: null, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra,
  };
  for (const l of [...keyListeners]) if (l.type === 'keydown') l.fn(ev);
}
/** Every text in a subtree, depth first. */
function allText(n, out = []) {
  if (n.textContent) out.push(n.textContent);
  if (n.nodeValue) out.push(n.nodeValue);
  for (const c of n.children) allText(c, out);
  return out;
}
/** Every node in a subtree, depth first. */
function walk(n, out = []) {
  out.push(n);
  for (const c of n.children) walk(c, out);
  return out;
}

const vite = await (await import('vite')).createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { createTouchPad } = await vite.ssrLoadModule('/src/space/hud/touch.js');
const { createInstruments } = await vite.ssrLoadModule('/src/space/hud/instruments.js');
const { createFreezeButton } = await vite.ssrLoadModule('/src/space/freeze.js');
const { toggleBar } = await vite.ssrLoadModule('/src/space/hud/toggleBar.js');
const { createAimToggle } = await vite.ssrLoadModule('/src/space/aimToggle.js');

const results = [];
const check = (name, fn) => {
  try { fn(); results.push([true, name]); } catch (e) { results.push([false, `${name}\n       ${e.message}`]); }
};

// --- 1. the pad shows only with no mouse or trackpad ----------------------------
/** A fresh HUD root and the pad made on it, under the given pointers and address. */
function padFor({ fine = false, coarse = false, touchPoints = 0, search = '' }) {
  pointer.fine = fine; pointer.coarse = coarse; pointer.touchPoints = touchPoints;
  location.search = search;
  const root = node('div');
  const pad = createTouchPad(root, { controls: { press() {} } });
  return { pad, root };
}

check('1a. a desktop with a mouse (fine pointer) gets no pad', () => {
  const { pad, root } = padFor({ fine: true });
  assert.equal(pad.enabled, false);
  assert.equal(root.classList.contains('is-touch'), false);
  assert.equal(walk(root).some((n) => String(n.className).includes('sp-touch')), false, 'no pad nodes in the HUD');
});
check('1b. a laptop with a touch screen and a trackpad gets no pad', () => {
  assert.equal(padFor({ fine: true, coarse: false, touchPoints: 10 }).pad.enabled, false);
  assert.equal(padFor({ fine: true, coarse: true, touchPoints: 5 }).pad.enabled, false, 'a fine pointer wins over a coarse one');
});
check('1c. a tablet (coarse pointer, no mouse) gets the pad', () => {
  assert.equal(padFor({ coarse: true, touchPoints: 5 }).pad.enabled, true);
  assert.equal(padFor({ touchPoints: 5 }).pad.enabled, true, 'touch points alone, with no pointer query match');
});
check('1d. no touch and no fine pointer: no pad', () => {
  assert.equal(padFor({}).pad.enabled, false);
});
check('1e. ?touch=1 shows the pad with a fine pointer; ?touch=0 hides it on a tablet', () => {
  assert.equal(padFor({ fine: true, search: '?touch=1' }).pad.enabled, true);
  assert.equal(padFor({ coarse: true, touchPoints: 5, search: '?touch=0' }).pad.enabled, false);
});

// --- 2. the pad's buttons: directions and E / AIM only -------------------------
check('2. the pad has no warp, camera, rewind or pause buttons and no key letters', () => {
  const { root } = padFor({ coarse: true, touchPoints: 5 });
  const buttons = walk(root).filter((n) => n.tagName === 'BUTTON');
  const labels = buttons.map((b) => b.children[0]?.textContent);
  assert.deepEqual(labels.sort(), ['AIM', 'E', '▲', '▼', '▶', '◀'].sort());
  const text = buttons.flatMap((b) => allText(b)).join(' | ');
  assert.equal(/Warp|❚|↺|◉|Pause|Camera|Rewind/.test(text), false, `unexpected button text: ${text}`);
  assert.equal(walk(root).some((n) => String(n.className).includes('sp-touch__key')), false, 'no key corner labels');
  assert.equal(walk(root).some((n) => String(n.className).includes('sp-touch__small')), false, 'no small row');
});

// --- 3. the camera view button in the left column ----------------------------------
check('3a. the left column has the camera view panel under the Fuel panel, after warp', () => {
  const root = node('div');
  const ins = createInstruments(root, {});
  const kids = ins.leftColumn.children.map((c) => c.className);
  const fuel = kids.findIndex((c) => c.includes('sp-supplies'));
  const warp = kids.findIndex((c) => c.includes('sp-warp-panel'));
  const view = kids.findIndex((c) => c.includes('sp-view-panel'));
  assert.ok(fuel >= 0 && warp > fuel && view > warp, `order was ${kids.join(' / ')}`);
  assert.ok(ins.cameraButton && ins.cameraButton.className.includes('sp-view__btn'), 'the button is returned for main.js');
});
check('3b. the view button names the camera view and has no key letter', () => {
  const root = node('div');
  const ins = createInstruments(root, {});
  ins.update({ cameraMode: 'chase' });
  assert.equal(ins.cameraButton.textContent, 'Behind the ship');
  ins.update({ cameraMode: 'orbit' });
  assert.equal(ins.cameraButton.textContent, 'Free look');
  ins.update({ cameraMode: 'top' });
  assert.equal(ins.cameraButton.textContent, 'Top view');
  const all = allText(root).join(' ');
  assert.equal(/\(C\)|\bKey|press [A-Z]\b/.test(all), false, 'no key legend in the column');
});
check('3c. the warp pips stay in the column while flying (not hidden when no long wait)', () => {
  const root = node('div');
  const ins = createInstruments(root, {});
  ins.update({ warpUseful: false, warp: 1, warpAllowed: true });
  const warpPanel = walk(ins.leftColumn).find((n) => n.className.includes('sp-warp-panel'));
  assert.notEqual(warpPanel.style.display, 'none');
  assert.equal(walk(warpPanel).filter((n) => n.className.includes('sp-warp__pip')).length, 4, 'four pips');
});

// --- 4. Frozen is the pause; steering carries on --------------------------------
/** A game stub with what freeze.js reads; `toasts` collects what it says. */
function frozenGame() {
  const toasts = [];
  const game = { frozen: false, cinematic: null, activeScene: null, paused: false,
    hud: { root: node('div'), toast: (text) => toasts.push(text) } };
  createFreezeButton(game);
  return { game, toasts };
}
check('4a. Space while frozen carries on; Space while flying does nothing', () => {
  const { game } = frozenGame();
  press('Space');
  assert.equal(game.frozen, false, 'Space while flying leaves it unfrozen');
  press('KeyF');
  assert.equal(game.frozen, true, 'F freezes');
  press('Space');
  assert.equal(game.frozen, false, 'Space carries on');
  press('KeyF');
  press('KeyW');
  assert.equal(game.frozen, false, 'W carries on too');
  press('KeyF');
  press('ArrowLeft');
  assert.equal(game.frozen, false, 'an arrow carries on');
});
check('4b. a steering key does not carry on under a card; the freeze stays', () => {
  const { game } = frozenGame();
  press('KeyF');
  const retry = card('sp-retry-card');
  press('Space');
  assert.equal(game.frozen, true, 'Space under the Retry card keeps the freeze');
  retry.remove();
  press('Space');
  assert.equal(game.frozen, false, 'once the card is gone, Space carries on');
});
check('4c. the freeze is short-lived text only: a status, no pause wording', () => {
  const { game, toasts } = frozenGame();
  press('KeyF');
  press('Space');
  assert.equal(toasts.length, 2, 'one toast for freezing, one for carrying on');
  assert.equal(/press|F\b|Space/.test(toasts.join(' ')), false, `no key legend in ${JSON.stringify(toasts)}`);
  assert.equal(game.frozen, false);
});
check('4d. the freeze button has no key letter in it', () => {
  frozenGame();
  // The switches share one bar (toggleBar.js), not the HUD root.
  const btn = walk(toggleBar({ hud: {} })).find((n) => n.className === 'sp-freeze');
  assert.ok(btn, 'the freeze button exists');
  assert.equal(walk(btn).some((n) => n.className === 'sp-tg__key'), false, 'no key chip');
  assert.equal(/key F/.test(btn.title), false, 'no key letter in its tooltip');
});

// --- 5. auto-turn always shown in flight; the view button on foot ----------------
/** A game stub for aimToggle.js (mode, autopilot, cinematic, activeScene). */
function aimGame(extra = {}) {
  const game = { mode: { id: 'hard', autoAim: false }, autopilot: { on: false }, cinematic: null, activeScene: null,
    hud: { toast() {} }, ...extra };
  const aim = createAimToggle(game);
  const btn = walk(toggleBar({ hud: {} })).filter((n) => n.className === 'sp-aimtoggle').pop();
  return { game, aim, btn };
}
check('5a. auto-turn is shown in flight even where nothing would auto-turn (Hard)', () => {
  const { aim, btn } = aimGame();
  aim.update();
  assert.equal(btn.style.display, '', 'shown');
  assert.equal(walk(btn).some((n) => n.className === 'sp-tg__key'), false, 'no key chip');
  assert.equal(/key T/.test(btn.title), false, 'no key letter in its tooltip');
});
check('5b. auto-turn hides in a cut-scene or on foot, and clicking it turns manual aim on', () => {
  const { game, aim, btn } = aimGame();
  game.cinematic = {};
  aim.update();
  assert.equal(btn.style.display, 'none', 'hidden in a cut-scene');
  game.cinematic = null;
  game.activeScene = {};
  aim.update();
  assert.equal(btn.style.display, 'none', 'hidden on foot');
  game.activeScene = null;
  aim.update();
  assert.equal(btn.style.display, '', 'back in flight');
  btn.click();
  assert.equal(game.manualAim, true, 'click turns auto-turn off');
});
check('5c. the view button names the walk view on foot, and the flight view in flight', () => {
  const root = node('div');
  const ins = createInstruments(root, {});
  ins.update({ cameraMode: 'orbit' });
  assert.equal(ins.cameraButton.textContent, 'Free look');
  ins.setCameraLabel('Change view');
  assert.equal(ins.cameraButton.textContent, 'Change view');
  ins.setCameraLabel(null);
  ins.update({ cameraMode: 'orbit' });
  assert.equal(ins.cameraButton.textContent, 'Free look', 'back to the flight name');
});

vite.close();
let failed = 0;
for (const [ok, name] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed) process.exit(1);
