// Node test for the words Chapter 1-3 put on screen (no browser).
//   node scripts/test-ch123-text.mjs
// Lead 2026-10-09: too many words on screen during play. Limits come from
// src/play/readGate.js TEXT_LIMITS: a mission "Now" line (objective), a status
// (the text after the % in the bar) and any other toast or message (message).
// Each Level runs in its own process, because IS_LEVEL1 is read once at load.
// Covers: the quest chain, the build stages and the engine's lines
// (src/game/quests.js, quests.level1.js), the rules' lines after each step of a
// playthrough (science and city rules), and every literal in the Chapter 1-3
// files (hunt clues, rules, Newton's tree, play modes, pickups), taking each
// Level's side of t() / L() / level ternaries / {4, 1} objects.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..');
const LEVEL = Number(process.env.CH123_TEXT_LEVEL || 0);

// One process per Level.
if (!LEVEL) {
  let failed = 0;
  for (const level of [4, 1]) {
    const r = spawnSync(process.execPath, [SELF], {
      env: { ...process.env, CH123_TEXT_LEVEL: String(level) }, stdio: 'inherit',
    });
    if (r.status !== 0) failed += 1;
  }
  process.exit(failed ? 1 : 0);
}

// Places where a text is allowed over its limit: `where` substring -> reason.
const EXCEPTIONS = new Map([]);

const store = new Map([['rocket_village_profile', JSON.stringify({ difficulty: LEVEL, name: 'Zara' })]]);
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const { TEXT_LIMITS } = await import('../src/play/readGate.js');
const { wordCount } = await import('../src/play/readTime.js');

const checkedTexts = new Set();
const over = [];
/** Check one text against its kind's limit at this Level (each distinct text once). */
function check(where, kind, text) {
  if (typeof text !== 'string' || !text.trim()) return;
  const limit = TEXT_LIMITS[kind][LEVEL];
  const n = wordCount(text);
  const id = `${kind} ${text}`;
  if (checkedTexts.has(id)) return;
  checkedTexts.add(id);
  if (n <= limit) return;
  const excepted = [...EXCEPTIONS].find(([k]) => where.includes(k));
  if (excepted) return;
  over.push(`${where} [${kind} ${n}/${limit}] ${text}`);
}

// ---------------------------------------------------------------------------
// 1. Quest chain, stages and engine lines (quests.js and its Level 1 overlay)
// ---------------------------------------------------------------------------
const quests = await import('../src/game/quests.js');
/** A behaviour check: records a failure in the same list as an over-long text. */
const must = (cond, where) => { if (!cond) over.push(`${where} [behaviour]`); };
const overlay = await import('../src/game/quests.level1.js');

for (const s of quests.QUEST_CHAIN) {
  check(`${s.id} mission`, 'objective', s.missionText);
  check(`${s.id} status`, 'status', s.statusText);
  check(`${s.id} locked`, 'message', s.lockedMessage);
  check(`${s.id} title`, 'message', s.title);
  for (const e of s.effects) check(`${s.id} done ${e.targetId}`, 'message', e.doneMessage);
}
for (const st of quests.ROCKET_STAGES) {
  check(`stage ${st.id} title`, 'message', st.title);
  check(`stage ${st.id} built`, 'message', st.builtMessage);
}

const fresh = quests.createQuestEngine(quests.defaultSave());
check('engine start mission', 'objective', fresh.missionCard().now);
check('engine locked build', 'message', fresh.build('build_foundation').message);
check('engine launch refused', 'message', fresh.launch().message);
check('engine collect', 'message', fresh.collect('wood').message);
check('engine shortfall (2 kinds)', 'message', quests.shortfallMessage({ iron: 4, wood: 2 }));
check('engine shortfall (3 kinds)', 'message', quests.shortfallMessage({ gems: 4, rocketParts: 2, fuel: 2 }));
check('engine shortfall (wood and stone)', 'message', quests.shortfallMessage({ wood: 6, stone: 6 }));
// The logs-and-rocks note is for wood and stone only.
must(quests.shortfallMessage({ wood: 6, stone: 6 }).endsWith('Logs and rocks: on the path.'), 'shortfall names the logs and rocks for wood and stone');
must(!quests.shortfallMessage({ gems: 4, fuel: 2 }).includes('on the path'), 'shortfall adds no logs note for gems and fuel');
check('engine station (start)', 'message', fresh.stationMessage('missionSchool'));
check('engine supply drop', 'message', quests.createQuestEngine({
  ...quests.defaultSave(), completedSteps: ['step_cadet', 'step_blueprint', 'step_frame'],
  inventory: { ...quests.defaultSave().inventory, wood: 0, stone: 0 },
}).supplyDrops({ wood: 0, stone: 0 })[0]?.message);
// The ★ bonus line shows once the engine test is done; the flown card after the last step.
const bonusOpen = quests.createQuestEngine({
  ...quests.defaultSave(),
  completedSteps: ['step_cadet', 'step_blueprint', 'step_frame', 'build_foundation', 'step_flow', 'step_drag', 'build_body', 'step_thrust'],
});
check('engine bonus line', 'message', bonusOpen.missionCard().bonus);
if (LEVEL === 1) check('bonus line (Level 1 overlay)', 'message', overlay.BONUS_LINE_L1);
const flown = quests.createQuestEngine({ ...quests.defaultSave(), completedSteps: quests.QUEST_CHAIN.map((s) => s.id) });
check('engine flown card', 'objective', flown.missionCard().now);

