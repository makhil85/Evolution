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
import { BODIES, STORE_KEYS } from './contracts.js';
import { questionForBeat, getSpaceQuestion } from './questions.space.js';
import { heroName } from './hud/hud.js';

const ACT_TITLES = {
  1: 'Act 1: Earth orbit',
  2: 'Act 2: The Moon',
  3: 'Act 3: Mars and the asteroid belt',
  4: 'Act 4: Jupiter',
  5: 'Finale: Europa',
};

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
  const steps = [
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
    markers: ['moon', 'mars', 'jupiter'],
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
  let index = resolveStepIndex(save, steps);
  save.stepIndex = index;
  let entered = false;   // enter() has settled for the current step
  let busy = false;      // completing (question / after) - don't re-check
  let stepTime = 0;
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
    });
  }

  function showStep() {
    const step = steps[index];
    const actSteps = steps.filter((s) => s.act === step.act);
    hud.setMission({
      act: ACT_TITLES[step.act] || '',
      title: step.title,
      objective: step.objective,
      steps: actSteps.map((s) => ({ text: s.title, done: steps.indexOf(s) < index })),
    });
  }
  const { hud } = game;

  async function ask(beat) {
    const q = questionForBeat(beat);
    if (!q) return;
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

  async function enterStep() {
    entered = false;
    stepTime = 0;
    const step = steps[index];
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
    try { await step.enter?.(game); } catch (e) { console.error('mission enter', step.id, e); }
    entered = true;
  }

  async function complete() {
    busy = true;
    const step = steps[index];
    try {
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
    /** Save now (main.js calls this every few seconds while flying). */
    save() { persist(); },
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
    update(dt, states, paused) {
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
  };
}

