// Chapter 7, Part B (feel the push and zero-g): the numbers and the rules.
//
//   node scripts/test-ch7-push.mjs
//
// The drop test's times (t = sqrt(2h / a)), the float game's rules (a push, a
// throw, a catch, the wall) and the bot sweep per mode (a sensible player wins
// at least 90% on every mode; do-nothing and random play win at most 10% on
// Hard), lesson 7A's films, the Part B question bank at both Levels, and the
// step chain for Part B.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import {
  PUSH, DROP_H, G_EARTH, fallSeconds, landSpeed, QUICKER, MODES, ROOM, SHIP, TOOLS, PUSH_SPEED, throwGain, throwSum,
  newGame, step, push, throwTool, playOut, sensibleAct, randomAct, rng, nextTarget, route,
} from '../src/space/ch7/floatLogic.js';
import { LESSON_7A } from '../src/lesson/lessons/ch7a.js';
import { CH7B_QUESTIONS, CH7B_LEVEL1 } from '../src/space/ch7/questions.partB.js';

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const PLAIN = /^[\d\s.,/%:-]+$/; // a choice made of numbers only (never allowed)

console.log('drop test');
ok('a ball let go 1 m up takes about 4.5 s at the gentle push (1/100 of Earth’s pull)', () => {
  assert.ok(near(PUSH.gentle, 0.098, 1e-9));
  assert.ok(near(fallSeconds(PUSH.gentle), Math.sqrt(2 / 0.098), 1e-12));
  assert.equal(fallSeconds(PUSH.gentle).toFixed(1), '4.5');
});
ok('at the full push (1 g) it takes about 0.45 s', () => {
  assert.ok(near(PUSH.full, G_EARTH, 1e-12));
  assert.equal(fallSeconds(PUSH.full).toFixed(2), '0.45');
});
ok('the full push lands it 10 times quicker (100 times the push, a square root)', () => {
  assert.equal(QUICKER, 10);
  assert.ok(near(fallSeconds(PUSH.gentle) / fallSeconds(PUSH.full), 10, 1e-9));
  assert.ok(near(fallSeconds(4 * PUSH.gentle) * 2, fallSeconds(PUSH.gentle), 1e-9), '4 times the push: half the time');
});
ok('drive off (no push): the ball never lands, and it has no landing speed', () => {
  assert.equal(fallSeconds(PUSH.off), Infinity);
  assert.equal(landSpeed(PUSH.off), 0);
});
ok('the landing speed is the push times the time: 0.44 m/s gentle, 4.4 m/s full', () => {
  assert.equal(landSpeed(PUSH.gentle, DROP_H).toFixed(2), '0.44');
  assert.equal(landSpeed(PUSH.full, DROP_H).toFixed(1), '4.4');
});

