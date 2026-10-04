// Lab page for part D: sky backdrop, asteroid belt, speed/dust FX.
//
// Usage: /space-lab/sky.html?view=<name>&shot=1
// Views: skySun, skyAway, beltFar, beltInside, rockClose, mining,
//        dustSpeed, warp.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RENDER, SPACE_LIGHT, BELT } from '../contracts.js';
import { createSky } from '../sky.js';
import { createBelt, createLabRock } from '../belt.js';
import { createDust } from '../dust.js';

const params = new URLSearchParams(location.search);
const VIEW = params.get('view') || 'skySun';
const WANT_SHOT = params.has('shot');
const W = 1600;
const H = 900;

const TONE_MAPPING = { ACESFilmic: THREE.ACESFilmicToneMapping, Neutral: THREE.NeutralToneMapping }[RENDER.toneMapping]
  ?? THREE.ACESFilmicToneMapping;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: RENDER.logarithmicDepthBuffer,
});
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = TONE_MAPPING;
renderer.toneMappingExposure = RENDER.exposure;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(RENDER.fov, W / H, RENDER.near, RENDER.far);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold));
composer.addPass(new OutputPass());

// Stand-in for the real game's Sun light + ambient fill (SPACE_LIGHT is the
// shared recipe every module assumes is present on the scene).
const sunLight = new THREE.DirectionalLight(SPACE_LIGHT.sunColor, SPACE_LIGHT.sunIntensity);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(SPACE_LIGHT.ambient, SPACE_LIGHT.ambientIntensity));

function setSunDirection(dir) {
  sunLight.position.copy(dir).multiplyScalar(2000);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight.target);
}

function addSunMarker(dir, distance = 3000, radius = 220) {
  // RENDER.bloom.threshold is 1.25 in linear HDR - a stand-in Sun needs to
  // clear that comfortably (>=2) or it renders as a flat, unlit-looking
  // disc instead of a glowing light source.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.3), toneMapped: false }),
  );
  sun.position.copy(dir).multiplyScalar(distance);
  scene.add(sun);
  return sun;
}

const sky = createSky({ scene, renderer });
const belt = createBelt({ scene, renderer });
const dust = createDust({ scene });

let frameHook = () => {};
let elapsed = 0;

