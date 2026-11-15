// Entry point: wires the features to Foundry's hooks.
import { creatureTokensReady } from './art-env.mjs';
import { registerAutoApplyHook } from './auto-apply.mjs';
import { MODULE_ID } from './constants.mjs';
import { FormArtManager } from './form-art-manager.mjs';
import { registerTokenImageHooks } from './hooks.mjs';
import { registerArtMenu, registerSettings } from './settings.mjs';

Hooks.once('init', () => {
  registerSettings();
  registerArtMenu(FormArtManager);
  registerTokenImageHooks();
  registerAutoApplyHook();
  console.log(`${MODULE_ID} | Loaded`);
});

Hooks.once('ready', () => {
  creatureTokensReady();
});
