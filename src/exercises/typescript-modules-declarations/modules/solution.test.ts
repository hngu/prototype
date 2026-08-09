import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Currency, Money } from './money.ts'
import type { FormatOptions } from './format.ts'
import type { CartLine } from './cart.ts'

/**
 * The parity check works differently here, and this is the only exercise in the track
 * where it has to.
 *
 * Everywhere else the deliverable is a set of function *bodies*, so both files can be
 * required to expose the same API at compile time. Here the deliverable **is** the API —
 * `starter.ts` begins with no exports at all, because that is the exercise. A compile-time
 * `typeof solution = starter` assertion would therefore be red on a fresh clone, which
 * breaks this package's second invariant.
 *
 * So the shape is checked at **run time** instead, by the first two tests, and `subject` is
 * cast rather than checked. The cast is the honest cost of grading a module's surface:
 * everything below still fails loudly for the right reason, and the learner gets their
 * compile errors where they matter — in `starter.ts`, from `verbatimModuleSyntax`, the
 * moment they write `export { Money }` instead of `export type { Money }`.
 */
interface ExerciseModule {
  readonly SYMBOLS: Readonly<Record<Currency, string>>
  money(amount: number, currency?: Currency): Money
  add(a: Money, b: Money): Money
  formatMoney(value: Money, options?: FormatOptions): string
  symbolFor(currency: Currency): string
  line(label: string, price: Money, quantity?: number): CartLine
  total(lines: readonly CartLine[]): Money
  formatLine(cartLine: CartLine): string
}

const target = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution
const subject = target as unknown as ExerciseModule

/** Everything the barrel must expose as a *value*, and therefore at run time. */
const REQUIRED_VALUES = [
  'SYMBOLS',
  'add',
  'formatLine',
  'formatMoney',
  'line',
  'money',
  'symbolFor',
  'total',
] as const

test('the barrel exposes exactly the values it should — no more, no fewer', () => {
  // An exact match rather than two one-sided checks, because a barrel is a decision about
  // what leaves and both halves of that decision matter. `CartInternals` is a type so it
  // could not appear here anyway; `round` is unexported in `money.ts`, so the submodule's
  // own boundary already stopped it before the barrel got a say.
  assert.deepEqual(Object.keys(target).sort(), [...REQUIRED_VALUES])
})

test('the re-exported values are the same objects, not copies', () => {
  // Re-exporting binds to the original. There is one `money` function in the program, and
  // `barrel.money === money.ts's money` — which is why a barrel costs nothing at run time
  // beyond loading the modules behind it.
  assert.equal(subject.SYMBOLS.GBP, '£')
  assert.equal(subject.money(3.5).currency, 'GBP', 'the default parameter came through')
  assert.equal(subject.symbolFor('EUR'), '€')
})

test('the values behave as their own modules do', () => {
  const three = subject.money(3, 'USD')
  const four = subject.money(4, 'USD')

  assert.deepEqual(subject.add(three, four), { amount: 7, currency: 'USD' })
  assert.equal(subject.formatMoney(three), '$3.00')
  assert.equal(subject.formatMoney(three, { symbol: false, places: 1 }), '3.0')
})

test('the errors thrown by the submodules come through unchanged', () => {
  // Re-exporting does not wrap anything, so `add`'s own guard is the one that fires.
  assert.throws(() => subject.add(subject.money(1, 'GBP'), subject.money(1, 'USD')), TypeError)
  assert.throws(() => subject.money(Number.NaN), RangeError)
  assert.throws(() => subject.line('Coffee', subject.money(1), 0), RangeError)
})

test('the default export arrives under a name', () => {
  // `cart.ts` exports `total` as its *default*. A barrel cannot pass a default through as a
  // default without becoming the default itself, so it has to be renamed on the way:
  // `export { default as total } from './cart.ts'`.
  const lines = [
    subject.line('Coffee', subject.money(3.5), 2),
    subject.line('Cake', subject.money(4.25)),
  ]

  assert.deepEqual(subject.total(lines), { amount: 11.25, currency: 'GBP' })

  // And the barrel does not acquire a default of its own on the way. A bare
  // `export { default } from './cart.ts'` would have made `total` *this* module's default,
  // which is a surprise for every caller and is why the rename is not optional.
  assert.equal('default' in target, false)
})

test('formatLine drops the count when there is one of something', () => {
  assert.equal(subject.formatLine(subject.line('Coffee', subject.money(3.5))), 'Coffee — £3.50')
})

test('formatLine shows the line total, not the unit price', () => {
  // The trap: `2 × Coffee — £3.50` would be the unit price, which is the wrong number in
  // the position a reader expects a subtotal.
  assert.equal(
    subject.formatLine(subject.line('Coffee', subject.money(3.5), 2)),
    '2 × Coffee — £7.00',
  )

  assert.equal(
    subject.formatLine(subject.line('Cake', subject.money(4.25, 'USD'), 3)),
    '3 × Cake — $12.75',
  )
})

test('the re-exported types are usable, and that is a compile-time claim', () => {
  // These four names have to arrive through the barrel as *types*. If they had been
  // re-exported with a plain `export { … }` this file would not have compiled — and if they
  // were missing entirely, neither would these annotations.
  const value: Money = { amount: 1, currency: 'GBP' }
  const currency: Currency = 'EUR'
  const options: FormatOptions = { symbol: false }
  const cartLine: CartLine = { label: 'Tea', price: value, quantity: 1 }

  type _money = Expect<Equals<typeof value.amount, number>>
  type _currency = Expect<Equals<Currency, 'GBP' | 'USD' | 'EUR'>>

  assert.equal(subject.formatMoney(value, options), '1.00')
  assert.equal(subject.symbolFor(currency), '€')
  assert.equal(subject.formatLine(cartLine), 'Tea — £1.00')
})
