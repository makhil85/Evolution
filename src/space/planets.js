// Chapter 4 - every celestial body: the Sun, planets, moons, rings, and the
// little glows that show where far planets are.
//
//   const bodies = createBodies({ scene, renderer, camera });  // returns at once
//   await bodies.ready;                                        // all textures in
//   bodies.update({ dt, time, positions, origin, camera });    // every frame
//   bodies.views[id]   -> { group, radius, setHighlighted(bool) }
//   bodies.sunLight    -> THREE.PointLight at the Sun (decay 0), ambient in bodies.ambientLight
//   bodies.dispose()
//
// positions[id] = { x, z } heliocentric; origin = { x, z } floating origin.
// Scene position = heliocentric - origin, y = 0. The Sun is at heliocentric 0.
//
// Call update() after the camera has moved for the frame (the lens flare,
// distance glows and atmosphere side-switch read the camera).
//
// Each view.group holds:  tilt (axial tilt, z-rotation) -> spin (rotation.y)
// -> surface [+ clouds]; the atmosphere and rings sit in `tilt` (they do not
// spin). The group itself is never hidden, so others can hang things on it;
// bodies smaller than a third of a pixel hide their own meshes to save draws.
import * as THREE from 'three';
import { BODIES, BODY_ORDER, TEXTURE_BASE, SPACE_LIGHT } from './contracts.js';
import { surfaceMaterial, cloudMaterial, atmosphereMaterial, beaconMaterial } from './bodyShaders.js';
import { createSun } from './sun.js';
import { createRings, RING_INNER, RING_OUTER } from './rings.js';
import { bakeMoonMaps } from './moons.js';

/** Great Red Spot centre in 2k_jupiter.jpg UV (v up). */
const GRS_UV = [0.364, 0.397];

/**
 * Per-body look. Everything visual that is not in contracts.js lives here.
 *   seg: sphere segments (detail by importance)
 *   surface: surfaceMaterial options
 *   atmo: atmosphereMaterial options + thickness (fraction of radius)
 *   beacon: distance-glow colour and pixel size
 *   flat: polar flattening (oblate gas giants)
 *   occ: bodies whose shadows can fall on this one (eclipses, moon transits)
 */
const LOOK = {
  earth: {
    seg: 160,
    surface: { kind: 'earth', gain: 1.25, wrap: 0.04, twilight: 0xff9050, twilightAmt: 0.3, saturation: 1.1, contrast: 1.04, ambient: 0.35 },
    atmo: { thickness: 0.03, scatter: 0x5aa8ff, twilight: 0xffb070, density: 0.27, height: 0.14, mie: 0.6, ext: 0.3, veil: 0.6 },
    clouds: true,
    beacon: [0x8ec2ff, 8],
    occ: ['moon'],
  },
  moon: {
    seg: 128,
    surface: { kind: 'rock', gain: 1.35, lunar: 0.55, contrast: 1.05 },
    beacon: [0xe2ddd4, 6],
    occ: ['earth'],
  },
  mars: {
    seg: 128,
    surface: { kind: 'rock', gain: 1.2, wrap: 0.03, lunar: 0.3, saturation: 1.12, contrast: 1.06, twilight: 0xb06040, twilightAmt: 0.3 },
    atmo: { thickness: 0.022, scatter: 0xe39a72, twilight: 0x7fa0d0, density: 0.09, height: 0.35, mie: 0.9 },
    beacon: [0xff9a66, 7],
  },
  ceres: {
    seg: 96,
    surface: { kind: 'rock', gain: 1.25, lunar: 0.6 },
    beacon: [0xcfc7ba, 5],
  },
  jupiter: {
    seg: 160,
    flat: 0.935,
    surface: { kind: 'gas', ambient: 1.5, gain: 1.08, wrap: 0.12, limb: 0.32, saturation: 1.35, contrast: 1.18, flow: { spot: GRS_UV } },
    atmo: { thickness: 0.018, scatter: 0xcfd8ee, twilight: 0xd9a070, density: 0.03, height: 0.2, mie: 0.5, aurora: 0x2a2266 },
    beacon: [0xffdfb0, 10],
    occ: ['io', 'europa', 'ganymede', 'callisto'],
  },
  io: { seg: 112, surface: { kind: 'rock', gain: 0.95, lunar: 0.45, bump: 0.03 }, beacon: [0xfff0a0, 7], occ: ['jupiter', 'europa'] },
  europa: { seg: 160, surface: { kind: 'ice', gain: 0.92, lunar: 0.35, bump: 0.012 }, beacon: [0xf6f1e8, 7.5], occ: ['jupiter', 'io', 'ganymede'] },
  ganymede: { seg: 112, surface: { kind: 'rock', gain: 1.0, lunar: 0.45, bump: 0.04 }, beacon: [0xd9cdbd, 7], occ: ['jupiter', 'europa'] },
  callisto: { seg: 112, surface: { kind: 'rock', gain: 1.05, lunar: 0.55, bump: 0.05 }, beacon: [0xae9f8e, 7], occ: ['jupiter', 'ganymede'] },
  saturn: {
    seg: 128,
    flat: 0.902,
    surface: { kind: 'gas', ambient: 1.5, gain: 0.95, wrap: 0.1, limb: 0.3, saturation: 1.2, contrast: 1.15 },
    atmo: { thickness: 0.02, scatter: 0xe6dcc0, twilight: 0xd09a60, density: 0.03, height: 0.2, mie: 0.5 },
    rings: true,
    beacon: [0xffe7b5, 9],
  },
  uranus: {
    seg: 96,
    surface: { kind: 'gas', ambient: 1.5, gain: 1.1, wrap: 0.12, limb: 0.22, saturation: 1.05 },
    atmo: { thickness: 0.035, scatter: 0xa9eef2, twilight: 0x9fd0d8, density: 0.12, height: 0.4, mie: 0.4 },
    beacon: [0xaef2f5, 7],
  },
  neptune: {
    seg: 96,
    surface: { kind: 'gas', ambient: 1.5, gain: 1.15, wrap: 0.12, limb: 0.22, saturation: 1.1 },
    atmo: { thickness: 0.035, scatter: 0x6f8cff, twilight: 0x7fa0ff, density: 0.14, height: 0.4, mie: 0.4 },
    beacon: [0x86a2ff, 7],
  },
};

