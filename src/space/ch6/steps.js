// Chapter 6's mission chain, in the same step format as Chapter 4
// (see missions.js): the build in the asteroid belt (design, rock, engine),
// Part A (the crew), Part B (the living half), Part C (lesson 6A), Part E
// (energy, the fastest way out, the drive, light).
import { partBuildSteps } from './partBuild.js';
import { partASteps } from './partA.js';
import { partBSteps } from './partB.js';
import { partCSteps } from './partC.js';
import { partESteps } from './partE.js';
import { showRockB } from './opening.js';

export function ch6Steps(game) {
  const build = partBuildSteps(game);
  const rest = [...partASteps(game), ...partBSteps(game), ...partCSteps(game), ...partESteps(game)];
  // Rock B hangs beside her once she has chosen it: every step from the
  // engine build on shows it (also after a reload straight into one).
  for (const st of [...build.slice(build.findIndex((s) => s.id === 'c6_engine')), ...rest]) {
    const enter = st.enter;
    st.enter = async (...a) => { showRockB(game); return enter?.(...a); };
  }
  return [...build, ...rest];
}
