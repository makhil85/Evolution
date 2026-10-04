// Planets lab - the review page for part B (Sun, planets, moons, rings).
//
//   space-lab/planets.html?view=<name>[&shot=1][&live=1][&t=<seconds>]
//
// Renders with the same settings the game uses (contracts RENDER: log depth,
// ACES, bloom), from a set of named camera setups. With &shot=1 the frame is
// POSTed to /__shot and lands in docs/progress/planets_<view>.png.
// window.__shot = true when saved, window.__error on failure,
// window.__stats = { calls, triangles, ms } for the scene pass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BODIES, BODY_ORDER, RENDER, SPACE_LIGHT } from '../contracts.js';
import { createBodies } from '../planets.js';

const params = new URLSearchParams(location.search);
const VIEW = params.get('view') || 'earth';
const SHOT = params.has('shot');
const LIVE = params.has('live');
const W = 1600;
const H = 900;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// camera setups
// ---------------------------------------------------------------------------
//
// angles: where bodies sit on their orbits. Planets: heliocentric degrees.
//         Moons: degrees from the parent->Sun direction (0 = sun side).
// cam:    { focus, dist (radii), az (deg from the focus->Sun direction),
//           el (deg), aim: [yaw, pitch] deg shift of the view, fov }
// time:   simulation seconds (spin, clouds, Jupiter flow, Sun surface)

const VIEWS = {
  earth: {
    time: 115, angles: { earth: 0, moon: 250 },
    cam: { focus: 'earth', dist: 3.1, az: 62, el: 16, aim: [0, 0] },
  },
  earthNight: {
    time: 188, angles: { earth: 0, moon: 60 },
    cam: { focus: 'earth', dist: 2.5, az: 150, el: 24, aim: [0, 0] },
  },
  moon: {
    time: 0, angles: { earth: 0, moon: 145 },
    cam: { focus: 'moon', dist: 3.2, az: 62, el: 8, aim: [0, 0] },
  },
  mars: {
    time: 90, angles: { mars: 40 },
    cam: { focus: 'mars', dist: 3.0, az: 55, el: 12, aim: [0, 0] },
  },
  jupiter: {
    // Io sits sunward of Jupiter, so its shadow falls on the cloud tops;
    // Europa and Ganymede hang beside the planet.
    time: 40, angles: { jupiter: 120, io: 6, europa: 158, ganymede: 262, callisto: 120 },
    cam: { focus: 'jupiter', dist: 4.4, az: 36, el: 6, aim: [0, 0] },
  },
  europa: {
    time: 30, angles: { jupiter: 120, io: 82, europa: 70, ganymede: 200, callisto: 300 },
    special: 'europa',
  },
  europaGlobe: {
    // The whole goal moon, trailing hemisphere (brown staining, Pwyll's rays).
    time: 30, angles: { jupiter: 120, io: 300, europa: 100, ganymede: 200, callisto: 20 },
    cam: { focus: 'europa', dist: 3.3, az: 35, el: 12, aim: [0, 0] },
  },
  saturn: {
    time: 50, angles: { saturn: 200 },
    cam: { focus: 'saturn', dist: 4.4, az: 72, el: 26, aim: [0, 0] },
  },
  sun: {
    time: 20, angles: { earth: 0 },
    cam: { focus: 'sun', dist: 9, az: 0, el: 3, aim: [14, 6] },
  },
  system: {
    time: 60, angles: { earth: 0, moon: 300 },
    special: 'system',
  },
  ioGanymedeCallisto: {
    time: 70, angles: { jupiter: 120 },
    special: 'trio',
  },
};

// ---------------------------------------------------------------------------
// renderer, matching contracts RENDER
// ---------------------------------------------------------------------------

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
if (SHOT) document.body.classList.add('shot');

const scene = new THREE.Scene();
scene.background = new THREE.Color(SPACE_LIGHT.background);
const camera = new THREE.PerspectiveCamera(RENDER.fov, W / H, RENDER.near, RENDER.far);
scene.add(camera);

buildLabStars();

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold));
composer.addPass(new OutputPass());

// view chooser
const bar = document.getElementById('bar');
for (const name of Object.keys(VIEWS)) {
  const a = document.createElement('a');
  a.href = `?view=${name}${LIVE ? '&live=1' : ''}`;
  a.textContent = name;
  if (name === VIEW) a.className = 'on';
  bar.appendChild(a);
}

// ---------------------------------------------------------------------------
// layout helpers
// ---------------------------------------------------------------------------

function layout(angles) {
  const pos = {};
  for (const id of BODY_ORDER) {
    const b = BODIES[id];
    if (!b.parent) { pos[id] = { x: 0, z: 0 }; continue; }
    const par = pos[b.parent];
    let a;
    if (angles[id] !== undefined) {
      const base = b.parent === 'sun' ? 0 : Math.atan2(-par.z, -par.x);
      a = base + angles[id] * DEG;
    } else {
      a = b.phase;
    }
    pos[id] = { x: par.x + b.orbit * Math.cos(a), z: par.z + b.orbit * Math.sin(a) };
  }
  return pos;
}

