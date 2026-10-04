// Collectible resource nodes.
//
// A 'spawn' WorldEffect says "ten wood exist in the world now". This module
// puts them somewhere a child can find them and walks them into the inventory.
//
// Deliberately walk-over on Easy rather than press-E: the questions already ask
// for deliberate action, and making a seven-year-old press a key on every log
// turns gathering into admin. Stations use E; supplies use your feet.
//
// Play modes (src/play/modes.js) change that: on Medium and Hard supplies are
// NOT swept up - she stands at one and presses E to mine it (gameScene.js
// drives the presses through the shared miner). Easy also makes them glow.
import * as THREE from 'three';
import { toonRamp } from './toonPipeline.js';
import { ROCKET_VILLAGE, VILLAGE_PATHS } from './rocketVillageLayout.js';
import { audio } from './audio.js';
import { HOMES, homeHalf } from './homesLayout.js';

/** How close Zara must get to sweep a node up. */
export const PICKUP_RADIUS = 1.5;

/** How close she must stand to mine a node with E (Medium and Hard). */
export const MINE_REACH = 2.4;

// The soft glow ring Easy mode puts under every supply (shared geometry/material).
const glowGeo = new THREE.RingGeometry(0.42, 0.7, 24);
glowGeo.rotateX(-Math.PI / 2);
const glowMat = new THREE.MeshBasicMaterial({
  color: 0xfff2a8, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide,
});

function makeGlow() {
  const ring = new THREE.Mesh(glowGeo, glowMat);
  ring.name = 'glow';
  ring.position.y = -0.36;    // on the ground under a node that floats 0.45 up
  ring.renderOrder = 2;
  return ring;
}

/** Per-resource look. Colour is doing the identifying work at this size. */
const LOOK = {
  wood: { color: 0x9a6b3f, shape: 'log' },
  stone: { color: 0xa8b0ba, shape: 'rock' },
  iron: { color: 0x7d8894, shape: 'rock' },
  gems: { color: 0xb072ff, shape: 'gem' },
  fuel: { color: 0xe0554b, shape: 'cell' },
  circuits: { color: 0x46d17f, shape: 'cell' },
  rocketParts: { color: 0xf2b84b, shape: 'gem' },
};

