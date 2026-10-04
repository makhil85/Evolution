// Surface scenes - the ground: a heightfield, its material, and the rocks.
//
// THE MESH. One grid, stretched: the middle is a uniform 0.55 m grid out to
// +-55 m (where she plays), and the rings beyond it grow smoothly to 2.5 km,
// so near detail and a far horizon cost one draw call and no cracks. The
// heights carry an exaggerated planetary curvature (radius CURVE), which is
// what gives an airless world its crisp, close, curved horizon - and hides the
// edge of the patch below it.
//
// FEET ON THE GROUND. heightAt() inside the uniform part interpolates the SAME
// two triangles the GPU draws, so her feet, the footprints and the props sit
// exactly on the rendered surface, not on a smooth function near it.
//
// THE MATERIAL is MeshStandardMaterial (so shadows, fog-free lighting and the
// log depth buffer all come for free) with the albedo and a fine bump
// replaced by procedural world-space detail, plus a Lommel-Seeliger lift on
// the Moon (why the real Moon looks evenly bright even under a low Sun) and
// frost glints on Europa.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE_GLSL } from '../bodyShaders.js';
import { TEXTURE_BASE } from '../contracts.js';
import { LAYOUT } from './layout.js';
import { rng, fbm2, ridged2, snoise2, smoothstep, clamp, lerp } from './noise.js';

const CURVE = 30000;          // m, planetary curvature used for the horizon
const N = 360;                // grid cells across
const INNER_CELLS = 100;      // uniform cells from the centre to each side
const H = 0.55;               // uniform spacing, m
export const INNER = INNER_CELLS * H;
const OUTER_EDGE = 2500;      // m
const OUT_CELLS = N / 2 - INNER_CELLS;
const STRETCH_A = (OUTER_EDGE - INNER - H * OUT_CELLS) / Math.pow(OUT_CELLS, 4);

function stretch(s) {
  if (s <= INNER_CELLS) return s * H;
  const t = s - INNER_CELLS;
  return INNER + H * t + STRETCH_A * t * t * t * t;
}

// ---------------------------------------------------------------------------
// height functions
// ---------------------------------------------------------------------------

/** Crater cross-section (height / R) at u = distance / R. */
function craterProfile(u, depth, rim) {
  if (u < 1) {
    // Flat-ish floor for the bigger ones: a softened paraboloid.
    const b = u * u;
    return depth * (b * (1.15 - 0.15 * b) - 1) + rim;
  }
  const o = u - 1;
  return rim * Math.exp(-o * o * 5.5) + rim * 0.25 * Math.exp(-o * 1.2) * (u < 3 ? 1 : 0) * (1 - smoothstep(2, 3, u));
}

function moonFeatures(seed) {
  const L = LAYOUT.moon;
  const r = rng(seed);
  const craters = [
    // Named-by-hand near craters: framing the walk, one beside the station.
    { x: 16, z: -3, r: 5.5, d: 0.2, rim: 0.06 },
    { x: -2.5, z: -36.5, r: 6.5, d: 0.2, rim: 0.06 },
    { x: 13, z: -27, r: 8, d: 0.19, rim: 0.055 },
    { x: -24, z: 7, r: 9, d: 0.18, rim: 0.05 },
    { x: 6, z: 17, r: 5, d: 0.2, rim: 0.06 },
    { x: 30, z: -38, r: 17, d: 0.16, rim: 0.045 },
    { x: -38, z: -46, r: 13, d: 0.17, rim: 0.05 },
    { x: -21, z: -14, r: 3.2, d: 0.21, rim: 0.07 },
    { x: 19, z: 12, r: 3.6, d: 0.21, rim: 0.07 },
    { x: -5, z: -18, r: 1.9, d: 0.22, rim: 0.07 },
    // Far, big: they read as long shadowed hollows on the plain.
    { x: 70, z: -140, r: 55, d: 0.12, rim: 0.035 },
    { x: -190, z: -70, r: 80, d: 0.11, rim: 0.03 },
    { x: 150, z: 110, r: 65, d: 0.11, rim: 0.03 },
    { x: -70, z: 210, r: 45, d: 0.12, rim: 0.035 },
    { x: 20, z: -330, r: 110, d: 0.09, rim: 0.025 },
    { x: -300, z: -300, r: 140, d: 0.08, rim: 0.025 },
  ];
  // Scatter of small ones, kept off the landing spot and the objectives.
  let tries = 0;
  while (craters.length < 75 && tries++ < 2000) {
    const x = (r() - 0.5) * 220;
    const z = (r() - 0.5) * 220;
    const rad = 0.6 + Math.pow(r(), 2.2) * 5;
    let ok = true;
    for (const f of L.flat) if (Math.hypot(x - f.x, z - f.z) < f.r + rad * 1.6) ok = false;
    for (const c of craters) if (Math.hypot(x - c.x, z - c.z) < (c.r + rad) * 0.9) ok = false;
    if (ok) craters.push({ x, z, r: rad, d: 0.2 + r() * 0.04, rim: 0.06 + r() * 0.02 });
  }
  return { craters };
}

