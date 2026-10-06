// Chapter 6, Part A: the crew arrives. The opening (opening.js, played on a
// fresh start) docks the supply ship at Rock B; this step is the hello.
// See missions.js for the step format.
import { t } from '../level.js';
import { CREW_INFO, who } from './crewInfo.js';
import { clearPartB } from './partB.js';
import { clearPartE } from './partE.js';

export function partASteps(game) {
  const { hud } = game;
  const intro = (id, l4, l1) => ({ who: who(id), text: t(l4, l1) });
  return [
    {
      id: 'c6_meet_crew', act: 1,
      title: t('Meet the crew', 'Meet the crew'),
      objective: t('The supply ship from Earth has docked at the rock ship. Say hello to the crew who will fly with you.', 'Say hello to your new crew!'),
      markers: [],
      async enter() {
        // The chapter's first step: a fresh start (or a full restart), so the
        // stations and the route from a previous go are cleared.
        clearPartB(); clearPartE();
        await hud.showDialogue([
          { who: 'Mission Control', text: t('The supply ship is docked. Nobody flies between the stars alone: meet your crew.', 'The supply ship is here. Meet your crew!') },
          intro('biologist', `Hi! I’m ${CREW_INFO.biologist.name}, the biologist. I look after the air, the water and the farm.`, `Hi! I’m ${CREW_INFO.biologist.name}. I look after plants, air and water.`),
          intro('doctor', `I’m ${CREW_INFO.doctor.name}, the doctor. I keep everyone healthy, and I watch the radiation.`, `I’m ${CREW_INFO.doctor.name}, the doctor. I keep us healthy.`),
          intro('builder', `BOLT, BUILDER BOT. I lift heavy things and fix the outside of the rock. Beep.`, 'I am Bolt the robot. I fix things!'),
          intro('signal', `And I’m ${CREW_INFO.signal.name}, the signal bot. I talk to Earth and scan the way ahead.`, `I’m ${CREW_INFO.signal.name} the robot. I talk to Earth.`),
          { who: 'girl', text: t('And I’m the engineer and the navigator. Welcome aboard, everyone!', 'I fly the ship. Welcome, everyone!') },
        ]);
      },
    },
  ];
}
