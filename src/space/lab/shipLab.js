// Ship lab: a review page for the hero ship (dev only).
//
//   space-lab/ship.html?view=<name>[&shot=1]
//
// Views: chase, hero, side, wingsFolding, folded, solarDeployed, claw, landed,
// cockpit, rcs, turntable. With &shot=1 the page renders at 1600x900, lets the
// animations reach the intended state on a FIXED timestep (so shots are
// repeatable), and POSTs the canvas to /__shot?name=ship_<view>.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RENDER, SHIP, SPACE_LIGHT } from '../contracts.js';
import { createShip, GROUND_Y, CHASE_CAMERA } from '../ship.js';

const params = new URLSearchParams(location.search);
const VIEW = params.get('view') || 'turntable';
const SHOT = params.has('shot');
const W = SHOT ? 1600 : innerWidth;
const H = SHOT ? 900 : innerHeight;
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: RENDER.logarithmicDepthBuffer,
});
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = RENDER.exposure;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SPACE_LIGHT.background);
const camera = new THREE.PerspectiveCamera(RENDER.fov, W / H, RENDER.near, RENDER.far);

// --- backdrop: a sparse star field so motion and scale read ----------------
{
  const n = 2500;
  const p = new Float32Array(n * 3);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(3000);
    p.set([v.x, v.y, v.z], i * 3);
    const b = 0.25 + Math.pow(Math.random(), 6) * 1.6;
    const warm = Math.random();
    c.set([b * (0.9 + warm * 0.1), b * 0.93, b * (1.0 - warm * 0.15)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
  stars.name = 'stars';
  scene.add(stars);
}

// --- lights: warm Sun from the upper left of frame, faint cool fill --------
const sun = new THREE.DirectionalLight(SPACE_LIGHT.sunColor, SPACE_LIGHT.sunIntensity);
scene.add(sun, sun.target);
scene.add(new THREE.AmbientLight(SPACE_LIGHT.ambient, SPACE_LIGHT.ambientIntensity));
const fill = new THREE.DirectionalLight(0x6f8cff, 0.35);
scene.add(fill, fill.target);

const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const sunDir = new THREE.Vector3();
/** Put the Sun upper-left of the current frame, a little toward the camera. */
function aimLights(target) {
  camera.updateMatrixWorld();
  camera.matrixWorld.extractBasis(_r, _u, _f);   // _f points BACK toward the camera
  sunDir.copy(_r).multiplyScalar(-0.62).addScaledVector(_u, 0.62).addScaledVector(_f, 0.48).normalize();
  sun.position.copy(target).addScaledVector(sunDir, 50);
  sun.target.position.copy(target);
  fill.position.copy(target).addScaledVector(_r, 30).addScaledVector(_u, -20).addScaledVector(_f, -10);
  fill.target.position.copy(target);
  ship.setSunDirection(sunDir);
}

// --- post ---------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold));
composer.addPass(new OutputPass());

// --- the ship -----------------------------------------------------------------
const ship = createShip();
scene.add(ship.group);
window.ship = ship;

let ground = null;
function addGround() {
  const g = new THREE.CircleGeometry(40, 64);
  g.rotateX(-Math.PI / 2);
  ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 1 }));
  ground.position.y = GROUND_Y;
  scene.add(ground);
}

const fixedStep = (seconds) => {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) ship.update(1 / 60);
};

const look = new THREE.Vector3();