function makeMoonHeight() {
  const { craters } = moonFeatures(71);
  const raw = (x, z) => {
    const rr = Math.hypot(x, z);
    let h = fbm2(x / 75, z / 75, 3) * 1.7 + fbm2(x / 17, z / 17, 3) * 0.32 + fbm2(x / 5, z / 5, 2) * 0.05;
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const lim = c.r * 3;
      if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
      const u = Math.sqrt(dx * dx + dz * dz) / c.r;
      if (u < 3) h += craterProfile(u, c.d, c.rim) * c.r;
    }
    // Far highlands: soft, rounded massifs that make a skyline.
    const far = smoothstep(170, 950, rr);
    // Few octaves on purpose: the far grid is coarse, and fine noise there
    // turns into saw-tooth peaks. Lunar highlands are old and rounded anyway.
    if (far > 0) h += far * (Math.pow(0.5 + 0.5 * fbm2(x / 700 + 3.1, z / 700 - 1.7, 3), 1.7) * 150 - 22);
    return h;
  };
  return { raw, craters };
}

// Europa ------------------------------------------------------------------------

/** Sideways wander of the drill crack; the ground shader has the same formula. */
export function crackWiggle(along) {
  // Zero at along = 0, so the crack runs exactly through the drill spot.
  return 1.2 * Math.sin(along / 13) + 0.4 * (Math.sin(along / 4.1 + 1.3) - Math.sin(1.3));
}

export function lineFrame(l) {
  const a = (l.ang * Math.PI) / 180;
  // Direction along the line, in (x, z): angle from +X toward -Z.
  return { dx: Math.cos(a), dz: -Math.sin(a) };
}

function makeEuropaHeight() {
  const lines = LAYOUT.europa.lines.map((l) => ({ ...l, ...lineFrame(l) }));
  const raw = (x, z) => {
    const rr = Math.hypot(x, z);
    let h = fbm2(x / 45, z / 45, 3) * 0.55 + fbm2(x / 11, z / 11, 3) * 0.13 + fbm2(x / 3, z / 3, 2) * 0.03;
    for (const l of lines) {
      const px = x - l.x;
      const pz = z - l.z;
      const along = px * l.dx + pz * l.dz;
      if (Math.abs(along) > l.half) continue;
      const fade = 1 - smoothstep(l.half * 0.8, l.half, Math.abs(along));
      let d = -px * l.dz + pz * l.dx;   // signed distance across
      if (l.kind === 1) {
        d += snoise2(along / 180, l.x * 0.01) * 14;
        const s = l.sep / 2;
        const w = l.width;
        const k = Math.exp(-(((d - s) / w) ** 2)) + Math.exp(-(((d + s) / w) ** 2));
        // Sharp-ish crests: raise to a power so the ridges read as ridges.
        h += l.height * Math.pow(k, 1.3) * fade * (0.8 + 0.25 * snoise2(along / 90, 3.3));
      } else if (l.kind === 2) {
        d += crackWiggle(along);
        const w = l.width;
        const trough = -l.depth * Math.exp(-((d / w) ** 2) * 1.6);
        const lips = 0.22 * (Math.exp(-(((d - w * 1.7) / (w * 0.7)) ** 2)) + Math.exp(-(((d + w * 1.7) / (w * 0.7)) ** 2)));
        h += (trough + lips) * fade;
      }
    }
    // Far: broad swells so the plain is not a billiard table at the horizon.
    const far = smoothstep(220, 1000, rr);
    if (far > 0) h += far * (fbm2(x / 380, z / 380, 3) * 40 + fbm2(x / 200 + 5, z / 200, 2) * 8);
    return h;
  };
  return { raw, lines };
}

// ---------------------------------------------------------------------------
// shader
// ---------------------------------------------------------------------------

