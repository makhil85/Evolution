// Chapter 1 "Science Village", 3-D version: the shared contract every
// module builds against (see CHAPTER1_PLAN.md). Numbers are the old
// single-file game's (docs/legacy-chapters/level{1,4}/chapter1.html), so saves,
// the launcher's completion check (state.built) and the puzzles carry over.
//
// Coordinates: the old game was a 32 x 32 tile grid, tile (tx, ty), ty
// growing south. Same mapping as Chapter 2 (src/city/contracts.js): one old
// tile is TILE world units, map centred on the origin, +x east, +z south.

export const MAP_W = 32;
export const MAP_H = 32;
export const TILE = 2.5;

export function tileToWorld(tx, ty) {
  return { x: (tx + 0.5 - MAP_W / 2) * TILE, z: (ty + 0.5 - MAP_H / 2) * TILE };
}

export function worldToTile(x, z) {
  return { tx: Math.floor(x / TILE + MAP_W / 2), ty: Math.floor(z / TILE + MAP_H / 2) };
}

export function inMap(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

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

/** Save keys: THE SAME as the old game's (the launcher reads `built`). */
export const STORE_KEYS = Object.freeze({
  1: 'level1_science_village_grade1_competitive_v1',
  4: 'level1_science_village_v7',
});

export const RESOURCE_KEYS = Object.freeze(['wood', 'stone', 'iron', 'science']);

/** The two build plans. "smart" = all 3 math boards; "brute" = the hard key. */
export const RECIPES = Object.freeze({
  1: Object.freeze({ smart: { wood: 12, stone: 24, iron: 60, science: 12 }, brute: { wood: 45, stone: 55, iron: 150, science: 15 } }),
  4: Object.freeze({ smart: { wood: 14, stone: 30, iron: 84, science: 13 }, brute: { wood: 45, stone: 55, iron: 150, science: 15 } }),
});

/** Quest ids: three math boards, the hard key, two science labs. */
export const QUEST_IDS = Object.freeze(['m1', 'm2', 'm3', 'key', 'force', 'energy']);

/**
 * The Science Center rises piece by piece once built (new: the old game
 * showed it all at once). Foundation, walls, upper floor, dome, telescope.
 */
export const SCIENCE_CENTER_PIECES = 5;
export const PIECE_INTERVAL_MS = 330;

/** Interaction reach, world units (the old game used 1.55 tiles). */
export const INTERACT_RADIUS = 1.55 * TILE;
