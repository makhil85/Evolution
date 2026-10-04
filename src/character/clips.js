// Her animations, written as maths rather than keyframed by hand.
//
// Each clip is a function from "how far through the cycle are we" to a pose:
// a rotation per bone, plus the hips' position where the body has to rise and
// fall. Sampling that function at a fixed rate produces ordinary keyframe
// tracks, which is what both consumers need - THREE.AnimationClip for playback
// and glTF samplers for the export. Neither gets a special case, so the girl
// who walks on the character page is the girl in the .glb, exactly.
//
// Written this way because the alternative is authoring some three hundred
// keyframes by hand in source, which nobody can read and nobody will ever
// adjust. Here, "make the run longer-strided" is one number.
//
// Convention, and the thing to hold on to when editing: every limb bone points
// DOWN the -Y axis in the rest pose, so a positive X rotation swings the end of
// that limb forward, and a Z rotation swings it out to the side - +Z lifts the
// LEFT arm, -Z the right.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Knees and elbows hinge one way only; this is the half-wave that does it. */
const hinge = (x) => Math.max(0, Math.sin(x));

// --- the poses ---------------------------------------------------------------
// Each returns { rot: {bone: [x,y,z]}, pos: {bone: [x,y,z]} } in model units.
// Bones left out of rot stay at rest, which keeps the track count - and the
// exported file - down to what actually moves.

function idlePose(u) {
  const breath = Math.sin(u * TAU);       // one breath per clip
  const shift = Math.sin(u * TAU * 0.5);  // weight moving foot to foot
  return {
    rot: {
      hips: [0, shift * 0.04, shift * 0.035],
      spine: [breath * 0.012, 0, 0],
      chest: [-0.02 + breath * 0.022, shift * -0.03, 0],
      head: [breath * 0.03 - 0.01, shift * 0.16, 0],
      // Arms held a touch off the body: a child at rest is not a tin soldier.
      armL: [breath * 0.03, 0, 0.07],
      armR: [breath * 0.03, 0, -0.07],
      forearmL: [-0.14, 0, 0.05],
      forearmR: [-0.14, 0, -0.05],
    },
    pos: { hips: [0, breath * 0.009, 0] },
  };
}

function stridePose(u, k) {
  // One shared gait, scaled by k: walking and running differ in size and lean
  // far more than they differ in shape.
  const p = u * TAU;
  const s = Math.sin(p);
  const thighL = s * k.stride;
  const thighR = -s * k.stride;
  // The knee folds a beat AFTER the thigh swings back, and that lag is most of
  // what separates a walk from a pair of scissors. POSITIVE X folds a knee
  // (heel toward the seat) on this rig - checked on side renders; the old
  // minus sign bent the knees backward like a bird's.
  const shinL = hinge(p - 0.9) * k.knee;
  const shinR = hinge(p + Math.PI - 0.9) * k.knee;
  return {
    rot: {
      // Hips roll onto whichever leg is carrying her.
      hips: [k.lean * 0.25, s * 0.09, Math.cos(p * 2) * 0.03],
      spine: [k.lean * 0.4, 0, 0],
      chest: [k.lean * 0.35, -s * 0.11, 0],
      head: [-k.lean * 0.55, s * 0.05, 0],

      thighL: [thighL, 0, 0.02],
      shinL: [shinL, 0, 0],
      footL: [-(thighL + shinL) * 0.45 + 0.08, 0, 0],
      thighR: [thighR, 0, -0.02],
      shinR: [shinR, 0, 0],
      footR: [-(thighR + shinR) * 0.45 + 0.08, 0, 0],

      // Arms counter the legs. Same-side arm and leg swinging together is the
      // classic tell that an animation was never actually looked at.
      armL: [-s * k.swing, 0, 0.08],
      armR: [s * k.swing, 0, -0.08],
      forearmL: [-k.elbow - hinge(-p) * k.elbow * 0.3, 0, 0],
      forearmR: [-k.elbow - hinge(-p + Math.PI) * k.elbow * 0.3, 0, 0],
    },
    // Twice per cycle, because there are two footfalls in one cycle.
    pos: { hips: [0, Math.abs(Math.sin(p)) * k.bob - k.bob * 0.5, 0] },
  };
}

