// The village's buildings, assembled from the on-disk library.
//
// Every structure is a list of PIECES rather than a single model, because the
// quest chain reveals them one at a time the way Level 2 does: solve the
// question, the console vanishes and the building assembles itself.
//
// Two measured facts drive the recipes (see src/toonTest.js):
//   - Quaternius space-kit models are 8-12 units across and need ~0.22-0.30
//     scale against 1-unit tiles.
//   - That kit's Atlas.png palette is dark industrial charcoal, which is wrong
//     for a bright village, so every space piece carries an explicit tint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadShared } from './board.js';
import { toonify } from './toonPipeline.js';
import { SCALE, asset } from './contracts.js';
import { ROCKET_VILLAGE } from './rocketVillageLayout.js';

const SP = (n) => asset(`assets/models/space/${n}.gltf`);
const KIT = (n) => asset(`assets/models/kit/${n}.glb`);

/** No single piece of a village building may exceed this in any axis. */
export const MAX_PIECE_EXTENT = 9;

/** Bright village palette, overriding the space kit's charcoal. */
export const PAINT = {
  wall: 0xeef2f7,
  wallWarm: 0xf2e6d2,
  roof: 0x3f7fc4,
  roofRed: 0xc2503f,
  dome: 0x5cb3f0,
  glass: 0x9fdcff,
  metal: 0xb4bcc6,
  metalDark: 0x6d7883,
  accent: 0xf2b84b,
  green: 0x63b85a,
  tank: 0xd8dde3,
  // One colour per building, so the village reads at a glance the way the
  // colour-coded towns of Chapters 1 and 2 do.
  waterLab: 0x9fd6e6,
  windTunnel: 0xf3c68a,
  scienceDome: 0xa98ee0,
  fuelRed: 0xd9534a,
  tankWarm: 0xf1e3cf,
  guidance: 0x9ccf94,
  scienceBase: 0xe2d6f5,
  observatoryBase: 0x7384c4,
  // Chapter 3 is the space-age town (lead 2026-10-09): the two stations that
  // were medieval are white, glass and bright lab colours now.
  schoolWall: 0xf7fafc,
  paving: 0xe9eef4,
  roofLight: 0xdfe6ee,
  roofGrey: 0xc9d2dc,
  frame: 0x3b4f66,
  doorBlue: 0x3f7fc4,
  labWall: 0xe9eef3,
  labBand: 0x2bb3a6,
  yard: 0xbfc7d0,
  housing: 0x4b5a6b,
  recess: 0x2e3a48,
  slatA: 0xb8c4d0,
  slatB: 0x9fb0c2,
};

/** A box part for a code-built piece: x and z are its centre, yBase its bottom. */
function part(w, h, d, x, yBase, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, yBase + h / 2, z);
  return [g, hex];
}

/** A cylinder part (a stack, a cap): x and z its centre, yBase its bottom. */
function cylPart(r, h, x, yBase, z, hex) {
  const g = new THREE.CylinderGeometry(r, r, h, 12);
  g.translate(x, yBase + h / 2, z);
  return [g, hex];
}

/** Paint a geometry one flat colour as vertex colours, so pieces merge (homes.js does the same). */
function paintGeometry(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g !== geo) geo.dispose();
  return g;
}

/**
 * A code-built piece: boxes and cylinders with the base on y = 0, merged into
 * ONE vertex-coloured mesh (one draw call). Made fresh each time a structure is built.
 * The mesh sits in a group, as a loaded model does: toonify adds the outline
 * hulls to the mesh's parent, and a bare mesh has none.
 * @param {Array<[THREE.BufferGeometry, number]>} parts  from part() / cylPart()
 */
function codePiece(parts) {
  const painted = parts.map(([g, hex]) => paintGeometry(g, hex));
  const merged = mergeGeometries(painted, false);
  painted.forEach((g) => g.dispose());
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true })));
  return group;
}

/**
 * A roll-up shutter in the face at z = faceZ (+ for the front, - for the back),
 * half rolled up: the slats hang low and a dark gap shows above them, with the
 * roll-up box over the top.
 */
