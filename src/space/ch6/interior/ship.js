// Chapter 6, Part B: inside the ship for the stars (lead 2026-10-08: "Star
// Trek for now"). Replaces the round hall in the rock (habitat.js): the
// crew lives in the spinning ring, on four decks joined by a lift (decks.js).
// She walks a deck like a village (surface/walker.js, gait 'earth'; W/S A/D
// relative to the camera, Shift runs, Space jumps, drag to look), walls and
// props stop her (walkmap.js), doors slide open as she comes, and in the lift
// the keys 1-4 pick a deck. The crewmate who leads a station stands by it;
// the next station has a beacon (on another deck, the beacon is on the lift
// and a toast says which deck). At a station "E" opens it (onStation(id)).
// The walk takes its spots from the caller: stations (STATIONS, the default)
// or quests (QUESTS, partQuests.js); each spot is { id, lead, title } and is
// found on its deck by id (decks.js).
//
// main.js's runScene contract: { scene, camera, start(), tick(), dispose() }.
// start() resolves { done: [ids] } once every spot in `order` is done.
// Test hook: scene.debug = { walker, stations, done, deck, place(x, z),
// goTo(id), pressE(), takeLift(deckId) }.
import * as THREE from 'three';
import { createWalker } from '../../surface/walker.js';
import { createOverlay } from '../../surface/overlay.js';
import { t } from '../../level.js';
import { STATIONS } from '../stationsLogic.js';
import { CREW_INFO } from '../crewInfo.js';
import { buildCrew } from '../crew.js';
import { createKit } from './kit.js';
import { createWalkMap } from './walkmap.js';
import { DECKS, DECK_MODELS, deckOf, START_DECK } from './decks.js';
import { loadModels } from './models.js';
import { createNavArrow } from '../../../play/navArrow.js';

const REACH = 1.6;     // how close to a station's spot to press E
const LIFT = { x0: -1.2, x1: 1.2, z0: -2.4, z1: 0 };
const LIFT_TIME = 1.4; // doors shut, fade, travel, fade in
export const LIFT_OUT = { x: 0, z: 2.8, face: 0 }; // where she steps out: 2.8 m past the door (the most that fits on every deck), facing away from it
// The follow camera (lead 2026-10-09: "the camera should be behind her by default, like Chapter 3 following the girl").
// The chase camera before it lifted, turned and faded her, and she was hidden. This one is plain and fixed: the camera
// stands behind her back, CAM_DIST away and CAM_RISE above her feet, and looks at her upper body (TARGET_UP), so her
// whole body is in view. It never moves its distance or pitch by itself, never collides, and never fades her: a wall on
// the sight line is cut away instead (cutAway below). Its yaw eases to her heading only while she walks forward, so a
// drag, a strafe or a step back holds it, and a bump leaves it where it is.
export const CAM_DIST = 3.0; // behind her (m)
export const CAM_RISE = 1.5; // the camera's height above her feet (m): from 3 m back her whole body is in view
export const CAM_OVER = { dist: 2.6, rise: 2.8 }; // the 'over' view (toggleView): the same follow, higher and steeper
export const CAM_NEAR = 0.1; // the near plane (m)
// The 'follow' view (toggleView): the camera is locked behind her back like a spaceship's, and she steers like one:
// Left/Right turn her on the spot (TURN_RATE rad/s, eased by TURN_EASE), Up/Down walk along her heading.
export const TURN_RATE = 2.1;
const TURN_EASE = 12; // how fast her turn comes up to speed and stops (1/s)
const FOLLOW_VIEW = 40; // the camera turns with her heading at this rate (1/s): a tiny smoothing, about 3 degrees behind in a turn
const LOOK_BACK = 1.5; // a drag looks round in this view, and eases back to her back at this rate (1/s)
const TARGET_UP = 1.1; // she is looked at this far above her feet (her upper body)
const CUT_R = 0.45; // the cut-away tube round the sight line (m): walls on that line inside it are not drawn
const CHASE_SMOOTH = 0.15; // the point the camera looks at trails her by this (s, critically damped)
const CHASE_SNAP = 2; // ... and jumps to her when she is this far off (m): a lift ride, a place()
const FOLLOW_GAIN = 0.9; // how fast the camera turns to her heading (1/s of the angle)
const YAW_RATE_MAX = 1.1; // ... and never faster than this (rad/s)
const FOLLOW_LO = 0.3; // it follows only while she walks forward: from FOLLOW_LO up to FOLLOW_HI (m/s)
const FOLLOW_HI = 1.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const inLift = (x, z) => x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < LIFT.z1 - 0.2;
// The camera button (toggleView) keeps its choice for the session and cycles: 'behind' (her follow view, the default, as in
// Chapters 1-2), 'follow' (locked behind her back, tank steering: see TURN_RATE) or 'over' (a higher, steeper look down on
// her, the same follow).
const VIEWS = ['behind', 'follow', 'over'];
let viewMode = 'behind';

