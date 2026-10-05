// Every OTHER blocking card the HUD can show, sharing the one modalHost:
// "Did you know?" facts, story dialogue, the upgrade shop, the controls
// help screen, the end card, and the pause menu. Each function fills the
// shared card and returns a Promise that resolves when the child dismisses
// it — `showFact` / `showControls` / `showEnd` don't have to be awaited
// (nothing meaningful comes back), but returning a promise anyway costs
// nothing and lets a caller `await` them for pacing if it wants to.

import { el, svg, heroName } from './domUtil.js';
import { t } from '../level.js';
import { iconInner } from './icons.js';
import { RESOURCES } from '../contracts.js';

const CONTROL_ROWS = [
  ['W / S', 'Main engine forward / reverse thrust'],
  ['A / D', 'Rotate the ship'],
  ['Z / X', 'Nudge sideways, left / right (lining up on an asteroid)'],
  ['T', t('Auto-turn on / off: steer the ship yourself, or let it point itself', 'Auto-turn on or off')],
  ['Esc', 'Pause menu (with "Try again from my last question")'],
  ['Shift', t('Precision (gentle) thrust', 'Gentle push')],
  ['Space', t('Hold to stop spinning. On Easy, holding Space also turns the ship to follow the arrow.', 'Hold to stop spinning')],
  ['M', 'System map — plan transfers, see where planets will be'],
  ['N', 'Show or hide the small top-down map (bottom right)'],
  ['1 – 4', 'Time warp (only far from planets)'],
  ['E', t('Interact — claw, scan, land, dock', 'Use: grab, scan, land')],
  ['U', 'Upgrade bay (in the asteroid belt)'],
  ['R', t('Rescue — rewind 10 seconds, no penalty', 'Help! Go back 10 seconds')],
  ['J', 'Show / hide the mission card'],
  ['H', 'This help screen'],
  ['Mouse drag / wheel', 'Orbit the camera / zoom'],
];

