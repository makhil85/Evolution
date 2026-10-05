// The four little films of the orbit-transfer lesson (Flight school, played
// on the lesson card by src/lesson/lessons/flightSchool.js): a top-down 2-D view, real two-body gravity, schematic sizes.
//
//   1  Straight at the Moon?   a push towards the Moon only bends the circle
//   2  Push along your path     the circle stretches into an oval to the Moon
//   3  Wait for the window      too early = no Moon; go round, then BURN NOW
//   4  Catch at the Moon        no brake = fly past; point backwards = caught
//
// Everything is worked out once, up front, as samples of the ship's state
// every 1/120 s (gravity + a finite burn, leapfrog steps), so a film is a pure
// function of its clock: drawFrame(ctx, clip, simTime). That makes it play the
// same at any frame rate, lets tests seek/step by hand (a hidden tab draws no
// rAF frames), and lets the burns be SOLVED rather than hand-tuned: the
// Moon burns are bisected so the oval's far end lands exactly on the Moon's
// path, and the Moon is placed so it gets there at that moment.
//
// Units: Earth at the origin, the ship's circle radius 1, the Moon's path
// radius 3.2 (the real ratio is 60; this fits a screen). One lap of Earth
// takes 2 s of lesson time; the Moon goes round ~5.7x slower (the same law).
import { t } from '../level.js';
import { heroName } from '../hud/domUtil.js';

/** A [Level 4, Level 1] pair: the lesson card (src/lesson/card.js) picks one. */
const two = (a, b = a) => [a, b];

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// --- the physics ---------------------------------------------------------------

const P0 = 2.0;                       // the ship's lap of Earth, lesson seconds
const GM_E = (TAU / P0) ** 2;         // so that a circle of radius 1 takes P0
const V0 = Math.sqrt(GM_E);           // circle speed at radius 1
const R_MOON = 3.2;
const W_MOON = Math.sqrt(GM_E / R_MOON ** 3);
const PC = 3.0;                       // a lap round the Moon at its lowest point (film 4)
const GM_M = (TAU / PC) ** 2;
const VC = Math.sqrt(GM_M);
const BURN = 0.55;                    // every burn lasts this long (lesson s)
const SAMPLE_DT = 1 / 120;

const pro = (s) => Math.atan2(s.vz, s.vx);
const retro = (s) => Math.atan2(-s.vz, -s.vx);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const lerpAng = (a, b, u) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
const circle = (theta) => ({ x: Math.cos(theta), z: Math.sin(theta), vx: -V0 * Math.sin(theta), vz: V0 * Math.cos(theta) });
const moonOnPath = (theta) => ({ x: R_MOON * Math.cos(theta), z: R_MOON * Math.sin(theta) });

function gravity(gm, x, z) {
  const r2 = x * x + z * z;
  const k = -gm / (r2 * Math.sqrt(r2));
  return [k * x, k * z];
}

/** Leapfrog the ship from `start` for `dur`, the engine pushing `thrust(t)`
 *  along the nose `nose(t, s)`. One sample per SAMPLE_DT. */
function simulate({ gm, start, dur, nose, thrust = () => 0, sub = 8 }) {
  const s = { ...start };
  const out = [];
  const h = SAMPLE_DT / sub;
  const n = Math.ceil(dur / SAMPLE_DT);
  for (let i = 0; i <= n; i++) {
    const t0 = i * SAMPLE_DT;
    out.push({ x: s.x, z: s.z, vx: s.vx, vz: s.vz, nose: nose(t0, s), burn: thrust(t0) > 0 });
    for (let k = 0; k < sub; k++) {
      const tk = t0 + k * h;
      const ang = nose(tk, s);
      const f = thrust(tk);
      let [ax, az] = gravity(gm, s.x, s.z);
      s.vx += (ax + f * Math.cos(ang)) * h / 2; s.vz += (az + f * Math.sin(ang)) * h / 2;
      s.x += s.vx * h; s.z += s.vz * h;
      [ax, az] = gravity(gm, s.x, s.z);
      s.vx += (ax + f * Math.cos(ang)) * h / 2; s.vz += (az + f * Math.sin(ang)) * h / 2;
    }
  }
  return out;
}

