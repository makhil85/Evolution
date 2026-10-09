// A minimal .glb writer - now with a skeleton and animation.
//
// Written rather than pulled in, because three's GLTFExporter lives in
// examples/jsm and the export here has to handle exactly one case: a single
// indexed, rigidly-skinned mesh with positions, normals and vertex colours, no
// textures, no materials worth translating. That is a few hundred lines of
// glTF against a dependency the page would otherwise carry only for this.
//
// It is also the exact inverse of scripts/embed-models.mjs, which READS the
// GLB container - same header, same two chunks, same four-byte alignment.
//
// Spec: a GLB is a 12-byte header, then chunks. Chunk 0 is the glTF JSON,
// chunk 1 the binary blob its bufferViews point into. Both pad to 4 bytes -
// JSON with spaces, BIN with zeros - and the padding counts in the length.

const MAGIC = 0x46546c67;      // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942;  // "BIN\0"

const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_BYTE = 5121;

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** Round up to the next multiple of four. */
const pad4 = (n) => (n + 3) & ~3;

/**
 * Pack one indexed geometry, its skeleton and its clips into a .glb.
 *
 * @param {object} geo  a THREE.BufferGeometry (positions required; skinIndex
 *   and skinWeight required if a skeleton is given)
 * @param {object} [opts]
 * @param {string} [opts.name]        node name inside the file
 * @param {string} [opts.generator]   free text, written into asset.generator
 * @param {Array}  [opts.bones]       THREE.Bone[], parent before child
 * @param {object} [opts.skeleton]    THREE.Skeleton, for its boneInverses
 * @param {Array}  [opts.clips]       sampled clip data from clips.js - NOT
 *   THREE.AnimationClips; the raw times/values are what glTF wants
 * @returns {Blob} the .glb, ready to save
 */
