import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULE_ID } from '../../module/scripts/constants.mjs';

export { MODULE_ID };
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODULE_DIR = path.join(ROOT, 'module');
export const DIST_ROOT = path.join(ROOT, 'dist');
export const DIST_DIR = path.join(DIST_ROOT, MODULE_ID);
export const ZIP_FILE = path.join(DIST_ROOT, `${MODULE_ID}.zip`);

export const DATA_DIR = path.join(ROOT, 'scripts', 'data');
export const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
/** The PF2e data the catalogue is built from, committed so the build and the tests run offline. */
export const SNAPSHOT_FILE = path.join(DATA_DIR, 'pf2e-snapshot.json');
/** Hand-written choices: which creature stands for each form, and the cosmetic forms. */
export const FORM_CONFIG_FILE = path.join(DATA_DIR, 'form-config.json');
/** The generated catalogue the module ships. */
export const FORMS_FILE = path.join(MODULE_DIR, 'data', 'forms.json');
