/**
 * Shared submodule — given, not part of the exercise.
 *
 * One of three small modules that `starter.ts` and `solution.ts` both build a public
 * surface over. Notice that it exports a mix of types and values, which is the whole
 * difficulty of the exercise next door.
 */

/** A currency this system understands. A type — it has no run-time existence. */
export type Currency = 'GBP' | 'USD' | 'EUR'

/** An amount of money. Also a type. */
export interface Money {
  readonly amount: number
  readonly currency: Currency
}

/** A value: a real object that exists at run time. */
export const SYMBOLS: Readonly<Record<Currency, string>> = Object.freeze({
  GBP: '£',
  USD: '$',
  EUR: '€',
})

/** A value: a function. */
export function money(amount: number, currency: Currency = 'GBP'): Money {
  if (!Number.isFinite(amount)) throw new RangeError(`amount must be finite, got ${amount}`)
  return { amount, currency }
}

/** A value, and the only one here that is not exported — deliberately. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`cannot add ${a.currency} to ${b.currency}`)
  }
  return { amount: round(a.amount + b.amount), currency: a.currency }
}
