/**
 * Reference solution: An if-statement for types
 * Lesson: typescript-type-manipulation/conditional-types
 */

/* `A extends B ? X : Y` is an if-statement that runs in the type system, and `infer`
   is how you name a piece of the thing you matched. Read this one as: if `T` is some
   promise, call the thing it resolves to `U`, and keep going in case that is a promise
   too. Otherwise `T` was not a promise, so hand it back.

   The recursive call is not decoration. Without it, `Unwrap<Promise<Promise<number>>>`
   would be `Promise<number>` — while `await` at run time keeps unwrapping until it
   reaches a plain value. The type would be a lie about its own implementation, which is
   the sort of bug that survives for years because both halves look right on their own.

   The standard library ships this as `Awaited<T>`, with more care taken over thenables.
   Writing it once is the point; using the built-in is what you should do afterwards. */
export type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T

/* `infer` inside an array pattern. `readonly (infer U)[]` matches both `T[]` and
   `readonly T[]`, because a mutable array is assignable to the readonly form — writing
   the pattern the other way round would quietly fail for readonly inputs. */
export type ElementOf<T> = T extends readonly (infer U)[] ? U : never

/* **Distributivity**, which is the one genuinely surprising rule about conditional types.

   When the checked type is a *naked* type parameter — just `T`, not `[T]` or `T & {}` —
   and the argument is a union, the conditional runs separately on each member and the
   results are unioned back together. So `StringsOnly<'a' | 1 | 'b'>` becomes
   `('a' extends string ? 'a' : never) | (1 extends string ? 1 : never) | …`, which is
   `'a' | never | 'b'`, which is `'a' | 'b'` — `never` vanishes from a union.

   That is how `Exclude` and `NonNullable` are built, and lesson 9 uses both. */
export type StringsOnly<T> = T extends string ? T : never

/* The same comparison with distributivity switched off, by making `T` non-naked. Now the
   question is about the union as a whole, and `'a' | 1` is not assignable to `string`, so
   the answer is `false`.

   `[T] extends [U]` is the standard idiom for this and worth recognising on sight. It is
   also the only reliable way to test for `never`: `T extends never ? true : false` given
   `never` distributes over a union with no members and produces `never` rather than
   `true`, which is correct and never what anybody wanted. */
export type IsAllStrings<T> = [T] extends [string] ? true : false

/* `await` on a non-promise returns the value, so one `await` covers both cases at run
   time. The cast is the interesting part.

   `await value` is typed `Awaited<T>`. That is *the same type* as `Unwrap<T>` for every
   concrete `T`, but the compiler cannot see it: with `T` unresolved, neither conditional
   can be evaluated, so it has two unresolved conditionals and no way to relate them.
   This is the standard reason a generic function needs a cast that a concrete one would
   not — the claim is true for every instantiation and unprovable in general. */
export async function unwrap<T>(value: T): Promise<Unwrap<T>> {
  return (await value) as Unwrap<T>
}

/* Same shape of cast, same reason. `items[0]` is `T[number] | undefined` thanks to
   `noUncheckedIndexedAccess`, and `T[number]` really is `ElementOf<T>` for every array
   `T` — but `ElementOf<T>` is an unresolved conditional, so the compiler will not take
   our word for it without being told. */
export function firstOf<T extends readonly unknown[]>(items: T): ElementOf<T> | undefined {
  return items[0] as ElementOf<T> | undefined
}

/* And the one that needs no cast at all, which is worth noticing after the two that did.

   `filter` has an overload taking a type predicate, so `(value): value is string` narrows
   the result from `unknown[]` to `string[]` honestly — the checking is real, at run time,
   and the type follows from it. Lesson 1.5's predicate, doing a job no cast could do
   safely. */
export function stringsOnly(values: readonly unknown[]): readonly string[] {
  return values.filter((value): value is string => typeof value === 'string')
}
