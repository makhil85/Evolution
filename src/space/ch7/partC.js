// Chapter 7, Part C: chemistry and life on board (lead's decision, 2026-10-08:
// most of the chapter is inside the ship, so the science happens in the rooms).
// It builds on Chapter 6's oxygen, water and farm stations:
//   1. lesson 7B (atoms), then a walk to the two chemistry tasks: split the water
//      (the water lab) and the plants' air swap (the farm);
//   2. lesson 7C (tiny life), then a walk to the two biology tasks: the recycler's
//      microbe helpers and the bones in low g (the sick bay).
// Each task (tasks.js) is followed by its question (questions.partC.js). Which
// tasks are done has its own save key, like Chapter 6's quests, so a reload
// straight into a step doesn't make her redo them.
import { t, LEVEL } from '../level.js';
import { lessonOnce } from '../../lesson/card.js';
import { LESSON_7B } from '../../lesson/lessons/ch7b.js';
import { LESSON_7C } from '../../lesson/lessons/ch7c.js';
import { createInteriorScene, preloadInterior } from '../ch6/interior/ship.js';
import { who } from '../ch6/crewInfo.js';
import { TASKS } from './tasksLogic.js';
import { playTask } from './tasks.js';
import { TASK_BEAT } from './questions.partC.js';

const WALK_CALM_S = 1.5; // the pause before a question asked on foot (as in Chapter 6)
const KEY = `rocket_village_ch7_tasks_L${LEVEL}`;
const loadDone = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const saveDone = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ } };

const CHEMISTRY = ['split', 'plants'];
const BIOLOGY = ['microbes', 'bones'];

/** Walk to the given tasks in order; each one is played, then asked about, then saved as done. */
async function walkTasks(game, ids) {
  const done = new Set(loadDone());
  const spots = TASKS.filter((x) => ids.includes(x.id));
  const models = await preloadInterior();
  await game.runScene(createInteriorScene(game, {
    models,
    spots,
    done: [...done].filter((id) => ids.includes(id)),
    async onStation(id) {
      await playTask(id, { bus: game.bus });
      // The question first, then the task counts as done. On foot a short pause
      // with a toast, so she knows it is coming.
      game.hud.toast(t('Mission Control has a question...', 'A question is coming!'), { kind: 'info', ms: 1400 });
      await game.missions.ask(TASK_BEAT[id], { calm: WALK_CALM_S });
      done.add(id); saveDone([...done]);
    },
  }));
}

export function partCSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c7_atoms', act: 3,
      title: t('Atoms: the building blocks', 'Tiny building blocks'),
      objective: t('Find out what everything is made of, then split water and make the plants’ air.', 'Learn about atoms first.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('Before we touch the water, we need to know what it is made of.', 'First: what is everything made of?') },
          { who: who('biologist'), text: t('Echo will show us. Watch closely: the atoms are the key.', 'Watch closely. Echo will show us.') },
        ]);
        await lessonOnce(LESSON_7B, { bus: game.bus });
      },
    },
    {
      id: 'c7_chem_tasks', act: 3,
      title: t('Split the water, and make the air', 'Chemistry in the lab and farm'),
      objective: t('Go to the water lab and the farm. Use every atom, and balance the air the plants make.', 'Go to the water lab, then the farm.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('The lab first. Electricity can split water into its atoms, then we build them back up.', 'The lab first! Electricity splits water.') },
          { who: 'girl', text: t('And then the farm?', 'And then the farm?') },
          { who: who('biologist'), text: t('Yes. We breathe oxygen in and breathe carbon dioxide out. Plants do it the other way round: carbon dioxide and water go in, oxygen comes out.', 'The plants give back the oxygen we breathe.') },
        ]);
        await walkTasks(game, CHEMISTRY);
        hud.toast(t('The lab and the farm are done!', 'Chemistry done!'), { kind: 'good', ms: 3600 });
      },
    },
    {
      id: 'c7_tiny_life', act: 3,
      title: t('Tiny life helps us', 'Tiny life helps us'),
      objective: t('Watch the lesson on tiny life, and answer a question after each film.', 'Watch the lesson about tiny life.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('biologist'), text: t('Now the tiniest helpers of all: bacteria, and yeast in our bread.', 'Now the tiniest helpers: bacteria and yeast.') },
        ]);
        await lessonOnce(LESSON_7C, { bus: game.bus });
      },
    },
    {
      id: 'c7_bio_tasks', act: 3,
      title: t('Helpers and bones', 'Helpers and bones'),
      objective: t('Grow the recycler’s helpers, then keep the bones strong in the sick bay.', 'Go to the recycler, then the sick bay.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('biologist'), text: t('The recycler needs more helpers. They double each pretend hour, so let us grow enough.', 'The recycler needs more helpers.') },
          { who: 'girl', text: t('And the sick bay?', 'And the sick bay?') },
          { who: who('doctor'), text: t('In zero g our bones get thinner, and we share one bike. We have to plan it, so nobody loses too much.', 'In zero g, the bones need exercise. Share the bike!') },
        ]);
        await walkTasks(game, BIOLOGY);
        hud.toast(t('The helpers are growing, and the crew is strong!', 'Helpers and bones: done!'), { kind: 'good', ms: 3600 });
      },
    },
  ];
}
