/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const path = require('path');
const { parseFrontMatter } = require('./frontmatter');
const { generateToc } = require('./toc');
const { generateCoverPage } = require('./cover');
const { sanitizeHtml, escapeHtml } = require('./sanitizer');
const { preprocessMarkdown } = require('./preprocess');

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
