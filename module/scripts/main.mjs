// Entry point: wires the features to Foundry's hooks.
import { preloadCreatureTokens } from './art-env.mjs';
import { MODULE_ID } from './constants.mjs';
import { hasCatalogue } from './data.mjs';
import { registerTokenImageHooks } from './hooks.mjs';

Hooks.once('init', () => {
  if (!hasCatalogue) return;
  registerTokenImageHooks();
  console.log(`${MODULE_ID} | Loaded`);
});

Hooks.once('ready', () => {
  if (hasCatalogue) preloadCreatureTokens();
});
