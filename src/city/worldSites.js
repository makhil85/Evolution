// The structures each solved quest raises, piece by piece: bridge, water
// pump, machine shop, power station, STEM academy, solar lab, magnet lab,
// blueprint vault and the Engineering Workshop on the island.
//
// Every builder returns its pieces in build order (foundation -> body ->
// roof/detail). A piece is a THREE.Group; setBuilt(n) shows pieces 0..n-1.
// Everything is built from Mesher primitives, so a piece is 1-3 draw calls.
import * as THREE from 'three';
import { Mesher, makeGear, makeLabel, makePanel } from './worldKit.js';
import { windowAt, windowSide, doorAt } from './worldTown.js';
import { STRUCTURE_SITES } from './layout.js';
import { TILE } from './contracts.js';

/** World position of a fractional old-tile point, e.g. (8.7, 22.8). */
export function P(cx, cy) { return { x: (cx - 17) * TILE, z: (cy - 15) * TILE }; }

/** Site record with its world centre and size. */
function site(name) {
  const s = STRUCTURE_SITES[name];
  const c = P(s.cx, s.cy);
  return { ...s, name, x: c.x, z: c.z, W: s.w * TILE, D: s.d * TILE };
}

/** A piece: positioned at the site centre; `rot` is yawed to face the road. */
function makePiece(s, ry = 0) {
  const group = new THREE.Group();
  group.name = `${s.name}:piece`;
  group.position.set(s.x, 0, s.z);
  const rot = new THREE.Group();
  rot.rotation.y = ry;
  group.add(rot);
  return { group, rot };
}

const YELLOW = 0xffd43b;

/** Wire the finished Mesher into a piece's rotated child. */
function fill(piece, mesher, opts) { piece.rot.add(mesher.build(opts)); }

/** A spinning gear inside a piece's rotated child. */
function addGear(piece, spinners, opts, x, y, z, speed) {
  const g = makeGear(opts);
  g.position.set(x, y, z);
  piece.rot.add(g);
  spinners.push({ obj: g, speed });
  return g;
}

/** A small icon panel on a wall. */
function panelAt(piece, icon, x, y, z, w = 0.7, h = 0.52, opts = {}) {
  const p = makePanel(icon, { w, h, fontPx: 110, ...opts });
  p.position.set(x, y, z);
  piece.rot.add(p);
  return p;
}