// The cut-away: every deck material discards the fragments inside a tube from the camera to her upper body (a wall, a
// prop or a lift car on that line), so nothing stands between the camera and her. One set of uniforms for all of them.
const CUT = { a: { value: new THREE.Vector3() }, b: { value: new THREE.Vector3() }, r: { value: CUT_R } };
/** Patch one material so its fragments in the cut-away tube are dropped (the walls are merged per material, so this cuts a piece, not a wall). */
function cutAway(m) {
  if (m.userData.cutAway) return;
  m.userData.cutAway = true;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uCutA: CUT.a, uCutB: CUT.b, uCutR: CUT.r });
    shader.vertexShader = `varying vec3 vCutPos;\n${shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vCutPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')}`;
    shader.fragmentShader = `uniform vec3 uCutA;\nuniform vec3 uCutB;\nuniform float uCutR;\nvarying vec3 vCutPos;\n${shader.fragmentShader.replace('void main() {', `void main() {
  { vec3 ab = uCutB - uCutA; float tt = dot(vCutPos - uCutA, ab) / dot(ab, ab);
    if (tt >= 0.0 && tt <= 1.0 && length(vCutPos - (uCutA + ab * tt)) < uCutR) discard; }`)}`;
  };
  m.customProgramCacheKey = () => `cutaway:${m.type}`;
}
/** Cut away every material under a group (her own materials are not passed here). */
function cutAwayUnder(group) {
  group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) cutAway(m); });
}

// Scratch objects for the camera (no allocation a frame): the pose chaseFrame reads, and her walk's axes (tick).
const _her = { x: 0, y: 0, z: 0, heading: 0, speed: 0, want: 0, rise: 0, follow: false };
const _f = { x: 0, z: 0 }; const _rt = { x: 0, z: 0 }; const _cam = { x: 0, y: 0, z: 0 };

// The follow rig: the point the camera looks at (a critically damped follow), the turn that follows her heading.
// One per scene, reused each frame.
let _dampV = 0; // the velocity the last damped() left
/** Critically damped follow (Unity's SmoothDamp) of one axis: the new value; its velocity goes to _dampV. */
function damped(cur, vel, target, dt) {
  const w = 2 / CHASE_SMOOTH; const x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - target; const tmp = (vel + w * ch) * dt;
  _dampV = (vel - w * tmp) * e;
  return target + (ch + tmp) * e;
}
/** A fresh rig: the camera's distance and height are set by chaseFrame (dist, cy). */
export function createChaseRig() {
  return { live: false, fx: 0, fy: 0, fz: 0, vx: 0, vy: 0, vz: 0, follow: 0, yawRate: 0, dist: CAM_DIST, cy: CAM_RISE };
}
/**
 * One frame of the follow camera. `s` = { x, y, z (her feet), heading, speed, want (the distance behind her), rise (the
 * height above her feet), follow (true while she walks forward: the view turns to her heading) }; `cam` = { yaw } is
 * turned in place. The rig then holds the point to look at (fx, fy, fz), the distance (dist) and the camera's height
 * (cy). The distance and height are the ones asked for, always: nothing moves them.
 */
