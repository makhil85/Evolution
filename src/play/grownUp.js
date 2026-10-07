// Grown-up tools, only in unlock mode (?unlock=all on any page; ?unlock=off
// turns it off): skip a question or a lesson film, and jump to any part of a
// chapter, so a grown-up can check a later part without playing up to it.
// A child using the menu never sees any of it.
//
//   isGrownUp()              unlock mode on?
//   skipButton(onClick, cls) a "Skip" button, or null when it's off
//   addJumpPanel({ title, parts, onJump })
//                            a small corner panel listing the chapter's parts;
//                            parts = [{ id, label, group? }], onJump(id)
import { UNLOCK_KEY } from '../launcher/profile.js';

export function isGrownUp() {
  try {
    const q = new URLSearchParams(location.search).get('unlock');
    if (q === 'all') localStorage.setItem(UNLOCK_KEY, '1');
    if (q === 'off') localStorage.removeItem(UNLOCK_KEY);
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

const SKIP_TEXT = 'Skip (grown-up) ⏭';

/** A Skip button for a question or lesson card, or null outside unlock mode. */
export function skipButton(onClick, className = '') {
  if (!isGrownUp()) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `rv-grownup-skip ${className}`.trim();
  b.textContent = SKIP_TEXT;
  b.title = 'Unlock mode: answers it for you and moves on';
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  injectStyle();
  return b;
}

/**
 * The "Jump to" panel: a small button in the top-left corner that opens a list
 * of the chapter's parts. Picking one calls onJump(id). Does nothing outside
 * unlock mode. Returns { dispose } or null.
 */
export function addJumpPanel({ title = 'Jump to', parts, onJump }) {
  if (!isGrownUp() || !parts?.length) return null;
  injectStyle();
  const wrap = document.createElement('div');
  wrap.className = 'rv-grownup-jump';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'rv-grownup-jump__open';
  open.textContent = '⏭ Jump';
  open.title = 'Unlock mode: jump to any part of this chapter';
  const list = document.createElement('div');
  list.className = 'rv-grownup-jump__list';
  list.hidden = true;
  const head = document.createElement('div');
  head.className = 'rv-grownup-jump__title';
  head.textContent = title;
  list.appendChild(head);
  let group = null;
  for (const p of parts) {
    if (p.group && p.group !== group) {
      group = p.group;
      const g = document.createElement('div');
      g.className = 'rv-grownup-jump__group';
      g.textContent = group;
      list.appendChild(g);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      list.hidden = true;
      try { onJump(p.id); } catch (err) { console.error('[grown-up] jump failed', err); }
    });
    list.appendChild(b);
  }
  open.addEventListener('click', () => { list.hidden = !list.hidden; });
  // Clicks and keys inside the panel are not game input.
  for (const ev of ['pointerdown', 'mousedown', 'keydown']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  wrap.append(open, list);
  document.body.appendChild(wrap);
  return { dispose: () => wrap.remove() };
}

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.rv-grownup-skip, .rv-hud .rv-grownup-skip { pointer-events: auto; margin-right: auto; padding: 8px 14px; border-radius: 10px; border: 1px dashed #f0b45a;
  background: rgba(240,180,90,.12); color: #f6c77a; font: 600 13px system-ui, sans-serif; cursor: pointer; }
.rv-grownup-skip[hidden] { display: none; }
.rv-grownup-skip:hover { background: rgba(240,180,90,.25); }
.rv-grownup-jump { pointer-events: auto; position: fixed; left: 12px; bottom: 12px; z-index: 9000; font: 13px system-ui, sans-serif; }
.rv-grownup-jump__open { padding: 6px 12px; border-radius: 10px; border: 1px dashed #f0b45a;
  background: rgba(20,24,40,.85); color: #f6c77a; font-weight: 600; cursor: pointer; }
.rv-grownup-jump__list { position: absolute; left: 0; bottom: 38px; width: 260px; max-height: 70vh; overflow: auto;
  background: rgba(14,18,32,.96); border: 1px solid #3b4566; border-radius: 12px; padding: 8px; box-shadow: 0 8px 30px rgba(0,0,0,.5); }
.rv-grownup-jump__list[hidden] { display: none; }
.rv-grownup-jump__title { color: #f6c77a; font-weight: 700; padding: 4px 6px 8px; }
.rv-grownup-jump__group { color: #8fa0c8; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 8px 6px 4px; }
.rv-grownup-jump__list button { display: block; width: 100%; text-align: left; padding: 6px 8px; border: 0; border-radius: 8px;
  background: transparent; color: #e6ebff; cursor: pointer; font: inherit; }
.rv-grownup-jump__list button:hover { background: #26304d; }
`;
  document.head.appendChild(s);
}

/**
 * Jump panel for the villages (Chapters 1-3): walk-free trips to each
 * puzzle / site, plus a bag top-up so a build can be checked straight away.
 * @param {object} o
 * @param {{id:string, label:string, group?:string, x:number, z:number}[]} o.spots
 * @param {{teleport:Function}} o.controller
 * @param {(x:number, z:number) => boolean} [o.blocked]
 * @param {(x:number, z:number) => number} [o.heightAt]
 * @param {() => void} [o.fill] tops up her bag
 */
export function addVillageJump({ title = 'Jump to a place', spots, controller, blocked = () => false, heightAt = () => 0, fill }) {
  const parts = spots.map(({ id, label, group }) => ({ id, label, group }));
  if (fill) parts.push({ id: '__fill', label: 'Fill my bag (enough to build)', group: 'Grown-up' });
  return addJumpPanel({
    title,
    parts,
    onJump(id) {
      if (id === '__fill') { fill(); return; }
      const s = spots.find((p) => p.id === id);
      if (!s) return;
      // Stand just beside it, on the first free spot round it.
      let at = { x: s.x, z: s.z };
      outer: for (const r of [1.4, 2.2, 3.2]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 2;
          const x = s.x + Math.cos(a) * r; const z = s.z + Math.sin(a) * r;
          if (!blocked(x, z)) { at = { x, z }; break outer; }
        }
      }
      controller.teleport(at.x, heightAt(at.x, at.z), at.z);
    },
  });
}
