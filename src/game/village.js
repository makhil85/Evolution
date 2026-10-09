// The village board: lays the existing rocketVillageLayout onto the instanced
// tile grid, paints the river and the path network, and scatters vegetation.
//
// Coordinates are deliberately inherited from rocketVillageLayout.js rather than
// invented, because docs/QUEST_SPEC.md's unlock ladder is written against them
// (river at z~3 as the golden-lock moat, pad and tower on the far bank).
import * as THREE from 'three';
import { TileBoard, KN, loadShared } from './board.js';
import { toonRamp } from './toonPipeline.js';
import { SCALE, packScaleFor, asset } from './contracts.js';
import { ROCKET_VILLAGE, VILLAGE_PATHS } from './rocketVillageLayout.js';
import { createRiverSurface } from './water.js';
import { stationPositions } from './stations.js';
import { buildBridge } from './bridge.js';
import { mountainTreeAnchors } from './mountains.js';

/** Board extent in world units. Tiles are 1 unit. */
export const BOUNDS = { minX: -34, maxX: 34, minZ: -52, maxZ: 62 };

/**
 * The river is the level's moat: crossable only at a bridge.
 *
 * It MEANDERS rather than running straight - a ruler-straight band of water
 * reads as a canal, not a river. The centreline is two sine waves of different
 * wavelengths so the curve never visibly repeats, and the width breathes
 * slightly along its length.
 */
export const RIVER = {
  baseZ: 3,
  halfWidth: 3.2,
  // Half-width of the crossable lane, kept INSIDE the deck's own half-width
  // (BRIDGE_WIDTH). A lane wider than the deck lets her walk on open water
  // beside the bridge, which is worse than no bridge at all.
  bridgeHalfWidth: 1.0,
  /**
   * Centreline of the river at a given x.
   *
   * Amplitude here is bounded by rocketVillageLayout.js's own
   * `river.northBankZ` (9.6) / `southBankZ` (-3.6): the widest this may swing
   * plus `widthAt`'s widest reach must stay inside that envelope. The
   * previous amplitude (6.2 + 3.4) let the centreline alone reach z=12.6
   * north of base, which swallowed the entire windTunnel spur road
   * (VILLAGE_PATHS z=12, north of the river and nowhere near a bridge) for
   * a 13-unit stretch with no crossing - a paved road that just runs into
   * unbridged water. This still meanders on two independent frequencies so
   * it never repeats, just within a reach that respects every non-crossing
   * path on the board.
   */
  centreAt(x) {
    return this.baseZ + Math.sin(x * 0.085) * 1.8 + Math.sin(x * 0.031 + 1.7) * 1.0;
  },
  /** Half-width at a given x: the channel narrows and widens as it runs. */
  widthAt(x) {
    return this.halfWidth + Math.sin(x * 0.13 + 0.6) * 0.6;
  },
  /** Signed distance from the centreline, in tiles. */
  offsetAt(x, z) {
    return z - this.centreAt(x);
  },
};

/**
 * Where the river can be crossed. Each is an x position; the bridge sits at the
 * river's centreline there, so it follows the meander automatically.
 */
/** No tree stands closer than this to the launch pad, or to any signpost. */
const PAD_CLEARING = 22;
const STATION_CLEARING = 6;

/**
 * Open ground, on purpose.
 *
 * Every site had vegetation pressed against it and every verge was lined with
 * trunks, so the village had no air in it anywhere - you were always looking
 * at something a few units away. A landscape needs somewhere for the eye to
 * rest, and a child needs somewhere that is obviously safe to run about in.
 *
 * These are meadows: nothing grows inside them. They sit in the gaps BETWEEN
 * sites rather than on them, so they cost no landmark and no route.
 */
const MEADOWS = [
  { x: -12, z: 44, r: 9 },    // beside the road she spawns on
  { x: 13, z: 40, r: 8 },     // the opposite verge, so the approach opens out
  { x: -30, z: -2, r: 7 },    // the west bank, upstream of the bridge
  { x: 28, z: -30, r: 8 },    // between the fuel depot and the pad
];

/**
 * How much room the MAIN roads get, versus a spur.
 *
 * The two main roads are the ones she walks over and over, so they are worth
 * more than the 2.2 units every path used to get - at 6-unit trees that put a
 * trunk almost within arm's reach the whole way. Spurs stay tight: they are
 * short, and a close treeline is what makes them feel like lanes.
 */
const MAIN_ROAD_CLEARING = 5.5;
const SPUR_CLEARING = 2.2;

/** Height of a laid bridge deck above the riverbed it spans. */
export const BRIDGE_DECK_Y = 1.1;

/**
 * Deck width. She is 0.48 across at her widest, so this is comfortably wide
 * enough to walk down without hugging a rail, and narrow enough that the
 * crossing still reads as a footbridge rather than a road.
 */
const BRIDGE_WIDTH = 2.2;

/** How far past the waterline the deck lands on each bank. */
const BRIDGE_BANK_MARGIN = 2.6;


export const CROSSINGS = [
  { id: 'bridge', x: 0, planks: 5 },
  { id: 'bridgeEast', x: 23, planks: 5 },
];

/**
 * ground_grass ships as #73eddd (teal). Everything here is an explicit tint,
 * which is why toonPipeline supports one.
 *
 * Lead 2026-10-09 (Chapter 3, "a civilizational jump"): the dirt roads are
 * paved now. The tile colours below sit UNDER the paving that
 * buildStreetSurface() lays on top, so they only show at the seams - they are
 * kept close to the paving so no dirt-brown edge shows through.
 */
const TINT = {
  grassA: 0x6fb659,
  grassB: 0x65ac51,
  grassC: 0x5a9e49,
  path: 0x7f858d,
  plaza: 0xa9a79f,
  // The grout between the plaza's paving slabs.
  plazaEdge: 0xb4b1a8,
  waterDeep: 0x1f74b8,
  waterShallow: 0x5fd0ea,
  bank: 0xd7d1bf,
};

/**
 * Ground relief.
 *
 * Flat ground read as a table top. This rolls it - but NOT everywhere: paths,
 * the plaza and every building pad are levelled, because a child should never
 * be fighting a slope while trying to reach a station, and a building on a
 * step looks broken. So the terrain is high at the rim and flattens toward the
 * places that matter.
 */
