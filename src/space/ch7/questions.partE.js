// Chapter 7, Part E question bank: the full push. Two questions after the cruise
// cutscene: how fast the ship goes after a minute at 1 g (the push adds about 10
// metres per second every second), and how many more years pass on Earth than on
// the ship (the story of the clocks, with no relativity lesson). Same schema as
// ch6/questions.partE.js. Level 1 overlays use the same ids. The numbers come
// from voyage.js and are re-derived in scripts/test-ch7-voyage.mjs.
//
// Parent hint (both questions): the drive is pretend. No drive we can build
// today could do this.
import { MINUTE_SPEED_STORY, MINUTE_SPEED_EXACT, FIVE_SECOND_SPEED, SHIP_YEARS_STORY, EARTH_YEARS_STORY, TRIP } from './voyage.js';

/** Earth's years for each ship year on the trip, rounded (about 2: 14.4 / 7.4). The question asks for the Earth years, not the gap. */
const EARTH_RATIO = Math.round(TRIP.earthYears / TRIP.shipYears);

const ACT_E = 5;
const fmt = (n) => n.toLocaleString('en-US');
const PRETEND = 'The drive in this story is pretend: no drive we can build today could push a ship like this.';

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH7E_QUESTIONS = {
  c7_push_speed: {
    id: 'c7_push_speed',
    type: 'choice',
    act: ACT_E,
    beat: 'c7PushSpeed',
    title: 'Faster and faster',
    subject: 'Multiplying by 60',
    difficulty: 'Level 4',
    prompt: 'Starting from standing still, at full push (one g), the speed goes up by about 10 metres per second, every second. After one minute of full push, about how fast is the ship going?',
    choices: [
      { text: `About ${fmt(MINUTE_SPEED_STORY / 10)} metres per second` },
      { text: `About ${fmt(MINUTE_SPEED_STORY)} metres per second`, correct: true },
      { text: `About ${fmt(MINUTE_SPEED_STORY * 10)} metres per second` },
      { text: `About ${fmt(MINUTE_SPEED_STORY / 100)} metres per second` },
    ],
    hint: 'Each second adds about 10. A minute is 60 seconds: that is 60 lots of 10.',
    parentHint: `9.8 × 60 = ${MINUTE_SPEED_EXACT} metres per second, which is about ${fmt(MINUTE_SPEED_STORY)}. ${PRETEND}`,
    success: `Yes! About ${fmt(MINUTE_SPEED_STORY)} metres per second after a minute. The push never stops, so the speed keeps climbing.`,
    doneMessage: 'Faster and faster!',
    reward: { science: 10 },
  },
  c7_clock_gap: {
    id: 'c7_clock_gap',
    type: 'text',
    act: ACT_E,
    beat: 'c7Clocks',
    title: 'Two clocks',
    subject: 'Taking away',
    difficulty: 'Level 4',
    prompt: `On the trip, the ship's clocks count about ${SHIP_YEARS_STORY} years. For every year the ship counts, Earth's clocks count about ${EARTH_RATIO} years. How many years pass on Earth? (Type a number.)`,
    answers: [String(EARTH_YEARS_STORY), `${EARTH_YEARS_STORY} years`],
    hint: `Earth's years are ${EARTH_RATIO} lots of the ship's years. Add the ship's ${SHIP_YEARS_STORY} that many times.`,
    parentHint: `${SHIP_YEARS_STORY} × ${EARTH_RATIO} = ${EARTH_YEARS_STORY}. The exact trip is ${TRIP.shipYears.toFixed(1)} years on board and ${TRIP.earthYears.toFixed(1)} on Earth, from a standstill. Very fast clocks tick slower, but this is only a story, not a lesson.`,
    success: `Yes! ${EARTH_YEARS_STORY} years on Earth, about twice the ship's ${SHIP_YEARS_STORY}. Very fast clocks tick slower, so the ship's clocks count less time.`,
    doneMessage: 'Earth is getting older... and so are we, a little slower!',
    reward: { science: 10 },
  },
};

/** The Level 1 overlay (2nd grade): same ids, the same numbers said simply. */
export const CH7E_LEVEL1 = {
  c7_push_speed: {
    difficulty: 'Level 1 • counting by tens',
    prompt: 'Starting from standing still, the speed goes up by 10 metres per second, every second. After 5 seconds, how fast is the ship going?',
    choices: [
      { text: `${MINUTE_SPEED_STORY / 60} metres per second` },
      { text: `${FIVE_SECOND_SPEED} metres per second`, correct: true },
      { text: `${FIVE_SECOND_SPEED * 2} metres per second` },
      { text: `${FIVE_SECOND_SPEED / 10} metres per second` },
    ],
    hint: 'Count by 10s, once for each second: 10, then 20, and so on.',
    parentHint: `10 + 10 + 10 + 10 + 10 = ${FIVE_SECOND_SPEED}. ${PRETEND}`,
    success: `Yes! ${FIVE_SECOND_SPEED} metres per second. Every second, the ship speeds up by 10 more.`,
  },
  c7_clock_gap: {
    difficulty: 'Level 1 • taking away',
    prompt: `The ship's clock counts ${SHIP_YEARS_STORY} years. Earth's clocks count ${EARTH_RATIO} years for every 1 on the ship. How many years pass on Earth? (Type a number.)`,
    answers: [String(EARTH_YEARS_STORY), `${EARTH_YEARS_STORY} years`],
    hint: 'Count the ship’s years twice, and add the two lots together.',
    parentHint: `${SHIP_YEARS_STORY} × ${EARTH_RATIO} = ${EARTH_YEARS_STORY}. Very fast clocks tick slower: that is only a story.`,
    success: `Yes! ${EARTH_YEARS_STORY} years on Earth, while the ship's clock counted ${SHIP_YEARS_STORY}.`,
  },
};
