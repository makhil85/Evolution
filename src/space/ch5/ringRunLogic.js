// The ring run's rules, with no drawing (so node can test them).
//
// She flies along inside Saturn's rings. Ice and rock come at her: white ice
// chunks (water for the trip) and grey rocks (metal and stone for repairs)
// break with one shot; big rocks take several (lead 2026-10-08: 2 on Easy, 3
// on Medium, 5 on Hard). Each level has a goal, so much ice and so much
// rock; short of it she plays again. Every shot kicks the ship back a little
// (the cannon pushes the shot forward, the shot pushes her back), which
// lesson 5AA explains straight after.
//
// Units: the ship sits at (x, y) in a box across the run and z = 0 (plus the
// recoil); ice spawns far ahead (z < 0) and comes towards +z. One unit is
// about a metre at the game's scale. Ice in real rings is far more spread
// out than this (the end card says so).

export const LEVELS = Object.freeze({
  easy: {
    id: 'easy', label: 'Easy', time: 45, speed: 38, spawnEvery: 0.85, bigShare: 0.12, rockShare: 0.3, bigHits: 2,
    goal: { ice: 10, rock: 5 },
    aimHelp: 1.6, blurb: 'Fewer, slower chunks. Your shots home in a little. Big rocks take 2 hits.',
  },
  medium: {
    id: 'medium', label: 'Medium', time: 55, speed: 52, spawnEvery: 0.6, bigShare: 0.2, rockShare: 0.3, bigHits: 3,
    goal: { ice: 16, rock: 9 },
    aimHelp: 0.8, blurb: 'More ice and rock, coming faster. Big rocks take 3 hits.',
  },
  hard: {
    id: 'hard', label: 'Hard', time: 65, speed: 68, spawnEvery: 0.42, bigShare: 0.28, rockShare: 0.3, bigHits: 5,
    goal: { ice: 22, rock: 12 },
    aimHelp: 0, blurb: 'A thick part of the ring. Big rocks take 5 hits. Aim carefully!',
  },
});

export const BOX = Object.freeze({ w: 12, h: 6 }); // the ship's half-width and half-height of travel
export const SPAWN_Z = -240;
export const SHIP_R = 1.6; // the ship's hit radius
export const BOLT_SPEED = 220;
export const COOLDOWN = 0.22; // seconds between shots
export const RECOIL = 0.9; // how far one shot pushes her back
export const MAX_KICK = 1.2; // she never drifts back further than this, however fast she fires
export const BIG_R = 2.6; // at or above this, a big rock: it takes level.bigHits shots
export const BIG_ROCK = 3; // rock from one big rock (a small rock gives 1)
const STEER = 22; // top sideways speed
const STEER_ACC = 7; // how quickly she reaches it

/** Small, fast, repeatable random numbers (so a level is the same each go). */
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

/** Water from one blasted chunk: it goes up with the chunk's volume. */
export const waterFor = (r) => Math.max(1, Math.round(r * r * r * 4));

export function createRun(levelId = 'easy', seed = 7) {
  const L = LEVELS[levelId] || LEVELS.easy;
  const run = {
    level: L, rand: rng(seed + L.time),
    t: 0, over: false,
    ship: { x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, cool: 0, hitFlash: 0 },
    ice: [], bolts: [], bursts: [],
    spawnClock: 0.5, nextId: 1,
    water: 0, blasted: 0, bumps: 0, shots: 0, cracks: 0,
    got: { ice: 0, rock: 0 },
  };
  // A few pieces already on the way, so the rings look full from the start.
  for (let i = 0; i < 4; i++) { spawn(run); run.ice[i].z = SPAWN_Z * (0.75 - i * 0.12); }
  return run;
}

