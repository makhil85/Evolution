// Hard mode's treasure hunt: a chain of clues that ends at the home where a
// key block is hidden. Each chapter supplies its own clue data (per Level);
// this engine tracks progress, persists it, and shows the clue as a parchment
// card, a persistent "Clue" button to re-read it, and a celebration card when
// the item is found.
//
// A clue step is reached by standing within `radius` of `at` and pressing E
// (the chapter calls tryHere() from its E handler before anything else).
// Searching a wrong home ("decoy") gives its own short text and no progress.
//
// While a card is open `document.body.dataset.playModal === '1'`; the chapter
// must ignore movement / E while it is set (see ui.js). All DOM is guarded, so
// this file imports and runs in node (the tests use it with `onClue`).
import * as THREE from 'three';
import { ensurePlayStyles, openLayer, el, prefersReducedMotion } from './ui.js';

const HAS_DOM = typeof document !== 'undefined';

/**
 * @typedef {object} ClueStep
 * @property {string} id
 * @property {{x:number, z:number}} at   world position of this step's place
 * @property {number} [radius]            how close counts (default 3)
 * @property {string} clue                shown when this step becomes the target
 * @property {string} found               shown when she reaches it
 *
 * @typedef {object} HuntData
 * @property {string} title               e.g. "The Hidden Golden Core"
 * @property {string} itemName            e.g. "Golden Core"
 * @property {string} intro               shown with the first clue
 * @property {ClueStep[]} steps           the last step is the home with the item
 * @property {{at:{x:number, z:number}, radius?:number, text:string}[]} [decoys]
 */

/**
 * @param {{ data: HuntData, storageKey: string, storage?: Storage,
 *   onFound?: () => void, onClue?: (text:string, index:number, total:number) => void,
 *   foundCard?: boolean }} opts
 *   foundCard: show the built-in "Found the <item>!" card (default true)
 */
export function createHunt({ data, storageKey, storage = globalThis.localStorage, onFound = () => {}, onClue = null, foundCard = true }) {
  const fresh = () => ({ step: 0, found: false, started: false });
  const read = () => {
    try { return { ...fresh(), ...(JSON.parse(storage?.getItem(storageKey) || 'null') || {}) }; } catch { return fresh(); }
  };
  const state = read();
  const save = () => { try { storage?.setItem(storageKey, JSON.stringify(state)); } catch { /* private mode */ } };
  const total = data.steps.length;
  let active = true;

  // --- the persistent "Clue" button ----------------------------------------------
  let btn = null;
  if (HAS_DOM) {
    ensurePlayStyles();
    btn = el('button', 'pl-cluebtn', '📜 Clue');
    btn.type = 'button';
    btn.title = 'Read the current clue again';
    btn.addEventListener('click', () => api.showClue());
    document.body.appendChild(btn);
  }
  const sync = () => { if (btn) btn.hidden = !(active && state.started && !state.found); };
  const flagNew = () => {
    if (!btn) return;
    btn.classList.remove('is-new');
    void btn.offsetWidth;
    btn.classList.add('is-new');
  };
  sync();

  /** Show a clue: the chapter's `onClue` if given, else the parchment card. */
  const present = (lead, clue, index) => {
    if (onClue) onClue(lead ? `${lead}\n\n${clue}` : clue, index, total);
    else clueCard({ eyebrow: data.title, index, total, lead, text: clue });
  };

  const api = {
    data,
    state,
    isFound: () => state.found,
    current: () => (state.found ? null : data.steps[state.step]),
    /** Start the hunt (first time: show the intro and the first clue). */
    start() {
      if (!state.started) {
        present(data.intro, data.steps[state.step].clue, state.step);
        state.started = true;
        save();
        flagNew();
      }
      sync();
    },
    /** Show the current clue again (the "Clue" button calls this). */
    showClue() {
      if (state.found || !active) return;
      const s = data.steps[state.step];
      present(state.step === 0 && !state.started ? data.intro : '', s.clue, state.step);
    },
    /** The celebration card (tryHere shows it for you when the item is found). */
    showFoundCard() {
      foundCardUI({ itemName: data.itemName, text: data.steps[total - 1].found });
    },
    /**
     * Call on every E press, before anything else. Returns what happened:
     *  { kind: 'step', text } she reached the current clue's place
     *  { kind: 'found', text } she found the item (last step)
     *  { kind: 'decoy', text } a wrong home
     *  null - nothing hunt-related here
     */
    tryHere(pos) {
      if (state.found) return null;
      const s = data.steps[state.step];
      if (Math.hypot(pos.x - s.at.x, pos.z - s.at.z) <= (s.radius ?? 3)) {
        state.step += 1;
        state.started = true;
        if (state.step >= total) {
          state.found = true;
          save();
          sync();
          if (foundCard) api.showFoundCard();
          onFound();
          return { kind: 'found', text: s.found };
        }
        save();
        sync();
        flagNew();
        present(s.found, data.steps[state.step].clue, state.step);
        return { kind: 'step', text: s.found };
      }
      for (const d of data.decoys || []) {
        if (Math.hypot(pos.x - d.at.x, pos.z - d.at.z) <= (d.radius ?? 3)) return { kind: 'decoy', text: d.text };
      }
      return null;
    },
    /**
     * Hide / show the Clue button and ignore showClue() (e.g. when she switches
     * away from Hard). Progress is kept.
     */
    setActive(on) { active = !!on; sync(); },
    /** Remove the Clue button. */
    dispose() { btn?.remove(); btn = null; },
    /** Test / lab: reset. */
    reset() { state.step = 0; state.found = false; state.started = false; save(); sync(); },
  };
  return api;
}

