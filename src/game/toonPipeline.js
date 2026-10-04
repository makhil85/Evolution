// Cel-shading pipeline (visual Style B).
//
// Everything here was verified against the real Kenney/Quaternius GLBs in
// src/toonTest.js before being written. The measurements that shaped it:
//
//   - Kenney nature GLBs carry NO texture and NO vertex colours; they are
//     coloured by flat material.color. Quaternius space GLBs carry a shared
//     Atlas.png. Both paths have to survive the swap.
//   - Inverted-hull outlines fill in and read as a black blob on dense
//     geometry (the geodesic dome's lattice), so hulls are capped by triangle
//     count.
//   - A naive per-mesh material swap produced one material per clone, which
//     is what pushed a 7x7 test board to 187 draw calls. Materials are cached
//     by source so clones share them.
import * as THREE from 'three';

/** Shared three-band ramp. One texture for the whole game. */
export const toonRamp = (() => {
  const data = new Uint8Array([150, 200, 235, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export const OUTLINE_COLOR = 0x1b2330;

/** One outline material for every hull in the scene. */
export const outlineMaterial = new THREE.MeshBasicMaterial({
  color: OUTLINE_COLOR,
  side: THREE.BackSide,
});

// Source material -> toon material. Keyed by the loader's material instance, so
// every clone of a given asset reuses one material and one shader program.
const toonCache = new WeakMap();

/** Triangles above which an inverted hull stops reading as an outline. */
export const OUTLINE_TRI_LIMIT = 600;

function triangleCount(geometry) {
  const attr = geometry.index || geometry.attributes.position;
  return attr ? attr.count / 3 : 0;
}

/**
 * Build (or fetch) the toon equivalent of a source material.
 * `tint` recolours packs whose own palette is wrong for this game - the
 * Quaternius space kit is dark industrial charcoal and needs overriding.
 */
export function toToon(source, { tint = null, useVertexColors = false } = {}) {
  const cacheable = !tint && !useVertexColors;
  if (cacheable && toonCache.has(source)) return toonCache.get(source);

  if (source.map) source.map.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshToonMaterial({
    color: tint !== null ? new THREE.Color(tint) : (source.color ? source.color.clone() : new THREE.Color(0xffffff)),
    map: tint !== null ? null : (source.map || null),
    gradientMap: toonRamp,
    vertexColors: useVertexColors,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
  });
  mat.name = `toon:${source.name || 'unnamed'}`;

  if (cacheable) toonCache.set(source, mat);
  return mat;
}

/**
 * Convert a loaded model in place: toon materials, shadows, and optional
 * outline hulls. Returns the root for chaining.
 *
 * @param {THREE.Object3D} root
 * @param {object}  [opts]
 * @param {boolean} [opts.outline=true]     add inverted-hull outlines
 * @param {number}  [opts.outlineScale=1.045]
 * @param {number|null} [opts.tint=null]    override every material's colour
 * @param {boolean} [opts.castShadow=true]
 * @param {boolean} [opts.receiveShadow=true]
 */
export function toonify(root, {
  outline = true,
  outlineScale = 1.045,
  tint = null,
  castShadow = true,
  receiveShadow = true,
} = {}) {
  const hulls = [];

  root.traverse((o) => {
    if (!o.isMesh) return;

    const useVertexColors = !!o.geometry.attributes.color;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const next = src.map((m) => toToon(m, { tint, useVertexColors }));
    o.material = Array.isArray(o.material) ? next : next[0];

    o.castShadow = castShadow;
    o.receiveShadow = receiveShadow;

    if (outline && triangleCount(o.geometry) <= OUTLINE_TRI_LIMIT) {
      const hull = new THREE.Mesh(o.geometry, outlineMaterial);
      hull.position.copy(o.position);
      hull.rotation.copy(o.rotation);
      hull.scale.copy(o.scale).multiplyScalar(outlineScale);
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.userData.isOutline = true;
      hulls.push({ parent: o.parent, hull });
    }
  });

  // Added after the walk so the traversal never visits its own hulls.
  for (const { parent, hull } of hulls) parent.add(hull);

  return root;
}

/**
 * Flatten a loaded model into world-baked {geometry, material} parts, ready for
 * InstancedMesh. Each part's local transform is baked into its geometry so one
 * instance matrix can place the whole original model.
 */
export function bakeParts(root, { tint = null } = {}) {
  const parts = [];
  root.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

  root.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone();
    // Transform into the root's local space, so instancing the root works.
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));

    const useVertexColors = !!geometry.attributes.color;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.push({
      geometry,
      material: toToon(src, { tint, useVertexColors }),
      triangles: triangleCount(geometry),
    });
  });

  return parts;
}

/** The renderer settings this look assumes. */
export function configureRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in three 0.185 and silently downgrades.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Integrated GPUs (the stated target) are fill-rate bound long before they
  // are triangle bound: at devicePixelRatio 1.5 an 855x937 canvas rasterises
  // 1.8M pixels per frame. 1.25 is the point where the cel-shaded look still
  // holds up but the fill cost drops ~30%.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  return renderer;
}

