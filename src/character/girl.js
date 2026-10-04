// The girl, built from choices rather than modelled.
//
// ONE definition, used by everything that shows her: the character page where
// she is designed, and every chapter (Chapters 1-3 through game/avatar.js,
// Chapter 4 through space/ship.js, cabin.js and surface/walker.js). What she
// picks on the character page is what she plays as everywhere.
//
// Version 2 (lead request: "more realistic, thinner, better face features,
// a choice of dress and uniform"):
//   - SMOOTH-SKINNED. Arms, legs, torso and neck are single lathed tubes that
//     run through the joints, with skin weights blended across each joint, so
//     knees, elbows and shoulders bend as one surface instead of as a stack of
//     cylinders with a ball at every joint.
//   - Slimmer, longer-legged proportions and a smaller head on a longer neck:
//     a girl of about nine, not a mascot.
//   - A face drawn in thin layers that wrap the sculpted skull: almond eyes
//     with iris, pupil, catchlights, lids, a lash line and a crease; tapered,
//     arched brows; a shaped nose; lips with a cupid's bow; a soft blush.
//   - Hair made of tapered strands laid over a scalp shell, so every style
//     reads as hair rather than as a helmet.
//   - A wardrobe: lab coat, school uniform, summer dress, flight suit, hoodie,
//     dungarees, jacket, t-shirt, skirt, pinafore; three kinds of shoes; hair
//     accessories; eye colour; freckles.
//
// Still ONE merged mesh with vertex colours and one skeleton (rig.js), so she
// is one draw call (two with the outline) wherever she appears. The bone
// layout and the animations (clips.js) are unchanged, and old saved choices
// still build: every old id is still here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBones, boneIndex } from './rig.js';
import { sampleAllClips, toThreeClip } from './clips.js';

const TAU = Math.PI * 2;

/**
 * Every choice the builder offers, with the first entry as the default.
 * `section` starts a new heading on the character page.
 */
export const OPTIONS = {
  skin: {
    label: 'Skin',
    section: 'Face',
    swatches: true,
    values: [
      { id: 'light', label: 'Light', color: 0xffdcc4 },
      { id: 'fair', label: 'Fair', color: 0xf1c9a0 },
      { id: 'tan', label: 'Tan', color: 0xe8b88a },
      { id: 'olive', label: 'Olive', color: 0xd4a577 },
      { id: 'brown', label: 'Brown', color: 0xc98d5e },
      { id: 'deep', label: 'Deep', color: 0x8d5524 },
      { id: 'rich', label: 'Rich', color: 0x5c3317 },
    ],
  },
  eyeColor: {
    label: 'Eyes',
    swatches: true,
    values: [
      { id: 'brown', label: 'Brown', color: 0x5a3a22 },
      { id: 'hazel', label: 'Hazel', color: 0x86632f },
      { id: 'green', label: 'Green', color: 0x4f8047 },
      { id: 'blue', label: 'Blue', color: 0x4677b8 },
      { id: 'grey', label: 'Grey', color: 0x6f7f8c },
      { id: 'dark', label: 'Dark', color: 0x2e1f16 },
    ],
  },
  freckles: {
    label: 'Freckles',
    values: [
      { id: 'none', label: 'None' },
      { id: 'some', label: 'Some' },
    ],
  },
  hairStyle: {
    label: 'Hair',
    section: 'Hair',
    values: [
      { id: 'bob', label: 'Bob' },
      { id: 'ponytail', label: 'Ponytail' },
      { id: 'long', label: 'Long' },
      { id: 'braids', label: 'Braids' },
      { id: 'bunches', label: 'Bunches' },
      { id: 'curls', label: 'Curls' },
      { id: 'bun', label: 'Top bun' },
      { id: 'short', label: 'Short' },
    ],
  },
  hairColor: {
    label: 'Hair colour',
    swatches: true,
    values: [
      { id: 'black', label: 'Black', color: 0x2c1d18 },
      { id: 'brown', label: 'Brown', color: 0x5a382f },
      { id: 'chestnut', label: 'Chestnut', color: 0x8a5a2b },
      { id: 'blonde', label: 'Blonde', color: 0xd9b370 },
      { id: 'ginger', label: 'Ginger', color: 0xc2633a },
      { id: 'blue', label: 'Blue', color: 0x3f6fd0 },
      { id: 'pink', label: 'Pink', color: 0xe07ab0 },
    ],
  },
  hairAccessory: {
    label: 'Hair accessory',
    values: [
      { id: 'none', label: 'None' },
      { id: 'headband', label: 'Headband' },
      { id: 'bow', label: 'Bow' },
      { id: 'clips', label: 'Clips' },
    ],
  },
  accentColor: {
    // Bows, headbands, clips, ties and sashes.
    label: 'Accent colour',
    swatches: true,
    values: [
      { id: 'red', label: 'Red', color: 0xd14b45 },
      { id: 'pink', label: 'Pink', color: 0xe985b5 },
      { id: 'yellow', label: 'Yellow', color: 0xecc440 },
      { id: 'sky', label: 'Sky', color: 0x56b8ea },
      { id: 'purple', label: 'Purple', color: 0x9b7fd4 },
      { id: 'white', label: 'White', color: 0xf4f6f8 },
    ],
  },
  outfit: {
    label: 'Outfit',
    section: 'Clothes',
    values: [
      { id: 'labcoat', label: 'Lab coat' },
      { id: 'uniform', label: 'School uniform' },
      { id: 'dress', label: 'Summer dress' },
      { id: 'jumpsuit', label: 'Flight suit' },
      { id: 'hoodie', label: 'Hoodie' },
      { id: 'overalls', label: 'Dungarees' },
      { id: 'jacket', label: 'Jacket' },
      { id: 'tshirt', label: 'T-shirt' },
      { id: 'skirt', label: 'Skirt & top' },
      { id: 'school', label: 'Pinafore' },
    ],
  },
  outfitColor: {
    label: 'Outfit colour',
    swatches: true,
    values: [
      { id: 'white', label: 'White', color: 0xf2f4f8 },
      { id: 'orange', label: 'Orange', color: 0xe8833a },
      { id: 'teal', label: 'Teal', color: 0x2fa5a0 },
      { id: 'red', label: 'Red', color: 0xd14b45 },
      { id: 'blue', label: 'Blue', color: 0x4a7fd6 },
      { id: 'navy', label: 'Navy', color: 0x2f4270 },
      { id: 'green', label: 'Green', color: 0x5aa95f },
      { id: 'purple', label: 'Purple', color: 0x9b7fd4 },
      { id: 'yellow', label: 'Yellow', color: 0xe8c33a },
      { id: 'pink', label: 'Pink', color: 0xe98fb8 },
    ],
  },
  trousers: {
    // Trousers on most outfits; the skirt on the uniform and the skirt & top.
    label: 'Trousers / skirt',
    swatches: true,
    values: [
      { id: 'navy', label: 'Navy', color: 0x39507e },
      { id: 'grey', label: 'Grey', color: 0x5d6672 },
      { id: 'khaki', label: 'Khaki', color: 0x8a7a52 },
      { id: 'black', label: 'Black', color: 0x2a2f38 },
      { id: 'denim', label: 'Denim', color: 0x4a6f9e },
      { id: 'tartan', label: 'Tartan red', color: 0x8c2f36 },
    ],
  },
  shoes: {
    label: 'Shoes',
    values: [
      { id: 'sneakers', label: 'Trainers' },
      { id: 'boots', label: 'Boots' },
      { id: 'school', label: 'School shoes' },
    ],
  },
  glasses: {
    label: 'Glasses',
    section: 'Extras',
    values: [
      { id: 'none', label: 'None' },
      { id: 'round', label: 'Round' },
      { id: 'square', label: 'Square' },
      { id: 'goggles', label: 'Goggles' },
    ],
  },
  glassesColor: {
    label: 'Frames',
    swatches: true,
    values: [
      { id: 'dark', label: 'Dark', color: 0x2b3038 },
      { id: 'gold', label: 'Gold', color: 0xd4a13a },
      { id: 'red', label: 'Red', color: 0xc8483f },
      { id: 'pink', label: 'Pink', color: 0xe07ab0 },
      { id: 'teal', label: 'Teal', color: 0x2fa5a0 },
    ],
  },
  backpack: {
    label: 'Backpack',
    values: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
  },
  backpackColor: {
    label: 'Backpack colour',
    swatches: true,
    values: [
      { id: 'sky', label: 'Sky', color: 0x4fc3f7 },
      { id: 'red', label: 'Red', color: 0xd14b45 },
      { id: 'green', label: 'Green', color: 0x5aa95f },
      { id: 'purple', label: 'Purple', color: 0x9b7fd4 },
      { id: 'orange', label: 'Orange', color: 0xe8833a },
    ],
  },
};

/** The choices a fresh page starts from: the first value of everything. */
export function defaultChoices() {
  const out = {};
  for (const [key, group] of Object.entries(OPTIONS)) out[key] = group.values[0].id;
  return out;
}

/** Look a choice's colour up, falling back to the group's first value. */
function colorOf(group, id) {
  const values = OPTIONS[group].values;
  const hit = values.find((v) => v.id === id) || values[0];
  return hit.color ?? 0xffffff;
}

// --- small colour helpers ----------------------------------------------------

const _mixA = new THREE.Color();
const _mixB = new THREE.Color();

/** Blend two colours. */
function mix(a, b, t) {
  _mixA.setHex(a);
  _mixB.setHex(b);
  return _mixA.lerp(_mixB, t).getHex();
}

