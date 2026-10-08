// The story: a linear chain of STEPS, grouped into acts.
//
// A step is a small object:
//   { id, act, title, objective,
//     enter(ctx)          optional; may return a Promise (dialogue, a fact card,
//                         a cutscene). The step's check does not run until it
//                         settles, so a card is never skipped by a race.
//     check(ctx, states)  optional; returns true when the goal is met. A step
//                         with no check completes as soon as enter settles.
//     beat                optional; the question asked on completion
//                         (questions.space.js finds it by beat)
//     after(ctx)          optional; runs after the question - rewards, toasts
//     markers             body ids to point at while this step is active
//     aim                 'prograde' | 'retrograde' | 'target' | 'up' | 'with-body': where the aim arrow
//                         points (and Easy mode's hold-Space auto-aim turns her)
//     transfer            body id: show the burn-window cue for a transfer to it
//                         from a circular orbit around the same parent
//     capture             body id: show the capture cue (widen a crash path,
//                         coast to the lowest point, brake there)
//     land                body id: show the landing cue (start the descent,
//                         keep the speed in the green)
//     escape              true: show the escape cue (burn until the path breaks
//                         free, then coast) }
//
// Why a flat chain and not a quest graph: a 9-year-old should always know the
// ONE thing to do next, and a linear list is also trivially savable (one
// index). Acts are just labels on runs of steps.
//
// Questions never block progress. "Not now" defers the question; deferred
// questions are asked again at the next step boundary, so every question is
// still met before the finale.
import { BODIES, STORE_KEYS, SHIP, UPGRADES, CALM_S, QUIET_S } from './contracts.js';
import { t } from './level.js';
import { bodyState } from './orbits.js';
import { questionForBeat, getSpaceQuestion } from './questions.space.js';
import { heroName } from './hud/hud.js';
import { IS_CH5, IS_CH6, OUTER } from './chapter.js';
import { CH5_ACT_TITLES } from './ch5/start.js';
import { ch5Steps } from './ch5/steps.js';
import { CH6_ACT_TITLES } from './ch6/start.js';
import { ch6Steps } from './ch6/steps.js';
import { phasesNow, restorePhases } from './ch5/lineup.js';
import { inModalTurn } from './hud/modalQueue.js';
import { orbitElements } from './physics.js';

const ACT_TITLES_CH4 = {
  1: 'Act 1: Earth orbit',
  2: 'Act 2: The Moon',
  3: 'Act 3: Mars and the asteroid belt',
  4: 'Act 4: Jupiter',
  5: 'Finale: Europa',
};
const ACT_TITLES = IS_CH6 ? CH6_ACT_TITLES : IS_CH5 ? CH5_ACT_TITLES : ACT_TITLES_CH4;

// --- helpers ----------------------------------------------------------------

function difficulty() {
  try {
    const p = JSON.parse(localStorage.getItem('rocket_village_profile') || 'null');
    return p?.difficulty === 1 ? 1 : 4;
  } catch { return 4; }
}

const SAVE_KEY = STORE_KEYS[difficulty()];

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}

/** A copy of the save from the start of the current act (the two-tries
 *  rule sends her back there). Empty string = the very start. */
const ACT_KEY = `${SAVE_KEY}_act`;
/** A copy of the save from just after her last question (the Retry button,
 *  src/space/retry.js, goes back there). Falls back to ACT_KEY. */
const CKPT_KEY = `${SAVE_KEY}_ckpt`;
let restarting = false;

