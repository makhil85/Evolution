// Chapter 6, Part E question bank: the way out of the Sun's family, light
// speed and the trip to a star. About one maths question for every science
// question. Same schema as Chapter 5's bank (questions.ch5.js): type
// 'choice' or 'text', act, beat. Act 6 is Part E (ch6/start.js).
//
// Every numeric answer is re-derived in scripts/test-ch6-route.mjs, from the
// same model the planner uses (routes.js), so a retune can't leave a
// question wrong.
import { LIGHT_KMS, CRUISE_PERCENT, FUELS, NEAREST_STAR_LY, bestPlan, planTotals, yearsAt } from './routes.js';

const ACT_E = 6;

// The sums the questions use, from the planner's own model (10 t of fuel).
const FUEL = FUELS[0];
const JS = planTotals(bestPlan('js', FUEL)).speed;
const JSUN = planTotals(bestPlan('jsun', FUEL)).speed;
const ICE = JSUN - JS;
const fmt = (n) => n.toLocaleString('en-US');
// The trip to the nearest star (Proxima Centauri, 4.2 light years) at the cruise speed.
const SHIP_YEARS = Math.round(yearsAt(NEAREST_STAR_LY, CRUISE_PERCENT));

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH6E_QUESTIONS = {
  c6_route_sum: {
    id: 'c6_route_sum',
    type: 'choice',
    act: ACT_E,
    beat: 'c6RouteSum',
    title: 'Speed for free',
    subject: 'Energy',
    difficulty: 'Level 4',
    prompt: 'Zara needs more speed, and the fuel is limited. Which way gives the ship speed without using any fuel?',
    choices: [
      { text: 'Swinging past a big planet that is moving, like Jupiter', correct: true },
      { text: 'Falling into the Sun and climbing back out, with no engine' },
      { text: 'Burning more of the fuel in the engine, right away' },
      { text: 'Coasting in a straight line through empty space' },
    ],
    hint: 'Remember the lesson: what can pull a ship along without fuel?',
    parentHint: 'A planet moving round the Sun pulls a passing ship along and hands it some of its speed. The Sun alone takes back on the way out what it gave on the way in, so it gives nothing for free.',
    success: 'Yes! A moving planet can give speed for free. The Sun on its own cannot: it takes back what it gives.',
    doneMessage: 'Now plan the fastest way out!',
    reward: { science: 10 },
  },

  c6_fuel_left: {
    id: 'c6_fuel_left',
    type: 'text',
    act: ACT_E,
    beat: 'c6FuelLeft',
    title: 'What the ice giants add',
    subject: 'Subtraction',
    difficulty: 'Level 4',
    prompt:
      `With ${FUEL} t of fuel, flying past Jupiter and Saturn leaves the Sun’s family at ${JS} km/s. ` +
      `Adding flybys of Uranus and Neptune too makes it ${JSUN} km/s. How many km/s did Uranus and Neptune add? (Type a number.)`,
    answers: [String(ICE), `${ICE} km/s`],
    hint: `Take the smaller speed away from the bigger one: ${JSUN} − ${JS}.`,
    parentHint: `${JSUN} − ${JS} = ${ICE}. Uranus and Neptune are ice giants: smaller and lighter than Jupiter and Saturn, so they steal less energy.`,
    success: `Right! ${ICE} km/s more. Uranus and Neptune are ice giants: they help less than Jupiter and Saturn.`,
    doneMessage: 'Plan made! Time to fly it.',
    reward: { science: 10 },
  },

  c6_jupiter_boost: {
    id: 'c6_jupiter_boost',
    type: 'choice',
    act: ACT_E,
    beat: 'c6JupiterBoost',
    title: 'The best slingshot',
    subject: 'Gravity and momentum',
    difficulty: 'Level 4',
    prompt: 'Of all the planets, a flyby of Jupiter steals the most energy. Why Jupiter?',
    choices: [
      { text: 'It is the heaviest planet, so its pull bends the path most', correct: true },
      { text: 'It has the most rings, and their dust pulls the ship in hard' },
      { text: 'It has the most moons, and each moon gives the ship a little push' },
      { text: 'It is the coldest planet, so its cold air grips the ship tight' },
    ],
    hint: 'Think of Space pool: which ball is heavy enough to give the most push?',
    parentHint: 'Jupiter has more than twice the mass of all the other planets put together, and moves at about 13 km/s round the Sun: that is the momentum a slingshot borrows.',
    success: 'Yes! Jupiter is the heavyweight: more than twice all the other planets put together.',
    doneMessage: 'Fusion drive next!',
    reward: { science: 10 },
  },

  c6_sun_dive: {
    id: 'c6_sun_dive',
    type: 'choice',
    act: ACT_E,
    beat: 'c6SunDive',
    title: 'Only at the front',
    subject: 'Shields',
    difficulty: 'Level 4',
    prompt: 'The thick shield is at the front of the ship, not all round it. Why only at the front?',
    choices: [
      { text: 'Everything we fly into hits from the front, and extra rock costs fuel to push', correct: true },
      { text: 'The back of the ship is always in the Sun’s shadow, so it needs no rock at all' },
      { text: 'Rock only stops rays when it sits on the front of a ship, not the back' },
      { text: 'Thick rock at the back would warm the crew up from behind, so it stays at the front' },
    ],
    hint: 'Think about which way the ship is flying, and what the rays and dust hit first.',
    parentHint: 'At a tenth of light speed, thin gas and dust hit like bullets from the way the ship flies. Only the front needs thick armour, and every extra tonne of rock costs fuel to push.',
    success: 'Yes! Everything we fly into comes from the front. Rock all round would only add weight, and weight costs fuel.',
    doneMessage: 'Fusion drive on!',
    reward: { science: 10 },
  },

  c6_percent_light: {
    id: 'c6_percent_light',
    type: 'text',
    act: ACT_E,
    beat: 'c6PercentLight',
    title: 'Percent of light',
    subject: 'Percent',
    difficulty: 'Level 4',
    prompt:
      `The drive has the ship going ${fmt(LIGHT_KMS / 20)} km/s. Light is 20 times faster than that. ` +
      'What percent of light speed is the ship? (Type a number.)',
    answers: ['5', '5%', '5 %', '5 percent'],
    hint: 'What is 100 divided by 20?',
    parentHint: `${fmt(LIGHT_KMS)} ÷ ${fmt(LIGHT_KMS / 20)} = 20, so the ship is 1/20 of light speed, and 100 ÷ 20 = 5%.`,
    success: `Yes! 5%. Halfway to the cruise speed of ${CRUISE_PERCENT}%.`,
    doneMessage: 'The drive keeps pushing...',
    reward: { science: 10 },
  },

  c6_star_years: {
    id: 'c6_star_years',
    type: 'text',
    act: ACT_E,
    beat: 'c6StarYears',
    title: 'How long to the stars?',
    subject: 'Distance, speed and time',
    difficulty: 'Level 4',
    prompt:
      `Light takes ${NEAREST_STAR_LY} years to reach the nearest star, Proxima Centauri. ` +
      `Our ship takes ${SHIP_YEARS} years. How many times slower than light is the ship? (Type a number.)`,
    answers: ['10', '10 times'],
    hint: `Divide the ship's years by light's years: ${SHIP_YEARS} ÷ ${NEAREST_STAR_LY}.`,
    parentHint: `${SHIP_YEARS} ÷ ${NEAREST_STAR_LY} = 10. At ${CRUISE_PERCENT}% of light speed the ship is 10 times slower, so the trip takes 10 times as long: ${SHIP_YEARS} years, not ${NEAREST_STAR_LY}.`,
    success: `Yes! 10 times slower: ${SHIP_YEARS} years, not ${NEAREST_STAR_LY}. A long trip: that is why the ship has to be a home, a farm and a shield all at once.`,
    doneMessage: 'To be continued...',
    reward: { science: 10 },
  },
};

