// Chapter 2 "Forces and Machines" (was "City Engineering"): the 3-D world.
//
// buildCityWorld() builds everything from src/city/layout.js and returns the
// small API the game loop needs (see CHAPTER2_PLAN.md, part B). The pieces:
//
//   worldGround.js   grass, dirt roads, paved island, moat water
//   worldScenery.js  trees / bushes / flowers / rocks (instanced), forest belt
//   worldTown.js     town buildings, quest consoles, golden bridge lock
//   worldSites.js    the structures each quest raises, piece by piece
//   worldPeople.js   the 86 pickups and the four townsfolk
//   worldKit.js      mesher (vertex-coloured toon meshes + outlines), labels
import * as THREE from 'three';
import {
  buildLightRig, configureRenderer, freezeShadows, refreshStaticShadows,
} from '../game/toonPipeline.js';
import {
  MAP_W, MAP_H, TILE, MAX_PIECES, tileToWorld, worldToTile, inMap,
} from './contracts.js';
import { isRiver, isBridgeTile, stationsFor, WORKSHOP_BUILD_TILE, PICKUPS, STRUCTURE_SITES } from './layout.js';
import { buildGround, buildWater } from './worldGround.js';
import { buildOccupancy, buildScenery } from './worldScenery.js';
import { buildTown, buildStations, buildLock } from './worldTown.js';
import { buildSites, buildQuay, P } from './worldSites.js';
import { buildPickups, buildNpcs } from './worldPeople.js';
import { makeLabel, makePanel } from './worldKit.js';
import { buildPickupGlow, buildKeyBlock } from './worldPlay.js';

const DECK_TOP = 0.165; // the planks' top (measured), so her feet rest on them
const SKY = 0x8ed0f5;

