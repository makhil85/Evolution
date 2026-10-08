// Chapter 6: the ship for the stars (stand-in until WP-1 builds it; see
// STARSHIP_PLAN.md). Built in metres, flying towards -Z.
import * as THREE from 'three';

export function createStarship() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xaab4c0 });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 260, 16), mat);
  spine.rotation.x = Math.PI / 2; group.add(spine);
  return { group, dims: { length: 300 }, update() {}, setRingSpin() {}, setDrive() {}, setField() {}, setLights() {}, dispose() { spine.geometry.dispose(); mat.dispose(); } };
}
