// Chapter 5's end card, after the fusion lesson at the edge. (The ship
// build - design, rock hunt, engine - moved to the start of Chapter 6, in the
// asteroid belt: lead 2026-10-07.) See missions.js for the step format.
import { t } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';

export function partDSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c5_end', act: 3,
      title: t('Chapter 5 complete', 'Chapter 5 done!'),
      objective: '',
      markers: [],
      async enter() {
        markSaveComplete(game);
        await hud.showEnd({
          eyebrow: t('Chapter 5 complete', 'Chapter 5 done!'),
          title: t('To the edge of the Sun’s family!', 'You reached the edge!'),
          note: t('To be continued in Chapter 6: back in the asteroid belt, we build a ship for the stars.', 'To be continued in Chapter 6: we build a ship for the stars!'),
          route: ['Europa', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Kuiper belt', 'Pluto', t('the edge', 'the edge')],
          stats: {
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Water from the rings': `${game.stats?.water || 0}`,
            'Questions answered': answeredCount(),
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
