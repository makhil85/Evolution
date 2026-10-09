// Chapter 7, Part C: the four room task cards (rules in tasksLogic.js). Each
// opens over the walk when she presses E at its spot, is led by one crewmate
// (their tip at the top), and works like Chapter 6's quest cards (quests.js):
// Easy and Medium for everyone, Hard for Level 4 only, a Start again button on a
// miss, and a Done button that lights once the task is solved.
//
//   split    - the atom kitchen: drag every ball into a jar (Easy, Medium); Hard
//              balances 2 H2O -> 2 H2 + O2 with the boxes
//   plants   - the light runs and their bubbles (Easy, Medium); Hard balances the
//              oxygen atoms with the O2 box
//   microbes - the bacteria double each pretend hour; grow enough to clean the tank
//   bones    - the bike plan for each month in zero g, under the bone limit
//
// Mouse: tap a ball, then a jar (or drag the ball into a jar); tap the +/- buttons.
// Keys: Tab moves between buttons (the browser's own focus), Enter or Space presses.
//
// Opens in the play-mode modal layer like the other cards and pauses the game
// through the bus's 'ui-modal'. Test hook while open:
// window.__tasks = { id, mode, state(), setMode(m), solve(), done() }.
import { el, openLayer } from '../../play/ui.js';
import { injectStyles } from '../../lesson/card.js';
import { t, LEVEL } from '../level.js';
import { CREW_INFO } from '../ch6/crewInfo.js';
import { skipButton } from '../../play/grownUp.js';
import {
  TASKS, modesFor, SPLIT, JAR_SIZE, PLANTS, MICROBES, BONES,
  kitchen, placeAtom, takeAtom, kitchenDone, splitBalanced, splitSmallest, splitCounts,
  oxygenIn, oxygenOut, oxygenInCo2, bubblesFrom, plantsBalanced, cellsAfter, boneLoss, boneStart,
  boneCfg, boneOk, bikeLeft, blocksLeft,
  taskAnswer, solved,
} from './tasksLogic.js';

const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);
const MODE_NAME = { easy: ['Easy', 'Easy'], medium: ['Medium', 'Medium'], hard: ['Hard', 'Hard'] };
/** The bike time a month is set to, in words. */
const bikeLabel = (h) => [t('no bike', 'no bike'), t('1 hour a day', '1 hour'), t('2 hours a day', '2 hours')][h];
const OXYGEN_PER_O2 = 2; // each O2 molecule has two O atoms

/** What each task says, per mode, as [Level 4, Level 1] (the hints never give the answer). */
const TIP = {
  split: {
    easy: ['Electricity splits each water molecule. Put every atom into a jar: hydrogen balls into H₂ jars, oxygen into O₂ jars, two to a jar.', 'Two H balls per H jar. Two O balls per O jar. Use every ball.'],
    medium: ['Now four water molecules. Same rule: every atom goes into a jar, two to a jar.', 'Four water molecules. Fill every jar, and use every ball.'],
    hard: ['Balance it. Same number of hydrogen and oxygen atoms in as out. Set the boxes, then check. Use the smallest whole numbers.', 'Make the atoms match on both sides. Use the smallest numbers.'],
  },
  plants: {
    easy: ['Light makes plants turn carbon dioxide and water into sugar and oxygen bubbles. Run the light and count until there is enough.', 'Each light run makes bubbles of oxygen. Count them, and get enough.'],
    medium: ['A bigger harvest: more light runs, more bubbles. Count by sixes.', 'More light runs. Count the bubbles in twos.'],
    hard: ['Balance the oxygen atoms. Count the O atoms going in and coming out. Make the two counts equal.', 'Make the oxygen atoms match on both sides.'],
  },
  microbes: {
    easy: ['Pretend hours: each hour, every bacterium splits in two. Clean the tank: 64 bacteria in 8 pretend hours at most.', 'Each pretend hour, every bacterium splits in two. Get 64 helpers.'],
    medium: ['Choose how many bacteria to start with, then the pretend hours. Clean the tank: 100 bacteria, in 8 pretend hours at most.', 'Get 100 helpers in 8 pretend hours.'],
    hard: ['Choose the starting bacteria and the pretend hours. Clean the tank: 1,000 bacteria, in 5 pretend hours at most.', 'Get 1,000 helpers in 5 pretend hours.'],
  },
  bones: {
    easy: ['In zero g bones get thinner, even with exercise. The crew shares one bike. Plan the bike so the bones stay strong.', 'No bike: bones get thinner. Plan the bike so you keep enough bone blocks.'],
    medium: ['One bike is shared by the crew, with 10 hours for the whole trip. Plan each month so the bones stay under the limit.', 'One bike, shared. Plan each month, and keep enough blocks.'],
    hard: ['Tight: only 9 bike hours for six months. Tap a month to change its bike time, and keep bones under the limit.', 'Tap a month to change its bike time.'],
  },
};

