import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAST_A_SPELL_OPTION,
  buildEffectSource,
  buildOriginContext,
  findFormEffectIds,
  parseCast,
  planUntamedForm,
  unlockedEffects,
} from '../module/scripts/cast.mjs';
import { MODULE_ID } from '../module/scripts/constants.mjs';
import { listChoices, toResult } from '../module/scripts/picker-logic.mjs';
import { planTokenImage } from '../module/scripts/token-image.mjs';
import { catalogue, effectSource, effectsOf, formByKey } from './helpers.mjs';

const ACTOR = 'Actor.druid00000000000';
const TOKEN = 'Scene.scene00000000000.Token.token00000000000';
const SPELL = `${ACTOR}.Item.spell00000000000`;

/** The flags SpellPF2e#toMessage writes for a spell cast from a spellcasting entry. */
function castMessage(slug, { castRank = 6, tradition = 'primal', cast = true, context } = {}) {
  const rollOptions = [
    'origin:signature',
    `origin:item:id:spell00000000000`,
    `origin:item:${slug}`,
    `origin:item:slug:${slug}`,
    `origin:item:rank:${castRank}`,
    `spellcasting:${tradition}`,
    `spellcasting:tradition:${tradition}`,
  ];
  if (cast) rollOptions.push(CAST_A_SPELL_OPTION);
  return {
    flags: {
      core: { canPopout: true },
      pf2e: {
        origin: { actor: ACTOR, uuid: SPELL, type: 'spell', castRank, variant: null, rollOptions },
        casting: { id: 'entry00000000000', tradition },
        ...(context ? { context } : {}),
      },
    },
  };
}

const context = buildOriginContext({
  actor: ACTOR,
  token: TOKEN,
  item: SPELL,
  spellcasting: { attribute: { type: 'wis', mod: 4 }, tradition: 'primal' },
  rollOptions: castMessage('dragon-form').flags.pf2e.origin.rollOptions,
});

test('a cast of a catalogue spell is recognised, with its rank and tradition', () => {
  const cast = parseCast(castMessage('animal-form', { castRank: 4 }), catalogue);
  assert.equal(cast.spell, catalogue.spells['animal-form']);
  assert.equal(cast.untamed, false);
  assert.equal(cast.castRank, 4);
  assert.equal(cast.tradition, 'primal');
});

test('battle-form spells have no save, so the message has no context flag', () => {
  // The system only sets flags.pf2e.context ("spell-cast") for spells with a defense.
  assert.ok(parseCast(castMessage('dragon-form'), catalogue));
  assert.ok(parseCast(castMessage('dragon-form', { context: { type: 'spell-cast' } }), catalogue));
});

test('Untamed Form is recognised as its own kind of cast', () => {
  const cast = parseCast(castMessage('untamed-form', { castRank: 3 }), catalogue);
  assert.equal(cast.spell, catalogue.untamed);
  assert.equal(cast.untamed, true);
  assert.equal(cast.castRank, 3);
});

test('non-catalogue spells and non-spell messages are ignored', () => {
  assert.equal(parseCast(castMessage('fireball'), catalogue), null);
  assert.equal(parseCast({ flags: { pf2e: {} } }, catalogue), null);
  assert.equal(parseCast({ flags: {} }, catalogue), null);
  assert.equal(parseCast({}, catalogue), null);
  assert.equal(parseCast(null, catalogue), null);
  const strike = castMessage('animal-form');
  strike.flags.pf2e.origin.type = 'weapon';
  assert.equal(parseCast(strike, catalogue), null);
});

test('a spell only sent to chat, or a roll made from its card, is not a cast', () => {
  assert.equal(parseCast(castMessage('animal-form', { cast: false }), catalogue), null);
  assert.equal(parseCast(castMessage('animal-form', { context: { type: 'damage-roll' } }), catalogue), null);
  assert.equal(parseCast(castMessage('animal-form', { context: { type: 'attack-roll' } }), catalogue), null);
});

test('a renamed copy of the spell is recognised by its compendium source', () => {
  const message = castMessage('my-homebrew-shape');
  assert.equal(parseCast(message, catalogue), null);
  const sourceId = catalogue.spells['animal-form'].uuid;
  assert.equal(parseCast(message, catalogue, { slug: 'my-homebrew-shape', sourceId }).spell.slug, 'animal-form');
  // Without roll options naming the spell, the item's slug is used.
  const bare = castMessage('x');
  bare.flags.pf2e.origin.rollOptions = [CAST_A_SPELL_OPTION];
  assert.equal(parseCast(bare, catalogue, { slug: 'fey-form' }).spell.slug, 'fey-form');
  // A missing cast rank falls back to the spell's base rank.
  delete bare.flags.pf2e.origin.castRank;
  assert.equal(parseCast(bare, catalogue, { slug: 'fey-form' }).castRank, 4);
});

