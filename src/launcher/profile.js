// The one thing every screen agrees on: who is playing, and how far they got.
//
// Three chapters, three separate games, written months apart and never meant
// to know about each other. Chapters 1 and 2 are self-contained single-file
// builds lifted whole out of the asset library; chapter 3 is this project.
// Stitching them together could have meant editing all three - instead this
// module READS what each already writes.
//
// Every one of them saves its state to localStorage under its own key, and
// every one of them already sets a flag when it is finished. So the launcher
// asks the browser what has been completed rather than asking the games to
// report in, and none of the three needed a line changed to be gated.
//
// The consequence worth knowing: opening a chapter's .html directly bypasses
// the gate entirely, because the gate lives here and not inside the chapters.
// That is deliberate - it is how an adult checks chapter 3 without playing
// two games first.

/** Name and anything else about the child, as opposed to the girl. */
export const PROFILE_KEY = 'rocket_village_profile';

/**
 * Her APPEARANCE. Owned by character.html, which has been writing this key
 * since long before the launcher existed - so the launcher reads its format
 * rather than inventing a second one and leaving the two to drift.
 */
export const LOOK_KEY = 'rocket_village_girl_v1';

/**
 * Her look again, flattened to four colours for chapters 1 and 2.
 *
 * Those two are self-contained 2D games that can import nothing from here, so
 * character.html writes this plain key and they read it. Listed HERE because
 * a reset that misses it leaves the old girl walking around chapters 1 and 2
 * after everything else has been wiped - which is exactly what happened the
 * first time, because this key was added after resetEverything was written.
 */
export const SPRITE_KEY = 'rocket_village_sprite';

/**
 * Difficulty is a LEVEL; a part of the story is a CHAPTER.
 *
 * These were the same word until now, which made "Level 3" mean both "the
 * third game" and "third-grade difficulty" depending on who was reading. The
 * whole set is being built for 4th grade; a 1st-grade set exists separately
 * and is a different DIFFICULTY of the same chapters, not different chapters.
 */
export const DIFFICULTIES = [
  { level: 1, label: 'Level 1', forGrade: '1st grade', blurb: 'Math Kangaroo Level 1-2 and CogAT patterns.' },
  { level: 4, label: 'Level 4', forGrade: '4th grade', blurb: 'Math Kangaroo Level 3-4 and gifted-math patterns.' },
];

/** The chosen difficulty, defaulting to Level 4 - the authored original. */
export function difficulty() {
  const n = loadProfile().difficulty;
  return DIFFICULTIES.find((d) => d.level === n) || DIFFICULTIES[1];
}

/**
 * The four chapters, in order.
 *
 * `store` and `isDone` are each chapter's OWN save key and OWN completion
 * flag, read as they already exist:
 *   chapter 1 sets `built` when the science village is finished
 *   chapter 2 sets `builtFinal` when the engineering workshop goes up
 *   chapter 3 sets `launched` when the rocket flies
 *   chapter 4 sets `complete` when she reaches Europa
 */
export const CHAPTERS = [
  {
    n: 1,
    title: 'Science Village',
    blurb: 'Gather wood, stone and science. Solve the number puzzles and open the iron room.',
    href: 'chapter1.html', // the 3-D version (CHAPTER1_PLAN.md); the old one stays in docs/legacy-chapters/
    store: { 1: 'level1_science_village_grade1_competitive_v1', 4: 'level1_science_village_v7' },
    isDone: (s) => s?.built === true,
  },
  {
    n: 2,
    title: 'City Engineering',
    blurb: 'Build the bridge, then raise the Engineering Workshop.',
    href: 'chapter2.html', // the 3-D version (CHAPTER2_PLAN.md); the old one stays in docs/legacy-chapters/
    store: { 1: 'level2_city_engineering_v5_three_side_moat_route', 4: 'level2_city_engineering_grade3_olympiad_v2_science' },
    isDone: (s) => s?.builtFinal === true,
  },
  {
    n: 3,
    title: 'Rocket Village',
    blurb: 'Answer the science questions, build the rocket stage by stage, and launch it.',
    href: 'chapter3.html',
    store: { 1: 'level3_rocket_village_v2_L1', 4: 'level3_rocket_village_v2' },
    isDone: (s) => s?.launched === true,
  },
  {
    n: 4,
    title: 'Voyage to Europa',
    blurb: 'Fly a real-gravity spaceship past the Moon, Mars and the asteroid belt to Jupiter’s icy moon.',
    href: 'chapter4.html',
    store: { 1: 'level4_voyage_europa_v1_L1', 4: 'level4_voyage_europa_v1' },
    isDone: (s) => s?.complete === true,
  },
];

/** localStorage, without letting private mode take the page down with it. */
function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @returns {{name: string, difficulty: number}} */
export function loadProfile() {
  const p = read(PROFILE_KEY);
  return {
    name: typeof p?.name === 'string' ? p.name : '',
    // Level 4 is the default because it is the authored original; Level 1 is
    // the overlay. Anything unreadable lands on 4 rather than guessing.
    difficulty: p?.difficulty === 1 ? 1 : 4,
  };
}

