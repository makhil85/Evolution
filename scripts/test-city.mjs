// Node test for Chapter 2's rules and questions (no browser).
//   node scripts/test-city.mjs
// Covers: every question well formed at both Levels, known answers, quest
// counts, the unlock rules, the recipe spend and "missing" message, old-save
// normalisation, and pickup persistence across a reload.

import { questionsFor } from '../src/city/questions.js';
import { createCityRules } from '../src/city/rules.js';
import {
  STORE_KEYS, QUEST_IDS, MEDIUM_QUESTS, QUEST_TO_BUILD, MAX_PIECES, RECIPE, RESOURCE_KEYS,
} from '../src/city/contracts.js';
import { PICKUPS, stationsFor } from '../src/city/layout.js';
import { checkAnswer } from '../src/game/questions.js';
import { readMs, needsClick } from '../src/play/readTime.js';

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); }
}
function eq(actual, expected, name) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`); }
}

/** A Storage stand-in that lives in a Map (shared between "reloads"). */
function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m,
  };
}
const fresh = (level, storage = memStore()) => createCityRules({ level, storage });

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const qs = questionsFor(level);
  const ids = QUEST_IDS[level];
  eq(Object.keys(qs).sort(), [...ids].sort(), `L${level}: question ids match QUEST_IDS`);
  eq(ids.length, level === 1 ? 6 : 8, `L${level}: quest count`);
  eq(stationsFor(level).map((s) => s.quest).sort(), [...ids].sort(), `L${level}: stations match quests`);

  for (const id of ids) {
    const q = qs[id];
    const tag = `L${level} ${id}`;
    ok(q.id === id, `${tag}: id`);
    ok(typeof q.title === 'string' && q.title.length > 3, `${tag}: title`);
    ok(typeof q.prompt === 'string' && q.prompt.length > 10, `${tag}: prompt`);
    ok(q.type === 'choice' || q.type === 'text', `${tag}: type`);
    ok(typeof q.hint === 'string' && q.hint.length > 5, `${tag}: hint`);
    ok(typeof q.success === 'string' && q.success.startsWith('Correct.'), `${tag}: success`);
    ok(typeof q.doneMessage === 'string' && q.doneMessage.length > 10, `${tag}: doneMessage`);
    ok(q.reward && Object.keys(q.reward).length > 0
      && Object.entries(q.reward).every(([r, v]) => RESOURCE_KEYS.includes(r) && Number.isInteger(v) && v > 0), `${tag}: reward`);
    ok(q.visual && Array.isArray(q.visual.rows) && q.visual.rows.length > 0
      && q.visual.rows.every((r) => typeof r.label === 'string' && Array.isArray(r.tiles) && r.tiles.length > 0
        && r.tiles.every((t) => typeof t === 'string' && t.length > 0)), `${tag}: visual rows/tiles`);
    if (q.type === 'choice') {
      ok(Array.isArray(q.choices) && q.choices.length >= 3, `${tag}: choices`);
      eq(q.choices.filter((c) => c.correct === true).length, 1, `${tag}: exactly one correct choice`);
      ok(q.choices.every((c) => typeof c.text === 'string' && c.text.length > 0 && !/^\s*\d+\s*$/.test(c.text)), `${tag}: no bare-number choice`);
      const right = q.choices.find((c) => c.correct);
      ok(checkAnswer(q, right), `${tag}: checker accepts the right choice`);
      ok(q.choices.filter((c) => !c.correct).every((c) => !checkAnswer(q, c)), `${tag}: checker rejects wrong choices`);
    } else {
      ok(Array.isArray(q.answers) && q.answers.length > 0 && q.answers.every((a) => typeof a === 'string' && a.trim()), `${tag}: answers`);
      ok(q.answers.every((a) => checkAnswer(q, a)), `${tag}: checker accepts every listed answer`);
      ok(!checkAnswer(q, '999') && !checkAnswer(q, ''), `${tag}: checker rejects nonsense`);
    }
  }
}

// Known answers (Level 4 from the plan; Level 1 derived from its file).
const q4 = questionsFor(4);
const q1 = questionsFor(1);
const text = (q, a) => q.type === 'text' && checkAnswer(q, a);
const pick = (q, t) => q.type === 'choice' && checkAnswer(q, q.choices.find((c) => c.text === t) || {});
ok(text(q4.water, '23') && !text(q4.water, '22'), 'L4 water = 23');
ok(pick(q4.gear, 'Red') && !pick(q4.gear, 'Blue'), 'L4 gear = Red');
ok(text(q4.tile, '10') && !text(q4.tile, '5'), 'L4 tile = 10');
ok(text(q4.bridge, '5') && text(q4.bridge, 'five planks'), 'L4 bridge = 5');
ok(text(q4.key, '1') && !text(q4.key, '2'), 'L4 key = 1');
ok(pick(q4.power, 'Same toy car, same floor, same starting line'), 'L4 power answer');
ok(pick(q4.solar, 'West, away from the Sun'), 'L4 solar answer');
ok(pick(q4.magnet, 'The magnet attracts some metals, especially iron or steel'), 'L4 magnet answer');

ok(text(q1.water, '6') && text(q1.water, 'six') && !text(q1.water, '12'), 'L1 water = 6');
ok(pick(q1.gear, 'Clockwise ↻'), 'L1 gear = Clockwise');
ok(pick(q1.power, 'A only'), 'L1 power = A only');
ok(pick(q1.tile, 'Circle ○'), 'L1 tile = Circle');
ok(text(q1.bridge, '5') && text(q1.bridge, 'five'), 'L1 bridge = 5');
ok(text(q1.key, '63') && text(q1.key, 'sixty-three') && !text(q1.key, '36'), 'L1 key = 63');

// Level 1 has its own wording; an unknown level means Level 4.
ok(q1.water.title !== q4.water.title, 'levels have different water questions');
eq(Object.keys(questionsFor(2)).length, 8, 'unknown level -> Level 4 bank');
const copy = questionsFor(4); copy.water.title = 'changed';
ok(questionsFor(4).water.title !== 'changed', 'questionsFor returns fresh copies');

// ---------------------------------------------------------------------------
// Unlock rules
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const r = fresh(level);
  ok(!r.bridgeUnlocked(), `${tag}: bridge locked at start`);
  const refused = r.openQuest('bridge');
  ok(refused.ok === false && (level === 1 ? /gold lock is closed/ : /golden bridge lock is still closed/).test(refused.text), `${tag}: bridge quest refused while locked`);
  ok(r.solveQuest('bridge') === null, `${tag}: bridge cannot be solved while locked`);
  const meds = MEDIUM_QUESTS[level];
  for (let i = 0; i < 3; i++) {
    const o = r.openQuest(meds[i]);
    ok(o.ok && o.question.id === meds[i], `${tag}: open medium ${meds[i]}`);
    r.solveQuest(meds[i]);
    eq(r.bridgeUnlocked(), i === 2, `${tag}: bridge unlocked only after 3 mediums (after ${i + 1})`);
  }
  eq(r.mediumSolvedCount(), 3, `${tag}: mediumSolvedCount`);
  const opened = r.openQuest('bridge');
  ok(opened.ok && opened.question.id === 'bridge', `${tag}: bridge quest opens once unlocked`);

  // The hard key quest alone also opens it.
  const k = fresh(level);
  ok(k.openQuest('key').ok, `${tag}: key quest opens from the start`);
  k.solveQuest('key');
  ok(k.bridgeUnlocked() && k.mediumSolvedCount() === 0, `${tag}: key alone opens the bridge`);
  ok(k.openQuest('bridge').ok, `${tag}: bridge opens after key`);
}
ok(fresh(4).state.solved.solar === false && !('solar' in fresh(1).state.solved), 'solar/magnet only exist at Level 4');
{
  // Level 4 counts solar + magnet as mediums.
  const r = fresh(4);
  for (const q of ['solar', 'magnet', 'water']) r.solveQuest(q);
  ok(r.bridgeUnlocked(), 'L4: solar + magnet + water unlock the bridge');
}

// ---------------------------------------------------------------------------
// solveQuest: rewards, no `built`, repeat protection, texts
// ---------------------------------------------------------------------------
{
  const r = fresh(4);
  const before = { ...r.state.resources };
  const res = r.solveQuest('water');
  eq(res.target, 'pump', 'solve water -> pump');
  eq(res.pieces, 3, 'pump has 3 pieces');
  eq(res.reward, { energy: 4, blueprints: 1, science: 3 }, 'solve water reward');
  ok(res.text === `${q4.water.success} Watch the city change piece by piece.`, 'solve toast is success + watch line');
  ok(res.doneMessage === q4.water.doneMessage, 'doneMessage carried');
  eq(r.state.resources.energy, before.energy + 4, 'reward added');
  ok(r.state.solved.water === true, 'water solved');
  eq(r.state.built.pump, 0, 'solveQuest does not set built');
  ok(!r.questStructureBuilt('water'), 'structure not built until setBuilt');
  for (let n = 1; n <= 3; n++) r.setBuilt('pump', n);
  ok(r.questStructureBuilt('water'), 'structure built after 3 pieces');
  r.setBuilt('pump', 99);
  eq(r.state.built.pump, 3, 'setBuilt clamps to max');
  ok(r.solveQuest('water') === null, 'cannot solve twice (no double reward)');
  const again = r.openQuest('water');
  ok(!again.ok && /already solved/.test(again.text), 'solved quest refuses to open');
  for (const [q, t] of Object.entries(QUEST_TO_BUILD)) {
    const s = fresh(4);
    s.solveQuest('key');
    if (q === 'bridge') {
      const b = s.solveQuest('bridge');
      eq(b.pieces, MAX_PIECES.bridge, 'bridge has 5 pieces');
    } else if (q !== 'key') {
      eq(s.solveQuest(q).target, t, `quest ${q} builds ${t}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Workshop: recipe spend, missing message, gating
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const r = fresh(level);
  let c = r.workshopCheck();
  ok(!c.ok && (level === 1 ? /needs the bridge\./ : /needs the unlocked bridge route first/).test(c.text), `${tag}: workshop refused before the bridge`);

  r.solveQuest('key');
  r.solveQuest('bridge');
  c = r.workshopCheck();
  ok(!c.ok && c.text.startsWith(level === 1 ? 'You need more: ' : 'Collect more resources before building: '), `${tag}: workshop refused without resources`);
  ok(c.missing.includes(`wood ${r.state.resources.wood}/24`) && c.missing.every((m) => /^[a-z]+ \d+\/\d+$/.test(m)), `${tag}: missing entries look like "wood 5/24"`);
  ok(c.text.endsWith('.') && c.text.includes(c.missing.join(', ')), `${tag}: missing message lists them`);
  const s0 = JSON.stringify(r.state.resources);
  ok(!r.startWorkshop().ok && JSON.stringify(r.state.resources) === s0 && !r.state.builtFinal, `${tag}: refused start spends nothing`);

  // Give her a little more than the recipe.
  for (const k of RESOURCE_KEYS) r.state.resources[k] = RECIPE[k] + 3;
  c = r.workshopCheck();
  ok(c.ok && c.missing.length === 0, `${tag}: workshop ok with the recipe`);
  const go = r.startWorkshop();
  ok(go.ok && go.target === 'workshop' && go.pieces === 4, `${tag}: startWorkshop`);
  ok(/Chapter 3 is (unlocked|open)/.test(go.doneMessage), `${tag}: workshop done message`);
  eq(r.state.resources, Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 3])), `${tag}: recipe spent exactly`);
  ok(r.state.builtFinal === true, `${tag}: builtFinal set`);
  ok(/already built|is built/.test(r.workshopCheck().text) && !r.startWorkshop().ok, `${tag}: cannot build twice`);
  eq(r.state.resources.wood, 3, `${tag}: second start spends nothing`);
  for (let n = 1; n <= 4; n++) r.setBuilt('workshop', n);
  eq(r.state.built.workshop, 4, `${tag}: workshop at 4 pieces`);
}

