// The picker's filter, grouping and rank gating. The dialog itself needs Foundry (see docs/TESTING.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEGACY_GROUP,
  groupChoices,
  initialState,
  listChoices,
  matchesQuery,
  normalize,
  spellsOf,
  toResult,
} from '../module/scripts/picker-logic.mjs';
import { catalogue, english } from './helpers.mjs';

const choicesFor = (slug, rank, options) => listChoices(catalogue, catalogue.spells[slug], { rank, options });
const uuidOf = (name) =>
  Object.values(catalogue.effects).find((effect) => effect.name === `Spell Effect: ${name}`).uuid;
const untamedChoices = (names, rank = 4, options = []) =>
  listChoices(catalogue, catalogue.untamed, {
    rank,
    options,
    wildShapeForms: names.map((name) => ({ value: uuidOf(name) })),
  });

test('the search ignores case and accents and matches every word typed', () => {
  assert.equal(normalize('  Élananx '), 'elananx');
  assert.ok(matchesQuery('Adamantine Dragon', ''));
  assert.ok(matchesQuery('Adamantine Dragon', 'ADAM'));
  assert.ok(matchesQuery('Adamantine Dragon', 'dragon adam'));
  assert.ok(!matchesQuery('Adamantine Dragon', 'adam wolf'));
  assert.ok(matchesQuery('Gelatinous Cube', 'cube'));
  assert.ok(!matchesQuery('Gelatinous Cube', 'ooze'));
});

test('the search narrows the 40 dragons', () => {
  const dragons = choicesFor('dragon-form', 6);
  assert.equal(dragons.length, 40);
  const found = dragons.filter((choice) => matchesQuery(choice.form.name, 'sto'));
  assert.deepEqual(
    found.map((choice) => choice.form.key),
    ['dragon-form:stormcrown'],
  );
});

test('dragons are grouped by tradition', () => {
  const groups = groupChoices(choicesFor('dragon-form', 6));
  assert.deepEqual(
    groups.map(({ group }) => group),
    ['arcane', 'divine', 'occult', 'primal'],
  );
  assert.equal(
    groups.reduce((sum, { choices }) => sum + choices.length, 0),
    40,
  );
  const arcane = groups[0].choices.map((choice) => choice.form.key);
  assert.ok(arcane.includes('dragon-form:fortune'));
  assert.ok(!arcane.includes('dragon-form:adamantine'));
  // Every group has a heading in the language file.
  for (const { group } of groups) assert.equal(typeof english(`SARGAS_FORMS.Group.${group}`), 'string');
});

test('pre-remaster forms are listed apart, after the current ones', () => {
  const groups = groupChoices(choicesFor('demon-form', 6));
  assert.deepEqual(
    groups.map(({ group }) => group),
    [null, LEGACY_GROUP],
  );
  assert.deepEqual(
    groups[0].choices.map((choice) => choice.form.name),
    ['Abrikandilu', 'Brimorak', 'Kithangian', 'Vloriak'],
  );
  assert.deepEqual(
    groups[1].choices.map((choice) => choice.form.name),
    ['Babau', 'Hezrou', 'Nabasu', 'Vrock'],
  );
  assert.equal(typeof english(`SARGAS_FORMS.Group.${LEGACY_GROUP}`), 'string');
  // A spell without groups is one unnamed group.
  assert.deepEqual(
    groupChoices(choicesFor('animal-form', 2)).map(({ group }) => group),
    [null],
  );
});

test('a cast shows only the forms its rank allows', () => {
  const keys = (rank, options) => choicesFor('devouring-dark-form', rank, options).map((choice) => choice.form.key);
  assert.deepEqual(keys(1), ['devouring-dark-form:tentacle']);
  assert.deepEqual(keys(4), ['devouring-dark-form:tentacle', 'devouring-dark-form:shark']);
  // Rank alone is not enough for the monstrous forms.
  assert.equal(keys(9).length, 3);
  assert.equal(keys(9, ['feat:monstrous-inclinations', 'feature:lurker-in-devouring-dark']).length, 5);
  // A rank 6 Demon Form: nothing above its rank is offered, and nothing is missing.
  assert.equal(choicesFor('demon-form', 6).length, 8);
  assert.ok(choicesFor('demon-form', 6).every((choice) => (choice.form.minRank ?? 0) <= 6));
});

test('single-form spells have exactly one choice, so the dialog is skipped', () => {
  for (const slug of ['elephant-form', 'sacred-form', 'primal-herd']) {
    const choices = choicesFor(slug, 10);
    assert.equal(choices.length, 1, slug);
    assert.deepEqual(toResult(choices[0]), { effectUuid: choices[0].effect.uuid, formKey: `${slug}:default` });
  }
  // Element Embodied has one effect per element: the dialog chooses between them.
  assert.equal(choicesFor('element-embodied', 10).length, 6);
});

test('the picker opens on the last pick when it is still on offer', () => {
  const choices = choicesFor('animal-form', 2);
  assert.deepEqual(initialState(catalogue, choices, 'animal-form:frog'), {
    spellSlug: 'animal-form',
    selectedKey: 'animal-form:frog',
  });
  assert.deepEqual(initialState(catalogue, choices, undefined), { spellSlug: 'animal-form', selectedKey: null });
  // A last pick the rank no longer allows is forgotten.
  const dark = choicesFor('devouring-dark-form', 1);
  assert.equal(initialState(catalogue, dark, 'devouring-dark-form:shark').selectedKey, null);
});

test('Untamed Form starts with the spell forms the druid has unlocked', () => {
  const choices = untamedChoices([
    'Pest Form',
    'Animal Form',
    'Dinosaur Form (Ankylosaurus)',
    'Dinosaur Form (Triceratops)',
  ]);
  assert.deepEqual(spellsOf(catalogue, choices), [
    { slug: 'pest-form', name: 'Pest Form', img: catalogue.effects[uuidOf('Pest Form')].img, count: 8 },
    { slug: 'animal-form', name: 'Animal Form', img: catalogue.effects[uuidOf('Animal Form')].img, count: 13 },
    {
      slug: 'dinosaur-form',
      name: 'Dinosaur Form',
      img: catalogue.effects[uuidOf('Dinosaur Form (Ankylosaurus)')].img,
      count: 2,
    },
  ]);
  // More than one spell: ask for the spell first.
  assert.deepEqual(initialState(catalogue, choices, undefined), { spellSlug: null, selectedKey: null });
  // The last pick skips straight to its spell's creature list.
  assert.deepEqual(initialState(catalogue, choices, 'dinosaur-form:triceratops'), {
    spellSlug: 'dinosaur-form',
    selectedKey: 'dinosaur-form:triceratops',
  });
});

test('a druid who only knows Pest Form goes straight to its forms', () => {
  const choices = untamedChoices(['Pest Form'], 1);
  assert.equal(choices.length, 7);
  assert.deepEqual(initialState(catalogue, choices, undefined), { spellSlug: 'pest-form', selectedKey: null });
  assert.ok(choices.every((choice) => choice.untamedValue === uuidOf('Pest Form')));
});