/** The same colour, darker (f < 1) or lighter (f > 1). */
function shade(hex, f) {
  _mixA.setHex(hex);
  _mixA.r = Math.min(1, _mixA.r * f);
  _mixA.g = Math.min(1, _mixA.g * f);
  _mixA.b = Math.min(1, _mixA.b * f);
  return _mixA.getHex();
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A repeatable pseudo-random stream, so the same choices give the same girl. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _c = new THREE.Color();

/**
 * Paint every vertex, so parts can merge and still differ. `color` is a hex,
 * or a function (x, y, z) -> hex evaluated at each vertex's final position:
 * that is how one lathed torso becomes a coat with a shirt showing at the V.
 */
function paint(geo, color) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const arr = new Float32Array(n * 3);
  const fn = typeof color === 'function' ? color : null;
  if (!fn) _c.setHex(color);
  for (let i = 0; i < n; i++) {
    if (fn) _c.setHex(fn(pos.getX(i), pos.getY(i), pos.getZ(i)));
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// --- the skull ---------------------------------------------------------------
// A head is not a sphere. These tables are its profile - half-width, and
// half-depth front and back - as a multiple of the radius, sampled by height.
// u runs from -1 at the point of the chin to +1 at the crown. Version 2 is
// narrower at the jaw and comes to a softer, more pointed chin: the single
// biggest step from "cartoon" to "girl" in the face.
const HEAD_R = 0.128;
const HEAD_SY = 1.26;
/** Centre of the head, in model units (she is ~1.5 tall before scaling). */
const HEAD_Y = 1.352;

const HEAD_WIDTH = [
  [-1.00, 0.14], [-0.90, 0.27], [-0.76, 0.43], [-0.56, 0.62], [-0.35, 0.78],
  [-0.12, 0.90], [0.15, 0.95], [0.45, 0.92], [0.72, 0.79], [1.00, 0.32],
];
const HEAD_FRONT = [
  [-1.00, 0.26], [-0.90, 0.48], [-0.76, 0.66], [-0.56, 0.80], [-0.35, 0.88],
  [-0.12, 0.93], [0.15, 0.93], [0.45, 0.90], [0.72, 0.77], [1.00, 0.30],
];
const HEAD_BACK = [
  [-1.00, 0.16], [-0.86, 0.32], [-0.64, 0.60], [-0.40, 0.88],
  [-0.10, 1.02], [0.15, 1.07], [0.45, 1.05], [0.72, 0.91], [1.00, 0.36],
];
const HEAD_SQUARE = [
  [-1.00, 0.04], [-0.85, 0.10], [-0.60, 0.16], [-0.35, 0.14],
  [-0.05, 0.10], [0.30, 0.05], [1.00, 0.00],
];

/** Piecewise-linear lookup, smoothstepped so the profile has no visible kink. */
function curveAt(table, u) {
  if (u <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (u >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [u1, v1] = table[i];
    if (u <= u1) {
      const [u0, v0] = table[i - 1];
      const t = (u - u0) / (u1 - u0);
      return v0 + (v1 - v0) * (t * t * (3 - 2 * t));
    }
  }
  return last[1];
}

/** Reshape a sphere of radius HEAD_R into the skull (or a shell round it). */
function sculptHead(geo, inflate = 1, lift = HEAD_SY) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ring = Math.hypot(x, z);
    if (ring < 1e-6) { pos.setY(i, y * lift); continue; }
    const u = Math.max(-1, Math.min(1, y / HEAD_R));
    const nx = x / ring;
    const nz = z / ring;
    const w = curveAt(HEAD_WIDTH, u) * HEAD_R * inflate;
    const d = curveAt(nz > 0 ? HEAD_FRONT : HEAD_BACK, u) * HEAD_R * inflate;
    const m = Math.max(Math.abs(nx), Math.abs(nz));
    const k = 1 + curveAt(HEAD_SQUARE, u) * (1 / m - 1);
    pos.setXYZ(i, nx * w * k, y * lift, nz * d * k);
  }
  pos.needsUpdate = true;
  return geo;
}

/** A point on (or `inflate` times outside) the skull: theta 0 = the face, +theta = her left. */
function headPoint(theta, u, inflate = 1, lift = HEAD_SY) {
  const nx = Math.sin(theta);
  const nz = Math.cos(theta);
  const w = curveAt(HEAD_WIDTH, u) * HEAD_R * inflate;
  const d = curveAt(nz > 0 ? HEAD_FRONT : HEAD_BACK, u) * HEAD_R * inflate;
  const m = Math.max(Math.abs(nx), Math.abs(nz), 1e-6);
  const k = 1 + curveAt(HEAD_SQUARE, u) * (1 / m - 1);
  return new THREE.Vector3(nx * w * k, HEAD_Y + u * HEAD_R * lift, nz * d * k);
}

/** Move a point onto the skull's shell (inflated), keeping its direction from the centre. */
function onShell(v, inflate = 1.06) {
  const theta = Math.atan2(v.x, v.z);
  const u = Math.max(-1, Math.min(1, (v.y - HEAD_Y) / (HEAD_R * HEAD_SY)));
  return headPoint(theta, u, inflate);
}

/** Depth of the face surface in front of the head's centre at (dx, dy). */
function faceZ(dx, dy) {
  const u = Math.max(-1, Math.min(1, dy / (HEAD_R * HEAD_SY)));
  const w = curveAt(HEAD_WIDTH, u) * HEAD_R;
  const d = curveAt(HEAD_FRONT, u) * HEAD_R;
  const t = 1 - (dx / w) * (dx / w);
  return t > 0 ? d * Math.sqrt(t) : 0;
}

// --- geometry helpers --------------------------------------------------------

/**
 * A lathed tube round the Y axis. `profile` is [[radius, y], ...] from the
 * bottom up. `sz` squashes it front-to-back (bodies are ellipses in section),
 * `phiStart`/`phiLength` open it (phi 0 faces +Z, the front). `radial(r, phi,
 * t)` lets a caller ripple the radius - folds and pleats - where t runs 0 at
 * the first profile point to 1 at the last.
 */
function lathe(profile, segs = 20, { sx = 1, sz = 1, phiStart = 0, phiLength = TAU, radial = null, rows = 0 } = {}) {
  let pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  if (rows > pts.length) {
    // A smooth curve through the profile, sampled finely: the outline stops
    // looking like a polygon, and vertex colours get enough rows to draw a
    // crisp hem or V instead of a smear.
    pts = new THREE.SplineCurve(pts).getSpacedPoints(rows).map((v) => new THREE.Vector2(Math.max(v.x, 1e-4), v.y));
  }
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
  if (radial) {
    const pos = g.attributes.position;
    const y0 = profile[0][1];
    const y1 = profile[profile.length - 1][1];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-6) continue;
      const phi = Math.atan2(x, z);
      const t = (pos.getY(i) - y0) / (y1 - y0);
      const k = radial(r, phi, t) / r;
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
  return g;
}

/**
 * Split every triangle into four, `levels` times. A flat shape laid on a
 * curved body needs vertices in its middle as well as round its edge, or the
 * middle sinks into the body it is supposed to sit on.
 */
function subdivide(geo, levels = 2) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (let l = 0; l < levels; l++) {
    const src = g.attributes.position.array;
    const out = [];
    for (let i = 0; i < src.length; i += 9) {
      const a = [src[i], src[i + 1], src[i + 2]];
      const b = [src[i + 3], src[i + 4], src[i + 5]];
      const c = [src[i + 6], src[i + 7], src[i + 8]];
      const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
      const ab = m(a, b);
      const bc = m(b, c);
      const ca = m(c, a);
      for (const t of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) for (const v of t) out.push(...v);
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  }
  const n = g.attributes.position.count;
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setIndex([...Array(n).keys()]);
  g.computeVertexNormals();
  return g;
}

/** The inside of an open garment: the same surface, facing in. */
function lining(geo) {
  const g = geo.clone();
  const idx = g.getIndex();
  const a = idx.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  idx.needsUpdate = true;
  // Pull it in a hair so the two never z-fight.
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * 0.955);
    pos.setZ(i, pos.getZ(i) * 0.955);
  }
  return g;
}

/** A box with rounded edges (shoes, backpack, pockets). */
function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const pos = g.attributes.position;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const hz = d / 2 - r;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c);
    if (v.lengthSq() > 1e-12) v.setLength(r);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  return g;
}

/**
 * A tapered, flattened tube along a smooth path: one lock of hair, a strap,
 * a braid's core. `out(p, target)` gives the direction the tube's flat side
 * faces (default: away from the centre of the head), which is what keeps a
 * lock of hair lying ON the head instead of standing edge-on.
 */
