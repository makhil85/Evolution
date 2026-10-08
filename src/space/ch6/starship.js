// Chapter 6: the ship for the stars (STARSHIP_PLAN.md, WP-1). Built in metres,
// flying towards -Z: the shield cap is at the front (-Z), the fusion drive at
// the back (+Z). The origin is the centre of the habitat ring.
//
// createStarship({ detail: 'near' | 'far' }) -> {
//   group                    THREE.Group, the whole ship in metres
//   dims: { length, ringR, capR, hubZ }
//                            length ~370 m (cap front to plume), ringR 60 (the
//                            ring is 120 m across), capR 67.5 (the cap is ~145 m
//                            wide, 1.2x the ring), hubZ 0 (the docking port
//                            sits at the hub, on the +X side)
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
// Layout along Z (metres): cap centre -135 (8 m thick, pale ice on the back
// face); the truss -131..-90 (lattice, not a tube); spine nose -100, aft 158;
// hub and ring at 0 (the ring is 14 m deep); radiator fins 55..125; drive bell
// 158..206; magnet rings 206..227; plume from 230.
//
// Materials: MeshToonMaterial with the game's toonRamp (rock uses vertex
// colours). Glows are MeshBasicMaterial with colour multiplied above the bloom
// threshold (1.25). Parts are merged per material, so draw calls stay low.
// The hull, ring and cap get an inverted-hull outline in metres (OUT), so the
// line stays the same width on a 300 m ship.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, outlineMaterial } from '../../game/toonPipeline.js';

const CAP_Z = -135; // the cap's centre
const CAP_R = 67.5; // its radius (lumps take the width to ~145 m)
const CAP_T = 4; // its half thickness (8 m)
const RING_R = 60; // the habitat ring's radius
const RING_D = 14; // its depth along Z
const PLUME_Z = 230; // where the plume starts (the nozzle mouth)
const OUT = 0.6; // outline thickness, metres
const RING_SPIN = 0.3;

// The spine's profile, (radius, z) from the nose to the aft end.
const SPINE = [[0, -100], [4, -96], [6.6, -90], [8.6, -70], [9.6, -30], [10, 0], [10.4, 60], [11.2, 110], [11, 130], [10, 150], [9.2, 158]];
const BELL = [[9.2, 158], [11, 170], [16, 186], [22, 200], [24.5, 206]];
const NOZZLES = [[206, 25.5], [213, 26.5], [220, 27.5], [227, 28.8]]; // [z, radius] of the four magnet rings

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

