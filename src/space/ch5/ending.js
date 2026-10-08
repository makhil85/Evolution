// The engine's first test fire, Chapter 6's big cutscene (~24 s, skippable).
// It plays after the workshop, when the engine half is built.
//
// 1. DRILLING (0-9 s). Rock B (buildRockShip's rock) is sized to the starship's
//    cap. Three mining drones cut it: laser lines, sparks, dust and chunks fly
//    off. The rock flattens along the ship's axis into a thin cap. Meanwhile the
//    starship grows out of that cap, backwards, so its hull stands behind it.
//    The rock fades: the starship's own cap is where it was.
// 2. TEST FIRE (9-22 s). The ring spins up, the magnet rings light one by one,
//    the plume grows, the field glows, and the camera shakes at ignition.
// 3. One camera path the whole way, from close on the drilling to a wide 3/4
//    view of the ship firing, with her small ship in the frame for scale.
//
// The starship is built here at FLIGHT_LENGTH (ch6/starship.js) and removed
// after: Chapter 6's next step shows its own copy. Flight is paused; her ship
// stays at the origin and turns to watch.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { createStarship, FLIGHT_LENGTH } from '../ch6/starship.js';
import { t as lvl } from '../level.js';

const R = 36; // the rock's radius in its own units (the scene shrinks it to the cap)
const DURATION = 24;
const FIRE_AT = 9; // the rock is gone; the test fire starts
const IGNITION = 14; // the engine is at full drive
const CAP_Z = -135; // the starship's cap centre, in its own metres (ch6/starship.js)
const UP = new THREE.Vector3(0, 1, 0);
const LASER = new THREE.Color(0x7ff3ff).multiplyScalar(3);

/** The rock ship: a lumpy icy rock, a hangar door in front, the drive behind. */
export function buildRockShip() {
  const g = new THREE.Group();
  g.name = 'rock-ship';
  // Shared corners (mergeVertices), so the normals come out smooth.
  const ico = new THREE.IcosahedronGeometry(1, 14);
  ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
  const geo = mergeVertices(ico);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.09 * Math.sin(v.x * 5.1 + v.y * 2.3) + 0.06 * Math.sin(v.y * 7.7 - v.z * 3.1) + 0.04 * Math.sin(v.z * 13 + v.x * 4);
    const crater = Math.max(0, 0.06 - Math.abs(Math.sin(v.x * 9) * Math.sin(v.z * 8))) * -1.2;
    v.multiplyScalar(R * (n + crater));
    v.z *= 1.25; // a little longer than wide
    p.setXYZ(i, v.x, v.y, v.z);
    // Grey-brown rock with soft patches of ice.
    const n2 = 0.5 + 0.5 * Math.sin(v.x * 0.21 + 1.3) * Math.sin(v.y * 0.17 - 0.4) * Math.sin(v.z * 0.13 + 2.2);
    const ice = Math.max(0, Math.min(1, (n2 - 0.55) * 5));
    const grit = 0.9 + 0.1 * Math.sin(v.x * 1.7 + v.y * 2.9 + v.z * 1.1);
    col.set([(0.36 + 0.36 * ice) * grit, (0.33 + 0.43 * ice) * grit, (0.3 + 0.52 * ice) * grit], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  g.add(rock);
  // Hangar door (front, -Z) and a few lit windows.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(1.5), transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
  door.position.set(0, 2, -R * 1.25 - 0.5);
  door.rotation.y = Math.PI;
  g.add(door);
  for (let i = 0; i < 9; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c0).multiplyScalar(2) }));
    const a = -0.9 + i * 0.22;
    w.position.set(Math.sin(a) * R * 1.02, 6 + (i % 3) * 3, -Math.cos(a) * R * 0.9);
    w.lookAt(w.position.clone().multiplyScalar(2));
    g.add(w);
  }
  // The drive (back, +Z): a bell, four magnet rings, and the flame.
  const metal = new THREE.MeshStandardMaterial({ color: 0xaab6c4, metalness: 0.6, roughness: 0.35 });
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(7, 13, 16, 32, 1, true), metal);
  bell.rotation.x = Math.PI / 2;
  bell.position.z = R * 1.25 + 6;
  g.add(bell);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x334455 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10 + i * 0.8, 1.1, 10, 48), ringMat);
    ring.position.z = R * 1.25 - 2 + i * 4;
    g.add(ring);
    rings.push(ring);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(11, 90, 32, 1, true), flameMat);
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = R * 1.25 + 14 + 45;
  g.add(flame);
  return {
    group: g, door, rings, flame,
    /** 0..1: how many rings are lit (in order). */
    setRings(k) { rings.forEach((r, i) => r.material.color.set(k * 4 > i + 0.5 ? new THREE.Color(0x7ff3ff).multiplyScalar(2.5) : new THREE.Color(0x334455))); },
    setFlame(k, time) { flameMat.opacity = Math.min(1, k) * 0.85; flame.scale.set(1 + 0.04 * Math.sin(time * 40), Math.max(0.01, k) * (0.9 + 0.1 * Math.sin(time * 23)), 1 + 0.04 * Math.sin(time * 31)); },
    dispose() { g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
  };
}

