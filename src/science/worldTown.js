// Chapter 1 village: the 8 buildings, the well, and the quest stations (three
// purple math boards, two teal science labs).
//
// Same look as Chapter 2's town (src/city/worldTown.js): little toon
// buildings from the vertex-colour mesher, one merged mesh for the lot. The
// window / door helpers are imported from there; the buildings themselves are
// Chapter 1's own (colours from layout.js BUILDINGS, the old drawVillageBuilding
// styles).
import * as THREE from 'three';
import { Mesher, makeLabel, makePanel } from '../city/worldKit.js';
import { windowAt, windowSide, doorAt } from '../city/worldTown.js';
import { tileToWorld } from './contracts.js';
import { BUILDINGS, STATIONS, WELL, isRoad } from './layout.js';

const STONE = 0xb9b2a5;
const TRIM = 0xf1ebe0;
const WOOD = 0x8a5a34;

/** Angle (about Y) that turns a model's +Z front toward the nearest road tile. */
export function facingRoad(tx, ty, fallback = 0) {
  let best = null;
  for (let r = 1; r <= 5 && !best; r++) {
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (isRoad(tx + dx * r, ty + dz * r)) { best = [dx, dz]; break; }
    }
  }
  return best ? Math.atan2(best[0], best[1]) : fallback;
}

// --- individual buildings (local space, front = +Z, origin at ground centre) --

function house(m, c) {
  const w = 2.5, d = 2.3, f = d / 2;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, STONE);
  m.box(w, 1.6, d, 0, 0.2, 0, c.wall);
  m.box(w + 0.05, 0.1, d + 0.05, 0, 1.75, 0, TRIM, { outline: false });
  m.gable(w + 0.55, d + 0.5, 1.15, 0, 1.8, 0, c.roof);
  m.box(0.34, 0.9, 0.34, 0.7, 2.0, -0.4, 0xa0522d);
  m.box(0.42, 0.08, 0.42, 0.7, 2.9, -0.4, 0x5a3b22, { outline: false });
  doorAt(m, 0, f, 0.6, 1.1);
  m.box(1.0, 0.1, 0.5, 0, 0, f + 0.25, 0xd1cbbd, { outline: false });
  windowAt(m, -0.85, 1.05, f, 0.45, 0.5);
  windowAt(m, 0.85, 1.05, f, 0.45, 0.5);
  windowSide(m, -w / 2, 1.05, 0, 0.45, 0.5, -1);
  windowSide(m, w / 2, 1.05, 0, 0.45, 0.5, 1);
  return { w, d, signY: 1.58, top: 3.3 };
}

function blacksmith(m, c) {
  const w = 2.8, d = 2.3, f = d / 2;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, 0x7d8590);
  m.box(w, 1.5, d, 0, 0.2, 0, c.wall);
  m.box(w + 0.05, 0.1, d + 0.05, 0, 1.65, 0, 0x5c677d, { outline: false });
  m.gable(w + 0.5, d + 0.5, 0.95, 0, 1.7, 0, c.roof);
  // tall stone chimney with the forge fire showing at its foot
  m.box(0.55, 2.7, 0.55, -0.85, 0.2, -0.55, 0x6c757d);
  m.box(0.68, 0.1, 0.68, -0.85, 2.9, -0.55, 0x343a40, { outline: false });
  m.box(0.26, 0.2, 0.06, -0.85, 2.15, -0.28, 0xff922b, { glow: true, outline: false });
  // open forge bay: dark opening, glowing coals
  m.box(1.5, 1.1, 0.1, 0.35, 0.2, f + 0.03, 0x22262b);
  m.box(1.24, 0.14, 0.08, 0.35, 0.28, f + 0.09, 0xff6b1a, { glow: true, outline: false });
  m.box(0.16, 1.2, 0.16, -0.5, 0.2, f + 0.08, 0x5a4a3a, { outline: false });
  m.box(0.16, 1.2, 0.16, 1.2, 0.2, f + 0.08, 0x5a4a3a, { outline: false });
  m.box(1.75, 0.14, 0.2, 0.35, 1.3, f + 0.08, 0x5a4a3a, { outline: false });
  windowAt(m, -0.85, 1.0, f, 0.4, 0.4);
  // anvil and a water barrel by the door
  m.box(0.5, 0.3, 0.3, 1.5, 0, f + 0.6, 0x495057);
  m.box(0.3, 0.14, 0.34, 1.5, 0.3, f + 0.6, 0x343a40, { outline: false });
  m.box(0.34, 0.1, 0.16, 1.28, 0.34, f + 0.6, 0x343a40, { outline: false });
  m.cyl(0.24, 0.24, 0.55, -1.3, 0, f + 0.5, 0x4dabf7, { seg: 10 });
  return { w, d, signY: 1.5, top: 3.4 };
}

