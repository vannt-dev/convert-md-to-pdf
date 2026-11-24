/*! SPDX-License-Identifier: MIT | Copyright (c) 2026 Van Nguyen | github.com/vannt-dev/convert-md-to-pdf */

/**
 * Formulas for the writers that do not go through a browser page: KaTeX's MathML, read into a
 * small tree, written back out as clean MathML for EPUB, or turned into Office Math (OMML) for
 * Word, where a formula is then a real equation that can be edited, not a picture of one.
 *
 * Only what KaTeX writes is read: elements, attributes, text and character references. Needs
 * nothing from Node, so the extension's Word export bundles it too.
 */

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function xml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : whole;
  });
}

/**
 * Reads the first `<math>` element of a piece of markup (KaTeX wraps it in a span).
 * @param {string} markup
 * @returns {{ name: string, attributes: Object, children: Object[] } | null} null when there is none
 *   or it is not well formed; a text node is `{ text }`
 */
function parseMathml(markup) {
  const start = String(markup || '').search(/<math[\s>]/);
  if (start === -1) return null;
  const source = markup.slice(start);
  const root = { name: '#root', attributes: {}, children: [] };
  const stack = [root];
  const TAG = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->/g;
  let last = 0;
  for (let match = TAG.exec(source); match; match = TAG.exec(source)) {
    const text = source.slice(last, match.index);
    if (text) stack[stack.length - 1].children.push({ text: decode(text) });
    last = TAG.lastIndex;
    if (match[0].startsWith('<!--')) continue;
    const [, closing, name, rawAttributes, selfClosing] = match;
    if (closing) {
      if (stack.length < 2 || stack[stack.length - 1].name !== name) return null;
      stack.pop();
      if (stack.length === 1) return root.children.find(child => child.name === 'math') || null;
      continue;
    }
    const attributes = {};
    for (const [, key, double, single] of rawAttributes.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes[key] = decode(double !== undefined ? double : single);
    }
    const element = { name, attributes, children: [] };
    stack[stack.length - 1].children.push(element);
    if (!selfClosing) stack.push(element);
  }
  return null;
}

/**
 * A formula as MathML for an XHTML page: well formed, with the TeX it was written as kept for
 * readers that cannot draw it.
 * @param {Object} math What parseMathml returned
 * @param {boolean} display On a line of its own
 * @returns {string}
 */
function serializeMathml(math, display) {
  const annotation = math.children.length === 1 && math.children[0].name === 'semantics'
    ? math.children[0].children.find(child => child.name === 'annotation')
    : null;
  const write = node => {
    if (node.text !== undefined) return xml(node.text);
    const attributes = Object.entries(node.attributes)
      .filter(([key]) => key !== 'xmlns' && key !== 'display')
      .map(([key, value]) => ` ${key}="${xml(value)}"`)
      .join('');
    const body = node.children.map(write).join('');
    return body ? `<${node.name}${attributes}>${body}</${node.name}>` : `<${node.name}${attributes}/>`;
  };
  const body = math.children.map(write).join('');
  // The TeX as the formula's alternative text, for readers that speak it.
  const alt = annotation ? ` alttext="${xml(textOf(annotation))}"` : '';
  return `<math xmlns="${MATHML_NS}"${display ? ' display="block"' : ''}${alt}>${body}</math>`;
}

// ---------------------------------------------------------------------------------------------
// MathML to Office Math

const elements = node => node.children.filter(child => child.name);
const textOf = node => (node.text !== undefined ? node.text : node.children.map(textOf).join(''));

