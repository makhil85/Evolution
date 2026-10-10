// The camera for the walking chapters (1-3): two views, one helper.
//
// 'chase' is the camera the game has always had. The mouse swings it round
// and she walks where it looks (A/D strafe).
//
// 'follow' is the spaceship view. The camera sits right behind her and turns
// with her. A/D (or the arrows) turn her on the spot, W/S walk her along her
// heading, and a mouse drag looks round for a moment before it eases back.
//
// The choice is remembered for the session (sessionStorage). C, or the Camera
// pill on the HUD, switches it. The chapter still owns the camera while a film
// or a cutscene runs: it only asks this helper for the yaw and the ease.

const KEY = 'rv-camera-view';
/** rad/s: the follow view's A/D turn, a comfortable walk-round pace. */
export const TURN_RATE = 2;
/** Seconds after a drag before the follow view's look eases back behind her. */
export const LOOK_HOLD = 1.5;
/** Per second: how fast that look eases back. */
const LOOK_EASE = 4;
/** Radians per pixel of drag (the same feel as the chase camera). */
const DRAG_RATE = 0.006;
/** Per second: how fast the follow camera's position catches up. Fast enough that a turn has no lag swing. */
const FOLLOW_EASE = 40;

function loadView() {
  try { return sessionStorage.getItem(KEY) === 'follow' ? 'follow' : 'chase'; }
  catch { return 'chase'; }
}
function saveView(view) {
  try { sessionStorage.setItem(KEY, view); }
  catch { /* blocked storage: the choice lasts this page only */ }
}
/** Wrap an angle to (-PI, PI]. */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param {{ rotation: { y: number } }} player her group: she faces rotation.y
 *   (walking along (sin y, cos y)), so "right behind her" is y + PI
 */
export function createCameraView(player) {
  let view = loadView();
  let chaseYaw = 0;      // chase: the camera's yaw, which the mouse sets and she walks along
  let look = 0;          // follow: the mouse's swing off "right behind her"
  let quiet = LOOK_HOLD; // seconds since the last drag

  const behind = () => player.rotation.y + Math.PI;

  return {
    get view() { return view; },

    /** The camera's yaw right now (the chapter's chase pose reads it). */
    get yaw() { return view === 'follow' ? behind() + look : chaseYaw; },
    set yaw(y) {
      if (view === 'follow') look = wrap(y - behind());
      else chaseYaw = y;
    },

    /** The fraction the camera's position moves toward its pose this frame. */
    ease(dt) {
      return view === 'follow' ? 1 - Math.exp(-FOLLOW_EASE * dt) : 1 - Math.pow(0.0001, dt);
    },

    /** Switch views and remember the choice. Returns the new view. */
    toggle() {
      if (view === 'chase') {
        // The camera starts where it is and eases round behind her, so nothing jumps.
        look = wrap(chaseYaw - behind());
        quiet = LOOK_HOLD;
        view = 'follow';
      } else {
        chaseYaw = behind() + look;
        look = 0;
        view = 'chase';
      }
      saveView(view);
      return view;
    },

    /** A mouse drag of dx pixels: the chase camera swings; the follow camera looks round, then eases back. */
    drag(dx) {
      if (view === 'follow') { look -= dx * DRAG_RATE; quiet = 0; }
      else chaseYaw -= dx * DRAG_RATE;
    },

    /**
     * Turn the raw keys (forward, strafe, run, jump) into the controller's move input.
     * A scripted move (an emote) sets its own cameraYaw, and passes through untouched.
     * @param {object} keys
     * @param {number} dt
     */
    input(keys, dt) {
      if (view === 'chase' || keys.cameraYaw !== undefined) return { ...keys, cameraYaw: keys.cameraYaw ?? chaseYaw };
      quiet += dt;
      if (quiet > LOOK_HOLD) look *= Math.exp(-LOOK_EASE * dt);
      // D (strafe +1) turns her right, which lowers her heading.
      player.rotation.y -= (keys.strafe || 0) * TURN_RATE * dt;
      return { ...keys, strafe: 0, cameraYaw: behind(), keepFacing: true };
    },
  };
}
