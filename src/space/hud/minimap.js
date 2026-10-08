// The always-on top-down inset (bottom-right): where she is, where her dotted
// path goes, and what she's flying to, seen from straight above the orbital
// plane. The chase camera shows how flying FEELS; this shows the orbit
// itself, which is what every burn cue is about.
//
// It frames itself: round a planet or moon it's centred on that body (her
// orbit, the moon she's heading for); out between the planets it's centred
// on the Sun. The dotted path is drawn relative to the centre body AT EACH
// FUTURE MOMENT, so a path to the Moon curves the way it really does in
// Earth's frame. Click it for the full M map.
//
// Leaving a planet (lead 2026-10-08): on an escape step the map stays centred
// on that planet while her path is inside its pull, and zooms out as the path
// stretches into a longer oval. The current target and a guess at the next
// stop (Uranus, then Neptune) sit at the rim, in their true direction, as dim
// arrows. When the path breaks out, the map hands over to the Sun's view. Every
// change of centre or size is EASED (view below): the map never jumps.

import { el } from './domUtil.js';
import { BODIES, BELT } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { bodyColor } from './map.js';

const REDRAW_MS = 100; // ~10 Hz is plenty for a map, and cheap
/** The most the map may zoom in one redraw (a log step: +12.7% / -11.3%). */
const ZOOM_STEP = 0.12;
/** The most the centre may slide, in one redraw, as a share of the map's size. */
const SLIDE_STEP = 0.10;
const _c = { x: 0, z: 0, vx: 0, vz: 0 };

function centreAt(id, t) {
  if (id === 'sun') return { x: 0, z: 0 };
  const s = bodyState(id, t, _c);
  return { x: s.x, z: s.z };
}

/**
 * The centre point the map shows at time t. A settled view is simply the body
 * `v.to`. While the view is still sliding over (v.e < 1) it is the point it
 * started from, blended toward the body, so the change of centre is continuous.
 */
function blendAt(v, t) {
  const to = centreAt(v.to, t);
  if (v.e >= 1 || !v.fromPt) return to;
  return { x: v.fromPt.x + (to.x - v.fromPt.x) * v.e, z: v.fromPt.z + (to.z - v.fromPt.z) * v.e };
}

/** The planets (and dwarf planets) round the Sun, from the inside out. */
const OUTWARD = Object.keys(BODIES).filter((id) => BODIES[id].parent === 'sun').sort((a, b) => BODIES[a].orbit - BODIES[b].orbit);

/** A guess at the stop after `id`: the next one further out. */
function nextOut(id) {
  const i = OUTWARD.indexOf(id);
  return i >= 0 && i < OUTWARD.length - 1 ? OUTWARD[i + 1] : null;
}

function titleFor(id) {
  if (id === 'sun') return 'Solar system · top view';
  if (id === 'moon') return 'Around the Moon · top view';
  return `Around ${BODIES[id]?.name || id} · top view`;
}

/** Her path (the dotted line) in the view's frame, moment by moment. */
function pathIn(v, pts, times) {
  const out = [];
  if (pts && times) {
    const n = Math.min(times.length, pts.length / 2);
    const stride = n > 200 ? 2 : 1;
    for (let i = 0; i < n; i += stride) {
      const c = blendAt(v, times[i]);
      out.push({ x: pts[2 * i] - c.x, z: pts[2 * i + 1] - c.z });
    }
  }
  return out;
}

/**
 * How far out the map wants to reach: her, her path (not wildly beyond her),
 * and the target (plus a guess at the stop after it, round the Sun).
 */
