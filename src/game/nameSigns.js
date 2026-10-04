// Floating name signs over Chapter 3's buildings, in the same style as
// Chapters 1 and 2 (city/worldKit.js makeLabel): a dark rounded board with
// the building's name and icon, above the roof. They make the village
// readable at a glance - which dome is the Science Center - and they fade
// with distance, and when the camera is right on top of one, so they never
// crowd the screen.
import * as THREE from 'three';
import { makeLabel } from '../city/worldKit.js';

/** What each site is called on its sign (the recipes' labels carry "P1 -"). */
const NAMES = {
  missionSchool: ['Mission School', '🏫'],
  materialsForge: ['Materials Forge', '🔨'],
  waterLab: ['River Flow Lab', '💧'],
  windTunnel: ['Wind Tunnel', '🌬'],
  scienceCenter: ['Science Center', '🔬'],
  fuelDepot: ['Fuel Depot', '⛽'],
  guidanceTower: ['Guidance Tower', '📡'],
  observatory: ['Observatory', '🔭'],
};

/** A site's name as its sign spells it (for the navigation arrow's label). */
export function siteName(id) { return (NAMES[id] || [id])[0]; }

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
    const sprite = makeLabel(name, { icon, height: 0.72, accent: p.optional ? '#b197fc' : '#ffd43b' });
    // On the building's face, three quarters up, rather than over the roof:
    // the chase camera looks down on her, so anything above the roofline
    // lands at the very top of the screen, behind the HUD's progress bar.
    sprite.position.set(p.x, heightAt(p.x, p.z) + (p.signY ?? Math.min(3.4, Math.max(2.2, top * 0.75))), p.z);
    sprite.userData.base = sprite.scale.clone();
    root.add(sprite);
    signs.push(sprite);
  }
  if (pad) {
    const sprite = makeLabel('Launch Pad', { icon: '🚀', height: 0.8 });
    sprite.position.set(pad.x, heightAt(pad.x, pad.z) + 1.2, pad.z);
    sprite.userData.base = sprite.scale.clone();
    root.add(sprite);
    signs.push(sprite);
  }

  return {
    root,
    /** Fade with distance from her, and out when the camera is almost on one. */
    update(playerPos, camPos) {
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
        sprite.visible = a > 0.02;
      }
    },
  };
}
