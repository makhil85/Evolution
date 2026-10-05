// The character page: pick, watch her move, save.
//
// Everything about HOW she is built lives in girl.js (shape), rig.js (joints)
// and clips.js (motion) - all three imported by the game too. This file is the
// tool around them: controls, a turntable, a mixer, and the save.
import * as THREE from 'three';
import { OPTIONS, BOY_LOOK, defaultChoices, buildGirlRig } from './girl.js';
import { saveProfile } from '../launcher/profile.js';
import { CLIPS } from './clips.js';
import { exportGlb, saveBlob } from './glb.js';

const STORE_KEY = 'rocket_village_girl_v1';

// --- state ------------------------------------------------------------------

/** Last-used choices survive a reload; this is a convenience, not game state. */
function loadChoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...defaultChoices(), ...saved };
  } catch { /* private mode, or someone edited it by hand */ }
  return defaultChoices();
}

let choices = loadChoices();
let animId = 'idle';
let playbackRate = 1;

// --- scene ------------------------------------------------------------------

const host = document.getElementById('canvas-host');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);

// Three-point-ish lighting. She is previewed close up here, unlike in the
// game, so flat toon shading would hide the shapes the choices actually change.
scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6b7f6a, 1.5));
const key = new THREE.DirectionalLight(0xfff6e2, 2.0);
key.position.set(2.5, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
// Thin skirts and coat tails shadow themselves; without a bias that shows as
// stripes (shadow acne) across every fold.
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.012;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 12;
const d = 1.6;
Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd8ff, 0.7);
rim.position.set(-3, 2, -2.5);
scene.add(rim);

// The ground she stands on, so she is not floating in a gradient.
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.7, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xbcd6a8, roughness: 1 })
);
ground.receiveShadow = true;
scene.add(ground);

const turntable = new THREE.Group();
scene.add(turntable);

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
let rig = null;
let mixer = null;
let actions = null;
let current = null;

/**
 * Rebuild from the current choices.
 *
 * The whole rig is thrown away and remade, because a different hair style is a
 * different geometry and there is nothing to patch. Cheap enough to do on every
 * click; the playhead is carried across so changing her glasses mid-stride does
 * not restart the walk.
 */
function rebuild() {
  const wasAt = current ? current.time : 0;

  if (rig) {
    turntable.remove(rig.group);
    rig.geometry.dispose();
    if (rig.hull) rig.hull.material.dispose();
  }

  rig = buildGirlRig(choices, { material, outline: false });
  turntable.add(rig.group);

  mixer = new THREE.AnimationMixer(rig.group);
  actions = {};
  for (const clip of rig.clips) {
    const action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    actions[clip.name] = action;
  }
  current = actions[animId] || actions.idle;
  current.reset();
  current.time = wasAt % current.getClip().duration;
  current.play();

  const geometry = rig.geometry;
  const tris = (geometry.getIndex() ? geometry.getIndex().count : geometry.getAttribute('position').count) / 3;
  document.getElementById('tris').textContent =
    `${Math.round(tris)} triangles · ${rig.bones.length} bones · ${rig.clips.length} clips`;

  try { localStorage.setItem(STORE_KEY, JSON.stringify(choices)); } catch { /* ignore */ }
  saveSpritePalette();
}

/**
 * The same girl, written out as a flat colour palette for chapters 1 and 2.
 *
 * Those two are self-contained 2D games that cannot import anything from this
 * project - no modules, no three.js, no girl.js. So the bridge is a plain
 * localStorage key holding only what a sprite needs: four colours, a hair
 * shape and whether she wears glasses. They read it with ordinary JSON.parse
 * and nothing else has to change hands.
 *
 * Written HERE, on every rebuild, because this is the one screen that knows
 * both the choices and the hex behind each one.
 */
const SPRITE_KEY = 'rocket_village_sprite';

