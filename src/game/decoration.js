// Village dressing: the props that make the place look inhabited.
//
// A village of eight buildings on empty grass reads as a diagram. What sells
// "people live here" is the small stuff between the buildings - market stalls
// and benches on the plaza, lanterns marking the road, fences along the field
// edges, carts and crates left where someone was working.
//
// Lead 2026-10-09 (Chapter 3, "a civilizational jump"): the same places now
// hold the town of a space-age science campus. Lamp posts are street lights,
// fences are low modern railings, carts are electric rovers and vans, stalls
// are kiosks and a food truck, the fountain is a basin with a column, the
// windmill and the watermill are a wind turbine (it turns) and a small hydro
// station (its wheel turns), the fingerpost is a digital sign, and the space
// kit adds a solar farm and a few masts with dishes or whip antennas.
//
// PLACEMENT AND COLLIDERS ARE UNCHANGED. Every bucket key below still names
// the same place and the same collider as before; only what is drawn at each
// placement has changed. The solar farm and masts are the one addition, and
// they sit where no path, building, station or home is.
//
// Drawn props are built in code, in the kit's own units, and scaled by the
// kit's pack scale (contracts.js PACK_SCALE.kit) like the kit was, so each one
// stands inside the footprint its collider was measured from. Each kind is one
// merged, vertex-coloured InstancedMesh: one draw call per kind.
import { instanceAsset, loadShared } from './board.js';
import { ROCKET_VILLAGE, VILLAGE_PATHS } from './rocketVillageLayout.js';
import { packScaleFor, asset } from './contracts.js';
import { RIVER } from './village.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';

const KIT = (n) => asset(`assets/models/kit/${n}.glb`);
const SP = (n) => asset(`assets/models/space/${n}.gltf`);

function makeRng(seed = 99) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Walk a polyline, yielding a point every `spacing` units with its heading. */
/**
 * Shortest distance from a point to a line segment, on the XZ plane.
 *
 * A local copy: village.js keeps its own private, and importing it here would
 * be a cycle - village.js is what calls decorateVillage().
 */
function pointToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function* alongPath(points, spacing, offset = 0) {
  let carry = offset;
  for (let n = 0; n < points.length - 1; n++) {
    const [ax, az] = points[n];
    const [bx, bz] = points[n + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const ux = dx / len, uz = dz / len;
    for (let d = carry; d < len; d += spacing) {
      yield { x: ax + ux * d, z: az + uz * d, heading: Math.atan2(ux, uz) };
    }
    carry = (carry - len) % spacing;
    if (carry < 0) carry += spacing;
  }
}

/**
 * Dress the village.
 *
 * @param {object} village  provides heightAt() and isWalkable()
 * @param {THREE.Object3D} parent
 */

/** Painted metal and screen, matching the quest's signposts. */
const WAYPOST = { post: 0x6d7883, arm: 0x2bb3a6, far: 0xf2b84b, screen: 0x9be7ff };

/**
 * A two-armed digital sign post at the player's start.
 *
 * Built rather than kitted, for the same reason the bridge is: the kits have
 * no sign post, and a repeated tile would read as furniture. One merged,
 * vertex-coloured mesh, so it is a single draw call.
 *
 * The arms point ALONG the road she is facing. The near one is the village,
 * the far one is the launch pad she cannot see yet - which is the part a road
 * alone cannot tell her. Each arm is an LED panel, so the words read as
 * screens rather than painted boards.
 */
function buildWaypost(parent, start, ground) {
  const geoms = [];
  const paint = (geo, hex) => {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  const box = (w, h, d, x, y, z, hex, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    geoms.push(paint(g, hex));
  };

  // Just off the road on her left, so it is in frame without blocking the way.
  const px = start.x - 2.4;
  const pz = start.z - 1.5;
  const base = ground(px, pz);

  box(0.16, 2.4, 0.16, px, base + 1.2, pz, WAYPOST.post);
  // Arms point down the road (-z), offset so both read from behind her.
  box(1.7, 0.30, 0.09, px - 0.75, base + 2.05, pz, WAYPOST.arm, -0.18);
  box(1.5, 0.26, 0.09, px - 0.68, base + 1.58, pz, WAYPOST.far, -0.18);
  // The LED faces, a shade lighter, set just proud of each frame.
  box(1.5, 0.18, 0.1, px - 0.75, base + 2.05, pz, WAYPOST.screen, -0.18);
  box(1.3, 0.14, 0.1, px - 0.68, base + 1.58, pz, WAYPOST.screen, -0.18);
  // A cap, so the post does not end in a raw cut.
  box(0.26, 0.12, 0.26, px, base + 2.42, pz, WAYPOST.post);

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => { if (g !== merged) g.dispose(); });
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true })
  );
  mesh.name = 'waypost';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// --- the modern town's props, built in code ---------------------------------