function wantedRadius(st, v, want, target, next) {
  const C = blendAt(v, st.time);
  const rel = (x, z, t) => { const c = t === undefined ? C : blendAt(v, t); return { x: x - c.x, z: z - c.z }; };
  const ship = rel(st.ship.x, st.ship.z);
  const shipD = Math.hypot(ship.x, ship.z);
  const targetInFrame = !!target && target !== want && (BODIES[target].parent === want || want === 'sun');
  const tp = targetInFrame && st.bodies[target] ? rel(st.bodies[target].x, st.bodies[target].z) : null;
  const np = next && want === 'sun' && st.bodies[next] ? rel(st.bodies[next].x, st.bodies[next].z) : null;
  let R = Math.max(shipD, want === 'sun' ? 0 : BODIES[want].radius * 3);
  if (want === 'sun') {
    // Out round the Sun she may be heading anywhere: frame her, the target
    // and a guess at the stop after it (the next planet out), not her path.
    if (!tp) R = shipD * 1.3;
    if (np) R = Math.max(R, Math.hypot(np.x, np.z));
  } else {
    const cap = Math.max(shipD, tp ? Math.hypot(tp.x, tp.z) : 0) * 2.2 || Infinity;
    if (st.path && st.times) {
      const n = Math.min(st.times.length, st.path.length / 2);
      const stride = n > 200 ? 2 : 1;
      for (let i = 0; i < n; i += stride) {
        const p = rel(st.path[2 * i], st.path[2 * i + 1], st.times[i]);
        const d = Math.hypot(p.x, p.z);
        if (d > R && d < cap) R = d;
      }
    }
  }
  if (tp) R = Math.max(R, Math.hypot(tp.x, tp.z) + (BODIES[target].soi || 0) * 0.3);
  return R * 1.12;
}

