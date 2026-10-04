// The launcher's question Level (1 = 1st grade, 4 = 4th grade) and the one
// helper every player-facing string goes through:
//
//   t('Level 4 wording', 'Level 1 wording')
//
// Level 1 is read by 6-year-olds, so its lines are short, use everyday words
// and keep only what to do next. They keep the game's few fixed commands
// ("BURN NOW", "hold W", "Let go", "Coast", "Too fast") so the banners always
// say the same thing the same way. Level 4 text is unchanged.
//
// Read directly from the launcher's profile (like missions.js and the
// question bank), so it needs no other import; a missing or unreadable value
// means Level 4, the authored default.

export const LEVEL = (() => {
  try {
    return JSON.parse(localStorage.getItem('rocket_village_profile') || 'null')?.difficulty === 1 ? 1 : 4;
  } catch {
    return 4;
  }
})();

export const IS_LEVEL1 = LEVEL === 1;

/** Level 4 text, or its Level 1 version when playing Level 1. */
export function t(level4, level1) {
  return IS_LEVEL1 && level1 != null ? level1 : level4;
}
