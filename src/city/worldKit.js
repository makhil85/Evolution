// Small building blocks for the Chapter 2 3-D world: a mesher that turns a
// pile of coloured primitives into ONE vertex-coloured toon mesh (plus one
// merged outline hull), and canvas-texture labels.
//
// Why a mesher and not GLB pieces: the old game's look is "little coloured
// buildings" (blue academy, yellow power station, purple vault...). The model
// packs are textured or charcoal, so recolouring them fights the pack. Boxes,
// cylinders and roofs with an explicit palette keep every colour exactly where
// the old game had it, cost one draw call per building, and still get the
// Chapter 3 toon ramp and dark outlines.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, outlineMaterial } from '../game/toonPipeline.js';

/** Lit toon material for vertex-coloured geometry (shared by every building). */
export const LIT = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });
/** Unlit material for windows, screens, lamps, glowing energy. */
export const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });

const _c = new THREE.Color();

function paintGeo(geo, hex) {
  _c.set(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Give a geometry the attribute set every part shares, so they can merge. */
function normalise(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

const _tmpBox = new THREE.Box3();
const _size = new THREE.Vector3();
const _ctr = new THREE.Vector3();

/**
 * Collects primitives. Positions use a BASE-CENTRE convention: `y` is the
 * bottom of the part, `x`/`z` its centre, so stacking reads like building.
 * Rotations (`rx`, `ry`, `rz`, radians) turn the part about that base-centre.
 *
 * `opts.transform` (constructor) bakes a final rotation + offset into every
 * part, so several buildings can share one mesh.
 */
export class Mesher {
  constructor({ ry = 0, x = 0, y = 0, z = 0, outlineT = 0.05 } = {}) {
    this.lit = [];
    this.glow = [];
    this.hulls = [];
    this.t = outlineT;
    this.base = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1),
    );
    this.hasBase = ry !== 0 || x !== 0 || y !== 0 || z !== 0;
  }

  /** Internal: finish a positioned geometry and file it. */
  _push(geo, color, x, y, z, o = {}) {
    let g = normalise(geo);
    if (o.rx) g.rotateX(o.rx);
    if (o.ry) g.rotateY(o.ry);
    if (o.rz) g.rotateZ(o.rz);
    g.translate(x, y, z);

    // Outline hull: this part scaled about its own bounding-box centre, so the
    // dark rim has the same thickness on a step as on a wall.
    if (o.outline !== false && !o.glow) {
      _tmpBox.setFromBufferAttribute(g.attributes.position);
      _tmpBox.getSize(_size);
      if (Math.max(_size.x, _size.y, _size.z) > 0.16) {
        _tmpBox.getCenter(_ctr);
        const t = o.t ?? this.t;
        const h = new THREE.BufferGeometry();
        h.setAttribute('position', g.attributes.position.clone());
        const pos = h.attributes.position;
        const kx = _size.x > 1e-3 ? (_size.x + 2 * t) / _size.x : 1;
        const ky = _size.y > 1e-3 ? (_size.y + 2 * t) / _size.y : 1;
        const kz = _size.z > 1e-3 ? (_size.z + 2 * t) / _size.z : 1;
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(i,
            _ctr.x + (pos.getX(i) - _ctr.x) * kx,
            _ctr.y + (pos.getY(i) - _ctr.y) * ky,
            _ctr.z + (pos.getZ(i) - _ctr.z) * kz);
        }
        if (this.hasBase) h.applyMatrix4(this.base);
        this.hulls.push(h);
      }
    }

    paintGeo(g, color);
    if (this.hasBase) g.applyMatrix4(this.base);
    (o.glow ? this.glow : this.lit).push(g);
    return this;
  }

  box(w, h, d, x, y, z, color, o) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this._push(g, color, x, y, z, o);
  }

  /** Cylinder standing on `y`. rTop/rBot differ for tapers. */
  cyl(rTop, rBot, h, x, y, z, color, o = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 12, 1);
    g.translate(0, h / 2, 0);
    return this._push(g, color, x, y, z, o);
  }

  /** Cylinder lying along X, centred on (x, y, z). */
  tubeX(len, r, x, y, z, color, o = {}) {
    const g = new THREE.CylinderGeometry(r, r, len, o.seg ?? 8, 1);
    g.rotateZ(Math.PI / 2);
    return this._push(g, color, x, y, z, o);
  }

  tubeZ(len, r, x, y, z, color, o = {}) {
    const g = new THREE.CylinderGeometry(r, r, len, o.seg ?? 8, 1);
    g.rotateX(Math.PI / 2);
    return this._push(g, color, x, y, z, o);
  }

  /** A straight tube between two points (cables, braces). */
  tube(ax, ay, az, bx, by, bz, r, color, o = {}) {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, o.seg ?? 6, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5);
    return this._push(g, color, m.x, m.y, m.z, { outline: false, ...o });
  }

  /** Sphere centred on (x, y, z). */
  sph(r, x, y, z, color, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg ?? 12, o.segV ?? 9, 0, Math.PI * 2, 0, o.thetaLen ?? Math.PI);
    if (o.sy) g.scale(1, o.sy, 1);
    return this._push(g, color, x, y, z, o);
  }

  /** Four-sided pyramid roof, base w x d, standing on `y`. */
  pyramid(w, d, h, x, y, z, color, o = {}) {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, h, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(w, 1, d);
    g.translate(0, h / 2, 0);
    return this._push(g, color, x, y, z, o);
  }

  cone(r, h, x, y, z, color, o = {}) {
    const g = new THREE.ConeGeometry(r, h, o.seg ?? 10, 1);
    g.translate(0, h / 2, 0);
    return this._push(g, color, x, y, z, o);
  }

  torus(R, r, arc, x, y, z, color, o = {}) {
    const g = new THREE.TorusGeometry(R, r, o.segT ?? 8, o.segR ?? 20, arc);
    return this._push(g, color, x, y, z, o);
  }

  /**
   * Triangular-prism roof. Ridge runs along Z (gable ends face +-Z); pass
   * `ry: Math.PI / 2` to run it along X. `w` is the eaves-to-eaves width.
   */
  gable(w, d, h, x, y, z, color, o = {}) {
    const hw = w / 2, hd = d / 2;
    const P = {
      a: [-hw, 0, -hd], b: [-hw, 0, hd], c: [hw, 0, hd], e: [hw, 0, -hd],
      r0: [0, h, -hd], r1: [0, h, hd],
    };
    const pos = [];
    const tri = (p, q, r, hint) => {
      const u = new THREE.Vector3(...q).sub(new THREE.Vector3(...p));
      const v = new THREE.Vector3(...r).sub(new THREE.Vector3(...p));
      const n = u.cross(v);
      const flip = n.dot(new THREE.Vector3(...hint)) < 0;
      const order = flip ? [p, r, q] : [p, q, r];
      order.forEach((k) => pos.push(...k));
    };
    // left + right slopes
    tri(P.a, P.b, P.r1, [-h, hw, 0]); tri(P.a, P.r1, P.r0, [-h, hw, 0]);
    tri(P.c, P.e, P.r0, [h, hw, 0]); tri(P.c, P.r0, P.r1, [h, hw, 0]);
    // gable ends
    tri(P.b, P.c, P.r1, [0, 0, 1]);
    tri(P.e, P.a, P.r0, [0, 0, -1]);
    // underside, so the roof is not see-through from a low angle
    tri(P.a, P.e, P.c, [0, -1, 0]); tri(P.a, P.c, P.b, [0, -1, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return this._push(g, color, x, y, z, o);
  }

  /** Flat plate lying in the XZ plane, e.g. a floor tile. */
  plate(w, d, x, y, z, color, o = {}) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    return this._push(g, color, x, y, z, { outline: false, ...o });
  }

  /** Merge everything into a Group: lit mesh, glow mesh, outline hull. */
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    if (this.lit.length) {
      const geo = mergeGeometries(this.lit, false);
      this.lit.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, LIT);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    if (this.glow.length) {
      const geo = mergeGeometries(this.glow, false);
      this.glow.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, GLOW);
      group.add(mesh);
    }
    if (this.hulls.length) {
      const geo = mergeGeometries(this.hulls, false);
      this.hulls.forEach((g) => g.dispose());
      const hull = new THREE.Mesh(geo, outlineMaterial);
      hull.userData.isOutline = true;
      group.add(hull);
    }
    this.lit = []; this.glow = []; this.hulls = [];
    return group;
  }
}

