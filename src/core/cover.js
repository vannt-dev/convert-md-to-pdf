/**
 * Cover Page Generator Utility
 */
const { escapeHtml } = require('./sanitizer');

/**
 * Generates a Cover Page HTML block if requested in front matter or options
 * @param {Object} metadata 
 * @returns {string} Cover page HTML string
 */
function generateCoverPage(metadata = {}) {
  const { title, subtitle, author, date, cover } = metadata;
  
  if (!cover && !subtitle && !author && !date) {
    return '';
  }

  const docTitle = title || 'Document Report';
  const docSubtitle = subtitle || '';
  const docAuthor = author || '';
  const docDate = date || '';

  return `<div class="cover-page">
  <div class="cover-page-inner">
    <div class="cover-badge">DOCUMENT REPORT</div>
    <h1 class="cover-title">${escapeHtml(docTitle)}</h1>
    ${docSubtitle ? `<h2 class="cover-subtitle">${escapeHtml(docSubtitle)}</h2>` : ''}
    <div class="cover-divider"></div>
    <div class="cover-meta-container">
      ${docAuthor ? `<div class="cover-meta-item"><span class="cover-meta-label">Tác giả:</span> <span class="cover-meta-val">${escapeHtml(docAuthor)}</span></div>` : ''}
      ${docDate ? `<div class="cover-meta-item"><span class="cover-meta-label">Ngày lập:</span> <span class="cover-meta-val">${escapeHtml(docDate)}</span></div>` : ''}
    </div>
  </div>
</div>
<div class="page-break"></div>\n`;
}

module.exports = {
  generateCoverPage
};
