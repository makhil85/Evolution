// Chapter 6, Part E (steps 13-20): rules, questions and lessons, no drawing.
//
//   node scripts/test-ch6-route.mjs
//
// The route sums (src/space/ch6/routes.js): every route can reach the goal
// speed inside the fuel tank, but not without choices (the default plan
// falls short, skimming everything burns too much fuel on two of three);
// closer always means more boost and more fuel; a better-timed press never
// keeps less. The Part E question bank re-derives every number from those
// same tables. Lessons 6B and 6C have the shape every lesson has, and their
// films draw from start to end. The steps chain is well formed and its beats
// all have a question.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const R = await import('../src/space/ch6/routes.js');
const { ROUTES, STOPS, CLOSE_LEVELS, FUEL_BUDGET, GOAL_BOOST, START_SPEED } = R;

console.log('routes');
ok('three routes, each ending with the Sun dive, outermost stop first', () => {
  assert.equal(ROUTES.length, 3);
  const order = ['neptune', 'uranus', 'saturn', 'jupiter', 'earth', 'sun'];
  for (const r of ROUTES) {
    assert.equal(r.stops.at(-1), 'sun');
    const ix = r.stops.map((s) => order.indexOf(s));
    assert.ok(ix.every((v, i) => v >= 0 && (i === 0 || v > ix[i - 1])), `${r.id}: flies inward`);
  }
});
ok('closer always gives more boost and costs more fuel', () => {
  for (const [id, s] of Object.entries(STOPS)) {
    assert.equal(s.boost.length, CLOSE_LEVELS); assert.equal(s.fuel.length, CLOSE_LEVELS);
    for (let i = 1; i < CLOSE_LEVELS; i++) {
      assert.ok(s.boost[i] > s.boost[i - 1], `${id} boost`);
      assert.ok(s.fuel[i] > s.fuel[i - 1], `${id} fuel`);
    }
  }
});
ok('Jupiter is the best planet for a slingshot; the Sun dive (the drive) beats them all', () => {
  const planets = Object.keys(STOPS).filter((k) => k !== 'sun');
  for (const p of planets) if (p !== 'jupiter') assert.ok(STOPS.jupiter.boost[3] > STOPS[p].boost[3], p);
  assert.ok(STOPS.sun.boost[3] > STOPS.jupiter.boost[3]);
});
for (const r of ROUTES) {
  ok(`${r.id}: a plan reaches ${GOAL_BOOST} km/s inside the ${FUEL_BUDGET} t tank, but the default doesn't`, () => {
    const best = R.planTotals(R.bestPlan(r.id));
    assert.ok(best.ok, `${r.id} best ${best.boost} km/s, ${best.fuel} t`);
    assert.equal(R.planTotals(R.newPlan(r.id)).ok, false);
    // further than "far" or closer than "skimming" can't be set
    const wild = R.planTotals({ route: r.id, close: r.stops.map(() => 99) });
    assert.ok(wild.legs.every((l) => l.close === CLOSE_LEVELS));
  });
}
ok('skimming every flyby uses too much fuel on two of the three routes', () => {
  const over = ROUTES.filter((r) => !R.planTotals({ route: r.id, close: r.stops.map(() => CLOSE_LEVELS) }).inBudget);
  assert.equal(over.length, 2);
});
ok('timing: a perfect press keeps all; inside the window at least 70%; a miss keeps half; never more for a worse press', () => {
  assert.equal(R.keptFraction(0), 1);
  assert.ok(R.keptFraction(1) >= 0.7 - 1e-9);
  assert.equal(R.keptFraction(5), 0.5);
  let prev = 2;
  for (let e = 0; e <= 3; e += 0.05) { const k = R.keptFraction(e); assert.ok(k <= prev + 1e-12); prev = k; assert.equal(R.keptFraction(-e), k); }
  for (let c = 2; c <= CLOSE_LEVELS; c++) assert.ok(R.windowFor(c) < R.windowFor(c - 1), 'closer = narrower window');
});
ok('the flight result adds each kept boost to a running speed', () => {
  const plan = R.bestPlan('usj');
  const perfect = R.flightResult(plan, plan.close.map(() => 0));
  assert.equal(perfect.speed, START_SPEED + R.planTotals(plan).boost);
  let s = START_SPEED;
  for (const l of perfect.legs) { s += l.kept; assert.equal(l.speed, s); }
  const missed = R.flightResult(plan, plan.close.map(() => null));
  assert.ok(missed.speed < perfect.speed && missed.kept >= Math.floor(R.planTotals(plan).boost / 2) - plan.close.length);
});
ok('percent of light and years to a star', () => {
  assert.equal(R.percentOfLight(30000), 10);
  assert.equal(R.percentOfLight(15000), 5);
  assert.equal(R.yearsAt(4, 10), 40);
  assert.ok(Math.abs(R.yearsAt(4.4, R.CRUISE_PERCENT) - 44) < 1e-9);
});