export const TERRAIN = {
  /** Raw rolling height before anything is levelled. */
  rawAt(x, z) {
    return (
      Math.sin(x * 0.055) * 1.15 +
      Math.cos(z * 0.047) * 0.95 +
      Math.sin((x + z) * 0.028 + 1.1) * 0.75 +
      Math.sin(x * 0.017 - z * 0.013) * 1.35
    );
  },
  /**
   * Relief is deliberately SUBTLE and smooth. An earlier version quantised
   * this into 0.34 steps, which turned the valley into voxel stairs - wrong
   * for a style where everything else has curved edges. Gentle is better than
   * dramatic here: the village has to read clearly from above.
   */
  AMPLITUDE: 0.42,
};

/**
 * Broad landmark rises - hills that mean something, not just texture.
 *
 * The layout is otherwise mirror-symmetric: the school and forge sit at the
 * same z on opposite sides of the road, and so do the water lab and wind
 * tunnel. From above (or from the ground, before she's learned the buildings)
 * the west and east halves of the village read as interchangeable. Each of
 * these is one wide, shallow rise behind a specific place, sized and shaped
 * differently from its neighbours, so "the shoulder behind the forge" and
 * "the shoulder behind the school" become distinct landmarks instead of a
 * mirror image of each other. They are far too wide and shallow to change how
 * a path feels underfoot - only how the skyline looks across the valley -
 * and the same flatten pass that levels every building and road also tapers
 * these to nothing near a doorway or a route, so nothing here can block a
 * path or intrude on a building's footprint.
 */
const LANDMARK_HILLS = [
  { x: -32, z: 22, r: 24, amp: 1.8 },   // tall shoulder behind the west mission cluster
  { x: 32, z: 4, r: 20, amp: 1.1 },     // lower rise behind the east cluster - deliberately unlike its mirror
  { x: -30, z: -36, r: 20, amp: 1.4 },  // rise west of the guidance tower, opposite the launch pad
];

/** Smooth radial rise: full `amp` at the centre, tapering to 0 at `r`. */
function landmarkBumpAt(x, z) {
  let sum = 0;
  for (const hill of LANDMARK_HILLS) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d >= hill.r) continue;
    const t = d / hill.r;
    sum += hill.amp * (1 - t * t * (3 - 2 * t));
  }
  return sum;
}

/** Scatter families a child should not walk through, and how wide they are. */
const SOLID_FAMILIES = new Set([
  'tree_default', 'tree_oak', 'tree_pineDefaultA', 'tree_detailed', 'tree_fat',
  // EVERY rock, not just the big one - walking through a boulder is the most
  // obvious way a world tells a child it is fake.
  'rock_largeB', 'rock_smallA', 'Rock_Medium_1', 'Rock_Medium_3',
  'CommonTree_3', 'CommonTree_5', 'Pine_2',
  'Bush_Common', 'Bush_Common_Flowers',
]);
/**
 * Collision radius per species, in the PACK's own units - multiplied by
 * contracts.js PACK_SCALE where it is used, so these never need retuning when
 * a pack's scale changes.
 *
 * The trunk, not the canopy.
 *
 * These were roughly canopy-sized, which is wrong twice over: the leaves are
 * above her head (she is 1.15 units tall and these trees are 2-3), and a
 * radius that big stops her a visible gap short of the trunk. A child reads
 * that as an invisible wall, because that is what it is. Trunk-sized radii let
 * her walk right up to the bark and brush past the branches.
 */
/**
 * Species whose trunk is CLEAN at head height.
 *
 * Measured at the pack's real scale, between 0.8 and 2.4 units up - roughly a
 * Grade 3 child's eye line. `tree_detailed` puts branch stubs 1.57 units out
 * from a 0.67 trunk, `tree_oak` 1.02 from 0.36: at village scale those are
 * spikes at face height, and she could walk straight through them because the
 * collider only knew about the trunk. These two are what goes beside a path.
 */
const CLEAN_TRUNK = new Set(['tree_default', 'tree_fat']);
/** How close to a path counts as "she will walk into it". */
const PATH_TRUNK_MARGIN = 7;

const SOLID_RADIUS = {
  // Radii below are the WIDEST reach at head height, not the trunk: a branch
  // you can walk through is worse than one you cannot walk past.
  tree_default: 0.20, tree_oak: 0.30, tree_pineDefaultA: 0.27,
  tree_detailed: 0.45, tree_fat: 0.26,
  rock_largeB: 0.55, rock_smallA: 0.30, Rock_Medium_1: 0.45, Rock_Medium_3: 0.38,
  CommonTree_3: 0.30, CommonTree_5: 0.32, Pine_2: 0.28,
  // Undergrowth she should be able to push through, not be fenced in by.
  Bush_Common: 0.0, Bush_Common_Flowers: 0.0,
};

/** Trunk/leaf colours for the edge belt, slightly cooler so it recedes. */
/**
 * Tints for the perimeter belt, keyed by MATERIAL NAME rather than sub-mesh
 * index - see board.js tintForPart(). Indexing by position painted four of the
 * five species' leaves brown, because only `tree_default` exports bark first.
 *
 * The belt sits behind the village against grey cliffs, so it is pitched a
 * shade deeper and cooler than the trees in the village itself. Reads as
 * distance, not as a different forest.
 */
const EDGE_TINTS = {
  tree_default:      { woodBark: 0x5e432a, leafsGreen: 0x2f7a3c },
  tree_oak:          { woodBark: 0x644827, leafsGreen: 0x35833f },
  tree_pineDefaultA: { woodBarkDark: 0x53391f, leafsDark: 0x276b36 },
  tree_fat:          { woodBark: 0x5e432a, leafsGreen: 0x3a8a41 },
  tree_detailed:     { woodBark: 0x5e432a, leafsGreen: 0x328040, _defaultMat: 0x328040 },
};

/** Deterministic RNG so the scatter is identical every run. */
function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Low-frequency field marking natural groves versus clearings, independent
 * of both the ground-tint noise and the MEADOWS list, so it never lines up
 * with either. It does not change how many of each species get planted -
 * `scatter()` still places exactly the count it's given - it only decides
 * where they're welcome, so vegetation clumps into groves with real gaps
 * between them instead of an even sprinkle over the whole board. That
 * variation is itself a landmark: "the clearing past the fork" or "the thick
 * stand by the old pine" is something a child can navigate by, where uniform
 * density is not.
 */
function groveFieldAt(x, z) {
  return (
    Math.sin(x * 0.045 + 2.1) * 0.6 +
    Math.sin(z * 0.038 - 0.7) * 0.6 +
    Math.sin((x - z) * 0.021 + 4.4) * 0.5
  );
}

