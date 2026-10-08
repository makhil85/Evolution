// Chapter 6: the ship for the stars (STARSHIP_PLAN.md, WP-1). Built in metres,
// flying towards -Z: the shield cap is at the front (-Z), the fusion drive at
// the back (+Z). The origin is the centre of the habitat ring.
//
// createStarship({ detail: 'near' | 'far' }) -> {
//   group                    THREE.Group, the whole ship in metres
//   dims: { length, ringR, capR, hubZ }
//                            length ~370 m (cap front to plume), ringR 62 (the
//                            ring's outer radius, so 124 m across), capR 67.5
//                            (the cap is ~145 m wide, 1.2x the ring), hubZ 0
//                            (the docking port sits at the hub, on the +X side)
//   update(dt, t)            ring spin, running lights, field shimmer, plume
//                            flicker (dt and t in seconds)
//   setRingSpin(radPerSec)   habitat ring spin (default 0.3)
//   setDrive(k)              0..1: lights k*4 of the four magnet rings, the
//                            plume grows with k (0 = off)
//   setField(k)              0..1: the faint magnetic field ahead of the cap
//   setLights(on)            running lights blink (true) or stay dark (false)
//   dispose()                frees this ship's geometry and materials
// }
//
// Layout along Z (metres): cap centre -135 (8 m thick, a machined rim, pale
// ice on the back face); the truss -133..-90 (a lattice, not a tube); spine
// nose -100, aft 158; hub and ring at 0 (the ring is 22 m deep); radiator fins
// 55..125; drive bell 158..206; magnet rings 206..227; plume from 230; the
// field dome from -139 forward.
//
// Materials: MeshToonMaterial with the game's toonRamp (the rock uses vertex
// colours); a little emissive keeps the shadow side light. Glows are
// MeshBasicMaterial with colour multiplied above the bloom threshold (1.25),
// except the plume, which stays faint on purpose. The field is a Fresnel
// ShaderMaterial with the game's log depth chunks. Parts are merged per
// material, so draw calls stay low. The hull, ring and cap get an
// inverted-hull outline in metres (OUT), so the line keeps its width on a 300 m
// ship.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, outlineMaterial } from '../../game/toonPipeline.js';

/**
 * Its length in the flight scene, in scene units: about 13x her ship (1.2 u),
 * not the true ~46x, so she never looks like a speck beside it in the
 * cutscenes (lead issue b). group.scale.setScalar(FLIGHT_LENGTH / dims.length).
 */
export const FLIGHT_LENGTH = 16;

const CAP_Z = -135; // the cap's centre
const CAP_R = 67.5; // its radius (lumps take the width to ~145 m)
const RING_RO = 62; // the habitat ring's outer radius
const RING_RI = 58; // its inner radius
const RING_D = 22; // its depth along Z
const PLUME_Z = 230; // where the plume starts (the nozzle mouth)
const FIELD_Z = -139; // the field dome's rim, just in front of the cap
const FIELD_R = 82; // its base radius
const FIELD_PEAK = 0.25; // the field's alpha at its rim, at setField(1)
const OUT = 0.6; // outline thickness, metres
const RING_SPIN = 0.3;

// The spine's profile, (radius, z) from the nose to the aft end.
const SPINE = [[0, -100], [4, -96], [6.6, -90], [8.6, -70], [9.6, -30], [10, 0], [10.4, 60], [11.2, 110], [11, 130], [10, 150], [9.2, 158]];
const BELL = [[9.2, 158], [11, 170], [16, 186], [22, 200], [24.5, 206]];
const NOZZLES = [[206, 25.5], [213, 26.5], [220, 27.5], [227, 28.8]]; // [z, radius] of the four magnet rings
// The cap's profile, (radius, z): a flat disc, 8 m thick at the centre, with a rounded rim.
const CAP_PROFILE = [[0, -4], [12, -4], [24, -4], [36, -4], [48, -4], [58, -3.9], [62, -3.6], [66.5, -2.4], [67.5, 0], [66.5, 2.4], [62, 3.6], [58, 3.9], [48, 4], [36, 4], [24, 4], [12, 4], [0, 4]];

function rAt(z) {
  for (let i = 1; i < SPINE.length; i++) {
    if (z <= SPINE[i][1]) {
      const [r0, z0] = SPINE[i - 1]; const [r1, z1] = SPINE[i];
      return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
    }
  }
  return SPINE[SPINE.length - 1][0];
}

