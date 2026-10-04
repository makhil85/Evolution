// Trees, bushes, flowers and rocks for Chapter 2.
//
// Inside the map they only go on EMPTY tiles (never a road, a pickup, a
// building, a console, a structure site, the moat or the island). Outside the
// map edge they form a deep forest belt. Everything is instanced per species,
// so the whole treeline is a handful of draw calls.
import * as THREE from 'three';
import { instanceAsset, loadShared } from '../game/board.js';
import { asset, packScaleFor, SCALE } from '../game/contracts.js';
import { makeRng } from './worldKit.js';
import { MAP_W, MAP_H, TILE, tileToWorld } from './contracts.js';
import {
  ROADS, TOWN_BUILDINGS, STATIONS, STRUCTURE_SITES, PICKUPS, NPCS, START_TILE, isRiver,
} from './layout.js';
import { isWaterTile } from './worldGround.js';

const KENNEY = (n) => asset(`assets/models/kenney_nature/${n}.glb`);
const NA = (n) => asset(`assets/models/nature/${n}.gltf`);

/** Solid trunk radius (in the pack's own units), as Chapter 3 measured. */
const TRUNK = { tree_default: 0.2, tree_oak: 0.3, tree_pineDefaultA: 0.27, tree_fat: 0.26, tree_detailed: 0.4 };

const TREES = [
  { asset: 'tree_default', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x4e9e46 } },
  { asset: 'tree_oak', tints: { woodBark: 0x76532d, leafsGreen: 0x5cb04e } },
  { asset: 'tree_pineDefaultA', tints: { woodBarkDark: 0x63452a, leafsDark: 0x367f40 } },
  { asset: 'tree_fat', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x67b356 } },
  { asset: 'tree_detailed', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x54a44c, _defaultMat: 0x54a44c } },
];

/** Which tiles are spoken for. Returns a marker API plus the final grid. */
export function buildOccupancy() {
  const occ = new Uint8Array(MAP_W * MAP_H);
  const mark = (tx, ty, margin = 0) => {
    for (let y = ty - margin; y <= ty + margin; y++) {
      for (let x = tx - margin; x <= tx + margin; x++) {
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) occ[y * MAP_W + x] = 1;
      }
    }
  };
  const markRect = (x0, y0, x1, y1, margin = 0) => {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) mark(x, y, margin);
  };

  for (const key of ROADS) { const [x, y] = key.split(',').map(Number); mark(x, y); }
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isWaterTile(x, y)) mark(x, y, 1);
  markRect(28, 15, 32, 19, 1);                                   // island + bridge approach
  markRect(24, 16, 29, 19, 1);                                   // bridge lane and its console
  for (const b of TOWN_BUILDINGS) mark(b.tx, b.ty, 1);
  for (const s of STATIONS) mark(s.tx, s.ty, 1);
  for (const [name, s] of Object.entries(STRUCTURE_SITES)) {
    if (name === 'workshop' || name === 'bridge') continue;
    markRect(s.cx - s.w / 2, s.cy - s.d / 2, s.cx + s.w / 2, s.cy + s.d / 2, 1);
  }
  markRect(7, 21, 13, 22, 0);                                     // pump pipe line
  markRect(10, 9, 15, 10, 0);                                     // power line
  for (const p of PICKUPS) mark(p.tx, p.ty, 0);
  for (const n of NPCS) mark(n.tx, n.ty, 0);
  mark(START_TILE.tx, START_TILE.ty, 1);

  return { occ, isFree: (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !occ[ty * MAP_W + tx] };
}

/**
 * Plant everything. Returns { solids: [{x, z, r}], counts }.
 */
