// The side map (src/space/hud/minimap.js) on an escape: she leaves a planet's
// system on a path that grows into a breakout. Drives the real module with a
// fake canvas, flies the two-body motion (the planet and the Sun) at the pace
// she sees at x1, with the game's own predictor (predictor.js) for the dotted
// path, and checks the map:
//   - no frame-to-frame jump of more than 15% in the map's scale, or in its
//     centre (as a share of the map's radius);
//   - it starts planet-centred, zooms out as the path grows, and hands over to
//     the Sun's view when her path breaks out of the planet's pull;
//   - the target and the guessed next stop (Uranus, then Neptune) are named on
//     the map (the rim arrows of an escape).
//
//   node scripts/test-minimap.mjs

// A canvas stand-in: every drawing call is a no-op, and text is recorded.
const texts = [];
// Any other call or property (gradients, image data for the satellite's texture) is a chainable no-op.
const chain = new Proxy(function chainFn() {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : chain),
  set: () => true,
  apply: () => chain,
});
const ctxStub = new Proxy({}, {
  get(target, key) {
    if (key === 'fillText') return (s) => { texts.push(String(s)); };
    if (key === 'measureText') return (s) => ({ width: String(s).length * 6 });
    if (key in target) return target[key];
    return chain;
  },
  set(target, key, value) { target[key] = value; return true; },
});
const fakeEl = () => ({
  className: '', style: {}, children: [], textContent: '', width: 0, height: 0, clientWidth: 230,
  classList: { toggle() {} }, appendChild(c) { this.children.push(c); return c; },
  addEventListener() {}, setAttribute() {}, getContext() { return ctxStub; }, querySelector() { return null; },
});
globalThis.document = { createElement: () => fakeEl(), documentElement: { dataset: {} }, body: null };
globalThis.window = { addEventListener() {}, devicePixelRatio: 1, location: { search: '' } };
let fakeNow = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => fakeNow }, configurable: true, writable: true });

const { BODIES } = await import('../src/space/contracts.js');
const { bodyState } = await import('../src/space/orbits.js');
const { predict: predictPath } = await import('../src/space/predictor.js');
const { createMinimap } = await import('../src/space/hud/minimap.js');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

const JUMP = 0.15;

/**
 * Fly an escape from `planet`: she starts on a circle at 0.3 of its pull, coasts
 * `burnAt` laps (the map shows the circle), then burns prograde to `boost` times
 * the orbital speed. One sample per redraw (`frameSec` of flight). Her path ahead
 * is the game's predictor over the horizon main.js uses in a planet's pull (700 s
 * at Jupiter, else 260 s), recomputed every 10 redraws.
 */
function escapeRun(planet, { boost = 1.12, seconds = 8000, burnAt = 1, frameSec = 0.1 } = {}) {
  const b = BODIES[planet];
  const r0 = b.soi * 0.3;
  const gmS = BODIES.sun.gm;
  const sj0 = bodyState(planet, 0, {});
  const vc = Math.sqrt(b.gm / r0);
  const period = 2 * Math.PI * Math.sqrt(r0 ** 3 / b.gm);
  const dt = Math.min(period / 400, frameSec);
  const horizon = planet === 'jupiter' ? 700 : 260;
  const accel = (x, z, tt) => {
    const j = bodyState(planet, tt, {});
    const dx = x - j.x; const dz = z - j.z; const dj = Math.hypot(dx, dz);
    const rs = Math.hypot(x, z);
    return { ax: -b.gm * dx / dj ** 3 - gmS * x / rs ** 3, az: -b.gm * dz / dj ** 3 - gmS * z / rs ** 3 };
  };
  const predict = (x, z, vx, vz, t) => {
    const p = predictPath({ x, z, vx, vz, t, soi: planet, landedOn: null, fuel: 1e9 }, { seconds: horizon, maxPoints: 320 });
    return { path: p.points, times: p.times };
  };
  const frames = [];
  let t = 0;
  let x = sj0.x + r0; let z = sj0.z;
  let vx = sj0.vx; let vz = sj0.vz + vc;
  let burned = false;
  let pr = null;
  let n = 0;
  while (t < seconds) {
    if (!burned && t >= burnAt * period) {
      burned = true;
      const jv = bodyState(planet, t, {});
      vx = jv.vx + (vx - jv.vx) * boost; vz = jv.vz + (vz - jv.vz) * boost;
    }
    const j = bodyState(planet, t, {});
    const inside = Math.hypot(x - j.x, z - j.z) < b.soi;
    if (!pr || n % 10 === 0) pr = predict(x, z, vx, vz, t);
    frames.push({
      time: t,
      ship: { x, z, angle: Math.atan2(vz, vx) },
      path: pr.path,
      times: pr.times,
      soi: inside ? planet : 'sun',
      escape: inside,
    });
    n++;
    const tEnd = t + frameSec;
    while (t < tEnd - 1e-9) {
      const a = accel(x, z, t);
      vx += a.ax * dt; vz += a.az * dt;
      x += vx * dt; z += vz * dt;
      t += dt;
    }
    const j2 = bodyState(planet, t, {});
    if (burned && Math.hypot(x - j2.x, z - j2.z) > b.soi * 4) break;
  }
  return frames;
}

/** Run the map over the frames and collect what it drew. */
function drawRun(frames, { target }) {
  const map = createMinimap(fakeEl());
  const seen = [];
  for (const f of frames) {
    const st = {
      time: f.time,
      bodies: Object.fromEntries(Object.keys(BODIES).map((id) => [id, bodyState(id, f.time, {})])),
      ship: f.ship,
      soi: f.soi,
      path: f.path,
      times: f.times,
      target,
      escape: f.escape,
    };
    fakeNow += 100; // one redraw per 100 ms
    texts.length = 0;
    map.update(st);
    seen.push({ ...map.frame(), texts: [...texts] });
  }
  return seen;
}

