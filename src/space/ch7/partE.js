// Chapter 7, Part E: toward Tau Ceti. The full push (cruise.js): the fusion drive
// stays at full power and the ship speeds up to about 90% of light speed. Then
// the story of the clocks from Echo (no relativity lesson: very fast clocks tick
// slower, about 7 years pass for the crew and about 14 on Earth), and two questions
// (questions.partE.js: the speed after a minute at 1 g, and the years gap). Then the
// end card, with its stats: the top speed (90% of light) and the destination.
//
// Lead 2026-10-08: "the ship keeps on accelerating with the fusion drive until it
// reaches about 90% of light speed". The drive is pretend: no drive we can build
// today could do this. See missions.js for the step format.
import { t } from '../level.js';
import { markSaveComplete, answeredCount } from '../acts/util.js';
import { who } from '../ch6/crewInfo.js';
import { playCh7Cruise } from './cruise.js';
import { TOP_SPEED, TAU_CETI_LY } from './voyage.js';

const ACT_E = 5;

/** Who says what (names from ch6/crewInfo.js). */
const CREW = { builder: who('builder'), signal: who('signal') };

export function partESteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_full_push', act: ACT_E,
      title: t('Full push to 90%', 'Full push!'),
      objective: t('The drive stays on at full power. Watch the ship speed up towards the speed of light.', 'Full push! Watch the ship go!'),
      markers: [],
      async enter() {
        await playCh7Cruise(game); // the push, the dial to 90%, the plan strip and the ship clock
        await hud.showDialogue([
          { who: CREW.signal, text: t('We are at about 90% of light speed. The fastest we have ever gone!', 'We are at 90% of light speed! The fastest ever!') },
          { who: CREW.signal, text: t('Here is a strange story about very fast clocks: they tick slower. On the trip to Tau Ceti, about 7 years pass for us, but about 14 years pass on Earth.', 'Very fast clocks tick slower! About 7 years for us, about 14 on Earth!') },
          { who: 'girl', text: t('So when we get there, Earth will be 14 years older. And we will be only 7 years older!', 'So Earth gets older faster than us!') },
          { who: CREW.builder, text: t('This is a pretend drive, from a story. Nobody can build one like it yet.', 'This is a pretend engine, from a story.') },
        ]);
      },
      beat: 'c7PushSpeed',
      bonusBeats: ['c7Clocks'],
    },
    {
      id: 'c7_end', act: ACT_E,
      title: t('Chapter 7 complete', 'Chapter 7 done!'),
      objective: '',
      markers: [],
      async enter() {
        markSaveComplete(game);
        await hud.showEnd({
          eyebrow: t('Chapter 7 complete', 'Chapter 7 done!'),
          title: t('Racing toward Tau Ceti!', 'Off to Tau Ceti!'),
          note: t(`To be continued... at ${Math.round(TOP_SPEED * 100)}% of light speed, toward a Sun-like star ${TAU_CETI_LY} light-years away.`, 'To be continued...'),
          route: [t('the edge of the Sun’s family', 'the edge of the Sun’s family'), t('the stars', 'the stars'), 'Tau Ceti'],
          stats: {
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Top speed': t(`${Math.round(TOP_SPEED * 100)}% of light`, `${Math.round(TOP_SPEED * 100)}% of light`),
            'Destination': t(`Tau Ceti, ${TAU_CETI_LY} light-years`, 'Tau Ceti, about 12 light-years'),
            'Questions answered': answeredCount(),
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