export async function buildScenery(root, { isFree }) {
  const group = new THREE.Group();
  group.name = 'scenery';
  root.add(group);
  const rng = makeRng(20261);
  const solids = [];
  const buckets = {};
  const put = (key, p) => { (buckets[key] ||= { list: [] }).list.push(p); return p; };

  await Promise.all([
    ...TREES.map((t) => loadShared(KENNEY(t.asset))),
    loadShared(KENNEY('plant_bushDetailed')), loadShared(KENNEY('rock_smallA')), loadShared(KENNEY('rock_largeB')),
    loadShared(NA('Flower_3_Group')), loadShared(NA('Bush_Common_Flowers')), loadShared(NA('Mushroom_Common')),
  ]);

  const pickTree = () => TREES[Math.floor(rng() * TREES.length)];
  const planTree = (x, z, scale, solid) => {
    const t = pickTree();
    put(t.asset, { x, z, rotY: rng() * 6.28, scale });
    if (solid) {
      const r = (TRUNK[t.asset] ?? 0.3) * packScaleFor(KENNEY(t.asset)) * scale;
      solids.push({ x, z, r: Math.max(0.3, r) });
    }
  };

  // --- inside the map: sparse groves on empty tiles --------------------------
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isFree(tx, ty)) continue;
      const c = tileToWorld(tx, ty);
      const jx = c.x + (rng() - 0.5) * 1.3, jz = c.z + (rng() - 0.5) * 1.3;
      // Groves: a slow field decides where trees are welcome.
      const grove = 0.5 + 0.5 * Math.sin(tx * 0.37 + 1.2) * Math.sin(ty * 0.31 - 0.6);
      const r = rng();
      // No trees inside the town (the old map had none): the chase camera
      // ended up inside their canopies. Bushes instead; the forest belt
      // outside the map frames the town.
      if (r < 0.02 + grove * 0.06) put('bush', { x: jx, z: jz, rotY: rng() * 6.28, scale: 0.8 + rng() * 0.3 });
      else if (r < 0.2 + grove * 0.18) put('bush', { x: jx, z: jz, rotY: rng() * 6.28, scale: 0.55 + rng() * 0.35 });
      else if (r < 0.36 + grove * 0.1) put('flower', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureGrass * (0.8 + rng() * 0.6) });
      else if (r < 0.39) put('flowerBush', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureBush * (0.8 + rng() * 0.4) });
      else if (r < 0.42) {
        put('rock', { x: jx, z: jz, rotY: rng() * 6.28, scale: 0.42 + rng() * 0.25 });
        solids.push({ x: jx, z: jz, r: 0.35 });
      } else if (r < 0.435) put('mushroom', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureMushroom });
    }
  }

  // --- the forest belt outside the map ---------------------------------------
  const M = 11;                                // tiles of forest beyond the edge
  const step = 1.25;
  for (let ty = -M; ty < MAP_H + M; ty += step) {
    for (let tx = -M; tx < MAP_W + M; tx += step) {
      const inside = tx > -0.4 && ty > -0.4 && tx < MAP_W + 0.4 && ty < MAP_H + 0.4;
      if (inside) continue;
      const edgeDist = Math.max(-tx, tx - MAP_W, -ty, ty - MAP_H);
      // Thin out toward the far side; keep a solid hedge right at the edge.
      if (rng() > (edgeDist < 4 ? 0.95 : 0.85 - edgeDist * 0.02)) continue;
      const x = (tx - MAP_W / 2) * TILE + (rng() - 0.5) * 2.4;
      const z = (ty - MAP_H / 2) * TILE + (rng() - 0.5) * 2.4;
      const s = 0.85 + rng() * 0.6 + Math.min(edgeDist, 8) * 0.03;
      if (edgeDist < 1.6 && rng() < 0.35) put('bush', { x, z, rotY: rng() * 6.28, scale: 0.7 + rng() * 0.4 });
      else planTree(x, z, s, false);
    }
  }

  // --- instance everything -----------------------------------------------------
  const tintOf = Object.fromEntries(TREES.map((t) => [t.asset, t.tints]));
  const jobs = [];
  for (const t of TREES) {
    const b = buckets[t.asset];
    if (b) jobs.push(instanceAsset(group, KENNEY(t.asset), b.list, { outline: false, castShadow: true, partTints: tintOf[t.asset] }));
  }
  const simple = [
    ['bush', KENNEY('plant_bushDetailed'), { partTints: { grass: 0x4a9448 }, castShadow: false }],
    ['rock', KENNEY('rock_smallA'), { partTints: { dirt: 0x8b9199, grass: 0x5f9350, _defaultMat: 0x8b9199 }, castShadow: true }],
    ['flower', NA('Flower_3_Group'), { castShadow: false }],
    ['flowerBush', NA('Bush_Common_Flowers'), { castShadow: false }],
    ['mushroom', NA('Mushroom_Common'), { castShadow: false }],
  ];
  for (const [key, path, opts] of simple) {
    const b = buckets[key];
    if (b) jobs.push(instanceAsset(group, path, b.list, { outline: false, ...opts }));
  }
  await Promise.all(jobs);

  const counts = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.list.length]));
  return { group, solids, counts };
}
