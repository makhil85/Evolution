// Surface scenes - things to find and use: the glowing Moon sample, the old
// science station and lander, and the Europa drill rig.
//
// The old station and lander are realistic (foil, white paint, solar cells)
// to match the realistic ground; her own kit (the drill rig) is cel-shaded
// like her ship. All generic: no flags, no mission names, no insignia.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE_GLSL } from '../bodyShaders.js';
import { SHIP_PALETTE, INK } from '../contracts.js';
import { makeGirlToon } from './walker.js';
import { snoise2 } from './noise.js';

const up = new THREE.Vector3(0, 1, 0);

/** Crinkled foil: gold metal with a noisy normal. */
function foilMaterial(color = 0xc9a24e) {
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.32 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFP;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vFP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nvarying vec3 vFP;`)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        #include <normal_fragment_maps>
        {
          vec3 q = vFP * 22.0;
          vec3 g = vec3(snoise(q), snoise(q + 17.0), snoise(q + 31.0));
          g += 0.5 * vec3(snoise(q * 2.3 + 3.0), snoise(q * 2.3 + 9.0), snoise(q * 2.3 + 5.0));
          vec3 gv = (viewMatrix * vec4(g, 0.0)).xyz * 0.22;
          gv -= normal * dot(gv, normal);
          normal = normalize(normal + gv);
        }`)
      .replace('#include <map_fragment>', /* glsl */`
        diffuseColor.rgb *= 0.8 + 0.3 * snoise(vFP * 9.0);`);
  };
  m.customProgramCacheKey = () => 'surfaceFoil';
  return m;
}

function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ccd2';
  g.fillRect(0, 0, 256, 160);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = `hsl(${222 + ((x * 7 + y * 3) % 5)}, 55%, ${18 + ((x + y) % 3) * 2}%)`;
      g.fillRect(4 + x * 31.5, 4 + y * 31, 29, 28);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function reflectorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9ea3aa';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = '#1b1e24';
      g.beginPath();
      g.arc(8 + x * 16, 8 + y * 16, 6.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,190,230,0.5)';
      g.beginPath();
      g.arc(6.5 + x * 16, 6.5 + y * 16, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
};

/** A leg from `a` to `b` (world-ish points), as a cylinder. */
function strut(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

const clean = (g) => {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
};

// ---------------------------------------------------------------------------
// Moon: the sample rock
// ---------------------------------------------------------------------------

export function createSampleRock() {
  const group = new THREE.Group();
  group.name = 'sampleRock';
  const g = new THREE.IcosahedronGeometry(0.12, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = snoise2(v.x * 14 + v.z * 9, v.y * 14) * 0.2 + snoise2(v.z * 30, v.x * 30 + v.y * 11) * 0.06;
    v.multiplyScalar(1 + n);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6a66, roughness: 0.9 });
  const rock = new THREE.Mesh(g, rockMat);
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);
  // Glassy glinting crystals: they bloom, so she can see it from afar.
  const crystalGeo = [];
  const dirs = [[0.6, 0.7, 0.2], [-0.5, 0.8, -0.3], [0.1, 0.9, -0.6], [-0.2, 0.6, 0.75], [0.8, 0.4, -0.5]];
  dirs.forEach((d, i) => {
    const c = new THREE.OctahedronGeometry(0.022 + (i % 2) * 0.012, 0);
    c.scale(0.7, 1.6, 0.7);
    const n = new THREE.Vector3(...d).normalize();
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, n));
    const o = n.clone().multiplyScalar(0.095);
    o.y *= 0.72;
    c.translate(o.x, o.y, o.z);
    crystalGeo.push(c);
  });
  const cg = mergeGeometries(crystalGeo);
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.95, 1.0).multiplyScalar(3.2) });
  const crystals = new THREE.Mesh(cg, crystalMat);
  group.add(crystals);
  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      crystalMat.color.setRGB(0.55, 0.95, 1.0).multiplyScalar(2.4 + 1.2 * Math.sin(t * 4));
    },
    dispose() { g.dispose(); rockMat.dispose(); cg.dispose(); crystalMat.dispose(); crystalGeo.forEach((x) => x.dispose()); },
  };
}

// ---------------------------------------------------------------------------
// Moon: an old robotic lander + instrument package (generic, unbranded)
// ---------------------------------------------------------------------------

