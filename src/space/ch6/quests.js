// Chapter 6, life on board: the four quest cards (rules in questsLogic.js).
// Each opens over the walk when she presses E at its spot, is led by one
// crewmate (their tip at the top), and has a Done button that lights once the
// puzzle is solved. The same look and contract as stations.js.
//
// Mouse: the buttons, the valves and the dish. Keys: Tab moves between buttons
// (the browser's own focus), Enter or Space presses.
//
// Opens in the play-mode modal layer like the other cards and pauses the game
// through the bus's 'ui-modal'. Test hook while open:
// window.__quest = { id, state(), solve(), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { CREW_INFO } from './crewInfo.js';
import { skipButton } from '../../play/grownUp.js';
import {
  QUESTS, BADGES, DAY_LIMIT, BONES, medbayTotals, medbayAnswer, badgeDose,
  COOLANT, coolantFlow, coolantProblem, COOLANT_ANSWER,
  DISH, dishTurn, dishOnEarth, angleGap,
  FLOWERS, PAIRS, pollinate, pollinated, pollenAnswer, runPollen,
} from './questsLogic.js';

const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

const CSS_ID = 'ch6-quests-css';
const CSS = `
.qz-body { display: grid; gap: 12px; margin-top: 10px; }
.qz-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.qz-badge { min-width: 10em; min-height: 46px; padding: 8px 12px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; text-align: left; }
.qz-badge.is-scanned { border-color: #7fd3ff; background: rgba(127,211,255,.14); }
.qz-badge:disabled { cursor: default; }
.qz-step { min-width: 40px; min-height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; font: inherit; font-weight: 900; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.qz-step:disabled { opacity: .35; cursor: default; }
.qz-big { min-width: 4.5em; text-align: center; font-size: 18px; font-weight: 900; }
.qz-bar { position: relative; height: 18px; border-radius: 9px; background: rgba(255,255,255,.12); overflow: hidden; flex: 1 1 220px; }
.qz-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: 9px; background: #7fd3ff; }
.qz-bar > s { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #fff; }
.qz-bar.is-good > i { background: #9fe8a8; } .qz-bar.is-bad > i { background: #ff8a8a; }
.qz-num { min-width: 11em; font-weight: 800; }
.qz-note { font-size: 15px; line-height: 1.45; color: #cfe8ff; }
.qz-warn { color: #ffd27a; font-weight: 800; }
.qz-grid { display: grid; gap: 6px; }
.qz-cell { min-height: 52px; border-radius: 10px; border: 2px solid rgba(255,255,255,.14); background: #1a2540; color: inherit; font: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
.qz-cell.is-open { background: #2f6f86; border-color: #7fd3ff; }
.qz-cell.is-wet { background: #3fb6d6; border-color: #bff3ff; color: #05121a; }
.qz-cell.is-crack { background: #5a1f2a; border-color: #ff8a8a; }
.qz-cell.is-fixed { background: #2a2f3d; cursor: default; }
.qz-cell:disabled { cursor: default; }
.qz-sky { display: block; width: 100%; max-width: 320px; height: auto; border-radius: 12px; background: #05060a; }
.qz-bed { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.qz-flower { min-height: 72px; border-radius: 14px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.qz-flower.is-holding { outline: 3px solid #ffd27a; outline-offset: 2px; }
.qz-flower.is-fruit { background: rgba(255,120,120,.22); border-color: #ff8a8a; }
.qz-art { position: relative; display: block; width: 40px; height: 40px; }
.qz-art::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background:
    radial-gradient(circle at 50% 24%, #ffb3cf 0 24%, transparent 25%),
    radial-gradient(circle at 76% 41%, #ffb3cf 0 24%, transparent 25%),
    radial-gradient(circle at 67% 73%, #ffb3cf 0 24%, transparent 25%),
    radial-gradient(circle at 33% 73%, #ffb3cf 0 24%, transparent 25%),
    radial-gradient(circle at 24% 41%, #ffb3cf 0 24%, transparent 25%); }
.qz-art::after { content: ''; position: absolute; left: 50%; top: 50%; width: 30%; height: 30%; transform: translate(-50%, -50%); border-radius: 50%; background: #ffd27a; }
.qz-art.is-bud::before { background: radial-gradient(ellipse at 50% 58%, #7fc97f 0 36%, transparent 37%); }
.qz-art.is-bud::after { background: #c8f0c8; width: 16%; height: 16%; top: 30%; }
.qz-art.is-berry::before { background: radial-gradient(circle at 50% 56%, #e0474c 0 36%, transparent 37%); }
.qz-art.is-berry::after { background: #3f9e5a; width: 26%; height: 14%; top: 26%; border-radius: 50% 50% 40% 40%; }
.qz-count { font-size: 20px; font-weight: 900; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

/**
 * A +/- button that steps once per press and keeps stepping while it is held
 * (after a short wait, then steadily). A keyboard click steps once.
 */
function stepper(btn, step) {
  let wait = 0; let again = 0;
  const stop = () => { clearTimeout(wait); clearInterval(again); };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || btn.disabled) return;
    stop(); // a second finger on the same button must not leave a timer behind
    step();
    wait = setTimeout(() => { again = setInterval(() => { if (!btn.isConnected || btn.disabled) stop(); else step(); }, 110); }, 200);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  // A mouse or touch click was stepped on pointerdown (detail > 0); a keyboard click has detail 0.
  btn.addEventListener('click', (e) => { if (e.detail === 0) step(); });
}

/** A bar of `v` out of `max`, with a mark at `markAt`. */
function bar() {
  const b = el('div', 'qz-bar'); const fill = el('i'); const mark = el('s');
  b.append(fill, mark);
  return {
    el: b,
    set(v, max, markAt, good) {
      fill.style.width = `${Math.min(100, (100 * v) / max)}%`;
      mark.style.left = `${Math.min(100, (100 * markAt) / max)}%`;
      b.className = `qz-bar ${good ? 'is-good' : 'is-bad'}`;
    },
  };
}

// --- the four bodies ----------------------------------------------------------------------
// Each returns { el, ok(), solve(), state(), refresh, tip } and calls `changed()` on every move.

function medbayBody(changed) {
  const s = { scanned: [], bike: 0 };
  const wrap = el('div', 'qz-body');
  const badges = el('div', 'qz-row');
  const btns = BADGES.map((b) => {
    const btn = el('button', 'qz-badge'); btn.type = 'button';
    btn.addEventListener('click', () => { if (!s.scanned.includes(b.id)) { s.scanned.push(b.id); changed(); } });
    badges.append(btn);
    return { btn, b };
  });
  const less = el('button', 'qz-step', '−'); less.type = 'button';
  const more = el('button', 'qz-step', '+'); more.type = 'button';
  const bikeN = el('div', 'qz-big');
  stepper(less, () => { s.bike = Math.max(0, s.bike - BONES.bikeStep); changed(); });
  stepper(more, () => { s.bike = Math.min(BONES.bikeMax, s.bike + BONES.bikeStep); changed(); });
  const bikeRow = el('div', 'qz-row');
  bikeRow.append(el('span', 'qz-num', t('Exercise bike, minutes', 'Bike minutes')), less, bikeN, more);
  const totalN = el('div', 'qz-num'); const totalBar = bar();
  const totalRow = el('div', 'qz-row'); totalRow.append(totalN, totalBar.el);
  const note = el('div', 'qz-note');
  wrap.append(badges, bikeRow, totalRow, note);
  function refresh() {
    for (const { btn, b } of btns) {
      const sc = s.scanned.includes(b.id);
      btn.className = `qz-badge${sc ? ' is-scanned' : ''}`;
      btn.textContent = sc ? `${b.name}: ${badgeDose(b)} ${t('units a day', 'units')}` : `${t('Scan', 'Scan')} ${b.name}`;
    }
    less.disabled = s.bike <= 0; more.disabled = s.bike >= BONES.bikeMax;
    bikeN.textContent = `${s.bike} min`;
    const m = medbayTotals(s);
    totalN.textContent = `${t('Exercise today', 'Exercise')}: ${m.total} / ${m.goal} ${t('minutes', 'min')}`;
    totalBar.set(m.total, m.goal * 1.4, m.goal, !m.short);
    note.className = `qz-note${m.ok ? '' : ' qz-warn'}`;
    note.textContent = m.missing.length ? t(`Scan all four badges. Each one shows what the rays did to that person today (the limit is ${DAY_LIMIT} units).`, 'Scan all four badges.')
      : m.short ? t(`Bones need ${BONES.each} minutes of exercise a day each: ${m.goal} minutes for the five of us. Walking round the ring gives ${BONES.walk}. Ride the bike for the rest.`, `Bones need exercise! ${m.goal} minutes for us all. Ride the bike.`)
        : t('Everyone is checked, and the exercise is enough for strong bones!', 'All checked. Strong bones!');
  }
  return {
    el: wrap, ok: () => medbayTotals(s).ok,
    solve() { Object.assign(s, medbayAnswer()); changed(); },
    state: () => ({ scanned: [...s.scanned], bike: s.bike }), refresh,
    tip: t('Each metre of rock halves the rays. The front shield keeps the ring behind it safe, so scan every badge, then set the bike. In spin gravity our bones need exercise every day.', 'Scan each badge. Exercise keeps our bones strong.'),
  };
}

function coolantBody(changed) {
  const open = new Set(COOLANT.open);
  const key = (c, r) => `${c},${r}`;
  const wrap = el('div', 'qz-body');
  const grid = el('div', 'qz-grid');
  grid.style.gridTemplateColumns = `repeat(${COOLANT.cols}, 1fr)`;
  const cells = [];
  for (let r = 0; r < COOLANT.rows; r++) {
    for (let c = 0; c < COOLANT.cols; c++) {
      const k = key(c, r);
      const isTank = k === key(...COOLANT.tank); const isCore = k === key(...COOLANT.core); const isCrack = k === key(...COOLANT.crack);
      const btn = el('button', 'qz-cell'); btn.type = 'button';
      if (isTank || isCore) btn.disabled = true;
      btn.addEventListener('click', () => { if (open.has(k)) open.delete(k); else open.add(k); changed(); });
      grid.append(btn);
      cells.push({ btn, k, isTank, isCore, isCrack });
    }
  }
  const msg = el('div', 'qz-note');
  const legend = el('div', 'qz-note', t('Tap a valve to open it (blue) or shut it. Coolant runs from the tank (left) to the core (right), through open valves only. Wet (light blue) cells are where the coolant reaches.', 'Tap a valve to open or shut it. Light blue: the coolant reaches it.'));
  wrap.append(grid, legend, msg);
  function refresh() {
    const flow = coolantFlow(open);
    for (const { btn, k, isTank, isCore, isCrack } of cells) {
      let cls = 'qz-cell';
      let label = t('Shut', 'Shut');
      if (isTank) { cls += ' is-fixed'; label = t('TANK', 'TANK'); }
      else if (isCore) { cls += ' is-fixed'; label = t('CORE', 'CORE'); }
      else {
        if (open.has(k)) { cls += ' is-open'; label = t('Open', 'Open'); }
        if (isCrack) { cls += ' is-crack'; label = open.has(k) ? t('CRACK open', 'CRACK') : t('CRACK shut', 'CRACK'); }
        if (flow.reach.has(k) && !isTank) cls += ' is-wet';
      }
      btn.className = cls;
      btn.textContent = label;
    }
    const p = coolantProblem(open);
    msg.className = `qz-note${p ? ' qz-warn' : ''}`;
    msg.textContent = p === 'leak' ? t('Coolant is leaking into the cracked pipe! Shut the crack, and find a way round it.', 'The crack is leaking! Shut it.')
      : p === 'short' ? t('The coolant does not reach the core yet. Open the valves from the tank to the core.', 'Not at the core yet. Open a way to it.')
        : t('The coolant reaches the core, and the crack stays dry. Fixed!', 'Fixed! The core is cool.');
  }
  return {
    el: wrap, ok: () => coolantProblem(open) === null,
    solve() { open.clear(); for (const k of COOLANT_ANSWER) open.add(k); changed(); },
    state: () => ({ open: [...open].sort() }), refresh,
    tip: t('Coolant keeps the fusion core from getting too hot. A pipe has cracked: the coolant must reach the core, but it must not reach the crack.', 'Coolant cools the core. Get it to the core, and keep it out of the crack.'),
  };
}

// The sky for the dish: the Sun and Earth as dots round a dial, and the dish's beam.
const STARS = [[18, 22], [52, 14], [96, 30], [140, 12], [230, 20], [280, 36], [300, 150], [24, 170], [70, 186], [250, 180], [306, 110], [160, 190]];
function drawSky(ctx, deg) {
  const W = 320; const H = 200; const cx = W / 2; const cy = H / 2 + 6; const R = 84;
  const at = (a, r) => [cx + Math.sin((a * Math.PI) / 180) * r, cy - Math.cos((a * Math.PI) / 180) * r];
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (const [x, y] of STARS) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = '#2a3a66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  const [sx, sy] = at(DISH.sun, R * 0.95);
  ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
  const [ex, ey] = at(DISH.earth, R * 0.95);
  ctx.fillStyle = '#5aa9ff'; ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfe8ff'; ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Sun', sx - 12, sy - 14);
  ctx.fillText('Earth', ex - 18, ey - 14);
  const on = dishOnEarth(deg);
  const [dx, dy] = at(deg, R * 0.8);
  ctx.strokeStyle = on ? '#9fe8a8' : '#ffd27a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  ctx.fillStyle = on ? '#9fe8a8' : '#ffd27a'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
}

function messageBody(changed) {
  let deg = 0;
  const wrap = el('div', 'qz-body');
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200; cv.className = 'qz-sky';
  const ctx = cv.getContext('2d');
  const left = el('button', 'qz-step', `◀ ${t('Turn left', 'Left')}`); left.type = 'button';
  const right = el('button', 'qz-step', `${t('Turn right', 'Right')} ▶`); right.type = 'button';
  const readout = el('div', 'qz-num');
  const row = el('div', 'qz-row'); row.append(left, readout, right);
  const note = el('div', 'qz-note');
  stepper(left, () => { deg = dishTurn(deg, -1); changed(); });
  stepper(right, () => { deg = dishTurn(deg, 1); changed(); });
  wrap.append(cv, row, note);
  function refresh() {
    drawSky(ctx, deg);
    readout.textContent = `${t('Dish', 'Dish')}: ${deg}°`;
    const on = dishOnEarth(deg);
    note.className = `qz-note${on ? '' : ' qz-warn'}`;
    note.textContent = on ? t('Locked on Earth! The message is on its way home.', 'Locked on Earth!')
      : t(`Turn the dish until it points at Earth (the blue dot). Each press turns it ${DISH.step} degrees. It is ${angleGap(deg, DISH.earth)}° out.`, 'Point the dish at the blue dot.');
  }
  return {
    el: wrap, ok: () => dishOnEarth(deg),
    solve() { deg = DISH.earth; changed(); },
    state: () => ({ deg }), refresh,
    tip: t('Send a message home. The dish has to point at Earth, far away across the sky, to send it.', 'Point the dish at Earth to send a message home.'),
  };
}

function pollenBody(changed) {
  let st = { holding: null, fruit: [] };
  let problem = null;
  const wrap = el('div', 'qz-body');
  const bed = el('div', 'qz-bed');
  const btns = FLOWERS.map((f) => {
    const b = el('button', 'qz-flower'); b.type = 'button';
    b.addEventListener('click', () => { const r = pollinate(st, f.id); st = r.state; problem = r.problem; changed(); });
    bed.append(b);
    return { b, f };
  });
  const count = el('div', 'qz-count'); const note = el('div', 'qz-note');
  wrap.append(bed, count, note);
  function refresh() {
    for (const { b, f } of btns) {
      const holding = st.holding === f.id; const fruit = st.fruit.includes(f.id);
      b.className = `qz-flower${holding ? ' is-holding' : ''}${fruit ? ' is-fruit' : ''}`;
      b.replaceChildren();
      b.append(flowerArt(f.role, fruit));
      b.append(el('span', null, f.role === 'dust' ? t('Yellow dust', 'Pollen') : fruit ? t('Strawberry', 'Berry') : t('Bud', 'Bud')));
    }
    count.textContent = `${t('Strawberries', 'Strawberries')}: ${st.fruit.length} / ${PAIRS}`;
    note.className = `qz-note${problem ? ' qz-warn' : ''}`;
    note.textContent = problem === 'order' ? t('The pollen goes first: tap a flower with yellow dust, then the bud it works with.', 'Yellow dust first, then its bud.')
      : problem === 'partner' ? t('Not that one: each yellow-dust flower only works with its own bud. Try the other bud.', 'Not that bud. Try the other one.')
        : pollinated(st) ? t(`Every bud has a strawberry now. Count them: ${PAIRS}!`, `All ${PAIRS} have a strawberry!`)
          : st.holding ? t('Now tap the bud that goes with it.', 'Now tap its bud.')
            : t('Tap a flower with yellow dust, then its bud, for each pair.', 'Tap the dust, then its bud.');
  }
  return {
    el: wrap, ok: () => pollinated(st),
    solve() { st = runPollen(pollenAnswer()).state; problem = null; changed(); },
    state: () => ({ holding: st.holding, fruit: [...st.fruit] }), refresh,
    tip: t('Each bud takes pollen from its partner flower. Real strawberries need lots of pollen grains, carried by bees on Earth. Out here we do the bees’ job with a soft brush.', 'Each bud takes pollen from its partner flower. We do the bees’ job with a brush.'),
  };
}

/** A flower drawn in CSS: five petals and a yellow centre; a bud is a green tip; a berry a red fruit on a green cap. */
function flowerArt(role, fruit) {
  return el('i', `qz-art${role === 'dust' ? ' is-dust' : ' is-bud'}${fruit ? ' is-berry' : ''}`);
}

const BODIES = { medbay: medbayBody, coolant: coolantBody, message: messageBody, pollen: pollenBody };

/**
 * Play one quest.
 * @param {string} id one of QUESTS' ids
 * @returns {Promise<{id:string, moves:number}>}
 */
export function playQuest(id, { bus = null } = {}) {
  injectStyles(); injectCss();
  const info = QUESTS.find((q) => q.id === id);
  if (!info) throw new Error(`no quest ${id}`);
  const lead = CREW_INFO[info.lead];
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = `quest-${id}`;
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
    if (window.__quest === api) delete window.__quest;
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
  window.__quest = api;
  // Unlock mode only: a grown-up can skip the puzzle.
  const skip = skipButton(() => { api.solve(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  body.refresh(); paint();
  return done;
}