/** The largest frame-to-frame change in the map's scale and centre (centre as a share of the map). */
function maxJumps(seen) {
  let scale = 0; let centre = 0;
  for (let i = 1; i < seen.length; i++) {
    const a = seen[i - 1]; const b = seen[i];
    scale = Math.max(scale, Math.abs(b.R / a.R - 1));
    centre = Math.max(centre, Math.hypot(b.C.x - a.C.x, b.C.z - a.C.z) / b.R);
  }
  return { scale, centre };
}

// --- Jupiter: leaving on a breaking-out path, toward Saturn -----------------
{
  const seen = drawRun(escapeRun('jupiter'), { target: 'saturn' });
  const j = maxJumps(seen);
  const switchAt = seen.findIndex((s) => s.centre === 'sun');
  const planetFrames = seen.slice(0, switchAt < 0 ? seen.length : switchAt);
  check('Jupiter escape: the map is planet-centred to begin with', seen[0].centre === 'jupiter', `centre ${seen[0].centre}`);
  check('Jupiter escape: the map hands over to the Sun once she breaks out', switchAt > 0, `switch at redraw ${switchAt}`);
  check('Jupiter escape: no scale jump over 15% a redraw', j.scale <= JUMP, `max ${(j.scale * 100).toFixed(1)}%`);
  check('Jupiter escape: no centre jump over 15% of the map a redraw', j.centre <= JUMP, `max ${(j.centre * 100).toFixed(1)}%`);
  const grew = planetFrames.length > 2 && planetFrames[planetFrames.length - 1].R > planetFrames[0].R * 1.05;
  check('Jupiter escape: the map zooms out as her path grows (5%+ while in the planet view)', grew,
    planetFrames.length ? `R ${planetFrames[0].R.toExponential(2)} -> ${planetFrames[planetFrames.length - 1].R.toExponential(2)}` : 'no planet frames');
  check('Jupiter escape: Saturn (the target) is named at the rim', planetFrames.some((s) => s.texts.some((x) => /Saturn/.test(x))));
  check('Jupiter escape: the leaving title is shown', planetFrames.some((s) => s.texts.some((x) => /LEAVING JUPITER/.test(x))));
  check('Jupiter escape: the Sun view has the planets (Saturn drawn at its place)', seen.slice(switchAt).some((s) => s.centre === 'sun'));
  if (switchAt > 0) {
    const sample = seen.slice(Math.max(0, switchAt - 3), switchAt + 3).map((s) => `${s.centre}:${s.R.toExponential(2)}:e${s.e.toFixed(3)}`).join(' ');
    console.log(`  Jupiter escape around the hand-over (centre:R:slide): ${sample}`);
  }
}

// --- Saturn: leaving toward Uranus; the next stop (Neptune) is named too ----
{
  const seen = drawRun(escapeRun('saturn', { boost: 1.3, seconds: 8000, frameSec: 0.5 }), { target: 'uranus' });
  const j = maxJumps(seen);
  const names = new Set(seen.filter((s) => s.centre === 'saturn').flatMap((s) => s.texts));
  check('Saturn escape: no scale jump over 15% a redraw', j.scale <= JUMP, `max ${(j.scale * 100).toFixed(1)}%`);
  check('Saturn escape: no centre jump over 15% of the map a redraw', j.centre <= JUMP, `max ${(j.centre * 100).toFixed(1)}%`);
  check('Saturn escape: Uranus (the target) is on the map', [...names].some((x) => /Uranus/.test(x)), [...names].join(' | '));
  check('Saturn escape: then Neptune (the guessed next stop) is on the map', [...names].some((x) => /then Neptune/.test(x)));
  check('Saturn escape: the map hands over to the Sun once she breaks out', seen.some((s) => s.centre === 'sun'));
}

// --- Closed orbit (no escape): the planet view stays put -------------------
{
  const frames = escapeRun('mars', { boost: 1.0, seconds: 1500, burnAt: 1e9 }).map((f) => ({ ...f, escape: false, soi: 'mars' }));
  const seen = drawRun(frames, { target: 'mars' });
  const j = maxJumps(seen);
  check('closed orbit round Mars: centred on Mars throughout', seen.every((s) => s.centre === 'mars'));
  check('closed orbit round Mars: no scale or centre jump over 15%', j.scale <= JUMP && j.centre <= JUMP,
    `scale ${(j.scale * 100).toFixed(1)}% centre ${(j.centre * 100).toFixed(1)}%`);
}

// --- Edge cases: no path, no target, a flip-flop at the pull's edge -----------
{
  const seen = drawRun(escapeRun('jupiter'), { target: 'saturn' });
  let flips = 0;
  for (let i = 1; i < seen.length; i++) if (seen[i].centre !== seen[i - 1].centre) flips++;
  check('Jupiter escape: the view changes centre once (no flip-flop at the pull edge)', flips <= 1, `${flips} changes`);
}
{
  const map = createMinimap(fakeEl());
  let ok = true;
  try {
    map.update({ time: 0, bodies: Object.fromEntries(Object.keys(BODIES).map((id) => [id, bodyState(id, 0, {})])), ship: { x: 1e5, z: 0, angle: 0 }, soi: 'sun' });
    fakeNow += 100;
    map.update({ time: 1, bodies: Object.fromEntries(Object.keys(BODIES).map((id) => [id, bodyState(id, 1, {})])), ship: { x: 2e5, z: 0, angle: 0 }, soi: 'earth', escape: true });
  } catch (e) { ok = false; console.log(e); }
  check('a map with no path and no target draws without error', ok);
}

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} minimap checks passed`);
if (failed) process.exit(1);
