# 📄 convert-md-to-pdf

> A powerful CLI tool and Node.js module to convert Markdown (`.md`) files into beautifully styled, high-quality PDF documents. Built with support for **Mermaid.js diagrams**, **LaTeX Math**, **ASCII UI Mockups**, **CJK & Vietnamese Typography**, and **Multiple Themes**.

![npm version](https://img.shields.io/npm/v/convert-md-to-pdf?color=blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🎨 **Multiple Preset Themes**: `modern` (default), `dark`, `academic`, and `minimal`.
- 📊 **Mermaid Diagrams**: Native sequence diagrams, flowcharts, class diagrams, and gantt charts.
- 📐 **LaTeX Math Support**: Mathematical equations rendered with KaTeX.
- 💻 **ASCII UI Mockups**: Styled dark-theme boxes for terminal output & ASCII wireframe mockups.
- 🌏 **Full CJK & Vietnamese Support**: Pre-configured with Google Fonts (`Inter`, `Noto Sans JP`, `JetBrains Mono`).
- 📃 **Smart Page Breaking**: Prevents orphan headings (`break-after: avoid`) and manages table/code block pagination.
- 🚀 **Zero Heavy Dependencies**: Uses system installed Microsoft Edge or Google Chrome via headless mode.

---

## 📦 Installation

### Global Installation via npm / npx
```bash
npm install -g convert-md-to-pdf
```
or run directly with `npx`:
```bash
npx convert-md-to-pdf input.md
```

---

## 🚀 Quick Start (CLI Usage)

Convert a Markdown file to PDF with default settings:
```bash
npx convert-md-to-pdf input.md
# Generates input.pdf in the same directory
```

Specify custom output file name:
```bash
npx convert-md-to-pdf document.md output.pdf
```

Use a different theme (e.g. `dark`, `academic`, `minimal`):
```bash
npx convert-md-to-pdf report.md -t dark
```

Set paper size and landscape orientation:
```bash
npx convert-md-to-pdf spec.md -p Letter --landscape
```

---

## 🛠️ CLI Options

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `-t, --theme <theme>` | | Theme: `modern`, `dark`, `academic`, `minimal` | `modern` |
| `-p, --page-size <size>`| | Paper size: `A4`, `Letter`, `A3`, `Legal` | `A4` |
| `-l, --landscape` | | Use landscape page orientation | `false` |
| `-m, --margin <margin>`| | Custom page margin (e.g. `15mm`) | `14mm 12mm 16mm 12mm` |
| `-k, --keep-html` | | Keep temporary HTML file after conversion | `false` |
| `--no-mermaid` | | Disable Mermaid diagram rendering | `false` |
| `--no-katex` | | Disable KaTeX math formula rendering | `false` |
| `-b, --browser <path>` | | Custom Chrome/Edge binary path | Auto-detected |
| `-v, --version` | | Output tool version | |
| `-h, --help` | | Display CLI help menu | |

---

## 💻 Programmatic Node.js API

You can also use `convert-md-to-pdf` as a Node.js library in your own applications:

```javascript
const { convertMarkdownToPdf } = require('convert-md-to-pdf');

async function buildPdf() {
  const result = await convertMarkdownToPdf('path/to/input.md', 'path/to/output.pdf', {
    theme: 'modern',
    pageSize: 'A4',
    orientation: 'portrait'
  });

  console.log('Generated PDF at:', result.pdfPath);
}

buildPdf();
```

---

## 📁 Repository Structure

```
convert-md-to-pdf/
├── bin/
│   └── cli.js            # Executable CLI script
├── src/
│   ├── index.js          # Library entrypoint
│   ├── parser.js         # Markdown & math parsing logic
│   ├── browser.js        # Chrome/Edge detector & PDF renderer
│   ├── templates.js      # HTML templates & theme styles
│   └── utils.js          # Preprocessing & helper functions
├── examples/
│   └── sample.md         # Example test document
├── package.json
└── README.md
```

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
