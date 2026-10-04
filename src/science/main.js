// Chapter 1 "Science Village", 3-D version (see CHAPTER1_PLAN.md).
//
// The integration, same shape as Chapter 2's src/city/main.js: the village
// world (world.js), the rules (rules.js, the old game's logic and save
// format), Chapter 3's girl, controller, chase camera and HUD. E uses
// whatever is nearest within reach: a tree, rock or note, a math board or
// lab, the golden key gate, or the Science Center foundation.
import * as THREE from 'three';
import { configureRenderer, freezeShadows, refreshStaticShadows } from '../game/toonPipeline.js';
import { createCharacterController } from '../game/physics.js';
import { loadAvatar } from '../game/avatar.js';
import { createEmotes } from '../game/emotes.js';
import { guardContext } from '../game/contextGuard.js';
import { createFrameMonitor } from '../game/frameMonitor.js';
import { createChapterStory, heroName, confetti } from '../game/chapterStory.js';
import { createHud } from '../game/hud.js';
import { createNavArrow } from '../play/navArrow.js';
import { createMiner } from '../play/mining.js';
import { createToolHands, flyToSupplies } from '../play/tools.js';
import { createHunt } from '../play/hunt.js';
import { PLAY_MODES, choosePlayMode, createModeChip, loadPlayMode, savedPlayModeId } from '../play/modes.js';
import { buildScienceWorld } from './world.js';
import { huntFor } from './hunt.js';
import { createScienceRules } from './rules.js';
import { questionsFor } from './questions.js';
import {
  LEVEL, STORE_KEYS, BOUNDS, TILE, MAP_W, MAP_H, tileToWorld, SCIENCE_CENTER_PIECES, PIECE_INTERVAL_MS, INTERACT_RADIUS,
} from './contracts.js';
import { PICKUPS, STATIONS, KEY_GATE, BUILD_TILE, START_TILE } from './layout.js';

const mount = document.getElementById('stage');
const logEl = document.getElementById('log');
const say = (m) => { logEl.textContent += `${m}\n`; };

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
const keys = new Set();
const typingInField = (e) => {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};
addEventListener('keydown', (e) => {
  if (typingInField(e)) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && !playBlocked()) interact();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

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
let sun = null;
const player = new THREE.Group();
const QUESTIONS = questionsFor(LEVEL);
let rising = false; // the Science Center going up right now

// --- play modes (PLAYMODES_PLAN.md) ----------------------------------------------
let mode = loadPlayMode();
let choosing = false;       // the first-time chooser is up
let nav = null;
let miner = null;
let tools = null; // axe / hammer / ... in her hand while mining (play/tools.js)
let hunt = null;
let modeChip = null;
let navTimer = 0;
const PICKUP_BY_ID = new Map(PICKUPS.map((p) => [p.id, p]));

const RESOURCE_ROWS = [
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'iron', label: 'Iron', icon: '🔩' },
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
  const verb = { tree: 'Chop the tree', stone: 'Mine stone', iron: 'Mine iron', scienceGem: 'Pick up the science note' };
  for (const p of PICKUPS) {
    if (rules.isCollected(p.id)) continue;
    const locked = p.locked && !rules.state.key;
    consider('pickup', p.id, p.tx, p.ty, locked ? 'Rich iron (locked)' : verb[p.type] || `Pick up ${p.res}`);
  }
  for (const s of STATIONS) {
    if (rules.state.solved[s.quest]) continue;
    consider('station', s.quest, s.tx, s.ty, s.labels[LEVEL]);
  }
  if (!rules.state.key) consider('gate', 'key', KEY_GATE.tx, KEY_GATE.ty, 'Golden Lock: hard key puzzle');
  if (!rules.state.built && !rising) consider('foundation', 'foundation', BUILD_TILE.tx, BUILD_TILE.ty, 'Build the Science Center');
  return best;
}

