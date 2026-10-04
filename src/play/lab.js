// Lab only: a tiny three.js scene (ground, a stand-in player, a target house,
// some cubes as resources) that shows every piece of src/play/: the mode
// chooser and chip, the navigation arrow and beacon, mining rings and chips,
// the clue card, the Clue button, the found card and the key block.
// See play-lab.html. window.__lab.shot(name) saves docs/progress/<name>.png.
import * as THREE from 'three';
import { PLAY_MODES, PLAY_MODE_KEY, choosePlayMode, createModeChip, savePlayMode } from './modes.js';
import { createNavArrow } from './navArrow.js';
import { createMiner } from './mining.js';
import { createHunt, createKeyBlockMesh } from './hunt.js';
import { isPlayModalOpen } from './ui.js';

// The lab shares localhost:5173 with the chapters, so keep its mode choice OUT
// of the real saved key (it would change what a chapter opens with).
{
  let labMode = null;
  const realGet = Storage.prototype.getItem;
  const realSet = Storage.prototype.setItem;
  Storage.prototype.getItem = function getItem(k) { return k === PLAY_MODE_KEY ? labMode : realGet.call(this, k); };
  Storage.prototype.setItem = function setItem(k, v) { if (k === PLAY_MODE_KEY) labMode = String(v); else realSet.call(this, k, v); };
}

const params = new URLSearchParams(location.search);
let mode = PLAY_MODES[params.get('mode')] || PLAY_MODES.easy;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ccbf0);
scene.fog = new THREE.Fog(0x8ccbf0, 40, 120);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a45, 1.6));
const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(-8, 14, 6);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: 0x5f9a48 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 60), new THREE.MeshLambertMaterial({ color: 0xb5926a }));
path.rotation.x = -Math.PI / 2;
path.position.set(0, 0.01, -20);
scene.add(path);

// The stand-in player.
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 10), new THREE.MeshLambertMaterial({ color: 0x24406e }));
body.position.y = 0.75;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf0c9a0 }));
head.position.y = 1.55;
player.add(body, head);
scene.add(player);

// The target: a small house.
const target = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 4), new THREE.MeshLambertMaterial({ color: 0xe9d6ae }));
walls.position.y = 1.3;
const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0x9c2f2a }));
roof.position.y = 3.4;
roof.rotation.y = Math.PI / 4;
target.add(walls, roof);
target.position.set(-3, 0, -24);
scene.add(target);
const TARGET = { x: -3, z: -20.5, y: 0, label: 'Science Center' };

// Resources: cubes to mine.
const cubes = [];
[[2.4, -1.2], [-2.2, -3], [3.6, -4.5], [-4, -7]].forEach(([x, z], i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: [0x9aa3ab, 0xb27a4a, 0x6db3d8, 0xd5b04a][i] }));
  m.position.set(x, 0.35, z);
  m.userData.key = `cube${i}`;
  scene.add(m);
  cubes.push(m);
});

// The pieces under review.
const nav = createNavArrow(scene);
nav.setTarget(TARGET);
const miner = createMiner({ scene });
let hunt = null;
const HUNT_DATA = {
  title: 'The Hidden Golden Core',
  itemName: 'Golden Core',
  intro: 'A Golden Core is hidden in one of the homes. Follow the clues to find it.',
  steps: [
    { id: 'well', at: { x: 0, z: -6 }, clue: 'Start at the old well. Count the purple boards in a row, then walk to the house with that many windows on the front.', found: 'Yes, this is the well!' },
    { id: 'mid', at: { x: 4, z: -12 }, clue: 'Now look to your left. Find the big tree, and stand where its shadow points toward the baker.', found: 'Good eyes! This is the tree.' },
    { id: 'baker', at: { x: -3, z: -18 }, clue: 'The baker has 12 loaves and sells 5. Walk to the home with that many windows on the front.', found: 'You solved it!' },
    { id: 'home', at: { x: -3, z: -21 }, clue: 'The treasure is inside this home!', found: 'You opened the door and there it is, glowing on a little stone plinth.' },
  ],
};
const keyBlock = createKeyBlockMesh();
keyBlock.position.set(-3, 0, -18.5);
keyBlock.scale.setScalar(1.6);
keyBlock.visible = false;
scene.add(keyBlock);

