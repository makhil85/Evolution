// Playable integration: board + structures + player + quest-driven building.
// This is the scene that becomes the game; main.js switches over once the HUD
// lands.
import * as THREE from 'three';
import { Village, BOUNDS } from './game/village.js';
import { buildAllStructures, PLACEMENTS } from './game/structures.js';
import { configureRenderer, buildLightRig, freezeShadows, refreshStaticShadows } from './game/toonPipeline.js';
import { createCharacterController } from './game/physics.js';
import { createHeldKeys } from './game/heldKeys.js';
import { addJumpPanel, isGrownUp } from './play/grownUp.js';
import { loadAvatar } from './game/avatar.js';
import { createQuestEngine, loadSave, saveGame, QUEST_CHAIN, STORE_KEY } from './game/quests.js';
import { createEffectRunner, restoreWorld } from './game/worldEffects.js';
import { Stations } from './game/stations.js';
import { RocketComplex, STAGE_IDS } from './game/rocketComplex.js';
import { LaunchSequence } from './game/launch.js';
import { Pickups } from './game/pickups.js';
import { buildMountainRing } from './game/mountains.js';
import { decorateVillage } from './game/decoration.js';
import { Villagers } from './game/villagers.js';
import { createNameSigns } from './game/nameSigns.js';
import { NODE_YIELD, missingFor } from './game/quests.js';

/** "You still need 4 iron and 2 circuits." - in a child's words. */
function shortfallMessage(engine, step) {
  const missing = missingFor?.(engine.state.inventory, step.cost || {});
  if (!missing || !Object.keys(missing).length) return null;
  const parts = Object.entries(missing).map(([k, v]) => `${v} more ${k}`);
  return `You still need ${parts.join(' and ')}.`;
}
import { ROCKET_VILLAGE } from './game/rocketVillageLayout.js';
import { BUDGET, AVATAR_HEIGHT } from './game/contracts.js';
import { createEmotes } from './game/emotes.js';
import { guardContext } from './game/contextGuard.js';
import { createFrameMonitor } from './game/frameMonitor.js';
import { createChapterStory, heroName, confetti } from './game/chapterStory.js';
import { createOpening, createArrival } from './game/cutscenes.js';
import { createHud } from './game/hud.js';
import { audio } from './game/audio.js';
import { QUESTIONS } from './game/questions.js';
import { createNavArrow } from './play/navArrow.js';
import { createMiner } from './play/mining.js';
import { createToolHands, flyToSupplies } from './play/tools.js';
import { createHunt, createKeyBlockMesh } from './play/hunt.js';
import { PLAY_MODES, savedPlayModeId, loadPlayMode, choosePlayMode, createModeChip } from './play/modes.js';
import { siteName } from './game/nameSigns.js';
import { huntFor, launchGate } from './game/hunt.js';
import { HOMES } from './game/homesLayout.js';
import { buildHomes } from './game/homes.js';
import { MINE_REACH } from './game/pickups.js';
import { lessonOnce, hasSeen as lessonSeen } from './lesson/card.js';
import { LESSON_3A, LESSON_3B, LESSON_3C } from './lesson/lessons/ch3.js';
import { openLaunchTuner } from './game/launchTuner.js';

const mount = document.getElementById('stage');
const logEl = document.getElementById('log');
const say = (m) => { logEl.textContent += m + '\n'; };

const renderer = configureRenderer(
  new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
);
renderer.setSize(mount.clientWidth, mount.clientHeight);
mount.appendChild(renderer.domElement);
guardContext(renderer); // lost graphics: reload from the save, never a blank screen
createFrameMonitor(); // ?fps or F9: real-screen frame graph (window.__frames)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ed0f5);
// Far distance pushed out from 170. A child who is lost needs to SEE the
// thing she is walking towards, and at 170 the far half of the village was
// white haze - the launch pad and the mountains behind it simply were not
// there from the north bank. Ground sight lines between stations are all
// under 70 units, so raising the far plane costs nothing at eye level and
// only changes what is legible across the valley.
scene.fog = new THREE.Fog(0x8ed0f5, 70, 230);

const sun = buildLightRig(scene, { shadowExtent: 40, shadowMapSize: 1024 });

const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 400);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = createHeldKeys(); // also lets go on blur / a lost keyup
/** True when the keystroke belongs to a text field, not the game. */
function typingInField(e) {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

addEventListener('keydown', (e) => {
  // Swallowing WASD/Space globally also swallowed them inside the answer box.
  // rocket_guidance only accepts answers containing "w" ("west"), so that
  // question was literally untypeable and it gates the launch.
  if (typingInField(e)) return;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft'].includes(e.code)) e.preventDefault();
  keys.add(e.code, e.repeat);
});
addEventListener('keyup', (e) => keys.delete(e.code));

// E activates whatever station Zara is standing in. Edge-triggered, so holding
// the key cannot re-open a question every frame.
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || e.repeat || !onInteract) return;
  // Typing an "e" in a free-text answer used to reopen the question, wiping
  // the child's input and resetting their attempt count.
  if (typingInField(e) || (hud && hud.isModalOpen()) || playBlocked()) return;
  onInteract();
});

// The camera sits at +Z behind her, so "forward" is -Z: north, up the road,
// toward the village. Spawning with yaw = PI put the camera on the far side
// and walked her off the south edge of the board.
let cameraYaw = 0;
let dragging = false, lastX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cameraYaw -= (e.clientX - lastX) * 0.006;
  lastX = e.clientX;
});

