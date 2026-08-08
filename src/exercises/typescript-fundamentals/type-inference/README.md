# Pin a theme config

A plain object is like a whiteboard: you can rub out `dark` and write `light` any
time you like. TypeScript can see that, so when you write `{ mode: 'dark' }` it
labels the property `string` — the widest thing you might put there later.

Your job is to build the same object as something laminated instead. Fixed value,
fixed type, so a function that only accepts `'dark' | 'light'` will take it
without complaint.

## Goal

Implement the two functions in `starter.ts`:

- `makeConfig('dark')` returns `{ mode: 'dark', contrast: 'normal' }`, and the same
  for `'light'`.
- `isMode` returns `true` for exactly `'dark'` and `'light'` — and, because its
  return type is `value is Mode`, it must also *narrow* an `unknown` at the call
  site. The tests call `makeConfig` inside an `if (isMode(raw))` branch, so a body
  that returns the right booleans by accident still has to be honest about types.

The types themselves are already written, and you should not change them — they
are the contract the tests hold both files to. Read them, and read the comments in
`solution.ts` afterwards: they explain why `MODES` is a readonly tuple rather than
`string[]`, and why `as const` is how you get one without writing the type by hand.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — makeConfig</summary>

Nothing clever required. The parameter is already the right type, and `contrast`
has a default the signature does not mention — read the `Goal` again for which
value it should be.

</details>

<details>
<summary>Hint 2 — the predicate</summary>

`value is Mode` is a promise the compiler cannot check; it takes your word for it.
So the body has to actually be right.

Checking membership in `MODES` is the tidy way, but `MODES.includes(value)` will
not compile against an `unknown` — and it will not compile against a `string`
either, because `includes` on a `readonly ['dark', 'light']` only accepts those
two literals, which is the very thing you are trying to find out. Narrow `value`
to a `string` first, then compare it against a widened view of the tuple.

</details>
