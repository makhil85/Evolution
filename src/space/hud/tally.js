// The belt's mined tally (lead, PLAN item 11): a small box on the right,
// like Level 1's Supplies panel, listing what she has mined (silicon, metal,
// ice) against what the next build needs ("Metal 3 / 4"), the cargo hold,
// the ice-to-fuel rule, and the Upgrade bay button (U). Only shown on the
// belt's steps (acts/mining.js tallyState() returns null elsewhere); focus
// mode hides it like the other non-critical panels (hud.css).
//
// The broken rock pieces fly into it: `flyIcons` arcs emoji icons from a
// screen point into a row (same feel as src/play/tools.js flyToSupplies), and
// the row's number only ticks up when they land (`hold`/`release`).

import { el } from './domUtil.js';
import { t } from '../level.js';

export const RESOURCE_ICONS = Object.freeze({ silicon: '🪨', metal: '🔩', ice: '🧊' });
const ROWS = [
  ['silicon', 'Silicon'],
  ['metal', 'Metal'],
  ['ice', 'Ice'],
];

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (v) => String(Math.round((v || 0) * 10) / 10);

/**
 * Arc `n` copies of `icon` from screen point `from` into `toEl` (its left
 * edge), then pulse it. `onLand` runs once, when the last one arrives (or at
 * once if the target is hidden or motion is reduced).
 */
export function flyIcons({ icon, from, toEl, n = 3, size = 24, onLand }) {
  const to = toEl?.getBoundingClientRect();
  if (!to || to.width < 2 || to.height < 2 || reducedMotion() || !from) { onLand?.(); return; }
  const x0 = from.x;
  const y0 = from.y;
  const x1 = to.left + Math.min(22, to.width / 2);
  const y1 = to.top + to.height / 2;
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - 110;
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const x = (1 - k) ** 2 * x0 + 2 * (1 - k) * k * cx + k * k * x1;
    const y = (1 - k) ** 2 * y0 + 2 * (1 - k) * k * cy + k * k * y1;
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1.3 - 0.55 * k})`, opacity: k < 0.92 ? 1 : 0.6 });
  }
  let left = n;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = icon;
    s.setAttribute('aria-hidden', 'true');
    s.dataset.fly = '1'; // lab/fullshot.js draws these too
    s.style.cssText = `position:fixed;left:0;top:0;z-index:9400;pointer-events:none;font-size:${size}px;`
      + 'filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));will-change:transform;opacity:0';
    document.body.appendChild(s);
    const a = s.animate(frames, { duration: 760, delay: i * 110, easing: 'cubic-bezier(.45,0,.85,.6)', fill: 'both' });
    // A hidden tab dispatches no animation events: a timer backs onfinish up.
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      s.remove();
      toEl.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', filter: 'brightness(1.5)' }, { transform: 'scale(1)' }],
        { duration: 240, easing: 'ease-out' },
      );
      left -= 1;
      if (left === 0) onLand?.();
    };
    a.onfinish = land;
    setTimeout(land, 760 + i * 110 + 80);
  }
}

/** @param {HTMLElement} mount the right sidebar; @param {{onOpenBay?: Function}} opts */
export function createTally(mount, { onOpenBay } = {}) {
  const panel = el('div', 'sp-panel sp-tally');
  panel.hidden = true;

  const head = el('div', 'sp-tally__head');
  head.appendChild(el('span', 'sp-panel__title', t('⛏ Mined', '⛏ My rocks')));
  const cargo = el('span', 'sp-tally__cargo tabular', '');
  head.appendChild(cargo);
  panel.appendChild(head);

  const forLine = el('div', 'sp-tally__for', '');
  panel.appendChild(forLine);

  const rows = {};
  for (const [key, label] of ROWS) {
    const row = el('div', 'sp-tally__row');
    row.appendChild(el('span', 'sp-tally__icon', RESOURCE_ICONS[key]));
    row.appendChild(el('span', 'sp-tally__label', label));
    const val = el('b', 'sp-tally__val tabular', '0');
    row.appendChild(val);
    panel.appendChild(row);
    rows[key] = { row, val };
  }

  const fuelNote = el('div', 'sp-tally__note', t('Fuel refill: 1 ice → +1 t fuel', '1 ice = more fuel'));
  panel.appendChild(fuelNote);

  const bay = el('button', 'sp-btn sp-tally__bay', '');
  bay.type = 'button';
  bay.hidden = true;
  bay.addEventListener('click', () => { bay.blur(); onOpenBay?.(); });
  panel.appendChild(bay);

  mount.appendChild(panel);

  // A row whose pieces are still flying keeps showing the old number.
  const held = {};
  const shown = {};
  let lastKey = '';

  function hold(res) {
    if (!rows[res]) return;
    const h = held[res];
    held[res] = { value: h ? h.value : (shown[res] ?? 0), until: performance.now() + 4000, n: (h?.n || 0) + 1 };
  }
  function release(res) {
    const h = held[res];
    if (h && --h.n > 0) return; // another batch is still flying in
    delete held[res];
    lastKey = '';
  }

  /** @param {null|{resources:object, cargo:number, cargoMax:number, next:null|{label:string, cost:object}, canBuild:boolean, canMelt:boolean}} s */
  function update(s) {
    if (!s) { if (!panel.hidden) panel.hidden = true; return; }
    if (panel.hidden) panel.hidden = false;
    const now = performance.now();
    const res = s.resources || {};
    const cost = s.next?.cost || {};
    const vals = {};
    for (const [key] of ROWS) {
      const h = held[key];
      if (h && now > h.until) delete held[key];
      vals[key] = held[key] ? held[key].value : (res[key] || 0);
    }
    // Rebuild the text only when something shown changed (runs every frame).
    const sig = `${fmt(vals.silicon)}|${fmt(vals.metal)}|${fmt(vals.ice)}|${fmt(s.cargo)}|${s.next?.label}|${s.canBuild}|${s.canMelt}`;
    if (sig === lastKey) return;
    lastKey = sig;
    cargo.textContent = `${fmt(s.cargo)} / ${fmt(s.cargoMax)} t`;
    cargo.classList.toggle('is-full', s.cargo >= s.cargoMax - 0.05);
    forLine.textContent = s.next ? t(`Needed for ${s.next.label}:`, `For the ${s.next.label}:`) : t('All upgrades built!', 'All built!');
    for (const [key] of ROWS) {
      const need = cost[key];
      shown[key] = vals[key];
      rows[key].val.textContent = need ? `${fmt(vals[key])} / ${need}` : fmt(vals[key]);
      rows[key].row.classList.toggle('is-done', !!need && vals[key] >= need);
      rows[key].row.classList.toggle('is-short', !!need && vals[key] < need);
    }
    bay.hidden = !(s.canBuild || s.canMelt);
    bay.classList.toggle('is-ready', !!s.canBuild);
    bay.textContent = s.canBuild ? t('🔧 Build upgrades', '🔧 Build it!') : t('💧 Upgrade bay: melt ice', '💧 Make fuel');
  }

  return {
    root: panel,
    update,
    hold,
    release,
    /** The row a resource's pieces fly into (null if the panel is hidden). */
    cellFor(res) { return !panel.hidden && rows[res] ? rows[res].row : null; },
    get visible() { return !panel.hidden && panel.getBoundingClientRect().width > 2; },
  };
}
