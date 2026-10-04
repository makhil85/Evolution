// Chapter 2 ground: grass, dirt roads, the paved island and the moat.
//
// ONE smooth vertex-coloured mesh over the 34 x 30 map (like Chapter 3's
// board), sampled at 4 sub-cells per tile. Each vertex averages the four
// sub-cells around it, so a road edge softens over a quarter tile and the moat
// bank slopes down into the water instead of stepping. The colours feed
// addGroundDetail() (grass blades, dirt grit, paving joints) from the pipeline.
//
// The moat is a second mesh with its own banded, animated shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, addGroundDetail } from '../game/toonPipeline.js';
import { MAP_W, MAP_H, TILE } from './contracts.js';
import { isRoad, isRiver } from './layout.js';

/** The island's walkable floor: the foundation minus its west column, which is moat. */
export function isIslandLand(tx, ty) { return tx >= 29 && tx <= 31 && ty >= 15 && ty <= 18; }

/** Moat water: every old river tile except the island. */
export function isWaterTile(tx, ty) { return isRiver(tx, ty) && !isIslandLand(tx, ty); }

export const GROUND = {
  grass: 0x6db85a,
  grassDry: 0x7cc062,
  road: 0xc4a066,
  bed: 0xcdb98a,
  paving: 0xb4b9c2,
};
export const WATER_Y = -0.22;
const BED_Y = -0.7;

const S = 4; // sub-cells per tile

