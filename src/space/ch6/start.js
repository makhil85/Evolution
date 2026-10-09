// Chapter 6 (The Long Trip): where the chapter starts and its act labels.
//
// Chapter 5 ended at the edge of the Sun's family. Chapter 6 opens back in
// the asteroid belt (lead 2026-10-07): the ship for the stars is built there,
// where the rock, ice and metal are, then she plans the fastest way out.

/** The act labels the mission panel shows (missions.js). */
export const CH6_ACT_TITLES = {
  0: 'Build the starship',
  1: 'Part A: The crew arrives',
  2: 'Part B: Fit out the ring',
  3: 'Part C: A tiny Earth',
  6: 'Part E: The fastest way out',
};

/** Her starting orbit: round the Sun in the asteroid belt (BELT 11,000-13,500 u). */
export const CH6_START = Object.freeze({ body: 'sun', radius: 11800, phase: 0.4 });
