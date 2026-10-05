// Chapter 5's flight legs: from Jupiter into orbit round Saturn, Uranus and
// Neptune in turn, flown with the real physics and transfer planner and
// impulsive burns, leaving early or late, slowly or fast. Checks the line-up
// (ch5/lineup.js) gives every leg a window soon and a short trip at the
// cruise warp, whatever she does.
//
//   node scripts/test-ch5-flight.mjs
globalThis.document = { documentElement: { dataset: { chapter: '5' } } }; // chapter.js reads this
const { BODIES, WARP_LEVELS, CRUISE_WARP, PHYSICS_DT } = await import('../src/space/contracts.js');
const { bodyState } = await import('../src/space/orbits.js');
const { createShipState, stepWorld } = await import('../src/space/physics.js');
const { planTransfer, planIsGood } = await import('../src/space/transferPlanner.js');
const { IS_CH5 } = await import('../src/space/chapter.js');
const { lineUp } = await import('../src/space/ch5/lineup.js');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
check('chapter switch reads Chapter 5', IS_CH5);

const TOP = WARP_LEVELS[WARP_LEVELS.length - 1];
function fly({ late, vinf, stay }) {
  const log = [];
  const b = BODIES.jupiter; const s0 = bodyState('jupiter', 0, {}); const r0 = 2200; const v0 = Math.sqrt(b.gm / r0);
  const ship = createShipState({ t: 0, x: s0.x + r0, z: s0.z, vx: s0.vx, vz: s0.vz + v0, soi: 'jupiter', fuel: 1e9 });
  let real = 0; // seconds at the keyboard, coasting at the top warp
  const coast = (sec, stop = () => false) => {
    const end = ship.t + sec;
    while (ship.t < end - PHYSICS_DT / 2) {
      const r = stepWorld(ship, { thrust: 0 }, Math.min(1 / 60, (end - ship.t) / TOP + 1e-9), TOP, { pathClear: true, cruise: true, warpSafeRadii: 0 });
      real += r.steps ? 1 / 60 : 0;
      if (stop()) return true;
    }
    return stop();
  };
  const rel = (id) => { const s = bodyState(id, ship.t, {}); return { x: ship.x - s.x, z: ship.z - s.z, vx: ship.vx - s.vx, vz: ship.vz - s.vz, s }; };
  const kick = (dv, ux, uz) => { ship.vx += ux * dv; ship.vz += uz * dv; };
  function escape(id) {
    for (let k = 0; k < 40000; k++) {
      const r = rel(id);
      if ((r.vx * r.s.vx + r.vz * r.s.vz) / (Math.hypot(r.vx, r.vz) * Math.hypot(r.s.vx, r.s.vz)) > 0.999) break;
      coast(0.25);
    }
    const r = rel(id); const d = Math.hypot(r.x, r.z); const v = Math.hypot(r.vx, r.vz);
    kick(Math.sqrt(vinf * vinf + (2 * BODIES[id].gm) / d) - v, r.vx / v, r.vz / v);
    coast(40000, () => ship.soi === 'sun');
  }
  // The game lines the next planet up as she sets off (ch5/lineup.js).
  function tune(id) { return lineUp(ship, id); }
  function transfer(id) {
    const t0 = ship.t; const real0 = real;
    // Like the cue: no good window yet, keep coasting and look again.
    let p = planTransfer(ship, id);
    for (let k = 0; k < 20 && !(p && planIsGood(p, id)); k++) { coast(3000); p = planTransfer(ship, id); }
    if (!p || !planIsGood(p, id)) return { ok: false, why: 'no good window' };
    coast(p.tau);
    let v = Math.hypot(ship.vx, ship.vz); kick(p.dv, ship.vx / v, ship.vz / v);
    for (let k = 0; k < 160 && ship.soi !== id; k++) {
      if (coast(1500, () => ship.soi === id)) break;
      const c = planTransfer(ship, id, { coastOnly: true });
      if (c && !(c.peri < BODIES[id].soi * 0.7 && c.peri > BODIES[id].radius * 1.5)) {
        const f = planTransfer(ship, id);
        if (f) { if (coast(f.tau, () => ship.soi === id)) break; v = Math.hypot(ship.vx, ship.vz); kick(f.dv, ship.vx / v, ship.vz / v); }
      }
    }
    return { ok: ship.soi === id, wait: p.tau, sim: ship.t - t0, real: real - real0 };
  }
  function capture(id) {
    let last = Infinity;
    for (let k = 0; k < 200000; k++) { const r = rel(id); const d = Math.hypot(r.x, r.z); if (d > last) break; last = d; coast(0.25); }
    const r = rel(id); const d = Math.hypot(r.x, r.z); const v = Math.hypot(r.vx, r.vz);
    kick(Math.sqrt(BODIES[id].gm / d) - v, r.vx / v, r.vz / v);
    return d;
  }
  function flyby(id) {
    let low = Infinity;
    coast(80000, () => { const r = rel(id); low = Math.min(low, Math.hypot(r.x, r.z)); return ship.soi !== id; });
    return low;
  }
  coast(late); // she can take her time before leaving Jupiter
  escape('jupiter');
  const legs = {};
  // Into orbit round Saturn, Uranus and Neptune in turn (a look round each),
  // then out again, with the next planet lined up as she leaves.
  for (const id of ['saturn', 'uranus', 'neptune']) {
    const lined = !!tune(id);
    legs[id] = transfer(id);
    legs[id].lined = lined;
    if (!legs[id].ok) break;
    legs[id].pass = capture(id);
    coast(stay);
    escape(id);
  }
  // Then out past Neptune to fly by Pluto (no stop: it is tiny).
  if (legs.neptune?.ok) {
    const lined = !!tune('pluto');
    legs.pluto = transfer('pluto');
    legs.pluto.lined = lined;
    if (legs.pluto.ok) legs.pluto.pass = flyby('pluto');
  }
  return legs;
}

