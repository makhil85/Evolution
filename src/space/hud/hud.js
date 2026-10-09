// Chapter 4 HUD — the whole UI layer, built from the pieces in this folder.
//
// The integrator (main.js / controls.js, Phase 2) talks to exactly this file:
//
//   import { createHud } from './hud/hud.js';
//   const hud = createHud({ mount, bus });
//   hud.update(state)              // every frame, cheap
//   hud.setMission({...})          // J toggles it, this module owns that key
//   hud.toast(text, {kind, ms})
//   hud.askQuestion(q) -> Promise<{correct, attempts}>
//   hud.showFact(...) / hud.showDialogue(...) -> Promise
//   hud.openUpgrades(...) -> Promise<id|null>
//   hud.map.open()/close()/toggle()/update(...)   // M key, this module owns that too
//   hud.setMarkers([...])
//   hud.showControls()             // H key
//   hud.showEnd(...)
//   hud.closeCards()               // the step engine's jump: close every card up
//   hud.setVisible(bool)
//
// THE POINTER-EVENTS RULE (see hud.css) means this overlay never eats the
// camera drag: the root is inert, and only real controls opt back in.
//
// Every blocking surface (question / fact / dialogue / upgrades / controls /
// end / pause) shares ONE modalHost, so `bus.emit('ui-modal', ...)` fires
// from exactly one place and can never be forgotten or double-fired.

import './hud.css';
import { el, svg, heroName } from './domUtil.js';
import { iconInner } from './icons.js';
import { createInstruments } from './instruments.js';
import { createMarkers } from './markers.js';
import { createMap } from './map.js';
import { createMinimap } from './minimap.js';
import { createTransferPanel } from './transferPanel.js';
import { createModalHost } from './modalHost.js';
import { createQuestionModal } from './questionModal.js';
import { createOverlays } from './overlays.js';
import { inModalTurn } from './modalQueue.js';
import { createTally, flyIcons } from './tally.js';

const MISSION_OPEN_KEY = 'space_ch4_mission_open';
const MISSION_FLASH_MS = 6000;
const TOAST_MIN_MS = 5000;
const TOAST_PER_CHAR_MS = 60;
const TOAST_MAX_MS = 12000;
/** A child reads slowly: explicit durations are stretched, never under this. */
const TOAST_FLOOR_MS = 5000;
/** New messages are spaced out instead of arriving in a burst. */
const TOAST_GAP_MS = 1500;
const MAX_VISIBLE_TOASTS = 2;

/** A key event that should be ignored: typing into a field, or a held-down repeat. */
function isTypingTarget(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
}

export class Hud {
  /**
   * @param {object} options
   * @param {HTMLElement} [options.mount]
   * @param {{on:Function, off:Function, emit:Function}} [options.bus]
   */
  constructor(options = {}) {
    const mount = options.mount || document.body;
    this.bus = options.bus || { on() {}, off() {}, emit() {} };

    this.root = el('div', 'sp-hud');
    this.root.setAttribute('data-sp-hud', '1');

    this._toasts = [];
    this._missionOpen = this._restoreMissionOpen();
    this._missionNow = undefined;

    this._buildMission();
    this._buildRadiationSlot(); // instruments.js appends its own radiation banner; nothing to build here, kept for clarity
    // Clicking a warp pip asks for that warp, exactly like keys 1-4.
    // With the autopilot on, its Slow / Fast buttons set how fast it may go.
    this.instruments = createInstruments(this.root, {
      onWarp: (i) => this.bus.emit('warp-request', i),
      onAutoWarp: (i) => this.bus.emit('autopilot-warp-limit', i),
    });
    // The belt's mined tally sits under the mission card (acts/mining.js feeds it).
    this.tally = createTally(this._sidebar, { onOpenBay: () => this.bus.emit('upgrade-bay-request') });
    this.instruments.setOrbitInto(this._sidebar);
    this.markers = createMarkers(this.root, { leftPanel: this.instruments.leftColumn, rightPanel: this._sidebar });
    this._buildToasts();

    this._modalHost = createModalHost(this.root, { bus: this.bus });
    this._question = createQuestionModal(this._modalHost);
    this._overlays = createOverlays(this._modalHost);
    this.map = createMap(this.root, { bus: this.bus });
    // Always-on top-down inset (bottom-right); click it for the full map.
    this.transfer = createTransferPanel(this.root);
    this.minimap = createMinimap(this.root, { onOpenMap: () => { if (!this._modalHost.isOpen()) this.map.open(); } });

    this._bindKeys();

    mount.appendChild(this.root);

    // Sensible non-empty defaults so nothing looks broken before the caller's
    // first update() lands.
    this.setMission({ act: '', title: 'Mission', objective: 'Getting the engines warm…', steps: [] });
  }

