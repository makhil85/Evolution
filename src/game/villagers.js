// Townspeople.
//
// Props made the town look built; people make it look lived in. These are the
// people who build the rocket: engineers in hard hats and hi-vis vests,
// scientists in lab coats, a pilot in a flight suit and helmet, and mission
// control staff with headsets. They walk the path network on loops, pause now
// and then, and turn to face where they are going. They are scenery, not
// gameplay: nothing collides with them and nothing depends on them, so they
// can never wedge a child.
//
// COST NOTE, learned the hard way: the first version built each townsperson
// from nine separate meshes, which is nine draw calls each and 108 for the
// crowd - it pushed the whole scene from 140 calls to 204. Everything that does
// not need to move independently is now MERGED into one geometry with its
// colours baked into vertex colours, so a person is three draw calls: body, and
// two legs that still swing. The hats, vests and headsets are merged into the
// body like everything else, so the outfits cost nothing extra in draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';
import { VILLAGE_PATHS, ROCKET_VILLAGE } from './rocketVillageLayout.js';
import { AVATAR_HEIGHT } from './contracts.js';
import { RIVER, CROSSINGS } from './village.js';

/** ONE material for the entire crowd. Colours are baked into vertex colours. */
const CROWD_MATERIAL = new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true });

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _legLocal = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _legPos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Height of the figure as modelled, before scaling. Measured from the parts in
 * outfitBody(): the hard hat tops out at about 1.49, the highest of the four.
 */
