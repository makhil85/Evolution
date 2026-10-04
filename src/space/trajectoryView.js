// Draws the predicted path: the glowing dotted line that is the child's main
// flying tool.
//
// WHY POINTS ARE RE-ANCHORED. predictor.js returns heliocentric points, which
// is correct but reads badly: a path looping round the Moon, drawn in the
// Sun's frame, smears into a spiral because the Moon moves while she loops.
// So every point is stored RELATIVE to the body that dominated it at its own
// time, and re-attached to that body's CURRENT position each frame. A loop
// round the Moon then looks like a loop round the Moon, and it travels with
// the Moon, which is how every orbital game shows it and how she will think
// about it.
//
// Points are screen-sized (sizeAttenuation off), so the line is equally
// readable zoomed onto the cockpit or pulled out to a whole planet.
import * as THREE from 'three';
import { anchorPath } from './pathFrames.js';

const MAX_POINTS = 360;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * opts.color / opts.size / opts.opacity restyle it: the same view draws the
 * PLANNED path (main.js: where the next burn takes her) as a fainter line.
 */
export function createTrajectoryView({ scene, color = 0x7ff3ff, size = 6, opacity = 1 }) {
  // Relative offsets (x, z) from each point's frame body, and that body's id.
  const rel = new Float64Array(MAX_POINTS * 2);
  const frameOf = new Array(MAX_POINTS).fill('sun');
  const times = new Float64Array(MAX_POINTS);
  let count = 0;
  let first = 0; // dots before this one are already behind her (see update)
  let impactIndex = -1;

  const positions = new Float32Array(MAX_POINTS * 3);
  const colors = new Float32Array(MAX_POINTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);

  const mat = new THREE.PointsMaterial({
    size,
    opacity,
    sizeAttenuation: false,
    map: dotTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  // Cyan for a normal path, warm red for the part after an impact is certain.
  const SAFE = new THREE.Color(color).multiplyScalar(1.1);
  const DANGER = new THREE.Color(0xff6a4a).multiplyScalar(1.2);
  const tmp = new THREE.Color();

  const bodyPos = {};

  return {
    /** Take a fresh predictor result. Cheap enough to call a few times a second. */
    setPrediction(pred) {
      const n = Math.min(MAX_POINTS, pred.times.length);
      anchorPath(pred, n, rel, frameOf);
      times.set(pred.times.subarray(0, n));
      count = n;
      first = 0;
      impactIndex = pred.impact ? n - 1 : -1;

      // Colour fades along the path so "now" is bright and "later" is dim.
      for (let i = 0; i < n; i++) {
        const f = 1 - (i / Math.max(1, n - 1)) * 0.75;
        tmp.copy(impactIndex >= 0 && i > n * 0.7 ? DANGER : SAFE).multiplyScalar(f);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, count);
    },

    /** Re-anchor to the bodies' current positions and the floating origin. */
    update({ time, origin, positions: bodyStates }) {
      for (const k in bodyPos) delete bodyPos[k];
      // Under time warp the line is refreshed less often than she moves
      // along it (main.js): the dots she has already passed are hidden.
      const was = first;
      while (first < count - 2 && times[first + 1] <= time) first++;
      if (first !== was) geo.setDrawRange(first, count - first);
      for (let i = 0; i < count; i++) {
        const body = frameOf[i];
        let bx = 0;
        let bz = 0;
        if (body !== 'sun') {
          const s = bodyStates[body];
          bx = s.x; bz = s.z;
        }
        positions[i * 3] = rel[i * 2] + bx - origin.x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = rel[i * 2 + 1] + bz - origin.z;
      }
      geo.attributes.position.needsUpdate = true;
    },

    setVisible(v) { points.visible = v; },
    get willImpact() { return impactIndex >= 0; },
  };
}
