// The Chapter 5 question bank. Level 4 is CH5_QUESTIONS; the Level 1 overlay
// (CH5Q_LEVEL1) keeps the same ids, types and beats, with short words and
// sums a 6-year-old can do (counting, counting on, adding, halving, counting
// by 2s and 10s), and never a false science fact (a made-up number is always
// said to be pretend). ch5Bank(level) merges them, the Chapter 6 way.
// Same schema as Chapter 4's (questions.space.js): type 'choice' or 'text', act, beat.
// Every numeric answer is checked in scripts/test-space-questions.mjs.

/** @type {Object<string, import('../questions.space.js').SpaceQuestion>} */
export const CH5_QUESTIONS = {
  c5_saturn_size: {
    id: 'c5_saturn_size',
    type: 'choice',
    act: 1,
    beat: 'c5SaturnSize',
    title: 'Earths in a row',
    subject: 'Dividing big numbers',
    difficulty: 'Level 4',
    prompt:
      'Saturn is about 117,000 km wide. Earth is about 13,000 km wide. ' +
      'If you lined Earths up side by side across Saturn, how many would fit?',
    choices: [
      { text: 'About 9', correct: true },
      { text: 'About 90' },
      { text: 'About 900' },
      { text: 'About 2' },
    ],
    hint:
      'Take away the three zeros from both: 117 and 13. Count up in 13s: 13, 26, 39... How many steps reach 117?',
    parentHint:
      '117,000 / 13,000 = 117 / 13 = 9, because 13 x 9 = 117. (Saturn is really about 116,000-120,000 km wide, Earth 12,742 km: a bit over 9.)',
    success:
      'Right! About 9 Earths in a row reach across Saturn. And it is round, so filling it up would take over 700 Earths!',
    doneMessage: 'Saturn ahead! Keep coasting toward the rings.',
    reward: { science: 10 },
  },

  c5_hexagon: {
    id: 'c5_hexagon',
    type: 'text',
    act: 1,
    beat: 'c5Hexagon',
    title: 'Round the hexagon',
    subject: 'Shapes and measuring',
    difficulty: 'Level 4',
    prompt:
      'Saturn’s north pole has a six-sided pattern in its clouds, a jet stream that makes a hexagon. Each side is about 14,500 km long. ' +
      'If Zara flew once all the way round the hexagon, how many kilometres would she fly? (Type a number.)',
    answers: ['87000', '87,000', '87 000', '87000 km', '87,000 km'],
    hint: 'All 6 sides are the same length. 6 x 14,500: try 6 x 14,000 and then 6 x 500.',
    parentHint: '6 x 14,500 = 84,000 + 3,000 = 87,000 km. (A tempting slip is 5 x 14,500 = 72,500, counting the gaps between 6 corners wrongly.)',
    success: 'Yes! 87,000 km: more than twice round the whole Earth (40,000 km), just to go round one hexagon.',
    doneMessage: 'Next: what are those rings made of?',
    reward: { science: 10 },
  },

  c5_uranus_tilt: {
    id: 'c5_uranus_tilt',
    type: 'choice',
    act: 2,
    beat: 'c5UranusTilt',
    title: 'Knocked over',
    subject: 'Planets',
    difficulty: 'Level 4',
    prompt:
      'Uranus spins lying on its side, tipped right over compared with the other planets. ' +
      'What do scientists think most likely knocked it over?',
    choices: [
      { text: 'A giant crash with something as big as Earth, long ago', correct: true },
      { text: 'Sunlight pushing on it, very gently, for billions of years' },
      { text: 'Its big rings pulling it over, bit by bit, over time' },
      { text: 'Nothing: all planets spin tipped over on their sides' },
    ],
    hint: 'Think about the bumps in the momentum lesson. What could bump a whole planet hard enough to tip it over?',
    parentHint: 'The leading idea is one or more giant impacts while the planets were forming. Sunlight’s push is far too weak, and the other planets spin nearly upright.',
    success: 'Yes! Most likely a huge crash, billions of years ago, knocked Uranus over, and it has rolled round the Sun on its side ever since.',
    doneMessage: 'Uranus ahead! Keep coasting.',
    reward: { science: 10 },
  },

  c5_uranus_pole_day: {
    id: 'c5_uranus_pole_day',
    type: 'text',
    act: 2,
    beat: 'c5UranusPoleDay',
    title: 'The longest day',
    subject: 'Division',
    difficulty: 'Level 4',
    prompt:
      'Uranus takes 84 Earth years to go once round the Sun. Lying on its side, its north pole is in sunshine for half of that trip, ' +
      'and in darkness for the other half. How many years does the north pole’s “day” last? (Type a number.)',
    answers: ['42', '42 years', 'forty two', 'forty-two'],
    hint: 'Half of 84. Try half of 80, then half of 4.',
    parentHint: '84 ÷ 2 = 42. So someone born on the dark side at the start of the night would be 42 before seeing the Sun.',
    success: 'Yes! 42 years of daylight, then 42 years of night. A child born at sunset there would be 42 before the next sunrise!',
    doneMessage: 'Next stop: Neptune, the last big planet.',
    reward: { science: 10 },
  },

  c5_sunlight_neptune: {
    id: 'c5_sunlight_neptune',
    type: 'text',
    act: 2,
    beat: 'c5SunlightToNeptune',
    title: 'Slow sunshine',
    subject: 'Multiplying',
    difficulty: 'Level 4',
    prompt:
      'Sunlight takes about 8 minutes to reach Earth. Neptune is about 30 times as far from the Sun as Earth is. ' +
      'About how many minutes does sunlight take to reach Neptune? (Type a number.)',
    answers: ['240', '240 minutes', '240 min', '4 hours'],
    hint: '30 times as far takes 30 times as long. 8 x 30: try 8 x 3, then add a zero.',
    parentHint: '8 x 30 = 240 minutes = 4 hours. (Real value: about 4 hours 10 minutes.)',
    success: 'Yes! 240 minutes: 4 hours. The sunshine falling on Neptune right now left the Sun about 4 hours ago.',
    doneMessage: 'Neptune ahead! Keep coasting.',
    reward: { science: 10 },
  },

  c5_neptune_1846: {
    id: 'c5_neptune_1846',
    type: 'choice',
    act: 2,
    beat: 'c5Neptune1846',
    title: 'Found with maths',
    subject: 'Science history',
    difficulty: 'Level 4',
    prompt:
      'Neptune is too faint to see without a telescope. In 1846 astronomers knew exactly where to point their telescope to find it. How?',
    choices: [
      { text: 'Uranus was tugged off course, so maths found the planet', correct: true },
      { text: 'A spaceship flew past it and sent back a clear photo of it' },
      { text: 'It is so bright that anyone could see it at night, easily' },
      { text: 'They guessed where it was, and got lucky on the first try' },
    ],
    hint: 'Gravity pulls on every planet. What would a hidden planet do to the planet next to it?',
    parentHint: 'Urbain Le Verrier (and John Couch Adams) used Uranus’s wobbles to calculate where an unseen planet had to be. Johann Galle found it within one degree of the prediction on the first night.',
    success: 'Yes! Uranus was being pulled off course. Le Verrier used maths to work out where the puller had to be, and the telescope found Neptune almost exactly there, the first night they looked.',
    doneMessage: 'On to the edge of the Sun’s family!',
    reward: { science: 10 },
  },

  c5_pluto: {
    id: 'c5_pluto',
    type: 'choice',
    act: 3,
    beat: 'c5Pluto',
    title: 'Planet or dwarf planet?',
    subject: 'Planets',
    difficulty: 'Level 4',
    prompt:
      'Pluto, Eris and Ceres are all called dwarf planets, not planets. Pluto is round and goes round the Sun. ' +
      'So what makes it a dwarf planet?',
    choices: [
      { text: 'It shares its path round the Sun with many icy rocks', correct: true },
      { text: 'It has no moons of its own, so it is not really a planet' },
      { text: 'It is far too cold and far away to be a planet at all' },
      { text: 'It is made of ice and not rock, so it is too light' },
    ],
    hint: 'Think of the Kuiper belt you just flew through. Is Pluto the boss of its own path?',
    parentHint: 'Since 2006 a planet must (1) go round the Sun, (2) be round, and (3) have cleared its orbit of other things. Pluto fails (3): it is one of many Kuiper belt objects. It does have moons (Charon and four small ones).',
    success: 'Yes! A planet is big enough to sweep its path clear. Pluto shares its path with thousands of other icy rocks, so it is a dwarf planet (and it does have moons: Charon is huge!).',
    doneMessage: 'How far does the Sun’s family go?',
    reward: { science: 10 },
  },

  c5_voyager: {
    id: 'c5_voyager',
    type: 'text',
    act: 3,
    beat: 'c5Voyager',
    title: 'The long trip out',
    subject: 'Subtraction',
    difficulty: 'Level 4',
    prompt:
      'Voyager 1 was launched from Earth in 1977. It flew out of the Sun’s bubble, the heliosphere, in 2012. ' +
      'How many years did that take? (Type a number.)',
    answers: ['35', '35 years', 'thirty five', 'thirty-five'],
    hint: 'Count on from 1977: 3 years to 1980, then 32 more to 2012.',
    parentHint: '2012 − 1977 = 35 years (3 to 1980, 30 to 2010, 2 to 2012). Voyager 1 is still sending messages home.',
    success: 'Yes! 35 years. And it is still going, still sending messages home, the furthest thing people have ever made.',
    doneMessage: 'Next: what makes the Sun shine at all?',
    reward: { science: 10 },
  },

  c5_deuterium: {
    id: 'c5_deuterium',
    type: 'text',
    act: 5,
    beat: 'c5Deuterium',
    title: 'Fuel from ice',
    subject: 'Division',
    difficulty: 'Level 4',
    prompt:
      'In water, about 1 hydrogen atom in every 6,400 is heavy hydrogen, the fusion fuel. ' +
      'If a scoop of ice holds 64,000 hydrogen atoms, about how many of them are heavy hydrogen? (Type a number.)',
    answers: ['10', 'ten'],
    hint: 'Take two zeros off both numbers: how many 64s fit into 640? Count up in 64s: 64, 128, 192...',
    parentHint: '64,000 ÷ 6,400 = 10. (Real ice holds far more atoms than this, which is why there is plenty of fuel in a big icy rock.)',
    success: 'Yes! 10. Heavy hydrogen is rare (about 1 in every 6,400 in real water), but a rock holds so many atoms that it has fuel for years.',
    doneMessage: 'The engine half is built!',
    reward: { science: 10 },
  },
};

