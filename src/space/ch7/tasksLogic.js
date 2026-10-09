// Chapter 7, Part C: the four room tasks' rules (no drawing, so node can test
// them). tasks.js draws them; questions.partC.js asks the sum after each one.
// Lead's decision, 2026-10-08: chemistry and biology happen in the rooms, and
// each task builds on Chapter 6's oxygen, water, farm and quest work.
//
//   split    - the atom kitchen (life deck, the water lab): electricity splits
//              water, 2 H2O -> 2 H2 + O2. Drag every atom into its molecule
//              jar (Easy, Medium). Level 4 balances the equation (Hard).
//   plants   - the plants' air swap (life deck, the farm): 6 CO2 + 6 H2O + light
//              -> sugar + 6 O2. Run the light and count the bubbles (Easy,
//              Medium). Level 4 balances the oxygen atoms (Hard).
//   microbes - the recycler's helpers (life deck, the algae tanks): bacteria
//              double every pretend hour. Grow enough to clean the tank (all
//              three modes).
//   bones    - the sick bay: in zero g bones lose about 1% a month (simplified
//              numbers). One bike is shared: spend its hours over the coast so
//              nobody loses more than the limit (Level 4), or keeps enough of
//              their 10 bone blocks (Level 1).
//
// Level 1 plays the counting modes (Easy, Medium); Level 4 plays all three.
// Every state is plain data, so a save could hold it.

export const TASKS = Object.freeze([
  { id: 'split', lead: 'builder', deck: 'life', near: 'water', title: ['Atom kitchen: split the water', 'Split the water'] },
  { id: 'plants', lead: 'biologist', deck: 'life', near: 'food', title: ['Farm: the plants’ air swap', 'Make oxygen on the farm'] },
  { id: 'microbes', lead: 'biologist', deck: 'life', near: 'oxygen', title: ['Recycler: grow the helper microbes', 'Grow the helpers'] },
  { id: 'bones', lead: 'doctor', deck: 'crew', near: 'medbay', title: ['Sick bay: keep the bones strong', 'Keep bones strong'] },
]);

export const MODES = Object.freeze(['easy', 'medium', 'hard']);
/** Level 1 plays the counting modes; Hard (balancing, the tightest plans) is for Level 4. */
export const modesFor = (level) => (level === 1 ? MODES.slice(0, 2) : [...MODES]);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// --- split: the atom kitchen -------------------------------------------------------------

/** 2 H2O -> 2 H2 + O2 (the numbers in front of each molecule). */
export const SPLIT = Object.freeze({
  water: { easy: 2, medium: 4 },                     // water molecules going in, by mode
  equation: Object.freeze({ water: 2, h2: 2, o2: 1 }), // the smallest whole numbers that balance it
  max: 4,                                            // the Hard boxes go from 1 to this
});

/** The atoms from `water` water molecules: 2 H and 1 O each. */
export const atomsIn = (water) => ({ H: 2 * water, O: water });
/** Atoms of one kind in each molecule jar: H2 takes 2 H, O2 takes 2 O. */
export const JAR_SIZE = 2;

/** A fresh kitchen: one ball per atom on the bench, and one empty jar per molecule to make. */
export function kitchen(water) {
  const { H, O } = atomsIn(water);
  const bench = [];
  for (let i = 0; i < H; i++) bench.push(`H${i}`);
  for (let i = 0; i < O; i++) bench.push(`O${i}`);
  const jars = [];
  for (let i = 0; i < H / JAR_SIZE; i++) jars.push({ kind: 'H', atoms: [] });
  for (let i = 0; i < O / JAR_SIZE; i++) jars.push({ kind: 'O', atoms: [] });
  return { bench, jars };
}

/**
 * Drop a ball from the bench into a jar. Returns { kitchen, problem }: problem is
 * 'kind' (hydrogen in an oxygen jar, or the other way round), 'full', or null.
 * A ball that is not on the bench (or a jar that does not exist) does nothing.
 */
export function placeAtom(k, atomId, jarIndex) {
  const jar = k.jars[jarIndex];
  if (!jar || !k.bench.includes(atomId)) return { kitchen: k, problem: null };
  if (atomId[0] !== jar.kind) return { kitchen: k, problem: 'kind' };
  if (jar.atoms.length >= JAR_SIZE) return { kitchen: k, problem: 'full' };
  const bench = k.bench.filter((a) => a !== atomId);
  const jars = k.jars.map((j, i) => (i === jarIndex ? { kind: j.kind, atoms: [...j.atoms, atomId] } : j));
  return { kitchen: { bench, jars }, problem: null };
}

/** Take a ball out of a jar back onto the bench (a mistake is never lost). */
export function takeAtom(k, atomId) {
  const jars = k.jars.map((j) => (j.atoms.includes(atomId) ? { kind: j.kind, atoms: j.atoms.filter((a) => a !== atomId) } : j));
  const was = k.jars.some((j) => j.atoms.includes(atomId));
  return { bench: was ? [...k.bench, atomId] : k.bench, jars };
}

