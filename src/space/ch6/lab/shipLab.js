// Lab only (ship-lab.html): Chapter 6's ship for the stars, outside and in,
// rendered the way chapter6.html renders (ACES tone mapping, the same bloom),
// so a screenshot here is what the child sees.
//
//   ?view=interior&deck=bridge   walk a deck: the real interior scene (ship.js)
//   ?view=ship[&detail=far]      the starship model (starship.js), drag to orbit
//   ?view=crew                   the crew and robots in a row
//   ?view=models&set=walls[&style=pbr][&page=0]   a contact sheet of a model kit
//                                (walls | platforms | columns | props | decals | kenney),
//                                24 pieces a page with their names and sizes
//
// window.__shipLab:
//   ready            true once the first frame is drawn
//   view, scene      what is shown; debug = the interior's test hook
//   ship             the starship handle (view=ship): setDrive(k), setField(k), ...
//   cam(name)        a set point: interior -> the deck's views[].name;
//                    ship -> 'front34' | 'side' | 'rear' | 'top' | 'cap' | 'ring';
//                    crew -> 'row' | 'close'
//   frames(n, dt)    run n frames now (headless rAF is slow)
//   stats()          { mean, blown } of the last frame: mean brightness 0..1
//                    and the share of pixels at full white (issue d: < 0.02)
//   info()           { calls, triangles, lights } of the last frame
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RENDER } from '../../contracts.js';

const params = new URLSearchParams(location.search);
const VIEW = params.get('view') || 'interior';
const info = document.getElementById('labInfo');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
document.body.appendChild(renderer.domElement);
const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
const pass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
composer.addPass(pass);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold));
composer.addPass(new OutputPass());

// --- input, shaped like main.js's (input, mouse) ----------------------------------------
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
const mouse = { dx: 0, dy: 0, wheel: 0, dragging: false };
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; mouse.dragging = true; });
addEventListener('pointerup', () => { drag = null; mouse.dragging = false; });
addEventListener('pointermove', (e) => { if (!drag) return; mouse.dx += e.clientX - drag.x; mouse.dy += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; });
addEventListener('wheel', (e) => { mouse.wheel += e.deltaY; });
const takeMouse = () => { const m = { ...mouse }; mouse.dx = mouse.dy = mouse.wheel = 0; return m; };
const input = () => ({
  thrust: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
  turn: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
  steady: keys.has('Space'),
  precision: false,
});

const toastBox = document.createElement('div');
Object.assign(toastBox.style, { position: 'fixed', left: '50%', top: '12px', transform: 'translateX(-50%)', color: '#fff', background: 'rgba(0,0,0,.6)', padding: '6px 12px', borderRadius: '8px', zIndex: 60, display: 'none' });
document.body.appendChild(toastBox);
const fakeGame = {
  renderer,
  controls: { isDown: (c) => keys.has(c) },
  hud: { toast(text) { toastBox.textContent = text; toastBox.style.display = 'block'; clearTimeout(toastBox.t); toastBox.t = setTimeout(() => { toastBox.style.display = 'none'; }, 3000); } },
};

const lab = { ready: false, view: VIEW };
window.__shipLab = lab;
let tickFn = () => {};
let camPin = null; // { pos, look } for orbit views

// --- the views ------------------------------------------------------------------------
async function setupInterior() {
  const { createInteriorScene, preloadInterior } = await import('../interior/ship.js');
  const models = await preloadInterior({ style: params.get('style') || 'toon' });
  const sc = createInteriorScene(fakeGame, {
    models,
    async onStation(id) { fakeGame.hud.toast(`station ${id} (lab: done)`); },
    startDeck: params.get('deck') || undefined,
  });
  sc.start();
  pass.scene = sc.scene; pass.camera = sc.camera;
  lab.scene = sc.scene; lab.debug = sc.debug; lab.interior = sc;
  lab.cam = (name) => sc.debug.view(name ?? null);
  tickFn = (dt) => sc.tick(dt, input(), takeMouse(), false);
  return sc.camera;
}

function starfield(scene) {
  const n = 2500; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(4000);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));
}

function orbitCamera(camera, center, presets) {
  const o = { yaw: 0.8, pitch: 0.25, dist: presets.dist };
  lab.cam = (name) => { const p = presets[name]; if (!p) return false; Object.assign(o, p); camPin = name; return true; };
  return (dt) => {
    const m = takeMouse();
    o.yaw -= m.dx * 0.006; o.pitch = Math.max(-1.4, Math.min(1.4, o.pitch + m.dy * 0.004));
    if (m.wheel) o.dist *= Math.exp(m.wheel * 0.001);
    const c = typeof center === 'function' ? center() : center;
    camera.position.set(c.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, c.y + Math.sin(o.pitch) * o.dist, c.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    camera.lookAt(o.lookAt ? new THREE.Vector3(...o.lookAt) : c);
    void dt;
  };
}

async function setupShip() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  starfield(scene);
  // Space light: one hard sun, a faint fill (like flight).
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.position.set(-600, 250, -300); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x101018, 0.35));
  const camera = new THREE.PerspectiveCamera(RENDER.fov, innerWidth / innerHeight, 0.5, 20000);
  let mod;
  try { mod = await import('../starship.js'); } catch (err) { info.textContent = `starship.js not loadable yet: ${err.message}`; console.error(err); return camera; }
  const ship = mod.createStarship({ detail: params.get('detail') || 'near' });
  scene.add(ship.group);
  lab.ship = ship; lab.scene = scene;
  const L = ship.dims?.length || 300;
  const ctr = new THREE.Vector3(0, 0, 0);
  // The ship flies towards -Z (cap in front), the drive at +Z.
  const step = orbitCamera(camera, ctr, {
    dist: L * 1.3,
    front34: { yaw: Math.PI + 0.7, pitch: 0.28, dist: L * 1.3, lookAt: null },
    side: { yaw: Math.PI / 2, pitch: 0.05, dist: L * 1.25, lookAt: null },
    rear: { yaw: 0.6, pitch: 0.22, dist: L * 1.2, lookAt: null },
    top: { yaw: Math.PI / 2, pitch: 1.35, dist: L * 1.3, lookAt: null },
    cap: { yaw: Math.PI + 0.5, pitch: 0.2, dist: L * 0.55, lookAt: [0, 0, -L * 0.4] },
    ring: { yaw: Math.PI / 2 + 0.35, pitch: 0.35, dist: L * 0.6, lookAt: null },
  });
  let tt = 0;
  tickFn = (dt) => { tt += dt; ship.update?.(dt, tt); step(dt); };
  return camera;
}

