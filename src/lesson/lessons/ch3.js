// Chapter 3 lessons (LESSONS_PLAN.md 3A, 3B). Each film draws on the 800x450
// stage from src/lesson/draw.js; T is authored seconds.
import { C, span, lin, lerp, clamp, daySky, label, arrow, kid, rocket, puffs, circle, rect, line, STAGE_W } from '../draw.js';

const NARRATOR = ['Rocket Scientist', 'Rocket Scientist'];

// --- 3A. Push back, go forward ------------------------------------------------------

function drawBalloon(ctx, T) {
  daySky(ctx, 380);
  const go = lin(T, 3, 11);
  const x = 170 + go * 400 + Math.sin(T * 9) * 6 * (go > 0 && go < 1 ? 1 : 0);
  const shrink = 1 - go * 0.35;
  // the balloon (pointing right, the mouth on the left)
  ctx.save();
  ctx.translate(x, 210);
  ctx.scale(shrink, shrink);
  ctx.fillStyle = '#ff5d8f';
  ctx.beginPath(); ctx.ellipse(0, 0, 62, 48, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-58, -8); ctx.lineTo(-76, 0); ctx.lineTo(-58, 8); ctx.fill();
  circle(ctx, 18, -16, 10, 'rgba(255,255,255,0.45)');
  ctx.restore();
  if (T < 3) {
    // a hand holding the mouth shut
    circle(ctx, x - 82, 210, 14, '#f2c6a0', C.ink, 2);
    label(ctx, 'Full of air', x, 120, { size: 22 });
  }
  if (go > 0) {
    if (go < 1) puffs(ctx, x - 80 * shrink, 210, -170, 0, T, { n: 7, size: 9, color: 'rgba(255,255,255,0.9)' });
    const a = span(T, 4.5, 6);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      arrow(ctx, x - 90, 300, x - 210, 300, '#4a7fd0', 9);
      label(ctx, 'air goes back', x - 150, 330, { size: 18, color: '#2a5fae' });
      arrow(ctx, x + 40, 300, x + 150, 300, C.push, 9);
      label(ctx, 'balloon goes forward', x + 95, 330, { size: 18, color: '#c4501a' });
      ctx.restore();
    }
  }
  if (go >= 1) label(ctx, 'Opposite ways!', STAGE_W / 2, 90, { size: 30 });
}

function drawSkater(ctx, T) {
  daySky(ctx, 340, '#9aa3ad');
  const thrown = T >= 4;
  const k = lin(T, 4, 10);
  const kidX = 400 - k * 190;
  const ballX = thrown ? 430 + k * 300 : 420;
  // skateboard
  rect(ctx, kidX - 34, 330, 68, 8, '#3b4250', 3);
  circle(ctx, kidX - 22, 342, 6, C.ink); circle(ctx, kidX + 22, 342, 6, C.ink);
  kid(ctx, kidX, 304, { scale: 1.3, armUp: thrown ? 0.2 : 0.6, lean: thrown ? -0.08 : 0.05 });
  // the heavy ball
  const by = thrown ? 240 + Math.pow((k - 0.25) * 2, 2) * 20 : 250;
  circle(ctx, ballX, by, 18, '#3d5a80', C.ink, 2);
  label(ctx, 'heavy ball', ballX, by - 34, { size: 16 });
  if (thrown) {
    ctx.save(); ctx.globalAlpha = span(T, 4.3, 5.5);
    arrow(ctx, ballX - 50, 200, ballX + 20, 200, C.push, 8);
    arrow(ctx, kidX - 10, 215, kidX - 90, 215, '#4a7fd0', 8);
    label(ctx, 'she rolls back', kidX - 60, 188, { size: 18, color: '#2a5fae' });
    ctx.restore();
  }
}