const GROUND_PARS = /* glsl */`
${NOISE_GLSL}
uniform sampler2D uDetail;
uniform float uLunar;
uniform vec3 uSunView;
uniform float uTime;
uniform vec4 uLineA[8];
uniform vec4 uLineB[8];
uniform vec3 uCamPos;
varying vec3 vGPos;

vec3 srgbL(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }

// Small craters on a jittered grid: x = height (m), y = fresh bright rim.
vec2 craterlets(vec2 q, float cell, float seed, float density) {
  vec2 c = floor(q / cell);
  float h = 0.0;
  float br = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cc = c + vec2(float(i), float(j));
      vec3 r = hash33(vec3(cc, seed));
      if (r.z > density) continue;
      vec2 ctr = (cc + 0.15 + 0.7 * r.xy) * cell;
      float R = cell * (0.12 + 0.38 * pow(r.z / density, 2.0));
      float u = length(q - ctr) / R;
      if (u > 2.2) continue;
      float b = u * u;
      float bowl = u < 1.0 ? 0.2 * (b * (1.15 - 0.15 * b) - 1.0) : 0.0;
      float rim = 0.06 * exp(-(u - 1.0) * (u - 1.0) * 6.0);
      h += (bowl + rim) * R;
      float fresh = step(0.72, fract(r.x * 13.7));
      br = max(br, fresh * exp(-max(u - 1.0, 0.0) * 2.2) * smoothstep(0.4, 0.95, u));
    }
  }
  return vec2(h, br);
}

// ---- the Moon ----
float moonBump(vec2 q, float fw) {
  float h = 0.0;
  h += craterlets(q, 3.2, 1.0, 0.45).x * (1.0 - smoothstep(0.08, 0.3, fw));
  h += craterlets(q, 0.9, 2.0, 0.5).x * (1.0 - smoothstep(0.02, 0.09, fw));
  h += 0.018 * snoise(vec3(q * 1.7, 4.0)) * (1.0 - smoothstep(0.05, 0.2, fw));
  h += 0.006 * snoise(vec3(q * 7.0, 5.0)) * (1.0 - smoothstep(0.015, 0.06, fw));
  h += 0.0025 * snoise(vec3(q * 23.0, 6.0)) * (1.0 - smoothstep(0.005, 0.02, fw));
  return h;
}
vec3 moonAlbedo(vec2 q, float fw) {
  float macro = texture2D(uDetail, q / 330.0 + vec2(0.31, 0.44)).r;
  float meso = texture2D(uDetail, q / 37.0 + vec2(0.12, 0.61)).r;
  float n1 = fbm(vec3(q * 0.045, 3.1), 4);
  float n2 = snoise(vec3(q * 0.9, 7.0)) * (1.0 - smoothstep(0.03, 0.15, fw));
  float n3 = snoise(vec3(q * 5.0, 8.0)) * (1.0 - smoothstep(0.008, 0.04, fw));
  float a = 0.145 * (0.62 + 0.75 * macro) * (0.86 + 0.3 * meso) * (1.0 + 0.14 * n1 + 0.06 * n2 + 0.05 * n3);
  vec2 cl = craterlets(q, 3.2, 1.0, 0.45);
  vec2 cs = craterlets(q, 0.9, 2.0, 0.5);
  a *= 1.0 + 0.35 * cl.y * (1.0 - smoothstep(0.08, 0.3, fw)) + 0.25 * cs.y * (1.0 - smoothstep(0.02, 0.09, fw));
  return vec3(a) * vec3(1.0, 0.975, 0.945);
}

// ---- Europa ----
// Distance-to-line contributions: x = brown band, y = dark fissure core,
// z = bright median stripe, w = ridge flank.
vec4 europaLines(vec2 q) {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 A = uLineA[i];
    vec4 B = uLineB[i];
    if (B.y <= 0.0) continue;
    vec2 p = q - A.xy;
    float along = dot(p, A.zw);
    if (abs(along) > B.x) continue;
    float fade = 1.0 - smoothstep(B.x * 0.8, B.x, abs(along));
    float d = -p.x * A.w + p.y * A.z;
    float kind = B.w;
    float w = B.y;
    if (kind > 1.5) {
      d += 1.2 * sin(along / 13.0) + 0.4 * (sin(along / 4.1 + 1.3) - sin(1.3));
      acc.x = max(acc.x, exp(-pow(d / (w * 2.6), 2.0)) * fade * 0.85);
      acc.y = max(acc.y, fade);
    } else if (kind > 0.5) {
      float s = B.z;
      float fl = exp(-pow((abs(d) - s * 0.5) / (w * 1.25), 2.0));
      float trough = exp(-pow(d / (s * 0.22), 2.0));
      acc.x = max(acc.x, (fl * 0.55 + trough * 0.8) * fade);
      acc.w = max(acc.w, fl * fade);
    } else {
      float wig = snoise(vec3(along / 40.0, float(i) * 3.1, 1.0)) * w * 0.5;
      float dd = abs(d + wig);
      float band = exp(-pow(dd / w, 2.0));
      float halo = exp(-pow(dd / (w * 2.8), 2.0)) * 0.35;
      acc.x = max(acc.x, (band + halo) * fade * (0.65 + 0.35 * snoise(vec3(along / 30.0, float(i), 2.0))));
      acc.z = max(acc.z, exp(-pow(dd / (w * 0.18), 2.0)) * fade);
    }
  }
  return acc;
}
// The drill crack's own geometry, for the fissure line (matches terrain.js).
float crackDist(vec2 q) {
  vec4 A = uLineA[0];
  vec2 p = q - A.xy;
  float along = dot(p, A.zw);
  float d = -p.x * A.w + p.y * A.z;
  d += 1.2 * sin(along / 13.0) + 0.4 * (sin(along / 4.1 + 1.3) - sin(1.3));
  return d;
}
float europaBump(vec2 q, float fw) {
  float h = 0.0;
  // Frost grain and hummocks.
  h += 0.013 * snoise(vec3(q * 1.3, 11.0)) * (1.0 - smoothstep(0.05, 0.2, fw));
  h += 0.0035 * snoise(vec3(q * 5.5, 12.0)) * (1.0 - smoothstep(0.015, 0.06, fw));
  h += 0.0012 * snoise(vec3(q * 19.0, 13.0)) * (1.0 - smoothstep(0.005, 0.02, fw));
  // Hairline cracks: cell edges, a few mm deep.
  vec2 g = q * 0.55 + vec2(snoise(vec3(q * 0.3, 1.0)), snoise(vec3(q * 0.3, 2.0))) * 0.35;
  vec2 c = floor(g);
  float f1 = 9.0, f2 = 9.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cc = c + vec2(float(i), float(j));
    vec2 o = hash33(vec3(cc, 21.0)).xy;
    float d = length(g - cc - o);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  float edge = 1.0 - smoothstep(0.0, 0.06, f2 - f1);
  h -= edge * 0.0025 * (1.0 - smoothstep(0.012, 0.05, fw));
  return h;
}
vec3 europaAlbedo(vec2 q, float fw, out float frost) {
  float m1 = fbm(vec3(q * 0.011, 1.0), 4);
  float m2 = fbm(vec3(q * 0.05, 2.0), 4);
  float m3 = snoise(vec3(q * 0.4, 3.0)) * (1.0 - smoothstep(0.05, 0.25, fw));
  float m4 = snoise(vec3(q * 3.0, 4.0)) * (1.0 - smoothstep(0.01, 0.06, fw));
  vec3 ice = srgbL(0.88, 0.92, 0.96);      // cool: ACES warms bright whites
  vec3 iceBlue = srgbL(0.74, 0.83, 0.92);
  vec3 cream = srgbL(0.90, 0.85, 0.76);
  vec3 tanC = srgbL(0.80, 0.66, 0.52);
  vec3 rust = srgbL(0.56, 0.31, 0.19);
  // Mostly white and blue-grey ice (play-test: with more cream and tan the
  // plain read as beige Moon dust); the brown lineae below carry the colour.
  vec3 col = mix(ice, iceBlue, smoothstep(-0.35, 0.45, m2) * 0.8);
  col = mix(col, cream, smoothstep(0.1, 0.6, m1) * 0.16);
  col = mix(col, tanC, smoothstep(0.35, 0.8, m1 + 0.35 * m2) * 0.22);
  col *= 0.95 + 0.05 * m3 + 0.03 * m4;
  vec4 L = europaLines(q);
  float lineVar = 0.75 + 0.25 * snoise(vec3(q * 0.15, 9.0));
  col = mix(col, mix(tanC, rust, 0.55 + 0.3 * m2), clamp(L.x * lineVar, 0.0, 1.0) * 0.82);
  col = mix(col, srgbL(0.93, 0.9, 0.85), L.z * 0.45);
  // The young crack: a dark blue-grey fissure with fresh blue ice at its lips.
  if (L.y > 0.0) {
    float d = abs(crackDist(q));
    float core = 1.0 - smoothstep(0.08, 0.3, d);
    float lip = exp(-pow((d - 0.45) / 0.25, 2.0));
    col = mix(col, srgbL(0.72, 0.84, 0.92), lip * 0.5 * L.y);
    col = mix(col, srgbL(0.16, 0.24, 0.32), core * L.y);
  }
  // Hairline cracks carry a faint stain.
  vec2 g = q * 0.55 + vec2(snoise(vec3(q * 0.3, 1.0)), snoise(vec3(q * 0.3, 2.0))) * 0.35;
  vec2 c = floor(g);
  float f1 = 9.0, f2 = 9.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cc = c + vec2(float(i), float(j));
    vec2 o = hash33(vec3(cc, 21.0)).xy;
    float d = length(g - cc - o);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  float edge = 1.0 - smoothstep(0.0, 0.05, f2 - f1);
  // (Blue-grey and a little stronger, so the cracked-ice pattern reads.)
  col = mix(col, srgbL(0.50, 0.58, 0.66), edge * 0.3 * (1.0 - smoothstep(0.012, 0.05, fw)));
  frost = (1.0 - L.x * 0.8) * (1.0 - edge);
  return col * 0.86;
}

float groundBump(vec2 q, float fw) {
#ifdef EUROPA
  return europaBump(q, fw);
#else
  return moonBump(q, fw);
#endif
}
`;

