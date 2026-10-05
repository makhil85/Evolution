// Which body each dot of the predicted path hangs off, and where (no
// three.js: trajectoryView.js draws with it, scripts test it under node).
//
// A dot is stored as an offset from a body and re-attached to that body's
// CURRENT position every frame (trajectoryView.js explains why).
import { bodyState } from './orbits.js';

const _s = { x: 0, z: 0, vx: 0, vz: 0 };
const SUN0 = Object.freeze({ x: 0, z: 0, vx: 0, vz: 0 });

/**
 * Fills rel[2i], rel[2i+1] (offset) and frameOf[i] (body id) for the first n
 * points of a predictor result. Drawn position = rel + that body's position now.
 */
export function anchorPath(pred, n, rel, frameOf) {
  // ONE UNBROKEN LINE. frames: [{body, from, to}] runs of sample indices, each
  // a different body's pull. Every run is drawn in the frame she is in NOW and
  // JOINED where the path crosses from one to the next (lead, 2026-10-05: "the
  // trajectory paths look weird after each burn"). Each point used to hang off
  // its own run body's CURRENT position, which tore the line apart at every
  // edge: a path from Earth orbit reaching the Moon was drawn as an Earth
  // ellipse plus a loop round where the Moon is NOW, while she arrives where
  // the Moon WILL BE - up to 400 u away in a 500 u system, so the dotted line
  // broke in two and the second half swung about as the Moon went round. (And
  // leaving Earth for Mars the gap was thousands of units: Earth moves 31 u a
  // second.) Joined, the line goes where the body will be - the same place the
  // "where the target will be" ghost marks - and the loop round the body she
  // is actually inside (she is then in its frame) is drawn round the body
  // itself, as before.
  const home = pred.frames[0]?.body || 'sun';
  let run = 0;
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
      // Out into the Sun's pull: stay in the frame of the planet she is
      // leaving (she drifts slowly away from it) rather than re-framing to
      // the Sun, which would smear the line across the planet's own motion.
      if (body !== 'sun') {
        // `pos` hands back one shared scratch object: read the first before
        // asking for the second.
        const a = pos(body, tc); const ax = a.x; const az = a.z;
        const d = pos(D, tc);
        kx += ax - d.x; kz += az - d.z; D = body;
      }
      prev = body;
    }
    const b = pos(D, t);
    frameOf[i] = home;
    rel[i * 2] = pred.points[i * 2] - b.x + kx;
    rel[i * 2 + 1] = pred.points[i * 2 + 1] - b.z + kz;
  }
}
