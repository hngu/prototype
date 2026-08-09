# A cookie cutter with a checklist

A cookie cutter makes cookies the same shape every time. A class is the cutter: it
says what every one of its objects will have before a single one exists.

## Goal

Implement `Stack<T>` — a bounded stack that drops its oldest item rather than
overflowing. The fields and signatures are given; the bodies are yours.

- **`constructor(capacity, initial?)`** — reject a `capacity` that is not a positive
  integer with a `RangeError`, then assign both fields. `initial` is optional, oldest
  first, and trimmed to `capacity` keeping the **newest**.
- **`size` / `isEmpty`** — getters, derived rather than stored.
- **`push(item)`** — drops the oldest item first when already at capacity. Returns
  `this`, so pushes chain.
- **`pop()` / `peek()`** — newest item, with and without removing it. `undefined` when
  empty.
- **`snapshot()`** — a frozen copy. Pushing afterwards must not change it.
- **`static of(items)`** — builds a stack from any iterable, sized to fit it.

One invariant holds throughout, and the tests check it: **`size` is never greater than
`capacity`**, whatever you do to the stack.

## Fields are declared, then assigned in the constructor

You will notice the long form:

```ts
export class Stack<T> {
  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
  }
}
```

TypeScript has a short form for exactly this — `constructor(readonly capacity: number)`,
a **parameter property** — and it is banned in this package. It is not a type
annotation; it is an instruction to *generate* an assignment. Node strips types and
generates nothing, so the field would never be assigned and every read would be
`undefined`, with no error anywhere. `erasableSyntaxOnly` turns it into `TS1294` at
authoring time instead. The lesson on classes teaches the short form properly, because
you will meet it in real code; you just cannot run it here.

`#items` is a **real** JavaScript private field, not TypeScript's `private`. The next
lesson is about the difference.

## Why the parity check looks different here

Every other exercise in this repo asserts that `starter.ts` and `solution.ts` expose
the same API by making the two modules mutually assignable. That cannot work for a
class with a private field: `#items` in one file and `#items` in the other are genuinely
different fields, so TypeScript treats the two `Stack`s as **nominal** and unrelated,
even though they are identical character for character.

So `solution.test.ts` declares the API once, as `StackApi` and `StackCtor`, and checks
both files against it in a single annotation on `subject`. A dropped or retyped member
still fails to compile, which is what the check was for.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the constructor</summary>

`Number.isInteger(capacity) && capacity >= 1` is the whole check. Throw before you
assign anything: an object that cannot honour its own invariants should never exist.

For `initial`, copy it — `[...initial]` — rather than storing the caller's array. They
still hold a reference to it, and `readonly T[]` is erased at run time.
`.slice(-capacity)` keeps the last `capacity` items.

</details>

<details>
<summary>Hint 2 — push and capacity</summary>

`if (this.#items.length >= this.capacity) this.#items.shift()` before pushing. Then
`return this`.

</details>

<details>
<summary>Hint 3 — peek without fighting the compiler</summary>

`this.#items.at(-1)` is already typed `T | undefined`, so it satisfies the signature
directly. Indexing works too, and gives the same type only because
`noUncheckedIndexedAccess` is on — without it the compiler would promise you a `T` and
hand you `undefined`.

</details>

<details>
<summary>Hint 4 — static of()</summary>

Spread the iterable into an array, then `new Stack<U>(…, all)`. Two things to notice:
the type parameter is `U` rather than `T`, because a static member cannot see the
class's type parameter (there is no instance for it to have been chosen for yet); and
an empty iterable would ask for capacity `0`, which the constructor refuses.

</details>
