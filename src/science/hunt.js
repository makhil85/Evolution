// Chapter 1 treasure hunt (Hard mode): the Golden Core is hidden in one of the
// three homes. Clue data per Level, in WORLD coordinates. Pure data (no THREE,
// no DOM) so node tests can import it. See PLAYMODES_PLAN.md for the rules:
// Level 1 = 2nd grade (counting, near/far, colours), Level 4 = 5th-6th grade
// (compass, arithmetic, ordering, logic). Every clue is solvable from what
// stands in the village (layout.js): the well, the purple boards (signs
// "Puzzle 1-3", symbols + - x), the two teal labs, the blacksmith's tall grey
// chimney with fire, the walled yard with its golden lock, and the homes.
import { tileToWorld } from './contracts.js';
import { BUILDINGS, isRoad } from './layout.js';

/** Direction (dx, dy) a building's front faces: toward the nearest road (see worldTown.facingRoad). */
function facingDir(tx, ty) {
  for (let r = 1; r <= 5; r++) {
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (isRoad(tx + dx * r, ty + dy * r)) return [dx, dy];
    }
  }
  return [0, 1];
}

/** The tile in front of a building's door. */
export function doorTileOf(b) {
  const [dx, dy] = facingDir(b.tx, b.ty);
  return { tx: b.tx + dx, ty: b.ty + dy };
}

/** The three homes: { label, tx, ty, door:{tx,ty}, at:{x,z} } (at = the spot in front of the door). */
export function homes() {
  return BUILDINGS.filter((b) => b.type === 'house').map((b) => {
    const door = doorTileOf(b);
    return { label: b.label, tx: b.tx, ty: b.ty, door, at: tileToWorld(door.tx, door.ty) };
  });
}

const home = (tx, ty) => homes().find((h) => h.tx === tx && h.ty === ty);
const at = (tx, ty) => tileToWorld(tx, ty);
const doorOf = (_type, tx, ty) => { const b = BUILDINGS.find((q) => q.tx === tx && q.ty === ty); return at(doorTileOf(b).tx, doorTileOf(b).ty); };

const TOWN = home(15, 17);       // the target home (next to the blacksmith)
const WEST = home(4, 16);
const EAST = home(24, 24);

const L1 = {
  title: 'The Hidden Golden Core',
  itemName: 'Golden Core',
  intro: 'A shiny Golden Core is hiding in one of the houses! It will power the Science Center. Read each clue, walk to the place, and press E there. Wrong house? Just try another one.',
  steps: [
    {
      id: 'well', at: at(9, 20), radius: 2.6,
      clue: 'Find the place where people get water. It has a little red roof and a bucket. Stand next to it and press E.',
      found: 'Splash! You found the well.',
    },
    {
      id: 'board3', at: at(12, 20), radius: 1.7,
      clue: 'Count the teal science labs in the village. Add 1. Now find the purple Puzzle Board with that number. Stand in front of it and press E.',
      found: 'Puzzle 3! Two labs and one more makes three. Nice adding!',
    },
    {
      id: 'blacksmith', at: doorOf('blacksmith', 12, 17), radius: 1.7,
      clue: 'Look at the buildings close by. Find the one with a tall grey chimney and glowing orange fire. Stand at its front door and press E.',
      found: 'Clang, clang! The blacksmith makes things from hot iron.',
    },
    {
      id: 'townHouse', at: TOWN.at, radius: 2.0,
      clue: 'The Golden Core is in a house. There are 3 houses in the village. Find the house that is CLOSEST to the blacksmith. Stand at its front door and press E.',
      found: 'You found the Golden Core! It is glowing in your hands. Now the Science Center can be built!',
    },
  ],
  decoys: [
    { at: WEST.at, radius: 2.0, text: 'Not here. Just a sleeping cat and a dusty rug.' },
    { at: EAST.at, radius: 2.0, text: 'Not here. Only some old boots by the door.' },
  ],
};

const L4 = {
  title: 'The Hidden Golden Core',
  itemName: 'Golden Core',
  intro: 'The Golden Core, the power source of the Science Center, is locked away in one of the village homes. Each clue leads to the next place. Stand at the place and press E to check it. Searching a wrong home costs nothing.',
  steps: [
    {
      id: 'timesBoard', at: at(9, 20), radius: 1.8,
      clue: 'Go to the Puzzle Board that shows the operation you use to find 6 groups of 7. Stand in front of it and press E.',
      found: 'Multiplication! Board 2 stands in the middle of the three boards.',
    },
    {
      id: 'eastLab', at: at(19, 23), radius: 1.9,
      clue: 'There are two teal labs, both south of the main road. The Sun sets in the west, so go to the lab that is FARTHEST from where the Sun sets. Stand at its door and press E.',
      found: 'The Chemical Energy Lab, the eastern one. The trail turns north.',
    },
    {
      id: 'goldenLock', at: at(24, 14), radius: 1.9,
      clue: 'Walk north, across the main road, to the walled yard in the north-east of the village. Find the golden lock on its door, in the wall that faces south. Stand just outside the door and press E.',
      found: 'The golden lock! Now it is time to think about the homes.',
    },
    {
      id: 'townHouse', at: TOWN.at, radius: 2.0,
      clue: 'The Golden Core is in a HOME. Look at the buildings NORTH of the long east-west road and number them 1, 2, 3, ... starting from the WEST. Count all the purple boards and all the teal labs together, then subtract 2. That is your building\'s number. Stand at its front door and press E.',
      found: 'You found the Golden Core! It glows in your hands. The Science Center can be built now.',
    },
  ],
  decoys: [
    { at: WEST.at, radius: 2.0, text: 'Not here. This home is empty and quiet.' },
    { at: EAST.at, radius: 2.0, text: 'Not here. Nothing but dust. Read the clue again.' },
  ],
};

/** The clue set for a Level (1 = 2nd grade wording, anything else = Level 4). */
export function huntFor(level) {
  return level === 1 ? L1 : L4;
}
