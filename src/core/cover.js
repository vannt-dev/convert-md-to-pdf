/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Cover Page Generator Utility
 */
const { escapeHtml } = require('./sanitizer');

// Cover labels by document language (front matter `lang`); any other language gets English.
const COVER_LABELS = {
  en: { author: 'Author', date: 'Date' },
  vi: { author: 'Tác giả', date: 'Ngày lập' }
};

/**
 * The cover labels for a language tag such as `en`, `vi` or `vi-VN`.
 * @param {string} [language]
 * @returns {{ author: string, date: string }}
 */
function coverLabels(language) {
  const primary = String(language || 'en').toLowerCase().split(/[-_]/)[0];
  return COVER_LABELS[primary] || COVER_LABELS.en;
}

/**
 * Generates a Cover Page HTML block if requested in front matter or options
 * @param {Object} metadata 
 * @returns {string} Cover page HTML string
 */
function generateCoverPage(metadata = {}) {
  const { title, subtitle, author, date, cover, language } = metadata;
  
  if (!cover && !subtitle && !author && !date) {
    return '';
  }

  const docTitle = title || 'Document Report';
  const docSubtitle = subtitle || '';
  const docAuthor = author || '';
  const docDate = date || '';
  const labels = coverLabels(language);

  return `<div class="cover-page">
  <div class="cover-page-inner">
    <div class="cover-badge">DOCUMENT REPORT</div>
    <h1 class="cover-title">${escapeHtml(docTitle)}</h1>
    ${docSubtitle ? `<h2 class="cover-subtitle">${escapeHtml(docSubtitle)}</h2>` : ''}
    <div class="cover-divider"></div>
    <div class="cover-meta-container">
      ${docAuthor ? `<div class="cover-meta-item"><span class="cover-meta-label">${labels.author}:</span> <span class="cover-meta-val">${escapeHtml(docAuthor)}</span></div>` : ''}
      ${docDate ? `<div class="cover-meta-item"><span class="cover-meta-label">${labels.date}:</span> <span class="cover-meta-val">${escapeHtml(docDate)}</span></div>` : ''}
    </div>
  </div>
</div>\n`;
}

module.exports = {
  coverLabels,
  generateCoverPage
};
