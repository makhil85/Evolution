// Chapter 6's ship interior (src/space/ch6/interior/): the walk map's rules,
// and every deck built for real (with a stand-in canvas, no WebGL).
//
//   node scripts/test-ch6-interior.mjs
//
// walkmap.js: floors and solids, sliding along walls, never through them.
// Each deck: enough floor to explore (>= 300 m^2 with the lift), the lift
// clear, and from the lift door she can walk (a 0.3 m body on a 0.25 m grid)
// to every station spot and quest spot (the sick bay's among them) and every
// crew spot; every station and quest of decks.js has a spot on its deck and a
// status lamp.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A canvas that draws nothing: the decks paint signs and screens on one.
const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
  set() { return true; },
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }),
};

const { createWalkMap } = await import('../src/space/ch6/interior/walkmap.js');

console.log('walk map');
ok('a floor is walkable, a solid on it is not', () => {
  const m = createWalkMap({ floors: [{ rect: [0, 5, 4, 10] }], solids: [{ disc: [0, 5, 1] }] });
  assert.ok(m.walkable(0, 1));
  assert.ok(!m.walkable(0, 5));
  assert.ok(!m.walkable(0, 11));
  assert.ok(m.area() > 30 && m.area() < 40);
});
ok('a turned rectangle and an arc of a ring', () => {
  const m = createWalkMap({ floors: [{ rect: [0, 0, 10, 2], rot: Math.PI / 2 }, { ring: [0, 20, 4, 7], from: -1, to: 1 }] });
  assert.ok(m.walkable(0, 4) && !m.walkable(4, 0));
  assert.ok(m.walkable(0, 25.5) && !m.walkable(0, 14.5));
});
ok('walking into a wall slides along it and never passes through', () => {
  const m = createWalkMap({ floors: [{ rect: [0, 0, 10, 10] }], solids: [{ rect: [0, 2, 10, 0.3] }] });
  m.reset(0, 0);
  const p = { x: 0, z: 0 }; const v = { x: 1, y: 3 };
  for (let i = 0; i < 60; i++) { p.x += v.x / 60; p.z += 3 / 60; m.collide(p, v); }
  assert.ok(p.z < 2 - 0.15, `went through: z ${p.z}`);
  assert.ok(p.x > 0.5, `did not slide: x ${p.x}`);
});

console.log('decks');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { DECKS, deckOf } = await vite.ssrLoadModule('/src/space/ch6/interior/decks.js');
  const { createKit } = await vite.ssrLoadModule('/src/space/ch6/interior/kit.js');
  const { STATIONS } = await vite.ssrLoadModule('/src/space/ch6/stationsLogic.js');
  const map = await vite.ssrLoadModule('/src/space/ch6/interior/walkmap.js');
  const LIFT_FLOOR = { rect: [0, -1.2, 2.4, 2.4] };
  // The model kits load in the browser only: a stand-in that draws nothing.
  // A deck's walk map comes from its own layout, never from the meshes.
  const THREE = await vite.ssrLoadModule('three');
  const { DECK_MODELS } = await vite.ssrLoadModule('/src/space/ch6/interior/decks.js');
  const models = {
    style: 'toon', names: () => [...DECK_MODELS], add() {}, object: () => new THREE.Group(),
    size: () => new THREE.Vector3(4, 3, 4), min: () => new THREE.Vector3(-2, 0, -2), dispose() {},
  };
  ok('every model a deck asks for is in the imported kit', () => {
    const fs = require('node:fs');
    const man = JSON.parse(fs.readFileSync(new URL('../public/assets/models/scifi/manifest.json', import.meta.url)));
    for (const n of DECK_MODELS) {
      const [set, name] = n.split('/');
      assert.ok((man[set] || []).includes(name), `missing model ${n}`);
    }
    // And the kit holds nothing a deck does not use (the import keeps only those).
    const listed = Object.entries(man).flatMap(([set, names]) => names.map((name) => `${set}/${name}`));
    assert.deepEqual(listed.sort(), [...DECK_MODELS].sort());
  });
  ok('every station is on exactly one deck', () => {
    for (const s of STATIONS) assert.equal(DECKS.filter((d) => d.stations.includes(s.id)).length, 1, s.id);
    assert.deepEqual(STATIONS.map((s) => deckOf(s.id)).filter((x) => !x), []);
  });
  // If the kits fail to load (preloadInterior gives null), every deck still builds from code alone.
  ok('every deck builds without the model kits', () => {
    for (const spec of DECKS) spec.build(createKit({ models: null }));
  });
  for (const spec of DECKS) {
    const kit = createKit({ models });
    const d = spec.build(kit);
    const m = map.createWalkMap({ floors: [...d.floors, LIFT_FLOOR], solids: d.solids });
    // Flood fill from the lift door with her body (the fits() test), 0.25 m steps.
    const STEP = 0.25; const seen = new Set(); const key = (i, j) => `${i},${j}`;
    const q = [[0, Math.round(1.4 / STEP)]]; seen.add(key(...q[0]));
    while (q.length) {
      const [i, j] = q.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di; const nj = j + dj; const k = key(ni, nj);
        if (seen.has(k) || !m.fits(ni * STEP, nj * STEP)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    const reach = (x, z) => {
      for (let i = Math.floor(x / STEP) - 1; i <= Math.ceil(x / STEP) + 1; i++) {
        for (let j = Math.floor(z / STEP) - 1; j <= Math.ceil(z / STEP) + 1; j++) if (seen.has(key(i, j))) return true;
      }
      return false;
    };
    ok(`${spec.id}: room to explore, the lift clear, every spot reachable from the lift`, () => {
      assert.ok(m.area() >= 300, `walkable ${m.area().toFixed(0)} m^2`);
      assert.ok(m.fits(0, 1.4), 'the spot in front of the lift');
      assert.ok(m.fits(0, -1.0), 'inside the lift');
      for (const id of [...spec.stations, ...(spec.quests || [])]) {
        const s = d.stations[id];
        assert.ok(s, `${id} has a spot`);
        assert.ok(s.lamp?.isMesh, `${id} has a lamp`);
        assert.ok(Number.isFinite(s.face), `${id} has a facing`);
        assert.ok(reach(s.x, s.z), `${id} reachable`);
      }
      for (const [id, s] of Object.entries(d.crewSpots || {})) assert.ok(reach(s.x, s.z) || m.walkable(s.x, s.z), `crew ${id}`);
      assert.ok((d.views || []).length >= 2, 'set points');
    });
    d.dispose?.(); kit.dispose();
  }
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
