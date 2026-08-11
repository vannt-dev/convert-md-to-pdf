/**
 * Table of Contents (TOC) Generator Utility
 */
const { escapeHtml } = require('./sanitizer');

/**
 * Generates a Table of Contents (TOC) HTML block from markdown headings with dotted leader lines
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
    tocHtml += `      <li class="${indentClass}">
        <a href="#${h.slug}">
          <span class="toc-item-title">${escapeHtml(h.title)}</span>
          <span class="toc-item-dots"></span>
        </a>
      </li>\n`;
  });

  tocHtml += `    </ul>\n  </div>\n`;

  return { tocHtml, headingsMap };
}

module.exports = {
  generateToc
};
