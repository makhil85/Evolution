// Chapter 7, Part B: the zero-g float game in the engine room (lead 2026-10-08:
// "how to interact in zero g ... the ship is accelerating?"). The drive is off:
// nothing pushes her, so she floats in a straight line until she grabs a handle
// or bumps a wall. Then she pushes off (tap where she wants to go), or throws a
// tool the other way (Newton's third law: the tool's momentum is shared with her).
// Collect the 3 parts, then reach the hatch on the right. The rules and the
// room's layout are in floatLogic.js (node tests them in scripts/test-ch7-push.mjs).
//
// A 2-D card on the 800 x 450 stage, like the quests: the room fills the top,
// the status and the buttons sit under it. Easy has an arrow to the next part,
// Medium and Hard do not; Hard allows 3 throws. Mouse or touch: tap the room.
// Keys: 1 and 2 pick the wrench and the spanner; Tab moves between buttons.
// After a throw, a callout shows the two arrows (the tool one way, her shorter
// arrow the other) and the momentum sum (Level 4) or the rule (Level 1).
//
// Opens in the play-mode modal layer and pauses the game through the bus's
// 'ui-modal'. Test hook while open: window.__float = { mode(id), state(),
// solve(), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t, LEVEL } from '../level.js';
import { CREW_INFO } from '../ch6/crewInfo.js';
import { skipButton } from '../../play/grownUp.js';
import { newGame, step, push, throwTool, playOut, sensibleAct, nextTarget, MODES, MODE_BLURB, ROOM, SHIP, CATCH_R, TOOLS, throwGain, throwSum } from './floatLogic.js';
import { arrow, label, rect } from '../../lesson/draw.js';

const STAGE_W = 800; const STAGE_H = 450;
const ROOM_H_PX = 400; // the room's picture; the status strip is under it
const SCALE = STAGE_W / ROOM.w; // pixels per metre (66.7)
const FIXED_DT = 1 / 60;
const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);
const px = (m) => m * SCALE;

