// Chapter 7, Part B: how the ship's push is felt, and the zero-g float game's
// rules (lead 2026-10-08: "how do we know the ship is accelerating? If it has
// constant velocity there is no way to tell"). No drawing here, so node can
// test every number (scripts/test-ch7-push.mjs).
//
// The drop test: a ball let go DROP_H metres above the floor falls with the
// ship's push a (inside the ship, a push feels just like a pull of gravity).
// Time to land: t = sqrt(2h / a). Gentle push: 1/100 of Earth's pull; full
// push: 1 g. Drive off: no push at all, so the ball does not fall.
//
// The float game: she floats in a straight line at a steady speed (there is no
// friction in space) until she grabs a handle or bumps a wall. She can push
// off a handle in any direction, or off a wall (only away from it). She can
// throw a tool: the tool goes one way and she goes the other (Newton's third
// law). The tool's momentum is shared with her: m_tool × v_tool = m_she × Δv.
// Collect the 3 parts, then reach the hatch on the right.

export const G_EARTH = 9.8; // m/s², Earth's pull at the ground
export const PUSH = Object.freeze({ off: 0, gentle: G_EARTH / 100, full: G_EARTH });
export const DROP_H = 1; // m

/** Seconds for a ball let go `h` metres up to land under push `a` (m/s²). Infinite with no push. */
export function fallSeconds(a, h = DROP_H) {
  return a > 0 ? Math.sqrt((2 * h) / a) : Infinity;
}
/** Speed (m/s) the ball has when it lands: a × t. Zero with no push (it never lands). */
export function landSpeed(a, h = DROP_H) {
  return a > 0 ? a * fallSeconds(a, h) : 0;
}
/** How many times quicker the full push lands the ball than the gentle push: √(100) = 10. */
export const QUICKER = Math.round(fallSeconds(PUSH.gentle) / fallSeconds(PUSH.full));

// --- the float game -------------------------------------------------------------------------

export const ROOM = Object.freeze({ w: 12, h: 6, hatch: Object.freeze({ y0: 2.2, y1: 3.8 }) }); // m; the hatch is on the right wall
// The throw's numbers, in one place (lead 2026-10-08): Zara with her suit and kit weighs 30 kg. A 3 kg
// wrench thrown at 2 m/s has momentum 3 × 2 = 6 kg m/s, so she drifts 6 ÷ 30 = 0.2 m/s the other way.
// Momentum is conserved: the wrench's 6 kg m/s forwards is her 6 kg m/s backwards. (Lesson 5AA's
// chunks and lesson 3A's balloon: the same rule.)
export const SHIP = Object.freeze({ mass: 30, r: 0.3 }); // her mass with suit and kit (kg), her body radius (m)
export const PUSH_SPEED = 0.8; // m/s she gets pushing off a handle or wall
const WALL_SLANT = 0.05; // off a wall she can push at any slant into the room, but not along the wall
export const TOOLS = Object.freeze({
  wrench: Object.freeze({ id: 'wrench', name: ['Wrench (3 kg)', 'Wrench'], mass: 3, speed: 2 }), // +0.2 m/s for her
  spanner: Object.freeze({ id: 'spanner', name: ['Spanner (6 kg)', 'Spanner'], mass: 6, speed: 2 }), // a heavier throw, a bigger push: +0.4 m/s
});
/** Her speed change from throwing a tool (m/s): the tool's momentum shared with her, m × v ÷ M. */
export const throwGain = (kind) => (TOOLS[kind].mass * TOOLS[kind].speed) / SHIP.mass;
/** The sum on the callout: "3 kg × 2 m/s = 30 kg × 0.2 m/s" (the tool's momentum = her momentum). */
export const throwSum = (kind) => `${TOOLS[kind].mass} kg × ${TOOLS[kind].speed} m/s = ${SHIP.mass} kg × ${throwGain(kind).toFixed(1)} m/s`;
export const CATCH_R = 0.45; // a handle within this distance catches her
export const PART_R = 0.6; // a part within this distance is hers
const DECIDE_S = 0.25; // a bot (or a child) acts about four times a second

