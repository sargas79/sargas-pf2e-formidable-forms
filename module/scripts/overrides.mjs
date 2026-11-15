// The GM's image overrides: a plain object of image paths by form key, stored in a world setting. Pure functions
// that never modify the object they are given, so the setting's value can be passed in directly.
import { resolveFormArt } from './art.mjs';

/** The override for a form, or null. Blank values count as "not set". */
export function readOverride(overrides, formKey) {
  const value = overrides?.[formKey];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** A copy of the overrides with the form's image set. A blank path removes the override. */
export function withOverride(overrides, formKey, path) {
  const next = withoutOverride(overrides, formKey);
  const value = typeof path === 'string' ? path.trim() : '';
  if (value !== '') next[formKey] = value;
  return next;
}

/** A copy of the overrides without the form's image. */
export function withoutOverride(overrides, formKey) {
  const next = { ...overrides };
  delete next[formKey];
  return next;
}

/**
 * The Form Art manager's rows: every form that can show art, grouped by spell, with the image the resolver picks.
 * Choices that are not battle forms (Devouring Dark Form's tentacle) never change the token and are left out.
 * @param {object} catalogue
 * @param {object} env The art resolver's environment (see `resolveFormArt`)
 * @returns {{ slug: string, name: string, rows: { key: string, form: object, effect: object, art: object,
 *   overridden: boolean }[] }[]}
 */
export function listArtRows(catalogue, env = {}) {
  return Object.values(catalogue.spells).map((spell) => ({
    slug: spell.slug,
    name: spell.name,
    rows: spell.effects
      .map((uuid) => catalogue.effects[uuid])
      .flatMap((effect) =>
        effect.forms
          .filter((form) => form.battleForm !== false)
          .map((form) => ({
            key: form.key,
            form,
            effect,
            art: resolveFormArt(form, env),
            overridden: readOverride(env.overrides, form.key) !== null,
          })),
      ),
  }));
}
