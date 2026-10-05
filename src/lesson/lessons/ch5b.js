// Chapter 5, lesson 5B: Neptune (in orbit round it, before she heads out to
// the edge). Each film draws on the 800x450 stage from src/lesson/draw.js; T
// is authored seconds.
//
// Three films: how big (four Earths across); heavy but not crushing (17
// Earths of mass, but its cloud tops are four times further from the middle,
// so the pull there is only a little more than Earth's); and cold (−200 °C:
// its atoms crawl where Earth's jiggle).
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every string has a Level 1 version.
import { span, lerp, label, circle, arrow, rect, nightSky } from '../draw.js';

const TAU = Math.PI * 2;

/** Neptune: a deep blue ball with soft bands and a dark spot. */
function neptune(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#7fa6ff'); g.addColorStop(0.6, '#3d63d8'); g.addColorStop(1, '#1d327a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.globalAlpha = 0.18;
  for (const k of [-0.5, -0.15, 0.3, 0.6]) rect(ctx, x - r, y + k * r, r * 2, r * 0.07, '#bcd0ff');
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#16245c';
  ctx.beginPath(); ctx.ellipse(x - r * 0.25, y + r * 0.15, r * 0.16, r * 0.08, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Earth: blue with green land. */
function earth(ctx, x, y, r) {
  circle(ctx, x, y, r, '#3f8fe0', '#bfe3ff', 1.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#4fb35c';
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.2, r * 0.35, r * 0.5, 0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.3, r * 0.3, r * 0.25, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// --- film 1: four Earths across ---------------------------------------------------------

function drawFourEarths(ctx, T) {
  nightSky(ctx, 51);
  const R = 150; const cx = 400; const cy = 215;
  neptune(ctx, cx, cy, R);
  // Earths slide in one by one and line up across the middle.
  const er = R / 4 * 0.98;
  let n = 0;
  for (let i = 0; i < 4; i++) {
    const k = span(T, 3 + i * 1.6, 4.2 + i * 1.6);
    if (k <= 0) continue;
    n = i + 1;
    const tx = cx - R + er + i * er * 2; const ty = cy;
    const x = lerp(760, tx, k); const y = lerp(60, ty, k);
    earth(ctx, x, y, er);
  }
  if (n > 0) label(ctx, `${n} ${n === 1 ? 'Earth' : 'Earths'}`, cx, cy + R + 34, { size: 24, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  if (T > 10.5) {
    arrow(ctx, cx - R, cy - R - 18, cx + R, cy - R - 18, '#ffd27a', 4);
    arrow(ctx, cx + R, cy - R - 18, cx - R, cy - R - 18, '#ffd27a', 4);
    label(ctx, 'about 4 Earths wide', cx, cy - R - 40, { size: 20, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  }
  label(ctx, 'Neptune', 110, 60, { size: 22, color: '#9fbaff', halo: 'rgba(0,0,0,0.7)', alpha: span(T, 0.5, 1.5) });
}

// --- film 2: heavy but not crushing -------------------------------------------------------

/** A girl on bathroom scales; `kg` shown on the dial. */
function scales(ctx, x, y, kg, col) {
  rect(ctx, x - 46, y, 92, 18, '#e8ecf2', 6);
  rect(ctx, x - 20, y + 3, 40, 12, '#1d2433', 3);
  label(ctx, `${kg.toFixed(0)} kg`, x, y + 9, { size: 12, color: '#7fff9f', halo: null });
  // her, simply
  circle(ctx, x, y - 52, 11, '#ffd9b3', '#1d2433', 2);
  rect(ctx, x - 9, y - 41, 18, 26, col, 4);
  rect(ctx, x - 8, y - 15, 6, 15, '#334', 2); rect(ctx, x + 2, y - 15, 6, 15, '#334', 2);
}

function drawHeavyButNot(ctx, T) {
  nightSky(ctx, 53);
  // Part 1 (0-7.5): the balance, 17 Earths against Neptune.
  const p2 = span(T, 7.5, 9);
  ctx.save();
  ctx.globalAlpha = 1 - p2;
  if (p2 < 1) {
    const tip = span(T, 2, 4) * 0.12;
    const bx = 400; const by = 150;
    rect(ctx, bx - 6, by, 12, 190, '#c9d1dc', 3);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-tip);
    rect(ctx, -260, -5, 520, 10, '#c9d1dc', 4);
    ctx.restore();
    const ly = by - Math.sin(-tip) * 230; const ry = by + Math.sin(-tip) * 230;
    // left pan: 17 small Earths; right pan: Neptune
    for (let i = 0; i < 17; i++) {
      const col = i % 6; const row = Math.floor(i / 6);
      earth(ctx, 170 - 50 + col * 18, ly + 26 - row * 17 + (row % 2) * 2, 8);
    }
    neptune(ctx, 630, ry - 40, 52);
    rect(ctx, 100, ly + 34, 140, 6, '#c9d1dc', 3); rect(ctx, 560, ry + 14, 140, 6, '#c9d1dc', 3);
    label(ctx, '17 Earths', 170, ly + 66, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, 'Neptune', 630, ry + 46, { size: 20, color: '#9fbaff', halo: 'rgba(0,0,0,0.7)' });
    if (T > 4) label(ctx, 'They balance: Neptune has 17 times Earth’s mass', 400, 410, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  }
  ctx.restore();
  if (p2 <= 0) return;
  // Part 2: standing on each. Earth: radius 1, mass 1. Neptune: radius 4, mass 17.
  ctx.save();
  ctx.globalAlpha = p2;
  earth(ctx, 200, 340, 40);
  neptune(ctx, 560, 470, 160);
  const grow = span(T, 13, 16);
  const kgE = 30; const kgN = 30 + 4 * grow; // 17/16 of Earth, rounded up for the cloud tops (real: ~1.1x)
  scales(ctx, 200, 280, kgE, '#ff6fa8');
  scales(ctx, 560, 290, kgN, '#ff6fa8');
  label(ctx, 'on Earth', 200, 205, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
  label(ctx, 'on Neptune’s clouds', 560, 215, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
  // The distance to the middle: 1 for Earth, 4 for Neptune.
  if (T > 10) {
    arrow(ctx, 200, 300, 200, 336, '#ffd27a', 3);
    label(ctx, '1', 214, 318, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)', align: 'left' });
    arrow(ctx, 640, 310, 640, 448, '#ffd27a', 3);
    label(ctx, '4 times as far', 652, 370, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)', align: 'left' });
    label(ctx, 'to the middle', 652, 390, { size: 16, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)', align: 'left' });
  }
  if (T > 16) label(ctx, '17 times the mass, but 4 x 4 = 16 times weaker for distance', 400, 40, { size: 19, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  ctx.restore();
}

// --- film 3: cold means slow atoms -------------------------------------------------------

function atoms(ctx, x0, y0, w, h, T, speed, seed, col) {
  rect(ctx, x0, y0, w, h, 'rgba(255,255,255,0.05)', 10);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, h); ctx.restore();
  for (let i = 0; i < 18; i++) {
    // Spread out: six across, three down, each nudged off its grid spot.
    const nx = Math.sin(i * 12.99 + seed * 7.1) * 43758.5; const ny = Math.sin(i * 78.23 + seed * 3.7) * 12345.6;
    const ax = x0 + ((i % 6) + 0.5 + 0.5 * (nx - Math.floor(nx) - 0.5)) * (w / 6);
    const ay = y0 + (Math.floor(i / 6) + 0.5 + 0.5 * (ny - Math.floor(ny) - 0.5)) * (h / 3);
    // Each atom jiggles about its spot; how far and how fast depends on the heat.
    const jx = Math.sin(T * speed * (1.3 + (i % 5) * 0.21) + i) * speed * 2.2;
    const jy = Math.cos(T * speed * (1.1 + (i % 7) * 0.17) + i * 2) * speed * 2.2;
    circle(ctx, ax + jx, ay + jy, 8, col, 'rgba(255,255,255,0.7)', 1.5);
  }
}

function thermometer(ctx, x, y, level, text, col) {
  rect(ctx, x - 7, y - 120, 14, 120, '#e8ecf2', 7);
  rect(ctx, x - 4, y - 120 * level, 8, 120 * level, col, 4);
  circle(ctx, x, y + 8, 13, col, '#e8ecf2', 3);
  label(ctx, text, x, y + 40, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
}

function drawColdAtoms(ctx, T) {
  nightSky(ctx, 57);
  const show = span(T, 0.5, 1.5);
  ctx.save(); ctx.globalAlpha = show;
  label(ctx, 'On Earth', 230, 50, { size: 22, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  atoms(ctx, 90, 80, 280, 220, T, 6, 3, '#ffb347');
  thermometer(ctx, 40, 290, 0.6, '15 °C', '#ff6b4a');
  const nep = span(T, 4, 5);
  ctx.globalAlpha = nep;
  label(ctx, 'On Neptune', 570, 50, { size: 22, color: '#9fbaff', halo: 'rgba(0,0,0,0.7)' });
  atoms(ctx, 430, 80, 280, 220, T, 1.2, 3, '#7fa6ff');
  thermometer(ctx, 760, 290, 0.08, '−200 °C', '#5b7cff');
  ctx.restore();
  if (T > 9) label(ctx, 'Hot = atoms jiggle fast.  Cold = atoms crawl.', 400, 370, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  if (T > 13) label(ctx, 'Stop them completely: −273 °C, the coldest anything can be', 400, 410, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
}

export const LESSON_5B = {
  id: 'ch5_neptune',
  eyebrow: ['Neptune, the last giant', 'Neptune'],
  narrator: ['Mission Control', 'Mission Control'],
  tryIt: ['Next: past Neptune, out to the very edge of the Sun’s family.', 'Next: out to the edge of the Sun’s family!'],
  films: [
    {
      title: ['How big?', 'How big?'],
      beats: [
        { dur: 3, cap: ['This is Neptune. How big is it, compared with home?', 'This is Neptune. How big is it?'] },
        { dur: 7.5, cap: ['Let’s line Earths up across the middle: one, two, three, four...', 'Let’s line up Earths: 1, 2, 3, 4...'] },
        { dur: 4, cap: ['About four Earths fit across Neptune.', 'About 4 Earths fit across Neptune!'] },
      ],
      draw: drawFourEarths,
      question: {
        prompt: ['About how many Earths would fit side by side across Neptune?', 'How many Earths fit across Neptune?'],
        choices: [
          { text: ['About 1', 'About 1'] },
          { text: ['About 4', 'About 4'], correct: true },
          { text: ['About 40', 'About 40'] },
        ],
        hint: ['Count the Earths in the row.', 'Count the Earths.'],
        why: ['Neptune is about 4 times as wide as Earth: four Earths make a row across it.', 'About 4 Earths fit across!'],
      },
      clue: [null, 'About 4 Earths fit across.'],
    },
    {
      title: ['Heavy, but not crushing', 'Heavy, but not too heavy'],
      beats: [
        { dur: 4, cap: ['Put Neptune on a giant balance. It takes 17 Earths to balance it!', 'Neptune weighs as much as 17 Earths!'] },
        { dur: 3.5, cap: ['So would you feel 17 times heavier standing on its clouds?', 'Would you feel 17 times heavier there?'] },
        { dur: 4.5, cap: ['No! On Neptune’s clouds you are 4 times further from its middle.', 'No! You are much further from its middle.'] },
        { dur: 4, cap: ['Gravity gets weaker with distance: 4 times as far is 4 x 4 = 16 times weaker.', 'Far from the middle, gravity is weaker.'] },
        { dur: 4, cap: ['17 times stronger, 16 times weaker: you would feel only a little heavier than on Earth.', 'So you feel just a little heavier!'] },
      ],
      draw: drawHeavyButNot,
      question: {
        prompt: ['Neptune has 17 times the mass of Earth. How heavy would you feel on its cloud tops?', 'How heavy would you feel on Neptune?'],
        choices: [
          { text: ['17 times heavier', '17 times heavier'] },
          { text: ['About the same, just a little heavier', 'Just a little heavier'], correct: true },
          { text: ['Weightless, floating', 'Floating'] },
        ],
        hint: ['What did the scales say on Neptune?', 'Look at the scales.'],
        why: ['Its pull is 17 times bigger for its mass, but you are 4 times as far from its middle, which makes it 16 times weaker. 17 ÷ 16 is just over 1.', 'Just a little heavier than on Earth!'],
      },
      clue: [null, 'You feel just a little heavier.'],
    },
    {
      title: ['So cold the atoms crawl', 'Very, very cold'],
      beats: [
        { dur: 4, cap: ['Everything is made of tiny atoms, and they are never still. On Earth they jiggle fast.', 'Everything is made of tiny atoms. They jiggle.'] },
        { dur: 5, cap: ['Neptune is about −200 °C. Out here the atoms hardly move at all.', 'Neptune is very cold. Its atoms move slowly.'] },
        { dur: 4, cap: ['That is what hot and cold are: how fast the atoms move.', 'Hot = fast atoms. Cold = slow atoms.'] },
        { dur: 4, cap: ['Stop them completely and you reach −273 °C, the coldest anything can ever be.', 'Atoms that stop moving are the coldest.'] },
      ],
      draw: drawColdAtoms,
      question: {
        prompt: ['What does “cold” mean for the tiny atoms inside something?', 'What do atoms do when it is cold?'],
        choices: [
          { text: ['The atoms move slowly', 'They move slowly'], correct: true },
          { text: ['The atoms shrink', 'They get small'] },
          { text: ['The atoms turn blue', 'They turn blue'] },
        ],
        hint: ['Compare the atoms in the two boxes.', 'Look at the two boxes.'],
        why: ['Temperature is how fast atoms jiggle. In cold Neptune they crawl; in warm Earth they buzz about.', 'Cold atoms move slowly!'],
      },
      clue: [null, 'Cold atoms move slowly.'],
    },
  ],
};

