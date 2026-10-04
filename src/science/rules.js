// Chapter 1 "Science Village": the game rules, pure logic (no DOM, no THREE).
//
// This is the old single-file game's state machine (docs/legacy-chapters/level{1,4}/
// chapter1.html: default state, openMath, openKeyPuzzle, openScience, getRecipe,
// attemptBuild, collect, interact's locked-iron check, progress, statusText,
// updateHUD, missionText) lifted out of the drawing code. The save format is the
// old one, so an old save loads here and the launcher still reads `built`, plus
// one new field, `collected: number[]` (pickup ids already taken), which the old
// game ignores.
//
// Old format: { player:{x,y} (tiles), resources:{wood,stone,iron,science},
// solved:{m1,m2,m3,key,force,energy}, recipeMode:'unknown'|'smart'|'brute',
// key:boolean, built:boolean, message:string }.
//
// The main loop owns the timing: startBuild() spends the recipe and sets
// `built` at once (the launcher's completion flag); the 3-D world then raises
// the SCIENCE_CENTER_PIECES pieces one by one purely as a show.
//
// `storage` is injectable so node can test with an in-memory store.

import {
  STORE_KEYS, RESOURCE_KEYS, RECIPES, QUEST_IDS, SCIENCE_CENTER_PIECES,
} from './contracts.js';
import { START_TILE, PICKUPS } from './layout.js';
import { questionsFor } from './questions.js';

const DEFAULT_MESSAGE = {
  4: 'Welcome! Explore the larger village. Solve math to avoid painful mining, or earn the hard key and brute-force it.',
  1: 'Welcome! Explore the village. Solve 3 medium Grade 1 challenge boards, or solve 1 hard golden key puzzle for the rich iron room.',
};

const MATH_QUESTS = ['m1', 'm2', 'm3'];
const RECIPE_MODES = ['unknown', 'smart', 'brute'];

/** Old collect() labels, by pickup. */
function pickupLabel(p) {
  if (p.type === 'tree') return 'Chopped tree';
  if (p.type === 'stone') return 'Mined stone';
  if (p.type === 'iron') return p.locked ? 'Mined rich locked iron' : 'Mined surface iron';
  return 'Collected science note';
}

const PICKUP_BY_ID = new Map(PICKUPS.map((p) => [p.id, p]));

/** localStorage, or null when the browser refuses it (private mode etc.). */
function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** A tiny in-memory Storage, used when no real one is available. */
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * @param {object} opts
 * @param {1|4}    opts.level
 * @param {Storage} [opts.storage]  defaults to localStorage (in-memory if unavailable)
 */