/**
 * What a plain visit shows: always the child's own game.
 *
 * This used to be `import.meta.env.DEV` - "the dev server opens the finished
 * village" - from when this chapter WAS the app and the dev server was only
 * for developers. The game is now PLAYED through the dev server (the Desktop
 * shortcut runs `npm run dev`), so every visit to Chapter 3 wiped the child's
 * save and opened it solved at 99% (found 2026-09-30). The finished village is
 * still one flag away: `chapter3.html?solved`, or `window.__ROCKET_SOLVED` in
 * a hosted demo (see scripts/bundle-single-file.mjs).
 */
const START_SOLVED = false;

/**
 * Answer and build the whole chain, in order, exactly as a child would.
 *
 * Supplies are granted rather than gathered: the pickups are physical objects
 * on the paths, and walking a route to each one is the part that cannot be
 * fast-forwarded. Everything else - grading, costs, unlock order, effects - is
 * the engine's own.
 *
 * Stops at the launch: pressing that is the moment, and it should be hers.
 */
function solveEverything(eng, stopAt = null) {
  const GUARD = 200;
  for (let i = 0; i < GUARD; i++) {
    const step = eng.current();
    if (!step || step.kind === 'launch') break;
    if (stopAt && step.id === stopAt) return; // grown-up Jump: stop at this step

    if (step.questionId) {
      const q = QUESTIONS[step.questionId];
      if (!q) break;
      const answer = q.type === 'choice'
        ? (q.choices.find((c) => c.correct) || {}).text
        : (q.answers || [])[0];
      if (!eng.answer(step.questionId, answer)) {
        console.warn(`[solved] stuck: ${step.id} would not accept its own answer key`);
        break;
      }
    } else {
      // Top up by exactly what THIS step costs, rather than setting every
      // resource to 99. The old way left the finished village showing "108
      // IRON, 110 FUEL" on the HUD, which is not a number this game ever
      // produces and reads as a bug to anyone looking at the demo.
      for (const [key, cost] of Object.entries(step.cost || {})) {
        const have = eng.state.inventory[key] || 0;
        if (have < cost) eng.state.inventory[key] = cost;
      }
      const res = eng.build(step.id);
      if (!res || res.ok === false) {
        console.warn(`[solved] stuck: ${step.id} - ${res && res.message}`);
        break;
      }
    }
  }
  // Take the bonus puzzles too, so the violet signposts are shown done rather
  // than left glowing over a finished village.
  for (let pass = 0; pass < 4; pass++) {
    for (const s of QUEST_CHAIN) {
      if (!s.optional || !s.questionId || eng.isComplete(s.id)) continue;
      const offered = eng.availableAt(s.stationId);
      if (!offered || offered.id !== s.id) continue;
      const q = QUESTIONS[s.questionId];
      if (!q) continue;
      eng.answer(s.questionId, q.type === 'choice'
        ? (q.choices.find((c) => c.correct) || {}).text
        : (q.answers || [])[0]);
    }
  }
}

function readInput() {
  // A child answering a question must not also be walking away from the
  // building. The previous build had exactly this bug - it kept feeding
  // movement keys to the controller while a modal was open.
  if ((hud && hud.isModalOpen()) || playBlocked()) {
    return { forward: 0, strafe: 0, cameraYaw, run: false, jump: false };
  }
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  return {
    forward, strafe, cameraYaw,
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space'),
  };
}

// ---------------------------------------------------------------------------
const village = new Village();
const player = new THREE.Group();
let controller = null;
let structures = null;
let engine = null;
let state = null;
let effects = null;
let stations = null;
let rocket = null;
let elapsed = 0;
const shadowAnchor = new THREE.Vector3(0, 0, 0);
let onInteract = null;
let hud = null;
let launch = null;
let pickups = null;
let villagers = null;
let avatar = null;
let emotes = null;
let story = null; // chapter opening / ending (src/game/chapterStory.js)
let opening = null; // Chapter 3's own opening (src/game/cutscenes.js)
let arrivalNow = null; // the arrival in orbit, while it is on screen (src/game/cutscenes.js)
let restarting = false; // set when two wrong tries restart the chapter
let nameSigns = null;

// --- play modes (Easy / Medium / Hard) - see PLAYMODES_PLAN.md -------------
let playMode = loadPlayMode();
let chooserOpen = false;
let nav = null;
let miner = null;
let tools = null; // axe / hammer / ... in her hand while mining (play/tools.js)
let hunt = null;
let homes = null;
let keyBlock = null;
let modeChip = null;
/** Level 1 (2nd grade) or 4 (5th-6th grade), from the launcher's profile. */
const playLevel = (() => {
  try { return JSON.parse(localStorage.getItem('rocket_village_profile'))?.difficulty === 1 ? 1 : 4; } catch { return 4; }
})();

/** A play-mode dialog (chooser, clue card) is up: no walking, no E. */
function playBlocked() {
  return chooserOpen || document.body.dataset.playModal === '1';
}

/** Has the Guidance Crystal been found (the Hard-mode launch key)? */
function crystalFound() {
  return !!(engine && engine.state.huntFound) || !!(hunt && hunt.isFound());
}

/** Where the arrow / beacon should point: the next station, or a missing supply. */
function objective() {
  const step = engine && engine.current();
  if (!step) return null;
  if (playMode.navArrow && step.kind === 'build' && step.cost) {
    const missing = Object.keys(missingFor(engine.state.inventory, step.cost) || {});
    const node = missing.length ? pickups.nearestOf(missing, player.position) : null;
    if (node) return { x: node.x, z: node.z, y: node.y, label: `Collect ${node.resource}` };
  }
  const st = stations.byId.get(step.stationId);
  if (!st) return null;
  return { x: st.x, z: st.z, y: village.heightAt(st.x, st.z), label: siteName(st.id) };
}