/** Hair shapes this builder offers, mapped onto the five the sprites have. */
const SPRITE_STYLE = {
  bob: 'bob',
  ponytail: 'pony',
  bunches: 'twin',
  bun: 'bun',
  // The sprites have no curls and no crop, so both fall back to the
  // side-parted shape rather than silently becoming someone else's hair.
  curls: 'side',
  short: 'side',
  long: 'side',
  braids: 'twin',
};

function hexOf(group, id) {
  const values = OPTIONS[group].values;
  const hit = values.find((v) => v.id === id) || values[0];
  return '#' + (hit.color ?? 0xffffff).toString(16).padStart(6, '0');
}

function saveSpritePalette() {
  try {
    localStorage.setItem(SPRITE_KEY, JSON.stringify({
      skin: hexOf('skin', choices.skin),
      hair: hexOf('hairColor', choices.hairColor),
      outfit: hexOf('outfitColor', choices.outfitColor),
      accent: hexOf('trousers', choices.trousers),
      style: SPRITE_STYLE[choices.hairStyle] || 'pony',
      glasses: choices.glasses !== 'none',
      eye: '#3b2a1e',
    }));
  } catch { /* private mode */ }
}

/** Switch clips with a short blend, so she does not snap between poses. */
function playAnimation(id) {
  animId = id;
  const next = actions[id];
  if (!next || next === current) return;
  next.reset();
  next.play();
  next.crossFadeFrom(current, 0.28, true);
  current = next;
}

function fit() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Framed on the whole figure with a little air, from slightly above her eye
  // line - the angle you judge a character from.
  camera.position.set(0, 1.05, 3.4);
  camera.lookAt(0, 0.78, 0);
}
addEventListener('resize', fit);

// --- controls ---------------------------------------------------------------

const panel = document.getElementById('choices');

function buildControls() {
  panel.innerHTML = '';
  for (const [key, group] of Object.entries(OPTIONS)) {
    // Group the long list under Face / Hair / Clothes / Extras.
    if (group.section) {
      const h = document.createElement('h2');
      h.className = 'section-title';
      h.textContent = group.section;
      panel.appendChild(h);
    }
    const set = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = group.label;
    set.appendChild(legend);

    const opts = document.createElement('div');
    opts.className = 'opts';
    for (const value of group.values) {
      const label = document.createElement('label');
      label.className = group.swatches ? 'opt swatch' : 'opt';
      label.title = value.label;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = key;
      input.value = value.id;
      input.checked = choices[key] === value.id;
      input.addEventListener('change', () => {
        if (key === 'hero') {
          // Girl <-> boy starts from that hero's look (hair, outfit), keeping
          // skin, eyes and the rest; the launcher remembers the choice so the
          // chapters' text says he or she.
          const base = defaultChoices(value.id);
          for (const k of Object.keys(BOY_LOOK)) choices[k] = base[k];
          saveProfile({ hero: value.id });
          buildControls();
        }
        choices[key] = value.id;
        rebuild();
        setStatus('');
      });
      label.appendChild(input);

      if (group.swatches) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.style.background = `#${value.color.toString(16).padStart(6, '0')}`;
        label.appendChild(chip);
      }
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = value.label;
      label.appendChild(name);

      opts.appendChild(label);
    }
    set.appendChild(opts);
    panel.appendChild(set);
  }
}

/** The clip picker, built from the clip list so the two cannot drift. */
function buildAnimControls() {
  const bar = document.getElementById('anim');
  bar.innerHTML = '';
  for (const clip of CLIPS) {
    const label = document.createElement('label');
    label.className = 'opt';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'anim';
    input.value = clip.id;
    input.checked = clip.id === animId;
    input.addEventListener('change', () => playAnimation(clip.id));
    label.appendChild(input);
    const span = document.createElement('span');
    span.className = 'name';
    span.textContent = clip.label;
    label.appendChild(span);
    bar.appendChild(label);
  }
}

const statusEl = document.getElementById('status');
let statusTimer = null;
function setStatus(text) {
  statusEl.textContent = text;
  clearTimeout(statusTimer);
  if (text) statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 8000);
}

