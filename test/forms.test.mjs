// The form catalogue: it must be reproducible from the committed PF2e snapshot, and cover everything in it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalogue, defaultChoiceFlag, findCoverageGaps } from '../scripts/lib/forms.mjs';
import { FORMS_FILE, FORM_CONFIG_FILE, SNAPSHOT_FILE } from '../scripts/lib/paths.mjs';
import { PF2E_REF } from '../scripts/lib/pf2e.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const snapshot = readJson(SNAPSHOT_FILE);
const config = readJson(FORM_CONFIG_FILE);
const catalogue = readJson(FORMS_FILE);

const effectsOf = (slug) => catalogue.spells[slug].effects.map((uuid) => catalogue.effects[uuid]);
const formNames = (slug) => effectsOf(slug).flatMap((effect) => effect.forms.map((form) => form.name));
const allForms = Object.values(catalogue.effects).flatMap((effect) => effect.forms);

/** The supported forms from docs/PLAN.md, by spell slug. */
const SUPPORTED = {
  'aberrant-form': ['Chuul', 'Gogiteth', 'Gug', 'Ofalth'],
  'aerial-form': ['Bat', 'Bird', 'Pterosaur', 'Wasp'],
  'angel-form': ['Balisse', 'Choral', 'Kuribu', 'Tennin', 'Monadic Deva', 'Movanic Deva'],
  'animal-form': [
    ...['Ape', 'Bear', 'Bull', 'Canine', 'Cat', 'Crab', 'Crocodile', 'Deer', 'Frog', 'Orca', 'Seal', 'Shark', 'Snake'],
  ],
  'cosmic-form': ['Moon', 'Sun'],
  'daemon-form': ['Lacridaemon', 'Leukodaemon', 'Meladaemon', 'Venedaemon', 'Ceustodaemon', 'Piscodaemon'],
  'demon-form': ['Abrikandilu', 'Brimorak', 'Kithangian', 'Vloriak', 'Babau', 'Hezrou', 'Nabasu', 'Vrock'],
  'devil-form': ['Coarti', 'Levaloch', 'Sarglagon', 'Vordine', 'Barbazu', 'Erinys', 'Osyluth'],
  'devouring-dark-form': ['Tentacle', 'Shark', 'Water Elemental', 'Cave Worm', 'Sea Serpent'],
  'dinosaur-form': ['Ankylosaurus', 'Brontosaurus', 'Deinonychus', 'Stegosaurus', 'Triceratops', 'Tyrannosaurus'],
  'element-embodied': ['Air', 'Earth', 'Fire', 'Metal', 'Water', 'Wood'],
  'elemental-form': ['Air', 'Earth', 'Fire', 'Metal', 'Water', 'Wood'],
  'elephant-form': ['Elephant Form'],
  'fey-form': ['Dryad', 'Elananx', 'Naiad', 'Redcap', 'Unicorn'],
  'insect-form': ['Ant', 'Beetle', 'Centipede', 'Mantis', 'Scorpion', 'Spider'],
  'monstrosity-form': ['Cave Worm', 'Phoenix', 'Sea Serpent', 'Kaiju'],
  'nature-incarnate': ['Green Man', 'Kaiju'],
  'ooze-form': ['Black Pudding', 'Gelatinous Cube', 'Gray Ooze', 'Ochre Jelly'],
  'plant-form': ['Arboreal', 'Flytrap'],
  'sacred-form': ['Sacred Form'],
};

test('the snapshot was taken at the pinned PF2e commit', () => {
  assert.equal(snapshot.ref, PF2E_REF);
  assert.equal(catalogue.pf2e.ref, PF2E_REF);
});

test('the generator reproduces forms.json from the snapshot with no manual edits', () => {
  assert.deepEqual(buildCatalogue(snapshot, config), catalogue);
});

test('the catalogue covers every form choice in the PF2e snapshot', () => {
  assert.deepEqual(findCoverageGaps(snapshot, catalogue), []);
});