/** Every atom in a full jar, and none left on the bench: the kitchen is clean. */
export const kitchenDone = (k) => k.bench.length === 0 && k.jars.every((j) => j.atoms.length === JAR_SIZE);

/** One way to finish: each jar in turn, filled from the bench (for the solver and the tests). */
export function kitchenSolution(water) {
  let k = kitchen(water);
  const moves = [];
  k.jars.forEach((jar, i) => {
    for (let n = 0; n < JAR_SIZE; n++) {
      const atom = k.bench.find((a) => a[0] === jar.kind);
      const r = placeAtom(k, atom, i);
      k = r.kitchen; moves.push([atom, i]);
    }
  });
  return moves;
}

/** The Hard mode: do the boxes balance (every H and every O in as many as out)? */
export const splitBalanced = ({ water, h2, o2 }) => 2 * water === 2 * h2 && water === 2 * o2;
/** Balanced with the smallest whole numbers: 2, 2, 1, never 4, 4, 2. */
export const splitSmallest = (eq) => splitBalanced(eq) && gcd(gcd(eq.water, eq.h2), eq.o2) === 1;
/** Atom counts on each side, for the bars on the card. */
export const splitCounts = ({ water, h2, o2 }) => ({ inH: 2 * water, outH: 2 * h2, inO: water, outO: 2 * o2 });

/** The sum a child is asked: oxygen molecules from some water molecules (2 H2O make 1 O2). */
export const o2FromWater = (water) => (water * SPLIT.equation.o2) / SPLIT.equation.water;

// --- plants: the air swap ----------------------------------------------------------------

/** 6 CO2 + 6 H2O + light -> C6H12O6 (sugar) + 6 O2. One light run takes in 6 CO2 and 6 H2O. */
export const PLANTS = Object.freeze({
  co2: 6, h2o: 6,             // molecules taken in by one light run
  bubbles: 6,                 // O2 bubbles one run gives (the sugar is kept in the plant)
  targets: { easy: 24, medium: 30 }, // bubbles to make, by mode
  maxRuns: 8,                 // the light dial goes from 0 to this
  sugarO: 6,                  // the sugar C6H12O6 holds 6 O atoms
  maxO2: 12,                  // the Hard O2 box goes from 0 to this
});

/** O atoms in one CO2 (C and two O). */
export const CO2_OXYGEN = 2;
/** O atoms going in: 2 per CO2, 1 per H2O. */
export const oxygenIn = () => PLANTS.co2 * CO2_OXYGEN + PLANTS.h2o * 1;
/** O atoms in `n` carbon dioxide molecules. */
export const oxygenInCo2 = (n) => n * CO2_OXYGEN;
/** O atoms coming out: the sugar's, and 2 per O2. */
export const oxygenOut = (o2) => PLANTS.sugarO + 2 * o2;
/** The O2 that balances the oxygen atoms: 6. */
export const plantsO2Answer = () => (oxygenIn() - PLANTS.sugarO) / 2;
export const plantsBalanced = (o2) => oxygenOut(o2) === oxygenIn();
/** Bubbles made by `runs` light runs. */
export const bubblesFrom = (runs) => runs * PLANTS.bubbles;
/** Light runs needed to make `target` bubbles (rounded up). */
export const runsFor = (target) => Math.ceil(target / PLANTS.bubbles);

// --- microbes: the doubling helpers ------------------------------------------------------

/** Pretend hours: every bacterium splits in two each hour. `hours` is the deadline on the dial. */
export const MICROBES = Object.freeze({
  modes: {
    easy: { starts: [1], target: 64, hours: 8 },
    medium: { starts: [1, 2, 4, 8], target: 100, hours: 8 },
    hard: { starts: [1, 2, 4, 8, 16, 32, 64], target: 1000, hours: 5 },
  },
});
/** Bacteria after `hours` pretend hours from `start` (each hour doubles them). */
export const cellsAfter = (start, hours) => start * 2 ** hours;
/** The fewest pretend hours from one bacterium to pass `target` (100: 7, since 128 is the first over 100). */
export function hoursToPass(target, start = 1) {
  let h = 0;
  while (cellsAfter(start, h) <= target) h++;
  return h;
}
export const microbesDone = (mode, start, hours) => cellsAfter(start, hours) >= MICROBES.modes[mode].target;

// --- bones: exercise in zero g -----------------------------------------------------------
// One bike, shared by the crew: every coast has a total of bike hours to spend
// (`budget`), and each month's hours (0, 1 or 2) cost bone. Level 4 counts the
// loss in tenths of a percent (the numbers are simplified, not measured: no bike
// 1%, an hour 0.5%, two hours 0.2% a month). Level 1 counts whole bone blocks
// (no bike 2 blocks, an hour 1, two hours 0) out of 10: keep at least `keep`.

