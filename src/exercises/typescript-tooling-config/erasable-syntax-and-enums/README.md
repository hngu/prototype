# Peel it off, or weld it on

A sticker comes off a laptop and the laptop still works. A welded-on bracket does not, and
trying to remove it leaves you with neither.

Most TypeScript is a sticker. A few features are welded on, and `enum` is the clearest one.

## Why this exercise exists at all

Node runs these files by **erasing** types — deleting annotations and running what is left. An
`enum` cannot survive that, because it produces an object that has to exist at run time:

```ts
enum Status { Queued = 'queued', Running = 'running' }
```

Peel the types off and there is no `Status` object, so `Status.Queued` is a `TypeError` on the
first call. `erasableSyntaxOnly` makes it `TS1294` at authoring time instead, which is why that
line appears in this brief and nowhere in the code.

So this exercise is the one place where the constraint the whole package is authored under
*becomes* the subject.

## Goal

Replace the enum with an `as const` object plus derived types, then use them.

**Part 1 — the types.** `STATUS` is given. Derive `StatusKey` with `keyof typeof`, and `Status`
with an indexed access. Both are currently written out longhand so a fresh clone compiles;
replacing them with derived versions is the work, and the `Expect<Equals<…>>` line under each
holds either way.

**Part 2 — things an enum could not do.** `allStatuses()`, `isStatus(value)`,
`keyOf(value)`.

**Part 3 — exhaustiveness.** `describe(status)` as a `switch` with no `default` and an
exhaustiveness check; `DESCRIPTIONS` as a complete `Record<Status, string>` with the `as` cast
deleted; `isCancellable(status)` written so a fifth status breaks it at compile time.

## The four wins, concretely

This is not a workaround for a banned feature. It is better in four specific ways:

1. **Two types instead of one.** An enum member is a name *and* a value at once, so code that
   wants only the values — or only the keys — cannot ask. Here `Status` and `StatusKey` are
   separate and neither was written by hand.
2. **The values are plain strings.** `Object.values(STATUS)` gives you a correctly typed array.
   `Object.values(SomeStringEnum)` gives you `string[]` and needs a cast, because the enum
   object also carries a reverse mapping for numeric members and the typing cannot know yours
   has none.
3. **A predicate with no cast on the value.** `isStatus` is a real run-time check that narrows.
   With a string enum there is no typed run-time list of members to check against.
4. **The same exhaustiveness.** A `switch` with no `default` plus `assertNever`, or a
   `Record<Status, …>` table. Add a fifth status and both stop compiling.

And it costs nothing in the output: no object is emitted, because there is no enum.

## `as const` is not `Object.freeze`

Two halves, and only one survives to run time.

Without `as const`, every value widens to `string`, `Status` becomes `string`, and **every
guarantee above silently evaporates while still compiling.** That is the most common way this
pattern is got wrong, and nothing warns you.

With it, the properties are `readonly` — at the type level only. The `readonly` is erased, so a
write really does land. `solution.test.ts` demonstrates that and then puts the value back,
because leaving it would corrupt `STATUS` for every later test in the file. That is not
hypothetical; it is what happened while the test was being written. If you want the run-time
guarantee too, `Object.freeze` is a separate decision.

## One unavoidable cast

`keyOf` needs one. `Object.entries` is typed to return `[string, string][]` and throws away the
literal types, because its signature cannot express "the keys of the thing you passed me". The
value really is a `StatusKey` and only the standard library's typing cannot say so — the same
justified cast as `Object.keys` in course 3.

`isStatus` also has a cast, and it is a different and smaller thing: widening
`readonly Status[]` to `readonly string[]` so that `includes` accepts a `string` argument. It
makes no claim about `value`.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the two types</summary>

```ts
export type StatusKey = keyof typeof STATUS
export type Status = (typeof STATUS)[StatusKey]
```

`typeof` moves from the value world to the type world; `keyof` photographs the labels; the
indexed access reads the values off. Course 3, lessons 3 and 4.

</details>

<details>
<summary>Hint 2 — allStatuses and isStatus</summary>

`Object.values(STATUS)` is already `readonly Status[]`-compatible. For `isStatus`:

```ts
return (allStatuses() as readonly string[]).includes(value)
```

</details>

<details>
<summary>Hint 3 — keyOf</summary>

```ts
const found = Object.entries(STATUS).find(([, candidate]) => candidate === value)
return found?.[0] as StatusKey | undefined
```

</details>

<details>
<summary>Hint 4 — exhaustiveness, twice</summary>

For `describe`, a `switch` where every arm returns, then `return assertNever(status)` with a
local `function assertNever(value: never): never`.

For `DESCRIPTIONS` and `isCancellable`, a `Record<Status, …>` with no cast. Adding a status then
makes both a compile error until somebody decides what the new answer is — which is the point:
the decision should be made by a person, not defaulted.

</details>
