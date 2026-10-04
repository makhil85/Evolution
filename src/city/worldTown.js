// The town that was already standing (Science Center, City Hall, Supply Depot,
// two houses), the quest consoles and the golden bridge lock.
import * as THREE from 'three';
import { Mesher, makeLabel, makePanel } from './worldKit.js';
import { tileToWorld, TILE } from './contracts.js';
import { TOWN_BUILDINGS, isRoad } from './layout.js';

/** Angle (about Y) that turns a model's +Z front toward the nearest road tile. */
export function facingRoad(tx, ty, fallback = 0) {
  let best = null;
  for (let r = 1; r <= 3 && !best; r++) {
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (isRoad(tx + dx * r, ty + dz * r)) { best = [dx, dz]; break; }
    }
  }
  return best ? Math.atan2(best[0], best[1]) : fallback;
}

const STONE = 0xb9b2a5;
const TRIM = 0xf1ebe0;
const WOOD = 0x8a5a34;
const WINDOW = 0xbfe8ff;
const DARK = 0x3a3f4a;

/** A front-facing window: dark frame, glowing pane, sill. */
export function windowAt(m, x, y, z, w = 0.5, h = 0.5, dir = 1) {
  m.box(w + 0.12, h + 0.12, 0.08, x, y - 0.06, z + dir * 0.04, 0x5a4a3a, { outline: false });
  m.box(w, h, 0.08, x, y, z + dir * 0.08, WINDOW, { glow: true });
  m.box(0.05, h, 0.09, x, y, z + dir * 0.09, 0x5a4a3a, { outline: false });
  m.box(w, 0.05, 0.09, x, y + h / 2 - 0.025, z + dir * 0.09, 0x5a4a3a, { outline: false });
  m.box(w + 0.22, 0.08, 0.2, x, y - 0.14, z + dir * 0.1, TRIM, { outline: false });
}

/** A window on a side wall (normal along +-X). dir = +1 for the east wall, -1 for the west. */
export function windowSide(m, x, y, z, w = 0.5, h = 0.5, dir = 1) {
  m.box(0.08, h + 0.12, w + 0.12, x + dir * 0.04, y - 0.06, z, 0x5a4a3a, { outline: false });
  m.box(0.08, h, w, x + dir * 0.08, y, z, WINDOW, { glow: true });
  m.box(0.09, h, 0.05, x + dir * 0.09, y, z, 0x5a4a3a, { outline: false });
  m.box(0.2, 0.08, w + 0.22, x + dir * 0.1, y - 0.14, z, TRIM, { outline: false });
}

export function doorAt(m, x, z, w = 0.6, h = 1.1, color = WOOD) {
  m.box(w + 0.16, h + 0.1, 0.1, x, 0.2, z + 0.03, 0x5a3b22, { outline: false });
  m.box(w, h, 0.1, x, 0.2, z + 0.06, color, { outline: false });
  m.sph(0.045, x + w * 0.3, 0.75, z + 0.13, 0xffd43b, { outline: false, seg: 6, segV: 5 });
}

// --- individual buildings (local space, front = +Z, origin at ground centre) --

function house(m, c) {
  const w = 2.5, d = 2.3;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, STONE);
  m.box(w, 1.6, d, 0, 0.2, 0, c.wall);
  m.box(w + 0.05, 0.1, d + 0.05, 0, 1.75, 0, TRIM, { outline: false });
  m.gable(w + 0.55, d + 0.5, 1.15, 0, 1.8, 0, c.roof, { ry: 0 });
  // chimney
  m.box(0.34, 0.9, 0.34, 0.7, 2.0, -0.4, 0xa0522d);
  m.box(0.42, 0.08, 0.42, 0.7, 2.9, -0.4, 0x5a3b22, { outline: false });
  const f = d / 2;
  doorAt(m, 0, f, 0.6, 1.1);
  m.box(1.0, 0.1, 0.5, 0, 0, f + 0.25, 0xd1cbbd, { outline: false });   // step
  windowAt(m, -0.85, 1.05, f, 0.45, 0.5);
  windowAt(m, 0.85, 1.05, f, 0.45, 0.5);
  windowSide(m, -w / 2, 1.05, 0, 0.45, 0.5, -1);
  windowSide(m, w / 2, 1.05, 0, 0.45, 0.5, 1);
}

