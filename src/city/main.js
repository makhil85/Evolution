// Chapter 2 "Forces and Machines" (was "City Engineering"), 3-D version (see CHAPTER2_PLAN.md).
//
// The integration: renderer + Chapter 3's light rig, the city world
// (world.js), the rules (rules.js, the old game's logic and save format),
// Chapter 3's girl, controller, chase camera and HUD. E uses whatever is
// nearest within reach: a pickup, a quest console, or the workshop site.
import * as THREE from 'three';
import { configureRenderer, freezeShadows, refreshStaticShadows } from '../game/toonPipeline.js';
import { createCharacterController } from '../game/physics.js';
import { createHeldKeys } from '../game/heldKeys.js';
import { addVillageJump } from '../play/grownUp.js';
import { loadAvatar } from '../game/avatar.js';
import { createEmotes } from '../game/emotes.js';
import { guardContext } from '../game/contextGuard.js';
import { createFrameMonitor } from '../game/frameMonitor.js';
import { createChapterStory, heroName, confetti } from '../game/chapterStory.js';
import { createHud } from '../game/hud.js';
import { install, whenIdle } from '../play/readGate.js';
import { createNavArrow } from '../play/navArrow.js';
import { createMiner } from '../play/mining.js';
import { createToolHands, flyToSupplies } from '../play/tools.js';
import { createHunt } from '../play/hunt.js';
import { PLAY_MODES, choosePlayMode, createModeChip, loadPlayMode, savedPlayModeId } from '../play/modes.js';
import { buildCityWorld } from './world.js';
import { huntFor } from './hunt.js';
import { createCityRules } from './rules.js';
import { questionsFor } from './questions.js';
import {
  LEVEL, STORE_KEYS, BOUNDS, TILE, tileToWorld, worldToTile, MAX_PIECES, PIECE_INTERVAL_MS, INTERACT_RADIUS, RESOURCE_KEYS, RECIPE, MEDIUM_QUESTS,
} from './contracts.js';
import { PICKUPS, stationsFor, WORKSHOP_BUILD_TILE, START_TILE, ROADS } from './layout.js';
import { createNewtonTree } from './newtonTree.js';
import { playOpening, playEnding } from './cutscenes.js';
import { t } from '../space/level.js';
import { lessonOnce, hasSeen as lessonSeen } from '../lesson/card.js';
import { LESSON_2A, LESSON_2B } from '../lesson/lessons/ch2.js';

/** "Watch, answer, try it" lessons, the first time each quest opens (LESSONS_PLAN.md). */
const LESSON_BEFORE = { bridge: LESSON_2A, water: LESSON_2B };

const mount = document.getElementById('stage');
const logEl = document.getElementById('log');
const say = (m) => { logEl.textContent += `${m}\n`; };

// ?grab=1: screenshot mode. The frame loop waits for window.__cityRun, so a
// grab of a film (window.__city.story) is exact. The drawing buffer is kept
// for every page (the lab's shots read it).
const GRAB = new URLSearchParams(location.search).has('grab');
const renderer = configureRenderer(new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
guardContext(renderer); // lost graphics: reload from the save, never a blank screen
createFrameMonitor(); // ?fps or F9: real-screen frame graph (window.__frames)
renderer.setSize(mount.clientWidth, mount.clientHeight);
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ed0f5);
scene.fog = new THREE.Fog(0x8ed0f5, 70, 230);
const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 400);

// --- input ------------------------------------------------------------------
const keys = createHeldKeys(); // also lets go on blur / a lost keyup
install(); // the read gate: any key, click or touch is "she is playing" (src/play/readGate.js)
const typingInField = (e) => {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};
addEventListener('keydown', (e) => {
  if (typingInField(e)) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'].includes(e.code)) e.preventDefault();
  // A key pressed while the game is paused (a card, a reading pause) is not kept: nothing walks after it.
  if (!playBlocked()) keys.add(e.code, e.repeat);
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && !playBlocked()) interact();
});
addEventListener('keyup', (e) => keys.delete(e.code));

// The camera starts behind her looking north (-z), up the main road.
let cameraYaw = 0;
let dragging = false;
let lastX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cameraYaw -= (e.clientX - lastX) * 0.006;
  lastX = e.clientX;
});