// ---------------------------------------------------------------------------
// Water pump: pad -> tank + blue pipes -> pump head
// ---------------------------------------------------------------------------
function pump(spinners) {
  const s = site('pump');
  const pieces = [makePiece(s), makePiece(s), makePiece(s)];

  let m = new Mesher();
  m.cyl(1.1, 1.2, 0.22, 0, 0, 0, 0xadb5bd, { seg: 20 });
  m.cyl(0.9, 0.9, 0.05, 0, 0.22, 0, 0x868e96, { seg: 20, outline: false });
  // little stepping stones
  m.box(0.5, 0.12, 0.4, 0, 0, 1.3, 0xced4da, { outline: false });
  fill(pieces[0], m);

  // tank
  m = new Mesher();
  m.cyl(0.62, 0.68, 1.25, 0, 0.27, 0, 0x339af0, { seg: 18 });
  m.cyl(0.7, 0.7, 0.09, 0, 0.62, 0, 0xa5d8ff, { seg: 18, outline: false });
  m.cyl(0.7, 0.7, 0.09, 0, 1.08, 0, 0xa5d8ff, { seg: 18, outline: false });
  m.sph(0.62, 0, 1.52, 0, 0x4dabf7, { thetaLen: Math.PI / 2, seg: 18, segV: 8 });
  // pipes: riser to the main line (row 21.5) then east along it to x = 11.9
  const zLine = (21.5 - 22.8) * TILE;                 // -3.25
  const x0 = (7.4 - 8.7) * TILE, x1 = (11.9 - 8.7) * TILE;
  const PIPE = 0x74c0fc, JOINT = 0x1971c2;
  m.tubeZ(-zLine - 0.6, 0.14, 0, 0.42, zLine / 2 - 0.3, PIPE, { outline: true });
  m.sph(0.2, 0, 0.42, zLine, JOINT, { seg: 10, segV: 8 });
  m.tubeX(x1 - x0, 0.14, (x0 + x1) / 2, 0.42, zLine, PIPE);
  for (let x = x0 + 0.6; x < x1; x += 1.25) {
    m.box(0.16, 0.38, 0.38, x, 0.23, zLine - 0.19, JOINT, { outline: false });   // collars
    m.box(0.16, 0.24, 0.16, x + 0.6, 0, zLine - 0.08, 0x868e96, { outline: false }); // supports
  }
  m.sph(0.2, x0, 0.42, zLine, JOINT, { seg: 10, segV: 8 });
  // valve at the far end
  m.cyl(0.09, 0.09, 0.5, x1, 0.42, zLine, 0x868e96, { seg: 6, outline: false });
  m.cyl(0.24, 0.24, 0.06, x1, 0.92, zLine, 0xe03131, { seg: 10, outline: false });
  fill(pieces[1], m);

  // pump head + spout with a glowing water drop
  m = new Mesher();
  m.cyl(0.16, 0.22, 0.75, 0, 2.02, 0, 0x1971c2, { seg: 12 });
  m.tubeX(0.75, 0.1, 0.36, 2.6, 0, 0x1971c2);
  m.cyl(0.1, 0.1, 0.3, 0.72, 2.32, 0, 0x1971c2, { seg: 8, outline: false });
  m.sph(0.13, 0.72, 2.16, 0, 0x9be0ff, { glow: true, seg: 8, segV: 6, sy: 1.3 });
  m.box(0.7, 0.07, 0.07, -0.25, 2.7, 0, 0x868e96, { rz: 0.4, outline: false });
  fill(pieces[2], m);
  panelAt(pieces[2], '💧', 0, 0.95, 0.7, 0.55, 0.42);
  return { name: 'pump', pieces, label: { text: 'Water Pump', icon: '💧', y: 3.5 }, extraLabelPos: [s.x, s.z] };
}

// ---------------------------------------------------------------------------
// Machine shop: slab -> steel workshop -> saw roof -> spinning gears
// ---------------------------------------------------------------------------
function machine(spinners) {
  const s = site('machine');
  const pieces = [makePiece(s), makePiece(s), makePiece(s), makePiece(s)];
  let m = new Mesher();
  m.box(3.7, 0.22, 3.7, 0, 0, 0, 0xdee2e6);
  m.box(3.7, 0.1, 0.2, 0, 0.22, 1.75, 0xadb5bd, { outline: false });
  fill(pieces[0], m);

  m = new Mesher();
  m.box(2.7, 1.7, 2.4, 0, 0.22, 0, 0x74839b);
  m.box(2.74, 0.5, 2.44, 0, 0.22, 0, 0x5c677d, { outline: false });
  m.box(1.3, 1.3, 0.1, -0.4, 0.22, 1.2, 0x2b3035);
  for (let i = 0; i < 6; i++) m.box(1.2, 0.05, 0.12, -0.4, 0.4 + i * 0.2, 1.24, 0x868e96, { outline: false });
  windowAt(m, 0.85, 1.15, 1.2, 0.5, 0.5);
  m.box(0.5, 0.4, 0.3, 1.5, 0.22, 0.4, 0x495057);   // compressor
  m.cyl(0.12, 0.12, 0.6, 1.55, 0.6, -0.6, 0xe9ecef, { seg: 8 });
  fill(pieces[1], m);

  m = new Mesher();
  m.gable(2.7, 3.0, 0.8, 0, 1.92, 0, 0x343a40, { ry: Math.PI / 2 });
  m.cyl(0.17, 0.2, 1.0, 0.85, 2.0, -0.55, 0x6c757d, { seg: 10 });
  m.cyl(0.22, 0.22, 0.08, 0.85, 3.0, -0.55, 0x343a40, { seg: 10, outline: false });
  m.box(0.4, 0.2, 0.4, -0.9, 2.5, -0.4, 0x868e96, { outline: false });   // roof vent
  fill(pieces[2], m);

  m = new Mesher();
  m.cyl(0.05, 0.05, 1.2, -0.6, 2.0, 0.55, 0x868e96, { seg: 6, outline: false });
  m.cyl(0.05, 0.05, 0.9, 0.55, 2.0, 0.55, 0x868e96, { seg: 6, outline: false });
  fill(pieces[3], m);
  addGear(pieces[3], spinners, { r: 0.72, teeth: 10, color: 0xffc233 }, -0.6, 3.1, 0.6, 0.8);
  addGear(pieces[3], spinners, { r: 0.45, teeth: 7, color: 0xced4da }, 0.55, 2.85, 0.6, -1.25);
  panelAt(pieces[3], '⚙', -1.0, 1.15, 1.32, 0.42, 0.42, { bg: '#2b3035' });
  return { name: 'machine', pieces, label: { text: 'Machine Shop', icon: '⚙', y: 4.4 } };
}

