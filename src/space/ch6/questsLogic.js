// Chapter 6, life on board: the four quests after Part B's stations, as rules
// (no drawing, so node can test them). quests.js draws them; decks.js puts each
// on its deck; questions.partQuests.js asks the sum after each one.
//
//   medbay   - Theo: scan the four crew badges, then ride the exercise bike so
//              the crew's exercise reaches the bone goal (spin gravity)
//   coolant  - Bolt: route the coolant from the tank to the core, never past the crack
//   message  - Echo: turn the dish until it points at Earth
//   pollen   - Mira: no bees out here, so pollinate by hand: pollen first, then its partner
//
// Every state is plain data, so a save can hold it. Level 4 and Level 1 use the
// same puzzles (the text differs, in questions.partQuests.js).
import { CREW_SIZE } from './stationsLogic.js';

export const QUESTS = Object.freeze([
  { id: 'medbay', lead: 'doctor', title: ['Sick bay: check the crew', 'Check the crew'], deck: 'crew' },
  { id: 'coolant', lead: 'builder', title: ['Fix the coolant leak', 'Fix the leak'], deck: 'engineering' },
  { id: 'message', lead: 'signal', title: ['Send a message home', 'Message home'], deck: 'bridge' },
  { id: 'pollen', lead: 'biologist', title: ['Farm bay: pollinate by hand', 'Pollinate the flowers'], deck: 'life' },
]);

/** Halving: what gets through `metres` of shield, from `outside` units. */
export const doseThrough = (outside, metres) => outside / 2 ** metres;

// --- medbay -----------------------------------------------------------------------------

export const OUTSIDE_DOSE = 64; // units a day a badge would get outside the shield
export const DAY_LIMIT = 20;    // units a day one person may take
/** The four badges: where each one sits (behind how many metres of shield). */
export const BADGES = Object.freeze([
  { id: 'biologist', name: 'Mira', metres: 3 }, // in her cabin, behind the hull
  { id: 'doctor', name: 'Theo', metres: 3 },    // in the sick bay
  { id: 'builder', name: 'Bolt', metres: 2 },   // out on the hull, in his suit
  { id: 'signal', name: 'Echo', metres: 4 },    // in her sensor case
]);
export const badgeDose = (b) => doseThrough(OUTSIDE_DOSE, b.metres);

/** Exercise for bones in spin gravity: each of us 30 minutes a day. */
export const BONES = Object.freeze({ each: 30, walk: 90, bikeStep: 5, bikeMax: 120 });
export const exerciseGoal = () => BONES.each * CREW_SIZE; // 150 crew-minutes a day

/** The medbay state: the badges scanned so far, and the bike minutes set. */
export function medbayTotals({ scanned = [], bike = 0 }) {
  const missing = BADGES.filter((b) => !scanned.includes(b.id)).map((b) => b.id);
  const total = BONES.walk + bike;
  const goal = exerciseGoal();
  return { missing, total, goal, short: total < goal, ok: missing.length === 0 && total >= goal };
}
/** One answer that works: every badge, and the bike minutes that make up the goal. */
export const medbayAnswer = () => ({ scanned: BADGES.map((b) => b.id), bike: exerciseGoal() - BONES.walk });

// --- coolant ----------------------------------------------------------------------------

/** The grid is 4 x 3 valves. The tank and the core are fixed ends (always open); [column, row]. */
export const COOLANT = Object.freeze({
  cols: 4, rows: 3,
  tank: [0, 1], core: [3, 1], crack: [1, 1],
  open: ['1,1', '2,1'], // the pipes as they start: a straight run through the cracked pipe
  tankLitres: 400, leakPerMin: 25,
});
const keyOf = ([c, r]) => `${c},${r}`;
const sides = ([c, r]) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]
  .filter(([x, y]) => x >= 0 && x < COOLANT.cols && y >= 0 && y < COOLANT.rows);

/**
 * Where the coolant gets to from the tank, through the open valves (an array
 * or set of 'c,r' keys). It stops at the core. `leak` is true when it reaches the crack.
 */
