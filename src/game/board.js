// The village board: an instanced tile grid plus instanced scatter props.
//
// kenney_nature ships authored ground tiles that measure exactly 1.00 x 0.00 x
// 1.00 (verified in src/toonTest.js), so the board is a plain integer grid with
// no scale normalisation and no terrain sampling. Tile (i, j) sits at world
// (i - originX, 0, j - originZ).
//
// Every tile of a given type shares one InstancedMesh per sub-geometry, which is
// what keeps a 14x14 board inside the draw-call budget instead of the 187 calls
// a 7x7 board of individual clones cost.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakeParts, outlineMaterial, addGroundDetail, toonRamp } from './toonPipeline.js';
import { packScaleFor, asset } from './contracts.js';

const KN = (name) => asset(`assets/models/kenney_nature/${name}.glb`);

/** Tile vocabulary -> the authored Kenney model behind it. */
export const TILE = {
  grass: 'ground_grass',
  path: 'ground_pathStraight',
  pathBend: 'ground_pathBend',
  pathCross: 'ground_pathCross',
  pathSplit: 'ground_pathSplit',
  pathEnd: 'ground_pathEnd',
  pathCorner: 'ground_pathCorner',
  pathRocks: 'ground_pathRocks',
};

/**
 * In a single-file build the models arrive as blob: URLs, so a glTF's relative
 * image reference ("T_Brick_BaseColor.png") resolves against a blob: base and
 * finds nothing. Matching by FILENAME against the inlined map fixes that, and
 * matters for a second reason: the alternative - rewriting each texture into
 * every model that uses it - duplicated the seven shared medieval textures
 * across eight buildings and took the single file from 10 MB to 21 MB. This
 * way each texture is stored once and the loader caches it once.
 *
 * A no-op unless a build has left a map behind.
 */
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  const map = typeof window !== 'undefined' && window.__ROCKET_ASSETS;
  if (!map) return url;
  // This used to bail early on anything starting with `data:`, which looked
  // obviously right and broke every texture in the single-file copy.
  //
  // In that copy the MODEL is itself a data URI, so it has no directory for a
  // relative path to resolve against. three resolves the texture anyway and
  // hands us `data:application/json;base64,AAAA...../T_Brick.png` - which
  // still starts with `data:`, so the scheme check returned the mangled
  // string untouched and the browser answered ERR_INVALID_URL. Ninety-six
  // times, and the buildings came out white.
  //
  // So match on the FILENAME whatever the scheme. A genuine data URI has no
  // extension on its tail - base64's alphabet has no dot in it - so the guard
  // below skips real ones without a lookup.
  const name = url.split('/').pop().split('?')[0];
  if (!name || !/\.[a-z0-9]{2,5}$/i.test(name)) return url;
  for (const key in map) {
    if (key.endsWith(`/${name}`)) return map[key];
  }
  return url;
});

const loader = new GLTFLoader(manager);
const sceneCache = new Map();

/** Load a GLB once; hand back the shared scene (callers must not mutate it). */
export function loadShared(path) {
  if (!sceneCache.has(path)) {
    sceneCache.set(path, new Promise((resolve, reject) => {
      loader.load(path, (gltf) => resolve(gltf.scene), undefined, reject);
    }).catch((err) => {
      console.warn(`[board] missing asset ${path}:`, err?.message || err);
      return null;
    }));
  }
  return sceneCache.get(path);
}

const partsCache = new Map();

/** Baked, toon-converted parts for an asset path. */
async function partsFor(path, tint = null) {
  const key = `${path}|${tint ?? ''}`;
  if (!partsCache.has(key)) {
    const scene = await loadShared(path);
    partsCache.set(key, scene ? bakeParts(scene, { tint }) : []);
  }
  return partsCache.get(key);
}

/**
 * Resolve one sub-mesh's tint.
 *
 * `partTints` may be:
 *   - an object keyed by the source material's name (preferred, order-proof)
 *   - an array indexed by sub-mesh load order (legacy, fragile - see below)
 *
 * Material names arrive here prefixed by toToon() as `toon:<original>`, so
 * both spellings are accepted.
 *
 * @returns {number|undefined} colour, or undefined to leave the part alone
 */
