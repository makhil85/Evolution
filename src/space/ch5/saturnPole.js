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
const BAND = 0.035; // band half-width, planet radii

/** The hexagon and vortex, in Saturn's spin frame (unscaled, real units). */
export function buildHexagon(radius, flat) {
  const g = new THREE.Group();
  g.name = 'saturn-hexagon';
  // The spheroid's height at distance rho from the axis, just above the clouds.
  const yAt = (rho) => radius * flat * Math.sqrt(Math.max(0, 1 - (rho / radius) ** 2)) * 1.004;
  const pos = [];
  const SEG = 8; // per side, so the band follows the curve of the planet
  const corner = (k, rr) => { const a = (k / 6) * Math.PI * 2; return [Math.cos(a) * rr, Math.sin(a) * rr]; };
  for (let k = 0; k < 6; k++) {
    for (let s = 0; s < SEG; s++) {
      const quad = [];
      for (const [u, edge] of [[s / SEG, -1], [(s + 1) / SEG, -1], [(s + 1) / SEG, 1], [s / SEG, 1]]) {
        const rr = radius * (HEX_R + edge * BAND);
        const [x0, z0] = corner(k, rr); const [x1, z1] = corner(k + 1, rr);
        const x = x0 + (x1 - x0) * u; const z = z0 + (z1 - z0) * u;
        quad.push([x, yAt(Math.hypot(x, z)), z]);
      }
      pos.push(...quad[0], ...quad[1], ...quad[2], ...quad[0], ...quad[2], ...quad[3]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const band = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x8fa9cf, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
  }));
  g.add(band);
  // The calmer inside, a shade bluer, and the dark eye of the vortex.
  const inner = new THREE.Mesh(new THREE.CircleGeometry(radius * (HEX_R - BAND) * 0.98, 6), new THREE.MeshBasicMaterial({
    color: 0x5f7fa8, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
  }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = yAt(radius * 0.12);
  g.add(inner);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.045, 24), new THREE.MeshBasicMaterial({
    color: 0x1d2a3d, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide,
  }));
  eye.rotation.x = -Math.PI / 2;
  eye.position.y = yAt(0) * 1.0005;
  g.add(eye);
  for (const m of g.children) m.renderOrder = 2;
  return g;
}

/** Hang the hexagon on Saturn (once). */
export function ensureHexagon(game) {
  if (game._hexagon) return game._hexagon;
  const parts = game.bodies?.parts?.('saturn');
  if (!parts) return null;
  const hex = buildHexagon(BODIES.saturn.radius, parts.flat);
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
  ensureHexagon(game);
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
      if (t > 1.5 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 5.5 && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
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