  // --- construction --------------------------------------------------------

  _buildMission() {
    const sidebar = el('div', 'sp-sidebar');
    this._sidebar = sidebar;

    const mission = el('div', 'sp-panel sp-mission');
    this._missionCard = mission;

    const toggle = el('button', 'sp-mission__toggle');
    toggle.type = 'button';
    const titleRow = el('span', 'sp-panel__title');
    titleRow.appendChild(svg(iconInner('rocket')));
    titleRow.appendChild(document.createTextNode('Mission'));
    toggle.appendChild(titleRow);
    this._missionPeek = el('span', 'sp-mission__peek', '');
    toggle.appendChild(this._missionPeek);
    const chev = svg(iconInner('chevronDown'));
    chev.classList.add('sp-mission__chev');
    toggle.appendChild(chev);
    toggle.addEventListener('click', () => this._setMissionOpen(!this._missionOpen));
    mission.appendChild(toggle);
    this._missionToggle = toggle;

    const body = el('div', 'sp-mission__body');
    this._missionAct = el('div', 'sp-mission__act', '');
    this._missionObjective = el('div', 'sp-mission__objective', '');
    this._missionSteps = el('ul', 'sp-mission__steps');
    body.append(this._missionAct, this._missionObjective, this._missionSteps);
    this._missionHint = el('div', 'sp-mission__hint', 'Press J to show or hide this card.');
    body.appendChild(this._missionHint);
    mission.appendChild(body);
    this._missionBody = body;

    sidebar.appendChild(mission);
    this.root.appendChild(sidebar);

    this._setMissionOpen(this._missionOpen, { remember: false });
  }

  // Placeholder hook kept separate from _buildMission for readability — the
  // radiation banner itself lives in instruments.js since it reacts to the
  // same per-frame state instruments.update() already reads.
  _buildRadiationSlot() {}

  _buildToasts() {
    this._toastLayer = el('div', 'sp-toasts');
    this._toastLayer.setAttribute('role', 'log');
    this._toastLayer.setAttribute('aria-live', 'polite');
    this.root.appendChild(this._toastLayer);
  }

  _restoreMissionOpen() {
    try { return localStorage.getItem(MISSION_OPEN_KEY) !== '0'; } catch { return true; }
  }

  _setMissionOpen(open, { remember = true } = {}) {
    this._missionOpen = !!open;
    this._missionCard.classList.toggle('is-collapsed', !open);
    this._missionToggle.setAttribute('aria-expanded', String(!!open));
    if (remember) {
      try { localStorage.setItem(MISSION_OPEN_KEY, open ? '1' : '0'); } catch { /* private mode */ }
    }
  }

  _flashMission() {
    clearTimeout(this._missionFlashTimer);
    this._missionCard.classList.add('is-new');
    const wasOpen = this._missionOpen;
    if (!wasOpen) this._setMissionOpen(true, { remember: false });
    this._missionFlashTimer = setTimeout(() => {
      this._missionCard.classList.remove('is-new');
      if (!wasOpen) this._setMissionOpen(false, { remember: false });
    }, MISSION_FLASH_MS);
  }

