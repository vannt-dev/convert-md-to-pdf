/**
 * Syntax Highlighting Token Colors
 * Two palettes, picked by the background each theme gives its code blocks.
 */
// Inline-code chrome must not repeat on every line of a block.
const base = `
  pre code { background: none; padding: 0; border: none; }
`;

const light = `
  .hljs-comment, .hljs-quote, .hljs-meta { color: #6e7781; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-template-tag { color: #cf222e; }
  .hljs-string, .hljs-regexp, .hljs-char.escape_ { color: #0a3069; }
  .hljs-number, .hljs-literal, .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-symbol, .hljs-bullet { color: #0550ae; }
  .hljs-title, .hljs-section, .hljs-selector-id, .hljs-selector-class { color: #8250df; }
  .hljs-type, .hljs-built_in, .hljs-params { color: #953800; }
  .hljs-name, .hljs-tag { color: #116329; }
  .hljs-addition { color: #116329; background-color: #dafbe1; }
  .hljs-deletion { color: #82071e; background-color: #ffebe9; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }
`;

const dark = `
  .hljs-comment, .hljs-quote, .hljs-meta { color: #8b949e; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-template-tag { color: #ff7b72; }
  .hljs-string, .hljs-regexp, .hljs-char.escape_ { color: #a5d6ff; }
  .hljs-number, .hljs-literal, .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-symbol, .hljs-bullet { color: #79c0ff; }
  .hljs-title, .hljs-section, .hljs-selector-id, .hljs-selector-class { color: #d2a8ff; }
  .hljs-type, .hljs-built_in, .hljs-params { color: #ffa657; }
  .hljs-name, .hljs-tag { color: #7ee787; }
  .hljs-addition { color: #aff5b4; background-color: #033a16; }
  .hljs-deletion { color: #ffdcd7; background-color: #67060c; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }
`;

module.exports = { light: base + light, dark: base + dark };
