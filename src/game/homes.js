// The village homes as meshes: one merged, vertex-coloured toon mesh per house
// (one draw call each), built from boxes, panels and one sloped prism in the
// same way the fingerpost in decoration.js is. Layout and colours are in
// homesLayout.js.
//
// Lead 2026-10-09: Chapter 3 is the space-age town, so the cottages are modern
// homes now: a flat roof or a gently sloped (shed) roof, big front windows, a
// row of solar panels on the roof, a small garden with a porch canopy in front,
// and bright colours. Footprints, doors and colliders did not change.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';
import { HOMES, HOME_DEPTH, HOME_WALL_H, homeWidth, homeHalf } from './homesLayout.js';

const EAVE = 0.2;        // roof overhang past the walls, each side
const SLAB_T = 0.32;     // flat roof slab thickness
const SHED_HI = 0.75;    // shed roof: height above the walls at the back ...
const SHED_LO = 0.2;     // ... and at the front, where the rain runs off
const PANEL_W = 0.7;     // one solar panel: across, along, and its pitch
const PANEL_L = 1.1;
const PANEL_TILT = 0.2;
const CONCRETE = 0xdfe6ee;
const GLASS = 0x9fdcff;
const WHITE = 0xffffff;
const SOLAR = 0x2c4f86;
const VENT = 0x5c6670;
const LEAF = 0x3fa34d;
const PLANTER = 0xc98e5a;

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

/**
 * Geometry for one home, in local space: origin at the centre of the footprint,
 * front (the door side) is +z, the walls stand on y = 0.
 */
function homeGeometry(h) {
  const w = homeWidth(h);
  const d = HOME_DEPTH;
  const H = HOME_WALL_H;
  const frontZ = d / 2;
  const doorX = w / 2 - 0.85;
  const parts = [];
  const box = (bw, bh, bd, x, y, z, hex, tiltX = 0) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    if (tiltX) g.rotateX(tiltX);
    g.translate(x, y, z);
    parts.push(paint(g, hex));
  };

  // Pale concrete plinth, white walls.
  box(w + 0.2, 0.3, d + 0.2, 0, 0.15, 0, CONCRETE);
  box(w, H - 0.3, d, 0, 0.3 + (H - 0.3) / 2, 0, h.wall);

  // The roof. Its height at a given house z, for the solar panels and the vent.
  const zb = -(d / 2 + EAVE);
  const zf = d / 2 + EAVE;
  const hb = H + SHED_HI;
  const hf = H + SHED_LO;
  let roofY;
  if (h.roofShape === 'shed') {
    // A sloping prism across the house (z, y), extruded along x. The shape's x
    // is -z, because rotateY(PI/2) below turns shape-x into house -z.
    const shape = new THREE.Shape();
    shape.moveTo(-zb, H - 0.05);
    shape.lineTo(-zf, H - 0.05);
    shape.lineTo(-zf, hf);
    shape.lineTo(-zb, hb);
    shape.closePath();
    const len = w + EAVE * 2;
    const roof = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
    roof.rotateY(Math.PI / 2);
    roof.translate(-len / 2, 0, 0);
    parts.push(paint(roof, h.roof));
    // A white fascia along the low edge, so the slope has a clean line.
    box(len, 0.16, 0.1, 0, hf - 0.1, zf + 0.02, WHITE);
    roofY = (z) => hf + (hb - hf) * ((zf - z) / (zf - zb));
  } else {
    // A flat roof: a slab a little wider than the walls, in the home's roof colour.
    box(w + EAVE * 2, SLAB_T, d + EAVE * 2, 0, H - 0.05 + SLAB_T / 2, 0, h.roof);
    const top = H - 0.05 + SLAB_T;
    roofY = () => top;
  }
  const tilt = h.roofShape === 'shed' ? Math.atan2(hb - hf, zf - zb) : PANEL_TILT;
  // A panel on the shed slope lies in the roof's plane, so it needs only a
  // thin lift. A tilted flat-roof panel also has its low corner to clear.
  const lift = h.roofShape === 'shed' ? 0.03 : 0.03 + (PANEL_L / 2) * Math.sin(PANEL_TILT);

  // Roof vent (the old chimney, now a flat metal flue) at the back left.
  const vx = -w / 2 + 0.6;
  const vz = -1.0;
  if (h.chimney) box(0.42, 0.5, 0.42, vx, roofY(vz) + 0.25, vz, VENT);

  // Solar panels in rows on the roof, sitting on its surface. A flat roof
  // tilts them a little toward the sun in front; the shed roof has its own slope.
  const nx = Math.max(1, Math.floor((w - 0.3) / (PANEL_W + 0.15)));
  const pitch = PANEL_W + 0.15;
  const rowZ = h.roofShape === 'shed' ? [zb + 0.9, zb + 2.9] : [-0.85, 0.85];
  for (const z of rowZ) {
    for (let i = 0; i < nx; i++) {
      const x = (i - (nx - 1) / 2) * pitch;
      if (h.chimney && Math.abs(x - vx) < 0.6 && Math.abs(z - vz) < 0.8) continue;
      box(PANEL_W, 0.05, PANEL_L, x, roofY(z) + lift, z, SOLAR, tilt);
    }
  }

  // Front: a big window per room, each a white frame with a pane of glass.
  for (let i = 0; i < h.windows; i++) {
    const wx = -w / 2 + 0.85 + i * 0.9;
    box(0.84, 1.3, 0.05, wx, 1.5, frontZ + 0.01, WHITE);
    box(0.76, 1.22, 0.06, wx, 1.5, frontZ + 0.04, GLASS);
  }
  // The door at the right end, with a glass panel high up in it.
  box(0.92, 1.55, 0.1, doorX, 0.3 + 0.775, frontZ + 0.04, h.door);
  box(0.6, 0.4, 0.12, doorX, 1.5, frontZ + 0.08, GLASS);
  box(0.06, 0.32, 0.06, doorX + 0.3, 1.0, frontZ + 0.13, 0xcfd8e3);
  // A porch canopy over the door, in the roof colour, and the step below it.
  box(1.5, 0.1, 0.9, doorX, 2.02, frontZ + 0.45, h.roof);
  box(1.3, 0.14, 0.6, doorX, 0.07, frontZ + 0.4, CONCRETE);

  // Glass end walls, so the sides are not blank slabs.
  for (const sx of [-1, 1]) {
    box(0.06, 1.2, 0.84, sx * (w / 2 + 0.02), 1.5, 0, GLASS);
  }

  // A small front garden: a planter with two round shrubs at the left corner,
  // one shrub at the right. Planters are low and sink into the grass.
  const planter = (px, pz) => box(0.55, 0.5, 0.55, px, 0, pz, PLANTER);
  const shrub = (sx, sy, sz) => {
    const g = new THREE.IcosahedronGeometry(0.4, 0);
    g.translate(sx, sy, sz);
    parts.push(paint(g, LEAF));
  };
  planter(-w / 2 + 0.4, frontZ + 0.7);
  shrub(-w / 2 + 0.3, 0.55, frontZ + 0.7);
  shrub(-w / 2 + 0.6, 0.45, frontZ + 0.95);
  shrub(w / 2 + 0.35, 0.4, frontZ + 0.5);

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Does a circle or box solid overlap the home's footprint (padded)? */
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
    const mesh = new THREE.Mesh(homeGeometry(h), material);
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
