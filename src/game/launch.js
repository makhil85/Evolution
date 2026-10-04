// The launch: drives the verified flight simulation and shows it.
//
// The numbers on screen are the SIMULATION's, not an animation's. rocket.js
// integrates thrust, fuel burn-off, altitude-thinning drag and gravity at a
// fixed 20 ms step; this module only reads it and draws the result. That is why
// a badly built rocket genuinely fails rather than being scripted to fail.
//
// Measured behaviour of the tuned sim (pointed nose):
//   1 tank  16.3 km   4 tanks 125.8 km   7 tanks  93.4 km (sits on the pad 27 s)
//   5 tanks 129.9 km <- peak             8 tanks  75.8 km (sits on the pad 59 s)
import * as THREE from 'three';
import { createFlightSim, flightConfigFromBuild, verdictFor, FLIGHT_ADVICE } from './rocket.js';
import { toonRamp } from './toonPipeline.js';
import { audio } from './audio.js';
import { LaunchVfx } from './launchVfx.js';

/** World units shown per metre climbed. 130 km maps to 1300 units. */
const METRES_TO_UNITS = 0.01;

/**
 * Playback speed. The SIMULATION is real - a 5-tank rocket genuinely takes
 * about four minutes to coast to 130 km, and at 10 s it is only 109 m up. No
 * child will watch that. So the physics runs untouched and only the CLOCK is
 * accelerated: the first HOLD_REAL seconds play at true speed, which is the
 * part with the drama in it (does she even leave the pad?), then time ramps to
 * MAX_SCALE so the whole flight lands in about half a minute.
 *
 * Every number the HUD shows is still the simulation's own.
 */
const HOLD_REAL = 3;
const MAX_SCALE = 45;
const RAMP_SECONDS = 4;

/**
 * Stages that are pad furniture, not vehicle. They never leave the ground.
 * See the note in start().
 */
const GROUND_STAGES = new Set(['foundation']);

/** Sky colour at the pad and at the top of the climb. */
const SKY_GROUND = new THREE.Color(0x8ed0f5);
const SKY_SPACE = new THREE.Color(0x05070f);

/**
 * After a launch that reaches orbit, the story continues in space: a single
 * big button into Chapter 4. Only on 'orbit', because a rocket that fell short
 * didn't get her to space, and Chapter 4 opens with her in orbit. The chapter
 * menu unlocks Chapter 4 from the `launched` flag either way.
 */
function showContinueToChapter4() {
  if (document.getElementById('rvContinueCh4')) return;
  const a = document.createElement('a');
  a.id = 'rvContinueCh4';
  a.href = 'chapter4.html';
  a.textContent = 'Continue to Chapter 4: Voyage to Europa →';
  Object.assign(a.style, {
    position: 'fixed', left: '50%', bottom: '9vh', transform: 'translateX(-50%)', zIndex: '99998',
    padding: '16px 26px', borderRadius: '999px', background: 'linear-gradient(90deg, #ffb347, #ff7847)',
    color: '#241207', font: '800 18px "Segoe UI", "Trebuchet MS", system-ui, Arial, sans-serif',
    textDecoration: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.35)', letterSpacing: '.01em',
  });
  document.body.appendChild(a);
}

export class LaunchSequence {
  /**
   * @param {object} deps
   * @param {import('./rocketComplex.js').RocketComplex} deps.rocket
   * @param {THREE.Scene} deps.scene
   * @param {THREE.PerspectiveCamera} deps.camera
   * @param {object} deps.hud
   * @param {object} deps.engine
   */
  constructor({ rocket, scene, camera, hud, engine }) {
    this.rocket = rocket;
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;
    this.engine = engine;
    this.active = false;
    this.finished = false;
    this.sim = null;
    this.config = null;

    // The stages that actually fly, lifted off the pad as one body.
    this.vehicle = new THREE.Group();
    this.vehicle.name = 'flyingVehicle';
    rocket.group.add(this.vehicle);

    this.flame = this.makeFlame();
    this.vehicle.add(this.flame);
    this.flame.visible = false;

    // Exhaust, pad smoke and contrail. A sibling of the vehicle, NOT a child:
    // the plume and the trail stay where they were emitted while the rocket
    // moves on, so they must not inherit the vehicle's rising transform.
    this.vfx = new LaunchVfx({ parent: rocket.group });
    // One reusable sample for the VFX. It carries the altitude actually being
    // DRAWN (which is frozen at apogee) rather than the sim's, so the contrail
    // does not keep growing while the vehicle is held still. Reused every
    // frame because update() runs at 60 Hz and must not allocate.
    this._vfxSample = { altitudeM: 0, velocityMs: 0, burning: false };
  }

