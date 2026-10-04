// The question modal: `hud.askQuestion(question) -> Promise<{correct, attempts}>`.
//
// Deliberately the SAME question schema as Chapter 3's src/game/questions.js
// (id, type: 'choice'|'text', title, prompt, choices:[{text,correct}] or
// answers:[...], hint, visual:{rows}, reward), so this chapter's question
// bank (questions.space.js, another agent's file) and Chapter 3's are
// interchangeable data. checkAnswer/normalizeText below are intentionally a
// close copy of Chapter 3's — a second, independent implementation of "how
// do we grade an answer" so this module never needs to import Chapter 3's
// hud.js (banned) while still honouring the one behaviour that matters:
// wrong answers cost nothing, and a hint always follows.

import { el } from './domUtil.js';

const PURE_NUMBER = /^\d+(?:\.\d+)?$/;

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[,\-_]/g, '')
    .replace(/[.!?;:]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function checkAnswer(q, given) {
  if (!q) return false;
  if (q.type === 'choice') {
    const choices = Array.isArray(q.choices) ? q.choices : [];
    if (given && typeof given === 'object') return choices.includes(given) && given.correct === true;
    const asIndex = typeof given === 'number' ? given : Number(String(given).trim());
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < choices.length) return choices[asIndex].correct === true;
    const norm = normalizeText(given);
    if (!norm) return false;
    return choices.some((c) => c.correct === true && normalizeText(c.text) === norm);
  }
  const answers = Array.isArray(q.answers) ? q.answers : [];
  const norm = normalizeText(given);
  if (!norm) return false;
  for (const accepted of answers) {
    const target = normalizeText(accepted);
    if (!target) continue;
    if (norm === target) return true;
    if (PURE_NUMBER.test(norm) && PURE_NUMBER.test(target) && Number(norm) === Number(target)) return true;
  }
  return false;
}

