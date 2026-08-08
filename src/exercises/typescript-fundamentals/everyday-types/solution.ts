/**
 * Reference solution: Say it in nine words
 * Lesson: typescript-fundamentals/everyday-types
 */

export type Currency = 'usd' | 'eur' | 'gbp'

export interface Order {
  readonly id: string
  readonly quantity: number
  readonly currency: Currency
  readonly express: boolean
  readonly note?: string
}

/* A `switch` over a union of literals needs no `default` and no fallback
   `return` after it. The compiler can see that the three cases are the entire
   type, so it knows every path returns — and if someone adds `'jpy'` to
   `Currency` tomorrow, *this function stops compiling*. That is the whole reason
   to write `'usd' | 'eur' | 'gbp'` instead of `string`: the union is what turns a
   new currency from a silent `undefined` into a build error with a line number. */
export function symbolFor(currency: Currency): string {
  switch (currency) {
    case 'usd':
      return '$'
    case 'eur':
      return '€'
    case 'gbp':
      return '£'
  }
}

/* Two shapes of input, so two branches — and inside each one, `input` is only the
   type that branch is about. `input.trim()` would not compile above the `typeof`
   check, because `number` has no `trim`. That is narrowing, and lesson 4 is
   entirely about it.

   `Number.isInteger` is doing more work than it looks: it rejects `1.5`, `NaN` and
   `Infinity` in one call, all three of which are `number` as far as the type
   system is concerned. */
export function normaliseQuantity(input: string | number): number | undefined {
  if (typeof input === 'number') {
    return Number.isInteger(input) && input >= 1 ? input : undefined
  }

  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return undefined

  const parsed = Number(trimmed)
  return parsed >= 1 ? parsed : undefined
}

/* `note` is declared `note?: string`, so its type here is `string | undefined`
   and you cannot append it blindly. That is the optional marker earning its keep:
   the shape of the data is written down, so the compiler makes you handle the
   half of it that is missing. */
export function describeOrder(order: Order): string {
  const items = order.quantity === 1 ? '1 item' : `${order.quantity} items`
  const express = order.express ? ' (express)' : ''
  const note = order.note !== undefined && order.note.length > 0 ? ` — ${order.note}` : ''

  return `${order.id}: ${items} in ${symbolFor(order.currency)}${express}${note}`
}

/* `readonly Order[]` is the parameter type to reach for by default. It says "I
   will read this list and not touch it", which is true of almost every function
   you write, and it means a caller can hand you a frozen array or an `as const`
   tuple without a fight. */
export function totalQuantity(orders: readonly Order[]): number {
  return orders.reduce((sum, order) => sum + order.quantity, 0)
}
