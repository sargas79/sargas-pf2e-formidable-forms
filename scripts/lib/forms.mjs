// Builds the form catalogue (module/data/forms.json) from a PF2e snapshot and scripts/data/form-config.json, and
// checks a catalogue against a snapshot. Pure: no file or network access.
import { minLevelOf, testPredicate } from '../../module/scripts/predicate.mjs';
import { WILD_SHAPE_FORMS, parseEffectName, sluggify } from './pf2e.mjs';

/** Movement types the picker shows. Land Speed is left out: almost every form has one. */
const MOVEMENT_TYPES = ['burrow', 'climb', 'fly', 'swim'];

/** PF2e sources spell sizes both ways ("lg" and "large"); the catalogue uses the system's short codes. */
const SIZES = {
  tiny: 'tiny',
  sm: 'sm',
  small: 'sm',
  med: 'med',
  medium: 'med',
  lg: 'lg',
  large: 'lg',
  huge: 'huge',
  grg: 'grg',
  gargantuan: 'grg',
};

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The flag a ChoiceSet gets when its source sets none: the item's slug in camel case (`#setDefaultFlag`). */
export function defaultChoiceFlag(effectSlug) {
  return effectSlug.replace(/-+([a-z0-9])/g, (_match, char) => char.toUpperCase());
}

/** The ChoiceSet that picks the form: the one with a fixed list of choices. Null for single-form effects. */
function formChoiceSet(effect) {
  return effect.rules.find((rule) => rule.key === 'ChoiceSet' && Array.isArray(rule.choices)) ?? null;
}

/**
 * For choices whose values are objects (Dragon Form), the property that tells them apart: the first one, in
 * alphabetical order, with a different string for every choice.
 */
function findObjectKey(choices) {
  const objects = choices.map((choice) => choice.value).filter(isObject);
  if (objects.length === 0) return null;
  const keys = Object.keys(objects[0]).sort();
  const key = keys.find((k) => {
    const values = objects.map((value) => value[k]);
    return values.every((v) => typeof v === 'string') && new Set(values).size === values.length;
  });
  if (!key) throw new Error('Could not find a property that identifies each object choice');
  return key;
}

/** Merges choices that repeat a value with different predicates (Monstrosity Form's phoenix) into one. */
function mergeChoices(choices, objectKey) {
  const merged = new Map();
  for (const choice of choices) {
    const id = objectKey ? choice.value[objectKey] : String(choice.value);
    const previous = merged.get(id);
    if (!previous) {
      merged.set(id, { ...choice, id, alternatives: [choice.predicate ?? []] });
    } else {
      previous.alternatives.push(choice.predicate ?? []);
    }
  }
  return [...merged.values()].map(({ alternatives, ...choice }) => {
    if (alternatives.length === 1) return choice;
    return { ...choice, predicate: [{ or: alternatives.map((predicate) => ({ and: predicate })) }] };
  });
}

/** The BattleForm rule that applies to a choice: the first whose predicate passes when only that choice is set. */
function battleFormFor(effect, choiceSet, id) {
  const options = choiceSet?.rollOption && id ? [`${choiceSet.rollOption}:${id}`] : [];
  return effect.rules.find((rule) => rule.key === 'BattleForm' && testPredicate(rule.predicate ?? [], options)) ?? null;
}

/** Resolves `@item.flags.system.rulesSelections.<flag>.<path>` against the chosen value; other values pass through. */
function resolveSpeed(speed, value) {
  if (typeof speed !== 'string') return speed;
  const match = /^@item\.flags\.system\.rulesSelections\.[^.]+\.(.+)$/.exec(speed);
  if (!match || !isObject(value)) return Number(speed) || null;
  return match[1].split('.').reduce((node, part) => node?.[part], value) ?? null;
}

/** Removes entries that repeat the previous one, and leading entries that say nothing. */
function compact(entries, isEmpty) {
  const out = [];
  for (const entry of entries) {
    const previous = out.at(-1);
    if (!previous && isEmpty(entry)) continue;
    if (previous && JSON.stringify({ ...previous, rank: 0 }) === JSON.stringify({ ...entry, rank: 0 })) continue;
    out.push(entry);
  }
  return out;
}

