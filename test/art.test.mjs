import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ART_SOURCE, isDefaultImage, isVideo, resolveFormArt } from '../module/scripts/art.mjs';

const catalogue = JSON.parse(readFileSync(new URL('../module/data/forms.json', import.meta.url), 'utf8'));
const allForms = Object.values(catalogue.effects).flatMap((effect) => effect.forms);

const WOLF = 'Compendium.pf2e.pathfinder-monster-core.Actor.wolf000000000000';
const form = { key: 'animal-form:canine', creature: WOLF };
const NPC_ICON = 'systems/pf2e/icons/default-icons/npc.svg';
const NONE = { image: null, source: ART_SOURCE.NONE, ringSafe: false };

/** A `game.compendiumArt.get` stand-in. */
const artMap = (entries) => (uuid) => entries[uuid] ?? null;

test('default images are the PF2e default icons, the Foundry placeholder and nothing at all', () => {
  assert.ok(isDefaultImage(NPC_ICON));
  assert.ok(isDefaultImage('icons/svg/mystery-man.svg'));
  assert.ok(isDefaultImage(null));
  assert.ok(isDefaultImage(''));
  assert.ok(!isDefaultImage('modules/some-art/wolf.webp'));
});

test('a GM override wins over every other source', () => {
  const env = {
    overrides: { 'animal-form:canine': 'worlds/mine/my-wolf.webp' },
    getCompendiumArt: artMap({ [WOLF]: { actor: 'modules/art/wolf.webp', token: 'modules/art/wolf-token.webp' } }),
    getCreatureToken: () => 'systems/pf2e/art/wolf.webp',
  };
  assert.deepEqual(resolveFormArt(form, env), {
    image: 'worlds/mine/my-wolf.webp',
    source: ART_SOURCE.OVERRIDE,
    ringSafe: false,
  });
});

test('an empty override is ignored', () => {
  const getCompendiumArt = artMap({ [WOLF]: { token: 'modules/art/wolf-token.webp' } });
  for (const empty of ['', '   ', null, undefined]) {
    const result = resolveFormArt(form, { overrides: { 'animal-form:canine': empty }, getCompendiumArt });
    assert.equal(result.source, ART_SOURCE.ART_MODULE);
  }
  // An override for another form does not apply.
  const other = resolveFormArt(form, { overrides: { 'animal-form:cat': 'worlds/mine/cat.webp' }, getCompendiumArt });
  assert.equal(other.image, 'modules/art/wolf-token.webp');
});

test('without an override, art from a module is used', () => {
  const getCompendiumArt = artMap({ [WOLF]: { actor: 'modules/art/wolf.webp', token: 'modules/art/wolf-token.webp' } });
  assert.deepEqual(resolveFormArt(form, { getCompendiumArt, getCreatureToken: () => 'systems/pf2e/art/wolf.webp' }), {
    image: 'modules/art/wolf-token.webp',
    source: ART_SOURCE.ART_MODULE,
    ringSafe: false,
  });
});

test('module art can be a path, token data or only a portrait', () => {
  const resolve = (art, ring = false) =>
    resolveFormArt(form, { getCompendiumArt: artMap({ [WOLF]: art }), ring }).image;
  // The shape sargas-pf2-creature-images registers: the portrait inside the dynamic ring.
  const tokenData = {
    texture: { src: 'modules/art/wolf.webp' },
    ring: { enabled: true, subject: { texture: 'm/s.webp' } },
  };
  assert.equal(resolve({ actor: 'modules/art/portrait.webp', token: tokenData }), 'modules/art/wolf.webp');
  assert.equal(resolve({ actor: 'modules/art/portrait.webp', token: tokenData }, true), 'm/s.webp');
  assert.equal(resolve({ token: { texture: { src: 'modules/art/wolf.webp' } } }, true), 'modules/art/wolf.webp');
  assert.equal(resolve({ actor: 'modules/art/portrait.webp' }), 'modules/art/portrait.webp');
  // An entry with nothing usable falls through to the next source.
  assert.equal(resolve({ token: NPC_ICON, actor: NPC_ICON }), null);
  assert.equal(resolve({ credit: 'no images here' }), null);
});

