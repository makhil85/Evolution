// The broken satellite - Act 1's "solar cells" lesson, and her passenger to
// the Moon.
//
// Four jobs live here:
//   1. Its ORBIT: a plain circular rail around Earth (satelliteState), the
//      same maths as orbits.js's bodyStateRel but for a body that isn't in
//      contracts.BODIES (act1.js owns the story around it and draws its
//      marker through missions.extraMarkers).
//   2. Its MODEL (buildSatelliteModel): a thin, flat Starlink-style slab with
//      two long flat solar arrays, built at metre scale like the ship, so
//      SHIP.flightScale drops it into the compressed solar system in the same
//      "size language" as the ship (about as wide as the ship is long). One
//      array is dark and cracked; each array turns about its own long axis,
//      the way a real solar-array drive does.
//   3. The RIG (satelliteRig): the one flight-scene instance and its life
//      story - riding its orbit, the slow docking creep, held alongside while
//      she fixes it, the move onto her ship's back (it then rides rigidly as
//      part of the ship and its arrays charge her fuel while she coasts), and
//      the release into its own Moon orbit. A short docking camera frames her
//      ship and the satellite together through each of those moves.
//   4. The PANEL PUZZLE mini-scene (buildPanelPuzzleScene).
import * as THREE from 'three';
import { BODIES, SHIP, SHIP_PALETTE, INK, toScene } from './contracts.js';
import { bodyState } from './orbits.js';
import { refuel } from './physics.js';
import { toonRamp } from '../game/toonPipeline.js';
import { skipButton } from '../play/grownUp.js';

/** Circular orbit around Earth. Radius ~60u puts it a modest raise above her
 * starting ~38u orbit (BODIES.earth.radius * 1.6) - a small rehearsal of the
 * "burn forward, the far side lifts" lesson before the big Moon transfer.
 * catchRadius is generous on purpose (FLIGHT_MODES.captureScale widens it
 * further on Easy): once she is that close, the docking thrusters take over
 * and creep her in (see the rig below). */
export const SATELLITE = Object.freeze({
  orbit: 60,
  phase: 5.6,
  catchRadius: 7,
  bus: { w: 2.0, h: 0.16, d: 1.1 },
});

/** The panel game: both panels held in the light this long (s). act1.js
 * passes game.mode.captureScale, which sets how slowly they swing. */
const HOLD_NEEDED = 1.5;

const _earth = { x: 0, z: 0, vx: 0, vz: 0 };

/** Heliocentric {x,z,vx,vz} of the satellite at time t (same convention as
 * orbits.js: theta increases CCW from +X, matching every body and the ship's
 * own orbit direction). */
export function satelliteState(t, out = { x: 0, z: 0, vx: 0, vz: 0 }) {
  bodyState('earth', t, _earth);
  const gm = BODIES.earth.gm;
  const r = SATELLITE.orbit;
  const omega = Math.sqrt(gm / (r * r * r));
  const theta = SATELLITE.phase + omega * t;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  out.x = _earth.x + r * c;
  out.z = _earth.z + r * s;
  out.vx = _earth.vx - r * omega * s;
  out.vz = _earth.vz + r * omega * c;
  return out;
}

// --- the model ------------------------------------------------------------------

/** One solar array: a long, very thin board. len along the array (local X),
 * thick (local Y), wid across (local Z). */
const ARRAY = { len: 3.2, wid: 1.15, thick: 0.045, boom: 0.3, cells: [8, 3] };

function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });
}

/** Shared ink material for every outline shell below. */
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/** A thin outline shell: same geometry, pushed out by a per-axis scale so a
 * thin board gets an even ink rim instead of a fat one along its length. */
function outlineOf(mesh, pad = 0.035) {
  const hull = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  hull.position.copy(mesh.position);
  hull.rotation.copy(mesh.rotation);
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  hull.scale.set(
    (size.x + pad * 2) / Math.max(size.x, 1e-3),
    (size.y + pad * 2) / Math.max(size.y, 1e-3),
    (size.z + pad * 2) / Math.max(size.z, 1e-3),
  ).multiply(mesh.scale);
  hull.renderOrder = -1;
  return hull;
}

