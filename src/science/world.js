// Chapter 1 "Science Village": the 3-D world.
//
// buildScienceWorld() builds everything from src/science/layout.js and returns
// the small API the game loop needs (see CHAPTER1_PLAN.md, part B). Same
// structure as src/city/world.js:
//
//   worldGround.js   grass, dirt roads, purple foundation, the iron yard
//   worldTown.js     the 8 buildings, the well, the math boards and labs
//   worldRoom.js     the iron room's walls and golden-lock gate
//   worldCenter.js   the foundation site and the 5-piece Science Center
//   worldPickups.js  stone, iron, science notes (instanced)
//   worldScenery.js  the 27 choppable trees, bushes / flowers, forest belt
//   worldFolk.js     the five villagers
import * as THREE from 'three';
import {
  buildLightRig, configureRenderer, freezeShadows, refreshStaticShadows,
} from '../game/toonPipeline.js';
import { MAP_W, MAP_H, SCIENCE_CENTER_PIECES, tileToWorld, worldToTile, inMap } from './contracts.js';
import { KEY_GATE, IRON_ROOM, isRoomWall, BUILD_TILE, START_TILE, PICKUPS } from './layout.js';
import { makeLabel } from '../city/worldKit.js';
import { buildPickupGlow, buildKeyBlock } from '../city/worldPlay.js';
import { buildGround } from './worldGround.js';
import { buildVillage, buildWell, buildStations } from './worldTown.js';
import { buildRoom } from './worldRoom.js';
import { buildScienceCenter, CENTER } from './worldCenter.js';
import { buildScienceItems } from './worldPickups.js';
import { buildOccupancy, buildResourceTrees, buildScenery } from './worldScenery.js';
import { buildNpcs } from './worldFolk.js';

const SKY = 0x8ed0f5;

