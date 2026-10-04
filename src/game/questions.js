// The authored question bank for Level 3 (docs/QUEST_SPEC.md §3).
//
// Content only: no DOM, no THREE, no game state. Everything here is data plus
// one pure predicate, so the HUD (A5), the quest engine (quests.js) and the
// verification scripts can all share it without importing a renderer.
//
// Two answer shapes, deliberately alternating so a child never faces two blank
// text boxes in a row (spec §2.4):
//   type:'choice' -> choices[{text, correct}], exactly one correct, renderer shuffles
//   type:'text'   -> answers[] of accepted spellings, matched case/space-insensitively
//
// Wrong answers cost NOTHING and are always retryable. That rule lives in the
// engine, but it starts here: no question carries a penalty, a timer or an
// attempt limit field, so there is nothing for a caller to accidentally honour.

import { LEVEL1_QUESTIONS } from './questions.level1.js';

/**
 * Which difficulty the launcher last chose: 1 or 4.
 *
 * Read directly rather than through profile.js, because this module is
 * deliberately free of every other import - the verification scripts load it
 * in node, where there is no localStorage and no launcher at all. A missing or
 * unreadable value means Level 4, which is the authored default.
 */
function difficultyLevel() {
  try {
    const raw = localStorage.getItem('rocket_village_profile');
    const n = raw ? JSON.parse(raw)?.difficulty : null;
    return n === 1 ? 1 : 4;
  } catch {
    return 4;
  }
}

/** @typedef {'choice'|'text'} QuestionType */

/**
 * @typedef {object} QuestionChoice
 * @property {string}  text
 * @property {boolean} [correct]
 */

/**
 * @typedef {object} QuestionVisualRow
 * @property {string}   label
 * @property {string[]} tiles
 * @property {boolean}  [arrow]   draw an arrow into the next row
 */

/**
 * @typedef {object} QuestionReward
 * @property {number}  [xp]
 * @property {Object<string, number>} [resources]
 * @property {string}  [part]
 * @property {string}  [rank]
 * @property {boolean} [bonus]
 */

/**
 * @typedef {object} Question
 * @property {string} id
 * @property {QuestionType} type
 * @property {string} title
 * @property {string} subject
 * @property {string} difficulty
 * @property {string} stationId            building id from rocketVillageLayout.js
 * @property {string} prompt
 * @property {{rows: QuestionVisualRow[]}} [visual]
 * @property {QuestionChoice[]} [choices]  type:'choice'
 * @property {string[]} [answers]          type:'text'
 * @property {string} hint
 * @property {string} parentHint
 * @property {string} success
 * @property {string} doneMessage
 * @property {QuestionReward} reward
 */

/**
 * The ten authored questions, in ladder order. Ids are stable: the save file
 * and the quest chain both address questions by id, never by index.
 * @type {Object<string, Question>}
 */