// Seeded random, so the greebles are the same on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The outline of a rounded rectangle in (r, z), walked so that a lathe's normals face out.
function roundRect(r0, r1, z0, z1, rc, n) {
  const corners = [[r1 - rc, z1 - rc, 0], [r0 + rc, z1 - rc, Math.PI / 2], [r0 + rc, z0 + rc, Math.PI], [r1 - rc, z0 + rc, (3 * Math.PI) / 2]];
  const pts = [];
  for (const [cr, cz, a0] of corners) {
    for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * (Math.PI / 2); pts.push([cr + rc * Math.cos(t), cz + rc * Math.sin(t)]); }
  }
  pts.push(pts[0]);
  return pts;
}

// Inverted-hull shell: each vertex pushed out along its normal by d metres.
function shellOf(geo, d) {
  const g = geo.clone();
  const p = g.attributes.position; const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  p.needsUpdate = true;
  return g;
}

/** A beam (open box) from point a to point b, w metres square. */
function beamGeo(a, b, w = 1.1) {
  const A = new THREE.Vector3(...a); const B = new THREE.Vector3(...b);
  const g = new THREE.BoxGeometry(w, w, A.distanceTo(B));
  const o = new THREE.Object3D(); o.position.copy(A).lerp(B, 0.5); o.lookAt(B); o.updateMatrix();
  return g.applyMatrix4(o.matrix);
}

/** Placement for a part on a surface of revolution about Z: local +Z is radial at angle a, local +Y runs along Z. */
function radialMatrix(a, r, z) {
  const c = Math.cos(a); const s = Math.sin(a);
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(-s, c, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(c, s, 0)).setPosition(c * r, s * r, z);
}

