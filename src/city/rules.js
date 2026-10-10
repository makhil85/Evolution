// Chapter 2 "Forces and Machines" (was "City Engineering"): the game rules, pure logic (no DOM, no THREE).
//
// This is the old single-file game's state machine (docs/legacy-chapters/level{1,4}/
// chapter2.html: defaultState, normalizeLoadedState, mediumSolvedCount,
// bridgeUnlocked, questStructureBuilt, openQuest, attemptBuildWorkshop,
// updateHUD) lifted out of the drawing code. The save format is the old one,
// so an old save loads here and the launcher still reads `builtFinal`, plus one
// new field, `collected: number[]` (pickup ids already taken), which the old
// game ignores.
//
// The main loop owns the timing: solveQuest() adds the reward and marks the
// quest solved but does NOT touch `built`; the loop raises the pieces one by
// one (PIECE_INTERVAL_MS apart) and calls setBuilt(target, n) for each.
//
// `storage` is injectable so node can test with an in-memory store.

import {
  STORE_KEYS, RESOURCE_KEYS, RECIPE, QUEST_TO_BUILD, MAX_PIECES, QUEST_IDS, MEDIUM_QUESTS,
} from './contracts.js';
import { START_TILE, PICKUPS } from './layout.js';
import { questionsFor } from './questions.js';

const DEFAULT_MESSAGES = {
  4: 'Solve any 3 medium quests or the hard problem. Then the golden bridge lock at the moat opens. The bridge puzzle builds 5 planks.',
  1: 'Solve 3 puzzles to open the bridge. Then the gold lock at the moat opens.',
};

/** Old collect() labels, by pickup type. */
const PICKUP_LABEL = {
  woodCrate: 'Collected construction wood',
  stoneBlock: 'Collected stone blocks',
  metalScrap: 'Collected metal scrap',
  energyCell: 'Collected energy cell',
  blueprint: 'Collected blueprint page',
};

const PICKUP_BY_ID = new Map(PICKUPS.map((p) => [p.id, p]));

/** Old badge labels, in the old order (solar / magnet only at Level 4). */
const BADGE_LABELS = [
  ['bridge', 'Bridge'],
  ['water', 'Water Pump'],
  ['gear', 'Machine Shop'],
  ['power', 'Power Station'],
  ['tile', 'STEM Academy'],
  ['solar', 'Solar Lab'],
  ['magnet', 'Magnet Lab'],
  ['key', 'Hard Route'],
];

