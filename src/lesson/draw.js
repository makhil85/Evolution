// Drawing kit for the "watch, answer, try it" lessons (Chapters 1-3).
//
// Every film draws in a fixed 800 x 450 stage (16:9). card.js scales and
// letterboxes it into the canvas, so a film never thinks about pixels or the
// device ratio, and labels grow with the canvas instead of overlapping.
//
// All helpers take the 2-D context first and leave its state as they found it.

export const STAGE_W = 800;
export const STAGE_H = 450;

export const C = {
  sky: '#bfe6ff', skyTop: '#7cc4f2', night: '#0d1430', ground: '#7bc36b', earth: '#6b4d32',
  water: '#4aa3df', waterDeep: '#2f78b5', ink: '#1d2433', white: '#ffffff',
  push: '#ff7a3d', weight: '#7a8494', good: '#2fbf71', bad: '#e5484d', gold: '#f4c542',
  silver: '#c9d1dc', wood: '#b07a45', stone: '#d9cdb5', sun: '#ffd23f', label: '#1d2433',
};

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
/** 0..1 progress of `t` through [a, b], eased in and out. */
export function span(t, a, b) {
  const k = clamp((t - a) / (b - a));
  return k * k * (3 - 2 * k);
}
/** 0..1 linear progress of `t` through [a, b]. */
export const lin = (t, a, b) => clamp((t - a) / (b - a));

export function rect(ctx, x, y, w, h, fill, r = 0) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (r && ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.restore();
}

export function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, color = C.ink, w = 3, dash = null) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** A fat arrow from (x1,y1) to (x2,y2); skipped when shorter than 4. */
export function arrow(ctx, x1, y1, x2, y2, color = C.push, w = 8) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 4) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.min(len * 0.45, w * 2.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.5) * head, y2 - Math.sin(a - 0.5) * head);
  ctx.lineTo(x2 - Math.cos(a + 0.5) * head, y2 - Math.sin(a + 0.5) * head);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text with a soft white halo so it reads on any background. */
export function label(ctx, text, x, y, { size = 20, color = C.label, align = 'center', bold = true, halo = 'rgba(255,255,255,0.85)', alpha = 1 } = {}) {
  if (!text || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.font = `${bold ? 800 : 600} ${size}px 'Segoe UI', 'Trebuchet MS', system-ui, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.strokeStyle = halo;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Daytime sky with a ground strip from `groundY` down. */
export function daySky(ctx, groundY = 360, ground = C.ground) {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(1, C.sky);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, groundY);
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, STAGE_W, STAGE_H - groundY);
}

/** Night sky with fixed little stars. */
/** The night colour with no stars: for the films about atoms (lead
 * 2026-10-07: "atoms only", star dots looked like more atoms). */
export function plainDark(ctx) {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
}

export function nightSky(ctx, seed = 7) {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.save();
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.35 + rnd() * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rnd() * STAGE_W, rnd() * STAGE_H, 1.6, 1.6);
  }
  ctx.restore();
}

/** A simple child (stick figure with a head and a dress-like body). */
export function kid(ctx, x, y, { scale = 1, color = '#ff6fa8', armUp = 0, lean = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(lean);
  // legs
  line(ctx, -6, 0, -8, 26, C.ink, 4);
  line(ctx, 6, 0, 8, 26, C.ink, 4);
  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-12, 2); ctx.lineTo(12, 2); ctx.lineTo(7, -30); ctx.lineTo(-7, -30); ctx.closePath();
  ctx.fill();
  // arms
  line(ctx, -6, -24, -20, -10 - armUp * 22, C.ink, 4);
  line(ctx, 6, -24, 20, -10 - armUp * 22, C.ink, 4);
  // head + hair
  circle(ctx, 0, -42, 11, '#f2c6a0');
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath(); ctx.arc(0, -45, 11.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A side-on rocket standing on its tail at (x, y), `h` tall. */
export function rocket(ctx, x, y, h = 120, { flame = 0, body = '#f3f5f8', nose = '#ff5d5d', pointed = true, t = 0 } = {}) {
  const w = h * 0.24;
  ctx.save();
  ctx.translate(x, y);
  if (flame > 0) {
    const fl = h * (0.35 + 0.1 * Math.sin(t * 40)) * flame;
    const g = ctx.createLinearGradient(0, 0, 0, fl);
    g.addColorStop(0, '#fff6a8'); g.addColorStop(0.4, '#ffb03b'); g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w * 0.35, 0); ctx.lineTo(w * 0.35, 0); ctx.lineTo(0, fl); ctx.closePath(); ctx.fill();
  }
  // fins
  ctx.fillStyle = nose;
  ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.25); ctx.lineTo(-w * 0.95, 0); ctx.lineTo(-w / 2, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2, -h * 0.25); ctx.lineTo(w * 0.95, 0); ctx.lineTo(w / 2, 0); ctx.fill();
  // body
  rect(ctx, -w / 2, -h * 0.78, w, h * 0.78, body, 3);
  circle(ctx, 0, -h * 0.55, w * 0.22, '#7cc4f2', C.ink, 2);
  // nose
  ctx.fillStyle = nose;
  ctx.beginPath();
  if (pointed) { ctx.moveTo(-w / 2, -h * 0.78); ctx.lineTo(w / 2, -h * 0.78); ctx.lineTo(0, -h); }
  else { ctx.rect(-w / 2, -h * 0.84, w, h * 0.06); }
  ctx.fill();
  ctx.restore();
}

/** Puffs of gas or smoke, `n` of them, drifting from (x,y) along (dx,dy) with time `t`. */
export function puffs(ctx, x, y, dx, dy, t, { n = 6, color = 'rgba(230,230,240,0.8)', size = 10, spread = 14 } = {}) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const k = ((t * 1.4 + i / n) % 1);
    const px = x + dx * k + Math.sin(i * 7.3) * spread * k;
    const py = y + dy * k + Math.cos(i * 5.1) * spread * k;
    ctx.globalAlpha = (1 - k) * 0.9;
    circle(ctx, px, py, size * (0.6 + k * 1.2), color);
  }
  ctx.restore();
}
