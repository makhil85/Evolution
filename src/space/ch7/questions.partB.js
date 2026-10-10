// Chapter 7, Part B question bank: one question after each task of the part
// (the gentle drop test, the float game's throws, the full-push drop test).
// Lesson 7A has its own questions in its films. Same schema as
// ch6/questions.partQuests.js: a Level 4 entry plus a Level 1 overlay with the
// same id. The numbers come from floatLogic.js and are re-derived in
// scripts/test-ch7-push.mjs.
import { PUSH, fallSeconds, QUICKER, TOOLS, SHIP, throwGain } from './floatLogic.js';

const ACT_B = 2;

const GENTLE_S = fallSeconds(PUSH.gentle); // about 4.5 s
const FULL_S = fallSeconds(PUSH.full); // about 0.45 s
const f1 = GENTLE_S.toFixed(1); const f2 = FULL_S.toFixed(2);
const G1 = Math.round(GENTLE_S); // the card says "about 5 seconds" at Level 1
// Her speed from a thrown tool (the tool's momentum shared with her mass): the numbers live in floatLogic.js.
const W = TOOLS.wrench; const S = TOOLS.spanner;
const WRENCH_P = W.mass * W.speed; // 6 kg m/s: the wrench's momentum, and hers the other way
const SPANNER_P = S.mass * S.speed; // 12 kg m/s
const WRENCH_GAIN = throwGain('wrench').toFixed(1); // 0.2 m/s
const SPANNER_GAIN = throwGain('spanner').toFixed(1); // 0.4 m/s

export const CH7B_QUESTIONS = {
  c7b_gentle_drop: {
    id: 'c7b_gentle_drop', type: 'choice', act: ACT_B, beat: 'c7bGentleDrop',
    title: 'Slow, like a feather', subject: 'Falling', difficulty: 'Level 4',
    prompt: 'A ball is let go 1 m above the floor. The push is gentle: 1/100 of Earth’s pull. About how long does the ball take to land?',
    choices: [
      { text: 'about half a second' },
      { text: 'about 4.5 seconds', correct: true },
      { text: 'about 45 seconds' },
    ],
    hint: 'Earth’s pull lands a ball like this in less than half a second. A push 100 times weaker is not 100 times slower.',
    parentHint: `Time = √(2 × 1 ÷ 0.098) = ${f1} s. On Earth (9.8 m/s²) it is √(2 ÷ 9.8) = ${f2} s. The time grows with the square root, so a push 100 times weaker is 10 times slower, not 100 times.`,
    success: `Yes! About ${f1} seconds: slow enough to watch it drift down.`,
    doneMessage: 'The ball drifts down slowly. Bolt is pleased!',
    reward: { science: 10 },
  },
  c7b_full_drop: {
    id: 'c7b_full_drop', type: 'choice', act: ACT_B, beat: 'c7bFullDrop',
    title: 'Full push, like Earth', subject: 'Square roots', difficulty: 'Level 4',
    prompt: 'The full push is 100 times stronger than the gentle push. How many times quicker does a dropped ball land?',
    choices: [
      { text: 'about 2 times' },
      { text: 'about 10 times', correct: true },
      { text: 'about 100 times' },
    ],
    hint: `The gentle drop took about ${f1} seconds. The full push takes about ${f2} seconds. Divide the bigger time by the smaller one.`,
    parentHint: `The time is √(2 ÷ push), so 100 times the push makes the time √100 = 10 times shorter: ${f1} ÷ ${f2} = ${QUICKER}.`,
    success: `Yes! About ${QUICKER} times quicker: ${f2} seconds at full push, ${f1} seconds at gentle.`,
    doneMessage: 'Full push: the ball lands fast, like on Earth!',
    reward: { science: 10 },
  },
  c7b_float_throw: {
    id: 'c7b_float_throw', type: 'choice', act: ACT_B, beat: 'c7bFloatThrow',
    title: 'Heavier, harder', subject: 'Pushing back', difficulty: 'Level 4',
    prompt: 'Out in the room you throw a tool at the same speed: a 6 kg spanner or a 3 kg wrench. Which one pushes you back harder?',
    choices: [
      { text: 'The spanner: it is heavier', correct: true },
      { text: 'The wrench: it is lighter' },
      { text: 'Neither: a throw does not move you' },
    ],
    hint: 'Each tool leaves your hand at the same speed. What does the extra weight add?',
    parentHint: `Momentum = mass × speed. At ${W.speed} m/s the ${S.mass} kg spanner carries ${SPANNER_P} kg m/s, twice the wrench's ${WRENCH_P} kg m/s (${W.mass} kg × ${W.speed} m/s). So the spanner gives you ${SPANNER_GAIN} m/s the other way, and the wrench ${WRENCH_GAIN} m/s.`,
    success: `Yes! The heavier spanner pushes you back harder: ${SPANNER_GAIN} m/s against ${WRENCH_GAIN} m/s.`,
    doneMessage: 'Floating round the room, like a pro!',
    reward: { science: 10 },
  },
  c7b_throw_sum: {
    id: 'c7b_throw_sum', type: 'choice', act: ACT_B, beat: 'c7bThrowSum',
    title: 'Share the momentum', subject: 'Momentum', difficulty: 'Level 4',
    prompt: `Zara (${SHIP.mass} kg) throws a ${W.mass} kg wrench backwards at ${W.speed} m/s. How fast does she drift the other way?`,
    choices: [
      { text: '0.02 m/s' },
      { text: '0.2 m/s', correct: true },
      { text: '6 m/s' },
    ],
    hint: `Start with the wrench's momentum: its mass times its speed. Then think about how much of that she gets.`,
    parentHint: `${WRENCH_P} kg m/s ÷ ${SHIP.mass} kg = ${WRENCH_GAIN} m/s, the other way. Her momentum equals the wrench's: ${SHIP.mass} kg × ${WRENCH_GAIN} m/s = ${WRENCH_P} kg m/s. (The 6 is the wrench’s momentum, not a speed: the wrench itself goes ${W.speed} m/s.)`,
    success: `Yes! ${WRENCH_GAIN} m/s the other way. The wrench goes fast and she goes slowly, because she is so much heavier.`,
    doneMessage: 'Zara drifts the other way, just a little!',
    reward: { science: 10 },
  },
};

