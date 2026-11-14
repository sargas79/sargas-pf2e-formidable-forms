import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { MODULE_ID } from '../module/scripts/constants.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODULE_DIR = path.join(ROOT, 'module');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const manifest = readJson(path.join(MODULE_DIR, 'module.json'));

test('manifest id, version and download URL agree with each other and with package.json', () => {
  assert.equal(manifest.id, MODULE_ID);
  assert.equal(manifest.version, readJson(path.join(ROOT, 'package.json')).version);
  assert.ok(manifest.download.endsWith(`/v${manifest.version}/${MODULE_ID}.zip`));
  assert.ok(manifest.manifest.endsWith('/releases/latest/download/module.json'));
});

test('manifest targets Foundry v14 and PF2e 8.6.0 or later', () => {
  assert.deepEqual(manifest.compatibility, { minimum: '14', verified: '14' });
  const [pf2e] = manifest.relationships.systems;
  assert.equal(pf2e.id, 'pf2e');
  assert.equal(pf2e.compatibility.minimum, '8.6.0');
});

test('the art module is recommended, not required', () => {
  assert.equal(manifest.relationships.requires, undefined);
  assert.deepEqual(
    manifest.relationships.recommends.map((r) => r.id),
    ['sargas-pf2-creature-images'],
  );
});

test('every file the manifest points at exists', () => {
  const files = [...manifest.esmodules, ...(manifest.styles ?? []), ...manifest.languages.map((l) => l.path)];
  for (const file of files) assert.ok(existsSync(path.join(MODULE_DIR, file)), `${file} is missing`);
});
