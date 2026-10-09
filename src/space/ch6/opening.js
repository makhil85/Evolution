// Chapter 6's opening (~18 s, skippable), Rock B in the engine step, and the
// ship for the stars beside her in flight.
//
// The starship (starship.js) hangs beside her own ship in the Kuiper belt,
// pointing the way she flies, with its docking port (+X) facing her. In the
// opening a supply ship from Earth comes in along the port's side, slows with
// small braking puffs and docks softly at the hub. The camera starts wide,
// drifts round as the supply ship comes in, and ends close on the docking; the
// title "Chapter 6: The Long Trip" comes up.
//
// The flight scene is ship-centred (her ship at the origin) and she does not
// fly in Chapter 6 until the route is planned, so the starship simply hangs at a
// fixed offset beside her. The cutscene works in the starship's own frame, in
// metres, so the supply ship and the camera keep the starship's proportions.
// Same cutscene contract as Chapter 5's ending: flight paused, own objects and
// lights, game.cinematic with calm.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { buildRockShip } from '../ch5/ending.js';
import { createStarship, FLIGHT_LENGTH } from './starship.js';
import { toonRamp, outlineMaterial } from '../../game/toonPipeline.js';
import { t as lvl } from '../level.js';

const DURATION = 18;
// Scene units: the starship hangs this far to the side of her ... and this far
// ahead, so her chase camera sees it about 18 degrees off her heading, clear of the HUD.
const STAR_SIDE = 18;
const STAR_AHEAD = 55;
const PORT_R = 20.4; // the docking collar's lit ring, in metres from the hub (starship.js)
const SUPPLY_NOSE = -17.5; // the supply ship's docking probe, in its own metres (nose -Z)
const SUPPLY_TAIL = 16.5; // its bell
// Docked, its probe tip is 0.5 m past the port's ring. It is 34 m long, about
// 1/11 of the starship: any longer and its tail would reach the habitat ring
// (58 m from the hub) on the way in.
const DOCK_X = PORT_R + 0.5 - SUPPLY_NOSE;
// The supply ship's path, in the starship's metres: it comes in along the port's
// side, out of the dark, nose on the hub. It runs at z = 38, past the ring's open
// end (its wings, 21.6 m out, clear the ring's 11 m half-depth), and is inside the
// ring's radius before it slides onto the port.
const APPROACH = [[200, 30, 38], [60, 3, 38], [41, 0, 38], [DOCK_X, 0, 0]];
// The camera, in the starship's metres: [position, look] at 0, 6, 12 and 18 s.
// Wide at first (the whole starship in frame), round by the port as the
// supply ship comes in, then close enough on the docking to read it (the ring
// stays at the edge of the frame), with a little drift to the end.
const CAM = [
  [[447, 0, 1631], [330, 0, 500]], // the starship and the supply ship in frame, about 360 m from the hub
  [[380, 140, 260], [140, 10, 40]],
  [[100, 60, 150], [30, 0, 5]],
  [[90, 45, 130], [28, 0, 5]],
];

/** Where Rock B hangs, relative to her ship: off to the side, a little away from the Sun. */
/** Rock B's radius in the flight scene (lead 2026-10-09: smaller than Ceres, whose radius is 7). */
export const ROCK_B_R = 5.4;
const ROCK_NATIVE_R = 36; // buildRockShip's rock radius in its own units (ch5/ending.js R)
const ROCK_K = ROCK_B_R / ROCK_NATIVE_R;

function rockOffset(game) {
  const S = new THREE.Vector3(-(game.ship?.x ?? 1), 0, -(game.ship?.z ?? 0));
  if (S.lengthSq() < 1e-6) S.set(-1, 0, 0);
  S.normalize();
  const P = new THREE.Vector3(-S.z, 0, S.x);
  // Beside her at the same scale as the rock (it was 150 u out at full size, ~6x Ceres).
  return { S, P, at: P.clone().multiplyScalar(150 * ROCK_K).addScaledVector(S, -60 * ROCK_K).add(new THREE.Vector3(0, 6 * ROCK_K, 0)) };
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
  rock.group.scale.setScalar(ROCK_K);
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

/**
 * The starship beside her in the flight scene (idempotent; stored on game._starship).
 * It hangs STAR_SIDE to one side of her and STAR_AHEAD ahead, pointing the way she
 * flies (its cap at the front), with its port facing her. Lit from the Sun's side
 * with a soft fill; its ring turns slowly, its lights are on and its field faint.
 * Its update runs every frame from a requestAnimationFrame loop until remove().
 * Returns { ship, remove() }, where ship is the createStarship handle.
 */
export function showStarship(game) {
  if (game._starship) return game._starship;
  const { scene } = game;
  const ship = createStarship({ detail: 'near' });
  const { group } = ship;
  group.scale.setScalar(FLIGHT_LENGTH / ship.dims.length);
  const { S } = rockOffset(game); // towards the Sun
  const a = game.ship?.angle ?? 0;
  const H = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); // her heading, as the flight scene draws it
  // The port faces her, on the side nearer the Sun, so the docking is lit.
  const port = new THREE.Vector3(-H.z, 0, H.x);
  if (port.dot(S) < 0) port.negate();
  const Z = H.clone().negate(); // the cap points where she flies
  const Y = new THREE.Vector3().crossVectors(Z, port);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(port, Y, Z));
  group.position.copy(port).multiplyScalar(-STAR_SIDE).addScaledVector(H, STAR_AHEAD);
  group.updateMatrixWorld(true);

  // The Sun is already a strong point light (3.2, no falloff), and the pale hull
  // bloomed when we added a bigger key on top: so our key and fill are soft.
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.2);
  const key = new THREE.DirectionalLight(0xfff1dc, 0.4);
  key.position.copy(group.position).addScaledVector(S, 400).add(new THREE.Vector3(0, 150, 0));
  key.target = group;
  scene.add(group, fill, key);
  ship.setRingSpin(0.12);
  ship.setField(0.25);
  ship.setLights(true);
  ship.setDrive(0);

  // Its own clock, every frame, with real deltas (clamped, so a hidden tab can't jump it).
  let last = performance.now();
  let time = 0;
  let raf = 0;
  const frame = (now) => {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    time += dt;
    ship.update(dt, time);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  game._starship = {
    ship,
    remove() {
      cancelAnimationFrame(raf);
      game._dockedSupply?.remove();
      scene.remove(group, fill, key);
      ship.dispose();
      game._starship = null;
    },
  };
  return game._starship;
}

