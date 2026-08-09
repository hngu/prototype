# A sign and a lock

A door marked *staff only* keeps out everyone who is reading the signs. A door with a
lock on it keeps out everyone.

TypeScript has both, and they look almost the same in the code.

## Goal

Implement `Counter` — a tally that only ever goes up, by whole numbers. Two of its
fields are hidden two different ways, and the tests demonstrate the difference rather
than taking anyone's word for it.

- **`constructor(label)`** — assign both fields and record the construction in
  `Counter.#created`.
- **`value` / `name`** — getters. `name` is readable by anyone and writable by nobody,
  including this class.
- **`increment(by = 1)`** — `RangeError` unless `by` is a positive integer. Returns
  `this`, so increments chain.
- **`reset()`** — back to zero, returns `this`.
- **`static get created()`** — how many counters have ever been built.
- **`static from(value, label?)`** — a counter that already stands at `value`. Note
  there is no constructor argument for the starting count, and there does not need to
  be. Working out why is half the exercise.
- **`static isCounter(value)`** — true only for something this class actually built. Not
  a shape check, and not `instanceof`.

## The two kinds of hiding

```ts
#count: number                    // a lock
private readonly label: string    // a sign
```

`#count` is JavaScript's own privacy and it is absolute. Outside the class body `#count`
is not a name that parses, so there is no cast, no `as any`, no bracket access and no
`Object.keys` that reaches it. It is not in `JSON.stringify` output either.

`private` is a note to the compiler. It is **erased**, so at run time `label` is an
ordinary enumerable property — visible to `Object.keys`, to `JSON.stringify`, to any
JavaScript caller who never saw a type, and to one `as unknown as { label: string }`
cast from TypeScript.

That does not make `private` useless. It documents intent and stops honest mistakes
across a large codebase, which is most of what member visibility is for. It is just not
a boundary you would put a secret behind.

## Two things worth working out

**`static from` has no starting-count parameter to work with.** It does not need one.
Privacy in JavaScript is per **class**, not per object: code inside the class body may
name `#count` on *any* instance, including one it was just handed. So a static factory
can do things no caller can.

**`isCounter` is a brand check.** `#count in value` asks "does this object carry *my*
private field?", which is true precisely for objects this class constructed. A shape
check would say yes to `{ value: 3 }`. `instanceof` is usually right but is defeated by
two copies of a module — common enough with bundlers and duplicated dependencies — and by
anyone reassigning `Symbol.hasInstance`. A private field is forgeable by nothing.

One trap: `#count in value` throws a `TypeError` when `value` is a primitive or `null`,
so the narrowing has to happen *before* the brand check.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the constructor and the tally</summary>

`Counter.#created++`, not `this.#created++`. Static members live on the class object, so
an instance cannot reach them — and naming the class is also what makes the line read
correctly, because the tally belongs to `Counter` rather than to this counter.

</details>

<details>
<summary>Hint 2 — readable but not writable</summary>

`private readonly` plus a public getter. `readonly` alone would still let anyone read
`counter.label` directly; `private` alone would let this class reassign it.

</details>

<details>
<summary>Hint 3 — from()</summary>

Build one with `new Counter(label)`, then assign `counter.#count = value`. That line is
legal here and impossible one character past the closing brace of the class.

Validate before you build, so a rejected call leaves nothing behind — including no
increment to `#created`.

</details>

<details>
<summary>Hint 4 — isCounter</summary>

```ts
return typeof value === 'object' && value !== null && #count in value
```

Three parts, and the order matters: the first two exist so the third cannot throw.

</details>
