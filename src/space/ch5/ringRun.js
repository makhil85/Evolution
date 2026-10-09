// The ring run (Chapter 5): she flies inside Saturn's rings, blasting white
// ice (water) and grey rock (metal and stone) to reach the level's goal. A
// mini-scene on main.js's runScene contract; the rules are in ringRunLogic.js.
//
// Arrows or WASD steer (left/right, up/down), Space fires. Big rocks crack
// and glow with each hit until they break (2 / 3 / 5 hits by level).
import * as THREE from 'three';
import { BODIES, TEXTURE_BASE } from '../contracts.js';
import { createRings } from '../rings.js';
import { t as lvl } from '../level.js';
import { skipButton } from '../../play/grownUp.js';
import { readMs } from '../../play/readTime.js';
import { createRun, stepRun, result, botInput, goalMet, skipRun } from './ringRunLogic.js';

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

// Shots and burst parts, pooled: two InstancedMeshes (one draw call each) and
// one shared material each, made once per run. A shot or a hit creates no
// material or geometry. That matters for the look: a new material compiles its
// shader on the GPU the first time it draws, and a program is freed when its
// last material is disposed, so every burst that died used to make the next hit
// compile the shader again (the flicker on a shot). The looks stay under the
// bloom threshold (RENDER.bloom.threshold, linear), so a shot can't bloom across
// the screen.
export const BOLT_GAIN = 1.4; // the bolt's cyan, lit for the eye and not for bloom (3 blooms the whole screen)
export const PART_COLOURS = Object.freeze({ ice: 0xd8f4ff, rock: 0xc8b49a, crack: 0xffb060, bump: 0xb0a8a0, goal: 0xbff5a0 });
const BOLT_MAX = 8; // a shot lives 1.3 s and the gun fires every 0.22 s: six at most
const PART_MAX = 160; // burst parts alive at once (16 per big blast, 10 per small one)
const PART_LIFE = 0.9;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();

/**
 * @returns {{burst(x,y,z,n,hex), step(dt,speed), setBolts(list), alive(), dispose()}}
 */
export function createFx(scene) {
  const boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6).rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(BOLT_GAIN) });
  const bolts = new THREE.InstancedMesh(boltGeo, boltMat, BOLT_MAX);
  const partGeo = new THREE.IcosahedronGeometry(0.25, 0);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // each part's colour is its instance colour
  const parts = new THREE.InstancedMesh(partGeo, partMat, PART_MAX);
  // Colour and matrix for every instance now, so the program has both from the start.
  for (let i = 0; i < PART_MAX; i++) parts.setColorAt(i, _c.setHex(0xffffff));
  for (const mesh of [bolts, parts]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  const root = new THREE.Group(); // its own group, so warm() compiles these two and nothing else
  root.add(bolts, parts);
  scene.add(root);
  const pts = Array.from({ length: PART_MAX }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  const hide = (mesh, i) => { _p.set(0, 0, 0); _s.setScalar(0); _m.compose(_p, _q, _s); mesh.setMatrixAt(i, _m); };
  for (let i = 0; i < BOLT_MAX; i++) hide(bolts, i);
  for (let i = 0; i < PART_MAX; i++) hide(parts, i);

  return {
    burst(x, y, z, n, hex) {
      _c.setHex(hex);
      let made = 0;
      for (let i = 0; i < PART_MAX && made < n; i++) {
        const p = pts[i];
        if (p.life > 0) continue;
        _v.randomDirection().multiplyScalar(6 + Math.random() * 10);
        Object.assign(p, { life: PART_LIFE, x, y, z, vx: _v.x, vy: _v.y, vz: _v.z });
        parts.setColorAt(i, _c);
        made++;
      }
      if (made) parts.instanceColor.needsUpdate = true;
    },
    step(dt, speed) {
      for (let i = 0; i < PART_MAX; i++) {
        const p = pts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt + speed * dt;
          // Shrinks to nothing over its life (no alpha: an opaque material per look, so no transparent sort or new material).
          _p.set(p.x, p.y, p.z); _s.setScalar(Math.max(0, p.life / PART_LIFE));
          _m.compose(_p, _q, _s); parts.setMatrixAt(i, _m);
        } else hide(parts, i);
      }
      parts.instanceMatrix.needsUpdate = true;
    },
    /** The live shots; a slot past the list is hidden. */
    setBolts(list) {
      for (let i = 0; i < BOLT_MAX; i++) {
        const b = list[i];
        if (!b) { hide(bolts, i); continue; }
        _p.set(b.x, b.y, b.z); _s.setScalar(1);
        _m.compose(_p, _q, _s); bolts.setMatrixAt(i, _m);
      }
      bolts.instanceMatrix.needsUpdate = true;
    },
    /** Compile the shots' and parts' shaders now (lights from the run's scene), not on the first shot. */
    warm(renderer, camera) { renderer?.compile(root, camera, scene); },
    /** Parts still flying (for tests). */
    alive: () => pts.reduce((n, p) => n + (p.life > 0 ? 1 : 0), 0),
    dispose() {
      scene.remove(root);
      bolts.dispose(); parts.dispose();
      [boltGeo, boltMat, partGeo, partMat].forEach((x) => x.dispose());
    },
  };
}

