// The Science Center: the purple foundation site and the five pieces that
// rise on it (slab, blue walls, purple upper floor, gold dome, telescope +
// floating star). Colours are the old drawScienceCenter()'s.
import * as THREE from 'three';
import { Mesher, makeLabel } from '../city/worldKit.js';
import { windowAt, windowSide, doorAt } from '../city/worldTown.js';
import { tileToWorld, TILE } from './contracts.js';
import { FOUNDATION, BUILD_TILE } from './layout.js';

// The foundation covers tiles 15..18 x 25..28: continuous tile coords 15..19.
export const CENTER = {
  x: (FOUNDATION.cx - 16) * TILE,
  z: (FOUNDATION.cy - 16) * TILE,
  size: (FOUNDATION.tx1 - FOUNDATION.tx0 + 1) * TILE,   // 10
  slab: 8.4, step: 9.2, walls: 6.4,
  slabTop: 0.22, stepTop: 0.11,
};

const RY = Math.PI;   // front (+Z local) faces north, toward the road

function slabPiece() {
  const m = new Mesher();
  m.box(CENTER.step, CENTER.stepTop, CENTER.step, 0, 0, 0, 0x91a7ff);
  m.box(CENTER.slab, CENTER.slabTop, CENTER.slab, 0, 0, 0, 0xd0ebff);
  m.box(CENTER.slab + 0.1, 0.05, CENTER.slab + 0.1, 0, CENTER.slabTop - 0.02, 0, 0x74c0fc, { outline: false });
  return m.build();
}

function wallsPiece() {
  const w = CENTER.walls, f = w / 2, y0 = CENTER.slabTop;
  const m = new Mesher();
  m.box(w, 2.4, w, 0, y0, 0, 0xa5d8ff);
  m.box(w + 0.16, 0.14, w + 0.16, 0, y0 + 2.4, 0, 0xffffff, { outline: false });
  m.box(w + 0.1, 0.16, w + 0.1, 0, y0 + 0.5, 0, 0x74c0fc, { outline: false });
  // entrance porch with columns
  m.box(2.5, 0.14, 1.3, 0, y0 + 1.95, f + 0.65, 0xffffff);
  for (const x of [-1.05, 1.05]) m.cyl(0.11, 0.11, 1.9, x, y0, f + 1.1, 0xffffff, { seg: 8, outline: false });
  m.box(2.7, 0.1, 1.5, 0, y0, f + 0.75, 0xd7dbe2, { outline: false });
  doorAt(m, 0, f, 1.15, 1.75, 0x4dabf7);
  m.sph(0.24, 0, y0 + 2.25, f + 0.35, 0xffd43b, { seg: 5, segV: 3, glow: true, outline: false });
  for (const x of [-2.2, 2.2]) windowAt(m, x, y0 + 1.25, f, 0.8, 1.0);
  for (const x of [-1.6, 1.6]) windowAt(m, x, y0 + 1.25, -f, 0.8, 1.0, -1);
  for (const z of [-1.6, 1.6]) {
    windowSide(m, -f, y0 + 1.25, z, 0.8, 1.0, -1);
    windowSide(m, f, y0 + 1.25, z, 0.8, 1.0, 1);
  }
  return m.build();
}

function upperPiece() {
  const y0 = CENTER.slabTop + 2.4 + 0.14, s = 4.6, f = s / 2;
  const m = new Mesher();
  m.box(s, 1.1, s, 0, y0, 0, 0xd0a2ff);
  m.box(s + 0.2, 0.14, s + 0.2, 0, y0 + 1.1, 0, 0x7b2cbf);
  for (const x of [-1.15, 1.15]) windowAt(m, x, y0 + 0.5, f, 0.7, 0.6);
  for (const x of [-1.15, 1.15]) windowAt(m, x, y0 + 0.5, -f, 0.7, 0.6, -1);
  for (const z of [-1.15, 1.15]) {
    windowSide(m, -f, y0 + 0.5, z, 0.7, 0.6, -1);
    windowSide(m, f, y0 + 0.5, z, 0.7, 0.6, 1);
  }
  return m.build();
}

const DOME_Y = CENTER.slabTop + 2.4 + 0.14 + 1.1 + 0.14;   // top of the upper floor's cap

