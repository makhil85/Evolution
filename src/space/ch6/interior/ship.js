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

const REACH = 1.6;     // how close to a station's spot to press E
const LIFT = { x0: -1.2, x1: 1.2, z0: -2.4, z1: 0 };
const LIFT_TIME = 1.4; // doors shut, fade, travel, fade in
export const LIFT_OUT = { x: 0, z: 0.6, face: 0 }; // where she steps out: just past the door, facing away from it
// The chase camera (lead 2026-10-09: "the camera comes too close to the girl if she hits something", "the camera
// turning is not smooth"). A bump eases the camera in, never snaps it; it never comes nearer her eyes than CAM_MIN,
// since closer the view fills with her hair or a wall; and her turn is a damped follow.
const CAM_PULL = 5;       // how fast the chase camera pulls in towards a wall or a roof (1/s): a bump eases in
const CAM_LET = 6;        // how fast it lets out again (1/s)
const CAM_LET_MAX = 1;    // and by no more than this share of its distance a second (1/s)
const CAM_PULL_MAX = 0.8; // ... and pulls in by no more than this share a second (1/s)
export const CAM_MIN = 1.6;      // never nearer her eyes than this (m): a wall that leaves less room lifts the camera, then turns the view
export const CAM_PITCH_UP = 1.3; // the most it lifts to look down over a wall (rad): nearly from above (a 3.2 m roof allows it)
const CAM_PITCH_STEP = 0.05; // the steps it tries on the way up
const CAM_TURNS = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4]; // when lifting is not enough (a corner), the view turns this far (rad), the smallest first
const CAM_TURN_RATE = 3; // how fast the view turns to open space (rad/s)
const CAM_AHEAD = 0.4; // the view starts to turn while the room is this much more than CAM_MIN (m): the turn ends before a wall takes the camera nearer than that
const CAM_PITCH_RISE = 15; // how fast it rises (1/s): a wall must not wait for the pitch
const CAM_PITCH_EASE = 2.5; // how fast the pitch settles back (1/s); it rises faster (CAM_PITCH_RISE): a wall must not wait for it
const CAM_FADE = 6;       // how fast she fades out when the camera has no room (1/s), and back in
export const OVER_PITCH = 1.0; // the 'over' view (toggleView): the camera's pitch, a steep look down on her
export const CAM_NEAR = 0.1; // the camera's near plane (m): less than BODY_R, so the walls it keeps are never clipped
const CHASE_SMOOTH = 0.15; // the point the camera looks at trails her by this (s, critically damped)
const CHASE_SNAP = 2;      // ... and jumps to her when she is this far off (m): a lift ride, a place()
const FOLLOW_GAIN = 0.9;   // how fast the camera turns to her heading (1/s of the angle)
const YAW_RATE_MAX = 1.1;  // ... and never faster than this (rad/s)
const FOLLOW_LO = 0.3;     // it follows only while she walks: from FOLLOW_LO up to FOLLOW_HI (m/s)
const FOLLOW_HI = 1.2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const inLift = (x, z) => x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < LIFT.z1 - 0.2;
// The camera button (toggleView) keeps its choice for the session: 'behind' (her chase view, the default, as in
// Chapters 1-2) or 'over' (a steeper look down on her, the same steering).
let viewMode = 'behind';

