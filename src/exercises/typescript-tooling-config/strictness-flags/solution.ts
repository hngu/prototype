/**
 * Reference solution: Every flag is a question you have to answer
 * Lesson: typescript-tooling-config/strictness-flags
 */

export interface LogLine {
  readonly level: Level
  readonly message: string
}

export type Level = 'debug' | 'info' | 'warn' | 'error'

/** The four levels as a value, so `isLevel` has something real to check against. */
const LEVELS: readonly Level[] = ['debug', 'info', 'warn', 'error']

/* `?? ''` and nothing else.

   The tempting alternatives are all worse. `text.split('\n')[0]!` asserts the compiler is
   wrong, which it is here and will not be somewhere else. `as string` is the same assertion
   in a longer coat. And `[0] || ''` looks identical but is not: `||` also replaces an empty
   first line with `''`, which happens to be the same answer here and is a bug waiting for a
   function where `0` or `false` is a legitimate value. Lesson 1.8. */
export function firstLine(text: string): string {
  return text.split('\n')[0] ?? ''
}

/* Optional chaining does both levels in one expression, which is the whole reason `?.`
   exists. Worth being explicit about what it evaluates to: if `rows[row]` is `undefined`,
   the whole expression short-circuits to `undefined` and `[col]` is never evaluated.

   Note the parameter type is `readonly (readonly string[])[]` — readonly at both levels. One
   `readonly` on the outside would still let a caller mutate a row, which is the kind of thing
   that is obvious once seen and invisible until then. */
export function cellAt(
  rows: readonly (readonly string[])[],
  row: number,
  col: number,
): string | undefined {
  return rows[row]?.[col]
}

/* `?? 0` per lookup, and the comment in the brief about `0` being a real value is the point:
   `config[key] || 0` would give the same answer for a missing key *and* for a key whose value
   is genuinely `0`, which is fine here and is a habit that breaks the first time the default
   is not the falsy value.

   The flag being obeyed is `noUncheckedIndexedAccess`, and it is right rather than pedantic:
   a `Record<string, number>` is indexed by *every* string, so any given key really can be
   missing. Note that a `Record<Level, number>` would not have this problem, because then the
   compiler knows the complete key set — picking the tighter key type is usually a better fix
   than adding a `??`. */
export function sumOf(
  config: Readonly<Record<string, number>>,
  keys: readonly string[],
): number {
  let total = 0

  for (const key of keys) {
    total += config[key] ?? 0
  }

  return total
}

/* The catch variable is `unknown`, and everything about that is deliberate.

   Before `useUnknownInCatchVariables` (part of `strict` since 4.4) it was `any`, so
   `error.message` compiled and threw a *second* error whenever somebody threw a string. And
   people do: `throw 'nope'` is legal JavaScript, a rejected promise can carry anything, and
   `JSON.parse` on some engines has historically thrown things that are not quite `Error`s.

   `instanceof Error` then `String(thrown)` is the whole pattern, and it is short enough that
   there was never a good reason for the old default. */
export function parseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (thrown) {
    return { ok: false, error: thrown instanceof Error ? thrown.message : String(thrown) }
  }
}

/* An exhaustive switch with **no `default`**, which is the point.

   Every arm returns, so control never reaches the end — and because `Level` has four members
   and all four are handled, `level` is `never` at the bottom. `assertNever` takes a `never`,
   so this compiles today and stops compiling the moment somebody adds `'fatal'` to `Level`.

   A `default: return 'unknown'` would have been shorter and would hide that change forever.
   That is the trade: a `default` arm converts a compile error into a silently wrong label.

   `noFallthroughCasesInSwitch` is the other flag here — it catches a missing `return` or
   `break` between arms, which in a function like this is always a bug rather than a clever
   trick. */
export function labelFor(level: Level): string {
  switch (level) {
    case 'debug':
      return 'trace'
    case 'info':
      return 'note'
    case 'warn':
      return 'careful'
    case 'error':
      return 'stop'
  }

  return assertNever(level)
}

/** Takes a `never`, so calling it is only possible when every case really is handled. */
function assertNever(value: never): never {
  throw new Error(`unhandled level: ${String(value)}`)
}

/* `parts[0]` and `parts[1]` are both `string | undefined`, so both need answering — and the
   `isLevel(level)` check is what turns the first from a `string` into a `Level` without a
   cast. `as Level` would compile and would happily let `banana: hello` through as a valid
   level, which is exactly the bug a predicate prevents. Lesson 1.5. */
export function parseLines(text: string): readonly LogLine[] {
  const lines: LogLine[] = []

  for (const raw of text.split('\n')) {
    const parts = raw.split(':')
    const level = parts[0]?.trim()

    /* `parts.slice(1)` rather than `parts[1]`, so a message containing a colon survives. */
    const message = parts.slice(1).join(':').trim()

    if (level === undefined || level === '' || message === '') continue
    if (!isLevel(level)) continue

    lines.push({ level, message })
  }

  return lines
}

/* `LEVELS.includes(value)` reads well and does not narrow on its own — the `value is Level`
   return type is the annotation that makes the check usable, and the compiler takes it on
   trust. That trust is the whole deal with a predicate: it is a claim you are signing for,
   which is why the body has to be a real check. */
export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value)
}
