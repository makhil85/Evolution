#!/usr/bin/env node
/**
 * Generate the parent's answer key from the game itself.
 *
 * Written as a GENERATOR rather than a hand-kept document on purpose: an answer
 * key that drifts from the questions is worse than none at all, because the
 * adult trusts it. Everything below is read from `questions.js` and
 * `quests.js`, so the key cannot disagree with what the child is asked.
 *
 *   node scripts/answer-key.mjs     (or: npm run answer-key)
 *
 * Writes both docs/ANSWER_KEY.md and docs/answer-key.html — the page is the
 * same data substituted into scripts/answer-key.template.html.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../src/game/questions.js';
import { QUEST_CHAIN } from '../src/game/quests.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Human names for the station ids the steps reference. */
const STATION_NAME = {
  missionSchool: 'Mission School',
  materialsForge: 'Materials Lab',
  waterLab: 'River Flow Lab',
  windTunnel: 'Wind Tunnel',
  scienceCenter: 'Science Center',
  fuelDepot: 'Fuel Depot',
  guidanceTower: 'Guidance Tower',
  observatory: 'Observatory',
  rocketPad: 'Launch Pad',
};

/** The answer, as the child would have to give it. */
function answerOf(q) {
  if (q.type === 'choice') {
    const right = (q.choices || []).find((c) => c.correct);
    return right ? right.text : '(no correct choice marked)';
  }
  return (q.answers || [])[0] ?? '(no answer listed)';
}

/** Every other spelling the grader accepts, so a parent can stop arguing. */
function alsoAccepted(q) {
  if (q.type !== 'text') return [];
  return (q.answers || []).slice(1);
}

function wrongOptions(q) {
  if (q.type !== 'choice') return [];
  return (q.choices || []).filter((c) => !c.correct).map((c) => c.text);
}

/** Walk the chain in play order, so the key matches the order she meets them. */
function rows() {
  const steps = QUEST_CHAIN
    .filter((s) => s.questionId && QUESTIONS[s.questionId])
    .sort((a, b) => a.order - b.order);
  return steps.map((step) => ({ step, q: QUESTIONS[step.questionId] }));
}

function markdown() {
  const all = rows();
  const main = all.filter((r) => !r.step.optional);
  const bonus = all.filter((r) => r.step.optional);

  const out = [];
  out.push('# Rocket Village — Answer Key');
  out.push('');
  out.push('For the adult sitting next to her. Generated from the game, so it cannot');
  out.push('drift from what she is actually asked: run `node scripts/answer-key.mjs`');
  out.push('to rebuild it after any change to the questions.');
  out.push('');
  out.push(`**${main.length} questions on the main path** — these gate progress.  `);
  out.push(`**${bonus.length} bonus puzzles** — extra practice, gate nothing, pay in supplies.`);
  out.push('');
  out.push('Wrong answers cost nothing and are always retryable. There is no timer, no');
  out.push('attempt limit and no penalty anywhere in the game — so the useful thing to do');
  out.push('when she is stuck is ask the question in the **Ask her** line, not to give her');
  out.push('the answer.');
  out.push('');
  out.push('---');
  out.push('');

  const section = (title, list, note) => {
    out.push(`## ${title}`);
    out.push('');
    if (note) { out.push(note); out.push(''); }
    out.push('| # | Question | Where | Answer |');
    out.push('|---|---|---|---|');
    list.forEach((r, i) => {
      const where = STATION_NAME[r.step.stationId] || r.step.stationId;
      out.push(`| ${i + 1} | ${r.q.title.replace(/★\s*/, '')} | ${where} | **${answerOf(r.q)}** |`);
    });
    out.push('');
  };

  section('The main path', main);
  section('Bonus puzzles', bonus,
    'A **violet** signpost in game means a station has one of these. Gold still means '
    + '"go here next", so following the gold markers never pulls her off the main path.');

  out.push('---');
  out.push('');
  out.push('## Every question in full');
  out.push('');

  for (const { step, q } of all) {
    const where = STATION_NAME[step.stationId] || step.stationId;
    out.push(`### ${step.optional ? '★ ' : ''}${q.title.replace(/★\s*/, '')}`);
    out.push('');
    out.push(`*${where} · ${q.subject} · ${q.difficulty}${step.optional ? ' · bonus, gates nothing' : ''}*`);
    out.push('');
    out.push(`> ${q.prompt}`);
    out.push('');
    out.push(`**Answer:** ${answerOf(q)}`);
    const also = alsoAccepted(q);
    if (also.length) out.push(`**Also accepted:** ${also.join(', ')}`);
    const wrong = wrongOptions(q);
    if (wrong.length) out.push(`**Other options shown:** ${wrong.join(' · ')}`);
    out.push('');
    out.push(`**Why:** ${q.success}`);
    out.push('');
    out.push(`**Ask her:** ${q.parentHint}`);
    out.push('');
  }

  return out.join('\n');
}

/** The same data, as a shape the HTML page can render. */
function json() {
  return rows().map(({ step, q }) => ({
    title: q.title.replace(/^★\s*/, '').replace(/^Step \d+ • /, '').replace(/^Bonus: /, ''),
    where: STATION_NAME[step.stationId] || step.stationId,
    subject: q.subject,
    difficulty: q.difficulty,
    optional: !!step.optional,
    prompt: q.prompt,
    answer: answerOf(q),
    also: alsoAccepted(q),
    wrong: wrongOptions(q),
    why: q.success,
    ask: q.parentHint,
  }));
}

const md = markdown();
await mkdir(path.join(ROOT, 'docs'), { recursive: true });
await writeFile(path.join(ROOT, 'docs/ANSWER_KEY.md'), md, 'utf8');
console.log(`docs/ANSWER_KEY.md — ${rows().length} questions, ${md.length} bytes`);

// The same key as a page, built by substituting the data into the template.
// `</script>` inside a JSON string would close the host <script> tag early, so
// the one sequence that can break out is escaped.
const template = await readFile(path.join(ROOT, 'scripts/answer-key.template.html'), 'utf8');
const payload = JSON.stringify(json()).replace(/<\//g, '<\\/');
await writeFile(path.join(ROOT, 'docs/answer-key.html'), template.replace('__DATA__', payload), 'utf8');
console.log(`docs/answer-key.html — ${template.replace('__DATA__', payload).length} bytes`);