/** Rasterise a polyline of world points into tile coords with a width. */
function* pathTiles(points, width) {
  const half = width / 2;
  for (let n = 0; n < points.length - 1; n++) {
    const [ax, az] = points[n];
    const [bx, bz] = points[n + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      for (let ox = -half; ox <= half; ox += 1) {
        for (let oz = -half; oz <= half; oz += 1) {
          if (Math.hypot(ox, oz) > half) continue;
          yield [Math.round(cx + ox), Math.round(cz + oz)];
        }
      }
    }
  }
}

/**
 * Paving, kerbs and lane markings, laid over the tile ground.
 *
 * Lead 2026-10-09: Chapter 3 is a modern town around the launch complex, so
 * the dirt roads become tarmac and paved footpaths, and the square becomes a
 * paved plaza. The tiles cannot carry that - one colour per 1-unit tile blurs
 * into stripes - so this is a separate flat mesh of crisp bands, built from
 * the SAME paths and the same heightAt() as the ground, so it sits exactly on
 * it. It is ONE draw call.
 *
 * Only the look changes. The walk map, heights and colliders are untouched:
 * this mesh has no collider, and it stops where the bridge deck, the plaza and
 * the buildings already are, so nothing new is laid over water or a doorway.
 *
 * Layers (y lift above the ground, so nothing z-fights):
 *   pavement 0.02  <  kerbs and plaza ring 0.04  <  lane lines 0.055
 */
const STREET = {
  asphalt: 0x4a5058, footA: 0xdcd8cf, footB: 0xcfcbc1, kerb: 0xeef0f2,
  lane: 0xfbf8ec, slabA: 0xe8e5de, slabB: 0xd9d5cb, ring: 0xf2f1ec,
};
const PAVE = 0.02, KERB = 0.04, MARK = 0.055;

/** Plaza edge radius at angle `a`: the same wobble paint() frays the paving with. */
function plazaEdgeAt(a) {
  const wobble =
    Math.sin(a * 3.1 + 0.7) * 0.55 +
    Math.sin(a * 5.3 - 1.4) * 0.35 +
    Math.sin(a * 8.7 + 2.9) * 0.22;
  return 8.5 + wobble;
}

/**
 * Vertices and normals for the street mesh, built as flat triangles.
 * Exported for scripts/test-ch3-streets.mjs, which checks where it lands.
 */
