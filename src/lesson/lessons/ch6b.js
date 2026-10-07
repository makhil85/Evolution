// Chapter 6, lesson 6B: Stealing energy (before the route planner). The rock
// ship is built in the asteroid belt and must leave the solar system as fast
// as it can. Each film draws on the 800x450 stage from src/lesson/draw.js; T
// is authored seconds.
//
// Four films:
//   1. Fall in, climb out: the ship falls from the belt, swings past the Sun
//      and climbs back to the belt. The speed bar fills, then drains to its
//      start mark; the energy bar (speed part + height part) never changes
//      length. The Sun alone gives nothing for free.
//   2. Steal from a moving planet: the 3-4-5 swing round Jupiter, first
//      riding along with Jupiter (17 in, 17 out, just turned), then seen
//      from the Sun (22 in, 30 out: Jupiter's 13 + 17). Jupiter drifts back
//      a tiny bit (drawn hugely bigger); momentum bars.
//   3. Bigger and closer steals more: Jupiter vs Uranus at the same pass
//      distance (sharp bend vs almost straight), then Jupiter passed far vs
//      close. Bars are 2 sin(bend / 2), the most a flyby can add.
//   4. Burn where you're fastest: the same fuel fired at the belt vs at the
//      closest point to the Sun (the planner's 100 t numbers: 39 vs about
//      135 km/s), with the heat on the rock shield and the too-hot zone.
//
// The Sun swings (films 1 and 4) are real conics timed by Kepler's second law
// (dt = r^2 / h dnu), so the ship is slow at the belt and fastest at the
// closest point; film 4's two exits share that clock, so the gold ship
// visibly pulls away. Film 3's bends come from sin(bend / 2) = 1 / e with
// e = 1 + rp v^2 / GM: same v, Uranus has 1/22 of Jupiter's mass.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version; opts.reduced
// stills the flame and heat flicker.
import { span, lerp, label, circle, arrow, rect, line, nightSky } from '../draw.js';

const TAU = Math.PI * 2;
const HALO = 'rgba(0,0,0,0.7)';
/** The Level's half of a [Level 4, Level 1] label pair. */
const say = (opts, pair) => pair[opts?.level === 1 ? 1 : 0];

/** The ship: a small dart pointing along `ang`, with an optional flame and rock shield. */
function ship(ctx, x, y, ang, { flame = 0, col = '#e8eefc', T = 0, still = false } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  if (flame > 0) {
    const fl = (16 + (still ? 0 : 4 * Math.sin(T * 40))) * flame;
    ctx.fillStyle = '#ffb03b';
    ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-7 - fl, 0); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, -7); ctx.lineTo(-4, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** The rock shield: a grey slab on the side facing (sx, sy), glowing with `heat` 0..1. */
function shield(ctx, x, y, sx, sy, heat) {
  const a = Math.atan2(sy - y, sx - x);
  const cx = x + Math.cos(a) * 13; const cy = y + Math.sin(a) * 13;
  ctx.save();
  if (heat > 0.05) {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 8 + 12 * heat);
    g.addColorStop(0, `rgba(255,120,40,${0.8 * heat})`); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 8 + 12 * heat, 0, TAU); ctx.fill();
  }
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#8d8a86'; ctx.strokeStyle = heat > 0.3 ? '#ff9a4a' : '#5c5955'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function sun(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.8);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc34d'); g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU); ctx.fill();
}

