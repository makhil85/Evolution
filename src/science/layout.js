// Chapter 1 map layout, ported 1:1 from the old game's buildWorld(),
// buildNPCs(), canMove() and draw*() placements. Pure data + pure functions:
// no THREE, no DOM, so node tests can import it. Positions are OLD TILE
// coordinates (tx, ty); convert with contracts.tileToWorld().

import { MAP_W, MAP_H } from './contracts.js';

export const START_TILE = { tx: 7, ty: 20 };

/** Road tiles, as "tx,ty" strings. */
export const ROADS = (() => {
  const r = new Set();
  for (let x = 2; x < 29; x++) r.add(`${x},20`);
  for (let y = 7; y < 28; y++) r.add(`8,${y}`);
  for (let y = 12; y < 27; y++) r.add(`18,${y}`);
  for (let x = 15; x < 24; x++) r.add(`${x},12`);
  return r;
})();

export function isRoad(tx, ty) { return ROADS.has(`${tx},${ty}`); }

/** Village buildings (solid). Labels are the same at both Levels. */
export const BUILDINGS = [
  { type: 'house', tx: 4, ty: 16, label: 'Family House', symbol: '⌂', colors: { wall: '#d08c60', roof: '#b22222' } },
  { type: 'blacksmith', tx: 12, ty: 17, label: 'Blacksmith', symbol: 'B', colors: { wall: '#8d99ae', roof: '#343a40' } },
  { type: 'market', tx: 4, ty: 24, label: 'Village Market', symbol: '$', colors: { wall: '#d8f3dc', roof: '#f77f00' } },
  { type: 'school', tx: 11, ty: 25, label: 'School', symbol: 'A+', colors: { wall: '#fff3bf', roof: '#5c7cfa' } },
  { type: 'hospital', tx: 21, ty: 18, label: 'Hospital', symbol: '+', colors: { wall: '#e6fcf5', roof: '#ff8787' } },
  { type: 'government', tx: 26, ty: 22, label: 'Govt Building', symbol: 'G', colors: { wall: '#dee2e6', roof: '#2b2d42' } },
  { type: 'house', tx: 24, ty: 24, label: 'Family House', symbol: '⌂', colors: { wall: '#d08c60', roof: '#b22222' } },
  { type: 'house', tx: 15, ty: 17, label: 'Town House', symbol: '⌂', colors: { wall: '#d08c60', roof: '#b22222' } },
];

/** Decoration only (the old game drew it but it never blocked). */
export const WELL = { tx: 9, ty: 21, label: 'Village well' };

/** The Science Center foundation (4 x 4) and where she presses E on it. */
export function isFoundation(tx, ty) { return tx >= 15 && tx <= 18 && ty >= 25 && ty <= 28; }
export const FOUNDATION = { tx0: 15, ty0: 25, tx1: 18, ty1: 28, cx: 17, cy: 27 };
export const BUILD_TILE = { tx: 17, ty: 26 };

/**
 * Quest stations. The math boards (purple) and the science labs (teal).
 * `labels[level]` is the old per-Level board text.
 */
export const STATIONS = [
  { quest: 'm1', kind: 'mathBoard', tx: 6, ty: 19, symbol: '＋', labels: { 4: 'Puzzle Board 1: wood carts', 1: 'Puzzle Board 1: pattern garden' } },
  { quest: 'm2', kind: 'mathBoard', tx: 9, ty: 19, symbol: '×', labels: { 4: 'Puzzle Board 2: stone rows', 1: 'Puzzle Board 2: frog jumps' } },
  { quest: 'm3', kind: 'mathBoard', tx: 12, ty: 19, symbol: '÷', labels: { 4: 'Puzzle Board 3: prime/filter science', 1: 'Puzzle Board 3: science boxes' } },
  { quest: 'force', kind: 'lab', tx: 16, ty: 23, symbol: '→', labels: { 4: 'Force Lab', 1: 'Force Lab' } },
  { quest: 'energy', kind: 'lab', tx: 20, ty: 23, symbol: '🔥', labels: { 4: 'Chemical Energy Lab', 1: 'Light & Plants Lab' } },
];