function addPart(parent, geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, outline = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  if (outline) parent.add(outlineOf(m));
  return m;
}

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** The cell pattern for one array face: a grid of cells along its length. */
function buildCellTexture(dead) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = dead ? '#4a505c' : '#c9ced8';
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = dead ? '#262b36' : hex(SHIP_PALETTE.solar);
  g.fillRect(6, 6, 500, 180);
  g.strokeStyle = dead ? 'rgba(255,255,255,0.12)' : 'rgba(170,200,255,0.45)';
  g.lineWidth = 3;
  const [cols, rows] = ARRAY.cells;
  for (let i = 1; i < cols; i++) { const x = 6 + (500 / cols) * i; g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 186); g.stroke(); }
  for (let j = 1; j < rows; j++) { const y = 6 + (180 / rows) * j; g.beginPath(); g.moveTo(6, y); g.lineTo(506, y); g.stroke(); }
  if (dead) {
    // Scorched, cracked cells so "broken" reads at a glance.
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(40, 20); g.lineTo(110, 80); g.lineTo(70, 130); g.lineTo(160, 175); g.stroke();
    g.beginPath(); g.moveTo(300, 15); g.lineTo(260, 90); g.lineTo(330, 170); g.stroke();
    g.fillStyle = 'rgba(90,60,40,0.35)';
    g.beginPath(); g.ellipse(120, 95, 46, 30, 0.3, 0, Math.PI * 2); g.fill();
  } else {
    // A soft diagonal sheen so the working array looks glassy.
    const sheen = g.createLinearGradient(0, 0, 512, 192);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(6, 6, 500, 180);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let glowTex = null;
function beaconTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/**
 * Build one satellite at metre scale (unscaled - the caller applies
 * SHIP.flightScale in flight, exactly like the ship group).
 *
 * Shape: a thin flat slab (SATELLITE.bus, 16 cm thick) with an array off each
 * end along local X. Flat (both arrays at angle 0), the cell faces point up
 * (+Y), so from the chase camera the arrays read as broad blue boards. The
 * BROKEN array is on the -X end.
 *
 * Returns:
 *   group                 the whole thing
 *   setDeadWingAngle(rad) turns the broken array about its own long axis;
 *                         0 = flat, faces up. (The puzzle stands the
 *                         satellite on end so that axis is vertical.)
 *   setGlow(0..1)         the repaired array's "it's alive!" emissive pop
 *   setFixed(b)           swap the broken array's cells for working ones
 *   tick(dt)              blinks the beacons
 */
export function buildSatelliteModel() {
  const group = new THREE.Group();
  group.name = 'satellite';
  const B = SATELLITE.bus;

  const busMat = toon(0xdfe3ea);
  const busDarkMat = toon(0x5b6270);
  const trimMat = toon(SHIP_PALETTE.accent);
  const darkMat = toon(SHIP_PALETTE.dark);
  const boomMat = toon(0xc9ced8);

  // The slab: a pale top deck over a dark sandwich edge.
  addPart(group, new THREE.BoxGeometry(B.w, B.h * 0.55, B.d), busMat, { y: B.h * 0.22 });
  addPart(group, new THREE.BoxGeometry(B.w * 1.01, B.h * 0.5, B.d * 1.01), busDarkMat, { y: -B.h * 0.2, outline: false });
  // Orange trim stripe across the deck, so it matches her ship.
  addPart(group, new THREE.BoxGeometry(0.16, 0.02, B.d * 0.98), trimMat, { x: B.w * 0.18, y: B.h * 0.5 + 0.005, outline: false });
  // Four flat antenna discs under the slab (the "phased arrays").
  for (const [x, z] of [[-0.5, -0.27], [-0.5, 0.27], [0.5, -0.27], [0.5, 0.27]]) {
    addPart(group, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), darkMat, { x, y: -B.h * 0.5 - 0.01, z, outline: false });
  }
  // A small star-tracker block on the deck.
  addPart(group, new THREE.BoxGeometry(0.22, 0.12, 0.18), darkMat, { x: -B.w * 0.3, y: B.h * 0.5 + 0.06, z: -B.d * 0.28 });

  // An array: boom + board, along local -X or +X from a pivot on the slab end.
  // The pivot turns about X: the array spins about its own long axis.
  function buildArray(side, dead) {
    const pivot = new THREE.Group();
    pivot.position.set(side * B.w * 0.5, 0, 0);
    const boom = new THREE.CylinderGeometry(0.04, 0.04, ARRAY.boom, 8);
    boom.rotateZ(Math.PI / 2);
    addPart(pivot, boom, boomMat, { x: side * ARRAY.boom * 0.5, outline: false });
    const tex = buildCellTexture(dead);
    const panelMat = toon(0xffffff, {
      map: tex,
      emissive: new THREE.Color(dead ? 0x000000 : SHIP_PALETTE.solar),
      emissiveIntensity: dead ? 0 : 0.18,
    });
    const panel = addPart(pivot, new THREE.BoxGeometry(ARRAY.len, ARRAY.thick, ARRAY.wid), panelMat, { x: side * (ARRAY.boom + ARRAY.len * 0.5) });
    // Frame bars at both ends of the board.
    for (const fx of [ARRAY.boom + 0.04, ARRAY.boom + ARRAY.len - 0.04]) {
      addPart(pivot, new THREE.BoxGeometry(0.06, ARRAY.thick * 1.6, ARRAY.wid * 1.02), trimMat, { x: side * fx, outline: false });
    }
    group.add(pivot);
    return { pivot, panel, panelMat, tex };
  }

  const dead = buildArray(-1, true);
  const live = buildArray(+1, false);
  dead.pivot.rotation.x = 1.15; // stuck at a clearly wrong, broken-looking tilt

  // Two blinking beacons (red / white) on the slab's corners: they glow
  // through the bloom so the satellite is easy to spot against the stars.
  const beacons = [[4.0, 0.5, 0.35, -1], [5.0, 5.0, 5.4, 1]].map(([r, g, b, sx]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: beaconTexture(), color: new THREE.Color(r, g, b), transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(sx * B.w * 0.46, B.h * 0.6, -B.d * 0.42);
    s.scale.setScalar(0.42);
    s.renderOrder = 3;
    group.add(s);
    return s;
  });
  let clock = 0;

  const fixedTex = buildCellTexture(false);

  return {
    group,
    deadWingPivot: dead.pivot,
    liveWingPivot: live.pivot,
    deadWingMat: dead.panelMat,
    liveWingMat: live.panelMat,
    setDeadWingAngle(rad) { dead.pivot.rotation.x = rad; },
    get deadWingAngle() { return dead.pivot.rotation.x; },
    /** 0..1: ramps the repaired array bright blue (bloom-eligible). */
    setGlow(v) { dead.panelMat.emissiveIntensity = THREE.MathUtils.lerp(0, 3, v); },
    /** The broken array becomes a working one (cells and colour). */
    setFixed(b) {
      dead.panelMat.map = b ? fixedTex : dead.tex;
      dead.panelMat.emissive.set(b ? SHIP_PALETTE.solar : 0x000000);
      dead.panelMat.needsUpdate = true;
    },
    tick(dt) {
      clock += dt;
      beacons.forEach((s, i) => {
        const ph = (clock * 0.8 + i * 0.5) % 1;
        s.material.opacity = ph < 0.18 ? 1 : 0.28;
      });
    },
  };
}