// The chase camera's sight line (chaseDistance). These scratch values are set per call, so a frame allocates nothing.
const SIGHT = { map: null, roof: null, x: 0, z: 0, ty: 0, fx: 0, fz: 0, cp: 1, sp: 0 };
export const BODY_R = 0.15; // the camera keeps this far from a wall: the hard limit
export const CAM_CLEAR = 0.15;     // and over a low solid (a bed, a desk) it keeps this far above its top
const CLEAR = { x: 0, z: 0, r: 0, y: 0, m: CAM_CLEAR }; // the camera's clearance query (walkmap.js clearAt)
const SOFT_R = 0.6;  // and eases to this margin, so a door frame or corner it is about to pass pulls it in early
/** Set the sight line: from her point p, at this pitch, along this yaw (her yaw, or a turn of the view from it). */
function aimSight(map, roof, p, pitch, yaw) {
  const s = SIGHT;
  s.map = map; s.roof = roof; s.x = p.x; s.z = p.z; s.ty = p.ty;
  s.fx = Math.sin(yaw); s.fz = Math.cos(yaw); s.cp = Math.cos(pitch); s.sp = Math.sin(pitch);
}
/** Is the camera clear at distance d on her sight line, with margin r (no wall, and under the roof)? */
function sightClear(d, r) {
  const s = SIGHT; const c = CLEAR;
  const cx = s.x - s.fx * d * s.cp; const cz = s.z - s.fz * d * s.cp;
  const cy = s.ty + 0.3 + d * s.sp;
  // Over a solid with a height (walkmap.js) the camera may pass; a wall (full height) still stops it.
  // The soft margin is for the camera away from her: this close (under SOFT_R) its ring would reach past her to a wall in front.
  c.x = cx; c.z = cz; c.r = d < SOFT_R ? Math.min(r, BODY_R) : r; c.y = cy;
  return s.map.clearAt(c) && cy < s.roof(cx, cz) - 0.35;
}
/** How far along the sight line (at most `want`) the camera stays clear with margin r, found to a few mm. */
function clearDist(want, r) {
  // Out from her in 0.1 m steps until the sight line is blocked (or the wanted distance), then bisected. The first
  // 0.2 m are not tested: a post a hand's width from her (inside the margin) must not block every view of her.
  let ok = 0; let bad = null;
  for (let d = 0.2; ; d += 0.1) {
    const x = Math.min(d, want);
    if (sightClear(x, r)) { ok = x; if (x >= want) return want; } else { bad = x; break; }
  }
  for (let i = 0; i < 6; i++) { const m = (ok + bad) / 2; if (sightClear(m, r)) ok = m; else bad = m; }
  return ok;
}
/** How often the hard limit had to hold the camera back (the tests read it). */
export const chaseStats = { held: 0 };

/**
 * The chase camera's distance this frame (m), along her sight line. `p` = { x, z, ty (her eye
 * height), yaw, pitch, want (the distance she asked for) }; `map` her walk map; `roof(x, z)` the roof
 * above a point (deck.roof); `prev` last frame's distance.
 * The hard limit is the first wall or roof on the line, at the body's margin: the camera is never past
 * it. Its target is the same line at the bigger margin SOFT_R, and the camera eases to that: in (CAM_PULL,
 * and by no more than CAM_PULL_MAX of its distance a second), out (CAM_LET, and by no more than CAM_LET_MAX).
 * The target never goes below CAM_MIN while the hard limit allows it (chaseView lifts the camera for that).
 */
export function chaseDistance(map, roof, p, prev, dt) {
  aimSight(map, roof, p, p.pitch, p.yaw);
  const want = Math.max(0, p.want);
  const need = Math.min(CAM_MIN, want);
  const hard = clearDist(want, BODY_R);
  const soft = sightClear(0, SOFT_R) ? Math.min(hard, clearDist(want, SOFT_R)) : hard;
  // The soft margin pulls the camera in early, but not below CAM_MIN while the hard limit still allows it.
  const target = Math.max(soft, Math.min(hard, need));
  let next = prev + (target - prev) * (1 - Math.exp(-dt * (target < prev ? CAM_PULL : CAM_LET)));
  // Each way is also held to a share of the distance a second: a corner swept into the line glides in. Letting out
  // is at least a share of the minimum (or 0.5 m), so a camera that was pulled right in (or to 0) is back at CAM_MIN
  // in about half a second.
  next = next < prev ? Math.max(next, prev * (1 - CAM_PULL_MAX * dt)) : Math.min(next, prev + CAM_LET_MAX * dt * Math.max(prev, need, 0.5));
  if (next > hard) { chaseStats.held += 1; return hard; }
  // The walk map is a grid (0.2 m cells), so the clear distances are not always one run: a blocked value between clear
  // ones steps back (1 cm at a time) to the nearest clear one.
  let c = next;
  for (let i = 0; i < 30 && !sightClear(c, BODY_R); i++) c -= 0.01;
  if (!sightClear(c, BODY_R)) { chaseStats.held += 1; return hard; }
  return c;
}

/**
 * The lowest pitch from `from` up to CAM_PITCH_UP at which the camera has room (at least need, with margin r) on this
 * yaw, else -1.
 */
function riseFor(map, roof, p, yaw, from, want, need, r) {
  for (let q = from; q <= CAM_PITCH_UP + 1e-9; q += CAM_PITCH_STEP) {
    aimSight(map, roof, p, q, yaw);
    if (clearDist(want, r) >= need) return q;
  }
  return -1;
}

// What pickView found (scratch, so a frame allocates nothing): the pitch to aim, and the view's turn from her yaw.
const _pick = { aim: 0, turn: 0 };
/**
 * A view with room (at least need, with margin r): the lift at her yaw if that is enough, else the smallest turn of
 * the view that has room, the way it turned last (dir) first. Sets _pick; false when no view has room.
 */
