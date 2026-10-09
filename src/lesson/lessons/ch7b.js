// Chapter 7, lesson 7B: atoms, the tiny building blocks (Part C, before the
// room tasks). Lead's decision, 2026-10-08. It builds on Chapter 6: the water
// loop, the algae and the filters are made of these atoms, and a reaction only
// swaps partners, so no atom is lost (why the ship's recycling can work).
// Each film draws on the 800x450 stage from src/lesson/draw.js; T is authored
// seconds.
//
// Three films (one watch-only, so there are two questions, not three in a row):
//   1. Zoom in on a glass of water: molecules, then atoms. Everything is made of
//      atoms. (question)
//   2. Atoms joined: water (2 H and 1 O), carbon dioxide (1 C and 2 O), oxygen
//      gas (2 O). (watch only, a breather)
//   3. Electricity splits 2 water molecules; the atoms swap partners; 4 H and 2 O
//      before, and 4 H and 2 O after. (question)
//
// Pitfalls carried: the last frame still shows the answer; labels sit beside the
// picture, not across it; every caption has a Level 1 version; no choice text is
// a bare number, and the right choice is never the uniquely longest one.
import { span, lerp, lin, label, circle, line, rect, plainDark } from '../draw.js';

const ATOM = Object.freeze({
  H: { fill: '#f4f7ff', ink: '#1d2433' },
  O: { fill: '#ff6b6b', ink: '#ffffff' },
  C: { fill: '#4b5563', ink: '#ffffff' },
  N: { fill: '#7fb6ff', ink: '#0d1430' },
});
const BOND = 'rgba(255,255,255,0.55)';

/** One atom: a coloured ball with its letter. `r` is the radius in stage pixels. */
function atom(ctx, kind, x, y, r = 22, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  circle(ctx, x, y, r, ATOM[kind].fill, 'rgba(0,0,0,0.3)', 2);
  label(ctx, kind, x, y, { size: Math.round(r * 1.05), color: ATOM[kind].ink, halo: null });
  ctx.restore();
}

/** A water molecule (H2O) centred on its oxygen, at scale `s`. */
function water(ctx, x, y, s = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  line(ctx, x, y, x - 30 * s, y + 24 * s, BOND, 4 * s);
  line(ctx, x, y, x + 30 * s, y + 24 * s, BOND, 4 * s);
  atom(ctx, 'O', x, y, 22 * s);
  atom(ctx, 'H', x - 30 * s, y + 24 * s, 14 * s);
  atom(ctx, 'H', x + 30 * s, y + 24 * s, 14 * s);
  ctx.restore();
}

// --- film 1: zoom in on water, down to the atoms -----------------------------------------------

// Atoms scattered across a scene: rock, air, water and you are all made of them.
const MIX = [['C', 150, 120], ['O', 260, 150], ['H', 200, 230], ['N', 320, 110], ['H', 380, 170], ['O', 120, 300],
  ['C', 300, 300], ['H', 470, 120], ['O', 520, 210], ['H', 600, 150], ['C', 680, 280], ['H', 430, 320],
  ['O', 640, 90], ['H', 230, 380], ['C', 560, 360], ['O', 380, 250], ['H', 70, 180], ['N', 720, 380]];

function drawAtoms(ctx, T) {
  plainDark(ctx);
  if (T < 4) {
    // a glass of water
    rect(ctx, 300, 110, 200, 250, 'rgba(180,215,255,0.22)', 14);
    rect(ctx, 304, 190, 192, 166, '#3f8fe0', 10);
    label(ctx, 'a glass of water', 400, 395, { size: 20, color: '#cfe8ff', halo: null });
  } else if (T < 8) {
    // molecules: groups of atoms joined
    const grid = [[200, 150], [400, 150], [600, 150], [200, 290], [400, 290], [600, 290]];
    for (const [x, y] of grid) water(ctx, x, y, 1);
    label(ctx, 'molecules: atoms joined in groups', 400, 400, { size: 20, color: '#ffffff', halo: null });
  } else if (T < 12) {
    // one molecule, big: its atoms named
    water(ctx, 400, 200, 2.6);
    label(ctx, 'H = hydrogen atom', 400, 362, { size: 18, color: '#f4f7ff', halo: null });
    label(ctx, 'O = oxygen atom', 400, 392, { size: 18, color: '#ff9b9b', halo: null });
  } else {
    // everything: many kinds of atom, in the rock, the air, the water and you
    for (const [k, x, y] of MIX) atom(ctx, k, x, y, 20);
    label(ctx, 'rock, air, water and you: all atoms', 400, 425, { size: 20, color: '#ffe27a', halo: null });
  }
}