// ---------------------------------------------------------------------------
// Save format: round trip, launcher flag, old saves
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const store = memStore();
  const r = fresh(level, store);
  r.solveQuest('key');
  r.solveQuest('bridge');
  r.state.builtFinal = true;
  r.setBuilt('workshop', 4);
  r.save();
  const blob = JSON.parse(store.getItem(STORE_KEYS[level]));
  ok(blob.builtFinal === true, `${tag}: launcher flag builtFinal saved under STORE_KEYS`);
  ok(Array.isArray(blob.collected), `${tag}: collected saved`);
  ok(blob.player && typeof blob.player.x === 'number' && blob.resources && blob.solved && blob.built, `${tag}: old-format fields present`);
  const back = fresh(level, store);
  ok(back.state.builtFinal && back.state.solved.key && back.state.solved.bridge, `${tag}: reload keeps progress`);
}

{
  // A save written by the OLD game (Level 4): no `collected`, a solved quest
  // whose pieces were mid-build, builtFinal with the workshop not yet raised.
  const store = memStore();
  store.setItem(STORE_KEYS[4], JSON.stringify({
    player: { x: 9, y: 17 },
    playerName: 'Mira',
    characterId: 'c3',
    resources: { wood: 30, stone: 30, metal: 3, energy: 1, blueprints: 2, science: 4 },
    solved: { bridge: true, water: true, gear: false, power: true, tile: true, solar: false, magnet: false, key: false },
    built: { bridge: 5, pump: 1, machine: 0, power: 3, academy: 2, solar: 0, magnet: 0, vault: 0, workshop: 0 },
    builtFinal: true,
    message: 'Engineering Workshop complete! Chapter 3 is unlocked.',
  }));
  const r = fresh(4, store);
  eq(r.state.player, { x: 9, y: 17 }, 'old save: player kept');
  eq(r.state.playerName, 'Mira', 'old save: name kept');
  eq(r.state.collected, [], 'old save: collected defaults to []');
  eq(r.state.built.pump, 3, 'old save: solved water -> pump at max');
  eq(r.state.built.academy, 3, 'old save: solved tile -> academy at max');
  eq(r.state.built.machine, 0, 'old save: unsolved gear stays unbuilt');
  eq(r.state.built.workshop, 4, 'old save: builtFinal -> workshop 4');
  ok(r.state.builtFinal, 'old save: builtFinal kept');
  ok(r.bridgeUnlocked() && r.questStructureBuilt('bridge'), 'old save: bridge open and built');
  ok(!r.isCollected(1), 'old save: nothing collected');
  eq(r.state.resources.wood, 30, 'old save: resources kept');

  // A Level 1 old save (no solar / magnet keys at all) loads at Level 1.
  const s1 = memStore();
  s1.setItem(STORE_KEYS[1], JSON.stringify({
    player: { x: 5, y: 17 }, playerName: '', characterId: null,
    resources: { wood: 0, stone: 0, metal: 0, energy: 0, blueprints: 0, science: 0 },
    solved: { bridge: false, water: true, gear: false, power: false, tile: false, key: false },
    built: { bridge: 0, pump: 0, machine: 0, power: 0, academy: 0, vault: 0, workshop: 0 },
    builtFinal: false, message: 'x',
  }));
  const r1 = fresh(1, s1);
  eq(r1.state.built.pump, 3, 'L1 old save: water -> pump 3');
  eq(Object.keys(r1.state.solved).sort(), [...QUEST_IDS[1]].sort(), 'L1 old save: only Level 1 quests');

  // Junk in the store falls back to a fresh game rather than throwing.
  const bad = memStore();
  bad.setItem(STORE_KEYS[4], '{not json');
  eq(fresh(4, bad).state.builtFinal, false, 'corrupt save -> fresh state');
  const partial = memStore();
  partial.setItem(STORE_KEYS[4], JSON.stringify({ resources: { wood: 7 } }));
  const pr = fresh(4, partial);
  ok(pr.state.resources.wood === 7 && pr.state.resources.science === 0 && pr.state.solved.key === false && pr.state.built.workshop === 0
    && pr.state.player.x === 5 && Array.isArray(pr.state.collected), 'partial save: missing fields defaulted');
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
{
  const store = memStore();
  const r = fresh(4, store);
  const p = PICKUPS[0];
  ok(!r.isCollected(p.id), 'pickup not collected at start');
  const got = r.collect(p.id);
  ok(got && got.res === p.res && got.amount === p.amount, 'collect returns res/amount');
  ok(got.text === `Collected construction wood: +${p.amount} wood.`, 'collect text uses the old wording');
  eq(r.state.resources[p.res], p.amount, 'collect adds resources');
  ok(r.isCollected(p.id) && r.collect(p.id) === null, 'a pickup can only be taken once');
  eq(r.state.resources[p.res], p.amount, 'second collect adds nothing');
  ok(r.collect(999999) === null, 'unknown pickup id -> null');

  const stone = PICKUPS.find((x) => x.type === 'stoneBlock');
  const energy = PICKUPS.find((x) => x.type === 'energyCell');
  const bp = PICKUPS.find((x) => x.type === 'blueprint');
  const metal = PICKUPS.find((x) => x.type === 'metalScrap');
  ok(r.collect(stone.id).text.startsWith('Collected stone blocks: +'), 'stone text');
  ok(r.collect(metal.id).text.startsWith('Collected metal scrap: +'), 'metal text');
  ok(r.collect(energy.id).text.startsWith('Collected energy cell: +'), 'energy text');
  ok(r.collect(bp.id).text.startsWith('Collected blueprint page: +'), 'blueprint text');

  // No explicit save() call: collect persists by itself, and survives a reload.
  const back = fresh(4, store);
  ok(back.isCollected(p.id) && back.isCollected(stone.id), 'collected persists across reload');
  eq(back.state.resources.wood, p.amount, 'resources persist across reload');
  ok(back.collect(p.id) === null, 'still cannot re-collect after reload');

  // A different Level has its own save.
  ok(!fresh(1, store).isCollected(p.id), 'Level 1 save is separate from Level 4');

  // Reset clears everything, in place.
  const st = back.state;
  back.reset();
  ok(back.state === st && !back.isCollected(p.id) && back.state.resources.wood === 0, 'reset clears state in place');
  ok(!fresh(4, store).isCollected(p.id), 'reset clears the saved blob');

  eq(PICKUPS.length, 86, '86 pickups');
  ok(new Set(PICKUPS.map((x) => x.id)).size === 86, 'pickup ids are unique');
}

// ---------------------------------------------------------------------------
// HUD text: progress, mission lines, badges
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const r = fresh(level);
  eq(r.progress(), { pct: 0, status: level === 1 ? 'Build the Workshop' : 'Build the Engineering Workshop' }, `${tag}: progress at start`);
  let lines = r.missionLines();
  eq(lines.length, 3, `${tag}: 3 mission lines at start`);
  ok(lines[0] === (level === 1 ? 'Solve 3 puzzles to open the bridge (0/3).' : 'Open the bridge: solve any 3 medium quests (0/3) or the hard one.'), `${tag}: first mission line`);
  r.solveQuest(MEDIUM_QUESTS[level][0]);
  eq(r.progress().pct, 20, `${tag}: 1 medium = 20%`);
  r.solveQuest(MEDIUM_QUESTS[level][1]);
  r.solveQuest(MEDIUM_QUESTS[level][2]);
  eq(r.progress().pct, 60, `${tag}: 3 mediums = 60%`);
  ok(r.missionLines()[0].startsWith(level === 1 ? 'The gold lock is open' : 'The golden lock at the moat is open'), `${tag}: bridge-open mission line`);
  r.solveQuest('bridge');
  eq(r.progress().pct, 80, `${tag}: bridge = 80%`);
  ok(r.missionLines()[0].startsWith('Cross the bridge'), `${tag}: cross-the-bridge line`);
  r.state.builtFinal = true;
  eq(r.progress(), { pct: 100, status: level === 1 ? 'Workshop built' : 'Engineering Workshop built' }, `${tag}: progress at the end`);
  eq(r.missionLines(), [level === 1 ? 'Go back to the chapters.' : 'Go back to the chapters to continue.'], `${tag}: end mission line`);

  const fk = fresh(level);
  fk.solveQuest('key');
  eq(fk.progress().pct, 60, `${tag}: key alone = 60%`);

  const b = r.badges();
  eq(b.length, level === 1 ? 7 : 9, `${tag}: badge count`);
  ok(b[b.length - 1].label === 'Workshop' && b[b.length - 1].done, `${tag}: workshop badge last and done`);
  ok(b[0].label === 'Bridge' && b[0].done, `${tag}: bridge badge`);
  ok(level === 4 ? b.some((x) => x.label === 'Solar Lab') : !b.some((x) => x.label === 'Solar Lab'), `${tag}: solar badge only at Level 4`);
}
eq(fresh(4).recipeText(), 'Workshop recipe: Wood 24, Stone 28, Metal 20, Energy 10, Blueprints 5, Science 10.', 'recipe text');

