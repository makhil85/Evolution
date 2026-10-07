// On-screen controls for touch screens (tablets first).
//
// Every button presses or releases the same key the keyboard would, through
// controls.press(), so flying, the surface walks, the claw, docking and the
// drill all work without knowing a finger was involved:
//
//   left thumb   ▲ ▼ ◀ ▶   W S A D: thrust / reverse / turn (walk on the surface)
//   right thumb  AIM       Space: hold to aim (Easy) or steady the spin; JUMP on foot
//                E         claw, dock, pick up, climb aboard; hold to drill
//                Warp      cycles ×1 → ×4 → ×16 → ×64 (the 1-4 keys)
//                ↺ back    R: rewind a few seconds
//                ◉ view    C: camera
//                ❚❚        Esc: pause menu
//
// Held buttons track their own pointers, so two thumbs at once (turn + thrust)
// work, and a finger that slides off still releases the key.
//
// Shown when the device has a touch screen (any coarse pointer or touch
// points), or forced with ?touch=1 (and hidden with ?touch=0) for testing.

import { el } from './domUtil.js';
import { t } from '../level.js';

function wantTouch() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return !!(window.matchMedia?.('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0);
}

/**
 * @param {HTMLElement} root  the HUD root
 * @param {{ controls: object, bus: object, warpIndex: () => number, warpLevels: number[] }} opts
 */
export function createTouchPad(root, { controls, bus, warpIndex, warpLevels }) {
  const enabled = wantTouch();
  const pad = el('div', 'sp-touch');
  if (!enabled) {
    return { enabled, el: pad, update() {} };
  }
  root.classList.add('is-touch');
  // First in the HUD, so questions, the map and menus stack above it.
  root.insertBefore(pad, root.firstChild);

  /** keyHint: the key letter in the corner, so "hold W" in a banner points here. */
  function button(cls, label, aria, keyHint = '') {
    const b = el('button', `sp-touch__btn ${cls}`);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    const main = el('span', 'sp-touch__label', label);
    b.appendChild(main);
    if (keyHint) b.appendChild(el('span', 'sp-touch__key', keyHint));
    b.labelEl = main;
    return b;
  }

  /** A button that holds `code` down while any finger is on it. */
  function hold(btn, code) {
    const fingers = new Set();
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture?.(e.pointerId); } catch { /* not a live pointer */ }
      fingers.add(e.pointerId);
      controls.press(code, true);
      btn.classList.add('is-down');
    });
    const lift = (e) => {
      if (!fingers.delete(e.pointerId)) return;
      if (!fingers.size) {
        controls.press(code, false);
        btn.classList.remove('is-down');
      }
    };
    btn.addEventListener('pointerup', lift);
    btn.addEventListener('pointercancel', lift);
    btn.addEventListener('lostpointercapture', lift);
    return btn;
  }

  /** A button that does one thing per tap. */
  function tap(btn, action) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('is-down');
      action();
    });
    const clear = () => btn.classList.remove('is-down');
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointercancel', clear);
    btn.addEventListener('pointerleave', clear);
    return btn;
  }

  // --- left thumb: direction pad ------------------------------------------
  const dpad = el('div', 'sp-touch__dpad');
  const up = hold(button('is-up', '▲', t('Thrust forward (W)', 'Go (W)'), 'W'), 'KeyW');
  const left = hold(button('is-left', '◀', 'Turn left (A)', 'A'), 'KeyA');
  const right = hold(button('is-right', '▶', 'Turn right (D)', 'D'), 'KeyD');
  const down = hold(button('is-down-arrow', '▼', t('Thrust backward (S)', 'Back (S)'), 'S'), 'KeyS');
  dpad.append(up, left, right, down);

  // --- right thumb: actions ------------------------------------------------
  const actions = el('div', 'sp-touch__actions');
  // Space fires now (lead 2026-10-07), so the AIM / JUMP button holds Q: in
  // flight it steadies and aims; on foot it jumps (input.steady).
  const aim = hold(button('is-aim', 'AIM', 'Aim (Q)', 'Q'), 'KeyQ');
  const use = hold(button('is-use', 'E', t('Use: claw, dock, pick up (E)', 'Grab (E)')), 'KeyE');
  const small = el('div', 'sp-touch__small');
  const warp = tap(button('is-warp', 'Warp ×1', 'Time warp', '1-4'), () => {
    const next = (warpIndex() + 1) % warpLevels.length;
    bus.emit('warp-request', next);
  });
  const rewind = tap(button('is-rewind', '↺', 'Rewind (R)', 'R'), () => { controls.press('KeyR', true); controls.press('KeyR', false); });
  const cam = tap(button('is-cam', '◉', 'Camera (C)', 'C'), () => { controls.press('KeyC', true); controls.press('KeyC', false); });
  const pause = tap(button('is-pause', '❚❚', 'Pause (Esc)', 'Esc'), () => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
  });
  small.append(warp, rewind, cam, pause);
  actions.append(small, use, aim);

  pad.append(dpad, actions);

  let last = '';
  return {
    enabled,
    el: pad,
    /**
     * Relabel for the moment (JUMP on foot, STEADY when the ship won't aim
     * itself) and hide during cut-scenes. Cheap: only touches the DOM on change.
     * @param {{ onFoot: boolean, cinematic: boolean, autoAim: boolean }} st
     */
    update(st) {
      const aimLabel = st.onFoot ? 'JUMP' : st.autoAim ? 'AIM' : 'STEADY';
      const key = `${aimLabel}|${st.cinematic}|${warpIndex()}|${st.onFoot}`;
      if (key === last) return;
      last = key;
      aim.labelEl.textContent = aimLabel;
      pad.classList.toggle('is-hidden', !!st.cinematic);
      pad.classList.toggle('is-on-foot', !!st.onFoot);
      warp.labelEl.textContent = `${t('Warp', 'Fast')} ×${warpLevels[warpIndex()] ?? 1}`;
    },
  };
}
