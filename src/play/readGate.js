// When the game may put words on screen (lead 2026-10-09).
//
// "Too many words on screen during game play is bad. Give the child time to
// read by pausing the game. Show banners and questions only when kids aren't
// actively playing and there is a no-input period."
//
// So text comes in three kinds:
//  - a short status (isShort: a few words, "+3 wood", "Lined up ✓") may show
//    while she plays; it never pauses anything;
//  - a live action cue ("Let go of Space!") shows at once because she needs it
//    right now, and must itself be short (TEXT_LIMITS.cue);
//  - everything else (guidance, story, step banners, questions) waits until she
//    has not touched the controls for IDLE_MS (whenIdle), and while it is up the
//    game is paused for its reading time (readMs, src/play/readTime.js).
// Each chapter's HUD does the pausing (src/game/hud.js for Chapters 1-3,
// src/space/hud/hud.js for 4-7); this file only knows about input and words.
// Input comes from the key, pointer, wheel and touch listeners (install). The
// Chapters 1-3 loops add nothing; the Chapters 4-7 main.js also calls noteInput
// while she steers, walks or drags the view.

import { wordCount } from './readTime.js';

/** No input for this long counts as "not actively playing". */
export const IDLE_MS = 2000;

/** The most words each kind of text may have, per Level (4 and 1). */
export const TEXT_LIMITS = Object.freeze({
  status: Object.freeze({ 4: 8, 1: 6 }),      // shown while she plays, no pause
  cue: Object.freeze({ 4: 8, 1: 6 }),         // live action cue during a manoeuvre
  objective: Object.freeze({ 4: 14, 1: 10 }), // the mission card's line
  message: Object.freeze({ 4: 25, 1: 15 }),   // a waiting message (paused while read)
});

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let lastInput = -Infinity;
let installed = false;

/** Note a control input (the listeners do this; main.js also calls it while she steers, walks or drags). */
export function noteInput(t = now()) { lastInput = t; }

/** How long since her last control input, in ms. */
export function idleMs(t = now()) { return t - lastInput; }

/** Is she not playing right now (no input for at least `ms`)? */
export function isIdle(ms = IDLE_MS, t = now()) { return idleMs(t) >= ms; }

/** A status short enough to show while she plays (no wait, no pause). */
export function isShort(text, level = 4) {
  return wordCount(text) <= TEXT_LIMITS.status[level === 1 ? 1 : 4];
}

/** Is a card or a reading pause holding the play lock right now (src/play/ui.js)? */
function playLocked() {
  return typeof document !== 'undefined' && document.body?.dataset?.playModal === '1';
}

/**
 * Resolve once she has not touched the controls for `ms` AND no card or reading
 * pause is up (a card she did not ask for waits behind the one on screen).
 * `signal.cancelled` stops waiting.
 */
export function whenIdle(ms = IDLE_MS, signal = null) {
  install();
  return new Promise((resolve) => {
    const check = () => {
      if (signal?.cancelled) { resolve(false); return; }
      const left = ms - idleMs();
      const locked = playLocked();
      if (left <= 0 && !locked) { resolve(true); return; }
      setTimeout(check, locked ? 250 : Math.min(250, Math.max(50, left)));
    };
    check();
  });
}

/** Listen for keys, clicks, drags, wheel and touch (once per page). Call it at boot. */
export function install() {
  if (installed || typeof addEventListener === 'undefined') return;
  installed = true;
  const mark = () => noteInput();
  const opts = { capture: true, passive: true };
  addEventListener('keydown', mark, opts);
  addEventListener('pointerdown', mark, opts);
  addEventListener('wheel', mark, opts);
  addEventListener('touchstart', mark, opts);
  addEventListener('pointermove', (e) => { if (e.buttons) mark(); }, opts);
}

/** Tests only: forget the last input. */
export function resetInputForTests() { lastInput = -Infinity; }
