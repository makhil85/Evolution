// Node test for Chapter 1's rules and questions (no browser).
//   node scripts/test-science.mjs
// Covers: every question well formed at both Levels, known answers, the smart
// and brute paths, locked iron, the build gates and the exact recipe spend,
// old-save loading, pickup persistence across a reload, and HUD text.

import { questionsFor } from '../src/science/questions.js';
import { createScienceRules } from '../src/science/rules.js';
import {
  STORE_KEYS, QUEST_IDS, RECIPES, RESOURCE_KEYS, SCIENCE_CENTER_PIECES,
} from '../src/science/contracts.js';
import { PICKUPS, STATIONS } from '../src/science/layout.js';
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
const fresh = (level, storage = memStore()) => createScienceRules({ level, storage });

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const qs = questionsFor(level);
  eq(Object.keys(qs).sort(), [...QUEST_IDS].sort(), `L${level}: question ids match QUEST_IDS`);
  eq(STATIONS.map((s) => s.quest).sort(), ['energy', 'force', 'm1', 'm2', 'm3'], `L${level}: stations are the 5 non-key quests`);

  for (const id of QUEST_IDS) {
    const q = qs[id];
    const tag = `L${level} ${id}`;
    ok(q.id === id && q.stationId === id, `${tag}: id / stationId`);
    ok(typeof q.title === 'string' && q.title.length > 3, `${tag}: title`);
    ok(typeof q.prompt === 'string' && q.prompt.length > 10, `${tag}: prompt`);
    ok(q.type === 'choice' || q.type === 'text', `${tag}: type`);
    ok(typeof q.hint === 'string' && q.hint.length > 5, `${tag}: hint`);
    ok(typeof q.success === 'string' && q.success.startsWith('Correct.'), `${tag}: success`);
    ok(q.reward && Object.keys(q.reward).join() === 'science'
      && Number.isInteger(q.reward.science) && q.reward.science > 0, `${tag}: science reward`);
    if (level === 1) {
      ok(q.visual && Array.isArray(q.visual.rows) && q.visual.rows.length > 0
        && q.visual.rows.every((r) => typeof r.label === 'string' && Array.isArray(r.tiles) && r.tiles.length > 0
          && r.tiles.every((t) => typeof t === 'string' && t.length > 0)), `${tag}: visual rows/tiles`);
    } else {
      ok(!q.visual || q.visual.rows.length === 0, `${tag}: Level 4 has no visual`);
    }
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
  const t = (q) => qs[q].type;
  eq(['m1', 'm2', 'm3', 'key'].map(t), ['text', 'text', 'text', 'text'], `L${level}: math boards and key are typed answers`);
  eq(['force', 'energy'].map(t), ['choice', 'choice'], `L${level}: labs are multiple choice`);
}

const q4 = questionsFor(4);
const q1 = questionsFor(1);
const text = (q, a) => q.type === 'text' && checkAnswer(q, a);
const pick = (q, t) => q.type === 'choice' && checkAnswer(q, q.choices.find((c) => c.text === t) || {});
ok(text(q4.m1, '14') && !text(q4.m1, '44'), 'L4 m1 = 14');
ok(text(q4.m2, '30') && !text(q4.m2, '20'), 'L4 m2 = 30');
ok(text(q4.m3, '13') && !text(q4.m3, '12'), 'L4 m3 = 13');
ok(text(q4.key, '47') && !text(q4.key, '74'), 'L4 key = 47');
ok(pick(q4.force, 'The push from your foot.'), 'L4 force answer');
ok(pick(q4.energy, 'Oxygen, so the fuel can release energy.'), 'L4 energy answer');
ok(!pick(q4.force, 'The sky pulled the ball forward.') && !pick(q4.energy, 'Only extra paint.'), 'L4 wrong lab choices rejected');
eq([q4.m1, q4.m2, q4.m3, q4.key, q4.force, q4.energy].map((q) => q.reward.science), [2, 2, 3, 4, 3, 4], 'L4 rewards');

ok(text(q1.m1, '8') && text(q1.m1, 'eight') && !text(q1.m1, '6'), 'L1 m1 = 8');
ok(text(q1.m2, '24') && text(q1.m2, 'twenty-four') && text(q1.m2, 'twenty four') && !text(q1.m2, '16'), 'L1 m2 = 24');
ok(text(q1.m3, '6') && text(q1.m3, 'six') && !text(q1.m3, '5'), 'L1 m3 = 6');
ok(text(q1.key, '63') && text(q1.key, 'sixty-three') && text(q1.key, 'Sixty Three') && !text(q1.key, '36'), 'L1 key = 63');
ok(pick(q1.force, 'To the right →'), 'L1 force answer');
ok(pick(q1.energy, 'Plant A near the sunny window.'), 'L1 energy answer');
eq([q1.m1, q1.m2, q1.m3, q1.key, q1.force, q1.energy].map((q) => q.reward.science), [3, 3, 4, 5, 3, 4], 'L1 rewards');
ok(q1.m1.title !== q4.m1.title && q1.energy.title !== q4.energy.title, 'levels have different wording');
ok(q1.m1.visual.rows[1].tiles.length === 4 && q1.m2.visual.rows[0].tiles.length === 9, 'L1 visuals keep their tiles');
eq(Object.keys(questionsFor(2)), Object.keys(q4), 'unknown level -> Level 4 bank');
ok(questionsFor(2).m1.title === q4.m1.title, 'unknown level has Level 4 wording');
{
  const copy = questionsFor(4); copy.m1.title = 'changed';
  ok(questionsFor(4).m1.title !== 'changed', 'questionsFor returns fresh copies');
}