// The field dome: a Fresnel alpha (the rim glows, the middle stays clear), with the game's log depth chunks.
const FIELD_VS = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const FIELD_FS = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uPeak;
uniform float uTime;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  #include <logdepthbuf_fragment>
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  float shimmer = 0.85 + 0.15 * sin(uTime * 1.7 + vP.y * 0.07 + vP.x * 0.05);
  gl_FragColor = vec4(uColor, uPeak * f * shimmer);
}
`;

export function createStarship({ detail = 'near' } = {}) {
  const far = detail === 'far';
  const SEG = far ? 12 : 28; // around the spine and the bell
  const RSEG = far ? 40 : 96; // around the habitat ring and the cap
  const TSEG = far ? 32 : 64; // tori
  const group = new THREE.Group();
  group.name = 'starship';
  const owned = new Set(); // geometries and materials we made (dispose() frees these)
  const track = (o) => { owned.add(o); return o; };

  const toon = (color, emissive = 0x000000) => track(new THREE.MeshToonMaterial({ color, emissive, gradientMap: toonRamp }));
  const glow = (hex, k) => track(new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
  const M = {
    hull: toon(0xf4f7fa, 0x7a8694),
    pale: toon(0xf6fbff, 0x7a8694),
    dark: toon(0x5a6478, 0x2c3440),
    orange: toon(0xff8a3d, 0x3a1a08),
    rock: track(new THREE.MeshToonMaterial({ vertexColors: true, emissive: 0x1a1816, gradientMap: toonRamp })),
    win: glow(0xffd58a, 1.6),
    portGlow: glow(0xcffaff, 2.2),
  };

  // Geometry is collected per material, then merged once per bucket.
  const bins = { hull: [], dark: [], orange: [], pale: [], ringHull: [], ringDark: [], ringWin: [], port: [] };
  const put = (bin, geo, m = null) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    bins[bin].push(g);
  };
  const at = (x, y, z, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1));
  const flush = (bin, mat, parent, outline = 0) => {
    if (!bins[bin].length) return null;
    const geo = track(mergeGeometries(bins[bin], false));
    bins[bin].forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, mat);
    parent.add(mesh);
    if (outline) parent.add(new THREE.Mesh(track(shellOf(geo, outline)), outlineMaterial));
    return mesh;
  };
  // A surface of revolution about Z: the profile is (r, z) and is swept around the ship's axis.
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(Math.PI / 2);

  // --- the hull: spine, hub, bell, port ----------------------------------------------
  put('hull', lathe(SPINE, SEG));
  put('dark', lathe(BELL, SEG));
  put('dark', new THREE.CylinderGeometry(12, 12, 22, SEG, 1).rotateX(Math.PI / 2)); // the hub drum
  put('dark', new THREE.CylinderGeometry(3.6, 3.6, 8, 20).rotateZ(Math.PI / 2), at(16, 0, 0)); // docking collar, +X side
  put('port', new THREE.TorusGeometry(3.6, 0.6, 8, 20).rotateY(Math.PI / 2), at(20.4, 0, 0)); // its lit ring

  // Collar bands and (near only) small vents along the spine.
  for (const z of [-60, 20, 95, 140]) put('dark', new THREE.TorusGeometry(rAt(z) + 0.3, 0.35, 6, SEG), at(0, 0, z));
  if (!far) {
    const rnd = rng(6);
    for (let i = 0; i < 36; i++) {
      const z = -80 + rnd() * 220; const a = rnd() * Math.PI * 2;
      put('dark', new THREE.BoxGeometry(1.3, 3, 0.5), radialMatrix(a, rAt(z) + 0.1, z));
    }
  }

  // Orange stripes that follow the spine's taper (10 m segments, each at the spine's radius there).
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
    for (let z = -85; z < 25; z += 10) { const zm = z + 5; put('orange', new THREE.BoxGeometry(1.0, 10.2, 0.5), radialMatrix(a, rAt(zm) + 0.1, zm)); }
  }

  // Radiator fins (pale panels) on the four sides, with dark ribs.
  put('pale', new THREE.BoxGeometry(28, 0.6, 70), at(22, 0, 90));
  put('pale', new THREE.BoxGeometry(28, 0.6, 70), at(-22, 0, 90));
  put('pale', new THREE.BoxGeometry(0.6, 28, 70), at(0, 22, 90));
  put('pale', new THREE.BoxGeometry(0.6, 28, 70), at(0, -22, 90));
  if (!far) {
    for (const z of [62, 74, 86, 98, 110, 122]) {
      put('dark', new THREE.BoxGeometry(27.6, 0.25, 0.9), at(22, 0.5, z));
      put('dark', new THREE.BoxGeometry(27.6, 0.25, 0.9), at(-22, 0.5, z));
      put('dark', new THREE.BoxGeometry(0.25, 27.6, 0.9), at(0.5, 22, z));
      put('dark', new THREE.BoxGeometry(0.25, 27.6, 0.9), at(0.5, -22, z));
    }
  }

  // Antennae: a dish on a stalk on top, a long whip below.
  put('dark', new THREE.CylinderGeometry(0.3, 0.3, 9, 6), at(0, 14.5, -40));
  put('dark', new THREE.SphereGeometry(4, 16, 6, 0, Math.PI * 2, 0, 0.75).rotateX(-Math.PI / 2), at(0, 19.5, -40));
  put('dark', new THREE.CylinderGeometry(0.35, 0.35, 30, 6), at(0, -26, 90));

  // --- the truss: a lattice between the cap and the nose (open beams) ----------------
  const MOUNT_Z = -130.5; // on the cap's back face, at radius 42
  const COLLAR_Z = -90; // a hoop around the spine nose
  const V = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    put('dark', beamGeo(V(42, a, MOUNT_Z), V(6.8, a, COLLAR_Z)));
    put('dark', beamGeo(V(42, a, MOUNT_Z), V(6.8, a + Math.PI / 3, COLLAR_Z)));
    put('dark', beamGeo(V(66, a, -133), V(42, a, MOUNT_Z), 1.4));
  }
  put('dark', new THREE.TorusGeometry(42, 1.1, 6, TSEG), at(0, 0, MOUNT_Z));
  put('dark', new THREE.TorusGeometry(6.8, 0.8, 6, TSEG), at(0, 0, COLLAR_Z));
  put('dark', new THREE.TorusGeometry(66, 0.9, 6, TSEG), at(0, 0, -133));

  // --- the shield cap: a machined disc of drilled rock, lumpy on the front, pale ice on the back ---
  const lat = lathe(CAP_PROFILE, RSEG);
  lat.deleteAttribute('uv'); lat.deleteAttribute('normal');
  const capGeo = track(mergeVertices(lat));
  lat.dispose();
  {
    const p = capGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const rr = Math.hypot(v.x, v.y);
      // Lumps of 1-1.5% on the front face only (they fade out at the rim).
      const w = Math.max(0, Math.min(1, -v.z / 3));
      const lump = 1 + 0.015 * w * (0.6 * Math.sin(v.x * 0.11 + 1.2) * Math.sin(v.y * 0.09 - 0.4) + 0.4 * Math.sin(v.x * 0.23 - v.y * 0.19));
      p.setXYZ(i, v.x * lump, v.y * lump, v.z);
      // Grey-brown rock at the front (-Z), pale water ice on the back (+Z), with ragged edges.
      const n2 = 0.5 + 0.5 * Math.sin(v.x * 0.13 + 1.3) * Math.sin(v.y * 0.11 - 0.4);
      const ice = Math.max(0, Math.min(1, (v.z - 0.5 + 0.3 * (n2 - 0.5)) * 2));
      const grit = 0.92 + 0.08 * Math.sin(v.x * 0.9 + v.y * 1.3);
      col.set([
        0.5 * grit * (1 - ice) + 0.82 * ice,
        0.46 * grit * (1 - ice) + 0.9 * ice,
        0.42 * grit * (1 - ice) + 0.97 * ice,
      ], i * 3);
    }
    capGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    capGeo.computeVertexNormals();
  }
  // A machined dark rim, and twelve bolt heads on the back face at radius 62.
  put('dark', new THREE.TorusGeometry(CAP_R, 1.2, 8, TSEG), at(0, 0, CAP_Z));
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    put('dark', new THREE.CylinderGeometry(1.1, 1.1, 0.8, 8).rotateX(Math.PI / 2), at(62 * Math.cos(a), 62 * Math.sin(a), CAP_Z + 3.8));
  }

  // The static hull: spine with outline, and the merged dark, orange, pale and port parts.
  flush('hull', M.hull, group, OUT);
  flush('dark', M.dark, group);
  flush('orange', M.orange, group);
  flush('pale', M.pale, group);
  flush('port', M.portGlow, group);

  const cap = new THREE.Mesh(capGeo, M.rock);
  const capShell = new THREE.Mesh(track(shellOf(capGeo, OUT * 1.5)), outlineMaterial);
  cap.position.z = capShell.position.z = CAP_Z;
  group.add(cap, capShell);

  // --- the habitat ring: a closed band with a rounded-rectangle section, spins about Z ---
  const ring = new THREE.Group();
  ring.name = 'habitat-ring';
  group.add(ring);
  put('ringHull', lathe(roundRect(RING_RI, RING_RO, -RING_D / 2, RING_D / 2, 1.5, far ? 2 : 4), RSEG));
  // Rows of warm window panels just outside the band.
  const rows = far ? [-6, 6] : [-6, 0, 6];
  const cols = far ? 24 : 48;
  for (let c = 0; c < cols; c++) {
    for (const z of rows) put('ringWin', new THREE.PlaneGeometry(3.0, 2.4), radialMatrix((c / cols) * Math.PI * 2, RING_RO + 0.12, z));
  }
  // Six spokes from the hub to the band (at 30 + 60k degrees, so the +X port is clear).
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    put('ringDark', new THREE.BoxGeometry(46, 1.6, 2.4), at(35 * Math.cos(a), 35 * Math.sin(a), 0, a));
  }
  flush('ringHull', M.hull, ring, OUT);
  flush('ringDark', M.dark, ring);
  flush('ringWin', M.win, ring);

  // --- running lights: port (red) and starboard (green) at the fin tips, a strobe on the cap rim ---
  const lights = [
    { pos: [-36.6, 0, 125], rgb: [1, 0.12, 0.1], rate: 0.9, off: 0, strobe: false },
    { pos: [36.6, 0, 125], rgb: [0.2, 1, 0.35], rate: 0.9, off: 0.5, strobe: false },
    { pos: [0, CAP_R + 1.2, CAP_Z], rgb: [1, 1, 1], rate: 2.2, off: 0, strobe: true },
  ].map((d) => {
    const mat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(...d.rgb) }));
    const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(1.1, 8, 6)), mat);
    mesh.position.set(...d.pos);
    group.add(mesh);
    return { ...d, mat };
  });

  // Magnet rings: lit one by one by setDrive (each has its own material).
  const LIT = new THREE.Color(0x7ff3ff).multiplyScalar(1.4);
  const DARK = new THREE.Color(0x334455);
  const nozzleMats = NOZZLES.map(([z, r]) => {
    const mat = track(new THREE.MeshBasicMaterial({ color: DARK.clone() }));
    const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(r, 1.5, 10, TSEG)), mat);
    mesh.position.z = z;
    group.add(mesh);
    return mat;
  });

  // The plume: cones whose vertex colours fade to black at both ends, so the additive
  // glow has no hard edges. (Height segments keep the fade smooth along the length.)
  const plumeGeo = (seg, rgb) => {
    const g = new THREE.ConeGeometry(1, 1, seg, 8, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const p = g.attributes.position; const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const f = Math.min(1, z / 0.2) * Math.max(0, 1 - (z - 0.3) / 0.7);
      col.set([rgb[0] * f, rgb[1] * f, rgb[2] * f], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return track(g);
  };
  const plumeMat = () => track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const plumeOuterMat = plumeMat();
  const plumeCoreMat = plumeMat();
  const plumeOuter = new THREE.Mesh(plumeGeo(far ? 12 : 24, [0.55, 0.85, 1]), plumeOuterMat);
  const plumeCore = new THREE.Mesh(plumeGeo(far ? 8 : 16, [1, 1, 1]), plumeCoreMat);
  plumeOuter.position.z = plumeCore.position.z = PLUME_Z;
  plumeOuter.visible = plumeCore.visible = false;
  group.add(plumeOuter, plumeCore);

  // --- the magnetic field: one faint dome ahead of the cap -----------------------------
  const fieldGeo = track(new THREE.SphereGeometry(FIELD_R, far ? 24 : 48, far ? 10 : 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 0.6));
  const fieldMat = track(new THREE.ShaderMaterial({
    uniforms: { uPeak: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8fe9ff) } },
    vertexShader: FIELD_VS,
    fragmentShader: FIELD_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const fieldShell = new THREE.Mesh(fieldGeo, fieldMat);
  fieldShell.position.z = FIELD_Z;
  fieldShell.visible = false;
  group.add(fieldShell);

  // --- state -------------------------------------------------------------------------
  let spin = RING_SPIN;
  let drive = 0;
  let fieldK = 0.6;
  let lightsOn = true;
  let time = 0;

  const applyField = () => {
    fieldShell.visible = fieldK > 0.01;
    fieldMat.uniforms.uPeak.value = FIELD_PEAK * fieldK;
    fieldMat.uniforms.uTime.value = time;
  };

  const applyDrive = () => {
    nozzleMats.forEach((m, i) => m.color.copy(drive * 4 > i + 0.5 ? LIT : DARK));
    const flick = 1 + 0.05 * Math.sin(time * 41) + 0.03 * Math.sin(time * 17);
    const k = drive;
    plumeOuter.visible = plumeCore.visible = k > 0.01;
    const w = 12 * (0.85 + 0.15 * k) * flick;
    plumeOuter.scale.set(w, w, Math.max(0.001, 140 * k));
    const c = 4.5 * flick;
    plumeCore.scale.set(c, c, Math.max(0.001, 90 * k));
    plumeOuterMat.opacity = 0.18 * k;
    plumeCoreMat.opacity = 0.22 * k;
  };

  const blinkOn = (t, l) => {
    const f = (t * l.rate + l.off) % 1;
    return f < (l.strobe ? 0.07 : 0.22) ? 1 : 0.1;
  };

  return {
    group,
    dims: { length: 370, ringR: RING_RO, capR: CAP_R, hubZ: 0 },
    update(dt, t) {
      time = t;
      ring.rotation.z += spin * dt;
      for (const l of lights) {
        const k = lightsOn ? blinkOn(t, l) * 2.4 : 0.05;
        l.mat.color.setRGB(l.rgb[0] * k, l.rgb[1] * k, l.rgb[2] * k);
      }
      applyField();
      applyDrive();
    },
    setRingSpin(radPerSec) { spin = radPerSec; },
    setDrive(k) { drive = Math.max(0, Math.min(1, k)); applyDrive(); },
    setField(k) { fieldK = Math.max(0, Math.min(1, k)); applyField(); },
    setLights(on) { lightsOn = !!on; },
    dispose() {
      for (const o of owned) o.dispose();
      owned.clear();
    },
  };
}
