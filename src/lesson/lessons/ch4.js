// Chapter 4 lesson 4G (lead, 2026-10-05): the biology of what the drill looks
// for on Europa. Cells, DNA and proteins, told with zooms and moving parts,
// not words. Each film draws on the 800x450 stage from src/lesson/draw.js;
// T is authored seconds.
//
// Pitfalls carried from Chapters 1-3: the last frame must still show the
// answer (the question is asked over it); nothing leaves the stage at the end;
// labels sit beside the picture, not across it; every string has a Level 1 version.
import { C, span, lin, lerp, clamp, label, circle, line, rect, kid, STAGE_W, STAGE_H } from '../draw.js';

const NARRATOR = ['Mission Biologist', 'Mission Biologist'];
const TAU = Math.PI * 2;

/** A soft, gently wobbling blob: a cell. */
function blob(ctx, x, y, r, fill, stroke, t = 0, wob = 0.05, sx = 1) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const rr = r * (1 + wob * Math.sin(a * 3 + t * 2) + wob * 0.6 * Math.sin(a * 5 - t * 1.4));
    const px = x + Math.cos(a) * rr * sx; const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.restore();
}

/** The inside of a cell: drifting little parts and a nucleus. */
function cellInside(ctx, x, y, r, t, { nucleus = true } = {}) {
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + t * 0.3;
    const d = r * (0.35 + 0.4 * ((i * 37) % 10) / 10);
    const px = x + Math.cos(a) * d; const py = y + Math.sin(a * 1.1) * d * 0.8;
    ctx.save(); ctx.translate(px, py); ctx.rotate(a);
    ctx.fillStyle = i % 3 ? '#7fc97f' : '#f2a65a';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.11, r * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (nucleus) blob(ctx, x, y, r * 0.3, '#8e7cc3', '#5b4a92', t * 0.6, 0.04);
}

// --- film 1: everything alive is made of cells ----------------------------------------

function drawCells(ctx, T) {
  // Earth scene: a girl and a tree; a magnifier circle opens on a leaf.
  const zoom = span(T, 2.5, 5);           // 0: the scene, 1: inside the lens fully
  const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  g.addColorStop(0, '#7cc4f2'); g.addColorStop(1, '#d8f0ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 370, STAGE_W, 80);
  rect(ctx, 150, 220, 26, 150, '#8c5a2b');
  circle(ctx, 163, 190, 85, '#4caf50');
  circle(ctx, 120, 220, 55, '#43a047');
  kid(ctx, 300, 345, { scale: 1.4, color: '#ff6fa8' });
  // the lens grows from the leaf to fill the stage
  const lx = lerp(200, 400, zoom); const ly = lerp(160, 225, zoom);
  const lr = lerp(34, 520, zoom * zoom);
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.clip();
  ctx.fillStyle = '#d7efc6'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  // the leaf's cells: a gently wobbling honeycomb of bricks
  const split = span(T, 7.5, 11);        // the middle cell splits in two
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 9; col++) {
      const cx = col * 96 + (row % 2 ? 48 : 0) + 20; const cy = row * 84 + 30;
      const mid = row === 2 && col === 4;
      if (mid && split > 0) continue;
      ctx.save();
      ctx.globalAlpha = 1 - 0.55 * span(T, 7, 8);   // the neighbours step back while one splits
      blob(ctx, cx, cy, 40, '#a8d98a', '#4f8f3a', T + row + col, 0.04);
      if (zoom > 0.6) cellInside(ctx, cx, cy, 40, T + col);
      ctx.restore();
    }
  }
  if (split > 0) {
    // stretch, pinch, two cells (ringed in gold so the eye finds it)
    const cx = 4 * 96 + 20; const cy = 2 * 84 + 30;
    circle(ctx, cx, cy, 88, 'rgba(255,255,255,0.75)', '#f4c542', 5);
    if (split < 0.5) {
      const s = 1 + split * 0.9;
      blob(ctx, cx, cy, 40, '#bfe7a4', '#2e7d32', T, 0.03, s);
      cellInside(ctx, cx - 14 * split, cy, 34, T, { nucleus: false });
      blob(ctx, cx - 18 * split * 2, cy, 12, '#8e7cc3', null, T);
      blob(ctx, cx + 18 * split * 2, cy, 12, '#8e7cc3', null, T);
    } else {
      const d = lerp(18, 30, (split - 0.5) * 2);
      for (const sgn of [-1, 1]) {
        blob(ctx, cx + sgn * d, cy, lerp(28, 32, (split - 0.5) * 2), '#bfe7a4', '#2e7d32', T + sgn, 0.04);
        cellInside(ctx, cx + sgn * d, cy, 30, T + sgn);
      }
    }
  }
  ctx.restore();
  // the lens rim and its handle
  circle(ctx, lx, ly, lr, null, '#3d3d3d', 8);
  if (zoom < 0.95) line(ctx, lx + lr * 0.7, ly + lr * 0.7, lx + lr * 0.7 + 50, ly + lr * 0.7 + 50, '#3d3d3d', 12);
  if (T > 5 && T < 7.5) label(ctx, 'A leaf, up close: it is made of cells', 400, 410, { size: 22 });
  if (split > 0) label(ctx, split < 1 ? 'A cell grows and splits...' : 'One cell becomes two!', 400, 410, { size: 22, color: '#2e7d32' });
  if (T > 11.5) label(ctx, 'You are made of cells too: trillions of them', 400, 40, { size: 22 });
}

