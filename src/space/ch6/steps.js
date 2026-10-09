// Chapter 6's mission chain, in the same step format as Chapter 4
// (see missions.js): the build in the asteroid belt (design, rock, engine),
// Part A (the crew), Part B (the living half), life on board (the quests,
// partQuests.js), Part C (lesson 6A), Part E (energy, the fastest way out,
// the drive, light).
import { partBuildSteps } from './partBuild.js';
import { partASteps } from './partA.js';
import { partBSteps } from './partB.js';
import { partQuestsSteps } from './partQuests.js';
import { partCSteps } from './partC.js';
import { partESteps } from './partE.js';
import { showRockB, showStarship } from './opening.js';

export function ch6Steps(game) {
  const build = partBuildSteps(game);
  const rest = [...partASteps(game), ...partBSteps(game), ...partQuestsSteps(game), ...partCSteps(game), ...partESteps(game)];
  const wrap = (st, show) => {
    const enter = st.enter;
    st.enter = async (...a) => { show(); return enter?.(...a); };
  };
  // Before the dock (the belt build) her own rocket flies, as before. The flag is set on
  // every enter, so a reload or a Jump into a step gets the right craft.
  for (const st of build) { st.aboard = false; wrap(st, () => { game.aboardStarship = false; }); }
  // The engine step: her rock is being mined, so Rock B hangs beside her.
  const engine = build.findIndex((s) => s.id === 'c6_engine');
  wrap(build[engine], () => showRockB(game));
  // The dock is Part A's first step (the supply ship docks at the starship). From
  // there on (also after a reload straight into one) she is aboard: her small rocket
  // is gone for good, the starship is her craft (main.js, game.aboardStarship), and
  // the engine's test fire is done, so Rock B is gone too.
  for (const st of rest) {
    st.aboard = true; // missions.js sets the flag before the enter, so a reload gets it at once
    wrap(st, () => { game._rockB?.remove(); game.aboardStarship = true; showStarship(game); });
  }
  return [...build, ...rest];
}
