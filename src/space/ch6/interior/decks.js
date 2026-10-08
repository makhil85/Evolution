// Chapter 6 interior: the ship's decks, top (nearest the hub) to bottom, and
// which station is on which. Each deck is its own module (one maker each):
//
//   export function buildDeck(kit) -> {
//     group,                       THREE.Group in deck-local metres (floor y = 0)
//     floors: [shape], solids: [shape],   walkmap.js shapes
//     ceiling: number,             room height under the camera (m), default 3.2
//     stations: { [id]: { x, z, face, lamp, y? } }   where she stands, the yaw she
//                                  faces to use it, a status lamp mesh (the shell
//                                  recolours lamp.material), the prompt's height
//     crewSpots: { [crewId]: { x, z, face } },
//     views: [{ name, pos: [x, y, z], look: [x, y, z] }],   set points for screenshots
//     update(dt, t, ctx)           ctx = { herX, herZ }
//     dispose()
//   }
//
// The lift: every deck's lift door is at the deck's origin, the lift car
// behind it (z from -2.4 to 0, x from -1.2 to 1.2; the shell builds it), and
// she steps out towards +Z. A deck must give a floor in front of the door
// (at least x -1.5..1.5, z 0..3) and its own walls along z = 0 beside the
// door (|x| >= 1.3), and keep the car's box clear.
import { buildDeck as bridge } from './bridge.js';
import { buildDeck as lifeDeck } from './lifeDeck.js';
import { buildDeck as engineering } from './engineering.js';
import { buildDeck as crewDeck } from './crewDeck.js';

export const DECKS = Object.freeze([
  { id: 'bridge', n: 1, name: ['Bridge', 'Bridge'], build: bridge, stations: ['shield'] },
  { id: 'life', n: 2, name: ['Life support: lab and farm', 'Air, water and farm'], build: lifeDeck, stations: ['oxygen', 'water', 'food'] },
  { id: 'engineering', n: 3, name: ['Engineering and cargo', 'Engine room'], build: engineering, stations: ['energy', 'pack'] },
  { id: 'crew', n: 4, name: ['Crew deck: cabins and lounge', 'Crew rooms'], build: crewDeck, stations: [] },
]);

/** The deck a station is on. */
export const deckOf = (stationId) => DECKS.find((d) => d.stations.includes(stationId))?.id || null;

/** Where she starts: the crew deck, by the lift. */
export const START_DECK = 'crew';