/** A rim point of the rock (its own space): the vertex nearest an angle, on the equator. */
function rimPoint(geo, angle) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const best = new THREE.Vector3();
  let bestScore = Infinity;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(v.y, v.x) - angle), Math.cos(Math.atan2(v.y, v.x) - angle)));
    const score = d + (1.5 * Math.abs(v.z)) / (1.25 * R);
    if (score < bestScore) { bestScore = score; best.copy(v); }
  }
  return best;
}

/** A soft round dot for the dust puffs. */
function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * The engine's first test fire (Chapter 6, after the workshop). Flight is paused
 * while it plays. Skippable (Space, Enter, Esc or a click after 1.5 s).
 * @returns {Promise<void>} resolves when she has control again
 */
export function playCh5Ending(game, { eyebrow = lvl('Engine half', 'Engine half') } = {}) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({
    eyebrow,
    title: 'Drilling Rock B',
    sub: lvl('The rock is mined down to a thin front shield', 'Only a thin shield is left'),
    startBlack: false,
  });
  const title2 = buildOverlay({
    eyebrow: lvl('Test fire', 'Test fire'),
    title: 'The ship for the stars',
    sub: lvl('The engine fires!', 'Fire!'),
    startBlack: false,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0; // calm sky: no warp streaks while the camera floats about

  // Her frame. S points at the Sun; the starship sits out along P, away from her.
  // Zp is the drive's way (out and away from her); its nose is -Zp.
  const S = new THREE.Vector3(-game.ship.x, 0, -game.ship.z);
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x);
  const Zp = new THREE.Vector3().addScaledVector(P, 0.85).addScaledVector(S, -0.5).normalize();
  const Xs = new THREE.Vector3().crossVectors(UP, Zp).normalize();
  const qShip = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xs, UP, Zp));

  // The starship at its flight size, and the rock at the size of its cap.
  const ship = createStarship({ detail: 'near' });
  const kS = FLIGHT_LENGTH / ship.dims.length;
  const capR = ship.dims.capR * kS; // the cap's radius in scene units (~2.9)
  ship.setRingSpin(0);
  ship.setDrive(0);
  ship.setField(0);
  ship.group.quaternion.copy(qShip);
  ship.group.visible = false;
  // The starship's lit windows and lamps are authored above the bloom threshold
  // (1.25). Up close they make a bright cross that floods the frame, so they are
  // held just under it here (only the plume and the field are left to glow).
  const lamps = [];
  ship.group.traverse((o) => {
    const m = o.material;
    if (o.isMesh && m && m.isMeshBasicMaterial && !m.transparent) lamps.push(m);
  });
  const holdLamps = () => {
    for (const m of lamps) {
      const k = Math.max(m.color.r, m.color.g, m.color.b);
      if (k > 1.2) m.color.multiplyScalar(1.2 / k);
    }
  };

  const rockShip = buildRockShip();
  const rock = rockShip.group;
  const rockMesh = rock.children[0]; // the rock; the door, windows, bell and rings are not used here
  rock.children.forEach((o, i) => { if (i > 0) o.visible = false; });
  const rockMat = rockMesh.material;
  rockMat.transparent = true;
  rock.quaternion.copy(qShip);
  const SXY0 = (capR * 1.13) / R; // the rock's width at the start
  const SXY1 = (capR * 1.05) / R; // and at the end: about the cap's width
  const SZ1 = 0.2 / (1.25 * R); // the rock's z scale at the end: a thin cap, ~0.4 u thick

  // Key points (world space). H is the hub, 30 u out from her; C the cap's centre
  // (the rock's place); M the middle between her ship and the starship.
  const H = P.clone().multiplyScalar(24).addScaledVector(S, -2).add(new THREE.Vector3(0, 2, 0));
  const C = H.clone().addScaledVector(Zp, CAP_Z * kS);
  const M = H.clone().multiplyScalar(0.5);
  // The wide 3/4 view: mostly from the side, a little from the drive's side so the plume trails away.
  const wide = new THREE.Vector3().addScaledVector(Xs, 0.9).addScaledVector(Zp, 0.25).addScaledVector(UP, 0.35).normalize();

  // One camera path: close on the drilling, pulling back past the hull, to the wide 3/4 view.
  const camPath = new THREE.CatmullRomCurve3([
    C.clone().addScaledVector(Xs, 8.5).addScaledVector(UP, 2.6).addScaledVector(Zp, -2.5),
    C.clone().addScaledVector(Xs, 15).addScaledVector(UP, 6).addScaledVector(Zp, 5),
    H.clone().addScaledVector(Xs, 22).addScaledVector(UP, 8).addScaledVector(Zp, -10),
    M.clone().addScaledVector(wide, 40),
    M.clone().addScaledVector(wide, 50),
  ], false, 'centripetal');
  const lookPath = new THREE.CatmullRomCurve3([
    C.clone(),
    C.clone().lerp(H, 0.5),
    H.clone(),
    M.clone().lerp(H, 0.6),
    M.clone().lerp(H, 0.6),
  ], false, 'centripetal');

  // Her ship turns to face the starship, and turns back at the end.
  const shipQuat = shipView.group.quaternion.clone();
  const facer = new THREE.Object3D();
  facer.lookAt(H.clone().negate()); // her nose (-Z) towards the starship
  const faceQuat = facer.quaternion.clone();

  // Light: the Sun's side, and a soft fill, for this scene only.
  // Kept under the bloom threshold (1.25): a lit white toon face sits near 1.
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.4);
  const key = new THREE.DirectionalLight(0xfff1dc, 0.9);
  key.position.copy(H).addScaledVector(S, 300).addScaledVector(UP, 120);
  key.target = ship.group;

  const stage = new THREE.Group();
  const fx = new THREE.Group(); // the drilling effects
  stage.add(ship.group, rock, fx, fill, key);
  scene.add(stage);

  // --- the drilling -------------------------------------------------------------------
  const cuts = [0.4, 2.3, 4.2].map((a) => rimPoint(rockMesh.geometry, a));
  const at = (i, out) => out.copy(cuts[i]).applyMatrix4(rock.matrixWorld);
  // Outward from the rock's middle, mostly across the cap (not along the ship).
  const outward = (p) => {
    const d = p.clone().sub(C);
    d.addScaledVector(Zp, -0.6 * d.dot(Zp));
    return d.normalize();
  };
  const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true).translate(0, 0.5, 0);
  const laserMat = new THREE.MeshBasicMaterial({ color: LASER, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const bodyGeo = new THREE.BoxGeometry(0.24, 0.1, 0.24);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9e1ea, metalness: 0.6, roughness: 0.35 });
  const glowGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({ color: LASER });
  const drones = cuts.map(() => {
    const g = new THREE.Group();
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = -0.09;
    g.add(new THREE.Mesh(bodyGeo, bodyMat), glow);
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.visible = false;
    fx.add(g, laser);
    return { g, laser };
  });

  // Sparks: additive points. A spark fades by dimming its colour.
  const SPARKS = 60;
  const spPos = new Float32Array(SPARKS * 3);
  const spCol = new Float32Array(SPARKS * 3);
  const spVel = Array.from({ length: SPARKS }, () => new THREE.Vector3());
  const spLife = new Float32Array(SPARKS);
  let spNext = 0;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  fx.add(sparks);
  const spark = (at0, dir) => {
    const i = spNext; spNext = (spNext + 1) % SPARKS;
    spPos.set([at0.x, at0.y, at0.z], i * 3);
    spVel[i].copy(dir).multiplyScalar(1.2 + Math.random()).addScaledVector(new THREE.Vector3().randomDirection(), 0.6);
    spLife[i] = 0.35 + Math.random() * 0.3;
  };
  const updateSparks = (dt) => {
    for (let i = 0; i < SPARKS; i++) {
      if (spLife[i] > 0) {
        spLife[i] = Math.max(0, spLife[i] - dt);
        spVel[i].multiplyScalar(Math.exp(-3 * dt));
        spPos[i * 3] += spVel[i].x * dt; spPos[i * 3 + 1] += spVel[i].y * dt; spPos[i * 3 + 2] += spVel[i].z * dt;
        const k = Math.min(1, spLife[i] / 0.4);
        spCol.set([3 * k, 1.5 * k, 0.45 * k], i * 3);
      } else {
        spCol.set([0, 0, 0], i * 3);
      }
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.color.needsUpdate = true;
  };

  // Dust puffs: soft sprites that spread and fade.
  const dustTex = dustTexture();
  const dust = Array.from({ length: 8 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xb0a292, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    fx.add(s);
    return { s, age: 0, life: 0 };
  });
  let dustNext = 0;
  const puff = (at0) => {
    const d = dust[dustNext]; dustNext = (dustNext + 1) % dust.length;
    d.s.position.copy(at0);
    d.s.visible = true; d.age = 0; d.life = 1.1;
  };

  // Chunks: little rocks that fly off the cut and fade.
  const chunkGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const chunks = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(chunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1, transparent: true }));
    m.visible = false;
    fx.add(m);
    return { m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 };
  });
  let chunkNext = 0;
  const chunk = (at0, dir) => {
    const c = chunks[chunkNext]; chunkNext = (chunkNext + 1) % chunks.length;
    c.m.position.copy(at0);
    c.m.scale.setScalar(0.7 + Math.random() * 0.8);
    c.m.material.color.set(Math.random() < 0.4 ? 0xdfeaf0 : 0x8a8478);
    c.m.material.opacity = 1;
    c.m.visible = true;
    c.vel.copy(dir).multiplyScalar(1.6 + Math.random()).addScaledVector(UP, 0.6);
    c.spin.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
    c.life = 1.8;
  };
  const updateChunks = (dt) => {
    for (const c of chunks) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vel.multiplyScalar(Math.exp(-0.7 * dt));
      c.m.position.addScaledVector(c.vel, dt);
      c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt;
      c.m.material.opacity = Math.min(1, c.life / 0.6);
      if (c.life <= 0) c.m.visible = false;
    }
  };

  // Shots of the camera and the look, on one path (see camPath above).
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const cut = new THREE.Vector3();
  const emitter = new THREE.Vector3();
  const station = new THREE.Vector3();

  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 2.5); });
  setTimeout(() => overlay.bars(true), 100);
  const once = new Set();
  const beat = (k, when, fn) => { if (t > when && !once.has(k)) { once.add(k); fn(); } };

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      const working = t > 1.3 && t < 8.6;

      // The starship grows out of its cap: pivot on the cap, stretched backwards.
      const grow = Math.max(0.001, ease((t - 1.2) / 7.8));
      ship.group.visible = t > 1.2;
      ship.group.scale.set(kS, kS, kS * grow);
      ship.group.position.copy(C).addScaledVector(Zp, -CAP_Z * kS * grow);
      ship.setRingSpin(0.3 * ease((t - FIRE_AT) / 4));
      ship.setDrive(ease((t - 10) / 4));
      ship.setField(0.6 * ease((t - 13.5) / 1.5) * (1 - 0.4 * ease((t - 19) / 2)));
      ship.update(dt, t);
      holdLamps();

      // The rock: it shrinks, flattens into a thin cap, then fades out.
      rock.visible = t < FIRE_AT;
      rock.position.copy(C);
      const sxy = THREE.MathUtils.lerp(SXY0, SXY1, ease(t / FIRE_AT));
      rock.scale.set(sxy, sxy, THREE.MathUtils.lerp(SXY0, SZ1, ease(t / 8.4)));
      rockMat.opacity = 1 - ease((t - 7.8) / 1.0);
      rock.updateMatrixWorld(true);

      // The drones: they arrive, cut, and lift off.
      drones.forEach((d, i) => {
        at(i, cut);
        const out = outward(cut);
        station.copy(cut).addScaledVector(out, 1.0).addScaledVector(UP, 0.8);
        const start = station.clone().addScaledVector(out, 6).addScaledVector(UP, 4);
        const arrive = ease((t - 0.2 - i * 0.2) / 2.2);
        d.g.position.lerpVectors(start, station, arrive).addScaledVector(UP, 0.12 * Math.sin(t * 3.1 + i * 2));
        d.g.position.addScaledVector(UP, 4 * ease((t - 8.2) / 1.2));
        d.g.visible = t < 9.4;
        emitter.copy(d.g.position).addScaledVector(UP, -0.09);
        const dir = cut.clone().sub(emitter);
        const len = dir.length();
        d.laser.visible = working && arrive > 0.5 && len > 0.01;
        d.laser.position.copy(emitter);
        d.laser.quaternion.setFromUnitVectors(UP, dir.normalize());
        const flick = 1 + 0.22 * Math.sin(t * 61 + i * 7) + 0.1 * Math.sin(t * 23 + i);
        d.laser.scale.set(flick, len, flick);
        if (working && arrive > 0.5) {
          if (Math.random() < dt * 22) spark(cut, out);
          if (Math.random() < dt * 2.5) puff(cut);
        }
      });
      if (working && Math.random() < dt * 1.7) {
        at(Math.floor(Math.random() * cuts.length), cut);
        chunk(cut, outward(cut));
      }
      updateSparks(dt);
      updateChunks(dt);
      for (const d of dust) {
        if (!d.s.visible) continue;
        d.age += dt;
        if (d.age >= d.life) { d.s.visible = false; continue; }
        const k = d.age / d.life;
        d.s.scale.setScalar(0.5 + 1.8 * k);
        d.s.material.opacity = 0.5 * (1 - k);
      }

      // Her ship turns to face the starship; it turns back at the end.
      shipView.group.quaternion.slerpQuaternions(shipQuat, faceQuat, ease(t / 2) * (1 - ease((t - 21.5) / 2)));

      // The camera: one path, eased at both ends. A short shake at ignition.
      const u = 0.5 * (t / DURATION) + 0.5 * ease(t / DURATION);
      camPos.copy(camPath.getPoint(u));
      look.copy(lookPath.getPoint(u));
      const shake = t > IGNITION ? 0.35 * Math.max(0, 1 - (t - IGNITION) / 2.4) : 0;
      camPos.x += Math.sin(t * 67) * shake; camPos.y += Math.cos(t * 53) * shake; camPos.z += Math.sin(t * 41) * shake * 0.5;
      // Ease in from the flight camera, and out to it at the end.
      const w = Math.min(ease(t / 1.5), 1 - ease((t - (DURATION - 1.5)) / 1.5));
      blendCamera(camera, camPos, look, w);

      beat('t1', 0.8, () => overlay.showTitle());
      beat('t2', 4.2, () => overlay.hideTitle());
      beat('t3', 10.4, () => title2.showTitle());
      beat('t4', 15.6, () => title2.hideTitle());
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    title2.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => { overlay.remove(); title2.remove(); }, 1500);
    scene.remove(stage);
    ship.dispose();
    rockShip.dispose();
    stage.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    dustTex.dispose();
    shipView.group.quaternion.copy(shipQuat);
    shipView.group.position.set(0, 0, 0);
    shipView.setThrottle(0);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
