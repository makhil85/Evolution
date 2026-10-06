// Which chapter this page is. Chapters 5 and 6 run on the Chapter 4 space
// engine: chapter5.html / chapter6.html say so with <html data-chapter="5">
// (or "6"), and the chapter picks the mission chain, the save keys, the start
// and the opening. Anything else (node tests) is Chapter 4.
export const CHAPTER = (() => {
  try {
    const n = Number(globalThis.document?.documentElement?.dataset?.chapter);
    return n === 5 || n === 6 ? n : 4;
  } catch {
    return 4;
  }
})();

export const IS_CH5 = CHAPTER === 5;
export const IS_CH6 = CHAPTER === 6;
/** The outer solar system engine (Pluto, the cruise warp, long windows, the
 *  Kuiper belt): Chapters 5 and 6 both fly out there. */
export const OUTER = CHAPTER >= 5;
