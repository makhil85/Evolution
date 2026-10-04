// Easy mode's navigation: a glowing chevron on the ground at her feet that
// turns smoothly to point at the next objective, a beacon over the objective
// (a soft light column with a floating diamond and hoop), and a text pill
// saying what it is and how far. Medium keeps only the beacon; Hard shows
// neither. The arrow fades away when she is within 2 m of the target, and the
// bobbing / flowing motion stops for prefers-reduced-motion.
import * as THREE from 'three';
import { ensurePlayStyles, prefersReducedMotion } from './ui.js';

const GOLD = 0xffcf5c;
const NEAR = 2;   // metres: the arrow fades out inside this

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** A soft white radial blob (tinted by the material colour). */
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A tall fade: opaque at the foot of the column, clear at the top. */
function columnTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);   // canvas top = column top
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glowMat = (map, color, opacity, additive = true, depthTest = false) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, opacity, depthWrite: false, depthTest, fog: false, toneMapped: false,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

/**
 * @param {THREE.Scene} scene
 * @returns {{
 *   setTarget: (t: {x:number, z:number, y?:number, label:string} | null) => void,
 *   setArrow: (on:boolean) => void,
 *   setBeacon: (on:boolean) => void,
 *   update: (dt:number, playerPos: THREE.Vector3) => void,
 *   dispose: () => void,
 * }}
 */