const LEVEL4_QUESTIONS = {
  // --- Q1 ------------------------------------------------------------------
  cadet_oath: {
    id: 'cadet_oath',
    type: 'choice',
    title: 'Step 1 • The Scientist’s Cadet Test',
    subject: 'How science works',
    difficulty: 'Grade 3, easy',
    stationId: 'missionSchool',
    prompt:
      'Zara wants to know which paper rocket flies farther: one with fins, or one without. ' +
      'She makes both from the same paper, throws both from the same line, and throws them the same way. ' +
      'Why does she keep everything else the same?',
    choices: [
      { text: 'So the only difference left is the fins', correct: true },
      { text: 'So both rockets look pretty' },
      { text: 'So the test finishes faster' },
      { text: 'So she does not have to count' }
    ],
    hint: 'A fair test changes only ONE thing. Look for the answer that says only the fins are different.',
    parentHint:
      'This is the “fair test” idea. Ask: if she also threw one harder, would we know whether the fins helped, or the throw?',
    success:
      'Correct. A fair test changes only one thing at a time. Everything else stays the same, so you know the fins caused the difference. You are now a Science Cadet.',
    doneMessage:
      'Cadet badge earned! The Mission School doors open, and a hologram rocket switches on far away across the river.',
    reward: { xp: 20, resources: { gems: 1 }, rank: 'Cadet' }
  },

  // --- Q2 ------------------------------------------------------------------
  rocket_scale: {
    id: 'rocket_scale',
    type: 'text',
    title: 'Step 2 • Rocket Scale Blueprint',
    subject: 'Measurement',
    difficulty: 'Grade 3',
    stationId: 'missionSchool',
    prompt:
      'The model rocket on the desk is 30 cm tall. The real rocket will be 50 times taller. ' +
      'How tall is the real rocket, in centimetres?',
    visual: {
      rows: [
        { label: 'Model', tiles: ['30 cm'], arrow: true },
        { label: 'Scale', tiles: ['× 50'], arrow: true },
        { label: 'Real?', tiles: ['? cm'] }
      ]
    },
    answers: ['1500', '1,500', '1500 cm', '1,500 cm', '1500cm', 'fifteen hundred'],
    hint: '50 times means 30 × 50. Try 30 × 5 first, then put a zero on the end.',
    parentHint:
      '30 × 5 = 150, so 30 × 50 = 1500. Worth adding: 1500 cm is 15 metres — about as tall as a four-storey building.',
    success:
      'Correct. 30 × 50 = 1500 cm, which is 15 metres — as tall as a four-storey building. The blueprint is signed.',
    doneMessage:
      'Blueprint complete. The hologram rocket over the pad now shows its real size, and the Materials Forge lights its furnace.',
    reward: { xp: 25, resources: { gems: 1 }, part: 'Blueprint' }
  },

  // --- Q3 ------------------------------------------------------------------
  rocket_materials: {
    id: 'rocket_materials',
    type: 'choice',
    title: 'Step 3 • Choose the Frame',
    subject: 'Materials engineering',
    difficulty: 'Grade 3',
    stationId: 'materialsForge',
    prompt:
      'A rocket frame must be strong but also light. Zara can pick one material for the frame. ' +
      'Which is the best choice?',
    choices: [
      { text: 'Aluminium alloy', correct: true },
      { text: 'Cardboard' },
      { text: 'Wet clay' },
      { text: 'Glass only' }
    ],
    hint: 'Cross out the ones that would break. Then of what’s left, pick the lighter one.',
    parentHint:
      'Two properties at once — strong AND light. Cardboard is light but weak; clay and glass are strong-ish but heavy or brittle. Real rockets use aluminium alloys for exactly this reason.',
    success:
      'Correct. Aluminium alloy is strong enough to hold the rocket together and light enough to fly. Real rockets use it for the same reason.',
    doneMessage:
      'The Forge fires up and builds itself piece by piece. You are now a Junior Engineer — the Build Menu is unlocked and iron ore has appeared around the village.',
    reward: { xp: 25, resources: { iron: 6 }, part: 'Frame', rank: 'Junior Engineer' }
  },

  // --- Q4 ------------------------------------------------------------------
  rocket_flow: {
    id: 'rocket_flow',
    type: 'text',
    title: 'Step 5 • Tank Flow Test',
    subject: 'Division and rate',
    difficulty: 'Grade 3',
    stationId: 'waterLab',
    prompt:
      'The test tank holds 24 litres. Water leaves the valve at 4 litres every minute. ' +
      'How many minutes until the tank is empty?',
    visual: {
      rows: [
        { label: 'Tank', tiles: ['24 L'], arrow: true },
        { label: 'Valve', tiles: ['− 4 L each minute'], arrow: true },
        { label: 'Empty in?', tiles: ['? minutes'] }
      ]
    },
    answers: ['6', 'six', '6 minutes', 'six minutes', '6 min'],
    hint: 'Count down in fours: 24, 20, 16, … How many jumps until you reach 0?',
    parentHint:
      '24 ÷ 4 = 6. If counting down is easier than dividing, let her count on fingers — same answer, and it shows why division works.',
    success:
      'Correct. 24 ÷ 4 = 6 minutes. Engineers use this every time they size a fuel tank: how much you have, divided by how fast it leaves.',
    doneMessage:
      'Flow Tank complete. Pipes now run through the Water Lab, and fuel cells have appeared nearby.',
    reward: { xp: 25, resources: { fuel: 3 }, part: 'Tank' }
  },

  // --- Q5 ------------------------------------------------------------------
  rocket_drag: {
    id: 'rocket_drag',
    type: 'choice',
    title: 'Step 6 • Wind Tunnel',
    subject: 'Drag and stability',
    difficulty: 'Grade 3',
    stationId: 'windTunnel',
    prompt:
      'Zara puts four shapes in the wind tunnel. Which shape pushes through the air most easily — ' +
      'that is, with the least drag?',
    choices: [
      { text: 'A smooth pointed nose', correct: true },
      { text: 'A flat wall' },
      { text: 'A wide open box' },
      { text: 'A rough cube' }
    ],
    hint: 'Think about putting your hand out of a car window — flat palm, or fingers first?',
    parentHint:
      'The hand-out-the-window comparison is the whole lesson. Flat palm catches air; a thin edge slices it. That’s drag.',
    success:
      'Correct. A smooth pointed nose lets the air slide around it instead of slamming into it. That is why every rocket has a nose cone.',
    doneMessage:
      'Wind Tunnel complete. The big fan starts turning — and with a nose and fins on the blueprint, the rocket body can now be built.',
    reward: { xp: 25, resources: { wood: 6 }, part: 'Nose and Fins' }
  },

  // --- Q6 ------------------------------------------------------------------
  rocket_thrust: {
    id: 'rocket_thrust',
    type: 'choice',
    title: 'Step 7 • Engine Thrust',
    subject: 'Forces and motion',
    difficulty: 'Grade 3–4',
    stationId: 'scienceCenter',
    prompt: 'The engine pushes hot gas downward, hard and fast. What happens to the rocket?',
    choices: [
      { text: 'It is pushed upward', correct: true },
      { text: 'It becomes heavier' },
      { text: 'It stops gravity' },
      { text: 'It turns into gas' }
    ],
    hint:
      'Push against a wall on a skateboard. The wall doesn’t move — you do, backwards. Which way does the rocket go if the gas goes down?',
    parentHint:
      'Newton’s third law, no jargon needed. A good demo: let go of an inflated balloon. Air rushes backward, balloon shoots forward.',
    success:
      'Correct. Every push has an equal push back. The engine pushes gas down, so the gas pushes the rocket up. That push is called thrust.',
    doneMessage:
      'The Science Center dome completes and the engine cutaway starts firing on its test stand.',
    reward: { xp: 30, resources: { gems: 2 }, part: 'Engine' }
  },

  // --- Q7 ------------------------------------------------------------------
  rocket_fuel: {
    id: 'rocket_fuel',
    type: 'text',
    title: 'Step 8 • Fuel Mixture',
    subject: 'Ratio',
    difficulty: 'Grade 4',
    stationId: 'fuelDepot',
    prompt:
      'The safe propellant mix is 2 blue cells for every 1 red cell. Zara loads 4 red cells. ' +
      'How many blue cells does she need, and how many cells is that altogether? ' +
      '(Type the total number of cells.)',
    visual: {
      rows: [
        { label: 'Rule', tiles: ['🔴', '=', '🔵', '🔵'], arrow: true },
        { label: 'Loaded', tiles: ['🔴', '🔴', '🔴', '🔴'], arrow: true },
        { label: 'Total cells?', tiles: ['?'] }
      ]
    },
    answers: ['12', 'twelve', '12 cells', 'twelve cells'],
    hint: 'First find the blue cells: 4 reds, and each red needs 2 blues. Then add the 4 reds back on.',
    parentHint:
      'Two steps on purpose. 4 × 2 = 8 blue, then 8 + 4 = 12 total. If she answers 8, she did the ratio right and just missed the second half — say so, and let her finish it.',
    success:
      'Correct. 4 red × 2 = 8 blue, and 8 + 4 = 12 cells altogether. Getting a mixture ratio right is what keeps a real engine from exploding.',
    doneMessage:
      'Fuel Depot complete. The tank farm builds itself and fresh fuel cells appear on the racks.',
    reward: { xp: 30, resources: { fuel: 4 }, part: 'Propellant' }
  },

  // --- Q8 ------------------------------------------------------------------
  rocket_guidance: {
    id: 'rocket_guidance',
    type: 'text',
    title: 'Step 9 • Guidance Turns',
    subject: 'Angles and direction',
    difficulty: 'Grade 4',
    stationId: 'guidanceTower',
    prompt:
      'The rocket’s nose points east. The guidance computer turns it 90° to the left, ' +
      'then 90° to the left again. Which direction is the nose pointing now?',
    visual: {
      rows: [
        { label: 'Compass', tiles: ['N', 'E', 'S', 'W'], arrow: true },
        { label: 'Turn 1', tiles: ['90° left'], arrow: true },
        { label: 'Turn 2', tiles: ['90° left'], arrow: true },
        { label: 'Nose points?', tiles: ['?'] }
      ]
    },
    answers: ['west', 'w', 'pointing west', 'the west'],
    hint:
      'Draw a compass: N at the top, E on the right, S at the bottom, W on the left. One 90° left turn from east lands on north. Now do it again.',
    parentHint:
      'Two quarter-turns = a half-turn = the opposite direction. If she gets north, she stopped after one turn — just ask “and then it turns again?”',
    success:
      'Correct. East → north is one quarter-turn left. North → west is another. Two quarter-turns make a half-turn, so the rocket now faces west, the exact opposite of where it started.',
    doneMessage:
      'Guidance Tower complete. The dish starts sweeping the sky — the engine and propellant systems can now both be built.',
    reward: { xp: 30, resources: { circuits: 6 }, part: 'Guidance Computer' }
  },

  // --- Q9 (optional ★) -----------------------------------------------------
  chief_engineer: {
    id: 'chief_engineer',
    type: 'text',
    title: '★ Chief Engineer Challenge',
    subject: 'Rates and totals',
    difficulty: 'Grade 4, hard',
    stationId: 'observatory',
    optional: true,
    prompt:
      'Two test engines fire at the same time, for the same number of seconds. ' +
      'Engine A burns 8 litres each second. Engine B burns 5 litres each second. ' +
      'Together they burn 91 litres in total. How many seconds did they fire?',
    visual: {
      rows: [
        { label: 'Engine A', tiles: ['8 L/s'] },
        { label: 'Engine B', tiles: ['5 L/s'], arrow: true },
        { label: 'Together', tiles: ['91 L'], arrow: true },
        { label: 'Time?', tiles: ['? s'] }
      ]
    },
    answers: ['7', 'seven', '7 seconds', 'seven seconds', '7 s'],
    hint:
      'Every second, BOTH engines burn. How many litres do the two of them use in one single second? Then see how many of those seconds fit into 91.',
    parentHint:
      'Combine first, divide second: 8 + 5 = 13 litres per second, then 91 ÷ 13 = 7. If 91 ÷ 13 is too big a jump, count up: 13, 26, 39, 52, 65, 78, 91 — that’s 7 jumps.',
    success:
      'Correct. Together the engines burn 8 + 5 = 13 litres every second, and 13 × 7 = 91. So they fired for 7 seconds. That is exactly how flight engineers size a fuel load.',
    doneMessage:
      'Observatory unlocked! The dome opens and the telescope swings out. A crate of rare parts is yours — and you are a Chief Engineer ahead of schedule.',
    reward: {
      xp: 60,
      resources: { gems: 3, circuits: 4, fuel: 4, iron: 6, rocketParts: 1 },
      rank: 'Chief Engineer',
      bonus: true
    }
  },

  // --- Q10 -----------------------------------------------------------------
  rocket_launch: {
    id: 'rocket_launch',
    type: 'text',
    title: 'Step 10 • Countdown Check',
    subject: 'Counting intervals',
    difficulty: 'Grade 4',
    stationId: 'rocketPad',
    prompt:
      'The countdown starts at T-minus 60 seconds and ends at zero. The flight computer calls out a ' +
      'safety check every 10 seconds — at 60, at 50, and so on, all the way down to 0. ' +
      'How many safety checks does it call out altogether?',
    visual: {
      rows: [
        { label: 'Countdown', tiles: ['60', '50', '40', '30', '20', '10', '0'], arrow: true },
        { label: 'Checks?', tiles: ['?'] }
      ]
    },
    answers: ['7', 'seven', '7 checks', 'seven checks'],
    hint:
      'Do not divide and stop. Write the numbers out: 60, 50, 40, 30, 20, 10, 0 — then count how many you wrote. Do not forget zero.',
    parentHint:
      'A classic “fence post” problem — 60 ÷ 10 = 6 gaps, but 7 numbers. Six posts make five planks; here six gaps make seven calls. Writing the list out is the whole trick.',
    success:
      'Correct. There are 6 gaps of 10 seconds, but 7 numbers to call: 60, 50, 40, 30, 20, 10, and 0. Engineers always count the last one. Launch clearance granted.',
    doneMessage:
      'LAUNCH CLEARANCE GRANTED. The countdown board lights up on the tower. Build the final launch systems and the rocket is yours to fly.',
    reward: { xp: 50, resources: { rocketParts: 2, gems: 2 }, part: 'Launch Clearance' }
  },

  // --- Bonus (optional ★) — revisit finished stations for extra practice ----
  bonus_pattern: {
    id: 'bonus_pattern',
    type: 'text',
    title: '★ Bonus: Fuel Gauge Pattern',
    subject: 'Number patterns',
    difficulty: 'Grade 3',
    stationId: 'missionSchool',
    optional: true,
    prompt:
      'Zara checks the fuel pressure gauge once a minute. Each time, the reading doubles: ' +
      '5, 10, 20, 40, ___. What is the next reading?',
    visual: {
      rows: [
        { label: 'Rule', tiles: ['× 2 each time'], arrow: true },
        { label: 'Readings', tiles: ['5', '10', '20', '40', '?'] }
      ]
    },
    answers: ['80', 'eighty'],
    hint: 'Look at what happened between each number so far — 5 to 10, 10 to 20, 20 to 40. Do the same thing to 40.',
    parentHint:
      'Each number is double the one before it: ×2 every time. 40 × 2 = 80. If she instead adds 20 (the last gap), gently point out the gap itself is doubling too.',
    success:
      'Correct. Every reading is double the one before it, so 40 × 2 = 80. Spotting the rule behind a pattern is exactly how scientists predict what comes next.',
    doneMessage: 'A supply crate of spare parts is dropped off at the Mission School steps, just for the good thinking.',
    reward: { xp: 15, resources: { gems: 3 }, bonus: true }
  },

  bonus_place_value: {
    id: 'bonus_place_value',
    type: 'choice',
    title: '★ Bonus: Balloon Altitudes',
    subject: 'Place value',
    difficulty: 'Grade 3',
    stationId: 'missionSchool',
    optional: true,
    prompt:
      'Two weather balloons record their highest altitude. Balloon A reaches 4,850 metres. ' +
      'Balloon B reaches 4,580 metres. Which balloon flew higher?',
    visual: {
      rows: [
        { label: 'Balloon A', tiles: ['4,850 m'], arrow: true },
        { label: 'Balloon B', tiles: ['4,580 m'], arrow: true },
        { label: 'Higher?', tiles: ['?'] }
      ]
    },
    choices: [
      { text: 'Balloon A, at 4,850 m', correct: true },
      { text: 'Balloon B, at 4,580 m' },
      { text: 'Both reached exactly the same altitude' },
      { text: 'It cannot be worked out from these numbers' }
    ],
    hint: 'Line the numbers up and compare from the left. The thousands digit is the same (4) — so look at the next digit along.',
    parentHint:
      'Both start with 4 thousand, so that digit doesn’t decide it. Next come the hundreds: 8 in 4,850 versus 5 in 4,580. Since 8 > 5, Balloon A is higher. Ask her to cover the thousands digit and compare what’s left.',
    success:
      'Correct. Both altitudes start with 4 thousand, so the next digit decides it: 4,850 has an 8 in the hundreds place, 4,580 has a 5 there, and 8 is bigger. Balloon A flew higher.',
    doneMessage: 'A weather logbook fills in with a tidy new entry, and a Mission School aide leaves a few gems on the desk.',
    reward: { xp: 15, resources: { gems: 3 }, bonus: true }
  },

  bonus_mass: {
    id: 'bonus_mass',
    type: 'choice',
    title: '★ Bonus: Heavy or Light?',
    subject: 'Materials and mass',
    difficulty: 'Grade 3',
    stationId: 'materialsForge',
    optional: true,
    prompt:
      'Zara has two blocks that are exactly the same size — one carved from iron, the other from foam. ' +
      'Which one is heavier, and why?',
    choices: [
      { text: 'The iron block — the same amount of space is packed with much more matter', correct: true },
      { text: 'The foam block — foam blocks are always bigger' },
      { text: 'They weigh exactly the same, since they are the same size' },
      { text: 'The iron block — it is a darker colour than foam' }
    ],
    hint: 'Size and weight are not the same thing. Think about how tightly packed each material is, not how big the block looks.',
    parentHint:
      'This is the idea behind density, without needing the word: same volume, but very different mass, because iron packs far more matter into the same space than foam does. A good question to ask: "which one would be harder to lift?"',
    success:
      'Correct. Iron packs much more matter into the same space than foam does, so the iron block is far heavier even though it is exactly the same size. That is exactly why rocket engineers pick materials so carefully — a part can be small and still add a lot of weight.',
    doneMessage: 'A curious visitor at the Forge nods at the explanation and leaves a few iron ingots by the furnace.',
    reward: { xp: 15, resources: { iron: 3 }, bonus: true }
  },

  bonus_volume: {
    id: 'bonus_volume',
    type: 'text',
    title: '★ Bonus: Tank Volume',
    subject: 'Volume',
    difficulty: 'Grade 4',
    stationId: 'waterLab',
    optional: true,
    prompt:
      'The Water Lab’s new test tank is 5 metres long, 2 metres wide, and 3 metres tall. ' +
      'What is its volume, in cubic metres?',
    visual: {
      rows: [
        { label: 'Length', tiles: ['5 m'], arrow: true },
        { label: 'Width', tiles: ['2 m'], arrow: true },
        { label: 'Height', tiles: ['3 m'], arrow: true },
        { label: 'Volume?', tiles: ['? m³'] }
      ]
    },
    answers: ['30', 'thirty', '30 m3', '30m3', '30 cubic metres', '30 cubic meters', 'thirty cubic metres'],
    hint: 'Multiply the length and width first, then multiply that answer by the height.',
    parentHint:
      'Volume of a box = length × width × height. 5 × 2 = 10, then 10 × 3 = 30. This may be her first time multiplying three numbers — the order doesn’t matter, so 2 × 3 × 5 getting to 30 is just as correct.',
    success:
      'Correct. 5 × 2 × 3 = 30 cubic metres. Multiplying all three side lengths together tells you exactly how much water a tank can hold.',
    doneMessage: 'A new gauge on the tank blinks green, and a lab assistant leaves a couple of fuel canisters by the door.',
    reward: { xp: 18, resources: { fuel: 3 }, bonus: true }
  },

  bonus_division: {
    id: 'bonus_division',
    type: 'text',
    title: '★ Bonus: Splitting the Fuel',
    subject: 'Division',
    difficulty: 'Grade 3',
    stationId: 'waterLab',
    optional: true,
    prompt: 'Zara has 36 litres of fuel to share equally between 4 tanks. How many litres go in each tank?',
    visual: {
      rows: [
        { label: 'Fuel', tiles: ['36 L'], arrow: true },
        { label: 'Tanks', tiles: ['÷ 4'], arrow: true },
        { label: 'Each tank?', tiles: ['? L'] }
      ]
    },
    answers: ['9', 'nine', '9 litres', 'nine litres', '9l', '9 l'],
    hint: 'Share the 36 litres into 4 equal groups. Skip-counting by 4s up to 36 works just as well as dividing.',
    parentHint:
      '36 ÷ 4 = 9. If the division fact isn’t automatic yet, counting in 4s (4, 8, 12 … 36) and counting the jumps gets to the same place.',
    success:
      'Correct. 36 ÷ 4 = 9 litres in each tank. Sharing a total equally between containers like this is exactly what division means.',
    doneMessage: 'Four tanks fill evenly side by side, and a technician gives Zara a thumbs up from across the lab.',
    reward: { xp: 15, resources: { fuel: 3 }, bonus: true }
  },

  bonus_shape: {
    id: 'bonus_shape',
    type: 'choice',
    title: '★ Bonus: Slipping Through the Wind',
    subject: 'Drag and shape',
    difficulty: 'Grade 3',
    stationId: 'windTunnel',
    optional: true,
    prompt:
      'Zara holds a flat square card in the wind tunnel two different ways: first flat-on, facing the wind ' +
      'like a wall, then edge-on, slicing through it like a knife. Which way lets the air pass by with less drag?',
    choices: [
      { text: 'Edge-on, like a knife', correct: true },
      { text: 'Flat-on, like a wall' },
      { text: 'Both ways are exactly the same' },
      { text: 'Neither way — flat cards always spin out of control' }
    ],
    hint: 'Think about which way gives the air less of a wide surface to push against.',
    parentHint:
      'Same idea as an open umbrella versus a closed one in the wind — a wide flat face catches a lot of air, while a thin edge lets it slip past. This is the shape-and-orientation half of drag.',
    success:
      'Correct. Edge-on, the air slides along the thin edge instead of slamming into a wide flat face. That is why rocket fins are thin and angled into the airflow, not held flat against it.',
    doneMessage: 'The tunnel’s smoke trails swirl smoothly past the card, and a technician leaves some spare wood as thanks.',
    reward: { xp: 15, resources: { wood: 3 }, bonus: true }
  },

  bonus_forces: {
    id: 'bonus_forces',
    type: 'choice',
    title: '★ Bonus: Balanced or Not?',
    subject: 'Forces and motion',
    difficulty: 'Grade 4',
    stationId: 'scienceCenter',
    optional: true,
    prompt:
      'On the launch pad, the engines are off. Gravity pulls the rocket down, and the pad pushes up on it ' +
      'with an equal force. The rocket does not move. What do we call these two forces?',
    choices: [
      { text: 'Balanced forces', correct: true },
      { text: 'Unbalanced forces' },
      { text: 'No forces at all' },
      { text: 'Magnetic forces' }
    ],
    hint: 'If two forces are equal and pulling in opposite directions, they cancel out. What word describes forces that cancel out?',
    parentHint:
      'Balanced forces = no change in motion; unbalanced forces = the object speeds up, slows down, or changes direction. Ask: "What has to happen for the rocket to actually lift off?" — thrust must grow bigger than gravity, making the forces unbalanced.',
    success:
      'Correct. Gravity pulling down and the pad pushing up are equal and opposite, so they are balanced and the rocket stays still. The instant the engines push hard enough that thrust is bigger than gravity, the forces become unbalanced — and that is what makes the rocket accelerate upward.',
    doneMessage: 'The display board flips from "FORCES: BALANCED" to "READY", and a scientist leaves a few spare circuits on the bench.',
    reward: { xp: 18, resources: { circuits: 3 }, bonus: true }
  },

  bonus_states: {
    id: 'bonus_states',
    type: 'choice',
    title: '★ Bonus: Liquid to Gas',
    subject: 'States of matter',
    difficulty: 'Grade 3',
    stationId: 'scienceCenter',
    optional: true,
    prompt:
      'Rocket fuel is stored as a liquid in the tank. When it burns inside the engine, it turns into hot gas ' +
      'that rushes out the bottom. What change of state is this?',
    choices: [
      { text: 'Liquid to gas', correct: true },
      { text: 'Gas to solid' },
      { text: 'Solid to liquid' },
      { text: 'It stays a liquid the whole time' }
    ],
    hint: 'Think about what happens to the fuel as it burns — does it become more spread out and floaty, or more packed and firm?',
    parentHint:
      'This is the liquid-to-gas change, much like boiling water into steam, but happening by burning instead of heating. Ask: "Is gas more like a liquid you can pour, or like packed ice?"',
    success:
      'Correct. Liquid fuel burns into hot gas, and that gas expands and rushes out of the engine nozzle — that rushing gas is exactly what pushes the rocket upward.',
    doneMessage: 'A wall gauge ticks over from "LIQUID" to "GAS", and a technician passes Zara a couple of gems as thanks.',
    reward: { xp: 15, resources: { gems: 2 }, bonus: true }
  },

  bonus_ratio: {
    id: 'bonus_ratio',
    type: 'text',
    title: '★ Bonus: Mixing the Propellant',
    subject: 'Ratio',
    difficulty: 'Grade 3',
    stationId: 'fuelDepot',
    optional: true,
    prompt:
      'The oxidiser mix rule is 3 parts oxidiser for every 1 part fuel. Zara has 5 parts of fuel. ' +
      'How many parts of oxidiser does she need?',
    visual: {
      rows: [
        { label: 'Rule', tiles: ['1 fuel', '=', '3 oxidiser'], arrow: true },
        { label: 'Loaded', tiles: ['5 fuel'], arrow: true },
        { label: 'Oxidiser?', tiles: ['?'] }
      ]
    },
    answers: ['15', 'fifteen', '15 parts', 'fifteen parts'],
    hint: 'For every 1 part fuel there are 3 parts oxidiser. If there are 5 parts fuel, multiply 5 by 3.',
    parentHint:
      'A times-table dressed up as a ratio: 5 × 3 = 15. If it helps, list it out: 1→3, 2→6, 3→9, 4→12, 5→15.',
    success:
      'Correct. 5 × 3 = 15 parts of oxidiser. Keeping a fuel mixture exactly on ratio like this is exactly how real rocket engineers mix propellant safely.',
    doneMessage: 'A new drum of oxidiser rolls into place on the rack, and a technician nods approvingly.',
    reward: { xp: 15, resources: { fuel: 3 }, bonus: true }
  },

  bonus_angle: {
    id: 'bonus_angle',
    type: 'choice',
    title: '★ Bonus: Steering Fin Turn',
    subject: 'Angles and turns',
    difficulty: 'Grade 3',
    stationId: 'guidanceTower',
    optional: true,
    prompt:
      'A steering fin starts pointing straight up, like 12 o’clock on a clock face. It turns a quarter turn ' +
      'clockwise. Where is it pointing now?',
    visual: {
      rows: [
        { label: 'Start', tiles: ['12 o’clock ↑'], arrow: true },
        { label: 'Turn', tiles: ['¼ turn clockwise'], arrow: true },
        { label: 'Now?', tiles: ['?'] }
      ]
    },
    choices: [
      { text: 'Pointing right, like 3 o’clock', correct: true },
      { text: 'Pointing down, like 6 o’clock' },
      { text: 'Pointing left, like 9 o’clock' },
      { text: 'Still pointing up, like 12 o’clock' }
    ],
    hint: 'A quarter turn is one-fourth of a full circle — the same as going from 12 to 3 on a clock face.',
    parentHint:
      'Same idea as the guidance tower compass question, from a new angle: a full turn is 360°, a quarter turn is 90°. Clockwise from 12 lands on 3.',
    success:
      'Correct. A quarter turn clockwise from 12 o’clock lands on 3 o’clock — a 90° turn to the right. Guidance fins make small turns exactly like this, over and over, to steer the rocket.',
    doneMessage: 'The steering fin swivels neatly into place, and an engineer leaves a couple of spare circuits by the console.',
    reward: { xp: 15, resources: { circuits: 3 }, bonus: true }
  },

  bonus_gravity: {
    id: 'bonus_gravity',
    type: 'choice',
    title: '★ Bonus: Jumping on the Moon',
    subject: 'Gravity',
    difficulty: 'Grade 4',
    stationId: 'observatory',
    optional: true,
    prompt:
      'On the Moon, astronauts can jump much higher than on Earth, even in a heavy spacesuit. Why?',
    choices: [
      { text: 'The Moon’s gravity pulls much less strongly than Earth’s', correct: true },
      { text: 'The Moon has no air at all, so jumping is easier' },
      { text: 'Spacesuits become lighter once they reach the Moon' },
      { text: 'The Moon spins faster than Earth does' }
    ],
    hint: 'Gravity is what pulls you back down after a jump. Is the Moon bigger or smaller than Earth — and what might that mean for its pull?',
    parentHint:
      'The Moon has much less mass than Earth, so its gravity is only about one-sixth as strong. Ask: "If gravity pulls you down less hard, what happens when you jump?"',
    success:
      'Correct. The Moon is much smaller and has far less mass than Earth, so its gravity pulls about six times more weakly. That is why the very same jump sends an astronaut so much higher.',
    doneMessage: 'The observatory telescope swings toward the Moon, and a stargazer hands Zara a couple of gems from a meteorite sample.',
    reward: { xp: 18, resources: { gems: 3 }, bonus: true }
  },

  // The pad's own bonus, and the only question in the game that uses the
  // flight simulation's REAL constants (rocket.js: BASE_DRY_MASS_KG 800,
  // TANK_DRY_MASS_KG 200, FUEL_PER_TANK_KG 1000). Getting this right is
  // getting the lesson the launch then proves: a tank is fuel AND weight.
  bonus_liftoff_mass: {
    id: 'bonus_liftoff_mass',
    type: 'text',
    title: '★ Bonus: Mass on the Pad',
    subject: 'Multi-step multiplication',
    difficulty: 'Grade 4',
    stationId: 'rocketPad',
    optional: true,
    prompt:
      'The rocket body weighs 800 kg on its own. Every fuel tank Zara adds puts another 1,200 kg on the pad: ' +
      '200 kg for the empty tank, and 1,000 kg of fuel inside it. She fits 5 tanks. ' +
      'What is the rocket’s total mass at liftoff, in kilograms?',
    visual: {
      rows: [
        { label: 'Body', tiles: ['800 kg'] },
        { label: 'Each tank', tiles: ['200 kg', '+', '1,000 kg', '=', '1,200 kg'], arrow: true },
        { label: '5 tanks', tiles: ['5', '×', '1,200 kg'], arrow: true },
        { label: 'Total?', tiles: ['? kg'] }
      ]
    },
    answers: ['6800', '6,800', '6800 kg', '6,800 kg', '6800kg', 'six thousand eight hundred'],
    hint: 'Two steps. First work out what 5 tanks weigh altogether, then add the body on top.',
    parentHint:
      '5 x 1,200 = 6,000, then 6,000 + 800 = 6,800 kg. The point behind the sum: every tank she adds is fuel AND weight. ' +
      'Ask: "If one more tank adds 1,200 kg, is it always worth adding one more?" That is exactly what the launch tests.',
    success:
      'Correct. 5 × 1,200 = 6,000 kg of tanks and fuel, plus the 800 kg body, is 6,800 kg sitting on the pad. ' +
      'Notice what that means: a tank is not just fuel, it is weight too. Add too many and the engine has to lift them all — ' +
      'which is why the rocket does not simply fly higher every time you bolt on another one.',
    doneMessage: 'The pad crew reweighs the rocket, agrees with Zara, and leaves two spare rocket parts by the gantry.',
    reward: { xp: 22, resources: { rocketParts: 2 }, bonus: true }
  }
};

