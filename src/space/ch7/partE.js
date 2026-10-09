// Chapter 7, Part E: STUB from the coordinator's scaffold. WP-A replaces the
// first step with the full-push cruise (the speed dial to 90% of light, the
// flip-and-brake plan, the story of the clocks) and keeps the end card.
// See CHAPTER7_PLAN.md.
import { t } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';

const ACT_E = 5;

export function partESteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_part_e_stub', act: ACT_E,
      title: t('Toward Tau Ceti', 'Off to Tau Ceti'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([{ who: 'girl', text: t('(Part E is being built.)', '(Part E is being built.)') }]);
      },
    },
    {
      id: 'c7_end', act: ACT_E,
      title: t('Chapter 7 complete', 'Chapter 7 done!'),
      objective: '',
      markers: [],
      async enter() {
        markSaveComplete(game);
        await hud.showEnd({
          eyebrow: t('Chapter 7 complete', 'Chapter 7 done!'),
          title: t('Racing toward Tau Ceti!', 'Off to Tau Ceti!'),
          note: t('To be continued... at 90% of light speed, toward a Sun-like star 11.9 light-years away.', 'To be continued...'),
          route: [t('the edge of the Sun’s family', 'the edge of the Sun’s family'), t('the stars', 'the stars'), 'Tau Ceti'],
          stats: {
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Questions answered': answeredCount(),
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
