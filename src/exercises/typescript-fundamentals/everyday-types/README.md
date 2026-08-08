# Say it in nine words

A small child gets a long way on about fifty words. Not because fifty is a lot,
but because they are the right fifty — *more*, *mine*, *gone* — and everything
else can be pointed at.

TypeScript's everyday vocabulary is about that size. `string`, `number`,
`boolean`, arrays, "one of these", "this one might be missing". Almost every type
you write for the rest of your life is those pieces stacked up.

This exercise is a shopping order, described entirely in that vocabulary — and one
function whose parameter is `string | number`, because the quantity arrived from a
form and forms only ever hand you text.

## Goal

Implement the four functions in `starter.ts`:

- **`symbolFor(currency)`** — `'usd'` → `'$'`, `'eur'` → `'€'`, `'gbp'` → `'£'`.
  `Currency` is a union of three literal strings, so a `switch` over it needs no
  `default` and no trailing `return`; the compiler already knows you covered
  everything.
- **`normaliseQuantity(input)`** takes a `string | number` and returns a whole
  number of **1 or more**, or `undefined`. Accept `12` and `'  12  '`. Reject `0`,
  `-3`, `1.5`, `NaN`, `Infinity`, `''`, `'0'`, `'two'`, `'1.5'` and `'1e3'`.
- **`describeOrder(order)`** builds one line:
  - `'a1: 3 items in £'`
  - `'a2: 1 item in $ (express) — gift wrap'`

  So: `` `<id>: <quantity> item(s) in <symbol>` ``, then `' (express)'` when
  `express` is true, then `' — <note>'` when there is a note. An **empty** note
  counts as no note. The dash is an em dash (`—`), with a space either side.
- **`totalQuantity(orders)`** adds up the quantities. `0` for an empty list.

Two of the tests exist only to check the *types*, not the behaviour:
`totalQuantity accepts a genuinely readonly list` fails to compile if the
parameter loses its `readonly`, and `normaliseQuantity feeds an Order without a
cast` fails to compile if the return type stops admitting `undefined`.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the two-shaped parameter</summary>

You cannot call `input.trim()` while `input` might be a number; the compiler will
say so. Ask `typeof input === 'number'` first and handle each shape in its own
branch. Inside a branch, `input` is only the type that branch is about — you get
that for free.

</details>

<details>
<summary>Hint 2 — rejecting the numbers that are not numbers</summary>

`Number.isInteger` rejects `1.5`, `NaN` **and** `Infinity` in a single call. All
three are `number` to the type system, which is correct and unhelpful.

</details>

<details>
<summary>Hint 3 — parsing the string</summary>

`Number('')` is `0` and `Number('1e3')` is `1000`, so `Number` alone will not do
the deciding for you. Check the shape of the string first — a regex for "one or
more digits, and nothing else" is two characters longer than the alternatives and
much easier to read.

</details>

<details>
<summary>Hint 4 — the optional note</summary>

`note?: string` means the property's type is `string | undefined`. Build the
optional fragments as their own strings — `''` when they do not apply — and
concatenate all of them unconditionally at the end. It reads better than nesting
`if`s, and there is nowhere for a stray space to hide.

</details>
