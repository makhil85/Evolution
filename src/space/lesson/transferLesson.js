// Flight school: an animated lesson on orbit transfers, played between the
// satellite wing repair (a1_satellite_fix) and the burn to the Moon
// (a1_raise). Four short films (transferScenes.js), each with Replay / Next,
// Mission Control narrating underneath, then ONE 3-choice question about what
// the film showed.
//
// Question rule (lead): two tries. A right answer gets a cheer; a second miss
// shows the right answer with a short explanation and carries on. No restart,
// no penalty: it is a lesson, not a test.
//
//   import { playTransferLesson, lessonStep } from '../lesson/transferLesson.js';
//   await playTransferLesson(game);      // -> { results: [{ id, correct, tries }] }
//   steps: [..., lessonStep(game), ...]  // id 'a1_lesson', act 1
//
// It opens in the HUD's shared modal host (game.hud._modalHost), so the bus
// gets 'ui-modal' true/false (controls and the sim pause) and the autopilot
// waits (it waits while `.sp-modal button` exists; Replay is always there).
//
// The animation runs off the wall clock, ticked by rAF and a timer (a hidden tab
// draws no rAF frames), and can be driven by hand. Test hook while it is
// open: window.__space.lesson = { skip(), answerAll(), next(), film(i), seek(t),
// step(dt), pause(on), state(), shot(name) }; and the right answer's button
// carries data-correct="1".
import { t } from '../level.js';
import { heroName } from '../hud/hud.js';
import { buildFilms, filmLength, clipAt, drawFrame } from './transferScenes.js';

const TICK_MS = 50;      // timer tick (backs up rAF; a hidden tab draws no rAF frames)
const FADE_S = 0.35;

// --- the questions (one per film) ----------------------------------------------------

function questions() {
  // Level 4 choices are kept about the same length, so the longest is not a giveaway.
  return [
    {
      prompt: t('When the ship pointed straight at the Moon and held W, what happened?', 'The ship pointed at the Moon and held W. What happened?'),
      choices: [
        { text: t('It flew in a straight line all the way to the Moon', 'It flew right to the Moon') },
        { text: t('Its path turned into a lopsided oval that missed', 'It missed the Moon'), correct: true },
        { text: t('It stopped and hung still in space, right where it was', 'It stopped') },
      ],
      hint: t('Look at the dotted line after the burn. Did it reach the Moon?', 'Did the dotted line get to the Moon?'),
      why: t('You are already zooming sideways round Earth, so a push towards the Moon only bends your circle into a lopsided oval. And the Moon keeps moving, too.', 'You are already zooming sideways. A push at the Moon just bends your path.'),
    },
    {
      prompt: t('To stretch your orbit out to the Moon, which way should the nose point while you hold W?', 'Which way should the nose point to make your orbit bigger?'),
      choices: [
        { text: t('Straight at the Moon, the place you want to go', 'At the Moon') },
        { text: t('Backwards, opposite to the way you’re moving', 'Face the way you came') },
        { text: t('Along your path, the way you’re already going', 'Forward, the way you are going'), correct: true },
      ],
      hint: t('Which way did the nose point when the circle stretched into a long oval?', 'Which way did the nose point when the oval grew?'),
      why: t('The engine pushes you the way the nose points. Pushing along your path speeds you up, and the faster you go, the bigger your orbit gets.', 'Pushing forward makes you faster. Faster means a bigger orbit!'),
    },
    {
      prompt: t('Why do we go round and wait before we burn?', 'Why do we wait before we hold W?'),
      choices: [
        { text: t('So the Moon is in the right place when we arrive', 'So the Moon is there when we get there'), correct: true },
        { text: t('To give the engine time to cool down before the burn', 'To let the engine rest') },
        { text: t('To wait until the fuel tank has filled up again', 'To get more fuel') },
      ],
      hint: t('What went wrong when the ship burned too early?', 'What happened when we went too early?'),
      why: t('The trip takes time and the Moon keeps moving. The burn window is the moment that makes you and the Moon arrive together.', 'The Moon keeps moving. We burn at the right time to meet it.'),
    },
    {
      prompt: t('You arrive at the Moon too fast. How do you slow down so the Moon can catch you?', 'You get to the Moon too fast. How do you slow down?'),
      choices: [
        { text: t('Point straight at the Moon and hold W until you land on it', 'Point at the Moon and hold W') },
        { text: t('Keep pointing forward, along your path, and hold W even longer', 'Point forward and hold W') },
        { text: t('Point backwards (opposite to the way you’re moving), hold W', 'Face the way you came and hold W'), correct: true },
      ],
      hint: t('Which way did the nose point when the ship got caught?', 'Which way did the ship face when it got caught?'),
      why: t('Pointing backwards, the engine pushes against your speed and slows you down: a retrograde burn. Slow enough, and the Moon’s gravity catches you into orbit.', 'Facing the way you came slows you down. Then the Moon’s gravity catches you!'),
    },
  ];
}

