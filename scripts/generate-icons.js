import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Minimal pure-JS PNG generator for generating extension icon sizes.
 */
function createPng(width, height, colorFn) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + (x * 4);
      const [r, g, b, a] = colorFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(len + 12);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // CRC32
    let c = 0xffffffff;
    for (let i = 4; i < len + 8; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    buf.writeUInt32BE((c ^ 0xffffffff) >>> 0, len + 8);
    return buf;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function mudpieIconColor(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.44;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Anti-aliased outer rounded rectangle or circle
  const margin = w * 0.08;
  const inBox = x >= margin && x < w - margin && y >= margin && y < h - margin;
  
  if (dist > radius + 1) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Mastodon Purple gradient (#6364ff -> #563acc)
  const gradT = (x + y) / (w + h);
  let r = Math.round(99 * (1 - gradT) + 86 * gradT);
  let g = Math.round(100 * (1 - gradT) + 58 * gradT);
  let b = Math.round(255 * (1 - gradT) + 204 * gradT);
  let a = 255;

  if (dist > radius - 1) {
    a = Math.max(0, Math.min(255, Math.round((radius + 1 - dist) * 128)));
  }

  // Draw Hashtag '#' pattern in white
  const normX = x / w;
  const normY = y / h;

  // Vertical slanted bars
  const v1 = (normX >= 0.34 && normX <= 0.44 && normY >= 0.25 && normY <= 0.75);
  const v2 = (normX >= 0.56 && normX <= 0.66 && normY >= 0.25 && normY <= 0.75);
  // Horizontal bars
  const h1 = (normY >= 0.36 && normY <= 0.45 && normX >= 0.24 && normX <= 0.76);
  const h2 = (normY >= 0.55 && normY <= 0.64 && normX >= 0.24 && normX <= 0.76);

  if (v1 || v2 || h1 || h2) {
    return [255, 255, 255, a];
  }

  // URL discussion dot / pie badge in top right
  const badgeCx = w * 0.75;
  const badgeCy = h * 0.25;
  const badgeDist = Math.sqrt((x - badgeCx) * (x - badgeCx) + (y - badgeCy) * (y - badgeCy));
  const badgeRadius = w * 0.14;

  if (badgeDist <= badgeRadius) {
    if (badgeDist <= badgeRadius * 0.45) {
      return [255, 255, 255, 255];
    }
    // Orange #ff9900
    return [255, 153, 0, 255];
  }

  return [r, g, b, a];
}

const targetDirs = [
  path.join(process.cwd(), 'packages/extensions/shared/icons')
];

for (const dir of targetDirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const size of [16, 32, 48, 96, 128]) {
    const png = createPng(size, size, mudpieIconColor);
    const filePath = path.join(dir, `icon-${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Generated ${filePath}`);
  }
}