/** Re-apply everything the current mode controls. Safe to call any time. */
function applyMode(mode) {
  playMode = mode;
  if (nav) { nav.setArrow(mode.navArrow); nav.setBeacon(mode.targetBeacon); }
  stations?.setGuidance(mode.navArrow || mode.targetBeacon);
  // The HUD's key ("gold = go here next") would describe markers Hard hides.
  const signKey = document.querySelector('.rv-key');
  if (signKey) signKey.style.display = mode.navArrow || mode.targetBeacon ? '' : 'none';
  if (pickups) { pickups.setAutoCollect(mode.mineHits <= 1); pickups.setGlow(mode.resourceGlow); }
  if (hunt) {
    hunt.setActive(mode.treasureHunt);
    if (mode.treasureHunt) hunt.start();
  }
  if (keyBlock) keyBlock.visible = mode.treasureHunt && crystalFound();
  modeChip?.set(mode.id);
}

/** The hunt zone she is standing in (the current clue's place or a home's door), for the prompt. */
function huntZoneHere() {
  if (!hunt || !playMode.treasureHunt || crystalFound()) return false;
  const p = player.position;
  const s = hunt.current();
  if (s && Math.hypot(p.x - s.at.x, p.z - s.at.z) <= (s.radius ?? 3)) return true;
  return (hunt.data.decoys || []).some((d) => Math.hypot(p.x - d.at.x, p.z - d.at.z) <= (d.radius ?? 3));
}

/** One press of E at a supply node (Medium / Hard). True if there was one to mine. */
function mineHere() {
  if (!pickups || pickups.autoCollect) return false;
  const hit = pickups.nearestWithin(player.position, MINE_REACH);
  if (!hit) return false;
  tools?.swing(hit.node.resource, hit.node);
  const res = miner.hit(hit.id, playMode.mineHits, { x: hit.node.x, y: hit.node.y + 0.9, z: hit.node.z });
  if (res.done) {
    miner.reset(hit.id);
    const i = pickups.nodes.indexOf(hit.node);
    if (i >= 0) pickups.collect(i);
  }
  return true;
}