const CSS_ID = 'ch7-tasks-css';
const CSS = `
.tk-card { width: min(800px, 94vw); box-sizing: border-box; }
.tk-card .ls-btn:disabled { opacity: .4; cursor: not-allowed; }
.tk-modes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.tk-mode { min-height: 40px; padding: 0 14px; border-radius: 10px; border: 2px solid rgba(255,255,255,.2); background: #1a2540; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
.tk-mode.is-on { border-color: #7fd3ff; background: rgba(127,211,255,.18); }
.tk-body { display: grid; gap: 12px; margin-top: 10px; min-height: 240px; }
.tk-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tk-name { min-width: 9em; font-weight: 800; }
.tk-val { min-width: 5em; text-align: center; font-size: 18px; font-weight: 900; }
.tk-big { font-size: 20px; font-weight: 900; }
.tk-note { font-size: 15px; line-height: 1.45; color: #cfe8ff; }
.tk-warn { color: #ffd27a; font-weight: 800; }
.tk-good { color: #9fe8a8; font-weight: 800; }
.tk-step { min-width: 42px; min-height: 42px; padding: 0 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; font: inherit; font-weight: 900; cursor: pointer; touch-action: manipulation; }
.tk-step:disabled { opacity: .35; cursor: default; }
.tk-bar { position: relative; height: 16px; border-radius: 8px; background: rgba(255,255,255,.12); overflow: hidden; }
.tk-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: 8px; background: #7fd3ff; transition: width .2s; }
.tk-bar.is-over > i { background: #ff8a8a; }
.tk-bench { min-height: 52px; padding: 6px; border-radius: 12px; background: #0c1426; }
.tk-atom { width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(0,0,0,.35); font: inherit; font-weight: 900; font-size: 18px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.tk-atom.is-H { background: #f4f7ff; color: #1d2433; }
.tk-atom.is-O { background: #ff6b6b; color: #fff; }
.tk-atom.is-sel { outline: 3px solid #ffd27a; outline-offset: 2px; }
.tk-atom.is-drag { opacity: .5; }
.tk-jars { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.tk-jar { min-height: 96px; border-radius: 14px; border: 2px dashed rgba(255,255,255,.3); background: #141c33; color: inherit; font: inherit; font-weight: 800; cursor: pointer; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; padding: 8px; }
.tk-jar.is-full { border-style: solid; border-color: #9fe8a8; background: rgba(159,232,168,.12); }
.tk-jar-atoms { display: flex; gap: 6px; }
.tk-jar-atoms .tk-atom { width: 34px; height: 34px; font-size: 14px; }
.tk-slot { width: 34px; height: 34px; border-radius: 50%; border: 2px dotted rgba(255,255,255,.35); }
.tk-eq { letter-spacing: .02em; }
.tk-grid { display: grid; gap: 8px; }
.tk-dish { display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-height: 70px; padding: 10px; border-radius: 14px; background: #0c1426; }
.tk-dot { width: 12px; height: 12px; border-radius: 50%; background: #8ff0a0; }
.tk-bubble { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #cfe8ff; background: rgba(207,232,255,.25); }
.tk-pair { display: inline-flex; gap: 2px; margin-right: 12px; }
.tk-months { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.tk-month { min-height: 52px; padding: 6px 8px; border-radius: 12px; border: 2px solid rgba(255,255,255,.18); background: #1a2540; color: inherit; font: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
.tk-month.is-on { border-color: #ffd27a; }
`;
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
}

