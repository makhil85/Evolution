// Chapter 7, Part D: the game "Where is it really?" (lead 2026-10-08: "we see an
// object in one place but where it actually is, it's not in the same place").
// Stars round a black hole show where their light ARRIVES. She taps where each
// star REALLY is. The rules are in lensLogic.js; this card draws them.
//
// Easy: a dotted ring (the Einstein ring) and "the real place is closer to the
// hole" are on the card; a big tolerance. Medium: the same, no ring hint.
// Hard: a smaller tolerance, and a faint second image on the other side to read.
// A miss costs a life (4 on Easy, 3 otherwise); lives gone: try again. Finding a
// star shows its light path, bent round the hole, from the real star to the
// image she saw. The grown-up Skip (unlock mode) finds them all.
//
// Opens in the play-mode modal layer like the Chapter 6 cards and pauses the game
// through the bus's 'ui-modal'. Test hook while open: window.__lens = { state(),
// solve(), tap(x, y) (theta_E units, y up), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t } from '../level.js';
import { skipButton } from '../../play/grownUp.js';
import { FLIGHT_MODE_KEY } from '../contracts.js';
import {
  SHADOW_SHARE, newGame, tapGame, truePoint, seenPoint, faintPoint, lightPath, ruleTap,
} from './lensLogic.js';

const W = 800; const H = 450; // the same stage as the lessons and the 2-D cards
const CX = 400; const CY = 225;
const UNIT = 95;              // pixels per Einstein radius
const SHADOW_PX = SHADOW_SHARE * UNIT;
const MODES = ['easy', 'medium', 'hard'];

/** The flying mode she chose (Medium if none), like the Chapter 6 cards. */
function flyingMode() {
  try { const m = localStorage.getItem(FLIGHT_MODE_KEY); return MODES.includes(m) ? m : 'medium'; } catch { return 'medium'; }
}

const toPx = (p) => ({ x: CX + p.x * UNIT, y: CY - p.y * UNIT });
const fromPx = (x, y) => ({ x: (x - CX) / UNIT, y: (CY - y) / UNIT });
const pathPx = (star) => lightPath(star).map(toPx);

/** Faint distant stars for the backdrop (a fixed pattern, so every card looks the same). */
function backdrop() {
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  for (let i = 0; i < 90; i++) out.push({ x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 1.4, a: 0.25 + rnd() * 0.6 });
  return out;
}

function drawDot(c, x, y, r, col) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, Math.PI * 2); c.fill();
}

function drawPath(c, pts, col, dash) {
  c.save();
  c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
  c.setLineDash(dash);
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
  // An arrowhead at the end: the light arrives there, at the place we see.
  const a = pts[pts.length - 2]; const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  c.setLineDash([]);
  c.fillStyle = col; c.beginPath();
  c.moveTo(b.x, b.y);
  c.lineTo(b.x - Math.cos(ang - 0.5) * 14, b.y - Math.sin(ang - 0.5) * 14);
  c.lineTo(b.x - Math.cos(ang + 0.5) * 14, b.y - Math.sin(ang + 0.5) * 14);
  c.closePath(); c.fill();
  c.restore();
}

function drawX(c, x, y, col) {
  c.save(); c.strokeStyle = col; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 11, y - 11); c.lineTo(x + 11, y + 11); c.moveTo(x + 11, y - 11); c.lineTo(x - 11, y + 11); c.stroke();
  c.restore();
}

/** The whole card picture: backdrop, hole, the stars as they look, and the feedback. */
function paint(c, g, field, mode, fb, now) {
  c.fillStyle = '#05060c'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff';
  for (const s of field) { c.globalAlpha = s.a; c.fillRect(s.x, s.y, s.r, s.r); }
  c.globalAlpha = 1;

  // Easy's hint: the dotted Einstein ring, where a star behind the hole would make a full circle of light.
  if (mode === 'easy') {
    c.save(); c.strokeStyle = 'rgba(255,230,160,0.55)'; c.lineWidth = 2; c.setLineDash([6, 8]);
    c.beginPath(); c.arc(CX, CY, UNIT, 0, Math.PI * 2); c.stroke(); c.restore(); // radius 1 theta_E
  }

  // The hole: a hot glow round a black shadow.
  const glow = c.createRadialGradient(CX, CY, SHADOW_PX * 0.9, CX, CY, UNIT * 0.75);
  glow.addColorStop(0, 'rgba(255,190,90,0.85)'); glow.addColorStop(0.35, 'rgba(255,120,40,0.35)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(CX, CY, UNIT * 0.75, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#000000'; c.beginPath(); c.arc(CX, CY, SHADOW_PX, 0, Math.PI * 2); c.fill();

  // Stars she has found: a gold mark where they really are.
  g.stars.forEach((star, i) => {
    if (i < g.next) { const p = toPx(truePoint(star)); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.fill(); }
  });
  // The stars as they LOOK (the bright image); on Hard also the faint one on the other side.
  g.stars.forEach((star, i) => {
    if (i < g.next) return;
    const p = toPx(seenPoint(star));
    drawDot(c, p.x, p.y, 4, '#cfeaff');
    if (mode === 'hard') { const f = toPx(faintPoint(star)); c.fillStyle = 'rgba(207,234,255,0.35)'; c.beginPath(); c.arc(f.x, f.y, 3, 0, Math.PI * 2); c.fill(); }
  });

  // Feedback: a hit draws the bent light from the real star to the image she saw; a miss marks the tap.
  if (fb) {
    if (fb.hit) drawPath(c, pathPx(g.stars[fb.star]), 'rgba(255,210,122,0.95)', [10, 6]);
    else drawX(c, toPx(fb.tap).x, toPx(fb.tap).y, '#ff8a8a');
  }

  // The sparkle when the last star is found.
  if (g.status === 'won') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + now * 0.0005;
      const r = 150 + 20 * Math.sin(now * 0.004 + i);
      c.fillStyle = `rgba(255,230,160,${0.35 + 0.35 * Math.sin(now * 0.006 + i)})`;
      c.beginPath(); c.arc(CX + Math.cos(a) * r, CY - Math.sin(a) * r * 0.6, 3, 0, Math.PI * 2); c.fill();
    }
  }
}

