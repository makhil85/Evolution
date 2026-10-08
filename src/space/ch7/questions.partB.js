// Chapter 7, Part B question bank: one question after each task of the part
// (the gentle drop test, the float game, the full-push drop test), and one on
// speeding up after lesson 7A. Same schema as ch6/questions.partQuests.js: a
// Level 4 entry plus a Level 1 overlay with the same id. The numbers come from
// floatLogic.js and are re-derived in scripts/test-ch7-push.mjs.
import { PUSH, fallSeconds, QUICKER, TOOLS, SHIP, throwGain } from './floatLogic.js';

const ACT_B = 2;

const GENTLE_S = fallSeconds(PUSH.gentle); // about 4.5 s
const FULL_S = fallSeconds(PUSH.full); // about 0.45 s
const f1 = GENTLE_S.toFixed(1); const f2 = FULL_S.toFixed(2);
// Her speed from a thrown tool (the tool's momentum shared with her mass): the numbers live in floatLogic.js.
const W = TOOLS.wrench; const S = TOOLS.spanner;
const WRENCH_P = W.mass * W.speed; // 6 kg m/s: the wrench's momentum, and hers the other way
const WRENCH_GAIN = throwGain('wrench').toFixed(1); // 0.2 m/s
const SPANNER_GAIN = throwGain('spanner').toFixed(1); // 0.4 m/s

export const CH7B_QUESTIONS = {
  c7b_gentle_drop: {
    id: 'c7b_gentle_drop', type: 'choice', act: ACT_B, beat: 'c7bGentleDrop',
    title: 'Slow, like a feather', subject: 'Falling', difficulty: 'Level 4',
    prompt: 'A ball is let go 1 m above the floor. The push is gentle: 1/100 of Earth’s pull. About how long does the ball take to land?',
    choices: [
      { text: 'about 0.5 seconds' },
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
    title: 'Throw it back', subject: 'Pushing back', difficulty: 'Level 4',
    prompt: 'Out in the room there is no pull to hold you down. You want to float forwards, so you throw a tool backwards. Which way do you move?',
    choices: [
      { text: 'Forwards, the opposite way to the tool', correct: true },
      { text: 'Backwards, the same way as the tool' },
      { text: 'You stay still, the tool holds you there' },
    ],
    hint: 'When you push something away, it pushes you back. Which way does the tool go, and which way does that push you?',
    parentHint: `Newton's third law: the tool goes back, so you go the other way, forwards. The tool's momentum is shared with you: a wrench (${W.mass} kg × ${W.speed} m/s = ${WRENCH_P} kg m/s) gives you ${WRENCH_GAIN} m/s, and a heavier spanner (${S.mass} kg × ${S.speed} m/s) gives you ${SPANNER_GAIN} m/s.`,
    success: 'Yes! The tool goes back, so you go forwards. Every push has an equal push back.',
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
    hint: `The wrench's momentum is ${W.mass} kg × ${W.speed} m/s = ${WRENCH_P} kg m/s. Her share of it is spread over her ${SHIP.mass} kg.`,
    parentHint: `${WRENCH_P} kg m/s ÷ ${SHIP.mass} kg = ${WRENCH_GAIN} m/s, the other way. Her momentum equals the wrench's: ${SHIP.mass} kg × ${WRENCH_GAIN} m/s = ${WRENCH_P} kg m/s. (6 m/s is the wrench's speed, not hers.)`,
    success: `Yes! ${WRENCH_GAIN} m/s the other way. The wrench goes fast and she goes slowly, because she is so much heavier.`,
    doneMessage: 'Zara drifts the other way, just a little!',
    reward: { science: 10 },
  },
  c7b_speed_press: {
    id: 'c7b_speed_press', type: 'choice', act: ACT_B, beat: 'c7bSpeedPress',
    title: 'Pressed back', subject: 'Forces', difficulty: 'Level 4',
    prompt: 'The ship speeds up. Which way do you feel pushed?',
    choices: [
      { text: 'Back, into your seat', correct: true },
      { text: 'Forwards, out of the seat' },
      { text: 'Up, off the seat' },
    ],
    hint: 'Think of a bus that suddenly speeds up. Which way do you lean?',
    parentHint: 'Your body wants to stay where it is while the seat speeds forward, so you are pressed back into it. The press lasts only while the ship speeds up.',
    success: 'Yes! Speeding up presses you back into your seat. Stop speeding up, and the press goes away.',
    doneMessage: 'Vroom! The seat holds on tight.',
    reward: { science: 10 },
  },
};

export const CH7B_LEVEL1 = {
  c7b_gentle_drop: {
    difficulty: 'Level 1 • slow',
    prompt: 'A ball is let go 1 m up, with a very gentle push. About how long until it lands?',
    choices: [
      { text: 'about 1 second' },
      { text: 'about 5 seconds', correct: true },
      { text: 'about 50 seconds' },
    ],
    hint: 'On Earth a ball like this lands in less than a second. This push is much gentler, so it takes longer.',
    parentHint: `It takes about ${Math.round(GENTLE_S)} seconds (${f1} s exactly).`,
    success: `Yes! About ${Math.round(GENTLE_S)} seconds. Slow enough to watch it.`,
  },
  c7b_full_drop: {
    difficulty: 'Level 1 • doubling',
    prompt: 'A push that is 4 times as strong lands a ball how many times quicker?',
    choices: [
      { text: 'about 2 times', correct: true },
      { text: 'about 4 times' },
      { text: 'about 8 times' },
    ],
    hint: 'Think about how many 2s make 4.',
    parentHint: 'A push 4 times as strong makes the time half as long, so 2 times quicker (√4 = 2).',
    success: 'Yes! 2 times quicker: the same ball lands in half the time.',
  },
  c7b_float_throw: {
    difficulty: 'Level 1 • pushing back',
    prompt: 'You are floating. You throw a tool backwards. Which way do you go?',
    choices: [
      { text: 'Forwards, away from the tool', correct: true },
      { text: 'Backwards, the same way as the tool' },
      { text: 'Not at all' },
    ],
    hint: 'The tool goes one way. What does that push do to you?',
    parentHint: 'The tool goes back, so you go the other way: forwards.',
    success: 'Yes! The tool goes back, and you go forwards.',
  },
  c7b_throw_sum: {
    difficulty: 'Level 1 • one way, the other way',
    prompt: 'You are floating. You throw a ball forwards. Which way do you float?',
    choices: [
      { text: 'Backwards', correct: true },
      { text: 'Forwards' },
      { text: 'Not at all' },
    ],
    hint: 'The ball goes one way. What does its push do to you?',
    parentHint: 'The ball goes forwards, so you go the other way: backwards. A heavier throw pushes you back harder.',
    success: 'Yes! The ball goes forwards, so you float backwards.',
  },
  c7b_speed_press: {
    difficulty: 'Level 1 • pressed',
    prompt: 'The ship speeds up. Do you feel pushed back, or pushed forward?',
    choices: [
      { text: 'Back into the seat', correct: true },
      { text: 'Forward, out of the seat' },
      { text: 'Up, off the seat' },
    ],
    hint: 'Think of a bus that speeds up. Where does your back go?',
    parentHint: 'Speeding up presses you back into the seat.',
    success: 'Yes! Speeding up presses you back into your seat.',
  },
};
