// Chapter 7, Part A: leaving the Sun. The drive goes to full power and the ship
// leaves the Sun behind for Tau Ceti (the opening cutscene, opening.js). Then the
// crew, on the bridge, and a walk to Echo's star map: a 2-D card (starMap.js) and
// two questions (questions.partA.js: the 119 years at a tenth of light speed, and
// the nearest star). Lead 2026-10-08: Tau Ceti is "the star system for future
// exploration of alien species"; nobody knows yet if anything lives there.
//
// Reloading into either step replays it: the opening plays again, and the walk
// to the star map is always made (nothing about it is saved; the questions are
// saved by the step engine, as every other beat is). See missions.js for the format.
import { t } from '../level.js';
import { who } from '../ch6/crewInfo.js';
import { createInteriorScene, preloadInterior } from '../ch6/interior/ship.js';
import { playCh7Opening } from './opening.js';
import { playStarMap } from './starMap.js';

const WALK_CALM_S = 1.5; // the pause before a question asked on foot (flights keep CALM_S)
const ACT_A = 1;

/** The bridge's star map: one spot, at the shield console (Echo stands by it). */
export const STAR_MAP_SPOT = { id: 'c7_star_map', deck: 'bridge', near: 'shield', lead: 'signal', title: ['the bridge star map', 'the star map'] };

export function partASteps(game) {
  const { hud } = game;
  const crew = { biologist: who('biologist'), doctor: who('doctor'), builder: who('builder'), signal: who('signal') };
  return [
    {
      id: 'c7_opening', act: ACT_A,
      title: t('Leaving the Sun', 'Bye bye, Sun'),
      objective: t('Full power! Watch the ship leave for the next star, Tau Ceti.', 'Full power! Watch the ship go!'),
      markers: [],
      async enter() {
        await playCh7Opening(game); // the drive, the Sun shrinking, the star map and the caption
      },
    },
    {
      id: 'c7_star_map', act: ACT_A,
      title: t('The star map', 'The star map'),
      objective: t('Go to the star map on the bridge, with Echo, and find Tau Ceti.', 'Go to the star map on the bridge!'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: 'girl', text: t('We are going so fast! Where exactly is Tau Ceti?', 'Where is Tau Ceti?') },
          { who: crew.signal, text: t('A star a lot like our Sun, 11.9 light-years away. Come and see my star map on the bridge.', 'A star like our Sun! Come and see my map on the bridge.') },
          { who: crew.biologist, text: t('It may have planets. One day we might look for life there. Nobody knows yet if anything lives there.', 'It may have planets. One day we might look for life there. Nobody knows yet!') },
          { who: crew.doctor, text: t('At the speed we were going, the trip would take far too long. So the drive goes to full power.', 'Too slow! So the drive goes to full power.') },
          { who: crew.builder, text: t('Beep! The engine is at full power now.', 'Beep! Full power!') },
        ]);
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          spots: [STAR_MAP_SPOT],
          models,
          async onStation() {
            await playStarMap({ bus: game.bus });
            // The map first, then its two questions: two missed tries restart the act.
            await game.missions.ask('c7StarMap', { calm: WALK_CALM_S });
            await game.missions.ask('c7Nearest');
          },
        }));
        hud.toast(t('Tau Ceti is the target. Next: the full push!', 'Tau Ceti is the target!'), { kind: 'good', ms: 4200 });
      },
    },
  ];
}