/** A round step button (for +/- and the mode boxes). */
function stepBtn(text, onClick) {
  const b = el('button', 'tk-step', text); b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Tap a ball, or drag it onto a jar. A press that moves more than a few pixels is
 * a drag; its drop is on the jar under the pointer (data-jar). A keyboard press
 * (detail 0) is a tap. Pointer capture keeps the release on the ball.
 */
function pickable(btn, onTap, onDrop) {
  let press = null;
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    press = { x: e.clientX, y: e.clientY, drag: false };
    try { btn.setPointerCapture(e.pointerId); } catch { /* not every browser */ }
  });
  btn.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { press.drag = true; btn.classList.add('is-drag'); }
  });
  btn.addEventListener('pointerup', (e) => {
    if (!press) return;
    const p = press; press = null;
    btn.classList.remove('is-drag');
    if (!p.drag) { onTap(); return; }
    const jar = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-jar]');
    if (jar) onDrop(Number(jar.dataset.jar));
  });
  btn.addEventListener('pointercancel', () => { press = null; btn.classList.remove('is-drag'); });
  btn.addEventListener('click', (e) => { if (e.detail === 0) onTap(); });
}

// --- the bodies ------------------------------------------------------------------------------
// Each returns { el, solve(), state(), refresh() }: state() is what solved() in
// tasksLogic.js judges, and refresh() redraws after every move (changed()).

/** Split, Easy and Medium: drag every atom into its molecule jar. */
function splitKitchen(mode, changed) {
  let k = kitchen(SPLIT.water[mode]);
  let sel = null;
  let problem = null;
  const wrap = el('div', 'tk-body');
  const count = el('div', 'tk-note');
  const bench = el('div', 'tk-row tk-bench');
  const jars = el('div', 'tk-jars');
  const note = el('div', 'tk-note');
  wrap.append(count, bench, jars, note);
  const place = (atom, jar) => {
    const r = placeAtom(k, atom, jar);
    problem = r.problem;
    if (!r.problem) { k = r.kitchen; sel = null; }
    changed();
  };
  const take = (atom) => { k = takeAtom(k, atom); sel = null; problem = null; changed(); };
  const name = (a) => (a[0] === 'H' ? t('hydrogen', 'hydrogen') : t('oxygen', 'oxygen'));
  function refresh() {
    const h = k.bench.filter((a) => a[0] === 'H').length;
    count.textContent = t(`Atoms on the bench: ${h} hydrogen (H) and ${k.bench.length - h} oxygen (O).`, `Balls on the bench: ${h} H and ${k.bench.length - h} O.`);
    bench.replaceChildren();
    for (const a of k.bench) {
      const b = el('button', `tk-atom is-${a[0]}${sel === a ? ' is-sel' : ''}`, a[0]);
      b.type = 'button'; b.setAttribute('aria-label', `${name(a)} ball`);
      pickable(b, () => { sel = sel === a ? null : a; problem = null; changed(); }, (j) => place(a, j));
      bench.append(b);
    }
    if (!k.bench.length) bench.append(el('span', 'tk-note', t('Nothing left on the bench.', 'All the balls are in!')));
    jars.replaceChildren();
    k.jars.forEach((jar, i) => {
      // A div, not a button: its balls are buttons, and a button cannot hold buttons.
      const b = el('div', `tk-jar${jar.atoms.length === JAR_SIZE ? ' is-full' : ''}`);
      b.tabIndex = 0; b.setAttribute('role', 'button'); b.dataset.jar = String(i);
      const inside = el('span', 'tk-jar-atoms');
      for (const a of jar.atoms) {
        const ab = el('button', `tk-atom is-${a[0]}`, a[0]); ab.type = 'button';
        ab.title = t('Take it back to the bench', 'Take it back');
        ab.addEventListener('click', (e) => { e.stopPropagation(); take(a); });
        inside.append(ab);
      }
      for (let n = jar.atoms.length; n < JAR_SIZE; n++) inside.append(el('span', 'tk-slot'));
      b.append(el('span', null, jar.kind === 'H' ? t('H₂ jar (2 hydrogen)', 'H₂ jar') : t('O₂ jar (2 oxygen)', 'O₂ jar')), inside);
      b.addEventListener('click', () => { if (sel) place(sel, i); });
      b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && sel) { e.preventDefault(); place(sel, i); } });
      jars.append(b);
    });
    note.className = `tk-note${problem ? ' tk-warn' : kitchenDone(k) ? ' tk-good' : ''}`;
    note.textContent = problem === 'kind' ? t('Hydrogen balls go in the H₂ jars, and oxygen balls in the O₂ jars.', 'H balls go in H jars. O balls go in O jars.')
      : problem === 'full' ? t('That jar is full: two atoms make one molecule. Try another jar.', 'That jar is full. Try another one.')
        : sel ? t(`Now tap a jar for the ${name(sel)} ball, or drag it in.`, 'Now tap a jar.')
          : kitchenDone(k) ? t('Every atom is in a molecule, and none is lost. The water is split!', 'All in, and none lost!')
            : t('Tap a ball, then a jar with the same letter (or drag it in). Use every ball.', 'Tap a ball, then its jar. Use every ball.');
  }
  return {
    el: wrap, state: () => k,
    solve() { for (const [a, j] of taskAnswer('split', mode)) k = placeAtom(k, a, j).kitchen; sel = null; problem = null; changed(); },
    refresh,
  };
}

