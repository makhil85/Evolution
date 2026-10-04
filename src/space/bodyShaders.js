// Chapter 4 - shared GLSL and material builders for every celestial body.
//
// Every material here is a ShaderMaterial so each body can be lit exactly the
// way it should be (lunar photometry for airless moons, a soft reddened
// terminator for Earth, limb darkening for the gas giants) instead of fighting
// MeshStandardMaterial. All of them include the log-depth chunks - the
// renderer uses a logarithmic depth buffer (contracts.js RENDER).
//
// Lighting convention (matches three.js' physically based materials, so her
// ship and the planets agree about how bright the Sun is):
//   diffuse radiance = albedo / PI * sunColor * sunIntensity * cos(i)
//   night floor      = albedo * uAmbient          (keeps night sides dark grey)
import * as THREE from 'three';
import { SPACE_LIGHT } from './contracts.js';

// ---------------------------------------------------------------------------
// GLSL libraries
// ---------------------------------------------------------------------------

/** 3-D simplex noise (Ashima Arts / Stefan Gustavson, MIT) + hashes + fbm. */
export const NOISE_GLSL = /* glsl */`
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float fbm(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 4.1);
    a *= 0.5;
  }
  return s;
}

float ridged(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p));
    s += a * n * n;
    p = p * 2.07 + vec3(4.3, 1.1, 7.7);
    a *= 0.5;
  }
  return s;
}
`;

/** Surface vertex shader: unit sphere scaled by the mesh; any scale works. */
export const SURFACE_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vObjPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  // Via the normal matrix so non-uniform (oblate) scales stay correct.
  vWorldNormal = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

/**
 * Eclipse shadows from up to four spheres (moons on Jupiter, the Moon on
 * Earth, Earth on the Moon). Soft penumbra from the Sun's real angular size.
 */
const ECLIPSE_GLSL = /* glsl */`
uniform vec4 uOcc[4];
uniform float uSunAng;
float eclipse(vec3 p, vec3 L) {
  float vis = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 o = uOcc[i];
    if (o.w <= 0.0) continue;
    vec3 d = o.xyz - p;
    float t = dot(d, L);
    if (t <= 0.0) continue;
    float sep = length(d - L * t) / t;
    float ro = o.w / t;
    float rs = max(uSunAng, 1e-4);
    float cover = 1.0 - smoothstep(abs(ro - rs), ro + rs, sep);
    vis *= 1.0 - cover * min(1.0, (ro * ro) / (rs * rs));
  }
  return vis;
}
`;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** A hex colour as a linear-space THREE.Color (hex values are authored in sRGB). */
export function lin(hex, scale = 1) {
  return new THREE.Color(hex).multiplyScalar(scale);
}

/** Sun radiance (linear) used by every body shader. */
export function sunRadiance() {
  return lin(SPACE_LIGHT.sunColor, SPACE_LIGHT.sunIntensity);
}

/**
 * Night-side floor. SPACE_LIGHT.ambient is the contract's ambient; three.js'
 * own materials divide it by PI and ACES crushes the result, which makes a
 * night side a black hole, so the body shaders use it at a fixed multiple
 * chosen so an unlit hemisphere reads as dark grey (~20/255), as asked.
 */
export function ambientRadiance(k = 1) {
  return lin(SPACE_LIGHT.ambient, SPACE_LIGHT.ambientIntensity * 2.0 * k);
}

