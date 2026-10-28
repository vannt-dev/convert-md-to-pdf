/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Page numbers and a running header/footer, printed in the page margins with CSS `@page`
 * margin boxes. Chrome and Edge draw these both for `--print-to-pdf` and in their print
 * dialog, so the CLI and the extension share this file: it needs nothing from Node and is
 * shipped in the extension as extension/lib/pagemarks.js (a test keeps the two identical).
 *
 * Header and footer are text with placeholders: {page}, {pages}, {title}, {author}, {date}.
 * A watermark is plain text printed large, faint and diagonal across the middle of every page.
 */
(function (scope) {
  const NUMBER_STYLES = {
    full: 'Page {page} of {pages}',
    simple: '{page}'
  };
  const DEFAULT_HEADER = '{title}';
  const PLACEHOLDER = /\{(page|pages|title|author|date)\}/g;

  /**
   * The text for a header or footer option: a string as it is, `true` for the default.
   * @param {*} value
   * @param {string} fallback Text used for `true`
   * @returns {string} '' when off
   */
  function textOf(value, fallback) {
    if (value === true) return fallback;
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * The page number text for the `pageNumbers` option.
   * @param {*} value true, 'full', 'simple', or false/empty for none
   * @returns {string} '' when off
   */
  function numbersOf(value) {
    if (value === undefined || value === null || value === false || value === '') return '';
    if (value === true) return NUMBER_STYLES.full;
    const style = String(value).trim().toLowerCase();
    if (style === 'true') return NUMBER_STYLES.full;
    if (style === 'false' || style === 'none' || style === 'off') return '';
    if (!NUMBER_STYLES[style]) {
      throw new Error(`Unknown page number style "${value}". Use one of: ${Object.keys(NUMBER_STYLES).join(', ')}`);
    }
    return NUMBER_STYLES[style];
  }

  /**
   * A CSS string literal that cannot end early or close the <style> element.
   * @param {string} text
   * @returns {string}
   */
  function cssString(text) {
    const safe = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\r\n]+/g, ' ')
      .replace(/</g, '\\3C ');
    return `"${safe}"`;
  }

  /**
   * Turns header/footer text into the value of a CSS `content` property.
   * @param {string} text
   * @param {{ title?: string, author?: string, date?: string }} meta
   * @returns {string}
   */
  function contentValue(text, meta = {}) {
    const parts = [];
    let literal = '';
    let last = 0;
    for (const match of text.matchAll(PLACEHOLDER)) {
      literal += text.slice(last, match.index);
      last = match.index + match[0].length;
      const name = match[1];
      if (name === 'page' || name === 'pages') {
        if (literal) parts.push(cssString(literal));
        literal = '';
        parts.push(`counter(${name})`);
      } else {
        literal += meta[name] ? String(meta[name]) : '';
      }
    }
    literal += text.slice(last);
    if (literal) parts.push(cssString(literal));
    return parts.length ? parts.join(' ') : '""';
  }

  /**
   * Where each text goes. The header sits top centre. The footer sits bottom centre, unless
   * page numbers are also on: then the footer text goes left and the numbers right.
   * @param {{ header?: *, footer?: *, pageNumbers?: * }} options
   * @returns {Object<string, string>} margin box name -> text
   */
  function pageMarkBoxes(options = {}) {
    const header = textOf(options.header, DEFAULT_HEADER);
    const numbers = numbersOf(options.pageNumbers);
    const footer = textOf(options.footer, NUMBER_STYLES.full);
    const boxes = {};
    if (header) boxes['top-center'] = header;
    if (footer && numbers && footer !== numbers) {
      boxes['bottom-left'] = footer;
      boxes['bottom-right'] = numbers;
    } else if (footer || numbers) {
      boxes['bottom-center'] = footer || numbers;
    }
    return boxes;
  }

  /**
   * CSS for a watermark, or '' when there is none. A fixed element is repeated on every page
   * Chrome prints, so the text lands in the middle of each one. Long text gets a smaller size
   * so that it still fits across the page.
   * @param {*} text
   * @param {string} font CSS font-family value
   * @returns {string}
   */
  function watermarkCss(text, font) {
    const value = typeof text === 'string' ? text.trim() : typeof text === 'number' ? String(text) : '';
    if (!value) return '';
    const size = Math.max(28, Math.min(96, Math.floor(1100 / value.length)));
    return [
      '/* Watermark */',
      `body::after { content: ${cssString(value)}; position: fixed; top: 50%; left: 50%; ` +
        'transform: translate(-50%, -50%) rotate(-35deg); white-space: nowrap; pointer-events: none; ' +
        `z-index: 2147483647; font-family: ${font}; font-size: ${size}px; font-weight: 700; ` +
        'color: rgba(100, 116, 139, 0.16); }'
    ].join('\n');
  }

  /**
   * CSS for the page numbers, running header/footer and watermark, or '' when none is on.
   * A cover page (.cover-page) is printed without the margin texts.
   * @param {{ header?: *, footer?: *, pageNumbers?: *, watermark?: *, font?: string }} options
   * @param {{ title?: string, author?: string, date?: string }} [meta]
   * @returns {string}
   */
  function pageMarksCss(options = {}, meta = {}) {
    const font = options.font ? `${cssString(String(options.font))}, sans-serif` : 'sans-serif';
    const watermark = watermarkCss(options.watermark, font);
    const boxes = pageMarkBoxes(options);
    const names = Object.keys(boxes);
    if (!names.length) return watermark;

    const style = `font-family: ${font}; font-size: 9px; color: #64748b;`;
    const rules = names.map(
      (name) => `  @${name} { content: ${contentValue(boxes[name], meta)}; ${style} }`
    );
    const blank = names.map((name) => `  @${name} { content: none; }`);
    return [
      '/* Page numbers and running header/footer */',
      '@page {',
      ...rules,
      '}',
      '.cover-page { page: cover; }',
      '@page cover {',
      ...blank,
      '}',
      ...(watermark ? [watermark] : [])
    ].join('\n');
  }

  const api = { pageMarksCss, pageMarkBoxes, contentValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfPageMarks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
