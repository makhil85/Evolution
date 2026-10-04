// Play modes for the village chapters (1, 2 and 3): how much help she gets
// finding her way and how hard mining is. Chapter 4 has its own flying modes
// (src/space/contracts.js FLIGHT_MODES); these are the village equivalent.
//
// See PLAYMODES_PLAN.md. This file is the shared contract: the mode table,
// the saved choice, and the chooser. Chapters read `mode.<flag>` and never
// test the id, so a mode can be retuned here without touching a chapter.

import { ensurePlayStyles, openLayer, el, MODE_ICONS } from './ui.js';

export { isPlayModalOpen } from './ui.js';

export const PLAY_MODE_KEY = 'rocket_village_play_mode';

/**
 * @typedef {object} PlayMode
 * @property {'easy'|'medium'|'hard'} id
 * @property {string} label
 * @property {string} blurb        one line for the chooser (Level 4 wording)
 * @property {string} blurbL1      the same for Level 1 (simpler words)
 * @property {boolean} navArrow    an arrow at her feet points to the next objective
 * @property {boolean} targetBeacon a beacon over the next station
 * @property {boolean} resourceGlow resources glow so they are easy to spot
 * @property {number} mineHits     presses of E to mine one resource
 * @property {boolean} treasureHunt the final build needs a hidden key block found by following clues
 */

/** @type {Record<string, PlayMode>} */
export const PLAY_MODES = Object.freeze({
  easy: Object.freeze({
    id: 'easy', label: 'Easy',
    blurb: 'An arrow shows the way to your next goal, resources glow, and one press of E collects.',
    blurbL1: 'An arrow shows you where to go. Things to collect glow. Press E once to pick up.',
    navArrow: true, targetBeacon: true, resourceGlow: true, mineHits: 1, treasureHunt: false,
  }),
  medium: Object.freeze({
    id: 'medium', label: 'Medium',
    blurb: 'A marker shows the next station, but you find the way. Mining takes a few presses of E.',
    blurbL1: 'A marker shows the next place. You find the way. Press E a few times to mine.',
    navArrow: false, targetBeacon: true, resourceGlow: false, mineHits: 3, treasureHunt: false,
  }),
  hard: Object.freeze({
    id: 'hard', label: 'Hard',
    blurb: 'No arrows or markers. Mining is hard work. A key block is hidden in one of the homes - follow the clues to find it before the final build.',
    blurbL1: 'No arrows. Mining takes lots of presses. A treasure is hidden in a house - read the clues to find it!',
    navArrow: false, targetBeacon: false, resourceGlow: false, mineHits: 5, treasureHunt: true,
  }),
});

/** The saved mode, or null if she has not chosen yet. */
export function savedPlayModeId() {
  try {
    const id = localStorage.getItem(PLAY_MODE_KEY);
    return id && PLAY_MODES[id] ? id : null;
  } catch {
    return null;
  }
}

/** The current mode (Easy until she chooses). */
export function loadPlayMode() {
  return PLAY_MODES[savedPlayModeId() || 'easy'];
}

export function savePlayMode(id) {
  try { localStorage.setItem(PLAY_MODE_KEY, id); } catch { /* private mode */ }
}


/**
 * The "what changes" rows for a mode, in the order the chooser shows them.
 * (Pure: also used by the tests.)
 * @param {PlayMode} m
 * @returns {{ key: string, on: boolean, text: string }[]}
 */
export function describeMode(m) {
  return [
    { key: 'arrow', on: !!m.navArrow, text: m.navArrow ? 'Arrow shows the way' : 'No arrow' },
    { key: 'marker', on: !!m.targetBeacon, text: m.targetBeacon ? 'Marker over the next place' : 'No markers' },
    { key: 'mining', on: true, text: `Press E ${m.mineHits} ${m.mineHits === 1 ? 'time' : 'times'} to mine` },
    { key: 'hunt', on: !!m.treasureHunt, text: m.treasureHunt ? 'Treasure hunt with clues' : 'No treasure hunt' },
  ];
}

/**
 * Ask which mode she wants: a modal with three cards (Easy, Medium, Hard),
 * each with an icon, a blurb and a short "what changes" list; the current one
 * is outlined. Arrow keys move between cards, Enter (or a click) picks,
 * Escape keeps the current one. Resolves with the chosen id (and saves it).
 *
 * While it is open `document.body.dataset.playModal === '1'` (see ui.js): the
 * chapter must ignore movement / E while that is set.
 *
 * @param {{ level?: 1|4, current?: string, title?: string }} [opts]
 * @returns {Promise<string>}
 */
