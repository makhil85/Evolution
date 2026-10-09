// Chapter 7, lesson 7A: How do you know you are speeding up? (Part B, lead
// 2026-10-08: "if the ship has constant velocity there is no way to tell").
// Each film draws on the 800x450 stage from src/lesson/draw.js; T is authored
// seconds.
//
// Three films, one of them a watch-only breather (no question after it):
//   1. A smooth ride. Mira tosses a ball straight up inside a cabin moving at
//      a steady speed; it lands back in her hand, so nothing inside shows the
//      ship is moving (Galileo's ship, almost 400 years ago). Question. A
//      predict pause before the ball lands.
//   2. Speeding up presses you back into the seat, and the press goes away when
//      the ship stops speeding up. Watch only (the breather).
//   3. In a ship that is speeding up, a ball let go "falls" to the floor, because
//      the floor comes up to meet it. From inside that feels just like weight:
//      a gentle push is slow, a full push is like Earth. Question.
//
// Pitfalls carried: the last frame still shows the answer; labels beside the
// picture, not across it; every caption has a Level 1 version; the right
// choice is never the longest; choices are never bare numbers.
import { span, lerp, label, circle, rect, line, arrow, kid, C } from '../draw.js';

const FLOOR_Y = 360; // the cabin floor (stage pixels)
const TOSS_T0 = 7.5; const TOSS_T1 = 11.5; // the ball is in the air for 4 s (it is still up at the predict pause)
const HAND = { x: 308, y: 330 }; // where Mira holds the ball, at rest

function cabin(ctx) {
  ctx.fillStyle = '#26304d'; ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = '#3a4668'; ctx.fillRect(0, FLOOR_Y, 800, 90);
  ctx.fillStyle = '#56648c'; ctx.fillRect(0, FLOOR_Y, 800, 4);
}