export const BONES = Object.freeze({
  hours: [0, 1, 2],
  lossTenths: [10, 5, 2],      // Level 4: loss a month, tenths of a percent
  modes: {                     // Level 4: a coast of `months`, bike hours in all, and the most loss (tenths)
    easy: { months: 3, budget: 6, limit: 15 },
    medium: { months: 6, budget: 10, limit: 20 },
    hard: { months: 6, budget: 9, limit: 25 },
  },
  blocks: {                    // Level 1
    lossBlocks: [2, 1, 0],
    start: 10,
    modes: {
      easy: { months: 3, budget: 6, keep: 6 },
      medium: { months: 3, budget: 4, keep: 7 },
    },
  },
});

/** The mode's coast: months, bike budget and the target (the limit or the blocks to keep). */
export const boneCfg = (mode, level = 4) => (level === 1 ? BONES.blocks.modes[mode] : BONES.modes[mode]);
/** Bike hours a plan spends in all. */
export const boneHours = (plan) => plan.reduce((a, h) => a + h, 0);
/** Tenths of a percent lost by a plan (Level 4). */
export const boneLoss = (plan) => plan.reduce((a, h) => a + BONES.lossTenths[h], 0);
/** Blocks left out of the start (Level 1). */
export const blocksLeft = (plan) => BONES.blocks.start - plan.reduce((a, h) => a + BONES.blocks.lossBlocks[h], 0);
/** Bike hours still to spend. */
export const bikeLeft = (mode, plan, level = 4) => boneCfg(mode, level).budget - boneHours(plan);
/** The plan a child starts from: no bike at all. */
export const boneStart = (mode, level = 4) => Array(boneCfg(mode, level).months).fill(0);
/** A plan is safe: the bike budget is kept, and the bones are kept (under the limit, or at least `keep` blocks). */
export function boneOk(mode, plan, level = 4) {
  const c = boneCfg(mode, level);
  if (plan.length !== c.months || boneHours(plan) > c.budget) return false;
  return level === 1 ? blocksLeft(plan) >= c.keep : boneLoss(plan) <= c.limit;
}
/** Percent lost over a coast with no exercise at all: 1% a month (the simple figure the question uses). */
export const noExerciseLoss = (months) => (BONES.lossTenths[0] * months) / 10;
/** The first plan (in counting order) that is safe, for the solver and the tests. */
export function boneAnswer(mode, level = 4) {
  const c = boneCfg(mode, level);
  const n = c.months;
  for (let i = 0; i < BONES.hours.length ** n; i++) {
    const plan = []; let x = i;
    for (let m = 0; m < n; m++) { plan.push(x % BONES.hours.length); x = Math.floor(x / BONES.hours.length); }
    if (boneOk(mode, plan, level)) return plan;
  }
  throw new Error(`no bone plan for ${mode}`);
}

// --- the rules, for every task and mode -------------------------------------------------
// A task's state is plain data: split (easy, medium) the kitchen; split (hard) the
// equation { water, h2, o2 }; plants the light runs (easy, medium) or the O2 count
// (hard); microbes { start, hours }; bones the bike hours of each month.

/** The first start (in the mode's order) and the fewest pretend hours that clean the tank. */
export function microbeAnswer(mode) {
  const cfg = MICROBES.modes[mode];
  for (const start of cfg.starts) {
    for (let hours = 0; hours <= cfg.hours; hours++) if (microbesDone(mode, start, hours)) return { start, hours };
  }
  throw new Error(`no microbe answer for ${mode}`);
}

/** One answer that solves a task in a mode, as the card's state (the solve() hook and the tests use it). */
export function taskAnswer(task, mode, level = 4) {
  if (task === 'split') return mode === 'hard' ? { ...SPLIT.equation } : kitchenSolution(SPLIT.water[mode]);
  if (task === 'plants') return mode === 'hard' ? plantsO2Answer() : runsFor(PLANTS.targets[mode]);
  if (task === 'microbes') return microbeAnswer(mode);
  if (task === 'bones') return boneAnswer(mode, level);
  throw new Error(`no task ${task}`);
}

/** Is a task solved in a mode? `state` is what the card holds (see the header above). */
export function solved(task, mode, state, level = 4) {
  if (task === 'split') return mode === 'hard' ? splitSmallest(state) : kitchenDone(state);
  if (task === 'plants') return mode === 'hard' ? plantsBalanced(state) : bubblesFrom(state) >= PLANTS.targets[mode];
  if (task === 'microbes') return microbesDone(mode, state.start, state.hours);
  if (task === 'bones') return boneOk(mode, state, level);
  throw new Error(`no task ${task}`);
}