function occUniform() {
  return { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
}

// ---------------------------------------------------------------------------
// planet / moon surface
// ---------------------------------------------------------------------------

/**
 * @param {object} o
 *   map        - albedo texture (sRGB) - procedural moons carry height in alpha
 *   kind       - 'rock' | 'gas' | 'earth' | 'ice'
 *   gain       - albedo multiplier
 *   lunar      - 0..1 Lommel-Seeliger mix (airless bodies look flat-lit, like the real Moon)
 *   wrap       - terminator softness (atmospheres scatter light a little past it)
 *   limb       - limb darkening exponent (gas giants)
 *   twilight   - hex colour of the terminator band, twilightAmt its strength
 *   saturation / contrast - gentle grading of the source map
 *   bump       - height amplitude for maps with height in alpha (procedural moons)
 *   flow       - Jupiter band flow + Red Spot swirl
 *   earth      - { night, clouds } textures
 *   ring       - { map, inner, outer } for Saturn's ring shadow
 */
export function surfaceMaterial(o) {
  const defines = {};
  const uniforms = {
    map: { value: o.map },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uSunColor: { value: sunRadiance() },
    uAmbient: { value: ambientRadiance(o.ambient ?? 1) },
    uTime: { value: 0 },
    uGain: { value: o.gain ?? 1 },
    uLunar: { value: o.lunar ?? 0 },
    uWrap: { value: o.wrap ?? 0 },
    uLimb: { value: o.limb ?? 0 },
    uTwilight: { value: lin(o.twilight ?? 0xffffff) },
    uTwilightAmt: { value: o.twilightAmt ?? 0 },
    uSat: { value: o.saturation ?? 1 },
    uContrast: { value: o.contrast ?? 1 },
    uOcc: occUniform(),
    uSunAng: { value: 0.01 },
    uHighlight: { value: 0 },
    uDebugN: { value: 0 },
  };
  if (o.bump) {
    defines.BUMP = '';
    uniforms.uBump = { value: o.bump };
    const w = o.map?.image?.width || o.mapWidth || 2048;
    uniforms.uTexel = { value: new THREE.Vector2(1 / w, 2 / w) };
  }
  if (o.kind === 'ice') defines.ICE = '';
  if (o.flow) {
    defines.FLOW = '';
    uniforms.uSpot = { value: new THREE.Vector2(o.flow.spot[0], o.flow.spot[1]) };
  }
  if (o.earth) {
    defines.EARTH = '';
    uniforms.nightMap = { value: o.earth.night };
    uniforms.cloudMap = { value: o.earth.clouds };
    uniforms.uCloudRot = { value: 0 };
    uniforms.uCityGain = { value: o.earth.cityGain ?? 2.2 };
    uniforms.uDebug = { value: 0 };
  }
  if (o.ring) {
    defines.RINGSHADOW = '';
    uniforms.ringMap = { value: o.ring.map };
    uniforms.uRingN = { value: new THREE.Vector3(0, 1, 0) };
    uniforms.uCenter = { value: new THREE.Vector3() };
    uniforms.uRingR = { value: new THREE.Vector3(o.ring.inner, o.ring.outer, 1) }; // inner, outer (planet radii), planet radius (u)
  }

  return new THREE.ShaderMaterial({
    name: `body-surface-${o.kind || 'rock'}`,
    defines,
    uniforms,
    vertexShader: SURFACE_VERT,
    fragmentShader: SURFACE_FRAG,
  });
}

const SURFACE_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D map;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uTime;
uniform float uGain;
uniform float uLunar;
uniform float uWrap;
uniform float uLimb;
uniform vec3 uTwilight;
uniform float uTwilightAmt;
uniform float uSat;
uniform float uContrast;
uniform float uHighlight;
uniform float uDebugN;
uniform mat4 modelMatrix;   // shared with the vertex stage
varying vec2 vUv;
varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${ECLIPSE_GLSL}

#ifdef BUMP
uniform float uBump;
uniform vec2 uTexel;
#endif

#ifdef EARTH
uniform sampler2D nightMap;
uniform sampler2D cloudMap;
uniform float uCloudRot;
uniform float uCityGain;
uniform float uDebug;
#endif

#ifdef FLOW
uniform vec2 uSpot;
// Zonal jets + the Great Red Spot's anticyclone, as a velocity field in UV/s.
vec2 flowVel(vec2 uv) {
  float lat = (uv.y - 0.5) * PI;
  float jet = sin(lat * 13.0) * 0.65 + sin(lat * 29.0 + 1.3) * 0.35;
  jet *= 1.0 - smoothstep(0.9, 1.35, abs(lat));
  vec2 v = vec2(jet * 0.00055, 0.0);
  float cl = max(cos(lat), 0.2);
  // Red Spot: elliptical vortex in surface radians.
  vec2 q = vec2((uv.x - uSpot.x) * 2.0 * PI * cl, (uv.y - uSpot.y) * PI);
  vec2 e = q / vec2(0.155, 0.082);
  float r = length(e);
  float w = 0.05 * smoothstep(1.35, 0.15, r) * smoothstep(0.0, 0.25, r);
  vec2 vq = w * vec2(-e.y * 0.155, e.x * 0.082);
  v += vec2(vq.x / (2.0 * PI * cl), vq.y / PI);
  return v;
}
vec3 flowSample(vec2 uv) {
  const float T = 7.0;
  float ph0 = fract(uTime / T);
  float ph1 = fract(uTime / T + 0.5);
  vec2 vel = flowVel(uv);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec3 c0 = textureGrad(map, uv - vel * (ph0 - 0.5) * T, dx, dy).rgb;
  vec3 c1 = textureGrad(map, uv - vel * (ph1 - 0.5) * T, dx, dy).rgb;
  float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  return mix(c1, c0, w0);
}
#endif

#ifdef RINGSHADOW
uniform sampler2D ringMap;
uniform vec3 uRingN;
uniform vec3 uCenter;
uniform vec3 uRingR;
float ringShadow(vec3 p, vec3 L) {
  float denom = dot(L, uRingN);
  if (abs(denom) < 1e-4) return 1.0;
  float t = dot(uCenter - p, uRingN) / denom;
  if (t <= 0.0) return 1.0;
  vec3 hit = p + L * t;
  float r = length(hit - uCenter) / uRingR.z;
  float u = (r - uRingR.x) / (uRingR.y - uRingR.x);
  if (u < 0.0 || u > 1.0) return 1.0;
  float a = texture2D(ringMap, vec2(u, 0.5)).a;
  return 1.0 - a * 0.88;
}
#endif

vec2 dirToUv(vec3 d) {
  return vec2(fract(atan(d.z, -d.x) / (2.0 * PI)), 1.0 - acos(clamp(d.y, -1.0, 1.0)) / PI);
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = uSunDir;
  vec2 uv = vUv;

#ifdef FLOW
  vec3 albedo = flowSample(uv);
#else
  vec4 tex = texture2D(map, uv);
  vec3 albedo = tex.rgb;
#endif

  // Gentle grading of the source photo (contrast around mid grey, saturation).
  float lum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  albedo = mix(vec3(lum), albedo, uSat);
  albedo = pow(max(albedo, 0.0), vec3(uContrast)) * pow(0.18, 1.0 - uContrast);
  albedo *= uGain;

#ifdef BUMP
  {
    // Height lives in the map's alpha. Analytic tangent frame on the sphere.
    vec3 p = normalize(vObjPos);
    float hE = texture2D(map, uv + vec2(uTexel.x, 0.0)).a;
    float hW = texture2D(map, uv - vec2(uTexel.x, 0.0)).a;
    float hN = texture2D(map, uv + vec2(0.0, uTexel.y)).a;
    float hS = texture2D(map, uv - vec2(0.0, uTexel.y)).a;
    float cl = max(sqrt(1.0 - p.y * p.y), 0.08);
    float gE = (hE - hW) / (2.0 * uTexel.x * 2.0 * PI * cl);
    float gN = (hN - hS) / (2.0 * uTexel.y * PI);
    vec3 east = normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-5, 0.0, 0.0));
    vec3 north = cross(p, east);
    // fade the bump out where the map is minified (far away) - no shimmer
    float fw = length(fwidth(uv)) / uTexel.x;
    float k = uBump * (1.0 - smoothstep(2.0, 8.0, fw));
    vec3 nObj = normalize(p - k * (gE * east + gN * north));
    // object -> world: same rotation that turned the unit normal into N
    mat3 M = mat3(modelMatrix);
    vec3 nW = normalize(M * nObj);
    vec3 nW0 = normalize(M * p);
    N = normalize(N + (nW - nW0));
  }
