// Chapter 7, Part B: the drop test in the cargo bay (lead 2026-10-08). A ball is
// held 1 m above the floor; she lets go and the card times how long it takes to
// land. The push is the step's (gentle, then full), and the card has all three
// pushes to try: drive off (the ball does not fall at all), gentle and full. The
// numbers come from floatLogic.js (t = sqrt(2h / a)).
//
// A 2-D card on the 800 x 450 stage, opened over the walk like the quests
// (openLayer; the 'ui-modal' bus event pauses the game). Done lights after a drop
// at the step's own push. Test hook while open: window.__drop = { push(id),
// drop(), state(), solve(), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { CREW_INFO } from '../ch6/crewInfo.js';
import { skipButton } from '../../play/grownUp.js';
import { PUSH, DROP_H, fallSeconds } from './floatLogic.js';

const STAGE_W = 800; const STAGE_H = 450;
const FLOOR_Y = 384; const M_PX = 250; // the floor's height in the picture, and pixels per metre of height
const OFF_WATCH_S = 4; // a drive-off drop is watched this long: the ball just stays
const FULL_SLOW = 0.2; // the full push is played in slow motion (0.45 s would be over in a blink)

const PUSHES = Object.freeze({
  off: { id: 'off', label: t('Drive off', 'Drive off'), a: PUSH.off },
  gentle: { id: 'gentle', label: t('Gentle push', 'Gentle push'), a: PUSH.gentle },
  full: { id: 'full', label: t('Full push', 'Full push'), a: PUSH.full },
});
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

/** What the card says about a push: [before the drop, after it has landed (or stayed put)]. */
export function dropWords(id) {
  const a = PUSHES[id].a;
  if (id === 'off') return [
    t('Drive off: no push at all. Let go, and watch the ball.', 'Drive off: no push. Watch the ball.'),
    t('It did not fall at all! The ship is coasting, so the ball comes along with us.', 'It did not fall! It floats.'),
  ];
  if (id === 'gentle') return [
    t('Gentle push: 1/100 of Earth’s pull. Let go, and watch it drift down.', 'Gentle push: very gentle. Let go and watch!'),
    t(`It took ${fallSeconds(a).toFixed(1)} seconds to land. Slow, like a feather!`, `It took about ${Math.round(fallSeconds(a))} seconds to land!`),
  ];
  return [
    t('Full push: 1 g, the same pull as Earth. Let go!', 'Full push: like Earth. Let go!'),
    t(`It took ${fallSeconds(a).toFixed(2)} seconds to land. Quick, just like on Earth!`, 'It landed in less than a second!'),
  ];
}

