// Style comparison for Chapter 4. One composition, two treatments:
//
//   ?style=real  - photographic planet maps, atmosphere scattering rim, night
//                  lights on Earth's dark side, bloom on the Sun.
//   ?style=toon  - the same maps posterised into flat bands, a stepped light
//                  ramp, ink outlines, a hard-edged atmosphere ring.
//
// The ship and the girl are identical in both - cel-shaded, like chapters 1-3 -
// so the only thing being judged is how the SPACE around her looks.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildGirlRig, defaultChoices } from '../character/girl.js';
import { loadLook } from '../launcher/profile.js';
import { toonRamp } from '../game/toonPipeline.js';

const params = new URLSearchParams(location.search);
const STYLE = params.get('style') === 'toon' ? 'toon' : 'real';
const TOON = STYLE === 'toon';
const W = 1600;
const H = 900;
const TEX = './space/textures/';

// --- renderer ---------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = TOON ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = TOON ? 1.0 : 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
camera.position.set(1.2, 2.2, 0);
camera.lookAt(-6, -1.2, -40);

const SUN_DIR = new THREE.Vector3(-0.8, 0.42, 0.28).normalize();

// --- loading ----------------------------------------------------------------

const loader = new THREE.TextureLoader();
function tex(name, { srgb = true } = {}) {
  return new Promise((ok, fail) => loader.load(TEX + name, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    ok(t);
  }, undefined, fail));
}

/**
 * Posterise a map into flat colour bands - the texture half of cel-shading.
 * Saturation is pushed first so the bands read as colours, not greys.
 */
function posterise(texture, levels = 5, sat = 1.35) {
  const img = texture.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
    for (let k = 0; k < 3; k++) {
      const v = l + (p[i + k] - l) * sat;
      p[i + k] = Math.round(Math.max(0, Math.min(255, v)) / step) * step;
    }
  }
  g.putImageData(d, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.colorSpace = THREE.SRGBColorSpace;
  out.anisotropy = texture.anisotropy;
  return out;
}

// --- materials --------------------------------------------------------------

const INK = 0x10141f;

function planetMaterial(map) {
  if (TOON) {
    return new THREE.MeshToonMaterial({ map: posterise(map), gradientMap: toonRamp });
  }
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
}

/** Ink outline for a sphere: a slightly larger back-faced shell. */
function outlineShell(radius, width = 0.018) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * (1 + width), 96, 48),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }),
  );
}

/**
 * Atmosphere shell. Real: a soft fresnel glow brighter on the day side.
 * Toon: the same shape stepped into one hard band, like an inked halo.
 */