// --- film 2: atoms joined (watch only) --------------------------------------------------------

function drawJoined(ctx, T) {
  plainDark(ctx);
  const water1 = span(T, 4, 5);
  const co2 = span(T, 9, 10);
  const o2 = span(T, 14, 15);
  // Water: 2 H and 1 O
  if (water1 > 0) {
    water(ctx, 180, 200, 2.2, water1);
    label(ctx, 'water: 2 H and 1 O', 180, 340, { size: 19, color: '#7fd3ff', halo: null, alpha: water1 });
    label(ctx, 'H₂O', 180, 372, { size: 24, color: '#ffffff', halo: null, alpha: water1 });
  }
  // Carbon dioxide: 1 C and 2 O
  if (co2 > 0) {
    ctx.save(); ctx.globalAlpha *= co2;
    line(ctx, 400 - 58, 200, 400 + 58, 200, BOND, 6);
    line(ctx, 400 - 58, 214, 400 + 58, 214, BOND, 6);
    ctx.restore();
    atom(ctx, 'O', 400 - 70, 200, 26, co2);
    atom(ctx, 'C', 400, 200, 26, co2);
    atom(ctx, 'O', 400 + 70, 200, 26, co2);
    label(ctx, 'carbon dioxide: 1 C and 2 O', 400, 340, { size: 19, color: '#ffd27a', halo: null, alpha: co2 });
    label(ctx, 'CO₂', 400, 372, { size: 24, color: '#ffffff', halo: null, alpha: co2 });
  }
  // Oxygen gas: 2 O joined
  if (o2 > 0) {
    ctx.save(); ctx.globalAlpha *= o2;
    line(ctx, 620 - 22, 200, 620 + 22, 200, BOND, 6);
    line(ctx, 620 - 22, 213, 620 + 22, 213, BOND, 6);
    ctx.restore();
    atom(ctx, 'O', 620 - 40, 200, 26, o2);
    atom(ctx, 'O', 620 + 40, 200, 26, o2);
    label(ctx, 'oxygen gas: 2 O', 620, 340, { size: 19, color: '#ff9b9b', halo: null, alpha: o2 });
    label(ctx, 'O₂', 620, 372, { size: 24, color: '#ffffff', halo: null, alpha: o2 });
  }
}

// --- film 3: the atoms swap partners ----------------------------------------------------------

// Where each atom sits before (two water molecules) and after (two H2 and one O2 molecule).
const BEFORE = { H0: [170, 180], H1: [230, 180], O0: [200, 150], H2: [170, 330], H3: [230, 330], O1: [200, 300] };
const AFTER = { H0: [600, 120], H1: [640, 120], H2: [600, 200], H3: [640, 200], O0: [600, 320], O1: [640, 320] };

