// THE SEAMS — every interface that crosses a module boundary.
//
// The game was built by several agents working in parallel, each owning a
// disjoint set of files, and this is where they agreed. That is history now,
// but the seams it froze are still the real ones:
//
//   board       src/game/board.js, src/game/toonPipeline.js
//   structures  src/game/structures.js
//   physics     src/game/physics.js, src/game/rocket.js
//   quests      src/game/quests.js, src/game/questions.js
//   interface   src/game/hud.js, src/game/hud.css
//
// Changing a signature declared here changes it for every module on the other
// side of that seam, so change it here first and follow it out.
//
// This file is documentation plus the few constants everyone shares. It holds
// no behaviour, so nobody has to import a dependency to read a rule.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// World units
// ---------------------------------------------------------------------------

/** kenney_nature ground tiles measure exactly 1.00 x 0.00 x 1.00. Verified. */
export const TILE_SIZE = 1;

/** Tile (i,j) -> world. The board owns the origin; use board.tileToWorld(). */
export const GROUND_Y = 0;

/**
 * Authored scales, measured from the real files in src/toonTest.js.
 * Quaternius nature is authored ~7.3 units tall; the space kit 8-12 units.
 * Multiply, never guess.
 */
/**
 * Per-family size multipliers, RELATIVE to whatever PACK_SCALE has already
 * made a pack. 1.0 means "a normal one of these".
 *
 * The nature numbers used to be 0.24-0.40, which was this table doing
 * PACK_SCALE's job before PACK_SCALE existed. Once both applied, the textured
 * Quaternius trees came out about 2 units tall - not quite twice the girl's
 * height - while the flat Kenney trees beside them stood at 6. That is the
 * "the textured trees are small and the others are giant" everyone could see.
 *
 * The space kit has no PACK_SCALE entry, so its numbers are still absolute.
 */
export const SCALE = {
  natureTree: 1.0,
  natureBush: 0.5,
  natureRock: 0.8,
  natureGrass: 0.45,
  natureMushroom: 0.6,
  spaceProp: 0.26,
  spaceBuilding: 0.22,
};

/**
 * Girl height in world units.
 *
 * 1.52 was the real-world metre figure inherited from the old build, but the
 * village is stylised: buildings land at 5.7-8.8 units, so a literal 1.52
 * person read as oversized against them. She is sized to the ARCHITECTURE
 * instead - roughly a fifth of a house, which is the proportion these asset
 * packs are drawn to.
 */
export const AVATAR_HEIGHT = 1.15;

/**
 * One scale per asset pack, so the packs agree with each other and with her.
 *
 * MEASURED, and the reason a per-PROP height table was the wrong fix: each
 * pack is internally consistent, they just disagree about what a unit is.
 * Kenney's town kit is drawn on a 1-unit grid at roughly 1 unit = 2 m - a
 * lantern is 1.56 units, a market stall 0.37, a windmill 3.11, which are the
 * right proportions *to each other*. Forcing a stall to a declared height
 * broke exactly that, and gave a market a child could walk under.
 *
 * So: scale each pack as a whole, chosen against its most recognisable object,
 * and let the artist's own proportions survive.
 *
 *   kit            lantern 1.56 -> a ~2.8-unit lamp post
 *   kenney_nature  tree_default 1.71 -> a ~6-unit tree
 *   nature         CommonTree_3 9.43 -> a ~8.5-unit tree  (already near-right)
 *
 * The girl is AVATAR_HEIGHT (1.15), so after this a village tree is five times
 * her height, a lamp post two and a half, and a market stall waist-high - the
 * proportions you would actually see.
 */
export const PACK_SCALE = Object.freeze({
  // Kenney's town kit is drawn small: a bench is 0.23 units and a lamp post
  // 1.56, which beside a 1.15-unit child is a bench she could step over and a
  // lamp post barely taller than she is. 1.8 overshot - it gave a market of
  // furniture she could walk under - so this sits between: a ~2.3-unit lamp
  // post, about twice her height, and benches she could actually sit on.
  kit: 1.5,
  // The vegetation is what was wrong: a Kenney tree ships 1.71 units tall, so
  // a tree was barely half a head above her. 3.5 puts a village tree at about
  // six units - five times her height, which is what a tree looks like.
  kenney_nature: 3.5,
  // Quaternius trees ship 9.4 units. 0.88 lands the hero trees at 5-6 units -
  // a shade above the Kenney forest at 4-6, which is what you want from an
  // accent: noticeably bigger, same wood.
  nature: 0.88,
});

