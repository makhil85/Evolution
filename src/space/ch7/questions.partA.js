// Chapter 7, Part A question bank: the star map on the bridge. Two questions, on
// the numbers the opening and the map show: how long the trip takes at a tenth of
// light speed (119 years, which is why the drive goes to full power), and which
// of the five stars is nearest the Sun. Same schema as ch6/questions.partQuests.js:
// Level 4 entries plus a Level 1 overlay with the same ids. Numbers come from
// voyage.js and are re-derived in scripts/test-ch7-voyage.mjs.
import { NEIGHBOURS, TAU_CETI_LY, TAU_YEARS_AT_TENTH, TAU_LEVEL1_LY, TAU_LEVEL1_YEARS } from './voyage.js';

const ACT_A = 1;

const star = (id) => NEIGHBOURS.find((s) => s.id === id);
/** "Sirius, 8.6 light-years" (Level 4) or "Sirius, about 9 light-years" (Level 1). */
const starChoice = (id, l1 = false) => {
  const s = star(id);
  return `${s.name[0]}, ${l1 ? `about ${Math.round(s.ly)}` : s.ly.toFixed(1)} light-years`;
};
// Choices: the nearest is third, so it is not always first. Its text is not the longest.
const NEAREST_ORDER = ['sirius', 'eps', 'alpha', 'tau'];

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
    parentHint: 'Alpha Centauri is 4.4 light-years away, the nearest of these five. (Its neighbour Proxima Centauri is a little closer still, at about 4.2 light-years.)',
    success: 'Yes! Alpha Centauri is the nearest, at 4.4 light-years. Light takes 4.4 years to come from there.',
    doneMessage: 'Now we know the way!',
    reward: { science: 10 },
  },
};

export const CH7A_LEVEL1 = {
  c7_tau_years: {
    difficulty: 'Level 1 • times ten',
    prompt: `Light takes about ${TAU_LEVEL1_LY} years to get to a star like Tau Ceti. Suppose our ship is 10 times slower. How many years for the ship? (Type a number.)`,
    answers: [String(TAU_LEVEL1_YEARS), `${TAU_LEVEL1_YEARS} years`],
    hint: 'Count 12 ten times: 12, 24, 36, ...',
    parentHint: `10 times 12 is ${TAU_LEVEL1_YEARS}. So the ship would take ${TAU_LEVEL1_YEARS} years, which is far too long: the drive goes to full power.`,
    success: `Yes! ${TAU_LEVEL1_YEARS} years is far too long. So the drive goes to full power!`,
  },
  c7_nearest_star: {
    difficulty: 'Level 1 • the smallest',
    prompt: 'Look at the star map. Which star is the nearest to us?',
    choices: NEAREST_ORDER.map((id) => ({ text: starChoice(id, true), correct: id === 'alpha' })),
    hint: 'Which number is the smallest?',
    success: 'Yes! Alpha Centauri is the nearest. Its light takes about 4 years to reach us.',
  },
};
