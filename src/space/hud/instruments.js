// The live instrument cluster: speed, fuel, cargo, the pull meter, the solar
// meter, time-warp, the orbit readout, a radiation banner and the landing
// panel. Everything here is built ONCE in `mount()` and then only touched in
// `update(state)` when a value actually changed — hud.update() runs every
// frame, so a naive re-render (rebuilding text nodes each call) would be a
// steady, pointless GC load.
//
// This module renders numbers; it does not compute them. Physics (agent A)
// hands over the finished state object described in CHAPTER4_PLAN's HUD API,
// and the only "physics" done here is the small stuff that is purely
// presentational: turning `bound` into "Falling in!" vs "Escaping!", and the
// inverse-square arithmetic for the two mini-visuals (that arithmetic is
// 1/d^2, the same rule contracts.js's SOLAR and gravity are built on — not a
// second source of truth, just the same rule drawn small).

import { el, svg, num, frac, pct, group, fmtNum } from './domUtil.js';
import { iconInner } from './icons.js';
import { BODIES, SHIP, RADIATION, WARP_LEVELS } from '../contracts.js';
import { t } from '../level.js';

function bodyLabel(id) {
  return (id && BODIES[id] && BODIES[id].name) || id || 'nothing nearby';
}

/** Bar gauge builder shared by fuel / cargo / power. Returns {root, setFrac}. */
function buildBar(toneFn) {
  const bar = el('div', 'sp-bar');
  const fill = el('div', 'sp-bar__fill');
  bar.appendChild(fill);
  return {
    root: bar,
    set(f) {
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
      fill.className = `sp-bar__fill${toneFn ? ` is-${toneFn(f)}` : ''}`;
    },
  };
}

