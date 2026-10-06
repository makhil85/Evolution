// Chapter 6 (The Long Trip): where the chapter starts and its act labels.
//
// Chapter 5 ended on the rock ship's first test fire, in the Kuiper belt out
// past Neptune. Chapter 6 opens there: the half-built rock ship (Rock B) in a
// slow orbit round the Sun, her own ship beside it.

/** The act labels the mission panel shows (missions.js). */
export const CH6_ACT_TITLES = {
  1: 'Part A: The crew arrives',
  2: 'Part B: Build the living half',
  3: 'Part C: A tiny Earth',
  6: 'Part E: Steal speed, then go',
};

/** Her starting orbit: round the Sun in the Kuiper belt, by Rock B. */
export const CH6_START = Object.freeze({ body: 'sun', radius: 62000, phase: 0.4 });