// ---------------------------------------------------------------------------
// Smart path, brute path, locked iron
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const qs = questionsFor(level);

  // Smart path: three boards.
  const r = fresh(level);
  eq(r.state.recipeMode, 'unknown', `${tag}: recipe unknown at start`);
  eq(r.recipe(), RECIPES[level].brute, `${tag}: unknown plan reads as the brute recipe (old getRecipe)`);
  const o1 = r.openQuest('m1');
  ok(o1.ok && o1.question.id === 'm1', `${tag}: open m1`);
  const s1 = r.solveQuest('m1');
  eq(s1.reward, { science: qs.m1.reward.science }, `${tag}: m1 reward`);
  ok(s1.text === `${qs.m1.success} You also gained +${qs.m1.reward.science} science.`, `${tag}: m1 toast`);
  eq(r.state.recipeMode, 'unknown', `${tag}: one board does not reveal the plan`);
  r.solveQuest('m2');
  eq(r.state.recipeMode, 'unknown', `${tag}: two boards do not reveal the plan`);
  ok(r.solveQuest('m1') === null, `${tag}: cannot solve a board twice (no double reward)`);
  const s3 = r.solveQuest('m3');
  eq(r.state.recipeMode, 'smart', `${tag}: 3 boards -> smart recipe`);
  eq(r.recipe(), RECIPES[level].smart, `${tag}: recipe() is the smart one`);
  ok(s3.allMath && s3.text.startsWith(level === 1 ? 'All 3 puzzles done! Cheap plan' : 'Smart path complete! Efficient recipe revealed'), `${tag}: smart toast`);
  ok(level === 1 ? s3.text.endsWith('Wood 12, Stone 24, Iron 60, Science 12.') : s3.text.endsWith('2 × (wood + science) + stone = 84.'), `${tag}: smart toast by Level`);
  eq(r.state.resources.science, qs.m1.reward.science + qs.m2.reward.science + qs.m3.reward.science, `${tag}: science added for each board`);
  ok(r.state.key === false && r.state.solved.key === false, `${tag}: smart path does not open the room`);
  const again = r.openQuest('m2');
  ok(!again.ok && again.text === 'That puzzle is already solved. Find another board or collect resources.', `${tag}: solved board refuses to open`);
  ok(r.recipeText().startsWith(level === 1 ? 'Cheap plan' : 'Smart efficient recipe') && r.recipeText().includes(`Need: Wood ${RECIPES[level].smart.wood}, Stone ${RECIPES[level].smart.stone}, Iron ${RECIPES[level].smart.iron}, Science ${RECIPES[level].smart.science}.`), `${tag}: smart recipe text`);

  // Brute path: the hard key.
  const b = fresh(level);
  const iron = PICKUPS.find((p) => p.locked);
  const surfaceIron = PICKUPS.find((p) => p.res === 'iron' && !p.locked);
  const refused = b.collect(iron.id);
  ok(refused.refused === true && refused.text === (level === 1 ? 'This iron is locked. Solve the gold key puzzle to open it.' : 'This rich iron is locked inside the room. Solve the golden hard key puzzle to open it.'), `${tag}: locked iron refused before the key`);
  ok(!b.isCollected(iron.id) && b.state.resources.iron === 0, `${tag}: refused iron changes nothing`);
  ok(b.collect(surfaceIron.id).text === `Mined surface iron: +${surfaceIron.amount} iron.`, `${tag}: surface iron is fine`);
  const k = b.solveQuest('key');
  eq(b.state.recipeMode, 'brute', `${tag}: key -> brute recipe`);
  ok(b.state.key === true && b.state.solved.key === true && k.keyUnlocked, `${tag}: key sets the room unlocked flag`);
  ok(k.text.startsWith(qs.key.success) && k.text.includes(level === 1 ? 'The big plan is open.' : 'Brute-force recipe unlocked, but it '), `${tag}: key toast`);
  ok(level === 1 ? k.text.endsWith('The big plan is open.') : k.text.endsWith('it needs many more resources.'), `${tag}: key toast by Level`);
  eq(b.recipe(), RECIPES[level].brute, `${tag}: recipe() is the brute one`);
  const inRoom = b.collect(iron.id);
  ok(inRoom.res === 'iron' && inRoom.amount === 12 && inRoom.text === 'Mined rich locked iron: +12 iron.', `${tag}: room iron collectable after the key`);
  ok(b.isCollected(iron.id), `${tag}: room iron marked collected`);
  const ko = b.openQuest('key');
  ok(!ko.ok && ko.text === 'The iron-room key is already unlocked. Enter the room and mine rich iron.', `${tag}: solved key refuses to open`);
  ok(b.solveQuest('key') === null, `${tag}: key cannot be solved twice`);
  ok(b.recipeText().startsWith(`${level === 1 ? 'Big plan' : 'Brute-force recipe'}: Need: Wood 45, Stone 55, Iron 150, Science 15.`), `${tag}: brute recipe text`);

  // Labs.
  const l = fresh(level);
  const f = l.solveQuest('force');
  ok(f.text === `${qs.force.success} +3 science.` && l.state.solved.force && l.state.resources.science === 3, `${tag}: force lab toast and reward`);
  const e = l.solveQuest('energy');
  ok(e.text === `${qs.energy.success} +4 science.` && l.state.solved.energy && l.state.resources.science === 7, `${tag}: energy lab toast and reward`);
  eq(l.state.recipeMode, 'unknown', `${tag}: labs do not choose a plan`);
  ok(l.openQuest('force').text === 'Force lab already passed.', `${tag}: force already passed`);
  ok(l.openQuest('energy').text === (level === 1 ? 'Light & Plants lab already passed.' : 'Chemical energy lab already passed.'), `${tag}: energy already passed`);
  ok(l.solveQuest('force') === null, `${tag}: lab cannot be solved twice`);

  // Odd input.
  ok(!fresh(level).openQuest('nope').ok && fresh(level).solveQuest('nope') === null, `${tag}: unknown quest id`);

  // Wrong-answer wording.
  ok(l.text.wrongAnswer('m1') === (level === 1 ? 'Not quite. Try again! A grown-up can open Math Hints at the bottom.' : 'Not quite. Try again, or ask a parent to open the Math Hints tab at the bottom.'), `${tag}: math wrong-answer text`);
  // Lead 2026-10-09: no hints for the child at any Level.
  ok(l.text.wrongAnswer('force') === (level === 1 ? 'Not quite. Try again!' : 'Not quite. Try again.') && !l.text.wrongAnswer('force').includes(qs.force.hint), `${tag}: lab wrong-answer text has no hint`);
}

