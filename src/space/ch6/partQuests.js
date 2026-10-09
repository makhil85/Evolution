// Chapter 6, life on board: four quests after Part B's stations. One walk
// (interior/ship.js) with the crew visits them in order: the sick bay, the
// coolant leak, a message home, the farm bay. Each quest card (quests.js) is
// followed by its question (questions.partQuests.js). Which quests are done has
// its own save key, like Part B's, so a reload doesn't make her redo them.
import { t, LEVEL } from '../level.js';
import { createInteriorScene, preloadInterior } from './interior/ship.js';
import { playQuest } from './quests.js';
import { QUESTS } from './questsLogic.js';
import { QUEST_BEAT } from './questions.partQuests.js';
import { who } from './crewInfo.js';

const WALK_CALM_S = 1.5; // the pause before a question asked on foot (flights keep CALM_S)
const KEY = `rocket_village_ch6_quests_L${LEVEL}`;
const loadDone = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const saveDone = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ } };
/** Start the quests over (a chapter restart). */
export function clearPartQuests() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }

export function partQuestsSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c6_life_on_board', act: 2,
      title: t('Life on board', 'Life on board'),
      objective: t('Keep the crew well. Walk to the sick bay, coolant, message home and farm.', 'Keep the crew well. Visit each one with its crewmate.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('doctor'), text: t('Five people in a metal ring: we have to keep each other well. The sick bay first, so I can check everyone.', 'The sick bay first, so I can check everyone!') },
          { who: 'girl', text: t('Then where next?', 'Next?') },
          { who: who('builder'), text: t('The engine room. There is a leak in the coolant, and the core gets hot without it.', 'The engine room. There is a coolant leak!') },
          { who: who('signal'), text: t('After that, a message home. Earth must know we are alive.', 'Then a message home!') },
          { who: who('biologist'), text: t('And the farm. No bees out here, so we pollinate the flowers by hand.', 'The farm last. No bees out here: we do the flowers by hand!') },
        ]);
        const done = new Set(loadDone());
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          models,
          spots: QUESTS,
          done: [...done],
          async onStation(id) {
            await playQuest(id, { bus: game.bus });
            // The question first, then the quest counts as done: two missed
            // tries restart the act, and then she redoes this quest too. On
            // foot the question still waits for a calm moment.
            await game.missions.ask(QUEST_BEAT[id], { calm: WALK_CALM_S });
            done.add(id); saveDone([...done]);
          },
        }));
        hud.toast(t('The crew is looked after. The ship is a good home!', 'The crew is well. A good ship!'), { kind: 'good' });
      },
    },
  ];
}