function atmosphere(radius, color, strength = 1.0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSun: { value: SUN_DIR.clone() },
      uStrength: { value: strength },
      uToon: { value: TOON ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vView; varying vec3 vWorldN;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uSun; uniform float uStrength; uniform float uToon;
      varying vec3 vN; varying vec3 vView; varying vec3 vWorldN;
      void main() {
        // Back-faced shell: the rim is where the view ray grazes the edge.
        float rim = 1.0 - abs(dot(vN, vView));
        float day = smoothstep(-0.35, 0.6, dot(vWorldN, uSun));
        float a;
        if (uToon > 0.5) {
          a = step(0.62, rim) * (0.25 + 0.75 * step(0.2, day)) * 0.9;
        } else {
          a = pow(rim, 3.2) * (0.15 + 1.4 * day);
        }
        gl_FragColor = vec4(uColor * uStrength, a * uStrength);
      }`,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), mat);
}

/** Radial glow sprite - the Sun's corona, the engine plume's halo. */
function glowSprite(color, size, inner = 0.0) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, inner * 128, 128, 128, 128);
  if (TOON) {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,1)');
    grad.addColorStop(0.31, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.56, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.86, 'rgba(255,255,255,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: t, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(size);
  return s;
}

// --- the sky ----------------------------------------------------------------

function buildSky(milkyWay) {
  if (!TOON) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 64, 32),
      new THREE.MeshBasicMaterial({ map: milkyWay, side: THREE.BackSide, color: 0xd8dde8 }),
    );
    sky.rotation.set(1.1, 0.4, 0.9);
    scene.add(sky);
    return;
  }
  // Toon sky: a deep indigo gradient and crisp four-point stars, no photo.
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0b0f2e');
  grad.addColorStop(0.5, '#1b1650');
  grad.addColorStop(1, '#0a1233');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));

  const n = 1400;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const tints = [0xffffff, 0xffe9a8, 0xa8d8ff, 0xffb3d9];
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1400);
    pos.set([v.x, v.y, v.z], i * 3);
    const cc = new THREE.Color(tints[i % tints.length]);
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, sizeAttenuation: false })));
}

// --- bodies -----------------------------------------------------------------

function buildSun(map) {
  const at = SUN_DIR.clone().multiplyScalar(900);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 32),
    new THREE.MeshBasicMaterial({ map: TOON ? posterise(map, 4, 1.6) : map, color: TOON ? 0xffd27a : 0xffffff }));
  sun.position.copy(at);
  scene.add(sun);
  const halo = glowSprite(TOON ? 0xffc766 : 0xffd9a0, TOON ? 230 : 420);
  halo.position.copy(at);
  scene.add(halo);
}

function buildEarth(day, night, clouds) {
  const R = 24;
  const earth = new THREE.Group();
  earth.position.set(30, -16, -62);
  earth.rotation.set(0.28, -1.9, 0.1);

  const mat = planetMaterial(day);
  if (!TOON) {
    // City lights on the night side only: the emissive term is faded by the
    // same sun angle that lights the day side.
    mat.emissiveMap = night;
    mat.emissive = new THREE.Color(0xffc98a);
    mat.emissiveIntensity = 1.4;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSunW = { value: SUN_DIR };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWN; uniform vec3 uSunW;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.15, -0.25, dot(vWN, uSunW));');
    };
  }
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), mat));

  const cloudMat = TOON
    ? new THREE.MeshToonMaterial({ color: 0xffffff, alphaMap: posterise(clouds, 3, 1), transparent: true, gradientMap: toonRamp, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: clouds, transparent: true, opacity: 0.9, depthWrite: false });
  const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 128, 64), cloudMat);
  cloudShell.rotation.y = 0.8;
  earth.add(cloudShell);

  earth.add(atmosphere(R * 1.09, TOON ? 0x5fc8ff : 0x4aa3ff, TOON ? 0.8 : 1.2));
  if (TOON) earth.add(outlineShell(R));
  scene.add(earth);
}

function buildMoon(map) {
  const R = 6.5;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), planetMaterial(map));
  moon.position.set(-17, 5.5, -96);
  moon.rotation.y = 2.4;
  scene.add(moon);
  if (TOON) { const o = outlineShell(R, 0.03); o.position.copy(moon.position); scene.add(o); }
  return moon;
}

function buildSaturn(map, ringAlpha) {
  const R = 30;
  const saturn = new THREE.Group();
  saturn.position.set(-250, 105, -470);
  saturn.rotation.set(0.95, 0.2, -0.45);
  saturn.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), planetMaterial(map)));
  if (TOON) saturn.add(outlineShell(R, 0.025));

  // RingGeometry's UVs are planar; remap u to radius so the 1-D ring strip
  // (inner edge on the left, outer on the right) wraps round the planet.
  const inner = R * 1.25;
  const outer = R * 2.3;
  const ring = new THREE.RingGeometry(inner, outer, 160, 1);
  const p = ring.attributes.position;
  const uv = ring.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  const ringMat = TOON
    ? new THREE.MeshBasicMaterial({ map: posterise(ringAlpha, 4, 1.2), color: 0xf0d9a8, side: THREE.DoubleSide, transparent: true })
    : new THREE.MeshStandardMaterial({ map: ringAlpha, side: THREE.DoubleSide, transparent: true, roughness: 1 });
  const ringMesh = new THREE.Mesh(ring, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  saturn.add(ringMesh);
  scene.add(saturn);
}

// --- the ship ---------------------------------------------------------------

const SHIP_WHITE = 0xf3efe6;
const SHIP_ACCENT = 0xff7847;
const SHIP_DARK = 0x323a4c;

function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
}

/** Add a part and its ink hull (a scaled back-faced copy). */
function part(parent, geo, color, hull = 0.035) {
  const m = new THREE.Mesh(geo, toonMat(color));
  parent.add(m);
  if (hull) {
    const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
    o.scale.setScalar(1 + hull);
    m.add(o);
  }
  return m;
}

function buildShip() {
  const ship = new THREE.Group();

  // Fuselage: a lathe along +Y, turned so the nose points down -Z.
  // Tail to nose, i.e. increasing y: LatheGeometry's normals face outward only
  // in that order, and inward normals turn the whole hull into its ink shell.
  const prof = [[0.0, -1.25], [0.52, -1.25], [0.62, -0.8], [0.64, 0], [0.58, 0.8], [0.42, 1.5], [0.22, 1.95], [0, 2.2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 40);
  body.rotateX(-Math.PI / 2);
  part(ship, body, SHIP_WHITE, 0.05);

  // Accent band and nose tip.
  const band = new THREE.TorusGeometry(0.645, 0.07, 10, 40);
  const bandMesh = part(ship, band, SHIP_ACCENT, 0.06);
  bandMesh.position.z = 0.35;
  const tip = new THREE.ConeGeometry(0.2, 0.42, 24);
  tip.rotateX(-Math.PI / 2);
  const tipMesh = part(ship, tip, SHIP_ACCENT, 0.08);
  tipMesh.position.z = -2.08;

  // Swept wings, extruded from one outline and mirrored.
  const wing = new THREE.Shape();
  wing.moveTo(0, 0.7); wing.lineTo(1.9, -0.55); wing.lineTo(1.95, -1.05); wing.lineTo(0, -0.95);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  wingGeo.rotateX(Math.PI / 2);
  for (const side of [1, -1]) {
    const w = part(ship, wingGeo, SHIP_ACCENT, 0.03);
    w.scale.x = side;
    w.position.set(side * 0.45, -0.12, 0.25);
    const tipPod = new THREE.CapsuleGeometry(0.1, 0.6, 4, 12);
    tipPod.rotateX(Math.PI / 2);
    const pod = part(ship, tipPod, SHIP_WHITE, 0.08);
    pod.position.set(side * 2.35, -0.12, 0.95);
  }

  // Tail fin.
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(0.95, 0); fin.lineTo(1.25, 0.95); fin.lineTo(0.95, 0.95);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
  finGeo.rotateY(Math.PI / 2);
  const finMesh = part(ship, finGeo, SHIP_ACCENT, 0.03);
  finMesh.position.set(0.04, 0.45, 1.25);

  // Engine bell and plume.
  const bell = new THREE.CylinderGeometry(0.34, 0.48, 0.45, 28, 1, true);
  bell.rotateX(Math.PI / 2);
  const bellMesh = part(ship, bell, SHIP_DARK, 0.05);
  bellMesh.material.side = THREE.DoubleSide;
  bellMesh.position.z = 1.45;
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.3, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: TOON ? 0x7fe7ff : 0x9fe8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  plume.rotation.x = -Math.PI / 2;
  plume.position.z = 2.3;
  ship.add(plume);
  const glow = glowSprite(TOON ? 0x6fdcff : 0x7fd8ff, 1.6);
  glow.position.z = 2.2;
  ship.add(glow);

  // The girl, head and shoulders above the cockpit rim.
  const rig = buildGirlRig({ ...defaultChoices(), ...(loadLook() || {}) }, {
    material: new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true }),
    height: 1.25,
    outline: true,
    outlineThickness: 0.012,
  });
  rig.group.position.set(0, -0.2, -0.3);
  rig.group.rotation.y = Math.PI; // she faces the nose (-Z)
  const arm = rig.byName.armL;
  if (arm) arm.rotation.z = 0.25;
  ship.add(rig.group);

  // Glass canopy.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, clearcoat: 1 }),
  );
  canopy.scale.set(1.0, 1.3, 1.5);
  canopy.position.set(0, 0.42, -0.35);
  ship.add(canopy);

  ship.position.set(-1.2, -1.6, -9.5);
  ship.rotation.set(0.05, 0.95, -0.3);
  scene.add(ship);
  return ship;
}

// --- the predicted path -----------------------------------------------------

/**
 * The glowing dotted line of where she will go - the gameplay's core UI. Here
 * it curls round the far side of the Moon and flings out, i.e. a slingshot.
 */
function buildTrajectory(moon) {
  const m = moon.position;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.6, -1.2, -12.5),
    new THREE.Vector3(-8, 0, -38),
    new THREE.Vector3(-12, 2.5, -72),
    new THREE.Vector3(m.x - 2, m.y + 3, m.z + 10),
    new THREE.Vector3(m.x - 11, m.y + 1.5, m.z),
    new THREE.Vector3(m.x - 5, m.y - 2, m.z - 12),
    new THREE.Vector3(m.x - 12, m.y + 12, m.z - 40),
    new THREE.Vector3(m.x - 60, m.y + 40, m.z - 120),
  ], false, 'centripetal');
  const n = 140;
  const dot = new THREE.SphereGeometry(0.14, 10, 6);
  const mat = new THREE.MeshBasicMaterial({ color: TOON ? 0x7df9ff : 0x6ff0ff, toneMapped: false });
  const inst = new THREE.InstancedMesh(dot, mat, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pt = curve.getPointAt(t);
    const s = 1 + t * 3.5; // keep far dots visible
    mtx.compose(pt, new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, mtx);
  }
  scene.add(inst);
}

// --- lights, post, go --------------------------------------------------------

function buildLights() {
  const sun = new THREE.DirectionalLight(0xfff2de, TOON ? 2.6 : 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(TOON ? 0x6c74c9 : 0x1a2233, TOON ? 0.9 : 0.35));
  // Earthshine: a faint blue fill from Earth onto the ship's underside.
  const fill = new THREE.DirectionalLight(0x6fa8ff, TOON ? 0.5 : 0.45);
  fill.position.set(30, -16, -40);
  scene.add(fill);
}

async function main() {
  const [sun, day, night, clouds, moonMap, saturnMap, ring, milky] = await Promise.all([
    tex('2k_sun.jpg'), tex('2k_earth_daymap.jpg'), tex('2k_earth_nightmap.jpg'),
    tex('2k_earth_clouds.jpg', { srgb: false }), tex('2k_moon.jpg'), tex('2k_saturn.jpg'),
    tex('2k_saturn_ring_alpha.png'), tex('2k_stars_milky_way.jpg'),
  ]);

  buildSky(milky);
  buildLights();
  buildSun(sun);
  buildEarth(day, night, clouds);
  const moon = buildMoon(moonMap);
  buildSaturn(saturnMap, ring);
  buildShip();
  buildTrajectory(moon);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), TOON ? 0.4 : 0.7, TOON ? 0.3 : 0.5, TOON ? 0.95 : 0.92));
  composer.addPass(new OutputPass());

  for (let i = 0; i < 3; i++) composer.render();
  window.__ready = true;

  if (params.has('shot')) {
    const url = renderer.domElement.toDataURL('image/png');
    await fetch(`/__shot?name=space_style_${STYLE}`, { method: 'POST', body: url });
    window.__shot = true;
  }
}

main().catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
