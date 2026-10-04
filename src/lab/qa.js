// Lab only: scripted play-throughs for the final check of Chapters 1 and 2,
// driven the way a child plays - walk to each thing, press E, answer through
// the real question pop-up - with teleports standing in for the walking.
//
//   const Q = await import('/src/lab/qa.js');
//   await Q.playChapter1();   // on chapter1.html
//   await Q.playChapter2();   // on chapter2.html
//
// Each returns a log and throws nothing: problems are listed as 'FAIL ...'.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastToast = () => [...document.querySelectorAll('.rv-toast')].slice(-1)[0]?.textContent || '';
/** Close any play-mode card (clue, found) that is open. */
const closeCards = async () => {
  for (let i = 0; i < 4; i++) {
    const b = [...document.querySelectorAll('.pl-bigbtn')].find((x) => x.offsetParent);
    if (!b) break;
    b.click();
    await sleep(40);
  }
};

/**
 * Hard mode: build refused first, then walk the clue chain (decoy first),
 * then the item must be found. `C` is window.__science / __city, `go(x, z)`
 * teleports in world units.
 */
async function playHunt(C, log, fail, goWorld, tryBuild, builtNow) {
  if (!C.getMode?.().treasureHunt) return;
  await closeCards();
  tryBuild();
  await sleep(50);
  if (builtNow()) { fail('Hard: final build went through without the hunt item'); return; }
  log.push(`Hard: build refused first: "${lastToast().slice(0, 70)}"`);
  const data = C.hunt.data;
  const d = data.decoys?.[0];
  if (d) {
    goWorld(d.at.x, d.at.z); C.interact(); await sleep(40);
    if (C.hunt.isFound()) fail('a decoy found the item');
    log.push(`decoy: "${lastToast().slice(0, 50)}"`);
  }
  for (const s of data.steps) {
    await closeCards();
    goWorld(s.at.x, s.at.z);
    C.interact();
    await sleep(60);
  }
  await closeCards();
  if (!C.hunt.isFound()) fail(`hunt not finished (at step ${C.hunt.state.step})`);
  else log.push(`hunt: found the ${data.itemName}`);
}

/** E enough times to mine one resource in the current mode. */
const mineHere = (C) => { const n = C.getMode?.().mineHits || 1; for (let i = 0; i < n; i++) C.interact(); };

/** Answer the open question correctly through the HUD, then close it. */
async function answerOpen(q) {
  if (q.type === 'choice') {
    const right = q.choices.find((c) => c.correct).text;
    const b = [...document.querySelectorAll('.rv-choices button')].find((x) => x.textContent.trim() === right);
    if (!b) return false;
    b.click();
  } else {
    const inp = document.querySelector('.rv-answer__input');
    inp.value = q.answers[0];
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.rv-modal button')].find((x) => x.textContent === 'Submit')?.click();
  }
  await sleep(60);
  [...document.querySelectorAll('.rv-modal button')].find((x) => /Continue|Close/.test(x.textContent) && x.offsetParent)?.click();
  await sleep(60);
  return true;
}

/** Answer one wrong first (a child might), then the right one. */
async function answerWrongThenRight(q) {
  if (q.type === 'choice') {
    const wrong = q.choices.find((c) => !c.correct).text;
    [...document.querySelectorAll('.rv-choices button')].find((x) => x.textContent.trim() === wrong)?.click();
  } else {
    const inp = document.querySelector('.rv-answer__input');
    inp.value = 'not this';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('.rv-modal button')].find((x) => x.textContent === 'Submit')?.click();
  }
  await sleep(60);
  const fb = document.querySelector('.rv-feedback')?.textContent || '';
  const stillOpen = !!document.querySelector('.rv-modal.is-open');
  const ok = await answerOpen(q);
  return { fb, stillOpen, ok };
}

