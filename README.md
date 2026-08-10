# 📄 convert-md-to-pdf

> A powerful CLI tool and **Browser Extension (Manifest V3)** to convert Markdown (`.md`) files, raw text, or web pages into beautifully styled, high-quality PDF documents. Built with support for **Mermaid.js diagrams**, **LaTeX Math**, **Auto Table of Contents (TOC)**, **Custom CSS Injection**, **CJK & Vietnamese Typography**, and **Multiple Themes**.

![npm version](https://img.shields.io/npm/v/convert-md-to-pdf?color=blue)
![Browser Extension](https://img.shields.io/badge/Extension-Manifest_V3-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🧩 **Browser Extension (Manifest V3)**:
  - Drag & drop `.md` files or paste raw Markdown directly into the extension popup.
  - Auto-saved draft text in popup & conversion history list with 1-click re-open.
  - Convert active web page or GitHub raw Markdown files with 1 click.
  - Context menu integration: Right-click selected Markdown text or any page -> "Convert to PDF".
  - Full-page Print Preview with live theme switching, Auto TOC, Custom CSS, and native PDF export.
- 🚀 **CLI & Batch Conversion**: Convert single files or batch process directories with wildcard patterns.
- 📋 **Auto Table of Contents (TOC)**: Auto-generates interactive clickable TOC with anchor links (`--toc`).
- 🎨 **Custom CSS Injection**: Inject custom branding CSS stylesheets (`-c, --css custom.css`).
- 🎨 **4 Preset Themes**: `modern` (default), `dark`, `academic`, and `minimal`.
- 📊 **Mermaid Diagrams**: Native sequence diagrams, flowcharts, class diagrams, and gantt charts.
- 📐 **LaTeX Math Support**: Mathematical equations rendered with KaTeX.
- 💻 **ASCII UI Mockups**: Styled dark-theme boxes for terminal output & ASCII wireframe mockups.
- 🌏 **Full CJK & Vietnamese Support**: Pre-configured with Google Fonts (`Inter`, `Noto Sans JP`, `JetBrains Mono`).

---

## 🌐 Extension Installation & Usage

### How to Install in Google Chrome / Microsoft Edge / Brave:
1. Clone or download this repository:
   ```bash
   git clone https://github.com/vannt-dev/convert-md-to-pdf.git
   ```
2. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (Tải tiện ích đã giải nén).
5. Select the **`extension`** directory inside this repository.
6. The **Markdown to PDF Converter** icon will appear in your browser toolbar!

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

### CLI Examples:
```bash
# Convert a Markdown file with Auto TOC & Custom CSS
npx convert-md-to-pdf input.md --toc -c custom.css -o output.pdf

# Batch convert multiple files to an output directory
npx convert-md-to-pdf file1.md file2.md -o output_dir/

# Convert entire directory of .md files
npx convert-md-to-pdf ./docs/ -o ./dist/
```

---

## 🛠️ CLI Options

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `-o, --output <path>`| | Output PDF file path or target directory | Auto-derived |
| `-t, --theme <theme>` | | Theme: `modern`, `dark`, `academic`, `minimal` | `modern` |
| `-p, --page-size <size>`| | Paper size: `A4`, `Letter`, `A3`, `Legal` | `A4` |
| `-l, --landscape` | | Use landscape page orientation | `false` |
| `-m, --margin <margin>`| | Custom page margin (e.g. `15mm`) | `14mm 12mm 16mm 12mm` |
| `--toc` | | Auto-generate Table of Contents (TOC) | `false` |
| `-c, --css <path>` | | Custom CSS stylesheet file path to inject | |
| `-k, --keep-html` | | Keep temporary HTML file after conversion | `false` |
| `--no-mermaid` | | Disable Mermaid diagram rendering | `false` |
| `--no-katex` | | Disable KaTeX math formula rendering | `false` |

---

## 🌿 Git Workflow & Contribution

Please review our [Git Commit & Push Workflow Guide (GIT_WORKFLOW.md)](GIT_WORKFLOW.md) for conventional commit guidelines, branching strategies, and pre-commit checks.

---

## 📁 Project Architecture

```
convert-md-to-pdf/
├── bin/
│   └── cli.js               # Clean CLI executable
├── src/
│   ├── core/                # Shared conversion engine
│   │   ├── index.js         # Core library API
│   │   ├── parser.js        # Markdown, Math & TOC parser
│   │   ├── templates.js     # Theme manager & HTML templates
│   │   └── utils.js         # Preprocessors & helper utilities
│   └── browser/             # Headless browser rendering engine
│       └── renderer.js      # Headless Chrome/Edge launcher & PDF printer
├── extension/               # Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/          # Service worker & context menus
│   ├── content/             # Content script for raw MD pages
│   ├── popup/               # Extension Popup UI (File, Paste, Page, History)
│   ├── preview/             # Print Preview & PDF export page
│   ├── lib/                 # Vendor libraries (marked, mermaid, katex)
│   └── icons/               # Extension icons (16, 48, 128)
├── store-assets/            # Chrome Web Store submission kit
│   ├── icons/               # Pixel-perfect 128x128 store icons
│   ├── banners/             # Pixel-perfect 440x280 promo banners
│   ├── screenshots/         # Pixel-perfect 1280x800 screenshots
│   └── STORE_LISTING.md     # Store listing metadata & submission guide
├── examples/                # Usage examples & custom CSS templates
│   ├── sample.md
│   └── custom.css
├── scripts/                 # Build & maintenance scripts
│   ├── build-extension.js   # Extension bundler script
│   └── fetch-vendor-libs.js # Vendor library sync script
├── package.json
├── README.md
├── PRIVACY_POLICY.md
└── GIT_WORKFLOW.md
```

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