export const MODES = Object.freeze({
  easy: Object.freeze({ id: 'easy', label: ['Easy', 'Easy'], drift: 0.3, handles: 8, blocks: 1, parts: 3, throws: Infinity, time: 150, hint: true }),
  medium: Object.freeze({ id: 'medium', label: ['Medium', 'Medium'], drift: 0.6, handles: 5, blocks: 2, parts: 3, throws: Infinity, time: 150, hint: false }),
  hard: Object.freeze({ id: 'hard', label: ['Hard', 'Hard'], drift: 0.9, handles: 3, blocks: 3, parts: 3, throws: 3, time: 100, hint: false }),
});

/** Small seeded random numbers (the same room for the same seed). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (v) => { const l = Math.hypot(v.x, v.y); return l > 1e-9 ? { x: v.x / l, y: v.y / l } : null; };
const dot = (a, b) => a.x * b.x + a.y * b.y;

/** The room's layout for a mode and seed: where she starts and drifts, the parts, the handles and the crates. */
export function makeRoom(modeId, seed = 1) {
  const m = MODES[modeId] || MODES.easy;
  const R = rng(seed * 7919 + m.handles * 31);
  const pick = (a, b) => a + (b - a) * R();
  const heading = pick(-0.3, 0.3); // a little off straight across the room
  const start = { x: 1.0, y: pick(1.5, 4.5) };
  const vel = { x: m.drift * Math.cos(heading), y: m.drift * Math.sin(heading) };
  const free = (p, list, d) => list.every((q) => dist(p, q) >= d);
  const place = (n, box, d, list) => {
    for (let k = 0; list.length < n && k < 600; k++) {
      const p = { x: pick(box.x[0], box.x[1]), y: pick(box.y[0], box.y[1]) };
      if (free(p, list, d) && dist(p, start) > 1.4) list.push(p);
    }
    return list;
  };
  const parts = place(m.parts, { x: [3.2, 10.2], y: [0.9, 5.1] }, 1.8, []);
  const handles = place(m.handles, { x: [2.2, 10], y: [0.6, 5.4] }, 1.1, []);
  const blocks = [];
  for (let k = 0; blocks.length < m.blocks && k < 600; k++) {
    const b = { x: pick(3.2, 9.8), y: pick(1.0, 5.0), w: pick(0.8, 1.4), h: pick(0.8, 1.4) };
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const nearHatch = b.x + b.w > 10.4 && c.y > ROOM.hatch.y0 - 0.8 && c.y < ROOM.hatch.y1 + 0.8;
    if (!nearHatch && free(c, [...parts, ...handles], 1.2) && free(c, blocks.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 })), 1.8)) blocks.push(b);
  }
  return { mode: m.id, start, vel, parts, handles, blocks, time: m.time };
}

/** A new game: she is drifting at the start, nothing collected. */
export function newGame(modeId = 'easy', seed = 1) {
  const room = makeRoom(modeId, seed);
  return {
    mode: room.mode, room, t: 0,
    pos: { ...room.start }, vel: { ...room.vel },
    stuck: null, // { kind: 'handle', i } or { kind: 'wall', n } (n: the wall's normal, pointing into the room)
    got: [], // the parts she has (indices)
    throws: MODES[room.mode].throws, pushes: 0, shots: 0,
    status: 'playing', // 'playing' | 'won' | 'lost'
    note: '', // what the card says about the last move
  };
}

/** The point she is heading for: the nearest part she does not have, then the hatch. */
export function nextTarget(s) {
  let best = null; let bd = Infinity;
  s.room.parts.forEach((p, i) => { if (!s.got.includes(i) && dist(p, s.pos) < bd) { bd = dist(p, s.pos); best = p; } });
  if (best) return { x: best.x, y: best.y, part: true };
  return { x: ROOM.w - SHIP.r, y: (ROOM.hatch.y0 + ROOM.hatch.y1) / 2, part: false };
}

// A crate is hit only from the side she is moving towards it (so a push off a crate does not stick her again).
function hitBlock(room, p, v = null) {
  const r = SHIP.r;
  for (const b of room.blocks) {
    if (p.x > b.x - r && p.x < b.x + b.w + r && p.y > b.y - r && p.y < b.y + b.h + r) {
      const faces = [
        { d: p.x - (b.x - r), n: { x: -1, y: 0 }, x: b.x - r, y: p.y },
        { d: b.x + b.w + r - p.x, n: { x: 1, y: 0 }, x: b.x + b.w + r, y: p.y },
        { d: p.y - (b.y - r), n: { x: 0, y: -1 }, x: p.x, y: b.y - r },
        { d: b.y + b.h + r - p.y, n: { x: 0, y: 1 }, x: p.x, y: b.y + b.h + r },
      ].filter((f) => !v || v.x * f.n.x + v.y * f.n.y < 0).sort((a, c) => a.d - c.d)[0];
      if (faces) return faces;
    }
  }
  return null;
}

