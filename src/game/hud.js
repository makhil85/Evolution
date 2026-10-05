// The interface layer: a DOM overlay sitting on top of the full-screen
// WebGL canvas.
//
// Implements the frozen `Hud` interface in contracts.js and the four progress
// surfaces of docs/QUEST_SPEC.md §1.4 / §5: progress bar + status line, mission
// card, badge row, toasts — plus the question modal, the resource counters, the
// "Press E" interact pill and the flight readout.
//
// Three rules shape this file:
//
//   1. THE HUD MUST NOT EAT THE MOUSE. This overlay covers the whole viewport,
//      and the camera is dragged with the mouse on the canvas underneath. So the
//      root is `pointer-events: none` and only genuinely interactive controls
//      (buttons, the answer input, the parent-hints <details>, the quest-list
//      <details>, and the modal backdrop while it is open) opt back in. Every
//      panel, pill, bar and badge is inert — you can drag the camera straight
//      "through" the sidebar.
//   2. THE HUD OWNS NO TRUTH. It renders the text the quest engine authored
//      (statusLine / missionCard / badges / stationMessage) and the question
//      data the quest engine wrote. The only judgement it makes on its own is grading an
//      answer, and even that is questions.js `checkAnswer` — the pure predicate
//      quests.js explicitly publishes for this module — or a `validate` hook the caller
//      can pass to route grading through QuestEngine.attempt() instead.
//   3. WRONG ANSWERS COST NOTHING. The modal stays open, the controls stay
//      enabled, the hint appears, and the child tries again. That is Level 1/2
//      behaviour and spec §5.7.3.
//
// No dependencies, no framework, plain DOM.

import './hud.css';
import { checkAnswer, getQuestion, parentHintsFor, wrongAnswerMessage } from './questions.js';
import { MARKER_COLOR } from './stations.js';
import { audio } from './audio.js';
import { loadProfile } from '../launcher/profile.js';
import { IS_LEVEL1 as IS_L1 } from '../space/level.js';

/**
 * The child names her scientist in the launcher; eighteen authored strings
 * across quests.js and questions.js call her Zara.
 *
 * Rather than edit all eighteen and leave the next author to remember, the
 * substitution happens at the one place every piece of HUD text passes
 * through. Read ONCE at module load: this runs per rendered string, and
 * hitting localStorage on each one would be silly.
 *
 * Idempotent by construction - the replacement never contains "Zara" unless
 * that is the name she chose, in which case it changes nothing anyway.
 */
const HERO_NAME = (() => {
  const n = loadProfile().name.trim();
  return n && n !== 'Zara' ? n : null;
})();

