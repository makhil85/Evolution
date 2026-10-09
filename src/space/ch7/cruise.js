// Chapter 7, Part E: the full push (about 31 s, skippable after 1.5 s). The fusion
// drive stays at full power (1 g) and the ship speeds up from 20% of light
// speed to about 90%. Lead 2026-10-08: "the ship keeps on accelerating with the
// fusion drive until it reaches about 90% of light speed". No sleep pods and no
// relativity lesson: the clocks are only a story, told in partE.js's dialogue.
//
// What she sees: the starship from behind, the plume at full power, and star
// streaks that stretch as the speed grows (lines, not particles: calm). A dial
// climbs in percent of light speed, and a ship clock counts the years on board
// (a fast clock: voyage.js). A plan strip across the top shows the whole trip:
// speed up at 1 g, coast at 90%, turn round, brake at 1 g. At 90% the drive goes
// quiet and the ship coasts (zero g), as the plan says.
//
// The numbers are voyage.js's (the ship clock from the 1 g model; the dial moves
// in rapidity, so the climb is steady). The drive is pretend: no drive we can
// build today could do this (said in the dialogue and the question's parent hint).
// Same cutscene contract as the other Chapter 6 and 7 cutscenes.
import * as THREE from 'three';
import { buildOverlay, blendCamera, waitForSkip, ease } from '../cinematics.js';
import { createStarship, FLIGHT_LENGTH } from '../ch6/starship.js';
import { showStarship } from '../ch6/opening.js';
import { t as lvl, IS_LEVEL1 } from '../level.js';
import { buildDial, buildCaption } from './opening.js';
import { OPENING_TO, TOP_SPEED, dialSpeed, percentOf, clockWords, rapidity, C_OVER_G_YEARS } from './voyage.js';

const DURATION = 31;
const T_PUSH = 18; // the push runs 20% -> 90% over this (about 1.2 years on the ship's clock)
const T_COAST = 19.5; // the drive goes quiet: the coast
// Few and dim (lead: streak clutter, AGENT_HANDOFF section 11): 30 lines at half opacity.
const N_STREAK = 30;
const STAR_R = 4000;
const UP = new THREE.Vector3(0, 1, 0);

/** The four parts of the trip, as the plan strip shows them ([L4, L1]). */
const PLAN = [
  [lvl('Speed up at 1 g', 'Speed up'), 0],
  [lvl('Coast at 90%', 'Coast'), 1],
  [lvl('Turn the ship round', 'Turn round'), 2],
  [lvl('Brake at 1 g', 'Slow down'), 3],
];

/** The ship clock: a box top-centre, under the plan strip. */
function buildClock() {
  const box = document.createElement('div');
  box.className = 'c7-clock';
  box.style.cssText = 'position:fixed;left:28px;bottom:120px;z-index:60;min-width:190px;padding:12px 16px;border-radius:16px;'
    + 'background:rgba(10,16,32,.78);border:2px solid #ffb347;color:#fff;font:800 15px system-ui,sans-serif;text-align:center;'
    + 'transition:opacity .6s;opacity:0;pointer-events:none';
  const head = document.createElement('div');
  head.style.cssText = 'font-size:13px;color:#ffd9a0';
  head.textContent = lvl('Ship clock', 'Clock on the ship');
  const big = document.createElement('div');
  big.style.cssText = 'font-size:22px;line-height:1.2';
  box.append(head, big);
  document.body.appendChild(box);
  return {
    show(v) { box.style.opacity = v ? '1' : '0'; },
    set(years) { big.textContent = clockWords(years, { l1: IS_LEVEL1 }); },
    remove() { box.remove(); },
  };
}

