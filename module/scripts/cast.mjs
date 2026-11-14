// Recognises a battle-form spell cast in a chat message and builds the effect to create. Pure: plain objects in,
// plain objects out. The Foundry side is in auto-apply.mjs.
//
// Everything here mirrors the PF2e system (branch v14-dev):
//  - SpellPF2e#toMessage writes `flags.pf2e.origin` ({ type: "spell", castRank, rollOptions, ... }) and
//    `flags.pf2e.casting` ({ id, tradition }). A real cast (not "send to chat") adds the roll option
//    "origin:action:slug:cast-a-spell". `flags.pf2e.context.type` is "spell-cast" only for spells with a save or
//    defense, which battle forms don't have, so it cannot be used to detect them.
//  - scripts/system/dragstart-handler.ts and the actor sheet's item drop build the effect when its link is dragged
//    from the chat card: `system.level.value` from the cast rank, `system.context` from the message, and the spell's
//    traits when the effect has none. `buildOriginContext` and `buildEffectSource` copy that shape.
import { deepEqual, findChoiceSetIndex, findEffectEntry, isSameEffect, isUntamedEffect } from './catalogue.mjs';
import { MODULE_ID } from './constants.mjs';

/** Present in a spell message's origin roll options only when the spell was actually cast. */
export const CAST_A_SPELL_OPTION = 'origin:action:slug:cast-a-spell';

const SLUG_OPTION = 'origin:item:slug:';
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a chat message and returns the catalogue spell that was cast, or null for anything else.
 * @param {object} message Chat message data; only `flags.pf2e` is read
 * @param {object} catalogue The form catalogue
 * @param {object} [spell] What is known about the spell item, for spells whose roll options don't name them
 * @param {string} [spell.slug]
 * @param {string} [spell.sourceId] The compendium UUID the spell was made from
 * @returns {{ spell: object, untamed: boolean, castRank: number, tradition: string | null } | null}
 */
export function parseCast(message, catalogue, spell = {}) {
  const flags = message?.flags?.[catalogue.system];
  const origin = flags?.origin;
  if (origin?.type !== 'spell') return null;
  const rollOptions = Array.isArray(origin.rollOptions) ? origin.rollOptions : [];
  if (!rollOptions.includes(CAST_A_SPELL_OPTION)) return null;
  // A damage or check roll made from the spell's card carries the same origin: only the cast itself counts.
  const contextType = flags.context?.type;
  if (contextType && contextType !== 'spell-cast') return null;

  const slug = rollOptions.find((option) => option.startsWith(SLUG_OPTION))?.slice(SLUG_OPTION.length) ?? spell.slug;
  const entries = [...Object.values(catalogue.spells), catalogue.untamed];
  const entry =
    entries.find((e) => e.slug === slug) ?? entries.find((e) => spell.sourceId && e.uuid === spell.sourceId) ?? null;
  if (!entry) return null;

  const castRank = Number(origin.castRank) || entry.rank;
  return { spell: entry, untamed: entry === catalogue.untamed, castRank, tradition: flags.casting?.tradition ?? null };
}

/**
 * The `system.context` of an effect applied from a spell, as the system builds it when the effect link is dragged
 * from the chat card. Rules read it: Dragon Form's resistances test `parent:spellcasting:tradition:*`, which comes
 * from the origin roll options.
 * @param {object} origin
 * @param {string} origin.actor The caster's UUID
 * @param {string | null} [origin.token] The caster's token UUID
 * @param {string | null} [origin.item] The spell's UUID
 * @param {{ attribute: { type: string, mod: number }, tradition: string | null } | null} [origin.spellcasting]
 * @param {string[]} [origin.rollOptions] The message's `flags.pf2e.origin.rollOptions`
 */
export function buildOriginContext({ actor, token = null, item = null, spellcasting = null, rollOptions = [] }) {
  return {
    origin: { actor, token, item, spellcasting, rollOptions: [...rollOptions] },
    // A battle form is cast on oneself, without a roll.
    target: null,
    roll: null,
  };
}

/** The value to put in a ChoiceSet's `selection` for a form: the rule's own matching choice value. */
function selectionFor(rule, entry, form) {
  const choices = Array.isArray(rule.choices) ? rule.choices : [];
  const exact = choices.find((choice) => deepEqual(choice.value, form.value));
  if (exact) return exact.value;
  // PF2e changed a detail of an object choice since the catalogue was built: the system matches the selection
  // against its own choice by deep equality, so use the effect's current value.
  const key = entry.choiceSet.objectKey;
  if (!key || !isObject(form.value)) return undefined;
  return choices.find((choice) => isObject(choice.value) && choice.value[key] === form.value[key])?.value;
}

/**
 * Builds the source data of a form effect to create on the caster.
 * @param {object} compendiumSource The effect's source data from the compendium (`effect.toObject()`)
 * @param {object} options
 * @param {object} options.entry The effect's catalogue entry
 * @param {object} options.form The chosen catalogue form
 * @param {number} options.castRank The rank the spell was cast at
 * @param {object | null} [options.context] The origin context from `buildOriginContext`
 * @param {string[]} [options.traits] The spell's traits that are valid effect traits
 * @param {string} [options.sourceUuid] The UUID to record as the effect's compendium source
 * @returns {object} New source data; the input is not modified
 */
