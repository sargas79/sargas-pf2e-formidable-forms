// Copies module/ to dist/sargas-pf2e-formidable-forms/, ready to drop into the Foundry server's Data/modules/.
//
// Usage: npm run build
import { cp, rm } from 'node:fs/promises';
import { DIST_DIR, MODULE_DIR } from './lib/paths.mjs';

await rm(DIST_DIR, { recursive: true, force: true });
await cp(MODULE_DIR, DIST_DIR, {
  recursive: true,
  filter: (src) => !src.endsWith('.gitkeep'),
});
console.log(`Built ${DIST_DIR}`);
