const fs = require('fs');
const path = require('path');

/**
 * Local images for the exporters that embed them (DOCX, EPUB).
 */

const MEDIA_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp'
};

/**
 * Width and height in pixels of a PNG, JPEG or GIF, read from its header.
 * @param {Buffer} data
 * @returns {{ width: number, height: number } | null} null for anything else
 */
function imageSize(data) {
  if (data.length >= 24 && data.readUInt32BE(0) === 0x89504e47 && data.toString('ascii', 12, 16) === 'IHDR') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length >= 10 && data.toString('ascii', 0, 3) === 'GIF') {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1];
      // Start-of-frame markers carry the size; C4, C8 and CC are other tables.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
      }
      offset += 2 + data.readUInt16BE(offset + 2);
    }
  }
  return null;
}

/**
 * Reads the image a Markdown document refers to.
 * @param {string} src As written in the document
 * @param {string} baseDir Folder of the document
 * @returns {{ data: Buffer, extension: string, mediaType: string, size: { width: number, height: number } | null } | null}
 *   null when it is not a readable local file of a known type (a web address, for one)
 */
function readLocalImage(src, baseDir) {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) && !/^file:/i.test(src) && !/^[a-zA-Z]:[\\/]/.test(src)) return null;
  let relative = src.replace(/^file:\/\/\/?/i, '').split(/[?#]/)[0];
  try {
    relative = decodeURIComponent(relative);
  } catch (_) {
    // A stray percent sign: the name is used as written.
  }
  const filePath = path.resolve(baseDir || process.cwd(), relative);
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (!MEDIA_TYPES[extension] || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const data = fs.readFileSync(filePath);
  return { data, extension: extension === 'jpeg' ? 'jpg' : extension, mediaType: MEDIA_TYPES[extension], size: imageSize(data) };
}

module.exports = {
  imageSize,
  readLocalImage
};
