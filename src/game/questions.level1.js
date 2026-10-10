// Chapter 3's question bank at LEVEL 1 difficulty (a 6-7 year old who reads slowly).
//
// This is an OVERLAY, not a second bank. Each entry replaces only the content
// of the matching question in questions.js: the id, the answer type, the
// station it lives at and its reward are all inherited, so the quest chain and
// the economy stay keyed off the same fields. A question with no `doneMessage`
// here keeps the Level 4 line.
//
// Level 1 rules (lead 2026-10-10): prompts at most 12 words, short everyday
// words, whole numbers up to 20 with one + or - step, 2-3 choices of 1-3 words,
// success lines at most 10 words, done lines at most 8 words. The reasoning
// stays, the wording and the sums get smaller.

export const LEVEL1_QUESTIONS = {
  // --- the main chain ------------------------------------------------------

  cadet_oath: {
    subject: 'How science works',
    difficulty: 'Level 1 • fair tests',
    prompt: 'Winged and plain rockets drop from one chair. Why the same chair?',
    choices: [
      { text: 'To finish faster' },
      { text: 'Only wings change', correct: true },
      { text: 'To sit down' },
    ],
    hint: 'Hint: a fair test changes only ONE thing.',
    parentHint:
      'This is the whole idea of a controlled experiment, in a form a 6-year-old can hold. '
      + 'Ask: "if she dropped one from a chair and one from a table, would we know it was the wings?"',
    success: 'Correct. Change one thing. Keep the rest the same.',
    doneMessage: 'Cadet badge! The school doors open.',
  },

  rocket_scale: {
    subject: 'Counting',
    difficulty: 'Level 1 • counting',
    prompt: 'Zara is 2nd from the front, 4th from the back. How many?',
    visual: {
      rows: [
        { label: 'From the front', tiles: ['1', 'ZARA', '?', '?', '?'] },
        { label: 'From the back', tiles: ['?', '?', 'ZARA', '?', '1'] },
      ],
    },
    answers: ['5', 'five', '5 rockets', 'five rockets'],
    hint: 'Hint: draw each rocket, then count them all.',
    parentHint:
      'The classic answer is 6, from adding 2 + 4. Zara\'s own rocket gets counted twice that way — '
      + 'once from each end — so the answer is 2 + 4 − 1 = 5. Drawing it settles it instantly.',
    success: 'Correct. Zara is counted twice. So the answer is 5.',
    doneMessage: 'Plan done! The Lab lights its fire.',
  },

  rocket_materials: {
    subject: 'Materials and floating',
    difficulty: 'Level 1 • thinking',
    prompt: 'Empty, the tin floats. Full of sand, it sinks. Why?',
    choices: [
      { text: 'Its colour' },
      { text: 'What is inside', correct: true },
      { text: 'How shiny' },
    ],
    hint: 'Hint: the tin did not change. Only the inside did.',
    parentHint:
      'The point is that the SAME object did two different things, so the cause must be the '
      + 'change — the sand — not anything permanent about the tin.',
    success: 'Correct. The tin stayed the same. Sand made it sink.',
    doneMessage: 'Junior Engineer! The Build Menu is open.',
  },

  rocket_flow: {
    subject: 'Counting back',
    difficulty: 'Level 1 • skip counting',
    prompt: 'Water leaks 3 cups a minute from 12 cups. How many minutes?',
    visual: {
      rows: [
        { label: 'Tank', tiles: ['12 cups'], arrow: true },
        { label: 'Each minute', tiles: ['− 3 cups'], arrow: true },
        { label: 'Empty in?', tiles: ['? minutes'] },
      ],
    },
    answers: ['4', 'four', '4 minutes', 'four minutes', '4 min'],
    hint: 'Hint: count down by 3s from 12 to 0.',
    parentHint:
      'Counting back in 3s is the grade-1 route to 12 ÷ 3. Let her use fingers — the jumps ARE '
      + 'the division, and seeing that is worth more than the answer.',
    success: 'Correct. 12, 9, 6, 3, 0. That is 4 minutes.',
  },

  rocket_drag: {
    subject: 'Air pushing back',
    difficulty: 'Level 1 • predict and explain',
    prompt: 'Drop a flat sheet and a paper ball. Which lands first?',
    choices: [
      { text: 'The flat sheet' },
      { text: 'The paper ball', correct: true },
      { text: 'They land together' },
    ],
    hint: 'Hint: which one has less air pushing back?',
    parentHint:
      'Same paper, same weight, different shape — so the difference has to be the air. This is a '
      + 'lovely one to actually do at the table.',
    success: 'Correct. The flat sheet has more air pushing back.',
    doneMessage: 'Wind Tunnel done! The big fan turns.',
  },

  rocket_thrust: {
    subject: 'Push and push back',
    difficulty: 'Level 1 • forces',
    prompt: 'Air rushes out the back. Which way does the balloon fly?',
    choices: [
      { text: 'Backwards' },
      { text: 'Forwards', correct: true },
      { text: 'Straight down' },
    ],
    hint: 'Hint: pushing one way pushes you the other way.',
    parentHint:
      'This is exactly how a rocket engine works, and the balloon is the demonstration. '
      + 'Worth doing once for real — the surprise is the lesson.',
    success: 'Correct. Air goes back, so the balloon goes forward.',
    doneMessage: 'Science Center done! The engine fires.',
  },

  rocket_fuel: {
    subject: 'Groups and ratio',
    difficulty: 'Level 1 • repeated groups',
    prompt: 'Each blue cup needs 2 green. Pour 3 blue. How much green?',
    visual: {
      rows: [
        { label: 'Recipe', tiles: ['1 blue', '2 green'], arrow: true },
        { label: 'She pours', tiles: ['blue', 'blue', 'blue'], arrow: true },
        { label: 'Green needed', tiles: ['?'] },
      ],
    },
    answers: ['6', 'six', '6 cups', 'six cups'],
    hint: 'Hint: each blue brings 2 green. Count in 2s.',
    parentHint:
      'Ratio before multiplication has a name: repeated groups. Three groups of two. Let her '
      + 'draw three pairs rather than reach for 3 × 2.',
    success: 'Correct. 3 blue, 2 green each, makes 6 green.',
  },

  rocket_guidance: {
    subject: 'Turns and direction',
    difficulty: 'Level 1 • Kangaroo turning',
    prompt: 'Zara\'s rocket faces north. She turns right twice. Which way now?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['N ↑'], arrow: true },
        { label: 'Turn 1', tiles: ['right ↻'], arrow: true },
        { label: 'Turn 2', tiles: ['right ↻'], arrow: true },
        { label: 'Points?', tiles: ['?'] },
      ],
    },
    answers: ['south', 'South', 's'],
    hint: 'Hint: stand up and turn right two times.',
    parentHint:
      'Two right turns make a half turn, which always lands on the opposite direction. Doing it '
      + 'with her body is far better than a diagram at this age.',
    success: 'Correct. Two right turns face the opposite way: south.',
    doneMessage: 'Guidance Tower done! Its dish turns.',
  },

  rocket_launch: {
    subject: 'Counting gaps',
    difficulty: 'Level 1 • counting',
    prompt: 'Knots are 2 apart, with one at each end. How many knots?',
    visual: {
      rows: [
        { label: 'Knots', tiles: ['0', '2', '4', '6', '8', '10'] },
      ],
    },
    answers: ['6', 'six', '6 knots', 'six knots'],
    hint: 'Hint: count the knots, not the gaps.',
    parentHint:
      'The fencepost problem, and almost everyone answers 5. There is always one more post than '
      + 'gap. Drawing the rope end to end makes it obvious and it sticks for years.',
    success: 'Correct. 6 knots. There is one more knot than gaps.',
  },

  chief_engineer: {
    subject: 'Steps forward and back',
    difficulty: 'Level 1 • up and down',
    prompt: 'Up 3, down 1. Do it 3 times. How high now?',
    visual: {
      rows: [
        { label: 'Each try', tiles: ['up 3', 'down 1'], arrow: true },
        { label: 'After 3 tries', tiles: ['? high'] },
      ],
    },
    answers: ['6', 'six', '6 m', '6 metres', '6 meters'],
    hint: 'Hint: each try gains 2. Count 2, 4, 6.',
    parentHint:
      'The Kangaroo staple. Each cycle is a net +2, so three cycles is 6. Tracking it on fingers — '
      + '3, 2, 5, 4, 7, 6 — is a real win for a 1st grader.',
    success: 'Correct. Each try gains 2, so 3 tries make 6.',
    doneMessage: 'Chief Engineer! The tower dome opens.',
  },

  // --- bonus puzzles -------------------------------------------------------

  bonus_pattern: {
    subject: 'Patterns',
    difficulty: 'Level 1 • Kangaroo pattern',
    prompt: 'Red, blue, blue, red, blue, blue... What colour is light 9?',
    visual: {
      rows: [
        { label: 'Lights', tiles: ['1 red', '2 blue', '3 blue', '4 red', '5 blue', '6 blue', '7 ?', '8 ?', '9 ?'] },
      ],
    },
    answers: ['blue', 'Blue'],
    hint: 'Hint: the pattern repeats every 3 lights.',
    parentHint:
      'Reds land on 1, 4, 7 — every third one starting at 1. 9 is not in that set, so it is blue. '
      + 'Counting the repeat out loud finds it faster than any rule.',
    success: 'Correct. Reds come every 3rd. Light 9 is blue.',
    doneMessage: 'Good thinking! A box of spare parts.',
  },

  bonus_place_value: {
    subject: 'Making numbers',
    difficulty: 'Level 1 • Kangaroo digits',
    prompt: 'Two digits add to 5. Make it as big as you can.',
    visual: {
      rows: [
        { label: 'Digits', tiles: ['?', '+', '?', '=', '5'], arrow: true },
        { label: 'Make it', tiles: ['as BIG as you can'], arrow: true },
        { label: 'Number?', tiles: ['?', '?'] },
      ],
    },
    choices: [
      { text: '14' },
      { text: '50', correct: true },
      { text: '32' },
    ],
    hint: 'Hint: make the first digit as big as you can.',
    parentHint:
      'All the options have digits summing to 5. The insight is that the tens digit is worth more '
      + 'than the ones digit, so pile everything into it: 5 and 0.',
    success: 'Correct! 50. The first digit counts for more.',
    title: '★ Bonus: Balloon Numbers',
    doneMessage: 'A helper leaves you some gems.',
  },

  bonus_mass: {
    subject: 'Heavy and light',
    difficulty: 'Level 1 • heavy and light',
    prompt: 'Red is heavier than blue, and blue than green. Which is lightest?',
    choices: [
      { text: 'The red crate' },
      { text: 'The green crate', correct: true },
      { text: 'The blue crate' },
    ],
    hint: 'Hint: put them in a line, heaviest first.',
    parentHint:
      'Chained comparison — if red > blue and blue > green, the order is forced. Lining up three '
      + 'objects by hand is the way in at this age.',
    success: 'Correct. Red, then blue, then green. Green is lightest.',
    doneMessage: 'A man leaves some iron by the fire.',
  },

  bonus_volume: {
    subject: 'Equal groups',
    difficulty: 'Level 1 • skip counting',
    prompt: 'Each cup holds 2 litres. Pour in 5 cups. How many litres?',
    visual: {
      rows: [
        { label: '1 cup', tiles: ['2 L'], arrow: true },
        { label: 'Cups', tiles: ['🥛', '🥛', '🥛', '🥛', '🥛'], arrow: true },
        { label: 'Litres?', tiles: ['?'] },
      ],
    },
    answers: ['10', 'ten', '10 litres', 'ten litres', '10 liters', '10 L'],
    hint: 'Hint: count up in twos, 5 times.',
    parentHint: 'Five twos. Skip counting is the grade-1 road to multiplication.',
    success: 'Correct. 2, 4, 6, 8, 10. That is 10 litres.',
    doneMessage: 'The tank light blinks green. Fuel is ready!',
  },

  bonus_division: {
    subject: 'Sharing into groups',
    difficulty: 'Level 1 • grouping',
    prompt: 'Zara has 12 bolts. Each box holds 4. How many boxes?',
    visual: {
      rows: [
        { label: 'Bolts', tiles: ['12'], arrow: true },
        { label: 'Each box', tiles: ['4 bolts'], arrow: true },
        { label: 'Boxes?', tiles: ['?'] },
      ],
    },
    answers: ['3', 'three', '3 boxes', 'three boxes'],
    hint: 'Hint: take away 4 at a time until 0.',
    parentHint:
      'This is division asked the grouping way ("how many boxes?") rather than the sharing way '
      + '("how many each?"). Both are 12 ÷ 4, and meeting both is worth a lot later.',
    success: 'Correct. 4, 8, 12: that makes 3 boxes.',
    doneMessage: 'The four tanks fill up. Great job!',
  },

  bonus_shape: {
    subject: 'Shape and air',
    difficulty: 'Level 1 • predict',
    prompt: 'Four rockets have different noses. Which slides through air best?',
    choices: [
      { text: 'Flat square nose' },
      { text: 'Smooth pointed nose', correct: true },
      { text: 'Wide bumpy nose' },
    ],
    hint: 'Hint: which nose pushes the least air?',
    parentHint:
      'Pointed shapes part the air instead of pushing it. Ask which one she would rather push '
      + 'through water — same idea, easier to picture.',
    success: 'Correct. A pointed nose slides the air aside.',
    doneMessage: 'Smoke slides past. A helper leaves wood.',
  },

  bonus_forces: {
    subject: 'Balanced forces',
    difficulty: 'Level 1 • thinking',
    prompt: 'Two teams pull a rope equally hard. What happens?',
    choices: [
      { text: 'Moves left' },
      { text: 'Does not move', correct: true },
      { text: 'Moves right' },
    ],
    hint: 'Hint: equal pulls the opposite way cancel out.',
    parentHint:
      'Balanced forces produce no change in motion. The rope being still does not mean no force — '
      + 'it means the forces are equal, which is a genuinely deep idea.',
    success: 'Correct. Equal pulls cancel out. Nothing moves!',
    doneMessage: 'The board says READY. Spare circuits for you.',
  },

  bonus_states: {
    subject: 'States of matter',
    difficulty: 'Level 1 • observe and name',
    prompt: 'Zara heats water. Steam rises. What happened to the water?',
    choices: [
      { text: 'Gas to liquid' },
      { text: 'Liquid to gas', correct: true },
      { text: 'Nothing changed' },
    ],
    hint: 'Hint: pourable water is a liquid.',
    parentHint:
      'Liquid to gas is evaporation. The kettle is the demonstration, and naming the two states is '
      + 'the whole task here.',
    success: 'Correct. The water turned into a gas, like steam.',
    doneMessage: 'Board says LIQUID to GAS. Here are gems!',
  },

  bonus_ratio: {
    subject: 'Groups and ratio',
    difficulty: 'Level 1 • repeated groups',
    prompt: '1 powder needs 2 water. Zara uses 4 powder. How much water?',
    visual: {
      rows: [
        { label: 'Rule', tiles: ['1 powder', '=', '2 water'], arrow: true },
        { label: 'Used', tiles: ['4 powder'], arrow: true },
        { label: 'Water?', tiles: ['?'] },
      ],
    },
    answers: ['8', 'eight', '8 scoops', 'eight scoops'],
    hint: 'Hint: count the water in 2s, 4 times.',
    parentHint: 'Four groups of two. Same shape as the fuel mixture question, bigger numbers.',
    success: 'Correct. 4 pairs of water make 8 scoops.',
    title: '★ Bonus: Mixing the Fuel',
    doneMessage: 'A new drum of fuel arrives. Good job!',
  },

  bonus_angle: {
    subject: 'Turns',
    difficulty: 'Level 1 • Kangaroo turns',
    prompt: 'How many quarter turns make one whole turn?',
    visual: {
      rows: [
        { label: 'Quarter turns', tiles: ['↻', '↻', '↻', '↻'], arrow: true },
        { label: 'Whole turn?', tiles: ['?'] },
      ],
    },
    choices: [
      { text: '3' },
      { text: '4', correct: true },
      { text: '2' },
    ],
    hint: 'Hint: count the quarter turns as you go round.',
    parentHint:
      'Turns on a circle instead of on a cake. Four quarter turns go all the way round, so '
      + 'counting them as she turns is the whole answer.',
    success: 'Correct. Four quarter turns make one whole turn.',
    doneMessage: 'The fin turns into place. Spare circuits!',
  },

  bonus_gravity: {
    subject: 'Gravity',
    difficulty: 'Level 1 • predict',
    prompt: 'On the Moon, Zara jumps as high as she can. What happens?',
    choices: [
      { text: 'Just as high' },
      { text: 'Stays down' },
      { text: 'Much higher', correct: true },
    ],
    hint: 'Hint: less pull means a higher jump.',
    parentHint:
      'Worth heading off the last option: Moon gravity is weaker, not absent — she still comes '
      + 'back down, just slowly.',
    success: 'Correct. Less pull means she goes higher.',
    doneMessage: 'The telescope turns to the Moon. Gems!',
  },

  bonus_liftoff_mass: {
    subject: 'Taking away',
    difficulty: 'Level 1 • taking away',
    prompt: '12 bolts. Zara takes 2 away. How many are left?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['12 bolts'], arrow: true },
        { label: 'Takes away', tiles: ['− 2'], arrow: true },
        { label: 'Left?', tiles: ['?'] },
      ],
    },
    answers: ['10', 'ten', '10 bolts', 'ten bolts'],
    hint: 'Hint: start at 12, then count back 2.',
    parentHint:
      'One step, a take-away within twenty. Ask her to count back from 12 on her fingers and say '
      + 'where she stops.',
    success: 'Correct. 12 take away 2 leaves 10.',
    doneMessage: 'The crew weighs the rocket. Zara was right!',
  },
};

export default LEVEL1_QUESTIONS;