/** Each view: states, camera, then how long to let things run. */
const VIEWS = {
  chase() {
    const s = SHIP.flightScale;
    ship.group.scale.setScalar(s);
    ship.setWingsFolded(true, true);
    ship.setThrottle(0.7);
    fixedStep(2);
    // Her idle glance toward the camera side (every 5-8 s in play); catch one.
    // &moment=idle shows an ordinary moment instead, &moment=wave the wave.
    const moment = params.get('moment') || 'glance';
    if (moment === 'glance') { ship.girlGlance(1); fixedStep(0.75); }
    if (moment === 'wave') { ship.girlWave(1); fixedStep(1.0); }
    if (moment === 'turn') { ship.setTurn(1); fixedStep(0.6); }
    camera.position.copy(CHASE_CAMERA.offset);
    look.copy(CHASE_CAMERA.lookAt);
    camera.lookAt(look);
  },
  hero() {
    ship.setThrottle(1);
    ship.setLegs(false, true);
    fixedStep(1.2);
    camera.position.set(-7.2, 2.9, -8.4);
    look.set(0.4, -0.1, 0.6);
    camera.lookAt(look);
  },
  side() {
    ship.setThrottle(0.45);
    fixedStep(1.2);
    camera.position.set(-10.5, 0.9, 0.9);
    look.set(0, 0, 0.6);
    camera.lookAt(look);
    waitStrobe();
  },
  solarUnfolding() {
    ship.setWingsFolded(true, true);
    ship.setSolarWings(1);
    fixedStep(Number(params.get('at_t') || 2.0));
    camera.position.set(-9.5, 8.0, 12.5);
    look.set(0, 0.2, 0.8);
    camera.lookAt(look);
  },
  hatchOpening() {
    addGround();
    ship.setWingsFolded(true, true);
    ship.setLegs(true);
    ship.setHatch(true);
    fixedStep(Number(params.get('at_t') || 0.9));
    camera.position.set(-8.2, 1.2, -6.6);
    look.set(-0.4, -0.7, -0.2);
    camera.lookAt(look);
  },
  wingsFolding() {
    ship.setWingsFolded(true);
    fixedStep(0.95);
    camera.position.set(-6.0, 5.2, 7.5);
    look.set(0, -0.2, 0.2);
    camera.lookAt(look);
  },
  folded() {
    ship.setWingsFolded(true, true);
    ship.setThrottle(0.35);
    fixedStep(2.2);
    camera.position.set(-6.0, 5.2, 7.5);
    look.set(0, -0.2, 0.2);
    camera.lookAt(look);
  },
  solarDeployed() {
    ship.setWingsFolded(true, true);
    ship.setSolarWings(1, true);
    ship.setThrottle(0.3);
    fixedStep(2.2);
    camera.position.set(-9.5, 8.0, 12.5);
    look.set(0, 0.2, 0.8);
    camera.lookAt(look);
  },
  claw() {
    ship.setWingsFolded(true, true);
    ship.setClaw({ extended: true, closed: false }, true);
    fixedStep(1.5);
    camera.position.set(-4.4, 0.4, -8.2);
    look.set(0, -0.6, -2.6);
    camera.lookAt(look);
  },
  landed() {
    addGround();
    ship.setWingsFolded(true, true);
    ship.setLegs(true, true);
    ship.setHatch(true, true);
    fixedStep(2.5);
    camera.position.set(-8.2, 1.2, -6.6);
    look.set(-0.4, -0.7, -0.2);
    camera.lookAt(look);
    // Mark the exit the surface scene will use.
    const ex = ship.getHatchExit();
    const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 24), new THREE.MeshBasicMaterial({ color: 0x46e0ff, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(ex.position).setY(GROUND_Y + 0.01);
    scene.add(m);
  },
  cockpit() {
    ship.setWingsFolded(true, true);
    ship.setGirlLook(0.12);
    fixedStep(1.5);
    camera.position.set(-0.45, 1.55, -2.95);
    look.set(0, 1.2, -0.7);
    camera.lookAt(look);
  },
  rcs() {
    ship.setWingsFolded(true, true);
    fixedStep(1.0);
    ship.setTurn(1);
    fixedStep(0.45);
    camera.position.set(0.8, 9.5, 3.2);
    look.set(0, 0, -0.1);
    camera.lookAt(look);
  },
  turntable() {
    camera.position.set(-9, 4.5, 9);
    look.set(0, 0, 0);
    camera.lookAt(look);
  },
};

/** Debug overrides: &cam=x,y,z &at=x,y,z &bg=hex &t=seconds &name=suffix */
/** Step until the white strobe is lit, so a shot shows it. */
function waitStrobe() {
  for (let i = 0; i < 120 && ship.fx.strobeWait() > 0; i++) ship.update(1 / 60);
}

function overrides() {
  const v = (k) => params.get(k)?.split(',').map(Number);
  if (params.get('bg')) scene.background = new THREE.Color(`#${params.get('bg')}`);
  if (v('cam')) camera.position.set(...v('cam'));
  // &orbit=yawDeg,pitchDeg,dist : camera round the ship from behind (+Z),
  // yaw toward +X (starboard), pitch down onto it.
  if (v('orbit')) {
    const [yd, pd, d] = v('orbit');
    const y = THREE.MathUtils.degToRad(yd), p = THREE.MathUtils.degToRad(pd);
    camera.position.set(Math.sin(y) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(y) * Math.cos(p) * d).add(v('at') ? new THREE.Vector3(...v('at')) : look);
  }
  if (v('at')) look.set(...v('at'));
  if (v('cam') || v('at') || v('orbit')) camera.lookAt(look);
  if (params.get('t')) fixedStep(Number(params.get('t')));
  if (params.has('nofill')) ship.body.getObjectByName('cockpitFill').visible = false;
}

async function shoot() {
  const setup = VIEWS[VIEW];
  if (!setup) throw new Error(`unknown view "${VIEW}"`);
  setup();
  overrides();
  aimLights(ship.group.position);
  for (let i = 0; i < 3; i++) composer.render();

  // Draw calls of the ship alone (no stars, no post).
  const stars = scene.getObjectByName('stars');
  stars.visible = false;
  if (ground) ground.visible = false;
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.render(scene, camera);
  window.__drawCalls = renderer.info.render.calls;
  renderer.info.autoReset = true;
  stars.visible = true;
  if (ground) ground.visible = true;

  composer.render();
  const url = renderer.domElement.toDataURL('image/png');
  const name = `ship_${VIEW}${params.get('name') ? `_${params.get('name')}` : ''}`;
  const res = await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
  if (!res.ok) throw new Error(`shot upload failed: ${res.status}`);
  window.__shot = true;
}

// --- interactive turntable ----------------------------------------------------
function interactive() {
  (VIEWS[VIEW] || VIEWS.turntable)();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(look);
  controls.enableDamping = true;
  const st = { wings: false, solar: false, clawExt: false, clawClosed: false, legs: false, hatch: false, throttle: 0, precision: false, spin: VIEW === 'turntable' };
  const keys = new Set();
  const help = () => {
    hud.textContent = [
      `view: ${VIEW}   draw calls (ship): ${window.__drawCalls ?? '?'}`,
      `[F] wings folded: ${st.wings}   [G] solar wings: ${st.solar}`,
      `[C] claw out: ${st.clawExt}   [X] claw closed: ${st.clawClosed}`,
      `[L] legs down: ${st.legs}   [H] hatch open: ${st.hatch}`,
      `[W/S] throttle: ${st.throttle.toFixed(2)}   [Shift] precision: ${st.precision}`,
      `[A/D] hold to turn (RCS)   [R] spin: ${st.spin}   [K] girl waves`,
      'mouse: orbit / zoom',
    ].join('\n');
  };
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'f') ship.setWingsFolded((st.wings = !st.wings));
    if (k === 'g') ship.setSolarWings((st.solar = !st.solar) ? 1 : 0);
    if (k === 'c') ship.setClaw({ extended: (st.clawExt = !st.clawExt) });
    if (k === 'x') ship.setClaw({ closed: (st.clawClosed = !st.clawClosed) });
    if (k === 'l') ship.setLegs((st.legs = !st.legs));
    if (k === 'h') ship.setHatch((st.hatch = !st.hatch));
    if (k === 'w') st.throttle = Math.min(1, st.throttle + 0.25);
    if (k === 's') st.throttle = Math.max(-1, st.throttle - 0.25);
    if (k === 'r') st.spin = !st.spin;
    if (k === 'k') ship.girlWave(Math.random() < 0.5 ? 1 : -1);
    if (e.key === 'Shift') st.precision = true;
    ship.setThrottle(st.throttle);
    ship.setPrecision(st.precision);
    help();
  });
  addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys.delete(k);
    if (e.key === 'Shift') { st.precision = false; ship.setPrecision(false); help(); }
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });
  const clock = new THREE.Clock();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    ship.setTurn((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0));
    if (st.spin) ship.group.rotation.y += dt * 0.25;
    ship.update(dt);
    controls.update();
    aimLights(controls.target);
    composer.render();
    if (++frames === 5) {
      window.__drawCalls = renderer.info.render.calls;
      help();
    }
  });
  help();
  window.__ready = true;
}

try {
  if (SHOT) shoot().catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
  else interactive();
} catch (e) {
  console.error(e);
  window.__error = String(e?.stack || e);
}