function makeNodeMesh(resource) {
  const look = LOOK[resource] || LOOK.stone;
  const mat = new THREE.MeshToonMaterial({ color: look.color, gradientMap: toonRamp });
  let geo;
  switch (look.shape) {
    case 'log': geo = new THREE.CylinderGeometry(0.16, 0.16, 0.62, 7); break;
    case 'gem': geo = new THREE.OctahedronGeometry(0.26, 0); break;
    case 'cell': geo = new THREE.BoxGeometry(0.34, 0.42, 0.34); break;
    default: geo = new THREE.DodecahedronGeometry(0.26, 0);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;      // dozens of tiny casters are not worth a shadow pass
  mesh.receiveShadow = false;
  if (look.shape === 'log') mesh.rotation.z = Math.PI / 2;
  return mesh;
}

/** Deterministic, so a reload puts the same crate in the same place. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class Pickups {
  /**
   * @param {THREE.Object3D} parent
   * @param {object} deps
   * @param {object} deps.village  walkability, so nothing spawns in the river
   * @param {object} deps.engine   receives the collected resources
   * @param {object} [deps.hud]
   */
  constructor(parent, { village, engine, hud }) {
    this.village = village;
    this.engine = engine;
    this.hud = hud;
    this.group = new THREE.Group();
    this.group.name = 'pickups';
    parent.add(this.group);
    /** @type {Array<{mesh:THREE.Mesh, resource:string, amount:number, x:number, z:number}>} */
    this.nodes = [];
    this.seed = 7;
    /** Easy: walking over a node collects it. Medium/Hard: she must mine it with E. */
    this.autoCollect = true;
    /** Easy: a soft ring under every node so they are easy to spot. */
    this.glow = false;
    this._nextId = 1;
  }

  /** Play modes: sweep up on contact (true) or wait for E (false). */
  setAutoCollect(on) { this.autoCollect = !!on; }

  /** Play modes: glow rings under every node (true) or none (false). */
  setGlow(on) {
    this.glow = !!on;
    for (const n of this.nodes) this._applyGlow(n);
  }

  _applyGlow(n) {
    const ring = n.mesh.getObjectByName('glow');
    if (this.glow && !ring) n.mesh.add(makeGlow());
    else if (!this.glow && ring) n.mesh.remove(ring);   // geometry and material are shared
  }

  _register(mesh, resource, amount, x, z, y) {
    const n = { id: this._nextId++, mesh, resource, amount, x, z, y };
    this.nodes.push(n);
    this._applyGlow(n);
    return n;
  }

  /**
   * The nearest node within `reach` of her feet, or null. For pressing E.
   * @returns {{ index:number, node:object, id:number }|null}
   */
  nearestWithin(playerPos, reach = MINE_REACH) {
    let best = null;
    let bestD = reach;
    this.nodes.forEach((n, index) => {
      const d = Math.hypot(playerPos.x - n.x, playerPos.z - n.z);
      if (d <= bestD) { bestD = d; best = { index, node: n, id: n.id }; }
    });
    return best;
  }

  /** The nearest uncollected node of any of these resources (for the nav arrow). */
  nearestOf(resources, playerPos) {
    const want = new Set(resources);
    let best = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      if (!want.has(n.resource)) continue;
      const d = Math.hypot(playerPos.x - n.x, playerPos.z - n.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  /**
   * Scatter `count` nodes of a resource along the paths, so they are found by
   * walking the route rather than by sweeping empty grass.
   */
  spawn(resource, count, amountEach = 2) {
    const rng = makeRng((this.seed += 977) + resource.length * 31);
    let placed = 0;
    let guard = 0;

    while (placed < count && guard < count * 120) {
      guard += 1;
      // Pick a random point along a random path, then step off it a little.
      const path = VILLAGE_PATHS[Math.floor(rng() * VILLAGE_PATHS.length)];
      const seg = Math.floor(rng() * (path.points.length - 1));
      const t = rng();
      const [ax, az] = path.points[seg];
      const [bx, bz] = path.points[seg + 1];
      const side = (rng() < 0.5 ? -1 : 1) * (path.width * 0.5 + 0.6 + rng() * 1.6);
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const x = ax + dx * t + nx * side;
      const z = az + dz * t + nz * side;

      if (!this.village.isWalkable(x, z)) continue;
      if (Math.abs(z - 3) < 9) continue;                       // river corridor
      // Paths run to the south bank, so scattering blindly stranded most of
      // the early supplies behind the sealed river: 2 of 8 stone reachable,
      // against a build that needs 6. Only spawn where she can actually walk.
      if (!this.isReachable(z)) continue;
      if (this.nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 1.8)) continue;
      // NOTE: this used to `continue` the INNER loop, so it rejected nothing
      // and nodes could land inside a building's collider.
      if (ROCKET_VILLAGE.buildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius + 1)) continue;
      if (HOMES.some((h) => Math.hypot(x - h.x, z - h.z) < homeHalf(h).halfX + 1.6)) continue;

      const mesh = makeNodeMesh(resource);
      const gy = this.village.heightAt ? this.village.heightAt(x, z) : 0;
      mesh.position.set(x, gy + 0.45, z);
      mesh.rotation.y = rng() * Math.PI * 2;
      this.group.add(mesh);
      this._register(mesh, resource, amountEach, x, z, gy);
      placed += 1;
    }
    return placed;
  }

  /**
   * Is this side of the river open to her yet? The south bank is sealed until
   * the quest chain lays the bridge planks.
   */
  isReachable(z) {
    const south = z < 0;
    return !south || this.village.bridgeOpen;
  }

  /** Serialise for the save, so a reload does not delete uncollected supplies. */
  serialise() {
    return this.nodes.map((n) => ({ r: n.resource, x: n.x, z: n.z, a: n.amount }));
  }

  /** Rebuild exactly the nodes a save recorded. */
  restore(list) {
    if (!Array.isArray(list)) return 0;
    this.clear();
    for (const e of list) {
      const mesh = makeNodeMesh(e.r);
      const gy = this.village.heightAt ? this.village.heightAt(e.x, e.z) : 0;
      mesh.position.set(e.x, gy + 0.45, e.z);
      this.group.add(mesh);
      this._register(mesh, e.r, e.a, e.x, e.z, gy);
    }
    return this.nodes.length;
  }

  /** Bob and spin, then sweep up anything Zara is standing on. */
  update(t, playerPos) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      n.mesh.rotation.y += 0.02;
      n.mesh.position.y = (n.y ?? 0) + 0.45 + Math.sin(t * 2.2 + n.x) * 0.09;

      if (this.autoCollect && Math.hypot(playerPos.x - n.x, playerPos.z - n.z) <= PICKUP_RADIUS) {
        this.collect(i);
      }
    }
  }

  collect(index) {
    const n = this.nodes[index];
    this.nodes.splice(index, 1);
    n.mesh.removeFromParent();
    n.mesh.geometry.dispose();

    // The engine owns the inventory - never mutate state here, or the HUD and
    // the save end up disagreeing about how much wood exists.
    this.engine.collect?.(n.resource, n.amount);
    // Keep the saved node list in step with the world on every pickup.
    if (this.engine.state) this.engine.state.pickupNodes = this.serialise();
    this.hud?.setInventory(this.engine.state.inventory);
    audio.pickup();
    this.hud?.toast(`+${n.amount} ${n.resource}`, 'good');
    // The chapter flies the haul into the Supplies panel (src/play/tools.js).
    this.onCollect?.(n);
  }

  /** Everything not yet picked up, by resource - for the HUD's supply hint. */
  remaining() {
    const out = {};
    for (const n of this.nodes) out[n.resource] = (out[n.resource] || 0) + n.amount;
    return out;
  }

  clear() {
    for (const n of this.nodes) { n.mesh.removeFromParent(); n.mesh.geometry.dispose(); }
    this.nodes.length = 0;
  }
}
