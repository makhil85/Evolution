// Chapter 7, Part D: the holodeck (lead 2026-10-08, Star Trek style). Echo runs
// the holodeck: she walks to its door on the bridge and the computer takes them
// to a quasar far away (the holodeck scene, holodeck.js). Then lesson 7D (black
// holes and quasars, lessons/ch7d.js), then the game "Where is it really?"
// (lensGame.js). Each step has its question (questions.partD.js). See
// missions.js for the step format, and CHAPTER7_PLAN.md section 2.
//
// The walk is the one spot (a bridge place, borrowed from the message console),
// so the interior scene resolves when she presses E there; the holodeck is a
// scene of its own, started after the walk (a scene cannot start inside another).
import { t } from '../level.js';
import { createInteriorScene, preloadInterior } from '../ch6/interior/ship.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_7D } from '../../lesson/lessons/ch7d.js';
import { who } from '../ch6/crewInfo.js';
import { buildHolodeckScene } from './holodeck.js';
import { playLens } from './lensGame.js';

const ACT_D = 4;

/** The holodeck's door: a place on the bridge (the message console), Echo leads. */
export const HOLODECK_SPOT = Object.freeze({
  id: 'c7_holodeck', deck: 'bridge', near: 'message', lead: 'signal',
  title: ['Holodeck: ask for a quasar', 'Holodeck: see a quasar'],
});

export function partDSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_holodeck_walk', act: ACT_D,
      title: t('The holodeck', 'The holodeck'),
      objective: t('Walk to the holodeck door and ask the computer for a far-away quasar.', 'Go to the holodeck and ask for a quasar!'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('signal'), text: t('The holodeck can make a place for us. Shall I ask the computer for a quasar?', 'The holodeck can take us anywhere. Let me ask for a quasar!') },
          { who: 'girl', text: t('A quasar? What is that?', 'What is a quasar?') },
          { who: who('signal'), text: t('A black hole eating gas, shining brighter than a whole galaxy. It is billions of light-years away. The holodeck brings it to us.', 'A black hole eats gas. It shines brighter than a galaxy. It is far away!') },
        ]);
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          models,
          spots: [HOLODECK_SPOT],
          async onStation() {
            hud.toast(t('The computer is making the holodeck...', 'The holodeck is starting...'), { kind: 'info', ms: 1600 });
          },
        }));
        await game.runScene(buildHolodeckScene(game));
        hud.toast(t('Real quasars are far, far away. This one is only a picture!', 'A quasar! It is very, very far away.'), { kind: 'good', ms: 4200 });
      },
      beat: 'c7QuasarFar',
    },
    {
      id: 'c7_black_hole_lesson', act: ACT_D,
      title: t('Black holes and quasars', 'Black holes'),
      objective: t('Watch the lesson on black holes and quasars. Answer a question after each film.', 'Watch the lesson about black holes.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('Why is the hole so black, and why does the quasar glow?', 'Why is it black, and why does it glow?') },
          { who: who('signal'), text: t('Let me show you. Then you can find where the stars really are.', 'Let me show you! Then you find the real stars.') },
        ]);
        await lessonOnce(LESSON_7D, { bus: game.bus });
      },
    },
    {
      id: 'c7_where_is_it', act: ACT_D,
      title: t('Where is it really?', 'Where is it really?'),
      objective: t('Stars near the black hole look pushed out. Tap where each star really is.', 'Tap where each star really is!'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('signal'), text: t('The light from these stars has bent round the hole. They look pushed out. Can you find where they really are?', 'The light is bent! Can you find where the stars really are?') },
        ]);
        await playLens({ bus: game.bus });
        hud.toast(t('You found them all! You read the bent light like a scientist.', 'You found them all!'), { kind: 'good', ms: 4200 });
      },
      beat: 'c7LensReal',
      bonusBeats: ['c7LensWrong'],
    },
  ];
}
