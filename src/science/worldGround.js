// Chapter 1 ground: grass, dirt roads, the purple Science Center foundation,
// the iron room's darker yard and the gate's dirt doorstep.
//
// Same method as src/city/worldGround.js (copied, since that one reads
// Chapter 2's layout): ONE smooth vertex-coloured mesh over the 32 x 32 map at
// 4 sub-cells per tile, each vertex averaging the four sub-cells around it so
// road edges soften over a quarter tile. The colours feed addGroundDetail()
// (grass blades, dirt grit) from the toon pipeline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, addGroundDetail } from '../game/toonPipeline.js';
import { MAP_W, MAP_H, TILE } from './contracts.js';
import { isRoad, isFoundation, IRON_ROOM, KEY_GATE } from './layout.js';

export const GROUND = {
  grass: 0x6db85a,
  grassDry: 0x7cc062,
  road: 0xc4a066,
  yard: 0x8a9a5a,      // the iron room: trampled, drier
  yardDoor: 0xc4a066,
  foundation: 0x9775fa,
};

const S = 4; // sub-cells per tile

function kindAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'grass';
  if (isFoundation(tx, ty)) return 'foundation';
  if (tx === KEY_GATE.tx && ty === KEY_GATE.ty) return 'road';
  const r = IRON_ROOM;
  if (tx >= r.tx0 && tx <= r.tx1 && ty >= r.ty0 && ty <= r.ty1) return 'yard';
  if (isRoad(tx, ty)) return 'road';
  return 'grass';
}

function subcell(i, j) {
  const tx = Math.floor(i / S), ty = Math.floor(j / S);
  const kind = kindAt(tx, ty);
  const c = new THREE.Color();
  if (kind === 'foundation') c.setHex(GROUND.foundation);
  else if (kind === 'road') c.setHex(GROUND.road);
  else if (kind === 'yard') {
    const n = 0.5 + 0.5 * Math.sin(i * 0.5) * Math.sin(j * 0.43 + 1);
    c.setHex(GROUND.yard).lerp(new THREE.Color(0x7a8a4e), n * 0.5);
  } else {
    const n = 0.5 + 0.5 * Math.sin(i * 0.11 + 1.3) * Math.sin(j * 0.09 - 0.4);
    c.setHex(GROUND.grass).lerp(new THREE.Color(GROUND.grassDry), n * 0.55);
  }
  return { c };
}

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
    colors[v * 3] = (a.c.r + b.c.r + c.c.r + d.c.r) / 4;
    colors[v * 3 + 1] = (a.c.g + b.c.g + c.c.g + d.c.g) / 4;
    colors[v * 3 + 2] = (a.c.b + b.c.b + c.c.b + d.c.b) / 4;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });
  addGroundDetail(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'groundMap';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  // Endless grass beyond the map edge: four strips around it.
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
