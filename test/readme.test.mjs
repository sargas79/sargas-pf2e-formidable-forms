// The README's list of supported forms is generated from the catalogue; this keeps the two in step.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { README_FILE, formsRows, tableIn } from '../scripts/readme-forms.mjs';
import { catalogue } from './helpers.mjs';

const readme = readFileSync(README_FILE, 'utf8');

/** A Markdown table's body rows as arrays of trimmed cells, whatever the column padding. */
function cellsOf(table) {
  return table
    .split('\n')
    .slice(2)
    .map((line) =>
      line
        .replace(/^\s*\||\|\s*$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
}

test('the README lists the supported forms exactly as the catalogue has them', () => {
  const table = tableIn(readme);
  assert.ok(table, 'README.md has no forms table; run `npm run readme:forms`');
  assert.deepEqual(cellsOf(table), formsRows(catalogue), 'run `npm run readme:forms`');
});

test('the README states the requirements, the art sources and the licensing note', () => {
  assert.match(readme, /Foundry VTT \*\*v14\*\*/);
  assert.match(readme, /\*\*8\.6\.0 or later\*\*/);
  assert.match(readme, /ships no art/);
  assert.match(readme, /releases\/latest\/download\/module\.json/);
  assert.match(readme, /not licensed for redistribution/);
});
