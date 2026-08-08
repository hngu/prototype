# Look before you reach in

There is a box on the table. It is either a kitten or a hammer, and you were not
told which. Sensibly, you look first.

That is narrowing. A union type says "one of these", and the compiler refuses to
let you use anything that is not true of *every* member — until you write the same
check you would have written anyway, at which point it agrees with you and lets
you get on with it.

Three functions here, one for each shape the check comes in: a union of unrelated
types, two object shapes with nothing to tell them apart, and a union built
properly on purpose.

## Goal

Implement the three functions in `starter.ts`. **No casts and no `any`** — every
branch has to earn its type from a check the compiler understands. If you reach
for `as string`, the check above it is the wrong shape.

- **`describe(value)`** takes `string | number | Date`:
  - `'hello'` → `'text "hello" (5 characters)'`
  - `3.5` → `'number 3.50'` (always two decimal places)
  - `new Date('2026-08-08T12:34:56Z')` → `'date 2026-08-08'` (the date only)
- **`areaOf(shape)`** takes `Circle | Square`. Neither carries a tag, so there is
  nothing to `switch` on — you have to work out which one you are holding from what
  it has. `Math.PI * r ** 2` and `side ** 2`.
- **`render(result)`** takes the `Result` union:
  - `{ kind: 'ok', data: '42 rows' }` → `'ok: 42 rows'`
  - `{ kind: 'empty' }` → `'nothing to show'`
  - `{ kind: 'error', message: 'not found', code: 404 }` → `'error 404: not found'`

  Write the `switch` **without a `default`**. It will compile, and the reason it
  compiles is the interesting part: the compiler can see three cases exhaust the
  type. Which means the day someone adds a fourth member to `Result`, this function
  is a build error instead of a silent `undefined`. A `default` would have thrown
  that away.

Two of the tests are compile-time tests wearing a runtime disguise:
`narrowing reaches the fields that only exist on one member` only builds if
narrowing works with no cast, and `describe accepts each union member on its own`
only builds if the parameter really is the full three-way union.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the Date</summary>

`typeof new Date()` is `'object'`, which tells you nothing you did not already
know. Dates are made with `new`, and there is a narrowing operator specifically
for things made with `new`.

</details>

<details>
<summary>Hint 2 — you need fewer branches than you think</summary>

If the first two branches `return`, then any line after them is only reachable
when both checks were false. The compiler knows that, and has already removed
`string` and `number` from the union by the time you get there. No `else`
required, and no third `if`.

</details>

<details>
<summary>Hint 3 — the untagged shapes</summary>

There is a JavaScript operator that asks whether an object has a given property,
and TypeScript treats it as a narrowing check. You have almost certainly used it
in a `for` loop and never thought of it this way.

</details>

<details>
<summary>Hint 4 — the date format</summary>

`toISOString()` gives you `'2026-08-08T12:34:56.000Z'`. The first ten characters
are the part you want, and `slice` is happy to say so.

</details>
