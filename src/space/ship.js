// Chapter 4 - the hero ship, with her in it.
//
// A friendly toon spaceplane: cream hull, orange accents, dark belly and
// engine, navy solar cells. It is on screen for the whole chapter, so it is
// built to read at a glance from the chase camera: a big bubble canopy with
// the player's own girl sitting high in it, a racing stripe, twin canted tail
// fins that leave the view of the cockpit clear, and chunky moving parts.
//
// SCALE. Built at surface scale: 1 unit = 1 metre, nose toward -Z, up +Y,
// about SHIP.modelLength long (nose tip z = -4.0, engine lip z = +4.15).
// The integrator scales `group` by SHIP.flightScale in flight.
//
// HOW IT IS DRAWN (draw calls are budgeted):
//   - Every opaque cream/orange/dark part - the static hull AND every moving
//     part (wings, door, ladder, legs, claw, solar booms) - is ONE BatchedMesh
//     with one shared toon material. Moving parts are instances whose
//     matrices come from a small, detached Object3D "rig" that is posed each
//     frame. A second BatchedMesh with the same geometry is the ink outline.
//   - The solar panels (base pair + three Juno-style arrays of four) are one
//     InstancedMesh, plus its outline.
//   - Glass canopy, cockpit screens, the girl (+ her outline), and the FX in
//     shipFx.js.
//
// OUTLINES. Inverted hulls, but pushed along a WELDED normal (the average of
// every normal at a position) so hard-edged parts do not crack open at their
// corners, and in view space with a pixel cap, so the ink stays a steady
// ~2 px from the chase camera without turning into felt-tip in close-ups.
//
// Conventions for the integrator:
//   setThrottle(+1) main engine forward (plume out of the back, +Z);
//               (-1) reverse (small forward-facing thrusters in the nose).
//   setTurn(+1) = nose swinging toward +X (starboard): a RIGHT turn as seen
//               from the chase camera, i.e. NEGATIVE rotation about +Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildGirlRig, defaultChoices } from '../character/girl.js';
import { loadLook, loadProfile } from '../launcher/profile.js';
import { toonRamp } from '../game/toonPipeline.js';
import { SHIP_PALETTE, INK } from './contracts.js';
import { createShipFx } from './shipFx.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
/** Map t into a sub-window [a,b] of an animation, clamped to 0..1. */
const win = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

// --- the hull's shape ---------------------------------------------------------
// The fuselage is a loft of superellipse cross-sections. Each station gives the
// half-width, the height above and depth below the centre line, and the
// centre line's height. Nose and tail are closed off by an elliptical factor so
// the nose is round and blunt (friendly), not a pencil point.

export const Z_NOSE = -4.0;
export const Z_TAIL = 3.45;
const HULL_LEN = Z_TAIL - Z_NOSE;
/** Ground level (ship-local y) when the landing legs are down. */
export const GROUND_Y = -1.9;

const W_T = [[-4.0, 0.84], [-2.6, 0.96], [-1.0, 1.04], [0.8, 1.04], [2.2, 0.92], [3.45, 0.74]];
const HT_T = [[-4.0, 0.54], [-2.6, 0.68], [-1.0, 0.80], [0.8, 0.86], [2.2, 0.79], [3.45, 0.62]];
const HB_T = [[-4.0, 0.52], [-2.6, 0.63], [-1.0, 0.74], [0.8, 0.76], [2.2, 0.71], [3.45, 0.58]];
const YC_T = [[-4.0, -0.20], [-2.6, -0.10], [-1.0, -0.02], [3.45, 0.04]];
const N_TOP = 2.3;  // superellipse exponent above the centre line (rounder)
const N_BOT = 3.0;  // below it (a flatter, shuttle-like belly)

