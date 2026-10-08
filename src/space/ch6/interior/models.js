// Chapter 6 interior: the sci-fi model kits (lead 2026-10-08: real models for
// the decks, like the villages' Kenney / Quaternius pieces, mixed with our own
// code-built parts). Both kits are CC0, imported by scripts/import-scifi.py
// into public/assets/models/scifi/:
//   megakit/<set>/<Name>.gltf   Quaternius Modular SciFi MegaKit: walls, platforms
//                               (floors, doors, stairs, rails, windows), columns, props, decals
//   kenney/<name>.glb           Kenney Space Kit (none kept now: the decks build their own desks and chairs)
//
//   const lib = await loadModels(['walls/WallAstra_Straight', 'props/Prop_Computer', ...]);
//   lib.size('walls/WallAstra_Straight')        -> THREE.Vector3 (metres, as modelled)
//   lib.add(batch, name, x, y, z, ry, scale)    merge into a kit batch (static, few draw calls)
//   lib.object(name)                            a fresh Object3D (for parts that move)
//   lib.style                                   'toon' (default) or 'pbr' (?models=pbr in the lab)
//
// Look: the kits ship PBR trim sheets (colour, normal, roughness). In 'toon'
// they become MeshToonMaterial with the colour and normal maps (the game's
// cel look, the normal map keeps the panel detail); in 'pbr' MeshStandard with
// the same maps, lit by a small baked room environment. One material per
// source material name, shared by every piece, so batches merge across pieces.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { asset } from '../../../game/contracts.js';
import { toonRamp } from '../../../game/toonPipeline.js';

const ROOT = 'assets/models/scifi/';
const pathOf = (name) => (name.startsWith('kenney/') ? `${ROOT}${name}.glb` : `${ROOT}megakit/${name}.gltf`);

/**
 * Load the named pieces (each once; repeat calls share the cache).
 * @param {string[]} names e.g. 'walls/WallAstra_Straight', 'props/Prop_Computer'
 * @param {{ style?: 'toon'|'pbr' }} [opts]
 */
export async function loadModels(names, { style = 'toon' } = {}) {
  const loader = new GLTFLoader();
  const mats = new Map();     // source material name -> our material
  const pieces = new Map();   // name -> { parts: [{ geometry, material }], size }
  const owned = [];
  const matFor = (src) => {
    const key = `${src.name || src.uuid}|${src.map?.image?.src || src.color?.getHexString?.() || ''}`;
    if (mats.has(key)) return mats.get(key);
    let m;
    const common = {
      color: src.color ? src.color.clone() : new THREE.Color(0xffffff), map: src.map || null, normalMap: src.normalMap || null,
      emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0), emissiveMap: src.emissiveMap || null,
      emissiveIntensity: src.emissiveIntensity ?? 1, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side,
    };
    if (common.map) common.map.colorSpace = THREE.SRGBColorSpace;
    if (style === 'pbr') m = new THREE.MeshStandardMaterial({ ...common, roughness: src.roughness ?? 0.6, metalness: src.metalness ?? 0.2 });
    else m = new THREE.MeshToonMaterial({ ...common, gradientMap: toonRamp });
    if (common.normalMap) m.normalScale = src.normalScale ? src.normalScale.clone() : new THREE.Vector2(1, 1);
    m.name = src.name;
    mats.set(key, m);
    owned.push(m);
    return m;
  };
  await Promise.all(names.map(async (name) => {
    if (pieces.has(name)) return;
    const gltf = await loader.loadAsync(asset(pathOf(name)));
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const parts = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      owned.push(g);
      const list = Array.isArray(o.material) ? o.material : [o.material];
      if (list.length === 1 || !g.groups.length) parts.push({ geometry: g, material: matFor(list[0]) });
      else {
        // Several materials on one mesh: split it by group so each part merges with its own kind.
        for (const grp of g.groups) {
          const sub = g.index ? g.toNonIndexed() : g.clone();
          const keep = new THREE.BufferGeometry();
          for (const [k, a] of Object.entries(sub.attributes)) {
            keep.setAttribute(k, new THREE.BufferAttribute(a.array.slice(grp.start * a.itemSize, (grp.start + grp.count) * a.itemSize), a.itemSize));
          }
          sub.dispose();
          owned.push(keep);
          parts.push({ geometry: keep, material: matFor(list[grp.materialIndex]) });
        }
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    pieces.set(name, { parts, size: box.getSize(new THREE.Vector3()), min: box.min.clone() });
  }));
  const get = (name) => {
    const p = pieces.get(name);
    if (!p) throw new Error(`[models] ${name} was not loaded`);
    return p;
  };
  return {
    style,
    names: () => [...pieces.keys()],
    size: (name) => get(name).size.clone(),
    /** The piece's lowest corner as modelled (for lining pieces up). */
    min: (name) => get(name).min.clone(),
    /** Merge a piece into a kit batch at (x, y, z), turned ry, scaled s. */
    add(batch, name, x = 0, y = 0, z = 0, ry = 0, s = 1) {
      for (const { geometry, material } of get(name).parts) {
        const g = geometry.clone();
        if (s !== 1) g.scale(s, s, s);
        batch.add(g, material, x, y, z, ry);
      }
    },
    /** A separate Object3D of the piece (shares geometry and materials). */
    object(name) {
      const grp = new THREE.Group();
      for (const { geometry, material } of get(name).parts) grp.add(new THREE.Mesh(geometry, material));
      return grp;
    },
    dispose() { for (const x of owned) x.dispose?.(); for (const m of mats.values()) { m.map?.dispose?.(); m.normalMap?.dispose?.(); m.emissiveMap?.dispose?.(); } },
  };
}

/** Every piece the import brought in (for the lab's contact sheet). */
export const MODEL_SETS = Object.freeze({
  walls: 'walls', platforms: 'platforms', columns: 'columns', props: 'props', decals: 'decals',
});
