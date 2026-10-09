// Chapter 7, Part D: the holodeck quasar (lead 2026-10-08, Star Trek style).
// The ship's computer takes her to a quasar far away. Real quasars are billions
// of light-years away, in other galaxies; the lesson says so. The scene:
//   - a holodeck grid that materialises under the hole ("loading"), then fades;
//   - a black shadow, a glowing accretion disk (hot inner edge, swirling, the
//     side moving towards us is brighter: Doppler), two thin jets, and the
//     Einstein ring when the light lines up;
//   - the starfield bent round the hole. The bending is the same rule the game
//     uses (lensLogic.js): each star is drawn twice, its bright image and its
//     faint one, from the vertex shader, so there is no full-screen pass (the
//     game's composer only has bloom; a full-screen lens pass would be a second
//     pass in main.js).
// A slow guided fly-by round the hole (about 22 s): she can steer a little
// (arrows: turn, up and down: closer or further). Then the scene resolves.
//
// main.js's runScene contract: { scene, camera, start(), tick(dt, input, mouse, modalOpen), dispose() }.
// The look: the game's bloom threshold is 1.25, so only the disk's hot inner
// edge, the jets and the Einstein ring go above it on purpose.
// Budget (CHAPTER7_PLAN.md): about 7 draw calls, under 10k triangles, no
// allocations per frame (scratch vectors below), everything disposed.
import * as THREE from 'three';
import { t } from '../level.js';
import { readMs } from '../../play/readTime.js';
import { EINSTEIN_RAD, SHADOW_SHARE } from './lensLogic.js';

const D0 = 40;                                          // the camera's usual distance: the hole's rig is scaled to it
const RS = D0 * Math.sin(SHADOW_SHARE * EINSTEIN_RAD);  // the black shadow's radius at D0 (about 3.2)
const RIN = 4.0; const ROUT = 13.0;                     // the accretion disk, inner and outer edge (rig units)
const RING_R = D0 * Math.tan(EINSTEIN_RAD);             // the Einstein ring's radius at D0 (about 8.1)
const RING_Q = RING_R * 1.15;                           // the ring's glow square's half-side
const SKY_R = 300;                                      // the starfield's distance (inside the far plane)
const TILT = { x: 0.62, z: 0.18 };                      // the disk's tilt: the jets point along its normal
const LOAD_S = 4;                                       // the holodeck loads for this long
const FLY_S = 22;                                       // then the guided fly-by
// The captions, [Level 4, Level 1] as one text each. The loading words stay up for their
// reading time (readMs, 5-10 s, plus a second) even when the loading is shorter, so the
// fly-by's words wait for them.
export const CAPTIONS = Object.freeze({
  load: t('Holodeck: loading a quasar, 2.4 billion light-years away...', 'The holodeck: loading a quasar. It is very, very far away...'),
  quasar: t('A quasar like 3C 273. Its light has been on its way for 2.4 billion years.', 'A quasar! Its light has been coming for a very long time.'),
});
const LOAD_CAPTION_S = readMs(CAPTIONS.load) / 1000 + 1 + 1 / 30; // the reading time, the fade, and a frame of margin
const SKIP_AFTER = 1.5;                                 // the Continue button shows after this (cutscene rule)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => k * k * (3 - 2 * k);
const _v = new THREE.Vector3();

