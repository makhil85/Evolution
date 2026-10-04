// Real-screen frame check (PLAN.md item 9): a small live graph of how long
// each frame took, with the worst frames and what the game was doing then.
//
// It measures REAL frames (requestAnimationFrame to requestAnimationFrame),
// so it only means something while the page is actually on screen - a hidden
// tab draws nothing. Off by default. Turn it on with ?fps in the address, or
// press F9. Results are also kept in window.__frames for scripted checks:
//   window.__frames.summary()  -> { frames, avgMs, p95Ms, worst: [{ms, at}], over50 }
//   window.__frames.reset()

/**
 * @param {{ where?: () => string }} [opts]  a short note on what the game is
 *   doing (e.g. Chapter 4's step and time-warp), stored with slow frames.
 */
export function createFrameMonitor({ where = () => '' } = {}) {
  const N = 240;
  const times = new Float32Array(N);
  let head = 0;
  let count = 0;
  let last = 0;
  let worst = [];            // [{ ms, at }] slowest frames since reset, max 8
  let over50 = 0;
  let total = 0;
  let frames = 0;
  let shown = /[?&]fps\b/.test(location.search);

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(10,14,24,.86);color:#e8ecf5;'
    + 'font:12px/1.35 ui-monospace,Consolas,monospace;padding:8px 10px;border-radius:10px;pointer-events:none;min-width:250px';
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 48;
  canvas.style.cssText = 'display:block;width:240px;height:48px;margin-top:4px';
  const text = document.createElement('div');
  box.append(text, canvas);
  const ctx = canvas.getContext('2d');
  if (shown) document.body.appendChild(box);

  addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    shown = !shown;
    if (shown) document.body.appendChild(box); else box.remove();
  });

  function draw() {
    const s = api.summary();
    text.innerHTML = `frame ${s.lastMs.toFixed(1)} ms · avg ${s.avgMs.toFixed(1)} · 95% ${s.p95Ms.toFixed(1)}<br>`
      + `over 50 ms: ${s.over50} of ${s.frames}<br>`
      + s.worst.slice(0, 3).map((w) => `worst ${w.ms.toFixed(0)} ms @ ${w.at}`).join('<br>');
    ctx.clearRect(0, 0, 240, 48);
    // 16.7 ms (60 fps) and 33 ms (30 fps) guide lines; one bar per frame.
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, 48 - 16.7, 240, 1);
    ctx.fillRect(0, 48 - 33.3, 240, 1);
    for (let i = 0; i < Math.min(count, N); i++) {
      const v = times[(head - 1 - i + N) % N];
      ctx.fillStyle = v > 50 ? '#ff6b6b' : v > 20 ? '#ffd36b' : '#7be07b';
      ctx.fillRect(239 - i, 48 - Math.min(48, v), 1, Math.min(48, v));
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (last) {
      const ms = now - last;
      // A gap over 1 s is the tab being hidden or the machine asleep, not a
      // frame the child saw.
      if (ms < 1000) {
        times[head] = ms;
        head = (head + 1) % N;
        count++;
        frames++;
        total += ms;
        if (ms > 50) over50++;
        if (worst.length < 8 || ms > worst[worst.length - 1].ms) {
          worst.push({ ms, at: where() });
          worst.sort((a, b) => b.ms - a.ms);
          worst.length = Math.min(worst.length, 8);
        }
      }
    }
    last = now;
    if (shown && frames % 10 === 0) draw();
  }
  requestAnimationFrame(tick);

  const api = {
    summary() {
      const n = Math.min(count, N);
      const recent = Array.from({ length: n }, (_, i) => times[(head - 1 - i + N) % N]).sort((a, b) => a - b);
      return {
        frames,
        lastMs: n ? times[(head - 1 + N) % N] : 0,
        avgMs: frames ? total / frames : 0,
        p95Ms: n ? recent[Math.floor(n * 0.95)] || 0 : 0,
        over50,
        worst: worst.map((w) => ({ ms: Math.round(w.ms), at: w.at })),
      };
    },
    reset() { worst = []; over50 = 0; total = 0; frames = 0; count = 0; head = 0; },
    show(on = true) { shown = on; if (on) document.body.appendChild(box); else box.remove(); },
  };
  window.__frames = api;
  return api;
}
