// The ship's gravity: ONE model, shared by the flight (physics.js stepShip)
// and the dotted path (predictor.js), in every chapter.
//
// WHY NOT PLAIN PATCHED CONICS. The old model let exactly one body pull at a
// time (the one whose zone she was in). The Moon's zone is only 74 u across
// in a 380 u orbit, so on the whole trip out from Earth the Moon pulled with
// nothing at all, then suddenly took over at its zone edge - "the Moon never
// catches the ship, it acts like only Earth pulls" (lead, 2026-10-05). Real
// spacecraft feel the Earth AND the moving Moon the whole way.
//
// THE MODEL NOW. Inside a planet's system (its gravity zone), the planet and
// ALL of its moons pull on her together, every step, with every moon moving
// on its rail. Out in the Sun's pull it is the Sun alone, as before (the
// planets are far away there, and in-system the Sun's pull on her and on the
// planet are nearly the same, so it cancels - see physics.js's header).
//
// FRAMES. She is still integrated relative to her "home" body (the smallest
// zone she is in), for precision - but the home body only picks the frame,
// not the forces, so crossing into the Moon's zone no longer changes the pull
// she feels. Relative to a planet P (on its rail, not tugged by its moons):
//   a = pull of P + pull of each moon
// Relative to a moon M of P, take away M's own acceleration round P:
//   a = pull of M + pull of other moons + (pull of P - GM_P (P - M) / |P - M|^3)
// Any of those extra effects under 10% of the home body's pull is left out
// (lead's rule; see accelRel).
//
// Every position here is relative to the system's planet, from the analytic
// rails (orbits.bodyStateRel), so nothing is ever integrated but the ship.
//
// No three.js import - runs under plain node.

import { BODIES, BODY_ORDER } from './contracts.js';
import { bodyStateRel } from './orbits.js';

/** Moons of each planet (ids), e.g. earth -> ['moon']. */
const MOONS = {};
for (const id of BODY_ORDER) {
  const p = BODIES[id].parent;
  if (p && p !== 'sun') (MOONS[p] || (MOONS[p] = [])).push(id);
}

/** The planet whose system `id` belongs to (itself for a planet), or null. */
function systemPlanet(id) {
  if (!id || id === 'sun') return null;
  const p = BODIES[id].parent;
  return p === 'sun' ? id : p;
}

/**
 * For each frame body: the bodies whose pull she feels there, as
 * [{ id, gm, moon }] (moon: rail offset from the planet, else null = the
 * planet itself), or null when only the frame body pulls (then the path is
 * an exact Kepler orbit - the Sun, a planet with no moons, Pluto).
 */
const SOURCES = {};
for (const id of BODY_ORDER) {
  const P = systemPlanet(id);
  if (!P || !MOONS[P]) { SOURCES[id] = null; continue; }
  SOURCES[id] = [P, ...MOONS[P]].map((b) => ({ id: b, gm: BODIES[b].gm, isMoon: b !== P }));
}

/** True when her path in this frame is a pure two-body (Kepler) orbit. */
export function isKeplerFrame(frameId) {
  return !moonPulls || !SOURCES[frameId];
}

// Chapter 6 (lead, 2026-10-05): "for chapter 6 consider only the Sun and a
// nearby planet" - its slingshots are the clean two-body lesson, so moons
// don't pull there: setMoonPulls(false) makes every frame one body's pull
// (the Sun's between planets, the planet's in its zone), path and flight alike.
let moonPulls = true;
/** Moons pulling inside a planet's zone (default on; Chapter 6 turns it off). */
export function setMoonPulls(on) { moonPulls = !!on; }

const _r = { x: 0, z: 0, vx: 0, vz: 0 };

/** Where each source sits (offset from its planet) at the time last asked. */
function moonOffsets(src, t) {
  if (src.t === t) return src;
  for (let i = 0; i < src.length; i++) {
    const b = src[i];
    if (b.isMoon) { bodyStateRel(b.id, t, _r); src.xs[i] = _r.x; src.zs[i] = _r.z; }
  }
  src.t = t;
  return src;
}
for (const id of BODY_ORDER) {
  const src = SOURCES[id];
  if (!src || src.xs) continue;
  src.xs = new Float64Array(src.length); src.zs = new Float64Array(src.length); src.t = NaN;
}
const FRAME_INDEX = {};
const PLANET_GM = {};
for (const id of BODY_ORDER) {
  const src = SOURCES[id];
  if (!src) continue;
  FRAME_INDEX[id] = BODIES[id].parent === 'sun' ? -1 : src.findIndex((b) => b.id === id);
  PLANET_GM[id] = src[0].gm;
}

/**
 * Acceleration of the ship relative to frame body `frameId`, at offset
 * (rx, rz) from it, at time t. Writes out.ax / out.az, and out.tau: the
 * fastest local orbit time round any body pulling on her, sqrt(d^3 / GM)
 * (the predictor sizes its steps from it). Returns out.
 */
