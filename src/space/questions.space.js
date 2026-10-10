// The Chapter 4 question bank - Level 4 (4th grade, Math Kangaroo / gifted style).
//
// Same schema as Chapter 3 (src/game/questions.js), so the same modal, the same
// answer checker and the same Level 1 overlay trick all work unchanged:
//   type:'choice' -> choices[{text, correct}], exactly one correct, the modal shuffles
//   type:'text'   -> answers[] of accepted spellings, matched case/space-insensitively
//
// Two fields are new here:
//   act   - which part of the voyage asks it (1-4, 5 = Europa finale)
//   beat  - the story moment that triggers it (missions.js looks questions up by beat)
//
// How these were written. Every question is tied to something she has JUST
// DONE or SEEN in the game - the wings folding, the satellite's dead panel, her
// own jump on the Moon - so the question is her explaining her own experience,
// not a quiz bolted on. Each has one tempting wrong answer that a child who is
// guessing will pick (no gravity in space; the Moon doesn't spin; half the
// sunlight at twice the distance), because noticing why the obvious answer is
// wrong is the whole point of Kangaroo-style problems. Numbers stay small; the
// work is in the idea, not the arithmetic.
//
// "Zara" is substituted with the child's own name by the HUD, as in Chapter 3.
//
// Every numeric answer is checked in scripts/test-space-questions.mjs.

import { checkAnswer as checkChapter3Answer } from '../game/questions.js';
import { heroQuestion } from '../launcher/hero.js';
import { IS_CH5, IS_CH6, IS_CH7 } from './chapter.js';
import { ch7Bank } from './ch7/questions.ch7.js';
import { ch5Bank } from './ch5/questions.ch5.js';
import { partEBank } from './ch6/questions.partE.js';
import { partBBank } from './ch6/questions.partB.js';
import { partQuestsBank } from './ch6/questions.partQuests.js';

/** @typedef {import('../game/questions.js').Question & {act:number, beat:string}} SpaceQuestion */