const TOWNSPERSON_MODEL_HEIGHT = 1.49;
/** Paint every vertex of a geometry a flat colour, so it can be merged. */
function paint(geo, hex) {
  _c.setHex(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

function makeRng(seed) {
  let s = (seed >>> 0) || 7;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Four outfits, rather than four independent random palettes.
 *
 * The crowd used to roll skin, coat, hair and trousers separately, which made
 * every townsperson geometrically unique - and a unique geometry cannot be
 * instanced. Ten townspeople cost 30 draw calls, the second largest block in the
 * scene after the props. Fixed outfits mean four body geometries shared by
 * everyone, which is 8 calls for the whole crowd.
 *
 * Four is plenty at this size: they are 1.15 units tall, they are background,
 * and the routes keep them apart.
 */
const OUTFITS = [
  // Engineer: work shirt and navy overalls under a hi-vis vest, yellow hard hat.
  { shirt: 0x2f4a6e, vest: 0xff8a1f, legs: 0x2f3f5c, skin: 0xffdcc4, head: 'hardhat', hat: 0xffd23f },
  // Scientist: white lab coat, teal tie, glasses, grey hair.
  { shirt: 0xf6f8fb, labCoat: true, legs: 0x3a4a63, skin: 0xe8b88a, hair: 0x9aa3ad, head: 'glasses', tie: 0x2fb7a6 },
  // Pilot: navy flight suit with a zip, white helmet with a dark visor.
  { shirt: 0x2e4f8a, legs: 0x2e4f8a, skin: 0xf1c9a0, head: 'helmet', hat: 0xf4f7fb, visor: 0x17324d },
  // Mission control: sky-blue shirt, dark trousers, headset.
  { shirt: 0x5bb8e0, legs: 0x4a5568, skin: 0xc98d5e, hair: 0x2c1d18, head: 'headset' },
];

/** Body geometry for one outfit: everything that does not swing. */
function outfitBody(outfit) {
  const statics = [];
  const at = (geo, hex, x, y, z) => {
    geo.translate(x, y, z);
    statics.push(paint(geo, hex));
  };
  // Torso. A lab coat is longer than a shirt and hangs over the top of the legs.
  if (outfit.labCoat) {
    at(new THREE.CylinderGeometry(0.165, 0.2, 0.56, 8), outfit.shirt, 0, 0.84, 0);
    at(new THREE.BoxGeometry(0.035, 0.2, 0.02), outfit.tie, 0, 1.0, 0.175);
  } else {
    at(new THREE.CylinderGeometry(0.15, 0.185, 0.5, 8), outfit.shirt, 0, 0.85, 0);
  }
  if (outfit.vest) {
    // Hi-vis vest: a bright shell over the shirt, with a reflective band.
    at(new THREE.CylinderGeometry(0.163, 0.195, 0.4, 8, 1, true), outfit.vest, 0, 0.87, 0);
    at(new THREE.CylinderGeometry(0.178, 0.184, 0.05, 8, 1, true), 0xe9eef5, 0, 0.9, 0);
  }
  if (outfit.head === 'helmet') {
    at(new THREE.BoxGeometry(0.03, 0.42, 0.02), 0xdfe6ef, 0, 0.85, 0.165);   // flight suit zip
  }
  at(new THREE.CylinderGeometry(0.048, 0.043, 0.42, 6), outfit.shirt, -0.19, 0.87, 0);
  at(new THREE.CylinderGeometry(0.048, 0.043, 0.42, 6), outfit.shirt, 0.19, 0.87, 0);

  // Head. A hair cap, unless a hat or helmet covers the hair.
  at(new THREE.SphereGeometry(0.155, 10, 8), outfit.skin, 0, 1.26, 0);
  if (outfit.head === 'hardhat') {
    // Hard hat: a dome with a brim, sitting above the eyes.
    at(new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), outfit.hat, 0, 1.3, 0);
    at(new THREE.CylinderGeometry(0.21, 0.21, 0.025, 12), outfit.hat, 0, 1.295, 0);
  } else if (outfit.head === 'helmet') {
    at(new THREE.SphereGeometry(0.19, 12, 8), outfit.hat, 0, 1.27, 0);
    // The visor is a dark glass shell on the front of the helmet.
    const visor = new THREE.SphereGeometry(0.12, 10, 6);
    visor.scale(1, 0.85, 0.5);
    at(visor, outfit.visor, 0, 1.27, 0.17);
  } else {
    const capGeo = new THREE.SphereGeometry(0.168, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    capGeo.rotateX(-0.1);
    at(capGeo, outfit.hair, 0, 1.28, -0.01);
  }
  if (outfit.head !== 'helmet') {
    at(new THREE.SphereGeometry(0.028, 6, 5), 0x18202c, -0.06, 1.25, 0.135);
    at(new THREE.SphereGeometry(0.028, 6, 5), 0x18202c, 0.06, 1.25, 0.135);
  }
  if (outfit.head === 'glasses') {
    for (const x of [-0.06, 0.06]) at(new THREE.TorusGeometry(0.038, 0.008, 4, 10), 0x2b2f3a, x, 1.25, 0.14);
  }
  if (outfit.head === 'headset') {
    // Headband over the hair, an ear cup each side, and a mic on a boom by the mouth.
    at(new THREE.TorusGeometry(0.19, 0.018, 4, 12, Math.PI), 0x262e3a, 0, 1.27, 0);
    at(new THREE.BoxGeometry(0.04, 0.08, 0.05), 0x262e3a, -0.19, 1.23, 0);
    at(new THREE.BoxGeometry(0.04, 0.08, 0.05), 0x262e3a, 0.19, 1.23, 0);
    const boom = new THREE.CylinderGeometry(0.01, 0.01, 0.14, 4);
    boom.rotateX(Math.PI / 2);
    at(boom, 0x262e3a, 0.17, 1.17, 0.08);
    at(new THREE.SphereGeometry(0.022, 6, 5), 0x262e3a, 0.12, 1.16, 0.15);
  }

  const merged = mergeGeometries(statics, false);
  statics.forEach((x) => { if (x !== merged) x.dispose(); });
  return merged;
}

/** One leg, with its pivot at the HIP so a swing rotates about the right point. */
function outfitLeg(outfit) {
  const geo = new THREE.CylinderGeometry(0.07, 0.065, 0.6, 6);
  geo.translate(0, -0.3, 0);
  return paint(geo, outfit.legs);
}

/** Build a walkable route from the path network, as a list of world points. */
function routeFrom(path) {
  return path.points.map(([x, z]) => new THREE.Vector2(x, z));
}

/**
 * Clearance a townsperson keeps from the edge of a solid.
 *
 * Wider than a townsperson actually is (they are about 0.45 across). The extra
 * is walking room: at exactly body width they clipped the corners of market
 * stalls as they rounded them, because a route is a polyline and a walk is a
 * series of chords across it.
 */
const BODY_RADIUS = 0.85;

/**
 * Bend a route around whatever is standing in it.
 *
 * Townspeople have no collision - deliberately, because a townsperson that can
 * block a doorway can trap a child. But "no collision" was being applied to
 * the route as well as the body, so they walked through the fountain, the
 * market stalls and the buildings. The main road runs straight through the
 * plaza, and the fountain is in the middle of the plaza, so one of them stood
 * in the water more or less permanently.
 *
 * Solving it by steering per frame means either pathfinding or ping-ponging at
 * every obstacle. This does it ONCE, at construction: resample the route
 * finely, push any sample out of any solid it landed inside, and keep the
 * result. It costs nothing per frame and cannot oscillate, because by the time
 * anyone walks it the route is already clear.
 *
 * @param {THREE.Vector2[]} route
 * @param {Array<{x:number,z:number,radius:number}>} solids
 */
function bendAroundSolids(route, solids) {
  if (!solids.length || route.length < 2) return route;

  const STEP = 1.6;
  const out = [];
  // EVERY segment, the closing one included. update() walks routes cyclically
  // - `(leg + dir + len) % len` - so the last point joins back to the first
  // whether the route was authored as a loop or not. Skipping that segment
  // left the main road with one un-resampled leg running from (0, 60) to
  // (0, 3): a straight line down the middle of the map, through the plaza,
  // through the fountain. Every route point was clear and a townsperson still
  // stood in the water, because the WALK was never checked, only the corners.
  for (let n = 0; n < route.length; n++) {
    const a = route[n];
    const b = route[(n + 1) % route.length];
    const len = a.distanceTo(b);
    const steps = Math.max(1, Math.round(len / STEP));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }

  // Solids come in TWO shapes now. Trees and rocks are circles; fences,
  // hedges, planks and market stalls became oriented boxes when the player's
  // collision was fixed, because a long thin thing approximated by a small
  // circle has walkable daylight between consecutive posts.
  //
  // This code used to read `s.radius` unconditionally. For a box that is
  // undefined, so `keep` was NaN, every comparison against it was false, and
  // the whole box was silently skipped - which would have put the crowd back
  // to strolling through fences and stalls the moment they became boxes. A
  // missing shape reads as "no obstacle", so it fails quietly and looks like
  // a behaviour choice rather than a bug.

  /** How far outside a solid a body must stay, and which way is out. */
  const pushOut = (x, z, margin) => {
    for (const s of solids) {
      if (s.halfX === undefined) {
        const keep = s.radius + margin;
        const dx = x - s.x, dz = z - s.z;
        const d = Math.hypot(dx, dz);
        if (d >= keep) continue;
        if (d < 1e-3) return { x: x + keep, z };        // dead centre: any way out
        return { x: s.x + (dx / d) * keep, z: s.z + (dz / d) * keep };
      }
      // Oriented box: work in the box's own frame, then rotate the answer back.
      const c = Math.cos(-(s.rotation || 0)), si = Math.sin(-(s.rotation || 0));
      const dx = x - s.x, dz = z - s.z;
      const lx = dx * c - dz * si, lz = dx * si + dz * c;
      const ex = s.halfX + margin, ez = s.halfZ + margin;
      if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
      // Leave by the nearest face, which is the shortest way out.
      const outX = ex - Math.abs(lx);
      const outZ = ez - Math.abs(lz);
      let nx = lx, nz = lz;
      if (outX < outZ) nx = Math.sign(lx || 1) * ex;
      else nz = Math.sign(lz || 1) * ez;
      const bc = Math.cos(s.rotation || 0), bs = Math.sin(s.rotation || 0);
      return { x: s.x + (nx * bc - nz * bs), z: s.z + (nx * bs + nz * bc) };
    }
    return null;
  };

  /**
   * Shove one point to the edge of anything it is inside.
   *
   * Loops, because leaving one solid can put you inside its neighbour and
   * around a market stall that happens often. Bounded so a point wedged
   * between two things cannot spin here forever.
   */
  const shove = (p) => {
    for (let i = 0; i < 4; i++) {
      const hit = pushOut(p.x, p.y, BODY_RADIUS);
      if (!hit) break;
      p.x = hit.x;
      p.y = hit.z;
    }
  };
  const inside = (x, z) => !!pushOut(x, z, BODY_RADIUS * 0.5);

  // Two passes: pushing clear of one solid can push a point into its
  // neighbour, and around a market stall that happens often.
  for (let pass = 0; pass < 2; pass++) out.forEach(shove);

  // CHORD REPAIR. Clear points are not a clear path: two samples pushed to
  // opposite sides of the fountain are both outside it, and the straight line
  // between them goes through the middle. That is precisely how a townsperson
  // ended up standing in the water. Subdivide any segment whose midpoint is
  // inside something, shove the new point out, and repeat - each round halves
  // the worst chord.
  for (let round = 0; round < 5; round++) {
    let repaired = 0;
    // i counts down through every pair INCLUDING the wrap (last -> first).
    for (let i = out.length - 1; i >= 0; i--) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      const mid = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (!inside(mid.x, mid.y)) continue;
      shove(mid);
      out.splice(i + 1, 0, mid);   // i+1 === out.length appends, which is right
      repaired++;
    }
    if (repaired === 0) break;
  }
  return out;
}

export class Villagers {
  /**
   * @param {THREE.Object3D} parent
   * @param {object} deps
   * @param {object} deps.village  for heightAt() and isWalkable()
   * @param {number} [deps.count]
   */
  constructor(parent, { village, count = 10, solids = [] }) {
    this.village = village;
    this.group = new THREE.Group();
    this.group.name = 'townspeople';
    parent.add(this.group);

    const rng = makeRng(31337);
    this.people = [];

    // Routes: the path network, plus a loop around the plaza so the market is
    // never deserted.
    const hub = ROCKET_VILLAGE.hub;
    const plaza = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      plaza.push(new THREE.Vector2(hub.x + Math.cos(a) * 6.5, hub.z + Math.sin(a) * 6.5));
    }
    const raw = VILLAGE_PATHS.map(routeFrom);
    raw.push(plaza);
    const routes = raw.map((r) => bendAroundSolids(r, solids));

    // One instanced body and one instanced pair-of-legs per OUTFIT, shared by
    // everyone wearing it. Assign outfits first so each batch knows its size.
    const wearers = OUTFITS.map(() => []);
    for (let i = 0; i < count; i++) wearers[i % OUTFITS.length].push(i);

    this.batches = OUTFITS.map((outfit, o) => {
      const n = wearers[o].length;
      const body = new THREE.InstancedMesh(outfitBody(outfit), CROWD_MATERIAL, n);
      // Two instances per person: left leg and right leg.
      const legs = new THREE.InstancedMesh(outfitLeg(outfit), CROWD_MATERIAL, n * 2);
      for (const mesh of [body, legs]) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        // Culling stays on. The bounds are refitted to where the people
        // actually stand every frame (update() below), so a batch is culled
        // only when every one of its people is out of view.
        this.group.add(mesh);
      }
      return { body, legs };
    });

    // WHERE they are matters more than how many there are.
    //
    // This used to be `routes[i % routes.length]` - one person per road, dealt
    // round-robin. An even spread is exactly what makes a place feel deserted:
    // nobody is anywhere in PARTICULAR, and a child can walk the whole way
    // from the spawn to the first station and meet no one, which is what
    // happened. Real towns cluster, so the plaza gets a crowd, the road she
    // actually starts on gets company, and the back lanes get whoever is left.
    //
    // routes[] is VILLAGE_PATHS in order, then the plaza pushed on the end.
    // Index 0 is the main north road - the one the game opens on.
    const PLAZA = routes.length - 1;
    const MAIN_ROAD = 0;
    const weighted = [];
    for (let i = 0; i < routes.length; i++) {
      const share = i === PLAZA ? 4 : i === MAIN_ROAD ? 3 : 1;
      for (let k = 0; k < share; k++) weighted.push(i);
    }

    for (let o = 0; o < OUTFITS.length; o++) {
      wearers[o].forEach((i, slot) => {
        const route = routes[weighted[i % weighted.length]];
        this.people.push({
          outfit: o,
          slot,
          route,
          leg: Math.floor(rng() * route.length),
          t: rng(),
          speed: 0.9 + rng() * 0.7,
          // A pause timer means the crowd is not a conveyor belt of walkers.
          pause: rng() * 6,
          phase: rng() * 6.28,
          scale: AVATAR_HEIGHT * (0.88 + rng() * 0.18) / TOWNSPERSON_MODEL_HEIGHT,
          loop: route === plaza,
          dir: rng() < 0.5 ? 1 : -1,
          x: 0, z: 0, y: 0, heading: 0, swing: 0,
        });
      });
    }
  }

  update(dt, time) {
    for (const p of this.people) {
      const route = p.route;
      const a = route[p.leg];
      const b = route[(p.leg + p.dir + route.length) % route.length];

      if (p.pause > 0) {
        p.pause -= dt;
        this.place(p, a.x, a.y, 0, time, false);
        continue;
      }

      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      p.t += (p.speed * dt) / len;

      if (p.t >= 1) {
        p.t = 0;
        p.leg = (p.leg + p.dir + route.length) % route.length;
        // Non-loop routes bounce back at the ends rather than teleporting.
        if (!p.loop && (p.leg === 0 || p.leg === route.length - 1)) p.dir *= -1;
        if (Math.random() < 0.25) p.pause = 1 + Math.random() * 4;
        continue;
      }

      const x = a.x + (b.x - a.x) * p.t;
      const z = a.y + (b.y - a.y) * p.t;

      // Townspeople are scenery with no collision, so nothing stopped them
      // walking straight into the river. Turn them back at the water unless
      // there is a bridge under their feet.
      if (!this.canStand(x, z)) {
        p.t = 0;
        p.dir *= -1;
        p.pause = 0.4 + Math.random();
        continue;
      }

      this.place(p, x, z, Math.atan2(b.x - a.x, b.y - a.y), time, true);
    }
    // Ten people is cheap to refit every frame: one sphere per batch, from its instances.
    for (const b of this.batches) { b.body.computeBoundingSphere(); b.legs.computeBoundingSphere(); }
  }

  /** Is this dry land, or a bridge that has actually been built? */
  canStand(x, z) {
    const d = Math.abs(z - RIVER.centreAt(x));
    if (d > RIVER.widthAt(x)) return true;          // not over water at all
    for (const c of CROSSINGS) {
      if (Math.abs(x - c.x) <= RIVER.bridgeHalfWidth
          && this.village.openCrossings?.has(c.id)) return true;
    }
    return false;
  }

  place(p, x, z, heading, time, walking) {
    // The townspeople's routes cross the river at the bridge. Following the
    // terrain sank them into the water halfway over.
    const y = this.village.surfaceHeightAt(x, z);
    p.x = x; p.z = z; p.y = y;
    if (walking) p.heading = heading;
    // Leg and arm swing, so they read as walking rather than sliding.
    p.swing = walking ? Math.sin(time * 7 * p.speed + p.phase) * 0.5 : 0;

    const batch = this.batches[p.outfit];
    _pos.set(x, y, z);
    _q.setFromAxisAngle(_up, p.heading);
    _scl.setScalar(p.scale);
    _m.compose(_pos, _q, _scl);
    batch.body.setMatrixAt(p.slot, _m);
    batch.body.instanceMatrix.needsUpdate = true;

    // Legs hang from the hip, so the swing rotates about the right point.
    for (const [k, side] of [[0, -1], [1, 1]]) {
      _legLocal.makeRotationX(k === 0 ? p.swing : -p.swing);
      _legLocal.setPosition(side * 0.08 * p.scale, 0, 0);
      _legPos.set(x, y + 0.6 * p.scale, z);
      _m.compose(_legPos, _q, _scl);
      _m.multiply(_legLocal);
      batch.legs.setMatrixAt(p.slot * 2 + k, _m);
    }
    batch.legs.instanceMatrix.needsUpdate = true;
  }
}
