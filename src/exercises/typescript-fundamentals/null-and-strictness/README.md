# An empty box and no box

Somebody asks you to bring the biscuit tin. You come back and say "it's empty".
That is a different sentence from "there is no tin", and anyone would agree they
call for different next steps.

JavaScript has two words for the second sentence — `null` and `undefined` — and for
its first twenty years TypeScript's ancestors let you confuse all three. Turning on
`strictNullChecks` is what separates them, and turning on
`noUncheckedIndexedAccess` separates one more case the language had been quietly
lying about.

This exercise is five small functions where the difference decides the answer.

## Goal

Implement the five functions in `starter.ts`. **No `!`** — the non-null assertion
is not the answer to any of these.

- **`firstWord(text?)`** returns the first whitespace-separated word.
  `'  hello   world  '` → `'hello'`. And `undefined` for no argument at all, for
  `''`, and for `'   '`.
- **`displayName(profile)`** returns the nickname when there is a real one,
  otherwise the name. `nickname ?? name` is **not** enough: a nickname of `''` or
  `'   '` is present, would win, and would render a profile with no name on it.
  `'  Addy  '` should come back trimmed.
- **`bioOrDefault(profile, fallback)`** returns the bio, falling back **only for
  `null`**. `bio: ''` is a bio the user saved, and must come back as `''`.
- **`pageSize(configured?)`** defaults to `20` — but `pageSize(0)` is `0`.
- **`pick(items, index)`** returns the item at `index`, or `undefined`. This one is
  one line. Read the comment in `solution.ts` afterwards for why that is the
  interesting part rather than the boring part.

Notice the difference between the two markers on `Profile`. `nickname?: string`
means the property may be **absent**. `bio: string | null` means the property is
always **there** and may hold nothing. Both are useful, they are not
interchangeable, and the second one is a design decision worth making on purpose.

Two tests use `@ts-expect-error` to pin down flags rather than behaviour:
`indexing is honest about being able to miss` proves `items[0]` is
`string | undefined`, and `a possibly-missing result has to be dealt with` proves
`pick`'s return type still admits `undefined`. Both fail the build if the error
*stops* happening, so neither can rot.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the optional parameter</summary>

Inside the function, `text` is typed `string | undefined`, so `text.trim()` will
not compile. You can narrow it with an early return, or turn "no text" into "blank
text" with `??` and handle one case instead of two — both are fine, and the second
works here only because both answers are `undefined`.

</details>

<details>
<summary>Hint 2 — splitting</summary>

`''.split(/\s+/)` is `['']`, not `[]`. So the first element existing is not the
same as it having anything in it, and with `noUncheckedIndexedAccess` on you have
to consider both.

</details>

<details>
<summary>Hint 3 — three operators, three meanings</summary>

- `a || b` falls back for every **falsy** `a`, which includes `0` and `''`.
- `a ?? b` falls back for `null` and `undefined` only.
- `a?.b` reads `b` only when `a` is neither.

Two of these functions want `??`, one wants `?.` plus a real content check, and
none of them want `||`.

</details>

<details>
<summary>Hint 4 — pick</summary>

Try `return items[index]` and see what the compiler says. If it says nothing, that
is the answer, and the comment in `solution.ts` explains why the honest signature
and the naive body agree here.

</details>