// An inverted hull: every vertex pushed out along its normal by d metres.
function shellOf(geo, d) {
  const g = geo.clone();
  const p = g.attributes.position; const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  p.needsUpdate = true;
  return g;
}

/**
 * The supply ship from Earth, built in its own metres (nose -Z, 34 m long), so it
 * can join the starship's group and take its scale: a white body with an outline,
 * two solar wings, a cargo ring, four thruster pods, and red and green wing lamps.
 * blink(time) runs the lamps.
 */
function buildSupplyShip() {
  const g = new THREE.Group();
  g.name = 'supply-ship';
  const toon = (color, emissive = 0x000000) => new THREE.MeshToonMaterial({ color, emissive, gradientMap: toonRamp });
  const white = toon(0xf4f7fa, 0x7a8694);
  const orange = toon(0xff8a3d, 0x3a1a08);
  const dark = toon(0x5a6478, 0x2c3440);
  const navy = toon(0x2d4a7a, 0x10203a);
  const mesh = (geo, mat, pos = [0, 0, 0], rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  // The body: a lathe about Z (profile as (radius, z)), the probe tip at SUPPLY_NOSE.
  const BODY = [[0.8, -15.2], [2.2, -14], [3.2, -12], [3.6, -10], [3.6, 8.5], [3.3, 10.5], [2.4, 12.6], [2.0, 14.6], [2.0, SUPPLY_TAIL], [0, SUPPLY_TAIL]];
  const hullGeo = new THREE.LatheGeometry(BODY.map(([r, z]) => new THREE.Vector2(r, z)), 32).rotateX(Math.PI / 2);
  mesh(hullGeo, white);
  mesh(shellOf(hullGeo, 0.22), outlineMaterial);
  mesh(new THREE.CylinderGeometry(3.66, 3.66, 2.2, 32), orange, [0, 0, -9], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 16), dark, [0, 0, -16.2], [Math.PI / 2, 0, 0]); // docking probe
  mesh(new THREE.CylinderGeometry(1.9, 2.3, 1.4, 24, 1, true), dark, [0, 0, 16], [Math.PI / 2, 0, 0]); // nozzle
  mesh(new THREE.TorusGeometry(5.2, 0.7, 10, 36), dark, [0, 0, 4]); // cargo ring
  for (const x of [-1, 1]) mesh(new THREE.BoxGeometry(18, 0.25, 7), navy, [x * 12.6, 0, 1.5]); // solar wings
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    mesh(new THREE.BoxGeometry(1.4, 1.4, 3), orange, [Math.cos(a) * 4.3, Math.sin(a) * 4.3, 10]);
  }
  const lamps = [[-21.6, [1, 0.12, 0.1], 0], [21.6, [0.2, 1, 0.35], 0.5]].map(([x, rgb, off]) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb) });
    mesh(new THREE.SphereGeometry(0.7, 8, 6), mat, [x, 0, 1.5]);
    return { mat, rgb, off };
  });
  return {
    group: g,
    blink(time) {
      for (const l of lamps) {
        const k = ((time * 0.9 + l.off) % 1) < 0.22 ? 2.4 : 0.15;
        l.mat.color.setRGB(l.rgb[0] * k, l.rgb[1] * k, l.rgb[2] * k);
      }
    },
    dispose() {
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.material !== outlineMaterial) o.material.dispose();
      });
    },
  };
}

/**
 * Braking puffs: a small pool of soft spheres that puff out of the probe tip and
 * drift back (the nose thrusters brake a ship that flies nose-first). They live in
 * the starship's frame, in metres.
 */
