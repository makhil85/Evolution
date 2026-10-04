// The launch complex: pad, service tower, the five-stage rocket, and the
// hologram of the finished vehicle.
//
// PORTED, not rewritten. The pad and stage geometry came from the previous
// build - a critic audit confirmed those 150 lines were finished content worth
// keeping. What changed on the way over:
//
//   - cel-shaded materials instead of MeshStandard
//   - stages are addressed individually, so the quest chain can reveal them
//     piece by piece like every other structure
//   - geometry is DISPOSED on rebuild. The original removed meshes without
//     disposing, which was survivable at six calls a game and a leak the moment
//     anything called it more often.
//   - launchRocket() is deliberately NOT ported. It was broken four ways (no
//     pad guard, a re-entrancy check that could not fire for six seconds, a
//     flame that never followed the rocket, an animatable never removed).
//     rocket.js runs the real flight simulation instead.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';
import { ROCKET_VILLAGE } from './rocketVillageLayout.js';

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });

const MAT = {
  padBase: toon(0x6b7480),
  padDeck: toon(0x8d97a3),
  ring: toon(0x4dd7ff),
  markerLight: toon(0xf0bd3b),
  markerDark: toon(0x39414a),
  beam: toon(0xb4bcc6),
  red: toon(0xc8453d),
  white: toon(0xf2f5fa),
  stone: toon(0xa8b0ba),
  glass: toon(0x9fdcff, { transparent: true, opacity: 0.55 }),
  scaffold: toon(0xb08a5a),
};

/** Scale of the whole complex. The original was authored for a far larger map. */
export const COMPLEX_SCALE = 0.34;

/** Stage ids, in build order. These match the quest chain's rocket.stage.* ids. */
export const STAGE_IDS = ['foundation', 'body', 'control', 'fuel', 'final'];

/**
 * Collapse a group of static meshes into one mesh per material.
 *
 * The service tower is ~60 separate beams and the pad 24 hazard markers - all
 * static, all sharing a handful of materials, and each one its own draw call.
 * Merging them took the scene from 160 draw calls back under the 150 budget.
 */
function mergeStatic(group) {
  const byMaterial = new Map();
  const keep = [];

  for (const child of [...group.children]) {
    if (!child.isMesh || !child.geometry) { keep.push(child); continue; }
    const mat = child.material;
    if (!byMaterial.has(mat)) byMaterial.set(mat, []);
    child.updateMatrix();
    const geo = child.geometry.clone().applyMatrix4(child.matrix);
    byMaterial.get(mat).push(geo);
    child.removeFromParent();
    child.geometry.dispose();
  }

  for (const [mat, geos] of byMaterial) {
    if (!geos.length) continue;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    geos.forEach((g) => { if (g !== merged) g.dispose(); });
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function disposeDeep(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.geometry?.dispose();
  });
}

/** A beam between two points - the tower's whole vocabulary. */
function beamBetween(parent, a, b, r = 0.15, mat = MAT.beam) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const length = a.distanceTo(b);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 6), mat);
  beam.position.copy(mid);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  beam.castShadow = true;
  parent.add(beam);
  return beam;
}

export class RocketComplex {
  constructor(parent, groundAt = () => 0) {
    this.group = new THREE.Group();
    this.group.name = 'rocketComplex';
    const { x, z } = ROCKET_VILLAGE.rocketPad;
    this.group.position.set(x, groundAt(x, z), z);
    this.group.scale.setScalar(COMPLEX_SCALE);
    parent.add(this.group);

    /** @type {Map<string, {group:THREE.Group, pieces:THREE.Object3D[]}>} */
    this.stages = new Map();
    this.built = new Set();
    /** The ghost only shows once step 1 arms it, and retires at 'body'. */
    this.hologramArmed = false;

    this.buildPad();
    this.buildTower();
    this.buildHologram();
    for (const id of STAGE_IDS) this.prepareStage(id);
  }