// ---------------------------------------------------------------------------
// Play modes: the treasure hunt (Hard) and the build gate
// ---------------------------------------------------------------------------
import { huntFor, homes } from '../src/city/hunt.js';
import { tileToWorld, worldToTile, inMap } from '../src/city/contracts.js';
import { TOWN_BUILDINGS, STATIONS, isRiver, isRoad } from '../src/city/layout.js';

const TOWN_HALF = { house: 1.3, scienceCenter: 1.55, cityHall: 1.6, supplyDepot: 1.55 };   // worldTown.js footprints

/** Conservative walkability: inside the map, not water, not inside a building, not on a console tile. */
function walkable(x, z) {
  const { tx, ty } = worldToTile(x, z);
  if (!inMap(tx, ty) || isRiver(tx, ty)) return false;
  for (const b of TOWN_BUILDINGS) {
    const c = tileToWorld(b.tx, b.ty);
    const half = (TOWN_HALF[b.type] ?? 1.3) + 0.1;
    if (Math.abs(x - c.x) <= half && Math.abs(z - c.z) <= half) return false;
  }
  if (STATIONS.some((st) => st.tx === tx && st.ty === ty)) return false;
  return true;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const HOMES = homes();
eq(HOMES.map((h) => [h.label, h.door]), [['Engineer House', { tx: 3, ty: 14 }], ['Town House', { tx: 18, ty: 23 }]], 'two homes and their door tiles');

for (const level of [1, 4]) {
  const tag = `L${level} hunt`;
  const h = huntFor(level);
  ok(h.title && h.itemName === 'Master Gear' && h.intro.length > 40, `${tag}: title, item, intro`);
  eq(h.steps.length, 4, `${tag}: 4 steps`);
  h.steps.forEach((st, i) => {
    ok(typeof st.id === 'string' && st.id, `${tag}: step ${i} id`);
    ok(Number.isFinite(st.at.x) && Number.isFinite(st.at.z), `${tag}: step ${i} at`);
    ok(st.radius > 0.5 && st.radius <= 3, `${tag}: step ${i} radius`);
    ok(st.clue.length > 30 && st.found.length > 10, `${tag}: step ${i} clue and found text`);
    ok(walkable(st.at.x, st.at.z), `${tag}: step ${i} stands on walkable ground`);
    const t = worldToTile(st.at.x, st.at.z);
    ok(isRoad(t.tx, t.ty), `${tag}: step ${i} is on a road tile (no scenery on it)`);
  });
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = h.steps[i], b = h.steps[j];
      ok(dist(a.at, b.at) > (a.radius + b.radius), `${tag}: steps ${i} and ${j} do not overlap`);
    }
  }
  const last = h.steps[3];
  const target = HOMES.find((q) => dist(q.at, last.at) <= 2.5);
  ok(!!target, `${tag}: last step is within 2.5 of a home's door tile`);
  ok(last.found.includes('Master Gear'), `${tag}: last step names the Master Gear`);
  ok(h.decoys.length >= 2, `${tag}: at least two decoys`);
  ok(h.decoys.some((d) => HOMES.find((q) => q !== target && dist(q.at, d.at) <= 2.5)), `${tag}: the other home is a decoy`);
  ok(h.decoys.every((d) => d.text.startsWith('Not here') && !/Town House|Master Gear/i.test(d.text) && walkable(d.at.x, d.at.z)), `${tag}: decoys are walkable and do not give the answer`);
  ok(h.decoys.every((d) => h.steps.every((st) => dist(d.at, st.at) > d.radius + st.radius)), `${tag}: decoys do not overlap clue places`);
  eq(target.label, 'Town House', `${tag}: the Master Gear is in the Town House`);

  // The clues really lead where the data says (solve them from the layout).
  const near = (step, label, r = 3.0) => { const b = TOWN_BUILDINGS.find((q) => q.label === label); return dist(step.at, tileToWorld(b.tx, b.ty)) <= r; };
  ok(near(h.steps[0], 'City Hall'), `${tag}: clue 1 leads to City Hall`);
  const northmost = [...TOWN_BUILDINGS].sort((a, b) => a.ty - b.ty)[0];
  eq(northmost.label, 'City Hall', `${tag}: City Hall is the northernmost building`);
  if (level === 1) {
    ok(near(h.steps[1], 'Science Center'), 'L1 clue 2 leads to the Science Center');
    const sc = TOWN_BUILDINGS.find((q) => q.label === 'Science Center');
    const eng = TOWN_BUILDINGS.find((q) => q.label === 'Engineer House');
    const tw = TOWN_BUILDINGS.find((q) => q.label === 'Town House');
    const d = (a, b) => dist(tileToWorld(a.tx, a.ty), tileToWorld(b.tx, b.ty));
    ok(d(eng, sc) < d(tw, sc), 'L1 clue 4: the Engineer House is the home close to the Science Center');
    const t3 = worldToTile(h.steps[2].at.x, h.steps[2].at.z);
    ok(t3.ty === 17 && isRoad(t3.tx, 17) && !isRoad(t3.tx + 2, 17), 'L1 clue 3 stands at the east end of the long road');
    ok(!isRoad(25, 17), 'L1 clue 3: the long road stops before the water');
  } else {
    const west = TOWN_BUILDINGS.filter((b) => b.tx === 3).sort((a, b) => a.ty - b.ty);
    eq(west.map((b) => b.label), ['City Hall', 'Engineer House', 'Science Center', 'Supply Depot'], 'L4 clue 2: four buildings in the west column');
    ok(near(h.steps[1], west[3].label), 'L4 clue 2: building number 4 (= the 4 pillars) is the Supply Depot');
    // Crossroads along row 17 east of the Science Center door: roads crossing it.
    const xs = [];
    for (let x = 3; x <= 24; x++) if (isRoad(x, 17) && (isRoad(x, 16) || isRoad(x, 18))) xs.push(x);
    eq(xs, [5, 15, 23], 'L4 clue 3: three crossroads along the long road');
    const num = west.length / 2 + 1;
    eq(num, 3, 'L4 clue 3: half of 4, plus 1 = 3');
    ok(dist(h.steps[2].at, tileToWorld(xs[num - 1], 17)) < 0.01, 'L4 clue 3 stands in crossroad number 3');
    const town = TOWN_BUILDINGS.find((q) => q.label === 'Town House');
    const eng = TOWN_BUILDINGS.find((q) => q.label === 'Engineer House');
    ok(HOMES.find((q) => q.label === 'Town House').door.tx > town.tx && HOMES.find((q) => q.label === 'Engineer House').door.ty > eng.ty, 'L4 clue 4: the Town House door faces east, the Engineer House door faces south');
  }
}
ok(huntFor(1) !== huntFor(4) && huntFor(1).steps[0].clue !== huntFor(4).steps[0].clue, 'the two Levels have their own clues');
eq(huntFor(2), huntFor(4), 'unknown level -> Level 4 clues');

