// The edge of the Sun's family (Chapter 5, after Pluto): the camera pulls
// back from her ship, past the Kuiper belt and Neptune's path, out through
// the heliosphere (the bubble of the Sun's wind, which Voyager 1 left in
// 2012) to the Oort cloud, then sweeps back to her. ~20 s, skippable.
//
// Flight is paused. The bubble, the orbit lines and the Oort cloud are added
// for the scene only. The Oort cloud is drawn much closer than it really is
// (the label says so): at true scale it would be a dot-less void on screen.
import * as THREE from 'three';
import { BODIES } from '../contracts.js';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { t as lvl } from '../level.js';

const AU = BODIES.neptune.orbit / 30; // Neptune is 30 AU out
const HELIO_R = 120 * AU;
const OORT = [3.6 * HELIO_R, 5 * HELIO_R]; // squeezed in a lot (really 2,000+ AU)
const DURATION = 21;

function orbitLine(r, color, opacity) {
  const pts = [];
  for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  l.frustumCulled = false;
  return l;
}

/** A soft bubble, brighter at its edge. */
function bubble(r) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(0x6fb6ff) }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
        gl_FragColor = vec4(uColor, uAlpha * (0.06 + 0.9 * rim));
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), mat);
  m.scale.y = 0.85;
  m.frustumCulled = false;
  return m;
}

function oortCloud() {
  const n = 6000; const pos = new Float32Array(n * 3);
  let s = 99;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 1e-4) { i--; continue; }
    v.normalize().multiplyScalar(OORT[0] + (OORT[1] - OORT[0]) * rnd());
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}

/** A label on screen, pinned to a point in space. */
function pin(text) {
  const d = document.createElement('div');
  d.className = 'c5-edge-label';
  d.style.cssText = 'position:fixed;z-index:40;pointer-events:none;transform:translate(-50%,-120%);font:700 17px system-ui,sans-serif;color:#eaf6ff;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .6s;white-space:nowrap';
  d.textContent = text;
  document.body.appendChild(d);
  return d;
}

