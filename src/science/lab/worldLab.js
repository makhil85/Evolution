// Science lab: builds the Chapter 1 world with an orbit camera, for review.
//
//   science-lab.html?built=all|none&level=1|4&view=<preset>&labels=0
//
// window.scienceShot(name)   render + save docs/progress/<name>.png via /__shot
// window.scienceView(name)   jump to a camera preset ('overview', 'square', ...)
// window.scienceCam(pos, target)   free camera
// window.scienceWorld        the world API, for poking at from the console
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildScienceWorld } from '../world.js';
import { SCIENCE_CENTER_PIECES, tileToWorld } from '../contracts.js';
import { PICKUPS, STATIONS } from '../layout.js';

const params = new URLSearchParams(location.search);
const LEVEL = params.get('level') === '1' ? 1 : 4;
const BUILT = params.get('built') || 'none';
const W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);
const hud = document.getElementById('hud');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

const world = await buildScienceWorld({ scene, level: LEVEL, renderer, shadowExtent: 60, shadowMapSize: 4096 });
window.scienceWorld = world;

// A stand-in for the girl, 1.5 units tall, so scale reads in the shots.
const girl = new THREE.Group();
{
  const mat = new THREE.MeshToonMaterial({ color: 0xf6f0ff });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.75, 10), mat);
  body.position.y = 0.95;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), new THREE.MeshToonMaterial({ color: 0x2b3a67 }));
  legs.position.y = 0.3;
  legs.scale.x = 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), new THREE.MeshToonMaterial({ color: 0xffd9bf }));
  head.position.y = 1.5 - 0.22;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshToonMaterial({ color: 0x3b2418 }));
  hair.position.y = 1.5 - 0.2;
  girl.add(body, legs, head, hair);
  girl.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const s = tileToWorld(7, 20);
  girl.position.set(s.x, 0, s.z);
  girl.rotation.y = Math.PI / 2;
  girl.visible = false;
  scene.add(girl);
}

// --- what is built ----------------------------------------------------------------
function applyBuilt() {
  const all = BUILT === 'all';
  world.setBuilt(all ? SCIENCE_CENTER_PIECES : (Number.isFinite(Number(BUILT)) && BUILT !== 'none' ? Number(BUILT) : 0));
  for (const s of STATIONS) world.setStationSolved(s.quest, all);
  world.setGateOpen(all);
  if (all) for (const p of PICKUPS) if (p.id % 3 === 0) world.setCollected(p.id);
}
applyBuilt();
if (params.get('labels') === '0') world.setLabelsVisible(false);

// --- camera presets ------------------------------------------------------------------
const tw = (tx, ty) => tileToWorld(tx, ty);
const PRESETS = {
  overview: () => ({ pos: [0, 100, 78], target: [0, 0, 2] }),
  square: () => { const a = tw(9, 20); return { pos: [a.x - 2, 9, a.z + 13], target: [a.x, 0.5, a.z - 3] }; },
  gate: () => { const a = tw(24, 12); return { pos: [a.x - 3, 8, a.z + 15], target: [a.x, 0.5, a.z - 2] }; },
  room: () => { const a = tw(24, 9); return { pos: [a.x - 4, 15, a.z + 13], target: [a.x, 0, a.z] }; },
  center: () => { const a = tw(17, 27); return { pos: [a.x - 8, 9, a.z - 14], target: [a.x, 2.4, a.z] }; },
  centerBack: () => { const a = tw(17, 27); return { pos: [a.x + 11, 8, a.z + 11], target: [a.x, 2.6, a.z] }; },
  town: () => { const a = tw(13, 19); return { pos: [a.x - 10, 12, a.z + 14], target: [a.x + 1, 0, a.z - 3] }; },
  east: () => { const a = tw(22, 20); return { pos: [a.x - 8, 10, a.z + 13], target: [a.x + 1, 0, a.z - 2] }; },
  // Third-person eye height: behind the 1.5-unit girl at the start tile, looking east down the road.
  eye: () => { const g = tw(7, 20); return { pos: [g.x - 5.2, 2.8, g.z - 0.4], target: [g.x + 3, 1.3, g.z], girl: true }; },
};
function view(name) {
  const f = PRESETS[name];
  if (!f) return false;
  const v = f();
  camera.position.set(...v.pos);
  controls.target.set(...v.target);
  camera.updateProjectionMatrix();
  controls.update();
  girl.visible = !!v.girl;
  return true;
}
window.scienceView = view;
view(PRESETS[params.get('view')] ? params.get('view') : 'square');

// --- render loop -------------------------------------------------------------------------
let time = 0;
let last = performance.now();
let frames = 0, acc = 0, fps = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const target = girl.visible ? { x: girl.position.x, z: girl.position.z } : { x: controls.target.x, z: controls.target.z };
  world.update(dt, time, target, camera.position);
  controls.update();
  renderer.render(scene, camera);
  acc += dt; frames++;
  if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  const info = renderer.info;
  hud.textContent = `science lab  level ${LEVEL}  built=${BUILT}\nfps ${fps.toFixed(0)}  calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k\nview: ${Object.keys(PRESETS).join(' | ')}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** Render once at a fixed time and save the canvas through the dev server. */
window.scienceShot = async function scienceShot(name = 'sci_shot') {
  world.update(0.016, time, { x: controls.target.x, z: controls.target.z }, camera.position);
  renderer.render(scene, camera);
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: renderer.domElement.toDataURL('image/png') });
  return res.text();
};
window.scienceStats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fps, world: world.stats() });
/** Free camera: scienceCam([x, y, z], [tx, ty, tz]). */
window.scienceCam = (pos, target) => {
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
};
