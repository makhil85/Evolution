// Chapter 1 trees and greenery.
//
//  - the 27 choppable resource trees (real tree models, one instanced batch
//    per species; chopping one zeroes its instance and frees its trunk)
//  - bushes, flowers, mushrooms on FREE tiles only (no trees inside the town:
//    the chase camera got stuck in canopies in Chapter 2)
//  - a deep forest belt outside the map edge
import * as THREE from 'three';
import { instanceAsset, loadShared } from '../game/board.js';
import { asset, packScaleFor, SCALE } from '../game/contracts.js';
import { makeRng } from '../city/worldKit.js';
import { MAP_W, MAP_H, TILE, tileToWorld } from './contracts.js';
import {
  ROADS, BUILDINGS, STATIONS, PICKUPS, NPCS, WELL, START_TILE, FOUNDATION, IRON_ROOM, KEY_GATE,
} from './layout.js';

const KENNEY = (n) => asset(`assets/models/kenney_nature/${n}.glb`);
const NA = (n) => asset(`assets/models/nature/${n}.gltf`);

const TRUNK = { tree_default: 0.2, tree_oak: 0.3, tree_pineDefaultA: 0.27, tree_fat: 0.26, tree_detailed: 0.4 };

const TREES = [
  { asset: 'tree_default', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x4e9e46 } },
  { asset: 'tree_oak', tints: { woodBark: 0x76532d, leafsGreen: 0x5cb04e } },
  { asset: 'tree_pineDefaultA', tints: { woodBarkDark: 0x63452a, leafsDark: 0x367f40 } },
  { asset: 'tree_fat', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x67b356 } },
  { asset: 'tree_detailed', tints: { woodBark: 0x6f4f2e, leafsGreen: 0x54a44c, _defaultMat: 0x54a44c } },
];
const tintOf = Object.fromEntries(TREES.map((t) => [t.asset, t.tints]));

/** Which tiles are spoken for. */
export function buildOccupancy() {
  const occ = new Uint8Array(MAP_W * MAP_H);
  const mark = (tx, ty, margin = 0) => {
    for (let y = ty - margin; y <= ty + margin; y++) {
      for (let x = tx - margin; x <= tx + margin; x++) {
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) occ[y * MAP_W + x] = 1;
      }
    }
  };
  for (const key of ROADS) { const [x, y] = key.split(',').map(Number); mark(x, y); }
  for (const b of BUILDINGS) mark(b.tx, b.ty, 1);
  for (const s of STATIONS) mark(s.tx, s.ty, 1);
  mark(WELL.tx, WELL.ty, 1);
  for (let y = FOUNDATION.ty0 - 1; y <= FOUNDATION.ty1 + 1; y++) for (let x = FOUNDATION.tx0 - 1; x <= FOUNDATION.tx1 + 1; x++) mark(x, y);
  for (let y = IRON_ROOM.ty0; y <= IRON_ROOM.ty1 + 1; y++) for (let x = IRON_ROOM.tx0; x <= IRON_ROOM.tx1; x++) mark(x, y);
  mark(KEY_GATE.tx, KEY_GATE.ty + 1, 1);
  for (const p of PICKUPS) mark(p.tx, p.ty, 0);
  for (const n of NPCS) mark(n.tx, n.ty, 0);
  mark(START_TILE.tx, START_TILE.ty, 1);
  return { occ, isFree: (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && !occ[ty * MAP_W + tx] };
}

/** The 27 resource trees. Returns { solids, setCollected(id), position(id), get(id) }. */
export async function buildResourceTrees(root) {
  const group = new THREE.Group();
  group.name = 'resourceTrees';
  root.add(group);
  await Promise.all(TREES.map((t) => loadShared(KENNEY(t.asset))));

  const trees = PICKUPS.filter((p) => p.type === 'tree');
  const rng = makeRng(777);
  const buckets = TREES.map((t) => ({ t, list: [] }));
  const records = new Map();
  trees.forEach((pk, i) => {
    const b = buckets[(i * 3 + Math.floor(i / 5)) % TREES.length];
    const w = tileToWorld(pk.tx, pk.ty);
    const scale = 0.78 + rng() * 0.16;
    const rec = {
      ...pk, x: w.x, z: w.z, scale, bucket: b, index: b.list.length, collected: false,
      r: Math.max(0.3, (TRUNK[b.t.asset] ?? 0.3) * packScaleFor(KENNEY(b.t.asset)) * scale),
    };
    b.list.push({ x: w.x, z: w.z, rotY: rng() * 6.28, scale });
    records.set(pk.id, rec);
  });
  for (const b of buckets) {
    b.meshes = b.list.length
      ? await instanceAsset(group, KENNEY(b.t.asset), b.list, { outline: false, castShadow: true, partTints: tintOf[b.t.asset] })
      : [];
  }
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    group,
    records,
    get: (id) => records.get(id),
    /** Returns true if this was a tree that just vanished. */
    setCollected(id) {
      const rec = records.get(id);
      if (!rec || rec.collected) return false;
      rec.collected = true;
      for (const im of rec.bucket.meshes) { im.setMatrixAt(rec.index, ZERO); im.instanceMatrix.needsUpdate = true; }
      return true;
    },
    position(id) { const r = records.get(id); return r && !r.collected ? { x: r.x, z: r.z } : null; },
    /** Standing trunks, as { x, z, r } (live view: collected ones are skipped by callers). */
    solids: () => [...records.values()].filter((r) => !r.collected),
  };
}

