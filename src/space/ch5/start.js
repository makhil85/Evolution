// Chapter 5 (Rings to a Star): where the chapter starts and what she brings.
//
// She left Europa at the end of Chapter 4, so Chapter 5 opens in orbit round
// Jupiter with the ship she finished there: every Chapter 4 upgrade built,
// wings folded, a full tank.

/** The act labels the mission panel shows (missions.js). */
export const CH5_ACT_TITLES = {
  1: 'Part A: To Saturn',
  2: 'Part B: The ice giants',
  3: 'Part B: The edge of the Sun’s family',
};

/** Her starting orbit: round Jupiter, outside Callisto (1700 u), so the
 *  first thing she does is leave. */
export const CH5_START = Object.freeze({ body: 'jupiter', radius: 2200, phase: 0 });

/** Everything she built in Chapter 4. */
export const CH5_UPGRADES = Object.freeze(['bigSolarWings', 'biggerTank', 'strongerClaw', 'radiationShield']);
