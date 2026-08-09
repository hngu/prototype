/**
 * The metadata keys, and the only exercise in this repo with a fifth file.
 *
 * A `unique symbol` is the one **nominal** type TypeScript has: its identity is the
 * declaration itself, not its shape. Which means it cannot be declared twice — two
 * files each writing `const AUDIT: unique symbol = Symbol('audit')` produce two
 * unrelated types that are not assignable to one another, however identical they look.
 *
 * That is precisely the guarantee the lesson is about, and it applies to `starter.ts`
 * and `solution.ts` like it applies to anything else. If each declared its own keys,
 * the API-parity check in `solution.test.ts` would fail with
 *
 *   TS2322: Type 'typeof import("./starter")' is not assignable to
 *           type 'typeof import("./solution")'
 *
 * ...which is the type system correctly refusing to confuse two different keys. So
 * they share these.
 */

/* `unique symbol` requires `const` — a `let` could be reassigned, and then the claim
   "the type whose only value is this one" would be a lie. It also requires the
   annotation: without it, `AUDIT` is typed `symbol`, meaning "some symbol, who knows
   which", which cannot be used as a property key in an interface. Both are erased. */
export const AUDIT: unique symbol = Symbol('audit')
export const TRACE: unique symbol = Symbol('trace')

/** `typeof AUDIT` is the type whose only value is `AUDIT`. */
export type MetaKey = typeof AUDIT | typeof TRACE