for (const late of (process.env.LATE ? process.env.LATE.split(',').map(Number) : [0, 900, 2500])) {
  for (const vinf of (process.env.VINF ? process.env.VINF.split(',').map(Number) : [0.3, 0.8, 1.5])) {
    const T0 = Date.now();
    const stay = late === 900 ? 300 : 1800; // how long she stays in each orbit
    const L = fly({ late, vinf, stay });
    if (process.env.V) console.error(late, vinf, ((Date.now() - T0) / 1000).toFixed(1), 's', JSON.stringify(L));
    const tag = `leave Jupiter after ${late} s at ${vinf} u/s, stay ${stay} s`;
    for (const id of ['saturn', 'uranus', 'neptune', 'pluto']) {
      const l = L[id];
      check(`${tag}: reaches ${id}`, l?.ok, l ? `wait ${l.wait?.toFixed(0)} s, ${l.sim?.toFixed(0)} s sim, ${l.real?.toFixed(1)} s real` : 'not flown');
      if (l) check(`${tag}: ${id} lined up`, l.lined);
      if (l?.ok) check(`${tag}: ${id} leg under 30 s real at the top warp`, l.real < 30, `${l.real.toFixed(1)} s`);
      if (l?.pass) check(`${tag}: ${id} pass clear of the planet`, l.pass > BODIES[id].radius * (id === 'pluto' ? 1.2 : 1.5), `${(l.pass / BODIES[id].radius).toFixed(1)} radii`);
    }
  }
}
check('cruise warp is x1024', CRUISE_WARP === 1024);
{
  // The save keeps the line-up, and a planet is lined up only once.
  const { phasesNow, restorePhases, lineUpOnce } = await import('../src/space/ch5/lineup.js');
  const saved = phasesNow();
  BODIES.uranus.phase += 1;
  restorePhases(saved);
  check('save restores the line-up', BODIES.uranus.phase === saved.uranus);
  restorePhases({ lined: ['neptune'] });
  const before = BODIES.neptune.phase;
  check('a planet already lined up is never moved again', lineUpOnce({ soi: 'sun', x: 30000, z: 0, vx: 0, vz: 14, t: 0 }, 'neptune') === false && BODIES.neptune.phase === before);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(`ch5 flight: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
