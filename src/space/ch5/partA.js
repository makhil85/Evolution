// Chapter 5, Part A: leave Jupiter and fly to Saturn.
// See missions.js for the step format.
import { BODIES } from '../contracts.js';
import { fuelSafetyNet } from '../acts/util.js';
import { t } from '../level.js';

export function partASteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c5_start', act: 1,
      title: t('Next stop: Saturn', 'Off to Saturn'),
      objective: '',
      markers: ['saturn'],
      async enter() {
        game.target = 'saturn';
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Europa’s ice sample is safe on board. Saturn is next: the planet with the rings.', 'Your Europa ice is safe. Next stop: Saturn, the planet with rings!') },
          { who: 'girl', text: 'Rings, here I come!' },
        ]);
      },
    },
    {
      id: 'c5_leave_jupiter', act: 1,
      title: t('Leave Jupiter', 'Leave Jupiter'),
      objective: t('Follow the arrow: fly the same way Jupiter is moving and hold W until your path breaks free of Jupiter’s pull.', 'Follow the arrow and hold W to leave Jupiter.'),
      markers: ['saturn'],
      aim: 'with-body',
      escape: true,
      enter() { game.target = 'saturn'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.soi === 'sun';
      },
    },
    {
      id: 'c5_to_saturn', act: 1,
      title: t('Catch the Saturn window', 'Head for Saturn'),
      objective: t('Saturn moves too! Use time warp (1-4) until the banner says BURN NOW, then point along your path and hold W until your dotted line reaches Saturn.', 'Wait for the green BURN NOW sign (keys 1 to 4 make time go fast). Then hold W until your dotted line reaches Saturn.'),
      markers: ['saturn'],
      aim: 'prograde',
      transfer: 'saturn',
      enter() { game.target = 'saturn'; },
      check() {
        fuelSafetyNet(game);
        const c = game.prediction?.closest;
        return game.ship.soi === 'saturn' || (!!c && c.body === 'saturn' && !c.retro && c.dist < BODIES.saturn.soi * 0.6);
      },
    },
  ];
}
