/**
 * Exercise: Sign your name to the check
 * Lesson:   typescript-fundamentals/type-predicates
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Do not change the exported signatures — and read them carefully. Two of them
 * have return types you have not seen before, and those return types are the
 * entire subject of the lesson.
 */

export interface User {
  readonly id: string
  readonly name: string
}

/** True for a string with at least one non-whitespace character. */
export function isNonEmptyString(value: unknown): value is string {
  throw new Error('TODO: return true only for a string with real content')
}

/** True for a non-null object that is not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  throw new Error('TODO: return true only for a plain, non-null, non-array object')
}

/**
 * Throws `` `${label} is missing` `` when `value` is `null` or `undefined`.
 *
 * The `asserts` return type means that after a successful call, the compiler
 * treats `value` as `T` on every following line — no reassignment, no cast.
 */
export function assertDefined<T>(value: T | null | undefined, label: string): asserts value is T {
  throw new Error('TODO: throw when value is null or undefined, and otherwise do nothing')
}

/**
 * Pulls a required string field out of untrusted data.
 *
 *   requireField({ name: 'ada' }, 'name')  →  'ada'
 */
export function requireField(source: unknown, field: string): string {
  throw new Error('TODO: use the two guards above — see solution.test.ts for the messages')
}

/** The name of the user with this id. Throws if there is no such user. */
export function nameOf(users: readonly User[], id: string): string {
  throw new Error('TODO: find the user, assert it exists, return its name')
}