test("the origin context has the shape the system's drag handler builds", () => {
  assert.deepEqual(Object.keys(context), ['origin', 'target', 'roll']);
  assert.deepEqual(Object.keys(context.origin), ['actor', 'token', 'item', 'spellcasting', 'rollOptions']);
  assert.equal(context.target, null);
  assert.equal(context.roll, null);
  assert.deepEqual(context.origin.spellcasting, { attribute: { type: 'wis', mod: 4 }, tradition: 'primal' });
  // Dragon Form's resistances test `parent:spellcasting:tradition:*`: the effect prefixes these with "parent:".
  assert.ok(context.origin.rollOptions.includes('spellcasting:tradition:primal'));
  assert.deepEqual(buildOriginContext({ actor: ACTOR }).origin, {
    actor: ACTOR,
    token: null,
    item: null,
    spellcasting: null,
    rollOptions: [],
  });
});

test('the effect source carries the cast rank, the origin and the preselected choice', () => {
  const [entry] = effectsOf('animal-form');
  const form = formByKey('animal-form:bear');
  const compendium = effectSource('Spell Effect: Animal Form');
  const source = buildEffectSource(compendium, { entry, form, castRank: 5, context, traits: ['polymorph'] });

  assert.equal(source.system.level.value, 5);
  assert.deepEqual(source.system.context, context);
  assert.equal(source.system.rules[0].selection, 'bear');
  assert.deepEqual(source.system.traits.value, ['polymorph']);
  assert.equal(source.flags[MODULE_ID].form, 'animal-form:bear');
  assert.equal(source._stats.compendiumSource, entry.uuid);
  assert.equal('_id' in source, false);
  // The other rules are untouched, and so is the compendium data passed in.
  assert.deepEqual(source.system.rules.slice(1), compendium.system.rules.slice(1));
  assert.equal(compendium.system.rules[0].selection, undefined);
  assert.equal(compendium.system.level.value, 2);
});

test("an effect's own traits are kept", () => {
  const [entry] = effectsOf('animal-form');
  const compendium = effectSource('Spell Effect: Animal Form');
  compendium.system.traits.value = ['magical'];
  const form = formByKey('animal-form:bear');
  const source = buildEffectSource(compendium, { entry, form, castRank: 2, traits: ['polymorph'] });
  assert.deepEqual(source.system.traits.value, ['magical']);
  assert.equal(source.system.context, null);
});

test('Dragon Form is preselected with the whole choice object', () => {
  const [entry] = effectsOf('dragon-form');
  const form = formByKey('dragon-form:adamantine');
  const compendium = effectSource('Spell Effect: Dragon Form');
  const source = buildEffectSource(compendium, { entry, form, castRank: 8, context });
  // The system skips its prompt when the selection deep-equals one of its own choices.
  assert.deepEqual(source.system.rules[0].selection, compendium.system.rules[0].choices[0].value);
  assert.equal(source.system.rules[0].selection.tradition, 'primal');

  // PF2e changed the choice since the catalogue was built: the effect's current value is used.
  compendium.system.rules[0].choices[0].value.damageType = 'slashing';
  const updated = buildEffectSource(compendium, { entry, form, castRank: 8 });
  assert.equal(updated.system.rules[0].selection.damageType, 'slashing');

  // The choice is gone: no selection, so the system asks.
  compendium.system.rules[0].choices.shift();
  const gone = buildEffectSource(compendium, { entry, form, castRank: 8 });
  assert.equal(gone.system.rules[0].selection, undefined);
});

test('separate-effect and cosmetic forms set no selection', () => {
  const [pest] = effectsOf('pest-form');
  const cat = buildEffectSource(effectSource('Spell Effect: Pest Form'), {
    entry: pest,
    form: formByKey('pest-form:cat'),
    castRank: 1,
  });
  assert.equal(cat.flags[MODULE_ID].form, 'pest-form:cat');
  assert.ok(cat.system.rules.every((rule) => rule.selection === undefined));

  const entry = effectsOf('dinosaur-form').find((effect) => effect.name.endsWith('(Stegosaurus)'));
  const dino = buildEffectSource(effectSource(entry.name), { entry, form: entry.forms[0], castRank: 7 });
  assert.equal(dino.system.level.value, 7);
  assert.equal(dino._stats.compendiumSource, entry.uuid);
});