function tab(table, z) {
  if (z <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (z >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    if (z <= table[i][0]) {
      const [z0, v0] = table[i - 1];
      const [z1, v1] = table[i];
      return v0 + (v1 - v0) * smooth((z - z0) / (z1 - z0));
    }
  }
  return last[1];
}

function closure(z) {
  const sn = clamp01((z - Z_NOSE) / 1.9);
  const st = clamp01((Z_TAIL - z) / 0.55);
  return Math.sqrt(1 - (1 - sn) * (1 - sn)) * Math.sqrt(1 - (1 - st) * (1 - st));
}

function dims(z, inflate = 0) {
  const k = closure(z);
  return {
    w: tab(W_T, z) * k + inflate,
    ht: tab(HT_T, z) * k + inflate,
    hb: tab(HB_T, z) * k + inflate,
    yc: tab(YC_T, z),
  };
}

/**
 * A point on the hull. phi runs round the body: 0 = bottom, PI/2 = port (-X),
 * PI = top, 3PI/2 = starboard (+X).
 */
function hullPoint(z, phi, inflate = 0, out = new THREE.Vector3()) {
  const d = dims(z, inflate);
  const s = -Math.sin(phi);
  const c = -Math.cos(phi);
  const up = c > 0;
  const ex = 2 / (up ? N_TOP : N_BOT);
  const x = d.w * Math.sign(s) * Math.pow(Math.abs(s), ex);
  const y = (up ? d.ht : d.hb) * Math.sign(c) * Math.pow(Math.abs(c), ex);
  return out.set(x, d.yc + y, z);
}

/** Height of the top of the hull at (x, z). */
function hullTopY(x, z) {
  const d = dims(z);
  const r = clamp01(Math.abs(x) / d.w);
  return d.yc + d.ht * Math.pow(1 - Math.pow(r, N_TOP), 1 / N_TOP);
}

// --- texture layout -----------------------------------------------------------
// The fuselage carries a painted texture (u = phi / TAU, v = along the body).
// Every other part is vertex-coloured and points its UVs at a white strip at
// the bottom of the same canvas, so ONE material serves the whole ship.
const TEX_W = 1024;
const TEX_HULL_H = 1024;
const TEX_H = 1088;
const V_SCALE = TEX_HULL_H / TEX_H;
const WHITE_V = 1064 / TEX_H;

// --- geometry helpers -----------------------------------------------------------

const _c = new THREE.Color();

function ensureIndexed(geo) {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return geo;
}

/** Keep only the attributes the batch needs, paint it, point UVs at white. */
function prep(geo, hex, { keepUV = false } = {}) {
  for (const k of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  if (!keepUV || !geo.attributes.uv) {
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = 0.5; uv[i * 2 + 1] = WHITE_V; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  _c.setHex(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.morphAttributes = {};
  return ensureIndexed(geo);
}

/** Apply a transform given as position / Euler / scale. */
function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

/**
 * The outline push direction: the average of every normal sharing a position.
 * Without it a box's outline splits open at each corner.
 */
function addOutlineNormals(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const acc = new Map();
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    keys[i] = k;
    let a = acc.get(k);
    if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

function merge(list) {
  const g = mergeGeometries(list, false);
  if (!g) throw new Error('ship: mergeGeometries failed (attribute mismatch)');
  return g;
}

/** Mirror across X (port <-> starboard), keeping faces outward. */
function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.index.needsUpdate = true;
  if (g.attributes.outlineNormal) g.deleteAttribute('outlineNormal');
  return g;
}

/** Extrude a planform drawn in (x, z) into a slab `thick` tall, centred on y = 0. */
function slab(shape, thick, bevel = 0.035, curveSegments = 10) {
  const depth = Math.max(0.001, thick - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments,
  });
  g.rotateX(Math.PI / 2);           // shape y -> world z, extrusion -> -y
  g.translate(0, depth / 2, 0);
  return g;
}

/** Extrude a profile drawn in (z, y) sideways into a fin `thick` wide, centred on x = 0. */
function fin(shape, thick, bevel = 0.03) {
  const depth = Math.max(0.001, thick - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  });
  g.rotateY(-Math.PI / 2);          // shape x -> world z, extrusion -> -x
  g.translate(depth / 2, 0, 0);
  return g;
}

/** A rounded-corner polygon as a Shape (radius r at every corner). */
function roundedPoly(pts, r) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(r, d0 * 0.45, d2 * 0.45);
    const a = [p1[0] + (p0[0] - p1[0]) * rr / d0, p1[1] + (p0[1] - p1[1]) * rr / d0];
    const b = [p1[0] + (p2[0] - p1[0]) * rr / d2, p1[1] + (p2[1] - p1[1]) * rr / d2];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

/** A lathe around +Z from (r, z) pairs, ordered tail-ward for outward normals. */
function latheZ(pairs, segs = 40) {
  const g = new THREE.LatheGeometry(pairs.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2);          // lathe axis Y -> +Z
  return g;
}

function cylZ(r0, r1, len, segs = 20, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, 1, open);
  g.rotateX(Math.PI / 2);           // +Y -> +Z; r0 at the -Z end
  return g;
}

// --- the fuselage ---------------------------------------------------------------

function fuselageZs() {
  const zs = [];
  const noseEnd = Z_NOSE + 1.9;
  for (let i = 0; i <= 22; i++) zs.push(Z_NOSE + 1.9 * (1 - Math.cos((i / 22) * Math.PI / 2)));
  const tailStart = Z_TAIL - 0.55;
  for (let i = 1; i <= 44; i++) zs.push(noseEnd + (tailStart - noseEnd) * (i / 44));
  for (let i = 1; i <= 12; i++) zs.push(tailStart + 0.55 * Math.sin((i / 12) * Math.PI / 2));
  return zs;
}

/** Loft a (partial) hull surface. Full loops get the seam's normals averaged. */
function hullSurface({ zs, phi0 = 0, phi1 = TAU, segs = 64, inflate = 0 }) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    const inf = typeof inflate === 'function' ? inflate(z) : inflate;
    for (let j = 0; j <= segs; j++) {
      const phi = phi0 + (phi1 - phi0) * (j / segs);
      hullPoint(z, phi, inf, p);
      pos.push(p.x, p.y, p.z);
      uvs.push(phi / TAU, ((z - Z_NOSE) / HULL_LEN) * V_SCALE);
    }
  }
  const row = segs + 1;
  for (let i = 0; i < zs.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * row + j, b = (i + 1) * row + j, c = i * row + j + 1, d = (i + 1) * row + j + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (phi1 - phi0 >= TAU - 1e-6) {
    const n = g.attributes.normal;
    for (let i = 0; i < zs.length; i++) {
      const a = i * row, b = i * row + segs;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l);
      n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}

// --- painting ---------------------------------------------------------------------

const hexCss = (h) => `#${h.toString(16).padStart(6, '0')}`;

function paintHull(name) {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const g = c.getContext('2d');
  const X = (u) => u * TEX_W;
  const Y = (z) => ((z - Z_NOSE) / HULL_LEN) * TEX_HULL_H;
  const U = (phi) => phi / TAU;
  const CREAM = hexCss(SHIP_PALETTE.hull);
  const ORANGE = hexCss(SHIP_PALETTE.accent);
  const DARK = hexCss(SHIP_PALETTE.dark);

  g.fillStyle = CREAM;
  g.fillRect(0, 0, TEX_W, TEX_H);

  // Soft panel lines, drawn first so the belly and stripes overpaint them.
  g.fillStyle = '#d9d2c4';
  for (const z of [-2.55, 0.95, 2.45]) g.fillRect(0, Y(z) - 1.5, TEX_W, 3);
  g.fillRect(X(0.5) - 1.5, Y(-0.2), 3, Y(2.9) - Y(-0.2));

  // Dark belly (the shuttle's heat shield), rising into a chin at the nose.
  const bellyU = (z) => 0.165 + 0.03 * smooth(clamp01((-2.3 - z) / 1.5));
  g.fillStyle = DARK;
  for (const side of [0, 1]) {
    g.beginPath();
    g.moveTo(side ? TEX_W : 0, 0);
    for (let z = Z_NOSE; z <= Z_TAIL + 1e-6; z += 0.05) {
      const u = bellyU(z);
      g.lineTo(X(side ? 1 - u : u), Y(z));
    }
    g.lineTo(side ? TEX_W : 0, TEX_HULL_H);
    g.closePath();
    g.fill();
  }
  // Heat-tile grid, faint.
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.lineWidth = 2;
  for (let x = 0; x <= X(0.2); x += 22) {
    for (const xx of [x, TEX_W - x]) { g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx, TEX_HULL_H); g.stroke(); }
  }
  for (let y = 0; y < TEX_HULL_H; y += 22) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(X(0.19), y); g.stroke();
    g.beginPath(); g.moveTo(X(0.81), y); g.lineTo(TEX_W, y); g.stroke();
  }
  // Thin orange pinline where belly meets hull.
  g.strokeStyle = ORANGE;
  g.lineWidth = 5;
  for (const side of [0, 1]) {
    g.beginPath();
    for (let z = -3.7; z <= 3.0; z += 0.05) {
      const u = bellyU(z) + 0.006;
      const x = X(side ? 1 - u : u);
      if (z === -3.7) g.moveTo(x, Y(z)); else g.lineTo(x, Y(z));
    }
    g.stroke();
  }

  // The racing stripe: along each flank above the waist, a swoosh that
  // widens toward the tail and ends in a point.
  const stripeLo = (z) => 0.262 - 0.004 * smooth(clamp01((z + 1) / 3));
  const stripeW = (z) => 0.012 + 0.036 * smooth(clamp01((z + 2.6) / 5.0));
  g.fillStyle = ORANGE;
  for (const side of [0, 1]) {
    const m = (u) => X(side ? 1 - u : u);
    g.beginPath();
    const z0 = -3.35, z1 = 2.75;
    g.moveTo(m(stripeLo(z0) + stripeW(z0) * 0.5), Y(z0 - 0.15));
    for (let z = z0; z <= z1; z += 0.05) g.lineTo(m(stripeLo(z)), Y(z));
    g.lineTo(m(stripeLo(z1) + stripeW(z1) * 0.9), Y(z1 + 0.35));
    for (let z = z1; z >= z0; z -= 0.05) g.lineTo(m(stripeLo(z) + stripeW(z)), Y(z));
    g.closePath();
    g.fill();
  }

  // Nose cap.
  g.fillStyle = ORANGE;
  g.fillRect(0, 0, TEX_W, Y(-3.8));
  g.fillStyle = CREAM;
  g.fillRect(0, Y(-3.8), TEX_W, 5);

  // Tail: orange band, then dark where the engine housing starts.
  g.fillStyle = ORANGE;
  g.fillRect(0, Y(2.9), TEX_W, Y(3.08) - Y(2.9));
  g.fillStyle = DARK;
  g.fillRect(0, Y(3.2), TEX_W, TEX_HULL_H - Y(3.2));

  // Cockpit tub under the canopy.
  g.fillStyle = '#4a5572';
  g.beginPath();
  g.ellipse(X(0.5), Y(CANOPY.z + 0.06), 158, Y(CANOPY.z + 1.4) - Y(CANOPY.z + 0.06), 0, 0, TAU);
  g.fill();

  // The hatch opening (hidden while the door is shut), port side.
  g.fillStyle = '#141a26';
  roundRect(g, X(U(HATCH.phiC)) - 60, Y(HATCH.zC - HATCH.halfZ + 0.05), 120, Y(HATCH.zC + HATCH.halfZ - 0.05) - Y(HATCH.zC - HATCH.halfZ + 0.05), 22);
  g.fill();

  // RCS thruster ports: nose and tail, both flanks.
  g.fillStyle = '#20283a';
  for (const u of [0.25, 0.75]) {
    for (const z of [RCS_Z.nose, RCS_Z.tail]) {
      roundRect(g, X(u) - 13, Y(z) - 11, 26, 22, 5);
      g.fill();
    }
  }

  // Mission patch on each side of the nose: an orange disc, a cream star.
  for (const [u, rot] of [[0.335, Math.PI / 2], [0.665, -Math.PI / 2]]) {
    const cx = X(u), cy = Y(-2.95);
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.fillStyle = ORANGE;
    g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
    g.fillStyle = CREAM;
    star(g, 0, 0, 16, 7);
    g.restore();
  }

  // Her name along the upper flanks, reading nose-to-tail from either side.
  const label = (name || 'EXPLORER').toUpperCase().slice(0, 12);
  for (const [u, rot] of [[0.352, Math.PI / 2], [0.648, -Math.PI / 2]]) {
    const cx = X(u), cy = Y(1.25);
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    let size = 58;
    g.font = `900 ${size}px "Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif`;
    const maxW = Y(2.45) - Y(0.05);
    const w = g.measureText(label).width;
    if (w > maxW) { size = Math.floor(size * maxW / w); g.font = `900 ${size}px "Trebuchet MS", Arial, sans-serif`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = CREAM;
    g.strokeText(label, 0, 0);
    g.fillStyle = hexCss(SHIP_PALETTE.solar);
    g.fillText(label, 0, 0);
    g.restore();
  }

  // White strip for every vertex-coloured part.
  g.fillStyle = '#ffffff';
  g.fillRect(0, TEX_HULL_H + 8, TEX_W, TEX_H - TEX_HULL_H - 8);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g, x, y, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
}

