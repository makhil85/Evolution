// Chapter 5's mini-games: rules checks (no drawing).
//
//   node scripts/test-ch5-games.mjs
//
// The ring run (src/space/ch5/ringRunLogic.js): a steady player clears every
// level with few bumps and its ice and rock goal met, sitting still gets hit,
// big rocks take 2 / 3 / 5 shots, shots kick her back (but never out of the
// picture), and a level plays the same each go.
// Space pool (poolLogic.js): every level can be won with good shots, bumps
// keep the total momentum, and a bad shot doesn't win.
// Part D (designBoard.js, rockHunt.js, workshop.js): each design question has
// one right answer, the fuel sum works, and exactly one rock passes the list.
import assert from 'node:assert/strict';
import { createRun, stepRun, botInput, result, LEVELS, waterFor, BIG_R, BIG_ROCK, MAX_KICK, SHIP_R } from '../src/space/ch5/ringRunLogic.js';
import { DESIGN_STEPS } from '../src/space/ch5/designBoard.js';
import { CHECKS, ROCKS, failures } from '../src/space/ch5/rockHunt.js';
import { STATIONS } from '../src/space/ch5/workshop.js';
import { POOL_LEVELS, createPool, shoot, stepPool, runShot, bestShot, momentum } from '../src/space/ch5/poolLogic.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const play = (level, player, seed = 7) => {
  const run = createRun(level, seed);
  let guard = 0;
  while (!run.over && guard++ < 1e5) stepRun(run, 1 / 60, player(run));
  return { run, res: result(run) };
};
const idle = () => ({ turn: 0, thrust: 0, fire: false });

