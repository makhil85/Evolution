// Fly the slingshots (Chapter 6, Part E, steps 15-16): the planned route
// plays out one flyby at a time, seen from the planet. Near each closest
// point time slows right down and a timing bar appears (like Chapter 4's
// BURN NOW): a press in the green keeps the boost (gold middle = all of it),
// a miss keeps half. After the press the planet visibly shifts back (hugely
// exaggerated, with a note) and two momentum bars show what the planet lost
// and the ship gained: the Space pool rule at planet size. The side list
// shows each flyby's gain and the running total speed.
//
// The last stop is the Sun dive: a plain swing round the Sun adds nothing,
// so the press there FIRES THE DRIVE at the closest point (lesson 6B film 3).
// The Sun does not shift.
//
// Keys: Space (or the button) presses. Opens in the play-mode modal layer
// and pauses space through the bus's 'ui-modal'. Sums in routes.js
// (keptFraction, windowFor, flightResult). Test hook while open:
// window.__sling = { open, state(), solve() }  (solve presses perfectly at every stop).
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { nightSky, label, circle, rect, line, arrow, STAGE_W, STAGE_H } from '../../lesson/draw.js';
import { STOPS, routeById, planTotals, windowFor, keptFraction, flightResult } from './routes.js';
import { skipButton } from '../../play/grownUp.js';
import { FLIGHT_MODE_KEY } from '../contracts.js';

/** The flying mode she chose (space main.js saves it under FLIGHT_MODE_KEY); Medium if none. */
function flyingMode() {
  try { return localStorage.getItem(FLIGHT_MODE_KEY) || 'medium'; } catch { return 'medium'; }
}

const TAU = Math.PI * 2;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

// One flyby's timeline, in real seconds: approach, slow motion (the timing
// bar sweeps; the closest point is in the middle), then out and the result.
const APPROACH = 2.2; const SLOW = 4; const AFTER = 3.2;
const LEG_LEN = APPROACH + SLOW + AFTER;
const CENTRE = APPROACH + SLOW / 2;

/** Position along the swing (planet frame). tau 0.5 is the closest point. */
function swing(tau, gap) {
  // A quadratic curve: in going up on the planet's trailing (left) side,
  // out going right, the way the planet moves. Scaled by the flyby distance.
  // The corner sits so the middle of the curve (0.25 P0 + 0.5 P1 + 0.25 P2)
  // is `gap` from the planet's centre, on the diagonal.
  const L = 230; const g = (L / 4 + gap * Math.SQRT1_2) / 0.75; const leg = L + g;
  const P0 = { x: -g, y: L }; const P1 = { x: -g, y: -g }; const P2 = { x: L, y: -g };
  if (tau <= 0) return { x: P0.x, y: P0.y - leg * 2 * tau, ang: -Math.PI / 2 };
  if (tau >= 1) return { x: P2.x + leg * 2 * (tau - 1), y: P2.y, ang: 0 };
  const a = (1 - tau) ** 2; const b = 2 * (1 - tau) * tau; const c = tau * tau;
  const dx = (1 - tau) * (P1.x - P0.x) + tau * (P2.x - P1.x);
  const dy = (1 - tau) * (P1.y - P0.y) + tau * (P2.y - P1.y);
  return { x: a * P0.x + b * P1.x + c * P2.x, y: a * P0.y + b * P1.y + c * P2.y, ang: Math.atan2(dy, dx) };
}
/** Leg time (s) -> position along the swing: fast in, slow at the middle, fast out. */
function tauAt(L) {
  if (L < APPROACH) return -0.55 + (0.85 * L) / APPROACH; // -> 0.3
  if (L < APPROACH + SLOW) return 0.3 + (0.4 * (L - APPROACH)) / SLOW; // -> 0.7
  return 0.7 + (0.9 * (L - APPROACH - SLOW)) / AFTER;
}

