import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ART_SOURCE } from '../module/scripts/art.mjs';
import { MODULE_ID } from '../module/scripts/constants.mjs';
import { RULE_SLUG, TRANSITION, buildTokenImageRule, planTokenImage } from '../module/scripts/token-image.mjs';
import { catalogue, effectSource, formByKey } from './helpers.mjs';

const FLAG = `flags.${MODULE_ID}.form`;
const bear = formByKey('animal-form:bear');
const art = { getCompendiumArt: (uuid) => (uuid === bear.creature ? { token: 'modules/art/bear.webp' } : null) };

/** An Animal Form effect after the system's prompt: the selection is in the rule source. */
function chosenBear() {
  const source = effectSource('Spell Effect: Animal Form');
  source.system.rules[0].selection = 'bear';
  return source;
}

/** Applies a planned update to source data the way `Document#updateSource` would. */
function applyUpdate(source, update) {
  const out = structuredClone(source);
  out.system.rules = update['system.rules'];
  out.flags[MODULE_ID] = { form: update[FLAG] };
  return out;
}

const ourRules = (rules) => rules.filter((rule) => rule.key === 'TokenImage');

test('the rule sets the token texture, with a short fade', () => {
  assert.deepEqual(buildTokenImageRule({ image: 'a.webp', ringSafe: false }), {
    key: 'TokenImage',
    slug: RULE_SLUG,
    value: 'a.webp',
    animation: { transition: 'fade', duration: 400 },
  });
  assert.deepEqual(TRANSITION, { transition: 'fade', duration: 400 });
});

test('on a ring token the rule only sets the ring subject texture', () => {
  const rule = buildTokenImageRule({ image: 'a.webp', ringSafe: true });
  assert.deepEqual(rule.ring, { subject: { texture: 'a.webp' } });
  assert.equal('value' in rule, false);
});

test('the fade can be turned off', () => {
  const rule = buildTokenImageRule({ image: 'a.webp', ringSafe: false }, { animate: false });
  assert.equal('animation' in rule, false);
});

test('a catalogue effect gets the rule for its chosen form', () => {
  const source = chosenBear();
  const plan = planTokenImage(catalogue, source, art);
  assert.equal(plan.form, bear);
  assert.equal(plan.art.source, ART_SOURCE.ART_MODULE);
  assert.equal(plan.update[FLAG], 'animal-form:bear');
  const rules = plan.update['system.rules'];
  // The effect's own rules are kept, in order, and ours is added at the end.
  assert.deepEqual(rules.slice(0, -1), source.system.rules);
  assert.deepEqual(rules.at(-1), {
    key: 'TokenImage',
    slug: RULE_SLUG,
    value: 'modules/art/bear.webp',
    animation: { ...TRANSITION },
  });
  // The source passed in is not modified.
  assert.equal(ourRules(source.system.rules).length, 0);
});

test('a token with the dynamic ring keeps its ring', () => {
  const plan = planTokenImage(catalogue, chosenBear(), { ...art, ring: true });
  const rule = plan.update['system.rules'].at(-1);
  assert.deepEqual(rule.ring, { subject: { texture: 'modules/art/bear.webp' } });
  assert.equal('value' in rule, false);
});

test('the transition setting is respected', () => {
  const plan = planTokenImage(catalogue, chosenBear(), { ...art, animate: false });
  assert.equal('animation' in plan.update['system.rules'].at(-1), false);
});

test('with no art, no rule is added but the form is still recorded', () => {
  const source = chosenBear();
  const plan = planTokenImage(catalogue, source, {});
  assert.equal(plan.art.source, ART_SOURCE.NONE);
  assert.deepEqual(plan.update['system.rules'], source.system.rules);
  assert.equal(plan.update[FLAG], 'animal-form:bear');
});

