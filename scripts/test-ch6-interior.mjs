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
// car). The follow camera (ship.js chaseFrame): behind her at a fixed distance and height, her whole body in view, the
// view turning to her heading only while she walks forward, nothing moved on its own (no fade, no pull-in); walls on the
// sight line are cut away by the decks' materials (ship.js cutAway). toggleView cycles 'behind', 'follow' and 'over'.
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
  createElement: () => ({ width: 0, height: 0, style: {}, classList: { toggle() {} }, setAttribute() {}, getContext: () => ctx2d, appendChild() {}, addEventListener() {}, remove() {} }),
  body: { appendChild() {} },
  head: { appendChild() {} },
  getElementById: () => null,
};
// The scene's tick reads the window's size and pixel ratio (ship.js); a plain desktop's values.
Object.assign(globalThis, { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 });

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
  const { chaseFrame, createChaseRig, createInteriorScene, LIFT_OUT, CAM_DIST, CAM_RISE, CAM_OVER, CAM_NEAR } = await vite.ssrLoadModule('/src/space/ch6/interior/ship.js');
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

  const fakeGame = { renderer: { domElement: { clientWidth: 800, clientHeight: 600 } }, controls: { isDown: () => false }, hud: null };
  const noMouse = { dx: 0, dy: 0, wheel: 0, dragging: false };
  // A floor cell with 2 m of clear floor in eight directions (every 0.25 m along each): she can walk a little either way.
  const isOpen = (deck, x, z) => {
    if (!deck.map.fits(x, z, 0.3)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let d = 0.25; d <= 2.0; d += 0.25) if (!deck.map.fits(x + Math.sin(a) * d, z + Math.cos(a) * d, 0.3)) return false;
    }
    return true;
  };
  function openSpot(deck) {
    const ext = deck.map.extent;
    for (let x = ext.x0 + 2.5; x < ext.x1 - 2.5; x += 0.25) for (let z = ext.z0 + 2.5; z < ext.z1 - 2.5; z += 0.25) {
      if (isOpen(deck, x, z)) return [x, z];
    }
    return null;
  }
  // The follow camera (ship.js chaseFrame, as the scene runs it): behind her at a fixed distance and height, her whole body
  // in view, the view turning to her heading only while she walks forward, and nothing moving the camera on its own.
  const LOOK_UP = 1.1; // ship.js TARGET_UP
  const roof32 = () => 3.2;
  const camAt = (rig, cam) => ({ x: rig.fx - Math.sin(cam.yaw) * rig.dist, y: rig.cy, z: rig.fz - Math.cos(cam.yaw) * rig.dist });
  // Her feet and head are within 30 degrees of the view's centre (the lens is 60 degrees tall).
  function inView(c, look, her) {
    const vx = look.x - c.x; const vy = look.y - c.y; const vz = look.z - c.z; const vl = Math.hypot(vx, vy, vz);
    return [0, 1.3].every((h) => {
      const px = her.x - c.x; const py = her.y + h - c.y; const pz = her.z - c.z; const pl = Math.hypot(px, py, pz);
      return (px * vx + py * vy + pz * vz) / (pl * vl) >= Math.cos(Math.PI / 6);
    });
  }
  ok('the follow camera: behind her on her heading, CAM_DIST back and CAM_RISE up, her whole body in view, and still', () => {
    const cam = { yaw: 0 }; const rig = createChaseRig();
    const her = { x: 0, y: 0, z: 0, heading: 0, speed: 0, want: CAM_DIST, rise: CAM_RISE, follow: false };
    for (let f = 0; f < 120; f++) chaseFrame(rig, cam, her, 1 / 60);
    assert.equal(rig.dist, CAM_DIST);
    assert.equal(rig.cy, CAM_RISE);
    const c = camAt(rig, cam);
    assert.ok(Math.abs(c.x) < 1e-9 && Math.abs(c.z + CAM_DIST) < 1e-9, `on her back side: ${c.x}, ${c.z}`);
    assert.ok(inView(c, { x: 0, y: LOOK_UP, z: 0 }, her), 'her feet and head in view');
  });
  ok('the view turns to her heading only while she walks forward (a drag or a strafe holds it), never faster than the comfortable rate', () => {
    const dt = 1 / 60; const cam = { yaw: 1.2 }; const rig = createChaseRig();
    const her = { x: 0, y: 0, z: 0, heading: 0, speed: 0, want: CAM_DIST, rise: CAM_RISE, follow: false };
    for (let f = 0; f < 120; f++) chaseFrame(rig, cam, her, dt);
    assert.equal(cam.yaw, 1.2, 'held while she stands (after a drag)');
    her.follow = true; her.speed = 1.5; let worst = 0; let last = cam.yaw;
    for (let f = 0; f < 240; f++) {
      chaseFrame(rig, cam, her, dt);
      worst = Math.max(worst, Math.abs(cam.yaw - last) / dt); last = cam.yaw;
    }
    assert.ok(Math.abs(cam.yaw) < 0.05, `behind her after 4 s walking forward: yaw ${cam.yaw.toFixed(3)}`);
    assert.ok(worst <= 1.1 + 1e-6, `turn ${worst.toFixed(3)} rad/s`);
  });
  ok('a bump leaves the camera where it is: its distance and height do not change when she stops or walks into things', () => {
    const cam = { yaw: 0.4 }; const rig = createChaseRig();
    const her = { x: 0, y: 0, z: 0, heading: 0.4, speed: 1.5, want: CAM_DIST, rise: CAM_RISE, follow: true };
    for (let f = 0; f < 120; f++) chaseFrame(rig, cam, her, 1 / 60);
    const before = { ...camAt(rig, cam) };
    her.speed = 0; her.follow = false; // the bump: she is stopped
    for (let f = 0; f < 120; f++) chaseFrame(rig, cam, her, 1 / 60);
    const after = camAt(rig, cam);
    assert.ok(Math.abs(after.y - before.y) < 1e-9 && Math.abs(rig.dist - CAM_DIST) < 1e-9, 'distance and height kept');
  });
  ok('the camera\'s distance and pitch never move: CAM_DIST and CAM_RISE, or CAM_OVER in the over view', () => {
    const cam = { yaw: 0 }; const rig = createChaseRig();
    const her = { x: 0, y: 0, z: 0, heading: 0, speed: 1, want: CAM_OVER.dist, rise: CAM_OVER.rise, follow: true };
    for (let f = 0; f < 120; f++) { her.z = f * 0.01; chaseFrame(rig, cam, her, 1 / 60); }
    assert.equal(rig.dist, CAM_OVER.dist);
    assert.equal(rig.cy, CAM_OVER.rise);
  });
  ok('the cut-away: every deck material (walls, props, lift car, crew) drops the fragments on the sight line', () => {
    const sc = createInteriorScene(fakeGame, { models: null, onStation: async () => {}, startDeck: 'crew' });
    let n = 0; let bad = 0;
    const her = sc.debug.walker.root; // her own materials are not cut (the camera must see her)
    for (const d of Object.values(sc.debug.decks)) d.group.traverse((o) => {
      if (!o.isMesh) return;
      for (let p = o; p; p = p.parent) if (p === her) return;
      for (const m of [].concat(o.material)) { n += 1; if (!m.userData.cutAway || typeof m.onBeforeCompile !== 'function') bad += 1; }
    });
    assert.ok(n > 50, `${n} materials`);
    assert.equal(bad, 0, `${bad} materials without the cut-away`);
  });
  ok('the camera source: no pull-in, no fade, no turn of its own (the rig has no distance or pitch rule of its own)', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(new URL('../src/space/ch6/interior/ship.js', import.meta.url), 'utf8');
    const code = src.slice(src.indexOf('// The follow camera'), src.indexOf('/** The lift car every deck shares')).replace(/\/\/.*$/gm, '');
    assert.ok(!/fade\s*[+=]|rig\.fade|herMats|chaseDistance|clearBehind|riseAt|pitch|camMap/.test(code), 'a camera rule left over');
  });
  ok('the camera\'s near plane is at most 0.1 m', () => { assert.ok(CAM_NEAR <= 0.1 + 1e-9); });
  // The scene (ship.js createInteriorScene): the camera button (toggleView) switches 'behind' (the default) and 'over' (a
  // higher look down on her) and back, the choice is kept for the session, and the steering matches the screen in both.
  ok('toggleView: behind (the default) <-> over and back, kept for the session; the steering matches the screen in both views', () => {
    const sc = createInteriorScene(fakeGame, { models: null, onStation: async () => {}, startDeck: 'life' });
    const at = openSpot(sc.debug.decks.life); assert.ok(at, 'an open spot on the life deck');
    sc.debug.place(at[0], at[1]);
    const settle = (n, input) => { for (let i = 0; i < n; i++) sc.tick(1 / 30, input, noMouse, false); };
    const screen = () => {
      const c = sc.camera.position; const w = sc.debug.walker.pos;
      const fx = w.x - c.x; const fz = w.z - c.z; const l = Math.hypot(fx, fz);
      return { fx: fx / l, fz: fz / l, rx: -fz / l, rz: fx / l };
    };
    const moves = (input) => {
      sc.debug.place(at[0], at[1]);
      settle(30, { thrust: 0, turn: 0 });
      const v = screen();
      settle(18, input);
      const dx = sc.debug.walker.vel.x; const dz = sc.debug.walker.vel.y; const l = Math.hypot(dx, dz);
      assert.ok(l > 0.5, `she walks at ${l.toFixed(2)} m/s`);
      return { fwd: (dx * v.fx + dz * v.fz) / l, right: (dx * v.rx + dz * v.rz) / l };
    };
    const check = (name) => {
      const f = moves({ thrust: 1, turn: 0 });
      assert.ok(f.fwd > 0.95, `${name}: forward key walks away from the screen (${f.fwd.toFixed(2)})`);
      const r = moves({ thrust: 0, turn: 1 });
      assert.ok(r.right > 0.9, `${name}: the right key walks to screen right (${r.right.toFixed(2)})`);
      assert.ok(sc.debug.walker.root.visible, `${name}: she is in view`);
    };
    assert.equal(sc.view, 'behind', 'the default view');
    check('behind');
    const yBehind = sc.camera.position.y;
    assert.equal(sc.toggleView(), 'follow', 'the button switches to follow (checked below)');
    assert.equal(sc.toggleView(), 'over', 'and then to over');
    check('over');
    assert.ok(sc.camera.position.y > yBehind + 0.5, `the over view is higher: ${sc.camera.position.y.toFixed(2)} m`);
    assert.equal(sc.toggleView(), 'behind', 'and back to behind');
    check('behind again');
    sc.toggleView(); // follow: kept for the session
    const again = createInteriorScene(fakeGame, { models: null, onStation: async () => {}, startDeck: 'life' });
    assert.equal(again.view, 'follow', 'a new scene keeps the choice for the session');
    again.toggleView();
    assert.equal(again.view, 'over', 'the one choice for the session: the cycle goes on in the new scene');
  });
  ok('the follow view: Left turns her on the spot ~1.9 rad in 1 s, the camera stays directly behind her every frame, Up walks her along her heading', () => {
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    const sc = createInteriorScene(fakeGame, { models: null, onStation: async () => {}, startDeck: 'life' });
    const at = openSpot(sc.debug.decks.life); assert.ok(at, 'an open spot on the life deck');
    sc.debug.place(at[0], at[1]);
    // The choice is kept for the session (the scenes before this one left it elsewhere): cycle to follow.
    for (let i = 0; i < 3 && sc.view !== 'follow'; i++) sc.toggleView();
    assert.equal(sc.view, 'follow');
    const w = sc.debug.walker; const cam = sc.debug.cam; const dt = 1 / 30;
    let worst = 0; // the camera's yaw off her back, worst frame (rad)
    const step = (n, input, mouse = noMouse) => {
      for (let i = 0; i < n; i++) {
        sc.tick(dt, input, mouse, false);
        worst = Math.max(worst, Math.abs(angDiff(cam.yaw, w.heading)));
      }
    };
    step(30, { thrust: 0, turn: 0 }); // the view comes round to her back
    worst = 0;
    const h0 = w.heading;
    step(30, { thrust: 0, turn: -1 }); // Left, 1 s
    const turned = w.heading - h0;
    assert.ok(turned > 1.8 && turned < 2.2, `Left turned her ${turned.toFixed(2)} rad in 1 s`);
    assert.ok(worst < 5 * Math.PI / 180, `the camera left her back by ${(worst * 180 / Math.PI).toFixed(1)} degrees while she turned`);
    const rightBefore = w.heading;
    step(30, { thrust: 0, turn: 1 }); // Right, 1 s: back the way she came
    assert.ok(rightBefore - w.heading > 1.5, `Right turned her back ${(rightBefore - w.heading).toFixed(2)} rad`);
    step(30, { thrust: 0, turn: 0 }); // settle
    worst = 0;
    const p0 = { x: w.pos.x, z: w.pos.z }; const hF = w.heading;
    step(30, { thrust: 1, turn: 0 }); // Up, 1 s: along her heading
    const dx = w.pos.x - p0.x; const dz = w.pos.z - p0.z; const l = Math.hypot(dx, dz);
    assert.ok(l > 2, `Up walked her ${l.toFixed(2)} m`);
    assert.ok(Math.abs(angDiff(w.heading, hF)) < 0.01, 'Up does not turn her');
    assert.ok((dx * Math.sin(hF) + dz * Math.cos(hF)) / l > 0.98, 'she walks along her heading');
    assert.ok(worst < 5 * Math.PI / 180, `the camera left her back by ${(worst * 180 / Math.PI).toFixed(1)} degrees while she walked`);
    const c = sc.camera.position;
    assert.ok(Math.abs(angDiff(Math.atan2(c.x - w.pos.x, c.z - w.pos.z), hF + Math.PI)) < 0.1, 'the camera is on her back line');
    assert.equal(sc.debug.rig.dist, CAM_DIST, 'the same distance as behind');
    assert.equal(c.y, CAM_RISE, 'the same height as behind');
    // Back (Down) walks her backwards and does not turn her round.
    const hB = w.heading;
    step(15, { thrust: -1, turn: 0 });
    assert.ok(Math.abs(angDiff(w.heading, hB)) < 0.01, 'a step back does not turn her');
    // A drag looks round; the view eases back to her back.
    step(1, { thrust: 0, turn: 0 }, { dx: 200, dy: 0, wheel: 0, dragging: true });
    assert.ok(Math.abs(angDiff(cam.yaw, w.heading)) > 0.3, 'the drag turned the view');
    step(90, { thrust: 0, turn: 0 });
    assert.ok(Math.abs(angDiff(cam.yaw, w.heading)) < 0.02, `the view eased back: ${(angDiff(cam.yaw, w.heading) * 180 / Math.PI).toFixed(1)} degrees off`);
  });
  ok('the follow camera on every deck: a 20 s wander (walks, strafes, steps back, drags, bumps): she is always in view, the camera keeps CAM_DIST and CAM_RISE', () => {
    const sc = createInteriorScene(fakeGame, { models: null, onStation: async () => {}, startDeck: 'crew' });
    for (const id of ['crew', 'bridge', 'life', 'engineering']) {
      sc.debug.showDeck(id);
      const deck = sc.debug.decks[id]; const at = openSpot(deck); assert.ok(at, `${id}: an open spot`);
      sc.debug.walker.place(at[0], 0, at[1]); deck.map.reset(at[0], at[1]);
      let seed = 11 + id.length; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      let input = { thrust: 0, turn: 0 }; let mouse = noMouse; let hidden = 0; let offView = 0; let badDist = 0; let badRise = 0;
      for (let f = 0; f < 600; f++) {
        if (f % 30 === 0) {
          const r = rnd();
          input = { thrust: r < 0.5 ? 1 : r < 0.6 ? -1 : 0, turn: rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0 };
          mouse = rnd() < 0.2 ? { dx: (rnd() - 0.5) * 160, dy: 0, wheel: 0, dragging: false } : noMouse;
        }
        sc.tick(1 / 30, input, mouse, false);
        mouse = noMouse;
        const rig = sc.debug.rig; const c = sc.camera.position; const w = sc.debug.walker.pos;
        if (!sc.debug.walker.root.visible) hidden += 1;
        if (Math.abs(rig.dist - CAM_DIST) > 1e-9) badDist += 1;
        if (Math.abs(c.y - CAM_RISE) > 1e-9) badRise += 1;
        if (f > 30 && !inView(c, { x: rig.fx, y: rig.fy + LOOK_UP, z: rig.fz }, { x: w.x, y: 0, z: w.z })) offView += 1;
      }
      assert.equal(hidden, 0, `${id}: hidden in ${hidden} frames`);
      assert.equal(badDist, 0, `${id}: the distance moved in ${badDist} frames`);
      assert.equal(badRise, 0, `${id}: the height moved in ${badRise} frames`);
      assert.equal(offView, 0, `${id}: her feet or head out of the view in ${offView} frames`);
    }
  });
  ok('the follow camera builds no object literal a frame (source check of its per-frame functions)', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(new URL('../src/space/ch6/interior/ship.js', import.meta.url), 'utf8');
    const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}', i)).replace(/\/\/.*$/gm, ''); };
    for (const name of ['damped', 'chaseFrame']) {
      assert.ok(!/[=(,:?]\s*\{|return\s*\{|\[\s*\{/.test(body(name)), `${name} builds an object`);
    }
  });
  ok('the follow camera: 5000 frames add under 15 MB to the heap (a loose bound: it catches a regression)', () => {
    const v8 = require('node:v8'); const vm = require('node:vm');
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    const cam = { yaw: 0 };
    const rig = createChaseRig();
    const her = { x: 0, y: 0, z: 2, heading: 0, speed: 2, want: CAM_DIST, rise: CAM_RISE, follow: true };
    const frames = (n) => {
      for (let i = 0; i < n; i++) {
        her.z = 2 + Math.sin(i * 0.01); her.x = Math.cos(i * 0.013); her.heading = Math.sin(i * 0.02) * 0.5; her.speed = 1 + (i % 3);
        chaseFrame(rig, cam, her, 1 / 60);
      }
    };
    frames(3000); gc();
    const before = process.memoryUsage().heapUsed;
    frames(5000);
    const grew = process.memoryUsage().heapUsed - before;
    assert.ok(grew < 15 * 1024 * 1024, `the heap grew ${grew} bytes over 5000 frames`);
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
} finally {
  await vite.close();
}

console.log(`\n${passed} passed`);
