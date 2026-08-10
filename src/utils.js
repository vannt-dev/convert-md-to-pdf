const path = require('path');
const fs = require('fs');

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
 * Generates a Table of Contents (TOC) HTML block from markdown headings
 * @param {string} mdContent 
 * @returns {{ tocHtml: string, headingsMap: Map<string, string> }}
 */
function generateToc(mdContent) {
  if (!mdContent) return { tocHtml: '', headingsMap: new Map() };

  const lines = mdContent.split('\n');
  const headings = [];
  const headingsMap = new Map();
  const slugCounts = {};

  lines.forEach(line => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      let title = match[2].trim();
      
      // Clean inline markdown links/code from heading title
      title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                   .replace(/`([^`]+)`/g, '$1')
                   .replace(/\*+/g, '');

      // Create unique slug
      let slug = title.toLowerCase()
                      .replace(/[^\w\u00C0-\u024F\u1EA0-\u1EF9]+/g, '-')
                      .replace(/^-+|-+$/g, '');

      if (!slug) slug = `heading-${headings.length + 1}`;

      if (slugCounts[slug]) {
        slugCounts[slug]++;
        slug = `${slug}-${slugCounts[slug]}`;
      } else {
        slugCounts[slug] = 1;
      }

      headings.push({ level, title, slug });
      headingsMap.set(match[2].trim(), slug);
    }
  });

  if (headings.length === 0) return { tocHtml: '', headingsMap };

  let tocHtml = `<div class="toc-container">
    <div class="toc-title">📋 Table of Contents</div>
    <ul class="toc-list">\n`;

  headings.forEach(h => {
    const indentClass = `toc-item-h${h.level}`;
    tocHtml += `      <li class="${indentClass}"><a href="#${h.slug}">${escapeHtml(h.title)}</a></li>\n`;
  });

  tocHtml += `    </ul>\n  </div>\n`;

  return { tocHtml, headingsMap };
}

/**
 * Reads custom CSS file if path provided
 * @param {string} cssPath 
 * @returns {string}
 */
function readCustomCss(cssPath) {
  if (!cssPath) return '';
  const absPath = resolvePath(cssPath);
  if (fs.existsSync(absPath)) {
    return fs.readFileSync(absPath, 'utf8');
  }
  return '';
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
  generateToc,
  readCustomCss,
  escapeHtml,
  resolvePath
};
