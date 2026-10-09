// The "in" and "out" of a village chapter (1, 2 and 3).
//
// IN:  cinema bars slide in, the camera sweeps down from high over the map
//      to its usual place behind her, the chapter's title card shows, and she
//      waves. The full sweep plays the first time a chapter is opened at a
//      Level; after that just the title card (a returning child wants to
//      play, not watch). Any key or click skips it.
// OUT: when the chapter's last goal is done - the camera circles what she
//      built, confetti, she cheers, and a "Chapter complete" card offers the
//      next chapter (or "Keep exploring").
//
// Chapter 4 has its own opening (src/space/cinematics.js) and end card.
//
// A chapter wires it up with:
//   const story = createChapterStory({ camera, chasePose, getAvatar, chapter, level });
//   tick(dt):  if (!story.update(dt)) updateCamera(dt);
//   blocked:   story.active (it also sets body[data-play-modal], which every
//              chapter already treats as "no walking, no E")
//   await story.intro({ title, line, lookAt, scene });
//   await story.outro({ title, line, focus, next, scene });
// `scene` (optional, the full version only) is an async film played before
// the title card / before the complete card: `async (run) => { await run(secs,
// (t, k) => { ...move the camera and props... }); }`. See run() below.
// A scene may also be an object { duration, step(t, say), dispose() } (Chapter
// 1's style): it is wrapped into a film, say(text) shows a bottom caption.
//
// Captions wait to be read (lead 2026-10-09): a caption stays on screen for
// readMs(text) (5-10 s) before the next one replaces it, and the title card and
// the film's last caption are held the same way. If a scene asks for the next
// caption early, the film clock waits (the camera holds) until the current one
// has had its time. Skip still ends everything at once.
import * as THREE from 'three';
import { loadProfile, SEEN_PREFIX } from '../launcher/profile.js';
import { keepUnlock } from '../launcher/profile.js';
import { readMs } from '../play/readTime.js';

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const easeInOut = (x) => { const c = Math.min(1, Math.max(0, x)); return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2; };

