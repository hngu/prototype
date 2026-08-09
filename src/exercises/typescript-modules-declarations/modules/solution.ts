/**
 * Reference solution: One door onto three rooms
 * Lesson: typescript-modules-declarations/modules
 */

/* ── Types ─────────────────────────────────────────────────────────────────────────────
   `export type { … }`, not `export { … }`.

   `verbatimModuleSyntax` insists on it, and the insistence is doing real work rather than
   being fussy. Node runs these files by *erasing* types. A plain `export { Money }` would
   survive that erasure as a genuine re-export instruction, and at run time `money.ts`
   provides no `Money` — a type is not a thing — so the import throws:

     SyntaxError: The requested module './money.ts' does not provide an export named 'Money'

   `export type` is erased entirely, which is the correct outcome. The rule is worth
   internalising as: the compiler makes you say which of the two universes a name lives in,
   because only one of them still exists when the program runs. */
export type { Currency, Money } from './money.ts'
export type { FormatOptions } from './format.ts'
export type { CartLine } from './cart.ts'

/* `CartInternals` is deliberately absent. A barrel is not an index of everything that
   exists — it is the decision about what leaves the building. Anything you re-export
   becomes something callers can depend on, and taking it back later is a breaking change,
   so the useful default is to export less than you have. */

/* ── Values ────────────────────────────────────────────────────────────────────────────
   Plain `export { … }` for things that exist at run time. Note `round` in `money.ts` is
   not exported *there*, so it could not be re-exported here even if we wanted to — a
   module's own boundary is the first gate, and the barrel is the second. */
export { SYMBOLS, add, money } from './money.ts'
export { formatMoney, symbolFor } from './format.ts'
export { line } from './cart.ts'

/* Re-exporting a default export, which needs the rename form.

   `export { default as total } from './cart.ts'` is the whole trick: `default` is a real
   export name, just an unusual one, so it can be renamed on the way through. Without the
   rename there would be no way to refer to it — a barrel cannot have two defaults, and a
   bare `export { default }` would make it this module's default rather than a named one. */
export { default as total } from './cart.ts'

/* ── The one function this module actually owns ────────────────────────────────────────
   `import type` for the type, plain `import` for the values, same rule as the exports.

   A barrel is allowed to add things. What it should not do is add things that belong in a
   submodule — `formatLine` lives here because it is the only code that needs both `cart`
   and `format`, and pushing it into either one would make those two modules depend on each
   other for no reason. */
import type { CartLine } from './cart.ts'
import { money } from './money.ts'
import { formatMoney } from './format.ts'

export function formatLine(cartLine: CartLine): string {
  const lineTotal = money(cartLine.price.amount * cartLine.quantity, cartLine.price.currency)
  const rendered = formatMoney(lineTotal)

  /* Drop the count when there is one of something. "1 × Coffee" is how a machine talks. */
  return cartLine.quantity === 1
    ? `${cartLine.label} — ${rendered}`
    : `${cartLine.quantity} × ${cartLine.label} — ${rendered}`
}
