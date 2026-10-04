// Stations: the places in the world a child can walk up to and interact with.
//
// Each quest step names a stationId; this module turns that into a physical
// spot on the board with a marker, proximity detection, and an activation
// callback. It is the bridge between "Zara is standing here" and "open this
// question".
//
// Design rule taken from Levels 1 and 2: a station that is not yet reachable
// still SHOWS, and says why. Locked content visible across a gap is what makes
// the world feel like a place rather than a menu.
import * as THREE from 'three';
import { toonRamp } from './toonPipeline.js';
import { ROCKET_VILLAGE } from './rocketVillageLayout.js';
import { QUEST_CHAIN } from './quests.js';
import { audio } from './audio.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** How close Zara must be for a station to light up. */
export const INTERACT_RADIUS = 4.5;

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _col = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export const MARKER_COLOR = {
  ready: 0xffd166,   // gold: this is your next step
  bonus: 0x9b7fd4,   // violet: an optional puzzle, take it or leave it
  locked: 0x6d7883,  // grey: visible, but not yet
  done: 0x63b85a,    // green: finished
};

/**
 * Where each station sits. Quest steps reference these ids.
 * Positions are inherited from the village layout, not invented.
 */
export function stationPositions() {
  const pad = ROCKET_VILLAGE.rocketPad;
  const out = {};
  // EVERY building gets its signpost five units to the south, derived - not
  // listed. Two sites used to be written out by hand here as well as in
  // structures.js, and the pair drifted the moment one of them moved.
  for (const b of ROCKET_VILLAGE.buildings) {
    out[b.id] = { x: b.x, z: b.z + SIGNPOST_OFFSET };
  }
  // The pad itself is across the river, but build_foundation happens at step 4
  // and the bridge is not laid until step 7 - which REQUIRES the foundation.
  // Siting the station at the pad made the chain circular and ended the game
  // at 30%. QUEST_SPEC says this step is "viewed from the north bank", so the
  // station starts as a north-bank viewing platform: reachable from the first
  // minute. It does not STAY there - see padStationWhenOpen().
  out.rocketPad = { x: pad.x, z: 12 };
  return out;
}

/** How far in front of a building its signpost stands. */
const SIGNPOST_OFFSET = 5;

/** Where the pad station moves to once she can actually reach the pad. */
export function padStationWhenOpen() {
  const pad = ROCKET_VILLAGE.rocketPad;
  return { x: pad.x, z: pad.z + 9 };
}

/**
 * A wooden signpost, planted in the ground.
 *
 * This used to be a diamond hovering two metres up. A floating gem is a video
 * game HUD element pretending to be an object - it reads as debug art, and a
 * child asks why it is in the sky. A signpost is an everyday thing that
 * belongs in a village, and it can still carry colour and a little motion to
 * say "come here next".
 */
/**
 * The signpost, as four INSTANCED parts shared across every station.
 *
 * It used to be five separate meshes per signpost - 45 draw calls for nine
 * signposts, the single largest contributor in the scene, more than the
 * buildings, the mountains and the whole forest combined. Nine copies of the
 * same object is exactly what instancing is for.
 *
 * Split by what varies:
 *   frame  post + board, identical everywhere        -> no per-instance colour
 *   panel  the "go here next" signal                 -> per-instance colour
 *   flag   same signal, and it flutters              -> colour + matrix per frame
 *   ring   the interact radius on the ground         -> per-instance colour
 *
 * Ring "opacity" rides on the instance COLOUR rather than the material, since
 * a material property cannot vary per instance: an inactive ring is simply
 * painted darker against a fixed material opacity.
 */
