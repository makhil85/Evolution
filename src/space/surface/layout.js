// Surface scenes - where everything stands, per body. One place, so the
// terrain (which flattens landing spots), the props and the story agree.
//
// World frame: 1 unit = 1 metre, +Y up. The ship stands at the origin with its
// nose toward -Z and its hatch (port side) facing -X. Every objective lies out
// in the -Z half, so the camera behind her looks toward the goals AND toward
// the big sky object (Earth / Jupiter), which hangs above the horizon ahead.
//
// Directions in the sky are given as azimuth (degrees from -Z toward +X,
// i.e. clockwise seen from above) and elevation (degrees above the horizon).
import * as THREE from 'three';

const DEG = Math.PI / 180;

/** Unit vector for an azimuth/elevation pair (see header). */
export function skyDir(azDeg, elDeg, out = new THREE.Vector3()) {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export const LAYOUT = {
  moon: {
    title: 'Moon',
    gravity: 1.62,                 // m/s^2, 1/6 of Earth's
    // Low Sun behind her left shoulder: long shadows stream out ahead of her.
    sun: { az: -138, el: 19, color: 0xfff3e2, intensity: 3.3, discDeg: 0.55 },
    fill: { sky: 0x0b0d14, ground: 0x7c7770, intensity: 0.62 },
    ship: { x: 0, z: 0, yaw: 0 },
    sample: { x: -4.2, z: -12.8 },
    station: { x: -13.2, z: -29.5 },
    lander: { x: -9.4, z: -32.6 },
    oldPrints: { x: -10.2, z: -27.2 },
    flat: [
      { x: 0, z: 0, r: 7.5 },
      { x: -4.2, z: -12.8, r: 2.4 },
      { x: -11, z: -30, r: 6.5 },
    ],
    // Earth: 3.3 deg radius (life size is ~1 deg; this is the wow version).
    earth: { az: 12, el: 17, radiusDeg: 3.3 },
    bounds: 70,
  },
  europa: {
    title: 'Europa',
    gravity: 1.31,                 // m/s^2, about 1/7 of Earth's
    sun: { az: 118, el: 20, color: 0xfff6ec, intensity: 3.1, discDeg: 0.13 },
    fill: { sky: 0x0a0c14, ground: 0x9aa3ad, intensity: 0.7 },
    ship: { x: 0, z: 0, yaw: 0 },
    // The drill spot, ON the crack line below.
    drill: { x: -2.8, z: -17.5 },
    flat: [
      { x: 0, z: 0, r: 7.5 },
    ],
    // Jupiter: 11 deg radius. Io hangs beside it on the sunward side.
    jupiter: { az: -11, el: 22, radiusDeg: 13.5 },
    bounds: 70,
    // Linear features. kind 0 = brown band (lineae), 1 = double ridge,
    // 2 = the young crack she drills (always first). ang = direction of the
    // line, degrees from +X toward -Z (counter-clockwise seen from above).
    lines: [
      { kind: 2, x: -2.8, z: -17.5, ang: 9, half: 160, width: 1.05, depth: 0.5 },
      { kind: 1, x: 0, z: -330, ang: -5, half: 1400, width: 15, sep: 48, height: 24 },
      { kind: 1, x: 260, z: -40, ang: 78, half: 900, width: 11, sep: 32, height: 15 },
      { kind: 0, x: -45, z: 25, ang: 36, half: 700, width: 7 },
      { kind: 0, x: -140, z: -160, ang: -52, half: 600, width: 5 },
      { kind: 0, x: 22, z: -62, ang: -27, half: 260, width: 2.6 },
      { kind: 0, x: 60, z: 70, ang: 102, half: 400, width: 3.5 },
      { kind: 0, x: -30, z: -200, ang: 14, half: 500, width: 4 },
    ],
  },
};