const walkPose = (u) => stridePose(u, {
  stride: 0.60, knee: 0.95, swing: 0.48, elbow: 0.30, lean: 0.10, bob: 0.045,
});

const runPose = (u) => stridePose(u, {
  stride: 0.92, knee: 1.55, swing: 0.85, elbow: 1.05, lean: 0.34, bob: 0.10,
});

function wavePose(u) {
  const wave = Math.sin(u * TAU * 3);   // three waves per loop
  const settle = Math.min(1, u * 6);    // the arm comes up rather than snapping
  return {
    rot: {
      hips: [0, -0.05, 0],
      chest: [0, -0.12, 0],
      head: [0.04, -0.12, 0],
      // Right arm up and out: Z is the side-swing axis, negative for her right.
      armR: [0, 0, -2.42 * settle],
      forearmR: [0, 0, (-0.2 + wave * 0.5) * settle],
      handR: [0, 0, wave * 0.25],
      armL: [0.05, 0, 0.09],
      forearmL: [-0.2, 0, 0.05],
    },
    pos: { hips: [0, Math.sin(u * TAU) * 0.006, 0] },
  };
}

function cheerPose(u) {
  // One hop per loop, arms punching up twice.
  const hop = Math.abs(Math.sin(u * TAU));
  const punch = 0.2 * Math.sin(u * TAU * 2);
  return {
    rot: {
      hips: [-0.06, 0, 0],
      spine: [-0.07, 0, 0],
      chest: [-0.06, 0, 0],
      head: [-0.16, 0, 0],
      armL: [0.1, 0, 2.55 + punch],
      armR: [0.1, 0, -2.55 - punch],
      forearmL: [-0.25, 0, 0.3],
      forearmR: [-0.25, 0, -0.3],
      // Knees bend on the way down. Without that the hop reads as the whole
      // model sliding up and down rather than as weight.
      // (Signs fixed 2026-09-30: thighs forward, knees fold, feet flat.)
      thighL: [-0.18 * (1 - hop), 0, 0.05],
      shinL: [0.36 * (1 - hop), 0, 0],
      thighR: [-0.18 * (1 - hop), 0, -0.05],
      shinR: [0.36 * (1 - hop), 0, 0],
      footL: [-0.18 * (1 - hop), 0, 0],
      footR: [-0.18 * (1 - hop), 0, 0],
    },
    pos: { hips: [0, hop * 0.1 - 0.02, 0] },
  };
}

// --- fun moves (keys J / K / L in the villages) --------------------------------
//
// Checked on renders (side view). She faces +Z, so an X rotation moves a bone
// that points DOWN and one that points UP opposite ways:
//   arms and legs (hang down):  NEGATIVE X swings them forward;
//   a shin folds the knee (heel toward the seat) with POSITIVE X;
//   hips / spine / chest / head (point up): POSITIVE X bends her forward.
// These three clips are written to that.

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

function jumpingJacksPose(u) {
  // Two jacks per loop: out on the first hop, back in on the second.
  const p = u * TAU * 2;
  const open = (1 - Math.cos(p)) / 2;          // 0 feet together, 1 star shape
  const hop = Math.abs(Math.sin(p));           // airborne between the two
  const land = 1 - hop;
  return {
    rot: {
      spine: [0.02, 0, 0],
      head: [-0.05 * open, 0, 0],
      // Arms sweep out and up to a clap over her head.
      armL: [0, 0, 0.08 + open * 2.85],
      armR: [0, 0, -0.08 - open * 2.85],
      forearmL: [-0.1, 0, 0.12 * open],
      forearmR: [-0.1, 0, -0.12 * open],
      // Legs out to the side, feet kept flat.
      thighL: [-0.14 * land, 0, 0.3 * open],
      thighR: [-0.14 * land, 0, -0.3 * open],
      shinL: [0.28 * land, 0, 0],
      shinR: [0.28 * land, 0, 0],
      footL: [-0.14 * land, 0, -0.3 * open],
      footR: [-0.14 * land, 0, 0.3 * open],
    },
    pos: { hips: [0, hop * 0.07 - land * 0.03 - open * 0.015, 0] },
  };
}