function drawRocketUp(ctx, T) {
  const lift = Math.max(0, T - 5);
  const y = Math.max(250, 380 - lift * lift * 14);
  daySky(ctx, 390);
  rect(ctx, 330, 380, 140, 14, '#6d7380');
  const fl = span(T, 2.5, 3.5);
  rocket(ctx, 400, Math.min(380, y), 150, { flame: fl, t: T });
  if (fl > 0) puffs(ctx, 400, 392, 0, 50, T, { n: 8, size: 14, spread: 60 });
  const a = span(T, 4, 5);
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a;
    const ry = Math.min(380, y);
    arrow(ctx, 520, ry - 60, 520, ry - 170, C.push, 10);
    label(ctx, 'rocket pushed up', 600, ry - 120, { size: 18, color: '#c4501a' });
    arrow(ctx, 280, 300, 280, 420, '#4a7fd0', 10);
    label(ctx, 'gas pushed down', 190, 340, { size: 18, color: '#2a5fae' });
    ctx.restore();
  }
  if (T > 9) label(ctx, 'Action and reaction', STAGE_W / 2, 50, { size: 28 });
}

export const LESSON_3A = {
  id: 'ch3_push_back',
  eyebrow: ['Rocket lesson: push back, go forward', 'Rocket lesson'],
  narrator: NARRATOR,
  films: [
    {
      title: ['The balloon', 'The balloon'],
      beats: [
        { dur: 3, cap: ['Here is a balloon full of air. A hand holds the end shut.', 'A balloon full of air.'] },
        { dur: 3, cap: ['Let go! The air rushes out of the back...', 'Let go! Air rushes out the back...'] },
        { dur: 5, cap: ['...and the balloon zooms forward: the opposite way to the air.', '...and the balloon zooms forward!'] },
      ],
      draw: drawBalloon,
      question: {
        prompt: ['When the air rushes out the back, which way does the balloon go?', 'Air goes out the back. Which way does the balloon go?'],
        choices: [
          { text: ['Forward, the opposite way to the air', 'Forward'], correct: true },
          { text: ['Backward, the same way as the air', 'Backward'] },
          { text: ['Straight down to the ground below', 'Down'] },
        ],
        hint: ['Look at the two arrows at the end of the film.', 'Look at the arrows.'],
        why: ['The balloon pushes the air back, and the air pushes the balloon forward.', 'Air goes back, balloon goes forward!'],
      },
    },
    {
      title: ['The skater', 'The skater'],
      beats: [
        { dur: 4, cap: ['Mia stands still on her skateboard, holding a heavy ball.', 'Mia is on her skateboard with a heavy ball.'] },
        { dur: 3, cap: ['She throws the ball forward, hard.', 'She throws the ball forward.'] },
        { dur: 4, cap: ['The ball pushes back on her, so she rolls backward!', 'And she rolls backward!'] },
      ],
      draw: drawSkater,
      question: {
        prompt: ['Mia throws a ball forward from her skateboard. What happens to her?', 'Mia throws a ball forward. What happens to her?'],
        choices: [
          { text: ['She rolls backward, away from the ball', 'She rolls backward'], correct: true },
          { text: ['She rolls forward, after the ball', 'She rolls forward'] },
          { text: ['She stays exactly where she was', 'She stays still'] },
        ],
        hint: ['Which way did her skateboard roll after the throw?', 'Which way did she roll?'],
        why: ['Pushing the ball forward pushes her back. Every push has a push back.', 'Push the ball forward, and you go back!'],
      },
    },
    {
      title: ['The rocket', 'The rocket'],
      beats: [
        { dur: 3, cap: ['A rocket on the pad. The engine starts.', 'The rocket engine starts.'] },
        { dur: 3, cap: ['It pushes hot gas down out of the nozzle, hard and fast.', 'It pushes hot gas down.'] },
        { dur: 5, cap: ['The gas pushes the rocket up. Scientists call it action and reaction.', 'The gas pushes the rocket up!'] },
      ],
      draw: drawRocketUp,
      question: {
        prompt: ['How does a rocket go up?', 'How does a rocket go up?'],
        choices: [
          { text: ['It pushes hot gas down, and the gas pushes it up', 'It pushes gas down'], correct: true },
          { text: ['It floats up because it is lighter than air', 'It floats like a balloon'] },
          { text: ['The wind blows it up into the sky', 'The wind lifts it'] },
        ],
        hint: ['Look at the two arrows: which way did the gas go?', 'Which way did the gas go?'],
        why: ['Just like the balloon and the skater: gas pushed down means rocket pushed up.', 'Gas goes down, rocket goes up!'],
      },
    },
  ],
};

// --- 3B. Heavy rockets need big pushes ------------------------------------------------