function kindAt(tx, ty) {
  // Outside the map the ground just continues as grass.
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'grass';
  if (isWaterTile(tx, ty)) return 'water';
  if (isIslandLand(tx, ty)) return 'island';
  if (isRoad(tx, ty)) return 'road';
  return 'grass';
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Per sub-cell colour and height. */
function subcell(i, j) {
  const tx = Math.floor(i / S), ty = Math.floor(j / S);
  const kind = kindAt(tx, ty);
  const c = new THREE.Color();
  let h = 0;
  if (kind === 'water') { c.setHex(GROUND.bed); h = BED_Y; }
  else if (kind === 'island') c.setHex(GROUND.paving);
  else if (kind === 'road') c.setHex(GROUND.road);
  else {
    // Broad meadow patches: two greens drifting across the map.
    const n = 0.5 + 0.5 * Math.sin(i * 0.11 + 1.3) * Math.sin(j * 0.09 - 0.4);
    c.setHex(GROUND.grass).lerp(new THREE.Color(GROUND.grassDry), n * 0.55);
  }
  return { c, h, water: kind === 'water' ? 1 : 0 };
}

/**
 * Build the ground. Returns the mesh group and a per-vertex water fraction
 * function's data is not needed by callers, so only the group comes back.
 */
export function buildGround() {
  const group = new THREE.Group();
  group.name = 'ground';

  const W = MAP_W * S, H = MAP_H * S;
  const cells = new Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) cells[j * W + i] = subcell(i, j);
  const cell = (i, j) => cells[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];

  const geo = new THREE.PlaneGeometry(MAP_W * TILE, MAP_H * TILE, W, H);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const i = v % (W + 1);
    const j = Math.floor(v / (W + 1));
    const a = cell(i - 1, j - 1), b = cell(i, j - 1), c = cell(i - 1, j), d = cell(i, j);
    const r = (a.c.r + b.c.r + c.c.r + d.c.r) / 4;
    const g = (a.c.g + b.c.g + c.c.g + d.c.g) / 4;
    const bl = (a.c.b + b.c.b + c.c.b + d.c.b) / 4;
    colors[v * 3] = r; colors[v * 3 + 1] = g; colors[v * 3 + 2] = bl;
    pos.setY(v, (a.h + b.h + c.h + d.h) / 4);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });
  addGroundDetail(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'groundMap';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  // Endless grass beyond the map edge: four strips around it (a single big
  // plane would poke through the sunken moat bed).
  const R = 260;
  const w = MAP_W * TILE, h = MAP_H * TILE;
  const strip = (sx, sz, cx, cz) => {
    const g = new THREE.PlaneGeometry(sx, sz);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    g.deleteAttribute('uv');
    const col = new Float32Array(g.attributes.position.count * 3);
    const gc = new THREE.Color(GROUND.grass);
    for (let k = 0; k < g.attributes.position.count; k++) { col[k * 3] = gc.r; col[k * 3 + 1] = gc.g; col[k * 3 + 2] = gc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const outer = mergeGeometries([
    strip(w + 2 * R, R, 0, -h / 2 - R / 2),
    strip(w + 2 * R, R, 0, h / 2 + R / 2),
    strip(R, h, -w / 2 - R / 2, 0),
    strip(R, h, w / 2 + R / 2, 0),
  ], false);
  const outerMesh = new THREE.Mesh(outer, mat);
  outerMesh.name = 'groundOuter';
  outerMesh.receiveShadow = true;
  outerMesh.frustumCulled = false;
  group.add(outerMesh);

  return group;
}

// ---------------------------------------------------------------------------
// Moat water
// ---------------------------------------------------------------------------

const waterVertex = /* glsl */`
  uniform float uTime;
  attribute float aInside;
  varying float vInside;
  varying vec3 vWorld;
  void main() {
    vInside = aInside;
    vec3 p = position;
    // Only the middle of the moat swells; the rim stays put against the bank.
    float w = sin(p.x * 0.9 + uTime * 1.4) * 0.03 + sin(p.z * 1.1 - uTime * 1.1) * 0.025;
    p.y += w * smoothstep(0.5, 1.0, aInside);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragment = /* glsl */`
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying float vInside;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 w = vWorld.xz;
    // Banded depth: shallow rim, deeper middle, three flat steps (toon).
    float d = smoothstep(0.5, 1.0, vInside) + (noise(w * 0.6 + uTime * 0.15) - 0.5) * 0.18;
    d = floor(clamp(d, 0.0, 0.999) * 3.0) / 3.0;
    vec3 col = mix(uShallow, uDeep, d * 1.1);

    // Bright wave streaks drifting across.
    float s = sin((w.x * 1.3 + w.y * 0.7) + uTime * 1.5 + noise(w * 1.8) * 5.0);
    col += smoothstep(0.82, 1.0, s) * vec3(0.16, 0.20, 0.22);
    // Sparkles.
    float sp = step(0.93, noise(w * 3.2 + vec2(uTime * 0.6, -uTime * 0.4)));
    col += sp * vec3(0.5);

    // Foam along the banks, breathing in and out.
    float wash = 0.62 + sin(w.x * 0.8 + w.y * 0.6 - uTime * 1.2) * 0.06 + noise(w * 2.0 + uTime * 0.3) * 0.12;
    float foam = 1.0 - smoothstep(wash - 0.08, wash + 0.04, vInside);
    col = mix(col, uFoam, foam * 0.9);

    gl_FragColor = vec4(col, 0.93);
    #include <colorspace_fragment>
  }
`;

/** The moat surface. `update(t)` drives the animation. */
export function buildWater() {
  const positions = [];
  const inside = [];
  const indices = [];
  let vi = 0;

  const W = MAP_W * S, H = MAP_H * S;
  const isW = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : (kindAt(Math.floor(i / S), Math.floor(j / S)) === 'water' ? 1 : 0);
  const fx = (i) => (i / S - MAP_W / 2) * TILE;
  const fz = (j) => (j / S - MAP_H / 2) * TILE;
  // A vertex is "inside" by the share of water sub-cells around it.
  const vin = (i, j) => (isW(i - 1, j - 1) + isW(i, j - 1) + isW(i - 1, j) + isW(i, j)) / 4;

  const vertexIndex = new Map();
  const vertex = (i, j) => {
    const key = j * (W + 1) + i;
    let idx = vertexIndex.get(key);
    if (idx === undefined) {
      idx = vi++;
      vertexIndex.set(key, idx);
      positions.push(fx(i), WATER_Y, fz(j));
      inside.push(vin(i, j));
    }
    return idx;
  };

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!isW(i, j)) continue;
      const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aInside', new THREE.Float32BufferAttribute(inside, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1971c2) },
      uShallow: { value: new THREE.Color(0x4dabf7) },
      uFoam: { value: new THREE.Color(0xe7f5ff) },
    },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'moatWater';
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return { mesh, update(t) { mat.uniforms.uTime.value = t; } };
}
