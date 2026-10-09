// Chapter 5's mini-games: rules checks (no drawing).
//
//   node scripts/test-ch5-games.mjs
//
// The ring run (src/space/ch5/ringRunLogic.js): a steady player meets every
// level's goal and stops there, sitting still gets hit, a clumsy player (fire
// only) passes Easy but not Medium or Hard, a steering bot takes 15 to 40 s,
// big rocks take 2 / 3 / 5 shots and need a true aim, a bump jams the gun,
// shots kick her back (but never out of the picture), and a level plays the
// same each go. Shots and burst parts (ringRun.js createFx) are pooled: no material
// or geometry per shot, and every look stays under the bloom threshold.
// Space pool (poolLogic.js): every level can be won with good shots, bumps
// keep the total momentum, and a bad shot doesn't win.
// Part D (designBoard.js, rockHunt.js, workshop.js): each design question has
// one right answer, the fuel sum works, and exactly one rock passes the list.
import assert from 'node:assert/strict';
import { createRun, stepRun, botInput, result, skipRun, LEVELS, waterFor, BIG_R, BIG_ROCK, MAX_KICK, SHIP_R } from '../src/space/ch5/ringRunLogic.js';
import { DESIGN_STEPS } from '../src/space/ch5/designBoard.js';
import { CHECKS, ROCKS, failures } from '../src/space/ch5/rockHunt.js';
import { STATIONS } from '../src/space/ch5/workshop.js';
import { POOL_LEVELS, createPool, shoot, stepPool, runShot, bestShot, momentum } from '../src/space/ch5/poolLogic.js';
import { createFx, BOLT_GAIN, PART_COLOURS } from '../src/space/ch5/ringRun.js';
import { RENDER } from '../src/space/contracts.js';
import * as THREE from 'three';

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
    ok(`${level} (seed ${seed}): a steady player meets the goal and stops there, with few bumps; sitting still gets hit`, () => {
      const bot = play(level, botInput, seed).res;
      const still = play(level, idle, seed).res;
      // The run ends as soon as both goals are met (before the clock runs out).
      assert.ok(bot.met && bot.seconds < LEVELS[level].time, `met at ${bot.seconds} s`);
      assert.ok(bot.ice >= bot.goal.ice && bot.rock >= bot.goal.rock, `got ${bot.ice}/${bot.rock}`);
      assert.ok(bot.water > 0 && bot.bumps <= 3, `water ${bot.water} bumps ${bot.bumps}`);
      assert.ok(!still.met && still.seconds === LEVELS[level].time);
      assert.ok(still.bumps >= 8, `idle bumps ${still.bumps}`);
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
ok('a clumsy player (fire only, no steering) passes Easy but not Medium or Hard', () => {
  const fireOnly = () => ({ turn: 0, thrust: 0, fire: true });
  const met = (level) => [...Array(40).keys()].filter((i) => play(level, fireOnly, (i + 1) * 104729).res.met).length;
  const [e, m, h] = [met('easy'), met('medium'), met('hard')];
  assert.ok(e >= 24, `easy ${e}/40`); // a six-year-old can still win
  assert.ok(m <= 14, `medium ${m}/40`);
  assert.ok(h <= 4, `hard ${h}/40`);
});
ok('a steering bot meets every goal in 15 to 40 s (median), on every level', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const secs = [];
    for (let i = 0; i < 40; i++) { const r = play(level, botInput, (i + 1) * 7919).res; if (r.met) secs.push(r.seconds); }
    secs.sort((a, b) => a - b);
    assert.ok(secs.length >= 36, `${level} met ${secs.length}/40`);
    const median = secs[secs.length >> 1];
    assert.ok(median >= 15 && median <= 40, `${level} median ${median} s`);
  }
});
ok('a big rock needs a true aim (Hard, no aim help): a sloppy shot passes by, a straight one breaks a crack', () => {
  const shoot = (offset) => {
    const run = createRun('hard', 1);
    run.spawnClock = 1e9; run.ice.length = 0;
    run.ice.push({ id: 1, x: offset, y: 0, z: -200, r: BIG_R, big: true, rock: true, hp: LEVELS.hard.bigHits, spin: 0, spinRate: 0, shape: 1 });
    stepRun(run, 1 / 60, { turn: 0, thrust: 0, fire: true });
    for (let i = 0; i < 240; i++) stepRun(run, 1 / 60, idle());
    return run;
  };
  assert.equal(shoot(BIG_R * 0.95).cracks, 0, 'sloppy shot hit');
  assert.equal(shoot(0.5).cracks, 1, 'straight shot missed');
});
ok('a bump jams the gun for a moment', () => {
  const run = createRun('easy', 1);
  run.spawnClock = 1e9; run.ice.length = 0;
  run.ice.push({ id: 1, x: 0, y: 0, z: 0, r: 1, big: false, rock: false, hp: 1, spin: 0, spinRate: 0, shape: 1 });
  stepRun(run, 1 / 60, idle());
  assert.equal(run.bumps, 1);
  const fire = { turn: 0, thrust: 0, fire: true };
  const jam = LEVELS.easy.stun;
  assert.ok(jam >= 0.5, `jam ${jam} s too short to notice`);
  for (let i = 0; i < Math.round(jam * 0.5 * 60); i++) stepRun(run, 1 / 60, fire); // half way through: still jammed
  assert.equal(run.shots, 0, 'fired while jammed');
  assert.ok(run.ship.stun > 0, 'the jam is visible to the panel');
  for (let i = 0; i < Math.round(jam * 0.6 * 60); i++) stepRun(run, 1 / 60, fire); // past the jam
  assert.ok(run.shots >= 1, 'gun never came back');
});
ok('the grown-up skip ends the run with the goal met', () => {
  const run = createRun('hard', 1);
  skipRun(run);
  assert.ok(run.over && result(run).met);
  assert.equal(stepRun(run, 1 / 60, idle()).length, 0);
});

