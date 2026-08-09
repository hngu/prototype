/**
 * Exercise: Every flag is a question you have to answer
 * Lesson:   typescript-tooling-config/strictness-flags
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * There is no sloppy code to fix here, because this package could not contain any — a fresh
 * clone has to typecheck. The exercise is the other way round: every function below is a
 * place where a strictness flag **stops you writing the obvious thing**, and the work is
 * answering the question it asks.
 *
 * The flags actually doing the work, all on in this package's tsconfig:
 *
 *   strictNullChecks              `null` and `undefined` are not members of every type
 *   noUncheckedIndexedAccess      `array[0]` is `T | undefined`
 *   useUnknownInCatchVariables    `catch (error)` gives you `unknown`
 *   noFallthroughCasesInSwitch    a case that falls through is an error
 *   noImplicitAny                 an unannotated parameter is an error
 *
 * Every signature below is already correct. Not one of them needs a cast, a `!`, or an
 * `any` — and reaching for one is how you find out you have not answered the question.
 */

/** A parsed log line. */
export interface LogLine {
  readonly level: Level
  readonly message: string
}

export type Level = 'debug' | 'info' | 'warn' | 'error'

/**
 * The first line of `text`, or `''` if there is none.
 *
 * `text.split('\n')[0]` is `string | undefined` under `noUncheckedIndexedAccess`, even
 * though you and I know `split` never returns an empty array. The compiler does not know
 * that, and it is right not to: the same rule applied to a genuinely empty array is what
 * catches real bugs.
 */
export function firstLine(text: string): string {
  throw new Error('TODO: no `!`, no cast')
}

/**
 * The cell at `row`/`col`, or `undefined` if either index is out of range.
 *
 * Two levels of indexed access, so two `undefined`s to deal with — and the second one is
 * the one people forget.
 */
export function cellAt(rows: readonly (readonly string[])[], row: number, col: number): string | undefined {
  throw new Error('TODO: one expression, if you like the right operator')
}

/**
 * Sums the values at `keys`, treating a missing key as `0`.
 *
 * A `Record<string, number>` lookup is `number | undefined` under
 * `noUncheckedIndexedAccess`, which is the flag being right: a record indexed by `string`
 * really can be missing any given key.
 */
export function sumOf(config: Readonly<Record<string, number>>, keys: readonly string[]): number {
  throw new Error('TODO: mind that 0 is a real value')
}

/**
 * Parses `text` as JSON.
 *
 * `catch (error)` gives you `unknown`, not `any` — `useUnknownInCatchVariables`, part of
 * `strict`. So you cannot read `error.message` without checking, and you should not want to:
 * JavaScript lets anyone `throw` anything, including a string or `undefined`.
 *
 * On failure, `error` is the thrown value's `message` if it was an `Error`, and
 * `String(thrown)` otherwise.
 */
export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  throw new Error('TODO: narrow the catch variable, do not assume')
}

/**
 * A one-word label per level.
 *
 * debug → `trace`, info → `note`, warn → `careful`, error → `stop`.
 *
 * Write it as a `switch` with no `default` arm and an exhaustiveness check at the end. Then
 * the compiler tells you when somebody adds a fifth level, which a `default` returning
 * `'unknown'` would hide forever.
 */
export function labelFor(level: Level): string {
  throw new Error('TODO: exhaustive switch, no default')
}

/**
 * Parses `<level>: <message>` lines, skipping any line that is blank or has an unknown level.
 *
 * `parts[0]` and `parts[1]` are both `string | undefined`, and `isLevel` is the honest way
 * to get from a `string` to a `Level`.
 */
export function parseLines(text: string): readonly LogLine[] {
  throw new Error('TODO: use isLevel rather than a cast')
}

/** Is this string one of the four levels? A real check, so the compiler can trust it. */
export function isLevel(value: string): value is Level {
  throw new Error('TODO: and it must narrow, not just return a boolean')
}
