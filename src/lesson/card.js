// The "watch, answer, try it" lesson card for Chapters 1-3 (LESSONS_PLAN.md).
//
// A lesson is data (see src/lesson/lessons/*.js):
//   { id, eyebrow, narrator, tryIt: [l4, l1],
//     films: [{ title: [l4, l1],
//               beats: [{ dur, cap: [l4, l1] }, ...],   // authored seconds + caption
//               draw(ctx, T, info),                      // T = authored seconds
//               question: { prompt, choices: [{ text, correct }], hint, why },
//               clue: [l4, l1], clueAt: beatIndex }] }
// Every player-facing string is a [Level 4, Level 1] pair (t() picks one).
//
// Level 1 clue (lead 2026-10-05): at Level 1 a written note gives the answer
// away in plain words: it appears under the film from beat `clueAt` (default:
// the last beat) and stays above the question. The animation is unchanged:
// the clue is a strip under the picture, never over it. Level 4 never shows it.
//
// Captions wait to be read: a beat lasts at least 1.5 s + 0.35 s per word
// (1.5x that at Level 1). When a caption needs longer than its beat, the
// picture slows down to match, so what is said and what is shown stay together.
//
// Questions (lead's rule, same as Flight School): two tries, a cheer on a right
// answer, after the second miss the answer is shown with a kind explanation
// and the lesson carries on. No restart: it teaches, it doesn't test.
//
// The card opens in the play-mode modal layer (src/play/ui.js openLayer), so
// game input is locked (body.dataset.playModal) and keys are captured while it
// is open. In Chapter 4 pass `{ bus: game.bus }`: the space game pauses and
// drops its controls on the bus's 'ui-modal' (it doesn't read playModal).
// Test hook while open: window.__lesson = { state(), next(), answerAll(),
// skip(), film(i), seek(T), shot() }; the right answer's button has data-correct="1".
import { t, LEVEL } from '../space/level.js';
import { el, openLayer, prefersReducedMotion } from '../play/ui.js';
import { STAGE_W, STAGE_H } from './draw.js';

const SEEN_PREFIX = 'rocket_village_lesson_';
const TICK_MS = 50;

const pick = (pair) => (Array.isArray(pair) ? t(pair[0], pair[1]) : pair);

/** localStorage key for "this lesson was seen at this Level". */
export const seenKey = (id) => `${SEEN_PREFIX}${id}_L${LEVEL}`;
export const LESSON_SEEN_PREFIX = SEEN_PREFIX;

export function hasSeen(id) {
  try { return localStorage.getItem(seenKey(id)) === '1'; } catch { return false; }
}
export function markSeen(id) {
  try { localStorage.setItem(seenKey(id), '1'); } catch { /* private mode */ }
}

/** Seconds a caption needs on screen to be read. */
export function readSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return (1.5 + 0.35 * words) * (LEVEL === 1 ? 1.5 : 1);
}

/**
 * The real-time plan of a film: each beat lasts max(authored, reading time).
 * @returns {{ beats: {start: number, real: number, aStart: number, dur: number, cap: string}[], length: number, authored: number }}
 */
export function filmPlan(film) {
  let real = 0; let authored = 0;
  const beats = film.beats.map((b) => {
    const cap = pick(b.cap);
    const r = Math.max(b.dur, readSeconds(cap));
    const out = { start: real, real: r, aStart: authored, dur: b.dur, cap };
    real += r; authored += b.dur;
    return out;
  });
  return { beats, length: real, authored };
}

/** Authored time and caption at real time `time` into a film plan. */
export function planAt(plan, time) {
  const tt = Math.max(0, Math.min(plan.length, time));
  if (tt >= plan.length) return { T: plan.authored, cap: plan.beats[plan.beats.length - 1].cap };
  let b = plan.beats[plan.beats.length - 1];
  for (const x of plan.beats) { if (tt < x.start + x.real) { b = x; break; } }
  const k = b.real > 0 ? Math.min(1, (tt - b.start) / b.real) : 1;
  return { T: b.aStart + k * b.dur, cap: b.cap };
}

