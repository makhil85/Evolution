// Chapter 3's question bank at LEVEL 1 difficulty — Math Kangaroo / CogAT
// idiom, pitched at a competitive 1st grader.
//
// This is an OVERLAY, not a second bank. Each entry replaces only the content
// of the matching question in questions.js: the id, the answer type, the
// station it lives at, its title and its reward are all inherited. That
// matters because the quest chain, the signposts and the economy are all keyed
// off those fields - a second full copy would be four more things to keep in
// step, and the first one to drift would break the chain silently.
//
// WHAT "LEVEL 1" MEANS HERE. Not easy. The arithmetic stays inside a 1st
// grader's reach - counting, skip counting, adding and taking away within
// twenty - and the DIFFICULTY lives in the reasoning instead:
//
//   - the answer needs two steps, not one
//   - the obvious answer is wrong, and wrong for a reason worth learning
//     (the line of five rockets is the clearest: almost every child says six)
//   - the child has to notice something rather than compute something
//
// That is the Kangaroo pattern: insight over procedure, small numbers, short
// prompts. A question a 1st grader can READ in fifteen seconds and think about
// for two minutes is the target; a question that just needs bigger sums is a
// failure of this brief however hard it looks.
//
// Answer types are kept alternating exactly as the Level 4 bank has them, so a
// child never meets two blank text boxes in a row.

