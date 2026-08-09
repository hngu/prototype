/**
 * Exercise: A labelled tray, not a bag
 * Lesson:   typescript-functions-objects/tuples-and-readonly
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Read the types first. Every one of them is a tuple, and each says something an
 * array type cannot: how many slots there are, what goes in each, and — for
 * `headline` — that there is at least one.
 */

/**
 * A pair. The names `name` and `score` are **labels**: they show up in editor
 * tooltips and in destructuring suggestions, and they are erased like everything
 * else. `Entry[0]` is still how you index it.
 */
export type Entry = readonly [name: string, score: number]

/**
 * Pairs two lists up, stopping at the shorter one.
 *
 *   zip(['a', 'b', 'c'], [1, 2])  →  [['a', 1], ['b', 2]]
 */
export function zip(names: readonly string[], scores: readonly number[]): readonly Entry[] {
  throw new Error('TODO: pair them up, stopping when either list runs out')
}

/**
 * Splits entries by score, keeping the original order in each half.
 *
 * The return type is a tuple, so a caller can write
 * `const [passes, fails] = partition(…)`.
 */
export function partition(
  entries: readonly Entry[],
  threshold: number,
): readonly [passes: readonly Entry[], fails: readonly Entry[]] {
  throw new Error('TODO: score >= threshold passes')
}

/**
 * `readonly [string, ...string[]]` is a tuple with a **rest element** — one required
 * slot and then any number more. Which is how you say "a non-empty list" as a type,
 * and why `parts[0]` below is a `string` rather than `string | undefined`.
 *
 *   headline(['Results'])                     →  'Results'
 *   headline(['Results', 'term 1', '2026'])   →  'Results (term 1, 2026)'
 */
export function headline(parts: readonly [string, ...string[]]): string {
  throw new Error('TODO: the first part, then the rest in brackets')
}

/**
 * A `useState`-style pair, and the same idea: calling the render function again gives
 * you the value as it is *now*, plus the same way to change it.
 *
 *   const render = makeCounter(0)
 *   const [value, increment] = render()   // value is 0
 *   increment()
 *   const [next] = render()               // next is 1
 */
export function makeCounter(initial: number): () => readonly [value: number, increment: () => void] {
  throw new Error('TODO: keep a count, and hand back a snapshot of it plus a way to bump it')
}
