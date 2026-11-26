/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { findBrowserExecutable } = require('./renderer');
const { KATEX_VERSION, MERMAID_VERSION, MARKMAP_VERSION, D3_VERSION } = require('../core/templates');

/**
 * Draws the Mermaid diagrams, mind maps and LaTeX formulas of a Word or EPUB export in the
 * headless browser the PDF is printed with: a page loads Mermaid, markmap-view and KaTeX (the
 * versions the PDF loads), draws everything with src/core/media.js, and the browser prints the
 * page with the results.
 */

const MEDIA_SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'core', 'media.js'), 'utf8');
const MARKMAP_SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'core', 'markmap.js'), 'utf8');
const RESULT = /<pre id="mdpdf-media"[^>]*>([A-Za-z0-9+/=\s]*)<\/pre>/;

/**
 * The page that draws the jobs and leaves the results, as base64 JSON, in `#mdpdf-media`.
 * @param {{ diagrams: string[], mindmaps?: Object[], formulas: Object[] }} jobs
 * @returns {string}
 */
function mediaPage(jobs) {
  const mindmaps = (jobs.mindmaps || []).length > 0;
  // Inside a script element: `<` written as an escape, so the JSON cannot close it.
  const data = JSON.stringify(jobs).replace(/</g, '\\u003c');
  const scripts = [
    jobs.diagrams.length ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js"></script>` : '',
    mindmaps ? `<script src="https://cdn.jsdelivr.net/npm/d3@${D3_VERSION}/dist/d3.min.js"></script>` : '',
    mindmaps ? `<script src="https://cdn.jsdelivr.net/npm/markmap-view@${MARKMAP_VERSION}/dist/browser/index.js"></script>` : '',
    mindmaps ? `<script>${MARKMAP_SCRIPT}</script>` : '',
    jobs.formulas.length ? `<script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js"></script>` : ''
  ].join('\n');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>md-pdf-studio media</title>
${scripts}
<script>${MEDIA_SCRIPT}</script>
</head><body>
<script>
(async function () {
  var jobs = ${data};
  var results;
  try {
    results = await MdPdfMedia.renderMedia(jobs, {
      mermaid: typeof mermaid !== 'undefined' ? mermaid : null,
      markmap: typeof markmap !== 'undefined' ? markmap : null,
      katex: typeof katex !== 'undefined' ? katex : null
    });
  } catch (err) {
    results = { error: String((err && err.message) || err) };
  }
  var bytes = new TextEncoder().encode(JSON.stringify(results));
  var binary = '';
  for (var at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000));
  var out = document.createElement('pre');
  out.id = 'mdpdf-media';
  out.textContent = btoa(binary);
  document.body.appendChild(out);
})();
</script>
</body></html>
`;
}

/**
 * Reads the results out of the page the browser printed.
 * @param {string} dom
 * @returns {Object}
 */
function readResults(dom) {
  const match = RESULT.exec(dom);
  if (!match) throw new Error('the browser did not finish drawing them');
  const results = JSON.parse(Buffer.from(match[1].replace(/\s+/g, ''), 'base64').toString('utf8'));
  if (results.error) throw new Error(results.error);
  return results;
}

function dumpDom(browserPath, fileUrl, legacyHeadless) {
  const args = [
    legacyHeadless ? '--headless' : '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    // Long enough for the libraries to load and every diagram to be drawn.
    '--virtual-time-budget=30000',
    '--dump-dom',
    fileUrl
  ];
  return new Promise((resolve, reject) => {
    execFile(browserPath, args, { timeout: 120000, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/**
 * Draws the diagrams, mind maps and formulas of a document.
 * @param {{ diagrams: string[], mindmaps?: Object[], formulas: { tex: string, display: boolean }[] }} jobs What
 *   docmodel's collectMedia found
 * @param {{ executablePath?: string }} [options] The browser to use, as for the PDF
 * @returns {Promise<{ diagrams: Object[], mindmaps: Object[], formulas: Object[] }>} what media.js renderMedia returns;
 *   a library that did not load (no network) leaves an error on each of its jobs
 * @throws when there is no browser, or it did not finish
 */
async function drawMedia(jobs, options = {}) {
  const browserPath = options.executablePath || findBrowserExecutable();
  if (!browserPath) throw new Error('no Chrome, Edge or Chromium was found (give one with --browser)');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'md-pdf-media-'));
  const pagePath = path.join(folder, 'media.html');
  try {
    fs.writeFileSync(pagePath, mediaPage(jobs), 'utf8');
    const fileUrl = pathToFileURL(pagePath).href;
    let dom;
    try {
      dom = await dumpDom(browserPath, fileUrl, false);
    } catch (_) {
      // A browser too old for --headless=new.
      dom = await dumpDom(browserPath, fileUrl, true);
    }
    return readResults(dom);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

module.exports = {
  drawMedia,
  mediaPage,
  readResults
};