export function buildEffectSource(
  compendiumSource,
  { entry, form, castRank, context = null, traits = [], sourceUuid },
) {
  const source = structuredClone(compendiumSource);
  delete source._id;
  source._stats = { ...source._stats, compendiumSource: sourceUuid ?? entry.uuid };
  source.system ??= {};
  source.system.level = { ...source.system.level, value: Math.floor(castRank) };
  source.system.context = context;
  source.system.traits ??= {};
  source.system.traits.value ??= [];
  if (source.system.traits.value.length === 0) source.system.traits.value.push(...traits);

  // A selection already in the source makes the system skip its own prompt (ChoiceSetRuleElement#getPreselection).
  if (entry.choiceSet && form.value !== undefined) {
    const rule = source.system.rules?.[findChoiceSetIndex(source.system.rules, entry.choiceSet)];
    const selection = rule && selectionFor(rule, entry, form);
    if (selection !== undefined) rule.selection = structuredClone(selection);
  }

  // The token image hook reads the form from here; cosmetic forms (Pest Form) are recorded nowhere else.
  source.flags = { ...source.flags, [MODULE_ID]: { ...source.flags?.[MODULE_ID], form: form.key } };
  return source;
}

/**
 * The ids of the battle-form effects on an actor: any catalogue effect and Untamed Form. Battle forms don't stack,
 * so these are removed before a new one is created.
 * @param {object[]} items The actor's item sources
 * @param {object} catalogue
 * @returns {string[]}
 */
export function findFormEffectIds(items, catalogue) {
  return items
    .filter((item) => findEffectEntry(catalogue, item) || isUntamedEffect(catalogue, item))
    .map((item) => item._id);
}

/**
 * The entries of an actor's Untamed Form list (`flags.pf2e.wildShapeForms`) that are in the catalogue.
 * @param {unknown} wildShapeForms The flag's value: `[{ value: effectUuid }]`
 * @param {object} catalogue
 * @returns {{ entry: object, value: string }[]} Each catalogue effect with the exact UUID string stored on the actor
 */
export function unlockedEffects(wildShapeForms, catalogue) {
  const values = (Array.isArray(wildShapeForms) ? wildShapeForms : [])
    .map((item) => (typeof item === 'string' ? item : item?.value))
    .filter((value) => typeof value === 'string');
  const entries = Object.values(catalogue.effects);
  const unlocked = [];
  for (const value of new Set(values)) {
    const entry = entries.find((e) => isSameEffect(value, e));
    if (entry && !unlocked.some((u) => u.entry === entry)) unlocked.push({ entry, value });
  }
  return unlocked;
}

/** Whether a ChoiceSet value can go through GrantItem's `preselectChoices`, which only takes strings and numbers. */
const isPreselectable = (value) => typeof value === 'string' || typeof value === 'number';

/**
 * Plans the documents to create for a form taken through Untamed Form. The Untamed Form effect has a ChoiceSet over
 * the druid's known forms and a GrantItem that grants the chosen spell effect, whose own ChoiceSet asks for the
 * creature. Both prompts are answered in advance:
 *
 *  - Usually in one step: the Untamed Form effect with its selection set and `preselectChoices` on its GrantItem.
 *    The system then creates and links the form effect itself.
 *  - `preselectChoices` cannot carry an object, which is what Dragon Form's choices are. Then in two steps: the
 *    form effect first, with its selection, and then the Untamed Form effect with `allowDuplicate: false` on its
 *    GrantItem, which makes the system link the effect that is already there instead of granting (and asking for)
 *    a second one. That step keeps the id given here, because the link is made to it.
 *
 * @param {object} options
 * @param {object} options.catalogue
 * @param {object} options.untamedSource The Untamed Form effect's compendium source
 * @param {object} options.formSource The chosen form effect's compendium source
 * @param {object} options.entry The form effect's catalogue entry
 * @param {object} options.form The chosen catalogue form
 * @param {string} options.untamedValue The form effect's UUID exactly as stored in the actor's Untamed Form list
 * @param {number} options.castRank
 * @param {object | null} [options.context]
 * @param {string[]} [options.traits]
 * @param {string} options.untamedId A fresh document id for the Untamed Form effect
 * @returns {{ sources: object[], operation: object }[]} The create calls to make, in order
 */
export function planUntamedForm({
  catalogue,
  untamedSource,
  formSource,
  entry,
  form,
  untamedValue,
  castRank,
  context = null,
  traits = [],
  untamedId,
}) {
  const { untamed } = catalogue;
  const source = structuredClone(untamedSource);
  delete source._id;
  source._stats = { ...source._stats, compendiumSource: untamed.effect };
  source.system.level = { ...source.system.level, value: Math.floor(castRank) };
  source.system.context = context;
  source.system.traits ??= {};
  source.system.traits.value ??= [];
  if (source.system.traits.value.length === 0) source.system.traits.value.push(...traits);

  const rules = source.system.rules ?? [];
  const choiceSet = rules[findChoiceSetIndex(rules, untamed.choiceSet)];
  const grant =
    rules[untamed.grant.index]?.key === 'GrantItem'
      ? rules[untamed.grant.index]
      : rules.find((rule) => rule?.key === 'GrantItem' && String(rule.uuid).includes(untamed.choiceSet.flag));
  if (!choiceSet || !grant) throw new Error('The Untamed Form effect no longer has the rules this module expects');
  choiceSet.selection = untamedValue;

  const needsSelection = Boolean(entry.choiceSet) && form.value !== undefined;
  if (!needsSelection || isPreselectable(form.value)) {
    if (needsSelection) grant.preselectChoices = { ...grant.preselectChoices, [entry.choiceSet.flag]: form.value };
    // The granted effect is created by the system; the hint tells the token image hook which form it is.
    return [{ sources: [source], operation: { [MODULE_ID]: { forms: { [entry.uuid]: form.key } } } }];
  }

  grant.allowDuplicate = false;
  source._id = untamedId;
  const formEffect = buildEffectSource(formSource, {
    entry,
    form,
    castRank,
    context,
    traits,
    sourceUuid: untamedValue,
  });
  return [
    { sources: [formEffect], operation: {} },
    { sources: [source], operation: { keepId: true } },
  ];
}
