// The M-key system map: a 2-D orrery drawn on a <canvas>, because hundreds of
// belt dots and a dashed predicted path redrawn every frame are exactly the
// workload canvas is for and DOM nodes are not.
//
// Heliocentric (x, z) in game units maps straight onto canvas (x, y) — the
// map is a top-down view of the same plane the physics runs in (contracts.js:
// "Physics is 2-D in the world X/Z plane"). `update()` just stores the latest
// state; drawing happens on demand (on pan/zoom/update) while the map is open.
//
// This is drawn for a child planning a trip across the solar system, so
// bodies are sized by IMPORTANCE, not to physical scale (Jupiter unmissably
// the biggest, a moon never shrinking below ~7px), colour-coded, lit from the
// Sun's direction, and named with a legible dark-haloed label. A hover
// tooltip gives one plain-language fact per body.

import { el, svg, num } from './domUtil.js';
import { t } from '../level.js';
import { iconInner } from './icons.js';
import { BODIES, BODY_ORDER, BELT, SOLAR } from '../contracts.js';

/** Named zoom presets: units-per-pixel at open. Bigger = more zoomed out. */
// `focus` says WHERE each preset re-centres the view, not just how far it
// zooms — without this, "Jupiter System" only zoomed in wherever the view
// already happened to be (usually near the ship, nowhere near Jupiter).
const PRESETS = {
  inner: { label: 'Inner System', scale: 22, focus: 'ship' },
  jupiter: { label: 'Jupiter System', scale: 3.2, focus: 'jupiter' },
  whole: { label: 'Whole System', scale: 130, focus: 'sun' },
};

/** Fixed on-screen radius per body, in CSS px — importance, not physics. */
const RADIUS_PX = {
  earth: 10, moon: 8, mars: 9, ceres: 7,
  jupiter: 16, io: 7, europa: 8, ganymede: 8, callisto: 7,
  saturn: 13, uranus: 9, neptune: 9,
};
const SUN_CORE_PX = 15;
const SUN_HALO_PX = 48;

/** Roughly-true body colour, used for the disc fill and the name label. */
const COLOR = {
  sun: '#ffdca3',
  earth: '#3f7bd0',
  moon: '#b7b0a2',
  mars: '#c1653c',
  ceres: '#9d9284',
  jupiter: '#d9b98a',
  io: '#e4c467',
  europa: '#e9e3d2',
  ganymede: '#8f8577',
  callisto: '#6c6459',
  saturn: '#e8d3a0',
  uranus: '#9fe3e8',
  neptune: '#5b7cff',
};

/** One plain-language line per body for the hover tooltip. */
const FACTS = {
  sun: 'Our star. Everything here circles it.',
  earth: 'Home — this is where the journey begins.',
  moon: 'Your first landing, and the first slingshot.',
  mars: 'A quick flyby and scan on the way to the belt.',
  ceres: 'The biggest thing in the asteroid belt — a dwarf planet.',
  jupiter: t('The biggest planet — more than twice the mass of every other planet combined.', 'The biggest planet of all.'),
  io: t('A moon covered in active volcanoes.', 'A moon full of fire mountains.'),
  europa: 'The goal: an icy moon that may hide an ocean underneath.',
  ganymede: 'The biggest moon in the whole solar system.',
  callisto: t('The most heavily cratered place in the solar system.', 'A moon covered in holes from rocks.'),
  saturn: 'Famous for its wide, bright rings.',
  uranus: 'Tipped on its side — it spins almost lying down.',
  neptune: 'The windiest planet, way out at the edge.',
};

export function bodyColor(id) { return COLOR[id] || '#cdbfa9'; }