export function streetGeometry(village) {
  const pos = [];
  const nrm = [];
  const col = [];
  const c = new THREE.Color();

  const vert = (x, z, lift, hex) => {
    pos.push(x, village.heightAt(x, z) + lift, z);
    nrm.push(0, 1, 0);
    c.setHex(hex);
    col.push(c.r, c.g, c.b);
  };
  const tri = (ax, az, bx, bz, cx, cz, hex, lift) => {
    vert(ax, az, lift, hex); vert(bx, bz, lift, hex); vert(cx, cz, lift, hex);
  };

  // A band across a straight run from A to B, between offsets lo..hi from its
  // centreline. `keep(x, z, s)` decides each short piece (s = distance along
  // the run), so dashes and exclusions cost nothing extra.
  const band = (ax, az, bx, bz, lo, hi, hex, lift, keep = () => true) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;
    const steps = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 0; i < steps; i++) {
      const s0 = (len * i) / steps, s1 = (len * (i + 1)) / steps;
      const sm = (s0 + s1) / 2;
      const p0x = ax + ux * s0, p0z = az + uz * s0;
      const p1x = ax + ux * s1, p1z = az + uz * s1;
      // Two triangles for the piece: lo-side and hi-side corners.
      const aL = [p0x + nx * lo, p0z + nz * lo], bL = [p1x + nx * lo, p1z + nz * lo];
      const aH = [p0x + nx * hi, p0z + nz * hi], bH = [p1x + nx * hi, p1z + nz * hi];
      // A piece is kept only if EVERY corner is allowed. Testing the midpoint
      // alone let the wide side of a road reach into the water or a wall.
      const mx = ax + ux * sm, mz = az + uz * sm;
      if (!keep(mx, mz, sm) || !keep(aL[0], aL[1], sm) || !keep(bL[0], bL[1], sm)
        || !keep(aH[0], aH[1], sm) || !keep(bH[0], bH[1], sm)) continue;
      tri(aL[0], aL[1], bL[0], bL[1], bH[0], bH[1], hex, lift);
      tri(aL[0], aL[1], bH[0], bH[1], aH[0], aH[1], hex, lift);
    }
  };

  // A round cap, so two bands meeting at a bend leave no wedge of grass.
  const disc = (cx, cz, r, hex, lift, keep) => {
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const bx = cx + Math.cos(a0) * r, bz = cz + Math.sin(a0) * r;
      const dx = cx + Math.cos(a1) * r, dz = cz + Math.sin(a1) * r;
      if (!keep(bx, bz, 0) || !keep(dx, dz, 0)) continue;
      tri(cx, cz, bx, bz, dx, dz, hex, lift);
    }
  };

  const hub = ROCKET_VILLAGE.hub;
  // Inside the plaza's outer ring: the road begins where the ring ends.
  const onPlaza = (x, z) => {
    const dx = x - hub.x, dz = z - hub.z;
    return Math.hypot(dx, dz) < plazaEdgeAt(Math.atan2(dz, dx)) - 0.5;
  };
  const inRiver = (x, z) => Math.abs(RIVER.offsetAt(x, z)) < RIVER.widthAt(x) + 2.6;
  // Walls are about 2.0 from a building's centre; a road stops just short of them.
  const inBuilding = (x, z) => ROCKET_VILLAGE.buildings.some((b) => Math.hypot(x - b.x, z - b.z) < 2.4);
  // The road stops where the bridge deck takes over, the plaza begins, or a
  // building's walls are - never laid over water, a wall or the square.
  const roadKeep = (x, z) => !inRiver(x, z) && !onPlaza(x, z) && !inBuilding(x, z);

  // --- roads -----------------------------------------------------------------
  VILLAGE_PATHS.forEach((path, idx) => {
    const main = idx < 2;
    const w = path.width / 2;
    const surface = main ? STREET.asphalt : STREET.footA;
    const pts = path.points;
    for (let n = 0; n < pts.length - 1; n++) {
      const [ax, az] = pts[n];
      const [bx, bz] = pts[n + 1];
      // The paving: asphalt on the main roads, two-tone paving on the footpaths.
      if (main) {
        band(ax, az, bx, bz, -(w - 0.2), w - 0.2, surface, PAVE, roadKeep);
      } else {
        band(ax, az, bx, bz, -(w - 0.15), w - 0.15, STREET.footA, PAVE, roadKeep);
        // Paving joints: a slab every 1.5 units, the odd ones a shade darker.
        const len = Math.hypot(bx - ax, bz - az);
        const ux = (bx - ax) / len, uz = (bz - az) / len;
        for (let s = 1.5; s < len; s += 1.5) {
          const jx = ax + ux * s, jz = az + uz * s;
          if (!roadKeep(jx, jz)) continue;
          const hw = w - 0.15;
          band(jx - ux * 0.04, jz - uz * 0.04, jx + ux * 0.04, jz + uz * 0.04, -hw, hw, STREET.footB, PAVE + 0.008, roadKeep);
        }
      }
      // Kerbs: a light edge each side, so the road reads as built, not painted.
      band(ax, az, bx, bz, w - 0.36, w, STREET.kerb, KERB, roadKeep);
      band(ax, az, bx, bz, -w, -(w - 0.36), STREET.kerb, KERB, roadKeep);
      if (main) {
        // Lane lines: a solid edge on both sides, a dashed centre.
        band(ax, az, bx, bz, w - 0.62, w - 0.5, STREET.lane, MARK, roadKeep);
        band(ax, az, bx, bz, -(w - 0.5), -(w - 0.62), STREET.lane, MARK, roadKeep);
        band(ax, az, bx, bz, -0.07, 0.07, STREET.lane, MARK,
          (x, z, s) => roadKeep(x, z) && (s % 3.2) < 1.7);
      }
    }
    // Corners: fill the wedge a bend leaves between two bands.
    for (let n = 1; n < pts.length - 1; n++) {
      const [cx, cz] = pts[n];
      if (!roadKeep(cx, cz)) continue;
      disc(cx, cz, w - 0.15, surface, PAVE, roadKeep);
    }
  });

  // --- the plaza: slabs in two tones, inside a light ring --------------------
  // A grid of 1.5-unit slabs, anchored on the hub so the joints run true. The
  // ring is drawn last at a higher lift, so it covers the edge slabs cleanly.
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const cx = hub.x + i * 1.5, cz = hub.z + j * 1.5;
      const dx = cx - hub.x, dz = cz - hub.z;
      const d = Math.hypot(dx, dz);
      if (d > plazaEdgeAt(Math.atan2(dz, dx)) - 2.2) continue;
      const hex = (i + j) & 1 ? STREET.slabB : STREET.slabA;
      const h = 0.7;
      tri(cx - h, cz - h, cx + h, cz - h, cx + h, cz + h, hex, PAVE);
      tri(cx - h, cz - h, cx + h, cz + h, cx - h, cz + h, hex, PAVE);
    }
  }
  const RING = 96;
  for (let k = 0; k < RING; k++) {
    const a0 = (k / RING) * Math.PI * 2, a1 = ((k + 1) / RING) * Math.PI * 2;
    const e0 = plazaEdgeAt(a0), e1 = plazaEdgeAt(a1);
    const r0 = e0 - 1.0, r1 = e0 - 0.5, q0 = e1 - 1.0, q1 = e1 - 0.5;
    const p = (r, a) => [hub.x + Math.cos(a) * r, hub.z + Math.sin(a) * r];
    const A = p(r0, a0), B = p(r1, a0), C = p(q1, a1), D = p(q0, a1);
    tri(A[0], A[1], B[0], B[1], C[0], C[1], STREET.ring, KERB);
    tri(A[0], A[1], C[0], C[1], D[0], D[1], STREET.ring, KERB);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

export class Village {
  constructor() {
    this.width = BOUNDS.maxX - BOUNDS.minX + 1;
    this.depth = BOUNDS.maxZ - BOUNDS.minZ + 1;
    this.board = new TileBoard(this.width, this.depth);
    // Re-origin the board so tile (0,0) is the south-west corner of BOUNDS.
    this.board.originX = -BOUNDS.minX;
    this.board.originZ = -BOUNDS.minZ;
    this.group = this.board.group;
    /** Tiles the player must not walk on (the river, away from the bridge). */
    this.blocked = new Set();
    /** Bridge deck tiles: blocked until the quest lays the planks. */
    this.bridgeLane = new Set();
    /** Crossing ids whose planks are all down. */
    this.openCrossings = new Set();
    /**
     * Things that should stop the player: {x, z, radius}. Only the BUILDINGS
     * had colliders before, so Zara walked straight through the market, the
     * fountain, and every tree in the valley.
     */
    this.solids = [];
    /** tile key -> ground height. See heightAt(). */
    this._heightCache = new Map();
    /**
     * Per-frame hooks for things that move (wind turbines, the hydro wheel).
     * decoration.js adds to this; update() calls each with the elapsed time.
     */
    this.animators = [];
  }

  /**
   * Final ground height at a world position. One source of truth: the tiles are
   * built from this, the physics height field reads it, and every prop and
   * building is placed on it.
   */
  /**
   * Ground height, smoothly interpolated.
   *
   * The expensive part (walking every building and path segment) is cached on
   * integer tile corners; this then bilinearly blends the four corners around
   * the sample. Rounding to the nearest corner instead would make the player
   * jump between discrete heights on ground that is now visibly continuous.
   */
  heightAt(x, z) {
    // The ground mesh's vertices sit on half-integers (x.5), so the cells the
    // physics interpolates between must be the same ones the mesh uses.
    const x0 = Math.floor(x - 0.5) + 0.5, z0 = Math.floor(z - 0.5) + 0.5;
    const fx = x - x0, fz = z - z0;

    const h00 = this.cornerHeight(x0, z0);
    const h10 = this.cornerHeight(x0 + 1, z0);
    const h01 = this.cornerHeight(x0, z0 + 1);
    const h11 = this.cornerHeight(x0 + 1, z0 + 1);

    // PLANAR per triangle, matching how the ground mesh is actually
    // triangulated - NOT bilinear. Bilinear agrees with the mesh only at the
    // corners; in between it drifted by up to 0.13 units, which is why she
    // floated over one half of each quad and sank into the other.
    //
    // PlaneGeometry splits each quad along the (x0,z1)-(x1,z0) diagonal.
    if (fx + fz <= 1) {
      // Lower triangle: h00 + slope in each axis.
      return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    }
    // Upper triangle, anchored at the opposite corner.
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  /** Cached height at a mesh vertex (half-integer world coords). */
  cornerHeight(x, z) {
    const key = `${x},${z}`;
    const hit = this._heightCache.get(key);
    if (hit !== undefined) return hit;
    const value = this.computeHeight(x, z);  // continuous: no rounding
    this._heightCache.set(key, value);
    return value;
  }

  computeHeight(x, z) {
    let h = TERRAIN.rawAt(x, z);

    // Level the places gameplay happens. `flat` is 0 (untouched) to 1 (level).
    let flat = 0;
    const hub = ROCKET_VILLAGE.hub;
    flat = Math.max(flat, falloff(Math.hypot(x - hub.x, z - hub.z), 9, 15));
    for (const b of ROCKET_VILLAGE.buildings) {
      flat = Math.max(flat, falloff(Math.hypot(x - b.x, z - b.z), b.radius + 1, b.radius + 6));
    }
    const pad = ROCKET_VILLAGE.rocketPad;
    flat = Math.max(flat, falloff(Math.hypot(x - pad.x, z - pad.z), 14, 20));
    for (const path of VILLAGE_PATHS) {
      for (let n = 0; n < path.points.length - 1; n++) {
        const [ax, az] = path.points[n];
        const [bx, bz] = path.points[n + 1];
        const d = pointToSegment(x, z, ax, az, bx, bz);
        flat = Math.max(flat, falloff(d, path.width * 0.5 + 0.5, path.width * 0.5 + 4));
        if (flat >= 1) break;
      }
    }
    h *= 1 - flat;

    // Landmark hills ride on top of the general roll, tapered by the same
    // `flat` mask so they vanish near a path or a building instead of
    // fighting the level ground gameplay needs.
    h += landmarkBumpAt(x, z) * (1 - flat);

    // The river runs in a cut, so water sits below the banks it flows between.
    const across = Math.abs(RIVER.offsetAt(x, z)) / (RIVER.widthAt(x) + 3);
    if (across < 1) h -= (1 - across) * 1.5;

    // A proper riverbank has a lip: ground rises right at the water's edge
    // before settling back into the general roll, so the bank reads as a cut
    // the water runs through rather than flat ground that merely changes
    // colour at the waterline. It sits just outside the water, roughly under
    // the "bank" tint painted in paint(), and is suppressed near paths and
    // buildings for the same reason the landmark hills are.
    const edgeDist = Math.abs(RIVER.offsetAt(x, z)) - RIVER.widthAt(x);
    if (edgeDist >= 0 && edgeDist < 2.4) {
      const t = edgeDist / 2.4;
      h += Math.sin(t * Math.PI) * 1.8 * (1 - flat);
    }

    // No quantising: the ground is a continuous mesh now, so it stays smooth.
    return h * TERRAIN.AMPLITUDE;
  }

  /** World x/z -> board indices. */
  toTile(x, z) {
    return { i: Math.round(x) - BOUNDS.minX, j: Math.round(z) - BOUNDS.minZ };
  }

  tint(x, z, colour) {
    const { i, j } = this.toTile(x, z);
    if (!this.board.inBounds(i, j)) return;
    this.board.set(i, j, 'grass', 0, colour, this.heightAt(x, z));
  }

  paint() {
    const rng = makeRng();

    // 1. Grass everywhere. NOT a checkerboard - alternating tiles drew a
    // chessboard across the whole valley. Tone varies on smooth noise instead,
    // so the field reads as uneven growth rather than as a grid.
    for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z++) {
      for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x++) {
        const n =
          Math.sin(x * 0.21 + Math.cos(z * 0.17) * 1.6) *
          Math.sin(z * 0.19 - Math.cos(x * 0.13) * 1.2);
        this.tint(x, z, n > 0.15 ? TINT.grassA : (n < -0.35 ? TINT.grassC : TINT.grassB));
      }
    }

    // 2. Paths. VILLAGE_PATHS already routes spawn -> hub -> every site.
    for (const path of VILLAGE_PATHS) {
      for (const [x, z] of pathTiles(path.points, path.width)) {
        this.tint(x, z, TINT.path);
      }
    }

    // 3. Plaza at the hub, so the centre reads as a built place.
    //
    // Not a disc. A hard circle of paving with grass right up to it reads as a
    // decal dropped on the field - real paving frays at the edge, where grass
    // creeps between the stones and the last few slabs are missing. The
    // radius wobbles on three harmonics so it never reads as a drawn curve,
    // the paving itself thins out gradually toward the rim instead of
    // stopping at a fixed band, and a ring of worn dirt/gravel outside the
    // wobbled edge - thinning further with distance - stands in for the
    // scuffed ground real paving leaves behind before the grass takes over.
    // Three surfaces interleaving (paving, worn ground, grass) reads as a
    // place that grew ragged at its border, not a tile that stops dead.
    const hub = ROCKET_VILLAGE.hub;
    const edgeRng = makeRng(5150);
    for (let x = hub.x - 14; x <= hub.x + 14; x++) {
      for (let z = hub.z - 14; z <= hub.z + 14; z++) {
        const dx = x - hub.x, dz = z - hub.z;
        const d = Math.hypot(dx, dz);
        const a = Math.atan2(dz, dx);
        const wobble =
          Math.sin(a * 3.1 + 0.7) * 0.55 +
          Math.sin(a * 5.3 - 1.4) * 0.35 +
          Math.sin(a * 8.7 + 2.9) * 0.22;
        const edge = 8.5 + wobble;
        if (d > edge + 2.6) continue;

        if (d <= edge) {
          // Fraying grows toward the rim instead of a flat chance across a
          // fixed band, so the paving thins out rather than ending in a ring.
          const rim = Math.max(0, (d - (edge - 1.8)) / 1.8);
          if (rim > 0 && edgeRng() < rim * 0.5) continue;
          this.tint(x, z, TINT.plaza);
          continue;
        }

        // Just past the wobbled edge: worn ground, thinning out the further
        // you go, so it fades into grass rather than forming a second ring.
        const past = d - edge;
        const chance = Math.max(0, 1 - past / 2.6);
        if (edgeRng() < chance * 0.6) this.tint(x, z, TINT.plazaEdge);
      }
    }

    // 4. The river, painted last so it cuts everything including the path.
    // It follows a meandering centreline, so it is swept per column of x.
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x++) {
      const centre = RIVER.centreAt(x);
      const half = RIVER.widthAt(x);
      const crossing = CROSSINGS.find((c) => Math.abs(x - c.x) <= RIVER.bridgeHalfWidth);

      for (let z = Math.floor(centre - half - 2); z <= Math.ceil(centre + half + 2); z++) {
        const d = Math.abs(z - centre);
        if (d > half + 1.6) continue;

        if (d > half) { this.tint(x, z, TINT.bank); continue; }

        // Water runs UNDER a bridge. Painting the crossing as path made a dry
        // causeway straight through the river, which read as a road, not a ford.
        this.tint(x, z, d < half * 0.45 ? TINT.waterDeep : TINT.waterShallow);
        if (crossing) {
          this.bridgeLane.add(`${Math.round(x)},${Math.round(z)}`);
        } else {
          this.blocked.add(`${Math.round(x)},${Math.round(z)}`);
        }
      }
    }
  }

  /**
   * True if the player may stand here. The river is the level's golden lock:
   * the bridge lane only opens once the quest chain has laid all five planks.
   */
  isWalkable(x, z) {
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (this.blocked.has(key)) return false;
    if (this.bridgeLane.has(key) && !this.openCrossings.size) return false;
    return true;
  }

  /** True once any crossing is complete. */
  get bridgeOpen() { return this.openCrossings.size > 0; }

  /**
   * The height of whatever you would STAND on here - terrain, or a bridge deck
   * where one has been laid.
   *
   * `heightAt` is the riverbed under a bridge, because that is what the ground
   * mesh does. Everything that walks was following it, so the player and the
   * villagers both sank into the water halfway across and came up the far bank
   * - which reads as "they cannot cross", not as "they are on a bridge".
   *
   * Only OPEN crossings count. An unlaid bridge is still a river.
   */
  surfaceHeightAt(x, z) {
    const ground = this.heightAt(x, z);
    for (const c of CROSSINGS) {
      if (!this.openCrossings.has(c.id)) continue;
      if (Math.abs(x - c.x) > RIVER.bridgeHalfWidth) continue;
      const centre = RIVER.centreAt(c.x);
      // Same margin the deck is built with, so the walkable surface and the
      // planks under it end at the same place.
      const half = RIVER.widthAt(c.x) + BRIDGE_BANK_MARGIN;
      const d = Math.abs(z - centre);
      if (d > half) continue;
      const deckY = this.heightAt(c.x, centre) + BRIDGE_DECK_Y;
      // Ramp on and off over the last unit of deck, so stepping onto the
      // bridge is a step up rather than a teleport.
      const blend = Math.min(1, (half - d) / 1.0);
      return ground + (deckY - ground) * blend;
    }
    return ground;
  }

  /** Drive the water. Called once per frame. */
  update(t) {
    this.water?.update(t);
    for (const step of this.animators) step(t);
  }

  /** Somewhere a prop must not go: on a path, a plaza, the river, or a site. */
  /**
   * Room that must stay clear of vegetation, whichever scatter is asking.
   *
   * This existed only inside isClear(), which the edge-forest belt does not
   * use - and the belt is the one that runs along the board edge, which is
   * where the launch pad is. The result was 22 trees within twelve units of
   * the pad and 47 within twenty: the climax of the game watched through a
   * wood, with one trunk growing through the launch signpost itself.
   *
   * Stations are in here for the same reason. Seven of the nine signposts had
   * a tree inside four units, and the Materials Forge could not be seen at all
   * from its own front door.
   *
   * @returns {boolean} true if a tree may stand here
   */
  clearOfSites(x, z) {
    const hub = ROCKET_VILLAGE.hub;
    if (Math.hypot(x - hub.x, z - hub.z) < 12) return false;
    for (const b of ROCKET_VILLAGE.buildings) {
      // radius + 3 was tuned when a tree was 1.7 units tall. They are 6 now.
      if (Math.hypot(x - b.x, z - b.z) < b.radius + 7) return false;
    }
    // The pad wants a real clearing, not a gap: it is 12 units across, the
    // gantry is taller than the trees, and the whole point is to watch it go.
    const pad = ROCKET_VILLAGE.rocketPad;
    if (Math.hypot(x - pad.x, z - pad.z) < PAD_CLEARING) return false;
    for (const m of MEADOWS) {
      if (Math.hypot(x - m.x, z - m.z) < m.r) return false;
    }
    // A signpost you cannot see is a signpost that is not there.
    for (const st of Object.values(stationPositions())) {
      if (Math.hypot(x - st.x, z - st.z) < STATION_CLEARING) return false;
    }
    return true;
  }

  /** Within `margin` of any authored route? Used to decide what may grow there. */
  nearAnyPath(x, z, margin) {
    for (const path of VILLAGE_PATHS) {
      for (let n = 0; n < path.points.length - 1; n++) {
        const [ax, az] = path.points[n];
        const [bx, bz] = path.points[n + 1];
        if (pointToSegment(x, z, ax, az, bx, bz) < path.width * 0.5 + margin) return true;
      }
    }
    return false;
  }

  isClear(x, z, rng) {
    if (!this.isWalkable(x, z)) return false;
    if (Math.abs(RIVER.offsetAt(x, z)) < RIVER.widthAt(x) + 5) return false; // river corridor and banks
    if (!this.clearOfSites(x, z)) return false;
    for (const [i, path] of VILLAGE_PATHS.entries()) {
      const margin = i < 2 ? MAIN_ROAD_CLEARING : SPUR_CLEARING;
      for (let n = 0; n < path.points.length - 1; n++) {
        const [ax, az] = path.points[n];
        const [bx, bz] = path.points[n + 1];
        if (pointToSegment(x, z, ax, az, bx, bz) < path.width * 0.5 + margin) return false;
      }
    }
    // Groves and clearings: a soft, noise-driven gate so vegetation clumps
    // instead of spreading evenly. The odds never hit 0 or 1, so a clearing
    // still gets the rare lone tree and a grove the rare gap - a suspiciously
    // bare disc would read as a bug, not a place.
    const openness = 1 / (1 + Math.exp(-groveFieldAt(x, z) * 1.8));
    if (rng() > 0.12 + 0.85 * openness) return false;
    return true;
  }

  /** Scatter one instanced family, honouring the exclusion rules. */
  scatter(count, rng, { minGap = 2.4 } = {}) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard < count * 60) {
      guard += 1;
      const x = BOUNDS.minX + rng() * (BOUNDS.maxX - BOUNDS.minX);
      const z = BOUNDS.minZ + rng() * (BOUNDS.maxZ - BOUNDS.minZ);
      if (!this.isClear(x, z, rng)) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < minGap)) continue;
      out.push({ x, z, y: this.heightAt(x, z), rotY: rng() * Math.PI * 2 });
    }
    return out;
  }

  /**
   * A dense band of trees around the whole perimeter. Instanced per species,
   * so the whole belt is a handful of draw calls.
   */
  async plantEdgeForest() {
    const rng = makeRng(8801);
    const KENNEY = (n) => asset(`assets/models/kenney_nature/${n}.glb`);
    const species = ['tree_default', 'tree_oak', 'tree_pineDefaultA', 'tree_fat', 'tree_detailed'];
    const buckets = Object.fromEntries(species.map((k) => [k, []]));

    // Trees standing ON the mountain ring, not just in front of it. Bare grey
    // cliffs read as a quarry; broken up by a treeline they read as wooded
    // hills. These go into the SAME buckets as the perimeter belt, so the
    // whole range is dressed for no extra draw calls at all - the alternative,
    // a separate scatter, would have cost four more instanced meshes against a
    // budget already sitting in the 140s.
    let onMountains = 0;
    for (const a of mountainTreeAnchors(BOUNDS)) {
      // Conifers dominate at altitude, which is both true and useful: the
      // pine silhouette is the one that still reads at that distance.
      const asset = rng() < 0.55 ? 'tree_pineDefaultA'
        : species[Math.floor(rng() * species.length)];
      buckets[asset].push(a);
      onMountains++;
    }
    this.mountainTrees = onMountains;

    // Three bands, densest at the outside, thinning inward so the treeline
    // feels like a wood rather than a fence.
    for (let band = 0; band < 3; band++) {
      const inset = 2 + band * 4.5;
      const density = 1 - band * 0.28;
      const step = 2.0 + band * 0.9;

      for (let x = BOUNDS.minX + inset; x <= BOUNDS.maxX - inset; x += step) {
        for (const z of [BOUNDS.minZ + inset, BOUNDS.maxZ - inset]) {
          if (rng() > density) continue;
          this.pushEdgeTree(buckets, species, rng, x, z);
        }
      }
      for (let z = BOUNDS.minZ + inset; z <= BOUNDS.maxZ - inset; z += step) {
        for (const x of [BOUNDS.minX + inset, BOUNDS.maxX - inset]) {
          if (rng() > density) continue;
          this.pushEdgeTree(buckets, species, rng, x, z);
        }
      }
    }

    await Promise.all(Object.keys(buckets).map((a) => loadShared(KENNEY(a))));

    let planted = 0;
    for (const [asset, placements] of Object.entries(buckets)) {
      if (!placements.length) continue;
      await this.board.addProps(asset, placements, {
        assetPath: KENNEY(asset),
        partTints: EDGE_TINTS[asset],
        castShadow: false,   // the belt is backdrop; shadows there cost and show nothing
        outline: false,
      });
      planted += placements.length;
    }
    this.edgeTrees = planted;
    return planted;
  }

  pushEdgeTree(buckets, species, rng, x, z) {
    const jx = x + (rng() - 0.5) * 2.6;
    const jz = z + (rng() - 0.5) * 2.6;
    if (!this.isWalkable(jx, jz)) return;
    // The belt runs along the board edge, and the launch pad is ON that edge.
    // Without this the perimeter wood grows straight through the pad.
    if (!this.clearOfSites(jx, jz)) return;
    // Keep the treeline off the paths so it never blocks a route, and well off
    // the two main roads so they have somewhere to breathe.
    for (const [i, path] of VILLAGE_PATHS.entries()) {
      const margin = i < 2 ? MAIN_ROAD_CLEARING : 2.5;
      for (let n = 0; n < path.points.length - 1; n++) {
        const [ax, az] = path.points[n];
        const [bx, bz] = path.points[n + 1];
        if (pointToSegment(jx, jz, ax, az, bx, bz) < path.width * 0.5 + margin) return;
      }
    }
    const pool = this.nearAnyPath(jx, jz, PATH_TRUNK_MARGIN)
      ? species.filter((a) => CLEAN_TRUNK.has(a))
      : species;
    const asset = pool[Math.floor(rng() * pool.length)] || species[0];
    buckets[asset].push({ x: jx, z: jz, y: this.heightAt(jx, jz), rotY: rng() * 6.28, scale: 0.9 + rng() * 0.5 });
  }

  async build() {
    this.paint();
    // The board samples this while displacing the ground mesh.
    this.board.sampleHeight = (x, z) => this.heightAt(x, z);
    await this.board.build();

    // The paved roads, kerbs, lane lines and plaza slabs, on the same heights.
    // One flat mesh with its own material: polygonOffset keeps it above the
    // ground where the two meet, and the lifts keep each layer above the last.
    const streetMat = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: toonRamp,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const streets = new THREE.Mesh(streetGeometry(this), streetMat);
    streets.name = 'streets';
    streets.receiveShadow = true;
    streets.castShadow = false;
    this.group.add(streets);

    const rng = makeRng(20260911);
    const NA = (n) => asset(`assets/models/nature/${n}.gltf`);

    // Vegetation comes from Quaternius nature: it is textured (map + vertex
    // colours) and reads far better cel-shaded than Kenney's flat-coloured set.
    // Quaternius trunks are expensive - measured 1,705-4,345 triangles EACH,
    // so tree count is the scene's whole triangle budget. Counts below are
    // tuned against that, and only trees and rocks cast shadows: ground clutter
    // casting shadows doubled its cost for something nobody sees.
    // MEASURED cost per tree, which decides the whole mix:
    //
    //   Quaternius CommonTree_1  6,265 tris   (bark 4,345 + leaves 1,920)
    //   Kenney     tree_default    114 tris   <- 55x cheaper
    //
    // So the forest is Kenney and the hero trees are Quaternius. At forest
    // distance nobody can tell a 114-triangle tree from a 6,000-triangle one;
    // up close beside the road, they can. This buys a DENSER village for a
    // third of the triangles, rather than trading density away for budget.
    const KENNEY = (n) => asset(`assets/models/kenney_nature/${n}.glb`);
    const families = [
      // --- bulk forest: cheap, plentiful ---
      // Tints are keyed by MATERIAL NAME, not sub-mesh index - board.js
      // tintForPart(). Four of these five trees export their leaves first, so
      // the old positional array painted the foliage with the bark colour.
      { asset: 'tree_default', path: KENNEY, n: 46, scale: 1.0, gap: 3.4, shadow: true,
        tints: { woodBark: 0x6f4f2e, leafsGreen: 0x4e9e46 } },
      { asset: 'tree_oak', path: KENNEY, n: 34, scale: 1.05, gap: 3.6, shadow: true,
        tints: { woodBark: 0x76532d, leafsGreen: 0x5cb04e } },
      { asset: 'tree_pineDefaultA', path: KENNEY, n: 30, scale: 1.0, gap: 3.6, shadow: true,
        tints: { woodBarkDark: 0x63452a, leafsDark: 0x367f40 } },
      { asset: 'tree_detailed', path: KENNEY, n: 18, scale: 1.0, gap: 4.0, shadow: true,
        tints: { woodBark: 0x6f4f2e, leafsGreen: 0x54a44c, _defaultMat: 0x54a44c } },
      { asset: 'tree_fat', path: KENNEY, n: 16, scale: 1.1, gap: 3.4, shadow: true,
        tints: { woodBark: 0x6f4f2e, leafsGreen: 0x67b356 } },
      { asset: 'plant_bushDetailed', path: KENNEY, n: 34, scale: 1.0, gap: 2.4, shadow: false,
        tints: { grass: 0x4a9448 } },
      // These rocks are modelled as grass-capped boulders, so their materials
      // are named `dirt` (the stone body) and `grass` (the cap). The old
      // single-entry array greyed only whichever came first and left the rest
      // at the pack's native palette - which is where the brown lumps in the
      // treeline came from. Stone body, mossy cap.
      { asset: 'rock_smallA', path: KENNEY, n: 18, scale: 1.0, gap: 2.8, shadow: false,
        tints: { dirt: 0x8b9199, grass: 0x5f9350, _defaultMat: 0x8b9199 } },
      { asset: 'rock_largeB', path: KENNEY, n: 10, scale: 1.0, gap: 3.6, shadow: true,
        tints: { dirt: 0x8b9199, grass: 0x5f9350, _defaultMat: 0x8b9199 } },

      // --- hero accents: the expensive, textured Quaternius set, used sparingly ---
      { asset: 'CommonTree_3', n: 8, scale: SCALE.natureTree * 0.9, gap: 6.0, shadow: true },
      { asset: 'CommonTree_5', n: 5, scale: SCALE.natureTree * 1.05, gap: 6.5, shadow: true },
      { asset: 'Pine_2', n: 5, scale: SCALE.natureTree * 0.95, gap: 6.5, shadow: true },
      { asset: 'Bush_Common_Flowers', n: 14, scale: SCALE.natureBush, gap: 3.0, shadow: false },
      { asset: 'Flower_3_Group', n: 22, scale: SCALE.natureGrass, gap: 2.2, shadow: false },
      { asset: 'Mushroom_Common', n: 10, scale: SCALE.natureMushroom, gap: 2.4, shadow: false },
    ];

    // Warm every species concurrently before placing any of them, for the same
    // reason the structures preload: sequential awaits were the load time.
    await Promise.all(families.map((f) => loadShared((f.path || NA)(f.asset))));

    for (const f of families) {
      let placements = this.scatter(f.n, rng, { minGap: f.gap }).map((p) => ({
        ...p,
        // Slight per-instance size variation kills the copy-paste look.
        scale: f.scale * (0.85 + rng() * 0.3),
      }));
      // A species with branch stubs at head height does not go on a verge -
      // see CLEAN_TRUNK. It simply loses those spots rather than being moved,
      // because the clean-trunked families are already scattering over the
      // same ground and will fill them.
      if (f.path === KENNEY && !CLEAN_TRUNK.has(f.asset) && /^tree_/.test(f.asset)) {
        placements = placements.filter((p) => !this.nearAnyPath(p.x, p.z, PATH_TRUNK_MARGIN));
      }
      // Trunks and boulders are solid; flowers, mushrooms and grass are not -
      // a child should brush through undergrowth, not be fenced in by it.
      if (SOLID_FAMILIES.has(f.asset)) {
        // Radii below are in the PACK's own units, so they track the model
        // through contracts.js PACK_SCALE instead of having to be retuned by
        // hand every time a pack's scale changes. Then scale with the instance
        // too: these are jittered 0.85-1.15.
        const r = (SOLID_RADIUS[f.asset] ?? 0.35) * packScaleFor((f.path || NA)(f.asset));
        if (r > 0) {
          for (const p of placements) {
            this.solids.push({ x: p.x, z: p.z, radius: r * (p.scale ?? 1) });
          }
        }
      }
      await this.board.addProps(f.asset, placements, {
        assetPath: (f.path || NA)(f.asset),
        castShadow: f.shadow,
        partTints: f.tints || null,
        // Outlines cost a second InstancedMesh per sub-mesh. The bulk forest is
        // small and distant, so it goes without; the hero trees keep theirs.
        outline: f.shadow && !f.tints,
      });
    }

    // A thick belt of trees around the whole perimeter. The board used to just
    // stop, showing bare ground running out to the mountains; the treeline
    // closes the valley so the child never sees the edge.
    await this.plantEdgeForest();

    // Bridges. Each sits on the river's centreline at its own x, so they follow
    // the meander automatically rather than being hand-placed. See bridge.js
    // for why these are built from geometry rather than tiled from the kit.
    this.bridgeStructures = new Map();
    for (const c of CROSSINGS) {
      const centre = RIVER.centreAt(c.x);
      const half = RIVER.widthAt(c.x);
      // Reach a clear margin ONTO both banks, not just to the waterline.
      const span = (half + BRIDGE_BANK_MARGIN) * 2;
      const deckY = this.heightAt(c.x, centre) + BRIDGE_DECK_Y;

      const built = buildBridge({
        x: c.x,
        centre,
        span,
        width: BRIDGE_WIDTH,
        deckY,
        waterY: this.heightAt(c.x, centre),
        pieces: c.planks,
      });
      this.group.add(built.mesh);

      const handle = {
        id: c.id,
        label: c.id === 'bridge' ? 'The bridge' : 'The east bridge',
        group: this.group,
        pieceCount: c.planks,
        showPieces: (n) => {
          if (built.showPieces(n)) this.openCrossings.add(c.id);
          else this.openCrossings.delete(c.id);
        },
        footprint: { x: c.x, z: centre, radius: span / 2, halfWidth: built.halfWidth },
      };
      handle.showPieces(0);
      this.bridgeStructures.set(c.id, handle);
    }
    // The quest chain addresses the main crossing by the id "bridge".
    this.bridgeStructure = this.bridgeStructures.get('bridge');

    // Animated water, laid over the blocked tiles.
    this.water = createRiverSurface(RIVER, BOUNDS, { heightAt: (x, z) => this.heightAt(x, z) });
    this.group.add(this.water.mesh);

    return this.group;
  }
}

/** 1 inside `inner`, 0 beyond `outer`, smooth between. */
function falloff(d, inner, outer) {
  if (d <= inner) return 1;
  if (d >= outer) return 0;
  const t = (d - inner) / (outer - inner);
  return 1 - t * t * (3 - 2 * t);
}

function pointToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
