// Chapter 2 "Forces and Machines" (was "City Engineering"): the question bank, in Chapter 3's question
// shape (see src/game/questions.js typedefs) so the same HUD modal can ask them.
//
// Titles, prompts, answers, choices, success lines, done messages and rewards
// are copied WORD FOR WORD from the old single-file games:
//   Level 4: docs/legacy-chapters/level4/chapter2.html
//   Level 1: docs/legacy-chapters/level1/chapter2.html
// The old `visual` HTML strings became {rows:[{label, tiles}]} with the same
// labels and tile texts (an old "arrow" tile is just another tile). Only the
// `hint` is new (the old game had none): one short, kind line per question.
//
// `reward` is flat here ({ energy: 4, ... }), the old game's shape; rules.js
// adds it straight to the resource counters.
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
    visual: { rows: spec.rows },
    hint: spec.hint,
    success: spec.success,
    doneMessage: spec.doneMessage,
    reward: spec.reward,
  };
  if (spec.choices) {
    q.type = 'choice';
    q.choices = choicesOf(spec.choices);
  } else {
    q.type = 'text';
    q.answers = spec.answers;
  }
  return q;
}

const LEVEL4 = {
  water: make('water', {
    title: 'Math Competition Quest 1 — Water Tower Pattern',
    text: 'Four water towers stand in a row. Each tower has 3 more liters than the tower before it. Together they hold 74 liters. How many liters are in the largest tower?',
    rows: [
      { label: 'Towers', tiles: ['?', '+3', '?', '+3', '?', '+3', '?'] },
      { label: 'Total', tiles: ['74 liters'] },
      { label: 'Largest?', tiles: ['?'] },
    ],
    answers: ['23', '23 liters', '23 litres', 'twenty three', 'twenty-three'],
    hint: 'Each tower is 3 liters more than the one before. Try a small first tower, add 3 for each next one, and check if the total is 74.',
    success: 'Correct. If the first tower had 14 liters, the towers are 14, 17, 20, and 23. Their total is 74, so the largest tower has 23 liters.',
    doneMessage: 'Water Pump complete. Blue pipes now carry water through the open city district, and the control console disappears.',
    reward: { energy: 4, blueprints: 1, science: 3 },
  }),
  gear: make('gear', {
    title: 'Math Competition Quest 2 — Gear Tooth Pattern',
    text: 'A gear has a repeating tooth pattern: blue, blue, red, green, green. The first tooth is blue. What color is the 38th tooth?',
    rows: [
      { label: 'Pattern', tiles: ['B', 'B', 'R', 'G', 'G', 'repeat'] },
      { label: 'Tooth', tiles: ['38th'] },
      { label: 'Color?', tiles: ['?'] },
    ],
    choices: [['Red', true], ['Blue', false], ['Green', false], ['It cannot be known', false]],
    hint: 'The pattern is 5 teeth long. Count in fives up to 35, then keep counting to 38.',
    success: 'Correct. The pattern length is 5. Tooth 35 ends a full pattern, so tooth 36 is blue, 37 is blue, and 38 is red.',
    doneMessage: 'Machine Shop complete. The gear building appears and the old control console disappears.',
    reward: { metal: 7, blueprints: 1, science: 3 },
  }),
  power: make('power', {
    title: 'Science Reasoning Quest — Fair Battery Test',
    text: 'An engineer tests four batteries in the same toy car. To make the test fair, what should she keep the same every time?',
    rows: [
      { label: 'Test', tiles: ['🔋1', '🔋2', '🔋3', '🔋4'] },
      { label: 'Goal', tiles: ['Find which battery makes the car go farthest'] },
    ],
    choices: [
      ['Same toy car, same floor, same starting line', true],
      ['Different cars for each battery', false],
      ['Push some cars harder than others', false],
      ['Use a hill for one battery and flat floor for another', false],
    ],
    hint: 'In a fair test only one thing changes: the battery. Everything else must stay the same.',
    success: 'Correct. A fair test changes only the battery. The car, floor, and starting line should stay the same.',
    doneMessage: 'Power Station complete. Yellow power lines appear and the control console disappears.',
    reward: { energy: 7, blueprints: 1, science: 4 },
  }),
  tile: make('tile', {
    title: 'Math Competition Quest 3 — Shortest Path Count',
    text: 'A robot must move from the STEM Academy to the Machine Shop. It can only move right or up. The shortest route needs exactly 3 rights and 2 ups. How many different shortest routes are possible?',
    rows: [
      { label: 'Moves', tiles: ['R', 'R', 'R', 'U', 'U'] },
      { label: 'Rule', tiles: ['Any order, but exactly these 5 moves'] },
      { label: 'Routes?', tiles: ['?'] },
    ],
    answers: ['10', 'ten', '10 routes', 'ten routes', '10 ways', 'ten ways'],
    hint: 'There are 5 move slots. Count the ways to pick which 2 of them are the up moves.',
    success: 'Correct. Choose which 2 of the 5 moves are up moves. The possible choices are 10, so there are 10 shortest routes.',
    doneMessage: 'STEM Academy complete. The patterned floor appears and the control console disappears.',
    reward: { stone: 7, blueprints: 1, science: 4 },
  }),
  bridge: make('bridge', {
    title: 'Unlocked Quest — Bridge Gap Count',
    text: 'Bridge posts are placed at 0 m, 3 m, 6 m, 9 m, 12 m, and 15 m. One plank goes between each pair of neighboring posts. How many planks are needed?',
    rows: [
      { label: '', tiles: ['0', '—', '3', '—', '6', '—', '9', '—', '12', '—', '15'] },
      { label: 'Planks?', tiles: ['?'] },
    ],
    answers: ['5', 'five', '5 planks', 'five planks'],
    hint: 'Draw a dot for each post. A plank fills the space between two dots, so count the spaces, not the dots.',
    success: 'Correct. Six posts create five spaces, so the bridge needs 5 planks.',
    doneMessage: 'Bridge complete. Five planks now cross the moat, and the bridge console disappears.',
    reward: { wood: 5, stone: 3, blueprints: 1, science: 3 },
  }),
  solar: make('solar', {
    title: 'Science Reasoning Quest 2 — Solar Shadow Lab',
    text: 'In the morning, the Sun is low in the east. A tall bridge post makes a long shadow. Which direction will the shadow point?',
    rows: [
      { label: 'Morning Sun', tiles: ['East ☀', '→ light', 'Bridge Post'] },
      { label: 'Shadow?', tiles: ['Which direction?'] },
    ],
    choices: [
      ['West, away from the Sun', true],
      ['East, toward the Sun', false],
      ['Straight up into the sky', false],
      ['No shadow forms in the morning', false],
    ],
    hint: 'Light travels from the Sun. The shadow falls on the side away from the light.',
    success: 'Correct. A shadow forms on the side away from the light. If the Sun is in the east, the shadow points west.',
    doneMessage: 'Solar Lab complete. A sunlight testing station appears in the north district, and the console disappears.',
    reward: { energy: 3, blueprints: 1, science: 5 },
  }),
  magnet: make('magnet', {
    title: 'Science Reasoning Quest 3 — Magnet Material Sort',
    text: 'A magnet picks up an iron nail, a steel paperclip, and a steel screw. It does not pick up a plastic straw, a wooden block, or a copper coin. What is the best conclusion?',
    rows: [
      { label: 'Picked up', tiles: ['iron nail', 'steel clip', 'steel screw'] },
      { label: 'Not picked', tiles: ['plastic', 'wood', 'copper coin'] },
    ],
    choices: [
      ['The magnet attracts some metals, especially iron or steel', true],
      ['The magnet attracts all shiny objects', false],
      ['The magnet attracts all heavy objects', false],
      ['The magnet attracts only objects that are round', false],
    ],
    hint: 'Look at what it picked up and what it left. Was the copper coin picked up? Is every metal picked up?',
    success: 'Correct. Magnets attract some metals such as iron and steel, but not every metal or every shiny object.',
    doneMessage: 'Magnet Lab complete. The sorting lab appears in the north district, and the console disappears.',
    reward: { metal: 4, blueprints: 1, science: 5 },
  }),
  key: make('key', {
    title: 'Hard Quest — Balance Scale Blueprint Lock',
    text: 'On one scale, 1 big gear balances 3 small gears and 2 bolts. On another scale, 2 big gears balance 8 small gears. How many small gears balance 2 bolts?',
    rows: [
      { label: 'Scale 1', tiles: ['1 Big Gear', '=', '3 Small Gears + 2 Bolts'] },
      { label: 'Scale 2', tiles: ['2 Big Gears', '=', '8 Small Gears'] },
      { label: 'Question', tiles: ['2 Bolts = ? Small Gears'] },
    ],
    answers: ['1', 'one', '1 small gear', 'one small gear', '1 gear', 'one gear'],
    hint: 'Use scale 2 first: how many small gears is one big gear? Then look at scale 1.',
    success: 'Correct. If 2 big gears equal 8 small gears, then 1 big gear equals 4 small gears. Since 1 big gear also equals 3 small gears plus 2 bolts, the 2 bolts must equal 1 small gear.',
    doneMessage: 'Blueprint Vault complete outside the moat. The hard puzzle console disappears and the bridge lock can open.',
    reward: { wood: 5, stone: 5, metal: 7, energy: 5, blueprints: 2, science: 5 },
  }),
};