test('the built effect gets its token art from the hook logic', () => {
  const [entry] = effectsOf('pest-form');
  const source = buildEffectSource(effectSource('Spell Effect: Pest Form'), {
    entry,
    form: formByKey('pest-form:fox'),
    castRank: 1,
  });
  const plan = planTokenImage(catalogue, source, { overrides: { 'pest-form:fox': 'worlds/mine/fox.webp' } });
  assert.equal(plan.update['system.rules'].at(-1).value, 'worlds/mine/fox.webp');
});

test('existing battle forms are found so the new one replaces them', () => {
  const bear = effectSource('Spell Effect: Animal Form');
  bear._id = 'bear000000000000';
  const untamed = effectSource('Spell Effect: Untamed Form');
  untamed._id = 'untamed000000000';
  const bless = { _id: 'bless00000000000', type: 'effect', system: { slug: 'spell-effect-bless' } };
  const feat = { _id: 'feat000000000000', type: 'feat', system: { slug: 'spell-effect-animal-form' } };
  assert.deepEqual(findFormEffectIds([bear, bless, untamed, feat], catalogue), [
    'bear000000000000',
    'untamed000000000',
  ]);
  assert.deepEqual(findFormEffectIds([], catalogue), []);
});

/* -------------------------------------------- */
/*  Choices offered                              */
/* -------------------------------------------- */

test('a cast offers the forms of its spell that the rank allows', () => {
  const keys = (slug, context_) => listChoices(catalogue, catalogue.spells[slug], context_).map((c) => c.form.key);
  assert.equal(keys('animal-form', { rank: 2 }).length, 13);
  assert.equal(keys('dragon-form', { rank: 6 }).length, 40);
  assert.deepEqual(keys('devouring-dark-form', { rank: 1 }), ['devouring-dark-form:tentacle']);
  assert.deepEqual(keys('devouring-dark-form', { rank: 5 }), [
    'devouring-dark-form:tentacle',
    'devouring-dark-form:shark',
    'devouring-dark-form:water-elemental',
  ]);
  // Demon Form lists its own four choices and the four pre-remaster effects.
  assert.equal(keys('demon-form', { rank: 6 }).length, 8);
  // The kaiju effect is granted by a feat through Untamed Form, never by casting Monstrosity Form.
  assert.deepEqual(keys('monstrosity-form', { rank: 10 }), [
    'monstrosity-form:cave-worm',
    'monstrosity-form:phoenix',
    'monstrosity-form:sea-serpent',
  ]);
  assert.deepEqual(keys('elephant-form', { rank: 4 }), ['elephant-form:default']);
  assert.equal(keys('pest-form', { rank: 1 }).length, 7);
  assert.equal(keys('pest-form', { rank: 4 }).length, 8);
});

const uuidOf = (name) => Object.values(catalogue.effects).find((effect) => effect.name === name).uuid;
const wildShape = (...names) => names.map((name) => ({ value: uuidOf(`Spell Effect: ${name}`) }));

test('Untamed Form offers only what the druid has unlocked', () => {
  const list = (wildShapeForms, options = []) =>
    listChoices(catalogue, catalogue.untamed, { rank: 4, options, wildShapeForms });
  assert.deepEqual(list(undefined), []);
  assert.deepEqual(list([]), []);

  const basic = list(wildShape('Pest Form', 'Animal Form'));
  assert.deepEqual([...new Set(basic.map((c) => c.effect.spell))], ['pest-form', 'animal-form']);
  assert.ok(basic.every((c) => c.untamedValue === c.effect.uuid));

  // Soaring Shape adds Aerial Form, but its pterosaur and wasp need other feats.
  const aerial = (options) => list(wildShape('Aerial Form'), options).map((c) => c.form.key);
  assert.deepEqual(aerial([]), ['aerial-form:bat', 'aerial-form:bird']);
  assert.deepEqual(aerial(['feat:insect-shape']), ['aerial-form:bat', 'aerial-form:bird', 'aerial-form:wasp']);

  // The feats link effects by name in the PF2e source; the stored string is passed back untouched.
  const byName = 'Compendium.pf2e.spell-effects.Item.Spell Effect: Elephant Form';
  const [named] = list([{ value: byName }, { value: byName }, { value: 'Compendium.pf2e.spell-effects.Item.Unknown' }]);
  assert.equal(named.untamedValue, byName);
  assert.deepEqual(toResult(named), {
    effectUuid: uuidOf('Spell Effect: Elephant Form'),
    formKey: 'elephant-form:default',
    untamedValue: byName,
  });
  assert.equal(unlockedEffects([{ value: byName }, { value: byName }, 42, null], catalogue).length, 1);

  // Heart of the Kaiju unlocks the kaiju effect.
  const kaiju = list(wildShape('Monstrosity Form (Kaiju)'));
  assert.deepEqual(
    kaiju.map((c) => c.form.key),
    ['monstrosity-form:kaiju'],
  );
});