export function exportGlb(geo, {
  name = 'girl',
  generator = 'Evolution character page',
  bones = null,
  skeleton = null,
  clips = [],
} = {}) {
  const position = geo.getAttribute('position');
  if (!position) throw new Error('exportGlb: geometry has no position attribute');
  const normal = geo.getAttribute('normal');
  const color = geo.getAttribute('color');
  const joints = geo.getAttribute('skinIndex');
  const weights = geo.getAttribute('skinWeight');
  const index = geo.getIndex();

  const rigged = !!(bones && skeleton && joints && weights);
  if (bones && !rigged) {
    throw new Error('exportGlb: a skeleton was given but the geometry carries no skin weights');
  }

  const bin = [];          // {data: TypedArray} | {pad: n}
  const bufferViews = [];
  const accessors = [];
  let offset = 0;

  /** Append one typed array as a bufferView, returning its index. */
  const view = (array, target) => {
    // Every accessor's byteOffset must align to its component size; starting
    // each view on a 4-byte boundary satisfies that for every type written
    // here, floats, uint32 and uint16 alike.
    const start = pad4(offset);
    if (start !== offset) bin.push({ pad: start - offset });
    bin.push({ data: array });
    offset = start + array.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset: start,
      byteLength: array.byteLength,
      ...(target ? { target } : {}),
    });
    return bufferViews.length - 1;
  };

  /** Component-wise bounds. Required on POSITION and on animation inputs. */
  const bounds = (array, stride) => {
    const min = new Array(stride).fill(Infinity);
    const max = new Array(stride).fill(-Infinity);
    for (let i = 0; i < array.length; i += stride) {
      for (let k = 0; k < stride; k++) {
        const v = array[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    return { min, max };
  };

  /** Add an accessor over a fresh bufferView; returns its index. */
  const accessor = (array, componentType, count, type, target, extra = {}) => {
    accessors.push({
      bufferView: view(array, target),
      componentType,
      count,
      type,
      ...extra,
    });
    return accessors.length - 1;
  };

  // --- vertex data ---------------------------------------------------------
  const attributes = {};

  const pos = new Float32Array(position.array);
  attributes.POSITION = accessor(
    pos, FLOAT, position.count, 'VEC3', ARRAY_BUFFER, bounds(pos, 3)
  );

  if (normal) {
    attributes.NORMAL = accessor(
      new Float32Array(normal.array), FLOAT, normal.count, 'VEC3', ARRAY_BUFFER
    );
  }

  if (color) {
    // glTF COLOR_0 is linear; three's vertex colours already are.
    attributes.COLOR_0 = accessor(
      new Float32Array(color.array), FLOAT, color.count, 'VEC3', ARRAY_BUFFER
    );
  }

  if (rigged) {
    // Both of these go out as bytes rather than the shorts and floats three
    // keeps in memory. The binding is rigid, so every weight is exactly 0 or 1
    // and every joint index is under twenty: a normalised byte stores 1.0 as
    // 255/255, which is lossless here, and the pair drops from 24 bytes per
    // vertex to 8 - about a third off the whole file.
    if (bones.length > 255) throw new Error('exportGlb: more than 255 joints needs 16-bit JOINTS_0');
    const j = new Uint8Array(joints.count * 4);
    const w = new Uint8Array(weights.count * 4);
    for (let i = 0; i < joints.count * 4; i++) {
      j[i] = joints.array[i];
      w[i] = Math.round(Math.min(1, Math.max(0, weights.array[i])) * 255);
    }
    attributes.JOINTS_0 = accessor(j, UNSIGNED_BYTE, joints.count, 'VEC4', ARRAY_BUFFER);
    attributes.WEIGHTS_0 = accessor(
      w, UNSIGNED_BYTE, weights.count, 'VEC4', ARRAY_BUFFER, { normalized: true }
    );
  }

  let indicesAccessor;
  if (index) {
    // Keep 16-bit where it fits: it halves the index block, and these figures
    // are a few thousand vertices.
    const use16 = position.count <= 65535;
    indicesAccessor = accessor(
      use16 ? new Uint16Array(index.array) : new Uint32Array(index.array),
      use16 ? UNSIGNED_SHORT : UNSIGNED_INT,
      index.count, 'SCALAR', ELEMENT_ARRAY_BUFFER
    );
  }

  // --- nodes, and the skin -------------------------------------------------
  // Node 0 is the mesh. Bones follow, so a bone's node index is 1 + its joint
  // index, which is also the order the skin's `joints` array is written in.
  const nodes = [{ name, mesh: 0, ...(rigged ? { skin: 0 } : {}) }];
  const sceneNodes = [0];
  const skins = [];
  let boneNode = null;

  if (rigged) {
    boneNode = new Map();
    bones.forEach((b, i) => { boneNode.set(b, i + 1); });

    for (const b of bones) {
      const node = { name: b.name || 'bone' };
      const t = b.position;
      if (t.x || t.y || t.z) node.translation = [t.x, t.y, t.z];
      const kids = b.children.filter((child) => boneNode.has(child));
      if (kids.length) node.children = kids.map((child) => boneNode.get(child));
      nodes.push(node);
    }
    sceneNodes.push(1);   // the root bone; the rest hang off it

    // Inverse bind matrices, column-major, exactly as three stores them.
    const ibm = new Float32Array(bones.length * 16);
    skeleton.boneInverses.forEach((m, i) => ibm.set(m.elements, i * 16));
    skins.push({
      joints: bones.map((_, i) => i + 1),
      skeleton: 1,
      inverseBindMatrices: accessor(ibm, FLOAT, bones.length, 'MAT4'),
    });
  }

  // --- animation -----------------------------------------------------------
  const animations = [];
  if (rigged && clips.length) {
    // Tracks inside one clip share a single times array by identity, so one
    // input accessor serves the whole clip rather than one per channel.
    const timeAccessor = new Map();
    const nodeOf = new Map(bones.map((b, i) => [b.name, i + 1]));

    for (const clip of clips) {
      const samplers = [];
      const channels = [];

      for (const track of clip.tracks) {
        const node = nodeOf.get(track.bone);
        if (node === undefined) continue;   // a track for a bone we did not write

        if (!timeAccessor.has(track.times)) {
          const t = new Float32Array(track.times);
          // Animation input accessors MUST carry min/max. Loaders that trust
          // the spec use them to size the clip, and reject the file without.
          timeAccessor.set(track.times, accessor(t, FLOAT, t.length, 'SCALAR', undefined, bounds(t, 1)));
        }

        const rotation = track.path === 'rotation';
        const stride = rotation ? 4 : 3;
        const values = new Float32Array(track.values);
        samplers.push({
          input: timeAccessor.get(track.times),
          output: accessor(values, FLOAT, values.length / stride, rotation ? 'VEC4' : 'VEC3'),
          interpolation: 'LINEAR',
        });
        channels.push({ sampler: samplers.length - 1, target: { node, path: track.path } });
      }

      if (channels.length) animations.push({ name: clip.id, samplers, channels });
    }
  }

  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: sceneNodes }],
    nodes,
    meshes: [{
      name,
      primitives: [{
        attributes,
        ...(indicesAccessor !== undefined ? { indices: indicesAccessor } : {}),
        material: 0,
      }],
    }],
    // One material. The vertex colours carry everything, and the game replaces
    // the material with its own toon one on load anyway.
    materials: [{
      name: 'girl',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    }],
    ...(skins.length ? { skins } : {}),
    ...(animations.length ? { animations } : {}),
    bufferViews,
    accessors,
    buffers: [{ byteLength: offset }],
  };

  // --- assemble ------------------------------------------------------------
  const binLength = pad4(offset);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = pad4(jsonBytes.length);

  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, 2, true);          // glTF version
  dv.setUint32(8, total, true);

  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  // JSON pads with SPACES, not zeros - a zero here makes strict parsers reject
  // the file, and the padding is inside the chunk's declared length.
  for (let i = 20 + jsonBytes.length; i < 20 + jsonLength; i++) out[i] = 0x20;

  const binStart = 20 + jsonLength;
  dv.setUint32(binStart, binLength, true);
  dv.setUint32(binStart + 4, BIN_CHUNK, true);

  let cursor = binStart + 8;
  for (const piece of bin) {
    if (piece.pad) { cursor += piece.pad; continue; }   // already zeroed
    out.set(new Uint8Array(piece.data.buffer, piece.data.byteOffset, piece.data.byteLength), cursor);
    cursor += piece.data.byteLength;
  }

  return new Blob([out], { type: 'model/gltf-binary' });
}

/**
 * Hand a blob to the browser as a download.
 *
 * Works on localhost and from a file:// page. It does NOT work inside a
 * published artifact - that sandbox blocks page-initiated downloads, which is
 * why this page is served locally rather than published.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