test('a form choice added by a PF2e update is reported', () => {
  const updated = structuredClone(snapshot);
  const animalForm = updated.effects.find((effect) => effect.name === 'Spell Effect: Animal Form');
  const choiceSet = animalForm.rules.find((rule) => rule.key === 'ChoiceSet');
  choiceSet.choices.push({ label: 'PF2E.SpecificRule.AnimalForm.Horse', name: 'Horse', value: 'horse' });
  assert.deepEqual(findCoverageGaps(updated, catalogue), [
    'Spell Effect: Animal Form: choice "horse" is not in the catalogue',
  ]);

  // Object choices (Dragon Form) are reported by the property that identifies them.
  const dragonForm = updated.effects.find((effect) => effect.name === 'Spell Effect: Dragon Form');
  const dragons = dragonForm.rules.find((rule) => rule.key === 'ChoiceSet').choices;
  dragons.push({ label: 'PF2E.Dragon.Zzz', name: 'Zzz Dragon', value: { ...dragons[0].value, dragonType: 'zzz' } });
  assert.ok(
    findCoverageGaps(updated, catalogue).includes('Spell Effect: Dragon Form: choice zzz is not in the catalogue'),
  );
});

test('new, removed and changed effects are reported', () => {
  const added = structuredClone(snapshot);
  added.effects.push({ ...added.effects[0], id: 'newEffect0000000', uuid: 'Compendium.pf2e.spell-effects.Item.new' });
  added.effects.at(-1).name = 'Spell Effect: Giant Form';
  assert.deepEqual(findCoverageGaps(added, catalogue), ['Spell Effect: Giant Form is not in the catalogue']);

  const removed = structuredClone(snapshot);
  removed.effects = removed.effects.filter((effect) => effect.name !== 'Spell Effect: Elephant Form');
  assert.deepEqual(findCoverageGaps(removed, catalogue), [
    'Spell Effect: Elephant Form is in the catalogue but not in the PF2e data',
  ]);

  const dropped = structuredClone(snapshot);
  const plantForm = dropped.effects.find((effect) => effect.name === 'Spell Effect: Plant Form');
  plantForm.rules.find((rule) => rule.key === 'ChoiceSet').choices.pop();
  assert.deepEqual(findCoverageGaps(dropped, catalogue), [
    'Spell Effect: Plant Form: plant-form:flytrap is in the catalogue but not in the PF2e data',
  ]);

  const unlocked = structuredClone(snapshot);
  unlocked.untamedUnlocks.push({ feat: 'Fey Shape', effect: 'Spell Effect: Fey Form' });
  const gaps = findCoverageGaps(unlocked, catalogue);
  assert.deepEqual(gaps, [
    'Fey Shape unlocks "Spell Effect: Fey Form" for Untamed Form, which the catalogue does not list',
  ]);
});

test('every supported form in the plan is in the catalogue', () => {
  for (const [slug, names] of Object.entries(SUPPORTED)) {
    assert.ok(catalogue.spells[slug], `${slug} is missing`);
    assert.deepEqual(formNames(slug).sort(), [...names].sort(), slug);
  }
  assert.equal(formNames('dragon-form').length, 40);
  assert.ok(formNames('dragon-form').includes('Adamantine Dragon'));
  assert.ok(formNames('dragon-form').includes('Wish Dragon'));
  // Pest Form has one set of statistics; its forms are cosmetic choices for the art.
  assert.ok(effectsOf('pest-form')[0].forms.every((form) => form.cosmetic && form.value === undefined));
  assert.ok(formNames('pest-form').includes('Rat'));
});

test('form keys are unique and start with the spell slug', () => {
  const keys = allForms.map((form) => form.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const effect of Object.values(catalogue.effects)) {
    for (const form of effect.forms) assert.ok(form.key.startsWith(`${effect.spell}:`), form.key);
  }
});