function strandGeo(points, { w0 = 0.04, w1 = 0.012, th = 0.012, sides = 6, seg = 5, out = null, tipTaper = 0.3 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = Math.max(6, (points.length - 1) * seg);
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const O = new THREE.Vector3();
  const S = new THREE.Vector3();
  const U = new THREE.Vector3();
  const prevS = new THREE.Vector3(1, 0, 0);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    if (out) out(P, O); else O.set(P.x, P.y - HEAD_Y, P.z);
    S.crossVectors(T, O);
    if (S.lengthSq() < 1e-12) S.copy(prevS); else S.normalize();
    prevS.copy(S);
    U.crossVectors(S, T).normalize();
    const root = Math.min(1, 0.55 + t * 6);
    const tip = t > 1 - tipTaper ? Math.max(0.12, 1 - (t - (1 - tipTaper)) / tipTaper) : 1;
    const w = (w0 + (w1 - w0) * t) * root * tip;
    const h = th * Math.max(0.35, tip);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU;
      const cs = Math.cos(a) * w * 0.5;
      const sn = Math.sin(a) * h * 0.5;
      pos.push(P.x + S.x * cs + U.x * sn, P.y + S.y * cs + U.y * sn, P.z + S.z * cs + U.z * sn);
      uv.push(k / sides, t);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      const c = (i + 1) * sides + k;
      const d = (i + 1) * sides + ((k + 1) % sides);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// --- skin weights ------------------------------------------------------------

/**
 * Blend bones by height. `stops` is [[y, bone], ...] from the bottom up:
 * below the first stop the first bone owns the vertex, between two stops with
 * different bones it blends smoothly from one to the other. This is the whole
 * of what makes a knee bend as one surface.
 */
function rampY(stops) {
  const resolved = stops.map(([y, b]) => [y, boneIndex(b)]);
  return (x, y) => {
    if (y <= resolved[0][0]) return [[resolved[0][1], 1]];
    for (let i = 1; i < resolved.length; i++) {
      const [y1, b1] = resolved[i];
      if (y <= y1) {
        const [y0, b0] = resolved[i - 1];
        if (b0 === b1) return [[b0, 1]];
        const t = smooth((y - y0) / (y1 - y0));
        return [[b0, 1 - t], [b1, t]];
      }
    }
    return [[resolved[resolved.length - 1][1], 1]];
  };
}

/**
 * Build the figure. Returns one merged geometry with vertex colours and skin
 * weights, in model units (about 1.5 tall; callers normalise the height).
 *
 * Bone rest positions (rig.js): hips 0.62, spine 0.78, chest 0.98, neck 1.15,
 * head 1.30; shoulders (+-0.175, 1.10), elbows 0.89, wrists 0.70; hips
 * (+-0.085, 0.60), knees 0.30, ankles 0.045. The body is built round them.
 *
 * @param {Record<string,string>} choices  ids from OPTIONS; missing keys default
 */
export function buildGirlGeometry(choices = {}) {
  const c = { ...defaultChoices(), ...choices };
  const skin = colorOf('skin', c.skin);
  const hair = colorOf('hairColor', c.hairColor);
  const cloth = colorOf('outfitColor', c.outfitColor);
  const legs = colorOf('trousers', c.trousers);
  const frame = colorOf('glassesColor', c.glassesColor);
  const pack = colorOf('backpackColor', c.backpackColor);
  const accent = colorOf('accentColor', c.accentColor);
  const iris = colorOf('eyeColor', c.eyeColor);
  const WHITE = 0xf4f6f8;
  const DARK = 0x1c222c;
  const R = rng(0x51f15e);

  const parts = [];
  const partW = [];
  /** Parts drawn as thin layers (face features, panels, linings): no outline. */
  const partThin = [];
  let thin = false;
  const asLayer = (fn) => { const was = thin; thin = true; try { fn(); } finally { thin = was; } };

  /**
   * Place one primitive and say how it is skinned: a bone name (rigid), or a
   * weight function (x, y, z) -> [[boneIndex, w], ...] such as rampY().
   * `color` is a hex or a function of the vertex position (see paint()).
   */
  const add = (geo, color, x, y, z, rot, bone) => {
    if (rot) {
      if (rot.scale) geo.scale(rot.scale[0], rot.scale[1], rot.scale[2]);
      if (rot.x) geo.rotateX(rot.x);
      if (rot.y) geo.rotateY(rot.y);
      if (rot.z) geo.rotateZ(rot.z);
    }
    geo.translate(x, y, z);
    if (!geo.getIndex()) {
      const n = geo.attributes.position.count;
      geo.setIndex([...Array(n).keys()]);
    }
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    parts.push(paint(geo, color));
    partW.push(typeof bone === 'string' ? boneIndex(bone) : bone);
    partThin.push(thin);
    return geo;
  };

  // --- what she is wearing, decided up front ------------------------------
  const o = c.outfit;
  const SKIRTED = o === 'uniform' || o === 'dress' || o === 'skirt' || o === 'school';
  const LONG_SLEEVE = o === 'labcoat' || o === 'uniform' || o === 'jumpsuit' || o === 'hoodie' || o === 'jacket';
  const SLEEVELESS = o === 'dress';
  const SHIRT_BLUE = 0x9cc3ea;
  const TIE = accent === WHITE ? 0xc8483f : accent;
  /** Knee socks with the uniform and pinafore, ankle socks with the dress and skirt. */
  const SOCK_TOP = o === 'uniform' || o === 'school' ? 0.27 : SKIRTED ? 0.115 : 0;
  /** Where trousers stop: the flight suit runs to the boot, dungarees get a turn-up. */
  const legCloth = o === 'jumpsuit' ? cloth : legs;

  // --- legs -------------------------------------------------------------------
  // One lathed tube per leg from ankle to hip, weights blended through the
  // knee and into the hips. Slim, with a calf and a knee.
  const LEG = [
    [0.000, 0.052], [0.026, 0.056], [0.028, 0.076], [0.030, 0.10], [0.035, 0.14],
    [0.043, 0.19], [0.045, 0.22], [0.041, 0.26], [0.036, 0.295], [0.038, 0.32],
    [0.044, 0.36], [0.051, 0.43], [0.058, 0.50], [0.063, 0.56], [0.066, 0.61],
    [0.060, 0.645], [0.000, 0.656],
  ];
  const legColorAt = (y) => {
    if (SKIRTED) {
      if (y < 0.075) return WHITE;
      if (y < SOCK_TOP) return y > SOCK_TOP - 0.018 ? shade(WHITE, 0.9) : WHITE;
      return skin;
    }
    // Trousers, with a darker hem band at the ankle.
    if (y < 0.085) return shade(legCloth, o === 'overalls' ? 1.15 : 0.82);
    return legCloth;
  };
  for (const side of [-1, 1]) {
    const L = side > 0 ? 'L' : 'R';
    const x = side * 0.085;
    const legGeo = lathe(LEG, 22, { sz: 0.94, rows: 44 });
    {
      const lp = legGeo.attributes.position;
      for (let i = 0; i < lp.count; i++) lp.setX(i, lp.getX(i) - side * 0.013 * smooth((lp.getY(i) - 0.38) / 0.24));
    }
    add(legGeo, (px, py) => legColorAt(py), x, 0, 0, null,
      rampY([[0.062, 'foot' + L], [0.08, 'shin' + L], [0.27, 'shin' + L], [0.33, 'thigh' + L], [0.56, 'thigh' + L], [0.645, 'hips']]));
  }

  // --- shoes --------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const L = side > 0 ? 'L' : 'R';
    const x = side * 0.085;
    if (c.shoes === 'boots') {
      const BOOT = 0x6b4a32;
      add(roundedBox(0.074, 0.024, 0.155, 0.010), 0x3a2a1e, x, 0.012, 0.026, null, 'foot' + L);
      add(roundedBox(0.068, 0.058, 0.138, 0.024), BOOT, x, 0.045, 0.022, null, 'foot' + L);
      // The shaft rides the shin, so the ankle bends inside the boot.
      add(lathe([[0.036, 0.05], [0.037, 0.10], [0.039, 0.155], [0.036, 0.16]], 14, { sz: 0.95 }), BOOT, x, 0, 0, null,
        rampY([[0.07, 'foot' + L], [0.10, 'shin' + L]]));
      add(new THREE.TorusGeometry(0.038, 0.005, 5, 14), shade(BOOT, 0.8), x, 0.155, 0, { x: Math.PI / 2 }, 'shin' + L);
    } else if (c.shoes === 'school') {
      const SHOE = 0x1e2026;
      add(roundedBox(0.070, 0.018, 0.150, 0.008), 0x2b2b30, x, 0.009, 0.026, null, 'foot' + L);
      add(roundedBox(0.064, 0.042, 0.136, 0.020), SHOE, x, 0.034, 0.024, null, 'foot' + L);
      add(new THREE.BoxGeometry(0.068, 0.008, 0.016), SHOE, x, 0.058, 0.03, null, 'foot' + L);
      add(new THREE.SphereGeometry(0.005, 6, 5), 0xc9a23a, x + side * 0.033, 0.056, 0.03, null, 'foot' + L);
    } else {
      // Trainers: a white sole, a coloured upper, a white toe cap and laces.
      const UPPER = legCloth === WHITE ? 0x3b4a66 : mix(0x3b4a66, accent, 0.35);
      add(roundedBox(0.076, 0.022, 0.158, 0.010), WHITE, x, 0.011, 0.027, null, 'foot' + L);
      add(roundedBox(0.068, 0.050, 0.140, 0.023), UPPER, x, 0.040, 0.022, null, 'foot' + L);
      add(new THREE.SphereGeometry(0.03, 10, 8), WHITE, x, 0.030, 0.078, { scale: [1.1, 0.62, 0.9] }, 'foot' + L);
      for (let i = 0; i < 3; i++) {
        add(new THREE.BoxGeometry(0.036, 0.005, 0.006), WHITE, x, 0.063 - i * 0.004, 0.035 + i * 0.016, { x: -0.5 }, 'foot' + L);
      }
    }
  }

  // --- torso ------------------------------------------------------------------
  // Hips to neck in one tube, weights blended hips -> spine -> chest -> neck.
  // Elliptical in section, with a waist and a gentle shoulder slope.
  const TORSO = [
    [0.000, 0.598], [0.070, 0.602], [0.114, 0.614], [0.136, 0.636], [0.138, 0.664],
    [0.124, 0.730], [0.110, 0.800], [0.112, 0.860], [0.120, 0.930], [0.126, 0.990],
    [0.134, 1.030], [0.150, 1.060], [0.157, 1.080], [0.138, 1.108], [0.098, 1.138], [0.056, 1.158],
    [0.036, 1.166], [0.000, 1.170],
  ];
  const TORSO_SZ = 0.74;
  const torsoW = rampY([[0.70, 'hips'], [0.80, 'spine'], [0.90, 'spine'], [1.00, 'chest'], [1.13, 'chest'], [1.17, 'neck']]);
  // The torso's radius at any height, from the same smooth curve the lathe
  // uses, so a panel laid on the front sits exactly on the body.
  const TORSO_PTS = new THREE.SplineCurve(TORSO.map(([r, y]) => new THREE.Vector2(r, y))).getSpacedPoints(240);
  const torsoR = (y) => {
    for (let i = 1; i < TORSO_PTS.length; i++) {
      const a = TORSO_PTS[i - 1];
      const b = TORSO_PTS[i];
      if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y));
    }
    return 0.1;
  };
  /**
   * A flat shape laid on the front of the torso: a shirt in a V, a tie, a
   * zip, a bib. Drawn as its own thin layer (not vertex colours), so its
   * edges are crisp lines rather than a staircase across the body's faces.
   */
  const torsoPanel = (pts, color, push = 0.0024) => {
    const g = subdivide(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px, py))), 2), 4);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = torsoR(y);
      const t = 1 - (x / r) ** 2;
      pos.setZ(i, (t > 0 ? TORSO_SZ * r * Math.sqrt(t) : 0) + push);
    }
    g.computeVertexNormals();
    asLayer(() => add(g, color, 0, 0, 0, null, torsoW));
  };

  /** The torso's colour at a point: the garment, and what shows through it. */
  const torsoColor = (x, y, z) => {
    const front = z > 0;
    const ax = Math.abs(x);
    switch (o) {
      case 'labcoat':
        return y < 0.62 ? legs : cloth;
      case 'uniform':
        return cloth;   // the shirt in the V and the tie are panels (below)
      case 'dress':
        if (front && y > 1.085 && ax < 0.085) return skin;   // a scoop neck
        if (y > 1.1) return skin;                            // straps leave the shoulders bare
        return cloth;
      case 'jumpsuit':
        return cloth;
      case 'hoodie':
        if (y < 0.62) return legs;
        if (y < 0.66) return shade(cloth, 0.85);            // the ribbed hem
        return cloth;
      case 'overalls':
        return y < 0.74 ? legs : cloth;                     // the bib is a panel
      case 'jacket':
        return y < 0.62 ? legs : y < 0.65 ? shade(cloth, 0.86) : cloth;   // the open front is a panel
      case 'skirt':
        return y < 0.70 ? legs : cloth;
      case 'school':
        if (y > 1.10) return WHITE;                          // the blouse at the collar
        return cloth;
      default: // tshirt
        return y < 0.62 ? legs : cloth;
    }
  };
  add(lathe(TORSO, 48, { sz: TORSO_SZ, rows: 64 }), torsoColor, 0, 0, 0, null, torsoW);

  // Panels on the front of the torso.
  if (o === 'labcoat') {
    torsoPanel([[0, 0.915], [0.072, 1.13], [0.035, 1.15], [-0.035, 1.15], [-0.072, 1.13]], SHIRT_BLUE);
  } else if (o === 'uniform') {
    torsoPanel([[0, 0.845], [0.1, 1.13], [0.04, 1.155], [-0.04, 1.155], [-0.1, 1.13]], WHITE);
    torsoPanel([[0, 0.878], [0.0145, 0.905], [0.0085, 1.095], [0.011, 1.12], [-0.011, 1.12], [-0.0085, 1.095], [-0.0145, 0.905]], TIE, 0.003);
  } else if (o === 'jacket') {
    torsoPanel([[-0.026, 0.64], [0.026, 0.64], [0.03, 1.12], [0, 1.14], [-0.03, 1.12]], WHITE);
    torsoPanel([[0.026, 0.64], [0.031, 0.64], [0.035, 1.12], [0.03, 1.12]], 0x9aa3ad, 0.0025);
  } else if (o === 'jumpsuit') {
    torsoPanel([[-0.0035, 0.66], [0.0035, 0.66], [0.0035, 1.13], [-0.0035, 1.13]], 0x9aa3ad, 0.0022);
  } else if (o === 'overalls') {
    torsoPanel([[-0.078, 0.72], [0.078, 0.72], [0.076, 0.975], [0.068, 0.99], [-0.068, 0.99], [-0.076, 0.975]], legs);
    torsoPanel([[-0.05, 0.86], [0.05, 0.86], [0.05, 0.935], [-0.05, 0.935]], shade(legs, 0.88), 0.003);
  }

  // --- neck -----------------------------------------------------------------
  add(lathe([[0.037, 1.13], [0.034, 1.18], [0.032, 1.23], [0.034, 1.27], [0.000, 1.28]], 16, { sz: 0.95 }),
    skin, 0, 0, 0.004, null, rampY([[1.15, 'chest'], [1.19, 'neck'], [1.24, 'neck'], [1.29, 'head']]));

  // --- arms -----------------------------------------------------------------
  const ARM = [
    [0.000, 0.672], [0.022, 0.676], [0.025, 0.700], [0.029, 0.740], [0.033, 0.800],
    [0.031, 0.855], [0.029, 0.885], [0.031, 0.920], [0.036, 0.980], [0.039, 1.040],
    [0.039, 1.066], [0.033, 1.094], [0.017, 1.106], [0.000, 1.110],
  ];
  // Where the sleeve ends, and its colour.
  const sleeveEnd = LONG_SLEEVE ? 0.715 : SLEEVELESS ? 1.2 : 0.96;
  const sleeveColor = o === 'school' ? WHITE : o === 'overalls' ? cloth : cloth;
  for (const side of [-1, 1]) {
    const L = side > 0 ? 'L' : 'R';
    const x = side * 0.175;
    add(lathe(ARM, 20, { sz: 0.92, rows: 34 }), (px, py) => (py >= sleeveEnd ? sleeveColor : skin), x, 0, 0, null,
      rampY([[0.690, 'hand' + L], [0.715, 'forearm' + L], [0.860, 'forearm' + L], [0.920, 'arm' + L], [1.060, 'arm' + L], [1.130, 'chest']]));
    // A cuff where the sleeve ends.
    if (!SLEEVELESS) {
      const cuffColor = o === 'uniform' ? WHITE : shade(sleeveColor, 0.86);
      const r = LONG_SLEEVE ? 0.028 : 0.034;
      add(new THREE.TorusGeometry(r, 0.006, 5, 16), cuffColor, x, sleeveEnd + 0.004, 0,
        { x: Math.PI / 2, scale: [1, 1, 1] }, LONG_SLEEVE ? 'forearm' + L : 'arm' + L);
    }
    // Hands: a palm, the fingers together, and a thumb. Palms face her legs.
    add(roundedBox(0.020, 0.074, 0.046, 0.009, 2), skin, x - side * 0.001, 0.636, 0.004, { z: side * 0.06 }, 'hand' + L);
    add(new THREE.CapsuleGeometry(0.0075, 0.022, 3, 8), skin, x - side * 0.007, 0.650, 0.024, { x: 0.45 }, 'hand' + L);
  }

  // --- garments with their own shape ------------------------------------------
  const hipsW = 'hips';
  /** A skirt or coat tail hanging from the hips. */
  const hang = (profile, color, { segs = 56, open = 0, radial = null, sz = 0.84, inner = null, rows = 14 } = {}) => {
    const opts = { sz, radial, phiStart: open, phiLength: TAU - open * 2, rows };
    // No outline on skirts and coat tails: an inverted-hull outline shows as
    // dark wedges inside every pleat and fold.
    asLayer(() => add(lathe(profile, segs, opts), color, 0, 0, 0, null, hipsW));
    asLayer(() => add(lining(lathe(profile, segs, opts)), inner ?? shade(typeof color === 'number' ? color : cloth, 0.72), 0, 0, 0, null, hipsW));
  };
  /** Soft folds that deepen toward the hem. */
  const folds = (n, amp) => (r, phi, t) => r * (1 + amp * t * Math.sin(phi * n));
  /** Knife pleats: a saw-tooth ripple. */
  const pleats = (n, amp) => (r, phi, t) => {
    const f = ((phi * n) / TAU) % 1;
    return r * (1 + amp * (0.35 + 0.65 * t) * (Math.abs(f - 0.5) * 2 - 0.5));
  };

  if (o === 'labcoat') {
    // The coat's tails, open at the front, with pockets and lapels.
    hang([[0.143, 0.672], [0.150, 0.60], [0.164, 0.50], [0.178, 0.40]], cloth, { open: 0.32, sz: 0.82 });
    for (const side of [-1, 1]) {
      add(roundedBox(0.05, 0.045, 0.01, 0.004), shade(cloth, 0.93), side * 0.098, 0.53, 0.133, { y: side * -0.55 }, hipsW);
      add(new THREE.BoxGeometry(0.014, 0.19, 0.006), shade(cloth, 0.92),
        side * 0.036, 1.03, 0.095, { z: side * 0.33 }, 'chest');
    }
    add(new THREE.TorusGeometry(0.052, 0.012, 6, 18), cloth, 0, 1.15, -0.004, { x: Math.PI / 2 + 0.25 }, 'chest');
    // A name badge.
    add(roundedBox(0.03, 0.018, 0.006, 0.002), 0x3f6fd0, -0.07, 1.02, 0.096, null, 'chest');
  } else if (o === 'uniform') {
    // Pleated skirt (tartan or plain), blazer badge, white collar, tie knot.
    const tartan = c.trousers === 'tartan';
    // Tartan as broad bands the mesh can actually draw: alternate pleats in
    // two shades and two dark stripes round the skirt. (Fine checks smear
    // into a dark band between the vertices, especially in toon shading.)
    const skirtColor = (x, y, z) => {
      if (y < 0.44) return shade(legs, 0.8);
      if (!tartan) return legs;
      const phi = Math.atan2(x, z) + Math.PI;
      const pleat = Math.floor((phi * 18) / TAU) % 2;
      const stripe = Math.abs(y - 0.585) < 0.012 || Math.abs(y - 0.505) < 0.012;
      const base = pleat ? legs : shade(legs, 0.86);
      return stripe ? mix(base, 0x1d2a44, 0.6) : base;
    };
    hang([[0.136, 0.675], [0.160, 0.60], [0.205, 0.50], [0.232, 0.425]], skirtColor, { radial: pleats(18, 0.08), inner: shade(legs, 0.6), rows: 40 });
    add(new THREE.TorusGeometry(0.05, 0.011, 6, 18), WHITE, 0, 1.152, 0.004, { x: Math.PI / 2 + 0.25 }, 'chest');
    add(roundedBox(0.026, 0.02, 0.012, 0.004), TIE, 0, 1.118, 0.052, null, 'chest');
    add(roundedBox(0.034, 0.038, 0.006, 0.004), 0xd9b04a, -0.075, 1.0, 0.097, null, 'chest');
    // Blazer lapels.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.016, 0.22, 0.006), shade(cloth, 0.88), side * 0.05, 0.98, 0.094, { z: side * 0.36 }, 'chest');
    }
    // Two buttons below the V.
    for (const y of [0.80, 0.74]) add(new THREE.SphereGeometry(0.007, 8, 6), 0xd9b04a, 0.012, y, 0.083, null, 'spine');
  } else if (o === 'dress') {
    // A sash at the waist and a full skirt with soft folds.
    hang([[0.112, 0.745], [0.130, 0.70], [0.190, 0.58], [0.262, 0.44], [0.282, 0.395]],
      (x, y) => (y < 0.415 ? shade(cloth, 1.12) : cloth), { radial: folds(11, 0.075), sz: 0.86 });
    add(lathe([[0.114, 0.73], [0.114, 0.765]], 22, { sz: TORSO_SZ + 0.02 }), accent === WHITE ? 0xf4f6f8 : accent, 0, 0, 0, null, 'spine');
    add(new THREE.SphereGeometry(0.02, 10, 8), accent, 0.07, 0.75, 0.078, { scale: [1.4, 0.8, 0.6] }, 'spine');
    // Narrow straps over the shoulders.
    for (const side of [-1, 1]) {
      add(strandGeo([
        new THREE.Vector3(side * 0.07, 1.075, 0.104),
        new THREE.Vector3(side * 0.095, 1.132, 0.03),
        new THREE.Vector3(side * 0.095, 1.132, -0.03),
        new THREE.Vector3(side * 0.07, 1.075, -0.104),
      ], { w0: 0.018, w1: 0.018, th: 0.006, sides: 4, out: (p, t) => t.set(p.x * 0.4, p.y - 1.0, p.z), tipTaper: 0.01 }),
      cloth, 0, 0, 0, null, 'chest');
    }
  } else if (o === 'jumpsuit') {
    add(lathe([[0.143, 0.645], [0.143, 0.685]], 24, { sz: TORSO_SZ + 0.03 }), DARK, 0, 0, 0, null, 'hips');
    add(roundedBox(0.03, 0.024, 0.01, 0.003), 0xc9a23a, 0, 0.665, 0.108, null, 'hips');
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16), accent, -0.07, 1.02, 0.095, { x: Math.PI / 2 }, 'chest');
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 16), 0x2f5fb8, 0.07, 1.02, 0.095, { x: Math.PI / 2 }, 'chest');
    add(new THREE.TorusGeometry(0.05, 0.013, 6, 18), shade(cloth, 0.86), 0, 1.15, 0, { x: Math.PI / 2 + 0.2 }, 'chest');
    // Knee pads read as a flight suit at the game's distance.
    for (const side of [-1, 1]) {
      add(new THREE.SphereGeometry(0.03, 10, 8), shade(cloth, 0.82), side * 0.085, 0.31, 0.03, { scale: [1, 1.1, 0.5] }, side > 0 ? 'shinL' : 'shinR');
    }
  } else if (o === 'hoodie') {
    // The hood lying on her shoulders (under long hair, so left off), a
    // kangaroo pocket, drawstrings.
    if (c.hairStyle !== 'long') {
      add(new THREE.SphereGeometry(0.105, 16, 10, 0, TAU, 0, Math.PI * 0.62), shade(cloth, 0.92),
        0, 1.15, -0.085, { scale: [1.05, 0.62, 0.8], x: -0.35 }, 'chest');
    }
    add(roundedBox(0.15, 0.075, 0.018, 0.012), shade(cloth, 0.93), 0, 0.73, 0.094, null, 'spine');
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.003, 0.003, 0.10, 5), WHITE, side * 0.028, 1.07, 0.098, null, 'chest');
      add(new THREE.SphereGeometry(0.006, 6, 5), WHITE, side * 0.028, 1.02, 0.099, null, 'chest');
    }
  } else if (o === 'overalls') {
    // Straps over the shoulders, brass buttons on the bib.
    for (const side of [-1, 1]) {
      add(strandGeo([
        new THREE.Vector3(side * 0.06, 0.985, 0.094),
        new THREE.Vector3(side * 0.085, 1.11, 0.05),
        new THREE.Vector3(side * 0.085, 1.12, -0.03),
        new THREE.Vector3(side * 0.05, 0.92, -0.095),
      ], { w0: 0.026, w1: 0.026, th: 0.006, sides: 4, out: (p, t) => t.set(p.x * 0.4, p.y - 1.0, p.z), tipTaper: 0.01 }),
      legs, 0, 0, 0, null, 'chest');
      add(new THREE.SphereGeometry(0.008, 8, 6), 0xd9b04a, side * 0.058, 0.975, 0.097, null, 'chest');
    }
  } else if (o === 'jacket') {
    add(new THREE.TorusGeometry(0.055, 0.016, 6, 18), shade(cloth, 0.9), 0, 1.15, -0.004, { x: Math.PI / 2 + 0.25 }, 'chest');
    for (const side of [-1, 1]) {
      add(roundedBox(0.045, 0.04, 0.01, 0.004), shade(cloth, 0.9), side * 0.075, 0.70, 0.093, null, 'spine');
    }
  } else if (o === 'skirt') {
    hang([[0.120, 0.705], [0.150, 0.62], [0.200, 0.52], [0.222, 0.465]], (x, y) => (y < 0.48 ? shade(legs, 0.8) : legs), { radial: folds(7, 0.04) });
    add(lathe([[0.121, 0.69], [0.121, 0.72]], 22, { sz: TORSO_SZ + 0.02 }), DARK, 0, 0, 0, null, 'hips');
  } else if (o === 'school') {
    // The pinafore's skirt, a white collar and a small tie.
    hang([[0.140, 0.66], [0.165, 0.60], [0.225, 0.49], [0.262, 0.425]], (x, y) => (y < 0.44 ? shade(cloth, 0.84) : cloth), { radial: pleats(10, 0.05) });
    add(new THREE.TorusGeometry(0.05, 0.012, 6, 18), WHITE, 0, 1.15, 0.004, { x: Math.PI / 2 + 0.25 }, 'chest');
    add(roundedBox(0.022, 0.05, 0.008, 0.003), TIE, 0, 1.09, 0.068, null, 'chest');
  } else {
    // T-shirt: a crew neck.
    add(new THREE.TorusGeometry(0.046, 0.008, 6, 18), shade(cloth, 0.86), 0, 1.158, 0.004, { x: Math.PI / 2 + 0.25 }, 'chest');
  }

  // --- head ---------------------------------------------------------------------
  const headY = HEAD_Y;
  // The cheeks are warmer than the rest of the face: painted into the skull's
  // own vertices as a soft falloff, which never shows an edge.
  const BLUSH_C = mix(skin, 0xf07a86, 0.2);
  const headSkin = (x, y, z) => {
    if (z < 0) return skin;
    const d = Math.min(...[-1, 1].map((sd) => Math.hypot((x - sd * 0.058) / 0.024, (y - headY + 0.036) / 0.016)));
    return d < 1 ? mix(skin, BLUSH_C, smooth(1 - d)) : skin;
  };
  add(sculptHead(new THREE.SphereGeometry(HEAD_R, 48, 36), 1, HEAD_SY), headSkin, 0, headY, 0, null, 'head');

  // Ears, set against the skull.
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(0.026, 10, 8), skin, side * 0.118, headY - 0.02, -0.01, { scale: [0.42, 1.12, 0.8] }, 'head');
    add(new THREE.SphereGeometry(0.016, 8, 6), shade(skin, 0.84), side * 0.121, headY - 0.021, -0.006, { scale: [0.36, 0.95, 0.7] }, 'head');
  }

  // --- face -------------------------------------------------------------------
  // Drawn in thin layers that WRAP the skull: each is a flat 2-D shape in face
  // coordinates (x across, dy up from the centre of the head), then every
  // vertex is pushed onto the face surface plus a small lift. The lifts are
  // the stacking order (skin < blush < sclera < iris < pupil < catchlight <
  // lids < lashes), so nothing z-fights and nothing floats.
  const decal = (pts, color, push, opts = {}) => asLayer(() => decalRaw(pts, color, push, opts));
  const decalRaw = (pts, color, push, { bulge = 0, cx = 0, cy = 0, rx = 1 } = {}) => {
    const shape = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px, py)));
    const g = new THREE.ShapeGeometry(shape, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const q = Math.min(1, ((px - cx) / rx) ** 2 + ((py - cy) / rx) ** 2);
      pos.setXYZ(i, px, headY + py, faceZ(px, py) + push + bulge * (1 - q));
    }
    add(g, color, 0, 0, 0, null, 'head');
  };
  const ellipsePts = (cx, cy, rx, ry, n = 18, rot = 0) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      out.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
    }
    return out;
  };
  /** A band that follows a curve, with thickness varying along it. */
  const bandPts = (curve, thick, n = 14) => {
    const top = [];
    const bot = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [px, py] = curve(t);
      const [qx, qy] = curve(Math.min(1, t + 0.01));
      const [rx0, ry0] = curve(Math.max(0, t - 0.01));
      let nx = -(qy - ry0);
      let ny = qx - rx0;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      const h = thick(t) / 2;
      top.push([px + nx * h, py + ny * h]);
      bot.push([px - nx * h, py - ny * h]);
    }
    return top.concat(bot.reverse());
  };

  const EYE_X = 0.046;
  const EYE_Y = -0.010;
  const EYE_W = 0.0185;   // half-width of the opening
  const EYE_H = 0.0098;   // half-height of the opening at its tallest
  const LIP = mix(skin, 0xc4474f, 0.5);
  const LIP_DARK = mix(skin, 0x6b2228, 0.55);
  const LASH = mix(hair, 0x120b08, 0.7);
  const BROW = mix(hair, 0x1a120d, 0.25);

  for (const side of [-1, 1]) {
    const ex = side * EYE_X;
    // The opening: upper lid arcs higher toward the outer corner (a gentle
    // almond with a lift), the lower lid is shallower.
    const upper = (t) => {
      // t 0 = inner corner, 1 = outer corner
      const x = ex + side * (-EYE_W + 2 * EYE_W * t);
      const lift = 0.0018 * t;
      return [x, EYE_Y + lift + EYE_H * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.94 + 0.02)), 0.85)];
    };
    const lower = (t) => {
      const x = ex + side * (-EYE_W + 2 * EYE_W * t);
      return [x, EYE_Y + 0.0018 * t - EYE_H * 0.62 * Math.pow(Math.sin(Math.PI * t), 1.1)];
    };
    const opening = [];
    for (let i = 0; i <= 16; i++) opening.push(upper(i / 16));
    for (let i = 15; i >= 1; i--) opening.push(lower(i / 16));

    // Sclera, slightly domed like an eyeball.
    decal(opening, 0xf3eeea, 0.0010, { bulge: 0.0016, cx: ex, cy: EYE_Y, rx: EYE_W });
    // Iris with a darker rim and lighter centre, pupil, two catchlights.
    const irisC = [ex + side * 0.0012, EYE_Y + 0.0012];
    const IR = 0.0086;
    const irisColor = (x, y) => {
      const d = Math.hypot(x - irisC[0], y - (headY + irisC[1])) / IR;
      return d > 0.82 ? shade(iris, 0.55) : mix(iris, shade(iris, 1.35), Math.max(0, 0.55 - d) * 1.2);
    };
    decal(ellipsePts(irisC[0], irisC[1], IR, IR, 22), irisColor, 0.0024, { bulge: 0.0014, cx: irisC[0], cy: irisC[1], rx: IR });
    decal(ellipsePts(irisC[0], irisC[1], 0.0038, 0.0038, 14), 0x0c0908, 0.0030, { bulge: 0.0014, cx: irisC[0], cy: irisC[1], rx: IR });
    decal(ellipsePts(irisC[0] - side * 0.0028, irisC[1] + 0.0032, 0.0017, 0.0017, 10), 0xffffff, 0.0036, { bulge: 0.0014, cx: irisC[0], cy: irisC[1], rx: IR });
    decal(ellipsePts(irisC[0] + side * 0.0026, irisC[1] - 0.0028, 0.0008, 0.0008, 8), 0xf2f2f2, 0.0036, { bulge: 0.0014, cx: irisC[0], cy: irisC[1], rx: IR });

    // Lids: skin bands above and below the opening that trim the iris where
    // it runs past the lid line, as a real lid covers the top of the iris.
    const lidUp = [];
    for (let i = 0; i <= 16; i++) lidUp.push(upper(i / 16));
    for (let i = 16; i >= 0; i--) { const [px, py] = upper(i / 16); lidUp.push([px, py + 0.0075]); }
    decal(lidUp, shade(skin, 0.97), 0.0040);
    const lidDn = [];
    for (let i = 0; i <= 16; i++) lidDn.push(lower(i / 16));
    for (let i = 16; i >= 0; i--) { const [px, py] = lower(i / 16); lidDn.push([px, py - 0.0045]); }
    decal(lidDn, skin, 0.0038);

    // The lash line: thin at the inner corner, heavier at the outer, with a
    // small flick past the corner; a few lashes at the outer half.
    decal(bandPts((t) => {
      if (t <= 0.92) return upper(t / 0.92);
      const [px, py] = upper(1);
      const k = (t - 0.92) / 0.08;
      return [px + side * 0.004 * k, py + 0.0026 * k];
    }, (t) => 0.0011 + 0.0026 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.1)) * (0.5 + t)), LASH, 0.0046);
    for (let i = 0; i < 4; i++) {
      const t = 0.55 + i * 0.12;
      const [px, py] = upper(t);
      const len = 0.0032 + i * 0.0006;
      const ang = Math.PI / 2 - side * (0.35 + i * 0.22);
      decal([[px - 0.0006, py], [px + 0.0006, py], [px + Math.cos(ang) * len, py + Math.sin(ang) * len]], LASH, 0.0048);
    }
    // A faint lower lash line on the outer two thirds, and the lid crease.
    decal(bandPts((t) => lower(0.35 + t * 0.62), () => 0.0007), mix(LASH, skin, 0.45), 0.0042);
    decal(bandPts((t) => { const [px, py] = upper(0.18 + t * 0.76); return [px, py + 0.0058 + 0.0006 * t]; }, () => 0.0007),
      shade(skin, 0.83), 0.0041);

    // Brows: tapered, arched, a clear gap between them.
    const brow = (t) => [side * (0.016 + 0.046 * t), EYE_Y + 0.024 + 0.0075 * Math.sin(Math.PI * Math.min(1, t * 0.82 + 0.05)) - 0.0035 * t];
    decal(bandPts(brow, (t) => 0.0056 * (1 - t) + 0.0016), BROW, 0.0018);

  }

  // Nose: a height field laid over the face. At its edge it is flush with the
  // skin, so it grows out of the face instead of being stuck on: a soft
  // bridge, a rounded tip, two small wings, and nostrils painted underneath.
  {
    const NX = 0.026;
    const NY0 = -0.062;
    const NY1 = 0.004;
    const g = new THREE.PlaneGeometry(NX * 2, NY1 - NY0, 36, 48);
    const pos = g.attributes.position;
    const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
    const height = (x, y) => {
      const t = Math.max(0, Math.min(1, (EYE_Y + 0.004 - y) / 0.04));   // 0 at the brow line, 1 at the tip
      const bridge = (0.0016 + 0.0062 * t * t) * Math.exp(-((x / (0.0045 + 0.0024 * t)) ** 2)) * smooth((EYE_Y + 0.008 - y) / 0.012);
      const tip = 0.0085 * gauss(x, y, 0, EYE_Y - 0.037, 0.0078, 0.0066);
      const wings = 0.0046 * (gauss(x, y, 0.0102, EYE_Y - 0.0405, 0.0046, 0.0040) + gauss(x, y, -0.0102, EYE_Y - 0.0405, 0.0046, 0.0040));
      const under = y < EYE_Y - 0.041 ? Math.max(0, 1 - (EYE_Y - 0.041 - y) / 0.006) : 1;   // tuck in under the tip
      const edge = smooth(Math.min(1, (NX - Math.abs(x)) / 0.006)) * smooth(Math.min(1, (y - NY0) / 0.006)) * smooth(Math.min(1, (NY1 - y) / 0.008));
      return Math.max(bridge * (y > EYE_Y - 0.038 ? 1 : under), tip * under, wings * under) * edge;
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i) + (NY0 + NY1) / 2;
      pos.setXYZ(i, x, headY + y, faceZ(x, y) - 0.0014 + height(x, y) * 1.15);
    }
    const NOSTRIL = shade(skin, 0.7);
    const noseColor = (x, y) => {
      const dy = y - headY;
      for (const sd of [-1, 1]) {
        if ((((x - sd * 0.0064) / 0.0021) ** 2 + ((dy - (EYE_Y - 0.0442)) / 0.0010) ** 2) < 1) return NOSTRIL;
      }
      return skin;
    };
    asLayer(() => add(g, noseColor, 0, 0, 0, null, 'head'));
  }

  // A soft shadow under the nose, where the philtrum starts.

  // Lips: an upper lip with a cupid's bow, a fuller lower lip, the line
  // between, and a small highlight.
  const MOUTH_Y = -0.077;
  const MW = 0.019;
  // A slight smile: every lip edge lifts toward the corners (a parabola, so
  // the middle stays put and the corners turn up). Kept small - a gentle,
  // friendly look, not a grin.
  const SMILE = 0.0036;
  const lift = (x) => SMILE * (x / MW) ** 2;
  const smiled = (pts) => pts.map(([px, py]) => [px, py + lift(px)]);
  const upperLip = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * 2 - 1;                 // -1 .. 1 across
    const bow = 0.0042 - 0.0018 * Math.exp(-(t * t) / 0.02) + 0.0008 * Math.exp(-((Math.abs(t) - 0.32) ** 2) / 0.02);
    upperLip.push([t * MW, MOUTH_Y + bow * (1 - t * t) ** 0.55]);
  }
  for (let i = 20; i >= 0; i--) {
    const t = (i / 20) * 2 - 1;
    upperLip.push([t * MW * 0.98, MOUTH_Y - 0.0006 * (1 - t * t)]);
  }
  decal(smiled(upperLip), shade(LIP, 0.92), 0.0022, { bulge: 0.0014, cx: 0, cy: MOUTH_Y + 0.002, rx: MW });
  const lowerLip = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * 2 - 1;
    lowerLip.push([t * MW * 0.98, MOUTH_Y - 0.0006 * (1 - t * t)]);
  }
  for (let i = 20; i >= 0; i--) {
    const t = (i / 20) * 2 - 1;
    lowerLip.push([t * MW * 0.9, MOUTH_Y - 0.0074 * (1 - t * t) ** 0.7]);
  }
  decal(smiled(lowerLip), LIP, 0.0024, { bulge: 0.0022, cx: 0, cy: MOUTH_Y - 0.004, rx: MW });
  decal(bandPts((t) => { const x = (t * 2 - 1) * MW * 1.04; return [x, MOUTH_Y - 0.0006 * (1 - (t * 2 - 1) ** 2) + 0.0012 * (t * 2 - 1) ** 4 + lift(x)]; }, (t) => 0.0011 * (1 - 0.5 * Math.abs(t * 2 - 1))),
    LIP_DARK, 0.0040);
  decal(ellipsePts(0.003, MOUTH_Y - 0.0038, 0.004, 0.0011, 10), mix(LIP, 0xffffff, 0.35), 0.0048);
  // Smile tucks: a short soft crease curling up at each corner of the mouth.
  for (const side of [-1, 1]) {
    const x0 = side * MW * 1.02;
    decal(bandPts((t) => [x0 + side * 0.0022 * t, MOUTH_Y + lift(x0) + 0.0006 + 0.0022 * t * t], (t) => 0.0009 * (1 - 0.6 * t), 6),
      shade(skin, 0.8), 0.0030);
  }

  // Freckles across the nose and cheeks.
  if (c.freckles === 'some') {
    const FRECKLE = shade(skin, 0.74);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const fx = side * (0.014 + R() * 0.05);
      const fy = -0.022 - R() * 0.024;
      decal(ellipsePts(fx, fy, 0.0015 + R() * 0.0007, 0.0013, 6), FRECKLE, 0.0022);
    }
  }

  // --- hair -----------------------------------------------------------------------
  // A scalp shell in a slightly darker tone (the shadowed roots), then locks of
  // hair laid over it. Each lock is a tapered, flattened tube that follows the
  // head; small colour variation between locks reads as strands in the light.
  const HAIR_DEEP = shade(hair, 0.78);
  const lockColor = () => mix(hair, R() < 0.5 ? shade(hair, 1.22) : shade(hair, 0.86), R() * 0.6);
  /**
   * Where the hair starts, as a height u on the skull for each direction:
   * high on the forehead, lower at the temples, down to the top of the ear in
   * front of it, and lowest at the nape. `drop` lowers the whole line (0 =
   * as drawn).
   */
  const hairline = (theta, drop = 0) => {
    const a = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta)));   // 0 = front, PI = back
    const table = [[0, 0.56], [0.55, 0.50], [0.95, 0.24], [1.3, 0.02], [1.65, -0.12], [2.2, -0.36], [Math.PI, -0.46]];
    return curveAt(table.map(([t, u]) => [t / Math.PI * 2 - 1, u]), a / Math.PI * 2 - 1) - drop;
  };
  /** The scalp: a shell over the skull whose lower edge IS the hairline. */
  const scalp = (drop = 0, inflate = 1.035) => {
    const g = new THREE.SphereGeometry(HEAD_R, 40, 28);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const theta = Math.atan2(x, z);
      const u = Math.max(-1, Math.min(1, pos.getY(i) / HEAD_R));
      // Everything below the hairline is folded up onto it: the shell ends in
      // a clean curve instead of a cut edge.
      const hl = hairline(theta, drop);
      const p = headPoint(theta, Math.max(u, hl), inflate, HEAD_SY * 1.03);
      pos.setXYZ(i, p.x, p.y - HEAD_Y, p.z);
    }
    add(g, HAIR_DEEP, 0, headY + 0.002, -0.002, null, 'head');
  };
  const lock = (pts, opts, bone = 'head') => add(strandGeo(pts, opts), lockColor(), 0, 0, 0, null, bone);
  const PART = 0.3; // a side parting, a little to her left

  /** Locks from the crown over the head and down to `endY`, round the back and sides. */
  const fall = (n, endY, { spread = [0.55, TAU - 0.55], inflate = 1.1, curl = 0.9, w = 0.075, th = 0.022, back = null } = {}) => {
    for (let i = 0; i < n; i++) {
      const theta = spread[0] + (spread[1] - spread[0]) * (i / (n - 1)) + (R() - 0.5) * 0.06;
      const root = headPoint(PART + (theta - PART) * 0.18, 0.93, 1.0);
      const a = headPoint(theta, 0.62, inflate);
      const b = headPoint(theta, 0.10, inflate + 0.03);
      const pts = [root, a, b];
      if (endY < headY - 0.02) {
        const cx = b.x * (1.02 + 0.02 * R());
        let cz = b.z * 1.02;
        const midY = (b.y + endY) / 2;
        if (back !== null) cz = Math.min(cz, back);
        pts.push(new THREE.Vector3(cx, midY, cz));
        pts.push(new THREE.Vector3(cx * curl, endY + (R() - 0.5) * 0.012, cz * curl + (back !== null ? 0 : 0.004)));
      }
      lock(pts, { w0: w, w1: w * 0.9, th, seg: 6, tipTaper: 0.14 });
    }
  };
  /** A fringe: locks from the hairline down over the forehead, swept aside. */
  const fringe = (n = 9, low = 0.026, sweep = 0.03) => {
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * 2 - 1;
      const theta = t * 0.62;
      const root = headPoint(PART + theta * 0.4, 0.9, 1.0);
      const a = headPoint(theta, 0.62, 1.07);
      const endX = a.x + sweep * (1 - Math.abs(t)) + (R() - 0.5) * 0.006;
      const endDy = low + Math.abs(t) * 0.02 + R() * 0.008;
      const end = new THREE.Vector3(endX, headY + endDy, faceZ(endX, endDy) + 0.011);
      const mid = new THREE.Vector3((a.x + endX) / 2, headY + (a.y - headY + endDy) / 2 + 0.01, faceZ((a.x + endX) / 2, (a.y - headY + endDy) / 2) + 0.016);
      lock([root, a, mid, end], { w0: 0.05, w1: 0.036, th: 0.013, seg: 5, tipTaper: 0.22 });
    }
  };
  /** Hair swept from all round the hairline to one point (a ponytail tie, a bun). */
  const gather = (n, to, { inflate = 1.06 } = {}) => {
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * TAU;
      const front = Math.cos(theta) > 0.4;
      const root = headPoint(theta, front ? 0.72 : 0.2, 1.0);
      const p = headPoint(theta, front ? 0.85 : 0.45, inflate);
      // Half-way to the tie, but back on the shell: straight lines between
      // the two would cut through the skull.
      const mid = onShell(p.clone().lerp(to, 0.5), inflate + 0.02);
      lock([root, p, mid, to], { w0: 0.046, w1: 0.03, th: 0.014, seg: 5, tipTaper: 0.12 });
    }
  };
  /** A hanging bunch of locks from `from` down to `endY`, with a gentle wave. */
  const tail = (from, dir, endY, n = 9, width = 0.034, boneFn = 'head') => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const off = new THREE.Vector3(Math.cos(a) * 0.012, 0, Math.sin(a) * 0.012);
      const len = from.y - endY;
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const wave = Math.sin(t * Math.PI * 1.5 + i) * 0.006;
        pts.push(new THREE.Vector3(
          from.x + off.x * (1 + t) + dir.x * len * t + wave,
          from.y - len * t,
          from.z + off.z * (1 + t) + dir.z * len * t * (1 - 0.4 * t)));
      }
      add(strandGeo(pts, { w0: width, w1: width * 0.6, th: 0.014, seg: 5, out: (p, tgt) => tgt.set(p.x - from.x, 0.001, p.z - from.z + 0.001) }),
        lockColor(), 0, 0, 0, null, boneFn);
    }
  };
  const tieBand = (at, r = 0.022, rotX = 0) => add(new THREE.TorusGeometry(r, 0.0065, 6, 14), accent, at.x, at.y, at.z, { x: rotX }, 'head');

  const style = c.hairStyle;
  if (style === 'bob') {
    scalp();
    fall(36, headY - 0.118, { curl: 0.86, spread: [0.92, TAU - 0.92] });
    fringe();
  } else if (style === 'long') {
    scalp();
    // The sides frame the face to the jaw; the back falls from the crown to
    // below the shoulder blades, its lower half following the chest.
    fall(10, headY - 0.13, { curl: 0.95, spread: [0.92, 1.9] });
    fall(10, headY - 0.13, { curl: 0.95, spread: [TAU - 1.9, TAU - 0.92] });
    const chestFollow = rampY([[1.17, 'chest'], [1.27, 'head']]);
    for (let i = 0; i < 26; i++) {
      const theta = Math.PI * 0.52 + (Math.PI * 0.96) * (i / 25) + (R() - 0.5) * 0.04;
      const root = headPoint(PART + (theta - PART) * 0.18, 0.93, 1.0);
      const a = headPoint(theta, 0.55, 1.1);
      const b = headPoint(theta, -0.15, 1.12);
      const x = Math.sin(theta) * 0.11;
      lock([root, a, b,
        new THREE.Vector3(x * 1.08, 1.16, Math.min(b.z, -0.07)),
        new THREE.Vector3(x, 1.03, -0.118),
        new THREE.Vector3(x * 0.92, 0.9 + R() * 0.02, -0.112)],
      { w0: 0.06, w1: 0.05, th: 0.018, seg: 6, tipTaper: 0.14 }, chestFollow);
    }
    fringe(9, 0.03, 0.035);
  } else if (style === 'ponytail') {
    scalp(0);
    const tie = headPoint(Math.PI, 0.42, 1.12);
    gather(24, tie);
    tieBand(tie, 0.02, Math.PI / 2 - 0.4);
    tail(tie.clone().add(new THREE.Vector3(0, -0.005, -0.012)), new THREE.Vector3(0, 0, -0.22), headY - 0.32, 11, 0.036);
    fringe(7, 0.034, 0.02);
  } else if (style === 'bunches') {
    scalp(0);
    for (const side of [-1, 1]) {
      const tie = headPoint(side * Math.PI * 0.58, 0.18, 1.12);
      gather(12, tie);
      tieBand(tie, 0.018, 0);
      tail(tie, new THREE.Vector3(side * 0.1, 0, -0.05), headY - 0.22, 8, 0.03);
    }
    fringe();
  } else if (style === 'braids') {
    scalp(0);
    fall(26, headY - 0.07, { curl: 0.96, w: 0.06, spread: [0.92, TAU - 0.92] });
    fringe(9, 0.03, 0.025);
    // Two plaits from behind the ears, over the shoulders to the front.
    const plaitW = rampY([[1.16, 'chest'], [1.25, 'head']]);
    for (const side of [-1, 1]) {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.112, headY - 0.06, -0.035),
        new THREE.Vector3(side * 0.13, 1.19, -0.005),
        new THREE.Vector3(side * 0.128, 1.09, 0.06),
        new THREE.Vector3(side * 0.118, 0.95, 0.098),
      ]);
      const N = 16;
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1);
        const p = path.getPointAt(t);
        const tan = path.getTangentAt(t);
        const r = 0.021 * (1 - t * 0.35);
        const g = new THREE.SphereGeometry(r, 10, 8);
        g.scale(1.05, 1.35, 0.9);
        // Alternate left and right, which is what makes it read as a plait.
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tan);
        g.applyQuaternion(q);
        add(g, k % 2 ? hair : shade(hair, 1.12), p.x + (k % 2 ? 0.006 : -0.006) * side * 0.6, p.y, p.z, { z: (k % 2 ? 0.35 : -0.35) }, plaitW);
      }
      const end = path.getPointAt(1);
      add(new THREE.TorusGeometry(0.014, 0.005, 6, 12), accent, end.x, end.y - 0.004, end.z, { x: Math.PI / 2 }, plaitW);
      tail(new THREE.Vector3(end.x, end.y - 0.008, end.z), new THREE.Vector3(0, 0, 0.02), end.y - 0.06, 6, 0.016, plaitW);
    }
  } else if (style === 'curls') {
    scalp(0, 1.05);
    for (let i = 0; i < 56; i++) {
      const theta = R() * TAU;
      const front = Math.cos(theta);
      const u = front > 0.55 ? 0.5 + R() * 0.5 : -0.35 + R() * 1.3;
      const p = headPoint(theta, u, 1.12 + R() * 0.08);
      const r = 0.030 + R() * 0.016;
      add(new THREE.SphereGeometry(r, 9, 7), lockColor(), p.x, p.y, p.z, null, 'head');
    }
    for (let i = 0; i < 9; i++) {
      const t = (i / 8) * 2 - 1;
      const p = headPoint(t * 0.6, 0.7 - Math.abs(t) * 0.1, 1.09);
      add(new THREE.SphereGeometry(0.026, 9, 7), lockColor(), p.x, p.y, p.z, null, 'head');
    }
  } else if (style === 'bun') {
    scalp(0);
    const top = new THREE.Vector3(0, headY + HEAD_R * HEAD_SY * 1.08, -0.035);
    gather(26, top, { inflate: 1.05 });
    // The bun itself: a coiled rope.
    const coil = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const a = t * TAU * 2.2;
      const r = 0.05 * (1 - t * 0.55);
      coil.push(new THREE.Vector3(Math.cos(a) * r, headY + HEAD_R * HEAD_SY * 1.12 + t * 0.06, -0.035 + Math.sin(a) * r));
    }
    add(strandGeo(coil, { w0: 0.034, w1: 0.03, th: 0.03, sides: 8, seg: 2, out: (p, tgt) => tgt.set(0, 1, 0), tipTaper: 0.08 }), hair, 0, 0, 0, null, 'head');
    add(new THREE.SphereGeometry(0.036, 12, 10), shade(hair, 0.95), 0, headY + HEAD_R * HEAD_SY * 1.17, -0.035, { scale: [1, 0.9, 1] }, 'head');
    tieBand(new THREE.Vector3(0, headY + HEAD_R * HEAD_SY * 1.09, -0.035), 0.036, Math.PI / 2);
    fringe(7, 0.04, 0.02);
  } else {
    // Short: a pixie cut - short locks round the head, a nape, a side fringe.
    scalp(0);
    fall(24, headY - 0.02, { w: 0.06, th: 0.016, inflate: 1.08, spread: [0.9, TAU - 0.9] });
    fringe(8, 0.036, 0.04);
  }

  // --- hair accessories -----------------------------------------------------
  if (c.hairAccessory === 'headband') {
    // Ear to ear over the top of the head, a little in front of the crown.
    const band = [];
    const lift = 1.13 + (style === 'curls' ? 0.1 : 0);
    for (let k = 0; k <= 18; k++) {
      const a = -Math.PI / 2 + (k / 18) * Math.PI;
      band.push(headPoint(Math.atan2(Math.sin(a), 0.3), Math.cos(a) * 0.92, lift));
    }
    add(strandGeo(band, { w0: 0.016, w1: 0.016, th: 0.008, sides: 6, seg: 2, tipTaper: 0.02 }), accent, 0, 0, 0, null, 'head');
  } else if (c.hairAccessory === 'bow') {
    const at = headPoint(0.9, 0.72, 1.12);
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.024, 10, 8), accent, at.x + s * 0.02, at.y + s * 0.006, at.z, { scale: [1.1, 0.72, 0.45], z: s * 0.35 }, 'head');
    }
    add(new THREE.SphereGeometry(0.01, 8, 6), shade(accent, 0.85), at.x, at.y, at.z + 0.004, null, 'head');
  } else if (c.hairAccessory === 'clips') {
    for (const s of [-1, 1]) {
      const at = headPoint(s * 0.72, 0.62, 1.12);
      add(roundedBox(0.026, 0.008, 0.008, 0.003), accent, at.x, at.y, at.z, { z: s * 0.5 }, 'head');
      add(roundedBox(0.026, 0.008, 0.008, 0.003), shade(accent, 1.1), at.x, at.y - 0.012, at.z, { z: s * 0.3 }, 'head');
    }
  }

  // --- glasses ----------------------------------------------------------------
  if (c.glasses !== 'none') {
    const z = faceZ(EYE_X, EYE_Y) + 0.010;
    if (c.glasses === 'round') {
      for (const side of [-1, 1]) add(new THREE.TorusGeometry(0.022, 0.0028, 6, 22), frame, side * EYE_X, headY + EYE_Y, z, null, 'head');
    } else if (c.glasses === 'square') {
      for (const side of [-1, 1]) {
        const cx = side * EYE_X;
        for (const dy of [-0.016, 0.017]) add(new THREE.BoxGeometry(0.046, 0.0045, 0.005), frame, cx, headY + EYE_Y + dy, z, null, 'head');
        for (const dx of [-0.0225, 0.0225]) add(new THREE.BoxGeometry(0.0045, 0.037, 0.005), frame, cx + dx, headY + EYE_Y, z, null, 'head');
      }
    } else {
      for (const side of [-1, 1]) {
        add(new THREE.TorusGeometry(0.025, 0.006, 6, 20), frame, side * EYE_X, headY + EYE_Y, z - 0.002, null, 'head');
        add(new THREE.CylinderGeometry(0.027, 0.027, 0.014, 18, 1, true), frame, side * EYE_X, headY + EYE_Y, z - 0.009, { x: Math.PI / 2 }, 'head');
      }
      // The strap, round the back of the head from temple to temple.
      const strap = [];
      for (let k = 0; k <= 16; k++) strap.push(headPoint(1.25 + (k / 16) * (TAU - 2.5), -0.02, 1.15));
      add(strandGeo(strap, { w0: 0.012, w1: 0.012, th: 0.005, sides: 4, seg: 2, tipTaper: 0.02 }), frame, 0, 0, 0, null, 'head');
    }
    add(new THREE.BoxGeometry(0.018, 0.0035, 0.004), frame, 0, headY + EYE_Y + 0.004, z - 0.001, null, 'head');
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.0035, 0.0035, 0.085), frame, side * 0.1, headY + EYE_Y + 0.006, 0.058, { y: side * 0.32 }, 'head');
    }
  }

  // --- backpack -------------------------------------------------------------------
  if (c.backpack === 'yes') {
    add(roundedBox(0.19, 0.25, 0.10, 0.03), pack, 0, 0.93, -0.155, null, 'chest');
    add(roundedBox(0.14, 0.09, 0.03, 0.012), shade(pack, 0.88), 0, 0.87, -0.212, null, 'chest');
    add(roundedBox(0.16, 0.05, 0.02, 0.01), shade(pack, 1.12), 0, 1.035, -0.2, { x: 0.2 }, 'chest');
    for (const side of [-1, 1]) {
      add(strandGeo([
        new THREE.Vector3(side * 0.07, 1.04, -0.12),
        new THREE.Vector3(side * 0.085, 1.12, -0.03),
        new THREE.Vector3(side * 0.085, 1.10, 0.06),
        new THREE.Vector3(side * 0.075, 0.95, 0.098),
      ], { w0: 0.026, w1: 0.024, th: 0.007, sides: 4, out: (p, t) => t.set(p.x * 0.4, p.y - 1.0, p.z), tipTaper: 0.01 }),
      shade(pack, 0.8), 0, 0, 0, null, 'chest');
    }
  }

  // --- merge and skin ------------------------------------------------------------
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('girl: parts did not merge (mismatched attributes)');
  const total = merged.attributes.position.count;
  const jointIdx = new Uint16Array(total * 4);
  const jointW = new Float32Array(total * 4);
  const mp = merged.attributes.position;
  let v = 0;
  for (let i = 0; i < parts.length; i++) {
    const n = parts[i].attributes.position.count;
    const spec = partW[i];
    for (let k = 0; k < n; k++, v++) {
      if (typeof spec === 'number') {
        jointIdx[v * 4] = spec;
        jointW[v * 4] = 1;
      } else {
        const ws = spec(mp.getX(v), mp.getY(v), mp.getZ(v));
        let sum = 0;
        for (let j = 0; j < Math.min(4, ws.length); j++) {
          jointIdx[v * 4 + j] = ws[j][0];
          jointW[v * 4 + j] = ws[j][1];
          sum += ws[j][1];
        }
        if (sum > 0 && Math.abs(sum - 1) > 1e-6) for (let j = 0; j < 4; j++) jointW[v * 4 + j] /= sum;
      }
    }
  }
  if (v !== total) throw new Error(`girl: skinned ${v} of ${total} vertices`);
  const flag = new Float32Array(total);
  let f = 0;
  for (let i = 0; i < parts.length; i++) {
    const n = parts[i].attributes.position.count;
    if (partThin[i]) flag.fill(1, f, f + n);
    f += n;
  }
  merged.setAttribute('noOutline', new THREE.Float32BufferAttribute(flag, 1));
  merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(jointIdx, 4));
  merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(jointW, 4));

  parts.forEach((p) => { if (p !== merged) p.dispose(); });
  merged.computeVertexNormals();
  return merged;
}

