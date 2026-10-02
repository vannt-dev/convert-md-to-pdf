const coverCss = require('./cover');
const modernTheme = require('./modern');
const darkTheme = require('./dark');
const academicTheme = require('./academic');
const githubTheme = require('./github');
const ebookTheme = require('./ebook');
const cyberpunkTheme = require('./cyberpunk');
const minimalTheme = require('./minimal');
const highlightCss = require('./highlight');

const THEMES = {
  modern: modernTheme,
  dark: darkTheme,
  academic: academicTheme,
  github: githubTheme,
  ebook: ebookTheme,
  cyberpunk: cyberpunkTheme,
  minimal: minimalTheme
};

// Themes whose code blocks sit on a dark background; the others use the light palette.
const DARK_CODE_THEMES = new Set(['modern', 'dark', 'ebook', 'cyberpunk']);

/**
 * Builds font override CSS string
 * @param {string} font 
 * @returns {string} CSS snippet
 */
function getFontOverrideCss(font) {
  if (!font) return '';
  if (font === 'Lora' || font === 'Merriweather') {
    return `body { font-family: '${font}', Georgia, serif !important; }\n`;
  }
  if (font === 'JetBrains Mono' || font === 'Fira Code') {
    return `body { font-family: '${font}', monospace !important; }\n`;
  }
  return `body { font-family: '${font}', sans-serif !important; }\n`;
}

/**
 * Returns complete CSS theme string with cover page and font override
 * @param {string} theme Name of theme
 * @param {string} [font] Font family override
 * @returns {string} Consolidated CSS string
 */
function getThemeStyles(theme, font = '') {
  const themeName = THEMES[theme] ? theme : 'modern';
  const themeCss = THEMES[themeName];
  const tokenCss = DARK_CODE_THEMES.has(themeName) ? highlightCss.dark : highlightCss.light;
  const fontOverrideCss = getFontOverrideCss(font);

  return `${coverCss}\n${fontOverrideCss}${themeCss}${tokenCss}`;
}

module.exports = {
  getThemeStyles,
  THEMES
};
