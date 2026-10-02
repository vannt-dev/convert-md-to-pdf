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
    .replace(OPENING_TAG, stripEventHandlers);
}

// An opening tag, with quoted attribute values allowed to contain ">". A quote that is never
// closed still ends at the next ">", as the tag would in a lenient parser.
const OPENING_TAG = /<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
// One attribute: its name, then an optional value. Consuming the value keeps it from being
// read as another attribute.
const ATTRIBUTE = /[\s/]*([^\s"'<>/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;

/**
 * Drops on* attributes from one opening tag. Text between tags is never touched, so code
 * such as `el.onclick = fn` survives.
 * @param {string} tag
 * @param {string} name
 * @param {string} attributes
 * @returns {string}
 */
function stripEventHandlers(tag, name, attributes) {
  const kept = attributes.replace(ATTRIBUTE, (attribute, attributeName) =>
    /^on/i.test(attributeName) ? '' : attribute
  );
  return `<${name}${kept}>`;
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
