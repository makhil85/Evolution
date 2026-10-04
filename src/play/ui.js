// Shared bits for the play-mode UI (chooser, chip, nav text, mining hint, clue
// cards): one injected stylesheet in the HUD's visual language, the input lock,
// and a small modal layer. Safe to import in node (nothing touches `document`
// until a function is called).
//
// THE INPUT LOCK: while any play-mode modal is open, `document.body.dataset.
// playModal === '1'`. Chapters must ignore movement / E / interaction keys
// while it is set (`if (document.body.dataset.playModal) return;`). The modal
// layer also swallows keydown at the window's capture phase so listeners
// attached later never see those keys, but a listener registered before the
// modal opened still can, hence the flag.

const HAS_DOM = typeof document !== 'undefined' && typeof window !== 'undefined';

export const PLAY_CSS = `
.pl-back, .pl-chip, .play-nav-text, .pl-hint, .pl-cluebtn {
  --pl-panel: rgba(16, 22, 30, 0.92);
  --pl-line: rgba(255, 255, 255, 0.14);
  --pl-text: #eef4ff;
  --pl-muted: #a9b8d2;
  --pl-good: #7ee787;
  --pl-warn: #ffd166;
  --pl-cool: #56d4ff;
  --pl-gold: #ffcf5c;
  --pl-ink: #06101c;
  /* The game's one type family (same as the HUDs and the launcher). */
  font-family: 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}
.pl-back *, .pl-chip *, .pl-hint *, .pl-cluebtn * { box-sizing: border-box; }

/* --- modal layer ---------------------------------------------------------- */
.pl-back {
  position: fixed; inset: 0; z-index: 100000;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  background: rgba(4, 8, 16, 0.66);
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
  color: var(--pl-text);
  font-size: 15px; line-height: 1.35;
  user-select: none;
  animation: pl-fade 160ms ease-out 1;
}
.pl-card {
  width: min(860px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 22px;
  border-radius: 20px;
  background: #111a2f;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6);
  animation: pl-rise 200ms ease-out 1;
}
.pl-eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: var(--pl-cool); }
.pl-title { margin: 2px 0 4px; font-size: 24px; font-weight: 900; }
.pl-sub { margin: 0 0 16px; font-size: 15px; line-height: 1.45; color: var(--pl-muted); }

/* --- the mode chooser ------------------------------------------------------ */
.pl-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.pl-mode {
  --acc: #56d4ff; --acc-soft: rgba(86, 212, 255, 0.16); --acc-line: rgba(86, 212, 255, 0.55);
  position: relative;
  display: flex; flex-direction: column; gap: 9px;
  text-align: left;
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: #1a2540;
  border: 2px solid rgba(255, 255, 255, 0.14);
  color: inherit; font: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.pl-mode[data-mode="easy"]   { --acc: #7ee787; --acc-soft: rgba(126, 231, 135, 0.16); --acc-line: rgba(126, 231, 135, 0.55); }
.pl-mode[data-mode="medium"] { --acc: #56d4ff; --acc-soft: rgba(86, 212, 255, 0.16);  --acc-line: rgba(86, 212, 255, 0.55); }
.pl-mode[data-mode="hard"]   { --acc: #ffb36b; --acc-soft: rgba(255, 179, 107, 0.16); --acc-line: rgba(255, 179, 107, 0.55); }
.pl-mode:hover { background: #21304f; border-color: var(--acc-line); transform: translateY(-1px); }
.pl-mode.is-current { border-color: var(--acc); background: #1f2c4a; box-shadow: 0 0 0 1px var(--acc), 0 0 22px var(--acc-soft); }
.pl-mode:focus-visible { outline: 3px solid var(--pl-cool); outline-offset: 3px; }
.pl-mode__head { display: flex; align-items: center; gap: 10px; }
.pl-mode__icon {
  flex: none; width: 42px; height: 42px; border-radius: 13px;
  display: grid; place-items: center;
  background: var(--acc-soft); border: 1px solid var(--acc-line); color: var(--acc);
}
.pl-mode__icon svg { width: 24px; height: 24px; }
.pl-mode__name { font-size: 21px; font-weight: 900; }
.pl-mode__tag {
  margin-left: auto; padding: 2px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
  background: var(--acc-soft); border: 1px solid var(--acc-line); color: var(--acc);
}
.pl-mode__blurb { font-size: 14px; line-height: 1.42; color: #d3def0; }
.pl-mode__what { margin: 2px 0 0; padding: 9px 0 0; list-style: none; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; gap: 5px; }
.pl-mode__what li { display: flex; align-items: baseline; gap: 8px; font-size: 13px; font-weight: 700; color: #dbe7ff; }
.pl-mode__what li.is-off { color: rgba(169, 184, 210, 0.7); font-weight: 600; }
.pl-mode__what .pl-ck { flex: none; width: 14px; text-align: center; font-weight: 900; color: var(--acc); }
.pl-mode__what li.is-off .pl-ck { color: rgba(169, 184, 210, 0.55); }
.pl-mode__whathead { margin-top: auto; padding-top: 2px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--pl-muted); }
.pl-foot { margin-top: 14px; text-align: center; font-size: 12.5px; color: var(--pl-muted); }
.pl-key {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px; border-radius: 7px; margin: 0 1px;
  background: linear-gradient(180deg, #ffe9a3, #ffd166); color: var(--pl-ink);
  font: 900 13px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}

/* --- the chip (sits left of the "Chapters" button, same row) ---------------- */
.pl-chip {
  --acc: #56d4ff;
  position: fixed; top: 8px; right: 124px; z-index: 99998;
  display: inline-flex; align-items: center; gap: 6px;
  height: 31px; padding: 0 12px 0 9px;
  border-radius: 999px;
  background: #161c25; color: #e8eef7; border: 1px solid #2b3542;
  font: 600 13px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: border-color 120ms ease;
}
.pl-chip[data-mode="easy"]   { --acc: #7ee787; }
.pl-chip[data-mode="medium"] { --acc: #56d4ff; }
.pl-chip[data-mode="hard"]   { --acc: #ffb36b; }
.pl-chip svg { width: 15px; height: 15px; color: var(--acc); flex: none; }
.pl-chip__word { color: #a9b8d2; }
.pl-chip:hover { border-color: var(--acc); }
.pl-chip:focus-visible { outline: 2px solid #6fb4ff; outline-offset: 2px; }

/* --- the navigation text pill ---------------------------------------------- */
.play-nav-text {
  position: fixed; left: 50%; bottom: 138px; transform: translateX(-50%);
  z-index: 99990; display: none;
  padding: 7px 16px; border-radius: 999px;
  background: var(--pl-panel); border: 1px solid rgba(255, 209, 102, 0.55);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  color: var(--pl-text); font-size: 15px; font-weight: 800; line-height: 1.2;
  white-space: nowrap; max-width: min(84vw, 560px); overflow: hidden; text-overflow: ellipsis;
  pointer-events: none;
  transition: border-color 200ms ease, color 200ms ease;
}
.play-nav-text.is-near { border-color: rgba(126, 231, 135, 0.6); color: #d6ffdc; }
/* Focus mode: under a question card (game/hud.js sets the class) the pills
 * and the Clue button step away; they used to sit on top of the card. */
body.rv-question-open .play-nav-text,
body.rv-question-open .pl-hint,
body.rv-question-open .pl-cluebtn { display: none !important; }

/* --- the mining hint --------------------------------------------------------- */
.pl-hint {
  position: fixed; left: 50%; bottom: 196px; transform: translate(-50%, 6px);
  z-index: 99990;
  display: block;
  padding: 8px 16px; border-radius: 999px;
  background: var(--pl-panel); border: 1px solid rgba(255, 209, 102, 0.55);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  color: var(--pl-text); font-size: 15px; font-weight: 800; white-space: nowrap;
  pointer-events: none; opacity: 0;
  transition: opacity 220ms ease, transform 220ms ease;
}
.pl-hint .pl-key { vertical-align: middle; margin: 0 3px 2px; }
.pl-hint.is-in { opacity: 1; transform: translate(-50%, 0); }

/* --- the "Clue" button ------------------------------------------------------- */
.pl-cluebtn {
  position: fixed; left: 12px; bottom: 190px; z-index: 99990;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px; border-radius: 999px;
  background: var(--pl-panel); color: #ffe7aa; border: 1px solid rgba(255, 209, 102, 0.55);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  font: 800 13.5px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  cursor: pointer;
}
.pl-cluebtn[hidden] { display: none !important; }
.pl-cluebtn:hover { background: rgba(38, 30, 14, 0.94); border-color: var(--pl-gold); }
.pl-cluebtn:focus-visible { outline: 3px solid var(--pl-cool); outline-offset: 2px; }
.pl-cluebtn.is-new { animation: pl-glow 1.4s ease-in-out 3; }

/* --- the clue card (parchment) ------------------------------------------------ */
.pl-clue {
  position: relative;
  width: min(560px, 100%); max-height: calc(100vh - 32px); overflow-y: auto;
  padding: 24px 28px 22px; border-radius: 16px;
  color: #3b2a16; text-align: center;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(255, 255, 255, 0.5), transparent 55%),
    linear-gradient(180deg, #f8efd6, #ecdcaf);
  border: 2px solid #b68d4c;
  box-shadow: inset 0 0 44px rgba(150, 100, 40, 0.3), 0 0 0 5px rgba(90, 58, 23, 0.4), 0 26px 70px rgba(0, 0, 0, 0.6);
  animation: pl-rise 220ms ease-out 1;
}
.pl-clue__eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.9px; text-transform: uppercase; color: #8a5a2b; }
.pl-clue__title { margin: 2px 0 8px; font-size: 27px; font-weight: 900; color: #4a2f12; }
.pl-clue__dots { display: flex; justify-content: center; gap: 7px; margin-bottom: 14px; }
.pl-clue__dots i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #a37a3d; background: transparent; }
.pl-clue__dots i.is-done { background: #a37a3d; }
.pl-clue__dots i.is-now { background: #e9b24a; border-color: #7a4d14; box-shadow: 0 0 0 3px rgba(233, 178, 74, 0.35); }
.pl-clue__lead { margin: 0 0 12px; padding: 2px 0 12px; border-bottom: 1px dashed rgba(120, 80, 30, 0.45); font-size: 15px; font-style: italic; line-height: 1.5; color: #6b4a25; white-space: pre-line; }
.pl-clue__text { margin: 0; font: 400 19px/1.55 Georgia, 'Times New Roman', serif; color: #3b2a16; white-space: pre-line; text-align: left; }
.pl-clue__actions { margin-top: 18px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pl-clue__hint { font-size: 12px; color: #8a6a3f; }
.pl-bigbtn {
  padding: 13px 38px; border: 0; border-radius: 14px;
  background: linear-gradient(180deg, #ffe9a3, #ffcf5c); color: var(--pl-ink);
  font: 900 19px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  box-shadow: 0 3px 0 #a77a1b, 0 8px 18px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.pl-bigbtn:hover { filter: brightness(1.06); }
.pl-bigbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 #a77a1b; }
.pl-bigbtn:focus-visible { outline: 3px solid #56d4ff; outline-offset: 3px; }

/* --- the "found it" card --------------------------------------------------------- */
.pl-found {
  position: relative; overflow: hidden;
  width: min(520px, 100%); padding: 26px 28px 22px; border-radius: 20px; text-align: center;
  background: radial-gradient(ellipse at 50% 0%, rgba(255, 207, 92, 0.22), transparent 62%), #111a2f;
  border: 2px solid rgba(255, 207, 92, 0.7);
  box-shadow: 0 0 60px rgba(255, 207, 92, 0.3), 0 28px 80px rgba(0, 0, 0, 0.6);
  animation: pl-pop 320ms cubic-bezier(.2, 1.4, .4, 1) 1;
}
.pl-found__icon { font-size: 60px; line-height: 1; animation: pl-bob 1.6s ease-in-out infinite; }
.pl-found__title { margin: 6px 0 8px; font-size: 27px; font-weight: 900; color: var(--pl-gold); text-shadow: 0 2px 12px rgba(255, 207, 92, 0.35); }
.pl-found__text { margin: 0 0 18px; font-size: 17px; line-height: 1.5; color: #e6eeff; white-space: pre-line; }
.pl-found__spark { position: absolute; color: #ffe08a; font-size: 18px; opacity: 0; animation: pl-twinkle 1.8s ease-in-out infinite; pointer-events: none; }

@keyframes pl-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pl-pop { from { opacity: 0; transform: scale(0.86); } to { opacity: 1; transform: scale(1); } }
@keyframes pl-bob { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-7px) rotate(4deg); } }
@keyframes pl-twinkle { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes pl-glow { 0%, 100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(255, 209, 102, 0.6); } 50% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 8px rgba(255, 209, 102, 0); } }

@media (prefers-reduced-motion: reduce) {
  .pl-back, .pl-card, .pl-clue, .pl-found, .pl-found__icon, .pl-found__spark, .pl-cluebtn.is-new { animation: none; }
  .pl-found__spark { opacity: 0.8; }
  .pl-mode, .pl-hint, .play-nav-text { transition: none; }
  .pl-mode:hover { transform: none; }
}

/* --- narrow screens ------------------------------------------------------------------ */
@media (max-width: 900px) {
  .play-nav-text { bottom: auto; top: 104px; left: auto; right: 12px; transform: none; max-width: calc(100vw - 130px); }
  .pl-hint { bottom: auto; top: calc(46% + 56px); }
  .pl-cluebtn { bottom: auto; top: 104px; }
}
@media (max-width: 720px) {
  .pl-card { padding: 16px; }
  .pl-title { font-size: 21px; }
  .pl-modes { grid-template-columns: 1fr; gap: 9px; }
  .pl-mode { padding: 11px 12px 10px; gap: 7px; }
  .pl-mode__what { flex-direction: row; flex-wrap: wrap; gap: 4px 14px; }
  .pl-mode__whathead { display: none; }
  .pl-clue { padding: 20px 18px 18px; }
  .pl-clue__text { font-size: 17px; }
}
@media (max-width: 560px) {
  .pl-chip__word { display: none; }
}
`;

