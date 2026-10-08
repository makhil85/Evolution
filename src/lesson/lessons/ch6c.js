// Chapter 6, lesson 6C: How fast is light? (after the fusion drive lights,
// when km/s stops being a useful number). Each film draws on the 800x450
// stage from src/lesson/draw.js; T is authored seconds.
//
// Three films:
//   1. Light laps Earth about 7 times in one second (300,000 km/s against
//      Earth's 40,000 km round; the clock runs in slow motion).
//   2. The ship's speed bar beside light's: after the slingshots it is a
//      sliver (about 50 km/s); the drive pushes for years and it grows to
//      30,000 km/s, one tenth of light. The dial switches to "10% of light".
//   3. The nearest star, about 4 light years away: light takes 4 years, the
//      ship at 10% takes 10 times as long, 40 years. One teaser line: at
//      speeds like this clocks tick a little slower (a later chapter).
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version.
import { span, lerp, label, circle, rect, line, nightSky } from '../draw.js';

const TAU = Math.PI * 2;
// Her speed after the slingshots (km/s): the best slingshot-only plan with
// 100 t of fuel, past all four big planets (routes.js bestPlan('jsun', 100)
// gives 52). The Sun dive is a burn, not a slingshot, so it is not used here.
const START_KMS = 52;

function earth(ctx, x, y, r) {
  circle(ctx, x, y, r, '#3f8fe0', '#bfe3ff', 1.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#4fb35c';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.2, r * 0.35, r * 0.5, 0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.3, r * 0.3, r * 0.25, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

function glow(ctx, x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// --- film 1: seven times round Earth in one second ------------------------------------------

const LAP_START = 2; const LAP_END = 12; // authored seconds for the slow-motion "one second"
const LAPS = 7.5;

function drawLaps(ctx, T) {
  nightSky(ctx, 101);
  const cx = 330; const cy = 235; const R = 120;
  earth(ctx, cx, cy, R - 14);
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,170,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
  const k = Math.max(0, Math.min(1, (T - LAP_START) / (LAP_END - LAP_START)));
  const ang = -Math.PI / 2 + k * LAPS * TAU;
  // a short streak behind the beam
  for (let i = 0; i < 14; i++) {
    const a = ang - i * 0.07;
    ctx.save(); ctx.globalAlpha = 1 - i / 14;
    circle(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5 - i * 0.3, '#fff3b0');
    ctx.restore();
  }
  glow(ctx, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 18, '#ffe27a');
  // the clock and the lap count
  const laps = Math.floor(k * LAPS);
  label(ctx, `${(k * 1).toFixed(2)} s`, 620, 120, { size: 40, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, '(slow motion)', 620, 155, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, `Laps: ${laps}`, 620, 220, { size: 30, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  if (T > LAP_END) {
    label(ctx, 'About 7 times round', 620, 290, { size: 20, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
    label(ctx, 'in ONE second!', 620, 318, { size: 20, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  }
  if (T > LAP_END + 2) label(ctx, 'Light: 300,000 km every second', 400, 420, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 2: the ship's speed against light's --------------------------------------------------

function dial(ctx, x, y, T) {
  // A round speed dial whose text switches from km/s to % of light.
  circle(ctx, x, y, 70, '#141e36', '#7fd3ff', 4);
  const sw = span(T, 18.5, 20);
  const kms = Math.round(lerp(START_KMS, 30000, span(T, 8, 14)));
  ctx.save(); ctx.globalAlpha = 1 - sw;
  label(ctx, kms.toLocaleString('en-US'), x, y - 6, { size: 24, color: '#fff', halo: null });
  label(ctx, 'km/s', x, y + 20, { size: 15, color: '#cfe8ff', halo: null });
  ctx.restore();
  ctx.save(); ctx.globalAlpha = sw;
  label(ctx, '10%', x, y - 6, { size: 30, color: '#9fe8a8', halo: null });
  label(ctx, 'of light speed', x, y + 22, { size: 13, color: '#cfe8ff', halo: null });
  ctx.restore();
}

function drawSpeedBars(ctx, T) {
  nightSky(ctx, 103);
  const x0 = 60; const w = 520;
  label(ctx, 'Light', x0, 90, { size: 18, color: '#ffe27a', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  rect(ctx, x0, 102, w, 26, '#ffe27a', 6);
  label(ctx, '300,000 km/s', x0 + w - 4, 90, { size: 15, color: '#ffe27a', halo: 'rgba(0,0,0,0.6)', align: 'right' });
  const kms = lerp(START_KMS, 30000, span(T, 8, 14));
  label(ctx, 'Our ship', x0, 180, { size: 18, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  rect(ctx, x0, 192, w, 26, 'rgba(255,255,255,0.1)', 6);
  rect(ctx, x0, 192, Math.max(2, (w * kms) / 300000), 26, '#7fd3ff', 6);
  if (T > 2 && T < 8.5) {
    line(ctx, x0 + 2, 230, x0 + 30, 262, '#ffffff', 2);
    label(ctx, 'after the slingshots: about 50 km/s. Can you even see it?', x0 + 34, 272, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  }
  // years of the drive pushing
  if (T > 7.5) {
    const yrs = Math.round(lerp(0, 3, span(T, 8, 14)));
    label(ctx, `Fusion drive on: ${yrs} ${yrs === 1 ? 'year' : 'years'} of pushing`, x0, 300, { size: 17, color: '#ffb347', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  }
  if (T > 14) {
    line(ctx, x0 + w / 10, 186, x0 + w / 10, 226, '#9fe8a8', 3);
    label(ctx, '1/10 of light', x0 + w / 10 + 8, 246, { size: 15, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  }
  dial(ctx, 690, 200, T);
  if (T > 20) label(ctx, 'km/s numbers get too big: say “percent of light”', 400, 410, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 3: to the nearest star ------------------------------------------------------------------

function drawNearestStar(ctx, T) {
  nightSky(ctx, 107);
  const sx = 70; const tx = 730; const y = 150;
  glow(ctx, sx, y, 40, '#ffc34d');
  label(ctx, 'the Sun', sx, y + 46, { size: 15, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  glow(ctx, tx, y, 30, '#ffe0b0');
  label(ctx, 'nearest star', tx, y + 40, { size: 15, color: '#ffe0b0', halo: 'rgba(0,0,0,0.6)' });
  line(ctx, sx + 30, y + 70, tx - 30, y + 70, 'rgba(255,255,255,0.4)', 2, [4, 6]);
  label(ctx, 'about 4 light years', (sx + tx) / 2, y + 88, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  // light: 4 years
  const kl = span(T, 2, 6);
  glow(ctx, lerp(sx + 30, tx - 30, kl), y, 12, '#ffe27a');
  label(ctx, `light: ${Math.round(kl * 4)} years`, 160, 300, { size: 20, color: '#ffe27a', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  // the ship at 10%: ten times as long
  if (T > 10) {
    const ks = span(T, 10.5, 16.5);
    const x = lerp(sx + 30, tx - 30, ks);
    ctx.save(); ctx.fillStyle = '#a9a39a'; ctx.beginPath(); ctx.ellipse(x, y + 26, 10, 7, 0, 0, TAU); ctx.fill(); ctx.restore();
    label(ctx, `our ship at 10%: ${Math.round(ks * 40)} years`, 160, 340, { size: 20, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  }
  if (T > 16) label(ctx, '10 times slower than light = 10 × 4 = 40 years', 400, 385, { size: 18, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  if (T > 17) label(ctx, 'Teaser: this fast, clocks on the ship tick a tiny bit slower. More in a later chapter!', 400, 420, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
}

export const LESSON_6C = {
  id: 'ch6_light',
  eyebrow: ['How fast is light?', 'How fast is light?'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: watch the dial. From now on our speed is in percent of light.', 'Next: watch the speed dial!'],
  films: [
    {
      title: ['Seven times round the Earth', '7 times round the Earth'],
      beats: [
        { dur: 2, cap: ['Light is the fastest thing there is. Let’s race it round the Earth.', 'Light is the fastest thing. Watch it go round the Earth.'] },
        { dur: 5, cap: ['We slow the clock right down. Count the laps...', 'We slow the clock down. Count the laps!'], predict: true },
        { dur: 5, cap: ['...three, four, five, six, seven...', '3, 4, 5, 6, 7...'] },
        { dur: 4, cap: ['About 7 times round the Earth in ONE second: 300,000 km every second.', 'Light goes round the Earth 7 times in 1 second!'] },
      ],
      draw: drawLaps,
      question: {
        prompt: ['About how many times can light go round the Earth in one second?', 'How many times does light go round the Earth in 1 second?'],
        choices: [
          { text: ['About once', 'About 1 time'] },
          { text: ['About 7 times', 'About 7 times'], correct: true },
          { text: ['About 700 times', 'About 700 times'] },
        ],
        hint: ['What did the lap counter say when the clock reached 1 second?', 'Look at the lap counter.'],
        why: ['Earth is about 40,000 km round, and light goes 300,000 km in a second: 300,000 ÷ 40,000 is about 7.', 'About 7 times! Light is super fast.'],
      },
      clue: [null, 'About 7 times round.'],
    },
    {
      title: ['Our speed, next to light', 'Our speed next to light'],
      beats: [
        { dur: 2.5, cap: ['Here is light’s speed as a bar. Now our ship’s, after all those slingshots.', 'This bar is light. This one is our ship.'] },
        { dur: 5, cap: ['About 50 km/s: so fast on Earth, but next to light it is a tiny sliver.', 'Our ship is fast, but next to light it is tiny!'] },
        { dur: 6.5, cap: ['The fusion drive pushes day and night, for years. The bar grows...', 'The engine pushes for years. The bar grows...'] },
        { dur: 4, cap: ['...to 30,000 km/s: one tenth of light’s bar.', '...to one tenth of light!'] },
        { dur: 4, cap: ['Numbers this big are hard to read, so the dial switches: 10% of light speed.', 'Now the dial says: 10% of light speed.'] },
      ],
      draw: drawSpeedBars,
      question: {
        prompt: ['Light goes 300,000 km/s. Our ship goes 30,000 km/s. What percent of light speed is that?', 'Our bar is 1 tenth of light’s bar. How many out of 100 is that?'],
        choices: [
          { text: ['1%', '1 out of 100'] },
          { text: ['10%', '10 out of 100'], correct: true },
          { text: ['30%', '30 out of 100'] },
        ],
        hint: ['How many 30,000s make 300,000?', '1 tenth is the same as how many out of 100?'],
        why: ['300,000 ÷ 30,000 = 10, so our speed is one tenth of light’s: 10 out of 100, or 10%.', '1 tenth is 10 out of 100!'],
      },
      clue: [null, 'One tenth is 10%.'],
    },
    {
      title: ['To the nearest star', 'To the nearest star'],
      beats: [
        { dur: 2.5, cap: ['The nearest star is so far that even light takes about 4 years to get there.', 'Even light takes 4 years to get to the nearest star.'] },
        { dur: 4, cap: ['We say it is 4 light years away.', 'It is 4 light years away.'] },
        { dur: 4, cap: ['Our ship goes at one tenth of light’s speed...', 'Our ship goes 10 times slower than light...'], predict: true },
        { dur: 6, cap: ['...so the trip takes 10 times as long: 10 × 4 = 40 years.', '...so it takes 10 × 4 = 40 years.'] },
        { dur: 4, cap: ['And this fast, something strange starts: clocks on the ship tick a tiny bit slower. That is for a later chapter!', 'This fast, clocks tick a bit slower. More later!'] },
      ],
      draw: drawNearestStar,
      question: {
        prompt: ['At 10% of light speed, about how long is the trip to the nearest star, 4 light years away?', 'At 10% of light speed, how long to the nearest star?'],
        choices: [
          { text: ['4 years', '4 years'] },
          { text: ['40 years', '40 years'], correct: true },
          { text: ['400 years', '400 years'] },
        ],
        hint: ['Light takes 4 years. We are 10 times slower than light.', 'Light takes 4 years. We are 10 times slower.'],
        why: ['Light takes 4 years; at a tenth of light’s speed it takes 10 times as long: 4 × 10 = 40 years.', '4 × 10 = 40 years!'],
      },
      clue: [null, 'It takes 40 years.'],
    },
  ],
};
