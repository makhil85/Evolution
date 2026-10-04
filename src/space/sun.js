// Chapter 4 - the Sun: boiling surface, corona, lens flare, and the light.
//
// Surface: the 2k_sun map drives the large-scale pattern; animated simplex
// granulation, a few sunspots and physical limb darkening sit on top. Values
// are HDR (centre ~2.3, above the bloom threshold of 1.25, so the bloom pass
// catches it) but kept a saturated yellow-orange so ACES does not flatten the
// granulation into a white disc; the limb stays orange.
//
// Corona: one camera-facing quad, radial falloff with slowly turning streamers.
//
// Lens flare: our own, not three/addons Lensflare.js. That addon tests
// occlusion by drawing a quad at the light's *projective* depth, which never
// matches a LOGARITHMIC depth buffer (contracts RENDER) - the Sun's own
// surface would hide it - and it depth-tests every ghost, so a planet between
// camera and Sun would cut ghosts in half. Here occlusion is analytic (what
// fraction of the solar disc each body covers, so an eclipse dims the flare
// smoothly), elements fade at the screen edge, and the whole flare is ONE
// draw call from a canvas-generated atlas.
import * as THREE from 'three';
import { NOISE_GLSL, SURFACE_VERT } from './bodyShaders.js';
import { SPACE_LIGHT } from './contracts.js';

const CORONA_EXTENT = 7; // corona quad half-size, in solar radii

