// Dev-only playtest driver for Chapter 4. Load it in the browser console:
//   const P = await import('/src/space/lab/playtest.js');
//   await P.skipIntro(); await P.flyTransfer(); await P.coastTo('moon'); ...
//
// Every "fly" helper plays the way a child on Easy would: it only reads the
// on-screen cue banner (#burnCue) and holds Space (auto-aim) + W when the cue
// says to burn. So a leg that passes here is a leg the cue can talk a child
// through. Nothing here is part of the game build.
import { orbitElements } from '../physics.js';
import { bodyState } from '../orbits.js';
import { BODIES, STORE_KEYS } from '../contracts.js';
import { SPACE_QUESTIONS } from '../questions.space.js';
import { personalise } from '../acts/util.js';
import { LEVEL } from '../level.js';

const g = () => window.__space;
// sleep(0) must not use setTimeout: browsers throttle timers in hidden tabs
// to ~1 per second (then per minute), which stalled the autopilot. A
// MessageChannel round trip yields to the event loop without that throttle.
const _mc = new MessageChannel();
const _waiters = [];
_mc.port1.onmessage = () => { const r = _waiters.shift(); if (r) r(); };
export const sleep = (ms) => (ms > 0
  ? new Promise((r) => setTimeout(r, ms))
  : new Promise((r) => { _waiters.push(r); _mc.port2.postMessage(0); }));
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const cue = () => document.getElementById('burnCue')?.textContent || '';
export const modalUp = () => !!document.querySelector('.sp-modal button');

/** Run the opening cinematic out, letting its promise cleanup happen. */
export async function skipIntro() {
  for (let i = 0; i < 60 && g().cinematic; i++) { g().debugRun(0.5); await sleep(10); }
  await sleep(100);
}

/** Answer any open question correctly, then click through cards and dialogue. */
export async function clear(max = 12) {
  const log = [];
  for (let k = 0; k < max; k++) {
    // A src/lesson/ card (the Europa biology lesson): answer it all at once.
    if (window.__lesson?.open) { window.__lesson.answerAll(); log.push('lesson'); await sleep(200); continue; }
    const choices = [...document.querySelectorAll('.sp-choice')];
    const title = document.querySelector('.sp-modal__title')?.textContent;
    if (choices.length) {
      // The correct text of any bank question that matches a button on screen.
      // (Personalised: the HUD shows the child's name where the bank says Zara.)
      const correctTexts = new Set(Object.values(SPACE_QUESTIONS)
        .filter((qq) => qq.type === 'choice')
        .map((qq) => personalise(qq).choices.find((x) => x.correct).text));
      const right = choices.find((c) => correctTexts.has(c.textContent.trim()))
        || choices.find((c) => c.dataset.correct === '1'); // flight-school lesson questions
      if (right) { right.click(); log.push(`answered: ${title}`); await sleep(250); }
    }
    const input = document.querySelector('.sp-modal input[type="text"], .sp-modal input:not([type])');
    if (input && !input.value) {
      const q = Object.values(SPACE_QUESTIONS).find((qq) => qq.type === 'text' && document.querySelector('.sp-modal')?.textContent.includes(personalise(qq).prompt.slice(0, 40)));
      if (q) {
        input.value = q.answers[0];
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const submit = [...document.querySelectorAll('.sp-modal button')].find((b) => /Check|Submit|Answer/.test(b.textContent));
        submit?.click();
        log.push(`typed: ${title}`);
        await sleep(250);
      }
    }
    const btn = [...document.querySelectorAll('.sp-modal button')].find((b) => /Continue|Got it|Next|Done|Close|Not now/.test(b.textContent));
    if (!btn) break;
    btn.click();
    await sleep(200);
  }
  return log;
}