  /**
   * J (mission), H (controls help), M (map), Esc (pause — only when nothing
   * else is already open; a question/fact/dialogue/upgrades modal and the map
   * both stop the Escape keydown from bubbling this far up when THEY should
   * handle it instead, so no double-handling guard is needed beyond the
   * isOpen() checks below for the rare case focus sits outside them.
   */
  _bindKeys() {
    this._onKey = (e) => {
      if (e.repeat || isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'KeyJ') {
        if (this._modalHost.isOpen() || this.map.isOpen()) return;
        this._setMissionOpen(!this._missionOpen);
        return;
      }
      if (e.code === 'KeyH') {
        if (this._modalHost.isOpen() || this.map.isOpen()) return;
        this.showControls();
        return;
      }
      if (e.code === 'KeyU') {
        // The upgrade bay (act3.js decides whether it can open right now).
        if (this._modalHost.isOpen() || this.map.isOpen()) return;
        this.bus.emit('upgrade-bay-request');
        return;
      }
      if (e.code === 'KeyN') {
        this.minimap.toggle();
        return;
      }
      if (e.code === 'KeyM') {
        if (this._modalHost.isOpen()) return; // never fight a question modal for the keyboard
        this.map.toggle();
        return;
      }
      if (e.key === 'Escape') {
        if (this._modalHost.isOpen() || this.map.isOpen()) return;
        this._overlays.pauseMenu({
          // main.js owns the modes; the HUD only asks it to run the picker.
          onMode: () => new Promise((done) => this.bus.emit('flight-mode-menu', done)),
          onRetry: () => this.bus.emit('retry-request'),
        });
      }
    };
    addEventListener('keydown', this._onKey);
  }

  // --- contract: mission card -----------------------------------------------

  /** @param {{act?:string, title?:string, objective?:string, steps?:{text:string, done?:boolean}[]}} mission */
  setMission(mission) {
    const m = mission && typeof mission === 'object' ? mission : {};
    const act = typeof m.act === 'string' ? m.act : '';
    const objective = typeof m.objective === 'string' ? m.objective : '';
    const steps = Array.isArray(m.steps) ? m.steps : [];

    this._missionAct.textContent = act;
    this._missionAct.hidden = !act;
    this._missionObjective.textContent = objective || 'Keep flying — the next step will appear here.';

    this._missionSteps.textContent = '';
    for (const step of steps) {
      if (!step || typeof step.text !== 'string') continue;
      const li = el('li', `sp-mission__step${step.done ? ' is-done' : ''}`, step.text);
      this._missionSteps.appendChild(li);
    }

    this._missionPeek.textContent = objective || act || 'Mission';

    if (this._missionNow !== undefined && this._missionNow !== objective) this._flashMission();
    this._missionNow = objective;
  }

  /**
   * The next goal, big across the top for a few seconds, then gone (lead
   * 2026-10-07: "explain the next goal and then remove it from screen").
   * @param {string} title  e.g. "Next goal: Mars"
   * @param {string} [text] what to do
   */
  announce(title, text = '', ms = 6500) {
    if (!this._goal) {
      this._goal = el('div', 'sp-goal');
      this._goal.setAttribute('role', 'status');
      this._goal.setAttribute('aria-live', 'polite');
      this._goalTitle = el('div', 'sp-goal__title');
      this._goalText = el('div', 'sp-goal__text');
      this._goal.append(this._goalTitle, this._goalText);
      this.root.appendChild(this._goal);
    }
    this._goalTitle.textContent = title;
    this._goalText.textContent = text;
    this._goalText.hidden = !text;
    this._goal.classList.remove('is-gone');
    this._goal.classList.add('is-on');
    clearTimeout(this._goalTimer);
    this._goalTimer = setTimeout(() => { this._goal.classList.remove('is-on'); this._goal.classList.add('is-gone'); }, ms);
  }

