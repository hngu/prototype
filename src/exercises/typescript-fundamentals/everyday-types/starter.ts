/**
 * Exercise: Say it in nine words
 * Lesson:   typescript-fundamentals/everyday-types
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Do not change the exported signatures. `solution.test.ts` proves at compile
 * time that this file and `solution.ts` expose the same API, so a changed
 * signature shows up as a type error rather than a confusing test failure.
 */

/** Three allowed strings, and no others. Not `string`. */
export type Currency = 'usd' | 'eur' | 'gbp'

export interface Order {
  readonly id: string
  readonly quantity: number
  readonly currency: Currency
  readonly express: boolean
  /** Optional: some orders have a note, most do not. */
  readonly note?: string
}

/** `'usd'` → `'$'`, `'eur'` → `'€'`, `'gbp'` → `'£'`. */
export function symbolFor(currency: Currency): string {
  throw new Error('TODO: return the symbol for this currency')
}

/**
 * A quantity that may have arrived as text — a form field, a query string.
 * Returns a whole number of 1 or more, or `undefined` if the input is not one.
 */
export function normaliseQuantity(input: string | number): number | undefined {
  throw new Error('TODO: accept a whole number, or digits in a string; reject the rest')
}

/**
 * One line for a human.
 *
 *   'a1: 3 items in £'
 *   'a2: 1 item in $ (express) — gift wrap'
 */
export function describeOrder(order: Order): string {
  throw new Error('TODO: build the summary line — see solution.test.ts for every case')
}

/** The quantities of every order, added up. `0` for an empty list. */
export function totalQuantity(orders: readonly Order[]): number {
  throw new Error('TODO: sum the quantities')
}
