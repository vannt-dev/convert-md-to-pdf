const path = require('path');

/**
 * Normalizes math delimiters & common LaTeX symbols in markdown text
 * @param {string} mdContent 
 * @returns {string}
 */
function preprocessMarkdown(mdContent) {
  if (!mdContent) return '';

  return mdContent
    // Common LaTeX arrows & symbols
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
    // Display Math conversion $$...$$ to styled formula container
    .replace(/\$\$\s*\\text\{([^}]+)\}\s*=\s*\\text\{([^}]+)\}\s*-\s*\\text\{([^}]+)\}\s*\$\$/g, 
      '<div class="formula-box"><strong>$1</strong> = <span>$2</span> &minus; <span>$3</span></div>')
    .replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<div class="formula-box">$1</div>');
}

/**
 * Escapes special HTML characters
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves absolute path safely
 * @param {string} filePath 
 * @returns {string}
 */
function resolvePath(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

module.exports = {
  preprocessMarkdown,
  escapeHtml,
  resolvePath
};
