// Chapter 6 interior: a plain stand-in room for a deck that isn't built yet
// (a box room in front of the lift, its stations along the far wall). The
// real decks replace it; nothing ships with it.
import * as THREE from 'three';

export function placeholderDeck(kit, { stations = [], crew = [], label = 'DECK', w = 16, d = 16 } = {}) {
  const group = new THREE.Group();
  const b = kit.batch();
  const room = { rect: [0, d / 2, w, d] };
  kit.floor(b, room);
  kit.ceiling(b, room, 3.2);
  const solids = [
    kit.wall(b, -w / 2, 0, -1.3, 0), kit.wall(b, 1.3, 0, w / 2, 0),
    kit.wall(b, -w / 2, 0, -w / 2, d), kit.wall(b, w / 2, 0, w / 2, d), kit.wall(b, -w / 2, d, w / 2, d),
  ];
  b.flush(group);
  const sign = kit.sign(label); sign.position.set(0, 2.7, 0.15); group.add(sign);
  const st = {};
  stations.forEach((id, k) => {
    const x = (k - (stations.length - 1) / 2) * 4;
    const c = kit.console(x, d - 1.2, Math.PI, { screen: { title: id } });
    group.add(c.group); solids.push(c.solid);
    const lamp = kit.lamp(); lamp.position.set(x, 1.5, d - 1.2); group.add(lamp);
    st[id] = { x, z: d - 2.6, face: 0, lamp };
  });
  const crewSpots = {};
  crew.forEach((id, k) => { crewSpots[id] = { x: -w / 2 + 2 + k * 1.5, z: d - 3, face: Math.PI / 2 }; });
  return {
    group, floors: [room], solids, ceiling: 3.2, stations: st, crewSpots,
    views: [{ name: 'room', pos: [0, 1.7, 1.5], look: [0, 1.2, d] }],
    update() {},
    dispose() {},
  };
}