function market(m, c) {
  const w = 2.8, d = 2.2, f = d / 2;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, 0xa0a89e);
  m.box(w, 1.5, d, 0, 0.2, 0, c.wall);
  m.gable(w + 0.4, d + 0.4, 0.75, 0, 1.7, 0, c.roof, { ry: Math.PI / 2 });
  // striped awning over a produce counter
  for (let i = 0; i < 8; i++) {
    m.box(0.4, 0.07, 0.95, -1.4 + 0.2 + i * 0.4, 1.5 - i * 0 , f + 0.5, i % 2 ? 0xffffff : c.roof, { rx: 0.35, outline: false });
  }
  m.box(2.2, 0.55, 0.5, 0, 0.1, f + 0.55, 0xc08552);
  m.box(2.3, 0.08, 0.6, 0, 0.65, f + 0.55, 0xdba368, { outline: false });
  const fruit = [0xff6b6b, 0xffd43b, 0x69db7c, 0xff922b, 0xff6b6b, 0xa9e34b];
  fruit.forEach((col, i) => m.sph(0.11, -0.9 + i * 0.36, 0.78, f + 0.55, col, { seg: 8, segV: 6, outline: false }));
  m.box(0.16, 1.4, 0.16, -1.05, 0.1, f + 0.95, 0x8a5a34, { outline: false });
  m.box(0.16, 1.4, 0.16, 1.05, 0.1, f + 0.95, 0x8a5a34, { outline: false });
  doorAt(m, -1.0, f - 0.02, 0.55, 1.05, 0x2f9e44);
  windowAt(m, 1.05, 1.15, f, 0.4, 0.4);
  m.box(0.5, 0.45, 0.5, 1.75, 0, f + 0.2, 0xc08552);
  m.box(0.42, 0.4, 0.42, 1.7, 0.45, f + 0.2, 0xa9743c);
  return { w, d, signY: 1.55, top: 3.0 };
}

function school(m, c) {
  const w = 3.0, d = 2.4, f = d / 2;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, 0xb6b39a);
  m.box(w, 1.7, d, 0, 0.2, 0, c.wall);
  m.box(w + 0.05, 0.1, d + 0.05, 0, 1.85, 0, TRIM, { outline: false });
  m.gable(w + 0.5, d + 0.4, 1.0, 0, 1.9, 0, c.roof);
  // bell tower over the door
  m.box(0.9, 0.9, 0.9, 0, 2.5, 0.0, c.wall);
  m.pyramid(1.15, 1.15, 0.85, 0, 3.4, 0, c.roof);
  m.sph(0.14, 0, 2.95, f - 1.2 + 0.46, 0xffd43b, { seg: 8, segV: 6, outline: false });
  m.cyl(0.02, 0.02, 0.5, 0, 4.2, 0, 0x868e96, { outline: false });
  m.box(0.42, 0.26, 0.03, 0.22, 4.5, 0, 0xe03131, { outline: false });
  doorAt(m, 0, f, 0.9, 1.15, 0x5c7cfa);
  m.box(1.5, 0.1, 0.5, 0, 0, f + 0.25, 0xd7dbe2, { outline: false });
  for (const x of [-1.05, 1.05]) windowAt(m, x, 1.15, f, 0.5, 0.6);
  windowSide(m, -w / 2, 1.15, 0, 0.6, 0.6, -1);
  windowSide(m, w / 2, 1.15, 0, 0.6, 0.6, 1);
  return { w, d, signY: 2.0, top: 4.6 };
}