/**
 * Move her on by dt seconds: drift, then what she touches (a part, a handle,
 * a crate, a wall or the hatch). Nothing happens while she is stuck.
 */
export function step(s, dt) {
  if (s.status !== 'playing') return s;
  s.t += dt;
  if (s.t >= s.room.time) { s.status = 'lost'; s.note = 'Out of time.'; return s; }
  if (s.stuck) return s;
  const { w, h } = { w: ROOM.w, h: ROOM.h };
  const r = SHIP.r;
  s.pos.x += s.vel.x * dt; s.pos.y += s.vel.y * dt;
  // parts she passes are hers (she does not stop for them)
  s.room.parts.forEach((q, i) => { if (!s.got.includes(i) && dist(q, s.pos) < PART_R) { s.got.push(i); s.note = `Part ${s.got.length} of ${s.room.parts.length}!`; } });
  // handles catch her (not the one she has just pushed off, until she is clear of it)
  if (s.free != null && dist(s.room.handles[s.free], s.pos) > CATCH_R + 0.05) s.free = null;
  for (let i = 0; i < s.room.handles.length; i++) {
    if (i !== s.free && dist(s.room.handles[i], s.pos) < CATCH_R) { s.pos = { ...s.room.handles[i] }; s.vel = { x: 0, y: 0 }; s.stuck = { kind: 'handle', i }; s.note = 'Caught a handle. Tap where you want to go to push off.'; return s; }
  }
  // the outside walls, with the hatch on the right; a wall stops her only when she moves into it
  const stop = (n, x, y, what) => { s.pos = { x, y }; s.vel = { x: 0, y: 0 }; s.stuck = { kind: 'wall', n }; s.note = what; };
  const bumpNote = 'Bump! Tap where you want to go to push off the wall.';
  if (s.pos.x + r >= w && s.vel.x > 0) {
    const inHatch = s.pos.y > ROOM.hatch.y0 && s.pos.y < ROOM.hatch.y1;
    if (inHatch && s.got.length === s.room.parts.length) { s.pos = { x: w - r, y: s.pos.y }; s.vel = { x: 0, y: 0 }; s.status = 'won'; s.note = 'The hatch opens!'; return s; }
    stop({ x: -1, y: 0 }, w - r, s.pos.y, inHatch ? 'The hatch is shut until you have all 3 parts.' : bumpNote);
    return s;
  }
  if (s.pos.x - r <= 0 && s.vel.x < 0) { stop({ x: 1, y: 0 }, r, s.pos.y, bumpNote); return s; }
  if (s.pos.y - r <= 0 && s.vel.y < 0) { stop({ x: 0, y: 1 }, s.pos.x, r, bumpNote); return s; }
  if (s.pos.y + r >= h && s.vel.y > 0) { stop({ x: 0, y: -1 }, s.pos.x, h - r, bumpNote); return s; }
  // crates
  const bump = hitBlock(s.room, s.pos, s.vel);
  if (bump) stop(bump.n, bump.x, bump.y, 'Bump! Tap where you want to go to push off the crate.');
  return s;
}

/** She leaves a handle (a push or a throw): it may not catch her again until she is clear. */
function leaveHandle(s) {
  if (s.stuck?.kind === 'handle') s.free = s.stuck.i;
  s.stuck = null;
}

/** Push off where she is stuck, towards `to` (a point in the room). Returns true if she moved off. */
export function push(s, to) {
  if (s.status !== 'playing') return false;
  if (!s.stuck) { s.note = 'Floating. Pick a tool and throw it, or wait for a handle or a wall.'; return false; }
  const u = unit({ x: to.x - s.pos.x, y: to.y - s.pos.y });
  if (!u) return false;
  if (s.stuck.kind === 'wall' && dot(u, s.stuck.n) <= WALL_SLANT) { s.note = 'Push away from the wall, not into it.'; return false; }
  s.vel = { x: PUSH_SPEED * u.x, y: PUSH_SPEED * u.y };
  leaveHandle(s); s.pushes += 1; s.note = 'Pushed off!';
  return true;
}