function dancePose(u) {
  // A happy side-to-side groove: hips sway on the beat, knees take turns,
  // elbows bent and pumping, head bobbing. Four beats per loop.
  const b = u * TAU * 2;                       // one sway = two beats
  const sway = Math.sin(b);
  const bounce = Math.abs(Math.cos(b));
  const pump = Math.sin(b * 2);
  // Halfway through, the fists go up over her head ("raise the roof") and
  // come back down, so the loop has a bit of a routine to it.
  const up = (1 - Math.cos(u * TAU)) / 2;
  const down = 1 - up;
  return {
    rot: {
      hips: [0, sway * 0.3, sway * 0.09],
      spine: [0.04, -sway * 0.1, -sway * 0.08],
      chest: [0.03, -sway * 0.14, -sway * 0.1],
      head: [0.1 * pump, sway * 0.22, sway * 0.12],
      // Elbows bent, fists up in front, pumping in turn...
      armL: [-(0.45 + 0.4 * pump) * down, 0, 0.3 * down + (2.45 + 0.25 * pump) * up],
      armR: [-(0.45 - 0.4 * pump) * down, 0, -0.3 * down - (2.45 - 0.25 * pump) * up],
      // ...or pushing up at the sky.
      forearmL: [-1.5 * down, 0, 0.45 * up],
      forearmR: [-1.5 * down, 0, -0.45 * up],
      handL: [0, 0, 0.3 * pump],
      handR: [0, 0, 0.3 * pump],
      // Knees take turns lifting.
      thighL: [-0.4 * Math.max(0, sway), 0, 0.06],
      thighR: [-0.4 * Math.max(0, -sway), 0, -0.06],
      shinL: [0.7 * Math.max(0, sway), 0, 0],
      shinR: [0.7 * Math.max(0, -sway), 0, 0],
      footL: [-0.25 * Math.max(0, sway), 0, 0],
      footR: [-0.25 * Math.max(0, -sway), 0, 0],
    },
    pos: { hips: [sway * 0.055, -bounce * 0.04 - 0.015, 0] },
  };
}

function rollPose(u) {
  // A forward roll: crouch and tuck, one full turn over, unfold, stand.
  // The body turns in place round her middle; the game slides her forward
  // along the ground while it plays (see src/game/emotes.js).
  const tuck = smooth(u / 0.18) * (1 - smooth((u - 0.8) / 0.2));
  const turn = smooth((u - 0.16) / 0.64) * TAU; // 0 .. one full turn, head first
  // Curled up she is a ball about 0.24 across round the hips, so the hips
  // ride that high above the ground while she rolls.
  const ball = 0.26;
  // Upside down, her curled back is below the hips, so they ride higher then.
  const hipY = -0.62 * tuck + ball * tuck + 0.2 * (1 - Math.cos(turn)) / 2;
  return {
    rot: {
      hips: [turn, 0, 0],
      // Curled forward, chin tucked, hands reaching past the knees.
      spine: [0.5 * tuck, 0, 0],
      chest: [0.45 * tuck, 0, 0],
      head: [0.55 * tuck, 0, 0],
      armL: [-1.2 * tuck, 0, 0.12],
      armR: [-1.2 * tuck, 0, -0.12],
      forearmL: [-0.9 * tuck, 0, 0],
      forearmR: [-0.9 * tuck, 0, 0],
      // Knees pulled up to the chest, heels to the seat.
      thighL: [-2.0 * tuck, 0, 0.05],
      thighR: [-2.0 * tuck, 0, -0.05],
      shinL: [2.3 * tuck, 0, 0],
      shinR: [2.3 * tuck, 0, 0],
      footL: [-0.4 * tuck, 0, 0],
      footR: [-0.4 * tuck, 0, 0],
    },
    pos: { hips: [0, hipY, 0] },
  };
}

