// The Chapter 5 question bank (Level 4; Level 1 comes later). Same schema as
// Chapter 4's (questions.space.js): type 'choice' or 'text', act, beat.
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
      'Take away the three zeros from both: 117 and 13. How many 13s make 117? Try 13 x 9.',
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
      'Saturn’s hexagon storm has 6 sides, and each side is about 14,500 km long. ' +
      'If Zara flew once all the way round the hexagon, how many kilometres would she fly? (Type a number.)',
    answers: ['87000', '87,000', '87 000', '87000 km', '87,000 km'],
    hint: 'All 6 sides are the same length. 6 x 14,500: try 6 x 14,000 and then 6 x 500.',
    parentHint: '6 x 14,500 = 84,000 + 3,000 = 87,000 km. (A tempting slip is 5 x 14,500 = 72,500, counting the gaps between 6 corners wrongly.)',
    success: 'Yes! 87,000 km: more than twice round the whole Earth (40,000 km), just to go round one storm.',
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
      { text: 'The Sun pushing on it with sunlight' },
      { text: 'Its rings pulling it sideways' },
      { text: 'Nothing: all planets spin on their sides' },
    ],
    hint: 'Think about the momentum lesson: what changes how something spins or moves? A big bump!',
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
    success: 'Yes! 240 minutes: 4 hours. The sunshine falling on Neptune right now left the Sun before lunch.',
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
      { text: 'Uranus was being tugged off its path, and maths showed where a hidden planet must be', correct: true },
      { text: 'A spacecraft flew past it and sent back a photo' },
      { text: 'It is so bright that anyone could see it at night' },
      { text: 'They guessed, and got lucky' },
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
      { text: 'It shares its path round the Sun with lots of other icy rocks: it is not big enough to clear them away', correct: true },
      { text: 'It has no moons' },
      { text: 'It is too cold to be a planet' },
      { text: 'It is made of ice, not rock' },
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
    hint: 'How many 6,400s fit in 64,000? Look at the zeros: 64,000 is 10 times 6,400.',
    parentHint: '64,000 ÷ 6,400 = 10. (Real ice holds far more atoms than this, which is why there is plenty of fuel in a big icy rock.)',
    success: 'Yes! 10. Only a few in every thousands, but a rock holds so many atoms that it has fuel for years.',
    doneMessage: 'The engine half is built!',
    reward: { science: 10 },
  },
};