/** Throw a tool (`kind`: 'wrench' | 'spanner') the way away from `to`, so she goes towards it. */
export function throwTool(s, kind, to) {
  if (s.status !== 'playing') return false;
  const T = TOOLS[kind];
  if (!T) return false;
  if (s.throws <= 0) { s.note = 'No tools left.'; return false; }
  const u = unit({ x: to.x - s.pos.x, y: to.y - s.pos.y });
  if (!u) return false;
  if (s.stuck?.kind === 'wall' && dot(u, s.stuck.n) <= WALL_SLANT) { s.note = 'Throw the other way, away from the wall.'; return false; }
  // Momentum is conserved: the tool gets m × v one way, she gets the same m × v the other way (÷ her mass).
  const dv = throwGain(kind);
  s.vel = { x: (s.stuck ? 0 : s.vel.x) + dv * u.x, y: (s.stuck ? 0 : s.vel.y) + dv * u.y };
  leaveHandle(s); s.throws -= 1; s.shots += 1;
  s.callout = { kind, at: s.t, dir: { x: u.x, y: u.y } }; // the card shows the two arrows (the direction is kept from the throw) and the sum for a few seconds
  s.note = `Threw the ${T.name[1].toLowerCase()}. It goes the other way, and so do you.`;
  return true;
}

/** Is the straight way from a to b free of crates (and inside the room)? Sampled every 10 cm. */
function clearWay(room, a, b) {
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.1));
  for (let i = 0; i <= n; i++) {
    const k = i / n; const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    if (room.blocks.some((c) => p.x > c.x - SHIP.r && p.x < c.x + c.w + SHIP.r && p.y > c.y - SHIP.r && p.y < c.y + c.h + SHIP.r)) return false;
  }
  return true;
}

// The crate corners a way round can bend at, with which pairs see each other (once per room; the bot asks often).
const cornerCache = new WeakMap();
function cornersOf(room) {
  if (cornerCache.has(room)) return cornerCache.get(room);
  const m = SHIP.r + 0.15;
  const pts = [];
  for (const c of room.blocks) {
    for (const k of [{ x: c.x - m, y: c.y - m }, { x: c.x + c.w + m, y: c.y - m }, { x: c.x - m, y: c.y + c.h + m }, { x: c.x + c.w + m, y: c.y + c.h + m }]) {
      if (k.x >= SHIP.r && k.x <= ROOM.w - SHIP.r && k.y >= SHIP.r && k.y <= ROOM.h - SHIP.r) pts.push(k);
    }
  }
  const see = pts.map((a, i) => pts.map((b, j) => i !== j && clearWay(room, a, b)));
  const out = { pts, see };
  cornerCache.set(room, out);
  return out;
}

/**
 * Where to head next: the target if the way is clear; else the first corner on
 * the shortest clear way round the crates (a small Dijkstra over the corners).
 */
