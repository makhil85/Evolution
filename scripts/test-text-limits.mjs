// The words on screen in Chapters 4-7 stay short (lead 2026-10-09, F4-F8).
//
//   node scripts/test-text-limits.mjs
//
// The limits are src/play/readGate.js TEXT_LIMITS: a mission objective (14 words
// at Level 4, 10 at Level 1), a live action cue (8 / 6), and any other toast,
// card tip or message (25 / 15). Two scans:
//   - every step objective in the Chapter 4-7 chains, both Levels: the chains
//     are built through Vite, so the Level's own wording is what is counted;
//   - every setCue cue, toast, card tip and other t() line in the source files
//     the space-words work owns (read as text: a small tokenizer finds the call
//     sites, and each t(Level 4, Level 1) pair is counted at its own Level).
// A text that truly cannot shrink goes in EXCEPTIONS below, with the reason.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { TEXT_LIMITS } from '../src/play/readGate.js';
import { wordCount } from '../src/play/readTime.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Texts allowed over their limit: { file, text (a part of it), reason }. Keep it empty if you can. */
const EXCEPTIONS = [];

// --- the step chains, built through Vite at each Level -----------------------

/** Every step objective of one chapter at one Level (4 or 1). */
async function chainObjectives(chapter, level) {
  globalThis.document = { documentElement: { dataset: { chapter: String(chapter) } } };
  globalThis.localStorage = {
    getItem: (k) => (k === 'rocket_village_profile' && level === 1 ? JSON.stringify({ difficulty: 1 }) : null),
    setItem() {}, removeItem() {},
  };
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    // A stand-in game: steps are only built here, never entered.
    const game = { hud: new Proxy({}, { get: () => () => Promise.resolve() }), bus: { on() {}, emit() {} }, missions: {}, customTargets: {}, resources: {}, states: {}, ship: {} };
    let steps;
    if (chapter === 4) {
      steps = [];
      for (const i of [1, 2, 3, 4, 5]) {
        const mod = await vite.ssrLoadModule(`/src/space/acts/act${i}.js`);
        steps.push(...mod[`act${i}Steps`](game));
      }
    } else {
      const mod = await vite.ssrLoadModule(`/src/space/ch${chapter}/steps.js`);
      steps = mod[`ch${chapter}Steps`](game);
    }
    return steps.map((s) => ({ where: `ch${chapter} ${s.id}`, text: s.objective || '' }));
  } finally {
    await vite.close();
  }
}

// --- the source files this work owns ------------------------------------------

function listDir(dir, re) {
  return readdirSync(`${ROOT}src/space/${dir}`).filter((f) => re.test(f)).map((f) => `src/space/${dir}/${f}`);
}

/** The files whose words this work shortens (their call sites are read as text). */
function ownedFiles() {
  return [
    ...listDir('acts', /\.js$/),
    ...listDir('ch5', /^(?!questions).*\.js$/),
    ...listDir('ch6', /^(part.*|quests|stations|routePlanner|slingshot)\.js$/),
    ...listDir('ch7', /^(part.*|tasks|floatGame|dropTest|lensGame)\.js$/),
    'src/space/main.js',
  ];
}

/** A small JS tokenizer: identifiers, punctuation and string text (template ${...} become a 0). */
function tokenize(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '\'' || c === '"') {
      let j = i + 1; let v = '';
      while (j < n && src[j] !== c) { if (src[j] === '\\') { v += src[j + 1]; j += 2; } else v += src[j++]; }
      out.push({ k: 'str', v, variants: [], pos: i });
      i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1; let v = ''; const parts = []; // parts: text, ${code}, text, ...
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { v += src[j + 1]; j += 2; } else if (src[j] === '$' && src[j + 1] === '{') {
          const start = j + 2; let d = 0; j++;
          for (; j < n; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
          parts.push(v, src.slice(start, j)); v = ''; j++;
        } else v += src[j++];
      }
      parts.push(v);
      out.push(templateToken(parts, i));
      i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; out.push({ k: 'id', v: src.slice(i, j), pos: i }); i = j; continue; }
    if ('()[]{},:?.'.includes(c)) { out.push({ k: 'p', v: c, pos: i }); i++; continue; }
    i++;
  }
  return out;
}

/** The index of the bracket closing each open bracket (and the reverse), or -1. */
function bracketPairs(tokens) {
  const match = new Array(tokens.length).fill(-1);
  const stack = [];
  tokens.forEach((tk, i) => {
    if (tk.k !== 'p') return;
    if ('([{'.includes(tk.v)) stack.push(i);
    else if (')]}'.includes(tk.v)) { const o = stack.pop(); if (o !== undefined) { match[o] = i; match[i] = o; } }
  });
  return match;
}

/** For each token, the name of the call it sits in (the nearest open '(' and its callee). */
function callNames(tokens) {
  const names = new Array(tokens.length).fill('');
  const stack = []; // { ch, name }
  tokens.forEach((tk, i) => {
    const top = stack.findLast((f) => f.ch === '(');
    names[i] = top ? top.name : '';
    if (tk.k !== 'p') return;
    if ('([{'.includes(tk.v)) {
      const prev = tokens[i - 1];
      stack.push({ ch: tk.v, name: tk.v === '(' && prev?.k === 'id' ? prev.v : '' });
    } else if (')]}'.includes(tk.v)) stack.pop();
  });
  return names;
}

