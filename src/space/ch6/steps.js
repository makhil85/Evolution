// Chapter 6's mission chain, in the same step format as Chapter 4
// (see missions.js): Part A (the crew), Part B (the living half), Part C
// (lesson 6A), Part E (the route, the slingshots, the Sun dive, light).
import { partASteps } from './partA.js';
import { partBSteps } from './partB.js';
import { partCSteps } from './partC.js';
import { partESteps } from './partE.js';
import { showRockB } from './opening.js';

export function ch6Steps(game) {
  showRockB(game); // the rock ship hangs beside her for the whole chapter
  return [
    ...partASteps(game),
    ...partBSteps(game),
    ...partCSteps(game),
    ...partESteps(game),
  ];
}
