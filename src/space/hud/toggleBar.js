// One small status line for the flight switches: Autopilot (P), Auto-turn (T)
// and Freeze (F), side by side at the top of the right-hand column.
//
// Lead (2026-10-05): the three buttons were stacked in rows down the middle
// of the screen and took up much more of it than they needed - "they could
// be in one line in the side, giving status rather than in each row". Each
// switch is now a compact pill: its key, its name, and a light that says
// whether it is on. The longer explanation is in its tooltip and the toast it
// shows when pressed.

let bar = null;

const CSS = `
/* Right-aligned on the column; on a narrow column it reaches out to the left
 * rather than squeezing or wrapping. */
.sp-toggles { display: flex; gap: 5px; flex-wrap: nowrap; pointer-events: auto; z-index: 6;
  align-self: flex-end; width: max-content; flex: none; }
.sp-toggles.is-floating { position: fixed; top: 46px; right: 14px; } /* under the Chapters button */
.sp-toggles:empty { display: none; }
.sp-toggles > button { position: static; transform: none; flex: none; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 5px; margin: 0;
  font: 700 12px/1 system-ui, sans-serif; padding: 4px 8px 4px 4px; border-radius: 999px; cursor: pointer;
  background: rgba(14, 20, 34, .82); color: #dfe7ff; border: 1.5px solid rgba(120, 150, 210, .45); box-shadow: none; }
.sp-toggles > button:hover { background: rgba(28, 40, 70, .95); }
.sp-toggles > button:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.sp-toggles .sp-tg__key { display: inline-grid; place-items: center; min-width: 17px; height: 17px; border-radius: 5px;
  background: rgba(255, 255, 255, .12); color: #fff; font-size: 10.5px; font-weight: 900; }
.sp-toggles .sp-tg__dot { width: 8px; height: 8px; border-radius: 50%; background: #5d6680; flex: none; }
.sp-toggles .is-on .sp-tg__dot { background: #8fe86b; box-shadow: 0 0 6px #8fe86b; }
.sp-toggles .is-warn .sp-tg__dot { background: #ffcf5c; box-shadow: 0 0 6px #ffcf5c; }
.sp-toggles > .sp-autopilot { order: 1; }
.sp-toggles > .sp-aimtoggle { order: 2; }
.sp-toggles > .sp-freeze { order: 3; }
.sp-toggles > .sp-autopilot.is-on { background: #2f6bff; color: #fff; border-color: #9fbaff; }
.sp-toggles > .sp-freeze.is-frozen { background: #2a4f8f; color: #fff; border-color: #bcd8ff; box-shadow: 0 0 0 3px rgba(120,170,255,.22); }
.sp-toggles > .sp-aimtoggle.is-manual, .sp-toggles > .sp-aimtoggle.is-steering { color: #ffcf5c; border-color: rgba(255, 207, 92, .7); }`;

/** The shared line (made once), at the top of the HUD's right column. */
export function toggleBar(game) {
  if (bar) return bar;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  bar = document.createElement('div');
  bar.className = 'sp-toggles';
  const side = game.hud?._sidebar;
  if (side) side.insertBefore(bar, side.firstChild);
  else { bar.classList.add('is-floating'); (game.hud?.root || document.body).appendChild(bar); }
  return bar;
}

/**
 * Fill a switch: key chip, short name, status light. `state` is 'on', 'off'
 * or 'warn'; `tip` is the longer explanation (tooltip + screen readers).
 */
export function paintToggle(btn, key, name, state, tip) {
  const sig = `${key}|${name}|${state}|${tip}`;
  if (btn.dataset.sig === sig) return;
  btn.dataset.sig = sig;
  btn.replaceChildren();
  // No key letter on the switch (lead 2026-10-09): the key is in the tooltip and the label.
  const n = document.createElement('span'); n.textContent = name;
  const d = document.createElement('span'); d.className = 'sp-tg__dot';
  btn.append(n, d);
  btn.classList.toggle('is-warn', state === 'warn');
  btn.classList.toggle('is-on', state === 'on');
  btn.title = key ? `${tip} (key ${key})` : tip;
  btn.setAttribute('aria-label', key ? `${name}, key ${key}. ${tip}` : `${name}. ${tip}`);
}