function groundMaterial(body, detailTex) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const uniforms = {
    uDetail: { value: detailTex },
    uLunar: { value: body === 'moon' ? 0.85 : 0.35 },
    uSunView: { value: new THREE.Vector3(0, 1, 0) },
    uTime: { value: 0 },
    uLineA: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uLineB: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uCamPos: { value: new THREE.Vector3() },
  };
  if (body === 'europa') {
    LAYOUT.europa.lines.forEach((l, i) => {
      const f = lineFrame(l);
      uniforms.uLineA.value[i].set(l.x, l.z, f.dx, f.dz);
      uniforms.uLineB.value[i].set(l.half, l.width, l.sep || 0, l.kind);
    });
  }
  m.userData.uniforms = uniforms;
  m.defines = body === 'europa' ? { EUROPA: '' } : {};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROUND_PARS}`)
      .replace('#include <map_fragment>', /* glsl */`
        vec2 gq = vGPos.xz;
        float gfw = length(fwidth(gq));
        float gFrost = 0.0;
        #ifdef EUROPA
          diffuseColor.rgb = europaAlbedo(gq, gfw, gFrost);
        #else
          diffuseColor.rgb = moonAlbedo(gq, gfw);
        #endif
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          // Finite-difference bump in world space, tilted onto the view normal.
          float e = max(0.006, gfw * 0.6);
          float h0 = groundBump(gq, gfw);
          float hx = groundBump(gq + vec2(e, 0.0), gfw);
          float hz = groundBump(gq + vec2(0.0, e), gfw);
          vec3 gW = vec3((hx - h0) / e, 0.0, (hz - h0) / e);
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          gW -= nW * dot(gW, nW);
          nW = normalize(nW - gW);
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }
      `)
      .replace('#include <lights_fragment_end>', /* glsl */`
        #include <lights_fragment_end>
        {
          // Lommel-Seeliger: regolith scatters light back up almost evenly,
          // so flat ground under a low Sun is not near-black as Lambert says.
          float mu0 = max(dot(normal, uSunView), 0.0);
          float mu = max(dot(normal, geometryViewDir), 0.08);
          float ls = clamp(2.0 / (mu0 + mu + 0.15), 1.0, 2.6);
          reflectedLight.directDiffuse *= mix(1.0, ls, uLunar);
        }
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        #ifdef EUROPA
        {
          // Frost glints: tiny facets that catch the Sun as she moves.
          vec3 cell = floor(vGPos * 28.0);
          vec3 r = hash33(cell + 3.1);
          float near = 1.0 - smoothstep(4.0, 16.0, length(vGPos - uCamPos));
          if (r.x > 0.93 && near > 0.0) {
            vec3 fn = normalize(vec3(r.y - 0.5, 1.6, r.z - 0.5));
            vec3 nV = normalize((viewMatrix * vec4(fn, 0.0)).xyz);
            vec3 hv = normalize(uSunView + normalize(vViewPosition));
            float g = pow(max(dot(nV, hv), 0.0), 900.0);
            vec3 sub = fract(vGPos * 28.0) - 0.5;
            float dotMask = 1.0 - smoothstep(0.12, 0.32, length(sub.xz));
            totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * g * dotMask * near * gFrost * 9.0;
          }
        }
        #endif
      `);
  };
  m.customProgramCacheKey = () => `surfaceGround-${body}`;
  return m;
}

// ---------------------------------------------------------------------------
// rocks
// ---------------------------------------------------------------------------

function rockGeometry(kind, seed) {
  const r = rng(seed);
  if (kind === 'ice') {
    // Ice blocks: chunky slabs with broad planar faces and softened edges,
    // not crumpled paper. Built as a rounded box pushed around by noise and
    // then "cleaved" by a few random planes.
    const g = new THREE.BoxGeometry(1.6, 1.1, 1.3, 8, 6, 7);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const planes = [];
    for (let k = 0; k < 5; k++) {
      const n = new THREE.Vector3(r() - 0.5, (r() - 0.3) * 0.8, r() - 0.5).normalize();
      planes.push({ n, d: 0.45 + r() * 0.25 });
    }
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // Round the box toward an ellipsoid a little.
      const len = Math.hypot(v.x / 0.8, v.y / 0.55, v.z / 0.65);
      v.multiplyScalar(lerp(1, 1 / Math.max(len, 0.3), 0.35));
      for (const pl of planes) {
        const s = v.dot(pl.n);
        if (s > pl.d) v.addScaledVector(pl.n, pl.d - s);
      }
      v.x += snoise2(v.y * 2 + seed, v.z * 2) * 0.05;
      v.z += snoise2(v.x * 2, v.y * 2 - seed) * 0.05;
      if (v.y < -0.5) v.y = -0.5;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const ng = mergeVertices(g, 1e-4);
    ng.computeVertexNormals();
    return ng;
  }
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = snoise2(v.x * 1.1 + v.z * 0.7, v.y * 1.2 + seed) * 0.22
      + snoise2(v.z * 2.6 - v.y, v.x * 2.4 + seed * 2) * 0.09
      + snoise2(v.x * 6 + v.y * 3, v.z * 6) * 0.025;
    v.multiplyScalar(1 + n);
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25;   // flattish bottom
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  const merged = g.index ? g.toNonIndexed() : g;
  merged.computeVertexNormals();
  // Smooth normals: weld by position so the lumps shade softly.
  const smoothN = new Map();
  const pn = merged.attributes.position;
  const nn = merged.attributes.normal;
  for (let i = 0; i < pn.count; i++) {
    const k = `${pn.getX(i).toFixed(4)},${pn.getY(i).toFixed(4)},${pn.getZ(i).toFixed(4)}`;
    const a = smoothN.get(k) || [0, 0, 0];
    a[0] += nn.getX(i); a[1] += nn.getY(i); a[2] += nn.getZ(i);
    smoothN.set(k, a);
  }
  for (let i = 0; i < pn.count; i++) {
    const k = `${pn.getX(i).toFixed(4)},${pn.getY(i).toFixed(4)},${pn.getZ(i).toFixed(4)}`;
    const a = smoothN.get(k);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nn.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  return merged;
}

function rockMaterial(body) {
  const ice = body === 'europa';
  const m = new THREE.MeshStandardMaterial({
    color: ice ? 0xdfe8ef : 0xb3afa8,
    roughness: ice ? 0.42 : 0.96,
    metalness: 0,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRP;\nvarying float vRUp;')
      .replace('#include <fog_vertex>', /* glsl */`#include <fog_vertex>
        vec4 rp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rp = instanceMatrix * rp;
        #endif
        vRP = (modelMatrix * rp).xyz;
        vRUp = position.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vRP;\nvarying float vRUp;`)
      .replace('#include <map_fragment>', /* glsl */`
        {
          float n = fbm(vRP * 2.3, 4);
          float n2 = snoise(vRP * 11.0);
          ${ice
            ? 'diffuseColor.rgb *= vec3(0.97, 0.99, 1.02) * (0.9 + 0.1 * n) ; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.42, 0.3), smoothstep(0.35, 0.8, n) * 0.35);'
            : 'diffuseColor.rgb *= (0.78 + 0.3 * n + 0.06 * n2);'}
          // Darker where it meets the ground (dust skirt / contact).
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(-0.4, 0.1, vRUp));
        }`)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          float e = 0.01;
          float f = ${ice ? '5.0' : '9.0'};
          float h0 = snoise(vRP * f) + 0.5 * snoise(vRP * f * 2.7);
          vec3 g = vec3(
            snoise((vRP + vec3(e, 0.0, 0.0)) * f) + 0.5 * snoise((vRP + vec3(e, 0.0, 0.0)) * f * 2.7) - h0,
            snoise((vRP + vec3(0.0, e, 0.0)) * f) + 0.5 * snoise((vRP + vec3(0.0, e, 0.0)) * f * 2.7) - h0,
            snoise((vRP + vec3(0.0, 0.0, e)) * f) + 0.5 * snoise((vRP + vec3(0.0, 0.0, e)) * f * 2.7) - h0) / e;
          vec3 gV = (viewMatrix * vec4(g, 0.0)).xyz * ${ice ? '0.003' : '0.006'};
          gV -= normal * dot(gV, normal);
          normal = normalize(normal - gV);
        }`);
  };
  m.customProgramCacheKey = () => `surfaceRock-${body}`;
  return m;
}

