// Autopilot (Chapter 4): flies the ship for a child who finds the flying too
// hard, to the next destination or question. It never answers or skips a
// question - whenever a question, fact or story card is open it simply waits
// for her. It does handle the upgrade bay (buying the solar wings / shield it
// needs, melting ice for fuel), because that is flying logistics, not a
// question, and a wrong choice there could leave the autopilot stuck.
//
// On: the "Autopilot" button or P. Off: the button, P again, or taking the
// controls yourself (W, A, S, D, Space or an arrow key).
//
// It flies the way the lab autopilot (lab/playtest.js) has been flying every
// end-to-end test: by the on-screen banners (burn windows, "let go", "coast")
// and the aim arrow, with time warp while coasting. It runs on the real
// clock, one decision per frame, pressing keys through controls.press()
// exactly as the touch pad does. Mining and the Moon/Europa walks move her
// straight to the spot ("the autopilot takes her there").

import { t } from './level.js';
import { OUTER } from './chapter.js';
import { toggleBar, paintToggle } from './hud/toggleBar.js';
import { BODIES } from './contracts.js';

const MANUAL_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createAutopilot(game, { controls, hud }) {
  let on = false;
  let loopRunning = false;
  // Easy: the autopilot flies every orbit - the burns, captures and landings
  // are hard to time. The Moon and Europa walks stay hers; a second press
  // hands those over too, and her own flying keys don't switch it off on
  // Easy. It starts OFF (lead, 2026-10-05: "chapter 4 starts with autopilot
  // on... turn off the autopilot as a default but keep the steering on, and
  // let the user go to higher warp speed") - Easy still steers the ship for
  // her and the pace is hers until she presses the button.
  let easyAuto = false;
  let userOff = false;
  const held = new Set();
  let aimPrev = null; // last aim direction and its sim time (for its turn rate)

  // --- the switch ------------------------------------------------------------
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sp-autopilot';
  btn.setAttribute('aria-pressed', 'false');
  toggleBar(game).appendChild(btn);
  function paint() {
    paintToggle(btn, 'P', 'Autopilot', on ? 'on' : 'off', on
      ? (easyAuto ? 'Autopilot is flying (Easy). The walks are yours. P: let it do the walks too' : 'Autopilot is flying. P to fly yourself')
      : 'Autopilot is off: you fly. P to switch it on');
  }
  paint();

  function setOn(v, why) {
    if (on === !!v) return;
    on = !!v;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    paint();
    // Hard mode hides the banners; the autopilot flies by them.
    game.debugCues = on;
    if (on) {
      hud.toast(easyAuto
        ? (OUTER
          ? t('Easy: the autopilot flies the ship. You answer the questions and play the games on the way!', 'Easy: the autopilot flies. You answer questions and play the games!')
          : t('Easy: the autopilot flies the ship. You answer the questions and explore the Moon and Europa!', 'Easy: the autopilot flies. You answer questions and walk on the Moon and Europa!'))
        : 'Autopilot on. It flies to the next stop - you answer the questions!', { kind: 'info', ms: 4200 });
      if (!loopRunning) loop();
    } else {
      releaseAll();
      game.aimOverride = null;
      game.bus.emit('warp-request', 0);
      if (why) hud.toast(why, { kind: 'info', ms: 2600 });
    }
  }
  // P / the button. Off -> on (on Easy the walks stay hers) -> the full
  // autopilot, walks and all -> off.
  function toggle() {
    if (!on) { easyAuto = game.mode?.id === 'easy'; setOn(true); return; }
    if (on && easyAuto) {
      easyAuto = false;
      paint();
      hud.toast('Full autopilot: it does the walks too.', { kind: 'info', ms: 2600 });
      return;
    }
    if (on) userOff = true;
    setOn(!on, 'Autopilot off. You have the controls.');
  }
  btn.addEventListener('click', toggle);
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyP' && !e.repeat) { toggle(); return; }
    // Her own hands on the controls take over (not on Easy, where it flies for her).
    if (on && !easyAuto && e.isTrusted && MANUAL_KEYS.has(e.code)) { userOff = true; setOn(false, 'You took the controls. Autopilot off.'); }
  }, true);
  // A change of mode away from Easy hands the controls back.
  setInterval(() => {
    if (easyAuto && game.mode?.id !== 'easy') { easyAuto = false; setOn(false); }
  }, 500);

  // --- key helpers -------------------------------------------------------------
  function key(code, down) {
    // Pressed again every frame it is wanted: the game drops every held key
    // when the window loses focus or a card opens, and a key remembered here
    // as "held" was then never pressed again (press() ignores a key already
    // down, so this costs nothing).
    if (down) { held.add(code); controls.press(code, true); }
    else if (held.has(code)) { held.delete(code); controls.press(code, false); }
  }
  function tap(code) { controls.press(code, true); controls.press(code, false); }
  function releaseAll() { for (const c of [...held]) key(c, false); }

  // One frame. Tests swap in their own (the Browser pane draws no frames
  // while hidden): useFrame(() => { game.debugRun(1 / 30, 1 / 30); ... }).
  // (A timer backs up the frame: a hidden tab draws none, and a wait begun
  // there must not hang the loop for good.)
  let frameFn = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 250); });
  const frame = () => frameFn();
  async function wait(sec) {
    const t0 = performance.now();
    while (on && performance.now() - t0 < sec * 1000) await frame();
  }

  // The banner's ORDER (data-raw): while we fly, the banner itself narrates.
  const cueText = () => {
    const el = document.getElementById('burnCue');
    // data-raw is the order even while the banner is hidden (a bottom panel
    // can hide it): reading only a visible banner, it warped through every
    // burn window (2026-10-05 lab).
    if (!el) return '';
    if (el.dataset.raw !== undefined) return el.dataset.raw;
    return getComputedStyle(el).display !== 'none' ? el.textContent || '' : '';
  };
  const modalUp = () => !!document.querySelector('.sp-modal button');

  // --- the upgrade bay (the only card it touches) --------------------------------
  function handleBay() {
    const ups = [...document.querySelectorAll('.sp-upgrade:not(:disabled)')];
    if (!ups.length) return false;
    const buy = ups.find((b) => /Big Solar Wings|Radiation Shield/.test(b.textContent));
    if (buy) { buy.click(); return true; }
    const spareIce = (game.resources.ice || 0) - (game.radiationShield ? 0 : 2);
    const holdFull = game.ship.cargo >= 7.7 && !game.radiationShield;
    const lowFuel = game.ship.fuel < game.fuelCapacity - 1;
    const melt = ups.find((b) => /Melt ice/.test(b.textContent));
    if (melt && (lowFuel || holdFull) && spareIce >= 1) { melt.click(); return true; }
    const notNow = [...document.querySelectorAll('.sp-modal button')].find((b) => /Not now/.test(b.textContent));
    if (notNow) { notNow.click(); return true; }
    return false;
  }

  // --- scenes (the wing puzzle, the Moon and Europa walks) ------------------------
  async function solvePanel() {
    const power = () => parseFloat(document.querySelector('.satp-bar-fill[data-el=power]')?.style.width || '0');
    let dir = 'KeyD';
    let prev = power();
    key(dir, true);
    const t0 = performance.now();
    while (on && game.activeScene && performance.now() - t0 < 30000) {
      await frame();
      const now = power();
      if (now >= 99.6) key(dir, false); // inside even Hard's 7-degree window
      else if (now < prev - 0.5) { key(dir, false); dir = dir === 'KeyD' ? 'KeyA' : 'KeyD'; key(dir, true); }
      prev = now;
    }
    key('KeyD', false); key('KeyA', false);
  }

  async function sceneKey(d, code, sec = 0.4) {
    d.key(code, true); await wait(sec); d.key(code, false);
  }

  async function walkScene() {
    const S = game.activeScene;
    const d = S?.debug;
    if (!d) { await wait(0.5); return; }
    const L = d.L;
    const objective = document.querySelector('.sp-mission__objective')?.textContent || '';
    const step = game.missions.step.id;
    if (step === 'a5_surface') {
      // Europa: follow the objective card - walk to the glowing crack, then
      // hold E at it to drill; the finale plays by itself.
      if (/glowing crack/i.test(objective) && L?.drill) { d.place(L.drill.x + 4, L.drill.z + 5, Math.PI); await wait(2); }
      else if (/drill/i.test(objective) && L?.drill) {
        d.place(L.drill.x + 0.9, L.drill.z + 0.9, Math.PI);
        await wait(1);
        d.key('KeyE', true); await wait(8); d.key('KeyE', false);
      } else await wait(1);
      return;
    }
    // The Moon walk: follow the objective card.
    if (/big jump|jump high/i.test(objective)) { await sceneKey(d, 'Jump', 0.5); await wait(2.5); }
    else if (/glowing rock/i.test(objective) && L?.sample) { d.place(L.sample.x, L.sample.z + 0.6, Math.PI); await wait(0.6); await sceneKey(d, 'KeyE'); await wait(3); }
    else if (/footprints/i.test(objective) && L?.oldPrints) { d.place(L.oldPrints.x, L.oldPrints.z + 2.2, Math.PI); await wait(4); }
    else if (/ladder/i.test(objective)) { const l = d.ladder; d.place(l.x, l.z); await wait(0.8); await sceneKey(d, 'KeyE'); await wait(3); }
    else await wait(1);
  }

  // --- mining (the asteroid belt) -----------------------------------------------
  async function mineOne(kind) {
    const GM = 5.9e6;
    const dist = (rk) => Math.hypot(rk.x - game.ship.x, rk.z - game.ship.z);
    const rk = [...(game.belt?.nearRocks || [])].filter((r) => r.kind === kind && r.remaining > 0).sort((a, b) => dist(a) - dist(b))[0];
    if (!rk) { await wait(0.5); return; }
    // Fly alongside it (matching its orbit), then the claw.
    const rr = Math.hypot(rk.x, rk.z) + rk.radius + 1.5;
    const a = Math.atan2(rk.z, rk.x);
    const v = Math.sqrt(GM / rr);
    Object.assign(game.ship, { x: rr * Math.cos(a), z: rr * Math.sin(a), vx: -v * Math.sin(a), vz: v * Math.cos(a), angVel: 0, _accum: 0 });
    await wait(0.2);
    game.bus.emit('interact');
    await wait(3.5);
  }

  // --- tidying her orbit (lead, 2026-10-06) ------------------------------------------
  // "After taking manual control and then turning on the autopilot, the
  // autopilot calculates the correct trajectory." The banners it flies by
  // assume a sensible orbit; after her own burns she can be on one that dips
  // into the planet, or so stretched that no burn window ever shows. Then it
  // first makes her orbit round at her present height round the body she is
  // in (point along the needed change of velocity, hold W), and the banners
  // take over from there. Never while landing, or in the Sun's pull.
  // When the banner last went blank, in REAL seconds (sim time races under
  // the warp the autopilot itself asks for), and on which step: a new step
  // starts the count again.
  let idleSince = null;
  let idleStep = null;
  let lastFix = null; // tests: the last tidy-up it wanted ({aim, dv, why} or null)
  function orbitFix() {
    const G = game; const ship = G.ship;
    const st = G.missions.step || {};
    if (st.id !== idleStep) { idleStep = st.id; idleSince = null; }
    if (ship.landedOn || ship.soi === 'sun' || st.land) { idleSince = null; return null; }
    const b = BODIES[ship.soi]; const bs = G.states?.[ship.soi];
    if (!b || !bs) { idleSince = null; return null; }
    const rx = ship.x - bs.x; const rz = ship.z - bs.z;
    const vx = ship.vx - (bs.vx || 0); const vz = ship.vz - (bs.vz || 0);
    const r = Math.hypot(rx, rz); const mu = b.gm;
    const h = rx * vz - rz * vx; const en = (vx * vx + vz * vz) / 2 - mu / r;
    const e = Math.sqrt(Math.max(0, 1 + (2 * en * h * h) / (mu * mu)));
    const peri = (h * h) / mu / (1 + e);
    const tooLow = peri < b.radius * 1.25;
    // On a capture step, inside the target's zone and bound: that is the goal, leave it.
    if (st.capture === ship.soi && en < 0 && !tooLow) { idleSince = null; return null; }
    const c = cueText();
    // Any banner at all counts as something to fly by.
    if (c.trim()) idleSince = null;
    else if (idleSince === null) idleSince = performance.now();
    // No banner for 20 real seconds, on a step that should have one (a transfer or a capture).
    const lost = !!(st.transfer || st.capture) && idleSince !== null && performance.now() - idleSince > 20000;
    if (!tooLow && !lost) return null;
    // Aim for a round orbit at her height (at least 1.6 radii), same way round.
    const rWant = Math.max(r, b.radius * 1.6);
    const vc = Math.sqrt(mu / rWant); const sgn = h >= 0 ? 1 : -1;
    const tx = (-rz / r) * vc * sgn; const tz = (rx / r) * vc * sgn;
    const dvx = tx - vx; const dvz = tz - vz; const dv = Math.hypot(dvx, dvz);
    if (dv < 0.05) { idleSince = null; return null; }
    return { aim: Math.atan2(dvz, dvx), dv, why: tooLow ? 'low' : 'lost' };
  }

  // --- one decision ---------------------------------------------------------------
  async function step() {
    if (game.paused || game.frozen || game.cinematic) { releaseAll(); await wait(0.3); return; }
    if (game.activeScene) {
      releaseAll();
      // Easy: the wing repair is precise timing too, so it does that; the
      // Moon and Europa walks are hers.
      if (easyAuto && !document.querySelector('.satp-wrap')) { await wait(0.3); return; }
      if (document.querySelector('.satp-wrap')) await solvePanel();
      else if (modalUp()) await wait(0.3); // a question in the walk: hers to answer
      else await walkScene();
      return;
    }
    if (modalUp()) {
      // Questions, facts and story cards: wait for her. The bay: handle it.
      releaseAll();
      handleBay();
      await wait(0.3);
      return;
    }
    const G = game;
    const stepNow = G.missions.step.id;
    const needSilicon = stepNow === 'a3_build_wings' && (G.resources.silicon || 0) < 4;
    const needMetalIce = (stepNow === 'a3_build_wings' && (G.resources.metal || 0) < 2)
      || ((stepNow === 'a3_depart' || /a4_/.test(stepNow)) && !G.radiationShield && ((G.resources.metal || 0) < 4 || (G.resources.ice || 0) < 2));
    if (stepNow === 'a3_mining' || needSilicon || needMetalIce) {
      releaseAll();
      const kinds = stepNow === 'a3_mining' ? ['metal', 'stony', 'icy'] : needSilicon ? ['stony'] : ['metal', 'icy'];
      for (const kind of kinds) { if (!on || modalUp()) break; await mineOne(kind); }
      return;
    }

    // Her orbit first, when it needs tidying (see orbitFix).
    const fix = orbitFix();
    lastFix = fix;
    // Easy's steering help steers to game.aimOverride while a fix is on, so
    // it helps the fix instead of turning her back to the step's heading.
    game.aimOverride = fix ? fix.aim : null;
    if (fix) {
      key('Space', false);
      const err = Math.atan2(Math.sin(fix.aim - G.ship.angle), Math.cos(fix.aim - G.ship.angle));
      const brake = G.ship.angVel * 0.6;
      key('KeyD', err - brake > 0.04);
      key('KeyA', err - brake < -0.04);
      key('KeyW', Math.abs(err) < 0.25);
      G.bus.emit('warp-request', 0);
      await frame();
      return;
    }
    const c = cueText();
    const burn = !!c && /BURN NOW|hold W|Hold W|tap W|Brake|Too fast/.test(c) && !/Let go|Ease off/.test(c);
    let aligned = true;
    let steering = false;
    if (G.mode.autoAim) {
      key('Space', true);
    } else {
      key('Space', false);
      const want = G.aimAngle();
      if (want !== null && !G.ship.landedOn) {
        const err = Math.atan2(Math.sin(want - G.ship.angle), Math.cos(want - G.ship.angle));
        // The aim (along the path, or backwards) turns as she orbits. Damp
        // the spin RELATIVE to it: damping her own spin alone left her
        // trailing ~15 degrees behind a turning target for good, which kept
        // the warp off before every Medium burn (real time crawled).
        const dts = G.ship.t - (aimPrev?.t ?? -1);
        const wantRate = aimPrev && dts > 1e-4 && dts < 2
          ? Math.atan2(Math.sin(want - aimPrev.want), Math.cos(want - aimPrev.want)) / dts : 0;
        aimPrev = { t: G.ship.t, want };
        const relVel = G.ship.angVel - wantRate;
        const brake = relVel * 0.6;
        key('KeyD', err - brake > 0.04);
        key('KeyA', err - brake < -0.04);
        aligned = Math.abs(err) < 0.45;
        // Also inside the last two minutes of a countdown while she points
        // well off: the warp waits for "aligned", so without turning first it
        // sat at 1x until the last minute (a3_depart real-pace run: 43 s).
        const winIn = Number(/window in (\d+) s/.exec(c)?.[1] ?? Infinity);
        const soon = /BURN NOW|hold W|Hold W|tap W|Brake|brake|Too fast|Getting fast|Turn to point|keep the speed|window in [1-5]?[0-9] s\./.test(c)
          || (winIn <= 120 && !aligned);
        steering = soon && (Math.abs(err) > 0.08 || Math.abs(relVel) > 0.2);
      } else { key('KeyD', false); key('KeyA', false); }
    }
    key('KeyW', burn && aligned);
    if (stepNow === 'a1_satellite_fix') tap('KeyE');
    if (burn || steering) G.bus.emit('warp-request', 0);
    else {
      key('KeyA', false); key('KeyD', false);
      // Pace the warp by the countdown, so a real screen never idles at 1x
      // for most of a minute before a burn (the game leaves this to us while
      // we fly): fast while the window is far, slower as it nears, 1x for
      // the last seconds and while turning.
      const win = /window in (\d+) s/.exec(c);
      const n = win ? Number(win[1]) : null;
      // 4 = the cruise warp (x256), which the physics only gives out between
      // the planets with the path clear (else it stays x64): the long coasts
      // on Easy took a minute or more of watching at x64.
      let warp = !c || /time warp|Looking|Coast|On course|Escaping/.test(c) ? 4 : 0;
      // Far from the window it warps even when not lined up (it turns once
      // the countdown is under two minutes, above).
      if (n !== null && (aligned || n > 120)) warp = n > 600 ? 4 : n > 120 ? 3 : n > 30 ? 2 : n > 5 ? 1 : 0;
      G.bus.emit('warp-request', warp);
    }
    await frame();
  }

  async function loop() {
    loopRunning = true;
    try {
      while (on) {
        try { await step(); } catch (e) { console.error('[autopilot]', e); await wait(0.5); }
        if (game.missions.step?.id === 'a5_end') { setOn(false, 'Autopilot off: you made it to Europa!'); }
      }
    } finally {
      releaseAll();
      loopRunning = false;
    }
  }

  return {
    get on() { return on; },
    set(v) { setOn(v); },
    /** Test hook: the last orbit tidy-up it wanted, or null. */
    get lastFix() { return lastFix; },
    /** Test hook: replace the per-frame wait (see `frame` above). */
    useFrame(fn) { frameFn = fn; },
  };
}