console.log('float game rules');
const P = (x, y) => ({ x, y });
ok('momentum is conserved in a throw: a 3 kg wrench at 2 m/s = 6 kg m/s; Zara (30 kg) drifts 0.2 m/s the other way', () => {
  assert.equal(SHIP.mass, 30);
  const wrench = TOOLS.wrench.mass * TOOLS.wrench.speed;
  assert.equal(wrench, 6);
  assert.ok(near(throwGain('wrench'), 0.2), 'her gain is 6 ÷ 30');
  assert.ok(near(SHIP.mass * throwGain('wrench'), wrench), 'her momentum equals the wrench’s, the other way');
  assert.equal(throwSum('wrench'), '3 kg × 2 m/s = 30 kg × 0.2 m/s', 'the callout sum');
  assert.ok(throwGain('spanner') > throwGain('wrench'), 'a heavier throw at the same speed gives the bigger push');
  const s = newGame('easy', 3);
  s.stuck = null; s.pos = P(6, 3); s.vel = P(0, 0);
  assert.equal(throwTool(s, 'wrench', P(8, 3)), true);
  assert.ok(near(s.vel.x, 0.2) && near(s.vel.y, 0), `wrench thrown right, she drifts left? got ${s.vel.x}`);
  assert.ok(near(s.vel.x, 0.2), 'she goes TOWARDS the tap: the wrench went the other way');
  assert.ok(s.callout && s.callout.kind === 'wrench', 'the card gets the callout');
  // She moves towards the tap (the tool goes the other way): here, down the screen.
  const t2 = newGame('easy', 3); t2.stuck = null; t2.pos = P(6, 3); t2.vel = P(0, 0);
  throwTool(t2, 'spanner', P(6, 5));
  assert.ok(near(t2.vel.y, 0.4), `spanner, tap below: ${t2.vel.y}`);
});
ok('a throw uses a tool: Hard has 3 throws, Easy and Medium have no limit', () => {
  assert.equal(MODES.hard.throws, 3);
  assert.equal(MODES.medium.throws, Infinity);
  assert.equal(MODES.easy.throws, Infinity);
  const s = newGame('hard', 2); s.stuck = null; s.pos = P(6, 3); s.vel = P(0, 0);
  for (let k = 0; k < 3; k++) assert.equal(throwTool(s, 'wrench', P(7, 3)), true);
  assert.equal(throwTool(s, 'wrench', P(7, 3)), false, 'a fourth throw is refused');
  assert.equal(s.throws, 0);
});
ok('a push off a handle sends her away from it, and the handle does not catch her again', () => {
  const s = newGame('easy', 4);
  const h = s.room.handles[0];
  s.pos = { ...h }; s.vel = P(0, 0); s.stuck = { kind: 'handle', i: 0 };
  assert.equal(push(s, P(h.x + 1, h.y)), true);
  assert.ok(near(s.vel.x, PUSH_SPEED) && near(s.vel.y, 0));
  for (let k = 0; k < 60; k++) step(s, 1 / 60); // one second at 0.8 m/s
  assert.ok(!s.stuck || s.stuck.i !== 0, 'released: the same handle does not catch her again (another one may)');
  assert.ok(s.pos.x > h.x + 0.7, `she moved away from the handle (${s.pos.x - h.x} m)`);
});
ok('off a wall she pushes away from it, and a push into the wall is refused', () => {
  const s = newGame('easy', 5);
  s.pos = P(ROOM.w - SHIP.r, 3); s.vel = P(0, 0); s.stuck = { kind: 'wall', n: P(-1, 0) };
  assert.equal(push(s, P(ROOM.w, 3)), false, 'into the wall: refused');
  assert.equal(s.stuck.kind, 'wall');
  assert.equal(push(s, P(ROOM.w - 2, 3)), true, 'away from the wall: fine');
  assert.ok(near(s.vel.x, -PUSH_SPEED));
});
ok('floating, she keeps a steady speed until she touches something (no friction in space)', () => {
  for (const mode of ['easy', 'medium', 'hard']) {
    const s = newGame(mode, 9);
    const v0 = { ...s.vel };
    for (let k = 0; k < 60 && !s.stuck && s.status === 'playing'; k++) {
      step(s, 1 / 60);
      if (!s.stuck) assert.ok(near(s.vel.x, v0.x) && near(s.vel.y, v0.y), `${mode}: speed changed while floating`);
    }
  }
});
ok('Easy has the arrow to the next part; Medium and Hard do not', () => {
  assert.equal(MODES.easy.hint, true); assert.equal(MODES.medium.hint, false); assert.equal(MODES.hard.hint, false);
});
ok('a room is the same for the same mode and seed, and has 3 parts to collect', () => {
  const a = newGame('medium', 12); const b = newGame('medium', 12);
  assert.deepEqual(a.room, b.room);
  for (const m of ['easy', 'medium', 'hard']) assert.equal(newGame(m, 1).room.parts.length, 3);
  assert.ok(nextTarget(newGame('easy', 1)).part, 'the first target is a part');
});
ok('the route round the crates is clear of them (the bot never walks through a crate)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = newGame('hard', seed);
    const tg = nextTarget(s);
    const r = route(s, tg);
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y), 'a point');
    for (const c of s.room.blocks) {
      const inside = (p) => p.x > c.x - SHIP.r && p.x < c.x + c.w + SHIP.r && p.y > c.y - SHIP.r && p.y < c.y + c.h + SHIP.r;
      assert.ok(!inside(r), `seed ${seed}: the route point is inside a crate`);
    }
  }
});

