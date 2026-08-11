/**
 * E-Book Theme Styles
 */
module.exports = `
  body { font-family: 'Lora', Georgia, serif; font-size: 13.5px; line-height: 1.75; color: #2d3748; background: #fdfbf7; padding: 12px; }
  h1 { font-size: 23px; font-weight: 700; color: #1a202c; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #cbd5e0; padding-bottom: 8px; break-after: avoid-page; }
  h2 { font-size: 17px; font-weight: 600; color: #2b6cb0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 22px; break-after: avoid-page; }
  h3 { font-size: 14.5px; font-weight: 600; color: #2c5282; font-style: italic; break-after: avoid-page; }
  blockquote { font-style: italic; border-left: 3px solid #3182ce; background: #edf2f7; padding: 12px 18px; margin: 14px 0; border-radius: 0 4px 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12px; }
  tr { break-inside: avoid-page; }
  th { background: #ebf8ff; color: #2b6cb0; padding: 8px; border: 1px solid #bee3f8; }
  td { padding: 7px; border: 1px solid #e2e8f0; }
  code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; background: #edf2f7; color: #2d3748; padding: 2px 5px; border-radius: 3px; }
  pre { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; background: #2d3748; color: #f7fafc; padding: 12px; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
  .formula-box { background: #ebf8ff; border: 1px solid #bee3f8; padding: 10px; text-align: center; color: #2b6cb0; border-radius: 6px; }
  .mermaid-container { display: block; text-align: center; margin: 14px 0; background: #ffffff; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; overflow-x: auto; break-inside: avoid-page; }
  .mermaid { display: block; text-align: center; width: 100%; }
  .mermaid svg { max-width: 100% !important; height: auto !important; margin: 0 auto; display: inline-block; }
`;