// --- camera + movement ---------------------------------------------------------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (isPlayModalOpen()) return;   // the same rule the chapters follow
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e' && !e.repeat) mine();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function mine() {
  let best = null;
  let bd = 3.2;
  for (const c of cubes) {
    if (!c.visible) continue;
    const d = Math.hypot(c.position.x - player.position.x, c.position.z - player.position.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  const r = miner.hit(best.userData.key, mode.mineHits, best.position, { color: best.material.color.getHex() });
  if (r.done) best.visible = false;
  return r;
}

let camOverride = null;
function frame(dt) {
  if (!isPlayModalOpen()) {
    const v = new THREE.Vector3((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), 0, (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0));
    if (v.lengthSq()) { v.normalize().multiplyScalar(6 * dt); player.position.add(v); player.rotation.y = Math.atan2(-v.x, -v.z); }
  }
  if (camOverride) {
    camera.position.set(...camOverride.pos);
    camera.lookAt(...camOverride.look);
  } else {
    camera.position.set(player.position.x, player.position.y + 3.4, player.position.z + 7.2);
    camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z - 2);
  }
  nav.update(dt, player.position);
  miner.update(dt);
  renderer.render(scene, camera);
}
let last = performance.now();
renderer.setAnimationLoop((now) => { frame(Math.min((now - last) / 1000, 0.1)); last = now; });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// --- the lab API ---------------------------------------------------------------------
function applyNav(m) {
  mode = m;
  nav.setArrow(m.navArrow);
  nav.setBeacon(m.targetBeacon);
  cubes.forEach((c) => { c.visible = true; miner.reset(c.userData.key); });
}
applyNav(mode);

const chip = createModeChip({ level: 4, onChange: (id) => applyNav(PLAY_MODES[id]) });
chip.set(mode.id);

const lab = {
  scene, camera, renderer, player, cubes, nav, miner, PLAY_MODES, chip, keyBlock,
  choose: (level = 4) => choosePlayMode({ level, current: mode.id }).then((id) => { applyNav(PLAY_MODES[id]); chip.set(id); return id; }),
  setMode: (id) => { savePlayMode(id); applyNav(PLAY_MODES[id]); chip.set(id); },
  place: (x, z) => player.position.set(x, 0, z),
  camera_: (pos, look) => { camOverride = pos ? { pos, look } : null; },
  mine,
  hunt: (fresh = true) => {
    hunt?.dispose();
    hunt = createHunt({ data: HUNT_DATA, storageKey: 'play_lab_hunt', onFound: () => { keyBlock.visible = true; } });
    if (fresh) hunt.reset();
    hunt.start();
    return hunt;
  },
  tryHere: (x, z) => hunt?.tryHere({ x, z }),
  async shot(name) {
    const W = innerWidth;
    const H = innerHeight;
    renderer.render(scene, camera);
    const bg = renderer.domElement.toDataURL('image/png');
    const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const css = `${document.getElementById('play-styles').textContent}\n*, *::before, *::after { animation: none !important; transition: none !important; }`;
    const ser = new XMLSerializer();
    const parts = [...document.querySelectorAll('.pl-back, .pl-chip, .play-nav-text, .pl-hint, .pl-cluebtn')]
      .filter((n) => !n.hidden).map((n) => ser.serializeToString(n)).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${W}px;height:${H}px;font-family:system-ui,sans-serif">`
      + `<style><![CDATA[${css.replace(/]]>/g, '')}]]></style>${parts}</div></foreignObject></svg>`;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const c = out.getContext('2d');
    c.drawImage(await load(bg), 0, 0, W, H);
    c.drawImage(await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), 0, 0);
    const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: out.toDataURL('image/png') });
    return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
  },
};
window.__lab = lab;

// A few buttons for eyeballing (not part of any screenshot).
const bar = document.getElementById('labBar');
const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', fn); bar.appendChild(b); };
add('Chooser L4', () => lab.choose(4));
add('Chooser L1', () => lab.choose(1));
add('Easy', () => lab.setMode('easy'));
add('Medium', () => lab.setMode('medium'));
add('Hard', () => lab.setMode('hard'));
add('Mine nearest', () => mine());
add('Hunt', () => lab.hunt());
add('Step', () => { const s = hunt?.current(); if (s) lab.tryHere(s.at.x, s.at.z); });
