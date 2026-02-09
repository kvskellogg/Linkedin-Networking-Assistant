// Setup script to generate extension icons
// Run with: node setup.js

const fs = require('fs');
const path = require('path');

// Minimal PNG data for placeholder icons (1x1 blue pixel, will be stretched)
// These are valid PNG files - replace with proper icons later

const createSimplePNG = (size) => {
  // PNG header and IHDR chunk for a simple image
  const width = size;
  const height = size;

  // Create a simple blue square PNG
  // This is a minimal valid PNG structure

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.alloc(12 + 13);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdrData.copy(ihdr, 8);
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk (image data)
  // Create raw image data (LinkedIn blue color: #0077b5)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Calculate if we're in the circle
      const cx = width / 2;
      const cy = height / 2;
      const r = width / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= r) {
        rawData.push(0x00, 0x77, 0xb5); // LinkedIn blue
      } else {
        rawData.push(0xff, 0xff, 0xff); // White background
      }
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write('IEND', 4);
  iend.writeUInt32BE(iendCrc, 8);

  return Buffer.concat([signature, ihdr, idat, iend]);
};

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  const table = makeCRCTable();

  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');

console.log('Generating extension icons...');

try {
  [16, 48, 128].forEach(size => {
    const png = createSimplePNG(size);
    const filename = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filename, png);
    console.log(`Created: icon${size}.png`);
  });

  console.log('\nIcons generated successfully!');
  console.log('You can now load the extension in Chrome.');
} catch (error) {
  console.error('Error generating icons:', error.message);
  console.log('\nAlternative: Open generate-icons.html in a browser to create icons manually.');
}
