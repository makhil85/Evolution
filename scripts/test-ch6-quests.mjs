// Chapter 6, life on board: the four quests (src/space/ch6/questsLogic.js),
// their question bank (questions.partQuests.js), their deck spots (decks.js)
// and the chain (steps.js). No drawing.
//
//   node scripts/test-ch6-quests.mjs
//
// Every number a question uses is re-derived here from the quest rules. Each
// puzzle is solvable, and its wrong states are rejected (the valves are checked
// against an independent search over all 1024 settings). Both Levels' banks are
// well formed, every quest has its question, every quest is on the deck the
// quest list names, and the step sits right after Part B.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const Q = await import('../src/space/ch6/questsLogic.js');
const S = await import('../src/space/ch6/stationsLogic.js');

console.log('medical bay');
ok('four quests in order, each with a lead, two-level titles and a deck', () => {
  assert.deepEqual(Q.QUESTS.map((q) => q.id), ['medbay', 'coolant', 'message', 'pollen']);
  for (const q of Q.QUESTS) { assert.ok(q.lead, q.id); assert.equal(q.title.length, 2, q.id); assert.ok(q.deck, q.id); }
  assert.equal(new Set(Q.QUESTS.map((q) => q.lead)).size, Q.QUESTS.length, 'one crewmate each');
});
ok('halving: each metre of shield halves a dose (64 outside, 3 metres: 8); the four badges all stay under the day limit', () => {
  assert.equal(Q.doseThrough(64, 3), 8);
  assert.equal(Q.doseThrough(64, 0), 64);
  for (const b of Q.BADGES) {
    assert.equal(Q.badgeDose(b), 64 / 2 ** b.metres, b.name);
    assert.ok(Q.badgeDose(b) <= Q.DAY_LIMIT, b.name);
  }
  assert.deepEqual(Q.BADGES.map((b) => Q.badgeDose(b)), [8, 8, 16, 4]);
});
ok('bones: five of us at 30 minutes a day is 150; the walk gives 90, so the bike gives 60', () => {
  assert.equal(Q.exerciseGoal(), 30 * S.CREW_SIZE);
  assert.equal(Q.exerciseGoal(), 150);
  assert.equal(Q.exerciseGoal() - Q.BONES.walk, 60);
  assert.equal(Q.medbayAnswer().bike, 60);
  assert.equal(Q.BONES.bikeMax % Q.BONES.bikeStep, 0);
});
ok('solvable: every badge scanned and the bike at 60 passes; missing badges and too little bike fail', () => {
  assert.ok(Q.medbayTotals(Q.medbayAnswer()).ok);
  const ids = Q.BADGES.map((b) => b.id);
  assert.ok(!Q.medbayTotals({ scanned: ids.slice(1), bike: 60 }).ok, 'one badge missing');
  assert.ok(!Q.medbayTotals({ scanned: [], bike: 120 }).ok, 'no badges scanned');
  for (let bike = 0; bike <= Q.BONES.bikeMax; bike += Q.BONES.bikeStep) {
    assert.equal(Q.medbayTotals({ scanned: ids, bike }).ok, bike >= 60, `bike ${bike}`);
  }
  assert.ok(Q.medbayTotals({ scanned: ids, bike: 55 }).short, '55 is 5 minutes short');
});

