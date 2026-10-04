// Chapter 4 - sense of speed.
//
// Space has no ground rushing past, so "how fast am I going" has to be
// invented: two layers of streaking particles, both centred on the camera
// in a wrap-around box (a classic "snow globe" volume - a particle that
// drifts past one face reappears on the opposite face, so the field never
// runs out no matter how far or fast the ship travels).
//
//   DUST   - close, short streaks. Strong parallax at ordinary flight speed.
//   STREAK - far, long streaks. These are what sell 1x/4x/16x/64x warp.
//
// Both are drawn as LineSegments (head = particle position, tail = head -
// velocityDir * length), so "faster" or "more warp" is simply "the line
// gets longer", with per-vertex alpha fading the tail out (a cheap
// motion-blur look with zero extra draw calls). Everything fades to
// invisible at rest, per the brief.
import * as THREE from 'three';

const logdepthVert = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uOpacity;
  void main() {
    vAlpha = aAlpha * uOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const logdepthFrag = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    #include <logdepthbuf_fragment>
    if (vAlpha <= 0.001) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

function buildStreakSystem(count, color) {
  const positions = new Float32Array(count * 2 * 3); // 2 vertices per streak
  const alphas = new Float32Array(count * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: logdepthVert,
    fragmentShader: logdepthFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;

  // "Logical" head position per particle, independent of the GPU buffer -
  // this is what gets moved/wrapped each frame; the buffer is derived from it.
  const hx = new Float32Array(count);
  const hy = new Float32Array(count);
  const hz = new Float32Array(count);
  return { lines, geo, positions, alphas, hx, hy, hz, count };
}

function seedBox(sys, half, cx, cy, cz) {
  for (let i = 0; i < sys.count; i++) {
    sys.hx[i] = cx + (Math.random() * 2 - 1) * half;
    sys.hy[i] = cy + (Math.random() * 2 - 1) * half;
    sys.hz[i] = cz + (Math.random() * 2 - 1) * half;
  }
}

/** Wrap v (relative to c) into [-half, half), i.e. keep it inside the box. */
function wrap(v, c, half) {
  let r = (v - c + half) % (half * 2);
  if (r < 0) r += half * 2;
  return c + r - half;
}

export function createDust({ scene }) {
  const group = new THREE.Group();
  group.renderOrder = 900; // draw late; additive, depth-tested against the world
  scene.add(group);

  const DUST_COUNT = 700;
  const DUST_HALF = 16;
  const STREAK_COUNT = 500;
  const STREAK_HALF = 260;

  const dust = buildStreakSystem(DUST_COUNT, 0xdfe6ff);
  const streaks = buildStreakSystem(STREAK_COUNT, 0xeaf4ff);
  group.add(dust.lines, streaks.lines);

  let seeded = false;

  function stepSystem(sys, half, dt, camPos, vx, vy, vz, speed, len, opacity) {
    const dirScaleX = speed > 1e-4 ? vx / speed : 0;
    const dirScaleY = speed > 1e-4 ? vy / speed : 0;
    const dirScaleZ = speed > 1e-4 ? vz / speed : 0;
    const useVX = speed > 1e-4 ? vx : 0;
    const useVY = speed > 1e-4 ? vy : 0;
    const useVZ = speed > 1e-4 ? vz : 0;

    for (let i = 0; i < sys.count; i++) {
      // Advect opposite to the ship's motion, then wrap into the box.
      sys.hx[i] -= useVX * dt;
      sys.hy[i] -= useVY * dt;
      sys.hz[i] -= useVZ * dt;
      sys.hx[i] = wrap(sys.hx[i], camPos.x, half);
      sys.hy[i] = wrap(sys.hy[i], camPos.y, half);
      sys.hz[i] = wrap(sys.hz[i], camPos.z, half);

      const hx = sys.hx[i], hy = sys.hy[i], hz = sys.hz[i];
      // A fixed WORLD-space length looks fine at the box edge but balloons
      // into a huge streak across the screen for a mote that happens to
      // wrap in very close to the camera (perspective makes near objects
      // read much bigger) - scale it down for close motes so every one
      // stays a comparably subtle screen-space size.
      const distToCam = Math.hypot(hx - camPos.x, hy - camPos.y, hz - camPos.z);
      const distScale = Math.min(1, distToCam / (half * 0.6));
      const effLen = len * distScale;
      const tx = hx - dirScaleX * effLen;
      const ty = hy - dirScaleY * effLen;
      const tz = hz - dirScaleZ * effLen;

      const i2 = i * 2 * 3;
      sys.positions[i2] = hx; sys.positions[i2 + 1] = hy; sys.positions[i2 + 2] = hz;
      sys.positions[i2 + 3] = tx; sys.positions[i2 + 4] = ty; sys.positions[i2 + 5] = tz;
      sys.alphas[i * 2] = opacity;
      sys.alphas[i * 2 + 1] = 0.0; // tail fades to nothing
    }
    sys.geo.attributes.position.needsUpdate = true;
    sys.geo.attributes.aAlpha.needsUpdate = true;
    sys.lines.material.uniforms.uOpacity.value = 1.0; // alpha already folded into aAlpha
  }

  function update({ dt = 0, camera, velocity, warp = 1 } = {}) {
    if (!camera) return;
    const camPos = camera.position;

    if (!seeded) {
      seedBox(dust, DUST_HALF, camPos.x, camPos.y, camPos.z);
      seedBox(streaks, STREAK_HALF, camPos.x, camPos.y, camPos.z);
      seeded = true;
    }

    const vx = velocity ? velocity.x : 0;
    const vy = velocity ? velocity.y : 0;
    const vz = velocity ? velocity.z : 0;
    const speed = Math.hypot(vx, vy, vz);
    const warpBoost = Math.max(0, warp - 1);

    // Fades to nothing at rest; ramps up with speed and hard with warp.
    const overall = Math.min(1, speed * 0.22 + warpBoost * 0.05);

    // Kept short AND subtle even at ordinary flight speed - these are
    // close-by motes giving parallax, not the warp effect. The cap here
    // looked "short" as a world-space number, but the whole mote field
    // lives within DUST_HALF (16u) of the camera, so even 2.2u was really
    // a ~10-25 degree streak once you account for how close that is -
    // fixed by making the cap small relative to that typical distance,
    // not just relative to warp.
    const dustLen = Math.min(0.5, 0.05 + speed * 0.02 + warpBoost * 0.05);
    const dustOpacity = overall * 0.5;
    stepSystem(dust, DUST_HALF, dt, camPos, vx, vy, vz, speed, dustLen, dustOpacity);

    // This is the one warp is supposed to sell: long streaks that should be
    // ~invisible at warp 1 (ordinary flight, however fast) and only appear
    // once warp actually kicks in. Gated on warpBoost alone, NOT on
    // `overall`/speed - a fast ordinary orbit must not light this up.
    const streakLen = Math.min(260, 0.5 + speed * 0.35 + warpBoost * 14);
    const streakGate = Math.min(1, warpBoost / 3);
    const streakOpacity = streakGate * Math.min(1, 0.5 + warpBoost * 0.1);
    // A cool white-to-cyan shift at high warp - a small, cheap "hyperspace" cue.
    const warpTint = Math.min(1, warpBoost / 20);
    streaks.lines.material.uniforms.uColor.value.setRGB(
      0.92 - warpTint * 0.2, 0.95, 1.0,
    );
    stepSystem(streaks, STREAK_HALF, dt, camPos, vx, vy, vz, speed, streakLen, streakOpacity);
  }

  function dispose() {
    scene.remove(group);
    dust.geo.dispose(); dust.lines.material.dispose();
    streaks.geo.dispose(); streaks.lines.material.dispose();
  }

  return { update, dispose, group };
}
