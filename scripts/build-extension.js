const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extDir = path.join(__dirname, '..', 'extension');
const zipPath = path.join(__dirname, '..', 'extension.zip');

if (!fs.existsSync(extDir)) {
  console.error('Error: extension directory does not exist.');
  process.exit(1);
}

try {
  console.log('📦 Bundling Browser Extension into extension.zip...');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  const cmd = `powershell -Command "Compress-Archive -Path '${extDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(cmd, { stdio: 'inherit' });

  const stat = fs.statSync(zipPath);
  console.log(`✔ Success! Built extension.zip (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
} catch (err) {
  console.error('✖ Error bundling extension:', err.message);
  process.exit(1);
}
