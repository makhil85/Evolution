// Chapter 7, lesson 7D: black holes and quasars (after the holodeck quasar,
// before the game "Where is it really?"). Lead 2026-10-08: a quasar is shown
// as a holodeck visit, so the lesson says real quasars are billions of
// light-years away, in other galaxies. Each film draws on the 800x450 stage from
// src/lesson/draw.js; T is authored seconds (the beat times add up).
//
// Three films, the last one watch-only (no question: a breather, and it sets up
// the game):
//   1. Why a black hole is black: so much stuff squeezed so small that its pull
//      stops even light. The star shrinks to a dot; the light beams fall back.
//   2. Why it glows: gas falls in, swirls in a disk, rubs and heats to millions of
//      degrees. A quasar's disk can outshine all the stars of its galaxy. Real
//      quasars are billions of light-years away; our galaxy's middle is quiet.
//   3. Why the stars look in the wrong place: gravity bends light. A star behind
//      the hole looks pushed away from it, and lined up exactly it makes a ring.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version; the right answer
// is never the uniquely longest choice (test-lessons.mjs checks it).
import { span, lerp, label, circle, nightSky } from '../draw.js';

const TAU = Math.PI * 2;
const HALO = 'rgba(0,0,0,0.6)';

function glow(ctx, x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// --- film 1: a black hole is black -------------------------------------------------------------

const SQUEEZE = [2, 6]; // the star shrinks to a dot
const LIGHT = [6.5, 9.5]; // the light beams go out, and fall back

function drawBlack(ctx, T) {
  nightSky(ctx, 61);
  const cx = 400; const cy = 215;
  const k = span(T, SQUEEZE[0], SQUEEZE[1]);
  if (T < SQUEEZE[1]) {
    const r = lerp(120, 12, k);
    glow(ctx, cx, cy, r * 1.6, 'rgba(255,210,90,0.9)');
    circle(ctx, cx, cy, r, '#ffd23f');
    if (k > 0.05 && k < 1) label(ctx, 'the same stuff...', cx, cy - 150, { size: 17, color: '#ffe27a', halo: HALO });
  }
  if (T >= SQUEEZE[1]) {
    // A black hole: the stuff of a star in a dot. Its light comes back down.
    const q = span(T, LIGHT[0], LIGHT[1]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      ctx.save(); ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const u = (s / 24) * q;                 // how far along the ray the light has got
        const r = 16 + u * 170;
        // Gravity bends each ray round as it goes out (a curve, not a straight line).
        const ang = a + 0.6 * u * u;
        const x = cx + Math.cos(ang) * r; const y = cy + Math.sin(ang) * r;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    }
    circle(ctx, cx, cy, 16, '#000000', '#7fd3ff', 2);
    label(ctx, 'black hole', cx, cy + 44, { size: 20, color: '#7fd3ff', halo: HALO });
  }
  if (T > 10.5) {
    label(ctx, 'Its pull is so strong that light cannot get out.', 400, 395, { size: 19, color: '#fff', halo: HALO });
    label(ctx, 'So we see only a black shadow.', 400, 423, { size: 17, color: '#cfe8ff', halo: HALO });
  }
  if (T > 2 && T <= 6) label(ctx, 'squeezed into a tiny ball', 400, 395, { size: 19, color: '#fff', halo: HALO });
}

// --- film 2: why it glows -------------------------------------------------------------------------

const GALAXY_DOTS = (() => {
  let s = 23; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU * 2.5; const r = 14 + rnd() * 100 * (0.4 + 0.6 * (a / (TAU * 2.5)));
    out.push({ x: Math.cos(a) * r * 1.2, y: Math.sin(a) * r * 0.55, s: 1 + rnd() * 1.5 });
  }
  return out;
})();

