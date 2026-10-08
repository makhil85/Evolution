// Chapter 6 interior: Deck 1, the bridge (Star Trek TNG style, lead 2026-10-08).
// From the lift a short corridor (7.4 m, 3.4 m wide, bending gently) ends at a
// sliding door in the bridge's near wall. The bridge is a round room, 18 m across,
// with a domed ceiling (3.6 m rim, 4.2 m top) and a light ring. Its front wall is
// the viewscreen (9.5 m wide, framed); the helm and ops consoles stand in front of
// the captain's chair in the centre, with their operators' chairs between. A curved
// tactical rail behind the chairs marks the raised back half-ring: the floor stays
// flat, the rail and a lit step strip show the level, and a gap in the rail at the
// centre lets her through (its lit step edge stands 12 cm above the floor; she
// still walks at floor level). The shield console sits on the rail. Two science
// bays open off the sides; the floor is inlaid with rings, the panels are coloured.
//
// The bridge is built in its own frame (metres from its centre, +z to the
// viewscreen, turned by the corridor's bend) and converted to deck metres for the
// walk map. The static parts go in one batch; the screens and the star window
// are their own meshes so they can move.
import * as THREE from 'three';
import { PALETTE } from './kit.js';
import { toonRamp } from '../../../game/toonPipeline.js';

const R = 9;                  // the round wall: 18 m across
const RF = R - 0.3;           // the floor reaches the wall's inner face
const RIM = 3.6;              // the wall top; the dome rises to APEX at the centre
const APEX = 4.2;
const RR = 4.6;               // the tactical rail, behind the chairs
const BAY_W = 2.6;            // science bays: half-width, and their far wall at BAY_X
const BAY_X = 15;
const GAP_BAY = Math.asin(BAY_W / R);
const GAP_DOOR = Math.asin(1.7 / R);
const CORR = 40;              // the corridor bends on a circle of this radius
const A_LIFT = -Math.PI / 2;  // the lift's line (z = 0) ...
const A_END = A_LIFT + 0.185; // ... and the bridge door, 7.4 m on
const YAW = A_END - A_LIFT;   // the bridge faces the way the corridor ends
const SN = Math.sin(YAW); const CS = Math.cos(YAW);
const DOOR = [CORR + CORR * Math.sin(A_END), CORR * Math.cos(A_END)];
const HUB = [DOOR[0] + R * SN, DOOR[1] + R * CS]; // the bridge's centre, in deck metres
const AS = Math.PI + 0.85;                        // the shield console, on the rail (back, left)
const SHIELD_AT = [4.0 * Math.sin(AS), 4.0 * Math.cos(AS)];
/** A point on the corridor's bend (a = angle on the circle of radius CORR). */
const corrPoint = (a) => [CORR + CORR * Math.sin(a), CORR * Math.cos(a)];

