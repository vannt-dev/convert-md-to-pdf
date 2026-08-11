/**
 * Front Matter Parser Utility
 */

/**
 * Parses YAML Front Matter from Markdown raw content
 * @param {string} rawContent 
 * @returns {{ data: Object, content: string }}
 */
function parseFrontMatter(rawContent = '') {
  if (!rawContent || typeof rawContent !== 'string') {
    return { data: {}, content: '' };
  }

  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = rawContent.match(frontMatterRegex);

  if (!match) {
    return { data: {}, content: rawContent };
  }

  const yamlBlock = match[1];
  const content = rawContent.slice(match[0].length);
  const data = {};

  yamlBlock.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) return;

    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();

    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    // Convert booleans & numbers
    if (val.toLowerCase() === 'true') val = true;
    else if (val.toLowerCase() === 'false') val = false;
    else if (!isNaN(val) && val !== '') val = Number(val);

    data[key] = val;
  });

  return { data, content };
}

module.exports = {
  parseFrontMatter
};
