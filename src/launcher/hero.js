// Girl or boy: the first choice on a fresh start (lead 2026-10-05).
//
// The hero is built ONCE (the character page) and the same hero walks through
// every chapter. The text was written about a girl ("Zara ... she ... her"),
// so for a boy this module swaps the pronouns in text that is about the hero:
//
//   heroText('She drops her pencil.')   -> 'He drops his pencil.'   (boy)
//   heroQuestion(q)   every string field of a bank question, but only when
//                     the question mentions Zara (so "a scientist ... she"
//                     about someone else stays as written)
//
// Read once per page from the launcher's profile, like the name and Level.
// Pure: no DOM, safe to import from node.

const PROFILE_KEY = 'rocket_village_profile';

/** 'girl' or 'boy' (a missing or unknown value is a girl, the authored default). */
export const HERO_KIND = (() => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')?.hero === 'boy' ? 'boy' : 'girl';
  } catch {
    return 'girl';
  }
})();

export const IS_BOY = HERO_KIND === 'boy';

/** Words after "her" that make it "him" rather than "his" ("pulled her along"). */
const OBJECT_NEXT = new Set([
  'along', 'up', 'down', 'off', 'in', 'out', 'back', 'away', 'to', 'from', 'with', 'into', 'onto', 'over',
  'and', 'or', 'so', 'as', 'than', 'the', 'a', 'an', 'much', 'more', 'further', 'farther', 'far', 'higher',
  'count', 'use', 'finish', 'go', 'say', 'fly', 'drift', 'try', 'know', 'see', 'think', 'do', 'have', 'pick',
  'keep', 'be', 'get', 'feel', 'tell', 'is', 'at', 'on',
]);

/** Swap she/her/herself for he/him/his/himself in `text` (for any `kind`). */
export function swapPronouns(text, kind = HERO_KIND) {
  if (kind !== 'boy' || typeof text !== 'string') return text;
  const cap = (w, s) => (w[0] === w[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s);
  return text
    .replace(/\b(she)\b/gi, (w) => (w === 'SHE' ? 'HE' : cap(w, 'he')))
    .replace(/\b(herself)\b/gi, (w) => cap(w, 'himself'))
    .replace(/\b(hers)\b/gi, (w) => cap(w, 'his'))
    .replace(/\b(her)\b(\s*)([\w’']*)/gi, (m, w, sp, next) => {
      const n = next.toLowerCase();
      const obj = !next || /^\d/.test(next) || OBJECT_NEXT.has(n);
      return cap(w, obj ? 'him' : 'his') + sp + next;
    });
}

/** Text about the hero, with the right pronouns. */
export const heroText = (text) => swapPronouns(text);

const FIELDS = ['prompt', 'text', 'hint', 'parentHint', 'success', 'doneMessage', 'title', 'why', 'explanation', 'body'];

/** A bank question with the hero's pronouns, when it is about the hero (mentions Zara). */
export function heroQuestion(q, kind = HERO_KIND) {
  if (kind !== 'boy' || !q || typeof q !== 'object') return q;
  const all = [...FIELDS.map((k) => q[k]), ...(Array.isArray(q.choices) ? q.choices.map((c) => c.text) : [])];
  if (!all.some((s) => typeof s === 'string' && /\bZara/.test(s))) return q;
  const out = { ...q };
  for (const k of FIELDS) if (typeof q[k] === 'string') out[k] = swapPronouns(q[k], kind);
  if (Array.isArray(q.choices)) out.choices = q.choices.map((c) => ({ ...c, text: swapPronouns(c.text, kind) }));
  if (q.visual?.rows) out.visual = { ...q.visual, rows: q.visual.rows.map((r) => ({ ...r, label: swapPronouns(r.label, kind) })) };
  return out;
}
