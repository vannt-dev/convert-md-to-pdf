const fs = require('fs');
const path = require('path');
const { parseMarkdownToHtml } = require('./parser');
const { renderHtmlToPdf } = require('../browser/renderer');
const { resolvePath } = require('./utils');
const { expandIncludes } = require('./include');
const { markdownToDocx } = require('./docx');
const { markdownToEpub } = require('./epub');

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
 * Main function to convert a Markdown file: to PDF by default, or to the
 * format named in `options.format` (`html`, `docx`, `epub`)
 * @param {string} inputPath Path to source .md file
 * @param {string} [outputPath] Path to the target file
 * @param {Object} [options] Conversion options
 * @returns {Promise<{ outputPath: string, htmlPath: string, pdfPath: string, includedFiles: string[] }>}
 *   `outputPath` is the file that was asked for, whatever its format
 */
async function convertMarkdownToPdf(inputPath, outputPath, options = {}) {
  const absInputPath = resolvePath(inputPath);

  if (!fs.existsSync(absInputPath)) {
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
  let markdownContent = fs.readFileSync(absInputPath, 'utf8');
  let includedFiles = [];
  if (options.include !== false) {
    ({ content: markdownContent, files: includedFiles } = expandIncludes(markdownContent, absInputPath));
  }

  // Word and EPUB are written from the Markdown itself, without a browser
  if (format === 'docx' || format === 'epub') {
    const build = format === 'docx' ? markdownToDocx : markdownToEpub;
    fs.writeFileSync(absOutputPath, build(markdownContent, { ...options, baseDir: path.dirname(absInputPath) }));
    return {
      outputPath: absOutputPath,
      htmlPath: null,
      pdfPath: null,
      includedFiles
    };
  }

  // Parse to HTML
  const htmlContent = parseMarkdownToHtml(markdownContent, options);

  if (format === 'html') {
    fs.writeFileSync(absOutputPath, htmlContent, 'utf8');
    return {
      outputPath: absOutputPath,
      htmlPath: absOutputPath,
      pdfPath: null,
      includedFiles
    };
  }

  // Temporary HTML path
  const tempHtmlPath = temporaryHtmlPath(absInputPath, absOutputPath);

  try {
    // Save temporary HTML file
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    // Render HTML to PDF via headless browser
    await renderHtmlToPdf(tempHtmlPath, absOutputPath, options);

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
      includedFiles
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
  convertMarkdownToPdf,
  expandIncludes,
  markdownToDocx,
  markdownToEpub,
  parseMarkdownToHtml,
  renderHtmlToPdf,
  temporaryHtmlPath
};