const PROCEDURAL = new Set(['io', 'europa', 'ganymede', 'callisto']);

/** Glows fade in below this on-screen radius (px) and are gone above the next. */
const BEACON_FADE = [1.4, 3.6];
/** Meshes are skipped when the whole body is smaller than this (px radius). */
const HIDE_BELOW_PX = 0.3;

export function createBodies({ scene, renderer, camera }) {
  const root = new THREE.Group();
  root.name = 'bodies';
  scene.add(root);

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const pending = [];
  const textures = [];
  function tex(name, { srgb = true } = {}) {
    let done;
    let fail;
    pending.push(new Promise((ok, no) => { done = ok; fail = no; }));
    const t = loader.load(TEXTURE_BASE + name, () => done(), undefined, (e) => fail(new Error(`texture ${name}: ${e?.message || e}`)));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso;
    t.wrapS = THREE.RepeatWrapping;
    textures.push(t);
    return t;
  }

  // Shared unit spheres by segment count.
  const geoCache = new Map();
  function sphere(seg) {
    if (!geoCache.has(seg)) geoCache.set(seg, new THREE.SphereGeometry(1, seg, Math.round(seg / 2)));
    return geoCache.get(seg);
  }

  // --- lights -------------------------------------------------------------------
  const ambientLight = new THREE.AmbientLight(SPACE_LIGHT.ambient, SPACE_LIGHT.ambientIntensity);
  ambientLight.name = 'space-ambient';
  root.add(ambientLight);

  // --- the Sun ---------------------------------------------------------------------
  const sunBody = BODIES.sun;
  const sun = createSun({ map: tex(sunBody.tex.map), radius: sunBody.radius, geometry: sphere(128) });
  root.add(sun.group);
  root.add(sun.flare);

  // --- procedural moon maps -------------------------------------------------------
  const moonMaps = bakeMoonMaps(renderer);

  // --- planets and moons -------------------------------------------------------------
  const views = {};
  const internals = {};
  const ringTexture = highlightTexture();
  const ringTex = tex(BODIES.saturn.tex.ring);
  ringTex.wrapS = THREE.ClampToEdgeWrapping;

  for (const id of BODY_ORDER) {
    const b = BODIES[id];
    const group = new THREE.Group();
    group.name = id;
    root.add(group);

    if (id === 'sun') {
      group.add(sun.group);
      views.sun = makeView(group, b.radius, null);
      internals.sun = { group, b };
      continue;
    }

    const look = LOOK[id];
    const tilt = new THREE.Group();
    tilt.rotation.z = b.tilt || 0;
    group.add(tilt);
    const spin = new THREE.Group();
    tilt.add(spin);
    const flat = look.flat ?? 1;

    const map = PROCEDURAL.has(id) ? moonMaps[id].texture : tex(b.tex.map);
    const opts = { ...look.surface, map };
    if (id === 'earth') {
      opts.earth = { night: tex(b.tex.night), clouds: tex(b.tex.clouds, { srgb: false }), cityGain: 3.4 };
    }
    if (look.rings) opts.ring = { map: ringTex, inner: RING_INNER, outer: RING_OUTER };
    const surfMat = surfaceMaterial(opts);
    const surface = new THREE.Mesh(sphere(look.seg), surfMat);
    surface.scale.set(b.radius, b.radius * flat, b.radius);
    surface.name = `${id}-surface`;
    spin.add(surface);

    let cloudMat = null;
    let clouds = null;
    if (look.clouds) {
      cloudMat = cloudMaterial(opts.earth.clouds);
      clouds = new THREE.Mesh(sphere(look.seg), cloudMat);
      clouds.scale.setScalar(b.radius * 1.006);
      clouds.name = `${id}-clouds`;
      spin.add(clouds);
    }

    let atmoMat = null;
    let atmo = null;
    if (look.atmo) {
      atmoMat = atmosphereMaterial({ ...look.atmo, flat });
      const ra = b.radius * (1 + look.atmo.thickness);
      atmoMat.uniforms.uRp.value = b.radius;
      atmoMat.uniforms.uRa.value = ra;
      atmo = new THREE.Mesh(sphere(96), atmoMat);
      atmo.scale.set(ra * 1.012, ra * 1.012 * flat, ra * 1.012);
      atmo.name = `${id}-atmosphere`;
      tilt.add(atmo);
    }

    let rings = null;
    if (look.rings) {
      rings = createRings({ map: ringTex, planetRadius: b.radius });
      tilt.add(rings.mesh);
    }

    const occ = (look.occ || []).map((o) => o);
    views[id] = makeView(group, b.radius, atmoMat);
    internals[id] = {
      b, look, group, tilt, spin, surface, surfMat, clouds, cloudMat, atmo, atmoMat, rings, occ,
      sunDir: new THREE.Vector3(1, 0, 0), pixelRadius: 0, sunAng: 0.01,
    };
  }

  // --- distance beacons (one Points draw) -------------------------------------------
  const beaconIds = BODY_ORDER.filter((id) => id !== 'sun');
  const nB = beaconIds.length;
  const bPos = new Float32Array(nB * 3);
  const bCol = new Float32Array(nB * 3);
  const bSA = new Float32Array(nB * 2);
  const baseSize = new Float32Array(nB);
  const c = new THREE.Color();
  beaconIds.forEach((id, i) => {
    const [hex, size] = LOOK[id].beacon;
    c.set(hex);
    bCol.set([c.r, c.g, c.b], i * 3);
    baseSize[i] = size * 2.6; // table values are the bright core's size; the halo is wider
  });
  const beaconGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(bPos, 3).setUsage(THREE.DynamicDrawUsage);
  const saAttr = new THREE.BufferAttribute(bSA, 2).setUsage(THREE.DynamicDrawUsage);
  beaconGeo.setAttribute('position', posAttr);
  beaconGeo.setAttribute('aColor', new THREE.BufferAttribute(bCol, 3));
  beaconGeo.setAttribute('aSizeAlpha', saAttr);
  const beaconMat = beaconMaterial();
  const beacons = new THREE.Points(beaconGeo, beaconMat);
  beacons.frustumCulled = false;
  beacons.renderOrder = 5;
  beacons.name = 'body-beacons';
  root.add(beacons);

  // --- highlight rings (sprites, invisible until asked for) ----------------------------
  function makeView(group, radius, atmoMat) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTexture, color: 0x6ff0ff, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    sprite.visible = false;
    sprite.renderOrder = 6;
    group.add(sprite);
    const view = {
      group,
      radius,
      highlighted: false,
      sprite,
      setHighlighted(on) {
        view.highlighted = !!on;
        sprite.visible = view.highlighted;
        if (atmoMat) atmoMat.uniforms.uHighlight.value = view.highlighted ? 1 : 0;
      },
    };
    return view;
  }

  // --- ready ---------------------------------------------------------------------------
  const ready = Promise.all(pending).then(() => {
    // Upload everything now so the first real frame does not hitch.
    if (renderer.initTexture) for (const t of textures) renderer.initTexture(t);
    return true;
  });

  // --- per-frame -------------------------------------------------------------------------
  const camPos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const drawSize = new THREE.Vector2();
  const axis = new THREE.Vector3();
  const flareOccluders = beaconIds.map((id) => ({ pos: internals[id].group.position, radius: BODIES[id].radius }));
  const TAU = Math.PI * 2;

  function update({ time = 0, positions = {}, origin = { x: 0, z: 0 }, camera: cam = camera } = {}) {
    const ox = origin.x || 0;
    const oz = origin.z || 0;

    // Positions first - moons and shadows need everyone's.
    for (const id of BODY_ORDER) {
      const it = internals[id];
      const p = positions[id];
      const hx = id === 'sun' ? (p?.x ?? 0) : p?.x;
      const hz = id === 'sun' ? (p?.z ?? 0) : p?.z;
      if (hx === undefined || hz === undefined) continue;
      it.group.position.set(hx - ox, 0, hz - oz);
      it.hx = hx;
      it.hz = hz;
    }
    const sunX = internals.sun.hx ?? 0;
    const sunZ = internals.sun.hz ?? 0;

    cam.updateMatrixWorld();
    camPos.setFromMatrixPosition(cam.matrixWorld);
    renderer.getDrawingBufferSize(drawSize);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad((cam.fov ?? 55) * 0.5)) / (cam.zoom ?? 1);
    const pxPerRad = drawSize.y * 0.5 / tanHalf;
    beaconMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    for (let i = 0; i < nB; i++) {
      const id = beaconIds[i];
      const it = internals[id];
      const b = it.b;
      if (it.hx === undefined) { bSA[i * 2 + 1] = 0; continue; }

      // Sun direction from this body (the Sun sits at heliocentric sunX, sunZ).
      const dx = sunX - it.hx;
      const dz = sunZ - it.hz;
      const dist = Math.hypot(dx, dz) || 1;
      it.sunDir.set(dx / dist, 0, dz / dist);
      // Real eclipse shadows are crisp: the compressed Sun is far too big in
      // the sky, so penumbrae use a third of its angular size.
      it.sunAng = (BODIES.sun.radius / dist) * 0.33;

      // Spin, or tidal lock toward the parent.
      if (b.spin) {
        it.spin.rotation.y = ((time / b.spin) % 1) * TAU;
      } else if (b.parent && internals[b.parent].hx !== undefined) {
        const px = internals[b.parent].hx - it.hx;
        const pz = internals[b.parent].hz - it.hz;
        it.spin.rotation.y = Math.atan2(-pz, px);
      }

      // How big is it on screen?
      const toBody = tmp.subVectors(it.group.position, camPos);
      const d = Math.max(toBody.length(), 1e-3);
      const pr = (b.radius / d) * pxPerRad;
      it.pixelRadius = pr;
      it.tilt.visible = pr > HIDE_BELOW_PX;

      // Beacon: sits just in front of the body (toward the camera) so the
      // body's own few pixels never hide it.
      const k = 1 - smoothstep(BEACON_FADE[0], BEACON_FADE[1], pr);
      const view = views[id];
      const hl = view.highlighted ? 1 : 0;
      bPos[i * 3] = it.group.position.x - (toBody.x / d) * b.radius * 1.05;
      bPos[i * 3 + 1] = it.group.position.y - (toBody.y / d) * b.radius * 1.05;
      bPos[i * 3 + 2] = it.group.position.z - (toBody.z / d) * b.radius * 1.05;
      bSA[i * 2] = baseSize[i] * (1 + 0.6 * hl);
      bSA[i * 2 + 1] = Math.max(k, hl * 0.9 * k + hl * 0.0) * (hl ? 1.3 : 1);

      // Highlight ring: hugs the body, never smaller than 26 px across.
      if (hl) {
        const minWorld = (13 / pxPerRad) * d;
        view.sprite.scale.setScalar(Math.max(b.radius * 1.35, minWorld) * 2);
        view.sprite.material.opacity = 0.55 + 0.35 * Math.sin(time * 4);
      }
    }
    posAttr.needsUpdate = true;
    saAttr.needsUpdate = true;

    // Materials.
    for (let i = 0; i < nB; i++) {
      const id = beaconIds[i];
      const it = internals[id];
      if (it.hx === undefined || !it.tilt.visible) continue;
      const u = it.surfMat.uniforms;
      u.uSunDir.value.copy(it.sunDir);
      u.uSunAng.value = it.sunAng;
      u.uTime.value = time;
      fillOccluders(u.uOcc.value, it.occ);
      if (u.uCloudRot) {
        // Clouds drift slowly eastward relative to the ground.
        const rot = ((time / (it.b.spin * 7)) % 1) * TAU;
        it.clouds.rotation.y = rot;
        u.uCloudRot.value = rot;
        const cu = it.cloudMat.uniforms;
        cu.uSunDir.value.copy(it.sunDir);
        cu.uSunAng.value = it.sunAng;
        fillOccluders(cu.uOcc.value, it.occ);
      }
      if (it.atmoMat) {
        const a = it.atmoMat.uniforms;
        a.uSunDir.value.copy(it.sunDir);
        a.uTime.value = time;
        it.group.getWorldPosition(a.uCenter.value);
        a.uAxis.value.set(0, 1, 0).applyQuaternion(it.tilt.getWorldQuaternion(tmpQ)).normalize();
        // Inside the air (low orbit): draw the far side of the shell instead.
        const inside = camPos.distanceTo(a.uCenter.value) < a.uRa.value * 1.02;
        it.atmoMat.side = inside ? THREE.BackSide : THREE.FrontSide;
      }
      if (it.rings) {
        const r = it.rings.material.uniforms;
        r.uSunDir.value.copy(it.sunDir);
        it.group.getWorldPosition(r.uCenter.value);
        axis.set(0, 1, 0).applyQuaternion(it.tilt.getWorldQuaternion(tmpQ)).normalize();
        r.uNormal.value.copy(axis);
        u.uRingN.value.copy(axis);
        u.uCenter.value.copy(r.uCenter.value);
        u.uRingR.value.z = it.b.radius;
      }
    }

    sun.update(time, cam, flareOccluders, renderer, BODIES.sun.spin);
  }

  const tmpQ = new THREE.Quaternion();
  function fillOccluders(arr, ids) {
    for (let j = 0; j < 4; j++) {
      const oid = ids[j];
      const o = oid && internals[oid];
      if (o && o.hx !== undefined) {
        const gp = o.group.position;
        arr[j].set(gp.x, gp.y, gp.z, o.b.radius);
      } else {
        arr[j].set(0, 0, 0, 0);
      }
    }
  }

  function dispose() {
    scene.remove(root);
    for (const g of geoCache.values()) g.dispose();
    for (const t of textures) t.dispose();
    for (const rt of Object.values(moonMaps)) rt.dispose();
    for (const id of beaconIds) {
      const it = internals[id];
      it.surfMat.dispose();
      it.cloudMat?.dispose();
      it.atmoMat?.dispose();
      it.rings?.dispose();
    }
    for (const v of Object.values(views)) v.sprite.material.dispose();
    ringTexture.dispose();
    beaconGeo.dispose();
    beaconMat.dispose();
    sun.dispose();
  }

  return {
    root,
    views,
    ready,
    update,
    dispose,
    sunLight: sun.light,
    ambientLight,
    /** For debugging / the lab: on-screen radius in px of each body last frame. */
    pixelRadius: (id) => internals[id]?.pixelRadius ?? 0,
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Thin targeting ring for setHighlighted: two soft concentric strokes. */
function highlightTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 5;
  g.shadowColor = 'rgba(255,255,255,1)';
  g.shadowBlur = 10;
  g.beginPath();
  g.arc(0, 0, S * 0.44, 0, Math.PI * 2);
  g.stroke();
  // four tick marks
  g.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.beginPath();
    g.moveTo(Math.cos(a) * S * 0.44, Math.sin(a) * S * 0.44);
    g.lineTo(Math.cos(a) * S * 0.49, Math.sin(a) * S * 0.49);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
