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

/**
 * Run `fn` once every earlier turn has settled. Returns fn's promise. A turn
 * that throws never blocks the next one.
 * @template T
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 */
export function inModalTurn(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}
