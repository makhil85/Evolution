// Chapter 7, lesson 7C: tiny life helps us (Part C, before the microbe and
// bone tasks). Lead's decision, 2026-10-08. Chapter 4 taught that living things
// are made of cells and that a cell splits in two (the leaf, the DNA recipe), so
// this lesson does not repeat it: it builds on it. Bacteria are single cells that
// split again and again (doubling); the recycler's helpers clean the water and
// feed the farm (Chapter 6's algae filter, now with microbes); yeast breathes out
// bubbles that make bread rise.
// Each film draws on the 800x450 stage from src/lesson/draw.js; T is authored
// seconds.
//
// Three films (one watch-only):
//   1. A bacterium is one cell. Every pretend hour it splits in two: 1, 2, 4, 8.
//      (question)
//   2. The recycler's microbes eat the dirt in the water, and their leftovers
//      become plant food. (watch only, a breather)
//   3. Yeast eats sugar and breathes out bubbles of carbon dioxide; the bubbles
//      get trapped in the dough, so bread rises. (question)
//
// Pitfalls carried: the last frame still shows the answer; labels sit beside the
// picture, not across it; every caption has a Level 1 version; no choice text is
// a bare number, and the right choice is never the uniquely longest one.
import { span, lerp, label, circle, line, rect, plainDark } from '../draw.js';

const TAU = Math.PI * 2;
const MICRO = '#8ff0a0';

/** One bacterium: a small wobbling cell with a bright spot. */
function cell(ctx, x, y, r, t, fill = MICRO) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU;
    const rr = r * (1 + 0.08 * Math.sin(a * 3 + t * 2.2));
    const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.22, 'rgba(255,255,255,0.7)');
}

// --- film 1: one cell splits again and again --------------------------------------------------

// Where the cells sit in the dish, in the order they appear (the first is the one we start with).
const DISH = [[400, 230], [352, 200], [452, 200], [352, 262], [452, 262], [400, 176], [400, 290], [322, 230]];