function drawSwap(ctx, T) {
  plainDark(ctx);
  const split = span(T, 4, 8);     // the electricity splits the water
  const k = span(T, 6, 12);        // the atoms move to new partners
  // The left molecules, joined by bonds until the atoms part.
  if (k < 1) {
    ctx.save(); ctx.globalAlpha = 1 - k;
    for (const [o, h] of [['O0', 'H0'], ['O0', 'H1'], ['O1', 'H2'], ['O1', 'H3']]) {
      const a = BEFORE[o]; const b = BEFORE[h];
      line(ctx, a[0], a[1], b[0], b[1], BOND, 5);
    }
    ctx.restore();
  }
  // The splitter: a yellow zigzag of electricity between the two sides.
  if (split > 0 && split < 1) {
    ctx.save(); ctx.globalAlpha = Math.sin(split * Math.PI);
    const pts = [[360, 190], [390, 215], [372, 232], [410, 262]];
    for (let i = 0; i < pts.length - 1; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#ffe27a', 5);
    label(ctx, 'electricity', 400, 130, { size: 18, color: '#ffe27a', halo: null });
    ctx.restore();
  }
  // Every atom: from its place before to its place after.
  for (const id of Object.keys(BEFORE)) {
    const a = BEFORE[id]; const b = AFTER[id];
    const x = lerp(a[0], b[0], k); const y = lerp(a[1], b[1], k);
    atom(ctx, id[0], x, y, 20);
  }
  // The new molecules: H2 pairs and an O2, bonded once they settle.
  if (k >= 1) {
    ctx.save(); ctx.globalAlpha = lin(T, 12, 13);
    for (const [p, q] of [['H0', 'H1'], ['H2', 'H3'], ['O0', 'O1']]) {
      const a = AFTER[p]; const b = AFTER[q];
      line(ctx, a[0], a[1], b[0], b[1], BOND, 5);
    }
    ctx.restore();
  }
  if (T > 13) label(ctx, 'After: 4 H and 2 O', 620, 392, { size: 18, color: '#9fe8a8', halo: null });
  if (T > 9) label(ctx, 'Before: 4 H and 2 O', 200, 392, { size: 18, color: '#cfe8ff', halo: null });
}

export const LESSON_7B = {
  id: 'ch7_atoms',
  eyebrow: ['Atoms: what everything is made of', 'Tiny building blocks'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: try it on the ship.', 'Next: try it!'],
  films: [
    {
      title: ['Zoom in: what is water made of?', 'Zoom in on water'],
      beats: [
        { dur: 4, cap: ['Look at a glass of water. Now zoom in, closer and closer...', 'Look at water. Zoom in!'] },
        { dur: 4, cap: ['Closer: water is made of tiny groups of atoms, called molecules.', 'Closer: tiny groups called molecules.'] },
        { dur: 4, cap: ['Closer still: one water molecule is made of 3 atoms: two hydrogen and one oxygen.', 'One water molecule: 3 atoms.'] },
        { dur: 4.5, cap: ['Everything is made of atoms: rock, air, water and you.', 'Everything is made of atoms.'] },
      ],
      draw: drawAtoms,
      question: {
        prompt: ['What are all the things around us made of?', 'What are things made of?'],
        choices: [
          { text: ['Tiny building blocks called atoms', 'Tiny blocks called atoms'], correct: true },
          { text: ['Tiny grains of sand, all packed together', 'Grains of sand packed together'] },
          { text: ['Invisible bubbles of air, joined up', 'Bubbles of air joined up'] },
        ],
        hint: ['Look at the last zoom: what is the smallest part we saw?', 'What is the smallest bit we saw?'],
        why: ['Everything, from water to rock to you, is made of atoms: tiny building blocks joined together.', 'Everything is made of atoms, tiny building blocks!'],
      },
      clue: [null, 'Everything is made of tiny atoms.'],
    },
    {
      title: ['Atoms joined up', 'Atoms joined up'],
      watchOnly: true,
      beats: [
        { dur: 4, cap: ['A molecule is a few atoms joined together, like a tiny model made of bricks.', 'Atoms joined together make a molecule.'] },
        { dur: 5, cap: ['Water: 2 hydrogen atoms and 1 oxygen atom. We write it H₂O.', 'Water: 2 H and 1 O. H₂O.'] },
        { dur: 5, cap: ['Carbon dioxide, which the crew breathes out: 1 carbon and 2 oxygen. CO₂.', 'Carbon dioxide: 1 C and 2 O. CO₂.'] },
        { dur: 5, cap: ['Oxygen gas, the air we breathe: 2 oxygen atoms joined. O₂.', 'Oxygen gas: 2 O joined. O₂.'] },
      ],
      draw: drawJoined,
    },
    {
      title: ['Swapping partners', 'Swapping partners'],
      beats: [
        { dur: 4, cap: ['Here are 2 water molecules. Count their atoms: 4 hydrogen and 2 oxygen.', '2 water molecules. Count the atoms.'] },
        { dur: 4, cap: ['Electricity splits the water: the atoms come apart.', 'Electricity splits the water.'] },
        { dur: 5, cap: ['Then the atoms swap partners and join up again: 2 hydrogen molecules and 1 oxygen molecule.', 'They swap partners: 2 H₂ and 1 O₂.'] },
        { dur: 6, cap: ['Count again: 4 hydrogen and 2 oxygen. Not one atom is lost!', 'Count again: 4 H and 2 O. None lost!'] },
      ],
      draw: drawSwap,
      question: {
        prompt: ['When the atoms swap partners, what happens to them?', 'What happens when atoms swap partners?'],
        choices: [
          { text: ['The same atoms, just with new partners', 'The same atoms, new partners'], correct: true },
          { text: ['Some of the atoms disappear into thin air', 'Some atoms disappear'] },
          { text: ['Brand new atoms are made out of nothing', 'New atoms appear from nothing'] },
        ],
        hint: ['Count the balls before and after. Are they the same?', 'Count the balls before and after.'],
        why: ['Before: 4 hydrogen and 2 oxygen. After: the very same atoms, with new partners. Nothing is lost, which is why our recycling can work!', 'The same atoms, in new partners. None lost!'],
      },
      clue: [null, 'The atoms swap partners. None are lost.'],
    },
  ],
};
