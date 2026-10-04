// Chapter 4 - procedural maps for Io, Europa, Ganymede and Callisto.
//
// No Solar System Scope map exists for them, so each one is painted by a
// fragment shader ONCE at startup into an equirectangular render target
// (same layout as the photo maps, so the same surface shader lights them).
// Every texel is turned back into a direction on the sphere and the noise is
// evaluated in 3-D, so there is no seam and no pinching at the poles.
//
//   rgb = albedo (the target is sRGB, so 8 bits go where the eye needs them)
//   a   = height, 0..1, used for bump lighting at close range
//
// The bake is split into horizontal strips with a flush between them so the
// heavy Europa pass never trips the GPU watchdog.
//
// Longitude 0 (texture centre) is the sub-Jupiter point: the moon is turned so
// it faces Jupiter (planets.js), exactly like the real tidally locked moons.
// "Trailing hemisphere" (lon -90, the -Z side here) is where Europa's brown
// staining is strongest, as on the real moon.
import * as THREE from 'three';
import { NOISE_GLSL } from './bodyShaders.js';

const BAKE_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BAKE_COMMON = /* glsl */`
#include <common>
varying vec2 vUv;
${NOISE_GLSL}

// Same parameterisation as THREE.SphereGeometry: u = phi / 2pi, v = 1 - theta / pi.
vec3 dirFromUv(vec2 uv) {
  float phi = uv.x * 2.0 * PI;
  float theta = (1.0 - uv.y) * PI;
  return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
}
// lon/lat in radians -> direction (lon 0 = texture centre = +X).
vec3 dirFromLonLat(float lon, float lat) {
  float phi = PI + lon;
  float theta = PI * 0.5 - lat;
  return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
}
vec3 srgb(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }
vec3 warp3(vec3 p, float f) {
  return vec3(snoise(p * f + 1.3), snoise(p * f + 5.7), snoise(p * f + 9.1));
}
float angle(vec3 a, vec3 b) { return acos(clamp(dot(a, b), -1.0, 1.0)); }

// Voronoi on the sphere (3-D cells): returns (F1, F2) and the nearest cell id.
vec2 voronoi(vec3 q, out vec3 id) {
  vec3 cell = floor(q);
  float f1 = 9.0, f2 = 9.0;
  id = cell;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = cell + vec3(float(x), float(y), float(z));
    float d = length(q - (c + hash33(c + 0.7)));
    if (d < f1) { f2 = f1; f1 = d; id = c; }
    else if (d < f2) { f2 = d; }
  }
  return vec2(f1, f2);
}

// Craters from a jittered 3-D cell lattice. freshFrac of them are young and
// bright. Returns x: height, y: bright ejecta, z: dark floor.
vec3 craters(vec3 p, float scale, float density, float seed, float maxR, float freshFrac) {
  vec3 q = p * scale;
  vec3 cell = floor(q);
  vec3 res = vec3(0.0);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = cell + vec3(float(x), float(y), float(z));
    vec3 r = hash33(c + seed);
    if (r.x > density) continue;
    vec3 fp = c + 0.5 + (hash33(c * 1.37 + seed + 17.0) - 0.5) * 0.8;
    float rad = mix(0.12, maxR, r.y * r.y);
    float d = length(q - fp) / rad;
    if (d > 2.2) continue;
    float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
    float rim = exp(-pow((d - 1.0) / 0.22, 2.0)) * 0.4;
    float ej = d > 1.0 ? exp(-(d - 1.0) * 2.6) * 0.1 : 0.0;
    float fade = smoothstep(2.2, 1.6, d);
    res.x += (bowl + rim + ej) * fade;
    float fresh = step(1.0 - freshFrac, r.z);
    res.y = max(res.y, fresh * (d < 1.0 ? 0.7 : exp(-(d - 1.0) * 2.8)) * fade);
    res.z = max(res.z, (1.0 - fresh) * smoothstep(0.9, 0.3, d) * 0.5);
  }
  return res;
}

// Bright ray system around a young crater at c (Pwyll, Tros, Osiris).
float rays(vec3 p, vec3 c, float len, float seed) {
  float d = angle(p, c);
  vec3 e1 = normalize(cross(c, vec3(0.0, 1.0, 0.07)));
  vec3 e2 = cross(c, e1);
  vec3 v = p - c * dot(p, c);
  float a = atan(dot(v, e2), dot(v, e1));
  vec2 cs = vec2(cos(a), sin(a));
  float r1 = snoise(vec3(cs * 6.0, seed));
  float r2 = snoise(vec3(cs * 19.0, seed + 4.0));
  float r3 = snoise(vec3(cs * 45.0, seed + 8.0));
  float ray = smoothstep(0.35, 0.95, r1 * 0.5 + r2 * 0.45 + r3 * 0.3 + 0.25);
  float reach = len * (0.55 + 0.6 * (r1 * 0.5 + 0.5));
  float fall = exp(-d / reach) * smoothstep(0.0, len * 0.06, d);
  float blanket = exp(-pow(d / (len * 0.12), 2.0));
  return clamp(ray * fall + blanket * 0.9, 0.0, 1.0);
}
`;

