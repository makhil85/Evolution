// One line for every blocking card (lead review, 2026-10-08).
//
// The card host (modalHost.js) has ONE slot: opening a card replaces whatever
// is on it, and the replaced card's promise then never settles. So a question,
// a fact, a dialogue, the upgrade bay, a picker and the Ready button all take
// their turn here, in the order they were asked: a card waits for the one
// before it to close. hud.js wraps its blocking methods with inModalTurn; the
// step engine's Ready button (missions.js) uses it too.
//
// Rule: nothing inside a queued turn may open another queued card and wait for
// it (that would wait on itself). Quiet gates (missions.untilQuiet) come
// before the turn, not inside it, so a card never holds up the others while
// she is still steering.

let chain = Promise.resolve();
// Bumped by resetModalTurns(): a turn asked before the reset never runs, even
// when the turn ahead of it settles later (a cancelled Ready button does).
let epoch = 0;

/**
 * Run `fn` once every earlier turn has settled. Returns fn's promise. A turn
 * that throws never blocks the next one.
 * @template T
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 */
export function inModalTurn(fn) {
  const mine = epoch;
  const run = chain.then(() => (mine === epoch ? fn() : new Promise(() => {})));
  chain = run.catch(() => {});
  return run;
}

/**
 * Abandon the queue (the step engine's debug jump, missions.jump). Turns still
 * waiting behind an unanswered card never start, and turns asked after this run
 * at once. Lead 2026-10-09: a jump while a card is up (the flight-mode picker,
 * an unanswered question) left the new step's dialogue queued behind it for good.
 * The card on screen is replaced by the next one (the host has one slot), so the
 * abandoned turns' promises simply never settle, as a replaced card's always did.
 */
export function resetModalTurns() {
  epoch += 1;
  chain = Promise.resolve();
}

/**
 * True while any card is on screen: the HUD's modal host (question, fact,
 * dialogue, pause menu...), the Retry card (retry.js) or a play-mode card
 * (play/ui.js openLayer). Keys that toggle things (T, F, P, Enter on Ready)
 * stay quiet then: the card has the keyboard.
 * @returns {boolean}
 */
export function anyCardOpen() {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('.sp-modal:not([hidden]), .sp-retry-card, .pl-back');
}
