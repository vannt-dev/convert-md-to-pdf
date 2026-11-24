/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const path = require('path');
const { parseMarkdownToHtml } = require('./parser');
const { renderHtmlToPdf } = require('../browser/renderer');
const { drawMedia } = require('../browser/media');
const { resolvePath, parseFrontMatter } = require('./utils');
const { expandIncludes } = require('./include');
const { markdownToDocx } = require('./docx');
const { markdownToEpub } = require('./epub');
const { buildDocument, collectHeadings, collectMedia, mediaLookup } = require('./docmodel');
const { BrokenReferencesError, findBrokenReferences, htmlIds } = require('./references');

const FORMATS = ['pdf', 'html', 'docx', 'epub'];

/**
 * Where the page the browser prints is written: beside the Markdown file, so
 * that its relative pictures and links resolve as they do in the source, also
 * when the PDF goes to another folder. Falls back to the PDF's folder when the
 * source's folder cannot be written to.
 * @param {string} absInputPath
 * @param {string} absOutputPath
 * @returns {string}
 */
function temporaryHtmlPath(absInputPath, absOutputPath) {
  const name = `_temp_${Date.now()}_${Math.random().toString(36).substring(7)}.html`;
  const sourceDir = path.dirname(absInputPath);
  try {
    fs.accessSync(sourceDir, fs.constants.W_OK);
    return path.join(sourceDir, name);
  } catch (_) {
    return path.join(path.dirname(absOutputPath), name);
  }
}

/**
 * Draws the Mermaid diagrams and formulas of a Word or EPUB export in the headless browser.
 * What cannot be drawn stays as its source, and is named in the warnings.
 * @param {Object} document What buildDocument returned
 * @param {Object} options The converter's options (`executablePath`)
 * @returns {Promise<{ media: Object | null, warnings: string[] }>}
 */
async function drawDocumentMedia(document, options) {
  const jobs = collectMedia(document.blocks);
  if (!jobs.diagrams.length && !jobs.formulas.length) return { media: null, warnings: [] };
  let results;
  try {
    results = await drawMedia(jobs, { executablePath: options.executablePath });
  } catch (error) {
    return { media: null, warnings: [`Mermaid diagrams and formulas are kept as their source: ${error.message}`] };
  }
  const warnings = [];
  const unloaded = new Set();
  const note = (drawn, describe) => {
    if (!drawn || !drawn.error) return;
    if (/ is not loaded$/.test(drawn.error)) unloaded.add(drawn.error.replace(/ is not loaded$/, ''));
    else warnings.push(describe(drawn.error));
  };
  results.diagrams.forEach((drawn, index) => note(drawn, error => `Mermaid diagram ${index + 1} is kept as its source: ${error}`));
  results.formulas.forEach((drawn, index) => {
    const { tex } = jobs.formulas[index];
    const shown = tex.length > 40 ? `${tex.slice(0, 40)}…` : tex;
    note(drawn, error => `Formula "${shown}" is kept as typed: ${error}`);
  });
  for (const library of unloaded) {
    warnings.unshift(`${library} could not be loaded from cdn.jsdelivr.net: what it draws is kept as its source`);
  }
  return { media: mediaLookup(jobs, results), warnings };
}

/**
 * Whether the PDF gets bookmarks from its headings: on unless `outline: false` is passed
 * or set in the front matter (an option wins over the front matter).
 * @param {string} markdown
 * @param {Object} options
 * @returns {boolean}
 */
function pdfOutline(markdown, options = {}) {
  if (options.outline !== undefined) return options.outline !== false;
  return parseFrontMatter(markdown).data.outline !== false;
}

/**
 * Main function to convert a Markdown file: to PDF by default, or to the
 * format named in `options.format` (`html`, `docx`, `epub`)
 * @param {string} inputPath Path to source .md file
 * @param {string} [outputPath] Path to the target file
 * @param {Object} [options] Conversion options. `options.markdown` gives the Markdown itself
 *   (e.g. read from stdin); `inputPath` then need not exist and only places relative paths.
 *   `options.strict` refuses a document with broken references: nothing is written and the
 *   promise is rejected with a BrokenReferencesError that lists them in `problems`
 * @returns {Promise<{ outputPath: string, htmlPath: string, pdfPath: string, includedFiles: string[], warnings: string[] }>}
 *   `outputPath` is the file that was asked for, whatever its format; `warnings` names what a
 *   Word or EPUB export could not draw (a diagram or formula kept as its source)
 */
