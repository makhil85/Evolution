// Launch visual effects: exhaust plume, pad smoke, and a climb contrail.
//
// New module only. launch.js is not edited - the integrator constructs this
// class, adds LaunchVfx.root as a child of the SAME node the flying vehicle
// lives under (RocketComplex.group, see rocketComplex.js), and drives it with
// LaunchSequence's own per-frame state: `ignite()` once on liftoff, `update(dt,
// sample)` every frame with the same FlightSample launch.js reads, and
// `reset()` when the pad is cleared for another build.
//
// Coordinate space: launch.js keeps the vehicle's y in the SAME local space as
// the rocket pad (`this.vehicle.position.y = altitudeM * METRES_TO_UNITS`,
// where the vehicle is a child of RocketComplex.group). METRES_TO_UNITS is not
// exported from launch.js, so its value (0.01) is duplicated below as a
// documented constant - the two modules must agree on it, but neither owns
// the other so this is the only way to share it without a cross-agent edit.
// Recomputing the vehicle's y fresh from sample.altitudeM every frame (rather
// than tracking it incrementally) means the exhaust emitter and contrail are
// always exactly where the rocket is, however far a single frame's altitude
// jumps - which matters a lot once launch.js's clock ramps to 45x real time.
//
// Pooling: every effect is ONE InstancedMesh, sized to a fixed
// capacity at construction. Particle state lives in typed arrays sized once;
// `update()` only ever writes into those arrays and into scratch THREE
// objects declared at module scope (mirroring src/game/board.js) - it never
// calls `new`. Dead particles are not removed from the arrays, just flagged
// and their instance matrix zeroed, so the pool never reallocates or shrinks.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared, process-lifetime resources (never disposed).
// ---------------------------------------------------------------------------

/** One low-poly "puff" shape for every particle in every effect. */
const PUFF_GEOMETRY = new THREE.IcosahedronGeometry(1, 1); // 80 triangles

/** Mirrors launch.js's private METRES_TO_UNITS. See file header. */
const METRES_TO_UNITS = 0.01;

// ---------------------------------------------------------------------------
// Module-scope scratch. Reused by every pool, every frame - see board.js's
// _m/_q/_pos/_scl/_col convention. Safe to share: JS is single-threaded and
// each scratch value is consumed (written into a typed array or a GPU buffer
// via setMatrixAt/setColorAt) before the next line touches it again.
// ---------------------------------------------------------------------------
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _col = new THREE.Color();
const IDENTITY_Q = new THREE.Quaternion();
const ZERO_SCALE = new THREE.Vector3(0, 0, 0);

/**
 * Collapse every instance of a mesh to zero scale.
 *
 * three.js fills a new InstancedMesh with IDENTITY matrices, not blanks, so a
 * slot that has never been spawned into renders as a unit-radius puff sitting
 * at the pad centre. Because `count` is raised to the pool's full capacity as
 * soon as ANY particle is alive, those never-used slots would be drawn - a
 * pile of white spheres on the pad for the first second of the launch, and a
 * permanent one for the pad-smoke slots the ignition burst never fills.
 */
function blank(mesh) {
  _m.compose(_pos.set(0, 0, 0), IDENTITY_Q, ZERO_SCALE);
  // instanceMatrix.count is the pool's full capacity; mesh.count is only how
  // many are currently being DRAWN, which is not what needs clearing.
  for (let i = 0; i < mesh.instanceMatrix.count; i++) mesh.setMatrixAt(i, _m);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = 0;
}

/** Bell-shaped lifecycle: 0 at birth, peaks at t=0.5, back to 0 at death. */
function bell(t) {
  return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
}

