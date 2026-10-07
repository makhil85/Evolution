// Chapter 6, Part E (steps 13-20): rules, questions and lessons, no drawing.
//
//   node scripts/test-ch6-route.mjs
//
// The route sums (src/space/ch6/routes.js, from the asteroid belt): with
// 10 t a straight burn can't leave the Sun; planets add energy, the giants
// most, and closer never less; the Sun dive (burn where she is fastest) is
// the fastest of all; 100 t beats 10 t on every route; a better-timed press
// never keeps less. The Part E question bank re-derives every number from
// that model. Lessons 6B and 6C have the shape every lesson has, and their
// films draw from start to end. The steps chain is well formed and its
// beats all have a question.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const R = await import('../src/space/ch6/routes.js');
const await_crew = await import('../src/space/ch6/crewInfo.js');
const { ROUTES, STOPS, CLOSE_LEVELS, FUELS } = R;

console.log('routes');
const best = (id, f) => R.planTotals(R.bestPlan(id, f)).speed;
ok('five routes: straight out, three planet tours (outward), Jupiter then the Sun', () => {
  assert.deepEqual(ROUTES.map((r) => r.id), ['straight', 'js', 'jsu', 'jsun', 'sun']);
  const order = ['jupiter', 'saturn', 'uranus', 'neptune'];
  for (const r of ROUTES.filter((x) => !x.fall)) {
    const ix = r.stops.map((s) => order.indexOf(s));
    assert.ok(ix.every((v, i) => v >= 0 && (i === 0 || v > ix[i - 1])), `${r.id}: flies outward`);
  }
});
ok('the engine: 10 t gives about 3 km/s, 100 t about 29 km/s', () => {
  assert.equal(Math.round(R.engineKms(10)), 3);
  assert.equal(Math.round(R.engineKms(100)), 29);
});
ok('with 10 t a straight burn cannot leave the Sun; with 100 t it can', () => {
  assert.ok(best('straight', FUELS[0]) <= 0);
  assert.ok(best('straight', FUELS[1]) > 30);
});
ok('each planet added steals energy; the giants steal the most (Jupiter > Saturn > Uranus > Neptune)', () => {
  for (const f of FUELS) {
    const legs = R.planTotals(R.bestPlan('jsun', f)).legs.filter((l) => l.id !== 'burn');
    for (const l of legs) assert.ok(l.energyGain > 0, `${f} t ${l.id}`);
    for (let i = 1; i < legs.length; i++) assert.ok(legs[i].energyGain < legs[i - 1].energyGain, `${f} t ${legs[i].id}`);
    assert.ok(best('js', f) < best('jsu', f) && best('jsu', f) < best('jsun', f), `${f} t: more planets, more speed`);
  }
});
ok('closer never steals less', () => {
  for (const f of FUELS) for (const r of ROUTES) {
    if (!r.stops.length) continue;
    for (let i = 0; i < r.stops.length; i++) {
      let prev = -Infinity;
      for (let c = 1; c <= CLOSE_LEVELS; c++) {
        const close = r.stops.map(() => 2); close[i] = c;
        const v = R.simulate({ route: r.id, fuel: f, close }).speed;
        assert.ok(v >= prev - 1e-9, `${r.id} ${f} t stop ${i} level ${c}`); prev = v;
      }
    }
  }
});
ok('the Sun dive is the fastest way out with either load; 100 t beats 10 t on every route', () => {
  for (const f of FUELS) assert.equal(R.fastestRoute(f).route, 'sun');
  for (const r of ROUTES) assert.ok(best(r.id, FUELS[1]) > best(r.id, FUELS[0]), r.id);
  // further than "far" or closer than "skimming" can't be set
  const wild = R.planTotals({ route: 'jsun', fuel: 10, close: [99, 99, 99, 99] });
  assert.ok(wild.legs.filter((l) => l.close).every((l) => l.close === CLOSE_LEVELS));
});
ok('timing: a perfect press keeps all; inside the window at least 70%; a miss keeps half; never more for a worse press', () => {
  assert.equal(R.keptFraction(0), 1);
  assert.ok(R.keptFraction(1) >= 0.7 - 1e-9);
  assert.equal(R.keptFraction(5), 0.5);
  let prev = 2;
  for (let e = 0; e <= 3; e += 0.05) { const k = R.keptFraction(e); assert.ok(k <= prev + 1e-12); prev = k; assert.equal(R.keptFraction(-e), k); }
  for (let c = 2; c <= CLOSE_LEVELS; c++) assert.ok(R.windowFor(c) < R.windowFor(c - 1), 'closer = narrower window');
});
ok('the flight: perfect presses fly the plan; misses never leave her faster', () => {
  for (const id of ['jsun', 'sun']) {
    const plan = R.bestPlan(id, FUELS[1]);
    const n = R.routeById(id).stops.length;
    const perfect = R.flightResult(plan, new Array(n).fill(0));
    assert.equal(perfect.speed, R.planTotals(plan).speed, id);
    const missed = R.flightResult(plan, new Array(n).fill(null));
    assert.ok(missed.speed < perfect.speed, id);
  }
});
ok('percent of light and years to a star', () => {
  assert.equal(R.percentOfLight(30000), 10);
  assert.equal(R.percentOfLight(15000), 5);
  assert.equal(R.yearsAt(4, 10), 40);
  assert.ok(Math.abs(R.yearsAt(4.4, R.CRUISE_PERCENT) - 44) < 1e-9);
});

