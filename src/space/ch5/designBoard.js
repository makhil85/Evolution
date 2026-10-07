// Design the rock ship (Chapter 5, Part D): five questions, and with each
// right answer the blueprint on the left gains a part. By the end she has
// "invented" the ship herself: a thick rock shield, hollowed out to live in,
// the fusion engine behind, the rock itself giving water, fuel and metal,
// and the fuel sum that says why hollowing it out matters.
//
// The rock ship is presented as a real plan (scientists have proposed
// hollowed-out asteroids as starships), not a fantasy.
//
// Opens in the play-mode modal layer like the lesson card; pauses the space
// game through the bus's 'ui-modal'. Test hook while open:
// window.__design = { open, state(), answer(), answerAll() }.
import { el, openLayer } from '../../play/ui.js';
import { t } from '../level.js';
import { injectStyles } from '../../lesson/card.js';
import { label, arrow, circle, rect, span, STAGE_W, STAGE_H } from '../../lesson/draw.js';
import { skipButton } from '../../play/grownUp.js';

const TAU = Math.PI * 2;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);
const INK = '#cfe8ff';

/** The rock's outline: a lumpy oval, the same every frame. */
function rockPath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const k = 1 + 0.06 * Math.sin(a * 3 + 0.7) + 0.04 * Math.sin(a * 7 + 2.1);
    const x = cx + Math.cos(a) * rx * k; const y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The blueprint, with parts 0..n shown (`grow` 0..1 fades the newest in). */