  makeFlame() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      // Sized to the slimmed body (2.5 at the base), not the old 4.3 one.
      new THREE.ConeGeometry(1.7, 8, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb13d })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -4;
    g.add(cone);
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 5, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
    );
    core.rotation.x = Math.PI;
    core.position.y = -2.4;
    g.add(core);
    g.position.y = 2;
    return g;
  }

  /**
   * Build the flight config from what the child actually built, then ignite.
   * @param {{fuelTanks?:number, noseCone?:string}} build
   */
  start(build = {}) {
    if (this.active) return false;

    // Move the FLYING stages onto the vehicle so they lift as one.
    //
    // `foundation` is not one of them. Despite the name it is not part of the
    // vehicle at all - it is the pad: a stone platform eight units across and
    // six nine-unit scaffold poles. Reparenting every stage took the launch
    // platform into the sky with the rocket, which is both wrong and funny in
    // a way that undercuts the moment. It stays on the ground, and the rocket
    // rises out of the scaffolding the way it should.
    for (const [id, stage] of this.rocket.stages) {
      if (GROUND_STAGES.has(id)) continue;
      if (stage.group.parent !== this.vehicle) this.vehicle.add(stage.group);
    }

    this.config = flightConfigFromBuild(build);
    this.sim = createFlightSim(this.config);
    this.active = true;
    this.finished = false;
    this.elapsed = 0;
    this.peakM = 0;
    this.wasAscending = false;
    this.flame.visible = true;
    // The flight readout occupies the same corner as the mission card, so the
    // two overlap during a launch. The mission is irrelevant mid-flight anyway.
    this.setMissionCardVisible(false);
    audio.ignition();
    this.vfx.ignite();
    this.nextExhaustAt = 0;
    this.skyFrom = this.scene.background ? this.scene.background.clone() : SKY_GROUND.clone();
    this.fogNear = this.scene.fog ? this.scene.fog.near : null;
    this.fogFar = this.scene.fog ? this.scene.fog.far : null;
    return true;
  }

  /** Hide/show the mission card so it cannot collide with the flight panel. */
  setMissionCardVisible(visible) {
    for (const el of document.querySelectorAll('.rv-card--mission')) {
      el.style.visibility = visible ? '' : 'hidden';
    }
  }

  /** Wall-clock seconds -> simulated seconds. */
  timeScale() {
    if (this.elapsed <= HOLD_REAL) return 1;
    const k = Math.min(1, (this.elapsed - HOLD_REAL) / RAMP_SECONDS);
    return 1 + (MAX_SCALE - 1) * k * k;
  }

  /** @returns {boolean} true while the sequence owns the camera */
  update(dt) {
    if (!this.active) return false;
    this.elapsed += dt;

    // The sim integrates at its own fixed 20 ms step internally, so handing it
    // a larger dt costs more substeps but changes no physics.
    const s = this.finished ? this.sim.sample() : this.sim.step(dt * this.timeScale());
    const y = (this.holdAtApogee ? this.peakM : s.altitudeM) * METRES_TO_UNITS;
    this.vehicle.position.y = y;

    this._vfxSample.altitudeM = y / METRES_TO_UNITS;
    this._vfxSample.velocityMs = s.velocityMs;
    this._vfxSample.burning = s.burning;
    this.vfx.update(dt, this._vfxSample);

    // Flame only while the engine is actually burning, and it flickers.
    this.flame.visible = s.burning;
    // Exhaust is retriggered on a timer, never per frame - 60 noise buffers a
    // second would both sound wrong and allocate hard.
    if (s.burning && this.elapsed > this.nextExhaustAt) {
      this.nextExhaustAt = this.elapsed + 0.34;
      audio.exhaust();
    }
    if (s.burning) {
      const f = 1 + Math.sin(this.elapsed * 40) * 0.12;
      this.flame.scale.set(f, 1 + Math.sin(this.elapsed * 27) * 0.2, f);
    }

    // Chase camera, easing back as she climbs so the rocket stays framed.
    const world = new THREE.Vector3();
    this.vehicle.getWorldPosition(world);
    const back = 14 + Math.min(40, y * 0.05);
    this.camera.position.lerp(
      new THREE.Vector3(world.x + back * 0.7, world.y + 6 + y * 0.02, world.z + back),
      1 - Math.pow(0.002, dt)
    );
    this.camera.lookAt(world.x, world.y + 2, world.z);

    // Sky darkens with altitude: the atmosphere thinning, made visible.
    const k = THREE.MathUtils.clamp(s.altitudeM / 90000, 0, 1);
    if (this.scene.background) this.scene.background.copy(this.skyFrom).lerp(SKY_SPACE, k);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.skyFrom).lerp(SKY_SPACE, k);
      this.scene.fog.far = this.fogFar + k * 3000;
    }

    // FlightSample carries no fuel figure, so hand the HUD dryMassKg and let it
    // derive one rather than invent a number.
    this.hud?.setFlightReadout({
      ...s,
      dryMassKg: this.config.dryMassKg,
      fuelMassKg: Math.max(0, s.massKg - this.config.dryMassKg),
    });

    // Do NOT trust sample.apogee here. It is set per internal 20 ms substep,
    // and one step() call runs ~40 substeps at full time scale, so the flag is
    // almost always overwritten before it is returned. Detect the turnover from
    // the samples we actually see instead.
    if (s.altitudeM > this.peakM) this.peakM = s.altitudeM;
    if (s.velocityMs > 1) this.wasAscending = true;
    const turnedOver = this.wasAscending && s.velocityMs <= 0;
    if (turnedOver && !this.finished) this.finish(s);
    return true;
  }

  finish(sample) {
    this.finished = true;
    this.flame.visible = false;
    // Hold the vehicle at its high point. Watching it plummet back and crash
    // undoes the moment, and the apogee is what the lesson is about.
    this.holdAtApogee = true;

    const stats = this.sim.stats ? this.sim.stats() : {};
    const apogeeM = Math.max(this.peakM, stats.apogeeM ?? 0, sample.altitudeM);
    // NOTE: stats() calls it thrustToWeight, not twr. Passing the wrong name
    // makes verdictFor see undefined, and `undefined < 1` is false - so every
    // too-heavy rocket would have been reported as merely "short".
    const verdict = verdictFor(apogeeM, stats.thrustToWeight, stats.liftoffT);
    const advice = FLIGHT_ADVICE[verdict] || '';
    const km = (apogeeM / 1000).toFixed(1);

    const headline = {
      orbit: `Orbit! Apogee ${km} km.`,
      'too-heavy': `Apogee ${km} km - too heavy to lift off.`,
      sluggish: `Apogee ${km} km - barely got off the pad.`,
      short: `Apogee ${km} km - ran out of fuel too soon.`,
    }[verdict] || `Apogee ${km} km.`;

    this.verdict = { verdict, apogeeM, advice, twr: stats.thrustToWeight };
    if (verdict === 'orbit') audio.orbit(); else audio.shortfall();
    this.hud?.toast(headline, verdict === 'orbit' ? 'good' : 'warn');
    if (advice) setTimeout(() => this.hud?.toast(advice, 'info'), 1200);
    if (verdict === 'orbit') setTimeout(() => showContinueToChapter4(), 2600);
  }

  /** Put everything back on the pad so a different build can be tried. */
  reset() {
    document.getElementById('rvContinueCh4')?.remove();
    this.active = false;
    this.finished = false;
    this.vehicle.position.y = 0;
    this.flame.visible = false;
    this.vfx.reset();
    this.holdAtApogee = false;
    this.setMissionCardVisible(true);
    if (this.scene.background && this.skyFrom) this.scene.background.copy(this.skyFrom);
    if (this.scene.fog && this.fogFar != null) {
      this.scene.fog.color.copy(this.skyFrom);
      this.scene.fog.far = this.fogFar;
    }
  }
}
