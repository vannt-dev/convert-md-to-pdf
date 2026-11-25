/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const path = require('path');
const { parseFrontMatter } = require('./frontmatter');
const { isImage, parseTarget, slugify } = require('./obsidian');
const { findNote, findVaultRoot } = require('./vault');

/**
 * File includes: a line that holds only `@import "path"` is replaced by the
 * file it names, relative to the file the line is in.
 *
 * A Markdown file (.md, .markdown) is put in as Markdown, without its front
 * matter, and may import further files itself. Any other file is put in as a
 * fenced code block labelled with its extension, so `@import "src/app.js"`
 * shows the source. Lines inside a fenced code block are left as they are.
 *
 * With Obsidian syntax on, a line that holds only `![[Note]]` (or `![[Note#Heading]]`) is
 * replaced by that note (or that section of it), found as vault.js describes. A note that cannot
 * be found, one that would embed itself again, or embeds nested more than MAX_EMBED_DEPTH deep
 * stay as written: the line is then drawn as a link to the note.
 */

const IMPORT_LINE = /^[ \t]*@import[ \t]+(["'])(.+?)\1[ \t]*$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const MAX_DEPTH = 10;
const EMBED_LINE = /^ {0,3}!\[\[([^[\]\n]+?)\]\][ \t]*$/;
const HEADING_LINE = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const MAX_EMBED_DEPTH = 3;

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

/**
 * The lines of one section of a note: its heading and what follows, up to the next heading of
 * the same or a higher level. Headings inside code blocks do not count.
 * @param {string[]} lines
 * @param {string} heading The heading's text, as a wikilink names it
 * @returns {{ start: number, end: number } | null}
 */
function findSection(lines, heading) {
  const wanted = slugify(heading);
  let fence = null;
  let start = -1;
  let depth = 0;
  for (let index = 0; index < lines.length; index++) {
    const fenceMatch = lines[index].match(FENCE_LINE);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    const match = lines[index].match(HEADING_LINE);
    if (!match) continue;
    if (start === -1) {
      if (slugify(match[2]) === wanted) {
        start = index;
        depth = match[1].length;
      }
    } else if (match[1].length <= depth) {
      return { start, end: index };
    }
  }
  return start === -1 ? null : { start, end: lines.length };
}

/**
 * The note a `![[Note]]` line puts in, or null when the line stays as written.
 * @returns {{ file: string, heading: string } | null}
 */
function embeddedNote(line, filePath, chain, settings, embedDepth) {
  const match = line.match(EMBED_LINE);
  if (!match) return null;
  const target = parseTarget(match[1]);
  if (!target.name || target.block || isImage(target.name) || embedDepth >= MAX_EMBED_DEPTH) return null;
  const file = findNote(target.name, filePath, settings.vaultRoot);
  if (!file || chain.includes(file)) return null;
  return { file, heading: target.heading };
}

/**
 * The lines of the expanded document, each with the file and line it came from.
 * @returns {{ text: string, file: string, line: number }[]}
 */
function expand(markdown, filePath, chain, files, settings, embedDepth = 0) {
  const baseDir = path.dirname(filePath);
  const output = [];
  let fence = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const origin = { file: filePath, line: index + 1 };
    const fenceMatch = line.match(FENCE_LINE);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) {
        fence = null;
      }
      output.push({ text: line, ...origin });
      return;
    }

    const embed = !fence && settings.embeds ? embeddedNote(line, filePath, chain, settings, embedDepth) : null;
    if (embed) {
      const text = fs.readFileSync(embed.file, 'utf8').replace(/^\uFEFF/, '');
      const body = parseFrontMatter(text).content;
      const skipped = text.slice(0, text.length - body.length).split('\n').length - 1;
      let bodyLines = body.split(/\r?\n/);
      let first = 0;
      if (embed.heading) {
        const section = findSection(bodyLines, embed.heading);
        if (!section) {
          output.push({ text: line, ...origin });
          return;
        }
        bodyLines = bodyLines.slice(section.start, section.end);
        first = section.start;
      }
      files.add(embed.file);
      const lines = expand(bodyLines.join('\n'), embed.file, [...chain, embed.file], files, settings, embedDepth + 1);
      lines.forEach(entry => {
        if (entry.file === embed.file) entry.line += skipped + first;
      });
      while (lines.length > 1 && lines[lines.length - 1].text === '') lines.pop();
      // Blank lines around the note keep it from running into the paragraphs beside it.
      output.push({ text: '', ...origin }, ...lines, { text: '', ...origin });
      return;
    }

    const importMatch = fence || !settings.imports ? null : line.match(IMPORT_LINE);
    if (!importMatch) {
      output.push({ text: line, ...origin });
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
      // The front matter is left out; the lines keep the numbers they have in the file.
      const body = parseFrontMatter(text).content;
      const skipped = text.slice(0, text.length - body.length).split('\n').length - 1;
      const lines = expand(body, target, [...chain, target], files, settings, embedDepth);
      lines.forEach(entry => {
        if (entry.file === target) entry.line += skipped;
      });
      // Blank lines at the end of the file are dropped.
      while (lines.length > 1 && lines[lines.length - 1].text === '') lines.pop();
      output.push(...lines);
    } else {
      const code = text.replace(/(\r?\n)+$/, '');
      const marker = fenceFor(code);
      output.push({ text: `${marker}${extension.slice(1)}`, ...origin });
      code.split('\n').forEach((codeLine, codeIndex) => output.push({ text: codeLine, file: target, line: codeIndex + 1 }));
      output.push({ text: marker, ...origin });
    }
  });

  return output;
}

/**
 * Replaces every `@import "path"` line of a Markdown document with the file
 * it names.
 * @param {string} markdown Content of the document
 * @param {string} filePath Path of the document; imports are relative to it
 * @param {{ imports?: boolean, embeds?: boolean }} [options] imports (default on): fill in
 *   `@import` lines; embeds (default off): fill in Obsidian `![[Note]]` lines
 * @returns {{ content: string, files: string[], origins: { file: string, line: number }[] }}
 *   The expanded Markdown, the absolute path of every file that was imported, directly or
 *   not, and for each line of the expanded Markdown the file and line it was read from
 */
function expandIncludes(markdown = '', filePath = '', options = {}) {
  const absolutePath = path.resolve(filePath || 'document.md');
  const files = new Set();
  const settings = {
    imports: options.imports !== false,
    embeds: Boolean(options.embeds),
    vaultRoot: options.embeds ? findVaultRoot(path.dirname(absolutePath)) : null
  };
  const lines = expand(markdown, absolutePath, [absolutePath], files, settings);
  return {
    content: lines.map(line => line.text).join('\n'),
    files: Array.from(files),
    origins: lines.map(({ file, line }) => ({ file, line }))
  };
}

module.exports = {
  expandIncludes
};
