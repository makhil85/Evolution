// Chapter 5 lessons. Each film draws on the 800x450 stage from
// src/lesson/draw.js; T is authored seconds.
//
// 5A, "What are the rings?" (before the ring run): up close the rings are
// billions of ice chunks; each chunk is its own little moon (the inner ones go
// round faster); and a ring is what a moon becomes when it strays too close
// and Saturn's pull tears it apart.
//
// 5AA, "Bumps in the rings" (straight after the ring run): momentum. Five
// films, each paused before the crash so the child predicts first, then the
// crash in slow motion, with an arrow per chunk for mass x speed and one for
// the total (which never changes): same size, one still; small and big, both
// ways; a fast one catching a slow one (they stick); lots of pieces at once;
// and a spaceship, which has nothing to push on but what it throws out.
//
// Pitfalls carried from Chapters 1-4: the last frame must still show the
// answer (the question is asked over it); nothing leaves the stage at the end;
// labels sit beside the picture, not across it; every string has a Level 1 version.
import { span, lin, lerp, clamp, label, circle, arrow, nightSky, rocket, puffs, STAGE_W } from '../draw.js';

const TAU = Math.PI * 2;

/** A little pseudo-random generator, so every frame draws the same chunks. */
function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** Saturn, side-on: a banded ball with its rings as a flat ellipse. */
function saturn(ctx, x, y, r, { tilt = 0.22, rings = true, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const ringBack = () => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, tilt);
    for (const [rr, w, col] of [[r * 1.35, r * 0.18, 'rgba(214,196,160,0.75)'], [r * 1.72, r * 0.32, 'rgba(236,222,190,0.9)'], [r * 2.12, r * 0.22, 'rgba(206,190,156,0.8)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(0, 0, rr, Math.PI, TAU); ctx.stroke();
    }
    ctx.restore();
  };
  const ringFront = () => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, tilt);
    for (const [rr, w, col] of [[r * 1.35, r * 0.18, 'rgba(214,196,160,0.75)'], [r * 1.72, r * 0.32, 'rgba(236,222,190,0.95)'], [r * 2.12, r * 0.22, 'rgba(206,190,156,0.85)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI); ctx.stroke();
    }
    ctx.restore();
  };
  if (rings) ringBack();
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, '#e9d6a8'); g.addColorStop(0.35, '#d8b77c'); g.addColorStop(0.5, '#f0dcae');
  g.addColorStop(0.7, '#c99f62'); g.addColorStop(1, '#a9824e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (rings) ringFront();
  ctx.restore();
}

/** A lumpy ice chunk. */
function chunk(ctx, x, y, r, spin, fill = '#e8f3fb', stroke = '#9fb8cc') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) {
    const a = (i / 9) * TAU;
    const rr = r * (0.78 + 0.22 * Math.sin(i * 2.7 + r));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (r > 3) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.min(3, r * 0.15); ctx.stroke(); }
  ctx.restore();
}

// --- film 1: up close, a ring is billions of ice chunks --------------------------------

const F1_CHUNKS = (() => {
  const r = rng(11);
  return Array.from({ length: 140 }, () => ({ x: r() * 1.2 - 0.1, y: r(), s: Math.pow(r(), 3), sp: r() * TAU, v: 0.4 + r() * 0.3 }));
})();

