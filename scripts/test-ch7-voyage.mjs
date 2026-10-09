// Chapter 7, work package A (cutscenes and the bridge): the voyage maths, the
// star map's data and every question's numbers, re-derived here from the raw
// formulas (not from voyage.js's own constants), at both Levels.
//
//   node scripts/test-ch7-voyage.mjs
//
// Also loads the cutscene and star map modules through Vite (SSR), so an import
// or a top-level error in them fails the test.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const V = await vite.ssrLoadModule('/src/space/ch7/voyage.js');
  const S = await vite.ssrLoadModule('/src/space/ch7/starMap.js');
  const OP = await vite.ssrLoadModule('/src/space/ch7/opening.js');
  const CR = await vite.ssrLoadModule('/src/space/ch7/cruise.js');
  const PA = await vite.ssrLoadModule('/src/space/ch7/partA.js');
  const PE = await vite.ssrLoadModule('/src/space/ch7/partE.js');
  const QA = await vite.ssrLoadModule('/src/space/ch7/questions.partA.js');
  const QE = await vite.ssrLoadModule('/src/space/ch7/questions.partE.js');

  // --- the physics, from first principles ---------------------------------------
  // c = 299,792,458 m/s; 1 g = 9.8 m/s^2 (the story's round figure); a year = 365.25 days.
  const c = 299792458; const g = 9.8; const yr = 365.25 * 86400;
  const K = c / g / yr; // c/g in years: the one constant of the model
  const atanh = (x) => 0.5 * Math.log((1 + x) / (1 - x));
  const gam = (v) => 1 / Math.sqrt(1 - v * v);

  console.log('voyage maths');
  ok('c/g is about 0.97 years', () => {
    assert.ok(Math.abs(K - 0.9694) < 0.001, `K = ${K}`);
    assert.ok(Math.abs(V.C_OVER_G_YEARS - K) < 1e-12);
  });
  ok('Tau Ceti is 11.9 light-years, and light takes 11.9 years to get there', () => assert.equal(V.TAU_CETI_LY, 11.9));
  ok('at a tenth of light speed the trip takes 119 years (11.9 / 0.1)', () => {
    assert.equal(V.TAU_YEARS_AT_TENTH, 119);
    assert.equal(Math.round(11.9 / 0.1), 119);
  });
  ok('at 90% of light speed: rapidity atanh(0.9) = 0.5 ln 19', () => {
    assert.ok(Math.abs(atanh(0.9) - 0.5 * Math.log(19)) < 1e-12);
  });
  ok('ship time to 90% from rest: (c/g) atanh(0.9), about 1.43 years', () => {
    const shipTo90 = K * atanh(0.9);
    assert.ok(Math.abs(shipTo90 - 1.4271) < 0.001, `${shipTo90}`);
    assert.ok(Math.abs(V.shipYears(0.9) - shipTo90) < 1e-12);
  });
  ok('Earth time to 90% from rest: (c/g) sinh(atanh 0.9) = (c/g) gamma v, about 2.0 years', () => {
    const earthTo90 = K * (gam(0.9) * 0.9);
    assert.ok(Math.abs(earthTo90 - 2.0015) < 0.001, `${earthTo90}`);
    assert.ok(Math.abs(V.earthYears(0.9) - earthTo90) < 1e-12);
  });
  ok('distance to 90% from rest: (c^2/g)(gamma - 1), about 1.25 light-years', () => {
    const d = K * (gam(0.9) - 1);
    assert.ok(Math.abs(d - 1.2545) < 0.001, `${d}`);
    assert.ok(Math.abs(V.lightYearsTo(0.9) - d) < 1e-12);
  });
  ok('the whole trip from rest: ship about 7.4 years, Earth about 14.4 years, distance 11.9 light-years', () => {
    const d = K * (gam(0.9) - 1);
    const coast = 11.9 - 2 * d; // up at 1 g, down at 1 g, the rest is coasting at 90%
    const shipT = 2 * K * atanh(0.9) + coast / 0.9 / gam(0.9);
    const earthT = 2 * K * gam(0.9) * 0.9 + coast / 0.9;
    assert.ok(Math.abs(shipT - 7.4) < 0.05, `ship ${shipT}`);
    assert.ok(Math.abs(earthT - 14.4) < 0.05, `earth ${earthT}`);
    const t = V.tripPlan(0);
    assert.ok(Math.abs(t.shipYears - shipT) < 1e-9 && Math.abs(t.earthYears - earthT) < 1e-9);
    assert.ok(Math.abs(t.accelLy + t.coastLy + t.brakeLy - 11.9) < 1e-9, 'the three legs add to 11.9 light-years');
    assert.ok(t.coastLy > 0, 'there is a coast');
  });
  ok('the rounded story numbers: about 7 years for us, about 14 on Earth, a gap of 7', () => {
    assert.equal(V.SHIP_YEARS_STORY, 7);
    assert.equal(V.EARTH_YEARS_STORY, 14);
    assert.equal(V.CLOCK_GAP_STORY, 7);
  });
  ok('from the chapter’s own start (20%) the trip still rounds to about 7 and 14', () => {
    const t = V.tripPlan(V.OPENING_TO);
    assert.equal(Math.round(t.shipYears), 7, `ship ${t.shipYears}`);
    assert.equal(Math.round(t.earthYears), 14, `earth ${t.earthYears}`);
    const legs = t.accelLy + t.coastLy + t.brakeLy;
    assert.ok(Math.abs(legs - 11.9) < 1e-9);
  });
  ok('the ship clock from 20% to 90% is about 1.2 years, shown as "1 year 3 months"', () => {
    const y = K * (atanh(0.9) - atanh(0.2));
    assert.ok(Math.abs(y - 1.2306) < 0.001, `${y}`);
    assert.equal(V.clockWords(y), '1 year 3 months');
    assert.equal(V.clockWords(y, { l1: true }), '1 year, 3 months');
  });
  ok('the dial climbs in rapidity: it starts at its start speed and ends at its top', () => {
    assert.ok(Math.abs(V.dialSpeed(0.1, 0.2, 0) - 0.1) < 1e-12);
    assert.ok(Math.abs(V.dialSpeed(0.1, 0.2, 1) - 0.2) < 1e-12);
    // halfway in rapidity is not halfway in speed: 0.1 and 0.2 -> tanh of the mean rapidity
    const mid = V.dialSpeed(0.1, 0.2, 0.5);
    assert.ok(Math.abs(mid - Math.tanh((atanh(0.1) + atanh(0.2)) / 2)) < 1e-12);
    assert.ok(V.dialSpeed(0.2, 0.9, 0.5) > 0.2 && V.dialSpeed(0.2, 0.9, 0.5) < 0.9);
  });
  ok('the speed after one minute at 1 g: 9.8 x 60 = 588 m/s, the story says about 600', () => {
    assert.equal(9.8 * 60, 588);
    assert.equal(V.MINUTE_SPEED_EXACT, 588);
    assert.equal(V.MINUTE_SPEED_STORY, 600);
    assert.equal(V.metresPerSecondAt(60), 588);
  });
  ok('the speed after five seconds at the story’s 10 a second is 50 m/s', () => {
    assert.equal(V.FIVE_SECOND_SPEED, 50);
    assert.equal(V.STORY_ACCEL * 5, 50);
  });
  ok('the speed never reaches light speed, however long the push (tanh of the rapidity)', () => {
    assert.ok(V.dialSpeed(0.2, 0.9, 1) < 1);
  });

  // --- the star map's data --------------------------------------------------------------
  console.log('star map');
  ok('the five neighbours and their distances (plan section 1)', () => {
    const want = { alpha: 4.4, barnard: 6.0, sirius: 8.6, eps: 10.5, tau: 11.9 };
    assert.deepEqual(Object.fromEntries(V.NEIGHBOURS.map((s) => [s.id, s.ly])), want);
    assert.equal(V.NEIGHBOURS.find((s) => s.target).id, 'tau');
  });
  ok('the stars are in order of distance, with Tau Ceti the farthest of the five', () => {
    const d = V.NEIGHBOURS.map((s) => s.ly);
    assert.deepEqual(d, [...d].sort((a, b) => a - b));
    assert.equal(d.at(-1), 11.9);
  });
  ok('each star’s place on the map is as far from the Sun as its distance', () => {
    for (const s of V.NEIGHBOURS) {
      const [x, y, z] = S.starPlace(s);
      const r = Math.hypot(x, y, z);
      assert.ok(Math.abs(r - s.ly) < 1e-9, `${s.id}: ${r}`);
    }
  });
  ok('the labels: "4.4 light-years" at Level 4, "about 4 light-years" at Level 1', () => {
    const a = V.NEIGHBOURS.find((s) => s.id === 'alpha');
    assert.equal(S.distanceWords(a, 4), '4.4 light-years');
    assert.equal(S.distanceWords(a, 1), 'about 4 light-years');
    const e = V.NEIGHBOURS.find((s) => s.id === 'eps');
    assert.equal(S.distanceWords(e, 1), 'about 11 light-years');
  });
  ok('every star has a colour in the map (starMap.js)', () => {
    for (const s of S.NEIGHBOURS) assert.equal(typeof s.colour, 'number');
  });
  ok('the caption is honest: it says nobody knows yet', () => {
    assert.match(S.STAR_MAP_CAPTION, /Nobody knows yet/);
    assert.match(S.STAR_MAP_CAPTION, /11\.9 light-years|about 12 light-years/);
  });

  // --- the questions: numbers at both Levels ------------------------------------------------
  // A part's bank at a Level: its Level 1 overlay merged over the Level 4 entries (as questions.ch7.js does).
  const merged = (base, over, level) => (level === 1
    ? Object.fromEntries(Object.entries(base).map(([id, q]) => [id, { ...q, ...(over[id] || {}) }]))
    : base);
  const bankA = (level) => merged(QA.CH7A_QUESTIONS, QA.CH7A_LEVEL1, level);
  const bankE = (level) => merged(QE.CH7E_QUESTIONS, QE.CH7E_LEVEL1, level);
  const num = (text) => Number(String(text).replace(/[^\d.]/g, ''));
  console.log('questions');
  for (const level of [4, 1]) {
    const A = bankA(level); const E = bankE(level);
    ok(`Level ${level}: the tenth-of-light trip is 119 years (Level 1: 12 light-years, ten times slower: 120)`, () => {
      const q = A.c7_tau_years;
      const want = level === 1 ? '120' : '119';
      assert.deepEqual(q.answers.slice(0, 1), [want]);
      assert.ok(q.answers.includes(`${want} years`));
      assert.equal(q.type, 'text');
      if (level === 1) assert.match(q.prompt, /12 years/);
      else assert.match(q.prompt, /11\.9 years/);
    });
    ok(`Level ${level}: the nearest star is Alpha Centauri, and it is the third choice, not the longest`, () => {
      const q = A.c7_nearest_star;
      assert.equal(q.type, 'choice');
      const correct = q.choices.filter((c) => c.correct);
      assert.equal(correct.length, 1, 'one right choice');
      assert.match(correct[0].text, /Alpha Centauri/);
      assert.equal(q.choices.indexOf(correct[0]), 2, 'the right choice is not always first');
      const longest = Math.max(...q.choices.map((c) => c.text.length));
      assert.ok(correct[0].text.length < longest, `right choice ${correct[0].text.length} vs longest ${longest}`);
      // the numbers shown are the table's
      for (const c of q.choices) {
        const star = V.NEIGHBOURS.find((s) => c.text.startsWith(s.name[0]));
        assert.ok(star, `a star for: ${c.text}`);
        const shown = level === 1 ? `about ${Math.round(star.ly)} light-years` : `${star.ly.toFixed(1)} light-years`;
        assert.ok(c.text.includes(shown), `${c.text} should show ${shown}`);
      }
    });
    ok(`Level ${level}: the push speed after a minute is about 600 m/s, the right choice is the closest to 588`, () => {
      const q = E.c7_push_speed;
      assert.equal(q.type, 'choice');
      const correct = q.choices.filter((c) => c.correct);
      assert.equal(correct.length, 1);
      if (level === 1) {
        // Level 1: after 5 seconds, 10 a second: 50
        assert.match(correct[0].text, /^50 metres per second$/);
        assert.equal(5 * 10, 50);
      } else {
        assert.match(correct[0].text, /^About 600 metres per second$/);
        const values = q.choices.map((c) => num(c.text));
        const closest = values.reduce((a, b) => (Math.abs(b - 588) < Math.abs(a - 588) ? b : a));
        assert.equal(closest, 600);
        assert.ok(Math.abs(9.8 * 60 - 588) < 1e-9);
      }
      const longest = Math.max(...q.choices.map((c) => c.text.length));
      assert.ok(correct[0].text.length < longest, 'the right choice is not the longest');
    });
    ok(`Level ${level}: Earth's years are 7 x 2 = 14, asked from the ship's 7, and 14 is not printed in the question`, () => {
      const q = E.c7_clock_gap;
      assert.equal(q.type, 'text');
      assert.deepEqual(q.answers, ['14', '14 years']);
      // the ratio of Earth's years to the ship's, from the raw formulas (trip from rest)
      const d = K * (gam(0.9) - 1);
      const coast = 11.9 - 2 * d;
      const shipT = 2 * K * atanh(0.9) + coast / 0.9 / gam(0.9);
      const earthT = 2 * K * gam(0.9) * 0.9 + coast / 0.9;
      const ratio = Math.round(earthT / shipT);
      assert.equal(ratio, 2, `ratio ${earthT / shipT}`);
      assert.equal(Math.round(shipT) * ratio, Math.round(earthT), 'the story: 7 x 2 = 14');
      assert.match(q.prompt, /\b7 years\b/);
      assert.ok(!/\b14\b/.test(q.prompt), 'the answer 14 is not on screen');
      assert.ok(!/\b14\b/.test(q.hint), 'the hint does not give 14');
    });
    ok(`Level ${level}: no choice is a bare number, and no hint gives its answer away`, () => {
      const all = [...Object.values(A), ...Object.values(E)];
      for (const q of all) {
        for (const c of q.choices || []) assert.ok(!/^[\d\s.,%]+$/.test(c.text), `${q.id}: bare number "${c.text}"`);
        if (q.hint) for (const a of q.answers || []) {
          const bare = String(a).replace(/ years| metres per second| m\/s/, '');
          if (bare.length >= 2) assert.ok(!q.hint.includes(bare), `${q.id}: hint contains the answer ${bare}`);
        }
      }
    });
    ok(`Level ${level}: every choice question has exactly one right choice`, () => {
      for (const q of [...Object.values(A), ...Object.values(E)]) {
        if (!q.choices) continue;
        assert.equal(q.choices.filter((c) => c.correct).length, 1, q.id);
      }
    });
  }

  // --- the cutscene modules load, and the parts build -------------------------------------
  console.log('modules');
  ok('the cutscene and star map modules export their entry points', () => {
    assert.equal(typeof OP.playCh7Opening, 'function');
    assert.equal(typeof CR.playCh7Cruise, 'function');
    assert.equal(typeof S.buildStarMap3D, 'function');
    assert.equal(typeof S.playStarMap, 'function');
    assert.equal(typeof PA.partASteps, 'function');
    assert.equal(typeof PE.partESteps, 'function');
  });
  ok('the Part A and Part E steps keep their ids, acts and beats', () => {
    const game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {}, controls: {}, scene: {} };
    const a = PA.partASteps(game).map((s) => s.id);
    assert.deepEqual(a, ['c7_opening', 'c7_star_map']);
    const e = PE.partESteps(game).map((s) => s.id);
    assert.deepEqual(e, ['c7_full_push', 'c7_end']);
    const beats = PE.partESteps(game)[0];
    assert.equal(beats.beat, 'c7PushSpeed');
    assert.deepEqual(beats.bonusBeats, ['c7Clocks']);
  });
  ok('the bridge spot is on the bridge deck at the shield console, led by Echo', () => {
    assert.equal(PA.STAR_MAP_SPOT.deck, 'bridge');
    assert.equal(PA.STAR_MAP_SPOT.near, 'shield');
    assert.equal(PA.STAR_MAP_SPOT.lead, 'signal');
  });
} finally {
  await vite.close();
}
console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