console.log('questions');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { checkSpaceAnswer } = await vite.ssrLoadModule('/src/space/questions.space.js');
  const Q = await vite.ssrLoadModule('/src/space/ch6/questions.partE.js');
  const banks = { 4: Q.partEBank(4), 1: Q.partEBank(1) };
  for (const [lv, bank] of Object.entries(banks)) {
    ok(`Level ${lv}: every question well formed, one right choice, its answers accepted`, () => {
      const beats = new Set();
      for (const [id, q] of Object.entries(bank)) {
        assert.equal(q.id, id); assert.ok(id.startsWith('c6_'));
        for (const f of ['type', 'title', 'prompt', 'hint', 'success', 'doneMessage', 'beat']) assert.ok(typeof q[f] === 'string' && q[f], `${id}.${f}`);
        assert.ok(!beats.has(q.beat), `${id}: beat used twice`); beats.add(q.beat);
        if (q.type === 'choice') {
          assert.equal(q.choices.filter((c) => c.correct).length, 1, id);
          assert.ok(checkSpaceAnswer(q, q.choices.find((c) => c.correct).text));
          for (const c of q.choices.filter((x) => !x.correct)) assert.ok(!checkSpaceAnswer(q, c.text), `${id}: wrong choice accepted`);
        } else {
          assert.ok(q.answers.length > 0);
          for (const a of q.answers) assert.ok(checkSpaceAnswer(q, a), `${id}: "${a}"`);
        }
      }
    });
  }
  const L4 = banks[4];
  const s = STOPS;
  const derived = {
    c6_route_sum: START_SPEED + s.neptune.boost[2] + s.jupiter.boost[2] + s.sun.boost[3],
    c6_fuel_left: FUEL_BUDGET - (s.neptune.fuel[2] + s.jupiter.fuel[2] + s.sun.fuel[3]),
    c6_percent_light: R.percentOfLight(R.LIGHT_KMS / 20),
    c6_star_years: Math.round(R.yearsAt(4.4, R.CRUISE_PERCENT)),
  };
  ok('Level 4 numbers re-derived from the game tables', () => {
    for (const [id, v] of Object.entries(derived)) assert.ok(checkSpaceAnswer(L4[id], String(v)), `${id}: ${v}`);
    // tempting slips are not accepted
    assert.ok(!checkSpaceAnswer(L4.c6_route_sum, String(derived.c6_route_sum - START_SPEED)), 'forgot the start speed');
    assert.ok(!checkSpaceAnswer(L4.c6_star_years, '0.44'));
    assert.ok(!checkSpaceAnswer(L4.c6_star_years, '4.4'));
  });
  ok('Level 1 numbers (within 40, counting on and by tens)', () => {
    const L1 = banks[1];
    assert.ok(checkSpaceAnswer(L1.c6_route_sum, String(9 + 10)));
    assert.ok(checkSpaceAnswer(L1.c6_fuel_left, String(20 - 8)));
    assert.ok(checkSpaceAnswer(L1.c6_percent_light, String(10 * 1)));
    assert.ok(checkSpaceAnswer(L1.c6_star_years, String(4 * 10)));
  });

  console.log('steps');
  const E = await vite.ssrLoadModule('/src/space/ch6/partE.js');
  const fakeGame = { hud: {}, bus: null };
  const steps = E.partESteps(fakeGame);
  ok('Part E steps: unique c6_ ids, an enter each, and every beat has a question', () => {
    const ids = steps.map((st) => st.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const st of steps) {
      assert.ok(st.id.startsWith('c6_'), st.id);
      assert.equal(typeof st.enter, 'function', st.id);
      assert.ok(typeof st.title === 'string' && st.title, st.id);
      if (st.beat) assert.ok(Object.values(L4).some((q) => q.beat === st.beat), `${st.id}: no question for ${st.beat}`);
    }
    // every question is asked somewhere in the chain
    for (const q of Object.values(L4)) assert.ok(steps.some((st) => st.beat === q.beat), `${q.id} never asked`);
    assert.equal(steps.at(-1).id, 'c6_end');
  });

  console.log('lessons');
  const card = await vite.ssrLoadModule('/src/lesson/card.js');
  const { LESSON_6B } = await vite.ssrLoadModule('/src/lesson/lessons/ch6b.js');
  const { LESSON_6C } = await vite.ssrLoadModule('/src/lesson/lessons/ch6c.js');
  const pair = (v, what) => { assert.ok(Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string' && x.trim()), what); };
  const fakeCtx = () => {
    const grad = { addColorStop() {} };
    return new Proxy({}, { get(_, k) { if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad; if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
  };
  for (const L of [LESSON_6B, LESSON_6C]) {
    ok(`${L.id}: 3 films, both Levels, one right answer of three, a short Level 1 clue, under 45 s each`, () => {
      pair(L.eyebrow, 'eyebrow');
      assert.equal(L.films.length, 3);
      for (const f of L.films) {
        pair(f.title, 'title');
        for (const b of f.beats) { assert.ok(b.dur > 0); pair(b.cap, 'caption'); }
        assert.ok(!f.beats.at(-1).predict, 'predict on the last beat');
        const q = f.question;
        pair(q.prompt, 'prompt'); pair(q.hint, 'hint'); pair(q.why, 'why');
        assert.equal(q.choices.length, 3); assert.equal(q.choices.filter((c) => c.correct).length, 1);
        assert.ok(f.clue?.[1] && f.clue[1].split(/\s+/).length <= 18);
        const plan = card.filmPlan(f);
        assert.ok(plan.length < 45, `${f.title[0]}: ${plan.length.toFixed(1)} s`);
      }
    });
    ok(`${L.id}: every film draws from start to end without throwing`, () => {
      for (const f of L.films) {
        const plan = card.filmPlan(f);
        for (let k = 0; k <= 40; k++) f.draw(fakeCtx(), card.planAt(plan, (plan.length * k) / 40).T, { level: 4, t: (a) => a, reduced: false, asking: false });
      }
    });
  }
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
