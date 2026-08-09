# A labelled tray, not a bag

A bag holds any number of apples. A cutlery tray holds exactly one knife, one fork
and one spoon, in that order, and you know without looking which slot is which.

An array type is the bag: `string[]` says "some strings, however many". A tuple is
the tray: `[string, number]` says "exactly two slots, and here is what goes in each".
The difference is not cosmetic — it changes what the compiler can promise you.

## Goal

Implement the four functions in `starter.ts`:

- **`zip(names, scores)`** pairs the lists up, stopping at the shorter one.
  `zip(['a','b','c'], [1,2])` → `[['a',1],['b',2]]`.
- **`partition(entries, threshold)`** returns
  `[passes, fails]` — score `>= threshold` passes — keeping the original order in each
  half. The tuple return is what lets a caller write
  `const [passes, fails] = partition(…)`.
- **`headline(parts)`** takes `readonly [string, ...string[]]` — one required slot then
  any number more. `['Results']` → `'Results'`;
  `['Results','term 1','2026']` → `'Results (term 1, 2026)'`.
- **`makeCounter(initial)`** returns a render function. Calling it gives
  `[value, increment]`, `useState`-style: `value` is the count **as it was at that
  moment**, and `increment` bumps the live one.

## The four things the tests pin down

**Length is known, so indexing is not widened.** `entry[0]` on a
`readonly [string, number]` is a `string` — no `| undefined`, even with
`noUncheckedIndexedAccess` on. And `entry[2]` is an error, because there is no such
slot. An array type can tell you neither. This is the sharpest practical difference
between the two.

**A rest element is how you spell "at least one".**
`readonly [string, ...string[]]` makes `headline([])` a compile error at the call
site, which is why the body can read `parts[0]` with no check at all. The empty case
is not handled; it is unrepresentable. A `readonly string[]` is also rejected — its
length is unknown, and unknown includes zero.

**Labels are for readers.** `readonly [value: number, increment: () => void]` puts
those names in tooltips and destructuring suggestions. They are erased, and
`tuple[0]` is still how you index. On a two-slot tuple of different types they are
most of the reason to prefer a tuple over an object.

**`readonly` is compile-time only.** The test writes to `entry[0]` under a
`@ts-expect-error` and then asserts the write *landed* — because `readonly` is gone
before the program runs. The compiler was the only thing stopping you.

## When a tuple is the wrong choice

At two elements of different types, a tuple reads beautifully. At three, nobody
remembers which slot is which, and `{ passes, fails, skipped }` is better than
`[a, b, c]` however carefully you label it. Destructuring by position is the feature;
it is also the limit.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — zip without fighting the flag</summary>

Iterate one list and index the other. `names.entries()` hands you `[index, name]`
with `name` typed `string`, because iteration cannot run off the end — only *indexed*
reads get widened.

Then `scores[index]` is `number | undefined`, and that is not an obstacle: it is your
stopping condition.

</details>

<details>
<summary>Hint 2 — partition</summary>

Two `filter` calls is fine and reads better than one loop pushing into two arrays.
`([, score]) => …` destructures the tuple and skips the first slot.

</details>

<details>
<summary>Hint 3 — headline</summary>

`const [first, ...rest] = parts`. `first` is a `string` with no check needed, and
`rest` is a plain `string[]` which may well be empty — that is the case to branch on.

</details>

<details>
<summary>Hint 4 — makeCounter</summary>

A `let` in the outer function, an `increment` that closes over it, and a returned
function that builds a fresh tuple each time it is called. Build `increment` once
outside rather than inside the returned function, so the same function comes back
every render.

</details>