/**
 * The bank in play, chosen by DIFFICULTY.
 *
 * Level 4 is the authored bank above. Level 1 is an overlay in
 * questions.level1.js that replaces only each question's CONTENT - prompt,
 * answers, hint, working - and inherits the id, the answer type, the station
 * and the reward. Merging rather than duplicating is the point: the quest
 * chain, the signposts and the economy are all keyed off those inherited
 * fields, and a second full copy would be four more things to keep in step.
 *
 * Read once at module load. Difficulty is chosen before a chapter starts and
 * cannot change mid-game, so re-reading per question would buy nothing.
 */
function selectBank() {
  if (difficultyLevel() !== 1) return LEVEL4_QUESTIONS;
  const out = {};
  for (const [id, base] of Object.entries(LEVEL4_QUESTIONS)) {
    const overlay = LEVEL1_QUESTIONS[id];
    // A question with no overlay falls back to the Level 4 wording rather than
    // vanishing. A missing entry should read as "not rewritten yet", never as
    // a hole in the chain - the chain would stall on it.
    out[id] = overlay ? { ...base, ...overlay } : base;
  }
  return out;
}

/** The authored question bank for whichever difficulty is in play. */
export const QUESTIONS = selectBank();

/** Ladder order of the question ids. The ★ bonus sits last: it gates nothing. */
export const QUESTION_ORDER = [
  'cadet_oath',
  'rocket_scale',
  'rocket_materials',
  'rocket_flow',
  'rocket_drag',
  'rocket_thrust',
  'rocket_fuel',
  'rocket_guidance',
  'rocket_launch',
  'chief_engineer',
  'bonus_pattern',
  'bonus_place_value',
  'bonus_mass',
  'bonus_volume',
  'bonus_division',
  'bonus_shape',
  'bonus_forces',
  'bonus_states',
  'bonus_ratio',
  'bonus_angle',
  'bonus_gravity',
  'bonus_liftoff_mass'
];

