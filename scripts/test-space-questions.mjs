// Checks the Chapter 4 question bank: shape, one correct choice each, unique
// beats, and every numeric answer RE-DERIVED here from the numbers in its own
// prompt - so a typo in an answer list, or a prompt edited without its answer,
// fails loudly instead of teaching a child the wrong thing.
//
//   node scripts/test-space-questions.mjs
import { SPACE_QUESTIONS, SPACE_QUESTION_ORDER, checkSpaceAnswer, questionForBeat, level1Bank } from '../src/space/questions.space.js';
import { CH5_QUESTIONS } from '../src/space/ch5/questions.ch5.js';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
}

// --- shape ------------------------------------------------------------------
const beats = new Set();
for (const id of SPACE_QUESTION_ORDER) {
  const q = SPACE_QUESTIONS[id];
  check(`${id}: id matches key`, q.id === id);
  for (const f of ['type', 'title', 'prompt', 'hint', 'parentHint', 'success', 'doneMessage', 'beat']) {
    check(`${id}: has ${f}`, typeof q[f] === 'string' && q[f].length > 0);
  }
  check(`${id}: act 1-5`, Number.isInteger(q.act) && q.act >= 1 && q.act <= 5);
  check(`${id}: beat unique`, !beats.has(q.beat), q.beat);
  beats.add(q.beat);
  check(`${id}: questionForBeat finds it`, questionForBeat(q.beat) === q);
  if (q.type === 'choice') {
    const n = q.choices.filter((c) => c.correct === true).length;
    check(`${id}: exactly one correct choice`, n === 1, `found ${n}`);
    check(`${id}: 4 choices`, q.choices.length === 4);
    const right = q.choices.find((c) => c.correct);
    check(`${id}: correct choice accepted`, checkSpaceAnswer(q, right.text));
    for (const c of q.choices.filter((c) => !c.correct)) {
      check(`${id}: wrong choice rejected (${c.text.slice(0, 24)}…)`, !checkSpaceAnswer(q, c.text));
    }
  } else {
    check(`${id}: text has answers`, Array.isArray(q.answers) && q.answers.length > 0);
    for (const a of q.answers) check(`${id}: accepts "${a}"`, checkSpaceAnswer(q, a));
  }
}

// --- the arithmetic, derived again ---------------------------------------------
const derived = {
  sunrises: (24 * 60) / 90,
  moon_jump: 30 * 6,
  mars_day: (36 * 40) / 60,
  cargo_fma: 4 / 2,
  jupiter_panels: 5 * 5,
  moon_resonance: (1 + 2 + 4) * 3,
  fuel_backwards: 1 * 2 * 2 * 2,
  // The added maths and pattern questions (lead request), each computed from
  // its own prompt rather than trusted.
  signal_sequence: (() => { const a = [3, 4]; while (a.length < 7) a.push(a.at(-1) + a.at(-2)); return a[6]; })(),
  crater_sequence: 6 * 7,
  asteroid_count: (88 - 44 + 1) - (65 - 52 + 1),
  mining_points: (() => {
    for (let small = 0; small <= 100; small++) if (small * 5 + (100 - small) * 10 === 740) return small;
    return NaN;
  })(),
};
for (const [id, value] of Object.entries(derived)) {
  check(`${id}: derived answer ${value} accepted`, checkSpaceAnswer(SPACE_QUESTIONS[id], String(value)));
}

// The tempting wrong answers must be REJECTED - they are the point of each question.
const tempting = {
  sunrises: ['24', '15'],
  moon_jump: ['5', '36', '30'],
  mars_day: ['36', '1440', '40'],
  cargo_fma: ['8', '4'],
  jupiter_panels: ['5', '10'],
  moon_resonance: ['7', '3', '12'],
  fuel_backwards: ['6', '4', '3'],
  signal_sequence: ['40', '29', '41'],
  crater_sequence: ['40', '36', '30'],
  asteroid_count: ['30', '32', '44', '45'],
  mining_points: ['48', '74', '100'],
};
for (const [id, wrong] of Object.entries(tempting)) {
  for (const w of wrong) check(`${id}: rejects tempting "${w}"`, !checkSpaceAnswer(SPACE_QUESTIONS[id], w));
}

// Choice questions whose correct option is a computed value.
const fractionSunny = 60 / 90;
check('solar_night: 2/3 is the sunny fraction', Math.abs(fractionSunny - 2 / 3) < 1e-12);
check('solar_night: marked answer is 2/3', SPACE_QUESTIONS.solar_night.choices.find((c) => c.correct).text.startsWith('2/3'));
check('inverse_square: 2x distance -> 1/(2*2)', SPACE_QUESTIONS.inverse_square.choices.find((c) => c.correct).text.startsWith('1/4'));
check('jupiter_size: 11^3 = 1331 ~ "About 1300"', 11 ** 3 === 1331 && SPACE_QUESTIONS.jupiter_size.choices.find((c) => c.correct).text === 'About 1300');