console.log('coolant');
ok('the pipes start leaking: the straight run goes through the crack', () => {
  assert.equal(Q.coolantProblem(Q.COOLANT.open), 'leak');
  assert.ok(Q.coolantFlow(Q.COOLANT.open).reach.has(Q.COOLANT.crack.join(',')));
});
ok('the answer routes round the crack: no leak, and the core is reached', () => {
  assert.equal(Q.coolantProblem(Q.COOLANT_ANSWER), null);
  assert.ok(Q.coolantFlow(Q.COOLANT_ANSWER).core);
  assert.ok(!Q.COOLANT_ANSWER.includes('1,1'), 'the crack is shut');
});
ok('all 1024 valve settings: the search agrees with the game (leak, short, or fixed)', () => {
  const valves = [];
  for (let r = 0; r < Q.COOLANT.rows; r++) for (let c = 0; c < Q.COOLANT.cols; c++) {
    const k = `${c},${r}`;
    if (k !== `${Q.COOLANT.tank.join(',')}` && k !== `${Q.COOLANT.core.join(',')}`) valves.push(k);
  }
  assert.equal(valves.length, 10);
  // An independent search: from the tank, through open valves, to the core. Does the coolant reach the crack?
  const search = (open) => {
    const isOpen = (c, r) => open.includes(`${c},${r}`) || (c === 3 && r === 1);
    const seen = new Set(['0,1']); const q = [[0, 1]];
    while (q.length) {
      const [c, r] = q.shift();
      if (c === 3 && r === 1) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc; const nr = r + dr;
        if (nc < 0 || nc > 3 || nr < 0 || nr > 2) continue;
        const k = `${nc},${nr}`;
        if (seen.has(k) || !isOpen(nc, nr)) continue;
        seen.add(k); q.push([nc, nr]);
      }
    }
    return { leak: seen.has('1,1'), core: seen.has('3,1') };
  };
  let fixed = 0; let leaks = 0; let short = 0;
  for (let mask = 0; mask < 1 << valves.length; mask++) {
    const open = valves.filter((_, i) => mask & (1 << i));
    const want = search(open);
    const got = Q.coolantProblem(open);
    const expect = want.leak ? 'leak' : !want.core ? 'short' : null;
    assert.equal(got, expect, open.join(' '));
    if (got === null) fixed += 1; else if (got === 'leak') leaks += 1; else short += 1;
  }
  assert.ok(fixed > 0 && leaks > 0 && short > 0, `fixed ${fixed}, leak ${leaks}, short ${short}`);
});
ok('the sum: 400 litres at 25 litres a minute empties in 16 minutes', () => {
  assert.equal(Q.coolantMinutes(), 16);
  assert.equal(Q.COOLANT.tankLitres / Q.COOLANT.leakPerMin, 400 / 25);
  assert.equal(25 * 16, 400);
});

console.log('message');
ok('the dish turns in tens: 13 steps right from straight up is Earth (130 degrees); the buttons reach every setting', () => {
  let d = 0; for (let i = 0; i < 13; i++) d = Q.dishTurn(d, 1);
  assert.equal(d, Q.DISH.earth);
  assert.ok(Q.dishOnEarth(d));
  assert.equal(Q.dishTurn(0, -1), 350); assert.equal(Q.dishTurn(350, 1), 0);
  const seen = new Set([0]); let frontier = [0];
  while (frontier.length) {
    const next = [];
    for (const a of frontier) for (const dir of [-1, 1]) { const b = Q.dishTurn(a, dir); if (!seen.has(b)) { seen.add(b); next.push(b); } }
    frontier = next;
  }
  assert.equal(seen.size, 360 / Q.DISH.step);
});
ok('locked on Earth within 5 degrees either side: 125 is in, 124 and 136 are out', () => {
  assert.ok(Q.dishOnEarth(125)); assert.ok(Q.dishOnEarth(135));
  assert.ok(!Q.dishOnEarth(124)); assert.ok(!Q.dishOnEarth(136));
  assert.ok(!Q.dishOnEarth(120)); assert.ok(!Q.dishOnEarth(0));
});
ok('the light: 400 million km (the asteroid belt to Earth) at 55 minutes a billion is 22 minutes, a whole number', () => {
  assert.equal(Q.lightMinutes(400), 22);
  assert.equal(Q.lightMinutes(400), (400 * 55) / 1000);
  assert.equal(Q.lightMinutes(1000), 55);
  assert.equal(Q.lightMinutes(100), 5.5);
  assert.ok(Number.isInteger(Q.lightMinutes(Q.LIGHT.earthMillionKm)));
  assert.ok(Q.LIGHT.earthMillionKm < 1000, 'Earth is closer than a billion km: the ship is in the belt');
});