// --- Io: sulphur plains, dark paterae, plume rings -----------------------------------
const IO = /* glsl */`
vec4 paint(vec3 p) {
  vec3 w = warp3(p, 1.5) * 0.12;
  vec3 pw = p + w;
  float n1 = fbm(pw * 1.6, 6);
  float n2 = fbm(pw * 3.0 + 7.0, 6);
  float n3 = fbm(p * 7.0 + 2.0, 5);
  vec3 sulfur = srgb(0.88, 0.80, 0.46);
  vec3 pale = srgb(0.92, 0.89, 0.70);
  vec3 orange = srgb(0.82, 0.60, 0.33);
  vec3 ochre = srgb(0.66, 0.52, 0.34);
  vec3 frost = srgb(0.92, 0.91, 0.84);
  vec3 green = srgb(0.70, 0.70, 0.46);
  float n4 = fbm(pw * 3.2 + 4.0, 5);
  vec3 col = mix(sulfur, pale, smoothstep(-0.35, 0.45, n2) * 0.7);
  col = mix(col, orange, smoothstep(0.0, 0.45, n1) * 0.7);
  col = mix(col, srgb(0.74, 0.44, 0.24), smoothstep(0.2, 0.55, n4) * 0.5);
  col = mix(col, frost, smoothstep(0.35, 0.75, n2 * 0.8 + n3 * 0.3) * 0.5);
  col = mix(col, ochre, smoothstep(0.15, 0.6, -n1) * 0.35);
  col = mix(col, green, smoothstep(0.35, 0.7, fbm(pw * 3.0 + 11.0, 4)) * 0.25);
  // Darker, redder-brown poles.
  float pol = smoothstep(0.5, 0.9, abs(p.y) + n1 * 0.15);
  col = mix(col, srgb(0.55, 0.42, 0.30), pol * 0.7);
  col *= 0.95 + 0.08 * snoise(p * 60.0);
  float h = 0.5 + n1 * 0.04;

  // Paterae: irregular dark volcanic pits, many small, some with orange
  // or red fallout around them.
  // Placed on explicit random surface points (a 3-D lattice mostly misses
  // the sphere at this size), ~150 of them over the moon.
  for (int i = 0; i < 150; i++) {
    float fi = float(i);
    vec3 c = vec3(fi, 3.3, 7.7);
    vec3 r = hash33(c + 3.0);
    vec3 fp = normalize(hash33(c * 1.9 + 5.0) * 2.0 - 1.0);
    float rad = mix(0.009, 0.04, pow(r.y, 2.2));
    float cosd = dot(p, fp);
    if (cosd < cos(rad * 5.0)) continue;               // cheap early out
    vec3 dv = (p - fp) / rad;
    // elongated, lumpy outline
    float d = length(dv * (1.0 + 0.4 * (hash33(c + 9.0) - 0.3)));
    d += snoise(p * 90.0 + fi) * 0.3;
    if (d > 4.5) continue;
    float fall = exp(-max(d - 1.0, 0.0) * 1.1) * smoothstep(4.5, 3.0, d);
    vec3 fallCol = r.z < 0.35 ? srgb(0.75, 0.42, 0.22) : (r.z < 0.6 ? srgb(0.93, 0.90, 0.78) : srgb(0.85, 0.70, 0.40));
    col = mix(col, fallCol, fall * 0.35);
    float core = smoothstep(1.0, 0.7, d);
    vec3 dark = mix(srgb(0.12, 0.10, 0.08), srgb(0.35, 0.25, 0.15), hash13(c * 3.1));
    col = mix(col, dark, core);
    // fresh lava glint in a few
    col = mix(col, srgb(0.85, 0.40, 0.14), smoothstep(0.45, 0.1, d) * step(0.8, hash13(c + 21.0)) * 0.7);
    h -= core * 0.08;
  }

  // The famous ones: Pele's great red ring, Prometheus' white ring, Loki.
  float dp = angle(p, dirFromLonLat(-0.9, -0.33)) + snoise(p * 14.0) * 0.02;
  col = mix(col, srgb(0.70, 0.36, 0.20), exp(-pow((dp - 0.30) / 0.05, 2.0)) * 0.75);
  col = mix(col, srgb(0.78, 0.50, 0.30), smoothstep(0.30, 0.1, dp) * 0.25);
  col = mix(col, srgb(0.12, 0.09, 0.07), smoothstep(0.03, 0.018, dp));
  float dr = angle(p, dirFromLonLat(0.7, -0.03)) + snoise(p * 18.0) * 0.015;
  col = mix(col, srgb(0.95, 0.94, 0.86), exp(-pow((dr - 0.13) / 0.035, 2.0)) * 0.7);
  col = mix(col, srgb(0.15, 0.12, 0.09), smoothstep(0.022, 0.012, dr));
  float dl = angle(p, dirFromLonLat(-2.1, 0.23)) + snoise(p * 12.0) * 0.02;
  col = mix(col, srgb(0.10, 0.08, 0.07), smoothstep(0.07, 0.05, dl));
  col = mix(col, srgb(0.72, 0.62, 0.40), exp(-pow((dl - 0.11) / 0.04, 2.0)) * 0.3);

  // A few tall isolated mountains.
  float m = pow(max(ridged(p * 5.0 + 11.0, 4) - 0.62, 0.0), 1.5) * 2.5;
  h += m * 0.35;
  col *= 1.0 - m * 0.15;
  return vec4(col, clamp(h, 0.0, 1.0));
}`;

