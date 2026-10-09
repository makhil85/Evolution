// Lab only: Chapter 3 building views for the buildings pass. Opens chapter3.html
// in headless Chromium (software GL), freezes the chase camera, frames fixed
// views of the town and saves each frame as a PNG, then reports the renderer's
// draw calls and triangles, and the triangles each building and home costs.
//
//   node scripts/lab-ch3-buildings.mjs <port> <outDir>
//
// Not part of `npm test` (it needs a browser and a running dev server). The
// frames are read by eye; the numbers print to stdout.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [port = '5173', outDir = 'lab-ch3-buildings'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// Camera and look-at points in world units (the hub is at 0,25; the launch pad at 22,-43).
const VIEWS = [
  { name: 'square', cam: [0, 9, 44], look: [0, 2, 26] },
  { name: 'homes', cam: [2, 7, 62], look: [2, 2, 42] },
  { name: 'road', cam: [4, 9, -6], look: [12, 2, -40] },
  { name: 'wide', cam: [-10, 60, 80], look: [0, 0, 0] },
  { name: 'school', cam: [-15, 7, 38], look: [-24, 2, 31] },
  { name: 'forge', cam: [12, 6.5, 40], look: [24, 2.5, 31] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => {
  try {
    localStorage.setItem('rocket_village_profile', JSON.stringify({ name: 'Zara', difficulty: 4 }));
    localStorage.setItem('rocket_village_play_mode', 'easy');
    // Skip the first-time opening card so the camera is not taken over.
    localStorage.setItem('rocket_village_seen_ch3_L4', '1');
  } catch { /* storage blocked: the lab still runs */ }
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${port}/chapter3.html`, { waitUntil: 'commit', timeout: 300000 });

// Pages are slow here: poll every 10 s until the world is built.
let ready = false;
for (let i = 0; i < 90 && !ready; i++) {
  await sleep(10000);
  ready = await page.evaluate(() => !!(window.__game && window.__game.structures && window.__game.homes)).catch(() => false);
}
if (!ready) { console.error('world never became ready'); await browser.close(); process.exit(1); }

// Every building up, as the finished town looks (the quests reveal them one by one).
await page.evaluate(() => {
  for (const s of window.__game.structures.values()) {
    if (s.showPieces && s.pieceCount) s.showPieces(s.pieceCount);
  }
});
await sleep(1500);

// Triangles per building (merged geometry counted once, outlines not included).
// Footprints are the collider boxes gameScene.js builds from (structures.js measureFootprint).
const costs = await page.evaluate(() => {
  const count = (obj) => {
    let tris = 0;
    let meshes = 0;
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      meshes += 1;
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });
    return { tris: Math.round(tris), meshes };
  };
  const out = {};
  for (const [id, s] of window.__game.structures) {
    if (s.group) out[id] = { ...count(s.group), fp: Number.isFinite(s.footprint?.halfX) ? [s.footprint.halfX, s.footprint.halfZ].map((n) => +n.toFixed(2)) : null };
  }
  out.homes = count(window.__game.homes.group);
  // Each piece's own box (the footprint is the union of these, floors excluded).
  const boxes = {};
  for (const id of ['missionSchool', 'materialsForge']) {
    const s = window.__game.structures.get(id);
    if (!s) continue;
    boxes[id] = s.group.children.map((c) => {
      const b = new window.__game.THREE.Box3().setFromObject(c);
      const r = (v) => +v.toFixed(2);
      return [c.name || c.type, r(b.min.x), r(b.max.x), r(b.min.y), r(b.max.y), r(b.min.z), r(b.max.z)];
    });
  }
  out.pieceBoxes = boxes;
  return out;
});
console.log('TRIANGLES PER BUILDING', JSON.stringify(costs));

for (const v of VIEWS) {
  const res = await page.evaluate(async (view) => {
    window.__freezeCamera = true;
    const { camera, renderer } = window.__game;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    camera.position.set(...view.cam);
    camera.lookAt(...view.look);
    await frame();
    camera.position.set(...view.cam);
    camera.lookAt(...view.look);
    await frame();
    const info = renderer.info.render;
    return { url: renderer.domElement.toDataURL('image/png'), calls: info.calls, tris: info.triangles };
  }, v);
  const file = join(outDir, `${v.name}.png`);
  writeFileSync(file, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(`VIEW ${v.name} calls=${res.calls} tris=${res.tris} -> ${file}`);
}

await browser.close();
