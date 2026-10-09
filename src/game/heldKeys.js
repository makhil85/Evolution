// Which keys are held right now, for the walking chapters (1-3).
//
// A plain Set of key codes (add on keydown, delete on keyup) leaves her
// walking on her own whenever a keyup never reaches the page: the window
// lost focus, the tab was hidden, a dialog or the browser took the key, or
// a slow frame let the release slip by. This keeps the Set's add/delete/
// has/clear shape and adds two guards:
//   - every key is let go on blur, on a hidden tab and on pagehide;
//   - the key the keyboard is auto-repeating counts as released once its
//     repeats go quiet (a held key repeats every 30-400 ms), so a lost keyup
//     costs a fraction of a second, not a walk across the map. Only the LAST
//     key pressed repeats (hold Up, tap Right: Up stops repeating but is still
//     held), so only that key is watched.

/** Silence after the last auto-repeat that means the key was really let go (ms). */
export const REPEAT_QUIET_MS = 450;

export function createHeldKeys({ now = () => performance.now() } = {}) {
  const held = new Map(); // code -> { repeating, last }
  let latest = null; // the code pressed last: the only one the keyboard repeats

  const clear = () => held.clear();
  const onHidden = () => { if (document.hidden) clear(); };
  addEventListener('blur', clear);
  addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', onHidden);

  return {
    /** @param {string} code  @param {boolean} [repeat] the keydown's e.repeat */
    add(code, repeat = false) {
      const k = held.get(code);
      if (k) { k.last = now(); if (repeat) k.repeating = true; }
      // A repeat for a key we do not have: it was held through a blur or a hidden
      // tab (clear() dropped it). It is repeating, so it expires like any other.
      else held.set(code, { repeating: repeat, last: now() });
      if (!repeat || !k) latest = code;
    },
    delete(code) { return held.delete(code); },
    has(code) {
      const k = held.get(code);
      if (!k) return false;
      if (code === latest && k.repeating && now() - k.last > REPEAT_QUIET_MS) { held.delete(code); return false; }
      return true;
    },
    clear,
    get size() { return held.size; },
    dispose() {
      removeEventListener('blur', clear);
      removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', onHidden);
    },
  };
}
