// The village homes as meshes: one merged, vertex-coloured toon mesh for all
// four cottages (one draw call), built from boxes and a prism roof in the same
// way the fingerpost in decoration.js is. Layout and colours are in
// homesLayout.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';
import { HOMES, HOME_DEPTH, HOME_WALL_H, homeWidth, homeHalf } from './homesLayout.js';

const ROOF_H = 1.25;
const EAVE = 0.35;

function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g !== geo) geo.dispose();
  return g;
}

/** Geometry for one cottage, in local space: origin at the centre of the footprint, front is +z. */
function cottageGeometry(h) {
  const w = homeWidth(h);
  const d = HOME_DEPTH;
  const parts = [];
  const box = (bw, bh, bd, x, y, z, hex) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    g.translate(x, y, z);
    parts.push(paint(g, hex));
  };

  // Stone footing, walls.
  box(w + 0.2, 0.3, d + 0.2, 0, 0.15, 0, 0x8b9199);
  box(w, HOME_WALL_H - 0.3, d, 0, 0.3 + (HOME_WALL_H - 0.3) / 2, 0, h.wall);

  // Pitched roof: a triangle across the house (z, y), extruded along x.
  const shape = new THREE.Shape();
  shape.moveTo(-(d / 2 + EAVE), 0);
  shape.lineTo(d / 2 + EAVE, 0);
  shape.lineTo(0, ROOF_H);
  shape.closePath();
  const roofLen = w + EAVE * 2;
  const roof = new THREE.ExtrudeGeometry(shape, { depth: roofLen, bevelEnabled: false });
  roof.rotateY(Math.PI / 2);                       // shape-x -> house z, extrusion -> house x
  roof.translate(-roofLen / 2, HOME_WALL_H, 0);
  parts.push(paint(roof, h.roof));
  // A darker ridge cap and eave board so the roof reads as a roof from above.
  box(roofLen, 0.09, 0.16, 0, HOME_WALL_H + ROOF_H + 0.02, 0, 0x4a3320);

  if (h.chimney) box(0.5, 1.1, 0.5, -w / 2 + 0.8, HOME_WALL_H + 0.75, -0.35, 0x8a6a55);

  // Front: windows from the left, the door at the right end.
  const frontZ = d / 2;
  const doorX = w / 2 - 0.85;
  for (let i = 0; i < h.windows; i++) {
    const wx = -w / 2 + 0.85 + i * 0.9;
    box(0.66, 0.66, 0.08, wx, 1.35, frontZ + 0.02, 0xffffff);          // frame
    box(0.5, 0.5, 0.1, wx, 1.35, frontZ + 0.03, 0x4a78b5);             // glass
    box(0.5, 0.06, 0.11, wx, 1.35, frontZ + 0.035, 0xffffff);          // cross bar
    box(0.06, 0.5, 0.11, wx, 1.35, frontZ + 0.035, 0xffffff);
  }
  box(0.95, 1.5, 0.1, doorX, 0.3 + 0.75, frontZ + 0.03, h.door);
  box(0.09, 0.09, 0.05, doorX + 0.32, 1.05, frontZ + 0.1, 0xf2d06b);   // knob
  box(1.3, 0.14, 0.6, doorX, 0.07, frontZ + 0.4, 0xa8a49b);            // step
  // One small window on each end wall, so the side is not a blank slab.
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.08, 0.5, 0.5);
    g.translate(sx * (w / 2 + 0.02), 1.35, 0);
    parts.push(paint(g, 0x4a78b5));
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Does a circle or box solid overlap the cottage's footprint (padded)? */
function clashes(h, s, pad = 0.4) {
  const { halfX, halfZ } = homeHalf(h);
  const cx = Math.max(h.x - halfX - pad, Math.min(s.x, h.x + halfX + pad));
  const cz = Math.max(h.z - halfZ - pad, Math.min(s.z, h.z + halfZ + pad));
  const reach = s.radius !== undefined ? s.radius : Math.min(s.halfX, s.halfZ);
  return Math.hypot(s.x - cx, s.z - cz) < reach;
}

/**
 * @param {THREE.Object3D} parent
 * @param {{ heightAt: (x:number,z:number)=>number, isWalkable?: (x:number,z:number)=>boolean, existingSolids?: object[] }} deps
 * @returns {{ group: THREE.Group, solids: object[], warnings: string[] }}
 */
export function buildHomes(parent, { heightAt, isWalkable = () => true, existingSolids = [] }) {
  const group = new THREE.Group();
  group.name = 'homes';
  const material = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });
  const solids = [];
  const warnings = [];
  for (const h of HOMES) {
    const mesh = new THREE.Mesh(cottageGeometry(h), material);
    mesh.name = h.id;
    // Sit on the highest ground under the footprint so no corner floats.
    const { halfX, halfZ } = homeHalf(h);
    let base = -Infinity;
    for (const dx of [-halfX, 0, halfX]) for (const dz of [-halfZ, 0, halfZ]) base = Math.max(base, heightAt(h.x + dx, h.z + dz));
    mesh.position.set(h.x, base, h.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    solids.push({ x: h.x, z: h.z, halfX: halfX - 0.08, halfZ: halfZ - 0.08, rotation: 0 });

    for (const s of existingSolids) {
      if (clashes(h, s)) { warnings.push(`${h.id} overlaps a solid at ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`); break; }
    }
    if (![[-halfX, -halfZ], [halfX, -halfZ], [-halfX, halfZ], [halfX, halfZ]].every(([dx, dz]) => isWalkable(h.x + dx, h.z + dz))) {
      warnings.push(`${h.id} stands on ground she cannot walk on`);
    }
  }
  parent.add(group);
  return { group, solids, warnings };
}
