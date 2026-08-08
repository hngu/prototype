/**
 * Exercise: An empty box and no box
 * Lesson:   typescript-fundamentals/null-and-strictness
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The rule for this exercise: **no `!`.** The non-null assertion is available and
 * it is not the answer to any of these — every one of them has a real check that
 * fits, and finding it is the exercise.
 */

export interface Profile {
  readonly name: string
  /** Optional: the property may be absent entirely. */
  readonly nickname?: string
  /** Not optional: the property is always there, and may hold nothing. */
  readonly bio: string | null
}

/** The first whitespace-separated word, or `undefined` when there isn't one. */
export function firstWord(text?: string): string | undefined {
  throw new Error('TODO: handle no argument, a blank string, and leading whitespace')
}

/** The nickname when there is a real one, otherwise the name. */
export function displayName(profile: Profile): string {
  throw new Error('TODO: prefer the nickname — but only when it has content')
}

/** The bio, or `fallback` when it is `null`. An empty bio is a bio. */
export function bioOrDefault(profile: Profile, fallback: string): string {
  throw new Error('TODO: fall back for null only')
}

/** The configured page size, defaulting to 20. A configured `0` means `0`. */
export function pageSize(configured?: number): number {
  throw new Error('TODO: default only when nothing was configured')
}

/** The item at `index`, or `undefined` when there is nothing there. */
export function pick(items: readonly string[], index: number): string | undefined {
  throw new Error('TODO: shorter than you think — read the comment in solution.ts after')
}
