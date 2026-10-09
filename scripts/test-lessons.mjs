// Lessons (src/lesson/) and Chapter 3's Launch Tuner: data and maths checks.
//
//   node scripts/test-lessons.mjs
//
// The films themselves are checked by eye in the browser (HANDOFF.md); this
// guards what a typo would silently break: every film has captions at both
// Levels and one question with exactly one right answer out of three, every
// caption stays on screen for its reading time (readMs, src/play/readTime.js),
// a caption too long to read by itself waits for a "Next" click, the films draw
// without throwing, and the tuner's test flights keep the trade-off the lesson needs.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readMs, needsClick } from '../src/play/readTime.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const { LESSON_1A, LESSON_1B } = await import('../src/lesson/lessons/ch1.js');
const { LESSON_2A, LESSON_2B } = await import('../src/lesson/lessons/ch2.js');
const { LESSON_3A, LESSON_3B, LESSON_3C } = await import('../src/lesson/lessons/ch3.js');
const card = await import('../src/lesson/card.js');
const { LESSON_4G } = await import('../src/lesson/lessons/ch4.js');
const { LESSON_4F } = await import('../src/lesson/lessons/flightSchool.js');
const { LESSON_5A, LESSON_5AA } = await import('../src/lesson/lessons/ch5.js');
const { LESSON_5B } = await import('../src/lesson/lessons/ch5b.js');
const { LESSON_5C } = await import('../src/lesson/lessons/ch5c.js');
const { LESSON_6A } = await import('../src/lesson/lessons/ch6a.js');
const { LESSON_6B } = await import('../src/lesson/lessons/ch6b.js');
const { LESSON_6C } = await import('../src/lesson/lessons/ch6c.js');
const { LESSON_7A } = await import('../src/lesson/lessons/ch7a.js');
const { LESSON_7B } = await import('../src/lesson/lessons/ch7b.js');
const { LESSON_7C } = await import('../src/lesson/lessons/ch7c.js');
const { LESSON_7D } = await import('../src/lesson/lessons/ch7d.js');
const LESSONS = [LESSON_1A, LESSON_1B, LESSON_2A, LESSON_2B, LESSON_3A, LESSON_3B, LESSON_3C, LESSON_4F, LESSON_4G, LESSON_5A, LESSON_5AA, LESSON_5B, LESSON_5C, LESSON_6A, LESSON_6B, LESSON_6C, LESSON_7A, LESSON_7B, LESSON_7C, LESSON_7D];
// Films per lesson: three, unless the plan says otherwise.
const FILMS = { ch4_flight_school: 4, ch5_momentum: 5, ch5_fusion: 5, ch6_slingshot: 4 };

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
// Breathers (lead, 2026-10-08, Chapter 5 review): never three film questions in a row.
// A watch-only film (no question) breaks the run, so the child gets a rest between
// questions. (Chapters 1-4 and 6 keep their own pattern; this checks Chapter 5.)
ok('Chapter 5: no lesson asks three questions in a row (a watch-only film gives a breather)', () => {
  for (const L of [LESSON_5A, LESSON_5AA, LESSON_5B, LESSON_5C]) {
    let run = 0;
    L.films.forEach((f, i) => {
      run = f.watchOnly ? 0 : run + 1;
      assert.ok(run < 3, `${L.id}: film ${i + 1} is the third question in a row`);
    });
    assert.ok(L.films.filter((f) => f.watchOnly).length <= 2, `${L.id}: too many watch-only films`);
  }
});
ok('Chapter 5: 5A, 5B and 5C end on a breather; 5AA has its own rests (films 2 and 4)', () => {
  const watch = (L) => L.films.map((f) => !!f.watchOnly);
  assert.deepEqual(watch(LESSON_5A), [false, false, true]);
  assert.deepEqual(watch(LESSON_5B), [false, false, true]);
  assert.deepEqual(watch(LESSON_5C), [false, false, true, false, false]);
  assert.deepEqual(watch(LESSON_5AA), [false, true, false, true, false]);
});
ok('Chapter 5 fusion: the coal figure is about 20 million (hydrogen to helium, ~6e14 J/kg vs coal ~3e7 J/kg)', () => {
  const coal = LESSON_5C.films[4];
  assert.ok(coal.beats.some((b) => b.cap[0].includes('about 20 million kilograms of coal')), 'Level 4 caption');
  assert.ok(coal.beats.some((b) => b.cap[1].includes('20 million kilos of coal')), 'Level 1 caption');
  assert.ok(coal.question.why[0].includes('about 20 million times less'), 'why line');
  assert.ok(!JSON.stringify(LESSON_5C).includes('10 million'), 'no stale 10 million figure');
  assert.ok(!JSON.stringify(LESSON_5C).includes('1 cup'), 'no stale cup figure');
  assert.ok(LESSON_5C.films[4].beats.some((b) => b.cap[0].includes('about as long as the pyramids have stood')), 'pyramid comparison is about 5,000 years');
});
ok('Chapter 5 momentum: "Catching up" has number choices, and 2 is the right answer', () => {
  const q = LESSON_5AA.films[2].question;
  assert.deepEqual(q.choices.map((c) => c.text[0]).sort(), ['1', '2', '4']);
  assert.equal(q.choices.find((c) => c.correct).text[0], '2');
  assert.deepEqual(q.choices.map((c) => c.text[1]).sort(), ['Speed 1', 'Speed 2', 'Speed 4']);
  assert.equal(q.choices.find((c) => c.correct).text[1], 'Speed 2');
  assert.ok(LESSON_5AA.films[2].beats[0].cap[0].includes('same-size chunks'), 'the chunks are the same size');
});
// Balance (critic, 2026-10-08): in a Chapter 5 lesson question the right answer is never the
// uniquely longest choice, at either Level, so a child cannot pick the longest one.
ok('Chapter 5: no lesson question has the right answer as the uniquely longest choice (both Levels)', () => {
  for (const L of [LESSON_5A, LESSON_5AA, LESSON_5B, LESSON_5C]) {
    L.films.forEach((f, i) => {
      if (!f.question) return;
      for (const lvl of [0, 1]) {
        const right = f.question.choices.find((c) => c.correct).text[lvl].length;
        const others = f.question.choices.filter((c) => !c.correct).map((c) => c.text[lvl].length);
        assert.ok(!(right > Math.max(...others)), `${L.id} film ${i + 1} level ${lvl === 0 ? 4 : 1}: right answer is the longest (${right} vs ${Math.max(...others)})`);
      }
    });
  }
});
ok('every caption is visible for at least its reading time (readMs), at both Levels', () => {
  for (const L of LESSONS) {
    for (const f of L.films) {
      const plan = card.filmPlan(f);
      plan.beats.forEach((b, k) => {
        // The beat lasts at least the reading time of either Level's wording.
        for (const text of f.beats[k].cap) {
          assert.ok(b.real >= readMs(text) / 1000 - 1e-9, `${L.id} beat ${k + 1}: "${text.slice(0, 40)}" is up ${b.real.toFixed(2)} s, needs ${(readMs(text) / 1000).toFixed(2)} s`);
        }
      });
    }
  }
});
ok('a caption too long to read in 10 s waits for a Next click (never on the last beat)', () => {
  for (const L of LESSONS) {
    for (const f of L.films) {
      const plan = card.filmPlan(f);
      plan.beats.forEach((b, k) => {
        const last = k === plan.beats.length - 1;
        assert.equal(b.click, needsClick(b.cap) && !last, `${L.id} beat ${k + 1}: click flag`);
        if (b.click) assert.ok(b.real >= 10 - 1e-9, `${L.id} beat ${k + 1}: a click beat stays 10 s first`);
      });
    }
  }
});
ok('the film clock still maps real time onto authored time, for every film', () => {
  for (const L of LESSONS) {
    for (const f of L.films) {
      const plan = card.filmPlan(f);
      assert.equal(card.planAt(plan, 0).T, 0);
      assert.ok(Math.abs(card.planAt(plan, plan.length).T - plan.authored) < 1e-9, `${L.id}: the end is the authored end`);
    }
  }
});
// Report (lead 2026-10-09): the films are longer now that every caption has its reading time.
const longest = LESSONS.map((L) => [L.id, Math.max(...L.films.map((f) => card.filmPlan(f).length))]);
console.log(`  info longest film per lesson (s): ${longest.map(([id, n]) => `${id} ${n.toFixed(1)}`).join(', ')}`);
ok('the clock maps real time onto authored time, start and end', () => {
  const plan = card.filmPlan(LESSON_3A.films[0]);
  assert.equal(card.planAt(plan, 0).T, 0);
  assert.equal(card.planAt(plan, plan.length).T, plan.authored);
  assert.equal(card.planAt(plan, plan.length + 5).T, plan.authored);
});

