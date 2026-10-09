// Chapter 6, life on board question bank: one question after each quest, on
// the sum that quest is built on (halving the rays through the shield, the
// minutes until a tank is empty, light's trip to Earth, berries for each of us).
// Same schema as questions.partB.js. Numbers come from questsLogic.js and are
// re-derived in scripts/test-ch6-quests.mjs.
import { OUTSIDE_DOSE, DAY_LIMIT, doseThrough, COOLANT, coolantMinutes, LIGHT, lightMinutes, FARM, berriesEach } from './questsLogic.js';
import { CREW_SIZE } from './stationsLogic.js';

const ACT_Q = 2;

/** Metres of rock until a badge's dose is at the limit or under (each metre halves it). */
const metresToLimit = () => { let m = 0; while (doseThrough(OUTSIDE_DOSE, m) > DAY_LIMIT) m++; return m; };

export const CH6Q_QUESTIONS = {
  c6_dose_half: {
    id: 'c6_dose_half', type: 'text', act: ACT_Q, beat: 'c6Medbay',
    title: 'Behind the shield', subject: 'Halving', difficulty: 'Level 4',
    prompt: `Outside the shield a badge would get ${OUTSIDE_DOSE} units a day, and the limit is ${DAY_LIMIT}. Each metre of rock halves the rays. How many metres of rock bring a badge to the limit or under? (Type a number.)`,
    answers: [String(metresToLimit())],
    hint: `Halve ${OUTSIDE_DOSE}: that is ${OUTSIDE_DOSE / 2}. Is that ${DAY_LIMIT} or less? If not, halve again.`,
    parentHint: `${OUTSIDE_DOSE} / 2 = ${OUTSIDE_DOSE / 2} (still over ${DAY_LIMIT}); / 2 again = ${OUTSIDE_DOSE / 4} (under). So ${metresToLimit()} metres.`,
    success: `Yes! ${metresToLimit()} metres: ${doseThrough(OUTSIDE_DOSE, metresToLimit())} units a day, under the limit of ${DAY_LIMIT}. Bolt on the hull has just that much rock.`,
    doneMessage: 'Everyone is checked. Theo is happy!',
    reward: { science: 10 },
  },
  c6_leak_minutes: {
    id: 'c6_leak_minutes', type: 'text', act: ACT_Q, beat: 'c6Coolant',
    title: 'Running dry', subject: 'Division', difficulty: 'Level 4',
    prompt: `The coolant tank holds ${COOLANT.tankLitres} litres. The leak lets out ${COOLANT.leakPerMin} litres every minute. How many minutes until the tank is empty? (Type a number.)`,
    answers: [String(coolantMinutes()), `${coolantMinutes()} minutes`, `${coolantMinutes()} min`],
    hint: `How many ${COOLANT.leakPerMin}s make ${COOLANT.tankLitres}? Try 10 of them first.`,
    parentHint: `${COOLANT.tankLitres} ÷ ${COOLANT.leakPerMin} = ${coolantMinutes()} minutes. (${COOLANT.leakPerMin} × 10 = 250; 150 more is six more ${COOLANT.leakPerMin}s, so 10 + 6 = 16.)`,
    success: `Yes! ${coolantMinutes()} minutes. We fixed it in time, and the core is cool.`,
    doneMessage: 'The coolant flows. Bolt is pleased!',
    reward: { science: 10 },
  },
  c6_light_delay: {
    id: 'c6_light_delay', type: 'text', act: ACT_Q, beat: 'c6Message',
    title: 'The trip home', subject: 'Multiplication', difficulty: 'Level 4',
    prompt: `Light takes about ${LIGHT.minPerBillionKm} minutes to travel 1 billion km. The ship is in the asteroid belt, and Earth is ${LIGHT.earthMillionKm} million km away. How many minutes does a message take to reach Earth? (Type a number.)`,
    answers: [String(lightMinutes(LIGHT.earthMillionKm)), `${lightMinutes(LIGHT.earthMillionKm)} minutes`, `${lightMinutes(LIGHT.earthMillionKm)} min`],
    hint: `${LIGHT.earthMillionKm} million is 4 lots of 100 million. Light takes ${LIGHT.minPerBillionKm} ÷ 10 = 5.5 minutes for 100 million km.`,
    parentHint: `1 billion is 1000 million, so ${LIGHT.earthMillionKm} million is 0.4 of ${LIGHT.minPerBillionKm} minutes: ${LIGHT.minPerBillionKm} ÷ 10 = 5.5 minutes for each 100 million km, and 4 × 5.5 = ${lightMinutes(LIGHT.earthMillionKm)} minutes.`,
    success: `Yes! ${lightMinutes(LIGHT.earthMillionKm)} minutes one way. If Earth answers straight away, their reply reaches us about ${2 * lightMinutes(LIGHT.earthMillionKm)} minutes after we sent ours.`,
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
    success: `Yes! ${berriesEach()} berries each a week. Mira's brush did the bees' job, one flower at a time.`,
    doneMessage: 'The farm feeds us all. Mira is glad!',
    reward: { science: 10 },
  },
};

export const CH6Q_LEVEL1 = {
  c6_dose_half: {
    difficulty: 'Level 1 • halves',
    prompt: 'A badge gets 8 units a day outside the shield. Each metre of rock halves the rays. How many units get through 2 metres? (Type a number.)',
    answers: ['2', 'two'],
    hint: 'Half of 8 is 4. Half of 4 is...',
    parentHint: '8 / 2 = 4, then 4 / 2 = 2. (Metre 1 lets 4 through, metre 2 lets 2 through.)',
    success: 'Yes! Half of 8 is 4, and half of 4 is 2.',
  },
  c6_leak_minutes: {
    difficulty: 'Level 1 • counting by twos',
    prompt: 'The tank holds 10 cups. A leak drips 2 cups every minute. How many minutes until it is empty? (Type a number.)',
    answers: ['5', 'five', '5 min'],
    hint: 'Count by 2s: 2, 4, 6, ...',
    parentHint: '10 ÷ 2 = 5 minutes: 2, 4, 6, 8, 10.',
    success: 'Yes! 5 minutes.',
  },
  c6_light_delay: {
    difficulty: 'Level 1 • counting by tens',
    prompt: 'Light takes about 5 minutes to go 100 million km. Earth is 400 million km away. How many minutes does a message take? (Type a number.)',
    answers: ['20', 'twenty', '20 minutes', '20 min'],
    hint: 'Count 5 minutes for each 100 million km: 5, 10, 15, ...',
    parentHint: '4 lots of 5 minutes = 20 minutes. (Really it is 5.5 minutes per 100 million km, so about 22 minutes; Level 4 does the exact sum.)',
    success: 'Yes! About 20 minutes to reach Earth.',
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
