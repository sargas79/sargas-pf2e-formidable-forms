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

/** The smallest subject scale the rule's schema accepts; a smaller value would make the whole rule invalid. */
export const MIN_SUBJECT_SCALE = 0.8;

const isOurRule = (rule) => rule?.key === 'TokenImage' && rule.slug === RULE_SLUG;

/**
 * Picks the token that stands for an actor, most specific first:
 *  1. the token the caller knows is meant (the one that cast the spell), when it belongs to the actor,
 *  2. the actor's own token, when the actor is an unlinked token's,
 *  3. a token of the actor on the scene being viewed,
 *  4. the actor's prototype token.
 * A form's rule lives on the actor, so it applies to every linked token of that actor; the token picked here is
 * the one whose ring settings decide how the rule is written.
 * @param {object} candidates
 * @param {string} candidates.actorUuid The actor's UUID
 * @param {{ actor?: { uuid: string } } | null} [candidates.preferred] The token the caller means
 * @param {object | null} [candidates.own] `actor.token`
 * @param {object[]} [candidates.active] The actor's tokens on the viewed scene
 * @param {object | null} [candidates.prototype] `actor.prototypeToken`
 * @returns {object | null}
 */
export function chooseToken({ actorUuid, preferred = null, own = null, active = [], prototype = null }) {
  if (preferred?.actor && preferred.actor.uuid === actorUuid) return preferred;
  return own ?? active[0] ?? prototype ?? null;
}

/**
 * The dynamic ring settings of a token, read from its source data (not the prepared values, which a rule like ours
 * may already have changed).
 * @param {object} [tokenSource] Source data of a token document or a prototype token
 * @returns {{ enabled: boolean, colors: { ring: string | null, background: string | null }, effects: number,
 *   subject: { scale: number } }} With Foundry's defaults for anything the token does not set
 */
export function ringSettingsOf(tokenSource) {
  const ring = tokenSource?.ring;
  return {
    enabled: Boolean(ring?.enabled),
    colors: { ring: ring?.colors?.ring ?? null, background: ring?.colors?.background ?? null },
    effects: Number.isInteger(ring?.effects) ? ring.effects : 1,
    subject: { scale: typeof ring?.subject?.scale === 'number' ? ring.subject.scale : 1 },
  };
}

/**
 * Builds the rule for a resolved image.
 * @param {{ image: string, ringSafe: boolean }} art The art resolver's result
 * @param {object} [options]
 * @param {boolean} [options.animate] Whether to fade to the new image
 * @param {object} [options.ringSettings] The target token's ring settings, from `ringSettingsOf`
 * @returns {object} The rule element source
 */
export function buildTokenImageRule({ image, ringSafe }, { animate = true, ringSettings } = {}) {
  const rule = { key: 'TokenImage', slug: RULE_SLUG };
  if (ringSafe) {
    // The rule's `ring` field switches the dynamic ring on, so it is only used on tokens that already have the
    // ring; there the ring shows its subject texture, and the token texture underneath is left alone.
    rule.ring = { subject: { texture: image } };
    // The rule replaces the token's whole ring with its own and fills in defaults for what it is not given
    // (no colours, default effects, scale 1). So the token's own settings are written into the rule, and only
    // the picture changes.
    if (ringSettings) {
      rule.ring.subject.scale = Math.max(MIN_SUBJECT_SCALE, ringSettings.subject.scale);
      rule.ring.colors = { ...ringSettings.colors };
      rule.ring.effects = ringSettings.effects;
    }
  } else {
    rule.value = image;
  }
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
 * @param {object} [env.ringSettings] The ring settings of the token the art is for, from `ringSettingsOf`
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
  if (art.source !== ART_SOURCE.NONE) {
    rules.push(buildTokenImageRule(art, { animate: env.animate ?? true, ringSettings: env.ringSettings }));
  }

  return { form, art, update: { 'system.rules': rules, [`flags.${MODULE_ID}.form`]: form.key } };
}
