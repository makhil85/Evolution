// Chapter 6, Part E question bank (steps 13-18): about one maths question
// for every science question, as the plan's maths thread asks: add the
// slingshot boosts, the fuel left, percent of light speed, and distance =
// speed x time to the nearest star. Same schema as Chapter 5's bank
// (questions.ch5.js): type 'choice' or 'text', act, beat. Act 6 is Part E
// (ch6/start.js).
//
// Every numeric answer is re-derived in scripts/test-ch6-route.mjs, from the
// same tables the games use (routes.js), so a retune can't leave a question
// wrong.
import { STOPS, START_SPEED, FUEL_BUDGET, LIGHT_KMS, CRUISE_PERCENT } from './routes.js';

const ACT_E = 6;

// The sums the questions use, from the game's own tables.
const NEP = STOPS.neptune.boost[2]; const JUP = STOPS.jupiter.boost[2]; const SUN = STOPS.sun.boost[3]; // close, close, skimming
const ROUTE_END = START_SPEED + NEP + JUP + SUN;
const FUEL_USED = STOPS.neptune.fuel[2] + STOPS.jupiter.fuel[2] + STOPS.sun.fuel[3];
const FUEL_LEFT = FUEL_BUDGET - FUEL_USED;
const fmt = (n) => n.toLocaleString('en-US');

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH6E_QUESTIONS = {
  c6_route_sum: {
    id: 'c6_route_sum',
    type: 'text',
    act: ACT_E,
    beat: 'c6RouteSum',
    title: 'Adding up the boosts',
    subject: 'Addition',
    difficulty: 'Level 4',
    prompt:
      `At the edge she is going ${START_SPEED} km/s. A close pass of Neptune adds ${NEP} km/s, a close pass of Jupiter adds ${JUP} km/s, ` +
      `and the Sun dive adds ${SUN} km/s. How fast is she going after all three? (Type a number.)`,
    answers: [String(ROUTE_END), `${ROUTE_END} km/s`],
    hint: `Start at ${START_SPEED} and add each boost in turn.`,
    parentHint: `${START_SPEED} + ${NEP} + ${JUP} + ${SUN} = ${ROUTE_END}. (Forgetting the starting speed gives ${ROUTE_END - START_SPEED}.)`,
    success: `Yes! ${ROUTE_END} km/s. Every slingshot adds to the total.`,
    doneMessage: 'Now fly the route!',
    reward: { science: 10 },
  },

  c6_fuel_left: {
    id: 'c6_fuel_left',
    type: 'text',
    act: ACT_E,
    beat: 'c6FuelLeft',
    title: 'Fuel for steering',
    subject: 'Subtraction',
    difficulty: 'Level 4',
    prompt:
      `The steering tank holds ${FUEL_BUDGET} tonnes. Steering past Neptune uses ${STOPS.neptune.fuel[2]} t, past Jupiter ${STOPS.jupiter.fuel[2]} t, ` +
      `and the Sun dive ${STOPS.sun.fuel[3]} t. How many tonnes are left over for emergencies? (Type a number.)`,
    answers: [String(FUEL_LEFT), `${FUEL_LEFT} t`, `${FUEL_LEFT} tonnes`],
    hint: 'Add up what the three passes use, then take that away from the tank.',
    parentHint: `${STOPS.neptune.fuel[2]} + ${STOPS.jupiter.fuel[2]} + ${STOPS.sun.fuel[3]} = ${FUEL_USED}; ${FUEL_BUDGET} − ${FUEL_USED} = ${FUEL_LEFT}.`,
    success: `Right! ${FUEL_LEFT} tonnes spare. A good pilot always keeps some back.`,
    doneMessage: 'Plan made! First: how does a slingshot work?',
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
    prompt: 'Of all the planets, a close pass of Jupiter gives the biggest slingshot boost. Why Jupiter?',
    choices: [
      { text: 'It is the heaviest planet, so its pull swings the ship hardest and it has the most momentum to share', correct: true },
      { text: 'It is the closest planet to the Sun' },
      { text: 'It has the most moons to push the ship' },
      { text: 'It is the coldest planet' },
    ],
    hint: 'Think of Space pool: which rock could give the most push away without slowing down much?',
    parentHint: 'Jupiter has more than twice the mass of all the other planets put together, and moves at about 13 km/s round the Sun: that is the momentum a slingshot borrows.',
    success: 'Yes! Jupiter is the heavyweight: more than twice all the other planets put together.',
    doneMessage: 'Next stop: the Sun dive.',
    reward: { science: 10 },
  },

  c6_sun_dive: {
    id: 'c6_sun_dive',
    type: 'choice',
    act: ACT_E,
    beat: 'c6SunDive',
    title: 'Fire at the closest point',
    subject: 'Energy',
    difficulty: 'Level 4',
    prompt: 'Diving past the Sun, Zara fires the drive right at the closest point. Why there, and not far away?',
    choices: [
      { text: 'Deep in the Sun’s pull she is moving fastest, and the same push adds the most speed there', correct: true },
      { text: 'The Sun’s light pushes the drive harder' },
      { text: 'The drive only works when it is hot' },
      { text: 'It makes no difference where she fires' },
    ],
    hint: 'Remember the two ships in lesson 6B: one fired far out, one fired close. Which left faster?',
    parentHint: 'This is the Oberth effect: a burn adds the most energy where the ship is already fastest, at the bottom of the gravity well.',
    success: 'Yes! The same push gave the most speed at the closest point. Only a rock shield could go that close.',
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
      `Light goes ${fmt(LIGHT_KMS)} km every second. After a year of pushing, the drive has the ship going ${fmt(LIGHT_KMS / 20)} km/s. ` +
      'What percent of light speed is that? (Type a number.)',
    answers: ['5', '5%', '5 %', '5 percent'],
    hint: `How many ${fmt(LIGHT_KMS / 20)}s make ${fmt(LIGHT_KMS)}? Then what is 100 divided by that?`,
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
      `The nearest star, Alpha Centauri, is about 4.4 light years away: light takes 4.4 years to get there. ` +
      `At ${CRUISE_PERCENT}% of light speed, how many years will the trip take? (Type a number.)`,
    answers: ['44', '44 years'],
    hint: `At ${CRUISE_PERCENT}% of light speed you are 10 times slower than light. So the trip takes 10 times as long.`,
    parentHint: 'time = distance ÷ speed = 4.4 light years ÷ 0.1 of light speed = 44 years. (A tempting slip is 4.4 × 0.1 = 0.44.)',
    success: 'Yes! 44 years. A long trip: that is why the ship has to be a home, a farm and a shield all at once.',
    doneMessage: 'To be continued...',
    reward: { science: 10 },
  },
};