/** Authored text with the heroine's name swapped in. */
function personalise(text) {
  if (HERO_NAME === null || typeof text !== 'string') return text;
  return text.replace(/\bZara(?:'s|’s)?\b/g, (m) => (m.length > 4 ? `${HERO_NAME}'s` : HERO_NAME));
}

/**
 * Resource counters, in HUD order. Mirrors quests.js RESOURCE_KEYS; kept local
 * (with labels, which are ours) so the HUD renders even if the quest module is
 * mid-rewrite in another agent's branch.
 */
const RESOURCE_ROWS = [
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'iron', label: 'Iron', icon: '🔩' },
  { key: 'gems', label: 'Gems', icon: '💎' },
  { key: 'fuel', label: 'Fuel', icon: '⛽' },
  { key: 'circuits', label: 'Circuits', icon: '🔌' },
  { key: 'rocketParts', label: 'Parts', icon: '🚀' }
];

/** Spec §5.3 — the mission card is never blank, even before the engine speaks. */
const MISSION_FALLBACK = IS_L1 ? 'Open the Mission card. Follow the glowing marker.' : 'Open the Mission card and follow the glowing marker to your next station.';
const MISSION_GOAL = 'Build the rocket and launch it.';
/** Whether the child last left the mission card open. Not game state. */
const MISSION_OPEN_KEY = 'rocket_village_mission_open';
/** How long a NEW objective holds the card open before it folds back away. */
const MISSION_FLASH_MS = 7000;

/** Toast lifetime: a Grade 3 reader needs time, so it scales with length.
 *  The calm rules match Chapter 4 (lead 2026-10-02): at least 5 s on screen,
 *  at most 2 at once, a new one 1.5 s after the last, held back while a
 *  question or play card is open (warnings pass), dropped when 8 s stale,
 *  and the same text again within 10 s is not shown twice. */
const TOAST_MIN_MS = 5000;
const TOAST_PER_CHAR_MS = 45;
const TOAST_MAX_MS = 10000;
const MAX_VISIBLE_TOASTS = 2;
const TOAST_GAP_MS = 1500;
const TOAST_STALE_MS = 8000;
const TOAST_DUP_MS = 10000;

const BADGE_GLYPH = { done: '✓', active: '●', open: '○', locked: '○' };

/** How long the one-time spawn nudge stays up before it fades for good. */
const ONBOARD_DELAY_MS = 500;
const ONBOARD_LIFE_MS = 9000;

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = personalise(String(text));
  return node;
}

/** Finite number or the fallback. Guards against a NaN leaking into the DOM. */
function num(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Whole, non-negative count — resources are never fractional or negative. */
function count(value) {
  const n = Math.floor(num(value, 0));
  return n > 0 ? n : 0;
}

/** `1,240` — thousands separators, because a nine-year-old reads them faster. */
function group(n) {
  return Math.round(num(n, 0)).toLocaleString('en-US');
}

/**
 * Stable 32-bit hash of a string. Used to seed the choice shuffle, so the four
 * options keep the SAME order every time a child reopens a question. Reshuffling
 * between attempts would make a retry feel like a different question.
 * @param {string} str
 * @returns {number}
 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic Fisher-Yates. The authored data puts `correct: true` first in
 * every choice list, so rendering the raw order would teach "the answer is
 * always the top one" instead of the science.
 * @template T
 * @param {T[]} list
 * @param {number} seed
 * @returns {T[]}
 */
function seededShuffle(list, seed) {
  const out = list.slice();
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    // xorshift32: tiny, dependency-free, and good enough to un-bias 4 items.
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    const j = state % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The HUD
// ---------------------------------------------------------------------------

/**
 * The Level 3 heads-up display.
 *
 * @implements {import('./contracts.js').Hud}
 */
export class Hud {
  /**
   * @param {object}      [options]
   * @param {HTMLElement} [options.mount]     where to append the overlay (default document.body)
   * @param {string}      [options.title]     the header title
   * @param {string}      [options.missionGoal] the mission card's goal line
   * @param {boolean}     [options.rank]  show the XP rank chip (default true)
   * @param {boolean}     [options.signpostKey]  show the signpost colour key (default true)
   * @param {boolean}     [options.compact]   start with the sidebar collapsed
   * @param {Array<{key:string,label:string,icon:string}>} [options.resourceRows]
   *        the Supplies counters (default: Chapter 3's RESOURCE_ROWS)
   */
  constructor(options = {}) {
    const mount = options.mount || document.body;

    /** Supplies counters this HUD shows. Chapter 2 passes its own six via options.resourceRows. */
    this._resourceRows = Array.isArray(options.resourceRows) && options.resourceRows.length
      ? options.resourceRows
      : RESOURCE_ROWS;

    /** @type {HTMLElement} the overlay root — `pointer-events: none` lives here */
    this.root = el('div', 'rv-hud');
    this.root.setAttribute('data-rv-hud', '1');

    this._toasts = [];
    this._toastQueue = [];     // waiting messages {message, kind, at}
    this._toastQueueTimer = 0;
    this._toastNextAt = 0;     // performance.now() before which a new toast waits
    this._toastSeen = new Map(); // message -> when it was last shown
    this._inventory = {};
    this._modal = null;      // {question, cb, validate, wrongCount, token}
    this._destroyed = false;
    this._rankLabel = null;        // set once so setRank never flashes on the FIRST read
    this._interactActionable = false; // whether an actionable "Press E" pill is up right now
    this._onboardShown = false;
    this._onboardTimers = [];
    /** Tries per question (lead rule, all chapters): after this many wrong
     *  answers the chapter starts again. */
    this.maxTries = 2;
    /** Set by the chapter: what "start again" does (wipe its save, reload). */
    this.onOutOfTries = null;
    /** Called on a right answer (the chapter makes her cheer, with a little confetti). */
    this.onCorrect = null;

    /** The one-line chapter goal on the mission card (Chapter 2 passes its own). */
    this._missionGoal = options.missionGoal || MISSION_GOAL;
    this._buildTop(options.title || 'Rocket Village', options);
    this._buildSide();
    this._restoreMissionOpen();
    this._bindMissionKey();
    this._buildOnboard();
    this._buildFlight();
    this._buildInteract();
    this._buildToasts();
    this._buildModal();

    mount.appendChild(this.root);

    // Sensible non-empty defaults so the HUD is never blank on frame one, even
    // if the caller wires the quest engine a few frames later.
    this.setProgress(0, 'Starting up — walk north up the road.');
    this.setMission(MISSION_FALLBACK);
    this.setInventory({});
    if (options.compact) this.root.classList.add('rv-hud--compact');

    // Spec problem: a child spawns on an open road with nothing on screen
    // saying which way to go. The mission card already carries the answer
    // (quests.js authors it — "Walk north up the road... on the left"), but
    // it lives in ~13px text in a corner, which a first-time player has no
    // reason yet to read. So: surface that SAME line once, big and central,
    // a beat after the real quest text has loaded, then let it go for good.
    // Never hardcode a direction here — that would drift from quests.js the
    // moment either one changes.
    this._onboardTimers.push(setTimeout(() => this._showOnboard(), ONBOARD_DELAY_MS));
  }

  // --- construction -------------------------------------------------------

  _buildTop(title, opts = {}) {
    const top = el('div', 'rv-top');

    const head = el('div', 'rv-top__head');
    head.appendChild(el('h1', 'rv-title', title));
    this._rankChip = el('span', 'rv-rank', 'Visitor');
    // Chapter 3's XP rank; the chapters without one pass rank: false.
    if (opts.rank === false) this._rankChip.hidden = true;
    head.appendChild(this._rankChip);
    top.appendChild(head);

    const wrap = el('div', 'rv-progress');
    this._progressFill = el('div', 'rv-progress__fill');
    this._progressText = el('div', 'rv-progress__text', '0%');
    // Screen readers get the status line; it changes on every quest event.
    this._progressText.setAttribute('role', 'status');
    this._progressText.setAttribute('aria-live', 'polite');
    wrap.appendChild(this._progressFill);
    wrap.appendChild(this._progressText);
    // In the title row (one slim line at the top, like Chapter 4's clear top).
    head.appendChild(wrap);

    // One low, calm row instead of the three-row wall of 25+ chips this used
    // to be (spec §5.4 wants "one pill per step", but at this chain length
    // that was a quarter of the viewport for the ONE surface a child glances
    // at least — the progress bar already says "how far", the mission card
    // already says "what's next"). The signpost legend stays visible always,
    // because "what does that dot mean" is a look-it-up-mid-play question.
    // The full ladder becomes reference material behind a native <details>,
    // so it stays keyboard- and screen-reader-operable for free.
    const topline = el('div', 'rv-topline');

    // What the signpost colours mean.
    //
    // The village says "go here next" with a gold signpost and "there is an
    // extra puzzle here" with a violet one, and until now it never said so
    // anywhere. A child could work out gold from following it; violet is not
    // guessable, and a marker you do not understand is one you ignore.
    //
    // Colours come from stations.js MARKER_COLOR, so the key cannot drift
    // away from the thing it is explaining.
    const key = el('div', 'rv-key');
    key.setAttribute('role', 'list');
    for (const [state, label] of [
      ['ready', 'go here next'],
      ['bonus', 'extra puzzle'],
      ['locked', 'not yet'],
    ]) {
      const item = el('span', 'rv-key__item');
      item.setAttribute('role', 'listitem');
      const dot = el('span', `rv-key__dot rv-key__dot--${state}`);
      dot.style.background = `#${MARKER_COLOR[state].toString(16).padStart(6, '0')}`;
      item.appendChild(dot);
      item.appendChild(el('span', 'rv-key__label', label));
      key.appendChild(item);
    }
    // Chapter 3's signpost colours; the chapters without signposts pass
    // signpostKey: false.
    if (opts.signpostKey === false) key.hidden = true;
    topline.appendChild(key);

    this._quests = el('details', 'rv-quests');
    const summary = el('summary', 'rv-quests__summary');
    summary.appendChild(el('span', 'rv-quests__label', 'Quest list'));
    this._questsCount = el('span', 'rv-quests__count', '0/0 steps');
    summary.appendChild(this._questsCount);
    this._quests.appendChild(summary);

    const panel = el('div', 'rv-quests__panel');
    this._badgeRow = el('div', 'rv-badges');
    this._badgeRow.setAttribute('role', 'list');
    panel.appendChild(this._badgeRow);
    this._quests.appendChild(panel);
    topline.appendChild(this._quests);

    // The quest chip and the signpost key move to the right-hand column
    // (_buildSide), so the top of the screen is just the title row.
    this._topline = topline;
    this._signKey = key;
    topline.removeChild(key);

    this.root.appendChild(top);
  }

  _buildOnboard() {
    this._onboard = el('div', 'rv-onboard');
    this._onboard.hidden = true;
    this._onboard.setAttribute('aria-hidden', 'true'); // decorative echo of the mission card, not new info
    this._onboardArrow = el('span', 'rv-onboard__arrow', '➜');
    this._onboardText = el('span', 'rv-onboard__text', '');
    this._onboard.appendChild(this._onboardArrow);
    this._onboard.appendChild(this._onboardText);
    this.root.appendChild(this._onboard);
  }

  _buildSide() {
    const side = el('aside', 'rv-side');
    side.appendChild(this._topline);

    // The mission card collapses; SUPPLIES deliberately does not.
    //
    // A child needs the mission text when deciding where to go and almost
    // never while walking, so a paragraph parked on the right for the whole
    // session is mostly in the way. Supplies is the opposite: the entire
    // middle of this game is hunting for materials, and hiding the count of
    // what she has collected would be hiding the thing she is playing for.
    const mission = el('section', 'rv-card rv-card--mission');
    this._missionCard = mission;

    // A real <button>, so it is tabbable, has a focus ring and announces its
    // state, rather than a div with a click handler bolted on.
    const head = el('button', 'rv-card__toggle');
    head.type = 'button';
    head.appendChild(el('span', 'rv-card__title', 'Mission'));
    // Collapsed, this is the only thing left - so it has to carry the whole
    // instruction in a glance. It is the "now" line, trimmed.
    this._missionPeek = el('span', 'rv-mission__peek', '');
    head.appendChild(this._missionPeek);
    head.appendChild(el('span', 'rv-card__chevron', '▾'));
    head.addEventListener('click', () => this._setMissionOpen(!this._missionOpen));
    mission.appendChild(head);
    this._missionToggle = head;

    const body = el('div', 'rv-mission__body');
    body.appendChild(el('div', 'rv-mission__goal', `Goal: ${this._missionGoal}`));
    this._missionLines = el('ul', 'rv-mission__lines');
    body.appendChild(this._missionLines);
    mission.appendChild(body);
    this._missionBody = body;
    side.appendChild(mission);

    const res = el('section', 'rv-card rv-card--res');
    res.appendChild(el('h2', 'rv-card__title', 'Supplies'));
    this._resGrid = el('div', 'rv-res');
    this._resCells = {};
    for (const row of this._resourceRows) this._resGrid.appendChild(this._makeResCell(row));
    res.appendChild(this._resGrid);
    side.appendChild(res);

    // Spec §5.6 — tiny, muted, collapsed, out of the child's eyeline. This is
    // the one panel in the sidebar that takes pointer events (see hud.css).
    this._parent = el('details', 'rv-parent');
    const summary = el('summary', 'rv-parent__summary', 'Parents: hints for this level');
    this._parent.appendChild(summary);
    this._parentInner = el('div', 'rv-parent__inner');
    this._parent.appendChild(this._parentInner);
    this.setParentHints([]);
    side.appendChild(this._signKey);
    side.appendChild(this._parent);

    this.root.appendChild(side);
  }

  /**
   * Open or close the mission card.
   *
   * The choice is remembered, because a child who collapses it does not want
   * to collapse it again on every reload. Storage is wrapped: private mode
   * throws on access, and a HUD is not worth crashing a game over.
   */
  _setMissionOpen(open, { remember = true } = {}) {
    this._missionOpen = !!open;
    this._missionCard.classList.toggle('is-collapsed', !open);
    this._missionToggle.setAttribute('aria-expanded', String(!!open));
    this._missionToggle.title = open ? 'Hide the mission (M)' : 'Show the mission (M)';
    if (remember) {
      try { localStorage.setItem(MISSION_OPEN_KEY, open ? '1' : '0'); } catch { /* private mode */ }
    }
  }

  /**
   * A new objective arrived: show it, then fold back to what she chose.
   *
   * `remember: false` on both calls is the point - a temporary peek must not
   * overwrite her preference, or the first new objective would silently undo
   * her decision to keep the card closed.
   */
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

  /** Did the child collapse it last time? Default is OPEN on a first visit. */
  _restoreMissionOpen() {
    let open = true;
    try { open = localStorage.getItem(MISSION_OPEN_KEY) !== '0'; } catch { /* private mode */ }
    this._setMissionOpen(open, { remember: false });
  }

  /**
   * M toggles the mission card.
   *
   * Guarded against firing while she is typing an answer. gameScene.js learned
   * this the hard way: it used to swallow WASD globally, and since one answer
   * is the word "west", that question was literally untypeable and it gated
   * the launch. M is not a movement key and not E, so nothing else wants it.
   */
  _bindMissionKey() {
    this._onMissionKey = (e) => {
      if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (this.isModalOpen()) return;
      this._setMissionOpen(!this._missionOpen);
    };
    addEventListener('keydown', this._onMissionKey);
  }

  /** The Supplies cell for `key` and its icon (the collect animation flies there), or null. */
  resourceCell(key) {
    const c = this._resCells[key];
    if (!c) return null;
    const row = this._resourceRows.find((r) => r.key === key);
    return { el: c.cell, icon: row ? row.icon : '✨' };
  }

  _makeResCell(row) {
    const cell = el('div', 'rv-res__cell');
    cell.appendChild(el('span', 'rv-res__icon', row.icon));
    const body = el('span', 'rv-res__body');
    body.appendChild(el('span', 'rv-res__label', row.label));
    const value = el('b', 'rv-res__value', '0');
    body.appendChild(value);
    cell.appendChild(body);
    this._resCells[row.key] = { cell, value };
    return cell;
  }

  _buildFlight() {
    this._flight = el('div', 'rv-flight');
    this._flight.hidden = true;
    this._flightCells = {};
    for (const [key, label] of [
      ['altitude', 'Altitude'],
      ['velocity', 'Speed'],
      ['fuel', 'Fuel'],
      ['mass', 'Mass']
    ]) {
      const cell = el('div', 'rv-flight__cell');
      cell.appendChild(el('span', 'rv-flight__label', label));
      const value = el('b', 'rv-flight__value', '—');
      cell.appendChild(value);
      this._flight.appendChild(cell);
      this._flightCells[key] = value;
    }
    this._flightNote = el('div', 'rv-flight__note', '');
    this._flight.appendChild(this._flightNote);
    this.root.appendChild(this._flight);
  }

  _buildInteract() {
    this._interact = el('div', 'rv-interact');
    this._interact.hidden = true;
    this._interactKey = el('kbd', 'rv-interact__key', 'E');
    this._interactText = el('span', 'rv-interact__text', '');
    this._interact.appendChild(this._interactKey);
    this._interact.appendChild(this._interactText);
    this.root.appendChild(this._interact);
  }

  _buildToasts() {
    this._toastLayer = el('div', 'rv-toasts');
    this._toastLayer.setAttribute('role', 'log');
    this._toastLayer.setAttribute('aria-live', 'polite');
    this.root.appendChild(this._toastLayer);
  }

  _buildModal() {
    this._backdrop = el('div', 'rv-modal');
    this._backdrop.hidden = true;

    const card = el('div', 'rv-modal__card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    this._qTitle = el('h3', 'rv-modal__title', '');
    card.appendChild(this._qTitle);
    card.setAttribute('aria-labelledby', 'rvQuestionTitle');
    this._qTitle.id = 'rvQuestionTitle';

    this._qMeta = el('div', 'rv-modal__meta', '');
    card.appendChild(this._qMeta);

    this._qPrompt = el('p', 'rv-modal__prompt', '');
    card.appendChild(this._qPrompt);

    this._qVisual = el('div', 'rv-visual');
    this._qVisual.hidden = true;
    card.appendChild(this._qVisual);

    this._qChoices = el('div', 'rv-choices');
    this._qChoices.hidden = true;
    card.appendChild(this._qChoices);

    this._qTextRow = el('div', 'rv-answer');
    this._qTextRow.hidden = true;
    this._qInput = el('input', 'rv-answer__input');
    this._qInput.type = 'text';
    this._qInput.autocomplete = 'off';
    this._qInput.autocapitalize = 'off';
    this._qInput.spellcheck = false;
    this._qInput.setAttribute('aria-label', 'Your answer');
    this._qInput.placeholder = 'Type your answer';
    this._qSubmit = el('button', 'rv-btn rv-btn--go', 'Submit');
    this._qSubmit.type = 'button';
    this._qTextRow.appendChild(this._qInput);
    this._qTextRow.appendChild(this._qSubmit);
    card.appendChild(this._qTextRow);

    this._qFeedback = el('div', 'rv-feedback');
    this._qFeedback.hidden = true;
    this._qFeedback.setAttribute('role', 'status');
    this._qFeedback.setAttribute('aria-live', 'assertive');
    card.appendChild(this._qFeedback);

    // The modal carries its own copy of the parent hint for THIS question, so a
    // grown-up leaning over the shoulder does not have to go hunting the sidebar.
    this._qParent = el('details', 'rv-parent rv-parent--modal');
    this._qParentSummary = el('summary', 'rv-parent__summary', 'Parents: a hint for this question');
    this._qParentBody = el('div', 'rv-parent__inner');
    this._qParent.appendChild(this._qParentSummary);
    this._qParent.appendChild(this._qParentBody);
    card.appendChild(this._qParent);

    const actions = el('div', 'rv-modal__actions');
    this._qClose = el('button', 'rv-btn rv-btn--ghost', 'Close');
    this._qClose.type = 'button';
    this._qContinue = el('button', 'rv-btn rv-btn--go', 'Continue');
    this._qContinue.type = 'button';
    this._qContinue.hidden = true;
    actions.appendChild(this._qClose);
    actions.appendChild(this._qContinue);
    card.appendChild(actions);

    this._backdrop.appendChild(card);
    this.root.appendChild(this._backdrop);

    this._qSubmit.addEventListener('click', () => this._submitText());
    this._qClose.addEventListener('click', () => this.closeQuestion());
    this._qContinue.addEventListener('click', () => {
      const failed = this._modal?.failed;
      this.closeQuestion();
      if (failed && this.onOutOfTries) this.onOutOfTries();
    });
    this._qInput.addEventListener('keydown', (e) => {
      // Enter submits. stopPropagation because the game's keyboard handler is
      // global: without this, typing "west" walks the avatar around the village.
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submitText();
      }
    });
    this._qInput.addEventListener('keyup', (e) => e.stopPropagation());
    this._backdrop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // Questions can't be skipped (lead rule): Escape only closes one that
      // has been answered.
      if (e.key === 'Escape' && this._modal?.answered) this.closeQuestion();
    });
  }

  // --- contract: progress -------------------------------------------------

  /**
   * Progress bar + status line (spec §5.1, §5.2). The status line always names
   * exactly one next action.
   *
   * @param {number} pct     0..100
   * @param {string} [status] e.g. QuestEngine.statusLine(); if omitted the
   *                          previous status is kept rather than blanked.
   * @returns {void}
   */
  setProgress(pct, status) {
    const value = Math.max(0, Math.min(100, Math.round(num(pct, 0))));
    this._progressFill.style.width = `${value}%`;
    this._progressFill.classList.toggle('is-complete', value >= 100);

    if (typeof status === 'string' && status.trim()) {
      // QuestEngine.statusLine() already returns "<pct>% — <action>". Detect it
      // so the bar never reads "46% — 46% — Visit the Forge".
      this._status = /^\s*\d{1,3}\s*%/.test(status) ? status.trim() : `${value}% — ${status.trim()}`;
    } else if (!this._status) {
      this._status = `${value}%`;
    } else {
      this._status = this._status.replace(/^\s*\d{1,3}\s*%/, `${value}%`);
    }
    // On screen just the number: the "what next" words are the mission card's
    // job, and showing them here too said the same thing twice at the top of
    // the screen. Screen readers and a hover still get the whole line.
    this._progressText.textContent = `${value}%`;
    this._progressText.setAttribute('aria-label', this._status);
    this._progressText.parentElement.title = this._status;
  }

  /**
   * Mission card (spec §5.3). Accepts either a plain string or the object
   * QuestEngine.missionCard() returns, so callers can hand the engine's output
   * straight through. Truncated to 3 lines; never rendered empty.
   *
   * @param {string|{lines?: string[], now?: string, blocked?: string|null, bonus?: string|null}} text
   * @returns {void}
   */
  setMission(text) {
    let lines = [];
    if (typeof text === 'string') {
      lines = [text];
    } else if (text && typeof text === 'object') {
      lines = Array.isArray(text.lines) && text.lines.length
        ? text.lines.slice()
        : [text.now, text.blocked, text.bonus];
    }
    lines = lines.filter((l) => typeof l === 'string' && l.trim()).slice(0, 3);
    if (lines.length === 0) lines = [MISSION_FALLBACK];

    this._missionLines.textContent = '';
    lines.forEach((line, i) => {
      const item = el('li', 'rv-mission__line', line);
      // Line 1 is "Now"; the extras are the blocked / bonus notes and read quieter.
      if (i === 0) item.classList.add('is-now');
      if (/^★/.test(line)) item.classList.add('is-bonus');
      else if (i > 0) item.classList.add('is-note');
      this._missionLines.appendChild(item);
    });

    // Collapsed, the peek line is the ONLY mission text on screen, so it
    // carries the whole instruction. The star prefix is a bonus marker that
    // means nothing without the rest of the sentence, so it is dropped here.
    const now = lines[0].replace(/^★\s*/, '');
    if (this._missionPeek) this._missionPeek.textContent = now;

    // A new objective must never be missed just because she folded the card
    // away, so a CHANGED instruction opens it again for a few seconds and
    // then returns to whatever she chose. Unchanged text does nothing - this
    // is called on every engine effect, and a card that popped open on every
    // resource pickup would be worse than one that never closed.
    if (this._missionNow !== undefined && this._missionNow !== now) this._flashMission();
    this._missionNow = now;
  }

  /**
   * Badge row (spec §5.4): one pill per step in ladder order, plus the ★ pill.
   * Feed it QuestEngine.badges() directly.
   *
   * @param {{id:string,label:string,state:'done'|'active'|'open'|'locked',optional?:boolean}[]} badges
   * @returns {void}
   */
  setBadges(badges) {
    this._badgeRow.textContent = '';
    if (!Array.isArray(badges)) return;

    // The collapsed toggle's own at-a-glance number — required steps done,
    // and bonus puzzles taken — so "how far through" is readable WITHOUT
    // opening the list this is folded behind.
    let doneMain = 0;
    let totalMain = 0;
    let doneBonus = 0;
    let totalBonus = 0;

    for (const badge of badges) {
      if (!badge || typeof badge.label !== 'string') continue;
      const state = BADGE_GLYPH[badge.state] ? badge.state : 'locked';
      if (badge.optional) {
        totalBonus += 1;
        if (state === 'done') doneBonus += 1;
      } else {
        totalMain += 1;
        if (state === 'done') doneMain += 1;
      }

      const pill = el('span', `rv-badge is-${state}`);
      pill.setAttribute('role', 'listitem');
      if (badge.optional) pill.classList.add('is-bonus');
      pill.appendChild(el('span', 'rv-badge__mark', badge.optional && state !== 'done' ? '★' : BADGE_GLYPH[state]));
      pill.appendChild(el('span', 'rv-badge__label', badge.label));
      // Spelled out for screen readers; the glyph alone is not a state.
      pill.setAttribute('aria-label', `${badge.label}: ${state}`);
      this._badgeRow.appendChild(pill);
    }

    if (this._questsCount) {
      const parts = [`${doneMain}/${totalMain} steps`];
      if (totalBonus) parts.push(`★${doneBonus}/${totalBonus}`);
      this._questsCount.textContent = parts.join(' · ');
    }
  }

  /**
   * Rank chip beside the title. Flashes and chimes on an actual promotion
   * (spec §5.5 "rank up") — and ONLY that. `update()` calls this on every
   * quest event, and xp climbs on nearly every correct answer, so comparing
   * the whole chip text (label + XP) made this flash several times a minute:
   * a promotion cue that fires that often stops meaning anything and just
   * becomes noise. The rank LABEL is the only thing worth celebrating.
   */
  setRank(rank, xp) {
    const label = typeof rank === 'string' && rank.trim() ? rank.trim() : 'Visitor';
    const xpText = Number.isFinite(num(xp, NaN)) ? ` · ${count(xp)} XP` : '';
    this._rankChip.textContent = `${label}${xpText}`;

    if (this._rankLabel !== null && label !== this._rankLabel) {
      this._rankChip.classList.remove('is-flash');
      void this._rankChip.offsetWidth; // restart the CSS animation
      this._rankChip.classList.add('is-flash');
      audio.rankUp();
    }
    this._rankLabel = label;
  }

  // --- contract: inventory ------------------------------------------------

  /**
   * Resource counters for the seven resource types. Values are clamped to whole
   * non-negative numbers, so an `undefined` key shows 0 rather than "NaN" — the
   * failure mode quests.js was written to kill.
   *
   * @param {Object<string, number>} inv
   * @returns {void}
   */
  setInventory(inv) {
    const source = inv && typeof inv === 'object' ? inv : {};
    for (const row of this._resourceRows) {
      const next = count(source[row.key]);
      const cell = this._resCells[row.key];
      const prev = count(this._inventory[row.key]);
      cell.value.textContent = String(next);
      cell.cell.classList.toggle('is-zero', next === 0);
      if (next > prev) {
        // A child needs to SEE the number they just picked up move.
        cell.cell.classList.remove('is-gain');
        void cell.cell.offsetWidth;
        cell.cell.classList.add('is-gain');
      }
      this._inventory[row.key] = next;
    }
  }

  // --- contract: toasts ---------------------------------------------------

  /**
   * Bottom-left running commentary (spec §5.5). Every action writes exactly one.
   * A repeat of the newest toast bumps a ×N counter instead of stacking, so
   * picking up five crates does not bury the mission card.
   *
   * @param {string} text
   * @param {'info'|'good'|'warn'|'bad'} [kind]
   * @returns {void}
   */
  toast(text, kind = 'info') {
    if (this._destroyed) return;
    const message = typeof text === 'string' ? text.trim() : '';
    if (!message) return;
    const now = performance.now();

    // Already on screen: refresh it (and count it when it is the newest).
    const shown = this._toasts.find((e) => e.message === message);
    if (shown) {
      if (shown === this._toasts[this._toasts.length - 1]) {
        shown.repeat += 1;
        shown.countEl.textContent = `×${shown.repeat}`;
        shown.countEl.hidden = false;
      }
      clearTimeout(shown.timer);
      shown.timer = setTimeout(() => this._dismissToast(shown), this._toastLife(message));
      this._toastSeen.set(message, now);
      return;
    }
    // The same words again within 10 s are a duplicate, not news.
    const seenAt = this._toastSeen.get(message);
    if (seenAt !== undefined && now - seenAt < TOAST_DUP_MS) return;

    // Too soon after the last one, or a card is open: wait in line.
    const urgent = kind === 'warn' || kind === 'bad';
    // Both slots taken by messages younger than the 5 s minimum: wait too,
    // rather than pushing one off before she could read it.
    const full = this._toasts.length >= MAX_VISIBLE_TOASTS && now - this._toasts[0].shownAt < TOAST_MIN_MS;
    if ((this._focusNow() && !urgent) || now < this._toastNextAt || (full && !urgent)) {
      this._toastQueue = this._toastQueue.filter((q) => q.message !== message);
      this._toastQueue.push({ message, kind, at: now });
      this._drainToasts();
      return;
    }
    this._toastSeen.set(message, now);
    this._toastNextAt = now + TOAST_GAP_MS;

    const node = el('div', `rv-toast is-${['good', 'warn', 'bad'].includes(kind) ? kind : 'info'}`);
    node.appendChild(el('span', 'rv-toast__text', message));
    const countEl = el('span', 'rv-toast__count', '');
    countEl.hidden = true;
    node.appendChild(countEl);

    const entry = { node, countEl, message, repeat: 1, timer: 0, shownAt: now };
    entry.timer = setTimeout(() => this._dismissToast(entry), this._toastLife(message));
    this._toasts.push(entry);
    this._toastLayer.appendChild(node);

    while (this._toasts.length > MAX_VISIBLE_TOASTS) this._dismissToast(this._toasts[0]);
  }

  /** A question card, a play card or the chapter story is up (focus mode). */
  _focusNow() {
    return !!this._modal || (typeof document !== 'undefined' && !!document.body.dataset.playModal);
  }

  /** Show waiting messages one at a time, TOAST_GAP_MS apart; drop stale ones. */
  _drainToasts() {
    if (this._toastQueueTimer || this._destroyed) return;
    const wait = Math.max(250, this._toastNextAt - performance.now());
    this._toastQueueTimer = setTimeout(() => {
      this._toastQueueTimer = 0;
      const now = performance.now();
      const focus = this._focusNow();
      // Held behind a card is not stale: a reward toast from the answer she
      // is still reading starts its 8 s only once the card closes.
      if (focus) for (const q of this._toastQueue) q.at = now;
      this._toastQueue = this._toastQueue.filter((q) => now - q.at < TOAST_STALE_MS);
      if (!this._toastQueue.length) return;
      // Only warnings may go while a card is open or both slots are still young.
      const full = this._toasts.length >= MAX_VISIBLE_TOASTS && now - this._toasts[0].shownAt < TOAST_MIN_MS;
      const i = focus || full ? this._toastQueue.findIndex((q) => q.kind === 'warn' || q.kind === 'bad') : 0;
      if (i >= 0) {
        const [next] = this._toastQueue.splice(i, 1);
        this._toastNextAt = 0;
        this.toast(next.message, next.kind);
      }
      // Keep checking while anything waits (a card closing frees the line).
      if (this._toastQueue.length) this._drainToasts();
    }, wait);
  }

  _toastLife(message) {
    return Math.min(TOAST_MAX_MS, TOAST_MIN_MS + message.length * TOAST_PER_CHAR_MS);
  }

  _dismissToast(entry) {
    const i = this._toasts.indexOf(entry);
    if (i < 0) return;
    this._toasts.splice(i, 1);
    clearTimeout(entry.timer);
    entry.node.classList.add('is-out');
    // Remove after the fade rather than on a transitionend that may never fire
    // (the element can be detached while a tab is backgrounded).
    setTimeout(() => entry.node.remove(), 220);
  }

  // --- contract: the question modal ---------------------------------------

  /**
   * Open the question modal (spec §1.3, §5.5).
   *
   * Renders BOTH authored answer shapes:
   *   - `type: 'choice'` — one big button per `choices[i].text`, in a shuffle
   *     that is stable per question id.
   *   - anything else (`type: 'text'`) — a text input plus a Submit button.
   *
   * A wrong answer costs nothing: the modal stays open, every control stays
   * enabled, `hint` appears under the answers, and the child tries again. `cb`
   * is called on EVERY graded attempt — `cb(false, given)` for a wrong one,
   * `cb(true, given)` for the right one — so the caller can record the attempt
   * and fire its own toasts. The modal is closed by the child, not by the
   * callback, so they get to read the `success` explanation.
   *
   * @param {object|string} question  a Question from questions.js, or its id
   * @param {(ok:boolean, given?:string)=>void} cb
   * @param {object}   [options]
   * @param {(given:string)=>boolean|{ok:boolean,message?:string}} [options.validate]
   *        override grading — e.g. `(a) => engine.attempt(q.id, a)` — so the
   *        engine stays the single source of truth when the caller wants that.
   * @param {()=>void} [options.onDismiss]  called if the child closes unanswered
   * @returns {void}
   */
  askQuestion(question, cb, options = {}) {
    const q = typeof question === 'string' ? getQuestion(question) : question;
    if (!q || typeof q !== 'object') {
      // Never leave the caller hanging: an unknown question is a no-op toast,
      // not a frozen input state waiting on a modal that never opened.
      this.toast('That station has nothing to ask right now.', 'warn');
      return;
    }

    const token = Symbol('question');
    this._modal = {
      question: q,
      cb: typeof cb === 'function' ? cb : () => {},
      validate: typeof options.validate === 'function' ? options.validate : null,
      onDismiss: typeof options.onDismiss === 'function' ? options.onDismiss : null,
      wrongCount: 0,
      answered: false,
      token
    };

    this._qTitle.textContent = q.title || 'Question';
    const meta = [q.subject, q.difficulty].filter(Boolean).join(' • ');
    this._qMeta.textContent = meta;
    this._qMeta.hidden = !meta;
    this._qPrompt.textContent = q.prompt || '';

    this._renderVisual(q.visual);
    this._renderAnswers(q);

    this._qFeedback.hidden = true;
    this._qFeedback.textContent = '';
    this._qFeedback.className = 'rv-feedback';
    this._qContinue.hidden = true;
    this._qContinue.textContent = 'Continue';
    this._qClose.textContent = 'Close';
    // No way out before answering (lead rule: questions can't be skipped).
    this._qClose.hidden = true;

    this._qParentBody.textContent = '';
    if (q.parentHint) {
      this._qParentBody.appendChild(el('p', 'rv-parent__line', q.parentHint));
      this._qParent.hidden = false;
    } else {
      this._qParent.hidden = true;
    }
    this._qParent.open = false;

    this._backdrop.hidden = false;
    this._backdrop.classList.add('is-open');
    this.root.classList.add('rv-hud--modal');
    // Focus mode outside the HUD too: the play pills (nav text, mining hint)
    // live on <body> and hide under this class (src/play/ui.js).
    document.body.classList.add('rv-question-open');

    // Focus the first control so a keyboard/tab user is inside the dialog, and
    // so typing goes to the answer box instead of the movement handler.
    const first = this._qTextRow.hidden ? this._qChoices.querySelector('button') : this._qInput;
    if (first) setTimeout(() => { try { first.focus(); } catch { /* detached */ } }, 0);
  }

  /**
   * Is the question modal open? The caller freezes game input while this is
   * true — that is the whole reason it is exported.
   * @returns {boolean}
   */
  isModalOpen() {
    return !!this._modal;
  }

  /**
   * Close the modal. Safe to call when nothing is open.
   * @returns {void}
   */
  closeQuestion() {
    const session = this._modal;
    this._modal = null;
    this._backdrop.hidden = true;
    this._backdrop.classList.remove('is-open');
    this.root.classList.remove('rv-hud--modal');
    document.body.classList.remove('rv-question-open');
    this._qChoices.textContent = '';
    this._qInput.value = '';
    if (session && !session.answered && session.onDismiss) session.onDismiss();
  }

  _renderVisual(visual) {
    this._qVisual.textContent = '';
    const rows = visual && Array.isArray(visual.rows) ? visual.rows : [];
    if (rows.length === 0) {
      this._qVisual.hidden = true;
      return;
    }
    rows.forEach((row) => {
      const line = el('div', 'rv-visual__row');
      if (row && row.label) line.appendChild(el('span', 'rv-visual__label', row.label));
      const tiles = row && Array.isArray(row.tiles) ? row.tiles : [];
      for (const tile of tiles) {
        const text = String(tile);
        // Long tiles get a wide box so "− 4 L each minute" is not squeezed into
        // a 38px square (L2's `.tile.wide` rule).
        const node = el('span', `rv-tile${text.length > 3 ? ' is-wide' : ''}`, text);
        line.appendChild(node);
      }
      this._qVisual.appendChild(line);
      // `arrow: true` means "flows into the next row", so the arrow goes BETWEEN.
      if (row && row.arrow) this._qVisual.appendChild(el('div', 'rv-visual__arrow', '↓'));
    });
    this._qVisual.hidden = false;
  }

  _renderAnswers(q) {
    this._qChoices.textContent = '';
    // The choice buttons are rebuilt per question, but the container and the
    // text controls are reused — so their "answered" state must be cleared here
    // or question N+1 opens already greyed out and unanswerable.
    this._qChoices.classList.remove('is-done');
    this._qInput.disabled = false;
    this._qSubmit.disabled = false;

    const isChoice = q.type === 'choice' && Array.isArray(q.choices) && q.choices.length > 0;

    if (isChoice) {
      const ordered = seededShuffle(q.choices, hashSeed(q.id || q.title || 'q'));
      for (const choice of ordered) {
        const text = choice && typeof choice === 'object' ? String(choice.text ?? '') : String(choice ?? '');
        const button = el('button', 'rv-choice', text);
        button.type = 'button';
        button.addEventListener('click', () => {
          // The choice OBJECT is graded (identity-safe against checkAnswer's
          // `choices.includes`), but the caller gets the TEXT, which is what
          // QuestEngine.answer() accepts.
          this._grade(choice, text, button);
        });
        this._qChoices.appendChild(button);
      }
      this._qChoices.hidden = false;
      this._qTextRow.hidden = true;
    } else {
      this._qChoices.hidden = true;
      this._qTextRow.hidden = false;
      this._qInput.value = '';
    }
  }

  _submitText() {
    if (!this._modal) return;
    const given = this._qInput.value.trim();
    if (!given) {
      this._showFeedback('Type your answer in the box, then press Submit.', 'warn');
      try { this._qInput.focus(); } catch { /* detached */ }
      return;
    }
    this._grade(given, given, null);
  }

  /**
   * Grade one attempt.
   * @param {*} graded   what the grader sees (choice object, or the typed text)
   * @param {string} given  what the caller sees — always a string
   * @param {HTMLElement|null} sourceButton  the clicked choice, for marking
   */
  _grade(graded, given, sourceButton) {
    const session = this._modal;
    if (!session || session.answered) return;
    const q = session.question;

    let ok;
    let message = '';
    if (session.validate) {
      const verdict = session.validate(given);
      if (verdict && typeof verdict === 'object') {
        ok = verdict.ok === true;
        message = typeof verdict.message === 'string' ? verdict.message : '';
      } else {
        ok = verdict === true;
      }
    } else {
      ok = checkAnswer(q, graded);
    }

    if (!ok) {
      session.wrongCount += 1;
      if (sourceButton) {
        // Marked as tried, NOT disabled — nothing is taken away on a wrong answer.
        sourceButton.classList.add('is-wrong');
        sourceButton.classList.remove('is-shake');
        void sourceButton.offsetWidth;
        sourceButton.classList.add('is-shake');
      } else {
        this._qInput.select();
      }
      session.cb(false, given);
      if (session.wrongCount >= this.maxTries) {
        // Out of tries: show the answer, then the chapter starts again.
        session.failed = true;
        this._qChoices.classList.add('is-done');
        this._qInput.disabled = true;
        this._qSubmit.disabled = true;
        const right = (q.choices || []).find((c) => c && c.correct)?.text || (q.answers || [])[0] || '';
        this._showFeedback(`That was your ${this.maxTries === 2 ? 'second' : 'last'} try. ${right ? `The answer was: ${right.replace(/[.!?]+$/, '')}. ` : ''}${String(q.success || '').replace(/^(Correct|Right|Yes|Great|Exactly)[!.:,]*\s*/i, '')} This chapter starts again from the beginning. You can do it!`.replace(/\s+/g, ' ').trim(), 'warn');
        this._qContinue.textContent = 'Start the chapter again';
        this._qContinue.hidden = false;
        try { this._qContinue.focus(); } catch { /* detached */ }
        return;
      }
      const left = this.maxTries - session.wrongCount;
      this._showFeedback(`${message || wrongAnswerMessage(q, session.wrongCount)} ${left === 1 ? 'One more try!' : `${left} tries left.`}`, 'warn');
      return;
    }

    session.answered = true;
    if (sourceButton) sourceButton.classList.add('is-right');
    this._qChoices.classList.add('is-done');
    this._qInput.disabled = true;
    this._qSubmit.disabled = true;
    this._showFeedback(message || q.success || 'Correct!', 'good');
    try { this.onCorrect?.(); } catch { /* celebration only */ }
    this._qContinue.hidden = false;
    this._qClose.textContent = 'Done';
    try { this._qContinue.focus(); } catch { /* detached */ }

    // The world may start rebuilding itself behind the modal; the child keeps
    // reading the explanation until they press Continue. The controls are
    // re-enabled in _renderAnswers when the next question opens, NOT here.
    session.cb(true, given);
  }

  _showFeedback(text, kind) {
    this._qFeedback.className = `rv-feedback is-${kind}`;
    this._qFeedback.textContent = text;
    this._qFeedback.hidden = false;
  }

  // --- contract: flight readout -------------------------------------------

  /**
   * Launch telemetry — altitude / speed / fuel / mass (contracts.js FlightSample).
   *
   * FlightSample carries `massKg` but no fuel figure, so fuel is read from any of
   * `fuelKg` / `fuelMassKg` / `fuelPct`, or derived as `massKg - dryMassKg` when
   * the caller supplies the dry mass. Missing fuel shows "—" rather than a lie.
   *
   * Pass `null` to hide the panel.
   *
   * @param {object|null} sample
   * @returns {void}
   */
  setFlightReadout(sample) {
    if (!sample || typeof sample !== 'object') {
      this._flight.hidden = true;
      return;
    }
    this._flight.hidden = false;

    const altitude = num(sample.altitudeM, 0);
    this._flightCells.altitude.textContent =
      altitude >= 1000 ? `${(altitude / 1000).toFixed(1)} km` : `${group(altitude)} m`;

    this._flightCells.velocity.textContent = `${group(num(sample.velocityMs, 0))} m/s`;

    this._flightCells.fuel.textContent = this._fuelText(sample);

    const mass = num(sample.massKg, NaN);
    this._flightCells.mass.textContent = Number.isFinite(mass) ? `${group(mass)} kg` : '—';

    const note = sample.apogee
      ? (IS_L1 ? 'The highest point!' : 'Apogee — the highest point of the flight.')
      : sample.burning
        ? 'Engine burning.'
        : 'Engine cut off — coasting.';
    this._flightNote.textContent = note;
    this._flight.classList.toggle('is-burning', sample.burning === true);
  }

  _fuelText(sample) {
    const pct = num(sample.fuelPct, NaN);
    if (Number.isFinite(pct)) return `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
    const direct = num(sample.fuelKg ?? sample.fuelMassKg, NaN);
    if (Number.isFinite(direct)) return `${group(Math.max(0, direct))} kg`;
    const dry = num(sample.dryMassKg, NaN);
    const mass = num(sample.massKg, NaN);
    if (Number.isFinite(dry) && Number.isFinite(mass)) return `${group(Math.max(0, mass - dry))} kg`;
    return '—';
  }

  // --- interact prompt ----------------------------------------------------

  /**
   * The centred "Press E" pill. Shown and hidden by the caller as the player
   * walks in and out of a station's radius.
   *
   * @param {string|null} text  what pressing E does, e.g. "Take the Cadet Test".
   *                            Falsy hides the pill.
   * @param {string} [key]      the key cap glyph, default "E"
   * @returns {void}
   */
  setInteract(text, key = 'E') {
    const label = typeof text === 'string' ? text.trim() : '';
    if (!label) {
      this._interact.hidden = true;
      this._interactActionable = false;
      return;
    }
    this._interactKey.textContent = key;
    this._interactText.textContent = label;
    this._interact.hidden = false;

    // A quiet cue exactly on the rising edge of "there is something to DO
    // here" — not every frame the caller re-asserts the same pill (this is
    // driven from the game loop while the child stands still), and not for
    // a "Not yet" prompt, which has no key and nothing to press.
    const actionable = !!(typeof key === 'string' ? key.trim() : key);
    if (actionable && !this._interactActionable) audio.promptReady();
    this._interactActionable = actionable;
  }

  /** Convenience alias. @param {string} text @param {string} [key] */
  showInteract(text, key) {
    this.setInteract(text, key);
  }

  /** Hide the interact pill. */
  hideInteract() {
    this.setInteract(null);
  }

  // --- parent hints -------------------------------------------------------

  /**
   * Fill the collapsed Parent Hints panel (spec §5.6). Accepts either the
   * output of questions.js `parentHintsFor()`, or a bare list of reached
   * question ids, which it resolves itself — so the caller can hand it
   * `engine.reachedQuestionIds()` directly.
   *
   * @param {string[]|{id:string,title:string,parentHint:string}[]} entries
   * @returns {void}
   */
  setParentHints(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const resolved = list.length && typeof list[0] === 'string' ? parentHintsFor(list) : list;

    this._parentInner.textContent = '';
    if (!resolved.length) {
      this._parentInner.appendChild(
        el('p', 'rv-parent__line', 'Hints appear here as your child reaches each station.')
      );
      return;
    }
    const ul = el('ul', 'rv-parent__list');
    for (const entry of resolved) {
      if (!entry || typeof entry !== 'object') continue;
      const li = el('li');
      li.appendChild(el('b', 'rv-parent__title', entry.title || entry.id || ''));
      li.appendChild(el('span', 'rv-parent__text', ` ${entry.parentHint || ''}`));
      ul.appendChild(li);
    }
    this._parentInner.appendChild(ul);
  }

  // --- convenience --------------------------------------------------------

  /**
   * Pull every surface from a QuestEngine in one call, using the engine's own
   * authored text (statusLine / missionCard / badges) rather than re-deriving it.
   * Duck-typed on purpose: anything with those methods works, and the HUD does
   * not import quests.js.
   *
   * @param {object} engine  a QuestEngine
   * @returns {void}
   */
  update(engine) {
    if (!engine || typeof engine !== 'object') return;
    const pct = typeof engine.progressPercent === 'function' ? engine.progressPercent() : 0;
    const status = typeof engine.statusLine === 'function' ? engine.statusLine() : '';
    this.setProgress(pct, status);
    if (typeof engine.missionCard === 'function') this.setMission(engine.missionCard());
    if (typeof engine.badges === 'function') this.setBadges(engine.badges());
    if (engine.state) {
      this.setInventory(engine.state.inventory);
      this.setRank(engine.state.rank, engine.state.xp);
    }
    if (typeof engine.reachedQuestionIds === 'function') this.setParentHints(engine.reachedQuestionIds());
  }

  // --- spawn direction cue -------------------------------------------------

  /**
   * Surface the mission card's own first line once, big and central, so a
   * child who just spawned on an open road has something impossible to miss
   * telling them which way to go. Reads whatever `setMission` already put in
   * the sidebar — never authors its own text — so it can never say something
   * quests.js does not.
   */
  _showOnboard() {
    if (this._onboardShown || this._destroyed) return;
    // Behind the chapter opening or a play card it would be wasted: wait.
    if (this._focusNow()) {
      this._onboardTimers.push(setTimeout(() => this._showOnboard(), 600));
      return;
    }
    const first = this._missionLines && this._missionLines.querySelector('.rv-mission__line');
    const text = first ? first.textContent.trim() : '';
    if (!text) return; // nothing authored yet — say nothing rather than guess

    this._onboardShown = true;
    this._onboardText.textContent = text;
    this._onboard.hidden = false;
    // rAF so the browser paints the hidden->visible flip before the
    // transition starts, or the fade-in never runs.
    requestAnimationFrame(() => this._onboard.classList.add('is-in'));
    this._onboardTimers.push(setTimeout(() => this._hideOnboard(), ONBOARD_LIFE_MS));
  }

  _hideOnboard() {
    if (!this._onboard || this._onboard.hidden) return;
    this._onboard.classList.remove('is-in');
    this._onboard.classList.add('is-out');
    this._onboardTimers.push(setTimeout(() => {
      if (this._onboard) this._onboard.hidden = true;
    }, 420));
  }

  /** Remove every node and timer this HUD owns. */
  destroy() {
    if (this._onMissionKey) removeEventListener('keydown', this._onMissionKey);
    this._destroyed = true;
    for (const entry of this._toasts.slice()) this._dismissToast(entry);
    clearTimeout(this._toastQueueTimer);
    for (const t of this._onboardTimers.splice(0)) clearTimeout(t);
    this.closeQuestion();
    this.root.remove();
  }
}

/**
 * Build and mount the HUD.
 *
 * @param {object} [options]  see Hud's constructor
 * @returns {Hud}
 */
export function createHud(options) {
  return new Hud(options);
}

export default createHud;