/** Wait for the burn window, then burn until the cue says stop. */
export async function flyTransfer() {
  let t = 0;
  // Like a child: use warp when the banner says to, stop when it drops out.
  while (t < 250 && !/BURN NOW/.test(cue())) {
    if (/time warp/.test(cue()) || !cue() || getComputedStyle(document.getElementById('burnCue')).display === 'none') g().bus.emit('warp-request', 3);
    g().debugRun(0.1); t += 0.1;
    if (modalUp()) await clear();
  }
  key('Space', true); key('KeyW', true);
  let b = 0;
  while (b < 20 && !/Let go|On course|Coast/.test(cue())) { g().debugRun(1 / 60); b += 1 / 60; }
  key('KeyW', false); key('Space', false);
  await sleep(30);
  g().debugRun(0.3);
  const c = g().prediction?.closest;
  return `transfer: waited ${t.toFixed(1)}s, burned ${b.toFixed(1)}s, closest ${c?.body} ${c?.dist.toFixed(1)}, fuel ${g().ship.fuel.toFixed(2)}`;
}

/** Coast with warp until the ship is inside `soi`, clearing modals as they come. */
export async function coastTo(soi, warp = 2, limit = 1500) {
  let t = 0;
  while (t < limit && g().ship.soi !== soi) {
    g().bus.emit('warp-request', warp);
    g().debugRun(0.5);
    t += 0.5;
    if (modalUp()) await clear();
  }
  g().bus.emit('warp-request', 0);
  await sleep(50);
  return `coast: ${t.toFixed(0)}s real at warp index ${warp}, soi ${g().ship.soi}, step ${g().missions.step.id}`;
}

/** Follow the capture cue until the step changes or a question opens. */
export async function flyCapture(stepId, limit = 240) {
  let crashes = 0;
  const off = g().bus.on('crash', () => crashes++);
  let sim = 0;
  let burnT = 0;
  const f0 = g().ship.fuel;
  while (sim < limit && g().missions.step.id === stepId && !modalUp()) {
    const burning = /BURN NOW|tap W/.test(cue());
    key('Space', burning); key('KeyW', burning);
    if (burning) burnT += 1 / 30;
    g().debugRun(1 / 30);
    sim += 1 / 30;
  }
  key('KeyW', false); key('Space', false);
  off?.();
  const o = orbitElements(g().ship);
  return `capture: ${sim.toFixed(1)}s, burned ${burnT.toFixed(1)}s, fuel used ${(f0 - g().ship.fuel).toFixed(2)}, crashes ${crashes}, orbit ${o.body} bound ${o.bound} peri ${o.periapsis.toFixed(1)} apo ${o.apoapsis?.toFixed(1)}`;
}

/**
 * Land the way the landing panel teaches: auto-aim backwards (Space) and burn
 * (W) whenever the speed is out of the safe band for the height.
 */
export async function flyLanding(bodyId, limit = 300) {
  let crashes = 0;
  let landed = null;
  const offC = g().bus.on('crash', () => crashes++);
  const offL = g().bus.on('landed', (e) => { landed = e; });
  const safe = g().ship.safeLandingSpeed;
  const R = g().bodies.views[bodyId]?.radius ?? 10;
  let sim = 0;
  let burnT = 0;
  const f0 = g().ship.fuel;
  while (sim < limit && !landed && !modalUp()) {
    const m = g().states[bodyId];
    const rx = g().ship.x - m.x; const rz = g().ship.z - m.z;
    const vx = g().ship.vx - m.vx; const vz = g().ship.vz - m.vz;
    const sp = Math.hypot(vx, vz);
    const alt = Math.hypot(rx, rz) - R;
    // Follow the landing cue exactly, as a child on Easy would.
    const burning = /Brake|Too fast/.test(cue());
    void sp; void alt; void safe;
    key('Space', true); key('KeyW', burning);
    if (burning) burnT += 1 / 30;
    g().debugRun(1 / 30);
    sim += 1 / 30;
  }
  key('KeyW', false); key('Space', false);
  offC?.(); offL?.();
  return `landing: ${sim.toFixed(1)}s, burned ${burnT.toFixed(1)}s, fuel used ${(f0 - g().ship.fuel).toFixed(2)} left ${g().ship.fuel.toFixed(2)}, crashes ${crashes}, landed ${landed ? `${landed.body} at ${landed.speed.toFixed(2)}` : 'no'}, step ${g().missions.step.id}`;
}