// ---------------------------------------------------------------------------
// PuffPool - a pooled, animated burst of particles: exhaust and pad smoke are
// both "spawn, grow, drift, dissolve" and share this implementation.
// ---------------------------------------------------------------------------
class PuffPool {
  /**
   * @param {THREE.Object3D} root
   * @param {object} opts
   * @param {number} opts.capacity
   * @param {THREE.Color} opts.colorStart  colour at birth
   * @param {THREE.Color} opts.colorEnd    colour at death
   * @param {number} opts.peakScale        bell-curve peak size multiplier
   * @param {number} [opts.opacity=0.8]   material opacity
   *
   * NOTE: no inverted-hull outline. The rest of the game outlines its solids,
   * but an outline around a smoke puff is what turns it into a rock - and
   * skipping it saves two draw calls as well.
   */
  constructor(root, { capacity, colorStart, colorEnd, peakScale, opacity = 0.8 }) {
    this.capacity = capacity;
    this.colorStart = colorStart;
    this.colorEnd = colorEnd;
    this.peakScale = peakScale;

    // MeshBasicMaterial, not MeshToonMaterial. Toon shading puts a hard
    // light/shadow terminator across every puff, which is exactly what makes a
    // solid object read as solid - on a smoke ball it looks like a boulder.
    // The flame in launch.js is MeshBasic for the same reason. Translucent and
    // depthWrite-free so overlapping puffs merge into one soft mass instead of
    // showing their individual silhouettes.
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(PUFF_GEOMETRY, this.material, capacity);
    this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    blank(this.mesh); // also leaves count at 0 -> zero draw cost while idle
    root.add(this.mesh);

    // Pre-sized pool state. Never resized, never reallocated after this.
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.baseScale = new Float32Array(capacity);
    this.active = new Uint8Array(capacity);
    this.cursor = 0;
    this.liveCount = 0;
  }

  /** Spawn (or recycle the oldest slot into) one particle. No allocation. */
  spawn(x, y, z, { vx = 0, vy = 0, vz = 0, life = 0.6, scale = 1 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (!this.active[i]) this.liveCount++;
    this.active[i] = 1;
    this.age[i] = 0;
    this.life[i] = life;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.baseScale[i] = scale;
  }

  update(dt) {
    if (this.liveCount <= 0) return; // already zero-cost; nothing to step

    for (let i = 0; i < this.capacity; i++) {
      if (!this.active[i]) continue;

      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.active[i] = 0;
        this.liveCount--;
        _m.compose(_pos.set(this.px[i], this.py[i], this.pz[i]), IDENTITY_Q, ZERO_SCALE);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }

      const t = this.age[i] / this.life[i];
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      const s = this.baseScale[i] * this.peakScale * bell(t);
      _pos.set(this.px[i], this.py[i], this.pz[i]);
      _scl.setScalar(s);
      _m.compose(_pos, IDENTITY_Q, _scl);
      this.mesh.setMatrixAt(i, _m);

      _col.copy(this.colorStart).lerp(this.colorEnd, t);
      this.mesh.setColorAt(i, _col);
    }

    const count = this.liveCount > 0 ? this.capacity : 0;
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  /** Kill every particle immediately and drop to zero draw cost. */
  clear() {
    this.active.fill(0);
    this.liveCount = 0;
    this.cursor = 0;
    // Blank, not just count=0: particles still ALIVE at this moment never had
    // their matrices zeroed, and would flash back into view on the next
    // ignite() the instant count rises to capacity again.
    blank(this.mesh);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.material.dispose();
    // PUFF_GEOMETRY is a shared, process-lifetime resource -
    // not this pool's to dispose.
  }
}

// ---------------------------------------------------------------------------
// TrailPool - static contrail marks. Placed once, then never touched again
// until overwritten (ring buffer) or cleared, so there is no per-frame work
// at all beyond the handful of writes made when a new mark is placed.
// ---------------------------------------------------------------------------
class TrailPool {
  constructor(root, { capacity, color }) {
    this.capacity = capacity;
    this.color = color;
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(PUFF_GEOMETRY, this.material, capacity);
    this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    blank(this.mesh);
    root.add(this.mesh);

    this.cursor = 0;
    this.placed = 0;
  }

  place(x, y, z, scale) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    _pos.set(x, y, z);
    _scl.setScalar(scale);
    _m.compose(_pos, IDENTITY_Q, _scl);
    this.mesh.setMatrixAt(i, _m);
    _col.copy(this.color).multiplyScalar(0.85 + Math.random() * 0.3);
    this.mesh.setColorAt(i, _col);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.placed = Math.min(this.capacity, this.placed + 1);
    this.mesh.count = this.placed;
  }