function scienceCenter(m, c) {
  const w = 3.0, d = 3.0;
  m.box(w + 0.2, 0.22, d + 0.2, 0, 0, 0, 0x9aa3b0);
  m.box(w, 1.9, d, 0, 0.22, 0, c.wall);
  m.box(w + 0.1, 0.12, d + 0.1, 0, 2.02, 0, 0xffffff, { outline: false });
  // purple observatory dome + slit
  m.cyl(1.2, 1.3, 0.28, 0, 2.14, 0, 0xe9d5ff);
  m.sph(1.2, 0, 2.42, 0, c.roof, { thetaLen: Math.PI / 2, seg: 16, segV: 10 });
  m.box(0.34, 1.0, 0.28, 0, 2.6, 1.02, 0x2b1b52, { rx: -0.55, outline: false });
  // telescope + antenna
  m.cyl(0.03, 0.03, 1.0, -0.5, 3.4, -0.3, 0xffd43b, { outline: false });
  m.sph(0.09, -0.5, 4.45, -0.3, 0xff6b6b, { seg: 8, segV: 6, glow: true });
  const f = d / 2;
  // entrance porch
  m.box(1.5, 0.12, 0.7, 0, 1.55, f + 0.35, 0xffffff);
  m.cyl(0.08, 0.08, 1.33, -0.6, 0.22, f + 0.55, 0xffffff, { seg: 8, outline: false });
  m.cyl(0.08, 0.08, 1.33, 0.6, 0.22, f + 0.55, 0xffffff, { seg: 8, outline: false });
  doorAt(m, 0, f, 0.8, 1.2, 0x4dabf7);
  m.box(1.6, 0.1, 0.8, 0, 0, f + 0.4, 0xd7dbe2, { outline: false });
  windowAt(m, -1.0, 1.2, f, 0.5, 0.7);
  windowAt(m, 1.0, 1.2, f, 0.5, 0.7);
  windowSide(m, -w / 2, 1.2, 0, 0.7, 0.7, -1);
  windowSide(m, w / 2, 1.2, 0, 0.7, 0.7, 1);
  // star emblem over the door: gold 5-point star from two rotated boxes+diamond
  m.sph(0.17, 0, 1.85, f + 0.5, 0xffd43b, { glow: true, seg: 5, segV: 3, outline: false });
}

function cityHall(m, c) {
  const w = 3.1, d = 2.7;
  m.box(w + 0.2, 0.25, d + 0.2, 0, 0, 0, 0x9aa0a8);
  m.box(w, 1.75, d, 0, 0.25, 0, c.wall);
  m.box(w + 0.16, 0.14, d + 0.16, 0, 2.0, 0, 0xffffff, { outline: false });
  m.gable(w + 0.4, d + 0.35, 0.75, 0, 2.14, 0, c.roof);
  const f = d / 2;
  // portico: four columns + pediment
  for (const x of [-1.05, -0.35, 0.35, 1.05]) m.cyl(0.11, 0.12, 1.6, x, 0.25, f + 0.55, 0xffffff, { seg: 10, outline: false });
  m.box(2.5, 0.14, 0.9, 0, 1.85, f + 0.4, 0xf1f3f5);
  m.gable(2.6, 0.9, 0.42, 0, 1.99, f + 0.4, 0xdee2e6, { ry: 0 });
  m.box(2.7, 0.14, 1.0, 0, 0.11, f + 0.5, 0xced4da, { outline: false });
  doorAt(m, 0, f, 0.8, 1.15, 0x37474f);
  windowAt(m, -1.2, 1.2, f, 0.42, 0.7);
  windowAt(m, 1.2, 1.2, f, 0.42, 0.7);
  // clock tower on the ridge
  m.box(0.75, 0.9, 0.75, 0, 2.5, -0.25, c.wall);
  m.pyramid(0.95, 0.95, 0.75, 0, 3.4, -0.25, c.roof);
  m.box(0.4, 0.4, 0.06, 0, 2.75, 0.14, 0xfff3bf, { glow: true, outline: false });
  m.cyl(0.02, 0.02, 0.5, 0, 4.15, -0.25, 0xffd43b, { outline: false });
  // flag
  m.box(0.4, 0.26, 0.03, 0.22, 4.4, -0.25, 0xe03131, { outline: false });
}

