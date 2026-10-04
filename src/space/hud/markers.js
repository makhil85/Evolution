// Off-screen arrows + on-screen brackets for `hud.setMarkers()`.
//
// The caller (camera.js / controls.js, phase 2) does the 3-D-to-2-D
// projection and hands over screen-space points; this module only decides
// how to DRAW a point that's already known. `onScreen: false` points get
// clamped to the viewport edge and rotated to point at the real target so
// "where is Mars" is answerable with a glance even when Mars is behind you.

import { el, svg } from './domUtil.js';
import { iconInner } from './icons.js';

// Off-screen arrows clamp to a SAFE rectangle, not the raw viewport edge —
// otherwise an arrow for something behind-and-left of the ship lands right
// on top of the instrument cluster, and behind-and-right lands on the
// mission/orbit sidebar. Fallback numbers if the real panels aren't wired in
// (older callers / tests); `createMarkers(root, {leftPanel, rightPanel})`
// measures the ACTUAL panels instead, so a width tweak in hud.css can never
// drift out of sync with this clamp again.
const FALLBACK_MARGIN = { left: 348, right: 398, top: 16, bottom: 16 };
// A label is centred on its marker and can be ~150-200px wide (e.g. "Dead
// Satellite · 860 u"), so the gutter has to clear roughly half of that, not
// just a visual breathing gap, or a clamped label can still lap onto the
// panel its anchor point was pushed clear of.
const GUTTER = 100;
// The other HUD pieces a marker must never cover (besides the two side
// columns and the burn banner): the inset map, the transfer and landing
// panels, the aim dial, the Retry and autopilot buttons, the toasts.
const KEEP_OUT = ['.sp-minimap:not(.is-off):not(.is-hidden)', '.sp-xfer:not([hidden])', '.sp-landing:not([hidden])', '.sp-aim:not([hidden])', '.sp-retry', '.sp-autopilot', '.sp-toasts'];

