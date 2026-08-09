# Two X-rays

A hospital has two machines. One photographs the label on a jar; the other photographs
what is inside it. Between them you never have to write down the contents of the
cupboard by hand — and so the list can never go out of date.

`keyof` reads the key names off a type. `typeof` reads the type off a value. Put them
together and a union of allowed strings is *derived from real data* instead of being a
copy of it that somebody has to remember to update.

## Goal

The three types at the top of `starter.ts` are **given** — read them, do not change them.
Implement the four functions:

- **`labelFor(mode)`** returns the human label. One lookup, no `switch`.
- **`allModes()`** returns every mode in declaration order. This one needs a **cast**, and
  the exercise is being able to say out loud why it is safe.
- **`isMode(value)`** is a predicate accepting exactly the three keys. Check against the
  real object rather than a hand-written list.
- **`modeFromLabel(label)`** goes the other way, case-sensitively.

## Reading the given types

```ts
export const MODES = { dark: 'Dark', light: 'Light', auto: 'Follow system' } as const

export type Mode = keyof typeof MODES //  'dark' | 'light' | 'auto'
export type ModeLabel = (typeof MODES)[Mode] //  'Dark' | 'Light' | 'Follow system'
```

`keyof typeof MODES` reads right to left: take the value `MODES`, get its type, get that
type's keys. The `typeof` here is the **type** operator, not the runtime one that returns
`'object'` — it only exists in type positions, which is how you tell them apart.

The parentheses in `(typeof MODES)[Mode]` are required. `typeof MODES[Mode]` parses as
`typeof (MODES[Mode])` and means something else.

And `as const` is load-bearing. Without it, `ModeLabel` collapses to plain `string`. The
test asserts it has not, with `Equals<Equals<ModeLabel, string>, false>`.

**Add a fourth mode to `MODES` and every one of those follows**, along with every function
below. Nothing repeats anything the object already says. That is the whole return on this
pair of operators.

## The cast, and why it is allowed

`Object.keys` is declared as returning `string[]`, and it has to be — it works on any
object, and structural typing means a value typed `{ dark: … }` might really have more keys
at run time.

Here it cannot. `MODES` is a `const` object literal in the same file with `as const`
applied; nothing can have added to it. So `Object.keys(MODES) as Mode[]` is a claim you can
justify, which is the standard for writing a cast at all.

It is still a claim. Build `MODES` by spreading in another object later and this line quietly
becomes a lie. That is what a cast is: taking responsibility, which deserves a comment at
the site.

## `hasOwn`, not `in`

`isMode` must reject `'toString'`, `'constructor'` and `'__proto__'`. `value in MODES`
returns **true** for all three, because `in` walks the prototype chain — which is a
security-shaped bug rather than a curiosity when the input came from a query string.
`Object.hasOwn` is the ES2022 answer and means what you meant.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — labelFor</summary>

`MODES[mode]`. Because `mode` is the whole `Mode` union, the result is the whole
`ModeLabel` union, which is precisely the declared return type.

</details>

<details>
<summary>Hint 2 — allModes</summary>

`Object.keys(MODES)` and a cast. Write the comment justifying it before you write the
cast; if you cannot, the cast is wrong.

</details>

<details>
<summary>Hint 3 — isMode</summary>

Two conditions: is it a string, and is it an *own* key of `MODES`. Resist writing the three
names out — the point is that adding a fourth mode should need no edit here.

</details>

<details>
<summary>Hint 4 — modeFromLabel</summary>

`Object.entries(MODES)` and a loop. It has the same widening problem as `Object.keys`, so
the key needs the same justified cast on the way out.

</details>
