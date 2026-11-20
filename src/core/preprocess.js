/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */

// Pure text rules, without file access: the Word writer that the extension bundles uses them too.

/**
 * Preprocesses Markdown content before parsing:
 * - Transforms GitHub Callouts/Alerts (> [!NOTE], > [!TIP], etc.)
 * - Transforms pagebreak comments (<!-- pagebreak --> or \pagebreak)
 * - Converts simple LaTeX arrow/math symbols
 * @param {string} mdContent 
 * @param {{ mathProtected?: boolean }} [options] mathProtected: the formulas were already taken
 *   out (math.js protectMath), so a `$$` still in the text is code and stays as written
 * @returns {string} Preprocessed markdown string
 */
function preprocessMarkdown(mdContent = '', options = {}) {
  if (!mdContent) return '';

  const processed = mdContent
    // GitHub Callouts / Alerts
    .replace(/^>[ \t]*\[!NOTE\][ \t]*(?:\r?\n>[ \t]?)?/gm, '> **ℹ️ NOTE:** ')
    .replace(/^>[ \t]*\[!TIP\][ \t]*(?:\r?\n>[ \t]?)?/gm, '> **💡 TIP:** ')
    .replace(/^>[ \t]*\[!WARNING\][ \t]*(?:\r?\n>[ \t]?)?/gm, '> **⚠️ WARNING:** ')
    .replace(/^>[ \t]*\[!IMPORTANT\][ \t]*(?:\r?\n>[ \t]?)?/gm, '> **❗ IMPORTANT:** ')
    .replace(/^>[ \t]*\[!CAUTION\][ \t]*(?:\r?\n>[ \t]?)?/gm, '> **🚫 CAUTION:** ')
    // Pagebreaks
    .replace(/<!--\s*page-?break\s*-->/gi, '<div class="page-break"></div>')
    .replace(/\\pagebreak/gi, '<div class="page-break"></div>')
    // LaTeX math symbols
    .replace(/\\longrightarrow/g, '⟶')
    .replace(/\\rightarrow/g, '→')
    .replace(/\$→\$/g, '→')
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\\longrightarrow\$/g, '⟶')
    .replace(/\$\\ge\$/g, '≥')
    .replace(/\$\\le\$/g, '≤')
    .replace(/\$x\/y\$/g, 'x/y')
    .replace(/\$x < y\$/g, 'x < y')
    .replace(/\$x = y\$/g, 'x = y')
    // Formula box transformation
    .replace(/\$\$\s*\\text\{([^}]+)\}\s*=\s*\\text\{([^}]+)\}\s*-\s*\\text\{([^}]+)\}\s*\$\$/g, 
      '<div class="formula-box"><strong>$1</strong> = <span>$2</span> &minus; <span>$3</span></div>');
  if (options.mathProtected) return processed;
  return processed.replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<div class="formula-box">$1</div>');
}

module.exports = {
  preprocessMarkdown
};
