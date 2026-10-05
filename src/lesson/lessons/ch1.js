// Chapter 1 lessons (LESSONS_PLAN.md 1A, 1B): two history lessons told as a
// story ("Long ago, in ancient Greece..."). Each film draws on the 800x450
// stage from src/lesson/draw.js; T is authored seconds.
//
// Pitfalls carried from Chapters 3 and 2: the last frame must still show the
// answer (nothing leaves the stage, labels stay on); keep force/label arrows off
// the figures; every caption is a [Level 4, Level 1] pair.
import { C, span, lin, lerp, clamp, nightSky, label, circle, rect, line, arrow, kid, STAGE_W } from '../draw.js';

const NARRATOR = ['Storyteller', 'Storyteller'];

// --- 1A. The round Earth: clues from long ago -----------------------------------------

function drawEclipse(ctx, T) {
  nightSky(ctx, 11);
  // Sun, Earth, and the Moon sliding into the shadow
  circle(ctx, 70, 225, 48, C.sun);
  label(ctx, 'Sun', 70, 300, { size: 18, color: '#ffe08a', halo: 'rgba(0,0,0,0.6)' });
  circle(ctx, 300, 225, 38, '#3f8fd9');
  ctx.fillStyle = '#5bb36b';
  ctx.beginPath(); ctx.arc(300, 225, 38, -0.6, 0.9); ctx.fill();
  label(ctx, 'Earth', 300, 290, { size: 18, color: '#cfe6ff', halo: 'rgba(0,0,0,0.6)' });
  // the shadow cone behind the Earth
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.moveTo(300, 187); ctx.lineTo(560, 205); ctx.lineTo(560, 245); ctx.lineTo(300, 263); ctx.fill();
  // the Moon, close up on the right, with the round shadow edge creeping over it
  const mx = 640; const my = 225; const mr = 70;
  circle(ctx, mx, my, mr, '#e8e4d8');
  const k = span(T, 2, 9);
  ctx.save();
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.clip();
  circle(ctx, lerp(mx - 230, mx - 100, k), my + 10, 120, 'rgba(60,20,10,0.78)');
  ctx.restore();
  circle(ctx, mx, my, mr, null, '#ffffff', 2);
  if (T > 6) label(ctx, 'The shadow’s edge is always curved', 560, 70, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  if (T > 9) label(ctx, 'Only a ball always casts a round shadow', 400, 400, { size: 22, color: '#ffe08a', halo: 'rgba(0,0,0,0.6)' });
}

function drawShips(ctx, T) {
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, STAGE_W, 450);
  const R = 1300; const cx = 400; const cy = 200 + R;
  const surfaceY = (x) => cy - Math.sqrt(R * R - (x - cx) * (x - cx));
  // The ship sails out, then slips behind the bulge of the sea from the
  // bottom up: hull first, the mast top last (still showing in the last frame).
  // The sea is drawn AFTER the ship, so the water itself hides the hull.
  const x = lerp(250, 650, span(T, 0.5, 5));
  const sink = 82 * span(T, 4.5, 10.5);
  const sc = lerp(1, 0.75, span(T, 0.5, 5));
  ctx.save();
  ctx.translate(x, surfaceY(x) + 4 + sink); ctx.scale(sc, sc);
  ctx.fillStyle = '#7a4b2a';
  ctx.beginPath(); ctx.moveTo(-50, -20); ctx.lineTo(50, -20); ctx.lineTo(36, 0); ctx.lineTo(-36, 0); ctx.closePath(); ctx.fill();
  line(ctx, 0, -20, 0, -140, '#5a3a22', 5);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(4, -130); ctx.lineTo(48, -40); ctx.lineTo(4, -40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.bad;
  ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(22, -133); ctx.lineTo(0, -126); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.waterDeep;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // the watcher on the shore at the left
  rect(ctx, 0, 300, 120, 150, '#d9c38f');
  kid(ctx, 70, 290, { scale: 1.1, color: '#6fa8ff' });
  if (T > 6) label(ctx, 'The hull goes first, the mast top last', 470, 70, { size: 22 });
  if (T > 9.5) label(ctx, 'The sea curves away and hides it', 470, 110, { size: 22, color: '#1f5fa8' });
}

function drawStars(ctx, T) {
  nightSky(ctx, 23);
  // curved ground: Greece on the left, Egypt on the right
  const R = 900; const cx = 400; const cy = 380 + R;
  ctx.fillStyle = '#3c5a3a';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'Greece', 150, 420, { size: 18, color: '#cfe6ff', halo: 'rgba(0,0,0,0.6)' });
  label(ctx, 'Egypt', 650, 420, { size: 18, color: '#cfe6ff', halo: 'rgba(0,0,0,0.6)' });
  const k = span(T, 1, 9);
  const ang = lerp(-0.28, 0.28, k);
  const tx = cx + Math.sin(ang) * R; const ty = cy - Math.cos(ang) * R;
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
  kid(ctx, 0, -26, { scale: 0.9, color: '#f0b46a' });
  ctx.restore();
  // a bright southern star: low over the edge at the start, higher as she walks south
  const starY = lerp(330, 150, k);
  circle(ctx, 640, starY, 7, '#fff7c2');
  circle(ctx, 640, starY, 14, 'rgba(255,247,194,0.25)');
  // new stars appear above the southern edge
  for (const [x, y, a] of [[700, 300, 4], [740, 250, 5], [600, 280, 6]]) {
    const vis = span(T, a, a + 1.5);
    if (vis > 0) { ctx.save(); ctx.globalAlpha = vis; circle(ctx, x, y, 5, '#cde8ff'); ctx.restore(); }
  }
  if (T > 4) label(ctx, 'New stars rise in the south', 600, 60, { size: 22, color: '#fff', halo: 'rgba(0,0,0,0.6)' });
  if (T > 9) label(ctx, 'She is walking round a curved Earth', 400, 100, { size: 22, color: '#ffe08a', halo: 'rgba(0,0,0,0.6)' });
}