export function createMarkers(root, { leftPanel, rightPanel } = {}) {
  const layer = el('div', 'sp-markers');
  root.appendChild(layer);

  /** Live safe-zone insets, measured from the real panels when given. */
  function safeMargin(w) {
    const rootRect = root.getBoundingClientRect();
    const left = leftPanel ? leftPanel.getBoundingClientRect().right - rootRect.left + GUTTER : FALLBACK_MARGIN.left;
    const right = rightPanel ? rootRect.right - rightPanel.getBoundingClientRect().left + GUTTER : FALLBACK_MARGIN.right;
    // Guard against a not-yet-laid-out panel (zero-width rect) swallowing the
    // whole safe zone — fall back rather than clamp everything to one edge.
    // The panels' own boxes too (root coordinates), padded by the gutter
    // sideways (a centred label is ~200 px wide) and a little up and down:
    // an ON-screen target under one is hidden behind the card, label and all.
    const boxes = [leftPanel, rightPanel].filter(Boolean).map((p) => {
      const r = p.getBoundingClientRect();
      return { l: r.left - rootRect.left - GUTTER, r: r.right - rootRect.left + GUTTER, t: r.top - rootRect.top - 14, b: r.bottom - rootRect.top + 14 };
    }).filter((b) => b.r - b.l > 2 * GUTTER + 4);
    // The burn banner too: a planet label used to sit right on top of it
    // ("Moon · 356 u" over "On course for the Moon").
    const cueEl = document.getElementById('burnCue');
    if (cueEl && cueEl.style.display !== 'none') {
      const r = cueEl.getBoundingClientRect();
      if (r.width > 0) boxes.push({ l: r.left - rootRect.left - GUTTER, r: r.right - rootRect.left + GUTTER, t: r.top - rootRect.top - 14, b: r.bottom - rootRect.top + 14 });
    }
    // Keep-out boxes for the WHOLE marker (icon + label), unpadded. The anchor
    // test above only looks at the target's point, and a point inside the
    // safe rectangle is never moved by the edge clamp: a target just above
    // the banner (or under it) kept its label right on the banner text
    // (play-test: "Europa · 2,226 u", "Moon · 12 u").
    const keep = [];
    const nodes = [leftPanel, rightPanel, cueEl, ...KEEP_OUT.map((sel) => document.querySelector(sel))];
    for (const n of nodes) {
      if (!n || (n === cueEl && n.style.display === 'none')) continue;
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) keep.push({ l: r.left - rootRect.left - 4, r: r.right - rootRect.left + 4, t: r.top - rootRect.top - 4, b: r.bottom - rootRect.top + 4 });
    }
    return {
      left: left > 4 ? left : FALLBACK_MARGIN.left,
      right: right > 4 && right < w ? right : FALLBACK_MARGIN.right,
      top: FALLBACK_MARGIN.top,
      bottom: FALLBACK_MARGIN.bottom,
      boxes,
      keep,
    };
  }

  /** @type {Map<string, {node: HTMLElement, arrow: SVGElement, bracket: HTMLElement, label: HTMLElement}>} */
  const pool = new Map();

  function makeMarker() {
    const node = el('div', 'sp-marker');
    const bracket = el('div', 'sp-marker__bracket');
    const arrow = svg(iconInner('target'), '0 0 24 24');
    arrow.classList.add('sp-marker__arrow');
    const label = el('div', 'sp-marker__label', '');
    node.append(bracket, arrow, label);
    layer.appendChild(node);
    return { node, arrow, bracket, label };
  }

  // Layout reads (clientWidth, getBoundingClientRect) force the browser to
  // lay the whole HUD out again if anything was written since. Doing them per
  // marker, between style writes, cost ~25 ms a frame (playtest profile), so
  // they happen once per call, before any writes, and the panel margins are
  // re-measured at most once a second.
  let size = null;
  window.addEventListener('resize', () => { size = null; marginCache = null; });
  let marginCache = null;
  let marginAt = -Infinity;
  // The banner comes and goes (and changes width) within that second, so a
  // change of its text re-measures at once (reading these forces no layout).
  const cueKey = () => { const c = document.getElementById('burnCue'); return c ? `${c.style.display}|${c.textContent.length}` : ''; };
  function cachedMargin(w) {
    const now = performance.now();
    const key = cueKey();
    if (!marginCache || marginCache.w !== w || marginCache.key !== key || now - marginAt > 1000) {
      marginCache = { w, key, m: safeMargin(w) };
      marginAt = now;
    }
    return marginCache.m;
  }

  /** The marker's whole box (icon + label) centred on x, y: estimated, not measured (no layout reads per marker). */
  function boxAt(x, y, text, onScreen) {
    const top = onScreen ? 46 : 24;
    const nw = Math.max(top, text.length * 7.6 + 18);
    const nh = top + 3 + 22;
    return { l: x - nw / 2, r: x + nw / 2, t: y - nh / 2, b: y + nh / 2, nw, nh };
  }
  const overlaps = (a, k) => a.l < k.r && a.r > k.l && a.t < k.b && a.b > k.t;

  /** Write a style/text only when it changed (every write invalidates layout). */
  function put(entry, key, value, apply) {
    if (entry[key] === value) return;
    entry[key] = value;
    apply(value);
  }

  /**
   * @param {{id:string,label:string,screenX:number,screenY:number,onScreen:boolean,distance?:number,kind?:string}[]} markers
   */
  function set(markers) {
    const list = Array.isArray(markers) ? markers : [];
    const seen = new Set();
    const placed = [];
    // All layout reads first (the size after a resize, and with the margins
    // once a second: an emulated viewport change sends no resize event).
    if (!size || performance.now() - marginAt > 1000) size = { w: root.clientWidth || window.innerWidth, h: root.clientHeight || window.innerHeight };
    const { w, h } = size;
    const margin = list.length ? cachedMargin(w) : null;
    // Under a panel (the mission card, the instruments) counts as off-screen:
    // drawn as an edge arrow where it can be read, not hidden behind the card.
    const underPanel = (x, y) => (margin?.boxes || []).some((b) => x > b.l && x < b.r && y > b.t && y < b.b);

    for (const m of list) {
      if (!m || typeof m.id !== 'string') continue;
      seen.add(m.id);
      let entry = pool.get(m.id);
      if (!entry) {
        entry = makeMarker();
        pool.set(m.id, entry);
      }
      const { node, arrow, bracket, label } = entry;

      let onScreen = !!m.onScreen && !underPanel(m.screenX, m.screenY);
      const distText = Number.isFinite(m.distance) ? ` · ${Math.round(m.distance).toLocaleString('en-US')} u` : '';
      const text = `${m.label || ''}${distText}`;

      let x = m.screenX;
      let y = m.screenY;
      let turn = '';

      if (!onScreen) {
        // Clamp to the safe rectangle (viewport minus the HUD's own panels),
        // keeping the true direction from its centre.
        const left = margin.left;
        const right = w - margin.right;
        const top = margin.top;
        const bottom = h - margin.bottom;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const halfW = Math.max(1, (right - left) / 2);
        const halfH = Math.max(1, (bottom - top) / 2);
        const dx = x - cx;
        const dy = y - cy;
        const scale = Math.min(halfW / (Math.abs(dx) || 1e-6), halfH / (Math.abs(dy) || 1e-6));
        x = cx + dx * Math.min(1, scale);
        y = cy + dy * Math.min(1, scale);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        turn = `rotate(${angle.toFixed(1)}deg)`;
      }

      // Never on top of a panel, the banner or the inset map: slide the
      // marker just clear of what it hits (the nearest free side), now an
      // arrow pointing at the real spot. A rock chip with nowhere free to go
      // is left out (they are many, and only a help); a target stays. Chips
      // already placed this frame count too, so two never pile up.
      let hidden = false;
      if (!onScreen) {
        // An edge arrow's label stays on the screen (at the bottom edge it hung off it).
        const b0 = boxAt(x, y, text, false);
        x = Math.min(Math.max(x, b0.nw / 2 + 4), w - b0.nw / 2 - 4);
        y = Math.min(Math.max(y, b0.nh / 2 + 4), h - b0.nh / 2 - 4);
      }
      const keep = (margin.keep || []).concat(placed);
      if (keep.some((k) => overlaps(boxAt(x, y, text, onScreen), k))) {
        const b = boxAt(x, y, text, false);
        const tries = [];
        for (const k of keep) {
          if (!overlaps(boxAt(x, y, text, onScreen), k)) continue;
          tries.push([x, k.b + b.nh / 2 + 4], [x, k.t - b.nh / 2 - 4], [k.l - b.nw / 2 - 4, y], [k.r + b.nw / 2 + 4, y]);
        }
        const free = tries
          .filter(([cx, cy]) => cx - b.nw / 2 >= 4 && cx + b.nw / 2 <= w - 4 && cy - b.nh / 2 >= 4 && cy + b.nh / 2 <= h - 4)
          .filter(([cx, cy]) => !keep.some((k) => overlaps(boxAt(cx, cy, text, false), k)))
          .sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y));
        if (free.length) {
          const [nx, ny] = free[0];
          // On screen it now points at the real spot; an edge arrow keeps its
          // turn (behind her the projected spot is mirrored).
          if (onScreen) turn = `rotate(${(Math.atan2(m.screenY - ny, m.screenX - nx) * (180 / Math.PI) + 90).toFixed(1)}deg)`;
          x = nx; y = ny; onScreen = false;
        } else if (m.kind !== 'target') {
          hidden = true;
        }
      }
      if (!hidden) placed.push(boxAt(x, y, text, onScreen));

      put(entry, '_cls', `sp-marker${m.kind ? ` is-${m.kind}` : ''}${onScreen ? ' is-onscreen' : ''}`, (v) => { node.className = v; });
      put(entry, '_on', onScreen, (v) => { bracket.hidden = !v; arrow.style.display = v ? 'none' : ''; });
      put(entry, '_hide', hidden, (v) => { node.style.display = v ? 'none' : ''; });
      put(entry, '_turn', turn, (v) => { arrow.style.transform = v; });
      put(entry, '_left', `${x.toFixed(1)}px`, (v) => { node.style.left = v; });
      put(entry, '_top', `${y.toFixed(1)}px`, (v) => { node.style.top = v; });
      put(entry, '_text', text, (v) => { label.textContent = v; });
    }

    for (const [id, entry] of pool) {
      if (!seen.has(id)) {
        entry.node.remove();
        pool.delete(id);
      }
    }
  }

  return { layer, set };
}
