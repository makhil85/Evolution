// Fun moves: H handstand, J jumping jacks, K dance, L forward roll, U moonwalk,
// I splits, B back walkover.
//
// Shared by Chapters 1-3 (the villages). The moves are ordinary clips on the
// girl (src/character/clips.js), played as one-shots through the avatar, so a
// hand-modelled .glb without them simply does nothing.
//
// Jacks, the dance and the handstand stop the moment she walks. The roll
// and the moonwalk MOVE her, so while they play this module drives her
// input - through the chapter's own controller, so walls and trees still
// stop her:
//   roll      one body length forward, mid-turn; can't be cancelled.
//   moonwalk  a slow backward glide the whole time, still facing forward;
//             any movement key ends it.
import { CLIPS } from '../character/clips.js';

/** Set once she has used a fun move (the hint then stops). Not game state. */
const FUN_USED_KEY = 'rocket_village_fun_moves_used';

export const EMOTE_KEYS = {
  KeyH: 'handstand', KeyJ: 'jumpingJacks', KeyK: 'dance', KeyL: 'roll', KeyU: 'moonwalk',
  KeyI: 'splits', KeyB: 'backWalkover',
};

/** How many times each clip loops per key press. */
const LOOPS = { handstand: 1, jumpingJacks: 3, dance: 2, roll: 1, moonwalk: 3, splits: 1, backWalkover: 1 };

/** Walk speed of the shared controller (src/game/physics.js default). */
const WALK_SPEED = 5.4;

/** Moonwalk glide: a fraction of walking speed. */
const MOONWALK_SPEED = 0.2;

const duration = (id) => CLIPS.find((c) => c.id === id)?.duration ?? 1;

const typing = (e) => {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/**
 * @param {object} deps
 * @param {() => object|null} deps.getAvatar  the loaded avatar (play(), stop())
 * @param {() => object|null} deps.getTarget  the player object (rotation.y = facing)
 * @param {() => boolean} deps.isBlocked      a question / card is open
 * @param {number} deps.height                her height in world units
 * @param {(text:string) => void} [deps.hint] shows the one-time key hint
 */
export function createEmotes({ getAvatar, getTarget, isBlocked, height, hint }) {
  // The move that is driving her right now (roll or moonwalk), else null:
  // { name, t, dur, yaw, from?, to? }
  let drive = null;

  function trigger(name) {
    const avatar = getAvatar();
    const target = getTarget();
    if (!avatar || !target || drive || isBlocked()) return false;
    const hold = duration(name) * (LOOPS[name] || 1);
    try { localStorage.setItem(FUN_USED_KEY, '1'); } catch { /* private mode */ }
    // Moving moves end in THIS module (the avatar would stop them the moment
    // the glide counts as walking); the rest give way when she walks.
    const moves = name === 'roll' || name === 'moonwalk';
    const ok = avatar.play(name, { fade: 0.15, hold, interruptible: !moves });
    if (!ok) return false;
    const yaw = target.rotation.y;
    if (name === 'roll') {
      // Push while she is upside down in the middle of the turn; the length
      // of the push sets the distance (about 1.1 of her heights).
      const push = (1.1 * height) / WALK_SPEED;
      const mid = hold * 0.46;
      drive = { name, t: 0, dur: hold, yaw, from: mid - push / 2, to: mid + push / 2 };
    } else if (name === 'moonwalk') {
      drive = { name, t: 0, dur: hold, yaw };
    }
    return true;
  }

  const onKey = (e) => {
    const name = EMOTE_KEYS[e.code];
    if (!name || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    trigger(name);
  };
  addEventListener('keydown', onKey);

  // The key hint is for a child who hasn't found the moves yet: once she has
  // used one, it stops coming back on every visit.
  let used = false;
  try { used = localStorage.getItem(FUN_USED_KEY) === '1'; } catch { /* private mode */ }
  if (hint && !used) setTimeout(() => { if (!isBlocked()) hint('Fun moves: try the H, J, K, L, U, I and B keys!'); }, 9000);

  const still = { forward: 0, strafe: 0, run: false, jump: false };

  return {
    trigger,
    get rolling() { return drive?.name === 'roll'; },
    get active() { return drive?.name || null; },

    /**
     * Wrap the chapter's movement input. While a moving move plays she
     * follows it; otherwise the input passes through untouched.
     */
    input(base, dt) {
      if (!drive) return base;
      drive.t += dt;
      if (drive.t >= drive.dur || isBlocked()) { drive = null; return base; }
      if (drive.name === 'moonwalk') {
        // Her own keys win: any move ends the moonwalk.
        if (base.forward || base.strafe) { getAvatar()?.stop?.(); drive = null; return base; }
        // Camera yaw = her facing makes "forward" point straight behind her.
        return { ...still, forward: 1, cameraYaw: drive.yaw, speedScale: MOONWALK_SPEED, keepFacing: true };
      }
      const pushing = drive.t >= drive.from && drive.t <= drive.to;
      // forward = +1 with the camera yaw set behind her facing moves her
      // exactly the way she faces (see the controller's camera basis).
      return { ...still, forward: pushing ? 1 : 0, cameraYaw: drive.yaw + Math.PI };
    },

    dispose() { removeEventListener('keydown', onKey); },
  };
}