/**
 * Look a question up by id. Returns null rather than throwing, so a stale save
 * naming a deleted question can never crash the level.
 * @param {string} id
 * @returns {Question|null}
 */
export function getQuestion(id) {
  return (id && Object.prototype.hasOwnProperty.call(QUESTIONS, id) && QUESTIONS[id]) || null;
}

/**
 * Canonical form for free-text comparison.
 *
 * Deliberately generous: a nine-year-old typing "1,500 cm", "1500cm" or
 * " 1500 CM " has answered the question, and punishing the formatting is the
 * fastest way to make a child give up. Commas and hyphens go (so "1,500" and
 * "twenty-three" match their plain forms), all whitespace goes (L1's rule), and
 * trailing sentence punctuation goes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[,\-_]/g, '')
    .replace(/[.!?;:]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

const PURE_NUMBER = /^\d+(?:\.\d+)?$/;

/**
 * Pure answer check. No state, no side effects, no scoring — a wrong answer is
 * simply `false`, and the caller is required to let the child try again.
 *
 * Accepts, for type:'choice': the 0-based index (number or numeric string), the
 * exact choice text, or the choice object itself. For type:'text': any spelling
 * in `answers`, compared after normalizeText, plus numeric equality so "07" and
 * "7.0" pass where "7" does.
 *
 * @param {Question|string} question  a question object, or its id
 * @param {string|number|object} given
 * @returns {boolean}
 */