// --- Europa: bright ice, red-brown lineae, ridged plains, chaos, Pwyll ---------------
const EUROPA = /* glsl */`
vec4 paint(vec3 p) {
  vec3 w1 = warp3(p, 1.6);
  vec3 pw = normalize(p + w1 * 0.012 + warp3(p, 7.0) * 0.0025);   // lineae: long, gently wandering
  vec3 pm = p + w1 * 0.3;                                         // mottling: organic

  float lat = abs(p.y);
  float trailing = 0.35 + 0.65 * smoothstep(-0.5, 0.85, -p.z);

  // --- base ice: blue-white plains, cream and tan staining ---
  float m1 = fbm(pm * 1.7, 6);
  float m2 = fbm(pm * 4.5 + 3.0, 6);
  float m3 = fbm(p * 18.0 + 7.0, 4);
  vec3 ice = srgb(0.93, 0.92, 0.89);
  vec3 iceBlue = srgb(0.84, 0.88, 0.92);
  vec3 cream = srgb(0.86, 0.80, 0.70);
  vec3 tan_ = srgb(0.76, 0.62, 0.47);
  vec3 brown = srgb(0.58, 0.42, 0.30);
  vec3 col = mix(ice, iceBlue, clamp(0.45 * smoothstep(-0.2, 0.6, m2) + 0.5 * smoothstep(0.45, 0.9, lat), 0.0, 1.0));
  col = mix(col, cream, smoothstep(-0.2, 0.4, m1) * 0.25);
  float stain = smoothstep(-0.05, 0.45, m1 + 0.3 * m2) * trailing * (1.0 - 0.6 * smoothstep(0.5, 0.85, lat));
  col = mix(col, tan_, stain * 0.85);
  col = mix(col, brown, smoothstep(0.3, 0.75, m1 + 0.4 * m2) * trailing * 0.6);
  col *= 0.97 + 0.05 * m3;
  float h = 0.5;

  // (Ridged plains are ~1 km-spaced ridges, far below a texel; drawing them as
  // per-patch ridge sets made a polygon network across the ice, so the fine
  // lineae tier below stands in for them.)

  // --- lineae ---
  // Three tiers so the surface does not read as a wireframe globe:
  //   10 great bands: long, gently wandering, triple-band (dark margins, bright
  //      median stripe), diffuse red-brown halo;
  //   60 medium: SMALL circles (so they curve), about half double ridges;
  //   140 fine: short curved segments.
  // Every line wanders, swells and thins along its length and has its own
  // colour between rust red-brown and pale tan.
  vec3 rust = srgb(0.52, 0.28, 0.17);
  vec3 tanL = srgb(0.70, 0.56, 0.44);
  float dark = 0.0, halo = 0.0, bright = 0.0, ridge = 0.0;
  vec3 lineSum = vec3(0.0);
  float lineW = 0.0;
  for (int i = 0; i < 210; i++) {
    float fi = float(i);
    bool major = i < 10;
    bool medium = i >= 10 && i < 70;
    vec3 r = hash33(vec3(fi * 1.31, 3.7, 1.3));
    vec3 r2 = hash33(vec3(fi * 2.17, 9.4, 4.6));
    float wd = major ? mix(0.0022, 0.004, r.y) : (medium ? mix(0.0018, 0.003, r.y) : mix(0.0019, 0.0026, r.y));   // >= ~1.3 texels at 4K: thinner stair-steps
    vec3 n = normalize(hash33(vec3(fi, 8.1, 2.2)) * 2.0 - 1.0);
    // small-circle offset: 0 = great circle; bigger = tighter curve
    float off = major ? (r2.x - 0.5) * 0.1 : (medium ? (r2.x - 0.5) * 0.9 : (r2.x - 0.5) * 1.3);
    float wig = major ? 0.006 : 0.004;
    float s0 = dot(pw, n) - off;
    if (abs(s0) > wd * 5.0 + wig) continue;               // cheap early out
    float d = abs(s0 + wig * snoise(pw * 3.5 + fi * 1.7));
    vec3 c = normalize(cross(n, normalize(hash33(vec3(fi, 1.9, 7.3)) * 2.0 - 1.0)));
    float extent = major ? mix(1.5, 3.1, r.x) : (medium ? mix(0.35, 1.2, r.x) : mix(0.08, 0.45, r.x));
    vec3 inPlane = pw - n * dot(pw, n);
    float along = angle(normalize(inPlane), c);
    float arc = smoothstep(extent, extent * 0.6, along);
    if (arc <= 0.0) continue;
    float swell = 0.6 + 0.8 * (0.5 + 0.5 * snoise(pw * 6.0 + fi * 2.3));
    float w = wd * swell;
    float strength = major ? 0.95 : (medium ? 0.85 : 0.6);
    float var = 0.65 + 0.35 * snoise(pw * 5.0 + fi * 3.1);
    float core;
    if (medium && r2.y > 0.5) {
      // double ridge: two thin dark lines with ice between them
      core = exp(-pow((d - w * 0.9) / (w * 0.45), 2.0));
    } else {
      core = exp(-pow(d / w, 2.0));
    }
    core *= arc * var;
    float k = core * strength;
    vec3 lc = mix(rust, tanL, pow(r.z, 2.5) * (major ? 0.3 : 0.8));
    lineSum += lc * k;
    lineW += k;
    dark = max(dark, k);
    ridge = max(ridge, core * (major ? 1.0 : (medium ? 0.5 : 0.0)));   // fine lines: colour only
    if (major) {
      halo = max(halo, exp(-pow(d / (w * 3.0), 2.0)) * arc * var);
      bright = max(bright, exp(-pow(d / (w * 0.3), 2.0)) * arc);
    }
  }
  // Cycloids ("flexi"): chains of scalloped arcs, Europa's signature cracks.
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec3 r = hash33(vec3(fi, 21.1, 5.5));
    vec3 n = normalize(hash33(vec3(fi, 13.7, 2.9)) * 2.0 - 1.0);
    vec3 a1 = normalize(cross(n, vec3(0.3, 1.0, 0.2)));
    vec3 a2 = cross(n, a1);
    float s = atan(dot(pw, a2), dot(pw, a1));
    float centre = (r.x - 0.5) * 5.0;
    float len = mix(0.4, 1.2, r.y);
    float arc = smoothstep(len, len * 0.7, abs(s - centre));
    if (arc <= 0.0) continue;
    float cycles = mix(7.0, 16.0, r.z);
    float amp = mix(0.012, 0.03, hash13(vec3(fi, 4.0, 1.0)));
    float scal = amp * abs(sin(s * cycles + fi));
    float d = abs(dot(pw, n) - scal + amp * 0.5);
    float w = mix(0.0016, 0.0028, hash13(vec3(fi, 8.0, 3.0)));
    float core = exp(-pow(d / w, 2.0)) * arc;
    float k = core * 0.85;
    lineSum += mix(rust, tanL, 0.25) * k;
    lineW += k;
    dark = max(dark, k);
    ridge = max(ridge, core * 0.6);
  }
  vec3 lineCol = lineW > 0.0 ? lineSum / lineW : rust;
  vec3 haloCol = srgb(0.72, 0.55, 0.42);
  col = mix(col, haloCol, halo * 0.4);
  col = mix(col, lineCol, dark * 0.85);
  col = mix(col, srgb(0.90, 0.86, 0.80), bright * 0.55);
  h += ridge * 0.06 - bright * 0.02;

  // Lenticulae: small reddish-brown pits and domes freckling the ice.
  for (int i = 0; i < 90; i++) {
    float fi = float(i);
    vec3 c = normalize(hash33(vec3(fi, 31.0, 7.0)) * 2.0 - 1.0);
    float rad = mix(0.004, 0.012, hash13(vec3(fi, 5.0, 2.0)));
    if (dot(p, c) < cos(rad * 2.5)) continue;
    float d = angle(p, c) / rad + snoise(p * 300.0 + fi) * 0.3;
    float m = smoothstep(1.2, 0.6, d);
    col = mix(col, mix(rust, tanL, 0.5 + 0.3 * snoise(p * 500.0)), m * 0.6);
    h += m * 0.02;
  }

  // --- chaos terrain: ice rafts adrift in a brown, lumpy matrix ---
  float chaosMask = smoothstep(0.44, 0.62, fbm(p * 3.2 + 13.0, 5) + 0.08 * fbm(p * 12.0, 3)) * (0.4 + 0.6 * trailing);
  if (chaosMask > 0.0) {
    vec3 pid;
    vec2 cf = voronoi(p * 55.0 + warp3(p, 30.0) * 0.9, pid);
    float raft = step(0.4, hash13(pid + 1.0)) * smoothstep(0.02, 0.14, cf.y - cf.x);
    float lump = snoise(p * 260.0) * 0.5 + snoise(p * 520.0) * 0.25;
    vec3 matrix = mix(srgb(0.55, 0.38, 0.27), srgb(0.66, 0.50, 0.37), lump * 0.5 + 0.5);
    float cm = smoothstep(0.35, 0.8, chaosMask);   // no raft outlines where chaos is faint
    col = mix(col, matrix, cm * (1.0 - raft) * 0.65);
    h += cm * (raft * 0.025 + (1.0 - raft) * lump * 0.02);
  }

  // --- Pwyll: a young crater spraying bright rays across the trailing side ---
  vec3 pwyll = dirFromLonLat(-1.55, -0.44);
  float ry = rays(p, pwyll, 0.3, 3.0);
  col = mix(col, srgb(0.97, 0.97, 0.96), ry * 0.7);
  float pd = angle(p, pwyll);
  col = mix(col, srgb(0.50, 0.38, 0.30), smoothstep(0.012, 0.005, pd));
  h -= smoothstep(0.012, 0.0, pd) * 0.1;
  // A second, smaller one near the sub-Jupiter side, and the odd tiny crater.
  vec3 c2 = dirFromLonLat(0.5, 0.35);
  col = mix(col, srgb(0.97, 0.97, 0.96), rays(p, c2, 0.12, 7.0) * 0.5);
  vec3 cr = craters(p, 40.0, 0.05, 9.0, 0.3, 0.8);
  h += cr.x * 0.05;
  col = mix(col, srgb(0.96, 0.96, 0.95), cr.y * 0.4);

  return vec4(col, clamp(h, 0.0, 1.0));
}`;