/** True while a question, a play-mode card (chooser / clue) or the first-time chooser is open: no walking, no E. */
function playBlocked() {
  return choosing || document.body.dataset.playModal === '1' || !!(hud && hud.isModalOpen());
}

function readInput() {
  if (playBlocked()) return { forward: 0, strafe: 0, cameraYaw, run: false, jump: false };
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  return { forward, strafe, cameraYaw, run: keys.has('ShiftLeft') || keys.has('ShiftRight'), jump: keys.has('Space') };
}

// --- state ------------------------------------------------------------------
let hud = null;
let world = null;
let rules = null;
let controller = null;
let avatar = null;
let emotes = null;
let story = null; // chapter opening / ending (src/game/chapterStory.js)
let tools = null;  // axe / hammer / ... in her hand while mining (play/tools.js)
let newton = null; // Newton's apple tree, a bonus story (newtonTree.js)
let sun = null;
const player = new THREE.Group();
const QUESTIONS = questionsFor(LEVEL);
const STATIONS = stationsFor(LEVEL);
const building = new Set(); // structures rising right now

// --- play modes (PLAYMODES_PLAN.md) ----------------------------------------------
let mode = loadPlayMode();
let choosing = false;       // the first-time chooser is up
let nav = null;
let miner = null;
let hunt = null;
let modeChip = null;
let navTimer = 0;
let filming = false;        // a film is playing: no name tags, beacons, glows, arrow or E hint

const RESOURCE_ROWS = [
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'metal', label: 'Metal', icon: '🔩' },
  { key: 'energy', label: 'Energy', icon: '⚡' },
  { key: 'blueprints', label: 'Blueprints', icon: '📘' },
  { key: 'science', label: 'Science', icon: '🔬' },
];

/** The nearest thing E would use, within reach: { kind, id, x, z, label }. */
function nearestUsable(px, pz) {
  let best = null;
  let bestD = INTERACT_RADIUS;
  const consider = (kind, id, tx, ty, label) => {
    const w = tileToWorld(tx, ty);
    const d = Math.hypot(w.x - px, w.z - pz);
    if (d < bestD) { bestD = d; best = { kind, id, x: w.x, z: w.z, label }; }
  };
  for (const p of PICKUPS) if (!rules.isCollected(p.id)) consider('pickup', p.id, p.tx, p.ty, `Pick up ${p.res}`);
  for (const s of STATIONS) {
    if (rules.questStructureBuilt(s.quest) || building.has(s.quest)) continue;
    const locked = s.quest === 'bridge' && !rules.bridgeUnlocked();
    consider('station', s.quest, s.tx, s.ty, locked ? 'Bridge lock (closed)' : s.label);
  }
  if (newton && !newton.isBusy()) {
    const d = Math.hypot(newton.at.x - px, newton.at.z - pz);
    if (d < bestD) { bestD = d; best = { kind: 'apple', id: 'newton', x: newton.at.x, z: newton.at.z, label: newton.label() }; }
  }
  if (!rules.state.builtFinal) consider('workshop', 'workshop', WORKSHOP_BUILD_TILE.tx, WORKSHOP_BUILD_TILE.ty, 'Build the Workshop');
  return best;
}

/** The interact pill for a resource on Medium/Hard: "Pick up Wood 2/3", so pressing again visibly helps. */
function usableLabel(n) {
  if (n.kind !== 'pickup' || mode.mineHits <= 1 || !miner || /locked/.test(n.label)) return n.label;
  return `${n.label} ${miner.progressOf(n.id)}/${mode.mineHits}`;
}

function refreshHud() {
  const pr = rules.progress();
  hud.setProgress(pr.pct, pr.status);
  const lines = rules.missionLines();
  if (mode.treasureHunt && hunt && !hunt.isFound() && !rules.state.builtFinal) {
    lines.push(LEVEL === 1 ? 'Treasure: a Master Gear is hidden in a home. Press the Clue button.' : 'Treasure: a Master Gear is hidden in one of the homes. Follow the clues (Clue button).');
  }
  if (newton && !newton.heard()) lines.push('Bonus: sit under the apple tree near the start. 🍎');
  hud.setMission({ lines });
  hud.setBadges(rules.badges().map((b, i) => ({ id: `b${i}`, label: b.label, state: b.done ? 'done' : 'open' })));
  hud.setInventory(rules.state.resources);
}

