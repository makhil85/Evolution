// The five wandering villagers (copied from src/city/worldPeople.js, which
// reads Chapter 2's NPC list): wander within 3 tiles of home, step away from
// the child, never walk into anything blocked().
import * as THREE from 'three';
import { Mesher, makeLabel, makeRng } from '../city/worldKit.js';
import { tileToWorld } from './contracts.js';
import { NPCS } from './layout.js';

// ---------------------------------------------------------------------------
// Townsfolk
// ---------------------------------------------------------------------------

function personBody(npc) {
  const m = new Mesher({ outlineT: 0.03 });
  m.cyl(0.17, 0.21, 0.55, 0, 0.6, 0, npc.shirt, { seg: 10 });
  for (const x of [-0.25, 0.25]) m.cyl(0.055, 0.05, 0.5, x, 0.63, 0, npc.shirt, { seg: 6, rz: x < 0 ? 0.08 : -0.08, outline: false });
  for (const x of [-0.27, 0.27]) m.sph(0.06, x, 0.6, 0, npc.skin, { seg: 6, segV: 5, outline: false });
  m.sph(0.19, 0, 1.32, 0, npc.skin, { seg: 12, segV: 9 });
  m.sph(0.205, 0, 1.36, -0.015, npc.hair, { seg: 12, segV: 8, thetaLen: Math.PI * 0.55, ry: 0, rx: -0.2 });
  m.sph(0.03, -0.075, 1.31, 0.17, 0x18202c, { seg: 6, segV: 5, outline: false });
  m.sph(0.03, 0.075, 1.31, 0.17, 0x18202c, { seg: 6, segV: 5, outline: false });
  return m.build({ receiveShadow: false });
}

function leg() {
  const m = new Mesher({ outlineT: 0.025 });
  m.cyl(0.075, 0.065, 0.56, 0, -0.6, 0, 0x364fc7, { seg: 7, outline: false });
  m.box(0.14, 0.07, 0.24, 0, -0.63, 0.04, 0x2b2d42, { outline: false });
  return m.build({ receiveShadow: false });
}

const WALK_SPEED = 0.95;

export function buildNpcs(root, { walkable }) {
  const group = new THREE.Group();
  group.name = 'townsfolk';
  root.add(group);
  const rng = makeRng(4242);
  const legProto = leg();

  const list = NPCS.map((npc, i) => {
    const home = tileToWorld(npc.tx, npc.ty);
    const g = new THREE.Group();
    g.name = `npc:${npc.name}`;
    g.position.set(home.x, 0, home.z);
    g.add(personBody(npc));
    const legL = legProto.clone(true), legR = legProto.clone(true);
    legL.position.set(-0.1, 0.62, 0);
    legR.position.set(0.1, 0.62, 0);
    g.add(legL, legR);
    g.scale.setScalar(1.02);
    group.add(g);

    const label = makeLabel(npc.name, { height: 0.38, fontPx: 40, accent: '#a5d8ff' });
    label.position.set(home.x, 1.85, home.z);
    root.add(label);

    return {
      npc, g, legL, legR, label,
      home, x: home.x, z: home.z, heading: rng() * 6.28,
      target: null, wait: 0.5 + rng() * 2.5, phase: rng() * 6.28, speed: 0,
    };
  });

  const RANGE = 3 * 2.5;   // wander within 3 tiles of home

  function pickTarget(n) {
    for (let k = 0; k < 14; k++) {
      const a = rng() * Math.PI * 2;
      const r = 1.2 + rng() * (RANGE - 1.2);
      const x = n.home.x + Math.cos(a) * r, z = n.home.z + Math.sin(a) * r;
      if (Math.hypot(x - n.home.x, z - n.home.z) > RANGE) continue;
      if (!pathClear(n.x, n.z, x, z)) continue;
      return { x, z };
    }
    return null;
  }

  function spotOk(x, z) {
    const R = 0.42;
    return walkable(x, z) && walkable(x + R, z) && walkable(x - R, z) && walkable(x, z + R) && walkable(x, z - R);
  }

  function pathClear(ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!spotOk(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  function update(dt, time, player) {
    for (const n of list) {
      let vx = 0, vz = 0, moving = false;
      const dp = player ? Math.hypot(n.x - player.x, n.z - player.z) : Infinity;

      if (dp < 2.6 && player) {
        // Step away from the child, gently, and forget the old plan.
        const ax = (n.x - player.x) / (dp || 1), az = (n.z - player.z) / (dp || 1);
        vx = ax * 1.5; vz = az * 1.5;
        n.target = null; n.wait = 0.8;
        moving = true;
      } else if (n.target) {
        const dx = n.target.x - n.x, dz = n.target.z - n.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) { n.target = null; n.wait = 1.5 + rng() * 3.5; }
        else { vx = (dx / d) * WALK_SPEED; vz = (dz / d) * WALK_SPEED; moving = true; }
      } else {
        n.wait -= dt;
        if (n.wait <= 0) n.target = pickTarget(n);
        if (!n.target && n.wait <= 0) n.wait = 1.0;
      }

      if (moving) {
        const nx = n.x + vx * dt, nz = n.z + vz * dt;
        if (spotOk(nx, nz) && Math.hypot(nx - n.home.x, nz - n.home.z) < RANGE + 1.2) {
          n.x = nx; n.z = nz;
        } else {
          n.target = null; n.wait = 0.6;
          moving = false;
        }
      }

      if (moving) {
        const want = Math.atan2(vx, vz);
        let d = want - n.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        n.heading += d * Math.min(1, dt * 8);
        n.phase += dt * 7;
      }
      n.speed += ((moving ? 1 : 0) - n.speed) * Math.min(1, dt * 8);
      const swing = Math.sin(n.phase) * 0.6 * n.speed;
      n.legL.rotation.x = swing;
      n.legR.rotation.x = -swing;
      n.g.position.set(n.x, Math.abs(Math.sin(n.phase)) * 0.04 * n.speed, n.z);
      n.g.rotation.y = n.heading;
      n.label.position.set(n.x, 1.85, n.z);
    }
  }

  return { group, list, update };
}
