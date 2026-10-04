// Turns quest WorldEffects into things that happen in the scene.
//
// The quest engine deliberately never touches the scene graph - it emits
// effects and this module subscribes. That seam is what let the quest logic be
// built and tested headlessly while the scene was built separately.
//
// The signature move, taken straight from Level 2: solving a question does not
// just tick a box, it ASSEMBLES A BUILDING piece by piece in front of the
// child, one piece every PIECE_INTERVAL_MS.
import { refreshStaticShadows } from './toonPipeline.js';
import { audio } from './audio.js';

/** Level 2 reveals a structure piece every 330 ms. Keeping the same cadence. */
export const PIECE_INTERVAL_MS = 330;

/**
 * @param {object} deps
 * @param {Map<string, import('./contracts.js').Structure>} deps.structures
 * @param {object} deps.village
 * @param {object} deps.sun          light whose static shadow map needs refreshing
 * @param {(msg:string)=>void} [deps.toast]
 */
export function createEffectRunner({ structures, village, sun, toast = () => {} }) {
  /** @type {Array<{tick:()=>boolean}>} */
  const running = [];

  /**
   * Some targets own conditional visibility - the goal hologram must stay up
   * until the real rocket body exists, so it cannot simply have .visible
   * assigned from outside. Give a target the final say when it asks for it.
   */
  function revealTarget(target, visible) {
    if (typeof target.reveal === 'function') target.reveal(visible);
    else target.group.visible = visible;
  }

  function targetFor(id) {
    if (structures.has(id)) return structures.get(id);
    if (village.bridgeStructures?.has(id)) return village.bridgeStructures.get(id);
    if (id === 'bridge' && village.bridgeStructure) return village.bridgeStructure;
    return null;
  }

  /** Reveal `pieces` of a structure over time, one at a time. */
  function animateBuild(target, pieces) {
    if (!target) return;
    const total = Math.min(pieces ?? target.pieceCount, target.pieceCount);
    const startedAt = performance.now();
    let shown = 0;
    running.push({
      tick() {
        // Reveal by ELAPSED TIME, not one piece per tick. A backgrounded tab
        // throttles requestAnimationFrame to ~1 Hz; ticking one piece per frame
        // left builds frozen half-finished until the tab was focused again.
        // Deriving the count from the clock makes the build finish correctly at
        // any frame rate, and simply catch up if frames were dropped.
        const due = Math.min(total, Math.floor((performance.now() - startedAt) / PIECE_INTERVAL_MS) + 1);
        if (due > shown) {
          // The bridge is timber; everything else is masonry and machinery.
          if (String(target.id).includes('bridge')) audio.plank();
          else audio.buildPiece(shown);
          shown = due;
          target.showPieces(shown);
          if (shown >= total) audio.buildComplete();
          // A new caster appeared, so the frozen shadow map is now stale.
          refreshStaticShadows(sun);
        }
        return shown >= total;
      },
    });
  }

  /** Apply an effect with no animation - used when restoring a save. */
  function applyInstant(effect) {
    const target = targetFor(effect.targetId);
    if (!target) return;
    if (effect.kind === 'build') target.showPieces(effect.pieces ?? target.pieceCount);
    if (effect.kind === 'reveal') revealTarget(target, effect.visible !== false);
  }

  return {
    /** Drive any in-flight piece-by-piece builds. Call once per frame. */
    update() {
      for (let i = running.length - 1; i >= 0; i--) {
        if (running[i].tick()) running.splice(i, 1);
      }
    },

    /** Handle one live effect from the quest engine. */
    handle(effect) {
      switch (effect.kind) {
        case 'build': {
          const target = targetFor(effect.targetId);
          if (target) {
            animateBuild(target, effect.pieces);
            toast(`${target.label || effect.targetId} is being built!`);
          }
          break;
        }
        case 'reveal': {
          const target = targetFor(effect.targetId);
          if (target) revealTarget(target, effect.visible !== false);
          break;
        }
        case 'unlock':
        case 'spawn':
          // Handled by the caller: unlocking changes walkability, spawning adds
          // resource nodes. Both are scene-owner concerns, not structure ones.
          break;
        default:
          break;
      }
    },

    applyInstant,
    get busy() { return running.length > 0; },
  };
}

/**
 * Restore the world to match a part-finished save, with no animation.
 * Anything a completed step built is simply already standing.
 */
export function restoreWorld(runner, chain, isComplete) {
  for (const step of chain) {
    if (!isComplete(step.id)) continue;
    for (const effect of step.effects || []) runner.applyInstant(effect);
  }
}