async function main() {
  // Exposed early and updated as things come online: if a later step throws,
  // the console still has a handle to debug with instead of `undefined`.
  window.__game = { scene, renderer, camera, village, THREE };

  // Phase timings, so "it feels slow" can be answered with numbers.
  const timings = [];
  let mark = performance.now();
  const phase = (name) => {
    const now = performance.now();
    timings.push(`${name} ${Math.round(now - mark)}ms`);
    mark = now;
  };

  scene.add(await village.build());
  phase('village');
  const ring = await buildMountainRing(scene, BOUNDS);
  phase('mountains');
  say(`mountains: ${ring.pieceTypes} piece types, ${ring.meshCount} batches`);

  const dressing = await decorateVillage(village, scene);
  phase('dressing');
  say(`dressing: ${dressing.props} props, ${dressing.kinds} kinds, ${dressing.batches} batches`);

  // Nothing is standing yet: the quest chain builds the village as the child
  // earns it. Only the Mission School starts visible, because that is where
  // Zara begins.
  structures = await buildAllStructures(
    scene,
    (id) => (id === 'missionSchool' ? 99 : 0),
    (x, z) => village.heightAt(x, z)
  );
  scene.add(player);
  phase('structures');

  // AFTER the dressing AND the structures, so the crowd knows what is in its
  // way. Built before the dressing it had an empty village to plan routes
  // through, and then happily walked through the fountain, the stalls and the
  // market carts once they arrived. It was still built before the STRUCTURES,
  // though, which is why villagers strolled through the buildings: measured
  // 33 of 480 position samples inside a building over a simulated minute, and
  // the crowd was never handed a single building footprint to avoid.
  const buildingSolids = PLACEMENTS.map((p) => {
    const fp = structures.get(p.id)?.footprint;
    if (!fp || !Number.isFinite(fp.halfX)) return null;
    return { x: p.x, z: p.z, halfX: fp.halfX, halfZ: fp.halfZ, rotation: p.rotY ?? 0 };
  }).filter(Boolean);

  // The homes (Hard mode hides the Guidance Crystal in one). Built before the
  // crowd so the villagers walk round them.
  homes = buildHomes(scene, {
    heightAt: (x, z) => village.heightAt(x, z),
    isWalkable: (x, z) => village.isWalkable(x, z),
    existingSolids: [...(village.solids || []), ...(dressing.solids || []), ...buildingSolids],
  });
  for (const w of homes.warnings) console.warn(`[homes] ${w}`);

  villagers = new Villagers(scene, {
    // Ten people over nine roads and a plaza read as a deserted village: one
    // person per road, and a child could walk spawn-to-first-station and meet
    // nobody. The crowd is instanced per outfit - eight draw calls whatever
    // the headcount - so this costs triangles, not draw calls.
    village, count: 24,
    solids: [...(village.solids || []), ...(dressing.solids || []), ...buildingSolids, ...homes.solids],
  });
  phase('villagers');

  avatar = await loadAvatar();
  phase('avatar');
  player.add(avatar.group);
  say(avatar.isPlaceholder
    ? `avatar: built-in rig (${avatar.animations.join(', ')})`
    : `avatar: girl_scientist.glb (${avatar.animations.length} clips)`);

  // Quest state drives what is visible. Fully revealed until the HUD lands.
  // ?reset wipes the save - handy for testing and for a second child.
  const flags = new URLSearchParams(location.search);
  const wantSolved = flags.has('solved')
    // A hosted copy cannot rely on a query string surviving, so the page may
    // also ask for the solved state by setting this before the module runs.
    || window.__ROCKET_SOLVED === true
    || (START_SOLVED && !flags.has('play'));
  // ?jumpTo=<step id> (the grown-up Jump panel, unlock mode only): start
  // over and play the real chain up to that step.
  const jumpTo = isGrownUp() ? flags.get('jumpTo') : null;
  if (flags.has('reset') || wantSolved || jumpTo) {
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(`${STORE_KEY}_hunt`); } catch { /* private mode */ }
  }
  state = loadSave();
  engine = createQuestEngine(state);

  // ?solved - the finished village: bridge laid, rocket built, every question
  // answered, the launch still waiting for her to press it. For showing the
  // level to someone without playing forty minutes first, and for looking at
  // the end state, which is when the scene is at its most expensive.
  //
  // It walks the REAL chain rather than hand-setting flags, so what you see is
  // a state the game can actually reach - if a step were unreachable this
  // would stop at it, which makes it a test as well as a demo.
  if (wantSolved) solveEverything(engine);
  else if (jumpTo) {
    solveEverything(engine, jumpTo);
    saveGame(engine.state);
    flags.delete('jumpTo');
    history.replaceState(null, '', `${location.pathname}${flags.size ? `?${flags}` : ''}`);
  }
  addJumpPanel({
    title: 'Jump to a step',
    parts: (() => {
      let stage = 1;
      return QUEST_CHAIN.filter((st) => !st.optional).map((st) => {
        const part = { id: st.id, label: st.title, group: st.kind === 'launch' ? 'Launch' : `Rocket stage ${stage}` };
        if (st.kind === 'build') stage++;
        return part;
      });
    })(),
    onJump(id) {
      const f = new URLSearchParams(location.search);
      f.set('jumpTo', id); f.set('play', '');
      location.search = f.toString();
    },
  });

  // The launch complex, ported from the previous build and cel-shaded. Its five stages
  // register as effect targets so the quest chain builds the rocket exactly the
  // way it builds every other structure.
  rocket = new RocketComplex(scene, (x, z) => village.heightAt(x, z));
  for (const id of STAGE_IDS) {
    const handle = rocket.stageHandle(id);
    if (handle) structures.set(handle.id, handle);
  }
  structures.set('rocketPad.hologram', {
    id: 'rocketPad.hologram', label: 'Goal hologram', group: rocket.hologram,
    pieceCount: 1,
    showPieces: (n) => rocket.armHologram(n > 0),
    // armHologram, not .visible: the complex decides when the ghost retires
    // (once the real body is built), and nothing outside it should override that.
    reveal: (on) => rocket.armHologram(on),
    footprint: { x: 0, z: 0, radius: 0 },
  });

  hud = createHud({ mount: document.body, title: 'Chapter 3 - Ready for Lift-off' });
  // Two wrong tries on a question (lead rule): the chapter starts again.
  hud.onCorrect = () => { avatar?.play?.('cheer'); confetti(1800); };
  hud.onOutOfTries = () => {
    restarting = true; // no save on the way out (beforeunload below)
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(`${STORE_KEY}_hunt`); } catch { /* private mode */ }
    location.reload();
  };
  pickups = new Pickups(scene, { village, engine, hud });
  emotes = createEmotes({
    getAvatar: () => avatar, getTarget: () => player, height: AVATAR_HEIGHT,
    isBlocked: () => !!(hud && hud.isModalOpen()) || playBlocked() || !!(launch && launch.active),
    hint: (m) => hud.toast(m, 'info'),
  });

  effects = createEffectRunner({
    structures, village, sun,
    toast: (m) => { say(`  > ${m}`); hud.toast(m, 'good'); },
  });
  engine.onEffect((e) => effects.handle(e));
  // 'spawn' is the scene owner's job, not the structure runner's: it puts
  // physical, collectable nodes on the paths rather than crediting resources
  // silently, which is what makes gathering part of the journey.
  engine.onEffect((e) => {
    if (e.kind !== 'spawn') return;
    const each = NODE_YIELD[e.targetId] ?? 2;
    const nodes = Math.max(1, Math.ceil((e.count ?? each) / each));
    const placed = pickups.spawn(e.targetId, nodes, each);
    if (placed < nodes) {
      console.warn(`[pickups] only placed ${placed}/${nodes} ${e.targetId} nodes`);
    }
  });
  // createQuestEngine() normalises its input, so engine.state is NOT the object
  // passed in. Saving `state` persisted the boot-time snapshot and silently
  // threw away everything the child did.
  engine.onEffect(() => {
    hud.update(engine);
    engine.state.pickupNodes = pickups.serialise();
    saveGame(engine.state);
  });
  addEventListener('beforeunload', () => {
    if (restarting) return;
    engine.state.pickupNodes = pickups.serialise();
    saveGame(engine.state);
  });
  restoreWorld(effects, QUEST_CHAIN, (id) => engine.isComplete(id));

  // restoreWorld replays build/reveal but NOT spawn, and spawned nodes are
  // physical objects with positions. Replaying spawns would duplicate what was
  // already collected, so the node list is saved verbatim and restored as-is.
  if (Array.isArray(engine.state.pickupNodes)) {
    const n = pickups.restore(engine.state.pickupNodes);
    say(`restored ${n} uncollected supply nodes`);
  }

  // A handful of supplies on the road BEFORE the first test.
  //
  // step_cadet's wood and stone are on its `effects`, so they appear when the
  // Cadet Test is COMPLETED. But step_cadet's own missionText - the first
  // sentence a child ever reads - says "pick up the glowing crates on the
  // way". So the opening instruction sent her looking for crates that did not
  // exist yet, she walked the whole road, found nothing, and concluded the
  // game was broken. It is the worst kind of bug: it teaches a child in the
  // first minute that the instructions cannot be trusted.
  //
  // Fixing the world rather than the sentence, because walking a long empty
  // road is dull and picking something up is how she learns the mechanic
  // before it costs her anything. The big spawn on completion is untouched,
  // so the economy is unchanged - this is a few extra units, deliberately not
  // enough to matter to any build.
  //
  // `spawn` already refuses the river corridor, the far bank and building
  // footprints, so these land on the north road where she is.
  if (!engine.state.starterSupplies) {
    const wood = pickups.spawn('wood', 4, NODE_YIELD.wood ?? 2);
    const stone = pickups.spawn('stone', 3, NODE_YIELD.stone ?? 2);
    // The flag, not `nodes.length`, is what stops this running again: a child
    // who collects all of them and then reloads would otherwise be handed a
    // fresh set every time.
    engine.state.starterSupplies = true;
    engine.state.pickupNodes = pickups.serialise();
    saveGame(engine.state);
    say(`starter supplies: ${wood} wood, ${stone} stone on the north road`);
  }

  const step = engine.current();
  say(`quest: ${step ? step.id : 'complete'} - ${engine.progressPercent()}%`);
  if (step) say(`mission: ${step.missionText.slice(0, 70)}...`);

  // Solids: buildings block, the river blocks, the board edge clamps.
  controller = createCharacterController({
    target: player,
    // She is 1.15 units tall. The default 0.42 capsule made her 0.84 wide -
    // nearly as broad as she is high - which is most of why every object felt
    // like it had a force field around it.
    radius: 0.24,
    // One source of truth for ground height: the same function the tiles were
    // built from. Without this she walks at y=0 through a hilly board.
    // surfaceHeightAt, not heightAt: over a laid bridge the thing she stands
    // on is the deck, not the riverbed several units below it.
    heightField: (x, z) => village.surfaceHeightAt(x, z),
    bounds: { minX: BOUNDS.minX + 1, maxX: BOUNDS.maxX - 1, minZ: BOUNDS.minZ + 1, maxZ: BOUNDS.maxZ - 1 },
    // The river is a tile set, not a mesh, so it is cheaper and more exact to
    // reject blocked tiles than to build 448 box solids for it.
    resolveHorizontal: (cur, next, radius) => {
      if (village.isWalkable(next.x, next.z)) return;
      // Slide: keep whichever axis is still on walkable ground.
      if (village.isWalkable(next.x, cur.z)) { next.z = cur.z; return; }
      if (village.isWalkable(cur.x, next.z)) { next.x = cur.x; return; }
      next.x = cur.x; next.z = cur.z;
    },
  });

  // Buildings block as BOXES, sized from their own geometry (structures.js
  // measureFootprint). They used to block as a circle of a hardcoded 4.2 - so
  // she was stopped a body-length short of every wall, and blocked outright in
  // the empty air off each corner. A small inset lets her brush the wall
  // instead of stopping dead beside it.
  const WALL_INSET = 0.12;
  for (const p of PLACEMENTS) {
    const fp = structures.get(p.id)?.footprint;
    const base = village.heightAt(p.x, p.z);
    if (fp && Number.isFinite(fp.halfX) && Number.isFinite(fp.halfZ)) {
      controller.addBoxSolid(
        p.x, p.z,
        Math.max(0.3, fp.halfX - WALL_INSET),
        Math.max(0.3, fp.halfZ - WALL_INSET),
        p.rotY ?? 0, base, base + 14
      );
    } else {
      controller.addCircleSolid(p.x, p.z, 2.4, base, base + 14);
    }
  }

  // The launch complex is 14 units across and was completely walk-through.
  const pad = ROCKET_VILLAGE.rocketPad;
  const padY = village.heightAt(pad.x, pad.z);
  controller.addCircleSolid(pad.x, pad.z, 6.4, padY, padY + 20);

  // Trees, rocks and every piece of village dressing. Registering these is
  // what stops the player walking through the market and the forest.
  //
  // village.js's trees and rocks are genuinely round and still arrive as
  // {x, z, radius}. decoration.js's fences, hedges, stalls and carts are long
  // or rectangular and arrive as {x, z, halfX, halfZ, rotation} instead - a
  // circle at the centre of a fence rail left both ends open, which is how a
  // child walked between two posts that looked solid. Dispatch on shape
  // rather than on which list it came from, so either side can hand back
  // either kind.
  let solidCount = 0;
  for (const list of [village.solids, dressing.solids, homes.solids]) {
    for (const sdef of list || []) {
      const y = village.heightAt(sdef.x, sdef.z);
      if (sdef.halfX !== undefined) {
        controller.addBoxSolid(sdef.x, sdef.z, sdef.halfX, sdef.halfZ, sdef.rotation ?? 0, y, y + 6);
      } else {
        controller.addCircleSolid(sdef.x, sdef.z, sdef.radius, y, y + 6);
      }
      solidCount += 1;
    }
  }
  say(`solids: ${solidCount + PLACEMENTS.length + 1}`);

  launch = new LaunchSequence({ rocket, scene, camera, hud, engine });

  stations = new Stations(scene, { engine, village });
  // Name signs over every building and the pad, as in Chapters 1 and 2.
  nameSigns = createNameSigns(scene, {
    structures,
    placements: [
      ...PLACEMENTS,
      ...HOMES.map((h) => ({ id: h.id, x: h.x, z: h.z, label: `No. ${h.number}`, icon: '\u{1F3E0}', signY: 3.9 })),
    ],
    pad: ROCKET_VILLAGE.rocketPad, heightAt: (x, z) => village.heightAt(x, z),
  });

  // Play modes: navigation arrow, mining presses, Hard's treasure hunt.
  nav = createNavArrow(scene);
  miner = createMiner({ scene });
  tools = createToolHands({ getAvatar: () => avatar, getPlayer: () => player, height: AVATAR_HEIGHT });
  pickups.onCollect = (n) => flyToSupplies({ camera, canvas: renderer.domElement, from: { x: n.x, y: (n.y ?? 0) + 0.8, z: n.z }, cell: hud.resourceCell(n.resource), amount: n.amount });
  hunt = createHunt({
    data: huntFor(playLevel),
    storageKey: `${STORE_KEY}_hunt`,
    onFound: () => {
      engine.state.huntFound = true;
      saveGame(engine.state);
      if (keyBlock) keyBlock.visible = playMode.treasureHunt;
      audio.correct();
      hud.toast('Guidance Crystal found! The rocket can launch now.', 'good');
    },
  });
  // A save that says found and a hunt store that lost it (or the other way
  // round) agree on found.
  if (engine.state.huntFound && !hunt.isFound()) { hunt.state.found = true; hunt.state.started = true; }
  if (hunt.isFound() && !engine.state.huntFound) { engine.state.huntFound = true; saveGame(engine.state); }
  {
    // The crystal glows on a plinth at the door of its home once found.
    const at = hunt.data.steps[hunt.data.steps.length - 1].at;
    keyBlock = createKeyBlockMesh();
    keyBlock.position.set(at.x, village.heightAt(at.x, at.z), at.z - 0.5);
    keyBlock.visible = false;
    scene.add(keyBlock);
  }
  const LESSON_BEFORE = { rocket_thrust: LESSON_3A, rocket_fuel: LESSON_3C, bonus_mass: LESSON_3B, bonus_liftoff_mass: LESSON_3B };
  onInteract = () => {
    // Hard: the treasure hunt gets the first look at every press.
    if (playMode.treasureHunt && hunt && !crystalFound()) {
      const r = hunt.tryHere(player.position);
      // A wrong home's "not here" must not swallow E meant for a supply or a
      // station within reach: it answers only when nothing else is there.
      const busy = r?.kind === 'decoy' && ((!pickups.autoCollect && pickups.nearestWithin(player.position, MINE_REACH)) || stations.nearest);
      if (r && !busy) {
        if (r.kind === 'decoy') hud.toast(r.text, 'info');
        else if (r.kind === 'step') audio.correct();
        return;
      }
    }
    // Medium / Hard: supplies are mined with E, not swept up.
    if (mineHere()) return;
    const near = stations.nearest;
    if (!near) { say('  (nothing here - follow the gold marker)'); return; }
    // Ask the STATION what it has, rather than asking whether the one active
    // step happens to live here. Optional bonus puzzles are never the "current"
    // step by definition, so the old test could never offer one.
    const step = engine.availableAt(near.id);
    if (!step) {
      say(`  ${engine.stationMessage ? engine.stationMessage(near.id) : 'Not yet.'}`);
      return;
    }
    if (step.questionId) {
      const q = QUESTIONS[step.questionId];
      // A "watch, answer, try it" lesson the first time (LESSONS_PLAN.md):
      // 3A before Engine Thrust, 3C (energy) before the Fuel Mixture, 3B
      // before the two mass puzzles.
      const lesson = LESSON_BEFORE[step.questionId];
      if (lesson && !lessonSeen(lesson.id)) {
        lessonOnce(lesson).then(() => onInteract());
        return;
      }
      hud.askQuestion(q, (ok) => { if (ok) hud.update(engine); }, {
        // The ENGINE grades, not the HUD, so attempt counts and rewards stay in
        // one place and the HUD never becomes a second source of truth.
        validate: (given) => {
          const ok = engine.answer(step.questionId, given);
          if (ok) audio.correct(); else audio.wrong();
          return ok;
        },
      });
    } else if (step.cost) {
      // build() returns a RESULT OBJECT, always truthy. Truth-testing it told
      // the child "built!" for a build they could not afford.
      const res = engine.build(step.id);
      const ok = res === true || res?.ok === true;
      // A build that went through is announced by its own effect ("... is
      // being built!", then the stage's done line): no third message here.
      if (!ok) hud.toast(res?.message || shortfallMessage(engine, step) || 'Not enough supplies yet.', 'warn');
      hud.update(engine);
    } else if (step.id === 'step_launch' || step.kind === 'launch') {
      // ASK THE ENGINE FIRST. This used to start the flight and then tell the
      // engine, which meant the engine's refusal arrived too late to stop
      // anything - so the rocket could be launched again, and again, after it
      // had already flown.
      const gate = launchGate({ mode: playMode, found: crystalFound() });
      if (!gate.ok) {
        hud.toast(gate.message, 'warn');
        hud.update(engine);
        return;
      }
      if (engine.state.launched) {
        hud.toast(engine.launch?.()?.message || 'This rocket has already flown.', 'info');
        return;
      }
      // Lesson 3B if she skipped both mass puzzles, then the Launch Tuner:
      // she picks the tanks and the nose, test-flies them on the real sim,
      // and the launch flies the build she chose. Only a build that reached
      // space in a test can be launched, so the chapter's ending still comes.
      (async () => {
        await lessonOnce(LESSON_3B);
        const build = await openLaunchTuner({ mode: playMode?.id || 'medium' });
        if (!build) { hud.update(engine); return; }
        const res = engine.launch?.();
        if (res && res.ok === false) {
          hud.toast(res.message, 'info');
          hud.update(engine);
          return;
        }
        if (launch.start(build)) {
          window.__freezeCamera = true;
          hud.toast('Ignition!', 'good');
        }
        hud.update(engine);
      })();
    } else {
      hud.toast(step.title || 'Nothing to do here yet.', 'info');
    }
  };

  controller.teleport(
    ROCKET_VILLAGE.playerStart.x,
    village.heightAt(ROCKET_VILLAGE.playerStart.x, ROCKET_VILLAGE.playerStart.z),
    ROCKET_VILLAGE.playerStart.z
  );
  say(`spawn: ${ROCKET_VILLAGE.playerStart.x}, ${ROCKET_VILLAGE.playerStart.z}`);
  say('WASD move | Shift run | Space jump | E use | drag to turn');
  hud.update(engine);
  hud.setInventory(engine.state.inventory);

  renderer.render(scene, camera);
  freezeShadows(sun);
  phase('first frame');
  window.__loadTimings = timings;
  say(`load: ${timings.join(' | ')}`);
  document.getElementById('boot')?.classList.add('done');
  window.__game = { scene, renderer, camera, village, structures, controller, engine, effects, stations, hud, rocket, launch, pickups, villagers, avatar, nav, miner, hunt, homes, keyBlock, applyMode, getMode: () => playMode, emotes, THREE };

  // The opening: sweep down over the village to her, title card, a wave.
  story = createChapterStory({
    camera, chasePose, getAvatar: () => avatar, getPlayerPos: () => player.position, chapter: 3, level: playLevel,
  });
  window.__game.story = story;
  // The full opening (src/game/cutscenes.js): the jump in time, the town at sunrise, the
  // launch tower, then her. A returning child gets the title card only (story.intro).
  const intro = {
    eyebrow: 'Chapter 3',
    title: 'Ready for Lift-off',
    line: engine.state.launched ? `Welcome back, ${heroName()}! The rocket has flown.` : `Build a real rocket, ${heroName()}: answer the science questions, build it stage by stage, and launch it.`,
    lookAt: new THREE.Vector3(0, 0, -8),
  };
  opening = createOpening({
    camera, scene, sun, ground: (x, z) => village.heightAt(x, z), chasePose, getAvatar: () => avatar,
    chapter: 3, level: playLevel, title: intro.title, line: intro.line,
  });
  if (story.seen()) await story.intro(intro);
  else await opening.play();

  // Mode: first visit asks (like Chapter 4), a chip changes it later.
  applyMode(loadPlayMode());
  modeChip = createModeChip({ level: playLevel, onChange: (id) => applyMode(PLAY_MODES[id]) });
  if (savedPlayModeId() === null) {
    chooserOpen = true;
    try { await choosePlayMode({ level: playLevel }); } finally { chooserOpen = false; }
    applyMode(loadPlayMode());
  }
}

