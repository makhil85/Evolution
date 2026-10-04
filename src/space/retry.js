// Retry: the button (or Esc -> pause menu) takes her back to just after her last question.
//
// Lead request: "an option to escape if things have gone wrong in an orbit
// transfer, or whenever during the game, and the game resets to the last
// stable position where the kid had just answered the questions."
// missions.js keeps that save copy (CKPT_KEY) and does the restore; this is
// the button, the key and the "are you sure?" card. Esc only opens it when no
// other card or the big map is open (those use Esc to close).

/**
 * @param {object} game  needs game.missions.retryFromCheckpoint(), game.hud
 */
export function createRetry(game) {
  const { hud } = game;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sp-retry';
  btn.textContent = '↺ Retry';
  btn.title = 'Go back to just after your last question and try again';
  // z-index 5: it lives in the HUD, so it must stay under the card dims (20).
  // bottom: just above the inset map (its width rule in hud.css + its hint and
  // margin), so it never touches the map title at 1024x768 or 1366x768.
  const style = document.createElement('style');
  style.textContent = `
.sp-retry { position: fixed; bottom: calc(clamp(150px, min(26vh, 22vw), 250px) + 64px); right: 18px; z-index: 5; font: 700 13px/1 system-ui, sans-serif;
  padding: 8px 13px; border-radius: 999px; cursor: pointer; background: rgba(14, 20, 34, .8); color: #dfe7ff;
  border: 1.5px solid rgba(255, 238, 214, .3); pointer-events: auto; }
.sp-retry:hover { background: rgba(40, 33, 27, .95); }
.sp-retry:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.sp-retry-card { position: fixed; inset: 0; z-index: 9600; display: grid; place-items: center; background: rgba(0,0,0,.45); }
.sp-retry-card__box { width: min(440px, calc(100vw - 32px)); background: rgba(20,16,13,.96); color: #f7efe2; border: 1px solid rgba(255,238,214,.3);
  border-radius: 16px; padding: 18px 20px; font: 16px/1.45 'Segoe UI', system-ui, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,.5); }
.sp-retry-card__box h3 { margin: 0 0 6px; font-size: 18px; color: #ffcf5c; }
.sp-retry-card__row { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
.sp-retry-card__row button { font: 700 15px system-ui, sans-serif; padding: 9px 16px; border-radius: 10px; cursor: pointer; border: 1px solid rgba(255,238,214,.3); }
.sp-retry-card__yes { background: #ff7847; color: #14100c; }
.sp-retry-card__no { background: rgba(255,255,255,.08); color: #f7efe2; }`;
  document.head.appendChild(style);
  (hud.root || document.body).appendChild(btn);

  let card = null;
  function close() { card?.remove(); card = null; game.bus?.emit?.('ui-modal', false); }
  function open() {
    if (card) return;
    card = document.createElement('div');
    card.className = 'sp-retry-card';
    card.setAttribute('role', 'dialog');
    const level1 = (() => { try { return JSON.parse(localStorage.getItem('rocket_village_profile') || '{}').difficulty === 1; } catch { return false; } })();
    card.innerHTML = `<div class="sp-retry-card__box"><h3></h3><p></p><div class="sp-retry-card__row">
      <button type="button" class="sp-retry-card__no"></button><button type="button" class="sp-retry-card__yes"></button></div></div>`;
    card.querySelector('h3').textContent = level1 ? 'Try again?' : 'Something gone wrong?';
    card.querySelector('p').textContent = level1
      ? 'Go back to just after your last question and try this part again.'
      : 'Go back to just after your last question and fly this part again. Your answers and supplies from then are kept.';
    card.querySelector('.sp-retry-card__no').textContent = level1 ? 'No, keep going' : 'No, keep flying';
    card.querySelector('.sp-retry-card__yes').textContent = level1 ? 'Yes, try again' : 'Yes, go back';
    card.querySelector('.sp-retry-card__no').addEventListener('click', close);
    card.querySelector('.sp-retry-card__yes').addEventListener('click', () => game.missions.retryFromCheckpoint());
    document.body.appendChild(card);
    game.bus?.emit?.('ui-modal', true);
    card.querySelector('.sp-retry-card__no').focus();
  }
  btn.addEventListener('click', () => { btn.blur(); open(); });
  // Esc opens the game's pause menu (hud.js), which has "Try again from my
  // last question"; that asks here. Esc closes this card.
  game.bus?.on?.('retry-request', () => open());
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && card) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  return { open, close };
}
