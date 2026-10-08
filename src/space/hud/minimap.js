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
// arrows with a name on a dark pill. The planet view and the Sun's view switch
// with hysteresis (leave above 1.0 of the planet's pull, come back below 0.9),
// so the map never flips frame to frame. Every change of centre or size is
// EASED (blendAt, ZOOM_STEP, SLIDE_STEP): the map never jumps - except that a
// ship that reaches the disc's edge is brought back in at once (SNAP_SHARE).

import { el } from './domUtil.js';
import { BODIES, BELT } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { bodyColor } from './map.js';

const REDRAW_MS = 100; // ~10 Hz is plenty for a map, and cheap
/** The most the map may zoom in one redraw (a log step: +12.7% / -11.3%). */
const ZOOM_STEP = 0.12;
/** The most the centre may slide, in one redraw, as a share of the map's size. */
const SLIDE_STEP = 0.10;
/** A ship further out than this share of the map's radius: zoom to it at once. */
const SNAP_SHARE = 0.9;
/** Planet view while her path is inside this share of the planet's pull (hysteresis). */
const LEAVE_PULL = 1.0;
const RETURN_PULL = 0.9;

// Scratch objects: the map is redrawn 10 times a second, so the hot loops write
// into these instead of allocating a point per body and per path sample.
const _c = { x: 0, z: 0, vx: 0, vz: 0 }; // bodyState's own scratch
const _p = { x: 0, z: 0 }; // out-parameter of centreInto / blendInto
const _q = { x: 0, z: 0 };

function centreInto(id, t, out) {
  if (id === 'sun') { out.x = 0; out.z = 0; return out; }
  const s = bodyState(id, t, _c);
  out.x = s.x; out.z = s.z;
  return out;
}

/**
 * The centre point the map shows at time t (into `out`). A settled view is
 * simply the body `v.to`. While the view is still sliding over (v.e < 1) it is
 * the point it started from, blended toward the body, so the change of centre
 * is continuous.
 */