function drawDoubling(ctx, T) {
  plainDark(ctx);
  // the dish: a petri dish, seen from above
  circle(ctx, 400, 230, 165, '#1b2c4a', '#7fd3ff', 4);
  // one hour per 2.5 authored seconds: 1, 2, 4, 8 cells
  const hour = Math.min(3, Math.floor(T / 2.5));
  const n = 2 ** hour;
  for (let i = 0; i < n; i++) {
    const [x, y] = DISH[i];
    // a cell that has just split slides a little apart from its twin
    const k = hour > 0 && i >= 2 ** (hour - 1) ? span(T, hour * 2.5, hour * 2.5 + 1.2) : 1;
    const from = i >= 2 ** (hour - 1) ? DISH[i - 2 ** (hour - 1)] : [x, y];
    cell(ctx, lerp(from[0], x, k), lerp(from[1], y, k), 15, T + i);
  }
  label(ctx, `bacteria: ${n}`, 400, 420, { size: 24, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, `pretend hour ${hour}`, 650, 90, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
  if (T > 2.5) label(ctx, 'Each pretend hour: 2 times as many', 150, 90, { size: 18, color: '#ffe27a', halo: 'rgba(0,0,0,0.6)', align: 'left' });
}

// --- film 2: the recycler's helpers (watch only) -----------------------------------------------

function drawRecycler(ctx, T) {
  plainDark(ctx);
  // the tank with the microbes
  rect(ctx, 270, 120, 260, 190, 'rgba(120,200,255,0.18)', 16);
  rect(ctx, 274, 200, 252, 106, 'rgba(70,160,220,0.45)', 12);
  for (let i = 0; i < 16; i++) {
    const x = 300 + ((i * 53) % 210); const y = 230 + ((i * 37) % 70);
    cell(ctx, x + Math.sin(T + i) * 4, y, 6 + (i % 3), T + i);
  }
  // dirty water in from the left, clean water out on the right
  const flow = (T * 0.25) % 1;
  for (let i = 0; i < 5; i++) {
    const k = (flow + i / 5) % 1;
    circle(ctx, lerp(120, 270, k), 255, 5, '#8a6a3f');
    if (T > 8) circle(ctx, lerp(530, 680, k), 255, 5, '#7fd3ff');
  }
  label(ctx, 'dirty water', 150, 200, { size: 17, color: '#e7c9a0', halo: 'rgba(0,0,0,0.6)' });
  if (T > 8) label(ctx, 'clean water', 650, 200, { size: 17, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, 'microbes', 400, 100, { size: 17, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  // the leftovers go to a plant pot and it grows
  if (T > 13) {
    const g = span(T, 13, 17);
    rect(ctx, 330, 360, 140, 40, '#8a5a3a', 8);
    for (let i = -1; i <= 1; i++) {
      ctx.save(); ctx.globalAlpha = g;
      ctx.fillStyle = '#4fb35c';
      ctx.beginPath(); ctx.ellipse(400 + i * 28, 360 - 26 * g - (i === 0 ? 14 : 0), 14, 26 * g, i * 0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    line(ctx, 400, 300, 400, 360, '#8fd39a', 3);
    label(ctx, 'plant food', 400, 412, { size: 18, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  }
}

// --- film 3: yeast makes the bubbles that raise the bread -------------------------------------

function drawYeast(ctx, T) {
  plainDark(ctx);
  const rise = span(T, 3, 12);
  const sc = lerp(0.62, 1, rise);
  const cx = 400; const cy = 280;
  // the dough: a soft mound that grows as the bubbles fill it
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, 170 * sc, 110 * sc, 0, 0, TAU);
  ctx.fillStyle = '#e9d3a0'; ctx.fill();
  ctx.clip();
  // yeast cells, dotted through the dough
  for (let i = 0; i < 14; i++) {
    const x = cx - 150 + ((i * 71) % 300); const y = cy - 80 + ((i * 43) % 150);
    cell(ctx, x, y, 5, T + i, '#c9b06a');
  }
  // bubbles of carbon dioxide, rising
  if (T > 4) {
    for (let i = 0; i < 12; i++) {
      const k = ((T * 0.18 + i / 12) % 1);
      circle(ctx, cx - 140 + ((i * 53) % 280), cy + 90 - k * 170, 6 + (i % 3) * 2, 'rgba(255,255,255,0.75)', 'rgba(120,90,40,0.6)', 1.5);
    }
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(120,90,40,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, 170 * sc, 110 * sc, 0, 0, TAU); ctx.stroke(); ctx.restore();
  label(ctx, 'dough', 650, 300, { size: 18, color: '#e9d3a0', halo: 'rgba(0,0,0,0.6)' });
  if (T > 4) label(ctx, 'yeast bubbles', 110, 110, { size: 18, color: '#ffffff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  if (T > 12) label(ctx, 'Bubbles puff the dough up: it rises!', 400, 420, { size: 20, color: '#ffe27a', halo: 'rgba(0,0,0,0.6)' });
}

export const LESSON_7C = {
  id: 'ch7_tiny_life',
  eyebrow: ['Tiny life helps us', 'Tiny life'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: try it on the ship.', 'Next: try it!'],
  films: [
    {
      title: ['Splitting again and again', 'Splitting again and again'],
      beats: [
        { dur: 4, cap: ['A bacterium is a single cell: one tiny cell is a whole living thing.', 'A bacterium is one tiny cell.'] },
        { dur: 5, cap: ['Like the cells in the leaf, it splits in two. Bacteria do it on their own, and fast.', 'It splits in two, and fast.'] },
        { dur: 5, cap: ['Watch the count: it doubles every pretend hour.', 'Watch: it doubles every pretend hour.'] },
        { dur: 5, cap: ['Doubling again and again makes huge numbers, very fast.', 'Doubling makes big numbers fast!'] },
      ],
      draw: drawDoubling,
      question: {
        prompt: ['A bacterium splits in two every pretend hour. It starts as 1. How many are there after 3 pretend hours?', 'Start with 1 bacterium. It splits in two each pretend hour. How many after 3 pretend hours?'],
        choices: [
          { text: ['4 bacteria', '4 bacteria'] },
          { text: ['8 bacteria', '8 bacteria'], correct: true },
          { text: ['16 bacteria', '16 bacteria'] },
        ],
        hint: ['After two hours there are 4. Now split each one once more.', 'After 2 hours there are 4. Split them once more.'],
        why: ['1 becomes 2, then 4, then 8: doubling three times gives 8 bacteria.', '1, then 2, 4, 8: that is 8 bacteria.'],
      },
      clue: [null, 'Each pretend hour the number doubles: 1, 2, 4, 8.'],
    },
    {
      title: ['The recycler’s helpers', 'The recycler’s helpers'],
      watchOnly: true,
      beats: [
        { dur: 4, cap: ['On our ship, helpful microbes live in the recycler’s tanks.', 'Helpful microbes live in the recycler.'] },
        { dur: 5, cap: ['The used water comes in full of dirt. The microbes eat it, so the water gets clean.', 'Microbes eat the dirt in the water.'] },
        { dur: 4, cap: ['The clean water goes back round the loop, for the crew to drink.', 'Clean water goes back to us.'] },
        { dur: 6, cap: ['Their leftovers become plant food, so the farm grows. Tiny life helps the whole ship!', 'Leftovers become plant food!'] },
      ],
      draw: drawRecycler,
    },
    {
      title: ['Why bread rises', 'Why bread rises'],
      beats: [
        { dur: 4, cap: ['Yeast is a tiny living thing, a single cell, and it is great at making bread.', 'Yeast is a tiny living cell.'] },
        { dur: 5, cap: ['It eats the sugar in the dough and breathes out bubbles of gas, carbon dioxide.', 'Yeast eats sugar and makes bubbles.'] },
        { dur: 6, cap: ['The bubbles get trapped in the dough, so it puffs up. That is why bread rises!', 'Bubbles puff the dough up. Bread rises!'] },
      ],
      draw: drawYeast,
      question: {
        prompt: ['Why does bread rise?', 'Why does bread rise?'],
        choices: [
          { text: ['Yeast makes gas bubbles that puff up the dough', 'Yeast bubbles puff it up'], correct: true },
          { text: ['Yeast cooks the dough from the inside, like an oven', 'Yeast cooks the dough from inside'] },
          { text: ['The flour soaks up water and swells on its own', 'Flour soaks up water and swells'] },
        ],
        hint: ['Look for the bubbles in the dough.', 'Look for the bubbles.'],
        why: ['Yeast eats sugar and breathes out bubbles of carbon dioxide. The bubbles puff the dough up. Bakers use this every day.', 'Yeast makes bubbles, and the bubbles puff the dough up.'],
      },
      clue: [null, 'Yeast makes bubbles that puff up the dough.'],
    },
  ],
};