/**
 * An outline material that works on a SKINNED mesh: the shader pushes each
 * vertex along its (skinned) normal, since scaling a skinned hull applies the
 * scale twice. Injected after skinning_vertex so the offset is not skinned again.
 */
export function makeOutlineMaterial(thickness = 0.012, color = 0x1b222c) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float outlineThickness;\nvoid main() {')
      .replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\n\ttransformed += objectNormal * outlineThickness;'
      );
  };
  m.customProgramCacheKey = () => 'girlOutline:' + thickness;
  return m;
}

/**
 * The whole rigged girl: skeleton, skinned mesh, optional outline, clips.
 *
 * @param {Record<string,string>} choices
 * @param {object} opts
 * @param {THREE.Material} opts.material  the game wants toon, the builder page standard
 * @param {number} [opts.height]  normalise her to this many world units (baked
 *   into the geometry and bones; scaling a group after binding double-counts)
 * @param {boolean} [opts.outline]
 * @returns {{group, mesh, hull, skeleton, bones, byName, scale, lift, clips, sampled, geometry}}
 */
export function buildGirlRig(choices = {}, {
  material,
  height = null,
  outline = false,
  outlineThickness = 0.012,
} = {}) {
  const geometry = buildGirlGeometry(choices);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const natural = bb.max.y - bb.min.y;
  const scale = height && natural > 1e-4 ? height / natural : 1;
  const lift = -bb.min.y * scale;

  if (scale !== 1) geometry.scale(scale, scale, scale);
  if (Math.abs(lift) > 1e-6) geometry.translate(0, lift, 0);

  const { root, bones, byName } = createBones(scale);
  root.position.y += lift;

  const group = new THREE.Group();
  group.name = 'girl';
  group.add(root);

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'girlBody';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);

  let hull = null;
  if (outline) {
    // The outline is drawn from the body WITHOUT its thin layers (the face's
    // features, the panels, the linings; flagged noOutline in the geometry):
    // an outline round a lip or an eyelid is a dark smudge on the face, and
    // round a skirt's lining a black band at the hem. Same vertex buffers,
    // just fewer triangles.
    let hullGeo = geometry;
    const flag = geometry.getAttribute('noOutline');
    if (flag && geometry.getIndex()) {
      const idx = geometry.getIndex().array;
      const keep = [];
      for (let i = 0; i < idx.length; i += 3) {
        if (!flag.getX(idx[i]) && !flag.getX(idx[i + 1]) && !flag.getX(idx[i + 2])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      hullGeo = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(geometry.attributes)) hullGeo.setAttribute(k, a);
      hullGeo.setIndex(keep);
    }
    hull = new THREE.SkinnedMesh(hullGeo, makeOutlineMaterial(outlineThickness * scale));
    hull.name = 'girlOutline';
    hull.userData.isOutline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.frustumCulled = false;
    group.add(hull);
    hull.bind(skeleton, mesh.bindMatrix);
  }

  const sampled = sampleAllClips(scale);
  const clips = sampled.map((s) => toThreeClip(s, byName));

  return { group, mesh, hull, skeleton, bones, byName, scale, lift, clips, sampled, geometry };
}
