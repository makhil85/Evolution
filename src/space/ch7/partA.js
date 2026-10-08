// Chapter 7, Part A: STUB from the coordinator's scaffold. WP-A replaces this
// file with the opening cutscene (the drive at full power, the Sun shrinking to a star, the star map zooming to Tau Ceti) and the walk to the bridge star map. See CHAPTER7_PLAN.md.
import { t } from '../level.js';

export function partASteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_part_a_stub', act: 1,
      title: t('Leaving the Sun', 'Bye bye, Sun'),
      objective: '',
      markers: [],
      async enter() {
        await hud.showDialogue([{ who: 'girl', text: t('(Part A is being built.)', '(Part A is being built.)') }]);
      },
    },
  ];
}
