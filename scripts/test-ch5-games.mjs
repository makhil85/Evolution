// Chapter 5's mini-games: rules checks (no drawing).
//
//   node scripts/test-ch5-games.mjs
//
// The ring run (src/space/ch5/ringRunLogic.js): a steady player clears every
// level with few bumps and plenty of water, sitting still gets hit, boulders
// can't be blasted, shots kick her back, and a level plays the same each go.
// Space pool (poolLogic.js): every level can be won with good shots, bumps
// keep the total momentum, and a bad shot doesn't win.
import assert from 'node:assert/strict';
import { createRun, stepRun, botInput, result, LEVELS, waterFor, BIG_R, SHIP_R } from '../src/space/ch5/ringRunLogic.js';
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
ok('boulders bounce shots; small chunks blast into water', () => {
  for (const big of [true, false]) {
    const run = createRun('hard', 1);
    run.spawnClock = 1e9; // no other ice
    const r = big ? BIG_R + 0.5 : 1.2;
    run.ice.push({ id: 99, x: 0, y: 0, z: -60, r, big, spin: 0, spinRate: 0, shape: 1 });
    const ev = [];
    for (let i = 0; i < 40 && !ev.some((e) => e.type === 'blast' || e.type === 'bounce'); i++) {
      ev.push(...stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: i === 0 }));
    }
    if (big) { assert.ok(ev.some((e) => e.type === 'bounce')); assert.equal(run.water, 0); assert.equal(run.ice.length, 1); }
    else { assert.ok(ev.some((e) => e.type === 'blast')); assert.equal(run.water, waterFor(r)); assert.equal(run.ice.length, 0); }
  }
});
ok('a fast shot never skips through a chunk between steps', () => {
  // Coarse steps (a slow frame): the swept test still catches it.
  const run = createRun('hard', 1);
  run.spawnClock = 1e9;
  run.ice.push({ id: 1, x: 0, y: 0, z: -50, r: 0.7, big: false, spin: 0, spinRate: 0, shape: 1 });
  stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: true });
  for (let i = 0; i < 10; i++) stepRun(run, 0.1, idle());
  assert.equal(run.blasted, 1);
});
ok('ice that reaches her is a bump, once', () => {
  const run = createRun('easy', 1);
  run.spawnClock = 1e9;
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

console.log(`\n${passed} passed`);
