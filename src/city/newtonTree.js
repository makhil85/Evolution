// Chapter 2 side story: Newton's apple tree.
//
// An apple tree stands near where she starts. Press E under it and an apple
// drops (really accelerating, ½gt²), and a short conversation follows: why did
// it fall DOWN, the young Isaac Newton in his garden, does Earth pull the Moon
// too, and one gravity question. It is a bonus: two tries like every question,
// but a second miss just explains the answer - it never restarts the chapter.
// The first time through gives +1 Science; she can hear it again any time.
import * as THREE from 'three';
import { toonRamp } from '../game/toonPipeline.js';
import { heroName } from '../game/chapterStory.js';

const G = 9.8;
const TRUNK_R = 0.45; // solid radius around the trunk

const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });

function buildTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 8), mat(0x7a5230));
  trunk.position.y = 1.1;
  g.add(trunk);
  const leaf = mat(0x4fa84a);
  for (const [x, y, z, r] of [[0, 2.9, 0, 1.35], [0.9, 2.5, 0.3, 0.9], [-0.85, 2.6, -0.2, 0.95], [0.1, 2.5, -0.9, 0.85], [-0.2, 2.45, 0.9, 0.85]]) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
    s.position.set(x, y, z);
    g.add(s);
  }
  for (const m of g.children) { m.castShadow = true; m.receiveShadow = true; }
  // Apples on the outside of the leaves.
  const appleGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const appleMat = mat(0xe0352b);
  const apples = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const y = 2.2 + (i % 3) * 0.35;
    const r = 1.15 - (i % 3) * 0.12;
    const apple = new THREE.Mesh(appleGeo, appleMat);
    apple.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(apple);
    apples.push(apple);
  }
  return { group: g, apples };
}