export async function playChapter1() {
  const C = window.__science;
  const L = await import('/src/science/layout.js');
  const K = await import('/src/science/contracts.js');
  const Q = (await import('/src/science/questions.js')).questionsFor(K.LEVEL);
  const log = [`Chapter 1, Level ${K.LEVEL}, ${C.getMode?.().label || '?'} mode`];
  const fail = (m) => log.push(`FAIL ${m}`);
  const go = (tx, ty) => { const w = K.tileToWorld(tx, ty); C.controller.teleport(w.x, 0, w.z); window.__scienceRun(0.1); };
  const ask = async (key, tx, ty, wrongFirst = false) => {
    go(tx, ty);
    C.interact();
    await sleep(50);
    await closeCards();
    if (!C.hud.isModalOpen()) { C.interact(); await sleep(50); }
    if (!C.hud.isModalOpen()) { fail(`${key}: no question opened (${lastToast().slice(0, 70)})`); return; }
    if (wrongFirst) {
      const r = await answerWrongThenRight(Q[key]);
      if (!r.stillOpen) fail(`${key}: a wrong answer closed the question`);
      log.push(`${key}: wrong answer -> "${r.fb.slice(0, 50)}"`);
    } else await answerOpen(Q[key]);
    log.push(`${key}: solved=${!!C.rules.state.solved[key]}`);
  };

  // Building before any plan is refused.
  go(17, 26.4); C.interact();
  if (C.rules.state.built) fail('built with no plan');
  log.push(`early build refused: "${lastToast().slice(0, 60)}"`);

  // Locked iron is refused before the key.
  const locked = L.PICKUPS.find((p) => p.locked);
  go(locked.tx, locked.ty); C.interact();
  if (C.rules.isCollected(locked.id)) fail('locked iron collected without the key');

  // Smart path at Level 4, key path at Level 1 (both routes get covered).
  const boards = L.STATIONS.filter((s) => s.kind === 'mathBoard');
  if (K.LEVEL === 4) {
    for (const [i, s] of boards.entries()) await ask(s.quest, s.tx, s.ty + 1, i === 0);
    if (C.rules.state.recipeMode !== 'smart') fail(`recipe mode ${C.rules.state.recipeMode}`);
  } else {
    // Mine the iron that sits by the gate first (E takes the nearest thing).
    const near = L.PICKUPS.find((p) => p.tx === 23 && p.ty === 14);
    go(near.tx, near.ty); mineHere(C);
    await ask('key', 24, 14.2, true);
    if (C.rules.state.recipeMode !== 'brute') fail(`recipe mode ${C.rules.state.recipeMode}`);
    // Walk through the open gate into the yard.
    go(24, 15);
    for (let i = 0; i < 200; i++) C.controller.step(1 / 60, { forward: 1, strafe: 0, cameraYaw: 0, run: false, jump: false });
    const t = K.worldToTile(C.player.position.x, C.player.position.z);
    if (t.ty > 12) fail(`could not walk through the open gate (at ${t.tx},${t.ty})`);
    else log.push(`walked into the iron room (${t.tx},${t.ty})`);
  }
  for (const s of L.STATIONS.filter((x) => x.kind === 'lab')) await ask(s.quest, s.tx, s.ty + 1);

  // Walls block.
  go(19, 10);
  for (let i = 0; i < 200; i++) C.controller.step(1 / 60, { forward: 1, strafe: 0, cameraYaw: -Math.PI / 2, run: false, jump: false });
  const wt = K.worldToTile(C.player.position.x, C.player.position.z);
  if (wt.tx > 21) fail(`walked through the iron room wall (${wt.tx},${wt.ty})`);

  // Every resource.
  for (const p of L.PICKUPS) { go(p.tx, p.ty); mineHere(C); }
  const missingPick = L.PICKUPS.filter((p) => !C.rules.isCollected(p.id)).length;
  log.push(`pickups collected ${L.PICKUPS.length - missingPick}/${L.PICKUPS.length}`);
  if (missingPick && !(K.LEVEL === 4 && missingPick === 12)) fail(`${missingPick} pickups left`);
  const res = { ...C.rules.state.resources };

  const goW1 = (x, z) => { C.controller.teleport(x, 0, z); window.__scienceRun(0.1); };
  await playHunt(C, log, fail, goW1, () => { go(17, 26.4); C.interact(); }, () => C.rules.state.built);
  await closeCards();
  // Build.
  go(17, 26.4); C.interact();
  await sleep(2200); window.__scienceRun(0.2);
  if (!C.rules.state.built) fail(`not built: "${lastToast().slice(0, 90)}"`);
  const recipe = C.rules.recipe();
  for (const k of Object.keys(recipe)) if (res[k] - recipe[k] !== C.rules.state.resources[k]) fail(`spent wrong ${k}`);
  const saved = JSON.parse(localStorage.getItem(K.STORE_KEYS[K.LEVEL]) || '{}');
  if (saved.built !== true) fail('save has no built flag');
  log.push(`built=${C.rules.state.built}, saved.built=${saved.built}, progress ${C.rules.progress().pct}%`);
  return log;
}

