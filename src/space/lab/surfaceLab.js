// Surface lab - the review page for part F (the Moon and Europa walks).
//
//   space-lab/surface.html?body=moon|europa&view=<name>[&shot=1][&mode=easy|medium|hard]
//
// Views: ladder (climbing down), walk (mid-stride, hero framing), jump (high,
// mid-air), sample (Moon pick-up) / drill (Europa), sky (Earth / Jupiter),
// checklist (Europa finale), play (interactive, real HUD + questions).
//
// The page is driven by hand, not by requestAnimationFrame (a hidden browser
// pane never fires it): window.__lab.run(seconds) ticks the scene on a fixed
// 1/60 s step and renders. With &shot=1 the view is set up, rendered, the 2-D
// overlay composited on top, and the PNG POSTed to /__shot. window.__shot is
// set when saved, window.__error on failure, window.__stats = draw calls etc.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RENDER, FLIGHT_MODES } from '../contracts.js';
import { createControls } from '../controls.js';
import { createHud } from '../hud/hud.js';
import { bakeMoonMaps } from '../moons.js';
import { questionForBeat } from '../questions.space.js';
import { createSurfaceScene } from '../surface.js';

const params = new URLSearchParams(location.search);
const BODY = params.get('body') === 'europa' ? 'europa' : 'moon';
const VIEW = params.get('view') || 'play';
const SHOT = params.has('shot');
const MODE = FLIGHT_MODES[params.get('mode')] || FLIGHT_MODES.medium;
const PLAY = VIEW === 'play' && !SHOT;
const W = SHOT ? 1600 : innerWidth;
const H = SHOT ? 900 : innerHeight;
const info = document.getElementById('info');
if (SHOT) document.body.classList.add('shot');

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: RENDER.logarithmicDepthBuffer,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

function createBus() {
  const handlers = new Map();
  return {
    on(n, fn) { if (!handlers.has(n)) handlers.set(n, new Set()); handlers.get(n).add(fn); return () => handlers.get(n)?.delete(fn); },
    off(n, fn) { handlers.get(n)?.delete(fn); },
    emit(n, p) { const s = handlers.get(n); if (s) for (const fn of [...s]) fn(p); },
  };
}
const bus = createBus();
let modalOpen = false;
bus.on('ui-modal', (o) => { modalOpen = !!o; });

const stubHud = {
  setMission() {}, toast() {}, askQuestion: async () => ({ correct: true, attempts: 1 }),
  showDialogue: async () => {}, showFact: async () => {}, setMarkers() {}, isModalOpen: () => false,
};
const hud = PLAY ? createHud({ mount: document.getElementById('hud-root'), bus }) : stubHud;
const controls = createControls({ bus, element: renderer.domElement });

// Io's real baked map, as the flight scene would have it.
let bodies = null;
// Opt-in (&io=1): the bake also paints a 4K Europa, heavy enough to trip a
// GPU reset on repeated lab reloads. Without it Io uses a painted fallback.
if (BODY === 'europa' && params.has('io')) {
  const maps = bakeMoonMaps(renderer);
  const root = new THREE.Group();
  const io = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  io.name = 'io-surface';
  io.material.uniforms = { map: { value: maps.io.texture } };
  root.add(io);
  bodies = { root };
}

const game = { renderer, hud, controls, bus, mode: MODE, bodies };
const beats = [];
const sceneObj = createSurfaceScene(game, {
  body: BODY,
  onBeat: async (beat) => {
    beats.push(beat);
    if (PLAY) {
      const q = questionForBeat(beat);
      if (q) await hud.askQuestion(q);
    }
  },
});
const dbg = sceneObj.debug;

const composerTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(sceneObj.scene, sceneObj.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setSize(W, H);
sceneObj.camera.aspect = W / H;
sceneObj.camera.updateProjectionMatrix();

const DT = 1 / 60;
const noInput = { thrust: 0, turn: 0, precision: false, steady: false };
const noMouse = { dx: 0, dy: 0, wheel: 0, dragging: false };
// A real (macrotask) yield that hidden tabs do not throttle, so long runs let
// the browser flush the overlay canvas and breathe.
const chan = new MessageChannel();
const yieldTask = () => new Promise((r) => { chan.port1.onmessage = () => r(); chan.port2.postMessage(0); });
async function run(seconds) {
  const n = Math.max(1, Math.round(seconds / DT));
  for (let i = 0; i < n; i++) {
    sceneObj.tick(DT, PLAY ? controls.sample() : noInput, noMouse, modalOpen);
    // Let the story's promise continuations run between frames.
    for (let k = 0; k < 6; k++) await null;
    if (i % 10 === 9) await yieldTask();
  }
  composer.render();
}

function stats() {
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.render(sceneObj.scene, sceneObj.camera);
  const s = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  renderer.info.autoReset = true;
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) composer.render();
  renderer.getContext().finish();
  s.msPerFrame = +((performance.now() - t0) / 5).toFixed(1);
  return s;
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const L = dbg.L;
const w = dbg.walker;
const ground = (x, z) => dbg.terrain.heightAt(x, z);

/** A fixed shot relative to her: `side` metres to her right, `fwd` ahead, `up` above her feet. */
function heroShot({ fwd = 2.6, side = 1.4, up = 1.2, lookUp = 0.95, lookFwd = 0, lookSide = 0 } = {}) {
  dbg.shot(() => {
    const h = w.heading;
    const f = V3(Math.sin(h), 0, Math.cos(h));
    const r = V3(f.z, 0, -f.x).negate();
    const p = w.pos.clone().addScaledVector(f, fwd).addScaledVector(r, side);
    p.y = Math.max(ground(p.x, p.z) + 0.3, w.pos.y + up);
    const look = w.pos.clone().addScaledVector(f, lookFwd).addScaledVector(r, lookSide);
    look.y = w.pos.y + lookUp;
    return { pos: p, look };
  }, 0);
}

async function afterIntro() {
  dbg.skipIntro();
  sceneObj.start();
  await run(0.1);
}

const VIEWS = {
  async ladder() {
    dbg.quiet();
    sceneObj.start();
    await run(BODY === 'moon' ? 5.3 : 5.3);
  },
  async walk() {
    await afterIntro();
    const tgt = BODY === 'moon' ? L.sample : L.drill;
    dbg.place(-2.6, -4.5, Math.atan2(tgt.x + 2.6, tgt.z + 4.5));
    dbg.setCam({ yaw: w.heading });
    dbg.setInput({ thrust: 1 });
    await run(2.1);
    const hs = params.get('hs')?.split(',').map(Number);
    heroShot(hs ? { fwd: hs[0], side: hs[1], up: hs[2], lookUp: hs[3] ?? 0.8 } : { fwd: 3.0, side: 1.8, up: 0.9, lookUp: 1.05, lookFwd: -0.2 });
    await run(Number(params.get('t') || 0.37));
  },
  async jump() {
    await afterIntro();
    dbg.place(-3.5, -7.5, Math.PI * 0.85);
    dbg.setCam({ yaw: Math.PI * 0.85 });
    await run(0.3);
    dbg.key('Jump', true);
    await run(0.05);
    dbg.key('Jump', false);
    await run(0.4);
    // Side-on and low, so the height reads against the horizon.
    const p0 = w.pos.clone();
    const h = w.heading;
    const f = V3(Math.sin(h), 0, Math.cos(h));
    const r = V3(f.z, 0, -f.x);
    const cp = p0.clone().addScaledVector(r, -4.4).addScaledVector(f, 3.0);
    cp.y = ground(cp.x, cp.z) + 0.55;
    dbg.shot(() => ({ pos: cp, look: V3(p0.x, ground(p0.x, p0.z) + 1.35, p0.z).addScaledVector(r, 0.8) }), 0);
    await run(1.15);
  },
  async sample() {
    await afterIntro();
    dbg.flags.bigJump = true;
    await run(1.2);   // the jump beat is asked, then the sample goal appears
    const s = L.sample;
    dbg.place(s.x + 0.8, s.z + 0.75, Math.atan2(-0.8, -0.75));
    await run(0.4);
    dbg.key('KeyE', true);
    await run(0.1);
    dbg.key('KeyE', false);
    await run(1.35);
  },
  async prints() {
    // Play through the jump and the sample, then walk up to the old prints.
    await afterIntro();
    dbg.flags.bigJump = true;
    await run(1.2);
    const s = L.sample;
    dbg.place(s.x + 0.8, s.z + 0.75, Math.atan2(-0.8, -0.75));
    await run(0.4);
    dbg.key('KeyE', true);
    await run(0.1);
    dbg.key('KeyE', false);
    await run(4.5);
    const o = L.oldPrints;
    dbg.place(o.x + 3.2, o.z + 3.2, Math.atan2(-3.2, -3.2));
    await run(Number(params.get('t') || 2.4));
  },
  async drill() {
    await afterIntro();
    await run(1.0);   // walk beat asked
    const d = L.drill;
    dbg.place(d.x + 0.4, d.z + 1.4, Math.PI);
    await run(0.4);
    dbg.key('KeyE', true);
    await run(3.6);
  },
  async checklist() {
    await afterIntro();
    await run(1.0);
    const d = L.drill;
    dbg.place(d.x + 0.4, d.z + 1.4, Math.PI);
    await run(0.4);
    dbg.key('KeyE', true);
    for (let i = 0; i < 40 && !dbg.drill.done; i++) await run(0.25);
    dbg.key('KeyE', false);
    await run(Number(params.get('t') || 12.5));
  },
  async sky() {
    await afterIntro();
    const big = BODY === 'moon' ? L.earth : L.jupiter;
    const az = (big.az * Math.PI) / 180;
    const look = V3(Math.sin(az), 0, -Math.cos(az));
    // She stands looking up at it; the camera is low behind her.
    const p = V3(-4, 0, -9);
    dbg.place(p.x, p.z, Math.atan2(look.x, look.z));
    w.overlay.lookUp = 1;
    await run(0.8);
    const el = ((big.el + (BODY === 'moon' ? 1 : 3)) * Math.PI) / 180;
    const cp = w.pos.clone().addScaledVector(look, -2.3).add(V3(look.z, 0, -look.x).multiplyScalar(-0.9));
    cp.y = ground(cp.x, cp.z) + 0.55;
    const dir = V3(look.x * Math.cos(el), Math.sin(el), look.z * Math.cos(el));
    dbg.shot(() => ({ pos: cp, look: cp.clone().addScaledVector(dir, 10), fov: BODY === 'moon' ? 50 : 54 }), 0);
    await run(0.5);
  },
};

async function shoot() {
  await dbg.ready;
  const v = VIEWS[VIEW];
  if (!v) throw new Error(`unknown view "${VIEW}"`);
  await v();
  composer.render();
  const s = stats();
  window.__stats = { ...s, beats: [...beats], clock: +dbg.clock.toFixed(2) };
  composer.render();
  // Composite the scene's 2-D overlay (prompts, checklist) over the frame.
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(renderer.domElement, 0, 0, W, H);
  g.drawImage(dbg.overlay.canvas, 0, 0, W, H);
  const url = c.toDataURL('image/png');
  const name = `surface_${BODY}_${VIEW}${params.get('name') ? `_${params.get('name')}` : ''}`;
  const res = await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
  if (!res.ok) throw new Error(`shot upload failed: ${res.status}`);
  window.__shot = true;
}

function play() {
  const clock = new THREE.Clock();
  sceneObj.start().then((r) => { info.textContent = `finished: ${JSON.stringify(r)}`; });
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    sceneObj.tick(dt, controls.sample(), controls.takeMouse(), modalOpen);
    composer.render();
    if (++frames % 60 === 0) info.textContent = `${BODY} · mode ${MODE.id} · calls ${renderer.info.render.calls} · beats ${beats.join(', ')}`;
  });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    sceneObj.camera.aspect = innerWidth / innerHeight;
    sceneObj.camera.updateProjectionMatrix();
  });
}

// Give the GPU context back promptly when the page goes (lab reloads a lot).
addEventListener('pagehide', () => { sceneObj.dispose(); renderer.dispose(); });

window.__lab = { run, stats, scene: sceneObj, dbg, composer, renderer, beats, VIEWS };

try {
  if (SHOT) shoot().catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
  else if (PLAY) play();
  else dbg.ready.then(() => VIEWS[VIEW]?.()).catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
} catch (e) {
  console.error(e);
  window.__error = String(e?.stack || e);
}