const CSS_ID = 'ch7-float-css';
// Lead 2026-10-09: every button must be on screen at 1280x720, 1280x600 and 1024x640.
// The room is the only part that gives way: its width is 16:9 of the height left
// after the text and the buttons (the 330 px is that text and button height, measured
// in the browser). The card still scrolls if a small window is shorter than that.
const CSS = `
.fg-card .ls-line { min-height: 0; margin: 6px 0 0; font-size: 15px; }
.fg-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.fg-row button { min-height: 38px; padding: 0 12px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
.fg-row button[aria-pressed="true"] { border-color: #7fd3ff; background: rgba(127,211,255,.16); }
.fg-row button:disabled { opacity: .4; cursor: default; }
.fg-view { width: min(100%, calc((100vh - 340px) * 16 / 9)); margin: 8px auto 0; }
.fg-view .fg-canvas { display: block; width: 100%; height: auto; }
.fg-note { font-size: 16px; font-weight: 800; line-height: 1.4; margin-top: 6px; min-height: 1.4em; }
.fg-note.is-warn { color: #ffd27a; }
.fg-note.is-good { color: #9fe8a8; }
.fg-blurb { font-size: 15px; color: #cfe8ff; margin: 4px 0 0; }
.fg-card .ls-actions { margin-top: 10px; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

/**
 * The callout for four seconds after a throw: the tool's arrow one way, her
 * shorter arrow the other (her speed is the smaller), and the sum (Level 4) or
 * the rule in plain words (Level 1). Momentum is conserved: the same m × v each way.
 */
function drawCallout(ctx, s, hx, hy) {
  const c = s.callout;
  if (!c || s.t < c.at || s.t - c.at > 4) return;
  const T = TOOLS[c.kind];
  const u = c.dir; // the direction she was sent in, from the throw
  ctx.save();
  ctx.globalAlpha = Math.min(1, 4 - (s.t - c.at));
  const toolLen = 60 + 25 * T.speed; // the tool: its speed
  const herLen = 30 + 40 * throwGain(c.kind); // her: her speed, shorter
  arrow(ctx, hx, hy, hx - u.x * toolLen, hy - u.y * toolLen, '#ff7a3d', 8);
  arrow(ctx, hx, hy, hx + u.x * herLen, hy + u.y * herLen, '#7fd3ff', 6);
  label(ctx, pick(T.name), hx - u.x * (toolLen + 16), hy - u.y * (toolLen + 16), { size: 14, color: '#ffb347', halo: 'rgba(0,0,0,0.7)' });
  label(ctx, 'Zara', hx + u.x * (herLen + 26), hy + u.y * (herLen + 26), { size: 14, color: '#7fd3ff', halo: 'rgba(0,0,0,0.7)' });
  rect(ctx, 150, 16, 500, 36, 'rgba(5,6,10,0.8)', 10);
  label(ctx, t(throwSum(c.kind), 'Throw one way, float the other way!'), 400, 34, { size: 20, color: '#ffffff', halo: null });
  label(ctx, t('Arrows not to scale', 'Arrows are not to scale'), 400, 62, { size: 13, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
  ctx.restore();
}

/** Draw the room, the things in it, her, and (Easy) the arrow to the next part. */
function drawRoom(ctx, s, hint) {
  const W = STAGE_W; const H = STAGE_H;
  ctx.fillStyle = '#080d1d'; ctx.fillRect(0, 0, W, H);
  // room floor pattern: faint panel lines
  ctx.strokeStyle = 'rgba(127,211,255,.08)'; ctx.lineWidth = 1;
  for (let x = 0; x <= ROOM.w; x++) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), ROOM_H_PX); ctx.stroke(); }
  for (let y = 0; y <= ROOM.h; y++) { ctx.beginPath(); ctx.moveTo(0, px(y)); ctx.lineTo(W, px(y)); ctx.stroke(); }
  // the walls
  ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, ROOM_H_PX - 6);
  // the hatch on the right wall: grey and locked until all parts are in
  const hy0 = px(ROOM.hatch.y0); const hy1 = px(ROOM.hatch.y1);
  const open = s.got.length === s.room.parts.length;
  ctx.fillStyle = open ? '#9fe8a8' : '#55607a'; ctx.fillRect(W - 10, hy0, 10, hy1 - hy0);
  ctx.fillStyle = open ? '#9fe8a8' : '#cfe8ff'; ctx.font = '800 15px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'HATCH' : 'LOCKED', W - 18, (hy0 + hy1) / 2);
  // crates
  for (const b of s.room.blocks) {
    ctx.fillStyle = '#7b5a3a'; ctx.fillRect(px(b.x), px(b.y), px(b.w), px(b.h));
    ctx.strokeStyle = '#c99d6b'; ctx.lineWidth = 3; ctx.strokeRect(px(b.x) + 3, px(b.y) + 3, px(b.w) - 6, px(b.h) - 6);
    ctx.beginPath(); ctx.moveTo(px(b.x), px(b.y)); ctx.lineTo(px(b.x + b.w), px(b.y + b.h)); ctx.stroke();
  }
  // handles: a yellow bar with a ring where she catches it
  s.room.handles.forEach((h, i) => {
    const held = s.stuck?.kind === 'handle' && s.stuck.i === i;
    ctx.strokeStyle = held ? '#ffffff' : 'rgba(255,210,122,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(h.x), px(h.y), px(CATCH_R), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(px(h.x) - 20, px(h.y) - 4, 40, 8);
  });
  // parts: green diamonds, a tick when hers
  s.room.parts.forEach((p, i) => {
    const got = s.got.includes(i);
    const x = px(p.x); const y = px(p.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = got ? 'rgba(159,232,168,.25)' : '#9fe8a8'; ctx.fillRect(-12, -12, 24, 24);
    ctx.restore();
    ctx.fillStyle = got ? '#9fe8a8' : '#05121a'; ctx.font = '900 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(got ? '✓' : String(i + 1), x, y);
  });
  // the arrow to the next part (Easy)
  const tg = nextTarget(s);
  if (hint && s.status === 'playing') {
    const dx = tg.x - s.pos.x; const dy = tg.y - s.pos.y; const L = Math.hypot(dx, dy) || 1;
    const ax = px(s.pos.x) + (dx / L) * 62; const ay = px(s.pos.y) + (dy / L) * 62;
    ctx.strokeStyle = '#ffd27a'; ctx.fillStyle = '#ffd27a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px(s.pos.x) + (dx / L) * 34, px(s.pos.y) + (dy / L) * 34); ctx.lineTo(ax, ay); ctx.stroke();
    const a = Math.atan2(dy, dx);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(a - 0.5) * 16, ay - Math.sin(a - 0.5) * 16); ctx.lineTo(ax - Math.cos(a + 0.5) * 16, ay - Math.sin(a + 0.5) * 16); ctx.closePath(); ctx.fill();
  }
  // her: a small figure, a ring when she is held, and a line for her drift
  const hx = px(s.pos.x); const hy = px(s.pos.y);
  if (s.status === 'playing' && !s.stuck && (s.vel.x || s.vel.y)) {
    ctx.strokeStyle = 'rgba(127,211,255,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s.vel.x * SCALE * 3, hy + s.vel.y * SCALE * 3); ctx.stroke();
  }
  if (s.stuck) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, px(SHIP.r) + 6, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#ff9fd0'; ctx.beginPath(); ctx.arc(hx, hy - 10, px(SHIP.r) * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7fd3ff'; ctx.fillRect(hx - 10, hy + 2, 20, 20);
  drawCallout(ctx, s, hx, hy);
  // the status strip
  ctx.fillStyle = '#0d1430'; ctx.fillRect(0, ROOM_H_PX, W, STAGE_H - ROOM_H_PX);
  const left = Math.max(0, Math.ceil(s.room.time - s.t));
  ctx.fillStyle = '#ffffff'; ctx.font = '800 17px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`Parts ${s.got.length} of ${s.room.parts.length}`, 16, ROOM_H_PX + 25);
  ctx.textAlign = 'center';
  ctx.fillText(`Throws ${Number.isFinite(s.throws) ? s.throws : '∞'}`, STAGE_W / 2, ROOM_H_PX + 25);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${left} s`, W - 16, ROOM_H_PX + 25);
  if (s.status === 'won') banner(ctx, 'The hatch opens! You did it!', '#9fe8a8');
  if (s.status === 'lost') banner(ctx, 'Out of time. Try again!', '#ffd27a');
}