// ---------------------------------------------------------------------------
// Power station: pad -> hut + yellow power line -> coil tower
// ---------------------------------------------------------------------------
function power(spinners) {
  const s = site('power');
  const pieces = [makePiece(s), makePiece(s), makePiece(s)];
  let m = new Mesher();
  m.box(3.9, 0.2, 3.9, 0, 0, 0, 0xffe066);
  for (const [w, d, x, z] of [[3.9, 0.14, 0, 1.88], [3.9, 0.14, 0, -1.88], [0.14, 3.9, 1.88, 0], [0.14, 3.9, -1.88, 0]]) {
    m.box(w, 0.06, d, x, 0.2, z, 0xf08c00, { outline: false });
  }
  fill(pieces[0], m);

  m = new Mesher();
  m.box(2.2, 1.9, 2.2, -0.6, 0.2, 0, YELLOW);
  m.box(2.4, 0.14, 2.4, -0.6, 2.1, 0, 0xf08c00);
  doorAt(m, -0.9, 1.1, 0.6, 1.1, 0x343a40);
  for (let i = 0; i < 4; i++) m.box(0.06, 0.6, 0.06, -1.8 + 0, 0.7, -0.6 + i * 0.4, 0xe67700, { outline: false });
  m.box(0.5, 0.7, 0.45, -1.4, 2.24, -0.4, 0xadb5bd);      // transformer on the roof
  m.box(0.5, 0.7, 0.45, -0.5, 2.24, -0.4, 0xadb5bd);
  fill(pieces[1], m);
  panelAt(pieces[1], '⚡', 0.1, 1.55, 1.11, 0.5, 0.42, { bg: '#3a2c00', border: '#ffe066' });

  // the yellow power line along row 9.6 (x 10 -> 14): poles, arms, cable
  const zL = (9.6 - s.cy) * TILE;
  const poles = [10.1, 11.5, 12.9, 14.3].map((tx) => [(tx - s.cx) * TILE, zL]);
  const ex = new Mesher();
  for (const [px, pz] of poles) {
    ex.cyl(0.07, 0.09, 2.3, px, 0, pz, 0x8a8f98, { seg: 6, outline: false });
    ex.box(0.12, 0.1, 0.8, px, 2.2, pz, YELLOW, { outline: false });
    ex.cyl(0.05, 0.05, 0.14, px, 2.3, pz - 0.3, 0xffffff, { seg: 6, outline: false });
    ex.cyl(0.05, 0.05, 0.14, px, 2.3, pz + 0.3, 0xffffff, { seg: 6, outline: false });
  }
  for (let i = 0; i < poles.length - 1; i++) {
    const [ax, az] = poles[i], [bx, bz] = poles[i + 1];
    for (const dz of [-0.3, 0.3]) {
      const mx = (ax + bx) / 2, my = 2.0;
      ex.tube(ax, 2.37, az + dz, mx, my, az + dz, 0.035, YELLOW);
      ex.tube(mx, my, az + dz, bx, 2.37, bz + dz, 0.035, YELLOW);
    }
  }
  // drop line from the last pole up to the hut
  const [lx, lz] = poles[poles.length - 1];
  ex.tube(lx, 2.37, lz, -1.55, 2.3, 1.05, 0.04, YELLOW);
  ex.tube(lx, 2.37, lz - 0.3, -1.3, 2.3, 1.0, 0.035, YELLOW);
  pieces[1].group.add(ex.build({ castShadow: false }));

  m = new Mesher();
  m.cyl(0.35, 0.52, 1.7, 1.15, 0.2, 0, 0xced4da, { seg: 12 });
  for (const y of [1.15, 1.55, 1.95]) m.torus(0.5 - (y - 1.15) * 0.16, 0.07, Math.PI * 2, 1.15, y, 0, YELLOW, { rx: Math.PI / 2, segR: 16, segT: 6, outline: false });
  m.cyl(0.08, 0.1, 0.5, 1.15, 1.9, 0, 0x868e96, { seg: 8, outline: false });
  m.sph(0.3, 1.15, 2.7, 0, 0xfff3bf, { glow: true, seg: 12, segV: 8 });
  // lightning bolt made of three slanted glow bars
  m.box(0.1, 0.5, 0.06, 1.15, 3.05, 0.34, 0xffe066, { rz: 0.5, glow: true });
  m.box(0.1, 0.4, 0.06, 1.15, 2.75, 0.34, 0xffe066, { rz: -0.5, glow: true });
  fill(pieces[2], m);
  return { name: 'power', pieces, label: { text: 'Power Station', icon: '⚡', y: 4.3 } };
}