/** Level 1 overlay (2nd grade): same ids, same answers' meaning, easier numbers where needed. */
export const CH6E_LEVEL1 = {
  c6_route_sum: {
    difficulty: 'Level 1 • free speed',
    prompt: 'Which way gives the ship speed with no fuel?',
    choices: [{ text: 'Swing by Jupiter', correct: true }, { text: 'Burn lots of fuel' }, { text: 'Sit very still' }],
    hint: 'Which big planet pulled the ship along?',
    parentHint: 'A planet moving round the Sun pulls a passing ship along and gives it some of its speed. Burning fuel uses up the tank.',
    success: 'Yes! Jupiter pulls the ship and gives it speed.',
  },
  c6_fuel_left: {
    difficulty: 'Level 1 • taking away',
    subject: 'Taking away',
    prompt: 'Pretend: speed 9 without Neptune, 11 with it. How much more?',
    answers: ['2', 'two'],
    hint: 'Start at 9. Count up to 11. How many steps?',
    parentHint: '11 − 9 = 2 (pretend numbers). Real Uranus and Neptune add less speed than Jupiter and Saturn.',
    success: 'Yes! Neptune helps a little, and Jupiter helps most.',
  },
  c6_jupiter_boost: {
    difficulty: 'Level 1 • gravity',
    subject: 'Gravity',
    prompt: 'Jupiter gives the biggest push to a ship. Why?',
    choices: [{ text: 'It is very hot' }, { text: 'It is very tiny' }, { text: 'Biggest of all', correct: true }],
    hint: 'Think about how big Jupiter is. Big planets pull hard.',
    parentHint: 'Jupiter is the heaviest planet, so its pull bends a passing ship’s path the most.',
    success: 'Yes! Jupiter is the biggest. Its pull is strong!',
  },
  c6_sun_dive: {
    difficulty: 'Level 1 • the front',
    subject: 'Shields',
    prompt: 'The shield is at the front. Why not the back too?',
    choices: [{ text: 'Rock makes it fly' }, { text: 'Rock is too pink' }, { text: 'Front gets hit', correct: true }],
    hint: 'Which way are we flying? What gets hit first?',
    parentHint: 'The ship flies forward, so gas and dust hit the front first. Every extra tonne of rock costs fuel to push.',
    success: 'Yes! We fly forward, so the front gets hit first.',
  },
  c6_percent_light: {
    difficulty: 'Level 1 • how far ahead',
    subject: 'Taking away',
    prompt: 'Pretend light goes 20 blocks, and we go 1. How many more?',
    answers: ['19', 'nineteen', '19 blocks'],
    hint: 'Start at 1. Count up to 20.',
    parentHint: '20 − 1 = 19 (pretend blocks). Real light is about 20 times faster than our ship, so in the same time it goes 20 times as far.',
    success: 'Yes! Light goes 19 blocks more in the same time.',
  },
  c6_star_years: {
    difficulty: 'Level 1 • adding',
    subject: 'Adding',
    prompt: 'Pretend light takes 4 years. The ship takes 6 more. How long?',
    answers: ['10', 'ten', '10 years'],
    hint: 'Start at 4. Count on 6 more.',
    parentHint: '4 + 6 = 10 (pretend numbers). Real light takes about 4 years to reach the nearest star, and our ship about 40 years.',
    success: 'Yes! 10 years for the ship. Light is much quicker!',
  },
};

/** The bank at a Level (the overlay merged), like questions.space.js does for Chapter 4. */
export function partEBank(level = 4) {
  if (level !== 1) return CH6E_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6E_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6E_LEVEL1[id] || {}) }]));
}
