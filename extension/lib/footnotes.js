/**
 * Markdown footnotes: `text[^id]` in the body, `[^id]: note` anywhere on a line of its own.
 *
 * Works on the Markdown text, before it is parsed, and needs nothing from Node: the same file
 * is shipped in the extension as extension/lib/footnotes.js (a test keeps the two identical).
 */
(function (scope) {
  const DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
  const REFERENCE = /\[\^([^\]\s]+)\]/g;
  const FENCE = /^ {0,3}(`{3,}|~{3,})/;
  const CONTINUATION = /^(?: {2,}|\t)\S/;

  /**
   * Splits the text into lines tagged as code or prose. Footnote syntax inside a fenced
   * block is an example of the syntax, not a footnote.
   * @param {string} markdown
   * @returns {{ text: string, code: boolean }[]}
   */
  function tagLines(markdown) {
    const lines = [];
    let fence = null;
    for (const text of markdown.split(/\r?\n/)) {
      const match = FENCE.exec(text);
      if (fence) {
        lines.push({ text, code: true });
        if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
      } else if (match) {
        fence = match[1];
        lines.push({ text, code: true });
      } else {
        lines.push({ text, code: false });
      }
    }
    return lines;
  }

  /**
   * Applies `replace` to the parts of a line that are not inline code.
   * @param {string} line
   * @param {(prose: string) => string} replace
   * @returns {string}
   */
  function outsideInlineCode(line, replace) {
    return line
      .split(/(`+[^`]*`+)/)
      .map((part, index) => (index % 2 === 1 ? part : replace(part)))
      .join('');
  }

  /**
   * Numbers the footnotes of a Markdown document in the order they are first referenced,
   * replaces each reference with a superscript link, and appends the notes as a list.
   *
   * A reference to a note that is never defined is left as the author typed it; a note that
   * is never referenced is left out, as GitHub does.
   * @param {string} markdown
   * @returns {string} Markdown, with HTML for the references and the notes section
   */
  function applyFootnotes(markdown = '') {
    if (!markdown || markdown.indexOf('[^') === -1) return markdown;

    const lines = tagLines(markdown);
    const definitions = new Map();
    const body = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const match = line.code ? null : DEFINITION.exec(line.text);
      if (!match) {
        body.push(line);
        continue;
      }
      const parts = [match[2].trim()];
      // Indented lines that follow belong to the note.
      while (
        index + 1 < lines.length &&
        !lines[index + 1].code &&
        CONTINUATION.test(lines[index + 1].text)
      ) {
        index += 1;
        parts.push(lines[index].text.trim());
      }
      // The first definition of an id wins, as with link reference definitions.
      if (!definitions.has(match[1])) definitions.set(match[1], parts.join(' ').trim());
    }

    if (definitions.size === 0) return markdown;

    const numbers = new Map();
    const uses = new Map();
    const text = body
      .map((line) => {
        if (line.code) return line.text;
        return outsideInlineCode(line.text, (prose) =>
          prose.replace(REFERENCE, (whole, id) => {
            if (!definitions.has(id)) return whole;
            if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
            const number = numbers.get(id);
            const use = (uses.get(id) || 0) + 1;
            uses.set(id, use);
            const anchor = use === 1 ? `fnref-${number}` : `fnref-${number}-${use}`;
            return `<sup class="footnote-ref"><a href="#fn-${number}" id="${anchor}">${number}</a></sup>`;
          })
        );
      })
      .join('\n');

    if (numbers.size === 0) return text;

    const notes = Array.from(numbers.entries()).map(([id, number]) => {
      const note = definitions.get(id);
      return `${number}. <span id="fn-${number}"></span>${note} <a href="#fnref-${number}" class="footnote-backref" aria-label="Back to the text">↩</a>`;
    });

    // The blank lines let Markdown inside the section be parsed as Markdown.
    return `${text.replace(/\s+$/, '')}\n\n<section class="footnotes">\n\n${notes.join('\n')}\n\n</section>\n`;
  }

  const api = { applyFootnotes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.MdPdfFootnotes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
