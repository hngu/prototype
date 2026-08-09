/**
 * Exercise: A label on something you cannot touch
 * Lesson:   typescript-modules-declarations/writing-declaration-files
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Two files are given and both are worth reading before you start:
 *
 *   text-utils.js     plain JavaScript, no annotations, and off-limits
 *   text-utils.d.ts   its declarations, written out as a worked example with the
 *                     reasoning behind each choice in the comments
 *
 * `allowJs` is off in this package, so the compiler never looks inside the `.js` at all.
 * Everything it believes about that module comes from the `.d.ts` — which is believed
 * unconditionally, and is why a wrong declaration is worse than no declaration.
 *
 * Your job is the consuming side: build a small typed facade over it, and deal honestly with
 * the one function whose declaration says `unknown`.
 */

import type { Frontmatter } from './types.ts'

export type { Frontmatter }

/** `slugify`, straight through. */
export function slug(text: string): string {
  throw new Error('TODO: one line')
}

/**
 * A preview of `text`, at most `maxLength` characters including the ellipsis.
 *
 * @param maxLength defaults to 40.
 */
export function preview(text: string, maxLength?: number): string {
  throw new Error('TODO: mind who owns the default')
}

/**
 * The comma-separated tags in `text`, lower-cased and de-duplicated, in first-seen order.
 *
 * Returns `readonly string[]` even though `parseList` hands back a mutable array. That is a
 * deliberate difference and the brief explains it.
 */
export function tags(text: string): readonly string[] {
  throw new Error('TODO: parseList, then lower-case and de-duplicate')
}

/**
 * Is this parsed JSON actually a `Frontmatter`?
 *
 * A real check, not a cast. `parseJsonHeader` is declared `unknown` precisely so that
 * somebody has to write this, and a type predicate is how you write it down once.
 *
 * A value qualifies when it is a non-null object with a string `title` and, if `tags` is
 * present at all, an array of strings. A missing `tags` is fine; a `tags` that is not an
 * array of strings is not.
 */
export function isFrontmatter(value: unknown): value is Frontmatter {
  throw new Error('TODO: check, do not assert')
}

/**
 * Reads the first line of `text` as frontmatter, or `undefined` if it is not valid JSON or
 * not the right shape.
 *
 * Normalise on the way out: `tags` is always present in the result, defaulting to `[]`.
 */
export function readFrontmatter(text: string): Frontmatter | undefined {
  throw new Error('TODO: parse, check, normalise')
}

/** The default export's `slugify`, to prove the default import is wired correctly. */
export function slugViaDefault(text: string): string {
  throw new Error('TODO: use the default import rather than the named one')
}