function domePiece() {
  const m = new Mesher();
  m.cyl(1.8, 1.9, 0.3, 0, DOME_Y, 0, 0xe9d5ff);
  m.sph(1.7, 0, DOME_Y + 0.3, 0, 0xffd43b, { thetaLen: Math.PI / 2, seg: 20, segV: 10 });
  m.torus(1.72, 0.08, Math.PI * 2, 0, DOME_Y + 0.32, 0, 0xe67700, { rx: Math.PI / 2, segR: 24, segT: 6, outline: false });
  // observation slit, looking north
  m.box(0.45, 1.3, 0.3, 0, DOME_Y + 0.55, 1.52, 0x2b1b52, { rx: -0.6, outline: false });
  return m.build();
}

const STAR_Y = DOME_Y + 3.9;

function telescopePiece() {
  const m = new Mesher({ outlineT: 0.03 });
  const bx = -0.5, by = DOME_Y + 1.62, bz = 0.3;
  m.cyl(0.1, 0.16, 0.4, bx, by - 0.12, bz, 0x868e96, { seg: 8 });
  m.tube(bx, by + 0.2, bz, bx + 0.7, by + 1.1, bz + 0.7, 0.11, 0xdee2e6, { seg: 10, outline: true });
  m.tube(bx + 0.55, by + 0.93, bz + 0.55, bx + 0.85, by + 1.25, bz + 0.85, 0.15, 0xffd43b, { seg: 10 });
  m.sph(0.1, bx + 0.9, by + 1.3, bz + 0.9, 0x8ecae6, { seg: 8, segV: 6, glow: true, outline: false });
  // antenna
  m.cyl(0.03, 0.03, 1.2, 0.9, DOME_Y + 1.3, -0.9, 0xffd43b, { outline: false });
  m.sph(0.09, 0.9, DOME_Y + 2.5, -0.9, 0xff6b6b, { seg: 8, segV: 6, glow: true, outline: false });
  return m.build();
}

function starMesh() {
  const shape = new THREE.Shape();
  const R = 0.55, r = 0.24;
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.translate(0, 0, -0.08);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  const g = new THREE.Group();
  g.add(mesh, halo);
  return g;
}

/** The empty foundation site: curb, corner stakes, "Build Science Center" plate + sign. */
function siteMarkers(root) {
  const m = new Mesher({ outlineT: 0.035 });
  const s = CENTER.size, h = s / 2 - 0.14;
  m.box(s - 0.1, 0.09, 0.28, 0, 0, -h, 0x7048e8, { outline: false });
  m.box(s - 0.1, 0.09, 0.28, 0, 0, h, 0x7048e8, { outline: false });
  m.box(0.28, 0.09, s - 0.1, -h, 0, 0, 0x7048e8, { outline: false });
  m.box(0.28, 0.09, s - 0.1, h, 0, 0, 0x7048e8, { outline: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.box(0.22, 1.3, 0.22, sx * h, 0, sz * h, 0x8a5a34);
    m.box(0.3, 0.12, 0.3, sx * h, 1.3, sz * h, 0xffd43b, { outline: false });
  }
  const g = m.build();
  g.position.set(CENTER.x, 0, CENTER.z);
  root.add(g);

  // glowing plate where she presses E
  const bp = tileToWorld(BUILD_TILE.tx, BUILD_TILE.ty);
  const plate = new THREE.Group();
  plate.position.set(bp.x, 0.07, bp.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: 0x5c3fd6 }));
  disc.rotation.x = -Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd43b }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  plate.add(disc, rim);
  root.add(plate);
  const label = makeLabel('Build Science Center', { icon: '🔬', height: 0.62, accent: '#b197fc' });
  label.position.set(bp.x, 1.9, bp.z);
  root.add(label);
  return { group: g, plate, label, buildPos: bp };
}

/**
 * Returns { pieces: Group[5], site, label, star, setBuilt(n) }.
 * Piece groups are hidden until setBuilt(n) shows the first n of them.
 */
export function buildScienceCenter(root) {
  const site = siteMarkers(root);
  const makers = [slabPiece, wallsPiece, upperPiece, domePiece, telescopePiece];
  const pieces = makers.map((make, i) => {
    const g = new THREE.Group();
    g.name = `scienceCenter${i + 1}`;
    g.position.set(CENTER.x, 0, CENTER.z);
    g.rotation.y = RY;
    g.add(make());
    g.visible = false;
    root.add(g);
    return g;
  });
  const star = starMesh();
  star.visible = false;
  star.position.set(CENTER.x - 0.6, STAR_Y, CENTER.z + 0.6);
  root.add(star);

  const label = makeLabel('Science Center', { icon: '★', height: 0.7, accent: '#ffd43b' });
  label.position.set(CENTER.x, STAR_Y + 1.5, CENTER.z);
  label.userData.hidden = true;
  root.add(label);

  return { pieces, star, site, label, starBase: STAR_Y };
}
