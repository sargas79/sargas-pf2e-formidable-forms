// Shared test fixtures: the shipped catalogue and plain objects standing in for Foundry documents.
import { readFileSync } from 'node:fs';

const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));

export const catalogue = readJson('../module/data/forms.json');
export const snapshot = readJson('../scripts/data/pf2e-snapshot.json');
export const en = readJson('../module/lang/en.json');

export const effectsOf = (slug) => catalogue.spells[slug].effects.map((uuid) => catalogue.effects[uuid]);
export const formByKey = (key) =>
  Object.values(catalogue.effects)
    .flatMap((effect) => effect.forms)
    .find((form) => form.key === key);

/**
 * Source data of a spell effect as it comes out of the compendium: the snapshot's rules (ChoiceSet, BattleForm and
 * GrantItem only) at their original positions, with placeholder rules in between.
 */
export function effectSource(name) {
  const effect = snapshot.effects.find((e) => e.name === name);
  if (!effect) throw new Error(`No effect named ${name} in the snapshot`);
  const rules = [];
  for (const { index, ...rule } of effect.rules) rules[index] = structuredClone(rule);
  for (let i = 0; i < rules.length; i++) rules[i] ??= { key: 'Note', text: `placeholder ${i}` };
  return {
    _id: effect.id,
    name: effect.name,
    type: 'effect',
    img: effect.img,
    system: { slug: effect.slug, level: { value: effect.level }, rules, traits: { value: [] } },
    flags: {},
    _stats: { compendiumSource: effect.uuid },
  };
}

/** Looks up a dotted key in the module's English strings. */
export const english = (key) => key.split('.').reduce((node, part) => node?.[part], en);
