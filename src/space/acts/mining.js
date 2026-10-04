// Act 3 helper: the claw/mining interaction in the asteroid belt, plus the
// flying-mode-aware rock-marker search (FLIGHT_MODES.rockMarkers).
//
// A small controller (not a missions.js step by itself) that lives for the
// whole of Act 3: it listens for the 'interact' (E) key, extends the claw
// toward the nearest rock in range, mines it over ~2s, and files the
// resource/cargo/sample bookkeeping. act3.js's steps read its cumulative
// state (allSampled, cargo) in their `check()`s to decide when to fire the
// cargoHeavy/sampleCrates/beltFact beats and when to let her move on.
//
// POWER: with base panels solarPower() gives ~21 at the belt's inner edge
// and ~9 at its outer edge, and SOLAR.powerNeededForClaw is 8, so the claw
// works anywhere in the belt. The "not enough power" branch below still
// matters farther out (Jupiter gets ~3.7 before Big Solar Wings).
import * as THREE from 'three';
import { BELT, SHIP, SOLAR, UPGRADES } from '../contracts.js';
import { solarPower } from '../physics.js';
import { askBeat, captureScale, canAfford, hasUpgrade } from './util.js';
import { t } from '../level.js';

const MINE_SECONDS = 2.0;
/** The belt's steps: the only time the claw works and rocks are marked. */
const MINING_STEPS = new Set(['a3_enter_belt', 'a3_mining', 'a3_ceres', 'a3_build_wings', 'a3_depart']);
const MINE_RANGE = 3; // beyond the rock's own radius, before captureScale
const AMOUNT_PER_MINE = 1.4;
const PULSE_SECONDS = 6;

const KIND_TO_RESOURCE = { stony: 'silicon', metal: 'metal', icy: 'ice' };

