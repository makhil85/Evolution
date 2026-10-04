// Lab (temporary): a whole transfer leg, flown the way main.js's cue logic
// flies it (plan, wait, burn with the burn computer, coast, corrections), at
// the autopilot's warp pacing, with the old or new planner. Counts how often
// the plan the banner shows moves.   node scripts/_lab_leg_sim.mjs [old|new] [case prefix]
import { BODIES, SHIP, WARP_LEVELS } from '../src/space/contracts.js';
import { bodyState, allStates } from '../src/space/orbits.js';
import { createShipState, stepWorld } from '../src/space/physics.js';
import { predict } from '../src/space/predictor.js';
const OLD = process.argv[2] === 'old';
const { planTransfer, planIsGood } = await import(OLD ? './_lab_old_planner.mjs' : '../src/space/transferPlanner.js');

function around(body, rMul, t, phase = 0) {
  const b = BODIES[body]; const s = bodyState(body, t, {}); const r = b.radius * rMul; const v = Math.sqrt(b.gm / r);
  return createShipState({ t, x: s.x + r * Math.cos(phase), z: s.z + r * Math.sin(phase), vx: s.vx - v * Math.sin(phase), vz: s.vz + v * Math.cos(phase), soi: body });
}
function escaped(t, vinf, ang) {
  const e = bodyState('earth', t, {}); const ev = Math.hypot(e.vx, e.vz);
  const ex = e.vx / ev; const ez = e.vz / ev; const c = Math.cos(ang); const s = Math.sin(ang);
  const dx = ex * c - ez * s; const dz = ex * s + ez * c;
  return createShipState({ t, x: e.x + dx * 520, z: e.z + dz * 520, vx: e.vx + dx * vinf, vz: e.vz + dz * vinf, soi: 'sun' });
}
function helio(r, t, ecc = 0, ph = 0) {
  const mu = BODIES.sun.gm; const v = Math.sqrt(mu / r) * (1 + ecc);
  return createShipState({ t, x: r * Math.cos(ph), z: r * Math.sin(ph), vx: -v * Math.sin(ph), vz: v * Math.cos(ph), soi: 'sun' });
}
const BELT = { parent: 'sun', ring: 12200, orbit: 12200, soi: 600, name: 'belt', radius: 0 };

