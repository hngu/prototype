/**
 * Exercise: One door onto three rooms
 * Lesson:   typescript-modules-declarations/modules
 *
 * This exercise has no `throw new Error('TODO')` stubs, because there are no function
 * bodies to write. The work is **the export statements**, and every one of them is
 * currently missing.
 *
 * Three modules already exist and are given:
 *
 *   money.ts    Currency, Money            (types)
 *               SYMBOLS, money, add        (values)
 *   format.ts   FormatOptions              (type)
 *               formatMoney, symbolFor     (values)
 *   cart.ts     CartLine, CartInternals    (types)
 *               line                       (value)
 *               default export `total`     (value)
 *
 * Your job is to make this file the single public entry point — a **barrel** — that
 * re-exports exactly the right things under exactly the right names.
 *
 * `verbatimModuleSyntax` is on, so an `export { … }` of something that is only a type
 * fails to compile. It has to be `export type { … }`. That is the point of the exercise:
 * the compiler makes you say which of the two kinds of thing you are moving, because one
 * of them does not exist once the types are stripped.
 *
 * ── Required public surface ────────────────────────────────────────────────────────────
 *
 * Types:   Currency, Money, FormatOptions, CartLine
 * Values:  SYMBOLS, money, add, formatMoney, symbolFor, line
 *          total          ← `cart.ts`'s *default* export, re-exported under this name
 *          formatLine     ← does not exist yet; see below
 *
 * Deliberately NOT exported: `CartInternals`, and `money.ts`'s `round`, which is not
 * exported from `money.ts` in the first place. A barrel decides what leaves the building.
 *
 * ── The one thing you write ────────────────────────────────────────────────────────────
 *
 * `formatLine(cartLine)` renders `2 × Coffee — £7.00`, where the price shown is the line
 * total (unit price × quantity), and `×` is U+00D7. When the quantity is 1, drop the
 * count entirely: `Coffee — £3.50`.
 */

export {}
