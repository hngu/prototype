# Must fit through this door

A fairground ride has a sign: *you must be taller than this line*. It does not turn
everybody into someone exactly that tall. You get on the ride as yourself.

`T extends Something` is that sign. It says what must be true to come through, and the
value arrives on the other side **still being its own type** rather than flattened into
the requirement. That distinction is the whole exercise, and it is the thing people miss
about constraints.

## Goal

Implement the four functions in `starter.ts`:

- **`pluck(items, key)`** returns one field from every item. `pluck(users, 'name')` gives
  `readonly string[]`; `pluck(users, 'age')` gives `readonly number[]`. One line.
- **`byId(items)`** indexes by `id`, later duplicates winning. The constraint asks only
  for an `id`; the map holds the whole item.
- **`longest(a, b)`** returns whichever is longer, ties going to `a`.
- **`makeBucket(label, items?)`** returns a `Bucket<T>`. With no items there is nothing to
  infer from, so the **generic parameter default** decides.

## A floor, not a ceiling

This is the part worth slowing down for. Compare:

```ts
function byId(items: readonly { id: string }[]): Map<string, { id: string }>
function byId<T extends { readonly id: string }>(items: readonly T[]): Map<string, T>
```

Both accept the same arguments. The first one **throws away every other field** — put
users in, get `{ id: string }` back. The second hands your users back as users.

A parameter type is a floor that also becomes the ceiling. A constraint is a floor that
lets the real type through. The test named `a constraint is a floor, not a ceiling` reads
`.name` off the result, which only compiles under the second signature.

## Why `K extends keyof T` and not `key: keyof T`

`K extends keyof T` keeps `K` pinned to the *specific* key that was passed, so `T[K]` is
the type of that one field. Written `key: keyof T`, the best return type available is
`T[keyof T][]` — `(string | number)[]` for a user — and every caller would spend a line
narrowing a union that was never actually uncertain.

It also rejects typos: `pluck(users, 'nmae')` is a compile error rather than an array of
`undefined`.

## Constraints and defaults are unrelated

- `T extends string` restricts **what may be passed**.
- `T = string` decides **what happens when nobody says**.

They solve different problems and combine freely — `<T extends Named = User>` is legal.
The last test includes a `@ts-expect-error` showing that a default does *not* constrain:
`makeBucket<number>('counts', ['a'])` is still refused, by the explicit argument rather
than by the default.

## One trap in the tests

Type assertions have to come **before** any `assert.deepEqual` on the same value.
`deepEqual` from `node:assert/strict` is declared `asserts actual is T`, so it narrows its
first argument to the shape of the expected value — after which `typeof value` is no
longer the type the function returned, and your assertion is checking the wrong thing.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — pluck</summary>

`items.map(…)`, reading `item[key]`. The types already line up; there is nothing to
assert and nothing to narrow.

</details>

<details>
<summary>Hint 2 — byId</summary>

`new Map<string, T>()` and a `for…of`. Setting the same key twice means the later item
wins for free, which is the behaviour the tests want.

</details>

<details>
<summary>Hint 3 — longest</summary>

One comparison. Note the constraint is structural, so this works on strings, arrays and
anything else that happens to have a `length` — none of which had to opt in.

</details>

<details>
<summary>Hint 4 — makeBucket</summary>

`items` is optional, so it is `readonly T[] | undefined` in the body. `?? []` rather than
`|| []`, out of habit if nothing else.

</details>
