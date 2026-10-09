// Chapter 7's star map: the Sun's nearest neighbours, drawn two ways.
//
//   buildStarMap3D(scene)   the 3-D map the opening's second half pulls back to
//                           (the Sun, five stars, Tau Ceti ringed, labels laid
//                           over the picture). One unit = one light-year.
//   playStarMap({ bus })    the 2-D card on the bridge (Echo's star map): a flat
//                           picture on an 800x450 canvas, with a Done button.
//
// Both read the same table, NEIGHBOURS. Positions come from each star's right
// ascension and declination (sky coordinates, as astronomers list them) and its
// distance, so the picture is the real direction of each star seen from the Sun.
// The map is flat (seen from above the Sun's north pole): a star's height above
// that plane is not drawn on the 2-D card, and the labels give the real distances.
// Lead 2026-10-08: Tau Ceti is the target; nobody knows yet if it has life.
import * as THREE from 'three';
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { skipButton } from '../../play/grownUp.js';
import { t, LEVEL } from '../level.js';
import { NEIGHBOURS as STARS } from './voyage.js';

/** The star colours (the table of distances and sky positions is voyage.js's NEIGHBOURS). */
const COLOUR = Object.freeze({ alpha: 0xffe2b0, barnard: 0xff9a7a, sirius: 0xeaf3ff, eps: 0xffb070, tau: 0xffe08a });
export const NEIGHBOURS = Object.freeze(STARS.map((s) => ({ ...s, colour: COLOUR[s.id] })));

/** Where a star is on the map, in light-years: x towards the vernal equinox, y up (north), z the way RA grows. */
export function starPlace(s) {
  const a = (s.ra * Math.PI) / 180; const e = (s.dec * Math.PI) / 180;
  return [s.ly * Math.cos(e) * Math.cos(a), s.ly * Math.sin(e), -s.ly * Math.cos(e) * Math.sin(a)];
}

/** "4.4 light-years" (Level 4) or "about 4 light-years" (Level 1); `level` defaults to the game's Level. */
export function distanceWords(s, level = null) {
  const l1 = (level ?? LEVEL) === 1;
  const n = l1 ? String(Math.round(s.ly)) : s.ly.toFixed(1);
  return l1 ? `about ${n} light-years` : `${n} light-years`;
}

/** A star's name and distance on one line, as the labels show it. */
export function starLine(s, level = null) {
  return `${s.name[(level ?? LEVEL) === 1 ? 1 : 0]}, ${distanceWords(s, level)}`;
}

// The bridge card's picture: the Sun in the middle, each star at its place on the flat map.
const MAX_LY = 12.6; // the map's edge, in light-years (Tau Ceti sits at 11.9)

/** Draw the flat map on a canvas context (w x h). Pure drawing: no state. */
export function drawStarMap(ctx, w, h, { level = null, reveal = 1 } = {}) {
  const cx = w / 2; const cy = h / 2;
  const s = Math.min(w, h) / 2 / MAX_LY * 0.86;
  ctx.fillStyle = '#05060c';
  ctx.fillRect(0, 0, w, h);
  // A faint backdrop of far stars (fixed positions, so the card is the same each time).
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.fillStyle = 'rgba(200,220,255,0.5)';
  for (let i = 0; i < 90; i++) ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
  // The Sun, with a soft glow.
  const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
  sunGlow.addColorStop(0, 'rgba(255,220,140,1)'); sunGlow.addColorStop(0.3, 'rgba(255,190,90,0.45)'); sunGlow.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = sunGlow; ctx.fillRect(cx - 34, cy - 34, 68, 68);
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = '#ffd98a'; ctx.textBaseline = 'middle';
  ctx.fillText((level ?? LEVEL) === 1 ? 'Our Sun' : 'The Sun', cx + 12, cy + 2);
  const n = NEIGHBOURS.length;
  NEIGHBOURS.forEach((st, i) => {
    if (i + 1 > reveal * n + 1e-6) return; // revealed one by one in the cutscene; the card shows all
    const [x, , z] = starPlace(st);
    const px = cx + x * s; const py = cy + z * s;
    if (st.target) {
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,210,74,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(px - 24, py); ctx.stroke();
    }
    const col = `#${st.colour.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, st.target ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${st.target ? 800 : 600} 15px system-ui, sans-serif`;
    ctx.fillStyle = st.target ? '#ffd24a' : '#e6eefc';
    const text = starLine(st, level).replace(', ', '\n');
    const [l1, l2] = text.split('\n');
    const side = px > cx ? 1 : -1;
    ctx.textAlign = side > 0 ? 'left' : 'right';
    ctx.fillText(st.target ? `${l1}: ${TARGET_WORD}` : l1, px + side * 16, py - 8);
    ctx.fillStyle = 'rgba(200,215,240,0.85)'; ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(l2, px + side * 16, py + 9);
  });
  ctx.textAlign = 'left';
}

