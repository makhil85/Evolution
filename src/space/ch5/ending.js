// Chapter 5's ending (~22 s, skippable): the rock ship hangs beside her
// ship; she flies in through the hangar door; the engine's magnet rings
// light one by one and the engine fires; the rock moves off; then the
// screen fades to "Coming next: Chapter 6".
//
// Flight is paused; the rock ship is built for the scene and removed after.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { t as lvl } from '../level.js';

const R = 36; // the rock's radius in scene units (about 140 m across)
const DURATION = 22;

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

/** @returns {Promise<void>} */
export function playCh5Ending(game) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({ eyebrow: lvl('Chapter 5 · The end', 'The end of Chapter 5'), title: lvl('The rock ship', 'The rock ship'), sub: lvl('Engine half: built and tested', 'The engine works!'), startBlack: false });
  let next = null; // the "Coming next: Chapter 6" card, over black
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;

  // Calm the sky: no warp streaks while the camera floats about.
  game.warpIndex = 0;
  const ship = buildRockShip();
  // Light: the Sun is at the scene's (-x, 0, -z) of her position. The rock
  // hangs off to her side and a little away from the Sun, so looking at it
  // from her ship the sunlight comes from behind the camera.
  const S = new THREE.Vector3(-game.ship.x, 0, -game.ship.z).normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x);
  const up = new THREE.Vector3(0, 1, 0);
  const rockAt = P.clone().multiplyScalar(170).addScaledVector(S, -70).add(new THREE.Vector3(0, 8, 0));
  ship.group.position.copy(rockAt);
  // Hangar door (local -Z) towards her: +Z points away from her.
  ship.group.lookAt(rockAt.clone().multiplyScalar(2));
  scene.add(ship.group);
  // Out here the Sun is faint: a soft fill and a key light from the Sun's side
  // so the rock reads, only for this scene.
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.55);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.8);
  key.position.copy(rockAt).addScaledVector(S, 400).add(new THREE.Vector3(0, 150, 0));
  key.target = ship.group;
  scene.add(fill, key);
  const hangarWorld = () => ship.door.getWorldPosition(new THREE.Vector3());

  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 3); });
  setTimeout(() => overlay.bars(true), 100);

  const camPos = new THREE.Vector3(); const look = new THREE.Vector3();
  const shipStart = new THREE.Vector3();
  const shipQuat = shipView.group.quaternion.clone();
  const fwd = new THREE.Vector3().set(0, 0, -1).applyQuaternion(ship.group.quaternion);
  const back = fwd.clone().negate();
  const toRock = rockAt.clone().normalize();
  const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
  if (side.dot(S) < 0) side.negate(); // the sunny side
  // From t = 10 the camera holds still beside the rock and watches it go.
  const sideCam = rockAt.clone().addScaledVector(side, 260).addScaledVector(up, 50).addScaledVector(fwd, 60);
  let speed = 0; let travelled = 0;
  game.cinematic = {
    hideMarkers: true,
    hidePath: true,
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      const time = t;
      ship.group.updateMatrixWorld(true);
      const door = hangarWorld();
      // 5-10: she flies in through the hangar door.
      const fly = ease((t - 5) / 5);
      shipView.group.position.lerpVectors(shipStart, door, fly);
      shipView.group.visible = fly < 0.97;
      shipView.group.lookAt(door.clone().multiplyScalar(2)); // nose to the door
      shipView.setThrottle(t > 5 && t < 9.5 ? 0.6 : 0);
      ship.door.material.opacity = 0.2 + 0.6 * Math.max(0, Math.sin(Math.min(1, (t - 4) / 7) * Math.PI));
      // 10-13: the rings light; 13+: the engine fires and the rock moves off.
      ship.setRings(Math.max(0, Math.min(1, (t - 10) / 3)));
      ship.setFlame(ease((t - 13) / 1.2), time);
      if (t > 14) { speed += dt * 7; travelled += speed * dt; }
      ship.group.position.copy(rockAt).addScaledVector(fwd, travelled);
      const center = ship.group.position;
      if (t < 5) {
        // The reveal: from just behind her ship, swinging out to show the rock.
        const k = ease(t / 5);
        camPos.copy(toRock).multiplyScalar(-14 - 10 * k).addScaledVector(S, 5 + 20 * k).addScaledVector(up, 4 + 6 * k);
        look.copy(center).lerp(shipView.group.position, 0.25 * (1 - k));
      } else if (t < 10) {
        // Chase her in.
        const sp = shipView.group.position;
        const toDoor = door.clone().sub(sp).normalize();
        camPos.copy(sp).addScaledVector(toDoor, -22).addScaledVector(up, 7).addScaledVector(S, 6);
        look.copy(door);
      } else {
        camPos.copy(sideCam);
        // Only half-follow it, so the rock is seen to move off.
        look.copy(rockAt).addScaledVector(back, 30).lerp(center, 0.4);
      }
      // Ease in from the flight camera, then plain cuts between the three shots.
      blendCamera(camera, camPos, look, t < 5 ? ease(t / 1.5) : 1);
      if (t > 1 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 4.5 && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t > 18 && !overlay._c) { overlay._c = true; overlay.darken(); }
      if (t > 19 && !next) {
        next = buildOverlay({ eyebrow: lvl('Coming next', 'Coming next'), title: lvl('Chapter 6: The Crew', 'Chapter 6: The Crew'), sub: lvl('The other half of the ship, and the friends who fly it', 'New friends join the trip!'), startBlack: true });
        next.showTitle();
      }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    scene.remove(ship.group, fill, key);
    ship.dispose();
    shipView.group.position.set(0, 0, 0);
    shipView.group.quaternion.copy(shipQuat);
    shipView.group.visible = true;
    shipView.setThrottle(0);
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => { overlay.remove(); next?.remove(); }, 1500);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
