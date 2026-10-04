// Chapter 1 resource pickups except the trees (those are real tree models,
// see worldScenery.js): stone piles, surface iron rocks with a blue glint,
// rich locked iron with a gold glint, and purple science notes. Instanced per
// kind, so all 65 are a handful of draw calls.
import * as THREE from 'three';
import { Mesher } from '../city/worldKit.js';
import { tileToWorld } from './contracts.js';
import { PICKUPS } from './layout.js';

/** A low-poly boulder: an icosahedron, squashed, sitting on y. */
function boulder(m, r, x, y, z, color, { sy = 0.75, ry = 0, sx = 1, o = {} } = {}) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(sx, sy, 1);
  g.rotateY(ry);
  return m._push(g, color, x, y + r * sy * 0.85, z, o);
}
function fleck(m, r, x, y, z, color) {
  return m._push(new THREE.IcosahedronGeometry(r, 0), color, x, y, z, { glow: true, outline: false });
}

const KIND_MODELS = {
  stone() {
    const m = new Mesher({ outlineT: 0.04 });
    boulder(m, 0.42, 0, 0, 0, 0xadb5bd, { ry: 0.3 });
    boulder(m, 0.3, 0.42, 0, 0.3, 0x9aa3ab, { ry: 1.1 });
    boulder(m, 0.32, -0.34, 0, -0.3, 0xced4da, { ry: 2.0, sy: 0.9 });
    boulder(m, 0.22, 0.02, 0.36, 0.05, 0xdee2e6, { ry: 0.7, o: { outline: false } });
    return m;
  },
  ironRock() {
    const m = new Mesher({ outlineT: 0.04 });
    boulder(m, 0.52, 0, 0, 0, 0x8d99a6, { ry: 0.2, sy: 0.85 });
    boulder(m, 0.34, 0.3, 0, 0.36, 0xaab4bf, { ry: 1.0 });
    boulder(m, 0.26, -0.42, 0, 0.2, 0x7b8794, { ry: 2.0 });
    fleck(m, 0.06, 0.15, 0.62, 0.3, 0xe7f5ff);
    fleck(m, 0.05, -0.2, 0.6, 0.25, 0xd0ebff);
    fleck(m, 0.045, 0.42, 0.42, 0.5, 0xe7f5ff);
    return m;
  },
  ironRich() {
    const m = new Mesher({ outlineT: 0.04 });
    boulder(m, 0.54, 0, 0, 0, 0x565f6b, { ry: 0.4, sy: 0.9 });
    boulder(m, 0.34, 0.32, 0, 0.36, 0x6c7784, { ry: 1.2 });
    boulder(m, 0.27, -0.44, 0, 0.22, 0x495057, { ry: 2.2 });
    fleck(m, 0.09, 0.18, 0.66, 0.32, 0xffd43b);
    fleck(m, 0.07, -0.2, 0.62, 0.28, 0xffc61a);
    fleck(m, 0.075, 0.46, 0.45, 0.52, 0xffd43b);
    fleck(m, 0.06, -0.5, 0.42, 0.42, 0xffe066);
    fleck(m, 0.06, 0.05, 0.3, 0.55, 0xffc61a);
    return m;
  },
  note() {
    const m = new Mesher({ outlineT: 0.035 });
    m.cone(0.3, 0.42, 0, 0.0, 0, 0xc084fc, { seg: 5 });
    m.cone(0.3, 0.42, 0, 0.0, 0, 0xa855f7, { seg: 5, rx: Math.PI, outline: false });
    return m;
  },
};