const QUIZ = {
  4: {
    q: 'Newton drops a BIG apple and a SMALL apple from the same branch at the same moment (no wind). Which one reaches the ground first?',
    options: ['The big apple', 'The small apple', 'They land at the same time'],
    answer: 2,
    why: 'Gravity speeds up heavy and light things the same way, so they land together. (A feather is slow only because air gets in its way: on the Moon, with no air, a hammer and a feather landed together!)',
  },
  1: {
    q: 'If you let go of an apple, which way does it go?',
    options: ['Up to the sky', 'Down to the ground', 'It floats where it is'],
    answer: 1,
    why: 'Gravity pulls things DOWN. That is why apples, balls and you always come back down!',
  },
};

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.nt-card { position: fixed; left: 50%; bottom: 7vh; transform: translateX(-50%); z-index: 9500; width: min(560px, calc(100vw - 32px));
  background: #fffaf0; color: #2b2118; border: 3px solid #7a5230; border-radius: 18px; padding: 16px 18px 14px;
  font: 17px/1.45 'Segoe UI', 'Trebuchet MS', system-ui, Arial, Helvetica, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
.nt-who { font-weight: 800; color: #b5361f; font-size: 14px; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
.nt-text { margin: 0 0 12px; }
.nt-choices { display: flex; flex-direction: column; gap: 8px; }
.nt-choices button { font: inherit; text-align: left; padding: 9px 12px; border-radius: 12px; border: 2px solid #d9c3a3; background: #fff; color: #2b2118; cursor: pointer; }
.nt-choices button:hover, .nt-choices button:focus-visible { border-color: #b5361f; outline: none; background: #fff3e6; }
.nt-choices button.is-wrong { border-color: #c44; background: #fde8e8; }
.nt-choices button.is-right { border-color: #2f9e44; background: #e6f6ea; }
.nt-choices button:disabled { cursor: default; }
`;
  document.head.appendChild(s);
}

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {{ x:number, z:number }} o.at          tree position
 * @param {(x:number,z:number)=>number} o.heightAt
 * @param {number} o.level                       1 or 4
 * @param {string} o.storeKey                    where "heard the story" is kept
 * @param {() => any} o.getAvatar
 * @param {(n:number) => void} o.reward          first time: +1 Science
 * @param {(m:string, kind?:string) => void} o.toast
 */
export function createNewtonTree({ scene, at, heightAt, level, storeKey, getAvatar, reward, toast }) {
  /** Level 4 wording, or the Level 1 one (short, for a 2nd grader). */
  const L = (l4, l1) => (level === 1 ? l1 : l4);
  injectCss();
  const { group, apples } = buildTree();
  const ground = heightAt(at.x, at.z);
  group.position.set(at.x, ground, at.z);
  scene.add(group);

  let heard = false;
  try { heard = localStorage.getItem(storeKey) === '1'; } catch { /* private mode */ }
  let busy = false;
  let fall = null; // { apple, v, y0, done, rest }
  let fallen = 0;
  let card = null;

  function blocks(x, z) {
    return Math.hypot(x - at.x, z - at.z) < TRUNK_R;
  }

  function label() {
    return heard ? 'Shake the apple tree (Newton’s story)' : 'Sit under the apple tree';
  }

  /** E under the tree: drop an apple next to her, then talk. */
  function start(player) {
    if (busy) return;
    busy = true;
    document.body.dataset.playModal = '1';
    const apple = apples[fallen % apples.length];
    fallen++;
    // Drop it between the tree and her, so she sees it land.
    const dx = player.x - at.x;
    const dz = player.z - at.z;
    const d = Math.hypot(dx, dz) || 1;
    const lx = (dx / d) * Math.min(1.1, d - 0.4);
    const lz = (dz / d) * Math.min(1.1, d - 0.4);
    apple.position.set(lx, 2.4, lz);
    apple.visible = true;
    fall = { apple, v: 0, bounced: false, t: 0 };
  }

  function update(dt) {
    if (!fall) return;
    const f = fall;
    f.t += dt;
    const floor = heightAt(group.position.x + f.apple.position.x, group.position.z + f.apple.position.z) - ground + 0.13;
    f.v -= G * dt;
    f.apple.position.y += f.v * dt;
    if (f.apple.position.y <= floor) {
      f.apple.position.y = floor;
      if (!f.bounced) { f.bounced = true; f.v = 1.4; toast('Plop! 🍎', 'info'); }
      else { f.v = 0; fall = null; getAvatar()?.play?.('wave'); setTimeout(talk, 500); }
    }
  }

  // --- the conversation ----------------------------------------------------

  function show({ who = 'Story', text, choices }) {
    if (!card) {
      card = document.createElement('div');
      card.className = 'nt-card';
      card.setAttribute('role', 'dialog');
      document.body.appendChild(card);
    }
    card.innerHTML = `<div class="nt-who"></div><p class="nt-text"></p><div class="nt-choices"></div>`;
    card.querySelector('.nt-who').textContent = who;
    card.querySelector('.nt-text').textContent = text;
    const box = card.querySelector('.nt-choices');
    const buttons = choices.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.addEventListener('click', () => c.go(b, buttons));
      box.appendChild(b);
      return b;
    });
    buttons[0]?.focus();
  }

  const next = (label, go) => ({ label, go: () => go() });

  function talk() {
    const name = heroName();
    const reply = (text) => show({ text, choices: [next('Then what?', story)] });
    show({
      who: 'Apple tree',
      text: `An apple just fell right next to you, ${name}! Why do you think it fell DOWN, and not up or sideways?`,
      choices: [
        next('Something pulled it down', () => reply(L('Great thinking! Something invisible pulled it. A very curious young man wondered the same thing...', 'Great thinking! Something you can’t see pulled it. A young man once asked the same thing...'))),
        next('It got tired of hanging', () => reply(L('Ha! Apples don’t get tired... but something DID pull it down. A very curious young man wondered about this too...', 'Ha! Apples don’t get tired... but something DID pull it down. A young man once asked about this too...'))),
        next('The wind blew it', () => reply(L('Wind can shake an apple loose, but wind blows sideways. So why did it go straight DOWN? A very curious young man wondered about this too...', 'Wind blows sideways. So why did it fall straight DOWN? A young man once asked about this too...'))),
      ],
    });
  }

  function story() {
    show({
      text: L('About 350 years ago, a young scientist named Isaac Newton sat in his garden in England. He watched an apple fall from a tree and asked: what pulls it towards the ground?', 'Long ago, a young scientist named Isaac Newton sat in his garden. He saw an apple fall. He asked: what pulls it down?'),
      choices: [next('What did he find out?', story2)],
    });
  }

  function story2() {
    show({
      text: 'Newton said the whole Earth pulls on everything. He called the pull GRAVITY. Then he looked up at the Moon and had a big idea... Do you think the Earth pulls on the Moon too?',
      choices: [
        next('Yes, it pulls the Moon too!', () => moon(true)),
        next('No, the Moon is too far away', () => moon(false)),
      ],
    });
  }

  function moon(yes) {
    show({
      text: `${yes ? 'Yes! That was Newton’s big idea.' : 'That is what most people thought! But Newton worked out that it does.'} Gravity reaches all the way to the Moon. The Moon is always falling towards Earth, but it zooms sideways so fast that it keeps missing! That is what an orbit is. (Remember that when you fly to Europa!)`,
      choices: [next('Ask me a gravity question!', quiz)],
    });
  }

  function quiz() {
    const qz = QUIZ[level] || QUIZ[4];
    let tries = 0;
    show({
      who: 'Newton’s question',
      text: qz.q,
      choices: qz.options.map((label, i) => ({
        label,
        go: (b, all) => {
          if (i === qz.answer) {
            all.forEach((x) => { x.disabled = true; });
            b.classList.add('is-right');
            setTimeout(() => finish(true, qz.why), 700);
            return;
          }
          tries++;
          b.classList.add('is-wrong');
          b.disabled = true;
          if (tries >= 2) {
            all.forEach((x) => { x.disabled = true; });
            all[qz.answer].classList.add('is-right');
            setTimeout(() => finish(false, qz.why), 900);
          } else {
            toast('Not quite. One more try!', 'warn');
          }
        },
      })),
    });
  }

  function finish(right, why) {
    const first = !heard;
    heard = true;
    try { localStorage.setItem(storeKey, '1'); } catch { /* private mode */ }
    if (first) reward(1);
    if (right) getAvatar()?.play?.('cheer');
    show({
      who: right ? 'Correct!' : 'Here is the answer',
      text: `${why}${first ? ' You earned +1 Science! 🔬' : ''} Gravity pulls YOU back down too.`,
      choices: [next('Thanks, Newton!', close)],
    });
  }

  function close() {
    card?.remove();
    card = null;
    busy = false;
    delete document.body.dataset.playModal;
  }

  return { at, blocks, label, start, update, isBusy: () => busy, heard: () => heard };
}