function tintForPart(partTints, material, partIndex) {
  if (!partTints) return undefined;
  if (Array.isArray(partTints)) return partTints[partIndex];
  const name = material.name || '';
  const bare = name.startsWith('toon:') ? name.slice(5) : name;
  return partTints[name] !== undefined ? partTints[name] : partTints[bare];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _col = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Build one InstancedMesh per part of `path`, placed at `placements`.
 * @param {Array<{x:number,z:number,y?:number,rotY?:number,scale?:number}>} placements
 */
/**
 * How far a model's lowest point sits from its own origin, in prototype units.
 *
 * Most of these kits put a model's origin on its base, so a placement's `y`
 * lands it on the ground. Not all of them do: kenney_nature's windmill has its
 * origin 1.56 units UP, so placing it at ground height buried two and a third
 * units of it, and the banners hang 0.24 in the air for the mirror reason.
 * Aligning to the measured base makes every pack agree without anyone having
 * to know which ones are exceptions.
 *
 * Cached per path; it costs a bounding box over the whole prototype.
 */
const baseCache = new Map();
function baseOffsetFor(path, parts) {
  if (baseCache.has(path)) return baseCache.get(path);
  let minY = Infinity;
  for (const part of parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    minY = Math.min(minY, part.geometry.boundingBox.min.y);
  }
  const offset = Number.isFinite(minY) ? minY : 0;
  baseCache.set(path, offset);
  return offset;
}

async function instanceAsset(group, path, placements, {
  tint = null,
  packScale = true,
  groundAlign = true,
  castShadow = true,
  receiveShadow = true,
  outline = false,
  outlineScale = 1.045,
  perInstanceColor = false,
  groundDetail = false,
  partTints = null,
} = {}) {
  if (!placements.length) return [];
  const parts = await partsFor(path, tint);
  if (!parts.length) return [];

  // The packs disagree about what a unit is; contracts.js PACK_SCALE settles
  // it per pack, preserving each artist's internal proportions. Per-placement
  // `scale` stays a RELATIVE multiplier: 0.9 is a slightly small one of these.
  // Opt out (`packScale: false`) for anything already sized to fit something
  // else - the bridge deck is fitted to the river's width, the cliffs to the
  // skyline.
  const fit = packScale === false ? 1 : packScaleFor(path);
  // Anything deliberately sunk or floated (the cliff ring) opts out.
  const base = groundAlign === false ? 0 : baseOffsetFor(path, parts);

  const made = [];
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];

    // A single `tint` flattens a whole model to one colour, which turns a tree
    // into a green lollipop. partTints recolours each sub-mesh separately, so
    // a tree keeps a brown trunk and green leaves.
    //
    // Prefer the OBJECT form, keyed by material name. The array form indexes
    // sub-meshes in load order, and that order is whatever the artist happened
    // to export: of the five Kenney trees, only `tree_default` puts bark
    // first. The other four put leaves first, so an array of [bark, leaves]
    // painted their foliage brown and their trunks green - which is why the
    // treeline read as a dead wood. Material names (`woodBark`, `leafsGreen`,
    // `leafsDark`, ...) are stable, so match on those.
    let material = part.material;
    const hex = tintForPart(partTints, material, partIndex);
    if (hex !== undefined) {
      // Clone into a LOCAL, never back into `part` - `parts` is cached per
      // path, so writing through it leaks this caller's tints into every other
      // caller of the same model. The scatter and the edge forest both use
      // these trees, with different palettes.
      material = material.clone();
      material.color.setHex(hex);
      material.map = null;
      material.name = `${part.material.name}#${hex.toString(16)}`;
    }
    if (groundDetail) addGroundDetail(material);
    const mesh = new THREE.InstancedMesh(part.geometry, material, placements.length);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = false; // one batch covers the board; culling it as a unit hides everything

    let hull = null;
    if (outline && part.triangles <= 600) {
      hull = new THREE.InstancedMesh(part.geometry, outlineMaterial, placements.length);
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.frustumCulled = false;
      hull.userData.isOutline = true;
    }

    placements.forEach((p, i) => {
      _pos.set(p.x, p.y ?? 0, p.z);
      _q.setFromAxisAngle(_up, p.rotY ?? 0);
      const s = (p.scale ?? 1) * fit;
      _pos.y -= base * s;   // sit the model's BASE at the requested y
      _scl.setScalar(s);
      _m.compose(_pos, _q, _scl);
      mesh.setMatrixAt(i, _m);

      // instanceColor multiplies the material colour, so the shared material
      // stays white and each instance carries its own tint. This is what lets
      // the whole ground - grass, path, plaza, river - be ONE draw call.
      if (perInstanceColor && p.color !== undefined) {
        _col.setHex(p.color);
        mesh.setColorAt(i, _col);
      }

      if (hull) {
        _scl.setScalar(s * outlineScale);
        _m.compose(_pos, _q, _scl);
        hull.setMatrixAt(i, _m);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    made.push(mesh);

    if (hull) {
      hull.instanceMatrix.needsUpdate = true;
      group.add(hull);
      made.push(hull);
    }
  }
  return made;
}

/** Everything below this is solid rock; tile blocks extend down to it. */
export const LOWEST_GROUND = -4;

const TILE_BOX = new THREE.BoxGeometry(1, 1, 1);
/** Flat-ground tile: two triangles instead of twelve. */
const TILE_PLANE = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * One InstancedMesh of unit boxes, each scaled and coloured per instance.
 * Separate from instanceAsset() because the ground needs a non-uniform Y scale
 * that an asset-derived placement does not carry.
 */
function instanceBoxes(group, placements, { groundDetail = false, castShadow = false, receiveShadow = true } = {}) {
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp });
  if (groundDetail) addGroundDetail(material);

  const mesh = new THREE.InstancedMesh(TILE_BOX, material, placements.length);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = false;

  placements.forEach((p, i) => {
    _pos.set(p.x, p.y ?? 0, p.z);
    _q.setFromAxisAngle(_up, p.rotY ?? 0);
    _scl.set(1, p.scaleY ?? 1, 1);
    _m.compose(_pos, _q, _scl);
    mesh.setMatrixAt(i, _m);
    if (p.color !== undefined) { _col.setHex(p.color); mesh.setColorAt(i, _col); }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return [mesh];
}

/** Flat tiles: same instancing path, but a plane and no Y scale. */
function instancePlanes(group, placements, { groundDetail = false, receiveShadow = true } = {}) {
  if (!placements.length) return [];
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp });
  if (groundDetail) addGroundDetail(material);

  const mesh = new THREE.InstancedMesh(TILE_PLANE, material, placements.length);
  mesh.castShadow = false;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = false;

  placements.forEach((p, i) => {
    _pos.set(p.x, p.y ?? 0, p.z);
    _q.setFromAxisAngle(_up, p.rotY ?? 0);
    _scl.set(1, 1, 1);
    _m.compose(_pos, _q, _scl);
    mesh.setMatrixAt(i, _m);
    if (p.color !== undefined) { _col.setHex(p.color); mesh.setColorAt(i, _col); }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return [mesh];
}

export class TileBoard {
  /**
   * @param {number} width  tiles across
   * @param {number} depth  tiles deep
   */
  constructor(width = 14, depth = 14) {
    this.width = width;
    this.depth = depth;
    this.originX = Math.floor(width / 2);
    this.originZ = Math.floor(depth / 2);
    this.group = new THREE.Group();
    this.group.name = 'board';

    // type + rotation + tint per cell, defaulting to plain grass
    this.cells = new Array(width * depth).fill(null).map(() => ({ type: 'grass', rotY: 0, color: 0x6cb356, height: 0 }));
  }

  index(i, j) { return j * this.width + i; }
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.width && j < this.depth; }

  /** Tile coords -> world centre. Tiles are 1 unit, centred on integers. */
  tileToWorld(i, j) {
    return new THREE.Vector3(i - this.originX, 0, j - this.originZ);
  }

  /** World position -> nearest tile coords. */
  worldToTile(x, z) {
    return { i: Math.round(x + this.originX), j: Math.round(z + this.originZ) };
  }

  set(i, j, type, rotY = 0, color = 0x6cb356, height = 0) {
    if (!this.inBounds(i, j)) return;
    this.cells[this.index(i, j)] = { type, rotY, color, height };
  }

  /** Height of the tile under a world position, for physics and placement. */
  heightAt(x, z) {
    const { i, j } = this.worldToTile(x, z);
    const cell = this.get(i, j);
    return cell ? (cell.height ?? 0) : 0;
  }

  get(i, j) {
    return this.inBounds(i, j) ? this.cells[this.index(i, j)] : null;
  }

  /** Paint a straight run of path tiles, rotating them to follow the run. */
  paintPath(fromI, fromJ, toI, toJ) {
    const di = Math.sign(toI - fromI);
    const dj = Math.sign(toJ - fromJ);
    if (di !== 0 && dj !== 0) {
      console.warn('[board] paintPath expects a straight run');
      return;
    }
    // ground_pathStraight runs along +Z, so an east-west run turns 90 degrees.
    const rotY = di !== 0 ? Math.PI / 2 : 0;
    let i = fromI, j = fromJ;
    this.set(i, j, 'path', rotY);
    while (i !== toI || j !== toJ) {
      i += di; j += dj;
      this.set(i, j, 'path', rotY);
    }
  }

  /**
   * Create the instanced ground. Call once the cell map is final.
   *
   * Every tile is a BOX, not a plane, and every tile carries its own height.
   * A flat plane board looked like a table top; boxes give the ground real
   * relief and, because each one has sides, the steps between neighbours read
   * as low earth banks rather than as z-fighting seams.
   *
   * It is still ONE InstancedMesh: height rides in the instance matrix's Y
   * scale, colour in instanceColor. Grass, path, plaza, bank and riverbed all
   * render in a single draw call.
   */
  /**
   * Create the ground as ONE smooth, continuous mesh.
   *
   * It used to be ~8,000 instanced boxes, one per tile. That gave real relief
   * but it read as voxel stair-steps, and stepping is the wrong language for
   * this art style - the buildings and trees are smooth, so the land should be
   * too. A single displaced plane is smooth, cheaper (16k triangles against
   * 41k), and still ONE draw call.
   *
   * Vertices sit on tile corners, so the colour map painted into `cells` maps
   * straight onto vertex colours - and because they interpolate, the hard tile
   * edges soften into blended path margins for free.
   */
  async build() {
    const w = this.width;
    const d = this.depth;

    const geo = new THREE.PlaneGeometry(w, d, w, d);
    geo.rotateX(-Math.PI / 2);
    // MOVE the geometry into world space before sampling. Sampling at the
    // corrected coordinate while leaving the vertex where it was shifted the
    // whole height map half a tile off its own mesh - the player then floated
    // over one half of every quad and sank into the other.
    geo.translate(w / 2 - this.originX, 0, d / 2 - this.originZ);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      // Vertices are now at their true world positions.
      const x = pos.getX(i);
      const z = pos.getZ(i);

      pos.setY(i, this.sampleHeight ? this.sampleHeight(x, z) : 0);

      const cell = this.get(Math.round(x + this.originX), Math.round(z + this.originZ));
      c.setHex(cell ? cell.color : 0x6cb356);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const material = new THREE.MeshToonMaterial({
      gradientMap: toonRamp,
      vertexColors: true,
    });
    addGroundDetail(material);

    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'ground';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    this.group.add(mesh);

    this.groundMesh = mesh;
    this.tileMeshes = [mesh];
    return this.group;
  }

  /**
   * Scatter one instanced prop family across the board.
   * @param {string} assetName  model name; defaults to kenney_nature
   * @param {Array<{x:number,z:number,rotY?:number,scale?:number}>} placements
   * @param {object} [opts]
   * @param {string} [opts.assetPath]  full path, for packs other than kenney_nature
   */
  async addProps(assetName, placements, { assetPath, ...opts } = {}) {
    return instanceAsset(this.group, assetPath || KN(assetName), placements, {
      outline: true,
      castShadow: true,
      receiveShadow: true,
      ...opts,
    });
  }

  /** Rough draw-call accounting, so the budget stays honest. */
  stats() {
    let instanced = 0, instances = 0;
    this.group.traverse((o) => {
      if (o.isInstancedMesh) { instanced += 1; instances += o.count; }
    });
    return { instancedMeshes: instanced, totalInstances: instances };
  }
}

export { instanceAsset, KN };