/** Camera heliocentric position from a focus-relative spec. */
function place(pos, { focus, dist, az, el }) {
  const f = pos[focus];
  const R = BODIES[focus].radius;
  let sx = -f.x, sz = -f.z;
  const sl = Math.hypot(sx, sz);
  if (sl < 1e-6) { sx = 1; sz = 0; } else { sx /= sl; sz /= sl; }
  const px = -sz, pz = sx;
  const ca = Math.cos(az * DEG), sa = Math.sin(az * DEG);
  const ce = Math.cos(el * DEG), se = Math.sin(el * DEG);
  const dx = ce * (ca * sx + sa * px);
  const dz = ce * (ca * sz + sa * pz);
  return new THREE.Vector3(f.x + dx * dist * R, se * dist * R, f.z + dz * dist * R);
}

function aimView(yaw = 0, pitch = 0) {
  camera.rotateY(yaw * DEG);
  camera.rotateX(pitch * DEG);
}

/** Set camera from heliocentric position + heliocentric look target. Returns origin. */
function setCamera(camH, lookH, fov = RENDER.fov) {
  const origin = { x: camH.x, z: camH.z };
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.position.set(0, camH.y, 0);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookH.x - origin.x, lookH.y, lookH.z - origin.z);
  return origin;
}

function setupView(v, pos) {
  if (v.special === 'europa') {
    // The finale: just above Europa's anti-Jupiter side, Jupiter rising over the ice.
    const E = pos.europa, J = pos.jupiter;
    const ux = (E.x - J.x), uz = (E.z - J.z);
    const ul = Math.hypot(ux, uz);
    const a = 11.3, b = 11.3;
    const camH = new THREE.Vector3(E.x + (ux / ul) * a, b, E.z + (uz / ul) * a);
    const o = setCamera(camH, new THREE.Vector3(J.x, 0, J.z), 38);
    aimView(-6, -7);
    return o;
  }
  if (v.special === 'trio') {
    // Showcase row: Io, Ganymede, Callisto side by side, Jupiter behind.
    const J = pos.jupiter;
    let sx = -J.x, sz = -J.z;
    const sl = Math.hypot(sx, sz); sx /= sl; sz /= sl;
    const a = 42 * DEG;
    const dx = Math.cos(a) * sx - Math.sin(a) * sz, dz = Math.sin(a) * sx + Math.cos(a) * sz;
    const C = { x: J.x + dx * 1000, z: J.z + dz * 1000 };
    const fx = -dx, fz = -dz;          // forward (toward Jupiter)
    const rx = -fz, rz = fx;           // right
    const put = (id, along, side) => { pos[id] = { x: C.x + fx * along + rx * side, z: C.z + fz * along + rz * side }; };
    put('io', 72, 36);
    put('ganymede', 112, -3);
    put('callisto', 96, -42);
    put('europa', 600, 400);
    const o = setCamera(new THREE.Vector3(C.x, 16, C.z), new THREE.Vector3(J.x, 0, J.z));
    aimView(0, -4);
    return o;
  }
  if (v.special === 'system') {
    // From beside Earth, looking outward: the Sun at the left edge; Mars,
    // Jupiter and Saturn out in the dark as glows.
    const E = pos.earth;
    const sunAng = Math.atan2(-E.z, -E.x);
    const look = sunAng + 36 * DEG;          // the view direction (Sun 36 deg to the left)
    const aimAt = (id, off) => {
      const b = BODIES[id];
      const ang = look + off * DEG;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      // ray from Earth: |E + s u| = r
      const bq = E.x * ux + E.z * uz;
      const cq = E.x * E.x + E.z * E.z - b.orbit * b.orbit;
      const s = -bq + Math.sqrt(bq * bq - cq);
      pos[id] = { x: E.x + ux * s, z: E.z + uz * s };
    };
    aimAt('mars', -14);
    aimAt('jupiter', 12);
    aimAt('saturn', 27);
    aimAt('ceres', 3);
    // re-seat Jupiter's moons around the moved Jupiter
    for (const [id, deg] of [['io', 40], ['europa', 150], ['ganymede', 250], ['callisto', 320]]) {
      const b = BODIES[id], J = pos.jupiter;
      const a = Math.atan2(-J.z, -J.x) + deg * DEG;
      pos[id] = { x: J.x + b.orbit * Math.cos(a), z: J.z + b.orbit * Math.sin(a) };
    }
    const back = 170;
    const side = -95; // Earth sits to the right of frame
    const camH = new THREE.Vector3(E.x - Math.cos(look) * back + Math.cos(look + Math.PI / 2) * side, 45, E.z - Math.sin(look) * back + Math.sin(look + Math.PI / 2) * side);
    const o = setCamera(camH, new THREE.Vector3(camH.x + Math.cos(look) * 1000, 0, camH.z + Math.sin(look) * 1000));
    return o;
  }
  const c = v.cam;
  const camH = place(pos, c);
  const f = pos[c.focus];
  const o = setCamera(camH, new THREE.Vector3(f.x, 0, f.z), c.fov);
  aimView(c.aim?.[0], c.aim?.[1]);
  return o;
}