/** @param {ReturnType<typeof import('./modalHost.js').createModalHost>} host */
export function createOverlays(host) {
  /** @param {{title:string, body:string, image?:string}} fact */
  function showFact(fact) {
    return new Promise((resolve) => {
      if (!fact) { resolve(); return; }
      host.open((root) => {
        root.appendChild(el('div', 'sp-modal__eyebrow', 'Did you know?'));
        root.appendChild(el('h3', 'sp-modal__title', fact.title || ''));
        if (fact.image) {
          const img = el('img', 'sp-modal__image');
          img.src = fact.image;
          img.alt = fact.title || '';
          root.appendChild(img);
        }
        root.appendChild(el('p', 'sp-modal__body', fact.body || ''));
        const actions = el('div', 'sp-modal__actions');
        const ok = el('button', 'sp-btn', 'Got it');
        ok.type = 'button';
        ok.addEventListener('click', finish);
        actions.appendChild(ok);
        root.appendChild(actions);
        setTimeout(() => { try { ok.focus(); } catch { /* detached */ } }, 0);
      }, { onEscape: finish });

      function finish() { host.close(); resolve(); }
    });
  }

  /** @param {{who:string, text:string}[]} lines */
  function showDialogue(lines) {
    return new Promise((resolve) => {
      const list = Array.isArray(lines) ? lines.filter((l) => l && l.text) : [];
      if (!list.length) { resolve(); return; }
      let i = 0;

      const who = el('div', 'sp-dialogue__who', '');
      const text = el('div', 'sp-dialogue__text', '');
      const dots = el('div', 'sp-dialogue__dots');
      const dotEls = list.map(() => el('span', 'sp-dialogue__dot'));
      dotEls.forEach((d) => dots.appendChild(d));
      const actions = el('div', 'sp-modal__actions');
      const next = el('button', 'sp-btn sp-dialogue__next', list.length > 1 ? 'Next' : 'Continue');
      next.type = 'button';
      actions.appendChild(next);

      const advance = (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } };

      host.open((root) => {
        root.appendChild(who);
        root.appendChild(text);
        root.appendChild(dots);
        root.appendChild(actions);
        render();
        host.backdrop.addEventListener('keydown', advance);
        next.addEventListener('click', step);
      }, { onEscape: () => { host.backdrop.removeEventListener('keydown', advance); host.close(); resolve(); } });

      function render() {
        const line = list[i];
        who.textContent = line.who === 'girl' ? heroName() : (line.who || 'Mission Control');
        text.textContent = line.text;
        dotEls.forEach((d, idx) => d.classList.toggle('is-active', idx === i));
        next.textContent = i === list.length - 1 ? 'Continue' : 'Next';
      }
      function step() {
        i += 1;
        if (i >= list.length) { host.backdrop.removeEventListener('keydown', advance); host.close(); resolve(); return; }
        render();
      }
    });
  }

  /** @param {{upgrades: Object<string, object>, resources: Object<string, number>, owned?: Iterable<string>}} opts */
  function openUpgrades({ upgrades, resources, owned } = {}) {
    return new Promise((resolve) => {
      const entries = Object.entries(upgrades && typeof upgrades === 'object' ? upgrades : {});
      const res = resources && typeof resources === 'object' ? resources : {};
      // Already-built upgrades stay on the list (so she can see what she has)
      // but can't be bought twice.
      const ownedIds = new Set(owned || []);

      host.open((root) => {
        root.appendChild(el('div', 'sp-modal__eyebrow', 'Build it'));
        root.appendChild(el('h3', 'sp-modal__title', 'Upgrades'));
        if (!entries.length) {
          root.appendChild(el('p', 'sp-modal__body', t('Nothing to build yet — keep exploring.', 'Nothing to build yet. Keep going!')));
        }
        const grid = el('div', 'sp-upgrades');
        for (const [id, def] of entries) {
          const cost = def && def.cost && typeof def.cost === 'object' ? def.cost : {};
          const built = ownedIds.has(id);
          const affordable = Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v);
          const btn = el('button', `sp-upgrade${built ? ' is-built' : affordable ? '' : ' is-unaffordable'}`);
          btn.type = 'button';
          btn.disabled = built || !affordable;
          btn.appendChild(el('div', 'sp-upgrade__name', def.label || id));
          if (built) { btn.appendChild(el('div', 'sp-upgrade__req', 'Built ✓')); grid.appendChild(btn); continue; }
          if (def.required) btn.appendChild(el('div', 'sp-upgrade__req', `Required ${def.required}`));
          const costRow = el('div', 'sp-upgrade__cost');
          for (const [k, v] of Object.entries(cost)) {
            const have = res[k] || 0;
            const label = (RESOURCES[k] && RESOURCES[k].label) || k;
            // One decimal: ore comes in 1.4 t pieces (it showed 2.8000000000000003).
            const chip = el('span', `sp-upgrade__chip${have >= v ? '' : ' is-short'}`, `${label} ${Math.round(have * 10) / 10}/${v}`);
            costRow.appendChild(chip);
          }
          btn.appendChild(costRow);
          btn.addEventListener('click', () => { host.close(); resolve(id); });
          grid.appendChild(btn);
        }
        root.appendChild(grid);
        const actions = el('div', 'sp-modal__actions');
        const cancel = el('button', 'sp-btn sp-btn--ghost', 'Not now');
        cancel.type = 'button';
        cancel.addEventListener('click', () => { host.close(); resolve(null); });
        actions.appendChild(cancel);
        root.appendChild(actions);
      }, { onEscape: () => { host.close(); resolve(null); }, wide: true });
    });
  }

  /**
   * Pick how much the game helps with flying and mining: Easy / Medium / Hard.
   * @param {{modes: Object<string, {id,label,rank,blurb}>, current?: string, first?: boolean}} opts
   * @returns {Promise<string|null>} the chosen id, or null if closed without choosing
   */
  function chooseFlightMode({ modes, current = 'medium', first = false } = {}) {
    return new Promise((resolve) => {
      host.open((root) => {
        root.appendChild(el('div', 'sp-modal__eyebrow', first ? 'Before you launch' : 'Flying mode'));
        root.appendChild(el('h3', 'sp-modal__title', 'How much help do you want?'));
        root.appendChild(el('p', 'sp-modal__body', 'This changes the flying and the rock-hunting, not the questions. You can change it any time from the pause menu (Esc).'));
        const grid = el('div', 'sp-upgrades sp-modes');
        for (const m of Object.values(modes || {})) {
          const btn = el('button', `sp-upgrade sp-mode${m.id === current ? ' is-current' : ''}`);
          btn.type = 'button';
          btn.appendChild(el('div', 'sp-upgrade__name', `${m.label} · ${m.rank}`));
          btn.appendChild(el('div', 'sp-mode__blurb', m.blurb));
          if (m.id === current) btn.appendChild(el('div', 'sp-upgrade__req', first ? 'Suggested' : 'Current'));
          btn.addEventListener('click', () => { host.close(); resolve(m.id); });
          grid.appendChild(btn);
        }
        root.appendChild(grid);
      }, { onEscape: () => { host.close(); resolve(null); }, wide: true });
    });
  }

  /**
   * A picker of a few options (a mini-game's level, say).
   * options: [{id, label, blurb, tag?}]; resolves the chosen id, or null on Esc.
   */
  function choose({ eyebrow = '', title = '', body = '', options = [], current = null } = {}) {
    return new Promise((resolve) => {
      host.open((root) => {
        if (eyebrow) root.appendChild(el('div', 'sp-modal__eyebrow', eyebrow));
        root.appendChild(el('h3', 'sp-modal__title', title));
        if (body) root.appendChild(el('p', 'sp-modal__body', body));
        const grid = el('div', 'sp-upgrades sp-modes');
        for (const o of options) {
          const btn = el('button', `sp-upgrade sp-mode sp-pick${o.id === current ? ' is-current' : ''}`);
          btn.type = 'button';
          btn.dataset.pick = o.id;
          btn.appendChild(el('div', 'sp-upgrade__name', o.label));
          if (o.blurb) btn.appendChild(el('div', 'sp-mode__blurb', o.blurb));
          if (o.tag) btn.appendChild(el('div', 'sp-upgrade__req', o.tag));
          btn.addEventListener('click', () => { host.close(); resolve(o.id); });
          grid.appendChild(btn);
        }
        root.appendChild(grid);
      }, { onEscape: () => { host.close(); resolve(null); }, wide: true });
    });
  }

  function showControls() {
    return new Promise((resolve) => {
      host.open((root) => {
        const titleRow = el('div', 'sp-panel__title');
        titleRow.appendChild(svg(iconInner('help')));
        titleRow.appendChild(document.createTextNode('Controls'));
        root.appendChild(titleRow);
        root.appendChild(el('h3', 'sp-modal__title', 'How to Fly'));
        const table = el('table', 'sp-controls-table');
        for (const [key, desc] of CONTROL_ROWS) {
          const tr = el('tr');
          const tdKey = el('td');
          for (const part of key.split(' / ')) {
            tdKey.appendChild(el('span', 'sp-key', part));
          }
          const tdDesc = el('td', null, desc);
          tr.append(tdKey, tdDesc);
          table.appendChild(tr);
        }
        root.appendChild(table);
        const actions = el('div', 'sp-modal__actions');
        const close = el('button', 'sp-btn', 'Close');
        close.type = 'button';
        close.addEventListener('click', finish);
        actions.appendChild(close);
        root.appendChild(actions);
      }, { onEscape: finish, wide: true });
      function finish() { host.close(); resolve(); }
    });
  }

  /** @param {{name?:string, route?:string[], samples?:string[], stats?:object, credits?:string[]}} data */
  function showEnd(data = {}) {
    return new Promise((resolve) => {
      host.open((root) => {
        root.appendChild(el('div', 'sp-modal__eyebrow', data.eyebrow || 'Mission complete'));
        root.appendChild(el('h3', 'sp-modal__title', data.title || `${data.name || heroName()} reached Europa!`));
        if (data.note) root.appendChild(el('p', 'sp-modal__body', data.note));
        if (data.route && data.route.length) {
          root.appendChild(el('p', 'sp-modal__body', `Route flown: ${data.route.join(' → ')}`));
        }
        if (data.stats && typeof data.stats === 'object') {
          const grid = el('div', 'sp-end__stats');
          for (const [label, value] of Object.entries(data.stats)) {
            const cell = el('div', 'sp-end__stat');
            cell.appendChild(el('b', null, String(value)));
            cell.appendChild(el('span', null, label));
            grid.appendChild(cell);
          }
          root.appendChild(grid);
        }
        if (data.samples && data.samples.length) {
          root.appendChild(el('div', 'sp-panel__title', 'Samples collected'));
          const row = el('div', 'sp-end__samples');
          for (const s of data.samples) row.appendChild(el('span', 'sp-end__sample', s));
          root.appendChild(row);
        }
        const creditLines = Array.isArray(data.credits) && data.credits.length
          ? data.credits
          : ['Planet textures: Solar System Scope (solarsystemscope.com), CC BY 4.0'];
        // The Solar System Scope credit line is contractual (the licence
        // requires it), so it is always included even if the caller forgets it —
        // append it if it isn't already one of the given lines.
        if (!creditLines.some((l) => /Solar System Scope/i.test(l))) {
          creditLines.push('Planet textures: Solar System Scope (solarsystemscope.com), CC BY 4.0');
        }
        const credits = el('div', 'sp-end__credits');
        creditLines.forEach((l) => credits.appendChild(el('div', null, l)));
        root.appendChild(credits);

        const actions = el('div', 'sp-modal__actions');
        const back = el('a', 'sp-btn sp-btn--ghost', 'Back to chapters');
        back.href = 'index.html';
        back.style.pointerEvents = 'auto';
        back.style.textDecoration = 'none';
        back.style.display = 'inline-block';
        const again = el('button', 'sp-btn', 'Fly again');
        again.type = 'button';
        again.addEventListener('click', () => { host.close(); resolve('again'); });
        actions.append(back, again);
        root.appendChild(actions);
      }, { wide: true });
    });
  }

  /** Esc-key pause menu: Resume / Controls / Back to chapters. Not part of the public API — hud.js wires this to the Esc key itself. */
  function pauseMenu({ onResume, onMode, onRetry } = {}) {
    return new Promise((resolve) => {
      host.open((root) => {
        root.classList.add('sp-pause');
        root.appendChild(el('h3', 'sp-modal__title', 'Paused'));
        const resume = el('button', 'sp-btn', 'Resume');
        resume.type = 'button';
        resume.addEventListener('click', () => { host.close(); if (onResume) onResume(); resolve('resume'); });
        const controls = el('button', 'sp-btn sp-btn--ghost', 'Controls');
        controls.type = 'button';
        controls.addEventListener('click', async () => {
          host.close();
          await showControls();
          pauseMenu({ onResume, onMode, onRetry }).then(resolve);
        });
        const back = el('a', 'sp-btn sp-btn--ghost', 'Back to chapters');
        back.href = 'index.html';
        back.style.pointerEvents = 'auto';
        back.style.textDecoration = 'none';
        back.style.display = 'inline-block';
        const mode = el('button', 'sp-btn sp-btn--ghost', 'Flying mode');
        mode.type = 'button';
        mode.addEventListener('click', async () => {
          host.close();
          if (onMode) await onMode();
          pauseMenu({ onResume, onMode, onRetry }).then(resolve);
        });
        // Retry (lead): back to just after her last question (src/space/retry.js).
        const retry = el('button', 'sp-btn sp-btn--ghost', '↺ Try again from my last question');
        retry.type = 'button';
        retry.addEventListener('click', () => { host.close(); resolve('retry'); onRetry?.(); });
        root.append(resume, retry, controls, mode, back);
      }, { onEscape: () => { host.close(); if (onResume) onResume(); resolve('resume'); } });
    });
  }

  return { showFact, showDialogue, openUpgrades, showControls, showEnd, pauseMenu, chooseFlightMode, choose };
}
