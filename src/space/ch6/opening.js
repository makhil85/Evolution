// Chapter 6's opening (~18 s, skippable) and Rock B beside her in flight.
//
// The half-built rock ship hangs beside her own ship in the Kuiper belt.
// A supply ship from Earth comes in out of the dark, slows, and docks at the
// rock's hangar door; the title "Chapter 6: The Long Trip" comes up.
//
// The flight scene is ship-centred (her ship at the origin) and she does not
// fly in Chapter 6 until the route is planned, so the rock simply hangs at a
// fixed offset beside her (showRockB). Same cutscene contract as Chapter 5's
// ending: flight paused, own objects and lights, game.cinematic with calm.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { buildRockShip } from '../ch5/ending.js';
import { t as lvl } from '../level.js';

const DURATION = 18;

/** Where Rock B hangs, relative to her ship: off to the side, a little away from the Sun. */
function rockOffset(game) {
  const S = new THREE.Vector3(-(game.ship?.x ?? 1), 0, -(game.ship?.z ?? 0));
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x);
  return { S, P, at: P.clone().multiplyScalar(150).addScaledVector(S, -60).add(new THREE.Vector3(0, 6, 0)) };
}

/**
 * Rock B in the flight scene, beside her (idempotent). Lights it softly from
 * the Sun's side so it reads out here. Returns { rock, remove() }.
 */
export function showRockB(game) {
  if (game._rockB) return game._rockB;
  const { scene } = game;
  const rock = buildRockShip();
  rock.setRings(1);
  const { S, at } = rockOffset(game);
  rock.group.position.copy(at);
  rock.group.lookAt(at.clone().multiplyScalar(2)); // hangar door (local -Z) towards her
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.5);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.copy(at).addScaledVector(S, 400).add(new THREE.Vector3(0, 150, 0));
  key.target = rock.group;
  scene.add(rock.group, fill, key);
  game._rockB = {
    rock,
    remove() { scene.remove(rock.group, fill, key); rock.dispose(); game._rockB = null; },
  };
  return game._rockB;
}

/** The supply ship: a white capsule with a cargo ring, an orange band and lights. */
function buildSupplyShip() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 32), white); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = -Math.PI / 2; nose.position.z = -9; g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.05, 2, 32), orange); band.rotation.x = Math.PI / 2; band.position.z = -3; g.add(band);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.8, 10, 40), dark); ring.position.z = 3; g.add(ring);
  for (let i = 0; i < 4; i++) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 4), orange);
    const a = (i / 4) * Math.PI * 2; pod.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 3); g.add(pod);
  }
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3, 4, 20, 1, true), dark); bell.rotation.x = Math.PI / 2; bell.position.z = 11; g.add(bell);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb347).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14, 20, 1, true), flameMat); flame.rotation.x = -Math.PI / 2; flame.position.z = 20; g.add(flame);
  const lights = [];
  for (const [x, y, c] of [[4.1, 0, 0x7fff9f], [-4.1, 0, 0xff6b6b]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) }));
    l.position.set(x, y, -2); g.add(l); lights.push(l);
  }
  g.scale.setScalar(0.55);
  return {
    group: g,
    setFlame(k, time) { flameMat.opacity = Math.min(1, k) * 0.8; flame.scale.set(1, Math.max(0.01, k) * (0.9 + 0.1 * Math.sin(time * 30)), 1); },
    blink(time) { for (const l of lights) l.visible = Math.sin(time * 5) > 0; },
    dispose() { g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
  };
}

/** @returns {Promise<void>} */
export function playCh6Opening(game) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({ eyebrow: lvl('Chapter 6', 'Chapter 6'), title: lvl('The Long Trip', 'The Long Trip'), sub: lvl('A crew for the stars', 'New friends for the trip!'), startBlack: true });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;
  const { rock } = showRockB(game);
  const supply = buildSupplyShip();
  scene.add(supply.group);
  const shipLight = new THREE.PointLight(0xffffff, 2, 300, 1.2);
  scene.add(shipLight);
  const door = () => rock.door.getWorldPosition(new THREE.Vector3());
  rock.group.updateMatrixWorld(true);
  const dock = door();
  const rockC = rock.group.position.clone();
  const out = dock.clone().sub(rockC).normalize(); // out of the hangar door
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(out, up).normalize();
  const start = dock.clone().addScaledVector(out, 900).addScaledVector(side, 300).addScaledVector(up, 80);
  const hold = dock.clone().addScaledVector(out, 30);

  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 2.5); });
  setTimeout(() => { overlay.light(); overlay.bars(true); }, 300);
  const camPos = new THREE.Vector3(); const look = new THREE.Vector3(); const pos = new THREE.Vector3();
  game.cinematic = {
    calm: true,
    hideMarkers: true,
    hidePath: true,
    get t() { return t; },
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      // 0-11: in from the dark, slowing; 11-15: the last few metres into the door.
      const k1 = ease(t / 11);
      pos.lerpVectors(start, hold, k1);
      if (t > 11) pos.lerpVectors(hold, dock, ease((t - 11) / 4));
      supply.group.position.copy(pos);
      supply.group.lookAt(pos.clone().add(dock.clone().sub(t < 11 ? start : hold).normalize().multiplyScalar(-10)));
      supply.setFlame(t < 9 ? 0.8 * (1 - k1 * 0.6) : 0, t);
      supply.blink(t);
      supply.group.visible = t < 15.2;
      shipLight.position.copy(pos).add(new THREE.Vector3(0, 30, 0));
      // Camera: from behind her ship, watching it come in past the rock.
      camPos.copy(rockC).addScaledVector(out, 260).addScaledVector(side, -160).addScaledVector(up, 60);
      look.copy(rockC).lerp(pos, 0.55);
      blendCamera(camera, camPos, look, ease(t / 2));
      if (t > 1.5 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 6 && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };
  return done.finally(() => {
    scene.remove(supply.group, shipLight);
    supply.dispose();
    shipView.group.visible = true;
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1500);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
