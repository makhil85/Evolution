// Which body each dot of the predicted path hangs off, and where (no
// three.js: trajectoryView.js draws with it, scripts test it under node).
//
// A dot is stored as an offset from a body and re-attached to that body's
// CURRENT position every frame (trajectoryView.js explains why).
import { BODIES } from './contracts.js';
import { bodyState } from './orbits.js';

const _s = { x: 0, z: 0, vx: 0, vz: 0 };
const SUN0 = Object.freeze({ x: 0, z: 0, vx: 0, vz: 0 });

/** Is `a` the parent (or grandparent...) of `b`? The Sun is everyone's. */
function isAncestor(a, b) {
  for (let p = BODIES[b]?.parent; p; p = BODIES[p]?.parent) if (p === a) return true;
  return a === 'sun' && b !== 'sun';
}

/**
 * Fills rel[2i], rel[2i+1] (offset) and frameOf[i] (body id) for the first n
 * points of a predictor result. Drawn position = rel + that body's position now.
 */
export function anchorPath(pred, n, rel, frameOf) {
  // frames: [{body, from, to}] runs of sample indices.
  // LEAVING a body (Moon -> Earth's pull -> the Sun's) the path stays
  // drawn in the frame she is in now, joined where it crosses over. Each
  // point used to hang off its own frame body's current position, which
  // tore the line apart at every edge it left through: Earth moves 31 u
  // a second round the Sun, so the part after leaving Earth's pull was
  // drawn up to 8,000 u ahead of the rest, and the gap changed every
  // moment (lead, 2026-10-04: "from the Moon back to Earth or to Mars it
  // keeps on changing"). Into the Sun's pull it is drawn as seen from the
  // planet she is leaving (she drifts slowly away from it); into a
  // planet's pull from a moon's, as an orbit round that planet, shifted
  // to join on. Reaching a NEW body (the Moon, Mars, Europa) keeps the
  // old way: the loop round it is drawn round the body itself.
  const home = pred.frames[0]?.body || 'sun';
  let run = 0;
  let inHome = true; // still in the joined-up frame that moves with `home`
  let D = home; let kx = 0; let kz = 0; let prev = home;
  let ch = 0; // next entry of pred.soiChanges (exact crossing times)
  const pos = (id, t) => (id === 'sun' ? SUN0 : bodyState(id, t, _s));
  for (let i = 0; i < n; i++) {
    while (run < pred.frames.length - 1 && i > pred.frames[run].to) run++;
    const body = pred.frames[run]?.body || 'sun';
    const t = pred.times[i];
    if (body !== prev) {
      // The exact moment it crosses (else this dot's), so the join doesn't
      // jump by a dot's worth of motion from one refresh to the next.
      while (ch < (pred.soiChanges?.length || 0) && pred.soiChanges[ch].to !== body) ch++;
      const tc = ch < (pred.soiChanges?.length || 0) ? pred.soiChanges[ch++].t : t;
      if (inHome && isAncestor(body, prev)) {
        if (body !== 'sun') { // re-frame to the planet, joined where it crosses
          const a = pos(body, tc); const ax = a.x; const az = a.z;
          const d = pos(D, tc);
          kx += ax - d.x; kz += az - d.z; D = body;
        }
      } else inHome = false;
      prev = body;
    }
    const f = inHome ? D : body;
    const b = pos(f, t);
    frameOf[i] = inHome ? home : body;
    rel[i * 2] = pred.points[i * 2] - b.x + (inHome ? kx : 0);
    rel[i * 2 + 1] = pred.points[i * 2 + 1] - b.z + (inHome ? kz : 0);
  }
}
