# A book with a bookmark

Hand somebody a book and they read a page, put the bookmark in, and close it. Come
back tomorrow and they carry on from the bookmark. Nobody had to photocopy the whole
book to read three pages of it.

A generator is that book. It hands you one value, remembers exactly where it stopped,
and does no work at all until you ask again. Which is why one of the functions in
this exercise can promise an infinite sequence of numbers and return instantly.

## Goal

Implement the five functions in `starter.ts`. Note the `function*` — the star is what
makes a generator.

- **`range(start, end, step = 1)`** counts up to but *not including* `end`.
  `[...range(0,3)]` → `[0,1,2]`; `[...range(2,10,3)]` → `[2,5,8]`. A `step` of `0` or
  less yields nothing rather than looping forever.
- **`naturals()`** yields `0, 1, 2, …` with no end.
- **`take(source, count)`** yields the first `count` values — and does **no more work
  than that**. One test feeds it an instrumented infinite generator and counts how
  many values were actually produced. The answer must be 3, not 4.
- **`makePlaylist(initial?)`** returns a `Playlist` that works with `for…of`, by
  implementing `[Symbol.iterator]`.
- **`total(source)`** adds up an `Iterable<number>` — an array, a `Set`, a `Map`'s
  `.values()`, a `range`, a playlist of numbers.

## The type in the signature

`Generator<number, void, undefined>` reads left to right:

| Slot | Means | Usually |
| --- | --- | --- |
| `number` | what `yield` produces | the interesting one |
| `void` | what the generator *returns* when it finishes | `void` |
| `undefined` | what a caller may pass into `it.next(x)` | `undefined` |

Yielding and returning are two different channels — `for…of` sees the yields and
throws the return away. `IterableIterator<number>` is a shorter spelling that works
too and says slightly less.

## Why the order of three lines matters

In `take`, yield first, count, *then* check whether you are done:

```ts
for (const value of source) {
  yield value
  taken += 1
  if (taken >= count) return
}
```

Check first instead and you pull one value too many. On an array that is invisible.
When each value is a network page, an expensive computation, or one step of an
infinite sequence, it is the difference between correct and nearly correct. The test
named `take pulls exactly as many values as it needs and no more` holds it down.

## Iterable is not Iterator

Two types, one letter apart, and confusing them is the standard mistake:

- **`Iterable<T>`** has a `[Symbol.iterator]()` method. Arrays, `Set`s, strings and
  generators are all iterable — that is what `for…of` and `...spread` require.
- **`Iterator<T>`** has a `next()` method. A generator *is* one; an array is not.

The last test pins that down with a `@ts-expect-error`. And `total`'s parameter is
`Iterable<number>` rather than an array, which is why a caller with a `Set` does not
have to spread it into a whole new array first.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — an infinite loop on purpose</summary>

`for (let value = 0; ; value += 1)` — an empty condition is legal and means "always".
`while (true)` is the same thing with something to misread.

</details>

<details>
<summary>Hint 2 — the playlist's one method</summary>

```ts
*[Symbol.iterator]() {
  yield* tracks
}
```

A computed method name, a `*` to make it a generator, and `yield*` to delegate to the
array's own iterator. Writing it by hand — returning `{ next: () => ({ value, done }) }`
— is fifteen lines and somewhere to hide an off-by-one.

</details>

<details>
<summary>Hint 3 — keeping the tracks readable but not writable</summary>

`get tracks() { return tracks }` returns the live array, and the declared type
`readonly string[]` stops a caller pushing to it. Erased, so it is a promise rather
than a lock — but it is the promise you want here.

</details>

<details>
<summary>Hint 4 — total</summary>

`for…of` over the parameter. That is all `Iterable` gives you, and it is all you need.

</details>