function paintSolarCells() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ced8';               // silver frame
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = hexCss(SHIP_PALETTE.solar);
  g.fillRect(10, 10, 236, 236);
  // Cells: a 6 x 5 grid with thin light gaps and a faint diagonal sheen.
  const cols = 6, rows = 5;
  const cw = 236 / cols, ch = 236 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = 10 + i * cw, y = 10 + j * ch;
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, '#2a4fae');
      grad.addColorStop(1, '#17307a');
      g.fillStyle = grad;
      g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      g.fillStyle = 'rgba(160,190,255,0.35)';
      g.fillRect(x + 2, y + ch * 0.5 - 0.5, cw - 4, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// --- materials ----------------------------------------------------------------------

/** Shared across every outline material: the render target's pixel height. */
const OUTLINE_RES = { value: 900 };
const _v2 = new THREE.Vector2();

function trackResolution(renderer) {
  const rt = renderer.getRenderTarget();
  OUTLINE_RES.value = rt ? rt.height : renderer.getDrawingBufferSize(_v2).y;
}

/**
 * Ink outline for static, instanced and batched meshes. Pushed along the
 * welded `outlineNormal` in view space: `thickness` metres at ship scale,
 * but never more than `maxPx` pixels on screen.
 */
export function makeOutlineMaterial({ thickness = 0.03, maxPx = 2.6, color = INK } = {}) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutlineT = { value: thickness };
    sh.uniforms.uOutlinePx = { value: maxPx };
    sh.uniforms.uResY = OUTLINE_RES;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute vec3 outlineNormal;\nuniform float uOutlineT;\nuniform float uOutlinePx;\nuniform float uResY;\nvoid main() {')
      .replace('#include <project_vertex>', /* glsl */`
        vec4 mvPosition = vec4( transformed, 1.0 );
        vec3 oN = outlineNormal;
        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
          oN = mat3( batchingMatrix ) * oN;
        #endif
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          oN = mat3( instanceMatrix ) * oN;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        vec3 nV = normalize( mat3( modelViewMatrix ) * oN );
        float sc = length( modelMatrix[ 0 ].xyz );
        float depth = max( -mvPosition.z, 1e-4 );
        float pxPerUnit = projectionMatrix[ 1 ][ 1 ] * 0.5 * uResY / depth;
        float t = min( uOutlineT * sc, uOutlinePx / pxPerUnit );
        mvPosition.xyz += nV * t;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
  m.customProgramCacheKey = () => 'shipOutline';
  return m;
}

/**
 * The cel material: toon ramp, plus a crisp specular dot toward the Sun (a
 * glossy-toy read) and a cool rim band so the unlit side never vanishes into
 * black space.
 */
function makeToonMaterial({ map = null, vertexColors = true, spec = 0.4, rim = 0.35, rimAdd = 0, sheen = 0, sunView }) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, map, vertexColors, gradientMap: toonRamp });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSunView = sunView;
    sh.uniforms.uSpec = { value: spec };
    sh.uniforms.uRim = { value: rim };
    sh.uniforms.uSheen = { value: sheen };
    sh.uniforms.uRimAdd = { value: rimAdd };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uSunView;\nuniform float uSpec;\nuniform float uRim;\nuniform float uSheen;\nuniform float uRimAdd;\nvoid main() {')
      .replace('#include <opaque_fragment>', /* glsl */`
        {
          vec3 Vd = normalize( vViewPosition );
          float ndv = clamp( dot( normal, Vd ), 0.0, 1.0 );
          float ndl = dot( normal, uSunView );
          vec3 Hd = normalize( uSunView + Vd );
          float ndh = max( dot( normal, Hd ), 0.0 );
          float sp = smoothstep( 0.976, 0.983, ndh ) * step( 0.0, ndl );
          outgoingLight += vec3( 1.0, 0.97, 0.9 ) * sp * uSpec;
          float rimBand = smoothstep( 0.58, 0.64, 1.0 - ndv );
          outgoingLight += diffuseColor.rgb * vec3( 0.42, 0.6, 1.0 ) * rimBand * uRim * ( 0.35 + 0.65 * clamp( 0.3 - ndl, 0.0, 1.0 ) );
          // Back-light that does NOT depend on albedo, so black hair still
          // has an edge against black space.
          outgoingLight += vec3( 0.55, 0.72, 1.0 ) * smoothstep( 0.5, 0.62, 1.0 - ndv ) * uRimAdd;
          // Solar cells: a broad metallic glint when they face the Sun.
          // Clamped, and tinted cell-blue, so a panel square to the Sun reads
          // as "shiny navy" and never washes out to white.
          float glint = pow( ndh, 40.0 ) * 0.5 + smoothstep( 0.2, 1.0, ndl ) * 0.1;
          outgoingLight += vec3( 0.28, 0.42, 0.9 ) * min( glint, 0.3 ) * uSheen;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'shipToon';
  return m;
}

function makeGlassMaterial(sunView) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunView: sunView,
      uTint: { value: new THREE.Color(SHIP_PALETTE.glass) },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vObjN;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vV = -mv.xyz;
        vObjN = normal;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSunView;
      uniform vec3 uTint;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vObjN;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 N = normalize( vN );
        vec3 V = normalize( vV );
        float ndv = clamp( dot( N, V ), 0.0, 1.0 );
        vec3 H = normalize( uSunView + V );
        float ndh = max( dot( N, H ), 0.0 );
        float spec = smoothstep( 0.982, 0.99, ndh );
        float specSoft = pow( ndh, 400.0 ) * 0.2;
        // Cartoon window shine: two crescents hugging the upper-left rim in
        // SCREEN terms (view-space normal), so they never sit over her face.
        float dd = dot( N.xy, normalize( vec2( -0.62, 0.78 ) ) );
        float band = smoothstep( 0.62, 0.66, dd ) * ( 1.0 - smoothstep( 0.76, 0.80, dd ) );
        float band2 = smoothstep( 0.84, 0.86, dd ) * ( 1.0 - smoothstep( 0.9, 0.92, dd ) );
        float rimOnly = 1.0 - smoothstep( 0.55, 0.75, ndv );
        band *= rimOnly;
        band2 *= rimOnly;
        vec3 R = reflect( -V, N );
        float env = smoothstep( -0.2, 0.9, R.y ) * 0.08;
        float f2 = pow( 1.0 - ndv, 4.0 );
        vec3 col = uTint * ( 0.35 + f2 * 1.2 ) + vec3( env )
          + vec3( 1.0 ) * ( band * 0.55 + band2 * 0.5 )
          + vec3( 1.0, 0.96, 0.88 ) * ( spec * 0.8 + specSoft * 0.5 );
        float a = clamp( 0.04 + f2 * 0.55 + band * 0.35 + band2 * 0.35 + spec * 0.5 + specSoft * 0.25, 0.0, 0.9 );
        gl_FragColor = vec4( col, a );
      }`,
    transparent: true,
    depthWrite: false,
  });
}

// --- fixed layout -------------------------------------------------------------------

/** The hatch: port side, under the front of the cockpit, clear of the wing glove (which starts at z ~ -1.0). */
const HATCH = { zC: -1.98, halfZ: 0.42, phiC: Math.PI / 2 + 0.02, phiLo: Math.PI / 2 - 0.46, phiHi: Math.PI / 2 + 0.5 };
const HATCH_OPEN = 1.72;          // door rotation when open (rad), a level-ish platform
const LADDER_LEN = 1.42;
const LADDER_LEAN = 0.2;          // ladder leans out from vertical by this much (rad)
const RCS_Z = { nose: -2.85, tail: 2.62 };
const CANOPY = { x: 0, y: 0.82, z: -0.86, rx: 0.8, ry: 1.06, rzFront: 1.12, rzBack: 1.34 };
const SEAT = { hipsY: 0.62, hipsZ: -0.62 };
const CONSOLE = { y: 0.76, z: -1.6, tilt: 0.35 };
const GIRL_HEIGHT = 1.3 * 1.4;    // "hero scale": 40% bigger than in Chapter 3 (reads from the chase camera)

const WING_PIVOT = new THREE.Vector3(1.38, -0.24, -0.3);
const WING_SCALE = [1.16, 1, 1.08];   // span, thickness, chord
const WING_SWEEP = THREE.MathUtils.degToRad(62);
const WING_DIHEDRAL = THREE.MathUtils.degToRad(4);
const WING_TUCK = THREE.MathUtils.degToRad(16);

const SOLAR_Z = 1.95;
const SOLAR_ANGLES = [THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(150), THREE.MathUtils.degToRad(270)];
const PANEL = { len: 1.2, wid: 1.12, thick: 0.05, gap: 0.066, count: 4 };
const BOOM_LEN = 0.55;

// --- parts --------------------------------------------------------------------------

function buildStaticHull() {
  const C = SHIP_PALETTE;
  const parts = [];

  // Fuselage, painted by texture.
  const fus = hullSurface({ zs: fuselageZs(), segs: 72 });
  parts.push(prep(fus, 0xffffff, { keepUV: true }));

  // Wing gloves: the fixed shoulders the swing-wings pivot in.
  for (const side of [1, -1]) {
    const glove = slab(roundedPoly([[0.5, -1.45], [1.13, -0.85], [1.6, -0.2], [1.64, 0.95], [1.3, 1.85], [0.5, 2.35]], 0.22), 0.34, 0.06);
    place(glove, 0, WING_PIVOT.y, 0);
    let g = prep(glove, C.hull);
    if (side < 0) g = mirrorX(g);
    parts.push(g);
    // Orange cap on the glove's leading edge.
    const cap = slab(roundedPoly([[0.78, -1.2], [1.13, -0.85], [1.48, -0.38], [1.26, -0.3], [0.7, -0.9]], 0.08), 0.36, 0.05);
    place(cap, 0, WING_PIVOT.y, 0);
    let gc = prep(cap, C.accent);
    if (side < 0) gc = mirrorX(gc);
    parts.push(gc);
  }

  // Twin tail fins, canted outward so the view over the cockpit stays clear.
  const finShape = roundedPoly([[1.55, -0.05], [3.3, -0.05], [3.62, 1.02], [3.08, 1.1]], 0.16);
  for (const side of [1, -1]) {
    const f = fin(finShape, 0.13, 0.04);
    const baseY = hullTopY(0.45, 2.5) - 0.12;
    place(f, 0, 0, 0, 0, 0, -side * 0.34);
    place(f, side * 0.45, baseY, 0);
    parts.push(prep(f, C.accent));
    // Cream tip cap with a dark rim, a little toy-like bulb.
    const tip = new THREE.CapsuleGeometry(0.075, 0.5, 4, 12);
    tip.rotateX(Math.PI / 2);
    place(tip, 0, 1.08, 3.33);
    place(tip, 0, 0, 0, 0, 0, -side * 0.34);
    place(tip, side * 0.45, baseY, 0);
    parts.push(prep(tip, C.hull));
  }

  // Engine: an orange collar, then the dark bell with a proper lip.
  const collar = new THREE.TorusGeometry(0.54, 0.075, 12, 40);
  place(collar, 0, 0.02, 3.2);
  parts.push(prep(collar, C.accent));
  const bell = latheZ([[0.44, 3.05], [0.47, 3.3], [0.56, 3.62], [0.7, 3.95], [0.8, 4.12], [0.82, 4.15],
    [0.76, 4.16], [0.7, 4.1], [0.58, 3.8], [0.44, 3.5], [0.34, 3.3], [0.0, 3.3]].map(([r, z]) => [r, z]), 40);
  place(bell, 0, 0.02, 0);
  parts.push(prep(bell, C.dark));
  const lip = new THREE.TorusGeometry(0.8, 0.035, 8, 40);
  place(lip, 0, 0.02, 4.13);
  parts.push(prep(lip, C.accent));

  // Cockpit: coaming ring (follows the hull), console, stick, seat.
  const ring = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU;
    const x = Math.cos(a) * CANOPY.rx * 0.985;
    const dz = Math.sin(a) * (Math.sin(a) > 0 ? CANOPY.rzBack : CANOPY.rzFront) * 0.985;
    const z = CANOPY.z + dz;
    ring.push(new THREE.Vector3(x, Math.max(hullTopY(x, z), CANOPY.y - 0.12) + 0.01, z));
  }
  const coaming = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 96, 0.055, 8, true);
  parts.push(prep(coaming, C.accent));

  const console_ = new THREE.BoxGeometry(0.86, 0.2, 0.36, 2, 1, 1);
  place(console_, 0, CONSOLE.y, CONSOLE.z, CONSOLE.tilt);
  parts.push(prep(console_, 0x2a3244));
  const stick = cylZ(0.022, 0.022, 0.28, 8);
  place(stick, 0.16, 0.78, -1.3, Math.PI / 2 - 0.35);
  parts.push(prep(stick, 0x2a3244));
  const knob = new THREE.SphereGeometry(0.045, 10, 8);
  place(knob, 0.16, 0.92, -1.35);
  parts.push(prep(knob, C.accent));
  const lever = new THREE.BoxGeometry(0.06, 0.06, 0.2);
  place(lever, -0.3, 0.86, -1.36, 0.4);
  parts.push(prep(lever, C.accent));
  // A low seat back, well below her head so the chase camera still sees her.
  const seat = new THREE.CapsuleGeometry(0.2, 0.1, 4, 14);
  place(seat, 0, 0, 0, 0, 0, 0, 1, 1, 0.38);
  place(seat, 0, SEAT.hipsY + 0.1, SEAT.hipsZ + 0.2, 0.12);
  parts.push(prep(seat, C.accent));

  // Claw housing under the nose.
  const housing = new THREE.CapsuleGeometry(0.17, 0.55, 4, 14);
  housing.rotateX(Math.PI / 2);
  place(housing, 0, -0.62, -2.45);
  parts.push(prep(housing, C.dark));

  // Reverse-thrust nozzles either side of the nose, facing forward.
  for (const side of [1, -1]) {
    const noz = cylZ(0.1, 0.075, 0.34, 14, false);
    place(noz, side * 0.5, -0.22, -3.18);
    parts.push(prep(noz, C.dark));
    const ringN = new THREE.TorusGeometry(0.1, 0.022, 6, 16);
    place(ringN, side * 0.5, -0.22, -3.35);
    parts.push(prep(ringN, C.accent));
  }

  // Dorsal strobe mast and a tiny antenna with a ball on top (for charm).
  const mast = cylZ(0.035, 0.035, 0.34, 8);
  place(mast, 0, hullTopY(0, 2.2) + 0.12, 2.2, Math.PI / 2);
  parts.push(prep(mast, C.dark));
  const ball = new THREE.SphereGeometry(0.06, 10, 8);
  place(ball, 0, hullTopY(0, 2.2) + 0.3, 2.2);
  parts.push(prep(ball, C.hull));
  const ant = cylZ(0.012, 0.012, 0.5, 6);
  place(ant, 0, 0, 0, Math.PI / 2 + 0.35);
  place(ant, -0.28, hullTopY(-0.28, -3.0) + 0.22, -2.9);
  parts.push(prep(ant, C.dark));
  const antBall = new THREE.SphereGeometry(0.045, 10, 8);
  place(antBall, -0.28, hullTopY(-0.28, -3.0) + 0.46, -2.82);
  parts.push(prep(antBall, C.accent));


  // Landing-leg knuckles (the legs hinge here).
  for (const lp of LEG_PIVOTS) {
    const k = new THREE.SphereGeometry(0.12, 12, 8);
    place(k, lp.pos.x, lp.pos.y + 0.03, lp.pos.z);
    parts.push(prep(k, C.dark));
  }

  const g = merge(parts);
  return addOutlineNormals(g);
}

// Tripod. stowX is the strut's X rotation when retracted: the nose leg folds
// aft, the main legs fold forward, so none of them fight the claw housing or
// the belly solar array. Pivot heights are set so all three feet meet GROUND_Y.
const LEG_PIVOTS = [
  { pos: new THREE.Vector3(0, -0.571, -1.75), stowX: -(Math.PI / 2 - 0.08), splay: 0 },
  { pos: new THREE.Vector3(0.62, -0.62, 1.0), stowX: Math.PI / 2 - 0.1, splay: 0.28 },
  { pos: new THREE.Vector3(-0.62, -0.62, 1.0), stowX: Math.PI / 2 - 0.1, splay: -0.28 },
];
const LEG_LEN = 1.25;

function buildWingGeometry() {
  const C = SHIP_PALETTE;
  // Planform in the wing's own frame: pivot at the origin, span +x, chord +z.
  const LE = (x) => -0.05 + (x + 0.3) * 0.346;
  const TE = (x) => 1.25 + (x + 0.3) * 0.053;
  const split = 1.25;
  const inner = slab(roundedPoly([[-0.3, LE(-0.3)], [split, LE(split)], [split, TE(split)], [-0.3, TE(-0.3)]], 0.02), 0.15, 0.035);
  const outer = slab(roundedPoly([[split + 0.005, LE(split)], [2.18, LE(2.18)], [2.3, 1.02], [2.25, 1.37], [split + 0.005, TE(split)]], 0.12), 0.13, 0.035);
  const parts = [prep(inner, C.hull), prep(outer, C.accent)];
  // Tip pod, winglet and the nav bulb.
  const pod = new THREE.CapsuleGeometry(0.1, 0.72, 4, 14);
  pod.rotateX(Math.PI / 2);
  place(pod, 2.34, 0.0, 1.02);
  parts.push(prep(pod, C.hull));
  const wl = fin(roundedPoly([[0.62, 0], [1.35, 0], [1.5, 0.5], [1.2, 0.55]], 0.08), 0.07, 0.025);
  place(wl, 2.34, 0.04, 0);
  parts.push(prep(wl, C.accent));
  const bulb = new THREE.SphereGeometry(0.075, 10, 8);
  place(bulb, 2.34, 0, 0.6);
  parts.push(prep(bulb, 0xffffff));
  const g = merge(parts);
  g.scale(...WING_SCALE);
  return g;
}

function buildDoorGeometry() {
  // A squircle-shaped slab that follows the hull's curve, built in ship space.
  const N = 14;
  const P = 5;
  const front = [], back = [];
  const halfPhi = (HATCH.phiHi - HATCH.phiLo) / 2;
  const phiMid = (HATCH.phiHi + HATCH.phiLo) / 2;
  const at = (a, b, inflate) => {
    const r = Math.max(Math.abs(a), Math.abs(b));
    let qa = 0, qb = 0;
    if (r > 1e-6) {
      const np = Math.pow(Math.pow(Math.abs(a), P) + Math.pow(Math.abs(b), P), 1 / P);
      qa = (a * r) / np; qb = (b * r) / np;
    }
    return hullPoint(HATCH.zC + qa * HATCH.halfZ, phiMid + qb * halfPhi, inflate);
  };
  const pos = [], idx = [], col = [];
  const cream = new THREE.Color(SHIP_PALETTE.hull), orange = new THREE.Color(SHIP_PALETTE.accent);
  const push = (v, c) => { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  // front (outward) and back grids
  const grid = (inflate, flip, c) => {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) push(at(-1 + (2 * i) / N, -1 + (2 * j) / N, inflate), c);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = base + i * (N + 1) + j, b = base + (i + 1) * (N + 1) + j, cc = a + 1, d = b + 1;
      // i runs along +z, j along +phi (toward the top on the port side)
      if (!flip) idx.push(a, b, cc, b, d, cc); else idx.push(a, cc, b, b, cc, d);
    }
    return base;
  };
  grid(0.05, false, cream);
  grid(-0.02, true, cream);
  // rim: walk the boundary of the grid
  const ring = [];
  for (let i = 0; i < N; i++) ring.push([i, 0]);
  for (let j = 0; j < N; j++) ring.push([N, j]);
  for (let i = N; i > 0; i--) ring.push([i, N]);
  for (let j = N; j > 0; j--) ring.push([0, j]);
  const rimBase = pos.length / 3;
  for (const [i, j] of ring) {
    push(at(-1 + (2 * i) / N, -1 + (2 * j) / N, 0.05), orange);
    push(at(-1 + (2 * i) / N, -1 + (2 * j) / N, -0.02), orange);
  }
  for (let k = 0; k < ring.length; k++) {
    const a = rimBase + k * 2, b = a + 1, c = rimBase + ((k + 1) % ring.length) * 2, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Fix winding if the front came out facing in (depends on phi direction).
  const n0 = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, Math.floor((N + 1) * (N + 1) / 2));
  if (n0.x > 0) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    g.computeVertexNormals();
  }
  const uv = new Float32Array(g.attributes.position.count * 2);
  for (let i = 0; i < uv.length; i += 2) { uv[i] = 0.5; uv[i + 1] = WHITE_V; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Porthole: an orange ring with a dark glass disc.
  const cz = HATCH.zC, cphi = phiMid + 0.18;
  const pc = hullPoint(cz, cphi, 0.05);
  const pn = hullPoint(cz, cphi, 0.15).sub(pc).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pn);
  const pr = new THREE.TorusGeometry(0.13, 0.03, 8, 24);
  pr.applyQuaternion(q); pr.translate(pc.x, pc.y, pc.z);
  const pg = new THREE.CircleGeometry(0.12, 20);
  pg.applyQuaternion(q); pg.translate(pc.x + pn.x * -0.005, pc.y + pn.y * -0.005, pc.z + pn.z * -0.005);
  return merge([g, prep(pr, SHIP_PALETTE.accent), prep(pg, 0x22314a)]);
}

function buildLadderGeometry() {
  const parts = [];
  for (const s of [1, -1]) {
    const rail = new THREE.BoxGeometry(0.05, LADDER_LEN, 0.05);
    place(rail, 0, -LADDER_LEN / 2, s * 0.24);
    parts.push(prep(rail, SHIP_PALETTE.accent));
  }
  for (let i = 0; i < 6; i++) {
    const rung = cylZ(0.022, 0.022, 0.48, 8);
    place(rung, 0, -0.14 - i * 0.24, 0);
    parts.push(prep(rung, 0x3a4458));
  }
  const foot = new THREE.BoxGeometry(0.1, 0.05, 0.62);
  place(foot, 0, -LADDER_LEN, 0);
  parts.push(prep(foot, SHIP_PALETTE.dark));
  return merge(parts);
}

function buildLegStrutGeometry() {
  const C = SHIP_PALETTE;
  const parts = [];
  const upper = new THREE.CylinderGeometry(0.085, 0.1, 0.62, 14);
  place(upper, 0, -0.31, 0);
  parts.push(prep(upper, C.dark));
  const band = new THREE.CylinderGeometry(0.105, 0.105, 0.08, 14);
  place(band, 0, -0.5, 0);
  parts.push(prep(band, C.accent));
  const lower = new THREE.CylinderGeometry(0.055, 0.055, 0.7, 12);
  place(lower, 0, -0.62 - 0.35 + 0.05, 0);
  parts.push(prep(lower, 0xc9ced8));
  const ankle = new THREE.SphereGeometry(0.075, 10, 8);
  place(ankle, 0, -LEG_LEN, 0);
  parts.push(prep(ankle, C.dark));
  return merge(parts);
}

function buildFootGeometry() {
  const pad = new THREE.CylinderGeometry(0.2, 0.24, 0.08, 20);
  place(pad, 0, -0.04, 0);
  const cap = new THREE.CylinderGeometry(0.1, 0.16, 0.05, 16);
  place(cap, 0, 0.015, 0);
  return merge([prep(pad, SHIP_PALETTE.accent), prep(cap, SHIP_PALETTE.dark)]);
}

function buildClawGeometries() {
  const C = SHIP_PALETTE;
  const arm1 = merge([
    prep(place(cylZ(0.1, 0.09, 0.9, 14), 0, 0, -0.45), C.hull),
    prep(place(new THREE.TorusGeometry(0.1, 0.028, 8, 18), 0, 0, -0.84), C.accent),
  ]);
  const arm2 = prep(place(cylZ(0.065, 0.065, 0.9, 12), 0, 0, -0.45), 0xc9ced8);
  const head = merge([
    prep(place(new THREE.SphereGeometry(0.16, 16, 10), 0, 0, 0.02, 0, 0, 0, 1, 1, 0.8), C.accent),
    prep(place(cylZ(0.15, 0.13, 0.12, 16), 0, 0, -0.1), C.dark),
  ]);
  // A finger: a curved hook, built along +x in its hinge frame, reaching -z.
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0, -0.2), new THREE.Vector3(0.02, 0, -0.44));
  const finger = merge([
    prep(new THREE.TubeGeometry(curve, 10, 0.036, 8, false), C.hull),
    prep(place(new THREE.SphereGeometry(0.048, 10, 8), 0.02, 0, -0.44), C.accent),
    prep(place(new THREE.SphereGeometry(0.045, 10, 8), 0, 0, 0), C.dark),
  ]);
  return { arm1, arm2, head, finger };
}

function buildSolarGeometries() {
  const C = SHIP_PALETTE;
  // Collar ring around the hull where the three arrays mount.
  // hullSurface calls `inflate` once per ring, in order.
  const zs = [SOLAR_Z - 0.16, SOLAR_Z - 0.16, SOLAR_Z + 0.16, SOLAR_Z + 0.16];
  const infl = [-0.02, 0.07, 0.07, -0.02];
  let ringI = 0;
  const collar2 = hullSurface({ zs, segs: 64, inflate: () => infl[ringI++] });
  const boom = merge([
    prep(place(new THREE.BoxGeometry(0.22, 0.2, 0.26), 0.05, 0, 0), C.dark),
    prep(place(cylZ(0.05, 0.05, BOOM_LEN, 10), BOOM_LEN / 2, 0, 0, 0, Math.PI / 2, 0), 0xc9ced8),
    prep(place(new THREE.BoxGeometry(0.08, 1.0, 0.08), BOOM_LEN, 0, 0), C.accent),
  ]);
  return { collar: prep(collar2, C.dark), boom };
}

function buildPanelGeometry() {
  // Spans x in [0, len], centred in y (width) and z (thickness).
  const g = new THREE.BoxGeometry(PANEL.len, PANEL.wid, PANEL.thick);
  g.translate(PANEL.len / 2, 0, 0);
  return addOutlineNormals(g);
}

// --- the batch --------------------------------------------------------------------

/**
 * Rigid parts that share one material, drawn as ONE BatchedMesh (+ outline).
 * Each part is (geometry, rig node). sync() copies node matrices across.
 */
class PartBatch {
  constructor(material, outlineMaterial) {
    this.material = material;
    this.outlineMaterial = outlineMaterial;
    this.entries = [];
    this.geos = new Map();
  }

  add(geo, node) {
    if (!geo.attributes.outlineNormal) addOutlineNormals(geo);
    this.entries.push({ geo, node, id: -1 });
    return node;
  }

  build() {
    const uniq = [...new Set(this.entries.map((e) => e.geo))];
    let v = 0, i = 0;
    for (const g of uniq) { v += g.attributes.position.count; i += g.index.count; }
    const make = (mat) => {
      const m = new THREE.BatchedMesh(this.entries.length, v, i, mat);
      m.frustumCulled = false;
      m.perObjectFrustumCulled = false;
      m.sortObjects = false;
      const ids = new Map();
      for (const g of uniq) ids.set(g, m.addGeometry(g));
      return { m, ids };
    };
    const a = make(this.material);
    const b = make(this.outlineMaterial);
    this.mesh = a.m;
    this.outline = b.m;
    this.outline.castShadow = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    for (const e of this.entries) {
      e.id = this.mesh.addInstance(a.ids.get(e.geo));
      e.oid = this.outline.addInstance(b.ids.get(e.geo));
    }
    // The batch copies geometry into its own buffers; the sources can go.
    for (const g of uniq) g.dispose();
  }

  sync() {
    for (const e of this.entries) {
      const vis = isShown(e.node);
      this.mesh.setVisibleAt(e.id, vis);
      this.outline.setVisibleAt(e.oid, vis);
      if (!vis) continue;
      this.mesh.setMatrixAt(e.id, e.node.matrixWorld);
      this.outline.setMatrixAt(e.oid, e.node.matrixWorld);
    }
  }
}

function isShown(node) {
  for (let n = node; n; n = n.parent) if (!n.visible) return false;
  return true;
}

// --- createShip -------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {object} [opts.look]  girl choices; default = the saved look
 * @param {string} [opts.name]  painted on the flanks; default = her profile name
 * @param {boolean} [opts.bank=true]  roll the body a little into turns
 */
export function createShip({ look = null, name = null, bank = true } = {}) {
  const C = SHIP_PALETTE;
  const group = new THREE.Group();
  group.name = 'heroShip';
  const body = new THREE.Group();     // cosmetic bank/vibration lives here
  body.name = 'shipBody';
  group.add(body);

  const sunWorld = new THREE.Vector3(-0.75, 0.5, 0.35).normalize();
  const sunView = { value: sunWorld.clone() };

  const hullTex = paintHull(name ?? loadProfile().name);
  const cellTex = paintSolarCells();
  const toon = makeToonMaterial({ map: hullTex, sunView, spec: 0.06, rim: 0.4 });
  const outlineMat = makeOutlineMaterial({ thickness: 0.032, maxPx: 2.6 });
  const solarMat = makeToonMaterial({ map: cellTex, vertexColors: false, sunView, spec: 0.0, rim: 0.25, sheen: 0.6 });
  const glassMat = makeGlassMaterial(sunView);

  // ---- the logical rig (detached; posed every frame, copied into the batch) ----
  const rig = new THREE.Object3D();
  const batch = new PartBatch(toon, outlineMat);

  batch.add(buildStaticHull(), rig);

  // Wings: pivot -> roll (about the body axis) -> sweep (about local Y).
  const wingGeoR = buildWingGeometry();
  const wingGeoL = mirrorX(wingGeoR);
  const wings = [];
  for (const side of [1, -1]) {
    const roll = new THREE.Object3D();
    roll.position.set(side * WING_PIVOT.x, WING_PIVOT.y, WING_PIVOT.z);
    rig.add(roll);
    const sweep = new THREE.Object3D();
    roll.add(sweep);
    batch.add(side > 0 ? wingGeoR : wingGeoL, sweep);
    const tip = new THREE.Object3D();
    tip.position.set(side * 2.34 * WING_SCALE[0], 0, 0.52 * WING_SCALE[2]);
    sweep.add(tip);
    wings.push({ side, roll, sweep, tip });
  }

  // Hatch door + ladder.
  const hinge = hullPoint(HATCH.zC, HATCH.phiLo, 0.0);
  const top = hullPoint(HATCH.zC, HATCH.phiHi, 0.0);
  const doorGeo = buildDoorGeometry();
  doorGeo.translate(-hinge.x, -hinge.y, -hinge.z);
  const door = new THREE.Object3D();
  door.position.copy(hinge);
  rig.add(door);
  batch.add(doorGeo, door);
  const ladder = new THREE.Object3D();
  // Stowed on the door's inner face, just behind it.
  ladder.position.set(top.x - hinge.x + 0.09, top.y - hinge.y, 0);
  door.add(ladder);
  batch.add(buildLadderGeometry(), ladder);

  // Landing legs.
  const strutGeo = buildLegStrutGeometry();
  const footGeo = buildFootGeometry();
  const legs = LEG_PIVOTS.map((lp) => {
    const strut = new THREE.Object3D();
    strut.position.copy(lp.pos);
    rig.add(strut);
    batch.add(strutGeo, strut);
    const foot = new THREE.Object3D();
    foot.position.set(0, -LEG_LEN, 0);
    strut.add(foot);
    batch.add(footGeo, foot);
    return { ...lp, strut, foot };
  });

  // Tractor claw.
  const cg = buildClawGeometries();
  const clawBase = new THREE.Object3D();
  clawBase.position.set(0, -0.64, -2.62);
  rig.add(clawBase);
  batch.add(cg.arm1, clawBase);
  const clawSlide = new THREE.Object3D();
  clawBase.add(clawSlide);
  batch.add(cg.arm2, clawSlide);
  const clawHead = new THREE.Object3D();
  clawHead.position.set(0, 0, -0.95);
  clawSlide.add(clawHead);
  batch.add(cg.head, clawHead);
  const fingers = [0, 1, 2].map((i) => {
    const spin = new THREE.Object3D();
    spin.rotation.z = (i / 3) * TAU + Math.PI / 2;
    spin.position.z = -0.14;
    clawHead.add(spin);
    const h = new THREE.Object3D();
    h.position.set(0.11, 0, 0);
    spin.add(h);
    batch.add(cg.finger, h);
    return h;
  });
  const clawTip = new THREE.Object3D();
  clawTip.position.set(0, 0, -0.5);
  clawHead.add(clawTip);

  // Solar arrays: collar + three booms (batched), panels (instanced).
  const sg = buildSolarGeometries();
  const solarRoot = new THREE.Object3D();
  rig.add(solarRoot);
  batch.add(sg.collar, solarRoot);
  const arrays = SOLAR_ANGLES.map((ang) => {
    // Mount frame: +X radial, +Y tangent, +Z along the ship.
    const phi = Math.atan2(-Math.cos(ang), -Math.sin(ang));   // inverse of hullPoint's (x, y) = (-sin, -cos)
    const mountPt = hullPoint(SOLAR_Z, ((phi % TAU) + TAU) % TAU, 0.06);
    const mount = new THREE.Object3D();
    mount.position.copy(mountPt);
    mount.rotation.z = ang;
    solarRoot.add(mount);
    const boom = new THREE.Object3D();
    mount.add(boom);
    batch.add(sg.boom, boom);
    const panels = [];
    let parent = boom;
    for (let i = 0; i < PANEL.count; i++) {
      const p = new THREE.Object3D();
      p.position.x = i === 0 ? BOOM_LEN + 0.05 : PANEL.len;
      parent.add(p);
      panels.push(p);
      parent = p;
    }
    // Stow direction: down-facing array stows aft, the upper two forward.
    // (Stowed, the stack's local +Z points radially out for +PI/2 and in for
    // -PI/2, so the aft-stowing one stacks the other way.)
    const stow = ang > Math.PI ? -Math.PI / 2 : Math.PI / 2;
    return { ang, mount, boom, panels, stow, parity: stow > 0 ? 1 : -1 };
  });

  // Base panels: a butterfly pair on the spine, always fitted. Static, so
  // their instance matrices are computed once.
  const basePanelMatrices = [1, -1].map((side) => {
    // Panel x (its length) runs out sideways, its face points up, tilted out.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side > 0 ? 0 : Math.PI, 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * -0.38));
    const face = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    q.multiply(face);
    return new THREE.Matrix4().compose(
      new THREE.Vector3(side * 0.27, hullTopY(0.27, 1.02) + 0.05, 1.02),
      q,
      new THREE.Vector3(0.42, 0.8, 0.8),
    );
  });

  batch.build();
  body.add(batch.outline);
  body.add(batch.mesh);
  batch.mesh.name = 'shipParts';
  batch.outline.name = 'shipOutline';
  // BatchedMesh builds its draw list in its OWN onBeforeRender, so these hooks
  // wrap it rather than replace it.
  const hook = (mesh, fn) => {
    const own = mesh.onBeforeRender.bind(mesh);
    mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      fn(renderer, camera);
      own(renderer, scene, camera, geometry, material, group);
    };
  };
  hook(batch.outline, (renderer) => trackResolution(renderer));
  hook(batch.mesh, (renderer, camera) => {
    sunView.value.copy(sunWorld).transformDirection(camera.matrixWorldInverse);
  });

  const panelGeo = buildPanelGeometry();
  const nPanels = 2 + arrays.length * PANEL.count;
  const panelMesh = new THREE.InstancedMesh(panelGeo, solarMat, nPanels);
  const panelOutline = new THREE.InstancedMesh(panelGeo, outlineMat, nPanels);
  for (const m of [panelMesh, panelOutline]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.add(m);
  }
  panelMesh.name = 'shipSolarPanels';

  // ---- canopy glass ----
  const glassGeo = new THREE.SphereGeometry(1, 48, 32);
  {
    const p = glassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      p.setXYZ(i, p.getX(i) * CANOPY.rx, p.getY(i) * CANOPY.ry, z * (z > 0 ? CANOPY.rzBack : CANOPY.rzFront));
    }
    glassGeo.computeVertexNormals();
  }
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(CANOPY.x, CANOPY.y, CANOPY.z);
  glass.renderOrder = 2;
  glass.name = 'canopyGlass';
  body.add(glass);

  // ---- glowing cockpit screens ----
  const screens = (() => {
    // Two screens lying on the console's top face, which tilts toward her.
    const q1 = new THREE.PlaneGeometry(0.3, 0.2);
    const q2 = new THREE.PlaneGeometry(0.3, 0.2);
    for (const [q, x] of [[q1, -0.2], [q2, 0.2]]) {
      q.rotateX(-Math.PI / 2);                // face +Y (the box's top)
      q.translate(x, 0.101, 0);
      place(q, 0, CONSOLE.y, CONSOLE.z, CONSOLE.tilt);
    }
    const paintQ = (g, r, gg, b) => {
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g;
    };
    const g = mergeGeometries([paintQ(q1, 0.25, 0.95, 1.2), paintQ(q2, 1.2, 0.65, 0.2)]);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    m.name = 'cockpitScreens';
    return m;
  })();
  body.add(screens);

  // ---- the girl ----
  const choices = { ...defaultChoices(), ...(look || loadLook() || {}) };
  const girlMat = makeToonMaterial({ vertexColors: true, sunView, spec: 0.0, rim: 0.3, rimAdd: 0.32 });
  const girl = buildGirlRig(choices, { material: girlMat, height: GIRL_HEIGHT, outline: true, outlineThickness: 0.011 });
  girl.group.name = 'pilot';
  const hipsRest = girl.byName.hips.position.clone();
  const rootRest = girl.byName.root.position.clone();
  const hipsLocalY = rootRest.y + hipsRest.y;
  let girlSeated = true;
  const seatGirl = () => {
    girl.group.position.set(0, SEAT.hipsY - hipsLocalY, SEAT.hipsZ);
    girl.group.rotation.set(0, Math.PI, 0);
    girl.group.scale.setScalar(1);
    body.add(girl.group);
    girlSeated = true;
  };
  seatGirl();

  // A warm, short-range fill in the canopy, above her and a little ahead on
  // the camera side, so her hair and face pop against the dark cockpit tub.
  // Point lights do not scale with their parent, so distance and intensity
  // are rescaled every frame to the ship's world scale (flight vs surface).
  const FILL = { distance: 1.2, intensity: 0.2, reach: 0.4 };   // reach = lamp-to-head, m
  const fill = new THREE.PointLight(0xffd6a8, FILL.intensity, FILL.distance, 2);
  fill.name = 'cockpitFill';
  fill.position.set(0.42, 1.62, -1.2);
  body.add(fill);
  const _ws = new THREE.Vector3();

  // ---- effects ----
  const fx = createShipFx({
    mainNozzle: { pos: new THREE.Vector3(0, 0.02, 3.72), radius: 0.56 },
    reverseNozzles: [new THREE.Vector3(0.5, -0.22, -3.36), new THREE.Vector3(-0.5, -0.22, -3.36)],
    rcs: {
      // side jets (for turning): direction the gas LEAVES
      noseL: { pos: hullPoint(RCS_Z.nose, Math.PI / 2, 0.02), dir: new THREE.Vector3(-1, 0, 0) },
      noseR: { pos: hullPoint(RCS_Z.nose, 3 * Math.PI / 2, 0.02), dir: new THREE.Vector3(1, 0, 0) },
      tailL: { pos: hullPoint(RCS_Z.tail, Math.PI / 2, 0.02), dir: new THREE.Vector3(-1, 0, 0) },
      tailR: { pos: hullPoint(RCS_Z.tail, 3 * Math.PI / 2, 0.02), dir: new THREE.Vector3(1, 0, 0) },
      // aft / fore jets (for precision translation)
      aftL: { pos: new THREE.Vector3(-0.55, 0.35, 3.1), dir: new THREE.Vector3(-0.25, 0.1, 1).normalize() },
      aftR: { pos: new THREE.Vector3(0.55, 0.35, 3.1), dir: new THREE.Vector3(0.25, 0.1, 1).normalize() },
      foreL: { pos: new THREE.Vector3(-0.42, 0.12, -3.55), dir: new THREE.Vector3(-0.3, 0.1, -1).normalize() },
      foreR: { pos: new THREE.Vector3(0.42, 0.12, -3.55), dir: new THREE.Vector3(0.3, 0.1, -1).normalize() },
    },
    strobe: new THREE.Vector3(0, hullTopY(0, 2.2) + 0.3, 2.2),
  });
  body.add(fx.group);

  // ---- animation state ----
  const anim = (dur, v = 0) => ({ t: v, target: v, dur, settle: 9 });
  const A = {
    wings: anim(1.9, 0),       // 0 deployed, 1 folded
    solar: anim(4.2, 0),       // 0 stowed, 1 deployed
    clawExt: anim(1.2, 0),
    clawClose: anim(0.28, 1),  // 1 = closed
    legs: anim(1.5, 0),        // 1 = down
    hatch: anim(2.4, 0),       // 1 = open
  };
  let solarInstalled = false;
  let throttle = 0, turn = 0, precision = false;
  let turnS = 0, bankS = 0;
  let time = 0;
  let girlLookOverride = null;

  const step = (a, dt) => {
    const d = a.target - a.t;
    const s = dt / a.dur;
    if (d === 0) { a.settle += dt; return; }
    if (Math.abs(d) <= s) { a.t = a.target; a.settle = 0; } else { a.t += Math.sign(d) * s; }
  };
  /** A decaying wobble after an animation lands: the "clunk". */
  const clunk = (a, amp, freq = 26, decay = 7) => (a.settle < 1.2 ? amp * Math.exp(-decay * a.settle) * Math.sin(freq * a.settle) : 0);

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _v2b = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);

  function poseWings() {
    const t = A.wings.t;
    const unlock = Math.sin(Math.PI * win(t, 0, 0.18)) * THREE.MathUtils.degToRad(4);
    const sweep = WING_SWEEP * easeInOut(win(t, 0.1, 0.78));
    const tuck = WING_TUCK * easeInOut(win(t, 0.5, 0.95));
    const knock = A.wings.target === 1 ? clunk(A.wings, 0.05) : clunk(A.wings, 0.035);
    for (const w of wings) {
      w.roll.rotation.set(0, 0, w.side * (WING_DIHEDRAL - unlock + tuck + knock));
      w.sweep.rotation.set(0, -w.side * sweep, 0);
    }
  }

  function poseHatch() {
    const t = A.hatch.t;
    const d = win(t, 0, 0.55);
    const doorA = HATCH_OPEN * (d < 1 ? easeInOut(d) : 1) + (A.hatch.target === 1 ? clunk(A.hatch, 0.05, 20, 6) : 0);
    door.rotation.set(0, 0, doorA);
    const l = easeInOut(win(t, 0.5, 1.0));
    // From lying on the door's inner face, flip up and over the edge to hang
    // with a slight outward lean (see the header for the angle bookkeeping).
    const target = TAU - LADDER_LEAN - HATCH_OPEN;
    ladder.rotation.set(0, 0, target * l);
    ladder.visible = t > 0.001;
  }

  function poseLegs() {
    const t = A.legs.t;
    for (let i = 0; i < legs.length; i++) {
      const L = legs[i];
      const lt = win(t, i === 0 ? 0 : 0.08, i === 0 ? 0.85 : 0.95);
      const e = A.legs.target === 1 ? easeOutBack(lt) : easeInOut(lt);
      const rx = (1 - e) * L.stowX;
      const rz = L.splay * e;
      L.strut.rotation.set(rx, 0, rz);
      L.strut.updateMatrix();
      // Pad stays level with the ship.
      L.foot.quaternion.copy(L.strut.quaternion).invert();
      const touch = A.legs.target === 1 ? clunk(A.legs, 0.03, 18, 6) : 0;
      L.foot.position.y = -LEG_LEN + touch;
    }
  }

  function poseClaw() {
    const e = A.clawExt.t;
    const pitch = -THREE.MathUtils.degToRad(18) * easeInOut(win(e, 0, 0.45));
    clawBase.rotation.set(pitch + (A.clawExt.target === 1 ? clunk(A.clawExt, 0.02) : 0), 0, 0);
    clawSlide.position.z = -0.88 * easeInOut(win(e, 0.3, 1.0));
    const open = (1 - A.clawClose.t) * win(e, 0.55, 1.0);
    const ang = lerp(0.22, -0.62, open);
    for (const f of fingers) f.rotation.set(0, ang, 0);
  }

  function poseSolar() {
    solarRoot.visible = solarInstalled;
    const t = A.solar.t;
    const swing = easeInOut(win(t, 0, 0.3));
    const knock = A.solar.target === 1 ? clunk(A.solar, 0.03, 14, 5) : 0;
    for (const arr of arrays) {
      arr.boom.rotation.set(0, arr.stow * (1 - swing), 0);
      // Accordion: panel i hinges off the end of panel i-1. Folded, each one
      // lies back over the last, a gap further out from the hull; they unfold
      // one after another, swinging through the OUTWARD side of the stack.
      for (let i = 1; i < PANEL.count; i++) {
        const u = easeInOut(win(t, 0.22 + (i - 1) * 0.22, 0.46 + (i - 1) * 0.22));
        const fold = 1 - u;
        const sgn = arr.parity * (i % 2 ? 1 : -1);
        arr.panels[i].rotation.set(0, -sgn * Math.PI * fold + (i === PANEL.count - 1 ? knock : 0), 0);
        arr.panels[i].position.z = sgn * PANEL.gap * fold;
      }
    }
  }

  function syncPanels() {
    let k = 0;
    for (const bm of basePanelMatrices) {
      panelMesh.setMatrixAt(k, bm);
      panelOutline.setMatrixAt(k, bm);
      k++;
    }
    for (const arr of arrays) {
      for (const p of arr.panels) {
        if (!solarInstalled) {
          _m.makeScale(0, 0, 0);
        } else {
          _m.copy(p.matrixWorld);
        }
        panelMesh.setMatrixAt(k, _m);
        panelOutline.setMatrixAt(k, _m);
        k++;
      }
    }
    panelMesh.instanceMatrix.needsUpdate = true;
    panelOutline.instanceMatrix.needsUpdate = true;
  }

  // Girl: seated, hands on the controls, looking about.
  const gb = girl.byName;
  // Idle life. Two things show the chase camera her face:
  //  - a GLANCE: every 5-8 s she looks round over her shoulder for ~1.6 s,
  //    mostly toward the camera's side (+X, starboard - see CHASE_CAMERA);
  //  - a WAVE: turning right round in the seat, arm up. Only on request
  //    (girlWave), for milestones.
  // While turning she looks where she is turning.
  const WAVE_LEN = 2.6;
  const GLANCE_LEN = 1.6;
  let waveT = 0, waveSide = 1;
  let glanceT = 0, glanceSide = 1, nextGlance = 3 + Math.random() * 2;
  function girlWave(side = 1) { waveT = WAVE_LEN; waveSide = side >= 0 ? 1 : -1; }
  function girlGlance(side = 1) { glanceT = GLANCE_LEN; glanceSide = side >= 0 ? 1 : -1; }
  const envelope = (p, edge) => smooth(clamp01(p / edge)) * smooth(clamp01((1 - p) / edge));

  function poseGirl(dt) {
    if (!girlSeated) return;
    const t = time;
    const breath = Math.sin(t * 1.9);
    if (t > nextGlance) {
      if (waveT <= 0) girlGlance(Math.random() < 0.8 ? 1 : -1);
      nextGlance = t + 5 + Math.random() * 3;
    }
    waveT = Math.max(0, waveT - dt);
    glanceT = Math.max(0, glanceT - dt);
    const wave = waveT > 0 ? envelope(1 - waveT / WAVE_LEN, 0.22) : 0;
    const glance = glanceT > 0 ? envelope(1 - glanceT / GLANCE_LEN, 0.25) : 0;
    const idleYaw = 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 0.7) + 0.06 * Math.sin(t * 1.3);
    const lookYaw = girlLookOverride !== null ? girlLookOverride : idleYaw - turnS * 0.75;
    const baseYaw = lerp(lookYaw, -glanceSide * 1.15, glance);
    // Negative yaw turns her face toward +X. The wave twists the whole upper
    // body round (~100 degrees) so her face comes toward a camera behind her.
    const yaw = lerp(baseYaw, -waveSide * 1.05, wave);
    const twist = Math.max(wave * 0.5, glance * 0.35);
    const lean = -turnS * 0.16;
    gb.hips.rotation.set(-0.08, -waveSide * 0.12 * wave, lean * 0.4);
    gb.spine.rotation.set(0.02 + breath * 0.01, yaw * twist * 0.4, lean * 0.5);
    gb.chest.rotation.set(0.04 + breath * 0.015 - wave * 0.1, yaw * (0.3 + twist * 0.5), lean * 0.3);
    gb.neck.rotation.set(-0.05, yaw * 0.45, 0);
    gb.head.rotation.set(-0.12 + 0.04 * Math.sin(t * 0.53) - wave * 0.08, yaw * 0.7, lean * -0.4 + 0.05 * Math.sin(t * 0.29) + wave * waveSide * 0.12);
    // Seated: thighs forward, shins down. (In this rig -X swings a limb FORWARD.)
    gb.thighL.rotation.set(-1.45, 0, 0.1);
    gb.thighR.rotation.set(-1.45, 0, -0.1);
    gb.shinL.rotation.set(1.5, 0, 0);
    gb.shinR.rotation.set(1.5, 0, 0);
    gb.footL.rotation.set(-0.1, 0, 0);
    gb.footR.rotation.set(-0.1, 0, 0);
    // Right hand on the stick (moves with the turn), left on the throttle;
    // the arm on the side she turns toward comes up to wave.
    const flap = Math.sin(t * 13) * 0.45;
    // She waves with the FAR arm, so the hand frames her face instead of covering it.
    const wR = waveSide < 0 ? wave : 0;
    const wL = waveSide > 0 ? wave : 0;
    gb.armR.rotation.set(lerp(-0.95 + turnS * 0.08, 0.15, wR), 0, lerp(-0.18, -2.75, wR));
    gb.forearmR.rotation.set(lerp(-0.55, 0, wR), 0, lerp(0.15 + turnS * 0.25, -0.35 + flap, wR));
    gb.handR.rotation.set(0, 0, flap * 0.4 * wR);
    gb.armL.rotation.set(lerp(-0.85 - Math.max(0, throttle) * 0.12, 0.15, wL), 0, lerp(0.22, 2.75, wL));
    gb.forearmL.rotation.set(lerp(-0.6, 0, wL), 0, lerp(-0.1, 0.35 - flap, wL));
    gb.handL.rotation.set(0, 0, -flap * 0.4 * wL);
  }

  const tmpTip = new THREE.Vector3();
  const portPos = new THREE.Vector3();
  const stbdPos = new THREE.Vector3();

  function update(dt) {
    dt = Math.min(dt, 0.1);
    time += dt;
    for (const k of Object.keys(A)) step(A[k], dt);
    const wasClosed = clawWasClosed;
    clawWasClosed = A.clawClose.target === 1;

    turnS += (turn - turnS) * (1 - Math.exp(-dt * 6));
    if (bank) {
      bankS += (turn - bankS) * (1 - Math.exp(-dt * 2.5));
      body.rotation.z = -bankS * 0.09;
    }
    const vib = Math.abs(throttle) * (precision ? 0.2 : 1);
    body.position.set(
      (Math.sin(time * 71) * 0.5 + Math.sin(time * 43) * 0.5) * 0.004 * vib,
      (Math.sin(time * 59) * 0.5 + Math.sin(time * 97) * 0.5) * 0.004 * vib, 0);

    poseWings();
    poseHatch();
    poseLegs();
    poseClaw();
    poseSolar();
    rig.updateMatrixWorld(true);
    batch.sync();
    syncPanels();
    poseGirl(dt);
    // three clamps a point light's 1/d^2 at d = 0.1, which at flight scale
    // (her head ~0.05 u from the lamp) would dim it; compensate so the fill
    // looks the same at both scales.
    body.updateWorldMatrix(true, false);
    _ws.setFromMatrixScale(body.matrixWorld);
    const k = FILL.reach * _ws.x;
    fill.distance = FILL.distance * _ws.x;
    fill.intensity = FILL.intensity * _ws.x * _ws.x * (k < 0.1 ? 0.01 / (k * k) : 1);

    // Effects.
    wings[0].tip.getWorldPosition(stbdPos);  // rig is detached: world == ship-local
    wings[1].tip.getWorldPosition(portPos);
    clawTip.getWorldPosition(tmpTip);
    clawHead.matrixWorld.decompose(_v2b, _q, _v3);
    if (!wasClosed && clawWasClosed && A.clawExt.t > 0.8) fx.sparkle(tmpTip);
    fx.update(dt, {
      throttle, precision, turn,
      navPort: portPos, navStarboard: stbdPos,
      clawPos: _v2b, clawQuat: _q, clawGlow: win(A.clawExt.t, 0.5, 1) * (1 - A.clawClose.t * 0.6),
      clawBeam: win(A.clawExt.t, 0.7, 1) * (1 - A.clawClose.t),
    });
  }
  let clawWasClosed = true;

  // Exit point, computed from the fully-open pose.
  function computeHatchExit() {
    const sv = { h: A.hatch.t };
    A.hatch.t = 1;
    poseHatch();
    rig.updateMatrixWorld(true);
    const foot = new THREE.Vector3(0, -LADDER_LEN, 0).applyMatrix4(ladder.matrixWorld);
    const lip = new THREE.Vector3(0, 0, 0).applyMatrix4(ladder.matrixWorld);
    A.hatch.t = sv.h;
    poseHatch();
    rig.updateMatrixWorld(true);
    return {
      position: new THREE.Vector3(foot.x - 0.35, GROUND_Y, foot.z),
      direction: new THREE.Vector3(-1, 0, 0),
      top: lip,
      ladderFoot: foot,
    };
  }
  const hatchExit = computeHatchExit();

  const setAnim = (a, v, instant) => {
    a.target = v;
    if (instant) { a.t = v; a.settle = 9; }
  };

  const api = {
    group,
    body,
    girl,
    fx,
    setThrottle(v) { throttle = clamp(v, -1, 1); },
    setTurn(v) { turn = clamp(v, -1, 1); },
    setPrecision(b) { precision = !!b; },
    setWingsFolded(b, instant = false) { setAnim(A.wings, b ? 1 : 0, instant); },
    /** 0 = stowed, 1 = deployed. Deploying also installs them (the upgrade). */
    setSolarWings(v, instant = false) {
      if (v) solarInstalled = true;
      setAnim(A.solar, v ? 1 : 0, instant);
    },
    /** Whether the Big Solar Wings upgrade is fitted at all (hidden until it is). */
    setSolarWingsInstalled(b) { solarInstalled = !!b; if (!b) setAnim(A.solar, 0, true); },
    setClaw({ extended = A.clawExt.target === 1, closed = A.clawClose.target === 1 } = {}, instant = false) {
      setAnim(A.clawExt, extended ? 1 : 0, instant);
      setAnim(A.clawClose, closed ? 1 : 0, instant);
    },
    setLegs(b, instant = false) { setAnim(A.legs, b ? 1 : 0, instant); },
    setHatch(b, instant = false) { setAnim(A.hatch, b ? 1 : 0, instant); },
    /** Ship-local: where she steps off the ladder, and which way is "out". */
    getHatchExit() {
      return {
        position: hatchExit.position.clone(),
        direction: hatchExit.direction.clone(),
        top: hatchExit.top.clone(),
      };
    },
    setSunDirection(v) { sunWorld.copy(v).normalize(); fx.setSunDirection?.(sunWorld); },
    /** Override where she looks (radians of yaw, + = her left), or null for idle. */
    setGirlLook(yaw) { girlLookOverride = yaw; },
    /** She turns round in her seat and waves (side: +1 toward starboard/+X, -1 port). */
    girlWave(side = 1) { girlWave(side); },
    /** A short look over her shoulder (side +1 = starboard, the chase camera's side). */
    girlGlance(side = 1) { girlGlance(side); },
    /** Stop posing her (the surface scene takes over and re-parents her). */
    releaseGirl() { girlSeated = false; return girl; },
    /** Put her back in the seat. */
    seatGirl() { seatGirl(); },
    /** Progress of each animation, 0..1 - handy for gating story beats. */
    state() {
      return {
        wingsFolded: A.wings.t, solar: A.solar.t, clawExtended: A.clawExt.t, clawClosed: A.clawClose.t,
        legs: A.legs.t, hatch: A.hatch.t, solarInstalled,
      };
    },
    update,
    dispose() {
      group.removeFromParent();
      batch.mesh.dispose?.();
      batch.outline.dispose?.();
      panelGeo.dispose();
      panelMesh.dispose();
      panelOutline.dispose();
      glassGeo.dispose();
      screens.geometry.dispose();
      screens.material.dispose();
      for (const m of [toon, outlineMat, solarMat, glassMat, girlMat]) m.dispose();
      hullTex.dispose();
      cellTex.dispose();
      girl.geometry?.dispose();
      girl.hull?.material?.dispose();
      fx.dispose();
    },
  };

  update(0);
  return api;
}

export const SHIP_LAYOUT = Object.freeze({ Z_NOSE, Z_TAIL, GROUND_Y, CANOPY, HATCH });

/**
 * Recommended chase camera, in FLIGHT units (the group already scaled by
 * SHIP.flightScale), in the ship's own frame (nose -Z, up +Y): place the
 * camera at `offset` and look at `lookAt`, both transformed by the ship's
 * yaw. A 3/4 rear view from starboard: 1.35 u from the look-at point, 32
 * degrees round toward +X, pitched down 22 degrees. Her idle glances go to
 * this (+X) side, so her face turns into view every 5-8 s.
 */
export const CHASE_CAMERA = Object.freeze({
  offset: new THREE.Vector3(0.66, 0.61, 1.01),
  lookAt: new THREE.Vector3(0, 0.1, -0.05),
});