function pad(ctx) {
  daySky(ctx, 390);
  rect(ctx, 320, 380, 160, 14, '#6d7380');
}

function forceArrows(ctx, x, y, weight, thrust) {
  arrow(ctx, x + 110, y - 70, x + 110, y - 70 + weight, C.weight, 10);
  label(ctx, 'weight', x + 175, y - 70 + weight / 2, { size: 18, color: '#4d5560' });
  if (thrust > 4) {
    arrow(ctx, x - 110, y - 10, x - 110, y - 10 - thrust, C.push, 10);
    label(ctx, 'push up', x - 180, y - 10 - thrust / 2, { size: 18, color: '#c4501a' });
  }
}

function drawThrustWeight(ctx, T) {
  pad(ctx);
  const weight = 90;
  const thrust = lerp(0, 150, lin(T, 2, 9));
  const lift = thrust > weight ? (T - (2 + 7 * weight / 150)) : 0;
  const y = Math.max(230, 380 - Math.max(0, lift) ** 2 * 18);
  rocket(ctx, 400, y, 150, { flame: thrust > 4 ? clamp(thrust / 120, 0.3, 1) : 0, t: T });
  forceArrows(ctx, 400, Math.min(380, y), weight, thrust);
  if (thrust < weight) label(ctx, T > 2 ? 'Push is smaller: no lift-off yet' : '', 400, 60, { size: 22 });
  else label(ctx, 'Push is bigger: lift-off!', 400, 60, { size: 26, color: '#1f8a4c' });
}

function drawMoreFuel(ctx, T) {
  pad(ctx);
  const fill = span(T, 1, 4);
  const h = 150 + fill * 60;
  const weight = 90 + fill * 60;           // 150
  const bigEngine = T >= 8;
  const thrust = bigEngine ? lerp(120, 200, span(T, 8, 9.5)) : 120 * span(T, 4, 5);
  const lifting = bigEngine && T > 9;
  const y = lifting ? Math.max(250, 380 - (T - 9) ** 2 * 18) : 380;
  const shake = !bigEngine && T > 5 ? Math.sin(T * 50) * 2 : 0;
  rocket(ctx, 400 + shake, y, h, { flame: thrust > 4 ? 1 : 0, t: T, body: bigEngine ? '#e9eef7' : '#f3f5f8' });
  forceArrows(ctx, 400, y, weight, thrust);
  if (T < 4) label(ctx, 'Filling more fuel...', 400, 60, { size: 22 });
  else if (!bigEngine) label(ctx, 'Too heavy for this engine!', 400, 60, { size: 24, color: '#b3261e' });
  else label(ctx, 'A stronger engine: lift-off!', 400, 60, { size: 24, color: '#1f8a4c' });
}

