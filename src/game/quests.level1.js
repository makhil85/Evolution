// Chapter 3's step text at LEVEL 1: short sentences a 2nd grader can read
// (lead 2026-10-05). An overlay, like questions.level1.js: only words change.
// Ids, order, costs and requirements all stay in quests.js.
//
//   STEP_TEXT_L1[stepId]  = { label?, title?, lockedMessage?, missionText?, statusText?, done?: { targetId: doneMessage } }
//   STAGE_TEXT_L1[stageId] = { title?, builtMessage? }
//
// Word limits at Level 1 (src/play/readGate.js TEXT_LIMITS): missionText 10,
// statusText 6, anything else 15. scripts/test-ch123-text.mjs checks them.

export const STEP_TEXT_L1 = {
  step_cadet: {
    lockedMessage: 'Walk up the road to the Mission School.',
    missionText: 'Go to the Mission School. Take the Cadet Test.',
    statusText: 'Take the Cadet Test',
    done: { 'rocketPad.hologram': 'A rocket picture lights up across the river.' },
  },
  step_blueprint: {
    lockedMessage: 'The plan desk is upstairs. Pass the Cadet Test first.',
    missionText: 'Go upstairs. Find how tall the rocket will be.',
    statusText: 'Finish the plan upstairs',
  },
  step_frame: {
    lockedMessage: 'The Lab is cold. Finish the plan at the Mission School first.',
    missionText: 'Go to the Lab on the right. Pick the metal.',
    statusText: 'Pick the metal at the Lab',
    done: { materialsForge: 'The Lab is built! The Build Menu is open.' },
  },
  build_foundation: {
    label: 'Base',
    title: 'Build Stage 1 — Base + Frame',
    lockedMessage: 'Pick the metal at the Lab first. Then get 6 wood and 6 stone.',
    missionText: 'Get 6 wood (logs) and 6 stone (rocks).',
    statusText: 'Build the base at the pad',
    done: { 'rocket.stage.foundation': 'Stage 1 is up! The frame stands on the pad.' },
  },
  step_flow: {
    lockedMessage: 'The Water Lab opens when the rocket base is built. Build Stage 1 first.',
    missionText: 'Go left to the Water Lab. Do the test.',
    statusText: 'Do the tank test',
    done: { waterLab: 'The Water Lab is built! Pipes run through it.' },
  },
  step_drag: {
    lockedMessage: 'The Wind Tunnel opens when the rocket base is built. Build Stage 1 first.',
    missionText: 'Go right to the Wind Tunnel. Find the best nose.',
    statusText: 'Test the nose shapes',
    done: { windTunnel: 'The Wind Tunnel is built! The big fan turns.' },
  },
  build_body: {
    lockedMessage: 'Do the Water Lab and Wind Tunnel tests. Then get 8 iron and 4 wood.',
    missionText: 'Get 8 iron and 4 wood. Build at the pad.',
    statusText: 'Build the rocket body: bridge too',
    done: { bridge: 'The bridge is done! Now you can cross the river.' },
  },
  step_thrust: {
    lockedMessage: 'The Science Center is across the river. Build the rocket body first.',
    missionText: 'Cross the bridge. Test the engine at the Science Center.',
    statusText: 'Cross to the Science Center',
    done: { scienceCenter: 'The Science Center is built! The engine fires.' },
  },
  step_fuel: {
    lockedMessage: 'The Fuel Depot is across the river. Build the rocket body first.',
    missionText: 'Mix the rocket fuel at the Fuel Depot.',
    statusText: 'Mix the fuel at the Depot',
    done: { fuelDepot: 'The Fuel Depot is built!' },
  },
  step_guidance: {
    lockedMessage: 'The Guidance Tower is across the river. Build the rocket body first.',
    missionText: 'Go to the Guidance Tower. Aim the rocket.',
    statusText: 'Aim at the Guidance Tower',
    done: { guidanceTower: 'The Guidance Tower is built! Its dish turns.' },
  },
  build_control: {
    lockedMessage: 'Test the engine and the aim first. Then get 6 circuits and 4 iron.',
    missionText: 'Get 6 circuits and 4 iron. Build at the pad.',
    statusText: 'Build the engine',
    done: { 'rocket.stage.control': 'Stage 3 is up! The engine is on.' },
  },
  build_fuel: {
    label: 'Fuel Tanks',
    title: 'Build Stage 4 — Fuel Tanks',
    lockedMessage: 'Mix the fuel and build the engine first. Then get 6 fuel and 2 circuits.',
    missionText: 'Get 6 fuel and 2 circuits. Build the tanks.',
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
    missionText: 'Get 4 gems, 2 rocket parts and 2 fuel.',
    statusText: 'Build the last part',
    done: { 'rocket.stage.final': 'Stage 5 is done! The rocket is ready to launch!' },
  },
  step_launch: {
    lockedMessage: 'Build the last part at the pad first. Then you can launch.',
  },
  step_chief: {
    lockedMessage: 'The tower opens after the engine test. This one is extra.',
    missionText: '★ Extra: the tower has a very hard puzzle.',
    statusText: 'Extra: the very hard puzzle',
    done: { observatory: 'The tower opens. Out comes the telescope!' },
  },
  bonus_pattern: {
    lockedMessage: 'This puzzle is in the plan room. Finish the plan first.',
    missionText: '★ Extra: upstairs, what comes next on the dial?',
    statusText: 'Extra: the dial pattern',
  },
  bonus_place_value: {
    label: 'Bonus • Balloons',
    lockedMessage: 'This puzzle is in the plan room. Finish the plan first.',
    missionText: '★ Extra: upstairs, which balloon flew higher?',
    statusText: 'Extra: which balloon was higher',
  },
  bonus_mass: {
    lockedMessage: 'The engineer is busy. Pick the metal first.',
    missionText: '★ Extra: at the Lab, iron or foam, which is heavier?',
    statusText: 'Extra: the two blocks',
  },
  bonus_volume: {
    lockedMessage: 'The new tank is not ready. Do the tank test first.',
    missionText: '★ Extra: Water Lab. How much does the new tank hold?',
    statusText: 'Extra: the new tank',
  },
  bonus_division: {
    lockedMessage: 'The fuel barrel opens after the tank test.',
    missionText: '★ Extra: at the Water Lab, share fuel between 4 tanks.',
    statusText: 'Extra: share the fuel',
  },
  bonus_shape: {
    lockedMessage: 'The tunnel is busy. Finish the nose test first.',
    missionText: '★ Extra: Wind Tunnel. Try a flat card two ways.',
    statusText: 'Extra: the card in the tunnel',
  },
  bonus_forces: {
    lockedMessage: 'Test the engine at the Science Center first.',
    missionText: '★ Extra: Science Center. What do the two pushes do?',
    statusText: 'Extra: the two pushes',
  },
  bonus_states: {
    lockedMessage: 'This opens after the engine test.',
    missionText: '★ Extra: Science Center. What happens to fuel when it burns?',
    statusText: 'Extra: the fuel sample',
  },
  bonus_ratio: {
    lockedMessage: 'Mix the fuel at the Fuel Depot first.',
    missionText: '★ Extra: set the mixer at the Fuel Depot.',
    statusText: 'Extra: the mixer',
  },
  bonus_angle: {
    lockedMessage: 'Finish the aim test at the Tower first.',
    missionText: '★ Extra: at the Tower, turn the fin a quarter turn.',
    statusText: 'Extra: turn the fin',
  },
  bonus_gravity: {
    lockedMessage: 'The tower opens after the engine test.',
    missionText: '★ Extra: the tower. Why jump high on the Moon?',
    statusText: 'Extra: the Moon',
  },
  bonus_liftoff_mass: {
    lockedMessage: 'Do the countdown check first.',
    missionText: '★ Extra: the pad. Weigh the rocket before launch.',
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
