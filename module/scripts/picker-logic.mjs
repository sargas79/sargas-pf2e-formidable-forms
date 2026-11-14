// What the form picker offers for a cast. Pure, so the rank gating and filtering can be unit tested.
import { isFormAvailable } from './catalogue.mjs';
import { unlockedEffects } from './cast.mjs';

/**
 * The forms a caster can choose from.
 * @param {object} catalogue
 * @param {object} spell The catalogue spell that was cast (an entry of `catalogue.spells`, or `catalogue.untamed`)
 * @param {object} context
 * @param {number} context.rank The rank the spell was cast at
 * @param {Iterable<string>} [context.options] The caster's roll options
 * @param {unknown} [context.wildShapeForms] The caster's Untamed Form list (`flags.pf2e.wildShapeForms`)
 * @returns {{ effect: object, form: object, untamedValue?: string }[]} For Untamed Form, `untamedValue` is the
 *   effect UUID as stored on the actor.
 */
export function listChoices(catalogue, spell, { rank, options = [], wildShapeForms } = {}) {
  if (spell === catalogue.untamed) {
    return unlockedEffects(wildShapeForms, catalogue).flatMap(({ entry, value }) =>
      entry.forms
        .filter((form) => isFormAvailable(form, { rank, options, untamed: true }))
        .map((form) => ({ effect: entry, form, untamedValue: value })),
    );
  }
  return spell.effects
    .map((uuid) => catalogue.effects[uuid])
    .filter((effect) => !effect.untamedOnly)
    .flatMap((effect) =>
      effect.forms.filter((form) => isFormAvailable(form, { rank, options })).map((form) => ({ effect, form })),
    );
}

/** The value `pickForm` resolves to for a choice. */
export function toResult({ effect, form, untamedValue }) {
  return { effectUuid: effect.uuid, formKey: form.key, ...(untamedValue ? { untamedValue } : {}) };
}
