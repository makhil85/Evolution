import { readFileSync } from 'node:fs';
// The Chapter 4-7 HUD's words for the child (src/space/hud/hud.js), run headless
// through Vite's loader with a stub DOM and a fake clock:
//   - a toast stays up for readMs(text) (5-10 s, src/play/readTime.js) even when
//     a caller asks for less; a longer `ms` is kept up to 10 s;
//   - a toast or banner too long for readMs (needsClick) is a card with an OK
//     button instead: the game pauses under it (ui-modal) until she clicks OK,
//     or presses Enter, Space or Escape; nothing replaces it meanwhile;
//   - messages queue (never a third one on screen, never one pushed out early);
//   - the HUD has no always-on key help ("Press J", "M: big map", "N: hide");
//   - words wait for a quiet moment (src/play/readGate.js, lead 2026-10-09): a
//     guidance toast or a goal banner waits until she has had no input for
//     IDLE_MS, then the game pauses for its reading time; a short status shows
//     at once and never pauses; the mission card folds while she flies.
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
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
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
const { readMs, needsClick, READ_MIN_MS } = await vite.ssrLoadModule('/src/play/readTime.js');
const { createHud } = await vite.ssrLoadModule('/src/space/hud/hud.js');
const { noteInput, IDLE_MS } = await vite.ssrLoadModule('/src/play/readGate.js');
const { paintToggle } = await vite.ssrLoadModule('/src/space/hud/toggleBar.js');

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
  advance(READ_MIN_MS);
  okButton().click();
  await flush();
  check('OK closes the card and un-pauses (ui-modal false)', !cardOpen() && emittedModal().at(-1) === false);
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  check('a second long toast opens its own card', cardOpen());
  advance(READ_MIN_MS);
  hud._modalHost.backdrop.dispatch('keydown', { key: 'Enter' });
  await flush();
  check('Enter closes the card', !cardOpen() && emittedModal().at(-1) === false);
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  advance(READ_MIN_MS);
  hud._modalHost.backdrop.dispatch('keydown', { key: ' ' });
  await flush();
  check('Space closes the card', !cardOpen());
}
advance(11000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  advance(READ_MIN_MS);
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
  advance(READ_MIN_MS);
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
  advance(3000); // a read pause is followed by a 3 s gap before the next words (PAUSE_GAP_MS)
  hud.announce('Next goal: Jupiter', LONG);
  await flush();
  check('a long goal banner becomes a card with a click', cardOpen() && hud._modalHost.card.textContent.includes('Next goal: Jupiter'));
  advance(READ_MIN_MS);
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
  const forbidden = ['Press J', 'M: big map', 'N: hide', 'show or hide this card', 'Esc to close', '(U)'];
  const found = forbidden.filter((f) => text.includes(f));
  check('no key help in the HUD ("Press J", "M: big map", "N: hide", "Esc to close")', found.length === 0, found.join(', ') || 'none');
  check('the big map keeps its how-to line (drag and scroll, not a key)', hud.map.root.textContent.includes('Drag to pan'));
  check('the mission card still shows its objective', hud._missionObjective.textContent === 'Reach Mars.');
}

// --- 8. a message is not lost while she is held (a card, focus) -----------
advance(20000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  hud.toast('Samples complete! On to Ceres.', { kind: 'good' });
  hud.toast('A plain message, queued behind the card.', { kind: 'info' });
  advance(15000);
  check('a card holds the queue for 15 s', cardOpen() && hud._toasts.length === 0);
  okButton().click();
  await flush();
  advance(3500);
  const shown = hud._toasts.map((e) => e.message);
  check('a good message queued behind a 15 s card is not dropped', shown.includes('Samples complete! On to Ceres.'), shown.join(' | ') || 'none');
  check('a plain message queued behind a 15 s card is not dropped either', shown.includes('A plain message, queued behind the card.'));
  advance(20000);
}
{
  hud.setFocus(true);
  hud.toast('A plain message held by focus.', { kind: 'info' });
  advance(20000);
  hud.setFocus(false);
  advance(10);
  check('a plain message held by focus for 20 s is not aged out', hud._toasts.some((e) => e.message === 'A plain message held by focus.'));
  advance(20000);
}