// ---------------------------------------------------------------------------
// STEM academy: tiled floor -> school house -> blue roof + A+ sign
// ---------------------------------------------------------------------------
function academy(spinners) {
  const s = site('academy');
  const pieces = [makePiece(s), makePiece(s), makePiece(s)];
  let m = new Mesher();
  m.box(4.8, 0.06, 4.35, 0, 0, 0, 0x2f9e6f);
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 6; i++) {
      m.box(0.74, 0.035, 0.8, (i - 2.5) * 0.78, 0.06, (j - 2) * 0.84, (i + j) % 2 ? 0xb2f2bb : 0x8ce99a, { outline: false });
    }
  }
  fill(pieces[0], m);

  m = new Mesher();
  const zc = -0.2;
  m.box(3.4, 1.9, 2.7, 0, 0.09, zc, 0xffd43b);
  m.box(3.44, 0.12, 2.74, 0, 1.9, zc, 0xfff3bf, { outline: false });
  const f = zc + 1.35;
  m.box(1.0, 0.1, 0.55, 0, 0.09, f + 0.28, 0xd1cbbd, { outline: false });
  doorAt(m, 0, f, 0.8, 1.15, 0x364fc7);
  for (const x of [-1.2, -0.62, 0.62, 1.2]) windowAt(m, x, 1.0, f, 0.4, 0.62);
  windowSide(m, -1.7, 1.0, zc, 0.5, 0.6, -1);
  windowSide(m, 1.7, 1.0, zc, 0.5, 0.6, 1);
  fill(pieces[1], m);

  m = new Mesher();
  m.gable(3.9, 3.1, 1.15, 0, 2.02, zc, 0x4c6ef5);
  m.cyl(0.03, 0.03, 1.0, 1.3, 2.1, zc - 0.7, 0xdee2e6, { seg: 6, outline: false });
  m.box(0.5, 0.3, 0.03, 1.55, 2.85, zc - 0.7, 0xff6b6b, { outline: false });
  m.box(1.1, 0.06, 0.4, 0, 1.98, f + 0.2, 0x364fc7, { outline: false });   // canopy over the door
  fill(pieces[2], m);
  panelAt(pieces[2], 'A+', 0, 2.55, f + 0.04, 0.95, 0.5, { emoji: false, fontPx: 150, bg: '#364fc7', border: '#fff3bf' });
  return { name: 'academy', pieces, label: { text: 'STEM Academy', icon: '', y: 4.4 } };
}

