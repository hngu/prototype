# One recipe, any ingredient

A recipe for jam is the same recipe whichever fruit you use. Weigh the fruit, add
sugar, boil. It does not become a different recipe for plums — but the label on the
jar has to say *plum*, because you have not made "some sort of jam", you have made
plum jam.

A generic is that recipe. One implementation, any type, and the type you passed in is
remembered on the way out. This exercise is five of them, and the interesting thing is
how little the bodies change.

## Goal

Implement the five functions in `starter.ts`:

- **`first(items)`** and **`last(items)`** return `T | undefined`. Both are one line;
  the second needs a moment's thought about `noUncheckedIndexedAccess`.
- **`pairUp(left, right)`** pairs two lists up, stopping at the shorter. This is
  lesson 2.6's `zip` with the concrete types lifted out.
- **`makeCache<T>()`** returns a `Cache<T>` — `get`, `set`, `has` and a live `size`.
- **`cached(cache, key, compute)`** returns the hit, or computes, stores and returns.
  A cached `undefined` counts as a miss; the comment in `solution.ts` explains why that
  is unavoidable rather than lazy.

**Do not add type arguments at the call sites to make things work.** If a signature is
right, inference handles the rest — `first([1, 2])` and never `first<number>([1, 2])` —
and that is most of what makes generics worth having.

## What the tests pin down

Four of them are compile-time facts, and they are the real content:

- **`the caller never writes a type argument`** assigns results to concrete types and
  includes a `@ts-expect-error` proving `first([1, 2])` is *not* a `string | undefined`.
  A generic function is not a loose one.
- **`pairUp infers each side independently`** asserts
  `Equals<pairs[number], readonly [string, Date]>`. One type parameter would have forced
  both lists to hold the same type — the *number* of parameters is a design decision.
- **`two caches of different types do not mix`** shows `Cache<string>` refusing a number
  and refusing a `Cache<number>`. Without the type argument both would be
  `Cache<unknown>` and neither line would be an error.
- **`cached ties the cache and the compute function to one type`** is the payoff: one `T`
  threaded through three positions, so a `compute` returning the wrong type is a compile
  error here rather than a surprise on a cache hit months later.

`Equals` and `Expect` come from `tools/type-assert.ts`. `Equals<A, B>` is true only when
the two are the *same* type — not merely mutually assignable — and `Expect` fails to
compile unless handed `true`.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — first and last</summary>

`items[0]` is already `T | undefined`, because `noUncheckedIndexedAccess` will not
pretend an index exists. So the declared return type and the obvious body agree and
there is nothing to reconcile. `last` is the same idea with a different index.

</details>

<details>
<summary>Hint 2 — pairUp</summary>

Identical to lesson 2.6. Iterate one list with `.entries()` so the element is not
widened, index the other, and stop at the first missing value.

</details>

<details>
<summary>Hint 3 — the cache</summary>

A `Map<string, T>` in a closure, and an object exposing four members over it. `size` is
declared `readonly` and must reflect the live map, so it wants a getter rather than a
copied number.

</details>

<details>
<summary>Hint 4 — how generic bodies feel</summary>

Notice that `T` barely appears in any body except as an argument to `Map`. Generic code
is ordinary code with the concrete type lifted out. If your implementation starts
needing casts, that is usually a sign the *signature* is wrong rather than the body.

</details>