/**
 * The locked iron room: an 8 x 8 walled yard in the north-east (walls on
 * x = 21..28 at y = 6 and 13, y = 7..12 at x = 21 and 28). The door is the
 * golden key gate at (24, 13): solid until the key puzzle is solved, then open.
 */
export const IRON_ROOM = { tx0: 21, ty0: 6, tx1: 28, ty1: 13 };
export const KEY_GATE = { tx: 24, ty: 13, label: 'Hard Key Puzzle' };

export function isRoomWall(tx, ty) {
  const { tx0, ty0, tx1, ty1 } = IRON_ROOM;
  const onEdge = ((ty === ty0 || ty === ty1) && tx >= tx0 && tx <= tx1)
    || ((tx === tx0 || tx === tx1) && ty > ty0 && ty < ty1);
  return onEdge && !(tx === KEY_GATE.tx && ty === KEY_GATE.ty);
}

export function isInsideRoom(tx, ty) {
  return tx > IRON_ROOM.tx0 && tx < IRON_ROOM.tx1 && ty > IRON_ROOM.ty0 && ty < IRON_ROOM.ty1;
}

/**
 * Collectibles: [tx, ty] + amount. Trees are chopped (they disappear) for
 * wood. `locked` iron sits inside the iron room. Ids are stable (saved).
 */
export const PICKUPS = (() => {
  const out = [];
  let id = 1;
  const add = (type, res, list, amountOf, extra = {}) => list.forEach(([tx, ty], i) => out.push({ id: id++, type, res, tx, ty, amount: amountOf(i), ...extra }));
  add('tree', 'wood', [
    [2, 14], [3, 12], [5, 12], [7, 13], [10, 14], [14, 13], [17, 15], [20, 15], [24, 16], [27, 18],
    [2, 23], [3, 27], [6, 28], [10, 27], [14, 29], [22, 27], [26, 26], [29, 24], [29, 19], [25, 15],
    [11, 10], [6, 9], [15, 8], [18, 9], [30, 12], [1, 18], [1, 21],
  ], (i) => (i % 3 === 0 ? 4 : 3));
  add('stone', 'stone', [
    [2, 8], [4, 7], [7, 7], [11, 7], [13, 5], [17, 6], [19, 5], [30, 6],
    [3, 30], [7, 30], [11, 30], [20, 30], [24, 29], [29, 29], [30, 25],
    [5, 22], [14, 22], [23, 21], [26, 19], [15, 12], [18, 13], [28, 15], [1, 25],
  ], (i) => (i % 4 === 0 ? 5 : 4));
  add('iron', 'iron', [
    [5, 5], [8, 5], [12, 4], [16, 4], [19, 4], [30, 8], [30, 10], [27, 14],
    [23, 14], [19, 16], [15, 16], [6, 15], [2, 16], [30, 17], [30, 21],
  ], (i) => (i % 5 === 0 ? 8 : 6));
  add('iron', 'iron', [
    [23, 8], [24, 8], [25, 8], [26, 8], [23, 10], [24, 10], [25, 10], [26, 10], [22, 11], [27, 11], [22, 8], [27, 8],
  ], () => 12, { locked: true });
  add('scienceGem', 'science', [
    [5, 18], [7, 18], [10, 18], [13, 18], [17, 22], [21, 22], [5, 25], [8, 25], [12, 24], [20, 26], [23, 25], [27, 23], [2, 20], [16, 18], [18, 20],
  ], () => 1);
  return out;
})();

/** Villagers who wander within 3 tiles of home. */
export const NPCS = [
  { name: 'Baker', tx: 6, ty: 21, skin: '#ffdbc8', shirt: '#e76f51', hair: '#5c4033' },
  { name: 'Farmer', tx: 10, ty: 22, skin: '#ffd6a5', shirt: '#90be6d', hair: '#3c2f2f' },
  { name: 'Teacher', tx: 18, ty: 18, skin: '#ffe0bd', shirt: '#f4a261', hair: '#5a3d2b' },
  { name: 'Doctor', tx: 22, ty: 20, skin: '#f1c27d', shirt: '#a29bfe', hair: '#2d1e1a' },
  { name: 'Mayor', tx: 25, ty: 24, skin: '#f8d5c2', shirt: '#4ecdc4', hair: '#4b382a' },
];

export { MAP_W, MAP_H };
