"""Import the sci-fi interior kit into public/assets/models/scifi/ (lead,
2026-10-08: real models for the Chapter 6 ship interior, like the villages').

  python3 scripts/import-scifi.py <MegaKit glTF dir> <Textures dir>

Source (CC0): Quaternius "Modular SciFi MegaKit" (Standard, free). What it does, to keep the game small and fast:
- Only the pieces the decks use: KEEP below, the one list. Every deck's MODELS array
  (src/space/ch6/interior/*.js) must be in KEEP; scripts/test-ch6-interior.mjs checks it
  against manifest.json. To use a new piece, add its name here and re-run. Every other
  piece is left out, and a re-import deletes the pieces (and textures) it no longer keeps.
- Each kept piece: glTF + bin as they are, each one's image paths pointed at ../textures/.
  Roughness/metal/occlusion maps (ORM) are dropped: the game's toon look doesn't use them.
- Textures: only the ones a kept material uses, at 1024 px (from 2048); JPEG
  unless the image needs its alpha (then PNG).
- Kenney "Space Kit" is no longer imported: no deck uses it (its pieces were removed;
  kenney/License.txt stays).
- manifest.json: the kept pieces, by set (the lab's contact sheet reads it).
- License.txt files are never touched.
"""
import json
import os
import shutil
import sys

from PIL import Image

# The one list of kept pieces ('set/Name', the Quaternius file names without .gltf).
# Derived from the decks' MODELS arrays on 2026-10-08 (32 pieces).
KEEP = [
    'walls/WallAstra_Straight', 'walls/WallAstra_Straight_Window', 'walls/WallBand_Straight', 'walls/WallWindow_Straight',
    'walls/TopPlastic_Straight', 'walls/BottomMetal_Straight',
    'columns/Column_Pipes', 'columns/Column_Round',
    'platforms/Platform_Metal', 'platforms/Platform_Metal2', 'platforms/Platform_Metal_Curve', 'platforms/Platform_Round1',
    'platforms/Platform_Squares', 'platforms/Door_Frame_Square',
    'props/Prop_AccessPoint', 'props/Prop_Barrel_Large', 'props/Prop_Cable_1', 'props/Prop_Chest', 'props/Prop_Computer',
    'props/Prop_Crate3', 'props/Prop_Crate4', 'props/Prop_ItemHolder', 'props/Prop_Light_Small', 'props/Prop_Light_Wide',
    'props/Prop_PipeHolder', 'props/Prop_Rail_4', 'props/Prop_Rail_Round_Big', 'props/Prop_Vent_Small', 'props/Prop_Vent_Wide',
    'decals/Decal_1', 'decals/Decal_Line_Straight', 'decals/Decal_Logo',
]
SETS = ['walls', 'platforms', 'columns', 'props', 'decals']
SIZE = 1024


def main(mega, texdir, out):
    os.makedirs(os.path.join(out, 'textures'), exist_ok=True)
    used = set()
    files = set()  # every kept .gltf and .bin, by file name
    for name in KEEP:
        s, piece = name.split('/')
        src = os.path.join(mega, s.capitalize())
        dst = os.path.join(out, 'megakit', s)
        os.makedirs(dst, exist_ok=True)
        f = piece + '.gltf'
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
            tname = os.path.splitext(im['uri'])[0]
            ext = texture(texdir, tname, out)
            used.add(tname)
            im['uri'] = f'../../textures/{tname}.{ext}'
            im['mimeType'] = 'image/png' if ext == 'png' else 'image/jpeg'
        if textures:
            g['textures'] = textures
            g['images'] = images
        else:
            g.pop('textures', None)
            g.pop('images', None)
        bins = [b['uri'] for b in g.get('buffers', [])]
        if not all(os.path.exists(os.path.join(src, b)) for b in bins):
            print('skip (its .bin is missing from the pack):', name)
            continue
        json.dump(g, open(os.path.join(dst, f), 'w'), separators=(',', ':'))
        for b in bins:
            shutil.copy(os.path.join(src, b), os.path.join(dst, b))
        files.update({f, *bins})
    prune(out, files, used)
    # A list of the kept pieces, by set (the lab's contact sheet reads it).
    man = {s: sorted(n.split('/')[1] for n in KEEP if n.startswith(s + '/')) for s in SETS}
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    print('pieces:', len(KEEP), 'textures used:', len(used), sorted(used))


def prune(out, files, used):
    """Delete what an older import left behind: pieces not in KEEP, the Kenney
    pieces, textures no kept piece uses. License.txt files stay."""
    for s in SETS:
        d = os.path.join(out, 'megakit', s)
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith(('.gltf', '.bin')) and f not in files:
                os.remove(os.path.join(d, f))
    kd = os.path.join(out, 'kenney')
    if os.path.isdir(kd):
        for f in os.listdir(kd):
            if f.endswith('.glb'):
                os.remove(os.path.join(kd, f))
    for f in os.listdir(os.path.join(out, 'textures')):
        if os.path.splitext(f)[0] not in used:
            os.remove(os.path.join(out, 'textures', f))


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
    main(sys.argv[1], sys.argv[2], root)
