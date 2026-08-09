/**
 * Exercise: Must fit through this door
 * Lesson:   typescript-type-manipulation/constraints-and-defaults
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * "Any type at all" is usually too generous. `T extends Something` is the sign on the
 * door: anything may come through as long as it fits — and, crucially, it arrives on
 * the other side still being itself rather than being flattened into `Something`.
 *
 * That last part is the whole exercise. Watch what the tests get back.
 */

/**
 * One field from every item.
 *
 *   pluck(users, 'name')  →  readonly string[]
 *   pluck(users, 'age')   →  readonly number[]
 *
 * `K extends keyof T` means the key has to be one this item actually has, and `T[K]`
 * is the type of that field — so the result type follows from which key you asked for.
 */
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): readonly T[K][] {
  throw new Error('TODO: one line')
}

/**
 * Indexes items by their `id`. Later duplicates win.
 *
 * The constraint asks only for an `id`. The values in the returned map are still the
 * full `T`, which is the difference between a constraint and a parameter type.
 */
export function byId<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  throw new Error('TODO: build the index')
}

/** Whichever of the two is longer. Ties go to `a`. */
export function longest<T extends { readonly length: number }>(a: T, b: T): T {
  throw new Error('TODO: compare lengths')
}

/** A labelled bucket. `Bucket` with no argument holds strings. */
export interface Bucket<T = string> {
  readonly label: string
  readonly items: readonly T[]
}

/**
 * Builds a bucket. `items` is optional, so with nothing to infer from, the **generic
 * parameter default** decides: `makeBucket('empty')` is a `Bucket<string>`.
 */
export function makeBucket<T = string>(label: string, items?: readonly T[]): Bucket<T> {
  throw new Error('TODO: an empty bucket when no items were given')
}