/** Level 1 overlay: same ids, same types, same beats and rewards. */
export const CH5Q_LEVEL1 = {
  c5_saturn_size: {
    difficulty: 'Level 1 • counting on',
    subject: 'Counting on',
    prompt: 'Saturn is about 9 Earths wide. Zara has put 3 Earths in a row. About how many more does she need to reach across Saturn?',
    choices: [
      { text: '6', correct: true },
      { text: '3' },
      { text: '9' },
      { text: '12' },
    ],
    hint: 'Count on from 3: 4, 5, 6... up to 9. How many numbers did you say?',
    parentHint: '9 − 3 = 6. Counting on from 3 to 9: 4, 5, 6, 7, 8, 9 is six numbers.',
    success: 'Yes! 6 more Earths. About 9 in a row reach across Saturn.',
  },
  c5_hexagon: {
    difficulty: 'Level 1 • counting by twos',
    subject: 'Counting by 2s',
    prompt: 'Saturn’s clouds make a shape with 6 sides. Zara walks once all the way round. Each side is 2 steps long. How many steps does she walk? (Type a number.)',
    answers: ['12', 'twelve'],
    hint: 'Count by 2s, one jump for each side: 2, 4, 6...',
    parentHint: '6 sides x 2 steps = 12. (Level 4 uses the real length: 6 x 14,500 km = 87,000 km.)',
    success: 'Yes! 12 steps: 2 for each of the 6 sides.',
  },
  c5_uranus_tilt: {
    difficulty: 'Level 1 • a big bump',
    prompt: 'Uranus is tipped right over on its side. What do scientists think knocked it over?',
    choices: [
      { text: 'A big crash with a huge rock, long ago', correct: true },
      { text: 'Sunlight pushing on it, a little each day' },
      { text: 'Its rings pulling it over slowly' },
      { text: 'Nothing: all planets lie on their sides' },
    ],
    hint: 'Think of the chunks crashing in the rings. What bump could tip a planet?',
    parentHint: 'Scientists think a huge crash, long ago, knocked it over. Sunlight is far too gentle to do that.',
    success: 'Yes! A huge crash long ago tipped Uranus over. It has rolled round the Sun on its side ever since.',
  },
  c5_uranus_pole_day: {
    difficulty: 'Level 1 • halving',
    subject: 'Sharing in two',
    prompt: 'Uranus takes 84 of our years to go round the Sun. One of its poles has sunshine for half of that. How many years of sunshine is that? (Type a number.)',
    answers: ['42', '42 years', 'forty two', 'forty-two'],
    hint: 'Put 40 in each of 2 piles: that is 80. What is left over?',
    parentHint: '84 ÷ 2 = 42. Put 40 in each pile (80), then 2 more in each (4 left), so 40 + 2 = 42.',
    success: 'Yes! 42 years of sunshine, then 42 years of night.',
  },
  c5_sunlight_neptune: {
    difficulty: 'Level 1 • adding',
    subject: 'Adding equal lots',
    prompt: 'Sunlight takes about 8 minutes to reach Earth. Pretend a far planet is 3 times as far from the Sun. About how many minutes would its sunlight take? (Type a number.)',
    answers: ['24', '24 minutes', '24 min'],
    hint: 'Add 8 three times: 8, then 8 more, then 8 more.',
    parentHint: '8 + 8 + 8 = 24. (Real Neptune is about 30 times as far, so its sunlight takes about 4 hours. Level 4 works that out.)',
    success: 'Yes! 24 minutes. The further away, the longer sunshine takes.',
  },
  c5_neptune_1846: {
    difficulty: 'Level 1 • found with maths',
    prompt: 'Neptune is too faint to see without a telescope. In 1846 astronomers knew exactly where to point their telescope. How did they know?',
    choices: [
      { text: 'Uranus was being pulled, so maths found it', correct: true },
      { text: 'A spaceship flew past and sent a photo back' },
      { text: 'It is so bright anyone can see it at night' },
      { text: 'They guessed, and got lucky on one try' },
    ],
    hint: 'Gravity pulls on planets. What would a hidden planet do to Uranus?',
    parentHint: 'Astronomers used the wobbles of Uranus to work out where an unseen planet had to be. They looked there, and found it.',
    success: 'Yes! Maths showed where the hidden planet had to be, and they found Neptune there.',
  },
  c5_pluto: {
    difficulty: 'Level 1 • sharing a path',
    prompt: 'Pluto is round and goes round the Sun, but it is called a dwarf planet. Why?',
    choices: [
      { text: 'It shares its path with many icy rocks', correct: true },
      { text: 'It has no moons of its own, so it is too small' },
      { text: 'It is too cold and far away to be a planet' },
      { text: 'It is made of ice, not rock, so it is too light' },
    ],
    hint: 'Think of the icy rocks you flew past. Does Pluto share its path?',
    parentHint: 'A planet must clear its path of other things. Pluto shares its path with many icy rocks, so it is a dwarf planet.',
    success: 'Yes! Pluto shares its path with many icy rocks, so it is a dwarf planet.',
  },
  c5_voyager: {
    difficulty: 'Level 1 • counting on',
    subject: 'Counting on',
    prompt: 'Voyager 1 left Earth in 1977. Count on from 1977 to 1980. How many years is that? (Type a number.)',
    answers: ['3', 'three', '3 years', 'three years'],
    hint: 'Count on with your fingers: 1978, 1979, 1980.',
    parentHint: '1980 − 1977 = 3. (Level 4 counts on all the way to 2012: 35 years.)',
    success: 'Yes! 3 years from 1977 to 1980. Voyager kept going for much longer, and it still sends messages home.',
  },
  c5_deuterium: {
    difficulty: 'Level 1 • counting in tens',
    subject: 'Counting in tens',
    prompt: 'Pretend 1 in every 10 hydrogen atoms is heavy hydrogen. (In real water it is much rarer.) A scoop has 30 hydrogen atoms. How many are heavy? (Type a number.)',
    answers: ['3', 'three'],
    hint: 'Make groups of 10 atoms. Each group has 1 heavy one. How many groups in 30?',
    parentHint: '30 ÷ 10 = 3. (In real water it is about 1 in 6,400, which is why Level 4 counts 64,000 atoms.)',
    success: 'Yes! 3 heavy ones. Real water has far fewer, but a big icy rock has so many atoms that it has fuel for years.',
  },
};

/** The Chapter 5 bank at a level (4 or 1). */
export function ch5Bank(level = 4) {
  if (level !== 1) return CH5_QUESTIONS;
  return Object.fromEntries(Object.entries(CH5_QUESTIONS).map(([id, q]) => [id, { ...q, ...(CH5Q_LEVEL1[id] || {}) }]));
}
