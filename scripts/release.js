const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetVerArg = process.argv[2];

if (!targetVerArg) {
  console.error('\x1b[31m✖ Error:\x1b[0m Please specify version number or bump type.');
  console.error('   Usage: npm run release <version|patch|minor|major>');
  console.error('   Example: npm run release 1.2.0');
  console.error('   Example: npm run release patch');
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const manifestPath = path.join(__dirname, '..', 'extension', 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let currentVersion = pkg.version || '1.0.0';
let newVersion = currentVersion;

if (targetVerArg === 'patch' || targetVerArg === 'minor' || targetVerArg === 'major') {
  const parts = currentVersion.split('.').map(Number);
  if (targetVerArg === 'patch') parts[2] = (parts[2] || 0) + 1;
  if (targetVerArg === 'minor') { parts[1] = (parts[1] || 0) + 1; parts[2] = 0; }
  if (targetVerArg === 'major') { parts[0] = (parts[0] || 0) + 1; parts[1] = 0; parts[2] = 0; }
  newVersion = parts.join('.');
} else {
  newVersion = targetVerArg.replace(/^v/, '');
}

console.log(`\x1b[36m🚀 Starting Release Workflow for Version \x1b[33mv${newVersion}\x1b[0m (Current: v${currentVersion})...\n`);

try {
  // 1. Run pre-commit validation checks
  console.log('🔍 Step 1: Running Pre-Commit Verification...');
  execSync('node scripts/pre-commit.js', { stdio: 'inherit' });

  // 2. Update version in package.json & manifest.json
  console.log('📝 Step 2: Updating version in package.json and manifest.json...');
  pkg.version = newVersion;
  manifest.version = newVersion;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // 3. Build versioned extension zip
  console.log('📦 Step 3: Building Versioned Extension Zip...');
  execSync('node scripts/build-extension.js', { stdio: 'inherit' });

  // 4. Git Stage & Commit
  console.log('\n🌿 Step 4: Creating Git Release Commit & Tag...');
  const commitMsg = `chore(release): bump version to v${newVersion}`;
  const tagName = `v${newVersion}`;

  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });

  console.log(`\n\x1b[32m✔ Release v${newVersion} committed and tagged locally!\x1b[0m`);

  // 5. Push to GitHub Remote
  console.log('\n⬆️ Step 5: Pushing Release & Tags to GitHub Remote...');
  execSync('git push origin main --tags', { stdio: 'inherit' });

  console.log(`\n\x1b[32m✨ Release v${newVersion} successfully pushed to GitHub!\x1b[0m`);
  console.log(`   Uploaded file ready at: \x1b[33mdist/extension-v${newVersion}.zip\x1b[0m\n`);
} catch (err) {
  console.error('\n\x1b[31m✖ Release workflow failed:\x1b[0m', err.message);
  process.exit(1);
}
