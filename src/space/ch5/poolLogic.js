// Space pool's rules, with no drawing (so node can test them).
//
// Out in the Kuiper belt, icy rocks float on a patch of space seen from above.
// She flicks a cue rock; it bumps the others. There is no friction out here,
// so a rock keeps sliding until something stops it. The goal: bump the gold
// rock into the collecting net. Bumps keep the total momentum (mass x speed,
// as an arrow) the same; the rocks are bouncy, so they keep the energy too.
//
// Units: the table is 800 x 450 (the lesson stage); speeds in units a second.

export const TABLE = Object.freeze({ w: 800, h: 450 });
export const MAX_SPEED = 260; // a full-power flick
const LOST = 120; // a rock this far off the table has drifted away

/**
 * Levels: rocks {id, x, y, m, cue?, target?}, the net {x, y, r}, shots allowed.
 * Each one shows one idea from lesson 5AA.
 */
export const POOL_LEVELS = Object.freeze([
  {
    id: 'straight', title: ['Same size, one still', 'Same size'],
    tip: ['Same mass: the cue rock stops dead and the gold rock takes all its speed.', 'Hit the gold rock straight on.'],
    shots: 3,
    rocks: [{ id: 'cue', x: 160, y: 225, m: 1, cue: true }, { id: 'gold', x: 400, y: 225, m: 1, target: true }],
    net: { x: 690, y: 225, r: 42 },
  },
  {
    id: 'heavy', title: ['Pick your cue', 'Pick a rock'],
    tip: ['The gold rock is heavy. A small rock just bounces off it: flick the big one.', 'The gold rock is heavy. Use the big rock!'],
    shots: 3,
    rocks: [
      { id: 'small', x: 150, y: 140, m: 1, cue: true }, { id: 'big', x: 150, y: 310, m: 3, cue: true },
      { id: 'gold', x: 420, y: 310, m: 3, target: true },
    ],
    net: { x: 700, y: 310, r: 40 },
  },
  {
    id: 'angle', title: ['At an angle', 'At an angle'],
    tip: ['Hit the gold rock off-centre and it goes off at an angle: aim at the side away from the net.', 'Hit the side of the gold rock to send it to the net.'],
    shots: 4,
    rocks: [{ id: 'cue', x: 140, y: 330, m: 1, cue: true }, { id: 'gold', x: 400, y: 260, m: 1, target: true }],
    net: { x: 640, y: 90, r: 40 },
  },
  {
    id: 'chain', title: ['Pass it on', 'Pass it on'],
    tip: ['Momentum passes along a line of rocks, like a row of bumper cars.', 'The push goes down the line!'],
    shots: 3,
    rocks: [
      { id: 'cue', x: 120, y: 225, m: 1, cue: true }, { id: 'a', x: 330, y: 225, m: 1 },
      { id: 'b', x: 400, y: 225, m: 1 }, { id: 'gold', x: 470, y: 225, m: 1, target: true },
    ],
    net: { x: 700, y: 225, r: 40 },
  },
]);

export const rockR = (m) => 15 * Math.cbrt(m);

export function createPool(levelIx = 0) {
  const L = POOL_LEVELS[levelIx];
  return {
    level: L, ix: levelIx,
    rocks: L.rocks.map((r) => ({ ...r, vx: 0, vy: 0, r: rockR(r.m), lost: false, netted: false })),
    shotsLeft: L.shots, t: 0, moving: false, won: false, lostAll: false, bumps: 0,
  };
}

export const momentum = (pool) => pool.rocks.filter((r) => !r.lost && !r.netted)
  .reduce((p, r) => ({ x: p.x + r.m * r.vx, y: p.y + r.m * r.vy }), { x: 0, y: 0 });

/** Flick a cue rock: direction (radians), power 0..1. False if not allowed. */
export function shoot(pool, rockId, angle, power) {
  const r = pool.rocks.find((x) => x.id === rockId);
  if (!r || !r.cue || r.lost || pool.moving || pool.shotsLeft <= 0 || pool.won) return false;
  const v = MAX_SPEED * Math.max(0.05, Math.min(1, power));
  r.vx = Math.cos(angle) * v; r.vy = Math.sin(angle) * v;
  pool.shotsLeft--;
  pool.moving = true;
  return true;
}