/**
 * A toothed gear as its own group (so it can spin): body disc, teeth, hub.
 * Axis along +Z; scale to taste. Radius r, thickness t.
 */
export function makeGear({ r = 0.6, t = 0.16, teeth = 10, color = 0xffc233, hub = 0x6c757d } = {}) {
  const m = new Mesher({ outlineT: 0.035 });
  const body = new THREE.CylinderGeometry(r, r, t, 20, 1);
  body.rotateX(Math.PI / 2);
  m._push(body, color, 0, 0, 0);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const g = new THREE.BoxGeometry(r * 0.36, r * 0.3, t);
    g.rotateZ(a);
    m._push(g, color, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, 0);
  }
  const axle = new THREE.CylinderGeometry(r * 0.28, r * 0.28, t * 1.5, 12, 1);
  axle.rotateX(Math.PI / 2);
  m._push(axle, hub, 0, 0, 0);
  const hole = new THREE.CylinderGeometry(r * 0.12, r * 0.12, t * 1.7, 8, 1);
  hole.rotateX(Math.PI / 2);
  m._push(hole, 0x343a40, 0, 0, 0, { outline: false });
  return m.build({ receiveShadow: false });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A floating name sign: dark rounded board, optional emoji, white text.
 * Returns a Sprite anchored at its bottom-centre. `height` is world units.
 */
