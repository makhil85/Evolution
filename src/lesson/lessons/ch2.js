// Chapter 2 lessons (LESSONS_PLAN.md 2A, 2B). Each film draws on the 800x450
// stage from src/lesson/draw.js; T is authored seconds. Pitfall carried from
// Chapter 3: the LAST frame must still show the answer (nothing leaves the
// stage, arrows and labels stay on), because the question is asked over it.
import { C, span, lin, lerp, clamp, daySky, label, arrow, kid, circle, rect, line, STAGE_W } from '../draw.js';

const NARRATOR_2A = ['City Engineer', 'City Engineer'];
const NARRATOR_2B = ['Storyteller', 'Storyteller'];

// --- 2A. Why bridges use triangles ----------------------------------------------------

/** Four pinned sticks; `shear` moves the top corners sideways. */
function frame(ctx, x, y, s, shear, { brace = false, color = C.wood } = {}) {
  const bl = [x, y]; const br = [x + s, y];
  const tl = [x + shear, y - s]; const tr = [x + s + shear, y - s];
  for (const [a, b] of [[bl, br], [br, tr], [tr, tl], [tl, bl]]) line(ctx, a[0], a[1], b[0], b[1], color, 9);
  if (brace) line(ctx, bl[0], bl[1], tr[0], tr[1], '#8c5a2b', 9);
  for (const p of [bl, br, tl, tr]) circle(ctx, p[0], p[1], 6, '#5b6270');
  return { tl, tr };
}

function hand(ctx, x, y, push) {
  ctx.save();
  ctx.globalAlpha = 0.95;
  circle(ctx, x, y, 15, '#f2c6a0', C.ink, 2);
  line(ctx, x - 15, y, x - 60, y, '#f2c6a0', 12);
  ctx.restore();
  if (push) arrow(ctx, x - 70, y - 30, x - 10, y - 30, C.push, 7);
}

function drawSquares(ctx, T) {
  daySky(ctx, 380);
  const sh = 75 * span(T, 3, 6) - 150 * span(T, 7, 9.5) + 75 * span(T, 10.5, 12.5);
  const { tl } = frame(ctx, 330, 340, 170, sh);
  if (T > 2.5) hand(ctx, tl[0] - 18, tl[1], T < 6 || (T > 10.5 && T < 12.5));
  if (T > 6) label(ctx, 'The corners swing: the square squashes', STAGE_W / 2, 60, { size: 24 });
}

function drawTriangles(ctx, T) {
  daySky(ctx, 380);
  const shake = T > 3 && T < 6 ? Math.sin(T * 60) * 2 : 0;
  const { tl } = frame(ctx, 170, 340, 170, shake, { brace: true });
  if (T > 2.5 && T < 6.5) hand(ctx, tl[0] - 18, tl[1], true);
  label(ctx, 'One stick across: two triangles', 255, 120, { size: 20, alpha: span(T, 0.5, 1.5) });
  const a = span(T, 6.5, 8);
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a;
    const x = 480; const y = 340; const s = 170;
    line(ctx, x, y, x + s, y, C.wood, 9);
    line(ctx, x + s, y, x + s / 2, y - s * 0.87, C.wood, 9);
    line(ctx, x + s / 2, y - s * 0.87, x, y, C.wood, 9);
    for (const p of [[x, y], [x + s, y], [x + s / 2, y - s * 0.87]]) circle(ctx, p[0], p[1], 6, '#5b6270');
    label(ctx, 'A triangle on its own', x + s / 2, 120, { size: 20 });
    ctx.restore();
  }
  if (T > 8.5) label(ctx, 'Triangles stay firm!', STAGE_W / 2, 60, { size: 28, color: '#1f8a4c' });
}

function banks(ctx) {
  daySky(ctx, 300, C.ground);
  ctx.fillStyle = C.water;
  ctx.fillRect(170, 300, 460, 150);
  ctx.fillStyle = C.earth;
  ctx.fillRect(0, 300, 170, 150); ctx.fillRect(630, 300, 170, 150);
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 300, 170, 12); ctx.fillRect(630, 300, 170, 12);
}

function truck(ctx, x, y) {
  rect(ctx, x - 40, y - 34, 56, 30, '#e05252', 4);
  rect(ctx, x + 16, y - 26, 26, 22, '#c43d3d', 4);
  rect(ctx, x + 22, y - 22, 14, 10, '#bfe6ff', 2);
  circle(ctx, x - 26, y - 2, 8, C.ink); circle(ctx, x + 28, y - 2, 8, C.ink);
}

