// Chapter 3's Launch Tuner: test flights before the real launch.
//
// The flight sim (rocket.js) has always taken the number of fuel tanks and the
// nose shape, and a bad build really fails - but the child never got to choose,
// so the lesson in it ("more fuel is more weight", "a pointed nose cuts drag")
// stayed hidden. Here she picks 1-8 tanks and a nose, flies a TEST flight on the
// same sim, sees its climb drawn next to her earlier tries, and gets the sim's
// own verdict. "Launch for real" arms once the build on the dials has reached
// space (100 km) in a test, so the real launch - and the chapter's ending -
// always works.
//
// Measured apogees (km), pointed / rounded / flat nose:
//   tanks 1-8: 16 51 98 126 130 116 93 76 / 13 39 80 110 117 105 84 68 / 10 25 52 79 91 84 67 54
// A flat nose never reaches space: that is the drag lesson.
//
//   const build = await openLaunchTuner({ mode: 'easy' | 'medium' | 'hard' });
//   // -> { fuelTanks, noseCone } or null (closed with "Not yet")
//
// Test hook while open: window.__tuner = { set(tanks, nose), test(), launch(), close(), state() }.
import { createFlightSim, flightConfigFromBuild, verdictFor, FLIGHT_ADVICE, MAX_FUEL_TANKS, NOSE_CONES, SIM_DT } from './rocket.js';
import { ORBIT_ALTITUDE_M } from './contracts.js';
import { el, openLayer } from '../play/ui.js';
import { t } from '../space/level.js';

const NOSE_ORDER = ['pointed', 'rounded', 'blunt'];
const NOSE_TEXT = {
  pointed: ['Pointed nose', 'Pointy'],
  rounded: ['Rounded nose', 'Round'],
  blunt: ['Flat top', 'Flat'],
};
const COLORS = ['#ff7a3d', '#56d4ff', '#7ee787', '#ffd166', '#c78bff', '#ff8fb1'];

/**
 * Fly a build to its high point, sampling the climb about once a second.
 * Pure (no DOM): the node tests use it.
 * @returns {{ build, points: {t: number, km: number}[], apogeeM: number, verdict: string, reachedSpace: boolean, twr: number }}
 */
export function testFlight(build) {
  const cfg = flightConfigFromBuild(build);
  const sim = createFlightSim(cfg);
  sim.ignite(cfg);
  const points = [{ t: 0, km: 0 }];
  let next = 1;
  for (let i = 0; i < 1800 / SIM_DT; i++) {
    const s = sim.step(SIM_DT);
    if (s.t >= next) { points.push({ t: s.t, km: s.altitudeM / 1000 }); next += 1; }
    if (s.apogee) { points.push({ t: s.t, km: s.altitudeM / 1000 }); break; }
    if (!s.burning && s.altitudeM <= 0 && s.t > 1) break;
  }
  const st = sim.stats();
  const verdict = verdictFor(st.apogeeM, st.thrustToWeight, st.liftoffT);
  return { build: { ...build }, points, apogeeM: st.apogeeM, verdict, reachedSpace: st.apogeeM >= ORBIT_ALTITUDE_M, twr: st.thrustToWeight };
}