/** A tiny seeded PRNG (mulberry32) so the belt's dust looks the same every time it's drawn, not reshuffled each frame. */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Precomputed once: polar offsets for the belt's dust, reused every draw. */
function buildBeltDust(count) {
  const rng = makeRng(20260924);
  const dust = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = rng();
    const radius = BELT.inner + t * (BELT.outer - BELT.inner);
    const angle = rng() * Math.PI * 2;
    const jitter = (rng() - 0.5) * (BELT.outer - BELT.inner) * 0.06;
    dust[i] = { radius: radius + jitter, angle, size: 0.6 + rng() * 1.1, alpha: 0.25 + rng() * 0.4 };
  }
  return dust;
}

/** A "nice" round number (1/2/5 x 10^n) for a legend scale bar near targetPx. */
function niceScaleUnits(scale, targetPx) {
  const raw = targetPx * scale;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  let best = mag;
  for (const m of [1, 2, 5, 10]) {
    const c = m * mag;
    if (Math.abs(c - raw) < Math.abs(best - raw)) best = c;
  }
  return best;
}

function fmtRatio(r) {
  if (r >= 1) return `${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}×`;
  const inv = 1 / r;
  return `1/${inv >= 10 ? Math.round(inv) : Math.round(inv * 10) / 10}`;
}

