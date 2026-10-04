// Mining effort for Medium and Hard: a resource takes several presses of E.
// Each press adds to a progress ring over the resource and knocks a few chips
// off it; when the ring fills, the chapter collects it as before. Walking away
// and coming back keeps the progress (children get interrupted); the ring
// itself disappears after 8 s of no presses. Easy is one press, so only a
// puff of chips shows. Without `deps.scene` nothing is drawn (the counting
// still works, which is what the tests use).
//
// The chapter must call miner.update(dt) every frame for the ring and chips to
// animate.
import * as THREE from 'three';
import { ensurePlayStyles, prefersReducedMotion } from './ui.js';

const IDLE_HIDE = 8;      // seconds without a press before the ring goes away
const DONE_HOLD = 0.45;   // seconds a filled ring stays before fading
const MAX_CHIPS = 64;
const GRAVITY = 9;

/**
 * @param {{ scene?: object, color?: number, hint?: boolean }} [deps]
 *   scene: a THREE.Scene to draw the ring and chips into (omit for none)
 *   color: default chip colour (0xRRGGBB)
 *   hint:  show the "Keep pressing E!" line on the first presses (default true)
 * @returns {{
 *   hit: (key: string|number, hitsNeeded: number, worldPos?: {x:number,y:number,z:number}, opts?: {color?: number}) => { done: boolean, progress: number, hits: number },
 *   progressOf: (key: string|number) => number,
 *   reset: (key: string|number) => void,
 *   update: (dt: number) => void,
 *   dispose: () => void,
 * }}
 */