function drawGlow(ctx, T) {
  nightSky(ctx, 77);
  const cx = 300; const cy = 210;
  if (T < 11.5) {
    // The disk: swirling gas, hot inside (white) and cooler outside (red).
    const heat = span(T, 2.5, 6.5);
    const spin = T * 0.9;
    const cool = '#c2452c'; const hot = '#fff3c9';
    for (let ring = 0; ring < 8; ring++) {
      const f = ring / 7; // 0 = inner edge, 1 = outer edge
      const rx = lerp(64, 170, f); const ry = rx * 0.32;
      const col = f < 0.5 + 0.5 * (1 - heat) ? hot : cool;
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * (1 - f);
      ctx.strokeStyle = col; ctx.lineWidth = 14 - ring; ctx.lineCap = 'round';
      for (let a = 0; a < 4; a++) {
        const s0 = spin * (1 - f * 0.5) + a * (TAU / 4);
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, s0, s0 + 1.1); ctx.stroke();
      }
      ctx.restore();
    }
    circle(ctx, cx, cy, 30, '#000000');
    if (T > 2.5 && T < 6.5) label(ctx, 'millions of degrees!', cx, cy + 116, { size: 18, color: '#ffe27a', halo: HALO });
    if (T < 2.5) label(ctx, 'gas falls in and swirls round', cx, cy + 116, { size: 17, color: '#cfe8ff', halo: HALO });
  }
  if (T >= 6.5) {
    // A quasar: the disk outshines a whole galaxy of stars.
    const k = span(T, 6.5, 9);
    const gx = 600; const gy = 215;
    ctx.save(); ctx.globalAlpha = 0.85;
    for (const d of GALAXY_DOTS) { ctx.fillStyle = '#e8ecff'; ctx.fillRect(gx + d.x, gy + d.y, d.s, d.s); }
    ctx.restore();
    label(ctx, 'a galaxy', gx, gy + 92, { size: 16, color: '#cfe8ff', halo: HALO });
    glow(ctx, cx, cy, lerp(40, 110, k), 'rgba(255,230,160,0.95)');
    circle(ctx, cx, cy, 30, '#000000');
    if (T > 8.5) label(ctx, 'the quasar shines brighter than all its stars!', 400, 40, { size: 18, color: '#ffe27a', halo: HALO });
  }
  if (T >= 11.5) {
    label(ctx, 'Quasars are billions of light-years away.', 400, 380, { size: 19, color: '#fff', halo: HALO });
    label(ctx, 'Our galaxy’s middle has a black hole too. It is quiet.', 400, 414, { size: 16, color: '#cfe8ff', halo: HALO });
  }
}

// --- film 3: the star in the wrong place -------------------------------------------------------

const TRUE_BETA = 0.5; // the star's real offset from the hole (Einstein radii)

