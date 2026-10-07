// npm run package: build the game and make it double-click playable.
//   dist/                  the built game + PLAY.bat, play.command,
//                          play-server.mjs, HOW-TO-PLAY.txt
//   release/RocketVillage.zip   the same, zipped (when this computer's tar
//                          can write zips: Windows 10+ and Mac can)
// Give people the zip; they unzip it and double-click PLAY.bat.
import { copyFileSync, chmodSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILES = ['play-server.mjs', 'PLAY.bat', 'play.command', 'HOW-TO-PLAY.txt'];
for (const f of FILES) copyFileSync(new URL(`./play/${f}`, import.meta.url), new URL(`../dist/${f}`, import.meta.url));
try { chmodSync(new URL('../dist/play.command', import.meta.url), 0o755); } catch { /* Windows */ }
console.log('Launchers copied into dist/.');

mkdirSync(new URL('../release/', import.meta.url), { recursive: true });
const zip = 'release/RocketVillage.zip';
rmSync(zip, { force: true });
// A real zip starts with "PK" (GNU tar on Linux writes a plain tar under
// any name, so check). Try the zip tool first, then tar.
const isZip = () => { try { return readFileSync(zip).subarray(0, 2).toString() === 'PK'; } catch { return false; } };
const tries = [['zip', ['-q', '-r', `../${zip}`, '.'], { cwd: 'dist' }], ['tar', ['-a', '-c', '-f', zip, '-C', 'dist', '.'], {}]];
for (const [cmd, args, opts] of tries) {
  try { execFileSync(cmd, args, { stdio: 'ignore', ...opts }); } catch { /* not here */ }
  if (isZip()) break;
  rmSync(zip, { force: true });
}
if (isZip()) console.log(`Made ${zip} (${(statSync(zip).size / 1048576).toFixed(1)} MB). Share that file.`);
else console.log('Could not zip here: zip the dist folder yourself (right-click > Send to > Compressed folder) and share that.');