/** Split, Hard: the boxes of 2 H2O -> 2 H2 + O2, balanced with the smallest whole numbers. */
function splitBalance(changed) {
  const eq = { water: 1, h2: 1, o2: 1 };
  const wrap = el('div', 'tk-body');
  const line = el('div', 'tk-big tk-eq');
  const rows = [['water', t('Water molecules in (H₂O)', 'Water in')], ['h2', t('Hydrogen molecules out (H₂)', 'H₂ out')], ['o2', t('Oxygen molecules out (O₂)', 'O₂ out')]];
  const grid = el('div', 'tk-grid');
  const ctl = {};
  for (const [key, label] of rows) {
    const less = stepBtn('−', () => { eq[key] = Math.max(1, eq[key] - 1); changed(); });
    const more = stepBtn('+', () => { eq[key] = Math.min(SPLIT.max, eq[key] + 1); changed(); });
    const val = el('span', 'tk-val');
    const row = el('div', 'tk-row'); row.append(el('span', 'tk-name', label), less, val, more);
    grid.append(row);
    ctl[key] = { less, more, val };
  }
  const counts = el('div', 'tk-note'); const note = el('div', 'tk-note');
  wrap.append(line, grid, counts, note);
  function refresh() {
    line.textContent = `${eq.water} H₂O → ${eq.h2} H₂ + ${eq.o2} O₂`;
    for (const [key] of rows) {
      ctl[key].val.textContent = String(eq[key]);
      ctl[key].less.disabled = eq[key] <= 1; ctl[key].more.disabled = eq[key] >= SPLIT.max;
    }
    const c = splitCounts(eq);
    counts.textContent = t(`Hydrogen atoms: ${c.inH} in, ${c.outH} out. Oxygen atoms: ${c.inO} in, ${c.outO} out.`, `Hydrogen: ${c.inH} in, ${c.outH} out. Oxygen: ${c.inO} in, ${c.outO} out.`);
    const small = splitSmallest(eq);
    note.className = `tk-note${small ? ' tk-good' : ' tk-warn'}`;
    note.textContent = small ? t('Balanced, with the smallest whole numbers! Every atom is counted.', 'Balanced! Every atom is counted.')
      : splitBalanced(eq) ? t('Balanced, but the numbers can be smaller. Can you halve them all?', 'Balanced! Can the numbers be smaller?')
        : t('Not balanced yet: the same number of hydrogen and oxygen atoms must go in and come out.', 'Not balanced: the atoms must match.');
  }
  return {
    el: wrap, state: () => ({ ...eq }),
    solve() { Object.assign(eq, taskAnswer('split', 'hard')); changed(); },
    refresh,
  };
}