function leg(name, target, ship, { late = 0, maxReal = 400 } = {}) {
  const tb = typeof target === 'object' ? target : BODIES[target];
  const done = () => (tb.ring ? Math.abs(Math.hypot(ship.x, ship.z) - tb.ring) < tb.soi * 0.5 : ship.soi === target);
  let transferPlan = null; let burnPlan = null; let coastPhase = null; let coastCheck = null; let onCourseT = false;
  let pred = null; let frame = 0; let real = 0;
  const m = { changes: 0, maxJump: 0, cdUp: 0, burns: 0, full: 0, cueFlips: 0, closeJumps: 0, lastCue: '', lastAt: null, lastCd: null, lastClose: null, dvUsed: 0 };
  const cue = (k) => { if (k !== m.lastCue) { m.cueFlips++; m.lastCue = k; } };
  while (!done() && real < maxReal) {
    const states = allStates(ship.t, {});
    if (frame % 12 === 0) {
      const horizon = ship.soi === 'sun' ? 3200 : ship.soi === 'jupiter' ? 1300 : 260;
      pred = predict(ship, { seconds: horizon, maxPoints: 320, target: tb.ring ? null : target });
      const c = pred.closest;
      if (c && m.lastClose != null && !burnPlan && Math.abs(c.dist - m.lastClose) > Math.max(5, 0.1 * m.lastClose)) { m.closeJumps++; if (process.env.V) console.log(`   close ${m.lastClose.toFixed(1)} -> ${c.dist.toFixed(1)} at ${c.t.toFixed(0)} end ${c.atEnd} t${ship.t.toFixed(0)} seq ${pred.soiChanges.map((x) => x.to + "@" + x.t.toFixed(0)).join(">")}`); }
      m.lastClose = c ? c.dist : null;
    }
    frame++; real += 1 / 60;
    let thrust = 0; let aim = null; let warp = 64;
    const par = tb.parent; const ps = par === 'sun' ? { x: 0, z: 0, vx: 0, vz: 0 } : states[par];
    const accel = SHIP.thrust / (SHIP.dryMass + ship.fuel + ship.cargo);
    if (ship.soi !== par) { warp = 16; } else {
      if (!coastCheck || Math.abs(ship.t - coastCheck.t) > 2) coastCheck = { t: ship.t, p: planTransfer(ship, target, { coastOnly: true }) };
      const chs = pred?.soiChanges || []; const tIn = chs.find((ch) => ch.to === target)?.t ?? Infinity; const tOut = chs.find((ch) => ch.from === target && ch.t > tIn)?.t ?? Infinity;
      const detour = (!!pred?.impact && pred.impact.t < tOut) || chs.some((ch) => ch.t < tIn && ch.to !== target && ch.to !== par && ch.to !== ship.soi);
      const c = pred?.closest;
      const sl = onCourseT ? 0.15 : 0;
      const onCourse = process.env.OC
        ? !detour && (planIsGood(coastCheck.p, target, sl) || (c && !c.atEnd && !tb.ring && c.body === target && c.dist < tb.soi * 0.65 * (1 + sl) && c.dist > tb.radius * 1.4 * (1 - sl)))
        : (!detour && planIsGood(coastCheck.p, target, sl)) || (c && !tb.ring && c.body === target && c.dist < tb.soi * 0.65 && c.dist > tb.radius * 1.4);
      onCourseT = !!onCourse;
      if (process.env.V && !!onCourse !== !!m.wasOn) console.log(`  t${ship.t.toFixed(0)} onCourse ${!!onCourse} coastPeri ${coastCheck.p?.peri?.toFixed(1)} closest ${c?.dist?.toFixed(1)} at ${c?.t?.toFixed(0)} end ${c?.atEnd} detour ${detour} soi ${ship.soi} seq ${(pred?.soiChanges||[]).map((x) => x.to + "@" + x.t.toFixed(0)).join(">")} imp ${pred?.impact?.body}`);
      m.wasOn = !!onCourse;
      if (onCourse) { cue('oncourse'); burnPlan = null; } else if (burnPlan) {
        const left = burnPlan.dvTarget - burnPlan.delivered;
        if (left <= 0.001) {
          const pr = Math.hypot(ship.x - ps.x, ship.z - ps.z);
          coastPhase = { untilR: (pr + tb.orbit) / 2, untilT: ship.t + 60 }; burnPlan = null; transferPlan = null; cue('coast');
        } else if (ship.t - burnPlan.startT <= burnPlan.maxT) {
          cue('burn'); warp = 1;
          if (ship.t >= burnPlan.startT + late) { thrust = 1; aim = burnPlan.along; }
        } else { burnPlan = null; transferPlan = null; }
      } else if (coastPhase) {
        const r = Math.hypot(ship.x - ps.x, ship.z - ps.z);
        const reached = tb.orbit > coastPhase.untilR ? r >= coastPhase.untilR : r <= coastPhase.untilR;
        if (!reached && ship.t < coastPhase.untilT + (par === 'sun' ? 3000 : 400)) cue('coast'); else coastPhase = null;
      }
      if (!onCourse && !burnPlan && !coastPhase) {
        const lastTau = transferPlan?.p ? transferPlan.p.tau - (ship.t - transferPlan.simT) : Infinity;
        const simSince = transferPlan ? ship.t - transferPlan.simT : Infinity;
        const realSince = transferPlan ? real - transferPlan.real : Infinity;
        const due = !transferPlan || (lastTau < 20 ? simSince > 0.2 : realSince > (lastTau > 120 ? 4 : 2) || simSince > Math.max(30, lastTau / 4));
        const prev = transferPlan?.p;
        const inWindow = prev && planIsGood(prev, target) && lastTau < 2 && lastTau > -(Math.abs(prev.dv) / accel) - 3;
        if (inWindow && due) transferPlan = { simT: ship.t, real, p: planTransfer(ship, target, { quick: true, dvHint: prev.dv, maxTau: lastTau }) };
        else if (due) {
          let p = prev && planIsGood(prev, target) && lastTau > 0 ? planTransfer(ship, target, { around: { tau: lastTau, dv: prev.dv } }) : null;
          if (!(p && planIsGood(p, target))) {
            const was = p;
            p = planTransfer(ship, target); m.full++;
            if (process.env.V) console.log(`  t${ship.t.toFixed(0)} full search (tracked: ${was ? `peri ${was.peri.toFixed(1)} blk ${was.blocked} retro ${was.retro}` : 'none'}) -> at ${p ? (ship.t + p.tau).toFixed(0) : '-'} dv ${p?.dv.toFixed(3)} peri ${p?.peri.toFixed(1)} good ${planIsGood(p, target)}`);
          }
          transferPlan = { simT: ship.t, real, p };
        }
        const p = transferPlan?.p;
        if (p && planIsGood(p, target)) {
          const at = transferPlan.simT + p.tau; const tau = at - ship.t;
          if (m.lastAt != null && Math.abs(at - m.lastAt) > 2) { m.changes++; m.maxJump = Math.max(m.maxJump, Math.abs(at - m.lastAt)); }
          m.lastAt = at;
          const cd = Math.ceil(tau);
          if (m.lastCd != null && cd > m.lastCd + 1) m.cdUp++;
          m.lastCd = cd;
          const burnTime = Math.abs(p.dv) / accel;
          if (Math.abs(p.dv) < 0.02) cue('oncourse');
          else if (tau <= burnTime * 0.5 + 0.3) { burnPlan = { dvTarget: Math.abs(p.dv), along: p.dv >= 0, delivered: 0, startT: ship.t, maxT: burnTime * 2 + 6 }; m.burns++; m.lastAt = null; m.lastCd = null; cue('burn'); } else { cue('wait'); warp = tau > 120 ? 64 : tau > 30 ? 16 : tau > 5 ? 4 : 1; }
        } else cue('search');
      }
    }
    if (aim !== null) {
      const sb = ship.soi === 'sun' ? { vx: 0, vz: 0 } : states[ship.soi];
      const rvx = ship.vx - sb.vx; const rvz = ship.vz - sb.vz;
      ship.angle = aim ? Math.atan2(rvz, rvx) : Math.atan2(-rvz, -rvx);
    }
    const budget = thrust && burnPlan ? { remaining: burnPlan.dvTarget - burnPlan.delivered, aim: ship.angle } : undefined;
    const res = stepWorld(ship, { thrust, burnBudget: budget }, 1 / 60, WARP_LEVELS.includes(warp) ? warp : 1, { autopilot: true, pathClear: !pred?.impact, target: tb.ring ? null : target });
    if (burnPlan && budget && res.dvUsed) { burnPlan.delivered += res.dvUsed; m.dvUsed += res.dvUsed; }
  }
  console.log(`${(OLD ? 'OLD ' : 'NEW ') + name.padEnd(22)} ${done() ? 'ARRIVED' : 'not yet'} real ${real.toFixed(0)}s sim ${ship.t.toFixed(0)} | plan moves ${m.changes} (max ${m.maxJump.toFixed(0)} s), countdown up-jumps ${m.cdUp}, full searches ${m.full}, burns ${m.burns}, dv ${m.dvUsed.toFixed(2)}, banner changes ${m.cueFlips}, closest jumps ${m.closeJumps}`);
}

const which = process.argv[3];
const all = [
  ['earth->moon', 'moon', () => around('earth', 1.6, 50), {}],
  ['earth->moon late 1.5s', 'moon', () => around('earth', 1.6, 50, 2), { late: 1.5 }],
  ['moon->mars v1.5', 'mars', () => escaped(300, 1.5, 0), {}],
  ['moon->mars v2.5 late', 'mars', () => escaped(300, 2.5, 0.3), { late: 1.0 }],
  ['moon->mars v1.0', 'mars', () => escaped(300, 1.0, -0.4), {}],
  ['mars->belt', BELT, () => helio(9100, 2000, 0.02, 1), {}],
  ['jupiter->europa', 'europa', () => around('jupiter', 12, 3000, 1), {}],
  ['jupiter->europa b', 'europa', () => around('jupiter', 7, 3000, 4), { late: 1 }],
  ['belt->jupiter', 'jupiter', () => helio(12300, 4000, 0.01, 2), { maxReal: 600 }],
];
for (const [n, tg, mk, o] of all) if (!which || n.startsWith(which)) leg(n, tg, mk(), o);
