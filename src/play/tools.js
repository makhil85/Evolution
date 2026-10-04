// Mining with the right tool, and the haul flying into the Supplies panel.
//
// Every press of E on a resource puts the matching tool in her right hand and
// swings it at the resource: an axe for wood, a pickaxe for stone and gems, a
// hammer for iron and metal, a wrench for energy, fuel and circuits, and a
// magnifying glass for science. When the resource is collected, a short chain
// of its icon flies from where it was, in an arc, into its cell of the
// Supplies panel on the right, and the cell pulses as each one lands.
//
// Shared by Chapters 1-3 (the HUD's resource cells come from src/game/hud.js).
// The tools are plain toon primitives parented to her `handR` bone, so they
// follow every frame of the swing without any extra work.
import * as THREE from 'three';
import { toonRamp } from '../game/toonPipeline.js';
import { prefersReducedMotion } from './ui.js';

export const TOOL_FOR = {
  wood: 'axe',
  stone: 'pickaxe', gems: 'pickaxe',
  iron: 'hammer', metal: 'hammer',
  energy: 'wrench', fuel: 'wrench', circuits: 'wrench',
  science: 'magnifier',
};

const SHOW_FOR = 1.3; // seconds the tool stays in her hand after a swing

const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });
const WOOD = mat(0x8a5a32);
const STEEL = mat(0xb9c2cc);
const DARK = mat(0x59626e);
const BRASS = mat(0xd9a93a);
const GLASS = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45 });

/**
 * One tool, 1 unit long, grip at the origin, handle along +Z (the way a fist
 * holds a handle when her arm hangs: pointing forward).
 */
function buildTool(kind) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const handle = (len, r = 0.035, m = WOOD) => add(new THREE.CylinderGeometry(r, r, len, 8), m, 0, 0, len / 2 - 0.15, Math.PI / 2);
  if (kind === 'axe') {
    handle(0.9);
    add(new THREE.BoxGeometry(0.06, 0.22, 0.16), STEEL, 0, -0.08, 0.68);        // blade, pointing down
    add(new THREE.BoxGeometry(0.07, 0.07, 0.1), DARK, 0, 0.04, 0.68);           // back of the head
  } else if (kind === 'pickaxe') {
    handle(0.9);
    add(new THREE.ConeGeometry(0.035, 0.26, 6), STEEL, 0, -0.13, 0.7, Math.PI); // spike down
    add(new THREE.ConeGeometry(0.035, 0.2, 6), STEEL, 0, 0.1, 0.7);              // spike up
    add(new THREE.BoxGeometry(0.07, 0.08, 0.08), DARK, 0, 0, 0.7);
  } else if (kind === 'hammer') {
    handle(0.8);
    add(new THREE.BoxGeometry(0.11, 0.3, 0.13), DARK, 0, 0, 0.62);               // big head
    add(new THREE.BoxGeometry(0.12, 0.05, 0.14), STEEL, 0, -0.15, 0.62);         // striking face
  } else if (kind === 'wrench') {
    handle(0.55, 0.03, STEEL);
    const jaw = add(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI * 1.4), STEEL, 0, 0, 0.47, 0, Math.PI / 2, -Math.PI * 0.2);
    jaw.castShadow = false;
  } else if (kind === 'magnifier') {
    handle(0.35, 0.03, WOOD);
    add(new THREE.TorusGeometry(0.11, 0.022, 8, 20), BRASS, 0, 0, 0.32, 0, Math.PI / 2, 0);
    add(new THREE.CircleGeometry(0.1, 20), GLASS, 0, 0, 0.32, 0, Math.PI / 2, 0).castShadow = false;
  }
  return g;
}

/**
 * @param {object} o
 * @param {() => any} o.getAvatar          the loaded avatar ({ group, play })
 * @param {() => THREE.Object3D} o.getPlayer  the object the controller turns
 * @param {number} [o.height]              her height in world units
 */
export function createToolHands({ getAvatar, getPlayer, height = 1.4 }) {
  const cache = new Map();
  let shown = null;
  let timer = 0;
  const ws = new THREE.Vector3();

  function hand() {
    return getAvatar()?.group?.getObjectByName('handR') || null;
  }

  /** One press of E on resource `res` at world point `at`. */
  function swing(res, at) {
    const kind = TOOL_FOR[String(res || '').toLowerCase()];
    const player = getPlayer();
    // Face what she is working on (the controller only turns her while moving).
    if (player && at) player.rotation.y = Math.atan2(at.x - player.position.x, at.z - player.position.z);
    const h = hand();
    if (!kind || !h) return; // blueprints and the like: just picked up, no tool
    let tool = cache.get(kind);
    if (!tool) { tool = buildTool(kind); cache.set(kind, tool); }
    if (tool.parent !== h) {
      // Size it in WORLD units whatever the bone's scale is.
      h.getWorldScale(ws);
      tool.scale.setScalar((height * 0.42) / (ws.x || 1));
      // Tilted in the grip so the head comes DOWN on the strike (measured on
      // the rig: untilted, the blade pointed up at the end of the chop). The
      // magnifier stays upright, lens in front of her face.
      tool.rotation.x = kind === 'magnifier' ? -0.3 : 1.05;
      h.add(tool);
    }
    if (shown && shown !== tool) shown.removeFromParent();
    shown = tool;
    tool.visible = true;
    timer = SHOW_FOR;
    getAvatar()?.play?.(kind === 'magnifier' ? 'inspect' : 'chop', { interruptible: true });
  }

  function update(dt) {
    if (!shown) return;
    timer -= dt;
    if (timer <= 0) { shown.removeFromParent(); shown = null; }
  }

  return { swing, update };
}

/**
 * Fly a chain of `icon`s from a world point into a Supplies cell.
 *
 * @param {object} o
 * @param {THREE.Camera} o.camera
 * @param {HTMLCanvasElement} o.canvas     the renderer's canvas
 * @param {{x:number,y:number,z:number}} o.from
 * @param {{ el: HTMLElement, icon: string } | null} o.cell  hud.resourceCell(key)
 * @param {number} [o.amount]
 */
export function flyToSupplies({ camera, canvas, from, cell, amount = 3 }) {
  if (!cell || !cell.el || prefersReducedMotion() || typeof document === 'undefined') return;
  const to = cell.el.getBoundingClientRect();
  if (to.width < 2 || to.height < 2) return; // panel hidden or collapsed
  const v = new THREE.Vector3(from.x, from.y, from.z).project(camera);
  if (v.z > 1) return; // behind the camera
  const box = canvas.getBoundingClientRect();
  const x0 = box.left + ((v.x + 1) / 2) * box.width;
  const y0 = box.top + ((1 - v.y) / 2) * box.height;
  const x1 = to.left + 18;
  const y1 = to.top + to.height / 2;
  // Arc up and over: the control point sits above the higher end.
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - 120;
  const n = Math.max(3, Math.min(6, Math.round(amount) || 3));
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const s = 1.35 - 0.6 * t;
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, opacity: t < 0.92 ? 1 : 0.6 });
  }
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = cell.icon;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:fixed;left:0;top:0;z-index:9400;pointer-events:none;font-size:26px;'
      + 'filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));will-change:transform;opacity:0';
    document.body.appendChild(s);
    const a = s.animate(frames, { duration: 760, delay: i * 110, easing: 'cubic-bezier(.45,0,.85,.6)', fill: 'both' });
    a.onfinish = () => {
      s.remove();
      cell.el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', filter: 'brightness(1.35)' }, { transform: 'scale(1)' }],
        { duration: 220, easing: 'ease-out' },
      );
    };
  }
}