// --- the rig: the flight-scene satellite's life story -----------------------------
//
// Phases:
//   free       on its Earth orbit (before the catch)
//   creep      docking thrusters: her ship eases in over a few seconds,
//              matching its speed, to a spot just behind it
//   docked     held there while she fixes the wing (and during its puzzle)
//   attaching  it glides onto her ship's back
//   attached   part of her ship: moves rigidly with it; its arrays charge fuel
//   releasing  at the Moon it lifts off her ship and drifts out ...
//   moon       ... onto its own circular Moon orbit
//   gone       not shown
//
// Who drives it each frame: while a docking camera is up (creep, docked,
// attaching, releasing) the camera's apply() - main.js calls it every flight
// frame, even while a question is open. Otherwise the steps' check()
// functions call rig.frame().

/** Where the satellite rides on her ship (ship-local metres: on the back,
 * between the canopy and the tail fins; its arrays stick out over both sides
 * like an extra pair of solar wings). */
const MOUNT = Object.freeze({ x: 0, y: 0.93, z: 1.45 });
/** Riding, it is drawn at this size (critic: at full size its arrays ran
 * past the screen edges in the chase camera and hid the Moon and the path). */
const ATTACH_SCALE = 0.55;
/** Docked: her ship sits this far behind the satellite along its orbit, and a
 * little outside it (so the satellite is ahead of her nose, toward Earth). */
const DOCK = Object.freeze({ along: -1.9, out: 0.35 });
/** A full tank from empty would take this many seconds of coasting (real
 * time), and the arrays only top the tank up to SOLAR_CHARGE_LIMIT of it: a
 * help on the way, not a free refill (lead: fuel thinking has to stay). */
