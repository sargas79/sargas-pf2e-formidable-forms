import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ART_SOURCE } from '../module/scripts/art.mjs';
import { allForms } from '../module/scripts/catalogue.mjs';
import { listArtRows, readOverride, withOverride, withoutOverride } from '../module/scripts/overrides.mjs';
import { planTokenImage } from '../module/scripts/token-image.mjs';
import { catalogue, effectSource, english } from './helpers.mjs';

test('an override is read by form key, and blank values count as unset', () => {
  const overrides = { 'animal-form:bear': ' worlds/mine/bear.webp ', 'animal-form:cat': '  ', 'animal-form:ape': null };
  assert.equal(readOverride(overrides, 'animal-form:bear'), 'worlds/mine/bear.webp');
  assert.equal(readOverride(overrides, 'animal-form:cat'), null);
  assert.equal(readOverride(overrides, 'animal-form:ape'), null);
  assert.equal(readOverride(overrides, 'animal-form:deer'), null);
  assert.equal(readOverride(undefined, 'animal-form:bear'), null);
});

test('setting an override returns a new object and leaves the old one alone', () => {
  const before = Object.freeze({ 'animal-form:cat': 'cat.webp' });
  const after = withOverride(before, 'animal-form:bear', ' worlds/mine/bear.webp ');
  assert.deepEqual(after, { 'animal-form:cat': 'cat.webp', 'animal-form:bear': 'worlds/mine/bear.webp' });
  assert.deepEqual(before, { 'animal-form:cat': 'cat.webp' });
  assert.deepEqual(withOverride(after, 'animal-form:bear', 'other.webp')['animal-form:bear'], 'other.webp');
  assert.deepEqual(withOverride(undefined, 'animal-form:bear', 'bear.webp'), { 'animal-form:bear': 'bear.webp' });
});

test('a blank path or a reset removes the override', () => {
  const overrides = Object.freeze({ 'animal-form:cat': 'cat.webp', 'animal-form:bear': 'bear.webp' });
  assert.deepEqual(withOverride(overrides, 'animal-form:bear', ''), { 'animal-form:cat': 'cat.webp' });
  assert.deepEqual(withOverride(overrides, 'animal-form:bear', null), { 'animal-form:cat': 'cat.webp' });
  assert.deepEqual(withoutOverride(overrides, 'animal-form:bear'), { 'animal-form:cat': 'cat.webp' });
  assert.deepEqual(withoutOverride(overrides, 'animal-form:deer'), overrides);
  assert.deepEqual(withoutOverride(undefined, 'animal-form:deer'), {});
});

test('the manager lists every form that can show art, grouped by spell', () => {
  const spells = listArtRows(catalogue);
  assert.deepEqual(
    spells.map((spell) => spell.slug),
    Object.keys(catalogue.spells),
  );
  const keys = spells.flatMap((spell) => spell.rows.map((row) => row.key));
  const expected = allForms(catalogue)
    .filter(({ form }) => form.battleForm !== false)
    .map(({ form }) => form.key);
  assert.deepEqual([...keys].sort(), [...expected].sort());
  // The tentacle is not a battle form: it never changes the token, so it has no row.
  assert.ok(!keys.includes('devouring-dark-form:tentacle'));
  // Without art installed, every row says so.
  assert.ok(spells.every((spell) => spell.rows.every((row) => row.art.source === ART_SOURCE.NONE && !row.overridden)));
});

test('rows show the resolved image and its source, and change when an override is set or reset', () => {
  const bear = allForms(catalogue).find(({ form }) => form.key === 'animal-form:bear').form;
  const env = { getCompendiumArt: (uuid) => (uuid === bear.creature ? { token: 'modules/art/bear.webp' } : null) };
  const row = (overrides) =>
    listArtRows(catalogue, { ...env, overrides })
      .find((spell) => spell.slug === 'animal-form')
      .rows.find((r) => r.key === 'animal-form:bear');

  let overrides = {};
  assert.deepEqual(row(overrides).art, {
    image: 'modules/art/bear.webp',
    source: ART_SOURCE.ART_MODULE,
    ringSafe: false,
  });
  assert.equal(row(overrides).overridden, false);

  overrides = withOverride(overrides, 'animal-form:bear', 'worlds/mine/bear.webp');
  assert.deepEqual(row(overrides).art, {
    image: 'worlds/mine/bear.webp',
    source: ART_SOURCE.OVERRIDE,
    ringSafe: false,
  });
  assert.equal(row(overrides).overridden, true);

  // The next apply writes the override to the token.
  const source = effectSource('Spell Effect: Animal Form');
  source.system.rules[0].selection = 'bear';
  assert.equal(
    planTokenImage(catalogue, source, { ...env, overrides }).update['system.rules'].at(-1).value,
    'worlds/mine/bear.webp',
  );

  overrides = withoutOverride(overrides, 'animal-form:bear');
  assert.equal(row(overrides).art.source, ART_SOURCE.ART_MODULE);
  assert.equal(row(overrides).overridden, false);
});

test('every label the windows build at runtime is in en.json', () => {
  for (const source of Object.values(ART_SOURCE)) {
    assert.equal(typeof english(`SARGAS_FORMS.Art.Source.${source}`), 'string', source);
  }
  const forms = allForms(catalogue).map(({ form }) => form);
  const sizes = new Set(forms.flatMap((form) => form.sizes.map((step) => step.size ?? 'own')).concat('own'));
  for (const size of sizes) assert.equal(typeof english(`SARGAS_FORMS.Size.${size}`), 'string', size);
  const movement = new Set(forms.flatMap((form) => form.movement.flatMap((step) => step.types)));
  for (const type of movement) assert.equal(typeof english(`SARGAS_FORMS.Movement.${type}`), 'string', type);
  const groups = new Set(forms.map((form) => form.group).filter(Boolean));
  for (const group of groups) assert.equal(typeof english(`SARGAS_FORMS.Group.${group}`), 'string', group);
});