console.log('float game bot sweep');
const N = 60;
const rows = [];
for (const mode of ['easy', 'medium', 'hard']) {
  let bot = 0; let none = 0; let rnd = 0; const times = [];
  for (let seed = 1; seed <= N; seed++) {
    const g = playOut(newGame(mode, seed), sensibleAct);
    if (g.status === 'won') { bot++; times.push(g.t); }
    if (playOut(newGame(mode, seed), () => ({ kind: 'wait' })).status === 'won') none++;
    const R = rng(seed * 13 + 5);
    if (playOut(newGame(mode, seed), (s) => randomAct(s, R)).status === 'won') rnd++;
  }
  times.sort((a, b) => a - b);
  rows.push({ mode, bot, none, rnd, median: times[times.length >> 1] ?? 0, max: times.at(-1) ?? 0 });
}
console.log('  mode    sensible  do-nothing  random   median s  max s');
for (const r of rows) console.log(`  ${r.mode.padEnd(7)} ${`${r.bot}/${N}`.padEnd(9)} ${`${r.none}/${N}`.padEnd(11)} ${`${r.rnd}/${N}`.padEnd(8)} ${r.median.toFixed(1).padEnd(9)} ${r.max.toFixed(1)}`);
for (const r of rows) {
  ok(`${r.mode}: a sensible player wins at least 90% (${r.bot}/${N})`, () => assert.ok(r.bot >= 0.9 * N, `${r.bot}/${N}`));
}
ok('do-nothing play never wins on any mode', () => { for (const r of rows) assert.equal(r.none, 0, r.mode); });
ok('random play wins at most 10% on Hard', () => { const h = rows.find((r) => r.mode === 'hard'); assert.ok(h.rnd <= 0.1 * N, `${h.rnd}/${N}`); });
ok('the bot clears every Easy room, and the hint arrow is on', () => {
  const e = rows.find((r) => r.mode === 'easy');
  assert.equal(e.bot, N);
});

console.log('lesson 7A');
ok('lesson 7A: three films, one watch-only breather between two questions', () => {
  assert.equal(LESSON_7A.id, 'ch7_push');
  assert.equal(LESSON_7A.films.length, 3);
  assert.deepEqual(LESSON_7A.films.map((f) => !!f.watchOnly), [false, true, false]);
  assert.ok(LESSON_7A.films[1].watchOnly && !LESSON_7A.films[1].question);
});
ok('lesson 7A: each question has one right answer of three, and choices are never bare numbers', () => {
  for (const f of LESSON_7A.films) {
    if (f.watchOnly) continue;
    assert.equal(f.question.choices.length, 3);
    assert.equal(f.question.choices.filter((c) => c.correct).length, 1);
    for (const c of f.question.choices) for (const lvl of [0, 1]) assert.ok(!PLAIN.test(c.text[lvl]) && /[a-z]/i.test(c.text[lvl]), `bare or empty choice: ${c.text[lvl]}`);
  }
});
ok('lesson 7A: the right choice is never the uniquely longest (both Levels)', () => {
  for (const f of LESSON_7A.films) {
    if (f.watchOnly) continue;
    for (const lvl of [0, 1]) {
      const right = f.question.choices.find((c) => c.correct).text[lvl].length;
      const others = f.question.choices.filter((c) => !c.correct).map((c) => c.text[lvl].length);
      assert.ok(!(right > Math.max(...others)), `level ${lvl === 0 ? 4 : 1}: right answer is the longest`);
    }
  }
});
ok('lesson 7A: the first film predicts (guess before the ball lands), never on the last beat', () => {
  const f = LESSON_7A.films[0];
  assert.ok(f.beats.some((b) => b.predict));
  assert.ok(!f.beats.at(-1).predict);
});
ok('lesson 7A: the ball in film 1 is still in the air at the predict pause, and back in the hand after it', () => {
  // The toss runs 7.5 s to 11.5 s of authored time; the pause is at the end of beat 3 (10.5 s).
  const endOfPredict = LESSON_7A.films[0].beats.slice(0, 3).reduce((a, b) => a + b.dur, 0);
  assert.equal(endOfPredict, 10.5);
  assert.ok(endOfPredict > 7.5 && endOfPredict < 11.5);
});