// Operators drawn as an n-ary operator with its limits (a sum, an integral).
const NARY = new Set('∑∏∐∫∬∭∮∯∰∱∲∳⋀⋁⋂⋃⨀⨁⨂⨄⨆⨌'.split(''));
// Where the body of a sum or an integral ends: at a relation, a plus or minus, or punctuation.
const ENDS_OPERAND = new Set('=≠<>≤≥≈≡∼≃≅∝+−-±∓,;:→←↔⇒⇐⇔⟹⟸⟺∈∉⊂⊃⊆⊇'.split(''));
// The invisible operators of MathML (function application, invisible times and separator).
const INVISIBLE = /[⁡-⁤]/g;
// What Word draws an accent with: the combining form of each spacing accent KaTeX writes.
const ACCENTS = {
  '^': '̂', 'ˆ': '̂', '~': '̃', '˜': '̃', '¨': '̈', '˙': '̇',
  'ˉ': '̅', '¯': '̅', '´': '́', 'ˊ': '́', '`': '̀', 'ˋ': '̀',
  'ˇ': '̌', '˘': '̆', '˚': '̊', '→': '⃗', '←': '⃖', '⃗': '⃗'
};
const BARS = new Set(['‾', '¯', '_', '̲', '―', '─']);
const SCRIPTS = {
  'double-struck': 'double-struck', script: 'script', 'bold-script': 'script', fraktur: 'fraktur',
  'bold-fraktur': 'fraktur', 'sans-serif': 'sans-serif', 'bold-sans-serif': 'sans-serif',
  'sans-serif-italic': 'sans-serif', 'sans-serif-bold-italic': 'sans-serif', monospace: 'monospace'
};

const property = (name, value) => `<m:${name} m:val="${xml(value)}"/>`;
const wrap = (name, body) => (body ? `<m:${name}>${body}</m:${name}>` : `<m:${name}/>`);

/** One run of math text, upright or italic as MathML says. */
function mathRun(text, { style, script, normalText } = {}) {
  const value = text.replace(INVISIBLE, '');
  if (!value) return '';
  let properties = '';
  // Plain text, or a math style: Office Math takes one or the other.
  if (normalText) properties += '<m:nor/>';
  else {
    if (script) properties += property('scr', script);
    if (style) properties += property('sty', style);
  }
  return (
    `<m:r>${properties ? `<m:rPr>${properties}</m:rPr>` : ''}` +
    '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>' +
    `<m:t xml:space="preserve">${xml(value)}</m:t></m:r>`
  );
}

function identifierRun(node) {
  const text = textOf(node);
  const variant = node.attributes.mathvariant;
  // MathML draws a one-letter name in italics and a longer one (sin, log) upright.
  const style =
    { normal: 'p', bold: 'b', italic: 'i', 'bold-italic': 'bi', 'bold-script': 'b', 'bold-fraktur': 'b', 'bold-sans-serif': 'b' }[variant] ||
    (SCRIPTS[variant] ? 'p' : [...text].length > 1 ? 'p' : undefined);
  return mathRun(text, { style, script: SCRIPTS[variant] });
}

/** The operator at the heart of an element (the ∑ of a sum with limits), or null. */
function baseOperator(node) {
  if (!node || !node.name) return null;
  if (node.name === 'mo') return textOf(node).trim();
  if (['msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'].includes(node.name)) {
    return baseOperator(elements(node)[0]);
  }
  if (node.name === 'mrow' || node.name === 'mstyle') {
    const children = elements(node);
    return children.length === 1 ? baseOperator(children[0]) : null;
  }
  return null;
}

const isNary = node => NARY.has(baseOperator(node));
const isFunctionApplication = node => node && node.name === 'mo' && textOf(node).trim() === '⁡';
const endsOperand = node => node.name === 'mo' && ENDS_OPERAND.has(textOf(node).trim());

/** The parts of a sum or an integral: its symbol, where its limits sit, and the limits. */
function naryParts(node) {
  let current = node;
  while ((current.name === 'mrow' || current.name === 'mstyle') && elements(current).length === 1) current = elements(current)[0];
  const [, first, second] = elements(current);
  const parts = { chr: baseOperator(current), sub: null, sup: null, location: 'subSup' };
  switch (current.name) {
    case 'msub': parts.sub = first; break;
    case 'msup': parts.sup = first; break;
    case 'msubsup': parts.sub = first; parts.sup = second; break;
    case 'munder': parts.sub = first; parts.location = 'undOvr'; break;
    case 'mover': parts.sup = first; parts.location = 'undOvr'; break;
    case 'munderover': parts.sub = first; parts.sup = second; parts.location = 'undOvr'; break;
    default: break;
  }
  return parts;
}

function nary(node, operand) {
  const { chr, sub, sup, location } = naryParts(node);
  return (
    '<m:nary><m:naryPr>' +
    property('chr', chr) +
    property('limLoc', location) +
    (sub ? '' : property('subHide', '1')) +
    (sup ? '' : property('supHide', '1')) +
    '</m:naryPr>' +
    wrap('sub', sub ? convert(sub) : '') +
    wrap('sup', sup ? convert(sup) : '') +
    wrap('e', operand) +
    '</m:nary>'
  );
}