export const SOLAR_RECHARGE_FULL_S = 540;
export const SOLAR_CHARGE_LIMIT = 0.8;
const ATTACH_S = 3.2;
const RELEASE_S = 6;

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _moon = { x: 0, z: 0, vx: 0, vz: 0 };
const _sat = { x: 0, z: 0, vx: 0, vz: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The rig, one per game (act1 and act2 share it). */
export function satelliteRig(game) {
  if (!game.satRig) {
    const rig = createRig(game);
    game.satRig = rig;
    // After a reload while it rides on her ship, put it straight back on,
    // whichever step she is in (the steps are built before the save is read
    // into game.missions, hence the tick of delay).
    setTimeout(() => {
      if (game.missions?.saved?.satellite?.phase === 'attached' && rig.phase === 'free') rig.ensureAttached();
    }, 0);
  }
  return game.satRig;
}

function createRig(game) {
  let model = null;
  let phase = 'free';
  /** Heliocentric position, for the marker and distance checks. */
  const world = { x: 0, z: 0 };

  // creep / docked
  let creep = null;           // { k, T, p0: {a, b}, m0: {a, b} }
  // attaching
  let attach = null;          // { k, pos0, quat0, glow0 }
  // releasing / moon orbit
  let orbitM = null;          // { R, th0, t0, dir }
  let release = null;         // { k }
  // fuel charging
  let lastFuel = null;
  let chargeState = null;
  let attachedWaiters = [];
  function settleAttached() { const w = attachedWaiters; attachedWaiters = []; w.forEach((r) => r()); }
  const stepClock = { id: null, t: 0 };

  function ensureModel() {
    if (model) return model;
    model = buildSatelliteModel();
    model.group.scale.setScalar(SHIP.flightScale);
    game.bodies.root.add(model.group);
    return model;
  }

  function saveState(s) { game.satellite = s; }

  // --- orbital frame helpers ------------------------------------------------
  /** Unit prograde (p) and radial-out (r) of the satellite's orbit at time t. */
  function frameAt(t) {
    satelliteState(t, _sat);
    bodyState('earth', t, _earth);
    const rx = _sat.x - _earth.x; const rz = _sat.z - _earth.z;
    const rr = Math.hypot(rx, rz) || 1;
    const r = { x: rx / rr, z: rz / rr };
    const vx = _sat.vx - _earth.vx; const vz = _sat.vz - _earth.vz;
    const vv = Math.hypot(vx, vz) || 1;
    return { sat: _sat, p: { x: vx / vv, z: vz / vv }, r };
  }

  function placeFree() {
    const sh = game.ship;
    satelliteState(sh.t, _sat);
    world.x = _sat.x; world.z = _sat.z;
    if (model && model.group.parent === game.bodies.root) {
      toScene(model.group.position, _sat.x, _sat.z, sh.x, sh.z);
      // Flying flat, its long axis across its path (slowly settling).
      model.group.rotation.set(0, Math.atan2(_sat.vx, _sat.vz), 0);
    }
  }

  /** Put her ship at offset (a along, b out) from the satellite, matching its
   * speed, nose pointed at it. */
  function holdShip(a, b, dt, turnRate = 3) {
    const sh = game.ship;
    const f = frameAt(sh.t);
    sh.x = f.sat.x + f.p.x * a + f.r.x * b;
    sh.z = f.sat.z + f.p.z * a + f.r.z * b;
    sh.vx = f.sat.vx; sh.vz = f.sat.vz;
    sh.angVel = 0;
    sh._accum = 0;
    const aim = Math.atan2(f.sat.z - sh.z, f.sat.x - sh.x);
    sh.angle = wrap(sh.angle + wrap(aim - sh.angle) * (1 - Math.exp(-dt * turnRate)));
    placeFree();
  }

  /** Her offset from the satellite in its orbital frame right now. */
  function offsetNow() {
    const sh = game.ship;
    const f = frameAt(sh.t);
    const dx = sh.x - f.sat.x; const dz = sh.z - f.sat.z;
    const dvx = sh.vx - f.sat.vx; const dvz = sh.vz - f.sat.vz;
    return {
      a: dx * f.p.x + dz * f.p.z, b: dx * f.r.x + dz * f.r.z,
      va: dvx * f.p.x + dvz * f.p.z, vb: dvx * f.r.x + dvz * f.r.z,
    };
  }

  // --- the docking camera -----------------------------------------------------
  // A cinematic (see main.js: game.cinematic.apply runs after the flight
  // camera, every flight frame) that frames her ship and the satellite side
  // by side, with the planet behind them. It also drives the rig's moves.
  const cam = {
    on: false, w: 0, leaving: false,
    pos: new THREE.Vector3(), look: new THREE.Vector3(), side: null, fresh: true,
  };
  const _S = new THREE.Vector3();
  const _P = new THREE.Vector3();
  const _L = new THREE.Vector3();
  const cinematic = {
    rig: true,
    /** missions.markerIds(): no planet labels floating in this framing. */
    hideMarkers: true,
    apply(dt, camera) {
      update(dt);
      if (!model) return;
      // Where the satellite is, relative to her ship (the floating origin).
      model.group.getWorldPosition(_S);
      _S.y = 0;
      const d = _S.length();
      // Look across the pair from the side away from the planet she circles,
      // so the planet fills the background.
      const sh = game.ship;
      const st = game.states?.[sh.soi];
      if (d > 0.6 || !cam.side) {
        const n = d > 1e-3 ? new THREE.Vector3(-_S.z, 0, _S.x).normalize() : new THREE.Vector3(1, 0, 0);
        if (st) {
          const ex = st.x - sh.x; const ez = st.z - sh.z;
          if (n.x * ex + n.z * ez > 0) n.negate();
        }
        // Releasing at the Moon: look from its far side, so the Moon stays in
        // frame behind the two of them.
        if (st && phase === 'releasing') {
          const ex = st.x - sh.x; const ez = st.z - sh.z; const el = Math.hypot(ex, ez) || 1;
          n.multiplyScalar(0.55).add(new THREE.Vector3(-ex / el, 0, -ez / el)).normalize();
        }
        // Keep the side stable once picked (no flip-flopping as they turn).
        if (cam.side && n.dot(cam.side) < 0) n.negate();
        cam.side = (cam.side || n.clone()).lerp(n, 1 - Math.exp(-dt * 2)).normalize();
      }
      const span = d + 1.3;
      const dist = 0.8 + span * 0.85;
      _L.copy(_S).multiplyScalar(0.5);
      _P.copy(_L).addScaledVector(cam.side, dist).addScaledVector(UP, dist * 0.42);
      const k = cam.fresh ? 1 : 1 - Math.exp(-dt * 3);
      cam.pos.lerp(_P, k);
      cam.look.lerp(_L, k);
      cam.fresh = false;
      cam.w = cam.leaving ? Math.max(0, cam.w - dt / 1.2) : Math.min(1, cam.w + dt / 0.9);
      const w = ease(cam.w);
      const flightPos = camera.position.clone();
      const flightLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(cam.pos.distanceTo(cam.look)).add(flightPos);
      camera.position.lerpVectors(flightPos, cam.pos, w);
      camera.up.copy(UP);
      camera.lookAt(new THREE.Vector3().lerpVectors(flightLook, cam.look, w));
      if (cam.leaving && cam.w <= 0) cameraOff(true);
    },
  };

  function cameraOn(instant = false) {
    cam.leaving = false;
    if (!cam.on) { cam.on = true; cam.fresh = true; cam.side = null; cam.w = instant ? 1 : 0; }
    if (instant) cam.w = 1;
    if (!game.cinematic || game.cinematic === cinematic) game.cinematic = cinematic;
  }
  function cameraLeave() { if (cam.on) cam.leaving = true; }
  function cameraOff(now = false) {
    if (!now) { cameraLeave(); return; }
    cam.on = false; cam.leaving = false; cam.w = 0;
    if (game.cinematic === cinematic) game.cinematic = null;
  }

  // --- per-frame moves (driven by the docking camera) ---------------------------
  function update(dt) {
    if (!model) return;
    model.tick(dt);
    // The moves are short and watched: hold time warp at 1x meanwhile.
    // (Also while the camera shows her closing in: at x64 the approach was over in a frame.)
    if (phase === 'creep' || phase === 'docked' || phase === 'attaching' || phase === 'releasing'
      || (phase === 'free' && cam.on && !cam.leaving)) game.warpIndex = 0;
    const modal = game.hud?.isModalOpen?.();
    if (phase === 'creep') {
      if (!modal) creep.k = Math.min(1, creep.k + dt / creep.T);
      const k = creep.k;
      // Hermite: leaves with her own closing speed (capped), arrives at rest.
      const h00 = 2 * k ** 3 - 3 * k ** 2 + 1;
      const h10 = k ** 3 - 2 * k ** 2 + k;
      const h01 = -2 * k ** 3 + 3 * k ** 2;
      const a = h00 * creep.p0.a + h10 * creep.m0.a + h01 * DOCK.along;
      const b = h00 * creep.p0.b + h10 * creep.m0.b + h01 * DOCK.out;
      holdShip(a, b, dt);
      if (k >= 1) phase = 'docked';
    } else if (phase === 'docked') {
      holdShip(DOCK.along, DOCK.out, dt);
    } else if (phase === 'attaching') {
      if (!modal) attach.k = Math.min(1, attach.k + dt / ATTACH_S);
      const k = ease(attach.k);
      const g = model.group;
      g.position.lerpVectors(attach.pos0, _v.set(MOUNT.x, MOUNT.y, MOUNT.z), k);
      g.position.y += Math.sin(Math.PI * k) * 1.6; // arc up, over the canopy
      g.quaternion.slerpQuaternions(attach.quat0, _q.identity(), k);
      g.scale.setScalar(THREE.MathUtils.lerp(attach.scale0, ATTACH_SCALE, k));
      model.setDeadWingAngle(attach.wing0 * (1 - k));
      model.setGlow(THREE.MathUtils.lerp(attach.glow0, 0.12, k));
      if (attach.k >= 1) { phase = 'attached'; attach = null; cameraOff(); settleAttached(); }
    } else if (phase === 'releasing') {
      if (!modal) release.k = Math.min(1, release.k + dt / RELEASE_S);
      placeMoon(ease(release.k));
      if (release.k >= 1) { phase = 'moon'; release = null; cameraOff(); }
    }
  }

  // --- the Moon orbit -----------------------------------------------------------
  /** Heliocentric position on its Moon orbit at time t. */
  function moonOrbitPos(t, out) {
    bodyState('moon', t, _moon);
    const w = Math.sqrt(BODIES.moon.gm / orbitM.R ** 3) * orbitM.dir;
    const th = orbitM.th0 + w * (t - orbitM.t0);
    out.x = _moon.x + orbitM.R * Math.cos(th);
    out.z = _moon.z + orbitM.R * Math.sin(th);
    return out;
  }
  /** Place the model on its Moon orbit, blended (k < 1) from where it sits on her ship. */
  function placeMoon(k = 1) {
    const sh = game.ship;
    const p = moonOrbitPos(sh.t, { x: 0, z: 0 });
    world.x = p.x; world.z = p.z;
    const g = model.group;
    toScene(_v, p.x, p.z, sh.x, sh.z);
    if (k < 1) {
      // The mount on her ship, in scene space (the ship sits at the origin).
      const mount = new THREE.Vector3(MOUNT.x, MOUNT.y, MOUNT.z).multiplyScalar(SHIP.flightScale).applyAxisAngle(UP, game.shipView.group.rotation.y);
      g.position.lerpVectors(mount, _v, k);
      g.position.y = mount.y * (1 - k);
      _q.setFromAxisAngle(UP, game.shipView.group.rotation.y);
      g.quaternion.slerpQuaternions(_q, release.quatEnd, k);
      g.scale.setScalar(SHIP.flightScale * THREE.MathUtils.lerp(ATTACH_SCALE, 1, k));
    } else {
      g.position.copy(_v);
      g.scale.setScalar(SHIP.flightScale);
    }
    const far = Math.hypot(sh.x - _moon.x, sh.z - _moon.z) > BODIES.moon.soi * 2;
    g.visible = !far;
  }

  // --- fuel charging ----------------------------------------------------------
  function realDt(stepId, stepTime) {
    if (stepClock.id !== stepId || stepTime < stepClock.t) { stepClock.id = stepId; stepClock.t = stepTime; return 0; }
    const d = stepTime - stepClock.t;
    stepClock.t = stepTime;
    return Math.min(d, 0.25);
  }
  function setCharge(s) {
    if (s === chargeState) return;
    chargeState = s;
    game.hud?.instruments?.setSolarCharge?.(s);
  }
  function charge(dt) {
    const sh = game.ship;
    const cap = game.fuelCapacity;
    // Engine firing = the tank went down since last frame: charging rests.
    const firing = lastFuel !== null && sh.fuel < lastFuel - 1e-7;
    const limit = cap * SOLAR_CHARGE_LIMIT;
    if (sh.fuel >= limit - 1e-4) setCharge('topped');
    else if (firing) setCharge('engine');
    else {
      refuel(sh, (cap / SOLAR_RECHARGE_FULL_S) * dt, limit);
      setCharge('charging');
    }
    lastFuel = sh.fuel;
  }

  // --- public ---------------------------------------------------------------------
  const rig = {
    get phase() { return phase; },
    /** Heliocentric position (riding on her ship: her ship's). */
    get world() {
      if (phase === 'attached' || phase === 'attaching') { world.x = game.ship.x; world.z = game.ship.z; }
      return world;
    },
    get model() { return model; },
    /** Distance from her ship to the satellite, u (0 while it rides on her ship). */
    distance() {
      if (phase === 'attached' || phase === 'attaching') return 0;
      return Math.hypot(world.x - game.ship.x, world.z - game.ship.z);
    },

    /** Before the catch: on its Earth orbit. */
    toFree() {
      ensureModel();
      if (model.group.parent !== game.bodies.root) game.bodies.root.add(model.group);
      model.group.scale.setScalar(SHIP.flightScale);
      model.group.visible = true;
      model.setFixed(false); model.setGlow(0); model.setDeadWingAngle(1.15);
      phase = 'free';
      attach = null;
      cameraOff(true);
      placeFree();
      settleAttached();
    },

    /** Every frame of a step (from its check): moves that don't need the camera,
     * and the fuel charging while it rides on her ship. */
    frame(ctx, stepTime = 0) {
      if (!model) return;
      const dt = realDt(ctx.missions?.step?.id, stepTime);
      // The docking camera normally drives the moves; if another cinematic
      // holds the camera, take it back when free, or drive them from here.
      if (cam.on && game.cinematic !== cinematic) {
        if (!game.cinematic) game.cinematic = cinematic;
        else update(dt);
      } else if (!cam.on && phase === 'releasing') {
        update(dt); // released without the camera (at liftoff): drift from here
        return;
      }
      if (phase === 'free') { placeFree(); model.tick(dt); }
      else if (phase === 'attached') { model.tick(dt); charge(dt); }
      else if (phase === 'moon') { model.tick(dt); placeMoon(1); }
    },

    /** Closing in on it (before the catch): the docking camera swings round
     * to show the two of them, so she sees it coming. Off again if she's
     * going to miss and drifts away. */
    approach(on) {
      if (phase !== 'free') return;
      if (on) cameraOn(); else cameraLeave();
    },
    get approachCam() { return phase === 'free' && cam.on && !cam.leaving; },

    /** Within catch range: the docking thrusters take over and creep her in. */
    startCreep() {
      ensureModel();
      if (phase === 'creep' || phase === 'docked') return;
      const o = offsetNow();
      const gap = Math.hypot(o.a - DOCK.along, o.b - DOCK.out);
      const T = gap < 0.4 ? 0.6 : THREE.MathUtils.clamp(2 + gap * 0.35, 3, 6.5);
      // Her closing speed carries into the start of the creep (no jolt), capped
      // so it can never carry her past the satellite.
      let ma = o.va * T; let mb = o.vb * T;
      const mm = Math.hypot(ma, mb); const cap = gap * 0.8;
      if (mm > cap) { ma *= cap / mm; mb *= cap / mm; }
      creep = { k: 0, T, p0: { a: o.a, b: o.b }, m0: { a: ma, b: mb } };
      phase = 'creep';
      cameraOn();
    },
    get docked() { return phase === 'docked'; },
    /** On entering the fix step (also after a reload): creep in if not there. */
    toDock() {
      ensureModel();
      if (model.group.parent !== game.bodies.root) rig.toFree();
      if (phase !== 'docked' && phase !== 'creep') rig.startCreep();
      else cameraOn();
    },
    /** The wing puzzle takes the screen: no camera meanwhile (flight is frozen). */
    puzzleStarted() { cameraOff(true); },
    /** Wing fixed: glowing, and the docking camera back while questions come. */
    puzzleDone() {
      ensureModel();
      model.setFixed(true);
      model.setDeadWingAngle(0.35);
      model.setGlow(1);
      cameraOn(true);
    },

    /** Glide onto her ship's back. From then on it is part of her ship. */
    attach() {
      ensureModel();
      if (phase === 'attaching' || phase === 'attached') return;
      game.shipView.group.updateMatrixWorld(true);
      model.group.updateMatrixWorld(true);
      game.shipView.group.attach(model.group);
      // Her ship flies on freely now, at the satellite's speed.
      const sh = game.ship;
      satelliteState(sh.t, _sat);
      sh.vx = _sat.vx; sh.vz = _sat.vz;
      model.setFixed(true);
      attach = {
        k: 0, pos0: model.group.position.clone(), quat0: model.group.quaternion.clone(),
        wing0: model.deadWingAngle, glow0: model.deadWingMat.emissiveIntensity / 3, scale0: model.group.scale.x,
      };
      phase = 'attaching';
      lastFuel = null;
      saveState({ phase: 'attached' });
      cameraOn();
    },
    /** Make sure it is riding on her ship (reloads and jumps), without the animation. */
    ensureAttached() {
      ensureModel();
      if (phase === 'attaching' || phase === 'attached') return;
      game.shipView.group.add(model.group);
      model.group.position.set(MOUNT.x, MOUNT.y, MOUNT.z);
      model.group.quaternion.identity();
      model.group.scale.setScalar(ATTACH_SCALE);
      model.group.visible = true;
      model.setFixed(true); model.setGlow(0.12); model.setDeadWingAngle(0);
      phase = 'attached';
      attach = null;
      lastFuel = null;
      cameraOff(true);
      saveState({ phase: 'attached' });
      settleAttached();
    },
    /** Resolves once it sits on her ship (the attach move has played out).
     * Never hangs the story: after 10 s it simply snaps into place. */
    whenAttached() {
      if (phase !== 'attaching') return Promise.resolve();
      return new Promise((r) => {
        attachedWaiters.push(r);
        setTimeout(() => {
          if (phase !== 'attaching') return;
          phase = 'free'; // let ensureAttached() put it straight on
          rig.ensureAttached();
        }, 10000);
      });
    },
    get attached() { return phase === 'attached' || phase === 'attaching'; },

    /** At the Moon: lift off her ship and drift out onto its own Moon orbit.
     * camera: false when she is busy flying (just after liftoff): it drifts
     * off in the normal chase view, with no warp hold. */
    release({ camera = true } = {}) {
      ensureModel();
      if (phase !== 'attached' && phase !== 'attaching') return false;
      const sh = game.ship;
      bodyState('moon', sh.t, _moon);
      const rx = sh.x - _moon.x; const rz = sh.z - _moon.z;
      const r = Math.hypot(rx, rz);
      const h = rx * (sh.vz - _moon.vz) - rz * (sh.vx - _moon.vx);
      // Just outside her own orbit, so it drifts gently apart from her.
      const R = THREE.MathUtils.clamp(r * 1.05 + 1, BODIES.moon.radius * 1.7, BODIES.moon.soi * 0.7);
      orbitM = { R, th0: Math.atan2(rz, rx), t0: sh.t, dir: h >= 0 ? 1 : -1 };
      game.bodies.root.add(model.group);
      model.group.scale.setScalar(SHIP.flightScale);
      release = { k: 0, quatEnd: new THREE.Quaternion().setFromAxisAngle(UP, game.shipView.group.rotation.y + 0.9) };
      phase = 'releasing';
      placeMoon(0);
      setCharge(null);
      saveState({ phase: 'released', ...orbitM });
      if (camera) cameraOn();
      return true;
    },
    /** After the release (also after a reload): on its Moon orbit, or gone. */
    toMoonOrGone(saved) {
      if (phase === 'releasing' || phase === 'moon') return;
      // Still riding (she touched down before she was in orbit): it goes off
      // at liftoff instead (act2.js).
      if (phase === 'attached' || phase === 'attaching') return;
      if ((saved || game.satellite)?.phase === 'attached') { rig.ensureAttached(); return; }
      ensureModel();
      setCharge(null);
      cameraOff(true);
      const s = saved || game.satellite;
      if (s?.phase === 'released' && Number.isFinite(s.R)) {
        orbitM = { R: s.R, th0: s.th0, t0: s.t0, dir: s.dir };
        game.bodies.root.add(model.group);
        model.group.scale.setScalar(SHIP.flightScale);
        model.group.quaternion.identity();
        model.group.visible = true;
        model.setFixed(true); model.setGlow(0.12); model.setDeadWingAngle(0);
        phase = 'moon';
        game.satellite = { phase: 'released', ...orbitM };
        placeMoon(1);
      } else {
        rig.hide();
      }
    },
    hide() {
      if (model) { model.group.visible = false; game.bodies.root.add(model.group); }
      phase = 'gone';
      setCharge(null);
      cameraOff(true);
      settleAttached();
    },
  };
  return rig;
}

// --- the panel puzzle mini-scene -------------------------------------------------
//
// Run via game.runScene (see main.js's contract), NOT game.paused: entering a
// scene already freezes flight physics completely (main.js's tick() skips
// stepWorld while activeScene is set), and its own tick(dt, input, ...) is
// driven by the same synchronous loop debugRun uses. `input.turn` is
// controls.sample()'s normal A/D axis.
//
// The satellite stands on its end here (broken array up), so each array's
// long axis is vertical and turning it sweeps its face round the orbital
// plane - the plane the Sun's direction lives in. That makes "turn it to face
// the Sun" a one-angle problem, and it is how a real array drive works.

let puzzleCssInjected = false;
function injectPuzzleCss() {
  if (puzzleCssInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .satp-wrap { position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:36;
      background:rgba(10,14,24,0.84); border:1px solid rgba(255,255,255,0.14); border-radius:16px;
      padding:14px 22px; color:#eef3ff; font:600 14px system-ui,sans-serif; text-align:center;
      box-shadow:0 10px 30px rgba(0,0,0,.5); min-width:360px; }
    .satp-title { font-size:15px; margin-bottom:10px; letter-spacing:.01em; }
    .satp-row { display:flex; align-items:center; gap:18px; }
    .satp-dial { position:relative; width:76px; height:76px; border-radius:50%;
      background:radial-gradient(circle at 50% 45%, #1c2436, #0a0e18); border:2px solid rgba(255,255,255,.25); flex:none; }
    .satp-sun { position:absolute; left:50%; top:6px; transform:translateX(-50%); font-size:15px; }
    .satp-needle { position:absolute; left:50%; top:50%; width:3px; height:31px; background:#7ff3ff;
      transform-origin:50% 100%; margin-left:-1.5px; margin-top:-31px; border-radius:2px;
      box-shadow:0 0 8px rgba(127,243,255,.85); }
    .satp-meters { flex:1; text-align:left; }
    .satp-label { font-size:11px; opacity:.75; text-transform:uppercase; letter-spacing:.08em; margin:4px 0 3px; }
    .satp-bar { width:100%; height:10px; border-radius:6px; background:rgba(255,255,255,.12); overflow:hidden; }
    .satp-bar-fill { height:100%; width:0%; background:linear-gradient(90deg,#3a6fd6,#7ff3ff); }
    .satp-bar-fill.satp-hold { background:linear-gradient(90deg,#ffb347,#ffe58a); }
    .satp-msg { margin-top:10px; font-size:13px; color:#9dffb0; min-height:16px; }
    .satp-needle2 { background:#ffd27a; box-shadow:0 0 8px rgba(255,210,122,.85); }
    .satp-bar { position:relative; }
    .satp-goal { position:absolute; left:80%; top:-2px; bottom:-2px; width:2px; background:#fff; opacity:.8; }
    .satp-bar-fill.is-good { background:linear-gradient(90deg,#2fbf71,#9dffb0); }
    .satp-label.is-held { color:#9dffb0; opacity:1; }
  `;
  document.head.appendChild(style);
  puzzleCssInjected = true;
}

function buildPuzzleOverlay() {
  injectPuzzleCss();
  const wrap = document.createElement('div');
  wrap.className = 'satp-wrap';
  wrap.innerHTML = '<div class="satp-title" data-el="title"></div>'
    + '<div class="satp-row">'
    + '<div class="satp-dial"><div class="satp-sun">☀</div><div class="satp-needle"></div><div class="satp-needle satp-needle2"></div></div>'
    + '<div class="satp-meters">'
    + '<div class="satp-label" data-el="l0"></div><div class="satp-bar"><div class="satp-bar-fill" data-el="power"></div><div class="satp-goal"></div></div>'
    + '<div class="satp-label" data-el="l1"></div><div class="satp-bar"><div class="satp-bar-fill" data-el="power2"></div><div class="satp-goal"></div></div>'
    + '<div class="satp-label">Both panels charging</div><div class="satp-bar"><div class="satp-bar-fill satp-hold" data-el="hold"></div></div>'
    + '</div></div><div class="satp-msg" data-el="msg"></div>';
  document.body.appendChild(wrap);
  const q = (k) => wrap.querySelector(`[data-el="${k}"]`);
  const needles = wrap.querySelectorAll('.satp-needle');
  const bars = [q('power'), q('power2')];
  const labels = [q('l0'), q('l1')];
  const pct = (p) => `${Math.round(p * 100)}%`;
  return {
    setTitle(txt) { q('title').textContent = txt; },
    setLabels(a, b) { labels[0].textContent = a; labels[1].textContent = b; },
    /** Panel i's error from the Sun (rad), its light (0..1), and whether it's held. */
    setPanel(i, errRad, p, held, good) {
      needles[i].style.transform = `rotate(${THREE.MathUtils.radToDeg(errRad)}deg)`;
      bars[i].style.width = pct(p);
      bars[i].classList.toggle('is-good', good);
      labels[i].classList.toggle('is-held', held);
    },
    setHold(f) { q('hold').style.width = pct(f); },
    setMsg(txt) { q('msg').textContent = txt; },
    add(node) { if (node) wrap.appendChild(node); },
    remove() { wrap.remove(); },
  };
}

function buildPuzzleStars() {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 20);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.32, transparent: true, opacity: 0.8 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/**
 * The "fix the dead wing" mini-scene. `toleranceScale` comes from
 * FLIGHT_MODES.captureScale - act1.js passes game.mode.captureScale so Easy
 * gives a wider facing tolerance.
 *
 * @param {object} game main.js's game object (needs ship.t for the Sun's real
 *   direction at this moment - it barely moves over the ~10s puzzle)
 * @param {{ toleranceScale?: number }} [opts]
 * @returns the mini-scene object game.runScene expects
 */
export function buildPanelPuzzleScene(game, { toleranceScale = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.add(buildPuzzleStars());
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);

  const sat = buildSatelliteModel();
  // On end: local -X (the broken array) points straight up. A turn of the
  // array about its long axis by `a` then points its cell face at world
  // angle atan2(z, x) = a in the orbital plane.
  sat.group.rotation.z = -Math.PI / 2;
  scene.add(sat.group);

  // The real Sun direction as seen from the satellite right now.
  const s = satelliteState(game.ship.t);
  const sunDir = new THREE.Vector2(-s.x, -s.z).normalize();
  const sunAngle = Math.atan2(sunDir.y, sunDir.x);

  scene.add(new THREE.AmbientLight(0x3a3f52, 0.6));
  const sunLight = new THREE.DirectionalLight(0xfff2de, 2.6);
  sunLight.position.set(sunDir.x * 8, 2.4, sunDir.y * 8);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight(0x4a6fc0, 0.45);
  fill.position.set(-sunDir.x * 6, -2, -sunDir.y * 6);
  scene.add(fill);

  // Both arrays in frame (the game swings both), from a little to the side
  // so the thin boards never sit edge-on to the camera.
  camera.position.set(4.4, 0.6, 14.2);
  camera.lookAt(0, -1.3, 0); // both arrays in view, above the panel at the bottom

  // Lead 2026-10-07: one held key was too easy. Now BOTH panels swing to
  // and fro by themselves (the satellite lost its pointing); she catches
  // one with A / Left and the other with D / Right, and must hold both while
  // each gets more than 80% of the light. Slower swings on Easy.
  const GOOD = 0.8; // light needed on each panel (cos of the angle off the Sun)
  const swing = 1.7; // rad either side of the Sun
  const period = 6 * Math.max(0.6, toleranceScale); // s per swing: Easy 9.6, Medium 6, Hard 4.2
  const panels = [
    { phase: 2.2, speed: (2 * Math.PI) / period, angle: 0, held: false },
    { phase: -0.6, speed: (2 * Math.PI) / (period * 1.37), angle: 0, held: false },
  ];
  const setAngle = (i, a) => (i === 0 ? sat.setDeadWingAngle(a) : sat.liveWingPivot && (sat.liveWingPivot.rotation.x = a));
  for (const [i, p] of panels.entries()) { p.angle = sunAngle + swing * Math.sin(p.phase); setAngle(i, p.angle); }

  const overlay = buildPuzzleOverlay();
  overlay.setTitle('Both panels are swinging! Catch each one when it faces the Sun.');
  overlay.setLabels('Top panel: hold A or ←', 'Bottom panel: hold D or →');
  overlay.add(skipButton(() => solve())); // unlock mode only

  let holdTime = 0;
  let done = false;
  let doneAt = 0;
  let resolveDone = null;
  let t = 0;
  let solving = false;
  const keyDown = (code) => !!game.controls?.isDown?.(code);

  function tick(dt, input, mouse, modalOpen) {
    t += dt;
    sat.tick(dt);
    if (!done) {
      const turn = modalOpen ? 0 : (input?.turn || 0);
      // Two keys at once read as turn 0, so look at the keys themselves (the
      // touch pad's single turn axis still catches one panel at a time).
      const held = solving ? [true, true] : modalOpen ? [false, false] : [
        keyDown('KeyA') || keyDown('ArrowLeft') || turn < 0,
        keyDown('KeyD') || keyDown('ArrowRight') || turn > 0,
      ];
      let allGood = true;
      panels.forEach((p, i) => {
        p.held = held[i];
        if (!p.held) {
          p.phase += p.speed * dt;
          p.angle = sunAngle + swing * Math.sin(p.phase);
          setAngle(i, p.angle);
        }
        let err = p.angle - sunAngle;
        err = Math.atan2(Math.sin(err), Math.cos(err));
        const light = Math.max(0, Math.cos(err));
        const good = light >= GOOD;
        if (!(good && p.held)) allGood = false;
        overlay.setPanel(i, -err, light, p.held, good);
      });
      if (allGood) {
        holdTime += dt;
        overlay.setMsg('Both panels in the sunshine! Keep holding...');
        if (holdTime >= HOLD_NEEDED) {
          done = true;
          doneAt = t;
          sat.setFixed(true);
          overlay.setMsg('Panels online!');
        }
      } else {
        holdTime = Math.max(0, holdTime - dt * 1.5);
        const caughtBad = panels.some((p, i) => p.held && !(Math.cos(p.angle - sunAngle) >= GOOD));
        overlay.setMsg(caughtBad ? 'That one isn’t facing the Sun: let go and catch it when its bar turns green.'
          : panels.some((p) => p.held) ? 'Got one! Now catch the other when its bar is green.' : '');
      }
      overlay.setHold(Math.min(1, holdTime / HOLD_NEEDED));
    } else {
      sat.setGlow(Math.min(1, (t - doneAt) / 0.8));
      if (t - doneAt > 1.5 && resolveDone) { const r = resolveDone; resolveDone = null; r(); }
    }
  }

  /** Tests and the grown-up skip: both panels to the Sun, held. */
  function solve() {
    solving = true;
    panels.forEach((p, i) => { p.angle = sunAngle; setAngle(i, sunAngle); });
  }

  return {
    scene,
    camera,
    /** Test handle. */
    satellite: sat,
    solve,
    start() { return new Promise((resolve) => { resolveDone = resolve; }); },
    tick,
    dispose() {
      overlay.remove();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          // OUTLINE_MAT and the beacon glow texture are module-level singletons
          // shared with the satellite still living in the flight scene.
          for (const m of mats) {
            if (m === OUTLINE_MAT) continue;
            if (m.map && m.map !== glowTex) m.map.dispose();
            m.dispose();
          }
        }
      });
    },
  };
}