const STYLE_ID = 'launch-tuner-styles';
const CSS = `
.lt-card { width: min(980px, 100%); }
.lt-body { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr); gap: 16px; margin-top: 10px; }
.lt-group { margin-bottom: 14px; }
.lt-label { font-size: 12px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: var(--pl-muted); margin-bottom: 6px; }
.lt-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.lt-step { width: 44px; height: 44px; border-radius: 12px; border: 2px solid rgba(255,255,255,.2); background: #1a2540; color: inherit; font: inherit; font-size: 22px; font-weight: 900; cursor: pointer; }
.lt-tanks { display: flex; gap: 4px; }
.lt-tank { width: 18px; height: 36px; border-radius: 5px; background: rgba(255,255,255,.12); }
.lt-tank.is-on { background: linear-gradient(180deg, #ffd166, #ff7a3d); }
.lt-count { font-size: 18px; font-weight: 900; min-width: 80px; }
.lt-nose { min-height: 44px; padding: 0 12px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
.lt-nose.is-on { border-color: var(--pl-cool); background: rgba(86,212,255,.16); }
.lt-mass { font-size: 14px; color: #d3def0; line-height: 1.5; }
.lt-canvas { display: block; width: 100%; height: 300px; border-radius: 14px; background: #0b1222; border: 1px solid rgba(255,255,255,.16); }
.lt-result { min-height: 3em; margin-top: 10px; padding: 10px 12px; border-radius: 12px; font-size: 15px; line-height: 1.45; background: rgba(255,255,255,.06); }
.lt-result.is-good { background: rgba(126,231,135,.14); border: 1px solid rgba(126,231,135,.5); }
.lt-result.is-warn { background: rgba(255,209,102,.12); border: 1px solid rgba(255,209,102,.45); }
.lt-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
.lt-btn { min-height: 44px; padding: 0 18px; border-radius: 12px; border: 0; background: var(--pl-cool); color: var(--pl-ink); font: inherit; font-weight: 900; cursor: pointer; }
.lt-btn--go { background: linear-gradient(90deg, #ffb347, #ff7847); }
.lt-btn--ghost { background: transparent; color: var(--pl-text); border: 1px solid rgba(255,255,255,.25); }
.lt-btn:disabled { opacity: .4; cursor: default; }
.lt-goal { font-size: 14px; color: var(--pl-gold); font-weight: 800; }
@media (max-width: 860px) { .lt-body { grid-template-columns: 1fr; } .lt-canvas { height: 220px; } }
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * Open the tuner. Resolves with the build to launch, or null.
 * @param {{ mode?: 'easy'|'medium'|'hard' }} [opts]
 */
export function openLaunchTuner({ mode = 'medium' } = {}) {
  injectStyles();
  // Easy starts on a build that works; Medium and Hard start on one that
  // falls short, so the first test teaches something.
  let tanks = mode === 'easy' ? 5 : 2;
  let nose = mode === 'easy' ? 'pointed' : 'blunt';
  const flights = [];
  let flying = null;          // { flight, start }
  let raf = 0;
  let resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });

  const card = el('div', 'pl-card lt-card');
  card.append(
    el('div', 'pl-eyebrow', t('Launch control', 'Launch control')),
    el('h2', 'pl-title', t('Tune your rocket, then test it', 'Build it, then test it')),
    el('p', 'pl-sub', t(
      'Pick how many fuel tanks and which nose. Each test flight uses the real rocket maths. Reach space (100 km) in a test, then launch for real.',
      'Pick fuel tanks and a nose. Test it. Reach space (100 km), then launch!',
    )),
  );
  const body = el('div', 'lt-body');
  const left = el('div');
  const right = el('div');
  body.append(left, right);
  card.appendChild(body);

  // tanks
  const gT = el('div', 'lt-group');
  gT.appendChild(el('div', 'lt-label', t('Fuel tanks', 'Fuel tanks')));
  const rowT = el('div', 'lt-row');
  const minus = el('button', 'lt-step', '−');
  const plus = el('button', 'lt-step', '+');
  minus.setAttribute('aria-label', 'One tank fewer');
  plus.setAttribute('aria-label', 'One tank more');
  const tankViz = el('div', 'lt-tanks');
  for (let i = 0; i < MAX_FUEL_TANKS; i++) tankViz.appendChild(el('span', 'lt-tank'));
  const count = el('span', 'lt-count');
  rowT.append(minus, tankViz, plus, count);
  gT.appendChild(rowT);
  // nose
  const gN = el('div', 'lt-group');
  gN.appendChild(el('div', 'lt-label', t('Nose', 'Nose')));
  const rowN = el('div', 'lt-row');
  const noseBtns = {};
  for (const n of NOSE_ORDER) {
    const b = el('button', 'lt-nose', t(...NOSE_TEXT[n]));
    b.type = 'button';
    b.addEventListener('click', () => { nose = n; refresh(); });
    noseBtns[n] = b;
    rowN.appendChild(b);
  }
  gN.appendChild(rowN);
  const mass = el('div', 'lt-mass');
  const goal = el('div', 'lt-goal');
  left.append(gT, gN, mass, goal);

  const canvas = el('canvas', 'lt-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Height of each test flight over time');
  const result = el('div', 'lt-result', t('Press "Test flight" to see how high this rocket goes.', 'Press "Test flight".'));
  result.setAttribute('role', 'status');
  right.append(canvas, result);

  const actions = el('div', 'lt-actions');
  const notYet = el('button', 'lt-btn lt-btn--ghost', t('Not yet', 'Not yet'));
  const testBtn = el('button', 'lt-btn', t('Test flight', 'Test flight'));
  const goBtn = el('button', 'lt-btn lt-btn--go', t('Launch for real!', 'Launch!'));
  for (const b of [minus, plus, notYet, testBtn, goBtn]) b.type = 'button';
  actions.append(notYet, testBtn, goBtn);
  card.appendChild(actions);

  minus.addEventListener('click', () => { tanks = Math.max(1, tanks - 1); refresh(); });
  plus.addEventListener('click', () => { tanks = Math.min(MAX_FUEL_TANKS, tanks + 1); refresh(); });
  testBtn.addEventListener('click', () => runTest());
  goBtn.addEventListener('click', () => done({ fuelTanks: tanks, noseCone: nose }));
  notYet.addEventListener('click', () => done(null));

  const layer = openLayer(card, {
    onKey(e) {
      if (e.key === 'Escape') done(null);
      else if (e.key === 'ArrowLeft' || e.key === '-') minus.click();
      else if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') plus.click();
      else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') testBtn.click();
    },
  });

  const cfgNow = () => flightConfigFromBuild({ fuelTanks: tanks, noseCone: nose });
  const passed = () => flights.some((f) => f.reachedSpace && f.build.fuelTanks === tanks && f.build.noseCone === nose);

  function refresh() {
    [...tankViz.children].forEach((c, i) => c.classList.toggle('is-on', i < tanks));
    count.textContent = `${tanks} ${tanks === 1 ? 'tank' : 'tanks'}`;
    minus.disabled = tanks <= 1 || !!flying;
    plus.disabled = tanks >= MAX_FUEL_TANKS || !!flying;
    for (const n of NOSE_ORDER) { noseBtns[n].classList.toggle('is-on', n === nose); noseBtns[n].disabled = !!flying; }
    const c = cfgNow();
    const total = c.dryMassKg + c.fuelMassKg;
    const weightKn = (total * 9.81) / 1000;
    mass.textContent = t(
      `Lift-off mass: ${total.toLocaleString()} kg (weight ${weightKn.toFixed(0)} kN). Engine push: ${(c.thrustN / 1000).toFixed(0)} kN. ${NOSE_CONES[nose].label}: drag ${c.dragCoefficient}.`,
      `Weight: ${total.toLocaleString()} kg. Engine push: ${(c.thrustN / 1000).toFixed(0)} kN.`,
    );
    goal.textContent = mode === 'hard'
      ? t('★ Star challenge: beat 125 km in 3 test flights or fewer.', '★ Star: go higher than 125 km in 3 tries.')
      : '';
    testBtn.disabled = !!flying;
    goBtn.disabled = !!flying || !passed();
    draw();
  }

  function runTest() {
    if (flying) return;
    const f = testFlight({ fuelTanks: tanks, noseCone: nose });
    f.color = COLORS[flights.length % COLORS.length];
    flights.push(f);
    if (flights.length > COLORS.length) flights.shift();
    flying = { flight: f, start: performance.now() };
    result.className = 'lt-result';
    result.textContent = t('3, 2, 1... lift-off!', '3, 2, 1... go!');
    refresh();
    const anim = () => {
      if (!flying) return;
      draw();
      if (performance.now() - flying.start >= 2600) { flying = null; showResult(f); refresh(); return; }
      raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    // A hidden tab draws no frames: finish anyway.
    setTimeout(() => { if (flying?.flight === f) { flying = null; showResult(f); refresh(); } }, 2800);
  }

  function showResult(f) {
    const km = (f.apogeeM / 1000).toFixed(0);
    const good = f.reachedSpace;
    result.className = `lt-result ${good ? 'is-good' : 'is-warn'}`;
    const adviceL1 = {
      'too-heavy': 'Too heavy! Take a tank off.',
      sluggish: 'Very heavy. Try fewer tanks.',
      short: f.build.noseCone === 'blunt' ? 'The flat top slows it down. Try a pointy nose.' : 'Not enough fuel. Add a tank.',
      orbit: 'You reached space!',
    }[f.verdict];
    // A flat top never reaches space, whatever the tanks: say that, not "add a tank".
    const advice = f.verdict === 'short' && f.build.noseCone === 'blunt'
      ? 'The flat top hits the air like a wall, and the drag holds it back. Try a pointed nose.'
      : (FLIGHT_ADVICE[f.verdict] || '');
    result.textContent = `${t(`Test flight: ${km} km.`, `${km} km high.`)} ${t(advice, adviceL1)}`;
    if (good) result.textContent += ` ${t('Press "Launch for real!" when you are ready.', 'Press "Launch!"')}`;
    if (mode === 'hard' && flights.length <= 3 && f.apogeeM > 125_000) result.textContent += ' ★ Star challenge done!';
  }

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 560; const H = canvas.clientHeight || 300;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 46, r: 14, t: 14, b: 30 };
    const maxKm = 140;
    const maxT = Math.max(200, ...flights.map((f) => f.points[f.points.length - 1].t)) * 1.04;
    const x = (s) => pad.l + (s / maxT) * (W - pad.l - pad.r);
    const y = (km) => H - pad.b - (km / maxKm) * (H - pad.t - pad.b);
    ctx.font = "700 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = '#a9b8d2';
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= maxKm; k += 20) {
      ctx.beginPath(); ctx.moveTo(pad.l, y(k)); ctx.lineTo(W - pad.r, y(k)); ctx.stroke();
      ctx.fillText(`${k} km`, 4, y(k) + 4);
    }
    ctx.fillText('time →', W - 60, H - 10);
    // the edge of space
    ctx.save();
    ctx.strokeStyle = '#ffd166'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.l, y(100)); ctx.lineTo(W - pad.r, y(100)); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(t('Space starts here (100 km)', 'Space'), pad.l + 6, y(100) - 6);
    // each flight's climb
    for (const f of flights) {
      const anim = flying && flying.flight === f;
      const frac = anim ? Math.min(1, (performance.now() - flying.start) / 2400) : 1;
      const lastT = f.points[f.points.length - 1].t * frac;
      ctx.strokeStyle = f.color; ctx.lineWidth = anim ? 3.5 : 2.5;
      ctx.beginPath();
      let px = 0; let py = 0;
      for (const p of f.points) {
        if (p.t > lastT) break;
        px = x(Math.min(p.t, maxT)); py = y(Math.min(p.km, maxKm));
        if (p.t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (frac >= 1) {
        ctx.fillStyle = f.color;
        const txt = `${f.build.fuelTanks}T ${f.build.noseCone === 'blunt' ? 'flat' : f.build.noseCone}: ${(f.apogeeM / 1000).toFixed(0)} km`;
        ctx.fillText(txt, Math.min(px + 6, W - ctx.measureText(txt).width - 6), Math.max(py - 6, 26));
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function done(build) {
    if (!layer) return;
    cancelAnimationFrame(raf);
    flying = null;
    layer.close();
    if (window.__tuner === api) delete window.__tuner;
    resolveFn(build);
  }

  const api = {
    set(n, k) { if (n) tanks = Math.max(1, Math.min(MAX_FUEL_TANKS, n)); if (k && NOSE_CONES[k]) nose = k; refresh(); return this.state(); },
    test() { flying = null; runTest(); const f = flying?.flight; flying = null; if (f) showResult(f); refresh(); return this.state(); },
    launch() { if (!goBtn.disabled) goBtn.click(); return goBtn.disabled ? 'not armed' : 'launched'; },
    close() { done(null); },
    state() { return { tanks, nose, armed: passed(), flights: flights.map((f) => ({ ...f.build, km: +(f.apogeeM / 1000).toFixed(1), verdict: f.verdict })), result: result.textContent }; },
  };
  window.__tuner = api;
  refresh();
  setTimeout(() => { try { testBtn.focus(); } catch { /* closed */ } }, 0);
  return promise;
}
