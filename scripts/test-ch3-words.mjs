// Chapter 3's words and people: a town of rocket builders, not a village.
//   node scripts/test-ch3-words.mjs
// Reads the Chapter 3 text files and checks that no line calls the place a
// village. Storage keys, the layout's file name and the "village.south" reveal
// id keep their old spelling on purpose, so those are allowed. Also checks that
// the crowd in villagers.js still has its four townsperson outfits (the file
// imports three.js and the browser-only village code, so it is read as text).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) passed++;
  else { failures.push(name); console.error(`FAIL: ${name}`); }
}

const TEXT_FILES = [
  'src/game/quests.js',
  'src/game/quests.level1.js',
  'src/game/questions.js',
  'src/game/questions.level1.js',
  'src/game/hunt.js',
];

// Spellings that stay: saved-game keys, the layout file name, and a reveal id.
const ALLOWED = [/rocket_village_/gi, /level3_rocket_village_/gi, /rocketVillageLayout/gi, /village\.south/gi];

for (const f of TEXT_FILES) {
  const bad = [];
  read(f).split('\n').forEach((line, i) => {
    const rest = ALLOWED.reduce((s, re) => s.replace(re, ''), line);
    if (/village/i.test(rest) || /\bsmith/i.test(line)) bad.push(i + 1);
  });
  ok(bad.length === 0, `${f}: no "village" or "smith" wording (lines ${bad.join(', ') || 'none'})`);
}

const people = read('src/game/villagers.js');
const outfits = people.match(/\{ shirt: 0x[0-9a-f]+/gi) || [];
ok(outfits.length === 4, `four townsperson outfits (got ${outfits.length})`);
for (const word of ['hardhat', 'labCoat', 'helmet', 'headset']) {
  ok(new RegExp(`'${word}'|labCoat`).test(people), `villagers.js has the ${word} look`);
}
ok(/group\.name = 'townspeople'/.test(people), 'the crowd group is named townspeople');

console.log(failures.length ? `ch3 words: ${failures.length} failed, ${passed} passed` : `ch3 words: all ${passed} checks passed`);
if (failures.length) process.exit(1);
