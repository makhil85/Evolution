// Chapter 4 HUD — the whole UI layer, built from the pieces in this folder.
//
// The integrator (main.js / controls.js, Phase 2) talks to exactly this file:
//
//   import { createHud } from './hud/hud.js';
//   const hud = createHud({ mount, bus });
//   hud.update(state)              // every frame, cheap
//   hud.setMission({...})          // J toggles it, this module owns that key
//   hud.toast(text, {kind, ms})    // stays up readMs(text); long text waits for a click
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
import { readMs, needsClick, READ_MAX_MS } from '../../play/readTime.js';

const MISSION_OPEN_KEY = 'space_ch4_mission_open';
const MISSION_FLASH_MS = 6000;
/** New messages are spaced out instead of arriving in a burst. */
const TOAST_GAP_MS = 1500;
const MAX_VISIBLE_TOASTS = 2;
/** A queued message older than this is dropped (its moment has passed). */
const TOAST_STALE_MS = 12000;

/**
 * How long a message stays up by itself: a child needs readMs() to read it
 * (lead 2026-10-09: "the writing comes and goes away too fast"). A caller's
 * longer `ms` is kept up to READ_MAX_MS; a shorter one is ignored.
 * @param {string|string[]} text
 * @param {number} [ms]
 */
function readLife(text, ms) {
  return Math.min(READ_MAX_MS, Math.max(readMs(text), Number.isFinite(ms) ? ms : 0));
}

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
    this._toastQueue = [];
    this._toastNextAt = 0;
    this._toastSeen = new Map();
    this._readPending = 0; // cards waiting for a click (see _readCard)
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
    // Stays up for readMs like a toast; a long one waits for a click instead.
    if (needsClick([title, text])) { this._readCard(text, title); return; }
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
    this._goalTimer = setTimeout(() => { this._goal.classList.remove('is-on'); this._goal.classList.add('is-gone'); }, readLife([title, text], ms));
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
   * A message for the child. It stays up for readMs(text) (5-10 s, see
   * src/play/readTime.js) even when a caller asks for less; a text too long
   * for that waits for a click instead (_readCard). Messages queue behind the
   * one on screen rather than pushing it out early.
   * @param {string} text
   * @param {{kind?: 'info'|'good'|'warn', ms?: number}} [opts]  ms is a floor: a longer reading time is kept, a shorter one ignored
   */
  toast(text, opts = {}) {
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message) return;
    // The same message again within 10 s is a duplicate (play-test: "Next
    // stop: the asteroid belt" twice, two capture toasts, two warp refusals).
    const now = performance.now();
    const seenAt = this._toastSeen.get(message);
    const shownNow = this._toasts.some((e) => e.message === message);
    if (!shownNow && seenAt !== undefined && now - seenAt < 10000) return;
    this._toastSeen.set(message, now);
    const newestShown = this._toasts[this._toasts.length - 1];
    const sameAsNewest = !!newestShown && newestShown.message === message;
    // While she has to act (focus mode) only warnings get through; the rest
    // wait (they used to cover the landing gauge and the aim panel). Nothing
    // gets past a card she is reading, and a third message waits for a slot.
    const held = (this._focus && opts.kind !== 'warn') || this._readPending > 0;
    const full = this._toasts.length >= MAX_VISIBLE_TOASTS;
    // Lead 2026-10-02: messages came too fast and went too quickly. A new one
    // waits until TOAST_GAP_MS after the last one appeared, and anything
    // already waiting goes first (the same text still merges straight away).
    const waits = held || full || this._toastQueue.length > 0 || now < this._toastNextAt;
    if (!sameAsNewest && waits) {
      this._toastQueue = this._toastQueue.filter((q) => q.text !== message);
      this._toastQueue.push({ text: message, opts, at: now });
      if (!this._toastQueueTimer) this._drainToasts();
      return;
    }
    this._show(message, opts);
  }

  /** Put one message on screen now (toast() has checked that it may go). */
  _show(message, opts = {}) {
    const now = performance.now();
    const newest = this._toasts[this._toasts.length - 1];
    if (!newest || newest.message !== message) this._toastNextAt = now + TOAST_GAP_MS;
    // Too long to read by itself: a card with an OK button, not a toast.
    if (needsClick(message)) { this._readCard(message); return; }

    if (newest && newest.message === message) {
      newest.repeat += 1;
      newest.countEl.textContent = `×${newest.repeat}`;
      newest.countEl.hidden = false;
      clearTimeout(newest.timer);
      newest.timer = setTimeout(() => this._dismissToast(newest), readLife(message, opts.ms));
      return;
    }

    const kind = ['good', 'warn'].includes(opts.kind) ? opts.kind : 'info';
    const node = el('div', `sp-toast is-${kind}`);
    node.appendChild(el('span', null, message));
    const countEl = el('span', 'sp-toast__count', '');
    countEl.hidden = true;
    node.appendChild(countEl);

    const entry = { node, countEl, message, repeat: 1, timer: 0 };
    entry.timer = setTimeout(() => this._dismissToast(entry), readLife(message, opts.ms));
    this._toasts.push(entry);
    this._toastLayer.appendChild(node);
  }

  /**
   * A card with an OK button for text too long to read by itself (needsClick).
   * The game pauses under it (ui-modal, from the shared host) until she clicks
   * OK, or presses Enter, Space or Escape. It takes its turn in modalQueue.js
   * like every other card, and holds the toasts behind it (_readPending).
   * @param {string} text
   * @param {string} [title]
   */
  _readCard(text, title = '') {
    this._readPending += 1;
    inModalTurn(() => this._waitForHost().then(() => new Promise((resolve) => {
      const host = this._modalHost;
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        host.backdrop.removeEventListener('keydown', onKey);
        host.close();
        this._readPending -= 1;
        this._releaseToasts();
        resolve();
      };
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); }
      };
      host.open((root) => {
        if (title) root.appendChild(el('h3', 'sp-modal__title', title));
        root.appendChild(el('p', 'sp-modal__body', text));
        const actions = el('div', 'sp-modal__actions');
        const ok = el('button', 'sp-btn', 'OK');
        ok.type = 'button';
        ok.addEventListener('click', finish);
        actions.appendChild(ok);
        root.appendChild(actions);
        host.backdrop.addEventListener('keydown', onKey);
        setTimeout(() => { try { ok.focus(); } catch { /* detached */ } }, 0);
      }, { onEscape: finish });
    })));
  }

  /** Resolves once the shared card host is free (the pause menu can hold it). */
  _waitForHost() {
    return new Promise((resolve) => {
      const tick = () => { if (this._modalHost.isOpen()) setTimeout(tick, 250); else resolve(); };
      tick();
    });
  }

  /** Toasts held back by a card she was reading go on once it is shut. */
  _releaseToasts() {
    if (this._readPending === 0 && this._toastQueue.length && !this._toastQueueTimer) this._drainToasts();
  }

  /** Show queued messages one at a time, TOAST_GAP_MS apart, as slots free up. */
  _drainToasts() {
    const wait = Math.max(0, this._toastNextAt - performance.now());
    this._toastQueueTimer = setTimeout(() => {
      this._toastQueueTimer = 0;
      // A card or a dismissed toast calls this again when it can go on.
      if (this._readPending || this._toasts.length >= MAX_VISIBLE_TOASTS) return;
      // Drop what's out of date: a message this old belongs to a moment that
      // has passed ("Coast there..." arriving in Moon orbit).
      const now = performance.now();
      this._toastQueue = this._toastQueue.filter((q) => now - q.at < TOAST_STALE_MS);
      // While she has to act only warnings get through (setFocus(false) drains again).
      const i = this._toastQueue.findIndex((q) => !this._focus || q.opts?.kind === 'warn');
      if (i < 0) return;
      const [next] = this._toastQueue.splice(i, 1);
      this._show(next.text, next.opts);
      if (this._toastQueue.length) this._drainToasts();
    }, wait);
  }

  /** Focus mode (hud.css .is-focus): only what she needs while she has to act. */
  setFocus(on) {
    if (this._focus === !!on) return;
    this._focus = !!on;
    this.root.classList.toggle('is-focus', this._focus);
    if (!this._focus) this._releaseToasts();
  }

  _dismissToast(entry) {
    const i = this._toasts.indexOf(entry);
    if (i < 0) return;
    this._toasts.splice(i, 1);
    clearTimeout(entry.timer);
    entry.node.classList.add('is-out');
    setTimeout(() => entry.node.remove(), 220);
    // A slot is free: the next waiting message may go.
    this._releaseToasts();
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
