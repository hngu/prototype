/**
 * Exercise: What fits in, what drops out
 * Lesson:   typescript-functions-objects/function-signatures
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Every signature here is already written, and each one is deliberately a
 * different shape: an optional parameter, two defaults, a rest parameter, a
 * function-typed parameter, and a callback that returns `void`. Read them before
 * you write anything.
 */

/** A function type expression: takes nothing, returns a string, or throws. */
export type Attempt = () => string

/**
 * A log line, from a level and any number of parts.
 *
 *   logLine('info')                 →  '[info]'
 *   logLine('warn', 'disk', 'full') →  '[warn] disk full'
 */
export function logLine(level: string, ...parts: readonly string[]): string {
  throw new Error('TODO: bracket the level, then the parts joined by spaces')
}

/**
 * Shortens `text` to `limit` characters, adding an ellipsis when it had to cut.
 * `limit` is **optional** and means 20 when absent.
 *
 *   truncate('hello world', 5)  →  'hello…'
 *   truncate('hello', 5)        →  'hello'
 */
export function truncate(text: string, limit?: number): string {
  throw new Error('TODO: cut and append … only when the text is longer than limit')
}

/**
 * Left-pads `text` to `width` with `fill`. Both have **defaults**, so the type
 * annotations are inferred from them rather than written.
 *
 *   pad('7')            →  '       7'
 *   pad('7', 3, '0')    →  '007'
 *   pad('12345', 3)     →  '12345'   (never truncates)
 */
export function pad(text: string, width = 8, fill = ' '): string {
  throw new Error('TODO: pad on the left, and leave text alone when it is long enough')
}

/**
 * Calls `attempt` until it returns, giving up after `times` failures.
 *
 * On success, returns whatever `attempt` returned. On the last failure, throws
 * `` `failed after 3 attempts: <message>` `` — singular `attempt` when times is 1.
 *
 * Note what `catch` hands you: `strict` includes `useUnknownInCatchVariables`, so
 * the caught value is `unknown` and not necessarily an `Error`.
 */
export function retry(attempt: Attempt, times = 3): string {
  throw new Error('TODO: loop, catch, and throw a summary after the last failure')
}

/**
 * Calls `visit` once per line and returns how many lines there were. Splits on
 * `'\n'` only, so `''` counts as one (empty) line.
 *
 * `visit` returns `void`, which is a promise about the *caller*: this function
 * will ignore whatever comes back.
 */
export function forEachLine(text: string, visit: (line: string, index: number) => void): number {
  throw new Error('TODO: split, visit each line, return the count')
}