/**
 * A row of MathML elements. A sum or an integral takes the terms after it as its body, and a
 * function name (sin, log, lim) followed by the invisible function application takes its argument.
 */
function sequence(nodes) {
  const list = nodes.filter(node => node.name);
  let output = '';
  for (let index = 0; index < list.length; index++) {
    const node = list[index];
    if (isFunctionApplication(list[index + 1])) {
      const argument = list[index + 2];
      output += `<m:func><m:fName>${convert(node)}</m:fName>${wrap('e', argument ? convert(argument) : '')}</m:func>`;
      index += argument ? 2 : 1;
      continue;
    }
    if (isNary(node)) {
      let end = index + 1;
      while (end < list.length && !endsOperand(list[end]) && !isNary(list[end])) end++;
      output += nary(node, sequence(list.slice(index + 1, end)));
      index = end - 1;
      continue;
    }
    output += convert(node);
  }
  return output;
}

const isFence = node => node && node.name === 'mo' && node.attributes.fence === 'true';

/** A row between \left and \right: one delimiter object, so the brackets grow with it. */
function delimited(children) {
  const open = textOf(children[0]).trim();
  const close = textOf(children[children.length - 1]).trim();
  return (
    '<m:d><m:dPr>' +
    property('begChr', open) +
    property('endChr', close) +
    '</m:dPr>' +
    wrap('e', sequence(children.slice(1, -1))) +
    '</m:d>'
  );
}

function table(node) {
  const rows = elements(node).filter(row => row.name === 'mtr' || row.name === 'mlabeledtr');
  // A numbered row's first cell is its label.
  const cells = rows.map(row => elements(row).slice(row.name === 'mlabeledtr' ? 1 : 0));
  const columns = Math.max(1, ...cells.map(row => row.length));
  const aligns = (node.attributes.columnalign || '').split(/\s+/).filter(Boolean);
  const alignOf = column => ({ left: 'left', right: 'right' }[aligns[Math.min(column, aligns.length - 1)]] || 'center');
  const columnProperties = Array.from({ length: columns }, (_, column) =>
    `<m:mc><m:mcPr>${property('count', '1')}${property('mcJc', alignOf(column))}</m:mcPr></m:mc>`
  ).join('');
  const body = cells
    .map(row => {
      const filled = Array.from({ length: columns }, (_, column) => (row[column] ? convert(row[column]) : ''));
      return `<m:mr>${filled.map(cell => wrap('e', cell)).join('')}</m:mr>`;
    })
    .join('');
  return `<m:m><m:mPr><m:mcs>${columnProperties}</m:mcs></m:mPr>${body}</m:m>`;
}

function underOver(node) {
  const [base, first, second] = elements(node);
  if (node.name === 'munderover') {
    // A sum on its own, without a body: still an n-ary operator.
    if (isNary(node)) return nary(node, '');
    const lower = `<m:limLow><m:e>${convert(base)}</m:e>${wrap('lim', convert(first))}</m:limLow>`;
    return `<m:limUpp><m:e>${lower}</m:e>${wrap('lim', convert(second))}</m:limUpp>`;
  }
  if (isNary(node)) return nary(node, '');
  const top = node.name === 'mover';
  const mark = first && first.name === 'mo' ? textOf(first).trim() : null;
  const accent = node.attributes[top ? 'accent' : 'accentunder'] === 'true';
  if (mark && BARS.has(mark)) {
    return `<m:bar><m:barPr>${property('pos', top ? 'top' : 'bot')}</m:barPr>${wrap('e', convert(base))}</m:bar>`;
  }
  if (top && accent && mark && [...mark].length === 1) {
    return `<m:acc><m:accPr>${property('chr', ACCENTS[mark] || mark)}</m:accPr>${wrap('e', convert(base))}</m:acc>`;
  }
  if (mark && first.attributes.stretchy === 'true') {
    // A brace or an arrow drawn over or under the whole of its base.
    return (
      `<m:groupChr><m:groupChrPr>${property('chr', mark)}${property('pos', top ? 'top' : 'bot')}` +
      `${property('vertJc', top ? 'bot' : 'top')}</m:groupChrPr>${wrap('e', convert(base))}</m:groupChr>`
    );
  }
  const name = top ? 'limUpp' : 'limLow';
  return `<m:${name}>${wrap('e', convert(base))}${wrap('lim', convert(first))}</m:${name}>`;
}