/** Plants, Easy and Medium: run the light, count the bubbles of oxygen. */
function plantsLight(mode, changed) {
  const target = PLANTS.targets[mode];
  let runs = 0;
  const wrap = el('div', 'tk-body');
  const less = stepBtn('−', () => { runs = Math.max(0, runs - 1); changed(); });
  const more = stepBtn('+', () => { runs = Math.min(PLANTS.maxRuns, runs + 1); changed(); });
  const runN = el('span', 'tk-val');
  const dial = el('div', 'tk-row'); dial.append(el('span', 'tk-name', t('Light runs', 'Light runs')), less, runN, more);
  const bubbles = el('div', 'tk-dish');
  const readout = el('div', 'tk-big');
  const bar = el('div', 'tk-bar'); const fill = el('i'); bar.append(fill);
  const note = el('div', 'tk-note');
  wrap.append(dial, bubbles, readout, bar, note);
  function refresh() {
    const made = bubblesFrom(runs);
    runN.textContent = String(runs);
    less.disabled = runs <= 0; more.disabled = runs >= PLANTS.maxRuns;
    bubbles.replaceChildren();
    // Level 1 counts in twos: the bubbles come in pairs.
    if (LEVEL === 1) {
      for (let i = 0; i < made; i += 2) {
        const pair = el('span', 'tk-pair');
        pair.append(el('span', 'tk-bubble'));
        if (i + 1 < made) pair.append(el('span', 'tk-bubble'));
        bubbles.append(pair);
      }
    } else {
      for (let i = 0; i < made; i++) bubbles.append(el('span', 'tk-bubble'));
    }
    readout.textContent = t(`Oxygen bubbles: ${made} / ${target}`, `Bubbles: ${made} / ${target}`);
    fill.style.width = `${Math.min(100, (100 * made) / target)}%`;
    bar.className = 'tk-bar';
    note.className = `tk-note${made >= target ? ' tk-good' : ''}`;
    note.textContent = made >= target ? t(`Enough oxygen for the crew: ${made} bubbles! Each run gave ${PLANTS.bubbles}.`, `Enough bubbles! ${made} of them.`)
      : runs === 0 ? t(`Turn the light on. Each run takes in ${PLANTS.co2} carbon dioxide and ${PLANTS.h2o} water, and gives ${PLANTS.bubbles} bubbles.`, 'Turn the light on. Each run makes 6 bubbles.')
        : t(`Keep going: ${target - made} more bubbles to go.`, `Keep going: ${target - made} more to go.`);
  }
  return {
    el: wrap, state: () => runs,
    solve() { runs = taskAnswer('plants', mode); changed(); },
    refresh,
  };
}

/** Plants, Hard: balance the oxygen atoms with the O2 box. */
function plantsBalance(changed) {
  let o2 = 0;
  const wrap = el('div', 'tk-body');
  const line = el('div', 'tk-big tk-eq');
  const less = stepBtn('−', () => { o2 = Math.max(0, o2 - 1); changed(); });
  const more = stepBtn('+', () => { o2 = Math.min(PLANTS.maxO2, o2 + 1); changed(); });
  const val = el('span', 'tk-val');
  const dial = el('div', 'tk-row'); dial.append(el('span', 'tk-name', t('Oxygen molecules out (O₂)', 'O₂ out')), less, val, more);
  const counts = el('div', 'tk-note'); const note = el('div', 'tk-note');
  wrap.append(line, dial, counts, note);
  function refresh() {
    line.textContent = `${PLANTS.co2} CO₂ + ${PLANTS.h2o} H₂O → sugar + ${o2} O₂`;
    val.textContent = String(o2);
    less.disabled = o2 <= 0; more.disabled = o2 >= PLANTS.maxO2;
    counts.textContent = t(`Oxygen atoms in: ${oxygenIn()}. Out: ${oxygenOut(o2)}.`, `Oxygen in: ${oxygenIn()}. Oxygen out: ${oxygenOut(o2)}.`);
    const ok = plantsBalanced(o2);
    note.className = `tk-note${ok ? ' tk-good' : ' tk-warn'}`;
    note.textContent = ok ? t('Balanced! Every oxygen atom is counted, and none is lost.', 'Balanced! Every oxygen atom is counted.')
      : oxygenOut(o2) < oxygenIn() ? t('Not enough oxygen atoms out yet: add O₂ molecules.', 'Too few out: add O₂.')
        : t('Too many oxygen atoms out: take some O₂ molecules away.', 'Too many out: take some away.');
  }
  return {
    el: wrap, state: () => o2,
    solve() { o2 = taskAnswer('plants', 'hard'); changed(); },
    refresh,
  };
}

