/**
 * Exercise: One recipe, any ingredient
 * Lesson:   typescript-type-manipulation/generics
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Every signature here has a type parameter — the `<T>` before the parentheses. Read
 * it as a slot the *caller* fills in, usually without noticing: `first([1, 2])` sets
 * `T` to `number`, and the return type follows.
 *
 * Do not add annotations to the call sites in the tests to make things work. If a
 * signature is right, inference does the rest, and that is the whole point.
 */

/** The first item, or `undefined` when there is none. */
export function first<T>(items: readonly T[]): T | undefined {
  throw new Error('TODO: shorter than you expect')
}

/** The last item, or `undefined` when there is none. */
export function last<T>(items: readonly T[]): T | undefined {
  throw new Error('TODO: mind that noUncheckedIndexedAccess is on')
}

/**
 * Pairs two lists up, stopping at the shorter — the `zip` from lesson 2.6, except it
 * now works for any two types rather than strings and numbers.
 *
 *   pairUp(['a', 'b'], [1, 2])  →  [['a', 1], ['b', 2]]
 */
export function pairUp<A, B>(
  left: readonly A[],
  right: readonly B[],
): readonly (readonly [A, B])[] {
  throw new Error('TODO: pair them up, stopping when either list runs out')
}

/**
 * A cache holding one type of value. `Cache<string>` and `Cache<number>` are different
 * types and neither will accept the other's values.
 */
export interface Cache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  has(key: string): boolean
  readonly size: number
}

/** An empty cache. */
export function makeCache<T>(): Cache<T> {
  throw new Error('TODO: a Map, wrapped')
}

/**
 * Reads from the cache, computing and storing the value on a miss.
 *
 * Note `compute` takes the key and returns a `T` — the same `T` the cache holds, so
 * the two cannot drift apart. A cached `undefined` counts as a miss; the comment in
 * `solution.ts` explains why that is unavoidable rather than lazy.
 */
export function cached<T>(cache: Cache<T>, key: string, compute: (key: string) => T): T {
  throw new Error('TODO: return the hit, or compute, store and return')
}
