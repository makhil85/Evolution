// The 86 resource pickups (instanced, one InstancedMesh set per kind) and the
// four wandering townsfolk.
import * as THREE from 'three';
import { Mesher, makeLabel, makeRng } from './worldKit.js';
import { tileToWorld, worldToTile } from './contracts.js';
import { PICKUPS, NPCS } from './layout.js';
import { toonRamp } from '../game/toonPipeline.js';

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

/** Build each kind's model with the mesher (about 0.9 units across). */
const KIND_MODELS = {
  woodCrate() {
    const m = new Mesher({ outlineT: 0.04 });
    m.box(0.84, 0.62, 0.84, 0, 0, 0, 0xc08552);
    m.box(0.9, 0.08, 0.9, 0, 0.6, 0, 0xdba368, { outline: false });
    for (const x of [-0.28, 0.28]) m.box(0.09, 0.64, 0.9, x, 0, 0, 0x7f5539, { outline: false });
    for (const z of [-0.28, 0.28]) m.box(0.9, 0.64, 0.09, 0, 0, z, 0x7f5539, { outline: false });
    m.tubeX(0.7, 0.09, -0.05, 0.78, 0.0, 0x9c6644, { seg: 7 });
    return m;
  },
  stoneBlock() {
    const m = new Mesher({ outlineT: 0.04 });
    m.box(0.85, 0.5, 0.75, -0.05, 0, 0, 0xb4bcc4);
    m.box(0.55, 0.42, 0.5, 0.12, 0.5, 0.05, 0xa2aab2, { ry: 0.5 });
    m.box(0.32, 0.26, 0.3, -0.3, 0.5, -0.1, 0xced4da, { ry: -0.3 });
    return m;
  },
  metalScrap() {
    const m = new Mesher({ outlineT: 0.04 });
    m.box(0.78, 0.44, 0.62, 0, 0, 0, 0xced4da);
    m.box(0.8, 0.08, 0.64, 0, 0.42, 0, 0xe9ecef, { outline: false });
    m.cyl(0.26, 0.26, 0.14, 0.12, 0.44, 0.02, 0x868e96, { seg: 10 });
    m.cyl(0.1, 0.1, 0.18, 0.12, 0.44, 0.02, 0x495057, { seg: 8, outline: false });
    m.tubeX(0.55, 0.06, -0.15, 0.6, -0.15, 0x6c757d, { seg: 6, outline: false });
    m.sph(0.075, -0.22, 0.5, 0.2, 0x8ecae6, { glow: true, seg: 8, segV: 6 });
    return m;
  },
  energyCell() {
    const m = new Mesher({ outlineT: 0.04 });
    m.cyl(0.27, 0.27, 0.66, 0, 0, 0, 0xffd43b, { seg: 12 });
    m.cyl(0.29, 0.29, 0.1, 0, 0.0, 0, 0x495057, { seg: 12, outline: false });
    m.cyl(0.29, 0.29, 0.1, 0, 0.56, 0, 0x495057, { seg: 12, outline: false });
    m.cyl(0.1, 0.1, 0.12, 0, 0.66, 0, 0xdee2e6, { seg: 8, outline: false });
    m.box(0.12, 0.3, 0.05, 0, 0.26, 0.27, 0xffffff, { rz: 0.45, glow: true });
    m.box(0.12, 0.22, 0.05, 0, 0.14, 0.27, 0xffffff, { rz: -0.5, glow: true });
    return m;
  },
  blueprint() {
    const m = new Mesher({ outlineT: 0.035 });
    m.box(0.8, 0.07, 0.58, 0, 0, 0, 0x38bdf8, { rx: -0.3 });
    for (let i = 0; i < 3; i++) m.box(0.6, 0.03, 0.04, 0, 0.04, -0.16 + i * 0.14, 0xe0f2fe, { rx: -0.3, outline: false });
    m.box(0.2, 0.03, 0.2, 0.22, 0.05, 0.08, 0xffffff, { rx: -0.3, outline: false });
    return m;
  },
};

