// Chapter 6, Part A: the crew arrives. The supply ship docks at Rock B
// (opening.js, after the engine is built in the asteroid belt); this step
// is the hello.
// See missions.js for the step format.
import { t } from '../level.js';
import { CREW_INFO, who } from './crewInfo.js';
import { playCh6Opening } from './opening.js';

export function partASteps(game) {
  const { hud } = game;
  const intro = (id, l4, l1) => ({ who: who(id), text: t(l4, l1) });
  return [
    {
      id: 'c6_meet_crew', act: 1,
      title: t('Meet the crew', 'Meet the crew'),
      objective: t('The supply ship has docked. Say hello to your crew.', 'Say hello to your new crew!'),
      markers: [],
      async enter() {
        await playCh6Opening(game); // the supply ship docks
        await hud.showDialogue([
          { who: 'Mission Control', text: t('The supply ship is docked. Nobody flies between the stars alone: meet your crew.', 'The supply ship is here. Meet your crew!') },
          intro('biologist', `Hi! I’m ${CREW_INFO.biologist.name}, the biologist. I look after the air, the water and the farm.`, `Hi! I’m ${CREW_INFO.biologist.name}. I look after plants, air and water.`),
          intro('doctor', `I’m ${CREW_INFO.doctor.name}, the doctor. I keep everyone healthy, and I watch the radiation.`, `I’m ${CREW_INFO.doctor.name}, the doctor. I keep us healthy.`),
          intro('builder', `BOLT, BUILDER BOT. I lift heavy things and fix the outside of the ship. Beep.`, 'I am Bolt the robot. I fix things!'),
          intro('signal', `And I’m ${CREW_INFO.signal.name}, the signal bot. I talk to Earth and scan the way ahead.`, `I’m ${CREW_INFO.signal.name} the robot. I talk to Earth.`),
          { who: 'girl', text: t('And I’m the engineer and the navigator. Welcome aboard, everyone!', 'I fly the ship. Welcome, everyone!') },
        ]);
      },
    },
  ];
}
