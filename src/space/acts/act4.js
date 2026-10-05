// Act 4 - Jupiter: why it matters, the radiation zone, and the big slingshot
// into Europa orbit. See missions.js for the step format.
import { BODIES } from '../contracts.js';
import { altitudeAbove, captureScale, ensureStatsTracking, fuelSafetyNet, isCaptured } from './util.js';
import { createRadiationGuard } from './guidance.js';
import { t } from '../level.js';

export function act4Steps(game) {
  const { hud } = game;
  ensureStatsTracking(game);
  const radiation = createRadiationGuard(game);

  return [
    // ------------------------------------------------------------ ACT 4
    {
      id: 'a4_approach', act: 4,
      title: 'Approach Jupiter',
      objective: t('Coast to Jupiter. Time warp helps on the long coast. If the banner asks for a small burn, it’s fine-tuning your path.', 'Fly to Jupiter and wait. Keys 1 to 4 make time go fast.'),
      markers: ['jupiter'],
      // Playtest: a slightly-off transfer arrived 6,000 u out, just outside
      // Jupiter's pull, with nothing to correct it. The planner cue stays on
      // during the coast and offers a small correction burn if she'd miss.
      transfer: 'jupiter',
      aim: 'prograde',
      enter() { game.target = 'jupiter'; },
      check(ctx, states) {
        fuelSafetyNet(game);
        radiation.tick(states);
        return game.ship.soi === 'jupiter' || altitudeAbove(game, 'jupiter', states, BODIES.jupiter.radius) <= 1500 * captureScale(game);
      },
      beat: 'jupiterApproach',
    },
    {
      id: 'a4_importance', act: 4,
      title: 'Why Jupiter matters',
      objective: t('Read up on the giant planet.', 'Learn about Jupiter.'),
      async enter() {
        await hud.showFact({
          title: 'The guardian giant',
          body: t('Jupiter is more than twice as heavy as every other planet put together. '
            + 'Its huge gravity flings comets aside, shepherds the asteroid belt, and wraps the planet in deadly radiation.',
            'Jupiter is the biggest planet of all. Its strong pull grabs comets. It pushes rocks around.'),
        });
      },
      beat: 'jupiterImportance',
    },
    {
      id: 'a4_radiation_warning', act: 4,
      title: t('Danger: radiation zone', 'Danger: radiation!'),
      objective: t('Between here and the inner moons is a belt of deadly radiation. Build a Radiation Shield before flying in close.', 'Jupiter has bad rays close in. Your Radiation Shield keeps you safe.'),
      markers: ['jupiter'],
      enter() {
        // Already built (play-test: the warning said "you will need" anyway).
        if (game.radiationShield) hud.toast(t('Radiation zone ahead around Jupiter. Good thing your Radiation Shield is on!', 'Jupiter has bad rays. Your Radiation Shield keeps you safe!'), { kind: 'info', ms: 5200 });
        else hud.toast(t('Warning: a radiation zone surrounds Jupiter. You will need a Radiation Shield before diving in close for a slingshot.', 'Careful! There are bad rays close to Jupiter. You need a Radiation Shield.'), { kind: 'warn', ms: 5200 });
      },
    },
    {
      id: 'a4_moons', act: 4,
      title: "Jupiter's moons",
      objective: t('Io, Europa and Ganymede swing around Jupiter in a steady dance.', 'Three moons go around Jupiter like dancers.'),
      markers: ['io', 'europa', 'ganymede'],
      enter() { game.target = 'europa'; },
      check(ctx, states) {
        fuelSafetyNet(game);
        radiation.tick(states);
        return game.ship.soi === 'jupiter';
      },
      beat: 'jupiterMoons',
      bonusBeats: ['moonDance'],
    },
    {
      // Lead playtest: going straight from a fast Jupiter flyby to Europa in
      // one burn was too hard (the planner itself flip-flopped). Like at the
      // Moon: first let Jupiter catch her, then a timed burn to Europa.
      id: 'a4_jupiter_orbit', act: 4,
      title: t('Let Jupiter catch you', 'Go around Jupiter'),
      objective: t('Brake at your lowest point (follow the banner) so Jupiter’s gravity catches you in orbit. Your Radiation Shield keeps you safe close in.', 'Slow down when the sign says, so Jupiter catches you.'),
      markers: ['jupiter'],
      aim: 'retrograde',
      capture: 'jupiter',
      enter() { game.target = 'europa'; },
      check(ctx, states) {
        fuelSafetyNet(game);
        radiation.tick(states);
        return game.ship.soi === 'jupiter' && isCaptured(game);
      },
      after() { hud.toast(t('Jupiter has you! Now wait for the burn window to Europa.', 'You’re going around Jupiter! Now wait for the sign to go to Europa.'), { kind: 'good', ms: 3600 }); },
    },
    {
      id: 'a4_europa_orbit', act: 4,
      title: t('Capture into Europa orbit', 'Go around Europa'),
      objective: t('Swing close past Jupiter for a gravity-assist boost (Radiation Shield required), then steer into a loop around Europa.', 'Fly to Europa and go around it. Follow the signs.'),
      markers: ['europa'],
      aim: 'retrograde',
      // Inside Jupiter's pull: a timed transfer to Europa (the burn banner),
      // then, inside Europa's pull, the capture cue.
      transfer: 'europa',
      capture: 'europa',
      enter() { game.target = 'europa'; },
      check(ctx, states) {
        fuelSafetyNet(game);
        radiation.tick(states);
        if (game.ship.soi !== 'europa') return false;
        return isCaptured(game);
      },
      beat: 'europaOrbit',
      after() { hud.toast(t('Landing clearance granted. Legs down. Slow and gentle.', 'Time to land. Slow and gentle!'), { kind: 'good', ms: 3600 }); },
    },
  ];
}
