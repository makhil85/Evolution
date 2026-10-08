// Chapter 6's crew as 3-D figures (who they are in words: crewInfo.js).
//
// The two kids are built with the same rig as the hero (character/girl.js),
// each with their own look, idling, looking round now and then, and waving
// with a crossfade. Each wears a small gold Starfleet-style delta on the chest.
// The two robots are toon figures with soft glows:
//   Bolt, the builder bot: an orange pill body on a hover base, a visor face
//     with blinking glow eyes, two jointed arms with claws.
//   Echo, the signal bot: a floating lilac sphere with a dark screen face, a
//     turning halo ring, a dish that turns and a pulsing antenna light.
// All at true size (kids 1.3 m).
//
//   const crew = buildCrew();          // { biologist, doctor, builder, signal }
//   scene.add(crew.biologist.root);    // place each root yourself
//   crew.update(dt);                   // every frame
//   crew.wave('doctor');               // a one-off wave
//   crew.dispose();
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildGirlRig, defaultChoices } from '../../character/girl.js';
import { makeGirlToon, GIRL_HEIGHT } from '../surface/walker.js';
import { toonRamp } from '../../game/toonPipeline.js';

/** Their looks: different from each other and from the default hero. */
export const CREW_LOOKS = Object.freeze({
  biologist: { hero: 'girl', skin: 'brown', hairStyle: 'braids', hairColor: 'black', hairAccessory: 'headband', accentColor: 'yellow', outfit: 'labcoat', outfitColor: 'green', trousers: 'khaki', shoes: 'boots', glasses: 'none', backpack: 'no', eyeColor: 'dark' },
  doctor: { hero: 'boy', skin: 'fair', hairStyle: 'short', hairColor: 'ginger', hairAccessory: 'none', accentColor: 'sky', outfit: 'jumpsuit', outfitColor: 'teal', trousers: 'navy', shoes: 'sneakers', glasses: 'round', glassesColor: 'dark', backpack: 'no', freckles: 'some', eyeColor: 'blue' },
});

const WAVE_T = 1.6; // seconds for a robot's wave

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** A wave's strength over its WAVE_T seconds: eased in over 40%, held briefly, eased out over 40%. */
const waveEnv = (u) => smooth(u / 0.4) * (1 - smooth((u - 0.6) / 0.4));
/** How much of the gap to close this frame (frame-rate free). */
const ease = (k, dt) => 1 - Math.exp(-k * dt);
/** A seeded random 0..1, so each figure's idle is the same every run. */
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/** Eyes: open 1, shut to about 0.08 and open again every few seconds. */
function blinker(rnd) {
  let wait = 2 + rnd() * 3; let p = -1;
  return (dt) => {
    if (p < 0) { wait -= dt; if (wait <= 0) p = 0; return 1; }
    p += dt / 0.18;
    if (p >= 1) { p = -1; wait = 2.5 + rnd() * 3; return 1; }
    return 1 - 0.92 * Math.sin(Math.PI * p);
  };
}

/** The geometry and materials one robot makes, all freed together by dispose(). */
function kit() {
  const made = [];
  const keep = (o) => { made.push(o); return o; };
  const toonM = (color) => keep(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp }));
  /** A flat colour pushed past 1 so the bloom picks it up. */
  const glowM = (color, k) => keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
  const outlineM = keep(new THREE.MeshBasicMaterial({ color: 0x1b222c, side: THREE.BackSide }));
  const put = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  /** A solid part; with `outline`, an inverted-hull shell 3.5% bigger drawn behind it. */
  const solid = (parent, geo, mat, x, y, z, outline = false) => {
    const m = put(parent, geo, mat, x, y, z);
    if (outline) { const s = new THREE.Mesh(geo, outlineM); s.position.copy(m.position); s.scale.setScalar(1.035); parent.add(s); }
    return m;
  };
  return { keep, toonM, glowM, put, solid, dispose() { for (const o of made) o.dispose(); made.length = 0; } };
}

