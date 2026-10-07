// "Orbit transfer" help panel (bottom centre), shown while a step asks her to
// move to a new orbit (the satellite, the Moon, Mars, the belt, Jupiter,
// Europa). The banner at the top says WHAT to do; this panel shows the three
// numbers behind it, so "hold W" is never a guess (lead playtest: "not clear
// how long to press W and which direction to point"):
//
//   WHEN   seconds to the burn window, or NOW
//   POINT  a dial: the green mark is where the nose must point, the white
//          arrow is where it points now, with the degrees between and the key
//          that closes the gap (Easy: the ship turns itself)
//   PUSH   a bar that fills while she holds W: full = the planned speed
//          change, with the seconds of W left
//
// main.js works out the numbers (updateBurnCue) and passes them to update();
// null hides the panel.

import { el, svg } from './domUtil.js';
import { iconInner } from './icons.js';
import { t } from '../level.js';

const DEG = 180 / Math.PI;
const REDRAW_MS = 80;

/**
 * @typedef {object} TransferHelp
 * @property {'search'|'wait'|'point'|'burn'|'full'|'over'|'coast'|'oncourse'|'fix'} phase
 * @property {string} targetName   "the Moon", "the satellite"...
 * @property {number} [tau]        seconds to the burn window
 * @property {number} [dvNeed]     planned speed change, u/s
 * @property {number} [dvDone]     delivered so far in this burn, u/s
 * @property {number} [accel]      her engine's push now, u/s per s
 * @property {boolean} [along]     true = along her path, false = backwards
 * @property {number|null} [err]   radians the nose must turn (+ = turn right, D)
 * @property {boolean} auto        Easy: the ship steers itself, one tap starts the booster
 * @property {boolean} autoStop    the engine stops itself at the end of the burn
 * @property {boolean} [latched]   Easy: the booster is running on its own
 */