function rollUpDoor(width, faceZ, height, slats) {
  const s = Math.sign(faceZ);
  const out = [
    part(width, height, 0.1, 0, 0, faceZ + s * 0.02, PAINT.recess),
    part(width + 0.3, 0.32, 0.3, 0, height, faceZ + s * 0.1, PAINT.housing),
  ];
  const slatH = (height * 0.8) / slats;
  for (let i = 0; i < slats; i++) {
    out.push(part(width - 0.04, slatH - 0.04, 0.08, 0, i * slatH + 0.02, faceZ + s * 0.14, i % 2 ? PAINT.slatB : PAINT.slatA));
  }
  return out;
}

/** The Mission School's walls: a white block, a wide glass front with a blue door in the middle, glass ends. */
function schoolWalls() {
  return codePiece([
    part(4.0, 2.8, 4.0, 0, 0, 0, PAINT.schoolWall),
    part(1.25, 2.0, 0.06, -1.225, 0.2, 2.04, PAINT.glass),
    part(1.25, 2.0, 0.06, 1.225, 0.2, 2.04, PAINT.glass),
    part(0.9, 2.2, 0.1, 0, 0, 2.04, PAINT.doorBlue),
    part(0.6, 0.6, 0.12, 0, 1.4, 2.06, PAINT.glass),
    part(3.0, 0.3, 0.08, 0, 2.45, 2.04, PAINT.accent),
    ...[-1.9, -0.52, 0.52, 1.9].map((x) => part(0.12, 2.1, 0.1, x, 0.1, 2.06, PAINT.frame)),
    part(0.06, 1.6, 2.6, -2.04, 0.6, 0, PAINT.glass),
    part(0.06, 1.6, 2.6, 2.04, 0.6, 0, PAINT.glass),
  ]);
}

/** The Mission School's roof: a flat slab with a blue fascia on the front edge. */
function schoolRoof() {
  return codePiece([
    part(4.3, 0.3, 4.3, 0, 0, 0, PAINT.roofLight),
    part(4.3, 0.26, 0.12, 0, 0.02, 2.2, PAINT.doorBlue),
  ]);
}

/** The materials lab's hall: a teal plinth band, roll-up doors front and back, glass side windows. */
function labWalls() {
  return codePiece([
    part(4.7, 2.8, 4.7, 0, 0, 0, PAINT.labWall),
    part(4.8, 0.35, 4.8, 0, 0, 0, PAINT.labBand),
    part(0.06, 1.2, 3.0, -2.37, 0.9, 0, PAINT.glass),
    part(0.06, 1.2, 3.0, 2.37, 0.9, 0, PAINT.glass),
    ...rollUpDoor(2.5, 2.35, 2.1, 5),
    ...rollUpDoor(1.8, -2.35, 2.1, 4),
  ]);
}

/** The lab's roof: a grey slab with an amber fascia on the front and a glass skylight strip. */
function labRoof() {
  return codePiece([
    part(4.9, 0.3, 4.9, 0, 0, 0, PAINT.roofGrey),
    part(4.94, 0.26, 0.14, 0, 0.02, 2.48, PAINT.accent),
    part(3.4, 0.35, 1.0, 0, 0.3, 0, PAINT.glass),
  ]);
}

/**
 * A roof vent for the lab. Code-built: the space kit's Roof_VentL has its own
 * origin well off its centre, and fitting it by height pushed it two units from
 * where the recipe put it (the footprint came out 0.7 wider than the old one).
 */
function labVent() {
  return codePiece([
    part(0.9, 0.5, 0.9, 0, 0, 0, PAINT.metal),
    part(1.0, 0.1, 1.0, 0, 0.5, 0, PAINT.metalDark),
  ]);
}

/** The lab's exhaust stack, standing on the roof at the back right. */
function labStack() {
  return codePiece([
    cylPart(0.2, 1.5, 1.4, 0, -1.2, PAINT.housing),
    cylPart(0.26, 0.12, 1.4, 1.5, -1.2, PAINT.frame),
  ]);
}


/**
 * One buildable piece of a structure.
 * @typedef {object} PieceSpec
 * @property {string} [asset]  full model path (or:)
 * @property {() => THREE.Object3D} [make]  a code-built piece (see codePiece)
 * @property {[number,number,number]} pos  offset from the structure origin
 * @property {number} [rotY]
 * @property {number} [scale]
 * @property {number} [tint]
 */

