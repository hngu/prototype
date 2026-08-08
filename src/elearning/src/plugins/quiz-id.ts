/**
 * The quiz id naming rule, in one place.
 *
 * Two callers need it and they must never disagree:
 *
 *   - quiz-plugin.ts, so a bad id surfaces in the `astro dev` error overlay
 *     while you are typing it;
 *   - scripts/check-content.ts, which is the actual build gate (see that file
 *     for why the plugin cannot be one).
 *
 * Dependency-free, in the same spirit as quiz-parse.ts, so it stays trivially
 * runnable outside a build.
 */

/**
 * The id prefix every quiz in a given lesson file must use:
 *
 *   …/content/lessons/typescript-fundamentals/01-type-inference.md
 *   → typescript-fundamentals-type-inference   (so ids are `…-q1`, `…-q2`, …)
 *
 * Global uniqueness is enforced separately, but "unique" is not the same as
 * "findable". The finished track is ~50 lessons carrying three quizzes each, and
 * at 150-odd ids an author writing lesson 40 must not have to grep for a free
 * name. Deriving the id from the path makes collisions structurally impossible
 * rather than merely detected, and makes any quiz's id predictable from the file
 * already open in front of you.
 *
 * Returns null for anything outside the lessons tree — the homepage demo in
 * components/landing/QuizDemo.astro calls parseQuizBlock directly and should not
 * be forced into a lesson's naming scheme.
 */
export function expectedIdPrefix(file: string): string | null {
  const match = /content[\\/]lessons[\\/]([^\\/]+)[\\/](.+)\.md$/.exec(file)
  if (!match) return null
  // Same `NN-` strip as `generateId` in content.config.ts — change together.
  const slug = match[2]!.replace(/(^|[\\/])\d+[-_]/g, '$1')
  return `${match[1]!}-${slug}`
}

/**
 * Validates one id against a prefix. Returns an error message, or null if fine.
 *
 * Built with startsWith + a numeric test rather than an interpolated RegExp: a
 * course id or lesson slug containing a regex metacharacter would otherwise be
 * able to turn this check into a silent pass.
 */
export function quizIdProblem(id: string, prefix: string): string | null {
  const suffix = id.startsWith(`${prefix}-q`) ? id.slice(prefix.length + 2) : null
  if (suffix !== null && /^[1-9]\d*$/.test(suffix)) return null

  return (
    `Quiz id "${id}" does not match this file.\n` +
    `  expected: ${prefix}-q<n>   (the first quiz in the file is ${prefix}-q1)\n` +
    `  Ids are derived from the path so that ~150 of them stay unique and findable ` +
    `without a registry.`
  )
}
