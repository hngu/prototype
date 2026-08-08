# Trust nothing at the door

A smoke alarm checks the air in your house. It cannot check the air in next
door's house, because it is not there.

TypeScript is the same. It reads every line *you* wrote and checks it carefully —
and then it is deleted, before your program has run a single instruction. Values
that arrive later, from a file or a network or a text box, were never in the
house. Nobody checked them.

This exercise is two kinds of function side by side, so you can feel the
difference: two the compiler can genuinely vouch for, and one where you have to
do the vouching yourself.

## Goal

Implement the three functions in `starter.ts`:

- **`toFahrenheit(celsius)`** returns the Fahrenheit value **rounded to one
  decimal place** — `0` → `32`, `36.6` → `97.9`.
- **`hottest(readings)`** returns the reading with the highest `celsius`, and
  `undefined` for an empty list. On a tie, either is fine — the tests do not
  create one.
- **`parseReading(raw)`** takes a value of type `unknown` and returns a `Reading`
  only if `raw` really is one. Otherwise `undefined`. It must reject:
  - anything that is not a plain object — including `null` and an array;
  - a missing or empty `label`, or a `label` that is not a string;
  - a `celsius` that is not a number, **or is `NaN` or `Infinity`** (both of those
    are numbers as far as the type system is concerned, and `JSON.parse` will
    hand you the second one from `1e999`);
  - and it must return a fresh object, so extra keys from the wire do not travel
    any further into your program.

One of the tests is called `an annotation is not a runtime check`. Read it. It
compiles cleanly, it passes, and it demonstrates a `Reading` whose `label` is the
number `42` — because an annotation is a promise you made to the compiler, not a
lock on the door.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — rounding</summary>

`Math.round` only does whole numbers. Scale up, round, scale back down.

</details>

<details>
<summary>Hint 2 — hottest, without fighting the compiler</summary>

`readings[0]` is not a `Reading` here. It is `Reading | undefined`, because
`noUncheckedIndexedAccess` is on and index `0` of an empty array does not exist.

Check the length first, then `reduce` with no initial value — that hands you the
first element as the seed and never has to answer the question.

</details>

<details>
<summary>Hint 3 — is it an object?</summary>

`typeof null === 'object'`, which is a bug from 1995 that JavaScript can never
fix. So the object check is always two conditions, not one.

Arrays are also `'object'`. You do not need `Array.isArray` to reject the array in
the tests, though — think about what `label` is on an array.

</details>

<details>
<summary>Hint 4 — the number that is not a number</summary>

`Number.isFinite` answers "is this a usable number?" in one call. `typeof x ===
'number'` answers a different, weaker question, and `NaN` passes it.

</details>
