// Chapter 5: what makes a star shine (lesson 5C), on the long coast out past
// Pluto - the end of Part B (lead 2026-10-07: the ship is now built in
// Chapter 6, in the asteroid belt). See missions.js for the step format.
import { t } from '../level.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_5C } from '../../lesson/lessons/ch5c.js';

export function partCSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c5_lesson_fusion', act: 3,
      title: t('What makes a star shine?', 'How does the Sun shine?'),
      objective: t('Watch the lesson on atoms and the Sun. Answer a question after each film.', 'Watch the lesson about atoms and the Sun.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('Out here the Sun is just a bright star. How does it keep shining, for billions of years?', 'The Sun looks so small now. How does it keep shining?') },
          { who: 'Mission Control', text: t('Great question. To answer it we have to zoom right down, smaller than anything you have ever seen.', 'Let’s find out! We need to zoom in very, very small.') },
        ]);
        await lessonOnce(LESSON_5C, { bus: game.bus });
      },
    },
  ];
}
