// The launcher: name her, build her, then play the chapters in order.
//
// This is what RUN_GAME.bat opens. It owns the ORDER and nothing else - the
// three chapters are untouched games that each save their own progress, and
// profile.js reads those saves rather than asking them to report in.
import { DIFFICULTIES, difficulty, chapterStatus, nextChapter, loadProfile, saveProfile, loadLook, profileReady, resetEverything, unlockAll, keepUnlock } from './profile.js';
import { LESSON_LIST } from '../lesson/index.js';
import { hasSeen, playLesson } from '../lesson/card.js';
import { t } from '../space/level.js';
import './launcher.css';

const $ = (id) => document.getElementById(id);

// --- naming ------------------------------------------------------------------

const naming = $('naming');
const nameInput = $('name-input');
const nameError = $('name-error');

/** he/she words for the launcher's own lines (the hero can change on this page). */
function words() {
  return loadProfile().hero === 'boy' ? { they: 'he', them: 'him', their: 'his' } : { they: 'she', them: 'her', their: 'her' };
}

function askForName({ afterwards }) {
  naming.hidden = false;
  // Girl or boy is the FIRST choice on a fresh start; later the look page
  // changes it, so a rename only asks for the name.
  $('hero-pick').hidden = afterwards !== 'builder';
  $('name-next').textContent = afterwards === 'builder' ? 'Next: choose a look' : 'Save';
  const hero = loadProfile().hero;
  for (const r of naming.querySelectorAll('input[name="hero"]')) r.checked = r.value === hero;
  nameInput.value = loadProfile().name;
  nameInput.focus();
  nameInput.select();
  naming.dataset.afterwards = afterwards;
}

$('naming-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  // A child typing nothing and pressing Enter must be told why, not ignored.
  if (!name) {
    nameError.textContent = 'Type a name first.';
    nameInput.focus();
    return;
  }
  nameError.textContent = '';
  const hero = naming.querySelector('input[name="hero"]:checked')?.value === 'boy' ? 'boy' : 'girl';
  saveProfile(naming.dataset.afterwards === 'builder' ? { name, hero } : { name });
  if (naming.dataset.afterwards === 'builder') {
    // Straight into the builder on a first run, because a name with no face
    // is not a character yet.
    location.href = keepUnlock('character.html?from=launcher');
    return;
  }
  naming.hidden = true;
  render();
});

// --- the chapter list --------------------------------------------------------

function render() {
  const profile = loadProfile();
  const status = chapterStatus();
  const next = nextChapter(status);

  const level = difficulty();
  $('difficulty').textContent = `· ${level.label}`;
  renderLevels(level);
  $('greeting').textContent = profile.name ? `${profile.name}'s Adventures` : 'Evolution';
  $('lede').textContent = status.every((c) => c.done)
    ? 'Every chapter finished. Replay any of them whenever you like.'
    : `Chapter ${next.n} is next. Finish a chapter to open the one after it.`;
  // Grown-up unlock (?unlock=all) is on: say so, and how to turn it off.
  let unlockOn = false;
  unlockOn = unlockAll();
  if (unlockOn) {
    $('lede').textContent = 'Check mode: all chapters unlocked, with Skip and Jump. Remove ?unlock=all from the address for normal play.';
  }

  const host = $('chapters');
  host.textContent = '';

  for (const c of status) {
    const card = document.createElement(c.locked ? 'div' : 'a');
    card.className = 'chapter' + (c.locked ? ' is-locked' : '') + (c.done ? ' is-done' : '');
    if (!c.locked) {
      card.href = keepUnlock(c.href);
      // The chapters are separate documents, not routes. A plain link is the
      // whole navigation layer, which is why three unrelated games can sit
      // behind one menu without a framework between them.
    } else {
      card.setAttribute('aria-disabled', 'true');
    }

    const num = document.createElement('span');
    num.className = 'chapter__n';
    num.textContent = c.n;
    card.appendChild(num);

    const body = document.createElement('div');
    body.className = 'chapter__body';
    const h = document.createElement('h2');
    h.textContent = `Chapter ${c.n} — ${c.title}`;
    body.appendChild(h);
    const p = document.createElement('p');
    p.textContent = c.locked
      ? `Finish Chapter ${c.n - 1} to open this.`
      : c.blurb;
    body.appendChild(p);
    card.appendChild(body);

    const state = document.createElement('span');
    state.className = 'chapter__state';
    state.textContent = c.locked ? 'Locked' : c.done ? 'Done' : c === next ? 'Play' : 'Replay';
    card.appendChild(state);

    host.appendChild(card);
  }

  renderLessons(status);

  $('hint').textContent = loadLook()
    ? ''
    : `No look yet. Build ${words().them} so ${words().they} appears in the game.`;
}

