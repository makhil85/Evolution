// Play-mode extras shared by Chapters 1 and 2 (see PLAYMODES_PLAN.md):
//  - a soft glow under every uncollected pickup (Easy mode: easy to spot)
//  - the glowing key block shown at the home's door once the hunt is won
import * as THREE from 'three';
import * as huntModule from '../play/hunt.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * A gold ring on the ground plus a thin light pillar over each pickup, drawn
 * as two InstancedMeshes. Hidden until setOn(true).
 * @param {THREE.Object3D} root
 * @param {{id:number, x:number, z:number, locked?:boolean}[]} list
 */
export function buildPickupGlow(root, list) {
  const group = new THREE.Group();
  group.name = 'pickupGlow';
  group.visible = false;
  root.add(group);

  const ringGeo = new THREE.RingGeometry(0.55, 0.85, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe066, transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, Math.max(1, list.length));
  const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8, 1, true);
  pillarGeo.translate(0, 1.3, 0);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xfff0a0, transparent: true, opacity: 0.32, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, Math.max(1, list.length));
  for (const im of [rings, pillars]) { im.frustumCulled = false; im.renderOrder = 3; group.add(im); }

  const gone = new Set();
  let unlocked = true;
  const m = new THREE.Matrix4();
  function write() {
    list.forEach((p, i) => {
      const hide = gone.has(p.id) || (p.locked && !unlocked);
      if (hide) { rings.setMatrixAt(i, ZERO); pillars.setMatrixAt(i, ZERO); return; }
      m.makeTranslation(p.x, 0.06, p.z);
      rings.setMatrixAt(i, m);
      pillars.setMatrixAt(i, m);
    });
    rings.instanceMatrix.needsUpdate = true;
    pillars.instanceMatrix.needsUpdate = true;
  }
  write();

  return {
    group,
    setOn(on) { group.visible = !!on; },
    isOn: () => group.visible,
    setCollected(id) { gone.add(Number(id)); write(); },
    /** Locked pickups (Chapter 1's rich iron) only glow once unlocked. */
    setUnlocked(v) { unlocked = !!v; write(); },
    update(t) {
      if (!group.visible) return;
      ringMat.opacity = 0.6 + 0.25 * Math.sin(t * 3.2);
      pillarMat.opacity = 0.24 + 0.1 * Math.sin(t * 2.4);
    },
  };
}

/** The key block on its little plinth, shown at `pos` when the hunt is won. */
export function buildKeyBlock(root) {
  let mesh = null;
  const make = () => {
    const f = Reflect.get(huntModule, 'createKeyBlockMesh');
    if (typeof f === 'function') return f();
    const g = new THREE.Group();   // fallback: a plain glowing box
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd43b })));
    g.children[0].position.y = 0.5;
    return g;
  };
  return {
    show(pos) {
      if (!mesh) { mesh = make(); root.add(mesh); }
      mesh.position.set(pos.x, pos.y ?? 0, pos.z);
      mesh.scale.setScalar(1.3);
      mesh.visible = true;
    },
    hide() { if (mesh) mesh.visible = false; },
    isShown: () => !!mesh && mesh.visible,
  };
}
