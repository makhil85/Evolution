// Chapter 2 "Forces and Machines" (was "City Engineering"), 3-D version: the shared contract every city
// module builds against (see CHAPTER2_PLAN.md). Numbers here are the old
// single-file game's (docs/legacy-chapters/level{1,4}/chapter2.html), so saves,
// the launcher's completion check and the puzzles all carry over unchanged.
//
// Coordinates: the old game was a 34 x 30 tile grid, tile (tx, ty), ty
// growing "down" the screen (south). In 3-D one old tile is TILE world units,
// the map is centred on the origin, +x is east and +z is south:
//
//   world.x = (tx + 0.5 - MAP_W / 2) * TILE
//   world.z = (ty + 0.5 - MAP_H / 2) * TILE
//
// The girl (Chapter 3's avatar) is ~1.5 units tall, so a tile of 2.5 units
// fits a small building on one tile and keeps the old spacing between them.

export const MAP_W = 34;
export const MAP_H = 30;
export const TILE = 2.5;

/** Centre of old tile (tx, ty) in world units. */
export function tileToWorld(tx, ty) {
  return { x: (tx + 0.5 - MAP_W / 2) * TILE, z: (ty + 0.5 - MAP_H / 2) * TILE };
}

/** The old tile a world point sits in (may be off the map: check inMap). */
export function worldToTile(x, z) {
  return { tx: Math.floor(x / TILE + MAP_W / 2), ty: Math.floor(z / TILE + MAP_H / 2) };
}

export function inMap(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

/** World-space rectangle of the whole map. */
export const BOUNDS = {
  minX: (-MAP_W / 2) * TILE, maxX: (MAP_W / 2) * TILE,
  minZ: (-MAP_H / 2) * TILE, maxZ: (MAP_H / 2) * TILE,
};

/** Question Level from the launcher profile: 1 (1st grade) or 4 (default). */
export const LEVEL = (() => {
  try {
    const raw = localStorage.getItem('rocket_village_profile');
    return raw && JSON.parse(raw)?.difficulty === 1 ? 1 : 4;
  } catch {
    return 4;
  }
})();

/** Save keys: THE SAME as the old game's, so progress and the launcher's
 * "Chapter 2 done" check (state.builtFinal) carry over. */
export const STORE_KEYS = Object.freeze({
  1: 'level2_city_engineering_v5_three_side_moat_route',
  4: 'level2_city_engineering_grade3_olympiad_v2_science',
});

export const RESOURCE_KEYS = Object.freeze(['wood', 'stone', 'metal', 'energy', 'blueprints', 'science']);

/** Final build cost (same at both Levels). */
export const RECIPE = Object.freeze({ wood: 24, stone: 28, metal: 20, energy: 10, blueprints: 5, science: 10 });

/** Quest id -> the structure it builds. Level 1 has no solar / magnet. */
export const QUEST_TO_BUILD = Object.freeze({
  bridge: 'bridge', water: 'pump', gear: 'machine', power: 'power', tile: 'academy',
  solar: 'solar', magnet: 'magnet', key: 'vault',
});

/** Pieces per structure; each piece appears PIECE_INTERVAL_MS after the last. */
export const MAX_PIECES = Object.freeze({
  bridge: 5, pump: 3, machine: 4, power: 3, academy: 3, solar: 3, magnet: 3, vault: 3, workshop: 4,
});
export const PIECE_INTERVAL_MS = 330;

/** The quest ids at each Level. */
export const QUEST_IDS = Object.freeze({
  1: ['bridge', 'water', 'gear', 'power', 'tile', 'key'],
  4: ['bridge', 'water', 'gear', 'power', 'tile', 'solar', 'magnet', 'key'],
});

/** "Medium" quests: any 3 of these (or the hard `key` quest) open the bridge lock. */
export const MEDIUM_QUESTS = Object.freeze({
  1: ['water', 'gear', 'power', 'tile'],
  4: ['water', 'gear', 'power', 'tile', 'solar', 'magnet'],
});

/** Interaction reach, world units (the old game used 1.55 tiles). */
export const INTERACT_RADIUS = 1.55 * TILE;
