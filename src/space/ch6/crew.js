// Chapter 6's crew as 3-D figures (who they are in words: crewInfo.js).
//
// The two kids are built with the same rig as the hero (character/girl.js),
// each with their own look, idling and now and then waving. The two robots
// are simple toon shapes: Bolt, the builder bot (boxy, orange, on tracks,
// with a lifting arm), and Echo, the signal bot (a floating purple sphere
// with a dish and a blinking light). All at true size (kids 1.3 m).
//
//   const crew = buildCrew();          // { biologist, doctor, builder, signal }
//   scene.add(crew.biologist.root);    // place each root yourself
//   crew.update(dt);                   // every frame
//   crew.wave('doctor');               // a one-off wave
//   crew.dispose();
import * as THREE from 'three';
import { buildGirlRig, defaultChoices } from '../../character/girl.js';
import { makeGirlToon, GIRL_HEIGHT } from '../surface/walker.js';
import { toonRamp } from '../../game/toonPipeline.js';

/** Their looks: different from each other and from the default hero. */
export const CREW_LOOKS = Object.freeze({
  biologist: { hero: 'girl', skin: 'brown', hairStyle: 'braids', hairColor: 'black', hairAccessory: 'headband', accentColor: 'yellow', outfit: 'labcoat', outfitColor: 'green', trousers: 'khaki', shoes: 'boots', glasses: 'none', backpack: 'no', eyeColor: 'dark' },
  doctor: { hero: 'boy', skin: 'fair', hairStyle: 'short', hairColor: 'ginger', hairAccessory: 'none', accentColor: 'sky', outfit: 'jumpsuit', outfitColor: 'teal', trousers: 'navy', shoes: 'sneakers', glasses: 'round', glassesColor: 'dark', backpack: 'no', freckles: 'some', eyeColor: 'blue' },
});

const toon = (color, emissive = 0x000000, ei = 0) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
  if (ei) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
  return m;
};

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
  // Start each kid at a different point of the idle so they don't breathe in step.
  idle.time = (id === 'doctor' ? 0.7 : 0) * idle.getClip().duration;
  return {
    root, rig,
    update(dt) { mixer.update(dt); },
    wave() { if (!wave) return; wave.reset(); wave.setEffectiveWeight(1); wave.play(); },
    dispose() { mixer.stopAllAction(); rig.geometry?.dispose?.(); mat.dispose(); },
  };
}

function buildBuilderBot() {
  const root = new THREE.Group(); root.name = 'crew-builder';
  const orange = toon(0xffa64d); const dark = toon(0x2b2f38); const glass = toon(0x9fe8ff, 0x7ff3ff, 0.8);
  const parts = [];
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); parts.push(m); return m; };
  // Tracks, body, head with a visor, a lifting arm.
  add(new THREE.BoxGeometry(0.18, 0.22, 0.8), dark, -0.32, 0.11, 0);
  add(new THREE.BoxGeometry(0.18, 0.22, 0.8), dark, 0.32, 0.11, 0);
  add(new THREE.BoxGeometry(0.62, 0.6, 0.6), orange, 0, 0.55, 0);
  const head = add(new THREE.BoxGeometry(0.42, 0.3, 0.38), orange, 0, 1.03, 0);
  add(new THREE.BoxGeometry(0.34, 0.1, 0.02), glass, 0, 1.05, 0.2);
  const arm = new THREE.Group(); arm.position.set(0.38, 0.75, 0); root.add(arm);
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), dark); a1.position.y = -0.2; arm.add(a1); parts.push(a1);
  const claw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), orange); claw.position.y = -0.48; arm.add(claw); parts.push(claw);
  let t = 0; let waveT = -1;
  return {
    root,
    update(dt) {
      t += dt;
      head.rotation.y = Math.sin(t * 0.6) * 0.25;
      if (waveT >= 0) { waveT += dt; arm.rotation.z = Math.sin(waveT * 10) * 0.5 + 1.2; if (waveT > 1.6) waveT = -1; } else arm.rotation.z = Math.sin(t * 0.8) * 0.05;
    },
    wave() { waveT = 0; },
    dispose() { for (const m of parts) m.geometry.dispose(); orange.dispose(); dark.dispose(); glass.dispose(); },
  };
}

function buildSignalBot() {
  const root = new THREE.Group(); root.name = 'crew-signal';
  const purple = toon(0xb58cff); const white = toon(0xeef2ff); const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7fbf).multiplyScalar(2) });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), purple); body.position.y = 1.0; root.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), white); eye.position.set(0, 1.04, 0.27); root.add(eye);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), white); mast.position.y = 1.42; root.add(mast);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.08, 20, 1, true), white); dish.position.y = 1.6; dish.rotation.x = Math.PI; root.add(dish);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), lamp); light.position.y = 1.66; root.add(light);
  const parts = [body, eye, mast, dish, light];
  let t = 0; let spin = 0;
  return {
    root,
    update(dt) {
      t += dt;
      const bob = Math.sin(t * 1.8) * 0.05;
      // Bob the whole bot (each part keeps its own height plus the bob).
      root.children.forEach((c) => { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + bob; });
      dish.rotation.y += dt * (0.8 + spin);
      spin = Math.max(0, spin - dt * 2);
      lamp.color.setScalar(0).add(new THREE.Color(0xff7fbf).multiplyScalar(Math.sin(t * 4) > 0 ? 2.2 : 0.4));
    },
    wave() { spin = 6; },
    dispose() { for (const m of parts) m.geometry.dispose(); purple.dispose(); white.dispose(); lamp.dispose(); },
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
