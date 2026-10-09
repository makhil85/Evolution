// Chapter 7 (Toward Tau Ceti): where the chapter starts and its act labels.
//
// Chapter 6 ended with the starship cruising out at a tenth of light speed.
// Chapter 7 (lead 2026-10-08): the drive goes to full power and the ship
// leaves the Sun behind for Tau Ceti, a Sun-like star 11.9 light-years away
// that may have planets (nobody knows yet if anything lives there). Most of
// the chapter happens inside the ship: feeling the push, zero-g, chemistry and
// biology in the rooms, and a quasar visited in the holodeck. The plan, the
// numbers and who builds what: CHAPTER7_PLAN.md.
import { t } from '../level.js';

/** The act labels the mission panel shows (missions.js). */
export const CH7_ACT_TITLES = {
  1: t('Part A: Leaving the Sun', 'Part A: Bye bye, Sun'),
  2: t('Part B: Feel the push', 'Part B: Feel the push'),
  3: t('Part C: Chemistry and life on board', 'Part C: Science on the ship'),
  4: t('Part D: The holodeck', 'Part D: The holodeck'),
  5: t('Part E: Toward Tau Ceti', 'Part E: Off to Tau Ceti'),
};

/** Her starting place: far past the Kuiper belt (KUIPER.outer is 78,000 u), heading out. */
export const CH7_START = Object.freeze({ body: 'sun', radius: 90000, phase: 0.4 });
