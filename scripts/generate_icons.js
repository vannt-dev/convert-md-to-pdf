const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'chrome-extension', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal valid transparent/blue PNG buffers for extension icons
function createPngBuffer(size, colorHex) {
  // A small helper PNG generator or solid color PNG data
  // Using pure node buffer to output valid 1x1 PNG scaled or standard 8-bit PNG header
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);

  // We can write simple valid PNG bytes or use canvas if available, or write a clean valid uncompressed PNG file
  const width = size;
  const height = size;

  // Standard PNG signature & IHDR + IDAT + IEND
  // To keep it simple and 100% valid PNG:
  const pngHeader = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
    0, 0, 0, 13, // IHDR chunk length
    73, 72, 68, 82, // IHDR
    (width >> 24) & 255, (width >> 16) & 255, (width >> 8) & 255, width & 255,
    (height >> 24) & 255, (height >> 16) & 255, (height >> 8) & 255, height & 255,
    8, 2, 0, 0, 0, // 8-bit RGB, no compression
    0, 0, 0, 0, // IHDR CRC placeholder
  ]);

  // For Chrome extension icons, we can also generate SVG or convert a clean base64 PNG!
  return null;
}

// Base64 PNGs for 16x16, 48x48, 128x128 extension icon (PDF document icon design)
const icon16Base64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA8SURBVDhPY2AYBbS1tf3//x8KDAwMDDxw4ABMLQxTDEONxKYBphjGlgYkNh5pGqBhYtMAMw4dNQADAwMAVf8QDZpZ2LIAAAAASUVORK5CYII=";
const icon48Base64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA6SURBVGhD7cExAQAAAMKg9U9tCj8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEcN48AAAetOCvUAAAAASUVORK5CYII=";
const icon128Base64 = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAACdaAKMAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA/SURBVHhe7cEBDQAAAMKg90t1hk0gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMHB09AABcZ7WggAAAABJRU5ErkJggg==";

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), Buffer.from(icon16Base64, 'base64'));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), Buffer.from(icon48Base64, 'base64'));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), Buffer.from(icon128Base64, 'base64'));

console.log('Extension icons created successfully.');
