// Chapter 2 treasure hunt (Hard mode): the Master Gear is hidden in one of the
// two homes (Engineer House, Town House). Clue data per Level, in WORLD
// coordinates; pure data (no THREE, no DOM). Level 1 = 2nd grade (landmarks,
// counting, near/far), Level 4 = 5th-6th grade (compass, ordering, crossroad
// counting, arithmetic, logic). Every clue is solvable from what always stands
// in the city: the five buildings, the roads, the moat. (Quest consoles and
// the structures they raise come and go, so no clue depends on them.)
import { tileToWorld } from './contracts.js';
import { TOWN_BUILDINGS, isRoad } from './layout.js';

/** Direction (dx, dy) a building's front faces: toward the nearest road (see worldTown.facingRoad). */
function facingDir(tx, ty) {
  for (let r = 1; r <= 3; r++) {
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

const byLabel = (label) => TOWN_BUILDINGS.find((b) => b.label === label);
const doorAt = (label) => { const d = doorTileOf(byLabel(label)); return tileToWorld(d.tx, d.ty); };

/** The two homes: { label, tx, ty, door:{tx,ty}, at:{x,z} } (at = the spot in front of the door). */
export function homes() {
  return TOWN_BUILDINGS.filter((b) => b.type === 'house').map((b) => {
    const door = doorTileOf(b);
    return { label: b.label, tx: b.tx, ty: b.ty, door, at: tileToWorld(door.tx, door.ty) };
  });
}

const ENGINEER = doorAt('Engineer House');
const TOWN = doorAt('Town House');
/** The crossroad where the long road (row 17) meets the north-south road at x = 23, beside the bridge lock. */
const CROSS3 = tileToWorld(23, 17);

const L1 = {
  title: 'The Missing Master Gear',
  itemName: 'Master Gear',
  intro: 'Find the Master Gear in a home. Read each clue. Press E at each place.',
  steps: [
    {
      id: 'cityHall', at: doorAt('City Hall'), radius: 2.2,
      clue: 'Find the clock building. It has 4 white posts. Press E at its door.',
      found: 'Tick tock! You found the clock building.',
    },
    {
      id: 'scienceCenter', at: doorAt('Science Center'), radius: 2.2,
      clue: 'Find the round purple roof with a gold star. Press E at its door.',
      found: 'A purple dome and a gold star. This is the Science Center!',
    },
    {
      id: 'moatEnd', at: CROSS3, radius: 2.2,
      clue: 'Follow the road east until it ends at the water. Press E there.',
      found: 'The road stops at the water. A moat goes around an island!',
    },
    {
      id: 'townHouse', at: TOWN, radius: 2.2,
      clue: 'The Master Gear is in the home far from the purple roof. Press E.',
      found: 'You found the Master Gear! It clicks and spins. Now the Workshop can be built!',
    },
  ],
  decoys: [
    { at: ENGINEER, radius: 2.2, text: 'Not here. Only a broom and a sleepy cat.' },
    { at: doorAt('Supply Depot'), radius: 2.2, text: 'Not here. Just crates and barrels.' },
  ],
};

const L4 = {
  title: 'The Missing Master Gear',
  itemName: 'Master Gear',
  intro: 'The Master Gear is locked in one of the two homes. Each clue leads to the next place. Press E at each place.',
  steps: [
    {
      id: 'cityHall', at: doorAt('City Hall'), radius: 2.2,
      clue: 'Go to the northernmost building on the west edge of town. North is up the map. Press E at its door.',
      found: 'City Hall! Count its tall white pillars.',
    },
    {
      id: 'supplyDepot', at: doorAt('Supply Depot'), radius: 2.2,
      clue: 'Count the pillars on City Hall. Number the west-edge buildings from north. City Hall is 1. Go to the building numbered that and press E.',
      found: 'The Supply Depot, number 4 in the column. Now a road puzzle.',
    },
    {
      id: 'crossroad3', at: CROSS3, radius: 2.2,
      clue: 'Count the roads crossing the long east road from the Science Center. Go to crossroad half the west-column buildings, plus 1. Press E there.',
      found: 'The third crossroad, right beside the bridge lock. The water lies just ahead.',
    },
    {
      id: 'townHouse', at: TOWN, radius: 2.2,
      clue: 'The Sun rises in the east. The Master Gear is in the home whose door faces the rising Sun. Press E there.',
      found: 'You found the Master Gear! It clicks and spins. The Workshop can be built now.',
    },
  ],
  decoys: [
    { at: ENGINEER, radius: 2.2, text: 'Not here. This home is empty and quiet.' },
    { at: doorAt('Science Center'), radius: 2.2, text: 'Not here. Only telescopes and dust.' },
  ],
};

/** The clue set for a Level (1 = 2nd grade wording, anything else = Level 4). */
export function huntFor(level) {
  return level === 1 ? L1 : L4;
}