export function createMiner(deps = {}) {
  const scene = deps.scene || null;
  const baseColor = deps.color ?? 0xffd27a;
  const hits = new Map();
  const still = prefersReducedMotion();
  const canDraw = !!scene && typeof document !== 'undefined';

  // --- rings (one sprite per resource being worked on) -------------------------
  const rings = new Map();   // key -> ring state

  function drawRing(r) {
    const g = r.ctx;
    const S = 128;
    const c = S / 2;
    const R = 44;
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(c, c, R + 12, 0, Math.PI * 2);
    g.fillStyle = 'rgba(10,16,26,0.82)'; g.fill();
    g.lineWidth = 11; g.lineCap = 'round';
    g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
    if (r.shown > 0.004) {
      const grad = g.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, '#ffe9a3'); grad.addColorStop(1, r.done ? '#7ee787' : '#ffcf5c');
      g.save();
      g.shadowColor = r.done ? 'rgba(126,231,135,0.9)' : 'rgba(255,207,92,0.9)';
      g.shadowBlur = 10;
      g.strokeStyle = grad;
      g.beginPath(); g.arc(c, c, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, r.shown));
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#fff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${r.done ? 40 : 28}px 'Trebuchet MS', Arial, sans-serif`;
    g.fillText(r.done ? '✓' : r.label, c, c + 2);
    r.tex.needsUpdate = true;
  }

  function makeRing(pos) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 30;
    sprite.position.set(pos.x, pos.y + 1.0, pos.z);
    scene.add(sprite);
    return { sprite, mat, tex, ctx: canvas.getContext('2d'), shown: 0, target: 0, label: '', done: false, idle: 0, hold: 0, alpha: 0, fading: false, pop: 0 };
  }

  function killRing(key) {
    const r = rings.get(key);
    if (!r) return;
    scene.remove(r.sprite);
    r.mat.dispose(); r.tex.dispose();
    rings.delete(key);
  }

  // --- chips flying off ----------------------------------------------------------
  let chipMesh = null;
  const chips = [];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  function ensureChips() {
    if (chipMesh || !canDraw) return;
    chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }), MAX_CHIPS);
    chipMesh.frustumCulled = false;
    chipMesh.renderOrder = 29;
    chipMesh.count = 0;
    chipMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CHIPS * 3), 3);
    scene.add(chipMesh);
  }

  function burst(pos, n, color) {
    ensureChips();
    if (!chipMesh) return;
    for (let i = 0; i < n; i++) {
      if (chips.length >= MAX_CHIPS) chips.shift();
      const a = Math.random() * Math.PI * 2;
      const out = 0.8 + Math.random() * 1.8;
      const k = Math.random();
      tint.set(color).offsetHSL(0, 0, (k - 0.5) * 0.3);
      if (k > 0.85) tint.set(0xffffff);
      chips.push({
        x: pos.x + Math.cos(a) * 0.12, y: pos.y + 0.55 + Math.random() * 0.35, z: pos.z + Math.sin(a) * 0.12,
        vx: Math.cos(a) * out, vy: 2.2 + Math.random() * 2.4, vz: Math.sin(a) * out,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14,
        size: 0.05 + Math.random() * 0.06, life: 0, max: 0.5 + Math.random() * 0.25,
        r: tint.r, g: tint.g, b: tint.b,
      });
    }
  }

  function stepChips(dt) {
    if (!chipMesh) return;
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.life += dt;
      if (c.life >= c.max) { chips.splice(i, 1); continue; }
      c.vy -= GRAVITY * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.sx * dt; c.ry += c.sy * dt;
    }
    chipMesh.count = chips.length;
    for (let i = 0; i < chips.length; i++) {
      const c = chips[i];
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(c.rx, c.ry, 0);
      dummy.scale.setScalar(c.size * (1 - (c.life / c.max) ** 2));
      dummy.updateMatrix();
      chipMesh.setMatrixAt(i, dummy.matrix);
      chipMesh.setColorAt(i, tint.setRGB(c.r, c.g, c.b));
    }
    chipMesh.instanceMatrix.needsUpdate = true;
    if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  }

  // --- the "Keep pressing E!" hint ---------------------------------------------------
  let hintEl = null;
  let hintTimer = 0;
  let hintsShown = 0;
  const hintWanted = deps.hint !== false && typeof document !== 'undefined';

  function showHint() {
    if (!hintWanted || hintsShown >= 3) return;
    hintsShown += 1;
    ensurePlayStyles();
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.className = 'pl-hint';
      hintEl.setAttribute('role', 'status');
      const key = document.createElement('span');
      key.className = 'pl-key';
      key.textContent = 'E';
      hintEl.append('Keep pressing ', key, '!');
      document.body.appendChild(hintEl);
    }
    void hintEl.offsetWidth;
    hintEl.classList.add('is-in');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 2400);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hintEl?.classList.remove('is-in');
  }

  // --- the public API ------------------------------------------------------------------
  const lastPos = new Map();

  return {
    hit(key, hitsNeeded, worldPos = null, opts = null) {
      const need = Math.max(1, hitsNeeded | 0);
      const n = (hits.get(key) || 0) + 1;
      const done = n >= need;
      if (done) hits.delete(key); else hits.set(key, n);

      const pos = worldPos || lastPos.get(key) || null;
      if (worldPos) lastPos.set(key, { x: worldPos.x, y: worldPos.y, z: worldPos.z });
      if (canDraw && pos) {
        const color = opts?.color ?? baseColor;
        burst(pos, still ? (done ? 8 : 3) : (done ? 18 : 7), color);
        if (need > 1) {
          let r = rings.get(key);
          if (!r) { r = makeRing(pos); rings.set(key, r); r.shown = (n - 1) / need; }
          r.sprite.position.set(pos.x, pos.y + 1.0, pos.z);
          r.target = done ? 1 : n / need;
          r.label = `${n}/${need}`;
          r.done = done;
          r.idle = 0; r.hold = 0; r.fading = false; r.pop = still ? 0 : 1;
          drawRing(r);
        }
      }
      if (done) { hideHint(); lastPos.delete(key); }
      else if (n === 1 && need > 1) showHint();
      return done
        ? { done: true, progress: 1, hits: n }
        : { done: false, progress: n / need, hits: n };
    },
    progressOf(key) { return hits.get(key) || 0; },
    reset(key) {
      hits.delete(key);
      lastPos.delete(key);
      if (canDraw) killRing(key);
    },
    update(dt) {
      if (!canDraw) return;
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      stepChips(dt);
      for (const [key, r] of rings) {
        // Fill smoothly toward the target.
        const before = r.shown;
        r.shown += (r.target - r.shown) * (1 - Math.exp(-14 * dt));
        if (Math.abs(r.target - r.shown) < 0.003) r.shown = r.target;
        if (r.shown !== before) drawRing(r);
        // Fade in on a press, out when done or idle.
        r.idle += dt;
        if (r.done && r.shown >= r.target) { r.hold += dt; if (r.hold > DONE_HOLD) r.fading = true; }
        if (!r.done && r.idle > IDLE_HIDE) r.fading = true;
        r.alpha += ((r.fading ? 0 : 1) - r.alpha) * (1 - Math.exp(-(r.fading ? 7 : 20) * dt));
        r.mat.opacity = r.alpha;
        r.pop = Math.max(0, r.pop - dt * 5);
        const s = 0.95 * (1 + 0.18 * r.pop) * (0.85 + 0.15 * r.alpha);
        r.sprite.scale.set(s, s, 1);
        if (r.fading && r.alpha < 0.02) killRing(key);
      }
    },
    dispose() {
      for (const key of [...rings.keys()]) killRing(key);
      if (chipMesh) { scene.remove(chipMesh); chipMesh.geometry.dispose(); chipMesh.material.dispose(); chipMesh.dispose?.(); chipMesh = null; }
      chips.length = 0;
      clearTimeout(hintTimer);
      hintEl?.remove();
      hintEl = null;
    },
  };
}