export const CH7B_LEVEL1 = {
  c7b_gentle_drop: {
    title: 'Slow drop', subject: 'Slow motion', difficulty: 'Level 1 • slow',
    prompt: 'A ball falls with a gentle push. About how long until it lands?',
    choices: [
      { text: 'about 1 second' },
      { text: 'about 5 seconds', correct: true },
      { text: 'about 50 seconds' },
    ],
    hint: 'A gentle push is slow. Earth’s pull is quick.',
    parentHint: `It takes about ${G1} seconds (${f1} s exactly).`,
    success: `Yes! About ${G1} seconds. Slow enough to watch it.`,
  },
  c7b_full_drop: {
    title: 'Quick landing', subject: 'Sharing', difficulty: 'Level 1 • tens',
    prompt: `Gentle push: about ${G1} seconds. Full push: ${QUICKER} times quicker. How long?`,
    choices: [
      { text: `about ${G1} whole seconds` },
      { text: 'about 50 seconds' },
      { text: 'about half a second', correct: true },
    ],
    hint: `Faster means less time. More or less than ${G1} seconds?`,
    parentHint: `${G1} seconds ÷ ${QUICKER} = ${G1 / QUICKER} of a second: half a second (${f2} s exactly).`,
    success: 'Yes! Half a second. Quick, like on Earth.',
  },
  c7b_float_throw: {
    title: 'Big and small', subject: 'Heavy things', difficulty: 'Level 1 • heavier, harder',
    prompt: 'Same speed: a big spanner or a small wrench. Which pushes you harder?',
    choices: [
      { text: 'The big spanner', correct: true },
      { text: 'The small wrench' },
      { text: 'Neither' },
    ],
    hint: 'Which one is heavier?',
    parentHint: 'The heavier tool carries more push, so the big spanner pushes you back harder.',
    success: 'Yes! The big spanner pushes you back harder.',
  },
  c7b_throw_sum: {
    title: 'Spanner or wrench', subject: 'Bigger push', difficulty: 'Level 1 • faster or slower',
    prompt: 'Same throw speed: a big spanner, not a small wrench. Faster or slower?',
    choices: [
      { text: 'Faster', correct: true },
      { text: 'Slower' },
      { text: 'Not at all' },
    ],
    hint: 'Is the big spanner pushing you more, or less?',
    parentHint: 'The big spanner is heavier, so it pushes you more: you float faster.',
    success: 'Yes! The big spanner makes you float faster.',
  },
};