function buildMarkerParts(group, count) {
  const toon = (extra = {}) =>
    new THREE.MeshToonMaterial({ gradientMap: toonRamp, vertexColors: true, ...extra });

  const paint = (geo, hex) => {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };

  // --- frame: post, sunk slightly so it never floats on uneven ground ------
  const post = new THREE.CylinderGeometry(0.075, 0.09, 1.9, 7);
  post.translate(0, 0.9, 0);
  paint(post, 0x7a5230);
  const board = new THREE.BoxGeometry(0.95, 0.5, 0.08);
  board.rotateZ(-0.05);
  board.translate(0.08, 1.6, 0.05);
  paint(board, 0x9a6b3f);
  const frameGeo = mergeGeometries([post, board], false);
  post.dispose(); board.dispose();

  const panelGeo = new THREE.BoxGeometry(0.74, 0.32, 0.04);
  panelGeo.rotateZ(-0.05);
  panelGeo.translate(0.08, 1.6, 0.11);
  paint(panelGeo, 0xffffff);          // white: instanceColor does the work

  const flagGeo = new THREE.BoxGeometry(0.44, 0.26, 0.03);
  paint(flagGeo, 0xffffff);

  const ringGeo = new THREE.RingGeometry(1.45, 1.7, 24);
  ringGeo.rotateX(-Math.PI / 2);

  const make = (geo, material) => {
    const m = new THREE.InstancedMesh(geo, material, count);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;   // nine scattered points; culled as one unit it vanishes
    group.add(m);
    return m;
  };

  const frame = make(frameGeo, toon());
  frame.castShadow = true;
  const parts = {
    frame,
    panel: make(panelGeo, toon()),
    flag: make(flagGeo, toon()),
    ring: make(ringGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    })),
  };
  // The frame is one colour for every station; set it once.
  const white = new THREE.Color(0xffffff);
  for (let i = 0; i < count; i++) frame.setColorAt(i, white);
  return parts;
}

export class Stations {
  /**
   * @param {THREE.Object3D} parent
   * @param {object} deps
   * @param {object} deps.engine     quest engine
   * @param {object} deps.village    for walkability, so we never mark an unreachable spot "ready"
   */
  constructor(parent, { engine, village }) {
    const ground = (x, z) => (village?.heightAt ? village.heightAt(x, z) : 0);
    this.engine = engine;
    this.village = village;
    this.ground = ground;
    this.padMoved = false;
    this.group = new THREE.Group();
    this.group.name = 'stations';
    parent.add(this.group);

    const entries = Object.entries(stationPositions());
    this.parts = buildMarkerParts(this.group, entries.length);
    this.byId = new Map();
    entries.forEach(([id, pos], index) => {
      this.byId.set(id, { id, ...pos, index, state: 'locked', shown: true });
    });
    for (const st of this.byId.values()) this.placeMarker(st);
    this.nearest = null;
    /**
     * Whether the gold "go here next" highlight (and the violet bonus one)
     * points the way. Play modes turn this off on Hard: the signposts stay,
     * but the next one looks like any other unfinished one.
     */
    this.guidance = true;
  }

  /** Play modes: show (true) or hide (false) which signpost is next. */
  setGuidance(on) { this.guidance = !!on; }

  /**
   * Write one station's four instance matrices.
   *
   * `flagSwing` and `shown` are the only things that change after setup, so
   * this is also the per-frame path for an active signpost - everything else
   * holds its matrix from construction.
   */
  placeMarker(st, flagSwing = 0, flagLift = 0) {
    const y = this.ground(st.x, st.z);
    const scale = st.shown ? 1 : 0;   // hiding by scale: no branch in the draw
    _scl.setScalar(scale);

    _pos.set(st.x, y, st.z);
    _q.identity();
    _m.compose(_pos, _q, _scl);
    this.parts.frame.setMatrixAt(st.index, _m);
    this.parts.panel.setMatrixAt(st.index, _m);

    _pos.set(st.x, y + 0.05, st.z);
    _m.compose(_pos, _q, _scl);
    this.parts.ring.setMatrixAt(st.index, _m);

    // The pennant flutters; the signpost itself stays put, like a real one.
    _pos.set(st.x + 0.24, y + 1.98 + flagLift, st.z);
    _q.setFromAxisAngle(_up, flagSwing);
    _m.compose(_pos, _q, _scl);
    this.parts.flag.setMatrixAt(st.index, _m);

    for (const part of Object.values(this.parts)) part.instanceMatrix.needsUpdate = true;
  }

  /** Stations that some not-yet-complete step still needs. */
  get pendingStations() {
    const out = new Set();
    for (const step of QUEST_CHAIN) {
      if (step.stationId && !this.engine.isComplete(step.id)) out.add(step.stationId);
    }
    return out;
  }

