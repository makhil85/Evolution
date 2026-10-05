// Level 1 reading check: is what a Level 1 child reads easy for a 2nd grader?
//
//   node scripts/check-reading.mjs            # report: every hard line, by file
//   node scripts/check-reading.mjs --strict   # also exit 1 if any line is hard
//
// Lead 2026-10-05: "make sure level1 all chapters is readable by 2nd grade kid"
// and "check the question English simpler for level1".
//
// What a Level 1 child reads comes from two places:
//   - the question banks, loaded here at Level 1 exactly as the game loads
//     them (overlays merged), and
//   - text in the code: the Level 1 side of every t(level4, level1), and any
//     other sentence in a chapter's files that both Levels see.
// Code is read as an AST (rolldown's parser, already installed with Vite), so
// comments, console lines and errors don't count.
//
// A line is HARD when a sentence is longer than 14 words, or uses a long word
// (3+ syllables) that is not on the everyday list below (game words a child
// meets again and again, like "rocket" or "Jupiter", are fine), or the whole
// line scores above grade 3 on Flesch-Kincaid. Parent notes are skipped: a
// grown-up reads those.
import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rolldown/parseAst';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STRICT = process.argv.includes('--strict');

// Level 1 profile before any bank is imported (they read it once, at load).
const store = new Map([['rocket_village_profile', JSON.stringify({ difficulty: 1, name: 'Zara' })]]);
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

// --- scoring ------------------------------------------------------------------------

/** Long words a 2nd grader in this game knows (science and game names). */
const EASY = new Set(`
  rocket rockets jupiter europa asteroid asteroids astronaut astronauts mission
  gravity oxygen engineer engineers energy volcano satellite satellites telescope
  dinosaur banana bananas animal animals family elephant elephants dinosaurs
  computer video camera tomato potato potatoes umbrella hospital library pizza
  another everything everyone anything anyone everybody somebody nobody
  together remember yesterday tomorrow already eleven seven seventeen seventy
  beautiful favourite favorite celebrate different important wonderful amazing
  started finished buildings building planet planets understand underneath
  alexandria archimedes eratosthenes syene greece egypt mia zara cadet
  hexagon triangle triangles pentagon octagon rectangle rectangles diamonds
  centimetres centimeters kilometres kilometers minutes seconds hundred hundreds
  thousand eleven twenty thirty forty fifty sixty eighty ninety
  experiment experiments scientist scientists material materials
  calendar memory memories radio idea ideas area metal metals crystal crystals
  number numbers numbered whatever however anywhere everywhere
  wobbles wobbling travelled traveled travelling traveling carefully
  backwards forwards underwater waterfall ladder ladders recipe recipes
  protein proteins ribosome cellular dna
  spaceship spaceships lollipop lemonade honeybee firework fireworks
  medium level levels village villages engine engines mountain mountains
  water waters flower flowers tower towers power powered silver
  battery batteries canoe canoes kangaroo kangaroos
  moonwalk midnight middle little bottle bottles circle circles
  collect collected collecting every everything usually careful carefully forever
  exactly somewhere direction directions opposite clockwise animals family
  difficult following holiday hamburger potato banana tomorrow nobody anybody
  camera lemonade magazine pyjamas pajamas cinema dinosaur gorilla
  happily easily quickly finally really actually suddenly
  pattern patterns answer answers question questions
  open opens opened unlock unlocked unlocks
  eureka skateboard sideways whenever wherever
  engineering continue something counterclockwise anticlockwise
`.split(/\s+/).filter(Boolean));

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const v = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, v ? v.length : 1);
}