// ---------------------------------------------------------------------------
// 2. Rules: every line a playthrough shows (science and city)
// ---------------------------------------------------------------------------
/** A Storage stand-in that lives in a Map. */
function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** Every string a rules object says right now, by kind (mission lines are objectives). */
function snapshot(name, r, questIds, tag) {
  const where = `${name} ${tag}`;
  r.missionLines().forEach((line, i) => check(`${where} mission line ${i}`, i === 0 ? 'objective' : 'message', line));
  check(`${where} status`, 'status', r.progress().status);
  check(`${where} recipe`, 'message', r.recipeText());
  for (const q of questIds) {
    const o = r.openQuest(q);
    if (!o.ok) check(`${where} open ${q}`, 'message', o.text);
  }
  for (const [k, v] of Object.entries(r.text)) {
    if (typeof v === 'string') check(`${where} text.${k}`, 'message', v);
    else if (typeof v === 'function') {
      for (const arg of [undefined, questIds[0], 'key', 'bridge']) {
        try { const s = v(arg); if (typeof s === 'string') check(`${where} text.${k}`, 'message', s); } catch { /* arity */ }
      }
    }
  }
}

/**
 * The text a rules object adds around a question's success line. The bank's own
 * "Correct. ..." line (the question banks, questions.js) is not ours to shorten,
 * so only the words the rules add are counted.
 */
const ownWords = (text, bank, q) => {
  const success = bank[q]?.success;
  return typeof text === 'string' && success && text.startsWith(success) ? text.slice(success.length).trim() : text;
};

/** Play a rules object from a fresh save in the given quest order. */
function playthrough(name, make, questIds, pickups, finish, order, bank) {
  const r = make();
  snapshot(name, r, questIds, `${order} start`);
  for (const p of pickups) {
    const res = r.collect(p.id);
    if (res?.text) check(`${name} pickup ${p.id}`, 'message', res.text);
  }
  r.setHuntRequired(true);
  check(`${name} hunt needed`, 'message', finish(r).text);
  r.setHuntRequired(false);
  const pending = [...questIds];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const q of [...pending]) {
      const res = r.solveQuest(q);
      if (!res) continue;
      progressed = true;
      pending.splice(pending.indexOf(q), 1);
      check(`${name} solved ${q}`, 'message', ownWords(res.text, bank, q));
      check(`${name} solved ${q} done`, 'message', res.doneMessage);
      snapshot(name, r, questIds, `${order} after ${q}`);
    }
  }
  const built = finish(r);
  check(`${name} build`, 'message', built.text);
  check(`${name} build done`, 'message', built.doneMessage);
  snapshot(name, r, questIds, `${order} end`);
}

const { createScienceRules } = await import('../src/science/rules.js');
const sciLayout = await import('../src/science/layout.js');
const sciQuestIds = (await import('../src/science/contracts.js')).QUEST_IDS;
const cityRules = await import('../src/city/rules.js');
const cityLayout = await import('../src/city/layout.js');
const cityContracts = await import('../src/city/contracts.js');

const sciIds = sciQuestIds;
const cityIds = cityContracts.QUEST_IDS[LEVEL];
const sciBank = (await import('../src/science/questions.js')).questionsFor(LEVEL);
const cityBank = (await import('../src/city/questions.js')).questionsFor(LEVEL);
const sciMake = () => createScienceRules({ level: LEVEL, storage: memStore() });
const cityMake = () => cityRules.createCityRules({ level: LEVEL, storage: memStore() });
const sciFinish = (r) => r.startBuild();
const cityFinish = (r) => r.startWorkshop();

playthrough('ch1', sciMake, sciIds, sciLayout.PICKUPS, sciFinish, 'forward', sciBank);
playthrough('ch1', sciMake, [...sciIds].reverse(), sciLayout.PICKUPS, sciFinish, 'reverse', sciBank);
playthrough('ch2', cityMake, cityIds, cityLayout.PICKUPS, cityFinish, 'forward', cityBank);
playthrough('ch2', cityMake, [...cityIds].reverse(), cityLayout.PICKUPS, cityFinish, 'reverse', cityBank);

