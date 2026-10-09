// Freeze / carry on (F or the button).
//
// Lead (2026-10-05): "add in chapter 4, 5, 6 a freeze button where we just
// freeze the current state and then we come back to resume it". Everything
// stops where it is - the ship, the planets, the clock - so she can look at
// her dotted path, read the banner, or simply walk away, and nothing moves
// until she says so. The Esc menu already pauses, but it covers the screen
// with a menu; this leaves the whole view up.
//
// It is not the same as a question card pausing the game: this one is hers,
// and the only thing that lifts it is F or the button.

import { toggleBar, paintToggle } from './hud/toggleBar.js';
import { anyCardOpen } from './hud/modalQueue.js';

/** @param {object} game  sets game.frozen; reads game.cinematic / activeScene */
export function createFreezeButton(game) {
  game.frozen = false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sp-freeze';
  const style = document.createElement('style');
  style.textContent = `
/* A thin cold edge round the whole view while it is frozen, so a child who
 * put the tablet down can see at a glance that nothing is moving. */
.sp-frozen-edge { position: fixed; inset: 0; z-index: 4; pointer-events: none; display: none;
  box-shadow: inset 0 0 0 3px rgba(150, 200, 255, .55), inset 0 0 60px rgba(90, 150, 230, .22); }
body.sp-is-frozen .sp-frozen-edge { display: block; }`;
  document.head.appendChild(style);
  const edge = document.createElement('div');
  edge.className = 'sp-frozen-edge';
  const host = game.hud?.root || document.body;
  toggleBar(game).appendChild(btn);
  host.appendChild(edge);

  function paint() {
    btn.classList.toggle('is-frozen', game.frozen);
    document.body.classList.toggle('sp-is-frozen', game.frozen);
    paintToggle(btn, 'F', game.frozen ? '❄ Frozen' : 'Freeze', game.frozen ? 'on' : 'off',
      game.frozen ? 'Frozen: everything waits. F to carry on' : 'Freeze everything where it is (F)');
    btn.setAttribute('aria-pressed', String(game.frozen));
  }
  function set(v) {
    const next = !!v;
    if (game.frozen === next) return;
    game.frozen = next;
    paint();
    game.hud?.toast?.(next
      ? 'Frozen. Everything waits for you - press F (or the button) when you want to carry on.'
      : 'Off we go again!', { kind: 'info', ms: next ? 4000 : 2000 });
  }
  function toggle() { set(!game.frozen); }

  btn.addEventListener('click', () => { btn.blur(); toggle(); });
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    // A question card or the pause menu is already holding the game: let it.
    if (!canFreeze()) return;
    toggle();
  });

  // Nothing to freeze during a cutscene, a walk on the Moon, the ending, or
  // while a card (a question, the Retry card...) or a mini-game is up (those
  // hold the game already).
  function canFreeze() {
    return !game.cinematic && !game.activeScene && !game.paused
      && document.body.dataset.playModal !== '1'
      && !anyCardOpen();
  }

  paint();
  return {
    /** Per frame: the button is only there while there is flight to freeze. */
    update() {
      // A cutscene or a walk started (a step she finished while frozen):
      // thaw, or nothing would ever move again.
      if (game.frozen && (game.cinematic || game.activeScene)) set(false);
      const show = game.frozen || canFreeze();
      const d = show ? '' : 'none';
      if (btn.style.display !== d) btn.style.display = d;
    },
    get on() { return game.frozen; },
    set,
  };
}
