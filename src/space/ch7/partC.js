// Chapter 7, Part C: STUB from the coordinator's scaffold. WP-C replaces this
// file with lessons 7B (atoms) and 7C (tiny life) and the four room tasks (split water, the plants' air swap, microbe helpers, bones in low g). See CHAPTER7_PLAN.md.
import { t } from '../level.js';

export function partCSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_part_c_stub', act: 3,
      title: t('Chemistry and life on board', 'Science on the ship'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([{ who: 'girl', text: t('(Part C is being built.)', '(Part C is being built.)') }]);
      },
    },
  ];
}