// --- Ganymede: dark ancient regions cut by pale grooved lanes, frosty poles ----------
const GANYMEDE = /* glsl */`
vec4 paint(vec3 p) {
  vec3 w = warp3(p, 1.4) * 0.3;
  vec3 pw = p + w;

  // Grooved terrain: lanes (Voronoi cells), each with its own groove direction.
  vec3 id;
  vec2 vf = voronoi(pw * 3.4, id);
  vec3 ax = normalize(hash33(id + 7.0) * 2.0 - 1.0);
  float k = mix(160.0, 320.0, hash13(id));
  float g = sin(dot(p, ax) * k + snoise(p * 14.0) * 2.0);
  float groove = smoothstep(-0.2, 1.0, g);
  float laneEdge = smoothstep(0.1, 0.0, vf.y - vf.x);

  // Dark terrain: a few large old regions (Galileo Regio and friends),
  // soft-edged and frayed by the grooved lanes that cut into them.
  float reg = fbm(pw * 1.0 + 3.1, 6) + fbm(p * 6.0, 3) * 0.12;
  float darkMask = smoothstep(-0.1, 0.3, reg - laneEdge * 0.08) * 0.85;

  vec3 light = srgb(0.62, 0.60, 0.57) * (0.92 + 0.12 * hash13(id + 3.0));
  light = mix(light, srgb(0.60, 0.61, 0.64), 0.3 * smoothstep(0.0, 0.5, snoise(pw * 3.0)));
  vec3 col = light * (0.94 + 0.07 * groove);
  col = mix(col, light * 0.86, laneEdge * 0.5);

  float dn = fbm(p * 7.0 + 1.0, 5);
  vec3 dcol = mix(srgb(0.40, 0.36, 0.31), srgb(0.50, 0.45, 0.39), smoothstep(-0.4, 0.5, dn));
  // Concentric furrows across Galileo Regio.
  float fd = angle(p, normalize(vec3(0.35, 0.45, -0.82)));
  float furrow = pow(0.5 + 0.5 * sin(fd * 80.0 + snoise(p * 9.0) * 1.2), 8.0) * smoothstep(1.2, 0.3, fd);
  dcol *= 1.0 - furrow * 0.12;
  col = mix(col, dcol, darkMask);
  float h = 0.5 + groove * 0.035 * (1.0 - darkMask) - darkMask * 0.02;

  // Frost caps.
  float cap = smoothstep(0.6, 0.85, abs(p.y) + fbm(p * 6.0, 3) * 0.12);
  col = mix(col, srgb(0.84, 0.85, 0.88), cap * 0.55);

  // Craters: bright young ones speckle everything, more visible on dark ground.
  vec3 c1 = craters(p, 8.0, 0.3, 1.0, 0.35, 0.3);
  vec3 c2 = craters(p, 20.0, 0.45, 2.0, 0.35, 0.3);
  vec3 c3 = craters(p, 48.0, 0.55, 3.0, 0.3, 0.35);
  h += c1.x * 0.06 + c2.x * 0.035 + c3.x * 0.02;
  float fresh = max(c1.y, max(c2.y, c3.y));
  col = mix(col, srgb(0.88, 0.88, 0.88), fresh * 0.6);
  col *= 1.0 - max(c1.z, c2.z) * 0.15;

  // Rayed craters (Tros, Osiris).
  col = mix(col, srgb(0.93, 0.93, 0.93), rays(p, dirFromLonLat(0.6, -0.55), 0.16, 1.0) * 0.6);
  col = mix(col, srgb(0.93, 0.93, 0.93), rays(p, dirFromLonLat(-0.45, 0.2), 0.1, 5.0) * 0.55);
  return vec4(col, clamp(h, 0.0, 1.0));
}`;

