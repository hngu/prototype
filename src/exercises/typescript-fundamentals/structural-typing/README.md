# Do the job, you're hired

A café puts a card in the window: *wanted, someone who can make coffee.* Nobody
turns up with a certificate saying "Barista" printed on it. They make a coffee, and
they are hired.

TypeScript hires the same way. A type is a job description, not a name badge — if a
value has the fields the description asks for, it qualifies, and it does not matter
what it was called or who declared it.

This exercise has three tiny interfaces and four functions, and one object that
does all three jobs at once without mentioning any of them.

## Goal

Implement the four functions in `starter.ts`:

- **`greet(entity)`** takes `Named` — one field — and returns `'Hello, ada'`.
- **`listNames(entities)`** turns names into English:
  - `[]` → `'nobody'`
  - `[ada]` → `'ada'`
  - `[ada, grace]` → `'ada and grace'`
  - `[ada, grace, hopper]` → `'ada, grace and hopper'`
- **`auditLine(entity)`** takes `Identified & Named & Timestamped` — an
  *intersection*, so all three at once — and returns `'w1 "widget" @ 1970-01-01'`.
  `createdAt` is epoch milliseconds and you want the date only.
- **`isAuditable(value)`** is the same question asked at run time: a predicate that
  returns true when `value` really has a string `id`, a string `name` and a finite
  numeric `createdAt`.

Look at what the tests hand to `greet`. A `User`, an `Org`, a widget, and a bare
literal — four types with nothing in common, none of which import `Named`. That is
what a one-field parameter buys you, and it is free.

Two tests are really compile-time proofs:

- **`excess property checking only bites a fresh literal`** contains a
  `@ts-expect-error`. The same object is accepted through a variable and rejected
  written inline, because an unexpected key in a fresh literal is almost always a
  typo. `@ts-expect-error` fails the build if the line *stops* erroring, so the
  test cannot rot.
- **`unrelated shapes are interchangeable when the members match`** assigns a
  `Person` to a `Product` and back. Names carry no weight at all.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the last name in the list</summary>

`names[names.length - 1]` is typed `string | undefined`, because
`noUncheckedIndexedAccess` refuses to pretend an index exists just because you
wrote it. You can silence that with `!`, or you can avoid the question: `slice(-1)`
returns an array whether or not there is anything in it.

</details>

<details>
<summary>Hint 2 — three lengths, two shapes of answer</summary>

Handle the empty list on its own, then split the names into "all but the last" and
"the last". Join the first group with `', '` and glue `' and '` in front of the
second — and check what that produces when the first group is empty.

</details>

<details>
<summary>Hint 3 — the date</summary>

`new Date(0)` is the epoch, and `toISOString()` gives the full timestamp. You want
the first ten characters.

</details>

<details>
<summary>Hint 4 — checking three fields at once</summary>

Destructure through `Partial<…>` and you get each field typed as "the right type,
or `undefined`", which is exactly what an unchecked object deserves. Then
`typeof` twice and `Number.isFinite` once.

</details>