export function createInstruments(root, { onWarp } = {}) {
  // --- left column: speed, pull, solar --------------------------------
  const left = el('div', 'sp-instruments sp-instruments--left');

  // Speed
  const speedPanel = el('div', 'sp-panel sp-speed');
  const speedTitle = el('div', 'sp-panel__title');
  speedTitle.appendChild(svg(iconInner('speed')));
  speedTitle.appendChild(document.createTextNode('Speed'));
  speedPanel.appendChild(speedTitle);
  const speedValue = el('div', 'sp-speed__value');
  const speedNum = el('span', 'sp-speed__num tabular', '0');
  const speedUnit = el('span', 'sp-speed__unit', 'u/s');
  speedValue.append(speedNum, speedUnit);
  speedPanel.appendChild(speedValue);
  const speedRel = el('div', 'sp-speed__rel', 'relative to nothing');
  speedPanel.appendChild(speedRel);
  const altRow = el('div', 'sp-speed__alt');
  altRow.appendChild(svg(iconInner('altitude')));
  const altText = el('span', null, 'Altitude —');
  altRow.appendChild(altText);
  speedPanel.appendChild(altRow);
  left.appendChild(speedPanel);

  // Pull meter (gravity)
  const pullPanel = el('div', 'sp-panel sp-pull');
  const pullTitle = el('div', 'sp-panel__title');
  pullTitle.appendChild(svg(iconInner('gravity')));
  pullTitle.appendChild(document.createTextNode('Pull of Gravity'));
  pullPanel.appendChild(pullTitle);
  const pullBody = el('div', 'sp-pull__body', 'Free fall — no strong pull');
  pullPanel.appendChild(pullBody);
  const pullBar = buildBar();
  pullPanel.appendChild(pullBar.root);
  const pullNote = el('div', 'sp-gauge__note', '');
  pullPanel.appendChild(pullNote);
  // The mini inverse-square visual: "now" vs "twice as far" pull, side by side.
  const pullMini = el('div', 'sp-pull__mini');
  const nowSlot = el('div', 'sp-pull__slot');
  const nowStem = el('div', 'sp-pull__stem');
  nowSlot.appendChild(nowStem);
  nowSlot.appendChild(el('div', 'sp-pull__capt', 'Now'));
  const farSlot = el('div', 'sp-pull__slot');
  const farStem = el('div', 'sp-pull__stem');
  farSlot.appendChild(farStem);
  farSlot.appendChild(el('div', 'sp-pull__capt', t('2× as far → ÷4', 'Farther: weaker')));
  pullMini.append(nowSlot, farSlot);
  pullPanel.appendChild(pullMini);
  left.appendChild(pullPanel);

  // Solar power
  const solarPanel = el('div', 'sp-panel sp-solar');
  const solarTitle = el('div', 'sp-panel__title');
  solarTitle.appendChild(svg(iconInner('solar')));
  solarTitle.appendChild(document.createTextNode('Solar Power'));
  solarPanel.appendChild(solarTitle);
  const solarPct = el('div', 'sp-solar__pct tabular', '100%');
  solarPanel.appendChild(solarPct);
  const solarOf = el('div', 'sp-solar__of', 'of the sunlight Earth gets');
  solarPanel.appendChild(solarOf);
  const solarBar = buildBar((f) => (f < 0.15 ? 'bad' : f < 0.4 ? 'warn' : 'good'));
  solarPanel.appendChild(solarBar.root);
  const solarStatus = el('div', 'sp-solar__status is-ok', 'Enough power for the claw.');
  solarPanel.appendChild(solarStatus);
  left.appendChild(solarPanel);

  // --- fuel + cargo + warp: same column, flowing below solar -------------
  // (Originally a second, bottom-anchored absolute block: at 900px tall that
  // overlapped the solar panel above it whenever the top stack ran long.
  // One flex column that just flows downward can't overlap itself.)
  const suppliesPanel = el('div', 'sp-panel sp-supplies');
  const suppliesTitle = el('div', 'sp-panel__title');
  suppliesTitle.appendChild(svg(iconInner('fuel')));
  suppliesTitle.appendChild(document.createTextNode('Fuel + Cargo'));
  suppliesPanel.appendChild(suppliesTitle);

  const fuelGauge = el('div', 'sp-gauge');
  const fuelRow = el('div', 'sp-row');
  fuelRow.appendChild(el('span', null, 'Fuel'));
  const fuelValue = el('b', 'tabular', '100%');
  fuelRow.appendChild(fuelValue);
  fuelGauge.appendChild(fuelRow);
  const fuelBar = buildBar((f) => (f < 0.2 ? 'bad' : f < 0.4 ? 'warn' : 'good'));
  fuelGauge.appendChild(fuelBar.root);
  // The rescued satellite's arrays, while it rides on her ship (Act 1 -> the
  // Moon): a line saying whether they are charging the tank right now.
  const solarCharge = el('div', 'sp-gauge__charge', '');
  solarCharge.hidden = true;
  fuelGauge.appendChild(solarCharge);
  suppliesPanel.appendChild(fuelGauge);

  const cargoGauge = el('div', 'sp-gauge');
  const cargoRow = el('div', 'sp-row');
  cargoRow.appendChild(el('span', null, 'Cargo'));
  const cargoValue = el('b', 'tabular', '0 t');
  cargoRow.appendChild(cargoValue);
  cargoGauge.appendChild(cargoRow);
  const cargoBar = buildBar((f) => (f > 0.75 ? 'warn' : undefined));
  cargoGauge.appendChild(cargoBar.root);
  const accelRow = el('div', 'sp-accel');
  accelRow.appendChild(el('span', 'sp-accel__label', t('Get-up-and-go', 'How zippy')));
  const accelTrack = el('div', 'sp-accel__track');
  const accelFill = el('div', 'sp-accel__fill');
  accelTrack.appendChild(accelFill);
  accelRow.appendChild(accelTrack);
  cargoGauge.appendChild(accelRow);
  const cargoNote = el('div', 'sp-gauge__note', 'Light and zippy.');
  cargoGauge.appendChild(cargoNote);
  suppliesPanel.appendChild(cargoGauge);
  left.appendChild(suppliesPanel);

  // Warp
  const warpPanel = el('div', 'sp-panel sp-warp-panel');
  const warpTitle = el('div', 'sp-panel__title');
  warpTitle.appendChild(svg(iconInner('warp')));
  warpTitle.appendChild(document.createTextNode('Time Warp'));
  warpPanel.appendChild(warpTitle);
  const warpRow = el('div', 'sp-warp');
  // The pips are buttons (lead): a click asks for that warp, like keys 1-4.
  const warpPips = WARP_LEVELS.map((lvl, i) => {
    const pip = el('button', 'sp-warp__pip', `×${lvl}`);
    pip.type = 'button';
    pip.title = `Time warp ×${lvl} (key ${i + 1})`;
    pip.addEventListener('click', () => { pip.blur(); onWarp?.(i); });
    warpRow.appendChild(pip);
    return pip;
  });
  warpPanel.appendChild(warpRow);
  const warpReason = el('div', 'sp-warp__reason is-hidden');
  warpReason.appendChild(svg(iconInner('warning')));
  const warpReasonText = el('span', null, '');
  warpReason.appendChild(warpReasonText);
  warpPanel.appendChild(warpReason);
  left.appendChild(warpPanel);

  root.appendChild(left);

  // --- radiation banner --------------------------------------------------
  const radiation = el('div', 'sp-radiation');
  radiation.hidden = true;
  radiation.appendChild(svg(iconInner('radiation')));
  radiation.appendChild(el('span', null, "Jupiter's radiation belt — Radiation Shield needed!"));
  root.appendChild(radiation);

  // --- right column: orbit readout (mission card is built by hud.js above it) ---
  const orbitPanel = el('div', 'sp-panel sp-orbit');
  const orbitTitle = el('div', 'sp-panel__title');
  orbitTitle.appendChild(svg(iconInner('orbit')));
  orbitTitle.appendChild(document.createTextNode('Your Orbit'));
  orbitPanel.appendChild(orbitTitle);
  const orbitState = el('div', 'sp-orbit__state');
  const orbitStateIcon = svg(iconInner('orbit'));
  const orbitStateText = el('span', null, 'Not orbiting anything');
  orbitState.append(orbitStateIcon, orbitStateText);
  orbitPanel.appendChild(orbitState);
  const periRow = el('div', 'sp-orbit__row');
  periRow.appendChild(el('span', null, 'Lowest point'));
  const periValue = el('span', 'tabular', '—');
  periRow.appendChild(periValue);
  orbitPanel.appendChild(periRow);
  const apoRow = el('div', 'sp-orbit__row');
  apoRow.appendChild(el('span', null, 'Highest point'));
  const apoValue = el('span', 'tabular', '—');
  apoRow.appendChild(apoValue);
  orbitPanel.appendChild(apoRow);

  // --- landing panel -------------------------------------------------------
  const landing = el('div', 'sp-panel sp-landing');
  landing.hidden = true;
  const landingHead = el('div', 'sp-landing__head');
  const landingTitle = el('div', 'sp-panel__title');
  landingTitle.appendChild(svg(iconInner('landing')));
  landingTitle.appendChild(document.createTextNode('Landing'));
  landingHead.appendChild(landingTitle);
  const landingSpeed = el('div', 'sp-landing__body', '0.0 u/s');
  landingHead.appendChild(landingSpeed);
  landing.appendChild(landingHead);
  const zone = el('div', 'sp-landing__zone');
  // The bar is twice the brake line: green to 80% of it, amber (getting fast)
  // to the line at the middle, red past it - the same numbers as the banner.
  zone.style.background = 'linear-gradient(90deg, var(--sp-good) 0%, var(--sp-good) 37%, var(--sp-amber) 43%, var(--sp-amber) 48%, var(--sp-bad) 54%, var(--sp-bad) 100%)';
  const needle = el('div', 'sp-landing__needle');
  zone.appendChild(needle);
  landing.appendChild(zone);
  const labels = el('div', 'sp-landing__labels');
  labels.appendChild(el('span', null, 'Gentle'));
  labels.appendChild(el('span', null, t('Brake line', 'Slow down')));
  labels.appendChild(el('span', null, 'Too fast'));
  landing.appendChild(labels);
  const verdict = el('div', 'sp-landing__verdict is-good', 'Safe to land');
  landing.appendChild(verdict);
  root.appendChild(landing);

  // Cached last-seen values so update() can skip untouched DOM writes.
  const last = {};
  function changed(key, value) {
    const s = typeof value === 'number' ? Math.round(value * 100) : value;
    if (last[key] === s) return false;
    last[key] = s;
    return true;
  }

  function setOrbitInto(sidebarMount) {
    sidebarMount.appendChild(orbitPanel);
  }

  /** @param {object} state see hud/hud.js createHud() jsdoc for the full shape */
  function update(state) {
    if (!state || typeof state !== 'object') return;

    // Speed -----------------------------------------------------------
    if (changed('speed', state.speed) || changed('speedRel', state.speedRelativeTo)) {
      speedNum.textContent = fmtNum(state.speed, state.speed < 10 ? 1 : 0);
      speedRel.textContent = state.speedRelativeTo ? `${t('relative to', 'compared with')} ${bodyLabel(state.speedRelativeTo)}` : t('relative to the Sun', 'compared with the Sun');
    }
    if (changed('alt', state.altitude)) {
      const a = num(state.altitude, NaN);
      altText.textContent = Number.isFinite(a) ? `Altitude ${group(a)} u` : 'Altitude —';
    }

    // Fuel --------------------------------------------------------------
    if (changed('fuel', state.fuel) || changed('fuelMax', state.fuelMax)) {
      const f = frac(state.fuel, state.fuelMax);
      fuelBar.set(f);
      fuelValue.textContent = `${pct(state.fuel, state.fuelMax)}%`;
    }

    // Cargo + a visual "heavier = slower to speed up" -------------------
    if (changed('cargo', state.cargo) || changed('cargoMax', state.cargoMax)) {
      const f = frac(state.cargo, state.cargoMax);
      cargoBar.set(f);
      cargoValue.textContent = `${fmtNum(state.cargo, 1)} / ${fmtNum(state.cargoMax, 0)} t`;
      // A heavier hold makes thrust push the ship less — shown as a shrinking
      // "get-up-and-go" bar, the opposite direction of the cargo bar it sits
      // under, so the two together tell the whole story at a glance.
      const zip = 1 - f * 0.75;
      accelFill.style.transform = `scaleX(${Math.max(0.1, zip)})`;
      cargoNote.textContent = f > 0.66
        ? 'Heavy — slow to speed up and slow to turn.'
        : f > 0.3
          ? 'Getting heavier — handling is softening.'
          : 'Light and zippy.';
    }

    // Pull meter ----------------------------------------------------------
    if (state.gravity && (changed('gBody', state.gravity.body) || changed('gAccel', state.gravity.accel) || changed('gDist', state.gravity.distance))) {
      const { body, accel, distance } = state.gravity;
      const a = num(accel, 0);
      if (a <= 0.0005) {
        pullBody.textContent = 'Free fall — no strong pull';
        pullNote.textContent = '';
        pullBar.set(0);
      } else {
        pullBody.textContent = `${bodyLabel(body)} is pulling`;
        pullNote.textContent = t(`${a.toFixed(a < 1 ? 3 : 2)} u/s² at ${group(distance)} u away`,
          a > 1 ? 'A strong pull!' : a > 0.05 ? 'A medium pull.' : 'A weak pull.');
        // Scale the bar against a generous ceiling so it reads sensibly both
        // deep in a gravity well and far out — not a physical unit, a gauge.
        pullBar.set(Math.min(1, a / 4));
      }
      // Twice-the-distance stem is always a quarter the height of "now" — the
      // inverse-square rule drawn, not just stated.
      const nowH = 10 + Math.min(1, a / 4) * 30;
      nowStem.style.height = `${nowH}px`;
      farStem.style.height = `${Math.max(4, nowH / 4)}px`;
    }

    // Solar power -----------------------------------------------------------
    if (state.solar && (changed('solarFrac', state.solar.fractionOfEarth) || changed('power', state.power) || changed('powerNeeded', state.powerNeeded))) {
      const frEarth = num(state.solar.fractionOfEarth, 1);
      solarPct.textContent = `${frEarth >= 0.1 ? Math.round(frEarth * 100) : (frEarth * 100).toFixed(1)}%`;
      solarBar.set(Math.max(0.02, frEarth));
      const enough = num(state.power, 0) >= num(state.powerNeeded, 0);
      solarStatus.textContent = enough
        ? 'Enough power for the claw and scanner.'
        : 'Not enough power — get closer to the Sun, or build Big Solar Wings.';
      solarStatus.className = `sp-solar__status ${enough ? 'is-ok' : 'is-low'}`;
    }

    // Time warp -----------------------------------------------------------
    if (changed('warpUseful', state.warpUseful)) warpPanel.style.display = state.warpUseful === false ? 'none' : '';
    if (changed('warp', state.warp) || changed('warpAllowed', state.warpAllowed) || changed('warpReason', state.warpReason)) {
      warpPips.forEach((pip, i) => pip.classList.toggle('is-active', WARP_LEVELS[i] === state.warp));
      const blocked = state.warpAllowed === false;
      warpReason.classList.toggle('is-hidden', !blocked);
      warpReasonText.textContent = blocked ? (state.warpReason || 'Too close to a body to warp.') : '';
    }

    // Orbit readout ---------------------------------------------------------
    if (state.orbit && (changed('oPeri', state.orbit.periapsis) || changed('oApo', state.orbit.apoapsis) || changed('oBound', state.orbit.bound) || changed('oBody', state.orbit.body))) {
      const { periapsis, apoapsis, bound, body } = state.orbit;
      periValue.textContent = Number.isFinite(periapsis) ? `${group(periapsis)} u` : '—';
      apoValue.textContent = Number.isFinite(apoapsis) ? `${group(apoapsis)} u` : 'never comes back';
      if (bound) {
        orbitStateText.textContent = `Circling ${bodyLabel(body)}`;
      } else {
        // Heuristic, spelled out because the contract does not hand us a
        // "which side of periapsis" flag: compare how far away she is right
        // now (gravity.distance, same body) against the orbit's own lowest
        // point. Still closing in on it -> "Falling in!"; already past it
        // and opening back up -> "Escaping!".
        const dNow = state.gravity && state.gravity.body === body ? num(state.gravity.distance, NaN) : NaN;
        const fallingIn = Number.isFinite(dNow) && Number.isFinite(periapsis) && dNow > periapsis * 1.02;
        orbitStateText.textContent = fallingIn ? `Falling in toward ${bodyLabel(body)}!` : `Escaping ${bodyLabel(body)}!`;
      }
    }

    // Radiation banner --------------------------------------------------
    if (state.gravity && state.gravity.body === RADIATION.body) {
      const d = num(state.gravity.distance, Infinity);
      radiation.hidden = !(d >= RADIATION.inner && d <= RADIATION.outer);
    } else {
      radiation.hidden = true;
    }

    // Landing panel -------------------------------------------------------
    const near = state.gravity && BODIES[state.gravity.body] && BODIES[state.gravity.body].landable;
    const showLanding = !state.landedOn && near && state.landingGauge !== false && num(state.altitude, Infinity) < (BODIES[state.gravity.body]?.radius || 10) * 3;
    landing.hidden = !showLanding;
    if (showLanding) {
      const safe = state.safeLandingSpeed ?? SHIP.safeLandingSpeed; // flying mode may change it
      const speed = num(state.speed, 0);
      landingSpeed.textContent = t(`${speed.toFixed(1)} u/s descending`, `Falling at ${speed.toFixed(1)}`);
      // The brake line: the banner's own limit while it guides a landing (it
      // allows more speed high up and shrinks near the ground), else the
      // touchdown limit itself. Lead: the gauge said "too fast" while the
      // banner said "falling gently", and the green was hard to stay in.
      const lim = Math.max(0.05, state.landingLimit ?? safe);
      const f = Math.min(1, speed / (lim * 2));
      needle.style.left = `${f * 100}%`;
      const bad = state.landingTooFast ?? speed > lim;
      const warn = !bad && (state.landingHeadsUp ?? speed > lim * 0.8);
      verdict.textContent = bad ? t('Too fast — hold W to brake!', 'Too fast! Hold W to slow down.')
        : warn ? t('Getting fast — get ready to brake', 'Getting fast! Get ready.')
          : t('Good speed — keep it in the green', 'Good! Keep it green.');
      verdict.className = `sp-landing__verdict ${bad ? 'is-bad' : 'is-good'}`;
      verdict.style.color = warn ? 'var(--sp-amber)' : '';
    }
  }

  // `leftColumn` is the actual instrument stack (speed/pull/solar/fuel/warp) —
  // markers.js measures its real width to keep off-screen arrows out of it.
  // `root` is returned too for backwards compatibility but is just the HUD
  // root this was mounted into, not this module's own box.
  /** 'charging' | 'engine' | 'topped' | 'full' | null (hidden). */
  function setSolarCharge(state) {
    const text = {
      charging: t('☀ Solar wings: charging fuel', '☀ Sun wings: filling fuel'),
      engine: t('☀ Solar wings: resting (engine on)', '☀ Sun wings: wait, engine on'),
      full: t('☀ Solar wings: tank full', '☀ Sun wings: tank full'),
      topped: t('☀ Solar wings: resting (they only top up to 80%)', '☀ Sun wings: resting'),
    }[state];
    solarCharge.hidden = !text;
    solarCharge.textContent = text || '';
    solarCharge.className = `sp-gauge__charge${state === 'charging' ? ' is-charging' : ''}`;
  }

  return { root, leftColumn: left, update, setOrbitInto, orbitPanel, setSolarCharge };
}