//
// Every drawn kind is listed in MODELS below, in the kit's own units: a lamp
// post is 1.56 tall, a railing 1.0 long, a kiosk 0.6 to 0.9 across. They are
// scaled by FIT (the kit's pack scale, 1.5) times each placement's own scale,
// exactly as the kit was, so a model stands inside its collider's footprint.

const FIT = packScaleFor(KIT('lantern'));

const PALETTE = {
  steel: 0x7d8792, concrete: 0xdfe4ea, white: 0xf6f8fa, teal: 0x2bb3a6,
  amber: 0xf2b84b, orange: 0xf2703e, lamp: 0xffe7a0, screen: 0x9be7ff,
  glass: 0x9fdcff, dark: 0x2d333b, solar: 0x2a4f8a, water: 0x4cc3f0,
  greenA: 0x4fae5a, greenB: 0x66c46b, wood: 0x3fa7a0,
};
const P = PALETTE;

/** One shared toon material for every drawn kind: colour lives on the vertices. */
const PROP_MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });

/**
 * Paint a primitive, bake its transform in, and keep only the attributes every
 * primitive shares, so the pieces of one kind can be merged into one mesh.
 */
function painted(geo, hex, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ax = 0, az = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  // rx/ry/rz turn the piece about its own centre, then it moves to (x, y, z).
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  // ax/az swing the moved piece about the ORIGIN: a blade or paddle set out
  // from a hub, one per angle, without each one landing on the same spot.
  if (ax) geo.rotateX(ax);
  if (az) geo.rotateZ(az);
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') geo.deleteAttribute(name);
  }
  // mergeGeometries needs every piece indexed or none; none is simpler.
  return geo.index ? geo.toNonIndexed() : geo;
}
const box = (w, h, d, hex, at) => painted(new THREE.BoxGeometry(w, h, d), hex, at);
const cyl = (rt, rb, h, hex, at, seg = 14) => painted(new THREE.CylinderGeometry(rt, rb, h, seg), hex, at);
const ball = (r, hex, at) => painted(new THREE.IcosahedronGeometry(r, 1), hex, at);
const merge = (list) => {
  const merged = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return merged;
};

/** A four-wheeled rover body, wheels on the corners. */
const wheels = (x, z, r = 0.14) => [
  -1, 1,
].flatMap((sx) => [-1, 1].map((sz) => cyl(r, r, 0.1, P.dark, { x: sx * x, y: r, z: sz * z, rz: Math.PI / 2 }, 12)));

/** A small serving kiosk: a white cabin, a menu screen, a coloured canopy. */
const kiosk = (w, d, accent) => [
  box(w, 0.46, d, P.white, { y: 0.23 }),
  box(w * 0.8, 0.2, 0.03, P.screen, { y: 0.6, z: d / 2 + 0.01 }),
  box(w + 0.1, 0.05, d + 0.1, accent, { y: 0.95 }),
  box(0.04, 0.9, 0.04, P.steel, { x: -w / 2 + 0.04, y: 0.45, z: d / 2 - 0.04 }),
  box(0.04, 0.9, 0.04, P.steel, { x: w / 2 - 0.04, y: 0.45, z: d / 2 - 0.04 }),
];

/**
 * Every drawn kind, keyed by the bucket name decorateVillage() places it under.
 * Each returns the list of pieces that make it, base on y = 0.
 */
