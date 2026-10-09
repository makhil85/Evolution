// Chapter 7, Part B: STUB from the coordinator's scaffold. WP-B replaces this
// file with lesson 7A (how do you know you are speeding up?), the drop test at gentle push, the zero-g float game during the engine check, the drop test at full push. See CHAPTER7_PLAN.md.
import { t } from '../level.js';

export function partBSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_part_b_stub', act: 2,
      title: t('Feel the push', 'Feel the push'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([{ who: 'girl', text: t('(Part B is being built.)', '(Part B is being built.)') }]);
      },
    },
  ];
}
