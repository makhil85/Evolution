// Chapter 4 - the sky backdrop.
//
// USER'S RULE (do not soften this): space is NOT blue and NOT pitch black.
// Near-black ground, a faint WARM haze toward the Sun (the Sun is at
// heliocentric 0,0 and the haze direction moves as the ship moves), a
// clearly-visible Milky Way (brightened + contrast-lifted, not grey mush),
// and bright crisp stars with a few coloured ones and a gentle twinkle.
//
// Implementation: one big sphere, centred on the camera every frame so it
// always surrounds it regardless of the floating origin, carrying a single
// fragment shader that layers: near-black floor -> a PROCEDURAL Milky Way
// (see skyFbm5/skyFbm3 below - no texture) -> warm sun-haze term -> a faint
// zodiacal-light band along the ecliptic (world Y ~ 0) toward the Sun. A
// second object, additive Points, draws crisp pixel-sized stars with a
// gentle per-star twinkle and a few coloured ones on top.
//
// The Milky Way was a graded photo texture through two earlier rounds; a
// 2K equirect stretched over 360 degrees and blurred enough to kill its own
// baked-in point stars has too few effective texels left, and posterises
// into grey "camouflage" blobs once run through the exposure curve. Doing
// it analytically per-fragment from direction has no texel budget to run
// out of. `2k_stars_milky_way.jpg` is left on disk but no longer loaded.
//
// The sphere mesh itself carries no rotation (mesh.rotation stays identity),
// so `normalize(position)` in the shader is already a valid world-space
// direction once the mesh is translated to the camera - no world-matrix
// inverse-transpose needed for the sun/zodiacal/galactic-band dot products.
import * as THREE from 'three';
import { SPACE_LIGHT } from './contracts.js';

const SKY_RADIUS = 30000; // inside RENDER.far (400000), well outside every body

