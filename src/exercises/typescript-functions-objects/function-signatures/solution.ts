/**
 * Reference solution: What fits in, what drops out
 * Lesson: typescript-functions-objects/function-signatures
 */

export type Attempt = () => string

/* A rest parameter is always an array type, and `readonly string[]` is the right
   one: this function reads the parts and never touches them, and the caller gets
   to hand over a frozen array without an argument.

   `...parts` also means the arity is genuinely open — `logLine('info')` is a legal
   call with `parts` as `[]`, which is why there is no optional marker anywhere and
   no `undefined` to handle. */
export function logLine(level: string, ...parts: readonly string[]): string {
  return parts.length === 0 ? `[${level}]` : `[${level}] ${parts.join(' ')}`
}

/* `limit?: number` types the parameter `number | undefined`, so it has to be
   resolved before use — `??` rather than `||`, because a limit of `0` is a
   perfectly sensible thing to ask for and `||` would quietly turn it into 20.

   An optional parameter and a defaulted one differ in exactly one visible way: an
   optional one leaves the `undefined` for you to deal with, and a default handles
   it before the body starts. Compare with `pad` below. */
export function truncate(text: string, limit?: number): string {
  const max = limit ?? 20
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/* Two defaults, and therefore two parameters whose types were never written down —
   `width` is `number` and `fill` is `string`, inferred from the values, exactly as
   a `let` would be.

   A defaulted parameter is optional at the call site *and* non-optional inside the
   body, which is the whole appeal: `width` is `number` here, never
   `number | undefined`. Passing `undefined` explicitly also triggers the default,
   which is the one thing people find surprising. */
export function pad(text: string, width = 8, fill = ' '): string {
  return text.padStart(width, fill)
}

/* Two things worth noticing in this one.

   `times = 3` is a default, so the loop bound is a plain `number`. And `catch
   (error)` gives you `unknown`, because `strict` turns on
   `useUnknownInCatchVariables` — JavaScript lets you `throw` anything at all, and
   for years TypeScript pretended otherwise by typing it `any`. Narrowing it with
   `instanceof Error` is the honest way through, and it is the same move as lesson
   1.7's `unknown` gate.

   `lastMessage` starts as a string rather than `string | undefined` so the throw at
   the end needs no second check — a small thing, but the alternative is a `!` or a
   redundant branch, and neither pays for itself. */
export function retry(attempt: Attempt, times = 3): string {
  let lastMessage = 'no attempts were made'

  for (let remaining = times; remaining > 0; remaining -= 1) {
    try {
      return attempt()
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(`failed after ${times} attempt${times === 1 ? '' : 's'}: ${lastMessage}`)
}

/* The interesting part of this function is a type that is not here.

   `visit` is declared `(line: string, index: number) => void`. That does not
   require the caller to hand over a function returning nothing — it promises that
   *this* function will ignore whatever it gets back. So `(line) => seen.push(line)`
   is a legal argument even though `push` returns a number, which is the rule that
   makes `array.forEach(x => list.push(x))` compile. A callback parameter typed
   `=> void` is nearly always what you want. */
export function forEachLine(text: string, visit: (line: string, index: number) => void): number {
  const lines = text.split('\n')
  lines.forEach((line, index) => visit(line, index))
  return lines.length
}