/**
 * Recipes. Order matters: pieces appear in this order as the quest builds them,
 * so each list runs foundation -> walls -> roof -> detail.
 */
export const RECIPES = {
  // Lead 2026-10-09: the space-age town. The Mission School is a glass-fronted
  // training centre for the cadets: a white block with a wide glass front and
  // a blue door in the middle, a flat roof, and the space kit's radar and mast.
  // Built from code geometry (schoolWalls, schoolRoof). The footprint is the
  // rotated roof's box (4.3 square at rotY 0.2 measures 2.54 a side, as the
  // medieval roof did), the door and the reveal order are the medieval building's.
  missionSchool: {
    label: 'P1 - Mission School',
    pieces: [
      { make: () => codePiece([part(4.4, 0.4, 4.4, 0, 0, 0, PAINT.paving)]), pos: [0, 0, 0] },
      { make: schoolWalls, pos: [0, 0.4, 0], outline: true },
      { make: schoolRoof, pos: [0, 3.2, 0] },
      { asset: SP('Roof_Radar'), pos: [1.1, 3.5, -1.0], fitWidth: 1.4, tint: PAINT.metal },
      { asset: SP('Roof_Antenna'), pos: [-1.1, 3.5, -1.0], fitHeight: 1.8, tint: PAINT.accent },
    ],
  },
  // Lead 2026-10-09: now a materials lab and workshop. A hall 4.7 square under
  // a 4.9 roof, so the rotated footprint stays about 3.0 (the sign is still five
  // units south of it), with roll-up doors front and back, glass side windows,
  // a skylight and an exhaust stack. The sign keeps the name "Materials Forge"
  // because quests.js says it.
  materialsForge: {
    label: 'P2 - Materials Forge',
    pieces: [
      { make: () => codePiece([part(5.0, 0.4, 5.0, 0, 0, 0, PAINT.yard)]), pos: [0, 0, 0] },
      { make: labWalls, pos: [0, 0.4, 0], outline: true },
      { make: labRoof, pos: [0, 3.2, 0] },
      { make: labVent, pos: [-1.4, 3.5, -0.9] },
      { asset: SP('SolarPanel_Structure'), pos: [1.2, 3.5, 0.9], fitHeight: 1.2, tint: PAINT.glass },
      { make: labStack, pos: [0, 3.5, 0] },
    ],
  },
  // Scaled up by 1.3 from a 3.0 body. At 3.6 units tall this and the fuel
  // depot were about two and a half times the height of a 1.15-unit girl,
  // against five to nine for every other building - they read as sheds
  // standing next to the village rather than parts of it.
  //
  // The ceiling on this is NOT the reserved radius, it is the signpost:
  // stations.js plants every one of them exactly five units due south of the
  // building's centre, so the world-space halfZ has to stay clear of 5 with
  // room for a child to stand at it. scienceCenter works at halfZ 3.90, so
  // that is the target here rather than the largest number that fits.
  waterLab: {
    label: 'P3 - River Flow Lab',
    pieces: [
      { asset: SP('House_Long'), pos: [0, 0, 0], fitHeight: 3.9, tint: PAINT.waterLab, outline: true },
      { asset: SP('SolarPanel_Ground'), pos: [3.9, 0, 1.8], fitHeight: 1.15, tint: PAINT.glass },
      { asset: SP('Roof_VentL'), pos: [0, 3.8, 0], fitHeight: 0.9, tint: PAINT.metal },
    ],
  },
  windTunnel: {
    label: 'P4 - Wind Tunnel',
    pieces: [
      { asset: SP('Building_L'), pos: [0, 0, 0], fitHeight: 3.4, tint: PAINT.windTunnel, outline: true },
      { asset: SP('Roof_Radar'), pos: [0.7, 3.3, 0.4], fitWidth: 1.4, tint: PAINT.metal },
      { asset: SP('Roof_Antenna'), pos: [-1.0, 3.3, -0.6], fitHeight: 1.4, tint: PAINT.accent },
    ],
  },
  scienceCenter: {
    label: 'P5 - Science Center',
    pieces: [
      { asset: SP('Base_Large'), pos: [0, 0, 0], fitWidth: 6.4, tint: PAINT.scienceBase },
      { asset: SP('GeodesicDome'), pos: [0, 0.5, 0], fitWidth: 5.4, tint: PAINT.scienceDome, outline: true },
      { asset: SP('SolarPanel_Structure'), pos: [4.0, 0, -2.4], fitHeight: 1.6, tint: PAINT.glass },
      { asset: SP('Roof_Antenna'), pos: [0, 3.7, 0], fitHeight: 1.6, tint: PAINT.accent },
    ],
  },
  // Scaled up by 1.45, for the same reason as waterLab above - and with the
  // same signpost ceiling. Every offset scales with the body, or the second
  // tank ends up buried in the first one.
  fuelDepot: {
    label: 'P6 - Fuel Depot',
    pieces: [
      { asset: SP('House_Cylinder'), pos: [0, 0, 0], fitHeight: 4.6, tint: PAINT.tank, outline: true },
      { asset: SP('House_Cylinder'), pos: [4.05, 0, 0.85], fitHeight: 3.45, tint: PAINT.tankWarm },
      { asset: SP('Connector'), pos: [2.0, 0.72, 0.43], fitHeight: 1.15, tint: PAINT.fuelRed },
    ],
  },
  guidanceTower: {
    label: 'P7 - Guidance Tower',
    pieces: [
      { asset: SP('House_Cylinder'), pos: [0, 0, 0], fitHeight: 4.4, tint: PAINT.guidance, outline: true },
      { asset: SP('Stairs'), pos: [1.9, 0, 0], fitHeight: 1.2, tint: PAINT.metalDark },
      // A dish is wide and shallow: fitting it by HEIGHT scaled its long axis
      // to 27 units. Anything flatter than it is tall must be fit by width.
      { asset: SP('Roof_Radar'), pos: [0, 4.3, 0], fitWidth: 2.0, tint: PAINT.accent },
    ],
  },
  observatory: {
    label: 'Observatory',
    pieces: [
      { asset: SP('Base_Large'), pos: [0, 0, 0], fitWidth: 4.6, tint: PAINT.observatoryBase },
      { asset: SP('GeodesicDome'), pos: [0, 0.4, 0], fitWidth: 3.8, tint: PAINT.accent, outline: true },
      { asset: SP('Roof_Radar'), pos: [0, 2.9, 0], fitWidth: 1.4, tint: PAINT.glass },
    ],
  },
};

