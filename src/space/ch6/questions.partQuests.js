// Chapter 6, life on board question bank: one question after each quest, on
// the sum that quest is built on (halving the rays through the shield, the
// minutes until a tank is empty, light's trip home, berries for each of us).
// Same schema as questions.partB.js. Numbers come from questsLogic.js and are
// re-derived in scripts/test-ch6-quests.mjs.
import { OUTSIDE_DOSE, DAY_LIMIT, doseThrough, COOLANT, coolantMinutes, LIGHT, lightHours, FARM, berriesEach } from './questsLogic.js';
import { CREW_SIZE } from './stationsLogic.js';

const ACT_Q = 2;

export const CH6Q_QUESTIONS = {
  c6_dose_half: {
    id: 'c6_dose_half', type: 'text', act: ACT_Q, beat: 'c6Medbay',
    title: 'Behind the rock', subject: 'Halving', difficulty: 'Level 4',
    prompt: `Outside the shield a badge would get ${OUTSIDE_DOSE} units a day. Each metre of shield halves it. How many units a day would a badge get through 3 metres? (Type a number.)`,
    answers: [String(doseThrough(OUTSIDE_DOSE, 3))],
    hint: `Halve it once for each metre: ${OUTSIDE_DOSE} → ${OUTSIDE_DOSE / 2} → ...`,
    parentHint: `${OUTSIDE_DOSE} / 2 / 2 / 2 = ${doseThrough(OUTSIDE_DOSE, 3)}. Three halvings are the same as dividing by 8.`,
    success: `Yes! ${doseThrough(OUTSIDE_DOSE, 3)} units a day, well under the limit of ${DAY_LIMIT}. The rock does its job.`,
    doneMessage: 'Everyone is checked. Theo is happy!',
    reward: { science: 10 },
  },
  c6_leak_minutes: {
    id: 'c6_leak_minutes', type: 'text', act: ACT_Q, beat: 'c6Coolant',
    title: 'Running dry', subject: 'Division', difficulty: 'Level 4',
    prompt: `The coolant tank holds ${COOLANT.tankLitres} litres. The leak lets out ${COOLANT.leakPerMin} litres every minute. How many minutes until the tank is empty? (Type a number.)`,
    answers: [String(coolantMinutes()), `${coolantMinutes()} minutes`],
    hint: `How many ${COOLANT.leakPerMin}s make ${COOLANT.tankLitres}? Try 10 of them first.`,
    parentHint: `${COOLANT.tankLitres} ÷ ${COOLANT.leakPerMin} = ${coolantMinutes()} minutes. (${COOLANT.leakPerMin} × 10 = 250, and 6 more makes 400.)`,
    success: `Yes! ${coolantMinutes()} minutes. We fixed it in time, and the core is cool.`,
    doneMessage: 'The coolant flows. Bolt is pleased!',
    reward: { science: 10 },
  },
  c6_light_delay: {
    id: 'c6_light_delay', type: 'text', act: ACT_Q, beat: 'c6Message',
    title: 'The long way home', subject: 'Multiplication', difficulty: 'Level 4',
    prompt: `Light takes about ${LIGHT.minPerBillionKm} minutes to travel 1 billion km. Earth is ${LIGHT.earthBillionKm} billion km from the ship. About how many hours does a message take to get there? (Type a number.)`,
    answers: [String(lightHours(LIGHT.earthBillionKm)), `${lightHours(LIGHT.earthBillionKm)} hours`],
    hint: `First ${LIGHT.earthBillionKm} × ${LIGHT.minPerBillionKm} minutes. Then divide by 60 to get hours.`,
    parentHint: `${LIGHT.earthBillionKm} × ${LIGHT.minPerBillionKm} = ${LIGHT.earthBillionKm * LIGHT.minPerBillionKm} minutes; ÷ 60 = ${lightHours(LIGHT.earthBillionKm)} hours (5 hours and 30 minutes).`,
    success: `Yes! ${lightHours(LIGHT.earthBillionKm)} hours one way. Earth hears us and answers about eleven hours later.`,
    doneMessage: 'The message is on its way home!',
    reward: { science: 10 },
  },
  c6_berries_each: {
    id: 'c6_berries_each', type: 'text', act: ACT_Q, beat: 'c6Pollen',
    title: 'Berries for everyone', subject: 'Sharing', difficulty: 'Level 4',
    prompt: `The farm has ${FARM.plants} strawberry plants. Each plant gives ${FARM.berriesPerWeek} berries a week. The ${CREW_SIZE} of us share them out equally. How many berries does each person get in a week? (Type a number.)`,
    answers: [String(berriesEach())],
    hint: `First the berries from all the plants: ${FARM.plants} × ${FARM.berriesPerWeek}. Then share them into ${CREW_SIZE} equal piles.`,
    parentHint: `${FARM.plants} × ${FARM.berriesPerWeek} = ${FARM.plants * FARM.berriesPerWeek} berries; ÷ ${CREW_SIZE} = ${berriesEach()} each.`,
    success: `Yes! ${berriesEach()} berries each a week. Mira's flowers did that, one by one.`,
    doneMessage: 'The farm feeds us all. Mira is glad!',
    reward: { science: 10 },
  },
};

export const CH6Q_LEVEL1 = {
  c6_dose_half: {
    difficulty: 'Level 1 • halves',
    prompt: 'A badge gets 8 units a day outside the rock. Each metre of rock halves it. How many get through 1 metre? (Type a number.)',
    answers: ['4', 'four'],
    hint: 'Half of 8 is...',
    parentHint: 'Half of 8 is 4. (Two metres would let 2 through.)',
    success: 'Yes! Half of 8 is 4.',
  },
  c6_leak_minutes: {
    difficulty: 'Level 1 • counting by twos',
    prompt: 'The tank holds 10 cups. A leak drips 2 cups every minute. How many minutes until it is empty? (Type a number.)',
    answers: ['5', 'five'],
    hint: 'Count by 2s: 2, 4, 6, ...',
    parentHint: '10 ÷ 2 = 5 minutes: 2, 4, 6, 8, 10.',
    success: 'Yes! 5 minutes.',
  },
  c6_light_delay: {
    difficulty: 'Level 1 • counting hours',
    prompt: 'Light takes 1 hour to go 1 billion km. Earth is 5 billion km away. How many hours does a message take? (Type a number.)',
    answers: ['5', 'five'],
    hint: 'One hour for each billion km.',
    parentHint: '5 billion km is 5 hours.',
    success: 'Yes! 5 hours one way.',
  },
  c6_berries_each: {
    difficulty: 'Level 1 • counting by twos',
    prompt: 'The farm has 10 strawberry plants. Each plant gives 2 berries. How many berries in all? (Type a number.)',
    answers: ['20', 'twenty'],
    hint: 'Count by 2s, ten times.',
    parentHint: '10 × 2 = 20.',
    success: 'Yes! 20 berries.',
  },
};

export function partQuestsBank(level = 4) {
  if (level !== 1) return CH6Q_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6Q_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6Q_LEVEL1[id] || {}) }]));
}

/** Beat asked after each quest. */
export const QUEST_BEAT = { medbay: 'c6Medbay', coolant: 'c6Coolant', message: 'c6Message', pollen: 'c6Pollen' };