function supplyDepot(m, c) {
  const w = 3.0, d = 2.6;
  m.box(w + 0.16, 0.2, d + 0.16, 0, 0, 0, 0x9aa3a0);
  m.box(w, 1.5, d, 0, 0.2, 0, c.wall);
  // long low pitched roof, ridge along X
  m.gable(d + 0.5, w + 0.5, 0.75, 0, 1.7, 0, c.roof, { ry: Math.PI / 2 });
  const f = d / 2;
  // big roller door with slats
  m.box(1.5, 1.15, 0.1, 0, 0.2, f + 0.03, 0x6c757d);
  for (let i = 0; i < 5; i++) m.box(1.4, 0.05, 0.12, 0, 0.38 + i * 0.22, f + 0.05, 0xadb5bd, { outline: false });
  windowAt(m, -1.05, 1.05, f, 0.36, 0.4);
  windowAt(m, 1.05, 1.05, f, 0.36, 0.4);
  // stacked crates and barrels outside
  m.box(0.55, 0.5, 0.55, 1.6, 0, f - 0.25, 0xc08552);
  m.box(0.5, 0.45, 0.5, 1.55, 0.5, f - 0.3, 0xa9743c);
  m.cyl(0.25, 0.25, 0.6, -1.65, 0, f - 0.15, 0x4dabf7, { seg: 10 });
  // dollar sign board above the door
  m.box(0.8, 0.3, 0.06, 0, 1.6, f + 0.06, 0xffd43b, { outline: false });
}

const BUILDERS = { house, scienceCenter, cityHall, supplyDepot };

/** Footprint (half extent) of each type, used by blocked(). */
export const TOWN_HALF = { house: 1.3, scienceCenter: 1.55, cityHall: 1.6, supplyDepot: 1.55 };
const TOWN_LABEL_Y = { house: 3.2, scienceCenter: 4.9, cityHall: 4.9, supplyDepot: 3.5 };

/** Build all town buildings into one mesh (+ hull), and their name signs. */
export function buildTown(root) {
  const m = new Mesher();
  const labels = [];
  const solids = [];
  for (const b of TOWN_BUILDINGS) {
    const p = tileToWorld(b.tx, b.ty);
    const ry = facingRoad(b.tx, b.ty);
    const bm = new Mesher({ x: p.x, z: p.z, ry });
    (BUILDERS[b.type] || house)(bm, b.colors);
    // move the sub-mesher's parts into the shared one
    m.lit.push(...bm.lit); m.glow.push(...bm.glow); m.hulls.push(...bm.hulls);

    const label = makeLabel(b.label, { icon: b.symbol === 'G' ? '' : b.symbol, height: 0.58, accent: '#a5d8ff' });
    label.position.set(p.x, TOWN_LABEL_Y[b.type] ?? 3.4, p.z);
    root.add(label);
    labels.push(label);
    const half = TOWN_HALF[b.type] ?? 1.3;
    solids.push({ minX: p.x - half, maxX: p.x + half, minZ: p.z - half, maxZ: p.z + half });
  }
  const group = m.build();
  group.name = 'town';
  root.add(group);
  return { group, labels, solids };
}

// ---------------------------------------------------------------------------
// Quest consoles
// ---------------------------------------------------------------------------

const CONSOLE_COLORS = {
  normal: { body: 0xffd43b, trim: 0xf59f00 },
  locked: { body: 0xc99700, trim: 0x8a6500 },
};

function buildConsoleMesh(colors) {
  const m = new Mesher();
  m.box(1.5, 0.18, 1.5, 0, 0, 0, 0xc79a6b);           // base plate
  m.box(1.05, 0.12, 1.05, 0, 0.18, 0, 0xffd8a8);
  m.box(0.74, 0.74, 0.6, 0, 0.3, 0, colors.body);       // pedestal
  m.box(0.8, 0.08, 0.66, 0, 1.04, 0, colors.trim);
  // little button strip on the pedestal front
  for (let i = 0; i < 3; i++) m.box(0.12, 0.08, 0.05, -0.2 + i * 0.2, 0.62, 0.3, [0xff6b6b, 0xffe066, 0x69db7c][i], { outline: false });
  // upright display board (icon panels go on both faces)
  m.box(1.2, 0.9, 0.16, 0, 1.1, 0, colors.body);
  m.box(1.28, 0.08, 0.22, 0, 2.0, 0, colors.trim, { outline: false });
  // antenna with a warm lamp
  m.cyl(0.03, 0.03, 0.4, -0.5, 2.06, 0, 0x868e96, { outline: false, seg: 6 });
  m.sph(0.085, -0.5, 2.5, 0, 0xff922b, { glow: true, seg: 8, segV: 6 });
  return m.build();
}

/** Icon panels on both faces of the display board, so it reads from any side. */
function buildScreen(icon, tint) {
  const g = new THREE.Group();
  const front = makePanel(icon, { w: 1.02, h: 0.72, bg: tint ?? '#10203a', border: '#fff3bf', fontPx: 120 });
  front.position.set(0, 1.55, 0.09);
  const back = front.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.09;
  g.add(front, back);
  return g;
}

