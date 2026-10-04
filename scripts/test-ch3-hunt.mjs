// Node test for Chapter 3's Hard-mode treasure hunt data and launch rule.
//   node scripts/test-ch3-hunt.mjs
// Covers: hunt data well formed at both Levels, places apart and on dry land,
// the last step at a home's door, decoys, that each clue's arithmetic really
// lands on the place it should (from the layout and the market's stall ring),
// the homes' layout, the launch gate, and the hunt engine running through a
// whole hunt and surviving a reload.

import { huntFor, launchGate, ITEM_NAME } from '../src/game/hunt.js';
import { HOMES, homeDoor, homeHalf, homeWidth } from '../src/game/homesLayout.js';
import { ROCKET_VILLAGE } from '../src/game/rocketVillageLayout.js';
import { createHunt } from '../src/play/hunt.js';
import { normalizeSave, defaultSave } from '../src/game/quests.js';

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); }
}

// village.js cannot load in node (import.meta.env), so its numbers are repeated
// here; they only need to be right to the nearest unit for a dry-land check.
const BOUNDS = { minX: -34, maxX: 34, minZ: -52, maxZ: 62 };
const riverCentre = (x) => 3 + Math.sin(x * 0.085) * 1.8 + Math.sin(x * 0.031 + 1.7) * 1.0;
const riverHalf = (x) => 3.2 + Math.sin(x * 0.13 + 0.6) * 0.6;
const inRiver = (x, z) => Math.abs(x - 0) > 1.0 && Math.abs(z - riverCentre(x)) < riverHalf(x) + 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const building = (id) => ROCKET_VILLAGE.buildings.find((b) => b.id === id);
const isPrime = (n) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);

// ---- the market's stall ring, as decoration.js builds it -------------------
const stallKinds = ['stall', 'stall-green', 'stall-red'];
const stallAngles = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + 0.31;
  const d = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
  if (d < 0.42 || Math.abs(d - Math.PI) < 0.42) continue;
  stallAngles.push(a);
}
const stalls = stallAngles.map((_, i) => stallKinds[i % 3]);
const greenStalls = stalls.filter((k) => k === 'stall-green').length;
const redStalls = stalls.filter((k) => k === 'stall-red').length;
ok(stalls.length === 8, `eight stalls round the fountain (got ${stalls.length})`);
ok(greenStalls === 3 && redStalls === 2, `3 green and 2 red stalls (got ${greenStalls}, ${redStalls})`);

// ---- the homes ---------------------------------------------------------------
ok(HOMES.length === 4, 'four homes');
ok(new Set(HOMES.map((h) => h.number)).size === 4, 'home numbers are distinct');
ok(HOMES.filter((h) => isPrime(h.number)).length === 1 && isPrime(HOMES.find((h) => h.number === 17).number), 'exactly one home number is prime (17)');
ok(HOMES.every((h) => h.number < 20), 'home numbers are below 20');
ok(new Set(HOMES.map((h) => `${h.windows}${h.roofName}`)).size === 4, 'homes differ in windows + roof colour');
for (let i = 0; i < HOMES.length; i++) {
  for (let j = i + 1; j < HOMES.length; j++) {
    const a = HOMES[i], b = HOMES[j];
    const ha = homeHalf(a), hb = homeHalf(b);
    const gapX = Math.abs(a.x - b.x) - ha.halfX - hb.halfX;
    const gapZ = Math.abs(a.z - b.z) - ha.halfZ - hb.halfZ;
    ok(Math.max(gapX, gapZ) >= 1.5, `${a.id} and ${b.id} do not touch (gap ${Math.max(gapX, gapZ).toFixed(1)})`);
    ok(dist(homeDoor(a), homeDoor(b)) >= 6.4, `${a.id} and ${b.id} doors are far enough apart for separate zones`);
  }
}
for (const h of HOMES) {
  const { halfX, halfZ } = homeHalf(h);
  ok(homeWidth(h) > 3 && homeWidth(h) < 6.5, `${h.id} is a sensible size`);
  ok(h.x - halfX > BOUNDS.minX + 3 && h.x + halfX < BOUNDS.maxX - 3 && h.z + halfZ < BOUNDS.maxZ - 3, `${h.id} inside the village`);
  ok(Math.abs(h.x) - halfX >= 3.5, `${h.id} leaves the main road clear`);
  // The market square (fountain at the hub) and the labs' ground are well away.
  ok(dist(h, ROCKET_VILLAGE.hub) > 12, `${h.id} is off the plaza`);
}

