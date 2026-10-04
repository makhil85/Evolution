// The river crossings, built rather than tiled.
//
// These used to be kenney_nature's `bridge_wood` tile repeated along the span.
// That tile is SQUARE and carries its own end posts, so a row of them reads as
// a line of little tables with posts between each one - never as a bridge. No
// amount of scaling or tinting fixes that, because the repeated element is
// wrong, not its size or colour.
//
// So the bridge is geometry now: deck boards running ACROSS the span the way
// planks actually lie, a rail down each side carried on posts at intervals,
// and piers going down into the water. The three things that make a bridge
// read as a bridge are that the deck is continuous, the rails are unbroken,
// and something holds it up.
//
// Cost: the whole bridge is ONE merged, vertex-coloured mesh, so it is a
// single draw call. The quest reveals it in five pieces, which is a draw-range
// change rather than five meshes - the segments are laid down in order, so
// "the first N segments" is a contiguous run of indices.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';

/** Timber. Boards catch the light, the frame beneath is darker. */
const COLOR = {
  board: 0xc08b4e,
  rail: 0xa9743c,
  post: 0x8a5f34,
  pier: 0x6f4a27,
};

const _c = new THREE.Color();

/** Flat-colour a geometry so it can be merged into one vertex-coloured mesh. */
function paint(geo, hex) {
  _c.setHex(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** One painted box, positioned. Boxes are all this bridge is made of. */
function box(w, h, d, x, y, z, hex) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return paint(geo, hex);
}

/**
 * Build a crossing.
 *
 * @param {object} spec
 * @param {number} spec.x          where the bridge crosses, in world x
 * @param {number} spec.centre     river centreline z at that x
 * @param {number} spec.span       total length, bank to bank
 * @param {number} spec.width      deck width
 * @param {number} spec.deckY      top of the deck, world y
 * @param {number} spec.waterY     riverbed/water level, for how far piers drop
 * @param {number} [spec.pieces]   how many quest pieces reveal it
 * @returns {{mesh: THREE.Mesh, showPieces: (n:number)=>boolean, halfWidth:number}}
 */
export function buildBridge({ x, centre, span, width, deckY, waterY, pieces = 5 }) {
  const halfW = width / 2;
  const railY = deckY + 0.78;
  const z0 = centre - span / 2;

  // Boards are laid across the span, which is the direction planks actually
  // run on a footbridge - and it is what stops the deck reading as one slab.
  const BOARD = 0.42;       // board width along the span
  const GAP = 0.06;         // the dark line between boards
  const perSegment = Math.max(3, Math.round((span / pieces) / (BOARD + GAP)));
  const segLen = perSegment * (BOARD + GAP);

  /** Index count after each segment, so a draw range can stop cleanly. */
  const cumulative = [];
  const parts = [];
  let indices = 0;

  const push = (geo) => {
    parts.push(geo);
    indices += geo.index ? geo.index.count : geo.attributes.position.count;
  };

  for (let s = 0; s < pieces; s++) {
    const zStart = z0 + s * segLen;

    // --- the deck ---------------------------------------------------------
    for (let b = 0; b < perSegment; b++) {
      const bz = zStart + b * (BOARD + GAP) + BOARD / 2;
      push(box(width, 0.14, BOARD, x, deckY - 0.07, bz, COLOR.board));
    }

    // --- stringers: the two beams the boards rest on ----------------------
    for (const side of [-1, 1]) {
      push(box(0.18, 0.26, segLen, x + side * (halfW - 0.16), deckY - 0.26, zStart + segLen / 2, COLOR.pier));
    }

    // --- the rails --------------------------------------------------------
    // Unbroken along the whole segment. The kit tile's rails stopped and
    // restarted at every tile, which is most of why it looked like furniture.
    for (const side of [-1, 1]) {
      push(box(0.11, 0.11, segLen, x + side * (halfW - 0.09), railY, zStart + segLen / 2, COLOR.rail));
      push(box(0.09, 0.09, segLen, x + side * (halfW - 0.09), railY - 0.34, zStart + segLen / 2, COLOR.rail));
    }

    // --- posts ------------------------------------------------------------
    // One pair at the start of each segment, plus a closing pair on the last.
    const postZs = [zStart + 0.12];
    if (s === pieces - 1) postZs.push(zStart + segLen - 0.12);
    for (const pz of postZs) {
      for (const side of [-1, 1]) {
        push(box(0.15, railY - deckY + 0.24, 0.15,
          x + side * (halfW - 0.09), deckY + (railY - deckY) / 2 - 0.02, pz, COLOR.post));
      }
    }

    // --- piers ------------------------------------------------------------
    // Only where the bridge is actually over water. On the bank approaches a
    // pier would stick out of the grass, which looks worse than none.
    const midZ = zStart + segLen / 2;
    const overWater = Math.abs(midZ - centre) < span / 2 - 1.6;
    if (overWater) {
      const drop = Math.max(0.6, deckY - waterY + 0.8);
      for (const side of [-1, 1]) {
        push(box(0.2, drop, 0.2, x + side * (halfW - 0.3), deckY - 0.3 - drop / 2, midZ, COLOR.pier));
      }
      // Cross brace, so the piers read as a trestle rather than two sticks.
      push(box(width - 0.4, 0.14, 0.14, x, deckY - 0.3 - drop * 0.55, midZ, COLOR.pier));
    }

    cumulative.push(indices);
  }

  const geometry = mergeGeometries(parts, false);
  parts.forEach((g) => { if (g !== geometry) g.dispose(); });

  const material = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `bridge:${x}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  geometry.setDrawRange(0, 0);

  return {
    mesh,
    halfWidth: halfW,
    /** @returns {boolean} true once the crossing is complete */
    showPieces(n) {
      const shown = Math.max(0, Math.min(pieces, Math.round(n)));
      geometry.setDrawRange(0, shown === 0 ? 0 : cumulative[shown - 1]);
      mesh.visible = shown > 0;
      return shown >= pieces;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