function elements(gm, s) {
  const r = Math.hypot(s.x, s.z);
  const E = (s.vx * s.vx + s.vz * s.vz) / 2 - gm / r;
  const hh = s.x * s.vz - s.z * s.vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * E * hh * hh) / (gm * gm)));
  const a = -gm / (2 * E);
  return { E, e, a, apo: E < 0 ? a * (1 + e) : Infinity };
}

const last = (arr) => arr[arr.length - 1];

/** A prograde burn at tb from the circle at theta0, sized (bisection) so the
 *  oval's far end is exactly on the Moon's path. Returns the run and when it
 *  gets there. */
function moonTransfer(theta0, tb, hold) {
  const nose = (tt, s) => pro(s);
  const run = (f, dur) => simulate({ gm: GM_E, start: circle(theta0), dur, nose, thrust: (tt) => (tt >= tb && tt < tb + BURN ? f : 0) });
  let lo = 0; let hi = (0.6 * V0) / BURN;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (elements(GM_E, last(run(mid, tb + BURN + SAMPLE_DT))).apo > R_MOON) hi = mid; else lo = mid;
  }
  const f = (lo + hi) / 2;
  const samples = run(f, tb + BURN + 5);
  let iApo = Math.round((tb + BURN) / SAMPLE_DT);
  const r = (p) => Math.hypot(p.x, p.z);
  while (iApo + 1 < samples.length && r(samples[iApo + 1]) >= r(samples[iApo])) iApo++;
  const tApo = iApo * SAMPLE_DT;
  const arrive = samples[iApo];
  samples.length = Math.min(samples.length, iApo + 1);
  return { samples, tApo, arrive, thetaApo: Math.atan2(arrive.z, arrive.x), dur: tApo + hold };
}

// --- the films ----------------------------------------------------------------------

const name = () => heroName();

/** A clip = one continuous piece of film. `rate` = lesson seconds per real second. */
function film1() {
  const tb = 1.9;
  const theta0 = 30 * DEG - (TAU / P0) * tb;       // the burn happens up and to the right
  const thetaM0 = 30 * DEG - W_MOON * tb;          // ...right under the Moon
  const moonAt = (tt) => moonOnPath(thetaM0 + W_MOON * tt);
  const toMoon = (tt, s) => { const m = moonAt(tt); return Math.atan2(m.z - s.z, m.x - s.x); };
  const f = (0.42 * V0) / BURN;
  const nose = (tt, s) => (tt < 1 ? pro(s) : tt < 1.6 ? lerpAng(pro(s), toMoon(tt, s), smooth((tt - 1) / 0.6)) : toMoon(tt, s));
  const dur = 8.4;
  const samples = simulate({ gm: GM_E, start: circle(theta0), dur, nose, thrust: (tt) => (tt >= tb && tt < tb + BURN ? f : 0) });
  return {
    id: 'straight',
    title: two('Why not fly straight at the Moon?', 'Why not go straight to the Moon?'),
    clips: [{
      frame: 'earth', gm: GM_E, samples, dur, rate: 1, moonAt,
      aimLine: (tt) => tt >= 1 && tt < tb + BURN,
      velArrow: (tt) => tt < tb + BURN + 1,
      captions: [
        [0, two(`Quick flight lesson, ${name()}! This is you, flying round Earth. You are already zooming sideways, super fast.`, `This is you, going round Earth, ${name()}. You are already zooming sideways, super fast!`)],
        [1, two('So why not just point straight at the Moon...', 'What if you point at the Moon...')],
        [tb, two('...and hold W? BURN!', '...and hold W? BURN!')],
        [tb + BURN + 0.2, two('Hmm. The dotted line just turns into a lopsided oval.', 'Hmm. The dotted line just makes a lopsided oval.')],
        [4.6, two('It never gets near the Moon, and the Moon keeps moving too. Missed!', 'It never gets to the Moon. Missed!')],
      ],
      labels: (tt) => (tt < 1 ? [{ text: t('zooming sideways', 'zooming sideways'), kind: 'go' }]
        : tt < tb ? [{ text: t('point at the Moon', 'point at the Moon'), kind: 'info' }]
          : tt < tb + BURN ? [{ text: 'BURN!', kind: 'burn' }]
            : tt < 4.6 ? [{ text: 'coast...', kind: 'coast' }]
              : [{ text: 'Missed!', kind: 'bad' }]),
    }],
  };
}

