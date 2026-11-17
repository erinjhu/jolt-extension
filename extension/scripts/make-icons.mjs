/**
 * Generates the extension's PNG icons at the sizes Chrome expects (16/48/128),
 * writing them to `public/icons/`. Each icon is the Jolt brand mark: 8 slanted
 * horizontal purple bars forming a lightning "Z" on a 100×100 grid, leaning
 * forward via a uniform skewX(-12), on a transparent background. Pure Node, no
 * deps — we hand-roll a minimal RGBA PNG encoder and rasterize the same
 * geometry used by the SVG favicon and the JoltLogoIcon component.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const PURPLE = [79, 70, 229, 255]; // #4F46E5 — Jolt brand purple
const TRANSPARENT = [0, 0, 0, 0];

// Mark geometry on a 100×100 grid, matching public/favicon.svg.
const GRID = 100;
const BAR_HEIGHT = 7;
// skewX(-12deg): a point (x, y) renders at (x + SKEW * y, y).
const SKEW = Math.tan((12 * Math.PI) / 180);

// [x1, x2, y] per bar, top to bottom (width is x2 - x1).
const BARS = [
  [73, 83, 8],
  [58, 76, 20],
  [40, 67, 32],
  [25, 60, 44],
  [47, 82, 56],
  [40, 67, 68],
  [31, 49, 80],
  [24, 34, 92],
];

/**
 * Returns true when grid point (gx, gy) falls inside the given bar after the
 * shared skewX(-12) shear. We un-skew the x coordinate, then test the upright
 * rectangle.
 */
function inBar(gx, gy, [x1, x2, y]) {
  if (gy < y || gy > y + BAR_HEIGHT) return false;
  const designX = gx - SKEW * gy;
  return designX >= x1 && designX <= x2;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Samples each output pixel with a small supersampling grid for smoother edges,
 * blending the purple fill against transparency by coverage.
 */
function makePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const SS = 3; // samples per axis
  for (let py = 0; py < size; py += 1) {
    raw[py * (size * 4 + 1)] = 0; // filter byte: none
    for (let px = 0; px < size; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const gx = ((px + (sx + 0.5) / SS) / size) * GRID;
          const gy = ((py + (sy + 0.5) / SS) / size) * GRID;
          if (BARS.some((bar) => inBar(gx, gy, bar))) hits += 1;
        }
      }
      const coverage = hits / (SS * SS);
      const color = coverage > 0 ? PURPLE : TRANSPARENT;
      const off = py * (size * 4 + 1) + 1 + px * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = Math.round(coverage * 255);
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), makePng(size));
  console.log(`wrote icon${size}.png`);
}