// ---- both Levels ---------------------------------------------------------------
const homeAt = (at) => HOMES.find((h) => dist(homeDoor(h), at) < 0.5);
for (const level of [1, 4]) {
  const L = `Level ${level}`;
  const data = huntFor(level);
  ok(typeof data.title === 'string' && data.title.length > 3, `${L}: title`);
  ok(data.itemName === ITEM_NAME && ITEM_NAME === 'Guidance Crystal', `${L}: item is the Guidance Crystal`);
  ok(typeof data.intro === 'string' && data.intro.length > 40, `${L}: intro`);
  ok(data.steps.length === 4, `${L}: four steps`);
  ok(new Set(data.steps.map((s) => s.id)).size === 4, `${L}: step ids distinct`);
  for (const s of data.steps) {
    ok(typeof s.clue === 'string' && s.clue.length > 30, `${L}/${s.id}: clue text`);
    ok(typeof s.found === 'string' && s.found.length > 5, `${L}/${s.id}: found text`);
    ok(Number.isFinite(s.at.x) && Number.isFinite(s.at.z), `${L}/${s.id}: a place`);
    ok(s.radius >= 2.5 && s.radius <= 6, `${L}/${s.id}: radius ${s.radius} is 2.5..6`);
    ok(s.at.x > BOUNDS.minX + 2 && s.at.x < BOUNDS.maxX - 2 && s.at.z > BOUNDS.minZ + 2 && s.at.z < BOUNDS.maxZ - 2, `${L}/${s.id}: inside the village`);
    ok(!inRiver(s.at.x, s.at.z), `${L}/${s.id}: not in the river`);
    // All places on the near bank, so the hunt can be played before the bridge is built.
    ok(s.at.z > riverCentre(s.at.x) + riverHalf(s.at.x) + 3, `${L}/${s.id}: on the near bank`);
  }
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      ok(dist(data.steps[i].at, data.steps[j].at) >= 12, `${L}: steps ${i + 1} and ${j + 1} are at least 12 apart`);
    }
  }
  const last = data.steps[3];
  const home = homeAt(last.at);
  ok(!!home, `${L}: the last step is at a home's door`);
  ok(last.radius <= 4, `${L}: the last step's zone is small`);

  // Decoys: the other homes, distinct, with kind text that does not leak.
  ok((data.decoys || []).length >= 2, `${L}: at least two decoys`);
  const decoyHomes = (data.decoys || []).map((d) => homeAt(d.at));
  ok(decoyHomes.every(Boolean), `${L}: decoys stand at homes`);
  ok(new Set(decoyHomes.map((h) => h && h.id)).size === decoyHomes.length, `${L}: decoys are different homes`);
  ok(!decoyHomes.includes(home), `${L}: the answer home is not a decoy`);
  for (const d of data.decoys) {
    ok(typeof d.text === 'string' && d.text.length > 15, `${L}: decoy text`);
    ok(/\b(not|no|nobody)\b/i.test(d.text), `${L}: decoy text says not here`);
    ok(!/\d/.test(d.text) && !HOMES.some((h) => d.text.includes(h.roofName) || d.text.includes(h.id)), `${L}: decoy text names nothing`);
    ok(dist(d.at, last.at) >= (d.radius ?? 3) + last.radius - 0.01, `${L}: a decoy zone does not overlap the answer's`);
  }

  // No clue hands over the answer.
  const all = data.steps.map((s) => s.clue).join(' ');
  ok(!all.includes(String(home && home.number)), `${L}: no clue spells the answer's number`);
  ok(!/fountain|mill|watermill/i.test(data.steps[2].clue) || level === 1, `${L}: clue 3 (${level}) is indirect`);
}

// ---- the clues' reasoning lands on the right places ----------------------------
const school = building('missionSchool');
const forge = building('materialsForge');
const lab = building('waterLab');
const tunnel = building('windTunnel');
const mill = { x: 16, z: 11.2 };
ok(school.z === forge.z && school.x < forge.x, 'the Mission School is due west of the Materials Forge');
ok(lab.z === tunnel.z && lab.x < tunnel.x, 'the River Flow Lab is due west of the Wind Tunnel');
ok(Math.abs(lab.x - school.x) <= 1.5 && lab.z < school.z, 'the River Flow Lab is (nearly) due north of the Mission School');