async function convertMarkdownToPdf(inputPath, outputPath, options = {}) {
  const absInputPath = resolvePath(inputPath);

  const fromText = typeof options.markdown === 'string';
  if (!fromText && !fs.existsSync(absInputPath)) {
    throw new Error(`Input file not found: ${absInputPath}`);
  }

  const format = options.format ? options.format.toLowerCase() : 'pdf';
  if (!FORMATS.includes(format)) {
    throw new Error(`Unknown output format "${options.format}". Use one of: ${FORMATS.join(', ')}`);
  }

  // Derive output path if omitted
  let absOutputPath;
  if (outputPath) {
    absOutputPath = resolvePath(outputPath);
  } else {
    const parsed = path.parse(absInputPath);
    absOutputPath = path.join(parsed.dir, `${parsed.name}.${format}`);
  }

  // Read Markdown, pulling in the files it imports with `@import "path"`
  let markdownContent = fromText ? options.markdown : fs.readFileSync(absInputPath, 'utf8');
  let includedFiles = [];
  let origins;
  if (options.include !== false) {
    ({ content: markdownContent, files: includedFiles, origins } = expandIncludes(markdownContent, absInputPath));
  }
  // With `strict`, called with the ids of the output before anything is written.
  const refuseBrokenReferences = async (ids, extra = {}) => {
    if (!options.strict) return;
    const problems = await findBrokenReferences(markdownContent, { file: absInputPath, origins, ids, ...extra });
    if (problems.length) throw new BrokenReferencesError(absInputPath, problems);
  };

  // Word and EPUB are written from the Markdown itself; the browser only draws the diagrams
  // and formulas, when there are any.
  if (format === 'docx' || format === 'epub') {
    const build = format === 'docx' ? markdownToDocx : markdownToEpub;
    const document = buildDocument(markdownContent, options);
    if (options.strict) {
      const ids = collectHeadings(document.blocks).map(heading => heading.id);
      await refuseBrokenReferences(ids, { math: options.katex !== false });
    }
    const { media, warnings } = options.media
      ? { media: options.media, warnings: [] }
      : await drawDocumentMedia(document, options);
    fs.writeFileSync(absOutputPath, build(markdownContent, { ...options, media, baseDir: path.dirname(absInputPath) }));
    return {
      outputPath: absOutputPath,
      htmlPath: null,
      pdfPath: null,
      includedFiles,
      warnings
    };
  }

  // Parse to HTML
  const htmlContent = parseMarkdownToHtml(markdownContent, options);

  if (options.strict) {
    const frontMatter = parseFrontMatter(markdownContent).data;
    const toc = options.toc !== undefined ? options.toc : frontMatter.toc;
    await refuseBrokenReferences(htmlIds(htmlContent), {
      // What stands inside a formula is not Markdown, unless KaTeX is off.
      math: options.katex !== undefined ? options.katex : frontMatter.katex !== false,
      // Only the browser that prints the PDF loads pictures from the web.
      remote: format === 'pdf',
      anchorHint: toc ? '' : 'in PDF and HTML the headings get their anchors from --toc'
    });
  }

  if (format === 'html') {
    fs.writeFileSync(absOutputPath, htmlContent, 'utf8');
    return {
      outputPath: absOutputPath,
      htmlPath: absOutputPath,
      pdfPath: null,
      includedFiles,
      warnings: []
    };
  }

  // Temporary HTML path
  const tempHtmlPath = temporaryHtmlPath(absInputPath, absOutputPath);

  try {
    // Save temporary HTML file
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    // Render HTML to PDF via headless browser, with bookmarks unless turned off
    await renderHtmlToPdf(tempHtmlPath, absOutputPath, { ...options, outline: pdfOutline(markdownContent, options) });

    // Clean up temporary HTML file unless explicitly requested to keep
    if (!options.keepHtml) {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }

    return {
      outputPath: absOutputPath,
      htmlPath: tempHtmlPath,
      pdfPath: absOutputPath,
      includedFiles,
      warnings: []
    };
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(tempHtmlPath)) {
      try { fs.unlinkSync(tempHtmlPath); } catch (_) {}
    }
    throw error;
  }
}

module.exports = {
  BrokenReferencesError,
  convertMarkdownToPdf,
  expandIncludes,
  findBrokenReferences,
  markdownToDocx,
  markdownToEpub,
  parseMarkdownToHtml,
  pdfOutline,
  renderHtmlToPdf,
  temporaryHtmlPath
};
