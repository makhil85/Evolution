// Small helpers shared by the act files (Acts 2-5: Moon, Mars/belt, Jupiter, Europa).
import { BODIES, STORE_KEYS, UPGRADES, SOLAR, WARP_LEVELS } from '../contracts.js';
import { questionForBeat } from '../questions.space.js';
import { heroName } from '../hud/hud.js';
import { refuel, emergencyTopUp, orbitElements } from '../physics.js';
import { t } from '../level.js';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait while she orbits: `sec` REAL seconds (lead review, 2026-10-08: at x16-x64
 * warp a game-time wait passed in a blink). With `lap`, it is shorter if one
 * lap of her orbit takes less than that at her warp (lap: false, always `sec`).
 */
export function orbitFor(game, sec, { lap = true } = {}) {
  const sh = game.ship;
  const b = BODIES[sh.soi]; const st = game.states?.[sh.soi];
  // Game seconds per real second: the warp she has on (x1 when unset).
  const warp = WARP_LEVELS[game.warpIndex] || 1;
  let need = sec;
  if (lap && b && st) {
    // One lap of the orbit she is on (from its energy: a = -gm / 2E), in real seconds.
    const dx = sh.x - st.x; const dz = sh.z - st.z;
    const v2 = (sh.vx - st.vx) ** 2 + (sh.vz - st.vz) ** 2;
    const E = v2 / 2 - b.gm / Math.hypot(dx, dz);
    if (E < 0) { const a = -b.gm / (2 * E); need = Math.min(sec, 2 * Math.PI * Math.sqrt(a ** 3 / b.gm) / warp); }
  }
  const t0 = performance.now();
  return new Promise((done) => {
    const id = setInterval(() => { if ((performance.now() - t0) / 1000 >= need) { clearInterval(id); done(); } }, 250);
  });
}

/** Angle of the ship around a body, for "fly one full lap" goals. */
export function angleAround(game, bodyId, states) {
  const s = states[bodyId];
  return Math.atan2(game.ship.z - s.z, game.ship.x - s.x);
}

/** Distance from the ship to a body's SURFACE (u). */
export function altitudeAbove(game, bodyId, states, radius) {
  const s = states[bodyId];
  return Math.hypot(game.ship.x - s.x, game.ship.z - s.z) - radius;
}

/** game.mode.captureScale (FLIGHT_MODES, contracts.js), or 1 if the flying
 * mode isn't set yet. Every "close enough" flight goal multiplies its
 * distance tolerance by this. */
export function captureScale(game) {
  return game.mode?.captureScale ?? 1;
}

/**
 * Whether she has captured into orbit around the ship's current dominant
 * body, for goals like "burn until your path closes into a loop". A strict
 * bound (energy < 0) always counts; easier flying modes also forgive a
 * small sliver of positive (still nearly-bound) energy, scaled by
 * captureScale, so Easy/Medium don't demand a razor-precise capture burn.
 */
export function isCaptured(game) {
  // Already standing on it (she braked hard and came straight down gently):
  // caught, and the landing step after this one finishes at once. Without
  // this she was stuck on the capture step on the ground, and lifting off
  // brought back "your path hits the Moon".
  if (game.ship.landedOn) return true;
  // Lead playtest: the old energy margin accepted an UNBOUND path aimed into
  // the ground, so the "Captured!" question fired and then she crashed. A
  // capture is a closed loop whose lowest point clears the surface.
  const oe = orbitElements(game.ship);
  const body = BODIES[oe.body];
  if (!oe.bound || !body) return false;
  // ...and whose highest point stays well inside the body's gravity zone, or
  // a barely-bound loop carries her straight back out of the SOI.
  return oe.periapsis > body.radius * 1.08 && oe.apoapsis < body.soi * 0.7;
}

/**
 * The bank says "Zara"; the child hears her own name. Copied from
 * missions.js (not exported there) - see that file's header comment. Keep
 * these two copies in sync if the swap rule ever changes.
 */