// ---------------------------------------------------------------------------
// Solar lab / magnet lab (Level 4): platform -> hut -> big emblem on top
// ---------------------------------------------------------------------------
function smallLab(name, { ry, base, wall, roof, edge }, addTop, icon) {
  return (spinners) => {
    const s = site(name);
    const pieces = [makePiece(s, ry), makePiece(s, ry), makePiece(s, ry)];
    let m = new Mesher();
    m.box(3.2, 0.18, 3.2, 0, 0, 0, base);
    m.box(3.2, 0.06, 0.16, 0, 0.18, 1.52, edge, { outline: false });
    fill(pieces[0], m);

    m = new Mesher();
    m.box(1.9, 1.35, 1.7, 0, 0.18, 0, wall);
    m.box(2.1, 0.14, 1.9, 0, 1.53, 0, roof);
    doorAt(m, -0.4, 0.85, 0.5, 0.95, 0x5a3b22);
    windowAt(m, 0.5, 0.95, 0.85, 0.4, 0.4);
    fill(pieces[1], m);

    addTop(pieces[2], spinners);
    return { name, pieces, label: { text: STRUCTURE_SITES[name].label, icon, y: 4.0 } };
  };
}

function solarTop(piece, spinners) {
  const m = new Mesher();
  // two tilted panels on the roof, on a cradle
  for (const x of [-0.5, 0.5]) {
    m.box(0.9, 0.08, 1.3, x, 1.85, 0, 0xdee2e6, { rx: -0.45 });
    m.box(0.8, 0.05, 1.2, x, 1.9, 0.01, 0x1971c2, { rx: -0.45, outline: false });
    for (let k = -1; k <= 1; k++) m.box(0.8, 0.02, 0.03, x, 1.92 + k * 0.0, 0.0 + k * 0.32, 0x74c0fc, { rx: -0.45, outline: false });
    m.box(0.03, 0.03, 1.2, x, 1.94, 0, 0x74c0fc, { rx: -0.45, outline: false });
  }
  m.box(0.14, 0.4, 0.14, -0.5, 1.53, -0.2, 0x868e96, { outline: false });
  m.box(0.14, 0.4, 0.14, 0.5, 1.53, -0.2, 0x868e96, { outline: false });
  // a sun on a pole beside the lab
  m.cyl(0.05, 0.05, 2.0, 1.25, 0.18, -1.1, 0x868e96, { seg: 6, outline: false });
  m.sph(0.34, 1.25, 2.4, -1.1, 0xffd43b, { glow: true, seg: 12, segV: 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.box(0.09, 0.3, 0.05, 1.25 + Math.cos(a) * 0.42, 2.4 + Math.sin(a) * 0.42, -1.1, 0xffe066, { rz: a - Math.PI / 2, glow: true });
  }
  piece.rot.add(m.build());
}

function magnetTop(piece, spinners) {
  const m = new Mesher();
  m.box(0.9, 0.16, 0.9, 0, 1.53, 0, 0x868e96, { outline: false });
  // horseshoe: upper half ring + two legs, red with silver tips
  m.torus(0.62, 0.17, Math.PI, 0, 2.55, 0, 0xe03131, { segR: 18, segT: 8 });
  for (const x of [-0.62, 0.62]) {
    m.cyl(0.17, 0.17, 0.75, x, 1.8, 0, 0xe03131, { seg: 10 });
    m.cyl(0.18, 0.18, 0.28, x, 1.7, 0, 0xdee2e6, { seg: 10 });
  }
  piece.rot.add(m.build());
  // small iron filings floating between the poles
  const dots = new Mesher();
  for (let i = 0; i < 6; i++) dots.box(0.12, 0.05, 0.05, -0.4 + i * 0.16, 2.0 + (i % 2) * 0.12, 0, 0x495057, { outline: false, rz: i * 0.5 });
  piece.rot.add(dots.build({ castShadow: false }));
}

// ---------------------------------------------------------------------------
// Blueprint vault: slab -> purple vault -> gold roof with blueprints
// ---------------------------------------------------------------------------
function vault(spinners) {
  const s = site('vault');
  const pieces = [makePiece(s), makePiece(s), makePiece(s)];
  let m = new Mesher();
  m.box(2.9, 0.2, 2.9, 0, 0, 0, 0xa5d8ff);
  m.box(2.9, 0.06, 0.14, 0, 0.2, 1.38, 0x74c0fc, { outline: false });
  fill(pieces[0], m);

  m = new Mesher();
  m.box(2.0, 1.6, 1.8, 0, 0.2, 0, 0x9d4edd);
  m.box(2.06, 0.14, 1.86, 0, 0.75, 0, 0x7b2cbf, { outline: false });
  for (const x of [-0.95, 0.95]) m.box(0.12, 1.6, 1.86, x, 0.2, 0, 0xffd43b, { outline: false });
  // round safe door
  m.cyl(0.62, 0.62, 0.12, 0, 0.95, 0.9, 0xced4da, { rx: Math.PI / 2, seg: 20 });
  m.torus(0.62, 0.06, Math.PI * 2, 0, 0.95, 0.97, 0xffd43b, { segR: 20, segT: 6, outline: false });
  m.box(0.9, 0.08, 0.07, 0, 0.91, 1.0, 0xffd43b, { outline: false });
  m.box(0.08, 0.9, 0.07, 0, 0.5, 1.0, 0xffd43b, { outline: false });
  m.sph(0.1, 0, 0.95, 1.02, 0x7b2cbf, { seg: 8, segV: 6, outline: false });
  fill(pieces[1], m);

  m = new Mesher();
  m.box(2.3, 0.2, 2.1, 0, 1.8, 0, YELLOW);
  m.pyramid(2.3, 2.1, 0.5, 0, 2.0, 0, 0xf59f00);
  // blueprint rolls
  m.tubeX(0.9, 0.11, -0.3, 2.62, 0.1, 0x74c0fc, { seg: 10 });
  m.tubeX(0.9, 0.11, 0.2, 2.58, -0.15, 0xa5d8ff, { seg: 10 });
  fill(pieces[2], m);
  return { name: 'vault', pieces, label: { text: 'Blueprint Vault', icon: '📘', y: 3.9 } };
}

// ---------------------------------------------------------------------------
// The Engineering Workshop on the island: 4 pieces
// ---------------------------------------------------------------------------
function workshop(spinners) {
  const s = site('workshop');
  // Fits the walkable island floor (tiles 29..31); the moat takes the rest.
  const p = P(30.9, 17.0);
  s.x = p.x; s.z = p.z;
  const ry = -Math.PI / 2; // front (+z local) faces west, toward the bridge
  const pieces = [makePiece(s, ry), makePiece(s, ry), makePiece(s, ry), makePiece(s, ry)];

  let m = new Mesher();
  m.box(7.6, 0.9, 5.0, 0, -0.5, 0, 0xd0ebff);
  m.box(7.7, 0.08, 5.1, 0, 0.4, 0, 0x91a7ff, { outline: false });
  m.box(3.0, 0.16, 0.8, 0, 0, 2.85, 0xced4da, { outline: false });   // apron in front of the doors
  fill(pieces[0], m);

  m = new Mesher();
  m.box(6.8, 2.4, 4.4, 0, 0.4, 0, 0x4dabf7);
  m.box(6.86, 0.7, 4.46, 0, 0.4, 0, 0x339af0, { outline: false });
  const f = 2.2;
  // two big bay doors and a walk-in door
  for (const x of [-1.9, 0.0]) {
    m.box(1.7, 1.9, 0.1, x, 0.4, f, 0x1864ab);
    for (let i = 0; i < 8; i++) m.box(1.6, 0.04, 0.12, x, 0.55 + i * 0.22, f + 0.04, 0x4dabf7, { outline: false });
  }
  doorAt(m, 2.0, f, 0.8, 1.3, 0xffd43b);
  for (const x of [-2.9, 2.9]) windowAt(m, x, 1.6, f, 0.5, 0.6);
  windowAt(m, 1.35, 1.7, f, 0.4, 0.5);
  m.box(6.9, 0.14, 4.5, 0, 2.8, 0, 0xdbe4ff, { outline: false });
  fill(pieces[1], m);

  m = new Mesher();
  m.gable(4.9, 7.2, 1.35, 0, 2.94, 0, 0x495057, { ry: Math.PI / 2 });
  m.cyl(0.22, 0.26, 1.6, 2.4, 3.0, -1.0, 0x6c757d, { seg: 10 });
  m.cyl(0.3, 0.3, 0.1, 2.4, 4.6, -1.0, 0x343a40, { seg: 10, outline: false });
  m.cyl(0.18, 0.22, 1.3, 1.7, 3.0, -1.0, 0x6c757d, { seg: 10 });
  m.box(1.1, 0.08, 0.5, -1.5, 3.7, 0.6, 0x74c0fc, { outline: false, rx: -0.5, glow: true });  // skylights
  m.box(1.1, 0.08, 0.5, 0.2, 3.7, 0.6, 0x74c0fc, { outline: false, rx: -0.5, glow: true });
  fill(pieces[2], m);

  m = new Mesher();
  // rooftop crane: yellow cab, pole, arm and hook
  m.box(0.9, 0.7, 0.9, -2.4, 3.9, -0.8, YELLOW);
  m.box(0.95, 0.12, 0.95, -2.4, 4.6, -0.8, 0xe67700, { outline: false });
  m.cyl(0.08, 0.08, 2.0, -2.4, 4.6, -0.8, 0xdee2e6, { seg: 8 });
  m.tubeX(2.2, 0.07, -1.4, 6.5, -0.8, 0xdee2e6, { outline: false });
  m.tube(-2.4, 6.5, -0.8, -0.3, 6.5, -0.8, 0.02, 0x868e96);
  m.tube(-0.4, 6.5, -0.8, -0.4, 5.4, -0.8, 0.02, 0x868e96);
  m.cyl(0.15, 0.15, 0.2, -0.4, 5.25, -0.8, 0xf08c00, { seg: 8, outline: false });
  fill(pieces[3], m);
  addGear(pieces[3], spinners, { r: 0.95, t: 0.22, teeth: 12, color: 0xffc233 }, -0.6, 4.55, 2.3, 0.6);
  addGear(pieces[3], spinners, { r: 0.55, t: 0.22, teeth: 8, color: 0xced4da }, 0.7, 4.0, 2.3, -1.0);
  m = new Mesher();
  m.cyl(0.06, 0.06, 1.6, -0.6, 3.0, 2.3, 0x868e96, { seg: 6, outline: false });
  m.cyl(0.06, 0.06, 1.0, 0.7, 3.0, 2.3, 0x868e96, { seg: 6, outline: false });
  pieces[3].rot.add(m.build({ castShadow: false }));
  return { name: 'workshop', pieces, label: { text: 'Engineering Workshop', icon: '⚙', y: 7.3 } };
}

// ---------------------------------------------------------------------------
// The bridge: five plank sections west -> east, rails and posts with each
// ---------------------------------------------------------------------------
function bridge() {
  const s = site('bridge');
  const pieces = [];
  const LEN = 8.0, SEG = LEN / 5, HALF_W = 1.75;
  for (let i = 0; i < 5; i++) {
    const piece = makePiece(s);
    const m = new Mesher();
    const x0 = -LEN / 2 + i * SEG;
    // deck: a dark slab with planks laid across it
    m.box(SEG, 0.1, 3.4, x0 + SEG / 2, -0.04, 0, 0x6f4a27);
    for (let b = 0; b < 4; b++) {
      m.box(0.36, 0.1, 3.3, x0 + 0.2 + b * 0.4, 0.06, 0, b % 2 ? 0xc0894b : 0xd09a58, { outline: false });
    }
    for (const z of [-1.3, 1.3]) m.box(SEG, 0.24, 0.2, x0 + SEG / 2, -0.26, z, 0x6f4a27, { outline: false });
    // rails and posts on both sides
    for (const z of [-HALF_W + 0.1, HALF_W - 0.1]) {
      m.box(SEG, 0.1, 0.12, x0 + SEG / 2, 0.86, z, 0xa9743c, { outline: false });
      m.box(SEG, 0.08, 0.1, x0 + SEG / 2, 0.5, z, 0xa9743c, { outline: false });
      for (const px of [x0 + 0.06, x0 + SEG / 2]) m.box(0.14, 1.0, 0.14, px, 0.1, z, 0x8a5f34);
      // piers down to the moat bed
      m.box(0.22, 1.05, 0.22, x0 + SEG / 2, -0.95, z * 0.76, 0x6f4a27, { outline: false });
    }
    m.box(0.12, 0.12, 2.3, x0 + SEG / 2, -0.55, 0, 0x6f4a27, { outline: false });   // cross brace
    if (i === 0 || i === 4) {
      const x = i === 0 ? -LEN / 2 + 0.06 : LEN / 2 - 0.06;
      for (const z of [-HALF_W + 0.1, HALF_W - 0.1]) {
        m.box(0.2, 1.25, 0.2, x, 0.1, z, 0x8a5f34);
        m.sph(0.15, x, 1.45, z, 0xffd43b, { seg: 8, segV: 6, outline: false });
      }
    }
    fill(piece, m);
    pieces.push(piece);
  }
  return { name: 'bridge', pieces, label: null };
}

/** The always-present island edge: a low stone quay round the paved floor. */
export function buildQuay() {
  const m = new Mesher();
  const x0 = (29 - 17) * TILE, x1 = (32 - 17) * TILE;      // 30 .. 37.5
  const z0 = (15 - 15) * TILE, z1 = (19 - 15) * TILE;      // 0 .. 10
  const T = 0.32, top = 0.2, bottom = -0.75;
  const wall = (w, d, x, z) => m.box(w, top - bottom, d, x, bottom, z, 0x9aa3ae);
  wall(x1 - x0 + T, T, (x0 + x1) / 2, z0 - T / 2);               // north
  wall(x1 - x0 + T, T, (x0 + x1) / 2, z1 + T / 2);               // south
  wall(T, z1 - z0, x1 + T / 2, (z0 + z1) / 2);                   // east
  // west wall, open where the bridge lane (row 17: z 5 .. 7.5) meets the island
  wall(T, 5.0, x0 - T / 2, 2.5);
  wall(T, 2.5, x0 - T / 2, 8.75);
  const g = m.build();
  g.name = 'islandQuay';
  return g;
}

/** Build every structure; skip solar/magnet below Level 4. */
export function buildSites(level) {
  const spinners = [];
  const out = {};
  out.bridge = bridge();
  out.pump = pump(spinners);
  out.machine = machine(spinners);
  out.power = power(spinners);
  out.academy = academy(spinners);
  if (level === 4) {
    out.solar = smallLab('solar', { ry: -Math.PI / 2, base: 0xfff3bf, wall: 0xfab005, roof: 0xe67700, edge: 0xf59f00 }, solarTop, '☀')(spinners);
    out.magnet = smallLab('magnet', { ry: Math.PI / 2, base: 0xf3d9fa, wall: 0xae3ec9, roof: 0x862e9c, edge: 0x9c36b5 }, magnetTop, '🧲')(spinners);
  }
  out.vault = vault(spinners);
  out.workshop = workshop(spinners);
  return { sites: out, spinners };
}

export { site };
