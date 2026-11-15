import assert from 'node:assert/strict';
import { test } from 'node:test';
import { minLevelOf, testPredicate } from '../module/scripts/predicate.mjs';

test('an empty predicate always passes and atoms must all be present', () => {
  assert.ok(testPredicate([], []));
  assert.ok(testPredicate(undefined, []));
  assert.ok(testPredicate(['a', 'b'], ['a', 'b', 'c']));
  assert.ok(!testPredicate(['a', 'b'], ['a']));
  assert.ok(testPredicate(['a'], new Set(['a'])));
});

test('compound statements follow the PF2e rules', () => {
  const options = ['a', 'b'];
  assert.ok(testPredicate([{ and: ['a', 'b'] }], options));
  assert.ok(!testPredicate([{ and: ['a', 'c'] }], options));
  assert.ok(testPredicate([{ or: ['c', 'b'] }], options));
  assert.ok(!testPredicate([{ or: ['c', 'd'] }], options));
  assert.ok(testPredicate([{ not: 'c' }], options));
  assert.ok(!testPredicate([{ not: 'a' }], options));
  assert.ok(testPredicate([{ nor: ['c', 'd'] }], options));
  assert.ok(!testPredicate([{ nor: ['a', 'd'] }], options));
  assert.ok(testPredicate([{ nand: ['a', 'c'] }], options));
  assert.ok(!testPredicate([{ nand: ['a', 'b'] }], options));
  assert.ok(testPredicate([{ xor: ['a', 'c'] }], options));
  assert.ok(!testPredicate([{ xor: ['a', 'b'] }], options));
  assert.ok(testPredicate([{ if: 'a', then: 'b' }], options));
  assert.ok(!testPredicate([{ if: 'a', then: 'c' }], options));
  assert.ok(testPredicate([{ iff: ['c', 'd'] }], options));
  assert.ok(!testPredicate([{ iff: ['a', 'd'] }], options));
});

test('numeric comparisons read the value from a roll option', () => {
  const rank = (n) => [`parent:level:${n}`];
  assert.ok(testPredicate([{ gte: ['parent:level', 5] }], rank(5)));
  assert.ok(!testPredicate([{ gte: ['parent:level', 5] }], rank(4)));
  assert.ok(testPredicate([{ gt: ['parent:level', 5] }], rank(6)));
  assert.ok(!testPredicate([{ gt: ['parent:level', 5] }], rank(5)));
  assert.ok(testPredicate([{ lte: ['parent:level', 5] }], rank(5)));
  assert.ok(testPredicate([{ lt: ['parent:level', 5] }], rank(4)));
  // Without the option there is nothing to compare, so the statement fails.
  assert.ok(!testPredicate([{ gte: ['parent:level', 5] }], []));
  // A longer option with the same stem is a different option.
  assert.ok(!testPredicate([{ gte: ['parent:level', 5] }], ['parent:level:9:extra']));
});

test('eq follows the system: a number is looked up as an option, two strings are compared as written', () => {
  // src/module/system/predication.ts, Predicate#testBinaryOp:
  //   typeof eq[1] === "string" ? eq[0] === eq[1] : domain.has(`${eq[0]}:${eq[1]}`)
  const rank = (n) => [`parent:level:${n}`];
  assert.ok(testPredicate([{ eq: ['parent:level', 5] }], rank(5)));
  assert.ok(!testPredicate([{ eq: ['parent:level', 5] }], rank(6)));
  assert.ok(!testPredicate([{ eq: ['parent:level', 5] }], []));
  // A string on the right is not looked up in the options: the two operands are compared with each other.
  assert.ok(testPredicate([{ eq: ['fire', 'fire'] }], []));
  assert.ok(!testPredicate([{ eq: ['item:damage:type', 'fire'] }], ['item:damage:type:fire']));
  assert.ok(!testPredicate([{ eq: ['parent:level', '5'] }], rank(5)));
});

test("PF2e's own form predicates behave as in the system", () => {
  // Aerial Form's pterosaur: free on a normal cast, needs a feat through Untamed Form.
  const pterosaur = [{ or: [{ not: 'self:effect:untamed-form' }, 'feat:ferocious-shape'] }];
  assert.ok(testPredicate(pterosaur, []));
  assert.ok(!testPredicate(pterosaur, ['self:effect:untamed-form']));
  assert.ok(testPredicate(pterosaur, ['self:effect:untamed-form', 'feat:ferocious-shape']));

  // Devouring Dark Form's cave worm: two features and rank 8.
  const caveWorm = ['feat:monstrous-inclinations', 'feature:lurker-in-devouring-dark', { gte: ['parent:level', 8] }];
  const features = ['feat:monstrous-inclinations', 'feature:lurker-in-devouring-dark'];
  assert.ok(testPredicate(caveWorm, [...features, 'parent:level:8']));
  assert.ok(!testPredicate(caveWorm, [...features, 'parent:level:7']));
  assert.ok(!testPredicate(caveWorm, ['parent:level:9']));
});

test('the minimum effect level is read from parent:level comparisons that must hold', () => {
  assert.equal(minLevelOf([]), null);
  assert.equal(minLevelOf(['feat:x']), null);
  assert.equal(minLevelOf([{ gte: ['parent:level', 5] }]), 5);
  assert.equal(minLevelOf([{ gt: ['parent:level', 5] }]), 6);
  assert.equal(minLevelOf(['feat:x', { gte: ['parent:level', 8] }]), 8);
  assert.equal(minLevelOf([{ and: [{ gte: ['parent:level', 3] }] }, { gte: ['parent:level', 2] }]), 3);
  // Inside an `or` the level is only one way to pass, so it sets no minimum.
  assert.equal(minLevelOf([{ or: [{ gte: ['parent:level', 5] }, 'feat:x'] }]), null);
  assert.equal(minLevelOf([{ gte: ['self:level', 5] }]), null);
});