export function createOldStation({ terrain, at: site, lander: lsite }) {
  const group = new THREE.Group();
  group.name = 'oldStation';
  const foil = foilMaterial();
  const white = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.6, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.5, metalness: 0.6 });
  const cellsT = solarCellTexture();
  const cells = new THREE.MeshStandardMaterial({ map: cellsT, roughness: 0.3, metalness: 0.35 });
  const reflT = reflectorTexture();
  const refl = new THREE.MeshStandardMaterial({ map: reflT, roughness: 0.25, metalness: 0.5 });

  // --- the instrument package -------------------------------------------------
  const pkg = new THREE.Group();
  const gy = terrain.heightAt(site.x, site.z);
  pkg.position.set(site.x, gy, site.z);
  pkg.rotation.y = 0.5;
  group.add(pkg);
  const foilParts = [];
  const whiteParts = [];
  const darkParts = [];
  foilParts.push(at(new THREE.BoxGeometry(0.62, 0.34, 0.46), 0, 0.3, 0));
  for (const [x, z] of [[-0.26, -0.18], [0.26, -0.18], [-0.26, 0.18], [0.26, 0.18]]) {
    darkParts.push(at(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 6), x, 0.07, z));
    darkParts.push(at(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 10), x, 0.006, z));
  }
  // Dish antenna on a mast.
  whiteParts.push(at(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), 0.2, 0.72, 0.1));
  const dishPts = [];
  for (let i = 0; i <= 8; i++) { const r = (i / 8) * 0.2; dishPts.push(new THREE.Vector2(r, r * r * 2.2)); }
  const dish = new THREE.LatheGeometry(dishPts, 20);
  dish.rotateX(0.9);
  dish.translate(0.2, 0.98, 0.1);
  whiteParts.push(dish);
  // Retroreflector on its own little stand, tilted up toward Earth.
  const reflGeo = new THREE.BoxGeometry(0.42, 0.02, 0.42);
  reflGeo.rotateX(-0.55);
  reflGeo.translate(-0.75, 0.3, 0.35);
  darkParts.push(strut(new THREE.Vector3(-0.75, 0, 0.35), new THREE.Vector3(-0.75, 0.26, 0.35), 0.02));
  // A seismometer drum under a foil skirt.
  foilParts.push(at(new THREE.ConeGeometry(0.28, 0.2, 14, 1, true), 0.8, 0.1, -0.35));
  whiteParts.push(at(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14), 0.8, 0.22, -0.35));
  // Cable across the dust.
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, 0.2, -0.1), new THREE.Vector3(0.55, 0.02, -0.25), new THREE.Vector3(0.7, 0.02, -0.33),
  ]), 12, 0.008, 5);
  darkParts.push(cable);

  const panel = at(new THREE.BoxGeometry(0.72, 0.02, 0.46), 0, 0.58, -0.05, 0.35, 0, 0);
  const meshes = [];
  const addMesh = (parts, mat, parent) => {
    const g = mergeGeometries(parts.map(clean));
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  addMesh(foilParts, foil, pkg);
  addMesh(whiteParts, white, pkg);
  addMesh(darkParts, dark, pkg);
  addMesh([panel], cells, pkg);
  addMesh([reflGeo], refl, pkg);

  // --- the old lander: a small robotic one on three legs --------------------------
  const lander = new THREE.Group();
  const ly = terrain.heightAt(lsite.x, lsite.z);
  lander.position.set(lsite.x, ly, lsite.z);
  lander.rotation.y = -0.4;
  group.add(lander);
  const lf = [], lw = [], ld = [];
  const bodyY = 1.05;
  const hex = new THREE.CylinderGeometry(0.75, 0.8, 0.62, 6);
  hex.translate(0, bodyY, 0);
  lf.push(hex);
  lw.push(at(new THREE.CylinderGeometry(0.68, 0.72, 0.08, 6), 0, bodyY + 0.35, 0));
  // Engine bell under the body.
  ld.push(at(new THREE.CylinderGeometry(0.16, 0.3, 0.32, 14, 1, true), 0, bodyY - 0.47, 0));
  // Three legs with round pads, sunk a little into the dust.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const top = new THREE.Vector3(Math.cos(a) * 0.6, bodyY - 0.1, Math.sin(a) * 0.6);
    const px = Math.cos(a) * 1.45;
    const pz = Math.sin(a) * 1.45;
    const ry = lander.rotation.y;
    const pyW = terrain.heightAt(lsite.x + px * Math.cos(ry) + pz * Math.sin(ry), lsite.z - px * Math.sin(ry) + pz * Math.cos(ry));
    const foot = new THREE.Vector3(px, pyW - ly + 0.04, pz);
    lw.push(strut(top, foot, 0.035));
    lw.push(strut(new THREE.Vector3(Math.cos(a) * 0.5, bodyY - 0.3, Math.sin(a) * 0.5), foot.clone().lerp(top, 0.3), 0.022));
    ld.push(at(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 14), foot.x, foot.y - 0.02, foot.z));
  }
  // Instrument deck: a dish and a small mast camera.
  lw.push(at(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), 0.35, bodyY + 0.68, 0.1));
  const dish2 = new THREE.LatheGeometry(dishPts.map((q) => q.clone().multiplyScalar(1.3)), 20);
  dish2.rotateX(-0.7);
  dish2.translate(0.35, bodyY + 1.0, 0.1);
  lw.push(dish2);
  ld.push(at(new THREE.BoxGeometry(0.12, 0.1, 0.14), -0.3, bodyY + 0.62, -0.2));
  lw.push(at(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), -0.3, bodyY + 0.5, -0.2));
  const lpanel = at(new THREE.BoxGeometry(1.0, 0.025, 0.6), -0.1, bodyY + 0.45, 0.62, -0.55, 0, 0);
  addMesh(lf, foil, lander);
  addMesh(lw, white, lander);
  addMesh(ld, dark, lander);
  addMesh([lpanel], cells, lander);

  return {
    group,
    colliders: [
      { x: site.x, z: site.z, r: 0.75 },
      { x: lsite.x, z: lsite.z, r: 1.1 },
    ],
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      for (const m of [foil, white, dark, cells, refl]) m.dispose();
      cellsT.dispose(); reflT.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Europa: the drill rig (hers, cel-shaded like the ship)
// ---------------------------------------------------------------------------

function inkHull(geo, s = 1.05) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  m.scale.setScalar(s);
  return m;
}

