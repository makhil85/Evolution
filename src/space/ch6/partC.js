// Chapter 6, Part C: lesson 6A, a ship that is a tiny Earth (after the
// habitat is built). See missions.js for the step format.
import { t } from '../level.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_6A } from '../../lesson/lessons/ch6a.js';
import { who } from './crewInfo.js';

export function partCSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c6_lesson_tiny_earth', act: 3,
      title: t('A ship that is a tiny Earth', 'A tiny Earth'),
      objective: t('Watch the lesson on keeping everyone alive. Answer a question after each film.', 'Watch the lesson about our ship.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('biologist'), text: t('Everything we built works together. Let me show you how.', 'Let me show you how it all works together.') },
        ]);
        await lessonOnce(LESSON_6A, { bus: game.bus });
      },
    },
  ];
}