/**
 * Size and movement types by effect level. The system applies one bracket at a time: the last one that starts at or
 * below the effect level, merged over the rule's overrides (`BattleFormRuleElement`).
 */
function sizeAndMovement(battleForm, value) {
  if (!battleForm) return { sizes: [], movement: [] };
  const base = battleForm.overrides ?? {};
  const steps = [
    { rank: 0, value: {} },
    ...(battleForm.brackets ?? []).map((b) => ({ rank: b.start, value: b.value })),
  ];
  steps.sort((a, b) => a.rank - b.rank);

  const sizes = steps.map(({ rank, value: bracket }) => {
    const raw = bracket.size ?? base.size ?? null;
    if (raw !== null && !SIZES[raw]) throw new Error(`Unknown size "${raw}"`);
    return { rank, size: raw === null ? null : SIZES[raw] };
  });
  const movement = steps.map(({ rank, value: bracket }) => {
    const speeds = { ...base.speeds, ...bracket.speeds };
    const types = MOVEMENT_TYPES.filter((type) => Number(resolveSpeed(speeds[type], value)) > 0);
    return { rank, types };
  });
  return {
    sizes: compact(sizes, (entry) => entry.size === null),
    movement: compact(movement, (entry) => entry.types.length === 0),
  };
}

/** The creature names to try for a form, in order: the config's list, or the form's own name. */
function candidateNames(config, spellSlug, key, name) {
  if (key in (config.noCreature ?? {})) return [];
  const configured = config.creatures?.[key];
  if (configured) return configured;
  const pattern = config.namePatterns?.[spellSlug];
  return [pattern ? pattern.replace('{name}', name) : name];
}

/** Sorts creatures with the same name: preferred packs first, then remastered, then by pack and id. */
function rankCreatures(creatures, packPriority) {
  const priority = (pack) => {
    const index = packPriority.indexOf(pack);
    return index === -1 ? packPriority.length : index;
  };
  return [...creatures].sort(
    (a, b) =>
      priority(a.pack) - priority(b.pack) ||
      Number(b.remaster) - Number(a.remaster) ||
      a.pack.localeCompare(b.pack) ||
      a.id.localeCompare(b.id),
  );
}

function pickCreature(snapshot, config, names) {
  for (const name of names) {
    const [creature] = rankCreatures(
      snapshot.creatures.filter((c) => c.name === name),
      config.packPriority ?? [],
    );
    if (creature) return creature;
  }
  return null;
}

/** The description of every form of every effect, before creatures are attached. Shared with the fetch script. */
function describeEffects(snapshot, config) {
  const spellsByName = new Map(snapshot.spells.map((spell) => [spell.name, spell]));
  const excluded = new Set(config.excludeEffects ?? []);
  const described = [];

  for (const effect of snapshot.effects) {
    if (excluded.has(effect.name) || !effect.rules.some((rule) => rule.key === 'BattleForm')) continue;
    const { spell: spellName, variant } = parseEffectName(effect.name);
    const spell = spellsByName.get(spellName);
    if (!spell) throw new Error(`No spell named "${spellName}" for ${effect.name}`);

    const choiceSet = formChoiceSet(effect);
    const objectKey = choiceSet ? findObjectKey(choiceSet.choices) : null;
    const cosmetic = config.cosmetic?.[spell.slug];
    let forms;
    if (choiceSet) {
      forms = mergeChoices(choiceSet.choices, objectKey).map((choice) => ({
        key: `${spell.slug}:${choice.id}`,
        id: choice.id,
        name: choice.name ?? choice.id,
        label: choice.label,
        value: choice.value,
        predicate: choice.predicate,
      }));
    } else if (cosmetic) {
      // The effect has one form, but what the creature looks like is up to the caster.
      forms = cosmetic.map((entry) => ({
        key: `${spell.slug}:${entry.key}`,
        id: entry.key,
        name: entry.name,
        label: entry.label,
        minRank: entry.minRank,
        cosmetic: true,
      }));
    } else {
      const id = variant ? sluggify(variant) : 'default';
      forms = [{ key: `${spell.slug}:${id}`, id, name: variant ?? spell.name }];
    }
    described.push({ effect, spell, choiceSet, objectKey, forms });
  }
  return described;
}

