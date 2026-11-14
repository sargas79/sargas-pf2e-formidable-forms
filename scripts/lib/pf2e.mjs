// What the form catalogue needs from the PF2e system source, reduced to plain data. These functions are pure: the
// file reading is in scripts/fetch-pf2e.mjs, and the result is saved as scripts/data/pf2e-snapshot.json so the
// catalogue can be rebuilt and tested offline.

/** The PF2e repository and the commit of its `v14-dev` branch the committed snapshot was taken from. */
export const PF2E_REPO = 'https://github.com/foundryvtt/pf2e.git';
export const PF2E_REF = 'dd72f1a6f25f3f61990847bfb90b5b4d1c516e90';
export const PF2E_BRANCH = 'v14-dev';
export const PF2E_SYSTEM_ID = 'pf2e';

const EFFECT_PREFIX = 'Spell Effect: ';
/** The actor path the Untamed Form effect reads its choices from. */
export const WILD_SHAPE_FORMS = 'flags.system.wildShapeForms';

/** The system's slug algorithm (src/util/misc.ts `sluggify`), for the plain names used here. */
export function sluggify(text) {
  return text
    .replace(/([a-z])([A-Z])\B/g, '$1-$2')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/[-\s]+/g, '-');
}

export const compendiumUuid = (packName, type, id) => `Compendium.${PF2E_SYSTEM_ID}.${packName}.${type}.${id}`;

/** An effect is a form effect when it carries a BattleForm rule, or is Untamed Form (which grants one). */
export const isBattleFormEffect = (doc) =>
  doc.type === 'effect' && (doc.system?.rules ?? []).some((rule) => rule.key === 'BattleForm');
export const isUntamedFormEffect = (doc) =>
  doc.type === 'effect' &&
  (doc.system?.rules ?? []).some((rule) => rule.key === 'ChoiceSet' && rule.choices === WILD_SHAPE_FORMS);

/** "Spell Effect: Dinosaur Form (Ankylosaurus)" → { spell: "Dinosaur Form", variant: "Ankylosaurus" }. */
export function parseEffectName(name) {
  const base = name.startsWith(EFFECT_PREFIX) ? name.slice(EFFECT_PREFIX.length) : name;
  const match = /^(.*?)\s*\(([^)]+)\)$/.exec(base);
  return match ? { spell: match[1], variant: match[2] } : { spell: base, variant: null };
}

/** The document an effect's description says it is granted by: `{ pack, name }`, or null. */
function parseGrantedBy(description = '') {
  const match = /Granted by @UUID\[Compendium\.pf2e\.([^.]+)\.Item\.([^\]]+)\]/.exec(description);
  return match ? { pack: match[1], name: match[2] } : null;
}

/** Keeps only what the catalogue reads from a BattleForm's overrides or bracket value. */
function trimOverrides(overrides = {}) {
  const out = {};
  if (overrides.size) out.size = overrides.size;
  if (overrides.speeds) out.speeds = overrides.speeds;
  return out;
}

/**
 * Reduces a rule element to what the catalogue needs, or null for rules it doesn't read. `index` is the rule's
 * position in the effect's rules array, which the module uses to find the rule again at runtime.
 * @param {object} rule The rule source
 * @param {number} index Its position in `system.rules`
 * @param {(key: string) => string | null} localize Looks up an English string in the system's language files
 */
function trimRule(rule, index, localize) {
  switch (rule.key) {
    case 'ChoiceSet': {
      const out = { index, key: rule.key };
      for (const prop of ['flag', 'rollOption', 'predicate']) if (rule[prop] !== undefined) out[prop] = rule[prop];
      out.choices = Array.isArray(rule.choices)
        ? rule.choices.map((choice) => ({
            label: choice.label,
            name: localize(choice.label),
            value: choice.value,
            ...(choice.predicate ? { predicate: choice.predicate } : {}),
          }))
        : rule.choices;
      return out;
    }
    case 'BattleForm': {
      const out = { index, key: rule.key };
      if (rule.predicate) out.predicate = rule.predicate;
      out.overrides = trimOverrides(rule.overrides ?? rule.value);
      if (rule.brackets?.length) {
        out.brackets = rule.brackets.map((bracket) => ({ start: bracket.start, value: trimOverrides(bracket.value) }));
      }
      return out;
    }
    case 'GrantItem': {
      const out = { index, key: rule.key, uuid: rule.uuid };
      if (rule.predicate) out.predicate = rule.predicate;
      return out;
    }
    default:
      return null;
  }
}

/** Reduces a spell effect source document to a snapshot entry. */
export function trimEffect(doc, packName, localize) {
  return {
    id: doc._id,
    uuid: compendiumUuid(packName, 'Item', doc._id),
    name: doc.name,
    slug: sluggify(doc.name),
    img: doc.img,
    level: doc.system.level?.value ?? 1,
    remaster: doc.system.publication?.remaster === true,
    grantedBy: parseGrantedBy(doc.system.description?.value),
    rules: (doc.system.rules ?? []).flatMap((rule, index) => trimRule(rule, index, localize) ?? []),
  };
}

/** Reduces a spell source document to a snapshot entry. */
export function trimSpell(doc, packName) {
  return {
    id: doc._id,
    uuid: compendiumUuid(packName, 'Item', doc._id),
    name: doc.name,
    slug: sluggify(doc.name),
    rank: doc.system.level.value,
    focus: (doc.system.traits?.value ?? []).includes('focus'),
    traditions: doc.system.traits?.traditions ?? [],
  };
}

/** Reduces an actor source document to a snapshot entry. Returns null for anything that isn't an NPC. */
export function trimActor(doc, packName) {
  if (doc.type !== 'npc') return null;
  return {
    uuid: compendiumUuid(packName, 'Actor', doc._id),
    pack: packName,
    id: doc._id,
    name: doc.name,
    level: doc.system?.details?.level?.value ?? null,
    size: doc.system?.traits?.size?.value ?? null,
    remaster: doc.system?.details?.publication?.remaster === true,
    img: doc.img ?? null,
    tokenImg: doc.prototypeToken?.texture?.src ?? null,
  };
}

/**
 * The spell effects a feat adds to the druid's Untamed Form list: every `value` its rule elements write to
 * `flags.system.wildShapeForms`. Returns the effect names (the source links effects by name).
 */
export function wildShapeUnlocks(doc) {
  const names = [];
  for (const rule of doc.system?.rules ?? []) {
    if (rule.key !== 'ActiveEffectLike' || rule.path !== WILD_SHAPE_FORMS) continue;
    for (const entry of [rule.value].flat()) {
      const match = /^Compendium\.pf2e\.spell-effects\.Item\.(.+)$/.exec(entry?.value ?? '');
      if (match) names.push(match[1]);
    }
  }
  return [...new Set(names)];
}

/** A lookup into the system's English language files, merged in the order given. Returns null for unknown keys. */
export function createLocalizer(...languageFiles) {
  return (key) => {
    if (typeof key !== 'string') return null;
    for (const file of languageFiles) {
      const value = key.split('.').reduce((node, part) => node?.[part], file);
      if (typeof value === 'string') return value;
    }
    return null;
  };
}