// --- Callisto: dark, saturated with old craters, bright specks, Valhalla -------------
const CALLISTO = /* glsl */`
vec4 paint(vec3 p) {
  vec3 w = warp3(p, 1.5) * 0.25;
  float n = fbm((p + w) * 2.4, 6);
  vec3 col = mix(srgb(0.21, 0.18, 0.15), srgb(0.34, 0.30, 0.25), smoothstep(-0.5, 0.5, n));
  col *= 0.9 + 0.18 * fbm(p * 18.0, 4);
  float h = 0.5 + n * 0.02;
  float bright = 0.0;
  vec3 c;
  // Big old basins: shape only, worn smooth.
  c = craters(p, 4.5, 0.5, 1.0, 0.4, 0.0);  h += c.x * 0.08;
  c = craters(p, 10.0, 0.7, 2.0, 0.4, 0.08); h += c.x * 0.05; bright = max(bright, c.y * 0.6);
  c = craters(p, 24.0, 0.85, 3.0, 0.4, 0.12); h += c.x * 0.03; bright = max(bright, c.y * 0.8);
  c = craters(p, 55.0, 0.9, 4.0, 0.4, 0.18); h += c.x * 0.015; bright = max(bright, c.y);
  c = craters(p, 110.0, 0.9, 5.0, 0.4, 0.2); h += c.x * 0.008; bright = max(bright, c.y);
  col = mix(col, srgb(0.74, 0.72, 0.68), bright * 0.65);

  // Valhalla: bright centre and faint concentric rings.
  vec3 v = dirFromLonLat(0.9, 0.25);
  float d = angle(p, v) + snoise(p * 12.0) * 0.015;
  float ringsV = pow(0.5 + 0.5 * cos(d * 60.0), 4.0) * smoothstep(0.8, 0.15, d);
  col = mix(col, srgb(0.58, 0.54, 0.48), smoothstep(0.16, 0.0, d) * 0.75);
  col = mix(col, srgb(0.46, 0.42, 0.37), ringsV * 0.35);
  h += ringsV * 0.02;
  return vec4(col, clamp(h, 0.0, 1.0));
}`;