function writeSave(data) {
  if (restarting) return; // on the way back to the act's start: don't overwrite it
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

/** The bank says "Zara"; the child hears her own name. */
function personalise(q) {
  const name = heroName();
  if (!name || name === 'Zara') return q;
  const swap = (s) => (typeof s === 'string' ? s.replace(/\bZara(’s|'s)?\b/g, (m, poss) => (poss ? `${name}'s` : name)) : s);
  const out = { ...q };
  for (const k of ['prompt', 'hint', 'parentHint', 'success', 'doneMessage', 'title']) out[k] = swap(q[k]);
  if (Array.isArray(q.choices)) out.choices = q.choices.map((c) => ({ ...c, text: swap(c.text) }));
  return out;
}

import { act1Steps } from './acts/act1.js';
import { act2Steps } from './acts/act2.js';
import { act3Steps } from './acts/act3.js';
import { act4Steps } from './acts/act4.js';
import { act5Steps } from './acts/act5.js';

// --- the steps ----------------------------------------------------------------

function buildSteps(game) {
  const steps = IS_CH6 ? ch6Steps(game) : IS_CH5 ? ch5Steps(game) : [
    ...act1Steps(game),
    ...act2Steps(game),
    ...act3Steps(game),
    ...act4Steps(game),
    ...act5Steps(game),
  ];
  // While later acts are still being built, the chain ends in free flight
  // instead of running off the end.
  steps.push({
    id: 'wip_end', act: Math.min(5, (steps[steps.length - 1]?.act || 1) + 1),
    title: 'Keep exploring',
    objective: 'This part of the voyage is still being built. Fly anywhere you like!',
    markers: OUTER ? ['saturn', 'uranus', 'neptune'] : ['moon', 'mars', 'jupiter'],
    check() { return false; },
  });
  return steps;
}

// --- engine ------------------------------------------------------------------------

/**
 * Which step a save resumes at. Saves carry the step's id; older saves only
 * had its index, written before the flight-school lesson (a1_lesson) was
 * inserted after the wing fix, so an index at or past that slot means the
 * step one further on now. (The two-tries `<save>_act` copy is a save of the
 * same shape, so it goes through here too when it is put back.)
 */
function resolveStepIndex(save, steps) {
  const last = steps.length - 1;
  if (save.stepId) {
    const i = steps.findIndex((s) => s.id === save.stepId);
    if (i >= 0) return i;
  }
  let i = save.stepIndex ?? 0;
  const lesson = steps.findIndex((s) => s.id === 'a1_lesson');
  if (!save.stepId && lesson >= 0 && i >= lesson) i += 1;
  return Math.max(0, Math.min(i, last));
}

export function createMissions(game) {
  const steps = buildSteps(game);
  const save = loadSave() || {};
  // Chapter 5 lines the planets up as she goes (ch5/lineup.js): put the
  // saved line-up back before anything reads where they are.
  if (IS_CH5) restorePhases(save.phases);
  let index = resolveStepIndex(save, steps);
  save.stepIndex = index;
  let entered = false;   // enter() has settled for the current step
  let busy = false;      // completing (question / after) - don't re-check
  let stepTime = 0;
  // Several waits can run at once (a Ceres visit's pause while the step's own
  // pause runs), so each is a list entry, not one slot a second call would
  // overwrite (the first promise would then never settle).
  let calms = []; // [{ left, resolve }] calm pauses, counted down in game seconds
  let quiet = 0; // seconds since she last steered by hand (main.js sets game.kidSteering)
  let quietWaits = []; // [resolve] questions waiting for hands-off flying
  const deferred = new Set(save.deferred || []);
  const answered = new Set(save.answered || []);

  function persist() {
    // Merge, never replace: other writers (acts/util.js markSaveComplete) keep
    // flags like `complete` in the same blob, and the launcher reads them.
    const sh = game.ship;
    writeSave({
      ...(loadSave() || {}),
      stepIndex: index,
      // The step's id is what a reload goes by: inserting a step (2026-10-02,
      // the flight-school lesson) shifts every index after it.
      stepId: steps[index]?.id,
      deferred: [...deferred],
      answered: [...answered],
      resources: game.resources,
      samples: game.samples,
      // Enough to put her back exactly where she was after a reload: the ship
      // (including the sim clock, so the planets are where they were too),
      // what she has built, and the route drawn by the ending.
      ship: {
        x: sh.x, z: sh.z, vx: sh.vx, vz: sh.vz, angle: sh.angle, angVel: 0,
        fuel: sh.fuel, cargo: sh.cargo, soi: sh.soi, landedOn: sh.landedOn, t: sh.t,
        _landAngle: sh._landAngle, _landDist: sh._landDist,
      },
      upgrades: [...(game.upgradesOwned || [])],
      stats: game.stats || null,
      route: (game.route || []).slice(-600),
      // The rescued satellite (satellite.js rig): riding on her ship, or
      // released into its Moon orbit. Only written once it has a state, so
      // the field from an older save survives until then.
      ...(game.satellite ? { satellite: game.satellite } : {}),
      ...(IS_CH5 ? { phases: phasesNow() } : {}),
    });
  }

  /** The mission card; `doneNow` ticks the current step off already (it is
   *  finished, a calm moment before its question). */
  function showStep(doneNow = false, objective = null) {
    const step = steps[index];
    const actSteps = steps.filter((s) => s.act === step.act);
    hud.setMission({
      act: ACT_TITLES[step.act] || '',
      title: step.title,
      objective: objective || (doneNow ? `Done: ${step.title}!` : step.objective),
      steps: actSteps.map((s) => ({ text: s.title, done: steps.indexOf(s) < index || (doneNow && s === step) || !!s.doneEarly?.() })),
    });
  }
  const { hud } = game;

  /** Wait `sec` of unpaused game time (missions.update counts it down). */
  function calmFor(sec) {
    if (!(sec > 0)) return Promise.resolve();
    return new Promise((resolve) => { calms.push({ left: sec, resolve }); });
  }

  /** Hands-off flying before a question (QUIET_S): none needed on foot or in a mini-scene. */
  function untilQuiet() {
    if (game.activeScene || quiet >= QUIET_S) return Promise.resolve();
    return new Promise((resolve) => { quietWaits.push(resolve); });
  }

  /** Does this step send her out of the system she is in? An escape does, and so does a
   *  transfer to another body (Earth's orbit to the Moon, Jupiter's to Europa counts too).
   *  The belt is a custom target (act3's customTargets, parent the Sun): it counts; a
   *  rendezvous with a custom target in her own system (Act 1's satellite) does not. */
  function departs(step) {
    if (!step) return false;
    if (step.escape) return true;
    if (!step.transfer) return false;
    if (BODIES[step.transfer]) return step.transfer !== game.ship.soi;
    const custom = game.customTargets?.[step.transfer];
    return !!custom && custom.parent !== game.ship.soi;
  }

  /** A closed loop that clears the surface: a stable orbit to leave from. */
  function inClosedOrbit() {
    const oe = orbitElements(game.ship);
    const body = BODIES[game.ship.soi];
    return !!body && oe.bound && oe.periapsis > body.radius * 1.08;
  }

  /**
   * In orbit, and the next step leaves it: she looks round as
   * long as she likes and leaves when she presses "Ready" (lead 2026-10-08,
   * instead of a guessed wait). The autopilot presses it after a short look.
   */
  function readyToLeave() {
    const name = BODIES[game.ship.soi]?.name || 'here';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-ready';
    btn.textContent = t('Ready for the next adventure? ▶', 'Ready for the next adventure? ▶');
    btn.title = t(`Leave ${name} for the next stop (Enter)`, 'Go on (Enter)');
    Object.assign(btn.style, {
      position: 'fixed', left: '50%', bottom: '92px', transform: 'translateX(-50%)', zIndex: 40, cursor: 'pointer',
      padding: '12px 22px', borderRadius: '999px', border: '2px solid #ffd27a', background: 'rgba(20, 28, 48, .92)',
      color: '#ffe3a8', font: '800 17px system-ui, sans-serif', boxShadow: '0 6px 24px rgba(0,0,0,.45)',
    });
    hud.setMission({
      act: ACT_TITLES[steps[index].act] || '', title: t(`In orbit round ${name}`, `Going around ${name}`),
      objective: t(`Look round ${name} as long as you like. Press "Ready for the next adventure" when you want to go on.`, `Look at ${name}! Press "Ready" when you want to go on.`),
      steps: [],
    });
    document.body.appendChild(btn);
    return new Promise((resolve) => {
      let auto = 0;
      const go = () => { clearInterval(auto); removeEventListener('keydown', onKey); btn.remove(); resolve(); };
      const onKey = (e) => { if (e.code === 'Enter' && !document.querySelector('.sp-modal.is-open')) go(); };
      btn.addEventListener('click', () => { btn.blur(); go(); });
      addEventListener('keydown', onKey);
      // The autopilot flies on by itself after a short look (never under a card).
      let apFor = 0;
      auto = setInterval(() => {
        // Burned away without pressing it: she is on her way, so the step goes on.
        if (!inClosedOrbit()) { go(); return; }
        // Her map card, a fact, a question: the button stays out of the way.
        const card = hud.isModalOpen();
        btn.style.display = card ? 'none' : '';
        apFor = game.autopilot?.on && !card ? apFor + 0.5 : 0;
        if (apFor >= 8) go();
      }, 500);
    });
  }

  /** Ask a beat's question once she has let go of the controls. hud.askQuestion
   *  takes the card's turn (modalQueue.js), so questions never replace each other. */
  async function ask(beat) {
    const q = questionForBeat(beat);
    if (!q) return;
    await untilQuiet();
    const res = await hud.askQuestion(personalise(q));
    if (res.correct) {
      answered.add(q.id);
      deferred.delete(q.id);
      if (q.reward?.resources) {
        for (const [k, v] of Object.entries(q.reward.resources)) game.resources[k] = (game.resources[k] || 0) + v;
      }
      if (q.doneMessage) hud.toast(personalise(q).doneMessage, { kind: 'good', ms: 4500 });
    } else {
      deferred.add(q.id);
      hud.toast('No problem. Mission Control will ask you again later.', { kind: 'info', ms: 3000 });
    }
  }

  async function askDeferred() {
    for (const id of [...deferred]) {
      const q = getSpaceQuestion(id);
      if (q) await ask(q.beat);
    }
  }

  /** The next goal across the top for a few seconds (a task step only:
   *  dialogue, lessons and cards explain themselves). */
  function announceGoal(step) {
    if (!step.check || !hud.announce) return;
    const name = (id) => (id === 'belt' ? 'the asteroid belt' : BODIES[id]?.name || null);
    const title = step.land && name(step.land) ? `Next goal: land on ${name(step.land)}`
      : step.capture && name(step.capture) ? `Next goal: get into orbit round ${name(step.capture)}`
        : step.transfer && name(step.transfer) ? `Next goal: fly to ${name(step.transfer)}`
          : `Next: ${step.title}`;
    const firstOfAct = steps.findIndex((s) => s.act === step.act) === index;
    hud.announce(firstOfAct && ACT_TITLES[step.act] ? `${ACT_TITLES[step.act]} · ${title}` : title, step.objective || '');
  }

  async function enterStep() {
    entered = false;
    stepTime = 0;
    const step = steps[index];
    // Leaving a stable orbit (round a planet or moon; not from the ground, nor
    // straight on from a departure that is still under way): her call.
    if (departs(step) && !departs(steps[index - 1]) && game.ship.soi !== 'sun' && !game.ship.landedOn && inClosedOrbit()) {
      game.escapeStep = false; game.aimHint = null; game.transferTarget = null; game.captureTarget = null;
      await inModalTurn(readyToLeave); // in the card queue: no card opens under the button
    }
    showStep();
    // First step of an act: remember the save as it is now, the place the
    // two-tries rule restarts from. (complete() has just saved the new index.)
    if (steps.findIndex((s) => s.act === step.act) === index) {
      try {
        localStorage.setItem(ACT_KEY, localStorage.getItem(SAVE_KEY) || '');
        localStorage.setItem(CKPT_KEY, localStorage.getItem(SAVE_KEY) || '');
      } catch { /* private mode */ }
    }
    // A sensible target for the predictor and markers even before (or without)
    // the step's own enter(): after a reload the old target is gone.
    // Real bodies only: a custom transfer target (Act 1's satellite) isn't
    // something the predictor can compute a closest approach to.
    game.target = [step.transfer, step.capture, step.land, step.markers?.[0]].find((id) => id && BODIES[id]) || game.target;
    game.aimHint = step.aim || null;
    game.transferTarget = step.transfer || null;
    game.captureTarget = step.capture || null;
    game.landTarget = step.land || null;
    game.escapeStep = !!step.escape;
    announceGoal(step);
    try { await step.enter?.(game); } catch (e) { console.error('mission enter', step.id, e); }
    entered = true;
  }

  async function complete() {
    busy = true;
    const step = steps[index];
    try {
      // A task done in the world (a step with a check: an orbit, a landing, a
      // puzzle): tick it off, then a calm moment before any question.
      const hasQuestion = !!(step.beat || step.bonusBeats?.length);
      if (step.check && hasQuestion) {
        showStep(true);
        await calmFor(step.calm ?? CALM_S);
      }
      if (step.beat) await ask(step.beat);
      // Extra maths/pattern questions tied to the same moment (lead request:
      // more maths), asked the same way so answers and "later" are saved.
      for (const b of step.bonusBeats || []) await ask(b);
      await step.after?.(game);
      if (deferred.size) await askDeferred();
    } catch (e) {
      console.error('mission complete', step.id, e);
    }
    index = Math.min(index + 1, steps.length - 1);
    persist();
    // Just answered a question: a stable place to come back to (Retry).
    if (step.beat || step.bonusBeats?.length) {
      try { localStorage.setItem(CKPT_KEY, localStorage.getItem(SAVE_KEY) || ''); } catch { /* private mode */ }
    }
    busy = false;
    await enterStep();
  }

  return {
    start() { enterStep(); },
    /** The save this session started from (main.js restores the ship from it). */
    saved: save,
    /** Redraw the mission card (a step ticked off early, act3's Ceres visit). */
    refresh() { showStep(); },
    /** Show a calm line on the card for the current step (a wait with nothing to do:
     *  an orbit lap). `done` ticks the step off too (its goal is met). */
    showObjective(text, { done = false } = {}) { showStep(done, text); },
    /** Hands-off flying first (QUIET_S): for questions asked outside the step engine
     *  (acts/util.js askBeat, the belt's beats). Resolves at once on foot. */
    untilQuiet,
    /** Save now (main.js calls this every few seconds while flying). */
    save() { persist(); },
    /** Ask a beat's question the way a step's own beat is asked: counted as
     *  answered, or deferred and asked again later (Chapter 6's stations). */
    ask(beat, { calm: sec = 0 } = {}) { return calmFor(sec).then(() => ask(beat)).then(() => persist()); },
    /**
     * Two wrong tries on a question (lead rule): back to the start of this
     * act - the save from then is put back and the page reloads into it.
     */
    restartAct() {
      restarting = true;
      try {
        const cp = localStorage.getItem(ACT_KEY);
        if (cp) localStorage.setItem(SAVE_KEY, cp);
        else localStorage.removeItem(SAVE_KEY);
      } catch { /* private mode */ }
      location.reload();
    },
    /**
     * Retry (lead: "if the trajectory went very wrong, escape and try again"):
     * back to the save from just after her last question, else the act's start.
     */
    retryFromCheckpoint() {
      restarting = true;
      try {
        const cp = localStorage.getItem(CKPT_KEY) || localStorage.getItem(ACT_KEY);
        if (cp) localStorage.setItem(SAVE_KEY, cp);
        else localStorage.removeItem(SAVE_KEY);
      } catch { /* private mode */ }
      location.reload();
    },
    /** True once she has got past the very first step (so the opening has been seen). */
    hasProgress() { return index > 0; },
    /** Count down a calm pause (also called while a walk scene runs). */
    tickCalm(dt, paused) {
      if (!paused) quiet = game.kidSteering ? 0 : quiet + dt;
      if (quietWaits.length && (game.activeScene || quiet >= QUIET_S)) {
        const rs = quietWaits; quietWaits = [];
        for (const r of rs) r();
      }
      if (!calms.length || paused) return;
      // In place (no new list each frame): finish the ones that are due.
      for (let i = calms.length - 1; i >= 0; i--) {
        const c = calms[i];
        c.left -= dt;
        if (c.left <= 0) { calms.splice(i, 1); c.resolve(); }
      }
    },
    update(dt, states, paused) {
      this.tickCalm(dt, paused);
      if (paused || busy || !entered) return;
      stepTime += dt;
      const step = steps[index];
      const done = step.check ? step.check(game, states, stepTime) : true;
      if (done) complete();
    },
    markerIds() {
      // The satellite's docking camera frames its own shot: no planet labels
      // floating in it.
      if (game.cinematic?.hideMarkers) return [];
      const step = steps[index];
      return step?.markers || [game.target];
    },
    get step() { return steps[index]; },
    /** Debug: jump to a step by id (window.__space.missions.jump('a1_raise')). */
    jump(id) {
      const i = steps.findIndex((s) => s.id === id);
      if (i >= 0) { index = i; enterStep(); }
    },
    /** The steps, for the grown-up Jump panel: [{ id, label, group }]. */
    parts() {
      return steps.filter((s) => s.id !== 'wip_end').map((s) => ({ id: s.id, label: s.title || s.id, group: ACT_TITLES[s.act] || '' }));
    },
    /**
     * Grown-up Jump (unlock mode): start the chapter again at step `id`. The
     * ship goes in a low orbit round the step's own goal body (its capture /
     * land / transfer target), else where the steps before it ended (landed
     * or in orbit), with a full tank and plenty to build with; then the page
     * reloads into that step.
     */
    jumpTo(id) {
      const i = steps.findIndex((s) => s.id === id);
      if (i < 0) return false;
      const sh = game.ship;
      // The step's own goal body first (a jump to "fly to Mars" starts in a
      // low orbit round Mars), else where the steps before it ended.
      const real = (id) => (id && id !== 'sun' && BODIES[id] ? id : null);
      const own = steps[i];
      let at = null;
      const ownBody = real(own.capture) || real(own.land) || real(own.transfer) || (own.transfer ? real(own.markers?.[0]) : null);
      if (ownBody) at = { body: ownBody, landed: false };
      for (let k = i - 1; k >= 0 && !at; k--) {
        const s = steps[k];
        if (real(s.land)) at = { body: s.land, landed: true };
        else if (real(s.capture) || real(s.transfer)) at = { body: real(s.capture) || real(s.transfer), landed: false };
        else if (real(s.markers?.[0])) at = { body: s.markers[0], landed: false };
      }
      const ship = { ...sh, angVel: 0, fuel: SHIP.fuelMass };
      if (at) {
        const b = BODIES[at.body];
        if (at.landed) {
          Object.assign(ship, { landedOn: at.body, soi: at.body, _landAngle: 0, _landDist: b.radius, vx: 0, vz: 0 });
        } else {
          const st = bodyState(at.body, sh.t);
          const r = Math.min(b.radius * 2.2, (b.soi || Infinity) * 0.5); // low and stable
          const v = Math.sqrt(b.gm / r);
          Object.assign(ship, { x: st.x + r, z: st.z, vx: st.vx, vz: st.vz + v, angle: 0, soi: at.body, landedOn: null });
        }
      }
      const resources = { ...game.resources };
      for (const u of Object.values(UPGRADES)) for (const k of Object.keys(u.cost || {})) resources[k] = Math.max(resources[k] || 0, 50);
      const data = {
        ...(loadSave() || {}), stepIndex: i, stepId: id, deferred: [], resources,
        ship: { x: ship.x, z: ship.z, vx: ship.vx, vz: ship.vz, angle: ship.angle, angVel: 0, fuel: ship.fuel, cargo: ship.cargo, soi: ship.soi, landedOn: ship.landedOn, t: ship.t, _landAngle: ship._landAngle, _landDist: ship._landDist },
        ...(IS_CH5 ? { phases: phasesNow() } : {}),
      };
      restarting = true; // nothing else may overwrite the save on the way out
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        localStorage.setItem(ACT_KEY, JSON.stringify(data));
        localStorage.setItem(CKPT_KEY, JSON.stringify(data));
      } catch { /* private mode */ }
      location.reload();
      return true;
    },
  };
}