/** The parchment clue card: title "Clue 2 of 4", the text, a big "Got it". */
function clueCard({ eyebrow, index, total, lead, text }) {
  if (!HAS_DOM) return null;
  const card = el('div', 'pl-clue');
  card.appendChild(el('div', 'pl-clue__eyebrow', `📜 ${eyebrow || 'Treasure hunt'}`));
  card.appendChild(el('h2', 'pl-clue__title', `Clue ${index + 1} of ${total}`));
  const dots = el('div', 'pl-clue__dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < total; i++) dots.appendChild(el('i', i < index ? 'is-done' : i === index ? 'is-now' : ''));
  card.appendChild(dots);
  if (lead) card.appendChild(el('p', 'pl-clue__lead', lead));
  card.appendChild(el('p', 'pl-clue__text', text));
  const actions = el('div', 'pl-clue__actions');
  const ok = el('button', 'pl-bigbtn', 'Got it');
  ok.type = 'button';
  actions.appendChild(ok);
  const hint = el('div', 'pl-clue__hint');
  hint.append('Press ', el('span', 'pl-key', 'Enter'), ' to close. The 📜 Clue button shows it again.');
  actions.appendChild(hint);
  card.appendChild(actions);
  const layer = openLayer(card, {
    onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); if (!e.repeat) layer.close(); }
      else if (e.key === 'Tab') e.preventDefault();
    },
  });
  ok.addEventListener('click', () => layer.close());
  ok.focus();
  return layer;
}

/** The "Found the <item>!" celebration card. */
function foundCardUI({ itemName, text }) {
  if (!HAS_DOM) return null;
  const card = el('div', 'pl-found');
  const positions = [[8, 12], [88, 10], [14, 70], [84, 66], [50, 4], [30, 88], [72, 90]];
  for (const [x, y] of positions) {
    const sp = el('span', 'pl-found__spark', '✦');
    sp.style.left = `${x}%`; sp.style.top = `${y}%`;
    sp.style.animationDelay = `${((x * 7 + y * 3) % 18) / 10}s`;
    sp.setAttribute('aria-hidden', 'true');
    card.appendChild(sp);
  }
  card.appendChild(el('div', 'pl-found__icon', '🔑'));
  card.appendChild(el('h2', 'pl-found__title', `Found the ${itemName}!`));
  if (text) card.appendChild(el('p', 'pl-found__text', text));
  const ok = el('button', 'pl-bigbtn', 'Great!');
  ok.type = 'button';
  card.appendChild(ok);
  const layer = openLayer(card, {
    onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); if (!e.repeat) layer.close(); }
      else if (e.key === 'Tab') e.preventDefault();
    },
  });
  ok.addEventListener('click', () => layer.close());
  ok.focus();
  return layer;
}

/**
 * A glowing key block on a small stone plinth, about 0.8 units tall, to place
 * in the target home. It turns and pulses by itself (no update call needed;
 * it stays still for prefers-reduced-motion). Origin is at the foot of the
 * plinth.
 * @returns {THREE.Group}
 */
export function createKeyBlockMesh() {
  const g = new THREE.Group();
  g.name = 'keyBlock';

  const stone = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.9, metalness: 0.05 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.56), stone);
  base.position.y = 0.04;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0xaab1b8, roughness: 0.85, metalness: 0.05 }));
  top.position.y = 0.13;
  g.add(base, top);

  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc94a, emissive: 0xffa41c, emissiveIntensity: 1.0, roughness: 0.25, metalness: 0.45,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), gold);
  crystal.scale.set(1, 1.55, 1);
  crystal.position.y = 0.5;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd35a, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  frame.position.y = 0.5;
  frame.rotation.set(0.6, 0.6, 0);
  g.add(crystal, frame);

  // Four little sparkles orbiting the crystal, and a soft halo behind it.
  const sparkGeo = new THREE.OctahedronGeometry(0.03);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, toneMapped: false });
  const orbit = new THREE.Group();
  orbit.position.y = 0.5;
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(sparkGeo, sparkMat);
    const a = (i / 4) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.36, (i % 2 ? 0.1 : -0.08), Math.sin(a) * 0.36);
    orbit.add(s);
  }
  g.add(orbit);

  let halo = null;
  if (HAS_DOM) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,225,140,0.95)');
    grad.addColorStop(0.4, 'rgba(255,190,80,0.35)');
    grad.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, opacity: 0.9,
    }));
    halo.scale.set(1.0, 1.0, 1);
    halo.position.y = 0.5;
    g.add(halo);
  }

  // A tiny warm point light so the plinth and the room around it pick up the glow.
  const light = new THREE.PointLight(0xffb84a, 3, 3.2, 2);
  light.position.y = 0.55;
  g.add(light);

  const still = prefersReducedMotion();
  const clock = { t: Math.random() * 6 };
  if (!still) {
    crystal.onBeforeRender = () => {
      const t = (clock.t = performance.now() / 1000);
      crystal.rotation.y = t * 0.9;
      frame.rotation.y = -t * 0.7;
      orbit.rotation.y = t * 1.4;
      const k = 0.5 + 0.5 * Math.sin(t * 2.2);
      gold.emissiveIntensity = 0.75 + 0.5 * k;
      if (halo) halo.material.opacity = 0.65 + 0.3 * k;
      crystal.position.y = frame.position.y = 0.5 + Math.sin(t * 1.6) * 0.025;
    };
  }
  g.userData.height = 0.8;
  return g;
}
