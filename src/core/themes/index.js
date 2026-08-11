const coverCss = require('./cover');
const modernTheme = require('./modern');
const darkTheme = require('./dark');
const academicTheme = require('./academic');
const githubTheme = require('./github');
const ebookTheme = require('./ebook');
const cyberpunkTheme = require('./cyberpunk');
const minimalTheme = require('./minimal');

const THEMES = {
  modern: modernTheme,
  dark: darkTheme,
  academic: academicTheme,
  github: githubTheme,
  ebook: ebookTheme,
  cyberpunk: cyberpunkTheme,
  minimal: minimalTheme
};

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
  const themeCss = THEMES[theme] || THEMES.modern;
  const fontOverrideCss = getFontOverrideCss(font);

  return `${coverCss}\n${fontOverrideCss}${themeCss}`;
}

module.exports = {
  getThemeStyles,
  THEMES
};