  // --- contract: per-frame instruments --------------------------------------

  /** @param {object} state see CHAPTER4_PLAN.md / the module header for the shape */
  update(state) {
    this.instruments.update(state);
    this.tally.update(state?.tally || null);
  }

  /** Arc emoji icons from a screen point into an element (tally.js flyIcons). */
  flyIcons(opts) {
    flyIcons(opts);
  }

  // --- contract: markers -----------------------------------------------------

  setMarkers(markers) {
    this.markers.set(markers);
  }

  // --- contract: toasts --------------------------------------------------

  /**
   * @param {string} text
   * @param {{kind?: 'info'|'good'|'warn', ms?: number}} [opts]
   */
  toast(text, opts = {}) {
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message) return;
    // Lead 2026-10-02: messages came too fast and went too quickly. A new
    // one waits until TOAST_GAP_MS after the last one appeared (the same text
    // still merges straight away, below); the queue drops stale duplicates.
    const now = performance.now();
    // The same message again within 10 s is a duplicate (play-test: "Next
    // stop: the asteroid belt" twice, two capture toasts, two warp refusals).
    this._toastSeen = this._toastSeen || new Map();
    const seenAt = this._toastSeen.get(message);
    const shownNow = this._toasts.some((e) => e.message === message);
    if (!shownNow && seenAt !== undefined && now - seenAt < 10000) return;
    this._toastSeen.set(message, now);
    const newestShown = this._toasts[this._toasts.length - 1];
    const sameAsNewest = newestShown && newestShown.message === message;
    // While she has to act (focus mode) only warnings get through; the rest
    // wait (they used to cover the landing gauge and the aim panel).
    const held = this._focus && opts.kind !== 'warn';
    if (!sameAsNewest && (held || now < (this._toastNextAt || 0))) {
      this._toastQueue = (this._toastQueue || []).filter((q) => q.text !== text);
      this._toastQueue.push({ text, opts, at: now });
      if (!this._toastQueueTimer) this._drainToasts();
      return;
    }
    if (!sameAsNewest) this._toastNextAt = now + TOAST_GAP_MS;
    const kind = ['good', 'warn'].includes(opts.kind) ? opts.kind : 'info';

    const newest = this._toasts[this._toasts.length - 1];
    if (newest && newest.message === message) {
      newest.repeat += 1;
      newest.countEl.textContent = `×${newest.repeat}`;
      newest.countEl.hidden = false;
      clearTimeout(newest.timer);
      newest.timer = setTimeout(() => this._dismissToast(newest), this._toastLife(message, opts.ms));
      return;
    }

    const node = el('div', `sp-toast is-${kind}`);
    node.appendChild(el('span', null, message));
    const countEl = el('span', 'sp-toast__count', '');
    countEl.hidden = true;
    node.appendChild(countEl);