export const LESSON_1A = {
  id: 'ch1_round_earth',
  eyebrow: ['History lesson: the round Earth', 'History lesson'],
  narrator: NARRATOR,
  films: [
    {
      title: ['The shadow on the Moon', 'The Moon’s shadow'],
      beats: [
        { dur: 2, cap: ['Long ago, in ancient Greece, Aristotle watched an eclipse of the Moon.', 'Long ago, in Greece, people watched the Moon.'] },
        { dur: 4, cap: ['The Sun, the Earth and the Moon lined up, and the Earth’s shadow crept across the Moon.', 'The Earth’s shadow crept over the Moon.'] },
        { dur: 5, cap: ['Its edge was always a curve. Only a ball casts a round shadow every time.', 'The shadow was round. The Earth is round!'] },
      ],
      draw: drawEclipse,
      clue: [null, 'The Earth’s shadow is round. So the Earth is round!'],
      question: {
        prompt: ['During an eclipse, the Earth’s shadow on the Moon is always curved. What does that tell us?', 'The shadow is round. What does it tell us?'],
        choices: [
          { text: ['The Earth is round like a ball', 'The Earth is round'], correct: true },
          { text: ['The Moon is completely flat', 'The Moon is flat'] },
          { text: ['The Sun is curved like a bowl', 'The Sun is curved'] },
        ],
        hint: ['Whose shadow is it?', 'It is the Earth’s shadow.'],
        why: ['The shadow is the Earth’s. A ball casts a round shadow from every side, so the Earth must be a ball.', 'A round shadow means a round Earth!'],
      },
    },
    {
      title: ['Ships over the horizon', 'Ships far away'],
      beats: [
        { dur: 3, cap: ['A girl on the shore watches a ship sail away.', 'A girl watches a ship sail away.'] },
        { dur: 4, cap: ['First the hull disappears, then the sail, and the top of the mast last of all.', 'The bottom goes first, the top last.'] },
        { dur: 4, cap: ['On a flat sea it would just shrink to a dot. The sea curves away and hides the bottom first.', 'The sea curves and hides it!'] },
      ],
      draw: drawShips,
      clue: [null, 'The sea is curved. It hides the bottom of the ship first.'],
      question: {
        prompt: ['A ship sails away. Why does its bottom disappear before its sail?', 'Why does the bottom of the ship go first?'],
        choices: [
          { text: ['The sea curves away and hides the bottom first', 'The sea is curved'], correct: true },
          { text: ['The waves splash up and cover it', 'Waves cover it'] },
          { text: ['Ships sink a little as they sail', 'The ship sinks'] },
        ],
        hint: ['Look at the shape of the sea.', 'Look at the sea.'],
        why: ['The sea’s surface is curved, so the bulge of the water hides the lowest part first.', 'The sea curves, so the bottom hides first!'],
      },
    },
    {
      title: ['Different stars', 'New stars'],
      beats: [
        { dur: 1.5, cap: ['A traveller walks south, from Greece towards Egypt.', 'A girl walks south to Egypt.'] },
        { dur: 4.5, cap: ['Each night a bright star near the edge of the sky rises a little higher.', 'A star gets higher every night.'] },
        { dur: 5, cap: ['New stars appear that no one at home can see. On flat ground, everyone would see the same sky.', 'New stars appear. The Earth is curved!'] },
      ],
      draw: drawStars,
      clue: [null, 'The Earth is curved. Walk far and you see new stars.'],
      question: {
        prompt: ['Travellers going south saw new stars rise. Why?', 'Why did she see new stars?'],
        choices: [
          { text: ['They were walking round a curved Earth', 'The Earth is curved'], correct: true },
          { text: ['The stars moved away from Greece', 'The stars moved'] },
          { text: ['It was cloudier back at home', 'It was cloudy at home'] },
        ],
        hint: ['What shape was the ground she walked on?', 'Look at the ground.'],
        why: ['Walking round a curve tips you to face a different part of the sky, so new stars come into view.', 'On a round Earth you see new stars!'],
      },
    },
  ],
};

