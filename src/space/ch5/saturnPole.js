// Saturn's north pole: the six-sided storm (the hexagon) and the cutscene
// that flies her over it.
//
// The hexagon is a band of cloud ~0.27 planet radii out from the pole (each
// side about 14,500 km, wider than Earth), with the polar vortex at its
// middle. It hangs on Saturn's spinning group, so it turns with the planet.
// The flight itself is 2-D (the Sun's plane), so the pole pass is staged:
// flight is paused while the ship model rises over the pole and back.
import * as THREE from 'three';
import { BODIES } from '../contracts.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';

const HEX_R = 0.27; // circumradius, planet radii
const BAND = 0.022; // band half-width, planet radii

const CAP = 0.46; // the painted polar cap reaches this far from the axis, planet radii

/**
 * The polar cap painted on a canvas, seen from straight above the pole
 * (lead, 2026-10-06: "make the Saturn hexagon pole more realistic, right now
 * it looks very fake"). After Cassini's pictures: Saturn's golden bands
 * darken towards the pole into a blue-grey cap; the hexagon is a jet stream,
 * a soft, wavy, streaky band rather than a drawn line; inside it the clouds
 * curl in spiral lanes to a dark eye with a bright rim. The edge fades out
 * so the cap melts into the planet's own texture.
 */