function film2() {
  const tb = 1.6;
  const tr = moonTransfer(140 * DEG - (TAU / P0) * tb, tb, 1.4);   // burn on the left, meet on the right
  const thetaM0 = tr.thetaApo - W_MOON * tr.tApo;
  const end = tr.tApo;
  return {
    id: 'along',
    title: two('Push along your path', 'Push forward!'),
    clips: [{
      frame: 'earth', gm: GM_E, samples: tr.samples, dur: tr.dur, rate: 1,
      moonAt: (tt) => moonOnPath(thetaM0 + W_MOON * Math.min(tt, end)),
      oldOrbit: (tt) => tt >= tb,
      velArrow: (tt) => tt < tb,
      meet: (tt) => tt >= end - 0.15,
      captions: [
        [0, two('Now point the nose ALONG your path, the way you are already going.', 'Now point the nose forward, the way you are going.')],
        [0.8, two('The engine pushes you the way the nose points.', 'The engine pushes you where the nose points.')],
        [tb, two('BURN! Hold W and watch the dotted line stretch...', 'BURN! Hold W. Look, the dotted line grows!')],
        [tb + BURN + 0.15, two('Engine off. Faster means a bigger orbit: your circle is now a long oval.', 'Faster means bigger. Your circle is now a long oval!')],
        [end - 0.15, two('Its far end reaches all the way out to the Moon!', 'It reaches all the way to the Moon!')],
      ],
      labels: (tt) => (tt < tb ? [{ text: t('nose: along your path', 'nose: forward'), kind: 'info' }]
        : tt < tb + BURN ? [{ text: 'BURN!', kind: 'burn' }]
          : tt < end - 0.15 ? [{ text: 'coast...', kind: 'coast' }]
            : [{ text: t('Made it!', 'Made it!'), kind: 'good' }]),
    }],
  };
}

function film3() {
  // A: burn straight away. B: the same start, one lap and a bit of waiting.
  const theta0 = 2 * DEG;   // both meetings on the right of the picture
  const tbA = 0.7;
  const A = moonTransfer(theta0, tbA, 1.5);
  const mA0 = A.thetaApo - 80 * DEG - W_MOON * A.tApo;    // the Moon is 80 degrees short of the meeting point
  const tbB = 2.6;
  const B = moonTransfer(theta0, tbB, 1.5);
  const mB0 = B.thetaApo - W_MOON * B.tApo;
  const meetB = { x: B.arrive.x, z: B.arrive.z };
  return {
    id: 'window',
    title: two('Why go round and wait?', 'Why do we wait?'),
    clips: [{
      frame: 'earth', gm: GM_E, samples: A.samples, dur: A.dur, rate: 1.45,
      moonAt: (tt) => moonOnPath(mA0 + W_MOON * Math.min(tt, A.tApo)),
      oldOrbit: (tt) => tt >= tbA,
      captions: [
        [0, two('What if you burn right away, without waiting?', 'What if you go right now?')],
        [tbA, two('BURN!')],
        [tbA + BURN + 0.1, two('Coast all the way out...', 'Coast...')],
        [A.tApo - 0.1, two('Oh no! The Moon isn’t there yet. Too early!', 'Oh no! The Moon is not there yet!')],
      ],
      labels: (tt) => (tt < tbA ? [] : tt < tbA + BURN ? [{ text: 'BURN!', kind: 'burn' }]
        : tt < A.tApo - 0.1 ? [{ text: 'coast...', kind: 'coast' }]
          : [{ text: t('Too early!', 'Too early!'), kind: 'bad' }, { text: t('still on its way', 'not here yet'), kind: 'info', at: 'moon' }]),
    }, {
      frame: 'earth', gm: GM_E, samples: B.samples, dur: B.dur, rate: 1.25,
      moonAt: (tt) => moonOnPath(mB0 + W_MOON * Math.min(tt, B.tApo)),
      oldOrbit: (tt) => tt >= tbB,
      marker: meetB,
      meet: (tt) => tt >= B.tApo - 0.15,
      captions: [
        [0, two('This time, go round and wait. Watch the Moon move towards the meeting point.', 'This time, go round and wait. Watch the Moon move.')],
        [tbB - 1.6, two('Mission Control works out the perfect moment and lights your green BURN NOW sign.', 'Wait for the green BURN NOW sign...')],
        [tbB, two('3, 2, 1... BURN NOW!', 'BURN NOW!')],
        [tbB + BURN + 0.1, two('Coast...')],
        [B.tApo - 0.15, two('Right on time! You and the Moon arrive together.', 'Yes! You and the Moon get there together!')],
      ],
      labels: (tt) => {
        if (tt < tbB - 1.6) return [{ text: t('waiting...', 'waiting...'), kind: 'coast' }, { text: t('meeting point', 'meet here'), kind: 'info', at: 'marker' }];
        if (tt < tbB) return [{ text: `${t('Burn in', 'Burn in')} ${Math.ceil((tbB - tt) / (1.6 / 3))}`, kind: 'info' }, { text: t('meeting point', 'meet here'), kind: 'info', at: 'marker' }];
        if (tt < tbB + BURN) return [{ text: 'BURN NOW!', kind: 'burn' }];
        if (tt < B.tApo - 0.15) return [{ text: 'coast...', kind: 'coast' }];
        return [{ text: t('Right on time!', 'Right on time!'), kind: 'good' }];
      },
    }],
  };
}

