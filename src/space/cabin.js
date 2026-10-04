// The zero-g cabin interlude - Act 1's "orbit is free-fall" lesson.
//
// Runs as a mini-scene via game.runScene (see main.js's contract): its own
// scene/camera, driven by tick(dt, input, mouse, modalOpen) so it works under
// window.__space.debugRun exactly like normal flight. Roughly 12-15s of her
// floating - a tumbling pencil, a wobbling water blob, a drifting notebook,
// Earth through the porthole - then the existing fact card + `cabinFloat`
// question play (a1_float's own beat), same as before this replaced the
// plain fact-card placeholder.
import * as THREE from 'three';
import { buildGirlRig, defaultChoices } from '../character/girl.js';
import { loadLook } from '../launcher/profile.js';
import { toonRamp } from '../game/toonPipeline.js';
import { TEXTURE_BASE, SPACE_LIGHT } from './contracts.js';
import { heroName } from './hud/hud.js';

const DURATION = 13.5;
const SKIP_AFTER = 2.2;

function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });
}

/** A small "Continue >" button, bottom-right, shown a couple of seconds in -
 * self-contained CSS so this module needs nothing from hud.css. */
function buildSkipButton() {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'right:26px', 'bottom:30px', 'z-index:35',
    'opacity:0', 'pointer-events:none', 'transition:opacity .5s ease',
  ].join(';');
  div.innerHTML = '<button type="button" style="'
    + 'font:600 15px system-ui,sans-serif;letter-spacing:.02em;color:#0b1220;'
    + 'background:#eef3ff;border:none;border-radius:999px;padding:11px 20px;'
    + 'box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;">Continue &#9656;</button>';
  document.body.appendChild(div);
  let skipped = false;
  div.querySelector('button').addEventListener('click', () => { skipped = true; });
  return {
    get skipped() { return skipped; },
    reveal() { div.style.opacity = '1'; div.style.pointerEvents = 'auto'; },
    remove() { div.remove(); },
  };
}

function buildStarfield() {
  const n = 800;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 30);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, geo, mat };
}

