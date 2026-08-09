/**
 * Exercise: Two X-rays
 * Lesson:   typescript-type-manipulation/keyof-and-typeof
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The three types below are **given** and you should not change them. They are the
 * exercise's subject: read them, and notice that not one of them repeats anything
 * `MODES` already says. Add a fourth mode to `MODES` and all three follow, along with
 * every function that uses them — which is the point.
 *
 * Your job is the runtime half, and the interesting part is where a cast becomes
 * necessary and why `keyof typeof` is what makes it safe.
 */

/** The single source of truth. Everything else here is derived from it. */
export const MODES = {
  dark: 'Dark',
  light: 'Light',
  auto: 'Follow system',
} as const

/** `keyof typeof MODES` — the key names as a union: `'dark' | 'light' | 'auto'`. */
export type Mode = keyof typeof MODES

/** The label types: `'Dark' | 'Light' | 'Follow system'`. */
export type ModeLabel = (typeof MODES)[Mode]

/** The human label for a mode. */
export function labelFor(mode: Mode): ModeLabel {
  throw new Error('TODO: one lookup')
}

/**
 * Every mode, in declaration order.
 *
 * `Object.keys` is typed as returning `string[]`, so this needs a cast — and the cast is
 * safe for a reason you should be able to state out loud before you write it.
 */
export function allModes(): readonly Mode[] {
  throw new Error('TODO: the keys of MODES, correctly typed')
}

/** True for exactly the three mode names. Narrows, so the return type matters. */
export function isMode(value: unknown): value is Mode {
  throw new Error('TODO: check against the real keys rather than a hand-written list')
}

/** The mode with this label, or `undefined`. Case-sensitive. */
export function modeFromLabel(label: string): Mode | undefined {
  throw new Error('TODO: search the entries')
}