/** A rounded upright pill (a lathe of a superellipse), centred on its own origin. */
function pill(k, rw, yBot, yTop, power = 0.45) {
  const pts = []; const n = 28; const yc = (yBot + yTop) / 2; const hy = (yTop - yBot) / 2;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * (1 - i / n); // bottom to top, so the faces point out
    pts.push(new THREE.Vector2(rw * Math.pow(Math.sin(t), power), hy * Math.cos(t)));
  }
  return k.keep(new THREE.LatheGeometry(pts, 40));
}

/** A lathe from [radius, height] pairs, in the order that keeps the faces out. */
function lathe(k, pairs) {
  return k.keep(new THREE.LatheGeometry(pairs.map(([r, y]) => new THREE.Vector2(r, y)), 40));
}

/** A flat rounded rectangle in the XY plane (eyes). */
function roundRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2; const y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 6);
}

/** Bend a flat disc (centred, facing +Z) onto a sphere of radius R, so it sits on the face. */
function conform(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i);
    p.setZ(i, Math.sqrt(Math.max(0, R * R - x * x - y * y)));
  }
  p.needsUpdate = true;
  return geo;
}

function buildKid(id) {
  const choices = { ...defaultChoices(CREW_LOOKS[id].hero), ...CREW_LOOKS[id] };
  const mat = makeGirlToon({ vertexColors: true, rim: 0.3 });
  const rig = buildGirlRig(choices, { material: mat, height: GIRL_HEIGHT, outline: true, outlineThickness: 0.011 });
  const root = new THREE.Group();
  root.name = `crew-${id}`;
  root.add(rig.group);
  const mixer = new THREE.AnimationMixer(rig.group);
  const clip = (name) => rig.clips.find((c) => c.name === name) || rig.clips[0];
  const idle = mixer.clipAction(clip('idle'));
  idle.play();
  const waveClip = clip('wave');
  const wave = waveClip ? mixer.clipAction(waveClip) : null;
  if (wave) { wave.setLoop(THREE.LoopOnce, 1); wave.clampWhenFinished = false; }
  const waveLen = wave ? wave.getClip().duration : 0;
  // Start each kid at a different point of the idle so they don't breathe in step.
  idle.time = (id === 'doctor' ? 0.7 : 0) * idle.getClip().duration;

  // Idle variety: now and then the head looks to one side and the weight shifts,
  // both added on top of the clip (after the mixer has written the bones).
  const head = rig.byName.head; const hips = rig.byName.hips; const chest = rig.byName.chest;
  const rnd = rng(id === 'doctor' ? 41 : 23);
  let nextVar = 2 + rnd() * 2; let lookT = 0; let look = 0; let shiftT = 0; let shift = 0;
  const e = new THREE.Euler(); const q = new THREE.Quaternion();
  let waveT = -1; let ending = false;

  // Star Trek-style delta on the chest, pinned to the chest bone so it breathes with her.
  const s = rig.scale;
  const deltaShape = new THREE.Shape();
  deltaShape.moveTo(0, 0.026);
  deltaShape.quadraticCurveTo(0.012, 0.012, 0.026, -0.016);
  deltaShape.quadraticCurveTo(0, -0.008, -0.026, -0.016);
  deltaShape.quadraticCurveTo(-0.012, 0.012, 0, 0.026);
  const badgeGeo = new THREE.ExtrudeGeometry(deltaShape, { depth: 0.003, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 6 });
  const badgeMat = new THREE.MeshToonMaterial({ color: 0xd9b04a, gradientMap: toonRamp });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(0.07 * s, (1.07 - 0.98) * s, 0.1 * s);
  chest.add(badge);

  return {
    root, rig,
    update(dt) {
      const d = Math.min(dt, 0.05); // a stall must not make a jump
      mixer.update(d);
      if (waveT >= 0) {
        waveT += d;
        // Back to the idle: the idle was disabled once its fade-out finished, so it is
        // re-enabled here (weight set after the fade starts, as for the wave above).
        if (!ending && waveT > waveLen - 0.4) { ending = true; wave.fadeOut(0.4); idle.reset().setEffectiveWeight(0).fadeIn(0.4).play(); idle.weight = 1; }
        if (waveT >= waveLen) { waveT = -1; wave.stop(); }
      }
      nextVar -= d;
      if (nextVar <= 0) {
        nextVar = 3.5 + rnd() * 3;
        lookT = (rnd() * 2 - 1) * 0.4;
        shiftT = (rnd() < 0.5 ? -1 : 1) * (0.02 + rnd() * 0.03);
      }
      look += (lookT - look) * ease(1.6, d);
      shift += (shiftT - shift) * ease(1.6, d);
      // Only while the idle has the bones at full weight: the mixer then rewrites them every
      // frame, so the offsets never pile up (a wave or a fade can leave a bone unwritten).
      if (idle.isRunning() && idle.getEffectiveWeight() > 0.999) {
        head.quaternion.multiply(q.setFromEuler(e.set(0, look, 0)));
        hips.quaternion.multiply(q.setFromEuler(e.set(0, 0, shift)));
      }
    },
    wave() {
      if (!wave) return;
      // The wave ramps from 0 to full over 0.35 s while the idle ramps out (the weight
      // is set after the fade starts, because setEffectiveWeight(0) also zeroes it).
      wave.reset().setEffectiveWeight(0).fadeIn(0.35).play();
      wave.weight = 1;
      idle.fadeOut(0.35);
      waveT = 0; ending = false;
    },
    dispose() {
      mixer.stopAllAction();
      rig.geometry?.dispose?.();
      rig.hull?.material?.dispose?.();
      mat.dispose();
      badge.geometry.dispose(); badgeMat.dispose();
    },
  };
}