// The lesson card itself, with a small fake DOM and a clock the test moves by hand
// (playLesson's tick is a setInterval; the test calls it, so each step is exact).
console.log('lesson card');
{
  const listeners = {};
  const timers = [];
  let now = 1000;
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const realNow = performance.now;
  class FakeEl {
    constructor(tag) {
      this.tagName = tag; this.className = ''; this.children = []; this.dataset = {}; this.hidden = false; this.disabled = false;
      this.type = ''; this.title = ''; this.id = ''; this.attrs = {}; this.listeners = {}; this.parent = null;
      const on = new Set();
      this.classList = {
        add: (...c) => c.forEach((x) => on.add(x)), remove: (...c) => c.forEach((x) => on.delete(x)),
        toggle: (c, force) => { const want = force === undefined ? !on.has(c) : !!force; if (want) on.add(c); else on.delete(c); return want; },
        contains: (c) => on.has(c),
      };
    }
    get textContent() { return this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
    set textContent(v) { this.children = v === '' || v == null ? [] : [String(v)]; }
    appendChild(c) { if (c && typeof c === 'object') c.parent = this; this.children.push(c); return c; }
    append(...nodes) { nodes.forEach((n) => this.appendChild(n)); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    click() { (this.listeners.click || []).forEach((fn) => fn({ type: 'click', stopPropagation() {} })); }
    focus() {}
    querySelector(sel) {
      const match = (n) => (sel === 'button' ? n.tagName === 'button' : sel === '[data-correct="1"]' ? n.dataset.correct === '1' : false);
      for (const c of this.children) {
        if (typeof c !== 'object') continue;
        if (match(c)) return c;
        const hit = c.querySelector(sel);
        if (hit) return hit;
      }
      return null;
    }
  }
  const find = (root, text) => {
    for (const c of root.children) {
      if (typeof c !== 'object') continue;
      if (c.tagName === 'button' && c.textContent === text) return c;
      const hit = find(c, text);
      if (hit) return hit;
    }
    return null;
  };
  const ctx = fakeCtx();
  const body = new FakeEl('body');
  const saved = { document: globalThis.document, window: globalThis.window, addEventListener: globalThis.addEventListener, removeEventListener: globalThis.removeEventListener, localStorage: globalThis.localStorage };
  globalThis.document = { createElement: (tag) => { const e = new FakeEl(tag); if (tag === 'canvas') e.getContext = () => ctx; return e; }, head: new FakeEl('head'), body, getElementById: () => null };
  globalThis.window = globalThis;
  globalThis.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
  globalThis.removeEventListener = (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  performance.now = () => now;
  globalThis.setInterval = (fn) => { timers.push(fn); return timers.length; };
  globalThis.clearInterval = () => {};
  const advance = (sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) { now += 50; for (const f of timers.slice()) f(); } };
  const press = (key) => { for (const fn of listeners.keydown || []) fn({ key, ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }); };
  const LONG = 'Ten seconds is not enough for this long line, so the film waits for you to press Next when you have read every single word of it.';
  const QUESTION = { prompt: ['Which?', 'Which?'], choices: [{ text: ['One', 'One'], correct: false }, { text: ['Two', 'Two'], correct: true }, { text: ['Three', 'Three'], correct: false }], hint: ['h', 'h'], why: ['Because.', 'Because.'] };
  const draw = () => {};
  try {
    const clickLesson = { id: 'test_click', eyebrow: ['E', 'E'], narrator: ['N', 'N'], films: [{
      title: ['One', 'One'], draw, question: QUESTION,
      beats: [{ dur: 2, cap: ['A short line.', 'A short line.'] }, { dur: 3, cap: [LONG, LONG] }, { dur: 2, cap: ['A last line.', 'A last line.'] }],
    }] };
    const done = card.playLesson(clickLesson);
    const api = globalThis.__lesson;
    const nextIn = (a) => find(a.card, 'Next');
    const pauseIn = (a) => find(a.card, '❚❚ Pause') || find(a.card, '▶ Play') || find(a.card, '▶ Show me');
    // The long caption (a click beat) stops the film at 15 s, and nothing moves it until "Next".
    advance(14.5);
    assert.ok(api.state().time > 14.4 && api.state().time < 14.6, `reached ${api.state().time}`);
    advance(1);
    const held = api.state().time;
    assert.ok(held > 14.9 && held <= 15, `the film waits at 15 s (${held})`);
    advance(3);
    assert.equal(api.state().time, held, 'the film does not run on without a click');
    assert.equal(nextIn(api).disabled, false, 'Next is ready at the click beat');
    assert.equal(pauseIn(api).hidden, true, 'pause is hidden at a click beat');
    press(' ');
    assert.equal(api.state().time, held, 'Space does not go on from a click beat');
    nextIn(api).click();
    advance(1);
    assert.ok(api.state().time > held + 0.9, 'the film goes on after Next');
    advance(6);
    assert.equal(api.state().time, 20, 'the film reaches its end');
    assert.equal(nextIn(api).disabled, false, 'Next is ready at the film end');
    nextIn(api).click();
    assert.equal(api.state().mode, 'ask', 'Next at the end asks the question');
    api.next();
    const out = await done;
    assert.equal(out.results.length, 1, 'one question answered');
    assert.equal(out.results[0].correct, true, 'the right answer was counted');
    console.log('  ok  a caption too long to read waits for Next, then the film and its question go on');

    // "Show me" (predict): the film holds at the end of its predict beat until the child presses it.
    const predictLesson = { id: 'test_predict', eyebrow: ['E', 'E'], narrator: ['N', 'N'], films: [{
      title: ['Two', 'Two'], draw, watchOnly: true,
      beats: [{ dur: 2, predict: true, cap: ['Guess first.', 'Guess first.'] }, { dur: 2, cap: ['Now the answer.', 'Now the answer.'] }],
    }] };
    const done2 = card.playLesson(predictLesson);
    const api2 = globalThis.__lesson;
    advance(5.5);
    const at = api2.state().time;
    assert.ok(at > 4.9 && at <= 5, `the predict beat holds at 5 s (${at})`);
    assert.equal(pauseIn(api2)?.textContent, '▶ Show me', 'the pause button says Show me');
    advance(2);
    assert.equal(api2.state().time, at, 'the film waits for Show me');
    pauseIn(api2).click();
    advance(1);
    assert.ok(api2.state().time > at + 0.9, 'Show me goes on');
    advance(5);
    assert.equal(nextIn(api2).disabled, false, 'Next is ready at the film end');
    nextIn(api2).click();
    await done2;
    console.log('  ok  Show me holds a predict beat until pressed, and the film ends on Next');
  } finally {
    if (globalThis.__lesson) delete globalThis.__lesson;
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClearInterval;
    performance.now = realNow;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
    passed += 2;
  }
}

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
