/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const zlib = require('zlib');

/**
 * A ZIP archive writer, enough for the two container formats built on ZIP
 * that this tool exports: DOCX and EPUB.
 *
 * Entries are written in the order given, which EPUB relies on: its
 * `mimetype` entry has to come first and uncompressed. Timestamps are fixed,
 * so the same input gives the same bytes.
 *
 * The archive is put together from plain byte arrays, so the browser
 * extension runs this same code (scripts/bundle-docx.js); only the deflate
 * step differs: zlib here, the browser's CompressionStream there.
 */

// 1980-01-01 00:00:00, the earliest date the format can express.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

/**
 * The CRC-32 checksum ZIP stores for each entry.
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(data) {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data;
}

/**
 * @param {{ name: string, data: Uint8Array | string, store?: boolean }[]} entries
 * @param {Uint8Array[]} contents What is stored for each entry: its data, or the deflated data
 * @returns {Uint8Array}
 */
function assemble(entries, contents) {
  const parts = [];
  const central = [];
  let offset = 0;

  entries.forEach((entry, index) => {
    const name = new TextEncoder().encode(entry.name);
    const data = toBytes(entry.data);
    const stored = contents[index];
    const method = entry.store ? 0 : 8;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, stored.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true); // version made by
    header.setUint16(6, 20, true); // version needed
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, method, true);
    header.setUint16(12, DOS_TIME, true);
    header.setUint16(14, DOS_DATE, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, stored.length, true);
    header.setUint32(24, data.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);

    parts.push(new Uint8Array(local.buffer), name, stored);
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.length + stored.length;
  });

  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  parts.push(...central, new Uint8Array(end.buffer));

  const archive = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const part of parts) {
    archive.set(part, at);
    at += part.length;
  }
  return archive;
}

/**
 * @param {{ name: string, data: Buffer | Uint8Array | string, store?: boolean }[]} entries
 * @returns {Buffer}
 */
function createZip(entries) {
  const contents = entries.map(entry => (entry.store ? toBytes(entry.data) : zlib.deflateRawSync(toBytes(entry.data), { level: 9 })));
  const archive = assemble(entries, contents);
  return Buffer.from(archive.buffer, archive.byteOffset, archive.length);
}

/**
 * The same archive, for a deflate step that is asynchronous (the browser's).
 * @param {{ name: string, data: Uint8Array | string, store?: boolean }[]} entries
 * @param {(bytes: Uint8Array) => Promise<Uint8Array>} deflateRaw Raw DEFLATE, without a zlib header
 * @returns {Promise<Uint8Array>}
 */
async function createZipAsync(entries, deflateRaw) {
  const contents = [];
  for (const entry of entries) {
    const data = toBytes(entry.data);
    contents.push(entry.store ? data : new Uint8Array(await deflateRaw(data)));
  }
  return assemble(entries, contents);
}

module.exports = {
  crc32,
  createZip,
  createZipAsync
};