export function checkAnswer(question, given) {
  const q = typeof question === 'string' ? getQuestion(question) : question;
  if (!q) return false;

  if (q.type === 'choice') {
    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (given && typeof given === 'object') return choices.includes(given) && given.correct === true;

    // A bare number (or numeric string) is an index into the rendered list.
    const asIndex = typeof given === 'number' ? given : Number(String(given).trim());
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < choices.length) {
      return choices[asIndex].correct === true;
    }

    const norm = normalizeText(given);
    if (!norm) return false;
    return choices.some((c) => c.correct === true && normalizeText(c.text) === norm);
  }

  // type:'text'
  const answers = Array.isArray(q.answers) ? q.answers : [];
  const norm = normalizeText(given);
  if (!norm) return false;
  for (const accepted of answers) {
    const target = normalizeText(accepted);
    if (!target) continue;
    if (norm === target) return true;
    if (PURE_NUMBER.test(norm) && PURE_NUMBER.test(target) && Number(norm) === Number(target)) return true;
  }
  return false;
}

/**
 * The single correct choice, for renderers that want to mark it after an answer.
 * @param {Question|string} question
 * @returns {QuestionChoice|null}
 */
export function correctChoice(question) {
  const q = typeof question === 'string' ? getQuestion(question) : question;
  if (!q || q.type !== 'choice' || !Array.isArray(q.choices)) return null;
  return q.choices.find((c) => c.correct === true) || null;
}