/** Bridge metres -> deck metres. */
const toDeck = (x, z) => [HUB[0] + x * CS + z * SN, HUB[1] - x * SN + z * CS];
/** A walk-map shape written in bridge metres, in deck metres. */
function shapeToDeck(s) {
  if (s.rect) { const [x, z] = toDeck(s.rect[0], s.rect[1]); return { rect: [x, z, s.rect[2], s.rect[3]], rot: YAW + (s.rot || 0) }; }
  if (s.disc) { const [x, z] = toDeck(s.disc[0], s.disc[1]); return { disc: [x, z, s.disc[2]] }; }
  const [x, z] = toDeck(s.ring[0], s.ring[1]);
  return { ring: [x, z, s.ring[2], s.ring[3]], from: s.from == null ? undefined : s.from + YAW, to: s.to == null ? undefined : s.to + YAW };
}
/** Turn a geometry's faces round so they show from the other side (for things seen from inside). */
function inward(g) {
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

export function buildDeck(kit) {
  const { mats } = kit;
  const group = new THREE.Group();
  const floors = []; const solids = [];
  const toon = (color, extra = {}) => kit.own(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra }));
  const wood = toon(0xb07a4a);
  const glowBlue = kit.glow(PALETTE.blue, 1.3);
  const glowCool = kit.glow(0xcfe6ff, 1.8);
  const teal = toon(PALETTE.teal);
  const inlay = toon(0x6f5f8c);
  // Ceilings are seen from below, where the cool sky light never reaches; this lighter stuff reads better.
  const ceilMat = toon(0xd9d2c6, { emissive: 0x3a3630 });
  // The dome: cooler and brighter than the warm ceilings, so it reads as a dome.
  const domeMat = toon(0xe4ebf5, { emissive: 0x2a3140 });

  /** A flat band of arc (faces up), centred on (x, z) at height y. */
  const band = (b, r0, r1, a0, a1, mat, { x = 0, y = 0, z = 0, down = false } = {}) => {
    const g = new THREE.RingGeometry(r0, r1, Math.max(8, Math.round(((a1 - a0) * r1) / 0.4)), 1, a0 - Math.PI / 2, a1 - a0);
    g.rotateX(-Math.PI / 2);
    b.add(down ? inward(g) : g, mat, x, y, z);
  };
  /** A curved wall band (an open cylinder arc); `inside` turns it to face the centre. */
  const arcWall = (b, r, h, a0, a1, mat, { y = h / 2, inside = false } = {}) => {
    const g = new THREE.CylinderGeometry(r, r, h, Math.max(6, Math.round(((a1 - a0) * r) / 0.5)), 1, true, a0, a1 - a0);
    b.add(inside ? inward(g) : g, mat, 0, y, 0);
  };

  // --- the corridor: from the lift door to the bridge's door, bending gently ---------------
  const cb = kit.batch();
  const corr = { ring: [CORR, 0, 38.3, 41.7], from: A_LIFT, to: A_END };
  floors.push(kit.floor(cb, corr));
  band(cb, 38.3, 41.7, A_LIFT, A_END, ceilMat, { x: CORR, y: 3.2, down: true });
  solids.push(kit.wallArc(cb, CORR, 0, 38.3, A_LIFT, A_END, { h: 3.2 }));
  solids.push(kit.wallArc(cb, CORR, 0, 41.95, A_LIFT, A_END, { h: 3.2 }));
  cb.flush(group);

  // LCARS tags on both corridor walls (the bend's inside and outside), so the walk is not bare.
  const tagIn = kit.screen(1.4, 0.7, { title: 'DECK 1', accent: PALETTE.lilac, seed: 61 });
  tagIn.position.set(CORR + 38.33 * Math.sin(A_LIFT + 0.06), 1.7, 38.33 * Math.cos(A_LIFT + 0.06));
  tagIn.rotation.y = A_LIFT + 0.06; group.add(tagIn);
  const tagOut = kit.screen(1.4, 0.7, { title: 'SHIELD', kind: 'map', accent: PALETTE.teal, seed: 62 });
  tagOut.position.set(CORR + 41.67 * Math.sin(A_LIFT + 0.14), 1.7, 41.67 * Math.cos(A_LIFT + 0.14));
  tagOut.rotation.y = A_LIFT + 0.14 + Math.PI; group.add(tagOut);

  const door = kit.door(DOOR[0], DOOR[1], YAW, { w: 3.0, h: 2.5 });
  group.add(door.group);
  // The name over the door, seen from the corridor.
  const sign = kit.sign('Bridge', { w: 2.2, h: 0.46, color: PALETTE.gold });
  sign.position.set(DOOR[0], 2.95, DOOR[1]); sign.rotation.y = YAW + Math.PI; group.add(sign);

  // --- the bridge: local frame, one batch, flushed into a group turned to the corridor -----
  const bb = kit.batch();
  const bridge = new THREE.Group();
  bridge.position.set(HUB[0], 0, HUB[1]); bridge.rotation.y = YAW;
  group.add(bridge);

  // The floor runs to the outer wall, so it meets the corridor at the entrance gap.
  floors.push(shapeToDeck(kit.floor(bb, { disc: [0, 0, R] })));

  // The raised back half-ring: a 12 cm step (riser and lit edge), a different floor, the rail.
  const BACK = [Math.PI / 2 + GAP_BAY, 1.5 * Math.PI - GAP_BAY];
  band(bb, RR + 0.2, RF, BACK[0], BACK[1], mats.deck, { y: 0.12 });
  arcWall(bb, RR + 0.2, 0.12, BACK[0], BACK[1], mats.wallDark, { inside: true });
  band(bb, RR + 0.2, RR + 0.38, BACK[0], BACK[1], glowBlue, { y: 0.125 });
  // Rings inlaid in the floor: one round the middle, one across the front.
  band(bb, 3.0, 3.1, 0, Math.PI * 2, inlay, { y: 0.003 });
  band(bb, 6.4, 6.5, -1.3, 1.3, inlay, { y: 0.003 });
  const RAIL = [[Math.PI / 2 + 0.25, Math.PI - 0.25], [Math.PI + 0.25, 1.5 * Math.PI - 0.25]];
  for (const [a0, a1] of RAIL) {
    arcWall(bb, RR + 0.2, 0.95, a0, a1, wood);
    arcWall(bb, RR - 0.2, 0.95, a0, a1, wood, { inside: true });
    band(bb, RR - 0.2, RR + 0.2, a0, a1, wood, { y: 0.95 });
    for (let k = 0; k <= 6; k++) { const a = a0 + ((a1 - a0) * k) / 6; bb.cyl(0.06, 0.06, 0.95, wood, RR * Math.sin(a), 0.475, RR * Math.cos(a)); }
    // Solid through the rail: a thin rail would leak under the grid's 0.2 m cells.
    solids.push(shapeToDeck({ ring: [0, 0, RR - 0.2, RR + 0.2], from: a0, to: a1 }));
  }

  // The round wall, open at the entrance and at the two science bays.
  for (const [a0, a1] of [[-Math.PI / 2 + GAP_BAY, Math.PI / 2 - GAP_BAY], [Math.PI / 2 + GAP_BAY, Math.PI - GAP_DOOR], [Math.PI + GAP_DOOR, 1.5 * Math.PI - GAP_BAY]]) {
    solids.push(shapeToDeck(kit.wallArc(bb, 0, 0, R, a0, a1, { h: RIM })));
  }

  // A chair facing the viewscreen. The captain's has the tall back and an orange cushion.
  // Rounded: a drum seat, a curved back (the captain's orange, the others' blue), a round headrest.
  const chair = (x, z, { captain = false, arms = true } = {}) => {
    const back = captain ? 1.25 : 0.95;
    bb.cyl(0.3, 0.36, 0.22, mats.trim, x, 0.11, z, { seg: 16 });
    bb.cyl(0.34, 0.3, 0.16, mats.metal, x, 0.5, z, { seg: 16 });
    bb.cyl(0.34, 0.3, back, captain ? mats.accentOrange : mats.accentBlue, x, 0.5 + back / 2, z - 0.34, { seg: 16 });
    bb.cyl(0.2, 0.2, 0.2, mats.metal, x, 0.5 + back + 0.1, z - 0.34, { seg: 12 });
    if (arms) for (const s of [-1, 1]) {
      bb.box(0.1, 0.1, 0.5, mats.trim, x + s * 0.36, 0.72, z + 0.02);
      bb.box(0.07, 0.03, 0.4, mats.coveCool, x + s * 0.36, 0.78, z + 0.02); // the armrest panels
    }
    solids.push(shapeToDeck({ rect: [x, z, 0.8, 0.8] }));
  };
  chair(0, -0.2, { captain: true });
  band(bb, 1.5, 1.62, 0, Math.PI * 2, glowBlue, { y: 0.006, z: -0.2 }); // the ring round her chair

  // A console desk: its front top slopes down, a lit edge along the front, a screen
  // on top. `ry` turns the front (+z) to where she should stand.
  const desk = (x, z, ry, w, scr) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const body = kit.own(new THREE.BoxGeometry(w, 0.8, 0.6));
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) > 0) p.setY(i, p.getY(i) - 0.22);
    body.computeVertexNormals(); body.translate(0, 0.4, 0);
    const edge = kit.own(new THREE.BoxGeometry(w * 0.9, 0.04, 0.05)); edge.translate(0, 0.2, 0.31);
    g.add(new THREE.Mesh(body, mats.panel), new THREE.Mesh(edge, mats.coveCool));
    const s = kit.screen(w * 0.92, 0.5, { seed: Math.round(x * 13 + z * 7), ...scr });
    s.position.set(0, 0.72, 0.05); s.rotation.x = -Math.PI / 2 + 0.55;
    g.add(s);
    bridge.add(g);
    solids.push(shapeToDeck({ rect: [x, z, w + 0.1, 0.85], rot: ry }));
    return g;
  };
  for (const s of [-1, 1]) {
    chair(s * 2.1, -0.7);
    chair(s * 1.9, 3.0, { arms: false }); // the helm and ops operators, facing the screen
    desk(s * 1.9, 4.2, Math.PI, 1.6, { title: s < 0 ? 'NAV' : 'SYSTEMS', accent: s < 0 ? PALETTE.blue : PALETTE.peach, seed: 41 + s });
  }

  // The shield console, built into the rail (its panel faces the centre).
  const shGroup = desk(SHIELD_AT[0], SHIELD_AT[1], AS + Math.PI, 1.8, { title: 'SHIELD', accent: PALETTE.lilac, seed: 21 });
  const lamp = kit.lamp(PALETTE.gold); lamp.position.set(0.8, 0.8, 0.14); shGroup.add(lamp);

  // The science bays: a console each, facing the centre.
  for (const k of [1, -1]) {
    const x0 = k * (R - 0.4); const xf = k * BAY_X;
    solids.push(shapeToDeck(kit.wall(bb, x0, BAY_W, xf, BAY_W, { h: RIM })));
    solids.push(shapeToDeck(kit.wall(bb, x0, -BAY_W, xf, -BAY_W, { h: RIM })));
    solids.push(shapeToDeck(kit.wall(bb, xf, -BAY_W, xf, BAY_W, { h: RIM })));
    const bay = { rect: [(x0 + xf) / 2, 0, Math.abs(xf - x0), 2 * BAY_W] };
    floors.push(shapeToDeck(kit.floor(bb, bay)));
    bb.add(new THREE.PlaneGeometry(Math.abs(xf - x0), 2 * BAY_W).rotateX(Math.PI / 2), ceilMat, (x0 + xf) / 2, RIM, 0);
    for (const zz of [-1.2, 1.2]) bb.box(Math.abs(xf - x0) * 0.8, 0.03, 0.16, mats.coveCool, (x0 + xf) / 2, RIM - 0.02, zz);
    const cx = k * (BAY_X - 1.6); const ry = -k * Math.PI / 2;
    desk(cx, 0, ry, 2.2, { title: 'SCIENCE', accent: PALETTE.teal, seed: k > 0 ? 31 : 32 });
  }

  // The dome: a shallow sphere cap from the rim up to the apex, with two light rings.
  const RS = (R * R + (APEX - RIM) ** 2) / (2 * (APEX - RIM));
  const dome = new THREE.SphereGeometry(RS, 48, 6, 0, Math.PI * 2, 0, Math.asin(R / RS));
  bb.add(inward(dome), domeMat, 0, APEX - RS, 0);
  const domeY = (r) => APEX - RS + Math.sqrt(RS * RS - r * r);
  bb.add(new THREE.TorusGeometry(8.6, 0.06, 6, 72).rotateX(Math.PI / 2), glowCool, 0, domeY(8.6), 0);
  bb.add(new THREE.TorusGeometry(5.0, 0.05, 6, 56).rotateX(Math.PI / 2), glowCool, 0, domeY(5.0), 0);

  // The viewscreen: a framed, curved window on the front wall.
  arcWall(bb, 8.6, 2.95, -0.66, 0.66, mats.trim, { y: 2.025, inside: true });
  const sw = kit.starWindow(9.5, 2.35, { speed: 0.003 });
  const scr = new THREE.Mesh(kit.own(inward(new THREE.CylinderGeometry(8.45, 8.45, 2.35, 48, 1, true, -0.6, 1.2))), kit.own(new THREE.MeshBasicMaterial({ map: sw.mesh.material.map })));
  scr.position.set(0, 2.025, 0); bridge.add(scr);

  // LCARS panels round the curved wall, facing the centre at eye level.
  const screens = [];
  // Each panel sits on a coloured frame, so the back wall reads as a row of colour.
  const panel = (title, a, frame, opts) => {
    const p = kit.screen(1.8, 1.0, { title, ...opts });
    p.position.set(8.5 * Math.sin(a), 1.9, 8.5 * Math.cos(a));
    p.rotation.y = a + Math.PI;
    bridge.add(p); screens.push(p);
    bb.add(new THREE.BoxGeometry(1.92, 1.12, 0.06), frame, 8.55 * Math.sin(a), 1.9, 8.55 * Math.cos(a), a + Math.PI);
  };
  panel('NAV', 1.15, mats.accentBlue, { kind: 'map', accent: PALETTE.blue, seed: 3 });
  panel('SYSTEMS', -1.15, teal, { seed: 5, accent: PALETTE.teal });
  panel('COMMS', Math.PI - 0.45, mats.accentLilac, { seed: 7, accent: PALETTE.lilac });
  panel('SHIELD', Math.PI + 0.45, mats.accentOrange, { seed: 9, accent: PALETTE.gold });
  panel('SCIENCE', Math.PI + 1.0, mats.accentBlue, { seed: 11, accent: PALETTE.peach });

  bb.flush(bridge);
  // The two lights the deck may use: over the captain (the dome's light) and in the corridor.
  const hubLight = new THREE.PointLight(0xfff1e0, 2.5, 0, 1); hubLight.position.set(0, 3.0, 0); bridge.add(hubLight);
  const corrLight = new THREE.PointLight(0xfff1e0, 1, 0, 1); corrLight.position.set(...corrPoint(A_LIFT + 0.14), 2.8); group.add(corrLight);

  // --- where she stands, and who stands beside her ---------------------------------------
  const faceAt = (p, q) => Math.atan2(q[0] - p[0], q[1] - p[1]);
  const shieldSpot = toDeck(3.0 * Math.sin(AS), 3.0 * Math.cos(AS));
  const shieldProp = toDeck(SHIELD_AT[0], SHIELD_AT[1]);
  const doctorSpot = toDeck(3.0 * Math.sin(AS - 0.45), 3.0 * Math.cos(AS - 0.45));

  // --- the views for screenshots (deck metres) ---------------------------------------------
  const e = corrPoint(A_END - 0.14);
  const [ex, ez] = toDeck(0, 2.6);
  const at = (x, y, z) => { const [dx, dz] = toDeck(x, z); return [dx, y, dz]; };
  const views = [
    { name: 'entrance', pos: [e[0], 1.6, e[1]], look: [ex, 1.4, ez] },
    { name: 'screen', pos: at(0, 2.3, -2.4), look: at(0, 1.7, 9) },
    { name: 'back', pos: at(0, 1.6, 7.6), look: at(0, 1.1, -7) },
    { name: 'shield', pos: at(-0.9, 1.9, -3.4), look: at(SHIELD_AT[0], 1.0, SHIELD_AT[1]) }, // from the side: the beacon stands on the spot
    { name: 'bay', pos: at(3.0, 1.6, -3.0), look: at(14, 1.4, 0.5) },
    { name: 'ring', pos: at(6.0, 2.3, -5.6), look: at(-3, 1.0, 3) },
    { name: 'walk', pos: at(-1.0, 1.6, -5.8), look: at(0.5, 1.4, 9) }, // her eye level, on the way in
  ];

  return {
    group,
    floors,
    solids,
    ceiling: APEX,
    stations: { shield: { x: shieldSpot[0], z: shieldSpot[1], face: faceAt(shieldSpot, shieldProp), lamp, y: 2.2 } },
    crewSpots: { doctor: { x: doctorSpot[0], z: doctorSpot[1], face: faceAt(doctorSpot, shieldProp) } },
    views,
    update(dt, t, ctx) {
      door.update(dt, ctx.herX, ctx.herZ);
      sw.update(t);
      for (let i = 0; i < screens.length; i++) screens[i].material.color.setScalar(1.05 + 0.1 * Math.sin(t * 1.4 + i * 1.3));
    },
    // The kit owns every geometry and material made here.
    dispose() {},
  };
}