function film4() {
  // Lowest point (periapsis) 1 unit below the Moon's centre, going right at
  // 1.5x circle speed (faster than escape speed: it would leave). Run that
  // backwards to find where she comes in from.
  const vp = 1.5 * VC;
  const back = simulate({ gm: GM_M, start: { x: 0, z: -1, vx: -vp, vz: 0 }, dur: 6, nose: () => 0 });
  let iIn = back.findIndex((p) => Math.hypot(p.x, p.z) >= 4.4);
  if (iIn < 0) iIn = back.length - 1;
  const tIn = iIn * SAMPLE_DT;
  const s0 = back[iIn];
  const start = { x: s0.x, z: s0.z, vx: -s0.vx, vz: -s0.vz };

  const durA = 2 * tIn + 0.4;
  const A = simulate({ gm: GM_M, start, dur: durA, nose: (tt, s) => pro(s) });

  const tTurn = tIn - 1.25;
  const tb = tIn - BURN / 2;
  const nose = (tt, s) => (tt < tTurn ? pro(s) : tt < tTurn + 0.7 ? lerpAng(pro(s), retro(s), smooth((tt - tTurn) / 0.7)) : retro(s));
  const runB = (f, dur) => simulate({ gm: GM_M, start, dur, nose, thrust: (tt) => (tt >= tb && tt < tb + BURN ? f : 0) });
  // The braking push that leaves the roundest orbit (finite burn, so scan).
  let best = null;
  for (let f = 0.5; f <= 4; f += 0.05) {
    const e = elements(GM_M, last(runB(f, tb + BURN + SAMPLE_DT))).e;
    if (!best || e < best.e) best = { f, e };
  }
  const durB = tb + BURN + 1.25 * PC;
  const B = runB(best.f, durB);
  // Fit the picture to the fly-past path.
  let z0 = -1.2; let z1 = 0; let xm = 1.5;
  for (const p of A) { z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); xm = Math.max(xm, Math.abs(p.x)); }
  const view = { cx: 0, cz: (z0 + z1) / 2, ex: xm + 0.35, ez: (z1 - z0) / 2 + 0.45 };
  return {
    id: 'capture',
    title: two('Catch the Moon: the backwards burn', 'Slow down at the Moon'),
    clips: [{
      frame: 'moon', view, gm: GM_M, samples: A, dur: durA, rate: 1.25, trail: 99,
      velArrow: () => true,
      captions: [
        [0, two('Here you come, arriving at the Moon. But you are going much too fast!', 'Here you come to the Moon. But you are too fast!')],
        [tIn + 0.15, two('Without slowing down... whoosh! You fly right past.', 'No slowing down... whoosh! You fly past.')],
      ],
      labels: (tt) => (tt < tIn - 0.2 ? [{ text: t('too fast!', 'too fast!'), kind: 'warn' }]
        : tt < tIn + 0.5 ? [{ text: 'whoosh!', kind: 'coast' }]
          : [{ text: t('flying away!', 'flying away!'), kind: 'bad' }]),
    }, {
      frame: 'moon', view, gm: GM_M, samples: B, dur: durB, rate: 1, ghost: A,
      velArrow: () => true,
      caught: (tt) => tt >= tb + BURN + 0.4,
      captions: [
        [0, two('This time, turn the ship round: point backwards (opposite to the way you’re moving).', 'This time, turn round. Face the way you came.')],
        [tb, two('At your lowest point, hold W. BURN! The engine pushes against your speed.', 'At the lowest point, hold W. BURN!')],
        [tb + BURN + 0.2, two('You slow down... and the Moon’s gravity catches you. You’re in orbit round the Moon!', 'You slow down. The Moon catches you!')],
      ],
      labels: (tt) => (tt < tTurn ? [{ text: t('too fast!', 'too fast!'), kind: 'warn' }]
        : tt < tb ? [{ text: t('point backwards', 'face the way you came'), kind: 'info' }]
          : tt < tb + BURN ? [{ text: 'BURN!', kind: 'burn' }]
            : tt < tb + BURN + 0.4 ? [{ text: t('slowing down', 'slowing down'), kind: 'coast' }]
              : [{ text: t('Caught!', 'Caught!'), kind: 'good' }]),
      ghostLabel: t('no brakes: flies past', 'no brakes: flies past'),
    }],
  };
}

