// The mountain ring that closes the valley.
//
// Without it the board ends in mid-air and the child can see the void past the
// last tile. A ring of cliff blocks turns "the map stops here" into "the valley
// is surrounded", which needs no explanation.
//
// Built from kenney_nature's 56 cliff pieces, merged into a few arcs of the ring
// (board.js bakeScatter) so the whole range costs a handful of draw calls rather
// than one per rock, and an arc behind the camera is culled as one.
import * as THREE from 'three';
import { bakeScatter, sectorCellOf, KN } from './board.js';

/** The ring is baked into this many arcs (see buildMountainRing). */
const MOUNTAIN_ARCS = 12;

/** Cliff pieces that read well as mountain mass, biggest first. */
const PIECES = [
  'cliff_large_rock',
  'cliff_blockSlope_rock',
  'cliff_block_rock',
  'cliff_cornerLarge_rock',
  'cliff_blockHalf_rock',
  'cliff_rock',
];

/** Deterministic, so the skyline is the same every run. */
function makeRng(seed = 4242) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Ring the board with cliffs.
 *
 * @param {THREE.Object3D} parent
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
 * @param {object} [opts]
 * @param {number} [opts.rings=3]     concentric bands; further bands sit higher
 * @param {number} [opts.spacing=5]   distance between pieces along a band
 */
/**
 * Approximate top of a cliff piece, in prototype units. The pieces are all
 * roughly a unit block; this is what the tree scatter stands on, and it only
 * has to be close - at 26+ units out and 7x scale, a tree half a unit low
 * still reads as sitting on the rock.
 */
const PIECE_TOP = 0.9;

/**
 * Where the ring's pieces go. PURE and deterministic, so both the cliff
 * builder and the tree scatter can call it and get the same answer without
 * caring which of them runs first.
 *
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
 * @param {object} [opts]
 * @param {number} [opts.rings=4]     concentric bands; further bands sit higher
 * @param {number} [opts.spacing=4.2] distance between pieces along a band
 * @returns {{byPiece: Record<string, Array<object>>, rings: Array<Array<object>>}}
 */
export function mountainRingLayout(bounds, { rings = 4, spacing = 4.2 } = {}) {
  const rng = makeRng();
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2;

  /** @type {Record<string, Array<object>>} */
  const byPiece = {};
  const perRing = [];
  const push = (piece, p) => { (byPiece[piece] ||= []).push(p); };

  for (let ring = 0; ring < rings; ring++) {
    // Each band steps outward and upward, so the silhouette builds into a
    // range rather than a single wall. Every piece is sunk BELOW ground: only
    // its upper mass should show, otherwise the blocks read as boulders
    // floating at the horizon instead of as mountains rooted in the earth.
    // Ring 0 used to sit 3 units past the board edge, which put a 30-unit
    // cliff about ten paces behind the spawn point and walled the village in.
    // The first range now starts well beyond anywhere she can walk.
    const out = 26 + ring * 16;
    const rx = halfX + out;
    const rz = halfZ + out;
    const sink = -7 - ring * 2.0;
    const scale = 6.5 + ring * 3.4;
    const step = spacing - ring * 0.8;

    const perimeter = 2 * (rx + rz) * 2;
    const n = Math.max(24, Math.floor(perimeter / step));
    const here = [];

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = t * Math.PI * 2;
      // Ellipse, jittered so the ring never reads as a geometric shape.
      const jitter = 1 + (rng() - 0.5) * 0.16;
      const x = cx + Math.cos(a) * rx * jitter;
      const z = cz + Math.sin(a) * rz * jitter;

      const piece = PIECES[Math.floor(rng() * PIECES.length)];
      const placement = {
        x, z,
        y: sink - rng() * 3.0,
        rotY: rng() * Math.PI * 2,
        scale: scale * (0.8 + rng() * 0.6),
      };
      push(piece, placement);
      here.push(placement);
    }
    perRing.push(here);
  }

  return { byPiece, rings: perRing };
}

/**
 * Anchor points for trees standing on the mountains.
 *
 * The bare grey cliffs read as a quarry, not as hills - what sells a wooded
 * range is trees breaking its silhouette. These sit on the two NEAREST bands
 * only: the far ones are hazed out by fog and would cost placements nobody can
 * make out. Scales are large because the anchors are 26-42 units past the board
 * edge and everything out there is at 6-10x.
 *
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
 * @returns {Array<{x:number,z:number,y:number,rotY:number,scale:number}>}
 */
export function mountainTreeAnchors(bounds) {
  const { rings } = mountainRingLayout(bounds);
  const rng = makeRng(9157);
  const out = [];

  // Band 0 gets the densest cover, band 1 thins out into the haze.
  for (const [band, density] of [[0, 0.62], [1, 0.34]]) {
    for (const p of rings[band] || []) {
      if (rng() > density) continue;
      // Two or three trees per rock, clustered, so the cover reads as a wood
      // rather than as one tree balanced on each block.
      const clump = 2 + (rng() < 0.45 ? 1 : 0);
      for (let k = 0; k < clump; k++) {
        const spread = p.scale * 0.42;
        out.push({
          x: p.x + (rng() - 0.5) * spread,
          z: p.z + (rng() - 0.5) * spread,
          y: p.y + PIECE_TOP * p.scale - 0.6,
          rotY: rng() * Math.PI * 2,
          // RELATIVE to the species' declared height (contracts.js
          // PROP_HEIGHT), not an absolute size: 1.0 is a normal village tree.
          // These are 26-42 units past the board edge and stand among cliffs
          // at 6-10x, so they run large - but nothing like the 3.4-6.6 this
          // was before the packs were normalised, which would now put 40-unit
          // trees on the skyline.
          scale: 1.1 + rng() * 0.9,
        });
      }
    }
  }
  return out;
}

export async function buildMountainRing(parent, bounds, { rings = 4, spacing = 4.2 } = {}) {
  const group = new THREE.Group();
  group.name = 'mountains';
  parent.add(group);

  const { byPiece } = mountainRingLayout(bounds, { rings, spacing });

  // Kenney cliffs ship near-white, which at distance reads as pale cardboard
  // rather than rock. Tint per band: nearer stone warm and solid, far ranges
  // cooler and lighter, which is the aerial perspective that sells depth.
  const families = Object.entries(byPiece).map(([piece, placements]) => ({
    path: KN(piece),
    placements,
    tint: 0x7d8a76,
    // Sized to the skyline by hand; the pack scale is for village props.
    packScale: false,
    // These are deliberately sunk below ground so only their upper mass
    // shows. Standing them on their own base would float the whole range.
    groundAlign: false,
    // Distant mass: no outlines (they would fringe the skyline) and no
    // shadow casting (nothing is behind them to receive it).
    outline: false,
    castShadow: false,
    receiveShadow: false,
  }));

  // Baked into merged arcs of the ring: a far arc behind the camera costs one
  // culled draw, and the whole range is at most one draw per arc rather than one
  // per cliff piece.
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const meshes = await bakeScatter(group, families, { cellOf: sectorCellOf(cx, cz, MOUNTAIN_ARCS) });

  return { group, meshCount: meshes.length, pieceTypes: Object.keys(byPiece).length };
}
