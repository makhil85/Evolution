// Chapter 7's question bank: each part's own file (questions.partA..E.js,
// each built by its work package), merged at the child's Level. The Level 1
// overlay of a part replaces the Level 4 text of the same ids.
import { CH7A_QUESTIONS, CH7A_LEVEL1 } from './questions.partA.js';
import { CH7B_QUESTIONS, CH7B_LEVEL1 } from './questions.partB.js';
import { CH7C_QUESTIONS, CH7C_LEVEL1 } from './questions.partC.js';
import { CH7D_QUESTIONS, CH7D_LEVEL1 } from './questions.partD.js';
import { CH7E_QUESTIONS, CH7E_LEVEL1 } from './questions.partE.js';

const PARTS = [
  [CH7A_QUESTIONS, CH7A_LEVEL1], [CH7B_QUESTIONS, CH7B_LEVEL1], [CH7C_QUESTIONS, CH7C_LEVEL1],
  [CH7D_QUESTIONS, CH7D_LEVEL1], [CH7E_QUESTIONS, CH7E_LEVEL1],
];

/** Every Chapter 7 question, at Level 4 or Level 1. */
export function ch7Bank(level = 4) {
  const out = {};
  for (const [l4, l1] of PARTS) {
    for (const [id, q] of Object.entries(l4)) out[id] = level === 1 ? { ...q, ...(l1[id] || {}) } : q;
  }
  return out;
}