let films = null;
/** The four films, built once (a few ms of maths). */
export function buildFilms() {
  if (!films) films = [film1(), film2(), film3(), film4()];
  return films;
}

// --- drawing ---------------------------------------------------------------------------

const COL = {
  space0: '#120d16', space1: '#1c1410',
  cream: '#f7efe2', muted: '#cdbfa9', accent: '#ff7847', amber: '#ffcf5c',
  good: '#8fd66b', bad: '#ff6b5c', go: '#9fe07a', ink: '#14100c',
};
const FONT = '\'Segoe UI\', \'Trebuchet MS\', system-ui, Arial, sans-serif';

function stateAt(samples, simT) {
  const f = Math.max(0, simT / SAMPLE_DT);
  const i = Math.min(samples.length - 1, Math.floor(f));
  const j = Math.min(samples.length - 1, i + 1);
  const u = Math.min(1, f - i);
  const a = samples[i]; const b = samples[j];
  return {
    x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, vx: a.vx + (b.vx - a.vx) * u, vz: a.vz + (b.vz - a.vz) * u,
    nose: lerpAng(a.nose, b.nose, u), burn: a.burn, i,
  };
}

let stars = null;
function starField() {
  if (stars) return stars;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  stars = Array.from({ length: 90 }, () => ({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.1, a: 0.25 + rnd() * 0.55 }));
  return stars;
}

/** A label. With `dir` (unit vector, screen) it sits on that side of (x, y),
 *  its near edge `gap` px away, so it never covers what it labels. */
