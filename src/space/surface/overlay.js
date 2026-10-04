// Surface scenes - the scene's own on-screen layer: the "press E" prompt that
// floats over the thing she can use, the drill's progress ring, and the
// habitability checklist of the finale.
//
// Drawn on ONE 2-D canvas laid over the renderer (pointer-events: none), not
// in DOM, so lab screenshots can composite it with the WebGL frame and a
// reviewer sees exactly what the child sees. The HUD's own cards, toasts and
// question modals stay in the HUD and sit above this layer.

const FONT = "'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif";
const easeOutBack = (t) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function createOverlay({ mount = document.body } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'surface-overlay';
  Object.assign(canvas.style, {
    position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '5',
  });
  mount.appendChild(canvas);
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  const prompt = { shown: 0, want: false, x: 0, y: 0, key: 'E', text: '', progress: -1, hold: false };
  const list = { t: -1, items: [], title: '', done: false };
  const banner = { t: -1, text: '', sub: '' };

  function resize(w, h, ratio = 1) {
    if (w === W && h === H && ratio === dpr) return;
    W = w; H = h; dpr = ratio;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
  }

  function drawPrompt(s) {
    const a = prompt.shown;
    if (a < 0.01) return;
    g.save();
    g.globalAlpha = a;
    const fs = 21 * s;
    g.font = `700 ${fs}px ${FONT}`;
    const tw = g.measureText(prompt.text).width;
    const key = 40 * s;
    const pad = 14 * s;
    const w = key + pad * 3 + tw;
    const h = key + pad * 1.1;
    const x = Math.round(prompt.x - w / 2);
    const y = Math.round(prompt.y - h - 10 * s * (1 - a));
    // Glass pill.
    g.fillStyle = 'rgba(24, 19, 15, 0.82)';
    roundRect(g, x, y, w, h, h / 2);
    g.fill();
    g.strokeStyle = 'rgba(255, 238, 214, 0.28)';
    g.lineWidth = 1.5 * s;
    g.stroke();
    // Key cap.
    const kx = x + pad * 0.6, ky = y + (h - key) / 2;
    g.fillStyle = '#f7efe2';
    roundRect(g, kx, ky, key, key, 9 * s);
    g.fill();
    g.fillStyle = '#b9ab95';
    roundRect(g, kx, ky + key - 5 * s, key, 5 * s, 3 * s);
    g.fill();
    g.fillStyle = '#1b1510';
    g.font = `800 ${22 * s}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(prompt.key, kx + key / 2, ky + key / 2 - 1 * s);
    // Progress ring round the key.
    if (prompt.progress >= 0) {
      const cx = kx + key / 2, cy = ky + key / 2, r = key * 0.78;
      g.lineWidth = 5 * s;
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      const p = clamp01(prompt.progress);
      g.strokeStyle = p >= 1 ? '#8fd66b' : '#ff7847';
      g.shadowColor = p >= 1 ? '#8fd66b' : '#ffb347';
      g.shadowBlur = 10 * s;
      g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
    }
    g.textAlign = 'left';
    g.fillStyle = '#f7efe2';
    g.font = `700 ${fs}px ${FONT}`;
    g.fillText(prompt.text, kx + key + pad, y + h / 2 + 1 * s);
    // Little pointer toward the object.
    g.fillStyle = 'rgba(24, 19, 15, 0.82)';
    g.beginPath();
    g.moveTo(prompt.x - 9 * s, y + h - 0.5);
    g.lineTo(prompt.x + 9 * s, y + h - 0.5);
    g.lineTo(prompt.x, y + h + 10 * s);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawChecklist(s, now) {
    if (list.t < 0) return;
    const t = now - list.t;
    const a = clamp01(t / 0.5);
    const pw = 560 * s;
    const rowH = 64 * s;
    const n = list.items.length;
    const ph = 96 * s + n * rowH + 24 * s;
    const px = W - pw - 56 * s;
    const py = H - ph - 64 * s;
    g.save();
    g.globalAlpha = a;
    g.translate(0, (1 - easeOutBack(a)) * 30 * s);
    g.fillStyle = 'rgba(22, 18, 14, 0.84)';
    roundRect(g, px, py, pw, ph, 22 * s);
    g.fill();
    g.strokeStyle = 'rgba(255, 238, 214, 0.25)';
    g.lineWidth = 1.5 * s;
    g.stroke();
    g.fillStyle = '#ffcf5c';
    g.font = `800 ${15 * s}px ${FONT}`;
    g.textBaseline = 'alphabetic';
    g.fillText('HABITABILITY CHECK', px + 30 * s, py + 40 * s);
    g.fillStyle = '#f7efe2';
    g.font = `700 ${25 * s}px ${FONT}`;
    g.fillText('Could life live on Europa?', px + 30 * s, py + 74 * s);
    list.items.forEach((it, i) => {
      const t0 = 0.7 + i * 1.25;
      const ra = clamp01((t - t0) / 0.4);
      const ck = clamp01((t - t0 - 0.55) / 0.35);
      if (ra <= 0) return;
      const ry = py + 100 * s + i * rowH;
      g.save();
      g.globalAlpha = a * ra;
      g.translate((1 - ra) * 24 * s, 0);
      const bx = px + 30 * s, by = ry + 10 * s, bs = 40 * s;
      g.fillStyle = ck > 0 ? `rgba(143, 214, 107, ${0.18 + 0.2 * ck})` : 'rgba(255,255,255,0.06)';
      roundRect(g, bx, by, bs, bs, 10 * s);
      g.fill();
      g.strokeStyle = ck > 0 ? '#8fd66b' : 'rgba(255,238,214,0.35)';
      g.lineWidth = 2.5 * s;
      g.stroke();
      if (ck > 0) {
        // The tick draws itself, with a little pop.
        const pop = 1 + 0.25 * Math.sin(Math.PI * clamp01(ck * 1.2));
        g.save();
        g.translate(bx + bs / 2, by + bs / 2);
        g.scale(pop, pop);
        g.strokeStyle = '#b8f28f';
        g.shadowColor = '#8fd66b';
        g.shadowBlur = 12 * s;
        g.lineWidth = 5.5 * s;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const p1 = [-10 * s, 1 * s], p2 = [-3 * s, 9 * s], p3 = [12 * s, -9 * s];
        const k1 = clamp01(ck / 0.4), k2 = clamp01((ck - 0.4) / 0.6);
        g.beginPath();
        g.moveTo(p1[0], p1[1]);
        g.lineTo(p1[0] + (p2[0] - p1[0]) * k1, p1[1] + (p2[1] - p1[1]) * k1);
        if (k2 > 0) g.lineTo(p2[0] + (p3[0] - p2[0]) * k2, p2[1] + (p3[1] - p2[1]) * k2);
        g.stroke();
        g.restore();
      }
      g.fillStyle = '#f7efe2';
      g.font = `700 ${23 * s}px ${FONT}`;
      g.fillText(it.text, bx + bs + 18 * s, by + 23 * s);
      g.fillStyle = '#cdbfa9';
      g.font = `500 ${15.5 * s}px ${FONT}`;
      g.fillText(it.sub, bx + bs + 18 * s, by + 44 * s);
      g.restore();
    });
    g.restore();

    // The big moment.
    const tb = t - (0.7 + n * 1.25 + 0.5);
    if (tb > 0 && list.title) {
      const k = clamp01(tb / 0.6);
      const sc = easeOutBack(k);
      g.save();
      g.globalAlpha = clamp01(tb / 0.3);
      g.translate(W / 2 - (pw + 56 * s) / 2 + 0 * s, H * 0.17);
      g.scale(sc, sc);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `900 ${58 * s}px ${FONT}`;
      g.lineJoin = 'round';
      g.lineWidth = 10 * s;
      g.strokeStyle = 'rgba(20, 14, 8, 0.85)';
      g.strokeText(list.title, 0, 0);
      g.shadowColor = 'rgba(255, 207, 92, 0.9)';
      g.shadowBlur = 24 * s;
      const grd = g.createLinearGradient(0, -30 * s, 0, 30 * s);
      grd.addColorStop(0, '#fff4c9');
      grd.addColorStop(1, '#ffb347');
      g.fillStyle = grd;
      g.fillText(list.title, 0, 0);
      g.restore();
      list.done = tb > 1.2;
    }
  }

  function drawBanner(s, now) {
    if (banner.t < 0) return;
    const t = now - banner.t;
    const a = clamp01(t / 0.5) * clamp01((4.5 - t) / 0.8);
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${40 * s}px ${FONT}`;
    g.lineWidth = 8 * s;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(14, 10, 6, 0.8)';
    g.strokeText(banner.text, W / 2, H * 0.16);
    g.fillStyle = '#f7efe2';
    g.fillText(banner.text, W / 2, H * 0.16);
    if (banner.sub) {
      g.font = `600 ${20 * s}px ${FONT}`;
      g.lineWidth = 6 * s;
      g.strokeText(banner.sub, W / 2, H * 0.16 + 42 * s);
      g.fillStyle = '#cdbfa9';
      g.fillText(banner.sub, W / 2, H * 0.16 + 42 * s);
    }
    g.restore();
  }

  let clock = 0;
  function draw(dt) {
    clock += dt;
    prompt.shown += ((prompt.want ? 1 : 0) - prompt.shown) * Math.min(1, dt * 10);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const s = Math.max(0.6, Math.min(1.4, H / 900));
    drawBanner(s, clock);
    drawPrompt(s);
    drawChecklist(s, clock);
  }

  return {
    canvas,
    resize,
    draw,
    /** Show "E  text" floating at screen (x, y); progress 0..1 draws the ring, <0 hides it. */
    showPrompt(x, y, text, { key = 'E', progress = -1 } = {}) {
      prompt.want = true; prompt.x = x; prompt.y = y; prompt.text = text; prompt.key = key; prompt.progress = progress;
    },
    hidePrompt() { prompt.want = false; },
    startChecklist(items, title) { list.t = clock; list.items = items; list.title = title; list.done = false; },
    get checklistDone() { return list.done; },
    /** Seconds the checklist animation takes to reach its title moment. */
    checklistLength(n) { return 0.7 + n * 1.25 + 0.5 + 1.2; },
    showBanner(text, sub = '') { banner.t = clock; banner.text = text; banner.sub = sub; },
    dispose() { canvas.remove(); },
  };
}