/** @returns {Promise<void>} */
export function playEdgePullBack(game) {
  const { scene, ship } = game;
  const overlay = buildOverlay({ eyebrow: lvl('The edge', 'The edge'), title: lvl('The Sun’s family', 'The Sun’s family'), sub: lvl('How far does it go?', 'How big is it?'), startBlack: false });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;

  const root = new THREE.Group();
  root.name = 'edge-scene';
  scene.add(root);
  const lines = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].filter((id) => BODIES[id])
    .map((id) => { const l = orbitLine(BODIES[id].orbit, id === 'pluto' ? 0xc9b49a : 0x8fb4ff, 0); root.add(l); return l; });
  const helio = bubble(HELIO_R); root.add(helio);
  const oort = oortCloud(); root.add(oort);
  // Voyager 1, on the bubble's edge (a bright dot).
  const vDir = new THREE.Vector3(0.35, 0.45, -0.82).normalize();
  const voyager = new THREE.Mesh(new THREE.SphereGeometry(HELIO_R * 0.012, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2b0).multiplyScalar(3) }));
  voyager.position.copy(vDir).multiplyScalar(HELIO_R * 0.99);
  root.add(voyager);

  const labels = {
    kuiper: pin(lvl('Kuiper belt: icy leftovers', 'Kuiper belt: icy rocks')),
    neptune: pin(lvl('Neptune’s path', 'Neptune’s path')),
    helio: pin(lvl('Heliosphere: the bubble of the Sun’s wind', 'The Sun’s bubble')),
    voyager: pin(lvl('Voyager 1 flew out of the bubble in 2012', 'Voyager 1 got out here in 2012')),
    oort: pin(lvl('Oort cloud: a shell of icy comets (really 10x further still)', 'Oort cloud: lots of icy comets, very far away')),
  };
  const show = { neptune: [6, 8.6], kuiper: [8.8, 11], helio: [11.2, 13.6], voyager: [13.8, 16], oort: [16.2, 19.5] }; // one at a time
  // The pull-back as camera distances at given times (eased in log steps), so
  // each stop gets time on screen: her ship, the planets and Kuiper belt, the
  // bubble, the Oort shell.
  const KEYS = [[0.5, 40], [4, 3000], [8, 160000], [12, 560000], [16.5, OORT[1] * 2.6]];
  const distAt = (time) => {
    if (time <= KEYS[0][0]) return KEYS[0][1];
    for (let i = 1; i < KEYS.length; i++) {
      const [t1, d1] = KEYS[i]; const [t0, d0] = KEYS[i - 1];
      if (time <= t1) return d0 * Math.pow(d1 / d0, ease((time - t0) / (t1 - t0)));
    }
    return KEYS[KEYS.length - 1][1];
  };

  let farWas = null;
  let t = 0;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 2); });
  setTimeout(() => overlay.bars(true), 100);

  const camPos = new THREE.Vector3(); const look = new THREE.Vector3(); const v = new THREE.Vector3();
  const fwd = new THREE.Vector3(); const d = new THREE.Vector3();
  const place = (el, world, camera, on) => {
    // In front of the camera? (Not v.z < 1: this far out the depth rounds past 1.)
    camera.getWorldDirection(fwd);
    const ahead = d.copy(world).sub(camera.position).dot(fwd) > 0;
    v.copy(world).project(camera);
    const vis = on && ahead && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8; // well inside the frame
    el.style.opacity = vis ? 1 : 0;
    if (vis) { el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`; }
  };

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    apply(dt, camera) {
      if (farWas === null) { farWas = camera.far; camera.far = 1e8; camera.updateProjectionMatrix(); }
      t += Math.max(0, Math.min(dt, 0.1));
      // Everything is laid out round the Sun (physics origin), shifted by her position.
      root.position.set(-ship.x, 0, -ship.z);
      const sun = new THREE.Vector3(-ship.x, 0, -ship.z);
      // Pull back: from just behind her to far enough to see the Oort shell.
      // ...and back in to her ship at the end.
      const back = ease((t - 18) / 3);
      const dist = 40 * Math.pow(distAt(t) / 40, 1 - back);
      const toSun = ease((t - 2) / 8) * (1 - ease((t - 18) / 3));
      look.lerpVectors(new THREE.Vector3(), sun, toSun);
      camPos.copy(look).add(new THREE.Vector3(0.2, 0.75, 0.62).normalize().multiplyScalar(dist));
      const w = ease(t / 1.5) * (1 - ease((t - 19) / 2));
      blendCamera(camera, camPos, look, w);
      // Fade the props in as they come into view.
      lines.forEach((l) => { l.material.opacity = 0.55 * ease((t - 3) / 2) * (1 - ease((t - 18) / 2)); });
      helio.material.uniforms.uAlpha.value = ease((t - 7) / 3) * (1 - ease((t - 18) / 2));
      oort.material.opacity = 0.8 * ease((t - 13) / 3) * (1 - ease((t - 18.5) / 2));
      // Labels.
      const near = new THREE.Vector3(ship.x, 0, ship.z).normalize();
      place(labels.kuiper, v.clone().copy(near).multiplyScalar(62000).add(sun), camera, t > show.kuiper[0] && t < show.kuiper[1]);
      place(labels.neptune, near.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6).multiplyScalar(BODIES.neptune.orbit).add(sun), camera, t > show.neptune[0] && t < show.neptune[1]);
      place(labels.helio, new THREE.Vector3(-HELIO_R * 0.75, HELIO_R * 0.55, 0).add(sun), camera, t > show.helio[0] && t < show.helio[1]);
      place(labels.voyager, voyager.position.clone().add(sun), camera, t > show.voyager[0] && t < show.voyager[1]);
      place(labels.oort, new THREE.Vector3(0, OORT[1] * 0.85, 0).add(sun), camera, t > show.oort[0] && t < show.oort[1]);
      if (t > 0.8 && !overlay._titled) { overlay._titled = true; overlay.showTitle(); }
      if (t > 3.5 && !overlay._untitled) { overlay._untitled = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; camera.far = farWas; camera.updateProjectionMatrix(); finish(); }
    },
  };

  return done.finally(() => {
    scene.remove(root);
    root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    Object.values(labels).forEach((l) => l.remove());
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}