// ---------------------------------------------------------------------------
// Building: gates, exact spend
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const r = fresh(level);
  let c = r.buildCheck();
  ok(!c.ok && c.text === (level === 1 ? 'The builders need a plan. Solve the 3 purple puzzles or the gold key.' : 'The builders need a plan first. Solve 3 purple medium puzzles for the efficient plan, or solve the hard golden key puzzle for brute force.'), `${tag}: refused without a plan`);
  for (const k of RESOURCE_KEYS) r.state.resources[k] = 999;
  ok(!r.startBuild().ok && !r.state.built, `${tag}: start refused without a plan even with resources`);

  r.solveQuest('m1'); r.solveQuest('m2'); r.solveQuest('m3');
  c = r.buildCheck();
  ok(!c.ok && c.text === (level === 1 ? 'Visit the Force Lab first. Learn how a push makes things move.' : 'Visit the Force Lab before building. A Science Center needs basic motion intuition.'), `${tag}: refused without the Force Lab`);
  r.solveQuest('force');
  c = r.buildCheck();
  ok(!c.ok && c.text === (level === 1
    ? 'Visit the Light & Plants Lab first. Learn what plants need to grow.'
    : 'Visit the Chemical Energy Lab before building. This prepares the rocket levels later.'), `${tag}: refused without the Energy Lab`);
  r.solveQuest('energy');

  // Resources: a fresh game with the plan and both labs but little stuff.
  const p = fresh(level);
  p.solveQuest('m1'); p.solveQuest('m2'); p.solveQuest('m3'); p.solveQuest('force'); p.solveQuest('energy');
  const sm = RECIPES[level].smart;
  p.state.resources.wood = 2; p.state.resources.iron = 10;
  c = p.buildCheck();
  ok(!c.ok && c.text.startsWith(level === 1 ? 'You need more. ' : 'Not enough resources yet. '), `${tag}: refused without resources`);
  ok(c.missing.includes(`wood: need ${sm.wood - 2} more`) && c.missing.includes(`stone: need ${sm.stone} more`) && c.missing.includes(`iron: need ${sm.iron - 10} more`), `${tag}: missing entries`);
  ok(c.text === `${level === 1 ? 'You need more.' : 'Not enough resources yet.'} ${c.missing.join('; ')}`, `${tag}: missing text joined with "; "`);
  const before = JSON.stringify(p.state.resources);
  ok(!p.startBuild().ok && JSON.stringify(p.state.resources) === before && !p.state.built, `${tag}: refused build spends nothing`);

  // A little more than the recipe: it spends exactly the recipe.
  for (const k of RESOURCE_KEYS) p.state.resources[k] = sm[k] + 3;
  c = p.buildCheck();
  ok(c.ok && c.missing.length === 0 && c.text === '', `${tag}: build ok with the recipe`);
  const go = p.startBuild();
  ok(go.ok && go.pieces === SCIENCE_CENTER_PIECES && go.pieces === 5, `${tag}: startBuild returns the piece count`);
  ok(go.text === 'Success! You built the Science Center. Chapter 2 is open!', `${tag}: build success text`);
  eq(p.state.resources, Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 3])), `${tag}: recipe spent exactly`);
  ok(p.state.built === true, `${tag}: built set`);
  c = p.buildCheck();
  ok(!c.ok && c.text === (level === 1 ? 'The Science Center is built! Go back to the chapters for Chapter 2.' : 'Science Center is already built. Use the Level 2 link when the next file is ready.'), `${tag}: cannot build twice`);
  ok(!p.startBuild().ok && p.state.resources.wood === 3, `${tag}: second start spends nothing`);

  // Brute recipe spend (key path).
  const q = fresh(level);
  q.solveQuest('key'); q.solveQuest('force'); q.solveQuest('energy');
  const br = RECIPES[level].brute;
  for (const k of RESOURCE_KEYS) q.state.resources[k] = br[k] - 1;
  ok(!q.buildCheck().ok, `${tag}: one short of the brute recipe is refused`);
  for (const k of RESOURCE_KEYS) q.state.resources[k] = br[k];
  ok(q.startBuild().ok, `${tag}: brute recipe builds`);
  eq(q.state.resources, Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 0])), `${tag}: brute recipe spent exactly`);
}

