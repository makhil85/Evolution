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
  // The engine step: her rock is being mined, so Rock B hangs beside her.
  const engine = build.findIndex((s) => s.id === 'c6_engine');
  wrap(build[engine], () => showRockB(game));
  // From the next step on (also after a reload straight into one) the starship
  // hangs beside her: the engine's test fire is done and Rock B is gone.
  for (const st of [...build.slice(engine + 1), ...rest]) {
    wrap(st, () => { game._rockB?.remove(); showStarship(game); });
  }
  return [...build, ...rest];
}