export function drawBlueprint(ctx, n, grow, T = 0) {
  ctx.fillStyle = '#0d2a4a'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.strokeStyle = 'rgba(160,200,255,0.12)'; ctx.lineWidth = 1;
  for (let x = 0; x <= STAGE_W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, STAGE_H); ctx.stroke(); }
  for (let y = 0; y <= STAGE_H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(STAGE_W, y); ctx.stroke(); }
  label(ctx, t('ROCK SHIP · DESIGN', 'ROCK SHIP'), 120, 28, { size: 16, color: INK, halo: null });
  const cx = 440; const cy = 220; const rx = 250; const ry = 150;
  const a = (k) => (n > k ? 1 : n === k ? grow : 0);
  // 0. Nothing yet: a dashed outline waiting for the first answer.
  if (a(1) < 1) {
    ctx.save(); ctx.globalAlpha = 1 - a(1);
    rockPath(ctx, cx, cy, rx, ry); ctx.strokeStyle = 'rgba(207,232,255,0.55)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    label(ctx, '?', cx, cy + 20, { size: 90, color: 'rgba(207,232,255,0.5)', halo: null });
    label(ctx, t('Each answer adds a part', 'Each answer adds a part'), cx, cy + ry + 34, { size: 16, color: INK, halo: null });
    ctx.restore();
  }
  // 1. The thick rock shield.
  if (a(1) > 0) {
    ctx.save(); ctx.globalAlpha = a(1);
    rockPath(ctx, cx, cy, rx, ry); ctx.fillStyle = '#6b5a4a'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    label(ctx, t('thick rock: stops radiation', 'thick rock shield'), cx, cy - ry - 22, { size: 16, color: INK, halo: null });
    ctx.restore();
  }
  // 2. Hollowed out: rooms inside a thick shell.
  if (a(2) > 0) {
    ctx.save(); ctx.globalAlpha = a(2);
    rockPath(ctx, cx, cy, rx * 0.72, ry * 0.62); ctx.fillStyle = '#1b3d63'; ctx.fill();
    ctx.strokeStyle = INK; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    for (const dy of [-35, 0, 35]) { ctx.strokeStyle = 'rgba(207,232,255,0.6)'; ctx.beginPath(); ctx.moveTo(cx - 140, cy + dy); ctx.lineTo(cx + 140, cy + dy); ctx.stroke(); }
    for (const dx of [-70, 10, 90]) rect(ctx, cx + dx - 14, cy - 28, 28, 22, 'rgba(255,210,122,0.5)', 3);
    label(ctx, t('hollow: home inside', 'hollow inside: rooms'), cx, cy + 62, { size: 15, color: INK, halo: null });
    // the shell's thickness
    arrow(ctx, cx + rx * 0.72 + 4, cy, cx + rx - 6, cy, '#ffd27a', 3);
    arrow(ctx, cx + rx - 6, cy, cx + rx * 0.72 + 4, cy, '#ffd27a', 3);
    ctx.restore();
  }
  // 3. The engine behind, pushing gas out the back.
  if (a(3) > 0) {
    ctx.save(); ctx.globalAlpha = a(3);
    const ex = cx - rx - 6;
    ctx.fillStyle = '#9fb3c8'; ctx.beginPath(); ctx.moveTo(ex + 20, cy - 34); ctx.lineTo(ex - 40, cy - 60); ctx.lineTo(ex - 40, cy + 60); ctx.lineTo(ex + 20, cy + 34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    const fl = 0.75 + 0.25 * Math.sin(T * 9);
    const g = ctx.createLinearGradient(ex - 40, 0, ex - 40 - 110 * fl, 0);
    g.addColorStop(0, 'rgba(160,220,255,0.95)'); g.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ex - 40, cy - 50); ctx.lineTo(ex - 40 - 110 * fl, cy); ctx.lineTo(ex - 40, cy + 50); ctx.closePath(); ctx.fill();
    label(ctx, t('fusion engine', 'engine'), ex - 10, cy + 84, { size: 15, color: INK, halo: null });
    arrow(ctx, cx + rx + 20, cy, cx + rx + 80, cy, '#9fe8a8', 6);
    label(ctx, t('goes this way', 'this way'), cx + rx + 50, cy - 24, { size: 14, color: '#9fe8a8', halo: null });
    ctx.restore();
  }
  // 4. What the rock gives: water, fuel, metal.
  if (a(4) > 0) {
    ctx.save(); ctx.globalAlpha = a(4);
    const items = [['💧', t('water', 'water')], ['⚛', t('fusion fuel', 'fuel')], ['⚙', t('metal', 'metal')]];
    items.forEach(([icon, name], i) => {
      const x = 560 + i * 70; const y = 395;
      circle(ctx, x, y, 22, 'rgba(255,210,122,0.18)', '#ffd27a', 2);
      label(ctx, icon, x, y, { size: 20, color: '#fff', halo: null });
      label(ctx, name, x, y + 34, { size: 13, color: INK, halo: null });
    });
    arrow(ctx, cx + 60, cy + ry - 8, 600, 365, '#ffd27a', 3);
    ctx.restore();
  }
  // 5. The fuel sum: hollow ship vs solid rock.
  if (a(5) > 0) {
    ctx.save(); ctx.globalAlpha = a(5);
    rect(ctx, 26, 330, 250, 100, 'rgba(6,16,30,0.75)', 10);
    label(ctx, t('fuel for each step faster', 'fuel each time'), 151, 348, { size: 14, color: INK, halo: null });
    rect(ctx, 40, 366, 60 * 0.6, 18, '#9fe8a8', 3);
    label(ctx, t('hollow: 600 t', 'hollow: 600'), 160, 375, { size: 14, color: '#9fe8a8', halo: null, align: 'left' });
    rect(ctx, 40, 396, Math.min(220, 60 * 3), 18, '#ff8a8a', 3);
    label(ctx, t('solid: 3,000 t', 'solid: 3,000'), 230, 415, { size: 14, color: '#ff8a8a', halo: null, align: 'left' });
    ctx.restore();
  }
}