function buildWaterBlob() {
  const geo = new THREE.IcosahedronGeometry(0.09, 3);
  const mat = toon(0x8fd6ff, {
    transparent: true, opacity: 0.88,
    emissive: new THREE.Color(0x1c3a55), emissiveIntensity: 0.45,
  });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uTime;\nvoid main() {')
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        float w = sin(position.x * 9.0 + uTime * 3.1) * cos(position.y * 8.0 - uTime * 2.3)
          * sin(position.z * 10.0 + uTime * 2.7);
        transformed += normal * w * 0.045;
      `);
  };
  mat.customProgramCacheKey = () => 'cabinWaterWobble';
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, uTime };
}

function buildPencil() {
  const g = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.006, 0.006, 0.19, 8);
  g.add(new THREE.Mesh(body, toon(0xf2c14e)));
  const tip = new THREE.ConeGeometry(0.006, 0.02, 8);
  tip.translate(0, 0.105, 0);
  g.add(new THREE.Mesh(tip, toon(0x3a2a1a)));
  const lead = new THREE.ConeGeometry(0.0022, 0.007, 8);
  lead.translate(0, 0.112, 0);
  g.add(new THREE.Mesh(lead, toon(0x1a1a1a)));
  return g;
}

function buildNotebook() {
  const g = new THREE.Group();
  const cover = new THREE.BoxGeometry(0.14, 0.19, 0.008);
  g.add(new THREE.Mesh(cover, toon(0x4a7fd6)));
  const pages = new THREE.BoxGeometry(0.132, 0.182, 0.006);
  const pagesMesh = new THREE.Mesh(pages, toon(0xf5f1e6));
  pagesMesh.position.z = 0.0035;
  g.add(pagesMesh);
  return g;
}

/** A simple porthole ring; Earth and stars sit behind it in world space, so
 * the ring's own donut hole is what frames the view - no cutout geometry. */
function buildPorthole() {
  const g = new THREE.Group();
  const ring = new THREE.TorusGeometry(0.62, 0.06, 12, 40);
  g.add(new THREE.Mesh(ring, toon(0xdfe3ea)));
  const innerRim = new THREE.TorusGeometry(0.56, 0.018, 8, 40);
  g.add(new THREE.Mesh(innerRim, toon(0x2a3244)));
  return g;
}

/** Loose cockpit dressing behind/around her so she reads as "inside a ship"
 * without needing a fully modelled interior. */
function buildCabinShell() {
  const g = new THREE.Group();
  const wallMat = toon(0xcfd6e4);
  const trimMat = toon(0x5a6478);
  const backWall = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.4, 24, 1, true, Math.PI * 0.15, Math.PI * 1.7), wallMat);
  backWall.material.side = THREE.BackSide;
  backWall.rotation.y = Math.PI;
  backWall.position.z = 0.3;
  g.add(backWall);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4), trimMat);
  console_.position.set(0, -1.05, -0.8);
  g.add(console_);
  for (const dz of [-0.15, 0.15]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.02), toon(0x7ff3ff, { emissive: new THREE.Color(0x1d6a70), emissiveIntensity: 1.2 }));
    strip.position.set(0, -0.92, -0.8 + dz);
    g.add(strip);
  }
  return g;
}

/**
 * @param {object} game main.js's game object (needs hud - see runScene's contract)
 * @returns the mini-scene object game.runScene expects
 */
export function buildCabinScene(game) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE_LIGHT.background);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 200);
  camera.position.set(0, 0, 1.6);

  scene.add(new THREE.AmbientLight(SPACE_LIGHT.ambient, SPACE_LIGHT.ambientIntensity + 0.35));
  const sun = new THREE.DirectionalLight(SPACE_LIGHT.sunColor, 1.6);
  sun.position.set(1.2, 0.6, 2.2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7ea0ff, 0.35);
  fill.position.set(-1.5, -0.4, -1);
  scene.add(fill);

  scene.add(buildCabinShell());

  // Porthole + what's beyond it, a little behind the girl.
  const porthole = buildPorthole();
  porthole.position.set(-0.55, 0.32, -1.7);
  porthole.rotation.y = 0.45;
  scene.add(porthole);

  const stars = buildStarfield();
  stars.pts.position.copy(porthole.position);
  scene.add(stars.pts);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 32, 24),
    new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp }),
  );
  earth.position.set(porthole.position.x + 0.3, porthole.position.y - 0.9, porthole.position.z - 5.5);
  scene.add(earth);
  const loader = new THREE.TextureLoader();
  loader.load(TEXTURE_BASE + '2k_earth_daymap.jpg', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    earth.material.map = tex;
    earth.material.needsUpdate = true;
  });

  // Her, floating mid-cabin.
  const rig = buildGirlRig({ ...defaultChoices(), ...(loadLook() || {}) }, {
    material: new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true }),
    height: 1.3,
    outline: true,
    outlineThickness: 0.01,
  });
  rig.group.position.set(0.05, -0.25, -0.15);
  rig.group.rotation.y = 0.5;
  scene.add(rig.group);
  const by = rig.byName;

  // Small drifting props around her.
  const pencil = buildPencil();
  pencil.position.set(0.32, 0.05, 0.05);
  scene.add(pencil);

  const notebook = buildNotebook();
  notebook.position.set(-0.34, -0.15, -0.05);
  notebook.rotation.set(0.3, 0.6, 0.2);
  scene.add(notebook);

  const water = buildWaterBlob();
  water.mesh.position.set(0.42, 0.05, 0.32);
  scene.add(water.mesh);

  const skip = buildSkipButton();

  let elapsed = 0;
  let resolveDone = null;
  let factStarted = false;
  let camYaw = 0;
  let camPitch = 0;

  function animateGirl(t) {
    rig.group.position.y = -0.25 + Math.sin(t * 0.35) * 0.07;
    rig.group.rotation.y = 0.5 + t * 0.09;
    if (by.armL) { by.armL.rotation.z = -1.0 + Math.sin(t * 0.6) * 0.14; by.armL.rotation.x = 0.35 + Math.sin(t * 0.5 + 0.6) * 0.12; }
    if (by.armR) { by.armR.rotation.z = 1.0 + Math.sin(t * 0.55 + 1.1) * 0.14; by.armR.rotation.x = 0.3 + Math.sin(t * 0.48 + 1.7) * 0.12; }
    if (by.forearmL) by.forearmL.rotation.x = 0.25 + Math.sin(t * 0.7) * 0.1;
    if (by.forearmR) by.forearmR.rotation.x = 0.22 + Math.sin(t * 0.65 + 0.8) * 0.1;
    if (by.thighL) by.thighL.rotation.x = 0.22 + Math.sin(t * 0.4) * 0.09;
    if (by.thighR) by.thighR.rotation.x = -0.12 + Math.sin(t * 0.42 + 2.1) * 0.09;
    if (by.shinL) by.shinL.rotation.x = 0.18 + Math.sin(t * 0.44 + 0.4) * 0.08;
    if (by.shinR) by.shinR.rotation.x = 0.14 + Math.sin(t * 0.46 + 1.3) * 0.08;
    if (by.spine) by.spine.rotation.z = Math.sin(t * 0.3) * 0.05;
    if (by.head) by.head.rotation.y = Math.sin(t * 0.5) * 0.15;
  }

  function tick(dt, input, mouse, modalOpen) {
    elapsed += dt;
    const t = elapsed;

    animateGirl(t);
    water.uTime.value = t;
    water.mesh.position.y = 0.05 + Math.sin(t * 0.8 + 1) * 0.03;
    water.mesh.rotation.y = t * 0.4;

    pencil.rotation.set(t * 1.1, t * 0.7, t * 0.3);
    pencil.position.x = 0.32 + Math.sin(t * 0.5) * 0.08;
    pencil.position.y = 0.05 + Math.cos(t * 0.4) * 0.06;

    notebook.rotation.x += dt * 0.35;
    notebook.rotation.y += dt * 0.22;
    notebook.position.y = -0.15 + Math.sin(t * 0.6 + 2) * 0.05;

    if (!modalOpen && mouse?.dragging) {
      camYaw -= mouse.dx * 0.0025;
      camPitch = THREE.MathUtils.clamp(camPitch - mouse.dy * 0.0025, -0.3, 0.3);
    }
    const driftYaw = Math.sin(t * 0.09) * 0.12;
    camera.position.set(Math.sin(camYaw + driftYaw) * 2.4, 0.45 + camPitch, Math.cos(camYaw + driftYaw) * 2.4);
    camera.lookAt(0.05, 0.1, -0.15);

    if (!skip.shownAt && t > SKIP_AFTER) { skip.reveal(); skip.shownAt = t; }

    if (!factStarted && (t >= DURATION || skip.skipped)) {
      factStarted = true;
      skip.remove();
      game.hud.showFact({
        title: 'Everything is floating!',
        body: `${heroName()}'s pencil drifts past her nose and a drop of water wobbles in the air like jelly. `
          + 'But up here Earth’s gravity is still about 9 tenths as strong as on the ground - she is FALLING, '
          + 'all the time, just moving sideways fast enough to keep missing the ground.',
      }).then(() => resolveDone?.());
    }
  }

  return {
    scene,
    camera,
    start() { return new Promise((resolve) => { resolveDone = resolve; }); },
    tick,
    dispose() {
      skip.remove();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { m.map?.dispose(); m.dispose(); }
        }
      });
    },
  };
}
