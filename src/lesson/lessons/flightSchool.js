// Chapter 4 lesson 4F, Flight school: how a transfer to the Moon works. Four
// films of real two-body gravity (src/space/lesson/transferScenes.js does the
// physics and the drawing), played on the shared lesson card like every other
// lesson (lead 2026-10-05: "move flight school onto the new lesson").
//
// The scenes were authored as clips with captions at moments of lesson time,
// each clip running at its own `rate`. Here every caption becomes one beat of
// the card's clock (authored seconds = lesson time / rate), so the card's
// reading pace slows the picture exactly as it does for the other lessons.
// draw() maps the card's time back to (clip, lesson time) and calls the
// scenes' own drawFrame on the 800x450 stage.
import { buildFilms, drawFrame } from '../../space/lesson/transferScenes.js';
import { STAGE_W, STAGE_H } from '../draw.js';

const FADE_S = 0.35; // each clip fades in

/** One scene film -> one lesson-card film (beats + draw). */
function adapt(film) {
  const segs = [];
  let a = 0;
  film.clips.forEach((clip) => {
    const clipStart = a;
    clip.captions.forEach(([at, cap], k) => {
      const s1 = k + 1 < clip.captions.length ? clip.captions[k + 1][0] : clip.dur;
      const dur = Math.max(0.05, (s1 - at) / clip.rate);
      segs.push({ clip, clipStart, a0: a, dur, s0: at, s1, cap });
      a += dur;
    });
  });
  return {
    id: film.id,
    title: film.title,
    beats: segs.map((g) => ({ dur: g.dur, cap: g.cap })),
    draw(ctx, T) {
      const g = segs.find((x) => T < x.a0 + x.dur) || segs[segs.length - 1];
      const k = Math.max(0, Math.min(1, (T - g.a0) / g.dur));
      const simT = g.s0 + (g.s1 - g.s0) * k;
      drawFrame(ctx, STAGE_W, STAGE_H, g.clip, simT, T, Math.min(1, 0.15 + (T - g.clipStart) / FADE_S));
    },
  };
}

// Level 4 choices are kept about the same length, so the longest is not a giveaway.
const QUESTIONS = [
  {
    prompt: ['When the ship pointed straight at the Moon and held W, what happened?', 'The ship pointed at the Moon and held W. What happened?'],
    choices: [
      { text: ['It flew in a straight line all the way to the Moon', 'It flew right to the Moon'] },
      { text: ['Its path turned into a lopsided oval that missed', 'It missed the Moon'], correct: true },
      { text: ['It stopped and hung still in space, right where it was', 'It stopped'] },
    ],
    hint: ['Look at the dotted line after the burn. Did it reach the Moon?', 'Did the dotted line get to the Moon?'],
    why: ['You are already zooming sideways round Earth, so a push towards the Moon only bends your circle into a lopsided oval. And the Moon keeps moving, too.', 'You are going fast sideways. A push at the Moon just bends your path.'],
  },
  {
    prompt: ['To stretch your orbit out to the Moon, which way should the nose point while you hold W?', 'Which way should the nose point to make your path bigger?'],
    choices: [
      { text: ['Straight at the Moon, the place you want to go', 'At the Moon'] },
      { text: ['Backwards, opposite to the way you’re moving', 'Face the way you came'] },
      { text: ['Along your path, the way you’re already going', 'Forward, the way you are going'], correct: true },
    ],
    hint: ['Which way did the nose point when the circle stretched into a long oval?', 'Which way did the nose point when the oval grew?'],
    why: ['The engine pushes you the way the nose points. Pushing along your path speeds you up, and the faster you go, the bigger your orbit gets.', 'Pushing forward makes you faster. Faster means a bigger path!'],
  },
  {
    prompt: ['Why do we go round and wait before we burn?', 'Why do we wait before we hold W?'],
    choices: [
      { text: ['So the Moon is in the right place when we arrive', 'So the Moon is there when we get there'], correct: true },
      { text: ['To give the engine time to cool down before the burn', 'To let the engine rest'] },
      { text: ['To wait until the fuel tank has filled up again', 'To get more fuel'] },
    ],
    hint: ['What went wrong when the ship burned too early?', 'What happened when we went too early?'],
    why: ['The trip takes time and the Moon keeps moving. The burn window is the moment that makes you and the Moon arrive together.', 'The Moon keeps moving. We go at the right time to meet it.'],
  },
  {
    prompt: ['You arrive at the Moon too fast. How do you slow down so the Moon can catch you?', 'You get to the Moon too fast. How do you slow down?'],
    choices: [
      { text: ['Point straight at the Moon and hold W until you land on it', 'Point at the Moon and hold W'] },
      { text: ['Keep pointing forward, along your path, and hold W even longer', 'Point forward and hold W'] },
      { text: ['Point backwards (opposite to the way you’re moving), hold W', 'Face the way you came and hold W'], correct: true },
    ],
    hint: ['Which way did the nose point when the ship got caught?', 'Which way did the ship face when it got caught?'],
    why: ['Pointing backwards, the engine pushes against your speed and slows you down: a retrograde burn. Slow enough, and the Moon’s gravity catches you into orbit.', 'Facing the way you came slows you down. Then the Moon’s pull catches you!'],
  },
];

// Level 1 written clues (shown over the film's last beat and above the question).
const CLUES = [
  [null, 'Pointing at the Moon does not work. You miss it!'],
  [null, 'Point the nose forward, the way you are going. Your path grows to the Moon.'],
  [null, 'We wait so the Moon is there when we get there.'],
  [null, 'Face the way you came and hold W. You slow down. The Moon catches you.'],
];

export const LESSON_4F = {
  id: 'ch4_flight_school',
  eyebrow: ['Flight school', 'Flight school'],
  narrator: ['Mission Control', 'Mission Control'],
  tryIt: ['Point along your path and wait for the green BURN NOW sign.', 'Wait for the green BURN NOW sign.'],
  done: ['Done, let’s fly!', 'Done, let’s fly!'],
  films: buildFilms().map((f, i) => ({ ...adapt(f), question: QUESTIONS[i], clue: CLUES[i] })),
};

