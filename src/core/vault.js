/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
const fs = require('fs');
const path = require('path');
const { parseFrontMatter } = require('./frontmatter');

/**
 * Finding the notes and pictures that Obsidian wikilinks and embeds name, for the CLI.
 *
 * A name is looked for relative to the folder of the file it is in (`[[Note]]` is `Note.md`
 * beside it, `[[sub/Note]]` is in `sub/`), then relative to the vault: the nearest folder above
 * that holds `.obsidian`. Last, as Obsidian does, anywhere in the vault by its name, so a picture
 * kept in an attachments folder is found too.
 */

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const NOTE_EXTENSIONS = ['.md', '.markdown'];
// A vault is searched up to this many files, leaving out hidden folders and node_modules.
const MAX_VAULT_FILES = 20000;
const vaultFiles = new Map();

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch (_) {
    return false;
  }
}

/** Paths compare without regard to case on Windows and macOS file systems. */
function samePathKey(file) {
  const resolved = path.resolve(file);
  return process.platform === 'win32' || process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

/**
 * The vault a file is in: the nearest folder at or above it that holds `.obsidian`.
 * @param {string} dir
 * @returns {string | null}
 */
function findVaultRoot(dir) {
  let current = path.resolve(dir);
  for (;;) {
    try {
      if (fs.statSync(path.join(current, '.obsidian')).isDirectory()) return current;
    } catch (_) {
      // Not here.
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Every file of a vault, as paths relative to its root with `/` between the parts.
 * Read once per vault for each run.
 * @param {string} root
 * @returns {string[]}
 */
function listVault(root) {
  if (vaultFiles.has(root)) return vaultFiles.get(root);
  const found = [];
  const pending = [''];
  while (pending.length && found.length < MAX_VAULT_FILES) {
    const dir = pending.shift();
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const relative = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) pending.push(relative);
      else if (entry.isFile()) found.push(relative);
    }
  }
  vaultFiles.set(root, found);
  return found;
}

/** A file of the vault whose path ends with `name`, nearest the root first. */
function searchVault(root, names) {
  const files = listVault(root);
  for (const name of names) {
    const wanted = `/${name.replace(/\\/g, '/').replace(/^\.?\//, '')}`.toLowerCase();
    const match = files.find(file => `/${file}`.toLowerCase().endsWith(wanted));
    if (match) return path.join(root, match);
  }
  return null;
}

/**
 * The file a wikilink or embed names.
 * @param {string} name As written, e.g. `Note`, `sub/Note`, `picture.png`
 * @param {string[]} dirs Folders to look in, in order
 * @param {{ note?: boolean, vaultRoot?: string | null }} [options] note: a name without an
 *   extension is a Markdown note; vaultRoot: then search that vault by name
 * @returns {string | null}
 */
function findFile(name, dirs, options = {}) {
  if (!name || name.includes('\0')) return null;
  const candidates = [name];
  if (options.note && !NOTE_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
    candidates.unshift(`${name}.md`);
  }
  for (const dir of dirs) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const file = path.resolve(dir, candidate);
      if (isFile(file)) return file;
    }
  }
  return options.vaultRoot ? searchVault(options.vaultRoot, candidates) : null;
}

/** The note a transclusion names, or null when it is not a Markdown file that can be read. */
function findNote(name, fromFile, vaultRoot) {
  const file = findFile(name, [path.dirname(fromFile), vaultRoot], { note: true, vaultRoot });
  return file && NOTE_EXTENSIONS.includes(path.extname(file).toLowerCase()) ? file : null;
}

/**
 * The text of the first heading of a note, outside code blocks.
 * @param {string} file
 * @returns {string}
 */
function firstHeading(file) {
  let text;
  try {
    text = parseFrontMatter(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).content;
  } catch (_) {
    return '';
  }
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const fenceMatch = FENCE.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    const match = /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (match) return match[1];
  }
  return '';
}

/**
 * What the Obsidian syntax of one converted document leads to.
 * @param {string} filePath The document converted
 * @param {string[]} [files] The files put into it (`@import` and transclusions): a link to one of
 *   them leads to its place in this output
 * @returns {{ resolveNote: Function, resolveImage: Function }} see obsidian.js markedExtension
 */
function createVaultResolver(filePath, files = []) {
  const main = path.resolve(filePath);
  const baseDir = path.dirname(main);
  const vaultRoot = findVaultRoot(baseDir);
  const here = new Set([main, ...files].map(samePathKey));
  // The folders of the files put in come after the document's own, so their pictures are found too.
  const dirs = [...new Set([baseDir, ...files.map(file => path.dirname(path.resolve(file))), vaultRoot].filter(Boolean))];
  const relative = file => path.relative(baseDir, file).split(path.sep).join('/');

  return {
    resolveNote(name) {
      const file = findFile(name, dirs, { note: true, vaultRoot });
      if (!file) return null;
      if (here.has(samePathKey(file))) return { here: true, firstHeading: firstHeading(file), href: relative(file) };
      return { href: relative(file) };
    },
    resolveImage(name) {
      const file = findFile(name, dirs, { vaultRoot });
      return file ? relative(file) : null;
    }
  };
}

module.exports = {
  createVaultResolver,
  findNote,
  findVaultRoot
};
