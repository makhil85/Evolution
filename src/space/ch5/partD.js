// Chapter 5, Part D (first half of the build): design the rock ship by
// questions, find the rock, build and test the engine half, then the ending
// into Chapter 6. See missions.js for the step format.
import { t } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';
import { playDesignBoard } from './designBoard.js';
import { playRockHunt } from './rockHunt.js';
import { playWorkshop } from './workshop.js';
import { playCh5Ending } from './ending.js';

export function partDSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c5_design_ship', act: 5,
      title: t('Design a ship for the stars', 'Make a ship for the stars'),
      objective: t('Answer Mission Control’s questions to design the ship: each answer adds a part to the plan.', 'Answer the questions. Each one adds a part to the ship.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('One day people will fly to another star. That trip takes many years, so the ship has to be a home, a shield and a fuel tank all at once. Let’s design one together.', 'One day people will fly to the stars. Let’s design a ship for that trip!') },
          { who: 'girl', text: t('Out here there is rock and ice everywhere... could we use that?', 'There are lots of rocks here. Can we use one?') },
        ]);
        await playDesignBoard({ bus: game.bus });
      },
    },
    {
      id: 'c5_rock_hunt', act: 5,
      title: t('Find the right rock', 'Find the rock'),
      objective: t('Scan the four rocks near you and choose the one that passes every check on the list.', 'Scan the rocks. Pick the one with all ticks.'),
      markers: [],
      async enter() {
        await playRockHunt({ bus: game.bus });
        hud.toast(t('Rock B it is. Time to build!', 'We found our rock!'), { kind: 'good', ms: 3200 });
      },
    },
    {
      id: 'c5_engine', act: 5,
      title: t('Build the engine half', 'Build the engine'),
      objective: t('Mine the rock, make the fuel, print the magnet rings, fit them, and test fire.', 'Dig, make fuel, make parts, then fire the engine!'),
      markers: [],
      async enter() { await playWorkshop({ bus: game.bus }); },
      beat: 'c5Deuterium',
    },
    {
      id: 'c5_end', act: 5,
      title: t('Chapter 5 complete', 'Chapter 5 done!'),
      objective: '',
      markers: [],
      async enter() {
        await playCh5Ending(game);
        markSaveComplete(game);
        await hud.showEnd({
          eyebrow: t('Chapter 5 complete', 'Chapter 5 done!'),
          title: t('The rock ship’s engine is ready!', 'The rock ship works!'),
          note: t('To be continued in Chapter 6: the crew arrives and the home inside is built.', 'To be continued in Chapter 6!'),
          route: ['Europa', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Kuiper belt', 'Pluto', 'Rock B'],
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