/** @type {Object<string, SpaceQuestion>} */
const LEVEL4_SPACE_QUESTIONS = {
  // ======================================================================
  // ACT 1 - EARTH ORBIT
  // ======================================================================

  wings_fold: {
    id: 'wings_fold',
    type: 'choice',
    act: 1,
    beat: 'wingsFolded',
    title: 'Why fold the wings?',
    subject: 'Forces and air',
    difficulty: 'Level 4',
    prompt:
      'The moment the ship left the sky, its wings folded away. On Earth those same wings kept it flying. ' +
      'Why are wings useless out here?',
    choices: [
      { text: 'Wings work by pushing on air, and space has no air to push on', correct: true },
      { text: 'There is no gravity in space, so nothing needs holding up' },
      { text: 'Space is so cold the wings would freeze and snap' },
      { text: 'The Sun would melt them' },
    ],
    hint:
      'Careful: Earth’s gravity is still pulling on the ship up here, so “no gravity” is not the reason. What does a wing need around it to work?',
    parentHint:
      'A wing makes lift by deflecting air downward. No air, no lift. The tempting wrong answer is “no gravity”, but gravity is almost as strong in low orbit as on the ground.',
    success:
      'Right! A wing is an air-pusher. Out here there is nothing to push, so the ship turns with small puffs of gas from its thrusters instead.',
    doneMessage: 'Thrusters online. Turn left and right to feel the little puffs turn the ship.',
    reward: { science: 10 },
  },

  zero_g: {
    id: 'zero_g',
    type: 'choice',
    act: 1,
    beat: 'cabinFloat',
    title: 'Floating, but why?',
    subject: 'Gravity',
    difficulty: 'Level 4',
    prompt:
      'Zara’s pencil is floating in the cabin. Up here, Earth’s gravity is still about 9 tenths as strong as on the ground. ' +
      'So why does everything float?',
    choices: [
      { text: 'The ship and everything inside it are falling around Earth together', correct: true },
      { text: 'There is no gravity in space' },
      { text: 'The air in the cabin holds things up' },
      { text: 'The Moon is pulling everything upward' },
    ],
    hint:
      'Think of a lift whose cable snaps: you and the lift fall at the same speed, so you float inside it. Now imagine the lift is also flying sideways very, very fast.',
    parentHint:
      'Orbit is free fall with enough sideways speed that you keep missing the ground. Astronauts float because they fall at exactly the same rate as their ship.',
    success:
      'Yes! She is falling, all the time, but moving sideways so fast that she keeps missing Earth. That is what an orbit is.',
    doneMessage: 'Now fly your first full orbit. Watch the dotted line: it shows where you will fall.',
    reward: { science: 10 },
  },

  sunrises: {
    id: 'sunrises',
    type: 'text',
    act: 1,
    beat: 'firstOrbit',
    title: 'How many sunrises?',
    subject: 'Time and orbits',
    difficulty: 'Level 4',
    prompt:
      'A space station goes once around Earth every 90 minutes, and each time around, its crew sees one sunrise. ' +
      'How many sunrises do they see in one whole day (24 hours)?',
    visual: {
      rows: [
        { label: 'One lap', tiles: ['90 min', '1 sunrise'], arrow: true },
        { label: 'One day', tiles: ['24 h', '? sunrises'] },
      ],
    },
    answers: ['16', 'sixteen', '16 sunrises'],
    hint: '90 minutes is an hour and a half. Two laps take 3 hours. How many 3-hour blocks fit in 24 hours?',
    parentHint: '24 h = 1440 min, and 1440 ÷ 90 = 16. Or: 2 laps per 3 hours, 8 blocks of 3 hours, so 16.',
    success: 'Sixteen! Astronauts on the space station really do see 16 sunrises and 16 sunsets every day.',
    doneMessage: 'A satellite is coming up ahead, and one of its panels has gone dark.',
    reward: { science: 15 },
  },

  solar_source: {
    id: 'solar_source',
    type: 'choice',
    act: 1,
    beat: 'satelliteMet',
    title: 'What powers a satellite?',
    subject: 'Energy',
    difficulty: 'Level 4',
    prompt:
      'This weather satellite has worked for 15 years without anyone refuelling it. ' +
      'What gives it its electricity?',
    choices: [
      { text: 'Solar cells that turn sunlight straight into electricity', correct: true },
      { text: 'One giant battery that was charged before launch' },
      { text: 'A small petrol engine' },
      { text: 'A wind turbine spun by the solar wind' },
    ],
    hint: 'A battery charged once would run flat long before 15 years. What keeps arriving, free, every single orbit?',
    parentHint:
      'Solar cells (photovoltaic cells) turn light into electric current. Satellites do carry batteries, but only to get through the dark part of each orbit; the panels recharge them.',
    success:
      'Correct! Solar cells turn sunlight into electricity. Its batteries only carry it through the dark side of Earth, then the panels fill them up again.',
    doneMessage: 'Turn the dead panel so its face points at the Sun, and watch the power meter.',
    reward: { science: 10, resources: { silicon: 1 } },
  },

  solar_night: {
    id: 'solar_night',
    type: 'choice',
    act: 1,
    beat: 'panelFixed',
    title: 'Day and night in orbit',
    subject: 'Fractions and energy',
    difficulty: 'Level 4',
    prompt:
      'The satellite takes 90 minutes to go around Earth. For 30 of those minutes it is in Earth’s shadow, where its panels make nothing. ' +
      'Compared with a satellite that is ALWAYS in sunlight, how much electricity does it make each lap?',
    visual: {
      rows: [
        { label: 'One lap', tiles: ['☀ 30', '☀ 30', '● 30'] },
      ],
    },
    choices: [
      { text: '2/3 as much', correct: true },
      { text: '1/3 as much' },
      { text: '1/2 as much' },
      { text: 'The same, because the Sun is always shining' },
    ],
    hint: 'Split the 90 minutes into three blocks of 30. How many of the blocks are sunny?',
    parentHint: '60 sunny minutes out of 90 is 60/90 = 2/3. The tempting 1/3 is the fraction that is DARK.',
    success: 'Yes: 2 sunny blocks out of 3, so 2/3. That is why satellites need batteries for the shadow part.',
    doneMessage: 'Satellite fixed! Mission Control is sending you a thank-you... and your route to the Moon.',
    reward: { science: 15 },
  },

  signal_sequence: {
    id: 'signal_sequence',
    type: 'text',
    act: 1,
    beat: 'satelliteSignal',
    title: 'The satellite’s signal',
    subject: 'Number patterns',
    difficulty: 'Level 4 • hard sequence',
    prompt:
      'Now that it has power, the satellite beeps a number code back to Earth: 3, 4, 7, 11, 18, 29, … What is the next number in the code?',
    visual: {
      rows: [
        { label: 'Code', tiles: ['3', '4', '7', '11', '18', '29', '?'] },
      ],
    },
    answers: ['47', 'forty seven', 'forty-seven'],
    hint: 'The gaps (1, 3, 4, 7, 11) are not a simple rule. Instead, look at 3 and 4, then 7. Then 4 and 7, then 11. How is each number made?',
    parentHint:
      'Each number is the sum of the two before it (like the Fibonacci numbers): 18 + 29 = 47. A child adding the last gap again (29 + 11 = 40) has found a pattern in the gaps, but the wrong one.',
    success: '47! Each number is the two before it added together: 18 + 29. Mission Control heard the satellite loud and clear.',
    doneMessage: 'Signal received. Next: your route to the Moon.',
    reward: { science: 15 },
  },

  raise_orbit: {
    id: 'raise_orbit',
    type: 'choice',
    act: 1,
    beat: 'beforeMoonBurn',
    title: 'Where does the orbit grow?',
    subject: 'Orbits',
    difficulty: 'Level 4',
    prompt:
      'Zara is circling Earth. She fires her engine forward for a few seconds, then stops. ' +
      'Watch the dotted line. Which part of her orbit moves up the most?',
    choices: [
      { text: 'The far side of Earth, half a lap after she fired', correct: true },
      { text: 'The exact spot where she fired' },
      { text: 'Every part moves up by the same amount' },
      { text: 'Nothing changes; orbits cannot be changed' },
    ],
    hint: 'Try it! Give a short push and look at the dotted line. Where does it bulge outward?',
    parentHint:
      'A prograde burn raises the opposite side of the orbit (the apoapsis). The burn point stays at the same height, because she is already there.',
    success: 'Exactly! Pushing forward lifts the far side of the orbit. Push enough, and the far side reaches the Moon.',
    doneMessage: 'Plan your burn so the far side of your orbit touches the Moon’s path. Click the small map to see it big.',
    reward: { science: 15 },
  },

  // ======================================================================
  // ACT 2 - THE MOON
  // ======================================================================

  moon_face: {
    id: 'moon_face',
    type: 'choice',
    act: 2,
    beat: 'moonOrbit',
    title: 'The Moon’s hidden side',
    subject: 'Spatial reasoning',
    difficulty: 'Level 4',
    prompt:
      'From Earth we always see the same face of the Moon: the “man in the Moon” never turns away. ' +
      'While the Moon goes once around Earth, how many times does it spin around its own middle?',
    choices: [
      { text: 'Exactly once', correct: true },
      { text: 'Zero times; it does not spin' },
      { text: 'Twice' },
      { text: '27 times, once a day' },
    ],
    hint:
      'Walk around a chair while always facing it. By the time you are back where you started, which way have you faced? North, east, south, west... How many turns is that?',
    parentHint:
      'This is a classic trick: “it shows one face, so it doesn’t spin” is wrong. To keep facing Earth, the Moon must turn once for every lap, which is called tidal locking.',
    success: 'Once! To keep facing Earth, it has to turn exactly once per lap. You walked around the chair and turned once too.',
    doneMessage: 'Now slow down and land. Keep your falling speed in the green.',
    reward: { science: 15 },
  },

  shape_arrows: {
    id: 'shape_arrows',
    type: 'choice',
    act: 2,
    beat: 'dockingLights',
    title: 'The landing-light pattern',
    subject: 'Shape patterns',
    difficulty: 'Level 4 • what comes next',
    prompt:
      'As she settles into orbit around the Moon, Zara’s landing lights flash a pattern. What comes next?',
    visual: {
      rows: [
        { label: '1', tiles: ['▲'] },
        { label: '2', tiles: ['▶', '▶'] },
        { label: '3', tiles: ['▼', '▼', '▼'] },
        { label: '4', tiles: ['◀', '◀', '◀', '◀'] },
        { label: '5', tiles: ['?'] },
      ],
    },
    choices: [
      { text: '▲ ▲ ▲ ▲ ▲', correct: true },
      { text: '▲ ▲ ▲ ▲' },
      { text: '▶ ▶ ▶ ▶ ▶' },
      { text: '◀ ◀ ◀ ◀ ◀' },
    ],
    hint: 'Two things change at once. How does the arrow TURN each time? And how many arrows are there each time?',
    parentHint:
      'The arrow turns a quarter turn clockwise each step (up, right, down, left, up again) AND one more arrow is added each time. The distractors each get only one of the two rules right.',
    success: 'Yes! The arrow turns a quarter turn each time AND one more appears, so five arrows pointing up again.',
    doneMessage: 'Pattern spotted. Your landing lights are working!',
    reward: { science: 15 },
  },

  moon_jump: {
    id: 'moon_jump',
    type: 'text',
    act: 2,
    beat: 'moonWalk',
    title: 'Moon jump',
    subject: 'Gravity and multiplication',
    difficulty: 'Level 4',
    prompt:
      'On Earth, Zara can jump 30 cm high. The Moon pulls on her 6 times more weakly than Earth does. ' +
      'About how high can she jump on the Moon, in centimetres?',
    visual: {
      rows: [
        { label: 'Earth', tiles: ['30 cm'], arrow: true },
        { label: 'Moon pull', tiles: ['1/6 as strong'], arrow: true },
        { label: 'Moon jump', tiles: ['? cm'] },
      ],
    },
    answers: ['180', '180 cm', '180cm', 'one hundred eighty', '1.8 m', '1.8m'],
    hint: 'A pull 6 times weaker lets her go 6 times higher with the same jump.',
    parentHint: '30 × 6 = 180 cm, taller than most grown-ups. (Her spacesuit is heavy, so real astronauts jump less.)',
    success: '180 cm: higher than a grown-up’s head! Try jumping with Space and see for yourself.',
    doneMessage: 'Pick up a rock sample. Moon dust has silicon in it, and silicon is what solar cells are made of.',
    reward: { science: 15, resources: { silicon: 2 } },
  },

  mass_weight: {
    id: 'mass_weight',
    type: 'choice',
    act: 2,
    beat: 'moonSample',
    title: 'Lighter, but the same',
    subject: 'Mass and weight',
    difficulty: 'Level 4',
    prompt:
      'Zara’s sample box holds 12 kg of rock. On Earth it was hard to lift. On the Moon it feels easy. Which sentence is true?',
    choices: [
      { text: 'The box has the same amount of rock, but the Moon pulls on it 6 times more weakly', correct: true },
      { text: 'Some of the rock disappeared on the way to the Moon' },
      { text: 'On the Moon the box weighs nothing at all' },
      { text: 'The box is heavier on the Moon' },
    ],
    hint: 'Did anyone take rock out of the box? Then the amount of stuff inside (its mass) hasn’t changed. What did change?',
    parentHint: 'Mass is how much stuff; weight is how hard gravity pulls on that stuff. Mass is the same everywhere; weight on the Moon is about 1/6 of Earth’s.',
    success: 'Right. Mass (how much stuff) is the same everywhere. Weight (how hard it’s pulled) changes from world to world.',
    doneMessage: 'Sample stored. Look for the old footprints near the crater.',
    reward: { science: 15 },
  },

  moon_footprints: {
    id: 'moon_footprints',
    type: 'choice',
    act: 2,
    beat: 'moonFootprints',
    title: 'Footprints that last',
    subject: 'Earth and space science',
    difficulty: 'Level 4',
    prompt:
      'Astronauts left footprints on the Moon in 1969, and they are almost certainly still there today. ' +
      'Why haven’t they been worn away?',
    choices: [
      { text: 'The Moon has no air, so there is no wind or rain to wear them away', correct: true },
      { text: 'Moon dust is sticky, like glue' },
      { text: 'Nobody has walked on them since' },
      { text: 'It is too cold for anything to move there' },
    ],
    hint: 'On a beach, what rubs out your footprints? Does the Moon have any of that?',
    parentHint: 'With no atmosphere there is no wind or water erosion; only tiny meteorite impacts slowly disturb the dust, over millions of years.',
    success: 'Yes. No air means no wind and no rain. Your footprints here could last for millions of years.',
    doneMessage: 'Back to the ship. Next: take off and leave the Moon behind.',
    reward: { science: 10 },
  },

  // Lead 2026-10-07: leaving the Moon is not a slingshot; ask why it was so
  // much easier than leaving Earth, and give the energy number after.
  moon_escape: {
    id: 'moon_escape',
    type: 'choice',
    act: 2,
    beat: 'moonEscape',
    title: 'An easy take-off',
    subject: 'Gravity and energy',
    difficulty: 'Level 4',
    prompt:
      'Leaving Earth took a giant rocket. Zara just left the Moon with a few seconds of her small engine. ' +
      'Why is it so much easier to escape from the Moon than from Earth?',
    visual: {
      rows: [
        { label: 'Earth pull', tiles: ['1'], arrow: true },
        { label: 'Moon pull', tiles: ['1/6 as strong'] },
      ],
    },
    choices: [
      { text: 'The Moon is much smaller, so its gravity is weaker: there is less pull to climb away from', correct: true },
      { text: 'The Moon is closer to the Sun' },
      { text: 'Rockets work better in the cold' },
      { text: 'The Moon pushes rockets away' },
    ],
    hint: 'Jumping on the Moon was easy too. What is different about the Moon’s pull?',
    parentHint:
      'Escape speed is about 11.2 km/s from Earth but only about 2.4 km/s from the Moon. Kinetic energy grows with speed squared, so leaving the Moon needs only about 1/20 of the energy per kilogram.',
    success:
      'Yes! The Moon’s pull is only about 1/6 of Earth’s. To get away from Earth you need about 11 km/s; from the Moon only about 2.4 km/s. ' +
      'So leaving the Moon takes only about 1/20 of the energy. That’s why a small engine was enough!',
    doneMessage: 'Next stop: Mars! Use the time-warp buttons while you’re far from everything.',
    reward: { science: 20 },
  },

  // ======================================================================
  // ACT 3 - MARS AND THE ASTEROID BELT
  // ======================================================================

  mars_day: {
    id: 'mars_day',
    type: 'text',
    act: 3,
    beat: 'marsScan',
    title: 'The Mars clock',
    subject: 'Time and multiplication',
    difficulty: 'Level 4',
    prompt:
      'A day on Mars is about 40 minutes longer than a day on Earth. A rover on Mars wakes up at every Mars sunrise. ' +
      'After 36 Mars days, how many HOURS behind an Earth clock has the rover’s wake-up time drifted?',
    answers: ['24', '24 hours', '24 h', '24h', 'one day', '1 day', 'a day', 'twenty four', 'twenty-four'],
    hint: 'Each Mars day adds 40 minutes. How many minutes after 36 days? Then turn the minutes into hours.',
    parentHint:
      '36 × 40 = 1440 minutes = 24 hours. The rover has slipped a whole day, and Mars mission teams really do live on shifting “Mars time”.',
    success: '24 hours: a whole day! Mars mission teams really live on “Mars time” and keep sliding around the clock.',
    doneMessage: 'Scan complete. Mars is red because of rust: iron in its dust. Next stop: the asteroid belt.',
    reward: { science: 20 },
  },

  crater_sequence: {
    id: 'crater_sequence',
    type: 'text',
    act: 3,
    beat: 'marsCraters',
    title: 'Counting craters',
    subject: 'Number patterns',
    difficulty: 'Level 4 • hard sequence',
    prompt:
      'Zara’s scanner counts craters in five strips of Mars: 2, 6, 12, 20, 30. If the pattern keeps going, how many craters will the sixth strip have?',
    visual: {
      rows: [
        { label: 'Strip', tiles: ['1', '2', '3', '4', '5', '6'] },
        { label: 'Craters', tiles: ['2', '6', '12', '20', '30', '?'] },
      ],
    },
    answers: ['42', 'forty two', 'forty-two'],
    hint: 'Look at how much it grows each time: 2 to 6 is +4, 6 to 12 is +6. Keep going. What will the next jump be?',
    parentHint:
      'The jumps are 4, 6, 8, 10, so the next is 12: 30 + 12 = 42. (Also each number is strip × (strip + 1): 6 × 7 = 42.) The tempting 40 adds the last jump of 10 again.',
    success: '42! The jumps grow by 2 each time: +4, +6, +8, +10, +12. That’s also 6 × 7.',
    doneMessage: 'Crater map sent to Earth.',
    reward: { science: 15 },
  },

  inverse_square: {
    id: 'inverse_square',
    type: 'choice',
    act: 3,
    beat: 'powerDropping',
    title: 'Where did the sunlight go?',
    subject: 'Distance and force',
    difficulty: 'Level 4',
    prompt:
      'Zara’s power meter keeps dropping as she flies away from the Sun. Sunlight spreads out as it travels, like paint sprayed from a can. ' +
      'If she is TWICE as far from the Sun, how much sunlight lands on the same solar panel?',
    visual: {
      rows: [
        { label: '1× away', tiles: ['■'], arrow: true },
        { label: '2× away', tiles: ['□', '□', '□', '□'] },
      ],
    },
    choices: [
      { text: '1/4 as much', correct: true },
      { text: '1/2 as much' },
      { text: 'The same amount' },
      { text: '1/8 as much' },
    ],
    hint: 'Look at the picture. At twice the distance, the same light is spread over a square twice as wide AND twice as tall. How many small squares is that?',
    parentHint:
      'This is the inverse-square law: double the distance, and the light covers 2 × 2 = 4 times the area, so each panel gets 1/4. Gravity weakens the same way.',
    success: 'One quarter! Twice as far means the light is spread over 4 times the area. Gravity fades exactly the same way.',
    doneMessage: 'Watch your Pull meter too: it follows the same rule.',
    reward: { science: 20 },
  },

  belt_spacing: {
    id: 'belt_spacing',
    type: 'choice',
    act: 3,
    beat: 'enterBelt',
    title: 'The empty belt',
    subject: 'Scale',
    difficulty: 'Level 4',
    prompt:
      'In movies, spaceships dodge asteroids packed close together. In the real asteroid belt, big asteroids are usually about a million kilometres apart, ' +
      'almost 3 times the distance from Earth to the Moon. What does that mean?',
    choices: [
      { text: 'A spacecraft can fly straight through without passing close to a single asteroid', correct: true },
      { text: 'Ships must dodge asteroids every few seconds' },
      { text: 'The belt is a solid ring of rock' },
      { text: 'The asteroids are touching each other' },
    ],
    hint: 'Imagine the Earth–Moon distance, then three times that, between each rock and the next.',
    parentHint:
      'The belt holds millions of rocks, but spread through an enormous volume. NASA probes have crossed it many times without special dodging. (We squeezed ours closer so you have something to mine!)',
    success:
      'Correct. The real belt is mostly empty space. We squeezed the rocks much closer together so you have something to mine.',
    doneMessage: 'Use your claw (E) to mine. Stony rocks give silicon, metal rocks give metal, and icy rocks give ice.',
    reward: { science: 15 },
  },

  asteroid_count: {
    id: 'asteroid_count',
    type: 'text',
    act: 3,
    beat: 'beltCatalogue',
    title: 'The missing asteroids',
    subject: 'Counting',
    difficulty: 'Level 4 • careful counting',
    prompt:
      'Zara’s catalogue lists the asteroids near her, numbered 44 to 88. But asteroids 52 to 65 have drifted away out of range. How many asteroids on the list are still in range?',
    visual: {
      rows: [
        { label: 'List', tiles: ['44', '45', '…', '51', '52 … 65', '66', '…', '88'] },
        { label: 'In range?', tiles: ['✓', '✓', '✓', '✓', '✗', '✓', '✓', '✓'] },
      ],
    },
    answers: ['31', 'thirty one', 'thirty-one', '31 asteroids'],
    hint: 'Careful: from 1 to 5 there are 5 numbers, not 4. How many numbers are there from 44 to 88? And how many from 52 to 65?',
    parentHint:
      '44 to 88 is 88 − 44 + 1 = 45 numbers, and 52 to 65 is 65 − 52 + 1 = 14, so 45 − 14 = 31. Forgetting the +1 on only one of them gives 30 or 32.',
    success: '31! There are 45 numbers from 44 to 88, and 14 of them (52 to 65) are gone: 45 − 14 = 31.',
    doneMessage: 'Catalogue updated. Time to mine!',
    reward: { science: 20 },
  },

  cargo_fma: {
    id: 'cargo_fma',
    type: 'text',
    act: 3,
    beat: 'cargoHeavy',
    title: 'Heavy ship, same engine',
    subject: 'Force, mass and acceleration',
    difficulty: 'Level 4',
    prompt:
      'When the ship is empty, one second of full engine makes it 4 units faster. Zara loads ore until the ship is TWICE as heavy. ' +
      'With the same engine push, how many units faster does it get each second now?',
    answers: ['2', 'two', '2 units', '2 units faster'],
    hint: 'Pushing an empty shopping cart vs. a full one with the same push. Twice the mass, with the same push, gives how much of the speed-up?',
    parentHint: 'Acceleration = force ÷ mass. Same force, double mass → half the acceleration: 4 ÷ 2 = 2.',
    success: 'Two! The same push on twice the mass gives half the speed-up. That’s why the ship feels sluggish when it’s full.',
    doneMessage: 'Feel it? Your ship is slower to turn and slower to speed up. Unload at the upgrade bay to make it lively again.',
    reward: { science: 20 },
  },

  mining_logic: {
    id: 'mining_logic',
    type: 'choice',
    act: 3,
    beat: 'sampleCrates',
    title: 'The mixed-up labels',
    subject: 'Logic',
    difficulty: 'Level 4',
    prompt:
      'Three sample crates are labelled STONE, METAL and ICE, but EVERY label is wrong. ' +
      'Zara scans the crate labelled ICE and finds metal inside. What is inside the crate labelled STONE?',
    visual: {
      rows: [
        { label: 'Labels', tiles: ['STONE', 'METAL', 'ICE'] },
        { label: 'Inside', tiles: ['?', '?', 'metal'] },
      ],
    },
    choices: [
      { text: 'Ice', correct: true },
      { text: 'Stone' },
      { text: 'Metal' },
      { text: 'There is no way to tell' },
    ],
    hint: 'The STONE crate cannot hold stone (every label is wrong), and the metal is already found. What is left?',
    parentHint:
      'Metal is in the ICE crate. The STONE crate can’t be stone (wrong label) or metal (taken), so it’s ice, and then the METAL crate holds stone.',
    success: 'Ice! Stone was ruled out by its own label, and the metal was already found. Only ice was left.',
    doneMessage: 'Crates sorted. One more sample: the biggest object in the whole belt.',
    reward: { science: 20, resources: { metal: 1 } },
  },

  belt_why: {
    id: 'belt_why',
    type: 'choice',
    act: 3,
    beat: 'beltFact',
    title: 'The planet that never was',
    subject: 'The solar system',
    difficulty: 'Level 4',
    prompt: 'The asteroid belt is made of rocks left over from when the planets formed. Why did these rocks never clump together into a planet?',
    choices: [
      { text: 'Jupiter’s strong gravity kept stirring them up, so they smashed apart instead of sticking together', correct: true },
      { text: 'A planet used to be there, and it exploded' },
      { text: 'It was too cold for rocks to stick' },
      { text: 'Sunlight pushes the rocks apart' },
    ],
    hint: 'Which giant planet is right next door to the belt? What could its gravity do to rocks trying to gather?',
    parentHint:
      'The exploded-planet idea is an old myth. All the belt’s rocks together weigh less than our Moon. Jupiter’s gravity pumped up their speeds, so collisions broke them apart.',
    success: 'Yes! Jupiter’s gravity kept them too stirred up. All the belt’s rocks together weigh less than our Moon.',
    doneMessage: 'You’re nearly at Ceres.',
    reward: { science: 15 },
  },

  mining_points: {
    id: 'mining_points',
    type: 'text',
    act: 3,
    beat: 'miningScore',
    title: 'The mining score',
    subject: 'Logic and multiplication',
    difficulty: 'Level 4 • think it through',
    prompt:
      'In the Space Miners’ Cup, catching a small asteroid scores 5 points and a big one scores 10 points. Last year’s winner caught 100 asteroids altogether and scored 740 points. How many SMALL asteroids did the winner catch?',
    visual: {
      rows: [
        { label: 'Small', tiles: ['5 points'] },
        { label: 'Big', tiles: ['10 points'] },
        { label: 'Total', tiles: ['100 asteroids', '740 points'] },
      ],
    },
    answers: ['52', 'fifty two', 'fifty-two', '52 small', '52 asteroids'],
    hint: 'Pretend all 100 were small. How many points would that be? Each time you swap a small one for a big one, you get 5 more points.',
    parentHint:
      'All small: 100 × 5 = 500 points, which is 240 short. Each small-to-big swap adds 5, so 240 ÷ 5 = 48 are big and 100 − 48 = 52 are small. Check: 52 × 5 + 48 × 10 = 260 + 480 = 740. (48 is the tempting answer: it is the number of BIG ones.)',
    success: '52 small! If all 100 were small that is 500 points; the extra 240 points came from 48 big ones, so 52 were small.',
    doneMessage: 'Keep mining. Every rock counts!',
    reward: { science: 25 },
  },

  ceres: {
    id: 'ceres',
    type: 'choice',
    act: 3,
    beat: 'ceresScan',
    title: 'A dwarf planet',
    subject: 'Classifying',
    difficulty: 'Level 4',
    prompt:
      'Ceres is round, goes around the Sun, and is the biggest object in the asteroid belt, but it is called a DWARF planet. ' +
      'Which rule for being a full planet does it break?',
    choices: [
      { text: 'It has not cleared the other rocks out of its path around the Sun', correct: true },
      { text: 'It is not round' },
      { text: 'It has no moons' },
      { text: 'It does not go around the Sun' },
    ],
    hint: 'The question already tells you it IS round and DOES go around the Sun. Look at where it lives. Is it alone on its path?',
    parentHint:
      'A planet must (1) orbit the Sun, (2) be round, and (3) have cleared its orbit of other debris. Ceres shares its path with the rest of the belt; Pluto fails the same rule.',
    success: 'Correct: it shares its path with the whole belt. Pluto is a dwarf planet for exactly the same reason.',
    doneMessage: 'Time to build your Big Solar Wings. At Jupiter, the sunlight is very weak.',
    reward: { science: 20, resources: { ice: 1 } },
  },

  jupiter_panels: {
    id: 'jupiter_panels',
    type: 'text',
    act: 3,
    beat: 'buildSolarWings',
    title: 'Sunlight at Jupiter',
    subject: 'Distance and force',
    difficulty: 'Level 4',
    prompt:
      'Jupiter is about 5 times farther from the Sun than Earth is. ' +
      'How many times LESS sunlight falls on a solar panel at Jupiter than at Earth?',
    answers: ['25', 'twenty five', 'twenty-five', '25 times', '25x', '1/25'],
    hint: 'Remember the spreading light: twice as far gave 2 × 2 = 4 times less. Now it’s 5 times as far.',
    parentHint:
      '5 × 5 = 25. (The real figure is about 27, because Jupiter is 5.2 times as far.) NASA’s Juno probe has three solar wings, each about 9 m long, for exactly this reason.',
    success: '25 times less! That’s why NASA’s Juno probe needed three huge solar wings. Yours are unfolding now.',
    doneMessage: 'Big Solar Wings built. Set course for Jupiter.',
    reward: { science: 25 },
  },

  // ======================================================================
  // ACT 4 - JUPITER
  // ======================================================================

  jupiter_size: {
    id: 'jupiter_size',
    type: 'choice',
    act: 4,
    beat: 'jupiterApproach',
    title: 'How big is Jupiter?',
    subject: 'Spatial reasoning',
    difficulty: 'Level 4',
    prompt:
      'Jupiter is about 11 times as WIDE as Earth. Roughly how many Earths could fit INSIDE Jupiter?',
    visual: {
      rows: [
        { label: 'Wide', tiles: ['× 11'] },
        { label: 'Tall', tiles: ['× 11'] },
        { label: 'Deep', tiles: ['× 11'] },
      ],
    },
    choices: [
      { text: 'About 1300', correct: true },
      { text: '11' },
      { text: 'About 120' },
      { text: 'About 11 000' },
    ],
    hint: 'A box twice as wide, twice as tall and twice as deep holds 2 × 2 × 2 = 8 small boxes. Now try 11 in every direction.',
    parentHint:
      'Volume scales with the cube: 11 × 11 × 11 = 1331. “11” is the tempting answer, because it only counts one direction.',
    success: 'About 1300, because 11 × 11 × 11 = 1331. Its Great Red Spot storm alone is wider than Earth.',
    doneMessage: 'Careful: Jupiter is wrapped in deadly radiation. You’ll need your shield.',
    reward: { science: 20 },
  },

  jupiter_shield: {
    id: 'jupiter_shield',
    type: 'choice',
    act: 4,
    beat: 'jupiterImportance',
    title: 'Jupiter, the guardian?',
    subject: 'The solar system',
    difficulty: 'Level 4',
    prompt:
      'Jupiter is more than twice as heavy as all the other planets put together. Many scientists think this has helped Earth. How?',
    choices: [
      { text: 'Its huge gravity pulls in, or flings away, many comets that might otherwise head toward the inner planets', correct: true },
      { text: 'It blocks sunlight that would make Earth too hot' },
      { text: 'Its storms blow the solar wind away from Earth' },
      { text: 'It pushes Earth closer to the Sun to keep us warm' },
    ],
    hint: 'What is Jupiter’s biggest “power”? The same thing that just bent your path.',
    parentHint:
      'In 1994 Comet Shoemaker–Levy 9 smashed into Jupiter, and the biggest scars were as wide as Earth. Jupiter’s gravity captures or ejects many comets (though it can occasionally send some inward too, so scientists still debate how much it “protects” us).',
    success:
      'Yes. In 1994 a whole comet smashed into Jupiter and left scars as wide as Earth. Its gravity catches and flings many comets.',
    doneMessage: 'Now use that same gravity. Swing past Jupiter and let it steer you to Europa.',
    reward: { science: 20 },
  },

  moon_resonance: {
    id: 'moon_resonance',
    type: 'text',
    act: 4,
    beat: 'jupiterMoons',
    title: 'The moon dance',
    subject: 'Patterns',
    difficulty: 'Level 4',
    prompt:
      'Three of Jupiter’s moons move in step. Every time Ganymede goes around Jupiter once, Europa goes around twice and Io goes around 4 times. ' +
      'By the time Ganymede has gone around 3 times, how many laps have the three moons made altogether?',
    visual: {
      rows: [
        { label: 'Ganymede', tiles: ['1'] },
        { label: 'Europa', tiles: ['1', '1'] },
        { label: 'Io', tiles: ['1', '1', '1', '1'] },
      ],
    },
    answers: ['21', 'twenty one', 'twenty-one', '21 laps'],
    hint: 'One Ganymede lap means 1 + 2 + 4 laps in total. What about three Ganymede laps?',
    parentHint: '(1 + 2 + 4) × 3 = 21. This 1 : 2 : 4 rhythm is real. It’s called the Laplace resonance, and its squeezing is what warms Europa’s insides.',
    success: '21 laps! This 1-2-4 dance is real, and the tugging it causes is what keeps Europa warm inside.',
    doneMessage: 'Next: catch Jupiter’s pull, then on to Europa.',
    reward: { science: 25 },
  },

  moon_positions: {
    id: 'moon_positions',
    type: 'choice',
    act: 4,
    beat: 'moonDance',
    title: 'Where will the moons be?',
    subject: 'Shape patterns',
    difficulty: 'Level 4 • what comes next',
    prompt:
      'Two moons race around a track of 5 spaces (□ is an empty space). Every step, Europa ● moves 1 space to the right and Io ◆ moves 2 spaces to the right. When a moon runs off the right end, it comes back in on the left. What does step 4 look like?',
    visual: {
      rows: [
        { label: 'Step 1', tiles: ['●', '◆', '·', '·', '·'] },
        { label: 'Step 2', tiles: ['·', '●', '·', '◆', '·'] },
        { label: 'Step 3', tiles: ['◆', '·', '●', '·', '·'] },
        { label: 'Step 4', tiles: ['?'] },
      ],
    },
    choices: [
      { text: '□ □ ◆ ● □', correct: true },
      { text: '□ □ ● ◆ □' },
      { text: '□ ◆ □ ● □' },
      { text: '◆ □ □ ● □' },
    ],
    hint: 'Move one moon at a time. Where is ● in step 3, and where does 1 space right take it? Then do ◆: 2 spaces right from where it is.',
    parentHint:
      '● goes 1 → 2 → 3 → 4 (spaces counted from 1), ◆ goes 2 → 4 → 1 (wrapping) → 3. So step 4 is ◆ in space 3 and ● in space 4. The distractors swap them, move ◆ only 1 space, or forget to move ◆.',
    success: 'Right! ● moves to space 4, and ◆ jumps 2 to space 3. Real moons keep a steady rhythm like this too.',
    doneMessage: 'The moons are right where you said they would be.',
    reward: { science: 20 },
  },

  fuel_backwards: {
    id: 'fuel_backwards',
    type: 'text',
    act: 4,
    beat: 'europaOrbit',
    title: 'Working backwards',
    subject: 'Logic',
    difficulty: 'Level 4',
    prompt:
      'On her way here, Zara made 3 big burns. Each burn used up HALF of the fuel that was in her tank. ' +
      'She reached Europa with 1 tonne left. How many tonnes did she have before the first burn?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['?'], arrow: true },
        { label: 'Burn 1', tiles: ['½'], arrow: true },
        { label: 'Burn 2', tiles: ['½'], arrow: true },
        { label: 'Burn 3', tiles: ['½'], arrow: true },
        { label: 'Europa', tiles: ['1 t'] },
      ],
    },
    answers: ['8', 'eight', '8 t', '8 tonnes', '8 tons'],
    hint: 'Start at the end. Before the last burn she had twice as much as 1 tonne. Keep going backwards.',
    parentHint: '1 → 2 → 4 → 8. Doubling backwards undoes each halving. A common slip is 1 + ½ + ½ + ½, or 6.',
    success: 'Eight tonnes: 8 → 4 → 2 → 1. Without the slingshots she would have needed much more.',
    doneMessage: 'Landing clearance granted. Legs down. Slow and gentle.',
    reward: { science: 20 },
  },

  // ======================================================================
  // FINALE - EUROPA
  // ======================================================================

  europa_ocean: {
    id: 'europa_ocean',
    type: 'choice',
    act: 5,
    beat: 'europaWalk',
    title: 'An ocean under the ice',
    subject: 'Energy',
    difficulty: 'Level 4',
    prompt:
      'Europa’s surface is about −160 °C, far colder than anywhere on Earth. Yet scientists think a salty ocean of LIQUID water lies under the ice. ' +
      'What keeps it from freezing?',
    choices: [
      { text: 'Jupiter’s gravity squeezes and stretches Europa as it goes around, which heats up its inside', correct: true },
      { text: 'Sunlight shines through the ice and warms it' },
      { text: 'The water is so salty it can never freeze' },
      { text: 'Hot lava flows across the top' },
    ],
    hint: 'Bend a paperclip back and forth quickly, then touch the bend. It’s warm! What is bending Europa back and forth?',
    parentHint:
      'Tidal heating: Europa’s slightly stretched orbit (kept that way by the moon dance) means Jupiter’s pull keeps flexing it. Salt helps a little, but nowhere near enough to stay liquid at −160 °C.',
    success: 'Yes! Jupiter keeps kneading Europa like dough, and that bending makes heat, just like a bent paperclip.',
    doneMessage: 'Walk to the crack in the ice and start the drill.',
    reward: { science: 25 },
  },

  habitability: {
    id: 'habitability',
    type: 'choice',
    act: 5,
    beat: 'drillResult',
    title: 'Could life live here?',
    subject: 'Life science',
    difficulty: 'Level 4',
    prompt:
      'Zara’s drill found salty liquid water. Scientists say life as we know it needs THREE things. Which list is it?',
    choices: [
      { text: 'Liquid water, a source of energy, and the right chemical ingredients', correct: true },
      { text: 'Air, sunshine and green plants' },
      { text: 'Oxygen, warm weather and dry land' },
      { text: 'Water, ice and snow' },
    ],
    hint: 'Deep in Earth’s oceans, where no sunlight reaches, creatures live around hot vents. What do they have, and what do they NOT need?',
    parentHint:
      'Deep-sea vent life on Earth needs no sunlight or air, only water, chemical energy and the right elements (like carbon). That’s why Europa is one of the best places to look for life.',
    success:
      'Correct: water, energy and ingredients. Europa may have all three, which makes it one of the best places in the solar system to look for life.',
    doneMessage: 'Habitability check complete. Mission accomplished, scientist!',
    reward: { science: 30 },
  },
};

