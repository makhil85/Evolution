// Auto-turn on/off (T or the button).
//
// Lead: on Easy the ship turns itself to the right direction, which is
// correct, but a child who wants to turn the ship their own way ends up
// fighting it. This hands the pointing over: with auto-turn OFF the ship never
// turns itself (Easy's auto-aim and the Easy/Medium landing auto-steer); A / D
// are all hers. Press again to give the steering back. Only shown when the
// autopilot is off and something would auto-turn (Easy, or a Medium landing).
// It sits in the one status line with Autopilot and Freeze (hud/toggleBar.js).

import { toggleBar, paintToggle } from './hud/toggleBar.js';
import { anyCardOpen } from './hud/modalQueue.js';

/** @param {object} game  reads game.mode, game.autopilot; sets game.manualAim */
export function createAimToggle(game) {
  game.manualAim = false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sp-aimtoggle';
  btn.style.display = 'none';
  toggleBar(game).appendChild(btn);

  // A / D held with auto-turn on: she is steering right now, and the button
  // said "Auto-turn ON" all the while (play-test).
  let steering = false;
  const TURN_KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
  function paint() {
    btn.classList.toggle('is-manual', game.manualAim);
    btn.classList.toggle('is-steering', !game.manualAim && steering);
    paintToggle(btn, 'T', 'Auto-turn', game.manualAim ? 'off' : steering ? 'warn' : 'on', game.manualAim
      ? 'Auto-turn is off: you steer with ← and → (or A and D). T to let the ship turn itself'
      : steering ? 'You are steering (← / →) - let go and the ship turns itself again' : 'Auto-turn is on: the ship turns itself. T to steer yourself');
  }
  function toggle() {
    game.manualAim = !game.manualAim;
    paint();
    game.hud?.toast?.(game.manualAim
      ? 'You steer now: ← and → (or A and D) turn the ship. Press T to let it turn itself again.'
      : 'The ship turns itself again.', { kind: 'info', ms: 3200 });
  }
  btn.addEventListener('click', () => { btn.blur(); toggle(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    // A card (a question, the Retry card...) has the keyboard: T waits.
    if (anyCardOpen()) return;
    toggle();
  });
  paint();
  return {
    /** Per frame: show the button only where something would auto-turn. */
    update({ applies }) {
      const show = !!applies && !game.autopilot?.on && !game.cinematic && !game.activeScene;
      const d = show ? '' : 'none';
      if (btn.style.display !== d) btn.style.display = d;
      const st = show && TURN_KEYS.some((c) => game.controls?.isDown?.(c));
      if (st !== steering) { steering = st; paint(); }
    },
  };
}
