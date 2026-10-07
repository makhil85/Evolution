// Surface scenes - her, on foot, in low gravity.
//
// A fresh buildGirlRig at TRUE size (1.3 m), cel-shaded in her own look, with
// a bubble helmet (there is no air!) and a small life-support backpack.
//
// MOTION. Her clips (idle / walk / run / wave / cheer) are blended by weight
// with an AnimationMixer, and a few procedural overlays (mid-air, crouch,
// climb, drill, look-up) are slerped over the result after the mixer runs.
//
// LOW GRAVITY. Walking is a "moon lope": every step is a small hop whose
// height and hang time come from the real gravity (h = g T^2 / 8), and the
// walk/run clips are driven by that hop phase, so a step in the clip lands
// exactly when her feet come down. A big jump (Space) is ballistic with the
// real g too - about 1.8 m high and 3 s of hang time on the Moon, which is
// the number the Moon-jump question asks for.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildGirlRig, defaultChoices } from '../../character/girl.js';
import { BONE_INDEX } from '../../character/rig.js';
import { loadLook } from '../../launcher/profile.js';
import { toonRamp } from '../../game/toonPipeline.js';
import { SHIP_PALETTE, INK } from '../contracts.js';
import { clamp, lerp } from './noise.js';

export const GIRL_HEIGHT = 1.3;
const WALK_SPEED = 1.55;      // m/s
const RUN_SPEED = 3.3;
const WALK_HOP = 0.07;        // m, lope hop height when walking
const RUN_HOP = 0.24;         // m, a proper bound when running
const JUMP_V = 2.45;          // m/s take-off speed (a 30 cm jump on Earth)

// gait 'earth' (the Chapter 6 habitat, where the spin makes near-Earth
// weight): no lope, firm footing, and the walk clip played at its own rate
// scaled by speed, exactly like the villages (src/game/avatar.js). The
// numbers keep Chapter 1's stride for her height: her clip cycle covers
// about 3 of her heights there, here 2.5 m at walking pace.
const EARTH = Object.freeze({ walk: 3.2, run: 5.5, walkRef: 2.5, runRef: 5.2, grip: 8, turn: 12 });

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