test("without module art, the compendium creature's own token is used", () => {
  const env = { getCompendiumArt: artMap({}), getCreatureToken: () => 'systems/pf2e/art/wolf.webp' };
  assert.deepEqual(resolveFormArt(form, env), {
    image: 'systems/pf2e/art/wolf.webp',
    source: ART_SOURCE.COMPENDIUM,
    ringSafe: false,
  });
  const tokenData = { texture: { src: 'a.webp' }, ring: { subject: { texture: 'b.webp' } } };
  assert.equal(resolveFormArt(form, { getCreatureToken: () => tokenData }).image, 'a.webp');
  assert.equal(resolveFormArt(form, { getCreatureToken: () => tokenData, ring: true }).image, 'b.webp');
});

test('a PF2e default icon is skipped, leaving no image change', () => {
  assert.deepEqual(resolveFormArt(form, { getCreatureToken: () => NPC_ICON }), NONE);
  assert.deepEqual(resolveFormArt(form, { getCreatureToken: () => ({ texture: { src: NPC_ICON } }) }), NONE);
  assert.deepEqual(resolveFormArt(form, { getCreatureToken: () => null }), NONE);
  assert.deepEqual(resolveFormArt(form), NONE);
});

test('a form without a creature can only get an override', () => {
  const sun = { key: 'cosmic-form:sun', creature: null };
  const getCompendiumArt = () => assert.fail('no creature to look up');
  assert.deepEqual(resolveFormArt(sun, { getCompendiumArt }), NONE);
  const result = resolveFormArt(sun, { overrides: { 'cosmic-form:sun': 'worlds/mine/sun.webp' }, getCompendiumArt });
  assert.equal(result.source, ART_SOURCE.OVERRIDE);
});

test('on a token with the dynamic ring the result is ring safe', () => {
  const getCompendiumArt = artMap({ [WOLF]: { token: 'modules/art/wolf-token.webp' } });
  assert.equal(resolveFormArt(form, { getCompendiumArt, ring: true }).ringSafe, true);
  assert.equal(resolveFormArt(form, { getCompendiumArt, ring: false }).ringSafe, false);
  assert.equal(resolveFormArt(form, { overrides: { [form.key]: 'x.webp' }, ring: true }).ringSafe, true);
  assert.equal(resolveFormArt(form, { getCreatureToken: () => 'x.webp', ring: true }).ringSafe, true);
  // Nothing found: nothing to write, ring or not.
  assert.deepEqual(resolveFormArt(form, { ring: true }), NONE);
});

test('a video cannot be a ring subject, so it is not ring safe', () => {
  assert.ok(isVideo('worlds/mine/wolf.webm'));
  assert.ok(isVideo('worlds/mine/wolf.MP4?v=2'));
  assert.ok(!isVideo('worlds/mine/wolf.webp'));
  const result = resolveFormArt(form, { overrides: { [form.key]: 'worlds/mine/wolf.webm' }, ring: true });
  assert.deepEqual(result, { image: 'worlds/mine/wolf.webm', source: ART_SOURCE.OVERRIDE, ringSafe: false });
});

test('every catalogue form resolves to a result', () => {
  const sources = new Set(Object.values(ART_SOURCE));
  const art = Object.fromEntries(
    allForms.filter((f) => f.creature).map((f) => [f.creature, { token: `art/${f.key}.webp` }]),
  );
  for (const ring of [false, true]) {
    for (const catalogueForm of allForms) {
      // No art installed: nothing changes.
      assert.deepEqual(resolveFormArt(catalogueForm, { ring }), NONE, catalogueForm.key);
      // An art module that covers every creature.
      const result = resolveFormArt(catalogueForm, { getCompendiumArt: artMap(art), ring });
      assert.ok(sources.has(result.source), catalogueForm.key);
      assert.equal(result.source, catalogueForm.creature ? ART_SOURCE.ART_MODULE : ART_SOURCE.NONE, catalogueForm.key);
      assert.equal(typeof result.ringSafe, 'boolean');
      // A GM override works for every form, including those without a creature.
      const overridden = resolveFormArt(catalogueForm, { overrides: { [catalogueForm.key]: 'worlds/x.webp' }, ring });
      assert.deepEqual(overridden, { image: 'worlds/x.webp', source: ART_SOURCE.OVERRIDE, ringSafe: ring });
    }
  }
});