export function chaseFrame(rig, cam, s, dt) {
  // The point to look at trails her, and jumps to her only after a teleport (a lift ride, a place()).
  if (!rig.live || Math.hypot(s.x - rig.fx, s.z - rig.fz) > CHASE_SNAP) {
    rig.live = true; rig.fx = s.x; rig.fy = s.y; rig.fz = s.z; rig.vx = 0; rig.vy = 0; rig.vz = 0;
    rig.yawRate = 0; rig.follow = 0;
  } else {
    rig.fx = damped(rig.fx, rig.vx, s.x, dt); rig.vx = _dampV;
    rig.fy = damped(rig.fy, rig.vy, s.y, dt); rig.vy = _dampV;
    rig.fz = damped(rig.fz, rig.vz, s.z, dt); rig.vz = _dampV;
  }
  rig.dist = s.want; rig.cy = s.y + s.rise;
  // The turn: the camera comes round to her heading only while she walks forward, and that weight eases in slowly and out
  // quickly, so a stop ends the swing at once. A held strafe or a step back keeps the view (a turn that follows her
  // keys would spin the view under her).
  const k0 = s.follow ? clamp((s.speed - FOLLOW_LO) / (FOLLOW_HI - FOLLOW_LO), 0, 1) : 0;
  const k = k0 * k0 * (3 - 2 * k0);
  rig.follow += (k - rig.follow) * (1 - Math.exp(-dt * (k > rig.follow ? 3 : 8)));
  const rate = clamp(angDiff(s.heading, cam.yaw) * FOLLOW_GAIN, -YAW_RATE_MAX, YAW_RATE_MAX) * rig.follow;
  rig.yawRate += (rate - rig.yawRate) * (1 - Math.exp(-dt * 6));
  cam.yaw += clamp(rig.yawRate, -YAW_RATE_MAX, YAW_RATE_MAX) * dt;
}

/** The lift car every deck shares (built once per deck, at the origin). */
function buildLift(kit) {
  const g = new THREE.Group();
  const b = kit.batch();
  const h = 2.8;
  b.box(2.6, h, 0.2, kit.mats.wallDark, 0, h / 2, LIFT.z0 - 0.1);
  b.box(0.2, h, 2.6, kit.mats.wallDark, LIFT.x0 - 0.1, h / 2, -1.2);
  b.box(0.2, h, 2.6, kit.mats.wallDark, LIFT.x1 + 0.1, h / 2, -1.2);
  b.box(2.6, 0.1, 2.6, kit.mats.ceiling, 0, h, -1.2);
  b.box(2.4, 0.04, 2.4, kit.mats.deck, 0, 0.02, -1.2);
  // Light rails up the corners, a ring light on the roof.
  for (const x of [-1.1, 1.1]) b.box(0.05, h - 0.3, 0.05, kit.mats.cove, x, h / 2, LIFT.z0 + 0.06);
  b.cyl(0.5, 0.5, 0.03, kit.mats.coveCool, 0, h - 0.04, -1.2, { seg: 32 });
  b.flush(g);
  const panel = kit.screen(0.7, 0.9, { title: 'LIFT', accent: 0xcc99cc, seed: 11 });
  panel.position.set(1.08, 1.4, -1.2); panel.rotation.y = -Math.PI / 2; g.add(panel);
  const door = kit.door(0, 0.05, 0, { w: 2.0, h: 2.5 });
  g.add(door.group);
  return { group: g, door, floor: { rect: [0, -1.2, 2.4, 2.4] } };
}

let modelsReady = null;
/** Load the decks' model pieces (once). Await it before createInteriorScene. */
export function preloadInterior({ style } = {}) {
  modelsReady ??= loadModels(DECK_MODELS, { style }).catch((err) => { console.error('[interior] models failed to load', err); modelsReady = null; return null; });
  return modelsReady;
}

/**
 * @param {object} game
 * @param {{ spots?: object[], order?: string[], done?: string[], onStation: (id:string) => Promise<any>, startDeck?: string, models?: object, gait?: 'earth'|'lope' }} opts
 *   spots: what to visit (default the six stations; the quests pass theirs)
 *   models: the result of preloadInterior() (a deck without models falls back to its own code-built parts)
 *   gait: 'earth' (default, Chapter 6's spin weight) or 'lope' (the Moon's floaty step, Chapter 7's low push)
 */
