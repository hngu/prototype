/**
 * Reference solution: A labelled tray, not a bag
 * Lesson: typescript-functions-objects/tuples-and-readonly
 */

export type Entry = readonly [name: string, score: number]

/* Two details worth stealing.

   `names.entries()` rather than a `for` loop with an index: iterating hands you the
   element itself, so `name` is a `string` and not `string | undefined`.
   `noUncheckedIndexedAccess` only widens *indexed* reads, because iteration cannot
   run off the end.

   `scores[index]` is an indexed read, so it *is* `number | undefined` — and here that
   is not a nuisance to work around, it is precisely the stopping condition. The lists
   may be different lengths, and the first missing score is where we stop. A version
   that computed `Math.min(names.length, scores.length)` first would need the same
   check anyway and the compiler would be right to insist on it. */
export function zip(names: readonly string[], scores: readonly number[]): readonly Entry[] {
  const pairs: Entry[] = []

  for (const [index, name] of names.entries()) {
    const score = scores[index]
    if (score === undefined) break
    pairs.push([name, score])
  }

  return pairs
}

/* The return type is a two-slot tuple, which is what lets a caller destructure it by
   position: `const [passes, fails] = partition(…)`. An object `{ passes, fails }`
   would be a perfectly good alternative and is often the better one — a tuple is
   right when the two halves are obviously ordered and obviously a pair, and starts
   being wrong at about three elements, when nobody remembers which slot is which. */
export function partition(
  entries: readonly Entry[],
  threshold: number,
): readonly [passes: readonly Entry[], fails: readonly Entry[]] {
  const passes = entries.filter(([, score]) => score >= threshold)
  const fails = entries.filter(([, score]) => score < threshold)

  return [passes, fails]
}

/* `readonly [string, ...string[]]` is how you spell "at least one" in the type system,
   and it earns its keep on the very first line: `parts[0]` is a `string`, full stop.
   No `??`, no `!`, no early return for the empty case — because the empty case cannot
   be passed in. The compiler rejects `headline([])` at the call site instead.

   Compare `readonly string[]`, where `parts[0]` is `string | undefined` and every
   caller has to be trusted to have checked. */
export function headline(parts: readonly [string, ...string[]]): string {
  const [first, ...rest] = parts
  return rest.length === 0 ? first : `${first} (${rest.join(', ')})`
}

/* The tuple is a *snapshot*. `value` is the number as it was when `render()` ran, and
   it does not update afterwards — which is exactly how `useState` behaves, and the
   source of a great deal of confusion about it. `increment` is stable and closes over
   the live variable, so calling `render()` again produces a fresh snapshot.

   The labels — `[value: number, increment: () => void]` — cost nothing and are the
   reason a caller's editor suggests `const [value, increment]` rather than
   `const [a, b]`. On a tuple of two different types, they are most of the reason to
   prefer a tuple over an object at all. */
export function makeCounter(initial: number): () => readonly [value: number, increment: () => void] {
  let count = initial
  const increment = () => {
    count += 1
  }

  return () => [count, increment]
}