let LABEL_K = 1; // label size for the current canvas (smaller in the question view)
function pill(ctx, x, y, text, kind, W, H, dir = null, gap = 0) {
  const k = LABEL_K;
  ctx.font = `800 ${Math.round(15 * k)}px ${FONT}`;
  const w = ctx.measureText(text).width + 20 * k;
  const h = 26 * k;
  if (dir) {
    // distance from the centre to the box edge along dir, plus the gap
    const ex = Math.abs(dir[0]) > 1e-6 ? (w / 2) / Math.abs(dir[0]) : Infinity;
    const ey = Math.abs(dir[1]) > 1e-6 ? (h / 2) / Math.abs(dir[1]) : Infinity;
    const d = Math.min(ex, ey) + gap;
    x += dir[0] * d; y += dir[1] * d;
  }
  x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
  y = Math.max(h / 2 + 4, Math.min(H - h / 2 - 4, y));
  const style = {
    burn: [COL.accent, COL.ink], good: [COL.good, COL.ink], bad: [COL.bad, COL.ink], warn: [COL.amber, COL.ink],
    info: ['rgba(36,29,23,0.92)', COL.amber], coast: ['rgba(36,29,23,0.85)', COL.muted], go: ['rgba(36,29,23,0.92)', COL.go],
  }[kind] || ['rgba(36,29,23,0.9)', COL.cream];
  ctx.fillStyle = style[0];
  ctx.strokeStyle = 'rgba(255,238,214,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  if (kind === 'info' || kind === 'coast' || kind === 'go') ctx.stroke();
  ctx.fillStyle = style[1];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function arrow(ctx, x, y, ang, len, color, width = 3) {
  const ex = x + Math.cos(ang) * len; const ey = y - Math.sin(ang) * len;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
  const hx = Math.cos(ang); const hy = -Math.sin(ang);
  ctx.beginPath();
  ctx.moveTo(ex + hx * 7, ey + hy * 7);
  ctx.lineTo(ex - hy * 6 - hx * 3, ey + hx * 6 - hy * 3);
  ctx.lineTo(ex + hy * 6 - hx * 3, ey - hx * 6 - hy * 3);
  ctx.closePath(); ctx.fill();
}

function rocket(ctx, x, y, ang, L, burning, clock, ghost) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.globalAlpha = ghost ? 0.5 : 1;
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 0.9);
  halo.addColorStop(0, 'rgba(255,240,220,0.35)'); halo.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, L * 0.9, 0, TAU); ctx.fill();
  if (burning) {
    const fl = 0.75 + 0.25 * Math.sin(clock * 47) + 0.12 * Math.sin(clock * 83);
    const g = ctx.createLinearGradient(-L / 2, 0, -L / 2 - L * 1.3 * fl, 0);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.35, '#ffb347'); g.addColorStop(1, 'rgba(255,120,71,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, -L * 0.2);
    ctx.quadraticCurveTo(-L * 0.9 * fl, -L * 0.18, -L / 2 - L * 1.3 * fl, 0);
    ctx.quadraticCurveTo(-L * 0.9 * fl, L * 0.18, -L * 0.42, L * 0.2);
    ctx.closePath(); ctx.fill();
  }
  // fins
  ctx.fillStyle = COL.accent;
  ctx.beginPath(); ctx.moveTo(-L * 0.15, -L * 0.16); ctx.lineTo(-L * 0.5, -L * 0.42); ctx.lineTo(-L * 0.45, -L * 0.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.15, L * 0.16); ctx.lineTo(-L * 0.5, L * 0.42); ctx.lineTo(-L * 0.45, L * 0.1); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = COL.cream; ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.quadraticCurveTo(L * 0.25, -L * 0.22, -L * 0.45, -L * 0.17);
  ctx.lineTo(-L * 0.45, L * 0.17);
  ctx.quadraticCurveTo(L * 0.25, L * 0.22, L / 2, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5fb6ff';
  ctx.beginPath(); ctx.arc(L * 0.12, 0, L * 0.08, 0, TAU); ctx.fill();
  ctx.restore();
}

function earth(ctx, x, y, r) {
  const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.7);
  glow.addColorStop(0, 'rgba(110,180,255,0.35)'); glow.addColorStop(1, 'rgba(110,180,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#6fb8ff'); g.addColorStop(1, '#1f4f95');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#5fae5a';
  for (const [dx, dy, rx, ry, rot] of [[-0.3, -0.2, 0.32, 0.22, 0.5], [0.35, 0.25, 0.28, 0.18, -0.4], [0.05, 0.55, 0.2, 0.12, 0.2], [0.25, -0.5, 0.18, 0.1, 0.9]]) {
    ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, rx * r, ry * r, rot, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function moon(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#f1ece2'); g.addColorStop(1, '#9d968b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(110,102,92,0.45)';
  for (const [dx, dy, cr] of [[-0.3, -0.15, 0.2], [0.3, 0.25, 0.16], [0.1, -0.45, 0.12], [-0.15, 0.4, 0.1]]) {
    ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, cr * r, 0, TAU); ctx.fill();
  }
}

