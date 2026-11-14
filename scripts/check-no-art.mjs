// Guard: this module ships no art. Refuses image and video files anywhere in the repository, and keeps build output
// and the PF2e checkout cache out of git.
// Checks staged files (pre-commit hook), or every tracked file with --all (CI).
import { execFileSync } from 'node:child_process';

const FORBIDDEN = [
  { pattern: /^scripts\/\.cache\//, reason: 'PF2e checkout cache' },
  { pattern: /^dist\//, reason: 'build output' },
  { pattern: /\.zip$/i, reason: 'package archive' },
  { pattern: /\.(webp|png|jpe?g|gif|avif|bmp|tiff?|svg|webm|mp4|m4v|ogv)$/i, reason: 'art (this module ships none)' },
];

const args = process.argv.includes('--all') ? ['ls-files'] : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];
const files = execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

const blocked = files.flatMap((file) => {
  const rule = FORBIDDEN.find(({ pattern }) => pattern.test(file));
  return rule ? [{ file, reason: rule.reason }] : [];
});
if (blocked.length) {
  console.error('These files must not be committed:');
  for (const { file, reason } of blocked) console.error(`  ${file} (${reason})`);
  console.error('Unstage with: git restore --staged <file>');
  process.exit(1);
}
