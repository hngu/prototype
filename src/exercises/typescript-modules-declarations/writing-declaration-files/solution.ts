/**
 * Reference solution: A label on something you cannot touch
 * Lesson: typescript-modules-declarations/writing-declaration-files
 */

/* Named imports of a plain `.js` file. Nothing about this looks unusual, and that is the
   point of a declaration file: once the label is on, the exhibit behaves like everything
   else. The compiler never reads `text-utils.js` — `allowJs` is off — so every one of these
   types comes from `text-utils.d.ts`, on trust. */
import { parseJsonHeader, parseList, slugify, truncate } from './text-utils.js'

/* And the default export, declared in the `.d.ts` as `declare const` + `export default`. */
import textUtils from './text-utils.js'

import type { Frontmatter } from './types.ts'

export type { Frontmatter }

export function slug(text: string): string {
  return slugify(text)
}

/* The default lives *here*, not in the declaration file. `truncate`'s declaration says
   `suffix?: string` — that a caller may omit it — and deliberately does not say what happens
   then, because the default value is the implementation's business and not part of the
   contract. Our own default of 40 is our contract, so it belongs in our signature. */
export function preview(text: string, maxLength = 40): string {
  return truncate(text, maxLength)
}

/* `parseList` returns `string[]`, which is honest: it builds a fresh array and the caller
   owns it. We narrow to `readonly string[]` on the way out because *our* callers do not own
   this one — it is ours, and we would rather not have it mutated behind our back.

   Widening and narrowing in the right directions at each boundary is most of what a facade
   is for. */
export function tags(text: string): readonly string[] {
  const seen = new Set<string>()

  for (const tag of parseList(text)) {
    seen.add(tag.toLowerCase())
  }

  /* A `Set` preserves insertion order, so first-seen order comes free. */
  return [...seen]
}

/* The whole reason `parseJsonHeader` is declared `unknown`.

   Every check here is a real run-time check. The alternative — `return true` with a
   `value is Frontmatter` signature, or a cast at the call site — would compile and would move
   the failure to whichever unlucky line first reads `.title.toUpperCase()`.

   Note `Array.isArray` narrows to `any[]`, so the element check is not optional: a
   `tags: [1, 2]` would otherwise sail straight through. Course 1's lesson on predicates is
   the one being cashed in here. */
export function isFrontmatter(value: unknown): value is Frontmatter {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as { title?: unknown; tags?: unknown }

  if (typeof candidate.title !== 'string') return false

  if (candidate.tags === undefined) return true

  return Array.isArray(candidate.tags) && candidate.tags.every((tag) => typeof tag === 'string')
}

/* Parse, check, normalise — in that order, and the normalising matters.

   `isFrontmatter` accepts a value with no `tags` at all, because that is a legitimate header.
   Callers should not then have to handle `tags` being absent, so the boundary fills it in.
   A facade that hands its callers the same uncertainty it received has not done anything. */
export function readFrontmatter(text: string): Frontmatter | undefined {
  const parsed = parseJsonHeader(text)

  if (!isFrontmatter(parsed)) return undefined

  return { title: parsed.title, tags: parsed.tags ?? [] }
}

export function slugViaDefault(text: string): string {
  return textUtils.slugify(text)
}
