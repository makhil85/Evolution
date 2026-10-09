// Chapter 6, Part B: fit out the living half of the ship. One step: she
// walks the ship's decks (interior/ship.js) and does each station (stations.js),
// with that station's question after it. See missions.js for the step format.
//
// Which stations are done is kept in its own save key, so a reload doesn't
// make her redo the finished ones. A station counts as done only after its
// question, so two missed tries (an act restart) bring that station back.
import { t, LEVEL } from '../level.js';
import { createInteriorScene, preloadInterior } from './interior/ship.js';
import { playStation } from './stations.js';
import { STATION_BEAT } from './questions.partB.js';
import { CALM_S } from '../contracts.js';
import { who } from './crewInfo.js';

const KEY = `rocket_village_ch6_stations_L${LEVEL}`;
const loadDone = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const saveDone = (ids) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode */ } };
/** Start Part B over (chapter restart, "Start everything over"). */
export function clearPartB() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }

export function partBSteps(game) {
  const { hud } = game;
  return [
    {
      id: 'c6_habitat', act: 2,
      title: t('Build the living half', 'Make the ship a home'),
      objective: t('Walk the ship’s decks (the lift joins them) and visit all six stations with the crew: shield, air, water, farm, power and the store.', 'Walk round the ship. Visit all 6 stations with the crew.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('The engine half is done. Now the living half: everything that keeps five people alive between the stars.', 'The engine works. Now we make the ship a home!') },
          { who: who('biologist'), text: t('Air, water, food. Out there nothing comes from outside, so the ship has to make it all, like a tiny Earth.', 'We need air, water and food. The ship must make them all.') },
          { who: 'girl', text: t('Then let’s build it. Show me round!', 'Let’s build it! Show me!') },
        ]);
        const done = new Set(loadDone());
        const models = await preloadInterior();
        await game.runScene(createInteriorScene(game, {
          models,
          done: [...done],
          async onStation(id) {
            await playStation(id, { bus: game.bus });
            // The question first, then the station counts as done: two missed
            // tries restart the act, and then she redoes this station too.
            await game.missions.ask(STATION_BEAT[id], { calm: CALM_S });
            done.add(id); saveDone([...done]);
          },
        }));
        hud.toast(t('The living half is built! Our ship is a home now.', 'The ship is a home now!'), { kind: 'good', ms: 4200 });
      },
    },
  ];
}
