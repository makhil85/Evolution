// One shared modal backdrop + card, reused by every blocking HUD surface:
// the question modal, "Did you know?" facts, dialogue, upgrades, the
// controls help screen, the end card, and the pause menu.
//
// Sharing ONE host (rather than seven near-identical backdrops) means the
// pointer-events opt-in in hud.css only has to name one selector, and two
// overlays can never accidentally stack — opening a second one simply
// replaces the first's content, which cannot happen in practice since every
// caller awaits its Promise before the next can open, but is one less way
// for it to go wrong if that ever changes.
//
// Every open() emits `ui-modal` true on the bus, and close() emits false —
// this is the ONE place that happens, so no overlay can forget to unpause
// input (or double-pause it).

import { el } from './domUtil.js';

export function createModalHost(root, { bus } = {}) {
  const backdrop = el('div', 'sp-modal');
  backdrop.hidden = true;
  const card = el('div', 'sp-modal__card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  backdrop.appendChild(card);
  root.appendChild(backdrop);

  let onEscape = null;

  function emit(open) {
    if (bus && typeof bus.emit === 'function') bus.emit('ui-modal', open);
  }

  /**
   * @param {(card: HTMLElement) => void} build  fills the card's contents
   * @param {{onEscape?: () => void, wide?: boolean}} [opts]
   * @returns {HTMLElement} the card, for the caller to query/focus into
   */
  function open(build, opts = {}) {
    const wasOpen = !backdrop.hidden;
    card.innerHTML = '';
    card.className = `sp-modal__card${opts.wide ? ' is-wide' : ''}`;
    build(card);
    backdrop.hidden = false;
    backdrop.classList.remove('is-open');
    // rAF so the hidden->visible flip paints before the transition starts.
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    onEscape = typeof opts.onEscape === 'function' ? opts.onEscape : null;
    if (!wasOpen) emit(true);
    return card;
  }

  function close() {
    if (backdrop.hidden) return;
    backdrop.classList.remove('is-open');
    backdrop.hidden = true;
    card.innerHTML = '';
    onEscape = null;
    emit(false);
  }

  function isOpen() {
    return !backdrop.hidden;
  }

  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && onEscape) onEscape();
  });

  return { backdrop, card, open, close, isOpen };
}
