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
    difficulty: 'Level 1 • taking away',
    subject: 'Taking away',
    prompt: 'Pretend 8 rays hit. Rock stops 3. How many get through?',
    answers: ['5', 'five'],
    hint: 'Start at 8. Take away 3, one at a time.',
    parentHint: '8 − 3 = 5 (pretend numbers). Each metre of real rock cuts the rays in half.',
    success: 'Yes! 5 get through. Thick rock keeps badges safe.',
  },
  c6_leak_minutes: {
    difficulty: 'Level 1 • taking away',
    subject: 'Taking away',
    prompt: 'Pretend 10 cups. A leak takes 3. How many are left?',
    answers: ['7', 'seven', '7 cups'],
    hint: 'Start at 10. Count back 3 steps.',
    parentHint: '10 − 3 = 7 (pretend numbers). Level 4 asks how many minutes a real leak takes to empty a tank.',
    success: 'Yes! 7 cups are left. We fixed it in time!',
  },
  c6_light_delay: {
    difficulty: 'Level 1 • adding',
    subject: 'Adding',
    prompt: 'Pretend 5 minutes to the ship, then 6 to Earth. How long?',
    answers: ['11', 'eleven', '11 minutes', '11 min'],
    hint: 'Start at 5. Count on 6 more.',
    parentHint: '5 + 6 = 11 (pretend numbers). Real light takes about 5 minutes for every 100 million km, so Level 4 works out the real trip.',
    success: 'Yes! 11 minutes. Messages from far away take a while!',
  },
  c6_berries_each: {
    difficulty: 'Level 1 • adding',
    subject: 'Adding',
    prompt: 'Pretend Zara picks 4 berries, Mira picks 5. How many?',
    answers: ['9', 'nine'],
    hint: 'Start at 4. Count on 5 more.',
    parentHint: '4 + 5 = 9 (pretend numbers). Level 4 shares real berries out between the crew.',
    success: 'Yes! 9 berries. Mira and Zara picked them together.',
  },
};

export function partQuestsBank(level = 4) {
  if (level !== 1) return CH6Q_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6Q_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6Q_LEVEL1[id] || {}) }]));
}

/** Beat asked after each quest. */
export const QUEST_BEAT = { medbay: 'c6Medbay', coolant: 'c6Coolant', message: 'c6Message', pollen: 'c6Pollen' };
