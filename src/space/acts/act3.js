// Act 3 - Mars flyby and the asteroid belt: scan, mine ore/ice, sample all
// three kinds, visit Ceres, and build Big Solar Wings before Jupiter.
// See missions.js for the step format.
import { BELT, BODIES, SHIP, SOLAR, UPGRADES } from '../contracts.js';
import { solarPower } from '../physics.js';
import { wait, altitudeAbove, captureScale, canAfford, ensureStatsTracking, fuelSafetyNet, hasUpgrade, offerUpgrades } from './util.js';
import { createMiningController } from './mining.js';
import { t } from '../level.js';

export function act3Steps(game) {
  const { hud } = game;
  // Getting INTO the belt is a ring target: any path that reaches its middle
  // counts. (Playtest: aiming at Ceres meant waiting 8,500 s for Ceres to
  // come round, though her orbit already nearly touched the belt.)
  const beltMid = (BELT.inner + BELT.outer) / 2;
  game.customTargets = game.customTargets || {};
  game.customTargets.belt = {
    name: 'the asteroid belt', parent: 'sun', ring: beltMid, orbit: beltMid,
    period: 2 * Math.PI * Math.sqrt(beltMid ** 3 / BODIES.sun.gm),
    radius: 0, soi: (BELT.outer - BELT.inner) * 0.3,
  };
  ensureStatsTracking(game);
  const mining = createMiningController(game);
  // The lead wires this into missions.js's `extraMarkers(camera, origin, w, h)`
  // hook (main.js already calls it if present) so belt-rock HUD markers
  // follow the flying mode's rockMarkers setting (all/scanner/pulse).
  game.getMiningMarkers = (camera, origin, w, h) => mining.extraMarkers(camera, origin, w, h);
  // The mined tally on the right (main.js passes it to hud.update), null off the belt.
  game.getMiningTally = () => mining.tallyState();

  // check() gets stepTime (time since the CURRENT step began, resets every
  // step transition), not a raw per-frame dt - so the mining controller
  // (which must keep ticking smoothly across several steps) times itself
  // off game.ship.t instead, which is monotonic for as long as physics runs.
  let lastShipT = null;
  function tickMining() {
    const t = game.ship.t;
    const dt = lastShipT === null ? 0 : Math.max(0, Math.min(0.5, t - lastShipT));
    lastShipT = t;
    mining.tick(dt);
  }

  let offering = false;
  let lastOfferAt = 0;
  let shieldNagAt = -Infinity;
  let fuelOfferAt = -Infinity;
  let fuelOfferDeclined = false;
  async function offerBuildLoop() {
    if (offering) return;
    offering = true;
    const id = await offerUpgrades(game, { includeMelt: true });
    offering = false;
    return id;
  }
  // The Upgrade bay button in the tally, or U (lead: after mining with a full
  // hold there was no way to open it). Any belt step, if no card is up.
  game.bus.on('upgrade-bay-request', () => {
    if (offering || hud.isModalOpen() || game.activeScene || !mining.tallyState()) return;
    offerBuildLoop();
  });

  return [
    // ------------------------------------------------------------ ACT 3
    {
      id: 'a3_mars_scan', act: 3,
      title: 'Scan Mars',
      objective: t('Coast to Mars (time warp is fine far out). The scan starts when Mars’s gravity takes hold.', 'Fly to Mars and wait. Keys 1 to 4 make time go fast.'),
      markers: ['mars'],
      // Keeps the Mars banner going. Level 1 playtest: the extra-long dotted
      // line showed a Mars pass far in the future, the previous step ended,
      // and with no transfer target here she drifted with no guidance.
      transfer: 'mars',
      enter() { game.target = 'mars'; },
      check(ctx, states) {
        fuelSafetyNet(game);
        // Inside Mars's gravity zone is close enough to scan: a flyby, not a landing.
        return game.ship.soi === 'mars' || altitudeAbove(game, 'mars', states, BODIES.mars.radius) <= 250 * captureScale(game);
      },
      beat: 'marsScan',
      bonusBeats: ['marsCraters'],
      after() { game.target = 'ceres'; hud.toast('Next stop: the asteroid belt.', { kind: 'info', ms: 3000 }); },
    },
    {
      id: 'a3_power', act: 3,
      title: t('Watch your power', 'Out to the belt'),
      objective: t('Head out to the asteroid belt: wait for the BURN NOW banner, then hold W until your dotted line reaches the belt. Watch your Power meter drop as you go.', 'Next: the asteroid belt! Wait for BURN NOW, then hold W. Watch your Power go down as you fly away from the Sun.'),
      markers: ['ceres'],
      // Lead playtest: this used to be "coast outward" with the arrow on
      // Ceres, but after the Mars flyby her orbit doesn't reach the belt and
      // Mars itself gets 43% sunlight, so the < 40% check never fired. Now the
      // transfer to Ceres carries her outward and the power drops on the way.
      aim: 'prograde',
      transfer: 'belt',
      enter() { game.target = 'ceres'; },
      check() {
        fuelSafetyNet(game);
        const frac = solarPower(game.ship.x, game.ship.z, 1) / SOLAR.panelPowerAtEarth;
        return frac < 0.4;
      },
      beat: 'powerDropping',
    },
    {
      id: 'a3_enter_belt', act: 3,
      title: 'Enter the asteroid belt',
      objective: t('Coast into the belt (time warp is fine). The rocks are far apart out here - you can fly straight through.', 'Fly into the asteroid belt and wait.'),
      markers: ['ceres'],
      transfer: 'belt',
      check() {
        fuelSafetyNet(game);
        return game.belt.isInBelt(game.ship.x, game.ship.z);
      },
      beat: 'enterBelt',
      bonusBeats: ['beltCatalogue'],
      after() { hud.toast(t('Get close to a rock and press E to reach out with your claw (Z and X nudge you left and right to line up). Stay near the inner edge of the belt (closest to Mars) where your panels get the most power.', 'Fly close to a rock and press E to grab it with your claw! Z and X nudge you left and right.'), { kind: 'good', ms: 5200 }); },
    },
    {
      id: 'a3_mining', act: 3,
      bonusBeats: ['miningScore'],
      title: 'Mine the belt',
      objective: t('Mine a stony, a metal and an icy rock (get close, press E, hold on).', 'Grab 3 rocks: a stony one, a metal one and an icy one. Fly close and press E.'),
      markers: ['ceres'],
      check() {
        fuelSafetyNet(game);
        tickMining();
        return mining.allSampled;
      },
      after() { game.target = 'ceres'; hud.toast('Samples complete! On to Ceres.', { kind: 'good', ms: 3200 }); },
    },
    {
      id: 'a3_ceres', act: 3,
      title: 'Visit Ceres',
      objective: t('Point your telescope at Ceres, the biggest object in the belt (the marker shows where it is).', 'Look at Ceres, the biggest rock in the belt.'),
      markers: ['ceres'],
      // Lead playtest: flying to Ceres was a second timed transfer from inside
      // the belt, often a 70 s warp wait, for a question about what Ceres IS.
      // A telescope scan from the belt teaches the same thing without the wait.
      async enter() {
        game.target = 'ceres';
        hud.toast(t('Telescope locked on Ceres... scanning.', 'Looking at Ceres...'), { kind: 'info', ms: 2600 });
        await wait(2600);
        await hud.showFact({
          title: 'Ceres, the dwarf planet',
          body: t('Ceres is round and about 940 km across (as wide as Texas), the biggest object in the asteroid belt. ' +
            'Scientists have spotted bright salty patches on it, left behind by water that seeped up from inside.',
            'Ceres is round. It is the biggest rock in the asteroid belt. It has shiny salt spots. Water from inside made them.'),
        });
      },
      check() {
        fuelSafetyNet(game);
        tickMining(); // she can keep mining while she scans
        return true;
      },
      beat: 'ceresScan',
      after() { if (!game.samples.includes('Ceres salt sample')) game.samples.push('Ceres salt sample'); },
    },
    {
      id: 'a3_build_wings', act: 3,
      title: 'Build Big Solar Wings',
      objective: t('At Jupiter, sunlight is 1/25 as strong. Open the upgrade bay (press U, or the button under Mined) and build Big Solar Wings (4 silicon, 2 metal). Mine more in the belt if you need to.', 'Jupiter is far from the Sun, so the sunlight there is weak. Press U and build Big Solar Wings. Grab more rocks if you need them.'),
      markers: ['ceres'],
      async enter() { lastOfferAt = 0; await offerBuildLoop(); },
      check(ctx, states, stepTime) {
        fuelSafetyNet(game);
        tickMining();
        if (hasUpgrade(game, 'bigSolarWings')) return true;
        if (!offering && stepTime - lastOfferAt > 9) { lastOfferAt = stepTime; offerBuildLoop(); }
        return false;
      },
      beat: 'buildSolarWings',
      after() { game.target = 'jupiter'; hud.toast(t('Solar wings deployed. Set course for Jupiter!', 'Big wings open! Next stop: Jupiter!'), { kind: 'good', ms: 3600 }); },
    },
    {
      id: 'a3_depart', act: 3,
      title: t('Depart for Jupiter', 'Off to Jupiter'),
      objective: t('Jupiter moves too! Use time warp until the banner says BURN NOW, then hold W until your dotted line reaches Jupiter. (You need a Radiation Shield first: 4 metal, 2 ice.)', 'First build a Radiation Shield. Then wait for BURN NOW and hold W until your dotted line reaches Jupiter.'),
      markers: ['jupiter'],
      aim: 'prograde',
      transfer: 'jupiter',
      enter() { game.target = 'jupiter'; shieldNagAt = -Infinity; fuelOfferAt = -Infinity; fuelOfferDeclined = false; },
      check(ctx, states, stepTime) {
        fuelSafetyNet(game);
        tickMining(); // she can still top up in the belt before she goes
        // No burn window until the shield is built: she can't leave without
        // it, and the window kept changing while she flew from rock to rock
        // for metal and ice (2026-10-05 lab: plan jumps of 400-4,000 s).
        game.transferTarget = hasUpgrade(game, 'radiationShield') ? 'jupiter' : null;
        // Medium playtest: flying to each rock by hand spent most of the tank,
        // and she left the belt with 0.8 t and 3.5 ice she had no way to use
        // (the bay only opened for the upgrades). Offer to melt ice while she
        // is low and still here (also while she mines for the shield, keeping
        // 2 ice for it); stop asking once she says "Not now".
        if (!offering && !fuelOfferDeclined && game.ship.soi === 'sun' && game.ship.fuel < game.fuelCapacity * 0.5 &&
            (game.resources.ice || 0) - (hasUpgrade(game, 'radiationShield') ? 0 : 2) >= 1 && stepTime - fuelOfferAt > 4) {
          fuelOfferAt = stepTime;
          offering = true;
          hud.toast(t('Fuel is low for the long trip to Jupiter. Melt some of your ice into fuel!', 'Fuel is low. Turn some ice into fuel!'), { kind: 'warn', ms: 4200 });
          offerUpgrades(game, { includeMelt: true })
            .then((id) => { if (id !== 'meltIce') fuelOfferDeclined = true; })
            .finally(() => { offering = false; });
        }
        // Playtest: without enough for the Radiation Shield she only found out
        // at Jupiter, a whole transfer away from the belt's metal and ice.
        // Build it (or mine for it) here, before she leaves.
        if (!hasUpgrade(game, 'radiationShield')) {
          if (!offering && stepTime - shieldNagAt > 9) {
            shieldNagAt = stepTime;
            if (canAfford(game.resources, UPGRADES.radiationShield.cost)) {
              offering = true;
              offerUpgrades(game, { includeMelt: true }).finally(() => { offering = false; });
            } else if (game.ship.cargo >= SHIP.cargoMax - 0.3 && (game.resources.ice || 0) >= 3) {
              // Hard playtest: a hold full of ice and 3.8 of the 4 metal. She
              // couldn't mine more and nothing opened the bay (fuel wasn't
              // low), so "mine some more rocks" repeated forever. Melting ice
              // makes room.
              offering = true;
              hud.toast(t('Your cargo hold is full! Melt some ice into fuel to make room, then mine a metal rock.', 'Your ship is full! Turn some ice into fuel to make room. Then grab a metal rock.'), { kind: 'warn', ms: 5200 });
              offerUpgrades(game, { includeMelt: true }).finally(() => { offering = false; });
            } else {
              hud.toast(t('Before you leave the belt: Jupiter’s radiation needs a Radiation Shield (4 metal, 2 ice). Mine some more rocks.', 'You need a Radiation Shield for Jupiter. Grab more metal and ice rocks.'), { kind: 'warn', ms: 5200 });
            }
          }
          return false;
        }
        const c = game.prediction?.closest;
        return game.ship.soi === 'jupiter' || (!!c && c.body === 'jupiter' && !c.retro && c.dist < BODIES.jupiter.soi * 0.6);
      },
    },
  ];
}
