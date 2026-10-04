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
import { lessonStep } from '../lesson/transferLesson.js';

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
    label: 'Satellite',
    screenX: sx, screenY: sy, onScreen, distance: dist, kind: 'target',
  };
}

export function act1Steps(game) {
  const { hud, shipView } = game;

  // Lap counter for "ride one full orbit".
  let lapLast = null;
  let lapSwept = 0;

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
          { who: 'Mission Control', text: 'Clean separation! You are in orbit around Earth.' },
          { who: 'girl', text: 'Whoa. I can see the whole Atlantic Ocean!' },
          { who: 'Mission Control', text: 'You have left the air behind. Watch your wings.' },
        ]);
        shipView.setWingsFolded(true);
        await wait(2600);
      },
      beat: 'wingsFolded',
      after() { hud.toast(t('Wings folded. Thrusters online. A and D turn the ship.', 'Wings folded away! Press A and D to turn.'), { kind: 'good', ms: 3500 }); },
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
          body: t(`${heroName()}'s pencil drifts past her nose and a drop of water wobbles like jelly. ` +
            'But up here, Earth’s gravity is still almost as strong as on the ground...',
            `${heroName()}'s pencil floats past her nose. A drop of water wobbles like jelly!`),
        });
      },
      beat: 'cabinFloat',
    },
    {
      id: 'a1_orbit', act: 1,
      title: 'Your first orbit',
      objective: t('Ride one full lap around Earth. Don’t fire the engine; just watch the dotted line.', 'Go all the way around Earth once. Don’t press W. Just watch the dotted line.'),
      markers: ['earth'],
      enter() { lapLast = null; lapSwept = 0; game.target = 'moon'; },
      check(ctx, states) {
        if (game.ship.soi !== 'earth') return false;
        const a = angleAround(game, 'earth', states);
        if (lapLast !== null) {
          let d = a - lapLast;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          lapSwept += d;
        }
        lapLast = a;
        return Math.abs(lapSwept) >= Math.PI * 2;
      },
      beat: 'firstOrbit',
    },
    {
      id: 'a1_satellite_meet', act: 1,
      title: 'Catch the satellite',
      objective: t('A weather satellite is in a slightly higher orbit. Wait for the BURN NOW banner, then hold W to rise up to meet it.', 'A satellite is just above you. When the green BURN NOW sign shows, hold W to go up to it.'),
      aim: 'prograde',
      transfer: 'satellite',
      enter(ctx) {
        ctx.customTargets = ctx.customTargets || {};
        ctx.customTargets.satellite = satelliteTarget(ctx);
        puzzleTriggered = false;
        puzzleDone = false;
        rig.toFree();
        showMarker(ctx);
        hud.toast(t('A weather satellite! One of its solar wings has gone dark. Catch up with it.', 'A satellite! One of its wings is broken. Let’s go and fix it!'), { kind: 'info', ms: 4200 });
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
          hud.toast(t('Docking thrusters on! Matching its speed... creeping closer...', 'Slowly... slowly... getting closer!'), { kind: 'info', ms: 3600 });
        }
        return rig.docked;
      },
      beat: 'satelliteMet',
      after() {
        hud.toast(t('Docked alongside! Press E to take control of its broken wing.', 'You caught it! Press E to fix the broken wing.'), { kind: 'good', ms: 4200 });
      },
    },
    {
      id: 'a1_satellite_fix', act: 1,
      title: 'Fix the dead wing',
      objective: t('Press E, then hold A / D to turn the broken panel until it faces the Sun.', 'Press E. Then hold A or D to turn the wing to face the Sun.'),
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
    // Flight school (lead 2026-10-02): animated films on how a transfer
    // works, with a question after each, before she flies it for real.
    lessonStep(game),
    {
      id: 'a1_raise', act: 1,
      title: 'Aim for the Moon',
      objective: t('Point along your path. Wait for the green BURN signal, then hold W until the dotted line reaches the Moon.', 'Wait for the green BURN NOW sign. Then hold W until the dotted line reaches the Moon.'),
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
      after() { hud.toast(t('Your path reaches the Moon! Coast there. Use time warp (1 to 4) when you are far from Earth.', 'Your path reaches the Moon! Now wait. Keys 1 to 4 make time go fast.'), { kind: 'good', ms: 4500 }); },
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
