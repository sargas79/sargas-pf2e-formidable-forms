// Adds the PF2e `TokenImage` rule element to a form effect's source data. Pure: the hook that calls this is in
// hooks.mjs. The rule is derived data in the system, so the token returns to its own image when the effect is
// removed, expires or is dismissed; nothing is backed up or restored here.
import { ART_SOURCE, resolveFormArt } from './art.mjs';
import { deriveForm, findEffectEntry } from './catalogue.mjs';
import { MODULE_ID } from './constants.mjs';

/** Marks the rule as ours, so it is replaced instead of added twice. */
export const RULE_SLUG = 'formidable-forms-art';

/** A short fade between the two images (`TextureTransitionFilter.TYPES.FADE`). */
export const TRANSITION = Object.freeze({ transition: 'fade', duration: 400 });

const isOurRule = (rule) => rule?.key === 'TokenImage' && rule.slug === RULE_SLUG;

/**
 * Builds the rule for a resolved image.
 * @param {{ image: string, ringSafe: boolean }} art The art resolver's result
 * @param {object} [options]
 * @param {boolean} [options.animate] Whether to fade to the new image
 * @returns {object} The rule element source
 */
export function buildTokenImageRule({ image, ringSafe }, { animate = true } = {}) {
  const rule = { key: 'TokenImage', slug: RULE_SLUG };
  // The rule's `ring` field switches the dynamic ring on, so it is only used on tokens that already have the ring;
  // there the ring shows its subject texture, and the token texture underneath is left alone.
  if (ringSafe) rule.ring = { subject: { texture: image } };
  else rule.value = image;
  if (animate) rule.animation = { ...TRANSITION };
  return rule;
}

/**
 * Works out the change to make to an effect that is about to be created.
 * @param {object} catalogue The form catalogue
 * @param {object} source The effect's source data
 * @param {object} [env] The art resolver's environment (see `resolveFormArt`), plus:
 * @param {Record<string, string>} [env.hints] Form keys by effect UUID, suggested by whoever creates the effect
 * @param {boolean} [env.animate] Whether to fade to the new image
 * @returns {{ form: object, art: object, update: object } | null} Null when the effect is not a catalogue form
 *   effect or its form is unknown; otherwise `update` is the data for `Document#updateSource`.
 */
export function planTokenImage(catalogue, source, env = {}) {
  const entry = findEffectEntry(catalogue, source);
  if (!entry) return null;
  const form = deriveForm(entry, source, env.hints?.[entry.uuid]);
  if (!form) return null;

  // A copy of an effect that already went through here carries our rule: resolve it again for this actor and
  // replace it, never add a second one.
  const rules = (source.system?.rules ?? []).filter((rule) => !isOurRule(rule));
  const art =
    form.battleForm === false ? { image: null, source: ART_SOURCE.NONE, ringSafe: false } : resolveFormArt(form, env);
  if (art.source !== ART_SOURCE.NONE) rules.push(buildTokenImageRule(art, { animate: env.animate ?? true }));

  return { form, art, update: { 'system.rules': rules, [`flags.${MODULE_ID}.form`]: form.key } };
}
