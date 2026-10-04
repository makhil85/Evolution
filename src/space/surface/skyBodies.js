// Surface scenes - what hangs in the sky: Earth over the Moon, Jupiter (and
// Io) over Europa, and the Sun's disc.
//
// They reuse the flight scene's body shaders (bodyShaders.js), so Earth has
// the same oceans, clouds, city lights and blue rim she flew past, and
// Jupiter the same flowing bands and Red Spot. They are built at a fixed
// distance and ride along with the camera (like a skybox with depth), so
// walking 50 m never shifts them against the horizon.
//
// Jupiter is turned so the Great Red Spot faces her, on the sunlit side, and
// Io is placed on the Sun's line through Jupiter so its shadow is a small
// black dot on the cloud tops next to the moon itself - the famous "transit
// shadow" photo.
import * as THREE from 'three';
import { TEXTURE_BASE } from '../contracts.js';
import { surfaceMaterial, cloudMaterial, atmosphereMaterial } from '../bodyShaders.js';
import { LAYOUT, skyDir } from './layout.js';

const DIST = 9000;                 // m from the camera
const DEG = Math.PI / 180;
/** Great Red Spot in 2k_jupiter.jpg UV (same value planets.js uses). */
const GRS_UV = [0.364, 0.397];

function glowTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.07, 'rgba(255,255,255,1)');
  grd.addColorStop(0.1, 'rgba(255,245,225,0.55)');
  grd.addColorStop(0.25, 'rgba(255,225,190,0.12)');
  grd.addColorStop(0.6, 'rgba(255,210,170,0.025)');
  grd.addColorStop(1, 'rgba(255,200,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Find a baked procedural map in the flight scene's bodies (Io), if any. */
function findBodyMap(game, id) {
  let map = null;
  game?.bodies?.root?.traverse?.((o) => {
    if (!map && o.name === `${id}-surface`) map = o.material?.uniforms?.map?.value || null;
  });
  return map;
}

/** A small painted Io for when the flight scene is not around (labs). */
function paintIo() {
  const W = 512, Hh = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  g.fillStyle = '#e2cf78';
  g.fillRect(0, 0, W, Hh);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * Hh, rad = 3 + r() * 26;
    const col = r() < 0.5 ? 'rgba(214,150,70,0.35)' : r() < 0.5 ? 'rgba(240,232,190,0.35)' : 'rgba(170,120,60,0.3)';
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = r() * Hh, rad = 1.5 + r() * 4;
    g.fillStyle = 'rgba(40,28,20,0.9)';
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {{ body: 'moon'|'europa', sunDir: THREE.Vector3, game?: object, renderer: THREE.WebGLRenderer }} o
 */
export function createSkyBodies({ body, sunDir, game, renderer }) {
  const group = new THREE.Group();
  group.name = 'sky-bodies';
  const loader = new THREE.TextureLoader();
  const pending = [];
  const owned = [];   // disposables
  const maxAniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const tex = (name, srgb = true) => {
    let done;
    pending.push(new Promise((ok) => { done = ok; }));
    const t = loader.load(TEXTURE_BASE + name, () => done(), undefined, () => done());
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    t.wrapS = THREE.RepeatWrapping;
    owned.push(t);
    return t;
  };
  const sphere = new THREE.SphereGeometry(1, 128, 64);
  owned.push(sphere);
  const mats = [];
  const updaters = [];

  // --- the Sun's disc -----------------------------------------------------------
  const L = LAYOUT[body];
  const sunTex = glowTexture();
  owned.push(sunTex);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex,
    color: new THREE.Color(1, 0.96, 0.9).multiplyScalar(body === 'moon' ? 9 : 8),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  mats.push(sunSprite.material);
  // The texture's white core is 7-10% of its radius: size so that core is the disc.
  const sunScale = 2 * DIST * Math.tan(L.sun.discDeg * DEG) / 0.17;
  sunSprite.scale.setScalar(sunScale);
  sunSprite.position.copy(sunDir).multiplyScalar(DIST * 1.1);
  sunSprite.renderOrder = -900;
  group.add(sunSprite);

  // --- Earth (from the Moon) ------------------------------------------------------
  if (body === 'moon') {
    const e = L.earth;
    const dir = skyDir(e.az, e.el);
    const R = DIST * Math.tan(e.radiusDeg * DEG);
    const center = dir.clone().multiplyScalar(DIST);
    const earth = new THREE.Group();
    earth.position.copy(center);
    // North up-ish, tilted a little, and turned so Africa/Europe face her.
    earth.rotation.set(0.12, 0, -0.35);
    group.add(earth);
    const spin = new THREE.Group();
    spin.rotation.y = 2.2;
    earth.add(spin);
    const clouds = tex('2k_earth_clouds.jpg', false);
    const surf = surfaceMaterial({
      map: tex('2k_earth_daymap.jpg'), kind: 'earth', gain: 1.25, wrap: 0.04, twilight: 0xff9050, twilightAmt: 0.3,
      saturation: 1.12, contrast: 1.04, ambient: 0.35,
      earth: { night: tex('2k_earth_nightmap.jpg'), clouds, cityGain: 3.4 },
    });
    const m = new THREE.Mesh(sphere, surf);
    m.scale.setScalar(R);
    spin.add(m);
    const cmat = cloudMaterial(clouds);
    const cm = new THREE.Mesh(sphere, cmat);
    cm.scale.setScalar(R * 1.006);
    spin.add(cm);
    const atmo = atmosphereMaterial({ scatter: 0x5aa8ff, twilight: 0xffb070, density: 0.3, height: 0.14, mie: 0.6, ext: 0.3, veil: 0.6 });
    const ra = R * 1.03;
    atmo.uniforms.uRp.value = R;
    atmo.uniforms.uRa.value = ra;
    const am = new THREE.Mesh(sphere, atmo);
    am.scale.setScalar(ra * 1.012);
    earth.add(am);
    mats.push(surf, cmat, atmo);
    [m, cm, am].forEach((o) => { o.frustumCulled = false; o.renderOrder = -800; });
    let t = 0;
    const wp = new THREE.Vector3();
    updaters.push((dt) => {
      t += dt;
      surf.uniforms.uSunDir.value.copy(sunDir);
      cmat.uniforms.uSunDir.value.copy(sunDir);
      atmo.uniforms.uSunDir.value.copy(sunDir);
      surf.uniforms.uCloudRot.value = t * 0.004;
      cm.rotation.y = t * 0.004;
      earth.getWorldPosition(wp);
      atmo.uniforms.uCenter.value.copy(wp);
    });
  }

  // --- Jupiter + Io (from Europa) ---------------------------------------------------
  let jupiterInfo = null;
  if (body === 'europa') {
    const J = L.jupiter;
    const v = skyDir(J.az, J.el);                 // camera -> Jupiter
    const R = DIST * Math.tan(J.radiusDeg * DEG);
    const flat = 0.935;
    const center = v.clone().multiplyScalar(DIST);
    // Orientation: the pole lies on the limb (axis perpendicular to the view),
    // leaning a little off vertical; the Red Spot's longitude faces her,
    // swung toward the sunlit side.
    const up = new THREE.Vector3(0.18, 1, 0).normalize();
    const A = up.clone().addScaledVector(v, -up.dot(v)).normalize();
    const sPerp = sunDir.clone().addScaledVector(A, -sunDir.dot(A)).addScaledVector(v, -sunDir.dot(v));
    const face = v.clone().negate().addScaledVector(sPerp.normalize(), 0.42).normalize();
    // Local frame (g = Red Spot's longitude direction, Y, g x Y) -> world (face, A, face x A).
    const phi = GRS_UV[0] * Math.PI * 2;
    const g = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi)).normalize();
    const Ly = new THREE.Vector3(0, 1, 0);
    const Lm = new THREE.Matrix4().makeBasis(g, Ly, new THREE.Vector3().crossVectors(g, Ly));
    const Wm = new THREE.Matrix4().makeBasis(face, A, new THREE.Vector3().crossVectors(face, A));
    const rot = new THREE.Matrix4().multiplyMatrices(Wm, Lm.clone().transpose());
    const jup = new THREE.Group();
    jup.position.copy(center);
    jup.quaternion.setFromRotationMatrix(rot);
    group.add(jup);

    const surf = surfaceMaterial({
      map: tex('2k_jupiter.jpg'), kind: 'gas', ambient: 1.5, gain: 1.1, wrap: 0.12, limb: 0.32,
      saturation: 1.38, contrast: 1.2, flow: { spot: GRS_UV },
    });
    const jm = new THREE.Mesh(sphere, surf);
    jm.scale.set(R, R * flat, R);
    jup.add(jm);
    const atmo = atmosphereMaterial({ scatter: 0xcfd8ee, twilight: 0xd9a070, density: 0.03, height: 0.2, mie: 0.5, flat });
    const ra = R * 1.018;
    atmo.uniforms.uRp.value = R;
    atmo.uniforms.uRa.value = ra;
    const am = new THREE.Mesh(sphere, atmo);
    am.scale.set(ra * 1.012, ra * 1.012 * flat, ra * 1.012);
    jup.add(am);
    mats.push(surf, atmo);

    // Io: on the Sun line through a point on the sunlit cloud tops, so its
    // shadow lands on the disc beside it.
    const shadowPt = center.clone().addScaledVector(
      v.clone().negate().addScaledVector(sPerp, 0.55).addScaledVector(A, 0.32).normalize(), R);
    // The shadow-caster (uOcc) sits exactly on that Sun line; the Io we DRAW
    // is placed just off the sunward limb, where the eye expects the moon
    // that is casting it (seen from Europa the two are close together).
    const occPos = shadowPt.clone().addScaledVector(sunDir, R * 1.55);
    const side = sPerp.clone().normalize();
    const ioDir = v.clone().addScaledVector(side, Math.tan((J.radiusDeg * 1.42) * DEG)).addScaledVector(A, Math.tan((J.radiusDeg * 0.5) * DEG)).normalize();
    const ioPos = ioDir.multiplyScalar(DIST * 0.8);
    const ioR = ioPos.length() * Math.tan(0.7 * DEG);
    const occR = occPos.length() * Math.tan(0.62 * DEG);
    const ioMap = findBodyMap(game, 'io') || (() => { const t = paintIo(); owned.push(t); return t; })();
    const iomat = surfaceMaterial({ map: ioMap, kind: 'rock', gain: 1.0, lunar: 0.45 });
    const io = new THREE.Mesh(sphere, iomat);
    io.scale.setScalar(ioR);
    io.position.copy(ioPos);
    io.rotation.y = 1.2;
    group.add(io);
    mats.push(iomat);
    [jm, am, io].forEach((o) => { o.frustumCulled = false; o.renderOrder = -800; });

    let t = 0;
    const wp = new THREE.Vector3();
    const ioW = new THREE.Vector3();
    updaters.push((dt) => {
      t += dt;
      surf.uniforms.uSunDir.value.copy(sunDir);
      surf.uniforms.uTime.value = 200 + t;
      atmo.uniforms.uSunDir.value.copy(sunDir);
      atmo.uniforms.uTime.value = t;
      iomat.uniforms.uSunDir.value.copy(sunDir);
      jup.getWorldPosition(wp);
      atmo.uniforms.uCenter.value.copy(wp);
      ioW.copy(occPos).add(group.position);
      // Io's shadow on Jupiter: a sharp umbra (the Sun is tiny out here).
      surf.uniforms.uOcc.value[0].set(ioW.x, ioW.y, ioW.z, occR);
      surf.uniforms.uSunAng.value = 0.0012;
    });
    jupiterInfo = { dir: v.clone(), radiusDeg: J.radiusDeg };
  }

  const ready = Promise.all(pending);

  /** Keep the bodies centred on the camera: a skybox with depth. */
  function update(dt, camera) {
    group.position.copy(camera.position);
    group.updateMatrixWorld(true);
    for (const f of updaters) f(dt);
  }

  function dispose() {
    group.removeFromParent();
    for (const m of mats) m.dispose();
    for (const o of owned) o.dispose?.();
  }

  return { group, update, dispose, ready, jupiter: jupiterInfo };
}