export async function playChapter2() {
  const C = window.__city;
  const L = await import('/src/city/layout.js');
  const K = await import('/src/city/contracts.js');
  const Q = (await import('/src/city/questions.js')).questionsFor(K.LEVEL);
  const log = [`Chapter 2, Level ${K.LEVEL}, ${C.getMode?.().label || '?'} mode`];
  const fail = (m) => log.push(`FAIL ${m}`);
  const go = (tx, ty) => { const w = K.tileToWorld(tx, ty); C.controller.teleport(w.x, 0, w.z); window.__cityRun(0.1); };
  const ask = async (key, wrongFirst = false) => {
    const st = L.STATIONS.find((s) => s.quest === key);
    go(st.tx + 0.7, st.ty + 1.1);
    C.interact();
    await sleep(50);
    await closeCards();
    if (!C.hud.isModalOpen() && key !== 'bridge') { C.interact(); await sleep(50); }
    if (!C.hud.isModalOpen()) { log.push(`${key}: refused "${lastToast().slice(0, 70)}"`); return false; }
    if (wrongFirst) {
      const r = await answerWrongThenRight(Q[key]);
      if (!r.stillOpen) fail(`${key}: a wrong answer closed the question`);
    } else await answerOpen(Q[key]);
    await sleep(1600); // the structure rises piece by piece
    log.push(`${key}: solved=${!!C.rules.state.solved[key]} built=${C.rules.state.built[K.QUEST_TO_BUILD[key]]}`);
    return true;
  };

  for (const p of L.PICKUPS) { go(p.tx, p.ty); mineHere(C); }
  const left = L.PICKUPS.filter((p) => !C.rules.isCollected(p.id)).length;
  if (left) fail(`${left} pickups left`);

  if (await ask('bridge')) fail('bridge quest opened before the lock');
  for (const [i, q] of K.MEDIUM_QUESTS[K.LEVEL].slice(0, 3).entries()) await ask(q, i === 0);
  if (!C.rules.bridgeUnlocked()) fail('bridge still locked after 3 medium quests');
  await ask('bridge');
  // The rest, so the science total is there.
  for (const q of K.QUEST_IDS[K.LEVEL]) if (!C.rules.state.solved[q]) await ask(q);

  // Walk across the finished bridge; water still blocks elsewhere.
  go(24.6, 17);
  for (let i = 0; i < 150; i++) C.controller.step(1 / 60, { forward: 1, strafe: 0, cameraYaw: -Math.PI / 2, run: false, jump: false });
  const t = K.worldToTile(C.player.position.x, C.player.position.z);
  if (t.tx < 29) fail(`did not cross the bridge (at ${t.tx},${t.ty})`);
  go(24.6, 14);
  for (let i = 0; i < 200; i++) C.controller.step(1 / 60, { forward: 1, strafe: 0, cameraYaw: -Math.PI / 2, run: false, jump: false });
  const w = K.worldToTile(C.player.position.x, C.player.position.z);
  if (w.tx > 25) fail(`walked on water (at ${w.tx},${w.ty})`);

  const goW2 = (x, z) => { C.controller.teleport(x, 0, z); window.__cityRun(0.1); };
  await playHunt(C, log, fail, goW2, () => { go(29, 17.6); C.interact(); }, () => C.rules.state.builtFinal);
  await closeCards();
  go(29, 17.6); C.interact();
  await sleep(1800); window.__cityRun(0.2);
  if (!C.rules.state.builtFinal) fail(`workshop not built: "${lastToast().slice(0, 90)}"`);
  const saved = JSON.parse(localStorage.getItem(K.STORE_KEYS[K.LEVEL]) || '{}');
  if (saved.builtFinal !== true) fail('save has no builtFinal flag');
  log.push(`builtFinal=${C.rules.state.builtFinal}, workshop pieces=${C.rules.state.built.workshop}, progress ${C.rules.progress().pct}%`);
  return log;
}

