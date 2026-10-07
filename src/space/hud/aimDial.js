// "Point backwards" aim panel (bottom centre), shown on every slow-down burn:
// capturing into orbit at the Moon, Jupiter and Europa, and braking to land.
// Lead playtest: "What do you mean backward? Point at the Moon, or away from
// it, or opposite to your direction of travel?" So the panel spells it out:
//
//   a dial    the green mark is where the nose must point (green like the
//             3-D aim chevron), the white arrow is where it points now, the
//             dashed grey arrow is the way she is MOVING (backwards = the
//             green mark, opposite her motion)
//   degrees   how far off she is, and the key that closes the gap (A / D);
//             Easy: the ship turns itself
//   one line  what to do now (get ready, burn, keep the speed in the green)
//
// The same dial as the orbit-transfer panel (transferPanel.js paintDial).
// main.js works out the numbers (capture and landing cues) and passes them
// to update(); null hides the panel. Styles live here (not hud.css) so the
// panel is self-contained.

import { el } from './domUtil.js';
import { paintDial } from './transferPanel.js';
import { t } from '../level.js';

const DEG = 180 / Math.PI;
const REDRAW_MS = 80;

/**
 * @typedef {object} AimHelp
 * @property {'ready'|'burn'|'land'|'brake'} phase  ready = coasting to the burn; burn = slow down
 *           now; land = falling, nose ready; brake = falling too fast, hold Space
 * @property {number|null} err     radians the nose must turn (+ = turn right, D)
 * @property {number|null} [motion] radians from the aim to her direction of travel
 * @property {boolean} auto        Easy: the ship turns itself
 * @property {string} line         the one sentence to follow
 */

const CSS = `
.sp-hud .sp-aim {
  position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  width: 360px; padding: 8px 12px 9px; z-index: 2;
}
/* Above the landing gauge while that shows (they share the bottom centre),
 * compact: the dial and the key only - the banner says the rest. */
.sp-hud:has(.sp-landing:not([hidden])) .sp-aim { bottom: 186px; width: 300px; padding: 6px 10px; }
.sp-hud:has(.sp-landing:not([hidden])) .sp-aim__say,
.sp-hud:has(.sp-landing:not([hidden])) .sp-aim__means { display: none; }
.sp-hud:has(.sp-landing:not([hidden])) .sp-aim__dial { width: 56px; height: 56px; }
.sp-hud.is-touch .sp-aim { bottom: 176px; }
.sp-hud.is-touch:has(.sp-landing:not([hidden])) .sp-aim { bottom: 352px; }
.sp-hud .sp-aim__row { display: flex; align-items: center; gap: 10px; }
.sp-hud .sp-aim__dial { width: 70px; height: 70px; flex: none; }
.sp-hud .sp-aim__text { min-width: 0; flex: 1; }
.sp-hud .sp-aim__title { font-size: calc(12px * var(--hud-scale)); font-weight: 900; letter-spacing: .04em; color: var(--sp-cool-glass); line-height: 1.15; }
.sp-hud .sp-aim__means { font-size: calc(10px * var(--hud-scale)); color: var(--sp-muted); line-height: 1.25; margin-top: 1px; }
.sp-hud .sp-aim__off { font-size: calc(15px * var(--hud-scale)); font-weight: 900; color: var(--sp-amber); line-height: 1.15; margin-top: 4px; }
.sp-hud .sp-aim__off.is-good { color: var(--sp-good); }
.sp-hud .sp-aim__off.is-bad { color: var(--sp-bad); }
.sp-hud .sp-aim__off.is-early { color: var(--sp-muted); }
.sp-hud .sp-aim__key { font-size: calc(10.5px * var(--hud-scale)); font-weight: 800; color: var(--sp-text); line-height: 1.2; }
.sp-hud .sp-aim__say {
  margin-top: 7px; padding: 5px 10px; border-radius: 10px; background: rgba(0, 0, 0, 0.25);
  font-size: calc(11px * var(--hud-scale)); font-weight: 800; line-height: 1.3; text-wrap: balance;
}
.sp-hud .sp-aim[data-phase="burn"] .sp-aim__say { background: rgba(86, 194, 113, .22); color: #d9f7cf; }
.sp-hud .sp-aim[data-phase="brake"] .sp-aim__say { background: rgba(255, 159, 67, .25); color: #ffe2c4; }
.sp-hud .sp-aim__say.is-flash { animation: sp-aim-flash 600ms ease-out 1; }
@keyframes sp-aim-flash { from { box-shadow: 0 0 0 3px rgba(255, 207, 92, .7); } to { box-shadow: 0 0 0 0 rgba(255, 207, 92, 0); } }
@media (prefers-reduced-motion: reduce) { .sp-hud .sp-aim__say.is-flash { animation: none; } }
@media (max-width: 1366px) { .sp-hud .sp-aim { width: 330px; } }
`;

