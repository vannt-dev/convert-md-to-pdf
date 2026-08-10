const { execSync } = require('child_process');

console.log('\x1b[36m🔍 Running Pre-Commit Checks...\x1b[0m\n');

try {
  console.log('1. Testing CLI Conversion Engine...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('\n2. Verifying Extension Build...');
  execSync('node scripts/build-extension.js', { stdio: 'inherit' });
  console.log('\n\x1b[32m✨ All pre-commit checks passed successfully!\x1b[0m\n');
} catch (err) {
  console.error('\n\x1b[31m✖ Pre-commit checks failed! Please fix the errors before committing.\x1b[0m\n');
  process.exit(1);
}