/** Where the chase camera wants to be right now (also the end of the opening sweep). */
function chasePose() {
  const p = player.position;
  const dist = 7.2, height = 3.4;
  return {
    pos: new THREE.Vector3(p.x + Math.sin(cameraYaw) * dist, p.y + height, p.z + Math.cos(cameraYaw) * dist),
    look: new THREE.Vector3(p.x, p.y + 1.1, p.z),
  };
}

function updateCamera(dt) {
  // Capture/debug escape hatch: with this set, the follow camera stops fighting
  // a manually placed one. Without it, any camera framed from the console is
  // lerped back onto the player within a frame.
  if (window.__freezeCamera) return;
  const p = player.position;
  const { pos: want, look } = chasePose();
  camera.position.lerp(want, 1 - Math.pow(0.0001, dt));
  camera.lookAt(look);

  // Shadow frustum follows the player, so a big board keeps a tight map.
  // freezeShadows() stops the map re-rendering, so moving the light without
  // re-baking left shadows stitched to wherever she spawned. Re-bake only when
  // she has actually left the baked area - cheap, and correct everywhere.
  sun.target.position.set(p.x, 0, p.z);
  sun.position.set(p.x + 22, 40, p.z + 18);
  if (Math.hypot(p.x - shadowAnchor.x, p.z - shadowAnchor.z) > 18) {
    shadowAnchor.set(p.x, 0, p.z);
    refreshStaticShadows(sun);
  }
}