export function choosePlayMode({ level = 4, current = savedPlayModeId() || 'easy', title = 'How much help do you want?' } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(PLAY_MODES[current] ? current : 'easy'); return; }
    ensurePlayStyles();
    const ids = Object.keys(PLAY_MODES);
    const start = ids.includes(current) ? current : 'easy';

    const card = el('div', 'pl-card');
    card.appendChild(el('div', 'pl-eyebrow', 'Play mode'));
    card.appendChild(el('h2', 'pl-title', title));
    card.appendChild(el('p', 'pl-sub', level === 1
      ? 'This changes how much help you get. The questions stay the same. You can change it any time.'
      : 'This changes the help and the mining, not the questions. You can change it any time with the Help button.'));

    const row = el('div', 'pl-modes');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Play mode');
    const buttons = [];
    let layer = null;
    const pick = (id) => { savePlayMode(id); layer.close(); resolve(id); };

    for (const m of Object.values(PLAY_MODES)) {
      const b = el('button', `pl-mode${m.id === start ? ' is-current' : ''}`);
      b.type = 'button';
      b.dataset.mode = m.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', m.id === start ? 'true' : 'false');
      b.tabIndex = m.id === start ? 0 : -1;

      const head = el('div', 'pl-mode__head');
      const icon = el('span', 'pl-mode__icon');
      icon.innerHTML = MODE_ICONS[m.id] || '';
      head.append(icon, el('span', 'pl-mode__name', m.label));
      if (m.id === start) head.appendChild(el('span', 'pl-mode__tag', 'Current'));
      b.appendChild(head);
      b.appendChild(el('div', 'pl-mode__blurb', level === 1 ? m.blurbL1 : m.blurb));
      b.appendChild(el('div', 'pl-mode__whathead', 'What changes'));
      const ul = el('ul', 'pl-mode__what');
      for (const r of describeMode(m)) {
        const li = el('li', r.on ? 'is-on' : 'is-off');
        li.append(el('span', 'pl-ck', r.on ? '✓' : '–'), el('span', null, r.text));
        ul.appendChild(li);
      }
      b.appendChild(ul);
      b.addEventListener('click', () => pick(m.id));
      buttons.push(b);
      row.appendChild(b);
    }
    card.appendChild(row);
    const foot = el('div', 'pl-foot');
    foot.append('Use ', el('span', 'pl-key', '←'), ' ', el('span', 'pl-key', '→'), ' to look, ', el('span', 'pl-key', 'Enter'), ' to choose.');
    card.appendChild(foot);

    const focusAt = (i) => {
      const n = (i + buttons.length) % buttons.length;
      buttons.forEach((b, k) => { b.tabIndex = k === n ? 0 : -1; });
      buttons[n].focus();
    };
    const cur = () => Math.max(0, buttons.indexOf(document.activeElement));

    layer = openLayer(card, {
      onKey(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusAt(cur() + 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusAt(cur() - 1); }
        else if (e.key === 'Tab') { e.preventDefault(); focusAt(cur() + (e.shiftKey ? -1 : 1)); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) pick(ids[cur()]); }
        else if (e.key === 'Escape') { e.preventDefault(); pick(start); }
      },
    });
    focusAt(ids.indexOf(start));
  });
}

/**
 * A small pill showing the mode (icon + "Help: Easy") that reopens the chooser
 * when clicked. It sits at the top right on the SAME ROW as the page's
 * "Chapters" button, just left of it (the space under that button is the HUD's
 * progress bar). Override with `top` / `right` (CSS lengths) if a page differs.
 *
 * @param {{ level?: 1|4, onChange?: (id:string)=>void, top?: string, right?: string }} [opts]
 * @returns {{ el: HTMLElement, set: (id:string)=>void }}
 */
export function createModeChip({ level = 4, onChange = () => {}, top, right } = {}) {
  ensurePlayStyles();
  const chip = el('button', 'pl-chip');
  chip.type = 'button';
  if (top) chip.style.top = top;
  if (right) chip.style.right = right;
  const icon = el('span');
  icon.style.display = 'inline-flex';
  const word = el('span', 'pl-chip__word', 'Help:');
  const label = el('span', 'pl-chip__label');
  chip.append(icon, word, label);
  const set = (id) => {
    const m = PLAY_MODES[id] || PLAY_MODES.easy;
    chip.dataset.mode = m.id;
    icon.innerHTML = MODE_ICONS[m.id] || '';
    label.textContent = m.label;
    chip.title = 'Change how much help you get';
    chip.setAttribute('aria-label', `Help: ${m.label}. Press to change.`);
  };
  set(loadPlayMode().id);
  chip.addEventListener('click', async () => {
    const id = await choosePlayMode({ level, current: loadPlayMode().id });
    set(id);
    onChange(id);
  });
  document.body.appendChild(chip);
  return { el: chip, set };
}