export function createMinimap(root, { onOpenMap } = {}) {
  const wrap = el('div', 'sp-minimap');
  const canvas = document.createElement('canvas');
  canvas.className = 'sp-minimap__canvas';
  canvas.setAttribute('aria-label', 'Top-down map of your path. Click to open the full map.');
  wrap.appendChild(canvas);
  const hint = el('div', 'sp-minimap__hint', 'M: big map · N: hide');
  wrap.appendChild(hint);
  root.appendChild(wrap);
  wrap.addEventListener('click', () => onOpenMap?.());

  const ctx = canvas.getContext('2d');
  let lastDraw = -Infinity;
  let shown = true;
  let size = 0;
  // The view: `to` is the body it is centred on; `e` (0..1) how far it has slid
  // in from `fromPt` (the old centre, where it was) and `fromId` (that body, drawn
  // fading out); `R` the map's radius in game units. See blendAt and draw().
  let view = null;
  let frameInfo = null; // the last drawn frame, for the tests (frame())

  function resize() {
    const css = wrap.clientWidth || 230;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    size = css;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { size = 0; });

  function draw(st) {
    if (!size) resize();
    const W = size;
    const cx = W / 2;
    const cy = W / 2 + 8; // room for the title line
    ctx.clearRect(0, 0, W, W);

    // Which view (lead 2026-10-08): on a closed orbit round a planet or moon,
    // that system; once her path breaks out of it, the view one level up
    // (a moon's planet, or the Sun). The Sun's view shows planets only.
    const pts = st.path;
    const times = st.times;
    const local = st.soi && st.soi !== 'sun' && BODIES[st.soi] ? st.soi : null;
    let want = local || 'sun';
    if (local && pts && times && times.length) {
      const n = Math.min(times.length, pts.length / 2);
      const c = centreAt(local, times[n - 1]);
      if (Math.hypot(pts[2 * (n - 1)] - c.x, pts[2 * (n - 1) + 1] - c.z) > BODIES[local].soi * 0.98) want = BODIES[local].parent || 'sun';
    }
    // Leaving a planet's system: an escape step, seen from the planet (lead 2026-10-08).
    const leaving = !!st.escape && want !== 'sun';
    const target = st.target && BODIES[st.target] ? st.target : null;
    // The guessed stop after the target: in the Sun's view, and as she leaves a system.
    const next = target && (want === 'sun' || leaving) ? nextOut(target) : null;

    // A new centre: the map slides from the point it shows now (so nothing jumps).
    let first = false;
    if (!view) { view = { to: want, fromId: null, fromPt: null, e: 1, R: 0 }; first = true; }
    else if (view.to !== want) {
      view.fromPt = blendAt(view, st.time);
      view.fromId = view.to;
      view.to = want;
      view.e = 0;
    }

    // Zoom and slide, each at most a set share per redraw. The size first
    // (log steps, so growing and shrinking are alike), then the centre.
    const Rwant = Math.max(wantedRadius(st, view, want, target, next), 1e-9);
    if (first) view.R = Rwant;
    else {
      const k = Math.max(-ZOOM_STEP, Math.min(ZOOM_STEP, Math.log(Rwant / view.R)));
      view.R *= Math.exp(k);
    }
    if (view.e < 1) {
      const to = centreAt(view.to, st.time);
      const span = Math.hypot(to.x - view.fromPt.x, to.z - view.fromPt.z);
      view.e = span > 0 ? Math.min(1, view.e + SLIDE_STEP * view.R / span) : 1;
      if (view.e >= 1) { view.e = 1; view.fromPt = null; view.fromId = null; }
    }

    const R = view.R;
    const C = blendAt(view, st.time);
    const rel = (x, z, t) => { const c = t === undefined ? C : blendAt(view, t); return { x: x - c.x, z: z - c.z }; };
    const path = pathIn(view, pts, times);
    const ship = rel(st.ship.x, st.ship.z);
    const scale = (W / 2 - 14) / R;
    const X = (p) => cx + p.x * scale;
    const Y = (p) => cy + p.z * scale;
    frameInfo = { centre: want, C: { x: C.x, z: C.z }, R, e: view.e };

    // Frame.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 10, 9, 0.78)';
    ctx.fill();
    ctx.clip();

    // The asteroid belt, round the Sun, while the Sun is in view.
    const beltA = view.to === 'sun' ? view.e : (view.fromId === 'sun' ? 1 - view.e : 0);
    if (beltA > 0 && BELT.inner * scale < W) {
      const sp = X(rel(0, 0)); const sq = Y(rel(0, 0));
      ctx.globalAlpha = beltA;
      ctx.beginPath();
      ctx.arc(sp, sq, ((BELT.inner + BELT.outer) / 2) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(205, 191, 169, 0.16)';
      ctx.lineWidth = Math.max(2, (BELT.outer - BELT.inner) * scale);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // The centre body and the bodies that circle it (moons, or planets). While
    // the view slides, the old centre's system fades out as the new one fades in.
    const parents = view.e < 1 && view.fromId ? [view.to, view.fromId] : [view.to];
    for (const P of parents) {
      // A gas giant's moons are left out while she leaves its system.
      const hideMoons = (P === 'jupiter' || P === 'saturn') && (leaving || view.e < 1);
      const alphaP = P === view.to ? view.e : 1 - view.e;
      const pc = centreAt(P, st.time);
      const PX = X({ x: pc.x - C.x, z: pc.z - C.z }); const PY = Y({ x: pc.x - C.x, z: pc.z - C.z });
      ctx.save();
      ctx.globalAlpha = alphaP;
      if (!hideMoons) {
        for (const id of Object.keys(BODIES)) {
          const b = BODIES[id];
          if (b.parent !== P || !st.bodies[id]) continue;
          const orbitPx = b.orbit * scale;
          if (orbitPx > W * 1.5) continue;
          ctx.beginPath();
          ctx.arc(PX, PY, orbitPx, 0, Math.PI * 2);
          ctx.strokeStyle = id === target ? 'rgba(255, 207, 92, 0.45)' : 'rgba(255, 238, 214, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
          const p = rel(st.bodies[id].x, st.bodies[id].z);
          ctx.beginPath();
          ctx.arc(X(p), Y(p), Math.max(2.5, b.radius * scale), 0, Math.PI * 2);
          ctx.fillStyle = bodyColor(id);
          ctx.fill();
        }
      }
      const cr = P === 'sun' ? 5 : Math.max(4, BODIES[P].radius * scale);
      ctx.beginPath();
      ctx.arc(PX, PY, cr, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor(P);
      ctx.fill();
      ctx.restore();
    }

    // The target and the guessed next stop, when they are on the map. Out at
    // the rim (leaving a system) they become arrows, further below.
    const inFrame = (p) => Math.hypot(X(p) - cx, Y(p) - cy) <= W / 2 - 14;
    const targetInFrame = !!target && target !== want && (BODIES[target].parent === want || want === 'sun');
    const tPos = target && st.bodies[target] && (targetInFrame || leaving) ? rel(st.bodies[target].x, st.bodies[target].z) : null;
    const nPos = next && st.bodies[next] ? rel(st.bodies[next].x, st.bodies[next].z) : null;
    const tIn = !!tPos && inFrame(tPos);
    const nIn = !!nPos && inFrame(nPos);

    // The guessed next stop: a fainter ring.
    if (nIn) {
      ctx.beginPath();
      ctx.arc(X(nPos), Y(nPos), 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The target: a ring you can't miss, and its name.
    if (tIn) {
      const tx = X(tPos); const ty = Y(tPos);
      const pulse = 7 + 2 * Math.sin(performance.now() / 300);
      ctx.beginPath();
      ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcf5c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Her dotted path.
    if (path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(path[0]), Y(path[0]));
      for (let i = 1; i < path.length; i++) ctx.lineTo(X(path[i]), Y(path[i]));
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(127, 243, 255, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The ship: an arrow pointing the way her nose points.
    const sx = X(ship); const sy = Y(ship);
    const a = st.ship.angle;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, 4.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, -4.5);
    ctx.closePath();
    ctx.fillStyle = '#ff7847';
    ctx.strokeStyle = '#fff4e6';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // clip

    // A dim arrow at the rim, in the true direction of a body off the map, and its name.
    const rim = (p, label, colour, alpha) => {
      const ang = Math.atan2(Y(p) - cy, X(p) - cx);
      const rr = W / 2 - 16;
      const ax = cx + Math.cos(ang) * rr; const ay = cy + Math.sin(ang) * rr;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4); ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.restore();
      const lr = rr - 12;
      const lx = cx + Math.cos(ang) * lr; const ly = Math.max(26, Math.min(W - 6, cy + Math.sin(ang) * lr));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = colour;
      ctx.textAlign = Math.cos(ang) > 0.35 ? 'right' : Math.cos(ang) < -0.35 ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);
      ctx.restore();
    };

    // The target's name, outside the clip so the rim never cuts it off.
    const bodyName = (id) => (id === 'moon' ? 'the Moon' : BODIES[id].name);
    if (tIn) {
      const tx = X(tPos); const ty = Y(tPos);
      ctx.font = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffcf5c';
      ctx.textBaseline = 'alphabetic';
      // On the side away from her arrow, so the two never overlap; stay
      // inside the circle either way.
      const sxT = X(ship);
      let right = sxT < tx;
      if (right && tx > W - 60) right = false;
      if (!right && tx < 60) right = true;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(bodyName(target), tx + (right ? 11 : -11), Math.max(26, Math.min(W - 6, ty + (Y(ship) < ty ? 16 : -8))));
    } else if (tPos && leaving) {
      rim(tPos, bodyName(target), '#ffcf5c', 0.8);
    }

    if (nIn) {
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 207, 92, 0.75)';
      ctx.textBaseline = 'alphabetic';
      const nx = X(nPos); const ny = Y(nPos);
      ctx.textAlign = nx > cx ? 'right' : 'left';
      ctx.fillText(`then ${BODIES[next].name}`, nx + (nx > cx ? -10 : 10), Math.max(26, Math.min(W - 6, ny - 9)));
    } else if (nPos && leaving) {
      rim(nPos, `then ${BODIES[next].name}`, '#ffcf5c', 0.5);
    }

    // Rim and title.
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 238, 214, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '800 10.5px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#cdbfa9';
    ctx.fillText((leaving ? `Leaving ${want === 'moon' ? 'the Moon' : BODIES[want]?.name || want} · top view` : titleFor(want)).toUpperCase(), cx, 12);
  }

  return {
    el: wrap,
    /** Show or hide it (N key). */
    toggle() { shown = !shown; wrap.classList.toggle('is-hidden', !shown); },
    /** The last drawn frame: { centre, C: {x,z} (the map's middle, game units), R (its radius), e (0..1 slide) }. For the tests. */
    frame() { return frameInfo; },
    /**
     * @param {{time:number, bodies:object, ship:{x,z,angle}, soi:string,
     *   path?:Float64Array, times?:Float64Array, target?:string, hidden?:boolean,
     *   escape?:boolean}} st   escape: a leave-the-system step (the planet's view, its
     *   target and next stop at the rim, no gas-giant moons)
     */
    update(st) {
      wrap.classList.toggle('is-off', !!st.hidden);
      if (!shown || st.hidden) return;
      const now = performance.now();
      if (now - lastDraw < REDRAW_MS) return;
      lastDraw = now;
      draw(st);
    },
  };
}
