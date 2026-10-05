// The Kuiper belt (Chapter 5): a wide, thin ring of icy bits past Neptune,
// drawn as points (they are far too small and far apart to see as rocks).
// Like the asteroid belt, it rides the floating origin: update() each frame.
import * as THREE from 'three';

export const KUIPER = Object.freeze({ inner: 54000, outer: 78000, thick: 900, count: 9000 });

export function createKuiper({ scene }) {
  const pos = new Float32Array(KUIPER.count * 3);
  const col = new Float32Array(KUIPER.count * 3);
  let s = 12345;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const c = new THREE.Color();
  for (let i = 0; i < KUIPER.count; i++) {
    // Denser in the middle of the belt.
    const k = (rnd() + rnd() + rnd()) / 3;
    const r = KUIPER.inner + (KUIPER.outer - KUIPER.inner) * k;
    const a = rnd() * Math.PI * 2;
    pos.set([Math.cos(a) * r, (rnd() - 0.5) * 2 * KUIPER.thick * (0.3 + rnd()), Math.sin(a) * r], i * 3);
    c.setHSL(0.55 + rnd() * 0.08, 0.15 + rnd() * 0.2, 0.55 + rnd() * 0.25);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.name = 'kuiper-belt';
  points.frustumCulled = false;
  scene.add(points);
  return {
    points,
    /** origin: the floating origin (her position), as for the asteroid belt. */
    update(origin) { points.position.set(-origin.x, 0, -origin.z); },
    setVisible(v) { points.visible = v; },
    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}
