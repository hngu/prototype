/**
 * Shared submodule — given, not part of the exercise.
 *
 * Note the first line: `import type`, because `Money` and `Currency` are types and
 * `verbatimModuleSyntax` requires the import to say so. A plain `import { Money }` here
 * would survive type stripping and throw at run time — `money.ts` provides no such
 * export, because a type is not a thing.
 */

import type { Currency, Money } from './money.ts'
import { SYMBOLS } from './money.ts'

/** How to render an amount. A type. */
export interface FormatOptions {
  /** Show the currency symbol. Default `true`. */
  readonly symbol?: boolean
  /** Decimal places. Default `2`. */
  readonly places?: number
}

/** A value. */
export function formatMoney(value: Money, options: FormatOptions = {}): string {
  const { symbol = true, places = 2 } = options
  const digits = value.amount.toFixed(places)
  return symbol ? `${SYMBOLS[value.currency]}${digits}` : digits
}

/** A value. */
export function symbolFor(currency: Currency): string {
  return SYMBOLS[currency]
}