/** The five questions, one per part. */
export const DESIGN_STEPS = [
  {
    prompt: ['Between the stars, radiation (tiny fast particles) hits the ship all the time, for years. What protects the crew best?', 'Space has bad rays. What keeps the crew safe?'],
    choices: [
      { text: ['A very thick layer of rock all round them', 'Lots of thick rock all round'], correct: true },
      { text: ['A thin sheet of shiny metal foil', 'Thin shiny foil'] },
      { text: ['Nothing: space is empty, so there is nothing to stop', 'Nothing'] },
    ],
    why: ['Metres of rock soak up radiation, like the ground over a cave. A rock ship carries its shield with it.', 'Thick rock stops the bad rays!'],
  },
  {
    prompt: ['A solid rock that big would be far too heavy to push. What should we do with it?', 'A big rock is very heavy. What can we do?'],
    choices: [
      { text: ['Make it smaller: use a pebble-sized rock', 'Use a tiny rock'] },
      { text: ['Hollow it out: keep a thick shell and live inside', 'Make it hollow and live inside'], correct: true },
      { text: ['Push harder: heavy does not matter in space', 'Push harder'] },
    ],
    why: ['Hollow it out! The thick shell still shields you, the inside becomes your home, and the ship is far lighter to push.', 'Hollow it out and live inside!'],
  },
  {
    prompt: ['Remember the momentum lesson. Where does the fusion engine go?', 'Where does the engine go?'],
    choices: [
      { text: ['On the front, pulling the rock along', 'At the front'] },
      { text: ['In the middle, pushing on the walls', 'In the middle'] },
      { text: ['At the back, throwing gas out behind so the ship goes forward', 'At the back'], correct: true },
    ],
    why: ['Gas thrown out the back pushes the ship forward: the total momentum stays the same, just like the lump and the spaceship.', 'At the back! Gas goes back, ship goes forward.'],
  },
  {
    prompt: ['Why build the ship out of an icy rock with metal in it, instead of bringing everything from Earth?', 'Why use an icy rock with metal in it?'],
    choices: [
      { text: ['The rock gives water to drink, fuel for the engine and metal for parts', 'It gives water, fuel and metal'], correct: true },
      { text: ['Icy rocks are prettier', 'They look nice'] },
      { text: ['There is no reason: any rock would do', 'Any rock is fine'] },
    ],
    why: ['Ice is water to drink and to split for fusion fuel (heavy hydrogen), and the metal makes parts. Everything we need, out here, without lifting it from Earth.', 'The rock gives water, fuel and metal!'],
  },
  {
    type: 'text',
    prompt: ['To speed up one step, the engine needs 1 tonne of fuel for every 1,000 tonnes of ship. Our hollowed ship weighs 600,000 tonnes. How many tonnes of fuel for one step? (Type a number.)', 'The ship weighs 600,000 tonnes. It needs 1 tonne of fuel for every 1,000 tonnes. How much fuel?'],
    answers: ['600', '600 t', '600 tonnes'],
    hint: ['How many thousands are in 600,000?', 'How many 1,000s in 600,000?'],
    why: ['600,000 ÷ 1,000 = 600 tonnes. Left solid, the rock would weigh 3,000,000 tonnes and need 3,000: hollowing it saves 4 of every 5 tonnes of fuel.', '600 tonnes! A solid rock would need 3,000.'],
  },
];

const norm = (s) => String(s).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');