// ---------------------------------------------------------------------------
// 3. Every literal in the Chapter 1-3 files, at this Level
// ---------------------------------------------------------------------------
const FILES = [
  'src/science/rules.js', 'src/city/rules.js', 'src/city/newtonTree.js',
  'src/science/hunt.js', 'src/city/hunt.js', 'src/game/hunt.js', 'src/game/pickups.js',
  'src/play/modes.js', 'src/play/hunt.js', 'src/science/layout.js', 'src/city/layout.js',
  'src/science/main.js', 'src/city/main.js', 'src/gameScene.js',
];
const SKIP_CALLEE = /^(Error|TypeError|RangeError|warn|assert|querySelector|querySelectorAll|getElementById|setAttribute|addEventListener|fetch|import|log|error)$/;
const SKIP_KEYS = new Set(['id', 'className', 'class', 'style', 'href', 'src', 'role', 'kind', 'type', 'key', 'stationId',
  'questionId', 'targetId', 'buildId', 'stageId', 'icon', 'color', 'symbol', 'tag', 'name', 'stage', 'store']);
const CODEISH = /;|<\/?[a-z]|\bpx\b|rgba?\(|#[0-9a-f]{3,6}\b|=>|\bfunction\b|\bconst\b/i;
const isProse = (s) => (s.match(/\p{L}{2,}/gu) || []).length >= 2 && !CODEISH.test(s) && !/^[\w./-]+$/.test(s.trim());

/** The Level's prose strings in one file (t/L/two calls, level ternaries, {4, 1} objects, L1/L4 blocks). */
function literals(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const ast = parseAst(src, { lang: 'js' });
  const lineAt = (pos) => src.slice(0, pos).split('\n').length;
  const out = [];
  const add = (node, s) => { if (isProse(s)) out.push({ where: `${file}:${lineAt(node.start)}`, text: s }); };
  const strOf = (node) => {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '').join('{x}');
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const a = strOf(node.left); const b = strOf(node.right);
      return a != null || b != null ? `${a ?? '{x}'}${b ?? '{x}'}` : null;
    }
    return null;
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    switch (node.type) {
      case 'ImportDeclaration': case 'ExportAllDeclaration': return;
      case 'CallExpression': {
        const c = node.callee;
        const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : '';
        const obj = c.type === 'MemberExpression' ? c.object?.name : '';
        if (obj === 'console' || SKIP_CALLEE.test(name)) return;
        if (['t', 'L', 'two'].includes(name) && node.arguments.length >= 2) {
          const l1 = node.arguments[1];
          // A null Level 1 side falls back to the Level 4 text.
          const useL1 = LEVEL === 1 && !(l1.type === 'Literal' && l1.value == null);
          visit(useL1 ? l1 : node.arguments[0]);
          return;
        }
        break;
      }
      case 'NewExpression': if (/Error$/.test(node.callee?.name || '')) return; break;
      case 'VariableDeclarator': {
        const n = node.id?.name || '';
        if (/^(L1|LEVEL_1)$/.test(n) && LEVEL !== 1) return;
        if (/^(L4|LEVEL_4)$/.test(n) && LEVEL === 1) return;
        break;
      }
      case 'ConditionalExpression': {
        const test = src.slice(node.test.start, node.test.end).replace(/\s+/g, '');
        if (/^(level|LEVEL|lvl)===1$|^IS_L(EVEL)?1$/.test(test)) { visit(LEVEL === 1 ? node.consequent : node.alternate); return; }
        if (/^(level|LEVEL|lvl)!==1$|^!IS_L(EVEL)?1$/.test(test)) { visit(LEVEL === 1 ? node.alternate : node.consequent); return; }
        break;
      }
      case 'ObjectExpression': {
        const keyOf = (p) => p.key?.name ?? String(p.key?.value);
        const keys = new Set(node.properties.filter((p) => p.type === 'Property').map(keyOf));
        for (const p of node.properties) {
          if (p.type !== 'Property') { visit(p); continue; }
          const k = keyOf(p);
          if (keys.has('4') && keys.has('1')) { if (k === String(LEVEL)) visit(p.value); continue; }
          if (/L1$/.test(k) && keys.has(k.slice(0, -2))) { if (LEVEL === 1) visit(p.value); continue; }
          if (keys.has(`${k}L1`)) { if (LEVEL !== 1) visit(p.value); continue; }
          if (SKIP_KEYS.has(k)) continue;
          visit(p.value);
        }
        return;
      }
      case 'Literal': if (typeof node.value === 'string') add(node, node.value); return;
      case 'TemplateLiteral': add(node, strOf(node)); node.expressions.forEach(visit); return;
      case 'BinaryExpression':
        if (node.operator === '+' && strOf(node) != null) { add(node, strOf(node)); return; }
        break;
      default: break;
    }
    for (const k of Object.keys(node)) if (k !== 'type' && k !== 'start' && k !== 'end') visit(node[k]);
  };
  visit(ast.body);
  return out;
}

for (const file of FILES) {
  for (const { where, text } of literals(file)) check(where, 'message', text);
}

// ---------------------------------------------------------------------------
const checked = checkedTexts.size;
if (over.length) {
  for (const line of over) console.error(`FAIL: ${line}`);
  console.error(`  ${over.length} of ${checked} texts over the limit at Level ${LEVEL}`);
  process.exit(1);
}
console.log(`  ok  every text is within its limit at Level ${LEVEL} (${checked} checked)`);