// --- film 2: DNA, the recipe ----------------------------------------------------------

const BASE_COL = { A: '#ff7a3d', T: '#56b4e9', G: '#7ee787', C: '#ffd166' };
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const SEQ = 'ATGCGTACCATGGCTAAGTCGATC';

/** A rotating double helix along x from x0 to x1 around y; `open` unzips the right part. */
function helix(ctx, x0, x1, y, t, { open = 0, openFrom = 1, amp = 46, copy = 0 } = {}) {
  const n = SEQ.length;
  const step = (x1 - x0) / (n - 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    const ph = i * 0.55 + t * 1.6;
    const frac = n > 1 ? i / (n - 1) : 0;
    const op = frac >= openFrom ? open * clamp((frac - openFrom) * 6) : 0;   // 0..1 how far unzipped here
    const a = Math.sin(ph) * amp; const depth = Math.cos(ph);
    pts.push({ x, ya: y + a - op * 70, yb: y - a + op * 70, depth, op, base: SEQ[i] });
  }
  // rungs (base pairs) behind, then the two backbones
  for (const p of pts) {
    const mid = (p.ya + p.yb) / 2;
    if (p.op < 0.15) {
      line(ctx, p.x, p.ya, p.x, mid, BASE_COL[p.base], 6);
      line(ctx, p.x, mid, p.x, p.yb, BASE_COL[PAIR[p.base]], 6);
    } else {
      // unzipped: each half keeps its letter; new partners float in and click on
      line(ctx, p.x, p.ya, p.x, p.ya + 22, BASE_COL[p.base], 6);
      line(ctx, p.x, p.yb, p.x, p.yb - 22, BASE_COL[PAIR[p.base]], 6);
      if (copy > 0) {
        const k = clamp(copy * 1.6 - (1 - p.op));
        line(ctx, p.x, p.ya + 22 + (1 - k) * 30, p.x, p.ya + 44 + (1 - k) * 30, BASE_COL[PAIR[p.base]], 6);
        line(ctx, p.x, p.yb - 22 - (1 - k) * 30, p.x, p.yb - 44 - (1 - k) * 30, BASE_COL[p.base], 6);
        if (k > 0.95) {
          line(ctx, p.x - step / 2, p.ya + 44, p.x + step / 2, p.ya + 44, '#c9d1dc', 5);
          line(ctx, p.x - step / 2, p.yb - 44, p.x + step / 2, p.yb - 44, '#c9d1dc', 5);
        }
      }
    }
  }
  for (const key of ['ya', 'yb']) {
    ctx.save();
    ctx.strokeStyle = key === 'ya' ? '#e8eef7' : '#b8c4d6';
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p[key]); else ctx.lineTo(p.x, p[key]); });
    ctx.stroke();
    ctx.restore();
  }
  return pts;
}