/**
 * URL for a file under `public/`, honouring Vite's configured base.
 *
 * Every asset path used to be written with a leading slash, which pins the
 * build to being served from the domain root. It is not: the published build
 * lives under a path of its own, and a root-relative URL there asks the host
 * for files that are not at the root. `import.meta.env.BASE_URL` is whatever
 * `base` vite.config.js was built with - "/" in dev, "./" for a hosted copy -
 * so one helper covers both without either caring about the other.
 *
 * @param {string} p  path under public/, with or without a leading slash
 */
const ASSET_BASE = (() => {
  // In dev, Vite serves from the root and BASE_URL is exactly right.
  if (import.meta.env.DEV) return import.meta.env.BASE_URL;
  // In a built copy, derive the deploy root from the bundle's OWN url. A
  // configured base of "./" resolves against the document, which is one level
  // off whenever the page is served without a trailing slash - a difference
  // that does not show up locally and breaks every asset when hosted. This
  // module is bundled into <root>/assets/index-*.js, so the directory above
  // that IS the root, trailing slash or not.
  try {
    return new URL('../', import.meta.url).href;
  } catch {
    return import.meta.env.BASE_URL;
  }
})();

export const asset = (p) => {
  const rel = String(p).replace(/^\//, '');
  // A single-file build inlines every model and texture as a data URI and
  // leaves the map here. That is the only way the game can run straight off
  // `file://`, where a module import or a fetch of a sibling file is blocked
  // outright - so this lookup is what makes a double-clickable copy possible.
  const inlined = typeof window !== 'undefined' && window.__ROCKET_ASSETS;
  if (inlined && inlined[rel]) return inlined[rel];
  return `${ASSET_BASE}${rel}`;
};

/** Look up the pack scale for a served asset path. 1 when the pack is unlisted. */
export function packScaleFor(path) {
  const m = /\/assets\/models\/([^/]+)\//.exec(String(path) || '');
  return (m && PACK_SCALE[m[1]]) || 1;
}

// ---------------------------------------------------------------------------
// Hard rules, each one earned from a real defect
// ---------------------------------------------------------------------------

export const RULES = Object.freeze({
  // A GLTF loader mints UNIQUE materials per call. Load a prototype ONCE, then
  // clone(true) (which shares materials) or hand it to board.instanceAsset().
  // Loading per placement destroys the draw-call budget.
  loadPrototypeOncePerAsset: true,

  // Rebuilding a structure's meshes is a REBUILD, called on stage change only.
  // Doing it per frame leaks a full set of geometry every frame, because
  // removing a mesh does not dispose its buffers.
  rebuildIsNotATick: true,
});

/** Performance budget, measured against in the debug overlay (`/?debug`). */
export const BUDGET = Object.freeze({
  drawCalls: 150,
  triangles: 1_500_000,
  targetFps: 60,
});

// ---------------------------------------------------------------------------
// physics  (src/game/physics.js, src/game/rocket.js)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} CharacterState
 * @property {THREE.Vector3} position  written every step
 * @property {number}  headingY        facing, radians
 * @property {number}  speed           current horizontal speed, u/s
 * @property {number}  velocityY
 * @property {boolean} onGround
 * @property {boolean} moving
 * @property {boolean} running
 */

/**
 * Fixed-timestep character controller.
 *
 * Writes `target.position`, `target.rotation.y`, and (when `mirrorToTarget`
 * is on) `velocityY` and `speed`, and returns the flags above - so whatever
 * follows or animates the girl reads its state off the object it already has.
 *
 * @typedef {object} CharacterController
 * @property {(dt:number, input:MoveInput)=>CharacterState} step
 * @property {(x:number,z:number)=>number} groundHeightAt
 */

/**
 * @typedef {object} MoveInput
 * @property {number}  forward  -1..1, camera-relative
 * @property {number}  strafe   -1..1, camera-relative
 * @property {number}  cameraYaw
 * @property {boolean} run
 * @property {boolean} jump
 */

/**
 * Rocket flight simulation. The physics IS the lesson: fuel is mass, so a
 * heavier build climbs worse. Deterministic, fixed timestep, no rendering.
 *
 * @typedef {object} FlightConfig
 * @property {number} dryMassKg        hull + engine + guidance
 * @property {number} fuelMassKg       from the fuel stages the child built
 * @property {number} thrustN
 * @property {number} burnRateKgPerSec
 * @property {number} dragCoefficient  from the nose/fin stage
 * @property {number} crossSectionM2
 */

/**
 * @typedef {object} FlightSample
 * @property {number}  t          seconds since ignition
 * @property {number}  altitudeM
 * @property {number}  velocityMs
 * @property {number}  massKg     dry + remaining fuel
 * @property {number}  accelMs2
 * @property {boolean} burning
 * @property {boolean} apogee
 */

/**
 * @typedef {object} FlightSim
 * @property {(config:FlightConfig)=>void} ignite
 * @property {(dt:number)=>FlightSample}   step
 * @property {()=>FlightSample}            sample
 * @property {()=>boolean}                 reachedOrbit
 */

/** Target the child is aiming for. Below this the launch is a near miss. */
export const ORBIT_ALTITUDE_M = 100_000;

// ---------------------------------------------------------------------------
// quests  (src/game/quests.js, src/game/questions.js)
// ---------------------------------------------------------------------------

/**
 * One rung of the unlock ladder. See docs/QUEST_SPEC.md for the authored chain.
 *
 * @typedef {object} StepNode
 * @property {string}   id
 * @property {number}   order
 * @property {string}   title
 * @property {string[]} requires      step ids that must be complete
 * @property {string}   [questionId]  the question gating this step
 * @property {string}   [buildId]     the build gating this step
 * @property {WorldEffect[]} effects  what changes in the world on completion
 * @property {object}   rewards
 * @property {string}   statusText    HUD line while this step is current
 * @property {string}   missionText   "what do I do next", never empty
 */

/**
 * A world change a completed step causes. The scene subscribes to these; the
 * quest module never touches the scene graph itself.
 *
 * @typedef {object} WorldEffect
 * @property {'build'|'reveal'|'unlock'|'spawn'} kind
 * @property {string} targetId    structure / region / node-group id
 * @property {number} [pieces]    for 'build': animate in over N pieces (L2 style)
 */

/**
 * @typedef {object} QuestEngine
 * @property {()=>StepNode|null}        current
 * @property {(id:string)=>boolean}     isComplete
 * @property {(id:string)=>StepNode}    get
 * @property {(questionId:string, answer:string|number)=>boolean} answer
 * @property {()=>number}               progressPercent   0..100
 * @property {(fn:(e:WorldEffect)=>void)=>void} onEffect
 */

// ---------------------------------------------------------------------------
// structures  (src/game/structures.js)
// ---------------------------------------------------------------------------

/**
 * Every building is a factory returning a Group, so pieces stay swappable and
 * a 'build' WorldEffect can reveal them N pieces at a time.
 *
 * @typedef {object} Structure
 * @property {string} id
 * @property {THREE.Group} group
 * @property {number} pieceCount
 * @property {(n:number)=>void} showPieces   reveal the first n pieces
 * @property {{x:number,z:number,radius:number}} footprint  for the collider
 */

// ---------------------------------------------------------------------------
// interface  (src/game/hud.js)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Hud
 * @property {(pct:number, status:string)=>void} setProgress
 * @property {(text:string)=>void}   setMission
 * @property {(text:string)=>void}   toast
 * @property {(inv:object)=>void}    setInventory
 * @property {(q:object, cb:(ok:boolean)=>void)=>void} askQuestion
 * @property {(sample:object)=>void} setFlightReadout
 */

export default { TILE_SIZE, GROUND_Y, SCALE, AVATAR_HEIGHT, RULES, BUDGET, ORBIT_ALTITUDE_M };
