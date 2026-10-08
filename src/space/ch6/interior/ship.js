// Chapter 6, Part B: inside the ship for the stars (lead 2026-10-08: "Star
// Trek for now"). Replaces the round hall in the rock (habitat.js): the
// crew lives in the spinning ring, on four decks joined by a lift (decks.js).
// She walks a deck like a village (surface/walker.js, gait 'earth'; W/S A/D
// relative to the camera, Shift runs, Space jumps, drag to look), walls and
// props stop her (walkmap.js), doors slide open as she comes, and in the lift
// "E" (or 1-4) picks a deck. The crewmate who leads a station stands by it;
// the next station has a beacon (on another deck, the beacon is on the lift
// and a toast says which deck). At a station "E" opens it (onStation(id)).
// The walk takes its spots from the caller: stations (STATIONS, the default)
// or quests (QUESTS, partQuests.js); each spot is { id, lead, title } and is
// found on its deck by id (decks.js).
//
// main.js's runScene contract: { scene, camera, start(), tick(), dispose() }.
// start() resolves { done: [ids] } once every spot in `order` is done.
// Test hook: scene.debug = { walker, stations, done, deck, place(x, z),
// goTo(id), pressE(), takeLift(deckId) }.
import * as THREE from 'three';
import { createWalker } from '../../surface/walker.js';
import { createOverlay } from '../../surface/overlay.js';
import { t } from '../../level.js';
import { STATIONS } from '../stationsLogic.js';
import { CREW_INFO } from '../crewInfo.js';
import { buildCrew } from '../crew.js';
import { createKit } from './kit.js';
import { createWalkMap } from './walkmap.js';
import { DECKS, deckOf, START_DECK } from './decks.js';

const REACH = 1.6;     // how close to a station's spot to press E
const LIFT = { x0: -1.2, x1: 1.2, z0: -2.4, z1: 0 };
const LIFT_TIME = 1.4; // doors shut, fade, travel, fade in
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const inLift = (x, z) => x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < LIFT.z1 - 0.2;

/** The lift car every deck shares (built once per deck, at the origin). */
function buildLift(kit) {
  const g = new THREE.Group();
  const b = kit.batch();
  const h = 2.8;
  b.box(2.6, h, 0.2, kit.mats.wallDark, 0, h / 2, LIFT.z0 - 0.1);
  b.box(0.2, h, 2.6, kit.mats.wallDark, LIFT.x0 - 0.1, h / 2, -1.2);
  b.box(0.2, h, 2.6, kit.mats.wallDark, LIFT.x1 + 0.1, h / 2, -1.2);
  b.box(2.6, 0.1, 2.6, kit.mats.ceiling, 0, h, -1.2);
  b.box(2.4, 0.04, 2.4, kit.mats.deck, 0, 0.02, -1.2);
  // Light rails up the corners, a ring light on the roof.
  for (const x of [-1.1, 1.1]) b.box(0.05, h - 0.3, 0.05, kit.mats.cove, x, h / 2, LIFT.z0 + 0.06);
  b.cyl(0.5, 0.5, 0.03, kit.mats.coveCool, 0, h - 0.04, -1.2, { seg: 32 });
  b.flush(g);
  const panel = kit.screen(0.7, 0.9, { title: 'LIFT', accent: 0xcc99cc, seed: 11 });
  panel.position.set(1.08, 1.4, -1.2); panel.rotation.y = -Math.PI / 2; g.add(panel);
  const door = kit.door(0, 0.05, 0, { w: 2.0, h: 2.5 });
  g.add(door.group);
  return { group: g, door, floor: { rect: [0, -1.2, 2.4, 2.4] } };
}

/**
 * @param {object} game
 * @param {{ spots?: object[], order?: string[], done?: string[], onStation: (id:string) => Promise<any>, startDeck?: string }} opts
 */
