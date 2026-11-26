/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Draws the diagrams and formulas of a document for the Word and EPUB writers, in a browser
 * page that has Mermaid and KaTeX loaded: each Mermaid diagram becomes a PNG picture, each
 * formula KaTeX's MathML (which the writers turn into Word equations or keep as MathML).
 * Mind maps (```markmap) become PNG pictures too, drawn by markmap.js (MdPdfMarkmap) with
 * markmap-view, always in light colours.
 *
 * Runs in the page only: the CLI inlines it in the page its headless browser opens, and the
 * extension ships it as extension/lib/media.js (a test keeps the two copies identical).
 */
(function (scope) {
  // Light and plain whatever the preview theme: the picture sits on a white page.
  const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'base',
    look: 'classic',
    securityLevel: 'strict',
    // A font every system has: the picture is drawn without the page's web fonts.
    fontFamily: 'Arial, Helvetica, sans-serif'
  };
  // Twice the drawn size, for print, but never wider or taller than this many pixels.
  const SCALE = 2;
  const MAX_PIXELS = 4096;

  /**
   * An SVG drawn onto a white canvas, as PNG bytes.
   * @returns {Promise<{ png: string, width: number, height: number }>} base64 PNG, and the size
   *   in CSS pixels the picture is meant to be shown at
   */
  async function rasterize(svgText, doc) {
    const holder = doc.createElement('div');
    holder.innerHTML = svgText;
    const svg = holder.querySelector('svg');
    if (!svg) throw new Error('no SVG was drawn');
    const box = svg.viewBox && svg.viewBox.baseVal;
    const width = box && box.width ? box.width : parseFloat(svg.getAttribute('width')) || 600;
    const height = box && box.height ? box.height : parseFloat(svg.getAttribute('height')) || 400;
    // Drawn as a picture at its own size, not stretched to the page.
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.maxWidth = '';
    const source = new XMLSerializer().serializeToString(svg);

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    await img.decode();
    const scale = Math.min(SCALE, MAX_PIXELS / width, MAX_PIXELS / height);
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Written at once: the headless browser's clock (--virtual-time-budget) does not wait for an
    // asynchronous toBlob, and could run out with the picture still being encoded.
    const url = canvas.toDataURL('image/png');
    const comma = url.indexOf(',');
    if (!url.startsWith('data:image/png') || comma < 0) throw new Error('the picture could not be written');
    return { png: url.slice(comma + 1), width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Draws what a document needs.
   * @param {{ diagrams: string[], mindmaps?: { tree: Object }[], formulas: { tex: string, display: boolean }[] }} jobs
   *   What docmodel's collectMedia found
   * @param {{ mermaid?: object, markmap?: object, katex?: object, document?: Document }} libraries
   *   Without Mermaid, markmap-view or KaTeX that part is left undrawn
   * @returns {Promise<{ diagrams: ({ png: string, width: number, height: number } | { error: string })[],
   *   mindmaps: (the same)[], formulas: ({ mathml: string } | { error: string })[] }>} in the order
   *   of the jobs
   */
  async function renderMedia(jobs, libraries) {
    const doc = libraries.document || scope.document;
    const { mermaid, markmap, katex } = libraries;
    const diagrams = [];
    if (jobs.diagrams.length) {
      if (mermaid) mermaid.initialize(MERMAID_CONFIG);
      for (let index = 0; index < jobs.diagrams.length; index++) {
        if (!mermaid) { diagrams.push({ error: 'Mermaid is not loaded' }); continue; }
        try {
          const { svg } = await mermaid.render(`mdpdf-export-diagram-${index + 1}`, jobs.diagrams[index]);
          diagrams.push(await rasterize(svg, doc));
        } catch (err) {
          diagrams.push({ error: String((err && err.message) || err).split('\n')[0] });
        }
      }
    }
    const mindmaps = [];
    for (const job of jobs.mindmaps || []) {
      if (!markmap || !scope.MdPdfMarkmap) { mindmaps.push({ error: 'Markmap is not loaded' }); continue; }
      try {
        const svg = await scope.MdPdfMarkmap.drawMarkmap(job.tree, { markmap, document: doc });
        mindmaps.push(await rasterize(svg, doc));
      } catch (err) {
        mindmaps.push({ error: String((err && err.message) || err).split('\n')[0] });
      }
    }
    const formulas = jobs.formulas.map((formula) => {
      if (!katex) return { error: 'KaTeX is not loaded' };
      try {
        return { mathml: katex.renderToString(formula.tex, { output: 'mathml', displayMode: formula.display, throwOnError: true }) };
      } catch (err) {
        return { error: String((err && err.message) || err) };
      }
    });
    return { diagrams, mindmaps, formulas };
  }

  const api = { renderMedia };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