function drawStages(ctx, T) {
  // sky gets darker as it climbs
  const k = lin(T, 0, 11);
  const g = ctx.createLinearGradient(0, 0, 0, 450);
  g.addColorStop(0, `rgb(${lerp(124, 20, k)},${lerp(196, 30, k)},${lerp(242, 80, k)})`);
  g.addColorStop(1, `rgb(${lerp(191, 60, k)},${lerp(230, 90, k)},${lerp(255, 160, k)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 450);
  const dropped = T >= 5;
  const speed = dropped ? 2 + (T - 5) * 1.2 : 1 + T * 0.2;
  // speed lines flowing past
  for (let i = 0; i < 12; i++) {
    const yy = ((i * 53 + T * speed * 120) % 500) - 25;
    line(ctx, 250 + (i * 37) % 300, yy, 250 + (i * 37) % 300, yy + 30, 'rgba(255,255,255,0.5)', 2);
  }
  // upper stage
  rocket(ctx, 400, 250, 120, { flame: 1, t: T });
  // lower stage: attached, then falling away
  const fall = dropped ? (T - 5) : 0;
  const ly = 250 + 70 + fall * fall * 40;
  ctx.save();
  ctx.translate(400 + fall * 8, ly);
  ctx.rotate(fall * 0.25);
  rect(ctx, -16, -70, 32, 70, dropped ? '#c9ced8' : '#f3f5f8', 3);
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath(); ctx.moveTo(-16, -18); ctx.lineTo(-28, 0); ctx.lineTo(-16, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16, -18); ctx.lineTo(28, 0); ctx.lineTo(16, 0); ctx.fill();
  ctx.restore();
  if (dropped) label(ctx, 'empty stage', 400 + fall * 8 + 80, ly - 30, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.5)', alpha: 1 - lin(T, 8, 10) });
  // speed meter
  rect(ctx, 600, 80, 150, 22, 'rgba(0,0,0,0.35)', 8);
  rect(ctx, 603, 83, Math.min(144, speed * 18), 16, C.good, 6);
  label(ctx, 'speed', 675, 60, { size: 16, color: '#fff', halo: 'rgba(0,0,0,0.5)' });
}

export const LESSON_3B = {
  id: 'ch3_heavy',
  eyebrow: ['Rocket lesson: heavy rockets need big pushes', 'Rocket lesson'],
  narrator: NARRATOR,
  films: [
    {
      title: ['Push vs. weight', 'Push and weight'],
      beats: [
        { dur: 2, cap: ['Two forces act on a rocket: its weight pulls down, the engine pushes up.', 'Weight pulls down. The engine pushes up.'] },
        { dur: 4, cap: ['The engine gets stronger, but the push is still smaller than the weight.', 'The push grows...'] },
        { dur: 5, cap: ['Now the push up is bigger than the weight: lift-off!', 'Push is bigger than weight: lift-off!'] },
      ],
      draw: drawThrustWeight,
      question: {
        prompt: ['When does the rocket lift off?', 'When does the rocket lift off?'],
        choices: [
          { text: ['When the push up is bigger than its weight', 'When the push is bigger'], correct: true },
          { text: ['As soon as the engine is switched on', 'When the engine starts'] },
          { text: ['When the rocket is lighter than the air', 'When it is light as air'] },
        ],
        hint: ['Compare the orange arrow and the grey arrow at lift-off.', 'Look at the two arrows.'],
        why: ['The rocket only rises when the push up beats the pull down of its weight.', 'The push has to be bigger than the weight!'],
      },
    },
    {
      title: ['More fuel, more weight', 'More fuel'],
      beats: [
        { dur: 4, cap: ['We fill the rocket with much more fuel. Fuel is heavy: the weight arrow grows.', 'More fuel makes it heavier.'] },
        { dur: 4, cap: ['The same engine starts... but its push is smaller than the new weight. Stuck!', 'Same engine: it is stuck!'] },
        { dur: 4, cap: ['A stronger engine pushes harder than the weight, and up it goes.', 'A stronger engine lifts it!'] },
      ],
      draw: drawMoreFuel,
      question: {
        prompt: ['You add a lot more fuel. What does the rocket need now?', 'More fuel. What does the rocket need?'],
        choices: [
          { text: ['A stronger push to lift off the pad', 'A stronger push'], correct: true },
          { text: ['Nothing, the same push still works', 'Nothing'] },
          { text: ['A smaller engine, to save the fuel', 'A smaller engine'] },
        ],
        hint: ['What happened with the same engine after the tanks were filled?', 'Did the same engine lift it?'],
        why: ['Fuel adds weight, so the push must grow too. That is why you can’t just add more and more tanks.', 'Heavier rockets need bigger pushes!'],
      },
    },
    {
      title: ['Dropping stages', 'Dropping stages'],
      beats: [
        { dur: 5, cap: ['A two-stage rocket climbs. The bottom stage burns its fuel first.', 'The rocket climbs.'] },
        { dur: 3, cap: ['Empty, it is just extra weight, so it drops away.', 'The empty part drops off.'] },
        { dur: 4, cap: ['Lighter now, the same engine speeds the rocket up even more. Watch the speed bar!', 'Now it is lighter and goes faster!'] },
      ],
      draw: drawStages,
      question: {
        prompt: ['Why do rockets drop their empty stages?', 'Why drop the empty part?'],
        choices: [
          { text: ['A lighter rocket speeds up more', 'Lighter goes faster'], correct: true },
          { text: ['To make the rocket look cool', 'To look cool'] },
          { text: ['To slow the rocket down a bit', 'To slow down'] },
        ],
        hint: ['What did the speed bar do after the stage fell?', 'Look at the speed bar.'],
        why: ['Less weight to carry means the same push speeds you up more.', 'Less weight, more speed!'],
      },
    },
  ],
};
