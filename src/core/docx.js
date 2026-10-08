const { buildDocument, collectHeadings, isPortableLink, plainText } = require('./docmodel');
const { readLocalImage } = require('./images');
const { createZip } = require('./zip');

/**
 * Markdown to Word (.docx), written from the document model rather than from
 * HTML: headings, lists, tables, code and quotes become real Word styles and
 * structures, which a reader can restyle, instead of formatted lookalikes.
 *
 * Not carried over: themes and custom CSS, Mermaid diagrams (kept as their
 * source), and LaTeX math (kept as typed). Images are embedded when they are
 * local PNG, JPEG or GIF files; any other image is named with its address.
 */

const TWIPS_PER_MM = 1440 / 25.4;
const EMU_PER_PIXEL = 9525;
const EMU_PER_TWIP = 635;
const PAGE_SIZES = { A4: [11906, 16838], LETTER: [12240, 15840], A3: [16838, 23811], LEGAL: [12240, 20160] };
const HEADING_SIZES = [36, 30, 26, 24, 22, 22];
const CODE_FONT = 'Consolas';

function xml(text) {
  return String(text)
    // Characters XML 1.0 cannot carry at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `14mm 12mm 16mm 12mm` (top right bottom left, as in CSS) in twips. */
function parseMargins(margin) {
  const parts = String(margin || '').trim().split(/\s+/).map(part => {
    const match = /^([\d.]+)(mm|cm|in|pt|px)?$/.exec(part);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const factor = { mm: TWIPS_PER_MM, cm: TWIPS_PER_MM * 10, in: 1440, pt: 20, px: 15 }[match[2] || 'mm'];
    return Math.round(value * factor);
  });
  if (!parts.length || parts.some(part => part === null)) return parseMargins('14mm 12mm 16mm 12mm');
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left };
}

function bookmarkName(id) {
  return `h_${id.replace(/[^\w]/g, '_')}`.slice(0, 40);
}

class DocxWriter {
  constructor(document, baseDir) {
    this.document = document;
    this.baseDir = baseDir;
    this.relationships = [];
    this.media = [];
    this.orderedLists = [];
    this.bookmarks = new Map();
    this.drawingId = 0;

    const { settings } = document;
    const [width, height] = PAGE_SIZES[String(settings.pageSize).toUpperCase()] || PAGE_SIZES.A4;
    const landscape = settings.orientation === 'landscape';
    this.page = { width: landscape ? height : width, height: landscape ? width : height, landscape };
    this.margins = parseMargins(settings.margin);
    this.contentWidth = this.page.width - this.margins.left - this.margins.right;

    // Bookmark names are cut to Word's limit, so two long headings could collide.
    const taken = new Set();
    for (const heading of collectHeadings(document.blocks)) {
      let name = bookmarkName(heading.id);
      for (let suffix = 2; taken.has(name); suffix++) name = `${bookmarkName(heading.id).slice(0, 36)}_${suffix}`;
      taken.add(name);
      this.bookmarks.set(heading.id, { id: taken.size, name });
    }
  }

  relationship(type, target, external = false) {
    const id = `rId${this.relationships.length + 1}`;
    this.relationships.push({ id, type, target, external });
    return id;
  }

  runProperties(run, extra = '') {
    let properties = extra;
    if (run.code) {
      properties += `<w:rFonts w:ascii="${CODE_FONT}" w:hAnsi="${CODE_FONT}" w:cs="${CODE_FONT}"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>`;
    }
    if (run.bold) properties += '<w:b/>';
    if (run.italic) properties += '<w:i/>';
    if (run.strike) properties += '<w:strike/>';
    if (run.sup) properties += '<w:vertAlign w:val="superscript"/>';
    else if (run.sub) properties += '<w:vertAlign w:val="subscript"/>';
    return properties ? `<w:rPr>${properties}</w:rPr>` : '';
  }

  textRun(run, extra = '') {
    // A tab or newline inside text is its own element in Word.
    const pieces = run.text.split(/(\t|\n)/).map(piece => {
      if (piece === '\t') return '<w:tab/>';
      if (piece === '\n') return '<w:br/>';
      return piece ? `<w:t xml:space="preserve">${xml(piece)}</w:t>` : '';
    });
    return `<w:r>${this.runProperties(run, extra)}${pieces.join('')}</w:r>`;
  }