const MODELS = {
  // Street light: a thin steel pole, an arm reaching over the road, an LED head.
  lantern: () => [
    cyl(0.10, 0.12, 0.08, P.steel, { y: 0.04 }),
    cyl(0.035, 0.045, 1.5, P.steel, { y: 0.83 }),
    box(0.04, 0.04, 0.34, P.steel, { x: -0.17, y: 1.5 }),
    box(0.30, 0.05, 0.14, P.white, { x: -0.36, y: 1.52 }),
    box(0.26, 0.02, 0.10, P.lamp, { x: -0.36, y: 1.49 }),
  ],
  // Low modern railing: a concrete kerb, steel posts, two teal rails.
  fence: () => [
    box(0.26, 0.10, 1.0, P.concrete, { y: 0.05 }),
    ...[-0.46, 0, 0.46].map((z) => box(0.07, 0.62, 0.07, P.steel, { y: 0.41, z })),
    box(0.05, 0.07, 1.0, P.teal, { y: 0.62 }),
    box(0.05, 0.05, 1.0, P.teal, { y: 0.34 }),
  ],
  // A gap in the railing, marked by amber bollards.
  'fence-broken': () => [
    box(0.26, 0.10, 1.0, P.concrete, { y: 0.05 }),
    ...[-0.4, 0, 0.4].map((z) => cyl(0.09, 0.09, 0.5, P.amber, { y: 0.35, z }, 12)),
  ],
  // The plaza fountain: a round basin of water, a column, and a top bowl.
  'fountain-round-detail': () => [
    cyl(1.30, 1.36, 0.36, P.concrete, { y: 0.18 }, 28),
    cyl(1.12, 1.12, 0.04, P.water, { y: 0.33 }, 28),
    cyl(0.16, 0.20, 0.9, P.concrete, { y: 0.8 }),
    cyl(0.58, 0.34, 0.18, P.concrete, { y: 1.35 }, 20),
    cyl(0.52, 0.52, 0.03, P.water, { y: 1.45 }, 20),
  ],
  // Kiosks: the two smaller stalls, and a food truck on the widest ring spot.
  stall: () => kiosk(0.6, 0.9, P.teal),
  'stall-green': () => kiosk(0.9, 0.9, P.greenB),
  'stall-red': () => [
    box(0.92, 0.6, 0.86, P.white, { y: 0.5 }),
    box(0.66, 0.28, 0.03, P.dark, { y: 0.52, z: 0.44 }),
    box(0.7, 0.05, 0.2, P.orange, { y: 0.36, z: 0.54 }),
    box(0.98, 0.05, 0.34, P.orange, { y: 0.82, z: 0.56 }),
    box(0.5, 0.12, 0.04, P.screen, { y: 0.92, z: 0.3 }),
    ...wheels(0.4, 0.3),
  ],
  // A bench with a teal seat and a back, on steel legs.
  'stall-bench': () => [
    box(0.28, 0.05, 0.9, P.wood, { y: 0.36 }),
    box(0.28, 0.32, 0.04, P.wood, { y: 0.6, z: -0.44 }),
    ...[-0.11, 0.11].flatMap((x) => [-0.36, 0.36].map((z) => box(0.04, 0.36, 0.04, P.steel, { x, y: 0.18, z }))),
  ],
  // An electric rover: a low white body, a glass cab and a solar roof.
  cart: () => [
    box(0.84, 0.2, 1.2, P.white, { y: 0.27 }),
    box(0.7, 0.26, 0.44, P.glass, { y: 0.5, z: -0.3 }),
    box(0.8, 0.03, 0.9, P.solar, { y: 0.67, z: 0.1 }),
    box(0.5, 0.05, 0.04, P.lamp, { y: 0.3, z: 0.6 }),
    ...wheels(0.46, 0.42),
  ],
  // A delivery van: a tall white box, a teal cab and a solar roof.
  'cart-high': () => [
    box(0.86, 0.72, 1.0, P.white, { y: 0.56, z: -0.12 }),
    box(0.84, 0.46, 0.36, P.teal, { y: 0.33, z: 0.52 }),
    box(0.7, 0.2, 0.02, P.glass, { y: 0.45, z: 0.71 }),
    box(0.8, 0.03, 0.9, P.solar, { y: 0.95, z: -0.12 }),
    ...wheels(0.44, 0.42),
  ],
  // An EV charging pillar, as wide as its collider (radius 0.2).
  poles: () => [
    cyl(0.2, 0.2, 0.82, P.teal, { y: 0.41 }, 16),
    cyl(0.205, 0.205, 0.14, P.screen, { y: 0.89 }, 16),
    cyl(0.22, 0.22, 0.05, P.steel, { y: 0.98 }, 16),
  ],
  // A planter box with three clipped shrubs.
  hedge: () => [
    box(0.46, 0.34, 0.94, P.concrete, { y: 0.17 }),
    ball(0.17, P.greenA, { y: 0.44, z: -0.28 }),
    ball(0.19, P.greenB, { y: 0.46 }),
    ball(0.17, P.greenA, { y: 0.44, z: 0.28 }),
  ],
  // A round planter with a domed shrub.
  'hedge-curved': () => [
    cyl(0.46, 0.46, 0.34, P.concrete, { y: 0.17 }, 24),
    ball(0.36, P.greenB, { y: 0.42, sy: 0.7 }),
  ],
  // Event banners, now digital: a steel pole and an LED screen in a coloured frame.
  'banner-green': () => banner(P.teal),
  'banner-red': () => banner(P.orange),
};

function banner(frame) {
  return [
    cyl(0.2, 0.22, 0.12, P.concrete, { y: 0.06 }),
    cyl(0.035, 0.035, 2.2, P.steel, { y: 1.1 }),
    box(0.62, 0.44, 0.05, frame, { y: 2.05 }),
    box(0.52, 0.34, 0.07, P.screen, { y: 2.05, z: 0.01 }),
  ];
}

/**
 * Instance one merged model at every placement, on the kit's scale.
 *
 * Culling is on. A geometry's own bounds say nothing about where its copies
 * are, so the sphere is computed from the placements (computeBoundingSphere
 * reads every instance matrix) - a corner of the town then skips the kinds
 * that are wholly out of frame, instead of drawing every copy in the town.
 */