/** Microbes: pick the start (where there is a choice) and the pretend hours; the dish shows the doubling. */
function microbeDish(mode, changed) {
  const cfg = MICROBES.modes[mode];
  let si = 0; let hours = 0;
  const wrap = el('div', 'tk-body');
  const sLess = stepBtn('−', () => { si = Math.max(0, si - 1); changed(); });
  const sMore = stepBtn('+', () => { si = Math.min(cfg.starts.length - 1, si + 1); changed(); });
  const sVal = el('span', 'tk-val');
  const startRow = el('div', 'tk-row');
  startRow.append(el('span', 'tk-name', t('Start with', 'Start with')), sLess, sVal, sMore);
  const hLess = stepBtn('−', () => { hours = Math.max(0, hours - 1); changed(); });
  const hMore = stepBtn('+', () => { hours = Math.min(cfg.hours, hours + 1); changed(); });
  const hVal = el('span', 'tk-val');
  const hourRow = el('div', 'tk-row');
  hourRow.append(el('span', 'tk-name', t('Pretend hours', 'Pretend hours')), hLess, hVal, hMore);
  const dish = el('div', 'tk-dish');
  const readout = el('div', 'tk-big');
  const seq = el('div', 'tk-note');
  const note = el('div', 'tk-note');
  wrap.append(startRow, hourRow, dish, readout, seq, note);
  function refresh() {
    const start = cfg.starts[si];
    sVal.textContent = `${start} ${start === 1 ? t('bacterium', 'bacterium') : t('bacteria', 'bacteria')}`;
    startRow.style.display = cfg.starts.length > 1 ? '' : 'none';
    sLess.disabled = si <= 0; sMore.disabled = si >= cfg.starts.length - 1;
    hVal.textContent = `${hours} / ${cfg.hours}`;
    hLess.disabled = hours <= 0; hMore.disabled = hours >= cfg.hours;
    const n = cellsAfter(start, hours);
    dish.replaceChildren();
    if (n <= 64) for (let i = 0; i < n; i++) dish.append(el('span', 'tk-dot'));
    else dish.append(el('span', 'tk-note', t('lots and lots!', 'lots!')));
    readout.textContent = t(`Bacteria now: ${n}. Clean the tank at ${cfg.target}.`, `Bacteria: ${n}. Goal: ${cfg.target}.`);
    const row = [];
    for (let h = 0; h <= Math.min(hours, 9); h++) row.push(cellsAfter(start, h));
    seq.textContent = t(`Each pretend hour, every bacterium splits in two: ${row.join(' → ')}`, `Each pretend hour it doubles: ${row.join(' → ')}`);
    const done = n >= cfg.target;
    note.className = `tk-note${done ? ' tk-good' : hours >= cfg.hours ? ' tk-warn' : ''}`;
    note.textContent = done ? t('Clean! The helpers have made enough bacteria to clean the tank.', 'Clean! Enough helpers.')
      : hours >= cfg.hours ? t('Out of pretend hours! Start with more bacteria, or start again.', 'Out of hours! Try more bacteria.')
        : t('Press + for the next pretend hour. Clean the tank before the hours run out.', 'Press + for the next hour.');
  }
  return {
    el: wrap, state: () => ({ start: cfg.starts[si], hours }),
    solve() { const a = taskAnswer('microbes', mode); si = cfg.starts.indexOf(a.start); hours = a.hours; changed(); },
    refresh,
  };
}