test('every form has a creature that resolves in the PF2e packs, except the documented gaps', () => {
  const creatures = new Map(snapshot.creatures.map((creature) => [creature.uuid, creature]));
  const without = [];
  for (const form of allForms) {
    if (!form.creature) {
      without.push(form.key);
      continue;
    }
    assert.match(form.creature, /^Compendium\.pf2e\.[a-z0-9-]+\.Actor\.[A-Za-z0-9]{16}$/, form.key);
    assert.equal(creatures.get(form.creature)?.name, form.creatureName, form.key);
  }
  assert.deepEqual(without.sort(), Object.keys(config.noCreature).sort());
});

test('creatures come from the remaster packs when they have one', () => {
  const pack = (key) => allForms.find((form) => form.key === key).creature.split('.')[2];
  // Giant Mantis exists in both Monster Core and the legacy Bestiary.
  assert.equal(pack('insect-form:mantis'), 'pathfinder-monster-core');
  assert.equal(pack('animal-form:canine'), 'pathfinder-monster-core');
  assert.equal(pack('dragon-form:cinder'), 'pathfinder-monster-core-2');
  // Only in a legacy bestiary.
  assert.equal(pack('ooze-form:gray-ooze'), 'pathfinder-bestiary-2');
  const names = Object.fromEntries(allForms.map((form) => [form.key, form.creatureName]));
  assert.equal(names['animal-form:bear'], 'Grizzly Bear');
  assert.equal(names['elemental-form:air'], 'Living Whirlwind');
  assert.equal(names['dragon-form:adamantine'], 'Adamantine Dragon (Adult)');
});

test('choice-set effects record the flag, the rule position and the allowed values', () => {
  const [animal] = effectsOf('animal-form');
  assert.deepEqual(animal.choiceSet, { flag: 'spellEffectAnimalForm', index: 0, rollOption: 'animal-form' });
  assert.equal(animal.forms.find((form) => form.key === 'animal-form:bear').value, 'bear');

  // Dragon Form sets its flag explicitly and its values are objects.
  const [dragon] = effectsOf('dragon-form');
  assert.deepEqual(dragon.choiceSet, { flag: 'dragonForm', index: 0, objectKey: 'dragonType' });
  const adamantine = dragon.forms.find((form) => form.key === 'dragon-form:adamantine');
  assert.equal(adamantine.value.dragonType, 'adamantine');
  assert.equal(adamantine.group, 'primal');
  assert.deepEqual(adamantine.movement, [{ rank: 0, types: ['burrow', 'fly'] }]);

  assert.equal(defaultChoiceFlag('spell-effect-devouring-dark-form'), 'spellEffectDevouringDarkForm');
});

test('separate-effect spells list one effect per form, each with its own UUID', () => {
  for (const [slug, count] of [
    ['dinosaur-form', 6],
    ['element-embodied', 6],
  ]) {
    const effects = effectsOf(slug);
    assert.equal(effects.length, count, slug);
    assert.equal(new Set(effects.map((effect) => effect.uuid)).size, count);
    for (const effect of effects) {
      assert.equal(effect.choiceSet, null);
      assert.equal(effect.forms.length, 1);
      assert.equal(effect.forms[0].value, undefined);
    }
  }
  // Pre-remaster effects that sit next to the remastered spell's own effect.
  const legacy = (slug) => effectsOf(slug).filter((effect) => effect.legacy);
  assert.equal(legacy('demon-form').length, 4);
  assert.equal(legacy('devil-form').length, 3);
  assert.equal(legacy('daemon-form').length, 2);
  assert.equal(legacy('angel-form').length, 2);
  // A spell that was never remastered has no "legacy" effects: its only effect is the current one.
  assert.equal(legacy('ooze-form').length, 0);

  const kaiju = effectsOf('monstrosity-form').find((effect) => effect.name.endsWith('(Kaiju)'));
  assert.equal(kaiju.untamedOnly, true);
  assert.equal(Object.values(catalogue.effects).filter((effect) => effect.untamedOnly).length, 1);
});

