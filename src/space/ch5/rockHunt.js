// The rock hunt (Chapter 5, Part D): four icy rocks near her path in the
// Kuiper belt. She scans each one and checks it against the design's list;
// only one passes every check. Picking a wrong one says which check it fails.
//
// Lead 2026-10-08: the rock is drilled for ice (water, fuel) and metal (parts),
// and a thick cap of it stays at the front. The rock she picks is about 140 m
// wide: big enough for a cap of that size and a ring behind it.
//
// Opens in the play-mode modal layer; pauses the space game through the
// bus's 'ui-modal'. Test hook: window.__hunt = { open, state(), scanAll(), choose(id), solve() }.
import { el, openLayer } from '../../play/ui.js';
import { t } from '../level.js';
import { injectStyles } from '../../lesson/card.js';
import { label, circle, rect, nightSky, span, STAGE_W, STAGE_H } from '../../lesson/draw.js';
import { skipButton } from '../../play/grownUp.js';

const TAU = Math.PI * 2;

/** The checklist, from the design: each check reads one fact of a rock. */
export const CHECKS = [
  { id: 'size', text: ['Big enough: at least 100 m wide', 'Big enough'], pass: (r) => r.width >= 100, no: ['it is too small for a front cap and a ring', 'too small'] },
  { id: 'ice', text: ['Has ice (water and fuel)', 'Has ice'], pass: (r) => r.ice >= 20, no: ['it has almost no ice, so no water or fuel', 'no ice'] },
  { id: 'metal', text: ['Has metal (for parts)', 'Has metal'], pass: (r) => r.metal >= 5, no: ['it has almost no metal to make parts', 'no metal'] },
  { id: 'solid', text: ['Solid: no big cracks', 'No cracks'], pass: (r) => !r.cracked, no: ['it is cracked right through, so the engine could break it apart', 'it is cracked'] },
  { id: 'spin', text: ['Spins slowly', 'Spins slowly'], pass: (r) => r.spinHours >= 6, no: ['it spins so fast that everything inside would be flung about', 'it spins too fast'] },
];

export const ROCKS = [
  { id: 'A', name: 'Rock A', width: 40, ice: 45, metal: 1, cracked: false, spinHours: 9, look: { r: 32, col: '#b8c4cf', seed: 3 } },
  { id: 'B', name: 'Rock B', width: 140, ice: 35, metal: 12, cracked: false, spinHours: 11, look: { r: 74, col: '#a9a39a', seed: 7 } },
  { id: 'C', name: 'Rock C', width: 300, ice: 30, metal: 10, cracked: true, spinHours: 7, look: { r: 92, col: '#9a9590', seed: 11 } },
  { id: 'D', name: 'Rock D', width: 120, ice: 2, metal: 25, cracked: false, spinHours: 2, look: { r: 68, col: '#7d6f62', seed: 5 } },
];

/** The checks rock `r` fails (none for the right one). */
export const failures = (r) => CHECKS.filter((c) => !c.pass(r));

function drawRock(ctx, x, y, rock, T, scanned, picked) {
  const { r, col, seed } = rock.look;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(T * (0.6 / rock.spinHours));
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU;
    const k = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 7 + seed * 2);
    if (i === 0) ctx.moveTo(Math.cos(a) * r * k, Math.sin(a) * r * k * 0.82); else ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k * 0.82);
  }
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = picked ? '#9fe8a8' : 'rgba(20,30,50,0.6)'; ctx.lineWidth = picked ? 4 : 2; ctx.stroke();
  // Ice patches, craters, and (for a cracked one) a crack once scanned.
  for (let i = 0; i < 4; i++) circle(ctx, Math.cos(i * 1.9 + seed) * r * 0.45, Math.sin(i * 2.3 + seed) * r * 0.35, r * 0.12, rock.ice > 10 ? 'rgba(230,245,255,0.65)' : 'rgba(60,50,40,0.4)');
  if (scanned && rock.cracked) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.1); ctx.lineTo(r * 0.2, -r * 0.3); ctx.lineTo(r * 0.75, r * 0.15); ctx.stroke(); }
  ctx.restore();
}

