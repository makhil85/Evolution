// Act 5 - Finale on Europa: land, step out, drill, habitability check, the
// outro cinematic and the end card. See missions.js for the step format.
//
// The save-complete flag: missions.js's own persist() writes
// {stepIndex, deferred, answered, resources, samples} to the STORE_KEYS
// localStorage key on every step transition, but doesn't know about a
// "chapter complete" flag. markSaveComplete() (acts/util.js) writes
// `complete: true` (plus a small stats block) into that SAME blob directly,
// which works today without editing missions.js. Cleaner long-term fix:
// have missions.js's persist() itself set `complete: index >= <last step>`.
import { askBeat, ensureStatsTracking, fuelSafetyNet, markSaveComplete, answeredCount, loadSurfaceScene } from './util.js';
import { t } from '../level.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_4G } from '../../lesson/lessons/ch4.js';

export function act5Steps(game) {
  const { hud, shipView } = game;
  ensureStatsTracking(game);

  return [
    // ------------------------------------------------------------ FINALE
    {
      id: 'a5_land', act: 5,
      title: 'Land on Europa',
      objective: t('Legs down. Slow your fall and land gently on the ice.', 'Land slowly and gently on the ice.'),
      markers: ['europa'],
      aim: 'retrograde',
      land: 'europa',
      enter() { shipView.setLegs(true); game.target = 'europa'; },
      check() {
        fuelSafetyNet(game);
        return game.ship.landedOn === 'europa';
      },
      after() { hud.toast(t('Touchdown on Europa! Climb down and look for a crack in the ice.', 'You landed on Europa! Climb down and find the crack in the ice.'), { kind: 'good' }); },
    },
    // Biology lesson (lead 2026-10-05): cells, DNA and proteins, i.e. what
    // the drill is looking for, before she walks to the crack. Once per Level.
    {
      id: 'a5_lesson', act: 5,
      title: t('What makes something alive?', 'What is life made of?'),
      objective: t('Watch the Mission Biologist’s lesson on cells, DNA and proteins, and answer a question after each film.', 'Watch the lesson about living things. Then answer the questions.'),
      markers: ['europa'],
      async enter() {
        await lessonOnce(LESSON_4G, { bus: game.bus });
        hud.toast(t('Now you try! Walk to the crack in the ice and drill for signs of life.', 'Now you try! Walk to the crack and drill.'), { kind: 'good' });
      },
    },
    {
      id: 'a5_surface', act: 5,
      title: 'Drill the ice',
      objective: t('Walk to the crack (lineae), drill, and check the habitability list.', 'Walk to the crack in the ice and drill. Could anything live here?'),
      markers: ['europa'],
      async enter() {
        const scene = await loadSurfaceScene(game, { body: 'europa', onBeat: (beat) => askBeat(game, beat) });

        if (scene) {
          await game.runScene(scene);
        } else {
          await hud.showFact({ title: 'The Europa walk is coming soon', body: 'The drill sequence is still being built. Here is what you found under the ice.' });
          await askBeat(game, 'europaWalk');
          await askBeat(game, 'drillResult');
        }
        if (!game.samples.includes('Europa ice core sample')) game.samples.push('Europa ice core sample');
      },
    },
    {
      id: 'a5_end', act: 5,
      title: 'Mission complete',
      objective: '',
      async enter() {
        try {
          const mod = await import('../cinematics.js');
          if (mod?.playOutro) await mod.playOutro(game);
        } catch { /* cinematics.js not built yet - go straight to the end card */ }

        markSaveComplete(game);
        await hud.showEnd({
          name: undefined, // showEnd falls back to heroName() itself
          route: ['Earth', 'Moon', 'Mars', 'Asteroid Belt', 'Ceres', 'Jupiter', 'Europa'],
          samples: game.samples,
          stats: {
            // Real minutes at the keyboard (ship.t is game time incl. warp: it
            // said 168 min after a 10-minute voyage).
            'Time played': `${Math.max(1, Math.round((game.stats?.played || 0) / 60))} min`,
            'Days in space': `${Math.max(1, Math.round((game.ship?.t || 0) / 60))}`,
            'Questions answered': answeredCount(),
            'Fuel saved by slingshots': `${(game.stats?.fuelSaved || 0).toFixed(1)} t`,
            'Samples collected': (game.samples || []).length,
          },
        });
      },
      check() { return false; }, // stay here; the end card has already been shown
    },
  ];
}