/** The film's Level 1 clue, or '' (Level 4, or a film without one). */
export function clueText(film) {
  if (LEVEL !== 1 || !film.clue) return '';
  return Array.isArray(film.clue) ? (film.clue[1] || '') : film.clue;
}

/** Real time the clue appears: the start of beat `clueAt` (default the last). */
export function clueStart(plan, film) {
  const i = Math.max(0, Math.min(plan.beats.length - 1, film.clueAt ?? plan.beats.length - 1));
  return plan.beats[i].start;
}

const CHEERS = [['Yes! Great thinking!', 'Yes! Well done!'], ['Spot on!', 'You got it!'], ['Exactly right!', 'Super! That’s right!']];

const STYLE_ID = 'lesson-styles';
const CSS = `
.ls-card { width: min(980px, 100%); }
.ls-stage { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; }
.ls-view { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,.18); background: #0b1222; }
.ls-canvas { display: block; width: 100%; height: clamp(220px, 50vh, 460px); }
.ls-who { font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--pl-gold); margin-bottom: 4px; }
.ls-line { min-height: 2.9em; font-size: 16px; line-height: 1.45; }
.ls-q[hidden] { display: none; }
.ls-clue { padding: 8px 12px; background: #fff3b0; color: #2a2108; font-size: 17px; font-weight: 800; line-height: 1.35; }
.ls-clue[hidden], .ls-qclue[hidden] { display: none; }
.ls-clue.is-waiting { visibility: hidden; }
.ls-qclue { margin: 0 0 8px; padding: 8px 12px; border-radius: 10px; background: #fff3b0; color: #2a2108; font-size: 16px; font-weight: 800; line-height: 1.35; }
.ls-prompt { margin: 0; font-size: 16px; font-weight: 800; line-height: 1.4; }
.ls-choices { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.ls-choice { text-align: left; min-height: 44px; padding: 10px 14px; border-radius: 12px; border: 2px solid rgba(255,255,255,.16); background: #1a2540; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.ls-choice:hover:not(:disabled) { border-color: var(--pl-cool); }
.ls-choice:focus-visible { outline: 3px solid var(--pl-cool); outline-offset: 2px; }
.ls-choice.is-right { border-color: var(--pl-good); background: rgba(126,231,135,.16); }
.ls-choice.is-wrong { border-color: #ff8a8a; opacity: .7; }
.ls-choices.is-done .ls-choice { cursor: default; }
.ls-feedback { margin-top: 10px; padding: 10px 12px; border-radius: 12px; font-size: 15px; line-height: 1.45; }
.ls-feedback[hidden] { display: none; }
.ls-feedback.is-good { background: rgba(126,231,135,.14); border: 1px solid rgba(126,231,135,.5); }
.ls-feedback.is-warn { background: rgba(255,209,102,.12); border: 1px solid rgba(255,209,102,.45); }
.ls-star { color: var(--pl-gold); margin-right: 6px; }
.ls-actions { display: flex; gap: 10px; align-items: center; margin-top: 14px; }
.ls-dots { display: flex; gap: 6px; margin-right: auto; }
.ls-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.2); }
.ls-dot.is-done { background: var(--pl-good); }
.ls-dot.is-active { background: var(--pl-cool); box-shadow: 0 0 0 3px rgba(86,212,255,.25); }
.ls-btn { min-height: 42px; padding: 0 18px; border-radius: 12px; border: 0; background: var(--pl-cool); color: var(--pl-ink); font: inherit; font-weight: 900; cursor: pointer; }
.ls-btn--ghost { background: transparent; color: var(--pl-text); border: 1px solid rgba(255,255,255,.25); }
.ls-btn:disabled { opacity: .45; cursor: default; }
.ls-btn.is-ready { animation: ls-ready 1.4s ease-in-out infinite; }
.ls-card.is-asking .ls-stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); align-items: start; }
.ls-card.is-asking .ls-canvas { height: clamp(180px, 38vh, 330px); }
.ls-card.is-asking .ls-talk { display: none; }
@keyframes ls-ready { 0%, 100% { box-shadow: 0 0 0 0 rgba(86,212,255,.55); } 50% { box-shadow: 0 0 0 7px rgba(86,212,255,0); } }
@media (max-width: 900px) { .ls-card.is-asking .ls-stage { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .ls-btn.is-ready { animation: none; } }
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

let current = null;

/**
 * Play a lesson. Resolves when the child presses the last button.
 * @returns {Promise<{ results: {film: number, correct: boolean, tries: number}[] }>}
 */
export function playLesson(lesson, { bus = null } = {}) {
  if (current) return current.promise;
  injectStyles();
  const films = lesson.films;
  const plans = films.map(filmPlan);
  const results = [];
  let resolveFn;
  const promise = new Promise((r) => { resolveFn = r; });

  let ix = 0;
  let mode = 'watch';
  let time = 0;
  let paused = false;
  let seenEnd = false;
  let q = null;
  let lastCap = '';
  let lastNow = performance.now();
  let closed = false;

  // --- build the card ---
  const card = el('div', 'pl-card ls-card');
  card.dataset.lesson = lesson.id;
  const eyebrow = el('div', 'pl-eyebrow');
  const title = el('h2', 'pl-title');
  const stage = el('div', 'ls-stage');
  const view = el('div', 'ls-view');
  const canvas = el('canvas', 'ls-canvas');
  canvas.setAttribute('role', 'img');
  const clueBox = el('div', 'ls-clue');
  clueBox.hidden = true;
  view.append(canvas, clueBox);
  const side = el('div', 'ls-side');
  const talk = el('div', 'ls-talk');
  const line = el('div', 'ls-line');
  line.setAttribute('aria-live', 'polite');
  talk.append(el('div', 'ls-who', pick(lesson.narrator) || 'Narrator'), line);
  const qBox = el('div', 'ls-q');
  qBox.hidden = true;
  const prompt = el('p', 'ls-prompt');
  const qClue = el('p', 'ls-qclue');
  qClue.hidden = true;
  const choices = el('div', 'ls-choices');
  const fb = el('div', 'ls-feedback');
  fb.hidden = true;
  fb.setAttribute('role', 'status');
  qBox.append(el('div', 'ls-who', t('Question', 'Question')), prompt, qClue, choices, fb);
  side.append(talk, qBox);
  stage.append(view, side);
  const actions = el('div', 'ls-actions');
  const dots = el('div', 'ls-dots');
  films.forEach(() => dots.appendChild(el('span', 'ls-dot')));
  const pauseBtn = el('button', 'ls-btn ls-btn--ghost');
  const replayBtn = el('button', 'ls-btn ls-btn--ghost', `↻ ${t('Replay', 'Watch again')}`);
  const nextBtn = el('button', 'ls-btn', 'Next');
  for (const b of [pauseBtn, replayBtn, nextBtn]) b.type = 'button';
  actions.append(dots, pauseBtn, replayBtn, nextBtn);
  card.append(eyebrow, title, stage, actions);

  const layer = openLayer(card, {
    onKey(e) {
      if (e.key === ' ' && mode === 'watch') { e.preventDefault(); setPaused(!paused); }
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && !nextBtn.disabled && !nextBtn.hidden) { e.preventDefault(); onNext(); }
      else if (mode === 'ask' && /^[1-3]$/.test(e.key)) choices.children[+e.key - 1]?.click();
    },
    onClose() { try { bus?.emit?.('ui-modal', false); } catch { /* bus gone */ } },
  });
  try { bus?.emit?.('ui-modal', true); } catch { /* bus gone */ }

  replayBtn.addEventListener('click', () => { time = 0; setPaused(false); render(); });
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  nextBtn.addEventListener('click', onNext);

  function setPaused(on) {
    paused = !!on;
    pauseBtn.textContent = paused ? '▶ Play' : '❚❚ Pause';
    pauseBtn.setAttribute('aria-pressed', String(paused));
  }

  function setFilm(i) {
    ix = i; mode = 'watch'; time = 0; seenEnd = false; q = null; lastCap = '';
    setPaused(false);
    card.classList.remove('is-asking');
    eyebrow.textContent = `${pick(lesson.eyebrow)} · ${i + 1} of ${films.length}`;
    title.textContent = pick(films[i].title);
    canvas.setAttribute('aria-label', title.textContent);
    qBox.hidden = true;
    clueBox.hidden = true;
    pauseBtn.hidden = false; replayBtn.hidden = false;
    nextBtn.textContent = 'Next'; nextBtn.disabled = true; nextBtn.hidden = false; nextBtn.classList.remove('is-ready');
    [...dots.children].forEach((d, k) => { d.className = `ls-dot${k < i ? ' is-done' : k === i ? ' is-active' : ''}`; });
    render();
  }

  function startQuestion() {
    mode = 'ask';
    const qq = films[ix].question;
    q = { tries: 0, done: false };
    card.classList.add('is-asking');
    qBox.hidden = false;
    pauseBtn.hidden = true;
    prompt.textContent = pick(qq.prompt);
    const clue = clueText(films[ix]);
    qClue.textContent = clue ? `💡 ${clue}` : '';
    qClue.hidden = !clue;
    clueBox.hidden = true;
    choices.textContent = '';
    choices.classList.remove('is-done');
    fb.hidden = true;
    for (const c of qq.choices) {
      const b = el('button', 'ls-choice', pick(c.text));
      b.type = 'button';
      if (c.correct) b.dataset.correct = '1';
      b.addEventListener('click', () => grade(c, b));
      choices.appendChild(b);
    }
    nextBtn.hidden = true;
    setTimeout(() => { try { choices.querySelector('button')?.focus(); } catch { /* closed */ } }, 0);
    render();
  }

  function feedback(kind, parts) {
    fb.className = `ls-feedback is-${kind}`;
    fb.textContent = '';
    fb.append(...parts);
    fb.hidden = false;
  }

  function grade(choice, btn) {
    if (!q || q.done) return;
    const qq = films[ix].question;
    q.tries += 1;
    if (choice.correct) {
      q.done = true;
      btn.classList.add('is-right');
      choices.classList.add('is-done');
      feedback('good', [el('span', 'ls-star', '★'), el('b', null, `${pick(CHEERS[ix % CHEERS.length])} `), pick(qq.why)]);
      results[ix] = { film: ix, correct: true, tries: q.tries };
      afterQuestion();
      return;
    }
    btn.classList.add('is-wrong');
    btn.disabled = true;
    if (q.tries >= 2) {
      q.done = true;
      choices.classList.add('is-done');
      choices.querySelector('[data-correct="1"]')?.classList.add('is-right');
      const right = pick(qq.choices.find((c) => c.correct).text);
      feedback('warn', [el('b', null, `Good try! The answer is: ${right}. `), pick(qq.why)]);
      results[ix] = { film: ix, correct: false, tries: q.tries };
      afterQuestion();
      return;
    }
    feedback('warn', [`${t('Not quite.', 'Not quite.')} ${pick(qq.hint)} ${t('One more try!', 'Try again!')}`]);
  }

  function afterQuestion() {
    const last = ix === films.length - 1;
    nextBtn.textContent = last ? (lesson.done ? pick(lesson.done) : t('Now you try!', 'Now you try!')) : 'Next';
    nextBtn.hidden = false; nextBtn.disabled = false; nextBtn.classList.add('is-ready');
    try { nextBtn.focus(); } catch { /* closed */ }
  }

  function onNext() {
    if (mode === 'watch') { if (seenEnd) startQuestion(); return; }
    if (!q?.done) return;
    if (ix < films.length - 1) setFilm(ix + 1); else finish();
  }

  function finish() {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    markSeen(lesson.id);
    layer.close();
    current = null;
    if (window.__lesson === api) delete window.__lesson;
    resolveFn({ results: results.filter(Boolean) });
  }

  function render() {
    if (closed) return;
    const plan = plans[ix];
    if (time >= plan.length) {
      time = plan.length;
      if (!seenEnd) {
        seenEnd = true;
        if (mode === 'watch') { nextBtn.disabled = false; nextBtn.classList.add('is-ready'); }
      }
    }
    const at = planAt(plan, time);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 860; const H = canvas.clientHeight || 420;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Letterbox the 800x450 stage into the canvas.
    const s = Math.min(W / STAGE_W, H / STAGE_H) * dpr;
    const ox = (canvas.width - STAGE_W * s) / 2; const oy = (canvas.height - STAGE_H * s) / 2;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, STAGE_W, STAGE_H); ctx.clip();
    try {
      films[ix].draw(ctx, at.T, { level: LEVEL, t, reduced: prefersReducedMotion(), asking: mode === 'ask' });
    } catch (err) {
      console.error('[lesson] draw failed', lesson.id, ix, err);
    }
    ctx.restore();
    if (at.cap !== lastCap) { lastCap = at.cap; line.textContent = at.cap; }
    if (mode === 'watch') {
      const clue = clueText(films[ix]);
      // The strip keeps its place from the start (no jump when it appears).
      const show = !!clue && time >= clueStart(plan, films[ix]);
      if (clueBox.textContent !== `💡 ${clue}`) clueBox.textContent = `💡 ${clue}`;
      clueBox.hidden = !clue;
      clueBox.classList.toggle('is-waiting', !show);
    }
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(1.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (!paused && mode === 'watch') time += dt;
    render();
  }
  const timer = setInterval(tick, TICK_MS);

  const api = {
    get open() { return !closed; },
    state() {
      return { lesson: lesson.id, film: ix, mode, time: +time.toFixed(2), length: +plans[ix].length.toFixed(2), caption: lastCap, clue: mode === 'ask' ? (qClue.hidden ? '' : qClue.textContent) : (clueBox.hidden || clueBox.classList.contains('is-waiting') ? '' : clueBox.textContent), results: results.filter(Boolean) };
    },
    /** One move a child would make: end the film -> question -> right answer -> next. */
    next() {
      if (mode === 'watch') { time = plans[ix].length; render(); onNext(); return this.state(); }
      if (!q.done) choices.querySelector('[data-correct="1"]')?.click();
      onNext();
      return closed ? 'finished' : this.state();
    },
    answerAll() {
      for (let i = ix; i < films.length; i++) if (!results[i]) results[i] = { film: i, correct: true, tries: 1, auto: true };
      finish();
    },
    skip() { finish(); },
    film(i) { setFilm(Math.max(0, Math.min(films.length - 1, i))); return this.state(); },
    /** Hold the film at real time `sec` (paused there). */
    seek(sec) { time = Math.max(0, sec); setPaused(true); seenEnd = seenEnd || time >= plans[ix].length; render(); return this.state(); },
    shot() { return canvas.toDataURL('image/png'); },
    get card() { return card; },
  };
  window.__lesson = api;
  current = { promise, api };
  setFilm(0);
  return promise;
}

/**
 * Play `lesson` the first time on this Level, then resolve; resolves at once
 * when it was already seen (or there is no DOM). Never throws: a broken lesson
 * must not block the quest it comes before.
 */
export async function lessonOnce(lesson, opts) {
  if (!lesson || typeof document === 'undefined' || hasSeen(lesson.id)) return null;
  try {
    return await playLesson(lesson, opts);
  } catch (err) {
    console.error('[lesson] failed', lesson.id, err);
    markSeen(lesson.id);
    return null;
  }
}