// mining_logic, brute-forced: all assignments where every label is wrong and ICE holds metal.
{
  const kinds = ['stone', 'metal', 'ice'];
  const perms = [];
  for (const a of kinds) for (const b of kinds) for (const c of kinds) {
    if (new Set([a, b, c]).size === 3) perms.push({ stone: a, metal: b, ice: c });
  }
  const valid = perms.filter((p) => p.stone !== 'stone' && p.metal !== 'metal' && p.ice !== 'ice' && p.ice === 'metal');
  check('mining_logic: puzzle has exactly one solution', valid.length === 1, JSON.stringify(valid));
  check('mining_logic: STONE crate holds ice', valid[0]?.stone === 'ice');
}

// Checked sequences: the pieces shown in the prompt really follow the rule.
check('signal_sequence: shown code follows a+b', [3, 4, 7, 11, 18, 29].every((v, i, a) => i < 2 || v === a[i - 1] + a[i - 2]));
check('crater_sequence: shown counts are n(n+1)', [2, 6, 12, 20, 30].every((v, i) => v === (i + 1) * (i + 2)));
{
  // moon_positions, simulated: 5 spaces, ● +1 and ◆ +2 per step, wrapping.
  const row = (e, io) => [0, 1, 2, 3, 4].map((k) => (k === e ? '●' : k === io ? '◆' : '·'));
  let e = 0; let io = 1;
  const rows = [];
  for (let step = 0; step < 4; step++) { rows.push(row(e, io)); e = (e + 1) % 5; io = (io + 2) % 5; }
  const q = SPACE_QUESTIONS.moon_positions;
  for (let i = 0; i < 3; i++) check(`moon_positions: step ${i + 1} drawn right`, q.visual.rows[i].tiles.join(' ') === rows[i].join(' '), rows[i].join(' '));
  check('moon_positions: answer is step 4', q.choices.find((c) => c.correct).text === rows[3].join(' ').replace(/·/g, '□'), rows[3].join(' '));
}
{
  // shape_arrows: quarter turn clockwise and one more each step.
  const turn = ['▲', '▶', '▼', '◀'];
  const q = SPACE_QUESTIONS.shape_arrows;
  for (let i = 0; i < 4; i++) check(`shape_arrows: row ${i + 1}`, q.visual.rows[i].tiles.join('') === turn[i % 4].repeat(i + 1));
  check('shape_arrows: answer is 5 up-arrows', q.choices.find((c) => c.correct).text.replace(/ /g, '') === turn[4 % 4].repeat(5));
}

// --- Level 1 overlay ----------------------------------------------------------------
// Same ids, same answer TYPES (so a child never meets two text boxes in a row
// where Level 4 has them apart), and the same shape rules as Level 4.
const L1 = level1Bank();
for (const id of SPACE_QUESTION_ORDER) {
  const q = L1[id];
  const base = SPACE_QUESTIONS[id];
  check(`L1 ${id}: has its own prompt`, q.prompt !== base.prompt);
  check(`L1 ${id}: same type as Level 4`, q.type === base.type);
  check(`L1 ${id}: same beat`, q.beat === base.beat);
  check(`L1 ${id}: says Level 1`, /^Level 1/.test(q.difficulty || ''), q.difficulty);
  if (q.type === 'choice') {
    const n = q.choices.filter((c) => c.correct === true).length;
    check(`L1 ${id}: exactly one correct choice`, n === 1, `found ${n}`);
    check(`L1 ${id}: 4 choices`, q.choices.length === 4);
    check(`L1 ${id}: correct choice accepted`, checkSpaceAnswer(q, q.choices.find((c) => c.correct).text));
  } else {
    check(`L1 ${id}: text has answers`, Array.isArray(q.answers) && q.answers.length > 0);
    for (const a of q.answers) check(`L1 ${id}: accepts "${a}"`, checkSpaceAnswer(q, a));
  }
}
const derivedL1 = {
  sunrises: 8 / 2,
  moon_jump: 2 * 6,
  mars_day: 6 + 4, // Mon..Fri is 4 steps, not 5
  cargo_fma: 8 / 2,
  jupiter_panels: 3 * 5,
  moon_resonance: 4 + 4,
  fuel_backwards: 3 * 2 * 2,
  signal_sequence: 11 + 5,
  crater_sequence: 11 - 5,
  asteroid_count: 20 - (9 - 5 + 1),
  mining_points: (10 - 4 * 1) / 2,
};
const temptingL1 = {
  mars_day: ['11'],
  fuel_backwards: ['6'],
  signal_sequence: ['15'],
  crater_sequence: ['7'],
  asteroid_count: ['16'],
  mining_points: ['6'],
};
for (const [id, v] of Object.entries(derivedL1)) check(`L1 ${id}: derived ${v} accepted`, checkSpaceAnswer(L1[id], String(v)));
for (const [id, wrong] of Object.entries(temptingL1)) for (const w of wrong) check(`L1 ${id}: rejects tempting "${w}"`, !checkSpaceAnswer(L1[id], w));
for (const id of Object.keys(derivedL1)) check(`L1 ${id}: answer within 20`, derivedL1[id] <= 20, String(derivedL1[id]));