export function saveProfile(profile) {
  return write(PROFILE_KEY, { ...loadProfile(), ...profile, updatedAt: Date.now() });
}

/** Her look, as character.html saved it. Null when she has not been built. */
export function loadLook() {
  const look = read(LOOK_KEY);
  return look && typeof look === 'object' ? look : null;
}

/**
 * Every chapter with whether it is finished and whether it can be entered.
 *
 * A chapter is locked until the one before it is done. Chapter 1 is never
 * locked, and a chapter you have already finished never re-locks - replaying
 * chapter 1 must not shut chapter 3 behind you.
 */
/**
 * Grown-up unlock: every chapter open, for checking a later chapter without
 * playing the earlier ones. A child using the menu never sees it; it's
 * switched on by opening the launcher with ?unlock=all (and off again with
 * ?unlock=off), and remembered in localStorage so it survives a reload.
 * "Start everything over" clears it too.
 */
export const UNLOCK_KEY = 'rocket_village_unlock_all';

/** Prefix of the per-chapter "seen the opening" flags (chapterStory.js). */
export const SEEN_PREFIX = 'rocket_village_seen_';

/** Prefix of the launcher's "this chapter was finished once" flags. */
export const DONE_PREFIX = 'rocket_village_done_';

function unlockAll() {
  try {
    const q = new URLSearchParams(location.search).get('unlock');
    if (q === 'all') localStorage.setItem(UNLOCK_KEY, '1');
    if (q === 'off') localStorage.removeItem(UNLOCK_KEY);
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function chapterStatus() {
  // Each difficulty keeps its OWN saves and its OWN copies of chapters 1 and 2,
  // so finishing Level 1 does not mark Level 4 complete, and a child can move
  // between them without either set of progress disturbing the other.
  const level = difficulty().level;
  const unlocked = unlockAll();
  let previousDone = true;
  return CHAPTERS.map((c) => {
    const store = typeof c.store === 'string' ? c.store : c.store[level];
    const href = c.href.replace('{level}', `level${level}`);
    // A finished chapter stays finished: the two-tries restart wipes a
    // chapter's save, and replaying a finished chapter and missing twice used
    // to re-lock the next one. The launcher remembers it here the first time
    // it sees the chapter done.
    const doneKey = `${DONE_PREFIX}ch${c.n}_L${level}`;
    let done = !!c.isDone(read(store));
    try {
      if (done) localStorage.setItem(doneKey, '1');
      else done = localStorage.getItem(doneKey) === '1';
    } catch { /* private mode */ }
    const locked = !unlocked && !previousDone && !done;
    previousDone = done;
    return { ...c, store, href, done, locked };
  });
}

/** The chapter the child should be nudged towards: first unfinished, open one. */
export function nextChapter(status = chapterStatus()) {
  return status.find((c) => !c.done && !c.locked) || status[status.length - 1];
}

/**
 * Wipe EVERYTHING: both difficulties, all four chapters, the name, the look.
 *
 * The keys are gathered from CHAPTERS rather than typed out, so a chapter
 * added later is cleared too without anyone remembering to come back here -
 * a reset that misses one save is worse than no reset, because the menu then
 * shows progress the child cannot explain.
 *
 * @returns {string[]} the keys actually removed, so the caller can report it
 */
export function resetEverything() {
  const keys = new Set([
    PROFILE_KEY, LOOK_KEY, SPRITE_KEY, 'rocket_village_mission_open', UNLOCK_KEY,
    // Chapter 4's own preferences: flying mode and the mission card's open state.
    'rocket_village_ch4_flight_mode', 'space_ch4_mission_open',
    // Chapters 1-3: the Easy/Medium/Hard choice (src/play/modes.js). Missed
    // until 2026-09-30: after a reset the chooser never came back.
    'rocket_village_play_mode',
  ]);
  for (const c of CHAPTERS) {
    const stores = typeof c.store === 'string' ? [c.store] : Object.values(c.store);
    // Each save, its treasure-hunt progress (`<save>_hunt`, Hard mode) and
    // Chapter 4's act-start copy (`<save>_act`, the two-tries restart point).
    for (const k of stores) { keys.add(k); keys.add(`${k}_hunt`); keys.add(`${k}_act`); keys.add(`${k}_ckpt`); keys.add(`${k}_apple`); }
  }
  // "Seen the chapter opening" flags (src/game/chapterStory.js).
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(SEEN_PREFIX) || k.startsWith(DONE_PREFIX))) keys.add(k);
    }
  } catch { /* private mode */ }
  const removed = [];
  for (const k of keys) {
    try {
      if (localStorage.getItem(k) !== null) removed.push(k);
      localStorage.removeItem(k);
    } catch { /* private mode */ }
  }
  return removed;
}

/** Has she been named and built? If not, the launcher starts at the builder. */
export function profileReady() {
  return loadProfile().name.trim().length > 0 && !!loadLook();
}
