// Space pool (Chapter 5, in the Kuiper belt): a top-down momentum game on
// the lesson card's stage. Rules in poolLogic.js.
//
// Mouse or finger: press on a cue rock, pull back, let go (further = harder).
// Keys: Tab picks the cue rock, left/right aim, up/down power, Space flicks.
// Bumps play in slow motion with an arrow on every rock for its momentum and
// one for the total, which never changes.
//
// Opens in the play-mode modal layer, like the lesson card, and pauses the
// space game through the bus's 'ui-modal'. Test hook while open:
// window.__pool = { open, state(), autoShot(), solveAll() }.
import { el, openLayer } from '../../play/ui.js';
import { t } from '../level.js';
import { nightSky, label, arrow, circle, STAGE_W, STAGE_H } from '../../lesson/draw.js';
import { POOL_LEVELS, createPool, shoot, stepPool, runShot, bestShot, momentum } from './poolLogic.js';

const STEP = 1 / 120;
const TAU = Math.PI * 2;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

function rock(ctx, r, { gold = false, cue = false, picked = false }) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU;
    const rr = r.r * (0.82 + 0.18 * Math.sin(i * 2.3 + r.m * 1.7));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = gold ? '#ffd27a' : cue ? '#dfeaf3' : '#a9b6c4';
  ctx.fill();
  ctx.lineWidth = picked ? 4 : 2;
  ctx.strokeStyle = picked ? '#7ff3ff' : 'rgba(20,30,50,0.6)';
  ctx.stroke();
  ctx.restore();
  label(ctx, `${r.m}`, r.x, r.y, { size: 13, color: '#1d2433', halo: null });
}

/**
 * Play every level in turn.
 * @returns {Promise<{shots:number, levels:number}>}
 */
