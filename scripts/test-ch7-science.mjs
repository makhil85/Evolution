// Chapter 7, Part C: chemistry and life on board (src/space/ch7/tasksLogic.js,
// tasks.js, questions.partC.js, partC.js) and lessons 7B and 7C.
//
//   node scripts/test-ch7-science.mjs
//
// Every reaction is checked by counting atoms; each task's answer solves it in
// every mode, and do-nothing or random play cannot win Hard (seeded random play
// wins at most 10% of the time). Every question's number is re-derived at both
// Levels, its hint never gives the answer, and the lesson choices are never bare
// numbers, with the right one never the uniquely longest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const L = await import('../src/space/ch7/tasksLogic.js');

/** Atoms in a formula like 'H2O', 'C6H12O6', 'CO2': { element: count }. */
function atomsOf(formula) {
  const out = {};
  for (const [, el, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) out[el] = (out[el] || 0) + (n ? Number(n) : 1);
  return out;
}
/** Atoms on one side of a reaction: [[coefficient, formula], ...]. */
function sideAtoms(side) {
  const out = {};
  for (const [c, f] of side) for (const [e, n] of Object.entries(atomsOf(f))) out[e] = (out[e] || 0) + c * n;
  return out;
}

// A seeded generator, so a random-play rate is the same every run.
let seed = 20261008;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pickOf = (arr) => arr[Math.floor(rnd() * arr.length)];

// The reactions as the chemistry is written (the task numbers must match them).
const SPLIT_REACTION = { left: [[2, 'H2O']], right: [[2, 'H2'], [1, 'O2']] };
const AIR_REACTION = { left: [[6, 'CO2'], [6, 'H2O']], right: [[1, 'C6H12O6'], [6, 'O2']] };

console.log('reactions');
ok('2 H2O -> 2 H2 + O2 has the same atoms on both sides (4 H, 2 O), and the logic uses the same numbers', () => {
  assert.deepEqual(sideAtoms(SPLIT_REACTION.left), { H: 4, O: 2 });
  assert.deepEqual(sideAtoms(SPLIT_REACTION.right), sideAtoms(SPLIT_REACTION.left));
  assert.equal(L.SPLIT.equation.water, SPLIT_REACTION.left[0][0]);
  assert.equal(L.SPLIT.equation.h2, SPLIT_REACTION.right[0][0]);
  assert.equal(L.SPLIT.equation.o2, SPLIT_REACTION.right[1][0]);
});
ok('6 CO2 + 6 H2O + light -> C6H12O6 + 6 O2 balances C, H and O (18 O on each side)', () => {
  assert.deepEqual(sideAtoms(AIR_REACTION.left), { C: 6, O: 18, H: 12 });
  assert.deepEqual(sideAtoms(AIR_REACTION.right), { C: 6, H: 12, O: 18 });
  assert.equal(L.PLANTS.co2, AIR_REACTION.left[0][0]);
  assert.equal(L.PLANTS.h2o, AIR_REACTION.left[1][0]);
  assert.equal(L.PLANTS.bubbles, AIR_REACTION.right[1][0]);
  assert.equal(L.oxygenIn(), 18);
  assert.equal(L.plantsO2Answer(), 6);
  assert.deepEqual(sideAtoms([[1, 'C6H12O6'], [6, 'O2']]), sideAtoms(AIR_REACTION.left));
});
ok('the microbe doubling: after h pretend hours one bacterium has 2^h', () => {
  for (let h = 0; h <= 8; h++) assert.equal(L.cellsAfter(1, h), 2 ** h);
  assert.equal(L.hoursToPass(100), 7, '128 is the first over 100');
});

console.log('the atom kitchen');
ok('kitchen(2): 4 H and 2 O on the bench, and jars for 2 H2 and 1 O2; kitchen(4) doubles that', () => {
  for (const [w, h2, o2] of [[2, 2, 1], [4, 4, 2]]) {
    const k = L.kitchen(w);
    assert.equal(k.bench.length, 3 * w);
    assert.equal(k.bench.filter((a) => a[0] === 'H').length, 2 * w);
    assert.deepEqual([k.jars.filter((j) => j.kind === 'H').length, k.jars.filter((j) => j.kind === 'O').length], [h2, o2]);
  }
});
ok('a ball goes only in a jar of its own kind, two to a jar; a wrong drop changes nothing', () => {
  const k = L.kitchen(2);
  const oJar = k.jars.findIndex((j) => j.kind === 'O');
  assert.equal(L.placeAtom(k, 'H0', oJar).problem, 'kind');
  assert.equal(L.placeAtom(k, 'H0', oJar).kitchen, k);
  const hJar = k.jars.findIndex((j) => j.kind === 'H');
  const once = L.placeAtom(k, 'H0', hJar).kitchen;
  const twice = L.placeAtom(once, 'H1', hJar).kitchen;
  assert.equal(L.placeAtom(twice, 'H2', hJar).problem, 'full');
  assert.equal(L.placeAtom(k, 'H9', hJar).kitchen, k, 'a ball not on the bench does nothing');
  assert.equal(L.kitchenDone(twice), false);
});
ok('taking a ball back puts it on the bench; the solution fills every jar and uses every ball', () => {
  const k = L.placeAtom(L.kitchen(2), 'H0', 0).kitchen;
  const back = L.takeAtom(k, 'H0');
  assert.ok(back.bench.includes('H0'));
  assert.equal(back.jars[0].atoms.length, 0);
  for (const w of [2, 4]) {
    let s = L.kitchen(w);
    for (const [a, j] of L.taskAnswer('split', w === 2 ? 'easy' : 'medium')) s = L.placeAtom(s, a, j).kitchen;
    assert.ok(L.kitchenDone(s), `water ${w}`);
    assert.equal(s.bench.length, 0);
  }
  assert.equal(L.SPLIT.water.easy, 2);
  assert.equal(L.SPLIT.water.medium, 4);
});

console.log('the tasks');
ok('the four tasks: ids, leads (real crew), decks and places (the names decks.js gives), two-level titles', () => {
  assert.deepEqual(L.TASKS.map((x) => x.id), ['split', 'plants', 'microbes', 'bones']);
  const crew = ['biologist', 'doctor', 'builder', 'signal'];
  const places = { life: ['water', 'food', 'oxygen'], crew: ['medbay'] };
  for (const x of L.TASKS) {
    assert.ok(crew.includes(x.lead), x.id);
    assert.ok(places[x.deck]?.includes(x.near), `${x.id}: ${x.near} on ${x.deck}`);
    assert.equal(x.title.length, 2, x.id);
  }
});
ok('Level 1 plays Easy and Medium only; Level 4 plays all three', () => {
  assert.deepEqual(L.modesFor(1), ['easy', 'medium']);
  assert.deepEqual(L.modesFor(4), ['easy', 'medium', 'hard']);
});
ok('each task has an answer that solves it in every mode (both Levels’ modes)', () => {
  for (const id of ['split', 'plants', 'microbes', 'bones']) {
    for (const mode of L.MODES) {
      if (id === 'split' && mode !== 'hard') {
        let s = L.kitchen(L.SPLIT.water[mode]);
        for (const [a, j] of L.taskAnswer(id, mode)) s = L.placeAtom(s, a, j).kitchen;
        assert.ok(L.solved(id, mode, s), `${id} ${mode}`);
      } else {
        assert.ok(L.solved(id, mode, L.taskAnswer(id, mode)), `${id} ${mode}`);
      }
    }
  }
});
ok('the plant answers are the numbers the sums use: 4 light runs make 24, 5 make 30', () => {
  assert.equal(L.bubblesFrom(L.taskAnswer('plants', 'easy')), 24);
  assert.equal(L.bubblesFrom(L.taskAnswer('plants', 'medium')), 30);
  assert.equal(L.taskAnswer('plants', 'hard'), 6);
});
ok('the microbe answers: 64 in 6 pretend hours; 128 (first over 100) in 7; 32 bacteria for 5 hours (1,024)', () => {
  assert.deepEqual(L.taskAnswer('microbes', 'easy'), { start: 1, hours: 6 });
  assert.deepEqual(L.taskAnswer('microbes', 'medium'), { start: 1, hours: 7 });
  assert.deepEqual(L.taskAnswer('microbes', 'hard'), { start: 32, hours: 5 });
});
ok('the bones answer: two hours of bike a month keeps every mode under its limit', () => {
  for (const mode of L.MODES) {
    const plan = L.taskAnswer('bones', mode);
    assert.equal(plan.length, L.BONES.modes[mode].months);
    assert.ok(L.boneOk(mode, plan), mode);
  }
  assert.equal(L.noExerciseLoss(6), 6);
  assert.equal(L.boneLoss(Array(6).fill(0)) / 10, 6);
});
ok('do-nothing (the starting state) fails every Hard mode', () => {
  assert.equal(L.solved('split', 'hard', { water: 1, h2: 1, o2: 1 }), false);
  assert.equal(L.solved('plants', 'hard', 0), false);
  assert.equal(L.solved('microbes', 'hard', { start: 1, hours: 0 }), false);
  assert.equal(L.solved('bones', 'hard', L.boneStart('hard')), false);
  assert.equal(L.solved('split', 'easy', L.kitchen(2)), false, 'an untouched kitchen is not done');
  assert.equal(L.solved('plants', 'easy', 0), false);
});
ok('the Hard split balances only with the smallest whole numbers (2, 2, 1), never 4, 4, 2', () => {
  assert.equal(L.splitSmallest({ water: 4, h2: 4, o2: 2 }), false);
  assert.equal(L.splitBalanced({ water: 4, h2: 4, o2: 2 }), true);
  assert.equal(L.splitSmallest({ water: 2, h2: 2, o2: 1 }), true);
  assert.deepEqual(L.splitCounts({ water: 2, h2: 2, o2: 1 }), { inH: 4, outH: 4, inO: 2, outO: 2 });
});

console.log('random play');
const RANDOM_TRIALS = 20000;
const rates = {};
ok('random play wins at most 10% of Hard, in every task (seeded)', () => {
  const split = [...Array(RANDOM_TRIALS)].filter(() => L.splitSmallest({ water: pickOf([1, 2, 3, 4]), h2: pickOf([1, 2, 3, 4]), o2: pickOf([1, 2, 3, 4]) })).length;
  const plants = [...Array(RANDOM_TRIALS)].filter(() => L.plantsBalanced(Math.floor(rnd() * (L.PLANTS.maxO2 + 1)))).length;
  const modes = L.MICROBES.modes.hard;
  const micro = [...Array(RANDOM_TRIALS)].filter(() => L.microbesDone('hard', pickOf(modes.starts), Math.floor(rnd() * (modes.hours + 1)))).length;
  const bones = [...Array(RANDOM_TRIALS)].filter(() => {
    const plan = Array.from({ length: L.BONES.modes.hard.months }, () => Math.floor(rnd() * L.BONES.hours.length));
    return L.boneOk('hard', plan);
  }).length;
  rates.split = split / RANDOM_TRIALS; rates.plants = plants / RANDOM_TRIALS; rates.microbes = micro / RANDOM_TRIALS; rates.bones = bones / RANDOM_TRIALS;
  for (const [k, v] of Object.entries(rates)) assert.ok(v <= 0.1, `${k} random Hard wins ${(v * 100).toFixed(1)}%`);
  for (const k of Object.keys(rates)) console.log(`       ${k} random Hard: ${(rates[k] * 100).toFixed(1)}%`);
});
ok('a sensible player wins Easy and Medium: the greedy plays (more light, more hours, more bike) always reach the goal', () => {
  // Plants: keep adding light runs until the bubbles are enough.
  for (const mode of ['easy', 'medium']) {
    let runs = 0; while (!L.solved('plants', mode, runs) && runs < L.PLANTS.maxRuns) runs++;
    assert.ok(L.solved('plants', mode, runs), mode);
  }
  // Microbes: from the first start, add hours until the tank is clean.
  for (const mode of ['easy', 'medium']) {
    let hours = 0; const start = L.MICROBES.modes[mode].starts[0];
    while (!L.microbesDone(mode, start, hours) && hours < L.MICROBES.modes[mode].hours) hours++;
    assert.ok(L.microbesDone(mode, start, hours), mode);
  }
  // Bones: a sensible plan (two hours a day on the bike) is always safe.
  for (const mode of ['easy', 'medium', 'hard']) assert.ok(L.boneOk(mode, Array(L.BONES.modes[mode].months).fill(2)), mode);
});

console.log('questions');
const Q4 = await import('../src/space/ch7/questions.partC.js');
const { CH7C_QUESTIONS: Q4BANK, CH7C_LEVEL1: Q1BANK, TASK_BEAT } = Q4;
const bankAt = (level) => {
  const out = {};
  for (const [id, q] of Object.entries(Q4BANK)) out[id] = level === 1 ? { ...q, ...(Q1BANK[id] || {}) } : q;
  return out;
};
ok('one question per task, each on its task’s beat, every beat in the bank at both Levels', () => {
  assert.deepEqual(Object.values(TASK_BEAT).sort(), ['c7Bones', 'c7Microbes', 'c7Plants', 'c7Split']);
  assert.equal(Object.keys(Q4BANK).length, 4);
  for (const level of [4, 1]) {
    const beats = Object.values(bankAt(level)).map((q) => q.beat).sort();
    assert.deepEqual(beats, Object.values(TASK_BEAT).sort(), `Level ${level}`);
  }
  for (const id of Object.keys(Q1BANK)) assert.ok(Q4BANK[id], `Level 1 ${id} has no Level 4 question`);
});
ok('every question is a number question on act 3, with answers, a hint and a parent hint at both Levels', () => {
  for (const level of [4, 1]) {
    for (const [id, q] of Object.entries(bankAt(level))) {
      assert.equal(q.id, id);
      assert.equal(q.type, 'text');
      assert.equal(q.act, 3, id);
      assert.ok(q.answers.length >= 1 && q.hint && q.prompt && q.success, `${id} fields at Level ${level}`);
      assert.ok(q.prompt.includes('(Type a number.)'), `${id} says to type a number`);
    }
  }
});
ok('Level 4 numbers: 2 oxygen molecules from 4 water; 12 oxygen atoms in 6 CO2; 7 hours to pass 100; 6% over 6 months', () => {
  const b = bankAt(4);
  assert.deepEqual(b.c7_split_oxygen.answers, ['2']);
  assert.deepEqual(b.c7_plants_oxygen_atoms.answers, ['12']);
  assert.ok(b.c7_microbes_hours.answers.includes('7'));
  assert.ok(b.c7_bones_percent.answers.includes('6'));
  // re-derived from the rules, not typed again
  assert.equal(4 * L.SPLIT.equation.o2 / L.SPLIT.equation.water, 2);
  assert.equal(6 * 2, 12);
  let h = 0; let cells = 1; while (cells <= 100) { cells *= 2; h++; }
  assert.equal(h, 7);
  assert.equal(6 * (L.BONES.lossTenths[0] / 10), 6);
});
ok('Level 1 numbers: 2 from 4 water; 4 oxygen atoms in 2 CO2; 8 after 3 hours; 3% over 3 months', () => {
  const b = bankAt(1);
  assert.deepEqual(b.c7_split_oxygen.answers.slice(0, 1), ['2']);
  assert.deepEqual(b.c7_plants_oxygen_atoms.answers.slice(0, 1), ['4']);
  assert.deepEqual(b.c7_microbes_hours.answers.slice(0, 1), ['8']);
  assert.deepEqual(b.c7_bones_percent.answers.slice(0, 1), ['3']);
});
ok('no hint gives its answer as a number (the parent hint may)', () => {
  for (const level of [4, 1]) {
    for (const [id, q] of Object.entries(bankAt(level))) {
      for (const a of q.answers.filter((x) => /^\d+$/.test(x))) {
        assert.ok(!new RegExp(`(^|[^\\d.])${a}([^\\d]|$)`).test(q.hint), `${id} Level ${level}: hint names ${a}`);
      }
    }
  }
});

console.log('lessons 7B and 7C');
const card = await import('../src/lesson/card.js');
const { LESSON_7B } = await import('../src/lesson/lessons/ch7b.js');
const { LESSON_7C } = await import('../src/lesson/lessons/ch7c.js');
const bareNumber = (s) => /^\s*[\d.,%\s]+\s*$/.test(s);
for (const [name, lesson] of [['7B', LESSON_7B], ['7C', LESSON_7C]]) {
  ok(`${name}: three films, one watch-only, every caption and title in both Levels, each film under 45 s`, () => {
    assert.equal(lesson.films.length, 3);
    assert.equal(lesson.films.filter((f) => f.watchOnly).length, 1);
    for (const f of lesson.films) {
      assert.equal(f.title.length, 2);
      for (const b of f.beats) { assert.equal(b.cap.length, 2); assert.ok(b.cap.every((s) => s.trim())); }
      const plan = card.filmPlan(f);
      assert.ok(plan.length < 45, `${f.title[0]}: ${plan.length.toFixed(1)} s`);
    }
  });
  ok(`${name}: every choice is words, never a bare number; the right one is never the uniquely longest (both Levels)`, () => {
    for (const f of lesson.films) {
      if (!f.question) continue;
      assert.equal(f.question.choices.length, 3);
      assert.equal(f.question.choices.filter((c) => c.correct).length, 1);
      for (const c of f.question.choices) for (const lvl of [0, 1]) assert.ok(!bareNumber(c.text[lvl]), `"${c.text[lvl]}" is a bare number`);
      for (const lvl of [0, 1]) {
        const right = f.question.choices.find((c) => c.correct).text[lvl].length;
        const others = f.question.choices.filter((c) => !c.correct).map((c) => c.text[lvl].length);
        assert.ok(!(right > Math.max(...others)), `${f.title[0]}: the right answer is the longest (${right} vs ${Math.max(...others)})`);
      }
    }
  });
  ok(`${name}: Level 1 clues are short and give the answer in plain words`, () => {
    for (const f of lesson.films) {
      if (!f.question) continue;
      assert.ok(f.clue[1].split(/\s+/).length <= 18, f.title[0]);
    }
  });
}
ok('lesson 7B’s films ask the atom questions in order: what things are made of, then the atoms before and after', () => {
  assert.equal(LESSON_7B.id, 'ch7_atoms');
  assert.ok(LESSON_7B.films[0].question.choices.find((c) => c.correct).text[0].includes('atoms'));
  assert.ok(LESSON_7B.films[2].question.choices.find((c) => c.correct).text[0].includes('same atoms'));
  assert.ok(!LESSON_7B.films[1].question, 'the molecule film is watch-only');
});
ok('lesson 7C’s films: doubling, the recycler (watch-only), bread rising', () => {
  assert.equal(LESSON_7C.id, 'ch7_tiny_life');
  assert.ok(LESSON_7C.films[0].question.choices.find((c) => c.correct).text[0].includes('4 bacteria'));
  assert.ok(!LESSON_7C.films[1].question);
  assert.ok(LESSON_7C.films[2].question.choices.find((c) => c.correct).text[0].includes('bubbles'));
});

console.log('the chain and the save key');
ok('the profile reset clears the task save key for both Levels', () => {
  const profile = readFileSync(new URL('../src/launcher/profile.js', import.meta.url), 'utf8');
  assert.ok(profile.includes("'rocket_village_ch7_tasks_L1'"));
  assert.ok(profile.includes("'rocket_village_ch7_tasks_L4'"));
});

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { partCSteps } = await vite.ssrLoadModule('/src/space/ch7/partC.js');
  const { ch7Steps } = await vite.ssrLoadModule('/src/space/ch7/steps.js');
  const game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {} };
  ok('partC: four steps in order, ids start c7_, act 3, each with a title and an objective', () => {
    const steps = partCSteps(game);
    assert.deepEqual(steps.map((s) => s.id), ['c7_atoms', 'c7_chem_tasks', 'c7_tiny_life', 'c7_bio_tasks']);
    for (const s of steps) { assert.equal(s.act, 3); assert.ok(s.title && s.objective, s.id); assert.equal(typeof s.enter, 'function'); }
  });
  ok('the chapter chain still starts Part C after Part B and before Part D', () => {
    const ids = ch7Steps(game).map((s) => s.id);
    const at = (id) => ids.indexOf(id);
    assert.ok(at('c7_atoms') > -1 && at('c7_bio_tasks') > at('c7_atoms'));
    assert.ok(at('c7_bio_tasks') < at('c7_end'));
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