export function createInteriorScene(game, { spots = STATIONS, order = spots.map((s) => s.id), done: doneAlready = [], onStation, startDeck = START_DECK, models = null, gait = 'earth' }) {
  const renderer = game.renderer;
  const hud = game.hud || null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c12);
  scene.fog = new THREE.Fog(0x0a0c12, 30, 70);
  const camera = new THREE.PerspectiveCamera(60, 1, CAM_NEAR, 300);
  // Soft fill only (issue d): the decks' own coves, screens and lamps do the rest.
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x4a4454, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e0, 0.6); key.position.set(3, 10, 4); scene.add(key);

  const kit = createKit({ models });
  const crew = buildCrew();
  const decks = {};
  for (const spec of DECKS) {
    const d = spec.build(kit);
    const lift = buildLift(kit);
    d.group.add(lift.group);
    d.lift = lift;
    d.spec = spec;
    // The roof above each point: the deck's own (its rooms are not all one height), else its ceiling.
    d.roof = d.ceilingAt ?? (() => d.ceiling ?? 3.2);
    d.map = createWalkMap({ floors: [...d.floors, lift.floor], solids: d.solids });
    decks[spec.id] = d;
  }

  // Spots (stations or quests): where each one is, on which deck.
  // A spot may also name its deck and borrow another spot's place there
  // (`{ id, deck, near: 'pack' }`): Chapter 7's room tasks reuse the decks'
  // station places without touching the deck files.
  const stations = spots.map((info) => {
    const deck = info.deck || deckOf(info.id);
    const s = decks[deck]?.stations?.[info.near || info.id];
    if (!s) throw new Error(`[interior] ${info.id} has no spot on deck ${deck}`);
    return { ...info, deck, ...s, done: doneAlready.includes(info.id) };
  });
  // Each crewmate on the deck of their first spot, at the deck's crew spot for
  // that spot (or for the crewmate), or a step beside that spot.
  for (const id of crew.ids) {
    const st = stations.find((s) => s.lead === id);
    const deckId = st?.deck || START_DECK;
    const d = decks[deckId];
    const spot = d.crewSpots?.[st?.id] || d.crewSpots?.[id] || (st && { x: st.x + Math.cos(st.face) * 1.2, z: st.z - Math.sin(st.face) * 1.2, face: st.face });
    if (!spot) continue;
    const c = crew[id];
    c.root.position.set(spot.x, 0, spot.z);
    c.root.rotation.y = spot.face;
    d.group.add(c.root);
    d.solids.push({ disc: [spot.x, spot.z, 0.4] });
    d.map = createWalkMap({ floors: [...d.floors, d.lift.floor], solids: d.solids });
  }

  // The cut-away (chaseFrame's camera): every deck material, the crew and the lift car included (her own are not in the decks yet).
  for (const d of Object.values(decks)) cutAwayUnder(d.group);
  // The direction arrow: the Chapter 1-3 ground chevron, pointing to the next station (or the lift, when it is on another deck).
  const nav = createNavArrow(scene);
  nav.setBeacon(false); // the beacon below marks the station
  const navTarget = { x: 0, z: 0, label: '' };
  // The beacon: a glowing ring on the floor where she stands, and a small
  // arrow bobbing over it (a tall see-through column hid the console and
  // tinted the whole view once the camera was inside it).
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false });
  const beacon = new THREE.Group();
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40).rotateX(Math.PI / 2), beaconMat);
  beaconRing.position.y = 0.03;
  const beaconArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4).rotateX(Math.PI), beaconMat);
  beacon.add(beaconRing, beaconArrow);
  cutAwayUnder(beacon);

  // Her.
  // 'lope' (the gentle push's walk) is the Moon's floaty hop: a look, not the push. The pull she feels in the
  // ship is 1/100 of Earth's (0.098 m/s²); the 1.6 here only sets the hop's timing. Chapter 6 keeps its spin weight.
  const walker = createWalker({ gravity: gait === 'earth' ? 9.8 * 0.6 : 1.6, gait });
  walker.helmet.visible = false;
  if (walker.pack) walker.pack.visible = false;
  walker.root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'TorusGeometry') o.visible = false; });
  const terrain = { heightAt: () => 0 };

  let deck = null;
  function showDeck(id, at = null) {
    if (deck) scene.remove(deck.group);
    deck = decks[id];
    scene.add(deck.group);
    deck.group.add(walker.root);
    deck.group.add(beacon);
    const p = at || { x: 0, z: 1.4, face: 0 };
    walker.place(p.x, 0, p.z, p.face);
    deck.map.reset(p.x, p.z);
    cam.yaw = p.face;
    rig.live = false; // the camera's point jumps to her on the new deck (chaseFrame)
    paintStations();
  }

  const overlay = createOverlay();
  const cam = { yaw: 0, look: 0 }; // look: a drag's turn in the follow view (eases back)
  const rig = createChaseRig(); // where the camera looks, how far and how high (chaseFrame)
  const _move = new THREE.Vector2();
  const _v = new THREE.Vector3();
  let clock = 0; let busy = false; let disposed = false; let prevE = false; let prevJump = false;
  let turnRate = 0; // her turn on Left/Right in the follow view (rad/s, eased)
  let lift = null; // { to, t } while the lift runs
  let finish;
  const finished = new Promise((r) => { finish = r; });
  const isDown = (code) => !!game.controls?.isDown?.(code);

  const nextStation = () => {
    for (const id of order) { const st = stations.find((s) => s.id === id); if (st && !st.done) return st; }
    return null;
  };
  function paintStations() {
    for (const st of stations) st.lamp?.material?.color?.copy(new THREE.Color(st.done ? 0x9fe8a8 : 0xffd27a).multiplyScalar(1.8));
    const n = nextStation();
    beacon.visible = !!n && !!deck;
    if (n && deck) {
      if (n.deck === deck.spec.id) beacon.position.set(n.x, 0, n.z);
      else beacon.position.set(0, 0, -1.2);
    }
  }

  async function use(st) {
    if (busy || st.done) return;
    busy = true;
    overlay.hidePrompt();
    crew.wave(st.lead);
    try { await onStation(st.id); st.done = true; } finally { busy = false; }
    paintStations();
    const n = nextStation();
    if (!n) finishSoon = 1.2;
    else hud?.toast?.(nextText(n), { kind: 'info', ms: 3600 });
  }
  const nextText = (n) => {
    const where = n.deck === deck.spec.id ? '' : t(` Take the lift to Deck ${decks[n.deck].spec.n}.`, ` Take the lift to Deck ${decks[n.deck].spec.n}.`);
    return t(`Next: ${n.title[0]} with ${CREW_INFO[n.lead].name}.${where}`, `Next: ${n.title[1]}!${where}`);
  };
  let finishSoon = -1;

  // --- the lift: a small deck panel, then a fade -----------------------------------------
  let panel = null;
  function openLiftPanel() {
    if (panel || lift) return;
    const n = nextStation();
    panel = document.createElement('div');
    panel.className = 'rv-lift';
    Object.assign(panel.style, {
      position: 'fixed', right: '24px', top: '50%', transform: 'translateY(-50%)', zIndex: 60, padding: '12px', borderRadius: '18px 6px 6px 18px',
      background: 'rgba(8,10,16,.92)', border: '2px solid #cc99cc', font: '600 15px system-ui, sans-serif', color: '#ffcc99', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '230px',
    });
    const head = document.createElement('div'); head.textContent = t('Lift: pick a deck', 'Lift: pick a deck'); head.style.cssText = 'color:#cc99cc;padding:2px 4px 6px';
    panel.appendChild(head);
    for (const spec of DECKS) {
      const bt = document.createElement('button');
      bt.type = 'button';
      const here = spec.id === deck.spec.id;
      const isNext = n && n.deck === spec.id;
      bt.textContent = `${spec.n}  ${t(spec.name[0], spec.name[1])}${here ? t(' (here)', ' (here)') : ''}${isNext && !here ? '  ←' : ''}`;
      bt.disabled = here;
      bt.style.cssText = `text-align:left;padding:8px 12px;border-radius:14px 4px 4px 14px;border:0;font:inherit;cursor:pointer;color:#05060a;background:${isNext && !here ? '#ff9c3a' : here ? '#555' : '#9fb4ff'}`;
      bt.addEventListener('click', () => takeLift(spec.id));
      panel.appendChild(bt);
    }
    for (const ev of ['pointerdown', 'mousedown', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(panel);
  }
  function closeLiftPanel() { panel?.remove(); panel = null; }
  let fade = null;
  function setFade(k, label) {
    if (!fade) {
      fade = document.createElement('div');
      Object.assign(fade.style, { position: 'fixed', inset: 0, zIndex: 55, pointerEvents: 'none', background: '#05060a', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 26px system-ui, sans-serif', color: '#ffcc99', letterSpacing: '.08em' });
      document.body.appendChild(fade);
    }
    fade.style.opacity = String(k);
    if (label != null) fade.textContent = label;
  }
  function takeLift(id) {
    if (lift || !decks[id] || id === deck.spec.id) return;
    closeLiftPanel();
    lift = { to: id, t: 0, swapped: false };
  }
  function runLift(dt) {
    lift.t += dt;
    const k = lift.t / LIFT_TIME;
    const spec = decks[lift.to].spec;
    setFade(k < 0.35 ? k / 0.35 : k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35), `DECK ${spec.n}  ·  ${t(spec.name[0], spec.name[1]).toUpperCase()}`);
    if (!lift.swapped && k >= 0.5) { lift.swapped = true; showDeck(lift.to, LIFT_OUT); }
    if (k >= 1) {
      lift = null; setFade(0);
      const n = nextStation();
      if (n && n.deck === deck.spec.id) hud?.toast?.(nextText(n), { kind: 'info', ms: 3200 });
    }
  }

  // forward: she walks forward on her own keys (no strafe, no step back), so the view may turn to her heading.
  function updateCamera(dt, mouse, forward) {
    const follow = viewMode === 'follow';
    if (follow) {
      // Locked behind her back: the view is her heading plus a drag's look, which eases back. Only the tiny smoothing.
      if (mouse) cam.look -= (mouse.dx || 0) * 0.0055;
      cam.look *= Math.exp(-dt * LOOK_BACK);
      cam.yaw += angDiff(walker.heading + cam.look, cam.yaw) * (1 - Math.exp(-dt * FOLLOW_VIEW));
      rig.yawRate = 0; rig.follow = 0; // chaseFrame's own turn is not used in this view
    } else if (mouse) cam.yaw -= (mouse.dx || 0) * 0.0055; // a drag turns the view; it swings back to her heading as she walks
    // Her feet and heading. The camera follows the rig's point, not her feet, so a bump does not jerk it.
    _her.x = walker.pos.x; _her.y = walker.pos.y; _her.z = walker.pos.z; _her.heading = walker.heading;
    _her.speed = Math.hypot(walker.vel.x, walker.vel.y); _her.follow = !follow && !!mouse && !mouse.dragging && forward;
    const over = viewMode === 'over';
    _her.want = over ? CAM_OVER.dist : CAM_DIST;
    _her.rise = over ? CAM_OVER.rise : CAM_RISE;
    chaseFrame(rig, cam, _her, dt);
    _cam.x = rig.fx - Math.sin(cam.yaw) * rig.dist; _cam.y = rig.cy; _cam.z = rig.fz - Math.cos(cam.yaw) * rig.dist;
    camera.position.set(_cam.x, _cam.y, _cam.z);
    camera.lookAt(rig.fx, rig.fy + TARGET_UP, rig.fz);
    CUT.a.value.set(_cam.x, _cam.y, _cam.z);
    CUT.b.value.set(rig.fx, rig.fy + TARGET_UP, rig.fz);
    // She is always in view: the camera never fades her or hides her; a wall on the sight line is cut away (CUT).
    walker.root.visible = true;
  }

  const collide = (p, v) => deck.map.collide(p, v);
  function tick(dt, input, mouse, modalOpen = false) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    const modal = !!modalOpen || busy || !!lift;
    const eDown = !modal && isDown('KeyE');
    const pressedE = eDown && !prevE; prevE = eDown;
    const inp = input || { thrust: 0, turn: 0 };
    let speed;
    if (!modal) {
      const run = !!inp.precision || isDown('ShiftLeft') || isDown('ShiftRight');
      let face = null; // the follow view: her heading after this frame's turn
      if (viewMode === 'follow') {
        // Tank steering: Right turns her right (her heading runs the other way: a bigger heading faces her left), Up/Down walk along it.
        turnRate += (-(inp.turn || 0) * TURN_RATE - turnRate) * (1 - Math.exp(-dt * TURN_EASE));
        face = walker.heading + turnRate * dt;
        walker.heading = face;
        _move.set(Math.sin(face) * (inp.thrust || 0), Math.cos(face) * (inp.thrust || 0));
      } else {
        const f = _f; const rt = _rt; // her walk's axes (camera-relative), no allocation a frame
        f.x = Math.sin(cam.yaw); f.z = Math.cos(cam.yaw); rt.x = -f.z; rt.z = f.x;
        _move.set(f.x * (inp.thrust || 0) + rt.x * (inp.turn || 0), f.z * (inp.thrust || 0) + rt.z * (inp.turn || 0));
      }
      if (_move.lengthSq() > 1) _move.normalize();
      speed = walker.move(dt, { dir: _move, run, jump: !!inp.steady && !prevJump, terrain, collide });
      // Walking back does not turn her round: her heading is what the turn set (the walk eases her face to her step).
      if (face !== null) walker.heading = face;
      prevJump = !!inp.steady;
    } else {
      turnRate = 0;
      _move.set(0, 0);
      speed = walker.move(dt, { dir: _move, run: false, jump: false, terrain, collide });
    }
    walker.events.splice(0);
    walker.sync();
    walker.animate(dt, speed);
    crew.update(dt);
    const hx = walker.pos.x; const hz = walker.pos.z;
    deck.update?.(dt, clock, { herX: hx, herZ: hz });
    deck.lift.door.update(dt, hx, hz, lift ? 0 : null);
    beaconMat.opacity = 0.55 + 0.3 * Math.sin(clock * 3);
    beaconRing.scale.setScalar(1 + 0.08 * Math.sin(clock * 3));
    beaconArrow.position.y = 2.5 + 0.12 * Math.sin(clock * 2.2);
    beaconArrow.rotation.y = clock * 1.5;
    // The beacon on the lift: hidden while she is by the lift door (in it, or just out of it).
    const nx = nextStation();
    beacon.visible = !!nx && !(nx.deck !== deck.spec.id && hz < 1.0 && Math.abs(hx) < 1.6);
    if (lift) runLift(dt);
    // The view turns to her heading only while she walks forward on her own keys (updateCamera).
    updateCamera(dt, modal && !lift ? null : mouse, !modal && (inp.thrust || 0) > 0 && (inp.turn || 0) === 0);
    // The direction arrow: to the next station on this deck, else to the lift (the next station is on another deck).
    if (nx) {
      const here = nx.deck === deck.spec.id;
      navTarget.x = here ? nx.x : 0; navTarget.z = here ? nx.z : -1.2;
      navTarget.label = here ? t(nx.title[0], nx.title[1]) : t(`Take the lift to Deck ${decks[nx.deck].spec.n}`, `Lift to Deck ${decks[nx.deck].spec.n}`);
      nav.setTarget(navTarget);
    } else nav.setTarget(null);
    nav.update(dt, walker.pos);

    // In the lift: the deck panel. At a station: its prompt.
    const w = renderer.domElement.clientWidth || innerWidth; const h = renderer.domElement.clientHeight || innerHeight;
    overlay.resize(w, h, Math.min(2, devicePixelRatio || 1));
    const here = inLift(hx, hz);
    if (here && !modal) {
      openLiftPanel();
      for (const spec of DECKS) if (isDown(`Digit${spec.n}`)) takeLift(spec.id);
    } else if (!here) closeLiftPanel();
    let near = null;
    for (const st of stations) if (st.deck === deck.spec.id && !st.done && Math.hypot(hx - st.x, hz - st.z) < REACH) near = st;
    if (near && !modal) {
      _v.set(near.x, near.y ?? 2.2, near.z).applyMatrix4(deck.group.matrixWorld).project(camera);
      overlay.showPrompt((_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h, `${t(near.title[0], near.title[1])} · ${CREW_INFO[near.lead].name}`);
      if (pressedE) use(near).catch((e) => console.error('[ship] station', e));
    } else overlay.hidePrompt();
    overlay.draw(dt);
    if (finishSoon > 0) { finishSoon -= dt; if (finishSoon <= 0) finish({ done: stations.filter((s) => s.done).map((s) => s.id) }); }
  }

  showDeck(startDeck);
  const debug = {
    walker,
    stations,
    decks,
    rig, cam, // the follow camera's state (dist, cy: its height, yaw)
    get deck() { return deck.spec.id; },
    get done() { return stations.filter((s) => s.done).map((s) => s.id); },
    place(x, z) { walker.place(x, 0, z); deck.map.reset(x, z); },
    /** Stand at a station's spot (the next one by default), facing it; changes deck if needed. */
    goTo(id) {
      const st = id ? stations.find((s) => s.id === id) : nextStation();
      if (!st) return null;
      if (st.deck !== deck.spec.id) showDeck(st.deck);
      walker.place(st.x, 0, st.z, st.face); deck.map.reset(st.x, st.z); cam.yaw = st.face;
      return st.id;
    },
    /** Go straight to a deck (no lift ride). */
    showDeck(id) { showDeck(id); return deck.spec.id; },
    takeLift,
    pressE() { const st = stations.find((s) => s.deck === deck.spec.id && !s.done && Math.hypot(walker.pos.x - s.x, walker.pos.z - s.z) < REACH); if (st) use(st).catch((e) => console.error('[ship] station', e)); return st?.id; },
    /** Put the camera on one of the deck's set points (for screenshots); null goes back to following her. */
    view(name) { const v = deck.views?.find((x) => x.name === name); viewPin = v || null; return !!v; },
  };
  let viewPin = null;
  const baseTick = tick;

  return {
    scene,
    camera,
    debug,
    onFoot: true, // a walk: main.js puts warp back to x1 when she is back at the controls
    /** The camera button (HUD, when she is on foot): 'behind' -> 'follow' -> 'over' -> 'behind', kept for the session. Returns the new view. */
    toggleView() { viewMode = VIEWS[(VIEWS.indexOf(viewMode) + 1) % VIEWS.length]; return viewMode; },
    get view() { return viewMode; },
    start() {
      hud?.toast?.(t('On board! The lift joins the decks; press E at a station.', 'On board! Press E at a station.'), { kind: 'info', ms: 5200 });
      const n = nextStation();
      if (n) setTimeout(() => { if (!disposed) hud?.toast?.(nextText(n), { kind: 'info', ms: 4200 }); }, 5400);
      else finishSoon = 0.5;
      return finished;
    },
    tick(dt, input, mouse, modalOpen) {
      baseTick(dt, input, mouse, modalOpen);
      if (viewPin) { camera.position.set(...viewPin.pos).applyMatrix4(deck.group.matrixWorld); camera.lookAt(_v.set(...viewPin.look).applyMatrix4(deck.group.matrixWorld)); }
    },
    dispose() {
      disposed = true;
      closeLiftPanel(); fade?.remove();
      overlay.canvas.remove();
      crew.dispose();
      walker.dispose?.();
      nav.dispose();
      for (const d of Object.values(decks)) d.dispose?.();
      beaconRing.geometry.dispose(); beaconArrow.geometry.dispose(); beaconMat.dispose();
      kit.dispose();
    },
  };
}