function drawTruss(ctx, T) {
  banks(ctx);
  const truss = T >= 6;
  const k = truss ? lin(T, 6.5, 11) : lin(T, 0.5, 5.5);
  const tx = lerp(110, 690, k);
  const onSpan = clamp((tx - 170) / 460);
  const load = tx > 170 && tx < 630 ? Math.sin(onSpan * Math.PI) : 0;
  const sag = truss ? load * 3 : load * 55;
  const deckY = (x) => 300 + (x > 170 && x < 630 ? sag * Math.sin(((x - 170) / 460) * Math.PI) : 0);
  // deck
  ctx.save();
  ctx.strokeStyle = truss ? C.wood : (load > 0.5 ? C.bad : C.wood);
  ctx.lineWidth = 12;
  ctx.beginPath();
  for (let x = 170; x <= 630; x += 10) { if (x === 170) ctx.moveTo(x, deckY(x)); else ctx.lineTo(x, deckY(x)); }
  ctx.stroke();
  ctx.restore();
  if (truss) {
    // a row of triangles on top: bottom nodes every 92, top nodes in between
    const top = 210;
    for (let i = 0; i < 5; i++) {
      const x0 = 170 + i * 92; const x1 = x0 + 92; const xm = x0 + 46;
      line(ctx, x0, deckY(x0), xm, top, C.wood, 7);
      line(ctx, xm, top, x1, deckY(x1), C.wood, 7);
      if (i < 4) line(ctx, xm, top, xm + 92, top, C.wood, 7);
    }
  }
  truck(ctx, tx, deckY(tx) - 6);
  if (!truss) {
    if (load > 0.5) label(ctx, 'The plank bends!', 400, 120, { size: 26, color: '#b3261e' });
  } else {
    const a = span(T, 8, 9);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      arrow(ctx, 390, 230, 200, 290, C.push, 7);
      arrow(ctx, 410, 230, 600, 290, C.push, 7);
      ctx.restore();
      label(ctx, 'The triangles carry the weight to both banks', STAGE_W / 2, 80, { size: 22, alpha: a });
    }
  }
}

export const LESSON_2A = {
  id: 'ch2_triangles',
  eyebrow: ['Engineering lesson: why bridges use triangles', 'Engineering lesson'],
  narrator: NARRATOR_2A,
  films: [
    {
      title: ['Squares wobble', 'Squares wobble'],
      beats: [
        { dur: 3, cap: ['Four sticks, pinned at the corners, make a square frame.', 'Four sticks make a square.'] },
        { dur: 3.5, cap: ['A gentle push on the top corner... it squashes into a lopsided diamond!', 'Push the top... it squashes!'] },
        { dur: 6, cap: ['Push the other way: it flops back over. Its corners can swing, so its shape can change.', 'It flops the other way too.'] },
      ],
      draw: drawSquares,
      clue: [null, 'The corners can swing. So the square squashes.'],
      question: {
        prompt: ['Why did the square frame squash?', 'Why did the square squash?'],
        choices: [
          { text: ['Its corners can swing, so its shape changes', 'Its corners can swing'], correct: true },
          { text: ['Its sticks were cut a little too short', 'The sticks were short'] },
          { text: ['The frame was far too heavy to stand', 'It was too heavy'] },
        ],
        hint: ['Did the sticks change, or only the corners?', 'Watch the corners.'],
        why: ['The sticks stayed the same length; the corners turned. A square can change shape without bending anything.', 'The corners swing, so the square can squash.'],
      },
    },
    {
      title: ['Triangles hold', 'Triangles hold'],
      beats: [
        { dur: 2.5, cap: ['Now add one diagonal stick. The square becomes two triangles.', 'Add one stick across: two triangles.'] },
        { dur: 4, cap: ['The same push... and nothing moves, just a little shake.', 'Push... nothing moves!'] },
        { dur: 4.5, cap: ['A triangle can’t change shape unless one of its sticks gets longer. That makes it firm.', 'Triangles stay firm.'] },
      ],
      draw: drawTriangles,
      clue: [null, 'The triangle did not move. Triangles stay firm!'],
      question: {
        prompt: ['Which shape stays firm when you push it?', 'Which shape stays firm?'],
        choices: [
          { text: ['A triangle', 'A triangle'], correct: true },
          { text: ['A square', 'A square'] },
          { text: ['A circle of string', 'A circle of string'] },
        ],
        hint: ['Which frame didn’t move when the hand pushed?', 'Which one did not move?'],
        why: ['Three sticks pinned together can only make one shape, so a triangle holds firm.', 'A triangle can’t squash!'],
      },
    },
    {
      title: ['The truss bridge', 'The bridge'],
      beats: [
        { dur: 6, cap: ['A truck drives over a flat plank bridge. In the middle, the plank sags.', 'A truck on a flat plank: it bends!'] },
        { dur: 2.5, cap: ['Now the same bridge with triangles built on top. This is called a truss.', 'Now add triangles on top.'] },
        { dur: 4, cap: ['The truck crosses and the bridge stays straight: the triangles carry the weight to both banks.', 'It stays straight! The triangles help.'] },
      ],
      draw: drawTruss,
      clue: [null, 'Triangles hold the weight up. The bridge stays straight.'],
      question: {
        prompt: ['Why do many bridges have triangles on top?', 'Why do bridges have triangles?'],
        choices: [
          { text: ['They spread the truck’s weight to the banks', 'They hold the weight up'], correct: true },
          { text: ['Triangles look nice to the drivers', 'They look nice'] },
          { text: ['They make the bridge lighter than air', 'They make it float'] },
        ],
        hint: ['Follow the orange arrows on the triangle bridge.', 'Look at the arrows.'],
        why: ['The triangles pass the weight along their sticks to both banks, so the middle doesn’t sag.', 'Triangles carry the weight to the sides!'],
      },
    },
  ],
};

