// Fixed-timestep character controller for the village.
//
// Two decisions here were forced by defects in the build this replaced, and
// are worth keeping written down:
//
//   1. It integrated against the *render* dt, so a stutter changed how far the
//      girl travelled and how high she jumped. A fixed 1/60 s tick with an
//      accumulator makes movement identical on a 30 Hz phone and a 144 Hz
//      laptop, which matters because the jump arc is authored in tile units.
//   2. Its colliders recorded a `height` that nothing ever read - collision was
//      flat, and she walked through the air above a wall as happily as around
//      it. Y is owned here, in full: support surfaces, ceilings, step-up,
//      ground detection.
//
// Deliberately free of THREE: the controller writes into any object shaped like
// `{ position: {x,y,z}, rotation: {y} }`, which is exactly a THREE.Group and
// also exactly a plain object in a node harness. That keeps the maths testable
// headlessly and keeps this module out of the render dependency graph.
import { AVATAR_HEIGHT, GROUND_Y } from './contracts.js';

/** Simulation tick. Everything below is authored against this, not render dt. */
export const FIXED_DT = 1 / 60;

/**
 * Most ticks one frame may consume. A long frame (tab restore, first shader
 * compile) must drop time rather than run 400 ticks, which would stall the
 * frame after it and spiral into a freeze.
 */
export const MAX_SUBSTEPS = 5;

/** Feet-to-support slack that still counts as standing. One centimetre-ish. */
const GROUND_EPSILON = 0.02;

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Frame-rate independent exponential approach. */
function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// Solids — the world volumes the capsule collides with, horizontally AND in Y
// ---------------------------------------------------------------------------

/**
 * A collidable volume: a 2D footprint extruded between yMin and yMax.
 *
 * `yMax` is the walkable top. A crate authored 0.6 tall is something the girl
 * stands on; a tree authored 14 tall is a wall she never gets above. Same
 * shape, same code path — which is the whole point of storing the span.
 *
 * @typedef {object} Solid
 * @property {'box'|'circle'} type
 * @property {number} x
 * @property {number} z
 * @property {number} yMin
 * @property {number} yMax
 * @property {number} [radius]    circle only
 * @property {number} [halfX]     box only
 * @property {number} [halfZ]     box only
 * @property {number} [rotation]  box only, radians about Y
 */

/** @returns {Solid} */
function circleSolid(x, z, radius, yMin, yMax) {
  return { type: 'circle', x, z, radius, yMin, yMax };
}

/** @returns {Solid} */
function boxSolid(x, z, halfX, halfZ, rotation, yMin, yMax) {
  return { type: 'box', x, z, halfX, halfZ, rotation, yMin, yMax };
}

/**
 * Horizontal penetration test, inflated by the capsule radius.
 * Returns null when clear, otherwise the corrected {x, z} on the surface.
 */
function pushOut(solid, x, z, prevX, prevZ, radius) {
  if (solid.type === 'box') {
    const cos = Math.cos(solid.rotation || 0);
    const sin = Math.sin(solid.rotation || 0);
    const dx = x - solid.x;
    const dz = z - solid.z;
    let localX = cos * dx + sin * dz;
    let localZ = -sin * dx + cos * dz;
    const limitX = solid.halfX + radius;
    const limitZ = solid.halfZ + radius;
    if (Math.abs(localX) >= limitX || Math.abs(localZ) >= limitZ) return null;
    // Leave along the shallower axis, so sliding along a wall stays smooth.
    if (limitX - Math.abs(localX) < limitZ - Math.abs(localZ)) {
      const side = Math.sign(cos * (prevX - solid.x) + sin * (prevZ - solid.z));
      localX = (Math.sign(localX) || side || 1) * limitX;
    } else {
      const side = Math.sign(-sin * (prevX - solid.x) + cos * (prevZ - solid.z));
      localZ = (Math.sign(localZ) || side || 1) * limitZ;
    }
    return {
      x: solid.x + cos * localX - sin * localZ,
      z: solid.z + sin * localX + cos * localZ,
    };
  }

  const dx = x - solid.x;
  const dz = z - solid.z;
  const minDist = solid.radius + radius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return null;
  let nx, nz;
  if (distSq < 1e-8) {
    // Dead centre: no normal to read, so back out the way we came in.
    const fx = prevX - solid.x;
    const fz = prevZ - solid.z;
    const len = Math.hypot(fx, fz) || 1;
    nx = fx / len; nz = fz / len;
  } else {
    const dist = Math.sqrt(distSq);
    nx = dx / dist; nz = dz / dist;
  }
  return { x: solid.x + nx * minDist, z: solid.z + nz * minDist };
}

