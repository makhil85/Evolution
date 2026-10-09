// Chapter 7's board film (lead 2026-10-09: "zoom into a window of the ship to the girl").
// Before the first walk of each part, the flight view leaves her small rocket (not drawn
// once she is aboard) and glides slowly round the starship to one lit window of its habitat
// ring, then pushes in until the glass fills the frame. There the film holds, and the picture
// cross-fades into the walk's first frame (her, inside): no black, so the child sees we went
// in through that window. Seven seconds, skippable after 1 s like the other films
// (cinematics.js). Its caption stays up readMs (src/play/readTime.js).
//
// Our choice (not a lead rule): the film plays once per part, before the first walk of
// that part (its act), because the films should stay few. Part B has three walks, Part C
// two, and the rest start as before.
//
// It runs as `game.cinematic` on the flight frame (main.js): flight is paused, the HUD is
// hidden, and the starship's ring stops turning so the window stays put. Its shot is
// worked out once per film, and each frame only writes into scratch vectors. The hand-over
// takes one snapshot of the canvas (main.js game.frameSnapshot) and fades that image out
// over the walk. The overlay, the skip listener, the image and the timers are disposed.
import * as THREE from 'three';
import { buildOverlay, waitForSkip, ease } from '../cinematics.js';
import { showStarship } from '../ch6/opening.js';
import { readMs } from '../../play/readTime.js';
import { t } from '../level.js';

export const FILM_S = 7; // the film's clock, seconds (about 6-8 s); the last 0.4 s hold on the glass
export const SKIP_AFTER_MS = 1000; // skippable after 1 s, as the other films
const SPIN = 0.12; // the habitat ring's spin in showStarship (ch6/opening.js), put back after the film
const RING_R = 62.12; // the ring's outer edge (62 m) plus the window panels' 0.12 m (ch6/starship.js)
const WINDOW_ANGLE = Math.PI / 3; // 60 degrees round the ring from the port: a lit window on the z = 0 row
const BLEND_S = 1.2; // her flight view eases into the shot
const GLIDE_END = 5.2; // the slow glide round to the window ends here
const PUSH_END = 6.6; // then the push in ends on the glass
const HAND_OVER_MS = 1200; // the film's last picture fades out over the walk this long
const CAPTION_AT = 0.5;
// The shot, in the ring's metres from the window: [out along its normal, along the ring,
// along its axis]. Far off and round to the side, then nearer, then 3 m off the glass: the lit
// window takes under half the frame and the ring round it still shows. (At 1-2 m the window
// panel filled the frame and its glow washed it out to a flat cream.)
const SHOT = [[90, 60, 40], [30, 12, 6], [3, 0, 0]];

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
 * The board film: resolves once its last picture has handed over to the walk (the walk
 * starts under the fading image; no black in between).
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
  let skipped = false;
  const skip = waitForSkip(SKIP_AFTER_MS, () => overlay.showSkip(true));
  skip.promise.then(() => { skipped = true; }); // hands over from wherever the camera is now (no jump)

  const prevPaused = game.paused;
  game.paused = true;
  game.warpIndex = 0;
  game.controls.setEnabled(false);
  document.body.classList.add('in-cinematic');

  let clock = 0;
  let captioned = false; let captionDone = false; let ended = false;
  let finish;
  const done = new Promise((r) => { finish = r; });

  // The last picture: a snapshot of the frame as it is, faded out over the walk's first frames.
  const handOver = () => {
    ended = true;
    const shot = game.frameSnapshot?.() ?? null;
    overlay.remove();
    if (shot) {
      const img = document.createElement('img');
      img.src = shot;
      Object.assign(img.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover', zIndex: '60', pointerEvents: 'none', transition: `opacity ${HAND_OVER_MS}ms ease` });
      document.body.appendChild(img);
      setTimeout(() => { img.style.opacity = '0'; }, 120); // after the walk has drawn its first frame
      setTimeout(() => img.remove(), 120 + HAND_OVER_MS + 200);
    }
    finish();
  };

  game.cinematic = {
    calm: true,
    hideMarkers: true,
    hidePath: true,
    get t() { return clock; },
    apply(dt, camera) {
      if (ended) return;
      dt = Math.max(0, Math.min(dt, 0.1));
      clock += dt;
      if (clock < GLIDE_END) _pos.lerpVectors(K[0], K[1], ease((clock - BLEND_S) / (GLIDE_END - BLEND_S)));
      else _pos.lerpVectors(K[1], K[2], ease((clock - GLIDE_END) / (PUSH_END - GLIDE_END)));
      _look.lerpVectors(hub, win, ease((clock - BLEND_S) / (PUSH_END - BLEND_S)));
      blendTo(camera, _pos, _look, ease(clock / BLEND_S));
      if (!captioned && clock >= CAPTION_AT) { captioned = true; overlay.showTitle(); }
      if (captioned && !captionDone && clock >= CAPTION_AT + captionS) { captionDone = true; overlay.hideTitle(); }
      // The film ends on the glass (the last frame), or at once on a skip, from this pose.
      if (clock >= FILM_S || skipped) handOver();
    },
  };

  return done.then(() => {
    // The walk takes over under its fading picture: restore the flight state.
    game.cinematic = null;
    game.paused = prevPaused;
    game.controls.setEnabled(true);
    starship.setRingSpin(SPIN);
    document.body.classList.remove('in-cinematic');
    skip.dispose();
  });
}