// Level 1 has no solar / magnet quests and its own wording.
const LEVEL1 = {
  water: make('water', {
    title: 'Medium Quest 1 — Water Wheel Drops',
    text: 'One turn takes 3 drops. How many drops in 2 turns?',
    rows: [
      { label: '1 turn', tiles: ['💧', '💧', '💧'] },
      { label: '2 turns', tiles: ['?'] },
    ],
    answers: ['6', 'six'],
    hint: 'Hint: count 3 drops, then 3 more.',
    parentHint: 'One turn is 3 drops. Two turns are 3 + 3.',
    success: 'Correct. 3 drops, then 3 more, makes 6.',
    doneMessage: 'The Water Pump is done! Blue pipes flow.',
    reward: { energy: 3, blueprints: 1, science: 2 },
  }),
  gear: make('gear', {
    title: 'Medium Quest 2 — Five Gears',
    text: 'Gear 1 turns clockwise. Gear 2 turns back. What about Gear 5?',
    rows: [
      { label: '', tiles: ['1 ↻', 'touch', '2 ?', 'touch', '3 ?', 'touch', '4 ?', 'touch', '5 ?'] },
    ],
    choices: [['Other way ↺', false], ['Clockwise ↻', true], ['Stays still', false]],
    hint: 'Hint: each gear flips. Gear 2 is the other way.',
    success: 'Correct. Odd gears turn clockwise, so Gear 5 does too.',
    doneMessage: 'The Machine Shop is done! Gears now turn.',
    reward: { metal: 6, blueprints: 1, science: 2 },
  }),
  power: make('power', {
    title: 'Medium Quest 3 — Light the Bulb',
    text: 'Which path has no gaps? The bulb lights up there.',
    rows: [
      { label: 'A', tiles: ['battery → wire → bulb → wire → battery'] },
      { label: 'B', tiles: ['battery → wire ✕ gap → bulb → battery'] },
      { label: 'C', tiles: ['battery → wire → switch open → bulb'] },
    ],
    choices: [['B only', false], ['A only', true], ['C only', false]],
    hint: 'Hint: find the path with no gap.',
    success: 'Correct. Path A has no gaps, so the bulb lights.',
    doneMessage: 'The Power Station is done! Yellow lines glow.',
    reward: { energy: 6, blueprints: 1, science: 2 },
  }),
  tile: make('tile', {
    title: 'Medium Quest 4 — Shape Grid',
    text: 'Each row has all three shapes. Which one is missing?',
    rows: [
      { label: '', tiles: ['○', '□', '△'] },
      { label: '', tiles: ['△', '○', '□'] },
      { label: '', tiles: ['□', '△', '?'] },
    ],
    choices: [['Square □', false], ['Circle ○', true], ['Triangle △', false]],
    hint: 'Hint: which shape is not in the last row?',
    success: 'Correct. The last row needs a circle now.',
    doneMessage: 'STEM School is done! Its shape floor shines.',
    reward: { stone: 6, blueprints: 1, science: 3 },
  }),
  bridge: make('bridge', {
    title: 'Unlocked Quest — Bridge Builder',
    text: 'Six posts. A plank goes in each space. How many planks?',
    rows: [
      { label: '', tiles: ['Post', 'space', 'Post', 'space', 'Post', 'space', 'Post', 'space', 'Post', 'space', 'Post'] },
      { label: 'Planks?', tiles: ['?'] },
    ],
    answers: ['5', 'five', '5 planks', 'five planks'],
    hint: 'Hint: count the spaces between the posts.',
    success: 'Correct. Six posts make five spaces. So 5 planks.',
    doneMessage: 'The bridge is done! Five planks cross.',
    reward: { wood: 5, stone: 3, blueprints: 1, science: 2 },
  }),
  key: make('key', {
    title: 'Hard Quest — Blueprint Lock',
    text: 'Two digits make 9. Left is 3 more. What is it?',
    rows: [
      { label: 'Clue 1', tiles: ['left + right = 9'] },
      { label: 'Clue 2', tiles: ['left is 3 more'] },
      { label: 'Code', tiles: ['?', '?'] },
    ],
    answers: ['63', 'sixty three', 'sixty-three'],
    hint: 'Hint: check pairs that make 9.',
    success: 'Correct. 6 and 3 make 9. The bridge lock opens.',
    doneMessage: 'The Blueprint Vault is done! Bridge can open.',
    reward: { wood: 5, stone: 5, metal: 6, energy: 4, blueprints: 2, science: 4 },
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