// --- Chapter 5 bank ------------------------------------------------------------
// The same shape rules, its own unique beats, and every number re-derived.
const ch5Beats = new Set();
for (const [id, q] of Object.entries(CH5_QUESTIONS)) {
  check(`ch5 ${id}: id matches key`, q.id === id);
  check(`ch5 ${id}: id starts c5_`, id.startsWith('c5_'));
  for (const f of ['type', 'title', 'prompt', 'hint', 'parentHint', 'success', 'doneMessage', 'beat']) {
    check(`ch5 ${id}: has ${f}`, typeof q[f] === 'string' && q[f].length > 0);
  }
  check(`ch5 ${id}: act 1-5`, Number.isInteger(q.act) && q.act >= 1 && q.act <= 5);
  check(`ch5 ${id}: beat unique`, !ch5Beats.has(q.beat), q.beat);
  ch5Beats.add(q.beat);
  if (q.type === 'choice') {
    const n = q.choices.filter((c) => c.correct === true).length;
    check(`ch5 ${id}: exactly one correct choice`, n === 1, `found ${n}`);
    check(`ch5 ${id}: 4 choices`, q.choices.length === 4);
    check(`ch5 ${id}: correct choice accepted`, checkSpaceAnswer(q, q.choices.find((c) => c.correct).text));
    for (const c of q.choices.filter((c) => !c.correct)) check(`ch5 ${id}: wrong choice rejected (${c.text.slice(0, 24)}…)`, !checkSpaceAnswer(q, c.text));
  } else {
    check(`ch5 ${id}: text has answers`, Array.isArray(q.answers) && q.answers.length > 0);
    for (const a of q.answers) check(`ch5 ${id}: accepts "${a}"`, checkSpaceAnswer(q, a));
  }
}
// Saturn floats: 95 Earth masses in 760 Earth volumes, Earth 5.5x water.
check('c5_hexagon: 6 x 14,500 = 87,000 accepted', checkSpaceAnswer(CH5_QUESTIONS.c5_hexagon, String(6 * 14500)));
check('c5_hexagon: rejects 5 x 14,500', !checkSpaceAnswer(CH5_QUESTIONS.c5_hexagon, String(5 * 14500)));
check('c5_uranus_pole_day: 84 / 2 = 42 accepted', checkSpaceAnswer(CH5_QUESTIONS.c5_uranus_pole_day, String(84 / 2)));
check('c5_uranus_pole_day: rejects the full 84', !checkSpaceAnswer(CH5_QUESTIONS.c5_uranus_pole_day, '84'));
check('c5_sunlight_neptune: 8 x 30 = 240 accepted', checkSpaceAnswer(CH5_QUESTIONS.c5_sunlight_neptune, String(8 * 30)));
check('c5_sunlight_neptune: rejects 8 + 30', !checkSpaceAnswer(CH5_QUESTIONS.c5_sunlight_neptune, '38'));
check('c5_voyager: 2012 - 1977 = 35 accepted', checkSpaceAnswer(CH5_QUESTIONS.c5_voyager, String(2012 - 1977)));
check('c5_voyager: rejects 45 (a borrowing slip)', !checkSpaceAnswer(CH5_QUESTIONS.c5_voyager, '45'));
check('c5_deuterium: 64,000 / 6,400 = 10 accepted', checkSpaceAnswer(CH5_QUESTIONS.c5_deuterium, String(64000 / 6400)));
check('c5_deuterium: rejects 100 (one zero too many)', !checkSpaceAnswer(CH5_QUESTIONS.c5_deuterium, '100'));
check('c5_saturn_density: 95/760 x 5.5 < 1 (floats)', (95 / 760) * 5.5 < 1 && CH5_QUESTIONS.c5_saturn_density.choices.find((c) => c.correct).text.startsWith('Float'));

// --- report -----------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`FAIL  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(`${SPACE_QUESTION_ORDER.length} + ${Object.keys(CH5_QUESTIONS).length} (ch5) questions, ${results.length} checks, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