function buildBuilderBot() {
  const k = kit();
  const { toonM, glowM, put, solid } = k;
  const root = new THREE.Group(); root.name = 'crew-builder';
  const orange = toonM(0xffa64d); const dark = toonM(0x2c3240); const cream = toonM(0xfff1e0); const glass = toonM(0x18202e);
  const cyan = glowM(0x7ff3ff, 1.4); const ring = glowM(0x7ff3ff, 1.3); const chestM = glowM(0x7ff3ff, 1.8);
  const rnd = rng(23);
  const blink = blinker(rnd);
  let t = 0; let waveT = -1; let nextLook = 2; let lookT = 0; let look = 0;

  // Hover base: a rounded dark disc with a soft glow ring just under it.
  const hover = new THREE.Group(); root.add(hover);
  put(hover, lathe(k, [[0, 0.06], [0.28, 0.06], [0.33, 0.08], [0.355, 0.12], [0.33, 0.16], [0.28, 0.18], [0, 0.18]]), dark);
  const hoverRing = put(hover, new THREE.TorusGeometry(0.34, 0.014, 8, 48), ring, 0, 0.05, 0);
  hoverRing.rotation.x = Math.PI / 2;

  // Body: a rounded pill, a dark band, a cream chest plate with a light.
  const torso = new THREE.Group(); torso.position.y = 0.55; hover.add(torso);
  solid(torso, pill(k, 0.3, 0.15, 0.95), orange, 0, 0, 0, true);
  const band = put(torso, new THREE.TorusGeometry(0.296, 0.012, 8, 40), dark, 0, -0.1, 0);
  band.rotation.x = Math.PI / 2;
  put(torso, k.keep(new RoundedBoxGeometry(0.2, 0.2, 0.05, 3, 0.05)), cream, 0, 0.05, 0.29);
  put(torso, new THREE.BoxGeometry(0.12, 0.012, 0.01), dark, 0, -0.02, 0.318);
  const chestLight = put(torso, new THREE.CylinderGeometry(0.028, 0.028, 0.01, 16), chestM, 0, 0.12, 0.318);
  chestLight.rotation.x = Math.PI / 2;

  // Neck, shoulder joints.
  put(hover, new THREE.CylinderGeometry(0.09, 0.1, 0.12, 20), dark, 0, 0.94, 0);
  put(hover, new THREE.SphereGeometry(0.065, 16, 12), dark, 0.27, 0.72, 0);
  put(hover, new THREE.SphereGeometry(0.065, 16, 12), dark, -0.27, 0.72, 0);

  // Head: a rounded box with a dark visor, ears, an antenna with a light.
  const head = new THREE.Group(); head.position.set(0, 0.99, 0); hover.add(head);
  solid(head, k.keep(new RoundedBoxGeometry(0.46, 0.34, 0.38, 5, 0.12)), orange, 0, 0.13, 0, true);
  put(head, k.keep(new RoundedBoxGeometry(0.36, 0.22, 0.03, 4, 0.08)), glass, 0, 0.13, 0.2);
  for (const sx of [-1, 1]) { const ear = put(head, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), dark, sx * 0.235, 0.13, 0); ear.rotation.z = Math.PI / 2; }
  put(head, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), dark, 0.1, 0.37, 0);
  put(head, new THREE.SphereGeometry(0.03, 12, 8), cyan, 0.1, 0.45, 0);

  // Eyes: glowing rounded shapes on the visor; happy is an arch that grows from the eye.
  const eyeGeo = k.keep(roundRect(0.085, 0.12, 0.04));
  const arcGeo = k.keep(new THREE.TorusGeometry(0.04, 0.013, 8, 20, Math.PI));
  const eyes = [-0.09, 0.09].map((x0) => {
    const g = new THREE.Group(); g.position.set(x0, 0.13, 0.222); head.add(g);
    const open = new THREE.Mesh(eyeGeo, cyan); g.add(open);
    const happy = new THREE.Mesh(arcGeo, cyan); happy.position.y = -0.02; happy.scale.y = 0; g.add(happy);
    return { g, x0, open, happy };
  });

  // Arms: a shoulder, an elbow, a forearm, a two-finger claw.
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.27, 0.72, 0); hover.add(sh);
    put(sh, new THREE.CapsuleGeometry(0.05, 0.18, 4, 12), orange, 0, -0.14, 0);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    put(el, new THREE.SphereGeometry(0.045, 12, 8), dark, 0, 0, 0);
    put(el, new THREE.CapsuleGeometry(0.045, 0.14, 4, 12), orange, 0, -0.115, 0);
    const hand = new THREE.Group(); hand.position.y = -0.24; el.add(hand);
    put(hand, k.keep(new RoundedBoxGeometry(0.1, 0.07, 0.08, 3, 0.03)), orange, 0, -0.03, 0);
    const fingers = [-1, 1].map((f) => {
      const p = new THREE.Group(); p.position.set(f * 0.03, -0.055, 0); hand.add(p);
      put(p, new THREE.CapsuleGeometry(0.018, 0.05, 3, 8), dark, 0, -0.04, 0);
      return { p, f };
    });
    return { sh, el, fingers };
  };
  const armR = arm(1); const armL = arm(-1);

  // The lathe parts above are centred on their origin, so a breath can scale them about their middle.
  return {
    root,
    update(dt) {
      const d = Math.min(dt, 0.05); // a stall must not make a jump
      t += d;
      if (waveT >= 0) waveT += d;
      if (waveT > WAVE_T) waveT = -1;
      const env = waveT >= 0 ? waveEnv(waveT / WAVE_T) : 0;
      const sway = Math.sin(t * 0.9);
      // Hover bob and a slight roll; breathing in the body.
      hover.position.y = Math.sin(t * 1.7) * 0.035;
      hover.rotation.z = Math.sin(t * 0.7) * 0.015;
      const br = Math.sin(t * 2.1);
      torso.scale.set(1 + 0.008 * br, 1 + 0.012 * br, 1 + 0.008 * br);
      chestM.color.setRGB(0.25, 0.9, 1).multiplyScalar(1.4 + 0.5 * Math.sin(t * 1.6));
      // The head looks round slowly now and then; during a wave it tilts a little.
      nextLook -= d;
      if (nextLook <= 0) { lookT = (rnd() * 2 - 1) * 0.55; nextLook = 3 + rnd() * 3; }
      look += (lookT - look) * ease(1.2, d);
      head.rotation.set(Math.sin(t * 0.5) * 0.03 + env * 0.05, look, env * 0.1);
      const b = blink(d);
      for (const eye of eyes) {
        eye.g.position.x = eye.x0 + look * 0.025;
        eye.open.scale.y = b * (1 - env);
        eye.happy.scale.y = env;
      }
      // Arms sway; the right arm (+x) waves: up and out, the forearm swinging side to side.
      const shIdle = 0.14 + 0.04 * sway; const elIdle = 0.2 + 0.05 * Math.sin(t * 0.9 + 0.5);
      armR.sh.rotation.z = shIdle + (2.25 - shIdle) * env;
      armR.el.rotation.z = elIdle + (0.49 + 0.28 * Math.sin(waveT * 10) - elIdle) * env;
      armL.sh.rotation.z = -(0.14 + 0.04 * Math.sin(t * 0.9 + 1));
      armL.el.rotation.z = -(0.2 + 0.05 * Math.sin(t * 0.9 + 1.4));
      // The claws open and close slowly, and grip a little more on a wave.
      const grip = 0.12 + 0.08 * Math.sin(t * 1.3) + 0.12 * env;
      for (const a of [armR, armL]) for (const f of a.fingers) f.p.rotation.z = -f.f * grip;
    },
    wave() { waveT = 0; },
    dispose() { k.dispose(); },
  };
}

