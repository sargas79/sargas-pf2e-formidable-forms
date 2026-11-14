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

/* -------------------------------------------- */
/*  Presentation                                 */
/* -------------------------------------------- */

/** Group shown after all others: effects from before the remaster. */
export const LEGACY_GROUP = 'legacy';

/** Lower case, without accents, for comparing names. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Whether a name matches a search: every word typed must appear somewhere in the name. */
export function matchesQuery(name, query) {
  const haystack = normalize(name);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The heading a choice goes under: "legacy", a magic tradition (dragons), or null for none. */
export function groupOf({ effect, form }) {
  return effect.legacy ? LEGACY_GROUP : (form.group ?? null);
}

/**
 * Splits choices into groups for display: ungrouped first, then by group name, pre-remaster forms last. The order
 * inside a group is the catalogue's (PF2e's own).
 * @returns {{ group: string | null, choices: object[] }[]}
 */
export function groupChoices(choices) {
  const groups = new Map();
  for (const choice of choices) {
    const group = groupOf(choice);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(choice);
  }
  const order = (group) => (group === null ? 0 : group === LEGACY_GROUP ? 2 : 1);
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b) || String(a).localeCompare(String(b)))
    .map(([group, grouped]) => ({ group, choices: grouped }));
}

/**
 * The spells a list of choices belongs to, in order of appearance: the first step of the Untamed Form picker.
 * @returns {{ slug: string, name: string, img: string, count: number }[]}
 */
export function spellsOf(catalogue, choices) {
  const spells = new Map();
  for (const { effect } of choices) {
    const spell = spells.get(effect.spell) ?? {
      slug: effect.spell,
      name: catalogue.spells[effect.spell].name,
      img: effect.img,
      count: 0,
    };
    spell.count++;
    spells.set(effect.spell, spell);
  }
  return [...spells.values()];
}

/**
 * Where the picker opens: on the caster's last pick when it is still on offer, and straight on the creature list
 * when there is only one spell to choose from.
 * @param {object} catalogue
 * @param {object[]} choices
 * @param {string} [lastKey] The form key the caster picked last time for this spell
 * @returns {{ spellSlug: string | null, selectedKey: string | null }} `spellSlug` null means "ask for the spell"
 */
export function initialState(catalogue, choices, lastKey) {
  const last = choices.find((choice) => choice.form.key === lastKey);
  if (last) return { spellSlug: last.effect.spell, selectedKey: last.form.key };
  const spells = spellsOf(catalogue, choices);
  return { spellSlug: spells.length === 1 ? spells[0].slug : null, selectedKey: null };
}
