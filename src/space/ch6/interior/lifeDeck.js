// Chapter 6 interior: deck stand-in (to be built; see decks.js for the contract).
import { placeholderDeck } from './placeholder.js';

export function buildDeck(kit) {
  return placeholderDeck(kit, { stations: ['oxygen','water','food'], crew: ['biologist'], label: 'lifeDeck' });
}