function hospital(m, c) {
  const w = 3.0, d = 2.4, f = d / 2;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, 0xb8c4c0);
  m.box(w, 1.6, d, 0, 0.2, 0, c.wall);
  m.box(w + 0.2, 0.14, d + 0.2, 0, 1.8, 0, c.roof);
  m.gable(w + 0.2, d + 0.2, 0.55, 0, 1.94, 0, c.roof, { ry: Math.PI / 2 });
  // red cross on the wall
  m.box(0.75, 0.2, 0.07, 0, 1.28, f + 0.03, 0xffffff, { glow: true, outline: false });
  m.box(0.2, 0.75, 0.07, 0, 1.0, f + 0.03, 0xffffff, { glow: true, outline: false });
  m.box(0.6, 0.15, 0.08, 0, 1.36, f + 0.07, 0xe03131, { glow: true, outline: false });
  m.box(0.15, 0.6, 0.08, 0, 1.13, f + 0.07, 0xe03131, { glow: true, outline: false });
  // entrance canopy
  m.box(1.4, 0.1, 0.7, 0, 1.3, f + 0.35, 0xffffff, { outline: false });
  m.cyl(0.06, 0.06, 1.1, -0.6, 0.2, f + 0.62, 0xffffff, { seg: 8, outline: false });
  m.cyl(0.06, 0.06, 1.1, 0.6, 0.2, f + 0.62, 0xffffff, { seg: 8, outline: false });
  doorAt(m, 0, f - 0.02, 0.8, 1.0, 0x74c0fc);
  for (const x of [-1.1, 1.1]) windowAt(m, x, 1.15, f, 0.5, 0.55);
  windowSide(m, -w / 2, 1.15, 0, 0.6, 0.55, -1);
  windowSide(m, w / 2, 1.15, 0, 0.6, 0.55, 1);
  return { w, d, signY: 1.72, top: 3.4 };
}

function government(m, c) {
  const w = 3.0, d = 2.5, f = d / 2;
  m.box(w + 0.2, 0.25, d + 0.2, 0, 0, 0, 0x9aa0a8);
  m.box(w, 1.75, d, 0, 0.25, 0, c.wall);
  m.box(w + 0.16, 0.14, d + 0.16, 0, 2.0, 0, 0xffffff, { outline: false });
  m.gable(w + 0.3, d + 0.3, 0.7, 0, 2.14, 0, c.roof);
  for (const x of [-1.0, -0.33, 0.33, 1.0]) m.cyl(0.11, 0.12, 1.6, x, 0.25, f + 0.5, 0xffffff, { seg: 10, outline: false });
  m.box(2.4, 0.14, 0.8, 0, 1.85, f + 0.4, 0xf1f3f5);
  m.gable(2.5, 0.8, 0.4, 0, 1.99, f + 0.4, 0xdee2e6);
  m.box(2.6, 0.14, 0.9, 0, 0.11, f + 0.45, 0xced4da, { outline: false });
  doorAt(m, 0, f, 0.75, 1.1, 0x37474f);
  windowAt(m, -1.2, 1.2, f, 0.4, 0.65);
  windowAt(m, 1.2, 1.2, f, 0.4, 0.65);
  // little dome + flag
  m.cyl(0.55, 0.6, 0.3, 0, 2.84, -0.2, 0xe9ecef);
  m.sph(0.5, 0, 3.14, -0.2, c.roof, { thetaLen: Math.PI / 2, seg: 14, segV: 8 });
  m.cyl(0.02, 0.02, 0.6, 0, 3.6, -0.2, 0xffd43b, { outline: false });
  m.box(0.4, 0.26, 0.03, 0.22, 4.0, -0.2, 0xe03131, { outline: false });
  return { w, d, signY: 1.78, top: 4.3 };
}

const BUILDERS = { house, blacksmith, market, school, hospital, government };

const panelCache = new Map();
function symbolPanel(symbol, big = false) {
  const key = symbol + big;
  if (!panelCache.has(key)) {
    const p = makePanel(symbol, { w: big ? 0.7 : 0.62, h: big ? 0.5 : 0.44, bg: '#1a2740', border: '#fff3bf', emoji: false, fontPx: symbol.length > 1 ? 120 : 150, fg: '#fff8d6' });
    panelCache.set(key, p);
  }
  return panelCache.get(key).clone();
}

