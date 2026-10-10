// Chapter 7, Part A question bank: the star map on the bridge. Two questions, on
// the numbers the opening and the map show: how long the trip takes at a tenth of
// light speed (119 years, which is why the drive goes to full power), and which
// of the four stars on the card is nearest the Sun. Same schema as
// ch6/questions.partQuests.js: Level 4 entries plus a Level 1 overlay with the
// same ids. Numbers come from voyage.js and are re-derived in
// scripts/test-ch7-voyage.mjs.
import { NEIGHBOURS, TAU_CETI_LY, TAU_YEARS_AT_TENTH, TAU_LEVEL1_LY } from './voyage.js';

const ACT_A = 1;

const star = (id) => NEIGHBOURS.find((s) => s.id === id);
/** "Sirius, 8.6 light-years" (Level 4) or "Sirius, about 9 light-years" (Level 1). */
const starChoice = (id, l1 = false) => {
  const s = star(id);
  return `${s.name[0]}, ${l1 ? `about ${Math.round(s.ly)}` : s.ly.toFixed(1)} light-years`;
};
// Choices: the nearest is third, so it is not always first. Its text is not the longest.
const NEAREST_ORDER = ['sirius', 'eps', 'alpha', 'tau'];
// Level 1: three star names, the nearest still third. Epsilon Eridani is longer, so the right name is not the longest.
const NEAREST_L1_ORDER = ['sirius', 'eps', 'alpha'];
// Level 1 sum (pretend numbers, only adding): 12 + 3 = 15.
const TAU_PRETEND_MORE = 3;
const TAU_LEVEL1_SUM = TAU_LEVEL1_LY + TAU_PRETEND_MORE;

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH7A_QUESTIONS = {
  c7_tau_years: {
    id: 'c7_tau_years',
    type: 'text',
    act: ACT_A,
    beat: 'c7StarMap',
    title: 'The long way',
    subject: 'Times',
    difficulty: 'Level 4',
    prompt:
      `Light takes ${TAU_CETI_LY} years to get to Tau Ceti. Suppose our ship went at only 10% of light speed, one tenth as fast as light. ` +
      'How many years would the trip take at that speed? (Type a number.)',
    answers: [String(TAU_YEARS_AT_TENTH), `${TAU_YEARS_AT_TENTH} years`],
    hint: 'One tenth as fast means ten times as long.',
    parentHint: `${TAU_CETI_LY} ÷ 0.1 = ${TAU_YEARS_AT_TENTH} years. At 10% of light speed a trip to Tau Ceti would take a very long time, so the drive goes to full power.`,
    success: `Yes! ${TAU_YEARS_AT_TENTH} years at a tenth of light speed. So the drive goes to full power, and we push on.`,
    doneMessage: 'Full power, then!',
    reward: { science: 10 },
  },
  c7_nearest_star: {
    id: 'c7_nearest_star',
    type: 'choice',
    act: ACT_A,
    beat: 'c7Nearest',
    title: 'The nearest neighbour',
    subject: 'Comparing',
    difficulty: 'Level 4',
    prompt: 'Look at the star map. Which of these stars is the nearest to the Sun?',
    choices: NEAREST_ORDER.map((id) => ({ text: starChoice(id), correct: id === 'alpha' })),
    hint: 'Nearest means the smallest number of light-years.',
    parentHint: 'Alpha Centauri is 4.4 light-years away, the nearest of these four. (Its neighbour Proxima Centauri is a little closer still, at about 4.2 light-years.)',
    success: 'Yes! Alpha Centauri is the nearest of these, at 4.4 light-years. Light takes 4.4 years to come from there.',
    doneMessage: 'Now we know the way!',
    reward: { science: 10 },
  },
};

export const CH7A_LEVEL1 = {
  c7_tau_years: {
    title: 'Ten times slower', subject: 'Ten lots', difficulty: 'Level 1 • times ten',
    prompt: `Light takes ${TAU_LEVEL1_LY} years. Pretend our ship takes ${TAU_PRETEND_MORE} years more. How many years?`,
    answers: [String(TAU_LEVEL1_SUM), `${TAU_LEVEL1_SUM} years`],
    hint: `Start with ${TAU_LEVEL1_LY}. Add ${TAU_PRETEND_MORE} more.`,
    parentHint: `${TAU_LEVEL1_LY} + ${TAU_PRETEND_MORE} = ${TAU_LEVEL1_SUM}. The numbers are pretend, to practise adding. The real trip to Tau Ceti at a tenth of light speed takes far longer (Level 4).`,
    success: `Yes! ${TAU_LEVEL1_SUM} years. Pretend numbers, for adding.`,
  },
  c7_nearest_star: {
    title: 'Our closest star', subject: 'Smallest', difficulty: 'Level 1 • the smallest',
    prompt: 'Look at the map. Which star is nearest to us?',
    choices: NEAREST_L1_ORDER.map((id) => ({ text: star(id).name[1], correct: id === 'alpha' })),
    hint: 'Which star is closest to the Sun on the map?',
    success: 'Yes! Alpha Centauri is nearest of these, about 4 light-years.',
  },
};