export function route(s, tg) {
  if (clearWay(s.room, s.pos, tg)) return tg;
  const { pts, see } = cornersOf(s.room);
  const n = pts.length;
  const nodes = [s.pos, tg, ...pts];
  const seeFrom = (i, j) => (i === 0 || i === 1 || j === 0 || j === 1 ? null : see[i - 2][j - 2]);
  const dd = new Array(n + 2).fill(Infinity); const prev = new Array(n + 2).fill(-1); const done = new Array(n + 2).fill(false);
  dd[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n + 2; i++) if (!done[i] && dd[i] < Infinity && (u < 0 || dd[i] < dd[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < n + 2; v++) {
      if (done[v] || v === u) continue;
      const direct = seeFrom(u, v);
      const ok = direct == null ? clearWay(s.room, nodes[u], nodes[v]) : direct;
      if (!ok) continue;
      const nd = dd[u] + dist(nodes[u], nodes[v]);
      if (nd < dd[v]) { dd[v] = nd; prev[v] = u; }
    }
  }
  if (dd[1] === Infinity) return tg;
  let k = 1;
  while (prev[k] > 0) k = prev[k];
  return k === 1 ? tg : nodes[k];
}

/**
 * A sensible player (the test's bot, and the grown-up's skip): push towards the
 * next target (round a crate if need be) when stuck; when floating, let the
 * drift carry her if it is heading there clear of crates and walls, else throw
 * the tool that turns her. Returns { kind: 'push'|'throw'|'wait', to, tool }.
 */
export function sensibleAct(s) {
  const via = route(s, nextTarget(s));
  if (s.stuck) {
    const u = unit({ x: via.x - s.pos.x, y: via.y - s.pos.y });
    if (s.stuck.kind === 'wall' && (!u || dot(u, s.stuck.n) <= WALL_SLANT)) return { kind: 'push', to: { x: s.pos.x + s.stuck.n.x, y: s.pos.y + s.stuck.n.y } };
    return { kind: 'push', to: via };
  }
  // Floating: a throw is only worth a tool when the drift would hit a wall or crate before the target.
  const want = unit({ x: via.x - s.pos.x, y: via.y - s.pos.y });
  const speed = Math.hypot(s.vel.x, s.vel.y);
  if (!want || speed < 1e-6 || !driftHits(s, dist(s.pos, via))) return { kind: 'wait' };
  if (s.throws <= 0) return { kind: 'wait' };
  // Turn her towards the target: aim the speed she has (at least a slow walk) that way.
  const aim = Math.max(0.4, speed);
  const need = { x: want.x * aim - s.vel.x, y: want.y * aim - s.vel.y };
  const u = unit(need);
  if (!u) return { kind: 'wait' };
  const tool = Math.hypot(need.x, need.y) > 0.3 ? 'spanner' : 'wrench';
  return { kind: 'throw', tool, to: { x: s.pos.x + u.x, y: s.pos.y + u.y } };
}

/** Would the drift along her velocity hit a crate or a wall within `reach` metres? (Handles are fine: they stop her, then she pushes on.) */
function driftHits(s, reach) {
  const dir = unit(s.vel);
  for (let d = 0.05; d < reach + 0.5; d += 0.05) {
    const p = { x: s.pos.x + dir.x * d, y: s.pos.y + dir.y * d };
    if (p.x + SHIP.r >= ROOM.w && !(p.y > ROOM.hatch.y0 && p.y < ROOM.hatch.y1)) return true;
    if (p.x - SHIP.r <= 0 || p.y - SHIP.r <= 0 || p.y + SHIP.r >= ROOM.h) return true;
    if (hitBlock(s.room, p)) return true;
  }
  return false;
}

/** A child who presses at random: a random tool or push, now and then (the test's worst case). */
export function randomAct(s, R) {
  const to = { x: R() * ROOM.w, y: R() * ROOM.h };
  if (R() < 0.5) return { kind: 'wait' };
  if (s.stuck) return { kind: 'push', to };
  if (s.throws > 0 && R() < 0.5) return { kind: 'throw', tool: R() < 0.5 ? 'wrench' : 'spanner', to };
  return { kind: 'wait' };
}

/** Do one decided action on the game. */
export function act(s, a) {
  if (!a || a.kind === 'wait') return false;
  if (a.kind === 'push') return push(s, a.to);
  if (a.kind === 'throw') return throwTool(s, a.tool, a.to);
  return false;
}

/**
 * Play a whole game with a policy (called every DECIDE_S seconds of game time).
 * The policy gets the game and returns an action (see sensibleAct, randomAct).
 * Returns the finished game (status 'won' or 'lost').
 */
export function playOut(s, policy = () => ({ kind: 'wait' }), dt = 1 / 60) {
  let since = DECIDE_S;
  let guard = 0;
  while (s.status === 'playing' && guard++ < 1e6) {
    if (since >= DECIDE_S) { act(s, policy(s)); since = 0; }
    step(s, dt);
    since += dt;
  }
  return s;
}

/** Strings a card or the test shows for the mode: label and the short goal. */
export const MODE_BLURB = Object.freeze({
  easy: ['Easy: a gentle drift, lots of handles, and an arrow that points the way.', 'Easy: an arrow shows the way.'],
  medium: ['Medium: faster drift, fewer handles. Think ahead.', 'Medium: think ahead.'],
  hard: ['Hard: fast drift, few handles and only 3 throws. Plan each one!', 'Hard: only 3 throws.'],
});