// ---------------------------------------------------------------------------
// Save format: round trip, launcher flag, old saves
// ---------------------------------------------------------------------------
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const store = memStore();
  const r = fresh(level, store);
  r.solveQuest('key');
  r.state.built = true;
  r.save();
  const blob = JSON.parse(store.getItem(STORE_KEYS[level]));
  ok(blob.built === true, `${tag}: launcher flag built saved under STORE_KEYS`);
  ok(Array.isArray(blob.collected), `${tag}: collected saved`);
  ok(blob.player && typeof blob.player.x === 'number' && blob.resources && blob.solved
    && blob.recipeMode === 'brute' && blob.key === true && typeof blob.message === 'string', `${tag}: old-format fields present`);
  const back = fresh(level, store);
  ok(back.state.built && back.state.key && back.state.solved.key && back.state.recipeMode === 'brute', `${tag}: reload keeps progress`);
}
ok(STORE_KEYS[4] === 'level1_science_village_v7' && STORE_KEYS[1] === 'level1_science_village_grade1_competitive_v1', 'save keys are the old ones');

{
  // A Level 4 save written by the OLD game: no `collected`.
  const store = memStore();
  store.setItem(STORE_KEYS[4], JSON.stringify({
    player: { x: 12, y: 21 },
    resources: { wood: 30, stone: 31, iron: 12, science: 5 },
    solved: { m1: true, m2: true, m3: true, key: false, force: true, energy: false },
    recipeMode: 'smart',
    key: false,
    built: false,
    message: 'Correct. The efficient wood target is 14.',
  }));
  const r = fresh(4, store);
  eq(r.state.player, { x: 12, y: 21 }, 'L4 old save: player kept (tiles)');
  eq(r.state.resources, { wood: 30, stone: 31, iron: 12, science: 5 }, 'L4 old save: resources kept');
  eq(r.state.collected, [], 'L4 old save: collected defaults to []');
  ok(r.state.message === 'Correct. The efficient wood target is 14.', 'L4 old save: message kept');
  eq(r.state.recipeMode, 'smart', 'L4 old save: recipeMode kept');
  eq(r.recipe(), RECIPES[4].smart, 'L4 old save: smart recipe');
  ok(r.state.solved.m3 && r.state.solved.force && !r.state.solved.energy && !r.state.key, 'L4 old save: solved flags kept');
  ok(!r.openQuest('m1').ok && r.openQuest('energy').ok, 'L4 old save: solved board closed, energy lab open');
    ok(r.collect(PICKUPS[0].id).res === 'wood', 'L4 old save: collect works');

  // A Level 1 old save with the key and a finished build.
  const s1 = memStore();
  s1.setItem(STORE_KEYS[1], JSON.stringify({
    player: { x: 17, y: 24 },
    resources: { wood: 5, stone: 5, iron: 5, science: 20 },
    solved: { m1: false, m2: false, m3: false, key: true, force: true, energy: true },
    recipeMode: 'brute', key: true, built: true, message: 'Success!',
  }));
  const r1 = fresh(1, s1);
  ok(r1.state.built && r1.state.key && r1.state.recipeMode === 'brute', 'L1 old save: built / key / brute kept');
  eq(r1.progress(), { pct: 100, status: 'Science Center built' }, 'L1 old save: progress 100');
  ok(r1.collect(PICKUPS.find((p) => p.locked).id).res === 'iron', 'L1 old save: room already open');

  // Junk and gaps fall back to a fresh game instead of throwing.
  const bad = memStore();
  bad.setItem(STORE_KEYS[4], '{not json');
  eq(fresh(4, bad).state.built, false, 'corrupt save -> fresh state');
  const arr = memStore();
  arr.setItem(STORE_KEYS[4], '[1,2]');
  eq(fresh(4, arr).state.recipeMode, 'unknown', 'array save -> fresh state');
  const partial = memStore();
  partial.setItem(STORE_KEYS[1], JSON.stringify({ resources: { wood: 7 }, recipeMode: 'nonsense', key: true }));
  const pr = fresh(1, partial);
  ok(pr.state.resources.wood === 7 && pr.state.resources.science === 0 && pr.state.solved.force === false
    && pr.state.recipeMode === 'unknown' && pr.state.built === false && pr.state.player.x === 7 && pr.state.player.y === 20
    && Array.isArray(pr.state.collected) && pr.state.message.startsWith('Welcome!'), 'partial save: missing fields defaulted');
  ok(pr.state.key === true && pr.state.solved.key === true, 'partial save: key flag mirrored into solved.key');
  // No storage at all: plays on in memory.
  const noStore = createScienceRules({ level: 4, storage: undefined });
  noStore.collect(PICKUPS[0].id);
  ok(noStore.state.collected.length === 1, 'missing storage falls back to memory');
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
{
  const store = memStore();
  const r = fresh(4, store);
  const tree = PICKUPS.find((p) => p.type === 'tree');
  const stone = PICKUPS.find((p) => p.type === 'stone');
  const note = PICKUPS.find((p) => p.type === 'scienceGem');
  ok(!r.isCollected(tree.id), 'pickup not collected at start');
  const got = r.collect(tree.id);
  ok(got && got.res === 'wood' && got.amount === tree.amount, 'collect returns res/amount');
  ok(got.text === `Chopped tree: +${tree.amount} wood.`, 'tree text uses the old wording');
  eq(r.state.resources.wood, tree.amount, 'collect adds resources');
  ok(r.isCollected(tree.id) && r.collect(tree.id) === null, 'a pickup can only be taken once');
  eq(r.state.resources.wood, tree.amount, 'second collect adds nothing');
  ok(r.collect(999999) === null, 'unknown pickup id -> null');
  ok(r.collect(stone.id).text === `Mined stone: +${stone.amount} stone.`, 'stone text');
  ok(r.collect(note.id).text === 'Collected science note: +1 science.', 'science note text');
  ok(r.state.message === 'Collected science note: +1 science.', 'latest line kept as the message');

  // No explicit save() call: collect persists by itself, and survives a reload.
  const back = fresh(4, store);
  ok(back.isCollected(tree.id) && back.isCollected(stone.id) && back.isCollected(note.id), 'collected persists across reload');
  eq(back.state.resources.wood, tree.amount, 'resources persist across reload');
  ok(back.collect(tree.id) === null, 'still cannot re-collect after reload');
  ok(!fresh(1, store).isCollected(tree.id), 'Level 1 save is separate from Level 4');

  // Reset clears everything, in place.
  const st = back.state;
  back.reset();
  ok(back.state === st && !back.isCollected(tree.id) && back.state.resources.wood === 0, 'reset clears state in place');
  ok(!fresh(4, store).isCollected(tree.id), 'reset clears the saved blob');

  eq(PICKUPS.length, 27 + 23 + 15 + 12 + 15, '92 pickups');
  ok(new Set(PICKUPS.map((x) => x.id)).size === PICKUPS.length, 'pickup ids are unique');
  eq(PICKUPS.filter((p) => p.locked).length, 12, '12 locked iron');
}

// ---------------------------------------------------------------------------
// HUD text: progress, mission lines, badges
// ---------------------------------------------------------------------------
/** The old formula, written out independently: base + steps + round(resource share * 32), capped at 99. */
function expectedPct(r, level) {
  const st = r.state;
  const rec = st.recipeMode === 'smart' ? RECIPES[level].smart : RECIPES[level].brute;
  let p = 8 + ['m1', 'm2', 'm3'].filter((k) => st.solved[k]).length * 8;
  if (st.key) p += 18;
  if (st.recipeMode !== 'unknown') p += 12;
  if (st.solved.force) p += 8;
  if (st.solved.energy) p += 9;
  p += Math.round((RESOURCE_KEYS.reduce((a, k) => a + Math.min(1, st.resources[k] / rec[k]), 0) / 4) * 32);
  return Math.min(99, p);
}
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const r = fresh(level);
  eq(r.progress(), { pct: 8, status: level === 1 ? 'Pick: 3 puzzles or hard key' : 'Choose smart path or hard key path' }, `${tag}: progress at start (explored = 8)`);
  eq(r.missionLines(), [level === 1 ? 'Pick: 3 purple boards or the gold key.' : 'Choose: solve the 3 purple boards, or the golden key puzzle.'], `${tag}: first mission line`);
  ok(r.recipeText().startsWith(level === 1 ? 'Plan locked: Solve the 3 purple boards' : 'Recipe locked: Solve all 3 purple boards'), `${tag}: recipe locked text`);
  r.solveQuest('m1');
  eq(r.progress().pct, expectedPct(r, level), `${tag}: one board`);
  ok(r.progress().pct > 16, `${tag}: one board adds steps and the science reward`);
  r.solveQuest('m2'); r.solveQuest('m3');
  // 8 + 24 + 12 (plan) = 44, no resources yet.
  eq(r.progress(), { pct: expectedPct(r, level), status: 'Visit Force Lab' }, `${tag}: smart path, Force Lab next`);
  ok(r.missionLines()[0] === (level === 1 ? 'Now pass the Force Lab.' : 'Now pass the Force Lab. Learn that a push or pull changes motion.'), `${tag}: force mission line`);
  ok(r.missionLines()[1] === r.recipeText() && r.missionLines().length === 2, `${tag}: recipe line follows once a plan is chosen`);
  r.solveQuest('force');
  eq(r.progress(), { pct: expectedPct(r, level), status: level === 1 ? 'Visit Light & Plants Lab' : 'Visit Chemical Energy Lab' }, `${tag}: energy lab next`);
  ok(r.missionLines()[0] === (level === 1
    ? 'Now pass the Light & Plants Lab.'
    : 'Now pass the Chemical Energy Lab. Learn why future rockets need fuel and oxygen.'), `${tag}: energy mission line`);
  r.solveQuest('energy');
  const sm = RECIPES[level].smart;
  eq(r.progress(), { pct: expectedPct(r, level), status: level === 1 ? 'Get resources, build on purple spot' : 'Gather resources and build on purple foundation' }, `${tag}: resources add to the bar`);
  ok(r.missionLines()[0].startsWith(level === 1 ? 'Get the list. Build on the purple spot' : 'Collect the resources. Then build on the purple foundation'), `${tag}: gather mission line`);
  for (const k of RESOURCE_KEYS) r.state.resources[k] = sm[k] * 5;
  eq(r.progress().pct, 61 + 32, `${tag}: full resources = 93 (8 + 24 + 12 + 8 + 9 + 32)`);
  r.state.built = true;
  eq(r.progress(), { pct: 100, status: 'Science Center built' }, `${tag}: progress at the end`);
  eq(r.missionLines(), [level === 1 ? 'Science Center done! Go to the chapters for Chapter 2.' : 'Science Center complete! Go back to the chapters for Chapter 2.'], `${tag}: end mission line`);

  const kk = fresh(level);
  kk.solveQuest('key');
  eq(kk.progress().pct, expectedPct(kk, level), `${tag}: key alone (8 + 18 + 12 + science share)`);

  const b = r.badges();
  eq(b.map((x) => x.label), ['Puzzle 1', 'Puzzle 2', 'Puzzle 3', 'Key', 'Force', 'Energy', 'Built'], `${tag}: badge labels`);
  eq(b.map((x) => x.done), [true, true, true, false, true, true, true], `${tag}: badge states (smart path, no key)`);
  eq(kk.badges().map((x) => x.done), [false, false, false, true, false, false, false], `${tag}: key badge`);
}
{
  // The bar never reaches 100 until built, whatever she carries.
  const r = fresh(4);
  r.solveQuest('m1'); r.solveQuest('m2'); r.solveQuest('m3'); r.solveQuest('key'); r.solveQuest('force'); r.solveQuest('energy');
  for (const k of RESOURCE_KEYS) r.state.resources[k] = 9999;
  eq(r.progress().pct, 99, 'progress capped at 99 before the build');
}