function space(node) {
  const match = /^(-?[\d.]+)em$/.exec(node.attributes.width || '');
  const width = match ? parseFloat(match[1]) : 0;
  if (width <= 0) return '';
  // Thin, medium, en and em spaces stand for the widths TeX puts between symbols.
  const character = width < 0.2 ? ' ' : width < 0.3 ? ' ' : width < 0.75 ? ' ' : ' ';
  return mathRun(width >= 1.5 ? character.repeat(Math.round(width)) : character, { style: 'p' });
}

/**
 * One MathML element as Office Math.
 * @param {Object} node
 * @returns {string}
 */
function convert(node) {
  if (!node || !node.name) return '';
  const children = elements(node);
  const [first, second, third] = children;
  switch (node.name) {
    case 'math':
    case 'semantics':
      // What is drawn, without the TeX source kept beside it.
      return sequence(children.filter(child => !/^annotation/.test(child.name)));
    case 'mrow':
      if (children.length >= 2 && isFence(children[0]) && isFence(children[children.length - 1])) return delimited(children);
      return sequence(children);
    case 'mstyle':
    case 'mpadded':
    case 'mtd':
    case 'merror':
    case 'menclose':
      if (node.name === 'menclose' && /\bbox\b/.test(node.attributes.notation || '')) return `<m:borderBox>${wrap('e', sequence(children))}</m:borderBox>`;
      return sequence(children);
    case 'mphantom':
      return `<m:phant>${wrap('e', sequence(children))}</m:phant>`;
    case 'mi':
      return identifierRun(node);
    case 'mn':
      return mathRun(textOf(node), { style: 'p' });
    case 'mo':
      return mathRun(textOf(node), { style: 'p' });
    case 'mtext':
    case 'ms':
      return mathRun(textOf(node), { style: 'p', normalText: true });
    case 'mspace':
      return space(node);
    case 'mfrac': {
      const thickness = node.attributes.linethickness;
      const noBar = thickness !== undefined && parseFloat(thickness) === 0;
      return `<m:f>${noBar ? `<m:fPr>${property('type', 'noBar')}</m:fPr>` : ''}${wrap('num', convert(first))}${wrap('den', convert(second))}</m:f>`;
    }
    case 'msqrt':
      return `<m:rad><m:radPr>${property('degHide', '1')}</m:radPr><m:deg/>${wrap('e', sequence(children))}</m:rad>`;
    case 'mroot':
      return `<m:rad>${wrap('deg', convert(second))}${wrap('e', convert(first))}</m:rad>`;
    case 'msup':
      if (isNary(node)) return nary(node, '');
      return `<m:sSup>${wrap('e', convert(first))}${wrap('sup', convert(second))}</m:sSup>`;
    case 'msub':
      if (isNary(node)) return nary(node, '');
      return `<m:sSub>${wrap('e', convert(first))}${wrap('sub', convert(second))}</m:sSub>`;
    case 'msubsup':
      if (isNary(node)) return nary(node, '');
      return `<m:sSubSup>${wrap('e', convert(first))}${wrap('sub', convert(second))}${wrap('sup', convert(third))}</m:sSubSup>`;
    case 'munder':
    case 'mover':
    case 'munderover':
      return underOver(node);
    case 'mtable':
      return table(node);
    default:
      // Anything else: what it holds.
      return sequence(children);
  }
}

/**
 * A formula as Office Math, for a Word document.
 * @param {Object} math What parseMathml returned
 * @param {boolean} display On a line of its own: an equation paragraph, not one inside the text
 * @param {string} [align] Where an equation paragraph sits: `center`, `left` or `right`
 * @returns {string} an `m:oMath`, or an `m:oMathPara` holding one
 */
function mathmlToOmml(math, display, align = 'center') {
  const body = `<m:oMath>${convert(math)}</m:oMath>`;
  return display ? `<m:oMathPara><m:oMathParaPr>${property('jc', align)}</m:oMathParaPr>${body}</m:oMathPara>` : body;
}

module.exports = {
  mathmlToOmml,
  parseMathml,
  serializeMathml
};