function drawLensing(ctx, T) {
  nightSky(ctx, 91);
  const cx = 400; const cy = 205; const RE = 120; // the Einstein radius on this picture
  const beta = lerp(TRUE_BETA, 0, span(T, 7, 11));
  const theta = (beta + Math.sqrt(beta * beta + 4)) / 2;
  // The star as it is (dashed) and as we see it (bright, on the same side, further out).
  if (T < 11) {
    ctx.save(); ctx.setLineDash([5, 7]); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx + beta * RE, cy, 9, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (T >= 3) {
    glow(ctx, cx + theta * RE, cy, 16, '#ffe9a8');
    if (T < 7) label(ctx, 'where it looks', cx + theta * RE, cy - 36, { size: 15, color: '#ffe9a8', halo: HALO });
  }
  if (T < 3) label(ctx, 'where it really is', cx + TRUE_BETA * RE, cy - 36, { size: 15, color: '#cfe8ff', halo: HALO });
  // The hole, with a ring of light round it once the star lines up.
  circle(ctx, cx, cy, 36, 'rgba(255,190,90,0.35)');
  circle(ctx, cx, cy, 22, '#000000');
  if (beta < 0.12) {
    ctx.save(); ctx.strokeStyle = `rgba(255,236,170,${1 - beta / 0.12})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, RE, 0, TAU); ctx.stroke(); ctx.restore();
    label(ctx, 'an Einstein ring of light!', cx, cy + 170, { size: 19, color: '#ffe27a', halo: HALO });
  }
  if (T > 3 && T < 7) label(ctx, 'gravity bends its light: pushed away from the hole', cx, cy + 170, { size: 18, color: '#fff', halo: HALO });
}

export const LESSON_7D = {
  id: 'ch7_black_hole',
  eyebrow: ['Black holes and quasars', 'Black holes'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: find where the stars really are.', 'Next: find the real star!'],
  films: [
    {
      title: ['Why a black hole is black', 'Why it is black'],
      beats: [
        { dur: 2, cap: ['A star like our Sun is so big, it could hold more than a million Earths.', 'A star like our Sun is huge. It holds a million Earths!'] },
        { dur: 4, cap: ['A black hole is a star squeezed into a tiny ball: all its stuff in a very small space.', 'A black hole is a big star squished into a tiny ball.'] },
        { dur: 4.5, cap: ['Its pull is so strong that even light cannot get out. Light is the fastest thing there is!', 'Its pull is so strong that light cannot get out.'] },
        { dur: 3.5, cap: ['No light comes out, so all we can see is a black shadow.', 'No light comes out. It looks black.'] },
      ],
      draw: drawBlack,
      question: {
        prompt: ['Why is a black hole black?', 'Why is a black hole black?'],
        choices: [
          { text: ['Its pull is so strong that light cannot get out', 'Its pull is so strong light cannot get out'], correct: true },
          { text: ['It is painted black, like the dark night sky and empty space', 'It is painted black like the dark night sky'] },
          { text: ['It is too cold to shine at all', 'It is too cold to shine'] },
        ],
        hint: ['Think about what light has to do to escape from it.', 'What can light not do here?'],
        why: ['Light cannot get out of a black hole, so nothing comes back to our eyes but the dark.', 'Light cannot get out, so the hole looks black!'],
      },
      clue: [null, 'Light cannot get out, so it looks black.'],
    },
    {
      title: ['Why the disk glows', 'Why it glows'],
      beats: [
        { dur: 2.5, cap: ['Gas falls towards a black hole and swirls round it in a disk, like water going down a drain.', 'Gas swirls round a black hole, like water down a drain.'] },
        { dur: 4, cap: ['The gas rubs against itself as it swirls, so it heats up to millions of degrees. Hot gas glows.', 'The gas rubs and gets very hot. Hot things glow!'] },
        { dur: 5, cap: ['A quasar is a black hole eating gas like this. Its disk can shine brighter than all the stars of its galaxy!', 'A quasar is a black hole eating gas. It shines brighter than a whole galaxy!'] },
        { dur: 5, cap: ['Real quasars are billions of light-years away, in other galaxies. Our galaxy’s middle has a black hole, but it is quiet.', 'Real quasars are billions of light-years away. Ours is quiet.'] },
      ],
      draw: drawGlow,
      question: {
        prompt: ['Why does the gas in the disk glow so brightly?', 'Why does the gas glow?'],
        choices: [
          { text: ['It rubs as it swirls, so it gets millions of degrees hot', 'It rubs and gets very hot'], correct: true },
          { text: ['The black hole is on fire, the way wood burns in a campfire', 'The black hole is on fire like wood'] },
          { text: ['Sunlight bounces off it from far away', 'Sunlight bounces off it'] },
        ],
        hint: ['What happens to things when they rub together, like your hands?', 'Rubbing makes heat. Hot things glow.'],
        why: ['As the gas swirls it rubs and heats up to millions of degrees. Hot gas glows, and a quasar’s disk can outshine a whole galaxy.', 'Rubbing makes it hot, and hot gas glows!'],
      },
      clue: [null, 'The gas rubs and gets very hot, so it glows.'],
    },
    {
      title: ['Why the stars look in the wrong place', 'The star in the wrong place'],
      watchOnly: true,
      beats: [
        { dur: 3, cap: ['Light from a star behind a black hole has to go round it. Gravity bends light!', 'Gravity bends light, even round a black hole.'] },
        { dur: 4, cap: ['So the star looks pushed away from the hole. It is not quite where it looks.', 'The star looks pushed away from the hole.'] },
        { dur: 4, cap: ['Move the star exactly behind the hole, and its light goes all the way round: a ring of light.', 'Lined up exactly, the light makes a ring!'] },
        { dur: 3, cap: ['That ring is an Einstein ring. Can you find where the stars really are?', 'That is a ring of light. Can you find the real star?'] },
      ],
      draw: drawLensing,
      clue: [null, 'Gravity bends light: the star looks pushed away from the hole.'],
    },
  ],
};
