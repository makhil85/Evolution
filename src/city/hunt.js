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
  intro: 'The Master Gear is hidden in one of the homes! It will turn the wheels of the Engineering Workshop. Read each clue, walk to the place, and press E there.',
  steps: [
    {
      id: 'cityHall', at: doorAt('City Hall'), radius: 2.2,
      clue: 'Find the building with a clock on its little tower. It has 4 tall white posts at the front. Stand by its door and press E.',
      found: 'Tick tock! You found the clock building.',
    },
    {
      id: 'scienceCenter', at: doorAt('Science Center'), radius: 2.2,
      clue: 'Walk down the road, to the bottom of the map. Find the building with a round purple roof. It has a gold star over its door. Stand at its door and press E.',
      found: 'A purple dome and a gold star. This is the Science Center!',
    },
    {
      id: 'moatEnd', at: CROSS3, radius: 2.2,
      clue: 'Follow the long road that goes to the right, toward the east. Walk until the road ends at the water. Stand there and press E.',
      found: 'The road stops at the water. A moat goes around an island!',
    },
    {
      id: 'townHouse', at: TOWN, radius: 2.2,
      clue: 'There are two homes in the city. One is close to the round purple roof. The Master Gear is in the OTHER home, the one that is far away. Stand at its front door and press E.',
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
  intro: 'The Master Gear, which drives the Engineering Workshop, is locked away in one of the two homes. Each clue leads to the next place. Stand at the place and press E to check it.',
  steps: [
    {
      id: 'cityHall', at: doorAt('City Hall'), radius: 2.2,
      clue: 'Along the west edge of town stands a row of old buildings. The trail begins at the northernmost one of that row. North is up the map, the way you face when you start. Stand at its front door and press E.',
      found: 'City Hall! Count its tall white pillars.',
    },
    {
      id: 'supplyDepot', at: doorAt('Supply Depot'), radius: 2.2,
      clue: 'Count the white pillars on the front of City Hall. The buildings in the column on the west edge of town are numbered 1, 2, 3, ... from north to south, and City Hall is number 1. Go to the building whose number is the same as the number of pillars. Stand at its door and press E.',
      found: 'The Supply Depot, number 4 in the column. Now a road puzzle.',
    },
    {
      id: 'crossroad3', at: CROSS3, radius: 2.2,
      clue: 'Find the long road that runs east from the Science Center door. Count only the roads that cross it, starting at the Science Center. Go to the crossroad whose number is half of the number of buildings in the west column, plus 1. Stand in the middle of that crossroad and press E.',
      found: 'The third crossroad, right beside the bridge lock. The water lies just ahead.',
    },
    {
      id: 'townHouse', at: TOWN, radius: 2.2,
      clue: 'Only two homes stand in town. The Sun sets in the west, so it rises in the east. The Master Gear is in the home whose front door faces the rising Sun. Stand at that door and press E.',
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