/** @returns {Promise<{tries:number[]}>} */
export function playDesignBoard({ bus = null } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card is-asking');
  card.dataset.game = 'design-ship';
  const eyebrow = el('div', 'pl-eyebrow', t('Design the ship', 'Make the ship'));
  const title = el('h2', 'pl-title', t('A ship made of rock', 'A rock ship'));
  const stage = el('div', 'ls-stage');
  const view = el('div', 'ls-view');
  const canvas = el('canvas', 'ls-canvas');
  view.append(canvas);
  const side = el('div', 'ls-side');
  const qBox = el('div', 'ls-q');
  const prompt = el('p', 'ls-prompt');
  const choices = el('div', 'ls-choices');
  const fb = el('div', 'ls-feedback'); fb.hidden = true;
  qBox.append(el('div', 'ls-who', t('Mission Control asks', 'Question')), prompt, choices, fb);
  side.append(qBox);
  stage.append(view, side);
  const actions = el('div', 'ls-actions');
  const dots = el('div', 'ls-dots');
  DESIGN_STEPS.forEach(() => dots.appendChild(el('span', 'ls-dot')));
  const nextBtn = el('button', 'ls-btn', 'Next'); nextBtn.type = 'button'; nextBtn.hidden = true;
  actions.append(dots, nextBtn);
  card.append(eyebrow, title, stage, actions);

  let ix = 0; let parts = 0; let grow = 1; let tries = 0; let done = false;
  const triesLog = [];
  let closed = false; let finishFn;
  const promise = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) { if ((e.key === 'Enter' || e.key === 'ArrowRight') && !nextBtn.hidden) { e.preventDefault(); next(); } },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  nextBtn.addEventListener('click', next);

  function show(i) {
    ix = i; tries = 0; done = false;
    const q = DESIGN_STEPS[i];
    prompt.textContent = pick(q.prompt);
    choices.textContent = ''; choices.classList.remove('is-done');
    fb.hidden = true; nextBtn.hidden = true;
    [...dots.children].forEach((d, k) => { d.className = `ls-dot${k < i ? ' is-done' : k === i ? ' is-active' : ''}`; });
    if (q.type === 'text') {
      const input = el('input', 'ls-choice');
      input.type = 'text'; input.inputMode = 'numeric'; input.placeholder = t('Type a number', 'Type a number');
      const go = el('button', 'ls-btn', t('Check', 'Check')); go.type = 'button';
      const check = () => grade(q.answers.map(norm).includes(norm(input.value)), go);
      go.addEventListener('click', check);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); check(); } });
      choices.append(input, go);
      setTimeout(() => { try { input.focus(); } catch { /* closed */ } }, 0);
    } else {
      for (const c of q.choices) {
        const b = el('button', 'ls-choice', pick(c.text)); b.type = 'button';
        if (c.correct) b.dataset.correct = '1';
        b.addEventListener('click', () => grade(!!c.correct, b));
        choices.appendChild(b);
      }
    }
  }
  function grade(right, btn) {
    if (done) return;
    tries++;
    const q = DESIGN_STEPS[ix];
    if (!right && tries < 2) {
      btn.classList?.add('is-wrong'); if (btn.tagName === 'BUTTON' && btn.classList.contains('ls-choice')) btn.disabled = true;
      fb.className = 'ls-feedback is-warn'; fb.textContent = q.hint ? pick(q.hint) : t('Not quite. Think again!', 'Try again!'); fb.hidden = false;
      return;
    }
    done = true; triesLog.push(tries);
    choices.classList.add('is-done');
    choices.querySelector('[data-correct="1"]')?.classList.add('is-right');
    fb.className = `ls-feedback is-${right ? 'good' : 'warn'}`;
    fb.textContent = `${right ? '★ ' : ''}${pick(q.why)}`; fb.hidden = false;
    parts = ix + 1; grow = 0; // the blueprint gains its part
    nextBtn.textContent = ix === DESIGN_STEPS.length - 1 ? t('Find the rock!', 'Find the rock!') : 'Next';
    nextBtn.hidden = false; nextBtn.classList.add('is-ready');
  }
  function next() {
    if (!done) return;
    if (ix < DESIGN_STEPS.length - 1) show(ix + 1); else finish();
  }
  function finish() {
    if (closed) return;
    closed = true; layer.close();
    if (window.__design === api) delete window.__design;
    finishFn({ tries: triesLog });
  }

  let T = 0; let last = performance.now();
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; T += dt;
    grow = Math.min(1, grow + dt / 1.2);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 600; const H = canvas.clientHeight || 340;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    ctx.setTransform(s, 0, 0, s, (canvas.width - STAGE_W * s) / 2, (canvas.height - STAGE_H * s) / 2);
    drawBlueprint(ctx, parts, span(grow, 0, 1), T);
    requestAnimationFrame(frame);
  }

  const api = {
    get open() { return !closed; },
    state() { return { step: ix, parts, done }; },
    /** Answer the current question right, and go on. */
    answer() {
      const q = DESIGN_STEPS[ix];
      if (!done) { if (q.type === 'text') { const i = choices.querySelector('input'); i.value = q.answers[0]; choices.querySelector('button').click(); } else choices.querySelector('[data-correct="1"]').click(); }
      next();
      return closed ? 'finished' : this.state();
    },
    answerAll() { for (let k = 0; k < 20 && !closed; k++) this.answer(); return closed; },
    shot() { return canvas.toDataURL('image/png'); },
  };
  window.__design = api;
  // Unlock mode only: a grown-up can skip this game.
  const skip = skipButton(() => api.answerAll(), 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  show(0);
  requestAnimationFrame(frame);
  return promise;
}