/** Names used in the "next puzzle" mission lines: the quest titles at each Level. */
const MEDIUM_OPTION_TEXT = {
  1: {
    water: 'Water Wheel Drops',
    gear: 'Five Gears',
    power: 'Light the Bulb',
    tile: 'Shape Grid',
  },
  4: {
    water: 'Water Tower Pattern',
    gear: 'Gear Tooth Pattern',
    power: 'Fair Battery Test',
    tile: 'Shortest Path Count',
    solar: 'Solar Shadow Lab',
    magnet: 'Magnet Material Sort',
  },
};

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
export function createCityRules({ level, storage } = {}) {
  const lvl = level === 1 ? 1 : 4;
  /** Level 4 wording, or the Level 1 one (short, for a 2nd grader). */
  const L = (l4, l1) => (lvl === 1 ? l1 : l4);
  const DEFAULT_MESSAGE = DEFAULT_MESSAGES[lvl];
  const store = storage || browserStorage() || memoryStorage();
  const key = STORE_KEYS[lvl];
  const questIds = QUEST_IDS[lvl];
  const mediums = MEDIUM_QUESTS[lvl];
  const bank = questionsFor(lvl);
  const buildTargets = [...new Set(questIds.map((q) => QUEST_TO_BUILD[q]))].concat('workshop');

  const freshState = () => ({
    player: { x: START_TILE.tx, y: START_TILE.ty },
    playerName: '',
    characterId: null,
    resources: Object.fromEntries(RESOURCE_KEYS.map((r) => [r, 0])),
    solved: Object.fromEntries(questIds.map((q) => [q, false])),
    built: Object.fromEntries(buildTargets.map((t) => [t, 0])),
    builtFinal: false,
    message: DEFAULT_MESSAGE,
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
      playerName: typeof saved.playerName === 'string' ? saved.playerName : '',
      characterId: saved.characterId ?? null,
      resources: { ...base.resources, ...(saved.resources || {}) },
      solved: { ...base.solved, ...(saved.solved || {}) },
      built: { ...base.built, ...(saved.built || {}) },
      builtFinal: !!saved.builtFinal,
      message: typeof saved.message === 'string' && saved.message ? saved.message : DEFAULT_MESSAGE,
      collected: Array.isArray(saved.collected) ? saved.collected.filter((n) => Number.isInteger(n)) : [],
      huntFound: !!saved.huntFound,
    });
  }

  /**
   * The old normalizeLoadedState, plus defaults for anything missing: a solved
   * quest means its structure stands at full height; builtFinal means the
   * workshop does. Also clamps resources and pieces to sane whole numbers.
   */
  function normalize() {
    const base = freshState();
    for (const r of RESOURCE_KEYS) state.resources[r] = Math.max(0, Math.floor(num(state.resources[r], 0)));
    for (const q of questIds) state.solved[q] = !!state.solved[q];
    for (const t of buildTargets) {
      state.built[t] = Math.min(MAX_PIECES[t], Math.max(0, Math.floor(num(state.built[t], 0))));
    }
    for (const q of questIds) {
      const t = QUEST_TO_BUILD[q];
      if (state.solved[q] && state.built[t] < MAX_PIECES[t]) state.built[t] = MAX_PIECES[t];
    }
    if (state.builtFinal && state.built.workshop < MAX_PIECES.workshop) state.built.workshop = MAX_PIECES.workshop;
    if (!state.player || !Number.isFinite(state.player.x) || !Number.isFinite(state.player.y)) state.player = base.player;
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

  // --- rules ---------------------------------------------------------------

  const mediumSolvedCount = () => mediums.filter((k) => state.solved[k]).length;
  const bridgeUnlocked = () => !!state.solved.key || mediumSolvedCount() >= 3;
  const bridgeBuilt = () => state.built.bridge >= MAX_PIECES.bridge;
  function questStructureBuilt(q) {
    const t = QUEST_TO_BUILD[q];
    return !!(state.solved[q] && t && state.built[t] >= MAX_PIECES[t]);
  }

  // --- the treasure hunt (Hard mode) ---------------------------------------------

  // Hard mode needs the Master Gear before the final build. The requirement is
  // a play-mode setting (not saved); `huntFound` is saved with the chapter.
  let huntRequired = false;
  const HUNT_TEXT = L('The Workshop needs its Master Gear. Follow the clues - read them again with the 📜 Clue button.', 'The Workshop needs its Master Gear. Press the 📜 Clue button to read the clues.');
  const setHuntRequired = (on) => { huntRequired = !!on; };
  const isHuntRequired = () => huntRequired;
  const huntFound = () => !!state.huntFound;
  function markHuntFound() { state.huntFound = true; save(); }

  // --- pickups --------------------------------------------------------------

  const isCollected = (id) => state.collected.includes(id);

  /** Take pickup `id`. Returns { res, amount, text }, or null if unknown / already taken. */
  function collect(id) {
    const p = PICKUP_BY_ID.get(id);
    if (!p || isCollected(id)) return null;
    state.resources[p.res] += p.amount;
    state.collected.push(id);
    const text = say(`${L(PICKUP_LABEL[p.type], PICKUP_LABEL[p.type].replace('construction ', ''))}: +${p.amount} ${p.res}.`);
    save();
    return { res: p.res, amount: p.amount, text };
  }

  // --- quests ---------------------------------------------------------------

  /** Ask to open quest `q`. Old wording when it is refused. */
  function openQuest(q) {
    if (!questIds.includes(q)) return { ok: false, text: say('That station has nothing to ask right now.') };
    if (state.solved[q]) {
      return { ok: false, text: say(L('That quest is already solved. Its control console has been removed from the map.', 'You already solved that one!')) };
    }
    if (q === 'bridge' && !bridgeUnlocked()) {
      return {
        ok: false,
        text: say(lvl === 1
          ? 'The gold lock is closed. Solve 3 puzzles to open it.'
          : 'The single golden bridge lock is still closed. Solve the hard Olympiad problem or any 3 medium Olympiad quests first.'),
      };
    }
    return { ok: true, question: bank[q] };
  }

  /**
   * The child answered quest `q` correctly: add the reward and mark it solved.
   * Does NOT set `built` (the main loop raises the pieces and calls setBuilt).
   * Returns null if the quest is unknown, already solved, or still locked.
   *
   * `text` is the old toast (success line + "Watch the city change piece by
   * piece."); `success` is the bare success line; `doneMessage` is what to show
   * when the last piece is up.
   */
  function solveQuest(q) {
    if (!questIds.includes(q) || state.solved[q]) return null;
    if (q === 'bridge' && !bridgeUnlocked()) return null;
    const question = bank[q];
    state.solved[q] = true;
    for (const [r, v] of Object.entries(question.reward || {})) state.resources[r] += v;
    const target = QUEST_TO_BUILD[q];
    const text = say(`${question.success} Watch the city change piece by piece.`);
    save();
    return {
      reward: { ...question.reward },
      target,
      pieces: MAX_PIECES[target],
      success: question.success,
      text,
      doneMessage: question.doneMessage || 'New city structure complete!',
    };
  }

  /** Show `n` pieces of `target` (clamped). The main loop calls this once per piece. */
  function setBuilt(target, n) {
    if (!(target in MAX_PIECES)) return;
    state.built[target] = Math.min(MAX_PIECES[target], Math.max(0, Math.floor(num(n, 0))));
    save();
  }

  // --- the workshop -----------------------------------------------------------

  /**
   * Can she start the final build? { ok, text, missing }. `missing` is a list
   * of old-style strings like "wood 3/24"; `text` is the old refusal (empty
   * when ok). Changes nothing.
   */
  function workshopCheck() {
    if (state.builtFinal) {
      return { ok: false, text: L('Engineering Workshop is already built. Go back to the chapters to continue.', 'The Workshop is built! Go back to the chapters.'), missing: [] };
    }
    if (huntRequired && !state.huntFound) return { ok: false, text: HUNT_TEXT, missing: [] };
    if (!(state.solved.bridge && bridgeUnlocked())) {
      return {
        ok: false,
        text: L('The workshop needs the unlocked bridge route first: solve the hard problem or any 3 medium quests, then solve the 5-plank bridge puzzle.',
          'Workshop needs the bridge. First solve 3 puzzles, then the bridge puzzle.'),
        missing: [],
      };
    }
    const missing = [];
    for (const [r, v] of Object.entries(RECIPE)) {
      if (state.resources[r] < v) missing.push(`${r} ${state.resources[r]}/${v}`);
    }
    if (missing.length) {
      return { ok: false, text: `${L('Collect more resources before building:', 'You need more:')} ${missing.join(', ')}.`, missing };
    }
    return { ok: true, text: '', missing: [] };
  }

  /**
   * Start the final build: spend the recipe and set builtFinal (what the
   * launcher reads). Returns { ok:false, text, missing } when refused, else
   * { ok:true, text, target:'workshop', pieces, doneMessage }. The main loop
   * raises the four workshop pieces via setBuilt.
   */
  function startWorkshop() {
    const check = workshopCheck();
    if (!check.ok) { say(check.text); return check; }
    for (const [r, v] of Object.entries(RECIPE)) state.resources[r] -= v;
    state.builtFinal = true;
    state.built.workshop = 0;
    const text = say(L('Final build started. The Engineering Workshop will rise piece by piece.', 'Here we go! Watch the Workshop go up, piece by piece.'));
    save();
    return {
      ok: true,
      text,
      missing: [],
      target: 'workshop',
      pieces: MAX_PIECES.workshop,
      doneMessage: L('Engineering Workshop complete! Chapter 3 is unlocked.', 'The Workshop is done! Chapter 3 is open.'),
    };
  }

  // --- HUD text ---------------------------------------------------------------

  /** The old progress bar: { pct, status }, status is the text after "NN% — ". */
  function progress() {
    const routeSteps = Math.max(Math.min(3, mediumSolvedCount()), state.solved.key ? 3 : 0);
    const solved = routeSteps + (state.solved.bridge ? 1 : 0) + (state.builtFinal ? 1 : 0);
    const pct = Math.round((solved / 5) * 100);
    return { pct, status: state.builtFinal ? L('Engineering Workshop built', 'Workshop built') : L('Build the Engineering Workshop', 'Build the Workshop') };
  }

  /** The old "next steps" (first 3), each a short line. Never empty. */
  function missionLines() {
    const next = [];
    if (!bridgeUnlocked()) {
      next.push(L(`Open the bridge: solve any 3 medium quests (${mediumSolvedCount()}/3) or the hard one.`, `Solve 3 puzzles to open the bridge (${mediumSolvedCount()}/3).`));
      for (const m of mediums) if (!state.solved[m]) next.push(MEDIUM_OPTION_TEXT[lvl][m]);
      if (!state.solved.key) next.push('Blueprint Lock outside the moat');
    }
    if (bridgeUnlocked() && !state.solved.bridge) next.push(L('The golden lock at the moat is open: solve Bridge Builder for 5 planks.', 'The gold lock is open! Solve the bridge puzzle.'));
    if (state.solved.bridge && !state.builtFinal) next.push(L('Cross the bridge, collect resources and build the Engineering Workshop.', 'Cross the bridge. Get what you need. Build the Workshop.'));
    const lines = next.slice(0, 3);
    return lines.length ? lines : [L('Go back to the chapters to continue.', 'Go back to the chapters.')];
  }

  /** The old badge strip: [{ label, done }], the workshop last. */
  function badges() {
    const out = BADGE_LABELS.filter(([q]) => questIds.includes(q)).map(([q, label]) => ({ label, done: !!state.solved[q] }));
    out.push({ label: 'Workshop', done: !!state.builtFinal });
    return out;
  }

  /** The old "Workshop recipe: ..." line. */
  function recipeText() {
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    return `Workshop recipe: ${Object.entries(RECIPE).map(([r, v]) => `${cap(r)} ${v}`).join(', ')}.`;
  }

  /** Old one-off lines for the main loop (interaction and movement toasts). */
  const text = {
    welcome: (name) => (name ? `Welcome, ${name}! ${L('Start with the city engineering quests.', 'Start with the city quests.')}` : `Welcome! ${L('Start with the city engineering quests.', 'Start with the city quests.')}`),
    nothingNear: L('Move closer to a crate, block, blueprint, quest station, or the workshop foundation.', 'Walk closer to something to use it.'),
    blocked: 'Blocked. Try a road, bridge, or open area.',
    moat: L('The corner moat blocks the workshop island. Solve the Bridge Builder puzzle to build 5 planks.', 'The water is in the way. Solve the bridge puzzle to build a bridge.'),
    wrongAnswer: 'Not quite. Try again.',
    bridgeHint: () => (bridgeUnlocked()
      ? L('The bridge station is unlocked at the moat entrance. Solve it to place 5 planks.', 'The bridge puzzle is open at the water. Solve it to build the bridge.')
      : (lvl === 1
        ? 'The gold lock is by the water. Solve 3 puzzles to open it.'
        : 'The single golden lock is at the 3-block-wide moat entrance. Solve the hard Olympiad problem or any 3 medium Olympiad quests first.')),
    workshopHint: L('The Engineering Workshop foundation is inside the corner moat. Unlock the bridge route, build 5 planks, collect resources, then build it.', 'The Workshop goes on the island. Build the bridge first.'),
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
    mediumSolvedCount,
    bridgeUnlocked,
    bridgeBuilt,
    questStructureBuilt,
    openQuest,
    solveQuest,
    setBuilt,
    workshopCheck,
    startWorkshop,
    progress,
    missionLines,
    badges,
    recipeText,
    text,
  };
}
