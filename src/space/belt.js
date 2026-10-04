// Chapter 4 - the asteroid belt.
//
// Two populations, per CHAPTER4_PLAN.md:
//   FAR  - BELT.visualCount instanced rocks across the whole ring. Not
//          collidable, just scenery: a handful of draw calls, slow tumble
//          done in the vertex shader (no per-frame CPU matrix churn).
//   NEAR - up to ~BELT.nearCount hero-quality, minable rocks that stream in
//          around the ship while it is inside the belt. Deterministic from
//          a coarse (x,z) cell grid, so the same cell always makes the same
//          rock - flying away and back finds it (or its depleted remains)
//          again, within this session.
//
// Real belt reminder baked into the numbers: BELT.inner/outer/visualCount
// give a SPARSE ring (mostly empty space), not a movie asteroid field.
//
// Lighting: near-rock materials are lit MeshStandardMaterial, so they pick
// up whatever Sun directional light + ambient the scene already has (see
// SPACE_LIGHT in contracts.js) - belt.update() is not given a sun direction,
// by design, matching the shared contract.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BELT, BODIES } from './contracts.js';

// ---------------------------------------------------------------------------
// deterministic helpers
// ---------------------------------------------------------------------------

function hashCell(cx, cz) {
  let h = (cx * 374761393 + cz * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashLattice(ix, iy, iz, seed) {
  let h = ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 2654435761;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967296) * 2 - 1;
}

function smooth(t) { return t * t * (3 - 2 * t); }
function smoothstepJS(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function valueNoise3D(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const c000 = hashLattice(x0, y0, z0, seed), c100 = hashLattice(x0 + 1, y0, z0, seed);
  const c010 = hashLattice(x0, y0 + 1, z0, seed), c110 = hashLattice(x0 + 1, y0 + 1, z0, seed);
  const c001 = hashLattice(x0, y0, z0 + 1, seed), c101 = hashLattice(x0 + 1, y0, z0 + 1, seed);
  const c011 = hashLattice(x0, y0 + 1, z0 + 1, seed), c111 = hashLattice(x0 + 1, y0 + 1, z0 + 1, seed);
  const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0v = x00 + (x10 - x00) * fy, y1v = x01 + (x11 - x01) * fy;
  return y0v + (y1v - y0v) * fz;
}

function fbm3(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 0.55, freq = 1.0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise3D(x * freq, y * freq, z * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/**
 * A craggy, noise-displaced icosahedron - the shared base shape for rocks.
 *
 * The earlier version added a HIGH-frequency, fairly strong "bump" term on
 * top of the base shape noise. On a modest-poly icosahedron that let
 * neighbouring vertices displace so differently that a triangle could fold
 * over itself (its normal ends up pointing inward). With the default
 * FrontSide material that triangle is then backface-culled, which is what
 * showed up as black notches/holes at the silhouette - worst on the bright
 * icy rocks where the contrast made it read as "broken glass". Fixed by (1)
 * a gentler, lower-frequency bump so the surface can't fold, (2) more
 * geometry detail so any remaining curvature is spread over more vertices,
 * and (3) the caller also sets `side: THREE.DoubleSide` on the material as
 * a correct-and-standard belt-and-braces for exactly this class of mesh.
 *
 * Craters are real displacement too - a shallow bowl plus a slightly raised
 * rim - not just a texture trick, per the "Bennu/67P, stylised" target.
 */
function buildCraggyGeometry(seed, detail = 4, roughness = 0.3, craterCount = 5) {
  // IcosahedronGeometry (like all PolyhedronGeometry) comes out NON-INDEXED:
  // every triangle owns its own 3 vertices, none shared with its neighbours.
  // computeVertexNormals() on that gives each vertex the normal of its own
  // single triangle - i.e. flat per-facet shading, no matter how much detail
  // you throw at it. mergeVertices() welds the coincident duplicates into a
  // real indexed mesh FIRST, so neighbouring triangles share vertices, then
  // displacement moves shared points together and computeVertexNormals()
  // below can actually average across faces for smooth, lumpy shading with
  // crisp (not jagged) crater rims.
  let geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const vn = new THREE.Vector3();

  const rand = mulberry32(seed * 7 + 13);
  const craters = [];
  for (let c = 0; c < craterCount; c++) {
    const center = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (center.lengthSq() < 1e-6) center.set(1, 0, 0);
    center.normalize();
    craters.push({ center, radius: 0.16 + rand() * 0.2, depth: 0.045 + rand() * 0.07 });
  }

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    vn.copy(v).normalize();

    const n = fbm3(vn.x * 1.6, vn.y * 1.6, vn.z * 1.6, seed, 4);
    // Gentler and lower-frequency than the old bump term - see comment above.
    const bump = fbm3(vn.x * 2.4, vn.y * 2.4, vn.z * 2.4, seed + 999, 2) * 0.16;

    let craterDelta = 0;
    for (let c = 0; c < craters.length; c++) {
      const cr = craters[c];
      const d = vn.distanceTo(cr.center) / cr.radius; // 0 at centre, 1 at the rim
      if (d > 1.35) continue;
      const bowl = -cr.depth * smoothstepJS(1.0, 0.0, d);
      const rim = cr.depth * 0.4 * (smoothstepJS(0.6, 1.0, d) - smoothstepJS(1.0, 1.3, d));
      craterDelta += bowl + rim;
    }

    const r = Math.max(0.4, 1 + (n + bump) * roughness + craterDelta);
    v.copy(vn).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// A small fixed shape library, built once, reused (by reference) across
// every rock - keeps geometry creation off the hot path entirely.
const SHAPE_COUNT = 5;
let SHAPES = null;
function shapes() {
  if (!SHAPES) {
    SHAPES = [];
    for (let i = 0; i < SHAPE_COUNT; i++) {
      // detail=8 -> ~1600 faces per shape (three's IcosahedronGeometry scales
      // as 20*(detail+1)^2 non-indexed triangles) - only 5 shared geometries
      // total, so the extra vertices are cheap, and hero close-ups need the
      // resolution for the craggy/cratered look to read as detail rather
      // than as visible flat facets.
      SHAPES.push(buildCraggyGeometry(1000 + i * 37, 8, 0.26 + (i % 3) * 0.04, 4 + (i % 3)));
    }
  }
  return SHAPES;
}

// Low-poly variants for the far, instanced belt (cheap per-instance cost x
// thousands) - lower detail and no craters (not worth the vertex cost at
// that distance/size), but still the fixed, gentler bump term so they don't
// fold either.
let FAR_SHAPES = null;
function farShapes() {
  if (!FAR_SHAPES) {
    FAR_SHAPES = [buildCraggyGeometry(55, 2, 0.35, 0), buildCraggyGeometry(91, 2, 0.3, 0)];
  }
  return FAR_SHAPES;
}

// ---------------------------------------------------------------------------
// procedural rock-surface detail - analytic fbm IN THE SHADER, not a texture
// ---------------------------------------------------------------------------
// A sampled texture at any fixed resolution eventually shows its pixels once
// a hero rock fills enough of the screen ("blotchy pixel-blocky detail").
// Evaluating noise analytically per-fragment in object space has no
// resolution to run out of, and no tiling seam either.

const ROCK_NOISE_FN = /* glsl */ `
float rockHash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float rockNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(rockHash(i + vec3(0.0,0.0,0.0)), rockHash(i + vec3(1.0,0.0,0.0)), f.x),
        mix(rockHash(i + vec3(0.0,1.0,0.0)), rockHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(rockHash(i + vec3(0.0,0.0,1.0)), rockHash(i + vec3(1.0,0.0,1.0)), f.x),
        mix(rockHash(i + vec3(0.0,1.0,1.0)), rockHash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float rockFbm(vec3 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    s += rockNoise(p) * a;
    p = p * 2.07 + 11.0;
    a *= 0.5;
  }
  return s;
}
`;

// Albedo: real triplanar fbm, blended by the (object-space) normal so it
// works on any rock shape with no UVs.
const TRIPLANAR_ALBEDO_INJECT = /* glsl */ `
#ifdef USE_TRIPLANAR
  vec3 triBlend = pow(abs(vTriNormal), vec3(3.5));
  triBlend /= max(triBlend.x + triBlend.y + triBlend.z, 1e-4);
  vec3 tp = vTriPos * uTriScale;
  float nx = rockFbm(vec3(tp.y, tp.z, 3.1));
  float ny = rockFbm(vec3(tp.x, tp.z, 7.7));
  float nz = rockFbm(vec3(tp.x, tp.y, 13.3));
  float rockN = nx * triBlend.x + ny * triBlend.y + nz * triBlend.z;
  vec3 base = mix(uTint * uBaseLow, uTint * uBaseHigh, rockN);

  #ifdef USE_METAL_GLINT
    // Subtle brownish/oxidised variation on top of the iron-grey base, so it
    // reads as rock-with-metal rather than a flat-painted sphere.
    float rustN = rockFbm(vec3(tp.x * 1.7 + 5.0, tp.y * 1.7, tp.z * 1.7));
    base = mix(base, base * vec3(1.08, 0.9, 0.78), rustN * 0.35);
    // A small number of SHARP, bright flecks (iron-nickel glinting in raw
    // sunlight), not a broad sheen - kept modest here; the main highlight
    // comes from the material's own specular, clamped separately below so
    // it cannot blow out into a bloom starburst.
    float glintN = pow(rockN, 26.0);
    base += vec3(1.0, 0.97, 0.9) * glintN * 0.6;
  #endif

  #ifdef USE_ICY_SPARKLE
    // Fine glitter, not a disco ball: a high-frequency grid so each fleck is
    // tiny relative to the rock, a soft threshold, and a gentle boost.
    float sparkleN = fbmSparkle(vTriPos * 9.0 + uTime * 0.02);
    float sparkle = smoothstep(0.88, 1.0, sparkleN);
    base += vec3(0.8, 0.9, 1.0) * sparkle * 0.55;
  #endif

  diffuseColor.rgb = base;
#endif
`;

// Bump: real normal perturbation from the same analytic fbm (triplanar
// height differencing), not just an albedo trick - this is what makes the
// surface look textured under lighting instead of flat-shaded plastic.
const TRIPLANAR_BUMP_INJECT = /* glsl */ `
#ifdef USE_TRIPLANAR
  {
    float e = 0.06;
    float nxu = rockFbm(vec3(tp.y + e, tp.z, 3.1));
    float nxv = rockFbm(vec3(tp.y, tp.z + e, 3.1));
    float nyu = rockFbm(vec3(tp.x + e, tp.z, 7.7));
    float nyv = rockFbm(vec3(tp.x, tp.z + e, 7.7));
    float nzu = rockFbm(vec3(tp.x + e, tp.y, 13.3));
    float nzv = rockFbm(vec3(tp.x, tp.y + e, 13.3));
    vec3 gradX = vec3(0.0, nx - nxu, nx - nxv);
    vec3 gradY = vec3(ny - nyu, 0.0, ny - nyv);
    vec3 gradZ = vec3(nz - nzu, nz - nzv, 0.0);
    vec3 bumpN = gradX * triBlend.x + gradY * triBlend.y + gradZ * triBlend.z;
    normal = normalize(normal + bumpN * uBumpStrength);
  }
#endif
`;

const FBM_SPARKLE_FN = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fbmSparkle(vec3 p) {
  return hash13(floor(p * 9.0));
}
`;

function injectTriplanar(shader, { metal = false, icy = false } = {}) {
  shader.uniforms.uTint = { value: new THREE.Color(0xffffff) };
  shader.uniforms.uTriScale = { value: 0.55 };
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uBaseLow = { value: icy ? 0.78 : metal ? 0.5 : 0.55 };
  shader.uniforms.uBaseHigh = { value: icy ? 1.05 : metal ? 1.15 : 1.15 };
  shader.uniforms.uBumpStrength = { value: icy ? 0.45 : metal ? 0.55 : 0.85 };

  const defines = ['#define USE_TRIPLANAR'];
  if (metal) defines.push('#define USE_METAL_GLINT');
  if (icy) defines.push('#define USE_ICY_SPARKLE');

  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position;')
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvTriNormal = objectNormal;');

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>',
      `${defines.join('\n')}\n#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;\nuniform vec3 uTint;\nuniform float uTriScale;\nuniform float uTime;\nuniform float uBaseLow;\nuniform float uBaseHigh;\nuniform float uBumpStrength;\n${ROCK_NOISE_FN}${icy ? FBM_SPARKLE_FN : ''}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${TRIPLANAR_ALBEDO_INJECT}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TRIPLANAR_BUMP_INJECT}`);

  return shader;
}

function buildRockMaterial(colorHex, kindOpts) {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: kindOpts.icy ? 0.4 : kindOpts.metal ? 0.5 : 0.92,
    // Full metalness (PBR) has no diffuse term at all - without an
    // environment map to reflect, that reads as near-black everywhere
    // except a specular hotspot ("glossy bowling ball"). A moderate value
    // keeps a sharper highlight than the other kinds while still letting
    // the iron-grey/brown albedo above actually show under direct light.
    metalness: kindOpts.metal ? 0.35 : 0.02,
    flatShading: false, // smooth (Gouraud-interpolated) normals - see buildCraggyGeometry's mergeVertices comment
    // A displaced closed mesh can fold a triangle over itself at a sharp
    // crater rim or crag; DoubleSide (with three's automatic per-face
    // normal flip for the back face) means that ever shows as a slightly
    // odd normal instead of a black hole through to the stars.
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = function onCompile(shader) {
    injectTriplanar(shader, kindOpts);
    // Dark iron-grey, not black: a mild darken keeps it reading as metal
    // against the sharp glint flecks without crushing it to a bowling ball.
    const tint = new THREE.Color(colorHex);
    if (kindOpts.metal) tint.multiplyScalar(0.92);
    shader.uniforms.uTint.value = tint;
    if (kindOpts.metal) {
      // Belt-and-braces against bloom blowout: cap the linear HDR radiance
      // this material can output, in addition to the higher roughness
      // above, so the sharp glint stays a glint instead of a giant bloom
      // starburst (UnrealBloomPass threshold is 0.92; this keeps us under
      // it even for a highlight looking straight at a bright light).
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\ngl_FragColor.rgb = min(gl_FragColor.rgb, vec3(0.85));',
      );
    }
    this.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => `rock-${kindOpts.metal ? 'm' : ''}${kindOpts.icy ? 'i' : ''}`;
  return mat;
}

// ---------------------------------------------------------------------------
// far belt: instanced, tumbling, vertex-tinted
// ---------------------------------------------------------------------------

// Injected at the existing `#include <common>` site (NOT prepended as a
// standalone block) - prepending a second copy of `#include <common>`
// double-expands three's shared chunk and fails to compile ("function
// already has a body").
const TUMBLE_COMMON_INJECT = /* glsl */ `
attribute vec3 iTumbleAxis;
attribute float iTumbleSpeed;
attribute float iTumblePhase;
uniform float uTime;
mat3 rotAxisAngle(vec3 axis, float angle) {
  float s = sin(angle), c = cos(angle), oc = 1.0 - c;
  vec3 a = normalize(axis);
  return mat3(
    oc * a.x * a.x + c,        oc * a.x * a.y - a.z * s,  oc * a.z * a.x + a.y * s,
    oc * a.x * a.y + a.z * s,  oc * a.y * a.y + c,        oc * a.y * a.z - a.x * s,
    oc * a.z * a.x - a.y * s,  oc * a.y * a.z + a.x * s,  oc * a.z * a.z + c
  );
}
`;

function buildFarBeltGroup() {
  const group = new THREE.Group();
  const geos = farShapes();
  const perGeo = Math.ceil(BELT.visualCount / geos.length);
  const kindKeys = Object.keys(BELT.kinds);
  const rand = mulberry32(0xB0B0B0);

  for (let g = 0; g < geos.length; g++) {
    const count = Math.min(perGeo, BELT.visualCount - g * perGeo);
    if (count <= 0) break;
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.95, metalness: 0.05, vertexColors: true, side: THREE.DoubleSide, flatShading: false,
      transparent: true, // needed for the distance fade below
    });
    mat.onBeforeCompile = function onCompile(shader) {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${TUMBLE_COMMON_INJECT}\nvarying float vCamDist;`)
        .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         mat3 tumble = rotAxisAngle(iTumbleAxis, uTime * iTumbleSpeed + iTumblePhase);
         transformed = tumble * transformed;
         objectNormal = tumble * objectNormal;`,
      )
        .replace('#include <project_vertex>', `#include <project_vertex>\nvCamDist = -mvPosition.z;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCamDist;')
        .replace('#include <dithering_fragment>',
          // Individual far-belt specks fade out with distance so the belt
          // never draws a hard line across the sky when seen edge-on from
          // far away (e.g. from Earth) - only the soft glow band (see
          // buildBeltGlow) should still read at that range.
          'gl_FragColor.a *= 1.0 - smoothstep(1200.0, 2500.0, vCamDist);\n#include <dithering_fragment>');
      this.userData.shader = shader;
    };
    const mesh = new THREE.InstancedMesh(geos[g], mat, count);
    mesh.frustumCulled = false;

    const tumbleAxis = new Float32Array(count * 3);
    const tumbleSpeed = new Float32Array(count);
    const tumblePhase = new Float32Array(count);
    const colorArr = new Float32Array(count * 3);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const col = new THREE.Color();

    // So a rare big far-belt boulder can be hidden if it happens to land
    // right on top of the ship (see hideNearShip below) - a low-poly,
    // unlit-looking rock photobombing the hero near-rocks would break the
    // "AAA" bar even though it is individually rare.
    const helioX = new Float32Array(count);
    const helioZ = new Float32Array(count);
    const baseMatrices = new Array(count);
    const hidden = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = BELT.inner + rand() * (BELT.outer - BELT.inner);
      p.set(Math.cos(ang) * rad, (rand() - 0.5) * BELT.thickness, Math.sin(ang) * rad);
      q.setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2));
      // Mostly small (reads as a sparse dusty ring from a distance), with a
      // rare bigger boulder so the belt doesn't read as pure haze. Capped
      // low enough that even the rare big one landing near the ship (see
      // near-rock streaming below) doesn't loom absurdly over hero rocks.
      const scale = 0.5 + Math.pow(rand(), 2.4) * 40;
      s.setScalar(scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      helioX[i] = p.x; helioZ[i] = p.z;
      baseMatrices[i] = m.clone();

      axis.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      tumbleAxis.set([axis.x, axis.y, axis.z], i * 3);
      tumbleSpeed[i] = 0.02 + rand() * 0.06; // slow tumble
      tumblePhase[i] = rand() * Math.PI * 2;

      const kind = BELT.kinds[kindKeys[i % kindKeys.length]];
      col.set(kind.color).multiplyScalar(0.85 + rand() * 0.3);
      colorArr.set([col.r, col.g, col.b], i * 3);
    }
    mesh.geometry.setAttribute('iTumbleAxis', new THREE.InstancedBufferAttribute(tumbleAxis, 3));
    mesh.geometry.setAttribute('iTumbleSpeed', new THREE.InstancedBufferAttribute(tumbleSpeed, 1));
    mesh.geometry.setAttribute('iTumblePhase', new THREE.InstancedBufferAttribute(tumblePhase, 1));
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.exclusion = { helioX, helioZ, baseMatrices, hidden, count };
    group.add(mesh);
  }

  // A faint dust band along the belt - static points, one extra draw call.
  const dustCount = 2200;
  const dpos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = BELT.inner + rand() * (BELT.outer - BELT.inner);
    dpos.set([Math.cos(ang) * rad, (rand() - 0.5) * BELT.thickness * 1.4, Math.sin(ang) * rad], i * 3);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dmat = new THREE.PointsMaterial({ color: 0x9a8f80, size: 3.5, sizeAttenuation: true, transparent: true, opacity: 0.12, depthWrite: false });
  const dust = new THREE.Points(dgeo, dmat);
  dust.frustumCulled = false;
  group.add(dust);

  // A soft, additive haze glow along the same ring so the belt reads as
  // "a belt" from far away (sparse individual rocks are nearly invisible
  // at beltFar-type distances) - low alpha per point, overlapping into one
  // continuous glow rather than distinct blobs. Screen-space size is capped
  // both ends so it neither disappears at range nor blows up into a giant
  // blob if the ship happens to be near the ring plane.
  group.add(buildBeltGlow(rand));

  return group;
}

const glowVert = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(aSize * (500.0 / -mvPosition.z), 10.0, 85.0);
    #include <logdepthbuf_vertex>
  }
`;
const glowFrag = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    // Faint enough that even the worst case - the whole ring's 1400 points
    // additively stacked edge-on into a thin screen-space band, as seen
    // from far outside the belt (e.g. from Earth) - reads as a soft haze,
    // not a hard line.
    a = pow(a, 1.6) * 0.035;
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(uColor, a);
  }
`;

function buildBeltGlow(rand) {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = BELT.inner + rand() * (BELT.outer - BELT.inner);
    positions.set([Math.cos(ang) * rad, (rand() - 0.5) * BELT.thickness * 0.9, Math.sin(ang) * rad], i * 3);
    sizes[i] = 60 + rand() * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BELT.outer * 1.1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xcabb9c) } },
    vertexShader: glowVert,
    fragmentShader: glowFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

const FAR_EXCLUSION_RADIUS = 170; // roughly where near-rock streaming takes over
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/** Hide any far-belt instance that has drifted within FAR_EXCLUSION_RADIUS of
 * the ship (heliocentric x/z) so a rare big instanced boulder never photobombs
 * the hero near-rock cluster; restores it once the ship moves away again. */
function updateFarExclusion(farGroup, shipX, shipZ) {
  for (const mesh of farGroup.children) {
    const ex = mesh.userData.exclusion;
    if (!ex) continue;
    let changed = false;
    for (let i = 0; i < ex.count; i++) {
      const dx = ex.helioX[i] - shipX;
      const dz = ex.helioZ[i] - shipZ;
      const shouldHide = (dx * dx + dz * dz) < FAR_EXCLUSION_RADIUS * FAR_EXCLUSION_RADIUS ? 1 : 0;
      if (shouldHide !== ex.hidden[i]) {
        ex.hidden[i] = shouldHide;
        mesh.setMatrixAt(i, shouldHide ? ZERO_SCALE_MATRIX : ex.baseMatrices[i]);
        changed = true;
      }
    }
    if (changed) mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// near rocks: deterministic streaming spawner
// ---------------------------------------------------------------------------

const CELL_SIZE = 26;
const SPAWN_RADIUS = 150;
const DESPAWN_RADIUS = 195;
const OCCUPANCY_P = 0.5;
const MAX_ACTIVE = 90;

function cellRock(cx, cz) {
  const rand = mulberry32(hashCell(cx, cz));
  const occupied = rand() < OCCUPANCY_P;
  if (!occupied) return null;
  const cxCenter = (cx + 0.5) * CELL_SIZE;
  const czCenter = (cz + 0.5) * CELL_SIZE;
  const ox = (rand() - 0.5) * CELL_SIZE * 0.85;
  const oz = (rand() - 0.5) * CELL_SIZE * 0.85;
  const x = cxCenter + ox;
  const z = czCenter + oz;
  const radiusFromSun = Math.hypot(x, z);
  if (radiusFromSun < BELT.inner || radiusFromSun > BELT.outer) return null;

  const kindKeys = Object.keys(BELT.kinds);
  const kind = kindKeys[Math.floor(rand() * kindKeys.length) % kindKeys.length];
  const radius = 0.5 + rand() * 7.0; // 1-15 u across
  const density = kind === 'metal' ? 0.95 : kind === 'icy' ? 0.4 : 0.65;
  const mass = Math.max(0.3, radius * radius * radius * density);
  const y = (rand() - 0.5) * BELT.thickness * 0.5;
  const shapeIdx = Math.floor(rand() * SHAPE_COUNT) % SHAPE_COUNT;
  const spin = new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
  const squash = 0.85 + rand() * 0.3;

  return {
    id: `${cx}_${cz}`,
    cx, cz,
    kind,
    x, z, y,
    radius,
    mass,
    remaining: mass,
    shapeIdx,
    spin,
    squash,
  };
}

// ---------------------------------------------------------------------------
// chip particles (mining debris)
// ---------------------------------------------------------------------------

const MAX_CHIPS = 400;
function buildChipSystem() {
  const positions = new Float32Array(MAX_CHIPS * 3);
  const colors = new Float32Array(MAX_CHIPS * 3);
  const sizes = new Float32Array(MAX_CHIPS);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // Additive + toneMapped:false: chips are meant to read as bright,
    // glowing mining sparks (see the >=2 linear boost in spawnBurst below),
    // not flat-lit debris - RENDER.bloom.threshold is 1.25 in linear HDR.
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // Capped: a burst a couple of units from the chase camera was hundreds
        // of pixels per spark and whited out the whole screen (additive).
        gl_PointSize = min(aSize * (300.0 / -mvPosition.z), 22.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (length(c) > 0.5) discard;
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(vColor, 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.geometry.setDrawRange(0, 0);

  const slots = new Array(MAX_CHIPS);
  for (let i = 0; i < MAX_CHIPS; i++) slots[i] = { active: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 };

  function spawnBurst(x, y, z, color, n) {
    // Boosted well past RENDER.bloom.threshold (1.25 linear) so mining
    // debris reads as a bright glowing spark, not a flat-lit fleck.
    const col = new THREE.Color(color).multiplyScalar(1.7);
    for (let k = 0; k < n; k++) {
      let idx = -1;
      for (let i = 0; i < MAX_CHIPS; i++) { if (!slots[i].active) { idx = i; break; } }
      if (idx === -1) break;
      const slot = slots[idx];
      slot.active = true;
      slot.life = 0;
      slot.maxLife = 0.6 + Math.random() * 0.5;
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      const speed = 5 + Math.random() * 8;
      slot.vx = dir.x * speed; slot.vy = dir.y * speed; slot.vz = dir.z * speed;
      positions[idx * 3] = x; positions[idx * 3 + 1] = y; positions[idx * 3 + 2] = z;
      colors[idx * 3] = col.r; colors[idx * 3 + 1] = col.g; colors[idx * 3 + 2] = col.b;
      sizes[idx] = 2 + Math.random() * 2.5;
    }
  }

  function tick(dt) {
    let maxIdx = -1;
    for (let i = 0; i < MAX_CHIPS; i++) {
      const slot = slots[i];
      if (!slot.active) continue;
      slot.life += dt;
      if (slot.life >= slot.maxLife) { slot.active = false; sizes[i] = 0; continue; }
      positions[i * 3] += slot.vx * dt;
      positions[i * 3 + 1] += slot.vy * dt;
      positions[i * 3 + 2] += slot.vz * dt;
      slot.vy -= dt * 0.4; // gentle "gravity" toward the rock's own tiny pull, purely for feel
      maxIdx = i;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.setDrawRange(0, Math.max(0, maxIdx + 1));
  }

  return { points, spawnBurst, tick };
}

// ---------------------------------------------------------------------------
// public factory
// ---------------------------------------------------------------------------

/**
 * Lab/testing convenience only (not part of the shared contract): a single
 * standalone hero rock of a given kind, using the exact same geometry and
 * triplanar material the real belt uses. Lets the lab page show "each kind
 * side by side" deterministically instead of hoping the spawner rolls one
 * of each nearby.
 */
export function createLabRock(kind, shapeIdx = 0) {
  const opts = { metal: kind === 'metal', icy: kind === 'icy' };
  const mesh = new THREE.Mesh(shapes()[shapeIdx % SHAPE_COUNT], buildRockMaterial(BELT.kinds[kind].color, opts));
  return mesh;
}

export function createBelt({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const farGroup = buildFarBeltGroup();
  group.add(farGroup);

  const materials = {
    stony: buildRockMaterial(BELT.kinds.stony.color, {}),
    metal: buildRockMaterial(BELT.kinds.metal.color, { metal: true }),
    icy: buildRockMaterial(BELT.kinds.icy.color, { icy: true }),
  };

  const nearGroup = new THREE.Group();
  group.add(nearGroup);

  // `active` gives O(1) lookup by id (mine/highlight); `nearRocksArr` is the
  // literal live array the contract promises on `belt.nearRocks` - same
  // record objects, kept in sync by reference (push on spawn, splice on
  // despawn/depletion) so `.find`/`.forEach`/indexing all work as expected.
  const active = new Map(); // id -> record { id, kind, x, z, radius, mass, remaining, mesh }
  const nearRocksArr = [];
  const depleted = new Set();
  const pool = [];

  function takeMesh() {
    return pool.pop() || new THREE.Mesh(shapes()[0]);
  }
  function releaseMesh(mesh) {
    nearGroup.remove(mesh);
    mesh.visible = false;
    pool.push(mesh);
  }

  function spawn(rec) {
    const mesh = takeMesh();
    mesh.geometry = shapes()[rec.shapeIdx];
    mesh.material = materials[rec.kind];
    mesh.rotation.copy(rec.spin);
    mesh.scale.setScalar(rec.radius * rec.squash);
    mesh.visible = true;
    mesh.userData.rockId = rec.id;
    nearGroup.add(mesh);
    const record = {
      id: rec.id, kind: rec.kind, x: rec.x, z: rec.z, y: rec.y,
      rx: rec.x, rz: rec.z, // position in the turning frame (see refreshActiveSet)
      radius: rec.radius, mass: rec.mass, remaining: rec.remaining,
      squash: rec.squash, mesh,
    };
    active.set(rec.id, record);
    nearRocksArr.push(record);
  }

  function removeActive(id) {
    const record = active.get(id);
    if (!record) return;
    active.delete(id);
    const idx = nearRocksArr.indexOf(record);
    if (idx !== -1) nearRocksArr.splice(idx, 1);
    releaseMesh(record.mesh);
  }

  const chips = buildChipSystem();
  group.add(chips.points);

  // A single reusable outline mesh for whichever rock is currently targeted.
  const highlightMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x8ff5ff, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false }),
  );
  highlightMesh.visible = false;
  highlightMesh.renderOrder = 5;
  nearGroup.add(highlightMesh);
  let highlightedId = null;

  let lastShipCx = null;
  let lastShipCz = null;

  // ORBITING ROCKS (lead playtest). The rocks used to sit still in space
  // while she orbits the Sun at ~22 u/s, so she streaked past every rock and
  // mining (a couple of seconds within a few units) was impossible. Real
  // asteroids orbit too. The near rocks now live in a frame that turns at the
  // circular-orbit rate for HER current distance from the Sun, so the rocks
  // around her drift along with her. Cells are defined in that turning frame,
  // so the same rocks are there when she comes back; record.x/z stay
  // heliocentric (updated every frame) for everything that reads them.
  let phase = 0;
  let lastTime = null;
  const rotX = (x, z, a) => x * Math.cos(a) - z * Math.sin(a);
  const rotZ = (x, z, a) => x * Math.sin(a) + z * Math.cos(a);

  function refreshActiveSet(shipXh, shipZh) {
    // Ship position in the turning frame.
    const shipX = rotX(shipXh, shipZh, -phase);
    const shipZ = rotZ(shipXh, shipZh, -phase);
    const shipCx = Math.floor(shipX / CELL_SIZE);
    const shipCz = Math.floor(shipZ / CELL_SIZE);
    if (shipCx === lastShipCx && shipCz === lastShipCz) return;
    lastShipCx = shipCx; lastShipCz = shipCz;

    const spanCells = Math.ceil(DESPAWN_RADIUS / CELL_SIZE);
    const wanted = new Set();
    for (let dx = -spanCells; dx <= spanCells; dx++) {
      for (let dz = -spanCells; dz <= spanCells; dz++) {
        const cx = shipCx + dx;
        const cz = shipCz + dz;
        const cxCenter = (cx + 0.5) * CELL_SIZE;
        const czCenter = (cz + 0.5) * CELL_SIZE;
        const d = Math.hypot(cxCenter - shipX, czCenter - shipZ);
        if (d > SPAWN_RADIUS) continue;
        const id = `${cx}_${cz}`;
        if (depleted.has(id) || active.has(id)) { wanted.add(id); continue; }
        if (active.size + wanted.size >= MAX_ACTIVE) continue;
        const rec = cellRock(cx, cz);
        if (!rec) continue;
        wanted.add(id);
      }
    }

    // Spawn newly wanted cells not yet active.
    for (const id of wanted) {
      if (active.has(id) || depleted.has(id)) continue;
      const [cx, cz] = id.split('_').map(Number);
      const rec = cellRock(cx, cz);
      if (rec) spawn(rec);
    }
    // Despawn cells that drifted out of range.
    for (const id of Array.from(active.keys())) {
      const record = active.get(id);
      const d = Math.hypot(record.rx - shipX, record.rz - shipZ);
      if (d > DESPAWN_RADIUS) {
        removeActive(id);
        if (highlightedId === id) { highlightedId = null; highlightMesh.visible = false; }
      }
    }
  }

  function update({ dt = 0, time = 0, origin = { x: 0, z: 0 }, ship = { x: 0, z: 0 } } = {}) {
    group.position.set(-origin.x, 0, -origin.z);

    for (const mesh of farGroup.children) {
      const sh = mesh.material?.userData?.shader;
      if (sh) sh.uniforms.uTime.value = time;
    }
    for (const key in materials) {
      const sh = materials[key].userData.shader;
      if (sh) sh.uniforms.uTime.value = time;
    }

    // Turn the frame at the circular-orbit rate for her distance from the Sun.
    if (lastTime !== null) {
      const r = Math.max(1, Math.hypot(ship.x, ship.z));
      const omega = Math.sqrt(BODIES.sun.gm / (r * r * r));
      const dtSim = Math.max(0, Math.min(600, time - lastTime));
      phase += omega * dtSim;
    }
    lastTime = time;

    refreshActiveSet(ship.x, ship.z);
    updateFarExclusion(farGroup, ship.x, ship.z);

    // Heliocentric positions from the turning frame. Meshes hold heliocentric
    // (x, y, z) directly; `group` already carries -origin, so this is exactly
    // the scene-space position they need.
    const c = Math.cos(phase);
    const sn = Math.sin(phase);
    for (const record of nearRocksArr) {
      record.x = record.rx * c - record.rz * sn;
      record.z = record.rx * sn + record.rz * c;
      record.mesh.position.set(record.x, record.y, record.z);
    }

    if (highlightedId) {
      const record = active.get(highlightedId);
      if (record) {
        highlightMesh.position.copy(record.mesh.position);
        highlightMesh.scale.setScalar(record.mesh.scale.x * 1.12);
        highlightMesh.visible = true;
      } else {
        highlightMesh.visible = false;
      }
    }

    chips.tick(dt);
  }

  function mine(id, amount) {
    const record = active.get(id);
    if (!record) return { resource: null, taken: 0, depleted: true };
    const take = Math.max(0, Math.min(amount, record.remaining));
    record.remaining -= take;
    // Lead (PLAN item 11): the rock visibly breaks apart. By mass alone a big
    // rock barely shrank (1.4 t off 300 t), so each grab also cracks a fifth
    // of it off to the eye; a small rock, or one worn down that far, falls
    // apart completely (beltFx.js flies the pieces into the ship).
    record.vis = (record.vis ?? 1) * 0.8;
    if (record.radius < 1.6 || record.vis < 0.3) record.remaining = 0;
    const frac = Math.max(0, record.remaining / record.mass);
    const scale = record.radius * record.squash * Math.max(0.12, Math.min(record.vis, Math.cbrt(frac)));
    record.mesh.scale.setScalar(scale);

    chips.spawnBurst(record.mesh.position.x, record.mesh.position.y, record.mesh.position.z, BELT.kinds[record.kind].color, Math.min(18, 4 + Math.round(take * 3)));

    const isDepleted = record.remaining <= 1e-3;
    if (isDepleted) {
      depleted.add(id);
      removeActive(id);
      if (highlightedId === id) { highlightedId = null; highlightMesh.visible = false; }
    }
    return { resource: BELT.kinds[record.kind].gives, taken: take, depleted: isDepleted };
  }

  function highlight(id) {
    highlightedId = id;
    if (!id) highlightMesh.visible = false;
  }

  function isInBelt(x, z) {
    const r = Math.hypot(x, z);
    return r >= BELT.inner && r <= BELT.outer;
  }

  function dispose() {
    scene.remove(group);
  }

  return {
    ready: Promise.resolve(),
    update,
    // Live array of { id, kind, x, z, radius, mass, remaining, mesh } - the
    // same object identities every frame, mutated in place, so callers can
    // safely hold a reference across frames (e.g. a targeted rock).
    nearRocks: nearRocksArr,
    mine,
    highlight,
    isInBelt,
    dispose,
    group,
  };
}
