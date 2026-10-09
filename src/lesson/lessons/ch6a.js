// Chapter 6, lesson 6A: A ship that is a tiny Earth (after the habitat is
// built). Each film draws on the 800x450 stage from src/lesson/draw.js; T is
// authored seconds.
//
// Three films:
//   1. The loop: the crew breathe out, the algae breathe it in and give
//      oxygen back; used water goes through the filters back to the tank.
//      Dots travel round the loop: nothing comes in from outside.
//   2. The shield: rays and dust go straight through a thin wall; metres of
//      rock stop them (each metre halves them: 100, 50, 25 ...).
//   3. The power: the drive's power flows out to every part of the loop.
//      Then one cable breaks: the lamps go dark, the algae stop, the air
//      bar falls. Every part needs every other part.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version.
import { span, lerp, label, circle, arrow, rect, line, kid, nightSky } from '../draw.js';

const TAU = Math.PI * 2;

function panel(ctx) {
  // The inside of the ship: a dark warm hall.
  const g = ctx.createLinearGradient(0, 0, 0, 450);
  g.addColorStop(0, '#1b2130'); g.addColorStop(1, '#2b2a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
}

function algaeTank(ctx, x, y, glow) {
  rect(ctx, x - 34, y - 70, 68, 120, 'rgba(200,240,255,0.18)', 12);
  rect(ctx, x - 28, y - 60 + 10, 56, 100, `rgba(${Math.round(60 + 40 * glow)},${Math.round(150 + 80 * glow)},${Math.round(80 + 20 * glow)},0.9)`, 10);
  rect(ctx, x - 40, y - 86, 80, 10, glow > 0.3 ? '#fff2c0' : '#4a4a4a', 4);
  for (let i = 0; i < 5; i++) circle(ctx, x - 16 + i * 8, y + 30 - ((i * 23) % 70), 3, 'rgba(255,255,255,0.6)');
}

function tank(ctx, x, y) {
  rect(ctx, x - 40, y - 50, 80, 100, '#4a86c0', 14);
  rect(ctx, x - 40, y - 10, 80, 60, '#6fb0ff', 14);
}

/** A dot moving round a closed path of points (k: 0..1 round). */
function along(pts, k) {
  const n = pts.length;
  const f = ((k % 1) + 1) % 1 * n;
  const i = Math.floor(f); const u = f - i;
  const a = pts[i]; const b = pts[(i + 1) % n];
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
}

// --- film 1: the loop -----------------------------------------------------------------------

function drawLoop(ctx, T) {
  panel(ctx);
  const crew = { x: 210, y: 250 }; const algae = { x: 590, y: 230 }; const filt = { x: 590, y: 400 }; const wtank = { x: 210, y: 400 };
  // the crew
  kid(ctx, crew.x - 30, crew.y + 40, { scale: 1.1, color: '#7fdc8a' });
  kid(ctx, crew.x + 30, crew.y + 40, { scale: 1.1, color: '#7fc8ff' });
  label(ctx, 'the crew', crew.x, crew.y - 70, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  algaeTank(ctx, algae.x, algae.y, 1);
  label(ctx, 'algae', algae.x, algae.y - 100, { size: 18, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  // Air loop: crew -> algae (breathed-out air, grey), algae -> crew (oxygen, blue).
  const a1 = span(T, 1, 2);
  if (a1 > 0) {
    ctx.save(); ctx.globalAlpha = a1;
    arrow(ctx, crew.x + 70, crew.y - 40, algae.x - 60, algae.y - 40, '#9aa6b4', 5);
    arrow(ctx, algae.x - 60, algae.y + 10, crew.x + 70, crew.y + 10, '#7fd3ff', 5);
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const k = ((T * 0.25 + i / 4) % 1);
      circle(ctx, lerp(crew.x + 70, algae.x - 60, k), lerp(crew.y - 40, algae.y - 40, k) - 10, 6, '#9aa6b4');
      circle(ctx, lerp(algae.x - 60, crew.x + 70, k), lerp(algae.y + 10, crew.y + 10, k) + 10, 6, '#7fd3ff');
    }
    if (T > 3) { label(ctx, 'breathed-out air', 400, 175, { size: 15, color: '#cfd6df', halo: 'rgba(0,0,0,0.6)' }); }
    if (T > 5) { label(ctx, 'oxygen', 400, 285, { size: 15, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)' }); }
  }
  // Water loop: crew -> filters -> tank -> crew.
  const a2 = span(T, 8, 9);
  if (a2 > 0) {
    ctx.save(); ctx.globalAlpha = a2;
    tank(ctx, wtank.x, wtank.y + 10);
    rect(ctx, filt.x - 60, filt.y - 20, 120, 50, '#b8a07a', 10);
    label(ctx, 'filters', filt.x, filt.y + 5, { size: 15, color: '#1d2433', halo: null });
    label(ctx, 'water tank', wtank.x, wtank.y + 70 > 440 ? 440 : wtank.y + 70, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
    const pts = [{ x: crew.x + 60, y: crew.y + 70 }, { x: filt.x - 60, y: filt.y }, { x: wtank.x + 40, y: wtank.y + 10 }, { x: crew.x, y: crew.y + 60 }];
    for (let i = 0; i < 6; i++) { const p = along(pts, T * 0.12 + i / 6); circle(ctx, p.x, p.y, 5, '#6fb0ff'); }
    ctx.restore();
  }
  if (T > 12) label(ctx, 'Round and round: nothing comes from outside', 400, 40, { size: 20, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
}

// --- film 2: the shield ----------------------------------------------------------------------

function drawShield(ctx, T) {
  nightSky(ctx, 61);
  const thin = { x: 260 }; const thick = { x: 560 };
  // left: a thin metal wall; right: thick rock.
  rect(ctx, thin.x - 6, 80, 12, 300, '#c9d1dc', 3);
  label(ctx, 'thin metal', thin.x, 400, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  for (let i = 0; i < 6; i++) rect(ctx, thick.x - 60 + i * 20, 80, 20, 300, i % 2 ? '#8a8178' : '#7a7168', 2);
  label(ctx, '6 m of rock', thick.x, 400, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  // Rays fly in from the left of each wall.
  const rays = 10;
  for (let i = 0; i < rays; i++) {
    const y = 100 + i * 28;
    const k = ((T * 0.35 + i * 0.13) % 1.2);
    // thin wall: they go straight through.
    const x1 = lerp(thin.x - 200, thin.x + 160, k);
    if (k < 1) { line(ctx, x1 - 18, y, x1, y, '#ff8a8a', 3); circle(ctx, x1, y, 3, '#ffd0d0'); }
    // rock: each 20 px layer stops half: the ray stops at layer (i % 6), and only one in 64 gets out.
    const stopAt = Math.min(6, Math.floor(Math.log2(rays / (i + 1)) + 1));
    const x2 = lerp(thick.x - 200, thick.x + 160, k);
    const wallStart = thick.x - 60;
    const maxX = wallStart + stopAt * 20;
    if (k < 1 && x2 < maxX) { line(ctx, x2 - 18, y, x2, y, '#ff8a8a', 3); circle(ctx, x2, y, 3, '#ffd0d0'); }
    if (k < 1 && x2 >= maxX && x2 < maxX + 30) circle(ctx, maxX, y, 6 * (1 - (x2 - maxX) / 30), 'rgba(255,210,122,0.8)');
  }
  if (T > 6) label(ctx, 'goes straight through', thin.x + 90, 60, { size: 15, color: '#ff8a8a', halo: 'rgba(0,0,0,0.6)' });
  if (T > 9) label(ctx, 'each metre stops half: 100 → 50 → 25 → 12 → 6 → 3 → 1.6', 400, 435, { size: 15, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  if (T > 12) label(ctx, 'stopped', thick.x + 90, 60, { size: 15, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 3: power to every part, then a break -------------------------------------------------

function drawPower(ctx, T) {
  panel(ctx);
  const core = { x: 400, y: 230 };
  const parts = [
    { x: 160, y: 120, name: 'lamps + algae', col: '#9fe8a8' },
    { x: 640, y: 120, name: 'water pumps', col: '#7fd3ff' },
    { x: 160, y: 360, name: 'farm lights', col: '#ff9fe0' },
    { x: 640, y: 360, name: 'heat', col: '#ffb347' },
  ];
  const broken = T > 11; // the cable to the lamps breaks
  // The core.
  const pulse = 0.5 + 0.5 * Math.sin(T * 4);
  circle(ctx, core.x, core.y, 46, `rgba(127,243,255,${0.35 + 0.25 * pulse})`);
  circle(ctx, core.x, core.y, 30, '#7ff3ff');
  label(ctx, 'fusion drive', core.x, core.y + 66, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  parts.forEach((p, i) => {
    const off = broken && i === 0;
    const k = span(T, 1 + i * 0.8, 2 + i * 0.8);
    if (k <= 0) return;
    const ex = lerp(core.x, p.x, 0.78); const ey = lerp(core.y, p.y, 0.78);
    if (off) {
      // the cable snaps: a gap with sparks
      line(ctx, core.x, core.y, lerp(core.x, ex, 0.45), lerp(core.y, ey, 0.45), '#2b2f38', 6);
      line(ctx, lerp(core.x, ex, 0.6), lerp(core.y, ey, 0.6), ex, ey, '#2b2f38', 6);
      for (let s = 0; s < 4; s++) circle(ctx, lerp(core.x, ex, 0.52) + Math.sin(T * 30 + s) * 8, lerp(core.y, ey, 0.52) + Math.cos(T * 27 + s) * 8, 2.5, '#ffd27a');
    } else {
      line(ctx, core.x, core.y, ex, ey, '#2b2f38', 6);
      for (let d = 0; d < 3; d++) { const u = ((T * 0.6 + d / 3) % 1) * k; circle(ctx, lerp(core.x, ex, u), lerp(core.y, ey, u), 4, '#7ff3ff'); }
    }
    rect(ctx, p.x - 70, p.y - 34, 140, 68, off ? '#3a3a3a' : p.col, 12);
    label(ctx, p.name, p.x, p.y, { size: 16, color: '#10161f', halo: null });
  });
  // The air bar: steady, then falling once the lamps are off.
  const air = broken ? Math.max(0.15, 1 - (T - 11) * 0.12) : 1;
  label(ctx, 'air', 400, 28, { size: 15, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  rect(ctx, 300, 40, 200, 14, 'rgba(255,255,255,0.15)', 7);
  rect(ctx, 300, 40, 200 * air, 14, air > 0.5 ? '#9fe8a8' : '#ff8a8a', 7);
  if (T > 14) label(ctx, 'one part breaks, and the rest soon run down', 400, 430, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
}

export const LESSON_6A = {
  id: 'ch6_tiny_earth',
  eyebrow: ['A ship that is a tiny Earth', 'A tiny Earth'],
  narrator: ['Mira (biologist)', 'Mira'],
  tryIt: ['Next: plan the route out of the solar system.', 'Next: plan the trip to the stars!'],
  films: [
    {
      title: ['Round and round', 'Round and round'],
      beats: [
        { dur: 3, cap: ['On Earth, plants and people share the air. In here, we do it on purpose.', 'On Earth, plants and people share the air.'] },
        { dur: 4, cap: ['We breathe out. The algae breathe it in...', 'We breathe out. The algae breathe it in...'], predict: true },
        { dur: 4, cap: ['...and give us oxygen back.', '...and give us air back!'] },
        { dur: 4, cap: ['Water goes round too: used, cleaned by the filters, back to the tank.', 'Water goes round too, and gets cleaned.'] },
        { dur: 3, cap: ['A closed loop: nothing comes in from outside, so nothing can be wasted.', 'Round and round. Nothing comes from outside.'] },
      ],
      draw: drawLoop,
      question: {
        prompt: ['Where does the crew’s fresh oxygen come from, out between the stars?', 'Where does our air come from?'],
        choices: [
          { text: ['The algae, breathing in the air we breathe out', 'The algae plants'], correct: true },
          { text: ['A big tank of air brought all the way from Earth', 'A tank from Earth'] },
          { text: ['Space, through the windows that let in the starlight', 'Space'] },
        ],
        hint: ['Follow the blue dots in the film.', 'Look where the blue dots come from.'],
        why: ['The algae take in the air we breathe out and give oxygen back, round and round, as the plants on Earth do.', 'The algae make our air!'],
      },
      clue: [null, 'The algae make our air.'],
    },
    {
      title: ['A wall of rock', 'A wall of rock'],
      beats: [
        { dur: 3, cap: ['Space is full of tiny fast rays and specks of dust.', 'Space has tiny fast rays.'] },
        { dur: 4, cap: ['A thin metal wall: they go straight through, and through us.', 'A thin wall: they go right through.'] },
        { dur: 4, cap: ['Six metres of rock: each metre stops half of what is left.', 'Thick rock: each metre stops half.'] },
        { dur: 4, cap: ['Hardly any get through. That is why the front of our ship is a thick cap of rock and ice.', 'Thick rock keeps us safe!'] },
      ],
      draw: drawShield,
      question: {
        prompt: ['Why does the front of our ship have a thick cap of rock?', 'Why is there thick rock at the front?'],
        choices: [
          { text: ['Metres of rock stop the rays a thin wall lets through', 'Thick rock stops the rays'], correct: true },
          { text: ['Rock is light, so it makes the ship go much faster', 'Rock is light'] },
          { text: ['It keeps the ship warm from the heat of the Sun, all day long', 'It is warm'] },
        ],
        hint: ['Which wall stopped the red rays?', 'Which wall stopped the rays?'],
        why: ['Each metre of rock halves the rays; six metres lets in fewer than 2 in 100. A thin wall stops almost none.', 'Thick rock stops the rays!'],
      },
      clue: [null, 'Thick rock stops the rays.'],
    },
    {
      title: ['Power to every part', 'Power for everything'],
      beats: [
        { dur: 3, cap: ['The fusion drive makes power for everything.', 'The engine makes power for everything.'] },
        { dur: 5, cap: ['Lamps for the algae, pumps for the water, lights for the farm, heat for us.', 'Lamps, pumps, farm lights and heat.'] },
        { dur: 3, cap: ['What happens if one cable breaks?', 'What if one cable breaks?'], predict: true },
        { dur: 4, cap: ['No lamps, so the algae stop. No algae, so the air runs low.', 'No lamps. No algae. Less air!'] },
        { dur: 4, cap: ['Every part needs every other part, just like on Earth. The crew must watch them all.', 'Every part needs the others!'] },
      ],
      draw: drawPower,
      question: {
        prompt: ['In the ship’s loop, what happens if one part breaks, like the lamps?', 'What if one part breaks?'],
        choices: [
          { text: ['The other parts soon run down too, with less air', 'The other parts stop too'], correct: true },
          { text: ['Nothing: the other parts carry on as before', 'Nothing happens'] },
          { text: ['The ship speeds up, and everything else keeps going', 'The ship goes faster'] },
        ],
        hint: ['Watch the air bar after the cable snaps.', 'Look at the air bar.'],
        why: ['The parts make a loop, so a break in one starves the next: lamps feed the algae, the algae feed the air.', 'Every part needs the others!'],
      },
      clue: [null, 'The other parts stop too.'],
    },
  ],
};
