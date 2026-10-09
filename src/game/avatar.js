// The girl in the game, and the thing that makes her move.
//
// She is built from the SAME definition the character page uses
// (src/character/girl.js + rig.js + clips.js), so what you design there is what
// the game draws - shape, skeleton and animation alike. A builder that produced
// a figure the game drew differently would be worse than no builder at all.
//
// A hand-modelled replacement drops in at:
//
//     public/assets/models/characters/girl_scientist.glb
//
// When that file exists, loadAvatar() prefers it, normalises it - centred,
// grounded, scaled to AVATAR_HEIGHT - and plays whatever clips it carries.
// Clip names are matched loosely (a clip called "Armature|Walk" still counts as
// the walk), because exporters disagree about naming and a rigged model that
// silently stands still is a miserable thing to debug.
import * as THREE from 'three';
import { toonify, toonRamp } from './toonPipeline.js';
import { buildGirlRig, defaultChoices, makeOutlineMaterial } from '../character/girl.js';
import { loadLook } from '../launcher/profile.js';
import { AVATAR_HEIGHT, asset } from './contracts.js';

export const GIRL_MODEL_PATH = asset('assets/models/characters/girl_scientist.glb');

// Ground speed at which each gait plays at its authored rate. Not the
// controller's speeds: game walking is faster than real walking, and matching
// it exactly gives a character who sprints on the spot.
const WALK_REF = 4.2;
const RUN_REF = 8.6;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Drive a set of clips from the controller's state.
 *
 * Locomotion is chosen every frame and blended; one-shots (a wave, a cheer)
 * are requested by name and hold the body until they finish. Keeping that
 * distinction here means callers never have to think about crossfades.
 */
function makeAnimator(root, clips) {
  if (!clips || !clips.length) {
    return { update() {}, play() {}, stop() {}, names: [], mixer: null };
  }

  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    actions.set(clip.name, action);
  }

  // Loose name matching against a list of aliases, so an exporter's
  // "Armature|WalkCycle" lands, and so does a clip someone called "Jog".
  const find = (...wants) => {
    for (const want of wants) {
      if (actions.has(want)) return actions.get(want);
      const lower = want.toLowerCase();
      for (const [name, action] of actions) {
        if (name.toLowerCase().includes(lower)) return action;
      }
    }
    return null;
  };

  const gaits = {
    idle: find('idle', 'stand', 'rest'),
    walk: find('walk', 'jog'),
    run: find('run', 'sprint'),
  };
  // Whatever it is called, something has to be playing, or she is a statue.
  const fallback = actions.values().next().value;
  let current = gaits.idle || fallback;
  current.play();

  let oneShotUntil = 0;
  let oneShotInterruptible = false;
  let elapsed = 0;

  const switchTo = (action, fade = 0.25) => {
    if (!action || action === current) return;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.reset();
    action.play();
    action.crossFadeFrom(current, fade, true);
    current = action;
  };

  return {
    mixer,
    names: [...actions.keys()],

    /** @param {{speed:number, moving:boolean, running:boolean}} [state] */
    update(dt, state) {
      elapsed += dt;
      // A fun move (dance, jumping jacks) gives way the moment she walks.
      if (oneShotInterruptible && elapsed < oneShotUntil && state && state.moving && (state.speed || 0) > 0.15) {
        oneShotUntil = elapsed;
      }
      if (elapsed >= oneShotUntil) {
        const speed = state ? state.speed || 0 : 0;
        const moving = !!(state && state.moving) && speed > 0.15;
        const running = moving && !!state.running;
        const want = moving ? (running ? gaits.run : gaits.walk) : gaits.idle;
        switchTo(want || fallback, moving ? 0.18 : 0.3);

        // Match the stride to the ground speed, within reason, so her feet do
        // not skate. Clamped: past the edges it looks worse than the mismatch.
        if (moving) {
          current.timeScale = clamp(speed / (running ? RUN_REF : WALK_REF), 0.6, 1.5);
        } else {
          current.timeScale = 1;
        }
      }
      mixer.update(dt);
    },

    /**
     * Play a one-shot over the top of locomotion - a wave, a cheer.
     * @returns {boolean} whether the clip existed
     */
    play(name, { fade = 0.2, hold = null, interruptible = false } = {}) {
      const action = find(name);
      if (!action) return false;
      action.timeScale = 1;
      // Restart even if it is already the current clip (a second press of
      // the same move plays it again from the top).
      if (action === current) action.reset();
      switchTo(action, fade);
      oneShotUntil = elapsed + (hold ?? action.getClip().duration);
      oneShotInterruptible = interruptible;
      return true;
    },

    /** End a one-shot now; locomotion takes over on the next update. */
    stop() { oneShotUntil = elapsed; },
  };
}

/**
 * The outline is a 0.011-unit inverted hull, about 1.1 px from the chase camera
 * (8 units back), about 0.7 px at 12 units and about 0.4 px at 20. Past this
 * distance the hull is not drawn: nearly half her triangles. 20 sits beyond the
 * chapter-start sweep and the outro camera (about 17), so the outline never
 * switches off while she is on screen in either.
 */