// ---------------------------------------------------------------------------
// the terrain
// ---------------------------------------------------------------------------

/**
 * @param {{ body: 'moon'|'europa', renderer: THREE.WebGLRenderer }} o
 */
export function createTerrain({ body, renderer }) {
  const L = LAYOUT[body];
  const group = new THREE.Group();
  group.name = `surface-${body}`;

  const model = body === 'moon' ? makeMoonHeight() : makeEuropaHeight();
  // Flat pads: blend toward the raw height at each pad's centre.
  const pads = L.flat.map((f) => ({ ...f, h0: model.raw(f.x, f.z) }));
  const analytic = (x, z) => {
    let h = model.raw(x, z);
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r * 1.9) h = lerp(p.h0, h, smoothstep(p.r, p.r * 1.9, d));
    }
    return h - (x * x + z * z) / (2 * CURVE);
  };

  // --- grid -----------------------------------------------------------------
  const V = N + 1;
  const pos = new Float32Array(V * V * 3);
  const heights = new Float32Array(V * V);
  for (let j = 0; j <= N; j++) {
    const b = j - N / 2;
    for (let i = 0; i <= N; i++) {
      const a = i - N / 2;
      const s = Math.max(Math.abs(a), Math.abs(b));
      let x = 0, z = 0;
      if (s > 0) {
        const k = stretch(s) / s;
        x = a * k;
        z = b * k;
      }
      const y = analytic(x, z);
      const idx = j * V + i;
      heights[idx] = y;
      pos[idx * 3] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;
    }
  }
  const index = new Uint32Array(N * N * 6);
  let t = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * V + i;
      const bb = a + 1;
      const c = a + V;
      const d = c + 1;
      // (a, c, b) and (b, c, d): the diagonal runs b-c. heightAt matches it.
      index[t++] = a; index[t++] = c; index[t++] = bb;
      index[t++] = bb; index[t++] = c; index[t++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  // --- material + mesh ---------------------------------------------------------
  const loader = new THREE.TextureLoader();
  let detailTex = null;
  const ready = new Promise((resolve) => {
    if (body !== 'moon') {
      // Europa's detail is fully procedural; bind a 1x1 so the sampler exists.
      detailTex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
      detailTex.needsUpdate = true;
      resolve();
      return;
    }
    detailTex = loader.load(`${TEXTURE_BASE}2k_moon.jpg`, () => resolve(), undefined, () => resolve());
    detailTex.wrapS = THREE.RepeatWrapping;
    detailTex.wrapT = THREE.MirroredRepeatWrapping;
    detailTex.colorSpace = THREE.NoColorSpace;   // used as a brightness signal, not a colour
    detailTex.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  });
  const mat = groundMaterial(body, detailTex);
  mat.userData.uniforms.uDetail.value = detailTex;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  mesh.castShadow = true;   // crater rims shade their own bowls
  // Only the slopes facing AWAY from the Sun go into the shadow map: they are
  // dark anyway, so sunlit ground can never shadow itself (no acne speckle
  // under a grazing Sun), while rims still throw shadows across the floor.
  mat.shadowSide = THREE.BackSide;
  mesh.frustumCulled = false;
  group.add(mesh);

  // --- exact height --------------------------------------------------------------
  function heightAt(x, z) {
    const gx = x / H + N / 2;
    const gz = z / H + N / 2;
    if (Math.abs(x) < INNER - 0.01 && Math.abs(z) < INNER - 0.01) {
      const i = Math.floor(gx);
      const j = Math.floor(gz);
      const fx = gx - i;
      const fz = gz - j;
      const a = heights[j * V + i];
      const b = heights[j * V + i + 1];
      const c = heights[(j + 1) * V + i];
      const d = heights[(j + 1) * V + i + 1];
      if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
      return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    }
    return analytic(x, z);
  }
  const _n = new THREE.Vector3();
  function normalAt(x, z, out = _n) {
    const e = 0.3;
    const hx = heightAt(x + e, z) - heightAt(x - e, z);
    const hz = heightAt(x, z + e) - heightAt(x, z - e);
    return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
  }

  // --- rocks ------------------------------------------------------------------------
  const colliders = [];
  const rocks = buildRocks();
  group.add(rocks.mesh);

  function buildRocks() {
    const ice = body === 'europa';
    const r = rng(ice ? 505 : 404);
    const list = [];
    const blocked = (x, z, s) => {
      for (const f of L.flat) if (Math.hypot(x - f.x, z - f.z) < f.r * 0.8 + s) return true;
      if (Math.hypot(x, z) < 8 + s) return true;
      return false;
    };
    const add = (x, z, s, sy) => {
      list.push({ x, z, s, sy, yaw: r() * Math.PI * 2, sx: 0.8 + r() * 0.45, sz: 0.75 + r() * 0.5 });
    };
    // Near field: lots of small rocks, some mid, a few boulders.
    const nearCount = ice ? 380 : 520;
    for (let k = 0; k < nearCount; k++) {
      const x = (r() - 0.5) * 2 * 60;
      const z = (r() - 0.5) * 2 * 60;
      const u = r();
      const s = u < 0.72 ? 0.05 + r() * 0.12 : u < 0.95 ? 0.17 + r() * 0.3 : 0.5 + r() * 0.9;
      if (blocked(x, z, s * 2)) continue;
      add(x, z, s, (ice ? 0.5 : 0.55) + r() * 0.35);
    }
    // Clusters around crater rims (Moon) / chaos patch (Europa).
    if (!ice) {
      for (const c of model.craters) {
        if (c.r < 3 || Math.hypot(c.x, c.z) > 120) continue;
        const n = Math.round(c.r * 1.6);
        for (let k = 0; k < n; k++) {
          const a = r() * Math.PI * 2;
          const d = c.r * (0.95 + r() * 0.6);
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          const s = 0.08 + Math.pow(r(), 2) * 0.55;
          if (!blocked(x, z, s * 2)) add(x, z, s, 0.55 + r() * 0.3);
        }
      }
    } else {
      // A field of ice blocks off to the left, big enough to break the skyline.
      for (let k = 0; k < 90; k++) {
        const x = -70 - r() * 160;
        const z = -40 - r() * 220;
        const s = 1 + Math.pow(r(), 1.5) * 6;
        add(x, z, s, 0.6 + r() * 0.5);
      }
      // Fresh blocks tossed along the drill crack.
      const c = LAYOUT.europa.lines[0];
      const f = lineFrame(c);
      for (let k = 0; k < 40; k++) {
        const al = (r() - 0.5) * 60;
        const side = (r() < 0.5 ? -1 : 1) * (2 + r() * 2.5);
        const x = c.x + f.dx * al - f.dz * side;
        const z = c.z + f.dz * al + f.dx * side;
        if (Math.hypot(x - LAYOUT.europa.drill.x, z - LAYOUT.europa.drill.z) < 3.5) continue;
        const s = 0.08 + Math.pow(r(), 2) * 0.45;
        add(x, z, s, 0.5 + r() * 0.4);
      }
    }
    // Far field: bigger, sparser.
    for (let k = 0; k < 220; k++) {
      const a = r() * Math.PI * 2;
      const d = 60 + Math.pow(r(), 0.8) * 320;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const s = 0.3 + Math.pow(r(), 2) * 2.4;
      add(x, z, s, 0.5 + r() * 0.35);
    }

    const geo = rockGeometry(ice ? 'ice' : 'rock', ice ? 3 : 7);
    const mesh = new THREE.InstancedMesh(geo, rockMaterial(body), list.length);
    mesh.name = 'rocks';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qy = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    list.forEach((it, k) => {
      normalAt(it.x, it.z, nrm);
      q.setFromUnitVectors(up, nrm.lerp(up, 0.4).normalize());
      qy.setFromAxisAngle(up, it.yaw);
      q.multiply(qy);
      if (ice) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6)));
      const sy = it.s * it.sy;
      sc.set(it.s * it.sx, sy, it.s * it.sz);
      p.set(it.x, heightAt(it.x, it.z) + sy * (ice ? 0.2 : 0.12), it.z);
      m4.compose(p, q, sc);
      mesh.setMatrixAt(k, m4);
      if (it.s > 0.16) colliders.push({ x: it.x, z: it.z, r: it.s * Math.max(it.sx, it.sz) * 0.9 });
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return { mesh, list };
  }

  const _sunView = new THREE.Vector3();
  function update(dt, camera, sunDir) {
    const u = mat.userData.uniforms;
    u.uTime.value += dt;
    u.uCamPos.value.copy(camera.position);
    _sunView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    u.uSunView.value.copy(_sunView);
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
    detailTex?.dispose();
    rocks.mesh.geometry.dispose();
    rocks.mesh.material.dispose();
    rocks.mesh.dispose();
  }

  return { group, mesh, heightAt, normalAt, colliders, update, dispose, ready, crater: model.craters, lines: model.lines };
}

export { clamp };