/**
 * Parent Hints panel content (spec §5.6): only questions the child has already
 * reached, so the panel never spoils what is ahead.
 * @param {string[]} reachedQuestionIds
 * @returns {{id: string, title: string, parentHint: string}[]}
 */
export function parentHintsFor(reachedQuestionIds) {
  const reached = new Set(Array.isArray(reachedQuestionIds) ? reachedQuestionIds : []);
  return QUESTION_ORDER.filter((id) => reached.has(id)).map((id) => ({
    id,
    title: QUESTIONS[id].title,
    parentHint: QUESTIONS[id].parentHint
  }));
}

/**
 * The toast for a wrong answer (spec §5.5). Never punishing, and the second and
 * later attempts point a grown-up at the Parent Hints panel.
 * @param {Question|string} question
 * @param {number} attemptCount  1-based count of wrong attempts so far
 * @returns {string}
 */
export function wrongAnswerMessage(question, attemptCount = 1) {
  const q = typeof question === 'string' ? getQuestion(question) : question;
  const hint = q && q.hint ? q.hint : 'Have another go — nothing is lost.';
  const n = Number.isFinite(attemptCount) ? attemptCount : 1;
  return n >= 2
    ? `Not quite. ${hint} — a grown-up can open the Parent Hints panel for a bigger clue.`
    : `Not quite. ${hint}`;
}

export default QUESTIONS;
