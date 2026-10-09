// Chapter 7 (Toward Tau Ceti): the chain and the bank fit together.
//
//   node scripts/test-ch7.mjs
//
// Checks the scaffold every work package builds on (CHAPTER7_PLAN.md): the
// five parts in order, unique step ids, every beat a step asks is in the bank
// at both Levels, every Level 1 overlay id exists at Level 4, and the chain
// ends on the end card. Each work package adds its own test file for its
// rules and numbers (test-ch7-*.mjs).
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { ch7Steps } = await vite.ssrLoadModule('/src/space/ch7/steps.js');
  const { ch7Bank } = await vite.ssrLoadModule('/src/space/ch7/questions.ch7.js');
  const { CH7_ACT_TITLES } = await vite.ssrLoadModule('/src/space/ch7/start.js');
  const parts = {};
  for (const p of ['A', 'B', 'C', 'D', 'E']) parts[p] = await vite.ssrLoadModule(`/src/space/ch7/questions.part${p}.js`);
  // A stand-in game: steps are only built here, never entered.
  const game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {} };
  const steps = ch7Steps(game);

  console.log('chapter 7 chain');
  ok('step ids are unique, and every step has a title and an act from the act list', () => {
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
    for (const s of steps) {
      assert.ok(s.title, `${s.id}: title`);
      assert.ok(CH7_ACT_TITLES[s.act], `${s.id}: act ${s.act} has no title`);
    }
  });
  ok('the acts run in order, A to E', () => {
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i].act >= steps[i - 1].act, `${steps[i].id} goes back to act ${steps[i].act}`);
  });
  ok('the chain ends on the end card', () => assert.equal(steps.at(-1).id, 'c7_end'));
  for (const level of [4, 1]) {
    const bank = ch7Bank(level);
    const beats = new Set(Object.values(bank).map((q) => q.beat));
    ok(`Level ${level}: every beat a step asks is in the bank`, () => {
      for (const s of steps) {
        for (const b of [s.beat, ...(s.bonusBeats || [])].filter(Boolean)) assert.ok(beats.has(b), `${s.id}: beat ${b} has no question`);
      }
    });
    ok(`Level ${level}: every question has an id, a beat, a prompt and answers or choices`, () => {
      for (const [id, q] of Object.entries(bank)) {
        assert.equal(q.id, id);
        assert.ok(q.beat && q.prompt, `${id}: beat/prompt`);
        assert.ok((q.answers && q.answers.length) || (q.choices && q.choices.length), `${id}: answers or choices`);
      }
    });
  }
  ok('each part\'s Level 1 overlay only overlays its own Level 4 ids', () => {
    for (const [p, m] of Object.entries(parts)) {
      for (const id of Object.keys(m[`CH7${p}_LEVEL1`])) assert.ok(m[`CH7${p}_QUESTIONS`][id], `part ${p}: Level 1 ${id} has no Level 4 question`);
    }
  });
  ok('question ids are unique across the parts', () => {
    const all = Object.values(parts).flatMap((m, i) => Object.keys(m[`CH7${'ABCDE'[i]}_QUESTIONS`]));
    assert.equal(new Set(all).size, all.length);
  });
} finally {
  await vite.close();
}
console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
