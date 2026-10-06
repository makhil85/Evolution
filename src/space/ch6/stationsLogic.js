// Chapter 6, Part B: the six habitat stations' rules (no drawing, so node
// can test them). The cards that draw them are stations.js.
//
// Each station is one small puzzle on one idea from the plan doc, with a
// hard 5th-grade sum in it (Level 4); Level 1 uses the same puzzles with
// the text simplified. Every state is plain data, so a save can hold it.
//
//   shield  - each metre of rock stops half the rays: patch the thin spots
//   oxygen  - algae lamps + the ice splitter must make what the crew breathes,
//             inside the power the air system gets
//   water   - put the three filters in the right order; 98% comes back
//   food    - plan a farm big enough to feed five, small enough to fit
//   energy  - share the drive's 12 units: every system gets at least its share
//   pack    - pack what a trip between the stars needs, under the mass limit

export const CREW_SIZE = 5; // her and the four crewmates

// --- shield -------------------------------------------------------------------------------

export const SHIELD = Object.freeze({ cols: 8, rows: 4, safe: 6, spare: 2 });

/** Rays (of 100) that get through `m` metres of rock: each metre stops half. */
export const raysThrough = (m) => 100 / 2 ** m;

/** The wall as scanned: most of it 6 m thick, a few thin spots. Seeded, so it is the same every time. */
export function createShield() {
  const n = SHIELD.cols * SHIELD.rows;
  const cells = new Array(n).fill(SHIELD.safe);
  // Thin spots: a micrometeorite pit, a crack, an old mine shaft.
  const thin = { 3: 2, 10: 1, 11: 3, 21: 4, 28: 3 };
  for (const [i, m] of Object.entries(thin)) cells[Number(i)] = m;
  const need = cells.reduce((a, m) => a + Math.max(0, SHIELD.safe - m), 0);
  return { cells, blocks: need + SHIELD.spare, used: 0 };
}

/** Add one metre of rock to cell i (costs one block). False when it can't. */
export function patchCell(sh, i) {
  if (i < 0 || i >= sh.cells.length || sh.blocks <= 0 || sh.cells[i] >= SHIELD.safe + 2) return false;
  sh.cells[i] += 1; sh.blocks -= 1; sh.used += 1;
  return true;
}

export const shieldDone = (sh) => sh.cells.every((m) => m >= SHIELD.safe);
/** The thinnest cell's leak, rays of 100. */
export const worstLeak = (sh) => Math.max(...sh.cells.map(raysThrough));

// --- oxygen -------------------------------------------------------------------------------

export const OXYGEN = Object.freeze({
  perPerson: 550, // litres of oxygen a person breathes in a day
  lamp: { litres: 400, power: 1, max: 6 }, // an algae tank under a lamp
  split: { litres: 300, power: 2, max: 4 }, // one step of the ice splitter
  power: 10, // what the air system gets from the grid
});
export const oxygenNeed = () => OXYGEN.perPerson * CREW_SIZE;

export function oxygenTotals({ lamps, split }) {
  const litres = lamps * OXYGEN.lamp.litres + split * OXYGEN.split.litres;
  const power = lamps * OXYGEN.lamp.power + split * OXYGEN.split.power;
  return { litres, power, enough: litres >= oxygenNeed(), inPower: power <= OXYGEN.power, ok: litres >= oxygenNeed() && power <= OXYGEN.power };
}

/** Every setting that works (for tests and the autopilot). */
export function oxygenAnswers() {
  const out = [];
  for (let lamps = 0; lamps <= OXYGEN.lamp.max; lamps++) {
    for (let split = 0; split <= OXYGEN.split.max; split++) if (oxygenTotals({ lamps, split }).ok) out.push({ lamps, split });
  }
  return out;
}

// --- water -------------------------------------------------------------------------------

/** The filters, and the right order (big bits first, then the algae eat the dirt, then UV kills the germs). */
export const FILTERS = Object.freeze([
  { id: 'grit', name: ['Grit screen', 'Grit screen'], does: ['catches hair, crumbs and grit', 'catches big bits'] },
  { id: 'bio', name: ['Algae filter', 'Algae filter'], does: ['tiny algae eat the dirt and soap', 'tiny plants eat the dirt'] },
  { id: 'uv', name: ['UV light', 'UV light'], does: ['kills any germs left', 'kills germs'] },
]);
export const WATER_ORDER = Object.freeze(['grit', 'bio', 'uv']);

/** Why an order is wrong (a [Level 4, Level 1] pair), or null when it is right. */
export function waterProblem(order) {
  if (order.length !== 3 || new Set(order).size !== 3) return ['Put each filter in once.', 'Use each filter once.'];
  if (order[0] !== 'grit') return ['Big bits first: grit would clog the algae and hide germs from the UV light.', 'Big bits first! The grit screen goes first.'];
  if (order[2] !== 'uv') return ['The UV light goes last: dirt after it could still carry germs into the tank.', 'The UV light goes last, just before the tank.'];
  return null;
}

