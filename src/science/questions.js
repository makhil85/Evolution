// Chapter 1 "Science Village": the question bank, in Chapter 3's question
// shape (see src/game/questions.js typedefs) so the same HUD modal can ask them.
//
// Titles, prompts, answers, choices, hints, success lines and rewards are
// copied WORD FOR WORD from the old single-file games:
//   Level 4: docs/legacy-chapters/level4/chapter1.html
//   Level 1: docs/legacy-chapters/level1/chapter1.html
// Level 1's old `visual` HTML strings became {rows:[{label, tiles}]} with the
// same labels and tile texts (an old "arrowTile" is just another tile). Level 4
// had no visuals, so its questions carry none.
//
// `hint` keeps the old text including its leading "Hint: " (the HUD prints
// "Not quite. <hint>", exactly the old science-lab wrong-answer toast).
// `parentHint` is the old "Parents: math hints" line for that puzzle (the four
// math puzzles only); the HUD shows it in the modal's collapsed parent panel.
//
// `reward` is flat here ({ science: 3 }): every quest in this chapter pays
// science only, and rules.js adds it straight to the resource counters.
//
// Pure data: no DOM, no THREE, safe to import from node.

/** Old [text, correct] pairs -> Chapter 3's [{text, correct}]. */
function choicesOf(pairs) {
  return pairs.map(([text, correct]) => ({ text, correct }));
}

/** Build one Question. `stationId` is the quest id (the station carries the same id). */
function make(id, spec) {
  const q = {
    id,
    stationId: id,
    title: spec.title,
    prompt: spec.text,
  };
  if (spec.rows) q.visual = { rows: spec.rows };
  if (spec.choices) {
    q.type = 'choice';
    q.choices = choicesOf(spec.choices);
  } else {
    q.type = 'text';
    q.answers = spec.answers;
  }
  q.hint = spec.hint;
  if (spec.parentHint) q.parentHint = spec.parentHint;
  q.success = spec.success;
  q.reward = { science: spec.reward };
  return q;
}

const LEVEL4 = {
  m1: make('m1', {
    title: 'Medium Puzzle 1 — Wood Carts',
    text: 'Four carts carry logs. Each cart after the first has 2 more logs than the cart before it. Altogether there are 44 logs. How many logs are in the LAST cart?',
    answers: ['14'],
    hint: 'Hint: write four boxes. Because the logs go up by 2, try numbers like 8, 10, 12, 14. Check whether the total is 44.',
    parentHint: 'Think of four numbers increasing by 2. Try 8, 10, 12, 14 and check the total.',
    success: 'Correct. The efficient wood target is 14. You found the pattern: 8, 10, 12, 14.',
    reward: 2,
  }),
  m2: make('m2', {
    title: 'Medium Puzzle 2 — Stone Rows',
    text: 'A stone path has 5 rows. Row 1 has 2 stones, row 2 has 4, row 3 has 6, and the pattern continues. How many stones are in all 5 rows?',
    answers: ['30'],
    hint: 'Hint: the row sizes are even numbers. List all 5 rows first: 2, 4, 6, 8, __. Then add them.',
    parentHint: 'Continue the even-number pattern: 2, 4, 6, 8, 10. Then add them.',
    success: 'Correct. The efficient stone target is 30. You added 2 + 4 + 6 + 8 + 10.',
    reward: 2,
  }),
  m3: make('m3', {
    title: 'Medium Puzzle 3 — Science Filter',
    text: 'A scientist keeps numbers from 1 to 9. She removes every even number and every multiple of 3. What is the sum of the numbers left?',
    answers: ['13'],
    hint: 'Hint: start with 1,2,3,4,5,6,7,8,9. Cross out even numbers. Then cross out 3, 6, and 9. Add what is left.',
    parentHint: 'From 1 to 9, cross out even numbers and multiples of 3. Add what remains.',
    success: 'Correct. The efficient science target is 13. The numbers left are 1, 5, and 7.',
    reward: 3,
  }),
  key: make('key', {
    title: 'Hard 5-Point Key Puzzle — Iron Room Lock',
    text: 'The lock code is a two-digit number. Its digits add to 11. If you reverse the digits, the new number is 27 larger than the original number. What is the original lock code?',
    answers: ['47'],
    hint: 'Hint: the two digits add to 11. Try 29, 38, 47, 56, 65, 74, 83, 92. Reverse each one and compare.',
    parentHint: 'Try 29, 38, 47, 56, 65, 74, 83, 92. Reverse and compare.',
    success: 'Correct. 47 reversed is 74, and 74 is 27 more than 47. The iron room is unlocked.',
    reward: 4,
  }),
  force: make('force', {
    title: 'Science Lab — Easy Force Idea',
    text: 'A ball is not moving. You kick it, and it rolls. What made the ball start moving?',
    choices: [
      ['The push from your foot.', true],
      ['The ball decided to move by itself.', false],
      ['The grass made the ball heavier.', false],
      ['The sky pulled the ball forward.', false],
    ],
    hint: 'Hint: look for the answer with a push or pull. A force can change how an object moves.',
    success: 'Correct. Your foot gave the ball a push. A push or pull is called a force.',
    reward: 3,
  }),
  energy: make('energy', {
    title: 'Science Lab — Easy Rocket Fuel Idea',
    text: 'A campfire needs wood and air to burn. A rocket has fuel, but in space there is no air. What must the rocket carry?',
    choices: [
      ['Only extra paint.', false],
      ['Only more wheels.', false],
      ['Oxygen, so the fuel can release energy.', true],
      ['Sand, so the rocket becomes lighter.', false],
    ],
    hint: 'Hint: think about fire. Fire needs fuel plus oxygen from air. In space there is no air outside the rocket.',
    success: 'Correct. Fuel stores chemical energy, but oxygen helps release it fast. Space has no air, so rockets carry oxygen.',
    reward: 4,
  }),
};