// The final build on Hard needs the Master Gear.
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const ready = (store) => {
    const r = fresh(level, store);
    for (const q of MEDIUM_QUESTS[level].slice(0, 3)) r.solveQuest(q);
    r.solveQuest('bridge');
    for (const k of RESOURCE_KEYS) r.state.resources[k] = 99;
    return r;
  };
  eq(fresh(level).isHuntRequired(), false, `${tag}: the hunt is not required by default`);
  const store = memStore();
  const r = ready(store);
  r.setHuntRequired(true);
  const before = JSON.stringify(r.state.resources);
  const c = r.workshopCheck();
  ok(!c.ok && c.text === (level === 1 ? 'The Workshop needs its Master Gear. Press the 📜 Clue button to read the clues.' : 'The Workshop needs its Master Gear. Follow the clues - read them again with the 📜 Clue button.'), `${tag}: Hard refuses the workshop without the Master Gear`);
  const go = r.startWorkshop();
  ok(!go.ok && !r.state.builtFinal && JSON.stringify(r.state.resources) === before, `${tag}: refused build spends nothing`);
  r.setHuntRequired(false);
  ok(r.workshopCheck().ok, `${tag}: switching away from Hard lifts the requirement`);
  r.setHuntRequired(true);
  eq(r.huntFound(), false, `${tag}: not found yet`);
  r.markHuntFound();
  ok(r.huntFound() && r.state.huntFound === true, `${tag}: found flag set`);
  ok(r.workshopCheck().ok && r.startWorkshop().ok && r.state.builtFinal, `${tag}: Hard allows the workshop once the Master Gear is found`);
  const back = fresh(level, store);
  ok(back.huntFound() && back.state.huntFound === true, `${tag}: found flag survives a reload`);
  const easy = ready(memStore());
  ok(!easy.isHuntRequired() && easy.startWorkshop().ok, `${tag}: Easy / Medium build without the hunt`);
  const other = fresh(level);
  other.setHuntRequired(true); other.markHuntFound();
  ok(other.workshopCheck().text.startsWith(level === 1 ? 'Workshop needs the bridge.' : 'The workshop needs the unlocked bridge route first'), `${tag}: with the gear found the normal refusals apply`);
  const old = memStore();
  old.setItem(STORE_KEYS[level], JSON.stringify({ resources: { wood: 3 }, builtFinal: false, message: 'hi', collected: [1] }));
  const o = fresh(level, old);
  ok(o.state.huntFound === false && o.state.resources.wood === 3 && o.state.collected.length === 1, `${tag}: old save loads with huntFound false`);
  o.reset();
  ok(o.state.huntFound === false, `${tag}: reset clears the found flag`);
}

// ---------------------------------------------------------------------------
// --- the messages a child reads (lead 2026-10-09) ----------------------------
// Each one stays up readMs(text) (5-10 s), or is an OK card when it needs more
// than 10 s (src/game/hud.js). Level 1 wording is short, so its messages must
// all be toasts, never cards.
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const solve = fresh(level).solveQuest('water');
  const ms = readMs(solve.text);
  ok(ms >= 5000 && ms <= 10000, `${tag} solve: readMs is 5-10 s (${ms} ms)`);
  if (level === 1) ok(!needsClick(solve.text), `${tag} solve: Level 1 reads as a toast, not a card`);
}

console.log(`${passed} checks passed${failures.length ? `, ${failures.length} FAILED` : ''}`);
if (failures.length) {
  console.error(failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