const KIND_OF = (pk) => (pk.type === 'stone' ? 'stone' : pk.type === 'iron' ? (pk.locked ? 'ironRich' : 'ironRock') : 'note');
const LIFT = { stone: 0, ironRock: 0, ironRich: 0, note: 0.6 };
const SCALE = { stone: 1.25, ironRock: 1.3, ironRich: 1.35, note: 1.35 };
const GLINT_Y = { ironRock: 1.15, ironRich: 1.25 };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function buildScienceItems(root) {
  const group = new THREE.Group();
  group.name = 'pickups';
  root.add(group);

  const byKind = new Map();
  for (const pk of PICKUPS) {
    if (pk.type === 'tree') continue;
    const kind = KIND_OF(pk);
    if (!byKind.has(kind)) byKind.set(kind, []);
    const w = tileToWorld(pk.tx, pk.ty);
    byKind.get(kind).push({ ...pk, kind, x: w.x, z: w.z, phase: (pk.id * 1.7) % 6.28, collected: false });
  }

  const all = new Map();
  const sets = [];
  for (const [kind, list] of byKind) {
    const model = KIND_MODELS[kind]().build({ castShadow: false, receiveShadow: false });
    const meshes = [];
    for (const child of model.children) {
      const im = new THREE.InstancedMesh(child.geometry, child.material, list.length);
      im.frustumCulled = false;
      if (child.userData.isOutline) im.userData.isOutline = true;
      group.add(im);
      meshes.push(im);
    }
    list.forEach((pk, i) => { pk.index = i; all.set(pk.id, pk); });
    sets.push({ kind, list, meshes });
  }

  // Glints: one instanced sparkle over every iron rock.
  const glintList = [...all.values()].filter((p) => p.kind === 'ironRock' || p.kind === 'ironRich');
  const glintGeo = new THREE.OctahedronGeometry(0.15, 0);
  glintGeo.scale(1, 1.7, 1);
  const glints = new THREE.InstancedMesh(glintGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), glintList.length);
  glints.frustumCulled = false;
  glints.renderOrder = 3;
  glintList.forEach((pk, i) => {
    pk.glint = i;
    glints.setColorAt(i, _c.set(pk.kind === 'ironRich' ? 0xffd43b : 0x74c0fc));
  });
  group.add(glints);

  // Science notes glow: a soft purple halo behind each.
  const noteList = byKind.get('note') || [];
  const halo = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    Math.max(1, noteList.length),
  );
  halo.frustumCulled = false;
  halo.renderOrder = 3;
  group.add(halo);

  // Soft blob shadow under every pickup.
  const blobGeo = new THREE.CircleGeometry(0.55, 14);
  blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x1b2330, transparent: true, opacity: 0.28, depthWrite: false }), Math.max(1, all.size));
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  group.add(blobs);
  let bi = 0;
  for (const pk of all.values()) {
    pk.blob = bi;
    _p.set(pk.x, 0.03, pk.z);
    _s.setScalar(SCALE[pk.kind] * (pk.kind === 'note' ? 0.7 : 1.15));
    blobs.setMatrixAt(bi++, _m.compose(_p, _q.identity(), _s));
  }
  blobs.instanceMatrix.needsUpdate = true;

  // Static kinds: written once.
  for (const set of sets) {
    if (set.kind === 'note') continue;
    for (const pk of set.list) {
      _p.set(pk.x, 0, pk.z);
      _q.setFromAxisAngle(_up, pk.phase * 3.1);
      _s.setScalar(SCALE[pk.kind]);
      _m.compose(_p, _q, _s);
      for (const im of set.meshes) im.setMatrixAt(pk.index, _m);
    }
    for (const im of set.meshes) im.instanceMatrix.needsUpdate = true;
  }

  function refresh(t) {
    const note = sets.find((s) => s.kind === 'note');
    if (note) {
      for (const pk of note.list) {
        if (pk.collected) continue;
        _p.set(pk.x, LIFT.note + Math.sin(t * 2 + pk.phase) * 0.08, pk.z);
        _q.setFromAxisAngle(_up, pk.phase + t * 0.9);
        _s.setScalar(SCALE.note);
        _m.compose(_p, _q, _s);
        for (const im of note.meshes) im.setMatrixAt(pk.index, _m);
      }
      for (const im of note.meshes) im.instanceMatrix.needsUpdate = true;
    }
    let hi = 0;
    for (const pk of noteList) {
      if (pk.collected) { halo.setMatrixAt(hi++, ZERO); continue; }
      const pulse = 1 + Math.sin(t * 3 + pk.phase) * 0.14;
      _p.set(pk.x, LIFT.note + 0.2 + Math.sin(t * 2 + pk.phase) * 0.08, pk.z);
      _s.setScalar(pulse);
      halo.setMatrixAt(hi++, _m.compose(_p, _q.identity(), _s));
    }
    halo.instanceMatrix.needsUpdate = true;
    for (const pk of glintList) {
      if (pk.collected) { glints.setMatrixAt(pk.glint, ZERO); continue; }
      const k = 0.75 + 0.45 * Math.sin(t * 3.2 + pk.phase);
      _p.set(pk.x, GLINT_Y[pk.kind] + Math.sin(t * 2 + pk.phase) * 0.06, pk.z);
      _q.setFromAxisAngle(_up, t * 1.4 + pk.phase);
      _s.setScalar(k);
      glints.setMatrixAt(pk.glint, _m.compose(_p, _q, _s));
    }
    glints.instanceMatrix.needsUpdate = true;
  }
  refresh(0);

  return {
    group,
    get: (id) => all.get(id),
    setCollected(id) {
      const pk = all.get(id);
      if (!pk || pk.collected) return false;
      pk.collected = true;
      const set = sets.find((s) => s.kind === pk.kind);
      for (const im of set.meshes) { im.setMatrixAt(pk.index, ZERO); im.instanceMatrix.needsUpdate = true; }
      blobs.setMatrixAt(pk.blob, ZERO);
      blobs.instanceMatrix.needsUpdate = true;
      return true;
    },
    update: refresh,
    position(id) { const pk = all.get(id); return pk && !pk.collected ? { x: pk.x, z: pk.z } : null; },
  };
}
