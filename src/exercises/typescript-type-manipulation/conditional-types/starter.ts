/**
 * Exercise: An if-statement for types
 * Lesson:   typescript-type-manipulation/conditional-types
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The four types below are **given**, and they are the exercise's subject. Read them
 * carefully — `infer`, recursion and distributivity all appear, and the tests assert
 * exactly what each one produces.
 *
 * Your job is the runtime half, and two of the three need a cast. Working out *why* the
 * compiler cannot verify them on its own is the most useful thing in this exercise.
 */

/**
 * The value inside a promise, however many layers deep.
 *
 * `T extends Promise<infer U> ? Unwrap<U> : T` — the recursive call in the true branch
 * is what makes it handle `Promise<Promise<number>>`. This is a simplified `Awaited`,
 * which lesson 9 covers.
 */
export type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T

/** The element type of an array, or `never` for anything that is not one. */
export type ElementOf<T> = T extends readonly (infer U)[] ? U : never

/**
 * **Distributive.** A naked type parameter on the left of `extends` makes the
 * conditional run once per union member, so this keeps the string members and drops the
 * rest: `StringsOnly<'a' | 1 | 'b'>` is `'a' | 'b'`.
 */
export type StringsOnly<T> = T extends string ? T : never

/**
 * The same test, made **non-distributive** by wrapping both sides in a tuple, so `T` is
 * no longer naked. This asks about the union as a whole: `IsAllStrings<'a' | 1>` is
 * `false`, where `StringsOnly` would have answered `'a'`.
 */
export type IsAllStrings<T> = [T] extends [string] ? true : false

/** Awaits a value however deeply nested, and passes a non-promise straight through. */
export async function unwrap<T>(value: T): Promise<Unwrap<T>> {
  throw new Error('TODO: one await, and a cast you can justify')
}

/** The first element, or `undefined`. */
export function firstOf<T extends readonly unknown[]>(items: T): ElementOf<T> | undefined {
  throw new Error('TODO: one index, and a cast you can justify')
}

/** Only the strings, in order. The runtime counterpart of `StringsOnly`. */
export function stringsOnly(values: readonly unknown[]): readonly string[] {
  throw new Error('TODO: no cast needed for this one — think about lesson 1.5')
}
