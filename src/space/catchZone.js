// The catch zone (lead 2026-10-07): on Easy and Medium a transfer ends in a
// blinking circle round the target planet or moon. Fly into it and the ship
// is put on a steady circular orbit, then glides down to a low one - no
// braking burn to get right, no fly-by to miss. Hard keeps the real thing
// (capture burn, flybys and misses).
//
//   const zone = createCatchZone(game, scene);
//   zone.update(states, origin, dt, paused)   once per frame, after physics
//
// It acts on the step's own target: game.captureTarget, else
// game.transferTarget (missions.js sets both on entering a step), when that
// is a real body (not the Sun, the belt or Act 1's satellite).
import * as THREE from 'three';
import { BODIES } from './contracts.js';
import { bodyState } from './orbits.js';
import { t } from './level.js';

// Jupiter: settle between Ganymede and Callisto, well clear of the radiation
// belt (RADIATION, 160-520 u) and of the moons' own pull. Saturn: outside its
// rings (2.33 R).
const CATCH = { jupiter: 1500 };
const LOW = { jupiter: 1400, saturn: 3 };

/** How far out the zone reaches: about 100 u at Mars, inside the body's pull. */
export function catchRadius(id) {
  const b = BODIES[id];
  return CATCH[id] ?? Math.max(b.radius * 3.5, Math.min(b.soi * 0.5, b.radius * 8));
}
/** The low orbit she settles on (u). */
export function lowOrbit(id) {
  const b = BODIES[id];
  const v = LOW[id];
  return v === undefined ? b.radius * 2.2 : v < 10 ? b.radius * v : v;
}

const SEGMENTS = 128;
const _s = { x: 0, z: 0, vx: 0, vz: 0 };

export function createCatchZone(game, scene) {
  const pts = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  ring.frustumCulled = false;
  ring.renderOrder = 4;
  ring.visible = false;
  scene.add(ring);

  let time = 0;
  let caught = null; // { id, sense } while she glides down to the low orbit

  const on = () => game.mode && game.mode.id !== 'hard';
  function targetId() {
    const id = game.captureTarget || game.transferTarget;
    return id && id !== 'sun' && BODIES[id] && BODIES[id].soi < Infinity ? id : null;
  }

  /** Put her on a circle of radius r round `id`, at her present angle, going her way round. */
  function circle(id, r, sense) {
    const sh = game.ship;
    bodyState(id, sh.t, _s);
    let rx = sh.x - _s.x; let rz = sh.z - _s.z;
    const d = Math.hypot(rx, rz) || 1;
    rx /= d; rz /= d;
    const v = Math.sqrt(BODIES[id].gm / r);
    sh.x = _s.x + rx * r; sh.z = _s.z + rz * r;
    // Tangent: (-rz, rx) is anticlockwise in x/z.
    sh.vx = _s.vx - rz * v * sense; sh.vz = _s.vz + rx * v * sense;
    sh.soi = id;
  }

  function update(states, origin, dt, paused) {
    time += dt;
    const id = on() ? targetId() : null;
    const sh = game.ship;
    if (!id || sh.landedOn || game.escapeStep || game.cinematic) {
      ring.visible = false;
      if (!id) caught = null;
      return;
    }
    const s = states[id];
    const R = catchRadius(id);
    ring.visible = !caught;
    if (ring.visible && s) {
      ring.position.set(s.x - origin.x, 0, s.z - origin.z);
      ring.scale.setScalar(R);
      ring.material.opacity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(time * 4));
    }
    if (paused || !s) return;
    const rx = sh.x - s.x; const rz = sh.z - s.z;
    const d = Math.hypot(rx, rz);
    if (!caught) {
      if (d > R) return;
      const sense = (rx * (sh.vz - s.vz) - rz * (sh.vx - s.vx)) >= 0 ? 1 : -1;
      caught = { id, sense };
      circle(id, Math.max(d, lowOrbit(id)), sense);
      game.hud?.toast(t(`Caught! ${BODIES[id].name}’s gravity holds you in a steady orbit.`, `${BODIES[id].name} caught you! You are going round it.`), { kind: 'good', ms: 4200 });
      return;
    }
    if (caught.id !== id) { caught = null; return; }
    // Glide down to the low orbit, staying on a circle all the way.
    const goal = lowOrbit(id);
    if (Math.abs(d - goal) > 0.3) circle(id, d + (goal - d) * Math.min(1, dt * 0.6), caught.sense);
  }

  return {
    update,
    /** Test hook: is she held in the zone now? */
    get caught() { return caught?.id || null; },
    dispose() { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); },
  };
}
