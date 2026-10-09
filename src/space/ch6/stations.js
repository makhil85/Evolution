// Chapter 6, Part B: the six habitat station cards (rules in
// stationsLogic.js). Each opens over the habitat walk when she presses E at
// a station, is led by one crewmate (their tip at the top), and has a Done
// button that lights once the puzzle is solved.
//
// Mouse: the buttons and the shield cells. Keys: Tab / arrows move between
// buttons (the browser's own focus), Enter or Space presses.
//
// Opens in the play-mode modal layer like the other cards and pauses the
// game through the bus's 'ui-modal'. Test hook while open:
// window.__station = { id, open, state(), solve(), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { CREW_INFO } from './crewInfo.js';
import {
  CREW_SIZE, SHIELD, createShield, patchCell, shieldDone, raysThrough, worstLeak,
  OXYGEN, oxygenNeed, oxygenTotals, oxygenAnswers,
  FILTERS, WATER_ORDER, waterProblem, recycledPercent, tankDays, WATER,
  FOOD, foodNeed, farmTotals, farmAnswers,
  GRID, gridTotals, fraction,
  PACK_CARDS, PACK_LIMIT, packTotals,
  STATIONS,
} from './stationsLogic.js';
import { skipButton } from '../../play/grownUp.js';

const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