/** Toon material for her (and her kit): the shared ramp plus a cool rim so she reads against black sky. */
export function makeGirlToon({ color = 0xffffff, vertexColors = true, rim = 0.35 } = {}) {
  const m = new THREE.MeshToonMaterial({ color, vertexColors, gradientMap: toonRamp });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rim };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uRim;\nvoid main() {')
      .replace('#include <opaque_fragment>', /* glsl */`
        {
          vec3 Vd = normalize( vViewPosition );
          float ndv = clamp( dot( normal, Vd ), 0.0, 1.0 );
          float rimBand = smoothstep( 0.55, 0.66, 1.0 - ndv );
          outgoingLight += ( diffuseColor.rgb * 0.5 + vec3( 0.25, 0.3, 0.4 ) ) * rimBand * uRim;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `surfaceGirlToon-${vertexColors}-${rim}`;
  return m;
}

/** A plain inverted-hull outline for rigid kit. */
function hull(geo, scale = 1.06) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  m.scale.setScalar(scale);
  m.castShadow = false;
  return m;
}

function helmetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uGround: { value: new THREE.Color(0.35, 0.34, 0.33) },
      uTint: { value: new THREE.Color(0xcfeeff) },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWN;
      varying vec3 vWP;
      varying vec3 vVN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        vWN = normalize(mat3(modelMatrix) * normal);
        vVN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSunDir;
      uniform vec3 uGround;
      uniform vec3 uTint;
      varying vec3 vWN;
      varying vec3 vWP;
      varying vec3 vVN;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vWN);
        vec3 V = normalize(cameraPosition - vWP);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float f = pow(1.0 - ndv, 3.0);
        vec3 R = reflect(-V, N);
        // Environment: the lit ground below the horizon, black sky above,
        // with a soft bright band where the two meet.
        float below = smoothstep(0.05, -0.2, R.y);
        vec3 env = uGround * below + vec3(0.02, 0.025, 0.035) * (1.0 - below);
        env += uGround * 0.6 * exp(-pow(R.y / 0.06, 2.0));
        float sunSpec = pow(max(dot(R, uSunDir), 0.0), 1400.0);
        float sunSoft = pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.12;
        // Cartoon window shine in screen terms, hugging the upper-left rim.
        vec3 n2 = normalize(vVN);
        float dd = dot(n2.xy, normalize(vec2(-0.6, 0.8)));
        float band = smoothstep(0.66, 0.7, dd) * (1.0 - smoothstep(0.8, 0.84, dd)) * (1.0 - smoothstep(0.5, 0.72, ndv));
        vec3 col = uTint * env * (0.25 + 1.4 * f) + vec3(1.0, 0.97, 0.9) * (sunSpec * 14.0 + sunSoft) + vec3(0.9) * band * 0.35;
        float a = clamp(0.05 + f * 0.75 + band * 0.3 + sunSpec + sunSoft * 0.5 + below * f * 0.2, 0.0, 0.96);
        gl_FragColor = vec4(col / max(a, 0.05), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * @param {{ gravity: number, look?: object, groundTint?: number, gait?: 'lope'|'earth' }} o
 */
export function createWalker({ gravity, look = null, groundTint = 0x5a5854, gait = 'lope' }) {
  const earth = gait === 'earth';
  const root = new THREE.Group();
  root.name = 'surfaceGirl';
  const choices = { ...defaultChoices(), ...(look || loadLook() || {}) };
  const bodyMat = makeGirlToon({ vertexColors: true, rim: 0.32 });
  const rig = buildGirlRig(choices, { material: bodyMat, height: GIRL_HEIGHT, outline: true, outlineThickness: 0.011 });
  root.add(rig.group);
  // She casts a shadow but does not receive one: on a cel-shaded, low-poly
  // body a low Sun turns self-shadowing into blotches (classic toon practice).
  rig.mesh.receiveShadow = false;
  const B = rig.byName;
  const S = rig.scale;

  // --- helmet: fitted to her skull (the vertices skinned to the head bone) ---
  rig.group.updateMatrixWorld(true);
  const geo = rig.geometry;
  const sp = geo.attributes.position;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const headIdx = BONE_INDEX.head;
  let minY = Infinity, maxY = -Infinity;
  const headVerts = [];
  for (let i = 0; i < sp.count; i++) {
    if (si.getX(i) === headIdx && sw.getX(i) > 0.5) {
      const y = sp.getY(i);
      headVerts.push(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const cy = maxY - (maxY - minY) * 0.47;
  let zMin = Infinity, zMax = -Infinity;
  for (const i of headVerts) {
    if (sp.getY(i) > cy) { const z = sp.getZ(i); if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
  }
  const centre = new THREE.Vector3(0, cy, (zMin + zMax) / 2);
  let rad = 0;
  for (const i of headVerts) {
    const y = sp.getY(i);
    if (y < cy - (maxY - minY) * 0.3) continue;   // ponytail tip / neck skirt: let those be
    const d = Math.hypot(sp.getX(i) - centre.x, y - centre.y, sp.getZ(i) - centre.z);
    if (d > rad) rad = d;
  }
  const helmetR = rad * 1.1 + 0.015;
  const headInv = new THREE.Matrix4().copy(B.head.matrixWorld).invert();
  const helmetLocal = centre.clone().applyMatrix4(headInv);

  const helmetMat = helmetMaterial();
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(helmetR, 48, 32), helmetMat);
  helmet.name = 'helmet';
  helmet.position.copy(helmetLocal);
  helmet.renderOrder = 4;
  B.head.add(helmet);

  // Neck ring + backpack, cream and orange like the ship.
  const kitMat = makeGirlToon({ vertexColors: false, rim: 0.25 });
  kitMat.color.set(SHIP_PALETTE.hull);
  const accentMat = makeGirlToon({ vertexColors: false, rim: 0.2 });
  accentMat.color.set(SHIP_PALETTE.accent);
  const darkMat = makeGirlToon({ vertexColors: false, rim: 0.2 });
  darkMat.color.set(SHIP_PALETTE.dark);

  const neckInv = new THREE.Matrix4().copy(B.neck.matrixWorld).invert();
  const ringGeo = new THREE.TorusGeometry(helmetR * 0.66, helmetR * 0.13, 10, 32);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, accentMat);
  const ringWorld = new THREE.Vector3(0, centre.y - helmetR * 0.8, centre.z - 0.005);
  ring.position.copy(ringWorld.clone().applyMatrix4(neckInv));
  ring.castShadow = true;
  ring.add(hull(ringGeo, 1.05));
  B.neck.add(ring);

  const chestInv = new THREE.Matrix4().copy(B.chest.matrixWorld).invert();
  const packW = 0.27 * (GIRL_HEIGHT / 1.3), packH = 0.33, packD = 0.13;
  const packGeo = new RoundedBoxGeometry(packW, packH, packD, 3, 0.035);
  const pack = new THREE.Mesh(packGeo, kitMat);
  // Behind her shoulder blades: she faces +Z, so the back is -Z.
  const chestW = new THREE.Vector3().setFromMatrixPosition(B.chest.matrixWorld);
  let backZ = Infinity;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i);
    // Torso only: hair hanging down her back must not push the pack off.
    const j = si.getX(i);
    if ((j === BONE_INDEX.chest || j === BONE_INDEX.spine) && sw.getX(i) > 0.5
      && Math.abs(y - (chestW.y + 0.02)) < 0.08 && Math.abs(sp.getX(i)) < 0.1) backZ = Math.min(backZ, sp.getZ(i));
  }
  if (!Number.isFinite(backZ)) backZ = chestW.z - 0.1;
  const packWorld = new THREE.Vector3(0, chestW.y + 0.03, backZ - packD / 2 + 0.01);
  pack.position.copy(packWorld.clone().applyMatrix4(chestInv));
  pack.castShadow = true;
  pack.add(hull(packGeo, 1.045));
  B.chest.add(pack);
  const stripeGeo = new RoundedBoxGeometry(packW * 0.72, 0.06, 0.02, 2, 0.008);
  const stripe = new THREE.Mesh(stripeGeo, accentMat);
  stripe.position.set(0, packH * 0.12, -packD / 2 - 0.004);
  pack.add(stripe);
  const ventGeo = new RoundedBoxGeometry(packW * 0.5, 0.07, 0.02, 2, 0.008);
  const vent = new THREE.Mesh(ventGeo, darkMat);
  vent.position.set(0, -packH * 0.22, -packD / 2 - 0.004);
  pack.add(vent);
  const antGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6);
  const ant = new THREE.Mesh(antGeo, darkMat);
  ant.position.set(packW * 0.34, packH / 2 + 0.08, 0.0);
  pack.add(ant);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1, 0.55).multiplyScalar(4) });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), lampMat);
  lamp.position.set(packW * 0.34, packH / 2 + 0.165, 0);
  pack.add(lamp);
  /** Where a stowed sample goes: the pack's top flap, in world space. */
  const packSlot = new THREE.Object3D();
  packSlot.position.set(-packW * 0.1, packH / 2 + 0.02, 0);
  pack.add(packSlot);

  // --- animation -------------------------------------------------------------
  const mixer = new THREE.AnimationMixer(rig.group);
  // The rest pose of every bone, put back before each mixer update: bones no
  // playing clip keys (thighs, shins in the idle) kept the procedural
  // overlays' last pose and each frame's slerp stacked on it - a crouch of
  // 0.12 for half a second left her squatting on the hull for good.
  const restPose = Object.values(B).filter((b) => b?.isBone).map((b) => [b, b.position.clone(), b.quaternion.clone()]);
  const act = {};
  for (const clip of rig.clips) {
    const a = mixer.clipAction(clip);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
    act[clip.name] = a;
  }
  act.walk.timeScale = 0;
  act.run.timeScale = 0;
  // Stand in the idle from the start: a frame drawn before her first
  // animate() showed the bind pose, a T-pose (play-test, Moon walk start).
  act.idle?.setEffectiveWeight(1);
  mixer.update(0);
  // Every clip she has gets a weight, so any one-shot (wave, cheer, the fun
  // moves) can play; idle/walk/run are the locomotion three.
  const w = { idle: 1, walk: 0, run: 0, wave: 0, cheer: 0 };
  for (const n of Object.keys(act)) if (!(n in w)) w[n] = 0;
  const wt = { ...w };
  let oneShot = null;
  let oneShotT = 0;
  let oneShotLen = 0;
  let oneShotSoft = false; // a fun move: walking ends it

  // Procedural overlay weights (0..1), smoothed toward targets.
  const ov = { air: 0, crouch: 0, climb: 0, drill: 0, lookUp: 0, reach: 0, land: 0 };
  const ovT = { ...ov };

  // --- movement state -------------------------------------------------------------
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector2();
  let vy = 0;
  let heading = 0;
  let onGround = true;
  let hopPhase = 0;
  let hopCount = 0;
  let gaitMix = 0;              // 0 walk .. 1 run
  let jumpPrep = -1;            // seconds left of the crouch before take-off
  let jumpTop = 0;              // highest point of this jump above the take-off
  let jumpBase = 0;
  let airTime = 0;
  let landT = 9;
  let climbPhase = 0;
  let drillShake = 0;
  let time = 0;
  const events = [];            // drained by the scene each frame

  function setHeadingNow(h) { heading = h; root.rotation.y = h; }

  /** Free (player-driven) movement. */
  function move(dt, { dir, run, jump, terrain, collide }) {
    const g = gravity;
    const want = dir.lengthSq() > 0.0001;
    const speedT = want ? (run ? (earth ? EARTH.run : RUN_SPEED) : (earth ? EARTH.walk : WALK_SPEED)) * Math.min(1, dir.length()) : 0;
    const tx = want ? (dir.x / dir.length()) * speedT : 0;
    const tz = want ? (dir.y / dir.length()) * speedT : 0;
    if (earth) {
      // Firm footing: ease to the wanted speed, stop when she lets go.
      const k = 1 - Math.exp(-(onGround ? EARTH.grip : EARTH.grip * 0.3) * dt);
      vel.x += (tx - vel.x) * k;
      vel.y += (tz - vel.y) * k;
    } else {
      // Low traction: slow to start and slow to stop, more so in the air.
      const acc = onGround ? (want ? 4.2 : 3.4) : 0.8;
      const dvx = tx - vel.x;
      const dvz = tz - vel.y;
      const dl = Math.hypot(dvx, dvz);
      const step = Math.min(dl, acc * dt);
      if (dl > 1e-6) { vel.x += (dvx / dl) * step; vel.y += (dvz / dl) * step; }
    }

    if (want) {
      const target = Math.atan2(dir.x, dir.y);
      let d = target - heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * (onGround ? (earth ? EARTH.turn : 7) : 2.5));
    }

    pos.x += vel.x * dt;
    pos.z += vel.y * dt;
    collide(pos, vel);
    const ground = terrain.heightAt(pos.x, pos.z);
    const speed = Math.hypot(vel.x, vel.y);

    // Jump: a short crouch, then the real ballistic arc.
    if (jump && onGround && jumpPrep < 0) { jumpPrep = 0.2; ovT.crouch = 0.75; }
    if (jumpPrep >= 0) {
      jumpPrep -= dt;
      if (jumpPrep < 0) {
        onGround = false;
        vy = JUMP_V;
        jumpBase = pos.y;
        jumpTop = 0;
        airTime = 0;
        ovT.crouch = 0;
        events.push({ type: 'takeoff', x: pos.x, y: ground, z: pos.z });
      }
    }

    if (!onGround) {
      airTime += dt;
      vy -= g * dt;
      pos.y += vy * dt;
      jumpTop = Math.max(jumpTop, pos.y - jumpBase);
      if (pos.y <= ground && vy < 0) {
        pos.y = ground;
        onGround = true;
        landT = 0;
        events.push({ type: 'land', x: pos.x, y: ground, z: pos.z, height: jumpTop, airTime, heading, speed });
        vy = 0;
      }
      ovT.air = 1;
    } else {
      ovT.air = 0;
      // The lope: each step is a little hop, T = sqrt(8 h / g).
      gaitMix += ((run && speed > (earth ? EARTH.walk + 0.4 : 1.8) ? 1 : 0) - gaitMix) * Math.min(1, dt * 3);
      const hop = earth ? 0 : lerp(WALK_HOP, RUN_HOP, gaitMix);
      const T = Math.sqrt((8 * hop) / g);
      if (speed > 0.12) {
        const prev = hopPhase;
        if (earth) {
          // The villages' rule: the clip at its own rate times speed / reference
          // (one hopPhase = one step = half a clip cycle).
          const ts = clamp(speed / lerp(EARTH.walkRef, EARTH.runRef, gaitMix), 0.6, 1.5);
          hopPhase += 2 * dt * ts / lerp(act.walk.getClip().duration, act.run.getClip().duration, gaitMix);
        } else hopPhase += dt / T * clamp(speed / lerp(WALK_SPEED, RUN_SPEED, gaitMix), 0.5, 1.3);
        if (Math.floor(hopPhase) !== Math.floor(prev)) {
          hopCount++;
          const side = hopCount % 2 ? 1 : -1;
          const fx = Math.sin(heading), fz = Math.cos(heading);
          const lx = side * 0.085 * Math.cos(heading);
          const lz = -side * 0.085 * Math.sin(heading);
          const px = pos.x + fx * 0.12 + lx;
          const pz = pos.z + fz * 0.12 + lz;
          events.push({ type: 'step', x: px, y: terrain.heightAt(px, pz), z: pz, heading, side, speed, big: gaitMix > 0.5 });
        }
        const u = hopPhase % 1;
        pos.y = ground + hop * 4 * u * (1 - u) * clamp(speed / 1.0, 0, 1);
      } else {
        hopPhase = Math.round(hopPhase);
        pos.y = ground;
      }
    }
    return speed;
  }

  function animate(dt, speed) {
    time += dt;
    // Locomotion weights.
    if (!oneShot) {
      const moving = speed > 0.12 && onGround;
      wt.idle = moving || !onGround ? 0 : 1;
      wt.walk = moving ? 1 - gaitMix : (!onGround ? 0.35 : 0);
      wt.run = moving ? gaitMix : (!onGround ? 0.65 : 0);
      for (const n of Object.keys(wt)) if (n !== 'idle' && n !== 'walk' && n !== 'run') wt[n] = 0;
    }
    const k = Math.min(1, dt * 8);
    for (const n of Object.keys(w)) {
      w[n] += (wt[n] - w[n]) * k;
      act[n]?.setEffectiveWeight(w[n]);
    }
    // Drive the stride clips from the hop phase: one hop = one step (half a cycle).
    const cyc = (hopPhase * 0.5) % 1;
    act.walk.time = cyc * act.walk.getClip().duration;
    act.run.time = cyc * act.run.getClip().duration;
    if (!onGround) {
      // Hold a mid-stride frame in the air, with the overlay on top.
      act.run.time = 0.3 * act.run.getClip().duration;
      act.walk.time = 0.3 * act.walk.getClip().duration;
    }
    if (oneShot) {
      oneShotT += dt;
      if ((oneShotLen > 0 && oneShotT >= oneShotLen) || (oneShotSoft && (speed > 0.15 || !onGround))) {
        oneShot = null;
      }
    }
    for (const [b, p, q] of restPose) { b.position.copy(p); b.quaternion.copy(q); }
    mixer.update(dt);

    // Overlays.
    landT += dt;
    ovT.land = landT < 0.35 ? Math.sin((landT / 0.35) * Math.PI) : 0;
    for (const n of Object.keys(ov)) {
      const rate = n === 'land' ? 30 : n === 'crouch' ? 12 : 6;
      ov[n] += (ovT[n] - ov[n]) * Math.min(1, dt * rate);
    }
    applyOverlays(dt);
    lamp.material.color.setRGB(0.35, 1, 0.55).multiplyScalar(Math.sin(time * 3) > 0.3 ? 4.5 : 0.6);
  }

  function pose(bone, x, y, z, weight) {
    if (weight <= 0.001) return;
    _e.set(x, y, z);
    _q.setFromEuler(_e);
    bone.quaternion.slerp(_q, clamp(weight, 0, 1));
  }

  function applyOverlays() {
    // Mid-air: knees drawn up a little, arms out for balance; legs reach
    // down again on the way to the ground.
    const a = ov.air;
    if (a > 0.001) {
      const falling = clamp(-vy / JUMP_V, 0, 1);
      const tuck = 1 - falling * 0.7;
      pose(B.thighL, -0.75 * tuck, 0, 0.08, a);
      pose(B.thighR, -0.35 * tuck, 0, -0.08, a);
      pose(B.shinL, 1.2 * tuck, 0, 0, a);
      pose(B.shinR, 0.8 * tuck + 0.2, 0, 0, a);
      pose(B.footL, -0.2, 0, 0, a);
      pose(B.footR, -0.2, 0, 0, a);
      pose(B.armL, -0.35, 0, 1.25 + 0.15 * Math.sin(time * 2.2), a);
      pose(B.armR, -0.35, 0, -1.25 - 0.15 * Math.sin(time * 2.2 + 1), a);
      pose(B.forearmL, -0.3, 0, 0.25, a);
      pose(B.forearmR, -0.3, 0, -0.25, a);
      pose(B.head, -0.18, 0, 0, a * 0.8);
      pose(B.spine, -0.06, 0, 0, a);
    }
    // Crouch (jump wind-up, landing, picking something up).
    const c = Math.max(ov.crouch, ov.land * 0.55);
    if (c > 0.001) {
      pose(B.thighL, -1.15, 0, 0.1, c);
      pose(B.thighR, -1.15, 0, -0.1, c);
      pose(B.shinL, 1.95, 0, 0, c);
      pose(B.shinR, 1.95, 0, 0, c);
      pose(B.footL, -0.75, 0, 0, c);
      pose(B.footR, -0.75, 0, 0, c);
      pose(B.spine, 0.28, 0, 0, c);
      pose(B.chest, 0.12, 0, 0, c);
      pose(B.head, -0.25, 0, 0, c);
      B.hips.position.y -= 0.36 * c * (GIRL_HEIGHT / 1.3);
      B.hips.position.z -= 0.08 * c;
    }
    const r = ov.reach;
    if (r > 0.001) {
      pose(B.spine, 0.5, 0, 0, r);
      pose(B.chest, 0.25, 0, 0, r);
      pose(B.armR, -0.75, 0.2, -0.12, r);
      pose(B.forearmR, -0.2, 0, 0, r);
      pose(B.armL, -0.3, 0, 0.35, r * 0.7);
      pose(B.head, 0.35, 0, 0, r * 0.7);
    }
    // Climbing a ladder: hands up on the rails, legs stepping, out of phase.
    const cl = ov.climb;
    if (cl > 0.001) {
      const s = Math.sin(climbPhase * Math.PI * 2);
      pose(B.armL, -2.55 - 0.3 * s, 0, 0.18, cl);
      pose(B.armR, -2.55 + 0.3 * s, 0, -0.18, cl);
      pose(B.forearmL, -0.6 - 0.3 * Math.max(0, s), 0, 0, cl);
      pose(B.forearmR, -0.6 - 0.3 * Math.max(0, -s), 0, 0, cl);
      pose(B.thighL, -0.55 - 0.45 * Math.max(0, s), 0, 0.05, cl);
      pose(B.thighR, -0.55 - 0.45 * Math.max(0, -s), 0, -0.05, cl);
      pose(B.shinL, 0.8 + 0.5 * Math.max(0, s), 0, 0, cl);
      pose(B.shinR, 0.8 + 0.5 * Math.max(0, -s), 0, 0, cl);
      pose(B.head, -0.15, 0, 0, cl);
      pose(B.hips, 0.05, 0, 0, cl);
    }
    // Leaning on the drill's handles.
    const d = ov.drill;
    if (d > 0.001) {
      const j = Math.sin(time * 47) * 0.02 * drillShake;
      pose(B.armL, -1.2 + j, 0, 0.32, d);
      pose(B.armR, -1.2 - j, 0, -0.32, d);
      pose(B.forearmL, -0.55, 0, -0.3, d);
      pose(B.forearmR, -0.55, 0, 0.3, d);
      pose(B.thighL, -0.35, 0, 0.12, d);
      pose(B.thighR, -0.15, 0, -0.12, d);
      pose(B.shinL, 0.55, 0, 0, d);
      pose(B.shinR, 0.3, 0, 0, d);
      pose(B.spine, 0.18, 0, 0, d);
      pose(B.head, 0.12 + j, 0, 0, d);
      B.hips.position.y -= 0.05 * d;
    }
    // Looking up at the sky.
    const lu = ov.lookUp;
    if (lu > 0.001) {
      pose(B.neck, -0.3, 0, 0, lu);
      pose(B.head, -0.45, 0.1, 0, lu);
      pose(B.chest, -0.1, 0, 0, lu);
    }
  }

  function playOneShot(name, { loops = 1, hold = null, soft = false } = {}) {
    const a = act[name];
    if (!a) return false;
    oneShotSoft = soft;
    a.reset();
    a.play();
    a.timeScale = 1;
    oneShot = name;
    oneShotT = 0;
    oneShotLen = hold ?? a.getClip().duration * loops;
    for (const n of Object.keys(wt)) wt[n] = n === name ? 1 : 0;
    return true;
  }

  function dispose() {
    root.removeFromParent();
    mixer.stopAllAction();
    rig.geometry.dispose();
    bodyMat.dispose();
    rig.hull?.material?.dispose();
    helmet.geometry.dispose();
    helmetMat.dispose();
    for (const m of [kitMat, accentMat, darkMat, lampMat]) m.dispose();
    for (const g of [ringGeo, packGeo, stripeGeo, ventGeo, antGeo]) g.dispose();
  }

  return {
    root,
    rig,
    helmet,
    helmetMat,
    pack,
    packSlot,
    hand: B.handR,
    pos,
    vel,
    events,
    get heading() { return heading; },
    set heading(h) { setHeadingNow(h); },
    get onGround() { return onGround; },
    get airborne() { return !onGround || jumpPrep >= 0; },
    get jumpHeight() { return jumpTop; },
    overlay: ovT,
    setClimbPhase(p) { climbPhase = p; },
    setDrillShake(s) { drillShake = s; },
    move,
    animate,
    playOneShot,
    get oneShot() { return oneShot; },
    stopOneShot() { oneShot = null; },
    /** Put her somewhere, standing, without any motion. */
    place(x, y, z, h) {
      pos.set(x, y, z);
      vel.set(0, 0);
      vy = 0;
      onGround = true;
      jumpPrep = -1;
      if (h !== undefined) setHeadingNow(h);
    },
    /** Force a jump (lab / cutscenes). */
    jumpNow() { if (onGround) jumpPrep = 0.0001; },
    /** Copy pos/heading onto the scene graph. */
    sync() {
      root.position.copy(pos);
      root.rotation.y = heading;
    },
    dispose,
  };
}
