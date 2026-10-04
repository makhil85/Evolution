// Village dressing: the props that make the place look inhabited.
//
// A village of eight buildings on empty grass reads as a diagram. What sells
// "people live here" is the small stuff between the buildings - market stalls
// and benches on the plaza, lanterns marking the road, fences along the field
// edges, carts and crates left where someone was working.
//
// Everything comes from the Kenney fantasy town kit already in the project, and
// everything is instanced per prop type, so the whole dressing pass costs a
// couple of dozen draw calls rather than one per object.
import { instanceAsset, loadShared } from './board.js';
import { ROCKET_VILLAGE, VILLAGE_PATHS } from './rocketVillageLayout.js';
import { packScaleFor, asset } from './contracts.js';
import { RIVER } from './village.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp } from './toonPipeline.js';

const KIT = (n) => asset(`assets/models/kit/${n}.glb`);

function makeRng(seed = 99) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Walk a polyline, yielding a point every `spacing` units with its heading. */
/**
 * Shortest distance from a point to a line segment, on the XZ plane.
 *
 * A local copy: village.js keeps its own private, and importing it here would
 * be a cycle - village.js is what calls decorateVillage().
 */
function pointToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function* alongPath(points, spacing, offset = 0) {
  let carry = offset;
  for (let n = 0; n < points.length - 1; n++) {
    const [ax, az] = points[n];
    const [bx, bz] = points[n + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const ux = dx / len, uz = dz / len;
    for (let d = carry; d < len; d += spacing) {
      yield { x: ax + ux * d, z: az + uz * d, heading: Math.atan2(ux, uz) };
    }
    carry = (carry - len) % spacing;
    if (carry < 0) carry += spacing;
  }
}

/**
 * Dress the village.
 *
 * @param {object} village  provides heightAt() and isWalkable()
 * @param {THREE.Object3D} parent
 */

/** Warm painted timber, matching the signposts the quest uses. */
const WAYPOST = { post: 0x8a5f34, arm: 0xc9a227, far: 0xb46a3a };

/**
 * A two-armed fingerpost at the player's start.
 *
 * Built rather than kitted, for the same reason the bridge is: the kits have
 * no fingerpost, and a repeated tile would read as furniture. One merged,
 * vertex-coloured mesh, so it is a single draw call.
 *
 * The arms point ALONG the road she is facing. The near one is the village,
 * the far one is the launch pad she cannot see yet - which is the part a road
 * alone cannot tell her.
 */
function buildWaypost(parent, start, ground) {
  const geoms = [];
  const paint = (geo, hex) => {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  const box = (w, h, d, x, y, z, hex, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    geoms.push(paint(g, hex));
  };

  // Just off the road on her left, so it is in frame without blocking the way.
  const px = start.x - 2.4;
  const pz = start.z - 1.5;
  const base = ground(px, pz);

  box(0.16, 2.4, 0.16, px, base + 1.2, pz, WAYPOST.post);
  // Arms point down the road (-z), offset so both read from behind her.
  box(1.7, 0.30, 0.09, px - 0.75, base + 2.05, pz, WAYPOST.arm, -0.18);
  box(1.5, 0.26, 0.09, px - 0.68, base + 1.58, pz, WAYPOST.far, -0.18);
  // A cap, so the post does not end in a raw cut.
  box(0.26, 0.12, 0.26, px, base + 2.42, pz, WAYPOST.post);

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => { if (g !== merged) g.dispose(); });
  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true })
  );
  mesh.name = 'waypost';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export async function decorateVillage(village, parent) {
  const rng = makeRng();
  const ground = (x, z) => village.heightAt(x, z);
  const buckets = {};
  const put = (asset, p) => { (buckets[asset] ||= []).push(p); };

  const hub = ROCKET_VILLAGE.hub;
  const nearRiver = (x, z) => Math.abs(z - 3) < 12;

  /**
   * Is this spot in the water?
   *
   * `nearRiver` above is a crude z-band that assumes the river runs straight
   * across z = 3. It does not - it meanders, by up to nine units - so props
   * were landing in the water wherever the real channel wandered away from
   * that band. This asks the river itself.
   */
  const inRiver = (x, z) => Math.abs(RIVER.offsetAt(x, z)) < RIVER.widthAt(x) + 1.2;

  /** Guard every placement in one place, rather than at each call site. */
  const putDry = (asset, p) => { if (!inRiver(p.x, p.z)) put(asset, p); };

  // --- lanterns line the main road, so the route reads at a glance ----------
  let lampSide = 1;
  for (const path of VILLAGE_PATHS.slice(0, 2)) {
    for (const p of alongPath(path.points, 9)) {
      if (nearRiver(p.x, p.z)) continue;
      // The main road runs straight through the plaza, so a lamp post landed
      // in the middle of the market floor. The plaza has its own lighting.
      if (Math.hypot(p.x - hub.x, p.z - hub.z) < 9) continue;
      // ALTERNATING sides, not a coin flip. Random sides clumped two or three
      // posts together on one verge and left long stretches of the other side
      // dark, which is the opposite of what a lit road looks like.
      lampSide = -lampSide;
      const ox = Math.cos(p.heading) * (path.width * 0.5 + 1.1) * lampSide;
      const oz = -Math.sin(p.heading) * (path.width * 0.5 + 1.1) * lampSide;
      const x = p.x + ox, z = p.z + oz;
      put('lantern', { x, z, y: ground(x, z), rotY: p.heading, scale: 1.15 });
    }
  }

  // --- fences edge the fields along the spur paths --------------------------
  //
  // Three things were wrong with these, and all three are visible at a glance:
  //
  //   1. `rotY: heading + PI/2` turned every rail BROADSIDE to the path, so
  //      they stood across the road like hurdles instead of running beside it.
  //      alongPath's heading maps a model's local +z onto the path direction,
  //      so the rail wants `heading` and nothing added to it.
  //   2. Skipping individual pieces at random left a dotted line of posts
  //      rather than a fence with gates in it. Runs and openings, not dice.
  //   3. A spur's fence could land in the middle of the road it joins, because
  //      nothing checked the OTHER paths. Fences belong beside a path, so the
  //      usual isClear() is too strict here - it rejects everything near any
  //      path, including the one being lined.
  const FENCE_SCALE = 1.1;
  // The model is 1.0 long in z; PACK_SCALE and the placement scale both apply.
  const fenceLength = 1.0 * packScaleFor(KIT('fence')) * FENCE_SCALE;

  /** Distance to the nearest path that ISN'T this one. */
  const clearOfOtherPaths = (x, z, self) => {
    for (const other of VILLAGE_PATHS) {
      if (other === self) continue;
      for (let n = 0; n < other.points.length - 1; n++) {
        const [ax, az] = other.points[n];
        const [bx, bz] = other.points[n + 1];
        if (pointToSegment(x, z, ax, az, bx, bz) < other.width * 0.5 + 1.6) return false;
      }
    }
    return true;
  };

  for (const path of VILLAGE_PATHS.slice(2)) {
    for (const side of [-1, 1]) {
      // Walk each side independently so a gap on one side is not a gap on the
      // other - which is what makes it read as fencing rather than as damage.
      let run = 2 + Math.floor(rng() * 3);   // rails before the next opening
      let gap = 0;                            // slots still to leave empty
      for (const p of alongPath(path.points, fenceLength)) {
        if (gap > 0) { gap -= 1; continue; }
        if (run <= 0) {
          // An opening wide enough to walk through without aiming.
          gap = 1 + Math.floor(rng() * 2);
          run = 3 + Math.floor(rng() * 3);
          continue;
        }
        if (nearRiver(p.x, p.z)) continue;

        const ox = Math.cos(p.heading) * (path.width * 0.5 + 1.4) * side;
        const oz = -Math.sin(p.heading) * (path.width * 0.5 + 1.4) * side;
        const x = p.x + ox, z = p.z + oz;
        if (!village.isWalkable(x, z) || !clearOfOtherPaths(x, z, path)) continue;

        run -= 1;
        put(rng() < 0.12 ? 'fence-broken' : 'fence', {
          x, z, y: ground(x, z), rotY: p.heading, scale: FENCE_SCALE,
        });
      }
    }
  }

  // --- a fingerpost where she starts ---------------------------------------
  //
  // The first thing a child saw was a road and some trees. The road does imply
  // "walk that way", but nothing named the place, nothing said how far, and
  // the goal - the rocket - is across the river and out of sight from here.
  // A fingerpost is the thing a village actually puts at the top of its road,
  // and it answers both questions in the vocabulary the game already uses.
  buildWaypost(parent, ROCKET_VILLAGE.playerStart, ground);

  // --- the plaza: a market, benches, and a fountain at its centre -----------
  put('fountain-round-detail', { x: hub.x, z: hub.z, y: ground(hub.x, hub.z), rotY: 0, scale: 1.5 });

  // Stalls stand in a ring facing the fountain, at a FIXED radius. The radius
  // used to be jittered by a unit and the ring left open where the road comes
  // through - which read as furniture dropped at random rather than a market
  // someone set up. A market is a deliberate arrangement; that is what makes
  // it a market and not a yard.
  //
  // The road enters from the north and leaves south, so two arcs are left
  // empty for it. Nobody puts a stall in the middle of the road.
  const stalls = ['stall', 'stall-green', 'stall-red'];
  const STALL_R = 6.6;
  const roadGap = (a) => {
    // Angles pointing along +z / -z, where VILLAGE_PATHS[0] and [1] run.
    const d = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
    return d < 0.42 || Math.abs(d - Math.PI) < 0.42;
  };
  const stallAngles = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    if (roadGap(a)) continue;
    stallAngles.push(a);
  }
  stallAngles.forEach((a, i) => {
    const x = hub.x + Math.cos(a) * STALL_R;
    const z = hub.z + Math.sin(a) * STALL_R;
    // rotY = -a + PI turns the stall's front toward the middle of the plaza.
    put(stalls[i % stalls.length], { x, z, y: ground(x, z), rotY: -a + Math.PI, scale: 1.2 });
  });

  // A bench belongs BESIDE a stall, facing the same way - a place to sit while
  // someone serves you. They used to sit on their own ring, alone in the open,
  // which is how you get a plaza that looks like a showroom.
  stallAngles.forEach((a, i) => {
    if (i % 2) return;                       // not at every stall
    const off = a + 0.16;                    // a step round the ring
    const r = STALL_R - 1.9;
    const x = hub.x + Math.cos(off) * r;
    const z = hub.z + Math.sin(off) * r;
    put('stall-bench', { x, z, y: ground(x, z), rotY: -a + Math.PI, scale: 0.78 });
  });

  // Carts park BEHIND the stalls, which is where a trader leaves a cart, and
  // roughly tangent to the ring rather than at any angle at all.
  for (let i = 0; i < 5; i++) {
    const a = stallAngles[(i * 2) % stallAngles.length] + 0.22;
    const r = STALL_R + 2.6 + rng() * 0.8;
    const x = hub.x + Math.cos(a) * r;
    const z = hub.z + Math.sin(a) * r;
    putDry(rng() < 0.5 ? 'cart' : 'cart-high', {
      x, z, y: ground(x, z), rotY: -a + Math.PI / 2, scale: 1.1,
    });
  }

  // --- working clutter and hedges around each building ---------------------
  for (const b of ROCKET_VILLAGE.buildings) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = b.radius + 1.2 + rng() * 2.4;
      const x = b.x + Math.cos(a) * r;
      const z = b.z + Math.sin(a) * r;
      if (!village.isWalkable(x, z)) continue;
      // `planks` and `planks-half` are FLAT tiles. Dropped on grass with
      // nothing around them they read as bits of floor that fell off a
      // building, not as a woodpile - so the working clutter is now things
      // that stand up. Planks stay, but only stacked against a wall, below.
      const pick = rng();
      const asset = pick < 0.45 ? 'cart' : pick < 0.75 ? 'cart-high' : 'poles';
      putDry(asset, { x, z, y: ground(x, z), rotY: rng() * 6.28, scale: 1.0 + rng() * 0.25 });
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const r = b.radius + 3.4 + rng() * 2.6;
      const x = b.x + Math.cos(a) * r;
      const z = b.z + Math.sin(a) * r;
      if (!village.isWalkable(x, z)) continue;
      putDry(rng() < 0.5 ? 'hedge' : 'hedge-curved', { x, z, y: ground(x, z), rotY: rng() * 6.28, scale: 1.15 });
    }
    // A banner by the door, so each site is findable from a distance.
    put(rng() < 0.5 ? 'banner-green' : 'banner-red', {
      x: b.x + 2.6, z: b.z + 3.4, y: ground(b.x + 2.6, b.z + 3.4), rotY: 0.2, scale: 1.3,
    });
  }

  // --- a windmill on the northern rise, as a landmark ----------------------
  put('windmill', { x: -20, z: 48, y: ground(-20, 48), rotY: 0.6, scale: 1.6 });
  // A watermill wants to be ON the bank with its wheel toward the water, not
  // standing in the channel. (16, 11) put it mid-river, because the river's
  // centre at x = 16 is z = 11.8 - the meander, not the nominal z = 3.
  {
    const wx = 16;
    const wz = RIVER.centreAt(wx) + RIVER.widthAt(wx) + 2.2;   // just onto the north bank
    put('watermill', { x: wx, z: wz, y: ground(wx, wz), rotY: -0.4, scale: 1.4 });
  }

  // Anything a child would bump into gets a collider. Fences and hedges are
  // deliberately included: they mark field edges, and walking through a fence
  // makes the whole boundary meaningless.
  //
  // Round things (a fountain, a lamp post) approximate fine as a circle - the
  // capsule sees the same clearance from every direction. Long or rectangular
  // things (a fence, a hedge, a market stall) do not: a circle drawn at the
  // centre of a 1.65-unit fence rail leaves both ends uncovered, which is
  // exactly the gap a child walked through. Those get an oriented box instead,
  // sized to the model's own footprint along its own local axes and rotated by
  // the same `rotY` the mesh is placed with - so the collider tracks whatever
  // the eye sees, at whatever angle it was dropped at.
  //
  // Every number below is stated in the KIT's own units - multiplied by
  // contracts.js PACK_SCALE and the placement's own `scale` below, exactly
  // like `fenceLength` above, so they track the models instead of needing a
  // retune whenever the pack scale moves. Measured directly off each model's
  // glTF bounding box (local +z is length, local +x is width/thickness,
  // matching the axis alongPath's `heading` already rotates onto the path):
  // a fence rail is 0.08 x 1.0, a hedge strip 0.25 x 1.0, a stall 0.65-1.0
  // square, a cart 0.89 x 1.3-1.4. Widths get a little padding over the raw
  // mesh (a paper-thin collider reads as nothing there); the length along a
  // fence run is exact, because that is the dimension that has to touch its
  // neighbour with no gap.
  const SOLID_ROUND = {
    'fountain-round-detail': 1.35, lantern: 0.14, windmill: 1.8, watermill: 1.5,
    // poles.glb is not present in public/assets/models/kit (only under
    // asset-originals/unshipped) - loadShared() warns and instanceAsset()
    // silently renders nothing for it. This entry still exists so a fixed
    // asset would get a collider for free, but today it means any 'poles'
    // clutter placement is an invisible wall. Not fixed here: it needs an
    // asset file added or removed, not a physics/decoration code change.
    poles: 0.2,
  };
  // [halfX, halfZ], native units.
  const SOLID_BOX = {
    fence: [0.15, 0.5], 'fence-broken': [0.15, 0.5],
    hedge: [0.25, 0.5], 'hedge-curved': [0.5, 0.5],
    planks: [0.5, 0.5], 'planks-half': [0.25, 0.5],
    stall: [0.33, 0.5], 'stall-green': [0.5, 0.5], 'stall-red': [0.5, 0.5],
    'stall-bench': [0.15, 0.47],
    cart: [0.45, 0.67], 'cart-high': [0.45, 0.7],
  };
  const solids = [];
  for (const [asset, placements] of Object.entries(buckets)) {
    const fit = packScaleFor(KIT(asset));
    const roundBase = SOLID_ROUND[asset];
    const boxBase = SOLID_BOX[asset];
    if (roundBase) {
      const r = roundBase * fit;
      for (const p of placements) solids.push({ x: p.x, z: p.z, radius: r * (p.scale ?? 1) });
    } else if (boxBase) {
      const [halfXBase, halfZBase] = boxBase;
      for (const p of placements) {
        const s = fit * (p.scale ?? 1);
        solids.push({
          x: p.x, z: p.z,
          halfX: halfXBase * s, halfZ: halfZBase * s,
          rotation: p.rotY ?? 0,
        });
      }
    }
  }

  await Promise.all(Object.keys(buckets).map((a) => loadShared(KIT(a))));

  let batches = 0;
  let props = 0;
  for (const [asset, placements] of Object.entries(buckets)) {
    const meshes = await instanceAsset(parent, KIT(asset), placements, {
      // Outlines cost a second InstancedMesh per sub-mesh - 31 extra draw
      // calls for the dressing alone. On props this small they do not read,
      // so the budget is better spent on having MORE props.
      outline: false,
      castShadow: false,   // dozens of small casters are not worth a shadow pass
      receiveShadow: true,
    });
    batches += meshes.length;
    props += placements.length;
  }
  return { props, batches, kinds: Object.keys(buckets).length, solids };
}
