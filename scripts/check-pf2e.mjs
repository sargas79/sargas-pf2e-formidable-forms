// Compares the shipped catalogue with the current PF2e source, to spot form choices a PF2e update added or removed.
// Needs network access and git. Exits with code 1 when the catalogue is out of date.
//
// Usage:
//   npm run check:pf2e                 compare with the tip of the v14-dev branch
//   npm run check:pf2e -- --ref <ref>  compare with another commit, tag or branch
import { fetchSnapshot } from './fetch-pf2e.mjs';
import { findCoverageGaps } from './lib/forms.mjs';
import { FORMS_FILE } from './lib/paths.mjs';
import { PF2E_BRANCH } from './lib/pf2e.mjs';
import { readJson } from './lib/util.mjs';

const refIndex = process.argv.indexOf('--ref');
const snapshot = await fetchSnapshot(refIndex === -1 ? PF2E_BRANCH : process.argv[refIndex + 1]);
const catalogue = await readJson(FORMS_FILE);

const gaps = findCoverageGaps(snapshot, catalogue);
console.log(`Catalogue: PF2e ${catalogue.pf2e.version} (${catalogue.pf2e.ref.slice(0, 8)})`);
console.log(`Compared with: PF2e ${snapshot.version} (${snapshot.ref.slice(0, 8)})`);
if (gaps.length === 0) {
  console.log('The catalogue covers every battle form in the PF2e data.');
} else {
  console.error(`${gaps.length} difference(s):`);
  for (const gap of gaps) console.error(`  ${gap}`);
  console.error('Refresh the snapshot and the catalogue: see scripts/build-forms.mjs.');
  process.exit(1);
}
