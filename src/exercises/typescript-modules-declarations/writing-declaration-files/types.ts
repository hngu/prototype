/**
 * Shared types — given.
 *
 * In a separate file for a boring reason worth naming: `starter.ts` and `solution.ts` both
 * export `Frontmatter`, and if each declared its own the two would be structurally identical
 * and everything would work — until somebody changed one. Sharing it means the tests are
 * checking both files against the same target rather than against each other's drift.
 */

/** What a valid JSON header line means, once somebody has checked it. */
export interface Frontmatter {
  readonly title: string
  readonly tags: readonly string[]
}
