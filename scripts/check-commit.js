const fs = require('fs');
const path = require('path');

const commitMsgFile = process.argv[2];
let commitMsg = '';

if (commitMsgFile && fs.existsSync(commitMsgFile)) {
  commitMsg = fs.readFileSync(commitMsgFile, 'utf8').trim();
} else if (process.argv[2]) {
  commitMsg = process.argv[2].trim();
}

if (!commitMsg) {
  console.error('\x1b[31m✖ Error:\x1b[0m No commit message provided to check.');
  process.exit(1);
}

// Ignore merge commits
if (commitMsg.startsWith('Merge branch') || commitMsg.startsWith('Merge pull request')) {
  process.exit(0);
}

const commitPattern = /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([a-z0-9_.-]+\))?: .+/i;

if (!commitPattern.test(commitMsg)) {
  console.error('\n\x1b[31m✖ Invalid Commit Message Format!\x1b[0m');
  console.error(`   Provided: "\x1b[33m${commitMsg}\x1b[0m"`);
  console.error('\n\x1b[36m💡 Standard Conventional Commit Format:\x1b[0m');
  console.error('   <type>(<scope>): <short description>\n');
  console.error('   Valid types: feat, fix, docs, style, refactor, perf, test, chore, build, ci');
  console.error('   Examples:');
  console.error('     • \x1b[32mfeat(extension): add Auto TOC checkbox\x1b[0m');
  console.error('     • \x1b[32mfix(cli): resolve input path wildcard pattern\x1b[0m');
  console.error('     • \x1b[32mdocs(store): update submission guide\x1b[0m\n');
  process.exit(1);
}

console.log(`\x1b[32m✔ Valid Commit Message:\x1b[0m "${commitMsg}"`);
process.exit(0);
