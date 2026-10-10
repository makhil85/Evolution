// Floating name signs over Chapter 3's buildings: a rounded board with the
// building's name and icon, above the roof. They make the village readable at
// a glance - which dome is the Science Center - and they fade with distance,
// and when the camera is right on top of one, so they never crowd the screen.
//
// Lead 2026-10-09: Chapter 3 is the space-age town, so its signs are a white
// board with navy letters (Chapters 1 and 2 keep city/worldKit.js makeLabel's
// dark board). Same sprite, same fading, same sizes.
import * as THREE from 'three';
import { fitLabels } from './labelFit.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const INK = '#1d3557';

/** What each site is called on its sign (the recipes' labels carry "P1 -"). */
const NAMES = {
  missionSchool: ['Mission School', '🏫'],
  materialsForge: ['Materials Lab', '🧪'],
  waterLab: ['River Flow Lab', '💧'],
  windTunnel: ['Wind Tunnel', '🌬'],
  scienceCenter: ['Science Center', '🔬'],
  fuelDepot: ['Fuel Depot', '⛽'],
  guidanceTower: ['Guidance Tower', '📡'],
  observatory: ['Observatory', '🔭'],
};

/** A site's name as its sign spells it (for the navigation arrow's label). */
export function siteName(id) { return (NAMES[id] || [id])[0]; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A white sign board with navy letters, one sprite (the same shape and API as
 * worldKit's makeLabel, so the fading code below does not change).
 */
function makeSiteLabel(text, { icon = '', height = 0.72, accent = '#3f7fc4' } = {}) {
  const H = 88;
  const pad = 26;
  const fontPx = 44;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `700 ${fontPx}px ${FONT}`;
  const tw = Math.ceil(meas.measureText(text).width);
  const iconW = icon ? fontPx + 14 : 0;
  const W = tw + iconW + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  roundRect(ctx, 3, 3, W - 6, H - 6, 26);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  let x = pad;
  if (icon) {
    ctx.font = `${fontPx - 4}px ${EMOJI}`;
    ctx.fillStyle = INK;
    ctx.fillText(icon, x, H / 2 + 3);
    x += iconW;
  }
  ctx.font = `700 ${fontPx}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText(text, x, H / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(height * (W / H), height, 1);
  sprite.renderOrder = 30;
  sprite.userData.isLabel = true;
  return sprite;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ structures: Map<string, {group: THREE.Object3D}>, placements: {id:string,x:number,z:number}[],
 *   pad?: {x:number,z:number}, heightAt: (x:number, z:number) => number }} opts
 */
export function createNameSigns(scene, { structures, placements, pad = null, heightAt = () => 0 }) {
  const root = new THREE.Group();
  root.name = 'nameSigns';
  scene.add(root);
  const signs = [];
  const box = new THREE.Box3();

  for (const p of placements) {
    // Homes (homes.js) pass their own `label` ("No. 9") and `signY`.
    const [name, icon] = p.label ? [p.label, p.icon || ''] : (NAMES[p.id] || [p.id, '']);
    const s = structures.get(p.id);
    // The full height of the finished building (hidden pieces still count),
    // so the sign sits above the roof from the start: over an empty site it
    // marks where the building will rise.
    let top = 4;
    if (s?.group) {
      box.setFromObject(s.group);
      if (!box.isEmpty()) top = box.max.y - heightAt(p.x, p.z);
    }
    const sprite = makeSiteLabel(name, { icon, height: 0.72, accent: p.optional ? '#8e7ce6' : '#3f7fc4' });
    // On the building's face, three quarters up, rather than over the roof:
    // the chase camera looks down on her, so anything above the roofline
    // lands at the very top of the screen, behind the HUD's progress bar.
    sprite.position.set(p.x, heightAt(p.x, p.z) + (p.signY ?? Math.min(3.4, Math.max(2.2, top * 0.75))), p.z);
    sprite.userData.base = sprite.scale.clone();
    root.add(sprite);
    signs.push(sprite);
  }
  if (pad) {
    const sprite = makeSiteLabel('Launch Pad', { icon: '🚀', height: 0.8, accent: '#f2b84b' });
    sprite.position.set(pad.x, heightAt(pad.x, pad.z) + 1.2, pad.z);
    sprite.userData.base = sprite.scale.clone();
    root.add(sprite);
    signs.push(sprite);
  }

  return {
    root,
    /**
     * Fade with distance from her, and out when the camera is almost on one.
     * Then labelFit keeps the shown ones off the HUD and off each other.
     */
    update(playerPos, camPos, camera = null, goal = null) {
      for (const sprite of signs) {
        const d = Math.hypot(sprite.position.x - playerPos.x, sprite.position.z - playerPos.z);
        let a = THREE.MathUtils.clamp((62 - d) / 14, 0, 1);
        if (camPos) {
          const dc = sprite.position.distanceTo(camPos);
          // Close to the camera a sign would cover the HUD: fade it well before.
          a *= THREE.MathUtils.clamp((dc - 6) / 4, 0, 1);
        }
        // Buildings here stand 30-45 units apart, so a sign sized for up
        // close is unreadable across the square: grow it with distance
        // (up to 2.6x) so the name stays legible where it is useful.
        const k = THREE.MathUtils.clamp(d / 16, 1, 2.6);
        sprite.scale.set(sprite.userData.base.x * k, sprite.userData.base.y * k, 1);
        sprite.material.opacity = a;
        sprite.userData.want = a > 0.02;
      }
      fitLabels(signs, camera, goal);
    },
  };
}
