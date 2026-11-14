// A small, pure port of the PF2e system's predicate test (src/module/system/predication.ts). The form catalogue keeps
// the predicates PF2e puts on form choices, and the picker needs to test them without the system's classes so the
// logic stays unit testable.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Tests a predicate (an array of statements, all of which must hold) against a set of roll options.
 * @param {unknown[]} [predicate] The predicate statements
 * @param {Iterable<string>} [options] The roll options that are true
 * @returns {boolean}
 */
export function testPredicate(predicate = [], options = []) {
  const domain = options instanceof Set ? options : new Set(options);
  return predicate.every((statement) => isTrue(statement, domain));
}

function isTrue(statement, domain) {
  if (typeof statement === 'string') return domain.has(statement);
  if (!isObject(statement)) return false;
  const [[operator, operand]] = Object.entries(statement);
  switch (operator) {
    case 'and':
      return operand.every((s) => isTrue(s, domain));
    case 'nand':
      return !operand.every((s) => isTrue(s, domain));
    case 'or':
      return operand.some((s) => isTrue(s, domain));
    case 'xor':
      return operand.filter((s) => isTrue(s, domain)).length === 1;
    case 'nor':
      return !operand.some((s) => isTrue(s, domain));
    case 'not':
      return !isTrue(operand, domain);
    case 'if':
      return !(isTrue(statement.if, domain) && !isTrue(statement.then, domain));
    case 'iff':
      return operand.every((s) => isTrue(s, domain)) || operand.every((s) => !isTrue(s, domain));
    case 'eq':
      return typeof operand[1] === 'string' ? operand[0] === operand[1] : domain.has(`${operand[0]}:${operand[1]}`);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compare(operator, operand, domain);
    default:
      return false;
  }
}

/**
 * Numeric comparison. An operand is a number or the stem of a numeric roll option: `parent:level` matches the option
 * `parent:level:6` and yields 6.
 */
function compare(operator, [left, right], domain) {
  const values = (operand) => {
    const number = Number(operand);
    if (!Number.isNaN(number)) return [number];
    const prefix = `${operand}:`;
    const found = [];
    for (const option of domain) {
      if (!option.startsWith(prefix)) continue;
      const rest = option.slice(prefix.length);
      if (rest === '' || rest.includes(':')) continue;
      const value = Number(rest);
      if (!Number.isNaN(value)) found.push(value);
    }
    return found.length ? found : [NaN];
  };
  const test = {
    gt: (l, r) => l > r,
    gte: (l, r) => l >= r,
    lt: (l, r) => l < r,
    lte: (l, r) => l <= r,
  }[operator];
  const rights = values(right);
  return values(left).some((l) => rights.every((r) => test(l, r)));
}

/**
 * The lowest effect level a predicate allows, read from its `parent:level` comparisons. Only statements that must
 * always hold are considered (the top level and nested `and`s). Returns null when the predicate sets no minimum.
 * @param {unknown[]} [predicate]
 * @returns {number | null}
 */
export function minLevelOf(predicate = []) {
  let min = null;
  const visit = (statement) => {
    if (!isObject(statement)) return;
    if (Array.isArray(statement.and)) statement.and.forEach(visit);
    const [stem, value] = statement.gte ?? statement.gt ?? [];
    if (stem !== 'parent:level' || typeof value !== 'number') return;
    const level = statement.gte ? value : value + 1;
    min = min === null ? level : Math.max(min, level);
  };
  predicate.forEach(visit);
  return min;
}
