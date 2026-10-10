// Keeps the floating name signs readable (play-test 2026-10-10: signs
// overlapped each other, sat under the HUD cards and were cut at the screen
// edge). A chapter sets `userData.want` on each sign every frame (its own
// distance and fade rules); fitLabels then shows only the wanted signs that
// are whole on screen, clear of the HUD panels and of each other, at most
// MAX_SHOWN of them, nearest first. The goal's sign always goes first.
import * as THREE from 'three';

const MAX_SHOWN = 4;
const EDGE = 8;   // px kept clear of the screen edge
const GAP = 6;    // px between two signs, or a sign and a HUD panel
// The HUD cards and pills (the page's own Help chip and Chapters button sit outside .rv-hud).
const HUD_SEL = '.rv-top__head > *, .rv-topline > *, .rv-progress, .rv-quests, .rv-side, .rv-onboard, .rv-interact, .rv-flight, .rv-toast, .pl-chip, #rvBackToChapters';
const HUD_EVERY = 6; // frames between HUD reads (each read can force a layout)

const hudPool = [];  // {l,t,r,b}, reused by every read
let hudCount = 0;
let frame = 0;
const recs = [];     // per-sign records, reused: {s, d, goal, ok, l, t, r, b}
const order = [];    // indexes into recs, sorted each frame
const kept = [];     // records already shown this frame
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _f = new THREE.Vector3();

function readHud() {
  hudCount = 0;
  for (const el of document.querySelectorAll(HUD_SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (hudCount === hudPool.length) hudPool.push({ l: 0, t: 0, r: 0, b: 0 });
    const h = hudPool[hudCount++];
    h.l = r.left; h.t = r.top; h.r = r.right; h.b = r.bottom;
  }
}

/** Do boxes a and b overlap, with `pad` px of air around b? */
function hits(a, b, pad) {
  return a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
}

/** The goal's sign first, then the nearest to the camera. */
function byGoalThenNearest(i, j) { return (recs[j].goal - recs[i].goal) || (recs[i].d - recs[j].d); }

/**
 * @param {THREE.Sprite[]} signs  sprites with userData.isLabel; the chapter sets `userData.want` each frame
 * @param {THREE.PerspectiveCamera | null} camera  null: only the chapter's own rule applies
 * @param {{x:number,z:number} | null} goal  where the current goal is; its sign is kept first
 */
export function fitLabels(signs, camera, goal = null) {
  if (!camera) {
    for (const s of signs) s.visible = !!s.userData.want;
    return;
  }
  if (frame++ % HUD_EVERY === 0) readHud();
  camera.updateMatrixWorld();
  camera.getWorldDirection(_f);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

  // The sign that stands nearest the goal spot (within 3 units) is the goal's.
  let goalSign = null;
  let best = 3;
  if (goal) {
    for (const s of signs) {
      if (!s.userData.want) continue;
      const g = Math.hypot(s.position.x - goal.x, s.position.z - goal.z);
      if (g < best) { best = g; goalSign = s; }
    }
  }

  // Screen box of each wanted sign (the sprite's anchor is its bottom centre).
  let n = 0;
  for (const s of signs) {
    if (!s.userData.want) { s.visible = false; continue; }
    if (n === recs.length) recs.push({ s: null, d: 0, goal: 0, ok: false, l: 0, t: 0, r: 0, b: 0 });
    const rec = recs[n++];
    rec.s = s;
    rec.goal = s === goalSign ? 1 : 0;
    rec.d = s.position.distanceTo(camera.position);
    _p.copy(s.position).project(camera);
    _q.copy(s.position).sub(camera.position);
    const depth = _q.dot(_f); // distance in front of the camera
    const sx = (_p.x + 1) / 2 * W;
    const sy = (1 - _p.y) / 2 * H;
    const ppu = H / (2 * tanHalf * Math.max(depth, 0.01)); // pixels per world unit at this depth
    const w = s.scale.x * ppu;
    const h = s.scale.y * ppu;
    rec.l = sx - w / 2; rec.r = sx + w / 2; rec.t = sy - h; rec.b = sy;
    // In front, and whole on screen: a sign cut at the edge reads as a broken word.
    rec.ok = depth > 0 && _p.z <= 1
      && rec.l >= EDGE && rec.r <= W - EDGE && rec.t >= EDGE && rec.b <= H - EDGE;
  }

  order.length = 0;
  for (let i = 0; i < n; i++) order.push(i);
  order.sort(byGoalThenNearest);

  kept.length = 0;
  for (const i of order) {
    const rec = recs[i];
    let show = rec.ok;
    for (let k = 0; k < hudCount && show; k++) if (hits(rec, hudPool[k], GAP)) show = false;
    for (let k = 0; k < kept.length && show; k++) if (hits(rec, kept[k], GAP)) show = false;
    // The goal is never dropped for the count; everything else yields to it.
    if (show && !rec.goal && kept.length >= MAX_SHOWN) show = false;
    rec.s.visible = show;
    if (show) kept.push(rec);
  }
  kept.length = 0;
}
