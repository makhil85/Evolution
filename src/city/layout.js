// Chapter 2 map layout, ported 1:1 from the old game's buildWorld(),
// buildNPCs(), tileIsRiver() and draw*() placements. Pure data + pure
// functions: no THREE, no DOM, so node tests can import it.
//
// All positions are OLD TILE coordinates (tx, ty); convert with
// contracts.tileToWorld(). A fractional tile (8.25, 22.35) means the same
// point the old isometric drawing used.

import { MAP_W, MAP_H } from './contracts.js';

/** Where she starts on a fresh save. */
export const START_TILE = { tx: 5, ty: 17 };

/** Road tiles, as "tx,ty" strings. */
export const ROADS = (() => {
  const r = new Set();
  const row = (y, x0, x1) => { for (let x = x0; x < x1; x++) r.add(`${x},${y}`); };
  const col = (x, y0, y1) => { for (let y = y0; y < y1; y++) r.add(`${x},${y}`); };
  row(17, 2, 25);
  col(5, 6, 27);
  col(15, 6, 26);
  col(23, 7, 26);
  row(8, 4, 19);
  row(14, 3, 21);
  row(23, 3, 21);
  row(24, 18, 30);
  col(28, 13, 21);
  return r;
})();

export function isRoad(tx, ty) { return ROADS.has(`${tx},${ty}`); }

/**
 * The three-sided moat round the workshop island (3 tiles wide on the west,
 * north and south, one tile on the east edge). Crossable only on the bridge.
 */
export function isRiver(tx, ty) {
  const westMoat = tx >= 26 && tx <= 28 && ty >= 12 && ty <= 21;
  const northMoat = tx >= 29 && tx <= 32 && ty >= 12 && ty <= 14;
  const southMoat = tx >= 29 && tx <= 32 && ty >= 19 && ty <= 21;
  const eastBoundaryWater = tx === 32 && ty >= 15 && ty <= 18;
  return westMoat || northMoat || southMoat || eastBoundaryWater;
}

/** The bridge lane: 3 tiles across the west moat on row 17 (walkable once all 5 planks are built). */
export function isBridgeTile(tx, ty) { return tx >= 26 && tx <= 28 && ty === 17; }

/** The workshop island floor (4 x 4 tiles). */
export function isWorkshopFoundation(tx, ty) { return tx >= 28 && tx <= 31 && ty >= 15 && ty <= 18; }

/** Town buildings that were already standing (from Chapter 1), solid. */
export const TOWN_BUILDINGS = [
  { type: 'scienceCenter', tx: 3, ty: 18, label: 'Science Center', symbol: '★', colors: { wall: '#a5d8ff', roof: '#c084fc' } },
  { type: 'cityHall', tx: 3, ty: 8, label: 'City Hall', symbol: 'G', colors: { wall: '#dee2e6', roof: '#2b2d42' } },
  { type: 'supplyDepot', tx: 3, ty: 24, label: 'Supply Depot', symbol: '$', colors: { wall: '#d8f3dc', roof: '#f77f00' } },
  { type: 'house', tx: 3, ty: 13, label: 'Engineer House', symbol: '⌂', colors: { wall: '#ffd8a8', roof: '#b22222' } },
  { type: 'house', tx: 17, ty: 23, label: 'Town House', symbol: '⌂', colors: { wall: '#ffd8a8', roof: '#b22222' } },
];

/**
 * Quest stations (control consoles). Solid until their structure is fully
 * built, then they disappear. `level: 4` stations exist only at Level 4.
 */
export const STATIONS = [
  { quest: 'bridge', tx: 24, ty: 17, label: 'Locked Bridge Puzzle', short: 'Bridge', icon: '🌉' },
  { quest: 'water', tx: 9, ty: 22, label: 'Water Pump Puzzle', short: 'Water', icon: '💧' },
  { quest: 'gear', tx: 12, ty: 15, label: 'Gear Machine Puzzle', short: 'Gear', icon: '⚙' },
  { quest: 'power', tx: 16, ty: 8, label: 'Power Circuit Puzzle', short: 'Power', icon: '⚡' },
  { quest: 'tile', tx: 10, ty: 8, label: 'STEM Tile Puzzle', short: 'Tiles', icon: '▦' },
  { quest: 'solar', tx: 7, ty: 5, label: 'Solar Shadow Lab', short: 'Science Quiz', icon: '☀', level: 4 },
  { quest: 'magnet', tx: 20, ty: 5, label: 'Magnet Sorting Lab', short: 'Science Quiz', icon: '🧲', level: 4 },
  { quest: 'key', tx: 19, ty: 12, label: 'Hard Blueprint Lock', short: 'Hard', icon: '🔐' },
];

export function stationsFor(level) {
  return STATIONS.filter((s) => !s.level || s.level === level);
}