const CSS_ID = 'ch6-stations-css';
const CSS = `
.st-body { display: grid; gap: 12px; margin-top: 10px; }
.st-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.st-step { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 12px; background: #1a2540; border: 1px solid rgba(255,255,255,.14); }
.st-step b { min-width: 2.2em; text-align: center; font-size: 18px; }
.st-step button { min-width: 36px; min-height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; font: inherit; font-weight: 900; cursor: pointer; }
.st-step button:disabled { opacity: .35; cursor: default; }
.st-bar { position: relative; height: 18px; border-radius: 9px; background: rgba(255,255,255,.12); overflow: hidden; flex: 1 1 220px; }
.st-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: 9px; background: #7fd3ff; }
.st-bar > s { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #fff; }
.st-bar.is-good > i { background: #9fe8a8; } .st-bar.is-bad > i { background: #ff8a8a; }
.st-num { min-width: 11em; font-weight: 800; }
.st-grid { display: grid; gap: 4px; }
.st-cell { min-height: 46px; border-radius: 8px; border: 2px solid rgba(255,255,255,.12); font: inherit; font-weight: 900; color: #10161f; cursor: pointer; }
.st-cell.is-sel { outline: 3px solid #7ff3ff; outline-offset: 1px; }
.st-chip { padding: 8px 12px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; text-align: left; }
.st-chip.is-on { border-color: #9fe8a8; background: rgba(126,231,135,.16); }
.st-chip.is-off { opacity: .55; }
.st-slot { min-width: 9em; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 2px dashed rgba(255,255,255,.3); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; }
.st-farm { display: grid; gap: 3px; width: max-content; padding: 6px; border-radius: 10px; background: rgba(255,255,255,.06); }
.st-farm i { width: 26px; height: 26px; border-radius: 5px; background: #2a3c22; }
.st-farm i.is-bed { background: #5fb45c; box-shadow: inset 0 0 0 2px #9fe8a8; }
.st-note { font-size: 15px; line-height: 1.45; color: #cfe8ff; }
.st-warn { color: #ffd27a; font-weight: 800; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

/** A "- value +" stepper. */
function stepper(label, get, set, min, max) {
  const box = el('div', 'st-step');
  const minus = el('button', null, '−'); minus.type = 'button';
  const val = el('b');
  const plus = el('button', null, '+'); plus.type = 'button';
  box.append(el('span', null, label), minus, val, plus);
  const paint = () => { const v = get(); val.textContent = String(v); minus.disabled = v <= min; plus.disabled = v >= max; };
  minus.addEventListener('click', () => { set(Math.max(min, get() - 1)); });
  plus.addEventListener('click', () => { set(Math.min(max, get() + 1)); });
  return { el: box, paint };
}

/** A bar of `v` out of `max`, with a mark at `mark`. */
function bar() {
  const b = el('div', 'st-bar'); const fill = el('i'); const mark = el('s');
  b.append(fill, mark);
  return {
    el: b,
    set(v, max, markAt, good) {
      fill.style.width = `${Math.min(100, (100 * v) / max)}%`;
      mark.style.left = `${Math.min(100, (100 * markAt) / max)}%`;
      b.className = `st-bar ${good ? 'is-good' : 'is-bad'}`;
    },
  };
}

// --- the six bodies --------------------------------------------------------------------
// Each returns { el, ok(), solve(), state(), refresh } and calls `changed()` on every move.

function shieldBody(changed) {
  const sh = createShield();
  let sel = sh.cells.findIndex((m) => m < SHIELD.safe);
  const wrap = el('div', 'st-body');
  const grid = el('div', 'st-grid');
  grid.style.gridTemplateColumns = `repeat(${SHIELD.cols}, 1fr)`;
  const cells = sh.cells.map((_, i) => {
    const c = el('button', 'st-cell'); c.type = 'button';
    c.addEventListener('click', () => { sel = i; patchCell(sh, i); changed(); });
    grid.append(c);
    return c;
  });
  const info = el('div', 'st-note');
  const left = el('div', 'st-num');
  wrap.append(grid, el('div', 'st-row'), info);
  wrap.lastChild.previousSibling.append(left);
  function refresh() {
    sh.cells.forEach((m, i) => {
      const k = Math.min(1, m / SHIELD.safe);
      cells[i].style.background = `hsl(${Math.round(8 + 110 * k)}, 70%, ${Math.round(48 + 10 * k)}%)`;
      cells[i].textContent = `${m} m`;
      cells[i].className = `st-cell${i === sel ? ' is-sel' : ''}`;
    });
    left.textContent = `${t('Rock blocks left', 'Rock left')}: ${sh.blocks}`;
    const m = sh.cells[sel] ?? SHIELD.safe;
    const steps = [];
    for (let k = 0; k <= Math.min(m, 6); k++) steps.push(String(+raysThrough(k).toFixed(2)));
    info.textContent = t(
      `This spot is ${m} m thick. Rays through: ${steps.join(' → ')}. Safe is ${SHIELD.safe} m. Worst lets ${worstLeak(sh).toFixed(1)} in.`,
      `This spot is ${m} m thick. Each metre stops half. Make it ${SHIELD.safe} m.`,
    );
  }
  return {
    el: wrap,
    ok: () => shieldDone(sh),
    solve() { sh.cells.forEach((m, i) => { while (sh.cells[i] < SHIELD.safe && patchCell(sh, i)); }); changed(); },
    state: () => ({ cells: [...sh.cells], blocks: sh.blocks }),
    refresh,
    tip: t('Thin spots let space radiation in. Each metre of rock stops half of it, so tap the red spots to pile on more rock.', 'Thin spots let bad rays in. Tap the red spots to add rock.'),
  };
}

function oxygenBody(changed) {
  const s = { lamps: 2, split: 1 };
  const wrap = el('div', 'st-body');
  const lamps = stepper(t('Algae lamps', 'Algae lamps'), () => s.lamps, (v) => { s.lamps = v; changed(); }, 0, OXYGEN.lamp.max);
  const split = stepper(t('Ice splitter', 'Ice splitter'), () => s.split, (v) => { s.split = v; changed(); }, 0, OXYGEN.split.max);
  const air = bar(); const pow = bar();
  const airN = el('div', 'st-num'); const powN = el('div', 'st-num');
  const r1 = el('div', 'st-row'); r1.append(airN, air.el);
  const r2 = el('div', 'st-row'); r2.append(powN, pow.el);
  const note = el('div', 'st-note', t(`Lamp: ${OXYGEN.lamp.litres} L of oxygen a day for ${OXYGEN.lamp.power} unit. Splitter: ${OXYGEN.split.litres} L for ${OXYGEN.split.power} units. ${CREW_SIZE} of us breathe ${OXYGEN.perPerson} L a day.`,
    `A lamp makes ${OXYGEN.lamp.litres} L. Splitter makes ${OXYGEN.split.litres} L. We need ${oxygenNeed()} L.`));
  const top = el('div', 'st-row'); top.append(lamps.el, split.el);
  wrap.append(top, r1, r2, note);
  function refresh() {
    lamps.paint(); split.paint();
    const tot = oxygenTotals(s);
    air.set(tot.litres, oxygenNeed() * 1.4, oxygenNeed(), tot.enough);
    pow.set(tot.power, OXYGEN.power * 1.4, OXYGEN.power, tot.inPower);
    airN.textContent = `${t('Oxygen', 'Air')}: ${tot.litres} / ${oxygenNeed()} L`;
    powN.textContent = `${t('Power', 'Power')}: ${tot.power} / ${OXYGEN.power}`;
  }
  return {
    el: wrap, ok: () => oxygenTotals(s).ok,
    solve() { Object.assign(s, oxygenAnswers()[0]); changed(); },
    state: () => ({ ...s }), refresh,
    tip: t('Plants breathe out oxygen, and splitting ice makes it too. Find a mix that makes enough without too much power.', 'Plants and ice both make air. Make enough, but don’t use too much power.'),
  };
}

function waterBody(changed) {
  let order = [];
  const wrap = el('div', 'st-body');
  const chips = el('div', 'st-row');
  const slots = el('div', 'st-row');
  const msg = el('div', 'st-note');
  const reset = el('button', 'ls-btn ls-btn--ghost', `↻ ${t('Start again', 'Try again')}`); reset.type = 'button';
  reset.addEventListener('click', () => { order = []; changed(); });
  const btns = FILTERS.map((f) => {
    const b = el('button', 'st-chip'); b.type = 'button';
    b.innerHTML = '';
    b.append(el('div', null, pick(f.name)), el('div', 'st-note', pick(f.does)));
    b.addEventListener('click', () => { if (!order.includes(f.id) && order.length < 3) { order.push(f.id); changed(); } });
    chips.append(b);
    return b;
  });
  wrap.append(el('div', 'st-note', t('Used water from the sinks and showers → ? → ? → ? → the drinking tank', 'Dirty water → ? → ? → ? → clean tank')), chips, slots, reset, msg);
  function refresh() {
    btns.forEach((b, i) => { b.className = `st-chip${order.includes(FILTERS[i].id) ? ' is-off' : ''}`; });
    slots.replaceChildren(...[0, 1, 2].map((k) => el('div', 'st-slot', order[k] ? pick(FILTERS.find((f) => f.id === order[k]).name) : `${k + 1}`)));
    const p = order.length === 3 ? waterProblem(order) : null;
    msg.className = `st-note${p ? ' st-warn' : ''}`;
    msg.textContent = order.length < 3 ? t('Tap the filters in the order the water should go through them.', 'Tap the filters in order.')
      : p ? pick(p)
        : t(`Clean! Of every ${WATER.usedPerDay} L we use, ${WATER.backPerDay} L comes back: ${recycledPercent()}% recycled, so a ${WATER.tank} L tank lasts ${tankDays()} days.`, `Clean! ${recycledPercent()} of every 100 L come back.`);
  }
  return {
    el: wrap, ok: () => order.length === 3 && !waterProblem(order),
    solve() { order = [...WATER_ORDER]; changed(); },
    state: () => ({ order: [...order] }), refresh,
    tip: t('On a trip this long we can’t bring all our water: nearly every drop gets cleaned and used again.', 'We clean our water and use it again and again.'),
  };
}

function foodBody(changed) {
  const s = { w: 2, l: 2 };
  const wrap = el('div', 'st-body');
  const W = stepper(t('Width (m)', 'Wide'), () => s.w, (v) => { s.w = v; changed(); }, 1, FOOD.maxSide);
  const Lg = stepper(t('Length (m)', 'Long'), () => s.l, (v) => { s.l = v; changed(); }, 1, FOOD.maxSide);
  const plot = el('div', 'st-farm');
  plot.style.gridTemplateColumns = `repeat(${FOOD.maxSide}, 26px)`;
  const tiles = [];
  for (let i = 0; i < FOOD.maxSide * FOOD.maxSide; i++) { const c = el('i'); plot.append(c); tiles.push(c); }
  const kgB = bar(); const kgN = el('div', 'st-num'); const areaN = el('div', 'st-note');
  const top = el('div', 'st-row'); top.append(W.el, Lg.el);
  const r = el('div', 'st-row'); r.append(kgN, kgB.el);
  wrap.append(top, plot, r, areaN);
  function refresh() {
    W.paint(); Lg.paint();
    tiles.forEach((c, i) => { const x = i % FOOD.maxSide; const y = Math.floor(i / FOOD.maxSide); c.className = x < s.w && y < s.l ? 'is-bed' : ''; });
    const f = farmTotals(s);
    kgB.set(f.kg, foodNeed() * 1.6, foodNeed(), f.enough);
    kgN.textContent = `${t('Food', 'Food')}: ${f.kg} / ${foodNeed()} kg ${t('a day', 'a day')}`;
    areaN.className = `st-note${f.fits ? '' : ' st-warn'}`;
    areaN.textContent = t(`Area ${s.w} × ${s.l} = ${f.area} m² (room for ${FOOD.maxArea} m²). Each m² grows ${FOOD.perSquareMetre} kg a day; ${CREW_SIZE} of us eat ${FOOD.perPerson} kg each.`,
      `${s.w} × ${s.l} = ${f.area} squares. ${f.fits ? '' : 'Too big! '}Each 2 squares feed 1 person.`);
  }
  return {
    el: wrap, ok: () => farmTotals(s).ok,
    solve() { Object.assign(s, farmAnswers()[0]); changed(); },
    state: () => ({ ...s }), refresh,
    tip: t('Under bright lamps, with recycled water, plants grow fast. Make the farm big enough to feed all five of us, but it has to fit.', 'Make the farm big enough to feed five people.'),
  };
}

function energyBody(changed) {
  const s = Object.fromEntries(GRID.systems.map((x) => [x.id, 3]));
  const wrap = el('div', 'st-body');
  const rows = GRID.systems.map((sys) => {
    const st = stepper(pick(sys.name), () => s[sys.id], (v) => { s[sys.id] = v; changed(); }, 0, GRID.total);
    const fr = el('div', 'st-num');
    const r = el('div', 'st-row'); r.append(st.el, fr);
    wrap.append(r);
    return { sys, st, fr };
  });
  const total = el('div', 'st-num'); const note = el('div', 'st-note');
  wrap.append(total, note);
  function refresh() {
    const g = gridTotals(s);
    for (const { sys, st, fr } of rows) {
      st.paint();
      const shortHere = g.short.includes(sys.id);
      fr.className = `st-num${shortHere ? ' st-warn' : ''}`;
      fr.textContent = `${fraction(s[sys.id])} ${t('of the power', 'of the power')} · ${t('needs at least', 'needs')} ${fraction(sys.min)}`;
    }
    total.className = `st-num${g.over ? ' st-warn' : ''}`;
    total.textContent = `${t('Shared out', 'Used')}: ${g.used} / ${GRID.total} ${t('units', 'units')}`;
    note.textContent = g.ok ? t('Every system has its share, and all 12 units are used.', 'Every part has enough power!')
      : g.over ? t('That is more than the drive makes!', 'Too much! We only have 12.')
        : t('The drive makes 12 units. Give each system at least its share, and use them all.', 'Share all 12 units. Each part needs its share.');
  }
  return {
    el: wrap, ok: () => gridTotals(s).ok,
    solve() { for (const sys of GRID.systems) s[sys.id] = sys.min; changed(); },
    state: () => ({ ...s }), refresh,
    tip: t('The fusion drive powers everything: the air, the farm, the lights and the engine itself. Share it out.', 'The engine makes power for everything. Share it out.'),
  };
}

function packBody(changed) {
  const packed = new Set();
  const wrap = el('div', 'st-body');
  const list = el('div', 'st-row');
  const mass = bar(); const massN = el('div', 'st-num'); const note = el('div', 'st-note');
  const chips = PACK_CARDS.map((c) => {
    const b = el('button', 'st-chip'); b.type = 'button';
    b.append(el('div', null, pick(c.name)), el('div', 'st-note', `${c.t.toFixed(1)} t`));
    b.addEventListener('click', () => { if (packed.has(c.id)) packed.delete(c.id); else packed.add(c.id); changed(); });
    list.append(b);
    return b;
  });
  const r = el('div', 'st-row'); r.append(massN, mass.el);
  wrap.append(list, r, note);
  function refresh() {
    chips.forEach((b, i) => { b.className = `st-chip${packed.has(PACK_CARDS[i].id) ? ' is-on' : ''}`; });
    const p = packTotals([...packed]);
    mass.set(p.mass, PACK_LIMIT * 1.5, PACK_LIMIT, !p.over);
    massN.textContent = `${t('Packed', 'Packed')}: ${p.mass.toFixed(1)} / ${PACK_LIMIT.toFixed(1)} t`;
    note.className = `st-note${p.junk.length || p.over ? ' st-warn' : ''}`;
    note.textContent = p.ok ? t('Packed! Everything a trip between the stars needs, under the limit.', 'All packed!')
      : p.junk.length ? t('Something packed is not needed between the stars: every tonne costs fuel to push.', 'Something here is not needed!')
        : p.over ? t('Over the limit!', 'Too heavy!')
          : t(`Tap a card to pack it. ${p.missing.length} things we need are still on the shelf.`, 'Tap the things we need.');
  }
  return {
    el: wrap, ok: () => packTotals([...packed]).ok,
    solve() { packed.clear(); for (const c of PACK_CARDS) if (c.need) packed.add(c.id); changed(); },
    state: () => ({ packed: [...packed] }), refresh,
    tip: t('Every tonne we take has to be pushed for years. Pack what we need for the trip, and nothing else.', 'Pack only what we need.'),
  };
}

const BODIES = { shield: shieldBody, oxygen: oxygenBody, water: waterBody, food: foodBody, energy: energyBody, pack: packBody };

/**
 * Play one station.
 * @param {string} id one of STATIONS' ids
 * @returns {Promise<{id:string, moves:number}>}
 */
export function playStation(id, { bus = null } = {}) {
  injectStyles(); injectCss();
  const info = STATIONS.find((s) => s.id === id);
  if (!info) throw new Error(`no station ${id}`);
  const lead = CREW_INFO[info.lead];
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = `station-${id}`;
  const eyebrow = el('div', 'pl-eyebrow', `${lead.name} · ${pick(lead.job)}`);
  eyebrow.style.color = lead.color;
  const title = el('h2', 'pl-title', pick(info.title));
  const tip = el('p', 'ls-line');
  const actions = el('div', 'ls-actions');
  const doneBtn = el('button', 'ls-btn', t('Done ✓', 'Done ✓')); doneBtn.type = 'button';
  actions.append(el('div', 'ls-dots'), doneBtn);
  let moves = 0;
  let body;
  const changed = () => { moves++; body.refresh(); paint(); };
  body = BODIES[id](changed);
  tip.textContent = body.tip;
  card.append(eyebrow, title, tip, body.el, actions);

  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) { if (e.key === 'Enter' && body.ok() && document.activeElement === doneBtn) finish(); },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  function paint() { const ok = body.ok(); doneBtn.disabled = !ok; doneBtn.classList.toggle('is-ready', ok); }
  function finish() {
    if (closed || !body.ok()) return;
    closed = true;
    layer.close();
    if (window.__station === api) delete window.__station;
    finishFn({ id, moves });
  }
  doneBtn.addEventListener('click', finish);
  const api = {
    id,
    get open() { return !closed; },
    state: () => ({ id, ok: body.ok(), ...body.state() }),
    solve() { body.solve(); return body.ok(); },
    done() { finish(); return closed; },
  };
  window.__station = api;
  // Unlock mode only: a grown-up can skip the puzzle.
  const skip = skipButton(() => { api.solve(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  body.refresh(); paint();
  return done;
}
