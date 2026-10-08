// Chapter 6, the first part: build the rock ship, back in the asteroid belt.
//
// Lead 2026-10-07: at the edge of the Sun's family there is no reason to fly
// back in, so the ship is built where the stuff is: the asteroid belt - rock,
// ice and metal everywhere, sunlight for power, and close enough to Earth for
// the supply ships. (These steps were Chapter 5's Part D, out at the edge.)
// Design the ship, find the rock, build and test-fire the engine half; then
// the crew arrives (partA.js). See missions.js for the step format.
import { t } from '../level.js';
import { playDesignBoard } from '../ch5/designBoard.js';
import { playRockHunt } from '../ch5/rockHunt.js';
import { playWorkshop } from '../ch5/workshop.js';
import { playCh5Ending } from '../ch5/ending.js';
import { showRockB } from './opening.js';
import { clearPartB } from './partB.js';
import { clearPartQuests } from './partQuests.js';
import { clearPartE } from './partE.js';

/** Act number of this part (start.js has its title). */
export const ACT_BUILD = 0;

export function partBuildSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c6_belt_home', act: ACT_BUILD,
      title: t('Back to the asteroid belt', 'Back to the belt'),
      objective: t('Listen to Mission Control.', 'Listen to Mission Control.'),
      markers: [],
      async enter() {
        // The chapter's first step: a fresh start (or a full restart), so the
        // stations and the route from a previous go are cleared.
        clearPartB(); clearPartQuests(); clearPartE();
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Welcome home to the asteroid belt! This is where we will build your ship for the stars.', 'Welcome back to the asteroid belt! We will build a ship for the stars here.') },
          { who: 'girl', text: t('Why here, and not out at the edge where I was?', 'Why here?') },
          { who: 'Mission Control', text: t('Rock, ice and metal are all around you, the Sun still gives your panels power, and supply ships from Earth can reach you. Out at the edge, every tonne would have to be flown all the way out.', 'There are rocks, ice and metal here. The Sun gives power. And ships from Earth can reach us.') },
        ]);
      },
    },
    {
      id: 'c6_design_ship', act: ACT_BUILD,
      title: t('Design a ship for the stars', 'Make a ship for the stars'),
      objective: t('Answer Mission Control’s questions to design the ship: each answer adds a part to the plan.', 'Answer the questions. Each one adds a part to the ship.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'Mission Control', text: t('One day people will fly to another star. That trip takes many years, so the ship has to be a home, a shield and a fuel tank all at once. Let’s design one together.', 'One day people will fly to the stars. Let’s design a ship for that trip!') },
          { who: 'girl', text: t('There is rock and ice everywhere here... could we use that?', 'There are lots of rocks here. Can we use one?') },
        ]);
        await playDesignBoard({ bus: game.bus });
      },
    },
    {
      id: 'c6_rock_hunt', act: ACT_BUILD,
      title: t('Find the right rock', 'Find the rock'),
      objective: t('Scan the four rocks near you and choose the one that passes every check on the list.', 'Scan the rocks. Pick the one with all ticks.'),
      markers: [],
      async enter() {
        await playRockHunt({ bus: game.bus });
        hud.toast(t('Rock B it is. Time to build!', 'We found our rock!'), { kind: 'good', ms: 3200 });
        showRockB(game);
      },
    },
    {
      id: 'c6_engine', act: ACT_BUILD,
      title: t('Build the engine half', 'Build the engine'),
      objective: t('Mine the rock, make the fuel, print the magnet rings, fit them, and test fire.', 'Dig, make fuel, make parts, then fire the engine!'),
      markers: [],
      async enter() {
        await playWorkshop({ bus: game.bus });
        // The test fire first, so she sees the engine work; then its question
        // (complete() asks the beat after enter). The rock is built for the
        // scene; Rock B hangs by her ship again afterwards.
        game._rockB?.remove?.();
        await playCh5Ending(game);
        showRockB(game);
      },
      beat: 'c5Deuterium',
    },
  ];
}