// ---------------------------------------------------------------------------
// Play modes: the treasure hunt (Hard) and the build gate
// ---------------------------------------------------------------------------
import { huntFor, homes } from '../src/science/hunt.js';
import { tileToWorld, worldToTile, inMap } from '../src/science/contracts.js';
import { BUILDINGS, WELL, KEY_GATE, isRoomWall, isRoad } from '../src/science/layout.js';

/** Conservative walkability: inside the map, not in a building, the well, a board / lab, a wall, or a standing tree. */
function walkable(x, z) {
  const { tx, ty } = worldToTile(x, z);
  if (!inMap(tx, ty)) return false;
  for (const b of BUILDINGS) {
    const c = tileToWorld(b.tx, b.ty);
    if (Math.abs(x - c.x) <= 1.7 && Math.abs(z - c.z) <= 1.7) return false;
  }
  const w = tileToWorld(WELL.tx, WELL.ty);
  if (Math.hypot(x - w.x, z - w.z) < 1.1) return false;
  for (const st of STATIONS) { const c = tileToWorld(st.tx, st.ty); if (Math.hypot(x - c.x, z - c.z) < 0.9) return false; }
  if (isRoomWall(tx, ty) || (tx === KEY_GATE.tx && ty === KEY_GATE.ty)) return false;
  for (const pk of PICKUPS) if (pk.type === 'tree') { const c = tileToWorld(pk.tx, pk.ty); if (Math.hypot(x - c.x, z - c.z) < 0.6) return false; }
  return true;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const HOMES = homes();
eq(HOMES.length, 3, 'three homes in the village');
eq(HOMES.map((h) => h.door), [{ tx: 4, ty: 17 }, { tx: 24, ty: 23 }, { tx: 15, ty: 18 }], 'home door tiles (front faces the nearest road)');

for (const level of [1, 4]) {
  const tag = `L${level} hunt`;
  const h = huntFor(level);
  ok(h.title && h.itemName === 'Golden Core' && h.intro.length > 40, `${tag}: title, item, intro`);
  eq(h.steps.length, 4, `${tag}: 4 steps`);
  h.steps.forEach((st, i) => {
    ok(typeof st.id === 'string' && st.id, `${tag}: step ${i} id`);
    ok(Number.isFinite(st.at.x) && Number.isFinite(st.at.z), `${tag}: step ${i} at`);
    ok(st.radius > 0.5 && st.radius <= 3, `${tag}: step ${i} radius`);
    ok(st.clue.length > 30 && st.found.length > 10, `${tag}: step ${i} clue and found text`);
    ok(walkable(st.at.x, st.at.z), `${tag}: step ${i} stands on walkable ground`);
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
  ok(last.found.includes('Golden Core'), `${tag}: last step names the Golden Core`);
  ok(h.decoys.length >= 2, `${tag}: at least two decoys`);
  const decoyHomes = h.decoys.map((d) => HOMES.find((q) => dist(q.at, d.at) <= 2.5));
  ok(decoyHomes.every((q) => q && q !== target) && new Set(decoyHomes).size === h.decoys.length, `${tag}: decoys sit at other homes`);
  ok(h.decoys.every((d) => d.text.startsWith('Not here') && !/Town House|blacksmith|Golden Core/i.test(d.text) && walkable(d.at.x, d.at.z)), `${tag}: decoy texts do not give the answer`);
  ok(h.decoys.every((d) => h.steps.slice(0, 3).every((st) => dist(d.at, st.at) > d.radius + st.radius)), `${tag}: decoys do not overlap clue places`);
  eq(target.label, 'Town House', `${tag}: the Golden Core is in the Town House`);

  // The clues really lead where the data says (solve them from the layout).
  const near = (step, tx, ty, r = 2.6) => dist(step.at, tileToWorld(tx, ty)) <= r;
  const labs = STATIONS.filter((q) => q.kind === 'lab');
  const boards = STATIONS.filter((q) => q.kind === 'mathBoard');
  if (level === 1) {
    eq(labs.length + 1, 3, 'L1 clue 2: 2 labs + 1 = Puzzle 3');
    const m3 = STATIONS.find((q) => q.quest === 'm3');
    ok(near(h.steps[1], m3.tx, m3.ty), 'L1 clue 2 leads to Puzzle Board 3');
    ok(near(h.steps[0], WELL.tx, WELL.ty), 'L1 clue 1 leads to the well');
    const smith = BUILDINGS.find((b) => b.type === 'blacksmith');
    ok(near(h.steps[2], smith.tx, smith.ty, 3.0), 'L1 clue 3 leads to the blacksmith');
    const closest = [...HOMES].sort((a, b) => dist(a.at, tileToWorld(smith.tx, smith.ty)) - dist(b.at, tileToWorld(smith.tx, smith.ty)))[0];
    ok(closest === target, 'L1 clue 4: the home closest to the blacksmith is the target');
  } else {
    const m2 = STATIONS.find((q) => q.quest === 'm2');
    eq(m2.symbol, '×', 'L4 clue 1: the multiplication board is Puzzle 2');
    ok(near(h.steps[0], m2.tx, m2.ty), 'L4 clue 1 leads to the x board');
    const east = [...labs].sort((a, b) => b.tx - a.tx)[0];
    eq(east.quest, 'energy', 'L4 clue 2: the lab farthest east is the Chemical Energy Lab');
    ok(near(h.steps[1], east.tx, east.ty), 'L4 clue 2 leads to the eastern lab');
    ok(labs.every((l) => l.ty > 20), 'L4 clue 2: both labs are south of the main road');
    ok(near(h.steps[2], KEY_GATE.tx, KEY_GATE.ty, 3.0) && h.steps[2].at.z > tileToWorld(KEY_GATE.tx, KEY_GATE.ty).z, 'L4 clue 3 leads to the golden lock, outside its south wall');
    ok(Array.from({ length: 32 }, (_, i) => i).every((x) => isRoad(x, 20) || x < 2 || x > 28), 'L4 clue 4: the main road runs along row 20');
    const north = BUILDINGS.filter((b) => b.ty < 20).sort((a, b) => a.tx - b.tx);
    const n = boards.length + labs.length - 2;
    eq(n, 3, 'L4 clue 4: boards + labs - 2 = 3');
    const pick = north[n - 1];
    ok(pick.type === 'house' && near(h.steps[3], pick.tx, pick.ty, 3.0), 'L4 clue 4: the 3rd northern building from the west is the target home');
    eq(north.map((b) => b.label), ['Family House', 'Blacksmith', 'Town House', 'Hospital'], 'L4 clue 4: four buildings north of the road');
  }
}
ok(huntFor(1) !== huntFor(4) && huntFor(1).steps[0].clue !== huntFor(4).steps[0].clue, 'the two Levels have their own clues');
eq(huntFor(2), huntFor(4), 'unknown level -> Level 4 clues');

// The final build on Hard needs the Golden Core.
for (const level of [1, 4]) {
  const tag = `L${level}`;
  const ready = (store) => {
    const r = fresh(level, store);
    r.solveQuest('m1'); r.solveQuest('m2'); r.solveQuest('m3'); r.solveQuest('force'); r.solveQuest('energy');
    for (const k of RESOURCE_KEYS) r.state.resources[k] = RECIPES[level].smart[k] + 2;
    return r;
  };
  eq(fresh(level).isHuntRequired(), false, `${tag}: the hunt is not required by default`);
  const store = memStore();
  const r = ready(store);
  r.setHuntRequired(true);
  const before = JSON.stringify(r.state.resources);
  const c = r.buildCheck();
  ok(!c.ok && c.text === 'The Science Center needs its Golden Core. Press the 📜 Clue button to read the clues.', `${tag}: Hard refuses the build without the Golden Core`);
  const go = r.startBuild();
  ok(!go.ok && !r.state.built && JSON.stringify(r.state.resources) === before, `${tag}: refused build spends nothing`);
  ok(r.state.message.includes('Golden Core'), `${tag}: the refusal is the latest message`);
  r.setHuntRequired(false);
  ok(r.buildCheck().ok, `${tag}: switching away from Hard lifts the requirement`);
  r.setHuntRequired(true);
  eq(r.huntFound(), false, `${tag}: not found yet`);
  r.markHuntFound();
  ok(r.huntFound() && r.state.huntFound === true, `${tag}: found flag set`);
  ok(r.buildCheck().ok && r.startBuild().ok && r.state.built, `${tag}: Hard allows the build once the Golden Core is found`);
  // Persistence: the found flag is saved with the chapter.
  const back = fresh(level, store);
  ok(back.huntFound() && back.state.huntFound === true, `${tag}: found flag survives a reload`);
  back.setHuntRequired(true);
  ok(back.buildCheck().text.startsWith(level === 1 ? 'The Science Center is built' : 'Science Center is already built'), `${tag}: built message still first after the build`);
  // Easy / Medium never ask for it.
  const easy = ready(memStore());
  ok(!easy.isHuntRequired() && easy.startBuild().ok, `${tag}: Easy / Medium build without the hunt`);
  // Other refusals still come with their own text on Hard once the core is found.
  const other = fresh(level);
  other.setHuntRequired(true); other.markHuntFound();
  ok(other.buildCheck().text.startsWith(level === 1 ? 'The builders need a plan.' : 'The builders need a plan first.'), `${tag}: with the core found the normal refusals apply`);
  // Old saves (no huntFound) still load.
  const old = memStore();
  old.setItem(STORE_KEYS[level], JSON.stringify({ resources: { wood: 3 }, recipeMode: 'smart', key: false, built: false, message: 'hi', collected: [1] }));
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
  const r = fresh(level);
  const solve = r.solveQuest('m1');
  const texts = {
    solve: solve && solve.text,
    wrongAnswer: r.text.wrongAnswer('m1'),
    wrongLab: r.text.wrongAnswer('force'),
    nothingNear: r.text.nothingNear,
  };
  for (const [name, text] of Object.entries(texts)) {
    ok(typeof text === 'string' && text.length > 0, `${tag} ${name}: a message exists`);
    const ms = readMs(text);
    ok(ms >= 5000 && ms <= 10000, `${tag} ${name}: readMs is 5-10 s (${ms} ms)`);
    if (level === 1) ok(!needsClick(text), `${tag} ${name}: Level 1 reads as a toast, not a card`);
  }
}

console.log(`${passed} checks passed${failures.length ? `, ${failures.length} FAILED` : ''}`);
if (failures.length) {
  console.error(failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