/** Put the ship in a circular orbit around `bodyId` (for testing a later act). */
export function placeInOrbit(bodyId, radius, phase = 0) {
  const G = g();
  const s = bodyState(bodyId, G.ship.t);
  const gm = BODIES[bodyId].gm;
  const v = Math.sqrt(gm / radius);
  const c = Math.cos(phase); const sn = Math.sin(phase);
  Object.assign(G.ship, {
    x: s.x + radius * c, z: s.z + radius * sn, vx: s.vx - v * sn, vz: s.vz + v * c,
    angle: Math.atan2(c, -sn), angVel: 0, soi: bodyId, landedOn: null, _accum: 0,
  });
  return `placed in ${bodyId} orbit r=${radius}`;
}

/** Tick in small chunks, yielding so scene promises resolve, clearing windows. */
export async function run(sec) {
  for (let t = 0; t < sec; t += 0.25) {
    g().debugRun(0.25, 1 / 30);
    await sleep(0);
    // Leave the upgrade bay for autoplay to decide (clear() would say "Not now").
    if (modalUp() && !document.querySelector('.sp-upgrade')) await clear();
    if (document.querySelector('.sp-upgrade')) return;
  }
}

/** Press a scene key (surface debug handle) for a moment. */
async function tap(d, code, hold = 0.35) {
  d.key(code, true);
  await run(hold);
  d.key(code, false);
}

/** Play the Moon walk start to finish by following its objective card
 *  (a fixed timeline fell out of step when a question stayed open longer). */
export async function playMoonWalk() {
  const log = [];
  for (let i = 0; i < 40 && !g().activeScene; i++) { await sleep(250); await clear(); }
  const S = g().activeScene;
  if (!S) return ['no scene'];
  await S.ready;
  const d = S.debug;
  const L = d.L;
  const objective = () => document.querySelector('.sp-mission__objective')?.textContent || '';
  for (let k = 0; k < 80 && g().activeScene; k++) {
    await clear();
    const o = objective();
    if (/big jump|jump high/i.test(o)) { await tap(d, 'Jump', 0.5); await run(3); }
    else if (/glowing rock/i.test(o)) { d.place(L.sample.x, L.sample.z + 0.6, Math.PI); await run(0.6); await tap(d, 'KeyE'); await run(4); }
    else if (/footprints/i.test(o)) { d.place(L.oldPrints.x, L.oldPrints.z + 2.2, Math.PI); await run(6); }
    else if (/ladder/i.test(o)) { d.place(d.ladder.x, d.ladder.z); await run(0.8); await tap(d, 'KeyE'); await run(4); }
    else await run(1.5); // climbing down, talking, or a cut-scene
  }
  log.push(`scene over: ${!g().activeScene}, step ${g().missions.step.id}, samples ${JSON.stringify(g().samples)}`);
  return log;
}

/** Fly by the cue alone until `done()` is true: hold Space always, W only
 *  when the banner says to burn. */
export async function followCue(done, limit = 120, dt = 1 / 30) {
  let sim = 0;
  let burnT = 0;
  const f0 = g().ship.fuel;
  while (sim < limit && !done()) {
    const burning = /BURN NOW|hold W|Hold W|tap W/.test(cue()) && !/Let go|Ease off/.test(cue());
    key('Space', true); key('KeyW', burning);
    if (burning) burnT += dt;
    g().debugRun(0.1, dt);
    sim += 0.1;
    await sleep(0);
    if (modalUp()) await clear();
  }
  key('KeyW', false); key('Space', false);
  return `followCue: ${sim.toFixed(1)}s, burned ${burnT.toFixed(1)}s, fuel used ${(f0 - g().ship.fuel).toFixed(2)} left ${g().ship.fuel.toFixed(2)}, soi ${g().ship.soi}, step ${g().missions.step.id}, cue "${cue().slice(0, 50)}"`;
}