function blendInto(v, t, out) {
  centreInto(v.to, t, out);
  if (v.e < 1 && v.fromPt) {
    out.x = v.fromPt.x + (out.x - v.fromPt.x) * v.e;
    out.z = v.fromPt.z + (out.z - v.fromPt.z) * v.e;
  }
  return out;
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

/**
 * Her path (the dotted line) in the view's frame, moment by moment, written
 * into `buf` as x,z pairs. Returns the number of points.
 */
function pathInto(buf, v, pts, times) {
  if (!pts || !times) return 0;
  const n = Math.min(times.length, pts.length / 2);
  const stride = n > 200 ? 2 : 1;
  let k = 0;
  for (let i = 0; i < n; i += stride) {
    blendInto(v, times[i], _p);
    buf[2 * k] = pts[2 * i] - _p.x;
    buf[2 * k + 1] = pts[2 * i + 1] - _p.z;
    k++;
  }
  return k;
}

/**
 * How far out the map wants to reach: her, her path (not wildly beyond her),
 * and the target (plus a guess at the stop after it, round the Sun).
 */
function wantedRadius(st, v, want, target, next) {
  blendInto(v, st.time, _p);
  const shipD = Math.hypot(st.ship.x - _p.x, st.ship.z - _p.z);
  const targetInFrame = !!target && target !== want && (BODIES[target].parent === want || want === 'sun');
  let tx = 0; let tz = 0; let hasT = false;
  if (targetInFrame && st.bodies[target]) {
    blendInto(v, st.time, _p);
    tx = st.bodies[target].x - _p.x; tz = st.bodies[target].z - _p.z; hasT = true;
  }
  let nx = 0; let nz = 0; let hasN = false;
  if (next && want === 'sun' && st.bodies[next]) {
    blendInto(v, st.time, _p);
    nx = st.bodies[next].x - _p.x; nz = st.bodies[next].z - _p.z; hasN = true;
  }
  let R = Math.max(shipD, want === 'sun' ? 0 : BODIES[want].radius * 3);
  if (want === 'sun') {
    // Out round the Sun she may be heading anywhere: frame her, the target
    // and a guess at the stop after it (the next planet out), not her path.
    if (!hasT) R = shipD * 1.3;
    if (hasN) R = Math.max(R, Math.hypot(nx, nz));
  } else if (st.path && st.times) {
    const cap = Math.max(shipD, hasT ? Math.hypot(tx, tz) : 0) * 2.2 || Infinity;
    const n = Math.min(st.times.length, st.path.length / 2);
    const stride = n > 200 ? 2 : 1;
    for (let i = 0; i < n; i += stride) {
      blendInto(v, st.times[i], _p);
      const d = Math.hypot(st.path[2 * i] - _p.x, st.path[2 * i + 1] - _p.z);
      if (d > R && d < cap) R = d;
    }
  }
  if (hasT) R = Math.max(R, Math.hypot(tx, tz) + (BODIES[target].soi || 0) * 0.3);
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
  // fading out); `R` the map's radius in game units. See blendInto and draw().
  let view = null;
  let frameInfo = null; // the last drawn frame, for the tests (frame())
  let pathBuf = new Float64Array(0); // her path, rebuilt each redraw
  // Which planet's pull she is inside, for the planet view's hysteresis.
  let hold = { id: null, inside: true };

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
    if (local !== hold.id) hold = { id: local, inside: true };
    let want = 'sun';
    if (local) {
      if (pts && times && times.length) {
        const n = Math.min(times.length, pts.length / 2);
        centreInto(local, times[n - 1], _q);
        const far = Math.hypot(pts[2 * (n - 1)] - _q.x, pts[2 * (n - 1) + 1] - _q.z) / BODIES[local].soi;
        // Hysteresis: out of the planet view only well past its pull, back in only well inside it.
        if (hold.inside && far > LEAVE_PULL) hold.inside = false;
        else if (!hold.inside && far < RETURN_PULL) hold.inside = true;
      }
      want = hold.inside ? local : (BODIES[local].parent || 'sun');
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
      // Start from where the map shows now (blended, if it was still sliding).
      const at = { x: 0, z: 0 };
      blendInto(view, st.time, at);
      view.fromPt = at;
      view.fromId = view.to;
      view.to = want;
      view.e = 0;
    }

    // Zoom and slide, each at most a set share per redraw. The size first
    // (log steps, so growing and shrinking are alike), then the centre. A ship
    // beyond SNAP_SHARE of the disc is brought back in at once.
    const Rwant = Math.max(wantedRadius(st, view, want, target, next), 1e-9);
    blendInto(view, st.time, _p);
    const shipOut = Math.hypot(st.ship.x - _p.x, st.ship.z - _p.z) > SNAP_SHARE * view.R;
    if (first || shipOut) view.R = Rwant;
    else {
      const k = Math.max(-ZOOM_STEP, Math.min(ZOOM_STEP, Math.log(Rwant / view.R)));
      view.R *= Math.exp(k);
    }
    if (view.e < 1) {
      centreInto(view.to, st.time, _q);
      const span = Math.hypot(_q.x - view.fromPt.x, _q.z - view.fromPt.z);
      view.e = span > 0 ? Math.min(1, view.e + SLIDE_STEP * view.R / span) : 1;
      if (view.e >= 1) { view.e = 1; view.fromPt = null; view.fromId = null; }
    }

    const R = view.R;
    blendInto(view, st.time, _p);
    const Cx = _p.x; const Cz = _p.z;
    const pathN = pts && times ? Math.min(times.length, pts.length / 2) : 0;
    const stride = pathN > 200 ? 2 : 1;
    const pathCount = Math.ceil(pathN / stride);
    if (pathBuf.length < 2 * pathCount) pathBuf = new Float64Array(2 * pathCount);
    const path = pathCount ? pathBuf : null;
    const nPath = pathCount ? pathInto(pathBuf, view, pts, times) : 0;
    const scale = (W / 2 - 14) / R;
    const X = (x) => cx + x * scale;
    const Y = (z) => cy + z * scale;
    const sxRel = st.ship.x - Cx; const szRel = st.ship.z - Cz;
    frameInfo = { centre: want, C: { x: Cx, z: Cz }, R, e: view.e };

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
      ctx.globalAlpha = beltA;
      ctx.beginPath();
      ctx.arc(X(-Cx), Y(-Cz), ((BELT.inner + BELT.outer) / 2) * scale, 0, Math.PI * 2);
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
      centreInto(P, st.time, _q);
      const PX = X(_q.x - Cx); const PY = Y(_q.z - Cz);
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
          ctx.beginPath();
          ctx.arc(X(st.bodies[id].x - Cx), Y(st.bodies[id].z - Cz), Math.max(2.5, b.radius * scale), 0, Math.PI * 2);
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
    const inFrame = (x, z) => Math.hypot(X(x) - cx, Y(z) - cy) <= W / 2 - 14;
    const targetInFrame = !!target && target !== want && (BODIES[target].parent === want || want === 'sun');
    const tPos = target && st.bodies[target] && (targetInFrame || leaving)
      ? { x: st.bodies[target].x - Cx, z: st.bodies[target].z - Cz } : null;
    const nPos = next && st.bodies[next] ? { x: st.bodies[next].x - Cx, z: st.bodies[next].z - Cz } : null;
    const tIn = !!tPos && inFrame(tPos.x, tPos.z);
    const nIn = !!nPos && inFrame(nPos.x, nPos.z);

    // The guessed next stop: a fainter ring.
    if (nIn) {
      ctx.beginPath();
      ctx.arc(X(nPos.x), Y(nPos.z), 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The target: a ring you can't miss, and its name.
    if (tIn) {
      const pulse = 7 + 2 * Math.sin(performance.now() / 300);
      ctx.beginPath();
      ctx.arc(X(tPos.x), Y(tPos.z), pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcf5c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Her dotted path.
    if (nPath > 1 && path) {
      ctx.beginPath();
      ctx.moveTo(X(path[0]), Y(path[1]));
      for (let i = 1; i < nPath; i++) ctx.lineTo(X(path[2 * i]), Y(path[2 * i + 1]));
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(127, 243, 255, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The ship: an arrow pointing the way her nose points.
    const sx = X(sxRel); const sy = Y(szRel);
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

    // A label on a dark pill, so it reads over anything underneath (never bare on the path).
    const pill = (text, x, y, align, colour, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = align;
      const w = ctx.measureText(text).width + 8;
      const left = align === 'right' ? x - w : align === 'left' ? x : x - w / 2;
      ctx.fillStyle = 'rgba(12, 10, 9, 0.85)';
      ctx.fillRect(left, y - 7, w, 14);
      ctx.fillStyle = colour;
      ctx.fillText(text, left + 4, y);
      ctx.restore();
    };
    // A dim arrow at the rim, in the true direction of a body off the map, and its name.
    const rim = (p, label, colour, alpha) => {
      const sxp = X(p.x) - cx; const syp = Y(p.z) - cy;
      const ang = Math.atan2(syp, sxp);
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
      const lr = rr - 16;
      const lx = cx + Math.cos(ang) * lr; const ly = Math.max(26, Math.min(W - 8, cy + Math.sin(ang) * lr));
      pill(label, lx, ly, Math.cos(ang) > 0.35 ? 'right' : Math.cos(ang) < -0.35 ? 'left' : 'center', colour, alpha);
    };

    // The target's name, outside the clip so the rim never cuts it off.
    const bodyName = (id) => (id === 'moon' ? 'the Moon' : BODIES[id].name);
    if (tIn) {
      const tx = X(tPos.x); const ty = Y(tPos.z);
      ctx.font = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffcf5c';
      ctx.textBaseline = 'alphabetic';
      // On the side away from her arrow, so the two never overlap; stay
      // inside the circle either way.
      let right = sx < tx;
      if (right && tx > W - 60) right = false;
      if (!right && tx < 60) right = true;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(bodyName(target), tx + (right ? 11 : -11), Math.max(26, Math.min(W - 6, ty + (sy < ty ? 16 : -8))));
    } else if (tPos && leaving) {
      rim(tPos, bodyName(target), '#ffcf5c', 0.9);
    }

    if (nIn) {
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 207, 92, 0.75)';
      ctx.textBaseline = 'alphabetic';
      const nx = X(nPos.x); const ny = Y(nPos.z);
      ctx.textAlign = nx > cx ? 'right' : 'left';
      ctx.fillText(`then ${BODIES[next].name}`, nx + (nx > cx ? -10 : 10), Math.max(26, Math.min(W - 6, ny - 9)));
    } else if (nPos && leaving) {
      rim(nPos, `then ${BODIES[next].name}`, '#ffcf5c', 0.6);
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