function shipDart(ctx, x, y, ang, flame, T) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (flame) {
    ctx.fillStyle = '#ffb03b';
    const fl = 26 + 6 * Math.sin(T * 40);
    ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(-9 - fl, 0); ctx.lineTo(-9, 6); ctx.closePath(); ctx.fill();
  }
  // The rock ship, side on: a lumpy grey rock with the drive behind.
  ctx.fillStyle = '#a9a39a';
  ctx.beginPath(); ctx.ellipse(2, 0, 13, 9, 0, 0, TAU); ctx.fill();
  rect(ctx, -12, -4, 6, 8, '#7fd3ff', 2);
  ctx.restore();
}

function planet(ctx, id, x, y, r) {
  if (id === 'sun') {
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.7);
    g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc34d'); g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, TAU); ctx.fill();
    return;
  }
  circle(ctx, x, y, r, STOPS[id].color, 'rgba(255,255,255,0.5)', 2);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ctx.globalAlpha = 0.18;
  for (const k of [-0.5, -0.1, 0.35]) rect(ctx, x - r, y + k * r, r * 2, r * 0.12, '#ffffff');
  ctx.restore();
  if (id === 'saturn') {
    ctx.save(); ctx.strokeStyle = '#f3e2b8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.5, -0.2, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

/**
 * Fly the planned route.
 * @param {{bus?:any, plan:{route:string, close:number[]}}} opts
 * @returns {Promise<{route:string, legs:object[], kept:number, speed:number}>}
 */
export function playSlingshots({ bus = null, plan, mode = flyingMode() }) {
  injectStyles();
  const route = routeById(plan.route);
  const planned = planTotals(plan);
  // The stops she flies past (the opening burn and Jupiter's fling inward are not presses).
  const legs = planned.legs.filter((l) => l.id !== 'burn' && !l.fall);
  // Straight out: nothing to time, the burn is the whole route.
  if (!legs.length) return Promise.resolve({ route: plan.route, ...flightResult(plan, []) });
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'slingshots';
  const eyebrow = el('div', 'pl-eyebrow');
  const title = el('h2', 'pl-title');
  const canvas = el('canvas', 'ls-canvas');
  const view = el('div', 'ls-view');
  view.append(canvas);
  const tip = el('p', 'ls-line');
  const actions = el('div', 'ls-actions');
  const dots = el('div', 'ls-dots');
  legs.forEach(() => dots.appendChild(el('span', 'ls-dot')));
  const pressBtn = el('button', 'ls-btn', t('Press!', 'Press!'));
  pressBtn.type = 'button';
  actions.append(dots, pressBtn);
  card.append(eyebrow, title, view, tip, actions);

  let ix = 0; // which flyby
  let L = 0; // seconds into this flyby
  const errs = legs.map(() => undefined); // undefined = not pressed yet; null = missed
  let pressedAt = null;
  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });

  const layer = openLayer(card, {
    onKey(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  pressBtn.addEventListener('click', () => press());

  const isSun = () => legs[ix].id === 'sun';
  const hw = () => windowFor(legs[ix].close, mode);

  function startLeg(i) {
    ix = i; L = 0; pressedAt = null;
    const leg = legs[i];
    eyebrow.textContent = `${pick(route.title)} · ${i + 1} ${t('of', 'of')} ${legs.length}`;
    title.textContent = leg.id === 'sun' ? t('Dive past the Sun', 'Dive past the Sun') : `${t('Slingshot past', 'Fly past')} ${pick(STOPS[leg.id].name)}`;
    tip.textContent = leg.id === 'sun'
      ? t('A plain swing round the Sun adds nothing. Fire the drive at the closest point: press when the marker is in the gold!', 'Fire the engine closest to the Sun! Press in the gold.')
      : t(`Up to +${leg.energyGain} energy. Press when the marker is in the gold, right at the closest point.`, 'Press in the gold to get the most!');
    [...dots.children].forEach((d, k) => { d.className = `ls-dot${k < i ? ' is-done' : k === i ? ' is-active' : ''}`; });
    pressBtn.disabled = false;
  }

  /** Her press: counts once, only while the bar is up. */
  function press(at = L) {
    if (closed || errs[ix] !== undefined) return;
    if (at < APPROACH || at > APPROACH + SLOW) return;
    errs[ix] = (at - CENTRE) / hw();
    pressedAt = at;
    pressBtn.disabled = true;
  }

  function advance(dt) {
    L += dt;
    if (L > APPROACH + SLOW && errs[ix] === undefined) { errs[ix] = null; pressBtn.disabled = true; }
    if (L >= LEG_LEN) {
      if (ix < legs.length - 1) startLeg(ix + 1); else finish();
    }
  }

  function finish() {
    if (closed) return;
    closed = true;
    layer.close();
    if (window.__sling === api) delete window.__sling;
    const res = flightResult(plan, errs.map((e) => (e === undefined ? null : e)));
    finishFn({ route: plan.route, ...res });
  }

  // --- drawing -------------------------------------------------------------------------

  function drawLeg(ctx, T) {
    const leg = legs[ix];
    const sun = leg.id === 'sun';
    const R = sun ? 52 : leg.id === 'jupiter' ? 46 : leg.id === 'saturn' ? 40 : 32;
    const gap = R + 12 + (4 - leg.close) * 16;
    const cx = 300; const cy = 250;
    // The planet drifts back a little after the press (exaggerated); the Sun never.
    const after = errs[ix] != null && pressedAt != null ? Math.min(1, (L - pressedAt) / 1.2) : 0;
    const shift = sun ? 0 : -16 * after * keptFraction(errs[ix] ?? 2);
    const tau = tauAt(L);
    // dotted swing
    ctx.save(); ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(127,243,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = -0.55; k <= 1.6; k += 0.02) { const p = swing(k, gap); if (k === -0.55) ctx.moveTo(cx + p.x, cy + p.y); else ctx.lineTo(cx + p.x, cy + p.y); }
    ctx.stroke(); ctx.restore();
    if (shift) circle(ctx, cx, cy, R, null, 'rgba(255,255,255,0.35)', 1.5);
    planet(ctx, leg.id, cx + shift, cy, R);
    if (!sun) {
      arrow(ctx, cx + shift + R + 8, cy, cx + shift + R + 60, cy, '#9fe8a8', 5);
      label(ctx, t('moving', 'moving'), cx + shift + R + 34, cy + 20, { size: 13, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
    }
    label(ctx, pick(STOPS[leg.id].name), cx, cy + R + (sun ? 36 : 22), { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    const p = swing(tau, gap);
    const flame = sun && pressedAt != null && L - pressedAt < 1;
    shipDart(ctx, cx + p.x, cy + p.y, p.ang, flame, T);
    // slow motion and the timing bar
    const slow = L >= APPROACH && L <= APPROACH + SLOW;
    if (slow) label(ctx, '◀◀ slow motion', 80, 24, { size: 15, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
    if (L >= APPROACH - 0.3 && L <= APPROACH + SLOW + 1.2) {
      const bx = 60; const by = 400; const bw = 460;
      const k = (s) => bx + (bw * (s - APPROACH)) / SLOW;
      rect(ctx, bx, by, bw, 20, 'rgba(255,255,255,0.14)', 6);
      rect(ctx, k(CENTRE - hw()), by, k(CENTRE + hw()) - k(CENTRE - hw()), 20, 'rgba(159,232,168,0.65)', 6);
      rect(ctx, k(CENTRE - hw() * 0.25), by, k(CENTRE + hw() * 0.25) - k(CENTRE - hw() * 0.25), 20, '#ffd27a', 4);
      const mx = k(Math.min(APPROACH + SLOW, Math.max(APPROACH, pressedAt ?? L)));
      line(ctx, mx, by - 6, mx, by + 26, '#ffffff', 4);
      label(ctx, sun ? t('FIRE at the closest point', 'FIRE when it is gold') : t('PRESS at the closest point', 'PRESS when it is gold'), bx + bw / 2, by - 16, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    }
    // the result: kept boost, and (planets) momentum bars
    if (errs[ix] !== undefined && L > APPROACH + 0.2) {
      const kept = Math.round(leg.energyGain * keptFraction(errs[ix] ?? 2));
      const e = Math.abs(errs[ix] ?? 2);
      const word = errs[ix] == null ? t('Missed the moment: half of it', 'Missed! Half of it')
        : e <= 0.25 ? t('Perfect!', 'Perfect!') : e <= 1 ? t('Good!', 'Good!') : t('A bit off: half of it', 'A bit off!');
      label(ctx, `${word}  +${kept} ${t('energy', 'energy')}`, 300, 40, { size: 24, color: e <= 1 ? '#9fe8a8' : '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
      if (!sun && after > 0) {
        // Same height both sides: what the planet lost, the ship gained.
        const h = after * (24 + 56 * Math.min(1, kept / 350));
        const bx = 640; const by = 380;
        rect(ctx, bx, by - h, 26, h, '#7fd3ff', 4);
        rect(ctx, bx + 64, by - h, 26, h, '#9fe8a8', 4);
        label(ctx, t('ship +', 'ship +'), bx + 13, by + 16, { size: 12, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)' });
        label(ctx, t('planet −', 'planet −'), bx + 77, by + 16, { size: 12, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
        label(ctx, t('momentum', 'push'), bx + 45, by - 96, { size: 13, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
        label(ctx, t('(the planet’s drift is drawn far too big)', '(drawn much too big)'), 300, 72, { size: 13, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
      }
    }
  }

  /** The side list: each stop's energy, and the plan's speed far away. */
  function drawList(ctx) {
    const x = 590; let y = 40;
    rect(ctx, x - 12, 16, 216, 30 + 26 * (legs.length + 2), 'rgba(10,16,32,0.75)', 10);
    label(ctx, t('Energy stolen', 'Energy'), x, y, { size: 15, color: '#ffd27a', halo: null, align: 'left' });
    legs.forEach((leg, i) => {
      y += 26;
      const e = errs[i];
      const doneLeg = e !== undefined && (i < ix || L > APPROACH + 0.2);
      const kept = doneLeg ? Math.round(leg.energyGain * keptFraction(e ?? 2)) : null;
      const txt = `${pick(STOPS[leg.id].name)}: ${kept != null ? `+${kept}` : '…'}`;
      label(ctx, txt, x, y, { size: 14, color: i === ix ? '#ffffff' : '#cfe8ff', halo: null, align: 'left' });
    });
    y += 30;
    label(ctx, planned.speed > 0 ? `${t('Plan', 'Plan')}: ${planned.speed} km/s` : t('Plan: the Sun holds us', 'Plan: too slow'), x, y, { size: 15, color: '#9fe8a8', halo: null, align: 'left' });
  }

  function draw(T) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 860; const H = canvas.clientHeight || 420;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    ctx.setTransform(s, 0, 0, s, (canvas.width - STAGE_W * s) / 2, (canvas.height - STAGE_H * s) / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, STAGE_W, STAGE_H); ctx.clip();
    nightSky(ctx, 91 + ix);
    drawLeg(ctx, T);
    drawList(ctx);
    ctx.restore();
  }

  let last = performance.now();
  const t0 = last;
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    advance(dt);
    if (!closed) draw((now - t0) / 1000);
    requestAnimationFrame(frame);
  }

  const api = {
    get open() { return !closed; },
    state() { return { leg: ix, stop: legs[ix]?.id, L: Math.round(L * 100) / 100, errs: [...errs] }; },
    /** Press perfectly at every stop and play through at once (tests). */
    solve() {
      while (!closed) {
        if (errs[ix] === undefined) { L = CENTRE; press(CENTRE); }
        advance(LEG_LEN);
      }
      return true;
    },
    shot() { draw(0); return canvas.toDataURL('image/png'); },
  };
  window.__sling = api;
  // Unlock mode only: a grown-up can skip the flybys (perfect presses).
  const skip = skipButton(() => api.solve(), 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  startLeg(0);
  requestAnimationFrame(frame);
  return done;
}
