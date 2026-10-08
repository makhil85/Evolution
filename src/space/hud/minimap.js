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

import { el } from './domUtil.js';
import { BODIES, BELT } from '../contracts.js';
import { bodyState } from '../orbits.js';
import { bodyColor } from './map.js';

const REDRAW_MS = 100; // ~10 Hz is plenty for a map, and cheap
const _c = { x: 0, z: 0, vx: 0, vz: 0 };

function centreAt(id, t) {
  if (id === 'sun') return { x: 0, z: 0 };
  const s = bodyState(id, t, _c);
  return { x: s.x, z: s.z };
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
  let smoothR = 0; let smoothFor = null; // the eased frame size while leaving a system

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
    let centre = local || 'sun';
    if (local && pts && times && times.length) {
      const n = Math.min(times.length, pts.length / 2);
      const c = centreAt(local, times[n - 1]);
      if (Math.hypot(pts[2 * (n - 1)] - c.x, pts[2 * (n - 1) + 1] - c.z) > BODIES[local].soi * 0.98) centre = BODIES[local].parent || 'sun';
    }
    const C0 = centreAt(centre, st.time);
    const rel = (x, z, t) => {
      const c = t === undefined ? C0 : centreAt(centre, t);
      return { x: x - c.x, z: z - c.z };
    };

    // The dotted path, in the centre body's frame moment by moment.
    const path = [];
    if (pts && times) {
      const n = Math.min(times.length, pts.length / 2);
      const stride = n > 200 ? 2 : 1;
      for (let i = 0; i < n; i += stride) path.push(rel(pts[2 * i], pts[2 * i + 1], times[i]));
    }

    const ship = rel(st.ship.x, st.ship.z);
    const shipD = Math.hypot(ship.x, ship.z);

    // What to fit: her, her path (not wildly beyond her), the target.
    const target = st.target && BODIES[st.target] ? st.target : null;
    const targetInFrame = target && target !== centre && (BODIES[target].parent === centre || centre === 'sun');
    let targetPos = null;
    if (targetInFrame) {
      const tb = st.bodies[target];
      targetPos = tb ? rel(tb.x, tb.z) : null;
    }
    // Out round the Sun she may be heading anywhere: frame her, the target
    // and a guess at the stop after it (the next planet out), not her path.
    const next = centre === 'sun' ? nextOut(target) : null;
    const nextPos = next && st.bodies[next] ? rel(st.bodies[next].x, st.bodies[next].z) : null;
    let R = Math.max(shipD, centre === 'sun' ? 0 : BODIES[centre].radius * 3);
    if (centre === 'sun') {
      if (!targetPos) R = shipD * 1.3;
      if (nextPos) R = Math.max(R, Math.hypot(nextPos.x, nextPos.z));
    } else {
      const cap = Math.max(shipD, targetPos ? Math.hypot(targetPos.x, targetPos.z) : 0) * 2.2 || Infinity;
      for (const p of path) { const d = Math.hypot(p.x, p.z); if (d > R && d < cap) R = d; }
    }
    if (targetPos) R = Math.max(R, Math.hypot(targetPos.x, targetPos.z) + (BODIES[target].soi || 0) * 0.3);
    R *= 1.12;
    // Leaving a planet's system (lead, 2026-10-08): the map starts on her
    // round orbit and widens smoothly as the path stretches into a longer
    // and longer oval and breaks away. (No arrow to the next planet: she
    // leaves along the planet's own path, and an arrow elsewhere would pull
    // her off it.)
    const leaving = !!st.escape && centre !== 'sun';
    // Eased, so the map grows (or shrinks) instead of jumping; a new view starts fresh.
    if (smoothFor !== centre) { smoothFor = centre; smoothR = R; }
    smoothR += (R - smoothR) * (R > smoothR ? 0.18 : 0.06);
    R = smoothR;
    // Jupiter's and Saturn's moons crowd the map on the way out and make it
    // look like the whole Solar System: only the planet, her path and the
    // way to go.
    const hideMoons = leaving && (centre === 'jupiter' || centre === 'saturn');
    const scale = (W / 2 - 14) / R;
    const X = (p) => cx + p.x * scale;
    const Y = (p) => cy + p.z * scale;

    // Frame.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 10, 9, 0.78)';
    ctx.fill();
    ctx.clip();

    // The asteroid belt, when the Sun is the centre.
    if (centre === 'sun' && BELT.inner * scale < W) {
      ctx.beginPath();
      ctx.arc(cx, cy, ((BELT.inner + BELT.outer) / 2) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(205, 191, 169, 0.16)';
      ctx.lineWidth = Math.max(2, (BELT.outer - BELT.inner) * scale);
      ctx.stroke();
    }

    // Orbits and bodies that circle the centre (moons, or planets).
    for (const id of Object.keys(BODIES)) {
      const b = BODIES[id];
      if (b.parent !== centre || !st.bodies[id] || hideMoons) continue;
      const orbitPx = b.orbit * scale;
      if (orbitPx > W * 1.5) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, orbitPx, 0, Math.PI * 2);
      ctx.strokeStyle = id === target ? 'rgba(255, 207, 92, 0.45)' : 'rgba(255, 238, 214, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const p = rel(st.bodies[id].x, st.bodies[id].z);
      ctx.beginPath();
      ctx.arc(X(p), Y(p), Math.max(2.5, b.radius * scale), 0, Math.PI * 2);
      ctx.fillStyle = bodyColor(id);
      ctx.fill();
    }

    // The centre body itself.
    const cr = centre === 'sun' ? 5 : Math.max(4, BODIES[centre].radius * scale);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor(centre);
    ctx.fill();

    // The guessed next stop: a fainter ring.
    if (nextPos) {
      ctx.beginPath();
      ctx.arc(X(nextPos), Y(nextPos), 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The target: a ring you can't miss, and its name.
    if (targetPos) {
      const tx = X(targetPos); const ty = Y(targetPos);
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

    // The target's name, outside the clip so the rim never cuts it off.
    if (targetPos) {
      const tx = X(targetPos); const ty = Y(targetPos);
      ctx.font = '700 11px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffcf5c';
      // On the side away from her arrow, so the two never overlap; stay
      // inside the circle either way.
      const sxT = X(ship);
      let right = sxT < tx;
      if (right && tx > W - 60) right = false;
      if (!right && tx < 60) right = true;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(target === 'moon' ? 'the Moon' : BODIES[target].name, tx + (right ? 11 : -11), Math.max(26, Math.min(W - 6, ty + (Y(ship) < ty ? 16 : -8))));
    }

    if (nextPos) {
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 207, 92, 0.75)';
      const nx = X(nextPos); const ny = Y(nextPos);
      ctx.textAlign = nx > cx ? 'right' : 'left';
      ctx.fillText(`then ${BODIES[next].name}`, nx + (nx > cx ? -10 : 10), Math.max(26, Math.min(W - 6, ny - 9)));
    }

    // Rim and title.
    ctx.beginPath();
    ctx.arc(cx, cy, W / 2 - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 238, 214, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '800 10.5px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cdbfa9';
    ctx.fillText((leaving ? `Leaving ${centre === 'moon' ? 'the Moon' : BODIES[centre]?.name || centre} · top view` : titleFor(centre)).toUpperCase(), cx, 12);
  }

  return {
    el: wrap,
    /** Show or hide it (N key). */
    toggle() { shown = !shown; wrap.classList.toggle('is-hidden', !shown); },
    /**
     * @param {{time:number, bodies:object, ship:{x,z,angle}, soi:string,
     *   path?:Float64Array, times?:Float64Array, target?:string, hidden?:boolean,
     *   escape?:boolean}} st   escape: a leave-the-system step (eased zoom, no gas-giant moons)
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
