// The river surface.
//
// A separate mesh from the tile board, because water is the one surface that
// has to move. It is a ribbon built along the river's meandering centreline,
// with two crossing wave trains displacing it vertically and a scrolling
// foam/sparkle pattern on top.
//
// Cel-shaded rules still apply: the shading is BANDED, not smooth, so it sits
// with the rest of the art instead of looking like a photoreal puddle dropped
// into a toy village.
import * as THREE from 'three';

const vertex = /* glsl */`
  uniform float uTime;
  varying vec2  vUv;
  varying float vWave;
  varying vec3  vWorld;

  void main() {
    vUv = uv;
    vec3 p = position;

    // Two wave trains at different angles and speeds. Crossing them stops the
    // surface reading as a single repeating swell.
    float w1 = sin(p.x * 0.55 + uTime * 1.5);
    float w2 = sin(p.z * 0.85 - uTime * 1.1 + p.x * 0.2);
    float w3 = sin((p.x + p.z) * 1.6 + uTime * 2.3) * 0.35;
    float wave = w1 * 0.075 + w2 * 0.058 + w3 * 0.03;

    p.y += wave;
    vWave = wave;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */`
  uniform float uTime;
  uniform vec3  uDeep;
  uniform vec3  uShallow;
  uniform vec3  uFoam;
  varying vec2  vUv;
  varying float vWave;
  varying vec3  vWorld;

  // Cheap value noise - enough for foam breakup, no texture fetch.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    // vUv.y runs across the channel: 0 and 1 are the banks, 0.5 the middle.
    float acrossChannel = abs(vUv.y - 0.5) * 2.0;
    float depth = 1.0 - acrossChannel;

    // Base: shallow at the banks, deep mid-channel, with the boundary wobbling
    // along the river's length so the two never meet in a straight line.
    float wobble = sin(vWorld.x * 0.55 + uTime * 0.4) * 0.07
                 + sin(vWorld.z * 0.8 - uTime * 0.3) * 0.05;
    vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 0.85, depth + wobble));

    // Light coming up off the bed in the shallows: what makes real water read
    // as water rather than as blue paint.
    float bed = noise(vWorld.xz * 1.7 + vec2(uTime * 0.25, -uTime * 0.18));
    col += (1.0 - depth) * bed * vec3(0.10, 0.13, 0.10) * 0.9;

    // Flow streaks travelling downstream. vUv.x runs along the river's length,
    // so these stretch with the meander instead of cutting across it.
    float flow = sin(vUv.x * 26.0 - uTime * 2.2 + sin(vUv.y * 5.0) * 1.4);
    float streak = smoothstep(0.55, 1.0, flow) * (1.0 - acrossChannel * 0.7);
    col += streak * vec3(0.05, 0.07, 0.08);

    // Specular glint: a moving highlight band, broken up so it sparkles rather
    // than sweeping across as one bar.
    float glintBand = sin(vWorld.x * 0.9 + vWorld.z * 1.3 + uTime * 1.6);
    float glint = smoothstep(0.86, 1.0, glintBand) *
                  step(0.45, noise(vWorld.xz * 2.4 + uTime * 0.5));
    col += glint * vec3(0.55, 0.60, 0.62) * (0.35 + depth * 0.5);

    // Crests catch the light. Quantised, so they read as painted highlights.
    float crest = step(0.026, vWave);
    col = mix(col, col + vec3(0.12, 0.15, 0.16), crest * 0.5);

    // Shoreline foam: a rolling band that breathes in and out like a wash,
    // instead of a fixed rim around the edge.
    float wash = 0.74 + sin(vWorld.x * 0.7 - uTime * 1.1) * 0.05;
    float drift = noise(vWorld.xz * 1.1 + vec2(uTime * 0.35, uTime * 0.2));
    float foamEdge = smoothstep(wash, wash + 0.26, acrossChannel + drift * 0.20);
    col = mix(col, uFoam, foamEdge * 0.9);

    gl_FragColor = vec4(col, 0.95);
  }
`;

/**
 * Build the river ribbon.
 * @param {object} river  the RIVER descriptor from village.js (centreAt/widthAt)
 * @param {{minX:number,maxX:number}} bounds
 */
export function createRiverSurface(river, bounds, { segments = 220, across = 6, heightAt = null } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const cols = segments + 1;
  const rows = across + 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = bounds.minX + t * (bounds.maxX - bounds.minX);
    const centre = river.centreAt(x);
    // Slightly wider than the blocked tiles, so the water tucks under the banks
    // instead of leaving a seam where the two meet.
    // Overhang the blocked tiles, so the smooth ribbon covers their stepped
    // edges rather than leaving a jagged seam where water meets bank.
    const half = river.widthAt(x) + 1.15;

    for (let j = 0; j <= across; j++) {
      const v = j / across;
      const z = centre - half + v * half * 2;
      // Follow the riverbed. The ground has relief and the river runs in a cut,
      // so a flat ribbon floated above the bed in places and vanished under it
      // in others. Surface height comes from the CENTRELINE, so the water stays
      // level across its own width the way real water does.
      const bed = heightAt ? heightAt(x, centre) : 0;
      positions.push(x, bed + 0.9, z);
      uvs.push(t * 14, v);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * rows + j;
      const b = a + rows;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      // Lead 2026-10-09 (Chapter 3): a cleaner, bluer river that reads as
      // engineered water, not a brown-edged stream.
      uDeep: { value: new THREE.Color(0x1b6fae) },
      uShallow: { value: new THREE.Color(0x6fdcef) },
      uFoam: { value: new THREE.Color(0xdff1ff) },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,   // the ground beneath shows through the shallows
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'riverSurface';
  mesh.position.y = 0;         // height is baked per-vertex from the riverbed
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;  // one long ribbon; culling it as a unit hides it all

  return {
    mesh,
    update(t) { material.uniforms.uTime.value = t; },
    dispose() { geo.dispose(); material.dispose(); },
  };
}
