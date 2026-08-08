import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
/* Type-only import: `verbatimModuleSyntax` requires the keyword, and without it
   the erased file would ask Node for an export that no longer exists. */
import type { Currency, Order } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* No `express` and no `note` — the two are here to be varied per test. */
const base: Order = { id: 'a1', quantity: 3, currency: 'gbp', express: false }

test('symbolFor covers every currency in the union', () => {
  // Written as a loop over an `as const` tuple so that adding a currency to the
  // union without adding it here is a *compile* error, not a missing test.
  const expected = [
    ['usd', '$'],
    ['eur', '€'],
    ['gbp', '£'],
  ] as const satisfies readonly (readonly [Currency, string])[]

  for (const [currency, symbol] of expected) {
    assert.equal(subject.symbolFor(currency), symbol)
  }
})

test('normaliseQuantity accepts whole numbers of one or more', () => {
  assert.equal(subject.normaliseQuantity(1), 1)
  assert.equal(subject.normaliseQuantity(42), 42)
})

test('normaliseQuantity accepts digits in a string, trimmed', () => {
  assert.equal(subject.normaliseQuantity('1'), 1)
  assert.equal(subject.normaliseQuantity('  12  '), 12)
})

test('normaliseQuantity rejects everything else', () => {
  assert.equal(subject.normaliseQuantity(0), undefined)
  assert.equal(subject.normaliseQuantity(-3), undefined)
  assert.equal(subject.normaliseQuantity(1.5), undefined)
  assert.equal(subject.normaliseQuantity(Number.NaN), undefined)
  assert.equal(subject.normaliseQuantity(Number.POSITIVE_INFINITY), undefined)

  assert.equal(subject.normaliseQuantity(''), undefined)
  assert.equal(subject.normaliseQuantity('   '), undefined)
  assert.equal(subject.normaliseQuantity('0'), undefined)
  assert.equal(subject.normaliseQuantity('two'), undefined)
  assert.equal(subject.normaliseQuantity('1.5'), undefined)
  assert.equal(subject.normaliseQuantity('-3'), undefined)
  assert.equal(subject.normaliseQuantity('1e3'), undefined)
})

test('describeOrder pluralises and uses the currency symbol', () => {
  assert.equal(subject.describeOrder(base), 'a1: 3 items in £')
  assert.equal(subject.describeOrder({ ...base, quantity: 1 }), 'a1: 1 item in £')
  assert.equal(subject.describeOrder({ ...base, currency: 'usd' }), 'a1: 3 items in $')
})

test('describeOrder appends the optional parts only when they apply', () => {
  assert.equal(subject.describeOrder({ ...base, express: true }), 'a1: 3 items in £ (express)')
  assert.equal(subject.describeOrder({ ...base, note: 'gift wrap' }), 'a1: 3 items in £ — gift wrap')
  assert.equal(
    subject.describeOrder({ id: 'a2', quantity: 1, currency: 'usd', express: true, note: 'gift wrap' }),
    'a2: 1 item in $ (express) — gift wrap',
  )
})

test('describeOrder treats an empty note as no note', () => {
  assert.equal(subject.describeOrder({ ...base, note: '' }), 'a1: 3 items in £')
})

test('totalQuantity sums the list, and an empty list is zero', () => {
  assert.equal(subject.totalQuantity([]), 0)
  assert.equal(subject.totalQuantity([base]), 3)
  assert.equal(subject.totalQuantity([base, { ...base, id: 'a2', quantity: 4 }]), 7)
})

test('totalQuantity accepts a genuinely readonly list', () => {
  // The point of this test is that it COMPILES. A frozen `as const` tuple is not
  // assignable to `Order[]`, only to `readonly Order[]` — so if the signature
  // drops the `readonly`, this line is a type error rather than a failure.
  const frozen = [base, { ...base, id: 'a2', quantity: 4 }] as const

  assert.equal(subject.totalQuantity(frozen), 7)
})

test('normaliseQuantity feeds an Order without a cast', () => {
  // Also a compile-time test. `normaliseQuantity` returns `number | undefined`,
  // and `Order.quantity` is `number` — so this only builds because `assert.ok`
  // rules out the `undefined` first.
  const quantity = subject.normaliseQuantity(' 5 ')

  assert.ok(quantity !== undefined)
  assert.equal(subject.describeOrder({ ...base, quantity }), 'a1: 5 items in £')
})