// ---------------------------------------------------------------------------
// go
// ---------------------------------------------------------------------------

async function main() {
  if (VIEW !== 'all' && !VIEWS[VIEW]) throw new Error(`unknown view ${VIEW}`);
  const bodies = createBodies({ scene, renderer, camera });
  window.__bodies = bodies;
  await bodies.ready;
  // ?view=all renders and saves every view from one page load.
  const names = VIEW === 'all' ? Object.keys(VIEWS) : [VIEW];
  window.__statsAll = {};
  for (const name of names) await runView(name, bodies);
  window.__ready = true;
  if (SHOT) window.__shot = true;
}

async function runView(name, bodies) {
  const v = VIEWS[name];
  const positions = layout(v.angles || {});
  const origin = setupView(v, positions);
  let time = params.has('t') ? Number(params.get('t')) : v.time;

  // Debug toggles from the URL (survive HMR reloads):
  //   &hide=earth-atmosphere,earth-clouds   &set=jupiter-surface.uLimb=0;jupiter-surface.uAmbient=0
  for (const n of (params.get('hide') || '').split(',').filter(Boolean)) {
    const o = scene.getObjectByName(n);
    if (o) o.visible = false;
  }
  for (const kv of (params.get('set') || '').split(';').filter(Boolean)) {
    const [lhs, val] = kv.split('=');
    const [objName, uni] = lhs.split('.');
    const o = scene.getObjectByName(objName);
    const u = o?.material?.uniforms?.[uni];
    if (!u) continue;
    if (typeof u.value === 'number') u.value = Number(val);
    else if (u.value?.isColor || u.value?.isVector3) u.value.setScalar ? u.value.setScalar(Number(val)) : u.value.setRGB(+val, +val, +val);
  }
  const hideSet = (params.get('hide') || '').split(',').filter(Boolean);
  const frame = () => {
    bodies.update({ dt: 1 / 60, time, positions, origin, camera });
    for (const n of hideSet) { const o = scene.getObjectByName(n); if (o) o.visible = false; }
    composer.render();
  };
  // Debug hook: tweak uniforms from the console, then __lab.snap('name').
  window.__lab = {
    bodies, positions, origin, camera, scene,
    setTime(t) { time = t; frame(); },
    frame,
    async snap(name = `planets_${VIEW}_dbg`, crop = null) {
      frame();
      let url = renderer.domElement.toDataURL('image/png');
      if (crop) {
        const [x, y, w, h] = crop;
        const c2 = document.createElement('canvas');
        c2.width = w; c2.height = h;
        c2.getContext('2d').drawImage(renderer.domElement, x, y, w, h, 0, 0, w, h);
        url = c2.toDataURL('image/png');
      }
      await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
      return name;
    },
  };

  if (LIVE) {
    let last = performance.now();
    const loop = (now) => {
      time += (now - last) / 1000;
      last = now;
      frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__ready = true;
    return;
  }

  for (let i = 0; i < 3; i++) frame();

  // Stats for the scene pass alone.
  renderer.info.autoReset = false;
  renderer.info.reset();
  renderer.render(scene, camera);
  const calls = renderer.info.render.calls;
  const triangles = renderer.info.render.triangles;
  renderer.info.autoReset = true;
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  const N = 20;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    bodies.update({ dt: 1 / 60, time, positions, origin, camera });
    composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
  const ms = (performance.now() - t0) / N;
  frame();
  window.__stats = { calls, triangles, ms: Math.round(ms * 100) / 100 };
  window.__statsAll[name] = window.__stats;
  console.log('[planets lab]', name, window.__stats);

  if (SHOT) {
    const url = renderer.domElement.toDataURL('image/png');
    const outName = (VIEW !== 'all' && params.get('name')) || `planets_${name}`;
    const res = await fetch(`/__shot?name=${outName}`, { method: 'POST', body: url });
    if (!res.ok) throw new Error(`shot upload failed: ${res.status}`);
  }
}

main().catch((e) => { console.error(e); window.__error = String(e?.stack || e); });

/** A plain lab star field (the real sky is another module's job). */
function buildLabStars() {
  const n = 5000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(t) * 200000, u * 200000, r * Math.sin(t) * 200000], i * 3);
    const b = Math.pow(rnd(), 3) * 0.9 + 0.08;
    c.setHSL(0.08 + rnd() * 0.5, 0.25, 0.5).multiplyScalar(b * 1.6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  stars.renderOrder = -10;
  scene.add(stars); // the lab camera always sits near the scene origin
}