const PAINTERS = { io: IO, europa: EUROPA, ganymede: GANYMEDE, callisto: CALLISTO };

/** Bake one moon. Returns the render target (use `.texture`). */
function bake(renderer, id, width) {
  const height = width / 2;
  const rt = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    colorSpace: THREE.SRGBColorSpace,
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
  });
  rt.texture.name = `${id}-procedural`;

  const mat = new THREE.ShaderMaterial({
    name: `bake-${id}`,
    vertexShader: BAKE_VERT,
    // Height is 8-bit: dither it, or smooth slopes quantise into terraces
    // whose edges the bump lighting draws as a contour-line network.
    fragmentShader: `${BAKE_COMMON}\n${PAINTERS[id]}\nvoid main() {\n  vec4 c = paint(dirFromUv(vUv));\n  c.a += (hash13(vec3(gl_FragCoord.xy, 7.0)) - 0.5) / 255.0;\n  gl_FragColor = c;\n}`,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  const gl = renderer.getContext();
  const strips = Math.max(1, Math.round(height / 128));
  const sh = Math.ceil(height / strips);
  rt.scissorTest = true;
  for (let s = 0; s < strips; s++) {
    rt.scissor.set(0, s * sh, width, sh);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    gl.flush();
  }
  rt.scissorTest = false;
  rt.scissor.set(0, 0, width, height);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;

  mat.dispose();
  quad.geometry.dispose();
  return rt;
}

/**
 * Bake all four Galilean moons. Europa - the goal of the whole game - gets a
 * 4K map; the others 2K.
 * @returns {{[id: string]: THREE.WebGLRenderTarget}}
 */
export function bakeMoonMaps(renderer) {
  return {
    io: bake(renderer, 'io', 2048),
    europa: bake(renderer, 'europa', 4096),
    ganymede: bake(renderer, 'ganymede', 2048),
    callisto: bake(renderer, 'callisto', 2048),
  };
}
