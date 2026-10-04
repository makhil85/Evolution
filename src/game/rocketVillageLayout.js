export const ROCKET_VILLAGE = {
  playerStart: { x: 0, z: 55 },
  hub: { x: 0, z: 25 },
  river: {
    points: [
      [-72, 3], [-58, 1], [-43, 4], [-29, 3], [-16, 2],
      [-2, 3], [15, 4], [30, 2], [45, 3], [60, 1], [72, 3],
    ],
    northBankZ: 9.6,
    southBankZ: -3.6,
    bridgeHalfWidth: 2.7,
  },
  bridge: { x: 0, z: 3, length: 15, width: 4.8 },
  rocketPad: { x: 22, z: -43, scale: 0.58 },
  buildings: [
    { id: 'missionSchool', mission: 1, x: -24, z: 31, radius: 8.2 },
    { id: 'materialsForge', mission: 2, x: 24, z: 31, radius: 8.2 },
    { id: 'waterLab', mission: 3, x: -25, z: 12, radius: 7.2 },
    { id: 'windTunnel', mission: 4, x: 25, z: 12, radius: 7.4 },
    { id: 'scienceCenter', mission: 5, x: -22, z: -18, radius: 9.0 },
    { id: 'fuelDepot', mission: 6, x: 22, z: -18, radius: 7.4 },
    { id: 'guidanceTower', mission: 7, x: -22, z: -42, radius: 7.2 },
    // Not a mission site - extra credit, and its own landmark on the south
    // side. It lives in this list so that moving it moves EVERYTHING: the
    // building, its signpost, and the clearing kept around both. It used to
    // be hardcoded separately in structures.js and stations.js, so relocating
    // it away from the launch pad meant editing two files and remembering a
    // third rule.
    { id: 'observatory', x: -4, z: -30, radius: 6.4, optional: true },
  ],
};

/**
 * Sites that host a quest step but are not buildings. The launch pad's
 * signpost is the only one - see stations.js for why it starts on the north
 * bank and moves once the bridge is laid.
 */
export const EXTRA_STATIONS = ['rocketPad'];

export const VILLAGE_PATHS = [
  { points: [[0, 62], [0, 49], [0, 38], [0, 25], [0, 13], [0, 3]], width: 4.5 },
  { points: [[0, 3], [0, -10], [0, -24], [0, -40], [18, -43]], width: 4.5 },
  { points: [[0, 31], [-11, 31], [-24, 31]], width: 3.5 },
  { points: [[0, 31], [11, 31], [24, 31]], width: 3.5 },
  { points: [[0, 13], [-12, 12], [-25, 12]], width: 3.4 },
  { points: [[0, 13], [12, 12], [25, 12]], width: 3.4 },
  { points: [[0, -17], [-10, -18], [-22, -18]], width: 3.6 },
  { points: [[0, -17], [10, -18], [22, -18]], width: 3.6 },
  { points: [[0, -38], [-10, -41], [-22, -42]], width: 3.4 },
];

export const MISSION_ARTIFACTS = [
  { buildingId: 'missionSchool', label: 'Blueprint Desk', x: -16.5, z: 27.5 },
  { buildingId: 'materialsForge', label: 'Material Samples', x: 16.4, z: 27.4 },
  { buildingId: 'waterLab', label: 'Flow Tank', x: -17.8, z: 8.5 },
  { buildingId: 'windTunnel', label: 'Wind Test Rig', x: 17.8, z: 8.4 },
  { buildingId: 'scienceCenter', label: 'Engine Cutaway', x: -13.2, z: -20.2 },
  { buildingId: 'fuelDepot', label: 'Fuel Mixer', x: 14.4, z: -20.6 },
  { buildingId: 'guidanceTower', label: 'Trajectory Scope', x: -14.4, z: -40.4 },
];
