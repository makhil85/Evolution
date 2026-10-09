// Chapter 7, Part B: feel the push (lead 2026-10-08: "how do we know the ship is
// accelerating?"). Four steps in the ship, each with a question after it:
//   1. Gentle push: a floaty walk (the Moon's step, createInteriorScene gait
//      'lope') to the cargo bay, and the drop test (dropTest.js).
//   2. Lesson 7A (how do you know you are speeding up?); its films carry the questions.
//   3. Engine check: the drive goes off, zero g. The float game (floatGame.js)
//      in the engine room, then its questions. She walks there on magnetic boots
//      (the normal walk), as the dialogue says.
//   4. Full push: back to the cargo bay (a normal walk) and the drop test again.
// Each step is self-contained (a reload straight into one works): the walks
// have a single spot, so there is no inner progress to save.
import { t } from '../level.js';
import { createInteriorScene, preloadInterior } from '../ch6/interior/ship.js';
import { who } from '../ch6/crewInfo.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_7A } from '../../lesson/lessons/ch7a.js';
import { playDropTest } from './dropTest.js';
import { playFloatGame } from './floatGame.js';

const WALK_CALM_S = 1.5; // the pause before a question asked on foot (as in Chapter 6)
// The question beats (questions.partB.js); each is asked once its task is done.
const BEAT = { gentle: 'c7bGentleDrop', float: 'c7bFloatThrow', sum: 'c7bThrowSum', full: 'c7bFullDrop' };
// The spots: the cargo bay's place (pack) and the engine's (energy), on the engineering deck, led by Bolt.
const DROP_GENTLE = { id: 'c7_drop', deck: 'engineering', near: 'pack', lead: 'builder', title: ['Drop the ball in the cargo bay', 'Drop the ball!'] };
const ENGINE = { id: 'c7_engine', deck: 'engineering', near: 'energy', lead: 'builder', title: ['Engine check: float to the hatch', 'Float to the hatch!'] };
const DROP_FULL = { id: 'c7_drop_full', deck: 'engineering', near: 'pack', lead: 'builder', title: ['Drop the ball again, at full push', 'Drop again!'] };

export function partBSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_push_gentle', act: 2,
      title: t('Gentle push', 'Gentle push'),
      objective: t('The drive is on, at a gentle push. Walk with Bolt to the cargo bay and drop the ball.', 'Walk to the cargo bay. Drop the ball!'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('The drive is on, but only a gentle push: about 1/100 of Earth’s pull. Walk with me to the cargo bay.', 'The drive is on, but gently. Come to the cargo bay!') },
          { who: 'girl', text: t('Will the push make things fall?', 'Will things fall?') },
          { who: who('builder'), text: t('Drop a ball and time it. Then you tell me.', 'Drop a ball and time it!') },
        ]);
        const models = await preloadInterior();
        // Gentle push: the Moon's floaty step (gait 'lope'), so the walk feels light.
        await game.runScene(createInteriorScene(game, {
          models, gait: 'lope', spots: [DROP_GENTLE],
          async onStation() {
            await playDropTest('gentle', { bus: game.bus });
            hud.toast(t('Mission Control has a question...', 'A question is coming!'), { kind: 'info', ms: 1400 });
            await game.missions.ask(BEAT.gentle, { calm: WALK_CALM_S });
          },
        }));
        hud.toast(t('The ball drifted down slowly. A gentle push is easy to see.', 'Slow and easy to see!'), { kind: 'good', ms: 3800 });
      },
    },
    {
      id: 'c7_push_lesson', act: 2,
      title: t('How do you know?', 'Speeding up'),
      objective: t('How do you know you are speeding up? Watch the lesson.', 'How do you know you are speeding up?'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('signal'), text: t('Here is a puzzle. If the ship goes at a steady speed, can you tell that we are moving? Let me show you.', 'Can you tell we are moving? Let me show you!') },
          { who: 'girl', text: t('Speeding up feels different, though, doesn’t it?', 'Speeding up feels different?') },
          { who: who('signal'), text: t('Watch closely. The ball and the floor will give it away.', 'Watch the ball and the floor!') },
        ]);
        await lessonOnce(LESSON_7A, { bus: game.bus });
      },
    },
    {
      id: 'c7_engine_check', act: 2,
      title: t('Engine check', 'Engine check'),
      objective: t('Engine check: the drive goes off. Float to the hatch in the engine room.', 'Drive off! Float to the hatch.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('Engine check! The drive goes OFF. No push, so we just drift on in a straight line.', 'Engine check! The drive goes OFF. We drift!') },
          { who: who('builder'), text: t('Magnetic boots keep our feet on the floor, so we can still walk to the engine.', 'Magnetic boots: our feet stay on the floor.') },
          { who: 'girl', text: t('Then how do we move?', 'How do we move?') },
          { who: who('signal'), text: t('Remember the two ice chunks in Saturn’s rings? The small one shot off fast, and the big one moved slowly. You are the big one now, and the wrench is the small one.', 'Remember Saturn’s ice? The small chunk shot off fast. You are the big one, and the wrench is the small one!') },
          { who: who('builder'), text: t('A rocket does the same with its gas: the gas goes out the back, and the rocket goes forwards. Throw the wrench one way, and you float the other way.', 'Throw one way, and you float the other way!') },
          { who: who('signal'), text: t('Remember the balloon in Chapter 3? Air goes back, and the balloon goes forward. Your wrench is the air.', 'Remember the balloon? Air goes back, the balloon goes forward!') },
        ]);
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          models, spots: [ENGINE],
          async onStation() {
            await playFloatGame({ bus: game.bus });
            hud.toast(t('Mission Control has a question...', 'A question is coming!'), { kind: 'info', ms: 1400 });
            await game.missions.ask(BEAT.float, { calm: WALK_CALM_S });
            // The sum of the throw (the callout's numbers), asked after the direction.
            await game.missions.ask(BEAT.sum);
          },
        }));
        hud.toast(t('The engine check is done. Nothing pulled us, and we still got there!', 'Engine check passed!'), { kind: 'good', ms: 4000 });
      },
    },
    {
      id: 'c7_full_push', act: 2,
      title: t('Full push', 'Full push'),
      objective: t('Full push: 1 g, like Earth. Walk back to the cargo bay and drop the ball again.', 'Full push! Drop the ball again.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('Full push now! The drive is at full power: 1 g, the same pull as Earth.', 'Full push! It is like Earth now.'), },
          { who: 'girl', text: t('So the ball will land fast?', 'So it lands fast?') },
          { who: who('builder'), text: t('Drop it and see. Time it again!', 'Drop it and see!') },
        ]);
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          models, spots: [DROP_FULL],
          async onStation() {
            await playDropTest('full', { bus: game.bus });
            hud.toast(t('Mission Control has a question...', 'A question is coming!'), { kind: 'info', ms: 1400 });
            await game.missions.ask(BEAT.full, { calm: WALK_CALM_S });
          },
        }));
        hud.toast(t('Full push: the ball lands fast, like on Earth.', 'Full push: fast, like Earth!'), { kind: 'good', ms: 4000 });
      },
    },
  ];
}