function moonwalkPose(u) {
  // The famous backward glide: one foot flat and sliding back while the other
  // is up on its toes with the knee bent, swapping twice per loop. The game
  // slides her backward along the ground while it plays (src/game/emotes.js).
  const p = u * TAU;
  const s = Math.sin(p);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const upL = smooth(clamp01(s * 1.6));   // left heel raised (right foot sliding)
  const upR = smooth(clamp01(-s * 1.6));  // right heel raised (left foot sliding)
  // The flat foot slides from in front to behind her; the raised one comes back.
  const swingL = 0.02 + 0.28 * Math.cos(p);
  const swingR = 0.02 - 0.28 * Math.cos(p);
  const beat = Math.abs(s);
  return {
    rot: {
      hips: [0.02, 0, 0.04 * s],
      spine: [0.06, 0, -0.03 * s],
      chest: [0.04, 0.06 * s, 0],
      head: [0.06 * beat - 0.02, 0.08 * s, 0],
      // Elbows bent, hands loose in front, a small shrug on each step.
      armL: [-0.35 - 0.1 * beat, 0, 0.18],
      armR: [-0.35 - 0.1 * beat, 0, -0.18],
      forearmL: [-1.0, 0, 0],
      forearmR: [-1.0, 0, 0],
      handL: [0.3, 0, 0],
      handR: [0.3, 0, 0],
      thighL: [swingL - 0.42 * upL, 0, 0.03],
      thighR: [swingR - 0.42 * upR, 0, -0.03],
      shinL: [0.95 * upL, 0, 0],
      shinR: [0.95 * upR, 0, 0],
      // Up on the toes (heel lifted), or flat.
      footL: [0.8 * upL - swingL * 0.5, 0, 0],
      footR: [0.8 * upR - swingR * 0.5, 0, 0],
    },
    pos: { hips: [0, -0.025 * (upL + upR), 0] },
  };
}

function handstandPose(u) {
  // Arms up, tip forward onto the hands, legs up into a handstand with a
  // little wobble and a scissor of the legs, then back down the same way.
  // The hands must land and STAY on the ground in front of her, so instead of
  // turning round her middle the whole body moves over them as she tips.
  const armsUp = smooth(u / 0.12) * (1 - smooth((u - 0.88) / 0.1));
  const f = smooth((u - 0.08) / 0.22) * (1 - smooth((u - 0.7) / 0.22));
  const hold = smooth((u - 0.3) / 0.08) * (1 - smooth((u - 0.62) / 0.08));
  const th = Math.PI * f;                 // body pitch: 0 standing, PI upside down
  const L = 0.94;                         // hips to fingertips, arms overhead
  const REST = 0.62;                      // hip height standing
  const contact = 1.9;                    // pitch at which the hands meet the ground
  const handZ = 0.55;                     // where the hands land, ahead of her feet
  let hy;
  let hz;
  if (th >= contact) {
    hy = 0.03 - L * Math.cos(th);        // hands on the ground below her hips...
    hz = handZ - L * Math.sin(th);        // ...and not sliding while she tips
  } else {
    const k = th / contact;
    const cy = 0.03 - L * Math.cos(contact);
    const cz = handZ - L * Math.sin(contact);
    hy = REST + (cy - REST) * k ** 1.5;
    hz = cz * k;
  }
  const wobble = hold * Math.sin(u * TAU * 4);
  return {
    rot: {
      hips: [th + 0.04 * wobble, 0, 0.05 * wobble],
      // Head looks at the ground between the hands.
      head: [-0.3 * f, 0, 0],
      // Arms reach forward and up, overhead, in line with the body.
      armL: [-Math.PI * 0.97 * armsUp, 0, 0.14],
      armR: [-Math.PI * 0.97 * armsUp, 0, -0.14],
      forearmL: [-0.05, 0, 0],
      forearmR: [-0.05, 0, 0],
      handL: [-1.2 * f, 0, 0],
      handR: [-1.2 * f, 0, 0],
      // Straight legs, a gentle scissor at the top, toes pointed.
      thighL: [-0.32 * hold * Math.cos(u * TAU * 2), 0, 0.03],
      thighR: [0.32 * hold * Math.cos(u * TAU * 2), 0, -0.03],
      footL: [0.6 * f, 0, 0],
      footR: [0.6 * f, 0, 0],
    },
    pos: { hips: [0, hy - REST, hz] },
  };
}

const ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function chopPose(u) {
  // Mining swing (src/play/tools.js): both hands up over the head, a quick
  // strike down and forward, then back to rest. NEGATIVE X swings a hanging
  // arm forward on this rig; POSITIVE X bends the chest forward.
  const up = ramp(0, 0.38, u);
  const hit = ramp(0.42, 0.58, u);
  const rest = ramp(0.72, 1, u);
  const keep = 1 - rest;
  const arm = (-2.7 * up + 1.55 * hit) * keep;
  const fore = -0.35 * up * (1 - hit) * keep;
  return {
    rot: {
      spine: [(-0.08 * up + 0.2 * hit) * keep, 0, 0],
      chest: [(-0.12 * up + 0.32 * hit) * keep, 0, 0],
      head: [(-0.15 * up + 0.12 * hit) * keep, 0, 0],
      armR: [arm, 0, 0.22 * keep],
      armL: [arm * 0.95, 0, -0.22 * keep],
      forearmR: [fore, 0, 0],
      forearmL: [fore, 0, 0],
      thighL: [-0.12 * hit * keep, 0, 0],
      shinL: [0.24 * hit * keep, 0, 0],
      thighR: [-0.12 * hit * keep, 0, 0],
      shinR: [0.24 * hit * keep, 0, 0],
    },
    pos: { hips: [0, -0.03 * hit * keep, 0] },
  };
}

function inspectPose(u) {
  // Science: the magnifying glass up at eye height, peering left and right.
  const lift = ramp(0, 0.2, u) * (1 - ramp(0.8, 1, u));
  const look = Math.sin(u * TAU * 1.5) * 0.25 * lift;
  return {
    rot: {
      chest: [0.14 * lift, look * 0.4, 0],
      head: [0.22 * lift, look, 0],
      armR: [-1.45 * lift, look * 0.5, 0.15 * lift],
      forearmR: [-0.7 * lift, 0, 0],
      armL: [0.05, 0, 0.1],
      forearmL: [-0.25, 0, 0.05],
    },
    pos: {},
  };
}

function splitsPose(u) {
  // Slide down into the front splits, arms out wide ("ta-da!"), a little
  // bounce, then back up.
  const down = smooth(u / 0.28) * (1 - smooth((u - 0.78) / 0.22));
  const hold = smooth((u - 0.28) / 0.08) * (1 - smooth((u - 0.72) / 0.08));
  const bob = hold * Math.sin(u * TAU * 3) * 0.015;
  return {
    rot: {
      spine: [0.05 * down, 0, 0],
      head: [-0.12 * hold, 0, 0],
      // Left leg straight out in front, right leg straight out behind.
      thighL: [-1.52 * down, 0, 0.04],
      thighR: [1.52 * down, 0, -0.04],
      // Pointed toes along each leg.
      footL: [0.7 * down, 0, 0],
      footR: [0.5 * down, 0, 0],
      // Arms up and out in a V, a small wave of the hands.
      armL: [0, 0, 0.1 + 2.1 * hold],
      armR: [0, 0, -0.1 - 2.1 * hold],
      forearmL: [0, 0, 0.15 * hold],
      forearmR: [0, 0, -0.15 * hold],
      handL: [0, 0, 0.3 * hold * Math.sin(u * TAU * 4)],
      handR: [0, 0, -0.3 * hold * Math.sin(u * TAU * 4)],
    },
    // Hips from standing height (0.62) down to sitting on the ground.
    pos: { hips: [0, -0.52 * down + bob, 0] },
  };
}

