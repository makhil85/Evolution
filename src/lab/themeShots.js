// Lab only: the three HUD moments the theme pass is judged on, per village -
// a normal moment, a question card and a busy moment (several pickups in a
// row) - saved as docs/progress/<prefix>_<moment>.png through src/lab/shot.js.
//
//   const T = await import('/src/lab/themeShots.js'); await T.themeShots('after_ch1_1366');

import { shot } from './shot.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const closeCards = async () => {
  for (let i = 0; i < 4; i++) {
    const b = [...document.querySelectorAll('.pl-bigbtn')].find((x) => x.offsetParent);
    if (!b) break;
    b.click();
    await sleep(40);
  }
};

async function village() {
  if (window.__science?.rules) {
    const C = window.__science;
    const L = await import('/src/science/layout.js');
    const K = await import('/src/science/contracts.js');
    const go = (tx, ty) => { const w = K.tileToWorld(tx, ty); C.controller.teleport(w.x, 0, w.z); window.__scienceRun(0.1); };
    const board = L.STATIONS.find((s) => s.kind === 'mathBoard' || s.kind === 'lab');
    return { C, run: window.__scienceRun, go, pickups: L.PICKUPS, ask: () => { go(board.tx, board.ty + 1); C.interact(); } };
  }
  if (window.__city?.rules) {
    const C = window.__city;
    const L = await import('/src/city/layout.js');
    const K = await import('/src/city/contracts.js');
    const go = (tx, ty) => { const w = K.tileToWorld(tx, ty); C.controller.teleport(w.x, 0, w.z); window.__cityRun(0.1); };
    const st = L.STATIONS.find((s) => s.quest && s.quest !== 'bridge');
    return { C, run: window.__cityRun, go, pickups: L.PICKUPS, ask: () => { go(st.tx + 0.7, st.ty + 1.1); C.interact(); } };
  }
  const G = window.__game;
  const E = () => { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); };
  const goto = (x, z) => { G.controller.teleport(x, G.village.heightAt(x, z), z); window.__gameRun(0.3); };
  return {
    C: G,
    run: window.__gameRun,
    gameNodes: G.pickups.nodes || [],
    goto,
    E,
    // The next quest step's station; asks only when that step is a question.
    ask: () => {
      const step = G.engine.current();
      const st = step && G.stations.byId.get(step.stationId);
      if (st) { goto(st.x, st.z + 1.2); E(); }
    },
  };
}

export async function themeShots(prefix) {
  const V = await village();
  const out = [];
  await closeCards();
  V.run(1);
  out.push(await shot(`${prefix}_normal`));

  // Busy: several pickups back to back (the toast pile-up).
  if (V.pickups) {
    const mine = V.C.getMode?.().mineHits || 1;
    for (const p of V.pickups.filter((x) => !x.locked).slice(0, 5)) {
      V.go(p.tx, p.ty);
      for (let i = 0; i < mine; i++) V.C.interact();
      V.run(0.3);
      await sleep(250);
    }
  } else {
    const mine = V.C.getMode?.().mineHits || 1;
    for (const n of V.gameNodes.filter((x) => !x.collected).slice(0, 5)) {
      V.goto(n.x, n.z);
      for (let i = 0; i < mine; i++) { V.E(); V.run(0.05); }
      await sleep(250);
    }
  }
  await closeCards();
  out.push(await shot(`${prefix}_busy`));

  V.ask();
  await sleep(120);
  await closeCards();
  if (!V.C.hud?.isModalOpen?.()) { V.ask(); await sleep(120); }
  out.push(await shot(`${prefix}_question`));
  return out;
}