export function createAimDial(root) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = el('div', 'sp-panel sp-aim');
  panel.hidden = true;
  const row = el('div', 'sp-aim__row');
  const dial = document.createElement('canvas');
  dial.className = 'sp-aim__dial';
  const text = el('div', 'sp-aim__text');
  const title = el('div', 'sp-aim__title', '');
  const means = el('div', 'sp-aim__means', '');
  const off = el('div', 'sp-aim__off tabular', '');
  const keyLine = el('div', 'sp-aim__key', '');
  text.append(title, means, off, keyLine);
  row.append(dial, text);
  const say = el('div', 'sp-aim__say', '');
  panel.append(row, say);
  root.appendChild(panel);

  const dctx = dial.getContext('2d');
  let dialSize = 0;
  function sizeDial() {
    const css = dial.clientWidth || 70;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dialSize = css;
    dial.width = Math.round(css * dpr);
    dial.height = Math.round(css * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { dialSize = 0; });

  let lastAt = -Infinity;
  let shownPhase = '';
  let flashedPhase = '';
  function setText(node, s) { if (node.textContent !== s) node.textContent = s; }

  /** @param {AimHelp|null} h */
  function update(h) {
    if (!h) {
      if (!panel.hidden) panel.hidden = true;
      shownPhase = '';
      flashedPhase = '';
      return;
    }
    const now = performance.now();
    if (!panel.hidden && h.phase === shownPhase && h.line === say.textContent && now - lastAt < REDRAW_MS) return;
    lastAt = now;
    shownPhase = h.phase;
    if (panel.hidden) { panel.hidden = false; dialSize = 0; }
    panel.dataset.phase = h.phase;

    // "and up" only while the aim really tips up (falling slowly near the
    // ground); early in the descent it's plain backwards.
    setText(title, h.up ? t('POINT BACK AND UP', 'FACE THE WAY YOU CAME') : t('POINT BACKWARDS', 'FACE THE WAY YOU CAME'));
    setText(means, h.up
      ? t('Against your motion, tipped away from the ground', 'Nose on the green mark, a bit up')
      : t('Opposite to the way you’re moving (grey arrow)', 'Nose on the green mark'));

    // The coast before a capture burn: no red "40° off" 40 s early - the
    // turn only matters in the last ~10 s.
    const early = h.phase === 'ready' && (h.inS ?? 0) > 10;
    const errDeg = early || h.err === null || h.err === undefined ? null : Math.round(Math.abs(h.err) * DEG);
    const lined = errDeg !== null && errDeg <= 10;
    const turnKey = h.err > 0 ? t('hold → (or D) to turn right', 'hold → ▶') : t('hold ← (or A) to turn left', '◀ hold ←');
    if (early) { setText(off, t(`Turn in ${Math.max(0, h.inS - 10)} s`, `Turn in ${Math.max(0, h.inS - 10)} s`)); setText(keyLine, h.inS > 100 ? t('time warp (1-4) is fine', 'keys 1-4: go fast') : ''); }
    else if (errDeg === null) { setText(off, ''); setText(keyLine, ''); }
    else if (lined) {
      setText(off, t('Lined up ✓', 'Good ✓'));
      setText(keyLine, h.auto ? t('the ship holds it', 'the ship does it') : t('keep it there', 'keep it there'));
    } else {
      setText(off, `${errDeg}° off`);
      setText(keyLine, h.auto ? t('turning by itself…', 'turning by itself…') : turnKey);
    }
    off.classList.toggle('is-good', lined);
    off.classList.toggle('is-bad', !lined && errDeg !== null && errDeg > 30);
    off.classList.toggle('is-early', early);
    if (dialSize !== (dial.clientWidth || 70)) sizeDial(); // (smaller above the landing gauge)
    paintDial(dctx, dialSize, early ? null : h.err ?? null, lined, h.auto, h.motion ?? null);

    setText(say, h.line || '');
    if (h.phase !== flashedPhase) { flashedPhase = h.phase; say.classList.remove('is-flash'); void say.offsetWidth; say.classList.add('is-flash'); }
  }

  return { el: panel, update };
}
