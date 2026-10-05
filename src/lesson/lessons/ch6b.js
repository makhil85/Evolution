// Chapter 6, lesson 6B: Stealing speed (before the slingshot flight). Each
// film draws on the 800x450 stage from src/lesson/draw.js; T is authored
// seconds.
//
// Three films:
//   1. Seen from Earth: the ship swings round behind Earth and leaves at the
//      same speed it came in (just turned).
//   2. Seen from the Sun: the same swing, but Earth is moving. The ship
//      leaves faster (50 -> 70 km/s); Earth drifts back a tiny bit (drawn
//      hugely bigger, with a note). Momentum bars: what Earth lost, the ship
//      gained (the Space pool rule at planet size).
//   3. The Sun: a plain flyby adds nothing (the Sun is the middle, it is not
//      moving past us). Firing the drive gives more speed the closer to the
//      Sun it fires (60 vs 93 km/s for the same push): deep in the Sun's
//      pull, each bit of push counts most.
//
// The numbers are a 3-4-5 triangle: Earth moves at 30 km/s, the ship comes
// in at 40 km/s across it (50 seen from the Sun) and leaves along it, 30 +
// 40 = 70. Film 3 uses v_out = sqrt(v_in^2 + 2 v_close dv + dv^2) with
// v_in 50, dv 10, v_close 300 (about 93); fired far out it is about 60.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version.
import { span, lerp, label, circle, arrow, rect, line, nightSky } from '../draw.js';

const TAU = Math.PI * 2;