/**
 * Build one structure. Pieces start hidden so the quest can reveal them.
 * @returns {Promise<import('./contracts.js').Structure>}
 */
/** A slab this low is something she stands ON, not something she walks around. */
const FLOOR_TOP = 0.6;

/**
 * Union the world-space boxes of every piece that should count toward the
 * footprint. Floor slabs are EXCLUDED - a brick floor or stone platform is
 * meant to be stood on, not walked around, and including one inflated the box
 * to cover the whole apron.
 *
 * @returns {THREE.Box3|null} null when no piece qualifies
 */
function collectFootprintBox(group, pieces) {
  const box = new THREE.Box3();
  const piece = new THREE.Box3();
  let any = false;

  for (const p of pieces) {
    piece.setFromObject(p);
    if (piece.isEmpty()) continue;
    if (piece.max.y - group.position.y < FLOOR_TOP) continue;
    box.union(piece);
    any = true;
  }

  return any ? box : null;
}

/**
 * The building's REAL footprint, measured from its geometry.
 *
 * Every structure used to report `radius: 4.2` regardless of what it actually
 * was, and the collider was a circle of that radius. Two problems, both of
 * which a player feels immediately: a circle around a rectangular building
 * blocks the empty air at its corners, and 4.2 was simply wrong for most of
 * these - she was stopped a full body-length short of a wall she could see.
 *
 * This assumes the group's own footprint box is already centred on (x, z) -
 * see the recentring step in buildStructure(). Measuring half-extents as the
 * MAX of the two one-sided distances to an off-centre box used to paper over
 * that instead of fixing it: it inflated the box just enough to cover the far
 * side, which also dragged the near side out into empty air the player then
 * bounced off. Centre the geometry and both sides agree.
 *
 * @returns {{x:number, z:number, radius:number, halfX:number, halfZ:number}}
 */