/** Stable play order (the story order). Save files address questions by id. */
export const SPACE_QUESTION_ORDER = Object.keys(LEVEL4_SPACE_QUESTIONS);

/**
 * LEVEL 1 overlay (1st grade, RULES.md of 2026-10-10): same ids, same answer
 * types, same story beats and rewards as Level 4. Only what the child reads
 * is replaced: prompt, choices, hint, success and doneMessage. One idea per
 * question, short everyday words, whole numbers up to 20 with one + or - step,
 * and a picture (visual tiles) where it helps. Made-up numbers say "pretend".
 * The numeric answers are the same as before; they are checked in
 * scripts/test-space-questions.mjs.
 */
export const LEVEL1_SPACE_QUESTIONS = {
  wings_fold: {
    subject: 'Forces and air',
    difficulty: 'Level 1 • air and wings',
    prompt: 'Space has no air. Can a ship’s wings work there?',
    choices: [
      { text: 'Yes, very well' },
      { text: 'Yes, they fly' },
      { text: 'No, no air', correct: true },
      { text: 'Only at night' },
    ],
    hint: 'Wings push on air. Is there any air in space?',
    parentHint:
      'Wings need air to push against. Gravity needs no air at all, and Earth still pulls the ship up here.',
    success: 'Right! Wings need air to push on. Space has none.',
    doneMessage: 'Turn left and right to turn the ship.',
  },

  zero_g: {
    subject: 'Gravity',
    difficulty: 'Level 1 • falling together',
    prompt: 'Zara’s pencil floats in the ship. Does Earth still pull on it?',
    choices: [
      { text: 'No, Earth is gone' },
      { text: 'Yes, it falls', correct: true },
      { text: 'Only Zara falls' },
      { text: 'Nothing falls at all' },
    ],
    hint: 'Jump with a ball. Does the ball fall with you?',
    parentHint:
      'Everything in the ship falls at the same rate, so nothing falls relative to anything else, and it looks like floating. Earth’s pull up here is still about 9/10 of what it is on the ground.',
    success: 'Yes! Earth still pulls. The ship and pencil fall together.',
    doneMessage: 'Now go around Earth. Watch the dotted line.',
  },

  sunrises: {
    subject: 'Time and skip counting',
    difficulty: 'Level 1 • skip counting',
    prompt: 'Pretend a lap takes 2 hours. Zara sleeps 8 hours. How many sunrises?',
    visual: {
      rows: [
        { label: 'Lap', tiles: ['2 hours', '1 sunrise'], arrow: true },
        { label: 'Sleep', tiles: ['8 hours', '? sunrises'] },
      ],
    },
    answers: ['4', 'four', '4 sunrises'],
    hint: 'Count by 2s up to 8. How many 2s?',
    parentHint: '8 ÷ 2 = 4, done as skip counting. (The real space station laps every 90 minutes, so its crew sees 16 sunrises a day.)',
    success: 'Four! Real astronauts see about 16 sunrises a day!',
    doneMessage: 'A satellite is coming with a broken wing!',
  },

  solar_source: {
    subject: 'Energy',
    difficulty: 'Level 1 • what makes it go',
    prompt: 'This satellite’s blue wings face the Sun. What do they do?',
    choices: [
      { text: 'Light makes power', correct: true },
      { text: 'Flap to fly' },
      { text: 'Keep it warm' },
      { text: 'Catch rain to drink' },
    ],
    hint: 'Nobody fills it. What does sunlight give it?',
    parentHint: 'The “wings” are solar panels: cells that turn light straight into electricity. The tempting answer is “flap”, because we call them wings.',
    success: 'Correct! They are solar panels that catch sunlight.',
    doneMessage: 'Turn the broken wing to face the Sun!',
  },

  solar_night: {
    subject: 'Counting and patterns',
    difficulty: 'Level 1 • patterns',
    prompt: 'Each trip has 1 dark part. In 3 trips, how many dark?',
    visual: {
      rows: [
        { label: 'Trip', tiles: ['☀', '☀', '🌑'] },
      ],
    },
    choices: [
      { text: '6 dark' },
      { text: '3 dark', correct: true },
      { text: '9 dark' },
      { text: '1 dark' },
    ],
    hint: 'Count only the dark ones, once for each trip.',
    parentHint: 'One dark part per trip, 3 trips, so 3. The tempting 6 counts the sunny parts, and 9 counts all of them.',
    success: 'Three! Satellites carry batteries for the dark part.',
    doneMessage: 'Fixed! Mission Control says thank you.',
  },

  raise_orbit: {
    subject: 'Orbits',
    difficulty: 'Level 1 • watch and notice',
    prompt: 'Zara pushes forward once. Which part of the path gets bigger?',
    choices: [
      { text: 'The far side', correct: true },
      { text: 'Only where she pushed' },
      { text: 'Nothing changes' },
      { text: 'The whole path shrinks' },
    ],
    hint: 'Where does the dotted line stretch out?',
    parentHint: 'A forward burn raises the opposite side of the orbit. The burn point stays at the same height, because she is already there.',
    success: 'Yes! Pushing forward stretches the far side of the path.',
    doneMessage: 'Wait for the BURN NOW sign!',
  },

  moon_face: {
    subject: 'Shapes and turning',
    difficulty: 'Level 1 • turning around',
    prompt: 'Zara walks around a tree, always facing it. How many turns?',
    choices: [
      { text: '2 turns' },
      { text: '1 turn', correct: true },
      { text: '4 turns' },
      { text: '0 turns' },
    ],
    hint: 'Walk around a chair. Count how many times you turned.',
    parentHint:
      'Facing the tree the whole way means she faces every direction once: one full turn. The Moon does the same with Earth, which is why we always see the same side.',
    success: 'Once! The Moon turns once each time it circles Earth.',
    doneMessage: 'Land slowly. Keep the speed in the green.',
  },

  moon_jump: {
    subject: 'Gravity and skip counting',
    difficulty: 'Level 1 • skip counting',
    prompt: 'Pretend Zara jumps 6 books. On the Moon, 6 more. How many?',
    visual: {
      rows: [
        { label: 'Earth', tiles: ['📚', '📚', '📚', '📚', '📚', '📚'], arrow: true },
        { label: 'Moon', tiles: ['6 more', '?'] },
      ],
    },
    answers: ['12', 'twelve', '12 books'],
    hint: 'Count 6 books, then 6 more. How many in all?',
    parentHint: '6 + 6 = 12, as skip counting. The “6 more” is a pretend number. Real Moon jumps are about 6 times higher, because the Moon pulls about 6 times more weakly than Earth.',
    success: 'Twelve! The Moon pulls less, so jumps go higher.',
    doneMessage: 'Now pick up a Moon rock!',
  },

  mass_weight: {
    subject: 'Mass and weight',
    difficulty: 'Level 1 • what changes',
    prompt: 'Zara has 5 rocks. On the Moon they feel light. How many?',
    choices: [
      { text: 'No rocks at all' },
      { text: 'Lots more rocks' },
      { text: '6 rocks' },
      { text: 'Still 5 rocks', correct: true },
    ],
    hint: 'Did she take any rocks out? Count them again.',
    parentHint: 'The amount of stuff (mass) never changed; only the pull on it (weight) did. Lighter does not mean fewer.',
    success: 'Five! The same rocks, just pulled on less.',
    doneMessage: 'Now find the old footprints!',
  },

  moon_footprints: {
    subject: 'Earth and space science',
    difficulty: 'Level 1 • what is missing',
    prompt: 'Beach footprints wash away. Why do Moon footprints stay?',
    choices: [
      { text: 'A dog ate them' },
      { text: 'Too dark to see' },
      { text: 'Astronauts drew them' },
      { text: 'No wind or rain', correct: true },
    ],
    hint: 'What rubs footprints away at the beach?',
    parentHint: 'No air means no wind or weather. Footprints on the Moon can last millions of years.',
    success: 'Yes! No wind or rain, so footprints last for ages.',
    doneMessage: 'Back to the ship. Next: take off!',
  },

  moon_escape: {
    subject: 'Gravity',
    difficulty: 'Level 1 • why is it easy',
    prompt: 'Zara leaves the Moon with a small engine. Why is that easy?',
    visual: {
      rows: [
        { label: 'Earth', tiles: ['big pull'], arrow: true },
        { label: 'Moon', tiles: ['small pull'] },
      ],
    },
    choices: [
      { text: 'It is very hot' },
      { text: 'It pushes rockets' },
      { text: 'It is small', correct: true },
      { text: 'It is loud' },
    ],
    hint: 'Remember your Moon jump? Was its pull big or small?',
    parentHint: 'The Moon’s gravity is about 1/6 of Earth’s, so leaving it takes only about 1/20 of the energy.',
    success: 'Yes! The Moon’s pull is small, so leaving is easy.',
    doneMessage: 'On your way to Mars!',
  },

  mars_day: {
    subject: 'Time and counting',
    difficulty: 'Level 1 • counting days (tricky!)',
    prompt: 'Pretend the robot wakes 1 hour later each day. What time on Friday?',
    visual: {
      rows: [
        { label: 'Days', tiles: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        { label: 'Wakes', tiles: ['6', '?', '?', '?', '?'] },
      ],
    },
    answers: ['10', 'ten', '10 o clock', '10 oclock', '10 o’clock', "10 o'clock", '10:00'],
    hint: 'Count up one hour for each day after Monday.',
    parentHint: 'Monday to Friday is 4 steps later, not 5: 6 + 4 = 10. The tempting 11 counts the days instead of the gaps between them (a fence-post puzzle). The hour is a pretend number: a Mars day is really about 40 minutes longer than ours.',
    success: 'Ten o’clock! Only 4 one-hour steps from Monday to Friday.',
    doneMessage: 'Mars is red. Next: the asteroid belt!',
  },

  inverse_square: {
    subject: 'Light and distance',
    difficulty: 'Level 1 • spreading out',
    prompt: 'Zara steps back. The light circle gets bigger. Brighter or dimmer?',
    visual: {
      rows: [
        { label: 'Close', tiles: ['■'], arrow: true },
        { label: 'Far', tiles: ['□', '□', '□', '□'] },
      ],
    },
    choices: [
      { text: 'It gets brighter' },
      { text: 'It gets dimmer', correct: true },
      { text: 'It stays the same' },
      { text: 'It goes dark' },
    ],
    hint: 'Same jam, bigger toast. Is it thicker or thinner?',
    parentHint: 'The same light covering more area is dimmer on each spot. Sunlight does the same as she flies away from the Sun, so her power meter drops.',
    success: 'Right! The same light, spread wider, is dimmer.',
    doneMessage: 'Your Power bar drops as you fly away.',
  },

  belt_spacing: {
    subject: 'Scale',
    difficulty: 'Level 1 • movies vs. real',
    prompt: 'Zara looks out of her window in space. What does she see?',
    choices: [
      { text: 'Mostly empty space', correct: true },
      { text: 'A wall of rock' },
      { text: 'Rocks bump everywhere' },
      { text: 'A crowded road' },
    ],
    hint: 'Rocks are very far apart. Few are near her window.',
    parentHint: 'The real belt is mostly empty; probes fly through without dodging. We packed the game’s rocks closer so there is something to mine.',
    success: 'Correct! Real space is mostly empty, with rocks far apart.',
    doneMessage: 'Fly close to a rock and press E.',
  },

  cargo_fma: {
    subject: 'Push and heavy things',
    difficulty: 'Level 1 • full ships are slow',
    prompt: 'Pretend an empty ship goes 8 steps. Full: 4 fewer. How many?',
    answers: ['4', 'four', '4 steps', '4 steps faster'],
    hint: 'Start at 8. Count back 4. Where do you land?',
    parentHint: 'Same push, twice the mass, half the speed-up. Here the sum is simply 8 − 4 = 4. The tempting 8 forgets that a full ship is slower.',
    success: 'Four! A full ship is slower. More stuff, less speed-up.',
    doneMessage: 'Use the upgrade bay to make it light.',
  },

  mining_logic: {
    subject: 'Logic',
    difficulty: 'Level 1 • what is left',
    prompt: 'Every label is wrong. What is really in the STONE crate?',
    visual: {
      rows: [
        { label: 'Labels', tiles: ['STONE', 'METAL', 'ICE'] },
        { label: 'Inside', tiles: ['?', 'stone', 'metal'] },
      ],
    },
    choices: [
      { text: 'Metal' },
      { text: 'Ice', correct: true },
      { text: 'Nothing' },
      { text: 'Stone' },
    ],
    hint: 'Stone and metal are in other crates. What is left?',
    parentHint: 'Elimination: two of the three are placed, so the last crate holds the last thing. The tempting answer just reads the label.',
    success: 'Ice! The other two crates already hold stone and metal.',
    doneMessage: 'Crates sorted! One more thing to see: Ceres.',
    title: 'The wrong labels',
  },

  belt_why: {
    subject: 'The solar system',
    difficulty: 'Level 1 • cause and effect',
    prompt: 'Jupiter tugs on the rocks all the time. What happens to them?',
    choices: [
      { text: 'Fly to the Sun' },
      { text: 'They melt away' },
      { text: 'They turn to ice' },
      { text: 'They keep crashing', correct: true },
    ],
    hint: 'Stack blocks while the table shakes. Can you build?',
    parentHint: 'Jupiter’s gravity stirred the belt so much that collisions broke rocks apart instead of letting them clump into a planet.',
    success: 'Yes! Jupiter keeps shaking the rocks. No planet can form.',
  },

  ceres: {
    subject: 'Sorting',
    difficulty: 'Level 1 • sorting by rules',
    prompt: 'Ceres is round, but shares its path with rocks. What is it?',
    choices: [
      { text: 'A giant rocky moon' },
      { text: 'A star' },
      { text: 'A big cloud' },
      { text: 'A dwarf planet', correct: true },
    ],
    hint: 'A planet has its own path. Does Ceres?',
    parentHint: 'A planet is round, circles the Sun, and has its path all to itself. Ceres does 2 of the 3, so it is a dwarf planet, just like Pluto.',
    success: 'A dwarf planet! It is round, but shares its path.',
    doneMessage: 'Build Big Solar Wings for Jupiter!',
  },

  jupiter_panels: {
    subject: 'Skip counting',
    difficulty: 'Level 1 • more panels',
    prompt: 'Pretend she needs 10 panels at Jupiter. She adds 5. How many?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['10 panels'], arrow: true },
        { label: 'Add', tiles: ['5 more'], arrow: true },
        { label: 'Total', tiles: ['?'] },
      ],
    },
    answers: ['15', 'fifteen', '15 panels'],
    hint: 'Start at 10, then count on 5.',
    parentHint: '10 + 5 = 15, as a pretend count. Real sunlight at Jupiter is about 25 times weaker than at Earth, so a real ship needs far more panels.',
    success: 'Fifteen! Her Big Solar Wings need that many panels.',
    doneMessage: 'Big Solar Wings built. Off to Jupiter!',
  },

  jupiter_size: {
    subject: 'Big and small',
    difficulty: 'Level 1 • big and small',
    prompt: 'Pretend Jupiter is a basketball. How big is Earth?',
    visual: null,
    choices: [
      { text: 'A soccer ball' },
      { text: 'A grape', correct: true },
      { text: 'Another basketball' },
      { text: 'A car' },
    ],
    hint: 'Jupiter is the biggest. Is Earth big or small?',
    parentHint: 'Jupiter is about 11 times as wide as Earth: a 24 cm basketball makes Earth about 2 cm, grape-sized. More than 1,000 Earths would fit inside.',
    success: 'A grape! About 11 Earths fit across Jupiter.',
    doneMessage: 'Careful! Jupiter has bad rays. Get your shield.',
  },

  jupiter_shield: {
    subject: 'The solar system',
    difficulty: 'Level 1 • cause and effect',
    prompt: 'Jupiter grabbed a big comet. How does that help Earth?',
    choices: [
      { text: 'Earth is safer', correct: true },
      { text: 'Jupiter gets smaller' },
      { text: 'Earth gets warmer' },
      { text: 'The Sun gets brighter' },
    ],
    hint: 'Where did the comet go? Can it come here now?',
    parentHint: 'In 1994 a comet really did smash into Jupiter. Jupiter’s gravity catches or flings away many comets.',
    success: 'Yes! Jupiter caught it. Earth is safer.',
    doneMessage: 'Now fly around Jupiter to reach Europa.',
  },

  moon_resonance: {
    subject: 'Patterns',
    difficulty: 'Level 1 • lap patterns',
    prompt: 'Ganymede makes 2 laps. Io makes 4 laps each time. How many?',
    visual: {
      rows: [
        { label: 'Ganymede', tiles: ['lap 1', 'lap 2'], arrow: true },
        { label: 'Io', tiles: ['4 laps', '4 laps'], arrow: true },
        { label: 'Total', tiles: ['?'] },
      ],
    },
    answers: ['8', 'eight', '8 times', '8 laps'],
    hint: 'Each Ganymede lap, Io makes 4. Add 4 twice.',
    parentHint: '4 + 4 = 8. This 1-2-4 rhythm is real, and its tugging keeps Europa warm inside.',
    success: 'Eight! This dance is real. It warms Europa inside.',
    doneMessage: 'Europa is close. Get ready to land!',
  },

  moon_positions: {
    subject: 'Patterns',
    difficulty: 'Level 1 • what comes next',
    prompt: 'Europa’s dot bounces back and forth. What comes next?',
    visual: {
      rows: [
        { label: 'Step 1', tiles: ['●', '·', '·'] },
        { label: 'Step 2', tiles: ['·', '●', '·'] },
        { label: 'Step 3', tiles: ['·', '·', '●'] },
        { label: 'Step 4', tiles: ['·', '●', '·'] },
        { label: 'Step 5', tiles: ['?'] },
      ],
    },
    choices: [
      { text: '● ● □' },
      { text: '● □ □', correct: true },
      { text: '□ ● □' },
      { text: '□ □ ●' },
    ],
    hint: 'The dot is going left now. Keep going left.',
    parentHint: 'It bounces: right, right, then back left, left. After the middle it reaches the left end again.',
    success: 'Yes! It bounced at the end, then went left.',
    doneMessage: 'The moons are right where you said.',
  },

  fuel_backwards: {
    subject: 'Working backwards',
    difficulty: 'Level 1 • work backwards (tricky!)',
    prompt: 'Zara burned 9 cans. 3 cans are left. How many at first?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['?'], arrow: true },
        { label: 'Burned', tiles: ['9 cans'], arrow: true },
        { label: 'Left', tiles: ['3 cans'] },
      ],
    },
    answers: ['12', 'twelve', '12 cans'],
    hint: 'Count up from 3: add the 9 that were burned.',
    parentHint: '3 + 9 = 12: start from what is left and add back what was burned. The tempting 6 subtracts 3 from 9 instead.',
    success: 'Twelve! 9 burned plus 3 left makes 12.',
    doneMessage: 'Time to land. Slow and gentle!',
  },

  europa_ocean: {
    subject: 'Heat',
    difficulty: 'Level 1 • rubbing and bending',
    prompt: 'Rubbing makes hands warm. Jupiter squeezes Europa. What might that do?',
    choices: [
      { text: 'Makes it colder' },
      { text: 'Warms the inside', correct: true },
      { text: 'Turns ice to rock' },
      { text: 'Nothing at all' },
    ],
    hint: 'What did your hands do? Squeezing does that too.',
    parentHint: 'Tidal heating: Jupiter’s changing pull flexes Europa, and flexing makes heat, like a bent paperclip.',
    success: 'Yes! Squeezing warms Europa. So water can hide under ice.',
    doneMessage: 'Walk to the ice crack. Start the drill!',
  },

  habitability: {
    subject: 'Life science',
    difficulty: 'Level 1 • what life needs',
    prompt: 'Crabs live in the dark sea. What do they need?',
    choices: [
      { text: 'Water, energy, food', correct: true },
      { text: 'Sunshine on green grass' },
      { text: 'Snow and ice' },
      { text: 'Dry land and wind' },
    ],
    hint: 'Crabs live in the dark, under water. No grass there!',
    parentHint: 'Deep-sea vent life needs water, chemical energy and the right elements, but no sunlight or air. Europa may have all three.',
    success: 'Correct! Water, energy and food. Europa may have all three.',
    doneMessage: 'Mission complete, scientist!',
  },

  signal_sequence: {
    difficulty: 'Level 1 • number pattern',
    prompt: 'The satellite beeps 1, 2, 4, 7, 11. What number comes next?',
    visual: {
      rows: [
        { label: 'Code', tiles: ['1', '2', '4', '7', '11', '?'] },
      ],
    },
    answers: ['16', 'sixteen'],
    hint: 'Jumps: 1, 2, 3, 4. What is the next one?',
    parentHint: 'The jumps grow by one each time: +1, +2, +3, +4, then +5, so 11 + 5 = 16. The tempting 15 adds 4 again.',
    success: '16! Each jump is 1 bigger than the last.',
    doneMessage: 'Message received! Next: the Moon.',
  },

  shape_arrows: {
    difficulty: 'Level 1 • what comes next',
    prompt: 'The lights flash arrows in a pattern. What comes next?',
    visual: {
      rows: [
        { label: 'Lights', tiles: ['▲', '▶', '▼', '◀', '▲', '▶', '?'] },
      ],
    },
    choices: [
      { text: '▲' },
      { text: '▼', correct: true },
      { text: '◀' },
      { text: '▶' },
    ],
    hint: 'Up, right, down, left. Then it starts again.',
    parentHint: 'The arrow turns a quarter turn each time and repeats every 4. After ▲ ▶ comes ▼.',
    success: 'Yes! Up, right, down, left, then again. Next is down.',
    title: 'The light pattern',
  },

  crater_sequence: {
    difficulty: 'Level 1 • number pattern',
    prompt: 'Zara counts holes: 20, 18, 15, 11. What comes next?',
    visual: {
      rows: [
        { label: 'Craters', tiles: ['20', '18', '15', '11', '?'] },
      ],
    },
    answers: ['6', 'six'],
    hint: 'Each time, how many less? Take away one more.',
    parentHint: 'It goes down by 2, 3, 4, then 5: 11 − 5 = 6. The tempting 7 takes away 4 again.',
    success: 'Six! Each time it takes away one more.',
  },

  asteroid_count: {
    difficulty: 'Level 1 • careful counting',
    prompt: '20 rocks. Rocks 5 to 9 drift away. How many are left?',
    visual: {
      rows: [
        { label: 'Gone', tiles: ['5', '6', '7', '8', '9'] },
      ],
    },
    answers: ['15', 'fifteen', '15 asteroids'],
    hint: 'Count the gone rocks. Take that many from 20.',
    parentHint: '5 to 9 is 5 numbers (not 4!), so 20 − 5 = 15.',
    success: '15! Five rocks drifted away from 20.',
    doneMessage: 'List done. Time to mine!',
  },

  mining_points: {
    subject: 'Counting by twos',
    difficulty: 'Level 1 • think it through',
    prompt: 'Big rocks are 2 points each. Zara got 6 points. How many?',
    visual: {
      rows: [
        { label: 'Big', tiles: ['2 points', '? rocks'] },
        { label: 'Total', tiles: ['6 points'] },
      ],
    },
    answers: ['3', 'three', '3 big', '3 rocks'],
    hint: 'Count by 2s until you reach 6. How many jumps?',
    parentHint: '2, 4, 6 is 3 big rocks, each worth 2. The tempting 6 forgets that each big rock is worth 2 points.',
    success: 'Three! 2 + 2 + 2 makes 6 points.',
  },
};