/** The ship: a small dart pointing along `ang`, with an optional flame. */
function ship(ctx, x, y, ang, { flame = 0, col = '#e8eefc', T = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  if (flame > 0) {
    const fl = (16 + 4 * Math.sin(T * 40)) * flame;
    ctx.fillStyle = '#ffb03b';
    ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-7 - fl, 0); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, -7); ctx.lineTo(-4, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function earth(ctx, x, y, r) {
  circle(ctx, x, y, r, '#3f8fe0', '#bfe3ff', 1.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#4fb35c';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.2, r * 0.35, r * 0.5, 0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.3, r * 0.3, r * 0.25, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

function sun(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.8);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc34d'); g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU); ctx.fill();
}

/** A labelled horizontal bar: `v` of `max`, `w` wide. */
function bar(ctx, x, y, w, v, max, col, text) {
  rect(ctx, x, y, w, 16, 'rgba(255,255,255,0.12)', 5);
  rect(ctx, x, y, (w * Math.max(0, v)) / max, 16, col, 5);
  label(ctx, text, x, y - 11, { size: 14, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
}

// --- the swing round Earth, in Earth's frame -------------------------------------------
//
// A quadratic curve in Earth's frame: in going up (left of Earth, its
// trailing side), out going right. |P1-P0| = |P2-P1|, so it leaves at the
// speed it came in; the time warp s(tau) makes it fastest at the closest point.
// The corner A is placed so the closest point (the curve's middle) is CLOSE
// px from Earth's centre, on the diagonal: 0.25 P0 + 0.5 P1 + 0.25 P2.
const ARM = 250; const CLOSE = 72;
const A = (ARM / 4 + CLOSE * Math.SQRT1_2) / 0.75;
const P0 = { x: -A, y: ARM }; const P1 = { x: -A, y: -A }; const P2 = { x: ARM, y: -A };
const LEG = ARM + A; // |P1 - P0| = |P2 - P1|
const REL = 48; // relative speed on screen, px a second (40 km/s)

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

function trail(ctx, pts, col) {
  ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
}

// --- film 1: seen from Earth ----------------------------------------------------------------

function drawFromEarth(ctx, T) {
  nightSky(ctx, 81);
  const ex = 360; const ey = 250;
  earth(ctx, ex, ey, 34);
  label(ctx, 'Earth (we ride along with it)', ex, ey + 56, { size: 16, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
  const tNow = tauAt(T, 1.5);
  const pts = [];
  for (let k = -0.35; k <= tNow; k += 0.02) { const p = relAt(k); pts.push({ x: ex + p.x, y: ey + p.y }); }
  trail(ctx, pts, 'rgba(127,243,255,0.6)');
  const p = relAt(tNow);
  ship(ctx, ex + p.x, ey + p.y, p.ang);
  // Speed in and out, seen from Earth: the same.
  const inShow = span(T, 1, 2); const outShow = span(T, 10, 11);
  ctx.save(); ctx.globalAlpha = inShow;
  bar(ctx, 560, 300, 200, 40, 80, '#7fd3ff', 'Speed coming in: 40 km/s');
  ctx.restore();
  ctx.save(); ctx.globalAlpha = outShow;
  bar(ctx, 560, 360, 200, 40, 80, '#7fd3ff', 'Speed going out: 40 km/s');
  ctx.restore();
  if (T > 12) label(ctx, 'Same speed, new direction', 660, 410, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
}

// --- film 2: seen from the Sun -----------------------------------------------------------------

// Slower on screen than film 1 so Earth is still in view at the end; the
// 3:4 ratio (30 km/s : 40 km/s) is kept.
const U = 18; // Earth's speed on screen, px a second (30 km/s)
const REL2 = 24; // the ship's speed across Earth, px a second (40 km/s)
const NUDGE = 22; // Earth's drift back, hugely exaggerated

function drawFromSun(ctx, T) {
  nightSky(ctx, 83);
  sun(ctx, -40, 470, 60);
  label(ctx, 'Seen from the Sun', 110, 30, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  const t0 = 1.5;
  const nudge = NUDGE * span(T, 6, 11);
  const exFree = 120 + U * T; const ey = 270;
  const ex = exFree - nudge;
  // Earth's path, and the ghost of where it would have been.
  line(ctx, 0, ey, 800, ey, 'rgba(159,232,168,0.25)', 2, [3, 8]);
  if (nudge > 1) {
    circle(ctx, exFree, ey, 30, null, 'rgba(255,255,255,0.45)', 1.5);
    label(ctx, 'without the ship', exFree, ey - 44, { size: 13, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
  }
  earth(ctx, ex, ey, 30);
  arrow(ctx, ex + 34, ey, ex + 34 + U * 2.4, ey, '#9fe8a8', 5);
  // The ship: Earth's position plus the same swing as film 1 (Earth's
  // drift is cosmetic, so the ship rides the un-nudged Earth).
  const pts = [];
  for (let k = -0.6; k <= tauAt(T, t0, REL2); k += 0.02) {
    const Tk = t0 + (k * LEG) / REL2;
    const p = relAt(k);
    pts.push({ x: 120 + U * Tk + p.x, y: ey + p.y });
  }
  trail(ctx, pts, 'rgba(127,243,255,0.6)');
  const p = relAt(tauAt(T, t0, REL2));
  const dx = REL2 * Math.cos(p.ang) + U; const dy = REL2 * Math.sin(p.ang);
  ship(ctx, exFree + p.x, ey + p.y, Math.atan2(dy, dx));
  // Speeds seen from the Sun: 50 in, 70 out. Momentum: Earth lost what the ship gained.
  const sp = lerp(50, 70, span(T, 7, 15));
  bar(ctx, 540, 60, 220, sp, 80, '#7fd3ff', `Ship’s speed: ${Math.round(sp)} km/s`);
  if (T > 15) {
    label(ctx, 'Momentum', 650, 120, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    rect(ctx, 600, 135, 26, 70 * span(T, 15, 16.5), '#7fd3ff', 4);
    label(ctx, 'ship +', 613, 222, { size: 13, color: '#7fd3ff', halo: 'rgba(0,0,0,0.7)' });
    rect(ctx, 680, 135, 26, 70 * span(T, 15, 16.5), '#9fe8a8', 4);
    label(ctx, 'Earth −', 693, 222, { size: 13, color: '#9fe8a8', halo: 'rgba(0,0,0,0.7)' });
  }
  if (T > 7) label(ctx, 'Earth’s drift is drawn billions of times too big', 400, 430, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
}

// --- film 3: the Sun dive ------------------------------------------------------------------------

const SUN = { x: 300, y: 170, r: 46 };
const E = 1.35; const RP = 74; const NU_MAX = 2.15;
/** A swing round the Sun (a hyperbola, closest point straight below the Sun). */
function sunPath(tau) {
  const k = Math.tanh(3 * (2 * tau - 1)) / Math.tanh(3);
  const nu = NU_MAX * k;
  const r = (RP * (1 + E)) / (1 + E * Math.cos(nu));
  // nu = 0 at the bottom; she comes in from the left and leaves to the right.
  return { x: SUN.x - r * Math.sin(nu) * -1, y: SUN.y + r * Math.cos(nu), nu };
}

function drawSunDive(ctx, T) {
  nightSky(ctx, 85);
  sun(ctx, SUN.x, SUN.y, SUN.r);
  label(ctx, 'the Sun', SUN.x, SUN.y - SUN.r - 26, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  // Part 1 (0-9): a plain flyby; part 2 (9-): the same swing, firing far vs close.
  const p1 = T < 9;
  const tau = p1 ? span(T, 1, 8) : span(T, 10, 17);
  const pts = [];
  for (let k = 0; k <= tau; k += 0.01) pts.push(sunPath(k));
  trail(ctx, pts, 'rgba(127,243,255,0.55)');
  const p = sunPath(tau); const q = sunPath(Math.min(1, tau + 0.005));
  const ang = Math.atan2(q.y - p.y, q.x - p.x);
  if (p1) {
    ship(ctx, p.x, p.y, ang);
    bar(ctx, 560, 70, 200, 50, 100, '#7fd3ff', 'In: 50 km/s');
    if (T > 7) bar(ctx, 560, 130, 200, 50, 100, '#7fd3ff', 'Out: 50 km/s');
    if (T > 7.5) label(ctx, 'No push: no extra speed', 660, 180, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
    return;
  }
  // Two ships on the same path: blue fires far out, gold at the closest point.
  const blueFire = tau > 0.08 && tau < 0.16; const goldFire = Math.abs(tau - 0.5) < 0.04;
  ship(ctx, p.x, p.y - 10, ang, { flame: goldFire ? 1 : 0, col: '#ffd27a', T });
  ship(ctx, p.x, p.y + 10, ang, { flame: blueFire ? 1 : 0, col: '#7fd3ff', T });
  if (T > 10.5) label(ctx, '× same push, far out', 140, 60, { size: 14, color: '#7fd3ff', halo: 'rgba(0,0,0,0.7)' });
  if (T > 12.5) label(ctx, '× same push, closest to the Sun', SUN.x, SUN.y + RP + 34, { size: 14, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  const blue = lerp(50, 60, span(T, 10.8, 11.8)); const gold = lerp(50, 93, span(T, 13, 14.5));
  bar(ctx, 560, 70, 200, blue, 100, '#7fd3ff', `Fired far out: ${Math.round(blue)} km/s`);
  bar(ctx, 560, 130, 200, gold, 100, '#ffd27a', `Fired close: ${Math.round(gold)} km/s`);
  if (T > 15) label(ctx, 'Closest point = best place to fire', 660, 190, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  if (T > 16) label(ctx, 'Only a rock shield could go this close!', 660, 220, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
}

export const LESSON_6B = {
  id: 'ch6_slingshot',
  eyebrow: ['Stealing speed', 'Get speed from a planet'],
  narrator: ['Signal bot', 'Signal bot'],
  tryIt: ['Next: fly the slingshots on your route. Press at just the right moment!', 'Next: fly past the planets! Press at the right time.'],
  films: [
    {
      title: ['Seen from Earth', 'Seen from Earth'],
      beats: [
        { dur: 2, cap: ['Imagine we ride along with Earth and watch a ship fly past.', 'We ride with Earth and watch a ship.'] },
        { dur: 4.5, cap: ['Earth’s gravity grabs the ship and swings it round behind.', 'Earth’s pull swings the ship round.'] },
        { dur: 4, cap: ['It speeds up as it falls in, and slows again as it climbs out.', 'It goes fast near Earth, then slows.'], predict: true },
        { dur: 4, cap: ['Seen from Earth, it leaves at the same speed it came in. Just a new direction.', 'It leaves at the same speed. It just turned.'] },
      ],
      draw: drawFromEarth,
      question: {
        prompt: ['Seen from Earth, how fast is the ship when it leaves, compared with when it came in?', 'From Earth, how fast does the ship leave?'],
        choices: [
          { text: ['Faster', 'Faster'] },
          { text: ['The same speed, in a new direction', 'The same speed'], correct: true },
          { text: ['Slower', 'Slower'] },
        ],
        hint: ['Look at the two speed bars.', 'Look at the two bars.'],
        why: ['What gravity gives on the way in, it takes back on the way out. Seen from Earth the ship is only turned.', 'Same speed! It just turned.'],
      },
      clue: [null, 'It leaves at the same speed.'],
    },
    {
      title: ['Seen from the Sun', 'Seen from the Sun'],
      beats: [
        { dur: 3, cap: ['Now watch the same swing from the Sun. Earth is racing along its path at 30 km/s.', 'Now look from the Sun. Earth is moving fast.'] },
        { dur: 4.5, cap: ['The ship comes in behind Earth at 50 km/s...', 'The ship comes in behind Earth...'] },
        { dur: 5.5, cap: ['...and Earth drags it along. It leaves at 70 km/s!', '...and Earth pulls it along. It goes faster!'] },
        { dur: 4.5, cap: ['Where did the speed come from? Earth! It slowed down by a tiny, tiny bit.', 'The speed came from Earth. Earth slowed a tiny bit.'] },
        { dur: 4.5, cap: ['What Earth lost, the ship gained: the Space pool rule, at planet size.', 'Earth lost a bit. The ship got it. Like Space pool!'] },
      ],
      draw: drawFromSun,
      question: {
        prompt: ['Where did the ship’s extra speed come from?', 'Where did the extra speed come from?'],
        choices: [
          { text: ['From Earth: Earth slowed down by a tiny bit', 'From Earth'], correct: true },
          { text: ['From the ship’s engine', 'From the engine'] },
          { text: ['From nowhere: it was made from nothing', 'From nothing'] },
        ],
        hint: ['Watch Earth and its ghost. Which way did Earth drift?', 'Watch Earth. Did it move back?'],
        why: ['Momentum is never made or lost, only passed on. Earth is so heavy that what it gave away slows it by far less than a hair.', 'From Earth! Earth gave the ship some push.'],
      },
      clue: [null, 'The speed came from Earth.'],
    },
    {
      title: ['Diving past the Sun', 'Diving past the Sun'],
      beats: [
        { dur: 3, cap: ['Can the Sun give us speed too? Watch a plain swing past it.', 'Can the Sun give us speed? Watch.'] },
        { dur: 5.5, cap: ['No. The Sun is the middle of everything: it isn’t racing past us, so we leave as fast as we came.', 'No! We leave as fast as we came.'] },
        { dur: 3.5, cap: ['But fire the drive, and WHERE you fire matters. Same push, two places.', 'Now fire the engine. Same push, two places.'], predict: true },
        { dur: 4, cap: ['Fired far out: a little faster. Fired at the closest point: much faster!', 'Far away: a bit faster. Close: much faster!'] },
        { dur: 4.5, cap: ['Deep in the Sun’s pull, each bit of push counts most. Our rock shield lets us skim that close.', 'Fire at the closest point! The rock keeps us safe.'] },
      ],
      draw: drawSunDive,
      question: {
        prompt: ['Diving past the Sun, where is the best place to fire the drive?', 'Where should we fire the engine?'],
        choices: [
          { text: ['Far away from the Sun', 'Far from the Sun'] },
          { text: ['At the closest point to the Sun', 'Closest to the Sun'], correct: true },
          { text: ['It makes no difference where', 'It does not matter'] },
        ],
        hint: ['Which ship left faster: blue or gold?', 'Which ship went faster?'],
        why: ['The same push gave 60 km/s fired far out but 93 km/s fired at the closest point, where the ship is moving fastest.', 'Closest to the Sun gives the most speed!'],
      },
      clue: [null, 'Fire closest to the Sun.'],
    },
  ],
};
