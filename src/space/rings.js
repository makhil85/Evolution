// Chapter 4 - Saturn's rings.
//
// The 2k_saturn_ring_alpha strip is a radial profile: x = 0 at the inside of
// the D ring, x = 1 at the F ring. Matching its Cassini division and A-ring
// edge against Saturn's real ring radii puts x = 0 at 1.18 and x = 1 at 2.33
// planet radii, so those are the bounds here. The shader reads the radius
// straight from the vertex position, so there are no UVs to get wrong.
//
// Lighting is the classical single-scattering model for a particle layer of
// optical depth tau (from the map's alpha):
//   lit face    ~ mu0/(mu0+mu) * (1 - exp(-tau(1/mu0 + 1/mu)))
//   unlit face  ~ mu0/(mu-mu0) * (exp(-tau/mu) - exp(-tau/mu0))
// so from the dark side the dense B ring goes dark while the thin C ring and
// the Cassini division glow with light passing through - as Cassini saw it.
// Saturn's shadow is cut out analytically; the rings' shadow on the planet is
// done in the planet's surface shader (bodyShaders RINGSHADOW).
import * as THREE from 'three';
import { sunRadiance, ambientRadiance } from './bodyShaders.js';

export const RING_INNER = 1.18;
export const RING_OUTER = 2.33;

/**
 * peak: optional cap on the ring's linear colour (the ring run passes 1.1, under
 * the 1.25 bloom threshold). Off by default, so the planet views keep their look.
 */
export function createRings({ map, planetRadius, segments = 256, peak = 1e9 }) {
  const geo = new THREE.RingGeometry(RING_INNER, RING_OUTER, segments, 6);
  const mat = new THREE.ShaderMaterial({
    name: 'saturn-rings',
    uniforms: {
      ringMap: { value: map },
      uInner: { value: RING_INNER },
      uOuter: { value: RING_OUTER },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: sunRadiance() },
      uAmbient: { value: ambientRadiance(1) },
      uNormal: { value: new THREE.Vector3(0, 1, 0) },
      uCenter: { value: new THREE.Vector3() },
      uPlanetR: { value: planetRadius },
      uFlat: { value: 1 },
      uTint: { value: new THREE.Color(1.0, 0.9, 0.76) },
      uGain: { value: 3.6 },
      uPeak: { value: peak },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorldPos;
      varying float vR;
      void main() {
        vR = length(position.xy);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D ringMap;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uAmbient;
      uniform vec3 uNormal;
      uniform vec3 uCenter;
      uniform float uPlanetR;
      uniform vec3 uTint;
      uniform float uGain;
      uniform float uPeak;
      varying vec3 vWorldPos;
      varying float vR;
      void main() {
        #include <logdepthbuf_fragment>
        float u = (vR - uInner) / (uOuter - uInner);
        vec4 t = texture2D(ringMap, vec2(u, 0.5));
        float alpha = t.a;
        if (alpha < 0.004) discard;
        // The strip's colour is unreliable where it is nearly transparent (it
        // goes blue at the F ring), so take brightness from it and hue from
        // uTint, with only a hint of its own hue where the rings are dense.
        float lum = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 hue = mix(vec3(lum), t.rgb, 0.35 * smoothstep(0.3, 0.8, alpha));
        vec3 albedo = mix(vec3(lum), hue, 0.5) * uTint * uGain;

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = uSunDir;
        float sL = dot(uNormal, L);
        float sV = dot(uNormal, V);
        float mu0 = max(abs(sL), 0.015);
        float mu = max(abs(sV), 0.015);
        float tau = -log(1.0 - min(alpha, 0.985)) * 0.9;

        float refl;
        if (sL * sV >= 0.0) {
          refl = mu0 / (mu0 + mu) * (1.0 - exp(-tau * (1.0 / mu0 + 1.0 / mu)));
        } else {
          float m = abs(mu - mu0) < 0.01 ? mu0 + 0.01 : mu;
          refl = mu0 / (m - mu0) * (exp(-tau / m) - exp(-tau / mu0));
          refl = max(refl, 0.0) * 1.6;
        }
        // Stronger when looking back toward the Sun through the rings (forward scattering).
        float fwd = pow(max(dot(-V, L), 0.0), 6.0);
        refl *= 1.0 + fwd * 1.5;

        // Saturn's shadow across the rings.
        vec3 toC = uCenter - vWorldPos;
        float tt = dot(toC, L);
        float shadow = 1.0;
        if (tt > 0.0) {
          float dp = length(toC - L * tt);
          shadow = smoothstep(uPlanetR * 0.985, uPlanetR * 1.02, dp);
        }

        vec3 col = albedo * (uSunColor * refl * shadow * 0.9 + uAmbient * 0.6 * alpha);
        // Looking back at the Sun through the rings, the forward-scatter boost
        // pushed this past the bloom threshold (1.25 linear): the halo popped on
        // and off as the camera swung. Scale the whole colour down to uPeak (keeps
        // the hue; continuous, so no pop).
        float peakC = max(max(col.r, col.g), col.b);
        col *= min(1.0, uPeak / max(peakC, 1e-4));
        float cover = 1.0 - exp(-tau / mu);
        // premultiplied: col already is the light leaving this patch of ring
        gl_FragColor = vec4(col, clamp(cover, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // ring plane = the planet's equator (local XZ)
  mesh.scale.setScalar(planetRadius);
  mesh.renderOrder = 1;
  mesh.name = 'saturn-rings';

  function dispose() {
    geo.dispose();
    mat.dispose();
  }
  return { mesh, material: mat, dispose };
}
