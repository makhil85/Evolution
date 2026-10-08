// Chapter 6, Part B question bank: one question after each habitat station,
// on the sum that station is built on (the plan's maths thread: halving
// shield layers, litres of oxygen a day, percent of water recycled, area,
// fractions, a mass budget with decimals). Same schema as Chapter 5's bank.
// Numbers come from the stations' own tables (stationsLogic.js) and are
// re-derived in scripts/test-ch6-route.mjs.
import { raysThrough, OXYGEN, CREW_SIZE, oxygenNeed, WATER, recycledPercent, tankDays, FOOD, foodNeed, GRID, PACK_LIMIT, packNeededMass } from './stationsLogic.js';

const ACT_B = 2;

export const CH6B_QUESTIONS = {
  c6_shield_half: {
    id: 'c6_shield_half', type: 'text', act: ACT_B, beat: 'c6Shield',
    title: 'Halving and halving', subject: 'Halving', difficulty: 'Level 4',
    prompt: `Each metre of rock stops half of the rays that reach it. If 160 rays hit the outside of the wall, how many get through 4 metres of rock? (Type a number.)`,
    answers: ['10'],
    hint: 'Halve it four times: 160 → 80 → ...',
    parentHint: '160 / 2 / 2 / 2 / 2 = 10. (The tempting wrong idea: stopping a quarter of what is left each metre gives about 51, not 10.)',
    success: `Yes! 160 → 80 → 40 → 20 → 10. Each metre halves it again, so ${6} metres lets in only ${raysThrough(6).toFixed(1)} of every 100.`,
    doneMessage: 'The shield is whole. Theo is happy!',
    reward: { science: 10 },
  },
  c6_oxygen_day: {
    id: 'c6_oxygen_day', type: 'text', act: ACT_B, beat: 'c6Oxygen',
    title: 'Air for five', subject: 'Multiplication', difficulty: 'Level 4',
    prompt: `Each of the ${CREW_SIZE} crew breathes ${OXYGEN.perPerson} litres of oxygen a day. How many litres do all of them breathe in one week (7 days)? (Type a number.)`,
    answers: [String(oxygenNeed() * 7), `${oxygenNeed() * 7} L`, (oxygenNeed() * 7).toLocaleString('en-US')],
    hint: `First one day: ${CREW_SIZE} x ${OXYGEN.perPerson}. Then times 7.`,
    parentHint: `${CREW_SIZE} x ${OXYGEN.perPerson} = ${oxygenNeed()} L a day; x 7 = ${oxygenNeed() * 7} L a week.`,
    success: `Yes! ${oxygenNeed() * 7} litres a week: that is why the algae never stop growing.`,
    doneMessage: 'The air is fresh. Next station!',
    reward: { science: 10 },
  },
  c6_water_percent: {
    id: 'c6_water_percent', type: 'text', act: ACT_B, beat: 'c6Water',
    title: 'Every drop again', subject: 'Percent', difficulty: 'Level 4',
    prompt: `The loop gets back ${WATER.backPerDay} of every ${WATER.usedPerDay} litres. The tank holds ${WATER.tank} litres. If only the lost water has to come from the tank, how many days does a full tank last? (Type a number.)`,
    answers: [String(tankDays()), `${tankDays()} days`],
    hint: `How many litres are lost each day? ${WATER.usedPerDay} − ${WATER.backPerDay}. Then how many of those fit in ${WATER.tank}?`,
    parentHint: `${WATER.usedPerDay} − ${WATER.backPerDay} = ${WATER.usedPerDay - WATER.backPerDay} L lost a day; ${WATER.tank} ÷ ${WATER.usedPerDay - WATER.backPerDay} = ${tankDays()} days. Without recycling it would last ${WATER.tank / WATER.usedPerDay} days.`,
    success: `Yes! ${tankDays()} days, instead of ${WATER.tank / WATER.usedPerDay} without the loop. ${recycledPercent()}% recycling makes the tank last 50 times longer.`,
    doneMessage: 'Clean water, again and again!',
    reward: { science: 10 },
  },
  c6_farm_area: {
    id: 'c6_farm_area', type: 'text', act: ACT_B, beat: 'c6Food',
    title: 'Room to grow', subject: 'Area', difficulty: 'Level 4',
    prompt: `Each square metre of farm grows ${FOOD.perSquareMetre} kg of food a day. Each person eats ${FOOD.perPerson} kg a day. How many square metres of farm do the ${CREW_SIZE} crew need? (Type a number.)`,
    answers: [String(foodNeed() / FOOD.perSquareMetre), `${foodNeed() / FOOD.perSquareMetre} m2`, `${foodNeed() / FOOD.perSquareMetre} m²`],
    hint: `Food for all of us: ${CREW_SIZE} x ${FOOD.perPerson} kg. Each square metre gives half a kilo.`,
    parentHint: `${foodNeed()} kg a day ÷ ${FOOD.perSquareMetre} kg per m² = ${foodNeed() / FOOD.perSquareMetre} m² (e.g. 2 m x 5 m).`,
    success: `Yes! ${foodNeed() / FOOD.perSquareMetre} m², like a bed 2 m by 5 m. A small farm, under bright lamps.`,
    doneMessage: 'The seeds are in!',
    reward: { science: 10 },
  },
  c6_grid_fraction: {
    id: 'c6_grid_fraction', type: 'choice', act: ACT_B, beat: 'c6Energy',
    title: 'A fair share', subject: 'Fractions', difficulty: 'Level 4',
    prompt: `The drive makes ${GRID.total} units of power. The air gets 4 units. What fraction of all the power is that?`,
    choices: [
      { text: '1/3', correct: true },
      { text: '1/4' },
      { text: '4/10' },
      { text: '1/12' },
    ],
    hint: `4 out of ${GRID.total}: how many 4s make ${GRID.total}?`,
    parentHint: `4/12 simplifies to 1/3 (divide top and bottom by 4). 4/10 is the trap of reading "4 out of something".`,
    success: 'Yes! 4/12 = 1/3: a third of all the power keeps us breathing.',
    doneMessage: 'Power shared fairly!',
    reward: { science: 10 },
  },
  c6_pack_mass: {
    id: 'c6_pack_mass', type: 'text', act: ACT_B, beat: 'c6Pack',
    title: 'Room to spare', subject: 'Decimals', difficulty: 'Level 4',
    prompt: `The limit is ${PACK_LIMIT.toFixed(1)} tonnes. Everything we need weighs ${packNeededMass()} tonnes. How many tonnes are left under the limit? (Type a number.)`,
    answers: [String(+(PACK_LIMIT - packNeededMass()).toFixed(1)), `${+(PACK_LIMIT - packNeededMass()).toFixed(1)} t`],
    hint: `${PACK_LIMIT.toFixed(1)} − ${packNeededMass()}: line the decimal points up.`,
    parentHint: `${PACK_LIMIT.toFixed(1)} − ${packNeededMass()} = ${(PACK_LIMIT - packNeededMass()).toFixed(1)} t. (The piano would fit, but every tonne costs fuel for years.)`,
    success: `Yes! ${(PACK_LIMIT - packNeededMass()).toFixed(1)} tonnes spare, and we keep it spare: less to push.`,
    doneMessage: 'All packed. The crew ring is ready!',
    reward: { science: 10 },
  },
};

