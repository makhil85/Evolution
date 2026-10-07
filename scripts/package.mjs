// npm run package: build the game and make it double-click playable.
//   dist/                  the built game + PLAY.bat, play.command,
//                          play-server.mjs, HOW-TO-PLAY.txt
//   release/RocketVillage.zip   the same, zipped (written here, no outside
//                          tools, and read back to check every file)
// Give people the zip; they unzip it and double-click PLAY.bat.
import { copyFileSync, chmodSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const FILES = ['play-server.mjs', 'PLAY.bat', 'play.command', 'HOW-TO-PLAY.txt'];
for (const f of FILES) copyFileSync(new URL(`./play/${f}`, import.meta.url), new URL(`../dist/${f}`, import.meta.url));
try { chmodSync(new URL('../dist/play.command', import.meta.url), 0o755); } catch { /* Windows */ }
console.log('Launchers copied into dist/.');

mkdirSync(new URL('../release/', import.meta.url), { recursive: true });

// --- a small zip writer (no outside tools) -------------------------------------
// The first version used the computer's `tar`: on Windows that stored every
// file as "./name", and Windows Explorer then showed the zip as empty or
// broken. Writing the zip here gives plain "folder/file" names everywhere.

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel); else if (e.isFile()) out.push(rel);
    }
  };
  walk('');
  return out.sort();
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(root, names) {
  const parts = []; const central = []; let offset = 0;
  // A fixed date (1 Jan 2026) so the same build gives the same zip.
  const DOS_TIME = 0; const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const name of names) {
    const data = readFileSync(join(root, name));
    const packed = deflateRawSync(data, { level: 9 });
    const store = packed.length >= data.length; // already-compressed images: keep as is
    const body = store ? data : packed;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const mode = name.endsWith('.command') ? 0o100755 : 0o100644;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(store ? 0 : 8, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(0x0314, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(store ? 0 : 8, 10); cen.writeUInt16LE(DOS_TIME, 12); cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE((mode << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

/** Read the zip back: every entry unpacks and matches its CRC. */
function checkZip(path, expected) {
  const buf = readFileSync(path);
  const endAt = buf.length - 22;
  if (buf.readUInt32LE(endAt) !== 0x06054b50) throw new Error('zip: no end record');
  const count = buf.readUInt16LE(endAt + 10);
  if (count !== expected) throw new Error(`zip: ${count} entries, expected ${expected}`);
  let p = buf.readUInt32LE(endAt + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10); const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20); const nameLen = buf.readUInt16LE(p + 28); const at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name.startsWith('.') || name.startsWith('/') || name.includes('\\')) throw new Error(`zip: bad name ${name}`);
    const dataAt = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const body = buf.subarray(dataAt, dataAt + size);
    const data = method === 8 ? inflateRawSync(body) : body;
    if (crc32(data) !== crc) throw new Error(`zip: ${name} does not match`);
    p += 46 + nameLen;
  }
}

// Run it (after the helpers above are defined).
const zipPath = 'release/RocketVillage.zip';
const files = listFiles('dist');
writeFileSync(zipPath, makeZip('dist', files));
checkZip(zipPath, files.length);
console.log(`Made ${zipPath} (${(statSync(zipPath).size / 1048576).toFixed(1)} MB, ${files.length} files). Share that file.`);