function refreshHud() {
  const pr = rules.progress();
  hud.setProgress(pr.pct, pr.status);
  const lines = rules.missionLines();
  if (mode.treasureHunt && hunt && !hunt.isFound() && !rules.state.built) {
    lines.push('Treasure: a Golden Core is hidden in one of the homes. Follow the clues (Clue button).');
  }
  hud.setMission({ lines });
  hud.setBadges(rules.badges().map((b, i) => ({ id: `b${i}`, label: b.label, state: b.done ? 'done' : 'open' })));
  hud.setInventory(rules.state.resources);
}

const PICKUP_NAME = { tree: 'Tree (wood)', stone: 'Stone', iron: 'Iron', scienceGem: 'Science note' };

/**
 * Where should she go next? { x, z, label, station } or null. Follows the
 * mission text: a plan (boards or key) -> Force Lab -> the second lab ->
 * resources still short of the recipe -> the build site.
 */
function nextObjective() {
  const st = rules.state;
  if (st.built || rising) return null;
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
    return w && { x: w.x, z: w.z, label: s.labels[LEVEL].split(':')[0], station: true };
  };
  if (st.recipeMode === 'unknown') {
    const c = STATIONS.filter((q) => q.kind === 'mathBoard' && !st.solved[q.quest]).map(station);
    if (LEVEL === 1 && !st.key) c.push({ x: world.gatePosition.x, z: world.gatePosition.z, label: 'Golden Lock', station: true });
    const best = nearest(c);
    if (best) return best;
  }
  if (!st.solved.force) return station(STATIONS.find((q) => q.quest === 'force'));
  if (!st.solved.energy) return station(STATIONS.find((q) => q.quest === 'energy'));
  const need = rules.recipe();
  const short = new Set(Object.keys(need).filter((k) => st.resources[k] < need[k]));
  if (short.size) {
    const c = [];
    for (const p of PICKUPS) {
      if (!short.has(p.res) || rules.isCollected(p.id) || (p.locked && !st.key)) continue;
      const w = world.pickupPosition(p.id);
      if (w) c.push({ x: w.x, z: w.z, label: PICKUP_NAME[p.type] || p.res, station: false });
    }
    const best = nearest(c);
    if (best) return best;
  }
  return { x: world.foundationPosition.x, z: world.foundationPosition.z, label: 'Science Center site', station: true };
}

