/**
 * Reference solution: Pin a theme config
 * Lesson: typescript-fundamentals/type-inference
 */

export type Mode = 'dark' | 'light'

export interface ThemeConfig {
  readonly mode: Mode
  readonly contrast: 'normal' | 'high'
}

/* `as const` does two things at once, and both matter here: it freezes the array
   into a readonly tuple (fixed length, no push) and it keeps each element at its
   literal type instead of widening to `string`. Without it this is `string[]`,
   and `MODES[0]` would be `string` — useless for narrowing.

   `satisfies readonly Mode[]` checks the elements against Mode without widening
   the type back out, so a typo like 'darkk' is caught here rather than at the
   first call site. A plain `: readonly Mode[]` annotation would lose the tuple. */
export const MODES = ['dark', 'light'] as const satisfies readonly Mode[]

export function makeConfig(mode: Mode): ThemeConfig {
  return { mode, contrast: 'normal' }
}

/* The `value is Mode` return type is an assertion the compiler cannot verify —
   it trusts this body. So the body has to earn it.

   `MODES.includes(value)` does not compile against an `unknown`, and it would
   not compile against a `string` either: `includes` on a `readonly ['dark',
   'light']` only accepts those two literals, which is precisely the thing we are
   trying to find out. Narrowing to `string` first and comparing with a widened
   view of the tuple is the honest way through. */
export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}