function drawDNA(ctx, T) {
  ctx.fillStyle = '#1b1530'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  // a cell's nucleus opens up around a coil of DNA
  const into = span(T, 0, 2.5);
  if (into < 1) {
    blob(ctx, 400, 225, lerp(120, 600, into), '#2c2450', '#8e7cc3', T, 0.03);
    label(ctx, 'Inside the nucleus...', 400, 60, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.6)', alpha: 1 - into });
  }
  const show = span(T, 1.5, 3);
  if (show <= 0) return;
  ctx.save(); ctx.globalAlpha = show;
  const open = span(T, 7.5, 10);
  const copy = span(T, 9, 12);
  const pts = helix(ctx, 80, 720, 225, T, { open, openFrom: 0.45, copy });
  ctx.restore();
  // the four letters, shown as the bases flash by
  if (T > 3.5 && T < 7.5) {
    const k = span(T, 3.5, 4.5);
    ['A', 'T', 'G', 'C'].forEach((b, i) => {
      circle(ctx, 250 + i * 100, 395, 22, BASE_COL[b]);
      label(ctx, b, 250 + i * 100, 396, { size: 24, color: '#1b1530', halo: null, alpha: k });
    });
    label(ctx, 'A 4-letter alphabet: the order of the letters is the recipe', 400, 50, { size: 21, color: '#fff', halo: 'rgba(0,0,0,0.6)', alpha: k });
    // letters read along the top strand
    const at = Math.floor(lin(T, 4.5, 7.4) * 10);
    const word = SEQ.slice(0, at);
    label(ctx, word, 400, 340, { size: 24, color: '#ffe08a', halo: 'rgba(0,0,0,0.6)' });
  }
  if (T >= 7.5) {
    label(ctx, 'It unzips, and each half is copied', 400, 50, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
    if (copy > 0.9) label(ctx, 'Two copies of the recipe: one for each new cell', 400, 405, { size: 22, color: '#7ee787', halo: 'rgba(0,0,0,0.6)' });
  }
  void pts;
}

// --- film 3: proteins, the cell's tiny machines --------------------------------------

const BEAD_COLS = ['#ff7a3d', '#56b4e9', '#7ee787', '#ffd166', '#c78bff', '#ff8fb1', '#56d4ff', '#f4c542'];

function drawProtein(ctx, T) {
  ctx.fillStyle = '#10213a'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  // the recipe strand runs across; a ribosome slides along it
  const strandY = 110;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const x = 70 + i * 28;
    const b = SEQ[i % SEQ.length];
    line(ctx, x, strandY, x, strandY + 20, BASE_COL[b], 6);
  }
  line(ctx, 60, strandY, 740, strandY, '#e8eef7', 6);
  label(ctx, 'a copy of the DNA recipe', 400, 70, { size: 18, color: '#cfe6ff', halo: 'rgba(0,0,0,0.5)' });
  const read = lin(T, 1.5, 8);              // 0..1 along the strand
  const beads = Math.min(8, Math.floor(read * 8 + 0.0001));
  const rx = lerp(90, 700, read);
  // ribosome: two blobs clamped on the strand
  blob(ctx, rx, strandY - 14, 34, '#5c6bc0', null, T, 0.03, 1.3);
  blob(ctx, rx, strandY + 36, 44, '#3949ab', null, T + 1, 0.03, 1.3);
  if (T > 1 && T < 4) label(ctx, 'The builder reads 3 letters at a time', rx, strandY + 110, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  // the bead chain hangs from the ribosome, then folds into a shape
  const fold = span(T, 8.5, 10.5);
  const work = span(T, 11, 13);
  const chain = [];
  for (let i = 0; i < beads + (read >= 1 ? 0 : 0); i++) {
    // hanging: a wavy line down from the ribosome; folded: around a circle
    const hx = rx + Math.sin(i * 0.9 + T * 2) * 10 - i * 4; const hy = strandY + 86 + i * 25;
    const a = -0.6 + (i / 8) * (TAU - 1.2);
    const fx = 400 + Math.cos(a) * 70; const fy = 300 + Math.sin(a) * 70;
    chain.push({ x: lerp(hx, fx, fold), y: lerp(hy, fy, fold), c: BEAD_COLS[i] });
  }
  if (fold > 0.5) {
    // the folded shape behind the beads: a "mouth" that opens and shuts
    const m = 0.35 + 0.25 * Math.abs(Math.sin(T * 4)) * span(T, 11, 13);
    ctx.save();
    ctx.globalAlpha = span(T, 9.5, 10.5) * 0.9;
    ctx.fillStyle = '#2f6f5e';
    ctx.beginPath(); ctx.moveTo(400, 300); ctx.arc(400, 300, 92, m, TAU - m); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (let i = 1; i < chain.length; i++) line(ctx, chain[i - 1].x, chain[i - 1].y, chain[i].x, chain[i].y, '#c9d1dc', 4);
  for (const b of chain) circle(ctx, b.x, b.y, 14, b.c, '#0b1222', 2);
  if (fold > 0.98) {
    // the folded protein: a "mouth" that chomps a sugar into two pieces
    const sx = lerp(620, 470, span(T, 11, 12));
    const cut = T > 12.2;
    if (!cut) {
      rect(ctx, sx - 30, 290, 28, 20, '#fff2a8', 4);
      rect(ctx, sx, 290, 28, 20, '#fff2a8', 4);
    } else {
      const d = (T - 12.2) * 60;
      rect(ctx, 470 + d - 30, 290 - d * 0.6, 28, 20, '#fff2a8', 4);
      rect(ctx, 470 + d + 6, 290 + d * 0.6, 28, 20, '#fff2a8', 4);
    }
    label(ctx, 'A protein: a tiny machine with a job', 400, 410, { size: 22, color: '#7ee787', halo: 'rgba(0,0,0,0.6)' });
    if (work > 0) label(ctx, 'this one cuts sugar for energy', 620, 245, { size: 17, color: '#fff2a8', halo: 'rgba(0,0,0,0.6)' });
  } else if (beads > 0) {
    label(ctx, `${beads} ${beads === 1 ? 'bead' : 'beads'} joined in order`, 620, 380, { size: 18, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  }
}

export const LESSON_4G = {
  id: 'ch4_life',
  eyebrow: ['Biology lesson: what makes something alive?', 'Biology lesson'],
  narrator: NARRATOR,
  films: [
    {
      title: ['Everything alive is made of cells', 'Made of cells'],
      beats: [
        { dur: 2.5, cap: ['Before we drill for life, let’s see what life is made of. Look closely at a leaf...', 'What is life made of? Look at a leaf...'] },
        { dur: 5, cap: ['Up close, the leaf is made of tiny living boxes called cells, each with a nucleus in the middle.', 'It is made of tiny boxes called cells.'] },
        { dur: 5, cap: ['A cell grows, then splits into two. That is how living things grow. You are made of cells too!', 'A cell splits into two. You are made of cells too!'] },
      ],
      draw: drawCells,
      clue: [null, 'All living things are made of tiny cells.'],
      question: {
        prompt: ['What are all living things made of?', 'What are living things made of?'],
        choices: [
          { text: ['Tiny living units called cells', 'Tiny cells'], correct: true },
          { text: ['Grains of rock and sand', 'Rocks and sand'] },
          { text: ['Only water and nothing else', 'Only water'] },
        ],
        hint: ['What did the lens show inside the leaf?', 'What was inside the leaf?'],
        why: ['Every plant, animal and person is built from cells, and new cells come from a cell splitting in two.', 'All living things are made of cells!'],
      },
    },
    {
      title: ['DNA: the recipe', 'DNA: the recipe'],
      beats: [
        { dur: 3, cap: ['Inside the nucleus is DNA: a long, twisted ladder.', 'Inside is DNA, a twisted ladder.'] },
        { dur: 4.5, cap: ['Its rungs use just four letters: A, T, G and C. Their order spells out how to build the living thing.', 'It has 4 letters: A, T, G, C. They are a recipe.'] },
        { dur: 4.5, cap: ['When a cell splits, the ladder unzips and each half is copied, so both new cells get the recipe.', 'It unzips and copies, so each new cell gets the recipe.'] },
      ],
      draw: drawDNA,
      clue: [null, 'DNA is a recipe for the living thing.'],
      question: {
        prompt: ['What does DNA do?', 'What is DNA?'],
        choices: [
          { text: ['It holds the instructions for building the living thing', 'A recipe for the living thing'], correct: true },
          { text: ['It makes the cell glow so it can see in the dark', 'A light for the cell'] },
          { text: ['It stores the cell’s food for later', 'Food for the cell'] },
        ],
        hint: ['The four letters spell something out. What?', 'Think about the letters.'],
        why: ['DNA’s letters are a recipe: their order tells the cell what to build, and copies go to each new cell.', 'DNA is the recipe for life!'],
      },
    },
    {
      title: ['Proteins: tiny machines', 'Proteins: tiny machines'],
      beats: [
        { dur: 1.5, cap: ['How does a cell use the recipe? A builder slides along a copy of it.', 'A builder reads the recipe.'] },
        { dur: 6.5, cap: ['Every 3 letters, it adds one bead to a chain, always in the order the recipe says.', 'It joins beads in a chain, in order.'] },
        { dur: 2.5, cap: ['The finished chain folds into a shape. It is a protein.', 'The chain folds up. It is a protein!'] },
        { dur: 3, cap: ['Each protein is a tiny machine with a job, like cutting up sugar for energy. Now let’s drill Europa and look for signs of life!', 'Proteins do jobs. Now let’s look for life on Europa!'] },
      ],
      draw: drawProtein,
      clue: [null, 'The builder reads the recipe and joins beads in order.'],
      question: {
        prompt: ['How does a cell build a protein?', 'How is a protein made?'],
        choices: [
          { text: ['It follows DNA’s recipe, joining beads in order', 'Beads joined using the recipe'], correct: true },
          { text: ['It digs the protein out of rocks nearby', 'It is dug out of rocks'] },
          { text: ['Sunlight paints it onto the outside', 'Sunlight paints it'] },
        ],
        hint: ['What did the builder read before adding each bead?', 'What did the builder read?'],
        why: ['The builder reads the recipe and joins beads in that order; the chain folds into a protein that does a job.', 'The recipe says which beads go in, then it folds up!'],
      },
    },
  ],
};