console.log('ring run');
ok('three levels, each longer and busier than the last', () => {
  const [e, m, h] = ['easy', 'medium', 'hard'].map((k) => LEVELS[k]);
  assert.ok(e.time < m.time && m.time < h.time);
  assert.ok(e.speed < m.speed && m.speed < h.speed);
  assert.ok(e.spawnEvery > m.spawnEvery && m.spawnEvery > h.spawnEvery);
  assert.ok(e.bigShare < h.bigShare);
});
for (const level of ['easy', 'medium', 'hard']) {
  for (const seed of [1, 7, 42]) {
    ok(`${level} (seed ${seed}): a steady player ends with water and few bumps; sitting still gets hit`, () => {
      const bot = play(level, botInput, seed).res;
      const still = play(level, idle, seed).res;
      assert.equal(bot.seconds, LEVELS[level].time);
      assert.ok(bot.water >= 300, `water ${bot.water}`);
      assert.ok(bot.bumps <= 3, `bumps ${bot.bumps}`);
      // The goal is well inside what a steady player gets (a child gets less).
      assert.ok(bot.met && bot.ice >= bot.goal.ice * 1.5 && bot.rock >= bot.goal.rock * 1.3, `got ${bot.ice}/${bot.rock} of ${bot.goal.ice}/${bot.goal.rock}`);
      assert.ok(!still.met);
      assert.ok(still.bumps >= 15, `idle bumps ${still.bumps}`);
      assert.equal(still.water, 0);
    });
  }
}
ok('the same level and seed plays the same', () => {
  assert.deepEqual(play('medium', botInput, 3).res, play('medium', botInput, 3).res);
});
ok('a shot kicks her back, and she eases forward again', () => {
  const run = createRun('easy', 1);
  stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: true });
  let most = 0;
  for (let i = 0; i < 30; i++) { stepRun(run, 1 / 60, idle()); most = Math.max(most, run.ship.z); }
  assert.ok(most > 0.2, `kicked back ${most}`);
  for (let i = 0; i < 240; i++) stepRun(run, 1 / 60, idle());
  assert.ok(Math.abs(run.ship.z) < 0.02, `settled ${run.ship.z}`);
});
ok('big rocks take 2 / 3 / 5 shots; small rocks and ice break with one', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    for (const kind of ['big', 'rock', 'ice']) {
      const run = createRun(level, 1);
      run.spawnClock = 1e9; run.ice.length = 0; // no other ice
      const big = kind === 'big';
      run.ice.push({ id: 99, x: 0, y: 0, z: -200, r: big ? BIG_R + 0.5 : 1.2, big, rock: kind !== 'ice', hp: big ? LEVELS[level].bigHits : 1, spin: 0, spinRate: 0, shape: 1 });
      let shots = 0;
      for (let i = 0; i < 400 && run.ice.length; i++) {
        const fire = run.ship.cool === 0 && run.bolts.length === 0;
        if (fire) shots++;
        stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire });
      }
      assert.equal(run.ice.length, 0, `${level} ${kind} not broken`);
      assert.equal(shots, big ? LEVELS[level].bigHits : 1, `${level} ${kind} shots`);
      if (kind === 'ice') { assert.equal(run.got.ice, 1); assert.equal(run.got.rock, 0); }
      else assert.equal(run.got.rock, big ? BIG_ROCK : 1);
    }
  }
  assert.deepEqual(['easy', 'medium', 'hard'].map((k) => LEVELS[k].bigHits), [2, 3, 5]);
});
ok('holding fire never pushes her out of the picture', () => {
  const run = createRun('hard', 1);
  run.spawnClock = 1e9; run.ice.length = 0;
  let most = 0;
  for (let i = 0; i < 600; i++) { stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: true }); most = Math.max(most, run.ship.z); }
  assert.ok(most <= MAX_KICK + 1e-9, `drifted back ${most}`);
});
ok('each level asks for more ice and rock than the one before', () => {
  const [e, m, h] = ['easy', 'medium', 'hard'].map((k) => LEVELS[k].goal);
  assert.ok(e.ice < m.ice && m.ice < h.ice && e.rock < m.rock && m.rock < h.rock);
});
ok('a fast shot never skips through a chunk between steps', () => {
  // Coarse steps (a slow frame): the swept test still catches it.
  const run = createRun('hard', 1);
  run.spawnClock = 1e9; run.ice.length = 0;
  run.ice.push({ id: 1, x: 0, y: 0, z: -50, r: 0.7, big: false, spin: 0, spinRate: 0, shape: 1 });
  stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: true });
  for (let i = 0; i < 10; i++) stepRun(run, 0.1, idle());
  assert.equal(run.blasted, 1);
});
ok('ice that reaches her is a bump, once', () => {
  const run = createRun('easy', 1);
  run.spawnClock = 1e9; run.ice.length = 0;
  run.ice.push({ id: 1, x: 0, y: 0, z: -20, r: 1, big: false, spin: 0, spinRate: 0, shape: 1 });
  for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, idle());
  assert.equal(run.bumps, 1);
  assert.ok(SHIP_R > 1);
});
ok('steering stays inside the run', () => {
  const run = createRun('easy', 1);
  for (let i = 0; i < 600; i++) stepRun(run, 1 / 60, { turn: 1, thrust: 1, fire: false });
  assert.ok(run.ship.x <= 12 && run.ship.y <= 6);
});

