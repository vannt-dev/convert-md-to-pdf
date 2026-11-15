/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { parseFrontMatter } = require('./frontmatter');
const { localImagePath } = require('./images');
const { protectMath } = require('./math');

/**
 * Broken references of a Markdown document, for `--strict`: pictures that cannot be loaded,
 * links to local files that do not exist, links to an anchor no heading has, and footnote
 * references without a note.
 */

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:/;
const FOOTNOTE_CONTINUATION = /^(?: {2,}|\t)\S/;
const FOOTNOTE_REFERENCE = /\[\^([^\]\s]+)\](?![([])/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const DRIVE = /^[a-zA-Z]:[\\/]/;
const HTML_TAG = /<(img|a)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
const REMOTE_TIMEOUT_MS = 10000;
// Answers that say "not for this client" rather than "not there": a browser may still get the picture.
const REMOTE_REFUSALS = [401, 403, 405, 429];

function attribute(source, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(source);
  return match ? (match[2] ?? match[3] ?? match[4] ?? '') : null;
}

function decoded(text) {
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

/**
 * Footnotes, on the Markdown text. The definitions and the references are blanked out in the
 * text that is returned, with every line kept, so that the Markdown parser does not read
 * `[^1]: word` as a link definition.
 * @param {string[]} lines
 * @returns {{ lines: string[], missing: { index: number, reference: string }[] }}
 *   `missing`: the references that have no definition, with the index of their line
 */
function scanFootnotes(lines) {
  const definitions = new Set();
  const references = [];
  const out = [];
  let fence = null;
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index];
    const match = FENCE.exec(text);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
      out.push(text);
      continue;
    }
    if (match) {
      fence = match[1];
      out.push(text);
      continue;
    }
    const definition = FOOTNOTE_DEFINITION.exec(text);
    if (definition) {
      definitions.add(definition[1]);
      out.push('');
      while (index + 1 < lines.length && FOOTNOTE_CONTINUATION.test(lines[index + 1]) && !FENCE.test(lines[index + 1])) {
        index += 1;
        out.push('');
      }
      continue;
    }
    out.push(
      text
        .split(/(`+[^`]*`+)/)
        .map((part, partIndex) =>
          partIndex % 2 === 1
            ? part
            : part.replace(FOOTNOTE_REFERENCE, (whole, id) => {
                references.push({ index, id, reference: whole });
                return ' '.repeat(whole.length);
              })
        )
        .join('')
    );
  }
  return { lines: out, missing: references.filter(reference => !definitions.has(reference.id)) };
}

/**
 * The pictures and links of the Markdown, in document order, each with the index of its line
 * (null when the place is not known).
 * @param {string} text
 * @returns {{ kind: 'image' | 'link', target: string, index: number | null }[]}
 */
function collectTargets(text) {
  const found = [];
  const lineAt = (offset) => text.slice(0, offset).split('\n').length - 1;
  let blockStart = 0;
  let blockEnd = 0;
  let cursor = 0;

  // Where `needle` stands in the block being read, searching on from the last place found.
  const locate = (needle) => {
    let at = needle ? text.indexOf(needle, cursor) : -1;
    if (at === -1 || at >= blockEnd) at = -1;
    return at;
  };
  const add = (kind, target, needle, inner) => {
    const at = locate(needle);
    if (at !== -1) cursor = at;
    if (target) found.push({ kind, target, index: lineAt(at === -1 ? blockStart : at) });
    if (inner) inner();
    if (at !== -1) cursor = Math.max(cursor, at + needle.length);
  };
  const html = (source) => {
    HTML_TAG.lastIndex = 0;
    const tags = [];
    for (let match = HTML_TAG.exec(source); match; match = HTML_TAG.exec(source)) tags.push(match);
    for (const match of tags) {
      const image = match[1].toLowerCase() === 'img';
      add(image ? 'image' : 'link', attribute(match[2], image ? 'src' : 'href'), match[0]);
    }
  };
  const walk = (tokens) => {
    for (const token of tokens || []) {
      if (token.type === 'image') add('image', token.href, token.raw);
      else if (token.type === 'link') add('link', token.href, token.raw, () => walk(token.tokens));
      else if (token.type === 'html') html(token.raw || token.text || '');
      else if (token.type === 'table') {
        token.header.forEach(cell => walk(cell.tokens));
        token.rows.forEach(row => row.forEach(cell => walk(cell.tokens)));
      } else if (token.type === 'list') token.items.forEach(item => walk(item.tokens));
      else if (token.tokens) walk(token.tokens);
    }
  };

  for (const token of marked.lexer(text, { gfm: true, breaks: true })) {
    const at = text.indexOf(token.raw, blockEnd);
    blockStart = at === -1 ? blockEnd : at;
    blockEnd = blockStart + token.raw.length;
    cursor = blockStart;
    walk([token]);
  }
  return found;
}

/**
 * Whether a web picture answers. Asked for once per address.
 * @param {string} url
 * @param {Map<string, Promise<string | null>>} asked
 * @returns {Promise<string | null>} what went wrong, or null when the picture is there
 */
function remoteImageFault(url, asked) {
  if (!asked.has(url)) {
    asked.set(
      url,
      fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) }).then(
        (response) => {
          if (response.body) response.body.cancel().catch(() => {});
          return response.ok || REMOTE_REFUSALS.includes(response.status) ? null : `the server answered ${response.status}`;
        },
        (error) => (error && error.name === 'TimeoutError' ? `no answer within ${REMOTE_TIMEOUT_MS / 1000} s` : 'no answer')
      )
    );
  }
  return asked.get(url);
}

/** What is wrong with a local file, or null when it can be read. */
function fileFault(filePath, { directory = false } = {}) {
  if (!fs.existsSync(filePath)) return 'file not found';
  if (!directory && !fs.statSync(filePath).isFile()) return 'not a file';
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (_) {
    return 'file cannot be read';
  }
  return null;
}

/**
 * Finds the broken references of a Markdown document.
 * @param {string} markdown The document, with its `@import` lines already filled in
 * @param {Object} options
 * @param {string} options.file Path of the document
 * @param {string} [options.baseDir] Folder that relative paths start from (default: the file's)
 * @param {Iterable<string>} options.ids Every id a `#anchor` link can lead to in the output
 * @param {{ file: string, line: number }[]} [options.origins] For each line of `markdown`, the
 *   file and line it was read from (see include.js); by default the lines of `file`
 * @param {boolean} [options.math] The formulas are taken out before the Markdown is read
 * @param {boolean} [options.remote] Also ask for the pictures that have a web address
 * @param {string} [options.anchorHint] Added to the message of a missing anchor
 * @returns {Promise<{ kind: 'image' | 'link' | 'anchor' | 'footnote', file: string, line: number | null,
 *   reference: string, message: string }[]>} in document order
 */
async function findBrokenReferences(markdown = '', options = {}) {
  const file = options.file ? path.resolve(options.file) : path.resolve('document.md');
  const baseDir = options.baseDir || path.dirname(file);
  const ids = new Set(options.ids || []);
  const source = String(markdown).replace(/\r\n?/g, '\n');
  const content = parseFrontMatter(source).content;
  const skipped = source.slice(0, source.length - content.length).split('\n').length - 1;
  const where = (index) => {
    if (index === null) return { file, line: null };
    const origin = options.origins && options.origins[index + skipped];
    return origin ? { file: origin.file, line: origin.line } : { file, line: index + skipped + 1 };
  };

  const footnotes = scanFootnotes(content.split('\n'));
  const text = footnotes.lines.join('\n');
  let targets = collectTargets(text);
  if (options.math) {
    // What stands inside a formula is not Markdown: only targets that are still there once
    // the formulas are taken out count.
    const left = new Map();
    for (const { kind, target } of collectTargets(protectMath(text).text)) {
      const key = `${kind} ${target}`;
      left.set(key, (left.get(key) || 0) + 1);
    }
    targets = targets.filter(({ kind, target }) => left.has(`${kind} ${target}`));
  }

  const asked = new Map();
  const problems = [];
  const checks = targets.map(async ({ kind, target, index }) => {
    const problem = (problemKind, message) => ({ index, kind: problemKind, ...where(index), reference: target, message });
    if (kind === 'image') {
      if (/^https?:\/\//i.test(target)) {
        const fault = options.remote ? await remoteImageFault(target, asked) : null;
        return fault ? problem('image', `image cannot be loaded (${fault}): ${target}`) : null;
      }
      const imagePath = localImagePath(target, baseDir);
      if (!imagePath) {
        // Another kind of address (data:, for one) is left to the reader; a file: address that names no file is broken.
        return /^file:/i.test(target) ? problem('image', `image not found (not a file address this system can open): ${target}`) : null;
      }
      const fault = fileFault(imagePath);
      return fault ? problem('image', `image cannot be loaded (${fault}): ${target}`) : null;
    }
    if (target[0] === '#') {
      const id = decoded(target.slice(1));
      if (id === '' || id.toLowerCase() === 'top' || ids.has(id)) return null;
      return problem('anchor', `no heading has the anchor ${target}${options.anchorHint ? ` (${options.anchorHint})` : ''}`);
    }
    if (target.startsWith('//') || (SCHEME.test(target) && !/^file:/i.test(target) && !DRIVE.test(target))) return null;
    const linkPath = localImagePath(target, baseDir);
    if (!linkPath) return problem('link', `linked file not found (not a file address this system can open): ${target}`);
    const fault = fileFault(linkPath, { directory: true });
    return fault ? problem('link', `linked ${fault}: ${target}`) : null;
  });
  for (const problem of await Promise.all(checks)) {
    if (problem) problems.push(problem);
  }
  for (const { index, reference } of footnotes.missing) {
    problems.push({ index, kind: 'footnote', ...where(index), reference, message: `footnote has no definition: ${reference}` });
  }

  return problems
    .sort((a, b) => (a.index ?? -1) - (b.index ?? -1))
    .map(({ index, ...problem }) => problem);
}

/**
 * The ids in a page of HTML: what a `#anchor` link can lead to.
 * @param {string} html
 * @returns {Set<string>}
 */
function htmlIds(html = '') {
  const ids = new Set();
  const pattern = /\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) ids.add(match[1] ?? match[2]);
  return ids;
}

/**
 * One line per problem: `file:line: message`.
 * @param {{ file: string, line: number | null, message: string }} problem
 * @returns {string}
 */
function formatProblem(problem) {
  return `${problem.file}${problem.line ? `:${problem.line}` : ''}: ${problem.message}`;
}

/** The error a strict conversion ends with; `problems` holds what was found. */
class BrokenReferencesError extends Error {
  constructor(file, problems) {
    super(`${problems.length} broken reference${problems.length === 1 ? '' : 's'} in ${file}:\n${problems.map(problem => `  ${formatProblem(problem)}`).join('\n')}`);
    this.name = 'BrokenReferencesError';
    this.code = 'BROKEN_REFERENCES';
    this.problems = problems;
  }
}

module.exports = {
  BrokenReferencesError,
  findBrokenReferences,
  formatProblem,
  htmlIds
};