export const LEVEL1_QUESTIONS = {
  // --- the main chain ------------------------------------------------------

  cadet_oath: {
    subject: 'How science works',
    difficulty: 'Level 1 • fair tests',
    prompt:
      'Zara drops two paper rockets to see which one falls more slowly. One has wings. ' +
      'One has no wings. She drops them both from the same chair, at the same moment. ' +
      'Why does she use the SAME chair for both?',
    choices: [
      { text: 'So the only thing different is the wings', correct: true },
      { text: 'So both rockets stay clean' },
      { text: 'So the test finishes faster' },
      { text: 'So she has somewhere to sit' },
    ],
    hint: 'A fair test changes only ONE thing. Everything else has to stay the same.',
    parentHint:
      'This is the whole idea of a controlled experiment, in a form a 6-year-old can hold. '
      + 'Ask: "if she dropped one from a chair and one from a table, would we know it was the wings?"',
    success:
      'Right. Change one thing, keep everything else the same — that is what makes it a fair test.',
  },

  rocket_scale: {
    subject: 'Position and counting',
    difficulty: 'Level 1 • Kangaroo position',
    prompt:
      'Rockets stand in a straight line on the launch field. Zara\'s rocket is 2nd from the front. ' +
      'It is also 4th from the back. How many rockets are in the line altogether?',
    visual: {
      rows: [
        { label: 'From the front', tiles: ['1', 'ZARA', '?', '?', '?'] },
        { label: 'From the back', tiles: ['?', '?', 'ZARA', '?', '1'] },
      ],
    },
    answers: ['5', 'five', '5 rockets', 'five rockets'],
    hint: 'Draw a dot for each rocket. Put Zara\'s where it has to be, then count ALL the dots.',
    parentHint:
      'The classic answer is 6, from adding 2 + 4. Zara\'s own rocket gets counted twice that way — '
      + 'once from each end — so the answer is 2 + 4 − 1 = 5. Drawing it settles it instantly.',
    success:
      'Yes — 5. Adding 2 and 4 gives 6, but that counts Zara\'s rocket twice, once from each end.',
  },

  rocket_materials: {
    subject: 'Materials and floating',
    difficulty: 'Level 1 • reasoning',
    prompt:
      'Zara puts four things in water. A wooden block floats. A stone sinks. ' +
      'An empty tin with the lid on floats. The same tin filled with sand sinks. ' +
      'What decides whether the tin floats?',
    choices: [
      { text: 'What is inside it', correct: true },
      { text: 'What colour it is' },
      { text: 'How shiny it is' },
      { text: 'How loud it is when you tap it' },
    ],
    hint: 'The tin did not change. Only one thing about it changed. What was it?',
    parentHint:
      'The point is that the SAME object did two different things, so the cause must be the '
      + 'change — the sand — not anything permanent about the tin.',
    success: 'Correct. The tin itself never changed, so it had to be what was inside it.',
  },

  rocket_flow: {
    subject: 'Counting back',
    difficulty: 'Level 1 • skip counting',
    prompt:
      'The test tank holds 12 litres of water. Every minute, 3 litres leak out of the valve. ' +
      'How many minutes until the tank is completely empty?',
    visual: {
      rows: [
        { label: 'Tank', tiles: ['12 L'], arrow: true },
        { label: 'Each minute', tiles: ['− 3 L'], arrow: true },
        { label: 'Empty in?', tiles: ['? minutes'] },
      ],
    },
    answers: ['4', 'four', '4 minutes', 'four minutes', '4 min'],
    hint: 'Count down in threes: 12, 9, 6, … How many jumps before you reach 0?',
    parentHint:
      'Counting back in 3s is the grade-1 route to 12 ÷ 3. Let her use fingers — the jumps ARE '
      + 'the division, and seeing that is worth more than the answer.',
    success: 'Correct — 12, 9, 6, 3, 0. That is 4 jumps, so 4 minutes.',
  },

  rocket_drag: {
    subject: 'Air resistance',
    difficulty: 'Level 1 • predict and explain',
    prompt:
      'Zara holds a flat sheet of paper in one hand. In her other hand is the SAME kind of sheet, ' +
      'squashed into a tight ball. She drops them both together. Which one lands first?',
    choices: [
      { text: 'The squashed ball', correct: true },
      { text: 'The flat sheet' },
      { text: 'They land at exactly the same moment' },
      { text: 'Neither one falls' },
    ],
    hint: 'Both sheets weigh the same. Which one has more air pushing up against it?',
    parentHint:
      'Same paper, same weight, different shape — so the difference has to be the air. This is a '
      + 'lovely one to actually do at the table.',
    success:
      'Right. Same paper, same weight — but the flat sheet has far more air pushing back on it.',
  },

  rocket_thrust: {
    subject: 'Push and push back',
    difficulty: 'Level 1 • forces',
    prompt:
      'Zara blows up a balloon and lets go without tying it. The air rushes OUT of the back ' +
      'of the balloon. Which way does the balloon itself fly?',
    choices: [
      { text: 'Forwards — the opposite way to the air', correct: true },
      { text: 'Backwards — the same way as the air' },
      { text: 'Straight down to the floor' },
      { text: 'It stays still in the air' },
    ],
    hint: 'Push something one way, and it pushes you the other way. Think of pushing off a wall.',
    parentHint:
      'This is exactly how a rocket engine works, and the balloon is the demonstration. '
      + 'Worth doing once for real — the surprise is the lesson.',
    success:
      'Correct. The air goes one way, the balloon goes the other. That is how a real rocket flies.',
  },

  rocket_fuel: {
    subject: 'Groups and ratio',
    difficulty: 'Level 1 • repeated groups',
    prompt:
      'Zara\'s fuel recipe is: for every 1 cup of BLUE, add 2 cups of GREEN. ' +
      'She pours in 3 cups of blue. How many cups of green does she need?',
    visual: {
      rows: [
        { label: 'Recipe', tiles: ['1 blue', '2 green'], arrow: true },
        { label: 'She pours', tiles: ['blue', 'blue', 'blue'], arrow: true },
        { label: 'Green needed', tiles: ['?'] },
      ],
    },
    answers: ['6', 'six', '6 cups', 'six cups'],
    hint: 'Every ONE blue brings TWO green with it. Count the green in pairs: 2, 4, …',
    parentHint:
      'Ratio before multiplication has a name: repeated groups. Three groups of two. Let her '
      + 'draw three pairs rather than reach for 3 × 2.',
    success: 'Correct — 3 blue means 3 pairs of green, and that is 6.',
  },

  rocket_guidance: {
    subject: 'Turns and direction',
    difficulty: 'Level 1 • Kangaroo turning',
    prompt:
      'Zara\'s rocket is pointing NORTH. She turns it right. Then she turns it right again. ' +
      'Which direction is the rocket pointing now?',
    answers: ['south', 'South', 's'],
    hint: 'Stand up and try it. Face north, turn right once — now turn right once more.',
    parentHint:
      'Two right turns make a half turn, which always lands on the opposite direction. Doing it '
      + 'with her body is far better than a diagram at this age.',
    success: 'Correct — two right turns make a half turn, so north becomes south.',
  },

  rocket_launch: {
    subject: 'Counting intervals',
    difficulty: 'Level 1 • Kangaroo fencepost',
    prompt:
      'A safety rope runs along the launch pad. It is 10 metres long, and there is a knot every ' +
      '2 metres — INCLUDING one knot at each end. How many knots are on the rope?',
    visual: {
      rows: [
        { label: 'Rope', tiles: ['0m', '2m', '4m', '6m', '8m', '10m'] },
      ],
    },
    answers: ['6', 'six', '6 knots', 'six knots'],
    hint: 'Do not count the gaps — count the KNOTS. There are 5 gaps. Draw them and see.',
    parentHint:
      'The fencepost problem, and almost everyone answers 5. There is always one more post than '
      + 'gap. Drawing the rope end to end makes it obvious and it sticks for years.',
    success:
      'Yes — 6. There are 5 gaps of 2 metres, but knots sit at both ends, so there is always one '
      + 'more knot than gap.',
  },

  chief_engineer: {
    subject: 'Steps forward and back',
    difficulty: 'Level 1 • Kangaroo climb-and-slip',
    prompt:
      'A test rocket rises 3 metres, then slips back down 1 metre. Then it rises 3 and slips 1 again, ' +
      'over and over. How high is the rocket after THREE full rise-and-slips?',
    visual: {
      rows: [
        { label: 'Each try', tiles: ['up 3', 'down 1'], arrow: true },
        { label: 'After 3 tries', tiles: ['? metres'] },
      ],
    },
    answers: ['6', 'six', '6 m', '6 metres', '6 meters'],
    hint: 'Each full try gains 3 − 1 = 2 metres. Now count three of those gains.',
    parentHint:
      'The Kangaroo staple. Each cycle is a net +2, so three cycles is 6. Tracking it on fingers — '
      + '3, 2, 5, 4, 7, 6 — is a real win for a 1st grader.',
    success: 'Correct — each try gains 2 metres, and three tries make 6.',
  },

  // --- bonus puzzles -------------------------------------------------------

  bonus_pattern: {
    subject: 'Repeating patterns',
    difficulty: 'Level 1 • Kangaroo pattern',
    prompt:
      'The fuel gauge lights blink in this order, over and over: RED, BLUE, BLUE, RED, BLUE, BLUE, … ' +
      'What colour is the 9th light?',
    visual: {
      rows: [
        { label: 'Lights', tiles: ['1 red', '2 blue', '3 blue', '4 red', '5 blue', '6 blue', '7 ?', '8 ?', '9 ?'] },
      ],
    },
    answers: ['blue', 'Blue'],
    hint: 'The pattern repeats every 3 lights. Which numbers are always red?',
    parentHint:
      'Reds land on 1, 4, 7 — every third one starting at 1. 9 is not in that set, so it is blue. '
      + 'Counting the repeat out loud finds it faster than any rule.',
    success: 'Correct — reds are at 1, 4 and 7, so the 9th light is blue.',
  },

  bonus_place_value: {
    subject: 'Making numbers',
    difficulty: 'Level 1 • Kangaroo digits',
    prompt:
      'Zara writes a two-digit number on the balloon. The two digits add up to 5. ' +
      'She makes the number as BIG as she possibly can. What number did she write?',
    choices: [
      { text: '50', correct: true },
      { text: '41' },
      { text: '32' },
      { text: '14' },
    ],
    hint: 'To make a two-digit number big, the FIRST digit should be as big as it can be.',
    parentHint:
      'All four options have digits summing to 5. The insight is that the tens digit is worth more '
      + 'than the ones digit, so pile everything into it: 5 and 0.',
    success: 'Correct — 50. The first digit counts for much more, so make it as big as you can.',
  },

  bonus_mass: {
    subject: 'Comparing and ordering',
    difficulty: 'Level 1 • CogAT ordering',
    prompt:
      'Three crates sit on the dock. The RED crate is heavier than the BLUE crate. ' +
      'The BLUE crate is heavier than the GREEN crate. Which crate is the lightest?',
    choices: [
      { text: 'The green crate', correct: true },
      { text: 'The blue crate' },
      { text: 'The red crate' },
      { text: 'They all weigh the same' },
    ],
    hint: 'Put them in a line, heaviest first. Which one ends up at the very end?',
    parentHint:
      'Chained comparison — if red > blue and blue > green, the order is forced. Lining up three '
      + 'objects by hand is the way in at this age.',
    success: 'Correct — red, then blue, then green. Green is at the light end.',
  },

  bonus_volume: {
    subject: 'Equal groups',
    difficulty: 'Level 1 • skip counting',
    prompt:
      'Zara fills the tank using a measuring cup. Each cup holds 2 litres. ' +
      'She pours in 5 full cups. How many litres are in the tank?',
    answers: ['10', 'ten', '10 litres', 'ten litres', '10 liters', '10 L'],
    hint: 'Count up in twos, once for each cup: 2, 4, 6, …',
    parentHint: 'Five twos. Skip counting is the grade-1 road to multiplication.',
    success: 'Correct — 2, 4, 6, 8, 10. Five cups of 2 litres is 10 litres.',
  },

  bonus_division: {
    subject: 'Sharing into groups',
    difficulty: 'Level 1 • grouping',
    prompt:
      'Zara has 12 bolts. She puts them into boxes, and every box holds exactly 4 bolts. ' +
      'How many boxes does she fill?',
    answers: ['3', 'three', '3 boxes', 'three boxes'],
    hint: 'Take away 4 at a time: 12, 8, 4, 0. How many times did you take some away?',
    parentHint:
      'This is division asked the grouping way ("how many boxes?") rather than the sharing way '
      + '("how many each?"). Both are 12 ÷ 4, and meeting both is worth a lot later.',
    success: 'Correct — 3 boxes. 12 take away 4, three times over, lands on 0.',
  },

  bonus_shape: {
    subject: 'Shape and air',
    difficulty: 'Level 1 • predict',
    prompt:
      'Four rockets are exactly the same except for the nose. Which nose will slip through the air ' +
      'most easily?',
    choices: [
      { text: 'A smooth pointed nose', correct: true },
      { text: 'A flat square nose' },
      { text: 'A nose shaped like an open cup' },
      { text: 'A wide bumpy nose' },
    ],
    hint: 'Think about which shape has to shove the most air out of the way.',
    parentHint:
      'Pointed shapes part the air instead of pushing it. Ask which one she would rather push '
      + 'through water — same idea, easier to picture.',
    success: 'Correct. A point slides the air aside; a flat face has to shove it all forward.',
  },

  bonus_forces: {
    subject: 'Balanced forces',
    difficulty: 'Level 1 • reasoning',
    prompt:
      'Two teams play tug of war. Each team pulls exactly as hard as the other. ' +
      'What happens to the rope?',
    choices: [
      { text: 'It does not move at all', correct: true },
      { text: 'It moves slowly to the left' },
      { text: 'It moves slowly to the right' },
      { text: 'It goes faster and faster' },
    ],
    hint: 'Two pushes that are equal and opposite cancel each other out.',
    parentHint:
      'Balanced forces produce no change in motion. The rope being still does not mean no force — '
      + 'it means the forces are equal, which is a genuinely deep idea.',
    success:
      'Correct. Equal pulls in opposite directions cancel out, so nothing moves — even though both '
      + 'teams are pulling hard.',
  },

  bonus_states: {
    subject: 'States of matter',
    difficulty: 'Level 1 • observe and name',
    prompt:
      'Zara heats a pan of water until steam rises off it. What happened to the water?',
    choices: [
      { text: 'A liquid turned into a gas', correct: true },
      { text: 'A gas turned into a liquid' },
      { text: 'A solid turned into a liquid' },
      { text: 'Nothing changed at all' },
    ],
    hint: 'Water you can pour is a liquid. Steam floats away — what is that?',
    parentHint:
      'Liquid to gas is evaporation. The kettle is the demonstration, and naming the two states is '
      + 'the whole task here.',
    success: 'Correct — liquid water turned into a gas. Rocket fuel does the same thing when it burns.',
  },

  bonus_ratio: {
    subject: 'Groups and ratio',
    difficulty: 'Level 1 • repeated groups',
    prompt:
      'The propellant recipe is 1 scoop of POWDER for every 2 scoops of WATER. ' +
      'Zara uses 4 scoops of powder. How many scoops of water does she need?',
    answers: ['8', 'eight', '8 scoops', 'eight scoops'],
    hint: 'Each scoop of powder needs two of water. Count the water in twos: 2, 4, …',
    parentHint: 'Four groups of two. Same shape as the fuel mixture question, bigger numbers.',
    success: 'Correct — 4 scoops of powder means 4 pairs of water, so 8.',
  },

  bonus_angle: {
    subject: 'Turns',
    difficulty: 'Level 1 • Kangaroo turns',
    prompt:
      'Zara turns the steering fin a HALF turn. How many QUARTER turns is that?',
    choices: [
      { text: '2', correct: true },
      { text: '1' },
      { text: '3' },
      { text: '4' },
    ],
    hint: 'Four quarter turns make a whole turn. So how many make half of one?',
    parentHint:
      'Halves and quarters on a turn instead of on a cake. If she knows two quarters make a half, '
      + 'she already has it.',
    success: 'Correct — two quarter turns make a half turn.',
  },

  bonus_gravity: {
    subject: 'Gravity',
    difficulty: 'Level 1 • predict',
    prompt:
      'On the Moon, gravity pulls things down much less strongly than on Earth. ' +
      'If Zara jumps as hard as she can on the Moon, what happens?',
    choices: [
      { text: 'She goes much higher than on Earth', correct: true },
      { text: 'She does not get off the ground' },
      { text: 'She goes exactly as high as on Earth' },
      { text: 'She floats away and never comes down' },
    ],
    hint: 'Less pull down means her jump carries her further up.',
    parentHint:
      'Worth heading off the last option: Moon gravity is weaker, not absent — she still comes '
      + 'back down, just slowly.',
    success: 'Correct — a weaker pull means the same jump takes her much higher.',
  },

  bonus_liftoff_mass: {
    subject: 'Two-step counting',
    difficulty: 'Level 1 • Kangaroo two-step',
    prompt:
      'Zara loads 3 boxes onto the rocket. Each box holds 4 bolts. ' +
      'Then she takes 2 bolts back out to save weight. How many bolts are on the rocket now?',
    visual: {
      rows: [
        { label: 'Boxes', tiles: ['4 bolts', '4 bolts', '4 bolts'], arrow: true },
        { label: 'Takes out', tiles: ['− 2 bolts'], arrow: true },
        { label: 'On board', tiles: ['?'] },
      ],
    },
    answers: ['10', 'ten', '10 bolts', 'ten bolts'],
    hint: 'First count all the bolts in the boxes. THEN take 2 away.',
    parentHint:
      'Two steps in order — 3 groups of 4, then subtract 2. Doing the subtraction first gives 10 '
      + 'as well by luck here, so ask her to say which she did and why.',
    success: 'Correct — 4, 8, 12 bolts in the boxes, then take 2 away leaves 10.',
  },
};

export default LEVEL1_QUESTIONS;