export const CH6B_LEVEL1 = {
  c6_shield_half: {
    difficulty: 'Level 1 • halves',
    prompt: 'Each metre of rock stops half the rays. 8 rays hit the wall. How many get past 1 metre? (Type a number.)',
    answers: ['4', 'four'],
    hint: 'Half of 8 is...',
    parentHint: 'Half of 8 is 4. (Two metres would let 2 through, three metres just 1.)',
    success: 'Yes! Half of 8 is 4.',
  },
  c6_oxygen_day: {
    difficulty: 'Level 1 • adding',
    prompt: 'The algae make 6 bags of air. The ice splitter makes 4 more. How many bags in all? (Type a number.)',
    answers: ['10', 'ten'],
    hint: 'Start at 6 and count on 4.',
    parentHint: '6 + 4 = 10.',
    success: 'Yes! 10 bags of air.',
  },
  c6_water_percent: {
    difficulty: 'Level 1 • taking away',
    prompt: 'We use 10 cups of water. The loop cleans 9 cups to use again. How many cups are lost? (Type a number.)',
    answers: ['1', 'one'],
    hint: '10 take away 9.',
    parentHint: '10 − 9 = 1. Nearly all the water comes back.',
    success: 'Yes! Only 1 cup is lost.',
  },
  c6_farm_area: {
    difficulty: 'Level 1 • rows',
    prompt: 'The farm has 2 rows. Each row has 5 plants. How many plants? (Type a number.)',
    answers: ['10', 'ten'],
    hint: 'Count 5, then 5 more.',
    parentHint: '2 rows of 5 = 10.',
    success: 'Yes! 10 plants.',
  },
  c6_grid_fraction: {
    difficulty: 'Level 1 • sharing',
    prompt: 'We share 12 power blocks, the same amount for each of 3 things. How many blocks does each get?',
    choices: [{ text: '4', correct: true }, { text: '3' }, { text: '6' }, { text: '12' }],
    hint: 'Share 12 into 3 equal piles.',
    parentHint: '12 ÷ 3 = 4: each gets a third.',
    success: 'Yes! 4 each.',
  },
  c6_pack_mass: {
    difficulty: 'Level 1 • taking away',
    prompt: 'The ship can carry 10 boxes. We packed 8. How many more could fit? (Type a number.)',
    answers: ['2', 'two'],
    hint: 'Count up from 8 to 10.',
    parentHint: '10 − 8 = 2.',
    success: 'Yes! 2 more could fit. But we keep the space!',
  },
};

export function partBBank(level = 4) {
  if (level !== 1) return CH6B_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6B_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6B_LEVEL1[id] || {}) }]));
}

/** Beat asked after each station. */
export const STATION_BEAT = { shield: 'c6Shield', oxygen: 'c6Oxygen', water: 'c6Water', food: 'c6Food', energy: 'c6Energy', pack: 'c6Pack' };