/**
 * Bones: one bike shared by the crew. Each month gets 0, 1 or 2 bike hours, and the
 * coast has a total to spend. Level 4 counts the bone lost in percent (the numbers
 * are simplified); Level 1 counts whole bone blocks out of 10, and keeps at least
 * some of them.
 */
function bonesYear(mode, changed) {
  const cfg = boneCfg(mode, LEVEL);
  let plan = boneStart(mode, LEVEL);
  const wrap = el('div', 'tk-body');
  const bike = el('div', 'tk-big');
  const months = el('div', 'tk-months');
  const monthBtns = plan.map((_, i) => {
    const b = el('button', 'tk-month'); b.type = 'button';
    b.addEventListener('click', () => { plan[i] = (plan[i] + 1) % BONES.hours.length; changed(); });
    months.append(b);
    return b;
  });
  const readout = el('div', 'tk-big');
  const bar = el('div', 'tk-bar'); const fill = el('i'); bar.append(fill);
  const note = el('div', 'tk-note');
  wrap.append(bike, months, readout, bar, note);
  const blockLoss = (h) => BONES.blocks.lossBlocks[h];
  function refresh() {
    const left = bikeLeft(mode, plan, LEVEL);
    bike.textContent = t(`Bike hours left for the crew: ${left} of ${cfg.budget}`, `Bike hours left: ${left} of ${cfg.budget}`);
    plan.forEach((h, i) => {
      const loss = LEVEL === 1
        ? (blockLoss(h) ? `−${blockLoss(h)} ${blockLoss(h) === 1 ? 'block' : 'blocks'}` : 'no loss')
        : `−${BONES.lossTenths[h] / 10}%`;
      monthBtns[i].textContent = `${t('Month', 'Month')} ${i + 1}: ${bikeLabel(h)} (${loss})`;
      monthBtns[i].className = `tk-month${h ? ' is-on' : ''}`;
    });
    const ok = boneOk(mode, plan, LEVEL);
    if (LEVEL === 1) {
      const kept = blocksLeft(plan);
      readout.textContent = t(`Bone blocks left: ${kept} of ${BONES.blocks.start}`, `Bone blocks: ${kept} of ${BONES.blocks.start}`);
      fill.style.width = `${Math.max(0, Math.min(100, (100 * kept) / BONES.blocks.start))}%`;
      bar.className = `tk-bar${ok ? '' : ' is-over'}`;
    } else {
      const lost = boneLoss(plan) / 10; const limit = cfg.limit / 10;
      readout.textContent = t(`Bone lost on the trip: ${lost}% (the limit is ${limit}%). The numbers are simplified.`, `Lost: ${lost}% (limit ${limit}%)`);
      fill.style.width = `${Math.min(100, (100 * lost) / (limit * 1.5))}%`;
      bar.className = `tk-bar${boneLoss(plan) / 10 <= limit ? '' : ' is-over'}`;
    }
    note.className = `tk-note${ok ? ' tk-good' : ' tk-warn'}`;
    note.textContent = ok ? t('Safe! The bike is shared well, and the bones stay strong for the whole trip.', 'Safe! Strong bones.')
      : left < 0 ? t('Too many bike hours! The crew has only this many to share. Tap a month to take some away.', 'Too many bike hours. Take some away.')
        : LEVEL === 1 ? t(`Keep at least ${cfg.keep} blocks. No bike loses 2 blocks a month, one hour loses 1, two hours lose none.`, `Keep at least ${cfg.keep} blocks!`)
          : t(`Too much lost. Tap a month: no bike loses ${BONES.lossTenths[0] / 10}% a month, one hour loses ${BONES.lossTenths[1] / 10}%, two hours slow it to ${BONES.lossTenths[2] / 10}% (simplified).`, 'Too much lost. Add bike time.');
  }
  return {
    el: wrap, state: () => plan.slice(),
    solve() { plan = taskAnswer('bones', mode, LEVEL); changed(); },
    refresh,
  };
}

