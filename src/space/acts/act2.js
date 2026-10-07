// Act 2 - The Moon: capture, land, walk (silicon sample), take off, slingshot
// toward Mars. See missions.js for the step format.
import { BODIES, EVENTS } from '../contracts.js';
import { refuel } from '../physics.js';
import { wait, altitudeAbove, angleAround, askBeat, ensureStatsTracking, fuelSafetyNet, isCaptured, loadSurfaceScene } from './util.js';
import { t } from '../level.js';
import { satelliteRig } from '../satellite.js';

export function act2Steps(game) {
  // Never stranded on the Moon (playtest: after a wasted climb she fell back
  // with 0.2 t, and the general 15%-of-a-tank safety net can't lift her out).
  // Landed on the Moon without enough to leave: her robot melts more of the
  // Moon's polar ice. Story-true (the Moon has ice), and only while landed.
  let refilledAt = -Infinity;
  function moonIceRefill() {
    const sh = game.ship;
    if (sh.landedOn !== 'moon' || sh.fuel >= game.fuelCapacity * 0.45 || sh.t - refilledAt < 20) return;
    refilledAt = sh.t;
    refuel(sh, game.fuelCapacity, game.fuelCapacity);
    game.hud.toast(t('Your robot melted more Moon ice into fuel. Tank full!', 'Your robot made fuel from Moon ice. Tank full!'), { kind: 'good', ms: 3600 });
  }
  const { hud, shipView } = game;
  ensureStatsTracking(game);
  // The rescued satellite rides on her ship until she is in Moon orbit, then
  // goes off into its own Moon orbit (satellite.js's rig, shared with act1).
  const rig = satelliteRig(game);
  /** After the release (and after a reload): on its Moon orbit, from the save. */
  const satAfterRelease = () => rig.toMoonOrGone(game.missions?.saved?.satellite);

  let slingshotSeen = false;
  let moonLast = null; // a2_circle's lap counter
  let moonSwept = 0;
  game.bus.on(EVENTS.SLINGSHOT, (e) => { if (e.body === 'moon') slingshotSeen = true; });

  return [
    // ------------------------------------------------------------ ACT 2
    {
      id: 'a2_capture', act: 2,
      title: t('Get into Moon orbit', 'Get into Moon orbit'),
      objective: t('Goal: make your path a loop round the Moon. At your lowest point, point backwards (← / →, opposite to the way you are moving) and hold W until the dotted line closes into a circle.', 'Goal: go round the Moon. Turn to face the way you came (← →) and hold W until the dotted line is a circle.'),
      markers: ['moon'],
      aim: 'retrograde',
      capture: 'moon',
      async enter() {
        game.target = 'moon';
        rig.ensureAttached();
        await hud.showDialogue([
          { who: 'Mission Control', text: t('The Moon has you now. At your lowest point, burn backwards (against your motion) to drop into orbit.', 'The Moon has you now. Face the way you came and slow down to go around it.') },
          { who: 'girl', text: 'Slow and steady... here goes!' },
        ]);
      },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime); // its arrays still charging her tank
        fuelSafetyNet(game);
        if (game.ship.soi !== 'moon') return false;
        return isCaptured(game);
      },
      after() {
        // Braked straight down to the ground (critic): she has landed already,
        // so no "now land" line, and the satellite rides on until liftoff.
        if (game.ship.landedOn) return;
        // In Moon orbit: the satellite lifts off her ship and drifts out onto
        // its own orbit, where it can pass her messages back to Earth.
        if (rig.release()) {
          hud.toast(t('Satellite released into Moon orbit - it will relay your messages home!', 'Bye, satellite! It will go around the Moon and send your messages home!'), { kind: 'good', ms: 5000 });
        }
        hud.toast(t('Captured! You are in orbit round the Moon.', 'You are going round the Moon!'), { kind: 'good', ms: 4200 });
      },
    },
    // One whole loop round the Moon before the question and the landing
    // (lead 2026-10-07: make each goal clear - get in orbit, circle the
    // Moon, then point back and land).
    {
      id: 'a2_circle', act: 2,
      title: t('Circle the Moon', 'Circle the Moon'),
      objective: t('Goal: go once all the way round the Moon. No need to touch W: just watch the Moon turn below you.', 'Goal: go all the way round the Moon once. Just watch!'),
      markers: ['moon'],
      enter() { moonLast = null; moonSwept = 0; },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime);
        if (game.ship.landedOn) return true; // braked straight down already
        if (game.ship.soi !== 'moon') return false;
        const a = angleAround(game, 'moon', states);
        if (moonLast !== null) {
          let d = a - moonLast;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          moonSwept += d;
        }
        moonLast = a;
        return Math.abs(moonSwept) >= Math.PI * 2;
      },
      beat: 'moonOrbit',
      bonusBeats: ['dockingLights'],
      after() {
        if (game.ship.landedOn) return;
        hud.toast(t('Now land: point backwards and slow down. Keep your falling speed in the green.', 'Now land slowly! Keep the speed in the green.'), { kind: 'good', ms: 4200 });
      },
    },
    {
      id: 'a2_land', act: 2,
      title: 'Land on the Moon',
      objective: t('Goal: land gently. Point backwards (against your motion, ← / →) and hold W to slow down, then keep your falling speed in the green. Legs are down.', 'Goal: land softly. Turn to face backwards (← →) and hold W to slow down.'),
      markers: ['moon'],
      aim: 'retrograde',
      land: 'moon',
      enter() { shipView.setLegs(true); satAfterRelease(); },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime);
        fuelSafetyNet(game);
        return game.ship.landedOn === 'moon';
      },
      after() { hud.toast(t('Touchdown! Climb down and take a look around.', 'You landed! Climb down and look around.'), { kind: 'good', ms: 3200 }); },
    },
    {
      id: 'a2_surface', act: 2,
      title: 'Explore the Moon',
      objective: t('Walk the surface, jump in the low gravity, and collect a rock sample.', 'Walk, jump high, and pick up a Moon rock.'),
      markers: ['moon'],
      async enter() {
        const scene = await loadSurfaceScene(game, { body: 'moon', onBeat: (beat) => askBeat(game, beat) });

        if (scene) {
          await game.runScene(scene);
        } else {
          await hud.showFact({ title: 'Moon walk coming soon', body: 'The low-gravity walk is still being built. For now, here is what you found out there.' });
          await askBeat(game, 'moonWalk');
          await askBeat(game, 'moonSample');
          await askBeat(game, 'moonFootprints');
        }

        if (!game.samples.includes('Moon regolith sample')) game.samples.push('Moon regolith sample');
        refuel(game.ship, 2, game.fuelCapacity);
        hud.toast(t('Your robot melted Moon ice into fuel!', 'Your robot made fuel from Moon ice!'), { kind: 'good', ms: 3600 });
      },
    },
    {
      id: 'a2_liftoff', act: 2,
      title: 'Blast off',
      objective: t('Your ship is standing upright. Hold W to lift straight off the Moon.', 'Hold W to take off!'),
      markers: ['moon'],
      aim: 'up',
      escape: true,
      enter() { satAfterRelease(); },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime);
        fuelSafetyNet(game);
        moonIceRefill();
        // Clear of the ground, then the next step turns her along her path.
        return !game.ship.landedOn && altitudeAbove(game, 'moon', states, BODIES.moon.radius) > 1.5;
      },
      after() {
        // Still riding (she landed straight from the capture): it goes off
        // into Moon orbit now, in the normal view - she is busy climbing.
        if (rig.attached && rig.release({ camera: false })) {
          hud.toast(t('Satellite released into Moon orbit - it will relay your messages home!', 'Bye, satellite! It will go around the Moon and send your messages home!'), { kind: 'good', ms: 5000 });
        }
      },
    },
    {
      id: 'a2_slingshot', act: 2,
      title: t('Leave Earth behind', 'Leave Earth behind'),
      objective: t('Goal: fly out of Earth’s pull, toward Mars. Follow the arrow (the way the Moon is moving) and hold W. Going the way you are already moving saves fuel.', 'Goal: fly away from Earth, toward Mars. Follow the arrow and hold W.'),
      markers: ['mars'],
      // Lead playtest: 'target' pointed her straight at Mars (not how orbits
      // work), and 'prograde' straight after liftoff is straight UP, which
      // cost 3.7x the fuel. 'with-body' = the way the Moon travels, then (in
      // Earth's pull) the way Earth travels round the Sun: outward to Mars.
      aim: 'with-body',
      escape: true,
      enter() { game.target = 'mars'; slingshotSeen = false; satAfterRelease(); },
      check(ctx, states, stepTime) {
        rig.frame(ctx, stepTime);
        fuelSafetyNet(game);
        moonIceRefill();
        if (slingshotSeen) return true;
        return game.ship.soi === 'sun';
      },
      beat: 'moonEscape',
    },
    {
      id: 'a2_coast', act: 2,
      title: t('Catch the Mars window', 'Head for Mars'),
      objective: t('Mars moves too! Use time warp (1-4) until the banner says BURN NOW, then point along your path and hold W until your dotted line reaches Mars.', 'Wait for the green BURN NOW sign (keys 1 to 4 make time go fast). Then hold W until your dotted line reaches Mars.'),
      markers: ['mars'],
      aim: 'prograde',
      transfer: 'mars',
      // Far from the Moon now: the satellite stays behind in its orbit.
      enter() { game.target = 'mars'; rig.hide(); },
      check() {
        fuelSafetyNet(game);
        // Done when her path actually meets Mars (or she's already there).
        const c = game.prediction?.closest;
        return game.ship.soi === 'mars' || (!!c && c.body === 'mars' && c.dist < BODIES.mars.soi * 0.6);
      },
    },
  ];
}
