# One door, several labelled ways through

A cinema box office has one window with three signs above it: *adults*,
*children*, *members*. Same window, same person behind it, but which sign you stand
under decides what you get handed.

Overloads are those signs. One function, several public signatures, and the one you
match decides the return type. They are genuinely useful and they are also
overused, so this exercise makes you write the same behaviour twice — once
overloaded, once as a plain union — and then shows you exactly where the two differ.

Spoiler: the difference is not at run time. It is in two `@ts-expect-error`
comments.

## Goal

Implement the four functions in `starter.ts`:

- **`parseDate`** is **overloaded**. A `number` is epoch milliseconds and always
  yields a `Date`; a `string` is ISO and might be nonsense, so it yields
  `Date | undefined`. `'nope'`, `''` and `'2026-13-40'` are all `undefined`.
- **`parseDateUnion`** does exactly the same thing with one signature over a union.
  Behaviour identical; type less precise.
- **`makeParser(label)`** returns a `DateParser` — an interface with a **call
  signature** *and* a `label` property. A function type expression cannot describe
  that; this is what interfaces are for.
- **`buildAll(ctor, values)`** takes a **construct signature**,
  `new (value: number) => Date`, and builds one `Date` per value. The built-in
  `Date` constructor satisfies it, so the test passes it in directly.

## The two things the tests pin down

**What overloading buys.** `const d: Date = parseDate(0)` compiles, because the
overload knows a number cannot fail. The same line against `parseDateUnion` is a
type error — it returns `Date | undefined` whatever you pass, so every caller
handles an `undefined` that will never arrive.

**What overloading costs.** The implementation signature is *not public*. So given
`const raw: string | number`, `parseDate(raw)` does not compile at all — "No
overload matches this call" — even though the implementation plainly handles both.
`parseDateUnion(raw)` is fine. And `string | number` is the exact shape of anything
read from config, JSON or a form.

The rule that falls out: **overload when the return type depends on the argument
type.** Otherwise take the union — it is less code and more usable.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — an invalid Date is still a Date</summary>

`new Date('nope')` does not throw. It gives you a `Date` object whose `getTime()` is
`NaN`, which is the only way to tell. `Number.isNaN(parsed.getTime())` is the check.

</details>

<details>
<summary>Hint 2 — implementing an overloaded function</summary>

Write the body against the third signature — the implementation one — and narrow
`input` inside it exactly as you would any other union. The overloads above it are
for callers; the body never sees them.

</details>

<details>
<summary>Hint 3 — callable *and* labelled</summary>

`Object.assign` staples properties onto a function and returns it with a type that
has both. The alternative — declare the function, then assign `.label` — needs a
cast, because the function does not have a `label` at the moment it is created.

</details>

<details>
<summary>Hint 4 — using a construct signature</summary>

The parameter is a class, not an instance, so you use it with `new`. Lowercase
parameter name, uppercase-style usage: `new ctor(value)`.

</details>