function pickView(map, roof, p, want, need, r, dir) {
  const lift = riseFor(map, roof, p, p.yaw, p.pitch + CAM_PITCH_STEP, want, need, r);
  if (lift >= 0) { _pick.aim = lift; _pick.turn = 0; return true; }
  for (let m = 0; m < CAM_TURNS.length; m++) {
    for (let k = 0; k < 2; k++) {
      const turn = (k ? -dir : dir) * CAM_TURNS[m];
      const q = riseFor(map, roof, p, p.yaw + turn, p.pitch, want, need, r);
      if (q >= 0) { _pick.aim = q; _pick.turn = turn; return true; }
    }
  }
  return false;
}

/**
 * The chase camera's pitch, view turn and distance this frame, into `st` ({ dist, pitch, fade, turn, lost, dir },
 * kept between frames). The pitch is her camera's (p.pitch) unless a wall or roof is close on that line (within
 * SOFT_R): then it rises, a little a frame, to look down over the wall (up to CAM_PITCH_UP). Where even that leaves
 * no room (a corner, a wall close behind her), the view turns (st.turn, rad, from her yaw) to the smallest turn that
 * has room; chaseFrame turns the camera by it. Only when there is no room within the body margin either (`lost`)
 * does `fade` go to 1 and she fades out (ship.js), rather than the view filling with her hair or the wall.
 */
export function chaseView(map, roof, p, st, dt) {
  const want = Math.max(0, p.want);
  const need = Math.min(CAM_MIN, want);
  // The searches start from the pitch the camera has now (st.pitch), so the view it picks is the one it rises to.
  const base = p.pitch; p.pitch = st.pitch;
  let aim = base;
  st.turn = 0; st.lost = false;
  aimSight(map, roof, p, p.pitch, p.yaw);
  const room = clearDist(want, SOFT_R);
  // Holding a view, it is picked again only when the body margin has no room (the soft margin is for the look-ahead).
  let picking = st.goal == null && (st.hold ? clearDist(want, BODY_R) < need : room < need + CAM_AHEAD);
  if (st.goal != null) {
    // A turn under way goes on to the yaw it chose (st.goal), unless she has walked on and that yaw is blocked now.
    aimSight(map, roof, p, st.aim, st.goal);
    if (clearDist(want, BODY_R) < need) { st.goal = null; picking = true; }
    else {
      st.turn = angDiff(st.goal, p.yaw); aim = st.aim;
      // Done once the view here has room (it holds there) or the camera has turned to the goal.
      if (room >= need + CAM_AHEAD || Math.abs(st.turn) < 0.01) { st.goal = null; st.hold = true; }
    }
  }
  if (picking) {
    // Her view is closing in: a lift, or a turn to a yaw with room (the way it turned last first).
    const dir = st.dir || 1;
    // A view with the look-ahead's room first (so a turn is done before she is cornered), then the minimum.
    if (pickView(map, roof, p, want, need + CAM_AHEAD, SOFT_R, dir) || pickView(map, roof, p, want, need, SOFT_R, dir) || pickView(map, roof, p, want, need, BODY_R, dir)) {
      aim = Math.max(_pick.aim, st.pitch); st.hold = false; // never lower the pitch while the view is blocked (a low post dithers it)
      if (_pick.turn) { st.turn = _pick.turn; st.goal = p.yaw + _pick.turn; st.aim = aim; st.dir = _pick.turn < 0 ? -1 : 1; }
    } else { aim = CAM_PITCH_UP; st.lost = true; st.hold = false; st.goal = null; }
  }
  st.pitch += (aim - st.pitch) * (1 - Math.exp(-dt * (aim > st.pitch ? CAM_PITCH_RISE : CAM_PITCH_EASE)));
  p.pitch = st.pitch; // the distance is for the pitch the camera has this frame
  st.dist = chaseDistance(map, roof, p, st.dist, dt);
  p.pitch = base;
  // She fades only when no view has room (a closet): the last resort, never for a corner or a wall behind her.
  const cornered = st.lost && st.dist < need - 0.05;
  st.fade += ((cornered ? 1 : 0) - st.fade) * (1 - Math.exp(-dt * CAM_FADE));
}

// Scratch objects for the chase (no allocation a frame): the pose chaseView reads, and her state updateCamera fills.
const _pose = { x: 0, z: 0, ty: 0, yaw: 0, pitch: 0, want: 0 };
const _her = { x: 0, y: 0, z: 0, heading: 0, speed: 0, want: 0, follow: false, pitch: null };
const _f = { x: 0, z: 0 }; const _rt = { x: 0, z: 0 }; // her walk's axes (tick)