test('rank gating comes from the choice predicates', () => {
  const [dark] = effectsOf('devouring-dark-form');
  const minRanks = Object.fromEntries(dark.forms.map((form) => [form.key, form.minRank ?? null]));
  assert.deepEqual(minRanks, {
    'devouring-dark-form:tentacle': null,
    'devouring-dark-form:shark': 2,
    'devouring-dark-form:water-elemental': 5,
    'devouring-dark-form:cave-worm': 8,
    'devouring-dark-form:sea-serpent': 8,
  });
  // The tentacle is a morph, not a battle form.
  assert.equal(dark.forms[0].battleForm, false);
  assert.ok(allForms.filter((form) => form !== dark.forms[0]).every((form) => form.battleForm));
  assert.equal(allForms.find((form) => form.key === 'pest-form:raven').minRank, 4);
});

test('choices repeated with different predicates are merged into one form', () => {
  const [monstrosity] = effectsOf('monstrosity-form');
  const phoenixes = monstrosity.forms.filter((form) => form.value === 'phoenix');
  assert.equal(phoenixes.length, 1);
  assert.deepEqual(phoenixes[0].predicate, [
    {
      or: [{ and: [{ not: 'self:effect:untamed-form' }] }, { and: ['self:effect:untamed-form', 'feat:soaring-shape'] }],
    },
  ]);
});

test('sizes and movement follow the BattleForm rule and its heightened brackets', () => {
  const form = (key) => allForms.find((f) => f.key === key);
  assert.deepEqual(form('animal-form:snake').sizes, [
    { rank: 0, size: 'med' },
    { rank: 4, size: 'lg' },
    { rank: 5, size: 'huge' },
  ]);
  assert.deepEqual(form('animal-form:snake').movement, [{ rank: 0, types: ['climb', 'swim'] }]);
  // Sizes written as "large" and "gargantuan" in the source are normalised.
  assert.deepEqual(form('demon-form:kithangian').sizes, [{ rank: 0, size: 'lg' }]);
  assert.deepEqual(form('demon-form:brimorak').sizes, [{ rank: 0, size: 'med' }]);
  assert.deepEqual(form('monstrosity-form:kaiju').sizes, [{ rank: 0, size: 'grg' }]);
  // Pest Form gains a fly Speed at rank 4.
  assert.deepEqual(form('pest-form:rat').movement, [{ rank: 4, types: ['fly'] }]);
  const sizes = new Set(allForms.flatMap((f) => f.sizes.map((s) => s.size)));
  assert.deepEqual([...sizes].sort(), ['grg', 'huge', 'lg', 'med', 'sm', 'tiny']);
});

test('the Untamed Form entry names the actor flag and the effects feats can unlock', () => {
  const { untamed } = catalogue;
  assert.equal(untamed.slug, 'untamed-form');
  assert.equal(untamed.actorFlag, 'flags.system.wildShapeForms');
  assert.deepEqual(untamed.choiceSet, { flag: 'formEffect', index: 0 });
  assert.deepEqual(untamed.grant, { index: 1 });
  assert.equal(catalogue.effects[untamed.effect], undefined);
  for (const uuid of untamed.unlocks) assert.ok(catalogue.effects[uuid], uuid);
  const unlocked = untamed.unlocks.map((uuid) => catalogue.effects[uuid].name);
  assert.ok(unlocked.includes('Spell Effect: Pest Form'));
  assert.ok(unlocked.includes('Spell Effect: Dragon Form'));
  assert.ok(unlocked.includes('Spell Effect: Monstrosity Form (Kaiju)'));
});

test('module strings exist for the forms this module names itself', () => {
  const en = readJson(new URL('../module/lang/en.json', import.meta.url));
  const own = allForms.filter((form) => form.label?.startsWith('SARGAS_FORMS.'));
  assert.ok(own.length > 0);
  for (const form of own) {
    const text = form.label.split('.').reduce((node, part) => node?.[part], en);
    assert.equal(text, form.name, form.label);
  }
});
