// Chapter 7's mission chain, in the same step format as Chapters 4-6 (see
// missions.js): Part A leaving the Sun (cutscene, the bridge's star map),
// Part B feel the push (lesson 7A, the drop test, the zero-g float game),
// Part C chemistry and life on board (lessons 7B and 7C, the room tasks),
// Part D the holodeck (the quasar, lesson 7D, "where is it really?"),
// Part E toward Tau Ceti (full push to 90% of light, the end).
// Each part lives in its own file, built by its own work package
// (CHAPTER7_PLAN.md); this file puts them in order, and (lead 2026-10-09) keeps
// her small rocket hidden and the starship beside her in every step, and gives
// the board film (boardFilm.js) to the first walk of each part.
import { partASteps } from './partA.js';
import { partBSteps } from './partB.js';
import { partCSteps } from './partC.js';
import { partDSteps } from './partD.js';
import { partESteps } from './partE.js';
import { showStarship } from '../ch6/opening.js';
import { boardFilmBeforeWalk } from './boardFilm.js';

export function ch7Steps(game) {
  const steps = [...partASteps(game), ...partBSteps(game), ...partCSteps(game), ...partDSteps(game), ...partESteps(game)];
  // She is aboard the starship the whole chapter (also after a reload straight into
  // a step): her small rocket is never shown, and the starship is her craft (main.js,
  // game.aboardStarship). Lead 2026-10-09.
  for (const st of steps) {
    const enter = st.enter;
    st.enter = async (...a) => { game.aboardStarship = true; showStarship(game); return enter?.(...a); };
  }
  // A walk from the outside view starts with the board film, once per part (boardFilm.js).
  game.beforeWalk = () => boardFilmBeforeWalk(game);
  return steps;
}