/**
 * Chapter 3: follow the quest chain station by station with the E key and
 * the real question pop-up. Supplies for build steps are topped up to the
 * step's cost (gathering is walking; the mining itself is checked once, on
 * one node, per mode). On Hard, LAUNCH must be refused until the hunt is
 * done. Ends by pressing LAUNCH.
 */
export async function playChapter3() {
  const G = window.__game;
  const { QUESTIONS } = await import('/src/game/questions.js');
  const mode = G.getMode();
  const log = [`Chapter 3, ${mode.label} mode`];
  const fail = (m) => log.push(`FAIL ${m}`);
  const E = () => { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); };
  const goto = (x, z) => { G.controller.teleport(x, G.village.heightAt(x, z), z); window.__gameRun(0.3); };
  await closeCards();

  // Mining: one node, the mode's number of presses.
  const nodes = G.pickups.nodes || [];
  const node = nodes.find((n) => !n.collected && n.mesh?.visible !== false);
  if (node && mode.mineHits > 1) {
    const inv0 = { ...G.engine.state.inventory };
    goto(node.x, node.z);
    for (let i = 0; i < mode.mineHits - 1; i++) { E(); window.__gameRun(0.05); }
    const early = JSON.stringify(G.engine.state.inventory) !== JSON.stringify(inv0);
    E(); window.__gameRun(0.1);
    const got = JSON.stringify(G.engine.state.inventory) !== JSON.stringify(inv0);
    if (early) fail(`mined before ${mode.mineHits} presses`);
    if (!got) fail('mining never collected');
    else log.push(`mining: collected after ${mode.mineHits} presses`);
  }

  let wrongTried = false;
  for (let guard = 0; guard < 40; guard++) {
    const step = G.engine.current();
    if (!step) break;
    const st = G.stations.byId.get(step.stationId);
    goto(st.x, st.z + 1.2);
    if (step.kind === 'launch' || step.id === 'step_launch') {
      if (mode.treasureHunt) {
        E(); window.__gameRun(0.3); await sleep(40);
        if (G.engine.state.launched) { fail('Hard: launched without the Guidance Crystal'); break; }
        log.push(`Hard: launch refused first: "${lastToast().slice(0, 60)}"`);
        const data = G.hunt.data;
        const d = data.decoys?.[0];
        if (d) { goto(d.at.x, d.at.z); E(); window.__gameRun(0.1); log.push(`decoy: "${lastToast().slice(0, 50)}"`); }
        for (const [i, s] of data.steps.entries()) {
          for (let a = 0; a < 4 && G.hunt.state.step === i && !G.hunt.isFound(); a++) {
            await closeCards(); await sleep(120); goto(s.at.x, s.at.z); E(); window.__gameRun(0.1); await sleep(120);
          }
        }
        await closeCards();
        if (!G.hunt.isFound()) { fail(`hunt not finished (step ${G.hunt.state.step})`); break; }
        log.push(`hunt: found the ${data.itemName}`);
        goto(st.x, st.z + 1.2);
      }
      E(); window.__gameRun(0.5);
      if (!G.engine.state.launched) fail(`launch did not start: "${lastToast().slice(0, 60)}"`);
      log.push(`launched=${!!G.engine.state.launched}`);
      break;
    }
    if (step.questionId) {
      E(); await sleep(60); await closeCards();
      if (!G.hud.isModalOpen()) { E(); await sleep(60); }
      if (!G.hud.isModalOpen()) { fail(`${step.id}: no question at ${step.stationId} ("${lastToast().slice(0, 50)}")`); break; }
      const q = QUESTIONS[step.questionId];
      if (!wrongTried) { wrongTried = true; const r = await answerWrongThenRight(q); if (!r.stillOpen) fail('a wrong answer closed the question'); }
      else await answerOpen(q);
      if (G.engine.current()?.id === step.id) { fail(`${step.id}: answer not accepted`); break; }
    } else if (step.cost) {
      const inv = G.engine.state.inventory;
      for (const [k, v] of Object.entries(step.cost)) if ((inv[k] || 0) < v) inv[k] = v;
      // A building still rising piece by piece (real time) blocks the next
      // build: wait and try again, as a child would.
      for (let a = 0; a < 8 && G.engine.current()?.id === step.id; a++) { const s2 = G.stations.byId.get(step.stationId); goto(s2.x, s2.z + 1.2); E(); window.__gameRun(0.3); if (G.engine.current()?.id === step.id) await sleep(700); }
      if (G.engine.current()?.id === step.id) { fail(`${step.id}: build did not go through ("${lastToast().slice(0, 60)}")`); break; }
    } else {
      E(); window.__gameRun(0.3);
      if (G.engine.current()?.id === step.id) { fail(`${step.id}: nothing happened`); break; }
    }
    log.push(`${step.id}: ok`);
  }
  log.push(`progress ${G.engine.progressPercent()}%`);
  return log;
}