/** Footprint overlap only, ignoring Y — used for support and ceiling queries. */
function overlapsColumn(solid, x, z, radius) {
  if (solid.type === 'box') {
    const cos = Math.cos(solid.rotation || 0);
    const sin = Math.sin(solid.rotation || 0);
    const dx = x - solid.x;
    const dz = z - solid.z;
    const localX = Math.abs(cos * dx + sin * dz);
    const localZ = Math.abs(-sin * dx + cos * dz);
    return localX < solid.halfX + radius && localZ < solid.halfZ + radius;
  }
  const dx = x - solid.x;
  const dz = z - solid.z;
  const r = solid.radius + radius;
  return dx * dx + dz * dz < r * r;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * Build a fixed-timestep capsule character controller.
 *
 * The returned object matches the CharacterController contract: `step(dt,
 * input)` and `groundHeightAt(x, z)`. It writes `target.position`,
 * `target.rotation.y`, and mirrors `velocityY` / `speed` onto `target` when
 * `mirrorToTarget` is on, so a camera rig or an animation driver can read the
 * motion off the same object it follows.
 *
 * @param {object} options
 * @param {{position:{x:number,y:number,z:number}, rotation:{y:number}}} options.target
 * @param {number} [options.radius]        capsule radius, world units
 * @param {number} [options.height]        capsule height, world units
 * @param {number} [options.walkSpeed]
 * @param {number} [options.runSpeed]
 * @param {number} [options.gravity]
 * @param {number} [options.jumpHeight]    apex above the feet, in tiles
 * @param {number} [options.stepHeight]    ledge the girl walks up without jumping
 * @param {number} [options.airControl]    0..1 steering authority off the ground
 * @param {number} [options.coyoteTime]    grace after walking off an edge
 * @param {number} [options.jumpBufferTime] grace for pressing jump early
 * @param {(x:number,z:number)=>number} [options.heightField] terrain sampler
 * @param {Solid[]} [options.solids]
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}|null} [options.bounds]
 * @param {((cur:object,next:object,radius:number)=>void)|null} [options.resolveHorizontal]
 *   optional extra XZ solver run after ours - gameScene hands in the
 *   village's own prop/building collision here
 * @param {boolean} [options.mirrorToTarget]
 * @returns {object} CharacterController
 */