const WORD = /[A-Za-z][A-Za-z’'-]*/g;

/** Why `text` is hard for a 2nd grader, or [] when it is fine. */
export function hardness(text) {
  const clean = String(text).replace(/\{[^}]*\}/g, 'it').replace(/<[^>]+>/g, ' ');
  const sentences = clean.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const why = [];
  let words = 0; let syl = 0;
  for (const s of sentences) {
    const ws = s.match(WORD) || [];
    words += ws.length;
    for (const w of ws) syl += syllables(w);
    if (ws.length > 14) why.push(`${ws.length} words in one sentence`);
  }
  const long = new Set();
  for (const w of clean.match(WORD) || []) {
    const lw = w.toLowerCase().replace(/[’'](s|t|re|ll|ve|d)$/, '');
    if (syllables(lw) >= 3 && !EASY.has(lw) && !/^[A-Z]{2,}$/.test(w)) long.add(lw);
  }
  if (long.size) why.push(`long words: ${[...long].join(', ')}`);
  if (words >= 12 && sentences.length) {
    const fk = 0.39 * (words / sentences.length) + 11.8 * (syl / words) - 15.59;
    if (fk > 3) why.push(`grade ${fk.toFixed(1)}`);
  }
  return why;
}

// --- the banks, at Level 1 ------------------------------------------------------------

const SKIP_KEYS = new Set(['id', 'stationId', 'type', 'kind', 'icon', 'beat', 'symbol', 'color', 'quest', 'answers', 'answer',
  'parentHint', 'parent', 'parents', 'parentNote', 'tiles', 'unit', 'key', 'store', 'href', 'reward', 'rewards', 'giver']);

function walk(value, where, out, seen = new Set()) {
  if (typeof value === 'string') { out.push({ where, text: value }); return; }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${where}[${i}]`, out, seen)); return; }
  for (const [k, v] of Object.entries(value)) {
    if (SKIP_KEYS.has(k) || /^parent/i.test(k) || typeof v === 'function') continue;
    walk(v, `${where}.${k}`, out, seen);
  }
}

async function bankLines() {
  const out = [];
  const sci = await import('../src/science/questions.js');
  walk(sci.questionsFor(1), 'ch1 questions', out);
  const city = await import('../src/city/questions.js');
  walk(city.questionsFor(1), 'ch2 questions', out);
  const ch3 = await import('../src/game/questions.js');
  walk(ch3.QUESTIONS, 'ch3 questions', out);
  const sp = await import('../src/space/questions.space.js');
  walk(sp.level1Bank(), 'ch4 questions', out);
  for (const [file, ch] of [['../src/science/hunt.js', 'ch1 hunt'], ['../src/city/hunt.js', 'ch2 hunt'], ['../src/game/hunt.js', 'ch3 hunt']]) {
    const m = await import(file);
    const fn = Object.values(m).find((f) => typeof f === 'function' && /huntFor|For$/.test(f.name));
    if (fn) walk(fn(1), ch, out);
  }
  return out;
}

// --- text in the code -------------------------------------------------------------------

/** Files whose sentences a Level 1 child can see (banks are read above). */
const CODE_DIRS = ['src/science', 'src/city', 'src/game', 'src/play', 'src/space', 'src/lesson', 'src/launcher'];
const CODE_FILES = ['src/gameScene.js'];
const SKIP_FILE = /(\/lab\/|questions(\.level1|\.space)?\.js$|\/hunt\.js$|launcher\/profile\.js$|contracts\.js$)/;

function listFiles() {
  const files = [...CODE_FILES];
  const rec = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) rec(p);
      else if (p.endsWith('.js') && !SKIP_FILE.test(p)) files.push(p);
    }
  };
  CODE_DIRS.forEach(rec);
  return files;
}

const prose = (s) => /[a-z]/.test(s) && /\s/.test(s.trim()) && (s.match(WORD) || []).length >= 3 && !/^[\w.-]+\/[\w./-]+$/.test(s)
  && !/sans-serif|[{};=]|=>|\$\{?[a-z]+\.|^\s*[.#][a-z-]+\s*\{|rgba?\(|px\b|^\s*(const|let|import)\b/.test(s);

function strOf(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('{x}');
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const a = strOf(node.left); const b = strOf(node.right);
    return a != null || b != null ? `${a ?? '{x}'}${b ?? '{x}'}` : null;
  }
  return null;
}

function codeLines(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let ast;
  try { ast = parseAst(src, { lang: 'js' }); } catch { return []; }
  const lineAt = (pos) => src.slice(0, pos).split('\n').length;
  const out = [];
  const visit = (node, ctx) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, ctx)); return; }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      const name = callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' ? callee.property?.name : '';
      const obj = callee.type === 'MemberExpression' ? callee.object?.name : '';
      if (obj === 'console' || /^(Error|TypeError|RangeError|warn|assert|querySelector|querySelectorAll|getElementById|setAttribute|addEventListener|fetch|import)$/.test(name)) return;
      if ((name === 't' || name === 'two' || name === 'L') && node.arguments.length >= 2) {
        // Only the Level 1 side; a null Level 1 falls back to the Level 4 text.
        const l1 = node.arguments[1];
        visit(l1 && !(l1.type === 'Literal' && l1.value == null) ? l1 : node.arguments[0], { ...ctx, inT: true });
        return;
      }
    }
    // `level === 1 ? a : b` (and LEVEL, lvl, IS_LEVEL1): Level 1 reads `a`.
    if (node.type === 'ConditionalExpression') {
      const test = src.slice(node.test.start, node.test.end).replace(/\s+/g, '');
      if (/^(level|LEVEL|lvl)===1$|^IS_LEVEL1$/.test(test)) { visit(node.consequent, ctx); return; }
      if (/^(level|LEVEL|lvl)!==1$|^!IS_LEVEL1$|^(level|LEVEL|lvl)===4$/.test(test)) { visit(node.alternate, ctx); return; }
    }
    // Lessons write every line as a [Level 4, Level 1] pair: Level 1 reads [1].
    if (node.type === 'ArrayExpression' && file.startsWith('src/lesson/') && node.elements.length === 2
      && node.elements.every((e) => e && (strOf(e) != null || (e.type === 'Literal' && e.value == null)))) {
      const l1 = node.elements[1];
      visit(l1.type === 'Literal' && l1.value == null ? node.elements[0] : l1, ctx);
      return;
    }
    if (node.type === 'NewExpression' && /Error$/.test(node.callee?.name || '')) return;
    if (node.type === 'Property' || node.type === 'ObjectExpression') {
      if (node.type === 'ObjectExpression') {
        // { 4: '...', 1: '...' } and { blurb, blurbL1 }: Level 1 reads the 1 side.
        const keys = new Set(node.properties.map((p) => p.key?.name ?? String(p.key?.value)));
        for (const p of node.properties) {
          const k = p.key?.name ?? String(p.key?.value);
          if ((k === '4' && keys.has('1')) || (keys.has(`${k}L1`)) || /^parent/i.test(k) || ['id', 'className', 'class', 'style', 'href', 'src', 'role', 'kind', 'type', 'key'].includes(k)) continue;
          visit(p.value, ctx);
        }
        return;
      }
    }
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return;
    const s = strOf(node);
    if (s != null) {
      if (prose(s)) out.push({ where: `${file}:${lineAt(node.start)}`, text: s });
      return;
    }
    for (const k of Object.keys(node)) if (k !== 'type' && k !== 'start' && k !== 'end') visit(node[k], ctx);
  };
  visit(ast.body, {});
  return out;
}

// --- go -----------------------------------------------------------------------------------

const all = [...await bankLines()];
for (const f of listFiles()) all.push(...codeLines(f));
const seenText = new Set();
const hard = [];
for (const line of all) {
  const key = line.text.trim();
  if (!key || seenText.has(key)) continue;
  seenText.add(key);
  const why = hardness(key);
  if (why.length) hard.push({ ...line, why });
}
let lastFile = '';
for (const h of hard) {
  const file = h.where.replace(/[:\[.].*$/, '').replace(/ (questions|hunt).*/, ' $1');
  if (file !== lastFile) { console.log(`\n## ${file}`); lastFile = file; }
  console.log(`- ${h.where}  [${h.why.join('; ')}]\n    ${h.text.replace(/\s+/g, ' ').slice(0, 300)}`);
}
console.log(`\n${seenText.size} Level 1 lines read, ${hard.length} hard for a 2nd grader.`);
if (STRICT && hard.length) process.exit(1);
