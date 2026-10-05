// The Chapter 5 question bank (Level 4; Level 1 comes later). Same schema as
// Chapter 4's (questions.space.js): type 'choice' or 'text', act, beat.
// Every numeric answer is checked in scripts/test-space-questions.mjs.

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH5_QUESTIONS = {
  c5_saturn_density: {
    id: 'c5_saturn_density',
    type: 'choice',
    act: 1,
    beat: 'c5SaturnDensity',
    title: 'A planet in the bathtub',
    subject: 'Density',
    difficulty: 'Level 4',
    prompt:
      'Saturn is 95 times as heavy as Earth, but it is so big that about 760 Earths would fit inside it. ' +
      'If you had a bathtub big enough to hold Saturn, what would Saturn do in the water?',
    choices: [
      { text: 'Float: it is lighter than the same amount of water', correct: true },
      { text: 'Sink: it is 95 times heavier than Earth' },
      { text: 'Sink slowly, like a stone in honey' },
      { text: 'Dissolve, like sugar' },
    ],
    hint:
      'Heavy is not the same as dense. Spread 95 Earths of stuff through room for 760 Earths: is each spoonful heavy or light?',
    parentHint:
      'Density = mass / volume. 95 / 760 is about 1/8 of Earth’s density, and Earth is about 5.5 times as dense as water, so Saturn comes out at about 0.7 of water. It would float.',
    success:
      'Right! Saturn is mostly hydrogen and helium, the two lightest gases, so each bucketful of Saturn is lighter than a bucketful of water. It would float!',
    doneMessage: 'Saturn ahead! Keep coasting toward the rings.',
    reward: { science: 10 },
  },
};