export function makeLabel(text, { icon = '', height = 0.62, accent = '#ffd43b', fontPx = 44 } = {}) {
  const H = 88;
  const pad = 26;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `700 ${fontPx}px ${FONT}`;
  const tw = Math.ceil(meas.measureText(text).width);
  const iconW = icon ? fontPx + 14 : 0;
  const W = tw + iconW + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  roundRect(ctx, 3, 3, W - 6, H - 6, 22);
  ctx.fillStyle = 'rgba(16, 26, 44, 0.86)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  let x = pad;
  if (icon) {
    ctx.font = `${fontPx - 4}px ${EMOJI}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x, H / 2 + 3);
    x += iconW;
  }
  ctx.font = `700 ${fontPx}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, H / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(height * (W / H), height, 1);
  sprite.renderOrder = 30;
  sprite.userData.isLabel = true;
  return sprite;
}

/** A square-ish emoji / text panel as a plane mesh (console screens, signs). */
export function makePanel(text, { w = 1, h = 0.75, bg = '#10203a', fg = '#ffffff', border = '#ffd43b', emoji = true, fontPx = 120, unlit = true } = {}) {
  const canvas = document.createElement('canvas');
  const pxW = 256, pxH = Math.round(256 * (h / w));
  canvas.width = pxW; canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  roundRect(ctx, 4, 4, pxW - 8, pxH - 8, 22);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = emoji ? `${fontPx}px ${EMOJI}` : `800 ${fontPx}px ${FONT}`;
  ctx.fillStyle = fg;
  ctx.fillText(text, pxW / 2, pxH / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = unlit
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshToonMaterial({ map: tex, gradientMap: toonRamp });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Seeded RNG, so the world is identical every load. */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