export function coolantFlow(openKeys) {
  const open = new Set(openKeys);
  const coreKey = keyOf(COOLANT.core);
  const reach = new Set([keyOf(COOLANT.tank)]);
  const queue = [COOLANT.tank];
  while (queue.length) {
    const cell = queue.shift();
    if (keyOf(cell) === coreKey) continue; // the core is the end of the line
    for (const n of sides(cell)) {
      const k = keyOf(n);
      if (reach.has(k) || !(open.has(k) || k === coreKey)) continue;
      reach.add(k); queue.push(n);
    }
  }
  return { reach, leak: reach.has(keyOf(COOLANT.crack)), core: reach.has(coreKey) };
}

/** Why a set of open valves is wrong: 'leak', 'short' (no coolant at the core), or null when it is right. */
export function coolantProblem(openKeys) {
  const f = coolantFlow(openKeys);
  if (f.leak) return 'leak';
  if (!f.core) return 'short';
  return null;
}
/** One set of open valves that works: the crack shut, a way round it open. */
export const COOLANT_ANSWER = Object.freeze(['0,0', '1,0', '2,0', '2,1']);
/** The sum: minutes until the tank is empty. */
export const coolantMinutes = () => COOLANT.tankLitres / COOLANT.leakPerMin;

// --- message ----------------------------------------------------------------------------

/** The dish turns in steps, in degrees, clockwise from straight up. Earth is 130 degrees; "locked" is 5 either side. */
export const DISH = Object.freeze({ step: 10, earth: 130, locked: 5, sun: 250 });
export const LIGHT = Object.freeze({ minPerBillionKm: 55, earthBillionKm: 6 });
/** The gap between two angles, in degrees, the short way round. */
export const angleGap = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
/** The dish after one turn: dir -1 left, +1 right. */
export const dishTurn = (deg, dir) => (((deg + dir * DISH.step) % 360) + 360) % 360;
export const dishOnEarth = (deg) => angleGap(deg, DISH.earth) <= DISH.locked;
/** Hours for light (a message) to cross `billionKm`. */
export const lightHours = (billionKm) => (billionKm * LIGHT.minPerBillionKm) / 60;

// --- pollen -----------------------------------------------------------------------------

/** Six flowers, three pairs. A 'dust' flower (yellow dust on it) gives its pollen; its 'bud' partner takes it. */
export const FLOWERS = Object.freeze([
  { id: 'a', pair: 0, role: 'dust' }, { id: 'b', pair: 1, role: 'bud' }, { id: 'c', pair: 2, role: 'dust' },
  { id: 'd', pair: 0, role: 'bud' }, { id: 'e', pair: 1, role: 'dust' }, { id: 'f', pair: 2, role: 'bud' },
]);
export const PAIRS = 3;
const flowerById = (id) => FLOWERS.find((f) => f.id === id);

/**
 * Tap a flower. State: { holding (the dust flower's id, or null), fruit (the buds
 * that have a strawberry) }. Returns { state, problem }: problem is 'order' (a
 * bud tapped with no pollen held), 'partner' (the pollen is for another bud), or null.
 */
export function pollinate(state, id) {
  const s = { holding: state.holding ?? null, fruit: [...(state.fruit || [])] };
  const f = flowerById(id);
  if (!f) return { state: s, problem: null };
  if (f.role === 'dust') { s.holding = s.holding === id ? null : id; return { state: s, problem: null }; }
  if (s.fruit.includes(id)) return { state: s, problem: null };
  if (!s.holding) return { state: s, problem: 'order' };
  if (flowerById(s.holding).pair !== f.pair) return { state: s, problem: 'partner' };
  s.fruit.push(id); s.holding = null;
  return { state: s, problem: null };
}
export const pollinated = (state) => (state.fruit || []).length === PAIRS;
/** One order that works: each pollen flower, then its partner. */
export const pollenAnswer = () => ['a', 'd', 'e', 'b', 'c', 'f'];
/** Run a list of taps from the start: the state at the end, and the first problem met. */
export function runPollen(ids) {
  let state = { holding: null, fruit: [] }; let first = null;
  for (const id of ids) { const r = pollinate(state, id); state = r.state; first ??= r.problem; }
  return { state, problem: first };
}

/** The farm: strawberry plants, and the crew's share of their berries. */
export const FARM = Object.freeze({ plants: 60, berriesPerWeek: 12 });
export const berriesTotal = () => FARM.plants * FARM.berriesPerWeek; // 720 a week
export const berriesEach = () => berriesTotal() / CREW_SIZE;         // 144 each