function fit() {
  const w = mount.clientWidth, h = mount.clientHeight;
  // A mount that gets its layout AFTER this module runs - a background tab,
  // an iframe sized later, a pane that starts hidden - can measure 0x0 on
  // this call. setSize(0, 0) would commit a zero-area viewport, and nothing
  // would ever correct it: the window itself never resizes, so the game
  // would render a black screen forever. Skipping a zero-size measurement
  // leaves the last good size in place and lets the observer below re-fit
  // the instant the container actually gets one.
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);
// The window 'resize' event only fires when the WINDOW changes size. A mount
// element can change size for other reasons entirely - a flex/grid layout
// settling after load, a split pane being dragged, the element becoming
// visible after starting `display:none` - and none of those fire a window
// resize. Watching the element itself is what lets the renderer recover on
// its own instead of staying stuck at whatever it first measured.
new ResizeObserver(fit).observe(mount);

let frames = 0, last = performance.now();
const startedAt = performance.now();
let prev = performance.now();

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  tick(dt, now);
}

/** One frame of everything. Split from frame() so tests can step it by hand. */
function tick(dt, now = performance.now()) {

  // While the rocket is flying it owns the camera and the player is a passenger.
  const flying = launch && launch.update(dt);
  // ...and it must give control back. Without this the session ended at apogee:
  // frozen camera, no movement, dark sky, forever.
  if (launch && launch.finished && !launch.handedBack) {
    launch.handedBack = true;
    const walkBack = () => {
      launch.reset();
      window.__freezeCamera = false;
      hud?.toast(`${heroName()} walks back into town.`, 'info');
    };
    // The chapter's ending, over the rocket up in the sky: confetti and the
    // "Chapter 3 complete" card pointing at Chapter 4.
    setTimeout(async () => {
      if (!story) { walkBack(); return; }
      // A flight that reached orbit first flies the arrival (src/game/cutscenes.js), once per Level.
      // Its orbit stays on screen behind the card until she leaves the card.
      const orbit = launch.verdict?.verdict === 'orbit' ? createArrival({ renderer, rocket, level: playLevel }) : null;
      if (orbit && !orbit.seen()) { arrivalNow = orbit; await orbit.play(); }
      story.outro({
        title: 'Lift-off! The rocket is in space!',
        line: `You did it, ${heroName()}! Every stage built, every question answered. Next: fly that rocket all the way to Europa, Jupiter's icy moon.`,
        focus: null,
        next: { href: 'chapter4.html', label: 'Next: Chapter 4 — Voyage to Europa' },
      }).then((how) => {
        if (arrivalNow) { arrivalNow.stop(); arrivalNow = null; }
        if (how === 'stay') walkBack();
      });
    }, 1500);
  }
  let motion = null;
  if (controller && !flying) {
    motion = controller.step(dt, emotes ? emotes.input(readInput(), dt) : readInput());
    if (motion && motion.moving && motion.onGround) audio.footstep(motion.running);
    if (!opening?.update(dt) && !story?.update(dt)) updateCamera(dt);
  }
  // Her legs come from the same state the footsteps do, so a step is heard on
  // the frame the foot is planted. Passed null while the rocket has her, which
  // drops her to idle rather than walking through the sky.
  if (avatar) avatar.update(dt, motion);
  if (effects) effects.update();
  if (village) village.update(elapsed);
  if (villagers) villagers.update(dt, elapsed);
  if (nameSigns) nameSigns.update(player.position, camera.position);
  if (pickups) pickups.update(elapsed, player.position);
  if (miner) miner.update(dt);
  if (tools) tools.update(dt);
  if (nav) {
    nav.setTarget(playMode.navArrow || playMode.targetBeacon ? objective() : null);
    nav.update(dt, player.position);
  }
  if (stations) {
    elapsed += dt;
    const near = stations.update(elapsed, player.position);
    if (hud) {
      const step = engine && engine.current();
      const isTarget = near && step && step.stationId === near.id;
      const mineable = pickups && !pickups.autoCollect ? pickups.nearestWithin(player.position, MINE_REACH) : null;
      if (hud.isModalOpen() || playBlocked()) hud.hideInteract();
      else if (mineable) hud.setInteract(`Mine ${mineable.node.resource}`, 'E');
      else if (huntZoneHere()) hud.setInteract('Look here', 'E');
      else if (!near) hud.hideInteract();
      else hud.setInteract(isTarget ? (step.title || 'Start') : 'Not yet', isTarget ? 'E' : '');
    }
  }
  // The orbit arrival draws its own scene while it is on screen.
  if (!arrivalNow?.render(dt)) renderer.render(scene, camera);

  frames += 1;
  if (now - startedAt < 2500) { frames = 0; last = now; return; }
  if (now - last >= 1000) {
    const info = renderer.info.render;
    const hidden = document.visibilityState !== 'visible';
    document.getElementById('perf').textContent =
      `${hidden ? `${frames} fps (THROTTLED - hidden)` : `${frames} fps`}` +
      ` | ${info.calls} calls (budget ${BUDGET.drawCalls}) | ${info.triangles.toLocaleString()} tris` +
      ` | pos ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`;
    frames = 0; last = now;
  }
}

/** Test hook: run `seconds` of game time now (the pane only animates while visible). */
window.__gameRun = (seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) tick(dt); };
/** Test hook: turn the chase camera (radians; 0 looks north up the road). */
window.__gameSetYaw = (y) => { cameraYaw = y; };

fit();
frame();
main().catch((err) => {
  // A failure here used to leave a half-built world and no error anywhere
  // obvious - the game rendered, so it looked fine until something was missing.
  console.error('[gameScene] startup failed:', err);
  say(`STARTUP FAILED: ${err?.message || err}`);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('done');
    boot.innerHTML = `<h1>Something went wrong</h1><p>${err?.message || err}</p>`;
  }
});
