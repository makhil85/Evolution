// The flight camera.
//
// The scene uses a floating origin pinned to the ship, so the ship is always at
// (0,0,0) in scene space and this camera only ever reasons about offsets from
// the origin. That keeps every number small no matter where in the solar system
// she is.
//
// Three modes, cycled with C:
//   chase - CHASE_CAMERA from the contract: straight behind and a little
//           above. It swings round behind her as she turns.
//   orbit - free look around the ship; does not follow her heading
//   top   - straight down onto the orbital plane: the best view for reading
//           the predicted path, because the physics IS this plane
//
// Mouse drag orbits in every mode; the wheel zooms exponentially from the
// cockpit out to a whole-planet view. In chase mode a drag is a temporary
// look-around that eases back after a moment, so a child who drags and lets go
// isn't left flying backwards.
import * as THREE from 'three';
import { CHASE_CAMERA } from './contracts.js';

const MODES = ['chase', 'orbit', 'top'];
const RECENTRE_AFTER = 1.6;   // seconds of no dragging before chase eases back
const DRAG_RAD_PER_PX = 0.005;

const CHASE_OFFSET = new THREE.Vector3(...CHASE_CAMERA.offset);
const CHASE_LOOK = new THREE.Vector3(...CHASE_CAMERA.lookAt);
const CHASE_LEN = CHASE_OFFSET.distanceTo(CHASE_LOOK);
const MIN_DIST = CHASE_LEN * 0.55;
const MAX_DIST = 20000; // a whole Saturn system from above (its zone is 6,000 u)

const UP = new THREE.Vector3(0, 1, 0);
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * @param {{ camera: THREE.PerspectiveCamera, baseFov: number }} opts
 */
export function createFlightCamera({ camera, baseFov }) {
  let mode = 'chase';
  let distance = CHASE_LEN;
  let targetDistance = CHASE_LEN;

  let yawOffset = 0;      // chase: drag look-around, eases back to 0
  let pitchOffset = 0;
  let sinceDrag = Infinity;

  let orbitYaw = 0;       // orbit/top: absolute angles
  let orbitPitch = 0.5;

  let smoothedYaw = null;
  let shake = 0;
  let shakeT = 0;         // the shake's clock (seconds while it runs)
  let fovKick = 0;
  const look = new THREE.Vector3();

  return {
    get mode() { return mode; },
    get distance() { return distance; },

    cycle() {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      if (mode === 'top') targetDistance = Math.max(targetDistance, 60);
      if (mode === 'chase') { yawOffset = 0; pitchOffset = 0; targetDistance = CHASE_LEN; }
      if (mode === 'orbit' && smoothedYaw !== null) orbitYaw = smoothedYaw + 0.55;
      return mode;
    },
    setMode(m) { if (MODES.includes(m)) mode = m; },
    /** Jump to a zoom level, e.g. pull out when entering a planet's system. */
    setDistance(d, instant = false) {
      targetDistance = THREE.MathUtils.clamp(d, MIN_DIST, MAX_DIST);
      if (instant) distance = targetDistance;
    },
    resetZoom() { targetDistance = CHASE_LEN; },
    /** Slingshot exit, big burns: a brief widening of the view. */
    kick(fovDelta = 8) { fovKick = Math.max(fovKick, fovDelta); },
    shake(amount = 0.15) { shake = Math.max(shake, amount); },

    /**
     * @param {{ dt: number, yaw: number, mouse: {dx,dy,wheel,dragging} }} f
     *   yaw    - the ship group's rotation.y (so CHASE_CAMERA's ship-frame
     *            offset can be rotated exactly as the ship is)
     *   hold   - keep the chase direction still (time warp)
     *   follow - swing-round rate behind her, 1/s (default 2.4)
     *
     * The chase view stays straight behind her (lead, 2026-10-06); it no
     * longer turns toward a nearby planet by itself.
     */
    update({ dt, yaw, mouse, hold = false, follow = 2.4 }) {
      if (mouse.wheel) {
        targetDistance = THREE.MathUtils.clamp(targetDistance * Math.exp(mouse.wheel * 0.0012), MIN_DIST, MAX_DIST);
      }
      distance += (targetDistance - distance) * (1 - Math.exp(-dt * 8));

      const aimYaw = yaw;
      if (smoothedYaw === null) smoothedYaw = aimYaw;
      // hold: time warp - keep the view still (see main.js); follow: how fast
      // the chase view swings round behind her (gentler on the autopilot).
      if (!hold) smoothedYaw += wrapAngle(aimYaw - smoothedYaw) * (1 - Math.exp(-dt * follow));

      if (mouse.dragging) sinceDrag = 0; else sinceDrag += dt;
      const s = distance / CHASE_LEN;

      if (mode === 'chase') {
        yawOffset -= mouse.dx * DRAG_RAD_PER_PX;
        pitchOffset = THREE.MathUtils.clamp(pitchOffset + mouse.dy * DRAG_RAD_PER_PX, -0.5, 1.2);
        if (sinceDrag > RECENTRE_AFTER) {
          yawOffset *= Math.exp(-dt * 1.8);
          pitchOffset *= Math.exp(-dt * 1.8);
        }
        // The contract offset, lifted by any drag pitch, rotated with the ship.
        tmpPos.copy(CHASE_OFFSET).sub(CHASE_LOOK);
        const flat = Math.hypot(tmpPos.x, tmpPos.z);
        const pitch = Math.atan2(tmpPos.y, flat) + pitchOffset;
        const baseYaw = Math.atan2(tmpPos.x, tmpPos.z);
        const len = tmpPos.length();
        tmpPos.set(Math.sin(baseYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(baseYaw) * Math.cos(pitch)).multiplyScalar(len);
        tmpPos.add(CHASE_LOOK).multiplyScalar(s).applyAxisAngle(UP, smoothedYaw + yawOffset);
        tmpLook.copy(CHASE_LOOK).multiplyScalar(s).applyAxisAngle(UP, smoothedYaw + yawOffset);
      } else {
        orbitYaw -= mouse.dx * DRAG_RAD_PER_PX;
        let p;
        if (mode === 'orbit') {
          orbitPitch = THREE.MathUtils.clamp(orbitPitch + mouse.dy * DRAG_RAD_PER_PX, -1.45, 1.45);
          p = orbitPitch;
        } else {
          p = 1.5607; // just shy of vertical so lookAt keeps a stable up
        }
        const cp = Math.cos(p);
        tmpPos.set(Math.sin(orbitYaw) * cp, Math.sin(p), Math.cos(orbitYaw) * cp).multiplyScalar(distance);
        tmpLook.set(0, 0, 0);
      }

      look.lerp(tmpLook, 1 - Math.exp(-dt * 10));
      camera.position.copy(tmpPos);
      if (shake > 0.0005) {
        // A smooth sway by time, not per-frame noise: it looks the same at any frame rate.
        shakeT += dt;
        camera.position.x += Math.sin(shakeT * 67) * shake * distance * 0.025;
        camera.position.y += Math.cos(shakeT * 53) * shake * distance * 0.025;
        shake *= Math.exp(-dt * 5);
      }
      camera.up.copy(UP);
      camera.lookAt(look);

      fovKick *= Math.exp(-dt * 2.2);
      const fov = baseFov + fovKick;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
