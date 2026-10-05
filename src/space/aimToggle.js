// Auto-turn on/off (T or the button).
//
// Lead: on Easy the ship turns itself to the right direction, which is
// correct, but a child who wants to turn the ship their own way ends up
// fighting it. This hands the pointing over: with auto-turn OFF the ship never
// turns itself (Easy's auto-aim and the Easy/Medium landing auto-steer); A / D
// are all hers. Press again to give the steering back. Only shown when the
// autopilot is off and something would auto-turn (Easy, or a Medium landing).
// Third in the top-centre stack, under the Autopilot (12px) and Freeze (52px)
// buttons.

/** @param {object} game  reads game.mode, game.autopilot; sets game.manualAim */
export function createAimToggle(game) {
  game.manualAim = false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sp-aimtoggle';
  const style = document.createElement('style');
  style.textContent = `
.sp-aimtoggle { position: fixed; top: 92px; left: 50%; transform: translateX(-50%); z-index: 5; font: 700 13px/1 system-ui, sans-serif;
  padding: 7px 13px; border-radius: 999px; cursor: pointer; background: rgba(14, 20, 34, .8); color: #bfe9ff;
  border: 1.5px solid rgba(143, 232, 107, .55); pointer-events: auto; display: none; }
.sp-aimtoggle.is-manual, .sp-aimtoggle.is-steering { color: #ffcf5c; border-color: rgba(255, 207, 92, .7); }
.sp-aimtoggle:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }`;
  document.head.appendChild(style);
  (game.hud?.root || document.body).appendChild(btn);

  // A / D held with auto-turn on: she is steering right now, and the button
  // said "Auto-turn ON" all the while (play-test).
  let steering = false;
  const TURN_KEYS = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
  function paint() {
    btn.classList.toggle('is-manual', game.manualAim);
    btn.classList.toggle('is-steering', !game.manualAim && steering);
    const text = game.manualAim ? 'Auto-turn OFF: you steer (T)' : steering ? 'You’re steering (A / D)' : 'Auto-turn ON (T)';
    if (btn.textContent !== text) btn.textContent = text;
  }
  function toggle() {
    game.manualAim = !game.manualAim;
    paint();
    game.hud?.toast?.(game.manualAim
      ? 'You steer now: A and D turn the ship. Press T to let it turn itself again.'
      : 'The ship turns itself again.', { kind: 'info', ms: 3200 });
  }
  btn.addEventListener('click', () => { btn.blur(); toggle(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.sp-modal button')) return;
    toggle();
  });
  paint();
  return {
    /** Per frame: show the button only where something would auto-turn. */
    update({ applies }) {
      const show = !!applies && !game.autopilot?.on && !game.cinematic && !game.activeScene;
      const d = show ? 'block' : 'none';
      if (btn.style.display !== d) btn.style.display = d;
      const st = show && TURN_KEYS.some((c) => game.controls?.isDown?.(c));
      if (st !== steering) { steering = st; paint(); }
    },
  };
}