/** A window on the right showing the land going past at a steady speed (the hills move at a steady rate). */
function window1(ctx, T) {
  const x = 500; const y = 40; const w = 260; const h = 150;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#8fd0ff'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#5fa868';
  const off = (T * 60) % 120;
  for (let k = -1; k < 4; k++) {
    const hx = x + k * 120 - off;
    ctx.beginPath(); ctx.ellipse(hx + 60, y + h, 80, 46, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
  rect(ctx, x - 6, y - 6, w + 12, 6, '#c9d1dc');
  rect(ctx, x - 6, y + h, w + 12, 6, '#c9d1dc');
  label(ctx, 'Out of the window: the land goes by', x + w / 2, y + h + 22, { size: 14, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 1: a smooth ride -----------------------------------------------------------------

function drawSmooth(ctx, T) {
  cabin(ctx);
  window1(ctx, T);
  // Mira, in the middle of the cabin; her arm goes up to toss the ball
  const armUp = span(T, 6.2, 7.4) * (1 - span(T, 7.8, 8.4));
  kid(ctx, 260, FLOOR_Y, { scale: 2.4, armUp, color: '#7fdc8a' });
  // the ball: in her hand, then straight up and straight back down into it
  let bx = HAND.x; let by = HAND.y;
  if (T > TOSS_T0) {
    const u = Math.min(1, (T - TOSS_T0) / (TOSS_T1 - TOSS_T0));
    by = HAND.y - 4 * 130 * u * (1 - u);
  }
  circle(ctx, bx, by, 13, '#ffd27a', C.ink, 2);
  // the ship's motion: a steady arrow (no change in it)
  arrow(ctx, 40, 230, 200, 230, '#7fd3ff', 8);
  label(ctx, 'The ship: steady speed', 120, 262, { size: 16, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)' });
  if (T > TOSS_T1 - 0.2) label(ctx, 'Back in her hand!', 330, 170, { size: 22, color: '#9fe8a8', halo: 'rgba(0,0,0,0.6)' });
  if (T > 12.5) label(ctx, 'Inside, nothing shows we are moving.', 400, 415, { size: 18, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 2: speeding up presses you back (watch only) ----------------------------------------

function drawPress(ctx, T) {
  cabin(ctx);
  window1(ctx, T);
  // how hard the seat presses: on while the ship speeds up (T 3 to 11), gone by 13
  const press = span(T, 3, 4) * (1 - span(T, 11, 13));
  // the speed bar: grows while speeding up, then holds steady
  const v = Math.min(1, Math.max(0, (T - 3) / 8));
  label(ctx, 'Speed', 110, 60, { size: 18, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)', align: 'left' });
  rect(ctx, 110, 74, 300, 20, 'rgba(255,255,255,0.12)', 6);
  rect(ctx, 110, 74, Math.max(2, 300 * v), 20, '#7fd3ff', 6);
  // a chair, and Mira in it, leaning back while she is pressed
  const cx = 330;
  rect(ctx, cx - 40, FLOOR_Y - 60, 80, 14, '#8a6a4a', 4);
  rect(ctx, cx - 52, FLOOR_Y - 150, 16, 110, '#8a6a4a', 4);
  kid(ctx, cx, FLOOR_Y - 60, { scale: 2.1, lean: -0.22 * press, color: '#ff6fa8' });
  // the press: orange arrows from the seat back into her back
  if (press > 0.05) {
    for (const dy of [-80, -110]) arrow(ctx, cx - 62, FLOOR_Y + dy, cx - 30, FLOOR_Y + dy, `rgba(255,122,61,${0.9 * press})`, 8);
    label(ctx, 'pressed back into the seat', cx + 40, FLOOR_Y - 150, { size: 17, color: '#ffb347', halo: 'rgba(0,0,0,0.6)' });
  }
  if (T > 13) label(ctx, 'Steady speed: no press.', 400, 415, { size: 18, color: '#cfe8ff', halo: 'rgba(0,0,0,0.6)' });
}

// --- film 3: the floor comes up to meet the ball -------------------------------------------------

function drawFloor(ctx, T) {
  cabin(ctx);
  // the ship speeds up upwards: the floor rises faster and faster from T = 3
  const tau = Math.max(0, T - 3);
  const floorTop = FLOOR_Y - 3 * tau * tau;
  const ballFloat = 150; // where the ball hangs, let go at T = 3
  const by = Math.min(ballFloat, floorTop - 16); // it floats until the floor reaches it, then rides up
  ctx.fillStyle = '#4a5c86'; ctx.fillRect(0, floorTop, 800, 450 - floorTop);
  ctx.fillStyle = '#7fd3ff'; ctx.fillRect(0, floorTop, 800, 4);
  circle(ctx, 400, by, 16, '#ffd27a', C.ink, 2);
  if (T < 3) label(ctx, 'Let go!', 400, 110, { size: 18, color: '#ffd27a', halo: 'rgba(0,0,0,0.6)' });
  if (T >= 3 && by > ballFloat - 1) label(ctx, 'Nothing pulls it down...', 400, 110, { size: 18, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
  if (T >= 6.5 && T < 11) label(ctx, 'the floor rushes up!', 600, 150, { size: 20, color: '#7fd3ff', halo: 'rgba(0,0,0,0.6)' });
  // the ship's push, pointing up, under the floor
  if (T > 3) arrow(ctx, 720, 420, 720, 395, '#ff7a3d', 6);
  if (T > 12) label(ctx, 'It feels just like weight.', 400, 60, { size: 20, color: '#ffffff', halo: 'rgba(0,0,0,0.6)' });
}

export const LESSON_7A = {
  id: 'ch7_push',
  eyebrow: ['How do you know you are speeding up?', 'Speeding up'],
  narrator: ['Echo (signal bot)', 'Echo the robot'],
  tryIt: ['Next: try it on the ship.', 'Next: try it!'],
  films: [
    {
      title: ['A smooth ride', 'A smooth ride'],
      beats: [
        { dur: 3, cap: ['A smooth train, or a ship at a steady speed. Let’s look inside.', 'A smooth ride at a steady speed. Look inside!'] },
        { dur: 4, cap: ['Out of the window the land goes past. Inside, Mira tosses a ball straight up.', 'Out of the window the land goes by. Mira tosses a ball up.'] },
        { dur: 3.5, cap: ['Will it land in her hand, or behind her? Guess first!', 'Will it land in her hand, or behind? Guess!'], predict: true },
        { dur: 5, cap: ['It comes straight back down into her hand. Inside, we cannot tell that we are moving!', 'It lands back in her hand. Inside, we cannot tell we are moving!'] },
      ],
      draw: drawSmooth,
      question: {
        prompt: ['On a smooth ride at a steady speed, a ball tossed straight up lands back in your hand. Can you tell that you are moving?', 'A ball lands back in your hand on a smooth, steady ride. Can you tell you are moving?'],
        choices: [
          { text: ['Yes, the ball lands behind you', 'Yes, the ball lands behind you'] },
          { text: ['No, inside it looks just the same', 'No, inside it looks the same'], correct: true },
          { text: ['Yes, the window shows the land moving', 'Yes, we see the land go by'] },
        ],
        hint: ['Look at the ball, not the window. Where does it land?', 'Look at the ball. Where does it land?'],
        why: ['Galileo said this about ships almost 400 years ago. A steady speed feels just like standing still, so the ball lands in your hand.', 'A steady speed feels just like standing still, so the ball lands in your hand!'],
      },
      clue: [null, 'The ball lands back in your hand. Nothing inside shows you are moving.'],
    },
    {
      title: ['Speeding up presses you back', 'Speeding up presses back'],
      watchOnly: true,
      beats: [
        { dur: 3, cap: ['Now the drive pushes harder, and the ship speeds up.', 'Now the ship speeds up.'] },
        { dur: 4, cap: ['Feel that? The seat presses you back into it.', 'The seat presses you back.'] },
        { dur: 4.5, cap: ['The press lasts only while the ship speeds up. Stop speeding up, and it goes away.', 'Speeding up presses you back. Stop, and it goes.'] },
      ],
      draw: drawPress,
    },
    {
      title: ['The floor comes up to meet the ball', 'The floor comes up'],
      beats: [
        { dur: 3, cap: ['Now a ball is let go, in a ship that is speeding up.', 'A ball is let go, in a ship that speeds up.'] },
        { dur: 3.5, cap: ['It falls to the floor! But nothing up here is pulling it down.', 'It falls to the floor! Nothing pulls it.'] },
        { dur: 4, cap: ['The floor is speeding up, so it rushes up to meet the ball.', 'The floor rushes up to meet the ball.'] },
        { dur: 5, cap: ['A gentle push is slow, like a feather. A full push feels just like Earth’s pull.', 'A gentle push is slow. A full push feels like Earth.'] },
      ],
      draw: drawFloor,
      question: {
        prompt: ['The ship is speeding up. A ball is let go and falls to the floor. Why does it fall?', 'The ship speeds up. The ball falls to the floor. Why?'],
        choices: [
          { text: ['Earth is pulling it down, like on the ground', 'Earth pulls it down'] },
          { text: ['The floor rushes up to meet it', 'The floor comes up to it'], correct: true },
          { text: ['It is heavier than the air around it', 'It is heavier than the air'] },
        ],
        hint: ['Look at the floor in the picture. Does the floor stay still?', 'Look at the floor. Is it still?'],
        why: ['Speeding up, the floor catches up with the ball. From inside, a push feels just like weight, so the ball looks as if it falls.', 'The floor speeds up and comes up to the ball. Inside, that looks like falling!'],
      },
      clue: [null, 'The floor comes up to meet the ball.'],
    },
  ],
};
