// Chapter 3's step text at LEVEL 1: short sentences a 2nd grader can read
// (lead 2026-10-05). An overlay, like questions.level1.js: only words change.
// Ids, order, costs and requirements all stay in quests.js.
//
//   STEP_TEXT_L1[stepId]  = { label?, title?, lockedMessage?, missionText?, statusText?, done?: { targetId: doneMessage } }
//   STAGE_TEXT_L1[stageId] = { title?, builtMessage? }

const EXTRA = 'You don’t need it to launch.';

export const STEP_TEXT_L1 = {
  step_cadet: {
    lockedMessage: 'The Cadet Test is open now. Walk up the road to the Mission School.',
    missionText: 'Walk up the road. Grab the glowing boxes. Take the Cadet Test at the Mission School.',
    statusText: 'Take the Cadet Test',
    done: { 'rocketPad.hologram': 'A rocket picture lights up across the river.' },
  },
  step_blueprint: {
    lockedMessage: 'The plan desk is upstairs. Pass the Cadet Test first.',
    missionText: 'Go upstairs in the Mission School. Find out how tall the rocket will be.',
    statusText: 'Finish the plan upstairs',
  },
  step_frame: {
    lockedMessage: 'The Forge is cold. Finish the plan at the Mission School first.',
    missionText: 'Go to the Forge on the right. Pick the metal for the rocket.',
    statusText: 'Pick the metal at the Forge',
    done: { materialsForge: 'The Forge is built! The Build Menu is open.' },
  },
  build_foundation: {
    label: 'Base',
    title: 'Build Stage 1 — Base + Frame',
    lockedMessage: 'Pick the metal at the Forge first. Then bring 6 wood and 6 stone to the pad.',
    missionText: 'Get 6 wood and 6 stone. Then build the rocket base at the pad.',
    statusText: 'Build the rocket base at the pad',
    done: { 'rocket.stage.foundation': 'Stage 1 is up! The frame stands on the pad.' },
  },
  step_flow: {
    lockedMessage: 'The Water Lab opens when the rocket base is built. Build Stage 1 first.',
    missionText: 'Do the tank test at the Water Lab on the left.',
    statusText: 'Do the tank test at the Water Lab',
    done: { waterLab: 'The Water Lab is built! Pipes run through it.' },
  },
  step_drag: {
    lockedMessage: 'The Wind Tunnel opens when the rocket base is built. Build Stage 1 first.',
    missionText: 'Go to the Wind Tunnel on the right. Find the best nose shape.',
    statusText: 'Test nose shapes in the Wind Tunnel',
    done: { windTunnel: 'The Wind Tunnel is built! The big fan turns.' },
  },
  build_body: {
    lockedMessage: 'First do the Water Lab test and the Wind Tunnel test. Then bring 8 iron and 4 wood.',
    missionText: 'Get 8 iron and 4 wood. Build the rocket body at the pad. It builds the bridge too!',
    statusText: 'Build the rocket body',
    done: { bridge: 'The bridge is done! Now you can cross the river.' },
  },
  step_thrust: {
    lockedMessage: 'The Science Center is across the river. Build the rocket body first. That builds the bridge.',
    missionText: 'Cross the bridge. Test the engine at the Science Center.',
    statusText: 'Cross the bridge to the Science Center',
    done: { scienceCenter: 'The Science Center is built! The engine fires.' },
  },
  step_fuel: {
    lockedMessage: 'The Fuel Depot is across the river. Build the rocket body first. That builds the bridge.',
    missionText: 'Mix the rocket fuel at the Fuel Depot.',
    statusText: 'Mix the fuel at the Fuel Depot',
    done: { fuelDepot: 'The Fuel Depot is built!' },
  },
  step_guidance: {
    lockedMessage: 'The Guidance Tower is across the river. Build the rocket body first. That builds the bridge.',
    missionText: 'Go to the Guidance Tower in the far corner. Aim the rocket.',
    statusText: 'Aim the rocket at the Guidance Tower',
    done: { guidanceTower: 'The Guidance Tower is built! Its dish turns.' },
  },
  build_control: {
    lockedMessage: 'First test the engine at the Science Center and the aim at the Tower. Then bring 6 circuits and 4 iron.',
    missionText: 'Build the engine at the pad. You need 6 circuits and 4 iron.',
    statusText: 'Build the engine',
    done: { 'rocket.stage.control': 'Stage 3 is up! The engine is on.' },
  },
  build_fuel: {
    label: 'Fuel Tanks',
    title: 'Build Stage 4 — Fuel Tanks',
    lockedMessage: 'First mix the fuel at the Depot and build the engine. Then bring 6 fuel and 2 circuits.',
    missionText: 'Put the fuel tanks on the rocket. You need 6 fuel and 2 circuits.',
    statusText: 'Build the fuel tanks',
    done: { 'rocket.stage.fuel': 'Stage 4 is up! The tanks are full.' },
  },
  step_countdown: {
    lockedMessage: 'First put the engine and the fuel tanks on the rocket.',
    missionText: 'Do the countdown check at the pad.',
    statusText: 'Do the countdown check',
    done: { 'rocketPad.countdownBoard': 'The countdown board lights up!' },
  },
  build_final: {
    title: 'Build Stage 5 — Last Part',
    lockedMessage: 'Pass the countdown check first. Then bring 4 gems, 2 rocket parts and 2 fuel.',
    missionText: 'Build the last part. You need 4 gems, 2 rocket parts and 2 fuel.',
    statusText: 'Build the last part',
    done: { 'rocket.stage.final': 'Stage 5 is done! The rocket is ready to launch!' },
  },
  step_launch: {
    lockedMessage: 'Build the last part at the pad first. Then you can launch.',
  },
  step_chief: {
    lockedMessage: `The tower opens after the engine test. This one is extra. ${EXTRA}`,
    missionText: `★ The tower has a very hard puzzle. ${EXTRA}`,
    statusText: 'Extra: the very hard puzzle',
    done: { observatory: 'The tower opens. Out comes the telescope!' },
  },
  bonus_pattern: {
    lockedMessage: 'This puzzle is in the plan room. Finish the plan first.',
    missionText: `★ A dial shows a pattern. What comes next? ${EXTRA}`,
    statusText: 'Extra: the dial pattern',
  },
  bonus_place_value: {
    label: 'Bonus • Balloons',
    lockedMessage: 'This puzzle is in the plan room. Finish the plan first.',
    missionText: `★ Two balloons flew up. Which one went higher? ${EXTRA}`,
    statusText: 'Extra: which balloon was higher',
  },
  bonus_mass: {
    lockedMessage: 'The engineer is busy. Pick the metal first.',
    missionText: `★ The engineer has an iron block and a foam block. Which is heavier? ${EXTRA}`,
    statusText: 'Extra: the two blocks',
  },
  bonus_volume: {
    lockedMessage: 'The new tank is not ready. Do the tank test first.',
    missionText: `★ A new tank came to the Water Lab. How much does it hold? ${EXTRA}`,
    statusText: 'Extra: the new tank',
  },
  bonus_division: {
    lockedMessage: 'The fuel barrel opens after the tank test.',
    missionText: `★ Share a barrel of fuel between four tanks at the Water Lab. ${EXTRA}`,
    statusText: 'Extra: share the fuel',
  },
  bonus_shape: {
    lockedMessage: 'The tunnel is busy. Finish the nose test first.',
    missionText: `★ Try a flat card two ways in the Wind Tunnel. ${EXTRA}`,
    statusText: 'Extra: the card in the tunnel',
  },
  bonus_forces: {
    lockedMessage: 'Test the engine at the Science Center first.',
    missionText: `★ Two pushes at the Science Center. What do they do? ${EXTRA}`,
    statusText: 'Extra: the two pushes',
  },
  bonus_states: {
    lockedMessage: 'This opens after the engine test.',
    missionText: `★ What happens to fuel when it burns? Find out at the Science Center. ${EXTRA}`,
    statusText: 'Extra: the fuel sample',
  },
  bonus_ratio: {
    lockedMessage: 'Mix the fuel at the Fuel Depot first.',
    missionText: `★ The mixer at the Fuel Depot needs the right amount. ${EXTRA}`,
    statusText: 'Extra: the mixer',
  },
  bonus_angle: {
    lockedMessage: 'Finish the aim test at the Tower first.',
    missionText: `★ Turn the fin at the Guidance Tower a quarter turn. Where does it point? ${EXTRA}`,
    statusText: 'Extra: turn the fin',
  },
  bonus_gravity: {
    lockedMessage: 'The tower opens after the engine test.',
    missionText: `★ Look at the Moon in the telescope. Why can people jump so high there? ${EXTRA}`,
    statusText: 'Extra: the Moon',
  },
  bonus_liftoff_mass: {
    lockedMessage: 'Do the countdown check first.',
    missionText: `★ Weigh the rocket again before launch. ${EXTRA}`,
    statusText: 'Extra: weigh the rocket',
  },
};

export const STAGE_TEXT_L1 = {
  foundation: { title: 'Base + Frame', builtMessage: 'Stage 1 is up! The frame stands on the pad.' },
  body: { builtMessage: 'Stage 2 is up! The bridge is building itself.' },
  control: { builtMessage: 'Stage 3 is up! The engine is on.' },
  fuel: { title: 'Fuel Tanks', builtMessage: 'Stage 4 is up! The tanks are full.' },
  final: { title: 'Last Part', builtMessage: 'Stage 5 is done! The rocket is ready to launch!' },
};

/** The mission card's bonus line at Level 1. */
export const BONUS_LINE_L1 = '★ Extra: a very hard puzzle at the tower.';
