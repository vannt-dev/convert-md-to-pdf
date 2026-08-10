const fs = require('fs');
const path = require('path');
const { parseMarkdownToHtml } = require('./parser');
const { renderHtmlToPdf } = require('./browser');
const { resolvePath } = require('./utils');

/**
 * Main function to convert Markdown file to PDF
 * @param {string} inputPath Path to source .md file
 * @param {string} [outputPath] Path to target .pdf file
 * @param {Object} [options] Conversion options
 * @returns {Promise<{ htmlPath: string, pdfPath: string }>}
 */
async function convertMarkdownToPdf(inputPath, outputPath, options = {}) {
  const absInputPath = resolvePath(inputPath);

  if (!fs.existsSync(absInputPath)) {
    throw new Error(`Input file not found: ${absInputPath}`);
  }

  // Derive output PDF path if omitted
  let absPdfPath;
  if (outputPath) {
    absPdfPath = resolvePath(outputPath);
  } else {
    const parsed = path.parse(absInputPath);
    absPdfPath = path.join(parsed.dir, `${parsed.name}.pdf`);
  }

  // Temporary HTML path
  const tempHtmlPath = path.join(path.parse(absPdfPath).dir, `_temp_${Date.now()}.html`);

  try {
    // Read Markdown
    const markdownContent = fs.readFileSync(absInputPath, 'utf8');

    // Parse to HTML
    const htmlContent = parseMarkdownToHtml(markdownContent, options);

    // Save temporary HTML file
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    // Render HTML to PDF via headless browser
    await renderHtmlToPdf(tempHtmlPath, absPdfPath, options);

    // Clean up temporary HTML file unless explicitly requested to keep
    if (!options.keepHtml) {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }

    return {
      htmlPath: tempHtmlPath,
      pdfPath: absPdfPath
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
  parseMarkdownToHtml,
  renderHtmlToPdf
};
