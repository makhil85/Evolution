// Lab only: render the girl for any choices, full-length or a face close-up,
// and save the PNG through the dev server's /__shot sink (docs/progress/).
//
//   const S = await import('/src/character/lab/shot.js');
//   await S.girlShot('name', { outfit: 'dress' }, { view: 'face', toon: false });
import * as THREE from 'three';
import { buildGirlRig, defaultChoices } from '../girl.js';
import { toonRamp } from '../../game/toonPipeline.js';

const W = 900;
const H = 900;
let renderer = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/**
 * @param {string} name  file name (docs/progress/<name>.png)
 * @param {object} choices  merged over the defaults
 * @param {{view?: 'full'|'face'|'back'|'side', toon?: boolean, clip?: string, time?: number, yaw?: number}} opts
 */
export async function girlShot(name, choices = {}, { view = 'full', toon = false, clip = 'idle', time = 0.3, yaw = 0, outline = null, shadows = true, cam = null } = {}) {
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe9f2);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x7d8f7a, toon ? 1.2 : 1.4));
  const key = new THREE.DirectionalLight(0xfff4e2, toon ? 2.2 : 2.3);
  key.position.set(2, 3.5, 3);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd8ff, 0.8);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc2d6b0 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const material = toon
    ? new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const rig = buildGirlRig({ ...defaultChoices(), ...choices }, { material, outline: outline ?? toon, outlineThickness: 0.008 });
  rig.group.rotation.y = yaw;
  scene.add(rig.group);
  const mixer = new THREE.AnimationMixer(rig.group);
  const c = rig.clips.find((k) => k.name === clip) || rig.clips[0];
  mixer.clipAction(c).play();
  mixer.update(time);

  const camera = new THREE.PerspectiveCamera(view === 'face' ? 22 : 30, W / H, 0.05, 20);
  if (cam) { camera.position.set(...cam.pos); camera.lookAt(...cam.at); }
  else if (view === 'face') { camera.position.set(0, 1.36, 0.72); camera.lookAt(0, 1.33, 0); }
  else if (view === 'back') { camera.position.set(0, 0.95, -3.0); camera.lookAt(0, 0.78, 0); }
  else if (view === 'side') { camera.position.set(3.0, 0.95, 0.3); camera.lookAt(0, 0.78, 0); }
  else { camera.position.set(0.9, 1.0, 2.9); camera.lookAt(0, 0.76, 0); }

  r.render(scene, camera);
  const res = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
  rig.geometry.dispose();
  return res.ok ? `docs/progress/${name}.png` : `failed ${res.status}`;
}
