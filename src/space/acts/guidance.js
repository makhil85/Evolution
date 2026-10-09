// Act 4 helper: Jupiter's radiation zone is a hard gate on the close pass a
// Jupiter slingshot needs (SHIP must dip well inside RADIATION.outer for a
// meaningful gravity assist - see CHAPTER4_PLAN.md and contracts.js's
// RADIATION/UPGRADES). Without the shield she is gently walled out.
import { RADIATION, UPGRADES } from '../contracts.js';
import { hasUpgrade, applyUpgrade, canAfford } from './util.js';
import { t } from '../level.js';

/** One instance lives for the whole of Act 4 (and is safe to keep calling
 * into Act 5, though Europa's own orbit at 700u sits outside the zone). */
export function createRadiationGuard(game) {
  let warned = false;
  let offering = false;

  async function offerShield() {
    if (offering) return;
    offering = true;
    try {
      if (canAfford(game.resources, UPGRADES.radiationShield.cost)) {
        const id = await game.hud.openUpgrades({
          upgrades: { radiationShield: UPGRADES.radiationShield },
          resources: game.resources,
        });
        if (id === 'radiationShield') {
          applyUpgrade(game, id);
          game.hud.toast(t('Radiation Shield built! You can fly in safely now.', 'Radiation Shield built! Now you are safe.'), { kind: 'good' });
        }
      } else {
        game.hud.toast(t('You need more metal and ice for a Radiation Shield. Head back to the belt to mine some.', 'You need more metal and ice for a Radiation Shield. Go back and mine.'), { kind: 'warn' });
      }
    } finally {
      offering = false;
    }
  }

  /** Call every frame from whichever step is active near Jupiter. */
  function tick(states) {
    const j = states.jupiter;
    if (!j) return;
    const ship = game.ship;
    const dx = ship.x - j.x;
    const dz = ship.z - j.z;
    const dist = Math.hypot(dx, dz);
    if (dist < RADIATION.inner || dist > RADIATION.outer) { warned = false; return; }
    if (hasUpgrade(game, 'radiationShield')) return;

    // Gentle push-back: kill inward speed and nudge her to just outside the
    // outer edge, so she can try again once shielded rather than being
    // stuck mid-zone.
    const nx = dx / (dist || 1);
    const nz = dz / (dist || 1);
    // Bounce off relative to JUPITER. Lead playtest: this used her velocity
    // relative to the Sun (which includes Jupiter's own ~17 u/s), so every
    // bounce added huge speed and flung her out of the solar system.
    const rvx = ship.vx - (j.vx || 0);
    const rvz = ship.vz - (j.vz || 0);
    const vr = rvx * nx + rvz * nz;
    if (vr < 0) {
      ship.vx -= vr * nx * 2;
      ship.vz -= vr * nz * 2;
    }
    const edge = RADIATION.outer + 4;
    ship.x = j.x + nx * edge;
    ship.z = j.z + nz * edge;

    if (!warned) {
      warned = true;
      game.hud.toast(t('Radiation zone! Your ship was pushed back - build a Radiation Shield before flying this close to Jupiter.', 'Danger, radiation! You need a Radiation Shield to go this close.'), { kind: 'warn' });
      offerShield();
    }
  }

  return { tick };
}