/** Fly alongside the nearest rock of `kind` (matching its orbit) and mine it. */
async function mineOne(kind) {
  const G = g();
  const GM = 5.9e6;
  const d = (rk) => Math.hypot(rk.x - G.ship.x, rk.z - G.ship.z);
  const rk = [...G.belt.nearRocks].filter((r) => r.kind === kind && r.remaining > 0).sort((a, b) => d(a) - d(b))[0];
  if (!rk) { G.debugRun(0.5); return; }
  const rr = Math.hypot(rk.x, rk.z) + rk.radius + 1.5;
  const a = Math.atan2(rk.z, rk.x);
  const v = Math.sqrt(GM / rr);
  Object.assign(G.ship, { x: rr * Math.cos(a), z: rr * Math.sin(a), vx: -v * Math.sin(a), vz: v * Math.cos(a), angVel: 0, _accum: 0 });
  G.debugRun(0.2);
  G.bus.emit('interact');
  await run(4);
}

/** Solve the satellite panel puzzle by watching the power bar. */
async function solvePanel() {
  const pw = () => parseFloat(document.querySelector('.satp-bar-fill[data-el=power]')?.style.width || '0');
  let dir = 'KeyD';
  let prev = pw();
  key(dir, true);
  for (let t = 0; t < 20 && g().activeScene; t += 0.05) {
    g().debugRun(0.05, 1 / 60);
    await sleep(0);
    const now = pw();
    if (now >= 99.6) key(dir, false);
    else if (now < prev - 0.5) { key(dir, false); dir = dir === 'KeyD' ? 'KeyA' : 'KeyD'; key(dir, true); }
    prev = now;
  }
  key('KeyD', false); key('KeyA', false);
}

/** Play the Europa walk: walk, drill, and let the finale run. */
export async function playEuropaWalk() {
  const S = g().activeScene;
  if (!S) return;
  await S.ready;
  const d = S.debug;
  const L = d.L;
  await run(12);
  d.place(L.drill.x + 4, L.drill.z + 5, Math.PI); await run(4);
  d.place(L.drill.x + 0.9, L.drill.z + 0.9, Math.PI); await run(3);
  d.key('KeyE', true); await run(8); d.key('KeyE', false);
  for (let i = 0; i < 40 && g().activeScene; i++) await run(0.5);
}

/**
 * Autopilot: play by the cues like a child on Easy for up to `seconds` of real
 * time. Returns a progress log. Call repeatedly (each call stays under the
 * browser tool's time limit).
 */
export const cueLog = [];
let cueLogLast = '';

