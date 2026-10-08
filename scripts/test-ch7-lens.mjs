// Chapter 7, Part D: the lens maths, the "Where is it really?" bot sweep, the
// Part D questions at both Levels, lesson 7D's shape, and the holodeck quasar's
// budget and phases (CHAPTER7_PLAN.md section 4).
//
//   node scripts/test-ch7-lens.mjs
//
// The bot sweep: a rule player (reads the bright image, uses beta = theta - 1/theta)
// must win at least 90% of games in every mode; a naive player (taps where the star
// looks) and a random tapper must win at most 10% on Hard.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
let failed = 0;
const pending = [];
// A test may be async (the holodeck's phases): its result is reported when it settles.
function ok(name, fn) {
  const report = () => { passed++; console.log(`  ok  ${name}`); };
  const fail = (e) => { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pending.push(r.then(report, fail));
    else report();
  } catch (e) { fail(e); }
}

// A small seeded random sequence, so the sweep gives the same table every run.
const seeded = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const L = await vite.ssrLoadModule('/src/space/ch7/lensLogic.js');
  const { ch7Bank } = await vite.ssrLoadModule('/src/space/ch7/questions.ch7.js');
  const { CH7D_QUESTIONS, CH7D_LEVEL1 } = await vite.ssrLoadModule('/src/space/ch7/questions.partD.js');
  const { LESSON_7D } = await vite.ssrLoadModule('/src/lesson/lessons/ch7d.js');
  const { buildHolodeckScene } = await vite.ssrLoadModule('/src/space/ch7/holodeck.js');
  const { partDSteps } = await vite.ssrLoadModule('/src/space/ch7/partD.js');
  const { playLens } = await vite.ssrLoadModule('/src/space/ch7/lensGame.js');

  console.log('lens maths');
  const betas = Array.from({ length: 50 }, (_, i) => 0.05 + i * 0.1);
  ok('the bright image is farther out than the true place, on the same side: theta > beta > 0', () => {
    for (const b of betas) {
      const th = L.mainImage(b);
      assert.ok(th > b, `beta ${b}: theta ${th}`);
      assert.ok(b > 0 && th > 0);
    }
  });
  ok('a source right behind the hole (beta = 0) makes the Einstein ring: theta = 1', () => {
    near(L.mainImage(0), 1, 1e-12, 'theta(0)');
    near(L.minorImage(0), -1, 1e-12, 'minor(0)');
  });
  ok('the faint image is on the other side, nearer the hole: -1 < theta- < 0 for beta > 0', () => {
    for (const b of betas) {
      const m = L.minorImage(b);
      assert.ok(m < 0 && m > -1, `beta ${b}: minor ${m}`);
    }
  });
  ok('the true place inverts the bright image: beta = theta - 1/theta round-trips both ways', () => {
    for (const b of betas) near(L.trueFromSeen(L.mainImage(b)), b, 1e-9, `beta ${b}`);
    for (const th of betas) near(L.mainImage(L.trueFromSeen(th)), th, 1e-9, `theta ${th}`);
  });
  ok('the bright image is the brighter one (mu+ > 1), the faint one fades far out, and mu+ - |mu-| = 1', () => {
    for (const b of betas) {
      const m = L.magnification(b);
      assert.ok(m.main > 1, `beta ${b}: main ${m.main}`);
      near(m.main - m.minor, 1, 1e-9, `beta ${b}`);
    }
    assert.ok(L.magnification(5).minor < 0.05, 'the faint image is faint far out');
  });
  ok('the bend is a small push far from the hole and a big one near it (theta - beta falls as beta grows)', () => {
    let prev = Infinity;
    for (const b of betas) {
      const g = L.mainImage(b) - b;
      assert.ok(g < prev, `beta ${b}`);
      prev = g;
    }
  });
  ok('the modes: tolerance falls from Easy to Hard, and a bigger band of offsets goes with a bigger ROUNDS count', () => {
    assert.ok(L.TOLERANCE.easy > L.TOLERANCE.medium && L.TOLERANCE.medium > L.TOLERANCE.hard);
    assert.ok(L.ROUNDS.hard > L.ROUNDS.easy);
  });
  ok('tapping where a star LOOKS misses every mode: the gap is more than the tolerance across each mode’s band', () => {
    for (const mode of ['easy', 'medium', 'hard']) {
      const [lo, hi] = L.BETA_RANGE[mode];
      let gap = Infinity;
      for (let i = 0; i <= 200; i++) gap = Math.min(gap, L.mainImage(lo + ((hi - lo) * i) / 200) - (lo + ((hi - lo) * i) / 200));
      assert.ok(gap > L.TOLERANCE[mode], `${mode}: gap ${gap.toFixed(3)} <= tolerance ${L.TOLERANCE[mode]}`);
    }
  });
  ok('the faint image sits outside the black shadow in every band (Hard draws it)', () => {
    for (const mode of ['easy', 'medium', 'hard']) {
      const [lo, hi] = L.BETA_RANGE[mode];
      for (let i = 0; i <= 50; i++) {
        const b = lo + ((hi - lo) * i) / 50;
        assert.ok(Math.abs(L.minorImage(b)) > L.SHADOW_SHARE, `${mode} beta ${b}`);
      }
    }
  });

  console.log('game rules');
  ok('a hit moves on, the last hit wins; a miss costs a life; no lives left is lost; a finished game takes no taps', () => {
    let g = L.newGame('easy', seeded(3));
    const n = g.stars.length;
    for (let i = 0; i < n; i++) {
      g = L.tapGame(g, L.truePoint(g.stars[g.next]));
      assert.equal(g.last.hit, true);
    }
    assert.equal(g.status, 'won');
    let h = L.newGame('hard', seeded(4));
    const far = { x: 3.9, y: 2.2 };
    const lives = h.lives;
    for (let i = 0; i < lives; i++) h = L.tapGame(h, far);
    assert.equal(h.status, 'lost');
    assert.equal(L.tapGame(h, far), h);
  });

  console.log('bot sweep (300 games per mode)');
  const TRIES = 300;
  const TAP_BOX = { x: [-4.2, 4.2], y: [-2.37, 2.37] }; // the card's canvas, in theta_E units
  function sweep(mode, strategy, seed) {
    const rnd = seeded(seed);
    let wins = 0;
    for (let k = 0; k < TRIES; k++) {
      let g = L.newGame(mode, rnd);
      let guard = 0;
      while (g.status === 'playing' && guard++ < 200) {
        const star = g.stars[g.next];
        let pt;
        if (strategy === 'rule') pt = L.ruleTap(star, mode, rnd);
        else if (strategy === 'naive') pt = L.naiveTap(star);
        else pt = { x: TAP_BOX.x[0] + (TAP_BOX.x[1] - TAP_BOX.x[0]) * rnd(), y: TAP_BOX.y[0] + (TAP_BOX.y[1] - TAP_BOX.y[0]) * rnd() };
        g = L.tapGame(g, pt);
      }
      if (g.status === 'won') wins++;
    }
    return wins / TRIES;
  }
  const table = {};
  for (const mode of ['easy', 'medium', 'hard']) {
    table[mode] = { rule: sweep(mode, 'rule', 101), naive: sweep(mode, 'naive', 202), random: sweep(mode, 'random', 303) };
  }
  console.log('       mode     rule (reads the bend)   naive (taps where it looks)   random taps');
  for (const mode of ['easy', 'medium', 'hard']) {
    const r = table[mode];
    console.log(`       ${mode.padEnd(8)} ${(100 * r.rule).toFixed(0).padStart(3)}%                  ${(100 * r.naive).toFixed(0).padStart(3)}%                          ${(100 * r.random).toFixed(0).padStart(3)}%`);
  }
  for (const mode of ['easy', 'medium', 'hard']) {
    ok(`${mode}: a player who uses the rule wins at least 90% of games`, () => assert.ok(table[mode].rule >= 0.9, `rule won ${table[mode].rule}`));
  }
  ok('hard: tapping where the star looks wins at most 10% of games', () => assert.ok(table.hard.naive <= 0.1, `naive won ${table.hard.naive}`));
  ok('hard: random taps win at most 10% of games', () => assert.ok(table.hard.random <= 0.1, `random won ${table.hard.random}`));

  console.log('Part D questions');
  const partD = Object.values(CH7D_QUESTIONS);
  const bankBy = { 4: ch7Bank(4), 1: ch7Bank(1) };
  for (const level of [4, 1]) {
    ok(`Level ${level}: every Part D question is a choice question with one right answer of three`, () => {
      for (const q of partD) {
        const qq = bankBy[level][q.id];
        assert.equal(qq.type, 'choice', q.id);
        assert.equal(qq.choices.length, 3, `${q.id}: three choices`);
        assert.equal(qq.choices.filter((c) => c.correct).length, 1, `${q.id}: one right answer`);
        assert.equal(qq.act, 4, `${q.id}: act 4`);
      }
    });
    ok(`Level ${level}: no choice is a bare number, and the right choice is never the uniquely longest`, () => {
      for (const q of partD) {
        const qq = bankBy[level][q.id];
        for (const c of qq.choices) assert.ok(!/^[\d\s.,%/-]+$/.test(c.text), `${q.id}: bare number "${c.text}"`);
        const right = qq.choices.find((c) => c.correct).text.length;
        const longestWrong = Math.max(...qq.choices.filter((c) => !c.correct).map((c) => c.text.length));
        assert.ok(!(right > longestWrong), `${q.id}: right answer is the longest (${right} vs ${longestWrong})`);
      }
    });
    ok(`Level ${level}: every Part D question has a prompt, a hint, a parent hint and a success line`, () => {
      for (const q of partD) {
        const qq = bankBy[level][q.id];
        for (const k of ['prompt', 'hint', 'parentHint', 'success']) assert.ok(qq[k] && qq[k].length > 10, `${q.id}: ${k}`);
      }
    });
  }
  ok('Level 1 overlays only Part D ids that exist at Level 4, and each one has a full choice list', () => {
    for (const [id, o] of Object.entries(CH7D_LEVEL1)) {
      assert.ok(CH7D_QUESTIONS[id], `${id} has no Level 4 question`);
      assert.equal(o.choices.length, 3, `${id}: three choices at Level 1`);
    }
  });
  ok('the beats the Part D steps ask are in the bank at both Levels', () => {
    const steps = partDSteps({ hud: new Proxy({}, { get: () => () => Promise.resolve() }), renderer: null });
    for (const s of steps) {
      for (const b of [s.beat, ...(s.bonusBeats || [])].filter(Boolean)) {
        for (const level of [4, 1]) assert.ok(Object.values(bankBy[level]).some((q) => q.beat === b), `${s.id}: ${b} at Level ${level}`);
      }
    }
  });
  ok('the facts: 2.4 billion years is about ten times the dinosaurs’ 230 million, so the light left long before them', () => {
    const ratio = 2.4e9 / 2.3e8;
    assert.ok(ratio > 9 && ratio < 11, `ratio ${ratio}`);
    assert.ok(CH7D_QUESTIONS.c7_quasar_far.parentHint.includes('about ten times'));
    assert.ok(CH7D_QUESTIONS.c7_lens_real.parentHint.includes('beta = theta - 1/theta'));
  });

  console.log('lesson 7D');
  ok('lesson 7D: three films, the last one watch-only, the first two with one question each, under 45 s per film', () => {
    assert.equal(LESSON_7D.id, 'ch7_black_hole');
    assert.equal(LESSON_7D.films.length, 3);
    assert.deepEqual(LESSON_7D.films.map((f) => !!f.watchOnly), [false, false, true]);
    assert.ok(LESSON_7D.films[2].question === undefined);
    for (const f of LESSON_7D.films) {
      const secs = f.beats.reduce((s, b) => s + b.dur, 0);
      assert.ok(secs < 45, `${f.title[0]}: ${secs} s`);
    }
  });
  ok('lesson 7D: the Level 1 captions are short (at most 18 words each)', () => {
    for (const f of LESSON_7D.films) for (const b of f.beats) assert.ok(b.cap[1].split(/\s+/).length <= 18, `"${b.cap[1]}"`);
  });
  ok('lesson 7D: the right answer is never the uniquely longest choice, and no choice is a bare number (both Levels)', () => {
    LESSON_7D.films.forEach((f) => {
      if (!f.question) return;
      for (const lvl of [0, 1]) {
        const right = f.question.choices.find((c) => c.correct).text[lvl];
        const others = f.question.choices.filter((c) => !c.correct).map((c) => c.text[lvl]);
        assert.ok(right.length <= Math.max(...others.map((x) => x.length)), `${f.title[0]}: right is longest at Level ${lvl === 0 ? 4 : 1}`);
        for (const c of f.question.choices) assert.ok(!/^[\d\s.,%/-]+$/.test(c.text[lvl]), `bare number "${c.text[lvl]}"`);
      }
    });
  });

  ok('lesson 7D: the disk is hundreds of thousands of degrees, never millions (the corona is the millions)', () => {
    assert.ok(!JSON.stringify(LESSON_7D).includes('millions of degrees'));
    assert.ok(JSON.stringify(LESSON_7D).includes('hundreds of thousands of degrees'));
  });
  ok('lesson 7D: every film draws in reduced-motion mode (the final picture) without throwing', () => {
    const fake = new Proxy({}, { get(_, k) { if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} }); if (k === 'measureText') return () => ({ width: 10 }); return () => {}; }, set() { return true; } });
    for (const f of LESSON_7D.films) for (const T of [0, 4, 9, 14]) f.draw(fake, T, { level: 4, t: (a) => a, reduced: true, asking: false });
  });

  console.log('holodeck');
  const holo = buildHolodeckScene({});
  ok('the holodeck: at most 60 draw calls and 150k triangles, and it builds with no browser', () => {
    let draws = 0; let tris = 0;
    holo.scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return;
      draws++;
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : (o.isPoints ? 0 : g.attributes.position.count / 3);
    });
    assert.ok(draws <= 60, `draw calls ${draws}`);
    assert.ok(tris <= 150000, `triangles ${tris}`);
    console.log(`       holodeck: ${draws} draw calls, ${Math.round(tris)} triangles (points are not counted as triangles)`);
  });
  ok('the holodeck: loads, then flies round the hole, then the scene is over (about 26 s)', async () => {
    const p = holo.start();
    let done = false;
    p.then(() => { done = true; });
    const phases = {};
    const input = { turn: 0, thrust: 0 };
    for (let i = 0; i < 60 * 30; i++) {
      holo.tick(1 / 60, input, { dx: 0, dy: 0, wheel: 0, dragging: false }, false);
      const t = (i + 1) / 60;
      if (Math.abs(t - 2) < 1 / 120) phases.load = holo.debug.phase();
      if (Math.abs(t - 12) < 1 / 120) phases.fly = holo.debug.phase();
      if (Math.abs(t - 27) < 1 / 120) phases.end = holo.debug.phase();
      if (done) break;
    }
    await Promise.resolve();
    assert.equal(phases.load, 'load');
    assert.equal(phases.fly, 'fly');
    assert.equal(phases.end, 'done');
    assert.ok(done, 'the scene resolved');
  });
  ok('the holodeck: steering turns the view a little, and the steering stays within its limits', () => {
    const s = buildHolodeckScene({});
    s.start();
    const idle = { turn: 0, thrust: 0 };
    for (let i = 0; i < 60 * 5; i++) s.tick(1 / 60, idle, {}, false);
    const before = s.camera.position.clone();
    for (let i = 0; i < 60 * 3; i++) s.tick(1 / 60, { turn: 1, thrust: 1 }, {}, false);
    const after = s.camera.position;
    assert.ok(before.distanceTo(after) > 0.5, 'the camera moved');
    assert.ok(after.length() > 26 && after.length() < 58, `distance ${after.length()} within limits`);
    s.dispose();
  });
  ok('the holodeck: dispose frees its objects and leaves no window hook behind', () => {
    const s = buildHolodeckScene({});
    s.start();
    s.dispose();
    assert.equal(globalThis.window?.__holo, undefined);
  });

  console.log('lens card');
  ok('the lens card module imports in vite SSR and exposes playLens', () => {
    assert.equal(typeof playLens, 'function');
  });
} finally {
  await vite.close();
}
await Promise.all(pending);

function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
}

console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
