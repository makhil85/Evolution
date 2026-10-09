// The route planner (Chapter 6, Part E): how to leave the Sun's family as
// fast as possible, starting from the asteroid belt. A top-down map; five
// ready-made routes (straight out, three planet tours, Jupiter then a Sun
// dive) and, for each stop, how close she passes. Every change shows her
// speed once far from the Sun ("leaving at N km/s", or "the Sun still holds
// us") and the energy each stop added. Two rounds: first with 10 t of fuel,
// then with 100 t. She tries at least three routes in a round, then locks
// one in, and sees the fastest of all. Sums live in routes.js.
//
// Keys: 1-5 pick a route, left/right pick a stop, up/down closer/further,
// Enter locks in. Mouse: the buttons.
//
// Opens in the play-mode modal layer and pauses space through the bus's
// 'ui-modal'. Test hook while open:
// window.__route = { open, state(), pick(id), setClose(i, c), solve(), go() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { nightSky, label, circle, rect, line, STAGE_W } from '../../lesson/draw.js';
import {
  ROUTES, STOPS, FUELS, CLOSE_LEVELS, CLOSE_NAMES, SUN_PASS,
  routeById, newPlan, planTotals, bestPlan, fastestRoute, speedWords,
} from './routes.js';
import { skipButton } from '../../play/grownUp.js';

const TAU = Math.PI * 2;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);
/** Routes she must try in a round before she can lock one in. */
export const MIN_TRIED = 3;

/** The map: the Sun on the left, then the belt (start) and the four giants. */
const MAP = {
  sun: { x: 60, y: 230, r: 34 },
  belt: { x: 175, y: 230, r: 6 },
  jupiter: { x: 300, y: 230, r: 22 },
  saturn: { x: 420, y: 230, r: 19 },
  uranus: { x: 545, y: 230, r: 14 },
  neptune: { x: 660, y: 230, r: 14 },
};