export async function buildCityWorld({ scene, level = 4, renderer, shadowExtent = 34, shadowMapSize = 2048 } = {}) {
  if (renderer) configureRenderer(renderer);
  if (!scene.background) scene.background = new THREE.Color(SKY);
  if (!scene.fog) scene.fog = new THREE.Fog(SKY, 70, 230);

  const root = new THREE.Group();
  root.name = 'cityWorld';
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
  const start = tileToWorld(5, 17);
  focusShadows(start.x, start.z);

  // --- ground, water, island edge --------------------------------------------
  root.add(buildGround());
  const water = buildWater();
  root.add(water.mesh);
  root.add(buildQuay());

  // --- town, consoles, lock ---------------------------------------------------
  const labels = [];               // { sprite, fadeable }
  const track = (sprite) => { labels.push(sprite); return sprite; };

  const town = buildTown(root);
  town.labels.forEach(track);
  const stations = buildStations(root, stationsFor(level));
  for (const st of stations.values()) track(st.label);
  const lock = buildLock(root);
  lock.labels.forEach(track);

  // --- structures ---------------------------------------------------------------
  const { sites, spinners } = buildSites(level);
  const built = {};
  const siteLabels = {};
  for (const [name, s] of Object.entries(sites)) {
    built[name] = 0;
    for (const piece of s.pieces) { piece.group.visible = false; root.add(piece.group); }
    if (s.label) {
      const sp = s.pieces[0].group.position;
      const label = makeLabel(s.label.text, { icon: s.label.icon, height: 0.6, accent: '#8ce99a' });
      label.position.set(sp.x, s.label.y, sp.z);
      label.userData.hidden = true;
      root.add(label);
      track(label);
      siteLabels[name] = label;
    }
  }

  // The workshop build spot: a glowing plate on the island until she starts it.
  const plateWorld = tileToWorld(WORKSHOP_BUILD_TILE.tx, WORKSHOP_BUILD_TILE.ty);
  const plate = new THREE.Group();
  plate.position.set(plateWorld.x, 0.05, plateWorld.z);
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: 0x5c3fd6 }));
    disc.rotation.x = -Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd43b }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.005;
    const icon = makePanel('⚙', { w: 1.1, h: 1.1, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', fontPx: 150, fg: '#ffe066' });
    icon.material.transparent = true;
    icon.rotation.x = -Math.PI / 2;
    icon.position.y = 0.012;
    plate.add(disc, rim, icon);
    plate.userData.icon = icon;
  }
  root.add(plate);
  const plateLabel = makeLabel('Build Workshop', { icon: '⚙', height: 0.6, accent: '#b197fc' });
  plateLabel.position.set(plateWorld.x, 1.9, plateWorld.z);
  root.add(plateLabel);
  track(plateLabel);

  // --- scenery ---------------------------------------------------------------------
  const { isFree } = buildOccupancy();
  const scenery = await buildScenery(root, { isFree });

  // Solid trunks and rocks, bucketed by tile for quick point tests.
  const solidGrid = new Map();
  for (const s of scenery.solids) {
    const key = `${Math.floor(s.x / TILE + MAP_W / 2)},${Math.floor(s.z / TILE + MAP_H / 2)}`;
    if (!solidGrid.has(key)) solidGrid.set(key, []);
    solidGrid.get(key).push(s);
  }

  // --- people and pickups ----------------------------------------------------------
  // The structures the quests raise are solid once their walls are up (piece
  // 2 on). Final check playtest: she walked straight through the pump, the
  // machine shop and every other built structure. Footprints come from
  // STRUCTURE_SITES, a little inside the drawn size. If she is standing
  // inside one as it rises (she builds the Workshop from its site), that one
  // lets her walk out rather than trapping her.
  const siteRects = Object.entries(STRUCTURE_SITES).filter(([id]) => id !== 'bridge').map(([id, st]) => {
    const c = tileToWorld(st.cx - 0.5, st.cy - 0.5);
    const hx = st.w * TILE * 0.42;
    const hz = st.d * TILE * 0.42;
    return { id, minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz };
  });
  const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  let lastPlayer = null;

  function blocked(x, z) {
    for (const r of siteRects) {
      if ((built[r.id] || 0) < 2 || !inRect(r, x, z)) continue;
      if (lastPlayer && inRect(r, lastPlayer.x, lastPlayer.z)) continue;
      return true;
    }
    const { tx, ty } = worldToTile(x, z);
    if (!inMap(tx, ty)) return true;
    if (isRiver(tx, ty) && !(isBridgeTile(tx, ty) && built.bridge >= MAX_PIECES.bridge)) return true;
    for (const r of town.solids) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    }
    for (const st of stations.values()) {
      if (st.visible && st.tx === tx && st.ty === ty) return true;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = solidGrid.get(`${tx + dx},${ty + dy}`);
        if (!list) continue;
        for (const s of list) if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) return true;
      }
    }
    return false;
  }

  const DECK = { minX: P(25.9, 0).x, maxX: P(29.1, 0).x, minZ: P(0, 16.8).z, maxZ: P(0, 18.2).z };
  function heightAt(x, z) {
    if (built.bridge >= MAX_PIECES.bridge && x >= DECK.minX && x <= DECK.maxX && z >= DECK.minZ && z <= DECK.maxZ) return DECK_TOP;
    return 0;
  }

  const pickups = buildPickups(root);
  const glow = buildPickupGlow(root, PICKUPS.map((p) => ({ id: p.id, ...tileToWorld(p.tx, p.ty) })));
  const keyBlock = buildKeyBlock(root);
  const npcs = buildNpcs(root, { walkable: (x, z) => !blocked(x, z) });
  npcs.list.forEach((n) => track(n.label));

  // --- highlight ring ------------------------------------------------------------------
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
  const hlState = { kind: null, id: null, radius: 1, follow: null, label: null };
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

  function highlight(kind, id = null) {
    if (hlState.label) { hlState.label.visible = false; hlState.label = null; }
    hlState.kind = null; hlState.follow = null;
    if (kind == null || id == null && kind !== 'workshop') { hl.visible = false; return; }
    let pos = null, radius = 1.2, label = null;
    if (kind === 'station') {
      const st = stations.get(id);
      if (st && st.visible) { pos = st; radius = 1.5; }
    } else if (kind === 'pickup') {
      const pk = pickups.get(Number(id));
      if (pk && !pk.collected) { pos = pk; radius = 0.85; label = `${pk.res} +${pk.amount}`; }
    } else if (kind === 'npc') {
      const n = npcs.list.find((q) => q.npc.name === id) || npcs.list[Number(id)];
      if (n) { hlState.follow = n; pos = n; radius = 0.85; }
    } else if (kind === 'workshop') {
      pos = plateWorld; radius = 1.5;
    }
    if (!pos) { hl.visible = false; return; }
    hlState.kind = kind; hlState.id = id; hlState.radius = radius;
    hl.position.set(pos.x, 0.07, pos.z);
    hl.scale.setScalar(radius);
    hl.visible = true;
    if (label) {
      hlState.label = hlLabel(label);
      hlState.label.position.set(pos.x, 1.7, pos.z);
      hlState.label.visible = true;
    }
  }

  // --- the public API -------------------------------------------------------------------
  function setBuilt(target, n) {
    const s = sites[target];
    if (!s) return;
    const k = Math.max(0, Math.min(MAX_PIECES[target], Math.round(n)));
    built[target] = k;
    s.pieces.forEach((p, i) => { p.group.visible = i < k; });
    const label = siteLabels[target];
    if (label) label.userData.hidden = k < MAX_PIECES[target];
    if (target === 'workshop') {
      plate.visible = k < 1;
      plateLabel.userData.hidden = k >= 1;
    }
    refreshStaticShadows(sun);
  }

  function setStationVisible(quest, visible) {
    const st = stations.get(quest);
    if (!st) return;
    st.visible = !!visible;
    st.group.visible = !!visible;
    st.label.userData.hidden = !visible;
    if (quest === 'bridge') {
      lock.group.visible = !!visible;
      lock.hidden = !visible;
      lock.labels.forEach((l, i) => { l.userData.hidden = !visible || (i === 0 ? lock.open.visible : lock.closed.visible); });
    }
    if (!visible && hlState.kind === 'station' && hlState.id === quest) highlight(null);
    refreshStaticShadows(sun);
  }

  let beaconsOn = true;            // Hard mode hides the floating console beacons
  let lockOpen = false;
  function setBridgeLock(open) {
    lockOpen = !!open;
    lock.setOpen(!!open);
    const st = stations.get('bridge');
    if (st) {
      st.locked.visible = !open && st.visible;
      st.body.visible = !!open;
      st.beacon.visible = !!open && beaconsOn;
    }
    if (lock.hidden) lock.labels.forEach((l) => { l.userData.hidden = true; });
  }
  setBridgeLock(false);

  function setCollected(id) {
    pickups.setCollected(Number(id));
    glow.setCollected(id);
    if (hlState.kind === 'pickup' && Number(hlState.id) === Number(id)) highlight(null);
  }

  let labelsOn = true;
  function update(dt, time, playerPos, camPos = null) {
    if (playerPos) lastPlayer = { x: playerPos.x, z: playerPos.z };
    water.update(time);
    for (const sp of spinners) sp.obj.rotation.z += sp.speed * dt;
    pickups.update(time);
    glow.update(time);
    npcs.update(dt, time, playerPos);

    for (const st of stations.values()) {
      if (!st.visible) continue;
      st.beacon.position.y = 2.75 + Math.sin(time * 2.2 + st.x) * 0.1;
      st.beacon.rotation.y += dt * 1.6;
    }
    if (!lock.hidden) {
      lock.group.position.y = lock.baseY + Math.sin(time * 1.6) * 0.1;
      lock.group.rotation.y = -Math.PI / 2 + Math.sin(time * 0.8) * 0.35;
    }
    plate.userData.icon.rotation.z = time * 0.5;

    if (hlState.follow) hl.position.set(hlState.follow.x, 0.07, hlState.follow.z);
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
      // A sign right in front of the camera (a townsperson walking past it)
      // would fill the screen: sprites don't shrink up close. Fade it out.
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
    heightAt,
    blocked,
    /** The footprint a structure closes once it stands (the box `blocked` uses), or null (bridge, unknown). */
    siteFootprint: (target) => siteRects.find((r) => r.id === target) || null,
    setBuilt,
    setStationVisible,
    setBridgeLock,
    setCollected,
    /** Easy mode: a glow ring and light pillar over every uncollected pickup. */
    setPickupGlow: (on) => glow.setOn(on),
    /** Floating diamonds over the quest consoles (Hard mode hides them). */
    setStationBeacons(on) {
      beaconsOn = !!on;
      for (const st of stations.values()) st.beacon.visible = beaconsOn && (st.quest !== 'bridge' || lockOpen);
    },
    /** Show the glowing key block at { x, z } (the hunt is won), or hide it with null. */
    setKeyBlock: (pos) => (pos ? keyBlock.show(pos) : keyBlock.hide()),
    highlight,
    update,
    sun,
    // --- additions beyond the plan -------------------------------------------------
    /** Re-centre the (static) shadow map on the player; call each frame, it only re-renders shadows when she has moved 6+ units. */
    focusShadows,
    /** World position of a station / pickup, for the E-key search. */
    stationPosition: (q) => { const s = stations.get(q); return s ? { x: s.x, z: s.z } : null; },
    pickupPosition: (id) => pickups.position(Number(id)),
    npcPositions: () => npcs.list.map((n) => ({ name: n.npc.name, x: n.x, z: n.z })),
    workshopPlate: plateWorld,
    /** Current shown-piece counts, for tests. */
    built,
    stats: () => ({ counts: scenery.counts, solids: scenery.solids.length }),
    /** Show / hide every floating sign (for clean screenshots). */
    setLabelsVisible: (v) => { labelsOn = v; },
  };
}