#endif

  float NdL = dot(N, L);
  float NdV = clamp(dot(N, V), 1e-3, 1.0);
  // Terminator: wrapped Lambert, feathered so thick atmospheres fade out
  // softly instead of ending on a hard straight line.
  float lit = clamp((NdL + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  if (uWrap > 0.0) lit *= smoothstep(-uWrap, uWrap * 1.5, NdL);
  if (uLunar > 0.0) {
    // Lommel-Seeliger flattens the disc like the real Moon; NdV is floored so
    // it cannot spike into a bright hard-edged band where we look along the
    // surface (the Europa horizon shot).
    float mu0 = max(NdL, 0.0);
    float ls = 2.0 * mu0 / (mu0 + max(NdV, 0.35));
    lit = mix(lit, ls * smoothstep(0.0, 0.08, mu0), uLunar);
  }

  float shadow = eclipse(vWorldPos, L);
#ifdef RINGSHADOW
  shadow *= ringShadow(vWorldPos, L);
#endif

  vec3 twi = mix(uTwilight, vec3(1.0), smoothstep(-0.02, 0.14, NdL));
  twi = mix(vec3(1.0), twi, uTwilightAmt);
  float limb = uLimb > 0.0 ? pow(NdV, uLimb) : 1.0;

  vec3 sunTerm = uSunColor * RECIPROCAL_PI * lit * shadow * twi * limb;
  vec3 col;

#ifdef EARTH
  // Ocean mask from the day map's blue: no extra texture needed.
  float bfrac = albedo.b / (albedo.r + albedo.g + albedo.b + 1e-4);
  float ocean = smoothstep(0.45, 0.62, bfrac) * (1.0 - smoothstep(0.25, 0.5, lum));

  // Clouds live on their own shell, rotated uCloudRot about local Y. Sample
  // them here too: once straight down (to dim city lights) and once toward
  // the Sun (the shadow a cloud casts on the ground below it).
  mat3 M = mat3(modelMatrix);
  vec3 Lobj = normalize(transpose(M) * L);
  vec3 p = normalize(vObjPos);
  float cs = cos(uCloudRot), sn = sin(uCloudRot);
  vec2 gx = dFdx(vUv), gy = dFdy(vUv);
  vec3 ps = normalize(p + Lobj * (0.010 / max(dot(p, Lobj), 0.25)));
  vec3 q = vec3(cs * ps.x - sn * ps.z, ps.y, sn * ps.x + cs * ps.z);
  float cloudShadow = textureGrad(cloudMap, dirToUv(q), gx, gy).r;
  vec3 q0 = vec3(cs * p.x - sn * p.z, p.y, sn * p.x + cs * p.z);
  float cloudHere = textureGrad(cloudMap, dirToUv(q0), gx, gy).r;
  float cloudShade = 1.0 - 0.6 * smoothstep(0.1, 0.8, cloudShadow);

  // Oceans a touch deeper and bluer.
  albedo = mix(albedo, albedo * vec3(0.8, 1.0, 1.2), ocean);
  col = albedo * (sunTerm * cloudShade + uAmbient);

  // Sun glint: a tight normalised Blinn-Phong lobe plus a broad sheen.
  vec3 H = normalize(L + V);
  float NdH = max(dot(N, H), 0.0);
  float VdH = max(dot(V, H), 0.0);
  float F = 0.035 + 0.965 * pow(1.0 - VdH, 5.0);
  float spec = (0.9 * (260.0 + 8.0) / (8.0 * PI) * pow(NdH, 260.0) + 0.1 * (30.0 + 8.0) / (8.0 * PI) * pow(NdH, 30.0));
  col += uSunColor * spec * F * max(NdL, 0.0) * ocean * shadow * (1.0 - 0.9 * smoothstep(0.1, 0.7, cloudHere)) * smoothstep(0.0, 0.1, NdL);

  // City lights: only on the night side, dimmed under clouds.
  vec3 night = texture2D(nightMap, vUv).rgb;
  float dark = smoothstep(0.06, -0.14, NdL) * (1.0 - 0.8 * smoothstep(0.1, 0.7, cloudHere));
  col += night * vec3(1.0, 0.78, 0.5) * uCityGain * dark;
  if (uDebug > 0.5) col = uDebug > 2.5 ? vec3(abs(cloudHere - texture2D(cloudMap, vUv).r)) : uDebug > 1.5 ? vec3(cloudHere) : vec3(ocean, spec * F * 0.1, 0.0);
#else
  col = albedo * (sunTerm + uAmbient);
  #ifdef ICE
  // Faint glossy sheen - fresh ice.
  vec3 H = normalize(L + V);
  float s = pow(max(dot(N, H), 0.0), 40.0) * 0.06 * (40.0 + 8.0) / (8.0 * PI);
  col += uSunColor * s * max(NdL, 0.0) * shadow * 0.25;
  #endif
#endif

  if (uDebugN > 0.5) col = vec3(max(NdL, 0.0), max(-NdL, 0.0), NdV * 0.3);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------------------
// Earth's cloud shell
// ---------------------------------------------------------------------------

export function cloudMaterial(cloudMap) {
  return new THREE.ShaderMaterial({
    name: 'earth-clouds',
    uniforms: {
      cloudMap: { value: cloudMap },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: sunRadiance() },
      uAmbient: { value: ambientRadiance(0.35) },
      uOcc: occUniform(),
      uSunAng: { value: 0.01 },
    },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D cloudMap;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uAmbient;
      varying vec2 vUv;
      varying vec3 vObjPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      ${ECLIPSE_GLSL}
      void main() {
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float c = texture2D(cloudMap, vUv).r;
        c = smoothstep(0.04, 0.85, c);
        // Seen edge-on, a cloud layer is a longer path: thicker near the limb.
        float NdV = clamp(dot(N, V), 0.05, 1.0);
        float a = 1.0 - pow(1.0 - c * 0.92, 1.0 / mix(1.0, NdV, 0.6));
        float NdL = dot(N, uSunDir);
        float lit = smoothstep(-0.12, 0.45, NdL) * 0.85 + 0.15 * clamp(NdL, 0.0, 1.0);
        vec3 twi = mix(vec3(1.0, 0.55, 0.32), vec3(1.0), smoothstep(-0.06, 0.12, NdL));
        float shadow = eclipse(vWorldPos, uSunDir);
        vec3 col = vec3(0.92) * (uSunColor * RECIPROCAL_PI * lit * twi * shadow + uAmbient * 0.8);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------------------
// atmosphere: analytic single scattering in a thin spherical shell
// ---------------------------------------------------------------------------

/**
 * A shell a little larger than the atmosphere. Each pixel marches the view ray
 * through the gas between the planet and the top of the atmosphere, adding
 * sunlit, density-weighted scattering. The rim is bright because a grazing ray
 * crosses far more gas than a vertical one - the real reason Earth has a thin
 * blue halo. Reddens near the terminator; optional polar aurora (Jupiter).
 *
 *   o.scatter, o.twilight - hex colours; o.density, o.height (scale height,
 *   fraction of thickness); o.flat - polar flattening (1 = sphere);
 *   o.aurora - hex colour or null.
 */
export function atmosphereMaterial(o) {
  const defines = {};
  if (o.aurora) defines.AURORA = '';
  return new THREE.ShaderMaterial({
    name: 'body-atmosphere',
    defines,
    uniforms: {
      uCenter: { value: new THREE.Vector3() },
      uAxis: { value: new THREE.Vector3(0, 1, 0) },
      uRp: { value: 1 },
      uRa: { value: 1.03 },
      uInvFlat: { value: 1 / (o.flat ?? 1) },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: sunRadiance() },
      uScatter: { value: lin(o.scatter) },
      uTwilight: { value: lin(o.twilight ?? 0xff6a30) },
      uDensity: { value: o.density ?? 0.1 },
      uH: { value: o.height ?? 0.3 },
      uMie: { value: o.mie ?? 0.5 },
      uExt: { value: o.ext ?? 0.3 },
      uVeil: { value: o.veil ?? 0.5 },
      uAurora: { value: lin(o.aurora ?? 0x000000) },
      uTime: { value: 0 },
      uHighlight: { value: 0 },
      uOcc: occUniform(),
      uSunAng: { value: 0.01 },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCenter;
      uniform vec3 uAxis;
      uniform float uRp;
      uniform float uRa;
      uniform float uInvFlat;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uScatter;
      uniform vec3 uTwilight;
      uniform float uDensity;
      uniform float uH;
      uniform float uMie;
      uniform float uExt;
      uniform float uVeil;
      uniform vec3 uAurora;
      uniform float uTime;
      uniform float uHighlight;
      varying vec3 vWorldPos;
      ${ECLIPSE_GLSL}

      // Oblate planets: stretch along the axis so the gas is a sphere again.
      vec3 unsquash(vec3 v) { return v + uAxis * dot(v, uAxis) * (uInvFlat - 1.0); }

      bool sphere(vec3 ro, vec3 rd, float r, out float t0, out float t1) {
        float a = dot(rd, rd);
        float b = dot(ro, rd);
        float c = dot(ro, ro) - r * r;
        float d = b * b - a * c;
        if (d <= 0.0) return false;
        d = sqrt(d);
        t0 = (-b - d) / a;
        t1 = (-b + d) / a;
        return true;
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec3 rdW = normalize(vWorldPos - cameraPosition);
        vec3 ro = unsquash(cameraPosition - uCenter);
        vec3 rd = unsquash(rdW);
        float t0, t1, p0, p1;
        if (!sphere(ro, rd, uRa, t0, t1)) discard;
        t0 = max(t0, 0.0);
        if (sphere(ro, rd, uRp, p0, p1) && p0 > 0.0) t1 = min(t1, p0);
        if (t1 <= t0) discard;

        const int N = 12;
        float thick = uRa - uRp;
        float seg = (t1 - t0) / float(N);
        float segLen = seg * length(rd);
        vec3 sum = vec3(0.0);
        vec3 aur = vec3(0.0);
        float od = 0.0;                       // optical depth so far (vertical = ~uH)
        float stepOd = segLen / thick;
        for (int i = 0; i < N; i++) {
          vec3 p = ro + rd * (t0 + seg * (float(i) + 0.5));
          float r = length(p);
          float h = clamp((r - uRp) / thick, 0.0, 1.0);
          float dens = exp(-h / uH) - exp(-1.0 / uH);
          vec3 n = p / r;
          float mu = dot(n, uSunDir);
          // Light still reaches the high air a little past the terminator
          // (grazing the planet: lit while mu > -sqrt(2 h / R)).
          float edge = -sqrt(2.0 * h * thick / uRp);
          float sunVis = smoothstep(edge - 0.03, edge + 0.06, mu);
          // ... and that grazing light has lost its blue (and much of its
          // strength): a thin, dim sunset band.
          // Mostly blue fading into dark; only a thin warm tint right at the
          // terminator.
          float day = smoothstep(edge * 0.6, 0.1, mu);
          float warm = exp(-pow(mu / 0.05, 2.0)) * 0.5;
          vec3 tint = mix(uScatter, uTwilight, warm) * mix(0.1, 1.0, day);
          float dOd = dens * stepOd;
          // light scattered here, dimmed by the gas between here and the eye
          sum += dens * sunVis * tint * exp(-od * uExt) * stepOd;
          od += dOd;
          #ifdef AURORA
          float lat = abs(dot(n, uAxis));
          float oval = exp(-pow((lat - 0.955) / 0.012, 2.0));
          float flick = 0.65 + 0.35 * sin(atan(n.z, n.x) * 7.0 + uTime * 0.7);
          aur += oval * flick * exp(-h / 0.5) * (1.0 - sunVis) * 0.3;   // night side only, faint
          #endif
        }
        float cosT = dot(rdW, uSunDir);
        float phase = 0.75 * (1.0 + cosT * cosT) + uMie * pow(max(cosT, 0.0), 12.0) * 4.0;
        vec3 col = sum * phase * uSunColor * uDensity;
        #ifdef AURORA
        col += aur * stepOd * uAurora;
        #endif
        col += uHighlight * vec3(0.25, 0.9, 1.0) * sum * 0.4;
        // alpha = transmittance: the ground (and stars) behind thick air fade.
        float T = exp(-od * uExt * uVeil);
        gl_FragColor = vec4(col, T);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    // dst * transmittance + in-scattered light
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

// ---------------------------------------------------------------------------
// distance beacons - one Points draw call for every body
// ---------------------------------------------------------------------------

export function beaconMaterial() {
  return new THREE.ShaderMaterial({
    name: 'body-beacons',
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aColor;
      attribute vec2 aSizeAlpha;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aSizeAlpha.y;
        gl_PointSize = aSizeAlpha.x * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        if (vAlpha <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = length(c);
        if (r > 1.0) discard;
        // bright pin-point core + soft coloured halo (round: a cross glint
        // made every planet look like a tiny Saturn)
        float core = exp(-r * r * 90.0);
        float halo = exp(-r * 4.0) * (1.0 - r * r);
        float ring = exp(-pow((r - 0.55) / 0.12, 2.0)) * 0.12;   // faint lens-like ring: not a star
        vec3 col = vColor * (halo * 0.85 + ring) + mix(vColor, vec3(1.0), 0.45) * core * 2.6;
        gl_FragColor = vec4(col * vAlpha, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