/** Level 1 overlay (2nd grade): same ids, same answers' meaning, easier numbers where needed. */
export const CH6E_LEVEL1 = {
  c6_route_sum: {
    difficulty: 'Level 1 • adding',
    prompt: 'Jupiter gives the ship 9 more km/s. The Sun gives 10 more. How much more is that in all? (Type a number.)',
    answers: ['19', '19 km/s'],
    hint: 'Start at 10 and count on 9.',
    parentHint: '9 + 10 = 19. Counting on from the bigger number is the quick way.',
    success: 'Yes! 19 more. Each planet adds speed.',
  },
  c6_fuel_left: {
    difficulty: 'Level 1 • taking away',
    prompt: 'The tank has 20 tonnes of fuel. Steering uses 8 tonnes. How many tonnes are left? (Type a number.)',
    answers: ['12', '12 t', '12 tonnes'],
    hint: 'Count back 8 from 20.',
    parentHint: '20 − 8 = 12.',
    success: 'Right! 12 tonnes left.',
  },
  c6_jupiter_boost: {
    difficulty: 'Level 1 • gravity',
    prompt: 'Jupiter gives the biggest push of all the planets. Why?',
    choices: [
      { text: 'It is the biggest, heaviest planet', correct: true },
      { text: 'It is near the Sun' },
      { text: 'It has the most moons' },
      { text: 'It is very cold' },
    ],
    hint: 'Which planet is the biggest?',
    success: 'Yes! Jupiter is the biggest planet. Its pull is strong.',
  },
  c6_sun_dive: {
    difficulty: 'Level 1 • the Sun dive',
    prompt: 'Where should Zara fire the engine to go fastest?',
    choices: [
      { text: 'Closest to the Sun', correct: true },
      { text: 'Far from the Sun' },
      { text: 'It does not matter' },
      { text: 'Behind a planet' },
    ],
    hint: 'Look back at the two ships in the lesson.',
    success: 'Yes! Closest to the Sun gives the most speed.',
  },
  c6_percent_light: {
    difficulty: 'Level 1 • tens',
    prompt: 'Light is 10 times faster than our ship. If the ship goes 1 step, how many steps does light go? (Type a number.)',
    answers: ['10', 'ten'],
    hint: '10 times 1 is...',
    parentHint: 'This is the idea behind “10% of light speed”: light goes 10 for every 1 the ship goes.',
    success: 'Yes! 10 steps. Light is super fast.',
  },
  c6_star_years: {
    difficulty: 'Level 1 • skip counting',
    prompt: 'Light takes 4 years to get to the nearest star. Our ship is 10 times slower. Count by 10s, 4 times. How many years? (Type a number.)',
    answers: ['40', '40 years'],
    hint: '10, 20, 30...',
    parentHint: '4 tens make 40. (Light: 4 years; ship at a tenth of light speed: 40 years.)',
    success: 'Yes! 40 years. That is a long trip!',
  },
};

/** The bank at a Level (the overlay merged), like questions.space.js does for Chapter 4. */
export function partEBank(level = 4) {
  if (level !== 1) return CH6E_QUESTIONS;
  return Object.fromEntries(Object.entries(CH6E_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH6E_LEVEL1[id] || {}) }]));
}
