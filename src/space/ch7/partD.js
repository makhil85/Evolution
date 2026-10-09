// Chapter 7, Part D: STUB from the coordinator's scaffold. WP-D replaces this
// file with the holodeck trip to a quasar, lesson 7D (black holes) and the game "Where is it really?". See CHAPTER7_PLAN.md.
import { t } from '../level.js';

export function partDSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_part_d_stub', act: 4,
      title: t('The holodeck', 'The holodeck'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([{ who: 'girl', text: t('(Part D is being built.)', '(Part D is being built.)') }]);
      },
    },
  ];
}