  clear() {
    this.cursor = 0;
    this.placed = 0;
    blank(this.mesh);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

const EXHAUST_CAPACITY = 64;
const SMOKE_CAPACITY = 90;
const TRAIL_CAPACITY = 48;

/**
 * Vehicle-local y of the engine nozzle, relative to vehicle.position.y.
 *
 * MEASURED, not guessed: launch.js reparents each stage group into the vehicle
 * with `vehicle.add(stage.group)`, which keeps the group's local transform -
 * and every stage group sits at its own origin with geometry starting at the
 * foundation platform (`plat.position.y = 1.8`, half-height 0.35, so its
 * underside is 1.45). The nozzle plane is therefore ~1.5 ABOVE the vehicle
 * origin, not below it. A negative offset here would bury the first second of
 * the plume inside the pad deck (top 1.96) before the rocket climbed clear.
 */
const ENGINE_OFFSET_Y = 1.5;
/** Pad deck height, matching rocketComplex.js buildPad()'s deck/ring y. */
const PAD_Y = 2.0;

/** Units of climb over which the plume stops splashing off the pad. */
const DEFLECT_FADE = 9;

const EXHAUST_INTERVAL = 0.03; // seconds of real dt between spawns while burning
const EXHAUST_MAX_PER_FRAME = 6; // guards a stalled/slow frame, not just fast ones

const PAD_SMOKE_BURST = 84;
/**
 * The pad deck is 18 units in radius (rocketComplex.js), so a bloom confined
 * to ~5 units reads as a puff around her feet rather than smoke rolling across
 * the pad. Spawn near the centre and let the outward velocity carry it most of
 * the way to the rim over the particle's life.
 */
const PAD_SMOKE_RADIUS = 14.0;

/** World units of climb between contrail marks (local units, post METRES_TO_UNITS). */
const CONTRAIL_SPACING = 1.15;
/**
 * At 45x time scale a single real frame can carry the sim through a large
 * altitude jump, which would otherwise ask this loop to backfill dozens of
 * marks in one tick. Capping the fill and resyncing past it keeps contrail
 * placement O(1)-ish per frame regardless of how fast the clock is running -
 * the trail gets a little sparser during the fastest part of the climb
 * instead of the frame cost spiking.
 */
const CONTRAIL_MAX_PER_FRAME = 8;

const EXHAUST_COLOR_START = new THREE.Color(0xfff2b0);
const EXHAUST_COLOR_END = new THREE.Color(0x9aa0a8);
const SMOKE_COLOR_START = new THREE.Color(0xfaf6ec);
const SMOKE_COLOR_END = new THREE.Color(0xc9ced4);
const TRAIL_COLOR = new THREE.Color(0xdfe6ea);

export class LaunchVfx {
  /**
   * @param {object} deps
   * @param {THREE.Object3D} deps.parent  the node the flying vehicle also
   *   lives under (RocketComplex.group), so this effect's local coordinates
   *   line up with pad height and vehicle.position.y without extra scaling.
   * @param {number} [deps.scale=1]  extra uniform scale on top of whatever
   *   `parent` already applies (e.g. COMPLEX_SCALE) - a tuning knob, not a
   *   requirement to use.
   */
  constructor({ parent, scale = 1 } = {}) {
    if (!parent) throw new Error('LaunchVfx requires a parent Object3D');

    this.root = new THREE.Group();
    this.root.name = 'launchVfx';
    this.root.scale.setScalar(scale);
    parent.add(this.root);

    this.exhaust = new PuffPool(this.root, {
      capacity: EXHAUST_CAPACITY,
      colorStart: EXHAUST_COLOR_START,
      colorEnd: EXHAUST_COLOR_END,
      peakScale: 1.4,
      opacity: 0.85,
    });
    this.smoke = new PuffPool(this.root, {
      capacity: SMOKE_CAPACITY,
      colorStart: SMOKE_COLOR_START,
      colorEnd: SMOKE_COLOR_END,
      peakScale: 1.35,
      opacity: 0.62,
    });
    this.trail = new TrailPool(this.root, {
      capacity: TRAIL_CAPACITY,
      color: TRAIL_COLOR,
    });

    this.active = false;
    this.exhaustTimer = 0;
    this.lastTrailY = 0;
  }

  /** Fire the pad-smoke bloom and arm the per-frame emitters. Call once on liftoff. */
  ignite() {
    this.active = true;
    this.exhaustTimer = 0;
    this.lastTrailY = 0;
    this.exhaust.clear();
    this.trail.clear();
    this.smoke.clear();

    for (let i = 0; i < PAD_SMOKE_BURST; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * PAD_SMOKE_RADIUS * 0.3; // start near the pad centre
      const speed = 1.1 + Math.random() * 1.6;
      this.smoke.spawn(Math.cos(a) * r, PAD_Y + Math.random() * 0.3, Math.sin(a) * r, {
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        vy: 0.25 + Math.random() * 0.35,
        life: 3.2 + Math.random() * 2.2,
        scale: 0.5 + Math.random() * 0.75,
      });
    }
  }

  /**
   * @param {number} dt      real (wall-clock) seconds since last frame - the
   *   same dt LaunchSequence.update(dt) receives, NOT the sim-accelerated one.
   * @param {{altitudeM:number, velocityMs:number, burning:boolean}} sample
   */
  update(dt, sample) {
    if (!this.active || !sample) return;
    const y = Math.max(0, sample.altitudeM * METRES_TO_UNITS);

    if (sample.burning) {
      this.exhaustTimer += dt;
      let guard = 0;
      while (this.exhaustTimer >= EXHAUST_INTERVAL && guard < EXHAUST_MAX_PER_FRAME) {
        this.exhaustTimer -= EXHAUST_INTERVAL;
        guard++;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.7;

        // While she is still on or just above the deck the plume has nowhere
        // to go but sideways - it hits the pad and rolls outward. Emitting it
        // straight down instead buries every puff inside the pad cylinder, so
        // the first seconds of the burn (which for a heavy rocket is most of
        // the drama) show nothing at all. Blend from "splashing off the deck"
        // to "trailing behind" over the first few units of climb.
        const deflect = 1 - Math.min(1, Math.max(0, (y - PAD_Y) / DEFLECT_FADE));
        const nozzleY = y + ENGINE_OFFSET_Y;
        const spawnY = nozzleY + (PAD_Y + 0.5 - nozzleY) * deflect;
        const out = 0.7 + deflect * 3.6;

        this.exhaust.spawn(Math.cos(a) * r, spawnY, Math.sin(a) * r, {
          vx: Math.cos(a) * out,
          vz: Math.sin(a) * out,
          // Down behind the rocket when clear; drifting up off the deck when not.
          vy: (1 - deflect) * -(1.1 + Math.random() * 0.7)
            + deflect * (0.45 + Math.random() * 0.5),
          life: (0.45 + Math.random() * 0.3) * (1 + deflect * 1.8),
          scale: (0.32 + Math.random() * 0.22) * (1 + deflect * 0.9),
        });
      }
      // A stalled/backgrounded tab can hand us one huge dt; don't let the
      // timer accumulate past a single frame's worth of unspent budget.
      if (this.exhaustTimer > EXHAUST_INTERVAL * EXHAUST_MAX_PER_FRAME) {
        this.exhaustTimer = 0;
      }
    }

    // Contrail: fill by ALTITUDE gained, not by frame count. At full time
    // scale (45x) a single real frame can move the rocket through many
    // spacings at once; filling in a bounded loop keeps the trail continuous
    // through the ramp instead of emitting one mark per frame and leaving
    // gaps once the clock outruns the frame rate.
    let fillGuard = 0;
    while (y - this.lastTrailY >= CONTRAIL_SPACING && fillGuard < CONTRAIL_MAX_PER_FRAME) {
      this.lastTrailY += CONTRAIL_SPACING;
      fillGuard++;
      const a = Math.random() * Math.PI * 2;
      this.trail.place(Math.cos(a) * 0.18, this.lastTrailY, Math.sin(a) * 0.18, 0.28 + Math.random() * 0.16);
    }
    if (fillGuard >= CONTRAIL_MAX_PER_FRAME) {
      // The climb outran the fill budget this frame - resync to the current
      // altitude rather than let the backlog grow across future frames too.
      this.lastTrailY = y;
    }

    this.exhaust.update(dt);
    this.smoke.update(dt);
  }

  /** Put the pad back to idle: kill every particle, zero draw cost. */
  reset() {
    this.active = false;
    this.exhaustTimer = 0;
    this.lastTrailY = 0;
    this.exhaust.clear();
    this.smoke.clear();
    this.trail.clear();
  }

  dispose() {
    this.exhaust.dispose();
    this.smoke.dispose();
    this.trail.dispose();
    this.root.removeFromParent();
  }
}
