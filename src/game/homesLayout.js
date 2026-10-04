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

export const HOME_DEPTH = 3.4;
export const HOME_WALL_H = 2.2;

/** @type {ReadonlyArray<Readonly<{id:string, number:number, x:number, z:number, windows:number, chimney:boolean,
 *   wall:number, roof:number, door:number, wallName:string, roofName:string, doorName:string, side:'west'|'east'}>>} */
export const HOMES = Object.freeze([
  { id: 'home6', number: 6, x: -11, z: 40.5, windows: 2, chimney: true, side: 'west',
    wall: 0xf2e3c4, roof: 0xc8503f, door: 0x3f6fb5, wallName: 'cream', roofName: 'red', doorName: 'blue' },
  { id: 'home9', number: 9, x: -7.5, z: 46.5, windows: 3, chimney: false, side: 'west',
    wall: 0xa9d3ea, roof: 0x7a5230, door: 0xc94a3f, wallName: 'light blue', roofName: 'brown', doorName: 'red' },
  { id: 'home14', number: 14, x: 10.5, z: 41.5, windows: 4, chimney: true, side: 'east',
    wall: 0xf0b59a, roof: 0x4f9a5a, door: 0xe7bf3a, wallName: 'pink', roofName: 'green', doorName: 'yellow' },
  { id: 'home17', number: 17, x: 18, z: 41.5, windows: 2, chimney: false, side: 'east',
    wall: 0xf5e58f, roof: 0x3f6fb5, door: 0x4f9a5a, wallName: 'yellow', roofName: 'blue', doorName: 'green' },
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
