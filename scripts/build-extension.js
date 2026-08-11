const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const extDir = path.join(__dirname, '..', 'extension');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(extDir)) {
  console.error('Error: extension directory does not exist.');
  process.exit(1);
}

// Create dist directory if not exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Read version from manifest.json
const manifestPath = path.join(extDir, 'manifest.json');
let version = '1.0.0';
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    version = manifest.version || '1.0.0';
  } catch (e) {}
}

const versionZipName = `extension-v${version}.zip`;
const versionZipPath = path.join(distDir, versionZipName);
const latestZipPath = path.join(distDir, 'extension-latest.zip');
const rootZipPath = path.join(__dirname, '..', 'extension.zip');

try {
  console.log(`📦 Bundling Extension Version \x1b[36mv${version}\x1b[0m...`);

  // Remove existing zip files if present
  if (fs.existsSync(versionZipPath)) fs.unlinkSync(versionZipPath);
  if (fs.existsSync(latestZipPath)) fs.unlinkSync(latestZipPath);
  if (fs.existsSync(rootZipPath)) fs.unlinkSync(rootZipPath);

  // Compress extension directory using adm-zip (Cross-Platform for Windows/Linux/macOS)
  const zip = new AdmZip();
  zip.addLocalFolder(extDir);
  zip.writeZip(versionZipPath);

  // Copy to latest zip & root zip for convenience
  fs.copyFileSync(versionZipPath, latestZipPath);
  fs.copyFileSync(versionZipPath, rootZipPath);

  const stat = fs.statSync(versionZipPath);
  console.log(`\n\x1b[32m✔ Success!\x1b[0m Built Extension ZIP (Cross-Platform):`);
  console.log(`   Version Zip: \x1b[33m${path.relative(process.cwd(), versionZipPath)}\x1b[0m (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`   Latest Zip:  \x1b[33m${path.relative(process.cwd(), latestZipPath)}\x1b[0m`);
} catch (err) {
  console.error('\x1b[31m✖ Error bundling extension:\x1b[0m', err.message);
  process.exit(1);
}
