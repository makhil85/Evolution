// The Chapter 4-7 HUD's words for the child (src/space/hud/hud.js), run headless
// through Vite's loader with a stub DOM and a fake clock:
//   - a toast stays up for readMs(text) (5-10 s, src/play/readTime.js) even when
//     a caller asks for less; a longer `ms` is kept up to 10 s;
//   - a toast or banner too long for readMs (needsClick) is a card with an OK
//     button instead: the game pauses under it (ui-modal) until she clicks OK,
//     or presses Enter, Space or Escape; nothing replaces it meanwhile;
//   - messages queue (never a third one on screen, never one pushed out early);
//   - the HUD has no always-on key help ("Press J", "M: big map", "N: hide").
//
//   node scripts/test-space-text.mjs

// --- a stub DOM with real text, classes and listeners -----------------------
const chain = new Proxy(function chainFn() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : chain), set: () => true, apply: () => chain });
const canvasCtx = new Proxy({}, {
  get: (t, k) => (k === 'measureText' ? () => ({ width: 0 }) : k in t ? t[k] : chain),
  set: (t, k, v) => { t[k] = v; return true; },
});

class TextNode {
  constructor(s) { this.textContent = String(s); this.nodeType = 3; }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._text = '';
    this._cls = new Set();
    this.listeners = {};
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.parentNode = null;
    this.value = '';
    this.width = 0;
    this.height = 0;
    this.clientWidth = 230;
    this.clientHeight = 230;
    this.classList = {
      add: (...c) => c.forEach((x) => this._cls.add(x)),
      remove: (...c) => c.forEach((x) => this._cls.delete(x)),
      toggle: (c, force) => { const on = force ?? !this._cls.has(c); if (on) this._cls.add(c); else this._cls.delete(c); return on; },
      contains: (c) => this._cls.has(c),
    };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v || '').split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = []; this._text = v == null ? '' : String(v); }
  set innerHTML(v) { this.children = []; this._text = String(v).replace(/<[^>]*>/g, ' '); }
  get innerHTML() { return ''; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === 'string' ? new TextNode(n) : n); }
  insertBefore(c) { return this.appendChild(c); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  dispatch(type, ev = {}) { for (const fn of (this.listeners[type] || []).slice()) fn({ type, target: this, preventDefault() {}, stopPropagation() {}, ...ev }); }
  click() { this.dispatch('click'); }
  focus() {}
  blur() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  getContext() { return canvasCtx; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const bodyNode = new FakeNode('body');
globalThis.document = {
  documentElement: { dataset: { chapter: '4' } },
  body: bodyNode,
  createElement: (tag) => new FakeNode(tag),
  createElementNS: (ns, tag) => new FakeNode(tag),
  createTextNode: (s) => new TextNode(s),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  activeElement: null,
};
globalThis.window = {
  addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1,
  innerWidth: 1280, innerHeight: 720, location: { search: '', href: 'http://x/' },
  getComputedStyle: () => ({}),
};
const keyHandlers = [];
globalThis.addEventListener = (type, fn) => { if (type === 'keydown') keyHandlers.push(fn); };
globalThis.removeEventListener = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createServer } = await import('vite');
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { readMs, needsClick } = await vite.ssrLoadModule('/src/play/readTime.js');
const { createHud } = await vite.ssrLoadModule('/src/space/hud/hud.js');

// --- a fake clock: timers run only when the test advances it ----------------
// (Vite needs the real timers to start, so they are swapped in after it loads.)
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let fakeNow = 0;
let timerSeq = 0;
let timers = [];
Object.defineProperty(globalThis, 'performance', { value: { now: () => fakeNow }, configurable: true, writable: true });
globalThis.setTimeout = (fn, ms = 0) => { const id = ++timerSeq; timers.push({ id, at: fakeNow + Math.max(0, Number(ms) || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
globalThis.requestAnimationFrame = (fn) => globalThis.setTimeout(fn, 16);
/** Run every timer due within `ms`, in order, then stop at the new time. */
function advance(ms) {
  const end = fakeNow + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const next = timers[0];
    if (!next || next.at > end) break;
    timers.shift();
    fakeNow = Math.max(fakeNow, next.at);
    next.fn();
  }
  fakeNow = end;
}
/** Let the promise chains (the modal queue) settle. */
async function flush() { for (let i = 0; i < 60; i++) await Promise.resolve(); }

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const emitted = [];
const bus = { on() {}, off() {}, emit(name, arg) { emitted.push([name, arg]); } };
const hud = createHud({ mount: bodyNode, bus });

/** Every node under `node` for which `pred` holds. */
function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}
const cardOpen = () => hud._modalHost.isOpen();
// A missing button is a failed check below, not a crash: the fallback does nothing.
const okButton = () => findAll(hud._modalHost.card, (n) => n.tagName === 'BUTTON')[0] || { click() {}, dispatch() {} };
const emittedModal = () => emitted.filter(([name]) => name === 'ui-modal').map(([, v]) => v);

// Texts. The long one is about 40 words: needsClick by the reading-time rule.
const SHORT = 'Captured! You are in orbit round the Moon.';
const LONG = 'Bees carry pollen from flower to flower, and that is how seeds and fruit get made on the farm and in the orchards, so the whole village can eat well every single day of the year.';

// --- 1. a short toast stays up for at least readMs -------------------------
{
  const life = readMs(SHORT);
  hud.toast(SHORT, { kind: 'good', ms: 1400 });
  check('a short toast is on screen straight away', hud._toasts.length === 1);
  advance(life - 100);
  check(`a toast with a short ms still stays up for readMs (${life} ms)`, hud._toasts.length === 1, `left at ${life - 100} ms`);
  advance(200);
  check('the toast goes once its reading time has passed', hud._toasts.length === 0);
}

// --- 2. a longer ms from the caller is kept, up to 10 s ---------------------
{
  hud.toast('Ready, set, go!', { kind: 'info', ms: 8000 });
  advance(7900);
  check('a caller ms of 8 s keeps the toast 8 s', hud._toasts.length === 1);
  advance(200);
  check('...and it goes after 8 s', hud._toasts.length === 0);
  hud.toast('Go round again!', { kind: 'info', ms: 60000 });
  advance(9900);
  check('a caller ms over 10 s is capped at 10 s (still up at 9.9 s)', hud._toasts.length === 1);
  advance(200);
  check('...and gone by 10.1 s', hud._toasts.length === 0);
}

// --- 3. a text too long to read by itself waits for a click -----------------
// Each block moves the clock on, so the same long text is not a duplicate (10 s rule).
{
  check('the long text needs a click (needsClick)', needsClick(LONG));
  hud.toast(LONG, { kind: 'info' });
  await flush();
  check('a long toast is not a toast bubble', hud._toasts.length === 0);
  check('a long toast opens a card and pauses the game (ui-modal true)', cardOpen() && emittedModal().at(-1) === true);
  check('the card carries the whole text', hud._modalHost.card.textContent.includes(LONG.slice(0, 40)) && hud._modalHost.card.textContent.includes(LONG.slice(-30)));
  advance(60000);
  check('the card stays up until she clicks (a minute later it is still there)', cardOpen());
  okButton().click();
  await flush();
  check('OK closes the card and un-pauses (ui-modal false)', !cardOpen() && emittedModal().at(-1) === false);
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  check('a second long toast opens its own card', cardOpen());
  hud._modalHost.backdrop.dispatch('keydown', { key: 'Enter' });
  await flush();
  check('Enter closes the card', !cardOpen() && emittedModal().at(-1) === false);
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  hud._modalHost.backdrop.dispatch('keydown', { key: ' ' });
  await flush();
  check('Space closes the card', !cardOpen());
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  hud._modalHost.backdrop.dispatch('keydown', { key: 'Escape' });
  await flush();
  check('Escape closes the card', !cardOpen());
}
advance(11000);
{
  // A short message arriving while the card is up waits for it to close.
  hud.toast(LONG, { kind: 'info' });
  await flush();
  hud.toast('Coast there: the Moon is next.', { kind: 'info' });
  advance(3000);
  check('a message while a card is up waits for the card', hud._toasts.length === 0);
  okButton().click();
  await flush();
  advance(10);
  check('...and shows once the card is shut', hud._toasts.length === 1 && hud._toasts[0].message === 'Coast there: the Moon is next.');
  advance(20000);
}

// --- 4. a goal banner keeps its words up for readMs; a long one waits -------
{
  const title = 'Next goal: Mars';
  const text = 'Hold Space until the dotted line reaches Mars.';
  hud.announce(title, text);
  check('a goal banner is on screen', hud._goal.classList.contains('is-on'));
  advance(6400);
  check('a goal banner stays up for at least 6.5 s', hud._goal.classList.contains('is-on'), `readMs ${readMs([title, text])}`);
  advance(300);
  check('...then goes', hud._goal.classList.contains('is-gone'));
  hud.announce('Next goal: Jupiter', LONG);
  await flush();
  check('a long goal banner becomes a card with a click', cardOpen() && hud._modalHost.card.textContent.includes('Next goal: Jupiter'));
  okButton().click();
  await flush();
  check('...and closes on OK', !cardOpen());
}

// --- 5. at most two toasts on screen, the rest wait; each stays its reading time
{
  const msgs = ['First toast here, reading it.', 'Second toast, a little later.', 'Third toast waits for a slot.'];
  for (const m of msgs) hud.toast(m, { kind: 'info' });
  check('the third toast does not show at once', hud._toasts.length === 1);
  const seen = new Map();
  let maxVisible = 0;
  const step = 50;
  const sample = () => {
    maxVisible = Math.max(maxVisible, hud._toasts.length);
    for (const e of hud._toasts) {
      const s = seen.get(e.message) || { first: Infinity, last: -Infinity };
      seen.set(e.message, { first: Math.min(s.first, fakeNow), last: Math.max(s.last, fakeNow) });
    }
  };
  for (let i = 0; i < 400; i++) { sample(); advance(step); }
  let worst = Infinity;
  let all = true;
  for (const m of msgs) {
    const s = seen.get(m);
    if (!s) { all = false; continue; }
    worst = Math.min(worst, s.last - s.first + step - readMs(m));
  }
  check('all three toasts were shown', all);
  check('never more than two toasts on screen', maxVisible === 2, `max ${maxVisible}`);
  check('every toast in the queue stayed up at least its reading time', all && worst >= -step, `worst margin ${worst} ms`);
}

// --- 6. focus mode holds ordinary toasts; a warning still gets through ----
{
  hud.setFocus(true);
  hud.toast('Hold the ship steady for a moment.', { kind: 'info' });
  advance(1600);
  check('an ordinary toast waits while she has to act', hud._toasts.every((e) => e.message !== 'Hold the ship steady for a moment.'));
  hud.toast('Fuel is low!', { kind: 'warn' });
  advance(1600);
  check('a warning gets through in focus mode', hud._toasts.some((e) => e.message === 'Fuel is low!'));
  // Focus off well inside the stale limit (a message older than TOAST_STALE_MS is dropped).
  hud.setFocus(false);
  advance(1600);
  check('the held toast shows once focus is off', hud._toasts.some((e) => e.message === 'Hold the ship steady for a moment.'));
  advance(12000);
}

// --- 7. the HUD has no always-on key help -----------------------------------
{
  hud.setMission({ act: 'Act 1', title: 'Mission', objective: 'Reach Mars.', steps: [] });
  const text = hud.root.textContent;
  const forbidden = ['Press J', 'M: big map', 'N: hide', 'show or hide this card', 'Drag to pan', 'Esc to close'];
  const found = forbidden.filter((f) => text.includes(f));
  check('no key help in the HUD ("Press J", "M: big map", "N: hide", map controls)', found.length === 0, found.join(', ') || 'none');
  check('the mission card still shows its objective', hud._missionObjective.textContent === 'Reach Mars.');
}

globalThis.setTimeout = realSetTimeout;
globalThis.clearTimeout = realClearTimeout;
await vite.close();
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} space text checks passed`);
if (failed) process.exit(1);
