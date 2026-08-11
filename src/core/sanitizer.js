/**
 * HTML Sanitizer & Escaping Utilities
 */

/**
 * Sanitizes HTML content by stripping dangerous inline script tags and inline handlers
 * @param {string} html 
 * @returns {string} Clean HTML string
 */
function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * Escapes special HTML characters
 * @param {string} str 
 * @returns {string} Escaped string
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

module.exports = {
  sanitizeHtml,
  escapeHtml
};