// --- 9. a card shut over the big map keeps the game paused -----------------
{
  hud.map.open();
  check('the big map is open', hud.map.isOpen());
  hud.toast(LONG, { kind: 'info' });
  await flush();
  check('a card opens over the big map', cardOpen());
  advance(READ_MIN_MS);
  okButton().click();
  await flush();
  check('OK on a card while the big map is open leaves the game paused (ui-modal stays true)', emittedModal().at(-1) === true);
  hud.map.close();
  check('closing the big map un-pauses the game', emittedModal().at(-1) === false);
}
advance(20000);

// --- 10. kid text is not cleared on a fixed short timer (source checks) ----
{
  const src = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
  const ring = src('src/space/ch5/ringRun.js');
  const util = src('src/space/acts/util.js');
  check('the ring run tip stays for its reading time, not a fixed 4 s', !/panel\.tip\(''\), 4000\)/.test(ring) && ring.includes('readMs(tip)'));
  check('the Landed card stays for its reading time, not 1.8 s', !/setTimeout\(card\.close, 1800\)/.test(util) && util.includes('readMs([title, sub])'));
  const tally = src('src/space/hud/tally.js');
  check('the upgrade bay labels have no key letter (a string ending in (U))', !/\(U\)['`]/.test(tally));
}

// --- 11. the switches show no key letter (the key is in the tooltip) --------
{
  const btn = new FakeNode('button');
  paintToggle(btn, 'T', 'Auto-turn', 'on', 'Auto-turn is on. Click to steer yourself');
  check('a switch shows its name, not a key letter', btn.textContent === 'Auto-turn', btn.textContent);
  check('the key stays in the tooltip', btn.title.includes('key T'));
}

// --- 12. the OK card answers only after READ_MIN_MS (5 s) ------------------
// A key held down (auto-repeat) or pressed too soon never closes it, and the
// keys never reach the flight from the card.
advance(20000);
{
  hud.toast(LONG, { kind: 'info' });
  await flush();
  const stopped = [];
  const press = (key, repeat = false) => hud._modalHost.backdrop.dispatch('keydown', { key, repeat, preventDefault() { stopped.push(key); } });
  check('the OK button is dimmed while it waits', okButton().classList.contains('sp-btn--wait'));
  okButton().click();
  press('Enter');
  press(' ');
  press('Escape');
  check('OK, Enter, Space and Escape do nothing in the first 5 s', cardOpen());
  check('Enter and Space are stopped before the flight sees them', stopped.length === 2, `stopped ${stopped.length}`);
  advance(READ_MIN_MS - 200);
  press(' ', true);
  check('a held Space (a repeat) does not close it', cardOpen());
  advance(300);
  check('the OK button is no longer dimmed once it answers', !okButton().classList.contains('sp-btn--wait'));
  press(' ', true);
  check('a repeated Space after 5 s still does not close it', cardOpen());
  press(' ');
  check('a first Space after 5 s closes it', !cardOpen());
}

// --- 13. words wait for a quiet moment (readGate): F1-F4 ------------------
// noteInput() is her playing (a key, a drag, a walk); the hud reads the same clock.
const GUIDE = 'Keep the arrow on the planet and wait for the ring to close, then tap the button.';
{
  advance(20000);
  noteInput();
  hud.toast(GUIDE, { kind: 'info' });
  check('a guidance toast waits while she is playing', hud._toasts.length === 0);
  for (let i = 0; i < 8; i++) { advance(400); noteInput(); }
  check('it still waits while her input goes on (3.2 s)', hud._toasts.length === 0);
  for (let i = 0; i < 80 && hud._toasts.length === 0; i++) advance(50);
  const shownAt = fakeNow;
  check(`it shows once she has had no input for IDLE_MS (${IDLE_MS} ms)`, hud._toasts.length === 1 && hud._toasts[0].message === GUIDE);
  check('...and pauses the flight while it is read (ui-modal true)', emittedModal().at(-1) === true);
  advance(readMs(GUIDE) - 200);
  check(`the flight stays paused for the reading time (${readMs(GUIDE)} ms)`, emittedModal().at(-1) === true);
  advance(400);
  check('then the flight goes on by itself (ui-modal false)', emittedModal().at(-1) === false);
  check('the pause lasted readMs, from when it showed', fakeNow - shownAt >= readMs(GUIDE));
  advance(20000);
}
{
  // A short status is not words to wait for: it shows at once, and never pauses.
  noteInput();
  const before = emittedModal().length;
  hud.toast('+3 wood', { kind: 'good' });
  check('a short status shows at once while she plays', hud._toasts.some((e) => e.message === '+3 wood'));
  check('...and does not pause the flight', emittedModal().length === before);
  advance(20000);
}
{
  // The goal banner waits for a quiet moment, pauses while read, and goes on by itself.
  noteInput();
  const title = 'Next goal: Venus';
  const text = 'Steer toward Venus and burn.';
  hud.announce(title, text);
  for (let i = 0; i < 8; i++) { advance(400); noteInput(); }
  check('a goal banner waits while she is playing', !(hud._goal && hud._goal.classList.contains('is-on')));
  for (let i = 0; i < 80 && !(hud._goal && hud._goal.classList.contains('is-on')); i++) advance(50);
  check('the goal banner shows once she has had no input for IDLE_MS', hud._goal.classList.contains('is-on') && hud._goalTitle.textContent === title);
  check('...and the flight pauses while it is read', emittedModal().at(-1) === true);
  advance(readMs([title, text]) - 200);
  check('...still paused for its reading time', emittedModal().at(-1) === true);
  advance(400);
  check('...then goes on by itself', emittedModal().at(-1) === false);
  advance(20000);
}
{
  // The mission card folds to its title line at once while she flies, unfolds after 3 s
  // without input, and stays open 1.5 s before it may fold again (critic 2026-10-09).
  const card = hud._missionCard;
  const folded = () => card.classList.contains('is-collapsed');
  hud.setMission({ act: 'Act 1', title: 'Reach Mars', objective: 'Fly to Mars and wait by it.', steps: [] });
  advance(3100);
  check('the mission card is open while she is idle', !folded());
  noteInput();
  advance(300);
  check('the mission card folds to its title line at once while she flies', folded());
  check('...and the title line names the step', hud._missionPeek.textContent === 'Reach Mars', hud._missionPeek.textContent);
  advance(2500);
  check('it does not unfold before 3 s without input', folded());
  advance(700);
  check('it unfolds once she has been idle for 3 s', !folded());
  noteInput();
  advance(300);
  check('a tap just after it unfolds does not fold it (1.5 s hold)', !folded());
  for (let i = 0; i < 6; i++) { noteInput(); advance(250); }
  check('it folds again once it has been open for 1.5 s and she plays', folded());
  hud._missionToggle.click();
  check('a click opens the folded card in full', !folded());
  advance(3100);
  check('...and it stays open once she is idle', !folded());
  hud._missionToggle.click();
  check('a click shuts the card (her choice)', folded());
  check('the choice is remembered (MISSION_OPEN_KEY 0)', localStorage.getItem('space_ch4_mission_open') === '0');
  noteInput();
  advance(300);
  advance(3100);
  check('a shut card stays shut, flying or idle', folded());
  hud._missionToggle.click();
  advance(20000);
}
{
  // Taps every 2.25 s (the critic's P8) fold the card once; they do not flicker it.
  const card = hud._missionCard;
  const folded = () => card.classList.contains('is-collapsed');
  let changes = 0;
  let prev = folded();
  for (let k = 0; k < 8; k++) {
    noteInput();
    for (let i = 0; i < 9; i++) { advance(250); if (folded() !== prev) { changes += 1; prev = folded(); } }
  }
  check(`taps every 2.25 s change the card once, not 16 times (${changes})`, changes <= 1, `changes ${changes}`);
  advance(20000);
}
// --- 14. no lost guidance, no back-to-back freezes, no bus card unpausing a read (critic) ---
const TXT_LINE = (k) => `${k}: Bees carry pollen from flower to flower so that seeds and fruit get made on the farm every day.`;
{
  // A line queued while she steers for 25 s is not dropped: it shows at her first short natural stop.
  advance(20000);
  noteInput();
  hud.toast(GUIDE, { kind: 'info' });
  for (let i = 0; i < 100; i++) { advance(250); noteInput(); }   // 25 s of steering, past the 15 s cap
  check('after 15 s, a line still waits while she is steering (no natural stop yet)', hud._toasts.length === 0);
  let t = 0;
  while (hud._toasts.length === 0 && t < 4000) { advance(50); t += 50; }
  check(`it shows at her first short natural stop (${t} ms after she stops)`, hud._toasts.length === 1 && hud._toasts[0].message === GUIDE && t <= 1500, `after ${t} ms`);
  advance(20000);
}
{
  // The same cap for the goal banner: a goal set during a long burn shows at the first natural stop.
  advance(20000);
  noteInput();
  hud.announce('Next goal: Saturn', 'Steer toward Saturn and burn.');
  for (let i = 0; i < 100; i++) { advance(250); noteInput(); }
  check('a goal banner set during a 25 s burn is not lost', !(hud._goal && hud._goal.classList.contains('is-on')));
  let t = 0;
  while (!(hud._goal && hud._goal.classList.contains('is-on')) && t < 4000) { advance(50); t += 50; }
  check(`the goal banner shows at her first short natural stop (${t} ms after she stops)`, t <= 1500);
  advance(20000);
}
{
  // Four lines while idle: four pauses, each its own reading time, a 3 s gap between them.
  advance(20000);
  emitted.length = 0;
  const t0 = fakeNow;
  for (const k of ['A', 'B', 'C', 'D']) hud.toast(TXT_LINE(k), { kind: 'info' });
  const spans = [];
  let open = null;
  for (let i = 0; i < 2400; i++) {
    advance(50);
    const v = emittedModal().at(-1);
    if (v === true && open === null) open = fakeNow;
    if (v === false && open !== null) { spans.push([open - t0, fakeNow - t0]); open = null; }
  }
  check('four lines pause the game four times, not as one freeze', spans.length === 4, `${spans.length} pauses ${JSON.stringify(spans)}`);
  check('no pause is longer than one reading time (10 s)', spans.every(([a, b]) => b - a <= 10000), JSON.stringify(spans));
  check('a 3 s gap separates the pauses (no back-to-back freeze)', spans.slice(1).every(([a], i) => a - spans[i][1] >= 3000), JSON.stringify(spans));
  advance(20000);
}
{
  // A bus card (a station, a quest) that opens and closes during a reading pause does not unpause under it.
  advance(20000);
  emitted.length = 0;
  hud.toast(GUIDE, { kind: 'info' });
  advance(300);
  bus.emit('ui-modal', true);     // a play-mode card opens on the bus
  bus.emit('ui-modal', false);    // and closes while the text is still being read
  check('a bus card that opens and closes during a read pause keeps the game paused', emittedModal().at(-1) === true);
  advance(readMs(GUIDE));
  check('the reading pause ends and the game runs on', emittedModal().at(-1) === false);
  advance(20000);
}
{
  // A bus card still open when the reading pause ends keeps the game paused until it closes.
  advance(20000);
  emitted.length = 0;
  hud.toast(GUIDE, { kind: 'info' });
  advance(300);
  bus.emit('ui-modal', true);
  advance(readMs(GUIDE) + 500);
  check('a bus card open after the reading pause keeps the game paused', emittedModal().at(-1) === true);
  bus.emit('ui-modal', false);
  check('...and closing it un-pauses the game', emittedModal().at(-1) === false);
  advance(20000);
}
advance(20000);
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
