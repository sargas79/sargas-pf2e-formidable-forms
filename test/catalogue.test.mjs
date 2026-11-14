import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allForms,
  deepEqual,
  deriveForm,
  findChoiceSetIndex,
  findEffectEntry,
  findForm,
  formForSelection,
  isFormAvailable,
  isSameEffect,
  isUntamedEffect,
  movementAtRank,
  sizeAtRank,
} from '../module/scripts/catalogue.mjs';
import { MODULE_ID } from '../module/scripts/constants.mjs';
import { catalogue, effectSource, effectsOf, formByKey } from './helpers.mjs';

const [animal] = effectsOf('animal-form');
const [dragon] = effectsOf('dragon-form');

test('deepEqual compares JSON data and ignores key order', () => {
  assert.ok(deepEqual({ a: 1, b: { c: [1, null] } }, { b: { c: [1, null] }, a: 1 }));
  assert.ok(!deepEqual({ a: 1 }, { a: 1, b: 2 }));
  assert.ok(!deepEqual([1, 2], [2, 1]));
  assert.ok(!deepEqual({ a: null }, { a: {} }));
  assert.ok(deepEqual('bear', 'bear'));
});

test('forms are found by key', () => {
  assert.equal(allForms(catalogue).length, 147);
  const found = findForm(catalogue, 'demon-form:babau');
  assert.equal(found.effect.name, 'Spell Effect: Demon Form (Babau)');
  assert.equal(found.form.name, 'Babau');
  assert.equal(findForm(catalogue, 'animal-form:unicorn'), null);
  assert.equal(findForm(catalogue, 'no-such-spell:x'), null);
  assert.equal(findForm(catalogue, undefined), null);
});

test('an effect is recognised by the compendium UUID it came from', () => {
  const source = effectSource('Spell Effect: Animal Form');
  assert.equal(findEffectEntry(catalogue, source), animal);
  // A duplicate of an owned effect, and the pre-v12 flag.
  assert.equal(findEffectEntry(catalogue, { type: 'effect', _stats: { duplicateSource: animal.uuid } }), animal);
  assert.equal(findEffectEntry(catalogue, { type: 'effect', flags: { core: { sourceId: animal.uuid } } }), animal);
  // The PF2e source links effects by name.
  const byName = 'Compendium.pf2e.spell-effects.Item.Spell Effect: Animal Form';
  assert.ok(isSameEffect(byName, animal));
  assert.equal(findEffectEntry(catalogue, { type: 'effect', _stats: { compendiumSource: byName } }), animal);
  // A copy that lost its origin still matches by slug.
  assert.equal(findEffectEntry(catalogue, { type: 'effect', system: { slug: 'spell-effect-animal-form' } }), animal);
});

test('other items are not form effects', () => {
  assert.equal(findEffectEntry(catalogue, { type: 'effect', system: { slug: 'spell-effect-bless' } }), null);
  assert.equal(
    findEffectEntry(catalogue, { type: 'effect', _stats: { compendiumSource: 'Compendium.pf2e.x.Item.y' } }),
    null,
  );
  assert.equal(findEffectEntry(catalogue, { ...effectSource('Spell Effect: Animal Form'), type: 'feat' }), null);
  assert.equal(findEffectEntry(catalogue, null), null);
  // Untamed Form is not a form itself.
  const untamed = effectSource('Spell Effect: Untamed Form');
  assert.equal(findEffectEntry(catalogue, untamed), null);
  assert.ok(isUntamedEffect(catalogue, untamed));
  assert.ok(!isUntamedEffect(catalogue, effectSource('Spell Effect: Animal Form')));
});

test('the form ChoiceSet is found by flag, roll option or position', () => {
  const { rules } = effectSource('Spell Effect: Animal Form').system;
  assert.equal(findChoiceSetIndex(rules, animal.choiceSet), 0);
  // After creation the system has written the flag into the rule; rules may have been reordered by another module.
  const created = [{ key: 'Note' }, { ...rules[0], flag: 'spellEffectAnimalForm', rollOption: undefined }];
  assert.equal(findChoiceSetIndex(created, animal.choiceSet), 1);
  const byOption = [{ key: 'Note' }, { key: 'ChoiceSet', rollOption: 'animal-form', choices: [] }];
  assert.equal(findChoiceSetIndex(byOption, animal.choiceSet), 1);
  assert.equal(findChoiceSetIndex([{ key: 'Note' }], animal.choiceSet), -1);
  assert.equal(findChoiceSetIndex(rules, null), -1);
});

test('a selection maps back to its form', () => {
  assert.equal(formForSelection(animal, 'bear').key, 'animal-form:bear');
  assert.equal(formForSelection(animal, 'horse'), null);
  assert.equal(formForSelection(animal, null), null);
  const adamantine = formByKey('dragon-form:adamantine');
  assert.equal(formForSelection(dragon, structuredClone(adamantine.value)), adamantine);
  // PF2e changed a detail of the choice since the catalogue was built.
  assert.equal(formForSelection(dragon, { ...adamantine.value, damageType: 'slashing' }), adamantine);
  assert.equal(formForSelection(dragon, { dragonType: 'unknown' }), null);
});