export function createSun({ map, radius, geometry }) {
  const group = new THREE.Group();
  group.name = 'sun';

  // --- surface ---------------------------------------------------------------
  const surfaceMat = new THREE.ShaderMaterial({
    name: 'sun-surface',
    uniforms: { map: { value: map }, uTime: { value: 0 } },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D map;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      ${NOISE_GLSL}

      vec3 heatRamp(float x) {
        vec3 c0 = vec3(0.55, 0.07, 0.005);
        vec3 c1 = vec3(1.0, 0.32, 0.03);
        vec3 c2 = vec3(1.0, 0.52, 0.12);
        vec3 c3 = vec3(1.0, 0.72, 0.34);
        vec3 c = mix(c0, c1, smoothstep(0.0, 0.35, x));
        c = mix(c, c2, smoothstep(0.3, 0.7, x));
        return mix(c, c3, smoothstep(0.65, 1.1, x));
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float mu = clamp(dot(N, V), 0.0, 1.0);
        vec3 p = normalize(vObjPos);
        float t = uTime;

        vec3 base = texture2D(map, vUv).rgb;
        float lum = dot(base, vec3(0.45, 0.45, 0.1));

        // Anti-aliasing: fade detail that would be smaller than a pixel.
        float fw = length(fwidth(p));
        float aaFine = 1.0 - smoothstep(0.012, 0.04, fw * 9.0);
        float aaMid = 1.0 - smoothstep(0.012, 0.04, fw * 2.5);

        // Supergranulation (slow, large) warps the granulation (fast, small).
        vec3 w = vec3(snoise(p * 3.0 + vec3(0.0, t * 0.004, 0.0)),
                      snoise(p * 3.0 + vec3(5.2, 1.3, t * 0.004)),
                      snoise(p * 3.0 + vec3(t * 0.004, 9.1, 2.7)));
        float big = snoise(p * 9.0 + w * 0.6 + vec3(t * 0.01)) * aaMid;
        float gran = 0.0;
        if (aaFine > 0.0) {
          vec3 q = p * 70.0 + w * 2.0;
          float g1 = 1.0 - abs(snoise(q + vec3(0.0, 0.0, t * 0.05)));
          float g2 = 1.0 - abs(snoise(q * 2.1 + vec3(t * 0.07, 0.0, 0.0)));
          gran = (g1 * g1 * 0.7 + g2 * g2 * 0.3 - 0.45) * aaFine;
        }

        float heat = lum * 1.2 + big * 0.12 + gran * 0.55;

        // Sunspots: dark umbra, brown penumbra.
        float spot = 0.0;
        for (int i = 0; i < 5; i++) {
          vec3 h = hash33(vec3(float(i) * 7.1, 3.3, 1.9));
          float lat = (h.x - 0.5) * 0.9;
          float lon = h.y * 6.2831;
          vec3 c = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
          float s = mix(0.012, 0.035, h.z);
          float d = acos(clamp(dot(p, c), -1.0, 1.0)) / s;
          d += snoise(p * 60.0 + float(i)) * 0.25;
          spot = max(spot, 0.55 * smoothstep(1.6, 1.0, d) + 0.45 * smoothstep(0.7, 0.35, d));
        }
        heat *= 1.0 - spot * 0.75;

        // Limb darkening (quadratic law, solar coefficients), cooler at the edge.
        float ld = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);
        heat *= mix(0.72, 1.0, mu);
        vec3 col = heatRamp(heat) * ld * 2.3;
        // Faculae: bright veins near the limb.
        col += vec3(1.0, 0.7, 0.35) * max(big, 0.0) * (1.0 - mu) * 0.6;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surface = new THREE.Mesh(geometry, surfaceMat);
  surface.scale.setScalar(radius);
  surface.name = 'sun-surface';
  const spin = new THREE.Group();
  spin.add(surface);
  group.add(spin);

  // --- corona ------------------------------------------------------------------
  const coronaMat = new THREE.ShaderMaterial({
    name: 'sun-corona',
    uniforms: { uTime: { value: 0 }, uExtent: { value: CORONA_EXTENT }, uFade: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      uniform float uExtent;
      uniform float uFade;
      varying vec2 vP;
      ${NOISE_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(vP) * uExtent;          // in solar radii
        if (r < 0.97 || r > uExtent) discard;
        vec2 d = vP / max(length(vP), 1e-4);
        float x = max(r - 1.0, 0.0);
        float t = uTime;
        // Streamers: slow, broad; fine radial rays on top.
        float s = snoise(vec3(d * 2.2, t * 0.01)) * 0.5 + 0.5;
        float f = snoise(vec3(d * 14.0, t * 0.02 - x * 0.35)) * 0.5 + 0.5;
        float streak = mix(0.7, 1.35, s) * mix(0.85, 1.2, f);
        float inner = exp(-x * 9.0) * 2.0;                    // chromosphere: >= bloom threshold
        float mid = exp(-x * 2.6) * 0.32 * streak;
        float outer = 0.09 / pow(1.0 + x, 2.6) * streak;
        float g = inner + mid + outer;
        g *= smoothstep(uExtent, uExtent * 0.55, r);
        vec3 col = mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.7, 0.4), exp(-x * 3.0)) * g;
        gl_FragColor = vec4(col * uFade, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), coronaMat);
  corona.scale.setScalar(radius * CORONA_EXTENT);
  corona.name = 'sun-corona';
  corona.renderOrder = -1; // before other additive glows
  group.add(corona);

  // --- light -----------------------------------------------------------------------
  const light = new THREE.PointLight(SPACE_LIGHT.sunColor, SPACE_LIGHT.sunIntensity, 0, 0);
  light.name = 'sun-light';
  group.add(light);

  // --- lens flare ---------------------------------------------------------------------
  const flare = createFlare();
  flare.mesh.name = 'sun-flare';

  // --- per-frame -------------------------------------------------------------------------
  const camPos = new THREE.Vector3();
  const sunPos = new THREE.Vector3();
  const toSun = new THREE.Vector3();
  const toBody = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const size = new THREE.Vector2();

  /**
   * @param {number} time
   * @param {THREE.Camera} camera
   * @param {Array<{pos: THREE.Vector3, radius: number}>} occluders scene-space spheres
   * @param {THREE.WebGLRenderer} renderer
   */
  function update(time, camera, occluders, renderer, spinPeriod) {
    surfaceMat.uniforms.uTime.value = time;
    coronaMat.uniforms.uTime.value = time;
    spin.rotation.y = ((time / spinPeriod) % 1) * Math.PI * 2;

    camera.updateMatrixWorld();
    camPos.setFromMatrixPosition(camera.matrixWorld);
    group.getWorldPosition(sunPos);
    corona.quaternion.copy(camera.quaternion);

    // What fraction of the solar disc is hidden behind a body?
    toSun.subVectors(sunPos, camPos);
    const ds = toSun.length();
    const rs = Math.asin(Math.min(1, radius / ds));
    let hidden = 0;
    for (let i = 0; i < occluders.length; i++) {
      const o = occluders[i];
      toBody.subVectors(o.pos, camPos);
      const db = toBody.length();
      if (db >= ds || db <= o.radius) continue;
      const rb = Math.asin(Math.min(1, o.radius / db));
      const sep = Math.atan2(crossLen(toBody, toSun), toBody.dot(toSun));
      hidden += discOverlap(rs, rb, sep);
    }
    const visible = Math.max(0, 1 - hidden);

    // Screen position; fade as the Sun leaves the frame.
    ndc.copy(sunPos).project(camera);
    const behind = toSun.dot(camera.getWorldDirection(toBody)) <= 0;
    const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
    const onScreen = behind ? 0 : 1 - smoothstep(0.95, 1.3, edge);
    renderer.getDrawingBufferSize(size);
    flare.set(ndc.x, ndc.y, size.x, size.y, visible * onScreen, rs, camera);
  }

  function dispose() {
    surfaceMat.dispose();
    coronaMat.dispose();
    corona.geometry.dispose();
    flare.dispose();
  }

  return { group, surface, corona, light, flare: flare.mesh, update, dispose };
}

function crossLen(a, b) {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  return Math.sqrt(x * x + y * y + z * z);
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Fraction of disc 1 (radius r1) covered by disc 2 (radius r2) at separation d. */
function discOverlap(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const k = 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return (a1 + a2 - k) / (Math.PI * r1 * r1);
}

// ---------------------------------------------------------------------------
// lens flare
// ---------------------------------------------------------------------------

const CELL = { glow: 0, star: 1, hex: 2, ring: 3 };

// [distance along the Sun->centre axis, width px, height px, atlas cell, colour, strength, rotates]
// Sizes are for a 900 px tall view and scale with the canvas.
const ELEMENTS = [
  [0.0, 300, 300, CELL.glow, 0xffdcae, 0.32, 0],
  [0.0, 110, 110, CELL.glow, 0xffffff, 0.6, 0],
  [0.0, 560, 560, CELL.star, 0xffe7c4, 0.22, 1],
  [0.0, 1300, 18, CELL.glow, 0x9fc4ff, 0.3, 0],
  [0.24, 50, 50, CELL.hex, 0x7fe0a0, 0.08, 1],
  [0.4, 96, 96, CELL.hex, 0x8aa0ff, 0.045, 1],
  [0.56, 32, 32, CELL.hex, 0xffb070, 0.12, 1],
  [0.72, 18, 18, CELL.glow, 0x9fd8ff, 0.3, 0],
  [0.9, 150, 150, CELL.hex, 0xb48cff, 0.03, 1],
  [1.08, 64, 64, CELL.hex, 0x8cffc8, 0.05, 1],
  [1.3, 380, 380, CELL.ring, 0xffd0a0, 0.05, 0],
];

function createFlare() {
  const atlas = new THREE.CanvasTexture(buildAtlas());
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;

  const n = ELEMENTS.length;
  const pos = new Float32Array(n * 4 * 3);
  const uv = new Float32Array(n * 4 * 2);
  const params = new Float32Array(n * 4 * 4);
  const color = new Float32Array(n * 4 * 3);
  const index = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const c = new THREE.Color();
  for (let e = 0; e < n; e++) {
    const [dist, w, h, cell, hex, k, rot] = ELEMENTS[e];
    c.set(hex).multiplyScalar(k);
    const cu = (cell % 2) * 0.5;
    const cv = Math.floor(cell / 2) * 0.5;
    for (let v = 0; v < 4; v++) {
      const i = e * 4 + v;
      pos.set([corners[v][0], corners[v][1], rot], i * 3);
      uv.set([cu + (corners[v][0] * 0.5 + 0.5) * 0.5, cv + (corners[v][1] * 0.5 + 0.5) * 0.5], i * 2);
      params.set([dist, w, h, 0], i * 4);
      color.set([c.r, c.g, c.b], i * 3);
    }
    const b = e * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aParams', new THREE.BufferAttribute(params, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setIndex(index);

  const mat = new THREE.ShaderMaterial({
    name: 'sun-flare',
    uniforms: {
      uAtlas: { value: atlas },
      uSun: { value: new THREE.Vector2() },
      uView: { value: new THREE.Vector2(1600, 900) },
      uIntensity: { value: 0 },
      uAngle: { value: 0 },
      uCoreFade: { value: 1 },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 aParams;
      attribute vec3 aColor;
      uniform vec2 uSun;
      uniform vec2 uView;
      uniform float uAngle;
      uniform float uCoreFade;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = aColor * (aParams.x < 0.001 ? uCoreFade : 1.0);
        vec2 centre = uSun * (1.0 - 2.0 * aParams.x);
        vec2 corner = position.xy;
        if (position.z > 0.5) {
          float ca = cos(uAngle), sa = sin(uAngle);
          corner = vec2(ca * corner.x - sa * corner.y, sa * corner.x + ca * corner.y);
        }
        float s = uView.y / 900.0;
        vec2 half_ = aParams.yz * s / uView;   // px diameter -> NDC half-extent
        gl_Position = vec4(centre + corner * half_, 0.0, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uAtlas;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        #include <logdepthbuf_fragment>
        float a = texture2D(uAtlas, vUv).a;
        gl_FragColor = vec4(vColor * a * uIntensity, 1.0);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10000;

  function set(x, y, w, h, intensity, sunAngRadius = 0, camera = null) {
    // The glow, starburst and streak are for a small, piercing Sun; once its
    // disc is big on screen they would just wash over the surface detail.
    const fovRad = camera && camera.fov ? THREE.MathUtils.degToRad(camera.fov) : 1;
    const sunPx = sunAngRadius * (h * 0.5) / Math.tan(fovRad * 0.5);
    mat.uniforms.uCoreFade.value = 1 - 0.85 * smoothstep(35, 150, sunPx);
    mat.uniforms.uSun.value.set(x, y);
    mat.uniforms.uView.value.set(w, h);
    mat.uniforms.uIntensity.value = intensity;
    mat.uniforms.uAngle.value = Math.atan2(y, x) * 0.5;
    mesh.visible = intensity > 0.002;
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
    atlas.dispose();
  }

  return { mesh, set, dispose };
}

/** 1024x1024 atlas, 2x2 cells: soft glow, starburst, soft hexagon ghost, halo ring. */
function buildAtlas() {
  const S = 1024;
  const H = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');

  // Cells are addressed with v up (WebGL), canvas y down: cell (cu, cv) lives
  // at canvas x = cu*H, y = S - (cv+1)*H.
  const origin = (cell) => [(cell % 2) * H, S - (Math.floor(cell / 2) + 1) * H];

  // glow
  {
    const [x0, y0] = origin(CELL.glow);
    const cx = x0 + H / 2, cy = y0 + H / 2;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, H / 2);
    const stops = [[0, 1], [0.06, 0.8], [0.15, 0.42], [0.3, 0.16], [0.5, 0.05], [0.75, 0.012], [1, 0]];
    for (const [s, a] of stops) gr.addColorStop(s, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(x0, y0, H, H);
  }

  // starburst: six diffraction spikes and many faint thin rays
  {
    const [x0, y0] = origin(CELL.star);
    const cx = x0 + H / 2, cy = y0 + H / 2;
    g.save();
    g.beginPath();
    g.rect(x0, y0, H, H);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ray = (ang, len, width, alpha) => {
      const ex = cx + Math.cos(ang) * len, ey = cy + Math.sin(ang) * len;
      const gr = g.createLinearGradient(cx, cy, ex, ey);
      gr.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gr.addColorStop(0.35, `rgba(255,255,255,${alpha * 0.35})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(ex, ey);
      g.stroke();
    };
    for (let i = 0; i < 6; i++) ray((i / 6) * Math.PI * 2 + 0.26, H * 0.49, 3.2, 0.9);
    for (let i = 0; i < 90; i++) ray(rnd() * Math.PI * 2, H * (0.12 + 0.3 * rnd()), 0.8 + rnd() * 1.2, 0.25 + 0.35 * rnd());
    g.restore();
  }

  // soft hexagonal ghost (aperture shape): faint body, brighter rim, blurred
  {
    const [x0, y0] = origin(CELL.hex);
    const cx = x0 + H / 2, cy = y0 + H / 2;
    const r = H * 0.4;
    g.save();
    g.filter = 'blur(6px)';
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.8, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0.9)');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.stroke();
    g.restore();
  }

  // halo ring
  {
    const [x0, y0] = origin(CELL.ring);
    const cx = x0 + H / 2, cy = y0 + H / 2;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, H / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.72, 'rgba(255,255,255,0)');
    gr.addColorStop(0.84, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.9, 'rgba(255,255,255,0.8)');
    gr.addColorStop(0.95, 'rgba(255,255,255,0.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x0, y0, H, H);
  }
  return cv;
}