/** Integrate the coast from `s` and drop a dot every ~9 px (the game's dotted line). */
function dottedPath(ctx, gm, s, toScreen, scale, frame) {
  const el = elements(gm, s);
  const period = el.E < 0 ? TAU * Math.sqrt(el.a ** 3 / gm) : Infinity;
  const horizon = Math.min(period * 1.0, frame === 'moon' ? 3.2 : 7);
  const p = { x: s.x, z: s.z, vx: s.vx, vz: s.vz };
  const h = 1 / 240;
  let acc = 0;
  ctx.fillStyle = 'rgba(255,231,176,0.9)';
  for (let tt = 0; tt < horizon; tt += h) {
    let [ax, az] = gravity(gm, p.x, p.z);
    p.vx += ax * h / 2; p.vz += az * h / 2;
    const ox = p.x; const oz = p.z;
    p.x += p.vx * h; p.z += p.vz * h;
    [ax, az] = gravity(gm, p.x, p.z);
    p.vx += ax * h / 2; p.vz += az * h / 2;
    acc += Math.hypot(p.x - ox, p.z - oz) * scale;
    if (acc >= 9) {
      acc = 0;
      const [sx, sy] = toScreen(p.x, p.z);
      ctx.beginPath(); ctx.arc(sx, sy, 1.9, 0, TAU); ctx.fill();
    }
    if (Math.hypot(p.x, p.z) > (frame === 'moon' ? 6 : R_MOON + 1.2)) break;
  }
}

/**
 * Draw one moment of a clip.
 * @param {CanvasRenderingContext2D} ctx  already scaled to CSS pixels
 * @param {number} W @param {number} H    CSS pixel size
 * @param {object} clip                   from buildFilms()
 * @param {number} simT                   lesson seconds into the clip
 * @param {number} clock                  free-running seconds (flame flicker, pulses)
 * @param {number} fade                   0..1 fade-in at the start of a clip
 */