/** Every creature name the catalogue may want. The fetch script keeps only these actors in the snapshot. */
export function wantedCreatureNames(snapshot, config) {
  const names = new Set();
  for (const { spell, forms } of describeEffects(snapshot, config)) {
    for (const form of forms)
      for (const name of candidateNames(config, spell.slug, form.key, form.name)) names.add(name);
  }
  return names;
}

/**
 * Builds the catalogue.
 * @param {object} snapshot scripts/data/pf2e-snapshot.json
 * @param {object} config scripts/data/form-config.json
 * @returns {object} The content of module/data/forms.json
 */
export function buildCatalogue(snapshot, config) {
  const spells = {};
  const effects = {};

  for (const { effect, spell, choiceSet, objectKey, forms } of describeEffects(snapshot, config)) {
    const entry = {
      uuid: effect.uuid,
      id: effect.id,
      name: effect.name,
      slug: effect.slug,
      spell: spell.slug,
      img: effect.img,
      remaster: effect.remaster,
      // Granted by a feat instead of the spell, so it is only reachable through Untamed Form.
      untamedOnly: effect.grantedBy?.pack === 'feats-srd',
      choiceSet: choiceSet
        ? {
            flag: choiceSet.flag ?? defaultChoiceFlag(effect.slug),
            index: choiceSet.index,
            ...(choiceSet.rollOption ? { rollOption: choiceSet.rollOption } : {}),
            ...(objectKey ? { objectKey } : {}),
          }
        : null,
      forms: forms.map((form) => {
        const battleForm = battleFormFor(effect, choiceSet, choiceSet ? form.id : null);
        const creature = pickCreature(snapshot, config, candidateNames(config, spell.slug, form.key, form.name));
        const minRank = form.minRank ?? minLevelOf(form.predicate);
        return {
          key: form.key,
          name: form.name,
          ...(form.label ? { label: form.label } : {}),
          ...(form.value !== undefined ? { value: form.value } : {}),
          ...(form.cosmetic ? { cosmetic: true } : {}),
          ...(minRank ? { minRank } : {}),
          ...(form.predicate?.length ? { predicate: form.predicate } : {}),
          ...(isObject(form.value) && form.value.tradition ? { group: form.value.tradition } : {}),
          // False for choices that are not a battle form at all (Devouring Dark Form's tentacle).
          battleForm: battleForm !== null,
          creature: creature?.uuid ?? null,
          creatureName: creature?.name ?? null,
          ...sizeAndMovement(battleForm, form.value),
        };
      }),
    };
    effects[effect.uuid] = entry;
    spells[spell.slug] ??= { slug: spell.slug, name: spell.name, uuid: spell.uuid, rank: spell.rank, effects: [] };
    spells[spell.slug].effects.push(effect.uuid);
  }

  for (const spell of Object.values(spells)) {
    // The effect named after the spell first, then its variants by name.
    const isBase = (uuid) => parseEffectName(effects[uuid].name).variant === null;
    spell.effects.sort(
      (a, b) => Number(isBase(b)) - Number(isBase(a)) || effects[a].name.localeCompare(effects[b].name),
    );
    // Effects from before the remaster stay in the system next to the remastered spell's own effect. The picker
    // lists them apart.
    const remastered = spell.effects.some((uuid) => effects[uuid].remaster);
    for (const uuid of spell.effects) {
      const { remaster, ...entry } = effects[uuid];
      effects[uuid] = { ...entry, legacy: remastered && !remaster };
    }
  }

  return {
    system: 'pf2e',
    pf2e: { ref: snapshot.ref, version: snapshot.version },
    untamed: buildUntamed(snapshot, effects),
    spells: Object.fromEntries(Object.entries(spells).sort(([a], [b]) => a.localeCompare(b))),
    effects: Object.fromEntries(
      Object.values(spells)
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .flatMap((spell) => spell.effects.map((uuid) => [uuid, effects[uuid]])),
    ),
  };
}