export async function buildScienceWorld({ scene, level = 4, renderer, shadowExtent = 34, shadowMapSize = 2048 } = {}) {
  if (renderer) configureRenderer(renderer);
  if (!scene.background) scene.background = new THREE.Color(SKY);
  if (!scene.fog) scene.fog = new THREE.Fog(SKY, 70, 230);

  const root = new THREE.Group();
  root.name = 'scienceWorld';
  scene.add(root);

  // --- light rig, with a sun that can follow the player -----------------------
  const SUN_OFFSET = new THREE.Vector3(24, 38, 20);
  const sun = buildLightRig(scene, { shadowExtent, shadowMapSize, sunPosition: SUN_OFFSET.toArray() });
  const focus = { x: 1e9, z: 1e9 };
  function focusShadows(x, z) {
    const sx = Math.round(x / 6) * 6, sz = Math.round(z / 6) * 6;   // snapped: no shimmer
    if (sx === focus.x && sz === focus.z) return;
    focus.x = sx; focus.z = sz;
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + SUN_OFFSET.x, SUN_OFFSET.y, sz + SUN_OFFSET.z);
    sun.target.updateMatrixWorld();
    refreshStaticShadows(sun);
  }
  const start = tileToWorld(START_TILE.tx, START_TILE.ty);
  focusShadows(start.x, start.z);

  root.add(buildGround());

  const labels = [];
  const track = (sprite) => { labels.push(sprite); return sprite; };

  const village = buildVillage(root);
  village.labels.forEach(track);
  const well = buildWell(root);
  track(well.label);
  const room = buildRoom(root);
  room.labels.forEach(track);
  const stations = buildStations(root, level);
  for (const st of stations.values()) { track(st.labelOpen); track(st.labelDone); }
  const center = buildScienceCenter(root);
  track(center.label);
  track(center.site.label);

  const items = buildScienceItems(root);
  const glow = buildPickupGlow(root, PICKUPS.map((p) => ({ id: p.id, locked: !!p.locked, ...tileToWorld(p.tx, p.ty) })));
  glow.setUnlocked(false);
  const keyBlock = buildKeyBlock(root);
  const trees = await buildResourceTrees(root);
  const { isFree } = buildOccupancy();
  const scenery = await buildScenery(root, { isFree });

  const npcs = buildNpcs(root, { walkable: (x, z) => !blocked(x, z) });
  npcs.list.forEach((n) => track(n.label));

  // --- state --------------------------------------------------------------------
  let gateOpen = false;
  let beaconsOn = true;         // Hard mode hides the floating station beacons
  let built = 0;
  let centerPass = false;       // she is standing inside the footprint: don't trap her
  const pops = [];              // pieces dropping into place

  // --- collision -----------------------------------------------------------------
  const CENTER_HALF = CENTER.walls / 2 + 0.15;
  const inCenter = (x, z, m = 0) => Math.abs(x - CENTER.x) <= CENTER_HALF + m && Math.abs(z - CENTER.z) <= CENTER_HALF + m;
  const WALL_HALF = 0.62;

  function blocked(x, z) {
    const { tx, ty } = worldToTile(x, z);
    if (!inMap(tx, ty)) return true;
    for (const r of village.solids) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
    // iron room walls: a thin strip along each wall tile (whole tile at the corners)
    const isGate = tx === KEY_GATE.tx && ty === KEY_GATE.ty;
    if (isGate || isRoomWall(tx, ty)) {
      const c = tileToWorld(tx, ty);
      const dx = Math.abs(x - c.x), dz = Math.abs(z - c.z);
      const corner = (tx === IRON_ROOM.tx0 || tx === IRON_ROOM.tx1) && (ty === IRON_ROOM.ty0 || ty === IRON_ROOM.ty1);
      if (corner) { if (dx < WALL_HALF && dz < WALL_HALF) return true; }
      else if (isGate) {
        if (dz < WALL_HALF && (!gateOpen || dx > 0.78)) return true;
      } else {
        const alongX = ty === IRON_ROOM.ty0 || ty === IRON_ROOM.ty1;
        if (alongX ? dz < WALL_HALF : dx < WALL_HALF) return true;
      }
    }
    if ((x - well.x) ** 2 + (z - well.z) ** 2 < well.r * well.r) return true;
    for (const st of stations.values()) {
      if ((x - st.x) ** 2 + (z - st.z) ** 2 < st.r * st.r) return true;
    }
    for (const t of trees.solids()) {
      if ((x - t.x) ** 2 + (z - t.z) ** 2 < t.r * t.r) return true;
    }
    if (built >= 2 && !centerPass && inCenter(x, z)) return true;
    return false;
  }

  function heightAt(x, z) {
    if (built < 1) return 0;
    const dx = Math.abs(x - CENTER.x), dz = Math.abs(z - CENTER.z);
    if (dx <= CENTER.slab / 2 && dz <= CENTER.slab / 2) return CENTER.slabTop;
    if (dx <= CENTER.step / 2 && dz <= CENTER.step / 2) return CENTER.stepTop;
    return 0;
  }

  // --- highlight ring -------------------------------------------------------------
  const hl = new THREE.Group();
  hl.visible = false;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  );
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = glowDisc.rotation.x = -Math.PI / 2;
  ring.renderOrder = glowDisc.renderOrder = 4;
  hl.add(glowDisc, ring);
  root.add(hl);
  const hlState = { kind: null, id: null, radius: 1, label: null };
  const hlLabels = new Map();
  function hlLabel(text) {
    if (!hlLabels.has(text)) {
      const l = makeLabel(text, { height: 0.5, accent: '#fff3a0', fontPx: 40 });
      l.visible = false;
      root.add(l);
      hlLabels.set(text, l);
    }
    return hlLabels.get(text);
  }

  const pickupRecord = (id) => trees.get(Number(id)) || items.get(Number(id));

  function highlight(kind, id = null) {
    if (hlState.label) { hlState.label.visible = false; hlState.label = null; }
    hlState.kind = null;
    if (kind == null || (id == null && kind !== 'gate' && kind !== 'foundation')) { hl.visible = false; return; }
    let pos = null, radius = 1.2, label = null;
    if (kind === 'station') {
      const st = stations.get(id);
      if (st) { pos = st; radius = 1.5; }
    } else if (kind === 'pickup') {
      const pk = pickupRecord(id);
      if (pk && !pk.collected) { pos = pk; radius = pk.type === 'tree' ? 1.1 : 0.9; label = `${pk.res} +${pk.amount}`; }
    } else if (kind === 'gate') {
      pos = { x: room.x, z: room.z }; radius = 1.5;
    } else if (kind === 'foundation') {
      pos = center.site.buildPos; radius = 1.5;
    }
    if (!pos) { hl.visible = false; return; }
    hlState.kind = kind; hlState.id = id; hlState.radius = radius;
    hl.position.set(pos.x, 0.07 + (kind === 'foundation' ? 0.05 : 0), pos.z);
    hl.scale.setScalar(radius);
    hl.visible = true;
    if (label) {
      hlState.label = hlLabel(label);
      hlState.label.position.set(pos.x, pickupRecord(id).type === 'tree' ? 2.3 : 1.7, pos.z);
      hlState.label.visible = true;
    }
  }

  // --- the public API ----------------------------------------------------------------
  function setCollected(id) {
    id = Number(id);
    glow.setCollected(id);
    const wasTree = trees.setCollected(id);
    const wasItem = items.setCollected(id);
    if (wasTree) refreshStaticShadows(sun);
    if (!wasTree && !wasItem) return;
    if (hlState.kind === 'pickup' && Number(hlState.id) === id) highlight(null);
  }

  function setStationSolved(quest, solved = true) {
    const st = stations.get(quest);
    if (!st) return;
    st.solved = !!solved;
    st.variants.solved.visible = st.solved;
    st.variants.unsolved.visible = !st.solved;
    st.beacon.visible = !st.solved && beaconsOn;
    st.labelOpen.userData.hidden = st.solved;
    st.labelDone.userData.hidden = !st.solved;
    refreshStaticShadows(sun);
  }

  function setGateOpen(open) {
    gateOpen = !!open;
    glow.setUnlocked(gateOpen);
    room.setOpen(gateOpen);
    refreshStaticShadows(sun);
  }

  function setBuilt(n) {
    const k = Math.max(0, Math.min(SCIENCE_CENTER_PIECES, Math.round(n)));
    const wasWalls = built >= 2;
    center.pieces.forEach((g, i) => {
      const show = i < k;
      if (show && !g.visible && k > built) { g.position.y = 1.8; pops.push({ g, t: 0 }); }
      if (!show) { g.position.y = 0; const p = pops.findIndex((q) => q.g === g); if (p >= 0) pops.splice(p, 1); }
      g.visible = show;
    });
    built = k;
    center.star.visible = k >= 5;
    center.label.userData.hidden = k < 5;
    center.site.plate.visible = k < 1;
    center.site.label.userData.hidden = k >= 1;
    if (built >= 2 && !wasWalls) centerPass = true;   // cleared on the next update if she is outside
    refreshStaticShadows(sun);
  }

  let labelsOn = true;
  const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  function update(dt, time, playerPos, camPos = null) {
    items.update(time);
    glow.update(time);
    npcs.update(dt, time, playerPos);

    for (const st of stations.values()) {
      if (st.solved) continue;
      st.beacon.position.y = 2.9 + Math.sin(time * 2.2 + st.x) * 0.1;
      st.beacon.rotation.y += dt * 1.6;
    }
    center.star.position.y = center.starBase + Math.sin(time * 1.6) * 0.18;
    center.star.rotation.y += dt * 1.1;
    center.site.plate.rotation.y = time * 0.5;

    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt / 0.3;
      const k = Math.min(1, p.t);
      p.g.position.y = 1.8 * (1 - easeOutBack(k));
      if (k >= 1) { p.g.position.y = 0; pops.splice(i, 1); refreshStaticShadows(sun); }
    }

    if (playerPos) {
      if (centerPass && !inCenter(playerPos.x, playerPos.z, 0.2)) centerPass = false;
    }

    if (hl.visible) {
      const pulse = 1 + Math.sin(time * 4) * 0.06;
      hl.scale.setScalar(hlState.radius * pulse);
      ring.material.opacity = 0.75 + Math.sin(time * 4) * 0.2;
    }

    // Name signs: hidden when their thing is, faded out with distance.
    for (const sprite of labels) {
      const hide = sprite.userData.hidden;
      let a = 1;
      if (playerPos) {
        const d = Math.hypot(sprite.position.x - playerPos.x, sprite.position.z - playerPos.z);
        a = THREE.MathUtils.clamp((40 - d) / 12, 0, 1);
      }
      if (camPos) {
        const dc = Math.hypot(sprite.position.x - camPos.x, sprite.position.y - camPos.y, sprite.position.z - camPos.z);
        a *= THREE.MathUtils.clamp((dc - 4) / 3, 0, 1);
      }
      sprite.material.opacity = a;
      sprite.visible = labelsOn && !hide && a > 0.02;
    }
  }

  freezeShadows(sun);

  return {
    root,
    sun,
    heightAt,
    blocked,
    setCollected,
    setStationSolved,
    setGateOpen,
    setBuilt,
    /** Easy mode: a glow ring and light pillar over every uncollected pickup. */
    setPickupGlow: (on) => glow.setOn(on),
    /** Floating diamonds over unsolved boards / labs (Hard mode hides them). */
    setStationBeacons(on) {
      beaconsOn = !!on;
      for (const st of stations.values()) st.beacon.visible = beaconsOn && !st.solved;
    },
    /** Show the glowing key block at { x, z } (the hunt is won), or hide it with null. */
    setKeyBlock: (pos) => (pos ? keyBlock.show(pos) : keyBlock.hide()),
    highlight,
    update,
    focusShadows,
    stationPosition: (q) => { const s = stations.get(q); return s ? { x: s.x, z: s.z } : null; },
    pickupPosition: (id) => trees.position(Number(id)) || items.position(Number(id)),
    setLabelsVisible: (v) => { labelsOn = v; },
    // --- additions beyond the plan -------------------------------------------------
    gatePosition: { x: room.x, z: room.z },
    foundationPosition: center.site.buildPos,
    npcPositions: () => npcs.list.map((n) => ({ name: n.npc.name, x: n.x, z: n.z })),
    stats: () => ({ built, gateOpen, scenery: scenery.counts, trees: trees.solids().length, pickups: PICKUPS.length, map: [MAP_W, MAP_H], build: BUILD_TILE }),
  };
}