/**
 * Build the standing consoles. Returns { stations: Map(quest -> record), lock }.
 * A record has { quest, group, label, tx, ty, x, z, visible }.
 */
export function buildStations(root, stations) {
  const map = new Map();
  const meshNormal = buildConsoleMesh(CONSOLE_COLORS.normal);
  const meshLocked = buildConsoleMesh(CONSOLE_COLORS.locked);
  for (const s of stations) {
    const p = tileToWorld(s.tx, s.ty);
    const group = new THREE.Group();
    group.name = `station:${s.quest}`;
    group.position.set(p.x, 0, p.z);
    group.rotation.y = facingRoad(s.tx, s.ty);

    const isBridge = s.quest === 'bridge';
    const body = meshNormal.clone(true);
    group.add(body);
    let locked = null;
    if (isBridge) {
      locked = meshLocked.clone(true);
      group.add(locked);
      body.visible = false;
    }
    // Clones share geometry and materials, so this stays cheap.
    const screen = buildScreen(s.icon, isBridge ? '#3a2a05' : '#10203a');
    group.add(screen);

    // Beacon: a small spinning gold diamond so unsolved consoles read from afar.
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff08a }),
    );
    beacon.position.set(0, 2.75, 0);
    group.add(beacon);

    root.add(group);

    const label = makeLabel(s.short, { icon: s.icon, height: 0.5, accent: '#ffd43b' });
    label.position.set(p.x, 3.1, p.z);
    root.add(label);

    map.set(s.quest, { quest: s.quest, group, label, beacon, body, locked, screen, tx: s.tx, ty: s.ty, x: p.x, z: p.z, visible: true, baseLabel: s.short });
  }
  return map;
}

// ---------------------------------------------------------------------------
// The golden bridge lock
// ---------------------------------------------------------------------------

/** A hovering padlock over the road just before the bridge. */
export function buildLock(root) {
  const build = (open) => {
    const m = new Mesher({ outlineT: 0.04 });
    const gold = open ? 0x8ce99a : 0xffc61a;
    const dark = open ? 0x2b8a3e : 0x5c3d00;
    // shackle: three quarters of a ring; open = swung up and to the side
    m.torus(0.34, 0.075, Math.PI, open ? 0.33 : 0, open ? 0.86 : 0.72, 0, open ? 0xd8ffe0 : 0xfff2a8, { rz: 0, segR: 14, segT: 6 });
    m.box(0.1, 0.22, 0.14, open ? -0.01 : -0.34, 0.5, 0, open ? 0xd8ffe0 : 0xfff2a8, { outline: false });
    if (!open) m.box(0.1, 0.22, 0.14, 0.34, 0.5, 0, 0xfff2a8, { outline: false });
    m.box(1.0, 0.8, 0.42, 0, 0, 0, gold);                    // body
    m.box(1.08, 0.1, 0.46, 0, 0.72, 0, gold, { outline: false });
    m.cyl(0.11, 0.11, 0.06, 0, 0.44, 0.22, dark, { rx: Math.PI / 2, outline: false });
    m.box(0.08, 0.26, 0.06, 0, 0.16, 0.22, dark, { outline: false });
    return m.build();
  };
  const group = new THREE.Group();
  group.name = 'goldenLock';
  const closed = build(false);
  const open = build(true);
  open.visible = false;
  group.add(closed, open);
  group.scale.setScalar(1.15);

  const p = tileToWorld(25, 17);
  group.position.set(p.x, 2.0, p.z);
  group.rotation.y = -Math.PI / 2; // face west, toward anyone walking down the road
  root.add(group);

  const labelClosed = makeLabel('Golden Lock', { icon: '🔐', height: 0.6, accent: '#ffd43b' });
  const labelOpen = makeLabel('Bridge Open', { icon: '🔓', height: 0.6, accent: '#8ce99a' });
  for (const l of [labelClosed, labelOpen]) { l.position.set(p.x, 3.35, p.z); root.add(l); }
  labelOpen.userData.hidden = true;
  labelOpen.visible = false;

  return {
    group, labels: [labelClosed, labelOpen], closed, open, baseY: 2.0, x: p.x, z: p.z,
    hidden: false,
    setOpen(v) {
      closed.visible = !v;
      open.visible = v;
      labelClosed.userData.hidden = v;
      labelOpen.userData.hidden = !v;
    },
  };
}

export { TILE };