/** Words for the 2-D card and the cutscene caption. */
const TEXT = {
  eyebrow: t('Bridge · Echo’s star map', 'The bridge · star map'),
  title: t('Our star neighbours', 'Our star neighbours'),
  tip: t(
    'Each dot is a star near the Sun. The distances are real: light takes that many years to get there. Tau Ceti is our target.',
    'Each dot is a star near us. The numbers say how many years the light takes. Tau Ceti is our target!',
  ),
  caption: t(
    'Tau Ceti is a Sun-like star, 11.9 light-years away. It may have planets, and one day we might look for life there. Nobody knows yet if anything lives there.',
    'Tau Ceti is a star like our Sun, about 12 light-years away. It may have planets. One day we might look for life there. Nobody knows yet!',
  ),
  done: t('Got it!', 'Got it!'),
};
export const STAR_MAP_CAPTION = TEXT.caption;
const TARGET_WORD = t('our target', 'the target!');

const CSS_ID = 'ch7-starmap-css';
const CSS = `
.c7-map-canvas { display: block; width: 100%; max-width: 640px; height: auto; margin: 10px auto 0; border-radius: 14px; background: #05060c; }
.c7-map-tip { font-size: 15px; line-height: 1.45; color: #cfe8ff; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CSS_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * The bridge's star map card (a 2-D picture), over the walk. Resolves when she
 * presses Done. Test hook while open: window.__starMap = { close() }.
 * @param {{ bus?: object }} [opts] the game bus (pauses the game while a card is up)
 * @returns {Promise<void>}
 */
export function playStarMap({ bus = null } = {}) {
  injectStyles(); injectCss();
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'ch7-star-map';
  const eyebrow = el('div', 'pl-eyebrow', TEXT.eyebrow);
  eyebrow.style.color = '#c9a6ff';
  const title = el('h2', 'pl-title', TEXT.title);
  const tip = el('p', 'c7-map-tip', TEXT.tip);
  const canvas = el('canvas', 'c7-map-canvas');
  canvas.width = 800; canvas.height = 450;
  drawStarMap(canvas.getContext('2d'), 800, 450, { level: null });
  const caption = el('p', 'ls-line', TEXT.caption);
  const actions = el('div', 'ls-actions');
  const doneBtn = el('button', 'ls-btn is-ready', TEXT.done); doneBtn.type = 'button';
  actions.append(el('div', 'ls-dots'), doneBtn);
  card.append(eyebrow, title, tip, canvas, caption, actions);

  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) { if (e.key === 'Enter' && document.activeElement === doneBtn) finish(); },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  function finish() {
    if (closed) return;
    closed = true;
    layer.close();
    if (window.__starMap === api) delete window.__starMap;
    finishFn();
  }
  doneBtn.addEventListener('click', finish);
  const api = { get open() { return !closed; }, close: finish };
  window.__starMap = api;
  // Unlock mode only: a grown-up can skip the card.
  const skip = skipButton(finish, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  doneBtn.focus();
  return done;
}

// --- the 3-D map (the opening's end) ------------------------------------------------

function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d');
  const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/**
 * The 3-D star map: the Sun at the origin, the five neighbours at their real
 * places (1 unit = 1 light-year), Tau Ceti ringed, and a faint backdrop of far
 * stars. Labels are HTML laid over the picture and follow the camera.
 * update(camera, reveal, time) reveals the stars one by one (reveal 0..1) and
 * turns the ring to face the camera. dispose() removes everything.
 * @returns {{ group: THREE.Group, update: Function, dispose: Function, positions: THREE.Vector3[] }}
 */
export function buildStarMap3D() {
  const group = new THREE.Group();
  const tex = glowTexture();
  const disposables = [tex];
  const add = (geo, mat) => { disposables.push(geo, mat); return new THREE.Mesh(geo, mat); };
  // The Sun: a bright ball, bloomed by its colour above the threshold.
  const sun = add(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(2) }));
  group.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffc860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  disposables.push(sunGlow.material);
  sunGlow.scale.setScalar(3.4);
  group.add(sunGlow);

  const stars = NEIGHBOURS.map((st) => {
    const p = new THREE.Vector3(...starPlace(st));
    const mesh = add(new THREE.SphereGeometry(st.target ? 0.3 : 0.24, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(st.colour).multiplyScalar(1.7) }));
    mesh.position.copy(p);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: st.colour, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    disposables.push(glow.material);
    glow.scale.setScalar(st.target ? 2.4 : 1.8);
    glow.position.copy(p);
    group.add(mesh, glow);
    const label = document.createElement('div');
    label.className = 'c7-star-label';
    label.style.cssText = 'position:fixed;left:0;top:0;z-index:41;pointer-events:none;white-space:nowrap;'
      + 'font:700 15px system-ui,sans-serif;color:#fff7ea;text-shadow:0 2px 12px rgba(0,0,0,.9);opacity:0;transition:opacity .7s ease;'
      + `color:${st.target ? '#ffd24a' : '#fff7ea'}`;
    const l1 = document.createElement('div'); l1.textContent = st.target ? `${st.name[0]}: ${TARGET_WORD}` : st.name[0];
    const l2 = document.createElement('div'); l2.style.cssText = 'font-weight:500;font-size:13px;color:#cfe0ff'; l2.textContent = distanceWords(st);
    label.append(l1, l2);
    document.body.appendChild(label);
    return { st, p, label, mesh, glow };
  });

  // The target's ring, turned to face the camera each frame.
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd24a).multiplyScalar(1.6), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(1.05, 1.22, 72);
  const ring = add(ringGeo, ringMat);
  const target = stars[stars.length - 1];
  ring.position.copy(target.p);
  ring.visible = false;
  group.add(ring);

  // A faint line from the Sun to the target.
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), target.p]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.4, depthWrite: false });
  const line = new THREE.Line(lineGeo, lineMat);
  disposables.push(lineGeo, lineMat);
  line.visible = false;
  group.add(line);

  // The backdrop: far stars on a big shell, small and dim so they stay calm.
  const N = 220;
  const bgPos = new Float32Array(N * 3);
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const z = 2 * rnd() - 1; const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - z * z); const r = 90 + rnd() * 60;
    bgPos.set([r * s * Math.cos(a), r * z, r * s * Math.sin(a)], i * 3);
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  const bgMat = new THREE.PointsMaterial({ color: new THREE.Color(0xbfd6ff).multiplyScalar(0.9), size: 0.9, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false });
  const bg = new THREE.Points(bgGeo, bgMat);
  disposables.push(bgGeo, bgMat);
  group.add(bg);

  const v = new THREE.Vector3();
  return {
    group,
    positions: stars.map((s) => s.p),
    /** reveal: 0..1, the stars appear one by one; time: seconds, for the ring's pulse. */
    update(camera, reveal, time) {
      const w = window.innerWidth; const h = window.innerHeight;
      const shown = Math.floor(Math.min(1, Math.max(0, reveal)) * stars.length + 1e-6);
      // Every label follows its star, shown or not (the camera keeps moving after the reveal).
      stars.forEach((s, i) => {
        s.label.style.opacity = i < shown ? '1' : '0';
        v.copy(s.p).project(camera);
        const x = (v.x * 0.5 + 0.5) * w; const y = (-v.y * 0.5 + 0.5) * h;
        s.label.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y - 30)}px)`;
        s.label.style.display = v.z > 1 ? 'none' : '';
      });
      const revealed = shown >= stars.length;
      ring.visible = revealed; line.visible = revealed;
      if (revealed) {
        ring.quaternion.copy(camera.quaternion);
        ring.scale.setScalar(1 + 0.05 * Math.sin(time * 3));
      }
    },
    dispose() {
      for (const s of stars) s.label.remove();
      group.removeFromParent();
      for (const d of disposables) d.dispose?.();
    },
  };
}