// The chase rig: the point the camera looks at (a critically damped follow), the turn that follows her heading,
// and chaseView's pitch, distance and fade. One per scene, reused each frame.
let _dampV = 0; // the velocity the last damped() left
/** Critically damped follow (Unity's SmoothDamp) of one axis: the new value; its velocity goes to _dampV. */
function damped(cur, vel, target, dt) {
  const w = 2 / CHASE_SMOOTH; const x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - target; const tmp = (vel + w * ch) * dt;
  _dampV = (vel - w * tmp) * e;
  return target + (ch + tmp) * e;
}
/** A fresh rig for a camera at cam's distance and pitch. */
export function createChaseRig(cam) {
  return { live: false, fx: 0, fy: 0, fz: 0, vx: 0, vy: 0, vz: 0, follow: 0, yawRate: 0, dist: cam.dist, pitch: cam.pitch, fade: 0, turn: 0, lost: false, dir: 1, swing: 0, goal: null, aim: 0, hold: false };
}
/**
 * One frame of the chase camera. `s` = { x, y, z (her feet, and y her eye height), heading, speed, want (the
 * distance she asked for), follow (false while the mouse drags or a card is up), pitch (optional: the pitch
 * she asks for, else cam.pitch) }; `cam` = { yaw, pitch } is turned in place. The rig then holds the point to
 * look at (fx, fy, fz), the pitch, the distance and the fade; the view turns to open space when it must (chaseView).
 */