/** Rotate a local (x, z) offset by ry about Y (same handedness as Mesher's base). */
function rot(x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/** All 8 buildings in one mesh (+ hull), name signs, symbol plaques. */
export function buildVillage(root) {
  const m = new Mesher();
  const labels = [];
  const solids = [];
  for (const b of BUILDINGS) {
    const p = tileToWorld(b.tx, b.ty);
    const ry = facingRoad(b.tx, b.ty);
    const bm = new Mesher({ x: p.x, z: p.z, ry });
    const info = (BUILDERS[b.type] || house)(bm, b.colors);
    m.lit.push(...bm.lit); m.glow.push(...bm.glow); m.hulls.push(...bm.hulls);

    // symbol plaque on the front wall, above the door
    const plaque = symbolPanel(b.symbol);
    const off = rot(0, info.d / 2 + 0.2, ry);
    plaque.position.set(p.x + off.x, info.signY + 0.2, p.z + off.z);
    plaque.rotation.y = ry;
    root.add(plaque);

    const label = makeLabel(b.label, { icon: b.symbol, height: 0.58, accent: '#a5d8ff' });
    label.position.set(p.x, info.top + 0.25, p.z);
    root.add(label);
    labels.push(label);

    // axis-aligned footprint (ry is a multiple of 90 degrees)
    const swap = Math.abs(Math.sin(ry)) > 0.5;
    const hx = (swap ? info.d : info.w) / 2 + 0.15;
    const hz = (swap ? info.w : info.d) / 2 + 0.15;
    solids.push({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz });
  }
  const group = m.build();
  group.name = 'village';
  root.add(group);
  return { group, labels, solids };
}

// ---------------------------------------------------------------------------
// The well
// ---------------------------------------------------------------------------

export function buildWell(root) {
  const p = tileToWorld(WELL.tx, WELL.ty);
  const m = new Mesher({ x: p.x, z: p.z });
  m.cyl(0.85, 0.9, 0.7, 0, 0, 0, 0xadb5bd, { seg: 14 });
  m.cyl(0.95, 0.95, 0.12, 0, 0.7, 0, 0xced4da, { seg: 14, outline: false });
  m.cyl(0.66, 0.66, 0.05, 0, 0.66, 0, 0x339af0, { seg: 14, glow: true, outline: false });
  for (const x of [-0.8, 0.8]) m.box(0.14, 1.5, 0.14, x, 0.7, 0, WOOD, { outline: false });
  m.box(1.9, 0.12, 0.14, 0, 2.15, 0, 0x6f4e37, { outline: false });
  m.gable(1.6, 1.3, 0.55, 0, 2.25, 0, 0xb22222, { ry: Math.PI / 2 });
  m.tubeX(1.5, 0.05, 0, 1.75, 0, 0x8a5a34, { seg: 6, outline: false });
  m.cyl(0.14, 0.12, 0.2, 0.25, 1.05, 0, 0x8a6a4a, { seg: 8, outline: false });
  m.tube(0.25, 1.75, 0, 0.25, 1.25, 0, 0.012, 0x495057);
  const group = m.build();
  group.name = 'well';
  root.add(group);
  const label = makeLabel(WELL.label, { icon: '💧', height: 0.5, accent: '#74c0fc' });
  label.position.set(p.x, 3.1, p.z);
  root.add(label);
  return { group, label, x: p.x, z: p.z, r: 1.05 };
}

// ---------------------------------------------------------------------------
// Quest stations
// ---------------------------------------------------------------------------

const BOARD = {
  unsolved: { plate: 0xc79a6b, plate2: 0xffd8a8, body: 0x8b5cf6, trim: 0x6d28d9, lamp: 0xff922b },
  solved: { plate: 0xc79a6b, plate2: 0xffd8a8, body: 0x52b788, trim: 0x2f9e63, lamp: 0x69db7c },
};
const LAB = {
  unsolved: { plate: 0x168aad, plate2: 0x56d4ff, body: 0x14b8a6, trim: 0x0f766e, glass: 0x80ffdb },
  solved: { plate: 0x168aad, plate2: 0x56d4ff, body: 0x40c057, trim: 0x2b8a3e, glass: 0xb2f2bb },
};

function boardMesh(c) {
  const m = new Mesher();
  m.box(1.6, 0.16, 1.6, 0, 0, 0, c.plate);
  m.box(1.15, 0.12, 1.15, 0, 0.16, 0, c.plate2);
  m.box(0.74, 0.74, 0.6, 0, 0.28, 0, c.body);
  m.box(0.8, 0.08, 0.66, 0, 1.02, 0, c.trim);
  for (let i = 0; i < 3; i++) m.box(0.12, 0.08, 0.05, -0.2 + i * 0.2, 0.6, 0.3, [0xff6b6b, 0xffe066, 0x69db7c][i], { outline: false });
  m.box(1.25, 0.95, 0.16, 0, 1.1, 0, c.body);
  m.box(1.33, 0.08, 0.22, 0, 2.05, 0, c.trim, { outline: false });
  m.cyl(0.03, 0.03, 0.4, -0.5, 2.1, 0, 0x868e96, { outline: false, seg: 6 });
  m.sph(0.085, -0.5, 2.54, 0, c.lamp, { glow: true, seg: 8, segV: 6 });
  return m.build();
}

function labMesh(c) {
  const m = new Mesher();
  m.box(1.7, 0.16, 1.7, 0, 0, 0, c.plate);
  m.box(1.2, 0.12, 1.2, 0, 0.16, 0, c.plate2);
  // bench with a glass flask on it
  m.box(1.2, 0.82, 0.8, 0, 0.28, 0.2, c.body);
  m.box(1.3, 0.09, 0.9, 0, 1.1, 0.2, c.trim, { outline: false });
  m.sph(0.3, 0, 1.5, 0.22, c.glass, { seg: 12, segV: 9, glow: true });
  m.cyl(0.11, 0.11, 0.3, 0, 1.75, 0.22, c.glass, { seg: 8, glow: true, outline: false });
  m.cyl(0.14, 0.14, 0.06, 0, 2.03, 0.22, 0xdee2e6, { seg: 8, outline: false });
  m.sph(0.07, 0.35, 1.35, 0.5, 0xffffff, { seg: 6, segV: 5, glow: true, outline: false });
  // display board behind the bench
  m.box(1.25, 0.95, 0.16, 0, 1.15, -0.5, c.body);
  m.box(1.33, 0.08, 0.22, 0, 2.1, -0.5, c.trim, { outline: false });
  return m.build();
}

/**
 * The five quest stations. A record has { quest, kind, group, x, z, solved,
 * visible, beacon, labelOpen, labelDone }.
 */
export function buildStations(root, level) {
  const map = new Map();
  const cache = {
    mathBoard: { unsolved: boardMesh(BOARD.unsolved), solved: boardMesh(BOARD.solved) },
    lab: { unsolved: labMesh(LAB.unsolved), solved: labMesh(LAB.solved) },
  };
  for (const s of STATIONS) {
    const p = tileToWorld(s.tx, s.ty);
    const isBoard = s.kind === 'mathBoard';
    const ry = facingRoad(s.tx, s.ty);
    const group = new THREE.Group();
    group.name = `station:${s.quest}`;
    group.position.set(p.x, 0, p.z);
    group.rotation.y = ry;

    const variants = {};
    for (const state of ['unsolved', 'solved']) {
      const g = new THREE.Group();
      g.add(cache[s.kind][state].clone(true));
      const bg = state === 'solved' ? '#14532d' : (isBoard ? '#3b1a7a' : '#0b3b4a');
      const border = state === 'solved' ? '#b2f2bb' : (isBoard ? '#e9d5ff' : '#c3fae8');
      const emoji = !isBoard && s.symbol.codePointAt(0) > 0x1f000;
      const front = makePanel(state === 'solved' ? '✓' : s.symbol, { w: 1.02, h: 0.72, bg, border, fg: '#fff8d6', emoji: emoji && state !== 'solved', fontPx: 130 });
      const zB = isBoard ? 0 : -0.5;
      front.position.set(0, isBoard ? 1.58 : 1.62, zB + 0.09);
      const back = front.clone();
      back.rotation.y = Math.PI;
      back.position.z = zB - 0.09;
      g.add(front, back);
      g.visible = state === 'unsolved';
      variants[state] = g;
      group.add(g);
    }

    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: isBoard ? 0xe9d5ff : 0x99f6e4 }));
    beacon.position.set(0, 2.9, 0);
    group.add(beacon);
    root.add(group);

    // The three boards stand three tiles apart, so their full names
    // ("Puzzle Board 1: wood carts") overlapped each other and the houses
    // behind. The sign says "Puzzle 1"; the full name is in the E prompt.
    const text = isBoard ? `Puzzle ${s.quest.slice(1)}` : (s.labels[level] || s.labels[4]);
    const labelOpen = makeLabel(text, { icon: isBoard ? s.symbol : (s.quest === 'force' ? '→' : '🔥'), height: 0.42, accent: isBoard ? '#b197fc' : '#63e6be', fontPx: 42 });
    const labelDone = makeLabel(isBoard ? `${text} solved` : `Solved: ${text}`, { icon: '✓', height: 0.42, accent: '#8ce99a', fontPx: 42 });
    for (const l of [labelOpen, labelDone]) { l.position.set(p.x, 3.3, p.z); root.add(l); }
    labelDone.userData.hidden = true;

    map.set(s.quest, {
      quest: s.quest, kind: s.kind, group, variants, beacon, labelOpen, labelDone,
      tx: s.tx, ty: s.ty, x: p.x, z: p.z, solved: false, r: 0.85,
    });
  }
  return map;
}
