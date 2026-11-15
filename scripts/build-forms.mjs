// Generates module/data/forms.json, the form catalogue the module ships, from scripts/data/pf2e-snapshot.json (the
// PF2e pack data) and scripts/data/form-config.json (which creature stands for each form). Runs offline.
//
// To rebuild after a PF2e update:
//   1. npm run check:pf2e      see what changed in PF2e (network)
//   2. set PF2E_REF in scripts/lib/pf2e.mjs to the new commit, then: npm run fetch:pf2e   (network)
//   3. add creatures for any new form to scripts/data/form-config.json
//   4. npm run build:forms     (this script), then: npm test
//
// Usage: npm run build:forms
import path from 'node:path';
import { buildCatalogue } from './lib/forms.mjs';
import { FORMS_FILE, FORM_CONFIG_FILE, ROOT, SNAPSHOT_FILE } from './lib/paths.mjs';
import { readJson, writeJson } from './lib/util.mjs';

const catalogue = buildCatalogue(await readJson(SNAPSHOT_FILE), await readJson(FORM_CONFIG_FILE));
await writeJson(FORMS_FILE, catalogue);

const forms = Object.values(catalogue.effects).flatMap((effect) => effect.forms);
const withoutCreature = forms.filter((form) => !form.creature).map((form) => form.key);
console.log(
  `Wrote ${path.relative(ROOT, FORMS_FILE)}: ${Object.keys(catalogue.spells).length} spells, ` +
    `${Object.keys(catalogue.effects).length} effects, ${forms.length} forms (PF2e ${catalogue.pf2e.version}).`,
);
if (withoutCreature.length) console.log(`No creature: ${withoutCreature.join(', ')}`);