  buildPad() {
    const pad = new THREE.Group();
    pad.name = 'pad';

    const base = new THREE.Mesh(new THREE.CylinderGeometry(19.5, 21.5, 1.6, 40), MAT.padBase);
    base.position.y = 0.8; base.receiveShadow = true; base.castShadow = true;
    pad.add(base);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(17.9, 18.4, 0.48, 40), MAT.padDeck);
    deck.position.y = 1.72; deck.receiveShadow = true;
    pad.add(deck);

    for (const radius of [7.5, 12.0, 16.3]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.22, 6, 40),
        radius === 12 ? MAT.ring : MAT.markerDark
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.05;
      pad.add(ring);
    }

    // Alternating hazard markers around the rim.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.12, 0.72),
        i % 2 ? MAT.markerLight : MAT.markerDark
      );
      marker.position.set(Math.cos(a) * 17.1, 2.04, Math.sin(a) * 17.1);
      marker.rotation.y = -a;
      pad.add(marker);
    }

    mergeStatic(pad);
    this.group.add(pad);
    this.pad = pad;
  }

  buildTower() {
    const tower = new THREE.Group();
    tower.name = 'serviceTower';
    const tx = -11.8, tz = -5.6, height = 30;
    const legs = [[-2, -2], [2, -2], [-2, 2], [2, 2]]
      .map(([x, z]) => new THREE.Vector3(tx + x, 2.1, tz + z));

    for (const leg of legs) {
      beamBetween(tower, leg, leg.clone().add(new THREE.Vector3(0, height, 0)), 0.28, MAT.red);
    }
    for (let level = 0; level <= 7; level++) {
      const y = 2.1 + level * (height / 7);
      const corners = legs.map((v) => new THREE.Vector3(v.x, y, v.z));
      for (let i = 0; i < 4; i++) beamBetween(tower, corners[i], corners[(i + 1) % 4], 0.12);

      if (level < 7) {
        const ny = 2.1 + (level + 1) * (height / 7);
        const next = legs.map((v) => new THREE.Vector3(v.x, ny, v.z));
        const mat = level % 2 ? MAT.red : MAT.beam;
        beamBetween(tower, corners[0], next[1], 0.09, mat);
        beamBetween(tower, corners[1], next[0], 0.09, mat);
        beamBetween(tower, corners[2], next[3], 0.09, mat);
        beamBetween(tower, corners[3], next[2], 0.09, mat);
      }
      if (level === 2 || level === 4 || level === 6) {
        const platform = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.32, 5.8), MAT.beam);
        platform.position.set(tx, y + 0.12, tz);
        platform.castShadow = true;
        tower.add(platform);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.45, 0.75), MAT.red);
        arm.position.set(tx + 5.8, y + 0.35, tz);
        arm.castShadow = true;
        tower.add(arm);
      }
    }

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 3.1), toon(0x2e485c));
    cabin.position.set(tx, 27, tz); cabin.castShadow = true;
    tower.add(cabin);
    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.35, 3.2), MAT.glass);
    cabinGlass.position.set(tx, 27.5, tz);
    tower.add(cabinGlass);

    mergeStatic(tower);
    this.group.add(tower);
    this.tower = tower;
  }

  /**
   * A translucent ghost of the finished rocket, so the goal is visible from the
   * far bank before anything is built. Kept from the original - it is good
   * design and costs almost nothing.
   */
  buildHologram() {
    const holo = new THREE.Group();
    holo.name = 'hologram';
    const ghost = new THREE.MeshBasicMaterial({
      color: 0x58d9ff, transparent: true, opacity: 0.2, depthWrite: false,
    });
    // The ghost is a promise of the finished rocket, so it has to match it.
    // Slimming the real one and leaving this fat made the hologram read as a
    // different, bigger vehicle.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.45, 21, 16), ghost);
    body.position.y = 12.5; holo.add(body);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.16, 6.4, 16), ghost);
    cone.position.y = 26.2; holo.add(cone);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 2.9), ghost);
      const a = (i / 3) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 2.9, 4.6, Math.sin(a) * 2.9);
      fin.rotation.y = -a;
      holo.add(fin);
    }
    holo.position.y = 2;
    holo.visible = false;
    this.group.add(holo);
    this.hologram = holo;
  }

  /** Create (hidden) geometry for one stage. */
  prepareStage(id) {
    const g = new THREE.Group();
    g.name = `stage:${id}`;
    const pieces = [];
    const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); pieces.push(mesh); return mesh; };

    if (id === 'foundation') {
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.5, 0.7, 20), MAT.stone);
      plat.position.y = 1.8; add(plat);
      const poles = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 6), MAT.scaffold);
        const a = (i / 6) * Math.PI * 2;
        p.position.set(Math.cos(a) * 7.2, 5.8, Math.sin(a) * 7.2);
        p.rotation.z = 0.06;
        p.castShadow = true;
        poles.add(p);
      }
      g.add(poles); pieces.push(poles);
    } else if (id === 'body') {
      // SLIMMER, and taller. The core used to be 4.3 units across the base for
      // 18 of height - barely 2:1, which is a grain silo, not a rocket. Real
      // launchers run 8:1 or more; this sits near 6:1, which reads as a rocket
      // without becoming a needle at village scale.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 21, 20), MAT.white);
      body.position.y = 12.5; add(body);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.26, 2.54, 1.1, 20), MAT.red);
      stripe.position.y = 17.5; add(stripe);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.6, 20), MAT.ring);
      band.position.y = 6.5; add(band);
    } else if (id === 'control') {
      for (let i = 0; i < 3; i++) {
        // Fins sweep back from the narrower body, so they still read at a
        // distance now that there is less hull for them to sit against.
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 2.9), MAT.markerDark);
        const a = (i / 3) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 2.9, 4.6, Math.sin(a) * 2.9);
        fin.rotation.y = -a;
        add(fin);
      }
    } else if (id === 'fuel') {
      for (let i = 0; i < 2; i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 10, 12), MAT.red);
        tank.position.set(i ? 3.0 : -3.0, 9.5, 0);
        add(tank);
      }
    } else if (id === 'final') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6.4, 20), MAT.red);
      cone.position.y = 26.2; add(cone);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 6, 28), MAT.ring);
      glow.rotation.x = Math.PI / 2; glow.position.y = 23; add(glow);
    }

    for (const p of pieces) p.visible = false;
    this.group.add(g);
    this.stages.set(id, { group: g, pieces });
  }

  /** Reveal the first `n` pieces of a stage. Mirrors Structure.showPieces. */
  showStagePieces(id, n) {
    const stage = this.stages.get(id);
    if (!stage) return;
    stage.pieces.forEach((p, i) => { p.visible = i < n; });
    if (n > 0) this.built.add(id); else this.built.delete(id);
    // The ghost has done its job once the real body exists.
    this.hologram.visible = !this.built.has('body') && this.hologramArmed === true;
  }

  /** A Structure-shaped handle per stage, so worldEffects can drive them. */
  stageHandle(id) {
    const stage = this.stages.get(id);
    if (!stage) return null;
    return {
      id: `rocket.stage.${id}`,
      label: `Rocket: ${id}`,
      group: stage.group,
      pieceCount: stage.pieces.length,
      showPieces: (n) => this.showStagePieces(id, n),
      footprint: { x: ROCKET_VILLAGE.rocketPad.x, z: ROCKET_VILLAGE.rocketPad.z, radius: 8 },
    };
  }

  /** Switch the goal hologram on (step 1 does this, from across the river). */
  armHologram(on = true) {
    this.hologramArmed = on;
    this.hologram.visible = on && !this.built.has('body');
  }

  /** How many fuel tanks the child actually built - feeds the flight sim. */
  get fuelTanks() {
    return this.built.has('fuel') ? 5 : 0;
  }

  dispose() {
    disposeDeep(this.group);
    this.group.removeFromParent();
  }
}