export function createScienceRules({ level, storage } = {}) {
  const lvl = level === 1 ? 1 : 4;
  const store = storage || browserStorage() || memoryStorage();
  const key = STORE_KEYS[lvl];
  const bank = questionsFor(lvl);
  const recipes = RECIPES[lvl];
  const defaultMessage = DEFAULT_MESSAGE[lvl];

  const freshState = () => ({
    player: { x: START_TILE.tx, y: START_TILE.ty },
    resources: Object.fromEntries(RESOURCE_KEYS.map((r) => [r, 0])),
    solved: Object.fromEntries(QUEST_IDS.map((q) => [q, false])),
    recipeMode: 'unknown',
    key: false,
    built: false,
    message: defaultMessage,
    collected: [],
    huntFound: false,
  });

  /** Read the saved blob, or null (missing / unreadable / not an object). */
  function readSaved() {
    try {
      const raw = store.getItem(key);
      const obj = raw ? JSON.parse(raw) : null;
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  }

  // `state` keeps its identity for the whole session (the main loop holds it),
  // so reset() and the initial load rewrite it in place.
  const state = {};
  function replaceState(next) {
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, next);
  }

  replaceState(freshState());
  const saved = readSaved();
  if (saved) {
    const base = freshState();
    replaceState({
      ...saved,
      player: saved.player && Number.isFinite(Number(saved.player.x)) && Number.isFinite(Number(saved.player.y))
        ? { x: Number(saved.player.x), y: Number(saved.player.y) } : base.player,
      resources: { ...base.resources, ...(saved.resources && typeof saved.resources === 'object' ? saved.resources : {}) },
      solved: { ...base.solved, ...(saved.solved && typeof saved.solved === 'object' ? saved.solved : {}) },
      recipeMode: RECIPE_MODES.includes(saved.recipeMode) ? saved.recipeMode : 'unknown',
      key: !!saved.key,
      built: !!saved.built,
      message: typeof saved.message === 'string' && saved.message ? saved.message : defaultMessage,
      collected: Array.isArray(saved.collected) ? saved.collected.filter((n) => Number.isInteger(n)) : [],
      huntFound: !!saved.huntFound,
    });
  }

  /**
   * Defaults for anything missing, clamped resources, and the key flag and the
   * `solved.key` quest kept in step (the old game always set them together).
   */
  function normalize() {
    const base = freshState();
    for (const r of RESOURCE_KEYS) state.resources[r] = Math.max(0, Math.floor(num(state.resources[r], 0)));
    for (const q of QUEST_IDS) state.solved[q] = !!state.solved[q];
    state.key = !!state.key || !!state.solved.key;
    state.solved.key = state.key;
    if (!RECIPE_MODES.includes(state.recipeMode)) state.recipeMode = 'unknown';
    state.built = !!state.built;
    if (!state.player || !Number.isFinite(state.player.x) || !Number.isFinite(state.player.y)) state.player = base.player;
    if (typeof state.message !== 'string' || !state.message) state.message = defaultMessage;
    if (!Array.isArray(state.collected)) state.collected = [];
    state.huntFound = !!state.huntFound;
    return state;
  }
  normalize();

  function save() {
    try { store.setItem(key, JSON.stringify(state)); } catch { /* storage full or blocked: play on */ }
  }

  function reset() {
    try { store.removeItem(key); } catch { /* ignore */ }
    replaceState(freshState());
    return state;
  }

  /** Remember the latest player-facing line (the old showToast kept it in the save). */
  function say(text) {
    state.message = text;
    return text;
  }

  // --- the treasure hunt (Hard mode) ---------------------------------------------

  // Hard mode needs the Golden Core before the final build. The requirement is
  // a play-mode setting (not saved); `huntFound` is saved with the chapter.
  let huntRequired = false;
  const HUNT_TEXT = 'The Science Center needs its Golden Core. Follow the clues - read them again with the 📜 Clue button.';
  const setHuntRequired = (on) => { huntRequired = !!on; };
  const isHuntRequired = () => huntRequired;
  const huntFound = () => !!state.huntFound;
  function markHuntFound() { state.huntFound = true; save(); }

  // --- pickups --------------------------------------------------------------

  const isCollected = (id) => state.collected.includes(id);

  /**
   * Take pickup `id`. Returns { res, amount, text }; { refused:true, text } for
   * locked rich iron before the key (nothing changes); null if the id is
   * unknown or already taken.
   */
  function collect(id) {
    const p = PICKUP_BY_ID.get(id);
    if (!p || isCollected(id)) return null;
    if (p.locked && !state.key) {
      return { refused: true, text: say('This rich iron is locked inside the room. Solve the golden hard key puzzle to open it.') };
    }
    state.resources[p.res] += p.amount;
    state.collected.push(id);
    const text = say(`${pickupLabel(p)}: +${p.amount} ${p.res}.`);
    save();
    return { res: p.res, amount: p.amount, text };
  }

  // --- quests ---------------------------------------------------------------

  const solvedCount = () => MATH_QUESTS.filter((k) => state.solved[k]).length;

  const ALREADY = {
    m1: 'That puzzle is already solved. Find another board or collect resources.',
    m2: 'That puzzle is already solved. Find another board or collect resources.',
    m3: 'That puzzle is already solved. Find another board or collect resources.',
    key: 'The iron-room key is already unlocked. Enter the room and mine rich iron.',
    force: 'Force lab already passed.',
    energy: lvl === 1 ? 'Light & Plants lab already passed.' : 'Chemical energy lab already passed.',
  };

  /** Ask to open quest `q`. Old wording when it is already solved. */
  function openQuest(q) {
    if (!QUEST_IDS.includes(q)) return { ok: false, text: say('That station has nothing to ask right now.') };
    const done = q === 'key' ? (state.key || state.solved.key) : state.solved[q];
    if (done) return { ok: false, text: say(ALREADY[q]) };
    return { ok: true, question: bank[q] };
  }

  /**
   * The child answered quest `q` correctly: apply the old effects (science
   * reward, solved flag, recipeMode / key changes) and return
   * { reward, text, success, recipeMode, keyUnlocked, allMath }.
   * `text` is the old toast. Returns null if the quest is unknown or already solved.
   */
  function solveQuest(q) {
    if (!QUEST_IDS.includes(q)) return null;
    if (q === 'key' ? (state.key || state.solved.key) : state.solved[q]) return null;
    const question = bank[q];
    const science = question.reward.science;
    state.solved[q] = true;
    state.resources.science += science;
    let text;
    let allMath = false;
    if (MATH_QUESTS.includes(q)) {
      if (MATH_QUESTS.every((k) => state.solved[k])) {
        state.recipeMode = 'smart';
        allMath = true;
        text = lvl === 1
          ? 'Smart path complete! Efficient recipe revealed: Wood 12, Stone 24, Iron 60, Science 12.'
          : 'Smart path complete! Efficient recipe revealed. Iron target uses the plan: 2 × (wood + science) + stone = 84.';
      } else {
        text = `${question.success} You also gained +${science} science.`;
      }
    } else if (q === 'key') {
      state.key = true;
      state.recipeMode = 'brute';
      text = lvl === 1
        ? `${question.success} Brute-force recipe unlocked, but it still needs many resources.`
        : `${question.success} Brute-force recipe unlocked, but it needs many more resources.`;
    } else {
      text = `${question.success} +${science} science.`;
    }
    say(text);
    save();
    return {
      reward: { ...question.reward },
      text,
      success: question.success,
      recipeMode: state.recipeMode,
      keyUnlocked: state.key,
      allMath,
    };
  }

  // --- the recipe and the build -------------------------------------------------

  /** The old getRecipe(): smart, or brute (also while the plan is still unknown). */
  function recipe() {
    return { ...(state.recipeMode === 'smart' ? recipes.smart : recipes.brute) };
  }

  /** The old HUD recipe box as one line: the mode name, then what to do / what is needed. */
  function recipeText() {
    const mode = state.recipeMode === 'smart' ? 'Smart efficient recipe'
      : state.recipeMode === 'brute' ? 'Brute-force recipe' : 'Recipe locked';
    if (state.recipeMode === 'unknown') {
      return `${mode}: Solve all 3 purple boards for efficient numbers, or solve the golden key puzzle to open the iron room.`;
    }
    const r = recipe();
    return `${mode}: Need: Wood ${r.wood}, Stone ${r.stone}, Iron ${r.iron}, Science ${r.science}.`;
  }

  /**
   * Can she build the Science Center? { ok, text, missing }. Old order: already
   * built, plan chosen, Force Lab, Energy Lab, resources. `text` is the old
   * refusal (empty when ok); `missing` lists "wood: need 3 more" style entries.
   * Changes nothing except the remembered message.
   */
  function buildCheck() {
    if (state.built) {
      return { ok: false, text: 'Science Center is already built. Use the Level 2 link when the next file is ready.', missing: [] };
    }
    if (huntRequired && !state.huntFound) return { ok: false, text: HUNT_TEXT, missing: [] };
    if (state.recipeMode === 'unknown') {
      return {
        ok: false,
        text: 'The builders need a plan first. Solve 3 purple medium puzzles for the efficient plan, or solve the hard golden key puzzle for brute force.',
        missing: [],
      };
    }
    if (!state.solved.force) {
      return { ok: false, text: 'Visit the Force Lab before building. A Science Center needs basic motion intuition.', missing: [] };
    }
    if (!state.solved.energy) {
      return {
        ok: false,
        text: lvl === 1
          ? 'Visit the Light & Plants Lab before building. A Science Center needs living-science knowledge.'
          : 'Visit the Chemical Energy Lab before building. This prepares the rocket levels later.',
        missing: [],
      };
    }
    const r = recipe();
    const missing = [];
    for (const k of RESOURCE_KEYS) if (state.resources[k] < r[k]) missing.push(`${k}: need ${r[k] - state.resources[k]} more`);
    if (missing.length) return { ok: false, text: `Not enough resources yet. ${missing.join('; ')}`, missing };
    return { ok: true, text: '', missing: [] };
  }

  /**
   * Build: spend the recipe and set `built` (what the launcher reads). Returns
   * { ok:false, text, missing } when refused, else { ok:true, text, missing:[],
   * pieces: SCIENCE_CENTER_PIECES }. The 3-D world raises the pieces as a show.
   */
  function startBuild() {
    const check = buildCheck();
    if (!check.ok) { say(check.text); return check; }
    const r = recipe();
    for (const k of RESOURCE_KEYS) state.resources[k] -= r[k];
    state.built = true;
    const text = say('Success! You built the Science Center. Chapter 2 is open!');
    save();
    return { ok: true, text, missing: [], pieces: SCIENCE_CENTER_PIECES };
  }

  // --- HUD text ---------------------------------------------------------------

  /** The old progress bar: { pct, status }; status is the text after "NN% — ". */
  function progress() {
    if (state.built) return { pct: 100, status: 'Science Center built' };
    const r = recipe();
    let p = 8; // explored
    p += solvedCount() * 8;
    if (state.key) p += 18;
    if (state.recipeMode !== 'unknown') p += 12;
    if (state.solved.force) p += 8;
    if (state.solved.energy) p += 9;
    const resPart = RESOURCE_KEYS.reduce((sum, k) => sum + Math.min(1, state.resources[k] / r[k]), 0) / RESOURCE_KEYS.length;
    p += Math.round(resPart * 32);
    const pct = Math.min(99, p);
    let status;
    if (state.recipeMode === 'unknown') status = 'Choose smart path or hard key path';
    else if (!state.solved.force) status = 'Visit Force Lab';
    else if (!state.solved.energy) status = lvl === 1 ? 'Visit Light & Plants Lab' : 'Visit Chemical Energy Lab';
    else status = 'Gather resources and build on purple foundation';
    return { pct, status };
  }

  /** The old missionText(). */
  function missionText() {
    if (state.built) return 'Science Center complete! Chapter 2 is open: go back to the chapters to play it.';
    if (state.recipeMode === 'unknown') return 'Choose a path: solve the 3 purple boards for a cheaper plan, or the golden key puzzle to open the iron room.';
    if (!state.solved.force) return 'Now pass the Force Lab. Learn that a push or pull changes motion.';
    if (!state.solved.energy) {
      return lvl === 1
        ? 'Now pass the Light & Plants Lab. Learn that plants need light to grow.'
        : 'Now pass the Chemical Energy Lab. Learn why future rockets need fuel and oxygen.';
    }
    return 'Collect the recipe resources, then stand on the purple foundation and press E to build the Science Center.';
  }

  /** Mission card lines: the old mission text, then the recipe once a plan is chosen. Never empty. */
  function missionLines() {
    const lines = [missionText()];
    if (!state.built && state.recipeMode !== 'unknown') lines.push(recipeText());
    return lines;
  }

  /** The old badge strip: [{ label, done }] in the old order. */
  function badges() {
    return [
      { label: 'Puzzle 1', done: !!state.solved.m1 },
      { label: 'Puzzle 2', done: !!state.solved.m2 },
      { label: 'Puzzle 3', done: !!state.solved.m3 },
      { label: 'Key', done: !!state.key },
      { label: 'Force', done: !!state.solved.force },
      { label: 'Energy', done: !!state.solved.energy },
      { label: 'Built', done: !!state.built },
    ];
  }

  /** Old one-off lines for the main loop (interaction and movement toasts). */
  const text = {
    welcome: defaultMessage,
    nothingNear: 'Move closer to a resource, board, lab, locked room, or foundation.',
    blocked: 'Blocked. Some areas need a key or another path.',
    focusMath: 'Purple boards are in the village square. Stand near a board and press Space.',
    focusIron: 'The locked iron room is in the north-east. Look for the golden-lock door and solve the hard key puzzle there to open it.',
    /** The old wrong-answer toast: math boards point at the parent hints, labs show the hint. */
    wrongAnswer: (q) => (MATH_QUESTS.includes(q) || q === 'key'
      ? 'Not quite. Try again, or ask a parent to open the Math Hints tab at the bottom.'
      : `Not quite. ${bank[q]?.hint || ''}`.trim()),
  };

  return {
    level: lvl,
    state,
    questions: bank,
    save,
    reset,
    normalize,
    say,
    isCollected,
    setHuntRequired,
    isHuntRequired,
    huntFound,
    markHuntFound,
    collect,
    openQuest,
    solveQuest,
    solvedCount,
    recipe,
    recipeText,
    buildCheck,
    startBuild,
    progress,
    missionLines,
    badges,
    text,
  };
}
