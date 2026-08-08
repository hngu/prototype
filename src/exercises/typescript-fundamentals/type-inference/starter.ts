/**
 * Exercise: Pin a theme config
 * Lesson:   typescript-fundamentals/type-inference
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Do not change the exported signatures. `solution.test.ts` proves at compile
 * time that this file and `solution.ts` expose the same API, so a changed
 * signature shows up as a type error rather than a confusing test failure.
 */

export type Mode = 'dark' | 'light'

export interface ThemeConfig {
  readonly mode: Mode
  readonly contrast: 'normal' | 'high'
}

/** Every mode, as a readonly tuple of literals — not `string[]`. */
export const MODES: readonly ['dark', 'light'] = ['dark', 'light']

/** Builds a config for `mode`, defaulting the contrast to `'normal'`. */
export function makeConfig(mode: Mode): ThemeConfig {
  throw new Error('TODO: return a ThemeConfig with this mode and contrast "normal"')
}

/** A type predicate: tells the compiler what `value` is, not just the runtime. */
export function isMode(value: unknown): value is Mode {
  throw new Error('TODO: return true only for "dark" or "light"')
}