/** Bushes / flowers on free tiles, plus the forest belt outside the map. */
export async function buildScenery(root, { isFree }) {
  const group = new THREE.Group();
  group.name = 'scenery';
  root.add(group);
  const rng = makeRng(31337);
  const buckets = {};
  const put = (key, p) => { (buckets[key] ||= { list: [] }).list.push(p); };

  await Promise.all([
    ...TREES.map((t) => loadShared(KENNEY(t.asset))),
    loadShared(KENNEY('plant_bushDetailed')),
    loadShared(NA('Flower_3_Group')), loadShared(NA('Bush_Common_Flowers')), loadShared(NA('Mushroom_Common')),
  ]);

  // --- inside the map: bushes and flowers only ---------------------------------
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (!isFree(tx, ty)) continue;
      const c = tileToWorld(tx, ty);
      const jx = c.x + (rng() - 0.5) * 1.3, jz = c.z + (rng() - 0.5) * 1.3;
      const grove = 0.5 + 0.5 * Math.sin(tx * 0.37 + 1.2) * Math.sin(ty * 0.31 - 0.6);
      const r = rng();
      if (r < 0.02 + grove * 0.06) put('bush', { x: jx, z: jz, rotY: rng() * 6.28, scale: 0.8 + rng() * 0.3 });
      else if (r < 0.2 + grove * 0.16) put('bush', { x: jx, z: jz, rotY: rng() * 6.28, scale: 0.55 + rng() * 0.35 });
      else if (r < 0.36 + grove * 0.1) put('flower', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureGrass * (0.8 + rng() * 0.6) });
      else if (r < 0.4) put('flowerBush', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureBush * (0.8 + rng() * 0.4) });
      else if (r < 0.415) put('mushroom', { x: jx, z: jz, rotY: rng() * 6.28, scale: SCALE.natureMushroom });
    }
  }

  // --- the forest belt outside the map ------------------------------------------
  const M = 11;
  const step = 1.25;
  for (let ty = -M; ty < MAP_H + M; ty += step) {
    for (let tx = -M; tx < MAP_W + M; tx += step) {
      const inside = tx > -0.4 && ty > -0.4 && tx < MAP_W + 0.4 && ty < MAP_H + 0.4;
      if (inside) continue;
      const edgeDist = Math.max(-tx, tx - MAP_W, -ty, ty - MAP_H);
      if (rng() > (edgeDist < 4 ? 0.95 : 0.85 - edgeDist * 0.02)) continue;
      const x = (tx - MAP_W / 2) * TILE + (rng() - 0.5) * 2.4;
      const z = (ty - MAP_H / 2) * TILE + (rng() - 0.5) * 2.4;
      const s = 0.85 + rng() * 0.6 + Math.min(edgeDist, 8) * 0.03;
      if (edgeDist < 1.6 && rng() < 0.35) put('bush', { x, z, rotY: rng() * 6.28, scale: 0.7 + rng() * 0.4 });
      else put(TREES[Math.floor(rng() * TREES.length)].asset, { x, z, rotY: rng() * 6.28, scale: s });
    }
  }

  const jobs = [];
  for (const t of TREES) {
    const b = buckets[t.asset];
    if (b) jobs.push(instanceAsset(group, KENNEY(t.asset), b.list, { outline: false, castShadow: true, partTints: t.tints }));
  }
  const simple = [
    ['bush', KENNEY('plant_bushDetailed'), { partTints: { grass: 0x4a9448 }, castShadow: false }],
    ['flower', NA('Flower_3_Group'), { castShadow: false }],
    ['flowerBush', NA('Bush_Common_Flowers'), { castShadow: false }],
    ['mushroom', NA('Mushroom_Common'), { castShadow: false }],
  ];
  for (const [key, path, opts] of simple) {
    const b = buckets[key];
    if (b) jobs.push(instanceAsset(group, path, b.list, { outline: false, ...opts }));
  }
  await Promise.all(jobs);
  return { group, counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.list.length])) };
}