export function createCharacterController(options) {
  const {
    target,
    radius = 0.42,
    height = AVATAR_HEIGHT,
    walkSpeed = 5.4,
    runSpeed = 8.6,
    gravity = 18,
    // Authored as a height, not a launch speed: one tile is one world unit, so
    // "clears a 1-tile crate" is a number a designer can reason about. Changing
    // gravity for feel then keeps the jump clearing the same crate.
    jumpHeight = 1.15,
    // Falling faster than rising removes the floaty arc that a symmetric
    // parabola gives at these low gravities. Standard platformer trick.
    fallGravityMultiplier = 1.35,
    stepHeight = 0.35,
    airControl = 0.45,
    coyoteTime = 0.12,
    jumpBufferTime = 0.12,
    accelLambda = 8,
    turnLambda = 10,
    heightField = null,
    solids = [],
    bounds = null,
    resolveHorizontal = null,
    mirrorToTarget = true,
  } = options;

  if (!target) throw new Error('[physics] createCharacterController needs a target');

  const jumpSpeed = Math.sqrt(2 * gravity * jumpHeight);
  const world = solids.slice();

  let vx = 0;
  let vz = 0;
  let velocityY = 0;
  let speed = 0;
  let onGround = true;
  let moving = false;
  let running = false;
  let coyote = 0;
  let jumpBuffer = 0;
  let jumpWasHeld = false;
  let jumpCutPending = false;
  let accumulator = 0;

  /**
   * Terrain height at a column. The board is flat at GROUND_Y today, but every
   * Y decision in this module goes through here, so raised tiles later mean
   * supplying a heightField and changing nothing else.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  function groundHeightAt(x, z) {
    return heightField ? heightField(x, z) : GROUND_Y;
  }

  /**
   * Highest surface the capsule can rest on at this column, given where the
   * feet are. A solid whose top is above feet + stepHeight is a wall, not a
   * floor, so it must not silently teleport her upward.
   */
  function supportHeightAt(x, z, feetY) {
    let best = groundHeightAt(x, z);
    const reach = feetY + stepHeight;
    for (const solid of world) {
      if (solid.yMax <= best || solid.yMax > reach) continue;
      if (overlapsColumn(solid, x, z, radius)) best = solid.yMax;
    }
    return best;
  }

  /** Lowest solid underside above the head, or Infinity. */
  function ceilingAt(x, z, feetY) {
    const headY = feetY + height;
    let best = Infinity;
    for (const solid of world) {
      if (solid.yMin < headY || solid.yMin >= best) continue;
      if (overlapsColumn(solid, x, z, radius)) best = solid.yMin;
    }
    return best;
  }

  /** Solids that block horizontally at this feet height: not steppable, not overhead. */
  function blocksAt(solid, feetY) {
    return solid.yMax > feetY + stepHeight && solid.yMin < feetY + height;
  }

  function moveHorizontal(position, dx, dz) {
    if (dx === 0 && dz === 0) return;
    const feetY = position.y;
    // Sub-sweep so a sprint step cannot tunnel through the thinnest collider.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.max(0.18, radius * 0.45)));
    let x = position.x;
    let z = position.z;
    let prevX = x;
    let prevZ = z;
    for (let s = 0; s < steps; s++) {
      prevX = x; prevZ = z;
      x += dx / steps;
      z += dz / steps;
      // Three passes so a corner (two solids at once) settles instead of
      // oscillating between them.
      for (let pass = 0; pass < 3; pass++) {
        for (const solid of world) {
          if (!blocksAt(solid, feetY)) continue;
          const fixed = pushOut(solid, x, z, prevX, prevZ, radius);
          if (fixed) { x = fixed.x; z = fixed.z; }
        }
      }
    }
    position.x = x;
    position.z = z;
  }

  const _cur = { x: 0, y: 0, z: 0 };
  const _next = { x: 0, y: 0, z: 0 };

  function tick(dt, input) {
    const position = target.position;

    const f = clamp(input.forward ?? 0, -1, 1);
    const s = clamp(input.strafe ?? 0, -1, 1);
    const yaw = input.cameraYaw ?? 0;
    // Camera-relative basis: forward is -(sin yaw, cos yaw), right is
    // (cos yaw, -sin yaw).
    let dirX = -Math.sin(yaw) * f + Math.cos(yaw) * s;
    let dirZ = -Math.cos(yaw) * f - Math.sin(yaw) * s;
    const dirLen = Math.hypot(dirX, dirZ);
    moving = dirLen > 1e-3;
    if (moving) { dirX /= dirLen; dirZ /= dirLen; }
    running = moving && !!input.run;

    // speedScale / keepFacing: for scripted moves (src/game/emotes.js) - the
    // moonwalk glides backward slowly without turning round.
    const targetSpeed = moving ? (running ? runSpeed : walkSpeed) * (input.speedScale ?? 1) : 0;
    const lambda = onGround ? accelLambda : accelLambda * airControl;
    vx = damp(vx, dirX * targetSpeed, lambda, dt);
    vz = damp(vz, dirZ * targetSpeed, lambda, dt);
    speed = Math.hypot(vx, vz);

    // --- jump: edge-triggered, buffered, with coyote time -------------------
    // The build this replaced re-armed the jump every frame Space was held, so
    // holding the key bunny-hopped forever. A jump is a press, not a state.
    if (jumpBuffer > 0) jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (onGround) coyote = coyoteTime;
    else coyote = Math.max(0, coyote - dt);

    if (jumpBuffer > 0 && coyote > 0) {
      velocityY = jumpSpeed;
      onGround = false;
      coyote = 0;
      jumpBuffer = 0;
    }

    // Release early, rise less — gives the child a short hop and a full hop.
    // Fired once, on the release edge: applying it per tick while the key is up
    // compounds to 0.45^n and turns every tap into a 0.18-unit stumble.
    if (jumpCutPending) {
      if (velocityY > 0) velocityY *= 0.45;
      jumpCutPending = false;
    }

    const gScale = velocityY < 0 ? fallGravityMultiplier : 1;
    velocityY -= gravity * gScale * dt;

    // --- horizontal ---------------------------------------------------------
    _cur.x = position.x; _cur.y = position.y; _cur.z = position.z;
    moveHorizontal(position, vx * dt, vz * dt);
    if (resolveHorizontal) {
      _next.x = position.x; _next.y = position.y; _next.z = position.z;
      resolveHorizontal(_cur, _next, radius);
      position.x = _next.x;
      position.z = _next.z;
    }
    if (bounds) {
      position.x = clamp(position.x, bounds.minX, bounds.maxX);
      position.z = clamp(position.z, bounds.minZ, bounds.maxZ);
    }

    // --- vertical (owned entirely here) -------------------------------------
    const support = supportHeightAt(position.x, position.z, position.y);
    let y = position.y + velocityY * dt;

    if (y <= support) {
      y = support;
      if (velocityY < 0) velocityY = 0;
      onGround = true;
    } else {
      const ceiling = ceilingAt(position.x, position.z, position.y);
      if (y + height > ceiling) {
        y = ceiling - height;
        if (velocityY > 0) velocityY = 0;
      }
      onGround = y <= support + GROUND_EPSILON && velocityY <= 0;
      if (onGround) y = support;
    }
    position.y = y;

    // --- facing -------------------------------------------------------------
    if (moving && !input.keepFacing) {
      target.rotation.y = dampAngle(target.rotation.y, Math.atan2(dirX, dirZ), turnLambda, dt);
    }
  }

  const state = {
    position: target.position,
    headingY: target.rotation.y,
    speed: 0,
    velocityY: 0,
    onGround: true,
    moving: false,
    running: false,
  };

  /**
   * Advance the controller by a render frame's worth of time.
   * @param {number} dt render delta, seconds
   * @param {object} input MoveInput
   * @returns {object} CharacterState
   */
  function step(dt, input) {
    // Clamp before accumulating: a 4-second hitch must cost 5 ticks, not 240.
    accumulator += clamp(dt, 0, FIXED_DT * MAX_SUBSTEPS);

    const held = !!input.jump;
    if (held && !jumpWasHeld) jumpBuffer = jumpBufferTime;
    if (!held && jumpWasHeld) jumpCutPending = true;
    jumpWasHeld = held;

    let ticks = 0;
    while (accumulator >= FIXED_DT && ticks < MAX_SUBSTEPS) {
      tick(FIXED_DT, input);
      accumulator -= FIXED_DT;
      ticks++;
    }
    if (ticks === 0) {
      // Very high refresh rate: no whole tick is due, but the flags still need
      // to reflect this frame's input or the avatar animation lags a frame.
      moving = Math.abs(input.forward ?? 0) + Math.abs(input.strafe ?? 0) > 1e-3;
      running = moving && !!input.run;
    }

    state.headingY = target.rotation.y;
    state.speed = speed;
    state.velocityY = velocityY;
    state.onGround = onGround;
    state.moving = moving;
    state.running = running;

    if (mirrorToTarget) {
      target.velocityY = velocityY;
      target.speed = speed;
    }
    return state;
  }

  return {
    step,
    groundHeightAt,
    supportHeightAt,
    ceilingAt,

    /** Drop the capsule at a spot, killing momentum (spawn, respawn, teleport). */
    teleport(x, y, z) {
      target.position.x = x;
      target.position.z = z;
      target.position.y = y ?? groundHeightAt(x, z);
      vx = vz = velocityY = speed = 0;
      accumulator = 0;
      onGround = true;
    },

    /** @param {Solid} solid */
    addSolid(solid) { world.push(solid); return solid; },

    /** Upright cylinder: trees, rocks, lamp posts. */
    addCircleSolid(x, z, r, yMin = GROUND_Y, yMax = GROUND_Y + 14) {
      return this.addSolid(circleSolid(x, z, r, yMin, yMax));
    },

    /** Oriented box: buildings, crates, platforms. A low yMax is standable. */
    addBoxSolid(x, z, halfX, halfZ, rotation = 0, yMin = GROUND_Y, yMax = GROUND_Y + 14) {
      return this.addSolid(boxSolid(x, z, halfX, halfZ, rotation, yMin, yMax));
    },

    clearSolids() { world.length = 0; },

    get solids() { return world; },
    get state() { return state; },
  };
}

export default { createCharacterController, FIXED_DT, MAX_SUBSTEPS };