export function createDrillRig() {
  const group = new THREE.Group();
  group.name = 'drillRig';
  const cream = makeGirlToon({ vertexColors: false, rim: 0.25 });
  cream.color.set(SHIP_PALETTE.hull);
  const orange = makeGirlToon({ vertexColors: false, rim: 0.2 });
  orange.color.set(SHIP_PALETTE.accent);
  const dark = makeGirlToon({ vertexColors: false, rim: 0.2 });
  dark.color.set(SHIP_PALETTE.dark);
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.9, roughness: 0.25 });
  const mats = [cream, orange, dark, steel];
  const geos = [];
  const G = (g) => { geos.push(g); return g; };

  const HEAD_Y = 1.25;
  // Head: motor housing.
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  group.add(head);
  const houseG = G(new THREE.CylinderGeometry(0.2, 0.24, 0.34, 20));
  const house = new THREE.Mesh(houseG, cream);
  house.add(inkHull(houseG, 1.06));
  head.add(house);
  const capG = G(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 20));
  const cap = new THREE.Mesh(capG, orange);
  cap.position.y = 0.22;
  cap.add(inkHull(capG, 1.08));
  head.add(cap);
  const bandG = G(new THREE.TorusGeometry(0.235, 0.022, 8, 32));
  bandG.rotateX(Math.PI / 2);
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1, 0.6).multiplyScalar(3) });
  mats.push(lightMat);
  const band = new THREE.Mesh(bandG, lightMat);
  band.position.y = -0.08;
  head.add(band);
  // Handles either side (she leans on them).
  for (const s of [-1, 1]) {
    const hg = G(new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI));
    const h = new THREE.Mesh(hg, dark);
    h.position.set(s * 0.3, -0.05, 0);
    h.rotation.set(0, Math.PI / 2, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    head.add(h);
  }
  // Drill string + bit (spins, descends).
  const bit = new THREE.Group();
  head.add(bit);
  const rodG = G(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10));
  rodG.translate(0, -0.65 - 0.17, 0);
  bit.add(new THREE.Mesh(rodG, steel));
  // Auger flutes: a twisted flat strip.
  const flute = G(new THREE.BoxGeometry(0.13, 1.1, 0.012, 1, 40, 1));
  {
    const p = flute.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const a = y * 11;
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
    }
    flute.computeVertexNormals();
    flute.translate(0, -0.55 - 0.3, 0);
  }
  bit.add(new THREE.Mesh(flute, steel));
  const tipG = G(new THREE.ConeGeometry(0.06, 0.14, 10));
  tipG.rotateX(Math.PI);
  tipG.translate(0, -1.47, 0);
  bit.add(new THREE.Mesh(tipG, steel));

  // Three legs, hinged at the head.
  const legs = [];
  const legLen = 1.5;
  const legG = G(new THREE.CylinderGeometry(0.03, 0.035, legLen, 8));
  legG.translate(0, -legLen / 2, 0);
  const footG = G(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 12));
  footG.translate(0, -legLen, 0);
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 6;
    head.add(pivot);
    const leg = new THREE.Group();
    pivot.add(leg);
    const lm = new THREE.Mesh(legG, orange);
    lm.add(inkHull(legG, 1.12));
    leg.add(lm);
    leg.add(new THREE.Mesh(footG, dark));
    legs.push(leg);
  }
  group.traverse((o) => { if (o.isMesh && o.material !== lightMat && o.material.side !== THREE.BackSide) o.castShadow = true; });

  let unfold = 0, unfoldT = 0;
  let depth = 0;
  let spin = 0;
  let spinRate = 0;
  function update(dt, { drilling = false, progress = 0, done = false } = {}) {
    unfold += (unfoldT - unfold) * Math.min(1, dt * 5);
    // Folded: legs hang together under the head; open: splayed ~33 degrees.
    for (const l of legs) l.rotation.x = -0.58 * unfold;
    group.visible = unfoldT > 0 || unfold > 0.01;
    spinRate += ((drilling ? 28 : done ? 0 : 0) - spinRate) * Math.min(1, dt * 4);
    spin += spinRate * dt;
    bit.rotation.y = spin;
    depth += (progress * 1.0 - depth) * Math.min(1, dt * 6);
    bit.position.y = -depth * 0.95 + (done ? Math.min(0.9, (depth - 0.9) * 0) : 0);
    const c = done ? new THREE.Color(0.35, 0.8, 1.2) : drilling ? new THREE.Color(1.2, 0.7, 0.25) : new THREE.Color(0.4, 1, 0.6);
    lightMat.color.copy(c).multiplyScalar(done ? 2.2 : 2.6 + (drilling ? Math.sin(performance.now() * 0.02) : 0));
  }

  return {
    group,
    headY: HEAD_Y,
    open() { unfoldT = 1; },
    get opened() { return unfold > 0.95; },
    update,
    /** See-through (0..1) while it stands between the camera and her (surface.js). */
    setFade(a) {
      const see = a < 0.99;
      group.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.transparent !== see) { m.transparent = see; m.depthWrite = !see; m.needsUpdate = true; }
        m.opacity = see ? a : 1;
      });
    },
    retract() { depth = 0.2; },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); group.traverse((o) => { if (o.material?.side === THREE.BackSide) o.material.dispose(); }); },
  };
}