test('applying the same effect again does not add a second rule', () => {
  const source = chosenBear();
  const once = applyUpdate(source, planTokenImage(catalogue, source, art).update);
  const twice = applyUpdate(once, planTokenImage(catalogue, once, art).update);
  assert.equal(ourRules(twice.system.rules).length, 1);
  assert.deepEqual(twice, once);

  // A copy dropped on a ring token, after the GM changed the art: the old rule is replaced, not kept.
  const env = { overrides: { 'animal-form:bear': 'worlds/mine/bear.webp' }, ring: true };
  const moved = applyUpdate(once, planTokenImage(catalogue, once, env).update);
  assert.equal(ourRules(moved.system.rules).length, 1);
  assert.deepEqual(ourRules(moved.system.rules)[0].ring, { subject: { texture: 'worlds/mine/bear.webp' } });

  // And when the art is gone, so is the rule.
  const bare = applyUpdate(once, planTokenImage(catalogue, once, {}).update);
  assert.equal(ourRules(bare.system.rules).length, 0);
});

test("another module's TokenImage rule is left alone", () => {
  const source = chosenBear();
  source.system.rules.push({ key: 'TokenImage', value: 'other/module.webp' });
  const rules = planTokenImage(catalogue, source, art).update['system.rules'];
  assert.deepEqual(
    ourRules(rules).map((rule) => rule.value),
    ['other/module.webp', 'modules/art/bear.webp'],
  );
});

test('effects that are not in the catalogue are not touched', () => {
  const bless = { type: 'effect', name: 'Spell Effect: Bless', system: { slug: 'spell-effect-bless', rules: [] } };
  assert.equal(planTokenImage(catalogue, bless, art), null);
  assert.equal(planTokenImage(catalogue, effectSource('Spell Effect: Untamed Form'), art), null);
  assert.equal(planTokenImage(catalogue, { ...chosenBear(), type: 'feat' }, art), null);
});

test('an effect whose form is not chosen is not touched', () => {
  // The user closed the system's prompt without choosing: there is nothing to show.
  assert.equal(planTokenImage(catalogue, effectSource('Spell Effect: Animal Form'), art), null);
});

test('the effect Untamed Form grants is handled like any other', () => {
  // GrantItem creates the granted effect in the same batch, with its own selection and a grantedBy flag.
  const granted = chosenBear();
  granted.flags.pf2e = { grantedBy: { id: 'untamed000000000', onDelete: 'cascade' } };
  const plan = planTokenImage(catalogue, granted, art);
  assert.equal(plan.form.key, 'animal-form:bear');
  assert.equal(plan.update['system.rules'].at(-1).value, 'modules/art/bear.webp');
});

test('a hint names the form of an effect that carries no selection', () => {
  const pest = effectSource('Spell Effect: Pest Form');
  const env = { overrides: { 'pest-form:cat': 'worlds/mine/cat.webp', 'pest-form:rat': 'worlds/mine/rat.webp' } };
  assert.equal(planTokenImage(catalogue, pest, env).update['system.rules'].at(-1).value, 'worlds/mine/rat.webp');
  const hints = { [catalogue.spells['pest-form'].effects[0]]: 'pest-form:cat' };
  const plan = planTokenImage(catalogue, pest, { ...env, hints });
  assert.equal(plan.update[FLAG], 'pest-form:cat');
  assert.equal(plan.update['system.rules'].at(-1).value, 'worlds/mine/cat.webp');
});

test('a choice that is not a battle form never changes the token', () => {
  const source = effectSource('Spell Effect: Devouring Dark Form');
  source.system.rules[0].selection = 'tentacle';
  const env = { overrides: { 'devouring-dark-form:tentacle': 'worlds/mine/tentacle.webp' } };
  const plan = planTokenImage(catalogue, source, env);
  assert.equal(plan.art.source, ART_SOURCE.NONE);
  assert.equal(ourRules(plan.update['system.rules']).length, 0);
});

test('separate-effect and object-choice forms resolve their own art', () => {
  const env = { getCompendiumArt: (uuid) => ({ token: `art/${uuid.split('.').at(-1)}.webp` }) };
  const dino = planTokenImage(catalogue, effectSource('Spell Effect: Dinosaur Form (Triceratops)'), env);
  assert.equal(dino.form.key, 'dinosaur-form:triceratops');
  assert.ok(dino.update['system.rules'].at(-1).value.startsWith('art/'));

  const dragon = effectSource('Spell Effect: Dragon Form');
  dragon.system.rules[0].selection = structuredClone(formByKey('dragon-form:mirage').value);
  assert.equal(planTokenImage(catalogue, dragon, env).form.key, 'dragon-form:mirage');
});