    const entry = { node, countEl, message, repeat: 1, timer: 0 };
    entry.timer = setTimeout(() => this._dismissToast(entry), this._toastLife(message, opts.ms));
    this._toasts.push(entry);
    this._toastLayer.appendChild(node);
    while (this._toasts.length > MAX_VISIBLE_TOASTS) this._dismissToast(this._toasts[0]);
  }

  _toastLife(message, ms) {
    if (Number.isFinite(ms) && ms > 0) return Math.max(TOAST_FLOOR_MS, ms * 1.6);
    return Math.min(TOAST_MAX_MS, TOAST_MIN_MS + message.length * TOAST_PER_CHAR_MS);
  }

  /** Show queued messages one at a time, TOAST_GAP_MS apart. */
  _drainToasts() {
    const wait = Math.max(0, (this._toastNextAt || 0) - performance.now());
    this._toastQueueTimer = setTimeout(() => {
      this._toastQueueTimer = 0;
      // Drop what's out of date: a message more than 8 s old belongs to a
      // moment that has passed ("Coast there..." arriving in Moon orbit).
      this._toastQueue = (this._toastQueue || []).filter((q) => performance.now() - q.at < 8000);
      if (this._focus && this._toastQueue.every((q) => q.opts?.kind !== 'warn')) return; // setFocus(false) drains
      const next = this._toastQueue.shift();
      if (!next) return;
      this._toastNextAt = 0;
      this.toast(next.text, next.opts);
      if (this._toastQueue.length) this._drainToasts();
    }, wait);
  }

  /** Focus mode (hud.css .is-focus): only what she needs while she has to act. */
  setFocus(on) {
    if (this._focus === !!on) return;
    this._focus = !!on;
    this.root.classList.toggle('is-focus', this._focus);
    if (!this._focus && this._toastQueue?.length && !this._toastQueueTimer) this._drainToasts();
  }

  _dismissToast(entry) {
    const i = this._toasts.indexOf(entry);
    if (i < 0) return;
    this._toasts.splice(i, 1);
    clearTimeout(entry.timer);
    entry.node.classList.add('is-out');
    setTimeout(() => entry.node.remove(), 220);
  }

  // --- contract: blocking overlays --------------------------------------

  /** @returns {Promise<{correct:boolean, attempts:number}>} */
  // Every blocking card below takes its turn in modalQueue.js (one FIFO): the
  // host has one slot, and a card opened over another would leave the first
  // one's promise pending for ever (lead review, 2026-10-08).
  askQuestion(question) {
    // Two wrong tries (lead rule): main.js's onOutOfTries sends her back to
    // the start of the act. The promise then never resolves - the page reloads.
    return inModalTurn(() => this._question.askQuestion(question).then((res) => {
      if (res?.failed && this.onOutOfTries) { this.onOutOfTries(); return new Promise(() => {}); }
      return res;
    }));
  }

  /** @returns {Promise<void>} */
  showFact(fact) {
    return inModalTurn(() => this._overlays.showFact(fact));
  }

  /** @returns {Promise<void>} */
  showDialogue(lines) {
    return inModalTurn(() => this._overlays.showDialogue(lines));
  }

  /** @returns {Promise<string|null>} */
  openUpgrades(opts) {
    return inModalTurn(() => this._overlays.openUpgrades(opts));
  }

  /** Easy / Medium / Hard picker. Resolves the chosen mode id, or null. */
  chooseFlightMode(opts) {
    return inModalTurn(() => this._overlays.chooseFlightMode(opts));
  }

  /** A picker of a few options. Resolves the chosen id, or null. */
  choose(opts) {
    return inModalTurn(() => this._overlays.choose(opts));
  }

  showControls() {
    return this._overlays.showControls();
  }

  /** @returns {Promise<'again'>} */
  showEnd(data) {
    return inModalTurn(() => this._overlays.showEnd(data));
  }

  isModalOpen() {
    return this._modalHost.isOpen() || this.map.isOpen();
  }

  /**
   * Close whatever the HUD has up (the card host: a question, a dialogue, a
   * fact, the pause menu; and the big map). Used by the step engine's jump, so
   * the new step's card is not put up under an old one.
   */
  closeCards() {
    this._modalHost.close();
    if (this.map.isOpen()) this.map.close();
  }

  // --- misc ------------------------------------------------------------

  setVisible(visible) {
    this.root.classList.toggle('is-hidden', !visible);
  }

  destroy() {
    removeEventListener('keydown', this._onKey);
    for (const entry of this._toasts.slice()) this._dismissToast(entry);
    clearTimeout(this._missionFlashTimer);
    this.root.remove();
  }
}

/**
 * @param {{mount?: HTMLElement, bus?: {on:Function, off:Function, emit:Function}}} [options]
 * @returns {Hud}
 */
export function createHud(options) {
  return new Hud(options);
}

export default createHud;

// Re-exported so lab pages / tests can build a minimal name without pulling
// in the whole profile module directly.
export { heroName };
