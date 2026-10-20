/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */
/**
 * Command line helpers for options whose value could be mistaken for an input file.
 */
const fs = require('fs');
const { InvalidArgumentError } = require('commander');

const PAGE_NUMBER_STYLES = ['full', 'simple'];
const INPUT_FILE = /\.(md|markdown|txt)$/i;

/**
 * `--page-numbers` takes an optional style. Only a known style is read as its value, so in
 * `--page-numbers README.md` the file stays an input: the flag is given its default instead.
 * @param {string[]} argv process.argv
 * @returns {string[]}
 */
function normalizePageNumbersArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      out.push(...argv.slice(i));
      break;
    }
    if (arg === '--page-numbers') {
      const next = argv[i + 1];
      if (next !== undefined && PAGE_NUMBER_STYLES.includes(next.toLowerCase())) {
        out.push(`--page-numbers=${next.toLowerCase()}`);
        i++;
      } else {
        out.push('--page-numbers=full');
      }
      continue;
    }
    out.push(arg);
  }
  return out;
}

/**
 * Value check for `--header <text>` and `--footer <text>`. An empty string turns them off.
 * A value that names an existing Markdown file is refused: it is almost always an input file
 * that followed the flag, as in `md2pdf --header README.md`.
 * @param {string} value
 * @returns {string}
 */
function parseMarginText(value) {
  if (INPUT_FILE.test(value) && fs.existsSync(value) && fs.statSync(value).isFile()) {
    throw new InvalidArgumentError(
      `"${value}" is an input file, not header/footer text. Give the text right after the flag, ` +
        `e.g. --header "{title}" ${value}`
    );
  }
  return value;
}

module.exports = {
  PAGE_NUMBER_STYLES,
  normalizePageNumbersArgs,
  parseMarginText
};
