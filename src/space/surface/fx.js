// Surface scenes - effects: particles, footprints, objective beacons and the
// Easy-mode guide trail.
//
// PARTICLES obey the scene's real gravity and NO air: Moon dust kicked up by
// a footstep flies out in clean parabolas and drops, it never billows or
// hangs like smoke. That is the single most "we are on the Moon" detail.
// Vapour (the Europa plume) is the exception: it expands and fades.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// particles
// ---------------------------------------------------------------------------

const PART_VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 aColor;     // rgb, alpha
  attribute float aSize;     // metres
  uniform float uScale;      // pixels per metre at distance 1
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.05), 0.0, 256.0);
    gl_Position = projectionMatrix * mv;
    if (aColor.a <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    #include <logdepthbuf_vertex>
  }`;

const PART_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uSoft;
  varying vec4 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float a = mix(1.0 - smoothstep(0.55, 1.0, r2), exp(-r2 * 3.0), uSoft);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * @param {{ max: number, gravity: number, additive?: boolean, soft?: number, drag?: number, ground?: (x,z)=>number }} o
 */
export function createParticles({ max, gravity, additive = false, soft = 0.3, drag = 0, ground = null }) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 4);
  const size = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const age = new Float32Array(max);
  const grow = new Float32Array(max);
  const base = new Float32Array(max * 4);
  const bounce = new Uint8Array(max);
  const geo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ca = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
  const sa = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa);
  geo.setAttribute('aColor', ca);
  geo.setAttribute('aSize', sa);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 900 }, uSoft: { value: soft } },
    vertexShader: PART_VERT,
    fragmentShader: PART_FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  let head = 0;
  let alive = 0;

  /** p: {x,y,z}, v: {x,y,z}, color: [r,g,b,a] linear, size m, life s, grow m/s */
  function emit(p, v, color, sz, lf, gr = 0, b = 0) {
    const i = head;
    head = (head + 1) % max;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
    base[i * 4] = color[0]; base[i * 4 + 1] = color[1]; base[i * 4 + 2] = color[2]; base[i * 4 + 3] = color[3];
    size[i] = sz;
    life[i] = lf;
    age[i] = 0;
    grow[i] = gr;
    bounce[i] = b;
    alive = max;
  }

  function update(dt, camera, viewportH) {
    mat.uniforms.uScale.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    if (!alive) return;
    let any = 0;
    const k = drag > 0 ? Math.exp(-drag * dt) : 1;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) { col[i * 4 + 3] = 0; continue; }
      age[i] += dt;
      const t = age[i] / life[i];
      if (t >= 1) { life[i] = 0; col[i * 4 + 3] = 0; continue; }
      any++;
      vel[i * 3 + 1] -= gravity * dt;
      vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (ground && vel[i * 3 + 1] < 0) {
        const gy = ground(pos[i * 3], pos[i * 3 + 2]) + 0.01;
        if (pos[i * 3 + 1] < gy) {
          pos[i * 3 + 1] = gy;
          if (bounce[i]) { vel[i * 3 + 1] *= -0.25; vel[i * 3] *= 0.5; vel[i * 3 + 2] *= 0.5; }
          else { vel[i * 3] = 0; vel[i * 3 + 1] = 0; vel[i * 3 + 2] = 0; age[i] = Math.max(age[i], life[i] * 0.85); }
        }
      }
      size[i] += grow[i] * dt;
      const fadeIn = Math.min(1, t * 12);
      const fadeOut = 1 - Math.pow(t, 2.2);
      col[i * 4] = base[i * 4];
      col[i * 4 + 1] = base[i * 4 + 1];
      col[i * 4 + 2] = base[i * 4 + 2];
      col[i * 4 + 3] = base[i * 4 + 3] * fadeIn * fadeOut;
    }
    if (!any) alive = 0;
    pa.needsUpdate = true;
    ca.needsUpdate = true;
    sa.needsUpdate = true;
  }

  function dispose() { geo.dispose(); mat.dispose(); points.removeFromParent(); }
  return { points, emit, update, dispose };
}

// ---------------------------------------------------------------------------
// footprints
// ---------------------------------------------------------------------------

/** Paint a boot print: height (for the normal map) and a mask (alpha). */
function paintBootPrint() {
  const W = 64, Hh = 128;
  const hc = document.createElement('canvas');
  hc.width = W; hc.height = Hh;
  const g = hc.getContext('2d');
  g.fillStyle = '#fff';               // white = undisturbed height
  g.fillRect(0, 0, W, Hh);
  const sole = (inset) => {
    g.beginPath();
    // Toe at the top (v = 1 -> +Z forward after mapping), heel at the bottom.
    g.ellipse(W / 2, Hh * 0.3, W * 0.4 - inset, Hh * 0.24 - inset, 0, 0, Math.PI * 2);
    g.ellipse(W / 2 + 1, Hh * 0.72, W * 0.33 - inset, Hh * 0.19 - inset, 0, 0, Math.PI * 2);
    g.rect(W / 2 - (W * 0.33 - inset), Hh * 0.3, 2 * (W * 0.33 - inset), Hh * 0.42);
    g.fill();
  };
  g.fillStyle = '#666';
  sole(0);
  // Tread: chevron bars, pressed deeper.
  g.save();
  g.beginPath();
  g.ellipse(W / 2, Hh * 0.3, W * 0.4 - 3, Hh * 0.24 - 3, 0, 0, Math.PI * 2);
  g.ellipse(W / 2 + 1, Hh * 0.72, W * 0.33 - 3, Hh * 0.19 - 3, 0, 0, Math.PI * 2);
  g.rect(W / 2 - (W * 0.33 - 3), Hh * 0.3, 2 * (W * 0.33 - 3), Hh * 0.42);
  g.clip();
  g.strokeStyle = '#2a2a2a';
  g.lineWidth = 4.5;
  for (let y = 8; y < Hh; y += 11) {
    g.beginPath();
    g.moveTo(4, y + 5); g.lineTo(W / 2, y); g.lineTo(W - 4, y + 5);
    g.stroke();
  }
  g.restore();
  // Mask: the sole plus a soft rim of pushed-out dust.
  const mc = document.createElement('canvas');
  mc.width = W; mc.height = Hh;
  const m = mc.getContext('2d');
  m.fillStyle = '#000';
  m.fillRect(0, 0, W, Hh);
  m.filter = 'blur(3px)';
  m.fillStyle = '#fff';
  m.beginPath();
  m.ellipse(W / 2, Hh * 0.3, W * 0.46, Hh * 0.28, 0, 0, Math.PI * 2);
  m.ellipse(W / 2 + 1, Hh * 0.72, W * 0.4, Hh * 0.23, 0, 0, Math.PI * 2);
  m.rect(W / 2 - W * 0.4, Hh * 0.3, W * 0.8, Hh * 0.42);
  m.fill();
  // Height -> normal map (tangent space: +X right, +Y toe).
  const hd = g.getImageData(0, 0, W, Hh).data;
  const hh = (x, y) => hd[((Math.min(Hh - 1, Math.max(0, y)) * W) + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  const nc = document.createElement('canvas');
  nc.width = W; nc.height = Hh;
  const n = nc.getContext('2d');
  const img = n.createImageData(W, Hh);
  // Blur the height a touch first (soft edges read as dust, not stamped plastic).
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (hh(x + 1, y) - hh(x - 1, y)) * 2.2;
      const dy = (hh(x, y + 1) - hh(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * W + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;   // canvas y runs down
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  n.putImageData(img, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.colorSpace = THREE.NoColorSpace;
  const mask = new THREE.CanvasTexture(mc);
  mask.colorSpace = THREE.NoColorSpace;
  // Albedo: pressed regolith is a touch darker, tread bottoms darker still.
  const ac = document.createElement('canvas');
  ac.width = W; ac.height = Hh;
  const a = ac.getContext('2d');
  a.drawImage(hc, 0, 0);
  const albedo = new THREE.CanvasTexture(ac);
  albedo.colorSpace = THREE.SRGBColorSpace;
  return { normal, mask, albedo };
}

/**
 * Persistent footprint decals: one instanced quad per print, lying on the
 * ground a few millimetres up, oriented along her heading.
 */
export function createFootprints({ max = 900, tint = 0x8a8680, terrain }) {
  const tex = paintBootPrint();
  const geo = new THREE.PlaneGeometry(0.13, 0.27);
  geo.rotateX(-Math.PI / 2);            // lie flat; plane +Y (toe) -> -Z
  geo.rotateY(Math.PI);                  // toe toward +Z, like her
  const mat = new THREE.MeshStandardMaterial({
    color: tint, map: tex.albedo, normalMap: tex.normal, alphaMap: tex.mask,
    transparent: true, depthWrite: false, roughness: 1, metalness: 0,
  });
  mat.normalScale.set(1.4, 1.4);
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.name = 'footprints';
  mesh.count = 0;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qy = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  let next = 0;

  /** side: +1 left foot, -1 right (a slight toe-out each way; no mirroring, which would flip the winding). */
  function add(x, z, heading, side = 1, scale = 1) {
    terrain.normalAt(x, z, n);
    q.setFromUnitVectors(up, n);
    qy.setFromAxisAngle(up, heading + side * 0.08);
    q.multiply(qy);
    p.set(x, terrain.heightAt(x, z) + 0.012, z);
    s.set(scale, 1, scale);
    m4.compose(p, q, s);
    mesh.setMatrixAt(next, m4);
    next = (next + 1) % max;
    mesh.count = Math.min(max, mesh.count + 1);
    mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    geo.dispose(); mat.dispose(); mesh.dispose();
    tex.normal.dispose(); tex.mask.dispose(); tex.albedo.dispose();
  }
  return { mesh, add, dispose };
}

// ---------------------------------------------------------------------------
// beacons + guide trail
// ---------------------------------------------------------------------------

function columnTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  lg.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = lg;
  g.fillRect(0, 0, 64, 256);
  const img = g.getImageData(0, 0, 64, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 64; x++) {
      const u = (x - 31.5) / 32;
      const k = Math.exp(-u * u * 7);
      img.data[(y * 64 + x) * 4 + 3] *= k;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function ringTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

/**
 * A glowing objective beacon: a soft light column plus a pulsing ring on
 * the ground. Bright enough (>2 linear) to bloom a little.
 */
export function createBeacon({ color = 0x6ff0ff, height = 7, radius = 0.9 } = {}) {
  const group = new THREE.Group();
  group.name = 'beacon';
  const colT = columnTexture();
  const ringT = ringTexture();
  const c = new THREE.Color(color);
  const colMat = new THREE.MeshBasicMaterial({
    map: colT, color: c.clone().multiplyScalar(1.6), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const colGeo = new THREE.PlaneGeometry(0.55, height);
  colGeo.translate(0, height / 2, 0);
  const cols = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(colGeo, colMat);
    m.rotation.y = i * Math.PI / 2;
    m.renderOrder = 7;
    group.add(m);
    cols.push(m);
  }
  const ringMat = new THREE.MeshBasicMaterial({
    map: ringT, color: c.clone().multiplyScalar(2.6), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ringGeo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.03;
  ring.renderOrder = 7;
  group.add(ring);
  let t = 0;
  let vis = 0;
  let want = 1;
  function update(dt) {
    t += dt;
    vis += (want - vis) * Math.min(1, dt * 4);
    group.visible = vis > 0.01;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3);
    colMat.opacity = vis * (0.55 + 0.15 * Math.sin(t * 2));
    ringMat.opacity = vis * pulse;
    const s = 1 + 0.12 * Math.sin(t * 3);
    ring.scale.set(s, 1, s);
  }
  return {
    group,
    update,
    setShown(b) { want = b ? 1 : 0; },
    dispose() { colGeo.dispose(); colMat.dispose(); ringGeo.dispose(); ringMat.dispose(); colT.dispose(); ringT.dispose(); },
  };
}

/**
 * Easy mode: a line of glowing chevrons on the ground from her to the next
 * objective, drifting toward it.
 */
export function createGuideTrail({ terrain, color = 0x7ff6ff, count = 26 }) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  g.beginPath();
  g.moveTo(14, 44); g.lineTo(32, 22); g.lineTo(50, 44);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.PlaneGeometry(0.42, 0.42);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI);          // chevron tip toward +Z
  const mat = new THREE.MeshBasicMaterial({
    map: tex, color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  mesh.name = 'guideTrail';
  mesh.count = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let t = 0;
  const colors = new Float32Array(count * 3);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

  function update(dt, from, to, shown) {
    t += dt;
    if (!shown || !to) { mesh.count = 0; return; }
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.8) { mesh.count = 0; return; }
    const ux = dx / dist, uz = dz / dist;
    const h = Math.atan2(ux, uz);
    q.setFromAxisAngle(up, h);
    const spacing = 0.9;
    const n = Math.min(count, Math.floor((dist - 1.4) / spacing));
    const drift = (t * 1.1) % spacing;
    for (let i = 0; i < n; i++) {
      const d = 1.0 + i * spacing + drift;
      const x = from.x + ux * d;
      const z = from.z + uz * d;
      p.set(x, terrain.heightAt(x, z) + 0.035, z);
      const fade = Math.min(1, (d - 1.0) / 1.2) * Math.min(1, (dist - d) / 1.5) * (1 - i / (count + 4));
      s.setScalar(0.8 + 0.2 * fade);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = Math.max(0, fade);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
  return { mesh, update, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); mesh.dispose(); } };
}
