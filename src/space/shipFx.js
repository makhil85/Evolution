// Chapter 4 - the hero ship's effects: engine plume, reverse thrusters, RCS
// puffs, nav lights, the claw's tractor glow and grab sparkles.
//
// Everything lives in the SHIP's local space (a child of the ship's body
// group), so it scales with SHIP.flightScale for free. All HDR colours are
// above 1 on purpose: they are what the bloom pass picks up.
//
// Budget: plume outer + core, throat glow, exit glow sprite, reverse plumes,
// one Points object for every puff and sparkle, three nav-light sprites, and
// the claw's ring + beam. Hidden pieces cost nothing (visible = false).
// No allocations per frame.
import * as THREE from 'three';

const PLUME_VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying float vT;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vObj;
  void main() {
    vT = uv.y;
    vObj = position;
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    vN = normalize( normalMatrix * normal );
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const PLUME_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  uniform float uIntensity;
  uniform float uEdge;
  uniform float uDiamonds;
  uniform float uFadeIn;
  uniform float uFloor;
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying float vT;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vObj;
  float h21( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float vnoise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  void main() {
    #include <logdepthbuf_fragment>
    float facing = abs( dot( normalize( vN ), normalize( vV ) ) );
    // The floor keeps the cone lit when it is seen end-on (the chase camera sits behind the nozzle).
    float edge = mix( uFloor, 1.0, pow( facing, uEdge ) );
    float t = vT;
    float along = smoothstep( 0.0, uFadeIn, t ) * pow( 1.0 - t, 1.35 );
    vec2 q = vec2( t * 6.0 - uTime * 9.0, vObj.x * 3.1 + vObj.y * 2.3 );
    float n = vnoise( q ) * 0.55 + vnoise( q * 2.3 + vec2( -uTime * 7.0, 1.7 ) ) * 0.45;
    float diamonds = 1.0 + uDiamonds * sin( t * 28.0 - uTime * 2.5 ) * ( 1.0 - t );
    float a = edge * along * mix( 0.5, 1.35, n ) * diamonds * uIntensity;
    vec3 col = mix( uCool, uHot, pow( clamp( 1.0 - t * 1.15, 0.0, 1.0 ), 2.0 ) );
    gl_FragColor = vec4( col, a );
  }`;

function plumeMaterial({ hot, cool, edge = 1.4, floor = 0.0, diamonds = 0.0, fadeIn = 0.05 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uEdge: { value: edge },
      uDiamonds: { value: diamonds },
      uFadeIn: { value: fadeIn },
      uFloor: { value: floor },
      uHot: { value: new THREE.Vector3(...hot) },
      uCool: { value: new THREE.Vector3(...cool) },
    },
    vertexShader: PLUME_VERT,
    fragmentShader: PLUME_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** A lathe along +Z of unit length; uv.y runs 0 (nozzle) -> 1 (tail). */
function plumeGeometry(radiusAt, rings = 28, segs = 28) {
  const pts = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    pts.push(new THREE.Vector2(Math.max(0.004, radiusAt(t)), t));
  }
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PUFF_VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aAge;
  attribute float aSize;
  attribute float aKind;
  uniform float uPx;
  varying float vAge;
  varying float vKind;
  void main() {
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mv;
    float sc = length( modelMatrix[ 0 ].xyz );
    float grow = aKind < 0.5 ? ( 0.4 + 1.7 * sqrt( aAge ) ) : ( 1.0 - aAge * 0.6 );
    float px = aSize * sc * grow * uPx / max( -mv.z, 1e-3 );
    gl_PointSize = aAge >= 1.0 ? 0.0 : max( px, 1.5 );
    vAge = aAge;
    vKind = aKind;
    #include <logdepthbuf_vertex>
  }`;

const PUFF_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying float vAge;
  varying float vKind;
  void main() {
    #include <logdepthbuf_fragment>
    if ( vAge >= 1.0 ) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot( p, p );
    if ( r2 > 1.0 ) discard;
    if ( vKind < 0.5 ) {
      float a = 1.0 - r2;
      a *= a;
      a *= 0.8 * pow( 1.0 - vAge, 1.5 );
      // toon-ish: a brighter core disc so a puff reads as a puff, not fog
      float core = smoothstep( 0.42, 0.36, r2 ) * 0.25 * ( 1.0 - vAge );
      gl_FragColor = vec4( vec3( 0.95, 0.97, 1.0 ) * 1.2, clamp( a + core, 0.0, 0.95 ) );
    } else {
      float star = max( 0.0, 1.0 - 14.0 * abs( p.x * p.y ) ) * ( 1.0 - sqrt( r2 ) );
      float core = exp( -r2 * 9.0 );
      float a = clamp( star + core, 0.0, 1.0 ) * ( 1.0 - vAge );
      gl_FragColor = vec4( vec3( 1.8, 2.0, 2.6 ), a );
    }
  }`;

/**
 * @param {object} o
 * @param {{pos:THREE.Vector3, radius:number}} o.mainNozzle  where the plume starts (inside the bell)
 * @param {THREE.Vector3[]} o.reverseNozzles  forward-facing nozzle exits (same z)
 * @param {Record<string,{pos:THREE.Vector3, dir:THREE.Vector3}>} o.rcs  noseL/noseR/tailL/tailR, aftL/aftR, foreL/foreR
 * @param {THREE.Vector3} o.strobe  white strobe position
 */
export function createShipFx({ mainNozzle, reverseNozzles, rcs, strobe }) {
  const group = new THREE.Group();
  group.name = 'shipFx';
  const glowTex = glowTexture();
  const disposables = [glowTex];
  const own = (x) => { disposables.push(x); return x; };

  // ---- main plume: a wide soft outer flame and a hot narrow core ----
  const R0 = mainNozzle.radius;
  // A tight, long cone: it leaves the throat at ~0.75 of the throat radius,
  // swells a touch just past the lip, then tapers to a point.
  const outerGeo = own(plumeGeometry((t) => R0 * 0.78 * (1 + 0.18 * Math.sin(Math.min(1, t * 5) * Math.PI * 0.5)) * Math.pow(1 - t, 0.9) + 0.01, 32, 28));
  const coreGeo = own(plumeGeometry((t) => R0 * 0.36 * Math.pow(1 - t, 1.1) + 0.005, 32, 20));
  const outerMat = own(plumeMaterial({ hot: [0.7, 1.4, 3.2], cool: [0.12, 0.3, 1.7], edge: 1.6, floor: 0.5, fadeIn: 0.03 }));
  const coreMat = own(plumeMaterial({ hot: [3.4, 3.6, 4.0], cool: [0.5, 1.2, 3.2], edge: 2.4, floor: 0.4, diamonds: 0.25, fadeIn: 0.04 }));
  const outer = new THREE.Mesh(outerGeo, outerMat);
  const core = new THREE.Mesh(coreGeo, coreMat);
  for (const m of [outer, core]) {
    m.position.copy(mainNozzle.pos);
    m.frustumCulled = false;
    m.renderOrder = 3;
    group.add(m);
  }
  outer.name = 'plumeOuter';
  core.name = 'plumeCore';

  // Flare: a short skirt of flame that fans out round the bell rim, so the burn
  // reads from straight behind (the chase camera looks down the plume).
  const flareGeo = own(plumeGeometry((t) => R0 * (1.05 + 1.1 * t) + 0.01, 16, 28));
  const flareMat = own(plumeMaterial({ hot: [0.9, 1.6, 3.0], cool: [0.25, 0.6, 1.8], edge: 1.2, floor: 0.6, fadeIn: 0.02 }));
  const flare = new THREE.Mesh(flareGeo, flareMat);
  flare.position.copy(mainNozzle.pos);
  flare.frustumCulled = false;
  flare.renderOrder = 3;
  flare.name = 'plumeFlare';
  group.add(flare);

  // Throat glow: a hot disc deep in the bell, always faintly warm.
  const throatMat = own(new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const throat = new THREE.Mesh(own(new THREE.CircleGeometry(R0 * 0.62, 24)), throatMat);
  throat.position.copy(mainNozzle.pos).setZ(mainNozzle.pos.z - 0.38);
  throat.renderOrder = 3;
  group.add(throat);

  // Exit glow sprite (the bloom "ball" at the nozzle).
  const exitMat = own(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const exitGlow = new THREE.Sprite(exitMat);
  exitGlow.position.copy(mainNozzle.pos).setZ(mainNozzle.pos.z + 0.45);
  exitGlow.renderOrder = 3;
  group.add(exitGlow);

  // ---- reverse thrusters: two small plumes out of the nose, one mesh ----
  const revZ = reverseNozzles[0].z;
  const revParts = reverseNozzles.map((p) => {
    const g = plumeGeometry((t) => 0.085 * (1 + 0.6 * t) * Math.pow(1 - t, 0.5) + 0.01, 14, 14);
    g.rotateY(Math.PI);                     // point -Z
    g.translate(p.x, p.y, 0);
    return g;
  });
  const revGeo = own(mergeTwo(revParts));
  const revMat = own(plumeMaterial({ hot: [2.0, 2.5, 3.0], cool: [0.3, 0.7, 1.8], edge: 1.3, fadeIn: 0.04 }));
  const reverse = new THREE.Mesh(revGeo, revMat);
  reverse.position.set(0, 0, revZ);
  reverse.frustumCulled = false;
  reverse.renderOrder = 3;
  group.add(reverse);

  // ---- claw: a glowing ring and a faint tractor beam ----
  const ringMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const clawRing = new THREE.Mesh(own(new THREE.TorusGeometry(0.19, 0.022, 8, 28)), ringMat);
  clawRing.renderOrder = 3;
  group.add(clawRing);
  const beamGeo = own(plumeGeometry((t) => 0.16 + 0.34 * t, 12, 24));
  beamGeo.rotateY(Math.PI);
  beamGeo.translate(0, 0, -0.12);
  const beamMat = own(plumeMaterial({ hot: [0.3, 1.4, 1.6], cool: [0.1, 0.6, 0.9], edge: 0.8, fadeIn: 0.1 }));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.scale.set(1, 1, 1.3);
  beam.frustumCulled = false;
  beam.renderOrder = 3;
  group.add(beam);

  // ---- nav lights ----
  const navMat = (r, g, b) => own(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(r, g, b), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const navPort = new THREE.Sprite(navMat(4.0, 0.3, 0.2));
  const navStbd = new THREE.Sprite(navMat(0.3, 3.6, 0.6));
  const navStrobe = new THREE.Sprite(navMat(6, 6, 6.5));
  navStrobe.position.copy(strobe);
  for (const s of [navPort, navStbd]) { s.scale.setScalar(0.36); s.renderOrder = 3; group.add(s); }
  navStrobe.scale.setScalar(0.62);
  navStrobe.renderOrder = 3;
  group.add(navStrobe);
  const portBase = navPort.material.color.clone();
  const stbdBase = navStbd.material.color.clone();
  let navOn = true; // off while parked on the Moon / Europa (setNavLights)

  // ---- puffs + sparkles: one Points pool ----
  const N = 200;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const age = new Float32Array(N).fill(1);
  const life = new Float32Array(N).fill(1);
  const size = new Float32Array(N);
  const kind = new Float32Array(N);
  const pgeo = own(new THREE.BufferGeometry());
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ageAttr = new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const kindAttr = new THREE.BufferAttribute(kind, 1).setUsage(THREE.DynamicDrawUsage);
  pgeo.setAttribute('position', posAttr);
  pgeo.setAttribute('aAge', ageAttr);
  pgeo.setAttribute('aSize', sizeAttr);
  pgeo.setAttribute('aKind', kindAttr);
  const puffUniforms = { uPx: { value: 500 } };
  const puffMat = own(new THREE.ShaderMaterial({
    uniforms: puffUniforms, vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG,
    transparent: true, depthWrite: false,
  }));
  const puffs = new THREE.Points(pgeo, puffMat);
  puffs.frustumCulled = false;
  puffs.renderOrder = 4;
  puffs.name = 'rcsPuffs';
  const _vs = new THREE.Vector2();
  puffs.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.getDrawingBufferSize(_vs).y;
    puffUniforms.uPx.value = camera.projectionMatrix.elements[5] * 0.5 * h;
  };
  group.add(puffs);
  let next = 0;
  let alive = 0;

  function spawn(p, d, speed, spread, sz, lf, k) {
    const i = next;
    next = (next + 1) % N;
    pos[i * 3] = p.x + (Math.random() - 0.5) * 0.06;
    pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.06;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.06;
    vel[i * 3] = d.x * speed + (Math.random() - 0.5) * spread;
    vel[i * 3 + 1] = d.y * speed + (Math.random() - 0.5) * spread;
    vel[i * 3 + 2] = d.z * speed + (Math.random() - 0.5) * spread;
    age[i] = 0;
    life[i] = lf * (0.8 + Math.random() * 0.4);
    size[i] = sz * (0.8 + Math.random() * 0.4);
    kind[i] = k;
    alive = N;
  }

  const emitters = {};
  for (const [k, v] of Object.entries(rcs)) emitters[k] = { ...v, acc: 0, was: false };

  function emit(e, rate, dt, on) {
    if (!on) { e.acc = 0; e.was = false; return; }
    if (!e.was) {
      // The first instant of a burn gives a sharp little burst.
      for (let i = 0; i < 7; i++) spawn(e.pos, e.dir, 3.4, 1.0, 0.5, 0.55, 0);
      e.was = true;
    }
    e.acc += rate * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      spawn(e.pos, e.dir, 2.8 + Math.random(), 0.8, 0.46, 0.6, 0);
    }
  }

  let time = 0;
  let thr = 0;         // smoothed throttle
  const _q = new THREE.Quaternion();
  const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);

  function update(dt, s) {
    time += dt;
    const k = 1 - Math.exp(-dt * 9);
    thr += (s.throttle - thr) * k;
    const fwd = Math.max(0, thr);
    const back = Math.max(0, -thr);
    const gentle = s.precision ? 0.32 : 1;

    // Main plume.
    const flick = 1 + 0.06 * Math.sin(time * 37) + 0.04 * Math.sin(time * 61 + 1.3) + 0.03 * Math.sin(time * 113);
    const L = fwd * gentle * 7.5 * flick;
    outer.visible = core.visible = L > 0.04;
    const wscale = 0.85 + 0.15 * fwd * gentle;
    outer.scale.set(wscale, wscale, Math.max(L, 0.01));
    core.scale.set(wscale, wscale, Math.max(L * 0.45, 0.01));
    outerMat.uniforms.uTime.value = time;
    coreMat.uniforms.uTime.value = time;
    outerMat.uniforms.uIntensity.value = 0.75 * Math.min(1, fwd * gentle * 3);
    coreMat.uniforms.uIntensity.value = 0.55 * Math.min(1, fwd * gentle * 3);

    // Flare: a short skirt round the rim, flickering with the plume.
    const FL = fwd * gentle * 0.9 * flick;
    flare.visible = FL > 0.04;
    flare.scale.set(1, 1, Math.max(FL, 0.01));
    flareMat.uniforms.uTime.value = time;
    flareMat.uniforms.uIntensity.value = 0.6 * Math.min(1, fwd * gentle * 3);

    // Throttle 0: nothing glows at all.
    const heat = fwd * gentle;
    throat.visible = heat > 0.02;
    throatMat.color.setRGB(0.45, 0.8, 1.5).multiplyScalar(Math.min(1, heat * 1.5) * 0.7 * flick);
    exitGlow.visible = fwd > 0.02;
    exitMat.color.setRGB(0.3, 0.7, 1.7).multiplyScalar(0.35 * heat * flick);
    exitGlow.scale.setScalar(0.55 + 0.45 * heat);

    // Reverse.
    const RL = back * (s.precision ? 0.5 : 1) * 1.9 * flick;
    reverse.visible = RL > 0.04;
    reverse.scale.set(1, 1, Math.max(RL, 0.01));
    revMat.uniforms.uTime.value = time;
    revMat.uniforms.uIntensity.value = Math.min(1, back * 3) * 1.4;

    // RCS: turning. +turn swings the nose to starboard: nose jets fire to
    // port, tail jets to starboard.
    const tr = s.turn;
    const on = Math.abs(tr) > 0.05;
    const rate = 36 * Math.abs(tr);
    emit(emitters.noseL, rate, dt, on && tr > 0);
    emit(emitters.tailR, rate, dt, on && tr > 0);
    emit(emitters.noseR, rate, dt, on && tr < 0);
    emit(emitters.tailL, rate, dt, on && tr < 0);
    // Precision translation: aft jets push forward, fore jets push back.
    const pf = s.precision && s.throttle > 0.05;
    const pb = s.precision && s.throttle < -0.05;
    const prate = 26 * Math.abs(s.throttle);
    emit(emitters.aftL, prate, dt, pf);
    emit(emitters.aftR, prate, dt, pf);
    emit(emitters.foreL, prate, dt, pb);
    emit(emitters.foreR, prate, dt, pb);

    // Particles.
    if (alive) {
      let any = 0;
      const damp = Math.exp(-dt * 2.8);
      for (let i = 0; i < N; i++) {
        if (age[i] >= 1) continue;
        any++;
        age[i] = Math.min(1, age[i] + dt / life[i]);
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3] *= damp; vel[i * 3 + 1] *= damp; vel[i * 3 + 2] *= damp;
      }
      posAttr.needsUpdate = ageAttr.needsUpdate = sizeAttr.needsUpdate = kindAttr.needsUpdate = true;
      if (!any) alive = 0;
    }
    puffs.visible = alive > 0;

    // Nav lights: port red / starboard green blink together; the white
    // strobe double-flashes.
    navPort.position.copy(s.navPort);
    navStbd.position.copy(s.navStarboard);
    const blink = (time % 1.4) < 0.9 ? 1 : 0.12;
    navPort.material.color.copy(portBase).multiplyScalar(blink);
    navStbd.material.color.copy(stbdBase).multiplyScalar(blink);
    const ph = time % 1.6;
    navStrobe.visible = navOn && (ph < 0.08 || (ph > 0.2 && ph < 0.28));
    navPort.visible = navStbd.visible = navOn;

    // Claw glow.
    clawRing.visible = s.clawGlow > 0.02;
    if (clawRing.visible) {
      clawRing.position.copy(s.clawPos);
      clawRing.quaternion.copy(s.clawQuat);
      clawRing.translateZ(-0.13);
      const pulse = 0.75 + 0.25 * Math.sin(time * 6);
      ringMat.color.setRGB(0.4, 2.2, 2.6).multiplyScalar(s.clawGlow * pulse);
    }
    beam.visible = s.clawBeam > 0.02;
    if (beam.visible) {
      beam.position.copy(s.clawPos);
      _q.copy(s.clawQuat).multiply(FLIP);
      beam.quaternion.copy(_q);
      beamMat.uniforms.uTime.value = time;
      beamMat.uniforms.uIntensity.value = 0.55 * s.clawBeam;
    }
  }

  function sparkle(p) {
    const d = new THREE.Vector3();
    for (let i = 0; i < 16; i++) {
      d.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      spawn(p, d, 1.2 + Math.random() * 1.2, 0.3, 0.2, 0.7, 1);
    }
  }

  return {
    group,
    update,
    sparkle,
    setSunDirection() {},
    /** Parked on the ground the blinking tip lights read as a lit engine (play-test): off. */
    setNavLights(on) { navOn = !!on; },
    /** Seconds until the next strobe flash starts (0 while it is lit). For shots and tests. */
    strobeWait() { const ph = time % 1.6; return navStrobe.visible ? 0 : ph < 0.2 ? 0.2 - ph : 1.6 - ph; },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose?.();
    },
  };
}

function mergeTwo(list) {
  // Tiny local merge (avoids pulling BufferGeometryUtils in for two cones).
  let vCount = 0, iCount = 0;
  for (const g of list) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'uv'];
  for (const n of names) {
    const size = list[0].attributes[n].itemSize;
    const arr = new Float32Array(vCount * size);
    let o = 0;
    for (const g of list) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  const idx = new Uint32Array(iCount);
  let o = 0, base = 0;
  for (const g of list) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i++) idx[o + i] = a[i] + base;
    o += a.length;
    base += g.attributes.position.count;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  for (const g of list) g.dispose();
  return out;
}
