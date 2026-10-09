// Act 1 - Earth orbit: the wings fold, zero-g, the first lap, the satellite,
// and the burn toward the Moon. See missions.js for the step format.
import * as THREE from 'three';
import { BODIES } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { refuel } from '../physics.js';
import { wait, angleAround } from './util.js';
import { playZeroG } from '../cinematics.js';
import { heroName } from '../hud/hud.js';
import { SATELLITE, satelliteState, satelliteRig, buildPanelPuzzleScene } from '../satellite.js';
import { t } from '../level.js';
import { lessonOnce } from '../../lesson/card.js';
import { heroText } from '../../launcher/hero.js';
import { LESSON_4F } from '../../lesson/lessons/flightSchool.js';

/** Screen-space marker for the satellite, in the same shape main.js's own
 * buildMarkers() produces for a real body - but the satellite isn't in
 * contracts.BODIES (it's not part of the solar system rail table), so it is
 * drawn through missions.extraMarkers(camera, origin, w, h) instead of the
 * normal `markers: [bodyId]` field. See main.js's buildMarkers(): that hook
 * already exists there for exactly this case. */
const _mProj = new THREE.Vector3();
function satelliteMarker(camera, origin, w, h, wx, wz) {
  _mProj.set(wx - origin.x, 0, wz - origin.z).project(camera);
  const behind = _mProj.z > 1;
  const onScreen = !behind && Math.abs(_mProj.x) <= 1 && Math.abs(_mProj.y) <= 1;
  let sx = (_mProj.x * 0.5 + 0.5) * w;
  let sy = (-_mProj.y * 0.5 + 0.5) * h;
  if (behind) { sx = w - sx; sy = h - sy; }
  const dist = Math.hypot(wx - origin.x, wz - origin.z);
  // hud/markers.js appends " · {distance} u" to `label` itself (the same way
  // main.js's own buildMarkers() does for a real body), so `label` here is
  // just the name - baking the distance in too would print it twice.
  return {
    id: 'satellite',
    label: 'Next: Satellite',
    screenX: sx, screenY: sy, onScreen, distance: dist, kind: 'goal',
  };
}