export function createTransferPanel(root) {
  const panel = el('div', 'sp-panel sp-xfer');
  panel.hidden = true;

  const head = el('div', 'sp-xfer__head');
  const title = el('div', 'sp-panel__title');
  title.appendChild(svg(iconInner('orbit')));
  const titleText = document.createTextNode('');
  title.appendChild(titleText);
  head.appendChild(title);
  const steps = el('div', 'sp-xfer__steps');
  const stepNames = [
    ['wait', t('Wait', 'Wait')],
    ['point', t('Point', 'Point')],
    ['burn', t('Burn', 'Go')],
    ['coast', t('Coast', 'Coast')],
  ];
  const stepEls = {};
  for (const [id, label] of stepNames) {
    const s = el('span', 'sp-xfer__step', label);
    stepEls[id] = s;
    steps.appendChild(s);
  }
  head.appendChild(steps);
  panel.appendChild(head);

  const grid = el('div', 'sp-xfer__grid');

  // WHEN
  const when = el('div', 'sp-xfer__cell sp-xfer__when');
  when.appendChild(el('div', 'sp-xfer__label', t('When', 'When')));
  const whenBig = el('div', 'sp-xfer__big tabular', '');
  const whenSub = el('div', 'sp-xfer__sub', '');
  when.append(whenBig, whenSub);

  // POINT
  const point = el('div', 'sp-xfer__cell sp-xfer__point');
  point.appendChild(el('div', 'sp-xfer__label', t('Point', 'Point')));
  const dialRow = el('div', 'sp-xfer__dialrow');
  const dial = document.createElement('canvas');
  dial.className = 'sp-xfer__dial';
  const pointText = el('div', 'sp-xfer__pointtext');
  const pointWay = el('div', 'sp-xfer__way', '');
  const pointOff = el('div', 'sp-xfer__off tabular', '');
  const pointKey = el('div', 'sp-xfer__sub', '');
  pointText.append(pointOff, pointKey);
  dialRow.append(dial, pointText);
  point.append(pointWay, dialRow);

  // PUSH
  const push = el('div', 'sp-xfer__cell sp-xfer__push');
  push.appendChild(el('div', 'sp-xfer__label', t('Push (hold W)', 'Push (W)')));
  const bar = el('div', 'sp-xfer__bar');
  const fill = el('div', 'sp-xfer__fill');
  const over = el('div', 'sp-xfer__overfill');
  const mark = el('div', 'sp-xfer__mark');
  bar.append(fill, over, mark);
  const pushBig = el('div', 'sp-xfer__pushbig tabular', '');
  const pushSub = el('div', 'sp-xfer__sub tabular', '');
  push.append(bar, pushBig, pushSub);

  grid.append(when, point, push);
  panel.appendChild(grid);

  const say = el('div', 'sp-xfer__say', '');
  panel.appendChild(say);
  root.appendChild(panel);

  // --- the dial -------------------------------------------------------------
  const dctx = dial.getContext('2d');
  let dialSize = 0;
  function sizeDial() {
    const css = dial.clientWidth || 84;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dialSize = css;
    dial.width = Math.round(css * dpr);
    dial.height = Math.round(css * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { dialSize = 0; });

  function drawDial(err, lined, auto, motion = null) {
    if (!dialSize) sizeDial();
    paintDial(dctx, dialSize, err, lined, auto, motion);
  }

  // --- update ---------------------------------------------------------------
  let lastAt = -Infinity;
  let lastKey = '';
  let shownPhase = '';

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

  /** @param {TransferHelp|null} h */
  function update(h) {
    if (!h) {
      if (!panel.hidden) { panel.hidden = true; root.classList.remove('has-xfer'); }
      shownPhase = '';
      return;
    }
    const now = performance.now();
    if (!panel.hidden && h.phase === shownPhase && now - lastAt < REDRAW_MS) return;
    lastAt = now;
    shownPhase = h.phase;
    if (panel.hidden) { panel.hidden = false; root.classList.add('has-xfer'); }

    const ph = h.phase;
    // "Backwards" alone was unclear (lead: at the Moon, or away from it?):
    // it always means against her motion.
    const way = h.along === false ? t('backwards (against your motion)', 'the way you came') : t('along your path', 'forward');
    // Level 1 says retrograde one way only: "Face the way you came".
    const wayDo = h.along === false ? 'Face the way you came' : 'Point forward';
    const errDeg = h.err === null || h.err === undefined ? null : Math.round(Math.abs(h.err) * DEG);
    const lined = errDeg !== null && errDeg <= 8;
    const turnKey = h.err > 0 ? t('hold → (or D) to turn right', 'hold → ▶') : t('hold ← (or A) to turn left', '◀ hold ←');
    const need = Math.max(0, h.dvNeed || 0);
    const done = Math.max(0, h.dvDone || 0);
    const acc = Math.max(0.01, h.accel || 1);
    const pointing = ['wait', 'point', 'burn', 'fix', 'full', 'over'].includes(ph);

    setText(titleText, t(`Transfer to ${h.targetName}`, `Fly to ${h.targetName}`));

    // The step chips: done ones ticked, the current one lit.
    const order = ['wait', 'point', 'burn', 'coast'];
    const current = ph === 'search' ? 'wait'
      : ph === 'full' || ph === 'over' ? 'burn'
        : ph === 'oncourse' ? 'coast'
          : ph === 'fix' ? 'burn' : ph;
    const ci = order.indexOf(current);
    order.forEach((id, i) => {
      stepEls[id].classList.toggle('is-now', i === ci);
      stepEls[id].classList.toggle('is-done', i < ci);
    });
    panel.dataset.phase = ph;

    // WHEN
    if (ph === 'search') { setText(whenBig, '…'); setText(whenSub, t('finding a path', 'finding a way')); }
    else if (ph === 'wait' || ph === 'point') {
      setText(whenBig, `${Math.max(0, Math.ceil(h.tau ?? 0))} s`);
      setText(whenSub, (h.tau ?? 0) > 100 ? t('time warp is OK', 'keys 1-4: go fast') : t('get ready!', 'get ready!'));
    } else if (ph === 'burn' || ph === 'fix') { setText(whenBig, t('NOW', 'NOW')); setText(whenSub, t('burn window open', 'go go go!')); }
    else if (ph === 'full' || ph === 'over') { setText(whenBig, t('STOP', 'STOP')); setText(whenSub, t('let go of W', 'let go of W')); }
    else { setText(whenBig, '✓'); setText(whenSub, t('just coast', 'just wait')); }

    // POINT
    point.classList.toggle('is-idle', !pointing);
    if (pointing) {
      setText(pointWay, h.along === false ? t('Backwards: against your motion', 'Face the way you came') : t('Along path (prograde)', 'Forward'));
      if (errDeg === null) { setText(pointOff, ''); setText(pointKey, ''); }
      else if (lined) { setText(pointOff, t('Lined up ✓', 'Good ✓')); setText(pointKey, h.auto ? t('the ship holds it', 'the ship does it') : t('keep it there', 'keep it there')); }
      else {
        setText(pointOff, t(`${errDeg}° off`, `${errDeg}° off`));
        setText(pointKey, h.auto ? t('turning by itself…', 'turning by itself…') : turnKey);
      }
      pointOff.classList.toggle('is-good', lined);
      pointOff.classList.toggle('is-bad', !lined && errDeg !== null && errDeg > 25);
      drawDial(h.err ?? null, lined, h.auto, h.along === false ? Math.PI : null);
    } else {
      setText(pointWay, t('No turning needed', 'No turning'));
      setText(pointOff, '');
      setText(pointKey, t('engine off, coast', 'engine off'));
      drawDial(null, true, false);
    }

    // PUSH: the bar is the planned speed change; over 100% spills orange.
    const f = need > 0 ? done / need : 0;
    fill.style.width = `${Math.min(100, f * 100).toFixed(1)}%`;
    over.style.width = f > 1 ? `${Math.min(30, (f - 1) * 100).toFixed(1)}%` : '0%';
    push.classList.toggle('is-idle', !(need > 0) || ph === 'coast' || ph === 'oncourse' || ph === 'search');
    const left = Math.max(0, need - done) / acc;
    if (ph === 'wait' || ph === 'point') {
      setText(pushBig, h.auto ? t('Tap W once', 'Tap W once') : t(`Hold W ≈ ${Math.max(0.1, need / acc).toFixed(1)} s`, `Hold W ${Math.max(0.1, need / acc).toFixed(1)} s`));
      setText(pushSub, t(`speed change ${need.toFixed(1)} u/s`, 'fill the bar'));
    } else if (ph === 'burn') {
      setText(pushBig, `${Math.min(100, Math.round(f * 100))}%`);
      setText(pushSub, h.autoStop
        ? t(`${left.toFixed(1)} s more · stops by itself`, 'it stops by itself')
        : t(`${left.toFixed(1)} s more · let go at 100%`, 'let go when full'));
    } else if (ph === 'full') {
      setText(pushBig, '100% ✓');
      setText(pushSub, t('full! let go of W', 'full! let go'));
    } else if (ph === 'over') {
      setText(pushBig, `${Math.round(f * 100)}%`);
      setText(pushSub, t('too much! let go of W', 'too much! let go'));
    } else if (ph === 'fix') {
      setText(pushBig, t('Hold W', 'Hold W'));
      setText(pushSub, t('until the banner changes', 'until the sign changes'));
    } else {
      setText(pushBig, ph === 'search' ? '—' : '✓');
      setText(pushSub, ph === 'search' ? t('no burn yet', 'not yet') : t('burn done', 'done'));
    }

    // The one sentence to follow.
    let line;
    if (ph === 'search') line = t(`No good path to ${h.targetName} yet. Keep coasting (time warp is fine).`, 'Wait. The ship is looking for a way.');
    else if (ph === 'wait') {
      line = h.auto
        ? t(`Wait for NOW. The ship turns itself ${way}; then tap W once.`, 'Wait for NOW. Then tap W once.')
        : t(`Wait for NOW. Before then, turn ${way} until the white arrow meets the green mark.`, `Wait for NOW. ${wayDo} first.`);
    } else if (ph === 'point') {
      line = h.auto ? t('Almost time! The ship is turning itself. Get ready to tap W.', 'Get ready to tap W!')
        : lined ? t('Pointed right. Get ready to hold W when it says NOW.', 'Good! Get ready to hold W.')
          : t(`Point ${way} now: ${turnKey}.`, `Turn now: ${turnKey}.`);
    } else if (ph === 'burn') {
      line = h.auto && h.latched ? t('Booster on! It stops by itself when the bar is full. (S stops it early.)', 'Booster on! It stops by itself.')
        : h.auto ? t('Tap W! The booster runs by itself and stops when the bar is full. (S stops it early.)', 'Tap W! It stops by itself.')
        : !lined && errDeg !== null && errDeg > 25 ? t(`Turn first: ${turnKey}, then hold W.`, `Turn first: ${turnKey}.`)
          : h.autoStop ? t('Hold W. The engine stops itself when the bar is full.', 'Hold W. It stops by itself.')
            : t('Hold W and let go when the bar reaches 100%.', 'Hold W. Let go when the bar is full.');
    } else if (ph === 'full') line = t('Bar full! Let go of W.', 'Full! Let go of W.');
    else if (ph === 'over') line = t('Too much push! Let go of W now. A small fix will come later.', 'Too much! Let go of W.');
    else if (ph === 'fix') line = t(`Your orbit is off. Point ${way} and hold W.`, `${wayDo} and hold W.`);
    else if (ph === 'coast') line = t(`Coast. Watch your dotted line reach ${h.targetName}.`, `Wait. You’re flying to ${h.targetName}.`);
    else line = t(`On course for ${h.targetName}. Coast (time warp is fine).`, `You’re on the way to ${h.targetName}!`);
    // The autopilot is flying (Easy): say what IT does, don't give her orders
    // (play-test: the panel said "tap W once" while the autopilot flew).
    if (h.pilot) {
      line = ph === 'burn' ? t('Autopilot: firing the engine now.', 'Autopilot: engine on!')
        : ph === 'wait' || ph === 'point' ? t(`Autopilot: it will turn and fire the engine at NOW.`, 'Autopilot: it fires the engine at NOW.')
          : ph === 'search' ? t(`Autopilot: looking for a path to ${h.targetName}.`, 'Autopilot: finding the way.')
            : ph === 'fix' ? t('Autopilot: fixing the orbit.', 'Autopilot: fixing the path.')
              : t(`Autopilot: coasting to ${h.targetName}.`, `Autopilot: flying to ${h.targetName}.`);
      if (ph === 'wait' || ph === 'point' || ph === 'burn') setText(pushBig, t('Autopilot', 'Autopilot'));
    }
    setText(say, line);
    const key = ph;
    if (key !== lastKey) { lastKey = key; say.classList.remove('is-flash'); void say.offsetWidth; say.classList.add('is-flash'); }
  }

  return { el: panel, update };
}

/**
 * Paint the aim dial (shared with aimDial.js). The target is at 12 o'clock;
 * her nose is drawn `err` the other way, so turning right (D) visibly swings
 * the white arrow clockwise onto the green mark. `motion` (optional, radians
 * from the target, same sense as err) draws a dashed grey arrow for the way
 * she is moving, so "backwards" reads as "opposite to that arrow".
 */
export function paintDial(dctx, s, err, lined, auto, motion = null) {
  const c = s / 2;
  const R = s / 2 - 7;
  dctx.clearRect(0, 0, s, s);
  dctx.lineWidth = 2;
  dctx.strokeStyle = 'rgba(255,238,214,0.25)';
  dctx.beginPath(); dctx.arc(c, c, R, 0, Math.PI * 2); dctx.stroke();
  // Tick marks every 45 degrees.
  dctx.strokeStyle = 'rgba(255,238,214,0.35)';
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    dctx.beginPath();
    dctx.moveTo(c + Math.cos(a) * (R - 4), c + Math.sin(a) * (R - 4));
    dctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
    dctx.stroke();
  }
  const good = '#8fd66b';
  // The green "point here" mark at the top.
  dctx.fillStyle = good;
  dctx.beginPath();
  dctx.moveTo(c, 1); dctx.lineTo(c + 7, 10); dctx.lineTo(c - 7, 10); dctx.closePath();
  dctx.fill();
  if (motion !== null && motion !== undefined) {
    // The way she is moving: a dashed grey arrow from the centre (not blue
    // or green: those read as "point here" next to the green 3-D chevron).
    const m = -Math.PI / 2 - motion;
    const mx = c + Math.cos(m) * (R - 4);
    const my = c + Math.sin(m) * (R - 4);
    dctx.strokeStyle = 'rgba(190,190,196,0.9)';
    dctx.fillStyle = dctx.strokeStyle;
    dctx.lineWidth = 2.5;
    dctx.setLineDash([3, 3]);
    dctx.beginPath(); dctx.moveTo(c, c); dctx.lineTo(mx, my); dctx.stroke();
    dctx.setLineDash([]);
    dctx.beginPath();
    dctx.moveTo(mx + Math.cos(m) * 3, my + Math.sin(m) * 3);
    dctx.lineTo(mx + Math.cos(m + 2.5) * 8, my + Math.sin(m + 2.5) * 8);
    dctx.lineTo(mx + Math.cos(m - 2.5) * 8, my + Math.sin(m - 2.5) * 8);
    dctx.closePath(); dctx.fill();
  }
  if (err === null || err === undefined) return;
  const nose = -Math.PI / 2 - err; // canvas angle of her nose
  // The gap to close, as an amber arc.
  if (!lined) {
    dctx.strokeStyle = '#ffcf5c';
    dctx.lineWidth = 5;
    dctx.beginPath();
    dctx.arc(c, c, R - 9, Math.min(nose, -Math.PI / 2), Math.max(nose, -Math.PI / 2));
    dctx.stroke();
  }
  // Her nose.
  dctx.strokeStyle = lined ? good : '#ffffff';
  dctx.fillStyle = dctx.strokeStyle;
  dctx.lineWidth = 3.5;
  dctx.lineCap = 'round';
  const tipR = R - 6;
  const tx = c + Math.cos(nose) * tipR;
  const ty = c + Math.sin(nose) * tipR;
  dctx.beginPath(); dctx.moveTo(c - Math.cos(nose) * 10, c - Math.sin(nose) * 10); dctx.lineTo(tx, ty); dctx.stroke();
  dctx.beginPath();
  dctx.moveTo(tx + Math.cos(nose) * 4, ty + Math.sin(nose) * 4);
  dctx.lineTo(tx + Math.cos(nose + 2.4) * 10, ty + Math.sin(nose + 2.4) * 10);
  dctx.lineTo(tx + Math.cos(nose - 2.4) * 10, ty + Math.sin(nose - 2.4) * 10);
  dctx.closePath(); dctx.fill();
  dctx.beginPath(); dctx.arc(c, c, 4, 0, Math.PI * 2); dctx.fill();
  if (auto && !lined) {
    dctx.fillStyle = 'rgba(191,233,255,0.9)';
    dctx.font = '800 10px system-ui, sans-serif';
    dctx.textAlign = 'center';
    dctx.fillText('AUTO', c, c + R * 0.55);
  }
}
