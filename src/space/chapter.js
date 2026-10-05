// Which chapter this page is. Chapter 5 (Rings to a Star, CHAPTER5_PLAN.md)
// runs on the Chapter 4 space engine: chapter5.html says so with
// <html data-chapter="5">, and the chapter picks the mission chain, the save
// keys, the start and the opening. Anything else (node tests) is Chapter 4.
export const CHAPTER = (() => {
  try {
    return Number(globalThis.document?.documentElement?.dataset?.chapter) === 5 ? 5 : 4;
  } catch {
    return 4;
  }
})();

export const IS_CH5 = CHAPTER === 5;
