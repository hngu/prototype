/**
 * The TypeScript release the whole course track is written and graded against.
 *
 * Two facts have to agree here, and they are not the same fact:
 *
 *   1. What the course *claims* — the pinned literal below. Bumping it is a
 *      content decision, not a dependency bump: lesson prose about compiler
 *      behaviour, the `erasableSyntaxOnly` rules the exercises are authored
 *      under, and the diagnostics quoted in lessons are all tied to a specific
 *      compiler.
 *   2. What actually graded the exercises — the installed compiler.
 *
 * Lesson pages render "Typechecked and tested against TypeScript X.Y.Z". If (1)
 * and (2) ever diverge that pill becomes a lie, which is the one thing this
 * feature cannot afford — the exercises exist precisely so a reader does not
 * have to take the site's word for anything. So the literal is a promise and the
 * check below is what keeps it.
 *
 * Kept out of site.ts deliberately: that module is imported by components which
 * could plausibly end up in a client bundle one day, and `node:fs` there would
 * turn this into a build error rather than a config value.
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

export const TYPESCRIPT_VERSION = '6.0.3'

/** `6.0.3` → `6.0`, for prose where the patch number is noise. */
export const TYPESCRIPT_MINOR: string = TYPESCRIPT_VERSION.split('.').slice(0, 2).join('.')

/** Canonical entry point for the language's own docs, so lessons and course
 *  pages link somewhere consistent. */
export const TYPESCRIPT_DOCS_URL = 'https://www.typescriptlang.org/docs/'

/* `typescript` ships no `exports` field, so the `/package.json` subpath resolves
   — checked, not assumed. `src/exercises/tools/parity.test.ts` asserts the same
   agreement from the other side, so `pnpm --filter exercises verify` catches
   drift without needing a full site build. */
const installed = (() => {
  const require = createRequire(import.meta.url)
  const pkg = JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')) as {
    version: string
  }
  return pkg.version
})()

if (installed !== TYPESCRIPT_VERSION) {
  throw new Error(
    `TypeScript version drift: TYPESCRIPT_VERSION is "${TYPESCRIPT_VERSION}" but the installed ` +
      `compiler is "${installed}".\n` +
      `  Either bump TYPESCRIPT_VERSION in src/lib/typescript-version.ts — re-reading any lesson ` +
      `that discusses compiler behaviour while you are there — or pin typescript back in ` +
      `package.json. Both packages must agree; see src/exercises/tools/parity.test.ts.`,
  )
}