function spawn(run) {
  const { rand, level } = run;
  const big = rand() < level.bigShare;
  const rock = big || rand() < level.rockShare;
  const r = big ? BIG_R + rand() * 1.6 : 0.7 + rand() * 1.3;
  // Half of them come straight at where she is, so she has to act.
  const aimed = rand() < 0.5;
  const x = aimed ? run.ship.x + (rand() - 0.5) * 4 : (rand() * 2 - 1) * BOX.w;
  const y = aimed ? run.ship.y + (rand() - 0.5) * 3 : (rand() * 2 - 1) * BOX.h;
  run.ice.push({
    id: run.nextId++, x: clamp(x, -BOX.w, BOX.w), y: clamp(y, -BOX.h, BOX.h), z: SPAWN_Z,
    r, big, rock, hp: big ? level.bigHits : 1, spin: rand() * 6.28, spinRate: (rand() - 0.5) * 2, shape: Math.floor(rand() * 1e6),
  });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * One step of the run.
 * @param input {turn:-1..1 (right +), thrust:-1..1 (up +), fire:bool}
 * @returns events this step: [{type:'blast'|'crack'|'bump'|'shot'|'end', ...}]
 */
export function stepRun(run, dt, input) {
  const ev = [];
  if (run.over) return ev;
  run.t += dt;
  const { ship, level } = run;

  // Steering: arrows set the sideways speed she eases towards.
  ship.vx += (input.turn * STEER - ship.vx) * Math.min(1, STEER_ACC * dt);
  ship.vy += (input.thrust * STEER * 0.7 - ship.vy) * Math.min(1, STEER_ACC * dt);
  ship.x = clamp(ship.x + ship.vx * dt, -BOX.w, BOX.w);
  ship.y = clamp(ship.y + ship.vy * dt, -BOX.h, BOX.h);
  // Recoil: a shot gives her a little backward speed; her engine eases her back.
  ship.z += ship.vz * dt;
  ship.vz += (-ship.z * 6 - ship.vz * 4) * dt;
  // Holding Space fires five shots a second: without a limit the kicks added
  // up and pushed her out of the picture (play-test).
  if (ship.z > MAX_KICK) { ship.z = MAX_KICK; ship.vz = Math.min(ship.vz, 0); }
  ship.cool = Math.max(0, ship.cool - dt);
  ship.hitFlash = Math.max(0, ship.hitFlash - dt);

  if (input.fire && ship.cool === 0) {
    ship.cool = COOLDOWN;
    ship.vz += RECOIL * 6; // backwards is +z
    run.shots++;
    run.bolts.push({ x: ship.x, y: ship.y, z: ship.z - 3, life: 1.3 });
    ev.push({ type: 'shot' });
  }

  // Ice comes at her.
  run.spawnClock -= dt;
  while (run.spawnClock <= 0 && run.t < level.time - 2) { spawn(run); run.spawnClock += level.spawnEvery; }
  for (const c of run.ice) { c.z += level.speed * dt; c.spin += c.spinRate * dt; }

  // Shots fly ahead (Easy's shots lean towards the nearest chunk in line).
  for (const b of run.bolts) {
    const z0 = b.z;
    b.z -= BOLT_SPEED * dt;
    b.life -= dt;
    if (level.aimHelp > 0) {
      let best = null; let bd = 3.5;
      for (const c of run.ice) {
        if (c.z > b.z || c.z < b.z - 120) continue;
        const d = Math.hypot(c.x - b.x, c.y - b.y) - c.r;
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { b.x += clamp(best.x - b.x, -1, 1) * level.aimHelp * 6 * dt; b.y += clamp(best.y - b.y, -1, 1) * level.aimHelp * 6 * dt; }
    }
    // Swept test: did it pass through a chunk this step? (Both are moving.)
    for (const c of run.ice) {
      if (c.dead) continue;
      const cz0 = c.z - level.speed * dt;
      if (!(b.z <= c.z + c.r && z0 >= cz0 - c.r)) continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) > c.r + 0.5) continue;
      b.life = 0;
      c.hp -= 1;
      if (c.hp > 0) { run.cracks++; c.cracked = (c.cracked || 0) + 1; ev.push({ type: 'crack', x: b.x, y: b.y, z: c.z + c.r, left: c.hp }); }
      else {
        c.dead = true;
        run.blasted++;
        if (c.rock) {
          const n = c.big ? BIG_ROCK : 1;
          run.got.rock += n;
          ev.push({ type: 'blast', kind: 'rock', x: c.x, y: c.y, z: c.z, r: c.r, rock: n, big: c.big });
        } else {
          const w = waterFor(c.r);
          run.water += w; run.got.ice += 1;
          ev.push({ type: 'blast', kind: 'ice', x: c.x, y: c.y, z: c.z, r: c.r, water: w });
        }
      }
      break;
    }
  }

  // Bumps: ice reaching her.
  for (const c of run.ice) {
    if (c.dead) continue;
    if (Math.abs(c.z - ship.z) > c.r + SHIP_R) continue;
    if (Math.hypot(c.x - ship.x, c.y - ship.y) > c.r + SHIP_R) continue;
    c.dead = true;
    run.bumps++;
    ship.hitFlash = 0.6;
    ev.push({ type: 'bump', x: c.x, y: c.y, z: c.z, big: c.big });
  }

  run.ice = run.ice.filter((c) => !c.dead && c.z < 30);
  run.bolts = run.bolts.filter((b) => b.life > 0);
  if (run.t >= level.time) { run.over = true; ev.push({ type: 'end' }); }
  return ev;
}

/** Has she collected the level's goal? */
export const goalMet = (run) => run.got.ice >= run.level.goal.ice && run.got.rock >= run.level.goal.rock;

/** The score card's numbers. */
export function result(run) {
  return {
    level: run.level.id, water: run.water, blasted: run.blasted, bumps: run.bumps,
    shots: run.shots, cracks: run.cracks, seconds: Math.round(run.t),
    ice: run.got.ice, rock: run.got.rock, goal: { ...run.level.goal }, met: goalMet(run),
  };
}

/**
 * A steady player, for tests and the autopilot: dodge what is about to hit
 * her, line up on the nearest chunk ahead (big rocks too, while they are far
 * enough off to take several shots) and fire when it is in line.
 */
export function botInput(run) {
  const { ship } = run;
  const ahead = run.ice.filter((c) => !c.dead && c.z < ship.z && c.z > ship.z - 160).sort((a, b) => b.z - a.z);
  let tx = ship.x; let ty = ship.y;
  // Out of the way of anything big (or small and too close to blast) that will hit her.
  const danger = ahead.find((c) => (c.z > (c.big ? -45 : -25)) && Math.hypot(c.x - ship.x, c.y - ship.y) < c.r + SHIP_R + 1.2);
  if (danger) {
    const dx = ship.x - danger.x || 0.1; const dy = ship.y - danger.y || 0.1;
    tx = ship.x + Math.sign(Math.abs(ship.x) > BOX.w - 3 ? -ship.x : dx) * 8;
    ty = ship.y + Math.sign(Math.abs(ship.y) > BOX.h - 2 ? -ship.y : dy) * 4;
  } else {
    const prey = ahead.find((c) => c.z < (c.big ? -70 : -30));
    if (prey) { tx = prey.x; ty = prey.y; }
  }
  const turn = clamp((tx - ship.x) / 2, -1, 1);
  const thrust = clamp((ty - ship.y) / 2, -1, 1);
  const inLine = ahead.some((c) => c.z < -20 && Math.hypot(c.x - ship.x, c.y - ship.y) < c.r + 0.4);
  return { turn, thrust, fire: inLine };
}