function instanceModel(parent, geometry, placements, fit = FIT, material = PROP_MAT) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  placements.forEach((p, i) => {
    _pos.set(p.x, p.y ?? 0, p.z);
    _q.setFromAxisAngle(_up, p.rotY ?? 0);
    _scl.setScalar((p.scale ?? 1) * fit);
    _m.compose(_pos, _q, _scl);
    mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const _pos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * A wind turbine on a concrete plinth, in world units (it is not a kit scatter).
 *
 * The tower and cabin are one static mesh; the rotor is its own group, turning
 * slowly about the nacelle's axis. It turns through village.animators, which
 * village.update() runs every frame - no per-frame allocations.
 */
function buildTurbine(parent, x, y, z, rotY, animators) {
  const group = new THREE.Group();
  group.name = 'windmill';
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  group.add(new THREE.Mesh(merge([
    cyl(3.6, 3.7, 0.8, P.concrete, { y: -0.1 }, 28),
    box(1.6, 1.1, 1.2, P.white, { x: -1.8, y: 0.85 }),
    box(1.8, 0.1, 1.4, P.teal, { x: -1.8, y: 1.45 }),
    cyl(0.18, 0.34, 6.6, P.white, { y: 3.3 }, 16),
    box(0.7, 0.7, 1.6, P.white, { y: 6.8 }),
  ]), PROP_MAT));

  // The rotor: a hub on the nose of the nacelle and three blades, in the
  // plane of the tower's front. rotation.z turns it about the nacelle axis.
  const rotor = new THREE.Group();
  rotor.position.set(0, 6.8, 0.9);
  const blades = [cyl(0.22, 0.22, 0.3, P.steel, { rx: Math.PI / 2 }, 12)];
  for (let k = 0; k < 3; k++) {
    blades.push(box(0.22, 2.7, 0.06, P.white, { y: 1.35, az: (k * Math.PI * 2) / 3 }));
  }
  rotor.add(new THREE.Mesh(merge(blades), PROP_MAT));
  group.add(rotor);

  parent.add(group);
  animators?.push((t) => { rotor.rotation.z = t * 0.45; });
  return group;
}

/**
 * A small hydro station on the river's near bank: a concrete intake house on
 * a plinth, and a big paddle wheel out over the water, turning on an axle.
 *
 * The axle runs ACROSS the river (along z, as an undershot wheel's does), so
 * the wheel's disc faces the bank and reads face-on from the path. Its hub
 * stands clear of the bank, and the lower paddles reach below the water
 * surface (village.js: the water sits about 0.9 above the riverbed). The
 * wheel's local z is what puts it in the water; the station's own position,
 * and so its collider, is unchanged.
 */
function buildHydro(parent, x, y, z, rotY, animators) {
  const group = new THREE.Group();
  group.name = 'watermill';
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  // Hub height and reach, in the station's own units. The water is about one
  // unit above the station's base, so the lower paddles sit in it.
  const HUB_Y = 1.5, HUB_Z = -3.4;

  group.add(new THREE.Mesh(merge([
    cyl(3.0, 3.1, 0.5, P.concrete, { y: -0.05 }, 24),
    box(3.0, 2.0, 2.2, P.white, { y: 1.0, z: 0.6 }),
    box(3.2, 0.2, 2.4, P.teal, { y: 2.1, z: 0.6 }),
    box(1.0, 1.0, 0.8, P.glass, { x: 0, y: 1.2, z: -0.5 }),
    // The axle from the intake wall out to the hub, with a post under it on the plinth.
    box(0.22, 0.22, -HUB_Z - 0.3, P.steel, { y: HUB_Y, z: (HUB_Z - 0.3) / 2 }),
    box(0.16, HUB_Y, 0.16, P.steel, { y: HUB_Y / 2, z: -2.2 }),
  ]), PROP_MAT));

  // The wheel: six steel paddles, each a blade 1.5 long, on a hub. Radius 1.6.
  const wheel = new THREE.Group();
  wheel.position.set(0, HUB_Y, HUB_Z);
  const paddles = [cyl(0.24, 0.24, 1.0, P.steel, { rx: Math.PI / 2 }, 12)];
  for (let k = 0; k < 6; k++) {
    paddles.push(box(0.14, 1.5, 0.8, P.steel, { y: 0.85, az: (k * Math.PI * 2) / 6 }));
  }
  wheel.add(new THREE.Mesh(merge(paddles), PROP_MAT));
  group.add(wheel);

  parent.add(group);
  animators?.push((t) => { wheel.rotation.z = t * 0.8; });
  return group;
}

/**
 * A telecoms mast on a steel lattice tower, drawn in world units.
 * Its placements are instanced with `fit` 1; a dish or an antenna sits on top.
 */
function mastGeometry() {
  return merge([
    cyl(0.12, 0.3, 4.6, P.steel, { y: 2.3 }, 8),
    cyl(0.4, 0.4, 0.12, P.steel, { y: 4.6 }, 12),
    box(0.6, 0.05, 0.05, P.steel, { y: 1.2 }),
    box(0.05, 0.05, 0.6, P.steel, { y: 2.8 }),
  ]);
}

/** A whip antenna on a mast top: a thin steel rod with two short cross-arms. */
function antennaGeometry() {
  return merge([
    cyl(0.03, 0.05, 2.1, P.steel, { y: 1.05 }, 8),
    box(0.7, 0.04, 0.04, P.steel, { y: 0.5 }),
    box(0.5, 0.04, 0.04, P.steel, { y: 1.1 }),
  ]);
}

export async function decorateVillage(village, parent) {
  const rng = makeRng();
  const ground = (x, z) => village.heightAt(x, z);
  const buckets = {};
  const put = (asset, p) => { (buckets[asset] ||= []).push(p); };

  const hub = ROCKET_VILLAGE.hub;
  const nearRiver = (x, z) => Math.abs(z - 3) < 12;

  /**
   * Is this spot in the water?
   *
   * `nearRiver` above is a crude z-band that assumes the river runs straight
   * across z = 3. It does not - it meanders, by up to nine units - so props
   * were landing in the water wherever the real channel wandered away from
   * that band. This asks the river itself.
   */
  const inRiver = (x, z) => Math.abs(RIVER.offsetAt(x, z)) < RIVER.widthAt(x) + 1.2;

  /** Guard every placement in one place, rather than at each call site. */
  const putDry = (asset, p) => { if (!inRiver(p.x, p.z)) put(asset, p); };

  // --- lanterns line the main road, so the route reads at a glance ----------
  let lampSide = 1;
  for (const path of VILLAGE_PATHS.slice(0, 2)) {
    for (const p of alongPath(path.points, 9)) {
      if (nearRiver(p.x, p.z)) continue;
      // The main road runs straight through the plaza, so a lamp post landed
      // in the middle of the market floor. The plaza has its own lighting.
      if (Math.hypot(p.x - hub.x, p.z - hub.z) < 9) continue;
      // ALTERNATING sides, not a coin flip. Random sides clumped two or three
      // posts together on one verge and left long stretches of the other side
      // dark, which is the opposite of what a lit road looks like.
      lampSide = -lampSide;
      const ox = Math.cos(p.heading) * (path.width * 0.5 + 1.1) * lampSide;
      const oz = -Math.sin(p.heading) * (path.width * 0.5 + 1.1) * lampSide;
      const x = p.x + ox, z = p.z + oz;
      put('lantern', { x, z, y: ground(x, z), rotY: p.heading, scale: 1.15 });
    }
  }

  // --- fences edge the fields along the spur paths --------------------------
  //
  // Three things were wrong with these, and all three are visible at a glance:
  //
  //   1. `rotY: heading + PI/2` turned every rail BROADSIDE to the path, so
  //      they stood across the road like hurdles instead of running beside it.
  //      alongPath's heading maps a model's local +z onto the path direction,
  //      so the rail wants `heading` and nothing added to it.
  //   2. Skipping individual pieces at random left a dotted line of posts
  //      rather than a fence with gates in it. Runs and openings, not dice.
  //   3. A spur's fence could land in the middle of the road it joins, because
  //      nothing checked the OTHER paths. Fences belong beside a path, so the
  //      usual isClear() is too strict here - it rejects everything near any
  //      path, including the one being lined.
  const FENCE_SCALE = 1.1;
  // The model is 1.0 long in z; PACK_SCALE and the placement scale both apply.
  const fenceLength = 1.0 * packScaleFor(KIT('fence')) * FENCE_SCALE;

  /** Distance to the nearest path that ISN'T this one. */
  const clearOfOtherPaths = (x, z, self) => {
    for (const other of VILLAGE_PATHS) {
      if (other === self) continue;
      for (let n = 0; n < other.points.length - 1; n++) {
        const [ax, az] = other.points[n];
        const [bx, bz] = other.points[n + 1];
        if (pointToSegment(x, z, ax, az, bx, bz) < other.width * 0.5 + 1.6) return false;
      }
    }
    return true;
  };

  for (const path of VILLAGE_PATHS.slice(2)) {
    for (const side of [-1, 1]) {
      // Walk each side independently so a gap on one side is not a gap on the
      // other - which is what makes it read as fencing rather than as damage.
      let run = 2 + Math.floor(rng() * 3);   // rails before the next opening
      let gap = 0;                            // slots still to leave empty
      for (const p of alongPath(path.points, fenceLength)) {
        if (gap > 0) { gap -= 1; continue; }
        if (run <= 0) {
          // An opening wide enough to walk through without aiming.
          gap = 1 + Math.floor(rng() * 2);
          run = 3 + Math.floor(rng() * 3);
          continue;
        }
        if (nearRiver(p.x, p.z)) continue;

        const ox = Math.cos(p.heading) * (path.width * 0.5 + 1.4) * side;
        const oz = -Math.sin(p.heading) * (path.width * 0.5 + 1.4) * side;
        const x = p.x + ox, z = p.z + oz;
        if (!village.isWalkable(x, z) || !clearOfOtherPaths(x, z, path)) continue;

        run -= 1;
        put(rng() < 0.12 ? 'fence-broken' : 'fence', {
          x, z, y: ground(x, z), rotY: p.heading, scale: FENCE_SCALE,
        });
      }
    }
  }

  // --- a fingerpost where she starts ---------------------------------------
  //
  // The first thing a child saw was a road and some trees. The road does imply
  // "walk that way", but nothing named the place, nothing said how far, and
  // the goal - the rocket - is across the river and out of sight from here.
  // A fingerpost is the thing a village actually puts at the top of its road,
  // and it answers both questions in the vocabulary the game already uses.
  buildWaypost(parent, ROCKET_VILLAGE.playerStart, ground);

  // --- the plaza: a market, benches, and a fountain at its centre -----------
  put('fountain-round-detail', { x: hub.x, z: hub.z, y: ground(hub.x, hub.z), rotY: 0, scale: 1.5 });

  // Stalls stand in a ring facing the fountain, at a FIXED radius. The radius
  // used to be jittered by a unit and the ring left open where the road comes
  // through - which read as furniture dropped at random rather than a market
  // someone set up. A market is a deliberate arrangement; that is what makes
  // it a market and not a yard.
  //
  // The road enters from the north and leaves south, so two arcs are left
  // empty for it. Nobody puts a stall in the middle of the road.
  const stalls = ['stall', 'stall-green', 'stall-red'];
  const STALL_R = 6.6;
  const roadGap = (a) => {
    // Angles pointing along +z / -z, where VILLAGE_PATHS[0] and [1] run.
    const d = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
    return d < 0.42 || Math.abs(d - Math.PI) < 0.42;
  };
  const stallAngles = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    if (roadGap(a)) continue;
    stallAngles.push(a);
  }
  stallAngles.forEach((a, i) => {
    const x = hub.x + Math.cos(a) * STALL_R;
    const z = hub.z + Math.sin(a) * STALL_R;
    // rotY = -a + PI turns the stall's front toward the middle of the plaza.
    put(stalls[i % stalls.length], { x, z, y: ground(x, z), rotY: -a + Math.PI, scale: 1.2 });
  });

  // A bench belongs BESIDE a stall, facing the same way - a place to sit while
  // someone serves you. They used to sit on their own ring, alone in the open,
  // which is how you get a plaza that looks like a showroom.
  stallAngles.forEach((a, i) => {
    if (i % 2) return;                       // not at every stall
    const off = a + 0.16;                    // a step round the ring
    const r = STALL_R - 1.9;
    const x = hub.x + Math.cos(off) * r;
    const z = hub.z + Math.sin(off) * r;
    put('stall-bench', { x, z, y: ground(x, z), rotY: -a + Math.PI, scale: 0.78 });
  });

  // Carts park BEHIND the stalls, which is where a trader leaves a cart, and
  // roughly tangent to the ring rather than at any angle at all.
  for (let i = 0; i < 5; i++) {
    const a = stallAngles[(i * 2) % stallAngles.length] + 0.22;
    const r = STALL_R + 2.6 + rng() * 0.8;
    const x = hub.x + Math.cos(a) * r;
    const z = hub.z + Math.sin(a) * r;
    putDry(rng() < 0.5 ? 'cart' : 'cart-high', {
      x, z, y: ground(x, z), rotY: -a + Math.PI / 2, scale: 1.1,
    });
  }

  // --- working clutter and hedges around each building ---------------------
  for (const b of ROCKET_VILLAGE.buildings) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = b.radius + 1.2 + rng() * 2.4;
      const x = b.x + Math.cos(a) * r;
      const z = b.z + Math.sin(a) * r;
      if (!village.isWalkable(x, z)) continue;
      // `planks` and `planks-half` are FLAT tiles. Dropped on grass with
      // nothing around them they read as bits of floor that fell off a
      // building, not as a woodpile - so the working clutter is now things
      // that stand up. Planks stay, but only stacked against a wall, below.
      const pick = rng();
      const asset = pick < 0.45 ? 'cart' : pick < 0.75 ? 'cart-high' : 'poles';
      putDry(asset, { x, z, y: ground(x, z), rotY: rng() * 6.28, scale: 1.0 + rng() * 0.25 });
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const r = b.radius + 3.4 + rng() * 2.6;
      const x = b.x + Math.cos(a) * r;
      const z = b.z + Math.sin(a) * r;
      if (!village.isWalkable(x, z)) continue;
      putDry(rng() < 0.5 ? 'hedge' : 'hedge-curved', { x, z, y: ground(x, z), rotY: rng() * 6.28, scale: 1.15 });
    }
    // A banner by the door, so each site is findable from a distance.
    put(rng() < 0.5 ? 'banner-green' : 'banner-red', {
      x: b.x + 2.6, z: b.z + 3.4, y: ground(b.x + 2.6, b.z + 3.4), rotY: 0.2, scale: 1.3,
    });
  }

  // --- a windmill on the northern rise, as a landmark ----------------------
  put('windmill', { x: -20, z: 48, y: ground(-20, 48), rotY: 0.6, scale: 1.6 });
  // A watermill wants to be ON the bank with its wheel toward the water, not
  // standing in the channel. (16, 11) put it mid-river, because the river's
  // centre at x = 16 is z = 11.8 - the meander, not the nominal z = 3.
  {
    const wx = 16;
    const wz = RIVER.centreAt(wx) + RIVER.widthAt(wx) + 2.2;   // just onto the north bank
    put('watermill', { x: wx, z: wz, y: ground(wx, wz), rotY: -0.4, scale: 1.4 });
  }

  // Anything a child would bump into gets a collider. Fences and hedges are
  // deliberately included: they mark field edges, and walking through a fence
  // makes the whole boundary meaningless.
  //
  // Round things (a fountain, a lamp post) approximate fine as a circle - the
  // capsule sees the same clearance from every direction. Long or rectangular
  // things (a fence, a hedge, a market stall) do not: a circle drawn at the
  // centre of a 1.65-unit fence rail leaves both ends uncovered, which is
  // exactly the gap a child walked through. Those get an oriented box instead,
  // sized to the model's own footprint along its own local axes and rotated by
  // the same `rotY` the mesh is placed with - so the collider tracks whatever
  // the eye sees, at whatever angle it was dropped at.
  //
  // Every number below is stated in the KIT's own units - multiplied by
  // contracts.js PACK_SCALE and the placement's own `scale` below, exactly
  // like `fenceLength` above, so they track the models instead of needing a
  // retune whenever the pack scale moves. Measured directly off each model's
  // glTF bounding box (local +z is length, local +x is width/thickness,
  // matching the axis alongPath's `heading` already rotates onto the path):
  // a fence rail is 0.08 x 1.0, a hedge strip 0.25 x 1.0, a stall 0.65-1.0
  // square, a cart 0.89 x 1.3-1.4. Widths get a little padding over the raw
  // mesh (a paper-thin collider reads as nothing there); the length along a
  // fence run is exact, because that is the dimension that has to touch its
  // neighbour with no gap.
  const SOLID_ROUND = {
    'fountain-round-detail': 1.35, lantern: 0.14, windmill: 1.8, watermill: 1.5,
    // Drawn now as an EV charging pillar, exactly as wide as this radius (the
    // pillar's own radius is 0.2 native). It used to be an invisible wall: the
    // kit has no poles.glb, so the old placement drew nothing at all.
    poles: 0.2,
  };
  // [halfX, halfZ], native units.
  const SOLID_BOX = {
    fence: [0.15, 0.5], 'fence-broken': [0.15, 0.5],
    hedge: [0.25, 0.5], 'hedge-curved': [0.5, 0.5],
    planks: [0.5, 0.5], 'planks-half': [0.25, 0.5],
    stall: [0.33, 0.5], 'stall-green': [0.5, 0.5], 'stall-red': [0.5, 0.5],
    'stall-bench': [0.15, 0.47],
    cart: [0.45, 0.67], 'cart-high': [0.45, 0.7],
  };
  const solids = [];
  for (const [asset, placements] of Object.entries(buckets)) {
    const fit = packScaleFor(KIT(asset));
    const roundBase = SOLID_ROUND[asset];
    const boxBase = SOLID_BOX[asset];
    if (roundBase) {
      const r = roundBase * fit;
      for (const p of placements) solids.push({ x: p.x, z: p.z, radius: r * (p.scale ?? 1) });
    } else if (boxBase) {
      const [halfXBase, halfZBase] = boxBase;
      for (const p of placements) {
        const s = fit * (p.scale ?? 1);
        solids.push({
          x: p.x, z: p.z,
          halfX: halfXBase * s, halfZ: halfZBase * s,
          rotation: p.rotY ?? 0,
        });
      }
    }
  }

  // The wind turbine and the hydro station move, so each is built on its own;
  // everything else is one merged model per kind, instanced at every spot.
  const animators = village.animators ?? null;
  let batches = 0;
  let props = 0;
  for (const [asset, placements] of Object.entries(buckets)) {
    props += placements.length;
    if (asset === 'windmill') {
      for (const p of placements) buildTurbine(parent, p.x, p.y, p.z, p.rotY, animators);
      batches += 2 * placements.length;
      continue;
    }
    if (asset === 'watermill') {
      for (const p of placements) buildHydro(parent, p.x, p.y, p.z, p.rotY, animators);
      batches += 2 * placements.length;
      continue;
    }
    const model = MODELS[asset];
    if (!model) { console.warn(`[decoration] no drawn model for "${asset}"`); continue; }
    instanceModel(parent, merge(model()), placements);
    batches += 1;
  }

  // --- the space kit: a solar farm, and masts with dishes and antennas --------
  //
  // Lead 2026-10-09: "a few antennas and radar dishes and a solar farm where
  // there is free space". These sit on open ground, clear of every path,
  // building, quest station and home (checked in scripts/test-ch3-streets.mjs).
  // Their colliders are appended after the kit's, so every existing one is the
  // same. Scale is fitted to a measured size, not guessed: each Quaternius
  // piece is a different size from the next.
  const spaceSolids = [];
  const [panel, dish] = await Promise.all([
    loadShared(SP('SolarPanel_Ground')),
    loadShared(SP('Roof_Radar')),
  ]);
  const sizeOf = (src) => {
    const box = new THREE.Box3().setFromObject(src);
    return { size: box.getSize(new THREE.Vector3()), centre: box.getCenter(new THREE.Vector3()) };
  };

  // The farm: six panels in two rows, each about 1.9 units along its long side.
  const FARM = [[12, -8], [14, -8], [16, -8], [12, -6], [14, -6], [16, -6]];
  if (panel) {
    const { size, centre } = sizeOf(panel);
    const k = 1.9 / Math.max(size.x, size.z);
    const placements = FARM.map(([x, z]) => ({ x, z, y: ground(x, z), rotY: 0, scale: k }));
    await instanceAsset(parent, SP('SolarPanel_Ground'), placements, {
      packScale: false, tint: 0x3d6fb8, outline: false, castShadow: false, receiveShadow: true,
    });
    batches += 2;
    props += placements.length;
    for (const [x, z] of FARM) {
      spaceSolids.push({
        x: x + centre.x * k, z: z + centre.z * k,
        halfX: (size.x * k) / 2, halfZ: (size.z * k) / 2, rotation: 0,
      });
    }
  }

  // Four masts. Each carries a radar dish or an antenna on its top.
  const MASTS = [
    { x: -10, z: -8, top: 'dish' },
    { x: -16, z: 52, top: 'dish' },
    { x: 10, z: -30, top: 'antenna' },
    { x: 22, z: 52, top: 'antenna' },
  ];
  instanceModel(parent, mastGeometry(), MASTS.map((m) => ({ x: m.x, y: ground(m.x, m.z), z: m.z, rotY: 0.3 })), 1);
  batches += 1;
  props += MASTS.length;
  for (const m of MASTS) spaceSolids.push({ x: m.x, z: m.z, radius: 0.3 });

  const dishes = MASTS.filter((m) => m.top === 'dish');
  if (dish && dishes.length) {
    const { size } = sizeOf(dish);
    const k = 2.2 / Math.max(size.x, size.z);
    const placements = dishes.map((m) => ({ x: m.x, y: ground(m.x, m.z) + 4.7, z: m.z, rotY: 0.6, scale: k }));
    await instanceAsset(parent, SP('Roof_Radar'), placements, { packScale: false, tint: 0xf4f7fa, outline: false, castShadow: false });
    batches += 2;
    props += placements.length;
  }
  // The antenna masts carry a thin whip with a red warning light on its tip,
  // which blinks as a real mast's does. (The kit's teal saucer read as a torch.)
  const antennas = MASTS.filter((m) => m.top === 'antenna');
  if (antennas.length) {
    const atTop = antennas.map((m) => ({ x: m.x, y: ground(m.x, m.z) + 4.66, z: m.z, rotY: 0.3 }));
    instanceModel(parent, antennaGeometry(), atTop, 1);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    instanceModel(parent, ball(0.13, P.white, { y: 2.15 }), atTop, 1, tipMat);
    animators?.push((t) => { tipMat.color.set(Math.sin(t * 5) > 0 ? 0xff3b30 : 0x6e1d19); });
    batches += 3;
    props += antennas.length;
  }

  return { props, batches, kinds: Object.keys(buckets).length, solids: [...solids, ...spaceSolids] };
}