function makePuffs(parent) {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const pool = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdde8ff).multiplyScalar(0.9), transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    parent.add(mesh);
    pool.push({ mesh, mat, life: 0, max: 1, vel: new THREE.Vector3() });
  }
  let next = 0;
  const rnd = new THREE.Vector3(); // reused for every puff's kick (no allocation per puff)
  return {
    emit(at, dir) {
      const p = pool[next];
      next = (next + 1) % pool.length;
      p.max = p.life = 0.9;
      p.mesh.position.copy(at);
      p.vel.copy(dir).multiplyScalar(3 + Math.random() * 2).add(rnd.randomDirection().multiplyScalar(0.6));
      p.mesh.visible = true;
    },
    update(dt) {
      for (const p of pool) {
        if (!p.mesh.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        const k = 1 - p.life / p.max;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(Math.max(0, 1 - 2 * dt));
        p.mesh.scale.setScalar(2 + 3 * k);
        p.mat.opacity = 0.55 * (1 - k);
      }
    },
    dispose() {
      for (const p of pool) { parent.remove(p.mesh); p.mat.dispose(); }
      geo.dispose();
    },
  };
}

/** A polyline with its length parameterised: at(u), u in 0..1, is the point that share of the way along. */
function makePath(points) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = new THREE.Vector3(...points[i - 1]); const b = new THREE.Vector3(...points[i]);
    const len = a.distanceTo(b);
    segs.push({ a, b, len, from: total });
    total += len;
  }
  return {
    at(u) {
      const d = Math.min(1, Math.max(0, u)) * total;
      const s = segs.find((g) => d <= g.from + g.len) ?? segs[segs.length - 1];
      return s.a.clone().lerp(s.b, s.len > 0 ? (d - s.from) / s.len : 1);
    },
  };
}

/** @returns {Promise<void>} */
export function playCh6Opening(game) {
  const { shipView } = game;
  const overlay = buildOverlay({ eyebrow: lvl('Chapter 6 · Part A', 'Chapter 6'), title: lvl('The crew arrives', 'The crew arrives'), sub: lvl('A crew for the stars', 'New friends for the trip!'), startBlack: true });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;
  game._rockB?.remove(); // the engine is built: Rock B gives way to the starship
  game._dockedSupply?.remove();
  const star = showStarship(game).ship;
  const supply = buildSupplyShip();
  supply.group.rotation.y = Math.PI / 2; // nose -Z to the starship's -X: nose-first at the hub
  star.group.add(supply.group);
  const puffs = makePuffs(star.group);
  const nose = new THREE.Vector3(0, 0, SUPPLY_NOSE).applyEuler(supply.group.rotation); // the probe tip, from the supply's centre
  const noseDir = nose.clone().normalize(); // the puffs' push (emit copies it), and a scratch point for each puff
  const puffAt = new THREE.Vector3();
  const path = makePath(APPROACH);
  const camPos = new THREE.CatmullRomCurve3(CAM.map(([p]) => new THREE.Vector3(...p)), false, 'centripetal');
  const camLook = new THREE.CatmullRomCurve3(CAM.map(([, l]) => new THREE.Vector3(...l)), false, 'centripetal');
  const local = (v) => star.group.localToWorld(v);
  let t = 0;
  let puffAcc = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 2.5); });
  setTimeout(() => { overlay.light(); overlay.bars(true); }, 300);
  const pos = new THREE.Vector3();
  game.cinematic = {
    calm: true,
    hideMarkers: true,
    hidePath: true,
    get t() { return t; },
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      // The supply ship comes in from 0.5 s along the path, its speed eased (so the
      // braking is in the second half), and it is docked from about 13 s on.
      const u = ease((t - 0.5) / 12.5);
      pos.copy(path.at(u));
      supply.group.position.copy(pos);
      supply.blink(t);
      // Braking puffs from the nose while it slows.
      if (u > 0.5 && u < 1) {
        puffAcc += dt * 9;
        while (puffAcc >= 1) {
          puffAcc -= 1;
          puffs.emit(puffAt.copy(pos).add(nose), noseDir);
        }
      }
      puffs.update(dt);
      // Camera: wide, with the whole starship in frame; drifts round to the
      // port as the supply ship comes in; ends close on the docking. Eased in from
      // her chase view at the start and back out to it at the end, so no cut.
      const k = Math.min(1, t / DURATION);
      const wIn = ease(t / 2);
      const wOut = 1 - ease((t - (DURATION - 2)) / 2);
      blendCamera(camera, local(camPos.getPoint(k)), local(camLook.getPoint(k)), Math.min(wIn, wOut));
      if (t > 1.5 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 1.5 + overlay.readS && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };
  return done.finally(() => {
    puffs.dispose();
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1500);
    game.controls.setEnabled(true);
    game.paused = false;
    // The supply ship stays docked at the port; the starship's remove() takes it too.
    game._dockedSupply = { remove() { supply.group.removeFromParent(); supply.dispose(); game._dockedSupply = null; } };
  });
}