export function createMap(root, { bus } = {}) {
  const wrap = el('div', 'sp-map');
  wrap.hidden = true;

  const canvas = el('canvas', 'sp-map__canvas');
  wrap.appendChild(canvas);

  const controls = el('div', 'sp-map__controls');
  const zoomButtons = {};
  for (const [key, preset] of Object.entries(PRESETS)) {
    const btn = el('button', 'sp-map__zoom', preset.label);
    btn.type = 'button';
    btn.addEventListener('click', () => setZoom(key));
    controls.appendChild(btn);
    zoomButtons[key] = btn;
  }
  wrap.appendChild(controls);

  const closeBtn = el('button', 'sp-map__close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close map');
  closeBtn.appendChild(svg(iconInner('close')));
  closeBtn.addEventListener('click', () => close());
  wrap.appendChild(closeBtn);

  const legend = el('div', 'sp-map__legend');
  legend.innerHTML = ''
    + '<div>Orange arrow = your ship, pointing the way it is heading</div>'
    + '<div>Dotted line = predicted path (fades further into the future)</div>'
    + '<div>Dashed circle = where the target will be when you arrive</div>'
    + '<div>Drag to pan &middot; scroll to zoom &middot; Esc to close</div>';
  wrap.appendChild(legend);

  const tooltip = el('div', 'sp-map__tooltip');
  tooltip.hidden = true;
  wrap.appendChild(tooltip);

  root.appendChild(wrap);

  let open = false;
  let scale = PRESETS.inner.scale; // game units per pixel
  let panX = 0;
  let panZ = 0; // heliocentric offset the view is centred on
  let dragging = false;
  let lastMouse = null;
  let latest = null; // last state passed to update()
  const beltDust = buildBeltDust(BELT.visualCount ? Math.min(BELT.visualCount, 900) : 500);
  /** Screen-space hit targets for the hover tooltip, refreshed every draw(). */
  let hitTargets = [];

  /** Reads --hud-scale live, so the map's text grows with the rest of the HUD. */
  function typeScale() {
    const v = parseFloat(getComputedStyle(root).getPropertyValue('--hud-scale'));
    return Number.isFinite(v) && v > 0 ? v : 1.3;
  }

  function setZoom(key) {
    const preset = PRESETS[key] || PRESETS.inner;
    scale = preset.scale;
    for (const [k, btn] of Object.entries(zoomButtons)) btn.classList.toggle('is-active', k === key);

    const bodies = latest && latest.bodies;
    if (preset.focus === 'sun') {
      panX = 0; panZ = 0;
    } else if (preset.focus === 'jupiter' && bodies && bodies.jupiter) {
      panX = bodies.jupiter.x; panZ = bodies.jupiter.z;
    } else if (latest && latest.ship) {
      panX = latest.ship.x; panZ = latest.ship.z;
    }
    draw();
  }

  function resize() {
    const w = Math.min(root.clientWidth - 40, 1400);
    const h = Math.min(root.clientHeight - 40, 820);
    canvas.width = Math.max(320, w);
    canvas.height = Math.max(240, h);
    draw();
  }

  function toXY(hx, hz) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return [cx + (hx - panX) / scale, cy + (hz - panZ) / scale];
  }

  function drawSun(ctx) {
    const [sx, sy] = toXY(0, 0);
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, SUN_HALO_PX);
    halo.addColorStop(0, 'rgba(255, 214, 158, 0.55)');
    halo.addColorStop(0.4, 'rgba(255, 180, 110, 0.22)');
    halo.addColorStop(1, 'rgba(255, 150, 90, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, SUN_HALO_PX, 0, Math.PI * 2); ctx.fill();

    const core = ctx.createRadialGradient(sx - SUN_CORE_PX * 0.3, sy - SUN_CORE_PX * 0.3, 0, sx, sy, SUN_CORE_PX);
    core.addColorStop(0, '#fff6e0');
    core.addColorStop(0.6, '#ffd27a');
    core.addColorStop(1, '#ff9f4d');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(sx, sy, SUN_CORE_PX, 0, Math.PI * 2); ctx.fill();
    return { id: 'sun', name: 'Sun', x: sx, y: sy, r: SUN_HALO_PX };
  }

  /** A filled disc with a soft lit side facing the Sun (the light source is always heliocentric (0,0)). */
  function drawBody(ctx, id, hx, hz, r) {
    const [x, y] = toXY(hx, hz);
    const distFromSun = Math.hypot(hx, hz) || 1;
    const dirX = -hx / distFromSun;
    const dirZ = -hz / distFromSun; // unit vector FROM body TOWARD the sun
    const color = bodyColor(id);

    const grad = ctx.createRadialGradient(
      x + dirX * r * 0.45, y + dirZ * r * 0.45, r * 0.15,
      x, y, r * 1.15,
    );
    grad.addColorStop(0, lighten(color, 0.35));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, darken(color, 0.35));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    if (id === 'saturn') {
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 211, 160, 0.75)';
      ctx.lineWidth = Math.max(1.4, r * 0.16);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.9, r * 0.62, -0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return [x, y];
  }

  function lighten(hex, amt) { return mix(hex, '#ffffff', amt); }
  function darken(hex, amt) { return mix(hex, '#000000', amt); }
  function mix(hex, target, amt) {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(target.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * amt);
    const g = Math.round(ag + (bg - ag) * amt);
    const bl = Math.round(ab + (bb - ab) * amt);
    return `rgb(${r},${g},${bl})`;
  }

  function drawName(ctx, name, x, y, r, fontPx) {
    ctx.font = `700 ${fontPx}px Segoe UI, system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 6, 4, 0.88)';
    ctx.fillStyle = '#f7efe2';
    ctx.textBaseline = 'middle';
    const tx = x + r + 6;
    ctx.strokeText(name, tx, y);
    ctx.fillText(name, tx, y);
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    // Warm near-black, matching the HUD palette — not blue-black.
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, w, h);
    hitTargets = [];

    if (!latest) return;
    const { bodies = {}, orbits, ship, path, target, ghost } = latest;
    const tScale = typeScale();

    // Orbit circles. Explicit `orbits` entries win; otherwise fall back to
    // drawing every body's own contracts.js orbit, centred on wherever its
    // parent currently sits — so the map never looks bare just because the
    // caller didn't pass anything.
    ctx.lineWidth = 1;
    const explicit = Array.isArray(orbits) ? orbits : [];
    for (const o of explicit) {
      if (!o) continue;
      const [cx, cy] = toXY(num(o.cx, 0), num(o.cz, 0));
      ctx.strokeStyle = o.color || 'rgba(255,238,214,0.16)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, num(o.radius, 0) / scale), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (explicit.length === 0) {
      for (const id of BODY_ORDER) {
        const b = BODIES[id];
        if (!b || !b.parent) continue;
        const center = b.parent === 'sun' ? { x: 0, z: 0 } : bodies[b.parent];
        if (!center) continue;
        const [cx, cy] = toXY(center.x, center.z);
        ctx.strokeStyle = 'rgba(255,238,214,0.14)';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, b.orbit / scale), 0, Math.PI * 2);
        ctx.stroke();
      }

      // The belt: a visible dusty band, not just two thin boundary rings.
      const dotsInView = beltDust;
      ctx.save();
      for (const d of dotsInView) {
        const hx = Math.cos(d.angle) * d.radius;
        const hz = Math.sin(d.angle) * d.radius;
        const [x, y] = toXY(hx, hz);
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
        ctx.fillStyle = `rgba(205, 191, 169, ${d.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, d.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(205,191,169,0.14)';
      ctx.setLineDash([2, 5]);
      const [sx0, sy0] = toXY(0, 0);
      ctx.beginPath(); ctx.arc(sx0, sy0, BELT.inner / scale, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx0, sy0, BELT.outer / scale, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Label the band along its own ring, upper-right of the sun, where it
      // reads clearly without a body usually sitting on top of it.
      const midR = (BELT.inner + BELT.outer) / 2;
      const [lx, ly] = toXY(midR * Math.cos(-0.55), midR * Math.sin(-0.55));
      if (lx > 0 && lx < w && ly > 0 && ly < h) {
        ctx.font = `700 ${Math.round(10.8 * tScale)}px Segoe UI, system-ui, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(8, 6, 4, 0.88)';
        ctx.fillStyle = 'rgba(205, 191, 169, 0.95)';
        ctx.textBaseline = 'middle';
        ctx.strokeText('Asteroid belt', lx, ly);
        ctx.fillText('Asteroid belt', lx, ly);
      }
    }

    // Predicted path: a dotted line that fades the further into the future it goes.
    if (path && path.length >= 4) {
      const n = Math.floor(path.length / 2);
      for (let i = 0; i < n; i += 3) {
        const t = i / Math.max(1, n - 1);
        const [x, y] = toXY(path[i * 2], path[i * 2 + 1]);
        ctx.fillStyle = `rgba(191, 233, 255, ${0.9 - t * 0.75})`;
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // The Sun, always at heliocentric (0,0).
    hitTargets.push(drawSun(ctx));

    // Every other body.
    const nameFont = Math.round(11 * tScale);
    for (const id of BODY_ORDER) {
      const b = BODIES[id];
      const p = bodies[id];
      if (!b || !p || id === 'sun') continue;
      const r = RADIUS_PX[id] || 7;
      const [x, y] = drawBody(ctx, id, p.x, p.z, r);
      drawName(ctx, b.name, x, y, r, nameFont);
      hitTargets.push({ id, name: b.name, x, y, r });
    }

    // Ghost: where the target body WILL be when the ship arrives.
    if (ghost && Number.isFinite(ghost.x) && Number.isFinite(ghost.z)) {
      const [gx, gy] = toXY(ghost.x, ghost.z);
      const gr = (target && RADIUS_PX[target] ? RADIUS_PX[target] : 9) + 5;
      ctx.strokeStyle = 'rgba(191,233,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      const label = `${target ? (BODIES[target]?.name ?? target) : 'Target'} (when you arrive)`;
      ctx.font = `700 ${Math.round(10.8 * tScale)}px Segoe UI, system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8, 6, 4, 0.88)';
      ctx.fillStyle = 'rgba(191, 233, 255, 0.95)';
      ctx.textBaseline = 'middle';
      ctx.strokeText(label, gx + gr + 6, gy);
      ctx.fillText(label, gx + gr + 6, gy);
    }

    // The ship: an orange arrow pointing along its heading (approximated from
    // the first meaningfully-offset point of its own predicted path).
    if (ship && Number.isFinite(ship.x) && Number.isFinite(ship.z)) {
      const [x, y] = toXY(ship.x, ship.z);
      let heading = -Math.PI / 2; // default: pointing "up" the screen
      if (path && path.length >= 4) {
        for (let i = 0; i < path.length; i += 2) {
          const dx = path[i] - ship.x;
          const dz = path[i + 1] - ship.z;
          if (Math.hypot(dx, dz) > 1e-3) { heading = Math.atan2(dz, dx); break; }
        }
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = '#ff7847';
      ctx.strokeStyle = '#14100c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    drawScaleHint(ctx, w, h, tScale);
  }

  /** A small "Earth → Sun" reference bar, bottom-right, so the zoom level has a graspable anchor. */
  function drawScaleHint(ctx, w, h, tScale) {
    const targetPx = 90;
    const units = niceScaleUnits(scale, targetPx);
    const px = units / scale;
    const x1 = w - 24 - px;
    const x2 = w - 24;
    const y = h - 30;

    ctx.strokeStyle = 'rgba(247, 239, 226, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5);
    ctx.moveTo(x2, y - 5); ctx.lineTo(x2, y + 5);
    ctx.stroke();

    const ratio = units / SOLAR.referenceDistance;
    const label = `${Math.round(units).toLocaleString('en-US')} u ≈ ${fmtRatio(ratio)} Earth→Sun`;
    ctx.font = `700 ${Math.round(10.5 * tScale)}px Segoe UI, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 6, 4, 0.88)';
    ctx.fillStyle = 'rgba(247, 239, 226, 0.9)';
    ctx.strokeText(label, x2, y - 9);
    ctx.fillText(label, x2, y - 9);
    ctx.textAlign = 'left';
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    scale = Math.max(0.5, Math.min(4000, scale * factor));
    for (const btn of Object.values(zoomButtons)) btn.classList.remove('is-active');
    draw();
  }
  function onDown(e) { dragging = true; lastMouse = [e.clientX, e.clientY]; }
  function onMove(e) {
    if (dragging) {
      const [lx, ly] = lastMouse;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      panX -= dx * scale;
      panZ -= dy * scale;
      lastMouse = [e.clientX, e.clientY];
      draw();
      hideTooltip();
      return;
    }
    hoverAt(e);
  }
  function onUp() { dragging = false; }
  function onLeave() { hideTooltip(); }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  function hoverAt(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    let bestD = Infinity;
    for (const t of hitTargets) {
      const d = Math.hypot(mx - t.x, my - t.y);
      const hitR = Math.max(t.r, 12);
      if (d <= hitR && d < bestD) { best = t; bestD = d; }
    }
    if (!best) { hideTooltip(); return; }
    tooltip.hidden = false;
    tooltip.style.left = `${best.x}px`;
    tooltip.style.top = `${best.y - best.r}px`;
    tooltip.innerHTML = `<b>${best.name}</b><br>${FACTS[best.id] || ''}`;
  }
  function hideTooltip() { tooltip.hidden = true; }

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  window.addEventListener('mouseup', onUp);
  wrap.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => open && resize());

  function update(state) {
    latest = state;
    if (state && state.ship && panX === 0 && panZ === 0) { panX = state.ship.x; panZ = state.ship.z; }
    if (open) draw();
  }

  function openMap() {
    if (open) return;
    open = true;
    wrap.hidden = false;
    wrap.tabIndex = -1;
    setZoom('inner'); // also centres on the ship (focus: 'ship')
    resize();
    try { wrap.focus(); } catch { /* detached */ }
    if (bus && typeof bus.emit === 'function') bus.emit('ui-modal', true);
  }
  function close() {
    if (!open) return;
    open = false;
    wrap.hidden = true;
    hideTooltip();
    if (bus && typeof bus.emit === 'function') bus.emit('ui-modal', false);
  }
  function toggle() { (open ? close : openMap)(); }
  function isOpen() { return open; }

  return { root: wrap, open: openMap, close, toggle, isOpen, update };
}