/** The [start, end) token ranges of the top-level comma-separated items between open and close. */
function splitArgs(tokens, open, close) {
  const args = [];
  let start = open + 1; let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const tk = tokens[i];
    if (tk.k !== 'p') continue;
    if ('([{'.includes(tk.v)) depth++;
    else if (')]}'.includes(tk.v)) depth--;
    else if (tk.v === ',' && depth === 0) { args.push([start, i]); start = i + 1; }
  }
  if (close > start) args.push([start, close]);
  return args;
}

/** A template literal: its text with each ${...} counted as one word, plus one variant per quoted choice
 *  inside a ${...} (a ternary's branch), so each branch is counted as the text a child would see. */
function templateToken(parts, pos) {
  const render = (over) => parts.map((p, k) => (k % 2 === 0 ? p : (over && over.k === k ? over.text : ' 0 '))).join('');
  const variants = [];
  parts.forEach((p, k) => {
    if (k % 2 === 0) return;
    for (const m of p.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) variants.push(render({ k, text: m[1] ?? m[2] }));
  });
  return { k: 'str', v: render(null), variants, pos };
}

/** The texts a token range can show: its string pieces joined, or each variant of one template string. */
function textsOf(tokens, [s, e]) {
  const strs = [];
  for (let i = s; i < e; i++) if (tokens[i].k === 'str') strs.push(tokens[i]);
  if (!strs.length) return [];
  if (strs.length === 1) return [strs[0].v, ...strs[0].variants];
  return [strs.map((t) => t.v).join(' ')];
}

const CUE_CALLS = new Set(['setCue', 'burnCue', 'cue']);
const TEXT_ARG = { toast: 0, setCue: 1, burnCue: 1, cue: 1 };

/** Every text the source files show, with its kind and where it is. */
function sourceTexts() {
  const found = [];
  for (const file of ownedFiles()) {
    const src = readFileSync(`${ROOT}${file}`, 'utf8');
    const tokens = tokenize(src);
    const match = bracketPairs(tokens);
    const names = callNames(tokens);
    const line = (pos) => src.slice(0, pos).split('\n').length;
    const inT = new Array(tokens.length).fill(false);
    const add = (i, text, kind, level) => found.push({ file, line: line(tokens[i].pos), text, kind, level });

    // t(Level 4, Level 1): each wording at its own Level's limit.
    tokens.forEach((tk, i) => {
      if (tk.k !== 'id' || tk.v !== 't' || tokens[i + 1]?.v !== '(') return;
      const open = i + 1; const close = match[open];
      for (let j = open; j <= close; j++) inT[j] = true;
      const args = splitArgs(tokens, open, close);
      const kind = CUE_CALLS.has(names[i]) ? 'cue'
        : tokens[i - 1]?.v === ':' && tokens[i - 2]?.v === 'objective' ? 'objective' : 'message';
      if (args[0]) for (const x of textsOf(tokens, args[0])) add(args[0][0], x, kind, args[1] ? 4 : 1);
      if (args[1]) for (const x of textsOf(tokens, args[1])) add(args[1][0], x, kind, 1);
    });

    // A toast or cue text written without t(): it shows at both Levels, so the Level 1 limit applies.
    tokens.forEach((tk, i) => {
      if (tk.k !== 'id' || !(tk.v in TEXT_ARG) || tokens[i + 1]?.v !== '(') return;
      const open = i + 1; const args = splitArgs(tokens, open, match[open]);
      const arg = args[TEXT_ARG[tk.v]];
      if (!arg) return;
      for (let j = arg[0]; j < arg[1]; j++) {
        if (tokens[j].k === 'str' && !inT[j]) {
          for (const x of [tokens[j].v, ...tokens[j].variants]) add(j, x, CUE_CALLS.has(tk.v) ? 'cue' : 'message', 1);
        }
      }
    });

    // A [Level 4, Level 1] pair of texts (card tips, quest lines): both are messages.
    tokens.forEach((tk, i) => {
      if (tk.k !== 'p' || tk.v !== '[' || inT[i]) return;
      const args = splitArgs(tokens, i, match[i]);
      if (args.length !== 2 || args.some(([s, e]) => e - s !== 1 || tokens[s].k !== 'str')) return;
      add(args[0][0], tokens[args[0][0]].v, 'message', 4);
      add(args[1][0], tokens[args[1][0]].v, 'message', 1);
    });
  }
  return found;
}

// --- the checks ------------------------------------------------------------------

const results = { checked: 0, over: [] };
const counts = { objective: 0, cue: 0, message: 0 };

function check(where, text, kind, level) {
  results.checked++;
  counts[kind] = (counts[kind] || 0) + 1;
  const limit = TEXT_LIMITS[kind][level];
  const words = wordCount(text);
  if (words <= limit) return;
  if (EXCEPTIONS.some((e) => where.includes(e.file) && text.includes(e.text))) return;
  results.over.push({ where, kind, level, limit, words, text });
}

console.log('step objectives, both Levels');
for (const level of [4, 1]) {
  for (const chapter of [4, 5, 6, 7]) {
    const steps = await chainObjectives(chapter, level);
    for (const s of steps) check(`${s.where} (Level ${level})`, s.text, 'objective', level);
  }
}

console.log('cues, toasts, tips and messages in the owned source files');
for (const f of sourceTexts()) check(`${f.file}:${f.line}`, f.text, f.kind, f.level);

for (const v of results.over) {
  console.log(`  FAIL ${v.where}: ${v.kind} ${v.words} words, Level ${v.level} limit ${v.limit}\n       ${v.text}`);
}
console.log(`\n${results.checked} texts checked (objectives ${counts.objective}, cues ${counts.cue}, messages ${counts.message}); ${results.over.length} over their limit`);
if (results.over.length) process.exit(1);
console.log('  ok  every text is within its word limit');
