// Lessons (src/lesson/) and Chapter 3's Launch Tuner: data and maths checks.
//
//   node scripts/test-lessons.mjs
//
// The films themselves are checked by eye in the browser (HANDOFF.md); this
// guards what a typo would silently break: every film has captions at both
// Levels and one question with exactly one right answer out of three, the
// reading-paced clock holds captions long enough, the films draw without
// throwing, and the tuner's test flights keep the trade-off the lesson needs.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const { LESSON_1A, LESSON_1B } = await import('../src/lesson/lessons/ch1.js');
const { LESSON_2A, LESSON_2B } = await import('../src/lesson/lessons/ch2.js');
const { LESSON_3A, LESSON_3B } = await import('../src/lesson/lessons/ch3.js');
const card = await import('../src/lesson/card.js');
const { LESSON_4G } = await import('../src/lesson/lessons/ch4.js');
const { LESSON_4F } = await import('../src/lesson/lessons/flightSchool.js');
const { LESSON_5A, LESSON_5AA } = await import('../src/lesson/lessons/ch5.js');
const { LESSON_5B } = await import('../src/lesson/lessons/ch5b.js');
const { LESSON_5C } = await import('../src/lesson/lessons/ch5c.js');
const { LESSON_6A } = await import('../src/lesson/lessons/ch6a.js');
const { LESSON_6B } = await import('../src/lesson/lessons/ch6b.js');
const { LESSON_6C } = await import('../src/lesson/lessons/ch6c.js');
const LESSONS = [LESSON_1A, LESSON_1B, LESSON_2A, LESSON_2B, LESSON_3A, LESSON_3B, LESSON_4F, LESSON_4G, LESSON_5A, LESSON_5AA, LESSON_5B, LESSON_5C, LESSON_6A, LESSON_6B, LESSON_6C];
// Films per lesson: three, unless the plan says otherwise.
const FILMS = { ch4_flight_school: 4, ch5_momentum: 5, ch5_fusion: 5 };

const pair = (v, what) => {
  assert.ok(Array.isArray(v) && v.length === 2, `${what}: needs [Level 4, Level 1]`);
  assert.ok(v.every((s) => typeof s === 'string' && s.trim()), `${what}: empty text`);
};

/** A 2-D context that accepts every call and records nothing. */
function fakeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set() { return true; },
  });
}

console.log('lessons');
const { LESSON_LIST } = await import('../src/lesson/index.js');
ok('every lesson has its own id, and the launcher lists them all in play order', () => {
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  assert.deepEqual(LESSON_LIST.map((l) => l.id), LESSONS.map((l) => l.id));
});
for (const L of LESSONS) {
  const nFilms = FILMS[L.id] ?? 3;
  ok(`${L.id}: ${nFilms} films, both Levels, one right answer of three, a Level 1 clue`, () => {
    pair(L.eyebrow, `${L.id} eyebrow`);
    assert.equal(L.films.length, nFilms);
    L.films.forEach((f, i) => {
      const where = `${L.id} film ${i + 1}`;
      pair(f.title, `${where} title`);
      assert.ok(f.beats.length >= 2, `${where}: beats`);
      for (const b of f.beats) { assert.ok(b.dur > 0, `${where}: beat length`); pair(b.cap, `${where} caption`); }
      // A predict pause holds the film mid-way, so never on the last beat.
      assert.ok(!f.beats.at(-1).predict, `${where}: predict on the last beat`);
      // A watch-only film (no question) is the exception, never the rule.
      if (f.watchOnly) { assert.ok(!f.question, `${where}: watch-only with a question`); return; }
      const q = f.question;
      pair(q.prompt, `${where} prompt`); pair(q.hint, `${where} hint`); pair(q.why, `${where} why`);
      assert.equal(q.choices.length, 3, `${where}: 3 choices`);
      assert.equal(q.choices.filter((c) => c.correct).length, 1, `${where}: one right answer`);
      q.choices.forEach((c) => pair(c.text, `${where} choice`));
      // Level 1 written clue (lead 2026-10-05): short, and it gives the answer.
      assert.ok(Array.isArray(f.clue) && typeof f.clue[1] === 'string' && f.clue[1].trim(), `${where}: Level 1 clue`);
      assert.ok(f.clue[1].split(/\s+/).length <= 18, `${where}: clue too long`);
    });
  });
  ok(`${L.id}: every film draws from start to end without throwing`, () => {
    for (const f of L.films) {
      const plan = card.filmPlan(f);
      for (let k = 0; k <= 20; k++) {
        const { T } = card.planAt(plan, (plan.length * k) / 20);
        f.draw(fakeCtx(), T, { level: 4, t: (a) => a, reduced: false, asking: false });
      }
    }
  });
}
ok('most films end in a question (watch-only films are rare)', () => {
  for (const L of LESSONS) assert.ok(L.films.filter((f) => f.watchOnly).length <= 1, `${L.id}: too many watch-only films`);
});
ok('captions are held long enough to read', () => {
  for (const L of LESSONS) {
    for (const f of L.films) {
      const plan = card.filmPlan(f);
      for (const b of plan.beats) assert.ok(b.real >= card.readSeconds(b.cap) - 1e-9);
      // a whole lesson stays near the lead's 2-3 minutes (films only, both Levels)
      assert.ok(plan.length < 45, `${L.id}: a film over 45 s (${plan.length.toFixed(1)} s)`);
    }
  }
});
ok('the clock maps real time onto authored time, start and end', () => {
  const plan = card.filmPlan(LESSON_3A.films[0]);
  assert.equal(card.planAt(plan, 0).T, 0);
  assert.equal(card.planAt(plan, plan.length).T, plan.authored);
  assert.equal(card.planAt(plan, plan.length + 5).T, plan.authored);
});

console.log('launch tuner');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { testFlight } = await vite.ssrLoadModule('/src/game/launchTuner.js');
  const km = (n, nose = 'pointed') => Math.round(testFlight({ fuelTanks: n, noseCone: nose }).apogeeM / 1000);
  ok('5 tanks + pointed nose reaches space (the build Easy starts on)', () => {
    const f = testFlight({ fuelTanks: 5, noseCone: 'pointed' });
    assert.ok(f.reachedSpace); assert.equal(f.verdict, 'orbit');
  });
  ok('Medium/Hard start (2 tanks, flat top) falls short', () => {
    assert.equal(testFlight({ fuelTanks: 2, noseCone: 'blunt' }).reachedSpace, false);
  });
  ok('more fuel is not always better: the climb turns over', () => {
    assert.ok(km(5) > km(3)); assert.ok(km(5) > km(8));
    assert.equal(testFlight({ fuelTanks: 8, noseCone: 'pointed' }).verdict, 'too-heavy');
  });
  ok('a flat top never reaches space (the drag lesson)', () => {
    for (let n = 1; n <= 8; n++) assert.equal(testFlight({ fuelTanks: n, noseCone: 'blunt' }).reachedSpace, false, `${n} tanks`);
  });
  ok('the drawn climb starts on the pad and ends at the high point', () => {
    const f = testFlight({ fuelTanks: 4, noseCone: 'rounded' });
    assert.equal(f.points[0].km, 0);
    assert.ok(Math.abs(f.points[f.points.length - 1].km - f.apogeeM / 1000) < 0.5);
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