export function createStarship({ detail = 'near' } = {}) {
  const far = detail === 'far';
  const SEG = far ? 12 : 28; // around the spine and the bell
  const RSEG = far ? 40 : 96; // around the habitat ring
  const TSEG = far ? 32 : 64; // tori
  const group = new THREE.Group();
  group.name = 'starship';
  const owned = new Set(); // geometries and materials we made (dispose() frees these)
  const track = (o) => { owned.add(o); return o; };

  const toon = (color) => track(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  const glow = (hex, k) => track(new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
  const M = {
    hull: toon(0xdfe6ee),
    pale: toon(0xf2f8ff),
    dark: toon(0x3b4556),
    orange: toon(0xff8a3d),
    rock: track(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp })),
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
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(Math.PI / 2);

  // --- the hull: spine, hub, bell, port -----------------------------------------------
  put('hull', lathe(SPINE, SEG));
  put('dark', lathe(BELL, SEG));
  put('dark', new THREE.CylinderGeometry(12, 12, 22, SEG, 1).rotateX(Math.PI / 2)); // the hub drum
  put('dark', new THREE.CylinderGeometry(3.6, 3.6, 8, 20).rotateZ(Math.PI / 2), at(16, 0, 0)); // docking collar, +X side
  put('port', new THREE.TorusGeometry(3.6, 0.6, 8, 20).rotateY(Math.PI / 2), at(20.4, 0, 0)); // its lit ring

  // Collar bands and (near only) small vents and hatches along the spine.
  for (const z of [-60, 20, 95, 140]) put('dark', new THREE.TorusGeometry(rAt(z) + 0.3, 0.35, 6, SEG), at(0, 0, z));
  if (!far) {
    const rnd = rng(6);
    for (let i = 0; i < 36; i++) {
      const z = -80 + rnd() * 220; const a = rnd() * Math.PI * 2;
      put('dark', new THREE.BoxGeometry(1.3, 3, 0.5), radialMatrix(a, rAt(z) + 0.1, z));
    }
  }

  // Orange stripes along the spine (under the hub drum at the middle).
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) put('orange', new THREE.BoxGeometry(1.0, 110, 0.5), radialMatrix(a, 9.9, -30));

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

  // --- the truss: a lattice between the cap and the nose (open beams) -------------------
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

  // The static hull: spine with outline, and the merged dark, orange, pale and port parts.
  flush('hull', M.hull, group, OUT);
  flush('dark', M.dark, group);
  flush('orange', M.orange, group);
  flush('pale', M.pale, group);
  flush('port', M.portGlow, group);

  // --- the shield cap: a lumpy drilled-rock disc, pale ice on its back face -----------
  const ico = new THREE.IcosahedronGeometry(1, far ? 8 : 15);
  ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
  const capGeo = track(mergeVertices(ico));
  ico.dispose();
  {
    const p = capGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); // a point on the unit sphere, squashed into a disc
      const lump = 1 + 0.07 * Math.sin(v.x * 5.3 + v.y * 2.1) + 0.05 * Math.sin(v.y * 7.1 - v.z * 3.3) + 0.04 * Math.sin(v.z * 12 + v.x * 4);
      const crater = -1.2 * Math.max(0, 0.06 - Math.abs(Math.sin(v.x * 9) * Math.sin(v.z * 8)));
      const rr = lump * (1 + crater);
      p.setXYZ(i, v.x * CAP_R * rr, v.y * CAP_R * rr, v.z * CAP_T * (1 + 0.15 * Math.sin(v.x * 6 - v.y * 4)));
      // Grey-brown rock at the front (-Z), pale water ice on the back (+Z), with ragged edges.
      const n2 = 0.5 + 0.5 * Math.sin(v.x * 4.1 + 1.3) * Math.sin(v.y * 3.7 - 0.4);
      const ice = Math.max(0, Math.min(1, (v.z - 0.4 + 0.18 * (n2 - 0.5)) * 5));
      const grit = 0.9 + 0.1 * Math.sin(v.x * 17 + v.y * 23 + v.z * 11);
      col.set([
        (0.3 * grit) * (1 - ice) + 0.82 * ice,
        (0.25 * grit) * (1 - ice) + 0.9 * ice,
        (0.2 * grit) * (1 - ice) + 0.97 * ice,
      ], i * 3);
    }
    capGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    capGeo.computeVertexNormals();
  }
  const cap = new THREE.Mesh(capGeo, M.rock);
  const capShell = new THREE.Mesh(track(shellOf(capGeo, OUT * 1.5)), outlineMaterial);
  cap.position.z = capShell.position.z = CAP_Z;
  group.add(cap, capShell);

  // --- the habitat ring: spins about Z -----------------------------------------------
  const ring = new THREE.Group();
  ring.name = 'habitat-ring';
  group.add(ring);
  put('ringHull', new THREE.CylinderGeometry(RING_R, RING_R, RING_D, RSEG, 1, true).rotateX(Math.PI / 2));
  for (const z of [-RING_D / 2, RING_D / 2]) put('ringHull', new THREE.TorusGeometry(RING_R, 1.0, 8, RSEG), at(0, 0, z));
  // Rows of warm window lights on the outside of the band.
  const rows = far ? [-3.5, 3.5] : [-4.2, 0, 4.2];
  const cols = far ? 24 : 48;
  for (let c = 0; c < cols; c++) {
    for (const z of rows) put('ringWin', new THREE.PlaneGeometry(2.4, 1.8), radialMatrix((c / cols) * Math.PI * 2, RING_R + 0.12, z));
  }
  // Six spokes from the hub to the rim (at 30 + 60k degrees, so the +X port is clear).
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    put('ringDark', new THREE.BoxGeometry(47, 1.6, 2.4), at(35.5 * Math.cos(a), 35.5 * Math.sin(a), 0, a));
  }
  flush('ringHull', M.hull, ring, OUT);
  flush('ringDark', M.dark, ring);
  flush('ringWin', M.win, ring);

  // --- running lights: port (red) and starboard (green) at the fin tips, a strobe on the cap rim
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
  const LIT = new THREE.Color(0x7ff3ff).multiplyScalar(2.5);
  const DARK = new THREE.Color(0x334455);
  const nozzleMats = NOZZLES.map(([z, r]) => {
    const mat = track(new THREE.MeshBasicMaterial({ color: DARK.clone() }));
    const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(r, 1.5, 10, TSEG)), mat);
    mesh.position.z = z;
    group.add(mesh);
    return mat;
  });

  // The plume: an outer cone and a white core, both growing with the drive level.
  const coneGeo = (seg) => new THREE.ConeGeometry(1, 1, seg, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const plumeMat = (rgb, k) => track(new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb).multiplyScalar(k), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const plumeOuterMat = plumeMat([0.55, 0.85, 1], 1.1);
  const plumeCoreMat = plumeMat([1, 1, 1], 1.6);
  const plumeOuter = new THREE.Mesh(track(coneGeo(far ? 12 : 24)), plumeOuterMat);
  const plumeCore = new THREE.Mesh(track(coneGeo(far ? 8 : 16)), plumeCoreMat);
  plumeOuter.position.z = plumeCore.position.z = PLUME_Z;
  plumeOuter.visible = plumeCore.visible = false;
  group.add(plumeOuter, plumeCore);

  // --- the magnetic field: two faint additive shells ahead of the cap -----------------
  const dome = (R, depth) => track(new THREE.SphereGeometry(R, far ? 24 : 40, far ? 10 : 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, depth));
  const fieldMat = (k) => track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fe9ff).multiplyScalar(k), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const fieldOuterMat = fieldMat(1);
  const fieldInnerMat = fieldMat(1);
  const fieldOuter = new THREE.Mesh(dome(105, 0.75), fieldOuterMat);
  const fieldInner = new THREE.Mesh(dome(92, 0.6), fieldInnerMat);
  fieldOuter.position.z = fieldInner.position.z = CAP_Z;
  fieldOuter.visible = fieldInner.visible = false;
  fieldOuter.renderOrder = fieldInner.renderOrder = 2;
  group.add(fieldOuter, fieldInner);

  // --- state -------------------------------------------------------------------------
  let spin = RING_SPIN;
  let drive = 0;
  let field = 0.6;
  let lightsOn = true;
  let time = 0;

  const applyField = () => {
    fieldOuter.visible = fieldInner.visible = field > 0.01;
    const shimmerA = 0.03 + 0.012 * Math.sin(time * 1.3);
    const shimmerB = 0.022 + 0.01 * Math.sin(time * 2.3 + 1.7);
    fieldOuterMat.opacity = field * shimmerA;
    fieldInnerMat.opacity = field * shimmerB;
  };

  const applyDrive = () => {
    nozzleMats.forEach((m, i) => m.color.copy(drive * 4 > i + 0.5 ? LIT : DARK));
    const flick = 1 + 0.05 * Math.sin(time * 41) + 0.03 * Math.sin(time * 17);
    const k = drive;
    plumeOuter.visible = plumeCore.visible = k > 0.01;
    plumeOuter.scale.set(22 * (0.85 + 0.15 * k) * flick, 22 * (0.85 + 0.15 * k) * flick, Math.max(0.001, 260 * k));
    plumeCore.scale.set(9 * flick, 9 * flick, Math.max(0.001, 170 * k));
    plumeOuterMat.opacity = 0.3 * k;
    plumeCoreMat.opacity = 0.5 * k;
  };

  const blinkOn = (t, l) => {
    const f = (t * l.rate + l.off) % 1;
    return f < (l.strobe ? 0.07 : 0.22) ? 1 : 0.1;
  };

  return {
    group,
    dims: { length: 370, ringR: RING_R, capR: CAP_R, hubZ: 0 },
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
    setField(k) { field = Math.max(0, Math.min(1, k)); applyField(); },
    setLights(on) { lightsOn = !!on; },
    dispose() {
      for (const o of owned) o.dispose();
      owned.clear();
    },
  };
}
