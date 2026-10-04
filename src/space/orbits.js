// Chapter 4 physics - analytic orbital rails.
//
// Every body in contracts.BODIES moves on a perfect circle around its parent
// (the Sun does not move). Because the rails are analytic, "where is body X at
// time t" is a closed-form formula, not an integration - so the predictor can
// be exact and the whole solar system is deterministic from t alone.
//
// CONVENTION (used everywhere in src/space/physics + predictor, and relied on
// by the renderer via contracts.toScene): a body's angle theta(t) = phase +
// omega*t increases counter-clockwise as seen from +Y looking down at the
// X/Z plane (the +Y axis is the angular-velocity vector of every orbit and of
// the ship's own heading). Concretely:
//   x(theta) = r * cos(theta)
//   z(theta) = r * sin(theta)
// so theta = 0 sits on +X, and increasing theta sweeps +X -> +Z -> -X -> -Z.
// Ship heading uses the identical mapping (see physics.js): angle 0 = +X,
// heading vector = (cos(angle), sin(angle)).
//
// No three.js import here (or anywhere in orbits/physics/predictor) - these
// modules must run standalone under plain `node` for scripts/test-space-physics.mjs.

import { BODIES, BODY_ORDER } from './contracts.js';

/** Angular velocity (rad/s) of each body around its parent, precomputed once. */
const OMEGA = {};
for (const id of BODY_ORDER) {
  const b = BODIES[id];
  OMEGA[id] = b.parent && b.period !== Infinity ? (2 * Math.PI) / b.period : 0;
}

function freshState() {
  return { x: 0, z: 0, vx: 0, vz: 0 };
}

/**
 * Position/velocity of `id` relative to its own parent (0,0,0,0 for the Sun
 * or for any body evaluated as if it had no parent). Heliocentric-relative,
 * i.e. this is the vector from the parent's centre to the body's centre.
 */
export function bodyStateRel(id, t, out = freshState()) {
  const b = BODIES[id];
  if (!b || !b.parent) {
    out.x = 0; out.z = 0; out.vx = 0; out.vz = 0;
    return out;
  }
  const omega = OMEGA[id];
  const theta = b.phase + omega * t;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  out.x = b.orbit * c;
  out.z = b.orbit * s;
  out.vx = -b.orbit * omega * s;
  out.vz = b.orbit * omega * c;
  return out;
}

/**
 * Heliocentric position/velocity of `id` at time t. The Sun is fixed at the
 * origin. Recurses through parents (max depth 2 in this system: moon -> planet
 * -> sun), allocating small scratch objects - fine for occasional calls, but
 * NOT used internally by allStates()/dominantBody() which have their own
 * allocation-free hot path below.
 */
export function bodyState(id, t, out = freshState()) {
  const b = BODIES[id];
  if (!b || !b.parent) {
    out.x = 0; out.z = 0; out.vx = 0; out.vz = 0;
    return out;
  }
  const rel = bodyStateRel(id, t);
  const parent = bodyState(b.parent, t);
  out.x = parent.x + rel.x;
  out.z = parent.z + rel.z;
  out.vx = parent.vx + rel.vx;
  out.vz = parent.vz + rel.vz;
  return out;
}

/**
 * Heliocentric state of every body at time t, as { id: {x,z,vx,vz}, ... }.
 * Allocation-free when `out` is reused across calls (its per-id sub-objects
 * are created once then mutated in place). Relies on BODY_ORDER listing every
 * parent before its children (guaranteed by contracts.js) so each child can
 * read its already-computed parent state directly instead of recursing.
 */
export function allStates(t, out = {}) {
  for (const id of BODY_ORDER) {
    const b = BODIES[id];
    if (!out[id]) out[id] = { x: 0, z: 0, vx: 0, vz: 0 };
    const s = out[id];
    if (!b.parent) {
      s.x = 0; s.z = 0; s.vx = 0; s.vz = 0;
      continue;
    }
    const omega = OMEGA[id];
    const theta = b.phase + omega * t;
    const c = Math.cos(theta);
    const si = Math.sin(theta);
    const rx = b.orbit * c;
    const rz = b.orbit * si;
    const rvx = -b.orbit * omega * si;
    const rvz = b.orbit * omega * c;
    const p = out[b.parent]; // already up to date - parents precede children
    s.x = p.x + rx;
    s.z = p.z + rz;
    s.vx = p.vx + rvx;
    s.vz = p.vz + rvz;
  }
  return out;
}

const _domScratch = {};

/**
 * The id of the deepest body whose sphere of influence contains (x, z) at
 * time t, or 'sun' if the point is outside every body's SOI. Moons are
 * naturally preferred over their parent planet because we pick the SMALLEST
 * containing SOI, not the first match in iteration order - correct regardless
 * of BODY_ORDER, and correct even if a point is (impossibly) inside two
 * unrelated bodies' SOIs at once.
 *
 * `states`, if given, must be a fresh allStates(t, ...) result - passing it
 * lets a hot caller (physics.js, predictor.js) avoid recomputing all body
 * positions on every dominantBody() call.
 */
export function dominantBody(x, z, t, states) {
  const all = states || allStates(t, _domScratch);
  let best = null;
  let bestSoi = Infinity;
  for (const id of BODY_ORDER) {
    const b = BODIES[id];
    if (!b.parent) continue; // the Sun's "SOI" is everything else's fallback
    const s = all[id];
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz <= b.soi * b.soi && b.soi < bestSoi) {
      best = id;
      bestSoi = b.soi;
    }
  }
  return best || 'sun';
}