const logdepthVaryingVert = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vDir;
`;

const logdepthMainVert = /* glsl */ `
  void main() {
    vDir = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

// Procedural Milky Way - a photo texture at any fixed resolution runs out of
// texels once you stretch it across a full 360 degrees and blur away its
// baked-in point stars (see the removed gradeMilkyWay/blurMilkyWay - kept
// out of the bundle now, texture file left on disk but never loaded). All of
// this is instead evaluated per-fragment from direction alone: a band along
// one fixed great circle, tilted ~60 degrees to the ecliptic (world y = 0),
// with a soft Gaussian cross-section, fbm cloud structure along its length,
// a darker dust lane fbm near its centre, and a warm cream-to-grey-brown
// colour ramp - never blue, and capped well below "grey wall" brightness.
const skyFragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uGround;
  uniform vec3 uHazeColor;
  uniform vec3 uSunDir;
  uniform float uHazeStrength;
  uniform float uZodiacalStrength;
  uniform float uMilkyWayStrength;
  varying vec3 vDir;

  float skyHash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float skyNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(skyHash(i + vec3(0.0,0.0,0.0)), skyHash(i + vec3(1.0,0.0,0.0)), f.x),
          mix(skyHash(i + vec3(0.0,1.0,0.0)), skyHash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
      mix(mix(skyHash(i + vec3(0.0,0.0,1.0)), skyHash(i + vec3(1.0,0.0,1.0)), f.x),
          mix(skyHash(i + vec3(0.0,1.0,1.0)), skyHash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
      f.z);
  }
  // 5 octaves for the cloud structure, 3 (cheaper) for the dust lanes.
  float skyFbm5(vec3 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { s += skyNoise(p) * a; p = p * 2.05 + 7.0; a *= 0.5; }
    return s;
  }
  float skyFbm3(vec3 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 3; i++) { s += skyNoise(p) * a; p = p * 2.05 + 7.0; a *= 0.5; }
    return s;
  }
  float ditherHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 dir = normalize(vDir);

    // The band's plane normal: the ecliptic normal (0,1,0) tilted 60 degrees
    // about Z. Fixed and arbitrary (this is a game backdrop, not a star
    // chart) - just needs to not be the ecliptic itself.
    const vec3 galN = vec3(0.8660254, 0.5, 0.0);
    float bandDeg = asin(clamp(dot(dir, galN), -1.0, 1.0)) * 57.29578;
    const float sigma = 7.0;
    float bandProfile = exp(-0.5 * (bandDeg / sigma) * (bandDeg / sigma));

    // Lead tuning: finer, clumpier clouds (higher frequency, squared so the
    // gaps between clumps go dark) read as a star field, not a smooth wall.
    float cloudN = skyFbm5(dir * 5.5 + vec3(7.3, 1.1, 4.6));
    float milkyIntensity = bandProfile * (0.15 + 1.25 * cloudN * cloudN);

    // Dust lanes: a second, coarser fbm, only allowed to darken close to the
    // band's own centre (a narrower Gaussian than the band itself).
    float coreProfile = exp(-0.5 * (bandDeg / (sigma * 0.45)) * (bandDeg / (sigma * 0.45)));
    float laneN = skyFbm3(dir * 1.4 + vec3(2.2, 9.9, 0.4));
    float laneMask = smoothstep(0.42, 0.68, laneN) * coreProfile;
    milkyIntensity *= (1.0 - laneMask * 0.6);

    // Warm-neutral colour only: cream/tan at the brightest core, grey-brown
    // at the faint edges. No channel here ever favours blue.
    vec3 coreColor = vec3(1.0, 0.93, 0.78);
    vec3 edgeColor = vec3(0.5, 0.46, 0.42);
    vec3 milkyColor = mix(edgeColor, coreColor, clamp(milkyIntensity * 1.3, 0.0, 1.0));
    // Kept subtle on purpose: a faint glowing band, not a grey wall - this
    // is the actual brightness cap, independent of the colour ramp above.
    vec3 milky = milkyColor * milkyIntensity * 0.24 * uMilkyWayStrength;

    // Warm haze toward the Sun: broad, soft, faint - "as if sun light",
    // never a hard glow (the Sun body itself is drawn separately).
    float sunDot = max(dot(dir, uSunDir), 0.0);
    float haze = pow(sunDot, 1.6) * uHazeStrength;

    // Zodiacal light: a faint band along the ecliptic (world y ~ 0),
    // brightest toward the Sun. Real, and reads as "sunlit dust".
    float eclipticBand = 1.0 - smoothstep(0.02, 0.30, abs(dir.y));
    float zodiacal = pow(sunDot, 6.0) * eclipticBand * uZodiacalStrength;

    vec3 color = uGround + milky + uHazeColor * (haze + zodiacal);
    // Blue-noise-ish dither, ~1 LSB, so the smooth procedural gradient above
    // never quantises into visible 8-bit contour bands.
    color += (ditherHash(gl_FragCoord.xy) - 0.5) * (1.0 / 180.0);
    color = max(color, vec3(0.0));
    // Belt-and-braces against the sky ever bloom-blowing-out: this is
    // backdrop, not the Sun (drawn separately) or a deliberate glint, so it
    // should never individually clear the bloom threshold.
    color = min(color, vec3(1.1));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const starVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute float aPhase;
  attribute float aTwinkleSpeed;
  attribute float aBright;
  uniform float uTime;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBright;
  void main() {
    vColor = color;
    // Subtle twinkle only - a gentle brightness wobble, not a size flicker
    // (the old version scaled gl_PointSize by the same amount, which read
    // as sparkling/flickering rather than a calm twinkle).
    float tw = 0.9 + 0.1 * sin(uTime * aTwinkleSpeed + aPhase);
    vTwinkle = tw;
    vBright = aBright;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Points need enough raster footprint (several px) for the fragment's
    // circular falloff to actually read as round instead of a hard square -
    // a 1-2px point has too few samples to show a circle at all.
    gl_PointSize = aSize;
    #include <logdepthbuf_vertex>
  }
`;

const starFragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a;

    if (vBright > 0.5) {
      // Hero star: a TINY, tight pinpoint core (not a big soft ball - that
      // reads as a planet, not a star) plus thin, faint 4-point diffraction
      // spikes reaching further out. The point sprite itself is sized to
      // give the spikes room, but almost none of that footprint should
      // actually paint anything - hence the very small core radius and the
      // near-absence of a halo term.
      float core = smoothstep(0.07, 0.0, d);
      vec2 ac = abs(c);
      float armH = (1.0 - smoothstep(0.0, 0.012, ac.y)) * (1.0 - smoothstep(0.0, 0.5, ac.x));
      float armV = (1.0 - smoothstep(0.0, 0.012, ac.x)) * (1.0 - smoothstep(0.0, 0.5, ac.y));
      float spike = max(armH, armV) * 0.22;
      float haloWisp = smoothstep(0.16, 0.0, d) * 0.15;
      a = clamp(core + spike + haloWisp, 0.0, 1.0);
    } else {
      // Ordinary star: a small, near-solid core plus a soft falling-off
      // halo - a real "star" silhouette rather than one hard-edged blob
      // (which is what read as a square at small sizes: not enough
      // gradient to see the circle).
      float core = smoothstep(0.22, 0.0, d);
      float halo = smoothstep(0.5, 0.05, d);
      a = clamp(core + halo * 0.55, 0.0, 1.0);
    }

    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(vColor * (0.82 + 0.5 * vTwinkle), a);
  }
`;

/** Cheap deterministic PRNG so the star field is the same every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStarField(count = 2600) {
  const rand = mulberry32(0xC0FFEE);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const brightFlags = new Float32Array(count);

  // Mostly white/blue-white stars, a handful of warm coloured ones.
  const tints = [0xffffff, 0xffffff, 0xffffff, 0xdbe8ff, 0xfff2de, 0xffd7a8, 0xa8d4ff, 0xffb3a8];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() < 1e-6) v.set(1, 0, 0);
    v.normalize().multiplyScalar(SKY_RADIUS * 0.98);
    positions.set([v.x, v.y, v.z], i * 3);

    const bright = rand();
    const isColored = rand() < 0.12;
    const tint = new THREE.Color(isColored ? tints[(i % (tints.length - 3)) + 3] : 0xffffff);
    // RENDER.bloom.threshold is 1.25 in linear HDR - ordinary stars stay
    // capped comfortably below it (crisp, but not blooming and cluttering
    // the frame). Hero stars are pushed just past it - only just, so the
    // bloom stays a thin glow around a pinpoint rather than a big ball that
    // gets mistaken for a planet. ~1% of stars are hero, so a typical 55 deg
    // view shows 2-3, not a sky full of them.
    const isHero = bright > 0.99;
    const boost = isHero ? 1.5 + rand() * 0.5 : 0.5 + bright * 0.55;
    colors.set([tint.r * boost, tint.g * boost, tint.b * boost], i * 3);

    // Sized in real pixels with enough footprint for the fragment shader's
    // circular falloff to actually render as round (a 1-2px point cannot
    // show a circle at all - it rasterises as a hard square regardless of
    // the shader). Hero stars get a bigger POINT so the diffraction spikes
    // have room to extend, but the shader paints only a tiny core within
    // it, so they still read as pinpoints, not glowing balls.
    sizes[i] = isHero ? 13 + rand() * 5 : 3.2 + Math.pow(rand(), 2.4) * 3.2;
    brightFlags[i] = isHero ? 1 : 0;
    phases[i] = rand() * Math.PI * 2;
    speeds[i] = 0.35 + rand() * 0.5; // gentle twinkle, never frantic
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(brightFlags, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.1);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -999;
  return points;
}

export function createSky({ scene }) {
  const group = new THREE.Group();
  group.renderOrder = -1000;
  scene.add(group);

  const uniforms = {
    uGround: { value: new THREE.Color(SPACE_LIGHT.background) },
    uHazeColor: { value: new THREE.Color(SPACE_LIGHT.sunHaze).multiplyScalar(3.2) },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uHazeStrength: { value: 0.55 },
    uZodiacalStrength: { value: 0.35 },
    uMilkyWayStrength: { value: 1.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: logdepthVaryingVert + logdepthMainVert,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: true,
  });

  // No baked rotation on the geometry itself any more - see skyEquirectUv's
  // comment: once uv comes from direction rather than a vertex attribute,
  // every direction is covered by the sphere regardless of how it's
  // rotated, so a geometry rotation is a no-op.
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 64, 40);

  const sphere = new THREE.Mesh(geometry, material);
  sphere.frustumCulled = false;
  sphere.renderOrder = -1000;
  group.add(sphere);

  const stars = buildStarField();
  group.add(stars);

  // Milky Way is fully procedural now (see the fragment shader) - nothing
  // to load, so this resolves immediately. The photo is intentionally left
  // unused on disk rather than deleted.
  const ready = Promise.resolve();

  const tmpDir = new THREE.Vector3();

  function update({ camera, sunDirection }) {
    if (camera) group.position.copy(camera.position);
    if (sunDirection) {
      tmpDir.copy(sunDirection).normalize();
      uniforms.uSunDir.value.copy(tmpDir);
    }
    uniforms.uMilkyWayStrength.value = 1.0;
    stars.material.uniforms.uTime.value = performance.now() / 1000;
  }

  function dispose() {
    scene.remove(group);
    geometry.dispose();
    material.dispose();
    stars.geometry.dispose();
    stars.material.dispose();
  }

  return { ready, update, dispose, group };
}