async function setupView() {
  const sunDir = new THREE.Vector3(0.72, 0.22, 0.42).normalize();
  setSunDirection(sunDir);

  // The real belt ring sits at heliocentric radius ~11-13.5k regardless of
  // view; hide it for views that aren't testing belt/rock systems so it
  // doesn't photobomb the sky/dust/rock-only shots (it is otherwise always
  // in the scene graph, per createBelt()).
  const BELT_VIEWS = new Set(['beltFar', 'beltInside', 'mining']);
  belt.group.visible = BELT_VIEWS.has(VIEW);

  switch (VIEW) {
    case 'skySun': {
      camera.position.set(0, 0, 0);
      camera.lookAt(sunDir.clone().multiplyScalar(100));
      addSunMarker(sunDir);
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
      break;
    }

    case 'skyAway': {
      camera.position.set(0, 0, 0);
      camera.lookAt(sunDir.clone().multiplyScalar(-100));
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
      break;
    }

    // Pole check for the sky sphere: straight down (-Y) and straight up
    // (+Y) are exactly where the old vertex-uv sphere pinched into a
    // radiating burst.
    case 'skyDown': {
      camera.position.set(0, 0, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, -100, 0);
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
      break;
    }

    case 'skyUp': {
      camera.position.set(0, 0, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 100, 0);
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
      break;
    }

    case 'beltFar': {
      // From directly above/outside, most of the ring falls outside a
      // normal FOV (it subtends >90 deg from near the belt's own centre).
      // Frame an oblique view of the near arc instead, from outside the
      // outer radius, looking along the ring - this is what actually reads
      // as "a sparse ring" in a single 55 deg shot.
      const ringMid = (BELT.inner + BELT.outer) / 2;
      camera.position.set(0, 4200, ringMid * 2);
      camera.lookAt(0, 0, ringMid);
      const origin = { x: 0, z: 0 };
      const ship = { x: 0, z: 0 }; // far from the belt: only the visual ring shows
      frameHook = (dt, time) => {
        sky.update({ camera, sunDirection: sunDir });
        belt.update({ dt, time, origin, ship, camera });
      };
      break;
    }

    case 'beltInside': {
      const ship = { x: 12000, z: 500 };
      const origin = { x: ship.x, z: ship.z }; // floating origin centred on the ship
      belt.update({ dt: 0.016, time: 0, origin, ship, camera });
      // Frame the camera on wherever the deterministic spawner actually put
      // rocks, so the shot is well-composed regardless of density tuning.
      const centroid = new THREE.Vector3();
      for (const r of belt.nearRocks) centroid.add(new THREE.Vector3(r.x - origin.x, r.y, r.z - origin.z));
      if (belt.nearRocks.length) centroid.divideScalar(belt.nearRocks.length);
      camera.position.set(centroid.x, centroid.y + 6, centroid.z + 34);
      camera.up.set(0, 1, 0);
      camera.lookAt(centroid);
      frameHook = (dt, time) => {
        sky.update({ camera, sunDirection: sunDir });
        belt.update({ dt, time, origin, ship, camera });
      };
      break;
    }

    case 'rockClose': {
      const kinds = ['stony', 'metal', 'icy'];
      kinds.forEach((kind, i) => {
        const rock = createLabRock(kind, i);
        rock.scale.setScalar(3.2);
        rock.position.set((i - 1) * 8.5, 0, 0);
        rock.rotation.set(0.4, i * 1.3, 0.2);
        scene.add(rock);
      });
      camera.position.set(0, 2.5, 16);
      camera.lookAt(0, 0, 0);
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
      break;
    }

    case 'mining': {
      const ship = { x: 12000, z: 500 };
      const origin = { x: ship.x, z: ship.z };
      belt.update({ dt: 0.016, time: 0, origin, ship, camera });
      const target = belt.nearRocks[0];
      if (target) {
        belt.mine(target.id, target.mass * 0.5);
        // target.mesh.position is LOCAL to belt's internal floating-origin
        // group (raw heliocentric numbers) - not the camera's world space.
        // Convert the same way belt.js itself does: scene = helio - origin.
        const p = new THREE.Vector3(target.x - origin.x, target.y, target.z - origin.z);
        camera.position.set(p.x + 8, p.y + 4, p.z + 18);
        camera.lookAt(p);
      } else {
        camera.position.set(0, 3, 12);
        camera.lookAt(0, 0, 0);
      }
      frameHook = (dt, time) => {
        sky.update({ camera, sunDirection: sunDir });
        belt.update({ dt, time, origin, ship, camera });
      };
      break;
    }

    case 'dustSpeed': {
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      const velocity = new THREE.Vector3(0, 0, -42);
      frameHook = (dt) => {
        sky.update({ camera, sunDirection: sunDir });
        dust.update({ dt, camera, velocity, warp: 1 });
      };
      break;
    }

    case 'warp': {
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      const velocity = new THREE.Vector3(0, 0, -60);
      frameHook = (dt) => {
        sky.update({ camera, sunDirection: sunDir });
        dust.update({ dt, camera, velocity, warp: 64 });
      };
      break;
    }

    default: {
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      frameHook = () => { sky.update({ camera, sunDirection: sunDir }); };
    }
  }
}

async function main() {
  await sky.ready;
  await belt.ready;
  await setupView();

  // Run a handful of frames so streaks/tumble/chips have visibly evolved,
  // then render a few more times for the composer/bloom to settle before
  // the shot is taken - matches the pattern in styleMock.js.
  const dt = 1 / 60;
  // Dust/warp need several frames for streaks to build up; mining wants only
  // a couple so the just-spawned chips are still visibly mid-flight.
  const warmupFrames = VIEW === 'dustSpeed' || VIEW === 'warp' ? 24 : VIEW === 'mining' ? 12 : 6;
  for (let i = 0; i < warmupFrames; i++) {
    elapsed += dt;
    frameHook(dt, elapsed);
    composer.render();
  }
  window.__ready = true;
  // Lab debugging only: draw-call/perf inspection from the console.
  window.__renderer = renderer;
  window.__scene = scene;
  window.__camera = camera;
  window.__composer = composer;

  if (WANT_SHOT) {
    const url = renderer.domElement.toDataURL('image/png');
    await fetch('/__shot?name=' + encodeURIComponent(`sky_${VIEW}`), { method: 'POST', body: url });
    window.__shot = true;
  }
}

main().catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