/** The Untamed Form entry: its choice reads the druid's known forms and grants the chosen spell effect. */
function buildUntamed(snapshot, effects) {
  const effect = snapshot.effects.find((e) =>
    e.rules.some((rule) => rule.key === 'ChoiceSet' && rule.choices === WILD_SHAPE_FORMS),
  );
  if (!effect) throw new Error('The snapshot has no Untamed Form effect');
  const choiceSet = effect.rules.find((rule) => rule.key === 'ChoiceSet' && rule.choices === WILD_SHAPE_FORMS);
  const grant = effect.rules.find((rule) => rule.key === 'GrantItem' && rule.uuid.includes(choiceSet.flag));
  if (!grant) throw new Error('The Untamed Form effect does not grant its chosen form');
  const spell = snapshot.spells.find((s) => s.name === parseEffectName(effect.name).spell);
  if (!spell) throw new Error('The snapshot has no Untamed Form spell');

  const byName = new Map(Object.values(effects).map((e) => [e.name, e.uuid]));
  const unlocks = [];
  for (const { feat, effect: effectName } of snapshot.untamedUnlocks) {
    const uuid = byName.get(effectName);
    if (!uuid) throw new Error(`${feat} unlocks "${effectName}", which is not in the catalogue`);
    if (!unlocks.includes(uuid)) unlocks.push(uuid);
  }

  return {
    slug: spell.slug,
    name: spell.name,
    uuid: spell.uuid,
    rank: spell.rank,
    effect: effect.uuid,
    effectId: effect.id,
    effectName: effect.name,
    effectSlug: effect.slug,
    img: effect.img,
    // Where the druid's known forms are stored on the actor.
    actorFlag: WILD_SHAPE_FORMS,
    choiceSet: { flag: choiceSet.flag, index: choiceSet.index },
    grant: { index: grant.index },
    // Every effect a feat can add to the list, for reference and tests.
    unlocks,
  };
}

/**
 * Compares a catalogue with a snapshot of the PF2e packs.
 * @returns {string[]} One message per difference; empty when the catalogue covers the snapshot.
 */
export function findCoverageGaps(snapshot, catalogue) {
  const gaps = [];
  const untamed = snapshot.effects.find((e) => e.uuid === catalogue.untamed?.effect);
  if (!untamed) gaps.push('Untamed Form effect is missing from the PF2e data');

  for (const effect of snapshot.effects) {
    if (effect === untamed) continue;
    const entry = catalogue.effects[effect.uuid];
    if (!entry) {
      gaps.push(`${effect.name} is not in the catalogue`);
      continue;
    }
    const choiceSet = formChoiceSet(effect);
    if (!choiceSet) continue;
    const objectKey = entry.choiceSet?.objectKey;
    const known = new Set(entry.forms.map((form) => JSON.stringify(form.value)));
    for (const choice of choiceSet.choices) {
      if (known.has(JSON.stringify(choice.value))) continue;
      const id = objectKey && isObject(choice.value) ? choice.value[objectKey] : JSON.stringify(choice.value);
      gaps.push(`${effect.name}: choice ${id} is not in the catalogue`);
    }
  }

  // The other direction: catalogue entries PF2e no longer has.
  const snapshotEffects = new Map(snapshot.effects.map((effect) => [effect.uuid, effect]));
  for (const entry of Object.values(catalogue.effects)) {
    const effect = snapshotEffects.get(entry.uuid);
    if (!effect) {
      gaps.push(`${entry.name} is in the catalogue but not in the PF2e data`);
      continue;
    }
    const values = new Set((formChoiceSet(effect)?.choices ?? []).map((choice) => JSON.stringify(choice.value)));
    for (const form of entry.forms) {
      if (form.value !== undefined && !values.has(JSON.stringify(form.value))) {
        gaps.push(`${entry.name}: ${form.key} is in the catalogue but not in the PF2e data`);
      }
    }
  }

  for (const { feat, effect: effectName } of snapshot.untamedUnlocks ?? []) {
    const uuid = Object.values(catalogue.effects).find((entry) => entry.name === effectName)?.uuid;
    if (!uuid || !catalogue.untamed?.unlocks.includes(uuid)) {
      gaps.push(`${feat} unlocks "${effectName}" for Untamed Form, which the catalogue does not list`);
    }
  }

  const creatures = new Set(snapshot.creatures.map((creature) => creature.uuid));
  for (const entry of Object.values(catalogue.effects)) {
    for (const form of entry.forms) {
      if (form.creature && !creatures.has(form.creature)) {
        gaps.push(`${form.key}: creature ${form.creature} is not in the PF2e data`);
      }
    }
  }
  return gaps;
}