function banner(ctx, text, color) {
  ctx.fillStyle = 'rgba(5,6,10,.7)'; ctx.fillRect(0, ROOM_H_PX / 2 - 36, STAGE_W, 72);
  ctx.fillStyle = color; ctx.font = '900 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, STAGE_W / 2, ROOM_H_PX / 2);
}

/**
 * Play the float game. Resolves when she wins and presses Next (or the grown-up skips).
 * @param {{ mode?: 'easy'|'medium'|'hard', seed?: number }} opts  the default mode: Easy at Level 1, Medium at Level 4
 * @returns {Promise<{ mode: string, seed: number, won: boolean }>}
 */
export function playFloatGame({ mode = LEVEL === 1 ? 'easy' : 'medium', seed = null, bus = null } = {}) {
  injectStyles(); injectCss();
  const crew = CREW_INFO.builder;
  const card = el('div', 'pl-card ls-card fg-card');
  card.dataset.game = 'float';
  const eyebrow = el('div', 'pl-eyebrow', `${t('Engine room, drive off', 'Engine room')} · ${crew.name}`);
  eyebrow.style.color = crew.color;
  const title = el('h2', 'pl-title', t('Zero g: float to the hatch', 'Float to the hatch'));
  const tip = el('p', 'ls-line', t('The drive is off, so nothing pulls or pushes us. We drift in a straight line. Collect the 3 parts, then reach the hatch on the right.', 'Collect the 3 parts, then reach the hatch on the right.'));
  // The modes and the tools share one row, so the card is one row shorter (it must fit the window).
  const btnRow = el('div', 'fg-row');
  const modeBtns = Object.values(MODES).map((m) => {
    const b = el('button', null, pick(m.label)); b.type = 'button';
    b.addEventListener('click', () => newRoom(m.id, null));
    btnRow.append(b);
    return { b, id: m.id };
  });
  const toolBtns = Object.values(TOOLS).map((T) => {
    const b = el('button', null); b.type = 'button';
    b.addEventListener('click', () => { picked = picked === T.id ? null : T.id; paint(); });
    btnRow.append(b);
    return { b, T };
  });
  let picked = null; // the tool she is about to throw (null: she pushes)
  const blurb = el('p', 'fg-blurb');
  const view = el('div', 'ls-view fg-view');
  const cv = document.createElement('canvas'); cv.width = STAGE_W; cv.height = STAGE_H; cv.className = 'ls-canvas fg-canvas';
  cv.style.cursor = 'pointer';
  view.append(cv);
  const ctx = cv.getContext('2d');
  const note = el('div', 'fg-note');
  const actions = el('div', 'ls-actions');
  const retryBtn = el('button', 'ls-btn ls-btn--ghost', t('Try again', 'Try again')); retryBtn.type = 'button';
  const nextBtn = el('button', 'ls-btn', t('Next ✓', 'Next ✓')); nextBtn.type = 'button'; nextBtn.disabled = true;
  actions.append(el('div', 'ls-dots'), retryBtn, nextBtn);
  card.append(eyebrow, title, tip, btnRow, blurb, view, note, actions);

  let s = null; let seedNow = 0; let modeNow = mode;
  let acc = 0; let last = 0; let frame = 0; let closed = false; let finishFn;
  const doneP = new Promise((r) => { finishFn = r; });
  function newRoom(id, sd) {
    modeNow = id;
    seedNow = sd ?? Math.floor(Math.random() * 1e6) + 1;
    s = newGame(id, seedNow);
    picked = null; acc = 0;
    paint();
  }
  /** A tap in room metres, or null on the status strip under the room. */
  function toRoom(e) {
    const r = cv.getBoundingClientRect();
    const cx = (e.clientX - r.left) * (STAGE_W / r.width); const cy = (e.clientY - r.top) * (STAGE_H / r.height);
    return cy > ROOM_H_PX ? null : { x: cx / SCALE, y: cy / SCALE };
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!s || s.status !== 'playing') return;
    const to = toRoom(e);
    if (!to) return;
    if (picked) { if (throwTool(s, picked, to)) picked = null; } // a failed throw says why in the note
    else push(s, to);
    paint();
  });
  const keyFn = (e) => {
    if (e.key === '1') { picked = picked === 'wrench' ? null : 'wrench'; paint(); }
    else if (e.key === '2') { picked = picked === 'spanner' ? null : 'spanner'; paint(); }
    else if (e.key === 'Enter' && !nextBtn.disabled && document.activeElement === nextBtn) finish();
  };

  function paint() {
    for (const { b, id } of modeBtns) b.setAttribute('aria-pressed', String(id === modeNow));
    for (const { b, T } of toolBtns) {
      const left = s ? s.throws : Infinity;
      b.setAttribute('aria-pressed', String(picked === T.id));
      b.disabled = left <= 0;
      b.textContent = `${pick(T.name)} · ${Number.isFinite(left) ? left : '∞'}`;
    }
    blurb.textContent = pick(MODE_BLURB[modeNow]);
    const won = s?.status === 'won'; const lost = s?.status === 'lost';
    note.className = `fg-note${lost ? ' is-warn' : won ? ' is-good' : ''}`;
    note.textContent = won ? t('The hatch opens! The parts are in, and we are through.', 'The hatch opens! You did it!')
      : lost ? t('Out of time. Try again: the room stays the same.', 'Out of time. Try again!')
        : picked ? t(`Tap where you want to go. You throw the ${TOOLS[picked].name[0].split(' ')[0].toLowerCase()} the other way.`, 'Tap where you want to go. The tool goes the other way.')
          : s?.stuck ? t('Stuck! Tap where you want to go, and push off.', 'Tap where you want to go, and push off.')
            : (s?.note || t('Floating. Wait, or pick a tool and throw it.', 'Floating. Pick a tool to throw.'));
    retryBtn.disabled = !lost;
    nextBtn.disabled = !won;
    nextBtn.classList.toggle('is-ready', won);
  }
  function tick(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    if (s && s.status === 'playing') {
      acc += dt;
      while (acc >= FIXED_DT && s.status === 'playing') { step(s, FIXED_DT); acc -= FIXED_DT; }
    }
    if (s) drawRoom(ctx, s, MODES[modeNow].hint);
    paint();
    frame = requestAnimationFrame(tick);
  }

  let layer;
  function finish() {
    if (closed || nextBtn.disabled) return;
    closed = true;
    cancelAnimationFrame(frame);
    layer.close();
    if (window.__float === api) delete window.__float;
    finishFn({ mode: modeNow, seed: seedNow, won: true });
  }
  layer = openLayer(card, {
    onKey: keyFn,
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  retryBtn.addEventListener('click', () => { if (s) { s = newGame(modeNow, seedNow); picked = null; acc = 0; paint(); } });
  nextBtn.addEventListener('click', finish);
  const api = {
    mode: (id) => { if (MODES[id]) newRoom(id, seedNow || null); return modeNow; },
    state: () => ({ mode: modeNow, seed: seedNow, status: s?.status, parts: s?.got.length ?? 0, throws: s?.throws, t: s ? +s.t.toFixed(2) : 0, pos: s ? { x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2) } : null, stuck: s?.stuck?.kind ?? null }),
    /** Play the bot's way to the hatch in the room (the grown-up's skip, and the test hook). */
    solve() {
      s = playOut(newGame(modeNow, seedNow), sensibleAct); acc = 0; paint();
      return s.status === 'won';
    },
    done() { finish(); return closed; },
  };
  window.__float = api;
  // Unlock mode only: a grown-up can skip the game (the hatch opens for her).
  // paint() first: finish() only closes when Next is enabled, and that is set by paint().
  const skip = skipButton(() => { api.solve(); if (s) s.status = 'won'; paint(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  newRoom(modeNow, seed);
  last = performance.now();
  frame = requestAnimationFrame(tick);
  return doneP;
}