export function createInteriorScene(game, { spots = STATIONS, order = spots.map((s) => s.id), done: doneAlready = [], onStation, startDeck = START_DECK }) {
  const renderer = game.renderer;
  const hud = game.hud || null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c12);
  scene.fog = new THREE.Fog(0x0a0c12, 30, 70);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
  // Soft fill only (issue d): the decks' own coves, screens and lamps do the rest.
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x4a4454, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e0, 0.6); key.position.set(3, 10, 4); scene.add(key);

  const kit = createKit();
  const crew = buildCrew();
  const decks = {};
  for (const spec of DECKS) {
    const d = spec.build(kit);
    const lift = buildLift(kit);
    d.group.add(lift.group);
    d.lift = lift;
    d.spec = spec;
    d.map = createWalkMap({ floors: [...d.floors, lift.floor], solids: d.solids });
    decks[spec.id] = d;
  }

  // Spots (stations or quests): where each one is, on which deck.
  const stations = spots.map((info) => {
    const deck = deckOf(info.id);
    const s = decks[deck]?.stations?.[info.id];
    if (!s) throw new Error(`[interior] ${info.id} has no spot on deck ${deck}`);
    return { ...info, deck, ...s, done: doneAlready.includes(info.id) };
  });
  // Each crewmate on the deck of their first spot, at the deck's crew spot for
  // that spot (or for the crewmate), or a step beside that spot.
  for (const id of crew.ids) {
    const st = stations.find((s) => s.lead === id);
    const deckId = st?.deck || START_DECK;
    const d = decks[deckId];
    const spot = d.crewSpots?.[st?.id] || d.crewSpots?.[id] || (st && { x: st.x + Math.cos(st.face) * 1.2, z: st.z - Math.sin(st.face) * 1.2, face: st.face });
    if (!spot) continue;
    const c = crew[id];
    c.root.position.set(spot.x, 0, spot.z);
    c.root.rotation.y = spot.face;
    d.group.add(c.root);
    d.solids.push({ disc: [spot.x, spot.z, 0.4] });
    d.map = createWalkMap({ floors: [...d.floors, d.lift.floor], solids: d.solids });
  }

  // The beacon: a glowing ring on the floor where she stands, and a small
  // arrow bobbing over it (a tall see-through column hid the console and
  // tinted the whole view once the camera was inside it).
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff3ff).multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false });
  const beacon = new THREE.Group();
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40).rotateX(Math.PI / 2), beaconMat);
  beaconRing.position.y = 0.03;
  const beaconArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4).rotateX(Math.PI), beaconMat);
  beacon.add(beaconRing, beaconArrow);

  // Her.
  const walker = createWalker({ gravity: 9.8 * 0.6, gait: 'earth' });
  walker.helmet.visible = false;
  if (walker.pack) walker.pack.visible = false;
  walker.root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'TorusGeometry') o.visible = false; });
  const terrain = { heightAt: () => 0 };

  let deck = null;
  function showDeck(id, at = null) {
    if (deck) scene.remove(deck.group);
    deck = decks[id];
    scene.add(deck.group);
    deck.group.add(walker.root);
    deck.group.add(beacon);
    const p = at || { x: 0, z: 1.4, face: 0 };
    walker.place(p.x, 0, p.z, p.face);
    deck.map.reset(p.x, p.z);
    cam.yaw = p.face;
    paintStations();
  }

  const overlay = createOverlay();
  const cam = { yaw: 0, pitch: 0.3, dist: 4.6 };
  const _move = new THREE.Vector2();
  const _v = new THREE.Vector3();
  let clock = 0; let busy = false; let disposed = false; let prevE = false; let prevJump = false;
  let lift = null; // { to, t } while the lift runs
  let finish;
  const finished = new Promise((r) => { finish = r; });
  const isDown = (code) => !!game.controls?.isDown?.(code);

  const nextStation = () => {
    for (const id of order) { const st = stations.find((s) => s.id === id); if (st && !st.done) return st; }
    return null;
  };
  function paintStations() {
    for (const st of stations) st.lamp?.material?.color?.copy(new THREE.Color(st.done ? 0x9fe8a8 : 0xffd27a).multiplyScalar(1.8));
    const n = nextStation();
    beacon.visible = !!n && !!deck;
    if (n && deck) {
      if (n.deck === deck.spec.id) beacon.position.set(n.x, 0, n.z);
      else beacon.position.set(0, 0, -1.2);
    }
  }

  async function use(st) {
    if (busy || st.done) return;
    busy = true;
    overlay.hidePrompt();
    crew.wave(st.lead);
    try { await onStation(st.id); st.done = true; } finally { busy = false; }
    paintStations();
    const n = nextStation();
    if (!n) finishSoon = 1.2;
    else hud?.toast?.(nextText(n), { kind: 'info', ms: 3600 });
  }
  const nextText = (n) => {
    const where = n.deck === deck.spec.id ? '' : t(` Take the lift to Deck ${decks[n.deck].spec.n}.`, ` Take the lift to Deck ${decks[n.deck].spec.n}.`);
    return t(`Next: ${n.title[0]} with ${CREW_INFO[n.lead].name}.${where}`, `Next: ${n.title[1]}!${where}`);
  };
  let finishSoon = -1;

  // --- the lift: a small deck panel, then a fade -----------------------------------------
  let panel = null;
  function openLiftPanel() {
    if (panel || lift) return;
    const n = nextStation();
    panel = document.createElement('div');
    panel.className = 'rv-lift';
    Object.assign(panel.style, {
      position: 'fixed', right: '24px', top: '50%', transform: 'translateY(-50%)', zIndex: 60, padding: '12px', borderRadius: '18px 6px 6px 18px',
      background: 'rgba(8,10,16,.92)', border: '2px solid #cc99cc', font: '600 15px system-ui, sans-serif', color: '#ffcc99', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '230px',
    });
    const head = document.createElement('div'); head.textContent = t('Lift: pick a deck', 'Lift: pick a deck'); head.style.cssText = 'color:#cc99cc;padding:2px 4px 6px';
    panel.appendChild(head);
    for (const spec of DECKS) {
      const bt = document.createElement('button');
      bt.type = 'button';
      const here = spec.id === deck.spec.id;
      const isNext = n && n.deck === spec.id;
      bt.textContent = `${spec.n}  ${t(spec.name[0], spec.name[1])}${here ? t(' (here)', ' (here)') : ''}${isNext && !here ? '  ←' : ''}`;
      bt.disabled = here;
      bt.style.cssText = `text-align:left;padding:8px 12px;border-radius:14px 4px 4px 14px;border:0;font:inherit;cursor:pointer;color:#05060a;background:${isNext && !here ? '#ff9c3a' : here ? '#555' : '#9fb4ff'}`;
      bt.addEventListener('click', () => takeLift(spec.id));
      panel.appendChild(bt);
    }
    for (const ev of ['pointerdown', 'mousedown', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(panel);
  }
  function closeLiftPanel() { panel?.remove(); panel = null; }
  let fade = null;
  function setFade(k, label) {
    if (!fade) {
      fade = document.createElement('div');
      Object.assign(fade.style, { position: 'fixed', inset: 0, zIndex: 55, pointerEvents: 'none', background: '#05060a', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 26px system-ui, sans-serif', color: '#ffcc99', letterSpacing: '.08em' });
      document.body.appendChild(fade);
    }
    fade.style.opacity = String(k);
    if (label != null) fade.textContent = label;
  }
  function takeLift(id) {
    if (lift || !decks[id] || id === deck.spec.id) return;
    closeLiftPanel();
    lift = { to: id, t: 0, swapped: false };
  }
  function runLift(dt) {
    lift.t += dt;
    const k = lift.t / LIFT_TIME;
    const spec = decks[lift.to].spec;
    setFade(k < 0.35 ? k / 0.35 : k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35), `DECK ${spec.n}  ·  ${t(spec.name[0], spec.name[1]).toUpperCase()}`);
    if (!lift.swapped && k >= 0.5) { lift.swapped = true; showDeck(lift.to, { x: 0, z: -1.0, face: 0 }); }
    if (k >= 1) {
      lift = null; setFade(0);
      const n = nextStation();
      if (n && n.deck === deck.spec.id) hud?.toast?.(nextText(n), { kind: 'info', ms: 3200 });
    }
  }

  function updateCamera(dt, mouse) {
    if (mouse) {
      cam.yaw -= (mouse.dx || 0) * 0.0055;
      cam.pitch = clamp(cam.pitch + (mouse.dy || 0) * 0.0042, -0.05, 0.9);
      if (mouse.wheel) cam.dist = clamp(cam.dist * Math.exp(mouse.wheel * 0.0012), 2.2, 7);
      if (!mouse.dragging && Math.hypot(walker.vel.x, walker.vel.y) > 0.4) cam.yaw += angDiff(walker.heading, cam.yaw) * Math.min(1, dt * 0.9);
    }
    const fx = Math.sin(cam.yaw); const fz = Math.cos(cam.yaw);
    const tx = walker.pos.x; const tz = walker.pos.z; const ty = walker.pos.y + 1.0;
    const ceil = (deck.ceiling ?? 3.2) - 0.35;
    // Pull the camera in until it is over the floor (not in a wall), and under the ceiling.
    let dist = cam.dist;
    for (let k = 0; k < 10; k++) {
      const cx = tx - fx * dist * Math.cos(cam.pitch); const cz = tz - fz * dist * Math.cos(cam.pitch);
      if (deck.map.fits(cx, cz, 0.15) && ty + 0.3 + dist * Math.sin(cam.pitch) < ceil) break;
      dist *= 0.82;
    }
    camera.position.set(tx - fx * dist * Math.cos(cam.pitch), Math.min(ceil, ty + 0.3 + dist * Math.sin(cam.pitch)), tz - fz * dist * Math.cos(cam.pitch));
    camera.lookAt(tx, ty, tz);
  }

  function tick(dt, input, mouse, modalOpen = false) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    clock += dt;
    const modal = !!modalOpen || busy || !!lift;
    const eDown = !modal && isDown('KeyE');
    const pressedE = eDown && !prevE; prevE = eDown;
    const inp = input || { thrust: 0, turn: 0 };
    let speed;
    const collide = (p, v) => deck.map.collide(p, v);
    if (!modal) {
      const f = { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
      const rt = { x: -f.z, z: f.x };
      _move.set(f.x * (inp.thrust || 0) + rt.x * (inp.turn || 0), f.z * (inp.thrust || 0) + rt.z * (inp.turn || 0));
      if (_move.lengthSq() > 1) _move.normalize();
      const run = !!inp.precision || isDown('ShiftLeft') || isDown('ShiftRight');
      speed = walker.move(dt, { dir: _move, run, jump: !!inp.steady && !prevJump, terrain, collide });
      prevJump = !!inp.steady;
    } else {
      _move.set(0, 0);
      speed = walker.move(dt, { dir: _move, run: false, jump: false, terrain, collide });
    }
    walker.events.splice(0);
    walker.sync();
    walker.animate(dt, speed);
    crew.update(dt);
    const hx = walker.pos.x; const hz = walker.pos.z;
    deck.update?.(dt, clock, { herX: hx, herZ: hz });
    deck.lift.door.update(dt, hx, hz, lift ? 0 : null);
    beaconMat.opacity = 0.55 + 0.3 * Math.sin(clock * 3);
    beaconRing.scale.setScalar(1 + 0.08 * Math.sin(clock * 3));
    beaconArrow.position.y = 2.5 + 0.12 * Math.sin(clock * 2.2);
    beaconArrow.rotation.y = clock * 1.5;
    // The beacon on the lift: hidden while she is in it.
    const nx = nextStation();
    beacon.visible = !!nx && !(nx.deck !== deck.spec.id && hz < 0.6 && Math.abs(hx) < 1.6);
    if (lift) runLift(dt);
    updateCamera(dt, modal && !lift ? null : mouse);

    // In the lift: the deck panel. At a station: its prompt.
    const w = renderer.domElement.clientWidth || innerWidth; const h = renderer.domElement.clientHeight || innerHeight;
    overlay.resize(w, h, Math.min(2, devicePixelRatio || 1));
    const here = inLift(hx, hz);
    if (here && !modal) {
      openLiftPanel();
      for (const spec of DECKS) if (isDown(`Digit${spec.n}`)) takeLift(spec.id);
    } else if (!here) closeLiftPanel();
    let near = null;
    for (const st of stations) if (st.deck === deck.spec.id && !st.done && Math.hypot(hx - st.x, hz - st.z) < REACH) near = st;
    if (near && !modal) {
      _v.set(near.x, near.y ?? 2.2, near.z).applyMatrix4(deck.group.matrixWorld).project(camera);
      overlay.showPrompt((_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h, `${t(near.title[0], near.title[1])} · ${CREW_INFO[near.lead].name}`);
      if (pressedE) use(near);
    } else overlay.hidePrompt();
    overlay.draw(dt);
    if (finishSoon > 0) { finishSoon -= dt; if (finishSoon <= 0) finish({ done: stations.filter((s) => s.done).map((s) => s.id) }); }
  }

  showDeck(startDeck);
  const debug = {
    walker,
    stations,
    decks,
    get deck() { return deck.spec.id; },
    get done() { return stations.filter((s) => s.done).map((s) => s.id); },
    place(x, z) { walker.place(x, 0, z); deck.map.reset(x, z); },
    /** Stand at a station's spot (the next one by default), facing it; changes deck if needed. */
    goTo(id) {
      const st = id ? stations.find((s) => s.id === id) : nextStation();
      if (!st) return null;
      if (st.deck !== deck.spec.id) showDeck(st.deck);
      walker.place(st.x, 0, st.z, st.face); deck.map.reset(st.x, st.z); cam.yaw = st.face;
      return st.id;
    },
    /** Go straight to a deck (no lift ride). */
    showDeck(id) { showDeck(id); return deck.spec.id; },
    takeLift,
    pressE() { const st = stations.find((s) => s.deck === deck.spec.id && !s.done && Math.hypot(walker.pos.x - s.x, walker.pos.z - s.z) < REACH); if (st) use(st); return st?.id; },
    /** Put the camera on one of the deck's set points (for screenshots); null goes back to following her. */
    view(name) { const v = deck.views?.find((x) => x.name === name); viewPin = v || null; return !!v; },
  };
  let viewPin = null;
  const baseTick = tick;

  return {
    scene,
    camera,
    debug,
    start() {
      hud?.toast?.(t('On board! Walk with W A S D, drag to look. The lift joins the decks; press E at a station.', 'On board! Walk with W A S D. Press E at a station.'), { kind: 'info', ms: 5200 });
      const n = nextStation();
      if (n) setTimeout(() => { if (!disposed) hud?.toast?.(nextText(n), { kind: 'info', ms: 4200 }); }, 5400);
      else finishSoon = 0.5;
      return finished;
    },
    tick(dt, input, mouse, modalOpen) {
      baseTick(dt, input, mouse, modalOpen);
      if (viewPin) { camera.position.set(...viewPin.pos).applyMatrix4(deck.group.matrixWorld); camera.lookAt(_v.set(...viewPin.look).applyMatrix4(deck.group.matrixWorld)); }
    },
    dispose() {
      disposed = true;
      closeLiftPanel(); fade?.remove();
      overlay.canvas.remove();
      crew.dispose();
      walker.dispose?.();
      for (const d of Object.values(decks)) d.dispose?.();
      beaconRing.geometry.dispose(); beaconArrow.geometry.dispose(); beaconMat.dispose();
      kit.dispose();
    },
  };
}
