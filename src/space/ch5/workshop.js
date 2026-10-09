// The engine half of the rock ship (Chapter 5, Part D): five stations in one
// card. Mine the rock (hold), make fusion fuel from its ice (hold), print the
// engine's magnet rings from its metal (press), fit them (press), then the
// test fire. Chapter 6 builds the other half (the home inside).
//
// The fuel: about 1 hydrogen atom in every 6,400 in water is "heavy"
// hydrogen (deuterium), the fuel a fusion engine burns.
//
// Opens in the play-mode modal layer; pauses the space game through the
// bus's 'ui-modal'. Test hook: window.__workshop = { open, state(), solve() }.
import { el, openLayer } from '../../play/ui.js';
import { t } from '../level.js';
import { injectStyles } from '../../lesson/card.js';
import { label, circle, rect, arrow, nightSky, span, lerp, STAGE_W, STAGE_H } from '../../lesson/draw.js';
import { skipButton } from '../../play/grownUp.js';

const TAU = Math.PI * 2;

export const STATIONS = [
  { id: 'mine', kind: 'hold', secs: 3, title: ['1. Mine the rock', '1. Dig'], tip: ['Hold the button (or Space) to drill. Out come ice and metal.', 'Hold the button to dig.'], btn: ['Hold to drill', 'Hold to dig'] },
  { id: 'fuel', kind: 'hold', secs: 3, title: ['2. Make fusion fuel', '2. Make fuel'], tip: ['Melt the ice and sort the water: about 1 hydrogen in 6,400 is heavy hydrogen, the fusion fuel. Hold to spin the sorter.', 'Hold to make fuel from the ice.'], btn: ['Hold to sort', 'Hold'] },
  { id: 'parts', kind: 'press', count: 4, title: ['3. Print the magnet rings', '3. Make parts'], tip: ['The metal becomes four giant magnet rings. They hold the fuel, hotter than the Sun, without touching it.', 'Press to make 4 rings from the metal.'], btn: ['Print a ring', 'Make a ring'] },
  { id: 'fit', kind: 'press', count: 4, title: ['4. Fit the drive', '4. Fit the engine'], tip: ['Fit each ring onto the engine at the back of the ship.', 'Press to fit each ring.'], btn: ['Fit next ring', 'Fit a ring'] },
  { id: 'fire', kind: 'press', count: 1, title: ['5. Test fire!', '5. Test it!'], tip: ['Everyone clear? Fire the engine for a few seconds.', 'Fire the engine!'], btn: ['🔥 Fire!', '🔥 Fire!'] },
];

function rockShape(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU; const k = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 6);
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); else ctx.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  ctx.closePath();
  ctx.fillStyle = '#9a8f84'; ctx.fill(); ctx.strokeStyle = 'rgba(20,30,50,0.6)'; ctx.lineWidth = 3; ctx.stroke();
}