/** A gas giant: banded disc, with Jupiter's red spot when `spot`. */
function giant(ctx, x, y, r, { base = '#d9b48a', band = '#b07f55', spot = false } = {}) {
  circle(ctx, x, y, r, base, 'rgba(255,240,220,0.6)', 1.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = band;
  for (const k of [-0.55, -0.15, 0.3, 0.68]) ctx.fillRect(x - r, y + k * r, 2 * r, r * 0.16);
  if (spot) { ctx.fillStyle = '#c4533a'; ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.42, r * 0.2, r * 0.11, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
const jupiter = (ctx, x, y, r) => giant(ctx, x, y, r, { spot: true });
const uranus = (ctx, x, y, r) => giant(ctx, x, y, r, { base: '#9fe3e6', band: '#86cfd4' });

/** A labelled horizontal bar: `v` of `max`, `w` wide; `mark` draws a tick at that value. */
function bar(ctx, x, y, w, v, max, col, text, mark = null) {
  rect(ctx, x, y, w, 16, 'rgba(255,255,255,0.12)', 5);
  rect(ctx, x, y, (w * Math.max(0, Math.min(v, max))) / max, 16, col, 5);
  if (mark != null) line(ctx, x + (w * mark) / max, y - 3, x + (w * mark) / max, y + 19, '#ffffff', 2);
  label(ctx, text, x, y - 11, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
}

function trail(ctx, pts, col) {
  ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
}

// --- conics timed by Kepler's second law --------------------------------------------------
//
// r = rp (1 + e) / (1 + e cos nu), in units of rp. With GM = rp = 1 the
// angular momentum is h = sqrt(1 + e), and dt = r^2 / h dnu.
const rOf = (e, nu) => (1 + e) / (1 + e * Math.cos(nu));
/** The true anomaly where the conic reaches R (in rp). */
const nuAtR = (e, R) => Math.acos(Math.max(-1, Math.min(1, ((1 + e) / R - 1) / e)));

/** A table of (nu, t) from nuA to nuB; t in the GM = rp = 1 clock. */
function track(e, nuA, nuB, n = 400) {
  const nus = [nuA]; const ts = [0]; const h = Math.sqrt(1 + e);
  for (let i = 1; i <= n; i++) {
    const nu = nuA + ((nuB - nuA) * i) / n;
    const r = rOf(e, nu - (nuB - nuA) / (2 * n));
    nus.push(nu); ts.push(ts[i - 1] + (r * r * (nuB - nuA)) / n / h);
  }
  return { e, nus, ts, total: ts[n] };
}
/** nu at time t along a track (clamped to its ends). */
function nuAtT(tr, t) {
  const { nus, ts } = tr;
  if (t <= 0) return nus[0];
  if (t >= tr.total) return nus[nus.length - 1];
  let lo = 0; let hi = ts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
  return lerp(nus[lo], nus[hi], (t - ts[lo]) / (ts[hi] - ts[lo]));
}

// The Sun swings: closest point to the LEFT of the Sun, in from the upper
// right (the belt), out to the lower right.
function sunPos(S, rp, e, nu) {
  const r = rp * rOf(e, nu);
  return { x: S.x - r * Math.cos(nu), y: S.y + r * Math.sin(nu), r };
}
/** Heading (radians) along a Sun swing at nu, moving towards larger nu. */
function sunAng(S, rp, e, nu) {
  const a = sunPos(S, rp, e, nu - 0.002); const b = sunPos(S, rp, e, nu + 0.002);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** A dotted asteroid belt round (x, y), radius R. */
function belt(ctx, x, y, R, seed = 5) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.save(); ctx.fillStyle = '#9b8f7d';
  for (let i = 0; i < 220; i++) {
    const a = rnd() * TAU; const rr = R + (rnd() - 0.5) * 22;
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2, 2);
  }
  ctx.restore();
}

// --- film 1: fall in, climb out -------------------------------------------------------------

const S1 = { x: 215, y: 232 }; const RP1 = 45; const E1 = 0.9; const R0 = 205;
const NU1 = nuAtR(E1, R0 / RP1);
const TR1 = track(E1, -NU1, NU1);
const GO1 = 2.5; const END1 = 14; // the swing, authored seconds
// Speed energy as a share of the total (bottom of the dip = the closest point):
// v^2 = 2/r - 1/a with a = rp / (1 - e).
const A1 = 1 / (1 - E1);
const keShare = (R) => (2 / R - 1 / A1) / (2 - 1 / A1);
const KE0 = keShare(R0 / RP1);

function drawFallClimb(ctx, T, opts) {
  nightSky(ctx, 81);
  belt(ctx, S1.x, S1.y, R0);
  sun(ctx, S1.x, S1.y, 26);
  label(ctx, say(opts, ['the Sun', 'Sun']), S1.x + 36, S1.y - 34, { size: 15, color: '#ffd27a', halo: HALO, align: 'left' });
  label(ctx, say(opts, ['asteroid belt', 'rock belt']), 392, 412, { size: 15, color: '#d8ccb8', halo: HALO, align: 'left' });
  const nu = nuAtT(TR1, ((T - GO1) / (END1 - GO1)) * TR1.total);
  const pts = [];
  for (let k = -NU1; k <= nu; k += 0.03) pts.push(sunPos(S1, RP1, E1, k));
  trail(ctx, pts, 'rgba(127,243,255,0.6)');
  const p = sunPos(S1, RP1, E1, nu);
  const start = sunPos(S1, RP1, E1, -NU1);
  circle(ctx, start.x, start.y, 9, null, 'rgba(255,255,255,0.5)', 1.5);
  ship(ctx, p.x, p.y, sunAng(S1, RP1, E1, nu));
  // Speed (with its start mark), and the energy bar: speed part + height part.
  const ke = keShare(p.r / RP1);
  bar(ctx, 560, 80, 210, Math.sqrt(ke), 1, '#7fd3ff', say(opts, ['Speed', 'Speed']), Math.sqrt(KE0));
  label(ctx, say(opts, ['Energy (never changes)', 'Energy']), 560, 150, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  rect(ctx, 560, 161, 210, 16, '#b48cff', 5);
  rect(ctx, 560, 161, 210 * ke, 16, '#7fd3ff', 5);
  label(ctx, say(opts, ['speed part', 'speed']), 560, 192, { size: 12, color: '#7fd3ff', halo: HALO, align: 'left' });
  label(ctx, say(opts, ['height part', 'height']), 770, 192, { size: 12, color: '#b48cff', halo: HALO, align: 'right' });
  if (T > 6 && T < END1 - 1) {
    const inward = nu < 0;
    label(ctx, say(opts, inward ? ['Falling in: speeding up', 'Falling: faster!'] : ['Climbing out: slowing down', 'Climbing: slower']), 665, 240, { size: 16, color: '#ffd27a', halo: HALO });
  }
  if (T > END1) {
    label(ctx, say(opts, ['Back at the belt:', 'Back at the belt:']), 665, 250, { size: 15, color: '#ffd27a', halo: HALO });
    label(ctx, say(opts, ['same speed as at the start', 'same speed as before']), 665, 273, { size: 15, color: '#ffd27a', halo: HALO });
  }
}

// --- film 2: steal from a moving planet -------------------------------------------------------
//
// The swing round Jupiter, in Jupiter's frame: a quadratic curve, in going
// up (left of Jupiter, its trailing side), out going right. |P1-P0| =
// |P2-P1|, so it leaves at the speed it came in; the time warp s(tau) makes
// it fastest at the closest point. The corner A is placed so the closest
// point (the curve's middle) is CLOSE px from the centre, on the diagonal:
// 0.25 P0 + 0.5 P1 + 0.25 P2.
const ARM = 250; const CLOSE = 72;
const A = (ARM / 4 + CLOSE * Math.SQRT1_2) / 0.75;
const P0 = { x: -A, y: ARM }; const P1 = { x: -A, y: -A }; const P2 = { x: ARM, y: -A };
const LEG = ARM + A; // |P1 - P0| = |P2 - P1|
const REL = 48; // relative speed on screen, px a second (17 km/s)

function relAt(tau) {
  if (tau <= 0) return { x: P0.x, y: P0.y - LEG * tau, ang: -Math.PI / 2 };
  if (tau >= 1) return { x: P2.x + LEG * (tau - 1), y: P2.y, ang: 0 };
  const s = tau - (0.5 * Math.sin(TAU * tau)) / TAU;
  const a = (1 - s) * (1 - s); const b = 2 * (1 - s) * s; const c = s * s;
  const dx = 2 * ((1 - s) * (P1.x - P0.x) + s * (P2.x - P1.x));
  const dy = 2 * ((1 - s) * (P1.y - P0.y) + s * (P2.y - P1.y));
  return { x: a * P0.x + b * P1.x + c * P2.x, y: a * P0.y + b * P1.y + c * P2.y, ang: Math.atan2(dy, dx) };
}
// In tau units the ends move LEG * 0.5 per tau (s' = 0.5 there, |B'| = 2 LEG),
// so tau runs at REL / (LEG) per second to keep REL px a second.
const tauAt = (T, t0, rel = REL) => ((T - t0) * rel) / LEG;

const SPLIT2 = 11; // part 1 (riding with Jupiter) ends; part 2 (seen from the Sun) starts

function drawFromJupiter(ctx, T, opts) {
  nightSky(ctx, 82);
  const jx = 330; const jy = 250;
  jupiter(ctx, jx, jy, 34);
  label(ctx, say(opts, ['Jupiter (we ride along with it)', 'Jupiter (we ride with it)']), jx, jy + 56, { size: 16, color: '#ffe2c0', halo: HALO });
  const tNow = tauAt(T, 1.2);
  const pts = [];
  for (let k = -0.35; k <= tNow; k += 0.02) { const p = relAt(k); pts.push({ x: jx + p.x, y: jy + p.y }); }
  trail(ctx, pts, 'rgba(127,243,255,0.6)');
  const p = relAt(tNow);
  ship(ctx, jx + p.x, jy + p.y, p.ang);
  // Speed in and out, seen from Jupiter: the same.
  ctx.save(); ctx.globalAlpha = span(T, 1, 2);
  bar(ctx, 560, 300, 200, 17, 34, '#7fd3ff', say(opts, ['Speed coming in: 17 km/s', 'Coming in: 17']));
  ctx.restore();
  ctx.save(); ctx.globalAlpha = span(T, 8.5, 9.5);
  bar(ctx, 560, 360, 200, 17, 34, '#7fd3ff', say(opts, ['Speed going out: 17 km/s', 'Going out: 17']));
  ctx.restore();
  if (T > 9.5) label(ctx, say(opts, ['Same speed, new direction', 'Same speed, just turned']), 660, 410, { size: 17, color: '#ffd27a', halo: HALO });
}

// Seen from the Sun. The 3:4 ratio (13 km/s : 17 km/s) is kept.
const U = 18; // Jupiter's speed on screen, px a second (13 km/s)
const REL2 = 24; // the ship's speed across Jupiter, px a second (17 km/s)
const NUDGE = 22; // Jupiter's drift back, hugely exaggerated

function drawFromSun(ctx, T, opts) {
  nightSky(ctx, 83);
  sun(ctx, -40, 470, 60);
  label(ctx, say(opts, ['Seen from the Sun', 'Seen from the Sun']), 110, 30, { size: 18, color: '#ffd27a', halo: HALO });
  const t0 = 1.5;
  const nudge = NUDGE * span(T, 6, 11);
  const jxFree = 120 + U * T; const jy = 270;
  const jx = jxFree - nudge;
  // Jupiter's path, and the ghost of where it would have been.
  line(ctx, 0, jy, 800, jy, 'rgba(255,226,192,0.25)', 2, [3, 8]);
  if (nudge > 1) {
    circle(ctx, jxFree, jy, 30, null, 'rgba(255,255,255,0.45)', 1.5);
    label(ctx, say(opts, ['without the ship', 'no ship']), jxFree, jy - 44, { size: 13, color: '#cfe8ff', halo: HALO });
  }
  jupiter(ctx, jx, jy, 30);
  arrow(ctx, jx + 34, jy, jx + 34 + U * 2.4, jy, '#ffe2c0', 5);
  // The ship: Jupiter's position plus the same swing (the drift is
  // cosmetic, so the ship rides the un-nudged Jupiter).
  const pts = [];
  for (let k = -0.6; k <= tauAt(T, t0, REL2); k += 0.02) {
    const Tk = t0 + (k * LEG) / REL2;
    const p = relAt(k);
    pts.push({ x: 120 + U * Tk + p.x, y: jy + p.y });
  }
  trail(ctx, pts, 'rgba(127,243,255,0.6)');
  const p = relAt(tauAt(T, t0, REL2));
  const dx = REL2 * Math.cos(p.ang) + U; const dy = REL2 * Math.sin(p.ang);
  ship(ctx, jxFree + p.x, jy + p.y, Math.atan2(dy, dx));
  // Speeds seen from the Sun: 22 in, 30 out. Momentum: Jupiter lost what the ship gained.
  const sp = lerp(22, 30, span(T, 6, 12));
  bar(ctx, 540, 60, 220, sp, 34, '#7fd3ff', say(opts, [`Ship’s speed: ${Math.round(sp)} km/s`, `Ship: ${Math.round(sp)} km/s`]));
  if (T > 12) {
    label(ctx, say(opts, ['Momentum', 'Push']), 650, 120, { size: 16, color: '#fff', halo: HALO });
    rect(ctx, 600, 135, 26, 70 * span(T, 12, 13.5), '#7fd3ff', 4);
    label(ctx, say(opts, ['ship +', 'ship +']), 613, 222, { size: 13, color: '#7fd3ff', halo: HALO });
    rect(ctx, 680, 135, 26, 70 * span(T, 12, 13.5), '#ffe2c0', 4);
    label(ctx, say(opts, ['Jupiter −', 'Jupiter −']), 693, 222, { size: 13, color: '#ffe2c0', halo: HALO });
  }
  if (T > 7) label(ctx, say(opts, ['Jupiter’s drift is drawn billions of times too big', 'Jupiter’s drift is drawn way too big']), 400, 430, { size: 14, color: '#cfe8ff', halo: HALO });
}

const drawSteal = (ctx, T, opts) => (T < SPLIT2 ? drawFromJupiter(ctx, T, opts) : drawFromSun(ctx, T - SPLIT2, opts));

// --- film 3: bigger and closer steals more ----------------------------------------------------
//
// A flyby in the planet's frame: closest point straight above the planet,
// in from the left, bent down by `bend`. sin(bend / 2) = 1 / e.
function flyby(bend, rpPx, rMaxPx) {
  const e = 1 / Math.sin(bend / 2);
  const nuE = nuAtR(e, rMaxPx / rpPx);
  return { e, rp: rpPx, nuE, tr: track(e, -nuE, nuE) };
}
function flyPos(fb, cx, cy, nu) {
  const r = fb.rp * rOf(fb.e, nu);
  return { x: cx + r * Math.sin(nu), y: cy - r * Math.cos(nu) };
}
function drawFlyby(ctx, fb, cx, cy, f, col) {
  const nu = nuAtT(fb.tr, f * fb.tr.total);
  const pts = [];
  for (let k = -fb.nuE; k <= nu; k += 0.02) pts.push(flyPos(fb, cx, cy, k));
  trail(ctx, pts, col);
  const p = flyPos(fb, cx, cy, nu); const q = flyPos(fb, cx, cy, nu + 0.003);
  ship(ctx, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x));
}
// Same pass distance and speed: e - 1 scales as 1 / mass. Jupiter's bend is
// 70 degrees (e - 1 = 0.74); Uranus has 1/22 the mass, so e - 1 = 16 (7 degrees).
const DEG = Math.PI / 180;
const FB_J = flyby(70 * DEG, 50, 235);
const FB_U = flyby(2 * Math.asin(1 / (1 + 0.74 * 22)), 50, 235);
// Jupiter passed close (e - 1 = 0.305, 100 degrees) and five times farther
// out (e - 1 = 1.525, about 47 degrees).
const FB_NEAR = flyby(100 * DEG, 40, 260);
const FB_FAR = flyby(2 * Math.asin(1 / (1 + 0.305 * 5)), 200, 300);
// The most a flyby can add, in the Sun's frame: 2 v sin(bend / 2). Same
// pass distance: Jupiter 0.574, Saturn 0.288, Uranus 0.058, Neptune 0.068;
// Jupiter close 0.766, far 0.396.
const GAIN = { jup: 0.574, sat: 0.288, ura: 0.058, nep: 0.068, near: 0.766, far: 0.396 };
const SPLIT3 = 12;

function drawBigClose(ctx, T, opts) {
  nightSky(ctx, 84);
  const partA = T < SPLIT3;
  if (partA) {
    const f = span(T, 1.5, 8);
    jupiter(ctx, 270, 150, 26);
    uranus(ctx, 270, 335, 10);
    label(ctx, say(opts, ['Jupiter: 318 Earths heavy', 'Jupiter: very heavy']), 270, 196, { size: 14, color: '#ffe2c0', halo: HALO });
    label(ctx, say(opts, ['Uranus: 15 Earths heavy', 'Uranus: lighter']), 270, 368, { size: 14, color: '#9fe3e6', halo: HALO });
    drawFlyby(ctx, FB_J, 270, 150, f, 'rgba(127,243,255,0.6)');
    drawFlyby(ctx, FB_U, 270, 335, f, 'rgba(127,243,255,0.6)');
    if (T > 8) label(ctx, say(opts, ['same pass distance, same speed', 'same distance, same speed']), 270, 425, { size: 14, color: '#cfe8ff', halo: HALO });
  } else {
    const f = span(T, SPLIT3 + 1, SPLIT3 + 7.5);
    jupiter(ctx, 270, 250, 26);
    label(ctx, say(opts, ['Jupiter', 'Jupiter']), 270, 296, { size: 14, color: '#ffe2c0', halo: HALO });
    drawFlyby(ctx, FB_FAR, 270, 250, f, 'rgba(127,211,255,0.6)');
    drawFlyby(ctx, FB_NEAR, 270, 250, f, 'rgba(255,210,122,0.75)');
    if (T > SPLIT3 + 4) {
      label(ctx, say(opts, ['far pass', 'far']), 60, 56, { size: 14, color: '#7fd3ff', halo: HALO, align: 'left' });
      label(ctx, say(opts, ['close pass', 'close']), 60, 330, { size: 14, color: '#ffd27a', halo: HALO, align: 'left' });
    }
  }
  // Bars: four planets at the same pass distance; then Jupiter far vs close.
  const g1 = span(T, 8, 10.5);
  label(ctx, say(opts, ['Speed stolen, same distance', 'Speed stolen']), 560, 40, { size: 13, color: '#ffd27a', halo: HALO, align: 'left' });
  bar(ctx, 560, 72, 210, GAIN.jup * g1, 0.8, '#ffe2c0', say(opts, ['Jupiter', 'Jupiter']));
  bar(ctx, 560, 108, 210, GAIN.sat * g1, 0.8, '#e8d39a', say(opts, ['Saturn', 'Saturn']));
  bar(ctx, 560, 144, 210, GAIN.ura * g1, 0.8, '#9fe3e6', say(opts, ['Uranus', 'Uranus']));
  bar(ctx, 560, 180, 210, GAIN.nep * g1, 0.8, '#7f9bff', say(opts, ['Neptune', 'Neptune']));
  if (!partA) {
    const g2 = span(T, SPLIT3 + 7.5, SPLIT3 + 9.5);
    label(ctx, say(opts, ['Jupiter: far vs close', 'Jupiter: far or close']), 560, 236, { size: 14, color: '#ffd27a', halo: HALO, align: 'left' });
    bar(ctx, 560, 268, 210, GAIN.far * g2, 0.8, '#7fd3ff', say(opts, ['far pass: gentle bend', 'far: small bend']));
    bar(ctx, 560, 304, 210, GAIN.near * g2, 0.8, '#ffd27a', say(opts, ['close pass: sharp bend', 'close: big bend']));
    if (T > SPLIT3 + 9.5) label(ctx, say(opts, ['Bigger planet, closer pass = more', 'Big planet, close pass = most']), 665, 350, { size: 15, color: '#ffd27a', halo: HALO });
  }
}

// --- film 4: burn where you're fastest ----------------------------------------------------------
//
// Both ships fall from the belt on the same path (e 0.95). Blue fires at the
// belt; gold fires at the closest point. Out of the closest point blue
// leaves on e 1.2, gold on e 2.5, on the same clock as the way in.
const S4 = { x: 200, y: 225 }; const RP4 = 66; const R4 = 200;
const E_IN = 0.95; const NU_IN = nuAtR(E_IN, R4 / RP4);
const TR_IN = track(E_IN, -NU_IN, 0);
const EXIT = { blue: 1.2, gold: 2.5 };
const TR_OUT = {
  blue: track(EXIT.blue, 0, nuAtR(EXIT.blue, 460 / RP4)),
  gold: track(EXIT.gold, 0, nuAtR(EXIT.gold, 460 / RP4)),
};
const GO4 = 2.5; const PERI4 = 9; // leave the belt; reach the closest point
const SEC4 = (PERI4 - GO4) / TR_IN.total; // seconds per Kepler time unit
const HOT = 34; // the too-hot zone, px from the Sun's centre

/** Where a ship is at T: { x, y, ang, r }, on the shared way in or its own way out. */
function ship4(T, which) {
  if (T <= PERI4) {
    const nu = nuAtT(TR_IN, (T - GO4) / SEC4);
    return { ...sunPos(S4, RP4, E_IN, nu), ang: sunAng(S4, RP4, E_IN, nu), nu };
  }
  const e = EXIT[which];
  const nu = nuAtT(TR_OUT[which], (T - PERI4) / SEC4);
  return { ...sunPos(S4, RP4, e, nu), ang: sunAng(S4, RP4, e, nu), nu };
}

function drawSunBurn(ctx, T, opts) {
  nightSky(ctx, 85);
  belt(ctx, S4.x, S4.y, R4, 9);
  // The too-hot zone, then the Sun.
  circle(ctx, S4.x, S4.y, HOT, 'rgba(255,90,40,0.10)', 'rgba(255,110,60,0.7)', 1.5);
  sun(ctx, S4.x, S4.y, 16);
  label(ctx, say(opts, ['too hot, even for rock', 'too hot!']), S4.x + HOT + 8, S4.y, { size: 13, color: '#ff9a6a', halo: HALO, align: 'left' });
  // Trails: the shared way in, then each way out.
  const pts = [];
  for (let s = GO4; s <= Math.min(T, PERI4); s += 0.05) pts.push(ship4(s, 'gold'));
  trail(ctx, pts, 'rgba(220,230,255,0.45)');
  for (const w of ['blue', 'gold']) {
    if (T <= PERI4) break;
    const out = [];
    for (let s = PERI4; s <= T; s += 0.05) out.push(ship4(s, w));
    trail(ctx, out, w === 'gold' ? 'rgba(255,210,122,0.75)' : 'rgba(127,211,255,0.7)');
  }
  // The two ships side by side (offset across the path), shields to the Sun.
  const blueFire = T > GO4 - 0.3 && T < GO4 + 0.9;
  const goldFire = Math.abs(T - PERI4) < 0.45;
  for (const w of ['blue', 'gold']) {
    const p = ship4(T, w);
    const off = (w === 'gold' ? -9 : 9) * (T <= PERI4 ? 1 : 0);
    const x = p.x + off * Math.sin(p.ang); const y = p.y - off * Math.cos(p.ang);
    const heat = Math.max(0, Math.min(1, ((RP4 * 1.6) / p.r - 1) / 0.6));
    const flick = opts?.reduced ? 1 : 0.85 + 0.15 * Math.sin(T * 23);
    shield(ctx, x, y, S4.x, S4.y, heat * flick);
    ship(ctx, x, y, p.ang, { flame: (w === 'gold' ? goldFire : blueFire) ? 1 : 0, col: w === 'gold' ? '#ffd27a' : '#7fd3ff', T, still: opts?.reduced });
  }
  if (T > GO4 - 0.3) label(ctx, say(opts, ['blue fires here, far out', 'blue fires here']), 330, 22, { size: 13, color: '#7fd3ff', halo: HALO, align: 'left' });
  if (T > PERI4 - 0.5) {
    label(ctx, say(opts, ['gold fires here,', 'gold fires']), 118, 262, { size: 13, color: '#ffd27a', halo: HALO, align: 'right' });
    label(ctx, say(opts, ['closest to Sun', 'here']), 118, 278, { size: 13, color: '#ffd27a', halo: HALO, align: 'right' });
  }
  // Speed far from the Sun afterwards (100 t of fuel each), and the heat.
  const blue = 39 * span(T, PERI4 + 1.5, PERI4 + 3); const gold = 135 * span(T, PERI4 + 2.5, PERI4 + 4.5);
  label(ctx, say(opts, ['Same fuel. Speed at the end:', 'Same fuel. Speed after:']), 560, 40, { size: 14, color: '#fff', halo: HALO, align: 'left' });
  bar(ctx, 560, 80, 210, blue, 150, '#7fd3ff', say(opts, [`Fired far out: ${Math.round(blue)} km/s`, `Far out: ${Math.round(blue)} km/s`]));
  bar(ctx, 560, 132, 210, gold, 150, '#ffd27a', say(opts, [`Fired closest: ${Math.round(gold)} km/s`, `Closest: ${Math.round(gold)} km/s`]));
  // Sunlight goes as 1 / r^2; the white mark keeps the peak once it has passed.
  const heatNow = Math.min(1, (RP4 / ship4(T, 'gold').r) ** 2);
  bar(ctx, 560, 196, 210, heatNow, 1, '#ff7a3d', say(opts, ['Heat on the rock shield', 'Heat on the shield']), T > PERI4 + 0.5 ? 1 : null);
  if (T > PERI4 + 5) {
    label(ctx, say(opts, ['Closer = more speed,', 'Closer = faster,']), 665, 262, { size: 16, color: '#ffd27a', halo: HALO });
    label(ctx, say(opts, ['but hotter!', 'but hotter!']), 665, 286, { size: 16, color: '#ff9a6a', halo: HALO });
  }
}

export const LESSON_6B = {
  id: 'ch6_slingshot',
  eyebrow: ['Stealing energy', 'Borrow speed'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: plan the route out of the solar system. Which planets, and how close to the Sun?', 'Next: plan the way out! Pick planets and the Sun dive.'],
  films: [
    {
      title: ['Fall in, climb out', 'Fall in, climb out'],
      beats: [
        { dur: 2.5, cap: ['Our rock ship starts in the asteroid belt. Let it fall toward the Sun.', 'We start in the rock belt. Let the ship fall to the Sun.'] },
        { dur: 5, cap: ['Falling in, it speeds up: height energy turns into speed.', 'It falls and goes faster and faster.'] },
        { dur: 5, cap: ['Climbing back out, it slows down by exactly as much.', 'It climbs out and slows down.'], predict: true },
        { dur: 4.5, cap: ['Back at the belt it has just the speed it started with. The total never changed: the Sun alone gives nothing for free.', 'Back at the belt: same speed as before. No free speed!'] },
      ],
      draw: drawFallClimb,
      question: {
        prompt: ['After swinging past the Sun and climbing back to the belt, how fast is the ship?', 'Back at the belt, how fast is the ship?'],
        choices: [
          { text: ['Much faster than at the start', 'Faster'] },
          { text: ['Just as fast as at the start', 'The same as before'], correct: true },
          { text: ['Stopped dead', 'Stopped'] },
        ],
        hint: ['Watch the speed bar and its white start mark.', 'Look at the speed bar and the white line.'],
        why: ['Falling in turns height energy into speed; climbing out turns it back. The total never changes, so a plain swing past the Sun gains nothing.', 'Same speed! The Sun gives it back, then takes it back.'],
      },
      clue: [null, 'Same speed as at the start.'],
    },
    {
      title: ['Steal from a moving planet', 'Take speed from a planet'],
      beats: [
        { dur: 2, cap: ['Ride along with Jupiter and watch a ship fly past.', 'We ride with Jupiter and watch a ship.'] },
        { dur: 4.5, cap: ['Jupiter’s pull swings the ship round behind it.', 'Jupiter’s pull swings the ship round.'] },
        { dur: 4.5, cap: ['Seen from Jupiter: in at 17 km/s, out at 17 km/s. Just a new direction.', 'Same speed out. It just turned.'] },
        { dur: 3, cap: ['Now watch the same swing from the Sun. Jupiter races along at 13 km/s.', 'Now look from the Sun. Jupiter is moving.'] },
        { dur: 4, cap: ['The ship comes in behind Jupiter at 22 km/s...', 'The ship comes in behind Jupiter...'], predict: true },
        { dur: 5, cap: ['...and Jupiter drags it along. It leaves at 30 km/s, and Jupiter slows by a tiny, tiny bit.', '...and Jupiter pulls it along. Faster! Jupiter slows a tiny bit.'] },
      ],
      draw: drawSteal,
      question: {
        prompt: ['Seen from the Sun, where did the ship’s extra speed come from?', 'Where did the extra speed come from?'],
        choices: [
          { text: ['From the Sun’s pull', 'From the Sun'] },
          { text: ['From the ship’s engine', 'From the engine'] },
          { text: ['From Jupiter: it slowed down by a tiny bit', 'From Jupiter'], correct: true },
        ],
        hint: ['Watch Jupiter and its ghost. Which way did Jupiter drift?', 'Watch Jupiter. Did it move back?'],
        why: ['A moving planet drags the ship along. Momentum is passed on, never made: Jupiter is so heavy that what it gave away slows it by far less than a hair.', 'From Jupiter! It gave the ship some of its speed.'],
      },
      clue: [null, 'The speed came from Jupiter.'],
    },
    {
      title: ['Bigger and closer steals more', 'Big and close is best'],
      beats: [
        { dur: 2, cap: ['Same speed, same distance: one ship passes Jupiter, one passes Uranus.', 'One ship passes Jupiter. One passes Uranus.'] },
        { dur: 6, cap: ['Heavy Jupiter bends the path sharply. Light Uranus hardly bends it at all.', 'Big Jupiter bends the path a lot. Uranus, just a bit.'] },
        { dur: 4, cap: ['A sharper bend steals more speed. Jupiter first, then Saturn; Uranus and Neptune give little.', 'More bend, more speed. Jupiter is the best.'] },
        { dur: 3.5, cap: ['Now pass Jupiter twice: once far away, once close.', 'Now pass Jupiter far, then close.'], predict: true },
        { dur: 5.5, cap: ['The close pass bends much more, so it steals about twice as much.', 'Close bends more. Close gets more speed!'] },
      ],
      draw: drawBigClose,
      question: {
        prompt: ['Which flyby steals the most speed?', 'Which one gets the most speed?'],
        choices: [
          { text: ['A close pass by Jupiter', 'Close past Jupiter'], correct: true },
          { text: ['A far pass by Jupiter', 'Far past Jupiter'] },
          { text: ['A close pass by Uranus', 'Close past Uranus'] },
        ],
        hint: ['Which planet is heaviest, and which pass bent the path most?', 'Big planet? Close or far?'],
        why: ['The heavier the planet and the closer you pass, the more it bends your path, and the more speed you steal. Jupiter is by far the heaviest.', 'Big Jupiter, close by, gives the most!'],
      },
      clue: [null, 'Big planet, close pass.'],
    },
    {
      title: ['Burn where you’re fastest', 'Fire when you’re fast'],
      beats: [
        { dur: 2.5, cap: ['Two ships, the same fuel. Blue fires it out at the belt...', 'Two ships, same fuel. Blue fires far out...'] },
        { dur: 6.5, cap: ['...gold falls toward the Sun first, and fires at the closest point, where it is fastest.', '...gold falls to the Sun and fires when it is fastest.'], predict: true },
        { dur: 5, cap: ['Same push, but fired fast it counts far more: 135 km/s against 39!', 'Same push. Gold goes much, much faster!'] },
        { dur: 4.5, cap: ['The catch: close to the Sun is very hot. The rock shield takes the heat, but how close is safe?', 'But near the Sun it is very hot. The rock shield helps.'] },
      ],
      draw: drawSunBurn,
      question: {
        prompt: ['With the same fuel, where should we fire it to leave the solar system fastest?', 'Where should we fire the engine?'],
        choices: [
          { text: ['Out at the belt, right away', 'Far from the Sun'] },
          { text: ['It makes no difference where', 'It does not matter'] },
          { text: ['At the closest point to the Sun', 'Closest to the Sun'], correct: true },
        ],
        hint: ['Compare the blue and gold speed bars.', 'Which ship went faster?'],
        why: ['Each bit of push adds the most energy when you are moving fastest: at the closest point to the Sun. With 100 t of fuel that is about 135 km/s instead of 39. The price is heat on the shield.', 'Fire closest to the Sun! But it is hot there.'],
      },
      clue: [null, 'Fire closest to the Sun.'],
    },
  ],
};
