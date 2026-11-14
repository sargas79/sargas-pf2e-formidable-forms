import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULE_ID } from '../../module/scripts/constants.mjs';

export { MODULE_ID };
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODULE_DIR = path.join(ROOT, 'module');
export const DIST_ROOT = path.join(ROOT, 'dist');
export const DIST_DIR = path.join(DIST_ROOT, MODULE_ID);
export const ZIP_FILE = path.join(DIST_ROOT, `${MODULE_ID}.zip`);
