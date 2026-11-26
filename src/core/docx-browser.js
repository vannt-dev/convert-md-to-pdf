/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const { docxEntries } = require('./docx');
const { buildDocument, collectMedia, mediaLookup } = require('./docmodel');
const { createZipAsync } = require('./zip');

/**
 * The Word export of the browser extension: the CLI's writer (docx.js), with
 * the browser's CompressionStream in place of zlib. scripts/bundle-docx.js
 * turns this file and the core modules it needs into extension/lib/docx-export.js,
 * which the preview page loads after marked as `MdPdfDocx`.
 */

/**
 * Raw DEFLATE with the browser's CompressionStream.
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function deflateRaw(bytes) {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  // Not awaited: the stream only takes more once its output is read below.
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const chunks = [];
  let length = 0;
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const output = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    output.set(chunk, at);
    at += chunk.length;
  }
  return output;
}

/**
 * The Mermaid diagrams, mind maps and formulas a document has, for the page to draw before the
 * export (extension/lib/media.js renderMedia), then hand over with mediaLookup as `options.media`.
 * @param {string} rawMarkdown
 * @param {Object} [options] The converter's options (`katex: false`, `mermaid: false` and
 *   `markmap: false` leave them out)
 * @returns {{ diagrams: string[], mindmaps: { text: string, tree: Object }[], formulas: { tex: string, display: boolean }[] }}
 */
function mediaJobs(rawMarkdown, options = {}) {
  return collectMedia(buildDocument(rawMarkdown, options).blocks);
}

/**
 * Converts Markdown to the bytes of a .docx file, in the browser.
 * @param {string} rawMarkdown
 * @param {Object} [options] The converter's options (pageSize, font, toc, cover, ...), plus
 *   `readImage(src)`: the picture an address names, as `{ data, extension, size }`, or null, and
 *   `media`: the drawn diagrams and formulas (mediaLookup)
 * @returns {Promise<Uint8Array>}
 */
function exportDocx(rawMarkdown, options = {}) {
  const readImage = options.readImage || (() => null);
  return createZipAsync(docxEntries(rawMarkdown, { ...options, readImage }), deflateRaw);
}

module.exports = {
  exportDocx,
  mediaJobs,
  mediaLookup
};
