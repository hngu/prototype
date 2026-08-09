/**
 * Exercise: A book with a bookmark
 * Lesson:   typescript-functions-objects/iterators-and-generators
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Note the `function*`. The star is what makes these generators: they hand back one
 * value at a time and remember where they stopped, so `naturals()` can promise an
 * infinite sequence without hanging anything.
 *
 * `Generator<number, void, undefined>` reads left to right as: yields numbers,
 * returns nothing when it finishes, expects nothing passed back in.
 */

/**
 * Counts from `start` up to but not including `end`.
 *
 *   [...range(0, 3)]      →  [0, 1, 2]
 *   [...range(2, 10, 3)]  →  [2, 5, 8]
 *
 * `step` must be positive; anything else yields nothing rather than looping forever.
 */
export function* range(start: number, end: number, step = 1): Generator<number, void, undefined> {
  throw new Error('TODO: yield each value in turn')
}

/** 0, 1, 2, 3, … with no end. Only safe to consume through something lazy. */
export function* naturals(): Generator<number, void, undefined> {
  throw new Error('TODO: count up forever')
}

/**
 * The first `count` values of `source`, and **no more work than that** — one test
 * feeds it `naturals()` and counts how many values were actually produced.
 */
export function* take(
  source: Iterable<number>,
  count: number,
): Generator<number, void, undefined> {
  throw new Error('TODO: stop pulling as soon as you have enough')
}

/**
 * A collection that can be used with `for…of`, because it implements the iterable
 * protocol: one method, named by the well-known symbol `Symbol.iterator`, returning
 * something that produces values.
 */
export interface Playlist extends Iterable<string> {
  readonly tracks: readonly string[]
  add(track: string): void
}

/** Builds a playlist. Iterating it yields its tracks in order. */
export function makePlaylist(initial: readonly string[] = []): Playlist {
  throw new Error('TODO: implement [Symbol.iterator] so for…of works')
}

/**
 * Adds up anything iterable. Note the parameter is `Iterable<number>`, not an array —
 * so a `range`, a `take`, a `Set` and a plain array are all acceptable, and none of
 * them needed to know about this function.
 */
export function total(source: Iterable<number>): number {
  throw new Error('TODO: sum the values')
}