/* -------------------------------------------- */
/*  Untamed Form                                 */
/* -------------------------------------------- */

function untamedPlan(effectName, formKey) {
  const entry = Object.values(catalogue.effects).find((effect) => effect.name === effectName);
  return planUntamedForm({
    catalogue,
    untamedSource: effectSource('Spell Effect: Untamed Form'),
    formSource: effectSource(effectName),
    entry,
    form: formByKey(formKey),
    untamedValue: entry.uuid,
    castRank: 4,
    context,
    traits: ['polymorph'],
    untamedId: 'untamedNewId0000',
  });
}

test('Untamed Form is created in one step with both choices preselected', () => {
  const steps = untamedPlan('Spell Effect: Animal Form', 'animal-form:bear');
  assert.equal(steps.length, 1);
  const [{ sources, operation }] = steps;
  assert.equal(sources.length, 1);
  const [untamed] = sources;
  const [choiceSet, grant] = untamed.system.rules;

  assert.equal(untamed._stats.compendiumSource, catalogue.untamed.effect);
  assert.equal(untamed.system.level.value, 4);
  assert.deepEqual(untamed.system.context, context);
  // The Untamed Form choice is the effect UUID, and the granted effect's choice goes through the GrantItem.
  assert.equal(choiceSet.selection, uuidOf('Spell Effect: Animal Form'));
  assert.equal(grant.key, 'GrantItem');
  assert.deepEqual(grant.preselectChoices, { spellEffectAnimalForm: 'bear' });
  assert.equal(grant.allowDuplicate, undefined);
  // The system creates the granted effect; the hint tells the token image hook which form it is.
  assert.deepEqual(operation, {
    [MODULE_ID]: { forms: { [uuidOf('Spell Effect: Animal Form')]: 'animal-form:bear' } },
  });
  assert.equal('_id' in untamed, false);
});

test('a form without a choice needs no preselection, only the hint', () => {
  const [{ sources, operation }] = untamedPlan('Spell Effect: Pest Form', 'pest-form:cat');
  assert.equal(sources[0].system.rules[1].preselectChoices, undefined);
  assert.deepEqual(operation[MODULE_ID].forms, { [uuidOf('Spell Effect: Pest Form')]: 'pest-form:cat' });

  // The hook then gives the granted Pest Form effect the cat's art.
  const granted = effectSource('Spell Effect: Pest Form');
  const plan = planTokenImage(catalogue, granted, {
    hints: operation[MODULE_ID].forms,
    overrides: { 'pest-form:cat': 'worlds/mine/cat.webp' },
  });
  assert.equal(plan.update['system.rules'].at(-1).value, 'worlds/mine/cat.webp');
});

test('Dragon Form through Untamed Form is created first and then linked', () => {
  // GrantItem's preselectChoices only takes strings and numbers, and a dragon choice is an object.
  const steps = untamedPlan('Spell Effect: Dragon Form', 'dragon-form:forest');
  assert.equal(steps.length, 2);
  const [first, second] = steps;

  const [dragon] = first.sources;
  assert.equal(dragon.system.rules[0].selection.dragonType, 'forest');
  assert.equal(dragon.system.level.value, 4);
  assert.deepEqual(dragon.system.context, context);
  assert.equal(dragon.flags[MODULE_ID].form, 'dragon-form:forest');
  assert.deepEqual(first.operation, {});

  const [untamed] = second.sources;
  const [choiceSet, grant] = untamed.system.rules;
  // The system links an existing item whose source is the granted UUID when duplicates are not allowed.
  assert.equal(grant.allowDuplicate, false);
  assert.equal(grant.preselectChoices, undefined);
  assert.equal(choiceSet.selection, dragon._stats.compendiumSource);
  // The link is written with the granter's id, so the id must survive creation.
  assert.equal(untamed._id, 'untamedNewId0000');
  assert.deepEqual(second.operation, { keepId: true });
});

test('the plan fails loudly when the Untamed Form effect changes shape', () => {
  const untamedSource = effectSource('Spell Effect: Untamed Form');
  untamedSource.system.rules = untamedSource.system.rules.filter((rule) => rule.key !== 'GrantItem');
  const [entry] = effectsOf('animal-form');
  assert.throws(() =>
    planUntamedForm({
      catalogue,
      untamedSource,
      formSource: effectSource('Spell Effect: Animal Form'),
      entry,
      form: entry.forms[0],
      untamedValue: entry.uuid,
      castRank: 2,
      untamedId: 'x',
    }),
  );
});
