// How long words a child reads stay on screen (lead 2026-10-09).
//
// "When you write something for kids to read, make sure it stays up for
// 5-10 s, even if you have to pause the game and wait for a click." Kids read
// slowly, Level 1 kids most of all. Every toast, banner, film caption and
// card line that disappears by itself uses readMs(); text too long to read in
// READ_MAX_MS (needsClick) is shown so it waits for a click instead (a card
// with an OK button, the game paused under it).
//
// Shared by Chapters 1-7: src/game/hud.js, src/space/hud/*, the films
// (src/game/chapterStory.js, src/space/cinematics.js) and the lesson films.

export const READ_MIN_MS = 5000;
export const READ_MAX_MS = 10000;
const BASE_MS = 1500;     // to notice the text and start reading
const PER_WORD_MS = 330;  // a slow young reader (about 180 words a minute)

/** Words in a string (or in an array of strings), ignoring emoji and symbols. */
export function wordCount(text) {
  const s = Array.isArray(text) ? text.join(' ') : String(text ?? '');
  return (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,-]*/gu) || []).length;
}

/** The unclamped reading time for some text, in ms. */
function rawMs(text) { return BASE_MS + PER_WORD_MS * wordCount(text); }

/** How long text should stay up by itself: never under 5 s, never over 10 s. */
export function readMs(text) {
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, rawMs(text)));
}

/** True when the text needs more than 10 s: show it so it waits for a click. */
export function needsClick(text) { return rawMs(text) > READ_MAX_MS; }
