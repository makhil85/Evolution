// Chapter 7, Part D question bank: the holodeck quasar and the game "Where is it
// really?". Same schema as ch6/questions.partE.js: type 'choice' with choices
// [{ text, correct }], act, beat. The Level 1 overlay replaces the Level 4 text
// of the same ids (ch7Bank in questions.ch7.js). Every fact here is checked in
// scripts/test-ch7-lens.mjs. Sums: the bright image is theta = (beta + sqrt(beta^2 + 4)) / 2,
// so the real place is beta = theta - 1/theta (lensLogic.js).
//
// Facts used: dinosaurs lived from about 230 to 66 million years ago; the quasar
// 3C 273 is about 2.4 billion light-years away, so its light left it about 2.4
// billion years ago (long before dinosaurs, when Earth had only tiny living
// things); a star behind a black hole looks pushed away from it, because its
// light is bent round the hole.

const ACT_D = 4;

export const CH7D_QUESTIONS = {
  c7_quasar_far: {
    id: 'c7_quasar_far',
    type: 'choice',
    act: ACT_D,
    beat: 'c7QuasarFar',
    title: 'Light from long ago',
    subject: 'Big numbers',
    difficulty: 'Level 4',
    prompt: 'The quasar is about 2.4 billion light-years away, so its light has been on its way for about 2.4 billion years. Roughly when did that light leave the quasar?',
    choices: [
      { text: 'Long before Earth had any dinosaurs or people', correct: true },
      { text: 'Only a few years before we saw it, when our telescopes got good' },
      { text: 'Just before the dinosaurs died out, a long time ago' },
    ],
    hint: 'The dinosaurs lived about 230 million to 66 million years ago. Is 2.4 billion years more or less than that?',
    parentHint: 'Dinosaurs lived about 230 to 66 million years ago. 2.4 billion years is about ten times longer than that, so the light left the quasar before there were any dinosaurs, when Earth had only tiny living things.',
    success: 'Yes! Its light left long before the dinosaurs. We are seeing the quasar as it was billions of years ago.',
    doneMessage: 'Long, long ago: that is how far away it is!',
    reward: { science: 10 },
  },
  c7_lens_real: {
    id: 'c7_lens_real',
    type: 'choice',
    act: ACT_D,
    beat: 'c7LensReal',
    title: 'Where it really is',
    subject: 'Bent light',
    difficulty: 'Level 4',
    prompt: 'A star looks like it is at one spot, beside a black hole. Its light has bent round the hole to reach us. Where is the star really?',
    choices: [
      { text: 'Closer to the hole than it looks', correct: true },
      { text: 'Exactly where it looks' },
      { text: 'Further from the hole than it looks' },
    ],
    hint: 'Gravity bends the star’s light round the hole, so the star looks pushed away from it. Which way must the real star be?',
    parentHint: 'The bent light makes the star look further out than it is. The bright image is always farther from the hole than the real star: theta = (beta + sqrt(beta^2 + 4)) / 2, so the real offset is beta = theta - 1/theta, nearer the hole.',
    success: 'Yes! The real star is closer to the hole. Its light bends round the hole, so it looks pushed out.',
    doneMessage: 'You found where the light really comes from!',
    reward: { science: 10 },
  },
  c7_lens_wrong: {
    id: 'c7_lens_wrong',
    type: 'choice',
    act: ACT_D,
    beat: 'c7LensWrong',
    title: 'The wrong place',
    subject: 'Bent light',
    difficulty: 'Level 4',
    prompt: 'Why does a star behind a black hole look like it is in the wrong place?',
    choices: [
      { text: 'Its light bends round the black hole on its way', correct: true },
      { text: 'The star moved while its light was on the way to us' },
      { text: 'Our telescope is a little out of focus' },
    ],
    hint: 'Think about what gravity does to light, not to the star.',
    parentHint: 'Gravity bends light, so the light from a star behind a black hole reaches us along a curved path. Our eyes assume light travels straight, so the star looks as if it is pushed away from the hole.',
    success: 'Yes! Gravity bends light round the black hole, so we see the star in the wrong place.',
    doneMessage: 'Gravity bends light: that is why the stars look wrong.',
    reward: { science: 10 },
  },
};

export const CH7D_LEVEL1 = {
  c7_quasar_far: {
    difficulty: 'Level 1 • far away',
    prompt: 'The quasar is very far away. Its light has been coming for 2.4 billion years. Did the light leave before there were any dinosaurs?',
    choices: [
      { text: 'Yes, it left long before the dinosaurs', correct: true },
      { text: 'No, it left just after the dinosaurs were gone' },
      { text: 'No, it left just last year, when we looked' },
    ],
    hint: 'The dinosaurs lived a long time ago, but 2.4 billion years is much longer.',
    parentHint: 'Dinosaurs lived about 230 to 66 million years ago. 2.4 billion years is about ten times longer, so the light left long before them.',
    success: 'Yes! The light left long before the dinosaurs. It has been on its way for a very, very long time.',
  },
  c7_lens_real: {
    difficulty: 'Level 1 • bent light',
    prompt: 'The black hole bends light. A star looks far from the hole. Where is the real star?',
    choices: [
      { text: 'Closer to the hole', correct: true },
      { text: 'Right where it looks' },
      { text: 'Further from the hole' },
    ],
    hint: 'The bent light pushes the star out. Which way must you move it to find the real one?',
    parentHint: 'The bent light makes the star look further out. So the real star is closer to the hole than it looks.',
    success: 'Yes! The real star is closer to the hole. The light bent, so it looks pushed out.',
  },
  c7_lens_wrong: {
    difficulty: 'Level 1 • bent light',
    prompt: 'Why does a star behind a black hole look like it is in the wrong place?',
    choices: [
      { text: 'Its light bends round the hole', correct: true },
      { text: 'The star moved while its light was coming' },
      { text: 'The telescope is out of focus' },
    ],
    hint: 'Gravity pulls on light too. What does it do to the light?',
    parentHint: 'Gravity bends light, so the light takes a curved path round the black hole to reach us.',
    success: 'Yes! Gravity bends the light, so the star looks like it is in the wrong place.',
  },
};
