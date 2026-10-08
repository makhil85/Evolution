"""Import the sci-fi interior kits into public/assets/models/scifi/ (lead,
2026-10-08: real models for the Chapter 6 ship interior, like the villages').

  python3 scripts/import-scifi.py <MegaKit glTF dir> <Textures dir> <Kenney "GLTF format" dir>

Sources (both CC0): Quaternius "Modular SciFi MegaKit" (Standard, free) and
Kenney "Space Kit" 2.0. What it does, to keep the game small and fast:
- MegaKit: every piece but the aliens, glTF + bin as they are, each one's
  image paths pointed at ../textures/. Roughness/metal/occlusion maps (ORM)
  are dropped: the game's toon look doesn't use them. Unused images go too.
- Textures: only the ones a kept material uses, at 1024 px (from 2048); JPEG
  unless the image needs its alpha (then PNG).
- Kenney: the props in KENNEY_KEEP, GLB as they are (flat colours, tiny).
- manifest.json: every piece by set.
"""
import json
import os
import shutil
import sys

from PIL import Image

MEGA_SETS = ['Walls', 'Platforms', 'Columns', 'Props', 'Decals']
KENNEY_KEEP = [
    'desk_chair', 'desk_chairArms', 'desk_chairStool', 'desk_computer', 'desk_computerCorner', 'desk_computerScreen',
    'machine_barrel', 'machine_barrelLarge', 'machine_generator', 'machine_generatorLarge', 'machine_wireless', 'machine_wirelessCable',
    'pipe_corner', 'pipe_cornerRound', 'pipe_cross', 'pipe_end', 'pipe_split', 'pipe_straight', 'pipe_ring', 'pipe_supportHigh', 'pipe_supportLow',
    'barrel', 'barrels', 'satelliteDish', 'satelliteDish_detailed', 'structure_detailed', 'supports_low',
]
SIZE = 1024


def main(mega, texdir, kenney, out):
    os.makedirs(os.path.join(out, 'textures'), exist_ok=True)
    used = set()
    for s in MEGA_SETS:
        src = os.path.join(mega, s)
        dst = os.path.join(out, 'megakit', s.lower())
        os.makedirs(dst, exist_ok=True)
        for f in sorted(os.listdir(src)):
            if not f.endswith('.gltf'):
                continue
            g = json.load(open(os.path.join(src, f)))
            for m in g.get('materials', []):
                pbr = m.get('pbrMetallicRoughness', {})
                pbr.pop('metallicRoughnessTexture', None)
                m.pop('occlusionTexture', None)
            # Keep only the textures (and their images) a material still uses.
            refs = set()
            for m in g.get('materials', []):
                for k, v in list(m.get('pbrMetallicRoughness', {}).items()) + list(m.items()):
                    if isinstance(v, dict) and 'index' in v and k.endswith('Texture'):
                        refs.add(v['index'])
            tex_map = {}
            textures = []
            for i, t in enumerate(g.get('textures', [])):
                if i in refs:
                    tex_map[i] = len(textures)
                    textures.append(t)
            img_map = {}
            images = []
            for t in textures:
                i = t['source']
                if i not in img_map:
                    img_map[i] = len(images)
                    images.append(dict(g['images'][i]))
                t['source'] = img_map[i]
            for m in g.get('materials', []):
                for holder in (m.get('pbrMetallicRoughness', {}), m):
                    for k, v in holder.items():
                        if isinstance(v, dict) and 'index' in v and k.endswith('Texture'):
                            v['index'] = tex_map[v['index']]
            for im in images:
                name = os.path.splitext(im['uri'])[0]
                ext = texture(texdir, name, out)
                used.add(name)
                im['uri'] = f'../../textures/{name}.{ext}'
                im['mimeType'] = 'image/png' if ext == 'png' else 'image/jpeg'
            if textures:
                g['textures'] = textures
                g['images'] = images
            else:
                g.pop('textures', None)
                g.pop('images', None)
            bins = [b['uri'] for b in g.get('buffers', [])]
            if not all(os.path.exists(os.path.join(src, b)) for b in bins):
                print('skip (its .bin is missing from the pack):', f)
                continue
            json.dump(g, open(os.path.join(dst, f), 'w'), separators=(',', ':'))
            for b in bins:
                shutil.copy(os.path.join(src, b), os.path.join(dst, b))
    kdst = os.path.join(out, 'kenney')
    os.makedirs(kdst, exist_ok=True)
    for n in KENNEY_KEEP:
        shutil.copy(os.path.join(kenney, f'{n}.glb'), os.path.join(kdst, f'{n}.glb'))
    # A list of every piece, by set (the lab's contact sheet reads it).
    man = {s.lower(): sorted(f[:-5] for f in os.listdir(os.path.join(out, 'megakit', s.lower())) if f.endswith('.gltf')) for s in MEGA_SETS}
    man['kenney'] = sorted(KENNEY_KEEP)
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    print('textures used:', len(used), sorted(used))


done = {}


def texture(texdir, name, out):
    if name in done:
        return done[name]
    im = Image.open(os.path.join(texdir, f'{name}.png'))
    if im.width > SIZE:
        im = im.resize((SIZE, SIZE * im.height // im.width), Image.LANCZOS)
    alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
    if alpha:
        im.save(os.path.join(out, 'textures', f'{name}.png'), optimize=True)
        done[name] = 'png'
    else:
        im.convert('RGB').save(os.path.join(out, 'textures', f'{name}.jpg'), quality=88, optimize=True)
        done[name] = 'jpg'
    return done[name]


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'models', 'scifi')
    main(sys.argv[1], sys.argv[2], sys.argv[3], root)