const KIND_LIFT = { woodCrate: 0.1, stoneBlock: 0.1, metalScrap: 0.1, energyCell: 0.42, blueprint: 0.62 };
const KIND_BOB = { woodCrate: 0.04, stoneBlock: 0.04, metalScrap: 0.04, energyCell: 0.09, blueprint: 0.09 };
const KIND_SCALE = { woodCrate: 1.15, stoneBlock: 1.15, metalScrap: 1.2, energyCell: 1.3, blueprint: 1.3 };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function buildPickups(root, solids = () => false) {
  const group = new THREE.Group();
  group.name = 'pickups';
  root.add(group);

  const byKind = new Map();
  for (const pk of PICKUPS) {
    if (!byKind.has(pk.type)) byKind.set(pk.type, []);
    const w = tileToWorld(pk.tx, pk.ty);
    byKind.get(pk.type).push({ ...pk, x: w.x, z: w.z, phase: (pk.id * 1.7) % 6.28, collected: false });
  }

  const sets = [];
  const all = new Map();       // id -> pickup
  for (const [kind, list] of byKind) {
    const model = KIND_MODELS[kind]().build({ castShadow: false, receiveShadow: false });
    const meshes = [];
    for (const child of model.children) {
      const im = new THREE.InstancedMesh(child.geometry, child.material, list.length);
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = false;
      if (child.userData.isOutline) im.userData.isOutline = true;
      group.add(im);
      meshes.push(im);
    }
    list.forEach((pk, i) => { pk.index = i; all.set(pk.id, pk); });
    sets.push({ kind, list, meshes });
  }

  // Energy cells glow: a soft additive halo behind each.
  const energyList = byKind.get('energyCell') || [];
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.62, 12, 8), haloMat, Math.max(1, energyList.length));
  halo.frustumCulled = false;
  halo.renderOrder = 3;
  group.add(halo);

  // Soft blob shadow under every pickup (they hover a little).
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x1b2330, transparent: true, opacity: 0.28, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(0.5, 14);
  blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, PICKUPS.length);
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  group.add(blobs);
  let bi = 0;
  for (const pk of all.values()) {
    pk.blob = bi;
    _p.set(pk.x, 0.03, pk.z);
    _s.setScalar(KIND_SCALE[pk.type] * 0.95);
    _m.compose(_p, _q.identity(), _s);
    blobs.setMatrixAt(bi++, _m);
  }
  blobs.instanceMatrix.needsUpdate = true;

  function write(pk, t) {
    const lift = KIND_LIFT[pk.type];
    const y = lift + Math.sin(t * 2.0 + pk.phase) * KIND_BOB[pk.type];
    const spin = (pk.type === 'woodCrate' || pk.type === 'stoneBlock' || pk.type === 'metalScrap')
      ? pk.phase + Math.sin(t * 0.8 + pk.phase) * 0.25
      : pk.phase + t * 0.9;
    _p.set(pk.x, y, pk.z);
    _q.setFromAxisAngle(_up, spin);
    _s.setScalar(KIND_SCALE[pk.type]);
    _m.compose(_p, _q, _s);
    return _m;
  }

  function refresh(t) {
    for (const set of sets) {
      for (const pk of set.list) {
        if (pk.collected) continue;
        write(pk, t);
        for (const im of set.meshes) im.setMatrixAt(pk.index, _m);
      }
      for (const im of set.meshes) im.instanceMatrix.needsUpdate = true;
    }
    let hi = 0;
    for (const pk of energyList) {
      if (pk.collected) { halo.setMatrixAt(hi++, ZERO); continue; }
      const pulse = 1 + Math.sin(t * 3 + pk.phase) * 0.12;
      _p.set(pk.x, KIND_LIFT.energyCell + 0.32 + Math.sin(t * 2.0 + pk.phase) * KIND_BOB.energyCell, pk.z);
      _s.setScalar(pulse);
      _m.compose(_p, _q.identity(), _s);
      halo.setMatrixAt(hi++, _m);
    }
    halo.instanceMatrix.needsUpdate = true;
  }
  refresh(0);

  return {
    group,
    get(id) { return all.get(id); },
    setCollected(id) {
      const pk = all.get(id);
      if (!pk || pk.collected) return;
      pk.collected = true;
      const set = sets.find((s) => s.kind === pk.type);
      for (const im of set.meshes) { im.setMatrixAt(pk.index, ZERO); im.instanceMatrix.needsUpdate = true; }
      blobs.setMatrixAt(pk.blob, ZERO);
      blobs.instanceMatrix.needsUpdate = true;
    },
    update(t) { refresh(t); },
    /** World position of a pickup (for the highlight ring). */
    position(id) { const pk = all.get(id); return pk && !pk.collected ? { x: pk.x, z: pk.z } : null; },
  };
}

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