// --- 1B. Eratosthenes measures the Earth -----------------------------------------------

/** Part of the Earth's curve with two cities and their sticks; parallel Sun rays. */
function earthArc(ctx, T, { zoomAngle = 0, showCentre = 0 } = {}) {
  ctx.fillStyle = '#fff3cf'; ctx.fillRect(0, 0, STAGE_W, 450);
  const R = 560; const cx = 400; const cy = 120 + R;
  ctx.fillStyle = '#d9b77a';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // parallel rays straight down
  for (let x = 260; x <= 560; x += 50) arrow(ctx, x, 0, x, 60, 'rgba(240,170,20,0.8)', 4);
  const city = (ang, name, shadow) => {
    const bx = cx + Math.sin(ang) * R; const by = cy - Math.cos(ang) * R;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    line(ctx, 0, 0, 0, -70, '#5a3a22', 6);
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.tan(ang) * 70, 0); ctx.lineTo(0, -2); ctx.fill();
      line(ctx, 0, 0, Math.tan(ang) * 70, 0, 'rgba(0,0,0,0.5)', 6);
    }
    ctx.restore();
    label(ctx, name, bx, by + 30, { size: 18 });
    return { bx, by };
  };
  const syene = city(0, 'Syene (no shadow)', false);
  const alex = city(-0.42, 'Alexandria (a shadow)', true);
  if (showCentre > 0) {
    ctx.save(); ctx.globalAlpha = showCentre;
    line(ctx, syene.bx, syene.by, cx, cy, '#7a4b2a', 3, [8, 6]);
    line(ctx, alex.bx, alex.by, cx, cy, '#7a4b2a', 3, [8, 6]);
    ctx.restore();
  }
  return { syene, alex, cx, cy, R };
}

function drawWell(ctx, T) {
  ctx.fillStyle = '#fff3cf'; ctx.fillRect(0, 0, STAGE_W, 450);
  if (T < 4) {
    // Syene at noon: the Sun straight overhead, light down a deep well
    circle(ctx, 400, 50, 34, C.sun);
    for (let y = 90; y < 330; y += 30) line(ctx, 400, y, 400, y + 16, 'rgba(240,170,20,0.9)', 4);
    rect(ctx, 0, 330, STAGE_W, 120, '#d9b77a');
    rect(ctx, 350, 300, 100, 150, '#a08060');
    rect(ctx, 365, 300, 70, 150, '#2b2016');
    circle(ctx, 400, 430, 16, 'rgba(255,230,120,0.9)');
    line(ctx, 560, 330, 560, 250, '#5a3a22', 6);
    label(ctx, 'Syene, noon: the stick has no shadow', 400, 140, { size: 22 });
    label(ctx, 'sunlight reaches the bottom of the well', 400, 175, { size: 17, alpha: span(T, 1.5, 2.5) });
    return;
  }
  earthArc(ctx, T);
  if (T > 7.5) label(ctx, 'The sticks point different ways', 400, 420, { size: 22, color: '#7a4b2a' });
  else label(ctx, 'The same moment, two cities on a curved Earth', 400, 420, { size: 22, alpha: span(T, 4.5, 5.5) });
}