const OUTLINE_NEAR = 20;

const _at = new THREE.Vector3();

/**
 * Culling and outline distance for a skinned girl. `pairs` is [{body, hull}].
 *
 * Her bounds are generous rather than fitted to the bind pose, because her arms
 * and legs leave that pose as she walks; a fitted sphere would clip a swinging
 * arm at the edge of the screen. Both meshes share the sphere.
 */
function cullAndOutlineLod(pairs, height) {
  for (const { body, hull } of pairs) {
    body.geometry.computeBoundingSphere();
    const s = body.geometry.boundingSphere;
    const sphere = new THREE.Sphere(s.center.clone(), Math.max(s.radius * 1.5, height));
    for (const m of hull ? [body, hull] : [body]) {
      m.frustumCulled = true;
      m.boundingSphere = sphere;
    }
    if (!hull) continue;
    // Set on the body, which draws first; the hull follows its flag next frame.
    // Shadow passes come through here with an orthographic camera far away, so
    // only the view camera decides whether the outline is drawn.
    body.onBeforeRender = (renderer, scene, camera) => {
      if (!camera.isPerspectiveCamera) return;
      body.getWorldPosition(_at);
      hull.visible = camera.position.distanceTo(_at) < OUTLINE_NEAR;
    };
  }
}

/**
 * The stand-in: the designed girl, rigged, at the game's scale.
 *
 * The outline is a second SkinnedMesh sharing her skeleton rather than the
 * usual scaled-up hull, because scaling a skinned mesh applies the scale twice.
 * See makeOutlineMaterial in girl.js.
 */
function buildPlaceholder(height = AVATAR_HEIGHT) {
  // The girl the child actually built, when there is one.
  //
  // character.html saves her choices under its own key; loadLook() reads that
  // same key rather than a second copy, so the two cannot drift. Defaults fill
  // in whatever is missing, so a half-written or older save still builds a
  // whole girl instead of throwing.
  const rig = buildGirlRig({ ...defaultChoices(), ...(loadLook() || {}) }, {
    material: new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true }),
    height,
    outline: true,
    outlineThickness: 0.011,
  });
  rig.group.name = 'avatarPlaceholder';
  cullAndOutlineLod([{ body: rig.mesh, hull: rig.hull }], height);
  return rig;
}

/**
 * Load the real girl if she has been delivered, else the placeholder.
 *
 * @returns {Promise<{group:THREE.Group, isPlaceholder:boolean, animations:string[],
 *   update:(dt:number,state:object)=>void, play:(name:string)=>boolean}>}
 */
/**
 * @param {{height?: number}} [opts]  her height in world units (Chapter 3's
 *   AVATAR_HEIGHT by default; Chapters 1 and 2 use a taller girl to match
 *   their townsfolk)
 */
export async function loadAvatar({ height = AVATAR_HEIGHT } = {}) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve) => {
    loader.load(GIRL_MODEL_PATH, resolve, undefined, () => resolve(null));
  });

  if (!gltf) {
    const rig = buildPlaceholder(height);
    const animator = makeAnimator(rig.group, rig.clips);
    return {
      group: rig.group,
      isPlaceholder: true,
      animations: animator.names,
      update: animator.update,
      play: animator.play,
      stop: animator.stop,
    };
  }

  const group = gltf.scene;
  // Ground and scale whatever arrives, so the drop-in needs no prior prep.
  // Scale goes on the outer group and the model is NOT re-bound, so a skinned
  // import keeps the bind matrices its exporter wrote.
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 1e-4) group.scale.setScalar(AVATAR_HEIGHT / size.y);
  const grounded = new THREE.Box3().setFromObject(group);
  group.position.y -= grounded.min.y;

  // toonify's outline is a scaled-up copy of the mesh, which for a skinned one
  // would hang in the bind pose while she walks out from inside it. Skinned
  // models get the shader-based outline instead.
  let skinned = false;
  group.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
  });
  toonify(group, { outline: !skinned });
  if (skinned) {
    const hulls = [];
    group.traverse((o) => {
      if (!o.isSkinnedMesh || o.userData.isOutline) return;
      const hull = new THREE.SkinnedMesh(o.geometry, makeOutlineMaterial(0.011));
      hull.userData.isOutline = true;
      hull.castShadow = false;
      hull.receiveShadow = false;
      hulls.push({ source: o, hull });
    });
    for (const { source, hull } of hulls) {
      source.parent.add(hull);
      hull.bind(source.skeleton, source.bindMatrix);
    }
    // A skinned mesh moves far outside its bind-pose bounds, so without a
    // sphere that covers her poses three culls her when an arm swings near the
    // edge of the screen.
    cullAndOutlineLod(hulls.map(({ source, hull }) => ({ body: source, hull })), height);
  }

  const animator = makeAnimator(group, gltf.animations || []);
  return {
    group,
    isPlaceholder: false,
    animations: animator.names,
    update: animator.update,
    play: animator.play,
    stop: animator.stop,
  };
}
