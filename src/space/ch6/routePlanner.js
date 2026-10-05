// The route planner (Chapter 6, Part E, step 13): a top-down map from Pluto
// in to the Sun, with the planets lined up nearly in a row. She picks one of
// three ready-made routes, then sets how close each flyby passes. Every
// change shows the speed gained against the steering fuel used; "Fly this
// route" lights up once the plan reaches the goal speed inside the budget.
// Sums live in routes.js.
//
// Keys: 1/2/3 pick a route, left/right pick a flyby, up/down closer/further,
// Enter flies. Mouse: the route buttons and the - / + under each flyby.
//
// Opens in the play-mode modal layer and pauses space through the bus's
// 'ui-modal'. Test hook while open:
// window.__route = { open, state(), pick(id), setClose(i, c), solve(), go() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { nightSky, label, circle, rect, line, STAGE_W } from '../../lesson/draw.js';
import {
  ROUTES, STOPS, CLOSE_LEVELS, CLOSE_NAMES, FUEL_BUDGET, GOAL_BOOST, START_SPEED,
  routeById, newPlan, planTotals, bestPlan,
} from './routes.js';

const TAU = Math.PI * 2;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

/** Where each body sits on the map (x along the near-line; Sun on the left). */
const MAP = {
  sun: { x: 70, y: 200, r: 46 },
  earth: { x: 170, y: 214, r: 9 },
  jupiter: { x: 290, y: 186, r: 22 },
  saturn: { x: 410, y: 218, r: 19 },
  uranus: { x: 530, y: 190, r: 14 },
  neptune: { x: 640, y: 214, r: 14 },
  pluto: { x: 745, y: 196, r: 6 },
};

function body(ctx, id, dim) {
  const m = MAP[id];
  ctx.save();
  ctx.globalAlpha = dim ? 0.45 : 1;
  if (id === 'sun') {
    const g = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.r * 1.6);
    g.addColorStop(0, '#fff6c8'); g.addColorStop(0.55, '#ffc34d'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.6, 0, TAU); ctx.fill();
  } else {
    circle(ctx, m.x, m.y, m.r, id === 'pluto' ? '#d8c8b0' : STOPS[id].color, 'rgba(255,255,255,0.5)', 1.5);
    if (id === 'saturn') {
      ctx.strokeStyle = '#f3e2b8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * 1.9, m.r * 0.55, -0.25, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  const name = id === 'pluto' ? t('Pluto (start)', 'Pluto (start)') : pick(STOPS[id].name);
  label(ctx, name, m.x, m.y + m.r + 18 + (id === 'sun' ? 6 : 0), { size: 14, color: '#e8eefc', halo: 'rgba(0,0,0,0.7)' });
}

/** The route drawn as a dotted curve that bends round each stop; closer = tighter. */
function drawRoute(ctx, plan, T) {
  const r = routeById(plan.route);
  const pts = [{ x: MAP.pluto.x, y: MAP.pluto.y }];
  r.stops.forEach((id, i) => {
    const m = MAP[id];
    const gap = m.r + 8 + (CLOSE_LEVELS - plan.close[i]) * (id === 'sun' ? 14 : 9);
    pts.push({ x: m.x + gap * 0.3, y: m.y - gap }); // pass "behind" (above) each body
  });
  pts.push({ x: 20, y: 60 }); // out past the Sun, to the stars
  ctx.save();
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -T * 30;
  ctx.strokeStyle = '#7ff3ff'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]; const b = pts[i];
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 40, b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
  // Closeness rings round each stop.
  r.stops.forEach((id, i) => {
    const m = MAP[id];
    const gap = m.r + 8 + (CLOSE_LEVELS - plan.close[i]) * (id === 'sun' ? 14 : 9);
    ctx.save(); ctx.strokeStyle = 'rgba(127,243,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, gap, 0, TAU); ctx.stroke(); ctx.restore();
  });
}