function drawAngle(ctx, T) {
  const show = span(T, 4, 6);
  const { alex, cx, cy } = earthArc(ctx, T, { showCentre: show });
  // the angle at the stick (shadow) and the same angle at the centre
  const a = 0.42;
  ctx.save();
  ctx.fillStyle = 'rgba(255,90,40,0.35)';
  ctx.beginPath(); ctx.moveTo(alex.bx + Math.sin(-a) * 70, alex.by - Math.cos(-a) * 70);
  ctx.arc(alex.bx + Math.sin(-a) * 70, alex.by - Math.cos(-a) * 70, 34, Math.PI / 2 - a, Math.PI / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  label(ctx, '7°', alex.bx - 10, alex.by - 112, { size: 22, color: '#c4501a' });
  if (show > 0) {
    ctx.save(); ctx.globalAlpha = show;
    ctx.fillStyle = 'rgba(255,90,40,0.45)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 300, -Math.PI / 2 - a, -Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, 'the same 7° at the centre', 300, 330, { size: 20, color: '#c4501a', alpha: show });
  }
  // a pie of 50 slices, one lit
  const pie = span(T, 7, 8.5);
  if (pie > 0) {
    ctx.save(); ctx.globalAlpha = pie;
    const px = 680; const py = 150; const pr = 70;
    circle(ctx, px, py, pr, '#fff', '#7a4b2a', 2);
    for (let i = 0; i < 50; i++) {
      const ang = (i / 50) * Math.PI * 2;
      line(ctx, px, py, px + Math.cos(ang) * pr, py + Math.sin(ang) * pr, 'rgba(122,75,42,0.35)', 1);
    }
    ctx.fillStyle = C.push;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, pr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 / 50); ctx.closePath(); ctx.fill();
    label(ctx, '7° = 1/50 of a circle', px, py + pr + 22, { size: 18 });
    ctx.restore();
  }
}

function drawPacing(ctx, T) {
  ctx.fillStyle = '#fff3cf'; ctx.fillRect(0, 0, STAGE_W, 450);
  if (T < 4.5) {
    // the caravan walks from Syene to Alexandria
    rect(ctx, 0, 300, STAGE_W, 150, '#e3c58a');
    rect(ctx, 60, 250, 50, 50, '#c9a46a'); label(ctx, 'Syene', 85, 330, { size: 18 });
    rect(ctx, 690, 240, 60, 60, '#c9a46a'); label(ctx, 'Alexandria', 720, 330, { size: 18 });
    const k = span(T, 0.3, 4.2);
    const x = lerp(130, 640, k);
    // camel
    ctx.fillStyle = '#b07a45';
    ctx.beginPath(); ctx.ellipse(x, 262, 36, 16, 0, 0, Math.PI * 2); ctx.fill();
    circle(ctx, x - 6, 248, 12, '#b07a45');
    line(ctx, x + 30, 258, x + 46, 228, '#b07a45', 8);
    circle(ctx, x + 50, 224, 8, '#b07a45');
    for (const dx of [-24, -10, 12, 26]) line(ctx, x + dx, 270, x + dx + Math.sin(T * 8 + dx) * 4, 298, '#8c5a2b', 4);
    line(ctx, 130, 360, lerp(130, 640, k), 360, '#7a4b2a', 4, [10, 8]);
    label(ctx, 'about 800 km', 385, 390, { size: 22, color: '#7a4b2a' });
    return;
  }
  // fifty copies of the walk wrap round the Earth like beads
  const cx = 400; const cy = 250; const r = 130;
  circle(ctx, cx, cy, r, '#3f8fd9');
  ctx.fillStyle = '#5bb36b';
  ctx.beginPath(); ctx.arc(cx, cy, r, -0.6, 0.9); ctx.fill();
  const n = Math.round(50 * span(T, 5, 9.5));
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / 50) * Math.PI * 2;
    circle(ctx, cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), 6, i === 0 ? C.push : '#e3a84a');
  }
  label(ctx, `${n} × 800 km`, cx, 32, { size: 26 });
  if (T > 9.5) {
    label(ctx, '50 × 800 = 40,000 km all the way round', cx, 420, { size: 24, color: '#1f8a4c' });
    label(ctx, 'Real answer: about 40,000 km!', cx, 64, { size: 18, color: '#7a4b2a' });
  }
}

