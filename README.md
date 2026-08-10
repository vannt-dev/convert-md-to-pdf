# 📄 convert-md-to-pdf

> A powerful CLI tool and **Chrome Extension (Manifest V3)** to convert Markdown (`.md`) files, raw text, or web pages into beautifully styled, high-quality PDF documents. Built with support for **Mermaid.js diagrams**, **LaTeX Math**, **ASCII UI Mockups**, **CJK & Vietnamese Typography**, and **Multiple Themes**.

![npm version](https://img.shields.io/npm/v/convert-md-to-pdf?color=blue)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🧩 **Chrome Extension (Manifest V3)**:
  - Drag & drop `.md` files or paste raw Markdown directly into the extension popup.
  - Convert active web page or GitHub raw Markdown files with 1 click.
  - Context menu integration: Right-click selected Markdown text or any page -> "Convert to PDF".
  - Interactive full-page Print Preview with live theme switching and native Chrome PDF export.
- 🎨 **Multiple Preset Themes**: `modern` (default), `dark`, `academic`, and `minimal`.
- 📊 **Mermaid Diagrams**: Native sequence diagrams, flowcharts, class diagrams, and gantt charts.
- 📐 **LaTeX Math Support**: Mathematical equations rendered with KaTeX.
- 💻 **ASCII UI Mockups**: Styled dark-theme boxes for terminal output & ASCII wireframe mockups.
- 🌏 **Full CJK & Vietnamese Support**: Pre-configured with Google Fonts (`Inter`, `Noto Sans JP`, `JetBrains Mono`).
- 📃 **Smart Page Breaking**: Prevents orphan headings (`break-after: avoid`) and manages table/code block pagination.

---

## 🌐 Chrome Extension Installation & Usage

### How to Install in Google Chrome:
1. Clone or download this repository:
   ```bash
   git clone https://github.com/vannt-dev/convert-md-to-pdf.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (Tải tiện ích đã giải nén).
5. Select the **`chrome-extension`** directory inside this repository.
6. The **Markdown to PDF Converter** icon will appear in your Chrome toolbar!

### Chrome Extension Features:
- **Popup UI**: Click the extension icon to upload `.md` files, paste text, or grab current tab markdown.
- **Context Menu**: Highlight any text on any webpage -> Right-click -> *Convert selected text to PDF*.
- **Floating Button**: Automatically shows a floating *Convert to PDF* button on GitHub raw `.md` pages.

---

## 💻 CLI Installation & Usage

### Global Installation via npm / npx
```bash
npm install -g convert-md-to-pdf
```
or run directly with `npx`:
```bash
npx convert-md-to-pdf input.md
```

### CLI Quick Examples:
```bash
# Convert a Markdown file with default theme
npx convert-md-to-pdf input.md

# Specify output PDF name and theme
npx convert-md-to-pdf document.md output.pdf -t dark

# Set paper size & orientation
npx convert-md-to-pdf spec.md -p Letter --landscape
```

---

## 🛠️ CLI Options Table

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

---

## 📁 Repository Structure

```
convert-md-to-pdf/
├── chrome-extension/     # Manifest V3 Chrome Extension source
│   ├── manifest.json
│   ├── popup/            # Popup UI (HTML, CSS, JS)
│   ├── background/       # Service worker & context menus
│   ├── content/          # Content script for raw MD pages
│   ├── preview/          # Print preview & export page
│   ├── lib/              # Vendor libraries (marked, mermaid, katex)
│   └── icons/            # Extension icons
├── bin/
│   └── cli.js            # Executable CLI script
├── src/
│   ├── index.js          # Node.js Library entrypoint
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
