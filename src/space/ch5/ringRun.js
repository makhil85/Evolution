// The ring run (Chapter 5): she flies inside Saturn's rings, dodging ice and
// blasting chunks for water. A mini-scene on main.js's runScene contract;
// the rules are in ringRunLogic.js.
//
// Arrows or WASD steer (left/right, up/down), Space fires. Grey boulders are
// too big to blast: shots bounce off, so she dodges them.
import * as THREE from 'three';
import { BODIES, TEXTURE_BASE } from '../contracts.js';
import { createRings } from '../rings.js';
import { t as lvl } from '../level.js';
import { createRun, stepRun, result, botInput } from './ringRunLogic.js';

const R = 2400; // Saturn's radius in the scene (only the look matters)
const STEP = 1 / 60;

function iceGeometry(seed, r, big) {
  const geo = new THREE.IcosahedronGeometry(1, big ? 2 : 1);
  const p = geo.attributes.position;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const v = new THREE.Vector3();
  const bumps = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!bumps.has(key)) bumps.set(key, 0.72 + rnd() * 0.5);
    v.multiplyScalar(r * bumps.get(key));
    v.y *= big ? 0.85 : 0.75;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A small HUD for the run: water, time, bumps, and the count-in. */
function buildPanel() {
  const div = document.createElement('div');
  div.className = 'rr-panel';
  div.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;font:600 18px system-ui,sans-serif;color:#eaf6ff;text-shadow:0 2px 6px rgba(0,0,0,.6)';
  div.innerHTML = `
    <div style="position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;justify-content:center;gap:34px;background:rgba(6,10,22,.7);padding:8px 22px;border-radius:999px">
      <span>💧 <b class="rr-water">0</b></span><span>⏱ <b class="rr-time">0</b></span><span>💥 <b class="rr-bumps">0</b></span>
    </div>
    <div class="rr-big" style="position:absolute;top:38%;left:0;right:0;text-align:center;font-size:64px;opacity:0;transition:opacity .25s"></div>
    <div class="rr-tip" style="position:absolute;bottom:34px;left:50%;transform:translateX(-50%);text-align:center;font-size:17px;background:rgba(6,10,22,.7);padding:8px 18px;border-radius:12px"></div>`;
  document.body.appendChild(div);
  const q = (c) => div.querySelector(c);
  return {
    set(run) {
      q('.rr-water').textContent = run.water;
      q('.rr-time').textContent = Math.max(0, Math.ceil(run.level.time - run.t));
      q('.rr-bumps').textContent = run.bumps;
    },
    big(text) { const b = q('.rr-big'); b.textContent = text || ''; b.style.opacity = text ? 1 : 0; },
    tip(text) { const e = q('.rr-tip'); e.textContent = text || ''; e.style.display = text ? '' : 'none'; },
    /** "+12 💧" floating up from a point on screen. */
    pop(x, y, text, color = '#9fe8ff') {
      const s = document.createElement('div');
      s.textContent = text;
      s.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);color:${color};font-size:20px;transition:transform 1s ease-out,opacity 1s ease-out`;
      div.appendChild(s);
      requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-160%)'; s.style.opacity = 0; });
      setTimeout(() => { s.remove(); }, 1100);
    },
    remove() { div.remove(); },
  };
}

/**
 * @param game main.js's game object
 * @param {{level?:'easy'|'medium'|'hard', seed?:number}} opts
 * @returns the mini-scene object game.runScene expects; start() resolves the score.
 */
export function buildRingRun(game, { level = 'easy', seed = 7 } = {}) {
  const { shipView } = game;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2e5);

  const sunDir = new THREE.Vector3(0.55, 0.35, 0.75).normalize();
  scene.add(new THREE.AmbientLight(0x8090b0, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.position.copy(sunDir);
  scene.add(sun);

  // Saturn off to the left, its rings a bright floor running to the horizon.
  const loader = new THREE.TextureLoader();
  const satMat = new THREE.MeshStandardMaterial({ color: 0xe8d6b0, roughness: 1 });
  const saturn = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), satMat);
  saturn.scale.y = 0.9;
  const center = new THREE.Vector3(-1.85 * R, -0.14 * R, -0.6 * R);
  saturn.position.copy(center);
  scene.add(saturn);
  loader.load(TEXTURE_BASE + BODIES.saturn.tex.map, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; satMat.map = tx; satMat.color.set(0xffffff); satMat.needsUpdate = true; });
  const ringTex = loader.load(TEXTURE_BASE + BODIES.saturn.tex.ring);
  ringTex.wrapS = THREE.ClampToEdgeWrapping;
  const rings = createRings({ map: ringTex, planetRadius: R });
  rings.mesh.rotation.x = -Math.PI / 2;
  rings.mesh.scale.setScalar(R);
  rings.mesh.position.copy(center);
  rings.material.uniforms.uCenter.value.copy(center);
  rings.material.uniforms.uSunDir.value.copy(sunDir);
  rings.material.uniforms.uNormal.value.set(0, 1, 0);
  rings.material.uniforms.uGain.value = 1.1; // seen up close, not from far away
  scene.add(rings.mesh);

  // Stars.
  {
    const n = 1500; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(9e4);
      pos.set([v.x, Math.abs(v.y) * 0.9 + 2000, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false })));
  }

  // Ring dust: tiny ice all round her, streaming past (it is the rings, close up).
  const DUST = 2200;
  const dustPos = new Float32Array(DUST * 3);
  const dustRand = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < DUST; i++) {
    dustPos.set([(dustRand(i) * 2 - 1) * 70, (dustRand(i + 0.5) * 2 - 1) * 14 - 4, -dustRand(i + 0.25) * 300], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(dust);

  // Her ship joins this scene for the run (put back when it ends).
  const shipParent = shipView.group.parent;
  const shipWas = { pos: shipView.group.position.clone(), quat: shipView.group.quaternion.clone(), scale: shipView.group.scale.clone() };
  const shipNode = new THREE.Group();
  scene.add(shipNode);
  shipNode.add(shipView.group);
  shipView.group.position.set(0, 0, 0);
  shipView.group.quaternion.identity();
  shipView.group.scale.setScalar(0.32); // the logic's hit radius fits a ship this size

  const iceMatSmall = new THREE.MeshStandardMaterial({ color: 0xe9f4ff, roughness: 0.55, metalness: 0, flatShading: true, emissive: 0x18324a, emissiveIntensity: 0.4 });
  const iceMatBig = new THREE.MeshStandardMaterial({ color: 0x7d7a78, roughness: 0.95, flatShading: true });
  const meshes = new Map();
  const boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6).rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(3) });
  const boltMeshes = [];
  const bursts = [];
  const burstGeo = new THREE.IcosahedronGeometry(0.25, 0);

  const panel = buildPanel();
  const run = createRun(level, seed);
  const debug = { run, auto: false, events: [] };

  let phase = 'count'; // count -> play -> done
  let clock = 0;
  let acc = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const tmp = new THREE.Vector3();

  function screenOf(x, y, z) {
    tmp.set(x, y, z).project(camera);
    return [(tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight];
  }

  function burst(x, y, z, n, color) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x, y, z);
      m.userData.v = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 10);
      m.userData.life = 0.9;
      scene.add(m);
      bursts.push(m);
    }
  }

  function onEvents(ev) {
    for (const e of ev) {
      debug.events.push(e.type);
      if (e.type === 'blast') {
        burst(e.x, e.y, e.z, 10, 0xd8f4ff);
        const [sx, sy] = screenOf(e.x, e.y, e.z);
        panel.pop(sx, sy, `+${e.water} 💧`);
      } else if (e.type === 'bounce') {
        burst(e.x, e.y, e.z, 4, 0xffd27a);
        const [sx, sy] = screenOf(e.x, e.y, e.z);
        panel.pop(sx, sy, lvl('Too big!', 'Too big!'), '#ffd27a');
      } else if (e.type === 'bump') {
        burst(e.x, e.y, e.z, 8, e.big ? 0xb0a8a0 : 0xd8f4ff);
      }
    }
  }

  function sync(dt) {
    const s = run.ship;
    // The ship: where she is, banking into turns, kicked back by each shot.
    shipNode.position.set(s.x, s.y, s.z * 3);
    shipNode.rotation.set(s.vy * 0.012, 0, -s.vx * 0.025);
    shipView.setThrottle(0.7);
    shipView.setTurn(s.vx / 22);
    shipView.update(dt);
    // Ice.
    const live = new Set();
    for (const c of run.ice) {
      live.add(c.id);
      let m = meshes.get(c.id);
      if (!m) {
        m = new THREE.Mesh(iceGeometry(c.shape + 1, c.r, c.big), c.big ? iceMatBig : iceMatSmall);
        scene.add(m);
        meshes.set(c.id, m);
      }
      m.position.set(c.x, c.y, c.z);
      m.rotation.set(c.spin, c.spin * 0.7, 0);
    }
    for (const [id, m] of meshes) if (!live.has(id)) { scene.remove(m); m.geometry.dispose(); meshes.delete(id); }
    // Shots.
    while (boltMeshes.length < run.bolts.length) { const m = new THREE.Mesh(boltGeo, boltMat); scene.add(m); boltMeshes.push(m); }
    boltMeshes.forEach((m, i) => {
      const b = run.bolts[i];
      m.visible = !!b;
      if (b) m.position.set(b.x, b.y, b.z * 1);
    });
    for (let i = bursts.length - 1; i >= 0; i--) {
      const m = bursts[i];
      m.userData.life -= dt;
      m.position.addScaledVector(m.userData.v, dt);
      m.position.z += run.level.speed * dt;
      m.material.opacity = Math.max(0, m.userData.life / 0.9);
      if (m.userData.life <= 0) { scene.remove(m); m.material.dispose(); bursts.splice(i, 1); }
    }
    // Ring dust streams past at her speed.
    const p = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let z = p.getZ(i) + run.level.speed * dt;
      if (z > 20) z -= 320;
      p.setZ(i, z);
    }
    p.needsUpdate = true;
    // Chase camera: behind and a little above, leaning with her.
    camera.position.set(s.x * 0.7, s.y * 0.7 + 3.6, 12.5 + s.z * 0.6);
    camera.up.set(-s.vx * 0.004, 1, 0).normalize();
    camera.lookAt(s.x * 0.85, s.y * 0.8 + 0.6, -30);
    // Hit flash: the screen edge glows red for a moment.
    scene.background.setRGB(0.008 + s.hitFlash * 0.25, 0.012, 0.04);
    panel.set(run);
  }

  function tick(dt, input, mouse, modalOpen) {
    if (modalOpen) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    if (phase === 'count') {
      const n = 3 - Math.floor(clock);
      panel.big(n > 0 ? String(n) : lvl('Go!', 'Go!'));
      if (clock > 3.4) { phase = 'play'; panel.big(''); setTimeout(() => panel.tip(''), 4000); }
      sync(dt);
      return;
    }
    if (phase === 'play') {
      acc += dt;
      while (acc >= STEP && !run.over) {
        acc -= STEP;
        const inp = debug.auto ? botInput(run) : { turn: input.turn, thrust: input.thrust, fire: input.steady };
        onEvents(stepRun(run, STEP, inp));
      }
      if (run.over) { phase = 'done'; clock = 0; panel.big(lvl('Out of the ice!', 'You made it!')); }
    } else if (phase === 'done' && clock > 1.6) {
      phase = 'gone';
      finish(result(run));
    }
    sync(dt);
  }

  return {
    scene,
    camera,
    debug,
    start() {
      panel.tip(lvl('Arrows steer · Space fires · grey boulders are too big to blast, so dodge them',
        'Arrows to steer. Space to shoot. Dodge the grey rocks!'));
      return done;
    },
    tick,
    dispose() {
      panel.remove();
      shipParent?.add(shipView.group);
      shipView.group.position.copy(shipWas.pos);
      shipView.group.quaternion.copy(shipWas.quat);
      shipView.group.scale.copy(shipWas.scale);
      shipView.setThrottle(0);
      shipView.setTurn(0);
      for (const m of meshes.values()) m.geometry.dispose();
      for (const m of bursts) m.material.dispose();
      [iceMatSmall, iceMatBig, boltGeo, boltMat, burstGeo, dustGeo, satMat, ringTex].forEach((x) => x.dispose());
      rings.dispose?.();
    },
  };
}