export const LESSON_1B = {
  id: 'ch1_eratosthenes',
  eyebrow: ['History lesson: Eratosthenes measures the Earth', 'History lesson'],
  narrator: NARRATOR,
  films: [
    {
      title: ['The well with no shadow', 'The well'],
      beats: [
        { dur: 4, cap: ['About 240 BC, Eratosthenes, the librarian of Alexandria, heard: at noon in Syene, sunlight reaches the bottom of a deep well.', 'Long ago, the Sun shone right down a well in Syene.'] },
        { dur: 3.5, cap: ['At that same moment in Alexandria, further north, a stick does cast a shadow.', 'In Alexandria, a stick had a shadow.'] },
        { dur: 3.5, cap: ['The Sun’s rays come in side by side. On a curved Earth, the two sticks point different ways.', 'The Earth is curved, so the sticks point different ways.'] },
      ],
      draw: drawWell,
      clue: [null, 'The Earth is curved. So only one stick has a shadow.'],
      question: {
        prompt: ['At noon the stick in Syene has no shadow but the one in Alexandria does. Why?', 'Why does only one stick have a shadow?'],
        choices: [
          { text: ['The Earth is curved, so the sticks point different ways', 'The Earth is curved'], correct: true },
          { text: ['The Sun is much closer to Syene than to Alexandria', 'The Sun is closer'] },
          { text: ['Alexandria is cloudier, so its shadows are darker', 'It is cloudy'] },
        ],
        hint: ['Look at the shape of the ground under the two sticks.', 'Look at the ground.'],
        why: ['The sunlight is the same, but the ground curves, so the sticks lean differently and only one casts a shadow.', 'The ground curves, so one stick gets a shadow!'],
      },
    },
    {
      title: ['The angle', 'The angle'],
      beats: [
        { dur: 4, cap: ['Eratosthenes measured the Alexandria shadow: an angle of about 7 degrees.', 'The shadow made a small angle.'] },
        { dur: 3, cap: ['Draw lines from both sticks to the centre of the Earth: they meet at the same 7 degrees.', 'The same angle is at the middle of the Earth.'] },
        { dur: 3.5, cap: ['7 degrees is 1/50 of a full circle. So the two cities are 1/50 of the way round.', 'It is 1 slice out of 50.'] },
      ],
      draw: drawAngle,
      clue: [null, 'The angle is 1 slice out of 50.'],
      question: {
        prompt: ['The angle is 1/50 of a full circle. How much of the way round the Earth is it from Syene to Alexandria?', 'The angle is 1 slice of 50. How far round is it?'],
        choices: [
          { text: ['1/50 of the way round', '1 slice of 50'], correct: true },
          { text: ['Half of the way round', 'Half way'] },
          { text: ['All of the way round', 'All the way'] },
        ],
        hint: ['The angle at the centre is the same as at the stick.', 'Look at the pie.'],
        why: ['The slice at the centre is 1/50 of the circle, so the walk between the cities is 1/50 of the Earth.', 'One slice of 50: 1/50 of the way!'],
      },
    },
    {
      title: ['Pacing it out', 'Walking it'],
      beats: [
        { dur: 4.5, cap: ['Surveyors with camels paced from Syene to Alexandria: about 800 km.', 'People walked from city to city: 800 km.'] },
        { dur: 5, cap: ['Fifty of those walks wrap all the way round the Earth: 50 × 800 = 40,000 km.', 'Fifty walks go all the way round.'] },
        { dur: 2, cap: ['The real answer is about 40,000 km. With a stick and a shadow, he was nearly exactly right!', 'He was almost exactly right!'] },
      ],
      draw: drawPacing,
      clue: [null, 'He used a stick, its shadow and a long walk.'],
      question: {
        prompt: ['800 km is 1/50 of the way round the Earth. How far is it all the way round?', 'Did he use a stick’s shadow or a telescope?'],
        choices: [
          { text: ['40,000 km (50 × 800)', 'A stick’s shadow'], correct: true },
          { text: ['850 km (50 + 800)', 'A telescope'] },
          { text: ['16 km (800 ÷ 50)', 'A spaceship'] },
        ],
        hint: ['How many walks went round the Earth?', 'Remember the stick in Alexandria.'],
        why: ['Fifty pieces of 800 km: 50 × 800 = 40,000 km, almost exactly the real size.', 'A stick, a shadow and a long walk!'],
      },
    },
  ],
};
