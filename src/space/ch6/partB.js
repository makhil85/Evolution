// Chapter 6, Part B: build the living half inside the rock ship. One step:
// she walks the habitat (habitat.js) and does each station (stations.js),
// with that station's question after it. See missions.js for the step format.
//
// Which stations are done is kept in its own save key, so a reload (or a
// restart after two missed tries) doesn't make her redo the finished ones.
import { t, LEVEL } from '../level.js';
import { askBeat } from '../acts/util.js';
import { createHabitatScene } from './habitat.js';
import { playStation } from './stations.js';
import { STATION_BEAT } from './questions.partB.js';
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
      objective: t('Walk inside the rock ship and visit all six stations with the crew: shield, air, water, farm, power and the store.', 'Walk inside the rock ship. Visit all 6 stations with the crew.'),
      markers: [],
      async enter() {
        await hud.showDialogue([
          { who: who('builder'), text: t('The engine half is done. Now the living half: everything that keeps five people alive between the stars.', 'The engine works. Now we make a home inside!') },
          { who: who('biologist'), text: t('Air, water, food. Out there nothing comes from outside, so the ship has to make it all, like a tiny Earth.', 'We need air, water and food. The ship must make them all.') },
          { who: 'girl', text: t('Then let’s build it. Show me round!', 'Let’s build it! Show me!') },
        ]);
        const done = new Set(loadDone());
        await game.runScene(createHabitatScene(game, {
          done: [...done],
          async onStation(id) {
            await playStation(id, { bus: game.bus });
            done.add(id); saveDone([...done]);
            await askBeat(game, STATION_BEAT[id]);
          },
        }));
        hud.toast(t('The living half is built! Our rock is a home now.', 'The ship is a home now!'), { kind: 'good', ms: 4200 });
      },
    },
  ];
}