/** Bouncy bump between two rocks (keeps momentum and energy). */
function bump(a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-6;
  const nx = dx / d; const ny = dy / d;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return false; // already moving apart
  const j = (2 * rel) / (1 / a.m + 1 / b.m);
  a.vx -= (j / a.m) * nx; a.vy -= (j / a.m) * ny;
  b.vx += (j / b.m) * nx; b.vy += (j / b.m) * ny;
  // Push apart so they don't stay overlapped.
  const over = a.r + b.r - d;
  if (over > 0) { const s = over / (a.m + b.m); a.x -= nx * s * b.m; a.y -= ny * s * b.m; b.x += nx * s * a.m; b.y += ny * s * a.m; }
  return true;
}

/**
 * One step. Returns events: [{type:'bump', a, b, x, y}, {type:'net', id},
 * {type:'lost', id}, {type:'still'}].
 */
export function stepPool(pool, dt) {
  const ev = [];
  if (!pool.moving) return ev;
  pool.t += dt;
  const live = pool.rocks.filter((r) => !r.lost && !r.netted);
  for (const r of live) { r.x += r.vx * dt; r.y += r.vy * dt; }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]; const b = live[j];
      if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r && bump(a, b)) {
        pool.bumps++;
        ev.push({ type: 'bump', a: a.id, b: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
  const { net } = pool.level;
  for (const r of live) {
    if (Math.hypot(r.x - net.x, r.y - net.y) < net.r - r.r * 0.3) {
      r.netted = true; r.vx = 0; r.vy = 0;
      ev.push({ type: 'net', id: r.id });
      if (r.target) pool.won = true;
    } else if (r.x < -LOST || r.x > TABLE.w + LOST || r.y < -LOST || r.y > TABLE.h + LOST) {
      r.lost = true;
      ev.push({ type: 'lost', id: r.id });
    }
  }
  // Space has no friction: a shot is over when everything has stopped,
  // left the table, or been netted (or the gold rock is in).
  const still = pool.rocks.every((r) => r.lost || r.netted || Math.hypot(r.vx, r.vy) < 0.5);
  if (pool.won || still || pool.t > 12) {
    pool.moving = false; pool.t = 0;
    // Anything still sliding is gently stopped (her tractor beam) for the next shot.
    for (const r of pool.rocks) { r.vx = 0; r.vy = 0; }
    const gold = pool.rocks.find((r) => r.target);
    const cueLeft = pool.rocks.some((r) => r.cue && !r.lost && !r.netted);
    if (!pool.won && (gold.lost || gold.netted || pool.shotsLeft <= 0 || !cueLeft)) pool.lostAll = true;
    ev.push({ type: 'still' });
  }
  return ev;
}

/** Play a shot out to the end. */
export function runShot(pool, dt = 1 / 120) {
  const ev = [];
  for (let i = 0; i < 20000 && pool.moving; i++) ev.push(...stepPool(pool, dt));
  return ev;
}

/**
 * The aim a good player would take: hit the gold rock so it heads for the net
 * (aim at the "ghost" spot behind it), with the cue rock the level wants.
 * For a chain, aim straight down the line. Returns {rockId, angle, power}.
 */
export function bestShot(pool) {
  const gold = pool.rocks.find((r) => r.target);
  const { net } = pool.level;
  const cues = pool.rocks.filter((r) => r.cue && !r.lost && !r.netted);
  // Heaviest cue that can reach the gold rock directly (or the only one).
  const cue = cues.sort((a, b) => b.m - a.m)[0];
  // Direction gold must go, and where the cue must touch it.
  const gx = net.x - gold.x; const gy = net.y - gold.y; const gl = Math.hypot(gx, gy);
  const ghostX = gold.x - (gx / gl) * (gold.r + cue.r); const ghostY = gold.y - (gy / gl) * (gold.r + cue.r);
  const blocked = pool.rocks.some((r) => r !== cue && r !== gold && !r.lost && !r.netted && segDist(cue, { x: ghostX, y: ghostY }, r) < r.r + cue.r);
  const tx = blocked ? gold.x : ghostX; const ty = blocked ? gold.y : ghostY;
  return { rockId: cue.id, angle: Math.atan2(ty - cue.y, tx - cue.x), power: 0.75 };
}

function segDist(a, b, p) {
  const vx = b.x - a.x; const vy = b.y - a.y; const l2 = vx * vx + vy * vy || 1;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
  return Math.hypot(p.x - (a.x + vx * k), p.y - (a.y + vy * k));
}
