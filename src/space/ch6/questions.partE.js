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
    prompt: 'Which way gives the ship speed for free, with no fuel?',
    choices: [
      { text: 'Swinging past a big planet that is moving', correct: true },
      { text: 'Falling in and out of the Sun, with no engine on' },
      { text: 'Burning fuel in the engine, which uses up the tank' },
      { text: 'Sitting still in space, doing nothing at all' },
    ],
    hint: 'Look back at the lesson: which planet pulled the ship along?',
    success: 'Yes! A big moving planet pulls the ship and gives it speed.',
  },
  c6_fuel_left: {
    difficulty: 'Level 1 • taking away',
    prompt: `Jupiter and Saturn get us going ${JS} km/s. With Uranus and Neptune too, we go ${JSUN} km/s. How many more km/s is that? (Type a number.)`,
    answers: [String(ICE), `${ICE} km/s`],
    hint: `Count up from ${JS} to ${JSUN}.`,
    parentHint: `${JSUN} − ${JS} = ${ICE}.`,
    success: `Right! ${ICE} more km/s.`,
  },
  c6_jupiter_boost: {
    difficulty: 'Level 1 • gravity',
    prompt: 'Jupiter gives the biggest push of all the planets. Why?',
    choices: [
      { text: 'It is the biggest planet, so its pull is strong', correct: true },
      { text: 'It is the closest planet to the Sun, so it is very hot' },
      { text: 'It has the most moons, and they can push the ship' },
      { text: 'It is a very cold planet, far away from us' },
    ],
    hint: 'Which planet is the biggest?',
    success: 'Yes! Jupiter is the biggest planet. Its pull is strong.',
  },
  c6_sun_dive: {
    difficulty: 'Level 1 • the front',
    prompt: 'The thick shield is at the front. Why not at the back too?',
    choices: [
      { text: 'Things hit the front as we fly, and rock is heavy.', correct: true },
      { text: 'Nothing ever hits the back of a ship at all.' },
      { text: 'Rock only works at the front of a ship.' },
      { text: 'Rock at the back would make the crew too hot to live.' },
    ],
    hint: 'Which way are we flying?',
    success: 'Yes! We fly forward, so the front gets hit. Heavy rock costs fuel to push.',
  },
  c6_percent_light: {
    difficulty: 'Level 1 • out of 100',
    prompt: 'Light’s bar is 20 blocks long. Our bar is 1 block long. If light’s bar were 100 blocks long, how long would ours be? (Type a number.)',
    answers: ['5', 'five'],
    hint: 'How many 20s make 100? Count: 20, 40, 60...',
    parentHint: '100 ÷ 20 = 5. Our bar is 5 out of every 100, which is 5%.',
    success: 'Yes! 5 blocks: our bar is 5 out of every 100 of light.',
  },
  c6_star_years: {
    difficulty: 'Level 1 • skip counting',
    prompt: 'Light takes 4 years to reach the star. Our ship takes 40 years. How many 4s make 40? (Type a number.)',
    answers: ['10', 'ten'],
    hint: '4, 8, 12, 16...',
    parentHint: '10 fours make 40. (Light: 4 years; the ship at a tenth of light speed: 40 years, ten times as long.)',
    success: 'Yes! 10 fours make 40. The ship is 10 times slower than light!',
  },
};

/** The bank at a Level (the overlay merged), like questions.space.js does for Chapter 4. */
export function partEBank(level = 4) {
  if (level !== 1) return CH6E_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6E_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6E_LEVEL1[id] || {}) }]));
}