console.log('the gait option');
ok('createInteriorScene takes a gait (default earth: Chapter 6 unchanged); lope uses the Moon gravity', () => {
  const src = readFileSync(new URL('../src/space/ch6/interior/ship.js', import.meta.url), 'utf8');
  assert.ok(/gait = 'earth'\s*\}/.test(src), 'default gait is earth');
  assert.ok(/createWalker\(\{ gravity: gait === 'earth' \? 9\.8 \* 0\.6 : 1\.6, gait \}\)/.test(src), 'walker takes the gait');
});

console.log('the Part B question bank');
const f1 = fallSeconds(PUSH.gentle).toFixed(1); const f2 = fallSeconds(PUSH.full).toFixed(2);
ok('every Part B question has a Level 4 entry, one right answer of three, and a beat', () => {
  assert.equal(Object.keys(CH7B_QUESTIONS).length, 4);
  for (const [id, q] of Object.entries(CH7B_QUESTIONS)) {
    assert.equal(q.id, id);
    assert.equal(q.choices.length, 3, `${id}: 3 choices`);
    assert.equal(q.choices.filter((c) => c.correct).length, 1, `${id}: one right answer`);
    assert.ok(q.beat && q.prompt && q.hint && q.parentHint && q.success, `${id}: fields`);
    assert.equal(q.act, 2);
  }
});
ok('every Level 1 overlay has its Level 4 question, with choices too (one right, of three)', () => {
  for (const [id, o] of Object.entries(CH7B_LEVEL1)) {
    assert.ok(CH7B_QUESTIONS[id], `${id} has no Level 4 question`);
    assert.equal(o.choices.length, 3);
    assert.equal(o.choices.filter((c) => c.correct).length, 1, `${id}: one right answer`);
  }
});
for (const [level, bank] of [[4, CH7B_QUESTIONS], [1, { ...CH7B_QUESTIONS, ...Object.fromEntries(Object.entries(CH7B_LEVEL1).map(([id, o]) => [id, { ...CH7B_QUESTIONS[id], ...o }])) }]]) {
  ok(`Level ${level}: choices are never bare numbers, and the right one is never the uniquely longest`, () => {
    for (const [id, q] of Object.entries(bank)) {
      for (const c of q.choices) assert.ok(!PLAIN.test(c.text) && /[a-z]/i.test(c.text), `${id}: bare choice "${c.text}"`);
      const right = q.choices.find((c) => c.correct).text.length;
      const others = q.choices.filter((c) => !c.correct).map((c) => c.text.length);
      assert.ok(!(right > Math.max(...others)), `${id}: the right choice is the longest`);
    }
  });
}
ok('the drop time question: 4.5 seconds at gentle (Level 4) and about 5 at Level 1; the choices match the numbers', () => {
  const q = CH7B_QUESTIONS.c7b_gentle_drop;
  assert.ok(q.choices.some((c) => c.correct && c.text === 'about 4.5 seconds'));
  assert.ok(q.success.includes(`${f1} seconds`), 'success names 4.5');
  assert.ok(q.parentHint.includes(`${f1} s`) && q.parentHint.includes(`${f2} s`), 'parent hint has both times');
  const o = CH7B_LEVEL1.c7b_gentle_drop;
  assert.ok(o.choices.some((c) => c.correct && c.text === 'about 5 seconds'));
});
ok('the full push question: 10 times quicker (4.5 s over 0.45 s), at both Levels', () => {
  const q = CH7B_QUESTIONS.c7b_full_drop;
  assert.ok(q.choices.some((c) => c.correct && c.text === 'about 10 times'));
  assert.ok(q.parentHint.includes(`${f1} ÷ ${f2} = 10`));
  assert.ok(q.success.includes('10 times quicker'));
  const o = CH7B_LEVEL1.c7b_full_drop;
  assert.ok(o.choices.some((c) => c.correct && c.text === 'about half a second'), 'Level 1: half a second');
  assert.ok(o.prompt.includes(`${Math.round(fallSeconds(PUSH.gentle))} seconds`), 'Level 1 prompt uses the card’s about-5 seconds');
  assert.ok(o.parentHint.includes(`${Math.round(fallSeconds(PUSH.gentle))} seconds ÷ 10`));
});
ok('the throw question: the heavier spanner (6 kg) pushes harder than the wrench (3 kg) at the same speed', () => {
  const q = CH7B_QUESTIONS.c7b_float_throw;
  assert.ok(q.parentHint.includes("6 kg m/s (3 kg × 2 m/s)") && q.parentHint.includes('0.2 m/s'));
  assert.ok(q.parentHint.includes('12 kg m/s') && q.parentHint.includes('0.4 m/s'));
  assert.ok(q.prompt.includes('6 kg spanner') && q.prompt.includes('3 kg wrench'));
  assert.ok(q.choices.some((c) => c.correct && c.text === 'The spanner: it is heavier'));
  assert.ok(CH7B_LEVEL1.c7b_float_throw.choices.some((c) => c.correct && c.text === 'The big spanner'), 'Level 1: the big spanner');
});
ok('the sum question: Zara (30 kg) and a 3 kg wrench at 2 m/s: 0.2 m/s the other way', () => {
  const q = CH7B_QUESTIONS.c7b_throw_sum;
  assert.ok(q.prompt.includes('30 kg') && q.prompt.includes('3 kg') && q.prompt.includes('2 m/s'));
  assert.ok(q.choices.some((c) => c.correct && c.text === '0.2 m/s'));
  assert.ok(q.parentHint.includes('6 kg m/s ÷ 30 kg = 0.2 m/s'));
  assert.ok(CH7B_LEVEL1.c7b_throw_sum.choices.some((c) => c.correct && c.text === 'Faster'), 'Level 1: the big spanner floats you faster');
  assert.ok(!CH7B_QUESTIONS.c7b_speed_press && !CH7B_LEVEL1.c7b_speed_press, 'the speeding-up question is gone (lesson 7A has it)');
});

