// Chapter 6's mission chain, in the same step format as Chapter 4
// (see missions.js). One file per part as the chapter is built.
import { partESteps } from './partE.js';

export function ch6Steps(game) {
  return [
    ...partESteps(game),
  ];
}