console.log('pollen');
ok('the answer order: each pollen flower, then its partner; three strawberries', () => {
  const r = Q.runPollen(Q.pollenAnswer());
  assert.equal(r.problem, null);
  assert.equal(r.state.fruit.length, Q.PAIRS);
  assert.ok(Q.pollinated(r.state));
});
ok('the partner comes after its pollen: a bud first is rejected, and so is a bud with another pair\'s pollen', () => {
  assert.equal(Q.runPollen(['d']).problem, 'order');
  assert.equal(Q.runPollen(['d']).state.fruit.length, 0);
  assert.equal(Q.runPollen(['a', 'b']).problem, 'partner');
  assert.equal(Q.runPollen(['a', 'b']).state.fruit.length, 0);
  assert.equal(Q.runPollen(['a', 'b']).state.holding, 'a', 'still holding its own pollen');
  assert.equal(Q.runPollen(['a', 'd']).state.fruit.length, 1);
});
ok('every order of the six taps: a bud only ever gets a strawberry after its own pollen was tapped', () => {
  const ids = Q.FLOWERS.map((f) => f.id);
  const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  let solved = 0;
  for (const p of perms(ids)) {
    const r = Q.runPollen(p);
    if (Q.pollinated(r.state)) solved += 1;
    for (const bud of r.state.fruit) {
      const pair = Q.FLOWERS.find((f) => f.id === bud).pair;
      const dust = Q.FLOWERS.find((f) => f.pair === pair && f.role === 'dust').id;
      assert.ok(p.indexOf(dust) < p.indexOf(bud), `${p.join('')}: ${bud} before its pollen`);
    }
  }
  assert.ok(solved > 0 && solved < perms(ids).length, 'some orders solve it, not every one');
});
ok('the farm: 60 plants of 12 berries a week is 720, shared by five is 144 each', () => {
  assert.equal(Q.berriesTotal(), 720);
  assert.equal(Q.berriesEach(), 144);
  assert.equal(Q.berriesEach(), (60 * 12) / S.CREW_SIZE);
});