const PICKUP_NAME = { wood: 'Wood crate', stone: 'Stone blocks', metal: 'Metal scrap', energy: 'Energy cell', blueprints: 'Blueprint page' };

/**
 * Where should she go next? { x, z, label, station } or null. Unsolved medium
 * quests until the bridge lock opens, then the bridge station, then the
 * resources still short of the workshop recipe, then the workshop site.
 */
function nextObjective() {
  const st = rules.state;
  if (st.builtFinal) return null;
  const px = player.position.x;
  const pz = player.position.z;
  const nearest = (list) => {
    let best = null;
    let bd = Infinity;
    for (const c of list) {
      if (!c) continue;
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  const station = (s) => {
    const w = world.stationPosition(s.quest);
    return w && { x: w.x, z: w.z, label: s.label, station: true };
  };
  if (!rules.bridgeUnlocked()) {
    const open = STATIONS.filter((s) => MEDIUM_QUESTS[LEVEL].includes(s.quest) && !st.solved[s.quest]).map(station);
    const best = nearest(open);
    if (best) return best;
  }
  if (!st.solved.bridge) return station(STATIONS.find((s) => s.quest === 'bridge'));
  const short = new Set(Object.keys(RECIPE).filter((k) => st.resources[k] < RECIPE[k]));
  if (short.size) {
    const c = [];
    for (const p of PICKUPS) {
      if (!short.has(p.res) || rules.isCollected(p.id)) continue;
      const w = world.pickupPosition(p.id);
      if (w) c.push({ x: w.x, z: w.z, label: PICKUP_NAME[p.res] || p.res, station: false });
    }
    const best = nearest(c);
    if (best) return best;
  }
  return { x: world.workshopPlate.x, z: world.workshopPlate.z, label: 'Workshop site', station: true };
}

/** The target the arrow / beacon shows in the current mode (Medium marks stations and sites only). */
function currentTarget() {
  if (!mode.navArrow && !mode.targetBeacon) return null;
  const t = nextObjective();
  if (!t) return null;
  if (!t.station && !mode.navArrow) return { x: world.workshopPlate.x, z: world.workshopPlate.z, label: 'Workshop site' };
  return t;
}

/** Apply a play mode live: arrow, beacons, glow, mining effort, and the treasure hunt. */
function applyMode(m) {
  mode = m;
  nav.setArrow(m.navArrow);
  nav.setBeacon(m.targetBeacon);
  world.setPickupGlow(m.resourceGlow);
  world.setStationBeacons(m.targetBeacon);
  rules.setHuntRequired(m.treasureHunt);
  hunt.setActive(m.treasureHunt);
  modeChip?.set(m.id);
  navTimer = 0;
  refreshHud();
  if (m.treasureHunt) hunt.start();
}

/**
 * Films (cutscenes.js) show the world without its markers: name tags, the
 * station beacons, the pickup glows, the highlight ring and the nav arrow.
 * The play mode's own settings come back when the film ends.
 */
function filmMarkers(on) {
  if (!world || !nav) return;
  filming = on;
  world.setLabelsVisible(!on);
  world.highlight(null);
  // The pickups (and the energy cells' yellow halos) are one group under the city root.
  const pickupGroup = world.root.getObjectByName('pickups');
  if (pickupGroup) pickupGroup.visible = !on;
  world.setPickupGlow(on ? false : mode.resourceGlow);
  world.setStationBeacons(on ? false : mode.targetBeacon);
  nav.setArrow(on ? false : mode.navArrow);
  nav.setBeacon(on ? false : mode.targetBeacon);
}

/**
 * A structure rising on her spot would close round her, and its walls would
 * hold her inside. Move her to the nearest free ground just outside its
 * footprint, facing the building. A quick step, not a walk.
 */
function clearOfStructure(target) {
  const fp = world.siteFootprint(target);
  const p = player.position;
  if (!fp || p.x < fp.minX || p.x > fp.maxX || p.z < fp.minZ || p.z > fp.maxZ) return;
  // Four ways out (one per side), each a body's width clear of the wall, then wider.
  let best = null;
  let bestD = Infinity;
  for (const m of [0.45, 0.9, 1.5]) {
    for (const c of [
      { x: fp.minX - m, z: p.z }, { x: fp.maxX + m, z: p.z },
      { x: p.x, z: fp.minZ - m }, { x: p.x, z: fp.maxZ + m },
    ]) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bestD && !world.blocked(c.x, c.z)) { best = c; bestD = d; }
    }
    if (best) break;
  }
  if (!best) return;
  controller.teleport(best.x, world.heightAt(best.x, best.z), best.z);
  player.rotation.y = Math.atan2((fp.minX + fp.maxX) / 2 - best.x, (fp.minZ + fp.maxZ) / 2 - best.z);
}