function buildSignalBot() {
  const k = kit();
  const { toonM, glowM, put, solid } = k;
  const root = new THREE.Group(); root.name = 'crew-signal';
  const R = 0.3; // body radius
  const white = toonM(0xeef2ff);
  const halo = glowM(0xe6d7ff, 1.35); const eyeGlow = glowM(0xff8fd8, 1.7); const shine = glowM(0xffffff, 1.4);
  const pupil = k.keep(new THREE.MeshBasicMaterial({ color: 0x1d1233 }));
  const lampBase = new THREE.Color(0xff7fbf); const lamp = k.keep(new THREE.MeshBasicMaterial({ color: lampBase.clone() }));
  const rnd = rng(37);
  const blink = blinker(rnd);
  let t = 0; let waveT = -1;
  let haloAngle = 0; let haloRate = 0.5; let dishAngle = 0; let dishRate = 0.7;
  let nextLook = 1.5; let lookYaw = 0; let lookPitch = 0; let yaw = 0; let pitch = 0;

  // Everything hovers together: a bob and a slight tilt.
  const float = new THREE.Group(); float.position.y = 1.02; root.add(float);
  // The body: a lilac sphere whose front is painted dark, a round screen for the face
  // (painted, not a second shell, so nothing flickers where the two meet).
  const capA = 0.7;
  const bodyGeo = new THREE.SphereGeometry(R, 96, 56);
  const bodyPos = bodyGeo.attributes.position;
  const cols = new Float32Array(bodyPos.count * 3);
  const cLilac = new THREE.Color(0xb58cff); const cScreen = new THREE.Color(0x221e38); const tint = new THREE.Color();
  for (let i = 0; i < bodyPos.count; i++) {
    const a = Math.acos(Math.min(1, Math.max(-1, bodyPos.getZ(i) / R))); // angle from the front
    tint.copy(cScreen).lerp(cLilac, smooth((a - capA + 0.02) / 0.12));
    cols.set([tint.r, tint.g, tint.b], i * 3);
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const bodyM = k.keep(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp }));
  solid(float, bodyGeo, bodyM, 0, 0, 0, true);
  // The eye sits on a pivot at the body's centre, so turning the pivot moves it over the screen.
  const look = new THREE.Group(); float.add(look);
  const iris = put(look, conform(new THREE.CircleGeometry(0.1, 32), R + 0.024), eyeGlow);
  put(look, conform(new THREE.CircleGeometry(0.045, 24), R + 0.026), pupil);
  const shineGeo = conform(new THREE.CircleGeometry(0.018, 12), R + 0.028); shineGeo.translate(0.03, 0.035, 0);
  put(look, shineGeo, shine);
  const smile = put(look, new THREE.TorusGeometry(0.06, 0.016, 8, 20, Math.PI), eyeGlow, 0, -0.02, R + 0.022);
  smile.scale.y = 0;

  // The halo: a tilted ring round the body that turns on its own pivot.
  const haloPivot = new THREE.Group(); float.add(haloPivot);
  const ringMesh = put(haloPivot, new THREE.TorusGeometry(0.44, 0.024, 12, 72), halo);
  ringMesh.rotation.x = -1.07;

  // The dish on a stalk, tilted up and forward, turning smoothly.
  put(float, new THREE.CylinderGeometry(0.014, 0.018, 0.2, 10), white, 0, 0.37, 0);
  const dishPivot = new THREE.Group(); dishPivot.position.y = 0.46; float.add(dishPivot);
  const dishTilt = new THREE.Group(); dishTilt.rotation.x = 0.55; dishPivot.add(dishTilt);
  const bowl = []; for (let i = 0; i <= 8; i++) { const s = 1 - i / 8; bowl.push([0.17 * s, 0.06 * s * s]); } // rim to centre
  put(dishTilt, lathe(k, bowl), white).material.side = THREE.DoubleSide;
  put(dishTilt, new THREE.SphereGeometry(0.02, 10, 8), white, 0, 0.1, 0);

  // An antenna at the back, with a light that breathes.
  put(float, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), white, 0, 0.3, -0.23);
  put(float, new THREE.SphereGeometry(0.032, 12, 8), lamp, 0, 0.43, -0.23);

  return {
    root,
    update(dt) {
      const d = Math.min(dt, 0.05); // a stall must not make a jump
      t += d;
      if (waveT >= 0) waveT += d;
      if (waveT > WAVE_T) waveT = -1;
      const env = waveT >= 0 ? waveEnv(waveT / WAVE_T) : 0;
      // Hover: a bob and a slight tilt.
      float.position.y = 1.02 + Math.sin(t * 1.5) * 0.045;
      float.rotation.set(Math.sin(t * 0.6 + 1) * 0.03, 0, Math.sin(t * 0.8) * 0.035);
      // The halo and the dish turn; a wave speeds the halo up.
      haloRate += (0.5 + 7.5 * env - haloRate) * ease(3, d);
      haloAngle += haloRate * d; haloPivot.rotation.y = haloAngle;
      dishRate += (0.7 + 6 * env - dishRate) * ease(3, d);
      dishAngle += dishRate * d; dishPivot.rotation.y = dishAngle;
      // The eye looks around slowly.
      nextLook -= d;
      if (nextLook <= 0) { lookYaw = (rnd() * 2 - 1) * 0.25; lookPitch = (rnd() * 2 - 1) * 0.15; nextLook = 2.5 + rnd() * 2.5; }
      yaw += (lookYaw - yaw) * ease(1.5, d); pitch += (lookPitch - pitch) * ease(1.5, d);
      look.rotation.set(pitch, yaw, 0, 'YXZ');
      // The eye blinks, and smiles (an arch) on a wave.
      const b = blink(d);
      iris.scale.y = b * (1 - env);
      smile.scale.y = env;
      // The antenna light breathes: a slow swell, not a blink.
      lamp.color.copy(lampBase).multiplyScalar(1.1 + 0.9 * (0.5 + 0.5 * Math.sin(t * 2.6)));
    },
    wave() { waveT = 0; },
    dispose() { k.dispose(); },
  };
}

/** All four, standing at the origin facing +Z. */
export function buildCrew() {
  const crew = {
    biologist: buildKid('biologist'),
    doctor: buildKid('doctor'),
    builder: buildBuilderBot(),
    signal: buildSignalBot(),
  };
  return {
    ...crew,
    ids: Object.keys(crew),
    update(dt) { for (const c of Object.values(crew)) c.update(dt); },
    wave(id) { crew[id]?.wave(); },
    dispose() { for (const c of Object.values(crew)) c.dispose(); },
  };
}
