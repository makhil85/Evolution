// The village homes: four small cottages in the two meadows beside the road
// where she spawns. Chapter 3 had no residential houses at all (only labs, a
// windmill and a watermill), and Hard mode's treasure hunt hides its
// Guidance Crystal in a HOME, so these are the homes.
//
// Pure data, no three.js, so the hunt clues (hunt.js) and the node test can
// import it. homes.js turns it into meshes and colliders.
//
// Each home is told apart by things a child can see and count: the number on
// its sign, how many windows the front has, the colour of its roof, walls and
// door. The numbers 6, 9, 14, 17 are chosen for the clues: exactly one is
// prime (17), two are multiples of 3 (6, 9), and every one is below 20 for
// the Level 1 add-and-take-away clues.
//
// Positions come from village.js MEADOWS (nothing grows there) and were
// checked against every tree, rock and prop solid; homes.js re-checks at
// start-up and warns if a later change to the scatter puts something in the
// way. All four face south (+z), toward the road she walks up.
//
// Lead 2026-10-09 (Chapter 3 is the space-age town): the homes are modern now.
// roofShape says flat (a slab, with solar panels on it) or shed (a gently
// sloping roof, the high side at the back). Colours are new; the names below
// still say what each colour is, and the test checks the windows + roof pairs
// stay distinct. Sizes and positions did not change.

export const HOME_DEPTH = 3.4;
export const HOME_WALL_H = 2.2;

/** @type {ReadonlyArray<Readonly<{id:string, number:number, x:number, z:number, windows:number, roofShape:'flat'|'shed', chimney:boolean,
 *   wall:number, roof:number, door:number, wallName:string, roofName:string, doorName:string, side:'west'|'east'}>>} */
export const HOMES = Object.freeze([
  { id: 'home6', number: 6, x: -11, z: 40.5, windows: 2, roofShape: 'flat', chimney: true, side: 'west',
    wall: 0xf7fafc, roof: 0x3f7fc4, door: 0x2bb3a6, wallName: 'white', roofName: 'blue', doorName: 'teal' },
  { id: 'home9', number: 9, x: -7.5, z: 46.5, windows: 3, roofShape: 'shed', chimney: false, side: 'west',
    wall: 0xbfe6ff, roof: 0xf08a3c, door: 0xe2553f, wallName: 'sky blue', roofName: 'orange', doorName: 'red' },
  { id: 'home14', number: 14, x: 10.5, z: 41.5, windows: 4, roofShape: 'flat', chimney: true, side: 'east',
    wall: 0xffc2d6, roof: 0x7b5cd6, door: 0xffc83d, wallName: 'pink', roofName: 'purple', doorName: 'yellow' },
  { id: 'home17', number: 17, x: 18, z: 41.5, windows: 2, roofShape: 'shed', chimney: false, side: 'east',
    wall: 0xfff1a8, roof: 0x2fa39a, door: 0x3f7fc4, wallName: 'light yellow', roofName: 'teal', doorName: 'blue' },
].map((h) => Object.freeze(h)));

/** Front width: room for the windows and the door. */
export function homeWidth(h) { return 0.9 * h.windows + 2.1; }

/** Half extents of the walls, for the collider and the clearance checks. */
export function homeHalf(h) { return { halfX: homeWidth(h) / 2, halfZ: HOME_DEPTH / 2 }; }

/** The spot in front of the door, where the child stands to look inside. */
export function homeDoor(h) {
  return { x: h.x + homeWidth(h) / 2 - 0.85, z: h.z + HOME_DEPTH / 2 + 1.3 };
}

export function homeById(id) { return HOMES.find((h) => h.id === id) || null; }