/**
 * Play the card. Resolves { won, mode, lives } when she is done or skips it.
 * @param {{ bus?: object, mode?: string, rnd?: () => number }} opts
 */
export function playLens({ bus = null, mode = flyingMode(), rnd = Math.random } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card');
  card.dataset.game = 'lens';
  const eyebrow = el('div', 'pl-eyebrow', t('Holodeck · Echo the robot', 'Holodeck · Echo'));
  const title = el('h2', 'pl-title', t('Where is it really?', 'Where is it really?'));
  const tip = el('p', 'ls-line', t(
    'The black hole bends light, so each star looks pushed away from it. Tap where each star REALLY is.',
    'The stars look pushed out. Tap where each star REALLY is!',
  ));
  const canvas = el('canvas', 'lens-canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = 'display:block;width:100%;max-width:640px;height:auto;margin:10px auto 0;border-radius:12px;background:#05060c;touch-action:none;cursor:crosshair';
  const status = el('p', 'ls-line');
  const msg = el('p', 'ls-line');
  const actions = el('div', 'ls-actions');
  const againBtn = el('button', 'ls-btn', t('Try again', 'Try again')); againBtn.type = 'button'; againBtn.hidden = true;
  const doneBtn = el('button', 'ls-btn', t('Done ✓', 'Done ✓')); doneBtn.type = 'button'; doneBtn.disabled = true;
  actions.append(againBtn, doneBtn);
  card.append(eyebrow, title, tip, canvas, status, msg, actions);
  const c = canvas.getContext('2d');
  const field = backdrop();

  let g = newGame(mode, rnd);
  let fb = null;
  let closed = false;
  let raf = 0;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });

  const hardText = () => (mode === 'hard' ? t('Hard: a faint second image is on the far side. Read the bright one.', 'Read the bright star.') : '');
  function refresh() {
    const lives = '♥'.repeat(Math.max(0, g.lives));
    status.textContent = `${t('Stars found', 'Found')}: ${g.next} / ${g.stars.length}   ${lives}`;
    if (g.status === 'won') msg.textContent = t('You found them all! You read the bent light like a scientist.', 'You found them all!');
    else if (g.status === 'lost') msg.textContent = t('Out of tries. Light can be tricky! Have another go.', 'Oops! Have another go.');
    else if (fb && !fb.hit) msg.textContent = t('Not there. Try again.', 'Not there. Try again.');
    else if (fb && fb.hit) msg.textContent = mode === 'easy'
      ? t('Yes! The real star was a little nearer the hole than it looked.', 'Yes! The real star was a little nearer the hole.')
      : t('Yes! The light bent round the hole, so the star looked further out.', 'Yes! That is where it really is.');
    else msg.textContent = hardText();
    againBtn.hidden = g.status !== 'lost';
    doneBtn.disabled = g.status !== 'won';
    doneBtn.classList.toggle('is-ready', g.status === 'won');
  }

  function act(pt) {
    if (closed || g.status !== 'playing') return;
    g = tapGame(g, pt);
    fb = { tap: pt, hit: g.last.hit, star: g.last.star };
    refresh();
  }

  function frame(now) {
    if (closed) return;
    paint(c, g, field, mode, fb, now);
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = canvas.getBoundingClientRect();
    act(fromPx((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)));
  });
  againBtn.addEventListener('click', () => { g = newGame(mode, rnd); fb = null; refresh(); });

  const layer = openLayer(card, {
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }

  function finish() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    layer.close();
    if (window.__lens === api) delete window.__lens;
    finishFn({ won: g.status === 'won', mode, lives: g.lives });
  }
  doneBtn.addEventListener('click', () => { if (g.status === 'won') finish(); });

  const api = {
    get open() { return !closed; },
    state: () => ({ mode, status: g.status, found: g.next, total: g.stars.length, lives: g.lives }),
    /** Finds every star (the grown-up Skip, and the bot test). */
    solve() { while (g.status === 'playing') act(truePoint(g.stars[g.next])); return g.status === 'won'; },
    /** One tap, in theta_E units (y up): the bot test and the console use it. */
    tap(x, y) { act({ x, y }); return g.status; },
    /** Test hook only: where the next star really is, and where it looks (theta_E units). */
    aim() { const s = g.stars[g.next]; return s ? { true: truePoint(s), seen: seenPoint(s) } : null; },
    /** The rule a child can learn: tap where the bright image's rule says the star is. */
    rule() { return g.stars[g.next] ? ruleTap(g.stars[g.next], mode) : null; },
    done() { finish(); return closed; },
  };
  window.__lens = api;
  // Unlock mode only: a grown-up can skip the game.
  const skip = skipButton(() => { api.solve(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);

  refresh();
  raf = requestAnimationFrame(frame);
  return done;
}