export function personalise(q) {
  const name = heroName();
  if (!name || name === 'Zara') return q;
  const swap = (s) => (typeof s === 'string' ? s.replace(/\bZara(’s|'s)?\b/g, (m, poss) => (poss ? `${name}'s` : name)) : s);
  const out = { ...q };
  for (const k of ['prompt', 'hint', 'parentHint', 'success', 'doneMessage', 'title']) out[k] = swap(q[k]);
  if (Array.isArray(q.choices)) out.choices = q.choices.map((c) => ({ ...c, text: swap(c.text) }));
  return out;
}

/**
 * Ask the bank question tied to `beat` right now (mid-scene, not at a step
 * boundary - missions.js's own engine already handles step.beat questions;
 * this is for beats a surface scene or an in-flight system fires directly,
 * e.g. the Moon walk's moonWalk/moonSample/moonFootprints or the belt's
 * cargoHeavy/sampleCrates/beltFact). Applies the reward and doneMessage
 * toast exactly like missions.js's own `ask()`, minus the deferred/answered
 * save bookkeeping (these beats are not progression gates).
 *
 * In flight it waits until she has let go of the controls for a while
 * (missions.untilQuiet, the same gate as the step questions): a question
 * must never pop up while her hands are on the keys. On foot it asks at once.
 */
export async function askBeat(game, beat) {
  const q = questionForBeat(beat);
  if (!q) return { correct: true };
  // Hands-off first; the card itself waits its turn inside hud.askQuestion (modalQueue.js).
  await game.missions?.untilQuiet?.();
  const personal = personalise(q);
  const res = await game.hud.askQuestion(personal);
  if (res.correct) {
    if (q.reward?.resources) {
      for (const [k, v] of Object.entries(q.reward.resources)) game.resources[k] = (game.resources[k] || 0) + v;
    }
    if (personal.doneMessage) game.hud.toast(personal.doneMessage, { kind: 'good', ms: 4500 });
  }
  return res;
}

// --- upgrades ----------------------------------------------------------------

export function canAfford(resources, cost) {
  return Object.entries(cost || {}).every(([k, v]) => (resources?.[k] || 0) >= v);
}

/** A repeatable action offered alongside the real upgrades: not in contracts.js
 * (that table is the frozen shared contract) since it's not a permanent
 * ship upgrade, just a standing "convert ice to fuel" option. */
export const EXTRA_ACTIONS = Object.freeze({
  meltIce: { label: 'Melt ice into fuel (+1 t fuel)', cost: { ice: 1 }, required: null },
});

export function hasUpgrade(game, id) {
  return !!(game.upgradesOwned && game.upgradesOwned.has(id));
}

/** Deduct cost, mark owned (permanent upgrades only) and apply the effect. */
export function applyUpgrade(game, id) {
  const def = UPGRADES[id] || EXTRA_ACTIONS[id];
  if (!def) return false;
  if (id !== 'meltIce' && hasUpgrade(game, id)) return false; // already built
  if (!canAfford(game.resources, def.cost)) return false;
  for (const [k, v] of Object.entries(def.cost)) game.resources[k] -= v;
  // What she spends came out of her hold, so the ship gets lighter too
  // (the F = m a lesson: unload and it's lively again).
  const spent = Object.values(def.cost).reduce((t, v) => t + v, 0);
  game.ship.cargo = Math.max(0, game.ship.cargo - spent);

  if (id === 'meltIce') {
    refuel(game.ship, 1, game.fuelCapacity);
    game.bus?.emit('upgrade-built', id); // beltFx.js: the build effect
    return true;
  }

  game.upgradesOwned = game.upgradesOwned || new Set();
  game.upgradesOwned.add(id);
  if (id === 'bigSolarWings') {
    game.shipView.setSolarWings(1);
    game.solarMultiplier = SOLAR.bigWingsMultiplier;
  } else if (id === 'biggerTank') {
    game.fuelCapacity += 6;
  } else if (id === 'strongerClaw') {
    game.strongClaw = true;
  } else if (id === 'radiationShield') {
    game.radiationShield = true;
  }
  game.bus?.emit('upgrade-built', id); // beltFx.js: the build effect
  return true;
}

/** Open the upgrade bay (optionally with the ice-melt action mixed in) and
 * apply whatever she picks. Returns the id built, or null. */
export async function offerUpgrades(game, { includeMelt = true } = {}) {
  const upgrades = includeMelt ? { ...UPGRADES, ...EXTRA_ACTIONS } : { ...UPGRADES };
  const id = await game.hud.openUpgrades({ upgrades, resources: game.resources, owned: game.upgradesOwned });
  if (!id) return null;
  const ok = applyUpgrade(game, id);
  if (ok) {
    const def = upgrades[id];
    game.hud.toast(id === 'meltIce' ? def.label : t(`🎉 ${def.label} built!`, `🎉 Yay! ${def.label} built!`), { kind: 'good', ms: 3000 });
  } else {
    game.hud.toast(t('Not enough resources for that yet.', 'You need more rocks for that.'), { kind: 'warn', ms: 2500 });
  }
  return ok ? id : null;
}

// --- stats (for the Europa end card) ------------------------------------------

/** Idempotent: registers the slingshot-fuel-saved tracker once per session. */
export function ensureStatsTracking(game) {
  if (game._statsTracked) return;
  game._statsTracked = true;
  game.stats = { fuelSaved: 0 };
  game.bus.on('slingshot', (e) => { game.stats.fuelSaved += e.fuelSaved || 0; });
}

// --- never stuck ---------------------------------------------------------------

/** The "never stranded" rule: top up if she's flat empty. Safe to call every
 * frame - emergencyTopUp() itself is a no-op above zero fuel. */
export function fuelSafetyNet(game) {
  if (game.ship.fuel <= 0) {
    const given = emergencyTopUp(game.ship, game.fuelCapacity);
    if (given > 0) {
      game.hud.toast(t('Mission Control: emergency fuel transfer complete. You are not stranded!', 'Mission Control sent you more fuel!'), { kind: 'good', ms: 4200 });
    }
  }
}

// --- save flag -------------------------------------------------------------------

function difficulty() {
  try {
    const p = JSON.parse(localStorage.getItem('rocket_village_profile') || 'null');
    return p?.difficulty === 1 ? 1 : 4;
  } catch { return 4; }
}

/** Mark the chapter complete in the same save blob missions.js writes to.
 * See acts/act5.js's header comment: missions.js's own persist() should
 * ideally set this flag too (ask the lead), but writing it here works
 * today without touching a file this build doesn't own. */
export function markSaveComplete(game) {
  try {
    const key = STORE_KEYS[difficulty()];
    const save = JSON.parse(localStorage.getItem(key) || '{}') || {};
    save.complete = true;
    save.stats = {
      timeMinutes: Math.round((game.ship?.t || 0) / 60),
      fuelSaved: Math.round((game.stats?.fuelSaved || 0) * 10) / 10,
      samples: (game.samples || []).length,
    };
    localStorage.setItem(key, JSON.stringify(save));
  } catch { /* private mode */ }
}

// --- the surface scene (Moon / Europa), which may not exist yet ------------------

/**
 * Load surface.js's createSurfaceScene and build a scene, or null if the
 * file doesn't exist yet (another agent's part). A plain string literal
 * dynamic import of a missing file is a HARD build-time error under this
 * project's Vite (it resolves import() specifiers eagerly, @vite-ignore or
 * not, when the argument is a literal), so the path is built in a variable
 * - a non-literal specifier - which Vite's import-analysis leaves untouched
 * for the browser's own native import() to resolve at runtime, where a 404
 * is an ordinary promise rejection this try/catch can handle.
 */
export async function loadSurfaceScene(game, opts) {
  // Lead 2026-10-07: after touchdown the screen went blank for a few seconds
  // while the walk was built, and a child thought she had crashed. A big
  // "Landed!" card covers that, and stays a moment once the walk starts.
  const name = BODIES[opts?.body]?.name || 'the surface';
  const card = landedCard(t(`Landed on ${name}!`, `You landed on ${name}!`),
    t('A soft, safe touchdown. Climbing down the ladder...', 'Safe and soft! Climbing down...'));
  try {
    const path = '../surface.js';
    const mod = await import(/* @vite-ignore */ path);
    if (mod?.createSurfaceScene) {
      const scene = mod.createSurfaceScene(game, opts);
      scene.onFoot = true; // a walk (main.js resets warp after it)
      setTimeout(card.close, 1800);
      return scene;
    }
  } catch { /* surface.js not built yet */ }
  card.close();
  return null;
}

/** A full-screen "Landed!" card above everything (the HUD is busy changing over). */
function landedCard(title, text) {
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'status');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9500;display:grid;place-items:center;pointer-events:none;'
    + 'background:radial-gradient(circle at 50% 45%, rgba(10,14,24,.55), rgba(3,4,8,.92));transition:opacity .6s ease;';
  wrap.innerHTML = '<div style="text-align:center;padding:26px 40px;border-radius:20px;background:rgba(20,16,13,.9);'
    + 'border:2px solid #8fe86b;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:system-ui,sans-serif;color:#eef3ff;">'
    + '<div style="font-size:44px;line-height:1">\u2705</div>'
    + '<div data-t style="margin-top:10px;font-size:28px;font-weight:800;color:#b8f5a0"></div>'
    + '<div data-x style="margin-top:8px;font-size:16px;opacity:.9"></div></div>';
  wrap.querySelector('[data-t]').textContent = title;
  wrap.querySelector('[data-x]').textContent = text;
  document.body.appendChild(wrap);
  let closed = false;
  return {
    close() {
      if (closed) return;
      closed = true;
      wrap.style.opacity = '0';
      setTimeout(() => wrap.remove(), 650);
    },
  };
}

/** How many questions have been answered so far, read from the same save
 * blob missions.js persists (its `answered` array). Read-only. */
export function answeredCount() {
  try {
    const key = STORE_KEYS[difficulty()];
    const save = JSON.parse(localStorage.getItem(key) || '{}') || {};
    return Array.isArray(save.answered) ? save.answered.length : 0;
  } catch { return 0; }
}