const CHEERS = () => [
  t(`Yes! Great thinking, ${heroName()}!`, `Yes! Well done, ${heroName()}!`),
  t('Spot on!', 'You got it!'),
  t('Exactly right, space pilot!', 'Super! That’s right!'),
  t(`Brilliant, ${heroName()}!`, 'Hooray! Right!'),
];

// --- styles (scoped to the lesson card) ------------------------------------------------

const STYLE_ID = 'sp-lesson-style';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.sp-hud .sp-modal__card.sp-lesson { width: min(980px, 100%); padding: 18px 22px 20px; }
.sp-hud .sp-lesson .sp-modal__title { margin-bottom: 10px; }
.sp-hud .sp-lesson__stage { display: grid; grid-template-columns: 1fr; gap: 12px; }
.sp-hud .sp-lesson__view { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--sp-line-strong); background: #120d16; }
.sp-hud .sp-lesson__canvas { display: block; width: 100%; height: clamp(240px, 54vh, 470px); }
.sp-hud .sp-lesson__who { font-size: calc(10.8px * var(--hud-scale)); font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--sp-amber); margin-bottom: 4px; }
.sp-hud .sp-lesson__talk { min-height: 3.2em; }
.sp-hud .sp-lesson__line { font-size: calc(14px * var(--hud-scale)); line-height: 1.45; color: var(--sp-text); }
.sp-hud .sp-lesson__dots { display: flex; gap: 6px; align-items: center; }
.sp-hud .sp-lesson__dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.2); }
.sp-hud .sp-lesson__dot.is-done { background: var(--sp-good); }
.sp-hud .sp-lesson__dot.is-active { background: var(--sp-accent); box-shadow: 0 0 0 3px var(--sp-accent-soft); }
.sp-hud .sp-lesson .sp-modal__actions { align-items: center; margin-top: 14px; }
.sp-hud .sp-lesson .sp-modal__actions .sp-lesson__dots { margin-right: auto; }
.sp-hud .sp-lesson__q[hidden] { display: none; }
.sp-hud .sp-lesson__prompt { font-size: calc(13.8px * var(--hud-scale)); font-weight: 800; line-height: 1.4; margin: 0; }
.sp-hud .sp-lesson .sp-choices { margin-top: 10px; gap: 8px; }
.sp-hud .sp-lesson .sp-choice { padding: 11px 14px; min-height: 44px; }
.sp-hud .sp-lesson .sp-choice:disabled { cursor: default; }
.sp-hud .sp-lesson .sp-feedback { margin-top: 10px; }
.sp-hud .sp-lesson.is-asking .sp-lesson__stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: start; }
.sp-hud .sp-lesson.is-asking .sp-lesson__canvas { height: clamp(200px, 40vh, 340px); }
.sp-hud .sp-lesson.is-asking .sp-lesson__talk { display: none; }
.sp-hud .sp-lesson__cheer { display: inline-block; margin-right: 6px; color: var(--sp-amber); animation: sp-lesson-pop 520ms cubic-bezier(.2,1.6,.4,1) 1; }
.sp-hud .sp-lesson .sp-feedback.is-good { animation: sp-lesson-pop 420ms ease-out 1; }
.sp-hud .sp-lesson .sp-btn.is-ready { animation: sp-lesson-ready 1.4s ease-in-out infinite; }
@keyframes sp-lesson-pop { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes sp-lesson-ready { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,120,71,.55); } 50% { box-shadow: 0 0 0 7px rgba(255,120,71,0); } }
@media (max-width: 900px) {
  .sp-hud .sp-lesson.is-asking .sp-lesson__stage { grid-template-columns: 1fr; }
  .sp-hud .sp-lesson.is-asking .sp-lesson__canvas { height: clamp(160px, 28vh, 240px); }
}
@media (prefers-reduced-motion: reduce) {
  .sp-hud .sp-lesson__cheer, .sp-hud .sp-lesson .sp-feedback.is-good, .sp-hud .sp-lesson .sp-btn.is-ready { animation: none; }
}`;
  document.head.appendChild(st);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** The HUD's shared modal (pauses the game via the bus), or a stand-in. */
function modalHost(game) {
  const host = game?.hud?._modalHost;
  if (host?.open) return host;
  // Stand-in (a page without the Chapter 4 HUD): same classes, so the same look.
  const root = el('div', 'sp-hud');
  const backdrop = el('div', 'sp-modal is-open');
  const card = el('div', 'sp-modal__card');
  backdrop.appendChild(card); root.appendChild(backdrop); document.body.appendChild(root);
  return {
    open(build, opts = {}) { card.className = `sp-modal__card${opts.wide ? ' is-wide' : ''}`; build(card); return card; },
    close() { root.remove(); },
  };
}

// --- the lesson ------------------------------------------------------------------------

let current = null; // the one lesson that can be open

/**
 * Play the whole lesson. Resolves when the child presses the last button.
 * @returns {Promise<{results: {id: string, correct: boolean, tries: number}[]}>}
 */
export function playTransferLesson(game = window.__space) {
  if (current) return current.promise;
  injectStyles();
  const films = buildFilms();
  const qs = questions();
  const results = [];
  let resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });

  let filmIx = 0;
  let mode = 'watch';      // 'watch' | 'ask'
  let time = 0;            // real seconds into the current film
  let playing = true;
  let seenEnd = false;     // Next unlocks once the film has played to the end
  let held = false;        // test hook: stop the wall clock
  let userPaused = false;  // the Pause button
  let testDriven = false;  // a test has driven the clock by hand: run even unseen
  let everFrame = false;   // a rAF frame has been drawn (a real, visible screen)
  let lastFrameAt = 0;
  let lastNow = performance.now();
  let clock = 0;
  let q = null;            // { tries, done }
  let lastCaption = '';
  let timer = 0;
  const cheers = CHEERS();

  const host = modalHost(game);
  let ui = null;
  const card = host.open((root) => {
    root.classList.add('sp-lesson');
    const eyebrow = el('div', 'sp-modal__eyebrow');
    const title = el('h3', 'sp-modal__title');
    const stage = el('div', 'sp-lesson__stage');
    const view = el('div', 'sp-lesson__view');
    const canvas = el('canvas', 'sp-lesson__canvas');
    canvas.setAttribute('role', 'img');
    view.appendChild(canvas);
    const side = el('div', 'sp-lesson__side');
    const talk = el('div', 'sp-lesson__talk');
    talk.append(el('div', 'sp-lesson__who', 'Mission Control'), el('div', 'sp-lesson__line'));
    talk.setAttribute('aria-live', 'polite');
    const qBox = el('div', 'sp-lesson__q');
    qBox.hidden = true;
    const qWho = el('div', 'sp-lesson__who', t('Mission Control asks', 'Question'));
    const prompt = el('p', 'sp-lesson__prompt');
    const choices = el('div', 'sp-choices');
    const feedback = el('div', 'sp-feedback');
    feedback.hidden = true;
    feedback.setAttribute('role', 'status');
    qBox.append(qWho, prompt, choices, feedback);
    side.append(talk, qBox);
    stage.append(view, side);
    const actions = el('div', 'sp-modal__actions');
    const dots = el('div', 'sp-lesson__dots');
    films.forEach(() => dots.appendChild(el('span', 'sp-lesson__dot')));
    const pauseBtn = el('button', 'sp-btn sp-btn--ghost sp-lesson__pause', '');
    pauseBtn.type = 'button';
    const replay = el('button', 'sp-btn sp-btn--ghost', `↻ ${t('Replay', 'Watch again')}`);
    replay.type = 'button';
    const next = el('button', 'sp-btn', 'Next');
    next.type = 'button';
    actions.append(dots, pauseBtn, replay, next);
    root.append(eyebrow, title, stage, actions);
    ui = { root, eyebrow, title, canvas, line: talk.querySelector('.sp-lesson__line'), qBox, prompt, choices, feedback, dots, replay, next, pauseBtn };
    replay.addEventListener('click', () => { time = 0; playing = true; setPaused(false); render(); });
    pauseBtn.addEventListener('click', () => setPaused(!userPaused));
    next.addEventListener('click', onNext);
  }, { wide: true });

  function setPaused(on) {
    userPaused = !!on;
    ui.pauseBtn.textContent = userPaused ? `▶ ${t('Play', 'Play')}` : `❚❚ ${t('Pause', 'Pause')}`;
    ui.pauseBtn.setAttribute('aria-pressed', String(userPaused));
  }

  function setFilm(i) {
    filmIx = i;
    mode = 'watch';
    time = 0; playing = true; seenEnd = false; q = null; lastCaption = '';
    setPaused(false);
    const film = films[i];
    ui.root.classList.remove('is-asking');
    ui.eyebrow.textContent = `${t('Flight school', 'Flight school')} · ${i + 1} ${t('of', 'of')} ${films.length}`;
    ui.title.textContent = film.title;
    ui.qBox.hidden = true;
    ui.next.textContent = 'Next';
    ui.next.disabled = true;
    ui.next.hidden = false;
    ui.next.classList.remove('is-ready');
    ui.canvas.setAttribute('aria-label', film.title);
    [...ui.dots.children].forEach((d, k) => { d.className = `sp-lesson__dot${k < i ? ' is-done' : k === i ? ' is-active' : ''}`; });
    render();
  }

  function startQuestion() {
    mode = 'ask';
    const qq = qs[filmIx];
    q = { tries: 0, done: false };
    ui.root.classList.add('is-asking');
    ui.qBox.hidden = false;
    ui.prompt.textContent = qq.prompt;
    ui.choices.textContent = '';
    ui.choices.classList.remove('is-done');
    ui.feedback.hidden = true;
    for (const c of qq.choices) {
      const b = el('button', 'sp-choice', c.text);
      b.type = 'button';
      if (c.correct) b.dataset.correct = '1';
      b.addEventListener('click', () => grade(c, b));
      ui.choices.appendChild(b);
    }
    ui.next.hidden = true;
    ui.next.classList.remove('is-ready');
    setTimeout(() => { try { ui.choices.querySelector('button')?.focus(); } catch { /* closed */ } }, 0);
    render();
  }

  function feedback(kind, parts) {
    ui.feedback.className = `sp-feedback is-${kind}`;
    ui.feedback.textContent = '';
    for (const p of parts) ui.feedback.append(p);
    ui.feedback.hidden = false;
  }

  function grade(choice, btn) {
    if (!q || q.done) return;
    const qq = qs[filmIx];
    q.tries += 1;
    if (choice.correct) {
      q.done = true;
      btn.classList.add('is-right');
      ui.choices.classList.add('is-done');
      const star = el('span', 'sp-lesson__cheer', '★');
      feedback('good', [star, el('b', null, `${cheers[filmIx % cheers.length]} `), qq.why]);
      results[filmIx] = { id: films[filmIx].id, correct: true, tries: q.tries };
      showNextAfterQuestion();
      return;
    }
    btn.classList.add('is-wrong');
    btn.disabled = true; // picked once: a double-click can't spend the second try
    btn.classList.remove('is-shake'); void btn.offsetWidth; btn.classList.add('is-shake');
    if (q.tries >= 2) {
      q.done = true;
      ui.choices.classList.add('is-done');
      ui.choices.querySelector('[data-correct="1"]')?.classList.add('is-right');
      const right = qq.choices.find((c) => c.correct).text;
      feedback('warn', [el('b', null, `${t('Good try! The answer is:', 'Good try! The answer is:')} ${right}. `), qq.why]);
      results[filmIx] = { id: films[filmIx].id, correct: false, tries: q.tries };
      showNextAfterQuestion();
      return;
    }
    feedback('warn', [`${t('Not quite.', 'Not quite.')} ${qq.hint} ${t('One more try!', 'Try again!')}`]);
  }

  function showNextAfterQuestion() {
    const lastOne = filmIx === films.length - 1;
    ui.next.textContent = lastOne ? t('Done, let’s fly!', 'Done, let’s fly!') : 'Next';
    ui.next.hidden = false;
    ui.next.disabled = false;
    ui.next.classList.add('is-ready');
    try { ui.next.focus(); } catch { /* closed */ }
  }

  function onNext() {
    if (mode === 'watch') {
      if (!seenEnd) return;
      startQuestion();
      return;
    }
    if (!q?.done) return;
    if (filmIx < films.length - 1) setFilm(filmIx + 1);
    else finish();
  }

  function finish() {
    clearInterval(timer);
    host.close();
    current = null;
    if (game && game.lesson === api) game.lesson = null;
    resolveFn({ results: results.filter(Boolean) });
  }

  // --- the clock and the picture ---
  function render() {
    const film = films[filmIx];
    const len = filmLength(film);
    if (time >= len) {
      time = len;
      if (playing) { playing = false; onFilmEnd(); }
    }
    const at = clipAt(film, time);
    const cv = ui.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 860; const H = cv.clientHeight || 400;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(ctx, W, H, at.clip, at.simT, clock, Math.min(1, 0.15 + at.real / FADE_S)); // each clip fades in
    const cap = at.caption;
    if (cap !== lastCaption) { lastCaption = cap; ui.line.textContent = cap; }
  }

  function onFilmEnd() {
    if (seenEnd) return;
    seenEnd = true;
    if (mode === 'watch') {
      ui.next.disabled = false;
      ui.next.classList.add('is-ready');
      try { ui.next.focus(); } catch { /* closed */ }
    }
  }

  /** Is the film on screen right now? The clock only runs while it is (on a
   *  reload the step opens the lesson before the first frame is drawn). */
  function seen() {
    const r = ui.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    // Not under a loading screen or another card. (The canvas itself has
    // pointer-events off, so the hit is the card around it.)
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !card.contains(hit)) return false;
    if (testDriven) return true;
    // A real screen draws frames: count time only while it does (a tab in the
    // background stops). A page that has never drawn one is a hidden test tab;
    // let it run so automated runs get through.
    if (everFrame) return !document.hidden && performance.now() - lastFrameAt < 400;
    return document.hidden;
  }

  function tick() {
    const now = performance.now();
    // Capped at 1.1 s: a hidden tab runs timers about once a second, and the
    // film should still keep real time there (tests); a longer gap is a stall.
    const dt = Math.min(1.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    clock += dt;
    if (!held && !userPaused && playing && seen()) time += dt;
    if (dt > 0) render(); // a stopped film still pulses its "you made it" ring
  }
  timer = setInterval(tick, TICK_MS);
  // Smooth frames on a real screen (stops when the lesson closes).
  const onFrame = () => { if (current !== handle) return; everFrame = true; lastFrameAt = performance.now(); tick(); requestAnimationFrame(onFrame); };
  requestAnimationFrame(onFrame);

  // --- test hook ---
  const api = {
    get open() { return current === handle; },
    state() { return { film: films[filmIx].id, index: filmIx, mode, time: +time.toFixed(2), length: +filmLength(films[filmIx]).toFixed(2), playing, paused: userPaused, seen: seen(), caption: lastCaption, results: results.filter(Boolean) }; },
    /** Close at once (no answers recorded). */
    skip() { finish(); },
    /** Every remaining question answered right, then close. */
    answerAll() {
      for (let i = filmIx; i < films.length; i++) if (!results[i]) results[i] = { id: films[i].id, correct: true, tries: 1, auto: true };
      finish();
    },
    /** One move a child would make: watch -> end the film and open the question; ask -> pick the right answer, then Next. */
    next() {
      testDriven = true;
      if (mode === 'watch') { time = filmLength(films[filmIx]); render(); onNext(); return this.state(); }
      if (!q.done) ui.choices.querySelector('[data-correct="1"]')?.click();
      onNext();
      return current ? this.state() : 'finished';
    },
    /** Jump to film i (0-3), watching. */
    film(i) { testDriven = true; setFilm(Math.max(0, Math.min(films.length - 1, i))); return this.state(); },
    seek(sec) { testDriven = true; time = Math.max(0, sec); playing = true; render(); return this.state(); },
    step(dt = 1 / 30) { testDriven = true; time += dt; clock += dt; playing = true; render(); return this.state(); },
    /** Stop (true) or run (false) the clock; running also starts it in a tab nobody can see. */
    pause(on = true) { testDriven = true; held = !!on; return this.state(); },
    /** Save the film canvas to docs/progress/<name>.png (dev server). */
    async shot(nm = 'lesson') {
      const res = await fetch(`/__shot?name=${encodeURIComponent(nm)}`, { method: 'POST', body: ui.canvas.toDataURL('image/png') });
      return res.ok ? `docs/progress/${nm}.png` : `failed ${res.status}`;
    },
    get card() { return card; },
  };
  const handle = { promise, api };
  current = handle;
  if (game) game.lesson = api;
  setFilm(0);
  return promise;
}

/**
 * The mission step that plays it (missions.js step format). The main session
 * puts it in act1.js between a1_satellite_fix and a1_raise.
 */
export function lessonStep(game) {
  let done = false;
  return {
    id: 'a1_lesson', act: 1,
    title: t('Flight school', 'Flight school'),
    objective: t('Watch Mission Control’s quick lesson on how to fly to the Moon, and answer a question after each film.', 'Watch how to fly to the Moon. Then answer the questions.'),
    markers: ['moon'],
    async enter(ctx) {
      done = false;
      await playTransferLesson(ctx || game);
      done = true;
      (ctx || game)?.hud?.toast?.(t('Now for real: point along your path and wait for the green BURN NOW sign.', 'Now you try! Wait for the green BURN NOW sign.'), { kind: 'good', ms: 4500 });
    },
    check() { return done; },
  };
}
