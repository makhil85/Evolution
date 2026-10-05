// The Level 3 unlock ladder, the quest engine, and the save layer.
//
// Implements docs/QUEST_SPEC.md against the frozen interfaces in contracts.js
// (StepNode, WorldEffect, QuestEngine). Three hard rules shape everything here:
//
//   1. The engine NEVER touches the scene graph. It emits WorldEffects and A1/A2
//      subscribe with onEffect(). That is why this file imports nothing but the
//      question bank — no THREE, no DOM, no scene graph.
//   2. Anti-stuck is a contract, not a nicety (spec §5.7). current() always
//      returns an actionable step until launch, missionText is never empty, and
//      every lockedMessage names an action.
//   3. No NaN, ever. A critic audit found `state.inventory.rocketParts += 1` on
//      an undefined key at main.js:175: one `undefined` poisons the number, and
//      `canPay` then fails forever with no way back. Every arithmetic path in
//      this file goes through num()/addResource(), which cannot produce NaN.

import { QUESTIONS, getQuestion, checkAnswer, wrongAnswerMessage } from './questions.js';
import { IS_LEVEL1 } from '../space/level.js';
import { STEP_TEXT_L1, STAGE_TEXT_L1, BONUS_LINE_L1 } from './quests.level1.js';

// ---------------------------------------------------------------------------
// Numeric safety
// ---------------------------------------------------------------------------

/**
 * Coerce anything to a finite number. `undefined`, `null`, `''`, `NaN`,
 * `Infinity` and junk strings all collapse to the fallback instead of poisoning
 * the arithmetic downstream.
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function num(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Integer count >= 0. Resources are never fractional and never negative. */
function count(value) {
  const n = Math.floor(num(value, 0));
  return n > 0 ? n : 0;
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const uniq = (list) => Array.from(new Set(list));

// ---------------------------------------------------------------------------
// Save layer  (spec §5.7 point 7, §4.4)
// ---------------------------------------------------------------------------

/**
 * v2 because both the question ids and the starting inventory changed with this
 * spec. v1 saves are migrated, never discarded.
 */
/**
 * Where chapter 3's progress is saved.
 *
 * One key per DIFFICULTY. The two difficulties are the same game with a
 * different question bank, so sharing a save would carry a Level 4 child's
 * finished rocket into a Level 1 run - and the launcher's gate, which reads
 * this key, would show chapter 3 already complete.
 *
 * Read directly rather than through profile.js: this module is imported by
 * verification scripts that run in node, where there is no localStorage.
 */
export const STORE_KEY = (() => {
  try {
    const raw = localStorage.getItem('rocket_village_profile');
    const n = raw ? JSON.parse(raw)?.difficulty : null;
    return n === 1 ? 'level3_rocket_village_v2_L1' : 'level3_rocket_village_v2';
  } catch {
    return 'level3_rocket_village_v2';
  }
})();
export const LEGACY_STORE_KEY = 'level3_rocket_village_v1';

/** Every resource the ladder can spend or award. Order is HUD order. */
export const RESOURCE_KEYS = ['wood', 'stone', 'iron', 'gems', 'fuel', 'circuits', 'rocketParts'];

/**
 * Starter kit only (spec §4.4). The old default paid for most of Stage 1 and 2
 * before the child had done anything, which made collecting pointless.
 * @returns {Object<string, number>}
 */
export const defaultInventory = () => ({
  wood: 2, stone: 2, iron: 0, gems: 0, fuel: 0, circuits: 0, rocketParts: 0
});

/**
 * The quest-owned slice of the save file. main.js merges this into its own
 * state object; keys it does not know about survive the merge untouched.
 * @returns {object}
 */
export const defaultSave = () => ({
  version: 2,
  inventory: defaultInventory(),
  completedSteps: [],
  completedQuests: [],
  builtStages: [],
  unlockedParts: [],
  collectedIds: [],
  visitedBuildings: [],
  attempts: {},
  rank: 'Visitor',
  xp: 0,
  launched: false,
  // Hard play mode: the Guidance Crystal from the treasure hunt has been found.
  // Absent in older saves, so it merges in as false.
  huntFound: false
});

/**
 * Deep, per-key merge — the fix for an audited `{...defaultSave(), ...saved}`
 * bug. A one-level spread replaces `inventory` WHOLESALE, so the
 * moment a new resource key is added every existing player reads `undefined`
 * for it, `undefined >= 6` is false forever, and the save is bricked.
 *
 * Rules, in order:
 *  - nested plain objects merge key by key (new defaults appear, saved values win)
 *  - keys the save has but the defaults do not are KEPT (another agent may own them)
 *  - a default-typed number that arrives as NaN/null/junk falls back to the default
 *  - arrays are copied, never shared, and a non-array replacement is rejected
 *
 * @template T
 * @param {T} defaults
 * @param {unknown} saved
 * @returns {T}
 */
export function mergeSave(defaults, saved) {
  const base = structuredCopy(defaults);
  if (!isPlainObject(saved)) return base;

  for (const key of Object.keys(saved)) {
    const incoming = saved[key];
    const fallback = base[key];

    if (isPlainObject(fallback) && isPlainObject(incoming)) {
      base[key] = mergeSave(fallback, incoming);
    } else if (Array.isArray(fallback)) {
      base[key] = Array.isArray(incoming) ? incoming.slice() : fallback.slice();
    } else if (typeof fallback === 'number') {
      base[key] = num(incoming, fallback);
    } else if (typeof fallback === 'boolean') {
      base[key] = typeof incoming === 'boolean' ? incoming : fallback;
    } else if (incoming === undefined || incoming === null) {
      base[key] = fallback === undefined ? null : fallback;
    } else if (isPlainObject(incoming) && fallback === undefined) {
      // Unknown nested object from another agent's slice: keep it, sanitised.
      base[key] = mergeSave({}, incoming);
    } else if (typeof incoming === 'number') {
      // Unknown numeric key: still guarded, so a NaN written by an older build
      // cannot survive a reload and re-poison whatever reads it.
      base[key] = num(incoming, num(fallback, 0));
    } else {
      base[key] = incoming;
    }
  }
  return base;
}

/** structuredClone without the platform dependency, for plain JSON data. */
function structuredCopy(value) {
  if (Array.isArray(value)) return value.map(structuredCopy);
  if (isPlainObject(value)) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = structuredCopy(value[k]);
    return out;
  }
  return value;
}

/**
 * Guarantee an inventory that is complete, finite and non-negative. Unknown
 * saved resource keys are preserved (a later level may add one), but every
 * value is forced to a sane integer so no `canPay` can ever be poisoned.
 * @param {unknown} inventory
 * @returns {Object<string, number>}
 */
export function sanitizeInventory(inventory) {
  const out = defaultInventory();
  if (isPlainObject(inventory)) {
    for (const key of Object.keys(inventory)) out[key] = count(inventory[key]);
  }
  for (const key of RESOURCE_KEYS) out[key] = count(out[key]);
  return out;
}

/**
 * Normalise any save-shaped object into something the engine can run on.
 * Safe to call on a fresh save, a v1 save, a v2 save, or garbage.
 * @param {unknown} saved
 * @returns {object}
 */
export function normalizeSave(saved) {
  const state = mergeSave(defaultSave(), saved);
  state.inventory = sanitizeInventory(state.inventory);
  state.completedQuests = uniq(asIdList(state.completedQuests).filter((id) => !!getQuestion(id)));
  state.builtStages = uniq(asIdList(state.builtStages).filter((id) => !!getStage(id)));
  state.completedSteps = uniq(asIdList(state.completedSteps).filter((id) => !!STEP_BY_ID[id]));
  state.unlockedParts = uniq(asIdList(state.unlockedParts));
  state.collectedIds = uniq(asIdList(state.collectedIds));
  state.visitedBuildings = uniq(asIdList(state.visitedBuildings));
  state.attempts = isPlainObject(state.attempts) ? state.attempts : {};
  for (const key of Object.keys(state.attempts)) state.attempts[key] = count(state.attempts[key]);
  state.xp = count(state.xp);
  state.launched = state.launched === true;
  state.huntFound = state.huntFound === true;
  if (!RANKS.includes(state.rank)) state.rank = 'Visitor';
  state.version = 2;

  // Steps are derived, not authoritative: a save that lost `completedSteps` but
  // kept `completedQuests` must not re-ask questions the child already answered.
  state.completedSteps = uniq([...state.completedSteps, ...derivedSteps(state)]);
  return state;
}

function asIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.length > 0);
}

/** Steps implied by the questions answered / stages built / launch flag. */
function derivedSteps(state) {
  const quests = new Set(state.completedQuests);
  const stages = new Set(state.builtStages);
  const out = [];
  for (const step of QUEST_CHAIN) {
    if (step.questionId && quests.has(step.questionId)) out.push(step.id);
    else if (step.stageId && stages.has(step.stageId)) out.push(step.id);
    else if (step.kind === 'launch' && state.launched) out.push(step.id);
  }
  return out;
}

/**
 * Read the save, migrating a v1 file the first time. Never throws: a corrupt
 * localStorage entry yields a fresh save rather than a blank screen.
 * @param {Storage} [store]
 * @returns {object}
 */
export function loadSave(store = safeStorage()) {
  if (!store) return normalizeSave(null);
  try {
    const raw = store.getItem(STORE_KEY);
    if (raw) return normalizeSave(JSON.parse(raw));
    const legacy = store.getItem(LEGACY_STORE_KEY);
    if (legacy) return migrateFromV1(JSON.parse(legacy));
    return normalizeSave(null);
  } catch {
    return normalizeSave(null);
  }
}

/**
 * v1 -> v2. Carries the child's progress forward rather than resetting them:
 * taking a returning player back to zero is the same failure as a soft-lock.
 *
 * Question ids that survived keep their credit. `cadet_oath` is new and so is
 * unanswered, which is correct — it is Step 1 and costs one easy question. The
 * old (generous) inventory is kept: the starter-kit change is for NEW players,
 * and confiscating resources from an existing save would be punishing.
 *
 * @param {unknown} legacy
 * @returns {object}
 */
export function migrateFromV1(legacy) {
  const state = normalizeSave(legacy);
  state.version = 2;
  return state;
}

/**
 * Persist. Only the quest slice is written here; main.js owns the rest of the
 * object and may pass a superset — unknown keys are stored verbatim.
 * @param {object} state
 * @param {Storage} [store]
 * @returns {boolean} false if storage is unavailable (private mode, quota)
 */
