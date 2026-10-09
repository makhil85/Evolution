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
// status lamp. She steps out of the lift in the open (LIFT_OUT, not inside the
// car). The chase camera (ship.js chaseDistance): along a wall it moves at most
// 4% a frame at 60 and 30 fps, and never sits in the wall.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
  const { chaseDistance, chaseStats, LIFT_OUT } = await vite.ssrLoadModule('/src/space/ch6/interior/ship.js');
  const inLiftCar = (x, z) => x > -1.2 && x < 1.2 && z > -2.4 && z < -0.2; // ship.js's lift test
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
  ok('every deck model is on disk, with its buffers and textures', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const dir = fileURLToPath(new URL('../public/assets/models/scifi/megakit/', import.meta.url));
    for (const n of DECK_MODELS) {
      const file = path.join(dir, `${n}.gltf`);
      assert.ok(fs.existsSync(file), `missing gltf ${n}`);
      const g = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const uri of [...(g.buffers || []), ...(g.images || [])].map((x) => x.uri)) {
        assert.ok(uri && !uri.startsWith('data:'), `${n}: external file expected`);
        assert.ok(fs.existsSync(path.join(path.dirname(file), uri)), `missing ${uri} for ${n}`);
      }
    }
  });
  ok('every station is on exactly one deck', () => {
    for (const s of STATIONS) assert.equal(DECKS.filter((d) => d.stations.includes(s.id)).length, 1, s.id);
    assert.deepEqual(STATIONS.map((s) => deckOf(s.id)).filter((x) => !x), []);
  });
  // If the kits fail to load (preloadInterior gives null), every deck still builds from code alone.
  ok('every deck builds without the model kits', () => {
    for (const spec of DECKS) spec.build(createKit({ models: null }));
  });
  const built = {}; // each deck's walk map and roof, for the camera tests below
  for (const spec of DECKS) {
    const kit = createKit({ models });
    const d = spec.build(kit);
    const m = map.createWalkMap({ floors: [...d.floors, LIFT_FLOOR], solids: d.solids });
    built[spec.id] = { m, roof: d.ceilingAt ?? (() => d.ceiling) };
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
    ok(`${spec.id}: she steps out of the lift in the open, past the door`, () => {
      assert.ok(m.fits(LIFT_OUT.x, LIFT_OUT.z), 'the lift-out spot');
      assert.ok(!inLiftCar(LIFT_OUT.x, LIFT_OUT.z), 'outside the lift car');
      assert.ok(m.fits(0, 1.4), 'the spot in front of the lift');
    });
    d.dispose?.(); kit.dispose();
  }

  // The chase camera (ship.js chaseDistance): the real function, on a walk map with one wall, on a pillar
  // she walks past, and under the real decks' roofs. Her walk is 1.55 m/s (walker.js WALK_SPEED), and the
  // camera eases round to her heading as in ship.js.
  const WALL_Z = 3.2;
  const roof32 = () => 3.2; // a flat roof 3.2 m up (the camera's ceiling is 0.35 m under it)
  const wallMap = map.createWalkMap({ floors: [{ rect: [0, 0, 80, 40] }], solids: [{ rect: [0, WALL_Z, 80, 0.4] }] });
  const pillarMap = map.createWalkMap({ floors: [{ rect: [0, 0, 80, 40] }], solids: [{ disc: [3.0, 2.2, 0.4] }] });
  // Walks the camera along or away from a wall (or past a pillar): the largest frame-to-frame change (% of the
  // distance) after the first second, leaving out the frames the hard limit held it (`clamped`), whether it
  // ever sat in a solid, and the frames the hard limit did hold it.
  function walkCam({ m = wallMap, roof = roof32, fps, dir, x0 = -20, z0, lag, secs = 9, speed = 1.55 }) {
    const dt = 1 / fps; const heading = Math.atan2(dir[0], dir[1]);
    let x = x0; let z = z0; let yaw = heading + lag; let dist = 4.6; let prev = null; let worst = 0; let inSolid = false; let clamped = 0; let minDist = 9;
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    for (let f = 0; f < fps * secs; f++) {
      x += dir[0] * speed * dt; z += dir[1] * speed * dt;
      yaw += angDiff(heading, yaw) * Math.min(1, dt * 0.9);
      const held = chaseStats.held;
      const next = chaseDistance(m, roof, { x, z, ty: 1.0, yaw, pitch: 0.3, want: 4.6 }, dist, dt);
      const wasHeld = chaseStats.held !== held; if (wasHeld) clamped += 1;
      if (prev != null && f >= fps && !wasHeld) worst = Math.max(worst, Math.abs(next - prev) / prev);
      prev = next; dist = next; minDist = Math.min(minDist, dist);
      const cx = x - Math.sin(yaw) * dist * Math.cos(0.3); const cz = z - Math.cos(yaw) * dist * Math.cos(0.3);
      if (!m.fits(cx, cz, 0.15)) inSolid = true;
    }
    return { worst, inSolid, clamped, minDist };
  }
  ok('the chase camera: walking along a wall it moves at most 4% a frame at 60 and 30 fps, and never sits in the wall', () => {
    for (const fps of [60, 30]) {
      for (const lag of [0.2, 0.5, 0.9]) for (const z0 of [2.2, 2.6]) {
        const r = walkCam({ fps, dir: [1, 0], z0, lag });
        assert.ok(r.worst <= 0.04, `${fps} fps lag ${lag} z ${z0}: ${(100 * r.worst).toFixed(2)}%`);
        assert.ok(!r.inSolid, `${fps} fps lag ${lag} z ${z0}: in the wall`);
      }
      const away = walkCam({ fps, dir: [0, -1], z0: 2.0, lag: 0.4 });
      assert.ok(away.worst <= 0.04 && !away.inSolid, `${fps} fps walking away from the wall: ${(100 * away.worst).toFixed(2)}%`);
    }
  });
  ok('the chase camera: a corner swept into the sight line (a pillar she walks past) glides: at most 4% a frame, except the frames the hard limit holds it', () => {
    for (const fps of [60, 30]) {
      const r = walkCam({ m: pillarMap, fps, dir: [1, 0], x0: -4, z0: 1.2, lag: 0.2 }); // the pillar's edge sweeps the line
      assert.ok(r.minDist < 2, `${fps} fps: the sweep pulls the camera in (closest ${r.minDist.toFixed(2)} m)`);
      assert.ok(r.worst <= 0.04, `${fps} fps: ${(100 * r.worst).toFixed(2)}% (held ${r.clamped} frames)`);
      assert.ok(!r.inSolid, `${fps} fps: in the pillar`);
    }
  });
  ok('the chase camera: a wall ahead on the sight line pulls it in to just short of the wall; open floor lets it out to the wanted distance', () => {
    const open = chaseDistance(wallMap, roof32, { x: 0, z: 0, ty: 1.0, yaw: 0, pitch: 0.3, want: 4.6 }, 4.6, 1);
    assert.equal(open, 4.6);
    // Facing -z (yaw pi), the camera sits on the +z side of her, between her and the wall. The body's
    // margin (0.15) keeps the hard limit at z 2.85 (the wall starts at z 3.0); the soft margin (0.6) at z 2.4.
    // (She stands 1 m from the wall: the soft margin still fits her there; at 0.5 m it would fall back to the hard limit.)
    const hardCam = chaseDistance(wallMap, roof32, { x: 0, z: 2.0, ty: 1.0, yaw: Math.PI, pitch: 0.3, want: 4.6 }, 4.6, 0);
    const hardZ = 2.0 + hardCam * Math.cos(0.3);
    assert.ok(hardZ <= 2.85 + 1e-6 && hardZ > 2.83, `the hard limit: z ${hardZ.toFixed(3)}`);
    const softCam = chaseDistance(wallMap, roof32, { x: 0, z: 2.0, ty: 1.0, yaw: Math.PI, pitch: 0.3, want: 4.6 }, 4.6, 10);
    const cam = 2.0 + softCam * Math.cos(0.3);
    assert.ok(cam <= 2.4 + 1e-6 && cam > 2.38, `eases to the soft margin: z ${cam.toFixed(3)}`);
  });
  ok('the chase camera: a low roof takes the camera down to her, never up through it', () => {
    const d = chaseDistance(wallMap, roof32, { x: 0, z: 0, ty: 2.4, yaw: 0, pitch: 0.9, want: 4.6 }, 4.6, 10);
    assert.ok(2.4 + 0.3 + d * Math.sin(0.9) <= 2.85 + 1e-6, `height ${(2.4 + 0.3 + d * Math.sin(0.9)).toFixed(3)}`);
  });
  for (const id of ['engineering', 'bridge', 'life']) {
    ok(`${id}: the chase camera under its own roofs: a corridor roof is low, the rooms beside it are not`, () => {
      const { m, roof } = built[id];
      // Walkable points on a 0.5 m grid: the roof over each, read from the real deck.
      const heights = new Set();
      for (let x = -10; x <= 10; x += 0.5) for (let z = -2; z <= 40; z += 0.5) if (m.walkable(x, z)) heights.add(Math.round(roof(x, z) * 100) / 100);
      assert.ok(Math.min(...heights) < Math.max(...heights), `${id} has one roof height only`);
      assert.ok(Math.min(...heights) >= 3.2 - 1e-9 && Math.max(...heights) <= 7 + 1e-9, `${id} roofs: ${[...heights].join(', ')}`);
    });
  }
  ok('engineering: under the corridor roof (3.2 m) the camera comes down; in the hall (7 m) it keeps its distance', () => {
    const { m, roof } = built.engineering;
    assert.equal(roof(0, 2.5), 3.2, 'corridor');
    assert.equal(roof(0, 15), 7, 'hall');
    assert.equal(roof(0, 30), 5, 'bay');
    // She faces +z and looks down: the camera's sight line runs back towards the lift.
    const pitch = 0.6; const cp = Math.cos(pitch); const sp = Math.sin(pitch);
    const low = chaseDistance(m, roof, { x: 0, z: 4.6, ty: 1.0, yaw: 0, pitch, want: 4.6 }, 4.6, 10);
    assert.ok(low < 2.75, `corridor: ${low.toFixed(3)} m`);
    assert.ok(1.3 + low * sp <= 3.2 - 0.35 + 1e-6, 'the camera under the corridor roof');
    assert.ok(4.6 - low * cp >= 0, 'still in the corridor');
    // (Clear of the core's disc at z 14, and of the props either side of the hall.)
    const hall = chaseDistance(m, roof, { x: -6, z: 18, ty: 1.0, yaw: 0, pitch, want: 4.6 }, 4.6, 10);
    assert.ok(Math.abs(hall - 4.6) < 1e-9, `hall: ${hall.toFixed(3)} m`);
  });
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