function paintCap(size = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const m = size / 2; const px = m / CAP; // pixels per planet radius
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  c.translate(m, m);
  // Base: golden at the edge, deepening to blue-grey towards the pole.
  const base = c.createRadialGradient(0, 0, 0, 0, 0, m);
  base.addColorStop(0, 'rgba(58,82,104,1)');
  base.addColorStop(HEX_R / CAP * 0.9, 'rgba(78,104,124,1)');
  base.addColorStop(HEX_R / CAP * 1.25, 'rgba(150,146,126,0.95)');
  base.addColorStop(0.82, 'rgba(198,172,128,0.75)');
  base.addColorStop(1, 'rgba(210,180,130,0)');
  c.fillStyle = base; c.beginPath(); c.arc(0, 0, m, 0, Math.PI * 2); c.fill();
  // Fine cloud bands round the pole (thin wavy rings, light and dark).
  for (let i = 0; i < 140; i++) {
    const r = (0.06 + rnd() * (CAP - 0.08)) * px;
    const fade = Math.min(1, (m - r) / (m * 0.25));
    c.strokeStyle = rnd() < 0.5 ? `rgba(235,225,200,${0.05 * fade})` : `rgba(30,40,55,${0.06 * fade})`;
    c.lineWidth = 1 + rnd() * 3;
    c.beginPath();
    const a0 = rnd() * Math.PI * 2; const span = 0.6 + rnd() * 2.5; const wob = rnd() * 0.012 * px;
    for (let k = 0; k <= 40; k++) { const a = a0 + (span * k) / 40; const rr = r + Math.sin(a * 6 + i) * wob; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.stroke();
  }
  // The hexagon jet stream: many soft, slightly wavy strokes on the six-sided path.
  const hexPath = (rr, wob, ph) => {
    c.beginPath();
    for (let k = 0; k <= 6 * 24; k++) {
      const side = Math.floor(k / 24); const u = (k % 24) / 24;
      const a0 = (side / 6) * Math.PI * 2; const a1 = ((side + 1) / 6) * Math.PI * 2;
      let x = Math.cos(a0) * rr + (Math.cos(a1) - Math.cos(a0)) * rr * u;
      let y = Math.sin(a0) * rr + (Math.sin(a1) - Math.sin(a0)) * rr * u;
      const w = 1 + Math.sin(k * 0.9 + ph) * wob;
      x *= w; y *= w;
      if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  };
  for (let i = 0; i < 26; i++) {
    const off = (rnd() - 0.5) * BAND * 2.2;
    hexPath((HEX_R + off) * px, 0.006 + rnd() * 0.01, rnd() * 6);
    const light = rnd() < 0.55;
    c.strokeStyle = light ? `rgba(196,206,214,${0.10 + rnd() * 0.08})` : `rgba(52,70,92,${0.12 + rnd() * 0.1})`;
    c.lineWidth = (0.004 + rnd() * 0.012) * px;
    c.stroke();
  }
  // Small bright storm clouds caught in the jet.
  for (let i = 0; i < 60; i++) {
    const side = Math.floor(rnd() * 6); const u = rnd();
    const a0 = (side / 6) * Math.PI * 2; const a1 = ((side + 1) / 6) * Math.PI * 2;
    const rr = (HEX_R + (rnd() - 0.5) * BAND * 2) * px;
    const x = Math.cos(a0) * rr + (Math.cos(a1) - Math.cos(a0)) * rr * u;
    const y = Math.sin(a0) * rr + (Math.sin(a1) - Math.sin(a0)) * rr * u;
    const g = c.createRadialGradient(x, y, 0, x, y, (0.004 + rnd() * 0.008) * px);
    g.addColorStop(0, 'rgba(240,240,232,0.55)'); g.addColorStop(1, 'rgba(240,240,232,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 0.012 * px, 0, Math.PI * 2); c.fill();
  }
  // Spiral cloud lanes curling in to the eye.
  for (let i = 0; i < 70; i++) {
    const a0 = rnd() * Math.PI * 2; const r0 = (0.05 + rnd() * (HEX_R - 0.07)) * px;
    c.strokeStyle = rnd() < 0.5 ? 'rgba(150,175,190,0.10)' : 'rgba(25,38,52,0.12)';
    c.lineWidth = 1 + rnd() * 2.5;
    c.beginPath();
    for (let k = 0; k <= 30; k++) { const a = a0 + k * 0.06; const rr = r0 * Math.exp(-k * 0.012); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.stroke();
  }
  // The eye: dark, with a bright ring of cloud round it.
  const eyeR = 0.05 * px;
  const eye = c.createRadialGradient(0, 0, 0, 0, 0, eyeR * 1.6);
  eye.addColorStop(0, 'rgba(18,26,38,0.95)'); eye.addColorStop(0.55, 'rgba(30,44,60,0.85)');
  eye.addColorStop(0.72, 'rgba(205,214,220,0.6)'); eye.addColorStop(1, 'rgba(120,145,165,0)');
  c.fillStyle = eye; c.beginPath(); c.arc(0, 0, eyeR * 1.6, 0, Math.PI * 2); c.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The hexagon and vortex, in Saturn's spin frame (unscaled, real units). */
export function buildHexagon(radius, flat) {
  const g = new THREE.Group();
  g.name = 'saturn-hexagon';
  // A cap of the (flattened) sphere just above the clouds, mapped from above.
  const theta = Math.asin(CAP);
  const geo = new THREE.SphereGeometry(radius * 1.003, 128, 24, 0, Math.PI * 2, 0, theta);
  const p = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const z = p.getZ(i);
    uv.setXY(i, 0.5 + x / (2 * CAP * radius * 1.003), 0.5 - z / (2 * CAP * radius * 1.003));
    p.setY(i, p.getY(i) * flat);
  }
  geo.computeVertexNormals();
  // Self-lit: the Sun lies in the planet's equator plane here, so the pole
  // the cutscene looks down on is all but dark under real lighting (Cassini
  // saw it in northern summer). Painted at about daylit Saturn's brightness.
  const cap = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: paintCap(), transparent: true, depthWrite: false, color: new THREE.Color(0.92, 0.92, 0.92),
  }));
  cap.renderOrder = 2;
  g.add(cap);
  return g;
}

/** Hang the hexagon on Saturn (once). Hidden until the pole pass shows it:
 *  the cap lights itself, so left on it would glow on Saturn's night side. */
export function ensureHexagon(game) {
  if (game._hexagon) return game._hexagon;
  const parts = game.bodies?.parts?.('saturn');
  if (!parts) return null;
  const hex = buildHexagon(BODIES.saturn.radius, parts.flat);
  hex.visible = false;
  parts.spin.add(hex);
  game._hexagon = hex;
  return hex;
}

/**
 * The pole pass (~13 s, skippable): the camera rises with her ship over
 * Saturn's north pole, the hexagon below, then back down into the chase view.
 * @returns {Promise<void>}
 */
export function playPolePass(game) {
  const { shipView } = game;
  const hex = ensureHexagon(game);
  if (hex) hex.visible = true;
  const overlay = buildOverlay({ eyebrow: 'Saturn', title: 'The hexagon storm', sub: 'Over the north pole', startBlack: false });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  const parts = game.bodies?.parts?.('saturn');
  const R = BODIES.saturn.radius;
  const DURATION = 13;
  let t = 0;
  const axis = new THREE.Vector3();
  const across = new THREE.Vector3();
  const center = new THREE.Vector3();
  const shipPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 1.5); });
  setTimeout(() => overlay.bars(true), 100);

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    apply(dt, camera, states) {
      t += Math.max(0, Math.min(dt, 0.1));
      const s = states.saturn;
      center.set(s.x - game.ship.x, 0, s.z - game.ship.z);
      // Saturn's spin axis in the scene (the tilt group's up).
      if (parts) axis.set(0, 1, 0).applyQuaternion(parts.tilt.getWorldQuaternion(quat)).normalize();
      else axis.set(0, 1, 0);
      // Across the pole: square to the axis, through where she is.
      across.copy(center).negate().projectOnPlane(axis).normalize();
      // Her ship: up from her orbit to over the pole and across it, then back.
      const up = ease(t / 4) * (1 - ease((t - 9.5) / 3));
      const sweep = THREE.MathUtils.lerp(1.6, -1.6, ease((t - 1) / 10));
      shipPos.copy(center).addScaledVector(axis, R * 1.35 * up).addScaledVector(across, R * sweep * (0.4 + 0.6 * up))
        .lerp(new THREE.Vector3(), 1 - up);
      shipView.group.position.copy(shipPos);
      shipView.setThrottle(0.4);
      // Camera: behind and above her, looking down at the pole.
      camPos.copy(shipPos).addScaledVector(axis, R * 0.14).addScaledVector(across, R * 0.28);
      look.copy(center).addScaledVector(axis, R * 0.9 * up).lerp(shipPos, 0.3);
      const w = ease(t / 2) * (1 - ease((t - 11) / 2));
      blendCamera(camera, camPos, look, w);
      if (t > 0.6 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 0.6 + overlay.readS && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    if (hex) hex.visible = false;
    shipView.group.position.set(0, 0, 0);
    shipView.setThrottle(0);
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
