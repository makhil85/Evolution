// Flight input: keyboard (or the on-screen touch buttons, which press the
// same keys through press()) for the ship, mouse or finger drag for the camera.
//
// Only FLIGHT keys live here. The HUD owns its own keys (M map, J mission card,
// H controls, Esc pause) so nobody binds one key twice. Everything is read as
// state, not events, because physics runs at a fixed step that does not line up
// with keydown: the loop samples `input` once per physics step.
//
// While a modal is open (the HUD emits 'ui-modal' true/false on the bus), every
// flight key reads as released. A child typing "180" into a question box must
// not also be firing the engine.

import { createHeldKeys } from '../game/heldKeys.js';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * @param {{ bus: {on: Function, emit: Function}, element: HTMLElement }} opts
 */
export function createControls({ bus, element }) {
  const down = createHeldKeys(); // a lost keyup must not leave the engine on
  let modal = false;

  /** Sampled by the physics loop. Same object every time - read, don't keep. */
  const input = { thrust: 0, turn: 0, strafe: 0, precision: false, steady: false };

  const mouse = { dragging: false, dx: 0, dy: 0, wheel: 0, lastX: 0, lastY: 0 };

  function isTyping(e) {
    const t = e.target;
    return t && (TYPING.has(t.tagName) || t.isContentEditable);
  }

  /** The one-shot action a key fires when it goes down (not while held). */
  function oneShot(k) {
    if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3' || k === 'Digit4') {
      bus.emit('warp-request', Number(k.slice(5)) - 1);
    } else if (k === 'KeyE') {
      bus.emit('interact');
    } else if (k === 'KeyR') {
      bus.emit('rewind');
    } else if (k === 'KeyC') {
      bus.emit('camera-cycle');
    }
  }

  function onKeyDown(e) {
    if (modal || isTyping(e)) return;
    const k = e.code;
    down.add(k, e.repeat);
    if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault(); // no page scroll
    // Repeats from a held key are ignored so a held 3 doesn't spam warp requests.
    if (!e.repeat) oneShot(k);
  }

  function onKeyUp(e) {
    down.delete(e.code);
  }

  function onBlur() {
    // Alt-tab with W held would otherwise leave the engine on forever.
    down.clear();
  }

  function onPointerDown(e) {
    if (modal || e.button !== 0 && e.button !== 2) return;
    mouse.dragging = true;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
    element.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!mouse.dragging) return;
    mouse.dx += e.clientX - mouse.lastX;
    mouse.dy += e.clientY - mouse.lastY;
    mouse.lastX = e.clientX;
    mouse.lastY = e.clientY;
  }

  function onPointerUp(e) {
    mouse.dragging = false;
    element.releasePointerCapture?.(e.pointerId);
  }

  function onWheel(e) {
    if (modal) return;
    e.preventDefault();
    // Normalise line/page deltas so every mouse zooms at a similar rate.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    mouse.wheel += e.deltaY * unit;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerUp);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', (e) => e.preventDefault());

  const offModal = bus.on('ui-modal', (open) => {
    modal = !!open;
    if (modal) { down.clear(); mouse.dragging = false; }
  });

  let enabled = true;

  return {
    input,
    /** Refresh `input` from the held keys. Call once per frame before physics. */
    sample() {
      const on = enabled && !modal;
      const fwd = on && (down.has('KeyW') || down.has('ArrowUp'));
      const back = on && (down.has('KeyS') || down.has('ArrowDown'));
      const left = on && (down.has('KeyA') || down.has('ArrowLeft'));
      const right = on && (down.has('KeyD') || down.has('ArrowRight'));
      input.precision = on && (down.has('ShiftLeft') || down.has('ShiftRight'));
      input.steady = on && down.has('Space');
      input.thrust = (fwd ? 1 : 0) - (back ? 1 : 0);
      // +1 = turn right. That is physics.js's convention (turn +1 raises the
      // heading angle, which swings the nose to starboard) and ship.js's
      // setTurn(+1), so the one number feeds both unchanged.
      input.turn = (right ? 1 : 0) - (left ? 1 : 0);
      // Side thrusters (lead: reaching asteroids needs a little sideways
      // nudge): Z left, X right. +1 = to her right.
      input.strafe = (on && down.has('KeyX') ? 1 : 0) - (on && down.has('KeyZ') ? 1 : 0);
      return input;
    },
    /** Mouse movement since the last call, then zeroed. */
    takeMouse() {
      const out = { dx: mouse.dx, dy: mouse.dy, wheel: mouse.wheel, dragging: mouse.dragging };
      mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0;
      return out;
    },
    /**
     * On-screen buttons (touch.js): press or release a key exactly as the
     * keyboard would, so every system that reads keys works unchanged.
     */
    press(code, on) {
      if (on) {
        if (modal || down.has(code)) return;
        down.add(code);
        oneShot(code);
      } else {
        down.delete(code);
      }
    },
    /** Surface scenes and cutscenes turn flight input off without a modal. */
    setEnabled(v) { enabled = !!v; if (!enabled) down.clear(); },
    isDown(code) { return !modal && enabled && down.has(code); },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      down.dispose();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
      offModal?.();
    },
  };
}
