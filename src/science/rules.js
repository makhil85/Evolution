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
  1: 'Welcome! Solve the 3 purple puzzle boards. Or solve the gold key puzzle.',
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
  /** Level 4 wording, or the Level 1 one (short, for a 2nd grader). */
  const L = (l4, l1) => (lvl === 1 ? l1 : l4);

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
  const HUNT_TEXT = 'The Science Center needs its Golden Core. Press the 📜 Clue button to read the clues.';
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
      return { refused: true, text: say(L('This rich iron is locked inside the room. Solve the golden hard key puzzle to open it.', 'This iron is locked. Solve the gold key puzzle to open it.')) };
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
          ? 'All 3 puzzles done! Cheap plan: Wood 12, Stone 24, Iron 60, Science 12.'
          : 'Smart path complete! Efficient recipe revealed. Iron target uses the plan: 2 × (wood + science) + stone = 84.';
      } else {
        text = `${question.success} You also gained +${science} science.`;
      }
    } else if (q === 'key') {
      state.key = true;
      state.recipeMode = 'brute';
      text = lvl === 1
        ? `${question.success} The big plan is open.`
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
    const mode = state.recipeMode === 'smart' ? L('Smart efficient recipe', 'Cheap plan')
      : state.recipeMode === 'brute' ? L('Brute-force recipe', 'Big plan') : L('Recipe locked', 'Plan locked');
    if (state.recipeMode === 'unknown') {
      return `${mode}: ${L('Solve all 3 purple boards for efficient numbers, or solve the golden key puzzle to open the iron room.', 'Solve the 3 purple boards or the gold key.')}`;
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
      return { ok: false, text: L('Science Center is already built. Use the Level 2 link when the next file is ready.', 'The Science Center is built! Go back to the chapters for Chapter 2.'), missing: [] };
    }
    if (huntRequired && !state.huntFound) return { ok: false, text: HUNT_TEXT, missing: [] };
    if (state.recipeMode === 'unknown') {
      return {
        ok: false,
        text: L('The builders need a plan first. Solve 3 purple medium puzzles for the efficient plan, or solve the hard golden key puzzle for brute force.',
          'The builders need a plan. Solve the 3 purple puzzles or the gold key.'),
        missing: [],
      };
    }
    if (!state.solved.force) {
      return { ok: false, text: L('Visit the Force Lab before building. A Science Center needs basic motion intuition.', 'Visit the Force Lab first. Learn how a push makes things move.'), missing: [] };
    }
    if (!state.solved.energy) {
      return {
        ok: false,
        text: lvl === 1
          ? 'Visit the Light & Plants Lab first. Learn what plants need to grow.'
          : 'Visit the Chemical Energy Lab before building. This prepares the rocket levels later.',
        missing: [],
      };
    }
    const r = recipe();
    const missing = [];
    for (const k of RESOURCE_KEYS) if (state.resources[k] < r[k]) missing.push(`${k}: need ${r[k] - state.resources[k]} more`);
    if (missing.length) return { ok: false, text: `${L('Not enough resources yet.', 'You need more.')} ${missing.join('; ')}`, missing };
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
    if (state.recipeMode === 'unknown') status = L('Choose smart path or hard key path', 'Pick: 3 puzzles or hard key');
    else if (!state.solved.force) status = 'Visit Force Lab';
    else if (!state.solved.energy) status = lvl === 1 ? 'Visit Light & Plants Lab' : 'Visit Chemical Energy Lab';
    else status = L('Gather resources and build on purple foundation', 'Get resources, build on purple spot');
    return { pct, status };
  }

  /** The old missionText(). */
  function missionText() {
    if (state.built) return L('Science Center complete! Go back to the chapters for Chapter 2.', 'Science Center done! Go to the chapters for Chapter 2.');
    if (state.recipeMode === 'unknown') return L('Choose: solve the 3 purple boards, or the golden key puzzle.', 'Pick: 3 purple boards or the gold key.');
    if (!state.solved.force) return L('Now pass the Force Lab. Learn that a push or pull changes motion.', 'Now pass the Force Lab.');
    if (!state.solved.energy) {
      return lvl === 1
        ? 'Now pass the Light & Plants Lab.'
        : 'Now pass the Chemical Energy Lab. Learn why future rockets need fuel and oxygen.';
    }
    return L('Collect the resources. Then build on the purple foundation.', 'Get the list. Build on the purple spot.');
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
    nothingNear: L('Move closer to a resource, board, lab, locked room, or foundation.', 'Walk closer to something to use it.'),
    blocked: 'Blocked. Some areas need a key or another path.',
    focusIron: L('The locked iron room is in the north-east. Look for the golden-lock door and solve the hard key puzzle there to open it.', 'Find the gold-lock door, top right. Solve the hard puzzle.'),
    /** The wrong-answer toast: math boards point at the parent hints; no hint for the child (lead 2026-10-09). */
    wrongAnswer: (q) => (MATH_QUESTS.includes(q) || q === 'key'
      ? L('Not quite. Try again, or ask a parent to open the Math Hints tab at the bottom.', 'Not quite. Try again! A grown-up can open Math Hints at the bottom.')
      : L('Not quite. Try again.', 'Not quite. Try again!')),
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