/** Raise a structure piece by piece, like the old game (330 ms a piece). */
function riseStructure(target, pieces, doneMessage, questKey) {
  if (questKey) building.add(questKey);
  let n = 0;
  clearOfStructure(target);
  rules.setBuilt(target, 0);
  world.setBuilt(target, 0);
  const timer = setInterval(() => {
    n += 1;
    clearOfStructure(target);
    rules.setBuilt(target, Math.min(n, pieces));
    world.setBuilt(target, Math.min(n, pieces));
    refreshStaticShadows(sun);
    if (n >= pieces) {
      clearInterval(timer);
      if (questKey) {
        building.delete(questKey);
        world.setStationVisible(questKey, false);
      }
      world.setBridgeLock(rules.bridgeUnlocked());
      rules.save();
      refreshHud();
      if (target === 'workshop' && rules.state.builtFinal) {
        // The chapter's last goal: the ending instead of a toast.
        const c = tileToWorld(WORKSHOP_BUILD_TILE.tx, WORKSHOP_BUILD_TILE.ty);
        story?.outro({
          title: 'The Engineering Workshop is built!',
          line: t(`Amazing work, ${heroName()}! The city has water, power, a bridge and a workshop. Next: build a rocket.`,
            `Great job, ${heroName()}! The city has a bridge and a workshop. Next: a rocket!`),
          focus: new THREE.Vector3(c.x, world.heightAt(c.x, c.z), c.z),
          next: { href: 'chapter3.html', label: 'Next: Chapter 3 — Ready for Lift-off' },
          // The film: the workshop opens, the cart crosses the truss, the rocket plan.
          scene: (run) => playEnding({ run, scene, camera, root: world.root, markers: filmMarkers }),
        });
      } else {
        hud.toast(doneMessage, 'good');
      }
    }
  }, PIECE_INTERVAL_MS);
}

function interact() {
  if (!rules || !world || !controller) return;
  const n = nearestUsable(player.position.x, player.position.z);
  // Hard mode: a clue place or a wrong home gets the first say.
  if (mode.treasureHunt && hunt && !hunt.isFound()) {
    const h = hunt.tryHere(player.position);
    // A wrong home's "not here" must not swallow E meant for a resource or
    // a station within reach: it answers only when nothing else is there.
    if (h && !(h.kind === 'decoy' && n)) {
      if (h.kind === 'decoy') hud.toast(h.text, 'info');
      return;
    }
  }
  if (!n) { hud.toast('Walk closer to something to use it.', 'info'); return; }
  if (n.kind === 'apple') { newton.start(player.position); return; }
  if (n.kind === 'pickup') {
    const pk = PICKUPS.find((p) => p.id === n.id);
    tools?.swing(pk?.res, n);
    if (!miner.hit(n.id, mode.mineHits, { x: n.x, y: 0.8, z: n.z }).done) return;
    const r = rules.collect(n.id);
    world.setCollected(n.id);
    if (!r) return;
    flyToSupplies({ camera, canvas: renderer.domElement, from: { x: n.x, y: 0.8, z: n.z }, cell: hud.resourceCell(r.res), amount: r.amount });
    // Short, like Chapter 3: the icon flies into Supplies, which says the rest.
    hud.toast(`+${r.amount} ${r.res}`, 'good');
    refreshHud();
    return;
  }
  if (n.kind === 'station') {
    const open = rules.openQuest(n.id);
    if (!open.ok) { hud.toast(open.text, 'warn'); return; }
    const lesson = LESSON_BEFORE[n.id];
    if (lesson && !lessonSeen(lesson.id)) {
      // The lesson first; when it closes, E again opens the real quest.
      lessonOnce(lesson).then(() => whenIdle()).then(() => interact());
      return;
    }
    const q = QUESTIONS[n.id];
    let solved = false;
    hud.askQuestion(q, (ok) => {
      if (!ok || solved) return;
      solved = true;
      const res = rules.solveQuest(n.id);
      if (!res) return;
      // The card already showed the "Correct. ..." explanation; the
      // structure rising says the rest (its doneMessage follows).
      refreshHud();
      riseStructure(res.target, res.pieces, res.doneMessage, n.id);
    });
    return;
  }
  if (n.kind === 'workshop') {
    const res = rules.startWorkshop();
    if (!res.ok) { hud.toast(res.text, 'warn'); return; }
    hud.toast(res.text, 'good');
    refreshHud();
    riseStructure('workshop', res.pieces || MAX_PIECES.workshop, res.doneMessage, null);
  }
}