/** Two bars under the map: speed against the goal, fuel against the budget. */
function drawBars(ctx, tot) {
  const x0 = 120; const w = 520;
  const sMax = 70; const fMax = 50;
  // speed
  label(ctx, t('Speed gained', 'Speed boost'), x0 - 10, 352, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'right' });
  rect(ctx, x0, 343, w, 18, 'rgba(255,255,255,0.12)', 6);
  rect(ctx, x0, 343, w * Math.min(1, tot.boost / sMax), 18, tot.enoughSpeed ? '#9fe8a8' : '#ffd27a', 6);
  line(ctx, x0 + (w * GOAL_BOOST) / sMax, 337, x0 + (w * GOAL_BOOST) / sMax, 367, '#ffffff', 2);
  label(ctx, `${t('goal', 'goal')} ${GOAL_BOOST}`, x0 + (w * GOAL_BOOST) / sMax, 330, { size: 12, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, `${tot.boost} km/s`, x0 + w + 12, 352, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  // fuel
  label(ctx, t('Steering fuel', 'Fuel used'), x0 - 10, 397, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'right' });
  rect(ctx, x0, 388, w, 18, 'rgba(255,255,255,0.12)', 6);
  rect(ctx, x0, 388, w * Math.min(1, tot.fuel / fMax), 18, tot.inBudget ? '#7fd3ff' : '#ff8a8a', 6);
  line(ctx, x0 + (w * FUEL_BUDGET) / fMax, 382, x0 + (w * FUEL_BUDGET) / fMax, 412, '#ffffff', 2);
  label(ctx, `${t('tank', 'tank')} ${FUEL_BUDGET} t`, x0 + (w * FUEL_BUDGET) / fMax, 425, { size: 12, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, `${tot.fuel} t`, x0 + w + 12, 397, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
}

/** @returns {Promise<{route:string, close:number[], boost:number, fuel:number, changes:number}>} */
export function playRoutePlanner({ bus = null, initial = null } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'route-planner';
  const eyebrow = el('div', 'pl-eyebrow', t('Plan the route', 'Plan the trip'));
  const title = el('h2', 'pl-title', t('Steal speed from the planets', 'Get speed from the planets'));
  const canvas = el('canvas', 'ls-canvas');
  const view = el('div', 'ls-view');
  view.append(canvas);
  const routeRow = el('div', 'ls-actions');
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
  const actions = el('div', 'ls-actions');
  const status = el('div', 'ls-who');
  const goBtn = el('button', 'ls-btn', t('Fly this route ▶', 'Fly! ▶'));
  goBtn.type = 'button';
  actions.append(status, goBtn);
  card.append(eyebrow, title, view, routeRow, stopRow, tip, actions);
  canvas.style.height = 'clamp(200px, 38vh, 360px)';
  tip.style.minHeight = '0';

  let plan = initial ? { route: initial.route, close: [...initial.close] } : newPlan(ROUTES[0].id);
  let sel = 0; // the flyby the arrow keys change
  let changes = 0;
  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });

  const layer = openLayer(card, {
    onKey(e) {
      if (/^[1-3]$/.test(e.key)) choose(ROUTES[Number(e.key) - 1].id);
      else if (e.key === 'ArrowLeft') { sel = Math.max(0, sel - 1); render(); } else if (e.key === 'ArrowRight') { sel = Math.min(plan.close.length - 1, sel + 1); render(); } else if (e.key === 'ArrowUp') setClose(sel, plan.close[sel] + 1);
      else if (e.key === 'ArrowDown') setClose(sel, plan.close[sel] - 1);
      else if (e.key === 'Enter') go();
    },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }

  function choose(id) {
    if (plan.route === id) return;
    plan = newPlan(id);
    sel = 0; changes++;
    render();
  }
  function setClose(i, c) {
    const v = Math.max(1, Math.min(CLOSE_LEVELS, c));
    if (plan.close[i] === v) return;
    plan.close[i] = v; sel = i; changes++;
    render();
  }
  function go() {
    const tot = planTotals(plan);
    if (!tot.ok || closed) return;
    closed = true;
    layer.close();
    if (window.__route === api) delete window.__route;
    finishFn({ route: plan.route, close: [...plan.close], boost: tot.boost, fuel: tot.fuel, changes });
  }
  goBtn.addEventListener('click', go);

  /** The row of flybys, each with - / + and its boost and fuel. */
  function render() {
    const r = routeById(plan.route);
    const tot = planTotals(plan);
    routeBtns.forEach((b, i) => { b.className = `ls-btn${ROUTES[i].id === plan.route ? '' : ' ls-btn--ghost'}`; });
    stopRow.replaceChildren();
    tot.legs.forEach((leg, i) => {
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
      minus.disabled = leg.close <= 1; plus.disabled = leg.close >= CLOSE_LEVELS;
      minus.addEventListener('click', () => setClose(i, leg.close - 1));
      plus.addEventListener('click', () => setClose(i, leg.close + 1));
      row.append(minus, el('span', null, pick(CLOSE_NAMES[leg.close - 1])), plus);
      const nums = el('div', null, `+${leg.boost} km/s · ${leg.fuel} t ${t('fuel', 'fuel')}`);
      box.append(name, row, nums);
      stopRow.append(box);
    });
    const risky = tot.legs.find((l) => l.risky);
    tip.textContent = risky ? pick(STOPS[risky.id].danger)
      : !tot.inBudget ? t(`That needs ${tot.fuel} t of steering fuel, but the tank holds ${FUEL_BUDGET} t. Pass further from one planet.`, `Too much fuel! We only have ${FUEL_BUDGET}. Go a bit further from one planet.`)
        : !tot.enoughSpeed ? t(`${tot.boost} km/s is not enough yet: we need ${GOAL_BOOST}. Pass closer to a big planet.`, `We need ${GOAL_BOOST} km/s. Go closer to a big planet.`)
          : t('This plan works! Closer passes give more speed but use more fuel to steer.', 'This plan works!');
    status.textContent = `${t('Speed at the edge', 'Start speed')} ${START_SPEED} km/s → ${START_SPEED + tot.boost} km/s`;
    goBtn.disabled = !tot.ok;
    goBtn.classList.toggle('is-ready', tot.ok);
    eyebrow.textContent = `${t('Plan the route', 'Plan the trip')} · ${pick(r.title)}`;
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
    label(ctx, t('The planets are nearly in a line: this happens about once every 175 years', 'The planets are almost in a line!'), 400, 26, { size: 15, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
    drawRoute(ctx, plan, T);
    for (const id of Object.keys(MAP)) body(ctx, id, id !== 'pluto' && !r.stops.includes(id));
    drawBars(ctx, planTotals(plan));
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
    state() { const tot = planTotals(plan); return { route: plan.route, close: [...plan.close], boost: tot.boost, fuel: tot.fuel, ok: tot.ok }; },
    pick(id) { choose(id); return this.state(); },
    setClose(i, c) { setClose(i, c); return this.state(); },
    /** The best plan for the current route (tests). */
    solve() { plan = bestPlan(plan.route); render(); return this.state(); },
    go() { go(); return closed; },
    shot() { draw(1); return canvas.toDataURL('image/png'); },
  };
  window.__route = api;
  render();
  requestAnimationFrame(frame);
  return done;
}