export function drawFrame(ctx, W, H, clip, simT, clock, fade = 1) {
  const view = clip.view || { cx: 0, cz: 0, ex: R_MOON + 0.6, ez: R_MOON + 0.5 };
  const scale = Math.min(W / (2 * view.ex), H / (2 * view.ez));
  const ox = W / 2 - view.cx * scale; const oy = H / 2 + view.cz * scale;
  const toScreen = (x, z) => [ox + x * scale, oy - z * scale];
  const compact = W < 620; // the small picture beside a question
  LABEL_K = Math.max(0.72, Math.min(1, Math.min(W / 860, H / 400)));

  // space
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COL.space0); bg.addColorStop(1, COL.space1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  for (const st of starField()) {
    ctx.fillStyle = `rgba(255,244,225,${st.a})`;
    ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, TAU); ctx.fill();
  }

  const s = stateAt(clip.samples, simT);
  const [sx, sy] = toScreen(s.x, s.z);
  const L = Math.max(20, Math.min(30, scale * 0.42));
  const labelsAt = {};

  if (clip.frame === 'earth') {
    const [ex, ey] = toScreen(0, 0);
    // the Moon's path
    ctx.strokeStyle = 'rgba(247,239,226,0.2)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 7]);
    ctx.beginPath(); ctx.arc(ex, ey, R_MOON * scale, 0, TAU); ctx.stroke();
    if (clip.oldOrbit?.(simT)) {
      ctx.strokeStyle = 'rgba(255,207,92,0.28)';
      ctx.beginPath(); ctx.arc(ex, ey, 1 * scale, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(205,191,169,0.65)'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(t('the Moon’s path', 'the Moon’s path'), ex + Math.cos(132 * DEG) * R_MOON * scale - 4, ey - Math.sin(132 * DEG) * R_MOON * scale - 4);
    earth(ctx, ex, ey, 0.42 * scale);
    ctx.fillStyle = 'rgba(247,239,226,0.8)'; ctx.font = `800 12px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillText('Earth', ex, ey + 0.42 * scale + 5);

    if (clip.marker) {
      const [mx, my] = toScreen(clip.marker.x, clip.marker.z);
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(mx, my, 13, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(mx - 6, my - 6); ctx.lineTo(mx + 6, my + 6); ctx.moveTo(mx + 6, my - 6); ctx.lineTo(mx - 6, my + 6); ctx.stroke();
      labelsAt.marker = [mx + 0, my - 30];
    }
    const m = clip.moonAt(simT);
    const [mx, my] = toScreen(m.x, m.z);
    const mr = Math.max(9, 0.3 * scale);
    if (clip.meet?.(simT)) {
      const pulse = (clock * 1.6) % 1;
      ctx.strokeStyle = `rgba(143,214,107,${1 - pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, mr + 6 + pulse * 22, 0, TAU); ctx.stroke();
    }
    moon(ctx, mx, my, mr);
    labelsAt.moon = [mx, my - mr - 18];
    if (clip.aimLine?.(simT)) {
      ctx.strokeStyle = 'rgba(255,207,92,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
    }
  } else {
    const [mx, my] = toScreen(0, 0);
    const mr = 0.55 * scale;
    if (clip.caught?.(simT)) {
      const pulse = (clock * 1.2) % 1;
      ctx.strokeStyle = `rgba(143,214,107,${0.8 * (1 - pulse)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, mr + 4 + pulse * 18, 0, TAU); ctx.stroke();
    }
    moon(ctx, mx, my, mr);
    if (!compact && mr >= 30) {
      ctx.fillStyle = 'rgba(52,44,36,0.85)'; ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t('the Moon', 'the Moon'), mx, my + mr * 0.62);
    }
    if (clip.ghost) {
      ctx.strokeStyle = 'rgba(255,107,92,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath();
      clip.ghost.forEach((p, i) => { const [gx, gy] = toScreen(p.x, p.z); if (i) ctx.lineTo(gx, gy); else ctx.moveTo(gx, gy); });
      ctx.stroke(); ctx.setLineDash([]);
      const gEnd = clip.ghost[Math.floor(clip.ghost.length * 0.86)];
      labelsAt.ghost = toScreen(gEnd.x, gEnd.z);
    }
  }

  // the trail she leaves (the whole path in the fly-past film)
  const trailN = Math.round((clip.trail ?? 0.7) / SAMPLE_DT);
  ctx.strokeStyle = 'rgba(255,150,90,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = Math.max(0, s.i - trailN), k = 0; i <= s.i; i++, k++) {
    const [px, py] = toScreen(clip.samples[i].x, clip.samples[i].z);
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.lineTo(sx, sy);
  ctx.stroke();

  // where she'll go if she coasts from here: the dotted line
  dottedPath(ctx, clip.gm, s, toScreen, scale, clip.frame);

  if (clip.velArrow?.(simT)) arrow(ctx, sx, sy, Math.atan2(s.vz, s.vx), L + 26, COL.go, 3);
  rocket(ctx, sx, sy, s.nose, L, s.burn, clock, false);

  // labels: beside the ship, away from the planet in the middle
  const away = Math.atan2(sy - oy, sx - ox);
  const dir = [Math.cos(away), Math.sin(away)];
  for (const lb of clip.labels(simT)) {
    if (lb.at && !labelsAt[lb.at]) continue;
    if (lb.at) pill(ctx, labelsAt[lb.at][0], labelsAt[lb.at][1], lb.text, lb.kind, W, H);
    else pill(ctx, sx, sy, lb.text, lb.kind, W, H, dir, L * 0.7 + 8);
  }
  if (clip.ghost && labelsAt.ghost && !compact) pill(ctx, labelsAt.ghost[0], labelsAt.ghost[1] - 16, clip.ghostLabel, 'bad', W, H);

  if (fade < 1) { ctx.fillStyle = `rgba(18,13,22,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}