console.log('stations');
const S = await import('../src/space/ch6/stationsLogic.js');
ok('shield: each metre stops half; the thin spots can all be patched with the blocks given, with a little spare', () => {
  assert.equal(S.raysThrough(0), 100); assert.equal(S.raysThrough(1), 50); assert.equal(S.raysThrough(3), 12.5);
  const sh = S.createShield();
  assert.ok(!S.shieldDone(sh));
  sh.cells.forEach((m, i) => { while (sh.cells[i] < S.SHIELD.safe) assert.ok(S.patchCell(sh, i)); });
  assert.ok(S.shieldDone(sh)); assert.equal(sh.blocks, S.SHIELD.spare);
  assert.ok(S.worstLeak(sh) < 2);
});
ok('oxygen: exactly one mix makes enough for five inside the power', () => {
  assert.equal(S.oxygenNeed(), 2750);
  assert.deepEqual(S.oxygenAnswers(), [{ lamps: 6, split: 2 }]);
  assert.ok(!S.oxygenTotals({ lamps: 6, split: 3 }).inPower); // more splitter = too much power
  assert.ok(!S.oxygenTotals({ lamps: 6, split: 1 }).enough);
});
ok('water: grit first, UV last; 98% back, a tank lasts 500 days', () => {
  assert.equal(S.waterProblem(['grit', 'bio', 'uv']), null);
  for (const o of [['bio', 'grit', 'uv'], ['grit', 'uv', 'bio'], ['uv', 'bio', 'grit'], ['grit', 'grit', 'uv']]) assert.ok(S.waterProblem(o), o.join());
  assert.equal(S.recycledPercent(), 98); assert.equal(S.tankDays(), 500);
});
ok('food: a farm of 10-12 m² feeds five; too small or too big fails', () => {
  assert.equal(S.foodNeed(), 5);
  for (const f of S.farmAnswers()) { const a = f.w * f.l; assert.ok(a >= 10 && a <= 12); }
  assert.ok(!S.farmTotals({ w: 3, l: 3 }).ok); assert.ok(!S.farmTotals({ w: 4, l: 4 }).ok);
});
ok('energy: the minimum shares (1/3, 1/4, 1/6, 1/4) use exactly the 12 units', () => {
  const mins = Object.fromEntries(S.GRID.systems.map((x) => [x.id, x.min]));
  assert.ok(S.gridTotals(mins).ok);
  assert.deepEqual(S.GRID.systems.map((x) => S.fraction(x.min)), ['1/3', '1/4', '1/6', '1/4']);
  assert.ok(!S.gridTotals({ ...mins, air: 3, engine: 4 }).ok);
  assert.ok(S.gridTotals({ ...mins, engine: 4 }).over);
});
ok('pack: only what is needed, under 10 t (8.8 t); junk or a missing need fails', () => {
  const need = S.PACK_CARDS.filter((c) => c.need).map((c) => c.id);
  assert.equal(S.packNeededMass(), 8.8);
  assert.ok(S.packTotals(need).ok);
  assert.ok(!S.packTotals([...need, 'piano']).ok);
  assert.ok(!S.packTotals(need.slice(1)).ok);
});
ok('six stations, each led by a crewmate', () => {
  assert.equal(S.STATIONS.length, 6);
  const { CREW_INFO } = await_crew;
  for (const st of S.STATIONS) assert.ok(CREW_INFO[st.lead], st.id);
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
  const derived = {
    c6_fuel_left: best('jsun', FUELS[0]) - best('js', FUELS[0]),
    c6_percent_light: R.percentOfLight(R.LIGHT_KMS / 20),
    c6_star_years: Math.round(R.yearsAt(4.4, R.CRUISE_PERCENT)),
  };
  ok('Level 4 numbers re-derived from the game model', () => {
    for (const [id, v] of Object.entries(derived)) assert.ok(checkSpaceAnswer(L4[id], String(v)), `${id}: ${v}`);
    assert.ok(!checkSpaceAnswer(L4.c6_fuel_left, String(best('jsun', FUELS[0]))), 'the total, not the difference');
    assert.ok(!checkSpaceAnswer(L4.c6_star_years, '0.44'));
    assert.ok(!checkSpaceAnswer(L4.c6_star_years, '4.4'));
  });
  ok('Level 1 numbers (small, counting on and by tens)', () => {
    const L1 = banks[1];
    assert.ok(checkSpaceAnswer(L1.c6_fuel_left, String(derived.c6_fuel_left)));
    assert.ok(checkSpaceAnswer(L1.c6_percent_light, String(10 * 1)));
    assert.ok(checkSpaceAnswer(L1.c6_star_years, String(4 * 10)));
  });

  console.log('steps');
  const Ch6 = await vite.ssrLoadModule('/src/space/ch6/steps.js');
  const QB = await vite.ssrLoadModule('/src/space/ch6/questions.partB.js');
  const fakeGame = { hud: {}, bus: null, scene: { add() {}, remove() {} }, ship: { x: 60000, z: 0 } };
  const steps = Ch6.ch6Steps(fakeGame);
  Object.assign(L4, QB.partBBank(4));
  // The engine build (moved here from Chapter 5) brings its own question.
  const { CH5_QUESTIONS } = await vite.ssrLoadModule('/src/space/ch5/questions.ch5.js');
  L4.c5_deuterium = CH5_QUESTIONS.c5_deuterium;
  ok('station questions: numbers re-derived from the station tables, both Levels', () => {
    const B4 = QB.partBBank(4); const B1 = QB.partBBank(1);
    for (const bank of [B4, B1]) for (const q of Object.values(bank)) {
      if (q.type === 'choice') assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      else for (const a of q.answers) assert.ok(checkSpaceAnswer(q, a), `${q.id}: ${a}`);
    }
    assert.ok(checkSpaceAnswer(B4.c6_shield_half, String(160 / 16)));
    assert.ok(!checkSpaceAnswer(B4.c6_shield_half, '0'));
    assert.ok(checkSpaceAnswer(B4.c6_oxygen_day, String(S.oxygenNeed() * 7)));
    assert.ok(checkSpaceAnswer(B4.c6_water_percent, String(S.tankDays())));
    assert.ok(checkSpaceAnswer(B4.c6_farm_area, String(S.foodNeed() / S.FOOD.perSquareMetre)));
    assert.ok(checkSpaceAnswer(B4.c6_grid_fraction, '1/3'));
    assert.ok(checkSpaceAnswer(B4.c6_pack_mass, String(+(S.PACK_LIMIT - S.packNeededMass()).toFixed(1))));
    for (const beat of Object.values(QB.STATION_BEAT)) assert.ok(Object.values(B4).some((q) => q.beat === beat), beat);
  });
  ok('the whole chain: unique c6_ ids, an enter each, and every beat has a question', () => {
    const ids = steps.map((st) => st.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const st of steps) {
      assert.ok(st.id.startsWith('c6_'), st.id);
      assert.equal(typeof st.enter, 'function', st.id);
      assert.ok(typeof st.title === 'string' && st.title, st.id);
      if (st.beat) assert.ok(Object.values(L4).some((q) => q.beat === st.beat), `${st.id}: no question for ${st.beat}`);
    }
    // every question is asked somewhere: a step's beat, or after a station
    const stationBeats = new Set(Object.values(QB.STATION_BEAT));
    for (const q of Object.values(L4)) assert.ok(steps.some((st) => st.beat === q.beat) || stationBeats.has(q.beat), `${q.id} never asked`);
    assert.deepEqual(steps.slice(0, 4).map((st) => st.id), ['c6_belt_home', 'c6_design_ship', 'c6_rock_hunt', 'c6_engine']);
    assert.ok(ids.indexOf('c6_meet_crew') > ids.indexOf('c6_engine'));
    assert.ok(ids.indexOf('c6_lesson_slingshot') < ids.indexOf('c6_plan_route'), 'the energy lesson before the planner');
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
    ok(`${L.id}: ${L.films.length} films, both Levels, one right answer of three, a short Level 1 clue, under 45 s each`, () => {
      pair(L.eyebrow, 'eyebrow');
      assert.ok(L.films.length >= 3);
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