/** The target the arrow / beacon shows in the current mode (Medium marks stations and sites only). */
function currentTarget() {
  if (!mode.navArrow && !mode.targetBeacon) return null;
  const t = nextObjective();
  if (!t) return null;
  if (!t.station && !mode.navArrow) return { x: world.foundationPosition.x, z: world.foundationPosition.z, label: 'Science Center site' };
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

/** Raise the Science Center piece by piece (330 ms a piece). */
function riseScienceCenter(pieces) {
  rising = true;
  let n = 0;
  world.setBuilt(0);
  const timer = setInterval(() => {
    n += 1;
    world.setBuilt(Math.min(n, pieces));
    refreshStaticShadows(sun);
    if (n >= pieces) {
      clearInterval(timer);
      rising = false;
      refreshHud();
      // The chapter's last goal: the ending (camera round the Science Center,
      // confetti, "Chapter 1 complete").
      if (rules.state.built) {
        const c = tileToWorld(BUILD_TILE.tx, BUILD_TILE.ty);
        story?.outro({
          title: 'The Science Center is built!',
          line: `Well done, ${heroName()}! You solved the puzzles and built the Science Center. Next: build a whole city.`,
          focus: new THREE.Vector3(c.x, world.heightAt(c.x, c.z), c.z),
          next: { href: 'chapter2.html', label: 'Next: Chapter 2 — City Engineering' },
        });
      }
    }
  }, PIECE_INTERVAL_MS);
}

/** Show a solved quest in the world: board/lab turns green, gate opens. */
function showSolved(quest) {
  if (quest === 'key') world.setGateOpen(true);
  else world.setStationSolved(quest, true);
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
  if (n.kind === 'pickup') {
    const pk = PICKUP_BY_ID.get(n.id);
    if (pk && pk.locked && !rules.state.key) {   // refused before any mining
      const refused = rules.collect(n.id);
      if (refused) hud.toast(refused.text, 'warn');
      return;
    }
    tools?.swing(pk?.res, n);
    if (!miner.hit(n.id, mode.mineHits, { x: n.x, y: 0.8, z: n.z }).done) return;
    const r = rules.collect(n.id);
    if (!r) return;
    if (r.refused) { hud.toast(r.text, 'warn'); return; }
    world.setCollected(n.id);
    flyToSupplies({ camera, canvas: renderer.domElement, from: { x: n.x, y: 0.8, z: n.z }, cell: hud.resourceCell(r.res), amount: r.amount });
    // Short, like Chapter 3: the icon flies into Supplies, which says the rest.
    hud.toast(`+${r.amount} ${r.res}`, 'good');
    refreshHud();
    return;
  }
  if (n.kind === 'station' || n.kind === 'gate') {
    const open = rules.openQuest(n.id);
    if (!open.ok) { hud.toast(open.text, 'warn'); return; }
    const q = QUESTIONS[n.id];
    let solved = false;
    hud.askQuestion(q, (ok) => {
      if (!ok || solved) return;
      solved = true;
      const res = rules.solveQuest(n.id);
      if (!res) return;
      // The card already showed the "Correct. ..." explanation: the message
      // adds only what is new (the reward, a recipe, the key).
      const extra = res.text.startsWith(res.success) ? res.text.slice(res.success.length).trim() : res.text;
      if (extra) hud.toast(extra.replace(/^You also gained /, ''), 'good');
      showSolved(n.id);
      refreshHud();
    });
    return;
  }
  if (n.kind === 'foundation') {
    const res = rules.startBuild();
    if (!res.ok) { hud.toast(res.text, 'warn'); return; }
    hud.toast(res.text, 'good');
    refreshHud();
    riseScienceCenter(res.pieces || SCIENCE_CENTER_PIECES);
  }
}

// --- boot -------------------------------------------------------------------
async function main() {
  window.__science = { scene, renderer, camera, THREE };

  rules = createScienceRules({ level: LEVEL });
  if (new URLSearchParams(location.search).has('reset')) rules.reset();

  world = await buildScienceWorld({ scene, level: LEVEL, renderer });
  sun = world.sun; // the world owns the light rig
  // Show the saved village: solved boards and labs, the gate, pickups taken,
  // the Science Center if it's built.
  for (const s of STATIONS) world.setStationSolved(s.quest, !!rules.state.solved[s.quest]);
  world.setGateOpen(!!rules.state.key);
  for (const p of PICKUPS) if (rules.isCollected(p.id)) world.setCollected(p.id);
  world.setBuilt(rules.state.built ? SCIENCE_CENTER_PIECES : 0);

  avatar = await loadAvatar({ height: 1.4 }); // matches the townsfolk (Chapter 3 keeps its own)
  player.add(avatar.group);
  scene.add(player);

  controller = createCharacterController({
    target: player,
    radius: 0.3,
    heightField: (x, z) => world.heightAt(x, z),
    bounds: { minX: BOUNDS.minX + 0.4, maxX: BOUNDS.maxX - 0.4, minZ: BOUNDS.minZ + 0.4, maxZ: BOUNDS.maxZ - 0.4 },
    resolveHorizontal: (cur, next) => {
      if (!world.blocked(next.x, next.z)) return;
      if (!world.blocked(next.x, cur.z)) { next.z = cur.z; return; }
      if (!world.blocked(cur.x, next.z)) { next.x = cur.x; return; }
      next.x = cur.x; next.z = cur.z;
    },
  });
  const p0 = rules.state.player && Number.isFinite(rules.state.player.x) ? rules.state.player : { x: START_TILE.tx, y: START_TILE.ty };
  const start = tileToWorld(p0.x, p0.y);
  controller.teleport(start.x, world.heightAt(start.x, start.z), start.z);

  hud = createHud({ mount: document.body, title: 'Chapter 1 - Science Village', resourceRows: RESOURCE_ROWS, missionGoal: 'Build the Science Center.', rank: false, signpostKey: false });
  // Two wrong tries on a question (lead rule): the chapter starts again.
  hud.onCorrect = () => { avatar?.play?.('cheer'); confetti(1800); };
  hud.onOutOfTries = () => {
    try { localStorage.removeItem(STORE_KEYS[LEVEL]); localStorage.removeItem(`${STORE_KEYS[LEVEL]}_hunt`); } catch { /* private mode */ }
    location.reload();
  };
  emotes = createEmotes({
    getAvatar: () => avatar, getTarget: () => player, height: 1.4,
    isBlocked: playBlocked, hint: (m) => hud.toast(m, 'info'),
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
    rules.state.player = { x: player.position.x / TILE + MAP_W / 2 - 0.5, y: player.position.z / TILE + MAP_H / 2 - 0.5 };
    rules.save();
  }, 3000);

  renderer.render(scene, camera);
  freezeShadows(sun);
  document.getElementById('boot')?.classList.add('done');
  window.__science = {
    scene, renderer, camera, world, rules, controller, hud, avatar, player, THREE, interact, nearestUsable,
    nav, miner, hunt, nextObjective, applyMode, getMode: () => mode, emotes,
  };
  say(`Chapter 1 ready - Level ${LEVEL}`);
  // The opening: sweep down over the village to her, title card, a wave.
  story = createChapterStory({
    camera, chasePose, getAvatar: () => avatar, getPlayerPos: () => player.position, chapter: 1, level: LEVEL,
  });
  window.__science.story = story;
  await story.intro({
    eyebrow: 'Chapter 1',
    title: 'Science Village',
    line: rules.state.built ? `Welcome back, ${heroName()}! The Science Center is built.` : `Help the village, ${heroName()}: gather supplies, solve the puzzles and build the Science Center.`,
    lookAt: new THREE.Vector3((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2),
  });
  // First time in a village chapter: ask how much help she wants (saved, shared by Chapters 1-3).
  if (savedPlayModeId() === null) {
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
  let motion = null;
  if (controller) {
    motion = controller.step(dt, emotes ? emotes.input(readInput(), dt) : readInput());
    if (!story?.update(dt)) updateCamera(dt);
  }
  if (avatar) avatar.update(dt, motion);
  if (nav && world && rules) {
    navTimer -= dt;
    if (navTimer <= 0) { navTimer = 0.2; nav.setTarget(currentTarget()); }
    nav.update(dt, player.position);
  }
  if (miner) miner.update(dt);
  if (tools) tools.update(dt);
  if (world) {
    world.update(dt, elapsed, player.position, camera.position);
    const n = rules && nearestUsable(player.position.x, player.position.z);
    const key = n ? `${n.kind}:${n.id}` : '';
    if (key !== lastNear) {
      lastNear = key;
      world.highlight(n ? n.kind : null, n ? n.id : null);
    }
    if (hud) {
      if (!n || playBlocked()) hud.hideInteract();
      else hud.setInteract(n.label, 'E');
    }
  }
  renderer.render(scene, camera);
}
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  tick(dt);
}
/** Test hook: run `seconds` of game time now (the pane only animates while visible). */
window.__scienceRun = (seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) tick(dt); };
/** Test hook: turn the chase camera (radians; -PI/2 looks east). */
window.__scienceSetYaw = (y) => { cameraYaw = y; };

fit();
frame();
main().catch((err) => {
  console.error('[science] startup failed:', err);
  say(`STARTUP FAILED: ${err?.message || err}`);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('done');
    boot.innerHTML = `<h1>Something went wrong</h1><p>${err?.message || err}</p>`;
  }
});