export function accelRel(frameId, rx, rz, t, out) {
  const src = moonPulls ? SOURCES[frameId] : null;
  if (!src) {
    const gm = BODIES[frameId].gm;
    const r2 = rx * rx + rz * rz;
    const r = Math.sqrt(r2) || 1e-9;
    const g = -gm / (r2 * r);
    out.ax = g * rx; out.az = g * rz; out.tau = Math.sqrt((r2 * r) / gm);
    return out;
  }
  moonOffsets(src, t);
  const xs = src.xs; const zs = src.zs;
  // Frame body's offset from the planet (0 when the frame IS the planet).
  const fi = FRAME_INDEX[frameId];
  const fx = fi >= 0 ? xs[fi] : 0; const fz = fi >= 0 ? zs[fi] : 0;
  // Ship relative to the planet.
  const sx = rx + fx; const sz = rz + fz;
  // The frame body's own pull first: the yardstick for the rest.
  let ax = 0; let az = 0; let tau = Infinity;
  {
    const i = fi >= 0 ? fi : 0;
    const gm = src[i].gm;
    const dx = sx - xs[i]; const dz = sz - zs[i];
    const d2 = dx * dx + dz * dz;
    const d3 = d2 * (Math.sqrt(d2) || 1e-9);
    ax = (-gm / d3) * dx; az = (-gm / d3) * dz;
    tau = d3 / gm;
  }
  const main2 = ax * ax + az * az || 1e-24;
  for (let i = 0; i < src.length; i++) {
    if (i === (fi >= 0 ? fi : 0)) continue;
    const gm = src[i].gm;
    const dx = sx - xs[i]; const dz = sz - zs[i];
    const d2 = dx * dx + dz * dz;
    const d3 = d2 * (Math.sqrt(d2) || 1e-9);
    let px = (-gm / d3) * dx; let pz = (-gm / d3) * dz;
    if (fi >= 0 && i === 0) {
      // In a moon's frame the planet's real effect is its pull on her minus
      // its pull on the moon (the moon falls round it too): the tide.
      const f2 = fx * fx + fz * fz;
      const g = gm / (f2 * Math.sqrt(f2));
      px += g * fx; pz += g * fz;
    }
    // Lead (2026-10-05): "keep the rough physics real... if the effect of
    // another object is <10%, ignore it". Below 10% of the main pull it is
    // left out; it eases in by 13% so the pull never jumps. So low Moon and
    // Europa orbits are clean ellipses (the planet's tide there is 2-9%),
    // while on the way out from Earth the Moon pulls from ~155 u away.
    const q2 = (px * px + pz * pz) / main2;
    if (q2 <= 0.01) continue;
    const k = (Math.sqrt(q2) - 0.1) / 0.03;
    const w = k >= 1 ? 1 : k * k * (3 - 2 * k);
    ax += w * px; az += w * pz;
    const tq = d3 / gm;
    if (tq < tau) tau = tq;
  }
  out.ax = ax; out.az = az; out.tau = Math.sqrt(tau);
  return out;
}

/**
 * One classic RK4 step of a coast (no thrust) in frame `frameId`, in place
 * on s = {x, z, vx, vz}. `k` holds the acceleration at the start
 * ({ax, az}, from accelRel) and is left holding the one at the end (and its
 * tau), ready for the next step - so a step costs three new pulls, not four.
 */
export function rk4Step(frameId, s, t, h, k) {
  const x0 = s.x; const z0 = s.z; const vx0 = s.vx; const vz0 = s.vz;
  const k1vx = k.ax; const k1vz = k.az;
  const h2 = h / 2;
  accelRel(frameId, x0 + vx0 * h2, z0 + vz0 * h2, t + h2, k);
  const k2vx = k.ax; const k2vz = k.az;
  const v2x = vx0 + k1vx * h2; const v2z = vz0 + k1vz * h2;
  accelRel(frameId, x0 + v2x * h2, z0 + v2z * h2, t + h2, k);
  const k3vx = k.ax; const k3vz = k.az;
  const v3x = vx0 + k2vx * h2; const v3z = vz0 + k2vz * h2;
  const v4x = vx0 + k3vx * h; const v4z = vz0 + k3vz * h;
  accelRel(frameId, x0 + v3x * h, z0 + v3z * h, t + h, k);
  const k4vx = k.ax; const k4vz = k.az;
  s.x = x0 + (h / 6) * (vx0 + 2 * v2x + 2 * v3x + v4x);
  s.z = z0 + (h / 6) * (vz0 + 2 * v2z + 2 * v3z + v4z);
  s.vx = vx0 + (h / 6) * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
  s.vz = vz0 + (h / 6) * (k1vz + 2 * k2vz + 2 * k3vz + k4vz);
  accelRel(frameId, s.x, s.z, t + h, k);
  return s;
}

/**
 * A good RK4 step (s) from accelRel's tau: a small fraction of the fastest
 * local orbit time, so a close pass of the Moon gets fine steps and the long
 * way out gets big ones.
 */
export function coastStep(tau) {
  return Math.min(4, Math.max(1 / 480, 0.05 * tau));
}
