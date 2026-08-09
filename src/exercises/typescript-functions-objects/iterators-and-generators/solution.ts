/**
 * Reference solution: A book with a bookmark
 * Lesson: typescript-functions-objects/iterators-and-generators
 */

/* The three type arguments of `Generator<T, TReturn, TNext>`, since nobody explains
   them:

   - `T` is what `yield` produces — the values a `for…of` sees.
   - `TReturn` is what the generator *returns* when it finishes, which is a different
     channel from what it yields and is almost always `void`.
   - `TNext` is what a caller may pass back in via `it.next(value)`, which is the
     coroutine feature almost nobody uses. `undefined` here means "do not".

   `IterableIterator<number>` is a shorter spelling that also works and says slightly
   less. Either is fine; being able to read the long one is worth ten minutes. */
export function* range(start: number, end: number, step = 1): Generator<number, void, undefined> {
  /* Without this guard, `step` of 0 or -1 never reaches `end` and the generator
     yields forever — and because generators are lazy, the hang happens at the
     consumer, in a `for…of` somewhere else entirely. A cheap guard beats a confusing
     bug report. */
  if (step <= 0) return

  for (let value = start; value < end; value += step) {
    yield value
  }
}

/* An infinite sequence, expressed in three lines and costing nothing until somebody
   asks for a value. This is the thing generators can do that returning an array
   cannot: `naturals()` returns immediately, having computed nothing at all.

   `for (;;)` rather than `while (true)` so there is no condition to misread. */
export function* naturals(): Generator<number, void, undefined> {
  for (let value = 0; ; value += 1) {
    yield value
  }
}

/* The order of the last three lines is the whole exercise.

   Yield, count, *then* check — so the moment we have enough, we return without
   asking `source` for another value. Check-first instead:

     for (const value of source) { if (taken >= count) return; yield value; taken += 1 }

   ...pulls one value too many, which is invisible for an array and matters a great
   deal when the source is a network page, an expensive computation, or infinite. The
   test counts productions to hold this down. */
export function* take(
  source: Iterable<number>,
  count: number,
): Generator<number, void, undefined> {
  if (count <= 0) return

  let taken = 0
  for (const value of source) {
    yield value
    taken += 1
    if (taken >= count) return
  }
}

export interface Playlist extends Iterable<string> {
  readonly tracks: readonly string[]
  add(track: string): void
}

/* `*[Symbol.iterator]()` is the whole implementation of the iterable protocol: a
   method under a well-known symbol key, returning something that produces values. The
   `*` makes it a generator method, so `yield*` delegates to the array's own iterator
   and there is no hand-written `next()` anywhere.

   Doing it by hand — `return { next: () => ({ value, done }) }` — is about fifteen
   lines and a place to put an off-by-one. The generator version is one.

   `get tracks()` returns the live array, typed `readonly string[]` so callers cannot
   push to it. Erased, of course; it is a promise, not a lock. */
export function makePlaylist(initial: readonly string[] = []): Playlist {
  const tracks: string[] = [...initial]

  return {
    get tracks() {
      return tracks
    },

    add(track) {
      tracks.push(track)
    },

    *[Symbol.iterator]() {
      yield* tracks
    },
  }
}

/* `Iterable<number>` is the most generous parameter type in JavaScript. An array, a
   `Set`, a `Map`'s `.values()`, a string's characters, a generator, and the playlist
   above all satisfy it — none of them by inheriting anything, only by having the
   method. Structural typing over a symbol-keyed method.

   Asking for `readonly number[]` instead would work and would force every caller with
   a `Set` to write `[...set]`, materialising a whole array for a function that only
   ever walks forward. */
export function total(source: Iterable<number>): number {
  let sum = 0

  for (const value of source) {
    sum += value
  }

  return sum
}