const CSS_ID = 'ch7-drop-css';
const CSS = `
.dt-push { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.dt-push button { min-height: 40px; padding: 0 14px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
.dt-push button[aria-pressed="true"] { border-color: #7fd3ff; background: rgba(127,211,255,.16); }
.dt-read { margin-top: 10px; font-size: 18px; font-weight: 900; min-height: 1.4em; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

/** The picture: a cargo bay with crates, the floor, a 1 m ruler, the push arrow, the ball at height y (m), the clock. */
function drawBay(ctx, { push, y, time }) {
  ctx.fillStyle = '#0d1430'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = '#1b2748'; ctx.fillRect(0, 0, STAGE_W, FLOOR_Y);
  ctx.fillStyle = '#2b3a66';
  for (let i = 0; i < 4; i++) ctx.fillRect(560 + i * 50, FLOOR_Y - 60 - (i % 2) * 20, 42, 60 + (i % 2) * 20);
  ctx.fillStyle = '#4a5c86'; ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(0, FLOOR_Y, STAGE_W, 4);
  // the 1 m ruler on the left, from the floor up
  const x0 = 150; const top = FLOOR_Y - DROP_H * M_PX;
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, FLOOR_Y); ctx.lineTo(x0, top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0 - 10, top); ctx.lineTo(x0 + 10, top); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = '800 20px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('1 m', x0 - 16, (top + FLOOR_Y) / 2);
  // the push: an arrow under the floor, pointing up (the floor comes up to meet the ball)
  if (push !== 'off') {
    const len = push === 'full' ? 120 : 46; const yb = FLOOR_Y + 60;
    ctx.fillStyle = '#ff7a3d'; ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(400, yb); ctx.lineTo(400, yb - len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(400, yb - len - 6); ctx.lineTo(386, yb - len + 12); ctx.lineTo(414, yb - len + 12); ctx.closePath(); ctx.fill();
    ctx.font = '800 16px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(push === 'full' ? 'the push: 1 g' : 'the push: 1/100 g', 420, yb - len / 2);
  }
  // the ball
  const bx = 400; const by = FLOOR_Y - Math.max(0, y) * M_PX - 16;
  ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(bx, by, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#05060a'; ctx.lineWidth = 2; ctx.stroke();
  // the clock (the full push is in slow motion: say so)
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '900 34px system-ui, sans-serif';
  if (time != null) ctx.fillText(`${time.toFixed(2)} s`, 680, 60);
  ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = '#cfe8ff';
  if (push === 'full' && time != null) ctx.fillText('(slow motion)', 680, 88);
}

/**
 * Play the drop test at `push` (the step's push). Resolves when the child
 * presses Done, which lights after a drop at that push has finished.
 * @returns {Promise<{ push: string, seconds: number|null }>}
 */
export function playDropTest(push = 'gentle', { bus = null } = {}) {
  injectStyles(); injectCss();
  const target = PUSHES[push] ? push : 'gentle';
  const crew = CREW_INFO.builder;
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = `drop-${target}`;
  const eyebrow = el('div', 'pl-eyebrow', `${t('Cargo bay', 'Cargo bay')} · ${crew.name}`);
  eyebrow.style.color = crew.color;
  const title = el('h2', 'pl-title', t('Drop test: let go of the ball', 'Drop the ball!'));
  const tip = el('p', 'ls-line', t('The ball is 1 m above the floor. Let go, and time how long it takes to land. Try each push.', 'Let go of the ball and watch it land. Try each push!'));
  const pushRow = el('div', 'dt-push');
  const pushBtns = Object.values(PUSHES).map((p) => {
    const b = el('button', null, pick(p.label)); b.type = 'button';
    b.addEventListener('click', () => choose(p.id));
    pushRow.append(b);
    return { b, id: p.id };
  });
  const view = el('div', 'ls-view');
  const cv = document.createElement('canvas'); cv.width = STAGE_W; cv.height = STAGE_H; cv.className = 'ls-canvas';
  view.append(cv);
  const ctx = cv.getContext('2d');
  const read = el('div', 'dt-read');
  const actions = el('div', 'ls-actions');
  const dropBtn = el('button', 'ls-btn', t('Let go ✓', 'Let go!')); dropBtn.type = 'button';
  const doneBtn = el('button', 'ls-btn', t('Done ✓', 'Done ✓')); doneBtn.type = 'button'; doneBtn.disabled = true;
  actions.append(el('div', 'ls-dots'), dropBtn, doneBtn);
  card.append(eyebrow, title, tip, pushRow, view, read, actions);

  // The picture: the push on show, the ball's height and clock now, and the last drop (if any).
  let cur = target;
  let drop = null; // { push, a, seconds, tau, speed, end, done }
  let frame = 0; let lastNow = 0; let finished = false;
  let shown = { y: DROP_H, time: null, landed: false };
  const seconds = {}; // push id -> seconds it took to land (null: no fall)
  let doneReady = false;

  function choose(id) {
    if (drop && !drop.done) return;
    cur = id; shown = { y: DROP_H, time: null, landed: false };
    paint();
  }
  function startDrop() {
    if (drop && !drop.done) return;
    const a = PUSHES[cur].a;
    drop = { push: cur, a, seconds: a > 0 ? fallSeconds(a) : null, tau: 0, speed: cur === 'full' ? FULL_SLOW : 1, end: a > 0 ? fallSeconds(a) : OFF_WATCH_S, done: false };
    shown = { y: DROP_H, time: null, landed: false };
    lastNow = performance.now();
    paint();
    frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!drop || finished) return;
    const dt = Math.max(0, (now - lastNow) / 1000); lastNow = now;
    drop.tau = Math.min(drop.end, drop.tau + dt * drop.speed);
    const tau = drop.tau;
    const a = drop.a;
    const y = a > 0 ? Math.max(0, DROP_H - (a * tau * tau) / 2) : DROP_H;
    drop.done = tau >= drop.end - 1e-9;
    shown = { y, time: a > 0 ? tau : null, landed: drop.done && a > 0 };
    if (drop.done) { seconds[drop.push] = drop.seconds; if (drop.push === target) doneReady = true; }
    paint();
    if (!drop.done) frame = requestAnimationFrame(tick);
  }
  function paint() {
    for (const { b, id } of pushBtns) b.setAttribute('aria-pressed', String(id === cur));
    drawBay(ctx, { push: cur, y: shown.y, time: shown.time });
    const words = dropWords(cur);
    if (drop && !drop.done) read.textContent = t('Falling...', 'Falling...');
    else if (drop && drop.done && drop.push === cur) read.textContent = words[1];
    else read.textContent = words[0];
    dropBtn.disabled = !!(drop && !drop.done);
    doneBtn.disabled = !doneReady;
    doneBtn.classList.toggle('is-ready', !doneBtn.disabled);
  }

  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) { if (e.key === 'Enter' && !doneBtn.disabled && document.activeElement === doneBtn) finish(); },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  dropBtn.addEventListener('click', startDrop);
  function finish() {
    if (closed || doneBtn.disabled) return;
    closed = true; finished = true;
    cancelAnimationFrame(frame);
    layer.close();
    if (window.__drop === api) delete window.__drop;
    finishFn({ push: target, seconds: seconds[target] ?? null });
  }
  doneBtn.addEventListener('click', finish);
  const api = {
    push: (id) => { if (PUSHES[id]) choose(id); return cur; },
    drop: () => { startDrop(); return drop?.push ?? null; },
    state: () => ({ push: cur, target, falling: !!(drop && !drop.done), y: +shown.y.toFixed(3), landed: shown.landed, seconds: seconds[target] ?? null, canDone: !doneBtn.disabled }),
    /** Finish the test at once (the grown-up's skip and the test hook). */
    solve() { seconds[target] = PUSHES[target].a > 0 ? fallSeconds(PUSHES[target].a) : null; doneReady = true; paint(); return true; },
    done() { finish(); return closed; },
  };
  window.__drop = api;
  // Unlock mode only: a grown-up can skip the test.
  const skip = skipButton(() => { api.solve(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  paint();
  return done;
}
