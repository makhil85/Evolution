// Chapter 6 interior: the shared building kit for the ship's decks (Star
// Trek style, lead 2026-10-08: soft beige-grey wall panels, dark carpet,
// light coves instead of bare lamps, LCARS-style screens, sliding doors).
// Every deck module (bridge.js, lifeDeck.js, engineering.js, crewDeck.js)
// builds from this, so the decks look like one ship.
//
//   const kit = createKit();
//   const b = kit.batch();                  // static parts, merged per material
//   b.box(w, h, d, kit.mats.wall, x, y, z, ry)
//   b.cyl(rTop, rBot, h, kit.mats.trim, x, y, z, { seg, open })
//   b.add(geometry, mat, x, y, z, ry)       // any geometry
//   b.flush(group)                          // one mesh per material (few draw calls)
//   kit.wall(b, x0, z0, x1, z1, { h, cove }) -> solid shape for the walk map
//   kit.wallArc(b, cx, cz, r, a0, a1, { h, inward })   a curved wall (angles atan2(x, z))
//   kit.floor(b, shape, { mat })            same shapes as walkmap.js (rect / disc / ring)
//   kit.ceiling(b, shape, h)                with a soft light panel in it
//   kit.screen(w, h, { title, accent, seed, kind })   an LCARS-style panel mesh
//   kit.sign(text, { w, h, color })         a lit name plate
//   kit.door(x, z, ry, { w, h })            sliding door pair: { group, update(dt, herX, herZ) }
//   kit.console(x, z, ry, { w, screen })    a console desk with a screen: { group, screen, solid }
//   kit.starWindow(w, h, { speed })         stars outside, drifting as the ring turns: { mesh, update(t) }
//   kit.lamp(color)                         a small status lamp (the shell recolours it)
//   kit.dispose()
//
// Lighting rule (issue d, "too strong"): the decks get their look from
// emissive strips and screens, not from strong lights. The shell adds one
// soft hemisphere light; a deck may add at most two point lights of
// intensity <= 8. Anything meant to glow uses kit.glow(color, k) with k
// 1.3-2 (the game's bloom starts at 1.25 linear); plain walls never bloom.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonRamp } from '../../../game/toonPipeline.js';

/** Star Trek-ish palette (TNG-era): warm greys, plum carpet, LCARS accents. */
export const PALETTE = Object.freeze({
  wall: 0xcfc8be, wallDark: 0x8f8a86, trim: 0x6d7079, panel: 0x4a4f5c, carpet: 0x5a4f6e, deck: 0x5b5f6b,
  ceiling: 0xb9b3ab, metal: 0xa9b1bc, black: 0x1d2028, glass: 0xbfe6ff,
  // LCARS accents
  orange: 0xff9c3a, peach: 0xffcc99, lilac: 0xcc99cc, blue: 0x9fb4ff, red: 0xd96b6b, gold: 0xffc65a, teal: 0x6fe0d0,
});

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });

/** Something that glows: an unlit colour scaled into bloom range (k 1.3-2). */
export const glow = (color, k = 1.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

let seedState = 1;
const rnd = () => { seedState = (seedState * 16807) % 2147483647; return (seedState - 1) / 2147483646; };

/** An LCARS screen drawn on a canvas: the rounded elbow, bars and number blocks. */
function lcarsCanvas(w, h, { title = '', accent = PALETTE.orange, seed = 1, kind = 'panel' } = {}) {
  seedState = seed * 7919 + 1;
  const W = 512; const H = Math.max(64, Math.round((512 * h) / w));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const hex = (n) => `#${new THREE.Color(n).getHexString()}`;
  const cols = [PALETTE.orange, PALETTE.peach, PALETTE.lilac, PALETTE.blue, PALETTE.gold].map(hex);
  c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
  const pad = W * 0.03;
  if (kind === 'map') {
    // A ship schematic: the ring, the spine and the cap, in thin lines.
    c.strokeStyle = hex(PALETTE.blue); c.lineWidth = 3;
    c.beginPath(); c.ellipse(W * 0.55, H * 0.5, W * 0.18, H * 0.36, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(W * 0.12, H * 0.5); c.lineTo(W * 0.95, H * 0.5); c.stroke();
    c.fillStyle = hex(PALETTE.peach); c.fillRect(W * 0.08, H * 0.2, W * 0.03, H * 0.6);
  } else {
    // The elbow: a thick bar down the left that curves into a top bar.
    const bw = W * 0.12; const top = H * 0.16;
    c.fillStyle = hex(accent);
    c.beginPath(); c.moveTo(pad, H - pad); c.lineTo(pad, pad + top); c.quadraticCurveTo(pad, pad, pad + top, pad);
    c.lineTo(W - pad, pad); c.lineTo(W - pad, pad + top * 0.55); c.lineTo(pad + bw + top * 0.4, pad + top * 0.55);
    c.quadraticCurveTo(pad + bw, pad + top * 0.55, pad + bw, pad + top); c.lineTo(pad + bw, H - pad); c.closePath(); c.fill();
    // Blocks down the elbow.
    let y = pad + top * 1.4;
    while (y < H - pad * 2) { const bh = H * (0.06 + rnd() * 0.1); c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(pad, y, bw, bh); y += bh + H * 0.02; }
    // Number rows and bars on the right.
    const x0 = pad + bw + W * 0.04;
    c.font = `${Math.round(H * 0.07)}px monospace`;
    for (let r = 0; r < 6; r++) {
      const yy = pad + top + H * 0.08 + r * H * 0.12; if (yy > H - pad) break;
      c.fillStyle = cols[(r + seed) % cols.length];
      c.fillRect(x0, yy, (W - x0 - pad) * (0.25 + rnd() * 0.6), H * 0.045);
      c.fillStyle = '#9fb4ff'; c.fillText(String(Math.floor(rnd() * 90000 + 10000)), W - pad - W * 0.2, yy + H * 0.05);
    }
  }
  if (title) {
    c.fillStyle = '#000'; c.font = `bold ${Math.round(H * 0.11)}px system-ui, sans-serif`;
    const tw = c.measureText(title).width;
    c.fillRect(W - pad - tw - 16, pad - 2, tw + 12, H * 0.13);
    c.fillStyle = hex(PALETTE.peach); c.fillText(title, W - pad - tw - 10, pad + H * 0.1);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** A canvas of stars (for windows): seeded, tiling sideways. */
function starCanvas(seed = 3) {
  seedState = seed;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#101a3c'); g.addColorStop(1, '#1c2a5e'); // deep navy: near-black read as a dark panel
  c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 1024; const y = rnd() * 512; const r = rnd() < 0.93 ? 0.7 + rnd() * 0.6 : 1.4 + rnd() * 1.2;
    const tint = rnd(); c.fillStyle = tint < 0.15 ? '#ffd9b0' : tint < 0.3 ? '#b8ccff' : '#ffffff';
    c.globalAlpha = 0.7 + rnd() * 0.3; c.beginPath(); c.arc(x, y, r * 1.3, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createKit() {
  const owned = []; // every geometry, material and texture made here, for dispose()
  const own = (x) => { owned.push(x); return x; };
  const mats = {
    wall: own(toon(PALETTE.wall)), wallDark: own(toon(PALETTE.wallDark)), trim: own(toon(PALETTE.trim)), panel: own(toon(PALETTE.panel)),
    carpet: own(toon(PALETTE.carpet)), deck: own(toon(PALETTE.deck)), // Ceilings face down, away from every light, and went near-black
    // (the makers' note): a little emissive stands in for the light the
    // floor and walls bounce up.
    ceiling: own(toon(PALETTE.ceiling, { emissive: new THREE.Color(PALETTE.ceiling).multiplyScalar(0.35) })), metal: own(toon(PALETTE.metal)),
    black: own(toon(PALETTE.black)),
    glass: own(new THREE.MeshToonMaterial({ color: PALETTE.glass, gradientMap: toonRamp, transparent: true, opacity: 0.22, depthWrite: false })),
    cove: own(glow(0xfff0d8, 1.3)), coveCool: own(glow(0xcfe6ff, 1.3)),
    accentOrange: own(toon(PALETTE.orange)), accentLilac: own(toon(PALETTE.lilac)), accentBlue: own(toon(PALETTE.blue)),
  };

  /** Static parts collected per material and merged on flush(). */
  function batch() {
    const buckets = new Map();
    const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler(); const _s = new THREE.Vector3(1, 1, 1); const _p = new THREE.Vector3();
    const put = (geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (g !== geo) geo.dispose();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s);
      g.applyMatrix4(_m);
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(g);
      return g;
    };
    return {
      add: put,
      box(w, h, d, mat, x, y, z, ry = 0) { return put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry); },
      cyl(rt, rb, h, mat, x, y, z, { seg = 24, open = false, rx = 0, rz = 0, ry = 0 } = {}) { return put(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat, x, y, z, ry, rx, rz); },
      flush(group) {
        for (const [mat, list] of buckets) {
          const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
          for (const g of list) if (g !== merged) g.dispose();
          own(merged);
          const mesh = new THREE.Mesh(merged, mat);
          mesh.matrixAutoUpdate = false;
          group.add(mesh);
        }
        buckets.clear();
        return group;
      },
    };
  }

  /**
   * A straight wall from (x0,z0) to (x1,z1), panelled on both faces: kick
   * plate, panel seams, a light cove along the top. Returns its solid.
   */
  function wall(b, x0, z0, x1, z1, { h = 3.2, t = 0.25, cove = true } = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2;
    const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2; // box x-axis along the wall
    b.box(len, h, t, mats.wall, cx, h / 2, cz, ry);
    for (const sgn of [1, -1]) {
      const ox = Math.sin(ry) * (t / 2 + 0.02) * sgn; const oz = Math.cos(ry) * (t / 2 + 0.02) * sgn;
      b.box(len, 0.22, 0.05, mats.trim, cx + ox, 0.11, cz + oz, ry);
      if (cove) {
        b.box(len, 0.06, 0.08, mats.cove, cx + ox, h - 0.32, cz + oz, ry);
        b.box(len, 0.1, 0.18, mats.wallDark, cx + ox * 1.6, h - 0.24, cz + oz * 1.6, ry);
      }
      // Panel seams every ~1.6 m.
      const n = Math.max(1, Math.round(len / 1.6));
      for (let i = 1; i < n; i++) {
        const k = i / n - 0.5;
        b.box(0.04, h - 0.7, 0.03, mats.wallDark, cx + Math.cos(ry) * len * k + ox, h / 2 - 0.05, cz - Math.sin(ry) * len * k + oz, ry);
      }
    }
    return { rect: [cx, cz, len + t, t + 0.1], rot: ry };
  }

  /** A curved wall on a circle (cx,cz,r) from angle a0 to a1 (atan2(x, z)). Returns its solid ring arc. */
  function wallArc(b, cx, cz, r, a0, a1, { h = 3.2, t = 0.25, cove = true } = {}) {
    const span = a1 - a0;
    const seg = Math.max(6, Math.round(Math.abs(span) * r / 1.2));
    const geo = new THREE.CylinderGeometry(r, r, h, seg, 1, true, a0, span);
    b.add(geo, mats.wall, cx, h / 2, cz);
    // The inner face: the same arc with its triangles and normals turned round.
    const inn = new THREE.CylinderGeometry(r - t, r - t, h, seg, 1, true, a0, span);
    const idx = inn.index.array; for (let i = 0; i < idx.length; i += 3) { const tmp = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = tmp; }
    const nrm = inn.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), nrm.getY(i), -nrm.getZ(i));
    b.add(inn, mats.wall, cx, h / 2, cz);
    b.add(new THREE.CylinderGeometry(r - t - 0.02, r - t - 0.02, 0.22, seg, 1, true, a0, span), mats.trim, cx, 0.11, cz);
    if (cove) b.add(new THREE.CylinderGeometry(r - t - 0.05, r - t - 0.05, 0.06, seg, 1, true, a0, span), mats.cove, cx, h - 0.32, cz);
    return { ring: [cx, cz, r - t - 0.05, r + 0.05], from: a0, to: a1 };
  }

  const shapeGeo = (s, y) => {
    let g;
    if (s.rect) { g = new THREE.PlaneGeometry(s.rect[2], s.rect[3]); g.rotateX(-Math.PI / 2); if (s.rot) g.rotateY(s.rot); g.translate(s.rect[0], y, s.rect[1]); }
    else if (s.disc) { g = new THREE.CircleGeometry(s.disc[2], 48); g.rotateX(-Math.PI / 2); g.translate(s.disc[0], y, s.disc[1]); }
    else if (s.ring) {
      const span = s.from == null ? Math.PI * 2 : ((s.to - s.from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      // RingGeometry's theta runs from +x towards +y; after rotateX(-90deg) +y is -z. Map atan2(x, z) angles onto it.
      const start = s.from == null ? 0 : s.from - Math.PI / 2;
      g = new THREE.RingGeometry(s.ring[2], s.ring[3], 64, 1, start, span); g.rotateX(-Math.PI / 2); g.translate(s.ring[0], y, s.ring[1]);
    }
    return g;
  };
  function floor(b, s, { mat = mats.carpet } = {}) { b.add(shapeGeo(s, 0), mat); return s; }
  function ceiling(b, s, h = 3.2, { light = true } = {}) {
    const g = shapeGeo(s, h); // facing down: turn the triangles and normals round
    const idx = g.index; if (idx) { const a = idx.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; } }
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setY(i, -n.getY(i));
    b.add(g, mats.ceiling);
    // Two thin light strips down the long side (not a glowing slab).
    if (light && s.rect) {
      const [cx, cz, w, d] = s.rect; const along = d >= w; const len = (along ? d : w) * 0.8; const off = (along ? w : d) * 0.22;
      for (const k of [-1, 1]) b.box(along ? 0.16 : len, 0.03, along ? len : 0.16, mats.coveCool, cx + (along ? k * off : 0), h - 0.02, cz + (along ? 0 : k * off), s.rot || 0);
    }
    if (light && s.disc) b.add(new THREE.TorusGeometry(s.disc[2] * 0.45, 0.06, 6, 48).rotateX(Math.PI / 2), mats.coveCool, s.disc[0], h - 0.05, s.disc[1]);
  }

  function screen(w, h, opts = {}) {
    const tex = own(lcarsCanvas(w, h, opts));
    const mat = own(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
    const geo = own(new THREE.PlaneGeometry(w, h));
    return new THREE.Mesh(geo, mat);
  }

  function sign(text, { w = 1.6, h = 0.32, color = PALETTE.peach } = {}) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round((512 * h) / w);
    const c = cv.getContext('2d');
    c.fillStyle = '#0a0b10'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    c.fillRect(0, 0, cv.height * 0.5, cv.height); c.fillRect(cv.width - cv.height * 0.5, 0, cv.height * 0.5, cv.height);
    // Shrink the font until the name fits between the end caps.
    let px = Math.round(cv.height * 0.58);
    const room = cv.width - cv.height * 1.4;
    do { c.font = `bold ${px}px system-ui, sans-serif`; px -= 2; } while (px > 8 && c.measureText(text.toUpperCase()).width > room);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text.toUpperCase(), cv.width / 2, cv.height / 2 + 2);
    const tex = own(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(own(new THREE.PlaneGeometry(w, h)), own(new THREE.MeshBasicMaterial({ map: tex })));
  }

  /** Sliding doors in a frame at (x,z) facing ry; they open as she comes near. */
  function door(x, z, ry = 0, { w = 1.8, h = 2.4, frame = 0.2 } = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const fb = batch();
    fb.box(frame, h + frame, 0.4, mats.trim, -w / 2 - frame / 2, (h + frame) / 2, 0);
    fb.box(frame, h + frame, 0.4, mats.trim, w / 2 + frame / 2, (h + frame) / 2, 0);
    fb.box(w + frame * 2, frame, 0.4, mats.trim, 0, h + frame / 2, 0);
    fb.box(w + frame * 2, 0.05, 0.42, mats.cove, 0, h + frame + 0.02, 0);
    fb.flush(g);
    const leafGeo = own(new THREE.BoxGeometry(w / 2, h, 0.12));
    const leafMat = mats.wallDark;
    const left = new THREE.Mesh(leafGeo, leafMat); const right = new THREE.Mesh(leafGeo, leafMat);
    left.position.set(-w / 4, h / 2, 0); right.position.set(w / 4, h / 2, 0);
    const stripeGeo = own(new THREE.BoxGeometry(0.06, h * 0.8, 0.14));
    const sl = new THREE.Mesh(stripeGeo, mats.accentOrange); sl.position.x = w / 4 - 0.06; left.add(sl);
    const sr = new THREE.Mesh(stripeGeo, mats.accentOrange); sr.position.x = -w / 4 + 0.06; right.add(sr);
    g.add(left, right);
    let open = 0;
    return {
      group: g,
      /** 0 shut .. 1 open */
      get open() { return open; },
      update(dt, hx, hz, force = null) {
        const near = Math.hypot(hx - x, hz - z) < 2.6;
        const want = force ?? (near ? 1 : 0);
        open += (want - open) * Math.min(1, dt * 6);
        left.position.x = -w / 4 - open * (w / 2 - 0.05);
        right.position.x = w / 4 + open * (w / 2 - 0.05);
      },
    };
  }

  function consoleDesk(x, z, ry = 0, { w = 1.4, screen: scr = {} } = {}) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = ry;
    const lb = batch();
    lb.box(w, 0.8, 0.6, mats.panel, 0, 0.4, 0);
    lb.box(w + 0.1, 0.06, 0.75, mats.trim, 0, 0.83, 0.05);
    lb.box(w * 0.9, 0.04, 0.05, mats.cove, 0, 0.2, 0.31);
    lb.flush(group);
    const s = screen(w * 0.92, 0.5, { seed: Math.round(x * 13 + z * 7), ...scr });
    s.position.set(0, 0.9, 0.12); s.rotation.x = -Math.PI / 2 + 0.55;
    group.add(s);
    return { group, screen: s, solid: { rect: [x, z, w + 0.1, 0.85], rot: ry } };
  }

  function starWindow(w, h, { speed = 0.004, seed = 3 } = {}) {
    const tex = own(starCanvas(seed));
    tex.repeat.set(w / (h * 2), 1);
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(w, h)), own(new THREE.MeshBasicMaterial({ map: tex })));
    return { mesh, update(t) { tex.offset.x = (t * speed) % 1; } };
  }

  function lamp(color = PALETTE.gold) {
    return new THREE.Mesh(own(new THREE.SphereGeometry(0.09, 12, 8)), own(glow(color, 1.8)));
  }

  return {
    mats, batch, wall, wallArc, floor, ceiling, screen, sign, door, console: consoleDesk, starWindow, lamp, glow: (c, k) => own(glow(c, k)), own,
    dispose() { for (const x of owned) x.dispose?.(); for (const m of Object.values(mats)) m.dispose?.(); },
  };
}