document.getElementById('save').addEventListener('click', () => {
  try {
    const blob = exportGlb(rig.geometry, {
      name: 'girl_scientist',
      bones: rig.bones,
      skeleton: rig.skeleton,
      clips: rig.sampled,
    });
    saveBlob(blob, 'girl_scientist.glb');
    setStatus(`Saved ${(blob.size / 1024).toFixed(0)} KB, rigged, with ${rig.clips.length} animations. Put it in assets/models/characters/ in each level.`);
  } catch (err) {
    setStatus(`Could not save: ${err.message}`);
  }
});

document.getElementById('save-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(choices, null, 2)], { type: 'application/json' });
  saveBlob(blob, 'girl_scientist.choices.json');
  setStatus('Saved her choices, so you can come back and change one thing.');
});

document.getElementById('load-json').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const loaded = JSON.parse(await file.text());
    choices = { ...defaultChoices(), ...loaded };
    buildControls();
    rebuild();
    setStatus(`Loaded ${file.name}.`);
  } catch (err) {
    setStatus(`That file did not read as choices: ${err.message}`);
  }
  e.target.value = '';
});

document.getElementById('random').addEventListener('click', () => {
  for (const [key, group] of Object.entries(OPTIONS)) {
    if (key === 'hero') continue; // surprise the look, not who it is
    choices[key] = group.values[Math.floor(Math.random() * group.values.length)].id;
  }
  buildControls();
  rebuild();
});

document.getElementById('reset').addEventListener('click', () => {
  choices = defaultChoices(choices.hero);
  buildControls();
  rebuild();
});

// Arriving FROM the launcher means this is step two of setting her up, so
// there has to be a way onward. Opened directly it is still just a tool, and
// a "go to the chapters" button would be noise.
// Her name, if she has been given one. The builder is still usable on its own,
// so this is a nicety rather than a dependency.
try {
  const saved = JSON.parse(localStorage.getItem('rocket_village_profile') || 'null');
  if (saved && typeof saved.name === 'string' && saved.name.trim()) {
    document.getElementById('builder-title').textContent = `Build ${saved.name.trim()}`;
  }
} catch { /* private mode */ }

if (new URLSearchParams(location.search).get('from') === 'launcher') {
  const back = document.getElementById('to-chapters');
  back.hidden = false;
  // Her choices are already written to localStorage on every change by
  // rebuild(), so there is nothing to save on the way out.
  back.addEventListener('click', () => { location.href = 'index.html'; });
}

const spinBtn = document.getElementById('spin');
let spinning = true;
spinBtn.addEventListener('click', () => {
  spinning = !spinning;
  spinBtn.textContent = spinning ? 'Pause spin' : 'Spin';
  spinBtn.setAttribute('aria-pressed', String(spinning));
});

const rateInput = document.getElementById('rate');
const rateOut = document.getElementById('rate-value');
rateInput.addEventListener('input', () => {
  playbackRate = Number(rateInput.value);
  rateOut.textContent = `${playbackRate.toFixed(2)}×`;
});

// Drag to turn her by hand, which is how you check the back of a haircut.
let dragging = false;
let lastX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  turntable.rotation.y += (e.clientX - lastX) * 0.01;
  lastX = e.clientX;
});

// --- go ---------------------------------------------------------------------

buildControls();
buildAnimControls();
rebuild();
fit();

// The same handle the game exposes as __game: somewhere to reach the camera
// and the rig from the console when checking how a face reads up close.
window.__zara = { scene, camera, renderer, turntable, get rig() { return rig; }, THREE };

let t = 0;
renderer.setAnimationLoop((ms) => {
  const now = ms / 1000;
  const dt = Math.min(now - t, 0.1);
  t = now;
  if (spinning && !dragging) turntable.rotation.y += dt * 0.45;
  if (mixer) mixer.update(dt * playbackRate);
  renderer.render(scene, camera);
});