/** The hole the drill leaves: a dark disc that glows blue once it reaches water. */
export function createDrillHole() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(10,20,30,1)');
  grd.addColorStop(0.35, 'rgba(20,34,48,1)');
  grd.addColorStop(0.5, 'rgba(120,150,170,0.8)');
  grd.addColorStop(1, 'rgba(200,215,225,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(0.7, 0.7);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.receiveShadow = true;
  // The water glow, additive.
  const glowMat = new THREE.MeshBasicMaterial({
    map: tex, color: new THREE.Color(0.2, 0.7, 1.0).multiplyScalar(0), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(geo, glowMat);
  glow.position.y = 0.005;
  glow.scale.setScalar(0.55);
  glow.renderOrder = 3;
  mesh.add(glow);
  mesh.scale.setScalar(0.001);
  let open = 0, openT = 0, water = 0, waterT = 0, t = 0;
  return {
    mesh,
    setOpen(v) { openT = v; },
    setWater(v) { waterT = v; },
    update(dt) {
      t += dt;
      open += (openT - open) * Math.min(1, dt * 3);
      water += (waterT - water) * Math.min(1, dt * 2);
      mesh.scale.setScalar(Math.max(0.001, open));
      glowMat.color.setRGB(0.25, 0.75, 1.0).multiplyScalar(water * (3.5 + 0.8 * Math.sin(t * 5)));
    },
    dispose() { geo.dispose(); mat.dispose(); glowMat.dispose(); tex.dispose(); },
  };
}