/** The plan strip: four pills across the top; the one she is on is lit. */
function buildPlan() {
  const bar = document.createElement('div');
  bar.className = 'c7-plan';
  bar.style.cssText = 'position:fixed;left:50%;top:calc(11vh + 14px);transform:translateX(-50%);z-index:45;display:flex;gap:8px;'
    + 'pointer-events:none;opacity:0;transition:opacity .8s ease;font:700 clamp(12px,1.2vw,16px) system-ui,sans-serif';
  const pills = PLAN.map(([label]) => {
    const p = document.createElement('div');
    p.style.cssText = 'padding:7px 14px;border-radius:999px;border:2px solid rgba(255,255,255,.25);color:rgba(255,255,255,.55);background:rgba(10,16,32,.6);white-space:nowrap;transition:all .5s ease';
    p.textContent = label;
    bar.appendChild(p);
    return p;
  });
  document.body.appendChild(bar);
  return {
    show(v) { bar.style.opacity = v ? '1' : '0'; },
    /** Light up the pill for the part she is on (0 = speed up, 1 = coast, ...). */
    light(i) {
      pills.forEach((p, k) => {
        const on = k === i;
        p.style.borderColor = on ? '#ffb347' : 'rgba(255,255,255,.25)';
        p.style.color = on ? '#fff7ea' : 'rgba(255,255,255,.55)';
        p.style.background = on ? 'rgba(255,179,71,.22)' : 'rgba(10,16,32,.6)';
      });
    },
    remove() { bar.remove(); },
  };
}