/** Stable per-question shuffle seed, so a reopened question keeps its order. */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(list, seed) {
  const out = list.slice();
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function renderVisual(container, visual) {
  container.textContent = '';
  const rows = visual && Array.isArray(visual.rows) ? visual.rows : [];
  if (!rows.length) { container.hidden = true; return; }
  for (const row of rows) {
    const line = el('div', 'sp-visual__row');
    if (row && row.label) line.appendChild(el('span', 'sp-visual__label', row.label));
    for (const tile of (row && Array.isArray(row.tiles) ? row.tiles : [])) {
      line.appendChild(el('span', 'sp-tile', String(tile)));
    }
    container.appendChild(line);
    if (row && row.arrow) container.appendChild(el('div', 'sp-visual__arrow', '↓'));
  }
  container.hidden = false;
}

/**
 * @param {ReturnType<typeof import('./modalHost.js').createModalHost>} host
 */
/** Tries per question (lead rule, all chapters). */
export const MAX_TRIES = 2;

export function createQuestionModal(host) {
  /**
   * @param {object} question
   * @returns {Promise<{correct: boolean, attempts: number}>}
   */
  function askQuestion(question) {
    return new Promise((resolve) => {
      if (!question || typeof question !== 'object') {
        resolve({ correct: false, attempts: 0 });
        return;
      }
      let attempts = 0;
      let answered = false;
      let cardFinish = () => {};

      const card = host.open((root) => {
        root.appendChild(el('div', 'sp-modal__eyebrow', [question.subject, question.difficulty].filter(Boolean).join(' · ') || 'Question'));
        root.appendChild(el('h3', 'sp-modal__title', question.title || 'Question'));
        root.appendChild(el('p', 'sp-modal__body', question.prompt || ''));

        const visual = el('div', 'sp-visual');
        renderVisual(visual, question.visual);
        root.appendChild(visual);

        const choicesWrap = el('div', 'sp-choices');
        const answerRow = el('div', 'sp-answer');
        const input = el('input', 'sp-answer__input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Type your answer';
        const submit = el('button', 'sp-btn', 'Submit');
        submit.type = 'button';
        answerRow.append(input, submit);

        const feedback = el('div', 'sp-feedback');
        feedback.hidden = true;
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'assertive');

        const actions = el('div', 'sp-modal__actions');
        // No "Not now" any more (lead rule, 2026-09-30): a question has to be
        // answered, in at most MAX_TRIES tries. Continue appears once it's
        // right - or, out of tries, as "Start this part again".
        const continueBtn = el('button', 'sp-btn', 'Continue');
        continueBtn.type = 'button';
        continueBtn.hidden = true;
        actions.append(continueBtn);
        let failed = false;

        const isChoice = question.type === 'choice' && Array.isArray(question.choices) && question.choices.length > 0;
        if (isChoice) {
          const ordered = seededShuffle(question.choices, hashSeed(question.id || question.title || 'q'));
          for (const choice of ordered) {
            const text = choice && typeof choice === 'object' ? String(choice.text ?? '') : String(choice ?? '');
            const btn = el('button', 'sp-choice', text);
            // An answer drawn only in shapes (a "what comes next" pattern) is
            // shown big and spaced, like the tiles it is compared with.
            if (/^[\s□●◆▲▶▼◀·★○■]+$/.test(text)) btn.classList.add('is-symbols');
            btn.type = 'button';
            btn.addEventListener('click', () => grade(choice, btn));
            choicesWrap.appendChild(btn);
          }
          root.appendChild(choicesWrap);
        } else {
          root.appendChild(answerRow);
        }
        root.appendChild(feedback);
        root.appendChild(actions);

        function showFeedback(text, kind) {
          feedback.className = `sp-feedback is-${kind}`;
          feedback.textContent = text;
          feedback.hidden = false;
        }

        function grade(graded, sourceButton) {
          if (answered || failed) return;
          const ok = checkAnswer(question, graded);
          if (!ok) {
            attempts += 1;
            if (sourceButton) {
              sourceButton.classList.add('is-wrong');
              sourceButton.classList.remove('is-shake');
              void sourceButton.offsetWidth;
              sourceButton.classList.add('is-shake');
            } else {
              input.select();
            }
            if (attempts >= MAX_TRIES) {
              // Out of tries: show the answer; this part of the voyage starts again.
              failed = true;
              choicesWrap.classList.add('is-done');
              input.disabled = true;
              submit.disabled = true;
              const right = (question.choices || []).find((c) => c && c.correct)?.text || (question.answers || [])[0] || '';
              const why = String(question.success || '').replace(/^(Correct|Right|Yes|Great|Exactly)[!.:,]*\s*/i, '');
              showFeedback(`That was your second try. ${right ? `The answer was: ${right.replace(/[.!?]+$/, '')}. ` : ''}${why} This part of the voyage starts again. You can do it!`.replace(/\s+/g, ' ').trim(), 'warn');
              continueBtn.textContent = 'Start this part again';
              continueBtn.hidden = false;
              try { continueBtn.focus(); } catch { /* detached */ }
              return;
            }
            const hint = question.hint || 'Have another go.';
            showFeedback(`Not quite. ${hint} One more try!`, 'warn');
            return;
          }
          answered = true;
          attempts += 1; // the winning attempt counts too, so attempts >= 1 always
          if (sourceButton) sourceButton.classList.add('is-right');
          choicesWrap.classList.add('is-done');
          input.disabled = true;
          submit.disabled = true;
          showFeedback(question.success || 'Correct!', 'good');
          continueBtn.hidden = false;
          try { continueBtn.focus(); } catch { /* detached */ }
        }

        submit.addEventListener('click', () => {
          const given = input.value.trim();
          if (!given) { showFeedback('Type your answer in the box, then press Submit.', 'warn'); return; }
          grade(given, null);
        });
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); submit.click(); }
        });
        input.addEventListener('keyup', (e) => e.stopPropagation());

        function finish() {
          host.close();
          resolve({ correct: answered, failed, attempts: Math.max(attempts, answered ? 1 : 0) });
        }
        continueBtn.addEventListener('click', finish);
        // Escape only works once there's a result (it can't skip a question).
        cardFinish = () => { if (answered || failed) finish(); };

        const first = isChoice ? choicesWrap.querySelector('button') : input;
        if (first) setTimeout(() => { try { first.focus(); } catch { /* detached */ } }, 0);
      }, {
        onEscape: () => cardFinish(),
      });

      void card;
    });
  }

  return { askQuestion };
}