function backWalkoverPose(u) {
  // Arms up, arch back until the hands land on the ground BEHIND her, kick
  // the legs up and over through a handstand, land on the feet behind the
  // hands, then step forward to where she started (so the move ends on the
  // spot and the game never has to move her).
  const armsUp = smooth(u / 0.1) * (1 - smooth((u - 0.8) / 0.08));
  const over = smooth((u - 0.08) / 0.64);            // 0 standing .. 1 landed
  const phi = TAU * over;                            // backward pitch, one full turn
  const L = 0.94;                                    // hips to fingertips, arms overhead
  const REST = 0.62;
  const contact = 1.9;
  const handZ = 0.45;                                // hands land this far behind her
  // First half (arching back onto the hands) as the handstand, mirrored
  // behind her; second half (legs coming over) mirrors the first about the
  // planted hands.
  const half = (a) => {
    if (a >= contact) return { y: 0.03 - L * Math.cos(a), z: -(handZ - L * Math.sin(a)) };
    const k = a / contact;
    const cy = 0.03 - L * Math.cos(contact);
    const cz = -(handZ - L * Math.sin(contact));
    return { y: REST + (cy - REST) * k ** 1.5, z: cz * k };
  };
  let hy;
  let hz;
  if (phi <= Math.PI) {
    ({ y: hy, z: hz } = half(phi));
  } else {
    const m = half(TAU - phi);
    hy = m.y;
    hz = -2 * handZ - m.z;
  }
  // The step forward back to the start, after landing.
  const stepBack = smooth((u - 0.8) / 0.18);
  hz *= 1 - stepBack;
  const stepLeg = Math.sin(stepBack * Math.PI);
  const arch = Math.sin(Math.min(1, over * 1.25) * Math.PI);   // most bent early on
  const kick = Math.sin(over * Math.PI);                        // legs split going over
  return {
    rot: {
      hips: [-phi, 0, 0],
      spine: [-0.35 * arch, 0, 0],
      chest: [-0.3 * arch, 0, 0],
      head: [-0.35 * arch, 0, 0],
      armL: [-Math.PI * 0.97 * armsUp, 0, 0.14],
      armR: [-Math.PI * 0.97 * armsUp, 0, -0.14],
      handL: [1.1 * arch, 0, 0],
      handR: [1.1 * arch, 0, 0],
      // One leg leads the kick-over; a small walking step at the end.
      thighL: [-0.9 * kick - 0.35 * stepLeg, 0, 0.04],
      thighR: [0.35 * kick, 0, -0.04],
      shinL: [0.5 * stepLeg, 0, 0],
      footL: [0.5 * kick, 0, 0],
      footR: [0.5 * kick, 0, 0],
    },
    pos: { hips: [0, hy - REST + 0.03 * stepLeg, hz] },
  };
}

/**
 * Every clip she ships with. `label` is what the character page shows.
 *
 * `fps` is a SAMPLING rate, not a playback rate: between keys the
 * interpolation is continuous, so 8-20 is plenty for motion this simple and
 * keeps the exported animation block small.
 */
export const CLIPS = [
  { id: 'idle', label: 'Idle', duration: 4.0, fps: 8, pose: idlePose },
  { id: 'walk', label: 'Walk', duration: 1.0, fps: 18, pose: walkPose },
  { id: 'run', label: 'Run', duration: 0.62, fps: 20, pose: runPose },
  { id: 'wave', label: 'Wave', duration: 2.0, fps: 18, pose: wavePose },
  { id: 'cheer', label: 'Cheer', duration: 1.6, fps: 18, pose: cheerPose },
  { id: 'jumpingJacks', label: 'Jumping jacks', duration: 1.3, fps: 24, pose: jumpingJacksPose },
  { id: 'dance', label: 'Dance', duration: 2.0, fps: 20, pose: dancePose },
  { id: 'roll', label: 'Roll', duration: 1.5, fps: 30, pose: rollPose },
  { id: 'moonwalk', label: 'Moonwalk', duration: 1.2, fps: 24, pose: moonwalkPose },
  { id: 'handstand', label: 'Handstand', duration: 3.2, fps: 30, pose: handstandPose },
  { id: 'splits', label: 'Splits', duration: 3.0, fps: 24, pose: splitsPose },
  { id: 'backWalkover', label: 'Back walkover', duration: 3.4, fps: 30, pose: backWalkoverPose },
  { id: 'chop', label: 'Chop', duration: 0.62, fps: 30, pose: chopPose },
  { id: 'inspect', label: 'Inspect', duration: 1.4, fps: 20, pose: inspectPose },
];

