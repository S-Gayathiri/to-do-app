const fs = require('fs');
const zlib = require('zlib');

function createPng(size) {
  // Simple PNG generator with raw RGBA buffer
  const width = size;
  const height = size;
  
  // Create RGBA image buffer
  // Filter byte (0) + 4 bytes per pixel per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  
  const cx = width / 2;
  const cy = height / 2;
  const radius = size * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Default dark theme background (#0f172a)
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      // Squircle background
      const rx = Math.abs(dx) / (size * 0.46);
      const ry = Math.abs(dy) / (size * 0.46);
      const inSquircle = (Math.pow(rx, 4) + Math.pow(ry, 4)) <= 1.0;

      if (!inSquircle) {
        a = 0; // Transparent outside
      } else {
        // Inner matrix quadrants
        const qSize = size * 0.32;
        const gap = size * 0.04;
        
        // Q1 (Top-Left): Red
        if (x > cx - qSize - gap && x < cx - gap && y > cy - qSize - gap && y < cy - gap) {
          r = 239; g = 68; b = 68;
        }
        // Q2 (Top-Right): Indigo
        else if (x > cx + gap && x < cx + qSize + gap && y > cy - qSize - gap && y < cy - gap) {
          r = 99; g = 102; b = 241;
        }
        // Q3 (Bottom-Left): Amber
        else if (x > cx - qSize - gap && x < cx - gap && y > cy + gap && y < cy + qSize + gap) {
          r = 245; g = 158; b = 11;
        }
        // Q4 (Bottom-Right): Emerald
        else if (x > cx + gap && x < cx + qSize + gap && y > cy + gap && y < cy + qSize + gap) {
          r = 16; g = 185; b = 129;
        }

        // Center check circle
        if (dist < size * 0.14) {
          r = 15; g = 23; b = 42;
        }
        if (dist < size * 0.14 && dist > size * 0.11) {
          r = 99; g = 102; b = 241; // Accent ring
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // Build PNG chunks
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // Table for CRC32
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate icon-192.png and icon-512.png
fs.writeFileSync('icon-192.png', createPng(192));
fs.writeFileSync('icon-512.png', createPng(512));
console.log('Generated icon-192.png and icon-512.png successfully!');