/**
 * The "📖 Lessons" list: every lesson, grouped by chapter, to watch again.
 *
 * A lesson opens once its chapter is open (or once it has been watched), so a
 * child can't skip ahead into a later chapter's films. Watching one here marks
 * it seen, which also means the chapter won't play it again.
 */
function renderLessons(status) {
  const host = $('lessons');
  host.textContent = '';
  for (const c of status) {
    const items = LESSON_LIST.filter((l) => l.chapter === c.n);
    if (!items.length) continue;
    const row = document.createElement('div');
    row.className = 'lessons__row';
    const tag = document.createElement('span');
    tag.className = 'lessons__ch';
    tag.textContent = `Chapter ${c.n}`;
    row.appendChild(tag);
    for (const item of items) {
      const seen = hasSeen(item.id);
      const locked = c.locked && !seen;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lesson' + (seen ? ' is-seen' : '') + (locked ? ' is-locked' : '');
      b.dataset.lesson = item.id;
      b.disabled = locked;
      b.textContent = `${seen ? '✓ ' : locked ? '🔒 ' : '▶ '}${t(item.title[0], item.title[1])}`;
      b.title = locked ? `Opens with Chapter ${c.n}` : seen ? 'Watched. Watch it again!' : 'Watch it';
      b.addEventListener('click', () => watch(item));
      row.appendChild(b);
    }
    host.appendChild(row);
  }
}

let watching = false;
async function watch(item) {
  if (watching) return;
  watching = true;
  try {
    await playLesson(await item.load());
  } catch (err) {
    console.error('[launcher] lesson failed', item.id, err);
  } finally {
    watching = false;
    render();
  }
}

/**
 * The difficulty picker.
 *
 * Switching it re-renders the chapter list, because each difficulty has its
 * OWN saves and its own copies of chapters 1 and 2 - a child part-way through
 * Level 4 who tries Level 1 sees Level 1's progress, not Level 4's, and
 * switching back finds everything where they left it.
 */
function renderLevels(current) {
  const host = $('levels');
  host.textContent = '';
  for (const d of DIFFICULTIES) {
    const label = document.createElement('label');
    label.className = 'opt';
    label.title = d.blurb;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'difficulty';
    input.value = String(d.level);
    input.checked = d.level === current.level;
    input.addEventListener('change', () => {
      saveProfile({ difficulty: d.level });
      // Reload: the Level is read once per page (src/space/level.js), and the
      // lessons list and its films must switch wording with it.
      location.reload();
    });
    label.appendChild(input);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${d.label} — ${d.forGrade}`;
    label.appendChild(name);
    host.appendChild(label);
  }
}

// --- footer ------------------------------------------------------------------

$('edit-look').addEventListener('click', () => { location.href = keepUnlock('character.html?from=launcher'); });
$('rename').addEventListener('click', () => askForName({ afterwards: 'menu' }));

// Start over. Confirmed first, and the confirmation SAYS what will be lost -
// this throws away every chapter at both difficulties, and a child who taps it
// by accident should not discover that afterwards.
$('hard-reset').addEventListener('click', () => {
  const status = chapterStatus();
  const done = status.filter((c) => c.done).length;
  const warning = done
    ? `This erases everything: ${done} finished chapter${done > 1 ? 's' : ''}, ${words().their} name, ${words().their} look, and all progress at BOTH Level 1 and Level 4.\n\nStart completely over?`
    : `This erases ${words().their} name, ${words().their} look and all progress at both Level 1 and Level 4.\n\nStart completely over?`;
  if (!confirm(warning)) return;
  resetEverything();
  location.href = keepUnlock('index.html');
});

// --- go ----------------------------------------------------------------------

// A first run has no name and no face: ask for one, then hand over to the
// builder. Coming BACK from the builder, the menu is what they want to see.
if (!profileReady() && !loadProfile().name) askForName({ afterwards: 'builder' });
render();