/** Add the stylesheet once (no-op outside a browser). */
export function ensurePlayStyles() {
  if (!HAS_DOM || document.getElementById('play-styles')) return;
  const s = document.createElement('style');
  s.id = 'play-styles';
  s.textContent = PLAY_CSS;
  document.head.appendChild(s);
}

// --- the input lock (nests: several cards can overlap for a moment) -----------
let locks = 0;

/** Set `document.body.dataset.playModal = '1'` (counted, so nesting is safe). */
export function lockPlayInput() {
  if (!HAS_DOM) return;
  locks += 1;
  document.body.dataset.playModal = '1';
}

export function unlockPlayInput() {
  if (!HAS_DOM) return;
  locks = Math.max(0, locks - 1);
  if (locks === 0) delete document.body.dataset.playModal;
}

/** True while a play-mode modal is open (also readable as body.dataset.playModal). */
export function isPlayModalOpen() {
  return locks > 0;
}

export function prefersReducedMotion() {
  try { return !!(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

/** Tiny element helper. */
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * Swallow keydown for the game while a modal is open and hand each key to `fn`.
 * Modifier combos and F-keys are left alone (reload, devtools).
 * @returns {() => void} remove
 */
export function captureKeys(fn) {
  const h = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    fn(e);
  };
  window.addEventListener('keydown', h, true);
  return () => window.removeEventListener('keydown', h, true);
}

let openLayerCount = 0;

/**
 * Put `card` in a backdrop, lock game input, capture keys. Returns { back, close }.
 * `close()` is idempotent and calls `onClose` once.
 */
export function openLayer(card, { onKey, onClose } = {}) {
  ensurePlayStyles();
  const back = el('div', 'pl-back');
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  back.appendChild(card);
  document.body.appendChild(back);
  lockPlayInput();
  openLayerCount += 1;
  const off = captureKeys((e) => { if (onKey) onKey(e); });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    off();
    back.remove();
    openLayerCount -= 1;
    unlockPlayInput();
    if (onClose) onClose();
  };
  return { back, close };
}

/** Small stroke icons (24x24, currentColor) for the three modes. */
export const MODE_ICONS = {
  easy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 20 21l-8-4.2L4 21z"/></svg>',
  medium: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V3"/><path d="M6 4h12l-3 4.5 3 4.5H6"/></svg>',
  hard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="12" r="4.2"/><path d="M11.7 12H22"/><path d="M18 12v4.5"/><path d="M14.6 12v3"/></svg>',
};