console.log('the Part B steps');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { partBSteps } = await vite.ssrLoadModule('/src/space/ch7/partB.js');
  const { ch7Bank } = await vite.ssrLoadModule('/src/space/ch7/questions.ch7.js');
  const game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {} };
  const steps = partBSteps(game);
  const bank4 = ch7Bank(4); const bank1 = ch7Bank(1);
  ok('Part B: four steps, all in act 2, ids start c7_ and are unique', () => {
    assert.equal(steps.length, 4);
    assert.ok(steps.every((s) => s.act === 2 && s.id.startsWith('c7_') && s.title));
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
  });
  ok('Part B: each question beat the steps ask is in the bank at both Levels', () => {
    for (const beat of ['c7bGentleDrop', 'c7bFloatThrow', 'c7bThrowSum', 'c7bFullDrop']) {
      assert.ok(Object.values(bank4).some((q) => q.beat === beat), `Level 4: ${beat}`);
      assert.ok(Object.values(bank1).some((q) => q.beat === beat), `Level 1: ${beat}`);
    }
  });
  ok('Part B: the step file names every spot it walks to (drop, engine, drop again)', () => {
    const src = readFileSync(new URL('../src/space/ch7/partB.js', import.meta.url), 'utf8');
    for (const id of ['c7_drop', 'c7_engine', 'c7_drop_full']) assert.ok(src.includes(`id: '${id}'`), id);
    assert.ok(src.includes("gait: 'lope'"), 'the gentle push walks the floaty step');
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
