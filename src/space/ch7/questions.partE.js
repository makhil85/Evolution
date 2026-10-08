// Chapter 7, Part E question bank: the full push. Two questions after the cruise
// cutscene: how fast the ship goes after a minute at 1 g (the push adds about 10
// metres per second every second), and how many more years pass on Earth than on
// the ship (the story of the clocks, with no relativity lesson). Same schema as
// ch6/questions.partE.js. Level 1 overlays use the same ids. The numbers come
// from voyage.js and are re-derived in scripts/test-ch7-voyage.mjs.
//
// Parent hint (both questions): the drive is pretend. No drive we can build
// today could do this.
import { MINUTE_SPEED_STORY, MINUTE_SPEED_EXACT, FIVE_SECOND_SPEED, SHIP_YEARS_STORY, EARTH_YEARS_STORY, CLOCK_GAP_STORY, TRIP } from './voyage.js';

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
    prompt: 'At full push (one g), the speed goes up by about 10 metres per second, every second. After one minute of full push, about how fast is the ship going?',
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
    prompt: `The trip takes about ${SHIP_YEARS_STORY} years on the ship's clocks, and about ${EARTH_YEARS_STORY} years on Earth's clocks. How many more years pass on Earth than on the ship? (Type a number.)`,
    answers: [String(CLOCK_GAP_STORY), `${CLOCK_GAP_STORY} years`],
    hint: 'Find the two numbers in the question. Take the smaller one away from the bigger one.',
    parentHint: `${EARTH_YEARS_STORY} − ${SHIP_YEARS_STORY} = ${CLOCK_GAP_STORY}. The exact trip is ${TRIP.shipYears.toFixed(1)} years on board and ${TRIP.earthYears.toFixed(1)} on Earth, from a standstill. Very fast clocks tick slower, but this is only a story, not a lesson.`,
    success: `Yes! ${CLOCK_GAP_STORY} more years on Earth. Very fast clocks tick slower, so the ship's clocks count less time.`,
    doneMessage: 'Earth is getting older... and so are we, a little slower!',
    reward: { science: 10 },
  },
};

/** The Level 1 overlay (2nd grade): same ids, the same numbers said simply. */
export const CH7E_LEVEL1 = {
  c7_push_speed: {
    difficulty: 'Level 1 • counting by tens',
    prompt: 'The speed goes up by 10 metres per second, every second. After 5 seconds, how fast is the ship going?',
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
    prompt: `The ship's clock says ${SHIP_YEARS_STORY} years. Earth's clock says ${EARTH_YEARS_STORY} years. How many more years on Earth? (Type a number.)`,
    answers: [String(CLOCK_GAP_STORY), `${CLOCK_GAP_STORY} years`],
    hint: 'Count on from the ship’s years to Earth’s years, one step at a time.',
    parentHint: `${EARTH_YEARS_STORY} − ${SHIP_YEARS_STORY} = ${CLOCK_GAP_STORY}. Very fast clocks tick slower: that is only a story.`,
    success: `Yes! ${CLOCK_GAP_STORY} more years on Earth than on the ship.`,
  },
};
