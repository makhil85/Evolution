// Chapter 7, lesson 7B: STUB from the coordinator's scaffold (WP-C fills it in;
// see CHAPTER7_PLAN.md). Three placeholder films so the launcher and the
// lesson tests run while it is being built.
const film = (n) => ({
  title: ['Film ' + n, 'Film ' + n],
  beats: [{ dur: 2, cap: ['Coming soon.', 'Coming soon.'] }, { dur: 2, cap: ['Coming soon.', 'Coming soon.'] }],
  draw() {},
  question: {
    prompt: ['Placeholder question?', 'Placeholder question?'],
    choices: [{ text: ['Yes, it is', 'Yes, it is'], correct: true }, { text: ['No, it is not', 'No, it is not'] }, { text: ['Not sure yet', 'Not sure yet'] }],
    hint: ['Placeholder.', 'Placeholder.'],
    why: ['Placeholder.', 'Placeholder.'],
  },
  clue: [null, 'Placeholder.'],
});

export const LESSON_7B = {
  id: 'ch7_atoms',
  eyebrow: ['Atoms', ' what everything is made of:Tiny building blocks'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: try it on the ship.', 'Next: try it!'],
  films: [film(1), film(2), film(3)],
};