/** Star streaks: short lines on a sphere round the ship, towards its way of travel; they lengthen with speed. */
function buildStreaks() {
  let seed = 23;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const dirs = []; const tint = [];
  for (let i = 0; i < N_STREAK; i++) {
    const z = 2 * rnd() - 1; const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - z * z);
    dirs.push(new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)));
    tint.push(0.35 + 0.65 * rnd());
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N_STREAK * 6);
  const col = new Float32Array(N_STREAK * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  const tang = new THREE.Vector3(); const tail = new THREE.Vector3();
  return {
    lines,
    /** heading: her direction of travel; len: streak length (radians); k: brightness 0..1. */
    update(heading, len, k) {
      lines.visible = k > 0.01;
      if (!lines.visible) return;
      for (let i = 0; i < N_STREAK; i++) {
        const d = dirs[i];
        tang.copy(heading).addScaledVector(d, -heading.dot(d));
        tail.copy(d).addScaledVector(tang, len).normalize();
        // Written straight into the buffers (no array per streak, per frame).
        const o = i * 6;
        pos[o] = d.x * STAR_R; pos[o + 1] = d.y * STAR_R; pos[o + 2] = d.z * STAR_R;
        pos[o + 3] = tail.x * STAR_R; pos[o + 4] = tail.y * STAR_R; pos[o + 5] = tail.z * STAR_R;
        const c = k * tint[i];
        col[o] = c * 0.9; col[o + 1] = c * 0.95; col[o + 2] = c;
        col[o + 3] = 0; col[o + 4] = 0; col[o + 5] = 0; // the tail fades to nothing
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    dispose() { lines.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

/**
 * The cutscene. Resolves when it ends (the flight scene is back).
 * Test hook while it runs: window.__ch7Cruise.t (seconds in); removed at the end.
 * @param {object} game the space game (scene, shipView, controls, cinematic)
 * @returns {Promise<void>}
 */
export function playCh7Cruise(game) {
  const { scene, shipView } = game;
  const overlay = buildOverlay({
    eyebrow: lvl('Chapter 7 · Part E', 'Chapter 7'),
    title: lvl('Full push!', 'Full push!'),
    sub: lvl('Up to 90% of light speed', 'Almost as fast as light!'),
    startBlack: false,
  });
  document.body.classList.add('in-cinematic');
  game.controls.setEnabled(false);
  game.paused = true;
  game.warpIndex = 0;
  game._starship?.remove(); // the cutscene's own ship; the flight one comes back at the end
  const shipQuat = shipView.group.quaternion.clone();
  shipView.group.visible = false;

  const ship = createStarship({ detail: 'near' });
  ship.group.scale.setScalar(FLIGHT_LENGTH / ship.dims.length);
  ship.setRingSpin(0.3);
  ship.setField(0.5);
  ship.setLights(true);
  ship.setDrive(0);
  scene.add(ship.group);
  const streaks = buildStreaks();
  scene.add(streaks.lines);
  const fill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2420, 0.5); // lifted with the opening's fill (the frames read dark)
  scene.add(fill);
  const dial = buildDial();
  const clock = buildClock();
  const plan = buildPlan();
  const caption = buildCaption();

  // The captions: each one shows from its start time to its end (seconds into the cutscene).
  // Each stays up for its reading time (readMs, 5-10 s, here the longer Level 4 text) plus the fade in.
  const LINES = [
    [2.2, 9.4, lvl('Full push: one g. It feels like the pull of Earth, all the way.', 'Full push! It feels like Earth’s pull.')],
    [10.5, 17, lvl('The speed keeps going up, and the clock on board keeps ticking.', 'Faster and faster!')],
    [T_COAST + 0.5, 27.8, lvl('90% of light speed. The drive goes quiet, and we coast with no push at all.', '90% of light speed! The engine is off. We float.')],
  ];
  let shownLine = null;

  let t = 0;
  // Test hook while the cutscene runs (removed at the end): window.__ch7Cruise.t, seconds in.
  const hook = { get t() { return t; } };
  window.__ch7Cruise = hook;
  let finish;
  const done = new Promise((r) => { finish = r; });
  const skip = waitForSkip(1500, () => overlay.showSkip(true));
  skip.promise.then(() => { t = Math.max(t, DURATION - 2.5); });
  setTimeout(() => overlay.bars(true), 80);

  const camPos = new THREE.Vector3(); const look = new THREE.Vector3();
  const heading = new THREE.Vector3(0, 0, -1); // she flies towards -Z (the cap)
  const phi0 = rapidity(OPENING_TO);
  const phi1 = rapidity(TOP_SPEED);

  game.cinematic = {
    calm: true, // no speed dust or warp streaks (main.js)
    hideMarkers: true,
    hidePath: true,
    get t() { return t; },
    apply(dt, camera) {
      dt = Math.max(0, Math.min(dt, 0.1));
      t += dt;
      shipView.group.visible = false;

      // The push: the drive at full power, then quiet for the coast.
      const k = Math.min(1, t / T_PUSH);
      const pushing = t < T_COAST;
      ship.setDrive(pushing ? ease(t / 1.5) : Math.max(0, 1 - (t - T_COAST) / 1.5));
      ship.setField(pushing ? 0.5 + 0.3 * k : 0.8 - 0.3 * Math.min(1, (t - T_COAST) / 4));
      ship.update(dt, t);

      // Speed: the dial moves in rapidity, so the climb is steady in the story. It
      // holds at 90% once the push is over. The ship clock is the years on board.
      const v = dialSpeed(OPENING_TO, TOP_SPEED, k);
      dial.set(v);
      dial.show(t > 0.5 && t < DURATION - 3);
      clock.set(C_OVER_G_YEARS * (phi1 - phi0) * k);
      clock.show(t > 0.5 && t < DURATION - 3);
      plan.show(t > 1.2 && t < DURATION - 3);
      plan.light(t < T_COAST ? 0 : 1);

      // The streaks lengthen with speed: calm lines, not particles.
      streaks.update(heading, 0.015 + 0.12 * v, Math.min(1, 0.3 + v));

      // The camera: behind her and to one side, so the plume shows, and it pulls out a
      // little as the ship coasts. A slow drift makes it feel alive.
      const drift = Math.sin(t * 0.25) * 6;
      camPos.set(28 + drift, 16 + 0.6 * t, 80 + 0.8 * t);
      look.set(0, 0, -30);
      blendCamera(camera, camPos, look, ease(t / 1.5) * (t > DURATION - 2 ? 1 - ease((t - (DURATION - 2)) / 2) : 1));

      // Captions as the cutscene goes on.
      const line = LINES.find(([a, b]) => t >= a && t < b) || null;
      if (line !== shownLine) {
        shownLine = line;
        if (line) caption.show(line[2]); else caption.hide();
      }

      if (t > 1.2 && !overlay._a) { overlay._a = true; overlay.showTitle(); }
      if (t > 1.2 + overlay.readS && !overlay._b) { overlay._b = true; overlay.hideTitle(); }
      if (t >= DURATION) { game.cinematic = null; finish(); }
    },
  };

  return done.finally(() => {
    if (window.__ch7Cruise === hook) delete window.__ch7Cruise;
    skip.dispose();
    overlay.showSkip(false);
    overlay.bars(false);
    overlay.hideTitle();
    document.body.classList.remove('in-cinematic');
    setTimeout(() => overlay.remove(), 1000);
    dial.remove(); clock.remove(); plan.remove(); caption.remove();
    scene.remove(ship.group, streaks.lines, fill);
    ship.dispose(); streaks.dispose();
    shipView.group.position.set(0, 0, 0);
    shipView.group.quaternion.copy(shipQuat);
    shipView.group.visible = true;
    showStarship(game);
    game.controls.setEnabled(true);
    game.paused = false;
  });
}
