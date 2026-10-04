// Zara's skeleton.
//
// RIGID SKINNING, deliberately. Every vertex is bound to exactly one bone with
// weight 1 - no blending, no deformation. For a figure made of boxes and
// cylinders that is not a compromise, it is the right answer: a low-poly limb
// has nothing to deform, and rigid binding keeps the whole girl ONE SkinnedMesh
// (one draw call) while still bending at every joint. The alternative - a Group
// of eleven separate part meshes - articulates just as well and costs eleven
// draw calls plus eleven more for the outlines, which is what she used to be.
//
// The rest pose is the pose girl.js models her in: standing, arms down. Vertices
// are authored in that world space and the bind matrices convert them to bone
// space, so the modelling code never has to think about bone-local coordinates.
//
// Bone Y positions are chosen to sit ON the joints of the modelled figure -
// hip crease, knee, ankle, shoulder, elbow, wrist - because a bone whose origin
// misses the joint makes the limb swing from the wrong pivot and the mesh tears
// away from itself at the seam.
import * as THREE from 'three';

/**
 * Parent-relative offsets, in the units girl.js models in (she is ~1.5 tall).
 * Order is the joint order in the exported .glb; do not reorder casually.
 */
export const BONES = [
  { name: 'root', parent: null, offset: [0, 0, 0] },
  { name: 'hips', parent: 'root', offset: [0, 0.62, 0] },
  { name: 'spine', parent: 'hips', offset: [0, 0.16, 0] },
  { name: 'chest', parent: 'spine', offset: [0, 0.20, 0] },
  { name: 'neck', parent: 'chest', offset: [0, 0.17, 0] },
  { name: 'head', parent: 'neck', offset: [0, 0.15, 0] },

  // Arms hang down, so every arm bone points along -Y. She faces +Z, so a
  // NEGATIVE X rotation swings a hanging limb FORWARD (checked on renders,
  // 2026-09-29); bones pointing up (spine, head) bend forward with POSITIVE X.
  { name: 'armL', parent: 'chest', offset: [0.175, 0.12, 0] },
  { name: 'forearmL', parent: 'armL', offset: [0, -0.21, 0] },
  { name: 'handL', parent: 'forearmL', offset: [0, -0.19, 0] },
  { name: 'armR', parent: 'chest', offset: [-0.175, 0.12, 0] },
  { name: 'forearmR', parent: 'armR', offset: [0, -0.21, 0] },
  { name: 'handR', parent: 'forearmR', offset: [0, -0.19, 0] },

  { name: 'thighL', parent: 'hips', offset: [0.085, -0.02, 0] },
  { name: 'shinL', parent: 'thighL', offset: [0, -0.30, 0] },
  { name: 'footL', parent: 'shinL', offset: [0, -0.255, 0] },
  { name: 'thighR', parent: 'hips', offset: [-0.085, -0.02, 0] },
  { name: 'shinR', parent: 'thighR', offset: [0, -0.30, 0] },
  { name: 'footR', parent: 'shinR', offset: [0, -0.255, 0] },
];

/** name -> position in BONES, which is also the glTF joint index. */
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b.name, i]));

/** Rest-pose world position of every bone, accumulated down the chain. */
export const BONE_REST = (() => {
  const out = {};
  for (const b of BONES) {
    const p = b.parent ? out[b.parent] : [0, 0, 0];
    out[b.name] = [p[0] + b.offset[0], p[1] + b.offset[1], p[2] + b.offset[2]];
  }
  return out;
})();

/** The joint a part belongs to, resolved to an index, with a loud failure. */
export function boneIndex(name) {
  const i = BONE_INDEX[name];
  if (i === undefined) throw new Error(`rig: no bone named "${name}"`);
  return i;
}

/**
 * Build the THREE.Bone hierarchy.
 *
 * @param {number} scale  the same factor the geometry was scaled by. Bones and
 *   vertices must agree, and it is far simpler to bake the scale into both than
 *   to scale a group after binding - doing that applies the scale twice, once
 *   through the bone matrices and again through the model matrix.
 * @returns {{root: THREE.Bone, bones: THREE.Bone[], byName: Record<string, THREE.Bone>}}
 */
export function createBones(scale = 1) {
  const bones = [];
  const byName = {};
  for (const def of BONES) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(def.offset[0] * scale, def.offset[1] * scale, def.offset[2] * scale);
    byName[def.name] = bone;
    bones.push(bone);
    if (def.parent) byName[def.parent].add(bone);
  }
  return { root: bones[0], bones, byName };
}
