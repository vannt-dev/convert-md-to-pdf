const fs = require('fs');
const path = require('path');
const { parseFrontMatter } = require('./frontmatter');
const { generateToc } = require('./toc');
const { generateCoverPage } = require('./cover');
const { sanitizeHtml, escapeHtml } = require('./sanitizer');

/**
 * Preprocesses Markdown content before parsing:
 * - Transforms GitHub Callouts/Alerts (> [!NOTE], > [!TIP], etc.)
 * - Transforms pagebreak comments (<!-- pagebreak --> or \pagebreak)
 * - Converts simple LaTeX arrow/math symbols
 * @param {string} mdContent 
 * @returns {string} Preprocessed markdown string
 */
function preprocessMarkdown(mdContent = '') {
  if (!mdContent) return '';

  return mdContent
    // GitHub Callouts / Alerts
    .replace(/^>\s*\[!NOTE\]\s*\r?\n/gm, '> **ℹ️ NOTE:** ')
    .replace(/^>\s*\[!TIP\]\s*\r?\n/gm, '> **💡 TIP:** ')
    .replace(/^>\s*\[!WARNING\]\s*\r?\n/gm, '> **⚠️ WARNING:** ')
    .replace(/^>\s*\[!IMPORTANT\]\s*\r?\n/gm, '> **❗ IMPORTANT:** ')
    .replace(/^>\s*\[!CAUTION\]\s*\r?\n/gm, '> **🚫 CAUTION:** ')
    // Pagebreaks
    .replace(/<!--\s*page-?break\s*-->/gi, '<div class="page-break"></div>')
    .replace(/\\pagebreak/gi, '<div class="page-break"></div>')
    // LaTeX math symbols
    .replace(/\\longrightarrow/g, '⟶')
    .replace(/\\rightarrow/g, '→')
    .replace(/\$→\$/g, '→')
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\\longrightarrow\$/g, '⟶')
    .replace(/\$\\ge\$/g, '≥')
    .replace(/\$\\le\$/g, '≤')
    .replace(/\$x\/y\$/g, 'x/y')
    .replace(/\$x < y\$/g, 'x < y')
    .replace(/\$x = y\$/g, 'x = y')
    // Formula box transformation
    .replace(/\$\$\s*\\text\{([^}]+)\}\s*=\s*\\text\{([^}]+)\}\s*-\s*\\text\{([^}]+)\}\s*\$\$/g, 
      '<div class="formula-box"><strong>$1</strong> = <span>$2</span> &minus; <span>$3</span></div>')
    .replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<div class="formula-box">$1</div>');
}

/**
 * Safely reads custom CSS file contents
 * @param {string} cssFilePath 
 * @returns {string} CSS content
 */
function readCustomCss(cssFilePath) {
  if (!cssFilePath) return '';
  const absPath = resolvePath(cssFilePath);
  if (fs.existsSync(absPath)) {
    try {
      return fs.readFileSync(absPath, 'utf8');
    } catch (err) {
      console.warn(`[Warning] Could not read custom CSS file at: ${absPath}`);
    }
  } else {
    console.warn(`[Warning] Custom CSS file not found at: ${absPath}`);
  }
  return '';
}

/**
 * Resolves absolute path safely
 * @param {string} filePath 
 * @returns {string} Absolute file path
 */
function resolvePath(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

module.exports = {
  parseFrontMatter,
  generateCoverPage,
  preprocessMarkdown,
  generateToc,
  readCustomCss,
  sanitizeHtml,
  escapeHtml,
  resolvePath
};
