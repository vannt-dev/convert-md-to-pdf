/**
 * Cover Page CSS Styles
 */
module.exports = `
  .cover-page { min-height: 85vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 40px 20px; break-after: page; page-break-after: always; }
  .cover-page-inner { max-width: 650px; width: 100%; border: 2px solid #2563eb; padding: 40px 30px; border-radius: 8px; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
  .cover-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #2563eb; background: #eff6ff; padding: 4px 12px; border-radius: 20px; margin-bottom: 20px; }
  .cover-title { font-size: 28px !important; font-weight: 800 !important; color: #0f172a !important; line-height: 1.3 !important; margin-bottom: 12px !important; border: none !important; padding: 0 !important; text-transform: none !important; }
  .cover-subtitle { font-size: 16px !important; font-weight: 500 !important; color: #475569 !important; margin-bottom: 24px !important; border: none !important; background: none !important; padding: 0 !important; }
  .cover-divider { height: 3px; width: 80px; background: linear-gradient(90deg, #2563eb, #38bdf8); margin: 0 auto 24px auto; border-radius: 2px; }
  .cover-meta-container { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #64748b; align-items: center; }
  .cover-meta-item { display: flex; gap: 8px; }
  .cover-meta-label { font-weight: 600; color: #334155; }
`;