// The shots and burst parts (ringRun.js createFx) don't flicker: they are pooled, so a
// shot or a hit makes no material or geometry (a new material compiles its shader the
// first time it draws, and disposing the last one of a program frees it: the next hit
// compiled it again). Their looks stay under the bloom threshold: a bright shot blooms
// across the whole screen.
// Rec. 709 luma of a linear colour: the weights the bloom pass tests against its threshold.
const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
ok('a loop of shots and hits creates no material or geometry, and disposes none', () => {
  const scene = new THREE.Scene();
  const fx = createFx(scene);
  const looks = [];
  scene.traverse((o) => { if (o.material) looks.push(o.material); if (o.geometry) looks.push(o.geometry); });
  const disposed = [];
  for (const x of looks) x.addEventListener('dispose', () => disposed.push(x));
  // Ids are counted for every material and geometry three.js makes: a probe made before and
  // after the loop shows how many were made in between.
  const matsBefore = new THREE.MeshBasicMaterial().id;
  const geosBefore = new THREE.BufferGeometry().id;
  const colours = [PART_COLOURS.ice, PART_COLOURS.rock, PART_COLOURS.crack, PART_COLOURS.bump, PART_COLOURS.goal];
  for (let shot = 0; shot < 300; shot++) {
    // A shot: up to six bolts in flight, a blast of ice or rock, and the odd crack.
    const bolts = Array.from({ length: 1 + (shot % 6) }, (_, i) => ({ x: i, y: 0, z: -shot * 0.3 - i * 3, life: 1 }));
    fx.setBolts(bolts);
    fx.burst(0, 0, -20, shot % 3 === 0 ? 16 : 10, colours[shot % colours.length]);
    if (shot % 4 === 0) fx.burst(1, 1, -12, 5, PART_COLOURS.crack);
    for (let f = 0; f < 5; f++) fx.step(1 / 60, 38);
  }
  assert.equal(new THREE.MeshBasicMaterial().id - matsBefore - 1, 0, 'a material was made during the shots');
  assert.equal(new THREE.BufferGeometry().id - geosBefore - 1, 0, 'a geometry was made during the shots');
  assert.deepEqual(disposed, [], 'a material or geometry was disposed during the shots');
  // The scene holds one group (the run's two meshes) and two looks.
  assert.equal(scene.children.length, 1);
  const materials = new Set(); const geometries = new Set();
  scene.traverse((o) => { if (o.material) materials.add(o.material); if (o.geometry) geometries.add(o.geometry); });
  assert.equal(materials.size, 2, `materials in the scene: ${materials.size}`);
  assert.equal(geometries.size, 2, `geometries in the scene: ${geometries.size}`);
});
ok('the shot shaders compile before the first shot, for the run\'s lights and nothing else', () => {
  const scene = new THREE.Scene();
  const fx = createFx(scene);
  const calls = [];
  const camera = new THREE.PerspectiveCamera();
  fx.warm({ compile: (obj, cam, target) => calls.push({ obj, cam, target }) }, camera);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cam, camera);
  assert.equal(calls[0].target, scene, 'lights come from the run\'s scene');
  const meshes = []; calls[0].obj.traverse((o) => { if (o.isInstancedMesh) meshes.push(o); });
  assert.equal(meshes.length, 2, 'only the shot and part meshes are compiled');
  fx.warm(undefined, camera); // no renderer (tests, lab): nothing to compile
});
ok('a part lives its life and then is gone; a burst only takes free parts', () => {
  const scene = new THREE.Scene();
  const fx = createFx(scene);
  fx.burst(0, 0, -20, 16, PART_COLOURS.ice);
  assert.equal(fx.alive(), 16);
  for (let i = 0; i < 40; i++) fx.step(1 / 60, 38); // 0.67 s: still going
  assert.equal(fx.alive(), 16);
  for (let i = 0; i < 30; i++) fx.step(1 / 60, 38); // past 0.9 s
  assert.equal(fx.alive(), 0);
  // A flood of hits fills the pool and then stops, without growing it.
  for (let i = 0; i < 40; i++) fx.burst(0, 0, -20, 16, PART_COLOURS.rock);
  assert.ok(fx.alive() <= 256 && fx.alive() > 200, `alive ${fx.alive()}`);
  fx.dispose();
  assert.equal(scene.children.length, 0);
});
ok('the shot is bright but under the bloom threshold (a shot blooming the whole screen was the flicker)', () => {
  const bolt = new THREE.Color(0x7ff3ff).multiplyScalar(BOLT_GAIN);
  assert.ok(luma(bolt) < RENDER.bloom.threshold, `bolt luma ${luma(bolt).toFixed(3)}`);
  assert.ok(luma(bolt) > 0.8, `bolt too dim to see: ${luma(bolt).toFixed(3)}`);
});
ok('every burst colour stays under the bloom threshold', () => {
  for (const [name, hex] of Object.entries(PART_COLOURS)) {
    const l = luma(new THREE.Color(hex));
    assert.ok(l < RENDER.bloom.threshold, `${name} luma ${l.toFixed(3)}`);
  }
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