console.log('space pool');
POOL_LEVELS.forEach((L, i) => {
  ok(`${L.id}: good shots net the gold rock within the shots allowed`, () => {
    const pool = createPool(i);
    let n = 0;
    while (!pool.won && !pool.lostAll && n < L.shots) { const b = bestShot(pool); assert.ok(shoot(pool, b.rockId, b.angle, b.power)); runShot(pool); n++; }
    assert.ok(pool.won, `not won in ${n}`);
  });
});
ok('every bump keeps the total momentum', () => {
  for (let i = 0; i < POOL_LEVELS.length; i++) {
    const pool = createPool(i);
    const b = bestShot(pool);
    shoot(pool, b.rockId, b.angle, b.power);
    const p0 = momentum(pool);
    for (let k = 0; k < 4000 && pool.moving; k++) {
      const ev = stepPool(pool, 1 / 120);
      if (ev.some((e) => e.type === 'net' || e.type === 'lost' || e.type === 'still')) break;
      const p = momentum(pool);
      assert.ok(Math.hypot(p.x - p0.x, p.y - p0.y) < 1e-6 * Math.hypot(p0.x, p0.y) + 1e-9, `level ${i}: momentum changed`);
    }
  }
});
ok('same mass, head on: the cue rock stops and the gold rock takes its speed', () => {
  const pool = createPool(0);
  shoot(pool, 'cue', 0, 0.5);
  for (let k = 0; k < 4000 && pool.moving; k++) { if (stepPool(pool, 1 / 120).some((e) => e.type === 'bump')) break; }
  const cue = pool.rocks.find((r) => r.id === 'cue'); const gold = pool.rocks.find((r) => r.id === 'gold');
  assert.ok(Math.abs(cue.vx) < 1, `cue ${cue.vx}`);
  assert.ok(Math.abs(gold.vx - 130) < 1, `gold ${gold.vx}`);
});
ok('a miss loses the level: out of shots, or the cue rock drifts away', () => {
  let pool = createPool(0);
  for (let k = 0; k < 3; k++) { shoot(pool, 'cue', Math.PI / 2, 0.02); runShot(pool); }
  assert.ok(!pool.won && pool.lostAll && pool.shotsLeft === 0);
  assert.equal(shoot(pool, 'cue', 0, 1), false);
  pool = createPool(0);
  shoot(pool, 'cue', Math.PI, 0.5); runShot(pool);
  assert.ok(!pool.won && pool.lostAll, 'cue lost');
});
ok('a gold rock can only be flicked if it is a cue rock', () => {
  assert.equal(shoot(createPool(0), 'gold', 0, 1), false);
});

ok('design: every choice question has exactly one right answer', () => {
  for (const q of DESIGN_STEPS) {
    if (q.type === 'text') continue;
    assert.equal(q.choices.filter((c) => c.correct).length, 1, q.prompt[0]);
    for (const c of q.choices) assert.ok(Array.isArray(c.text) && c.text.length === 2);
  }
});
ok('design: the fuel sum is the planner\'s (1,000 t of ship at 1 t per 100 t = 10 t, as routes.js: 10 t gives 3 km/s)', () => {
  const q = DESIGN_STEPS.find((x) => x.type === 'text');
  assert.equal(String(1000 / 100), q.answers[0]);
  assert.ok(q.why[0].includes('10') && q.why[0].includes('1,000'));
  // The planner's ship: 1,000 t dry, 10 t of fuel gives about 3 km/s (300 km/s exhaust).
  const dv = 300 * Math.log((1000 + 10) / 1000);
  assert.equal(Math.round(dv), 3);
});
ok('rock hunt: only Rock B passes; every wrong rock fails at least one check', () => {
  for (const c of CHECKS) assert.ok(c.no?.length === 2 && c.text.length === 2, c.id);
  const pass = ROCKS.filter((r) => !failures(r).length);
  assert.deepEqual(pass.map((r) => r.id), ['B']);
  for (const r of ROCKS) if (r.id !== 'B') assert.ok(failures(r).length >= 1, r.id);
  // Each check is the reason some wrong rock fails, so every line matters.
  const used = new Set(ROCKS.flatMap((r) => failures(r).map((c) => c.id)));
  assert.deepEqual([...used].sort(), CHECKS.map((c) => c.id).sort());
  // About 140 m wide, about 3 million tonnes solid (icy rock, ~1.7 t per cubic metre, a little long).
  const rb = ROCKS.find((r) => r.id === 'B');
  const tonnes = (4 / 3) * Math.PI * (rb.width / 2) ** 3 * 1.25 * 1.7;
  assert.ok(tonnes > 2.5e6 && tonnes < 3.5e6, `${tonnes}`);
});
ok('workshop: five stations in order, ending in the test fire', () => {
  assert.deepEqual(STATIONS.map((s) => s.id), ['mine', 'fuel', 'parts', 'fit', 'fire']);
});

console.log(`\n${passed} passed`);