test('the form of an effect comes from the module flag, a hint, the selection, or its only form', () => {
  const chosen = effectSource('Spell Effect: Animal Form');
  chosen.system.rules[0].selection = 'bear';
  assert.equal(deriveForm(animal, chosen).key, 'animal-form:bear');

  // The system also records the selection in the item's flags.
  const flagged = effectSource('Spell Effect: Animal Form');
  flagged.flags.pf2e = { rulesSelections: { spellEffectAnimalForm: 'cat' } };
  assert.equal(deriveForm(animal, flagged).key, 'animal-form:cat');

  // No selection yet: unknown.
  assert.equal(deriveForm(animal, effectSource('Spell Effect: Animal Form')), null);

  const dragonSource = effectSource('Spell Effect: Dragon Form');
  dragonSource.system.rules[0].selection = structuredClone(formByKey('dragon-form:wish').value);
  assert.equal(deriveForm(dragon, dragonSource).key, 'dragon-form:wish');

  // Single-form effects need no selection.
  const [elephant] = effectsOf('elephant-form');
  assert.equal(deriveForm(elephant, effectSource('Spell Effect: Elephant Form')).key, 'elephant-form:default');

  // Pest Form's look is not a PF2e choice: the flag or the hint says which, the first form is the default.
  const [pest] = effectsOf('pest-form');
  const pestSource = effectSource('Spell Effect: Pest Form');
  assert.equal(deriveForm(pest, pestSource).key, 'pest-form:rat');
  assert.equal(deriveForm(pest, pestSource, 'pest-form:cat').key, 'pest-form:cat');
  pestSource.flags[MODULE_ID] = { form: 'pest-form:fox' };
  assert.equal(deriveForm(pest, pestSource, 'pest-form:cat').key, 'pest-form:fox');
  // A flag from another effect is ignored.
  pestSource.flags[MODULE_ID] = { form: 'animal-form:bear' };
  assert.equal(deriveForm(pest, pestSource).key, 'pest-form:rat');
});

test('size and movement depend on the cast rank', () => {
  const bear = formByKey('animal-form:bear');
  assert.equal(sizeAtRank(bear, 2), 'med');
  assert.equal(sizeAtRank(bear, 4), 'lg');
  assert.equal(sizeAtRank(bear, 9), 'huge');
  // Aberrant Form only sets a size in its brackets; Devouring Dark Form's tentacle never does.
  assert.equal(sizeAtRank(formByKey('aberrant-form:gug'), 5), 'lg');
  assert.equal(sizeAtRank(formByKey('devouring-dark-form:tentacle'), 9), null);
  assert.deepEqual(movementAtRank(formByKey('animal-form:snake'), 2), ['climb', 'swim']);
  assert.deepEqual(movementAtRank(formByKey('pest-form:rat'), 3), []);
  assert.deepEqual(movementAtRank(formByKey('pest-form:rat'), 4), ['fly']);
});

test('forms are gated by rank and by the feats their predicate asks for', () => {
  const shark = formByKey('devouring-dark-form:shark');
  assert.ok(!isFormAvailable(shark, { rank: 1 }));
  assert.ok(isFormAvailable(shark, { rank: 2 }));

  const caveWorm = formByKey('devouring-dark-form:cave-worm');
  const options = ['feat:monstrous-inclinations', 'feature:lurker-in-devouring-dark'];
  assert.ok(!isFormAvailable(caveWorm, { rank: 9 }));
  assert.ok(!isFormAvailable(caveWorm, { rank: 7, options }));
  assert.ok(isFormAvailable(caveWorm, { rank: 8, options }));

  // Aerial Form's pterosaur: always on a normal cast, only with Ferocious Shape through Untamed Form.
  const pterosaur = formByKey('aerial-form:pterosaur');
  assert.ok(isFormAvailable(pterosaur, { rank: 4 }));
  assert.ok(!isFormAvailable(pterosaur, { rank: 4, untamed: true }));
  assert.ok(isFormAvailable(pterosaur, { rank: 4, untamed: true, options: ['feat:ferocious-shape'] }));
  // A normal cast while an Untamed Form effect is still on the caster: that effect is about to be replaced.
  assert.ok(isFormAvailable(pterosaur, { rank: 4, options: ['self:effect:untamed-form'] }));

  const phoenix = formByKey('monstrosity-form:phoenix');
  assert.ok(isFormAvailable(phoenix, { rank: 8 }));
  assert.ok(!isFormAvailable(phoenix, { rank: 8, untamed: true }));
  assert.ok(isFormAvailable(phoenix, { rank: 8, untamed: true, options: ['feat:soaring-shape'] }));

  assert.ok(!isFormAvailable(formByKey('pest-form:raven'), { rank: 3 }));
  assert.ok(isFormAvailable(formByKey('pest-form:raven'), { rank: 4 }));
  assert.ok(isFormAvailable(formByKey('animal-form:bear'), { rank: 2 }));
});
