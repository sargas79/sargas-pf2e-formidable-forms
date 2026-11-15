// Lookups over the form catalogue (module/data/forms.json). Pure: every function takes the catalogue and plain
// source data, so they run in Node for the unit tests and in Foundry alike.
import { MODULE_ID } from './constants.mjs';
import { testPredicate } from './predicate.mjs';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Structural equality for JSON data. Object key order does not matter. */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => deepEqual(value, b[i]));
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]));
}

/** Every form in the catalogue with its effect: `[{ effect, form }]`. */
export function allForms(catalogue) {
  return Object.values(catalogue.effects).flatMap((effect) => effect.forms.map((form) => ({ effect, form })));
}

/** Finds a form by its key ("animal-form:bear"). Returns `{ effect, form }` or null. */
export function findForm(catalogue, key) {
  if (typeof key !== 'string') return null;
  const slug = key.split(':')[0];
  for (const uuid of catalogue.spells[slug]?.effects ?? []) {
    const effect = catalogue.effects[uuid];
    const form = effect.forms.find((f) => f.key === key);
    if (form) return { effect, form };
  }
  return null;
}

/**
 * Whether a UUID points at the given compendium effect. The druid feats link effects by name in the PF2e source
 * ("...Item.Spell Effect: Pest Form") and by id once the packs are built, so both are accepted.
 */
export function isSameEffect(uuid, entry) {
  if (typeof uuid !== 'string') return false;
  if (uuid === entry.uuid) return true;
  const prefix = entry.uuid.slice(0, entry.uuid.lastIndexOf('.') + 1);
  return uuid.startsWith(prefix) && uuid.slice(prefix.length) === entry.name;
}

/** The UUIDs an item source says it was made from. */
function originsOf(source) {
  return [source?._stats?.compendiumSource, source?._stats?.duplicateSource, source?.flags?.core?.sourceId].filter(
    (uuid) => typeof uuid === 'string',
  );
}

/**
 * The catalogue entry for an effect's source data, or null when it is not a form effect. Matched by the compendium
 * UUID the item came from, then by slug (for copies that lost their origin).
 */
export function findEffectEntry(catalogue, source) {
  if (source?.type !== 'effect') return null;
  const entries = Object.values(catalogue.effects);
  const origins = originsOf(source);
  const slug = source.system?.slug;
  return (
    entries.find((entry) => origins.some((uuid) => isSameEffect(uuid, entry))) ??
    (slug ? entries.find((entry) => entry.slug === slug) : null) ??
    null
  );
}

/** Whether an effect's source data is the Untamed Form spell effect. */
export function isUntamedEffect(catalogue, source) {
  if (source?.type !== 'effect') return false;
  const untamed = { uuid: catalogue.untamed.effect, name: catalogue.untamed.effectName };
  return (
    originsOf(source).some((uuid) => isSameEffect(uuid, untamed)) ||
    source.system?.slug === catalogue.untamed.effectSlug
  );
}

/**
 * The position of a ChoiceSet in a rules array, given the catalogue's description of it. The system writes the flag
 * into the rule when the effect is created, so a created effect matches by flag; a compendium source may not have
 * one yet and matches by roll option or position.
 * @returns {number} The index, or -1
 */
export function findChoiceSetIndex(rules = [], choiceSet) {
  if (!choiceSet) return -1;
  const isChoiceSet = (rule) => rule?.key === 'ChoiceSet';
  const byFlag = rules.findIndex((rule) => isChoiceSet(rule) && rule.flag === choiceSet.flag);
  if (byFlag !== -1) return byFlag;
  if (choiceSet.rollOption) {
    const byOption = rules.findIndex((rule) => isChoiceSet(rule) && rule.rollOption === choiceSet.rollOption);
    if (byOption !== -1) return byOption;
  }
  return isChoiceSet(rules[choiceSet.index]) ? choiceSet.index : -1;
}

/** The form of an effect entry that a ChoiceSet selection stands for, or null. */
export function formForSelection(entry, selection) {
  if (selection === null || selection === undefined) return null;
  const forms = entry.forms.filter((form) => form.value !== undefined);
  const exact = forms.find((form) => deepEqual(form.value, selection));
  if (exact) return exact;
  // An object choice PF2e has changed since the catalogue was built still matches by its identifying property.
  const key = entry.choiceSet?.objectKey;
  if (!key || !isObject(selection)) return null;
  return forms.find((form) => isObject(form.value) && form.value[key] === selection[key]) ?? null;
}

/**
 * The form an effect's source data stands for:
 *  1. the form this module recorded on the effect (needed for cosmetic choices such as Pest Form's),
 *  2. a hint from whoever is creating the effect,
 *  3. the ChoiceSet selection (effects applied by hand or granted by Untamed Form),
 *  4. the only, or first, form of an effect without a choice.
 * @param {object} catalogue The form catalogue; its `system` is the flag scope the system writes selections to
 * @param {object} entry The effect's catalogue entry
 * @param {object} source The effect's source data
 * @param {string} [hint] A form key suggested by the caller
 * @returns {object | null} The catalogue form
 */
export function deriveForm(catalogue, entry, source, hint) {
  for (const key of [source.flags?.[MODULE_ID]?.form, hint]) {
    const form = entry.forms.find((f) => f.key === key);
    if (form) return form;
  }
  if (!entry.choiceSet) return entry.forms[0] ?? null;

  const rules = source.system?.rules ?? [];
  const selection =
    rules[findChoiceSetIndex(rules, entry.choiceSet)]?.selection ??
    source.flags?.[catalogue.system]?.rulesSelections?.[entry.choiceSet.flag];
  return formForSelection(entry, selection);
}

const atRank = (steps, rank) => steps.findLast((step) => step.rank <= rank) ?? null;

/** The size code ("lg") a form has at an effect level, or null when the form keeps the caster's size. */
export const sizeAtRank = (form, rank) => atRank(form.sizes ?? [], rank)?.size ?? null;

/** The special movement types (burrow, climb, fly, swim) a form has at an effect level. */
export const movementAtRank = (form, rank) => atRank(form.movement ?? [], rank)?.types ?? [];

/**
 * Whether a form can be chosen.
 * @param {object} form A catalogue form
 * @param {object} context
 * @param {number} context.rank The rank the spell was cast at
 * @param {Iterable<string>} [context.options] The caster's roll options, for choices that need a feat
 * @param {boolean} [context.untamed] Whether the form is taken through Untamed Form
 */
export function isFormAvailable(form, { rank, options = [], untamed = false }) {
  if (form.minRank && rank < form.minRank) return false;
  if (!form.predicate?.length) return true;
  const domain = new Set(options);
  // The roll options the system has when it tests a choice: the effect's level and, through Untamed Form, the
  // Untamed Form effect on the caster.
  domain.add(`parent:level:${rank}`);
  if (untamed) domain.add('self:effect:untamed-form');
  else domain.delete('self:effect:untamed-form');
  return testPredicate(form.predicate, domain);
}
