# An if-statement for types

You cannot ask "is it raining?" about a whole week and get one answer. Ask it about
Monday, Tuesday, Wednesday and you get seven answers, and *then* you can say something
about the week.

That is the strangest and most important rule in this lesson. A conditional type asked
about a union runs once per member — unless you deliberately stop it — and knowing which
one you are doing is the difference between `'a'` and `false` as the answer to the same
question.

## Goal

The four types at the top of `starter.ts` are **given**. Read them; the tests assert
exactly what each produces. Implement the three functions:

- **`unwrap(value)`** awaits a value however deeply nested, and passes a non-promise
  through. One `await` and a cast.
- **`firstOf(items)`** returns the first element or `undefined`. One index and a cast.
- **`stringsOnly(values)`** returns only the strings — and needs **no cast at all**,
  which is the interesting part.

## Two casts and one honest narrowing

`unwrap` and `firstOf` both need a cast, and the reason is the same in each case, worth
being able to state:

```ts
return (await value) as Unwrap<T>
```

`await value` is typed `Awaited<T>`. That is *the same type* as `Unwrap<T>` for every
concrete `T` — but with `T` unresolved the compiler has two unevaluated conditionals and
no way to relate them. The claim is true for every instantiation and unprovable in
general. This is the standard reason a generic function needs a cast where a concrete one
would not.

`stringsOnly` needs none, because `filter` has an overload taking a type predicate:

```ts
values.filter((value): value is string => typeof value === 'string')
```

Real checking, at run time, and the type follows from it. Compare that with the two casts
above: same outcome on the page, completely different amount of trust involved.

## Distributivity, which is the actual lesson

When the checked type is a **naked** type parameter and the argument is a union, the
conditional runs per member and the results are unioned back:

```ts
type StringsOnly<T> = T extends string ? T : never
StringsOnly<'a' | 1 | 'b'> // 'a' | 'b'   — `never` vanishes from a union
```

Wrap both sides in a tuple and `T` is no longer naked, so it asks one question about the
whole union:

```ts
type IsAllStrings<T> = [T] extends [string] ? true : false
IsAllStrings<'a' | 1> // false
```

Same argument, same comparison, different shape of answer. Distributivity is how
`Exclude`, `Extract` and `NonNullable` are built — lesson 9 uses all three — and
`[T] extends [U]` is the idiom for switching it off.

It is also the only reliable way to test for `never`: `T extends never ? true : false`
given `never` distributes over a union with **no members** and produces `never` rather
than `true`. Correct, and never what anybody wanted.

## Why `Unwrap` recurses

```ts
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T
```

Without the recursive call, `Unwrap<Promise<Promise<number>>>` is `Promise<number>` —
while `await` at run time keeps unwrapping until it reaches a plain value. The type would
be a lie about its own implementation, and both halves would look right in isolation. The
test `unwrap goes all the way down, exactly like its type says` holds the two together.

The standard library ships this as `Awaited<T>`, with more care over thenables. Writing it
once is the point; using the built-in afterwards is the practice.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — unwrap</summary>

`await` on a non-promise returns the value unchanged, so one `await` covers both cases
and no branch is needed. Then a cast, because the compiler cannot relate two unresolved
conditionals.

</details>

<details>
<summary>Hint 2 — firstOf</summary>

`items[0]`, already `| undefined` from `noUncheckedIndexedAccess`, plus the same kind of
cast for the same kind of reason.

</details>

<details>
<summary>Hint 3 — stringsOnly</summary>

`filter` with a predicate whose return type is `value is string`. Lesson 1.5 — and note
you get the narrowed array type for free rather than asserting it.

</details>