/** @returns {Promise<{rock:string, wrongPicks:number}>} */
export function playRockHunt({ bus = null } = {}) {
  injectStyles();
  const card = el('div', 'pl-card ls-card is-asking');
  card.dataset.game = 'rock-hunt';
  const eyebrow = el('div', 'pl-eyebrow', t('Rock hunt', 'Rock hunt'));
  const title = el('h2', 'pl-title', t('Which rock becomes the starship?', 'Find the right rock'));
  const stage = el('div', 'ls-stage');
  const view = el('div', 'ls-view');
  const canvas = el('canvas', 'ls-canvas');
  view.append(canvas);
  const side = el('div', 'ls-side');
  const box = el('div', 'ls-q');
  const info = el('p', 'ls-prompt', t('Scan each rock, then pick the one that passes every check.', 'Scan the rocks. Pick the one with all ticks.'));
  const list = el('div', 'ls-choices');
  const fb = el('div', 'ls-feedback'); fb.hidden = true;
  box.append(el('div', 'ls-who', t('Checklist', 'Checklist')), info, list, fb);
  side.append(box);
  stage.append(view, side);
  const actions = el('div', 'ls-actions');
  const buttons = el('div', 'ls-dots');
  const scanBtns = ROCKS.map((r) => { const b = el('button', 'ls-btn ls-btn--ghost', `📡 ${r.name}`); b.type = 'button'; b.addEventListener('click', () => scan(r.id)); buttons.appendChild(b); return b; });
  const chooseBtn = el('button', 'ls-btn', t('Choose this rock', 'Pick this rock')); chooseBtn.type = 'button'; chooseBtn.disabled = true;
  actions.append(buttons, chooseBtn);
  card.append(eyebrow, title, stage, actions);

  const scanned = new Set();
  let focus = null; let scanT = 0; let picked = null; let wrong = 0;
  let closed = false; let finishFn;
  const promise = new Promise((r) => { finishFn = r; });
  const layer = openLayer(card, {
    onKey(e) { if (/^[1-4]$/.test(e.key)) scan(ROCKS[+e.key - 1].id); else if (e.key === 'Enter' && !chooseBtn.disabled) choose(focus); },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  chooseBtn.addEventListener('click', () => choose(focus));
  canvas.addEventListener('click', (e) => {
    const b = canvas.getBoundingClientRect(); const x = ((e.clientX - b.left) / b.width) * STAGE_W;
    const i = Math.max(0, Math.min(3, Math.floor(x / (STAGE_W / 4))));
    scan(ROCKS[i].id);
  });

  function renderList() {
    list.textContent = '';
    const r = ROCKS.find((x) => x.id === focus);
    for (const c of CHECKS) {
      const ok = r && scanned.has(r.id) ? c.pass(r) : null;
      const row = el('div', 'ls-choice', `${ok === null ? '◻' : ok ? '✅' : '❌'} ${t(c.text[0], c.text[1])}`);
      list.appendChild(row);
    }
    if (r && scanned.has(r.id)) {
      info.textContent = t(`${r.name}: ${r.width} m wide, ${r.ice}% ice, ${r.metal}% metal, ${r.cracked ? 'cracked right through' : 'solid'}, turns once every ${r.spinHours} hours.`,
        `${r.name}: ${r.width} m wide. ${r.ice}% ice. ${r.metal}% metal.`);
    }
    chooseBtn.disabled = picked === null && (!r || !scanned.has(r.id));
  }
  function scan(id) {
    if (closed || picked) return;
    focus = id; scanT = scanned.has(id) ? 2 : 0; fb.hidden = true;
    scanBtns.forEach((b, i) => b.classList.toggle('is-ready', ROCKS[i].id === id));
    renderList();
  }
  function choose(id) {
    const r = ROCKS.find((x) => x.id === id);
    if (!r || !scanned.has(id) || picked) return;
    const fails = failures(r);
    if (fails.length) {
      wrong++;
      fb.className = 'ls-feedback is-warn';
      fb.textContent = t(`Not ${r.name}: ${fails.map((c) => c.no[0]).join(', and ')}.`, `Not this one: ${fails[0].no[1]}! Look for the ❌.`);
      fb.hidden = false;
      return;
    }
    picked = id;
    fb.className = 'ls-feedback is-good';
    fb.textContent = t(`${r.name} passes every check! 140 m of icy, metal-rich rock: ice for water and fuel, metal for parts.`, `${r.name} has all the ticks! This is our ship!`);
    fb.hidden = false;
    chooseBtn.textContent = t('Start building!', 'Build it!'); chooseBtn.disabled = false;
    chooseBtn.onclick = finish;
  }
  function finish() {
    if (closed) return;
    closed = true; layer.close();
    if (window.__hunt === api) delete window.__hunt;
    finishFn({ rock: picked, wrongPicks: wrong });
  }

  let T = 0; let last = performance.now();
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; T += dt;
    if (focus && !scanned.has(focus)) { scanT += dt; if (scanT >= 1.5) { scanned.add(focus); renderList(); } }
    draw();
    requestAnimationFrame(frame);
  }
  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 600; const H = canvas.clientHeight || 340;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    ctx.setTransform(s, 0, 0, s, (canvas.width - STAGE_W * s) / 2, (canvas.height - STAGE_H * s) / 2);
    nightSky(ctx, 83);
    ROCKS.forEach((r, i) => {
      const x = 100 + i * 200; const y = 200;
      drawRock(ctx, x, y, r, T, scanned.has(r.id), picked === r.id);
      label(ctx, r.name, x, 335, { size: 22, color: focus === r.id ? '#7ff3ff' : '#fff', halo: 'rgba(0,0,0,0.6)' });
      if (scanned.has(r.id)) {
        const n = failures(r).length;
        label(ctx, n ? `${CHECKS.length - n}/${CHECKS.length} ✓` : `${CHECKS.length}/${CHECKS.length} ✓`, x, 368, { size: 20, color: n ? '#ffd27a' : '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
      }
      // The scan beam sweeping over the focused rock.
      if (focus === r.id && !scanned.has(r.id)) {
        const k = span(scanT, 0, 1.5);
        const sy = y - 90 + k * 180;
        rect(ctx, x - 95, sy - 2, 190, 4, 'rgba(127,243,255,0.8)', 2);
        label(ctx, t('scanning...', 'scanning...'), x, 60, { size: 16, color: '#7ff3ff', halo: 'rgba(0,0,0,0.6)' });
      }
    });
  }

  const api = {
    get open() { return !closed; },
    state() { return { focus, scanned: [...scanned], picked, wrong }; },
    scanAll() { for (const r of ROCKS) scanned.add(r.id); focus = focus || ROCKS[0].id; renderList(); return this.state(); },
    choose(id) { focus = id; choose(id); renderList(); return this.state(); },
    /** Scan everything and pick the right rock, then go on. */
    solve() { this.scanAll(); const right = ROCKS.find((r) => !failures(r).length); this.choose(right.id); finish(); return true; },
    shot() { draw(); return canvas.toDataURL('image/png'); },
  };
  window.__hunt = api;
  // Unlock mode only: a grown-up can skip this game.
  const skip = skipButton(() => api.solve(), 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  renderList();
  requestAnimationFrame(frame);
  return promise;
}
