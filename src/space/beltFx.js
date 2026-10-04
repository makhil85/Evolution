// Belt effects (lead, PLAN item 11): the rock BREAKING APART when she mines
// it, its pieces flying into the ship and then (as icons) into the mined
// tally, and a short cheerful build effect on the ship when an upgrade is
// built. Purely visual and never blocking: nothing here changes resources.
//
// main.js creates it and calls update(realDt) right after belt.update(), so
// the rock shake can nudge the mesh after the belt has placed it. Chunks live
// in belt.group (heliocentric coordinates, like the rocks); the build rings
// live on the ship group (model units, scaled by SHIP.flightScale).
import * as THREE from 'three';
import { BELT } from './contracts.js';
import { SHIP_LAYOUT } from './ship.js';
import { RESOURCE_ICONS } from './hud/tally.js';
import { t } from './level.js';

const POOL = 28;
const BURST_S = 0.5;   // pieces fly apart...
const HOME_S = 0.75;   // ...then curve into the ship
const BUILD_ICONS = { bigSolarWings: '☀️', radiationShield: '🛡️', biggerTank: '⛽', strongerClaw: '🦾' };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

export function createBeltFx(game) {
  const { belt, shipView, hud, bus } = game;

  // --- rock chunks ---------------------------------------------------------
  // Chunky low-poly pieces in the rock's colour with a little glow of their
  // own: she mostly sees a rock's shadowed side, where pieces in the rock's
  // own material were black on black.
  const chunkGeo = new THREE.DodecahedronGeometry(1, 0);
  const chunkMats = {};
  for (const [kind, def] of Object.entries(BELT.kinds)) {
    const col = new THREE.Color(def.color);
    chunkMats[kind] = new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(0.55), roughness: 0.85, flatShading: true });
  }
  const chunks = [];
  for (let i = 0; i < POOL; i++) {
    const mesh = new THREE.Mesh();
    mesh.visible = false;
    mesh.frustumCulled = false;
    belt.group.add(mesh);
    // `off` is the piece's place RELATIVE TO THE SHIP: she and the rocks orbit
    // the Sun at ~23 u/s, so pieces left in heliocentric space fell far behind.
    chunks.push({ mesh, active: false, t: 0, size: 1, off: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), from: new THREE.Vector3(), batch: null });
  }
  const _ship = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const _d = new THREE.Vector3();

  /** The ship's position in belt.group's (heliocentric) frame (straight
   * from the physics: the group's matrix is a frame stale until render). */
  function shipLocal(out) {
    return out.set(game.ship.x, 0, game.ship.z);
  }

  /** Screen point (CSS px) of a world position, or null if behind the camera. */
  function screenOf(world) {
    const cam = game.camera;
    const canvas = game.renderer?.domElement;
    if (!cam || !canvas) return null;
    _v.copy(world).project(cam);
    if (_v.z > 1) return null;
    const box = canvas.getBoundingClientRect();
    return { x: box.left + ((_v.x + 1) / 2) * box.width, y: box.top + ((1 - _v.y) / 2) * box.height };
  }
  function shipScreen() {
    shipView.group.getWorldPosition(_d);
    return screenOf(_d);
  }

  // The rock being grabbed wobbles harder and harder until it cracks.
  let shaking = null;
  let shakeK = 0;
  let clock = 0;

  /** @param {object|null} record a belt.nearRocks record, k 0..1 (how close to breaking) */
  function shake(record, k = 0) { shaking = record; shakeK = k; }

  /**
   * The rock cracks: pieces burst off it and curve into the ship; when they
   * arrive, icons fly from the ship into the tally row for `resource`.
   * `record` is the rock as it was before belt.mine() ({mesh: {position,
   * scale}}): a rock that falls apart is gone from the belt after it.
   */
  function breakRock(record, { resource, kind, shatter = false } = {}) {
    if (!record?.mesh) return;
    shaking = null;
    const C = record.mesh.position;
    const R = record.mesh.scale.x;
    shipLocal(_ship);
    _d.subVectors(_ship, C).normalize(); // toward the ship
    const n = shatter ? 14 : 9;
    const batch = { left: n, landed: false, resource };
    hud.tally?.hold(resource);
    let made = 0;
    for (const c of chunks) {
      if (made >= n) break;
      if (c.active) continue;
      made += 1;
      const out = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      if (shatter) {
        // The whole rock falls apart: pieces from all through it, flying outward.
        c.mesh.position.copy(C).addScaledVector(out, R * rand(0.1, 0.6));
        c.vel.copy(out).multiplyScalar(R * 1.6 + rand(1.5, 3));
      } else {
        // A big piece cracks off the side facing her.
        c.mesh.position.copy(C).addScaledVector(_d, R * 0.85).addScaledVector(out, R * 0.3);
        c.vel.copy(_d).multiplyScalar(0.8).add(out.multiplyScalar(0.7)).normalize().multiplyScalar(R * 0.9 + rand(1.5, 3));
      }
      c.off.subVectors(c.mesh.position, _ship);
      c.size = Math.min(0.45, Math.max(0.07, R * (shatter ? 0.22 : 0.1))) * rand(0.6, 1.3);
      c.mesh.geometry = chunkGeo;
      c.mesh.material = chunkMats[kind] || chunkMats.stony;
      c.mesh.scale.set(1, 1, 1);
      c.mesh.scale.setScalar(c.size);
      c.mesh.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      c.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      c.t = -rand(0, 0.12);
      c.burst = BURST_S + rand(-0.1, 0.15);
      c.batch = batch;
      c.homing = false;
      c.active = true;
      c.mesh.visible = c.t >= 0;
    }
    batch.left = made;
    if (!made) landBatch(batch);
  }

  /** The first piece reached the ship: sparkle, and icons fly on into the tally. */
  function landBatch(batch) {
    if (batch.landed) return;
    batch.landed = true;
    shipView.fx?.sparkle?.(new THREE.Vector3(0, 0.3, SHIP_LAYOUT.Z_NOSE * 0.8));
    const cell = hud.tally?.cellFor(batch.resource);
    const from = shipScreen();
    if (!cell || !from) { hud.tally?.release(batch.resource); return; }
    hud.flyIcons({ icon: RESOURCE_ICONS[batch.resource] || '✦', from, toEl: cell, n: 3, onLand: () => hud.tally?.release(batch.resource) });
  }

  function updateChunks(dt) {
    let any = false;
    for (const c of chunks) {
      if (!c.active) continue;
      any = true;
      c.t += dt;
      if (c.t < 0) continue;
      c.mesh.visible = true;
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      shipLocal(_ship);
      if (c.t < c.burst) {
        c.off.addScaledVector(c.vel, dt);
        c.vel.multiplyScalar(Math.exp(-2.2 * dt));
        c.mesh.position.addVectors(_ship, c.off);
        continue;
      }
      if (!c.homing) { c.homing = true; c.from.copy(c.off); }
      const k = Math.min(1, (c.t - c.burst) / HOME_S);
      const e = k * k * (3 - 2 * k) * (0.6 + 0.4 * k); // eases in, snaps home
      c.off.copy(c.from).multiplyScalar(1 - e);
      c.mesh.position.addVectors(_ship, c.off);
      c.mesh.scale.setScalar(c.size * (1 - 0.8 * k));
      if (k >= 1) {
        c.active = false;
        c.mesh.visible = false;
        if (c.batch) { c.batch.left -= 1; landBatch(c.batch); }
        c.batch = null;
      }
    }
    return any;
  }

  // --- build effect ------------------------------------------------------------
  // Two gold rings sweep out round the ship, sparkles pop along it, and the
  // shield also shows a blue bubble. Model units (the ship is ~8 long).
  const ringGeo = new THREE.RingGeometry(0.94, 1, 64);
  const ringMat = () => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd36b).multiplyScalar(1.6), transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(ringGeo, ringMat());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 6;
    shipView.group.add(m);
    return m;
  });
  // The shield: a soft glowing rim (brightest at the edge, clear in the middle).
  const bubbleMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x8fe3ff).multiplyScalar(1.6) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        // clamp: pow() of a tiny negative is NaN, and one NaN pixel whites out the bloom.
        float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
        gl_FragColor = vec4(uColor * (0.08 + rim) * uOpacity, 1.0);
      }`,
  });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), bubbleMat);
  bubble.visible = false;
  bubble.renderOrder = 6;
  shipView.group.add(bubble);
  const SPARK_POINTS = [
    [0, 0.6, SHIP_LAYOUT.Z_NOSE * 0.8], [2.6, 0.4, 0.6], [-2.6, 0.4, 0.6], [0, 1.6, 0.4], [0, 0.4, SHIP_LAYOUT.Z_TAIL * 0.8], [1.6, 0.9, -1.4], [-1.6, 0.9, -1.4],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  let build = null; // { t, shield, sparks }

  function startBuild(id) {
    if (reducedMotion()) { shipView.fx?.sparkle?.(SPARK_POINTS[3]); return; }
    build = { t: 0, shield: id === 'radiationShield', sparks: 0 };
  }

  function updateBuild(dt) {
    if (!build) return;
    build.t += dt;
    const T = build.t;
    // Sparkles every 0.12 s along the ship for the first ~0.85 s.
    while (build.sparks < SPARK_POINTS.length && T > build.sparks * 0.12) {
      shipView.fx?.sparkle?.(SPARK_POINTS[build.sparks]);
      build.sparks += 1;
    }
    rings.forEach((m, i) => {
      const k = (T - i * 0.25) / 0.9;
      m.visible = k > 0 && k < 1;
      if (!m.visible) return;
      m.scale.setScalar(3 + 3.5 * (1 - (1 - k) ** 2));
      m.material.opacity = 0.55 * (1 - k);
    });
    if (build.shield) {
      const k = Math.min(1, T / 1.6);
      bubble.visible = k < 1;
      bubble.scale.setScalar(2 + 4.5 * Math.min(1, k * 2.2));
      bubbleMat.uniforms.uOpacity.value = 0.9 * Math.sin(Math.PI * k);
    }
    if (T > 1.7) { build = null; rings.forEach((m) => { m.visible = false; }); bubble.visible = false; }
  }

  /** The new part pops up big on screen, then flies down onto the ship. */
  function partBadge(id, label) {
    const to = shipScreen();
    if (!to || reducedMotion()) { startBuild(id); return; }
    const node = document.createElement('div');
    node.setAttribute('aria-hidden', 'true');
    node.dataset.fly = '1'; // lab/fullshot.js draws these too
    node.innerHTML = '<span style="font-size:54px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))"></span><b style="display:block;margin-top:6px;font:900 17px \'Segoe UI\',system-ui,sans-serif;color:#ffe9a8;text-shadow:0 2px 4px rgba(0,0,0,.7)"></b>';
    node.firstChild.textContent = BUILD_ICONS[id] || '✨';
    node.lastChild.textContent = label;
    node.style.cssText = 'position:fixed;left:0;top:0;z-index:9400;pointer-events:none;text-align:center;will-change:transform,opacity;white-space:nowrap';
    document.body.appendChild(node);
    const x0 = innerWidth / 2;
    const y0 = innerHeight * 0.36;
    const at = (x, y, s) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
    const a = node.animate([
      { transform: at(x0, y0, 0.3), opacity: 0, offset: 0 },
      { transform: at(x0, y0, 1.15), opacity: 1, offset: 0.2 },
      { transform: at(x0, y0, 1), opacity: 1, offset: 0.45 },
      { transform: at(to.x, to.y, 0.25), opacity: 0.9, offset: 1 },
    ], { duration: 1300, easing: 'ease-in-out', fill: 'both' });
    let done = false;
    const land = () => { if (done) return; done = true; node.remove(); startBuild(id); };
    a.onfinish = land;
    setTimeout(land, 1380); // a hidden tab dispatches no animation events
  }

  function onBuilt(id) {
    if (id === 'meltIce') {
      // Ice turns into fuel: a drop flies from the tally's ice row to the fuel gauge.
      const from = hud.tally?.cellFor('ice')?.getBoundingClientRect();
      const fuel = document.querySelector('.sp-hud .sp-supplies .sp-gauge');
      if (from && fuel) hud.flyIcons({ icon: '💧', from: { x: from.left + 12, y: from.top + from.height / 2 }, toEl: fuel, n: 2 });
      return;
    }
    const label = { bigSolarWings: 'Big Solar Wings', radiationShield: 'Radiation Shield', biggerTank: 'Bigger Tank', strongerClaw: 'Stronger Claw' }[id] || 'Upgrade';
    partBadge(id, t(`${label} built!`, `${label}!`));
  }
  bus.on('upgrade-built', onBuilt);

  function update(dt) {
    clock += dt;
    if (shaking?.mesh?.visible) {
      // belt.update() has just placed the mesh this frame; nudge it.
      const a = shaking.mesh.scale.x * (0.012 + 0.035 * shakeK);
      shaking.mesh.position.x += Math.sin(clock * 61) * a;
      shaking.mesh.position.y += Math.sin(clock * 47 + 1) * a;
      shaking.mesh.position.z += Math.sin(clock * 53 + 2) * a;
    }
    updateChunks(Math.min(dt, 0.1));
    updateBuild(Math.min(dt, 0.1));
  }

  return {
    update,
    shake,
    breakRock,
    /** Test hook: is anything still animating? */
    get busy() { return chunks.some((c) => c.active) || !!build; },
    dispose() { bus.off('upgrade-built', onBuilt); },
  };
}