function body(ctx, id, dim) {
  const m = MAP[id];
  ctx.save();
  ctx.globalAlpha = dim ? 0.4 : 1;
  if (id === 'sun') {
    const g = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.r * 1.6);
    g.addColorStop(0, '#fff6c8'); g.addColorStop(0.55, '#ffc34d'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.6, 0, TAU); ctx.fill();
  } else if (id === 'belt') {
    // A scatter of rocks, and the big belt rock she mined.
    for (let i = 0; i < 14; i++) circle(ctx, m.x + Math.sin(i * 2.3) * 14, m.y - 90 + i * 13, 2, '#9a8f80');
    circle(ctx, m.x, m.y, m.r, '#b8aa98', '#ffd27a', 2);
  } else {
    circle(ctx, m.x, m.y, m.r, STOPS[id].color, 'rgba(255,255,255,0.5)', 1.5);
    if (id === 'saturn') {
      ctx.strokeStyle = '#f3e2b8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * 1.9, m.r * 0.55, -0.25, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  const name = id === 'belt' ? t('Asteroid belt (start)', 'Belt (start)') : pick(STOPS[id].name);
  label(ctx, name, m.x, m.y + (id === 'belt' ? 110 : m.r + 18), { size: 14, color: '#e8eefc', halo: 'rgba(0,0,0,0.7)' });
}

/** The route as a dotted path; closer passes hug the planet. */
function drawRoute(ctx, plan, T) {
  const r = routeById(plan.route);
  const gapFor = (id, c) => MAP[id].r + 8 + (CLOSE_LEVELS - c) * (id === 'sun' ? 12 : 9);
  const pts = [{ x: MAP.belt.x, y: MAP.belt.y }];
  if (r.fall) {
    pts.push({ x: MAP.jupiter.x, y: MAP.jupiter.y - MAP.jupiter.r - 10 }); // out to Jupiter, flung back
    const g = gapFor('sun', plan.close[0]);
    pts.push({ x: MAP.sun.x - g * 0.4, y: MAP.sun.y + g }); // round the Sun
    pts.push({ x: 760, y: 420 }); // and away
  } else {
    r.stops.forEach((id, i) => { const g = gapFor(id, plan.close[i]); pts.push({ x: MAP[id].x - g * 0.3, y: MAP[id].y - g }); });
    pts.push({ x: 785, y: r.stops.length ? 120 - r.stops.length * 12 : 90 });
  }
  ctx.save();
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -T * 30;
  ctx.strokeStyle = '#7ff3ff'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 36, b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
  r.stops.forEach((id, i) => {
    const m = MAP[id];
    ctx.save(); ctx.strokeStyle = 'rgba(127,243,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, gapFor(id, plan.close[i]), 0, TAU); ctx.stroke(); ctx.restore();
  });
}

/** The speed far away, against the best she has found this round. */
function drawSpeed(ctx, tot, bestSoFar) {
  const x0 = 250; const w = 440; const max = 140; const y = 372;
  label(ctx, t('Speed far from the Sun', 'Speed leaving'), x0 - 10, y + 9, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'right' });
  rect(ctx, x0, y, w, 18, 'rgba(255,255,255,0.12)', 6);
  if (tot.speed > 0) rect(ctx, x0, y, (w * Math.min(1, tot.speed / max)), 18, '#9fe8a8', 6);
  else rect(ctx, x0, y, (w * Math.min(1, -tot.speed / max)), 18, '#ff8a8a', 6);
  if (bestSoFar > 0) {
    const bx = x0 + (w * Math.min(1, bestSoFar / max));
    line(ctx, bx, y - 6, bx, y + 24, '#ffd27a', 2);
    label(ctx, `${t('your best', 'best')} ${bestSoFar}`, bx, y - 14, { size: 12, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  }
  label(ctx, pick(speedWords(tot.speed)), x0 + w / 2, y + 44, { size: 18, color: tot.speed > 0 ? '#c8ffd0' : '#ffb0b0', halo: 'rgba(0,0,0,0.7)' });
}

/**
 * @returns {Promise<{rounds: {fuel:number, route:string, close:number[], speed:number, best:{route:string, speed:number}}[], plan:{route:string, fuel:number, close:number[]}}>}
 */
export function playRoutePlanner({ bus = null } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'route-planner';
  const eyebrow = el('div', 'pl-eyebrow');
  const title = el('h2', 'pl-title', t('The fastest way out of the Sun’s family', 'The fastest way out'));
  const canvas = el('canvas', 'ls-canvas');
  const view = el('div', 'ls-view');
  view.append(canvas);
  const routeRow = el('div', 'ls-actions');
  routeRow.style.flexWrap = 'wrap';
  const routeBtns = ROUTES.map((r, i) => {
    const b = el('button', 'ls-btn ls-btn--ghost', `${i + 1}. ${pick(r.title)}`);
    b.type = 'button';
    b.addEventListener('click', () => choose(r.id));
    routeRow.append(b);
    return b;
  });
  const stopRow = el('div', 'ls-actions');
  stopRow.style.marginTop = '8px';
  const tip = el('p', 'ls-line');
  const tried = el('div', 'ls-line');
  tried.style.fontSize = '13px'; tried.style.opacity = '0.9';
  const actions = el('div', 'ls-actions');
  const status = el('div', 'ls-who');
  const goBtn = el('button', 'ls-btn');
  goBtn.type = 'button';
  actions.append(status, goBtn);
  card.append(eyebrow, title, view, routeRow, stopRow, tip, tried, actions);
  canvas.style.height = 'clamp(200px, 36vh, 340px)';
  tip.style.minHeight = '0';

  let round = 0; // index into FUELS
  let plan = newPlan(ROUTES[0].id, FUELS[0]);
  let sel = 0;
  let closed = false;
  let reveal = null; // after locking a round in: the fastest of all, shown before the next round
  const rounds = [];
  let triedBest = {}; // route id -> best speed tried this round
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });

  const layer = openLayer(card, {
    onKey(e) {
      if (/^[1-5]$/.test(e.key)) choose(ROUTES[Number(e.key) - 1].id);
      else if (e.key === 'ArrowLeft') { sel = Math.max(0, sel - 1); render(); } else if (e.key === 'ArrowRight') { sel = Math.min(Math.max(0, plan.close.length - 1), sel + 1); render(); } else if (e.key === 'ArrowUp') setClose(sel, plan.close[sel] + 1);
      else if (e.key === 'ArrowDown') setClose(sel, plan.close[sel] - 1);
      else if (e.key === 'Enter') go();
    },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }

  function note() {
    const s = planTotals(plan).speed;
    if (triedBest[plan.route] === undefined || s > triedBest[plan.route]) triedBest[plan.route] = s;
  }
  function choose(id) {
    if (reveal || plan.route === id) return;
    plan = newPlan(id, FUELS[round]);
    sel = 0; note(); render();
  }
  function setClose(i, c) {
    if (reveal || !plan.close.length) return;
    const v = Math.max(1, Math.min(CLOSE_LEVELS, c));
    if (plan.close[i] === v) return;
    plan.close[i] = v; sel = i; note(); render();
  }
  function go() {
    if (closed) return;
    if (reveal) {
      // Next round (100 t), or done.
      reveal = null;
      if (round + 1 < FUELS.length) {
        round++; triedBest = {};
        plan = newPlan(plan.route, FUELS[round]);
        note(); render();
      } else {
        closed = true;
        layer.close();
        if (window.__route === api) delete window.__route;
        const last = rounds[rounds.length - 1];
        finishFn({ rounds, plan: { route: last.route, fuel: last.fuel, close: last.close } });
      }
      return;
    }
    if (Object.keys(triedBest).length < MIN_TRIED) return;
    const tot = planTotals(plan);
    const fast = fastestRoute(FUELS[round]);
    const fastSpeed = planTotals(fast).speed;
    rounds.push({ fuel: FUELS[round], route: plan.route, close: [...plan.close], speed: tot.speed, best: { route: fast.route, close: fast.close, speed: fastSpeed } });
    reveal = { fast, fastSpeed, mine: tot.speed };
    render();
  }
  goBtn.addEventListener('click', go);

  function render() {
    const r = routeById(plan.route);
    const tot = planTotals(plan);
    const fuel = FUELS[round];
    eyebrow.textContent = `${t('Plan the way out', 'Plan the trip')} · ${t(`Round ${round + 1}: ${fuel} t of fuel`, `${fuel} t of fuel`)}`;
    routeBtns.forEach((b, i) => {
      b.className = `ls-btn${ROUTES[i].id === plan.route ? '' : ' ls-btn--ghost'}`;
      b.disabled = !!reveal;
    });
    stopRow.replaceChildren();
    const legs = tot.legs.filter((l) => l.id !== 'burn' && !l.fall);
    if (!legs.length) {
      const box = el('div', 'ls-choice', t(`No flybys: all ${fuel} t burned at once, here in the belt.`, `Burn all ${fuel} t now.`));
      box.style.flex = '1 1 0';
      stopRow.append(box);
    }
    legs.forEach((leg, i) => {
      const box = el('div', 'ls-choice');
      box.style.flex = '1 1 0'; box.style.minWidth = '0'; box.style.padding = '6px 10px';
      if (i === sel) box.style.borderColor = 'var(--pl-cool)';
      const name = el('div', 'ls-who', pick(STOPS[leg.id].name));
      const row = el('div');
      row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center';
      const minus = el('button', 'ls-btn ls-btn--ghost', '−'); minus.type = 'button';
      const plus = el('button', 'ls-btn ls-btn--ghost', '+'); plus.type = 'button';
      for (const b of [minus, plus]) { b.style.minHeight = '32px'; b.style.padding = '0 12px'; }
      minus.setAttribute('aria-label', t('further away', 'further'));
      plus.setAttribute('aria-label', t('closer', 'closer'));
      minus.disabled = !!reveal || leg.close <= 1; plus.disabled = !!reveal || leg.close >= CLOSE_LEVELS;
      minus.addEventListener('click', () => setClose(i, leg.close - 1));
      plus.addEventListener('click', () => setClose(i, leg.close + 1));
      const closeName = leg.id === 'sun' ? `${SUN_PASS[leg.close - 1]} ${t('Sun-widths', 'Sun-widths')}` : pick(CLOSE_NAMES[leg.close - 1]);
      row.append(minus, el('span', null, closeName), plus);
      const nums = el('div', null, `${leg.energyGain >= 0 ? '+' : ''}${leg.energyGain} ${t('energy', 'energy')} → ${pick(speedWords(leg.speed))}`);
      nums.style.fontSize = '13px';
      box.append(name, row, nums);
      stopRow.append(box);
    });
    const n = Object.keys(triedBest).length;
    tried.textContent = `${t('Tried', 'Tried')}: ${ROUTES.filter((x) => triedBest[x.id] !== undefined).map((x) => `${pick(x.title)} ${triedBest[x.id]}`).join(' · ')}`;
    if (reveal) {
      const fr = routeById(reveal.fast.route);
      const same = reveal.fast.route === plan.route && reveal.mine >= reveal.fastSpeed;
      tip.textContent = same
        ? t(`You found the fastest way out with ${fuel} t: ${pick(fr.title)}, ${reveal.fastSpeed} km/s!`, `You found the fastest way! ${reveal.fastSpeed} km/s!`)
        : t(`You chose ${reveal.mine} km/s. The fastest with ${fuel} t is ${pick(fr.title)}: ${reveal.fastSpeed} km/s.`, `The fastest way is ${pick(fr.title)}: ${reveal.fastSpeed} km/s.`);
      goBtn.textContent = round + 1 < FUELS.length ? t(`Now plan with ${FUELS[round + 1]} t ▶`, `Now ${FUELS[round + 1]} t ▶`) : t('Fly it ▶', 'Go! ▶');
      goBtn.disabled = false; goBtn.classList.add('is-ready');
    } else {
      const risky = tot.legs.find((l) => l.risky);
      tip.textContent = risky ? pick(STOPS[risky.id].danger)
        : tot.speed <= 0 ? t(`With ${fuel} t this way, the Sun still holds us. Steal energy from planets, or burn where we are fastest.`, 'The Sun still holds us! Try another way.')
          : t('Closer passes steal more energy. Try other routes and compare.', 'Try other ways and compare!');
      goBtn.textContent = n < MIN_TRIED ? t(`Try ${MIN_TRIED - n} more route${MIN_TRIED - n === 1 ? '' : 's'}`, `Try ${MIN_TRIED - n} more`) : t('Lock in this route ▶', 'Pick this one ▶');
      goBtn.disabled = n < MIN_TRIED;
      goBtn.classList.toggle('is-ready', n >= MIN_TRIED);
    }
    status.textContent = `${t('Engine', 'Engine')} +${tot.engine} km/s · ${tot.years === Infinity ? t('never reaches a star', 'never gets to a star') : t(`${tot.years.toLocaleString('en-US')} years to the nearest star`, `${tot.years.toLocaleString('en-US')} years to a star`)}`;
  }

  function draw(T) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 860; const H = canvas.clientHeight || 420;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(W / STAGE_W, H / 450) * dpr;
    ctx.setTransform(s, 0, 0, s, (canvas.width - STAGE_W * s) / 2, (canvas.height - 450 * s) / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, STAGE_W, 450); ctx.clip();
    nightSky(ctx, 71);
    const r = routeById(plan.route);
    label(ctx, t(`From the asteroid belt, with ${FUELS[round]} t of fuel: which way leaves fastest?`, `With ${FUELS[round]} t of fuel: which way is fastest?`), 400, 26, { size: 15, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
    drawRoute(ctx, plan, T);
    for (const id of Object.keys(MAP)) body(ctx, id, id !== 'belt' && !r.stops.includes(id) && !(r.fall && id === 'jupiter'));
    drawSpeed(ctx, planTotals(plan), Math.max(0, ...Object.values(triedBest)));
    ctx.restore();
  }

  const t0 = performance.now();
  function frame(now) {
    if (closed) return;
    draw((now - t0) / 1000);
    requestAnimationFrame(frame);
  }

  const api = {
    get open() { return !closed; },
    state() { const tot = planTotals(plan); return { round, fuel: FUELS[round], route: plan.route, close: [...plan.close], speed: tot.speed, tried: Object.keys(triedBest), reveal: !!reveal }; },
    pick(id) { choose(id); return this.state(); },
    setClose(i, c) { setClose(i, c); return this.state(); },
    /** Try three routes, then the fastest plan of all for this round (tests, grown-up skip). */
    solve() {
      if (reveal) return this.state();
      for (const r of ROUTES.slice(0, MIN_TRIED)) { plan = newPlan(r.id, FUELS[round]); note(); }
      plan = { ...fastestRoute(FUELS[round]) }; plan.close = [...plan.close]; note(); render();
      return this.state();
    },
    go() { go(); return closed; },
    shot() { draw(1); return canvas.toDataURL('image/png'); },
  };
  window.__route = api;
  // Unlock mode only: a grown-up can skip planning (both rounds, fastest plans).
  const skip = skipButton(() => { for (let k = 0; k < 4 && !closed; k++) { api.solve(); api.go(); } }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  note();
  render();
  requestAnimationFrame(frame);
  return done;
}

export { bestPlan };