export const WATER = Object.freeze({ usedPerDay: 100, backPerDay: 98, tank: 1000 });
/** Percent of the used water the loop gives back. */
export const recycledPercent = () => Math.round((WATER.backPerDay / WATER.usedPerDay) * 100);
/** Days a full tank lasts, losing only what the loop can't give back. */
export const tankDays = () => WATER.tank / (WATER.usedPerDay - WATER.backPerDay);

// --- food --------------------------------------------------------------------------------

export const FOOD = Object.freeze({ perPerson: 1, perSquareMetre: 0.5, maxArea: 12, maxSide: 6 });
export const foodNeed = () => FOOD.perPerson * CREW_SIZE; // kg a day

export function farmTotals({ w, l }) {
  const area = w * l;
  const kg = area * FOOD.perSquareMetre;
  return { area, kg, enough: kg >= foodNeed(), fits: area <= FOOD.maxArea, ok: kg >= foodNeed() && area <= FOOD.maxArea };
}

export function farmAnswers() {
  const out = [];
  for (let w = 1; w <= FOOD.maxSide; w++) for (let l = 1; l <= FOOD.maxSide; l++) if (farmTotals({ w, l }).ok) out.push({ w, l });
  return out;
}

// --- energy ------------------------------------------------------------------------------

export const GRID = Object.freeze({
  total: 12,
  systems: [
    { id: 'air', name: ['Air', 'Air'], min: 4 }, // 1/3
    { id: 'farm', name: ['Farm lights', 'Farm'], min: 3 }, // 1/4
    { id: 'lights', name: ['Cabin lights and heat', 'Lights'], min: 2 }, // 1/6
    { id: 'engine', name: ['Engine', 'Engine'], min: 3 }, // 1/4
  ],
});

/** The fraction a share is of the total, in lowest terms: '1/3'. */
export function fraction(n, d = GRID.total) {
  if (n === 0) return '0';
  const g = (a, b) => (b ? g(b, a % b) : a);
  const k = g(n, d);
  return `${n / k}/${d / k}`;
}

export function gridTotals(shares) {
  const used = GRID.systems.reduce((a, s) => a + (shares[s.id] || 0), 0);
  const short = GRID.systems.filter((s) => (shares[s.id] || 0) < s.min).map((s) => s.id);
  return { used, short, over: used > GRID.total, ok: used === GRID.total && short.length === 0 };
}

// --- pack list ---------------------------------------------------------------------------

export const PACK_LIMIT = 10;
/** Cards: mass in tonnes, and whether a trip between the stars needs it. */
export const PACK_CARDS = Object.freeze([
  { id: 'patch', name: ['Shield patch rock', 'Rock for the shield'], t: 2.4, need: true },
  { id: 'filters', name: ['Spare water filters', 'Spare filters'], t: 0.8, need: true },
  { id: 'seeds', name: ['Seeds and algae starter', 'Seeds'], t: 0.3, need: true },
  { id: 'repair', name: ['Repair kit and 3-D printer', 'Repair kit'], t: 1.5, need: true },
  { id: 'medicine', name: ['Medicine and first aid', 'Medicine'], t: 0.6, need: true },
  { id: 'fuel', name: ['Spare fusion fuel', 'Spare fuel'], t: 3.2, need: true },
  { id: 'pool', name: ['A swimming pool', 'A swimming pool'], t: 4.5, need: false },
  { id: 'piano', name: ['A grand piano', 'A big piano'], t: 0.5, need: false },
  { id: 'car', name: ['A car', 'A car'], t: 1.3, need: false },
]);
const r1 = (x) => Math.round(x * 10) / 10;

export function packTotals(packed) {
  const set = new Set(packed);
  const mass = r1(PACK_CARDS.filter((c) => set.has(c.id)).reduce((a, c) => a + c.t, 0));
  const missing = PACK_CARDS.filter((c) => c.need && !set.has(c.id)).map((c) => c.id);
  const junk = PACK_CARDS.filter((c) => !c.need && set.has(c.id)).map((c) => c.id);
  return { mass, missing, junk, over: mass > PACK_LIMIT, ok: !missing.length && !junk.length && mass <= PACK_LIMIT };
}
export const packNeededMass = () => r1(PACK_CARDS.filter((c) => c.need).reduce((a, c) => a + c.t, 0));

/** The stations in the order the habitat walk visits them, with the crewmate who leads each. */
export const STATIONS = Object.freeze([
  { id: 'shield', lead: 'doctor', title: ['Shield check', 'Check the shield'] },
  { id: 'oxygen', lead: 'biologist', title: ['Make the air', 'Make air'] },
  { id: 'water', lead: 'biologist', title: ['The water loop', 'Clean the water'] },
  { id: 'food', lead: 'biologist', title: ['Plan the farm', 'Plan the farm'] },
  { id: 'energy', lead: 'signal', title: ['Share the power', 'Share the power'] },
  { id: 'pack', lead: 'builder', title: ['Pack for the stars', 'Pack the ship'] },
]);