// --- 2B. Archimedes and the king's crown ----------------------------------------------

function tub(ctx, x, y, w, h, level, spill) {
  // water
  ctx.fillStyle = C.water;
  ctx.fillRect(x + 6, y + h - level, w - 12, level - 6);
  // tub
  ctx.save();
  ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 10; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.restore();
  if (spill > 0) {
    ctx.save(); ctx.globalAlpha = clamp(spill);
    // a sheet of water over the right lip and a puddle below
    ctx.fillStyle = C.water;
    ctx.fillRect(x + w, y - 2, 8, h);
    ctx.beginPath(); ctx.ellipse(x + w + 40, y + h + 6, 40 + 40 * spill, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function columns(ctx) {
  ctx.fillStyle = '#f4ede0';
  ctx.fillRect(0, 0, STAGE_W, 380);
  for (const x of [60, 720]) {
    rect(ctx, x, 60, 30, 320, '#e2d6bf');
    rect(ctx, x - 10, 50, 50, 14, '#d3c5a8');
    rect(ctx, x - 10, 370, 50, 12, '#d3c5a8');
  }
  ctx.fillStyle = '#cdb98f';
  ctx.fillRect(0, 380, STAGE_W, 70);
}

function drawBath(ctx, T) {
  columns(ctx);
  const inK = span(T, 2, 6);
  const level = 120 + inK * 4;
  const spill = lin(T, 3, 7);
  const ax = 400; const ay = lerp(150, 285, inK);
  // Archimedes: robe and beard
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, STAGE_W, 380 - 125 + 8); ctx.clip();
  kid(ctx, ax, ay, { scale: 1.5, color: '#ffffff', armUp: T > 7 ? 1 : 0 });
  ctx.restore();
  tub(ctx, 260, 250, 280, 130, level, spill);
  circle(ctx, ax, ay - 52, 7, '#bdb6a8');
  if (T > 7) label(ctx, '“Eureka!” (I found it!)', ax, 90, { size: 30, color: '#a5671b' });
  if (spill > 0.4) label(ctx, 'His body pushes water aside', 640, 230, { size: 18, alpha: span(T, 4, 5) });
}

/** A two-pan balance; `tilt` > 0 drops the left pan. */
function balance(ctx, x, y, tilt, left, right) {
  rect(ctx, x - 6, y, 12, 150, '#7d6a4c');
  rect(ctx, x - 50, y + 150, 100, 12, '#7d6a4c');
  const a = tilt * 0.25;
  const dx = Math.cos(a) * 170; const dy = Math.sin(a) * 170;
  line(ctx, x - dx, y + dy, x + dx, y - dy, '#7d6a4c', 8);
  circle(ctx, x, y, 8, '#5b4b33');
  for (const [px, py, draw] of [[x - dx, y + dy, left], [x + dx, y - dy, right]]) {
    line(ctx, px, py, px - 40, py + 60, '#7d6a4c', 2);
    line(ctx, px, py, px + 40, py + 60, '#7d6a4c', 2);
    line(ctx, px - 50, py + 60, px + 50, py + 60, '#7d6a4c', 6);
    draw(px, py + 57);
  }
}

const goldBar = (ctx, x, y, s = 1) => rect(ctx, x - 22 * s, y - 20 * s, 44 * s, 20 * s, C.gold, 3);
const silverBar = (ctx, x, y, s = 1) => rect(ctx, x - 32 * s, y - 30 * s, 64 * s, 30 * s, C.silver, 3);
function crown(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#e8b93a';
  ctx.beginPath();
  ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(34, -34); ctx.lineTo(17, -16); ctx.lineTo(0, -38); ctx.lineTo(-17, -16); ctx.lineTo(-34, -34); ctx.closePath();
  ctx.fill();
  circle(ctx, 0, -10, 4, '#d6455d');
  ctx.restore();
}

/** A full bowl with an object sinking in and a jug catching the overflow. */
function bowlAndJug(ctx, x, sink, spillLevel, drawObj, tag) {
  const y = 330;
  // jug (measuring)
  rect(ctx, x + 70, y - 70, 50, 80, 'rgba(255,255,255,0.55)', 4);
  rect(ctx, x + 72, y + 8 - spillLevel, 46, spillLevel, C.water, 2);
  for (let k = 1; k < 4; k++) line(ctx, x + 70, y + 10 - k * 20, x + 82, y + 10 - k * 20, '#6b7280', 2);
  // bowl
  ctx.fillStyle = C.water;
  ctx.beginPath(); ctx.ellipse(x, y - 22, 62, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9cdb5';
  ctx.beginPath(); ctx.moveTo(x - 66, y - 24); ctx.quadraticCurveTo(x, y + 60, x + 66, y - 24); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath(); ctx.moveTo(x - 60, y - 22); ctx.quadraticCurveTo(x, y + 48, x + 60, y - 22); ctx.closePath(); ctx.fill();
  if (spillLevel > 1) line(ctx, x + 64, y - 22, x + 95, y - 60 + 60 - spillLevel * 0.2, C.water, 4);
  // the object, lowered from above into the water
  drawObj(x, lerp(150, y + 4, sink));
  label(ctx, tag, x, 395, { size: 18 });
}

function drawSameWeight(ctx, T) {
  columns(ctx);
  if (T < 4.5) {
    balance(ctx, 400, 140, 0, (x, y) => goldBar(ctx, x, y), (x, y) => silverBar(ctx, x, y));
    label(ctx, 'gold', 230, 120, { size: 20 });
    label(ctx, 'silver', 570, 120, { size: 20 });
    label(ctx, 'Same weight: the balance is level', 400, 60, { size: 22, alpha: span(T, 1, 2) });
    return;
  }
  const sink = span(T, 5, 8);
  const flow = span(T, 6, 10);
  bowlAndJug(ctx, 220, sink, 22 * flow, (x, y) => goldBar(ctx, x, y), 'gold');
  bowlAndJug(ctx, 520, sink, 50 * flow, (x, y) => silverBar(ctx, x, y), 'silver');
  if (T > 9) label(ctx, 'The bigger silver bar pushes out more water', 400, 60, { size: 22 });
}

function drawCrownTest(ctx, T) {
  columns(ctx);
  if (T < 4.5) {
    balance(ctx, 400, 140, 0, (x, y) => crown(ctx, x, y), (x, y) => goldBar(ctx, x, y));
    label(ctx, 'the crown', 230, 120, { size: 20 });
    label(ctx, 'pure gold', 570, 120, { size: 20 });
    label(ctx, 'The same weight as the crown', 400, 60, { size: 22, alpha: span(T, 1, 2) });
    return;
  }
  const sink = span(T, 5, 8);
  const flow = span(T, 6, 10);
  bowlAndJug(ctx, 220, sink, 40 * flow, (x, y) => crown(ctx, x, y), 'the crown');
  bowlAndJug(ctx, 520, sink, 22 * flow, (x, y) => goldBar(ctx, x, y), 'pure gold');
  if (T > 9.5) label(ctx, 'The crown spills more: it is not pure gold!', 400, 60, { size: 24, color: '#b3261e' });
}

export const LESSON_2B = {
  id: 'ch2_archimedes',
  eyebrow: ['History lesson: Archimedes and the king’s crown', 'History lesson'],
  narrator: NARRATOR_2B,
  films: [
    {
      title: ['The bath', 'The bath'],
      beats: [
        { dur: 2, cap: ['Long ago, in Syracuse, King Hiero asked Archimedes: is my new crown pure gold?', 'Long ago, a king asked: is my crown real gold?'] },
        { dur: 5, cap: ['Thinking hard, Archimedes stepped into a full bath. Water spilled over the side!', 'Archimedes got in the bath. Water spilled out!'] },
        { dur: 4, cap: ['His body pushed the water aside. He jumped up shouting “Eureka!”: I found it!', 'He shouted “Eureka!”: I found it!'] },
      ],
      draw: drawBath,
      clue: [null, 'His body took up room. It pushed the water out.'],
      question: {
        prompt: ['Why did the bath overflow when Archimedes got in?', 'Why did the water spill?'],
        choices: [
          { text: ['His body pushed the water aside', 'His body pushed it out'], correct: true },
          { text: ['The water suddenly got very hot', 'The water got hot'] },
          { text: ['Someone had left the tap running', 'The tap was on'] },
        ],
        hint: ['When did the water start to spill?', 'When did it spill?'],
        why: ['Something put in water pushes its own size of water out of the way. In a full bath, that water spills.', 'He took up room, so the water had to go!'],
      },
    },
    {
      title: ['Same weight, different size', 'Same weight, different size'],
      beats: [
        { dur: 4.5, cap: ['A gold bar and a silver bar weigh exactly the same. But silver is lighter for its size, so its bar is bigger.', 'Gold and silver weigh the same. The silver bar is bigger.'] },
        { dur: 3.5, cap: ['Lower each one into a full bowl. The spilled water runs into a jug.', 'Put each one in a full bowl.'] },
        { dur: 4, cap: ['The bigger silver bar pushes out more water: its jug fills higher.', 'The big silver bar spills more water!'] },
      ],
      draw: drawSameWeight,
      clue: [null, 'The silver bar is bigger. Bigger spills more water.'],
      question: {
        prompt: ['A gold bar and a silver bar weigh the same. Which pushes out more water?', 'Which bar spills more water?'],
        choices: [
          { text: ['The silver bar, because it is bigger', 'The silver bar'], correct: true },
          { text: ['The gold bar, because gold is special', 'The gold bar'] },
          { text: ['Both push out exactly the same', 'Both the same'] },
        ],
        hint: ['Compare the two jugs at the end.', 'Which jug is fuller?'],
        why: ['A bigger object pushes aside more water, even when it weighs the same.', 'Bigger things spill more water!'],
      },
    },
    {
      title: ['The crown test', 'The crown test'],
      beats: [
        { dur: 4.5, cap: ['Archimedes balanced the crown against a bar of pure gold: exactly the same weight.', 'The crown and real gold weigh the same.'] },
        { dur: 3.5, cap: ['Then he lowered each into a full bowl of water.', 'Put each one in water.'] },
        { dur: 4, cap: ['The crown spilled more! It was bigger, so cheaper, lighter metal was mixed in. The goldsmith was caught!', 'The crown spilled more. It was not all gold!'] },
      ],
      draw: drawCrownTest,
      clue: [null, 'The crown spilled more. So it is not all gold.'],
      question: {
        prompt: ['The crown spilled more water than pure gold of the same weight. What does that mean?', 'The crown spilled more. What does it mean?'],
        choices: [
          { text: ['It isn’t pure gold: lighter metal is mixed in', 'It is not all gold'], correct: true },
          { text: ['It is extra-pure, extra-special gold', 'It is super gold'] },
          { text: ['The water in that bowl was dirty', 'The water was dirty'] },
        ],
        hint: ['Remember the silver bar: what did bigger mean?', 'Remember the silver bar.'],
        why: ['Same weight but bigger means a lighter metal is inside. Archimedes proved it without hurting the crown.', 'It was bigger, so it was not all gold!'],
      },
    },
  ],
};
