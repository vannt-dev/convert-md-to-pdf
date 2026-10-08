const fs = require('fs');
const path = require('path');
const { parseFrontMatter } = require('./frontmatter');

/**
 * File includes: a line that holds only `@import "path"` is replaced by the
 * file it names, relative to the file the line is in.
 *
 * A Markdown file (.md, .markdown) is put in as Markdown, without its front
 * matter, and may import further files itself. Any other file is put in as a
 * fenced code block labelled with its extension, so `@import "src/app.js"`
 * shows the source. Lines inside a fenced code block are left as they are.
 */

const IMPORT_LINE = /^[ \t]*@import[ \t]+(["'])(.+?)\1[ \t]*$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const MAX_DEPTH = 10;

/**
 * A fence longer than any run of backticks in the code, so the code cannot
 * close its own block.
 * @param {string} code
 * @returns {string}
 */
function fenceFor(code) {
  const longest = (code.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function expand(markdown, filePath, chain, files) {
  const baseDir = path.dirname(filePath);
  const output = [];
  let fence = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const fenceMatch = line.match(FENCE_LINE);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) {
        fence = null;
      }
      output.push(line);
      return;
    }

    const importMatch = fence ? null : line.match(IMPORT_LINE);
    if (!importMatch) {
      output.push(line);
      return;
    }

    const where = `${filePath}:${index + 1}`;
    const target = path.resolve(baseDir, importMatch[2]);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error(`Cannot import "${importMatch[2]}" (${where}): file not found at ${target}`);
    }
    if (chain.includes(target)) {
      const loop = [...chain.slice(chain.indexOf(target)), target]
        .map(file => path.basename(file))
        .join(' → ');
      throw new Error(`Cannot import "${importMatch[2]}" (${where}): the files import each other (${loop})`);
    }
    if (chain.length > MAX_DEPTH) {
      throw new Error(`Cannot import "${importMatch[2]}" (${where}): imports are nested more than ${MAX_DEPTH} deep`);
    }

    files.add(target);
    const text = fs.readFileSync(target, 'utf8').replace(/^﻿/, '');
    const extension = path.extname(target).toLowerCase();

    if (MARKDOWN_EXTENSIONS.has(extension)) {
      const body = parseFrontMatter(text).content;
      output.push(expand(body, target, [...chain, target], files).replace(/(\r?\n)+$/, ''));
    } else {
      const code = text.replace(/(\r?\n)+$/, '');
      const marker = fenceFor(code);
      output.push(`${marker}${extension.slice(1)}`, code, marker);
    }
  });

  return output.join('\n');
}

/**
 * Replaces every `@import "path"` line of a Markdown document with the file
 * it names.
 * @param {string} markdown Content of the document
 * @param {string} filePath Path of the document; imports are relative to it
 * @returns {{ content: string, files: string[] }} The expanded Markdown and
 *   the absolute path of every file that was imported, directly or not
 */
function expandIncludes(markdown = '', filePath = '') {
  const absolutePath = path.resolve(filePath || 'document.md');
  const files = new Set();
  const content = expand(markdown, absolutePath, [absolutePath], files);
  return { content, files: Array.from(files) };
}

module.exports = {
  expandIncludes
};