/**
 * Where each structure rises and roughly how big it is, in old tiles
 * (footprint centre + size), taken from the old draw*() calls. The 3-D art
 * may restyle freely but should keep inside this footprint so nothing
 * overlaps a road, a resource or another building.
 */
export const STRUCTURE_SITES = {
  bridge: { cx: 27.5, cy: 17.5, w: 3.2, d: 1.4, label: 'Bridge' },
  pump: { cx: 8.7, cy: 22.8, w: 1.0, d: 1.0, label: 'Water Pump', symbol: '💧',
    extra: 'blue pipes along row 21.5 from x=7 to 13 appear with piece 2' },
  machine: { cx: 13.3, cy: 15.3, w: 1.5, d: 1.5, label: 'Machine Shop', symbol: '⚙' },
  power: { cx: 15.9, cy: 7.65, w: 1.6, d: 1.6, label: 'Power Station', symbol: '⚡',
    extra: 'yellow power line along row 9.6 from x=10 to 14 appears with piece 2' },
  academy: { cx: 11.1, cy: 7.0, w: 1.9, d: 1.7, label: 'STEM Academy', symbol: 'A+' },
  solar: { cx: 6.8, cy: 5.3, w: 1.3, d: 1.3, label: 'Solar Lab', symbol: '☀' },
  magnet: { cx: 20.7, cy: 5.4, w: 1.3, d: 1.3, label: 'Magnet Lab', symbol: '🧲' },
  vault: { cx: 19.8, cy: 13.4, w: 1.2, d: 1.2, label: 'Blueprint Vault', symbol: '📘' },
  workshop: { cx: 30.0, cy: 17.0, w: 3.6, d: 3.6, label: 'Engineering Workshop', symbol: '⚙' },
};

/** The spot on the island she presses E at to start the final build. */
export const WORKSHOP_BUILD_TILE = { tx: 29, ty: 17 };

/** Collectible resources: [tx, ty, amount]. Ids are stable (saved as removed). */
export const PICKUPS = (() => {
  const out = [];
  let id = 1;
  const add = (type, res, list, amountOf) => list.forEach(([tx, ty], i) => out.push({ id: id++, type, res, tx, ty, amount: amountOf(i) }));
  add('woodCrate', 'wood', [
    [2, 5], [6, 5], [12, 5], [18, 5], [23, 5], [31, 6],
    [3, 12], [7, 13], [14, 12], [20, 10], [24, 8], [25, 16],
    [2, 19], [8, 18], [13, 19], [18, 20], [22, 18],
    [4, 27], [10, 26], [17, 27], [23, 27], [30, 24],
  ], (i) => (i % 3 === 0 ? 4 : 3));
  add('stoneBlock', 'stone', [
    [4, 6], [9, 5], [13, 6], [20, 6], [26, 7], [32, 8],
    [2, 11], [8, 11], [15, 11], [21, 12], [24, 15],
    [3, 20], [7, 19], [12, 21], [19, 22], [24, 22],
    [2, 27], [8, 28], [14, 27], [20, 28], [26, 26], [32, 27],
  ], (i) => (i % 4 === 0 ? 5 : 4));
  add('metalScrap', 'metal', [
    [7, 6], [17, 6], [22, 6], [28, 6],
    [13, 10], [18, 11], [23, 10], [25, 11],
    [9, 15], [16, 14], [20, 15], [24, 14],
    [6, 23], [12, 24], [18, 25], [24, 25], [31, 25],
  ], (i) => (i % 2 === 0 ? 4 : 3));
  add('energyCell', 'energy', [
    [5, 6], [15, 7], [19, 7], [25, 8], [30, 9],
    [11, 12], [17, 13], [22, 11], [24, 16],
    [9, 24], [16, 24], [21, 23],
  ], () => 2);
  add('blueprint', 'blueprints', [
    [6, 7], [14, 9], [18, 8], [22, 9], [31, 10],
    [10, 12], [16, 16], [20, 18], [24, 18],
    [7, 25], [15, 25], [22, 25], [29, 24],
  ], () => 1);
  return out;
})();

/** Townsfolk who wander within 3 tiles of home. */
export const NPCS = [
  { name: 'Engineer', tx: 6, ty: 16, skin: '#ffe0bd', shirt: '#ff922b', hair: '#5a3d2b' },
  { name: 'Builder', tx: 9, ty: 18, skin: '#ffd6a5', shirt: '#69db7c', hair: '#3c2f2f' },
  { name: 'Mechanic', tx: 22, ty: 18, skin: '#f1c27d', shirt: '#4dabf7', hair: '#2d1e1a' },
  { name: 'Scientist', tx: 27, ty: 22, skin: '#f8d5c2', shirt: '#a29bfe', hair: '#4b382a' },
];

export { MAP_W, MAP_H };