/**
 * Where Newton's tree grows: the nearest open grass to her start, off the
 * roads and clear of everything solid, so it is the first thing she meets.
 */
function newtonSpot() {
  const roads = ROADS instanceof Set ? ROADS : new Set(ROADS);
  const free = (x, z) => [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]].every(([dx, dz]) => !world.blocked(x + dx, z + dz));
  let best = null;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const tx = START_TILE.tx + dx;
      const ty = START_TILE.ty + dy;
      const d = Math.hypot(dx, dy);
      if (d < 1.5 || roads.has(`${tx},${ty}`)) continue;
      const w = tileToWorld(tx, ty);
      if (!free(w.x, w.z)) continue;
      if (!best || d < best.d) best = { d, x: w.x, z: w.z };
    }
  }
  const s = tileToWorld(START_TILE.tx, START_TILE.ty);
  return best || { x: s.x + TILE * 2, z: s.z };
}

// --- boot -------------------------------------------------------------------
async function main() {
  window.__city = { scene, renderer, camera, THREE };

  rules = createCityRules({ level: LEVEL });
  if (new URLSearchParams(location.search).has('reset')) rules.reset();

  world = await buildCityWorld({ scene, level: LEVEL, renderer });
  sun = world.sun; // the world owns the light rig
  // Show the saved city: built pieces, solved consoles gone, pickups taken.
  for (const [target, n] of Object.entries(rules.state.built)) world.setBuilt(target, n);
  for (const s of STATIONS) world.setStationVisible(s.quest, !rules.questStructureBuilt(s.quest));
  for (const p of PICKUPS) if (rules.isCollected(p.id)) world.setCollected(p.id);
  world.setBridgeLock(rules.bridgeUnlocked());

  avatar = await loadAvatar({ height: 1.4 }); // matches the townsfolk (Chapter 3 keeps its own)
  player.add(avatar.group);
  scene.add(player);

  controller = createCharacterController({
    target: player,
    radius: 0.3,
    heightField: (x, z) => world.heightAt(x, z),
    bounds: { minX: BOUNDS.minX + 0.4, maxX: BOUNDS.maxX - 0.4, minZ: BOUNDS.minZ + 0.4, maxZ: BOUNDS.maxZ - 0.4 },
    // Her body (radius 0.3), not her centre: world.moveBody stops her at the face and slides her along it.
    resolveHorizontal: (cur, next, radius) => world.moveBody(cur, next, radius, (x, z) => !!newton?.blocks(x, z)),
  });
  const p0 = rules.state.player && Number.isFinite(rules.state.player.x) ? rules.state.player : { x: START_TILE.tx, y: START_TILE.ty };
  const start = tileToWorld(p0.x, p0.y);
  controller.teleport(start.x, world.heightAt(start.x, start.z), start.z);
  // The camera starts behind her looking north: she faces away from it (heading PI), not into the lens.
  player.rotation.y = Math.PI;
  // A saved structure that stands where she was saved would hold her inside it.
  for (const target of Object.keys(rules.state.built)) clearOfStructure(target);

  newton = createNewtonTree({
    scene, at: newtonSpot(), heightAt: world.heightAt, level: LEVEL,
    storeKey: `${STORE_KEYS[LEVEL]}_apple`, getAvatar: () => avatar,
    reward: (n) => { rules.state.resources.science += n; rules.save(); refreshHud(); },
    toast: (m, k) => hud.toast(m, k),
  });

  hud = createHud({ mount: document.body, title: 'Chapter 2 - Forces and Machines', resourceRows: RESOURCE_ROWS, missionGoal: 'Build the Engineering Workshop.', rank: false, signpostKey: false });
  // Two wrong tries on a question (lead rule): the chapter starts again.
  hud.onCorrect = () => { avatar?.play?.('cheer'); confetti(1800); };
  hud.onOutOfTries = () => {
    try { localStorage.removeItem(STORE_KEYS[LEVEL]); localStorage.removeItem(`${STORE_KEYS[LEVEL]}_hunt`); localStorage.removeItem(`${STORE_KEYS[LEVEL]}_apple`); } catch { /* private mode */ }
    location.reload();
  };
  emotes = createEmotes({
    getAvatar: () => avatar, getTarget: () => player, height: 1.4,
    isBlocked: playBlocked,
  });
  hud.setParentHints(Object.values(QUESTIONS).map((q) => ({ id: q.id, title: q.title, parentHint: q.hint })));
  // Play modes: arrow, mining, the treasure hunt and the "Help" chip.
  nav = createNavArrow(scene);
  miner = createMiner({ scene });
  tools = createToolHands({ getAvatar: () => avatar, getPlayer: () => player, height: 1.4 });
  const hd = huntFor(LEVEL);
  const keySpot = hd.steps[hd.steps.length - 1].at;
  hunt = createHunt({
    data: hd,
    storageKey: `${STORE_KEYS[LEVEL]}_hunt`,
    onFound: () => { rules.markHuntFound(); world.setKeyBlock(keySpot); refreshHud(); },
  });
  if (new URLSearchParams(location.search).has('reset')) hunt.reset();
  if (rules.huntFound() && !hunt.isFound()) hunt.state.found = true;
  else if (hunt.isFound() && !rules.huntFound()) rules.markHuntFound();
  if (rules.huntFound()) world.setKeyBlock(keySpot);
  modeChip = createModeChip({ level: LEVEL, onChange: (id) => applyMode(PLAY_MODES[id]) });
  refreshHud();
  // (No opening message: it repeated the mission card, or an old pickup line.)

  // Save her place every few seconds (in old tile units, like the old game).
  setInterval(() => {
    const tpos = worldToTile(player.position.x, player.position.z);
    rules.state.player = { x: player.position.x / TILE + 17 - 0.5, y: player.position.z / TILE + 15 - 0.5, tile: tpos };
    rules.save();
  }, 3000);

  renderer.render(scene, camera);
  freezeShadows(sun);
  document.getElementById('boot')?.classList.add('done');
  window.__city = {
    scene, renderer, camera, world, rules, controller, hud, avatar, player, THREE, interact, nearestUsable, newton,
    nav, miner, hunt, nextObjective, applyMode, getMode: () => mode, emotes, filmMarkers, clearOfStructure,
  };
  say(`Chapter 2 ready - Level ${LEVEL}`);
  // Unlock mode only: the grown-up "Jump" panel.
  {
    const site = tileToWorld(WORKSHOP_BUILD_TILE.tx, WORKSHOP_BUILD_TILE.ty);
    addVillageJump({
      spots: [
        ...STATIONS.map((st) => ({ id: st.quest, label: st.label, group: 'Puzzles and labs', ...world.stationPosition(st.quest) })),
        { id: 'site', label: 'Workshop site', group: 'Build', x: site.x, z: site.z },
      ].filter((p) => Number.isFinite(p.x)),
      controller,
      blocked: (x, z) => world.blocked(x, z) || !!newton?.blocks(x, z),
      heightAt: (x, z) => world.heightAt(x, z),
      fill() { for (const r of Object.keys(rules.state.resources)) rules.state.resources[r] = Math.max(rules.state.resources[r], 99); rules.save(); refreshHud(); },
    });
  }
  // The opening: a film (the road, the broken bridge, the wheel, Newton's apple),
  // then the title card and a wave; a returning child gets the card only.
  story = createChapterStory({
    camera, chasePose, getAvatar: () => avatar, getPlayerPos: () => player.position, chapter: 2, level: LEVEL,
  });
  window.__city.story = story;
  await story.intro({
    eyebrow: 'Chapter 2',
    title: 'Forces and Machines',
    line: rules.state.builtFinal ? `Welcome back, ${heroName()}! The Engineering Workshop is built.` : t(`Pushes, pulls and machines: fix the city, build the bridge and raise the Engineering Workshop, ${heroName()}.`,
      `Pushes, pulls and machines! Fix the city and build the bridge, ${heroName()}.`),
    lookAt: new THREE.Vector3((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2),
    scene: (run) => playOpening({ run, scene, camera, root: world.root, newtonAt: newton.at, chasePose, markers: filmMarkers }),
  });
  // First time in a village chapter: ask how much help she wants (saved, shared by Chapters 1-3).
  if (savedPlayModeId() === null) {
    await whenIdle(); // a card she did not ask for opens only once she has stopped playing
    choosing = true;
    try { await choosePlayMode({ level: LEVEL }); } finally { choosing = false; }
  }
  applyMode(loadPlayMode());
}

// --- loop -------------------------------------------------------------------
/** Where the chase camera wants to be right now (also the end of the opening sweep). */
function chasePose() {
  const p = player.position;
  const dist = 7.2;
  const height = 3.6;
  return {
    pos: new THREE.Vector3(p.x + Math.sin(cameraYaw) * dist, p.y + height, p.z + Math.cos(cameraYaw) * dist),
    look: new THREE.Vector3(p.x, p.y + 1.1, p.z),
  };
}

function updateCamera(dt) {
  const p = player.position;
  const { pos, look } = chasePose();
  camera.position.lerp(pos, 1 - Math.pow(0.0001, dt));
  camera.lookAt(look);
  world?.focusShadows(p.x, p.z);
}

function fit() {
  const w = mount.clientWidth;
  const h = mount.clientHeight;
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(mount);

let prev = performance.now();
let elapsed = 0;
let lastNear = '';
function tick(dt) {
  elapsed += dt;
  // A line on screen (a toast, the read card) stays up its reading time but freezes nothing:
  // she walks, mines and uses the tools while it shows (lead 2026-10-09).
  const gdt = dt; // a line on screen no longer stops the game (lead 2026-10-09): she plays on while it shows
  let motion = null;
  if (controller) {
    motion = controller.step(dt, emotes ? emotes.input(readInput(), dt) : readInput());
    if (!story?.update(dt)) updateCamera(dt);
  }
  if (avatar) avatar.update(dt, motion);
  if (nav && world && rules) {
    navTimer -= gdt;
    if (navTimer <= 0) { navTimer = 0.2; nav.setTarget(currentTarget()); }
    nav.update(gdt, player.position);
  }
  if (miner) miner.update(gdt);
  if (newton) newton.update(gdt);
  if (tools) tools.update(gdt);
  if (world) {
    world.update(dt, elapsed, player.position, camera.position);
    const n = !filming && rules && nearestUsable(player.position.x, player.position.z);
    const key = n ? `${n.kind}:${n.id}` : '';
    if (key !== lastNear) {
      lastNear = key;
      world.highlight(n ? n.kind : null, n ? n.id : null);
    }
    if (hud) {
      if (!n || playBlocked()) hud.hideInteract();
      else hud.setInteract(usableLabel(n), 'E');
    }
  }
  renderer.render(scene, camera);
}
function frame() {
  requestAnimationFrame(frame);
  if (GRAB) return; // ?grab=1: only window.__cityRun moves the clock
  const now = performance.now();
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  tick(dt);
}
/** Test hook: run `seconds` of game time now (the pane only animates while visible). */
window.__cityRun = (seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) tick(dt); };
/** Test hook: turn the chase camera (radians; -PI/2 looks east). */
window.__citySetYaw = (y) => { cameraYaw = y; };

fit();
frame();
main().catch((err) => {
  console.error('[city] startup failed:', err);
  say(`STARTUP FAILED: ${err?.message || err}`);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('done');
    boot.innerHTML = `<h1>Something went wrong</h1><p>${err?.message || err}</p>`;
  }
});

export { RESOURCE_KEYS };
