// Dev-only: an xferwatch run that survives dev-server reloads (another
// session's edits reload the page). main.js imports this on boot while
// localStorage.lab_autorun = 'labrun'; it restarts the watch from the save
// (xferwatch saves every 2 s) and appends what it saw to localStorage.labx_log.
//   localStorage.lab_cfg = JSON.stringify({ until: 'a3_mars_scan', tag: 'medA' });
//   localStorage.lab_autorun = 'labrun'; location.reload();
//   JSON.parse(localStorage.labx_log).medA   -> segments
import * as W from './xferwatch.js';

export async function autorun() {
  const cfg = JSON.parse(localStorage.getItem('lab_cfg') || '{}');
  const G = window.__space;
  const tag = cfg.tag || 'run';
  const seg = { start: Date.now(), t0: G.ship.t, step0: G.missions.step.id };
  const write = () => {
    try {
      const L = JSON.parse(localStorage.getItem('labx_log') || '{}');
      const segs = L[tag] || (L[tag] = []);
      const r = W.report({ samples: true });
      const o = { ...seg, real: r?.real, step: G.missions.step.id, t: Math.round(G.ship.t), steps: r?.steps, by: {}, plan: G.planLog.slice(-25), prof: {} };
      for (const [k, b] of Object.entries(r?.by || {})) {
        o.by[k] = `plans ${b.plans} planJ ${b.planJumps}/${b.planJumpMax} dvJ ${b.dvJumps}/${b.dvJumpMax} cdJ ${b.cdJumps}/${b.cdJumpMax} cue ${b.cueChanges} min ${b.realMin} | ${(b.samples || []).slice(-12).join(' ; ')}`;
      }
      for (const [k, e] of Object.entries(G.prof || {})) o.prof[k] = `max ${e.max.toFixed(1)} avg ${(e.total / e.n).toFixed(2)} n ${e.n} @${e.at}`;
      if (segs.length && segs[segs.length - 1].start === seg.start) segs[segs.length - 1] = o; else segs.push(o);
      if (segs.length > 30) segs.shift();
      localStorage.setItem('labx_log', JSON.stringify(L));
    } catch (e) { console.warn('[labrun]', e); }
  };
  // A line per change of banner / warp / firing / burn state.
  const trace = []; let lastK = '';
  setInterval(() => {
    const d = G.debugTransfer(); const want = G.aimAngle();
    const err = want == null ? null : Math.atan2(Math.sin(want - G.ship.angle), Math.cos(want - G.ship.angle));
    const raw = document.getElementById('burnCue')?.dataset.raw || '';
    const modal = document.querySelector('.sp-modal')?.textContent?.slice(0, 24) || '';
    const k = raw.replace(/\d+(\.\d+)?/g, '#').slice(0, 30) + (G.firing ? 'F' : '') + G.warpIndex + (d.burnPlan ? 'B' : '') + modal + (G.paused ? 'P' : '') + (G.cinematic ? 'C' : '');
    if (k === lastK) return;
    lastK = k;
    trace.push(`${G.ship.t.toFixed(1)} w${G.warpIndex}${G.firing ? ' FIRE' : ''} err ${err?.toFixed(2)} bp ${d.burnPlan ? `${d.burnPlan.delivered.toFixed(2)}/${d.burnPlan.dvTarget.toFixed(2)}` : '-'} ${modal ? `[${modal}] ` : ''}${G.paused ? 'PAUSED ' : ''}${G.cinematic ? 'CINE ' : ''}m${(G.resources.metal || 0).toFixed(1)} ${raw.slice(0, 60)}`);
    if (trace.length > 120) trace.shift();
  }, 30);
  seg.trace = trace;
  G.prof = {};
  await W.start({ until: (g) => cfg.until && g.missions.step.id === cfg.until });
  const iv = setInterval(() => {
    write();
    if (cfg.until && G.missions.step.id === cfg.until) {
      clearInterval(iv); W.stop(); localStorage.removeItem('lab_autorun');
    }
  }, 2000);
}
