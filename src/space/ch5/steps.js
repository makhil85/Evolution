// Chapter 5's mission chain, in the same step format as Chapter 4
// (see missions.js). One file per part as the chapter is built.
import { partASteps } from './partA.js';

export function ch5Steps(game) {
  return [
    ...partASteps(game),
  ];
}
