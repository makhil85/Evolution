// Small DOM + formatting helpers shared by every hud/ module.
//
// Deliberately dependency-free except for the one thing Chapter 3's hud.js
// also does: read her chosen name once, so authored text can say "Maya's
// scanner" instead of a hardcoded default. This chapter never hardcodes a
// name in prose (unlike Chapter 3's "Zara"), so this is a pure convenience,
// not a find/replace.

import { loadProfile } from '../../launcher/profile.js';

/** Her name, or null if she has not named herself yet (falls back to "Cadet"). */
export const HERO_NAME = (() => {
  const n = loadProfile().name.trim();
  return n || null;
})();

/** What the girl is called in dialogue lines when a caller writes `who: 'girl'`. */
export function heroName() {
  return HERO_NAME || 'Cadet';
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** Build an inline SVG icon from a viewBox + inner markup string. Cached per (name) by the caller if needed. */
export function svg(inner, viewBox = '0 0 24 24') {
  const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrap.setAttribute('viewBox', viewBox);
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = inner;
  return wrap;
}

/** Finite number or the fallback — guards a NaN from ever reaching the DOM. */
export function num(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp to [0, 1] — the shape every gauge fill wants. */
export function frac(value, max) {
  const v = num(value, 0);
  const m = num(max, 0);
  if (m <= 0) return 0;
  return Math.max(0, Math.min(1, v / m));
}

/** One decimal for small speeds, whole numbers once they get big — reads better than a fixed precision either way. */
export function fmtNum(n, digits = 0) {
  const v = num(n, 0);
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** `1,240` style grouping for big distances/altitudes. */
export function group(n) {
  return Math.round(num(n, 0)).toLocaleString('en-US');
}

/** Percentage, clamped and rounded — every meter reads this the same way. */
export function pct(value, max) {
  return Math.round(frac(value, max) * 100);
}