export function chaseFrame(rig, cam, map, roof, s, dt) {
  // The point to look at trails her, and jumps to her only after a teleport (a lift ride, a place()).
  if (!rig.live || Math.hypot(s.x - rig.fx, s.z - rig.fz) > CHASE_SNAP) {
    rig.live = true; rig.fx = s.x; rig.fy = s.y; rig.fz = s.z; rig.vx = 0; rig.vy = 0; rig.vz = 0;
    // A cut: the camera starts again at the distance and pitch she asks for, and no turn or lift from the place she left.
    rig.dist = s.want; rig.pitch = s.pitch ?? cam.pitch; rig.turn = 0; rig.swing = 0; rig.goal = null; rig.hold = false; rig.lost = false;
  } else {
    rig.fx = damped(rig.fx, rig.vx, s.x, dt); rig.vx = _dampV;
    rig.fy = damped(rig.fy, rig.vy, s.y, dt); rig.vy = _dampV;
    rig.fz = damped(rig.fz, rig.vz, s.z, dt); rig.vz = _dampV;
  }
  // The turn: the camera comes round to her heading only while she walks, and that weight eases in slowly and out
  // quickly, so a bump (her speed gone) stops the swing at once instead of snapping it, and a start is not a jerk.
  const k0 = s.follow ? clamp((s.speed - FOLLOW_LO) / (FOLLOW_HI - FOLLOW_LO), 0, 1) : 0;
  const k = k0 * k0 * (3 - 2 * k0);
  rig.follow += (k - rig.follow) * (1 - Math.exp(-dt * (k > rig.follow ? 3 : 8)));
  const rate = clamp(angDiff(s.heading, cam.yaw) * FOLLOW_GAIN, -YAW_RATE_MAX, YAW_RATE_MAX) * rig.follow;
  rig.yawRate += (rate - rig.yawRate) * (1 - Math.exp(-dt * 6));
  cam.yaw += clamp(rig.yawRate, -YAW_RATE_MAX, YAW_RATE_MAX) * dt;
  // Where the walls leave no room, the view turns to open space (rig.turn, from the last frame's chaseView): at a set rate,
  // and it eases out when the room is found. It turns before the view is chosen, so the distance is for the yaw the camera has.
  // Steering uses cam.yaw too, so the keys still match the screen.
  const goal = rig.turn === 0 ? 0 : Math.sign(rig.turn) * CAM_TURN_RATE;
  rig.swing += (goal - rig.swing) * (1 - Math.exp(-dt * 10));
  cam.yaw += rig.swing * dt;
  _pose.x = rig.fx; _pose.z = rig.fz; _pose.ty = rig.fy; _pose.yaw = cam.yaw; _pose.pitch = s.pitch ?? cam.pitch; _pose.want = s.want;
  chaseView(map, roof, _pose, rig, dt);
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
    d.map =createWalkMap({ floors: [...d.floors, lift.floor], solids: d.solids });
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

  // The beacon: a glowing ring on the floor where she stands, and a small
  // arrow bobbing over it (a tall see-through column hid the console and
  // tinted the whole view once the camera was inside it).
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false });
  const beacon = new THREE.Group();
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40).rotateX(Math.PI / 2), beaconMat);
  beaconRing.position.y = 0.03;
  const beaconArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4).rotateX(Math.PI), beaconMat);
  beacon.add(beaconRing, beaconArrow);

  // Her.
  // 'lope' (the gentle push's walk) is the Moon's floaty hop: a look, not the push. The pull she feels in the
  // ship is 1/100 of Earth's (0.098 m/s²); the 1.6 here only sets the hop's timing. Chapter 6 keeps its spin weight.
  const walker = createWalker({ gravity: gait === 'earth' ? 9.8 * 0.6 : 1.6, gait });
  walker.helmet.visible = false;
  if (walker.pack) walker.pack.visible = false;
  walker.root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'TorusGeometry') o.visible = false; });
  // Her materials, so they can fade (updateCamera): transparent from the start, so a fade never changes the sort.
  const herMats = [];
  walker.root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) if (m && !herMats.includes(m)) { m.transparent = true; herMats.push(m); }
  });
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
  const cam = { yaw: 0, pitch: 0.3, dist: 4.6 };
  const rig = createChaseRig(cam); // where the camera looks, how far and how high (chaseFrame)
  const _move = new THREE.Vector2();
  const _v = new THREE.Vector3();
  let clock = 0; let busy = false; let disposed = false; let prevE = false; let prevJump = false;
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

  function updateCamera(dt, mouse) {
    if (mouse) {
      cam.yaw -= (mouse.dx || 0) * 0.0055;
      cam.pitch = clamp(cam.pitch + (mouse.dy || 0) * 0.0042, -0.05, 0.9);
      if (mouse.wheel) cam.dist = clamp(cam.dist * Math.exp(mouse.wheel * 0.0012), 2.2, 7);
    }
    // Her point, the turn to her heading, and the pitch and distance that keep the walls and roof off the view
    // (chaseFrame). The camera follows the rig's point, not her feet, so a bump does not jerk it.
    _her.x = walker.pos.x; _her.y = walker.pos.y + 1.0; _her.z = walker.pos.z; _her.heading = walker.heading;
    _her.speed = Math.hypot(walker.vel.x, walker.vel.y); _her.want = cam.dist; _her.follow = !!mouse && !mouse.dragging;
    _her.pitch = viewMode === 'over' ? OVER_PITCH : null;
    chaseFrame(rig, cam, deck.map, deck.roof, _her, dt);
    const fx = Math.sin(cam.yaw); const fz = Math.cos(cam.yaw);
    const tx = rig.fx; const ty = rig.fy; const tz = rig.fz;
    camera.position.set(tx - fx * rig.dist * Math.cos(rig.pitch), ty + 0.3 + rig.dist * Math.sin(rig.pitch), tz - fz * rig.dist * Math.cos(rig.pitch));
    camera.lookAt(tx, ty, tz);
    // Her body fades only when no view has room (chaseView, a closet): her hair filling the view is not a view.
    walker.root.visible = rig.fade < 0.98;
    for (const m of herMats) m.opacity = 1 - rig.fade;
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
      const f = _f; const rt = _rt; // her walk's axes (camera-relative), no allocation a frame
      f.x = Math.sin(cam.yaw); f.z = Math.cos(cam.yaw); rt.x = -f.z; rt.z = f.x;
      _move.set(f.x * (inp.thrust || 0) + rt.x * (inp.turn || 0), f.z * (inp.thrust || 0) + rt.z * (inp.turn || 0));
      if (_move.lengthSq() > 1) _move.normalize();
      const run = !!inp.precision || isDown('ShiftLeft') || isDown('ShiftRight');
      speed = walker.move(dt, { dir: _move, run, jump: !!inp.steady && !prevJump, terrain, collide });
      prevJump = !!inp.steady;
    } else {
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
    updateCamera(dt, modal && !lift ? null : mouse);

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
    rig, cam, // the chase camera's state (dist, pitch, fade, turn, yaw)
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
    /** The camera button (HUD, when she is on foot): 'behind' <-> 'over', kept for the session. Returns the new view. */
    toggleView() { viewMode = viewMode === 'behind' ? 'over' : 'behind'; return viewMode; },
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
      for (const d of Object.values(decks)) d.dispose?.();
      beaconRing.geometry.dispose(); beaconArrow.geometry.dispose(); beaconMat.dispose();
      kit.dispose();
    },
  };
}
