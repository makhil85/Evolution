// Chapter 7's board film (lead 2026-10-09: "a slow cut scene where we zoom into a
// window of the rocket to the girl"). Before the first walk of each part, the flight
// view leaves her rocket (hidden in this chapter) and glides slowly round the starship
// to one lit window of its habitat ring, then pushes in on it. The walk starts from
// there, after a soft fade. Seven seconds, skippable after 1 s like the other films
// (cinematics.js); its caption stays up readMs (src/play/readTime.js).
//
// Once per part, not per walk: Part B has three walks, Part C two. Lead 2026-10-09
// said the film must not come before every walk, so the first walk of each part
// (its act) gets it and the rest start as before.
//
// It runs as `game.cinematic` on the flight frame (main.js): flight is paused, the
// HUD is hidden, and the starship's ring stops turning so the window stays put. Its
// shot is worked out once per film, and each frame only writes into scratch vectors.
// What it makes (the overlay, the skip listener, its timers) is disposed at the end.
import * as THREE from 'three';
import { buildOverlay, waitForSkip, ease } from '../cinematics.js';
import { showStarship } from '../ch6/opening.js';
import { readMs } from '../../play/readTime.js';
import { t } from '../level.js';

export const FILM_S = 7; // the film's clock, seconds (about 6-8 s)
export const SKIP_AFTER_MS = 1000; // skippable after 1 s, as the other films
const SPIN = 0.12; // the habitat ring's spin in showStarship (ch6/opening.js), put back after the film
const RING_R = 62.12; // the ring's outer edge (62 m) plus the window panels' 0.12 m (ch6/starship.js)
const WINDOW_ANGLE = Math.PI / 3; // 60 degrees round the ring from the port: a lit window on the z = 0 row
const BLEND_S = 1.2; // her flight view eases into the shot
const GLIDE_END = 5.2; // the slow glide round to the window ends here
const PUSH_END = 6.6; // then the push in ends on the glass
const FADE_AT = 6; // the screen starts to go black (the overlay's fade takes 1.4 s)
const FADE_MS = 1400;
const CAPTION_AT = 0.5;
// The shot, in the ring's metres from the window: [out along its normal, along the ring,
// along its axis]. Far off and round to the side, then nearer, then a few metres off the glass.
const SHOT = [[90, 60, 40], [30, 12, 6], [7, 0, 0]];

/** Where the film's clock goes when she skips: straight to the fade. */
export function skipClock(now) { return Math.max(now, FADE_AT); }

/**
 * Is the board film due before a walk? Once per part: the first walk in each act
 * (act 1 is Part A ... act 5 is Part E). `state` remembers the act it last filmed.
 */
export function filmDue(state, act) {
  if (act == null || state.boardFilmAct === act) return false;
  state.boardFilmAct = act;
  return true;
}

/** Runs before a walk from the flight view (main.js runScene): the film, if it is due. */
export function boardFilmBeforeWalk(game) {
  return filmDue(game, game.missions?.step?.act) ? playBoardFilm(game) : undefined;
}

// Scratch for the camera, so a frame allocates nothing (blendCamera in cinematics.js does).
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _flight = new THREE.Vector3();
const _flightLook = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _aimAt = new THREE.Vector3();

// Eases the camera from its flight pose (already in the camera) to pos/look, by w (0..1).
// Like blendCamera in cinematics.js, but it reuses the scratch vectors above.
function blendTo(camera, pos, look, w) {
  _flight.copy(camera.position);
  _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _flightLook.copy(_fwd).multiplyScalar(pos.distanceTo(look)).add(_flight);
  camera.position.lerpVectors(pos, _flight, 1 - w);
  _aimAt.lerpVectors(look, _flightLook, 1 - w);
  camera.up.set(0, 1, 0);
  camera.lookAt(_aimAt);
}

/**
 * The board film: resolves once the screen is black, after the walk's scene is
 * ready to take over (the walk fades back in from black here).
 * @returns {Promise<void>}
 */
export function playBoardFilm(game) {
  const starship = showStarship(game).ship;
  const ring = starship.group.getObjectByName('habitat-ring');
  starship.group.updateMatrixWorld(true);
  starship.setRingSpin(0); // the window stays where the shot goes

  // The shot's points, in world space: the ring's own frame, outward (n), round it (tg) and along its axis.
  const c = Math.cos(WINDOW_ANGLE); const s = Math.sin(WINDOW_ANGLE);
  const at = ([n, tg, ax]) => ring.localToWorld(new THREE.Vector3((RING_R + n) * c - tg * s, (RING_R + n) * s + tg * c, ax));
  const K = SHOT.map(at);
  const hub = ring.localToWorld(new THREE.Vector3());
  const win = ring.localToWorld(new THREE.Vector3(RING_R * c, RING_R * s, 0));

  const caption = `Chapter 7 ${t('Aboard the starship', 'On board!')}`;
  const captionS = readMs(caption) / 1000;
  const overlay = buildOverlay({ eyebrow: 'Chapter 7', title: t('Aboard the starship', 'On board!'), sub: '', startBlack: false });
  overlay.bars(true);
  const skip = waitForSkip(SKIP_AFTER_MS, () => overlay.showSkip(true));

  const prevPaused = game.paused;
  game.paused = true;
  game.warpIndex = 0;
  game.controls.setEnabled(false);
  document.body.classList.add('in-cinematic');

  let clock = 0;
  let captioned = false; let captionDone = false; let faded = false; let ended = false;
  let finish;
  const done = new Promise((r) => { finish = r; });
  skip.promise.then(() => { clock = skipClock(clock); });

  game.cinematic = {
    calm: true,
    hideMarkers: true,
    hidePath: true,
    get t() { return clock; },
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      clock += dt;
      if (clock < GLIDE_END) _pos.lerpVectors(K[0], K[1], ease((clock - BLEND_S) / (GLIDE_END - BLEND_S)));
      else _pos.lerpVectors(K[1], K[2], ease((clock - GLIDE_END) / (PUSH_END - GLIDE_END)));
      _look.lerpVectors(hub, win, ease((clock - BLEND_S) / (PUSH_END - BLEND_S)));
      blendTo(camera, _pos, _look, ease(clock / BLEND_S));
      if (!captioned && clock >= CAPTION_AT) { captioned = true; overlay.showTitle(); }
      if (captioned && !captionDone && clock >= CAPTION_AT + captionS) { captionDone = true; overlay.hideTitle(); }
      if (!faded && clock >= FADE_AT) { faded = true; overlay.darken(); }
      // The film ends once the screen is black: the shot holds until the fade is done.
      if (clock >= FILM_S && !ended) { ended = true; setTimeout(finish, FADE_MS); }
    },
  };

  return done.then(() => {
    // The walk takes over under the black: restore the flight state and fade back in.
    game.cinematic = null;
    game.paused = prevPaused;
    game.controls.setEnabled(true);
    starship.setRingSpin(SPIN);
    document.body.classList.remove('in-cinematic');
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    setTimeout(() => overlay.light(), 100);
    setTimeout(() => overlay.remove(), 100 + FADE_MS + 200);
  });
}