  /** The station the current quest step wants, if any. */
  activeStationId() {
    const step = this.engine.current();
    return step ? (step.stationId || null) : null;
  }

  setState(id, state) {
    const s = this.byId.get(id);
    if (!s || s.state === state) return;
    // Only chime once a station has genuinely become the next thing to do -
    // not on the first frame, when every marker is being set up.
    if (state === 'ready' && s.state !== 'locked-init') audio.stationReady();
    s.state = state;
    // Per-INSTANCE colour. Recolouring a shared material would repaint all
    // nine signposts at once; minting a material per transition (the version
    // before that) leaked one every time a station changed state.
    _col.setHex(MARKER_COLOR[state]);
    this.parts.panel.setColorAt(s.index, _col);
    this.parts.flag.setColorAt(s.index, _col);
    // The ring's "opacity" is its brightness: a material's opacity cannot vary
    // per instance, so an inactive ring is simply painted darker.
    const dim = (state === 'ready' || state === 'bonus') ? 1 : 0.34;
    _col.multiplyScalar(dim);
    this.parts.ring.setColorAt(s.index, _col);
    for (const part of [this.parts.panel, this.parts.flag, this.parts.ring]) {
      part.instanceColor.needsUpdate = true;
    }
  }

  /**
   * @param {number} t     elapsed seconds, for the bob
   * @param {THREE.Vector3} playerPos
   * @returns {{id:string, distance:number}|null} the station in range, if any
   */
  /** Markers beyond this are not drawn: 9 stations x 2 meshes adds up. */
  static VISIBLE_RANGE = 46;

  update(t, playerPos) {
    // Move the pad signpost to the pad itself the moment the bridge opens.
    // Until then it is a viewing platform on the north bank (see
    // stationPositions); after, standing 55 units from the rocket to press
    // LAUNCH is just confusing - the button belongs at the rocket.
    if (!this.padMoved && this.village?.bridgeOpen) {
      const s = this.byId.get('rocketPad');
      if (s) {
        const to = padStationWhenOpen();
        s.x = to.x; s.z = to.z;
        this.placeMarker(s);
      }
      this.padMoved = true;
    }

    const activeId = this.activeStationId();
    // Cached once per frame: the getter walks the whole chain.
    const pending = this.pendingStations;
    let best = null;
    let bestD = Infinity;

    for (const s of this.byId.values()) {
      // Colour tells the child where to go next without a word of instruction.
      // "Done" means no step still needs this station - step ids (step_cadet)
      // don't match station ids (missionSchool), so it has to be derived.
      // Gold is "go here next". Violet is "there is an extra puzzle here if you
      // want it" - deliberately a different colour, so a child following the
      // gold marker is never pulled off the main chain by optional work.
      const offer = s.id === activeId ? null : this.engine.availableAt?.(s.id);
      let state = s.id === activeId ? 'ready'
        : (offer && offer.optional ? 'bonus'
          : (pending.has(s.id) ? 'locked' : 'done'));
      // No guidance: the next and bonus signposts are painted like any other
      // unfinished one (grey, dim ring, calm flag). Finished ones still stop
      // drawing, which says nothing about where to go next.
      if (!this.guidance && (state === 'ready' || state === 'bonus')) state = 'locked';
      this.setState(s.id, state);

      const active = s.state === 'ready' || s.state === 'bonus';
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      // A marker across the valley is a couple of pixels and two draw calls.
      // The active one always shows, so the child can still see where to go.
      // A completed station has nothing left to do, so it stops drawing
       // entirely. By the end of the game that is 8 of 9 markers, and the
       // end state is when the scene is at its most expensive.
      s.shown = state !== 'done' && (d <= Stations.VISIBLE_RANGE || (this.guidance && s.id === activeId));
      this.placeMarker(
        s,
        Math.sin(t * (active ? 3.4 : 1.4) + s.x) * (active ? 0.45 : 0.18),
        Math.sin(t * 2.2 + s.x) * (active ? 0.05 : 0.02)
      );
      if (d < bestD) { bestD = d; best = s; }
    }

    this.nearest = bestD <= INTERACT_RADIUS ? { id: best.id, distance: bestD } : null;
    return this.nearest;
  }
}
