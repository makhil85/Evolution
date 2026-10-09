// Chapter 7, Part D: the rules of "Where is it really?" (no drawing; the card
// is lensGame.js, the 3-D holodeck quasar is holodeck.js). Lead 2026-10-08: the
// holodeck shows a quasar, a black hole eating gas, and its gravity bends the
// light of the stars behind it. A kid sees a star where its light ARRIVES, and
// must tap where the star REALLY is.
//
// The rule, for a point lens (angles in units of the Einstein radius, theta_E):
// a source at true offset beta appears at
//     theta = (beta + sqrt(beta^2 + 4)) / 2      (the bright main image: always
//                                                 farther out than beta, same side)
// and a second, faint image at (beta - sqrt(beta^2 + 4)) / 2 (the other side,
// nearer the hole). So the true place is beta = theta - 1/theta, because
// theta^2 - beta*theta - 1 = 0. Seen straight on, a star is pushed AWAY from the
// hole; lined up exactly (beta = 0) its images make the Einstein ring at theta = 1.
//
// Taps are in Einstein radii, { x, y } with y up and the hole at (0, 0). The
// card draws 1 theta_E as UNIT pixels. Each mode has a tolerance (how close a tap
// must land) and a band of true offsets. In those bands the seen place is always
// at least 0.46 theta_E from the true one, so tapping where a star LOOKS is never
// within any mode's tolerance (scripts/test-ch7-lens.mjs checks this).
export const EINSTEIN_RAD = 0.2;   // the Einstein ring's radius on the holodeck screen (radians); holodeck.js draws the same
export const SHADOW_SHARE = 0.4;   // the black shadow's radius, as a share of theta_E (light inside it never gets out)
export const ROUNDS = Object.freeze({ easy: 3, medium: 4, hard: 5 });               // stars to find
export const LIVES = Object.freeze({ easy: 4, medium: 3, hard: 3 });                // misses before the card is lost
export const TOLERANCE = Object.freeze({ easy: 0.5, medium: 0.3, hard: 0.22 });     // theta_E: how close a tap must be
export const BETA_RANGE = Object.freeze({ easy: [0.6, 1.1], medium: [0.45, 1.5], hard: [0.3, 1.7] });

/** The bright main image of a source at true offset beta (theta_E units). */
export const mainImage = (beta) => (beta + Math.sqrt(beta * beta + 4)) / 2;
/** The faint second image (negative: the other side of the hole). */
export const minorImage = (beta) => (beta - Math.sqrt(beta * beta + 4)) / 2;
/** The true offset behind a seen bright image: the rule the child is learning. */
export const trueFromSeen = (theta) => theta - 1 / theta;

/** How bright each image is, as a share of the star (|mu|): main > 1; minor < 1 and it fades far out. */
export function magnification(beta) {
  const k = (beta * beta + 2) / (2 * beta * Math.sqrt(beta * beta + 4));
  return { main: Math.abs(0.5 + k), minor: Math.abs(0.5 - k) };
}

/** The point at radius r (theta_E units) on the line at angle phi; a negative r is the far side. */
export const spot = (r, phi) => ({ x: r * Math.cos(phi), y: r * Math.sin(phi) });

/** Where a star really is (the tap that wins). */
export const truePoint = (star) => spot(star.beta, star.phi);
/** Where it appears: the bright image the kid sees. */
export const seenPoint = (star) => spot(mainImage(star.beta), star.phi);
/** The faint second image (Hard only). */
export const faintPoint = (star) => spot(minorImage(star.beta), star.phi);

/** The light path from the real star out to the seen image. It bows round the hole (for the picture). */
export function lightPath(star, n = 24) {
  const out = [];
  const to = mainImage(star.beta);
  const bow = 0.35; // radians; the same way round for every star
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    out.push(spot(star.beta + (to - star.beta) * s, star.phi + bow * Math.sin(Math.PI * s)));
  }
  return out;
}

/** Stars for one round: evenly round the hole, a little jittered, each at a true offset in its mode's band. */
export function makeRound(mode, rnd = Math.random) {
  const n = ROUNDS[mode];
  const [lo, hi] = BETA_RANGE[mode];
  const stars = [];
  for (let i = 0; i < n; i++) {
    const phi = ((2 * Math.PI) / n) * (i + 0.25 + 0.5 * rnd());
    stars.push({ beta: lo + (hi - lo) * rnd(), phi });
  }
  return stars;
}

/** A new card: stars to find, lives left, and whether it is still on. */
export function newGame(mode, rnd = Math.random) {
  return { mode, stars: makeRound(mode, rnd), next: 0, lives: LIVES[mode], status: 'playing', last: null };
}

/** Distance between two points (theta_E units). */
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Is a tap close enough to the star that is next to find? */
export function tapHits(game, pt) {
  const star = game.stars[game.next];
  return !!star && distance(pt, truePoint(star)) <= TOLERANCE[game.mode];
}

/**
 * One tap on the card: a hit moves on to the next star (the last one wins), a
 * miss costs a life (none left: lost). Returns a new object; `last` says what
 * happened ({ hit, star }) so the card can draw the bent path.
 */
export function tapGame(game, pt) {
  if (game.status !== 'playing') return game;
  const star = game.next;
  if (tapHits(game, pt)) {
    const next = game.next + 1;
    return { ...game, next, status: next >= game.stars.length ? 'won' : 'playing', last: { hit: true, star } };
  }
  const lives = game.lives - 1;
  return { ...game, lives, status: lives <= 0 ? 'lost' : 'playing', last: { hit: false, star } };
}

/** The rule player: reads the bright image, works out beta = theta - 1/theta, taps there (with a small wobble). */
export function ruleTap(star, mode, rnd = Math.random) {
  const p = spot(trueFromSeen(mainImage(star.beta)), star.phi);
  const wobble = TOLERANCE[mode] * 0.3;
  return { x: p.x + (rnd() * 2 - 1) * wobble, y: p.y + (rnd() * 2 - 1) * wobble };
}

/** The naive player: taps where the star LOOKS (the bright image), ignoring the bend. */
export const naiveTap = (star) => seenPoint(star);
