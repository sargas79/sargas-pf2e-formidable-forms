// Builds the module and packs it for a release: dist/sargas-pf2e-formidable-forms.zip (module files at the zip root,
// as Foundry expects) plus dist/module.json for the manifest URL.
//
// Usage: npm run package
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { DIST_DIR, DIST_ROOT, ROOT, ZIP_FILE } from './lib/paths.mjs';

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });

await new Promise((resolve, reject) => {
  const output = createWriteStream(ZIP_FILE);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(DIST_DIR, false);
  archive.finalize();
});
await copyFile(path.join(DIST_DIR, 'module.json'), path.join(DIST_ROOT, 'module.json'));
console.log(`Packed ${path.relative(ROOT, ZIP_FILE)} and dist/module.json`);