export async function autoplay(seconds = 30) {
  const G = g();
  const log = [];
  const start = performance.now();
  let lastStep = G.missions.step.id;
  log.push(`start ${lastStep} t=${G.ship.t.toFixed(0)} fuel=${G.ship.fuel.toFixed(2)}`);
  while (performance.now() - start < seconds * 1000) {
    if (G.cinematic) { G.debugRun(0.5); await sleep(0); continue; }
    if (G.activeScene) {
      const step = G.missions.step.id;
      if (step === 'a2_surface') await playMoonWalk();
      else if (step === 'a5_surface') await playEuropaWalk();
      else if (document.querySelector('.satp-wrap')) await solvePanel();
      else await run(1);
      continue;
    }
    if (modalUp()) {
      const t = document.querySelector('.sp-modal__title')?.textContent || '';
      if (/reached Europa/.test(t)) { log.push('END CARD'); break; }
      // Upgrade bay: build whatever is affordable and needed (like a child would).
      const buy = [...document.querySelectorAll('.sp-upgrade:not(:disabled)')]
        .find((b) => /Big Solar Wings|Radiation Shield/.test(b.textContent));
      if (buy) { buy.click(); log.push(`built ${buy.querySelector('.sp-upgrade__name')?.textContent}`); await sleep(200); continue; }
      // Low on fuel: melt spare ice (keeping 2 for the shield if it isn't built).
      const spareIce = (G.resources.ice || 0) - (G.radiationShield ? 0 : 2);
      const holdFull = G.ship.cargo >= 7.7 && !G.radiationShield;
      const melt = (G.ship.fuel < G.fuelCapacity - 1 || holdFull) && spareIce >= 1 &&
        [...document.querySelectorAll('.sp-upgrade:not(:disabled)')].find((b) => /Melt ice/.test(b.textContent));
      if (melt) { melt.click(); log.push(`melted ice, fuel ${G.ship.fuel.toFixed(2)}`); await sleep(200); continue; }
      await clear(3);
      continue;
    }
    // Mining steps: fly alongside the nearest rock of a kind still needed.
    const stepNow = G.missions.step.id;
    const needSilicon = stepNow === 'a3_build_wings' && (G.resources.silicon || 0) < 4;
    const needMetalIce = (stepNow === 'a3_build_wings' && (G.resources.metal || 0) < 2) || ((stepNow === 'a3_depart' || /a4_/.test(stepNow)) && !G.radiationShield && ((G.resources.metal || 0) < 4 || (G.resources.ice || 0) < 2));
    if (stepNow === 'a3_mining' || needSilicon || needMetalIce) {
      const kinds = stepNow === 'a3_mining' ? ['metal', 'stony', 'icy'] : needSilicon ? ['stony'] : ['metal', 'icy'];
      for (const kind of kinds) await mineOne(kind);
      continue;
    }
    const c = cue();
    const shown = getComputedStyle(document.getElementById('burnCue')).display !== 'none' && c;
    const burn = shown && /BURN NOW|hold W|Hold W|tap W|Brake|Too fast/.test(c) && !/Let go|Ease off/.test(c);
    // Easy: hold Space and let auto-aim turn the ship. Medium/Hard: steer by
    // hand with A/D toward the arrow's heading, and only fire once lined up
    // (a child who fires while still turning wastes fuel).
    let aligned = true;
    let steering = false;
    if (G.mode.autoAim) {
      key('Space', true);
    } else {
      key('Space', false);
      const want = G.aimAngle();
      if (want !== null && !G.ship.landedOn) {
        const err = Math.atan2(Math.sin(want - G.ship.angle), Math.cos(want - G.ship.angle));
        const brake = G.ship.angVel * 0.6; // ease off before it overshoots
        key('KeyD', err - brake > 0.04); // turn +1 (D) raises the heading angle
        key('KeyA', err - brake < -0.04);
        aligned = Math.abs(err) < 0.45; // same gate as Easy's auto-aim
        // Only hold off warping to steer when it matters: a burn is on the
        // banner or coming up soon. Otherwise let go and warp, like a child.
        const soon = /BURN NOW|hold W|Hold W|tap W|Brake|Too fast|Turn to point|keep the speed|window in [1-5]?[0-9] s\./.test(c);
        steering = soon && (Math.abs(err) > 0.08 || Math.abs(G.ship.angVel) > 0.2);
      } else { key('KeyD', false); key('KeyA', false); }
    }
    key('KeyW', !!burn && aligned);
    // Satellite fix step: press E once docked.
    if (G.missions.step.id === 'a1_satellite_fix') { key('KeyE', true); G.debugRun(0.2); key('KeyE', false); }
    if (burn || steering) { G.bus.emit('warp-request', 0); G.debugRun(0.1, 1 / 30); }
    else {
      key('KeyA', false); key('KeyD', false); // hands off the stick before warping
      const warp = !shown || /time warp|Looking|Coast|On course|Escaping/.test(c) ? 3 : 0;
      G.bus.emit('warp-request', warp);
      G.debugRun(0.3, 1 / 20);
    }
    await sleep(0);
    const step = G.missions.step.id;
    if (step !== lastStep) {
      log.push(`-> ${step} t=${G.ship.t.toFixed(0)} fuel=${G.ship.fuel.toFixed(2)}`); lastStep = step;
      // A checkpoint per step, to replay a leg: copy it back to the save key.
      G.missions.save?.();
      try { localStorage.setItem(`ch4_ckpt_${step}`, localStorage.getItem(STORE_KEYS[LEVEL])); } catch { /* storage full */ }
    }
    // Cue log (changes only), for reading back what she was told and when.
    const cNow = cue();
    const cKey = cNow.replace(/\d+(\.\d+)?/g, '#');
    if (cKey !== cueLogLast) {
      cueLogLast = cKey;
      cueLog.push(`t=${G.ship.t.toFixed(0)} f=${G.ship.fuel.toFixed(2)} ${G.ship.soi} ${step} | ${cNow}`);
      if (cueLog.length > 600) cueLog.splice(0, 100);
    }
  }
  key('KeyW', false); key('Space', false); key('KeyA', false); key('KeyD', false);
  return log;
}
