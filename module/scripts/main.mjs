// Entry point. The features are added by later files; for now the module only reports that it loaded.
import { MODULE_ID } from './constants.mjs';

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Loaded`);
});