function measureFootprint(group, x, z, pieces) {
  group.updateMatrixWorld(true);
  const box = collectFootprintBox(group, pieces);
  if (!box) return { x, z, radius: 2.0, halfX: 2.0, halfZ: 2.0 };

  const halfX = Math.max(Math.abs(box.max.x - x), Math.abs(x - box.min.x));
  const halfZ = Math.max(Math.abs(box.max.z - z), Math.abs(z - box.min.z));
  return {
    x, z, halfX, halfZ,
    // Kept for anything still thinking in circles (stations, distance checks).
    radius: Math.hypot(halfX, halfZ),
  };
}

export async function buildStructure(id, { x, z, y = 0, rotY = 0, revealed = 0 } = {}) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`[structures] unknown structure "${id}"`);

  const group = new THREE.Group();
  group.name = id;
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const pieces = [];
  for (const spec of recipe.pieces) {
    // Code-built pieces are made fresh; model pieces are cloned from the shared cache.
    const src = spec.make ? spec.make() : await loadShared(spec.asset);
    if (!src) continue; // fail-soft: a missing model must never break the village
    const piece = spec.make ? src : src.clone(true);
    piece.rotation.y = spec.rotY ?? 0;

    // Prefer declaring the height a piece should END UP, not a raw scale.
    // The packs disagree wildly about units - KayKit roofs are sized in wall
    // MODULES (a "6x8" roof is 10.4 x 11.4 world units), while the space kit is
    // 8-12 units per model. Hand-picked scales silently produced a 25-unit
    // forge roof. Fitting to a measured height makes the recipe say what it
    // means and survives swapping any asset for another.
    if (spec.fitHeight || spec.fitWidth) {
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(piece).getSize(size);
      const basis = spec.fitHeight ? size.y : Math.max(size.x, size.z);
      const target = spec.fitHeight || spec.fitWidth;
      if (basis > 1e-4) {
        let k = target / basis;
        // Fitting one axis of a long, thin model blows the others up: fitting
        // the MetalSupport GIRDER (0.8 x 1.2 x 6.2) to height 5.2 scaled it
        // 4.3x and produced a 27-unit-deep "tower". Clamp on the largest
        // resulting dimension and say so, rather than shipping it silently.
        const largest = Math.max(size.x, size.y, size.z) * k;
        if (largest > MAX_PIECE_EXTENT) {
          k *= MAX_PIECE_EXTENT / largest;
          console.warn(
            `[structures] ${id}: ${spec.asset.split('/').pop()} is the wrong shape for ` +
            `fit${spec.fitHeight ? 'Height' : 'Width'} ${target} ` +
            `(raw ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}); clamped.`
          );
        }
        piece.scale.setScalar(k);
      }
    } else {
      piece.scale.setScalar(spec.scale ?? 1);
    }

    // spec.pos[1] is where the piece's BASE should sit, not where its origin
    // goes. Model origins are arbitrary - the space kit's radar sits metres
    // above its own origin - so setting position.y directly left roofs and
    // antennae floating several units over their buildings. Measure, then
    // offset so the bottom lands exactly on the requested height.
    piece.position.set(spec.pos[0], 0, spec.pos[2]);
    piece.updateMatrixWorld(true);
    const local = new THREE.Box3().setFromObject(piece);
    piece.position.y = spec.pos[1] - (Number.isFinite(local.min.y) ? local.min.y : 0);

    // Outline only the piece that defines the silhouette. Outlining every
    // roof, vent and antenna added ~30 draw calls across eight buildings for
    // edges that are hidden behind the piece in front of them anyway.
    toonify(piece, { tint: spec.tint ?? null, outline: spec.outline === true });
    group.add(piece);
    pieces.push(piece);
  }

  // Recentre the whole assembly on its own anchor before measuring.
  //
  // spec.pos for the vertical axis is already base-aligned per piece (see
  // above): a roof's BASE lands on the requested height, not its raw origin,
  // because the model's own origin is arbitrary. Nothing did the equivalent
  // for X/Z. Every space-kit body used as a building's main piece
  // (House_Long, Building_L, House_Cylinder, Base_Large) turned out to have
  // its own origin off-centre from its own mesh, so even a piece placed at
  // the structure's local (0,0) rendered with its silhouette straddling that
  // point unevenly. The rotated group then carried that off-centre silhouette
  // around its OWN origin, so the building's visible centre missed its
  // placement anchor by up to ~1.9 units - in a different world direction per
  // building, because each is rotated by its own rotY (see PLACEMENTS). That
  // is what made the collider (always centred on the anchor, per
  // gameScene.js) sit to one side of the walls: transparent wall on one side,
  // invisible blocking air on the other.
  //
  // Shifting the whole group by the measured world-space gap between the
  // anchor and the footprint box's actual centre fixes this regardless of
  // rotation, because a rigid translation after rotation cannot change the
  // heading, only recentre it. It also fixes the box being oversized: once
  // centred, the two one-sided distances measureFootprint takes the max of
  // become equal, so the half-extent shrinks to the building's true half
  // width instead of the inflated "cover the far side" value.
  group.updateMatrixWorld(true);
  const rawBox = collectFootprintBox(group, pieces);
  if (rawBox) {
    const centre = rawBox.getCenter(new THREE.Vector3());
    group.position.x += x - centre.x;
    group.position.z += z - centre.z;
    group.updateMatrixWorld(true);
  }

  const structure = {
    id,
    label: recipe.label,
    group,
    pieceCount: pieces.length,
    showPieces(n) {
      pieces.forEach((p, i) => { p.visible = i < n; });
    },
    footprint: measureFootprint(group, x, z, pieces),
  };

  structure.showPieces(revealed);
  return structure;
}