function drawRingsUpClose(ctx, T) {
  nightSky(ctx, 5);
  const zoom = span(T, 3, 7.5); // 0: Saturn whole, 1: inside the ring
  // Saturn grows and slides away as we dive at the ring.
  const sx = lerp(400, -900, zoom); const sy = lerp(225, 120, zoom); const sr = lerp(70, 900, zoom * zoom);
  saturn(ctx, sx, sy, sr, { alpha: 1 - span(T, 6.2, 7.6) });
  if (T < 3.2) label(ctx, 'From far away the rings look solid, like a CD', 400, 400, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  // The chunks: drawn once the dive reaches the ring plane.
  const inside = span(T, 6, 8);
  if (inside > 0) {
    ctx.save();
    ctx.globalAlpha = inside;
    for (const c of F1_CHUNKS) {
      const px = ((c.x + T * 0.012 * c.v) % 1.2 - 0.1) * STAGE_W;
      const size = 2 + c.s * 46;
      const py = 70 + c.y * 300;
      chunk(ctx, px, py, size, c.sp + T * 0.3 * c.v);
    }
    ctx.restore();
    // A house beside the biggest chunk, for scale.
    const show = span(T, 10, 11.5);
    if (show > 0) {
      const big = F1_CHUNKS.reduce((a, b) => (b.s > a.s ? b : a));
      const bx = ((big.x + T * 0.012 * big.v) % 1.2 - 0.1) * STAGE_W; const by = 70 + big.y * 300;
      ctx.save();
      ctx.globalAlpha = show;
      const hx = clamp(bx + 70, 90, 700); const hy = clamp(by, 90, 360);
      ctx.fillStyle = '#ffcf7a'; ctx.fillRect(hx - 22, hy - 10, 44, 34);
      ctx.fillStyle = '#d0503c';
      ctx.beginPath(); ctx.moveTo(hx - 28, hy - 10); ctx.lineTo(hx, hy - 34); ctx.lineTo(hx + 28, hy - 10); ctx.closePath(); ctx.fill();
      label(ctx, 'a house', hx, hy + 40, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
      ctx.restore();
    }
    if (T > 8 && T < 10) label(ctx, 'Billions of pieces of ice!', 400, 410, { size: 24, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    if (T >= 10) label(ctx, 'From grains of sand to chunks as big as a house', 400, 410, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  }
}

// --- film 2: every chunk is its own little moon ----------------------------------------

function drawOrbitRace(ctx, T) {
  nightSky(ctx, 9);
  const cx = 400; const cy = 230;
  saturn(ctx, cx, cy, 44, { rings: false });
  // Faint ring band behind.
  ctx.save();
  ctx.strokeStyle = 'rgba(230,214,180,0.18)'; ctx.lineWidth = 120;
  ctx.beginPath(); ctx.arc(cx, cy, 130, 0, TAU); ctx.stroke();
  ctx.restore();
  // Two marked chunks race: inner (r=80) and outer (r=180). Speed ~ r^-1.5.
  const run = Math.max(0, T - 2.5);
  const w0 = 4; // the inner piece's turn rate x 0.6 (about 4 laps in the film)
  const racers = [
    { r: 80, col: '#ffb347' },
    { r: 185, col: '#7fd3ff' },
  ];
  // Lots of plain chunks too, each on its own circle at its own speed.
  const rnd = rng(3);
  for (let i = 0; i < 90; i++) {
    const r = 75 + rnd() * 115; const a0 = rnd() * TAU;
    const a = a0 - run * w0 * Math.pow(80 / r, 1.5) * 0.6;
    chunk(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92, 2 + rnd() * 3, a, '#d9e6ef');
  }
  const laps = [];
  for (const k of racers) {
    const w = w0 * Math.pow(80 / k.r, 1.5) * 0.6;
    const a = -Math.PI / 2 - run * w;
    // its orbit, dashed
    ctx.save(); ctx.setLineDash([6, 8]); ctx.strokeStyle = k.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, k.r, k.r * 0.92, 0, 0, TAU); ctx.stroke(); ctx.restore();
    const px = cx + Math.cos(a) * k.r; const py = cy + Math.sin(a) * k.r * 0.92;
    circle(ctx, px, py, 13, k.col, '#fff', 3);
    laps.push({ k, n: Math.floor((run * w) / TAU) });
  }
  // Lap counters beside the picture.
  if (T > 2.5) {
    label(ctx, `Inner laps: ${laps[0].n}`, 120, 60, { size: 22, color: '#ffb347', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, `Outer laps: ${laps[1].n}`, 680, 60, { size: 22, color: '#7fd3ff', halo: 'rgba(0,0,0,0.7)' });
  }
  if (T > 12) label(ctx, 'Closer to Saturn = stronger pull = faster', 400, 420, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
}

// --- film 3: too close, a moon is torn into a ring --------------------------------------

function drawTornMoon(ctx, T) {
  nightSky(ctx, 21);
  const cx = 200; const cy = 225; const R = 60;
  const ringR = 150; // where the new ring ends up (inside the break-up line)
  const lineX = cx + ringR + 22;
  const drift = span(T, 1, 6);
  const mx = lerp(700, cx + ringR, drift); const my = cy;
  const stretch = span(T, 5, 8.5);
  const torn = span(T, 8.5, 12);
  // The torn pieces, spreading round Saturn into a ring (seen a little from
  // above: the far half is drawn behind the planet, the near half in front).
  const pieces = [];
  if (torn >= 0.05) {
    const rnd = rng(17);
    for (let i = 0; i < 170; i++) {
      const a0 = rnd() * TAU; const rr = ringR - 14 + rnd() * 28; const sz = 1.5 + rnd() * 4.5;
      const ox0 = (rnd() - 0.5) * 50; const oy0 = (rnd() - 0.5) * 40;
      const a = (a0 - Math.PI) * torn; // from the moon's spot, out along the orbit both ways
      const ox = cx + Math.cos(a) * rr; const oy = cy + Math.sin(a) * rr * 0.3;
      const k = span(torn, 0, 0.5);
      pieces.push({ x: lerp(mx + ox0, ox, k), y: lerp(my + oy0, oy, k), sz, back: Math.sin(a) < 0, a0 });
    }
  }
  for (const pc of pieces) if (pc.back) chunk(ctx, pc.x, pc.y, pc.sz, pc.a0 + T, '#cfdbe6');
  saturn(ctx, cx, cy, R, { rings: false });
  for (const pc of pieces) if (!pc.back) chunk(ctx, pc.x, pc.y, pc.sz, pc.a0 + T, '#e3edf5');
  // The break-up line (where Saturn's pull tears a moon apart).
  ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(lineX, 40); ctx.lineTo(lineX, 410); ctx.stroke(); ctx.restore();
  label(ctx, 'Too close!', lineX - 60, 50, { size: 18, color: '#ff8a8a', halo: 'rgba(0,0,0,0.7)' });
  label(ctx, 'Safe', lineX + 40, 50, { size: 18, color: '#9fe8a8', halo: 'rgba(0,0,0,0.7)' });
  if (torn < 0.05) {
    // The moon, stretched into an egg toward Saturn.
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(1 + stretch * 0.6, 1 - stretch * 0.25);
    const g = ctx.createRadialGradient(-6, -6, 4, 0, 0, 30);
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#a8b6c4');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    if (stretch > 0.6) { ctx.strokeStyle = '#6f7f90'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(4, 2); ctx.lineTo(-4, 22); ctx.stroke(); }
    ctx.restore();
    // Tide arrows, over the moon: Saturn pulls the near side harder than the far side.
    if (T > 3.5) {
      const w = 30 * (1 + stretch * 0.6);
      const near = lerp(40, 64, stretch); const far = lerp(16, 20, stretch);
      arrow(ctx, mx - w + 4, my, mx - w + 4 - near, my, '#ffb347', 7);
      arrow(ctx, mx + w - 4, my, mx + w - 4 - far, my, '#ffb347', 5);
      label(ctx, 'big pull', mx - w - 30, my - 30, { size: 16, color: '#ffd59a', halo: 'rgba(0,0,0,0.7)' });
      label(ctx, 'small pull', mx + w + 6, my - 30, { size: 16, color: '#ffd59a', halo: 'rgba(0,0,0,0.7)' });
    }
  }
  if (torn >= 1) label(ctx, 'A ring is born!', 400, 410, { size: 24, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  // A real moon far out stays round.
  circle(ctx, 640, 120, 14, '#c9d1dc', '#8a96a6', 2);
  label(ctx, 'A moon out here stays round', 640, 150, { size: 15, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)', alpha: lin(T, 1, 2) });
}

export const LESSON_5A = {
  id: 'ch5_rings',
  eyebrow: ['What are Saturn’s rings?', 'Saturn’s rings'],
  narrator: ['Mission Control', 'Mission Control'],
  tryIt: ['Fly through the ring run: dodge the big chunks and blast the ice!', 'Fly through the rings! Dodge the big ice and blast it!'],
  films: [
    {
      title: ['Up close', 'Look closer'],
      beats: [
        { dur: 3, cap: ['From far away, Saturn’s rings look like one flat, solid disc.', 'From far away the rings look solid.'] },
        { dur: 4.5, cap: ['Let’s fly in and look closer...', 'Let’s fly closer...'] },
        { dur: 2.5, cap: ['They are not solid at all! They are billions of pieces of ice.', 'They are not solid! They are lots and lots of ice.'] },
        { dur: 4, cap: ['Some are tiny grains, some are as big as a house. Each one floats on its own.', 'Some ice is tiny. Some is as big as a house.'] },
      ],
      draw: drawRingsUpClose,
      question: {
        prompt: ['What are Saturn’s rings made of?', 'What are the rings made of?'],
        choices: [
          { text: ['One huge flat disc of solid rock', 'One big flat rock'] },
          { text: ['Billions of separate pieces of ice', 'Lots of pieces of ice'], correct: true },
          { text: ['Thin coloured gas, like a cloud', 'Coloured gas'] },
        ],
        hint: ['What did you see when we flew right into the ring?', 'What did you see up close?'],
        why: ['Up close the rings are billions of ice chunks, each floating on its own, from tiny grains to house-sized lumps.', 'The rings are lots of pieces of ice!'],
      },
      clue: [null, 'The rings are lots of pieces of ice.'],
    },
    {
      title: ['Little moons', 'Tiny moons'],
      beats: [
        { dur: 2.5, cap: ['Every piece of ice goes round Saturn on its own, like a tiny moon.', 'Each piece of ice goes round Saturn like a tiny moon.'] },
        { dur: 5, cap: ['Watch two pieces: one close to Saturn, one further out. Count their laps.', 'Watch the two pieces. Count the laps.'] },
        { dur: 5, cap: ['The close one laps the far one again and again!', 'The close one goes round more times!'] },
        { dur: 3.5, cap: ['Closer to Saturn the pull is stronger, so the piece must go faster to keep from falling in.', 'Close to Saturn, things go faster.'] },
      ],
      draw: drawOrbitRace,
      question: {
        prompt: ['Which pieces of the rings go round Saturn fastest?', 'Which pieces go round fastest?'],
        choices: [
          { text: ['The ones closest to Saturn', 'The close ones'], correct: true },
          { text: ['The ones furthest from Saturn', 'The far ones'] },
          { text: ['They all go round at the same speed', 'All the same'] },
        ],
        hint: ['Which piece had more laps on its counter?', 'Which one had more laps?'],
        why: ['Saturn pulls hardest on the closest pieces, so they must go fastest to stay in orbit: the inner piece lapped the outer one.', 'The close pieces go fastest!'],
      },
      clue: [null, 'The close pieces go round fastest.'],
    },
    {
      title: ['How a ring is born', 'Where rings come from'],
      beats: [
        { dur: 3, cap: ['Long ago a small icy moon may have drifted too close to Saturn.', 'Long ago an icy moon came too close to Saturn.'] },
        { dur: 3, cap: ['Saturn pulls the near side of the moon harder than the far side.', 'Saturn pulls the near side harder.'] },
        { dur: 3, cap: ['The moon is stretched like an egg... until it cracks.', 'The moon stretches... and cracks!'] },
        { dur: 4, cap: ['The pieces spread all the way round Saturn: a ring is born!', 'The pieces go all the way round. A ring!'] },
      ],
      draw: drawTornMoon,
      question: {
        prompt: ['Why is there a ring there, and not one big moon?', 'Why is there a ring and not a moon?'],
        choices: [
          { text: ['Saturn pulls the near side harder, so a moon that close is torn apart', 'Saturn pulls a close moon apart'], correct: true },
          { text: ['The ice there is too cold to stick together into a ball', 'It is too cold'] },
          { text: ['The Sun’s heat melted the moon and it froze in a circle', 'The Sun melted it'] },
        ],
        hint: ['Look at the two orange arrows on the moon. Which was bigger?', 'Look at the arrows. Which one is bigger?'],
        why: ['So close to Saturn its pull is much stronger on the near side than the far side. That stretch tears a moon apart, and the pieces spread into a ring.', 'Saturn pulls the close side harder. The moon breaks into a ring.'],
      },
      clue: [null, 'Saturn pulls a moon that comes too close apart.'],
    },
  ],
};

// --- 5AA: momentum ------------------------------------------------------------------------

/**
 * Sim time at authored time T, from a list of [fromT, rate] pieces: rate 0
 * holds the picture still (a predict pause), 0.3 is slow motion.
 */
function simClock(T, pieces) {
  let sim = 0;
  for (let i = 0; i < pieces.length; i++) {
    const [a, rate] = pieces[i];
    const b = i + 1 < pieces.length ? pieces[i + 1][0] : Infinity;
    if (T <= a) break;
    sim += (Math.min(T, b) - a) * rate;
  }
  return sim;
}
const isSlow = (T, pieces) => pieces.some(([a, rate], i) => rate > 0 && rate < 1 && T >= a && T < (pieces[i + 1]?.[0] ?? Infinity));
const isHeld = (T, pieces) => pieces.some(([a, rate], i) => rate === 0 && a > 0 && T >= a && T < (pieces[i + 1]?.[0] ?? Infinity));

const V = 15; // pixels a second per "speed 1"
const chunkR = (m) => 24 * Math.cbrt(m);

/**
 * Two chunks on a line: a and b are {m, x, v} (v in speed units), after is
 * their speeds once they touch. Returns where each is at sim time s.
 */
function crash(a, b, after) {
  const ra = chunkR(a.m); const rb = chunkR(b.m);
  const sHit = ((b.x - a.x) - ra - rb) / ((a.v - b.v) * V);
  const ha = a.x + a.v * V * sHit; const hb = b.x + b.v * V * sHit;
  return {
    sHit,
    at(s) {
      if (s < sHit) return [{ x: a.x + a.v * V * s, v: a.v }, { x: b.x + b.v * V * s, v: b.v }];
      return [{ x: ha + after[0] * V * (s - sHit), v: after[0] }, { x: hb + after[1] * V * (s - sHit), v: after[1] }];
    },
  };
}

const ORANGE = '#ffb347'; const BLUE = '#7fd3ff';

/** The momentum arrows: one row per chunk, then the total. k = pixels per unit. */
function momentumRows(ctx, rows, { x = 420, y = 300, k = 26 } = {}) {
  label(ctx, 'mass × speed', 90, y - 34, { size: 16, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  const all = [...rows, { name: 'Total', col: '#ffffff', p: rows.reduce((t, r) => t + r.p, 0) }];
  all.forEach((r, i) => {
    const yy = y + i * 34 + (i === all.length - 1 ? 10 : 0);
    if (i === all.length - 1) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(90, yy - 22); ctx.lineTo(710, yy - 22); ctx.stroke(); ctx.restore(); }
    label(ctx, r.name, 200, yy, { size: 17, color: r.col, halo: 'rgba(0,0,0,0.6)', align: 'right' });
    const v = Math.round(r.p * 10) / 10;
    if (Math.abs(r.p * k) < 4) circle(ctx, x, yy, 4, r.col);
    else arrow(ctx, x, yy, x + r.p * k, yy, r.col, i === all.length - 1 ? 9 : 7);
    label(ctx, String(v), x + r.p * k + (r.p >= 0 ? 22 : -22), yy, { size: 16, color: r.col, halo: 'rgba(0,0,0,0.6)' });
  });
}

/** The crash scene: the chunks, their speeds above them, and the slow-mo/predict tags. */
function drawCrash(ctx, T, pieces, objs, states, { y = 160, seed = 31 } = {}) {
  nightSky(ctx, seed);
  ctx.save(); ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(780, y); ctx.stroke(); ctx.restore();
  objs.forEach((o, i) => {
    const st = states[i];
    const r = chunkR(o.m);
    chunk(ctx, st.x, y, r, o.spin || i, o.fill || '#e8f3fb');
    circle(ctx, st.x, y, 5, o.col);
    const side = i === 0 ? -1 : 1;
    const al = i === 0 ? 'right' : 'left';
    label(ctx, `mass ${o.m}`, st.x + side * 4, y + r + 18, { size: 14, color: o.col, halo: 'rgba(0,0,0,0.6)', align: al });
    const sp = Math.round(st.v * 10) / 10;
    label(ctx, `speed ${sp}`, st.x + side * 4, y - r - 18, { size: 15, color: '#ffffff', halo: 'rgba(0,0,0,0.6)', align: al });
  });
  if (isSlow(T, pieces)) label(ctx, '◀◀ slow motion', 690, 36, { size: 17, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  if (isHeld(T, pieces)) label(ctx, '? What will happen ?', 400, 60, { size: 26, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
}

// Film 1: same size, one still. Orange (speed 2) hits blue (still): orange stops, blue goes.
const F1A = { m: 1, x: 200, v: 2, col: ORANGE, name: 'Orange' };
const F1B = { m: 1, x: 430, v: 0, col: BLUE, name: 'Blue' };
const F1 = crash(F1A, F1B, [0, 2]);
const F1_CLOCK = [[0, 1], [5.2, 0], [10.2, 0.3], [14.2, 1]];
function drawSameSize(ctx, T) {
  const s = simClock(T, F1_CLOCK);
  const st = F1.at(s);
  drawCrash(ctx, T, F1_CLOCK, [F1A, F1B], st);
  momentumRows(ctx, [{ name: 'Orange', col: ORANGE, p: F1A.m * st[0].v }, { name: 'Blue', col: BLUE, p: F1B.m * st[1].v }]);
}

// Film 2: small and big, both ways (masses 1 and 3, so the numbers come out whole).
//   small (speed 4) hits big (still): small bounces back at 2, big goes at 2.   1x4 = 3x2 - 1x2
//   big (speed 2) hits small (still): big slows to 1, small shoots off at 3.    3x2 = 3x1 + 1x3
const F2A = [{ m: 1, x: 90, v: 4, col: ORANGE, name: 'Small' }, { m: 3, x: 425, v: 0, col: BLUE, name: 'Big', fill: '#d6e4ee' }];
const F2B = [{ m: 3, x: 170, v: 2, col: BLUE, name: 'Big', fill: '#d6e4ee' }, { m: 1, x: 346, v: 0, col: ORANGE, name: 'Small' }];
const F2a = crash(F2A[0], F2A[1], [-2, 2]);
const F2b = crash(F2B[0], F2B[1], [1, 3]);
const F2_SPLIT = 14; // authored second the second crash starts
const F2_CLOCK_A = [[0, 1], [4.2, 0], [8.2, 0.3], [10.2, 1]];
const F2_CLOCK_B = [[0, 1], [3.6, 0.3], [5.6, 1]];
function drawBigSmall(ctx, T) {
  if (T < F2_SPLIT) {
    const st = F2a.at(simClock(T, F2_CLOCK_A));
    drawCrash(ctx, T, F2_CLOCK_A, F2A, st, { seed: 33 });
    momentumRows(ctx, F2A.map((o, i) => ({ name: o.name, col: o.col, p: o.m * st[i].v })), { k: 22 });
  } else {
    const TB = T - F2_SPLIT;
    const st = F2b.at(simClock(TB, F2_CLOCK_B));
    drawCrash(ctx, TB, F2_CLOCK_B, F2B, st, { seed: 33 });
    momentumRows(ctx, F2B.map((o, i) => ({ name: o.name, col: o.col, p: o.m * st[i].v })), { k: 22 });
  }
}

// Film 3: the same way, fast catches slow, and they stick: 1x3 + 1x1 = 2x2.
const F3A = { m: 1, x: 80, v: 3, col: ORANGE, name: 'Fast' };
const F3B = { m: 1, x: 266, v: 1, col: BLUE, name: 'Slow' };
const F3 = crash(F3A, F3B, [2, 2]);
const F3_CLOCK = [[0, 1], [4, 0], [9, 0.3], [13, 1]];
function drawCatchUp(ctx, T) {
  const s = simClock(T, F3_CLOCK);
  const st = F3.at(s);
  drawCrash(ctx, T, F3_CLOCK, [F3A, F3B], st, { seed: 35 });
  if (s > F3.sHit) label(ctx, 'stuck together!', (st[0].x + st[1].x) / 2, 230, { size: 17, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  momentumRows(ctx, [{ name: 'Fast', col: ORANGE, p: st[0].v }, { name: 'Slow', col: BLUE, p: st[1].v }]);
}

// Film 4: lots of pieces at once. Equal pieces bump about (the edges wrap
// round, like going round a ring, so nothing outside pushes on them). One is
// marked; its arrow swings about at every bump, but the arrow for all of them
// added up never moves.
const F4_N = 24; const F4_DT = 1 / 30; const F4_LEN = 20;
const F4_BOX = { x0: 40, x1: 760, y0: 40, y1: 260 };
let F4_FRAMES = null;
function f4Frames() {
  if (F4_FRAMES) return F4_FRAMES;
  const rnd = rng(77);
  const W = F4_BOX.x1 - F4_BOX.x0; const H = F4_BOX.y1 - F4_BOX.y0; const R = 11;
  const ps = [];
  for (let i = 0; i < F4_N; i++) {
    ps.push({ x: F4_BOX.x0 + (i % 8 + 0.5) * (W / 8), y: F4_BOX.y0 + (Math.floor(i / 8) + 0.5) * (H / 3), vx: 45 + (rnd() - 0.5) * 140, vy: (rnd() - 0.5) * 120 });
  }
  const frames = [];
  const n = Math.ceil(F4_LEN / F4_DT) + 1;
  for (let f = 0; f < n; f++) {
    frames.push(ps.map((p) => [p.x, p.y, p.vx, p.vy]));
    for (const p of ps) {
      p.x += p.vx * F4_DT; p.y += p.vy * F4_DT;
      if (p.x < F4_BOX.x0) p.x += W; if (p.x > F4_BOX.x1) p.x -= W;
      if (p.y < F4_BOX.y0) p.y += H; if (p.y > F4_BOX.y1) p.y -= H;
    }
    // Equal pieces bouncing: they swap the part of their speed along the line between them.
    for (let i = 0; i < F4_N; i++) {
      for (let j = i + 1; j < F4_N; j++) {
        const a = ps[i]; const b = ps[j];
        const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy);
        if (d >= 2 * R || d === 0) continue;
        const nx = dx / d; const ny = dy / d;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny;
      }
    }
  }
  F4_FRAMES = frames;
  return frames;
}
function drawManyPieces(ctx, T) {
  nightSky(ctx, 41);
  const frames = f4Frames();
  const fr = frames[Math.min(frames.length - 1, Math.max(0, Math.round(T / F4_DT)))];
  ctx.save(); ctx.strokeStyle = 'rgba(230,214,180,0.25)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
  ctx.strokeRect(F4_BOX.x0, F4_BOX.y0, F4_BOX.x1 - F4_BOX.x0, F4_BOX.y1 - F4_BOX.y0); ctx.restore();
  fr.forEach(([x, y], i) => chunk(ctx, x, y, 11, i, i === 0 ? '#ffd9a0' : '#dfeaf3'));
  const [mx, my, mvx, mvy] = fr[0];
  circle(ctx, mx, my, 15, null, ORANGE, 3);
  // The arrows, side by side under the picture.
  const k = 0.5;
  const sx = fr.reduce((t, p) => t + p[2], 0) / F4_N; const sy = fr.reduce((t, p) => t + p[3], 0) / F4_N;
  label(ctx, 'This piece', 250, 300, { size: 17, color: ORANGE, halo: 'rgba(0,0,0,0.6)' });
  arrow(ctx, 250, 370, 250 + mvx * k, 370 + mvy * k, ORANGE, 7);
  circle(ctx, 250, 370, 4, ORANGE);
  label(ctx, 'All of them added up', 550, 300, { size: 17, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
  arrow(ctx, 550, 370, 550 + sx * k * 3, 370 + sy * k * 3, '#ffffff', 9);
  circle(ctx, 550, 370, 4, '#ffffff');
}

// Film 5: a spaceship has nothing to push on. She throws a lump out the back
// (mass 1, speed 6); the ship (mass 6) moves off at speed 1. Then the engine:
// lots of little lumps, all the time.
const F5_CLOCK = [[0, 1], [3, 0], [8, 0.4], [10, 1]];
const F5_SHOT = 3.6; // sim second the lump leaves
function drawPushOnNothing(ctx, T) {
  nightSky(ctx, 47);
  const s = simClock(T, F5_CLOCK);
  const engine = span(T, 18, 19); // the engine starts
  const y = 160;
  // Ship speed: 1 after the shot, then climbing once the engine runs.
  const shot = s >= F5_SHOT;
  const vShip = shot ? 1 + Math.max(0, T - 18.5) * 0.25 : 0;
  // Ship position: still, then moving right (wraps back so it stays on stage).
  const dist = shot ? (s - F5_SHOT) * V * 1 + Math.max(0, T - 18.5) ** 2 * 0.125 * V : 0;
  const shipX = 330 + (dist % 300);
  ctx.save();
  ctx.translate(shipX, y);
  ctx.rotate(Math.PI / 2);
  rocket(ctx, 0, 40, 110, { flame: engine, t: T, nose: '#ff5d5d' });
  ctx.restore();
  // The lump: leaves the tail going left at speed 6.
  if (shot && engine < 1) {
    const lx = 330 - 40 - (s - F5_SHOT) * 6 * V;
    if (lx > 10) chunk(ctx, lx, y, 12, s * 3, '#ffd27a');
  }
  if (engine > 0) puffs(ctx, shipX - 46, y, -160, 0, T, { n: 10, color: 'rgba(255,200,120,0.75)', size: 7, spread: 10 });
  if (isHeld(T, F5_CLOCK)) label(ctx, '? Can she move with nothing to push on ?', 400, 60, { size: 24, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  if (isSlow(T, F5_CLOCK)) label(ctx, '◀◀ slow motion', 690, 36, { size: 17, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  if (engine === 0) {
    momentumRows(ctx, [{ name: 'Lump', col: '#ffd27a', p: shot ? -6 : 0 }, { name: 'Ship', col: '#ff8a8a', p: shot ? 6 * vShip : 0 }], { k: 24 });
  } else {
    label(ctx, 'An engine: lots of little lumps,', 400, 320, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, 'thrown out fast, all the time', 400, 352, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, `ship speed ${vShip.toFixed(1)}`, shipX, y - 60, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  }
}

export const LESSON_5AA = {
  id: 'ch5_momentum',
  eyebrow: ['Bumps in the rings: momentum', 'Bumps in the rings'],
  narrator: ['Mission Control', 'Mission Control'],
  tryIt: ['Keep an eye out for bumps: the rule works everywhere, even for planets.', 'Look out for bumps. The rule works everywhere!'],
  films: [
    {
      title: ['Same size, one still', 'Same size'],
      beats: [
        { dur: 5.2, cap: ['Two ice chunks, the same size. Orange is moving; blue is sitting still.', 'Orange is moving. Blue is still.'] },
        { dur: 5, predict: true, cap: ['What will happen when they hit? Think, then press ▶.', 'What will happen? Think, then press ▶.'] },
        { dur: 4, cap: ['Here it comes, in slow motion...', 'Here it comes, slowly...'] },
        { dur: 3.5, cap: ['Orange stops dead, and blue moves off at orange’s speed!', 'Orange stops. Blue goes!'] },
        { dur: 4, cap: ['Mass times speed is called momentum. Orange’s went to blue. The total stayed the same.', 'Orange gave its push to blue. The total push stays the same.'] },
      ],
      draw: drawSameSize,
      question: {
        prompt: ['A moving chunk hits a still chunk the same size, head on. What happens?', 'A moving chunk hits a still one the same size. What happens?'],
        choices: [
          { text: ['They both stop', 'Both stop'] },
          { text: ['The moving one stops; the still one moves off at the same speed', 'The moving one stops. The other one goes.'], correct: true },
          { text: ['They both bounce backwards', 'Both bounce back'] },
        ],
        hint: ['Watch the white Total arrow. Did it change?', 'Look at the arrows after the bump.'],
        why: ['The total momentum must stay the same. With equal masses, all of it moves over to the still chunk, so the moving one stops.', 'The moving one stops, and the other one goes.'],
      },
      clue: [null, 'The moving one stops. The still one goes.'],
    },
    {
      title: ['Small and big', 'Small and big'],
      beats: [
        { dur: 4.2, cap: ['A small chunk (mass 1) races at a big still one (mass 3).', 'A small chunk hits a big one.'] },
        { dur: 4, predict: true, cap: ['What happens to each one? Think, then press ▶.', 'What will happen? Press ▶.'] },
        { dur: 5.8, cap: ['Small bounces back; big rolls off slowly. Total: 4 before, 6 − 2 = 4 after.', 'Small bounces back. Big goes slowly.'] },
        { dur: 3.6, cap: ['Now the other way: the big one hits a small still one.', 'Now big hits small.'] },
        { dur: 6.4, cap: ['Big only slows down, and small shoots off fast! 6 before, 3 + 3 = 6 after.', 'Big slows down. Small shoots off fast!'] },
      ],
      draw: drawBigSmall,
      question: {
        prompt: ['A big chunk crashes into a small still chunk. What happens to the small one?', 'Big hits small. What does small do?'],
        choices: [
          { text: ['It stays where it is', 'It stays still'] },
          { text: ['It moves off slower than the big one was going', 'It goes slowly'] },
          { text: ['It shoots off faster than the big one was going', 'It shoots off fast'], correct: true },
        ],
        hint: ['Look at the small chunk’s speed after the second crash.', 'How fast did small go?'],
        why: ['Big hands on some of its momentum. Small has little mass, so to carry that momentum it must go fast: speed 3, faster than big’s 2.', 'Small shoots off fast!'],
      },
      clue: [null, 'The small one shoots off fast.'],
    },
    {
      title: ['Catching up', 'Catch up'],
      beats: [
        { dur: 4, cap: ['Both go the same way: fast orange (speed 3) behind slow blue (speed 1).', 'Fast orange is behind slow blue.'] },
        { dur: 5, predict: true, cap: ['Ice is sticky. When orange catches up they stick. How fast then? Press ▶.', 'They will stick. How fast then? Press ▶.'] },
        { dur: 4, cap: ['They stick... and go on together at speed 2.', 'They stick and go on together.'] },
        { dur: 5, cap: ['The rule: 3 + 1 = 4 before, 2 + 2 = 4 after. A bump never changes the total momentum.', 'The rule: a bump never changes the total.'] },
      ],
      draw: drawCatchUp,
      question: {
        prompt: ['A fast chunk catches a slow one and they stick together. How fast do they go?', 'Fast catches slow and they stick. How fast?'],
        choices: [
          { text: ['As fast as the fast one was', 'Fast'] },
          { text: ['Somewhere in between the two speeds', 'In between'], correct: true },
          { text: ['They stop', 'They stop'] },
        ],
        hint: ['Their speeds were 3 and 1. What speed did the pair have?', 'Look at the speed after they stick.'],
        why: ['The total momentum (4) is now shared by twice the mass, so the pair goes at 2: in between 3 and 1.', 'In between! Not as fast, not stopped.'],
      },
      clue: [null, 'Their speed is in between.'],
    },
    {
      title: ['Lots of pieces', 'Lots of pieces'],
      beats: [
        { dur: 4, cap: ['In the rings, lots of pieces bump all the time.', 'Lots of pieces bump all the time.'] },
        { dur: 6, cap: ['Watch the marked piece: its arrow swings about at every bump.', 'Watch the marked piece. Its arrow keeps changing.'] },
        { dur: 6, cap: ['But add every piece’s arrow together: the total arrow never moves.', 'But the total arrow never changes.'] },
        { dur: 4, cap: ['That is why the rings keep going round and round, however much they bump.', 'So the rings keep going round.'] },
      ],
      draw: drawManyPieces,
      watchOnly: true,
    },
    {
      title: ['Pushing on nothing', 'Pushing on nothing'],
      beats: [
        { dur: 3, cap: ['A spaceship, still, in empty space. There is nothing behind it to push on.', 'A spaceship in empty space.'] },
        { dur: 5, predict: true, cap: ['Can it move? Think, then press ▶.', 'Can it move? Press ▶.'] },
        { dur: 4, cap: ['It throws a lump out the back. Lump goes back, ship goes forward!', 'It throws a lump back. The ship goes forward!'] },
        { dur: 6, cap: ['Total before: 0. After: 6 back + 6 forward = still 0. Like the kick when you fired in the rings.', 'Lump back, ship forward. Like your cannon kick!'] },
        { dur: 6, cap: ['An engine does the same with lots of little lumps of gas, thrown out fast, all the time.', 'An engine throws out lots of gas, all the time.'] },
      ],
      draw: drawPushOnNothing,
      question: {
        prompt: ['In empty space there is nothing to push against. How does a rocket speed up?', 'In space, how does a rocket go faster?'],
        choices: [
          { text: ['It pushes on the air in space', 'It pushes on air'] },
          { text: ['The stars pull it along', 'Stars pull it'] },
          { text: ['It throws gas out the back, and the gas pushes it forward', 'It throws gas out the back'], correct: true },
        ],
        hint: ['What did the ship throw out, and which way did each go?', 'What came out the back?'],
        why: ['Space has no air to push on. The rocket pushes gas backwards, so the gas pushes the rocket forwards: the total momentum stays 0.', 'It throws gas back, so it goes forward.'],
      },
      clue: [null, 'It throws gas out the back.'],
    },
  ],
};