/** One station's picture; k = its progress 0..1, T = seconds. */
function drawStation(ctx, id, k, T, fireT) {
  nightSky(ctx, 89);
  if (id === 'mine') {
    rockShape(ctx, 470, 230, 260, 170);
    const depth = k * 120;
    rect(ctx, 210 + depth * 0.2, 215, 70 + depth, 30, 'rgba(30,25,20,0.8)', 6);
    rect(ctx, 120, 220, 110 + depth, 20, '#c9d1dc', 4);
    for (let i = 0; i < 8; i++) if (k > 0 && k < 1) circle(ctx, 200 - ((T * 120 + i * 30) % 160), 230 + Math.sin(i * 3 + T * 9) * 20, 4, i % 2 ? '#e3eef7' : '#8a8f99');
    label(ctx, `💧 ${t('ice', 'ice')}: ${Math.round(k * 120)} t`, 140, 380, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
    label(ctx, `⚙ ${t('metal', 'metal')}: ${Math.round(k * 40)} t`, 330, 380, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  } else if (id === 'fuel') {
    // Water molecules stream into a spinning sorter; heavy hydrogen comes out.
    circle(ctx, 400, 220, 90, '#1b3d63', '#7fd3ff', 4);
    ctx.save(); ctx.translate(400, 220); ctx.rotate(T * (2 + k * 10));
    for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); rect(ctx, 10, -4, 70, 8, '#7fd3ff', 3); }
    ctx.restore();
    for (let i = 0; i < 10; i++) {
      const x = ((T * 80 + i * 32) % 300) + 20;
      circle(ctx, x * 0.9, 220 + Math.sin(i) * 30, 8, '#ff5d5d'); circle(ctx, x * 0.9 - 9, 228 + Math.sin(i) * 30, 5, '#f4f7fb'); circle(ctx, x * 0.9 + 9, 228 + Math.sin(i) * 30, 5, '#f4f7fb');
    }
    rect(ctx, 560, 300 - 160 * k, 60, 160 * k, '#9fe8ff', 4);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(560, 140, 60, 160);
    label(ctx, t('heavy hydrogen', 'fuel'), 590, 330, { size: 16, color: '#9fe8ff', halo: 'rgba(0,0,0,0.6)' });
    label(ctx, t('1 in 6,400 hydrogens is heavy', '1 in 6,400 is fuel'), 400, 400, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  } else if (id === 'parts') {
    const n = Math.round(k * 4);
    rect(ctx, 80, 160, 160, 140, '#3a4a60', 10);
    label(ctx, t('printer', 'printer'), 160, 320, { size: 16, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.strokeStyle = '#c0c8d4'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.ellipse(330 + i * 110, 230, 26, 70, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    label(ctx, `${n} / 4 ${t('magnet rings', 'rings')}`, 500, 380, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  } else if (id === 'fit' || id === 'fire') {
    const n = id === 'fit' ? Math.round(k * 4) : 4;
    const shake = id === 'fire' && fireT > 0 ? Math.sin(T * 60) * 2 : 0;
    const go = id === 'fire' ? span(fireT, 3, 7) : 0;
    const dx = go * go * 120;
    rockShape(ctx, 500 + dx + shake, 225, 230, 150);
    // engine at the back (left)
    ctx.fillStyle = '#9fb3c8'; ctx.beginPath(); ctx.moveTo(290 + dx, 195); ctx.lineTo(230 + dx, 170); ctx.lineTo(230 + dx, 280); ctx.lineTo(290 + dx, 255); ctx.closePath(); ctx.fill();
    for (let i = 0; i < n; i++) {
      const x = id === 'fit' && i === n - 1 ? lerp(160, 250 + i * 10, span(k * 4 - i, 0, 1)) : 250 + i * 10;
      ctx.save(); ctx.strokeStyle = '#c0c8d4'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x + dx, 225, 8, 44, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (id === 'fire' && fireT > 0) {
      if (fireT < 3) label(ctx, String(3 - Math.floor(fireT)), 400, 80, { size: 48, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
      const fl = span(fireT, 3, 3.6) * (0.85 + 0.15 * Math.sin(T * 30));
      if (fl > 0) {
        const g = ctx.createLinearGradient(230 + dx, 0, 230 + dx - 260 * fl, 0);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#9fe8ff'); g.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(230 + dx, 180); ctx.lineTo(230 + dx - 260 * fl, 225); ctx.lineTo(230 + dx, 270); ctx.closePath(); ctx.fill();
        arrow(ctx, 160 + dx, 360, 60 + dx, 360, '#9fe8ff', 6); label(ctx, t('gas goes back', 'gas back'), 110 + dx, 390, { size: 15, color: '#9fe8ff', halo: 'rgba(0,0,0,0.6)' });
        arrow(ctx, 600 + dx, 360, 700 + dx, 360, '#9fe8a8', 6); label(ctx, t('ship goes forward', 'ship forward'), 650 + dx, 390, { size: 15, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
      }
      if (fireT > 7) label(ctx, t('It works!', 'It works!'), 400, 80, { size: 40, color: '#9fe8a8', halo: 'rgba(0,0,0,0.7)' });
    }
  }
}

/** @returns {Promise<{stations:number}>} */
export function playWorkshop({ bus = null } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'workshop';
  const eyebrow = el('div', 'pl-eyebrow', t('Build the engine', 'Build the engine'));
  const title = el('h2', 'pl-title');
  const canvas = el('canvas', 'ls-canvas');
  const tip = el('p', 'ls-line');
  const actions = el('div', 'ls-actions');
  const dots = el('div', 'ls-dots');
  STATIONS.forEach(() => dots.appendChild(el('span', 'ls-dot')));
  const doBtn = el('button', 'ls-btn'); doBtn.type = 'button';
  const nextBtn = el('button', 'ls-btn', 'Next'); nextBtn.type = 'button'; nextBtn.hidden = true;
  actions.append(dots, doBtn, nextBtn);
  card.append(eyebrow, title, canvas, tip, actions);

  let ix = 0; let k = 0; let holding = false; let fireT = 0; let T = 0;
  let closed = false; let finishFn;
  const promise = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) {
      if (e.key === ' ') { e.preventDefault(); if (STATIONS[ix].kind === 'hold') holding = e.type !== 'keyup'; else if (e.type !== 'keyup') press(); }
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && !nextBtn.hidden) { e.preventDefault(); next(); }
    },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  const up = () => { holding = false; };
  window.addEventListener('keyup', up);
  doBtn.addEventListener('pointerdown', () => { if (STATIONS[ix].kind === 'hold') holding = true; else press(); });
  doBtn.addEventListener('pointerup', up);
  doBtn.addEventListener('pointerleave', up);
  nextBtn.addEventListener('click', next);

  function setStation(i) {
    ix = i; k = 0; holding = false; fireT = 0;
    const s = STATIONS[i];
    title.textContent = t(s.title[0], s.title[1]);
    tip.textContent = t(s.tip[0], s.tip[1]);
    doBtn.textContent = t(s.btn[0], s.btn[1]); doBtn.hidden = false; doBtn.disabled = false;
    nextBtn.hidden = true;
    [...dots.children].forEach((d, j) => { d.className = `ls-dot${j < i ? ' is-done' : j === i ? ' is-active' : ''}`; });
  }
  function press() {
    const s = STATIONS[ix];
    if (s.kind !== 'press' || k >= 1) return;
    if (s.id === 'fire') { if (fireT === 0) fireT = 0.001; doBtn.disabled = true; return; }
    k = Math.min(1, k + 1 / s.count);
    if (k >= 1) stationDone();
  }
  function stationDone() {
    doBtn.hidden = true;
    nextBtn.textContent = ix === STATIONS.length - 1 ? t('Done!', 'Done!') : 'Next';
    nextBtn.hidden = false; nextBtn.classList.add('is-ready');
  }
  function next() { if (ix < STATIONS.length - 1) setStation(ix + 1); else finish(); }
  function finish() {
    if (closed) return;
    closed = true; layer.close(); window.removeEventListener('keyup', up);
    if (window.__workshop === api) delete window.__workshop;
    finishFn({ stations: STATIONS.length });
  }

  let last = performance.now();
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; T += dt;
    advance(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function advance(dt) {
    const s = STATIONS[ix];
    if (s.kind === 'hold' && holding && k < 1) { k = Math.min(1, k + dt / s.secs); if (k >= 1) stationDone(); }
    if (s.id === 'fire' && fireT > 0 && k < 1) { fireT += dt; if (fireT > 8) { k = 1; stationDone(); } }
  }
  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 860; const H = canvas.clientHeight || 420;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sc = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    ctx.setTransform(sc, 0, 0, sc, (canvas.width - STAGE_W * sc) / 2, (canvas.height - STAGE_H * sc) / 2);
    drawStation(ctx, STATIONS[ix].id, k, T, fireT);
    // progress bar
    rect(ctx, 250, 425, 300, 10, 'rgba(255,255,255,0.15)', 5); rect(ctx, 250, 425, 300 * k, 10, '#9fe8a8', 5);
  }

  const api = {
    get open() { return !closed; },
    state() { return { station: STATIONS[ix].id, progress: +k.toFixed(2), fireT: +fireT.toFixed(1) }; },
    /** Do every station at once (tests). */
    solve() { for (let j = ix; j < STATIONS.length; j++) { setStation(j); k = 1; fireT = 8.5; } finish(); return true; },
    /** Hold (or press) the current station's button for `sec` seconds of play. */
    work(sec = 4) { const s = STATIONS[ix]; if (s.kind === 'hold') { holding = true; advance(sec); holding = false; } else { for (let j = 0; j < (s.count || 1); j++) press(); if (s.id === 'fire') advance(sec); } draw(); return this.state(); },
    next() { next(); return closed ? 'finished' : this.state(); },
    shot() { draw(); return canvas.toDataURL('image/png'); },
  };
  window.__workshop = api;
  // Unlock mode only: a grown-up can skip this game.
  const skip = skipButton(() => api.solve(), 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  setStation(0);
  requestAnimationFrame(frame);
  return promise;
}