export function saveGame(state, store = safeStorage()) {
  if (!store) return false;
  try {
    store.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * NaN-proof affordability check.
 * @param {Object<string, number>} inventory
 * @param {Object<string, number>} need
 * @returns {boolean}
 */
export function canPay(inventory, need) {
  if (!isPlainObject(need)) return true;
  return Object.keys(need).every((k) => count(inventory && inventory[k]) >= count(need[k]));
}

/**
 * What is still missing, per resource. Drives the "you need 4 more iron" toast.
 * @param {Object<string, number>} inventory
 * @param {Object<string, number>} need
 * @returns {Object<string, number>}
 */
export function missingFor(inventory, need) {
  const missing = {};
  if (!isPlainObject(need)) return missing;
  for (const k of Object.keys(need)) {
    const short = count(need[k]) - count(inventory && inventory[k]);
    if (short > 0) missing[k] = short;
  }
  return missing;
}

/**
 * Spend, clamped at zero. Refuses outright if the cost is not affordable, so a
 * half-paid build can never leave the inventory in a negative state.
 * @param {Object<string, number>} inventory
 * @param {Object<string, number>} need
 * @returns {boolean} true if paid
 */
export function pay(inventory, need) {
  if (!isPlainObject(inventory) || !canPay(inventory, need)) return false;
  for (const k of Object.keys(need || {})) {
    inventory[k] = Math.max(0, count(inventory[k]) - count(need[k]));
  }
  return true;
}

/**
 * Add to a resource. THIS is the function main.js should call instead of
 * `state.inventory.rocketParts += 1` — an undefined key starts at 0 here
 * instead of becoming NaN and bricking every later canPay().
 * @param {Object<string, number>} inventory
 * @param {string} key
 * @param {number} amount
 * @returns {number} the new total
 */
export function addResource(inventory, key, amount = 1) {
  if (!isPlainObject(inventory) || typeof key !== 'string' || !key) return 0;
  inventory[key] = Math.max(0, count(inventory[key]) + Math.floor(num(amount, 0)));
  return inventory[key];
}

/**
 * Add a whole bundle, e.g. a question reward.
 * @param {Object<string, number>} inventory
 * @param {Object<string, number>} bundle
 * @returns {Object<string, number>} what was actually added
 */
export function addResources(inventory, bundle) {
  const added = {};
  if (!isPlainObject(bundle)) return added;
  for (const k of Object.keys(bundle)) {
    const amount = Math.floor(num(bundle[k], 0));
    if (amount === 0) continue;
    addResource(inventory, k, amount);
    added[k] = amount;
  }
  return added;
}

// ---------------------------------------------------------------------------
// Ranks  (spec §2.1)
// ---------------------------------------------------------------------------

/** Ordered: rank is monotonic, so the ★ shortcut can never demote anyone. */
export const RANKS = [
  'Visitor',
  'Cadet',
  'Junior Engineer',
  'Flight Engineer',
  'Chief Engineer',
  'Rocket Scientist'
];

const rankIndex = (rank) => {
  const i = RANKS.indexOf(rank);
  return i < 0 ? 0 : i;
};

// ---------------------------------------------------------------------------
// Build stages  (spec §4.3)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} RocketStage
 * @property {string} id
 * @property {number} order
 * @property {string} title
 * @property {Object<string, number>} need
 * @property {string[]} requires   question ids
 * @property {number} pieces       L2 animation rule: one piece every 330 ms
 * @property {string} builtMessage
 */

/** @type {RocketStage[]} */
const ROCKET_STAGES_L4 = [
  {
    id: 'foundation', order: 1, title: 'Foundation + Frame', need: { wood: 6, stone: 6 },
    requires: ['rocket_scale', 'rocket_materials'], pieces: 2,
    builtMessage: 'Stage 1 up. The frame is standing on the pad — you can see it from here.'
  },
  {
    id: 'body', order: 2, title: 'Body + Tanks + Fins', need: { iron: 8, wood: 4 },
    requires: ['rocket_flow', 'rocket_drag'], pieces: 3,
    builtMessage: 'Stage 2 up, and the bridge is building itself across the river!'
  },
  {
    id: 'control', order: 3, title: 'Engine + Guidance', need: { circuits: 6, iron: 4 },
    requires: ['rocket_thrust', 'rocket_guidance'], pieces: 3,
    builtMessage: 'Stage 3 up. The engine bell and the guidance ring are mounted.'
  },
  {
    id: 'fuel', order: 4, title: 'Propellant System', need: { fuel: 6, circuits: 2 },
    requires: ['rocket_fuel'], pieces: 2,
    builtMessage: 'Stage 4 up. The tanks are loaded and the hologram switches off — the real rocket matches it now.'
  },
  {
    id: 'final', order: 5, title: 'Final Launch Systems', need: { gems: 4, rocketParts: 2, fuel: 2 },
    requires: ['rocket_launch', 'rocket_thrust', 'rocket_guidance', 'rocket_fuel'], pieces: 4,
    builtMessage: 'Stage 5 complete. The rocket is finished. LAUNCH is armed.'
  }
];

/** The stages, with Level 1's shorter words at Level 1 (quests.level1.js). */
export const ROCKET_STAGES = IS_LEVEL1 ? ROCKET_STAGES_L4.map((s) => ({ ...s, ...(STAGE_TEXT_L1[s.id] || {}) })) : ROCKET_STAGES_L4;

const STAGE_BY_ID = Object.fromEntries(ROCKET_STAGES.map((s) => [s.id, s]));

/** @param {string} id @returns {RocketStage|null} */
export function getStage(id) {
  return STAGE_BY_ID[id] || null;
}

// ---------------------------------------------------------------------------
// The ladder  (spec §2.3, weights §5.1)
// ---------------------------------------------------------------------------

/**
 * A rung of the ladder. Field names follow contracts.js StepNode exactly;
 * the extra fields (stationId, stageId, cost, lockedMessage, progressWeight,
 * optional, unlocks) are additive and carry the spec's HUD data.
 *
 * @typedef {object} StepNode
 * @property {string}   id
 * @property {number}   order
 * @property {string}   title
 * @property {string[]} requires       step ids that must be complete first
 * @property {string}   [questionId]
 * @property {string}   [buildId]      the stage this step builds
 * @property {WorldEffect[]} effects
 * @property {object}   rewards
 * @property {string}   statusText     the text after the "%" in the bar
 * @property {string}   missionText    "what do I do next", never empty
 * @property {'question'|'build'|'launch'} kind
 * @property {string}   label          short name for the badge row
 * @property {string}   stationId
 * @property {string}   [stageId]
 * @property {Object<string, number>} [cost]
 * @property {boolean}  [optional]     true = gates nothing (the ★ node)
 * @property {string}   lockedMessage  MUST name the exact next action
 * @property {number}   progressWeight contribution to the 100-point total
 * @property {object}   unlocks        {steps, stages, rank, regions}
 */

/**
 * @typedef {object} WorldEffect
 * @property {'build'|'reveal'|'unlock'|'spawn'} kind
 * @property {string}  targetId
 * @property {number}  [pieces]       for 'build': animate in over N pieces
 * @property {number}  [count]        for 'spawn'
 * @property {boolean} [visible]      for 'reveal': false means hide
 * @property {string}  [rank]         for 'unlock' of a rank
 * @property {string}  [doneMessage]  toast when the animation finishes
 */

const MISSION_FALLBACK = 'Open the Mission card and follow the glowing marker to your next station.';

const RAW_CHAIN = [
  {
    id: 'step_cadet', order: 1, kind: 'question', label: 'Cadet Test',
    title: 'The Scientist’s Cadet Test', stationId: 'missionSchool', questionId: 'cadet_oath',
    requires: [], progressWeight: 6,
    unlocks: { steps: ['step_blueprint'], stages: [], rank: 'Cadet' },
    effects: [
      { kind: 'reveal', targetId: 'missionSchool.doors' },
      { kind: 'reveal', targetId: 'rocketPad.hologram', doneMessage: 'A hologram rocket switches on across the river.' },
      // Wood and stone spawn on the north road NOW, because Stage 1 (step 4) is
      // the first thing that spends them. Spec §4.4: nodes go on the path
      // leading to the step that consumes them, so no back-tracking is needed.
      { kind: 'spawn', targetId: 'wood', count: 14 },
      { kind: 'spawn', targetId: 'stone', count: 12 },
      { kind: 'unlock', targetId: 'rank:Cadet', rank: 'Cadet' }
    ],
    // Step 1 can never actually be locked, but the invariant is "every
    // lockedMessage names an action", so it still names one.
    lockedMessage: 'The Cadet Test is open right now — walk north up the road to the Mission School on the left.',
    missionText: 'Walk north up the road, pick up the glowing crates on the way, and take the Cadet Test at the Mission School on the left.',
    statusText: 'Take the Cadet Test at the Mission School'
  },

  {
    id: 'step_blueprint', order: 2, kind: 'question', label: 'Blueprint',
    title: 'Rocket Scale Blueprint', stationId: 'missionSchool', questionId: 'rocket_scale',
    requires: ['step_cadet'], progressWeight: 7,
    unlocks: { steps: ['step_frame'], stages: [] },
    effects: [
      { kind: 'reveal', targetId: 'missionSchool.blueprintDesk' },
      { kind: 'reveal', targetId: 'missionSchool.console', visible: false },
      { kind: 'reveal', targetId: 'path.materialsForge' },
      { kind: 'reveal', targetId: 'materialsForge.chimneySmoke' }
    ],
    lockedMessage: 'The blueprint desk is upstairs. Pass the Cadet Test downstairs first — cadets only above this floor.',
    missionText: 'Go up to the blueprint room in the Mission School and work out how tall the real rocket will be.',
    statusText: 'Finish the blueprint upstairs'
  },

  {
    id: 'step_frame', order: 3, kind: 'question', label: 'Frame',
    title: 'Choose the Frame', stationId: 'materialsForge', questionId: 'rocket_materials',
    requires: ['step_blueprint'], progressWeight: 8,
    unlocks: { steps: ['build_foundation'], stages: ['foundation'], rank: 'Junior Engineer' },
    effects: [
      // No `pieces` count on a building: the structure knows how many it has,
      // and a number written here has to be kept in step with a recipe in
      // another file forever. It was not - adding walls to the Forge would
      // have left it built to four pieces out of seven, permanently roofless.
      { kind: 'build', targetId: 'materialsForge', doneMessage: 'Materials Forge complete. The Build Menu is unlocked!' },
      { kind: 'reveal', targetId: 'materialsForge.console', visible: false },
      // 10 nodes, not the spec's 8: at 8 the level fails its own 2× supply
      // invariant for iron (see validateChain).
      // Sink is 12 (body 8 + control 4). Shipping 10 made the game
      // unfinishable for a child who played perfectly.
      { kind: 'spawn', targetId: 'iron', count: 18 },
      { kind: 'unlock', targetId: 'buildMenu' },
      { kind: 'unlock', targetId: 'rank:Junior Engineer', rank: 'Junior Engineer' }
    ],
    lockedMessage: 'The Forge is cold. Finish the blueprint at the Mission School first — the smith needs to know how big the rocket is.',
    missionText: 'Cross to the Materials Forge on the right side of the village and choose the metal for the rocket frame.',
    statusText: 'Choose the frame metal at the Forge'
  },

  {
    id: 'build_foundation', order: 4, kind: 'build', label: 'Foundation',
    title: 'Build Stage 1 — Foundation + Frame', stationId: 'rocketPad',
    buildId: 'foundation', stageId: 'foundation', cost: { wood: 6, stone: 6 },
    requires: ['step_frame'], progressWeight: 9,
    unlocks: { steps: ['step_flow', 'step_drag'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'rocket.stage.foundation', pieces: 2, doneMessage: 'Stage 1 up. The frame is standing on the pad — you can see it from here.' },
      { kind: 'reveal', targetId: 'rocketPad.ringLamps' },
      { kind: 'unlock', targetId: 'waterLab' },
      { kind: 'unlock', targetId: 'windTunnel' }
    ],
    lockedMessage: 'Choose the frame metal at the Materials Forge first, then bring 6 wood and 6 stone to the pad.',
    missionText: 'Collect 6 wood and 6 stone, then build the rocket foundation at the pad. You can build it from this side of the river.',
    statusText: 'Build the rocket foundation at the pad'
  },

  {
    id: 'step_flow', order: 5, kind: 'question', label: 'Flow Test',
    title: 'Tank Flow Test', stationId: 'waterLab', questionId: 'rocket_flow',
    requires: ['build_foundation'], progressWeight: 7,
    unlocks: { steps: ['build_body'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'waterLab', doneMessage: 'Flow Tank complete. Pipes now run through the Water Lab.' },
      { kind: 'reveal', targetId: 'waterLab.console', visible: false },
      { kind: 'spawn', targetId: 'fuel', count: 6 }
    ],
    lockedMessage: 'The Water Lab opens once the rocket foundation is standing. Build Stage 1 at the pad first.',
    missionText: 'Run the tank drain test at the Water Lab on the left.',
    statusText: 'Run the tank test at the Water Lab'
  },

  {
    id: 'step_drag', order: 6, kind: 'question', label: 'Wind Tunnel',
    title: 'Wind Tunnel', stationId: 'windTunnel', questionId: 'rocket_drag',
    requires: ['build_foundation'], progressWeight: 7,
    unlocks: { steps: ['build_body'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'windTunnel', doneMessage: 'Wind Tunnel complete. The big fan starts turning.' },
      { kind: 'reveal', targetId: 'windTunnel.console', visible: false }
    ],
    lockedMessage: 'The Wind Tunnel opens once the rocket foundation is standing. Build Stage 1 at the pad first.',
    missionText: 'Test the nose shapes in the Wind Tunnel on the right and pick the one with the least drag.',
    statusText: 'Test the nose shape in the Wind Tunnel'
  },

  {
    id: 'build_body', order: 7, kind: 'build', label: 'Rocket Body',
    title: 'Build Stage 2 — Body + Tanks + Fins', stationId: 'rocketPad',
    buildId: 'body', stageId: 'body', cost: { iron: 8, wood: 4 },
    requires: ['step_flow', 'step_drag'], progressWeight: 12,
    unlocks: {
      steps: ['step_thrust', 'step_fuel', 'step_guidance'],
      stages: [], rank: 'Flight Engineer', regions: ['south']
    },
    effects: [
      { kind: 'build', targetId: 'rocket.stage.body', pieces: 3 },
      { kind: 'build', targetId: 'bridge', pieces: 5, doneMessage: 'The bridge is finished! The engineering side of the village is open.' },
      { kind: 'unlock', targetId: 'river.crossing' },
      { kind: 'reveal', targetId: 'village.south' },
      { kind: 'unlock', targetId: 'rank:Flight Engineer', rank: 'Flight Engineer' }
    ],
    lockedMessage: 'The rocket body needs the tank test at the Water Lab AND the wind tunnel test first, plus 8 iron and 4 wood.',
    missionText: 'Collect 8 iron and 4 wood, then build the rocket body at the pad. Finishing it also builds the bridge across the river.',
    statusText: 'Build the rocket body — it also builds the bridge'
  },

  {
    id: 'step_thrust', order: 8, kind: 'question', label: 'Thrust',
    title: 'Engine Thrust', stationId: 'scienceCenter', questionId: 'rocket_thrust',
    requires: ['build_body'], progressWeight: 8,
    unlocks: { steps: ['build_control', 'step_chief'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'scienceCenter', doneMessage: 'The Science Center dome completes and the engine cutaway fires.' },
      { kind: 'reveal', targetId: 'scienceCenter.console', visible: false },
      { kind: 'unlock', targetId: 'observatory' }
    ],
    lockedMessage: 'The Science Center is across the river. Build the rocket body at the pad — the bridge gets built at the same time.',
    missionText: 'Cross the new bridge and watch the engine cutaway fire at the Science Center.',
    statusText: 'Cross the bridge to the Science Center'
  },

  {
    id: 'step_fuel', order: 9, kind: 'question', label: 'Fuel Mix',
    title: 'Fuel Mixture', stationId: 'fuelDepot', questionId: 'rocket_fuel',
    requires: ['build_body'], progressWeight: 8,
    unlocks: { steps: ['build_fuel'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'fuelDepot', doneMessage: 'Fuel Depot complete. The tank farm builds itself.' },
      { kind: 'reveal', targetId: 'fuelDepot.console', visible: false },
      { kind: 'spawn', targetId: 'fuel', count: 6 }
    ],
    lockedMessage: 'The Fuel Depot is across the river. Build the rocket body at the pad — the bridge gets built at the same time.',
    missionText: 'Mix the propellant safely at the Fuel Depot on the south-east side.',
    statusText: 'Mix the propellant at the Fuel Depot'
  },

  {
    id: 'step_guidance', order: 10, kind: 'question', label: 'Guidance',
    title: 'Guidance Turns', stationId: 'guidanceTower', questionId: 'rocket_guidance',
    requires: ['build_body'], progressWeight: 8,
    unlocks: { steps: ['build_control'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'guidanceTower', doneMessage: 'Guidance Tower complete. The dish starts sweeping the sky.' },
      { kind: 'reveal', targetId: 'guidanceTower.console', visible: false },
      // Sink is 8 (control 6 + fuel 2). Six was a soft-lock.
      { kind: 'spawn', targetId: 'circuits', count: 12 }
    ],
    lockedMessage: 'The Guidance Tower is across the river. Build the rocket body at the pad — the bridge gets built at the same time.',
    missionText: 'Aim the rocket at the Guidance Tower in the far south-west corner.',
    statusText: 'Aim the rocket at the Guidance Tower'
  },

  {
    id: 'build_control', order: 11, kind: 'build', label: 'Engine',
    title: 'Build Stage 3 — Engine + Guidance', stationId: 'rocketPad',
    buildId: 'control', stageId: 'control', cost: { circuits: 6, iron: 4 },
    requires: ['step_thrust', 'step_guidance'], progressWeight: 5,
    unlocks: { steps: ['build_fuel'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'rocket.stage.control', pieces: 3, doneMessage: 'Stage 3 up. The engine bell and the guidance ring are mounted.' },
      { kind: 'reveal', targetId: 'rocketPad.gantry' }
    ],
    lockedMessage: 'The engine stage needs the thrust test at the Science Center AND the guidance test at the Tower, plus 6 circuits and 4 iron.',
    missionText: 'Build the engine and guidance stage at the pad — 6 circuits and 4 iron.',
    statusText: 'Build the engine and the guidance ring'
  },

  {
    id: 'build_fuel', order: 12, kind: 'build', label: 'Propellant',
    title: 'Build Stage 4 — Propellant System', stationId: 'rocketPad',
    buildId: 'fuel', stageId: 'fuel', cost: { fuel: 6, circuits: 2 },
    requires: ['step_fuel', 'build_control'], progressWeight: 5,
    unlocks: { steps: ['step_countdown'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'rocket.stage.fuel', pieces: 2, doneMessage: 'Stage 4 up. The tanks are loaded and the hologram switches off.' },
      { kind: 'reveal', targetId: 'rocketPad.hologram', visible: false }
    ],
    lockedMessage: 'The propellant system needs the fuel mixture from the Depot and the engine stage built first, plus 6 fuel and 2 circuits.',
    missionText: 'Load the propellant system onto the rocket — 6 fuel and 2 circuits.',
    statusText: 'Build the fuel system'
  },

  {
    id: 'step_countdown', order: 13, kind: 'question', label: 'Countdown',
    title: 'Countdown Check', stationId: 'rocketPad', questionId: 'rocket_launch',
    requires: ['build_fuel'], progressWeight: 5,
    unlocks: { steps: ['build_final'], stages: ['final'] },
    effects: [
      { kind: 'reveal', targetId: 'rocketPad.countdownBoard', doneMessage: 'The countdown board lights up on the tower.' },
      // The last two sinks, dropped on the pad path right before they are spent.
      // Zero slack before: one missed pickup stranded the child on the very
      // last build. Both now carry a spare.
      { kind: 'spawn', targetId: 'gems', count: 7 },
      { kind: 'spawn', targetId: 'rocketParts', count: 4 },
      { kind: 'unlock', targetId: 'stage:final' }
    ],
    lockedMessage: 'Launch control only runs the countdown check once the engine and the fuel system are both on the rocket.',
    missionText: 'Do the final countdown check with launch control at the pad.',
    statusText: 'Do the final countdown check at the pad'
  },

  {
    id: 'build_final', order: 14, kind: 'build', label: 'Launch Systems',
    title: 'Build Stage 5 — Final Launch Systems', stationId: 'rocketPad',
    buildId: 'final', stageId: 'final', cost: { gems: 4, rocketParts: 2, fuel: 2 },
    requires: ['step_countdown'], progressWeight: 4,
    unlocks: { steps: ['step_launch'], stages: [] },
    effects: [
      { kind: 'build', targetId: 'rocket.stage.final', pieces: 4, doneMessage: 'Stage 5 complete. The rocket is finished. LAUNCH is armed.' },
      { kind: 'reveal', targetId: 'rocketPad.clamps' },
      { kind: 'unlock', targetId: 'launchButton' }
    ],
    lockedMessage: 'Pass the countdown check first, then bring 4 gems, 2 rocket parts and 2 fuel to the pad.',
    missionText: 'Build the final launch systems — 4 gems, 2 rocket parts and 2 fuel.',
    statusText: 'Build the final launch systems'
  },

  {
    id: 'step_launch', order: 15, kind: 'launch', label: 'Launch',
    title: 'Launch', stationId: 'rocketPad',
    requires: ['build_final'], progressWeight: 1,
    unlocks: { steps: [], stages: [], rank: 'Rocket Scientist' },
    effects: [
      { kind: 'unlock', targetId: 'flight' },
      { kind: 'unlock', targetId: 'rank:Rocket Scientist', rank: 'Rocket Scientist' }
    ],
    lockedMessage: 'The launch button arms itself once the final launch systems are built at the pad.',
    missionText: 'Everything is ready. Press LAUNCH.',
    statusText: 'Press LAUNCH'
  },

  // ★ The bonus. Weight 0 so the bar never jumps, `optional` so it can be
  // deleted from the game entirely and the level still completes (spec §5.7.5).
  {
    id: 'step_chief', order: 8.5, kind: 'question', label: '★ Bonus', optional: true,
    title: 'Chief Engineer Challenge', stationId: 'observatory', questionId: 'chief_engineer',
    requires: ['step_thrust'], progressWeight: 0,
    unlocks: { steps: [], stages: [], rank: 'Chief Engineer' },
    effects: [
      { kind: 'build', targetId: 'observatory', doneMessage: 'The Observatory dome opens and the telescope swings out.' },
      { kind: 'spawn', targetId: 'gems', count: 4 },
      { kind: 'unlock', targetId: 'rank:Chief Engineer', rank: 'Chief Engineer' }
    ],
    lockedMessage: 'The Observatory opens once the engine is tested at the Science Center. This one is extra credit — you never need it to launch.',
    missionText: '★ The Observatory has an extra-hard challenge. You never need it to launch.',
    statusText: 'Optional: take the Chief Engineer Challenge'
  },

  // ---------------------------------------------------------------------------
  // More extra credit: eleven bonus puzzles, one or two at each station, opened
  // once that station's required work is done. Every one carries weight 0 and
  // `optional: true`, so the progress bar and the critical path are untouched -
  // delete the lot and the level still completes. They pay in supplies, which
  // is the other reason they exist: a child who enjoys the puzzles is never
  // short of materials.
  //
  // These are only reachable because of QuestEngine.availableAt(): the "current"
  // step deliberately skips optional work, so a station has to be able to offer
  // its own.
  // ---------------------------------------------------------------------------
  {
    id: 'bonus_pattern', order: 2.3, kind: 'question', label: 'Bonus • Pattern', optional: true,
    title: 'Fuel Gauge Pattern', stationId: 'missionSchool', questionId: 'bonus_pattern',
    requires: ['step_blueprint'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The pressure gauge puzzle is in the blueprint room. Finish the blueprint first.',
    missionText: '★ The gauge in the blueprint room is showing a pattern. Work out the next reading. You never need it to launch.',
    statusText: 'Optional: read the fuel gauge pattern'
  },

  {
    id: 'bonus_place_value', order: 2.4, kind: 'question', label: 'Bonus • Altitudes', optional: true,
    title: 'Which Balloon Flew Higher?', stationId: 'missionSchool', questionId: 'bonus_place_value',
    requires: ['step_blueprint'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The weather logs are kept in the blueprint room. Finish the blueprint first.',
    missionText: '★ Two weather balloons filed their logs at the Mission School. Work out which one flew higher. You never need it to launch.',
    statusText: 'Optional: compare the balloon altitudes'
  },

  {
    id: 'bonus_mass', order: 3.3, kind: 'question', label: 'Bonus • Heavy or Light', optional: true,
    title: 'The Two Blocks', stationId: 'materialsForge', questionId: 'bonus_mass',
    requires: ['step_frame'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The smith is busy with the frame metal. Choose that first.',
    missionText: '★ The smith has two blocks the same size, one iron and one foam. Work out which is heavier. You never need it to launch.',
    statusText: 'Optional: weigh up the two blocks'
  },

  {
    id: 'bonus_volume', order: 5.3, kind: 'question', label: 'Bonus • Tank Volume', optional: true,
    title: 'How Much Does It Hold?', stationId: 'waterLab', questionId: 'bonus_volume',
    requires: ['step_flow'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The new tank is still being filled. Finish the flow test first.',
    missionText: '★ A new test tank arrived at the Water Lab. Work out how much it holds. You never need it to launch.',
    statusText: 'Optional: measure the new tank'
  },

  {
    id: 'bonus_division', order: 5.4, kind: 'question', label: 'Bonus • Sharing Fuel', optional: true,
    title: 'Four Tanks, One Barrel', stationId: 'waterLab', questionId: 'bonus_division',
    requires: ['step_flow'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The fuel barrel is locked until the flow test is done.',
    missionText: '★ There is a barrel of fuel to share between four tanks at the Water Lab. You never need it to launch.',
    statusText: 'Optional: share the fuel between the tanks'
  },

  {
    id: 'bonus_shape', order: 6.3, kind: 'question', label: 'Bonus • Drag', optional: true,
    title: 'Flat On or Edge On?', stationId: 'windTunnel', questionId: 'bonus_shape',
    requires: ['step_drag'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The tunnel is running the nose cone test. Finish that first.',
    missionText: '★ The wind tunnel is free. Try a flat card two ways and see which one slips through the air. You never need it to launch.',
    statusText: 'Optional: test the card in the tunnel'
  },

  {
    id: 'bonus_forces', order: 8.3, kind: 'question', label: 'Bonus • Forces', optional: true,
    title: 'Balanced or Not?', stationId: 'scienceCenter', questionId: 'bonus_forces',
    requires: ['step_thrust'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The force rig is behind the engine cutaway. Test the engine first.',
    missionText: '★ The Science Center has a force rig set up on the pad model. Work out what the two forces are doing. You never need it to launch.',
    statusText: 'Optional: read the force rig'
  },

  {
    id: 'bonus_states', order: 8.4, kind: 'question', label: 'Bonus • States of Matter', optional: true,
    title: 'Liquid to What?', stationId: 'scienceCenter', questionId: 'bonus_states',
    requires: ['step_thrust'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The fuel sample cabinet opens once the engine has been tested.',
    missionText: '★ There is a fuel sample in the cabinet at the Science Center. Work out what happens to it when it burns. You never need it to launch.',
    statusText: 'Optional: study the fuel sample'
  },

  {
    id: 'bonus_ratio', order: 9.3, kind: 'question', label: 'Bonus • Mixing', optional: true,
    title: 'Three To One', stationId: 'fuelDepot', questionId: 'bonus_ratio',
    requires: ['step_fuel'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The mixing rig is in use. Finish the fuel mixture question first.',
    missionText: '★ The Fuel Depot mixing rig needs the right amount of oxidiser. Work it out. You never need it to launch.',
    statusText: 'Optional: set the mixing rig'
  },

  {
    id: 'bonus_angle', order: 10.3, kind: 'question', label: 'Bonus • Turns', optional: true,
    title: 'A Quarter Turn', stationId: 'guidanceTower', questionId: 'bonus_angle',
    requires: ['step_guidance'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The fin rig is locked while the guidance test is running.',
    missionText: '★ The Guidance Tower has a steering fin on a turntable. Work out where a quarter turn points it. You never need it to launch.',
    statusText: 'Optional: turn the steering fin'
  },

  {
    id: 'bonus_gravity', order: 8.6, kind: 'question', label: 'Bonus • Gravity', optional: true,
    title: 'Jumping On The Moon', stationId: 'observatory', questionId: 'bonus_gravity',
    requires: ['step_thrust'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    // No world effects: the reward is the supplies, which the engine banks
    // straight from the question. A bonus puzzle must not move the main chain.
    effects: [],
    lockedMessage: 'The Observatory opens once the engine is tested at the Science Center.',
    missionText: '★ The Observatory telescope is pointed at the Moon. Work out why astronauts can jump so high there. You never need it to launch.',
    statusText: 'Optional: look at the Moon through the telescope'
  },

  {
    id: 'bonus_liftoff_mass', order: 13.3, kind: 'question', label: 'Bonus • Liftoff Mass', optional: true,
    title: 'Mass on the Pad', stationId: 'rocketPad', questionId: 'bonus_liftoff_mass',
    requires: ['step_countdown'], progressWeight: 0,
    unlocks: { steps: [], stages: [] },
    effects: [],
    lockedMessage: 'The pad crew are running the countdown check. Finish that first.',
    missionText: '★ The pad crew want the rocket reweighed before launch. Work out what it masses with five tanks fitted. You never need it to launch.',
    statusText: 'Optional: reweigh the rocket on the pad'
  }
];

/**
 * Seal the chain: fill any missing field with a safe default and freeze it.
 * Doing this once, here, is what makes "missionText is never empty" a
 * structural fact rather than a rule someone has to remember.
 */
function sealChain(raw) {
  return Object.freeze(
    raw.map((authored) => {
      // Level 1: the overlay's shorter words (quests.level1.js), nothing else.
      const l1 = IS_LEVEL1 ? STEP_TEXT_L1[authored.id] : null;
      const node = l1 ? {
        ...authored, ...l1,
        effects: (authored.effects || []).map((e) => (l1.done?.[e.targetId] && e.doneMessage ? { ...e, doneMessage: l1.done[e.targetId] } : e)),
      } : authored;
      delete node.done;
      return Object.freeze({
        ...node,
        requires: Object.freeze(Array.isArray(node.requires) ? node.requires.slice() : []),
        effects: Object.freeze(Array.isArray(node.effects) ? node.effects.map((e) => Object.freeze({ ...e })) : []),
        rewards: Object.freeze(rewardsFor(node)),
        unlocks: Object.freeze({ steps: [], stages: [], ...(node.unlocks || {}) }),
        cost: node.cost ? Object.freeze({ ...node.cost }) : undefined,
        progressWeight: num(node.progressWeight, 0),
        optional: node.optional === true,
        missionText: nonEmpty(node.missionText, MISSION_FALLBACK),
        statusText: nonEmpty(node.statusText, nonEmpty(node.missionText, MISSION_FALLBACK)),
        lockedMessage: nonEmpty(
          node.lockedMessage,
          `Finish the step before this one first, then come back to ${node.label || 'this station'}.`
        )
      });
    })
  );
}

function nonEmpty(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

/** Contract StepNode.rewards — the question's reward, or the stage built. */
function rewardsFor(node) {
  if (node.questionId) {
    const q = getQuestion(node.questionId);
    return q ? { ...q.reward } : {};
  }
  if (node.stageId) {
    const stage = getStage(node.stageId);
    return { stage: node.stageId, rank: node.unlocks && node.unlocks.rank, title: stage ? stage.title : node.title };
  }
  return node.unlocks && node.unlocks.rank ? { rank: node.unlocks.rank } : {};
}

/** The ladder, in `order`. @type {ReadonlyArray<StepNode>} */
export const QUEST_CHAIN = Object.freeze(sealChain(RAW_CHAIN).slice().sort((a, b) => a.order - b.order));

/**
 * How much one collectable crate gives (spec §4.4's "8 nodes × 2" column).
 * The scene places `spawn` effects as node counts; this is the units-per-node so both
 * sides agree on what the economy is worth. Bonus resources come one per node.
 */
export const NODE_YIELD = Object.freeze({
  wood: 2, stone: 2, iron: 2, fuel: 2, circuits: 2, gems: 1, rocketParts: 1
});

const yieldFor = (resource) => count(NODE_YIELD[resource] ?? 1) || 1;

const STEP_BY_ID = Object.fromEntries(QUEST_CHAIN.map((s) => [s.id, s]));
const STEP_BY_QUESTION = Object.fromEntries(
  QUEST_CHAIN.filter((s) => s.questionId).map((s) => [s.questionId, s])
);
const STEP_BY_STAGE = Object.fromEntries(QUEST_CHAIN.filter((s) => s.stageId).map((s) => [s.stageId, s]));

/** Total of the required path. Asserted to be 100 by validateChain(). */
export const TOTAL_WEIGHT = QUEST_CHAIN.reduce((sum, s) => sum + (s.optional ? 0 : s.progressWeight), 0);

/**
 * Static audit of the ladder against the spec's anti-stuck contract (§5.7).
 * Returns a list of problems; an empty list means the ladder is sound. Called
 * by the verification script and cheap enough to call at boot.
 * @returns {string[]}
 */
export function validateChain() {
  const problems = [];
  const ids = new Set(QUEST_CHAIN.map((s) => s.id));

  if (TOTAL_WEIGHT !== 100) problems.push(`required weights sum to ${TOTAL_WEIGHT}, expected 100`);

  for (const step of QUEST_CHAIN) {
    // 5.7.2 — every lockedMessage names an action.
    if (!step.lockedMessage || step.lockedMessage.trim().length < 12) {
      problems.push(`${step.id}: lockedMessage is empty or too short to name an action`);
    }
    // 5.7.1 — missionText is never empty.
    if (!step.missionText || !step.missionText.trim()) problems.push(`${step.id}: missionText is empty`);
    if (!step.statusText || !step.statusText.trim()) problems.push(`${step.id}: statusText is empty`);

    for (const req of step.requires) {
      if (!ids.has(req)) problems.push(`${step.id}: requires unknown step "${req}"`);
      // 5.7.5 — the ★ bonus gates nothing.
      else if (STEP_BY_ID[req].optional) problems.push(`${step.id}: requires the optional step "${req}"`);
      else if (STEP_BY_ID[req].order >= step.order) {
        problems.push(`${step.id}: requires "${req}" which is not earlier in the ladder`);
      }
    }
    if (step.questionId && !getQuestion(step.questionId)) {
      problems.push(`${step.id}: unknown question "${step.questionId}"`);
    }
    if (step.kind === 'build' && !getStage(step.stageId)) problems.push(`${step.id}: unknown stage "${step.stageId}"`);
    if (step.optional && step.progressWeight !== 0) problems.push(`${step.id}: optional step must carry weight 0`);
  }

  // 5.7.4 — the economy cannot run dry: rewards + starter kit + node supply
  // must cover at least twice every sink (spec §4.4).
  const sinks = {};
  for (const stage of ROCKET_STAGES) {
    for (const [k, v] of Object.entries(stage.need)) sinks[k] = count(sinks[k]) + count(v);
  }
  const income = defaultInventory();
  for (const step of QUEST_CHAIN) {
    if (step.optional) continue;
    const res = (step.rewards && step.rewards.resources) || {};
    for (const [k, v] of Object.entries(res)) income[k] = count(income[k]) + count(v);
    for (const effect of step.effects) {
      if (effect.kind === 'spawn') {
        // `count` is UNITS of the resource, not a number of nodes. Multiplying
        // by yieldFor() here read `count: 10` iron as 20 and hid two real
        // soft-locks (iron 10 vs sink 12, circuits 6 vs sink 8) behind a check
        // that was supposed to catch exactly that. The scene splits units into
        // nodes itself (ceil(count / NODE_YIELD)), so units is the contract.
        income[effect.targetId] = count(income[effect.targetId]) + count(effect.count);
      }
    }
  }
  for (const [k, needed] of Object.entries(sinks)) {
    if (count(income[k]) < needed * 2) {
      problems.push(`economy: ${k} supply ${count(income[k])} < 2 × sink ${needed}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/** Reasons an attempt/build can be refused. Stable strings for the HUD. */
export const REFUSAL = Object.freeze({
  UNKNOWN: 'unknown',
  LOCKED: 'locked',
  DONE: 'already-complete',
  WRONG: 'wrong-answer',
  RESOURCES: 'missing-resources'
});

/**
 * The quest engine. Implements contracts.js QuestEngine plus the build/launch
 * actions and the HUD text helpers the spec's §5 asks for.
 *
 * It owns no scene objects and no DOM. It mutates exactly one thing — the save
 * state object handed to it — and announces everything else through effects.
 *
 * @implements {import('./contracts.js').QuestEngine}
 */
export class QuestEngine {
  /**
   * @param {object} [save]  a save object (any shape; it is normalised)
   */
  constructor(save) {
    /** @type {object} live save state; main.js may hold the same reference */
    this.state = normalizeSave(save);
    /** @type {((e: WorldEffect) => void)[]} */
    this._listeners = [];
    /** Warnings from the anti-stuck fallbacks. Surfaced, never printed. */
    this.warnings = [];
    this._peakPercent = 0;
    this._peakPercent = this.progressPercent();
  }

  // --- contract -----------------------------------------------------------

  /**
   * The single active step (spec §5.7.1). Returns the lowest-`order` reachable
   * incomplete required step. If nothing is reachable — which should be
   * impossible — it falls back to the lowest-order incomplete step anyway and
   * records a warning, because handing the child a blank mission card is the
   * one failure mode this level cannot have.
   * @returns {StepNode|null} null only once the launch step is complete
   */
  current() {
    const incomplete = QUEST_CHAIN.filter((s) => !s.optional && !this.isComplete(s.id));
    if (incomplete.length === 0) return null;

    const reachable = incomplete.filter((s) => this._requirementsMet(s));
    if (reachable.length > 0) return reachable[0]; // QUEST_CHAIN is order-sorted

    this.warnings.push(`no reachable step; fell back to ${incomplete[0].id}`);
    return incomplete[0];
  }

  /**
   * The step this station can actually offer right now.
   *
   * `current()` deliberately ignores optional steps, so anything marked
   * `optional` could never BE the current step - and the scene only opened a
   * question when the current step's station matched the one she was standing
   * at. Between them, the ★ bonus challenge was unreachable: the Observatory
   * would open, chime, and then refuse to ask its question. Every bonus puzzle
   * added since would have had the same problem.
   *
   * Required work always wins over extra credit, so a child following the
   * mission card is never diverted; a bonus is only offered once the station
   * has nothing compulsory left.
   *
   * @param {string} stationId
   * @returns {object|null}
   */
  availableAt(stationId) {
    if (!stationId) return null;
    const here = QUEST_CHAIN.filter((s) =>
      s.stationId === stationId && !this.isComplete(s.id) && this._requirementsMet(s));
    if (here.length === 0) return null;
    return here.find((s) => !s.optional) || here[0];
  }

  /**
   * @param {string} id  a step id, a question id or a stage id
   * @returns {boolean}
   */
  isComplete(id) {
    if (typeof id !== 'string' || !id) return false;
    if (this.state.completedSteps.includes(id)) return true;
    if (this.state.completedQuests.includes(id)) return true;
    if (this.state.builtStages.includes(id)) return true;
    return false;
  }

  /**
   * @param {string} id  step id (question and stage ids also resolve)
   * @returns {StepNode|null}
   */
  get(id) {
    if (typeof id !== 'string') return null;
    return STEP_BY_ID[id] || STEP_BY_QUESTION[id] || STEP_BY_STAGE[id] || null;
  }

  /**
   * Answer a question. Returns true only if the question is reachable AND the
   * answer is right. A wrong answer costs nothing and the station stays open —
   * that is the Level 1/2 behaviour and the spec's §5.7.3 invariant.
   * @param {string} questionId
   * @param {string|number} answer
   * @returns {boolean}
   */
  answer(questionId, answer) {
    return this.attempt(questionId, answer).ok;
  }

  /**
   * Weighted progress, 0..100, capped at 99 until the rocket actually flies.
   * Monotonic: it never goes backwards, even when a build spends the resources
   * that were counting towards it.
   * @returns {number}
   */
  progressPercent() {
    let pct = 0;
    for (const step of QUEST_CHAIN) {
      if (step.optional) continue;                    // ★ carries weight 0 anyway
      if (this.isComplete(step.id)) pct += step.progressWeight;
    }

    // A build in progress counts its partly-collected resources, like L1's
    // resPart — so walking around picking up iron visibly moves the bar.
    const active = this.current();
    if (active && active.kind === 'build' && active.cost) {
      pct += active.progressWeight * this._fillFraction(active.cost);
    }

    const cap = this.state.launched ? 100 : 99;
    pct = Math.max(0, Math.min(cap, Math.round(num(pct, 0))));

    // Monotonic by construction: spending resources on a build must never make
    // the bar go backwards, or the child reads it as losing progress.
    this._peakPercent = Math.max(num(this._peakPercent, 0), pct);
    return this._peakPercent;
  }

  /**
   * Subscribe to world effects. The scene layer uses this; the engine never
   * touches a mesh.
   * @param {(e: WorldEffect) => void} fn
   * @returns {() => void} unsubscribe
   */
  onEffect(fn) {
    if (typeof fn !== 'function') return () => {};
    this._listeners.push(fn);
    return () => {
      const i = this._listeners.indexOf(fn);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  // --- actions ------------------------------------------------------------

  /**
   * The full-detail version of answer(), for the HUD.
   * @param {string} questionId
   * @param {string|number} given
   * @returns {{ok: boolean, reason: string, message: string, step: StepNode|null,
   *            question: object|null, rewards?: object, attempts?: number}}
   */
  attempt(questionId, given) {
    const question = getQuestion(questionId);
    const step = STEP_BY_QUESTION[questionId] || null;
    if (!question || !step) {
      return { ok: false, reason: REFUSAL.UNKNOWN, message: 'That station has nothing to ask right now.', step: null, question: null };
    }
    if (this.isComplete(step.id)) {
      return { ok: false, reason: REFUSAL.DONE, message: question.success, step, question };
    }
    if (!this._requirementsMet(step)) {
      // Refused, not failed: nothing is recorded, nothing is spent.
      return { ok: false, reason: REFUSAL.LOCKED, message: step.lockedMessage, step, question };
    }
    if (!checkAnswer(question, given)) {
      const attempts = count(this.state.attempts[questionId]) + 1;
      this.state.attempts[questionId] = attempts;
      return { ok: false, reason: REFUSAL.WRONG, message: wrongAnswerMessage(question, attempts), step, question, attempts };
    }

    const rewards = this._completeStep(step);
    return { ok: true, reason: 'solved', message: question.success, step, question, rewards };
  }

  /**
   * Attempt a build step. Prerequisites are checked before cost, so the refusal
   * always names the *first* thing to fix rather than the money.
   * @param {string} stepOrStageId
   * @returns {{ok: boolean, reason: string, message: string, step: StepNode|null,
   *            missing?: Object<string, number>, rewards?: object}}
   */
  build(stepOrStageId) {
    const step = this.get(stepOrStageId);
    if (!step || (step.kind !== 'build' && step.kind !== 'launch')) {
      return { ok: false, reason: REFUSAL.UNKNOWN, message: 'There is nothing to build here yet.', step: null };
    }
    if (this.isComplete(step.id)) {
      return { ok: false, reason: REFUSAL.DONE, message: 'That part of the rocket is already built.', step };
    }
    if (!this._requirementsMet(step)) {
      return { ok: false, reason: REFUSAL.LOCKED, message: step.lockedMessage, step };
    }
    if (step.cost && !canPay(this.state.inventory, step.cost)) {
      const missing = missingFor(this.state.inventory, step.cost);
      return { ok: false, reason: REFUSAL.RESOURCES, message: shortfallMessage(missing), step, missing };
    }
    if (step.cost) pay(this.state.inventory, step.cost);

    const rewards = this._completeStep(step);
    const stage = getStage(step.stageId);
    return { ok: true, reason: 'built', message: stage ? stage.builtMessage : 'Built.', step, rewards };
  }

  /**
   * Press LAUNCH. Separate from build() only so main.js reads clearly.
   * @returns {{ok: boolean, reason: string, message: string, step: StepNode|null}}
   */
  launch() {
    const result = this.build('step_launch');
    if (result.ok) {
      this.state.launched = true;
      result.message = 'Liftoff! You are a Rocket Scientist.';
    } else if (result.reason === REFUSAL.DONE) {
      // The generic "already built" is about rocket parts and reads as a bug
      // when it answers a launch button.
      result.message = 'This rocket has already flown. Start a new game to fly again.';
    }
    return result;
  }

  /**
   * Record a collected resource. Exported through the engine so main.js has a
   * NaN-proof path — `inventory[k] += 1` on an unknown key is the bug that
   * bricked canPay(), and it cannot happen through here.
   * @param {string} key
   * @param {number} [amount]
   * @returns {{key: string, amount: number, total: number, message: string}}
   */
  collect(key, amount = 1) {
    const added = Math.max(0, Math.floor(num(amount, 0)));
    const total = addResource(this.state.inventory, key, added);
    return { key, amount: added, total, message: `Collected ${added} ${key}. You now have ${total} ${key}.` };
  }

  // --- HUD surfaces (spec §5) --------------------------------------------

  /** `"<pct>% — <the single next action>"`. Never names two actions. */
  statusLine() {
    const pct = this.progressPercent();
    const active = this.current();
    if (!active) return `${pct}% — Rocket launched — you are a Rocket Scientist!`;
    return `${pct}% — ${active.statusText}`;
  }

  /**
   * The mission card, at most 3 lines after the goal (spec §5.3).
   * @returns {{goal: string, now: string, blocked: string|null, bonus: string|null, lines: string[]}}
   */
  missionCard() {
    const active = this.current();
    const now = active ? active.missionText : 'The rocket flew. Open the end card to see how high it got.';
    let blocked = null;
    if (active && active.kind === 'build' && active.cost && !canPay(this.state.inventory, active.cost)) {
      blocked = shortfallMessage(missingFor(this.state.inventory, active.cost));
    }
    const bonusStep = STEP_BY_ID.step_chief;
    const bonus =
      bonusStep && !this.isComplete(bonusStep.id) && this._requirementsMet(bonusStep)
        ? (IS_LEVEL1 ? BONUS_LINE_L1 : '★ Bonus: an extra-hard puzzle at the Observatory.')
        : null;

    const lines = [now, blocked, bonus].filter(Boolean).slice(0, 3);
    return { goal: 'Build the rocket and launch it.', now, blocked, bonus, lines };
  }

  /**
   * One pill per step, in order, plus the ★ pill (spec §5.4).
   * @returns {{id: string, label: string, state: 'done'|'active'|'locked'|'open', optional: boolean}[]}
   */
  badges() {
    const activeId = (this.current() || {}).id;
    return QUEST_CHAIN.map((step) => ({
      id: step.id,
      label: step.label,
      optional: step.optional,
      state: this.isComplete(step.id)
        ? 'done'
        : step.id === activeId
          ? 'active'
          : this._requirementsMet(step)
            ? 'open'
            : 'locked'
    }));
  }

  /**
   * What a station says when the child walks into it. Never a bare "locked".
   * @param {string} stationId
   * @returns {string}
   */
  stationMessage(stationId) {
    const steps = QUEST_CHAIN.filter((s) => s.stationId === stationId && !this.isComplete(s.id));
    if (steps.length === 0) return 'All done here. Check the Mission card for what is next.';
    const open = steps.find((s) => this._requirementsMet(s));
    return open ? open.missionText : steps[0].lockedMessage;
  }

  /** Parent Hints panel content: only what the child has already reached. */
  reachedQuestionIds() {
    return QUEST_CHAIN.filter((s) => s.questionId && (this.isComplete(s.id) || this._requirementsMet(s)))
      .map((s) => s.questionId);
  }

  /**
   * Anti-stuck safety net (spec §4.4 respawn rule). If the active step is a
   * build, the child is short, and the world has no nodes of that resource
   * left, ask for a supply drop. The engine decides; the scene places the crates.
   * @param {Object<string, number>} remainingNodeCounts  resource -> nodes left in world
   * @returns {{resource: string, count: number, message: string}[]}
   */
  supplyDrops(remainingNodeCounts = {}) {
    const active = this.current();
    if (!active || active.kind !== 'build' || !active.cost) return [];
    const drops = [];
    for (const key of Object.keys(missingFor(this.state.inventory, active.cost))) {
      if (count(remainingNodeCounts[key]) > 0) continue;
      drops.push({
        resource: key,
        count: 3,
        message: 'A supply drop landed nearby — look for the crates on the path.'
      });
      this._emit({ kind: 'spawn', targetId: key, count: 3 });
    }
    return drops;
  }

  /** The save slice, ready for saveGame(). */
  serialize() {
    return structuredCopy(this.state);
  }

  // --- internals ----------------------------------------------------------

  _requirementsMet(step) {
    return step.requires.every((id) => this.isComplete(id));
  }

  _fillFraction(cost) {
    let need = 0;
    let have = 0;
    for (const key of Object.keys(cost)) {
      const required = count(cost[key]);
      need += required;
      have += Math.min(required, count(this.state.inventory[key]));
    }
    if (need <= 0) return 0;
    const fraction = have / need;
    return Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  }

  /** Mark done, bank the rewards, promote the rank, emit the world effects. */
  _completeStep(step) {
    if (!this.state.completedSteps.includes(step.id)) this.state.completedSteps.push(step.id);
    if (step.questionId && !this.state.completedQuests.includes(step.questionId)) {
      this.state.completedQuests.push(step.questionId);
    }
    if (step.stageId && !this.state.builtStages.includes(step.stageId)) {
      this.state.builtStages.push(step.stageId);
    }
    if (step.kind === 'launch') this.state.launched = true;

    const rewards = step.rewards || {};
    this.state.xp = count(this.state.xp) + count(rewards.xp);
    const gained = addResources(this.state.inventory, rewards.resources);
    if (rewards.part && !this.state.unlockedParts.includes(rewards.part)) {
      this.state.unlockedParts.push(rewards.part);
    }

    // Rank only ever goes up: the ★ shortcut awards Chief Engineer early, and
    // finishing Step 9b afterwards must not demote the child to Flight Engineer.
    const newRank = rewards.rank || (step.unlocks && step.unlocks.rank);
    let rankedUp = false;
    if (newRank && rankIndex(newRank) > rankIndex(this.state.rank)) {
      this.state.rank = newRank;
      rankedUp = true;
    }

    for (const effect of step.effects) this._emit(effect);
    this.progressPercent(); // refresh the monotonic high-water mark

    return { ...rewards, gained, rankedUp, rank: this.state.rank, xp: this.state.xp };
  }

  _emit(effect) {
    for (const fn of this._listeners.slice()) {
      try {
        fn(effect);
      } catch {
        // A subscriber that throws must not stop the rest of the world from
        // updating — a half-applied unlock is exactly how a level soft-locks.
      }
    }
  }
}

/**
 * "You need 4 more iron and 2 more wood." Always says how much and of what,
 * because "not enough resources" is not an action (spec §5.5).
 * @param {Object<string, number>} missing
 * @returns {string}
 */
export function shortfallMessage(missing) {
  const parts = Object.entries(missing || {}).map(([k, v]) => `${count(v)} more ${k}`);
  if (parts.length === 0) return 'You have everything you need — build it!';
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Not enough yet — you need ${list}. Crates are along the path to the pad.`;
}

/**
 * Build an engine over a freshly loaded save. This is the one-line entry point
 * main.js needs.
 * @param {object} [save]  omit to load from localStorage
 * @returns {QuestEngine}
 */
export function createQuestEngine(save) {
  return new QuestEngine(save === undefined ? loadSave() : save);
}

export default {
  QUEST_CHAIN,
  ROCKET_STAGES,
  NODE_YIELD,
  QuestEngine,
  createQuestEngine,
  STORE_KEY,
  loadSave,
  saveGame,
  mergeSave,
  normalizeSave,
  migrateFromV1,
  canPay,
  pay,
  addResource,
  addResources,
  validateChain
};
