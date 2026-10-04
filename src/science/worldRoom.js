// The locked iron room: low stone-and-timber walls round the 8 x 8 yard and
// the golden-lock gate at (24, 13) that swings open once the key is solved.
import * as THREE from 'three';
import { Mesher, makeLabel } from '../city/worldKit.js';
import { tileToWorld, TILE } from './contracts.js';
import { IRON_ROOM, KEY_GATE, isRoomWall } from './layout.js';

const STONE = 0x9a9186;
const STONE_LT = 0xb8afa2;
const PLANK = 0xa47148;
const PLANK_DK = 0x6f4e37;
const GOLD = 0xffc61a;
const WALL_H = 1.25;

export function buildRoom(root) {
  // --- walls, one merged mesh -------------------------------------------------
  const m = new Mesher({ outlineT: 0.04 });
  const { tx0, ty0, tx1, ty1 } = IRON_ROOM;
  const half = TILE / 2;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!isRoomWall(tx, ty)) continue;
      const p = tileToWorld(tx, ty);
      const alongX = ty === ty0 || ty === ty1;   // top and bottom rows run east-west
      const lx = alongX ? TILE : 0.7, lz = alongX ? 0.7 : TILE;
      m.box(lx, 0.42, lz + 0.14 * (alongX ? 1 : 0) , p.x, 0, p.z, STONE);
      m.box(alongX ? TILE - 0.06 : 0.5, WALL_H - 0.5, alongX ? 0.5 : TILE - 0.06, p.x, 0.42, p.z, PLANK);
      m.box(alongX ? TILE : 0.66, 0.1, alongX ? 0.66 : TILE, p.x, WALL_H - 0.08, p.z, PLANK_DK, { outline: false });
      // plank seams
      for (const k of [-0.5, 0.5]) {
        if (alongX) m.box(0.05, WALL_H - 0.55, 0.53, p.x + k * 0.9, 0.44, p.z, PLANK_DK, { outline: false });
        else m.box(0.53, WALL_H - 0.55, 0.05, p.x, 0.44, p.z + k * 0.9, PLANK_DK, { outline: false });
      }
      // a post at the tile's west / north edge, and the far corners
      const px = alongX ? p.x - half : p.x, pz = alongX ? p.z : p.z - half;
      m.box(0.42, WALL_H + 0.4, 0.42, px, 0, pz, PLANK_DK);
      m.box(0.5, 0.1, 0.5, px, WALL_H + 0.4, pz, STONE_LT, { outline: false });
    }
  }
  // closing posts at the east and south ends
  for (const [tx, ty] of [[tx1, ty0], [tx0, ty1], [tx1, ty1]]) {
    const p = tileToWorld(tx, ty);
    const ex = tx === tx1 ? p.x + half : p.x - half, ez = ty === ty1 ? p.z + half : p.z - half;
    for (const [x, z] of [[ex, ez]]) {
      m.box(0.46, WALL_H + 0.55, 0.46, x, 0, z, PLANK_DK);
      m.box(0.56, 0.12, 0.56, x, WALL_H + 0.55, z, GOLD, { outline: false });
    }
  }
  const walls = m.build();
  walls.name = 'ironRoomWalls';
  root.add(walls);

  // --- the gate ------------------------------------------------------------------
  const gp = tileToWorld(KEY_GATE.tx, KEY_GATE.ty);
  const gate = new THREE.Group();
  gate.name = 'keyGate';
  gate.position.set(gp.x, 0, gp.z);
  root.add(gate);

  // pillars and lintel: always there
  const frame = new Mesher({ outlineT: 0.045 });
  for (const s of [-1, 1]) {
    frame.box(0.55, 2.2, 0.62, s * 1.1, 0, 0, STONE);
    frame.box(0.66, 0.14, 0.72, s * 1.1, 2.2, 0, STONE_LT, { outline: false });
    frame.sph(0.13, s * 1.1, 2.34, 0, GOLD, { seg: 8, segV: 6, outline: false });
  }
  frame.box(2.3, 0.28, 0.42, 0, 1.9, 0, PLANK_DK);
  frame.box(1.0, 0.26, 0.06, 0, 1.91, 0.24, GOLD, { outline: false });
  frame.box(2.5, 0.08, 0.5, 0, 0, 0, 0x7d5a3a, { outline: false });
  gate.add(frame.build());

  // closed: two plank leaves with a big golden padlock
  const closed = new Mesher({ outlineT: 0.04 });
  for (const s of [-1, 1]) {
    closed.box(0.9, 1.7, 0.16, s * 0.47, 0.1, 0, PLANK);
    for (let i = 0; i < 3; i++) closed.box(0.9, 0.09, 0.2, s * 0.47, 0.35 + i * 0.6, 0, PLANK_DK, { outline: false });
  }
  closed.box(0.14, 1.7, 0.2, 0, 0.1, 0, PLANK_DK, { outline: false });
  closed.box(0.62, 0.5, 0.24, 0, 0.72, 0.16, GOLD);
  closed.box(0.68, 0.08, 0.27, 0, 1.18, 0.16, 0xfff2a8, { outline: false });
  closed.torus(0.2, 0.05, Math.PI, 0, 1.15, 0.16, 0xfff2a8, { segR: 14, segT: 6 });
  closed.cyl(0.07, 0.07, 0.05, 0, 0.88, 0.29, 0x5c3d00, { rx: Math.PI / 2, seg: 8, outline: false });
  closed.box(0.06, 0.18, 0.05, 0, 0.7, 0.29, 0x5c3d00, { outline: false });
  const closedG = closed.build();
  gate.add(closedG);

  // open: leaves swung outward (south), a green ribbon over the doorway
  const open = new Mesher({ outlineT: 0.04 });
  for (const s of [-1, 1]) {
    open.box(0.16, 1.7, 0.9, s * 0.92, 0.1, 0.55, PLANK);
    open.box(0.2, 0.09, 0.9, s * 0.92, 0.35, 0.55, PLANK_DK, { outline: false });
    open.box(0.2, 0.09, 0.9, s * 0.92, 0.95, 0.55, PLANK_DK, { outline: false });
  }
  open.box(1.0, 0.26, 0.06, 0, 1.91, 0.24, 0x8ce99a, { outline: false });
  const openG = open.build();
  openG.visible = false;
  gate.add(openG);

  const labelClosed = makeLabel('Golden Lock', { icon: '🔐', height: 0.6, accent: '#ffd43b' });
  const labelOpen = makeLabel('Open', { icon: '🔓', height: 0.6, accent: '#8ce99a' });
  for (const l of [labelClosed, labelOpen]) { l.position.set(gp.x, 3.05, gp.z); root.add(l); }
  labelOpen.userData.hidden = true;
  labelOpen.visible = false;

  return {
    walls, gate, labels: [labelClosed, labelOpen], x: gp.x, z: gp.z,
    setOpen(v) {
      closedG.visible = !v;
      openG.visible = v;
      labelClosed.userData.hidden = v;
      labelOpen.userData.hidden = !v;
    },
  };
}