console.log('questions');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { checkSpaceAnswer } = await vite.ssrLoadModule('/src/space/questions.space.js');
  const P = await vite.ssrLoadModule('/src/space/ch6/questions.partQuests.js');
  const { DECKS, deckOf } = await vite.ssrLoadModule('/src/space/ch6/interior/decks.js');

  for (const [lv, bank] of [[4, P.partQuestsBank(4)], [1, P.partQuestsBank(1)]]) {
    ok(`Level ${lv}: four questions, well formed, one beat each, every answer accepted`, () => {
      assert.equal(Object.keys(bank).length, Q.QUESTS.length);
      const beats = new Set();
      for (const [id, q] of Object.entries(bank)) {
        assert.equal(q.id, id); assert.ok(id.startsWith('c6_'), id);
        for (const f of ['type', 'title', 'prompt', 'hint', 'parentHint', 'success', 'doneMessage', 'beat', 'difficulty']) assert.ok(typeof q[f] === 'string' && q[f], `${id}.${f}`);
        assert.equal(q.type, 'text', id);
        assert.ok(Array.isArray(q.answers) && q.answers.length > 0, id);
        assert.ok(!beats.has(q.beat), `${id}: beat used twice`); beats.add(q.beat);
        for (const a of q.answers) assert.ok(checkSpaceAnswer(q, a), `${id}: "${a}"`);
        assert.ok(!checkSpaceAnswer(q, 'no such answer 999'), `${id}: a wrong answer accepted`);
      }
    });
  }
  const L4 = P.partQuestsBank(4);
  const L1 = P.partQuestsBank(1);
  ok('Level 4 numbers re-derived from the quest rules, and the tempting wrong answers rejected', () => {
    // 64 -> 32 (still over the limit of 20) -> 16 (under): two metres of rock
    assert.ok(Q.doseThrough(Q.OUTSIDE_DOSE, 1) > Q.DAY_LIMIT && Q.doseThrough(Q.OUTSIDE_DOSE, 2) <= Q.DAY_LIMIT);
    assert.ok(checkSpaceAnswer(L4.c6_dose_half, '2'));
    assert.ok(!checkSpaceAnswer(L4.c6_dose_half, '1'), 'one metre is still over the limit');
    assert.ok(!checkSpaceAnswer(L4.c6_dose_half, '3'), 'three metres: more than needed');
    assert.ok(checkSpaceAnswer(L4.c6_leak_minutes, String(Q.COOLANT.tankLitres / Q.COOLANT.leakPerMin)));
    assert.ok(!checkSpaceAnswer(L4.c6_leak_minutes, String(Q.COOLANT.tankLitres * Q.COOLANT.leakPerMin)), 'multiplied, not divided');
    assert.ok(checkSpaceAnswer(L4.c6_light_delay, String((400 * 55) / 1000)));
    assert.ok(checkSpaceAnswer(L4.c6_light_delay, '22 min'));
    assert.ok(!checkSpaceAnswer(L4.c6_light_delay, String(400 * 55)), 'forgot to divide by a billion');
    assert.ok(!checkSpaceAnswer(L4.c6_light_delay, String(6 * 55)), 'six billion km, not Earth');
    assert.ok(checkSpaceAnswer(L4.c6_berries_each, String((60 * 12) / 5)));
    assert.ok(!checkSpaceAnswer(L4.c6_berries_each, String(60 * 12)), 'the whole farm, not each');
  });
  ok('Level 1 numbers: small take-aways and adding (pretend numbers), no halving or times', () => {
    assert.ok(checkSpaceAnswer(L1.c6_dose_half, String(8 - 3)));
    assert.ok(!checkSpaceAnswer(L1.c6_dose_half, '3'), 'the rock stops 3: not the answer');
    assert.ok(checkSpaceAnswer(L1.c6_leak_minutes, String(10 - 3)));
    assert.ok(checkSpaceAnswer(L1.c6_light_delay, String(5 + 6)));
    assert.ok(checkSpaceAnswer(L1.c6_berries_each, String(4 + 5)));
  });
  ok('each quest has its question (its beat), each beat once', () => {
    for (const q of Q.QUESTS) {
      const beat = P.QUEST_BEAT[q.id];
      assert.ok(beat, q.id);
      assert.equal(Object.values(L4).filter((x) => x.beat === beat).length, 1, q.id);
    }
    assert.equal(new Set(Object.values(P.QUEST_BEAT)).size, Q.QUESTS.length);
  });
  ok('questions.space.js builds the Chapter 6 bank with these questions', () => {
    const src = readFileSync(new URL('../src/space/questions.space.js', import.meta.url), 'utf8');
    assert.ok(/partQuestsBank\(difficultyLevel\(\)\)/.test(src), 'partQuestsBank is in selectBank');
  });

  console.log('decks and steps');
  ok('every quest is on the one deck the quest list names, and every deck quest is a quest', () => {
    for (const q of Q.QUESTS) {
      assert.equal(deckOf(q.id), q.deck, q.id);
      const on = DECKS.filter((d) => d.quests.includes(q.id));
      assert.equal(on.length, 1, q.id);
      assert.equal(on[0].id, q.deck, q.id);
    }
    for (const d of DECKS) for (const id of d.quests) assert.ok(Q.QUESTS.some((q) => q.id === id), id);
  });
  const Ch6 = await vite.ssrLoadModule('/src/space/ch6/steps.js');
  const steps = Ch6.ch6Steps({ hud: {}, bus: null, scene: { add() {}, remove() {} }, ship: { x: 60000, z: 0 } });
  ok('the chain: life on board comes straight after Part B, with an enter, and the walk follows the chain', () => {
    const i = steps.findIndex((s) => s.id === 'c6_life_on_board');
    assert.ok(i > 0, 'in the chain');
    assert.equal(steps[i - 1].id, 'c6_habitat', 'straight after Part B');
    assert.ok(steps[i + 1], 'Part C follows');
    assert.equal(steps[i].act, 2);
    assert.equal(typeof steps[i].enter, 'function');
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length, 'unique ids');
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