// --- sampling ----------------------------------------------------------------

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/**
 * Turn one clip definition into plain keyframe data.
 *
 * Plain data rather than a THREE.AnimationClip, because the .glb writer needs
 * the raw numbers and reaching into a constructed clip to get them back out
 * would be the long way round.
 *
 * @param {object} def  an entry from CLIPS
 * @param {number} scale  the factor the figure's geometry was scaled by.
 *   Rotations do not care; hip HEIGHT does.
 * @returns {{id:string, duration:number, tracks:Array}}
 */
export function sampleClip(def, scale = 1) {
  const frames = Math.max(2, Math.round(def.duration * def.fps) + 1);
  const times = new Float32Array(frames);
  const rot = new Map();
  const pos = new Map();

  for (let f = 0; f < frames; f++) {
    // The last frame lands exactly on the loop point, so the cycle closes.
    const u = f / (frames - 1);
    times[f] = u * def.duration;
    const p = def.pose(u);

    for (const [bone, e] of Object.entries(p.rot || {})) {
      if (!rot.has(bone)) rot.set(bone, []);
      _euler.set(e[0], e[1], e[2]);
      _quat.setFromEuler(_euler);
      rot.get(bone).push(_quat.x, _quat.y, _quat.z, _quat.w);
    }
    for (const [bone, t] of Object.entries(p.pos || {})) {
      if (!pos.has(bone)) pos.set(bone, []);
      pos.get(bone).push(t[0] * scale, t[1] * scale, t[2] * scale);
    }
  }

  const tracks = [];
  for (const [bone, values] of rot) {
    tracks.push({ bone, path: 'rotation', times, values: new Float32Array(values) });
  }
  for (const [bone, values] of pos) {
    tracks.push({ bone, path: 'translation', times, values: new Float32Array(values) });
  }
  return { id: def.id, duration: def.duration, tracks };
}

/** All of them, sampled once. */
export function sampleAllClips(scale = 1) {
  return CLIPS.map((def) => sampleClip(def, scale));
}

/**
 * Sampled data to a THREE.AnimationClip.
 *
 * glTF translation channels are ABSOLUTE bone positions, while these poses
 * carry a delta from rest, so the rest offset is added back here. Getting it
 * wrong collapses her hips onto the origin, which looks exactly as bad as it
 * sounds.
 *
 * @param {object} sampled  output of sampleClip
 * @param {Record<string, THREE.Bone>} byName  bones, for their rest offsets
 */
export function toThreeClip(sampled, byName) {
  const tracks = sampled.tracks.map((t) => {
    if (t.path === 'rotation') {
      return new THREE.QuaternionKeyframeTrack(t.bone + '.quaternion', t.times, t.values);
    }
    const rest = byName[t.bone].position;
    const abs = new Float32Array(t.values.length);
    for (let i = 0; i < t.values.length; i += 3) {
      abs[i] = t.values[i] + rest.x;
      abs[i + 1] = t.values[i + 1] + rest.y;
      abs[i + 2] = t.values[i + 2] + rest.z;
    }
    return new THREE.VectorKeyframeTrack(t.bone + '.position', t.times, abs);
  });
  return new THREE.AnimationClip(sampled.id, sampled.duration, tracks);
}
