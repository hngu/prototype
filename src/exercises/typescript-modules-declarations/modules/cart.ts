/**
 * Shared submodule — given, not part of the exercise.
 *
 * The third module. It has a **default export** as well as named ones, because the
 * exercise needs you to re-export one of those too, and they work differently.
 */

import type { Money } from './money.ts'
import { add, money } from './money.ts'

/** A type. */
export interface CartLine {
  readonly label: string
  readonly price: Money
  readonly quantity: number
}

/** A type, and one the exercise deliberately does *not* ask you to re-export. */
export interface CartInternals {
  readonly createdAt: number
}

/** A value. */
export function line(label: string, price: Money, quantity = 1): CartLine {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`quantity must be a positive integer, got ${quantity}`)
  }
  return { label, price, quantity }
}

/** A value. The default export — note there is no name after `default`. */
export default function total(lines: readonly CartLine[]): Money {
  return lines.reduce<Money>(
    (running, current) => add(running, money(current.price.amount * current.quantity, current.price.currency)),
    money(0, lines[0]?.price.currency ?? 'GBP'),
  )
}