/** Her name from the launcher, or a friendly stand-in. */
export function heroName() {
  const n = loadProfile().name.trim();
  return n || 'our scientist';
}

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.cs-bars { position: fixed; inset: 0; pointer-events: none; z-index: 9000; }
.cs-bars::before, .cs-bars::after { content: ''; position: absolute; left: 0; right: 0; height: 11vh;
  background: #05070d; transition: transform .7s cubic-bezier(.2,.8,.2,1); }
.cs-bars::before { top: 0; transform: translateY(-100%); }
.cs-bars::after { bottom: 0; transform: translateY(100%); }
.cs-bars.is-on::before, .cs-bars.is-on::after { transform: none; }
body.cs-cinematic .rv-hud, body.cs-cinematic .pl-back, body.cs-cinematic .pl-chip, body.cs-cinematic .play-nav-text,
body.cs-cinematic .pl-hint, body.cs-cinematic .pl-cluebtn, body.cs-cinematic #rvBackToChapters { opacity: 0; transition: opacity .5s; pointer-events: none; }
.cs-caption { position: fixed; left: 50%; bottom: calc(11vh + 14px); z-index: 9000; width: min(92vw, 820px); transform: translate(-50%, 8px);
  text-align: center; color: #fff; font: 600 clamp(16px, 2.3vw, 22px)/1.35 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif;
  text-shadow: 0 2px 12px rgba(0,0,0,.8); opacity: 0; transition: opacity .6s, transform .6s; pointer-events: none; }
.cs-caption.is-on { opacity: 1; transform: translate(-50%, 0); }
.cs-title { position: fixed; left: 50%; top: 30%; transform: translate(-50%, 12px); z-index: 9001;
  text-align: center; color: #fff; opacity: 0; transition: opacity .8s, transform .8s; pointer-events: none;
  font-family: 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; text-shadow: 0 2px 18px rgba(0,0,0,.55); width: min(92vw, 760px); }
.cs-title.is-on { opacity: 1; transform: translate(-50%, 0); }
.cs-title__eyebrow { font: 700 15px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; letter-spacing: .32em; text-transform: uppercase; color: #ffd36b; }
.cs-title__name { font: 800 clamp(34px, 6vw, 62px)/1.05 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; margin: 12px 0 10px; }
.cs-title__line { font: 500 clamp(16px, 2.2vw, 21px)/1.4 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; color: #e9eefc; }
.cs-skip { position: fixed; right: 18px; bottom: calc(11vh + 12px); z-index: 9001; color: #c9d2e8;
  font: 500 13px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; opacity: 0; transition: opacity .6s; pointer-events: none; }
.cs-skip.is-on { opacity: .8; }
.cs-confetti { position: fixed; inset: 0; z-index: 9002; pointer-events: none; }
.cs-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -46%) scale(.96); z-index: 9003;
  width: min(92vw, 520px); background: #fffdf7; color: #1d2433; border-radius: 22px; padding: 28px 28px 24px;
  box-shadow: 0 24px 70px rgba(0,0,0,.45); text-align: center; opacity: 0;
  transition: opacity .5s, transform .5s cubic-bezier(.2,.9,.3,1.2); font-family: 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; }
.cs-card.is-on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.cs-card__stars { font-size: 38px; letter-spacing: 8px; color: #f5b82e; }
.cs-card__stars span { display: inline-block; transform: scale(0); transition: transform .45s cubic-bezier(.3,1.6,.5,1); }
.cs-card.is-on .cs-card__stars span { transform: scale(1); }
.cs-card.is-on .cs-card__stars span:nth-child(2) { transition-delay: .15s; }
.cs-card.is-on .cs-card__stars span:nth-child(3) { transition-delay: .3s; }
.cs-card__eyebrow { margin-top: 6px; font: 700 13px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; letter-spacing: .24em; text-transform: uppercase; color: #6b7590; }
.cs-card__title { font: 800 30px/1.15 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; margin: 10px 0 8px; }
.cs-card__line { font: 400 17px/1.45 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; color: #3a4357; margin: 0 0 20px; }
.cs-card__actions { display: flex; flex-direction: column; gap: 10px; }
.cs-btn { font: 700 17px/1 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; border: 0; border-radius: 14px; padding: 15px 18px; cursor: pointer; }
.cs-btn--go { background: #2f6bff; color: #fff; }
.cs-btn--go:hover { background: #1f58e6; }
.cs-btn--stay { background: #eef1f7; color: #2a3347; }
.cs-btn:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .cs-bars::before, .cs-bars::after, .cs-title, .cs-card, .cs-card__stars span, .cs-caption { transition: none; }
}`;
  document.head.appendChild(s);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Falling paper confetti on a 2-D canvas for `ms` (also a short burst on a right answer). */
export function confetti(ms = 5200) {
  const c = el('canvas', 'cs-confetti');
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const fit = () => { c.width = innerWidth; c.height = innerHeight; };
  fit();
  const colors = ['#ffd36b', '#ff6b8b', '#5ad1ff', '#7be07b', '#b48bff', '#ffffff'];
  const parts = Array.from({ length: 170 }, (_, i) => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.6,
    vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 8,
    w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, col: colors[i % colors.length],
  }));
  const t0 = performance.now();
  let last = t0;
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const age = now - t0;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalAlpha = age > ms - 900 ? Math.max(0, (ms - age) / 900) : 1;
    for (const p of parts) {
      p.x += (p.vx + Math.sin((now / 400) + p.r) * 30) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.3)));
      ctx.restore();
    }
    if (age < ms) requestAnimationFrame(step);
    else c.remove();
  }
  requestAnimationFrame(step);
}

/**
 * @param {object} o
 * @param {THREE.Camera} o.camera
 * @param {() => {pos: THREE.Vector3, look: THREE.Vector3}} o.chasePose
 *   where the chapter's own camera wants to be right now
 * @param {() => object|null} o.getAvatar  for play('wave' | 'cheer')
 * @param {() => THREE.Vector3} o.getPlayerPos
 * @param {number} o.chapter  1, 2 or 3
 * @param {number} o.level    question Level (1 or 4)
 */
export function createChapterStory({ camera, chasePose, getAvatar, getPlayerPos, chapter, level }) {
  injectCss();
  const seenKey = `${SEEN_PREFIX}ch${chapter}_L${level}`;
  let shot = null;       // the camera move running now
  let active = false;
  let prevModal;
  const nodes = [];
  // A film's timed camera move: step(t, k) runs for `secs` (k goes 0 -> 1 and
  // the last call is step(secs, 1)). A skip ends the film: later runs return at once.
  let filmStop = null;
  let filmOver = false;
  const run = (secs, step) => new Promise((resolve) => {
    if (filmOver) { resolve(); return; }
    filmStop = resolve;
    shot = {
      t: 0,
      step(t) {
        if (t < secs) { step(t, t / secs); return; }
        shot = null;
        filmStop = null;
        step(secs, 1);
        resolve();
      },
    };
  });
  const endRun = () => {
    filmOver = true;
    shot = null;
    capNext = undefined;
    showCaption(null);   // a skip clears the caption at once
    settleCaptions();
    filmStop?.();
    filmStop = null;
  };
  // A function scene can caption through run.say(text): the same line, with the reading-time hold.
  run.say = (text) => say(text);

  // A caption line under the picture (Chapter 1's scenes use it).
  let capEl = null;
  // The caption clock: seconds of film time (it runs on in update(), also between shots).
  let capClock = 0;
  let capShown = null;      // the caption on screen (null: none)
  let capUntil = 0;         // capClock when the shown caption may be replaced
  let capNext;              // the caption waiting for capUntil (undefined: none)
  let settleWaiters = [];   // captionDone() callers
  let holdCamera = false;   // the film is over but its last caption is still up
  function showCaption(text) {
    capShown = text || null;
    capUntil = capClock + (text ? readMs(text) / 1000 : 0);
    if (!text && !capEl) return;
    // end() removes the nodes after a film, so a later film (the ending) makes a fresh caption.
    if (!capEl || !capEl.isConnected) { capEl = el('div', 'cs-caption'); document.body.appendChild(capEl); nodes.push(capEl); }
    if (capEl.textContent !== (text || '')) capEl.textContent = text || '';
    capEl.classList.toggle('is-on', !!text);
  }
  function say(text) {
    const want = text || null;
    if (want === capShown) { capNext = undefined; return; }
    // Skipped, or the last caption has had its time: change now. Otherwise the
    // film waits (update() holds its clock) until the shown caption has been read.
    if (filmOver || capClock >= capUntil) { capNext = undefined; showCaption(want); }
    else capNext = want;
  }
  /** Resolves once no caption is waiting and the shown one has had its time. */
  function captionDone() {
    return new Promise((resolve) => {
      if (capNext === undefined && capClock >= capUntil) resolve();
      else settleWaiters.push(resolve);
    });
  }
  function settleCaptions() {
    if (capNext !== undefined || capClock < capUntil || !settleWaiters.length) return;
    const waiting = settleWaiters;
    settleWaiters = [];
    for (const resolve of waiting) resolve();
  }
  /** A scene object { duration, step(t, say), dispose() } as a film. */
  const asFilm = (scene) => (!scene || typeof scene === 'function' ? scene : async (play) => {
    try { await play(scene.duration, (t) => scene.step(t, say)); } finally { say(null); scene.dispose?.(); }
  });
  /** Play a film to its end, then let its last caption have its time before the next card. */
  const playFilm = async (scene) => {
    try { await scene(run); } catch (err) { console.error('[story] film failed:', err); }
    holdCamera = true;   // the film's last picture stays up while its caption is read
    say(null);
    await captionDone();
    holdCamera = false;
  };

  const bars = el('div', 'cs-bars');
  document.body.appendChild(bars);

  function begin() {
    active = true;
    filmOver = false;     // a new film (the opening, then the ending) plays in full
    prevModal = document.body.dataset.playModal;
    document.body.dataset.playModal = '1';
    document.body.classList.add('cs-cinematic');
    bars.classList.add('is-on');
  }
  function end() {
    active = false;
    shot = null;
    capShown = null;
    capNext = undefined;
    capUntil = capClock;
    if (prevModal === undefined) delete document.body.dataset.playModal;
    else document.body.dataset.playModal = prevModal;
    document.body.classList.remove('cs-cinematic');
    bars.classList.remove('is-on');
    for (const n of nodes.splice(0)) { n.classList.remove('is-on'); setTimeout(() => n.remove(), 900); }
  }

  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();

  return {
    get active() { return active; },
    seen() { try { return localStorage.getItem(seenKey) === '1'; } catch { return true; } },

    /** Drive the camera while a shot runs. @returns {boolean} true = it did. */
    update(dt) {
      capClock += dt;
      if (capNext !== undefined && capClock >= capUntil) { const want = capNext; capNext = undefined; showCaption(want); }
      settleCaptions();
      if (!shot && !holdCamera) return false;
      // The caption on screen has not had its time yet: the film waits, camera held.
      if (capNext !== undefined || !shot) return true;
      shot.t += dt;
      shot.step(shot.t);
      return true;
    },

    /**
     * The opening. `lookAt` is the middle of the map (the sweep starts
     * looking at it). `scene` is a film played first (see the header).
     * Resolves when it ends or is skipped.
     */
    intro({ eyebrow, title, line, lookAt, scene = null }) {
      const raw = scene;
      scene = asFilm(scene);
      const full = !this.seen();
      const filmFirst = full && !!scene;   // the film, then the card (no sweep)
      // A scene object builds its set when it is made: a returning child never
      // sees it, so take it down now (it hid the village's scenery until then).
      if (!filmFirst && raw && typeof raw !== 'function') raw.dispose?.();
      begin();
      const card = el('div', 'cs-title');
      card.append(el('div', 'cs-title__eyebrow', eyebrow), el('div', 'cs-title__name', title), el('div', 'cs-title__line', line));
      const skip = el('div', 'cs-skip', 'Press any key to skip');
      document.body.append(card, skip);
      nodes.push(card, skip);
      // A timer, not requestAnimationFrame: rAF never fires in a hidden tab.
      const showCard = () => setTimeout(() => card.classList.add('is-on'), 30);
      setTimeout(() => { if (full) skip.classList.add('is-on'); }, 30);
      if (!filmFirst) showCard();

      return new Promise((resolve) => {
        // The card stays up for its words' reading time (readMs), and at least the old hold.
        const DUR = Math.max(filmFirst ? 3.6 : full ? 6.2 : 2.6, readMs([eyebrow, title, line]) / 1000 + 1);
        let waved = false;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          removeEventListener('keydown', onSkip, true);
          removeEventListener('pointerdown', onSkip, true);
          try { localStorage.setItem(seenKey, '1'); } catch { /* private mode */ }
          endRun();
          end();
          resolve();
        };
        // Any key or click skips, once the first second has passed.
        let armed = false;
        setTimeout(() => { armed = true; }, 1000);
        const onSkip = (e) => { if (!armed) return; e.stopPropagation(); if (e.type === 'keydown') e.preventDefault(); finish(); };
        addEventListener('keydown', onSkip, true);
        addEventListener('pointerdown', onSkip, true);

        // The card's camera: a sweep (full, no film), or a short hold on the chase camera.
        const startCard = () => {
          // Start: high over the map on the far side, looking at its middle;
          // end: exactly where the chase camera wants to be.
          const sweep = full && !filmFirst;
          const p0 = getPlayerPos().clone();
          const home = chasePose();
          const endA = Math.atan2(home.pos.x - p0.x, home.pos.z - p0.z);
          const endR = Math.hypot(home.pos.x - p0.x, home.pos.z - p0.z);
          const endH = home.pos.y - p0.y;
          const center = lookAt ? lookAt.clone() : p0.clone();
          showCard();
          shot = {
            t: 0,
            step(t) {
              if (sweep) {
                const e = easeInOut(t / (DUR - 0.8));
                const a = endA + 2.3 * (1 - e);
                const r = endR + 44 * (1 - e);
                const h = endH + 30 * (1 - e) * (1 - e * 0.35);
                _pos.set(p0.x + Math.sin(a) * r, p0.y + h, p0.z + Math.cos(a) * r);
                _look.copy(center).lerp(home.look, smooth(t / (DUR - 1.2)));
                camera.position.copy(_pos);
                camera.lookAt(_look);
              } else {
                const hp = chasePose();
                camera.position.lerp(hp.pos, 0.2);
                camera.lookAt(hp.look);
              }
              if (!waved && t > DUR - 2.2) { waved = true; getAvatar()?.play?.('wave', { hold: 2 }); }
              if (t > DUR - 0.9) card.classList.remove('is-on');
              if (t >= DUR) finish();
            },
          };
        };
        if (filmFirst) {
          (async () => {
            await playFilm(scene);
            if (!finished) startCard();
          })();
        } else {
          startCard();
        }
      });
    },

    /**
     * The ending. `focus` is what she built (the camera circles it); null
     * keeps the camera where it is (Chapter 3's rocket, up in the sky).
     * `next` = { href, label } for the next chapter.
     * @returns {Promise<'next'|'stay'>}
     */
    outro({ title, line, focus = null, next = null, scene = null }) {
      scene = asFilm(scene);
      begin();
      const after = () => {
        getAvatar()?.play?.('cheer', { hold: 4 });
        setTimeout(() => confetti(), 400);
        const c0 = camera.position.clone();
        const f = focus ? focus.clone() : null;
        const startA = f ? Math.atan2(c0.x - f.x, c0.z - f.z) : 0;
        if (f) {
          const _lk = new THREE.Vector3();
          shot = {
            t: 0,
            step(t) {
              // Ease in from where the camera was, then keep circling slowly.
              const k = smooth(t / 1.6);
              const a = startA + 0.28 * t;
              _pos.set(f.x + Math.sin(a) * 17, f.y + 9, f.z + Math.cos(a) * 17);
              camera.position.copy(c0).lerp(_pos, k);
              _lk.set(f.x, f.y + 2.5, f.z);
              camera.lookAt(_lk);
            },
          };
        }

        return new Promise((resolve) => {
          const card = el('div', 'cs-card');
          card.setAttribute('role', 'dialog');
          card.setAttribute('aria-label', title);
          const stars = el('div', 'cs-card__stars');
          for (let i = 0; i < 3; i++) stars.appendChild(el('span', null, '★'));
          const actions = el('div', 'cs-card__actions');
          card.append(stars, el('div', 'cs-card__eyebrow', `Chapter ${chapter} complete`), el('div', 'cs-card__title', title), el('p', 'cs-card__line', line), actions);
          let goBtn = null;
          if (next) {
            goBtn = el('button', 'cs-btn cs-btn--go', `${next.label} ▶`);
            goBtn.type = 'button';
            actions.appendChild(goBtn);
          }
          const stayBtn = el('button', 'cs-btn cs-btn--stay', 'Keep exploring');
          stayBtn.type = 'button';
          actions.appendChild(stayBtn);
          const done = (how) => {
            removeEventListener('keydown', onKey, true);
            end();
            if (how === 'next' && next) location.href = keepUnlock(next.href);
            resolve(how);
          };
          const onKey = (e) => {
            if (!card.isConnected || !card.classList.contains('is-on')) return;
            if (e.key === 'Enter' && goBtn) { e.preventDefault(); e.stopPropagation(); done('next'); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done('stay'); }
          };
          goBtn?.addEventListener('click', () => done('next'));
          stayBtn.addEventListener('click', () => done('stay'));
          addEventListener('keydown', onKey, true);
          setTimeout(() => {
            document.body.appendChild(card);
            nodes.push(card);
            setTimeout(() => { card.classList.add('is-on'); (goBtn || stayBtn).focus(); }, 30);
          }, 3200);
        });
      };
      if (!scene) return after();
      // The film first: any key or click ends the film (the card still comes).
      const hint = el('div', 'cs-skip is-on', 'Press any key to skip');
      document.body.appendChild(hint);
      let armed = false;
      setTimeout(() => { armed = true; }, 1000);
      const skipFilm = (e) => { if (!armed) return; e.stopPropagation(); if (e.type === 'keydown') e.preventDefault(); endRun(); };
      addEventListener('keydown', skipFilm, true);
      addEventListener('pointerdown', skipFilm, true);
      return (async () => {
        await playFilm(scene);
        removeEventListener('keydown', skipFilm, true);
        removeEventListener('pointerdown', skipFilm, true);
        hint.remove();
        return after();
      })();
    },
  };
}
