// Every string the module shows must be in lang/en.json.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { I18N } from '../module/scripts/constants.mjs';
import { english } from './helpers.mjs';

const MODULE_DIR = path.resolve(import.meta.dirname, '..', 'module');

function filesIn(folder, extension) {
  const dir = path.join(MODULE_DIR, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => ({ name: `${folder}/${name}`, text: readFileSync(path.join(dir, name), 'utf8') }));
}

/** Keys written in full ("SARGAS_FORMS.A.B"), with the root constant (`${I18N}.A.B`) or through `t('A.B')`. */
function keysIn(text) {
  const keys = new Set();
  for (const [, key] of text.matchAll(/\$\{I18N\}\.([A-Za-z0-9.]+)/g)) keys.add(`${I18N}.${key}`);
  for (const [key] of text.matchAll(new RegExp(`${I18N}\\.[A-Za-z0-9.]+`, 'g'))) keys.add(key);
  // The scripts' `t('A.B')` helper adds the root itself.
  for (const [, key] of text.matchAll(/\bt\(\s*['"`]([A-Za-z0-9.]+)/g)) keys.add(`${I18N}.${key}`);
  // A key that ends with a dot is a prefix completed at runtime; those are checked by the tests of their feature.
  return [...keys].map((key) => key.replace(/\.$/, '')).filter((key) => key !== I18N);
}

test('every string key used in the scripts and templates is in en.json', () => {
  const files = [...filesIn('scripts', '.mjs'), ...filesIn('templates', '.hbs')];
  let checked = 0;
  for (const { name, text } of files) {
    for (const key of keysIn(text)) {
      const value = english(key);
      assert.ok(value !== undefined, `${name} uses ${key}, which is not in en.json`);
      checked++;
    }
  }
  assert.ok(checked > 0);
});