async function setupCrew() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d26);
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x3a3444, 0.9));
  const key = new THREE.DirectionalLight(0xfff1e0, 0.9); key.position.set(3, 6, 5); scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: 0x3c3448 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const { buildCrew } = await import('../crew.js');
  const crew = buildCrew();
  crew.ids.forEach((id, k) => { const c = crew[id]; c.root.position.set((k - (crew.ids.length - 1) / 2) * 1.6, 0, 0); scene.add(c.root); });
  lab.crew = crew; lab.scene = scene;
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 100);
  const step = orbitCamera(camera, new THREE.Vector3(0, 0.8, 0), {
    dist: 6.5, row: { yaw: 0, pitch: 0.12, dist: 6.5 }, close: { yaw: 0.35, pitch: 0.1, dist: 3.2 },
  });
  tickFn = (dt) => { crew.update(dt); step(dt); };
  return camera;
}

async function setupModels() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d26);
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x3a3444, 1.2));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.4); key.position.set(4, 8, 6); scene.add(key);
  const set = params.get('set') || 'walls';
  const page = Number(params.get('page') || 0);
  const man = await (await fetch('assets/models/scifi/manifest.json')).json();
  const names = (man[set] || []).slice(page * 24, page * 24 + 24).map((n) => `${set === 'kenney' ? 'kenney' : set}/${n}`);
  const { loadModels } = await import('../interior/models.js');
  const lib = await loadModels(names, { style: params.get('style') || 'toon' });
  const COLS = 6; const GAP = 5.5;
  names.forEach((n, i) => {
    const o = lib.object(n);
    const sz = lib.size(n); const mn = lib.min(n);
    const k = 3.2 / Math.max(1, sz.x, sz.y, sz.z); // big pieces shrunk to fit their cell
    o.scale.setScalar(k);
    const cx = (i % COLS - (COLS - 1) / 2) * GAP; const cz = Math.floor(i / COLS) * GAP;
    o.position.set(cx - (mn.x + sz.x / 2) * k, -mn.y * k, cz - (mn.z + sz.z / 2) * k);
    scene.add(o);
    // Name and size on a little card in front.
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const c = cv.getContext('2d'); c.fillStyle = '#0b0d14'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffcc99';
    c.font = 'bold 30px sans-serif'; c.fillText(n.split('/')[1].slice(0, 30), 10, 40);
    c.font = '26px monospace'; c.fillStyle = '#9fb4ff'; c.fillText(`${sz.x.toFixed(1)} x ${sz.y.toFixed(1)} x ${sz.z.toFixed(1)} m${k < 1 ? ` (x${k.toFixed(2)})` : ''}`, 10, 80);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.86), new THREE.MeshBasicMaterial({ map: tex }));
    card.position.set(cx, 0.02, cz + 2.3); card.rotation.x = -Math.PI / 2; scene.add(card);
  });
  lab.scene = scene; lab.models = lib;
  const rows = Math.ceil(names.length / COLS);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
  const step = orbitCamera(camera, new THREE.Vector3(0, 0, (rows - 1) * GAP / 2), { dist: 30, sheet: { yaw: 0, pitch: 0.75, dist: 30 }, low: { yaw: 0.2, pitch: 0.35, dist: 22 } });
  lab.cam('sheet');
  tickFn = (dt) => step(dt);
  return camera;
}

const camera = await ({ interior: setupInterior, ship: setupShip, crew: setupCrew, models: setupModels }[VIEW] || setupInterior)();
if (VIEW !== 'interior') { pass.camera = camera; pass.scene = lab.scene || pass.scene; }

function fit() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  const cam = pass.camera; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
}
addEventListener('resize', fit);
fit();

function frame(dt) {
  tickFn(dt);
  renderer.info.autoReset = false; renderer.info.reset();
  composer.render(dt);
  const r = renderer.info.render;
  let lights = 0; pass.scene.traverse((o) => { if (o.isLight) lights++; });
  lab.lastInfo = { calls: r.calls, triangles: r.triangles, lights };
  info.textContent = `${VIEW}${lab.debug ? ` · deck ${lab.debug.deck}` : ''} · calls ${r.calls} · tris ${r.triangles} · lights ${lights}`;
}
lab.frames = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) frame(dt); return lab.lastInfo; };
lab.info = () => lab.lastInfo;
lab.stats = () => {
  const c = document.createElement('canvas'); const W = 320; const H = Math.round((320 * innerHeight) / innerWidth);
  c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(renderer.domElement, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  let sum = 0; let blown = 0;
  for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; sum += l; if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250) blown++; }
  const n = d.length / 4;
  return { mean: +(sum / n).toFixed(3), blown: +(blown / n).toFixed(4) };
};

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frame(dt);
  requestAnimationFrame(loop);
}
frame(1 / 30);
lab.ready = true;
requestAnimationFrame(loop);