function makeBody(id, mode, changed) {
  if (id === 'split') return mode === 'hard' ? splitBalance(changed) : splitKitchen(mode, changed);
  if (id === 'plants') return mode === 'hard' ? plantsBalance(changed) : plantsLight(mode, changed);
  if (id === 'microbes') return microbeDish(mode, changed);
  return bonesYear(mode, changed);
}

/**
 * Play one room task.
 * @param {string} id one of TASKS' ids
 * @returns {Promise<{id:string, mode:string, moves:number}>}
 */
export function playTask(id, { bus = null } = {}) {
  injectStyles(); injectCss();
  const info = TASKS.find((x) => x.id === id);
  if (!info) throw new Error(`no task ${id}`);
  const lead = CREW_INFO[info.lead];
  const modes = modesFor(LEVEL);
  const card = el('div', 'pl-card ls-card tk-card');
  card.dataset.game = `task-${id}`;
  const eyebrow = el('div', 'pl-eyebrow', `${lead.name} · ${pick(lead.job)}`);
  eyebrow.style.color = lead.color;
  const title = el('h2', 'pl-title', pick(info.title));
  const tip = el('p', 'ls-line');
  const modeRow = el('div', 'tk-modes');
  const modeBtns = {};
  for (const m of modes) {
    const b = el('button', 'tk-mode', pick(MODE_NAME[m])); b.type = 'button';
    b.addEventListener('click', () => setMode(m));
    modeRow.append(b);
    modeBtns[m] = b;
  }
  const bodyBox = el('div');
  const actions = el('div', 'ls-actions');
  const retryBtn = el('button', 'ls-btn ls-btn--ghost', t('Start again', 'Start again')); retryBtn.type = 'button';
  const doneBtn = el('button', 'ls-btn', t('Done ✓', 'Done ✓')); doneBtn.type = 'button';
  actions.append(el('div', 'ls-dots'), retryBtn, doneBtn);
  card.append(eyebrow, title, modeRow, tip, bodyBox, actions);

  let mode = modes[0];
  let body = null;
  let moves = 0;
  let closed = false;
  let finishFn;
  const done = new Promise((r) => { finishFn = r; });
  const changed = () => { moves++; body.refresh(); paint(); };
  const ok = () => solved(id, mode, body.state(), LEVEL);
  function build() {
    body = makeBody(id, mode, changed);
    bodyBox.replaceChildren(body.el);
    body.refresh();
    paint();
  }
  function setMode(m) {
    if (!modes.includes(m) || m === mode) return;
    mode = m; build();
  }
  function paint() {
    for (const m of modes) modeBtns[m].classList.toggle('is-on', m === mode);
    tip.textContent = pick(TIP[id][mode]);
    const solvedNow = ok();
    doneBtn.disabled = !solvedNow;
    doneBtn.classList.toggle('is-ready', solvedNow);
  }
  const layer = openLayer(card, {
    onKey(e) { if (e.key === 'Enter' && ok() && document.activeElement === doneBtn) finish(); },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }
  function finish() {
    if (closed || !ok()) return;
    closed = true;
    layer.close();
    if (window.__tasks === api) delete window.__tasks;
    finishFn({ id, mode, moves });
  }
  retryBtn.addEventListener('click', () => { moves = 0; build(); });
  doneBtn.addEventListener('click', finish);
  const api = {
    id,
    get mode() { return mode; },
    get open() { return !closed; },
    state: () => ({ id, mode, ok: ok(), state: body.state() }),
    setMode(m) { setMode(m); return mode; },
    solve() { body.solve(); return ok(); },
    done() { finish(); return closed; },
  };
  window.__tasks = api;
  // Unlock mode only: a grown-up can skip the task.
  const skip = skipButton(() => { api.solve(); finish(); }, 'ls-btn ls-btn--ghost');
  if (skip) actions.prepend(skip);
  build();
  return done;
}