export function createNavArrow(scene) {
  ensurePlayStyles();
  const still = prefersReducedMotion();
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  const root = new THREE.Group();
  root.name = 'navArrow';
  scene.add(root);

  const blob = keep(blobTexture());
  const column = keep(columnTexture());

  // --- the ground arrow: three chevrons flowing toward the target ------------
  const arrowGroup = new THREE.Group();
  arrowGroup.renderOrder = 25;
  root.add(arrowGroup);

  const flat = (geo) => { geo.rotateX(-Math.PI / 2); return keep(geo); };   // lie on the ground, tip toward -Z
  const shadow = new THREE.Mesh(flat(new THREE.PlaneGeometry(3.4, 3.4)), keep(glowMat(blob, 0x000000, 0.34, false, true)));
  const glow = new THREE.Mesh(flat(new THREE.PlaneGeometry(3.6, 3.6)), keep(glowMat(blob, GOLD, 0.55, true, true)));
  shadow.renderOrder = 24;
  glow.renderOrder = 25;
  arrowGroup.add(shadow, glow);

  const chev = new THREE.Shape();
  chev.moveTo(0, 0.6); chev.lineTo(0.72, -0.08); chev.lineTo(0.72, -0.46);
  chev.lineTo(0, 0.2); chev.lineTo(-0.72, -0.46); chev.lineTo(-0.72, -0.08); chev.closePath();
  const chevGeo = flat(new THREE.ShapeGeometry(chev));
  const chevs = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(chevGeo, keep(new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: true, fog: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    })));
    m.renderOrder = 26;
    arrowGroup.add(m);
    return m;
  });

  // --- the beacon: light column, ground glow, floating diamond and hoop -------
  const beaconGroup = new THREE.Group();
  root.add(beaconGroup);
  const colMat = keep(glowMat(column, 0xffd35a, 0.7, false));
  colMat.side = THREE.DoubleSide;
  const HEIGHT = 10;
  const colMesh = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.3, 0.42, HEIGHT, 20, 1, true)), colMat);
  colMesh.position.y = HEIGHT / 2;
  colMesh.renderOrder = 20;
  const baseGlow = new THREE.Mesh(flat(new THREE.PlaneGeometry(3, 3)), keep(glowMat(blob, GOLD, 0.7)));
  baseGlow.position.y = 0.06;
  baseGlow.renderOrder = 20;

  const floater = new THREE.Group();
  floater.position.y = 3.6;
  const diamondGeo = keep(new THREE.OctahedronGeometry(0.34));
  const diamond = new THREE.Mesh(diamondGeo, keep(new THREE.MeshBasicMaterial({
    color: 0xffd35a, transparent: true, opacity: 0.95, depthTest: false, fog: false, toneMapped: false,
  })));
  diamond.scale.y = 1.5;
  diamond.renderOrder = 22;
  const edgeGeo = keep(new THREE.EdgesGeometry(diamondGeo));
  const edges = new THREE.LineSegments(edgeGeo, keep(new THREE.LineBasicMaterial({
    color: 0xfff6d0, transparent: true, opacity: 0.95, depthTest: false, fog: false, toneMapped: false,
  })));
  edges.scale.y = 1.5;
  edges.renderOrder = 23;
  const hoop = new THREE.Mesh(keep(new THREE.TorusGeometry(0.62, 0.035, 8, 48)), keep(new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.85, depthTest: false, fog: false, toneMapped: false,
  })));
  hoop.renderOrder = 22;
  floater.add(diamond, edges, hoop);
  beaconGroup.add(colMesh, baseGlow, floater);

  // --- the text pill -------------------------------------------------------------
  const text = document.createElement('div');
  text.className = 'play-nav-text';
  text.setAttribute('aria-live', 'off');
  document.body.appendChild(text);

  let target = null;
  let arrowOn = true;
  let beaconOn = true;
  let t = 0;
  let yaw = 0;
  let haveYaw = false;
  let fade = 1;        // 0 when she is at the target, 1 when far
  let shownLabel = '';
  let near = false;

  const setOpacity = (mesh, o) => { mesh.material.opacity = o; };

  return {
    setTarget(next) {
      if (next !== target && (!next || !target)) haveYaw = false;   // a fresh target: no swing from an old heading
      target = next;
    },
    setArrow(on) { arrowOn = !!on; },
    setBeacon(on) { beaconOn = !!on; },
    update(dt, playerPos) {
      t += dt;
      const show = !!target && !!playerPos;
      arrowGroup.visible = show && arrowOn;
      beaconGroup.visible = show && beaconOn;
      text.style.display = show && arrowOn ? 'block' : 'none';
      if (!show) return;

      const dx = target.x - playerPos.x;
      const dz = target.z - playerPos.z;
      const d = Math.hypot(dx, dz);

      // Turn smoothly along the shortest way round.
      const want = Math.atan2(-dx, -dz);
      if (!haveYaw) { yaw = want; haveYaw = true; }
      else yaw = wrapAngle(yaw + wrapAngle(want - yaw) * (1 - Math.exp(-9 * dt)));

      // Fade out when she is nearly there, back in as she walks off.
      fade += ((d < NEAR ? 0 : 1) - fade) * (1 - Math.exp(-5 * dt));

      if (arrowGroup.visible) {
        const bob = still ? 0 : Math.sin(t * 3.2) * 0.035;
        arrowGroup.position.set(
          playerPos.x - Math.sin(yaw) * 1.6,
          (playerPos.y || 0) + 0.12 + bob,
          playerPos.z - Math.cos(yaw) * 1.6,
        );
        arrowGroup.rotation.y = yaw;
        const pulse = still ? 1 : 0.85 + 0.15 * Math.sin(t * 3.2);
        setOpacity(glow, 0.5 * fade * pulse);
        setOpacity(shadow, 0.34 * fade);
        chevs.forEach((m, i) => {
          if (still) {
            m.position.z = 0.4 - i * 0.5;
            setOpacity(m, (0.45 + 0.25 * (i)) * fade);
          } else {
            const p = (t * 0.85 + i / 3) % 1;        // 0 (behind) -> 1 (ahead)
            m.position.z = 0.6 - p * 1.3;
            setOpacity(m, Math.sin(Math.PI * p) * 0.95 * fade);
          }
          m.scale.setScalar(1 - 0.12 * (i / 2));
        });
      }

      if (beaconGroup.visible) {
        const s = 1 + Math.min(d, 80) / 40;      // stays readable from far away
        beaconGroup.position.set(target.x, target.y ?? 0, target.z);
        colMesh.scale.set(s, 1, s);
        baseGlow.scale.setScalar(s);
        floater.scale.setScalar(s);
        floater.position.y = 3.6 + (still ? 0 : Math.sin(t * 2.2) * 0.14);
        diamond.rotation.y = edges.rotation.y = still ? 0.6 : t * 1.3;
        hoop.rotation.y = still ? 0.6 : t * 0.9;
        const closeFade = d < 4 ? 0.35 + 0.65 * (d / 4) : 1;   // do not blind her when she stands in it
        colMat.opacity = (still ? 0.62 : 0.55 + 0.1 * Math.sin(t * 2.6)) * closeFade;
        baseGlow.material.opacity = 0.7 * closeFade;
      }

      const label = `➜ ${target.label} · ${Math.round(d)} m`;
      if (label !== shownLabel) { shownLabel = label; text.textContent = label; }
      const isNear = d < NEAR;
      if (isNear !== near) { near = isNear; text.classList.toggle('is-near', near); }
    },
    dispose() {
      scene.remove(root);
      for (const x of disposables) x.dispose?.();
      text.remove();
    },
  };
}