/** Where each structure stands. Inherited from the existing village layout. */
export const PLACEMENTS = (() => {
  const byId = Object.fromEntries(ROCKET_VILLAGE.buildings.map((b) => [b.id, b]));
  return [
    { id: 'missionSchool', ...byId.missionSchool, rotY: 0.2 },
    { id: 'materialsForge', ...byId.materialsForge, rotY: -0.25 },
    { id: 'waterLab', ...byId.waterLab, rotY: 0.35 },
    { id: 'windTunnel', ...byId.windTunnel, rotY: -0.3 },
    { id: 'scienceCenter', ...byId.scienceCenter, rotY: 0.15 },
    { id: 'fuelDepot', ...byId.fuelDepot, rotY: -0.2 },
    { id: 'guidanceTower', ...byId.guidanceTower, rotY: 0.1 },
    // Position comes from the layout, like every other site. It used to be
    // written out here AND in stations.js, which is how it ended up eight
    // units from the pad with its dome in front of the rocket: two places to
    // change, and moving one did not move the other.
    { id: 'observatory', ...byId.observatory, rotY: 0.7 },
  ];
})();

/**
 * Warm the loader with every distinct asset the recipes use, in PARALLEL.
 *
 * buildStructure awaits one asset at a time, so a cold start paid ~20 sequential
 * network round-trips - measured at 3,412 ms of a 5,795 ms load, 59% of the
 * total. Fetching them concurrently first turns that into one batch; the
 * per-piece awaits then all hit a warm cache.
 */
export async function preloadStructureAssets() {
  const paths = new Set();
  for (const recipe of Object.values(RECIPES)) {
    for (const piece of recipe.pieces) if (piece.asset) paths.add(piece.asset);
  }
  await Promise.all([...paths].map((p) => loadShared(p)));
  return paths.size;
}

/** Build every structure. `revealedFor(id)` decides how much is visible. */
export async function buildAllStructures(parent, revealedFor = () => 99, groundAt = () => 0) {
  await preloadStructureAssets();
  const out = new Map();
  for (const p of PLACEMENTS) {
    const s = await buildStructure(p.id, { x: p.x, z: p.z, y: groundAt(p.x, p.z), rotY: p.rotY, revealed: revealedFor(p.id) });
    parent.add(s.group);
    out.set(p.id, s);
  }
  return out;
}