/**
 * Collision probe: for each item, start 5 units away on each of four sides
 * and walk straight at its centre for 2.5 s. Reports how close she got and
 * whether she ended up UNDER the item's own geometry (a downward ray from the
 * sky hits the item above 0.9 units at her feet), which means she walked into
 * or through it.
 *
 * @param {{ items: {name:string, x:number, z:number, min:number, group?:object}[],
 *   teleport:(x:number,z:number)=>void, step:(dt:number, input:object)=>void,
 *   pos:()=>{x:number,z:number}, THREE:object }} a
 */
export function probeSolids({ items, teleport, step, pos, THREE, camera = null }) {
  const ray = new THREE.Raycaster();
  if (camera) ray.camera = camera;   // sprites (labels) need it to be raycast
  const down = new THREE.Vector3(0, -1, 0);
  const out = [];
  for (const it of items) {
    let worst = Infinity;
    let under = false;
    for (const [sx, sz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
      teleport(it.x + sx, it.z + sz);
      const yaw = Math.atan2(sx, sz);   // forward = (-sin yaw, -cos yaw) points at the centre
      for (let i = 0; i < 150; i++) step(1 / 60, { forward: 1, strafe: 0, cameraYaw: yaw, run: false, jump: false });
      const p = pos();
      const d = Math.hypot(p.x - it.x, p.z - it.z);
      worst = Math.min(worst, d);
      if (it.group) {
        ray.set(new THREE.Vector3(p.x, 30, p.z), down);
        const hit = ray.intersectObject(it.group, true).find((h) => h.object.visible && !h.object.isSprite && h.point.y > 0.9);
        if (hit) under = true;
      }
    }
    const pass = worst >= it.min && !under;
    out.push(`${pass ? 'ok  ' : 'FAIL'} ${it.name}: closest ${worst.toFixed(2)} (needs >= ${it.min})${under ? ' - ended up under/inside it' : ''}`);
  }
  return out;
}