/** A fixed random sequence, so the sky and the holodeck look the same every visit. */
function lcg(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// --- the starfield, bent by the lens (vertex shader) ------------------------------------------

const SKY_VERT = /* glsl */`
attribute float aSign;
attribute float aSize;
attribute float aBright;
attribute vec3 aColor;
uniform vec3 uHole;
uniform float uThetaE;
uniform float uShadow;
uniform float uPx;
uniform float uShow;
uniform float uRsky;
varying vec3 vCol;
varying float vI;
void main() {
  vec3 d = normalize(position);
  float c = clamp(dot(d, uHole), -1.0, 1.0);
  vec3 perp = d - c * uHole;
  float pl = length(perp);
  vec3 e = pl > 1e-4 ? perp / pl : normalize(cross(uHole, vec3(0.0, 1.0, 0.0)));
  float beta = acos(c) / uThetaE;                 // the true offset, in Einstein radii
  float root = sqrt(beta * beta + 4.0);
  // The bright image (aSign +1) and the faint one (-1): theta = (beta +- sqrt(beta^2 + 4)) / 2.
  float th = 0.5 * (beta + aSign * root) * uThetaE;
  vec3 dir = cos(th) * uHole + sin(th) * e;
  float mu = abs(0.5 + aSign * (beta * beta + 2.0) / (2.0 * max(beta, 1e-3) * root));
  // Capped below the bloom threshold (1.25): with colours at most 1.0 only the disk edge, jets and ring bloom.
  vI = aBright * min(mu, 1.15) * step(uShadow, abs(th)) * uShow;
  vCol = aColor;
  gl_PointSize = uPx * aSize * (0.8 + 0.1 * min(mu, 4.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * uRsky, 1.0);
}`;

const SKY_FRAG = /* glsl */`
varying vec3 vCol;
varying float vI;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0 || vI <= 0.0) discard;
  gl_FragColor = vec4(vCol * vI * exp(-r2 * 4.0), 1.0);
}`;

function buildSky() {
  const rnd = lcg(7);
  const N = 520;
  const pos = new Float32Array(N * 2 * 3);
  const sign = new Float32Array(N * 2);
  const size = new Float32Array(N * 2);
  const bright = new Float32Array(N * 2);
  const col = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const b = 0.3 + 0.7 * Math.pow(rnd(), 3);
    const sz = 1 + 2.2 * Math.pow(rnd(), 6);
    const warm = rnd();
    for (let s = 0; s < 2; s++) {
      const v = i * 2 + s;
      pos.set([r * Math.cos(a), z, r * Math.sin(a)], v * 3);
      sign[v] = s === 0 ? 1 : -1;
      size[v] = sz;
      bright[v] = b;
      col.set([0.85 + 0.15 * warm, 0.9 + 0.1 * (1 - Math.abs(warm - 0.5)), 1.0], v * 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSign', new THREE.BufferAttribute(sign, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    name: 'holo-sky',
    uniforms: {
      uHole: { value: new THREE.Vector3(0, 0, -1) },
      uThetaE: { value: EINSTEIN_RAD },
      uShadow: { value: SHADOW_SHARE * EINSTEIN_RAD },
      uPx: { value: 1 },
      uShow: { value: 0 },
      uRsky: { value: SKY_R },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, mat };
}

// --- the hole: shadow, disk, jets, Einstein ring ----------------------------------------------

const DISK_VERT = /* glsl */`
varying vec3 vL;
void main() {
  vL = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Hot inside, cool outside; a spiral of bright arms turning; the side moving
// towards her (Doppler) is brighter.
const DISK_FRAG = /* glsl */`
uniform float uTime;
uniform float uFade;
uniform float uRin;
uniform float uRout;
uniform float uDop;
uniform vec3 uView;
varying vec3 vL;
void main() {
  float r = length(vL.xz);
  float rn = clamp((r - uRin) / (uRout - uRin), 0.0, 1.0);
  float phi = atan(vL.z, vL.x);
  float spiral = 0.5 + 0.5 * sin(3.0 * phi - 5.0 * log(r) + uTime * 1.3);
  float grain = 0.5 + 0.5 * sin(17.0 * phi + 2.5 * sin(9.0 * r) - uTime * 2.2);
  float heat = pow(1.0 - rn, 1.5);
  vec3 col = mix(vec3(1.0, 0.32, 0.07), vec3(3.2, 2.7, 2.0), heat);
  vec3 tang = vec3(-vL.z, 0.0, vL.x) / max(r, 1e-3);
  float dop = 1.0 + uDop * dot(tang, uView);
  float edge = smoothstep(0.0, 0.08, rn) * (1.0 - smoothstep(0.85, 1.0, rn));
  float I = (0.45 + 0.55 * spiral) * (0.5 + 0.5 * grain) * (0.25 + 0.95 * heat) * dop * edge;
  gl_FragColor = vec4(col * I * uFade, 1.0);
}`;

const JET_VERT = /* glsl */`
varying float vH;
void main() {
  vH = (position.y - 3.5) / 24.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const JET_FRAG = /* glsl */`
uniform float uTime;
uniform float uFade;
varying float vH;
void main() {
  float f = pow(clamp(1.0 - vH, 0.0, 1.0), 1.3);
  float flick = 0.8 + 0.2 * sin(vH * 40.0 - uTime * 9.0);
  vec3 col = mix(vec3(0.9, 1.4, 2.4), vec3(0.5, 0.8, 1.4), vH);
  gl_FragColor = vec4(col * f * flick * 1.9 * uFade, 1.0);
}`;

// The Einstein ring: a soft glowing circle on a square that always faces her.
const RING_FRAG = /* glsl */`
uniform float uFade;
varying vec2 vU;
void main() {
  float d = length(vU - 0.5);
  float d0 = ${(RING_R / (2 * RING_Q)).toFixed(4)};
  float core = exp(-pow((d - d0) / 0.0045, 2.0));
  float halo = 0.3 * exp(-pow((d - d0) / 0.03, 2.0));
  gl_FragColor = vec4(vec3(2.2, 1.9, 1.4) * (core + halo) * uFade, 1.0);
}`;

const RING_VERT = /* glsl */`
varying vec2 vU;
void main() {
  vU = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The holodeck floor: a cyan grid that spreads out from the centre and fades.
const GRID_VERT = /* glsl */`
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const GRID_FRAG = /* glsl */`
uniform float uReveal;
uniform float uFade;
uniform float uScan;
varying vec3 vW;
void main() {
  float r = length(vW.xz);
  vec2 g = vW.xz / 5.0;
  vec2 q = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
  float line = 1.0 - clamp(min(q.x, q.y), 0.0, 1.0);
  float reach = uReveal * 150.0;
  float inside = 1.0 - smoothstep(reach - 6.0, reach, r);
  float band = exp(-pow((r - uScan) / 3.0, 2.0));
  float fall = exp(-r / 90.0);
  gl_FragColor = vec4(vec3(0.25, 0.85, 1.0) * (line * 0.55 + band * 1.6) * fall * inside * uFade, 1.0);
}`;

function additive(extra) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });
}

/** The black hole's rig: everything in it is in "rig units" and scaled to her distance (see tick). */
function buildHole() {
  const rig = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.SphereGeometry(RS, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  rig.add(shadow);

  const tilt = new THREE.Group();
  tilt.rotation.set(TILT.x, 0, TILT.z);
  rig.add(tilt);

  const diskGeo = new THREE.RingGeometry(RIN, ROUT, 160, 6);
  diskGeo.rotateX(-Math.PI / 2); // lie flat (XZ), normal up
  const diskMat = additive({
    name: 'holo-disk',
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uFade: { value: 0 }, uRin: { value: RIN }, uRout: { value: ROUT },
      uDop: { value: 0.7 }, uView: { value: new THREE.Vector3(0, 0, 1) },
    },
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  tilt.add(disk);

  // Two jets along the disk's normal, narrow at the hole and wide at the far end.
  const jetGeo = new THREE.CylinderGeometry(2.6, 0.7, 24, 20, 1, true);
  jetGeo.translate(0, 15.5, 0);
  const jetMat = additive({
    name: 'holo-jet', side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: JET_VERT, fragmentShader: JET_FRAG,
  });
  const jets = [new THREE.Mesh(jetGeo, jetMat), new THREE.Mesh(jetGeo, jetMat)];
  jets[1].rotation.x = Math.PI;
  tilt.add(jets[0], jets[1]);

  // The ring faces her: a square with a soft circle on it (see lookAt in tick).
  const ringMat = additive({ name: 'holo-ring', uniforms: { uFade: { value: 0 } }, vertexShader: RING_VERT, fragmentShader: RING_FRAG });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
  ring.scale.setScalar(2 * RING_Q);
  rig.add(ring);

  return { rig, shadow, tilt, disk, diskMat, jets, jetMat, ring, ringMat };
}

/** The holodeck floor: a grid that materialises from the centre. */
function buildGrid() {
  const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = additive({
    name: 'holo-grid',
    uniforms: { uReveal: { value: 0 }, uFade: { value: 1 }, uScan: { value: 0 } },
    vertexShader: GRID_VERT, fragmentShader: GRID_FRAG,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -14;
  return { mesh, mat };
}

/**
 * The holodeck quasar scene (see the header). `game` gives the renderer (for the
 * point size) and the hud is not needed: the captions are on the page.
 * start() resolves when the fly-by is over, or when she presses Continue.
 * Test hook: scene.debug = { phase(), elapsed(), skip() } and window.__holo while it runs.
 */
export function buildHolodeckScene(game = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.5, 2000);
  const pr = game.renderer?.getPixelRatio?.() ?? 1;

  const sky = buildSky();
  sky.mat.uniforms.uPx.value = pr * 1.2;
  scene.add(sky.pts);
  const hole = buildHole();
  scene.add(hole.rig);
  const grid = buildGrid();
  scene.add(grid.mesh);

  let elapsed = 0;
  let steerAz = 0; let steerD = 0;
  let skipped = false; let finished = false;
  let resolveDone = null;
  let caption = null; let skipBtn = null; let shownPhase = null;
  let distance = D0;

  function phase() {
    if (elapsed < LOAD_S) return 'load';
    return elapsed < LOAD_S + FLY_S && !skipped ? 'fly' : 'done';
  }

  // Which caption is up: the loading words until they have been read, then the quasar's.
  function captionPhase() {
    const p = phase();
    return p === 'load' || (p === 'fly' && elapsed < LOAD_CAPTION_S) ? 'load' : p;
  }

  // The captions change once per phase, not every frame.
  function showCaption(p) {
    if (!caption) return;
    caption.querySelector('.holo-title').textContent = p === 'load' ? CAPTIONS.load : CAPTIONS.quasar;
    caption.querySelector('.holo-hint').textContent = p === 'fly'
      ? t('Arrows: turn. Up and down: closer or further.', 'Arrows: turn. Up and down: closer or further.')
      : '';
  }

  function tick(dt, input, mouse, modalOpen) {
    elapsed += dt;
    const te = elapsed;
    // Steering: a little, and only on the fly-by (the load is hands-off).
    if (!modalOpen && te > LOAD_S) {
      steerAz = clamp(steerAz + (input?.turn || 0) * dt * 0.6, -0.6, 0.6);
      steerD = clamp(steerD - (input?.thrust || 0) * dt * 9, -12, 12); // forward = closer
    }
    const k = smooth(clamp((te - LOAD_S) / FLY_S, 0, 1));
    const az = -0.9 + 1.8 * k + steerAz;
    const el = 0.22 + 0.07 * Math.sin(te * 0.25);
    distance = clamp(47 - 9 * k + steerD, 28, 56);
    camera.position.set(
      distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el), distance * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(0, 0, 0);

    // Loading: the grid spreads, the hole materialises, the stars come last.
    const reveal = smooth(clamp(te / 2.2));
    const grow = smooth(clamp((te - 1.2) / 2.4));
    const show = smooth(clamp((te - 3.4) / 1.2));
    grid.mat.uniforms.uReveal.value = reveal;
    grid.mat.uniforms.uScan.value = reveal * 150;
    grid.mat.uniforms.uFade.value = 1 - 0.85 * smooth(clamp((te - LOAD_S) / 1.5));
    // The rig keeps the same size on screen whatever her distance: the lens
    // angles stay the same (lensLogic.js), only the view changes.
    hole.rig.scale.setScalar((distance / D0) * Math.max(grow, 1e-3));
    hole.shadow.visible = grow > 0.01;
    hole.rig.updateMatrixWorld(true);

    _v.copy(camera.position).multiplyScalar(-1).normalize();
    sky.mat.uniforms.uHole.value.copy(_v);
    sky.mat.uniforms.uShow.value = show;
    sky.pts.position.copy(camera.position);

    _v.copy(camera.position);
    hole.tilt.worldToLocal(_v).normalize();
    hole.diskMat.uniforms.uView.value.copy(_v);
    hole.diskMat.uniforms.uTime.value = te;
    hole.diskMat.uniforms.uFade.value = grow;
    for (const j of hole.jets) j.material.uniforms.uTime.value = te;
    hole.jetMat.uniforms.uFade.value = grow;
    hole.ringMat.uniforms.uFade.value = grow;
    hole.ring.lookAt(camera.position);

    if (skipBtn && !skipBtn.shown && te > SKIP_AFTER) { skipBtn.shown = true; skipBtn.el.style.opacity = '1'; skipBtn.el.style.pointerEvents = 'auto'; }
    const p = captionPhase();
    if (p !== shownPhase) { shownPhase = p; showCaption(p); }

    if (!finished && (te >= LOAD_S + FLY_S || skipped)) {
      finished = true;
      resolveDone?.();
    }
  }

  function addPage() {
    if (typeof document === 'undefined') return;
    caption = document.createElement('div');
    caption.className = 'holo-caption';
    caption.style.cssText = [
      'position:fixed', 'left:50%', 'top:18px', 'transform:translateX(-50%)', 'z-index:35',
      'max-width:min(680px,92vw)', 'text-align:center', 'pointer-events:none',
      'font:600 17px system-ui,sans-serif', 'color:#eaf6ff', 'text-shadow:0 2px 10px #000',
    ].join(';');
    caption.innerHTML = '<div class="holo-title"></div><div class="holo-hint" style="font-size:14px;opacity:.8;margin-top:6px"></div>';
    document.body.appendChild(caption);
    const div = document.createElement('div');
    div.style.cssText = [
      'position:fixed', 'right:26px', 'bottom:30px', 'z-index:35',
      'opacity:0', 'pointer-events:none', 'transition:opacity .5s ease',
    ].join(';');
    div.innerHTML = '<button type="button" style="font:600 15px system-ui,sans-serif;color:#0b1220;'
      + 'background:#eef3ff;border:none;border-radius:999px;padding:11px 20px;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;">'
      + 'Continue &#9656;</button>';
    div.querySelector('button').addEventListener('click', () => { skipped = true; });
    document.body.appendChild(div);
    skipBtn = { el: div, shown: false };
  }

  const debug = {
    phase: () => phase(),
    elapsed: () => elapsed,
    skip() { skipped = true; },
  };

  return {
    scene,
    camera,
    debug,
    start() {
      addPage();
      if (typeof window !== 'undefined') window.__holo = debug;
      return new Promise((resolve) => { resolveDone = resolve; });
    },
    tick,
    dispose() {
      caption?.remove(); skipBtn?.el.remove();
      caption = null; skipBtn = null;
      if (typeof window !== 'undefined' && window.__holo === debug) delete window.__holo;
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of mats) m.dispose();
      });
    },
  };
}
