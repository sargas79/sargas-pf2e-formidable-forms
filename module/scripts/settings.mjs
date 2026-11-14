// The module's settings. Reads fall back to a default while a setting is not registered, so features can be used
// before the code that registers their setting has run.
import { I18N, MODULE_ID } from './constants.mjs';

export const SETTING = Object.freeze({
  /** World: apply the effect when a battle-form spell is cast. */
  AUTO_APPLY: 'autoApply',
  /** Client: fade the token to its new image. */
  TRANSITION: 'transition',
  /** World, hidden: the GM's image overrides by form key. */
  OVERRIDES: 'artOverrides',
});

const DEFAULTS = {
  [SETTING.AUTO_APPLY]: true,
  [SETTING.TRANSITION]: true,
  [SETTING.OVERRIDES]: {},
};

/** Reads a setting, or its default when it is not registered. */
export function getSetting(key) {
  if (!game.settings.settings.has(`${MODULE_ID}.${key}`)) return DEFAULTS[key];
  return game.settings.get(MODULE_ID, key);
}

/** Registers the settings. Called on `init`. */
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTING.AUTO_APPLY, {
    name: `${I18N}.Settings.AutoApply.Name`,
    hint: `${I18N}.Settings.AutoApply.Hint`,
    scope: 'world',
    config: true,
    type: Boolean,
    default: DEFAULTS[SETTING.AUTO_APPLY],
  });
}
