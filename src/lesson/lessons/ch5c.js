// Chapter 5, lesson 5C: what everything is made of, and what makes a star
// shine (Part C, after the edge of the Sun's family). Each film draws on the
// 800x450 stage from src/lesson/draw.js; T is authored seconds.
//
// Five films: two zooms down to atoms (into her own hand, through a cell to
// DNA; and into a chunk of ring ice, to water molecules); inside an atom
// (protons, neutrons, electrons: every atom is the same three pieces); protons
// smashing together in the Sun's core (fusion: a little mass becomes a lot
// of energy); and the Sun against a Sun made of coal (it would burn out in a
// few thousand years), with how much more a kilogram of fusion fuel gives.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every string has a Level 1 version.
import { span, lerp, label, circle, arrow, rect, nightSky, plainDark, kid } from '../draw.js';

const TAU = Math.PI * 2;
const P_COL = '#ff6b6b'; const N_COL = '#b9c2cf'; const E_COL = '#5fb8ff';

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** A scale tag in the corner: how big the thing on screen is. */
function scaleTag(ctx, text, alpha = 1) {
  label(ctx, text, 620, 420, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)', alpha });
}

/** A zoom ring: the circle we dive into next. */
function zoomRing(ctx, x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}

/** Cross-fade helper: draws `fn` with alpha a. */
function layer(ctx, a, fn) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore();
}

/** An atom as a ball: a coloured core with its letter. */
function atomBall(ctx, x, y, r, sym) {
  const col = { H: '#f4f7fb', O: '#ff5d5d', C: '#555d6b', N: '#5b7cff', P: '#ffa54f' }[sym] || '#ccc';
  circle(ctx, x, y, r, col, 'rgba(20,30,50,0.7)', 2);
  label(ctx, sym, x, y, { size: Math.max(11, r * 0.8), color: sym === 'H' ? '#1d2433' : '#fff', halo: null });
}

/** A nucleus of p protons and n neutrons, packed in a little ball. */
function nucleus(ctx, x, y, p, n, size = 7) {
  const rnd = rng(p * 31 + n * 7 + 1);
  const all = [...Array(p).fill(P_COL), ...Array(n).fill(N_COL)].map((c) => ({ c, k: rnd() }));
  all.sort((a, b) => a.k - b.k);
  const R = size * Math.cbrt(all.length) * 0.9;
  all.forEach((b, i) => {
    const a = i * 2.39996; const rr = R * Math.sqrt((i + 0.5) / all.length);
    circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, size, b.c, 'rgba(0,0,0,0.35)', 1);
  });
  return R;
}

// --- film 1: into her hand, down to atoms -------------------------------------------------