const LEVEL1 = {
  m1: make('m1', {
    title: 'Medium Puzzle 1 — Pattern Garden',
    text: 'The flower rows grow by the same rule. Row 1 has 2 flowers. Row 2 has 4 flowers. Row 3 has 6 flowers. How many flowers should Row 4 have?',
    rows: [
      { label: 'Row 1', tiles: ['🌸', '🌸'] },
      { label: 'Row 2', tiles: ['🌸', '🌸', '🌸', '🌸'] },
      { label: 'Row 3', tiles: ['🌸', '🌸', '🌸', '🌸', '🌸', '🌸'] },
      { label: 'Row 4', tiles: ['?'] },
    ],
    answers: ['8', 'eight'],
    hint: 'Hint: each new row has 2 more flowers than the row before it.',
    parentHint: 'Count how the flower rows grow: 2, 4, 6, so the next row adds 2 more.',
    success: 'Correct. The rows go 2, 4, 6, 8. You spotted the growing-by-2 pattern.',
    reward: 3,
  }),
  m2: make('m2', {
    title: 'Medium Puzzle 2 — Frog Jump Sum',
    text: 'A frog jumps on four stones. The numbers go up by 2 each jump: 3, 5, 7, 9. What is the total of all four numbers?',
    rows: [
      { label: '', tiles: ['🐸', '→', '3', '→', '5', '→', '7', '→', '9'] },
      { label: 'Total?', tiles: ['3 + 5 + 7 + 9 = ?'] },
    ],
    answers: ['24', 'twenty four', 'twenty-four'],
    hint: 'Hint: add two numbers first: 3 + 5 = 8 and 7 + 9 = 16. Then add 8 + 16.',
    parentHint: 'The frog lands on 3, 5, 7, 9. Add the four landing numbers.',
    success: 'Correct. 3 + 5 + 7 + 9 = 24. You used a pattern and careful addition.',
    reward: 3,
  }),
  m3: make('m3', {
    title: 'Medium Puzzle 3 — Science Sticker Boxes',
    text: 'Three science boxes hide stickers. Box C has 4 stickers. Box B has 1 more sticker than Box C. Box A has 1 more sticker than Box B. How many stickers are in Box A?',
    rows: [
      { label: 'Box C', tiles: ['4 stickers'] },
      { label: 'Box B', tiles: ['C + 1'] },
      { label: 'Box A', tiles: ['B + 1'] },
    ],
    answers: ['6', 'six'],
    hint: 'Hint: start at Box C. If C is 4, then B is 5. Then A is one more than B.',
    parentHint: 'Work backward: Box C has 4, Box B has 1 more, and Box A has 1 more than Box B.',
    success: 'Correct. Box C has 4, Box B has 5, and Box A has 6.',
    reward: 4,
  }),
  key: make('key', {
    title: 'Hard 5-Point Key Puzzle — Golden Digit Lock',
    text: 'The lock code is a two-digit number. The two digits add to 9. The left digit is 3 more than the right digit. What is the lock code?',
    rows: [
      { label: 'Clue 1', tiles: ['left digit + right digit = 9'] },
      { label: 'Clue 2', tiles: ['left digit is 3 bigger'] },
      { label: 'Code', tiles: ['?', '?'] },
    ],
    answers: ['63', 'sixty three', 'sixty-three'],
    hint: 'Hint: try digit pairs that add to 9, like 18, 27, 36, 45, 54, 63. Which one has the left digit 3 bigger?',
    parentHint: 'Try digit pairs that add to 9: 18, 27, 36, 45, 54, 63, 72, 81, 90. The left digit must be 3 bigger.',
    success: 'Correct. 6 + 3 = 9, and 6 is 3 more than 3. The iron room is unlocked.',
    reward: 5,
  }),
  force: make('force', {
    title: 'Science Lab — Force Direction Challenge',
    text: 'A toy car is still. You push it to the right. Which way will the toy car start moving?',
    rows: [
      { label: '', tiles: ['✋', '→', '🚗', 'moves ?'] },
    ],
    choices: [
      ['To the right →', true],
      ['To the left ←', false],
      ['Straight up ↑', false],
      ['It must stay still forever.', false],
    ],
    hint: 'Hint: look at the arrow from the hand. A push can make an object move that way.',
    success: 'Correct. A push is a force, and the car starts moving in the direction of the push.',
    reward: 3,
  }),
  energy: make('energy', {
    title: 'Science Lab — Light and Plants Challenge',
    text: 'Two plants get the same water. One is near a sunny window. One is in a dark closet. Which plant will usually grow better?',
    rows: [
      { label: 'Plant A', tiles: ['☀️', '🪴', 'sunny window'] },
      { label: 'Plant B', tiles: ['🌑', '🪴', 'dark closet'] },
    ],
    choices: [
      ['Plant A near the sunny window.', true],
      ['Plant B in the dark closet.', false],
      ['Neither plant can ever grow.', false],
      ['The plant with no light always grows fastest.', false],
    ],
    hint: 'Hint: plants need water and light. The sunny window gives the plant light.',
    success: 'Correct. Most green plants need light to make food and grow.',
    reward: 4,
  }),
};

/**
 * The questions for a Level (1 or 4; anything else means 4): { [questId]: Question }.
 * Fresh copies each call, so callers may not corrupt the bank.
 */
export function questionsFor(level) {
  const bank = level === 1 ? LEVEL1 : LEVEL4;
  return JSON.parse(JSON.stringify(bank));
}