export function act1Steps(game) {
  const { hud, shipView } = game;

  // Lap counter for "ride full orbits".
  let lapLast = null;
  let lapSwept = 0;
  /** True once she has swept `laps` full turns round Earth since lapStart(). */
  function lapStart() { lapLast = null; lapSwept = 0; }
  function lapped(states, laps) {
    if (game.ship.soi !== 'earth') return false;
    const a = angleAround(game, 'earth', states);
    if (lapLast !== null) {
      let d = a - lapLast;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      lapSwept += d;
    }
    lapLast = a;
    return Math.abs(lapSwept) >= Math.PI * 2 * laps;
  }

  // The satellite: one flight-scene instance (satellite.js's rig, shared with
  // act2.js, which releases it at the Moon).
  const rig = satelliteRig(game);
  let puzzleTriggered = false;
  let puzzleDone = false;

  /** Its marker, while she is still flying to it. */
  function showMarker(ctx) {
    // (Gone once the creep starts: the camera is right there and the frame
    // would only hide the satellite itself.)
    ctx.missions.extraMarkers = (camera, origin, w, h) => (rig.phase === 'free'
      ? [satelliteMarker(camera, origin, w, h, rig.world.x, rig.world.z)] : []);
  }

  /** Riding on her ship to the Moon (Act 1's last steps and the Moon capture):
   * its arrays charge her tank while she coasts. */
  function ridingStep(ctx, stepTime) { rig.frame(ctx, stepTime); }

  /** The satellite as a planner target (it isn't a body in contracts). */
  function satelliteTarget(ctx) {
    const gm = BODIES.earth.gm;
    const r = SATELLITE.orbit;
    const earth = { x: 0, z: 0, vx: 0, vz: 0 };
    return {
      name: 'the satellite',
      parent: 'earth',
      orbit: r,
      period: 2 * Math.PI * Math.sqrt((r * r * r) / gm),
      radius: 1.5,
      soi: SATELLITE.catchRadius * ctx.mode.captureScale,
      stateRelAt(t, out) {
        satelliteState(t, out);
        bodyState('earth', t, earth);
        out.x -= earth.x; out.z -= earth.z; out.vx -= earth.vx; out.vz -= earth.vz;
        return out;
      },
    };
  }

  return [
    // ------------------------------------------------------------ ACT 1
    {
      id: 'a1_arrive', act: 1,
      title: 'Above the sky',
      objective: 'Listen to Mission Control.',
      async enter() {
        shipView.setWingsFolded(false, true);
        await hud.showDialogue([
          { who: 'Mission Control', text: t('Clean separation! You are in orbit around Earth.', 'The parts came off! You are going around Earth.') },
          { who: 'girl', text: t('Whoa. I can see the whole Atlantic Ocean!', 'Whoa. I can see a whole ocean!') },
          { who: 'Mission Control', text: 'You have left the air behind. Watch your wings.' },
        ]);
        shipView.setWingsFolded(true);
        await wait(2600);
      },
      beat: 'wingsFolded',
      after() { hud.toast(t('Wings folded. Thrusters online. Turn the ship to steer it.', 'Wings folded away! Now you can turn.'), { kind: 'good' }); },
    },
    {
      id: 'a1_float', act: 1,
      title: 'Floating',
      objective: t('Everything in the cabin is floating...', 'Everything is floating!'),
      async enter(ctx) {
        // The zero-g moment, staged in her real cockpit (cinematics.js): she
        // floats up out of her seat with a pencil, a notebook and a water drop
        // drifting round her, Earth behind. Then the fact card, then the
        // cabinFloat question as before. (cabin.js, a separate interior set,
        // was replaced by this: the real ship reads far better.)
        await playZeroG(ctx);
        await ctx.hud.showFact({
          title: 'Everything is floating!',
          body: heroText(t(`${heroName()}'s pencil drifts past her nose and a drop of water wobbles like jelly. ` +
            'But up here, Earth’s gravity is still almost as strong as on the ground...',
            `${heroName()}'s pencil floats past her nose. A drop of water wobbles like jelly!`)),
        });
      },
      beat: 'cabinFloat',
    },
    {
      id: 'a1_orbit', act: 1,
      title: 'Your first orbits',
      // Two laps before the sunrise question (lead 2026-10-07: slow the
      // early questions down, let her enjoy the view first).
      objective: t('Ride two full laps around Earth. Don’t fire the engine; just watch the dotted line and the sunrises.', 'Go around Earth two times. Don’t press Space. Just watch!'),
      markers: ['earth'],
      enter() { lapStart(); game.target = 'moon'; },
      check(ctx, states) { return lapped(states, 2); },
      beat: 'firstOrbit',
    },
    {
      id: 'a1_satellite_meet', act: 1,
      title: 'Catch the satellite',
      objective: t('A weather satellite is in a slightly higher orbit. Wait for the BURN NOW banner, then hold Space to rise up to meet it.', 'A satellite is just above you. When the green BURN NOW sign shows, hold Space to go up to it.'),
      aim: 'prograde',
      transfer: 'satellite',
      enter(ctx) {
        ctx.customTargets = ctx.customTargets || {};
        ctx.customTargets.satellite = satelliteTarget(ctx);
        puzzleTriggered = false;
        puzzleDone = false;
        rig.toFree();
        showMarker(ctx);
        hud.toast(t('A weather satellite! One of its solar wings has gone dark. Catch up with it.', 'A satellite! One of its wings is broken. Let’s go and fix it!'), { kind: 'info' });
      },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime);
        const catchR = SATELLITE.catchRadius * ctx.mode.captureScale;
        if (rig.phase === 'free') {
          // Coming in to meet it (closing, and on a line that passes within
          // catch range): the camera turns to show it before the catch.
          const sh = ctx.ship;
          const st = satelliteState(sh.t);
          const rx = st.x - sh.x; const rz = st.z - sh.z;
          const vx = sh.vx - st.vx; const vz = sh.vz - st.vz;
          const d = Math.hypot(rx, rz); const v = Math.hypot(vx, vz) || 1e-6;
          const closing = (rx * vx + rz * vz) / (d || 1);
          const miss = Math.abs(rx * vz - rz * vx) / v;
          // (Only the last few seconds of it: the camera holds time warp at 1x.)
          if (!rig.approachCam && d < catchR * 2.2 && closing > 0.3 && miss < catchR && (d - catchR) / closing < 7) rig.approach(true);
          else if (rig.approachCam && (closing < 0 || d > catchR * 2.6)) rig.approach(false);
        }
        if (rig.phase === 'free' && rig.distance() < catchR) {
          // Docking thrusters: instead of whizzing past (or a jump), her ship
          // matches its speed and creeps in over a few seconds, and the camera
          // swings round to show the two of them side by side.
          ctx.transferTarget = null;
          ctx.aimHint = null;
          rig.startCreep();
          hud.toast(t('Docking thrusters on! Matching its speed... creeping closer...', 'Slowly... slowly... getting closer!'), { kind: 'info' });
        }
        return rig.docked;
      },
      beat: 'satelliteMet',
      after() {
        hud.toast(t('Docked alongside! Press E to take control of its broken wing.', 'You caught it! Press E to fix the broken wing.'), { kind: 'good' });
      },
    },
    {
      id: 'a1_satellite_fix', act: 1,
      title: 'Fix the dead wing',
      objective: t('Press E. Both panels swing: turn left to catch the top one and right to catch the bottom one while each faces the Sun.', 'Press E. Turn left and right to catch both wings when they face the Sun.'),
      // After a reload straight into this step the docking thrusters creep
      // her back alongside (and the model is rebuilt) before E does anything.
      enter(ctx) {
        puzzleTriggered = false;
        puzzleDone = false;
        rig.toDock();
        ctx.missions.extraMarkers = () => [];
      },
      check(ctx, states, stepTime) {
        if (puzzleDone) return true;
        if (puzzleTriggered || !rig.docked) return false;
        // E starts it; if she hasn't found E after 8 s alongside, it opens by
        // itself (lead playtest: a child who missed the toast was stuck here
        // and the wing question never came). The autopilot waits 2 s: the
        // docking camera holds it back from tapping E itself.
        const waited = stepTime > (ctx.autopilot?.on ? 2 : 8);
        if (ctx.controls.isDown('KeyE') || waited) {
          puzzleTriggered = true;
          rig.puzzleStarted();
          ctx.runScene(buildPanelPuzzleScene(ctx, { toleranceScale: ctx.mode.captureScale })).then(() => {
            rig.puzzleDone();
            puzzleDone = true;
          });
        }
        return false;
      },
      beat: 'panelFixed',
      bonusBeats: ['satelliteSignal'],
      async after(ctx) {
        refuel(ctx.ship, ctx.fuelCapacity, ctx.fuelCapacity);
        ctx.resources.silicon = (ctx.resources.silicon || 0) + 1;
        ctx.missions.extraMarkers = () => [];
        // It comes along: it glides onto her ship's back, and its arrays look
        // like an extra pair of solar wings on her ship.
        rig.attach();
        hud.toast(t('Mission Control: panels back online, thank you! The satellite will ride on your ship to the Moon. While you coast, its solar wings slowly make fuel for your tank.',
          'It works again. Thank you! The satellite rides with you to the Moon. Its sun wings fill up your fuel while you glide.'), { kind: 'good', ms: 6500 });
        // Let her watch it settle on before anything else opens.
        await rig.whenAttached();
      },
    },
    // One calm lap with the satellite riding along before the flight-school
    // lesson (lead 2026-10-07).
    {
      id: 'a1_ride', act: 1,
      title: 'A lap with the satellite',
      objective: t('The satellite rides on your ship now. Enjoy one lap round Earth while its wings charge your tank.', 'Go round Earth once with the satellite on your ship.'),
      markers: ['earth'],
      enter() { lapStart(); rig.ensureAttached(); },
      check(ctx, states, stepTime) { ridingStep(ctx, stepTime); return lapped(states, 1); },
    },
    // Flight school (lead 2026-10-02): animated films on how a transfer
    // works, with a question after each, before she flies it for real.
    // Plays on the shared lesson card (once per Level; replay from the
    // launcher's Lessons list). No check(): the step is done when enter() settles.
    {
      id: 'a1_lesson', act: 1,
      title: t('Flight school', 'Flight school'),
      objective: t('Watch Mission Control’s quick lesson on how to fly to the Moon, and answer a question after each film.', 'Watch how to fly to the Moon. Then answer the questions.'),
      markers: ['moon'],
      async enter() {
        await lessonOnce(LESSON_4F, { bus: game.bus });
        hud.toast(t('Now for real: point along your path and wait for the green BURN NOW sign.', 'Now you try! Wait for the green BURN NOW sign.'), { kind: 'good' });
      },
    },
    {
      id: 'a1_raise', act: 1,
      title: 'Aim for the Moon',
      objective: t('Point along your path. Wait for the green BURN signal, then hold Space until the dotted line reaches the Moon.', 'Wait for the green BURN NOW sign. Then hold Space until the dotted line reaches the Moon.'),
      markers: ['moon'],
      aim: 'prograde',
      transfer: 'moon',
      enter(ctx) { game.target = 'moon'; ctx.missions.extraMarkers = () => []; rig.ensureAttached(); },
      check(ctx, states, stepTime) {
        ridingStep(ctx, stepTime);
        const c = game.prediction?.closest;
        // Or she's simply there (Hard's short dotted line may never show it).
        return game.ship.soi === 'moon' || (!!c && c.body === 'moon' && c.dist < BODIES.moon.soi * 0.6);
      },
      beat: 'beforeMoonBurn',
      after() { hud.toast(t('Your path reaches the Moon! Coast there. Use time warp when you are far from Earth.', 'Your path reaches the Moon! Now wait. Time warp makes time go fast.'), { kind: 'good' }); },
    },
    {
      id: 'a1_coast', act: 1,
      title: 'Coast to the Moon',
      objective: t('Coast until the Moon’s gravity takes over.', 'Wait until you reach the Moon.'),
      markers: ['moon'],
      // Keeps the "On course for the Moon" cue (and a correction if needed).
      transfer: 'moon',
      enter() { rig.ensureAttached(); },
      check(ctx, states, stepTime) { ridingStep(ctx, stepTime); return game.ship.soi === 'moon'; },
    },
  ];
}
