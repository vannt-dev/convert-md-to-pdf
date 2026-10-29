/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Project config file for the command line: `.mdpdfrc` (or `.mdpdfrc.json`), plain JSON whose
 * keys are the long option names in camelCase. It sets defaults below the front matter:
 * flags > front matter > config file > built-in defaults.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_NAMES = ['.mdpdfrc', '.mdpdfrc.json'];

const STRING = 'string';
const BOOLEAN = 'boolean';
const TEXT = 'text'; // a string, or true/false as in the front matter
const PAGE_NUMBERS = 'pageNumbers';

/** Every key the file may hold, with the kind of value it takes. */
const CONFIG_KEYS = {
  output: STRING,
  format: STRING,
  theme: STRING,
  font: STRING,
  cover: BOOLEAN,
  pageSize: STRING,
  landscape: BOOLEAN,
  margin: STRING,
  toc: BOOLEAN,
  pageNumbers: PAGE_NUMBERS,
  header: TEXT,
  footer: TEXT,
  watermark: STRING,
  css: STRING,
  keepHtml: BOOLEAN,
  mermaid: BOOLEAN,
  katex: BOOLEAN,
  highlight: BOOLEAN,
  include: BOOLEAN,
  outline: BOOLEAN,
  browser: STRING
};

/** Paths in the file are relative to the file's folder. */
const PATH_KEYS = ['output', 'css', 'browser'];

/** The front matter keys that set the same thing as an option, where the names differ. */
const FRONT_MATTER_KEYS = {
  landscape: ['landscape', 'orientation'],
  css: ['cssFile', 'css']
};
/** Options that front matter cannot set: the config file always applies to them. */
const NOT_IN_FRONT_MATTER = ['output', 'format', 'keepHtml', 'include', 'browser'];

/**
 * The config file that applies to `startDir`: `.mdpdfrc` or `.mdpdfrc.json` in that folder or
 * the nearest parent. The search stops at the folder holding `.git` (the repository root).
 * @param {string} startDir
 * @returns {string | null}
 */
function findConfigFile(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    const parent = path.dirname(dir);
    if (fs.existsSync(path.join(dir, '.git')) || parent === dir) return null;
    dir = parent;
  }
}

function checkValue(file, key, value) {
  const kind = CONFIG_KEYS[key];
  const fail = (expected) => {
    throw new Error(`${file}: "${key}" must be ${expected}, not ${JSON.stringify(value)}`);
  };
  if (kind === STRING && typeof value !== 'string') fail('a string');
  if (kind === BOOLEAN && typeof value !== 'boolean') fail('true or false');
  if (kind === TEXT && typeof value !== 'string' && typeof value !== 'boolean') fail('a string, true or false');
  if (kind === PAGE_NUMBERS && ![true, false, 'full', 'simple'].includes(value)) {
    fail('true, false, "full" or "simple"');
  }
}

/**
 * Reads a config file. A key the tool does not know is left out with a warning; a file that
 * is not JSON, or a value of the wrong kind, is an error.
 * @param {string} file
 * @returns {{ config: Object, warnings: string[] }}
 */
function loadConfig(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Config file not found: ${file}`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${file} must hold a JSON object of options, e.g. { "theme": "github" }`);
  }

  const config = {};
  const warnings = [];
  for (const [key, value] of Object.entries(data)) {
    if (!Object.prototype.hasOwnProperty.call(CONFIG_KEYS, key)) {
      warnings.push(`${file}: unknown key "${key}" is ignored`);
      continue;
    }
    checkValue(file, key, value);
    config[key] = PATH_KEYS.includes(key) && value !== '' ? path.resolve(path.dirname(file), value) : value;
  }
  return { config, warnings };
}

/**
 * The options for one file: a flag given on the command line wins; otherwise a key the
 * file's front matter sets is left out, so the front matter decides; otherwise the config
 * file's value. Keys missing from the result fall back to the built-in defaults.
 * @param {Object} flags options given on the command line
 * @param {Object} config options from the config file
 * @param {Object} frontMatter the file's front matter
 * @returns {Object}
 */
function layerOptions(flags, config, frontMatter = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(config), ...Object.keys(flags)])) {
    if (flags[key] !== undefined) {
      result[key] = flags[key];
      continue;
    }
    const setByFrontMatter =
      !NOT_IN_FRONT_MATTER.includes(key) && (FRONT_MATTER_KEYS[key] || [key]).some((name) => frontMatter[name] !== undefined);
    if (config[key] !== undefined && !setByFrontMatter) result[key] = config[key];
  }
  return result;
}

module.exports = {
  CONFIG_KEYS,
  CONFIG_NAMES,
  findConfigFile,
  layerOptions,
  loadConfig
};