function drawIntoYou(ctx, T) {
  ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, 800, 450);
  // Stages: 0 her (1 m), 1 skin cells (0.01 mm), 2 DNA (2 nm), 3 atoms (0.1 nm).
  const s1 = span(T, 3, 4.5); const s2 = span(T, 7, 8.5); const s3 = span(T, 11, 12.5);
  layer(ctx, 1 - s1, () => {
    ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, 800, 450);
    kid(ctx, 400, 360, { scale: 2.2, armUp: 0.6 });
    zoomRing(ctx, 470, 205, 26, span(T, 1.5, 2.5));
    scaleTag(ctx, 'you: about 1 m');
  });
  layer(ctx, s1 * (1 - s2), () => {
    ctx.fillStyle = '#f2c7b4'; ctx.fillRect(0, 0, 800, 450);
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 9; gx++) {
        const x = 50 + gx * 90 + (gy % 2) * 45; const y = 40 + gy * 75;
        ctx.save(); ctx.fillStyle = '#f7d9cb'; ctx.strokeStyle = '#c98f7a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y, 40, 32, 0.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        circle(ctx, x + 4, y - 2, 11, '#a0628a');
      }
    }
    zoomRing(ctx, 444, 188, 16, span(T, 5.5, 6.5));
    label(ctx, 'cells', 120, 410, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    scaleTag(ctx, 'a cell: 0.01 mm');
  });
  layer(ctx, s2 * (1 - s3), () => {
    ctx.fillStyle = '#1a1036'; ctx.fillRect(0, 0, 800, 450);
    // The double helix, side on.
    for (let i = 0; i < 70; i++) {
      const x = 40 + i * 10.5; const ph = i * 0.42 + T * 0.6;
      const y1 = 225 + Math.sin(ph) * 70; const y2 = 225 - Math.sin(ph) * 70;
      if (i % 2 === 0) { ctx.strokeStyle = ['#7fd3ff', '#ffb347', '#9fe8a8', '#ff8a8a'][i % 4]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); }
      circle(ctx, x, y1, 6, '#c9b6ff'); circle(ctx, x, y2, 6, '#c9b6ff');
    }
    zoomRing(ctx, 400, 225 + Math.sin(34 * 0.42 + T * 0.6) * 70, 18, span(T, 9.5, 10.5));
    label(ctx, 'DNA', 90, 60, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    scaleTag(ctx, 'DNA: 2 millionths of a mm wide');
  });
  layer(ctx, s3, () => {
    plainDark(ctx); // atoms only, no star dots
    // A bit of DNA as atoms: carbon, hydrogen, oxygen, nitrogen, phosphorus.
    const rnd = rng(5);
    const syms = ['C', 'C', 'H', 'O', 'N', 'H', 'C', 'P', 'O', 'H', 'H', 'C', 'N', 'O', 'H', 'C', 'H', 'O'];
    syms.forEach((sym, i) => {
      const a = i * 0.7; const x = 400 + Math.cos(a) * (60 + i * 9) + (rnd() - 0.5) * 20; const y = 210 + Math.sin(a) * (40 + i * 6);
      atomBall(ctx, x + Math.sin(T * 3 + i) * 1.5, y, sym === 'H' ? 15 : 22, sym);
    });
    if (T > 13) label(ctx, 'atoms!', 400, 400, { size: 26, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    scaleTag(ctx, 'an atom: 0.0000001 mm');
  });
}

// --- film 2: into a chunk of ring ice ------------------------------------------------------

function drawIntoIce(ctx, T) {
  plainDark(ctx); // atoms only, no star dots
  const s1 = span(T, 3, 4.5); const s2 = span(T, 7, 8.5);
  layer(ctx, 1 - s1, () => {
    // A ring chunk, house-sized.
    ctx.save(); ctx.translate(400, 220); ctx.rotate(T * 0.1);
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU; const r = 130 * (0.8 + 0.2 * Math.sin(i * 2.7)); if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = '#e3eef7'; ctx.fill(); ctx.strokeStyle = '#9fb8cc'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    zoomRing(ctx, 430, 200, 22, span(T, 1.5, 2.5));
    scaleTag(ctx, 'ring ice: 10 m');
  });
  layer(ctx, s1 * (1 - s2), () => {
    // Ice crystal: water molecules in a honeycomb.
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 9; gx++) {
        const x = 60 + gx * 85 + (gy % 2) * 42; const y = 50 + gy * 68;
        ctx.strokeStyle = 'rgba(160,200,230,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; const px = x + Math.cos(a) * 40; const py = y + Math.sin(a) * 40; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
        circle(ctx, x, y, 8, '#ff5d5d');
      }
    }
    zoomRing(ctx, 357, 186, 22, span(T, 5.5, 6.5));
    label(ctx, 'an ice crystal', 140, 420, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    scaleTag(ctx, 'crystal: tiny');
  });
  layer(ctx, s2, () => {
    // One water molecule: big oxygen, two hydrogens.
    const w = Math.sin(T * 2) * 0.05;
    atomBall(ctx, 400, 210, 62, 'O');
    atomBall(ctx, 400 - Math.cos(0.91 + w) * 95, 210 + Math.sin(0.91 + w) * 95, 38, 'H');
    atomBall(ctx, 400 + Math.cos(0.91 - w) * 95, 210 + Math.sin(0.91 - w) * 95, 38, 'H');
    if (T > 9.5) label(ctx, 'H₂O: 2 hydrogen atoms + 1 oxygen atom', 400, 395, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    scaleTag(ctx, 'a water molecule');
  });
}

// --- film 3: inside an atom (and every atom is the same three pieces) --------------------

const ELEMENTS = [
  { sym: 'H', name: 'hydrogen', p: 1, n: 0 },
  { sym: 'He', name: 'helium', p: 2, n: 2 },
  { sym: 'C', name: 'carbon', p: 6, n: 6 },
  { sym: 'O', name: 'oxygen', p: 8, n: 8 },
  { sym: 'Fe', name: 'iron', p: 26, n: 30 },
];

function drawInsideAtom(ctx, T) {
  plainDark(ctx); // atoms only, no star dots
  const mont = span(T, 9, 10);
  layer(ctx, 1 - mont, () => {
    // Carbon, big: nucleus and 6 electrons.
    const cx = 330; const cy = 220;
    ctx.save(); ctx.strokeStyle = 'rgba(95,184,255,0.25)'; ctx.lineWidth = 2;
    for (const r of [80, 150]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const z = span(T, 2.5, 4.5);
    nucleus(ctx, cx, cy, 6, 6, 7 + z * 7);
    for (let i = 0; i < 6; i++) {
      const r = i < 2 ? 80 : 150; const a = T * (i < 2 ? 1.6 : 0.9) + i * (i < 2 ? Math.PI : TAU / 4);
      circle(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, E_COL, '#fff', 1);
    }
    if (T > 2.5) {
      circle(ctx, 600, 120, 9, P_COL); label(ctx, 'proton (+)', 690, 120, { size: 18, color: P_COL, halo: 'rgba(0,0,0,0.6)' });
      circle(ctx, 600, 165, 9, N_COL); label(ctx, 'neutron', 680, 165, { size: 18, color: N_COL, halo: 'rgba(0,0,0,0.6)' });
      circle(ctx, 600, 210, 6, E_COL); label(ctx, 'electron (−)', 693, 210, { size: 18, color: E_COL, halo: 'rgba(0,0,0,0.6)' });
    }
    if (T > 6) label(ctx, 'carbon: 6 protons, 6 neutrons, 6 electrons', 400, 410, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  });
  layer(ctx, mont, () => {
    // The montage: same three pieces, different numbers.
    ELEMENTS.forEach((e, i) => {
      const k = span(T, 10 + i * 1.2, 11 + i * 1.2);
      if (k <= 0) return;
      const x = 90 + i * 155; const y = 200;
      ctx.save(); ctx.globalAlpha *= k;
      nucleus(ctx, x, y, e.p, e.n, e.p > 20 ? 5 : 7);
      label(ctx, e.sym, x, y - 70, { size: 26, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
      label(ctx, e.name, x, y + 70, { size: 17, color: '#cfe8ff', halo: 'rgba(0,0,0,0.7)' });
      label(ctx, `${e.p} proton${e.p === 1 ? '' : 's'}`, x, y + 96, { size: 15, color: P_COL, halo: 'rgba(0,0,0,0.7)' });
      ctx.restore();
    });
    if (T > 16) label(ctx, 'Everything is made of the same three pieces', 400, 410, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  });
}

// --- film 4: fusion: protons smash together -----------------------------------------------

function drawFusion(ctx, T) {
  // The Sun's core: hot, crowded, glowing.
  const g = ctx.createRadialGradient(400, 225, 20, 400, 225, 520);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, '#ffb347'); g.addColorStop(1, '#a23b12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  // Part 1 (0-6): two protons, slow: they push each other away.
  if (T < 6.5) {
    const k = T / 6.5;
    const gap = k < 0.5 ? lerp(300, 60, k * 2) : lerp(60, 300, (k - 0.5) * 2);
    circle(ctx, 400 - gap, 225, 22, P_COL, '#fff', 2); circle(ctx, 400 + gap, 225, 22, P_COL, '#fff', 2);
    label(ctx, '+', 400 - gap, 225, { size: 22, color: '#fff', halo: null }); label(ctx, '+', 400 + gap, 225, { size: 22, color: '#fff', halo: null });
    if (k > 0.35 && k < 0.7) {
      arrow(ctx, 400 - gap - 26, 225, 400 - gap - 70, 225, '#1d2433', 5); arrow(ctx, 400 + gap + 26, 225, 400 + gap + 70, 225, '#1d2433', 5);
      label(ctx, 'two + push apart', 400, 160, { size: 20, color: '#1d2433', halo: 'rgba(255,255,255,0.6)' });
    }
    return;
  }
  // Part 2 (6.5-12): very fast: they get close enough to stick, with a flash.
  if (T < 12) {
    const k = span(T, 6.5, 9);
    const gap = lerp(320, 0, k);
    const fl = span(T, 9, 9.4) * (1 - span(T, 9.4, 11));
    if (k < 1) {
      circle(ctx, 400 - gap, 225, 22, P_COL, '#fff', 2); circle(ctx, 400 + gap, 225, 22, P_COL, '#fff', 2);
      for (let i = 1; i < 5; i++) { ctx.globalAlpha = 0.25 / i; circle(ctx, 400 - gap - i * 18, 225, 20, P_COL); circle(ctx, 400 + gap + i * 18, 225, 20, P_COL); }
      ctx.globalAlpha = 1;
      label(ctx, 'super hot = super fast', 400, 120, { size: 22, color: '#1d2433', halo: 'rgba(255,255,255,0.6)' });
    } else {
      nucleus(ctx, 400, 225, 2, 2, 16);
      label(ctx, 'stuck together: helium!', 400, 330, { size: 22, color: '#1d2433', halo: 'rgba(255,255,255,0.6)' });
    }
    if (fl > 0) { ctx.save(); ctx.globalAlpha = fl; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 450); ctx.restore(); }
    return;
  }
  // Part 3 (12+): the scales: 4 hydrogens weigh a little more than 1 helium.
  const k = span(T, 12, 13);
  ctx.save(); ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(11,18,34,0.82)'; ctx.fillRect(0, 0, 800, 450);
  const tip = span(T, 13.5, 15) * 0.08;
  rect(ctx, 394, 150, 12, 200, '#c9d1dc', 3);
  ctx.save(); ctx.translate(400, 150); ctx.rotate(-tip); rect(ctx, -250, -5, 500, 10, '#c9d1dc', 4); ctx.restore();
  const ly = 150 + Math.sin(tip) * 230; const ry = 150 - Math.sin(tip) * 230;
  for (let i = 0; i < 4; i++) circle(ctx, 120 + i * 40, ly - 22, 15, P_COL, '#fff', 2);
  nucleus(ctx, 630, ry - 30, 2, 2, 10);
  label(ctx, '4 hydrogen: 4.03', 180, ly + 30, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, '1 helium: 4.00', 630, ry + 30, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  if (T > 15.5) {
    label(ctx, 'The missing bit of mass becomes energy: E = mc²', 400, 395, { size: 22, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, 'c² is huge, so a tiny bit of mass makes a LOT of light', 400, 425, { size: 17, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
  }
  ctx.restore();
}

// --- film 5: the Sun against a coal Sun -------------------------------------------------

function sunBall(ctx, x, y, r, coal) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  if (coal) { g.addColorStop(0, '#ff9a4a'); g.addColorStop(0.5, '#7a2a10'); g.addColorStop(1, '#1f1410'); } else { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#ff8a1f'); }
  circle(ctx, x, y, r, null);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function drawCoalSun(ctx, T) {
  nightSky(ctx, 79);
  // Part 1: two suns side by side and a clock of years.
  const part2 = span(T, 13, 14);
  layer(ctx, 1 - part2, () => {
    const years = T < 2 ? 0 : Math.pow(10, Math.min(10, (T - 2) * 1.0));
    const coalLeft = Math.max(0, 1 - years / 5000);
    sunBall(ctx, 220, 200, 90, false);
    sunBall(ctx, 580, 200, 30 + 60 * coalLeft, true);
    if (coalLeft <= 0) label(ctx, 'burnt out!', 580, 200, { size: 22, color: '#ff8a8a', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, 'the real Sun (fusion)', 220, 320, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, 'a Sun made of coal', 580, 320, { size: 18, color: '#ff9a4a', halo: 'rgba(0,0,0,0.7)' });
    const y = years >= 1e9 ? `${(years / 1e9).toFixed(1)} billion` : years >= 1e6 ? `${(years / 1e6).toFixed(0)} million` : Math.round(years).toLocaleString('en-GB');
    label(ctx, `${y} years`, 400, 60, { size: 26, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    if (T > 6) label(ctx, 'coal Sun: gone in a few thousand years', 580, 352, { size: 15, color: '#ff9a4a', halo: 'rgba(0,0,0,0.7)' });
    if (T > 10) label(ctx, 'real Sun: shining for 10 billion years', 220, 352, { size: 15, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  });
  // Part 2: one cup of fusion fuel against mountains of coal.
  layer(ctx, part2, () => {
    rect(ctx, 120, 260, 40, 50, '#9fe8ff', 6);
    label(ctx, '1 kg fusion fuel', 140, 340, { size: 17, color: '#9fe8ff', halo: 'rgba(0,0,0,0.7)' });
    label(ctx, '=', 230, 280, { size: 40, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    // Coal trucks: 400 of them would be 10 million kg (25 tonnes each). Show a field of heaps.
    const n = Math.floor(lerp(0, 160, span(T, 14.5, 18)));
    for (let i = 0; i < n; i++) {
      const gx = i % 20; const gy = Math.floor(i / 20);
      const x = 290 + gx * 24; const y = 330 - gy * 26;
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x, y - 14); ctx.lineTo(x + 11, y); ctx.closePath(); ctx.fill();
    }
    if (T > 18) label(ctx, 'about 10 million kg of coal', 530, 380, { size: 20, color: '#fff', halo: 'rgba(0,0,0,0.7)' });
    if (T > 19.5) label(ctx, 'That is the engine our starship needs.', 400, 420, { size: 20, color: '#ffd27a', halo: 'rgba(0,0,0,0.7)' });
  });
}

export const LESSON_5C = {
  id: 'ch5_fusion',
  eyebrow: ['What makes a star shine?', 'How the Sun shines'],
  narrator: ['Mission Control', 'Mission Control'],
  tryIt: ['Now: could we build an engine that works like the Sun?', 'Can we make an engine like the Sun?'],
  done: ['Design the ship', 'Make the ship'],
  films: [
    {
      title: ['Zoom into you', 'Zoom into you'],
      beats: [
        { dur: 3, cap: ['Let’s zoom into your hand, closer and closer.', 'Let’s zoom into your hand.'] },
        { dur: 4, cap: ['Your skin is made of tiny cells, too small to see.', 'Your skin is made of tiny cells.'] },
        { dur: 4, cap: ['Inside each cell is DNA, the instructions for building you.', 'Inside each cell is DNA.'] },
        { dur: 4, cap: ['And DNA is made of atoms: carbon, hydrogen, oxygen, nitrogen, phosphorus.', 'DNA is made of tiny atoms!'] },
      ],
      draw: drawIntoYou,
      question: {
        prompt: ['Zoom into your hand far enough and what do you find in the end?', 'What is your hand made of, deep down?'],
        choices: [
          { text: ['Atoms', 'Atoms'], correct: true },
          { text: ['Tiny hands', 'Tiny hands'] },
          { text: ['Nothing at all', 'Nothing'] },
        ],
        hint: ['What were the little balls at the very end of the zoom?', 'Look at the end of the zoom.'],
        why: ['Hand, cells, DNA, atoms: every living thing is made of atoms in the end.', 'You are made of atoms!'],
      },
      clue: [null, 'You are made of atoms.'],
    },
    {
      title: ['Zoom into ice', 'Zoom into ice'],
      beats: [
        { dur: 3, cap: ['Now a chunk of Saturn’s ring ice. Closer...', 'Now some ring ice. Closer...'] },
        { dur: 4, cap: ['Ice is a crystal: the same little shape again and again.', 'Ice is made of the same shape again and again.'] },
        { dur: 5, cap: ['Each one is a water molecule: one oxygen atom holding two hydrogen atoms.', 'Water is 1 oxygen and 2 hydrogens.'] },
      ],
      draw: drawIntoIce,
      question: {
        prompt: ['What is one water molecule made of?', 'What is water made of?'],
        choices: [
          { text: ['2 hydrogen atoms and 1 oxygen atom', '2 hydrogens and 1 oxygen'], correct: true },
          { text: ['1 ice atom', '1 ice atom'] },
          { text: ['Carbon and iron', 'Carbon and iron'] },
        ],
        hint: ['Count the atoms in the last picture, and read their letters.', 'Count the balls.'],
        why: ['H₂O: two H (hydrogen) and one O (oxygen). Ice, steam and water are all the same molecule.', 'Water is 2 hydrogens and 1 oxygen!'],
      },
      clue: [null, 'Water is 2 hydrogens and 1 oxygen.'],
    },
    {
      title: ['Inside an atom', 'Inside an atom'],
      beats: [
        { dur: 2.5, cap: ['What is inside an atom? Let’s look at carbon.', 'What is inside an atom?'] },
        { dur: 3.5, cap: ['In the middle: protons (plus charge) and neutrons, packed tight.', 'In the middle: protons and neutrons.'] },
        { dur: 3, cap: ['Round the outside, tiny electrons (minus charge) whizz about.', 'Electrons go round the outside.'] },
        { dur: 4, cap: ['Hydrogen, helium, carbon, oxygen, iron: the same three pieces, just different numbers.', 'All atoms: the same 3 pieces!'] },
        { dur: 4, cap: ['You, the ice, the Sun, the starship: all made of protons, neutrons and electrons.', 'Everything is made of these 3 pieces.'] },
      ],
      draw: drawInsideAtom,
      question: {
        prompt: ['What are all atoms made of?', 'What are atoms made of?'],
        choices: [
          { text: ['Protons, neutrons and electrons', 'Protons, neutrons, electrons'], correct: true },
          { text: ['Each kind of atom is made of something totally different', 'Different stuff each time'] },
          { text: ['Tiny bits of water', 'Water'] },
        ],
        hint: ['What changed between hydrogen, carbon and iron, and what stayed the same?', 'Look at the colours.'],
        why: ['Every atom is protons and neutrons in the middle, with electrons round the outside. Only the numbers change: 1 proton is hydrogen, 6 is carbon, 26 is iron.', 'All atoms are protons, neutrons and electrons!'],
      },
      clue: [null, 'Protons, neutrons and electrons.'],
    },
    {
      title: ['Protons smash together', 'Smash!'],
      beats: [
        { dur: 6.5, cap: ['In the Sun’s core, protons fly about. Both have a plus charge, so they push each other away.', 'Two protons push each other away.'] },
        { dur: 5.5, cap: ['But the core is 15 million °C, so they go so fast that some smash together and stick: fusion!', 'In the hot Sun they go so fast they stick!'] },
        { dur: 3.5, cap: ['Weigh them: 4 hydrogens are a tiny bit heavier than the helium they make.', '4 hydrogens weigh a bit more than 1 helium.'] },
        { dur: 5, cap: ['That missing mass turns into energy: E = mc². That is sunlight.', 'The missing bit turns into sunlight!'] },
      ],
      draw: drawFusion,
      question: {
        prompt: ['Where does the energy from fusion come from?', 'Where does the Sun’s light come from?'],
        choices: [
          { text: ['Burning, like a fire', 'Fire'] },
          { text: ['A tiny bit of mass turns into energy', 'A tiny bit of stuff turns into light'], correct: true },
          { text: ['Electricity from the planets', 'Electricity'] },
        ],
        hint: ['Look at the scales: which side was heavier, and where did the difference go?', 'Look at the scales.'],
        why: ['The helium weighs a little less than the hydrogen that made it. That bit of mass becomes energy (E = mc²), and c² is enormous, so it is a lot of energy.', 'A tiny bit of stuff turns into light!'],
      },
      clue: [null, 'A tiny bit of stuff turns into light.'],
    },
    {
      title: ['The Sun against a coal Sun', 'Sun or coal?'],
      beats: [
        { dur: 4, cap: ['What if the Sun were a huge lump of coal, burning? Watch the years go by.', 'What if the Sun was made of coal?'] },
        { dur: 5, cap: ['The coal Sun is gone in a few thousand years: before the pyramids were old.', 'The coal Sun burns out fast!'] },
        { dur: 4, cap: ['The real Sun, burning by fusion, shines for about 10 billion years.', 'The real Sun shines for a very long time.'] },
        { dur: 7, cap: ['One kilogram of fusion fuel gives as much energy as about 10 million kilograms of coal.', '1 cup of fusion fuel = a mountain of coal!'] },
      ],
      draw: drawCoalSun,
      question: {
        prompt: ['If the Sun were a giant lump of burning coal, about how long would it shine?', 'How long would a coal Sun shine?'],
        choices: [
          { text: ['A few thousand years', 'A short time'], correct: true },
          { text: ['About 10 billion years, the same', 'Just as long'] },
          { text: ['Forever', 'Forever'] },
        ],
        hint: ['Watch the coal Sun as the years count up.', 'Watch the coal Sun.'],
        why: ['Coal gives about 10 million times less energy than fusion fuel, so a coal Sun would burn out in a few thousand years, not billions.', 'A coal Sun burns out fast!'],
      },
      clue: [null, 'A coal Sun burns out fast.'],
    },
  ],
};