const L1 = huntFor(1);
const L4 = huntFor(4);
// Level 1: fountain; three green stalls -> the sign with three words (River Flow Lab); right of the river = east -> mill; 7 + 2 = 9.
ok(dist(L1.steps[0].at, ROCKET_VILLAGE.hub) < 1, 'L1 clue 1 is the fountain');
ok(dist(L1.steps[1].at, { x: lab.x, z: lab.z + 5.5 }) < 2.5, 'L1 clue 2 is in front of the River Flow Lab');
ok(greenStalls === 3, 'L1 clue 2 counts 3 green stalls = the 3 words of "River Flow Lab"');
ok(L1.steps[2].at.x > L1.steps[1].at.x && dist(L1.steps[2].at, mill) < 5, 'L1 clue 3 is the mill, east (to her right facing the river) of the lab');
ok(homeAt(L1.steps[3].at).number === 7 + 2, 'L1 clue 4: the home numbered 2 more than 7 is the answer');
// Level 4: midpoint, a quarter of the way, a quarter turn clockwise from north = east, the one prime.
const mid = { x: (school.x + lab.x) / 2, z: (school.z + lab.z) / 2 };
ok(dist(L4.steps[0].at, mid) < 1.5, 'L4 clue 1 is the midpoint between the Mission School and the River Flow Lab');
const quarter = { x: lab.x + (tunnel.x - lab.x) / 4, z: lab.z };
ok(dist(L4.steps[1].at, quarter) < 1.5, 'L4 clue 2 is a quarter of the way from the River Flow Lab to the Wind Tunnel');
ok(L4.steps[2].at.x > L4.steps[1].at.x && Math.abs(L4.steps[2].at.z - L4.steps[1].at.z) < 5 && dist(L4.steps[2].at, mill) < 5, 'L4 clue 3 is the mill, due east of clue 2');
ok(isPrime(homeAt(L4.steps[3].at).number), 'L4 clue 4: the answer home has the prime number');
ok(L1.steps[3].at !== L4.steps[3].at && homeAt(L1.steps[3].at) !== homeAt(L4.steps[3].at), 'the two Levels hide the crystal in different homes');
ok(/north|east|quarter|halfway|prime/i.test(L4.steps.map((s) => s.clue).join(' ')), 'Level 4 clues use compass, fractions and primes');
ok(!/\b(north|south|east|west|prime|quarter|halfway|clockwise)\b/i.test(L1.steps.map((s) => s.clue).join(' ')), 'Level 1 clues use no compass, fractions or primes');
ok(L1.steps.every((s) => s.clue.length <= 260) && L4.steps.every((s) => s.clue.length <= 330), 'clues stay short enough to read');

// ---- the launch gate --------------------------------------------------------------
const HARD = { id: 'hard', treasureHunt: true };
const EASY = { id: 'easy', treasureHunt: false };
ok(launchGate({ mode: HARD, found: false }).ok === false, 'Hard: launch refused before the crystal');
ok(/Guidance Crystal/.test(launchGate({ mode: HARD, found: false }).message), 'Hard: the refusal names the crystal');
ok(launchGate({ mode: HARD, found: true }).ok === true, 'Hard: launch allowed with the crystal');
ok(launchGate({ mode: EASY, found: false }).ok === true, 'Easy: launch never needs the crystal');
ok(launchGate({ mode: { id: 'medium', treasureHunt: false }, found: false }).ok === true, 'Medium: launch never needs the crystal');
ok(launchGate({ found: false }).ok === true, 'no mode: launch allowed');

// ---- the save --------------------------------------------------------------------
ok(defaultSave().huntFound === false, 'a new save has huntFound false');
const old = defaultSave();
delete old.huntFound;
ok(normalizeSave(old).huntFound === false, 'an old save without huntFound loads as false');
ok(normalizeSave({ ...defaultSave(), huntFound: true }).huntFound === true, 'huntFound true survives normalisation');
ok(normalizeSave({ ...defaultSave(), huntFound: 'yes' }).huntFound === false, 'junk huntFound becomes false');

// ---- a whole hunt through the engine, with a reload -------------------------------
function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
for (const level of [1, 4]) {
  const data = huntFor(level);
  const storage = memStore();
  const key = `test_hunt_${level}`;
  let foundCalls = 0;
  const shown = [];
  let h = createHunt({ data, storageKey: key, storage, onFound: () => { foundCalls++; }, onClue: (t) => shown.push(t), foundCard: false });
  h.start();
  ok(shown.length === 1 && shown[0].includes(data.intro), `L${level}: starting shows the intro with clue 1`);
  ok(h.tryHere({ x: data.steps[3].at.x, z: data.steps[3].at.z }) === null, `L${level}: the answer home does nothing before its turn`);
  ok(h.current().id === data.steps[0].id, `L${level}: skipping ahead does not advance`);
  // A decoy home gives a decoy result and no progress.
  const dec = data.decoys[0];
  const r = h.tryHere({ x: dec.at.x, z: dec.at.z });
  ok(r && r.kind === 'decoy' && h.current().id === data.steps[0].id, `L${level}: a decoy home changes nothing`);
  for (let i = 0; i < 3; i++) {
    const res = h.tryHere({ x: data.steps[i].at.x, z: data.steps[i].at.z });
    ok(res && res.kind === 'step', `L${level}: step ${i + 1} reached`);
  }
  // Reload mid-hunt: progress is kept.
  h = createHunt({ data, storageKey: key, storage, onFound: () => { foundCalls++; }, onClue: () => {}, foundCard: false });
  ok(h.current().id === data.steps[3].id, `L${level}: a reload keeps the hunt at clue 4`);
  const fin = h.tryHere({ x: data.steps[3].at.x, z: data.steps[3].at.z });
  ok(fin && fin.kind === 'found' && foundCalls === 1 && h.isFound(), `L${level}: the crystal is found at the last home`);
  h = createHunt({ data, storageKey: key, storage, foundCard: false });
  ok(h.isFound(), `L${level}: found survives a reload`);
}

if (failures.length) {
  console.error(`\n${failures.length} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`ch3 hunt: all ${passed} checks passed`);
