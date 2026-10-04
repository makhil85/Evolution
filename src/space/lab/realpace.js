// Autopilot run at a REAL screen's pace, for the hidden Browser pane.
//
// The pane draws no frames while hidden, so tests drive the game themselves.
// Driving it from a timer as fast as possible (the old lab way) runs far more
// sim time per second than a real 60 fps screen, which hid every real-time
// wait (2026-10-01: the autopilot looked fine in the lab and stalled on a
// real screen). Here each autopilot step is ONE 1/60 s frame and "real
// seconds" are frames / 60, so the log reads like a stopwatch on a screen.
//
//   const R = await import('/src/space/lab/realpace.js');
//   R.start();                 // flies from wherever the save is
//   R.report()                 // { step, real, steps: [...], tail: [...], done }
//   R.stop()
import { clear } from './playtest.js';

const g = () => window.__space;
let run = null;

const cue = () => {
  const el = document.getElementById('burnCue');
  if (!el) return '';
  return el.dataset.raw ?? (getComputedStyle(el).display !== 'none' ? el.textContent : ''); // raw even while hidden
};

export async function start() {
  stop();
  const r = { frames: 0, log: [], steps: [], stop: false, done: false, lastKey: '', lastStep: '' };
  run = r;
  const G = g();
  G.autopilot.useFrame(() => { G.debugRun(1 / 60, 1 / 60); r.frames++; return new Promise((res) => setTimeout(res, 0)); });
  // A first-time chooser or story card may be up: clear it, then take off.
  try { await clear(4); } catch { /* nothing open */ }
  G.autopilot.set(true);
  (async () => {
    while (!r.stop) {
      await new Promise((res) => setTimeout(res, 100));
      try { if (document.querySelector('.sp-modal button')) await clear(4); } catch { /* card closed meanwhile */ }
      const real = Math.round(r.frames / 60);
      const st = G.missions.step.id;
      if (st !== r.lastStep) { r.steps.push(`${real}s ${st}`); r.lastStep = st; }
      const k = `${cue().replace(/\d+(\.\d+)?/g, '#').slice(0, 44)} w${G.warpIndex}`;
      if (k !== r.lastKey) { r.lastKey = k; r.log.push(`${real}s sim${Math.round(G.ship.t)} ${k}`); }
      if (r.log.length > 400) r.log.splice(0, 200);
      if (st === 'a5_end') { r.done = true; break; }
      if (!G.autopilot.on && !document.querySelector('.sp-modal button')) { r.log.push(`${real}s autopilot OFF`); break; }
    }
  })();
  return 'started';
}

export function report(n = 6) {
  if (!run) return null;
  const G = g();
  return {
    level: G.level ?? undefined, mode: G.mode?.id, step: G.missions.step.id,
    real: Math.round(run.frames / 60), done: run.done,
    steps: run.steps.slice(-n), tail: run.log.slice(-n),
  };
}

export function stop() {
  if (run) run.stop = true;
  run = null;
  g()?.autopilot?.set(false);
}