  imageRun(run) {
    const image = readLocalImage(run.image.src, this.baseDir);
    if (!image || !image.size || !['png', 'jpg', 'gif'].includes(image.extension)) {
      // Not a file Word can hold: say what was there instead of dropping it silently.
      const label = run.image.alt ? `${run.image.alt} (${run.image.src})` : run.image.src;
      return this.textRun({ text: `[${label}]`, italic: true });
    }
    const name = `image${this.media.length + 1}.${image.extension}`;
    this.media.push({ name, data: image.data });
    const relationshipId = this.relationship(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
      `media/${name}`
    );
    const maxWidth = this.contentWidth * EMU_PER_TWIP;
    let cx = image.size.width * EMU_PER_PIXEL;
    let cy = image.size.height * EMU_PER_PIXEL;
    if (cx > maxWidth) {
      cy = Math.round(cy * (maxWidth / cx));
      cx = maxWidth;
    }
    const id = ++this.drawingId;
    const alt = xml(run.image.alt || name);
    return (
      '<w:r><w:drawing>' +
      `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="Picture ${id}" descr="${alt}"/>` +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(name)}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    );
  }

  /** Runs, with neighbouring runs of one link wrapped in a single hyperlink. */
  runs(runs) {
    let output = '';
    for (let index = 0; index < runs.length; ) {
      const href = runs[index].href;
      let end = index;
      while (end < runs.length && runs[end].href === href) end += 1;
      const group = runs.slice(index, end);
      const body = group
        .map(run => {
          if (run.lineBreak) return '<w:r><w:br/></w:r>';
          if (run.image) return this.imageRun(run);
          return this.textRun(run, href ? '<w:rStyle w:val="Hyperlink"/>' : '');
        })
        .join('');
      if (!href) {
        output += body;
      } else if (href[0] === '#') {
        const bookmark = this.bookmarks.get(decodeURIComponentSafe(href.slice(1)));
        output += bookmark ? `<w:hyperlink w:anchor="${xml(bookmark.name)}" w:history="1">${body}</w:hyperlink>` : body;
      } else if (!isPortableLink(href)) {
        // A path to a file next to the Markdown leads nowhere from a Word document.
        output += body;
      } else {
        const id = this.relationship('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', href, true);
        output += `<w:hyperlink r:id="${id}" w:history="1">${body}</w:hyperlink>`;
      }
      index = end;
    }
    return output;
  }

  paragraph(content, { style, indent, numbering, bookmark } = {}) {
    let properties = '';
    if (style) properties += `<w:pStyle w:val="${style}"/>`;
    if (numbering) properties += `<w:numPr><w:ilvl w:val="${numbering.level}"/><w:numId w:val="${numbering.id}"/></w:numPr>`;
    if (indent) properties += `<w:ind w:left="${indent.left}"${indent.hanging ? ` w:hanging="${indent.hanging}"` : ''}/>`;
    const mark = bookmark
      ? `<w:bookmarkStart w:id="${bookmark.id}" w:name="${xml(bookmark.name)}"/><w:bookmarkEnd w:id="${bookmark.id}"/>`
      : '';
    return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${mark}${content}</w:p>`;
  }

  /**
   * @param {Object[]} blocks
   * @param {{ quote: number, list: number, numbering: Object | null }} context
   *   How deep in quotes and lists the blocks are; `numbering` is set for the
   *   first paragraph of a list item only, which is the one that carries the marker.
   */
  blocks(blocks, context = { quote: 0, list: -1, numbering: null }) {
    let output = '';
    let numbering = context.numbering;
    const base = context.quote * 360 + (context.list + 1) * 720;
    const plainIndent = base > 0 ? { left: base } : undefined;
    const takeNumbering = () => {
      const current = numbering;
      numbering = null;
      return current;
    };

    for (const block of blocks) {
      switch (block.type) {
        case 'heading': {
          output += this.paragraph(this.runs(block.runs), {
            style: `Heading${Math.min(block.depth, 6)}`,
            indent: plainIndent,
            bookmark: this.bookmarks.get(block.id)
          });
          break;
        }
        case 'paragraph': {
          const marker = takeNumbering();
          const prefix = marker && marker.checkbox ? this.textRun({ text: `${marker.checkbox} ` }) : '';
          output += this.paragraph(prefix + this.runs(block.runs), {
            style: context.quote > 0 ? 'Quote' : undefined,
            numbering: marker ? { id: marker.id, level: context.list } : undefined,
            indent: marker ? { left: base, hanging: 360 } : plainIndent
          });
          break;
        }
        case 'code': {
          const lines = block.text.replace(/\t/g, '    ').split(/\r?\n/);
          for (const line of lines) {
            output += this.paragraph(line ? `<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>` : '', {
              style: 'CodeBlock',
              indent: plainIndent
            });
          }
          // Two code blocks in a row would otherwise merge into one shaded box.
          output += this.paragraph('', { style: 'CodeSpacer' });
          break;
        }
        case 'quote':
          output += this.blocks(block.blocks, { quote: context.quote + 1, list: context.list, numbering: null });
          break;
        case 'list': {
          const level = Math.min(context.list + 1, 8);
          let id = 1; // the shared bullet list
          if (block.ordered) {
            this.orderedLists.push({ level, start: block.start });
            id = this.orderedLists.length + 1;
          }
          for (const item of block.items) {
            const checkbox = item.checked === null ? null : item.checked ? '☑' : '☐';
            const content = item.blocks.length ? item.blocks : [{ type: 'paragraph', runs: [] }];
            // An item that opens with something other than text still needs a line for its marker.
            const lead = content[0].type === 'paragraph' ? [] : [{ type: 'paragraph', runs: [] }];
            output += this.blocks([...lead, ...content], { quote: context.quote, list: level, numbering: { id, checkbox } });
          }
          break;
        }
        case 'table':
          output += this.table(block);
          break;
        case 'rule':
          output += this.paragraph('', { style: 'Rule' });
          break;
        case 'pageBreak':
          output += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
          break;
        default:
          break;
      }
    }
    return output;
  }

  table(block) {
    const columns = Math.max(block.header.length, 1);
    const width = Math.floor(this.contentWidth / columns);
    const border = name => `<w:${name} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
    const cell = (source, header) => {
      const align = { center: 'center', right: 'right' }[source.align];
      const runs = header ? source.runs.map(run => (run.text !== undefined ? { ...run, bold: true } : run)) : source.runs;
      return (
        `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>` +
        (header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '') +
        `</w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/>${align ? `<w:jc w:val="${align}"/>` : ''}</w:pPr>` +
        `${this.runs(runs)}</w:p></w:tc>`
      );
    };
    const row = (cells, header) =>
      `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map(source => cell(source, header)).join('')}</w:tr>`;
    return (
      '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('') +
      '</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
      `<w:tblGrid>${`<w:gridCol w:w="${width}"/>`.repeat(columns)}</w:tblGrid>` +
      row(block.header, true) +
      block.rows.map(cells => row(cells, false)).join('') +
      '</w:tbl>' +
      // Word needs a paragraph between a table and whatever follows it.
      this.paragraph('', { style: 'CodeSpacer' })
    );
  }

  cover() {
    const { meta } = this.document;
    let output = this.paragraph(this.textRun({ text: meta.title }), { style: 'Title' });
    if (meta.subtitle) output += this.paragraph(this.textRun({ text: meta.subtitle }), { style: 'Subtitle' });
    for (const line of [meta.author, meta.date]) {
      if (line) output += this.paragraph(this.textRun({ text: String(line) }), { style: 'CoverLine' });
    }
    return `${output}<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  }

  contents() {
    const headings = collectHeadings(this.document.blocks).filter(heading => heading.depth <= 3);
    if (!headings.length) return '';
    let output = this.paragraph(this.textRun({ text: 'Table of Contents' }), { style: 'ContentsTitle' });
    for (const heading of headings) {
      const run = { text: plainText(heading.runs), href: `#${heading.id}` };
      output += this.paragraph(this.runs([run]), { style: 'ContentsEntry', indent: { left: (heading.depth - 1) * 360 } });
    }
    return output;
  }

  documentXml() {
    const { settings, blocks } = this.document;
    let body = this.blocks(blocks);
    if (settings.toc) {
      // After the title when the document opens with one, as in the PDF.
      const contents = this.contents();
      const titleEnd = blocks[0] && blocks[0].type === 'heading' && blocks[0].depth === 1 ? body.indexOf('</w:p>') + 6 : 0;
      body = body.slice(0, titleEnd) + contents + body.slice(titleEnd);
    }
    if (settings.cover) body = this.cover() + body;
    const { page, margins } = this;
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      `<w:body>${body}<w:sectPr>` +
      `<w:pgSz w:w="${page.width}" w:h="${page.height}"${page.landscape ? ' w:orient="landscape"' : ''}/>` +
      `<w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="708" w:footer="708" w:gutter="0"/>` +
      '</w:sectPr></w:body></w:document>'
    );
  }

  stylesXml() {
    // Inter, the default of the PDF output, is rarely installed where Word runs, and Word
    // would put a serif face in its place. A font that was asked for is used as named.
    const chosen = this.document.settings.font;
    const font = xml(!chosen || chosen === 'Inter' ? 'Calibri' : chosen);
    const paragraphStyle = (id, name, paragraph, run, basedOn = 'Normal') =>
      `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
      (basedOn ? `<w:basedOn w:val="${basedOn}"/>` : '') +
      `<w:qFormat/>${paragraph ? `<w:pPr>${paragraph}</w:pPr>` : ''}${run ? `<w:rPr>${run}</w:rPr>` : ''}</w:style>`;
    const headings = HEADING_SIZES.map((size, index) =>
      paragraphStyle(
        `Heading${index + 1}`,
        `heading ${index + 1}`,
        `<w:keepNext/><w:spacing w:before="${index === 0 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${index}"/>`,
        `<w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`
      )
    ).join('');
    const codeShade = '<w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
      '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      headings +
      paragraphStyle('Title', 'Title', '<w:spacing w:before="2400" w:after="240"/><w:jc w:val="center"/>', '<w:b/><w:sz w:val="56"/><w:szCs w:val="56"/>') +
      paragraphStyle('Subtitle', 'Subtitle', '<w:spacing w:after="480"/><w:jc w:val="center"/>', '<w:color w:val="595959"/><w:sz w:val="32"/><w:szCs w:val="32"/>') +
      paragraphStyle('CoverLine', 'Cover Line', '<w:jc w:val="center"/>', '<w:color w:val="595959"/>') +
      paragraphStyle('Quote', 'Quote', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr>', '<w:color w:val="595959"/>') +
      paragraphStyle(
        'CodeBlock',
        'Code Block',
        `<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${codeShade}`,
        `<w:rFonts w:ascii="${CODE_FONT}" w:hAnsi="${CODE_FONT}" w:cs="${CODE_FONT}"/><w:sz w:val="19"/><w:szCs w:val="19"/>`
      ) +
      paragraphStyle('CodeSpacer', 'Code Spacer', '<w:spacing w:after="0" w:line="120" w:lineRule="exact"/>', '<w:sz w:val="8"/>') +
      paragraphStyle('TableText', 'Table Text', '<w:spacing w:before="40" w:after="40"/>', '') +
      paragraphStyle('Rule', 'Rule', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr><w:spacing w:after="240"/>', '') +
      paragraphStyle('ContentsTitle', 'Contents Title', '<w:spacing w:before="240" w:after="120"/>', '<w:b/><w:sz w:val="28"/><w:szCs w:val="28"/>') +
      paragraphStyle('ContentsEntry', 'Contents Entry', '<w:spacing w:after="60"/>', '') +
      '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
      '</w:styles>'
    );
  }

  numberingXml() {
    const bullets = ['•', '◦', '▪'];
    const formats = ['decimal', 'lowerLetter', 'lowerRoman'];
    const level = (index, format, text) =>
      `<w:lvl w:ilvl="${index}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/>` +
      `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${(index + 1) * 720}" w:hanging="360"/></w:pPr></w:lvl>`;
    const levels = make => Array.from({ length: 9 }, (_, index) => make(index)).join('');
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(index => level(index, 'bullet', bullets[index % 3]))}</w:abstractNum>` +
      `<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>${levels(index => level(index, formats[index % 3], `%${index + 1}.`))}</w:abstractNum>` +
      '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
      // One numbering instance per ordered list, so each starts where its Markdown says.
      this.orderedLists
        .map(
          (list, index) =>
            `<w:num w:numId="${index + 2}"><w:abstractNumId w:val="2"/>` +
            `<w:lvlOverride w:ilvl="${list.level}"><w:startOverride w:val="${list.start}"/></w:lvlOverride></w:num>`
        )
        .join('') +
      '</w:numbering>'
    );
  }

  build() {
    const { meta } = this.document;
    // The body first: it is what registers images, links and lists.
    const documentXml = this.documentXml();
    const numberingXml = this.numberingXml();
    this.relationship('http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', 'styles.xml');
    this.relationship('http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', 'numbering.xml');

    const extensions = [...new Set(this.media.map(file => file.name.split('.').pop()))];
    const imageTypes = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif' };
    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      extensions.map(extension => `<Default Extension="${extension}" ContentType="${imageTypes[extension]}"/>`).join('') +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';
    const packageRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>';
    const documentRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      this.relationships
        .map(
          relation =>
            `<Relationship Id="${relation.id}" Type="${relation.type}" Target="${xml(relation.target)}"${relation.external ? ' TargetMode="External"' : ''}/>`
        )
        .join('') +
      '</Relationships>';
    const core =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${xml(meta.title)}</dc:title>${meta.author ? `<dc:creator>${xml(meta.author)}</dc:creator>` : ''}` +
      '</cp:coreProperties>';

    return createZip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: packageRels },
      { name: 'docProps/core.xml', data: core },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: this.stylesXml() },
      { name: 'word/numbering.xml', data: numberingXml },
      { name: 'word/_rels/document.xml.rels', data: documentRels },
      ...this.media.map(file => ({ name: `word/media/${file.name}`, data: file.data, store: true }))
    ]);
  }
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

/**
 * Converts Markdown to the bytes of a .docx file.
 * @param {string} rawMarkdown
 * @param {Object} [options] The converter's options, plus `baseDir`: the folder images are relative to
 * @returns {Buffer}
 */
function markdownToDocx(rawMarkdown, options = {}) {
  return new DocxWriter(buildDocument(rawMarkdown, options), options.baseDir).build();
}

module.exports = {
  markdownToDocx
};