/**
 * A small HUD for the run: ice and rock against the goal, time, bumps, the
 * count-in and the tip. It uses the Chapter 4/5 HUD look (.sp-hud, .sp-panel,
 * .sp-btn from hud.css), so it reads like the flight instruments.
 * onSkip: the grown-up skip button (unlock mode only).
 */
function buildPanel(goal, onSkip) {
  const div = document.createElement('div');
  div.className = 'sp-hud rr-panel';
  div.style.zIndex = '30'; // under the HUD's own dialogue and toasts (z 40)
  div.innerHTML = `
    <div class="sp-panel rr-bar" style="position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:22px;padding:8px 20px;border-radius:999px;font-size:calc(12px * var(--hud-scale));font-weight:800;white-space:nowrap">
      <span>🧊 <b class="tabular rr-ice">0</b> / ${goal.ice}</span><span>🪨 <b class="tabular rr-rock">0</b> / ${goal.rock}</span><span>⏱ <b class="tabular rr-time">0</b></span><span>💥 <b class="tabular rr-bumps">0</b></span><span class="rr-gun">🔫</span>
      <span class="rr-jam" hidden style="color:var(--sp-bad);font-weight:900">🔒 ${lvl('Gun jammed', 'Wait...')}</span>
    </div>
    <div class="rr-big" style="position:absolute;top:36%;left:0;right:0;text-align:center;font-size:calc(40px * var(--hud-scale));font-weight:900;color:var(--sp-text);text-shadow:0 3px 14px rgba(0,0,0,.7);opacity:0;transition:opacity .25s"></div>
    <div class="sp-panel rr-tip" style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);max-width:min(640px,92vw);text-align:center;font-size:calc(12.3px * var(--hud-scale));line-height:1.35"></div>`;
  document.body.appendChild(div);
  const q = (c) => div.querySelector(c);
  const skip = skipButton(onSkip, 'sp-btn sp-btn--ghost');
  if (skip) {
    skip.style.cssText = 'position:absolute;left:14px;bottom:14px;padding:8px 14px;font-size:calc(11px * var(--hud-scale))';
    div.appendChild(skip);
  }
  return {
    set(run) {
      const ice = q('.rr-ice'); const rock = q('.rr-rock');
      ice.textContent = run.got.ice; rock.textContent = run.got.rock;
      ice.style.color = run.got.ice >= goal.ice ? 'var(--sp-good)' : ''; rock.style.color = run.got.rock >= goal.rock ? 'var(--sp-good)' : '';
      q('.rr-time').textContent = Math.max(0, Math.ceil(run.level.time - run.t));
      q('.rr-bumps').textContent = run.bumps;
      // While the gun is jammed after a bump, say so on the bar (greyed gun: no shots).
      const jam = q('.rr-jam'); const jammed = run.ship.stun > 0;
      jam.hidden = !jammed;
      q('.rr-gun').style.opacity = jammed ? 0.35 : 1;
    },
    big(text, color = '') { const b = q('.rr-big'); b.textContent = text || ''; b.style.color = color || 'var(--sp-text)'; b.style.opacity = text ? 1 : 0; },
    tip(text) { const e = q('.rr-tip'); e.textContent = text || ''; e.style.display = text ? '' : 'none'; },
    /** "+12 💧" floating up from a point on screen. */
    pop(x, y, text, color = 'var(--sp-cool-glass)') {
      const s = document.createElement('div');
      s.textContent = text;
      s.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);color:${color};font-size:calc(14px * var(--hud-scale));font-weight:900;text-shadow:0 2px 8px rgba(0,0,0,.7);transition:transform 1s ease-out,opacity 1s ease-out`;
      div.appendChild(s);
      requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-160%)'; s.style.opacity = 0; });
      setTimeout(() => { s.remove(); }, 1100);
    },
    hideSkip() { if (skip) skip.hidden = true; },
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
  // Capped under the bloom threshold (1.25): see rings.js uPeak.
  const rings = createRings({ map: ringTex, planetRadius: R, peak: 1.1 });
  rings.mesh.rotation.x = -Math.PI / 2;
  rings.mesh.scale.setScalar(R);
  rings.mesh.position.copy(center);
  rings.material.uniforms.uCenter.value.copy(center);
  rings.material.uniforms.uSunDir.value.copy(sunDir);
  rings.material.uniforms.uNormal.value.set(0, 1, 0);
  rings.material.uniforms.uGain.value = 0.55; // seen up close: dimmer, so the ice stands out
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

  // No ring dust (lead, 2026-10-06): thousands of tiny points streaming past
  // hid the ice she has to shoot. Only the ice and rock move.

  // Her ship joins this scene for the run (put back when it ends).
  const shipParent = shipView.group.parent;
  const shipWas = { pos: shipView.group.position.clone(), quat: shipView.group.quaternion.clone(), scale: shipView.group.scale.clone() };
  const shipNode = new THREE.Group();
  scene.add(shipNode);
  shipNode.add(shipView.group);
  shipView.group.position.set(0, 0, 0);
  shipView.group.quaternion.identity();
  shipView.group.scale.setScalar(0.32); // the logic's hit radius fits a ship this size

  const iceMatSmall = new THREE.MeshStandardMaterial({ color: 0xe9f4ff, roughness: 0.55, metalness: 0, flatShading: true, emissive: 0x4a86c0, emissiveIntensity: 0.7 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95, flatShading: true });
  // Big rocks: one material per crack count, glowing hotter with each hit.
  const bigMats = Array.from({ length: 6 }, (_, k) => new THREE.MeshStandardMaterial({ color: 0x6f6b68, roughness: 0.95, flatShading: true, emissive: 0xff7a2a, emissiveIntensity: k * 0.35 }));
  const meshes = new Map();
  const fx = createFx(scene);

  const run = createRun(level, seed);
  const panel = buildPanel(run.level.goal, () => skipRun(run));
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

  function onEvents(ev) {
    for (const e of ev) {
      debug.events.push(e.type);
      if (e.type === 'blast') {
        const rock = e.kind === 'rock';
        fx.burst(e.x, e.y, e.z, e.big ? 16 : 10, rock ? PART_COLOURS.rock : PART_COLOURS.ice);
        const [sx, sy] = screenOf(e.x, e.y, e.z);
        panel.pop(sx, sy, rock ? `+${e.rock} 🪨` : '+1 🧊', rock ? '#e8d2b0' : '#9fe8ff');
      } else if (e.type === 'crack') {
        fx.burst(e.x, e.y, e.z, 5, PART_COLOURS.crack);
        const [sx, sy] = screenOf(e.x, e.y, e.z);
        panel.pop(sx, sy, lvl(`Crack! ${e.left} more`, `${e.left} more!`), '#ffd27a');
      } else if (e.type === 'bump') {
        fx.burst(e.x, e.y, e.z, 8, e.big ? PART_COLOURS.bump : PART_COLOURS.ice);
        // The gun jams for a moment after a bump (level.stun): say why she can't fire.
        const [sx, sy] = screenOf(e.x, e.y, e.z);
        panel.pop(sx, sy, lvl('Ouch! Gun jammed', 'Ouch! Wait'), 'var(--sp-bad)');
      }
    }
  }

  function sync(dt) {
    const s = run.ship;
    // The ship: where she is, banking into turns, kicked back by each shot.
    // The camera rides most of the kick with her, so she stays in the same
    // place on screen: it used to jump 3x the kick towards the lens on every
    // shot (the flicker) and, firing non-stop, out of the picture.
    shipNode.position.set(s.x, s.y, s.z);
    shipNode.rotation.set(Math.max(-0.3, Math.min(0.3, s.vy * 0.012)), 0, Math.max(-0.6, Math.min(0.6, -s.vx * 0.025)));
    shipView.setThrottle(0.7);
    shipView.setTurn(s.vx / 22);
    shipView.update(dt);
    // Ice.
    const live = new Set();
    for (const c of run.ice) {
      live.add(c.id);
      let m = meshes.get(c.id);
      if (!m) {
        m = new THREE.Mesh(iceGeometry(c.shape + 1, c.r, c.big), c.big ? bigMats[0] : c.rock ? rockMat : iceMatSmall);
        scene.add(m);
        meshes.set(c.id, m);
      }
      if (c.big) m.material = bigMats[Math.min(bigMats.length - 1, c.cracked || 0)];
      m.position.set(c.x, c.y, c.z);
      m.rotation.set(c.spin, c.spin * 0.7, 0);
    }
    for (const [id, m] of meshes) if (!live.has(id)) { scene.remove(m); m.geometry.dispose(); meshes.delete(id); }
    // Shots and burst parts (pooled, see createFx).
    fx.setBolts(run.bolts);
    fx.step(dt, run.level.speed);
    // Chase camera: behind and a little above, leaning with her.
    camera.position.set(s.x * 0.7, s.y * 0.7 + 3.6, 12.5 + s.z * 0.8);
    camera.up.set(-s.vx * 0.004, 1, 0).normalize();
    camera.lookAt(s.x * 0.85, s.y * 0.8 + 0.6, -30);
    // (No full-screen red flash on a hit: flashing the whole background read
    // as the screen flickering. The bump counter on the panel says it.)
    panel.set(run);
  }

  function tick(dt, input, mouse, modalOpen) {
    if (modalOpen) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    if (phase === 'count') {
      const n = 3 - Math.floor(clock);
      panel.big(n > 0 ? String(n) : lvl('Go!', 'Go!'));
      if (clock > 3.4) { phase = 'play'; panel.big(''); }
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
      if (run.over) {
        phase = 'done'; clock = 0;
        panel.hideSkip(); // the run is over: no more skipping
        // Goal met ends the run early: a clear moment with a burst of sparkles.
        if (goalMet(run)) { panel.big(lvl('Goal reached!', 'You did it!'), 'var(--sp-good)'); fx.burst(run.ship.x, run.ship.y, run.ship.z - 6, 24, PART_COLOURS.goal); }
        else panel.big(lvl('Time up!', 'Time up!'), 'var(--sp-amber)');
      }
    } else if (phase === 'done' && clock > (goalMet(run) ? 2.4 : 1.6)) {
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
      const L = run.level;
      const tip = lvl(`Space fires · get ${L.goal.ice} ice 🧊 and ${L.goal.rock} rock 🪨 · big rocks take ${L.bigHits} hits`,
        `Space to shoot. Get ${L.goal.ice} ice and ${L.goal.rock} rock!`);
      // Stays up for its reading time (lead 2026-10-09), not a fixed 4 s.
      panel.tip(tip);
      setTimeout(() => panel.tip(''), readMs(tip));
      // Compile the shot and burst shaders now, so the first shot or hit doesn't
      // stall a frame on the GPU's shader compile.
      fx.warm(game.renderer, camera);
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
      fx.dispose();
      [iceMatSmall, rockMat, ...bigMats, satMat, ringTex].forEach((x) => x.dispose());
      rings.dispose?.();
    },
  };
}

