/**
 * Exercise: Three ways to say I don't know
 * Lesson:   typescript-fundamentals/any-unknown-never
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The rule for this exercise: **the word `any` must not appear in your answer.**
 * Everything here is doable with `unknown` and a check, which is the point.
 */

export type Status = 'queued' | 'running' | 'done'

/** Either a parsed document nobody has inspected yet, or the reason there isn't one. */
export type ParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string }

/**
 * Parses JSON without lying about the result.
 *
 * `JSON.parse` is typed as returning `any`, which is how a malformed document
 * gets three functions deep before anything complains. This returns `unknown`
 * instead, so the caller has to look.
 */
export function parseJson(text: string): ParseResult {
  throw new Error('TODO: parse, and report "invalid JSON" rather than throwing')
}

/**
 * The impossible case, made loud.
 *
 * `never` is the type with no values at all, so a parameter of type `never` can
 * only be satisfied by an argument the compiler believes cannot exist. If this
 * function still compiles, you have covered everything.
 */
export function assertNever(value: never, context: string): never {
  throw new Error('TODO: throw `unexpected <context>: <value as JSON>`')
}

/** `'queued'` → `'waiting to start'`, `'running'` → `'in progress'`, `'done'` → `'finished'`. */
export function statusLabel(status: Status): string {
  throw new Error('TODO: switch, with a default that calls assertNever')
}

/**
 * Reads a finite `count` out of a JSON document.
 *
 *   countFrom('{"count":3}')  →  3
 *   countFrom('{"count":"3"}')  →  undefined
 */
export function countFrom(text: string): number | undefined {
  throw new Error('TODO: parse with parseJson, then check your way down to the number')
}
