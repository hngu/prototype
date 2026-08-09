---
title: A book with a bookmark
course: typescript-functions-objects
order: 7
summary: A generator hands back one value at a time and remembers where it stopped, which is how a sequence can be infinite and still cost nothing. The protocol behind it is one method, and anything can implement it.
duration: 11
exercise: true
draft: false
---

Hand somebody a book and they read a page, slide the bookmark in, and close it. Tomorrow they carry
on from the bookmark. Nobody photocopied the whole book to read three pages of it.

That is the idea behind everything in this lesson, and it explains why an infinite sequence can be a
perfectly sensible thing to return.

## One method, and the whole ecosystem

`for…of` does not know about arrays. It knows about a **protocol**: it asks the value for a method
under the key `Symbol.iterator`, and uses whatever that returns.

Implement it and everything else follows at once:

```ts
interface Playlist extends Iterable<string> {
  readonly tracks: readonly string[]
}

const playlist: Playlist = {
  tracks: ['intro', 'verse'],
  *[Symbol.iterator]() {
    yield* this.tracks
  },
}

for (const track of playlist) {
} // works
;[...playlist] // works
Array.from(playlist) // works
new Set(playlist) // works
const [first] = playlist // works
```

None of those were taught about `Playlist`. They all work because one method exists — structural
typing over a symbol key, which is the same rule as lesson 1.6 applied to something that does not look
like a shape.

Two type names are one letter apart and confusing them is the standard mistake:

| Type | Has | Examples |
| --- | --- | --- |
| `Iterable<T>` | `[Symbol.iterator]()` | array, `Set`, `Map`, string, generator |
| `Iterator<T>` | `next()` | a generator; **not** an array |

`for…of` and spread need `Iterable`. `Iterator` is the lower-level thing an `Iterable` hands you, and a
generator happens to be both — which is why you can `for…of` a generator *and* call `.next()` on it.

```quiz
id: typescript-functions-objects-iterators-and-generators-q1
q: A function takes `Iterable<number>`. Which arguments are accepted?
- [x] `[1, 2, 3]`
- [x] `new Set([1, 2])`
- [x] A generator that yields numbers
- [ ] `{ next: () => ({ value: 1, done: false }) }`
explain: The first three all have a `[Symbol.iterator]` method, which is the entire requirement. The last one is an `Iterator` — it has `next` and no `[Symbol.iterator]`, so `for…of` cannot start it. Iterable and Iterator are related, not interchangeable.
```

## The bookmark

A generator function is written with a `*` and paused by `yield`:

```ts
function* range(start: number, end: number, step = 1): Generator<number, void, undefined> {
  for (let value = start; value < end; value += step) {
    yield value
  }
}
```

Calling it runs **no code at all**. It hands back a generator object; the body starts on the first
`next()`, runs to the first `yield`, and freezes there — locals, loop counter, position in the file, all
preserved. Ask again and it thaws.

That laziness is the whole point, and it is what makes this reasonable:

```ts
function* naturals(): Generator<number, void, undefined> {
  for (let value = 0; ; value += 1) yield value
}

;[...take(naturals(), 5)] // [0, 1, 2, 3, 4]
```

`naturals()` returns instantly having computed nothing. Nothing hangs, because nothing asks for a sixth
value. Try that with a function that returns an array.

`yield*` delegates to another iterable, which is how the `Playlist` above forwarded to its array in one
line rather than hand-writing a `next()`.

About that return type. `Generator<T, TReturn, TNext>` has three slots that nobody explains: `T` is what
`yield` produces, `TReturn` is what the generator *returns* when it finishes — a separate channel that
`for…of` throws away — and `TNext` is what a caller may pass back in via `next(value)`, the coroutine
feature you will almost certainly never use. `Generator<number, void, undefined>` is the honest spelling
of "yields numbers, that's it". `IterableIterator<number>` is shorter and says slightly less.

```quiz
id: typescript-functions-objects-iterators-and-generators-q2
q: What happens when you call a generator function?
- [x] Nothing in the body runs; you get a generator object back
- [ ] The body runs until the first `yield` and pauses
- [ ] The body runs to completion and buffers every yielded value
- [ ] The body runs on a separate task and yields resolve as promises
explain: Calling it only constructs the generator. The body does not start until the first `next()` — which `for…of` and spread call for you. That is why returning an infinite sequence is harmless: nobody has asked for anything yet.
```

## Laziness you have to be deliberate about

Because generators are lazy, *where* you check a condition becomes a behavioural decision rather than a
style one. Two versions of `take`:

```ts
// Pulls one value too many
for (const value of source) {
  if (taken >= count) return
  yield value
  taken += 1
}

// Pulls exactly enough
for (const value of source) {
  yield value
  taken += 1
  if (taken >= count) return
}
```

On an array the difference is invisible. When each value is a database page, an HTTP request or one step
of an expensive computation, the first version does one unit of work nobody wanted — and on an infinite
source it is the difference between finishing and not.

Two more things worth knowing before you go looking for them. Breaking out of a `for…of` early calls the
generator's `return()`, so a `try/finally` in the body still runs its cleanup — generators are safe
places to hold a file handle. And `async function*` plus `for await…of` is the same protocol for values
that arrive over time, which is how you page an API without materialising every page.

```quiz
id: typescript-functions-objects-iterators-and-generators-q3
type: true-false
q: In a lazy pipeline, checking "have I got enough?" before yielding rather than after makes no difference to how much work the source does.
answer: false
explain: Checking first means you have already pulled the value you then decide not to use — one extra unit of work every time. Invisible on an array, and the difference between terminating and hanging on an infinite source.
```

## What to take away

- `for…of` and spread require one method, `[Symbol.iterator]`; implementing it opts you into the whole
  ecosystem at once.
- `Iterable` has `[Symbol.iterator]`, `Iterator` has `next`, and a generator is both.
- Calling a generator function runs nothing — which is what makes an infinite sequence cheap and
  correct.
- Laziness makes the placement of a condition a behavioural choice: yield first, then check.
