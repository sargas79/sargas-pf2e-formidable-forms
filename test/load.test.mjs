// Loads the module's whole script graph, with stand-ins for the few Foundry globals the scripts touch while
// loading. Catches broken imports, and checks that nothing in the graph waits before the hooks are registered.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { catalogue as fromFile } from './helpers.mjs';

const require = createRequire(import.meta.url);

const registered = [];
globalThis.Hooks = {
  once: (name, fn) => registered.push({ name, fn, once: true }),
  on: (name, fn) => registered.push({ name, fn, once: false }),
};
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (Base) => class extends Base {},
    },
  },
};

test('the catalogue is a static JSON import of the shipped file', async () => {
  const { catalogue } = await import('../module/scripts/data.mjs');
  assert.deepEqual(catalogue, fromFile);
  assert.equal(Object.keys(catalogue.effects).length, 45);
});

// Node's synchronous `require` of an ES module refuses a graph that contains a top-level await, which is exactly
// what must not be there: Foundry could fire `init` while such a script is still waiting.
test(
  'the entry script loads synchronously and registers its hooks at once',
  { skip: !process.features.require_module && 'needs require(esm), Node 22.12 or later' },
  () => {
    require('../module/scripts/main.mjs');
    assert.deepEqual(
      registered.map(({ name, once }) => `${name}${once ? ' (once)' : ''}`),
      ['init (once)', 'ready (once)'],
    );
  },
);