function difficultyLevel() {
  try {
    const raw = localStorage.getItem('rocket_village_profile');
    const n = raw ? JSON.parse(raw)?.difficulty : null;
    return n === 1 ? 1 : 4;
  } catch {
    return 4;
  }
}

function selectBank() {
  // Chapter 5 has its own bank, Level 1 overlay included (ch5/questions.ch5.js).
  if (IS_CH5) return ch5Bank(difficultyLevel());
  // Chapter 6: the station questions (Part B), the life-on-board questions and Part E's, Level 1 overlays merged.
  // (The engine build moved here from Chapter 5, with its question.)
  // Chapter 7: one bank merged from each part's file (ch7/questions.ch7.js), at the child's Level.
  if (IS_CH7) return ch7Bank(difficultyLevel());
  if (IS_CH6) return { c5_deuterium: ch5Bank(difficultyLevel()).c5_deuterium, ...partBBank(difficultyLevel()), ...partQuestsBank(difficultyLevel()), ...partEBank(difficultyLevel()) };
  if (difficultyLevel() !== 1) return LEVEL4_SPACE_QUESTIONS;
  const out = {};
  for (const [id, base] of Object.entries(LEVEL4_SPACE_QUESTIONS)) {
    const overlay = LEVEL1_SPACE_QUESTIONS[id];
    out[id] = overlay ? { ...base, ...overlay } : base;
  }
  return out;
}

/** Level 1 overlay applied to every Level 4 question (for the tests: node has
 *  no launcher, so SPACE_QUESTIONS there is always the Level 4 bank). */
export function level1Bank() {
  const out = {};
  for (const [id, base] of Object.entries(LEVEL4_SPACE_QUESTIONS)) {
    const overlay = LEVEL1_SPACE_QUESTIONS[id];
    out[id] = overlay ? { ...base, ...overlay } : base;
  }
  return out;
}

export const SPACE_QUESTIONS = Object.fromEntries(Object.entries(selectBank()).map(([id, q]) => [id, heroQuestion(q)])); // a boy hero: he/his

/** The question a story beat asks, or null. */
export function questionForBeat(beat) {
  for (const q of Object.values(SPACE_QUESTIONS)) if (q.beat === beat) return q;
  return null;
}

export function getSpaceQuestion(id) {
  return SPACE_QUESTIONS[id] ?? null;
}

/** Same matching rules as Chapter 3: choices by flag, text case/space-insensitive. */
export function checkSpaceAnswer(question, given) {
  return checkChapter3Answer(question, given);
}

export default SPACE_QUESTIONS;