export function createMiningController(game) {
  const { bus, belt, shipView, hud } = game;

  let miningId = null;
  let mineTimer = 0;
  const sampleCounts = { stony: 0, metal: 0, icy: 0 };
  let cargoHeavyAsked = false;
  let sampleCratesAsked = false;
  let beltFactAsked = false;
  let askingBeat = false;
  let pulseUntil = -Infinity; // game.ship.t timestamp the scanner pulse fades at

  function samplesNeeded() {
    return game.mode?.samplesPerKind || 1;
  }

  function power() {
    return solarPower(game.ship.x, game.ship.z, game.solarMultiplier);
  }

  function mineRange() {
    return MINE_RANGE * captureScale(game);
  }

  function nearestRock() {
    const ship = game.ship;
    let best = null;
    let bestDist = Infinity;
    for (const r of belt.nearRocks) {
      const d = Math.hypot(ship.x - r.x, ship.z - r.z) - r.radius;
      if (d < bestDist) { bestDist = d; best = r; }
    }
    if (best && bestDist <= mineRange()) return best;
    return null;
  }

  function onInteract() {
    // E is also the satellite, dock and surface key: only the belt's steps
    // mine (playtest: pressing E at the satellite said "get closer to a rock").
    if (!MINING_STEPS.has(game.missions?.step?.id)) return;
    if (miningId) return; // already busy with one
    const rock = nearestRock();
    if (!rock) {
      if (game.mode?.rockMarkers === 'pulse') {
        pulseUntil = game.ship.t + PULSE_SECONDS;
        hud.toast(t('Scanner pulse! Nearby rocks show up for a few seconds.', 'Beep! Rocks near you light up for a moment.'), { kind: 'info', ms: 2400 });
      } else {
        hud.toast(t('Get closer to a rock, then press E.', 'Fly closer to a rock, then press E.'), { kind: 'info', ms: 2000 });
      }
      return;
    }
    if (power() < SOLAR.powerNeededForClaw) {
      // The ship's own panels only care about DISTANCE from the Sun (see
      // physics.js's solarPower - no facing/angle term), unlike the Act 1
      // satellite lesson, so the fix is flying closer to the Sun, not
      // turning. Most of the belt sits below powerNeededForClaw with base
      // panels (see the tuning note in this file's header), so this really
      // does come up - the inner edge (closest to Mars) is the reliable spot.
      hud.toast(t(`Not enough power for the claw (need ${SOLAR.powerNeededForClaw}, have ${power().toFixed(0)}). Fly toward the inner edge of the belt, closer to the Sun.`,
        'Not enough power for the claw. Fly a bit closer to the Sun.'), { kind: 'warn', ms: 3600 });
      return;
    }
    if (game.ship.cargo >= SHIP.cargoMax) {
      // A full hold but this kind still needs its sample (a3_mining): she'd be
      // stuck (nothing to build with only silicon), so the most plentiful ore
      // is tipped out to make room.
      if (sampleCounts[rock.kind] < samplesNeeded()) {
        const most = Object.keys(game.resources).filter((k) => k !== KIND_TO_RESOURCE[rock.kind])
          .sort((a, b) => (game.resources[b] || 0) - (game.resources[a] || 0))[0];
        const drop = Math.min(AMOUNT_PER_MINE, game.resources[most] || 0);
        game.resources[most] -= drop;
        game.ship.cargo = Math.max(0, game.ship.cargo - drop);
        hud.toast(t(`Hold full: you tip out ${drop.toFixed(1)} t of ${most} to make room for the ${rock.kind} sample.`, `Your ship is full! You let some ${most} go to make room.`), { kind: 'info', ms: 3600 });
      } else {
        hud.toast(t('Cargo hold is full! Press U (or the Upgrade bay button) to turn ore into upgrades or fuel.', 'Your ship is full of rocks! Press U to use them.'), { kind: 'warn', ms: 3200 });
        return;
      }
    }
    miningId = rock.id;
    mineTimer = 0;
    shipView.setClaw({ extended: true, closed: false });
    belt.highlight(rock.id);
  }

  bus.on('interact', onInteract);

  function finishMining() {
    // What the rock looked like before the grab: beltFx breaks this apart
    // (a rock that falls apart completely is gone from the belt after mine()).
    const rec = belt.nearRocks.find((r) => r.id === miningId);
    const before = rec?.mesh && { mesh: { position: rec.mesh.position.clone(), scale: { x: rec.mesh.scale.x } } };
    const result = belt.mine(miningId, AMOUNT_PER_MINE);
    if (result.resource && before) game.beltFx?.breakRock(before, { resource: result.resource, kind: rec.kind, shatter: result.depleted });
    if (result.resource) {
      game.resources[result.resource] = (game.resources[result.resource] || 0) + result.taken;
      game.ship.cargo = Math.min(SHIP.cargoMax, game.ship.cargo + result.taken);
      const kind = Object.keys(KIND_TO_RESOURCE).find((k) => KIND_TO_RESOURCE[k] === result.resource);
      if (kind && sampleCounts[kind] < samplesNeeded()) {
        sampleCounts[kind] += 1;
        game.samples.push(BELT.kinds[kind].sample);
      }
      hud.toast(t(`Mined ${result.taken.toFixed(1)} t of ${result.resource}${result.depleted ? ' - the rock broke apart!' : '.'}`, `You got ${result.resource}!`), { kind: 'good', ms: 1800 });
    }
    game.beltFx?.shake(null);
    miningId = null;
    // Pulled in still closed: opening it at full reach lit the tractor beam
    // (shipFx) for a moment, and that flash whited out the whole screen.
    shipView.setClaw({ extended: false, closed: true });
    belt.highlight(null);
  }

  async function maybeFireBeats() {
    if (askingBeat) return;
    if (!cargoHeavyAsked && game.ship.cargo > SHIP.cargoMax / 2) {
      cargoHeavyAsked = true;
      askingBeat = true;
      await askBeat(game, 'cargoHeavy');
      askingBeat = false;
      return;
    }
    if (!sampleCratesAsked && allSampled()) {
      sampleCratesAsked = true;
      askingBeat = true;
      await askBeat(game, 'sampleCrates');
      if (!beltFactAsked) {
        beltFactAsked = true;
        await hud.showFact({
          title: 'The planet that never was',
          body: t('The asteroid belt holds millions of rocks, but all of them together weigh less than our Moon. '
            + 'They never clumped into a planet - something kept stirring them up...',
            'The asteroid belt has millions of rocks. They never stuck together into a planet. Something kept shaking them up...'),
        });
        await askBeat(game, 'beltFact');
      }
      askingBeat = false;
    }
  }

  function allSampled() {
    const need = samplesNeeded();
    return sampleCounts.stony >= need && sampleCounts.metal >= need && sampleCounts.icy >= need;
  }

  function tick(dt) {
    if (miningId) {
      mineTimer += dt;
      if (mineTimer > 0.35) shipView.setClaw({ extended: true, closed: true });
      // The rock shakes harder and harder in the claw, then cracks.
      const rec = mineTimer > 0.35 && belt.nearRocks.find((r) => r.id === miningId);
      game.beltFx?.shake(rec || null, Math.min(1, (mineTimer - 0.35) / (MINE_SECONDS - 0.35)));
      // The targeted rock may have drifted out of range or been claimed by
      // depletion elsewhere; keep mining regardless (it's still `active` in
      // belt.js until finishMining()/mine() depletes it).
      if (mineTimer >= MINE_SECONDS) finishMining();
    }
    maybeFireBeats();
  }

  // --- HUD markers, following FLIGHT_MODES.rockMarkers -------------------
  const _proj = new THREE.Vector3();
  // Rock markers only while she's meant to be mining (Act 3's belt steps).
  // Playtest: the Mars coast in Act 2 showed 50 of them, which also cost
  // most of the frame (every marker is a DOM node moved each frame).
  // Play-test at 1024x768: even 10 chips covered the side panels and the
  // inset map, so: the nearest rock of each kind she still NEEDS (samples,
  // or ore short for the wings / shield), then the nearest others, 4 at most.
  const MAX_ROCK_MARKERS = 4;
  const BUILD_ORDER_M = ['bigSolarWings', 'radiationShield'];
  function neededKinds() {
    const need = new Set();
    const per = samplesNeeded();
    for (const k of Object.keys(KIND_TO_RESOURCE)) if ((sampleCounts[k] || 0) < per) need.add(k);
    const want = {};
    for (const id of BUILD_ORDER_M) {
      if (hasUpgrade(game, id)) continue;
      for (const [res, n] of Object.entries(UPGRADES[id].cost)) want[res] = (want[res] || 0) + n;
    }
    for (const [k, res] of Object.entries(KIND_TO_RESOURCE)) if ((game.resources[res] || 0) < (want[res] || 0)) need.add(k);
    return need;
  }

  function extraMarkers(camera, origin, w, h) {
    if (!MINING_STEPS.has(game.missions?.step?.id)) return [];
    const mode = game.mode?.rockMarkers || 'scanner';
    const range = game.mode?.scannerRange || 260;
    const ship = game.ship;
    let rocks;
    if (mode === 'all') {
      rocks = belt.nearRocks;
    } else if (mode === 'pulse') {
      if (game.ship.t > pulseUntil) return [];
      rocks = belt.nearRocks.filter((r) => Math.hypot(r.x - ship.x, r.z - ship.z) <= range);
    } else {
      rocks = belt.nearRocks.filter((r) => Math.hypot(r.x - ship.x, r.z - ship.z) <= range);
    }
    // The nearest few only: 50 labels is clutter, not help.
    const sorted = rocks
      .map((r) => ({ r, d: Math.hypot(r.x - ship.x, r.z - ship.z) }))
      .sort((a, b) => a.d - b.d);
    const need = neededKinds();
    const pick = [];
    for (const k of need) { const e = sorted.find((x) => x.r.kind === k); if (e) pick.push(e); }
    // Nothing left to collect (built and sampled): just the nearest two, for ice.
    const cap = need.size ? MAX_ROCK_MARKERS : 2;
    for (const e of sorted) { if (pick.length >= cap) break; if (!pick.includes(e)) pick.push(e); }
    rocks = pick.slice(0, cap).map((e) => e.r);
    const out = [];
    for (const r of rocks) {
      _proj.set(r.x - origin.x, r.y, r.z - origin.z).project(camera);
      const behind = _proj.z > 1;
      const onScreen = !behind && Math.abs(_proj.x) <= 1 && Math.abs(_proj.y) <= 1;
      let sx = (_proj.x * 0.5 + 0.5) * w;
      let sy = (-_proj.y * 0.5 + 0.5) * h;
      if (behind) { sx = w - sx; sy = h - sy; }
      const dist = Math.hypot(r.x - ship.x, r.z - ship.z);
      out.push({
        id: `rock_${r.id}`,
        label: r.kind, // the marker adds the distance
        screenX: sx, screenY: sy, onScreen, distance: dist, kind: 'rock',
      });
    }
    return out;
  }

  // --- the mined tally (hud/tally.js), PLAN item 11 ----------------------------
  // What she has against the next build: the wings first, then the shield.
  const BUILD_ORDER = ['bigSolarWings', 'radiationShield'];
  function tallyState() {
    if (!MINING_STEPS.has(game.missions?.step?.id)) return null;
    const nextId = BUILD_ORDER.find((id) => !hasUpgrade(game, id));
    const canBuild = Object.keys(UPGRADES).some((id) => !hasUpgrade(game, id) && canAfford(game.resources, UPGRADES[id].cost));
    // Melting is worth offering while the tank isn't full (keeping 2 ice for the shield).
    const spareIce = (game.resources.ice || 0) - (hasUpgrade(game, 'radiationShield') ? 0 : 2);
    const canMelt = (game.resources.ice || 0) >= 1 && (spareIce >= 1 || game.ship.cargo >= SHIP.cargoMax - 0.3)
      && game.ship.fuel < game.fuelCapacity - 0.5;
    return {
      resources: game.resources,
      cargo: game.ship.cargo,
      cargoMax: SHIP.cargoMax,
      next: nextId ? { id: nextId, label: UPGRADES[nextId].label, cost: UPGRADES[nextId].cost } : null,
      canBuild,
      canMelt,
    };
  }

  return {
    tick,
    extraMarkers,
    tallyState,
    get allSampled() { return allSampled(); },
    dispose() { bus.off('interact', onInteract); },
  };
}