export function playPool({ bus = null } = {}) {
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'space-pool';
  const eyebrow = el('div', 'pl-eyebrow');
  const title = el('h2', 'pl-title');
  const canvas = el('canvas', 'ls-canvas');
  canvas.style.touchAction = 'none';
  const tip = el('p', 'ls-line');
  const status = el('div', 'ls-who');
  const actions = el('div', 'ls-actions');
  const dots = el('div', 'ls-dots');
  POOL_LEVELS.forEach(() => dots.appendChild(el('span', 'ls-dot')));
  const resetBtn = el('button', 'ls-btn ls-btn--ghost', `↻ ${t('Start again', 'Try again')}`);
  resetBtn.type = 'button';
  actions.append(dots, status, resetBtn);
  card.append(eyebrow, title, canvas, tip, actions);

  let ix = 0;
  let pool = createPool(0);
  let cueId = pool.rocks.find((r) => r.cue).id;
  let aim = 0; let power = 0.6;
  let drag = null; // {x, y} while pulling back
  let slow = 0; // real seconds of slow motion left
  let acc = 0;
  let banner = ''; let bannerT = 0;
  let totalShots = 0;
  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });

  const layer = openLayer(card, {
    onKey(e) {
      if (pool.moving) return;
      if (e.key === 'Tab') { e.preventDefault(); nextCue(); } else if (e.key === 'ArrowLeft') aim -= 0.05;
      else if (e.key === 'ArrowRight') aim += 0.05;
      else if (e.key === 'ArrowUp') power = Math.min(1, power + 0.05);
      else if (e.key === 'ArrowDown') power = Math.max(0.1, power - 0.05);
      else if (e.key === ' ') { e.preventDefault(); fire(); }
    },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }

  function setLevel(i) {
    ix = i;
    pool = createPool(i);
    cueId = pool.rocks.find((r) => r.cue).id;
    const gold = pool.rocks.find((r) => r.target);
    const cue = pool.rocks.find((r) => r.id === cueId);
    aim = Math.atan2(gold.y - cue.y, gold.x - cue.x);
    eyebrow.textContent = `${t('Space pool', 'Space pool')} · ${i + 1} of ${POOL_LEVELS.length}`;
    title.textContent = pick(pool.level.title);
    tip.textContent = pick(pool.level.tip);
    [...dots.children].forEach((d, k) => { d.className = `ls-dot${k < i ? ' is-done' : k === i ? ' is-active' : ''}`; });
    banner = ''; slow = 0;
  }
  function nextCue() {
    const cues = pool.rocks.filter((r) => r.cue && !r.lost && !r.netted);
    const k = cues.findIndex((r) => r.id === cueId);
    cueId = cues[(k + 1) % cues.length].id;
  }
  function fire(rockId = cueId, angle = aim, pw = power) {
    if (shoot(pool, rockId, angle, pw)) { totalShots++; banner = ''; }
  }
  resetBtn.addEventListener('click', () => setLevel(ix));

  // Mouse/finger: press on a cue rock, pull back, release.
  const toStage = (e) => {
    const b = canvas.getBoundingClientRect();
    const s = Math.min(b.width / STAGE_W, b.height / STAGE_H);
    const ox = (b.width - STAGE_W * s) / 2; const oy = (b.height - STAGE_H * s) / 2;
    return { x: (e.clientX - b.left - ox) / s, y: (e.clientY - b.top - oy) / s };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (pool.moving) return;
    const p = toStage(e);
    const hit = pool.rocks.find((r) => r.cue && !r.lost && Math.hypot(r.x - p.x, r.y - p.y) < r.r + 14);
    if (!hit) return;
    cueId = hit.id;
    drag = p;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toStage(e); const r = pool.rocks.find((x) => x.id === cueId);
    const dx = r.x - p.x; const dy = r.y - p.y;
    if (Math.hypot(dx, dy) > 6) { aim = Math.atan2(dy, dx); power = Math.min(1, Math.hypot(dx, dy) / 160); }
  });
  canvas.addEventListener('pointerup', () => { if (drag) { drag = null; fire(); } });

  function onEvents(ev) {
    for (const e of ev) {
      if (e.type === 'bump') slow = 0.8;
      if (e.type === 'net' && pool.rocks.find((r) => r.id === e.id)?.target) { banner = t('In the net!', 'In the net!'); bannerT = 0; }
      if (e.type === 'still' && pool.lostAll) { banner = t('Missed! Have another go.', 'Try again!'); bannerT = 0; }
    }
  }

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 860; const H = canvas.clientHeight || 420;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    ctx.setTransform(s, 0, 0, s, (canvas.width - STAGE_W * s) / 2, (canvas.height - STAGE_H * s) / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, STAGE_W, STAGE_H); ctx.clip();
    nightSky(ctx, 61 + ix);
    // The net.
    const { net } = pool.level;
    ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#9fe8a8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(net.x, net.y, net.r, 0, TAU); ctx.stroke(); ctx.restore();
    label(ctx, t('net', 'net'), net.x, net.y + net.r + 14, { size: 14, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
    // Rocks and their momentum arrows.
    for (const r of pool.rocks) {
      if (r.lost) continue;
      rock(ctx, r, { gold: r.target, cue: r.cue, picked: r.id === cueId && !pool.moving });
      if (pool.moving && Math.hypot(r.vx, r.vy) > 2) arrow(ctx, r.x, r.y, r.x + r.vx * r.m * 0.25, r.y + r.vy * r.m * 0.25, r.target ? '#ffb347' : '#7fd3ff', 4);
    }
    // Aim line and power while she lines up.
    if (!pool.moving && !pool.won && pool.shotsLeft > 0) {
      const r = pool.rocks.find((x) => x.id === cueId);
      if (r && !r.lost) {
        ctx.save(); ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(127,243,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(aim) * 220, r.y + Math.sin(aim) * 220); ctx.stroke(); ctx.restore();
        arrow(ctx, r.x, r.y, r.x + Math.cos(aim) * (r.r + 20 + 60 * power), r.y + Math.sin(aim) * (r.r + 20 + 60 * power), '#7ff3ff', 6);
      }
    }
    // The total momentum, in the corner: it never changes in a bump.
    const P = momentum(pool);
    label(ctx, t('Total momentum', 'Total push'), 700, 360, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    if (Math.hypot(P.x, P.y) > 4) arrow(ctx, 700, 400, 700 + P.x * 0.12, 400 + P.y * 0.12, '#ffffff', 6);
    else circle(ctx, 700, 400, 4, '#ffffff');
    if (slow > 0) label(ctx, '◀◀ slow motion', 90, 24, { size: 15, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
    label(ctx, `${t('Flicks left', 'Shots left')}: ${pool.shotsLeft}`, 700, 24, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    if (banner) label(ctx, banner, 400, 225, { size: 40, color: pool.won ? '#9fe8a8' : '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    advance(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function advance(dt) {
    const rate = slow > 0 ? 0.3 : 1;
    slow = Math.max(0, slow - dt);
    acc += dt * rate;
    while (acc >= STEP) { acc -= STEP; onEvents(stepPool(pool, STEP)); }
    if (banner) bannerT += dt;
    if (pool.won && bannerT > 1.4) {
      if (ix < POOL_LEVELS.length - 1) setLevel(ix + 1); else finish();
    } else if (pool.lostAll && bannerT > 1.4) setLevel(ix);
  }
  function finish() {
    if (closed) return;
    closed = true;
    layer.close();
    if (window.__pool === api) delete window.__pool;
    finishFn({ shots: totalShots, levels: POOL_LEVELS.length });
  }

  const api = {
    get open() { return !closed; },
    state() { return { level: ix, shotsLeft: pool.shotsLeft, moving: pool.moving, won: pool.won, rocks: pool.rocks.map((r) => ({ id: r.id, x: Math.round(r.x), y: Math.round(r.y) })) }; },
    /** One good shot, played out at once. */
    autoShot() { const b = bestShot(pool); fire(b.rockId, b.angle, b.power); onEvents(runShot(pool)); bannerT = 9; advance(0); return this.state(); },
    /** Clear every level with good shots (tests). */
    solveAll() { for (let k = 0; k < 40 && !closed; k++) this.autoShot(); return closed; },
    shot() { draw(); return canvas.toDataURL('image/png'); },
  };
  window.__pool = api;
  setLevel(0);
  requestAnimationFrame(frame);
  return done;
}