/** The two-light rig Style B is tuned for. Returns the shadow-casting sun. */
export function buildLightRig(scene, {
  skyColor = 0xdceeff,
  groundColor = 0x6b8a55,
  hemiIntensity = 0.5,
  sunColor = 0xffffff,
  sunIntensity = 1.15,
  sunPosition = [10, 15, 8],
  shadowExtent = 16,
  shadowMapSize = 2048,
} = {}) {
  scene.add(new THREE.HemisphereLight(skyColor, groundColor, hemiIntensity));

  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  sun.position.set(...sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;

  const c = sun.shadow.camera;
  c.left = -shadowExtent; c.right = shadowExtent;
  c.top = shadowExtent; c.bottom = -shadowExtent;
  c.near = 1; c.far = shadowExtent * 4;
  c.updateProjectionMatrix();

  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/**
 * The village is static, so its shadow map only has to be drawn once. Leaving
 * autoUpdate on re-rasterises every instance in the scene every single frame -
 * measured at 2 fps on an Intel Iris Xe with 8.7k instances, which is the
 * integrated-GPU class this game targets.
 *
 * Call `refreshStaticShadows(sun)` again after anything that casts a shadow
 * moves or is revealed (a quest structure building itself in, a rocket stage).
 */
export function freezeShadows(sun) {
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
}

export function refreshStaticShadows(sun) {
  sun.shadow.needsUpdate = true;
}


// ---------------------------------------------------------------------------
// Ground detail
// ---------------------------------------------------------------------------

/**
 * Give the instanced ground a surface without giving up its single draw call.
 *
 * The board is ~8,000 copies of ONE 1x1 plane, tinted per instance. A normal
 * `map` would therefore repeat the whole texture inside every tile and draw a
 * visible grid. Instead the detail is generated in the shader from WORLD
 * position, so it flows continuously across tile borders and no texture is
 * fetched at all.
 *
 * Two layers: a fine grass/mud grain, and a broad blotch that varies the tone
 * across the field so the ground is not one flat colour.
 */
export function addGroundDetail(material, { grain = 3.4, blotch = 0.085 } = {}) {
  if (material.userData?.groundDetail) return material;
  material.userData = { ...material.userData, groundDetail: true };

  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.uGrain = { value: grain };
    shader.uniforms.uBlotch = { value: blotch };

    shader.vertexShader = 'varying vec3 vGroundWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 gwPos = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         gwPos = instanceMatrix * gwPos;
       #endif
       vGroundWorld = (modelMatrix * gwPos).xyz;
       #include <project_vertex>`
    );

    shader.fragmentShader = `
      varying vec3 vGroundWorld;
      uniform float uGrain;
      uniform float uBlotch;
      // Cheap value noise. Every surface below needs SOMETHING irregular -
      // that is the whole point of this change - and a texture fetch for it
      // would cost a map the toon pipeline otherwise never loads.
      float ghash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(ghash(i), ghash(i + vec2(1.0, 0.0)), f.x),
                   mix(ghash(i + vec2(0.0, 1.0)), ghash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `{
         vec2 w = vGroundWorld.xz;

         // WHICH SURFACE IS THIS? Read it off the vertex colour the board
         // painted, so grass, dirt and paving can be told apart without a
         // second material or a second draw call.
         #ifdef USE_COLOR
           vec3 sc = vColor.rgb;   // vColor is a vec4 in three 0.185
         #else
           vec3 sc = gl_FragColor.rgb;
         #endif
         float sat = max(sc.r, max(sc.g, sc.b)) - min(sc.r, min(sc.g, sc.b));
         float greenness = sc.g - max(sc.r, sc.b);
         float stone = 1.0 - smoothstep(0.03, 0.11, sat);
         float grass = smoothstep(0.0, 0.05, greenness) * (1.0 - stone);
         float dirt  = clamp(1.0 - grass - stone, 0.0, 1.0);

         // --- grass: blades with a direction, not a woven crosshatch -------
         // The old detail was sin(x)*sin(y) at one frequency on EVERY surface,
         // which is a regular diagonal weave - it made grass, path and plaza
         // all look like the same piece of matting. Blades run high frequency
         // across the world and low along it, so they read as growth.
         float bladeAngle = 0.6 + gnoise(w * 0.08) * 0.9;
         vec2 bd = vec2(cos(bladeAngle), sin(bladeAngle));
         float blades = sin(dot(w, bd) * uGrain * 9.0 + gnoise(w * 2.2) * 5.0);
         float grassDetail = blades * 0.055 + (gnoise(w * 1.4) - 0.5) * 0.13;

         // --- dirt: grit and worn patches, nothing periodic at all ---------
         float grit = gnoise(w * 6.5) * 0.5 + gnoise(w * 17.0) * 0.5;
         float dirtDetail = (grit - 0.5) * 0.13 + (gnoise(w * 0.55 + 11.0) - 0.5) * 0.10;

         // --- paving: straight joints on a grid, slabs that vary in tone ---
         vec2 slab = w * 0.62;
         vec2 f = abs(fract(slab) - 0.5);
         float joint = 1.0 - smoothstep(0.40, 0.49, max(f.x, f.y));
         float stoneDetail = (gnoise(floor(slab) * 3.7) - 0.5) * 0.14 - (1.0 - joint) * 0.16;

         // Broad blotches everywhere: damp ground, uneven growth, wear.
         float b = sin(w.x * 0.21 + 1.3) * sin(w.y * 0.17 - 0.7)
                 + sin((w.x + w.y) * 0.09) * 0.6;

         float detail = grassDetail * grass + dirtDetail * dirt + stoneDetail * stone;
         gl_FragColor.rgb *= 1.0 + detail + b * uBlotch;

         // Grass creeping into the joints, so paving and field interleave
         // rather than meeting on a drawn line.
         float creep = stone * (1.0 - joint) * smoothstep(0.35, 0.75, gnoise(w * 0.9));
         gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.86, 1.02, 0.84), creep * 0.55);

         // Mud reads browner where it is darkest, grass greener where lightest.
         float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
         gl_FragColor.rgb += vec3(0.020, 0.012, -0.010) * (1.0 - luma) * 0.9;
       }
#include <dithering_fragment>`
    );
  };
  material.customProgramCacheKey = () => 'ground-detail-v2';
  material.needsUpdate = true;
  return material;
}
