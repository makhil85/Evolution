// Chapter 3's treasure hunt (Hard mode): find the Guidance Crystal.
//
// The engine that tracks clues and saves progress is src/play/hunt.js; this
// file is Chapter 3's DATA - the clues per Level - and the launch rule.
// Everything here is world coordinates and must be solvable from what is
// really standing in the town (see the FACTS block). North is -z, up the
// map: she starts in the far south (z 55) and walks NORTH up the road to the
// river (z about 3); east is +x, on her right when she faces north.
//
// FACTS the clues lean on (rocketVillageLayout.js, decoration.js, homes):
//   * Name signs float over every building site from the start, even the ones
//     not built yet: Mission School (-24, 31), Materials Forge (24, 31),
//     River Flow Lab (-25, 12), Wind Tunnel (25, 12). Only "River Flow Lab"
//     has three words.
//   * The fountain is at the centre of the market square (0, 25). Eight stalls
//     stand in a ring round it: 3 with a green roof, 2 with a red roof, 3
//     with no roof cloth.
//   * The Mission School is due WEST of the Materials Forge (same z), and the
//     River Flow Lab is due WEST of the Wind Tunnel (same z), 50 units apart.
//     The River Flow Lab is due NORTH of the Mission School (19 units).
//   * The watermill stands on the near bank of the river at (16, 11), east of
//     the bridge road, its wheel in the water.
//   * Four homes (homesLayout.js) with numbers 6, 9, 14, 17 on their signs,
//     in the meadows either side of the road near where she starts.
//   All four clue places are on the near (south) bank, so the hunt can be
//   played before the bridge is built.
import { HOMES, homeById, homeDoor } from './homesLayout.js';

export const ITEM_NAME = 'Guidance Crystal';

const HOME_R = 3.2;

/** Where she stands to look inside a home. */
function doorAt(id) {
  const h = homeById(id);
  return { ...homeDoor(h) };
}

/** Short "wrong home" lines. They say nothing about which home is right. */
const DECOY_TEXT = {
  1: 'Knock, knock! Nobody in this home has the crystal. Read your clue again.',
  4: 'You look through the window. There is no crystal in this home. Read your clue again.',
};

function decoysFor(level, finalId) {
  return HOMES.filter((h) => h.id !== finalId).map((h) => ({
    at: doorAt(h.id), radius: HOME_R, text: DECOY_TEXT[level] || DECOY_TEXT[4],
  }));
}

/**
 * Level 1 (2nd grade): the market fountain, then a count of green stalls
 * against the words on a sign, then "right" along the river to the mill, then
 * a number on a home's sign that is "2 more than 7". Short words, one-step
 * counting and adding.
 */
const LEVEL_1 = {
  title: 'The Hidden Guidance Crystal',
  itemName: ITEM_NAME,
  intro: 'The rocket needs a Guidance Crystal to steer. It is hidden inside one of the homes in this town. Read each clue and find the place. When you get there, stand close and press E.',
  steps: [
    {
      id: 'fountain',
      at: { x: 0, z: 25 }, radius: 5.4,
      clue: 'Clue 1: Walk up the road from where you began. In the middle of the market, water splashes in a round pool. Go and stand next to it.',
      found: 'Splash! You found the market fountain.',
    },
    {
      id: 'lab',
      at: { x: -25, z: 17.5 }, radius: 4.6,
      clue: 'Clue 2: Look at the stalls by the fountain. Count the stalls with a GREEN roof. Now look at the signs on the buildings. Find a sign with that many WORDS on it. Stand in front of that building.',
      found: 'Three green stalls, and three words on the sign: River Flow Lab. Well done!',
    },
    {
      id: 'mill',
      at: { x: 16, z: 14.6 }, radius: 4.6,
      clue: 'Clue 3: Turn so the river is in front of you. Now walk far to your RIGHT along the river. Find a mill with a big wheel in the water.',
      found: 'The water wheel is turning. You found the mill!',
    },
    {
      id: 'home',
      at: doorAt('home9'), radius: HOME_R,
      clue: 'Clue 4: Walk back down the road to where you started. Homes stand on both sides. Each one has a number on its sign. Find the home with the number 2 more than 7. The crystal is inside.',
      found: 'The crystal is here! It glows blue.',
    },
  ],
  decoys: decoysFor(1, 'home9'),
};

/**
 * Level 4 (5th-6th grade): the midpoint of a line between two signs, a
 * quarter of the way along an east-west line, a compass turn (a quarter turn
 * clockwise from north is east), and the one prime number among the home
 * numbers.
 */
const LEVEL_4 = {
  title: 'The Hidden Guidance Crystal',
  itemName: ITEM_NAME,
  intro: 'The rocket\'s guidance computer needs a Guidance Crystal, and it is hidden inside one of the homes in this town. These clues never name a place, so you have to work each one out. North is the way you face when you walk up the main road toward the river. Stand close to each place and press E.',
  steps: [
    {
      id: 'midpoint',
      at: { x: -24.5, z: 21.5 }, radius: 3.8,
      clue: 'Clue 1: The River Flow Lab is due north of the Mission School. Find the spot exactly halfway between their signs and stand on it.',
      found: 'Halfway between the two signs. That is the spot!',
    },
    {
      id: 'quarter',
      at: { x: -12.5, z: 12 }, radius: 4,
      clue: 'Clue 2: The River Flow Lab and the Wind Tunnel stand on the same east-west line. Start at the River Flow Lab and walk toward the Wind Tunnel. Stop when you have covered one quarter of the way.',
      found: 'A quarter of the way along the line. Correct.',
    },
    {
      id: 'mill',
      at: { x: 16, z: 14.6 }, radius: 4.6,
      clue: 'Clue 3: Face north. Turn a quarter turn clockwise, then walk in that direction along the river until you reach a building that water turns.',
      found: 'A quarter turn clockwise from north is east, and the water wheel is here.',
    },
    {
      id: 'home',
      at: doorAt('home17'), radius: HOME_R,
      clue: 'Clue 4: The homes stand in the meadows beside the road where you began, each with a number on its sign. Exactly ONE of those numbers is prime (careful: not every odd number is prime). The crystal is inside that home.',
      found: 'Seventeen has no factors except 1 and itself. The crystal is here!',
    },
  ],
  decoys: decoysFor(4, 'home17'),
};

/** The hunt data for a Level (1 = 2nd grade, anything else = Level 4). */
export function huntFor(level) {
  return level === 1 ? LEVEL_1 : LEVEL_4;
}

/**
 * The Hard-mode launch rule, as a pure function so it can be tested.
 * @param {{ mode?: {treasureHunt?: boolean}, found: boolean }} s
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function launchGate({ mode, found }) {
  if (mode && mode.treasureHunt && !found) {
    return {
      ok: false,
      message: `The rocket cannot launch yet. Its guidance computer needs the ${ITEM_NAME}, hidden in one of the homes. Press Clue to read the next hint.`,
    };
  }
  return { ok: true };
}
